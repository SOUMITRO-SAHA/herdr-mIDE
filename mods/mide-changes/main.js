// mIDE Changes — a git panel for the review-and-commit loop: staged,
// tracked and untracked files as separate groups with per-file staging,
// staged and tracked-only commits, and an inline branch switcher.
// Clicking a file opens its diff in a full-size pane beside the editor.
import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input, TextareaState, Textarea, Checkbox, Scrollbar, Popover } from "gpui-base";
import { spaces, panes, focused, exec, watchFolder, theme, settings, setShared, run, notify } from "herdr";
import { gitColors } from "./palette.js";
import { toggleStage } from "./stage-action.js";
import { groupChanges } from "./change-groups.js";
import { friendlyGitError, gitActionLabel } from "./git-errors.js";
import { handleCommitShortcut } from "./commit-shortcut.js";

function location(previous) {
  const f = focused(),
    allSpaces = spaces();
  const space = allSpaces.find(s => s.id === f?.space) ?? allSpaces.find(s => s.active);
  const allPanes = panes(),
    pane = f?.pane ? allPanes.find(p => p.pane === f.pane) : null;
  const tabIds = new Set(space?.tabs.map(tab => tab.id) ?? []);
  const terminals = allPanes.filter(p => tabIds.has(p.tab) && p.terminal && p.cwd);
  const tabTerminal = terminals.find(p => p.tab === f?.tab);
  const on =
    f?.pane === null ? (f.terminal?.includes("/") ? f.terminal.split("/")[0] : null) : (space?.machine ?? null);
  // Mod-only tabs have no cwd. Keep the workspace of the tab that opened
  // them; when a mod is split beside a terminal, prefer that terminal's live
  // folder. A space's initial folder can be stale after terminals move.
  const cwd =
    pane?.cwd ||
    f?.cwd ||
    tabTerminal?.cwd ||
    (pane?.mod && previous?.space === space?.id ? previous.cwd : null) ||
    terminals[0]?.cwd ||
    space?.folder;
  return { cwd, on, space: space?.id, tab: f?.tab };
}
const key = loc => JSON.stringify({ cwd: loc.cwd, on: loc.on, space: loc.space });
// Reads write nothing under .git (no index refresh or lock, no fsmonitor cookie):
// the folder watch would see it, and every refresh would start the next one.
const READ = ["--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "diff.autoRefreshIndex=false"];
const typographySettings = () => {
  const current = settings(),
    uiSize = current.ui_font_size ?? 13;
  return {
    uiFont: current.ui_font_family ?? "Geist",
    uiSize,
    text: base => (base * uiSize) / 13,
    codeFont: current.font_family ?? "JetBrains Mono",
    codeSize: current.font_size ?? 14,
  };
};

function gitStatusColor(status, t) {
  if (status === "A") return t.git_added ?? t.ansi2;
  if (status === "D") return t.git_deleted ?? t.ansi1;
  if (status === "U") return t.git_conflict ?? t.git_modified ?? t.ansi3;
  return t.git_modified ?? t.ansi3;
}

export default class MideChanges extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.view = "changes";
    this.files = [];
    this.staged = 0;
    this.history = [];
    this.message = "";
    this.typing = false;
    this.branches = [];
    this.branch = null;
    this.stageMenuOpen = false;
    this.remoteMenuOpen = false;
    this.branchMenuOpen = false;
    this.ahead = 0;
    this.behind = 0;
    this.hasUpstream = false;
    this.input = TextareaState.new({ placeholder: "Enter commit message", rows: 3 });
    this.input.set_auto_grow(2, 4);
    this.input.on("change", (_e, cx) => {
      const had = Boolean(this.message.trim());
      this.message = this.input.value();
      if (had !== Boolean(this.message.trim())) cx.notify();
    });
    this.input.on("submit", (_e, cx) => this.commit(cx));
    this.input.on("focus", (_e, cx) => {
      this.typing = true;
      cx.notify();
    });
    this.input.on("blur", (_e, cx) => {
      this.typing = false;
      cx.notify();
    });
    this.branchQuery = InputState.new({ placeholder: "Switch or type to create a branch…" });
    this.branchQuery.on("change", (_e, cx) => cx.notify());
    this.branchQuery.on("submit", (_e, cx) => this.createBranch(cx));
    this.refresh(cx);
    cx.timer.every(10000, cx => this.refresh(cx));
  }

  watch(root, cx) {
    if (this.on || this.watched === root) return;
    this.watched = root;
    cx.spawn(async cx => {
      try {
        while (this.watched === root) {
          await watchFolder(root);
          if (this.watched === root) this.refresh(cx);
        }
      } catch {
        this.watched = null;
      }
    });
  }

  currentKey() {
    return key(location(this.location));
  }

  refresh(cx) {
    if (this.loading || this.busy) {
      this.refreshPending = true;
      return;
    }
    this.refreshPending = false;
    const loc = location(this.location),
      { cwd, on } = loc,
      context = key(loc);
    this.location = loc;
    if (context !== this.context) {
      this.context = context;
      this.root = null;
      this.files = [];
      this.history = [];
      this.open = null;
      this.branch = null;
      this.ahead = 0;
      this.behind = 0;
      this.hasUpstream = false;
      this.branchMenuOpen = false;
      this.branches = [];
      this.branchLoading = false;
      this.branchQuery.set_value("");
      this.message = "";
      this.input.set_value("");
      this.error = null;
      this.note = null;
      this.watched = null;
      this.limited = false;
      this.view = "changes";
    }
    if (!cwd) return;
    this.loading = true;
    cx.spawn(async cx => {
      try {
        const top = await exec("git", [...READ, "rev-parse", "--show-toplevel"], { cwd, on });
        if (this.currentKey() !== context) return;
        if (top.code !== 0) {
          this.root = null;
          this.files = [];
          this.open = null;
          this.error = "Not a git repository";
          return;
        }
        const root = top.stdout.trim(),
          git = args => exec("git", [...READ, ...args], { cwd: root, on });
        const branch = await git(["branch", "--show-current"]);
        const status = await git(["status", "--porcelain=v1", "-z", "--no-renames", "--untracked-files=all"]);
        if (status.code !== 0) throw new Error(status.stderr);
        let ahead = 0,
          behind = 0,
          hasUpstream = false;
        const upstream = await git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]);
        if (upstream.code === 0) {
          const tracking = await git(["rev-list", "--left-right", "--count", "HEAD...@{upstream}"]);
          if (tracking.code !== 0) throw new Error(tracking.stderr);
          const counts = tracking.stdout.trim().split(/\s+/).map(Number);
          if (counts.length !== 2 || counts.some(count => !Number.isFinite(count)))
            throw new Error("Could not read upstream commit counts");
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
          const xy = entry.slice(0, 2),
            path = entry.slice(3);
          const conflict = xy.includes("U") || xy === "AA" || xy === "DD";
          const fresh = xy === "??";
          const created = fresh || xy.includes("A");
          const staged = !fresh && xy[0] !== " ";
          const unstaged = fresh || xy[1] !== " ";
          const indexStat = stats.index[path] ?? { add: 0, del: 0 };
          const workStat = stats.work[path] ?? { add: 0, del: 0 };
          const statusCode = conflict ? "U" : fresh || xy.includes("A") ? "A" : xy.includes("D") ? "D" : "M";
          files.push({
            path,
            conflict,
            fresh,
            created,
            staged,
            unstaged,
            status: statusCode,
            add: indexStat.add + workStat.add,
            del: indexStat.del + workStat.del,
          });
        }
        if (this.currentKey() !== context) return;
        this.root = root;
        this.on = on;
        this.branch = branch.code === 0 ? branch.stdout.trim() : null;
        this.ahead = ahead;
        this.behind = behind;
        this.hasUpstream = hasUpstream;
        this.files = files;
        this.staged = files.filter(f => f.staged).length;
        this.limited = entries.length > 1000;
        this.error = null;
        if (this.open && !files.some(file => file.path === this.open)) this.open = null;
        this.watch(root, cx);
      } catch (e) {
        if (this.currentKey() === context) this.error = String(e);
      } finally {
        this.loading = false;
        if (this.refreshPending && !this.busy) this.refresh(cx);
        cx.notify();
      }
    });
  }

  // Open the review diff beside the editor in this tab, reusing its diff pane.
  openDiff(file, cx) {
    if (!this.root) return;
    const focus = focused(),
      tab = focus?.tab;
    const inTab = panes().filter(pane => pane.tab === tab);
    const title = file.path.split("/").pop();
    const request = {
      root: this.root,
      files: [{ ...file }],
      selectedPath: file.path,
      status: file.status,
      fresh: file.fresh,
      on: this.on,
      branch: this.branch,
      title,
      inPane: true,
    };
    this.open = file.path;
    this.note = null;
    setShared("mide.diff.request", request);

    const existing = inTab.find(pane => pane.mod === "mide-diff");
    if (existing) {
      run("mide-diff.open");
    } else {
      const target =
        inTab.find(pane => pane.mod === "mide-editor") ??
        inTab.find(pane => pane.terminal && pane.cwd === this.root) ??
        inTab.find(pane => pane.terminal) ??
        inTab.find(pane => pane.pane === focus?.pane) ??
        inTab[0];
      const direction = inTab.length > 1 ? "down" : "right";
      if (target) run("pane.split", { direction, pane: target.pane, mod: "mide-diff", props: request });
      else this.note = "Could not find a pane to open the diff beside.";
    }
    cx.notify();
  }

  // A failed git action reads as one short line — inline where it was taken
  // and once as an error toast — never as git's raw multiline output.
  fail(context, args, error) {
    if (this.currentKey() !== context) return;
    this.note = friendlyGitError(error);
    notify({ title: `${gitActionLabel(args)} failed`, body: this.note, level: "error" });
  }

  // Stage / unstage one file; stageAll covers the "everything the agent
  // touched" case. Refresh follows from the folder watch, but ping once
  // anyway so the panel answers immediately.
  git(cx, args, then) {
    const root = this.root,
      on = this.on,
      context = this.context;
    this.busy = true;
    this.note = null;
    cx.spawn(async cx => {
      try {
        const r = await exec("git", args, { cwd: root, on });
        if (r.code !== 0) throw new Error((r.stderr || r.stdout).trim());
        if (this.currentKey() === context && then) then();
      } catch (e) {
        this.fail(context, args, e);
      } finally {
        this.busy = false;
        this.refresh(cx);
        cx.notify();
      }
    });
    cx.notify();
  }

  stage(file, cx) {
    this.git(cx, ["add", "--", file.path]);
  }
  unstage(file, cx) {
    this.git(cx, ["restore", "--staged", "--", file.path]);
  }
  stageAll(cx) {
    this.git(cx, ["add", "-A"]);
  }
  unstageAll(cx) {
    this.git(cx, ["reset", "-q", "HEAD", "--", "."]);
  }
  primaryStage(cx) {
    if (this.files.some(file => file.unstaged)) this.stageAll(cx);
    else if (this.staged) this.unstageAll(cx);
  }
  stageGroup(files, stage, cx) {
    const paths = files.map(file => file.path);
    if (!paths.length) return;
    this.git(cx, stage ? ["add", "--", ...paths] : ["restore", "--staged", "--", ...paths]);
  }
  fetch(cx) {
    this.git(cx, ["fetch", "--prune"]);
  }
  pull(cx) {
    this.git(cx, ["pull"]);
  }
  push(cx) {
    this.git(cx, ["push"]);
  }

  selectTab(view, cx) {
    this.view = view;
    if (view === "history") {
      if (!this.root) {
        this.history = [];
        this.historyError = "No repository";
        this.historyLoading = false;
        cx.notify();
        return;
      }
      if (this.historyLoading) {
        cx.notify();
        return;
      }
      this.history = [];
      this.historyError = null;
      this.historyLoading = true;
      const root = this.root,
        on = this.on,
        context = this.context;
      cx.spawn(async cx => {
        try {
          const result = await exec("git", [...READ, "log", "-n", "100", "--format=%h%x00%s%x00%an%x00%ar"], {
            cwd: root,
            on,
          });
          if (this.currentKey() !== context) return;
          if (result.code !== 0) throw new Error((result.stderr || result.stdout).trim());
          this.history = result.stdout
            .split("\n")
            .filter(Boolean)
            .map(line => {
              const [hash, subject, author, age] = line.split("\0");
              return { hash, subject, author, age };
            });
        } catch (e) {
          if (this.currentKey() === context) this.historyError = String(e);
        } finally {
          if (this.currentKey() === context) this.historyLoading = false;
          cx.notify();
        }
      });
    }
    cx.notify();
  }

  commit(cx, scope = "auto") {
    const tracked = this.files.some(file => !file.fresh);
    const stageTracked = scope === "tracked" || (scope === "auto" && !this.staged);
    if (!this.message.trim() || !this.root || this.busy || this.loading || this.context !== this.currentKey()) return;
    if (stageTracked ? !tracked : !this.staged) return;
    const message = this.message.trim();
    const root = this.root,
      on = this.on,
      context = this.context;
    this.busy = true;
    this.note = null;
    cx.spawn(async cx => {
      try {
        if (stageTracked) {
          const staged = await exec("git", ["add", "-u"], { cwd: root, on });
          if (staged.code !== 0) throw new Error((staged.stderr || staged.stdout).trim());
        }
        const result = await exec("git", ["commit", "-m", message], { cwd: root, on });
        if (result.code !== 0) throw new Error((result.stderr || result.stdout).trim());
        if (this.currentKey() === context) {
          this.message = "";
          this.input.set_value("");
        }
      } catch (e) {
        this.fail(context, ["commit"], e);
      } finally {
        this.busy = false;
        this.refresh(cx);
        cx.notify();
      }
    });
    cx.notify();
  }

  loadBranches(cx) {
    if (!this.root || this.branchLoading) return;
    this.branchLoading = true;
    this.branches = [];
    this.branchError = null;
    const root = this.root,
      on = this.on,
      context = this.context;
    cx.spawn(async cx => {
      try {
        const r = await exec("git", [...READ, "branch", "--format=%(refname:short)"], { cwd: root, on });
        if (this.currentKey() !== context) return;
        if (r.code !== 0) throw new Error((r.stderr || r.stdout).trim());
        this.branches = r.stdout
          .split("\n")
          .map(s => s.trim())
          .filter(Boolean)
          .slice(0, 200);
      } catch (e) {
        if (this.currentKey() === context) this.branchError = String(e);
      } finally {
        if (this.currentKey() === context) {
          this.branchLoading = false;
          cx.notify();
        }
      }
    });
    cx.notify();
  }

  switchBranch(name, cx) {
    if (this.busy) return;
    if (name === this.branch) {
      this.branchMenuOpen = false;
      cx.notify();
      return;
    }
    this.git(cx, ["switch", name], () => {
      this.branchMenuOpen = false;
      if (this.view === "history") this.selectTab("history", cx);
    });
    cx.notify();
  }

  createBranch(cx) {
    const name = this.branchQuery.value().trim().replace(/\s+/g, "-");
    if (!name || this.busy) return;
    if (this.branches.includes(name)) {
      this.switchBranch(name, cx);
      return;
    }
    this.git(cx, ["switch", "-c", name], () => {
      this.branchMenuOpen = false;
      this.branchQuery.set_value("");
      if (this.view === "history") this.selectTab("history", cx);
    });
  }

  deleteBranch(name, cx) {
    if (this.busy || name === this.branch) return;
    this.git(cx, ["branch", "-d", name], () => {
      this.branchMenuOpen = false;
    });
  }

  menuItem(id, label, enabled, t, typography, action) {
    return h_flex()
      .id(id)
      .h(28)
      .flex_none()
      .px(9)
      .items_center()
      .rounded(5)
      .text_size(typography.text(11))
      .text_color(enabled ? t.foreground : t.dim)
      .when(enabled, e => e.cursor_pointer().hover(s => s.bg(t.hover)))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        if (enabled) {
          this.stageMenuOpen = false;
          this.remoteMenuOpen = false;
          this.branchMenuOpen = false;
          action(cx);
          cx.notify();
        }
      })
      .child(label);
  }

  noteRow(t, typography, message = this.note) {
    const [summary, ...details] = String(message).split(" — ");
    return div()
      .w_full()
      .min_w(0)
      .flex_none()
      .overflow_hidden()
      .px(8)
      .py(4)
      .text_size(typography.text(11))
      .text_color(t.ansi1)
      .child(
        v_flex()
          .w_full()
          .min_w(0)
          .child(div().w_full().min_w(0).truncate().child(summary))
          .when(Boolean(details.length), e => e.child(div().w_full().min_w(0).truncate().child(details.join(" — ")))),
      );
  }

  branchPicker(t, typography) {
    const query = this.branchQuery.value().trim();
    const normalizedQuery = query.toLowerCase();
    const branches = this.branches.filter(name => name.toLowerCase().includes(normalizedQuery));
    const createName = query.replace(/\s+/g, "-");
    const canCreate = Boolean(createName && !this.branches.includes(createName));
    const enabled = Boolean(this.root && !this.busy);
    const branchListHeight = Math.min(220, Math.max(36, branches.length * 28));
    return v_flex()
      .id("mide-branch-picker")
      .w(260)
      .p(6)
      .gap(5)
      .child(
        v_flex()
          .id("mide-branch-list")
          .h(branchListHeight)
          .flex_none()
          .min_h(0)
          .max_h(220)
          .overflow_y_scrollbar()
          .gap(2)
          .when(this.branchLoading, e =>
            e.child(div().p(8).text_size(typography.text(11)).text_color(t.dim).child("Loading branches…")),
          )
          .children(
            branches.map(name =>
              h_flex()
                .id(`branch-${name}`)
                .h(28)
                .flex_none()
                .px(8)
                .gap(8)
                .items_center()
                .rounded(7)
                .when(name === this.branch, e => e.bg(t.selected))
                .when(enabled, e => e.cursor_pointer().hover(s => s.bg(t.hover)))
                .on_click((_e, cx) => this.switchBranch(name, cx))
                .child(
                  div()
                    .w(12)
                    .text_color(t.accent)
                    .child(name === this.branch ? "✓" : ""),
                )
                .child(div().flex_1().min_w(0).truncate().child(name))
                .when(name === this.branch, e =>
                  e.child(div().text_size(typography.text(10)).text_color(t.dim).child("current")),
                )
                .when(name !== this.branch, e =>
                  e.child(
                    div()
                      .id(`branch-del-${name}`)
                      .text_size(typography.text(10))
                      .text_color(t.muted)
                      .hover(s => s.text_color(t.ansi1))
                      .on_click((_e, cx) => {
                        cx.stop_propagation();
                        this.deleteBranch(name, cx);
                      })
                      .child("delete"),
                  ),
                ),
            ),
          )
          .when(!this.branchLoading && !branches.length, e =>
            e.child(
              div()
                .p(8)
                .text_size(typography.text(11))
                .text_color(t.dim)
                .child(query ? "No matching branches" : this.root ? "No local branches" : "No repository"),
            ),
          ),
      )
      .when(canCreate, e =>
        e.child(
          h_flex()
            .id("mide-branch-create")
            .h(28)
            .flex_none()
            .px(9)
            .items_center()
            .rounded(5)
            .text_size(typography.text(11))
            .text_color(enabled ? t.foreground : t.dim)
            .when(enabled, el => el.cursor_pointer().hover(s => s.bg(t.hover)))
            .on_click((_e, cx) => {
              cx.stop_propagation();
              if (enabled) this.createBranch(cx);
            })
            .child(`Create branch “${createName}”`),
        ),
      )
      .child(
        div()
          .w_full()
          .h(30)
          .px(8)
          .flex()
          .items_center()
          .rounded(6)
          .border_1()
          .border_color(t.border)
          .child(Input.new(this.branchQuery).h_full().text_size(typography.text(12)).text_color(t.foreground)),
      )
      .when(Boolean(this.branchError), e => e.child(this.noteRow(t, typography, this.branchError)))
      .when(Boolean(this.note), e => e.child(this.noteRow(t, typography)));
  }

  stageActions(t, label, enabled, action, typography) {
    return h_flex()
      .h(24)
      .flex_none()
      .rounded(6)
      .border_1()
      .border_color(t.border)
      .child(
        div()
          .id("mide-stage-all")
          .h_full()
          .px(8)
          .flex()
          .items_center()
          .rounded_l(5)
          .text_size(typography.text(11))
          .text_color(enabled ? t.foreground : t.dim)
          .when(enabled, e => e.cursor_pointer().hover(s => s.bg(t.hover)))
          .on_click((_e, cx) => {
            if (enabled) action(cx);
          })
          .child(label),
      )
      .child(
        Popover.new("mide-stage-menu")
          .open(this.stageMenuOpen)
          .anchor("top_right")
          .on_open_change((open, cx) => {
            this.stageMenuOpen = open;
            cx.notify();
          })
          .trigger(
            div()
              .id("mide-stage-menu-trigger")
              .h_full()
              .w(26)
              .flex()
              .items_center()
              .justify_center()
              .border_l(1)
              .border_color(t.border)
              .text_color(t.muted)
              .accessibility_label("Stage actions")
              .cursor_pointer()
              .child(svg("mods/mide-files/icons/chevron-down.svg").size(11).flex_none()),
          )
          .content(
            v_flex()
              .min_w(150)
              .p(4)
              .gap(2)
              .rounded(7)
              .border_1()
              .border_color(t.border)
              .bg(t.chrome)
              .child(
                this.menuItem(
                  "mide-menu-stage-all",
                  "Stage All",
                  !this.busy && this.files.some(file => file.unstaged),
                  t,
                  typography,
                  cx => this.stageAll(cx),
                ),
              )
              .child(
                this.menuItem(
                  "mide-menu-unstage-all",
                  "Unstage All",
                  !this.busy && Boolean(this.staged),
                  t,
                  typography,
                  cx => this.unstageAll(cx),
                ),
              ),
          ),
      )
      .flex_none();
  }

  remoteActions(t, typography) {
    const enabled = Boolean(this.root && !this.busy && !this.loading);
    const action = this.behind ? "pull" : this.ahead ? "push" : "fetch";
    const label = this.busy ? "Working…" : action === "pull" ? "Pull" : action === "push" ? "Push" : "Fetch";
    return h_flex()
      .h(23)
      .flex_none()
      .rounded(6)
      .border_1()
      .border_color(t.border)
      .child(
        h_flex()
          .id("mide-remote-action")
          .h_full()
          .px(7)
          .gap(4)
          .items_center()
          .rounded_l(5)
          .text_size(typography.text(10))
          .text_color(enabled ? t.muted : t.dim)
          .when(enabled, e => e.cursor_pointer().hover(s => s.text_color(t.foreground)))
          .on_click((_e, cx) => {
            if (enabled) this[action](cx);
          })
          .when(Boolean(this.behind), e =>
            e.child(
              h_flex()
                .gap(2)
                .items_center()
                .child(div().child("↓"))
                .child(div().child(String(this.behind))),
            ),
          )
          .when(Boolean(this.ahead), e =>
            e.child(
              h_flex()
                .gap(2)
                .items_center()
                .child(div().child("↑"))
                .child(div().child(String(this.ahead))),
            ),
          )
          .child(label),
      )
      .child(
        Popover.new("mide-remote-menu")
          .open(this.remoteMenuOpen)
          .anchor("bottom_right")
          .on_open_change((open, cx) => {
            this.remoteMenuOpen = open;
            cx.notify();
          })
          .trigger(
            div()
              .id("mide-remote-menu-trigger")
              .h_full()
              .w(20)
              .flex()
              .items_center()
              .justify_center()
              .border_l(1)
              .border_color(t.border)
              .accessibility_label("Remote actions")
              .cursor_pointer()
              .child(svg("mods/mide-files/icons/chevron-down.svg").size(11).flex_none()),
          )
          .content(
            v_flex()
              .min_w(130)
              .p(4)
              .gap(2)
              .rounded(7)
              .border_1()
              .border_color(t.border)
              .bg(t.chrome)
              .child(this.menuItem("mide-menu-fetch", "Fetch", enabled, t, typography, cx => this.fetch(cx)))
              .child(
                this.menuItem("mide-menu-pull", "Pull", enabled && this.hasUpstream, t, typography, cx =>
                  this.pull(cx),
                ),
              )
              .child(
                this.menuItem("mide-menu-push", "Push", enabled && this.hasUpstream, t, typography, cx =>
                  this.push(cx),
                ),
              ),
          ),
      )
      .flex_none();
  }

  stageCheckbox(id, label, checked, indeterminate, t, typography, onChange) {
    const active = checked || indeterminate;
    return Checkbox.new(id)
      .w(14)
      .h(14)
      .flex_none()
      .disabled(this.busy)
      .checked(checked)
      .indeterminate(indeterminate)
      .accessibility_label(label)
      .on_click((_e, cx) => cx.stop_propagation())
      .on_change(onChange)
      .child(
        div()
          .size(14)
          .flex()
          .items_center()
          .justify_center()
          .rounded(3)
          .border_1()
          .border_color(active ? t.accent : t.border)
          .bg(checked ? t.accent : t.background)
          .text_size(typography.text(10))
          .font_semibold()
          .text_color(checked ? t.background : t.accent)
          .child(checked ? "✓" : indeterminate ? "−" : ""),
      );
  }

  fileRow(f, t, typography) {
    const parts = f.path.split("/"),
      name = parts.pop(),
      directory = parts.join("/");
    const selected = this.open === f.path;
    const color = gitStatusColor(f.status, t);
    return h_flex()
      .id(`change-${f.path}`)
      .h(28)
      .flex_none()
      .px(8)
      .gap(8)
      .items_center()
      .rounded(7)
      .when(selected, e => e.bg(t.selected))
      .hover(s => s.bg(t.hover))
      .child(
        h_flex()
          .id(`change-content-${f.path}`)
          .flex_1()
          .min_w(0)
          .h_full()
          .gap(8)
          .items_center()
          .cursor_pointer()
          .on_click((_e, cx) => this.openDiff(f, cx))
          .child(div().w(10).text_size(typography.text(10)).font_semibold().text_color(color).child(f.status))
          .child(
            h_flex()
              .flex_1()
              .min_w(0)
              .overflow_hidden()
              .child(
                div()
                  .max_w(200)
                  .min_w(0)
                  .flex_none()
                  .truncate()
                  .child(name + (directory ? " " : "")),
              )
              .when(Boolean(directory), e =>
                e.child(div().flex_1().min_w(0).text_color(t.dim).text_ellipsis_start().child(directory)),
              ),
          )
          .when(f.add > 0, e =>
            e.child(
              div()
                .text_size(typography.text(11))
                .text_color(t.git_added ?? t.ansi2)
                .child(`+${f.add}`),
            ),
          )
          .when(f.del > 0, e =>
            e.child(
              div()
                .text_size(typography.text(11))
                .text_color(t.git_deleted ?? t.ansi1)
                .child(`−${f.del}`),
            ),
          ),
      )
      .child(
        this.stageCheckbox(
          `stage-${f.path}`,
          `${f.staged ? "Unstage" : "Stage"} ${f.path}`,
          f.staged && !f.unstaged,
          f.staged && f.unstaged,
          t,
          typography,
          (checked, cx) => toggleStage(f, checked, cx, this),
        ),
      );
  }

  group(label, files, t, typography) {
    const fullyStaged = files.filter(file => file.staged && !file.unstaged).length;
    const allStaged = fullyStaged === files.length;
    const partlyStaged = files.some(file => file.staged && file.unstaged) || (fullyStaged > 0 && !allStaged);
    return v_flex()
      .flex_none()
      .child(
        h_flex()
          .h(24)
          .px(8)
          .gap(6)
          .items_center()
          .child(div().text_size(typography.text(11)).font_semibold().text_color(t.muted).child(label))
          .child(div().text_size(typography.text(10)).text_color(t.dim).child(String(files.length)))
          .child(div().flex_1())
          .child(
            this.stageCheckbox(
              `stage-group-${label.toLowerCase()}`,
              `${allStaged ? "Unstage" : "Stage"} all ${label.toLowerCase()} files`,
              allStaged,
              partlyStaged,
              t,
              typography,
              (checked, cx) => this.stageGroup(files, checked, cx),
            ),
          ),
      )
      .children(files.map(f => this.fileRow(f, t, typography)));
  }

  branchFooter(t, typography) {
    const repository = this.root?.split(/[\\/]/).pop() ?? "Repository";
    return h_flex()
      .h(30)
      .flex_none()
      .px(10)
      .gap(6)
      .items_center()
      .justify_between()
      .border_t(1)
      .border_color(t.border)
      .child(
        h_flex()
          .flex_1()
          .min_w(0)
          .overflow_hidden()
          .gap(6)
          .items_center()
          .child(svg("mods/mide-files/icons/git-branch.svg").size(12).flex_none().text_color(t.dim))
          .child(div().min_w(0).text_size(typography.text(10)).text_color(t.dim).truncate().child(repository))
          .child(div().flex_none().text_size(typography.text(10)).text_color(t.dim).child("/"))
          .child(
            Popover.new("mide-branch-picker-menu")
              .open(this.branchMenuOpen)
              .anchor("bottom_left")
              .on_open_change((open, cx) => {
                this.branchMenuOpen = open;
                if (open) {
                  this.note = null;
                  this.branchQuery.set_value("");
                  this.branchQuery.focus();
                  this.loadBranches(cx);
                }
                cx.notify();
              })
              .trigger(
                div()
                  .id("mide-branch")
                  .min_w(0)
                  .h(23)
                  .px(4)
                  .flex()
                  .items_center()
                  .overflow_hidden()
                  .rounded(5)
                  .text_size(typography.text(10))
                  .text_color(this.branch ? t.foreground : t.dim)
                  .cursor_pointer()
                  .hover(s => s.bg(t.hover))
                  .accessibility_label(`Switch branch${this.branch ? `, current ${this.branch}` : ""}`)
                  .child(
                    div()
                      .min_w(0)
                      .truncate()
                      .child(this.branch ?? (this.root ? "Detached HEAD" : "—")),
                  ),
              )
              .content(this.branchPicker(t, typography)),
          ),
      )
      .child(this.remoteActions(t, typography));
  }

  historyRow(commit, t, typography) {
    return v_flex()
      .id(`history-${commit.hash}`)
      .w_full()
      .h(48)
      .flex_none()
      .px(10)
      .py(5)
      .gap(3)
      .rounded(6)
      .hover(s => s.bg(t.hover))
      .child(
        div()
          .w_full()
          .min_w(0)
          .truncate()
          .text_size(typography.text(13))
          .font_semibold()
          .text_color(t.foreground)
          .child(commit.subject || "(no subject)"),
      )
      .child(
        h_flex()
          .w_full()
          .min_w(0)
          .items_center()
          .gap(5)
          .child(
            div()
              .flex_1()
              .min_w(0)
              .truncate()
              .text_size(typography.text(11))
              .text_color(t.muted)
              .child(commit.author || "Unknown author"),
          )
          .child(div().flex_none().text_size(typography.text(10)).text_color(t.dim).child("•"))
          .child(
            div()
              .flex_none()
              .text_size(typography.text(11))
              .text_color(t.muted)
              .child(commit.age || ""),
          )
          .child(div().flex_none().text_size(typography.text(10)).text_color(t.dim).child("•"))
          .child(div().flex_none().text_size(typography.text(11)).text_color(t.muted).child(commit.hash)),
      );
  }

  render(cx) {
    if (this.currentKey() !== this.context) this.refresh(cx);
    const host = theme(),
      t = { ...host, ...gitColors, background: host.chrome },
      typography = typographySettings(),
      { tracked, untracked } = groupChanges(this.files);
    const add = this.files.reduce((n, f) => n + f.add, 0),
      del = this.files.reduce((n, f) => n + f.del, 0);
    const fileCount = this.files.length;
    const hasTrackedChanges = tracked.length > 0;
    const stageLabel = this.files.some(file => file.unstaged) ? "Stage All" : "Unstage All";
    return v_flex()
      .id("mide-changes")
      .size_full()
      .min_h(0)
      .rounded(10)
      .overflow_hidden()
      .bg(t.background)
      .border_1()
      .border_color(t.border)
      .text_color(t.foreground)
      .font_family(typography.uiFont)
      .text_size(typography.uiSize)
      .track_focus(this.handle)
      .on_key_down((e, cx) => {
        if (handleCommitShortcut(e, cx, this)) return;
        if (e.key === "escape" && this.typing) {
          this.typing = false;
          this.handle.focus();
          cx.stop_propagation();
          cx.notify();
        }
      })
      .child(
        h_flex()
          .h(36)
          .flex_none()
          .border_b(1)
          .border_color(t.border)
          .child(
            div()
              .id("mide-tab-changes")
              .h_full()
              .flex_1()
              .flex()
              .items_center()
              .justify_center()
              .border_b(2)
              .border_color(this.view === "changes" ? t.accent : t.background)
              .text_size(typography.text(12))
              .text_color(this.view === "changes" ? t.foreground : t.muted)
              .cursor_pointer()
              .hover(s => s.text_color(t.foreground))
              .on_click((_e, cx) => {
                this.view = "changes";
                cx.notify();
              })
              .child(`Changes (${fileCount})`),
          )
          .child(
            div()
              .id("mide-tab-history")
              .h_full()
              .flex_1()
              .flex()
              .items_center()
              .justify_center()
              .border_b(2)
              .border_color(this.view === "history" ? t.accent : t.background)
              .text_size(typography.text(12))
              .text_color(this.view === "history" ? t.foreground : t.muted)
              .cursor_pointer()
              .hover(s => s.text_color(t.foreground))
              .on_click((_e, cx) => this.selectTab("history", cx))
              .child("History"),
          ),
      )
      .when(this.view === "changes", el =>
        el.child(
          h_flex()
            .h(30)
            .flex_none()
            .px(8)
            .gap(6)
            .items_center()
            .border_b(1)
            .border_color(t.border)
            .child(
              div()
                .id("mide-view-diff")
                .text_size(typography.text(11))
                .text_color(this.files.length ? t.muted : t.dim)
                .when(Boolean(this.files.length), e =>
                  e
                    .cursor_pointer()
                    .hover(s => s.text_color(t.foreground))
                    .on_click((_e, cx) => this.openDiff(this.files[0], cx)),
                )
                .child("View Diff"),
            )
            .child(
              div()
                .text_size(typography.text(11))
                .text_color(t.git_added ?? t.ansi2)
                .child(`+${add}`),
            )
            .child(
              div()
                .text_size(typography.text(11))
                .text_color(t.git_deleted ?? t.ansi1)
                .child(`−${del}`),
            )
            .child(div().flex_1())
            .child(
              this.stageActions(
                t,
                stageLabel,
                Boolean(this.files.length && !this.busy),
                cx => this.primaryStage(cx),
                typography,
              ),
            ),
        ),
      )
      .when(this.view === "changes", el =>
        el
          .child(
            div()
              .flex_1()
              .min_h(0)
              .relative()
              .border_b(1)
              .border_color(t.border)
              .child(
                v_flex()
                  .id("mide-changes-list")
                  .absolute()
                  .inset_0()
                  .overflow_y_scroll()
                  .p(6)
                  .when(Boolean(tracked.length), item => item.child(this.group("Tracked", tracked, t, typography)))
                  .when(Boolean(tracked.length && untracked.length), item => item.child(div().h(6).flex_none()))
                  .when(Boolean(untracked.length), item =>
                    item.child(this.group("Untracked", untracked, t, typography)),
                  )
                  .when(!this.files.length, item =>
                    item.child(
                      div()
                        .p(8)
                        .text_color(t.dim)
                        .child(
                          this.error ||
                            (this.loading ? "Loading changes…" : this.root ? "No uncommitted changes" : "No folder"),
                        ),
                    ),
                  )
                  .when(this.limited, item =>
                    item.child(
                      div()
                        .p(8)
                        .text_size(typography.text(11))
                        .text_color(t.dim)
                        .child("Showing the first 1,000 changed files"),
                    ),
                  ),
              )
              .child(Scrollbar.vertical("mide-changes-list").absolute().inset_0()),
          )
          .when(Boolean(this.note) && !this.branchMenuOpen, e => e.child(this.noteRow(t, typography))),
      )
      .when(this.view === "history", el =>
        el.child(
          div()
            .flex_1()
            .min_h(0)
            .relative()
            .border_b(1)
            .border_color(t.border)
            .child(
              v_flex()
                .id("mide-history-list")
                .absolute()
                .inset_0()
                .overflow_y_scroll()
                .p(6)
                .children(this.history.map(commit => this.historyRow(commit, t, typography)))
                .when(!this.history.length, e =>
                  e.child(
                    div()
                      .p(10)
                      .text_size(typography.text(12))
                      .text_color(t.muted)
                      .child(this.historyError || (this.historyLoading ? "Loading history…" : "No commits yet")),
                  ),
                ),
            )
            .child(Scrollbar.vertical("mide-history-list").absolute().inset_0()),
        ),
      )
      .child(this.branchFooter(t, typography))
      .when(this.view === "changes", el =>
        el.child(
          v_flex()
            .flex_none()
            .p(8)
            .gap(7)
            .child(
              div()
                .id("mide-commit-message")
                .h(92)
                .px(8)
                .py(5)
                .rounded(7)
                .bg(host.background)
                .border_1()
                .border_color(this.typing ? t.accent : t.border)
                .cursor_text()
                .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
                .child(Textarea.new(this.input).size_full().text_size(typography.uiSize).text_color(t.muted)),
            )
            .child(
              h_flex()
                .h(20)
                .flex_none()
                .items_center()
                .child(
                  div()
                    .flex_1()
                    .text_size(typography.text(10))
                    .text_color(t.dim)
                    .child(
                      this.staged
                        ? `${this.staged} staged`
                        : hasTrackedChanges
                          ? `${tracked.length} tracked changes`
                          : "No changes to commit",
                    ),
                ),
            ),
        ),
      )
      .when(this.view === "history" && Boolean(this.note) && !this.branchMenuOpen, el =>
        el.child(this.noteRow(t, typography)),
      );
  }
}
