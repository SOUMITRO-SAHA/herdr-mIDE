// mIDE Editor — the minimal editor pane. Opens a file (props: { file }),
// edits it with syntax highlighting, saves with cmd-s (mide-editor.save)
// with Ayu syntax highlighting and Herdr's UI theme.
//
// Vim note: Herdr's built-in EditorState exposes value()/set_value() but no
// cursor or selection API, so modal editing arrives as a custom editor core
// (ROADMAP Phase 1).
import { View, div } from "gpui-kit";
import { v_flex, h_flex, Editor, EditorState, TextView } from "gpui-base";
import { props, theme, settings, readTextFile, writeTextFile, nextCommand } from "herdr";
import { ayuSyntax } from "./palette.js";

const LANG = { ts: "js", tsx: "js", mts: "js", cts: "js", jsx: "js", mjs: "js", cjs: "js", jsonc: "json", md: "markdown", markdown: "markdown", mdown: "markdown", mkd: "markdown", svelte: "html", vue: "html", yaml: "toml" };
const MAX = 400000;
const languageFor = (file) => {
  const ext = file.includes(".") ? file.split(".").pop().toLowerCase() : "txt";
  return LANG[ext] ?? ext;
};
// Syntax colors come only from our private Ayu palette. Why that theme's
// variable token is the function orange: the host highlighter folds every
// variable.* scope (call names, objects, params, this) into one "variable"
// bucket and leaves properties unstyled, and call names dominate that bucket
// in this repo's fluent style.
const SYNTAX_KEYS = ["keyword", "string", "comment", "function", "type", "number", "constant", "boolean", "variable", "operator", "punctuation", "heading", "markup.raw", "markup.bold", "markup.italic", "link_uri"];
const syntaxFor = (t) => {
  const map = {};
  for (const key of SYNTAX_KEYS) {
    const token = `syntax_${key.replaceAll(".", "_")}`;
    const color = t[token];
    if (color) map[key] = color;
  }
  return map;
};
const editorTypography = () => {
  const current = settings();
  return {
    font: current.font_family ?? "JetBrains Mono",
    size: current.font_size ?? 14,
  };
};
export default class MideEditor extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.code = null; this.file = null; this.baseline = null; this.truncated = false; this.dirty = false; this.error = null; this.saving = false; this.note = null; this.editorMode = "raw";
    this.load(props()?.file ?? null, cx);
    cx.spawn(async cx => {
      for (;;) {
        const command = await nextCommand();
        const name = typeof command === "string" ? command : command?.name;
        if (name === "save") this.save(cx);
        cx.notify();
      }
    });
  }

  createCode(value, file) {
    const code = EditorState.new({ language: languageFor(file), value,
      syntax: syntaxFor(ayuSyntax) });
    code.on("change", (_e, cx) => {
      if (this.code !== code) return;
      this.dirty = true; cx.notify();
    });
    return code;
  }

  load(file, cx) {
    this.code?.release(); this.code = null;
    this.editorMode = "raw";
    this.file = file ?? null; this.baseline = null; this.truncated = false; this.dirty = false; this.error = null; this.note = null;
    if (!file) return;
    cx.spawn(async cx => {
      try {
        const text = await readTextFile(file);
        if (this.file !== file) return;
        if (text === null) { this.error = "This file is no longer available"; return; }
        if (text.includes("\0")) { this.error = "Binary file · nothing to edit"; return; }
        // Baseline = what's on disk right now; save() passes it as the write's
        // expected snapshot, so external edits between load and save are caught.
        this.baseline = text; this.truncated = text.length > MAX;
        this.code = this.createCode(this.truncated ? text.slice(0, MAX) + "\n… (file truncated)" : text, file);
      } catch { if (this.file === file) this.error = "Cannot open this file (binary, too large, or unreadable)"; }
      finally { cx.notify(); }
    });
  }

  save(cx) {
    if (!this.code || !this.file || this.saving) return;
    if (this.truncated) { this.note = "Too large to save here (>400 KB) — editing would drop the rest of the file"; cx.notify(); return; }
    this.saving = true; this.note = null;
    const file = this.file, value = this.code.value(), expected = this.baseline;
    cx.spawn(async cx => {
      try {
        // The host only writes when the disk still matches the snapshot we
        // loaded; on success our draft becomes the new baseline.
        await writeTextFile(file, value, expected);
        if (this.file === file) { this.dirty = false; this.baseline = value; }
      } catch (e) { if (this.file === file) this.note = `Save failed: ${e}`; }
      finally { this.saving = false; cx.notify(); }
    });
    cx.notify();
  }

  async close(_cx) {
    this.code?.release();
  }

  markdownTab(mode, label, t) {
    const active = this.editorMode === mode;
    return div().id(`mide-editor-${mode}`).h(22).px(8).flex().items_center().rounded(5).text_size(10)
      .text_color(active ? t.foreground : t.muted)
      .when(active, el => el.bg(t.selected))
      .when(!active, el => el.cursor_pointer().hover(s => s.bg(t.hover)).on_click((_e, cx) => { this.editorMode = mode; cx.notify(); }))
      .child(label);
  }

  render(cx) {
    const host = theme(), t = { ...host, background: host.chrome }, name = this.file?.split(/[\\/]/).pop();
    const typography = editorTypography(), markdown = languageFor(this.file ?? "") === "markdown";
    return v_flex().id("mide-editor").size_full().min_h(0).rounded(10).overflow_hidden().bg(t.background).border_1().border_color(t.border).text_color(t.foreground).text_size(13).track_focus(this.handle)
      .child(h_flex().h(36).flex_none().px(12).gap(8).items_center().border_b(1).border_color(t.border)
        .child(div().flex_1().min_w(0).truncate().font_semibold().child(name ?? "No file"))
        .when(this.dirty, el => el.child(div().id("mide-editor-dirty").text_size(11).text_color(t.blocked).child("●")))
        .when(markdown, el => el.child(h_flex().h(24).flex_none().p(2).gap(2).rounded(6).bg(t.raised)
          .child(this.markdownTab("raw", "Raw", t))
          .child(this.markdownTab("preview", "Preview", t)))))
      .child(this.file
        ? (this.code
            ? markdown && this.editorMode === "preview"
              ? TextView.markdown("mide-editor-markdown-preview", this.code.value()).selectable(true).scrollable(true).flex_1().min_h(0).min_w(0).p(12)
              : Editor.new(this.code).flex_1().min_h(0).font_family(typography.font).text_size(typography.size)
            : div().flex_1().min_h(0).p(12).text_color(t.dim).child(this.error || "Loading file…"))
        : div().flex_1().min_h(0).p(12).text_color(t.dim).child("No file open. Click a file in Files to edit it here."))
      .when(Boolean(this.note), el => el.child(h_flex().px(12).py(4).gap(10).text_size(11).text_color(t.ansi1)
        .child(div().flex_1().min_w(0).truncate().child(this.note))
        .when(this.file && !this.saving, el => el.child(div().id("mide-editor-reload").flex_none().cursor_pointer().underline().child("Reload (discard draft)").on_click((_e, cx) => this.load(this.file, cx))))))
      .child(h_flex().h(28).flex_none().px(12).gap(8).items_center().border_t(1).border_color(t.border).text_size(11).text_color(t.dim)
        .child(div().flex_1().min_w(0).truncate().child(this.file ?? ""))
        .child(div().child("⌘S save")));
  }
}
