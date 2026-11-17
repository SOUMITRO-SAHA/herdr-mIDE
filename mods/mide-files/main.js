// mIDE Files — a file manager for the focused pane's folder with file-type
// icons and git status colors on the tree. Clicking a file opens it in the
// mIDE editor pane.
//
// Folder listing adapts Herdr's shipped `files` mod (Apache-2.0):
// same sh/PowerShell helpers, same lazy expansion, same bounded reads.
import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { readdir } from "fs/promises";
import { spaces, panes, focused, exec, watchFolder, theme, settings, setShared, run, window } from "herdr";
import { props, nextCommand, shared, openOverlay, closeOverlay, notify, writeTextFile, keys } from "herdr";
import { resolveIcon } from "./icons.js";
import { gitColors } from "./palette.js";
import {
  contextMenuActions,
  creationFolder,
  createAbsolutePath,
  createShellCommands,
  revealCommand,
  shortcutHint,
  utf16leBase64,
  validateCreateName,
} from "./file-actions.js";

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
// Git reports repository paths with forward slashes; a Windows space cwd
// arrives with backslashes. Marks and the tree's lookups must agree on one
// separator form on every platform.
const slash = p => String(p).replace(/\\/g, "/");
const PER_FOLDER = 500,
  TOTAL = 5000;

// the reference IDE's label precedence combines index and worktree: conflicts, deletions,
// modifications, then additions (including untracked files).
function statusMark(xy) {
  if (["DD", "AU", "UD", "UA", "DU", "AA", "UU"].includes(xy)) return "U";
  if (xy.includes("D")) return "D";
  if (xy.includes("M") || xy.includes("T")) return "M";
  return xy === "??" || xy.includes("A") ? "A" : "M";
}

const ICONS = "mods/mide-files/icons";
const MATERIAL = "mods/mide-files/icons/material";
const FILE_ACTION_REQUEST = "mide.files.action.request";
const interfaceTypography = () => {
  const current = settings(),
    size = current.ui_font_size ?? 13;
  return { font: current.ui_font_family ?? "Geist", size, text: base => (base * size) / 13 };
};

