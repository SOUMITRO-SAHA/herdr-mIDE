// mIDE Changes — a git panel for the review-and-commit loop: staged and
// unstaged files as separate groups with per-file staging, a detailed diff
// below, a guided commit (staged files only), and an inline branch switcher.
//
// The diff rendering adapts Herdr's shipped `changes` mod (Apache-2.0):
// numbered rows on a virtual list, so big diffs stay smooth.
import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input, Scrollbar, v_virtual_list } from "gpui-base";
import { spaces, panes, focused, exec, readTextFile, watchFolder, theme, settings } from "herdr";

function location() {
  const space = spaces().find((s) => s.active), f = focused();
  const pane = f?.pane ? panes().find(p => p.pane === f.pane) : null;
  const on = f?.pane === null ? (f.terminal?.includes("/") ? f.terminal.split("/")[0] : null) : space?.machine ?? null;
  return { cwd: pane?.cwd || f?.cwd || space?.folder, on };
}
const key = () => JSON.stringify(location());
// Reads write nothing under .git (no index refresh or lock, no fsmonitor cookie):
// the folder watch would see it, and every refresh would start the next one.
const READ = ["--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "diff.autoRefreshIndex=false"];
const countLines = (text) => text ? text.split("\n").length - Number(text.endsWith("\n")) : 0;

// Numbers each diff line once, so a frame only draws the rows on screen.
function diffRows(lines) {
  let old = 0, next = 0;
  return lines.map((line) => {
    const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)/.exec(line);
    if (match) { old = +match[1]; next = +match[2]; return { kind: "@", text: line }; }
    const kind = line[0];
    if (kind === "-") return { kind, number: old++, text: line.slice(1) || " " };
    if (kind === "+") return { kind, number: next++, text: line.slice(1) || " " };
    if (kind === " ") { old++; return { kind, number: next++, text: line.slice(1) || " " }; }
    return { kind: "", text: line };
  });
}

