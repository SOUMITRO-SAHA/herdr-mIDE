// mIDE Diff — a dedicated git diff tab. The Changes panel opens it with
// { root, path, side, status, fresh, on, branch }; it renders both sides of
// the index and toggles between reference-style split and unified views.
//
// Reads use the same no-write git flags as the Changes panel, so the folder
// watcher never sees the diff itself and starts a refresh loop.
import { View, div } from "gpui-kit";
import { v_flex, h_flex, Scrollbar, VirtualListScrollHandle, v_virtual_list } from "gpui-base";
import { props, shared, exec, readTextFile, watchFolder, theme, settings, focused, run, nextCommand } from "herdr";

const READ = ["--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "diff.autoRefreshIndex=false"];
const MAX_LINES = 6000, MAX_TEXT = 600000, LINE = 20;
const countLines = (text) => text ? text.split("\n").length - Number(text.endsWith("\n")) : 0;

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

// Every hunk is one excerpt: a dim ⋯ band before it, then its rows. the reference IDE has no
// GitHub-style @@ band; the band is only a visual break between excerpts.
function unifiedRows(hunks) {
  const rows = [], hunkRows = [];
  hunks.forEach((hunk, index) => {
    if (index) rows.push({ type: "gap" });
    hunkRows.push(rows.length);
    for (const line of hunk.lines) rows.push({ type: "line", ...line });
  });
  return { rows, hunkRows };
}

// Pair a run of deletions with additions, the reference IDE's split view. The shorter side
// gets raised spacer rows so both halves stay aligned.
function splitRows(hunks) {
  const rows = [], hunkRows = [];
  hunks.forEach((hunk, index) => {
    if (index) rows.push({ type: "gap" });
    hunkRows.push(rows.length);
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
  return { rows, hunkRows };
}

export default class MideDiff extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.scroll = VirtualListScrollHandle.new();
    this.request = null; this.sides = {}; this.rows = []; this.hunkRows = []; this.hunk = 0;
    this.diffWidth = 0; this.splitWidth = 0;
    this.side = "work"; this.mode = "split"; this.busy = false; this.error = null; this.watching = false; this.limited = false;
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

  has(side) {
    const result = this.sides?.[side];
    return Boolean(result && !result.error && !result.combined && (result.hunks.length || result.binary));
  }

  open(request, cx) {
    if (!request?.root || !request?.path) return;
    this.request = request;
    this.side = request.side === "index" ? "index" : "work";
    if (request.mode === "split" || request.mode === "unified") this.mode = request.mode;
    this.sides = {}; this.rows = []; this.hunkRows = []; this.hunk = 0;
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

  async sideDiff(side) {
    const { root, path, on, fresh } = this.request;
    if (fresh && side === "work") {
      const text = await readTextFile(`${root}/${path}`, { on }).catch(() => null);
      if (text === null) return { error: "Cannot read this file", hunks: [], add: 0, del: 0 };
      if (text.includes("\0")) return { hunks: [], add: 0, del: 0, binary: true };
      const lines = text.slice(0, MAX_TEXT).replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
      if (text === "") return { hunks: [], add: 0, del: 0 };
      const kept = lines.slice(0, MAX_LINES).map((line) => line.length > 4000 ? line.slice(0, 4000) + "…" : line);
      const parsed = parseDiff(`@@ -0,0 +1,${countLines(text)} @@\n${kept.map((line) => `+${line}`).join("\n")}`);
      return { ...parsed, truncated: parsed.truncated || lines.length > kept.length };
    }
    const result = await exec("git", [...READ, "diff", ...(side === "index" ? ["--cached"] : []), "--no-ext-diff", "--no-textconv", "--no-color", "--unified=3", "--", path], { cwd: root, on });
    if (result.code !== 0) return { error: (result.stderr || result.stdout).trim(), hunks: [], add: 0, del: 0 };
    return parseDiff(result.stdout);
  }

  async load(cx) {
    const request = this.request;
    if (!request) return;
    if (this.busy) return;
    this.busy = true; this.error = null;
    try {
      const [index, work] = await Promise.all([this.sideDiff("index"), this.sideDiff("work")]);
      if (this.request !== request) return;
      this.sides = { index, work };
      if (!this.has(this.side)) this.side = this.has(this.side === "index" ? "work" : "index") ? (this.side === "index" ? "work" : "index") : this.side;
      this.limited = Boolean(index.truncated || work.truncated);
      this.build();
    } catch (e) { if (this.request === request) this.error = String(e); }
    finally { this.busy = false; cx.notify(); }
  }

  build() {
    const result = this.sides?.[this.side];
    const built = result && !result.error && !result.combined
      ? (this.mode === "split" ? splitRows(result.hunks) : unifiedRows(result.hunks))
      : { rows: [], hunkRows: [] };
    this.rows = built.rows; this.hunkRows = built.hunkRows;
    this.hunk = Math.max(0, Math.min(this.hunk, this.hunkRows.length - 1));
    // Long lines scroll sideways instead of being cut off. Split needs a
    // width for each half; unified needs one for the whole row.
    const longest = this.rows.reduce((n, row) => Math.max(n,
      (row.text ?? "").length, (row.left?.text ?? "").length, (row.right?.text ?? "").length), 0);
    this.diffWidth = Math.max(400, Math.min(2400, longest * 7 + 150));
    this.splitWidth = Math.max(300, Math.min(1600, longest * 7 + 96));
  }

  setSide(side, cx) {
    if (!this.has(side) || this.side === side) return;
    this.side = side; this.hunk = 0; this.build(); this.scroll.scroll_to_item(0); cx.notify();
  }

  setMode(mode, cx) {
    if (this.mode === mode) return;
    this.mode = mode; this.build(); this.scroll.scroll_to_item(0); cx.notify();
  }

  goHunk(delta, cx) {
    if (!this.hunkRows.length) return;
    this.hunk = (this.hunk + delta + this.hunkRows.length) % this.hunkRows.length;
    this.scroll.scroll_to_item(this.hunkRows[this.hunk], "top");
    cx.notify();
  }

  closeTab() {
    run("tab.close", { id: focused()?.tab });
  }

  sideLabel(side) {
    if (this.request?.fresh && side === "work") return "Untracked";
    return side === "index" ? "Staged" : "Unstaged";
  }

  sideButton(side, t) {
    const active = this.side === side, available = this.has(side);
    return div().id(`mide-diff-side-${side}`).h(22).px(8).flex().items_center().rounded(5).text_size(10).font_semibold()
      .text_color(active ? t.foreground : available ? t.muted : t.dim)
      .when(active, (e) => e.bg(t.selected))
      .when(available && !active, (e) => e.cursor_pointer().hover((s) => s.bg(t.hover)).on_click((_e, cx) => this.setSide(side, cx)))
      .child(this.sideLabel(side));
  }

  modeButton(mode, label, t) {
    const active = this.mode === mode;
    return div().id(`mide-diff-mode-${mode}`).h(22).px(8).flex().items_center().rounded(5).text_size(10)
      .text_color(active ? t.foreground : t.muted)
      .when(active, (e) => e.bg(t.selected))
      .when(!active, (e) => e.cursor_pointer().hover((s) => s.bg(t.hover)).on_click((_e, cx) => this.setMode(mode, cx)))
      .child(label);
  }

  number(value, color) {
    return div().w(42).flex_none().pr(6).text_right().text_size(10).text_color(color).child(value === null || value === undefined ? "" : String(value));
  }

  tint(kind, t) {
    if (kind === "+") return this.side === "index" ? t.ansi2 + "10" : t.ansi2 + "1e";
    if (kind === "-") return this.side === "index" ? t.ansi1 + "10" : t.ansi1 + "1e";
    return null;
  }

  unifiedRow(row, t) {
    if (row.type === "gap") return h_flex().h(LINE).w_full().flex_none().px(8).items_center().bg(t.raised).child(div().text_size(10).text_color(t.dim).child("···"));
    const add = row.kind === "+", del = row.kind === "-", color = add ? t.ansi2 : del ? t.ansi1 : t.dim;
    return h_flex().h(LINE).w_full().flex_none()
      .when(Boolean(this.tint(row.kind, t)), (e) => e.bg(this.tint(row.kind, t)))
      .child(div().w(2).flex_none().bg(add ? t.ansi2 : del ? t.ansi1 : t.background))
      .child(this.number(row.old, add ? t.dim : del ? t.ansi1 : t.dim))
      .child(this.number(row.new, add ? t.ansi2 : del ? t.dim : t.dim))
      .child(div().w(18).flex_none().text_center().font_semibold().text_color(color).child(add ? "+" : del ? "−" : " "))
      .child(div().flex_1().min_w(0).truncate().child(row.text));
  }

  splitSide(line, side, t) {
    if (!line) return h_flex().flex_1().min_w(0).bg(t.raised);
    const add = line.kind === "+", del = line.kind === "-", color = add ? t.ansi2 : del ? t.ansi1 : t.dim;
    return h_flex().flex_1().min_w(0)
      .when(Boolean(this.tint(line.kind, t)), (e) => e.bg(this.tint(line.kind, t)))
      .child(div().w(2).flex_none().bg(add ? t.ansi2 : del ? t.ansi1 : t.background))
      .child(this.number(side === "left" ? line.old : line.new, add ? t.ansi2 : del ? t.ansi1 : t.dim))
      .child(div().w(16).flex_none().text_center().font_semibold().text_color(color).child(add ? "+" : del ? "−" : " "))
      .child(div().flex_1().min_w(0).truncate().text_color(line.kind === " " ? t.muted : t.foreground).child(line.text));
  }

  splitRow(row, t) {
    if (row.type === "gap") return h_flex().h(LINE).w_full().flex_none().px(8).items_center().bg(t.raised).child(div().text_size(10).text_color(t.dim).child("···"));
    return h_flex().h(LINE).w_full().flex_none()
      .child(this.splitSide(row.left, "left", t))
      .child(div().w(1).flex_none().bg(t.border))
      .child(this.splitSide(row.right, "right", t));
  }

  emptyState(label, t) {
    return v_flex().size_full().items_center().justify_center().gap(8)
      .child(div().text_color(t.muted).child(label))
      .child(div().id("mide-diff-close").h(26).px(12).flex().items_center().rounded(6).border_1().border_color(t.border).text_size(11).text_color(t.muted).cursor_pointer().hover((s) => s.bg(t.hover)).on_click(() => this.closeTab()).child("Close"));
  }

  render(cx) {
    const t = theme(), request = this.request;
    const result = this.sides?.[this.side];
    const add = result?.add ?? 0, del = result?.del ?? 0;
    const parts = request?.path?.split("/") ?? [], name = parts.pop() ?? "No file", parent = parts.join("/");
    const status = request?.status === "A" ? (t.git_added ?? t.ansi2) : request?.status === "D" || request?.status === "U" ? (t.git_deleted ?? t.ansi1) : (t.git_modified ?? t.ansi3);
    return v_flex().id("mide-diff").size_full().min_h(0).rounded(10).overflow_hidden().bg(t.background).border_1().border_color(t.border).text_color(t.foreground).text_size(13).track_focus(this.handle)
      .on_key_down((e, cx) => {
        if (e.key === "f8" && e.modifiers.platform) { this.goHunk(e.modifiers.shift ? -1 : 1, cx); cx.stop_propagation(); }
        if (e.key === "r" && e.modifiers.platform) { this.load(cx); cx.stop_propagation(); }
      })
      .child(h_flex().h(40).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border)
        .child(div().text_size(9).px(6).py(1).rounded(4).font_semibold().bg(t.raised).text_color(t.muted).child("DIFF"))
        .child(div().font_semibold().truncate().child(name))
        .child(div().flex_1().min_w(0).truncate().text_size(11).text_color(t.dim).child(parent))
        .when(Boolean(request?.fresh), (e) => e.child(div().text_size(9).px(5).py(1).rounded(4).border_1().border_color(t.border).text_color(t.dim).child("untracked")))
        .child(div().w(14).text_size(11).font_semibold().text_color(status).child(request?.status ?? "M"))
        .child(div().text_size(11).text_color(t.git_added ?? t.ansi2).child(`+${add}`))
        .child(div().text_size(11).text_color(t.git_deleted ?? t.ansi1).child(`−${del}`))
        .child(div().id("mide-diff-close-top").h(22).px(7).flex().items_center().rounded(5).text_size(10).text_color(t.dim).cursor_pointer().hover((s) => s.bg(t.hover)).on_click(() => this.closeTab()).child("Close")))
      .child(h_flex().h(32).flex_none().px(8).gap(8).items_center().border_b(1).border_color(t.border)
        .child(h_flex().h(24).flex_none().gap(1).p(1).rounded(6).border_1().border_color(t.border)
          .child(this.sideButton("work", t)).child(this.sideButton("index", t)))
        .child(div().flex_1())
        .when(this.hunkRows.length > 1, (e) => e.child(h_flex().flex_none().items_center().gap(2)
          .child(div().text_size(10).text_color(t.dim).child(`${this.hunk + 1}/${this.hunkRows.length}`))
          .child(div().id("mide-diff-prev").h(22).px(7).flex().items_center().rounded(5).text_size(10).text_color(t.muted).cursor_pointer().hover((s) => s.bg(t.hover)).on_click((_e, cx) => this.goHunk(-1, cx)).child("Prev"))
          .child(div().id("mide-diff-next").h(22).px(7).flex().items_center().rounded(5).text_size(10).text_color(t.muted).cursor_pointer().hover((s) => s.bg(t.hover)).on_click((_e, cx) => this.goHunk(1, cx)).child("Next"))))
        .child(h_flex().h(24).flex_none().gap(1).p(1).rounded(6).border_1().border_color(t.border)
          .child(this.modeButton("split", "Split", t)).child(this.modeButton("unified", "Unified", t)))
        .child(div().id("mide-diff-refresh").h(22).px(7).flex().items_center().rounded(5).text_size(10).text_color(t.muted).cursor_pointer().hover((s) => s.bg(t.hover)).on_click((_e, cx) => this.load(cx)).child("Refresh")))
      .when(!request, (e) => e.child(this.emptyState("Open a file from Changes to view its diff.", t)))
      .when(Boolean(request), (e) => e
        .child(div().flex_1().min_h(0).relative().font_family(settings().font_family ?? "JetBrains Mono").text_size(12)
          .when(this.busy && !this.rows.length, (el) => el.child(v_flex().size_full().items_center().justify_center().text_color(t.dim).child("Loading diff…")))
          .when(!this.busy && Boolean(this.error), (el) => el.child(v_flex().size_full().p(12).gap(6).text_color(t.ansi1).child("Cannot read this diff").child(div().text_size(11).text_color(t.dim).child(this.error))))
          .when(!this.busy && !this.error && Boolean(result?.error), (el) => el.child(v_flex().size_full().p(12).gap(6).text_color(t.ansi1).child("Cannot read this side of the diff").child(div().text_size(11).text_color(t.dim).child(result.error))))
          .when(!this.busy && !this.error && !result?.error && Boolean(result?.combined), (el) => el.child(this.emptyState("Conflict diffs are not shown yet.", t)))
          .when(!this.busy && !this.error && !result?.error && !result?.combined && Boolean(result?.binary), (el) => el.child(this.emptyState("Binary file not shown.", t)))
          .when(!this.busy && !this.error && !result?.error && !result?.combined && !result?.binary && !this.rows.length, (el) => el.child(this.emptyState(`No ${this.side === "index" ? "staged" : this.request?.fresh ? "untracked" : "unstaged"} changes.`, t)))
          .when(!this.error && !result?.error && !result?.combined && !result?.binary && Boolean(this.rows.length), (el) => el
            .child(div().id("mide-diff-x").size_full().overflow_x_scrollbar()
              .child(div().w_full().min_w(this.mode === "unified" ? this.diffWidth : this.splitWidth * 2 + 1).h_full().child(v_virtual_list("mide-diff", this.rows.length, LINE, (i) => String(i),
                (range) => this.rows.slice(range.start, range.end).map((row) => this.mode === "split" ? this.splitRow(row, t) : this.unifiedRow(row, t))).track_scroll(this.scroll).size_full())))
            .child(Scrollbar.vertical("mide-diff").viewport_from_layout().absolute().inset_0())))
      .when(this.limited, (e) => e.child(div().px(12).py(3).text_size(10).text_color(t.dim).child("Diff truncated for speed")))
      .child(h_flex().h(24).flex_none().px(12).gap(8).items_center().border_t(1).border_color(t.border).text_size(10).text_color(t.dim)
        .child(div().flex_1().min_w(0).truncate().child(request?.path ?? "mIDE Diff"))
        .when(this.hunkRows.length > 1, (e) => e.child("⌘F8 next hunk"))));
  }

  async close(_cx) {
    this.watching = false;
    this.scroll?.release();
  }
}
