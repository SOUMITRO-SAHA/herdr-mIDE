// mIDE Changes — a git panel for the review-and-commit loop: staged,
// tracked and untracked files as separate groups with per-file staging,
// a guided commit (staged files only), and an inline branch switcher.
// Clicking a file opens its diff in the dedicated mIDE Diff tab.
import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input, TextareaState, Textarea, Checkbox, Scrollbar } from "gpui-base";
import { spaces, panes, focused, exec, watchFolder, theme, setShared, run } from "herdr";

function location(previous) {
  const f = focused(), allSpaces = spaces();
  const space = allSpaces.find(s => s.id === f?.space) ?? allSpaces.find(s => s.active);
  const allPanes = panes(), pane = f?.pane ? allPanes.find(p => p.pane === f.pane) : null;
  const tabIds = new Set(space?.tabs.map(tab => tab.id) ?? []);
  const terminals = allPanes.filter(p => tabIds.has(p.tab) && p.terminal && p.cwd);
  const tabTerminal = terminals.find(p => p.tab === f?.tab);
  const on = f?.pane === null ? (f.terminal?.includes("/") ? f.terminal.split("/")[0] : null) : space?.machine ?? null;
  // Mod-only tabs have no cwd. Keep the workspace of the tab that opened
  // them; when a mod is split beside a terminal, prefer that terminal's live
  // folder. A space's initial folder can be stale after terminals move.
  const cwd = pane?.cwd || f?.cwd || tabTerminal?.cwd
    || (pane?.mod && previous?.space === space?.id ? previous.cwd : null)
    || terminals[0]?.cwd || space?.folder;
  return { cwd, on, space: space?.id, tab: f?.tab };
}
const key = loc => JSON.stringify({ cwd: loc.cwd, on: loc.on, space: loc.space });
// Reads write nothing under .git (no index refresh or lock, no fsmonitor cookie):
// the folder watch would see it, and every refresh would start the next one.
const READ = ["--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "diff.autoRefreshIndex=false"];

export default class MideChanges extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.view = "changes"; this.files = []; this.staged = 0;
    this.message = ""; this.typing = false; this.branches = []; this.branch = null; this.branchInput = null;
    this.input = TextareaState.new({ placeholder: "Enter commit message", rows: 3 });
    this.input.set_auto_grow(2, 4);
    this.input.on("change", (_e, cx) => {
      const had = Boolean(this.message.trim());
      this.message = this.input.value();
      if (had !== Boolean(this.message.trim())) cx.notify();
    });
    this.input.on("submit", (_e, cx) => this.commit(cx));
    this.input.on("focus", (_e, cx) => { this.typing = true; cx.notify(); });
    this.input.on("blur", (_e, cx) => { this.typing = false; cx.notify(); });
    this.newBranch = InputState.new({ placeholder: "branch name" });
    this.refresh(cx);
    cx.timer.every(10000, (cx) => this.refresh(cx));
  }

  watch(root, cx) {
    if (this.on || this.watched === root) return;
    this.watched = root;
    cx.spawn(async (cx) => {
      try {
        while (this.watched === root) {
          await watchFolder(root);
          if (this.watched === root) this.refresh(cx);
        }
      } catch { this.watched = null; }
    });
  }

  currentKey() {
    return key(location(this.location));
  }

  refresh(cx) {
    if (this.loading || this.busy) return;
    const loc = location(this.location), { cwd, on } = loc, context = key(loc);
    this.location = loc;
    if (context !== this.context) {
      this.context = context; this.root = null; this.files = []; this.open = null; this.openStaged = null; this.branch = null;
      this.message = ""; this.input.set_value(""); this.error = null; this.note = null;
      this.watched = null; this.limited = false; this.view = "changes";
    }
    if (!cwd) return;
    this.loading = true;
    cx.spawn(async (cx) => {
      try {
        const top = await exec("git", ["rev-parse", "--show-toplevel"], { cwd, on });
        if (this.currentKey() !== context) return;
        if (top.code !== 0) { this.root = null; this.files = []; this.open = null; this.error = "Not a git repository"; return; }
        const root = top.stdout.trim(), git = (args) => exec("git", [...READ, ...args], { cwd: root, on });
        const branch = await git(["branch", "--show-current"]);
        const status = await git(["status", "--porcelain=v1", "-z", "--no-renames", "--untracked-files=all"]);
        if (status.code !== 0) throw new Error(status.stderr);
        // Stats per side of the index, so each group shows its own +/−.
        const stats = {};
        for (const result of [await git(["diff", "--cached", "--numstat", "-z", "--no-renames"]), await git(["diff", "--numstat", "-z", "--no-renames"])]) {
          if (result.code !== 0) throw new Error(result.stderr);
          for (const entry of result.stdout.split("\0")) {
            const [a, d, ...parts] = entry.split("\t");
            if (!parts.length) continue;
            const path = parts.join("\t"), old = stats[path] ?? { add: 0, del: 0 };
            stats[path] = { add: old.add + (Number(a) || 0), del: old.del + (Number(d) || 0), binary: a === "-" };
          }
        }
        const files = [];
        const entries = status.stdout.split("\0").filter(Boolean);
        for (const entry of entries.slice(0, 1000)) {
          const xy = entry.slice(0, 2), path = entry.slice(3);
          const conflict = xy.includes("U") || xy === "AA" || xy === "DD";
          const fresh = xy === "??";
          const inIndex = !fresh && xy[0] !== " ";
          const inWork = fresh || xy[1] !== " ";
          const stat = stats[path] ?? { add: 0, del: 0 };
          const row = { path, conflict, fresh, add: stat.add, del: stat.del, binary: stat.binary };
          if (conflict) files.push({ ...row, side: "work", status: "U" });
          else {
            if (inIndex) files.push({ ...row, side: "index", status: xy[0] === "A" ? "A" : xy[0] === "D" ? "D" : "M" });
            if (inWork) files.push({ ...row, side: "work", status: fresh || xy[1] === "A" ? "A" : xy[1] === "D" ? "D" : "M" });
          }
        }
        if (this.currentKey() !== context) return;
        this.root = root; this.on = on; this.branch = branch.code === 0 ? branch.stdout.trim() : null;
        this.files = files; this.staged = files.filter((f) => f.side === "index").length;
        this.limited = entries.length > 1000; this.error = null;
        this.watch(root, cx);
      } catch (e) { if (this.currentKey() === context) this.error = String(e); }
      finally { this.loading = false; cx.notify(); }
    });
  }

  // The panel is a list, not a split view: a click hands the file to the
  // mIDE Diff mod. Reuse its tab when one exists so repeated browsing stays
  // one tab instead of a trail of them.
  openDiff(file, cx) {
    if (!this.root) return;
    const title = `Diff · ${file.path.split("/").pop()}`;
    const request = { root: this.root, path: file.path, side: file.side, status: file.status, fresh: file.fresh, on: this.on, branch: this.branch, title };
    this.open = file.path; this.openStaged = file.side; this.note = null;
    setShared("mide.diff.request", request);
    const focus = focused(), allSpaces = spaces();
    const space = allSpaces.find(s => s.id === focus?.space) ?? allSpaces.find(s => s.active);
    const all = panes();
    const existing = space?.tabs.find((tab) => all.some((p) => p.tab === tab.id && p.mod === "mide-diff"));
    if (existing) {
      run("tab.rename", { id: existing.id, name: title });
      run("tab.select", { id: existing.id });
      run("mide-diff.open");
    } else run("tab.new", { name: title, ...(space ? { space: space.id } : {}), mod: "mide-diff", props: request });
    cx.notify();
  }

  // Stage / unstage one file; stageAll covers the "everything the agent
  // touched" case. Refresh follows from the folder watch, but ping once
  // anyway so the panel answers immediately.
  git(cx, args, then) {
    const root = this.root, on = this.on, context = this.context;
    this.busy = true; this.note = null;
    cx.spawn(async (cx) => {
      try {
        const r = await exec("git", args, { cwd: root, on });
        if (r.code !== 0) throw new Error((r.stderr || r.stdout).trim());
        if (this.currentKey() === context && then) then();
      } catch (e) { if (this.currentKey() === context) this.note = String(e); }
      finally { this.busy = false; this.refresh(cx); cx.notify(); }
    });
    cx.notify();
  }

  stage(file, cx) { this.git(cx, ["add", "--", file.path]); }
  unstage(file, cx) { this.git(cx, ["restore", "--staged", "--", file.path]); }
  stageAll(cx) { this.git(cx, ["add", "-A"]); }
  fetch(cx) { this.git(cx, ["fetch", "--prune"]); }

  commit(cx) {
    if (!this.message.trim() || !this.root || this.busy || this.loading || this.context !== this.currentKey() || !this.staged) return;
    const message = this.message.trim();
    this.git(cx, ["commit", "-m", message], () => { this.message = ""; this.input.set_value(""); });
  }

  showBranches(cx) {
    this.view = "branches"; this.branches = []; this.branchError = null;
    const root = this.root, on = this.on, context = this.context;
    cx.spawn(async (cx) => {
      try {
        const r = await exec("git", [...READ, "branch", "--format=%(refname:short)"], { cwd: root, on });
        if (this.currentKey() !== context) return;
        if (r.code !== 0) throw new Error(r.stderr);
        this.branches = r.stdout.split("\n").map(s => s.trim()).filter(Boolean).slice(0, 200);
      } catch (e) { if (this.currentKey() === context) this.branchError = String(e); }
      finally { cx.notify(); }
    });
    cx.notify();
  }

  switchBranch(name, cx) {
    this.git(cx, ["switch", name], () => { this.view = "changes"; });
    cx.notify();
  }

  createBranch(cx) {
    const name = this.newBranch.value().trim();
    if (!name) return;
    this.newBranch.set_value("");
    this.git(cx, ["switch", "-c", name], () => { this.view = "changes"; });
  }

  deleteBranch(name, cx) {
    this.git(cx, ["branch", "-d", name]);
    cx.notify();
  }

  fileRow(f, t) {
    const parts = f.path.split("/"), name = parts.pop();
    const selected = this.open === f.path && this.openStaged === f.side;
    const color = f.status === "A" ? (t.git_added ?? t.ansi2) : f.status === "D" || f.status === "U" ? (t.git_deleted ?? t.ansi1) : (t.git_modified ?? t.blocked);
    return h_flex().id(`change-${f.side}-${f.path}`).h(28).flex_none().px(8).gap(8).items_center().rounded(7).cursor_pointer().when(selected, (e) => e.bg(t.selected)).hover((s) => s.bg(t.hover)).on_click((_e, cx) => this.openDiff(f, cx))
      .child(div().w(14).text_size(11).font_semibold().text_color(color).child(f.status))
      .child(h_flex().flex_1().min_w(0).child(div().text_color(t.dim).truncate().child(parts.length ? parts.join("/") + "/" : "")).child(div().max_w(200).min_w(0).truncate().child(name)))
      .when(f.add > 0, (e) => e.child(div().text_size(11).text_color(t.ansi2).child(`+${f.add}`))).when(f.del > 0, (e) => e.child(div().text_size(11).text_color(t.ansi1).child(`−${f.del}`)))
      .child(Checkbox.new(`stage-${f.side}-${f.path}`).w(14).h(14).flex_none().checked(f.side === "index")
        .accessibility_label(`${f.side === "index" ? "Unstage" : "Stage"} ${f.path}`)
        .on_click((_e, cx) => cx.stop_propagation())
        .on_change((checked, cx) => checked ? this.stage(f, cx) : this.unstage(f, cx)));
  }

  group(label, files, t, extra) {
    return v_flex().flex_none()
      .child(h_flex().h(24).px(8).gap(6).items_center()
        .child(div().text_size(11).font_semibold().text_color(t.muted).child(label))
        .child(div().text_size(10).text_color(t.dim).child(String(files.length)))
        .child(div().flex_1()).children(extra ?? []))
      .children(files.map((f) => this.fileRow(f, t)));
  }

  render(cx) {
    if (this.currentKey() !== this.context) this.refresh(cx);
    const t = theme(), index = this.files.filter((f) => f.side === "index"), work = this.files.filter((f) => f.side !== "index");
    const tracked = work.filter((f) => !f.fresh), untracked = work.filter((f) => f.fresh);
    const add = this.files.reduce((n, f) => n + f.add, 0), del = this.files.reduce((n, f) => n + f.del, 0);
    const fileCount = new Set(this.files.map((f) => f.path)).size;
    const canCommit = Boolean(this.message.trim() && this.root && this.staged && !this.busy && !this.loading && this.context === this.currentKey());
    return v_flex().id("mide-changes").size_full().min_h(0).rounded(10).overflow_hidden().bg(t.background).border_1().border_color(t.border).text_color(t.foreground).text_size(13).track_focus(this.handle)
      .on_key_down((e, cx) => {
        if (e.key === "escape" && this.typing) { this.typing = false; this.handle.focus(); cx.stop_propagation(); cx.notify(); }
        if (e.key === "escape" && this.view === "branches") { this.view = "changes"; cx.notify(); }
      })
      .child(h_flex().h(42).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border)
        .child(div().font_semibold().child(this.view === "branches" ? "Branches" : "Changes"))
        .when(this.view === "changes", (e) => e.child(div().px(5).py(1).rounded(4).border_1().border_color(t.border).text_size(10).text_color(t.muted).child(`${fileCount} files`)))
        .child(div().flex_1())
        .when(this.view === "changes", (e) => e
          .child(div().text_size(11).text_color(t.git_added ?? t.ansi2).child(`+${add}`))
          .child(div().text_size(11).text_color(t.git_deleted ?? t.ansi1).child(`−${del}`))
          .child(div().id("mide-stage-all").h(24).px(9).flex().items_center().rounded(6).border_1().border_color(t.border).text_size(11).text_color(work.length && !this.busy ? t.foreground : t.dim).when(Boolean(work.length && !this.busy), (el) => el.cursor_pointer().hover((s) => s.bg(t.hover)).on_click((_e, cx) => this.stageAll(cx))).child(this.busy ? "Working…" : "Stage All")))
        .when(this.view === "branches", (e) => e.child(div().id("mide-branch-back").h(24).px(8).flex().items_center().rounded(6).border_1().border_color(t.border).text_size(11).cursor_pointer().hover((s) => s.bg(t.hover)).on_click((_e, cx) => { this.view = "changes"; cx.notify(); }).child("Back"))))
      .when(this.view === "branches", (el) => el
        .child(v_flex().flex_1().min_h(0).overflow_y_scrollbar().p(6).gap(2)
          .children(this.branches.map((name) => h_flex().id(`branch-${name}`).h(28).flex_none().px(8).gap(8).items_center().rounded(7).cursor_pointer().when(name === this.branch, (e) => e.bg(t.selected)).hover((s) => s.bg(t.hover)).on_click((_e, cx) => this.switchBranch(name, cx))
            .child(div().flex_1().min_w(0).truncate().child(name))
            .when(name === this.branch, (e) => e.child(div().text_size(10).text_color(t.dim).child("current")))
            .when(name !== this.branch, (e) => e.child(div().id(`branch-del-${name}`).text_size(11).text_color(t.muted).hover((s) => s.text_color(t.ansi1)).on_click((_e, cx) => { cx.stop_propagation(); this.deleteBranch(name, cx); }).child("delete")))))
          .child(h_flex().h(32).flex_none().px(8).mt(6).gap(8).items_center()
            .child(div().flex_1().min_w(0).h(28).px(8).flex().items_center().rounded(7).border_1().border_color(t.border).child(Input.new(this.newBranch).h_full().text_size(12).text_color(t.foreground).on("submit", (_e, cx) => this.createBranch(cx))))
            .child(div().id("mide-branch-new").h(28).px(10).flex().items_center().rounded(7).bg(t.solid).text_color(t.solid_foreground).text_size(12).cursor_pointer().on_click((_e, cx) => this.createBranch(cx)).child("New")))
          .when(Boolean(this.branchError), (e) => e.child(div().p(8).text_size(11).text_color(t.ansi1).child(this.branchError)))
          .when(!this.branches.length, (e) => e.child(div().p(8).text_color(t.dim).child(this.error || (this.loading ? "Loading branches…" : "No local branches")))))
        .when(Boolean(this.note), (e) => e.child(div().px(10).pb(8).text_size(11).text_color(t.ansi1).child(this.note))))
      .when(this.view === "changes", (el) => el
        .child(div().flex_1().min_h(0).relative().border_b(1).border_color(t.border)
          .child(v_flex().id("mide-changes-list").absolute().inset_0().overflow_y_scroll().p(6)
            .when(Boolean(index.length), (e) => e.child(this.group("STAGED", index, t)))
            .when(Boolean(index.length && work.length), (e) => e.child(div().h(6).flex_none()))
            .when(Boolean(tracked.length), (e) => e.child(this.group("TRACKED", tracked, t)))
            .when(Boolean((index.length || tracked.length) && untracked.length), (e) => e.child(div().h(6).flex_none()))
            .when(Boolean(untracked.length), (e) => e.child(this.group("UNTRACKED", untracked, t)))
            .when(!this.files.length, (e) => e.child(div().p(8).text_color(t.dim).child(this.error || (this.loading ? "Loading changes…" : this.root ? "No uncommitted changes" : "No folder"))))
            .when(this.limited, (e) => e.child(div().p(8).text_size(11).text_color(t.dim).child("Showing the first 1,000 changed files"))))
          .child(Scrollbar.vertical("mide-changes-list").absolute().inset_0()))
        .when(Boolean(this.note), (e) => e.child(div().px(10).pb(8).text_size(11).text_color(t.ansi1).child(this.note))))
      .when(this.view === "changes", (e) => e.child(h_flex().h(30).flex_none().px(10).gap(6).items_center().border_t(1).border_color(t.border)
        .child(div().flex_1().min_w(0).text_size(10).text_color(t.dim).truncate().child(this.root?.split(/[\\/]/).pop() ?? "Repository"))
        .child(div().id("mide-branch").h(23).max_w(150).px(7).flex().items_center().rounded(6).border_1().border_color(t.border).text_size(10).text_color(this.branch ? t.foreground : t.dim).cursor_pointer().hover((s) => s.border_color(t.input)).on_click((_e, cx) => this.showBranches(cx)).child(this.branch ?? "—"))
        .child(div().id("mide-fetch").h(23).px(7).flex().items_center().rounded(6).border_1().border_color(t.border).text_size(10).text_color(this.busy ? t.dim : t.muted).when(!this.busy, (e) => e.cursor_pointer().hover((s) => s.text_color(t.foreground)).on_click((_e, cx) => this.fetch(cx))).child(this.busy ? "Working…" : "Fetch"))))
      .child(v_flex().flex_none().p(8).gap(7).border_t(1).border_color(t.border)
        .child(div().id("mide-commit-message").h(72).px(8).py(5).rounded(7).border_1().border_color(this.typing ? t.accent : t.border).cursor_text().on_mouse_down("left", (_e, cx) => cx.stop_propagation()).child(Textarea.new(this.input).size_full().text_size(12).text_color(t.foreground)))
        .child(h_flex().h(30).flex_none().gap(8).items_center()
          .child(div().flex_1().text_size(10).text_color(t.dim).child(this.staged ? `${this.staged} staged` : "Stage changes to enable commit"))
          .child(div().id("mide-commit").h(30).px(14).flex().items_center().rounded(7).bg(canCommit ? t.solid : t.raised).text_color(canCommit ? t.solid_foreground : t.dim).text_size(11).when(canCommit, (e) => e.cursor_pointer()).on_click((_e, cx) => this.commit(cx)).child(this.busy ? "Working…" : "Commit"))));
  }
}