export default class MideChanges extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.view = "changes"; this.files = []; this.staged = 0; this.rows = []; this.diffWidth = 0;
    this.message = ""; this.typing = false; this.branches = []; this.branch = null; this.branchInput = null;
    this.input = InputState.new({ placeholder: "Commit message" });
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

  refresh(cx) {
    if (this.loading || this.busy) return;
    const { cwd, on } = location(), context = key();
    if (context !== this.context) {
      this.context = context; this.root = null; this.files = []; this.open = null; this.branch = null;
      this.setLines([]); this.message = ""; this.input.set_value(""); this.error = null; this.note = null;
      this.watched = null; this.closed = false; this.limited = false; this.view = "changes";
    }
    if (!cwd) return;
    this.loading = true;
    cx.spawn(async (cx) => {
      try {
        const top = await exec("git", ["rev-parse", "--show-toplevel"], { cwd, on });
        if (key() !== context) return;
        if (top.code !== 0) { this.root = null; this.files = []; this.setLines([]); this.open = null; this.error = "Not a git repository"; return; }
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
        if (key() !== context) return;
        this.root = root; this.on = on; this.branch = branch.code === 0 ? branch.stdout.trim() : null;
        this.files = files; this.staged = files.filter((f) => f.side === "index").length;
        this.limited = entries.length > 1000; this.error = null;
        this.watch(root, cx);
        if (this.open && !files.some((f) => f.path === this.open)) { this.open = null; this.setLines([]); }
        if (!this.open && !this.closed && files.length) this.open = files[0].path;
        if (this.open) {
          try { await this.load(this.open, context); }
          catch { if (key() === context) this.setLines(["Cannot preview this diff (too large or unreadable)"]); }
        }
      } catch (e) { if (key() === context) this.error = String(e); }
      finally { this.loading = false; cx.notify(); }
    });
  }

  async load(path, context) {
    const file = this.files.find((f) => f.path === path && (!this.openStaged || f.side === "index")) ?? this.files.find((f) => f.path === path);
    const root = this.root, on = this.on;
    if (!file) return;
    let lines;
    if (file.fresh) {
      const text = await readTextFile(`${root}/${path}`, { on }).catch(() => null);
      if (text === null) lines = ["Cannot preview this file (binary, too large, or unreadable)"];
      else if (text.includes("\0")) lines = ["Binary file · no text diff"];
      else lines = [`@@ -0,0 +1,${countLines(text)} @@`, ...text.slice(0, 400000).replace(/\n$/, "").split("\n").slice(0, 1500).map(l => `+${l}`)];
    } else {
      const r = await exec("git", [...READ, "diff", ...(file.side === "index" ? ["--cached"] : []), "--no-ext-diff", "--no-textconv", "--no-color", "--", path], { cwd: root, on });
      if (r.code !== 0) throw new Error(r.stderr);
      const all = r.stdout.replace(/\n$/, "").split("\n"), first = all.findIndex((l) => l.startsWith("@@"));
      lines = first < 0 ? [file.binary ? "Binary file changed" : "No text diff available"] : all.slice(first);
    }
    if (key() === context && this.open === path) this.setLines(lines.slice(0, 1500).map(line => line.length > 4000 ? line.slice(0, 4000) + "… (line truncated)" : line));
  }

  setLines(lines) {
    this.rows = diffRows(lines);
    this.diffWidth = Math.max(300, ...lines.map(line => line.length * 7 + 50));
  }

  pick(path, side, cx) {
    this.open = this.open === path && this.openStaged === side ? null : path;
    this.openStaged = side; this.setLines([]); this.note = null;
    this.closed = !this.open;
    const context = this.context;
    if (this.open) cx.spawn(async (cx) => {
      try { await this.load(path, context); }
      catch (e) { if (key() === context && this.open === path) this.note = `Cannot preview this diff: ${e}`; }
      cx.notify();
    });
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
        if (key() === context && then) then();
      } catch (e) { if (key() === context) this.note = String(e); }
      finally { this.busy = false; this.refresh(cx); cx.notify(); }
    });
    cx.notify();
  }

  stage(file, cx) { this.git(cx, ["add", "--", file.path]); }
  unstage(file, cx) { this.git(cx, ["restore", "--staged", "--", file.path]); }
  stageAll(cx) { this.git(cx, ["add", "-A"]); }

  commit(cx) {
    if (!this.message.trim() || !this.root || this.busy || this.loading || this.context !== key() || !this.staged) return;
    const message = this.message.trim();
    this.git(cx, ["commit", "-m", message], () => { this.message = ""; this.input.set_value(""); });
  }

  showBranches(cx) {
    this.view = "branches"; this.branches = []; this.branchError = null;
    const root = this.root, on = this.on, context = this.context;
    cx.spawn(async (cx) => {
      try {
        const r = await exec("git", [...READ, "branch", "--format=%(refname:short)"], { cwd: root, on });
        if (key() !== context) return;
        if (r.code !== 0) throw new Error(r.stderr);
        this.branches = r.stdout.split("\n").map(s => s.trim()).filter(Boolean).slice(0, 200);
      } catch (e) { if (key() === context) this.branchError = String(e); }
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

  diffRow({ kind, number, text }, t) {
    if (kind === "@") return div().w_full().px(12).h(20).flex_none().truncate().bg(t.raised).text_color(t.dim).child(text);
    return h_flex().w_full().h(20).flex_none().gap(10).when(kind === "+", (e) => e.bg(t.ansi2 + "18")).when(kind === "-", (e) => e.bg(t.ansi1 + "18"))
      .child(div().w(30).flex_none().text_right().text_color(t.dim).child(number === undefined ? "" : String(number)))
      .child(div().flex_1().min_w(0).truncate().child(text));
  }

  fileRow(f, t) {
    const parts = f.path.split("/"), name = parts.pop();
    const selected = this.open === f.path && this.openStaged === f.side;
    const color = f.status === "A" ? t.ansi2 : f.status === "D" || f.status === "U" ? t.ansi1 : t.blocked;
    return h_flex().id(`change-${f.side}-${f.path}`).h(28).flex_none().px(8).gap(8).items_center().rounded(7).cursor_pointer().when(selected, (e) => e.bg(t.selected)).hover((s) => s.bg(t.hover)).on_click((_e, cx) => this.pick(f.path, f.side, cx))
      .child(div().w(14).text_size(11).font_semibold().text_color(color).child(f.status))
      .child(h_flex().flex_1().min_w(0).child(div().text_color(t.dim).truncate().child(parts.length ? parts.join("/") + "/" : "")).child(div().max_w(200).min_w(0).truncate().child(name)))
      .when(f.add > 0, (e) => e.child(div().text_size(11).text_color(t.ansi2).child(`+${f.add}`))).when(f.del > 0, (e) => e.child(div().text_size(11).text_color(t.ansi1).child(`−${f.del}`)))
      // Stage and unstage sit on the row itself: the "better file adding" flow.
      .child(f.side === "work"
        ? div().id(`stage-${f.path}`).text_size(11).text_color(t.muted).hover((s) => s.text_color(t.foreground)).on_click((_e, cx) => { cx.stop_propagation(); this.stage(f, cx); }).child("+")
        : div().id(`unstage-${f.path}`).text_size(11).text_color(t.muted).hover((s) => s.text_color(t.foreground)).on_click((_e, cx) => { cx.stop_propagation(); this.unstage(f, cx); }).child("−"));
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
    if (key() !== this.context) this.refresh(cx);
    const t = theme(), index = this.files.filter((f) => f.side === "index"), work = this.files.filter((f) => f.side !== "index");
    const add = this.files.reduce((n, f) => n + f.add, 0), del = this.files.reduce((n, f) => n + f.del, 0);
    const canCommit = Boolean(this.message.trim() && this.root && this.staged && !this.busy && !this.loading);
    return v_flex().id("mide-changes").size_full().min_h(0).rounded(10).overflow_hidden().bg(t.background).border_1().border_color(t.border).text_color(t.foreground).text_size(13).track_focus(this.handle)
      .on_key_down((e, cx) => {
        if (e.key === "escape" && this.typing) { this.typing = false; this.handle.focus(); cx.stop_propagation(); cx.notify(); }
        if (e.key === "escape" && this.view === "branches") { this.view = "changes"; cx.notify(); }
      })
      .child(h_flex().h(42).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border)
        .child(div().font_semibold().child("Changes"))
        .child(div().px(5).py(1).rounded(4).border_1().border_color(t.border).text_size(10).text_color(t.muted).child(`${this.files.length} files`))
        .child(div().flex_1())
        .child(div().text_size(11).text_color(t.ansi2).child(`+${add}`)).child(div().text_size(11).text_color(t.ansi1).child(`−${del}`))
        .child(div().id("mide-branch").h(24).px(8).flex().items_center().gap(6).rounded(7).border_1().border_color(t.border).text_size(11).text_color(this.branch ? t.foreground : t.dim).cursor_pointer().hover((s) => s.border_color(t.input)).on_click((_e, cx) => this.view === "branches" ? (this.view = "changes", cx.notify()) : this.showBranches(cx))
          .child(`⑂ ${this.branch ?? this.root?.split(/[\\/]/).pop() ?? "—"}`)))
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
        .child(div().flex_1().min_h(44).max_h(Math.max(index.length, work.length) * 28 + 96).relative().border_b(1).border_color(t.border)
          .child(v_flex().id("mide-changes-list").absolute().inset_0().overflow_y_scroll().p(6)
            .when(Boolean(index.length), (e) => e.child(this.group("STAGED", index, t)))
            .when(Boolean(index.length && work.length), (e) => e.child(div().h(6).flex_none()))
            .when(Boolean(work.length), (e) => e.child(this.group("CHANGES", work, t,
              [div().id("mide-stage-all").text_size(11).text_color(t.muted).cursor_pointer().hover((s) => s.text_color(t.foreground)).on_click((_e, cx) => this.stageAll(cx)).child("stage all")])))
            .when(!this.files.length, (e) => e.child(div().p(8).text_color(t.dim).child(this.error || (this.loading ? "Loading changes…" : this.root ? "No uncommitted changes" : "No folder")))))
          .child(Scrollbar.vertical("mide-changes-list").absolute().inset_0()))
        .when(this.limited, (e) => e.child(div().px(12).py(4).text_size(11).text_color(t.dim).child("Showing the first 1,000 changed files")))
        .child(div().flex_1().min_h(0).relative().font_family(settings().font_family ?? "JetBrains Mono").text_size(11)
          .child(div().id("mide-changes-diff-x").size_full().overflow_x_scrollbar()
            .child(div().w_full().min_w(this.diffWidth).h_full().child(v_virtual_list("mide-changes-diff", this.rows.length, 20, (i) => String(i),
              (range) => this.rows.slice(range.start, range.end).map((row) => this.diffRow(row, t))).size_full())))
          .child(Scrollbar.vertical("mide-changes-diff").viewport_from_layout().absolute().inset_0())
          .when(!this.open && this.files.length > 0, (e) => e.child(div().absolute().top(6).px(12).text_color(t.dim).child("Select a file to view its changes"))))
        .when(Boolean(this.note), (e) => e.child(div().px(10).pb(8).text_size(11).text_color(t.ansi1).child(this.note)))
        .child(h_flex().flex_none().p(10).gap(8).border_t(1).border_color(t.border)
          .child(div().id("mide-commit-message").flex_1().min_w(0).h(32).px(10).flex().items_center().rounded(8).border_1().border_color(this.typing ? t.accent : t.border).cursor_text().on_mouse_down("left", (_e, cx) => cx.stop_propagation()).child(Input.new(this.input).h_full().text_size(12).text_color(t.foreground)))
          .child(div().id("mide-commit").h(32).px(14).flex().items_center().rounded(8).bg(canCommit ? t.solid : t.raised).text_color(canCommit ? t.solid_foreground : t.dim).text_size(12).when(canCommit, (e) => e.cursor_pointer()).on_click((_e, cx) => this.commit(cx)).child(this.busy ? "Working…" : `Commit ${this.staged || ""}`.trim()))));
  }
}
