// mIDE Editor — the minimal editor pane. Opens a file (props: { file }),
// edits it with syntax highlighting, saves with cmd-s (mide-editor.save)
// and follows Herdr's active theme.
//
// Vim note: Herdr's built-in EditorState exposes value()/set_value() but no
// cursor or selection API, so modal editing arrives as a custom editor core
// (ROADMAP Phase 1). The mode chip and key plumbing below are its landing pad.
import { View, div } from "gpui-kit";
import { v_flex, h_flex, Editor, EditorState } from "gpui-base";
import { props, theme, settings, readTextFile, writeTextFile, nextCommand } from "herdr";

const LANG = { ts: "js", tsx: "js", mts: "js", cts: "js", jsx: "js", mjs: "js", cjs: "js", jsonc: "json", md: "markdown", markdown: "markdown", mdown: "markdown", mkd: "markdown", svelte: "html", vue: "html", yaml: "toml" };
const MAX = 400000;
// One Dark syntax palette — the fallback when the active
// theme doesn't define syntax_* tokens. Themes override per key: a theme
// key "syntax_<name>" wins over this table, so palettes stay manageable
// as theme data instead of mod code.
const ONE_DARK = {
  keyword: "#b477cf", string: "#a1c181", comment: "#5d636f", function: "#73ade9",
  type: "#6eb4bf", number: "#bf956a", constant: "#bf956a", boolean: "#bf956a",
  variable: "#acb2be", operator: "#6eb4bf", punctuation: "#b2b9c6",
  heading: "#d07277", "markup.raw": "#a1c181", "markup.bold": "#bf956a",
  "markup.italic": "#74ade8", link_uri: "#6eb4bf",
};
const SYNTAX_KEYS = Object.keys(ONE_DARK);
const syntaxFor = (t) => {
  const map = {};
  for (const key of SYNTAX_KEYS) map[key] = t[`syntax_${key}`] ?? ONE_DARK[key];
  return map;
};
const codeStyle = (font, t) => JSON.stringify([font, syntaxFor(t)]);

export default class MideEditor extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.code = null; this.codeStyle = null; this.file = null; this.dirty = false; this.error = null; this.saving = false; this.note = null; this.retheming = false;
    this.load(props()?.file ?? null, cx);
    cx.spawn(async cx => {
      for (;;) {
        const command = await nextCommand();
        if (command.name === "save") this.save(cx);
        cx.notify();
      }
    });
  }

  createCode(value, file, t) {
    const font = settings().font_family, ext = file.includes(".") ? file.split(".").pop().toLowerCase() : "txt";
    const code = EditorState.new({ language: LANG[ext] ?? ext, value,
      font_family: font, font_size: 13, syntax: syntaxFor(t) });
    code.on("change", (_e, cx) => {
      if (this.code !== code) return;
      this.dirty = true; cx.notify();
    });
    return { code, style: codeStyle(font, t) };
  }

  syncTheme(cx, t) {
    if (!this.code || this.retheming || this.codeStyle === codeStyle(settings().font_family, theme())) return;
    const old = this.code, file = this.file;
    this.retheming = true;
    cx.spawn(async cx => {
      try {
        if (this.code !== old || this.file !== file) return;
        const value = old.value(), dirty = this.dirty;
        const next = this.createCode(value, file, theme());
        if (this.code !== old || this.file !== file) { next.code.release(); return; }
        this.code = next.code; this.codeStyle = next.style; this.dirty = dirty;
        old.release();
      } finally { this.retheming = false; cx.notify(); }
    });
  }

  load(file, cx) {
    this.code?.release(); this.code = null;
    this.codeStyle = null;
    this.file = file ?? null; this.dirty = false; this.error = null; this.note = null;
    if (!file) return;
    cx.spawn(async cx => {
      try {
        const text = await readTextFile(file);
        if (this.file !== file) return;
        if (text === null) { this.error = "This file is no longer available"; return; }
        if (text.includes("\0")) { this.error = "Binary file · nothing to edit"; return; }
        const next = this.createCode(text.length > MAX ? text.slice(0, MAX) + "\n… (file truncated)" : text, file, theme());
        this.code = next.code; this.codeStyle = next.style;
      } catch { if (this.file === file) this.error = "Cannot open this file (binary, too large, or unreadable)"; }
      finally { cx.notify(); }
    });
  }

  save(cx) {
    if (!this.code || !this.file || this.saving) return;
    this.saving = true; this.note = null;
    const file = this.file, value = this.code.value();
    cx.spawn(async cx => {
      try {
        await writeTextFile(file, value);
        if (this.file === file) this.dirty = false;
      } catch (e) { if (this.file === file) this.note = `Save failed: ${e}`; }
      finally { this.saving = false; cx.notify(); }
    });
    cx.notify();
  }

  async close(_cx) {
    this.code?.release();
  }

  render(cx) {
    const t = theme(), name = this.file?.split(/[\\/]/).pop();
    this.syncTheme(cx, t);
    return v_flex().id("mide-editor").size_full().min_h(0).rounded(10).overflow_hidden().bg(t.background).border_1().border_color(t.border).text_color(t.foreground).text_size(13).track_focus(this.handle)
      .child(h_flex().h(36).flex_none().px(12).gap(8).items_center().border_b(1).border_color(t.border)
        .child(div().text_size(10).px(6).py(1).rounded(4).font_semibold().bg(t.raised).text_color(t.muted).child("EDIT"))
        .child(div().flex_1().min_w(0).truncate().font_semibold().child(name ?? "No file"))
        .when(this.dirty, el => el.child(div().id("mide-editor-dirty").text_size(11).text_color(t.blocked).child("●")))
        .child(div().id("mide-editor-save").h(24).px(10).flex().items_center().rounded(7).bg(this.code && !this.saving ? t.solid : t.raised).text_color(this.code && !this.saving ? t.solid_foreground : t.dim).text_size(12).cursor_pointer().on_click((_e, cx) => this.save(cx)).child(this.saving ? "Saving…" : "Save")))
      .child(this.file
        ? (this.code
            ? Editor.new(this.code).flex_1().min_h(0)
            : div().flex_1().min_h(0).p(12).text_color(t.dim).child(this.error || "Loading file…"))
        : div().flex_1().min_h(0).p(12).text_color(t.dim).child("No file open. Click a file in Files to edit it here."))
      .when(Boolean(this.note), el => el.child(div().px(12).py(4).text_size(11).text_color(t.ansi1).child(this.note)))
      .child(h_flex().h(28).flex_none().px(12).gap(8).items_center().border_t(1).border_color(t.border).text_size(11).text_color(t.dim)
        .child(div().flex_1().min_w(0).truncate().child(this.file ?? ""))
        .child(div().child("⌘S save")));
  }
}
