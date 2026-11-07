// mIDE Files — a file manager for the focused pane's folder with file-type
// icons and git status colors on the tree. Clicking a file opens it in the
// mIDE editor pane.
//
// Folder listing adapts Herdr's shipped `files` mod (Apache-2.0):
// same sh/PowerShell helpers, same lazy expansion, same bounded reads.
import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, panes, focused, exec, watchFolder, theme, run } from "herdr";
import { SUFFIX, NAMES, PREFIX } from "./icons.js";
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
const PER_FOLDER = 500, TOTAL = 5000;

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

// Material Icon Theme icons, full-color SVGs. icons.js maps suffixes and
// whole names to icon names;
// resolution order: exact name, then longest dotted suffix, then the
// theme's default file glyph.
function fileIcon(name) {
  const lower = name.toLowerCase();
  if (NAMES[lower]) return NAMES[lower];
  let rest = lower, dot;
  while ((dot = rest.indexOf(".")) >= 0) {
    rest = rest.slice(dot + 1);
    if (SUFFIX[rest]) return SUFFIX[rest];
  }
  for (const [prefix, icon] of PREFIX) if (lower.startsWith(prefix)) return icon;
  return null;
}

async function directory(path, on) {
  const windowsDirectory = async () => {
    const r = await exec("powershell", ["-NoProfile", "-Command", "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); & { param($p) @(Get-ChildItem -LiteralPath $p -Force -ErrorAction Stop | Where-Object { $_.Name -ne '.git' -and $_.Name -ne '.DS_Store' } | Select-Object -First 501 | ForEach-Object { @{ name=$_.Name; dir=($_.PSIsContainer -and (-not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -or -not $_.LinkType -or ($_.Target -and [IO.Directory]::Exists(([IO.Path]::Combine([IO.Path]::GetDirectoryName($_.FullName), $_.Target[0])))))) } }) | ConvertTo-Json -Compress } '" + path.replace(/['‘’‚‛]/g, "$&$&") + "'"], { on });
    if (r.code !== 0) throw new Error(r.stderr || "Cannot list this folder");
    const result = JSON.parse(r.stdout || "[]");
    return Array.isArray(result) ? result : [result];
  };
  if (!on && globalThis.window?.platform === "windows") return windowsDirectory();
  const script = 'n=0; for p in "$1"/* "$1"/.[!.]* "$1"/..?*; do [ -e "$p" ] || [ -L "$p" ] || continue; name=${p##*/}; case "$name" in .git|.DS_Store) continue;; esac; if [ -d "$p" ]; then kind=d; else kind=f; fi; printf "%s\\0%s\\0" "$kind" "$name"; n=$((n+1)); [ "$n" -gt 500 ] && break; done; test -d "$1"';
  let r;
  try { r = await exec("sh", ["-c", script, "mide-files", path], { on }); }
  catch (e) {
    if (on && String(e).includes("cannot start sh: program not found")) return windowsDirectory();
    throw e;
  }
  if (r.code !== 0) throw new Error(r.stderr || "Cannot list this folder");
  const fields = r.stdout.split("\0"), out = [];
  for (let i = 0; i + 1 < fields.length; i += 2) out.push({ name: fields[i + 1], dir: fields[i] === "d" });
  return out;
}

export default class MideFiles extends View {
  init(_props, cx) {
    this.saved = new Map();
    this.entries = new Map(); this.folders = new Set(); this.pending = new Set(); this.marks = {}; this.folderMarks = new Map(); this.ignored = new Set(); this.ignoredDirs = [];
    this.refresh(cx);
    cx.timer.every(10000, cx => this.refresh(cx));
  }

  watch(root, cx) {
    if (this.on || this.watched === root) return;
    this.watched = root;
    const context = this.context;
    cx.spawn(async cx => {
      try { while (this.context === context) { await watchFolder(root); if (this.current(context)) this.refresh(cx); } }
      catch { if (this.context === context) this.watched = null; }
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
    this.entries.set(path, entries.slice(0, Math.max(0, Math.min(PER_FOLDER, TOTAL - used))).sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name)));
    if (entries.length > PER_FOLDER || used + entries.length > TOTAL) this.limited = true;
  }

  refresh(cx) {
    const loc = location(this.context), { cwd, on } = loc, next = key(loc);
    if (next !== this.context?.key) {
      if (this.context) this.saved.set(this.context.key, { folders: this.folders });
      const saved = this.saved.get(next);
      this.context = { key: next, ...loc }; this.root = cwd; this.on = on; this.entries = new Map(); this.folders = new Set(saved?.folders);
      this.pending = new Set(); this.marks = {}; this.folderMarks = new Map(); this.ignored = new Set(); this.ignoredDirs = []; this.watched = null; this.error = null; this.limited = false;
      this.loading = false;
    } else this.context.tab = loc.tab;
    if (!cwd || this.loading) return;
    const context = this.context;
    this.loading = true;
    this.limited = false;
    cx.spawn(async cx => {
      try {
        for (const path of ["", ...this.folders]) {
          if (!this.current(context)) return;
          await this.loadFolder(path, context);
        }
        const top = await exec("git", ["--no-optional-locks", "-c", "core.fsmonitor=false", "rev-parse", "--show-toplevel"], { cwd, on }).catch(() => null);
        const marks = {};
        const ignored = new Set(), ignoredDirs = [];
        if (top?.code === 0) {
          // Writes nothing under .git (index lock, fsmonitor cookie): the folder watch would refresh again.
          const status = await exec("git", ["--no-optional-locks", "-c", "core.fsmonitor=false", "status", "--porcelain=v1", "-z", "--no-renames", "--untracked-files=all"], { cwd, on }).catch(() => null);
          if (status?.code === 0) for (const entry of status.stdout.split("\0").filter(Boolean).slice(0, TOTAL)) {
            const xy = entry.slice(0, 2);
            marks[`${top.stdout.trim()}/${entry.slice(3)}`] = statusMark(xy);
          }
          // Ignored paths (git collapses directories to `!! dir/`): they
          // ghost the tree's names. Capped — this is tinting, not inventory.
          const skipped = await exec("git", ["--no-optional-locks", "-c", "core.fsmonitor=false", "status", "--porcelain=v1", "-z", "--ignored=matching"], { cwd, on }).catch(() => null);
          if (skipped?.code === 0) for (const entry of skipped.stdout.split("\0").filter(entry => entry.startsWith("!! ")).slice(0, 2000)) {
            const p = `${top.stdout.trim()}/${entry.slice(3)}`;
            if (p.endsWith("/")) ignoredDirs.push(p.slice(0, -1)); else ignored.add(p);
          }
        }
        if (!this.current(context)) return;
        // Folders take the color of the most severe change under them:
        // conflicts first, then deletions, modifications and new files —
        // the same precedence as individual names.
        const SEVERITY = "UDMA";
        const folderMarks = new Map();
        for (const [marked, mark] of Object.entries(marks)) {
          if (!marked.startsWith(`${cwd}/`)) continue;
          const parts = marked.slice(cwd.length + 1).split("/");
          for (let i = 1; i < parts.length; i++) {
            const folder = parts.slice(0, i).join("/");
            const prev = folderMarks.get(folder);
            if (!prev || SEVERITY.indexOf(mark) < SEVERITY.indexOf(prev)) folderMarks.set(folder, mark);
          }
        }
        this.marks = marks; this.folderMarks = folderMarks; this.ignored = ignored; this.ignoredDirs = ignoredDirs; this.error = null; this.watch(cwd, cx);
      } catch (e) { if (this.current(context)) this.error = String(e); }
      finally { if (this.context === context) this.loading = false; cx.notify(); }
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
      for (const folder of [...this.folders]) if (folder === path || folder.startsWith(path + "/")) {
        this.folders.delete(folder);
        this.entries.delete(folder);
      }
    } else {
      this.folders.add(path);
      if (!this.entries.has(path) && !this.pending.has(path)) {
        const context = this.context;
        this.pending.add(path);
        cx.spawn(async cx => {
          try { await this.loadFolder(path, context); }
          catch (e) { if (this.current(context)) this.error = String(e); }
          finally { if (this.context === context) this.pending.delete(path); cx.notify(); }
        });
      }
    }
    cx.notify();
  }

  open(path, cx) {
    const file = `${this.root}/${path}`;
    const focus = focused(), tab = focus?.tab;
    const inTab = panes().filter(p => p.tab === tab);
    const editors = inTab.filter(p => p.mod === "mide-editor");
    const terminalTarget = inTab.find(p => p.terminal && p.cwd === this.root)
      ?? inTab.find(p => p.terminal && p.focused)
      ?? inTab.find(p => p.terminal);
    const otherTarget = terminalTarget ?? inTab.find(p => p.mod !== "mide-editor");
    if (editors.length) {
      // Replace any existing editor pane(s), keeping the new one beside the
      // terminal that owns this folder. Close them before splitting the
      // terminal so its width is restored before the replacement takes half.
      if (otherTarget) {
        for (const editor of editors) run("pane.close", { pane: editor.pane });
        run("pane.split", { direction: "right", pane: otherTarget.pane, mod: "mide-editor", props: { file } });
      } else {
        // If this tab contains only editor panes, keep a live pane as the
        // split target, then close the old editor copies.
        run("pane.split", { direction: "right", pane: editors[0].pane, mod: "mide-editor", props: { file } });
        for (const editor of editors) run("pane.close", { pane: editor.pane });
      }
      return;
    }
    const target = otherTarget ?? inTab[0];
    if (target) run("pane.split", { direction: "right", pane: target.pane, mod: "mide-editor", props: { file } });
    else {
      const space = spaces().find(s => s.id === focus?.space) ?? spaces().find(s => s.active);
      run("tab.new", { name: `Editor · ${path.split("/").pop()}`, ...(space ? { space: space.id } : {}), mod: "mide-editor", props: { file } });
    }
  }

  rows(prefix, depth, out, t) {
    if (out.length >= TOTAL || depth > 40) return out;
    for (const entry of this.entries.get(prefix) ?? []) {
      if (out.length >= TOTAL) break;
      const path = prefix ? `${prefix}/${entry.name}` : entry.name, open = this.folders.has(path), abs = `${this.root}/${path}`, mark = this.marks[abs];
      const folderMark = entry.dir ? this.folderMarks.get(path) : null;
      const status = mark ?? folderMark, statusColor = status ? this.markColor(status, t) : null;
      const ignored = this.ignored.has(abs) || this.ignoredDirs.some(d => abs === d || abs.startsWith(`${d}/`));
      const nameColor = statusColor ?? (ignored ? (t.git_ignored ?? t.dim) : (t.file_muted ?? t.muted));
      out.push(h_flex().id(`file-${path}`).h(26).flex_none().pl(8 + depth * 18).pr(8).gap(7).items_center().rounded(7).cursor_pointer().hover(s => s.bg(t.hover))
        .on_click((_e, cx) => entry.dir ? this.toggle(path, cx) : this.open(path, cx))
        .child(entry.dir
          ? svg(`${ICONS}/chevron-${open ? "down" : "right"}.svg`).size(12).flex_none().text_color(t.dim)
          : div().w(12).flex_none())
        .child(entry.dir
          ? svg(`${ICONS}/folder${open ? "-open" : ""}.svg`).size(16).flex_none().text_color(folderMark ? statusColor : t.dim)
          : image(`${MATERIAL}/${fileIcon(entry.name) ?? "file"}.svg`).w(16).h(16).flex_none())
        .child(div().flex_1().min_w(0).truncate().font_normal().text_color(nameColor).child(entry.name))
        .when(Boolean(mark), el => el.child(div().text_size(11).font_semibold().text_color(statusColor).child(mark))));
      if (entry.dir && open) this.rows(path, depth + 1, out, t);
    }
    return out;
  }

  render(cx) {
    if (key(location(this.context)) !== this.context?.key) this.refresh(cx);
    const host = theme(), t = { ...host, ...gitColors, background: host.chrome };
    return v_flex().id("mide-files").size_full().min_h(0).rounded(10).overflow_hidden().bg(t.background).border_1().border_color(t.border).text_color(t.foreground).text_size(13)
      .child(h_flex().h(42).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border)
        .child(div().font_semibold().child("Files"))
        .child(div().flex_1().min_w(0).truncate().text_right().text_size(12).text_color(t.dim).child(this.root?.split(/[\\/]/).pop() ?? "")))
      .child(v_flex().id("mide-files-tree").flex_1().min_h(0).overflow_y_scrollbar().p(6).children(this.rows("", 0, [], t))
        .when(Boolean(this.error) || !this.entries.get("")?.length, el => el.child(div().p(8).text_size(12).text_color(t.dim).child(this.error || (this.loading ? "Loading files…" : this.root ? "No files" : "No folder"))))
        .when(this.limited, el => el.child(div().p(8).text_size(11).text_color(t.dim).child("File list limited to 500 entries per folder and 5,000 total"))));
  }
}
