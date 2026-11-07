// mIDE Changes — a git panel for the review-and-commit loop: staged,
// tracked and untracked files as separate groups with per-file staging,
// staged and tracked-only commits, and an inline branch switcher.
// Clicking a file opens its diff in the dedicated mIDE Diff tab.
import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input, TextareaState, Textarea, Checkbox, Scrollbar, Popover } from "gpui-base";
import { spaces, panes, focused, exec, watchFolder, theme, setShared, run } from "herdr";
import { gitColors } from "./palette.js";

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
const MATERIAL = "mods/mide-files/icons/material";

function gitStatusColor(status, t) {
  if (status === "A") return t.git_added ?? t.ansi2;
  if (status === "D") return t.git_deleted ?? t.ansi1;
  if (status === "U") return t.git_conflict ?? t.git_modified ?? t.ansi3;
  return t.git_modified ?? t.ansi3;
}

export default class MideChanges extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.view = "changes"; this.files = []; this.staged = 0; this.history = [];
    this.message = ""; this.typing = false; this.branches = []; this.branch = null; this.branchInput = null;
    this.stageMenuOpen = false; this.remoteMenuOpen = false;
    this.ahead = 0; this.behind = 0; this.hasUpstream = false;
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
      this.context = context; this.root = null; this.files = []; this.history = []; this.open = null; this.branch = null;
      this.ahead = 0; this.behind = 0; this.hasUpstream = false;
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
        let ahead = 0, behind = 0, hasUpstream = false;
        const upstream = await git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]);
        if (upstream.code === 0) {
          const tracking = await git(["rev-list", "--left-right", "--count", "HEAD...@{upstream}"]);
          if (tracking.code !== 0) throw new Error(tracking.stderr);
          const counts = tracking.stdout.trim().split(/\s+/).map(Number);
          if (counts.length !== 2 || counts.some((count) => !Number.isFinite(count))) throw new Error("Could not read upstream commit counts");
          [ahead, behind] = counts;
          hasUpstream = true;
        }
        // Keep staged and unstaged line counts separate, as files can appear
        // in both groups when only part of a change is staged.
        const stats = { index: {}, work: {} };
        const statResults = [
          ["index", await git(["diff", "--cached", "--numstat", "-z", "--no-renames"])],
          ["work", await git(["diff", "--numstat", "-z", "--no-renames"])],
        ];
        for (const [side, result] of statResults) {
          if (result.code !== 0) throw new Error(result.stderr);
          for (const entry of result.stdout.split("\0")) {
            const [a, d, ...parts] = entry.split("\t");
            if (!parts.length) continue;
            stats[side][parts.join("\t")] = { add: Number(a) || 0, del: Number(d) || 0, binary: a === "-" };
          }
        }
        const files = [];
        const entries = status.stdout.split("\0").filter(Boolean);
        for (const entry of entries.slice(0, 1000)) {
          const xy = entry.slice(0, 2), path = entry.slice(3);
          const conflict = xy.includes("U") || xy === "AA" || xy === "DD";
          const fresh = xy === "??";
          const staged = !fresh && xy[0] !== " ";
          const unstaged = fresh || xy[1] !== " ";
          const indexStat = stats.index[path] ?? { add: 0, del: 0 };
          const workStat = stats.work[path] ?? { add: 0, del: 0 };
          const statusCode = conflict ? "U" : fresh || xy.includes("A") ? "A" : xy.includes("D") ? "D" : "M";
          files.push({
            path, conflict, fresh, staged, unstaged, status: statusCode,
            add: indexStat.add + workStat.add, del: indexStat.del + workStat.del,
          });
        }
        if (this.currentKey() !== context) return;
        this.root = root; this.on = on; this.branch = branch.code === 0 ? branch.stdout.trim() : null;
        this.ahead = ahead; this.behind = behind; this.hasUpstream = hasUpstream;
        this.files = files; this.staged = files.filter((f) => f.staged).length;
        this.limited = entries.length > 1000; this.error = null;
        this.watch(root, cx);
      } catch (e) { if (this.currentKey() === context) this.error = String(e); }
      finally { this.loading = false; cx.notify(); }
    });
  }

  // Reuse the diff tab so browsing files does not leave a trail of tabs.
  openDiff(file, cx) {
    if (!this.root) return;
    const title = `Diff · ${file.path.split("/").pop()}`;
    const side = file.unstaged || file.fresh ? "work" : "index";
    const request = { root: this.root, path: file.path, side, status: file.status, fresh: file.fresh, on: this.on, branch: this.branch, title };
    this.open = file.path; this.note = null;
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
  unstageAll(cx) { this.git(cx, ["reset", "-q", "HEAD", "--", "."]); }
  primaryStage(cx) {
    if (this.files.some((file) => file.unstaged)) this.stageAll(cx);
    else if (this.staged) this.unstageAll(cx);
  }
  stageGroup(files, stage, cx) {
    const paths = files.map((file) => file.path);
    if (!paths.length) return;
    this.git(cx, stage ? ["add", "--", ...paths] : ["restore", "--staged", "--", ...paths]);
  }
  fetch(cx) { this.git(cx, ["fetch", "--prune"]); }
  pull(cx) { this.git(cx, ["pull"]); }
  push(cx) { this.git(cx, ["push"]); }

  selectTab(view, cx) {
    this.view = view;
    if (view === "history") {
      if (!this.root) {
        this.history = []; this.historyError = "No repository"; this.historyLoading = false; cx.notify(); return;
      }
      if (this.historyLoading) { cx.notify(); return; }
      this.history = []; this.historyError = null; this.historyLoading = true;
      const root = this.root, on = this.on, context = this.context;
      cx.spawn(async (cx) => {
        try {
          const result = await exec("git", [...READ, "log", "-n", "100", "--format=%h%x00%s%x00%an%x00%ar"], { cwd: root, on });
          if (this.currentKey() !== context) return;
          if (result.code !== 0) throw new Error((result.stderr || result.stdout).trim());
          this.history = result.stdout.split("\n").filter(Boolean).map((line) => {
            const [hash, subject, author, age] = line.split("\0");
            return { hash, subject, author, age };
          });
        } catch (e) { if (this.currentKey() === context) this.historyError = String(e); }
        finally { if (this.currentKey() === context) this.historyLoading = false; cx.notify(); }
      });
    }
    cx.notify();
  }

  commit(cx, scope = "auto") {
    const tracked = this.files.some((file) => !file.fresh);
    const stageTracked = scope === "tracked" || (scope === "auto" && !this.staged);
    if (!this.message.trim() || !this.root || this.busy || this.loading || this.context !== this.currentKey()) return;
    if (stageTracked ? !tracked : !this.staged) return;
    const message = this.message.trim();
    const root = this.root, on = this.on, context = this.context;
    this.busy = true; this.note = null;
    cx.spawn(async (cx) => {
      try {
        if (stageTracked) {
          const staged = await exec("git", ["add", "-u"], { cwd: root, on });
          if (staged.code !== 0) throw new Error((staged.stderr || staged.stdout).trim());
        }
        const result = await exec("git", ["commit", "-m", message], { cwd: root, on });
        if (result.code !== 0) throw new Error((result.stderr || result.stdout).trim());
        if (this.currentKey() === context) { this.message = ""; this.input.set_value(""); }
      } catch (e) { if (this.currentKey() === context) this.note = String(e); }
      finally { this.busy = false; this.refresh(cx); cx.notify(); }
    });
    cx.notify();
  }

  showBranches(cx) {
    this.returnView = this.view === "history" ? "history" : "changes";
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
    this.git(cx, ["switch", name], () => {
      this.view = this.returnView ?? "changes";
      if (this.view === "history") this.selectTab("history", cx);
    });
    cx.notify();
  }

  createBranch(cx) {
    const name = this.newBranch.value().trim();
    if (!name) return;
    this.newBranch.set_value("");
    this.git(cx, ["switch", "-c", name], () => {
      this.view = this.returnView ?? "changes";
      if (this.view === "history") this.selectTab("history", cx);
    });
  }

  deleteBranch(name, cx) {
    this.git(cx, ["branch", "-d", name]);
    cx.notify();
  }

  menuItem(id, label, enabled, t, action) {
    return h_flex().id(id).h(28).flex_none().px(9).items_center().rounded(5).text_size(11).text_color(enabled ? t.foreground : t.dim)
      .when(enabled, (e) => e.cursor_pointer().hover((s) => s.bg(t.hover)))
      .on_click((_e, cx) => { cx.stop_propagation(); if (enabled) { this.stageMenuOpen = false; this.remoteMenuOpen = false; action(cx); cx.notify(); } })
      .child(label);
  }

  stageActions(t, label, enabled, action) {
    return h_flex().h(24).flex_none().rounded(6).border_1().border_color(t.border)
      .child(div().id("mide-stage-all").h_full().px(8).flex().items_center().rounded_l(5).text_size(11).text_color(enabled ? t.foreground : t.dim)
        .when(enabled, (e) => e.cursor_pointer().hover((s) => s.bg(t.hover)))
        .on_click((_e, cx) => { if (enabled) action(cx); }).child(label))
      .child(Popover.new("mide-stage-menu").open(this.stageMenuOpen).anchor("top_right")
        .on_open_change((open, cx) => { this.stageMenuOpen = open; cx.notify(); })
        .trigger(div().id("mide-stage-menu-trigger").h_full().w(26).flex().items_center().justify_center().border_l(1).border_color(t.border).text_color(t.muted).accessibility_label("Stage actions").cursor_pointer().child(svg("mods/mide-files/icons/chevron-down.svg").size(11).flex_none()))
        .content(v_flex().min_w(150).p(4).gap(2).rounded(7).border_1().border_color(t.border).bg(t.chrome)
          .child(this.menuItem("mide-menu-stage-all", "Stage All", !this.busy && this.files.some((file) => file.unstaged), t, (cx) => this.stageAll(cx)))
          .child(this.menuItem("mide-menu-unstage-all", "Unstage All", !this.busy && Boolean(this.staged), t, (cx) => this.unstageAll(cx)))))
       .flex_none();
  }

  remoteActions(t) {
    const enabled = Boolean(this.root && !this.busy && !this.loading);
    const action = this.behind ? "pull" : this.ahead ? "push" : "fetch";
    const label = this.busy ? "Working…" : action === "pull" ? "Pull" : action === "push" ? "Push" : "Fetch";
    return h_flex().h(23).flex_none().rounded(6).border_1().border_color(t.border)
      .child(h_flex().id("mide-remote-action").h_full().px(7).gap(4).items_center().rounded_l(5).text_size(10).text_color(enabled ? t.muted : t.dim)
        .when(enabled, (e) => e.cursor_pointer().hover((s) => s.text_color(t.foreground)))
        .on_click((_e, cx) => { if (enabled) this[action](cx); })
        .when(Boolean(this.behind), (e) => e.child(h_flex().gap(2).items_center()
          .child(div().child("↓")).child(div().child(String(this.behind)))))
        .when(Boolean(this.ahead), (e) => e.child(h_flex().gap(2).items_center()
          .child(div().child("↑")).child(div().child(String(this.ahead)))))
        .child(label))
      .child(Popover.new("mide-remote-menu").open(this.remoteMenuOpen).anchor("bottom_right")
        .on_open_change((open, cx) => { this.remoteMenuOpen = open; cx.notify(); })
        .trigger(div().id("mide-remote-menu-trigger").h_full().w(20).flex().items_center().justify_center().border_l(1).border_color(t.border)
          .accessibility_label("Remote actions").cursor_pointer().child(svg("mods/mide-files/icons/chevron-down.svg").size(11).flex_none()))
        .content(v_flex().min_w(130).p(4).gap(2).rounded(7).border_1().border_color(t.border).bg(t.chrome)
          .child(this.menuItem("mide-menu-fetch", "Fetch", enabled, t, (cx) => this.fetch(cx)))
          .child(this.menuItem("mide-menu-pull", "Pull", enabled && this.hasUpstream, t, (cx) => this.pull(cx)))
          .child(this.menuItem("mide-menu-push", "Push", enabled && this.hasUpstream, t, (cx) => this.push(cx)))))
      .flex_none();
  }

  stageCheckbox(id, label, checked, indeterminate, t, onChange) {
    const active = checked || indeterminate;
    return Checkbox.new(id).w(14).h(14).flex_none().disabled(this.busy).checked(checked).indeterminate(indeterminate)
      .accessibility_label(label)
      .on_click((_e, cx) => cx.stop_propagation())
      .on_change(onChange)
      .child(div().size(14).flex().items_center().justify_center().rounded(3).border_1()
        .border_color(active ? t.accent : t.border).bg(checked ? t.accent : t.background)
        .text_size(10).font_semibold().text_color(checked ? t.background : t.accent)
        .child(checked ? "✓" : indeterminate ? "−" : ""));
  }

  fileRow(f, t) {
    const parts = f.path.split("/"), name = parts.pop();
    const selected = this.open === f.path;
    const color = gitStatusColor(f.status, t);
    return h_flex().id(`change-${f.path}`).h(28).flex_none().px(8).gap(8).items_center().rounded(7).cursor_pointer().when(selected, (e) => e.bg(t.selected)).hover((s) => s.bg(t.hover)).on_click((_e, cx) => this.openDiff(f, cx))
      .child(svg(`${MATERIAL}/file.svg`).size(16).flex_none())
      .child(div().w(10).text_size(10).font_semibold().text_color(color).child(f.status))
      .child(h_flex().flex_1().min_w(0).child(div().text_color(t.dim).truncate().child(parts.length ? parts.join("/") + "/" : "")).child(div().max_w(200).min_w(0).truncate().child(name)))
      .when(f.add > 0, (e) => e.child(div().text_size(11).text_color(t.git_added ?? t.ansi2).child(`+${f.add}`))).when(f.del > 0, (e) => e.child(div().text_size(11).text_color(t.git_deleted ?? t.ansi1).child(`−${f.del}`)))
      .child(this.stageCheckbox(`stage-${f.path}`, `${f.staged ? "Unstage" : "Stage"} ${f.path}`, f.staged && !f.unstaged, f.staged && f.unstaged, t,
        (checked, cx) => checked ? this.stage(f, cx) : this.unstage(f, cx)));
  }

  group(label, files, t) {
    const fullyStaged = files.filter((file) => file.staged && !file.unstaged).length;
    const allStaged = fullyStaged === files.length;
    const partlyStaged = files.some((file) => file.staged && file.unstaged) || (fullyStaged > 0 && !allStaged);
    return v_flex().flex_none()
      .child(h_flex().h(24).px(8).gap(6).items_center()
        .child(div().text_size(11).font_semibold().text_color(t.muted).child(label))
        .child(div().text_size(10).text_color(t.dim).child(String(files.length)))
        .child(div().flex_1())
        .child(this.stageCheckbox(`stage-group-${label.toLowerCase()}`, `${allStaged ? "Unstage" : "Stage"} all ${label.toLowerCase()} files`, allStaged, partlyStaged, t,
          (checked, cx) => this.stageGroup(files, checked, cx))))
      .children(files.map((f) => this.fileRow(f, t)));
  }

  branchFooter(t) {
    const repository = this.root?.split(/[\\/]/).pop() ?? "Repository";
    return h_flex().h(30).flex_none().px(10).gap(6).items_center().border_t(1).border_color(t.border)
      .child(svg("mods/mide-files/icons/git-branch.svg").size(12).flex_none().text_color(t.dim))
      .child(div().max_w(110).min_w(0).text_size(10).text_color(t.dim).truncate().child(repository))
      .child(div().text_size(10).text_color(t.dim).child("/"))
      .child(div().id("mide-branch").flex_1().min_w(0).h(23).px(4).flex().items_center().rounded(5).text_size(10).text_color(this.branch ? t.foreground : t.dim).truncate().cursor_pointer().hover((s) => s.bg(t.hover)).on_click((_e, cx) => this.showBranches(cx)).child(this.branch ?? (this.root ? "Detached HEAD" : "—")))
      .child(this.remoteActions(t));
  }

  historyRow(commit, t) {
    return v_flex().id(`history-${commit.hash}`).w_full().h(48).flex_none().px(10).py(5).gap(3).rounded(6).hover((s) => s.bg(t.hover))
      .child(div().w_full().min_w(0).truncate().text_size(13).font_semibold().text_color(t.foreground).child(commit.subject || "(no subject)"))
      .child(h_flex().w_full().min_w(0).items_center().gap(5)
        .child(div().flex_1().min_w(0).truncate().text_size(11).text_color(t.muted).child(commit.author || "Unknown author"))
        .child(div().flex_none().text_size(10).text_color(t.dim).child("•"))
        .child(div().flex_none().text_size(11).text_color(t.muted).child(commit.age || ""))
        .child(div().flex_none().text_size(10).text_color(t.dim).child("•"))
        .child(div().flex_none().text_size(11).text_color(t.muted).child(commit.hash)));
  }

  render(cx) {
    if (this.currentKey() !== this.context) this.refresh(cx);
    const host = theme(), t = { ...host, ...gitColors, background: host.chrome }, tracked = this.files.filter((f) => !f.fresh), untracked = this.files.filter((f) => f.fresh);
    const add = this.files.reduce((n, f) => n + f.add, 0), del = this.files.reduce((n, f) => n + f.del, 0);
    const fileCount = this.files.length;
    const hasTrackedChanges = tracked.length > 0;
    const stageLabel = this.files.some((file) => file.unstaged) ? "Stage All" : "Unstage All";
    return v_flex().id("mide-changes").size_full().min_h(0).rounded(10).overflow_hidden().bg(t.background).border_1().border_color(t.border).text_color(t.foreground).text_size(13).track_focus(this.handle)
      .on_key_down((e, cx) => {
        if (e.key === "escape" && this.typing) { this.typing = false; this.handle.focus(); cx.stop_propagation(); cx.notify(); }
        if (e.key === "escape" && this.view === "branches") { this.view = this.returnView ?? "changes"; cx.notify(); }
      })
      .when(this.view === "branches", (el) => el.child(h_flex().h(36).flex_none().px(10).gap(8).items_center().border_b(1).border_color(t.border)
        .child(div().font_semibold().flex_1().child("Branches"))
        .child(div().id("mide-branch-back").h(24).px(8).flex().items_center().rounded(6).border_1().border_color(t.border).text_size(11).cursor_pointer().hover((s) => s.bg(t.hover)).on_click((_e, cx) => { this.view = this.returnView ?? "changes"; cx.notify(); }).child("Back"))))
      .when(this.view !== "branches", (el) => el.child(h_flex().h(36).flex_none().border_b(1).border_color(t.border)
        .child(div().id("mide-tab-changes").h_full().flex_1().flex().items_center().justify_center().border_b(2).border_color(this.view === "changes" ? t.accent : t.background).text_size(12).text_color(this.view === "changes" ? t.foreground : t.muted).cursor_pointer().hover((s) => s.text_color(t.foreground)).on_click((_e, cx) => { this.view = "changes"; cx.notify(); }).child(`Changes (${fileCount})`))
        .child(div().id("mide-tab-history").h_full().flex_1().flex().items_center().justify_center().border_b(2).border_color(this.view === "history" ? t.accent : t.background).text_size(12).text_color(this.view === "history" ? t.foreground : t.muted).cursor_pointer().hover((s) => s.text_color(t.foreground)).on_click((_e, cx) => this.selectTab("history", cx)).child("History"))))
      .when(this.view === "changes", (el) => el.child(h_flex().h(30).flex_none().px(8).gap(6).items_center().border_b(1).border_color(t.border)
        .child(div().id("mide-view-diff").text_size(11).text_color(this.files.length ? t.muted : t.dim).when(Boolean(this.files.length), (e) => e.cursor_pointer().hover((s) => s.text_color(t.foreground)).on_click((_e, cx) => this.openDiff(this.files[0], cx))).child("View Diff"))
         .child(div().text_size(11).text_color(t.git_added ?? t.ansi2).child(`+${add}`))
         .child(div().text_size(11).text_color(t.git_deleted ?? t.ansi1).child(`−${del}`))
        .child(div().flex_1())
        .child(this.stageActions(t, stageLabel, Boolean(this.files.length && !this.busy), (cx) => this.primaryStage(cx)))))
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
            .when(Boolean(tracked.length), (e) => e.child(this.group("Tracked", tracked, t)))
            .when(Boolean(tracked.length && untracked.length), (e) => e.child(div().h(6).flex_none()))
            .when(Boolean(untracked.length), (e) => e.child(this.group("Untracked", untracked, t)))
            .when(!this.files.length, (e) => e.child(div().p(8).text_color(t.dim).child(this.error || (this.loading ? "Loading changes…" : this.root ? "No uncommitted changes" : "No folder"))))
            .when(this.limited, (e) => e.child(div().p(8).text_size(11).text_color(t.dim).child("Showing the first 1,000 changed files"))))
          .child(Scrollbar.vertical("mide-changes-list").absolute().inset_0()))
        .when(Boolean(this.note), (e) => e.child(div().px(10).pb(8).text_size(11).text_color(t.ansi1).child(this.note))))
      .when(this.view === "history", (el) => el.child(div().flex_1().min_h(0).relative().border_b(1).border_color(t.border)
        .child(v_flex().id("mide-history-list").absolute().inset_0().overflow_y_scroll().p(6)
          .children(this.history.map((commit) => this.historyRow(commit, t)))
          .when(!this.history.length, (e) => e.child(div().p(10).text_size(12).text_color(t.muted).child(this.historyError || (this.historyLoading ? "Loading history…" : "No commits yet")))))
         .child(Scrollbar.vertical("mide-history-list").absolute().inset_0())))
      .when(this.view !== "branches", (el) => el.child(this.branchFooter(t)))
      .when(this.view === "changes", (el) => el.child(v_flex().flex_none().p(8).gap(7)
        .child(div().id("mide-commit-message").h(92).px(8).py(5).rounded(7).bg(host.background).border_1().border_color(this.typing ? t.accent : t.border).cursor_text().on_mouse_down("left", (_e, cx) => cx.stop_propagation()).child(Textarea.new(this.input).size_full().text_size(13).text_color(t.muted)))
         .child(h_flex().h(20).flex_none().items_center()
          .child(div().flex_1().text_size(10).text_color(t.dim).child(this.staged ? `${this.staged} staged` : hasTrackedChanges ? `${tracked.length} tracked changes` : "No changes to commit")))))
      .when(this.view === "branches" && Boolean(this.note), (el) => el.child(div().px(10).pb(8).text_size(11).text_color(t.ansi1).child(this.note)));
  }
}