// Material Icon Theme icons, full-color SVGs; icons.js owns the mapping
// and its resolution order (exact name, then longest dotted suffix, then
// prefix, then the theme's plain file glyph).
async function directory(path, on) {
  const windowsDirectory = async () => {
    // Windows argv transport mangles arguments containing spaces or quotes,
    // so the whole listing travels as one -EncodedCommand payload with the
    // folder path embedded in it; nothing quoting-sensitive stays in argv.
    const script =
      "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); " +
      "& { @(Get-ChildItem -LiteralPath '" +
      path.replace(/['‘’‚‛]/g, "$&$&") +
      "' -Force -ErrorAction Stop " +
      "| Where-Object { $_.Name -ne '.git' -and $_.Name -ne '.DS_Store' } " +
      "| Select-Object -First 501 " +
      "| ForEach-Object { @{ name=$_.Name; dir=($_.PSIsContainer -and (-not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -or -not $_.LinkType -or ($_.Target -and [IO.Directory]::Exists(([IO.Path]::Combine([IO.Path]::GetDirectoryName($_.FullName), $_.Target[0])))))) } }) " +
      "| ConvertTo-Json -Compress }";
    const encoded = utf16leBase64(script);
    const r = await exec("powershell", ["-NoProfile", "-EncodedCommand", encoded], { on });
    if (r.code !== 0) throw new Error(r.stderr || "Cannot list this folder");
    const result = JSON.parse(r.stdout || "[]");
    return Array.isArray(result) ? result : [result];
  };
  if (!on) {
    // Local listings run in-process through Herdr's fs API: one PowerShell
    // spawn costs seconds on Windows (Defender + .NET startup) and that
    // dominated every refresh. The app grants fs reads inside the home
    // folder only (read_roots([home()]) in its mods policy, every platform
    // alike); a project outside it — another mounted volume on macOS or
    // Linux, another drive on Windows — is refused. Those keep the transports
    // this helper always used, chosen by platform as before: PowerShell on
    // Windows (the argv transport mangles space- or quote-containing paths,
    // so the path travels encoded — and stock Windows has no sh), sh on
    // macOS and Linux. loadFolder sorts and caps exactly as it did for
    // shell output.
    try {
      const entries = await readdir(path, { withFileTypes: true });
      return entries
        .filter(entry => entry.name !== ".git" && entry.name !== ".DS_Store")
        .slice(0, 501)
        .map(entry => ({ name: entry.name, dir: entry.isDirectory() }));
    } catch (error) {
      if (!String(error).includes("outside every granted read root")) throw error;
      if (window().platform === "windows") return windowsDirectory();
    }
  }
  const script =
    'n=0; for p in "$1"/* "$1"/.[!.]* "$1"/..?*; do [ -e "$p" ] || [ -L "$p" ] || continue; name=${p##*/}; case "$name" in .git|.DS_Store) continue;; esac; if [ -d "$p" ]; then kind=d; else kind=f; fi; printf "%s\\0%s\\0" "$kind" "$name"; n=$((n+1)); [ "$n" -gt 500 ] && break; done; test -d "$1"';
  let r;
  try {
    r = await exec("sh", ["-c", script, "mide-files", path], { on });
  } catch (e) {
    if (on && String(e).includes("cannot start sh: program not found")) return windowsDirectory();
    throw e;
  }
  if (r.code !== 0) throw new Error(r.stderr || "Cannot list this folder");
  const fields = r.stdout.split("\0"),
    out = [];
  for (let i = 0; i + 1 < fields.length; i += 2) out.push({ name: fields[i + 1], dir: fields[i] === "d" });
  return out;
}

export default class MideFiles extends View {
  init(_props, cx) {
    const initial = props();
    if (initial?.contextMenu) {
      this.contextMenu = { ...initial.contextMenu, overlay: initial.overlay };
      return;
    }
    this.saved = new Map();
    this.entries = new Map();
    this.folders = new Set();
    this.pending = new Set();
    this.marks = {};
    this.folderMarks = new Map();
    this.ignored = new Set();
    this.ignoredDirs = [];
    this.selected = null;
    this.pendingCreate = null;
    this.createInput = null;
    this.createNote = null;
    this.createBusy = false;
    this.listenCommands(cx);
    this.refresh(cx);
    cx.timer.every(10000, cx => this.refresh(cx));
  }

  listenCommands(cx) {
    cx.spawn(async cx => {
      for (;;) {
        const command = await nextCommand(),
          name = typeof command === "string" ? command : command?.name;
        if (
          !["new-file", "new-folder", "open", "toggle", "reveal", "copy-absolute-path", "copy-relative-path"].includes(
            name,
          )
        )
          continue;
        const request = shared(FILE_ACTION_REQUEST),
          fromMenu =
            request?.action === name &&
            request.space === this.context?.space &&
            slash(request.root) === slash(this.root);
        if (fromMenu) {
          setShared(FILE_ACTION_REQUEST, null);
          this.selected = { path: request.path, rowKind: request.rowKind };
        }
        if (name === "new-file" || name === "new-folder") {
          this.startCreate(name === "new-file" ? "file" : "folder", cx);
        } else if (["reveal", "copy-absolute-path", "copy-relative-path"].includes(name)) {
          this.runSelectedAction(name, cx);
        } else {
          if (!fromMenu) continue;
          if (name === "open") this.open(request.path, cx);
          else this.toggle(request.path, cx);
        }
      }
    });
  }

  showContextMenu(row, at) {
    if (!this.root) return;
    this.selected = { path: row.path, rowKind: row.rowKind };
    const actions = contextMenuActions({ rowKind: row.rowKind, remote: Boolean(this.on) }),
      height = actions.length * 34 + 8;
    this.menuOverlay = openOverlay({
      mod: "mide-files",
      props: {
        contextMenu: {
          ...row,
          root: this.root,
          on: this.on,
          space: this.context?.space,
          platform: window().platform,
        },
      },
      kind: "popup",
      width: 244,
      height,
      at,
    });
  }

  dispatchMenuAction(action, cx) {
    const menu = this.contextMenu,
      absolute = createAbsolutePath(menu.root, "", menu.path),
      name = menu.path.split("/").pop();
    if (action === "copy-absolute-path") {
      cx.write_to_clipboard(absolute);
      closeOverlay(menu.overlay);
      return;
    }
    if (action === "copy-relative-path") {
      cx.write_to_clipboard(menu.path);
      closeOverlay(menu.overlay);
      return;
    }
    if (action === "copy-name") {
      cx.write_to_clipboard(name);
      closeOverlay(menu.overlay);
      return;
    }
    if (action === "open-in-new-tab") {
      closeOverlay(menu.overlay);
      try {
        run("tab.new", { ...(menu.space ? { space: menu.space } : {}), folder: absolute });
      } catch (error) {
        notify({ title: "Couldn't open folder in a new tab", body: String(error), level: "error" });
      }
      return;
    }
    if (action === "reveal") {
      const command = revealCommand(menu.platform, absolute, menu.rowKind);
      closeOverlay(menu.overlay);
      cx.spawn(async () => {
        try {
          const result = await exec(command.program, command.args);
          if (result.code !== 0)
            notify({
              title: "Couldn't reveal this item",
              body: result.stderr || "The file manager returned an error",
              level: "error",
            });
        } catch (error) {
          notify({ title: "Couldn't reveal this item", body: String(error), level: "error" });
        }
      });
      return;
    }
    const targetAction = action === "open" && menu.rowKind === "folder" ? "toggle" : action;
    setShared(FILE_ACTION_REQUEST, {
      action: targetAction,
      path: menu.path,
      rowKind: menu.rowKind,
      root: menu.root,
      space: menu.space,
    });
    closeOverlay(menu.overlay);
    run(`mide-files.${targetAction}`);
  }

  runSelectedAction(action, cx) {
    const selected = this.selected;
    if (!this.root || !selected || selected.rowKind === "root") return;
    if (action === "copy-absolute-path") {
      cx.write_to_clipboard(createAbsolutePath(this.root, "", selected.path));
      if (this.menuOverlay) closeOverlay(this.menuOverlay);
      this.menuOverlay = null;
      return;
    }
    if (action === "copy-relative-path") {
      cx.write_to_clipboard(selected.path);
      if (this.menuOverlay) closeOverlay(this.menuOverlay);
      this.menuOverlay = null;
      return;
    }
    if (action === "reveal") {
      if (this.on) return;
      const command = revealCommand(
        window().platform,
        createAbsolutePath(this.root, "", selected.path),
        selected.rowKind,
      );
      if (this.menuOverlay) closeOverlay(this.menuOverlay);
      this.menuOverlay = null;
      cx.spawn(async () => {
        try {
          const result = await exec(command.program, command.args);
          if (result.code !== 0)
            notify({
              title: "Couldn't reveal this item",
              body: result.stderr || "The file manager returned an error",
              level: "error",
            });
        } catch (error) {
          notify({ title: "Couldn't reveal this item", body: String(error), level: "error" });
        }
      });
    }
  }

  renderContextMenu(typography) {
    const menu = this.contextMenu,
      t = { ...theme(), ...gitColors },
      actions = contextMenuActions({ rowKind: menu.rowKind, remote: Boolean(menu.on) }),
      labels = {
        open: "Open",
        "new-file": "New File",
        "new-folder": "New Folder",
        reveal:
          menu.platform === "macos"
            ? "Reveal in Finder"
            : menu.platform === "windows"
              ? "Show in Explorer"
              : "Reveal in File Manager",
        "copy-absolute-path": "Copy Absolute Path",
        "copy-relative-path": "Copy Relative Path",
        "copy-name": "Copy Name",
        "open-in-new-tab": "Open in New Tab",
      },
      bindings = keys(),
      hint = {
        "new-file": shortcutHint(bindings, "new-file", menu.platform),
        "new-folder": shortcutHint(bindings, "new-folder", menu.platform),
        reveal: shortcutHint(bindings, "reveal", menu.platform),
        "copy-absolute-path": shortcutHint(bindings, "copy-absolute-path", menu.platform),
        "copy-relative-path": shortcutHint(bindings, "copy-relative-path", menu.platform),
      };
    const children = [];
    for (const action of actions) {
      if (action === "reveal" || action === "copy-absolute-path" || action === "open-in-new-tab")
        children.push(div().h(1).my(2).bg(t.border));
      children.push(
        h_flex()
          .id(`mide-files-menu-${action}`)
          .h(28)
          .px(8)
          .gap(12)
          .items_center()
          .justify_between()
          .rounded(5)
          .cursor_pointer()
          .hover(s => s.bg(t.hover))
          .on_click((_event, cx) => this.dispatchMenuAction(action, cx))
          .child(div().flex_1().min_w(0).child(labels[action]))
          .when(Boolean(hint[action]), el =>
            el.child(div().text_size(typography.text(10)).text_color(t.dim).child(hint[action])),
          ),
      );
    }
    return v_flex()
      .id("mide-files-context-menu")
      .min_w(220)
      .p(4)
      .gap(2)
      .rounded(7)
      .border_1()
      .border_color(t.border)
      .bg(t.chrome)
      .text_color(t.foreground)
      .font_family(typography.font)
      .text_size(typography.size)
      .children(children);
  }

  startCreate(kind, cx) {
    if (!this.root) {
      notify({ title: "No folder open", body: "Open a workspace folder before creating files.", level: "error" });
      return;
    }
    if (this.createBusy) return;
    if (this.pendingCreate) this.cancelCreate(cx);
    const selection = this.selected ?? { path: "", rowKind: "root" },
      folder = creationFolder(selection.path, selection.rowKind);
    this.pendingCreate = { kind, folder };
    this.createNote = null;
    this.createBusy = false;
    this.createInput = InputState.new({ placeholder: kind === "file" ? "New file name" : "New folder name" });
    this.createInput.on("change", (_event, cx) => {
      this.createNote = null;
      cx.notify();
    });
    this.createInput.on("submit", (_event, cx) => this.commitCreate(cx));
    this.createInput.on("blur", (_event, cx) => {
      if (this.pendingCreate && !this.createBusy) this.commitCreate(cx);
    });
    this.createInput.focus();
    if (folder && !this.folders.has(folder)) this.toggle(folder, cx);
    cx.notify();
  }

  cancelCreate(cx) {
    if (this.createBusy) return;
    this.createInput?.release();
    this.pendingCreate = null;
    this.createInput = null;
    this.createNote = null;
    this.createBusy = false;
    cx.notify();
  }

  async createWithShell(path, kind, on) {
    const commands = createShellCommands(path, kind);
    let command;
    if (on) {
      try {
        command = commands.posix;
        const result = await exec(command.program, command.args, { on });
        if (result.code !== 0) throw new Error(result.stderr || "The create command failed");
        return;
      } catch (error) {
        if (!String(error).includes("cannot start sh: program not found")) throw error;
        command = commands.windows;
      }
    } else command = window().platform === "windows" ? commands.windows : commands.posix;
    const result = await exec(command.program, command.args, { on });
    if (result.code !== 0) throw new Error(result.stderr || "The create command failed");
  }

  commitCreate(cx) {
    if (!this.pendingCreate || !this.createInput || this.createBusy) return;
    const { kind, folder } = this.pendingCreate,
      name = this.createInput.value(),
      existing = (this.entries.get(folder) ?? []).map(entry => entry.name),
      caseSensitive = !this.on && window().platform === "linux",
      error = validateCreateName(name, existing, caseSensitive);
    if (error) {
      this.createNote = error;
      this.createInput.focus();
      cx.notify();
      return;
    }
    const path = createAbsolutePath(this.root, folder, name),
      relative = folder ? `${folder}/${name}` : name,
      context = this.context,
      on = this.on;
    this.createBusy = true;
    this.createNote = "Creating…";
    cx.spawn(async cx => {
      try {
        // Released writeTextFile is local-only. Remote empty files use the
        // documented exec API with a create-new operation rather than touch
        // or a shell string containing the user-supplied path.
        if (kind === "file" && !on) await writeTextFile(path, "", null);
        else await this.createWithShell(path, kind, on);
        if (!this.current(context)) return;
        this.selected = { path: relative, rowKind: kind === "folder" ? "folder" : "file" };
        this.pendingCreate = null;
        this.createInput?.release();
        this.createInput = null;
        this.createNote = null;
        this.createBusy = false;
        this.refresh(cx);
        if (kind === "file") this.open(relative, cx);
      } catch (error) {
        if (this.current(context)) {
          this.createBusy = false;
          this.createNote = `Couldn't create ${kind}: ${String(error).replace(/^Error:\s*/, "")}`;
          this.createInput?.focus();
        }
      } finally {
        cx.notify();
      }
    });
  }

  watch(root, cx) {
    if (this.on || this.watched === root) return;
    this.watched = root;
    const context = this.context;
    cx.spawn(async cx => {
      try {
        while (this.context === context) {
          await watchFolder(root);
          if (this.current(context)) this.refresh(cx);
        }
      } catch {
        if (this.context === context) this.watched = null;
      }
    });
  }

  current(context) {
    return this.context === context && key(location(context)) === context.key;
  }

  async loadFolder(path, context) {
    const { on, cwd: root } = context;
    const entries = await directory(path ? `${root}/${path}` : root, on);
    if (!this.current(context) || (path && !this.folders.has(path))) return;
    const used = [...this.entries.entries()].filter(([p]) => p !== path).reduce((n, [, e]) => n + e.length, 0);
    this.entries.set(
      path,
      entries
        .slice(0, Math.max(0, Math.min(PER_FOLDER, TOTAL - used)))
        .sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name)),
    );
    if (entries.length > PER_FOLDER || used + entries.length > TOTAL) this.limited = true;
  }

  refresh(cx) {
    const loc = location(this.context),
      { cwd, on } = loc,
      next = key(loc);
    if (next !== this.context?.key) {
      this.createInput?.release();
      this.pendingCreate = null;
      this.createInput = null;
      this.createNote = null;
      this.createBusy = false;
      this.selected = null;
      if (this.context) this.saved.set(this.context.key, { folders: this.folders });
      const saved = this.saved.get(next);
      this.context = { key: next, ...loc };
      this.root = cwd;
      this.on = on;
      this.entries = new Map();
      this.folders = new Set(saved?.folders);
      this.pending = new Set();
      this.marks = {};
      this.folderMarks = new Map();
      this.ignored = new Set();
      this.ignoredDirs = [];
      this.watched = null;
      this.error = null;
      this.limited = false;
      this.loading = false;
    } else this.context.tab = loc.tab;
    if (!cwd || this.loading) return;
    const context = this.context;
    this.loading = true;
    this.limited = false;
    cx.spawn(async cx => {
      try {
        // Listings and Git run concurrently: each Windows listing is a
        // PowerShell process, and walking folders serially left the tree
        // empty for seconds on end.
        const gitInfo = (async () => {
          const top = await exec(
            "git",
            ["--no-optional-locks", "-c", "core.fsmonitor=false", "rev-parse", "--show-toplevel"],
            { cwd, on },
          ).catch(() => null);
          const marks = {};
          const ignored = new Set(),
            ignoredDirs = [];
          if (top?.code === 0) {
            const repoTop = slash(top.stdout.trim());
            // Writes nothing under .git (index lock, fsmonitor cookie): the folder watch would refresh again.
            const status = await exec(
              "git",
              [
                "--no-optional-locks",
                "-c",
                "core.fsmonitor=false",
                "status",
                "--porcelain=v1",
                "-z",
                "--no-renames",
                "--untracked-files=all",
              ],
              { cwd, on },
            ).catch(() => null);
            if (status?.code === 0)
              for (const entry of status.stdout.split("\0").filter(Boolean).slice(0, TOTAL)) {
                const xy = entry.slice(0, 2);
                marks[`${repoTop}/${entry.slice(3)}`] = statusMark(xy);
              }
            // Ignored paths (git collapses directories to `!! dir/`): they
            // ghost the tree's names. Capped — this is tinting, not inventory.
            const skipped = await exec(
              "git",
              [
                "--no-optional-locks",
                "-c",
                "core.fsmonitor=false",
                "status",
                "--porcelain=v1",
                "-z",
                "--ignored=matching",
              ],
              { cwd, on },
            ).catch(() => null);
            if (skipped?.code === 0)
              for (const entry of skipped.stdout
                .split("\0")
                .filter(entry => entry.startsWith("!! "))
                .slice(0, 2000)) {
                const p = `${repoTop}/${entry.slice(3)}`;
                if (p.endsWith("/")) ignoredDirs.push(p.slice(0, -1));
                else ignored.add(p);
              }
          }
          // Folders take the color of the most severe change under them:
          // conflicts first, then deletions, modifications and new files —
          // the same precedence as individual names.
          const SEVERITY = "UDMA";
          const folderMarks = new Map();
          const cwdForward = slash(cwd);
          for (const [marked, mark] of Object.entries(marks)) {
            if (!marked.startsWith(`${cwdForward}/`)) continue;
            const parts = marked.slice(cwdForward.length + 1).split("/");
            for (let i = 1; i < parts.length; i++) {
              const folder = parts.slice(0, i).join("/");
              const prev = folderMarks.get(folder);
              if (!prev || SEVERITY.indexOf(mark) < SEVERITY.indexOf(prev)) folderMarks.set(folder, mark);
            }
          }
          return { marks, ignored, ignoredDirs, folderMarks };
        })();
        await Promise.all(
          ["", ...this.folders].map(path => (this.current(context) ? this.loadFolder(path, context) : null)),
        );
        const { marks, ignored, ignoredDirs, folderMarks } = await gitInfo;
        if (!this.current(context)) return;
        this.marks = marks;
        this.folderMarks = folderMarks;
        this.ignored = ignored;
        this.ignoredDirs = ignoredDirs;
        this.error = null;
        this.watch(cwd, cx);
      } catch (e) {
        if (this.current(context)) this.error = String(e);
      } finally {
        if (this.context === context) this.loading = false;
        cx.notify();
      }
    });
  }

  // Git status → Ayu color for the whole entry name and folder glyph.
  markColor(mark, t) {
    if (mark === "A") return t.git_added ?? t.ansi2;
    if (mark === "D") return t.git_deleted ?? t.ansi1;
    if (mark === "U") return t.git_conflict ?? t.git_modified ?? t.ansi3;
    if (mark === "M") return t.git_modified ?? t.ansi3;
    return null;
  }

  toggle(path, cx) {
    if (this.folders.has(path)) {
      for (const folder of [...this.folders])
        if (folder === path || folder.startsWith(path + "/")) {
          this.folders.delete(folder);
          this.entries.delete(folder);
        }
    } else {
      this.folders.add(path);
      if (!this.entries.has(path) && !this.pending.has(path)) {
        const context = this.context;
        this.pending.add(path);
        cx.spawn(async cx => {
          try {
            await this.loadFolder(path, context);
          } catch (e) {
            if (this.current(context)) this.error = String(e);
          } finally {
            if (this.context === context) this.pending.delete(path);
            cx.notify();
          }
        });
      }
    }
    cx.notify();
  }

  open(path, cx) {
    const file = slash(`${this.root}/${path}`);
    const focus = focused(),
      tab = focus?.tab;
    const inTab = panes().filter(p => p.tab === tab);
    const request = { file, on: this.on ?? null };
    setShared("mide.editor.request", request);

    const existing = inTab.find(p => p.mod === "mide-editor");
    if (existing) {
      run("mide-editor.open");
      return;
    }

    const diff = inTab.find(p => p.mod === "mide-diff");
    const terminalTarget =
      inTab.find(p => p.terminal && p.cwd === this.root) ??
      inTab.find(p => p.terminal && p.focused) ??
      inTab.find(p => p.terminal);
    const target = diff ?? terminalTarget ?? inTab.find(p => p.pane === focus?.pane) ?? inTab[0];
    const direction = diff ? "down" : "right";
    if (target) run("pane.split", { direction, pane: target.pane, mod: "mide-editor", props: request });
    else {
      const space =
        spaces().find(s => s.id === this.context?.space) ??
        spaces().find(s => s.id === focus?.space) ??
        spaces().find(s => s.active);
      run("tab.new", {
        name: `Editor · ${path.split("/").pop()}`,
        ...(space ? { space: space.id } : {}),
        mod: "mide-editor",
        props: request,
      });
    }
  }

  rows(prefix, depth, out, t, typography) {
    if (out.length >= TOTAL || depth > 40) return out;
    if (this.pendingCreate?.folder === prefix) out.push(this.createInputRow(depth, t, typography));
    for (const entry of this.entries.get(prefix) ?? []) {
      if (out.length >= TOTAL) break;
      const path = prefix ? `${prefix}/${entry.name}` : entry.name,
        open = this.folders.has(path),
        abs = slash(`${this.root}/${path}`),
        mark = this.marks[abs];
      const folderMark = entry.dir ? this.folderMarks.get(path) : null;
      const status = mark ?? folderMark,
        statusColor = status ? this.markColor(status, t) : null;
      const ignored = this.ignored.has(abs) || this.ignoredDirs.some(d => abs === d || abs.startsWith(`${d}/`));
      const nameColor = statusColor ?? (ignored ? (t.git_ignored ?? t.dim) : (t.file_muted ?? t.muted));
      out.push(
        h_flex()
          .id(`file-${path}`)
          .h(26)
          .flex_none()
          .pl(8 + depth * 18)
          .pr(8)
          .gap(7)
          .items_center()
          .rounded(7)
          .cursor_pointer()
          .hover(s => s.bg(t.hover))
          .on_click((_e, cx) => {
            this.selected = { path, rowKind: entry.dir ? "folder" : "file" };
            if (entry.dir) this.toggle(path, cx);
            else this.open(path, cx);
          })
          .on_mouse_down("right", (event, cx) => {
            cx.stop_propagation();
            this.showContextMenu(
              { path, rowKind: entry.dir ? "folder" : "file" },
              { x: event.position.x, y: event.position.y },
            );
          })
          .child(
            entry.dir
              ? svg(`${ICONS}/chevron-${open ? "down" : "right"}.svg`)
                  .size(12)
                  .flex_none()
                  .text_color(t.dim)
              : div().w(12).flex_none(),
          )
          .child(
            entry.dir
              ? svg(`${ICONS}/folder${open ? "-open" : ""}.svg`)
                  .size(16)
                  .flex_none()
                  .text_color(folderMark ? statusColor : t.dim)
              : image(`${MATERIAL}/${resolveIcon(entry.name) ?? "file"}.svg`)
                  .w(16)
                  .h(16)
                  .flex_none(),
          )
          .child(div().flex_1().min_w(0).truncate().font_normal().text_color(nameColor).child(entry.name))
          .when(Boolean(mark), el =>
            el.child(div().text_size(typography.text(11)).font_semibold().text_color(statusColor).child(mark)),
          ),
      );
      if (entry.dir && open) this.rows(path, depth + 1, out, t, typography);
    }
    return out;
  }

  createInputRow(depth, t, typography) {
    const errorColor = t.git_deleted ?? t.ansi1 ?? t.accent;
    return v_flex()
      .id("mide-files-create-row")
      .flex_none()
      .pl(8 + depth * 18)
      .pr(8)
      .gap(2)
      .child(
        h_flex()
          .h(26)
          .flex_none()
          .gap(7)
          .items_center()
          .child(div().w(12).flex_none())
          .child(
            this.pendingCreate.kind === "file"
              ? image(`${MATERIAL}/file.svg`).w(16).h(16).flex_none()
              : svg(`${ICONS}/folder.svg`).size(16).flex_none().text_color(t.accent),
          )
          .child(
            Input.new(this.createInput)
              .id("mide-files-create-input")
              .on_key_down((event, cx) => {
                if (event.key === "escape") {
                  cx.stop_propagation();
                  this.cancelCreate(cx);
                }
              })
              .h(24)
              .flex_1()
              .min_w(0)
              .px(5)
              .rounded(4)
              .border_1()
              .border_color(this.createNote && this.createNote !== "Creating…" ? errorColor : t.accent)
              .text_size(typography.text(12))
              .text_color(t.foreground),
          ),
      )
      .when(Boolean(this.createNote), el =>
        el.child(
          div()
            .pl(35)
            .text_size(typography.text(10))
            .text_color(this.createNote === "Creating…" ? t.dim : errorColor)
            .child(this.createNote),
        ),
      );
  }

  render(cx) {
    const host = theme(),
      t = { ...host, ...gitColors, background: host.chrome },
      typography = interfaceTypography();
    if (this.contextMenu) return this.renderContextMenu(typography);
    if (key(location(this.context)) !== this.context?.key) this.refresh(cx);
    return v_flex()
      .id("mide-files")
      .size_full()
      .min_h(0)
      .rounded(10)
      .overflow_hidden()
      .bg(t.background)
      .border_1()
      .border_color(t.border)
      .text_color(t.foreground)
      .font_family(typography.font)
      .text_size(typography.size)
      .child(
        h_flex()
          .h(42)
          .flex_none()
          .px(14)
          .gap(8)
          .items_center()
          .border_b(1)
          .border_color(t.border)
          .child(div().font_semibold().child("Files"))
          .child(
            div()
              .flex_1()
              .min_w(0)
              .truncate()
              .text_right()
              .text_size(typography.text(12))
              .text_color(t.dim)
              .child(this.root?.split(/[\\/]/).pop() ?? ""),
          ),
      )
      .child(
        v_flex()
          .id("mide-files-tree")
          .flex_1()
          .min_h(0)
          .overflow_y_scrollbar()
          .p(6)
          .on_mouse_down("right", (event, _cx) => {
            if (!this.pendingCreate)
              this.showContextMenu({ path: "", rowKind: "root" }, { x: event.position.x, y: event.position.y });
          })
          .children(this.rows("", 0, [], t, typography))
          .when(
            Boolean(this.error) ||
              (!this.entries.get("")?.length && !(this.pendingCreate && this.pendingCreate.folder === "")),
            el =>
              el.child(
                div()
                  .p(8)
                  .text_size(typography.text(12))
                  .text_color(t.dim)
                  .child(this.error || (this.loading ? "Loading files…" : this.root ? "No files" : "No folder")),
              ),
          )
          .when(this.limited, el =>
            el.child(
              div()
                .p(8)
                .text_size(typography.text(11))
                .text_color(t.dim)
                .child("File list limited to 500 entries per folder and 5,000 total"),
            ),
          ),
      );
  }
}
