// mIDE Files — a file manager for the focused pane's folder with file-type
// icons and git status colors on the tree. Clicking a file opens it in the
// mIDE editor pane.
//
// Folder listing adapts Herdr's shipped `files` mod (Apache-2.0):
// same sh/PowerShell helpers, same lazy expansion, same bounded reads.
import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, panes, focused, exec, watchFolder, theme, settings, setShared, run, window } from "herdr";
import { resolveIcon } from "./icons.js";
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
// Git reports repository paths with forward slashes; a Windows space cwd
// arrives with backslashes. Marks and the tree's lookups must agree on one
// separator form on every platform.
const slash = p => String(p).replace(/\\/g, "/");
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
const interfaceTypography = () => {
  const current = settings(), size = current.ui_font_size ?? 13;
  return { font: current.ui_font_family ?? "Geist", size, text: base => base * size / 13 };
};

// Material Icon Theme icons, full-color SVGs; icons.js owns the mapping
// and its resolution order (exact name, then longest dotted suffix, then
// prefix, then the theme's plain file glyph).
async function directory(path, on) {
  // RFC 4648 base64 of the script's UTF-16LE bytes, built without the
  // runtime Buffer: its base64/utf16le output is rejected by PowerShell
  // (-EncodedCommand) on Windows, so every byte is produced here.
  const utf16leBase64 = text => {
    const bytes = [];
    for (let i = 0; i < text.length; i++) {
      const unit = text.charCodeAt(i);
      if (unit >= 0xd800 && unit <= 0xdbff && i + 1 < text.length) {
        const next = text.charCodeAt(i + 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          const point = 0x10000 + ((unit - 0xd800) << 10) + (next - 0xdc00);
          bytes.push(point & 255, point >> 8 & 255, point >> 16 & 255, point >>> 24 & 255);
          i++;
          continue;
        }
      }
      bytes.push(unit & 255, unit >> 8 & 255);
    }
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let out = "";
    for (let i = 0; i + 2 < bytes.length; i += 3) {
      const chunk = bytes[i] << 16 | bytes[i + 1] << 8 | bytes[i + 2];
      out += alphabet[chunk >> 18 & 63] + alphabet[chunk >> 12 & 63] + alphabet[chunk >> 6 & 63] + alphabet[chunk & 63];
    }
    const rest = bytes.length % 3;
    if (rest === 1) out += alphabet[bytes[bytes.length - 1] >> 2] + alphabet[bytes[bytes.length - 1] << 4 & 63] + "==";
    else if (rest === 2) {
      const chunk = bytes[bytes.length - 2] << 8 | bytes[bytes.length - 1];
      out += alphabet[chunk >> 10 & 63] + alphabet[chunk >> 4 & 63] + alphabet[chunk << 2 & 63] + "=";
    }
    return out;
  };
  const windowsDirectory = async () => {
    // Windows argv transport mangles arguments containing spaces or quotes,
    // so the whole listing travels as one -EncodedCommand payload with the
    // folder path embedded in it; nothing quoting-sensitive stays in argv.
    const script =
      "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); " +
      "& { @(Get-ChildItem -LiteralPath '" + path.replace(/['‘’‚‛]/g, "$&$&") + "' -Force -ErrorAction Stop " +
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
  if (!on && window().platform === "windows") return windowsDirectory();
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
        // Listings and Git run concurrently: each Windows listing is a
        // PowerShell process, and walking folders serially left the tree
        // empty for seconds on end.
        const gitInfo = (async () => {
          const top = await exec("git", ["--no-optional-locks", "-c", "core.fsmonitor=false", "rev-parse", "--show-toplevel"], { cwd, on }).catch(() => null);
          const marks = {};
          const ignored = new Set(), ignoredDirs = [];
          if (top?.code === 0) {
            const repoTop = slash(top.stdout.trim());
            // Writes nothing under .git (index lock, fsmonitor cookie): the folder watch would refresh again.
            const status = await exec("git", ["--no-optional-locks", "-c", "core.fsmonitor=false", "status", "--porcelain=v1", "-z", "--no-renames", "--untracked-files=all"], { cwd, on }).catch(() => null);
            if (status?.code === 0) for (const entry of status.stdout.split("\0").filter(Boolean).slice(0, TOTAL)) {
              const xy = entry.slice(0, 2);
              marks[`${repoTop}/${entry.slice(3)}`] = statusMark(xy);
            }
            // Ignored paths (git collapses directories to `!! dir/`): they
            // ghost the tree's names. Capped — this is tinting, not inventory.
            const skipped = await exec("git", ["--no-optional-locks", "-c", "core.fsmonitor=false", "status", "--porcelain=v1", "-z", "--ignored=matching"], { cwd, on }).catch(() => null);
            if (skipped?.code === 0) for (const entry of skipped.stdout.split("\0").filter(entry => entry.startsWith("!! ")).slice(0, 2000)) {
              const p = `${repoTop}/${entry.slice(3)}`;
              if (p.endsWith("/")) ignoredDirs.push(p.slice(0, -1)); else ignored.add(p);
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
        await Promise.all(["", ...this.folders].map(path => this.current(context) ? this.loadFolder(path, context) : null));
        const { marks, ignored, ignoredDirs, folderMarks } = await gitInfo;
        if (!this.current(context)) return;
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
    const file = slash(`${this.root}/${path}`);
    const focus = focused(), tab = focus?.tab;
    const inTab = panes().filter(p => p.tab === tab);
    const request = { file };
    setShared("mide.editor.request", request);

    const existing = inTab.find(p => p.mod === "mide-editor");
    if (existing) {
      run("mide-editor.open");
      return;
    }

    const diff = inTab.find(p => p.mod === "mide-diff");
    const terminalTarget = inTab.find(p => p.terminal && p.cwd === this.root)
      ?? inTab.find(p => p.terminal && p.focused)
      ?? inTab.find(p => p.terminal);
    const target = diff ?? terminalTarget ?? inTab.find(p => p.pane === focus?.pane) ?? inTab[0];
    const direction = diff ? "down" : "right";
    if (target) run("pane.split", { direction, pane: target.pane, mod: "mide-editor", props: request });
    else {
      const space = spaces().find(s => s.id === focus?.space) ?? spaces().find(s => s.active);
      run("tab.new", { name: `Editor · ${path.split("/").pop()}`, ...(space ? { space: space.id } : {}), mod: "mide-editor", props: { file } });
    }
  }

  rows(prefix, depth, out, t, typography) {
    if (out.length >= TOTAL || depth > 40) return out;
    for (const entry of this.entries.get(prefix) ?? []) {
      if (out.length >= TOTAL) break;
      const path = prefix ? `${prefix}/${entry.name}` : entry.name, open = this.folders.has(path), abs = slash(`${this.root}/${path}`), mark = this.marks[abs];
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
          : image(`${MATERIAL}/${resolveIcon(entry.name) ?? "file"}.svg`).w(16).h(16).flex_none())
        .child(div().flex_1().min_w(0).truncate().font_normal().text_color(nameColor).child(entry.name))
         .when(Boolean(mark), el => el.child(div().text_size(typography.text(11)).font_semibold().text_color(statusColor).child(mark))));
      if (entry.dir && open) this.rows(path, depth + 1, out, t, typography);
    }
    return out;
  }

  render(cx) {
    if (key(location(this.context)) !== this.context?.key) this.refresh(cx);
    const host = theme(), t = { ...host, ...gitColors, background: host.chrome }, typography = interfaceTypography();
    return v_flex().id("mide-files").size_full().min_h(0).rounded(10).overflow_hidden().bg(t.background).border_1().border_color(t.border).text_color(t.foreground).font_family(typography.font).text_size(typography.size)
      .child(h_flex().h(42).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border)
        .child(div().font_semibold().child("Files"))
        .child(div().flex_1().min_w(0).truncate().text_right().text_size(typography.text(12)).text_color(t.dim).child(this.root?.split(/[\\/]/).pop() ?? "")))
      .child(v_flex().id("mide-files-tree").flex_1().min_h(0).overflow_y_scrollbar().p(6).children(this.rows("", 0, [], t, typography))
        .when(Boolean(this.error) || !this.entries.get("")?.length, el => el.child(div().p(8).text_size(typography.text(12)).text_color(t.dim).child(this.error || (this.loading ? "Loading files…" : this.root ? "No files" : "No folder"))))
        .when(this.limited, el => el.child(div().p(8).text_size(typography.text(11)).text_color(t.dim).child("File list limited to 500 entries per folder and 5,000 total"))));
  }
}
