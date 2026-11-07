// mIDE Diff — one project-wide comparison against HEAD. The Changes panel
// opens it with { root, files, selectedPath, on, branch, title }.
//
// Reads use the same no-write git flags as the Changes panel, so the folder
// watcher never sees the diff itself and starts a refresh loop.
import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, Scrollbar, VirtualListScrollHandle, v_virtual_list } from "gpui-base";
import * as base from "gpui-base";
import { props, shared, exec, readTextFile, watchFolder, theme, settings, nextCommand } from "herdr";
import { gitColors } from "./palette.js";
import { languageFor, syntaxSegments } from "./_shared/syntax.js";

const READ = ["--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "diff.autoRefreshIndex=false"];
const MAX_LINES = 6000, MAX_TEXT = 600000, PROJECT_DIFF_BATCH = 100, LINE = 20;
const MAX_SYNTAX_CHARS = 600000, MAX_SYNTAX_TOTAL_CHARS = 20000000, SYNTAX_BATCH = 8;
const SPLIT_MIN_WIDTH = 900;
const syntaxColors = base.SyntaxHighlighter?.colors?.() ?? {};
const countLines = (text) => text ? text.split("\n").length - Number(text.endsWith("\n")) : 0;
const lineNumbers = (hunks, key) => [...new Set(hunks.flatMap(hunk => hunk.lines.map(line => line[key]).filter(Number.isInteger)))].sort((a, b) => a - b);
const syntaxLineMap = lines => new Map(lines.map(({ line, runs }) => [line, runs]));
const typographySettings = () => {
  const current = settings(), uiSize = current.ui_font_size ?? 13;
  return {
    uiFont: current.ui_font_family ?? "Geist",
    uiSize,
    text: base => base * uiSize / 13,
    codeFont: current.font_family ?? "JetBrains Mono",
    codeSize: current.font_size ?? 14,
  };
};

// Unified diff text → hunks with old/new numbers. Header noise (diff --git,
// index, ---, +++) is skipped; the view supplies its own file header.
function parseDiff(text) {
  const hunks = [];
  const source = String(text).replace(/\r\n/g, "\n");
  let hunk = null, oldNo = 0, newNo = 0, add = 0, del = 0, combined = false;
  let truncated = source.length > MAX_TEXT;
  for (const line of source.slice(0, MAX_TEXT).split("\n")) {
    if (line.startsWith("@@@")) { combined = true; continue; }
    const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (match) {
      oldNo = +match[1]; newNo = +match[3];
      hunk = { oldStart: oldNo, newStart: newNo, oldCount: match[2] === undefined ? 1 : +match[2], newCount: match[4] === undefined ? 1 : +match[4], lines: [] };
      hunks.push(hunk);
      continue;
    }
    if (!hunk || line.startsWith("\\ No newline")) continue;
    const kind = line[0];
    let body = line.slice(1) || " ";
    if (body.length > 4000) { body = body.slice(0, 4000) + "…"; truncated = true; }
    if (kind === "-") { hunk.lines.push({ kind, old: oldNo++, new: null, text: body }); del++; }
    else if (kind === "+") { hunk.lines.push({ kind, old: null, new: newNo++, text: body }); add++; }
    else if (kind === " ") { hunk.lines.push({ kind, old: oldNo++, new: newNo++, text: body }); }
  }
  return { hunks, add, del, combined, truncated, binary: /^Binary files .* differ$/m.test(source) };
}

function diffSections(text) {
  const starts = [...String(text).matchAll(/^diff --git /gm)].map(match => match.index);
  return starts.map((start, index) => text.slice(start, starts[index + 1] ?? text.length));
}

// Every hunk is one excerpt: a dim ⋯ band before it, then its rows. the reference IDE has no
// GitHub-style @@ band; the band is only a visual break between excerpts.
function unifiedRows(hunks) {
  const rows = [];
  hunks.forEach((hunk, index) => {
    if (index) rows.push({ type: "gap" });
    for (const line of hunk.lines) rows.push({ type: "line", ...line });
  });
  return rows;
}

// Pair a run of deletions with additions, the reference IDE's split view. The shorter side
// gets raised spacer rows so both halves stay aligned.
function splitRows(hunks) {
  const rows = [];
  hunks.forEach((hunk, index) => {
    if (index) rows.push({ type: "gap" });
    for (let i = 0; i < hunk.lines.length;) {
      const line = hunk.lines[i];
      if (line.kind === " ") { rows.push({ type: "both", left: line, right: line }); i++; continue; }
      const dels = [], adds = [];
      while (i < hunk.lines.length && hunk.lines[i].kind !== " ") {
        if (hunk.lines[i].kind === "-") dels.push(hunk.lines[i]); else adds.push(hunk.lines[i]);
        i++;
      }
      for (let j = 0; j < Math.max(dels.length, adds.length); j++) rows.push({ type: "change", left: dels[j] ?? null, right: adds[j] ?? null });
    }
  });
  return rows;
}

export default class MideDiff extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.scroll = VirtualListScrollHandle.new();
    this.request = null; this.files = []; this.rows = []; this.fileRows = new Map();
    this.diffWidth = 0; this.selectedPath = null; this.jumpToSelection = false;
    this.splitContentWidth = 400; this.splitViewportWidth = 0; this.splitOffset = 0;
    this.mode = "split"; this.busy = false; this.error = null; this.watching = false; this.limited = false;
    this.open(props() ?? shared("mide.diff.request"), cx);
    cx.spawn(async (cx) => {
      for (;;) {
        const command = await nextCommand();
        const name = typeof command === "string" ? command : command?.name;
        if (name === "open") this.open(shared("mide.diff.request"), cx);
        else if (name === "refresh") this.load(cx);
        else if (name === "focus") this.handle.focus();
        cx.notify();
      }
    });
    // watchFolder has no remote variant; the timer keeps remote diffs live.
    cx.timer.every(10000, (cx) => { if (this.request && !this.busy) this.load(cx); });
  }

  open(request, cx) {
    if (!request?.root) return;
    const files = Array.isArray(request.files)
      ? request.files
      : request.path ? [{ path: request.path, status: request.status, fresh: request.fresh }] : [];
    this.request = { ...request, files };
    this.files = []; this.rows = []; this.fileRows = new Map();
    this.selectedPath = request.selectedPath ?? request.path ?? files[0]?.path ?? null;
    this.jumpToSelection = Boolean(this.selectedPath);
    this.splitOffset = 0;
    if (request.mode === "split" || request.mode === "unified") this.mode = request.mode;
    this.error = null; this.limited = false; this.busy = false;
    this.watch(cx);
    this.load(cx);
    cx.notify();
  }

  watch(cx) {
    if (this.watching) return;
    this.watching = true;
    cx.spawn(async (cx) => {
      while (this.request?.root) {
        const root = this.request.root;
        try { await watchFolder(root); }
        catch { this.watching = false; return; }
        if (this.request?.root === root) this.load(cx);
      }
      this.watching = false;
    });
  }

  fullFileDiff(file) {
    return readTextFile(`${this.request.root}/${file.path}`, { on: this.request.on }).then((text) => {
      if (text === null) return { ...file, error: "Cannot read this file", hunks: [], add: 0, del: 0 };
      if (text.includes("\0")) return { ...file, hunks: [], add: 0, del: 0, binary: true };
      if (!text) return { ...file, hunks: [], add: 0, del: 0 };
      const lines = text.slice(0, MAX_TEXT).replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
      const kept = lines.slice(0, MAX_LINES).map(line => line.length > 4000 ? `${line.slice(0, 4000)}…` : line);
      const parsed = parseDiff(`@@ -0,0 +1,${countLines(text)} @@\n${kept.map(line => `+${line}`).join("\n")}`);
      return { ...file, ...parsed, truncated: parsed.truncated || lines.length > kept.length };
    }).catch(error => ({ ...file, error: String(error), hunks: [], add: 0, del: 0 }));
  }

  async trackedDiffBatch(files) {
    const { root, on } = this.request;
    const paths = files.map(file => file.path);
    const args = [...READ, "-c", "core.quotePath=false"];
    const listed = await exec("git", [...args, "diff", "--name-only", "-z", "--no-renames", "HEAD", "--", ...paths], { cwd: root, on });
    if (listed.code !== 0) throw new Error((listed.stderr || listed.stdout).trim());
    const changedPaths = listed.stdout.split("\0").filter(Boolean);
    if (!changedPaths.length) return new Map();
    const result = await exec("git", [...args, "diff", "--no-ext-diff", "--no-textconv", "--no-color", "--no-renames", "--unified=3", "HEAD", "--", ...paths], { cwd: root, on });
    if (result.code !== 0) throw new Error((result.stderr || result.stdout).trim());
    const sections = diffSections(result.stdout), output = new Map();
    for (let index = 0; index < Math.min(changedPaths.length, sections.length); index++) {
      output.set(changedPaths[index], parseDiff(sections[index]));
    }
    return output;
  }

  async load(cx) {
    const request = this.request;
    if (!request || this.busy) return;
    this.busy = true; this.error = null;
    try {
      const files = [...request.files].sort((a, b) => a.path.localeCompare(b.path));
      const results = new Map();
      const untracked = files.filter(file => file.fresh);
      for (let start = 0; start < untracked.length; start += 8) {
        const batch = untracked.slice(start, start + 8);
        const loaded = await Promise.all(batch.map(file => this.fullFileDiff(file)));
        for (const file of loaded) results.set(file.path, file);
        if (this.request !== request) return;
      }

      const tracked = files.filter(file => !file.fresh && !file.conflict);
      const head = tracked.length
        ? await exec("git", [...READ, "rev-parse", "--verify", "HEAD"], { cwd: request.root, on: request.on })
        : { code: 0 };
      if (head.code !== 0) {
        for (let start = 0; start < tracked.length; start += 8) {
          const batch = tracked.slice(start, start + 8);
          const loaded = await Promise.all(batch.map(file => this.fullFileDiff(file)));
          for (const file of loaded) results.set(file.path, file);
          if (this.request !== request) return;
        }
      } else {
        for (let start = 0; start < tracked.length; start += PROJECT_DIFF_BATCH) {
          const batch = tracked.slice(start, start + PROJECT_DIFF_BATCH);
          try {
            const loaded = await this.trackedDiffBatch(batch);
            for (const file of batch) results.set(file.path, loaded.get(file.path) ?? { hunks: [], add: 0, del: 0 });
          } catch (error) {
            const message = String(error);
            for (const file of batch) results.set(file.path, { error: message, hunks: [], add: 0, del: 0 });
          }
          if (this.request !== request) return;
        }
      }

      for (const file of files) {
        if (!results.has(file.path)) results.set(file.path, {
          hunks: [], add: 0, del: 0, combined: Boolean(file.conflict),
        });
      }
      if (this.request !== request) return;
      const loadedFiles = files.map(file => ({ ...file, ...results.get(file.path) }));
      const highlightedFiles = await this.highlightFiles(loadedFiles, request);
      if (!highlightedFiles || this.request !== request) return;
      this.files = highlightedFiles;
      this.limited = this.files.some(file => file.truncated);
      this.build();
      if (this.jumpToSelection) {
        this.scroll.scroll_to_item(this.fileRows.get(this.selectedPath) ?? 0, "top");
        this.jumpToSelection = false;
      }
    } catch (error) { if (this.request === request) this.error = String(error); }
    finally {
      if (this.request === request) { this.busy = false; cx.notify(); }
    }
  }

  async highlightFile(file, request, budget) {
    if (file.error || file.combined || file.binary || !file.hunks?.length) return file;
    if (!base.SyntaxHighlighter?.highlight_lines) return file;
    const oldLines = lineNumbers(file.hunks, "old");
    const newLines = lineNumbers(file.hunks, "new");
    if (oldLines.length > MAX_LINES || newLines.length > MAX_LINES) return file;

    try {
      const oldSourcePromise = file.fresh
        ? Promise.resolve("")
        : exec("git", [...READ, "show", `HEAD:${file.path}`], { cwd: request.root, on: request.on })
          .then(result => result.code === 0 ? result.stdout : "");
      const newSourcePromise = readTextFile(`${request.root}/${file.path}`, { on: request.on })
        .then(text => text ?? "");
      const [oldSource, newSource] = await Promise.all([oldSourcePromise, newSourcePromise]);
      if (this.request !== request) return file;
      const sourceSize = oldSource.length + newSource.length;
      if (sourceSize > MAX_SYNTAX_CHARS * 2 || budget.characters + sourceSize > MAX_SYNTAX_TOTAL_CHARS) return file;
      budget.characters += sourceSize;
      const language = languageFor(file.path);
      const highlight = (source, requested) => source.length <= MAX_SYNTAX_CHARS && requested.length
        ? syntaxLineMap(base.SyntaxHighlighter.highlight_lines(language, source, requested))
        : new Map();
      return { ...file, syntax: { old: highlight(oldSource, oldLines), new: highlight(newSource, newLines) } };
    } catch {
      return file;
    }
  }

  async highlightFiles(files, request) {
    const highlighted = [];
    const budget = { characters: 0 };
    for (let start = 0; start < files.length; start += SYNTAX_BATCH) {
      const batch = await Promise.all(files.slice(start, start + SYNTAX_BATCH).map(file => this.highlightFile(file, request, budget)));
      if (this.request !== request) return null;
      highlighted.push(...batch);
    }
    return highlighted;
  }

  build() {
    const rows = [], fileRows = new Map();
    for (const [index, file] of this.files.entries()) {
      if (index) rows.push({ type: "file-gap" });
      fileRows.set(file.path, rows.length);
      rows.push({ type: "file", file });
      if (file.error || file.combined || file.binary || !file.hunks?.length) {
        const text = file.error ? `Diff unavailable: ${file.error}`
          : file.combined ? "Conflict diff is not available in the project view."
            : file.binary ? "Binary file changed · no text diff"
              : file.fresh ? "Empty untracked file" : "No text diff available";
        rows.push({ type: "message", text });
        continue;
      }
      const built = this.mode === "split" ? splitRows(file.hunks) : unifiedRows(file.hunks);
      rows.push(...built.map(row => ({ ...row, sourceFile: file })));
    }
    this.rows = rows;
    this.fileRows = fileRows;
    const longest = rows.reduce((length, row) => Math.max(length,
      (row.text ?? "").length, (row.file?.path ?? "").length,
      (row.left?.text ?? "").length, (row.right?.text ?? "").length), 0);
    this.diffWidth = Math.max(400, Math.min(32000, longest * 8 + 150));
    this.splitContentWidth = Math.max(400, Math.min(32000, longest * 8 + 100));
    this.splitOffset = Math.min(this.splitOffset, Math.max(0, this.splitContentWidth - this.splitViewportWidth));
  }

  setMode(mode, cx) {
    if (this.mode === mode) return;
    this.mode = mode; this.build(); this.scroll.scroll_to_item(this.fileRows.get(this.selectedPath) ?? 0); cx.notify();
  }

  modeButton(mode, label, t, typography) {
    const active = this.mode === mode;
    return div().id(`mide-diff-mode-${mode}`).h(22).px(8).flex().items_center().rounded(5).text_size(typography.text(10))
      .text_color(active ? t.foreground : t.muted)
      .when(active, (e) => e.bg(t.selected))
      .when(!active, (e) => e.cursor_pointer().hover((s) => s.bg(t.hover)).on_click((_e, cx) => this.setMode(mode, cx)))
      .child(label);
  }

  number(value, color, typography) {
    return div().w(42).flex_none().pr(6).text_right().text_size(typography.codeSize).text_color(color).child(value === null || value === undefined ? "" : String(value));
  }

  tint(kind, t) {
    if (kind === "+") return t.diff_added + "1e";
    if (kind === "-") return t.diff_deleted + "1e";
    return null;
  }

  codeCell(text, runs, fallback) {
    const segments = syntaxSegments(text, runs, fallback, syntaxColors);
    return h_flex().flex_1().min_w(0).h(LINE).items_center().overflow_hidden().whitespace_nowrap()
      .children(segments.map(segment => div().flex_none().text_color(segment.color).child(segment.text)));
  }

  fileHeader(file, t, typography, minWidth = null) {
    const status = file.status === "A" ? (t.git_added ?? t.ansi2)
      : file.status === "D" ? (t.git_deleted ?? t.ansi1)
        : file.status === "U" ? (t.git_conflict ?? t.ansi3)
        : (t.git_modified ?? t.ansi3);
    const width = minWidth ?? this.diffWidth;
    return h_flex().h(LINE).w_full().min_w(width).flex_none().px(10).gap(8).items_center()
      .bg(file.path === this.selectedPath ? t.selected : t.raised).border_b(1).border_color(t.border)
      .child(div().flex_1().min_w(0).truncate().font_semibold().child(file.path))
      .when(Boolean(file.fresh), e => e.child(div().text_size(typography.codeSize).px(5).py(1).rounded(4).border_1().border_color(t.border).text_color(t.dim).child("untracked")))
      .child(div().text_size(typography.codeSize).font_semibold().text_color(status).child(file.status ?? "M"))
      .child(div().text_size(typography.codeSize).text_color(t.git_added ?? t.ansi2).child(`+${file.add ?? 0}`))
      .child(div().text_size(typography.codeSize).text_color(t.git_deleted ?? t.ansi1).child(`−${file.del ?? 0}`));
  }

  unifiedRow(row, t, typography) {
    if (row.type === "file") return this.fileHeader(row.file, t, typography);
    if (row.type === "file-gap") return div().h(LINE).w_full().min_w(this.diffWidth).flex_none().bg(t.background);
    if (row.type === "message") return h_flex().h(LINE).w_full().min_w(this.diffWidth).flex_none().px(12).items_center().text_color(t.dim).child(row.text);
    if (row.type === "gap") return h_flex().h(LINE).w_full().min_w(this.diffWidth).flex_none().px(8).items_center().bg(t.raised).child(div().text_size(typography.codeSize).text_color(t.dim).child("···"));
    const add = row.kind === "+", del = row.kind === "-", color = add ? t.diff_added : del ? t.diff_deleted : t.dim;
    return h_flex().h(LINE).w_full().min_w(this.diffWidth).flex_none()
      .when(Boolean(this.tint(row.kind, t)), (e) => e.bg(this.tint(row.kind, t)))
      .child(div().w(2).flex_none().bg(add ? t.diff_added : del ? t.diff_deleted : t.background))
      .child(this.number(row.old, add ? t.dim : del ? t.diff_deleted : t.dim, typography))
      .child(this.number(row.new, add ? t.diff_added : del ? t.dim : t.dim, typography))
      .child(div().w(18).flex_none().text_center().font_semibold().text_color(color).child(add ? "+" : del ? "−" : " "))
      .child(this.codeCell(row.text, row.sourceFile?.syntax?.[add ? "new" : del ? "old" : "new"]?.get(add ? row.new : del ? row.old : row.new ?? row.old), t.foreground));
  }

  splitPaneRow(row, side, t, typography) {
    if (row.type === "gap") return h_flex().h(LINE).w_full().flex_none().px(8).items_center().bg(t.raised).child(div().text_size(typography.codeSize).text_color(t.dim).child("···"));
    const line = row[side];
    if (!line) return h_flex().h(LINE).w_full().flex_none().bg(t.raised);
    const add = line.kind === "+", del = line.kind === "-", color = add ? t.diff_added : del ? t.diff_deleted : t.dim;
    return h_flex().h(LINE).w_full().flex_none()
      .when(Boolean(this.tint(line.kind, t)), (e) => e.bg(this.tint(line.kind, t)))
      .child(div().w(2).flex_none().bg(add ? t.diff_added : del ? t.diff_deleted : t.background))
      .child(this.number(side === "left" ? line.old : line.new, add ? t.diff_added : del ? t.diff_deleted : t.dim, typography))
      .child(div().w(16).flex_none().text_center().font_semibold().text_color(color).child(add ? "+" : del ? "−" : " "))
      .child(this.codeCell(line.text, row.sourceFile?.syntax?.[side]?.get(side === "left" ? line.old : line.new), line.kind === " " ? t.muted : t.foreground));
  }

  splitRow(row, t, typography) {
    if (row.type === "file") return this.fileHeader(row.file, t, typography, 0);
    if (row.type === "file-gap") return div().h(LINE).w_full().flex_none().bg(t.background);
    if (row.type === "message") return h_flex().h(LINE).w_full().flex_none().px(12).items_center().text_color(t.dim).child(row.text);
    return h_flex().h(LINE).w_full().flex_none().items_stretch()
      .child(div().flex_1().min_w(0).h(LINE).overflow_hidden()
        .child(div().w(this.splitContentWidth).h(LINE).flex_none().relative().left(-this.splitOffset).child(this.splitPaneRow(row, "left", t, typography))))
      .child(div().w(2).h(LINE).flex_none().bg(t.muted))
      .child(div().flex_1().min_w(0).h(LINE).overflow_hidden()
        .child(div().w(this.splitContentWidth).h(LINE).flex_none().relative().left(-this.splitOffset).child(this.splitPaneRow(row, "right", t, typography))));
  }

  splitView(t, typography) {
    const count = this.rows.length;
    const rowKey = index => `${index}:${this.rows[index]?.type ?? "line"}`;
    return v_flex().size_full().min_h(0).relative()
      .on_size_change((size, cx) => {
        const width = size.width / 2;
        if (Math.abs(width - this.splitViewportWidth) > 0.5) {
          this.splitViewportWidth = width;
          this.splitOffset = Math.min(this.splitOffset, Math.max(0, this.splitContentWidth - width));
          cx.notify();
        }
      })
      .on_scroll_wheel((event, cx) => {
        if (!event.modifiers.shift) return;
        const delta = event.delta.x !== 0 ? event.delta.x : -event.delta.y;
        if (!delta) return;
        this.splitOffset = Math.max(0, Math.min(this.splitOffset + delta, Math.max(0, this.splitContentWidth - this.splitViewportWidth)));
        cx.stop_propagation();
        cx.notify();
      })
      .child(v_virtual_list("mide-diff-split", count, LINE, rowKey,
        range => this.rows.slice(range.start, range.end).map(row => this.splitRow(row, t, typography)))
        .track_scroll(this.scroll).size_full())
      .child(Scrollbar.vertical("mide-diff-split").viewport_from_layout().absolute().top(0).right(0).bottom(12).w(12));
  }

  unifiedView(t, typography) {
    const count = this.rows.length;
    return v_flex().size_full().min_h(0).items_stretch().relative()
      .child(div().id("mide-diff-unified-x").size_full().overflow_x_scrollbar().mode("hover")
        .child(div().w_full().min_w(this.diffWidth).h_full()
          .child(v_virtual_list("mide-diff-unified", count, LINE, index => `${index}:${this.rows[index]?.type ?? "line"}`,
            range => this.rows.slice(range.start, range.end).map(row => this.unifiedRow(row, t, typography)))
            .track_scroll(this.scroll).size_full())))
      .child(Scrollbar.vertical("mide-diff-unified").viewport_from_layout().absolute().top(0).right(0).bottom(12).w(12));
  }

  emptyState(label, t, typography) {
    return v_flex().size_full().items_center().justify_center().gap(8)
      .child(div().font_family(typography.uiFont).text_size(typography.uiSize).text_color(t.muted).child(label));
  }

  render(cx) {
    const host = theme(), t = { ...host, ...gitColors, background: host.chrome }, typography = typographySettings(), request = this.request;
    const added = this.files.reduce((total, file) => total + (file.add ?? 0), 0);
    const deleted = this.files.reduce((total, file) => total + (file.del ?? 0), 0);
    const rootName = request?.root?.split(/[\\/]/).filter(Boolean).pop() ?? "Project";
    const fileTitle = request?.title ?? (request ? String(request.selectedPath ?? request.path ?? request.files?.[0]?.path ?? rootName).split(/[\\/]/).pop() : "Project Diff");
    const noDiff = Boolean(request && !this.busy && !this.error
      && !this.files.some(file => file.error || file.combined || file.binary || file.fresh || file.hunks?.length));
    const root = v_flex().id("mide-diff").size_full().min_h(0).rounded(10).overflow_hidden().bg(t.background).border_1().border_color(t.border).text_color(t.foreground).font_family(typography.uiFont).text_size(typography.uiSize).track_focus(this.handle)
      .on_key_down((e, cx) => {
        if (e.key === "r" && e.modifiers.platform) { this.load(cx); cx.stop_propagation(); }
      })
      .on_size_change((size, cx) => {
        const mode = size.width < SPLIT_MIN_WIDTH ? "unified" : "split";
        if (mode !== this.mode) {
          this.mode = mode;
          this.build();
          if (this.selectedPath) this.scroll.scroll_to_item(this.fileRows.get(this.selectedPath) ?? 0);
          cx.notify();
        }
      });
    if (noDiff) return root.child(this.emptyState("No diff to display.", t, typography));
    return root
       .child(h_flex().h(40).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border)
        .child(div().min_w(0).truncate().font_semibold().child(fileTitle))
        .child(div().text_size(typography.text(11)).text_color(t.git_added ?? t.ansi2).child(`+${added}`))
        .child(div().text_size(typography.text(11)).text_color(t.git_deleted ?? t.ansi1).child(`−${deleted}`))
        .child(div().flex_1().min_w(0))
        .child(h_flex().h(24).flex_none().gap(1).p(1).rounded(6).border_1().border_color(t.border)
          .child(this.modeButton("split", "Split", t, typography)).child(this.modeButton("unified", "Unified", t, typography)))
        .child(div().id("mide-diff-refresh").size(24).flex_none().flex().items_center().justify_center().rounded(5).text_color(t.muted).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)).tooltip("Refresh diff").accessibility_label("Refresh diff").on_click((_e, cx) => this.load(cx)).child(svg("frame/settings/refresh.svg").size(14))))
         .when(!request, (e) => e.child(this.emptyState("Open a changed file from Changes to view the project diff.", t, typography)))
        .when(Boolean(request), (e) => e
          .child(div().flex_1().min_h(0).relative().font_family(typography.codeFont).text_size(typography.codeSize)
            .when(this.busy && !this.rows.length, (el) => el.child(v_flex().size_full().items_center().justify_center().font_family(typography.uiFont).text_size(typography.uiSize).text_color(t.dim).child("Loading diff…")))
            .when(!this.busy && Boolean(this.error), (el) => el.child(v_flex().size_full().p(12).gap(6).font_family(typography.uiFont).text_size(typography.uiSize).text_color(t.ansi1).child("Cannot read this diff").child(div().text_size(typography.text(11)).text_color(t.dim).child(this.error))))
            .when(!this.busy && !this.error && !this.files.length, el => el.child(this.emptyState("No changed files to compare.", t, typography)))
            .when(!this.error && this.rows.length > 0, el => el.child(this.mode === "split" ? this.splitView(t, typography) : this.unifiedView(t, typography))))
         .when(this.limited, (e) => e.child(div().px(12).py(3).text_size(typography.text(10)).text_color(t.dim).child("Diff truncated for speed")))
         .child(h_flex().h(24).flex_none().px(12).gap(8).items_center().border_t(1).border_color(t.border).text_size(typography.text(10)).text_color(t.dim)
          .child(div().flex_1().min_w(0).truncate().child(this.selectedPath ?? request?.root ?? "mIDE Diff"))));
  }

  async close(_cx) {
    this.watching = false;
    this.scroll?.release();
  }
}
