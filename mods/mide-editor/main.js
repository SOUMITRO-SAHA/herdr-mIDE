// mIDE Editor — the minimal editor pane. Opens a file (props: { file }),
// edits it with syntax highlighting, saves with cmd-s (mide-editor.save)
// with Ayu syntax highlighting and Herdr's UI theme.
//
// Vim note: Herdr's built-in EditorState exposes value()/set_value() but no
// cursor or selection API, so modal editing arrives as a custom editor core
// (ROADMAP Phase 1).
import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, Editor, EditorState, TextView, Checkbox, Popover } from "gpui-base";
import { props, theme, settings, shared, setShared, readTextFile, writeTextFile, nextCommand } from "herdr";
import { languageFor, syntaxPalette } from "./_shared/syntax.js";

const MAX = 400000;
const WORD_WRAP_SETTING = "mide.editor.word_wrap";
const MARKDOWN_PREVIEW_SETTING = "mide.editor.markdown_preview_default";
const EDITOR_REQUEST = "mide.editor.request";
const editorTypography = () => {
  const current = settings();
  const uiSize = current.ui_font_size ?? 13;
  return {
    font: current.font_family ?? "JetBrains Mono",
    size: current.font_size ?? 14,
    uiFont: current.ui_font_family ?? "Geist",
    uiSize,
    text: base => base * uiSize / 13,
  };
};
export default class MideEditor extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.code = null; this.file = null; this.baseline = null; this.truncated = false; this.dirty = false; this.error = null; this.saving = false; this.note = null; this.drafts = new Map(); this.markdownPreviewDefault = shared(MARKDOWN_PREVIEW_SETTING) === true; this.editorMode = this.markdownPreviewDefault ? "preview" : "raw"; this.settingsOpen = false; this.wordWrap = shared(WORD_WRAP_SETTING) === true;
    this.load(props()?.file ?? null, cx);
    cx.spawn(async cx => {
      for (;;) {
        const command = await nextCommand();
        const name = typeof command === "string" ? command : command?.name;
        if (name === "save") this.save(cx);
        else if (name === "open") this.openFile(shared(EDITOR_REQUEST)?.file ?? null, cx);
        cx.notify();
      }
    });
  }

  createCode(value, file) {
    const code = EditorState.new({ language: languageFor(file), value,
      soft_wrap: this.wordWrap, syntax: syntaxPalette() });
    code.on("change", (_e, cx) => {
      if (this.code !== code) return;
      this.dirty = true; cx.notify();
    });
    return code;
  }

  load(file, cx) {
    this.code?.release(); this.code = null;
    this.markdownPreviewDefault = shared(MARKDOWN_PREVIEW_SETTING) === true;
    this.editorMode = this.markdownPreviewDefault ? "preview" : "raw";
    this.wordWrap = shared(WORD_WRAP_SETTING) === true;
    this.file = file ?? null; this.baseline = null; this.truncated = false; this.dirty = false; this.error = null; this.note = null;
    if (!file) return;
    const draft = this.drafts.get(file);
    if (draft) {
      this.baseline = draft.baseline; this.truncated = draft.truncated; this.dirty = true;
      this.code = this.createCode(draft.value, file);
      cx.notify();
      return;
    }
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

  openFile(file, cx) {
    if (!file || file === this.file) return;
    if (this.dirty && this.code && this.file) {
      this.drafts.set(this.file, { value: this.code.value(), baseline: this.baseline, truncated: this.truncated });
    }
    this.load(file, cx);
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
        if (this.file === file) { this.dirty = false; this.baseline = value; this.drafts.delete(file); }
      } catch (e) { if (this.file === file) this.note = `Save failed: ${e}`; }
      finally { this.saving = false; cx.notify(); }
    });
    cx.notify();
  }

  async close(_cx) {
    this.code?.release();
  }

  setWordWrap(enabled, cx) {
    enabled = Boolean(enabled);
    if (enabled === this.wordWrap) return;
    this.wordWrap = enabled;
    setShared(WORD_WRAP_SETTING, enabled);
    if (this.code && this.file) {
      const previous = this.code;
      this.code = this.createCode(previous.value(), this.file);
      previous.release();
    }
    cx.notify();
  }

  wordWrapOption(t, typography) {
    const checked = this.wordWrap;
    return h_flex().id("mide-editor-word-wrap-option").h(30).flex_none().px(8).gap(8).items_center().rounded(5)
      .hover(s => s.bg(t.hover))
      .child(Checkbox.new("mide-editor-word-wrap").w(14).h(14).flex_none().checked(checked)
        .accessibility_label("Word wrap")
        .on_click((_e, cx) => cx.stop_propagation())
        .on_change((value, cx) => this.setWordWrap(value, cx))
        .child(div().size(14).flex().items_center().justify_center().rounded(3).border_1()
          .border_color(checked ? t.accent : t.border).bg(checked ? t.accent : t.background)
          .text_size(typography.text(10)).font_semibold().text_color(t.background).child(checked ? "✓" : "")))
      .child(div().flex_1().text_size(typography.text(11)).text_color(t.foreground).cursor_pointer()
        .on_click((_e, cx) => this.setWordWrap(!this.wordWrap, cx)).child("Word wrap"));
  }

  markdownPreviewOption(t, typography) {
    const checked = this.markdownPreviewDefault;
    return h_flex().id("mide-editor-markdown-preview-option").h(32).flex_none().px(8).gap(8).items_center().rounded(5)
      .hover(s => s.bg(t.hover))
      .child(Checkbox.new("mide-editor-markdown-preview-default").w(14).h(14).flex_none().checked(checked)
        .accessibility_label("Open Markdown in Preview by default")
        .on_click((_e, cx) => cx.stop_propagation())
        .on_change((value, cx) => this.setMarkdownPreviewDefault(value, cx))
        .child(div().size(14).flex().items_center().justify_center().rounded(3).border_1()
          .border_color(checked ? t.accent : t.border).bg(checked ? t.accent : t.background)
          .text_size(typography.text(10)).font_semibold().text_color(t.background).child(checked ? "✓" : "")))
      .child(div().flex_1().text_size(typography.text(11)).text_color(t.foreground).cursor_pointer()
        .on_click((_e, cx) => this.setMarkdownPreviewDefault(!this.markdownPreviewDefault, cx))
        .child("Open Markdown in Preview by default"));
  }

  setMarkdownPreviewDefault(enabled, cx) {
    this.markdownPreviewDefault = Boolean(enabled);
    setShared(MARKDOWN_PREVIEW_SETTING, this.markdownPreviewDefault);
    if (languageFor(this.file ?? "") === "markdown") this.editorMode = this.markdownPreviewDefault ? "preview" : "raw";
    cx.notify();
  }

  markdownTab(mode, label, t, typography) {
    const active = this.editorMode === mode;
    return div().id(`mide-editor-${mode}`).h(22).px(8).flex().items_center().rounded(5).text_size(typography.text(10))
      .text_color(active ? t.foreground : t.muted)
      .when(active, el => el.bg(t.selected))
      .when(!active, el => el.cursor_pointer().hover(s => s.bg(t.hover)).on_click((_e, cx) => { this.editorMode = mode; cx.notify(); }))
      .child(label);
  }

  render(cx) {
    const host = theme(), t = { ...host, background: host.chrome }, name = this.file?.split(/[\\/]/).pop();
    const typography = editorTypography(), markdown = languageFor(this.file ?? "") === "markdown";
    return v_flex().id("mide-editor").size_full().min_h(0).rounded(10).overflow_hidden().bg(t.background).border_1().border_color(t.border).text_color(t.foreground).font_family(typography.uiFont).text_size(typography.uiSize).track_focus(this.handle)
      .child(h_flex().h(36).flex_none().px(12).gap(8).items_center().border_b(1).border_color(t.border)
        .child(div().flex_1().min_w(0).truncate().font_semibold().child(name ?? "No file"))
        .when(this.dirty, el => el.child(div().id("mide-editor-dirty").text_size(typography.text(11)).text_color(t.blocked).child("●")))
        .when(markdown, el => el.child(h_flex().h(24).flex_none().p(2).gap(2).rounded(6).bg(t.raised)
          .child(this.markdownTab("raw", "Raw", t, typography))
          .child(this.markdownTab("preview", "Preview", t, typography))))
        .child(Popover.new("mide-editor-settings-menu").open(this.settingsOpen).anchor("top_right")
          .on_open_change((open, cx) => { this.settingsOpen = open; cx.notify(); })
          .trigger(div().id("mide-editor-settings-trigger").size(24).flex_none().flex().items_center().justify_center().rounded(5)
            .border_1().border_color(t.border).text_size(typography.text(10)).text_color(t.muted).cursor_pointer()
            .hover(s => s.bg(t.hover).text_color(t.foreground)).accessibility_label("Editor settings")
            .child(svg("mods/mide-files/icons/settings.svg").size(14).flex_none()))
          .content(v_flex().w(240).p(6).gap(2).rounded(7).border_1().border_color(t.border).bg(t.chrome)
            .child(div().px(8).py(5).text_size(typography.text(10)).font_semibold().text_color(t.muted).child("EDITOR SETTINGS"))
            .child(this.wordWrapOption(t, typography))
            .child(this.markdownPreviewOption(t, typography)))))
      .child(this.file
        ? (this.code
            ? markdown && this.editorMode === "preview"
              ? h_flex().id("mide-editor-markdown-preview").flex_1().min_h(0).min_w(0).justify_center().bg(t.background)
                .child(TextView.markdown("mide-editor-markdown-document", this.code.value()).selectable(true).scrollable(true)
                  .flex_1().min_h(0).min_w(0).max_w(1040).p(24)
                  .font_family(typography.uiFont).text_size(typography.size).font_weight(400).line_height(1.65))
              : Editor.new(this.code).flex_1().min_h(0).font_family(typography.font).text_size(typography.size)
            : div().flex_1().min_h(0).p(12).text_color(t.dim).child(this.error || "Loading file…"))
        : div().flex_1().min_h(0).p(12).text_color(t.dim).child("No file open. Click a file in Files to edit it here."))
      .when(Boolean(this.note), el => el.child(
        h_flex().px(12).py(4).gap(10).text_size(typography.text(11)).text_color(t.ansi1)
          .child(div().flex_1().min_w(0).truncate().child(this.note))
          .when(this.file && !this.saving, row => row.child(
            div().id("mide-editor-reload").flex_none().cursor_pointer().underline()
              .child("Reload (discard draft)")
              .on_click((_e, cx) => {
                this.drafts.delete(this.file);
                this.load(this.file, cx);
              }),
          )),
      ))
      .child(h_flex().h(28).flex_none().px(12).gap(8).items_center().border_t(1).border_color(t.border).text_size(typography.text(11)).text_color(t.dim)
        .child(div().flex_1().min_w(0).truncate().child(this.file ?? ""))
        .child(div().child("⌘S save")));
  }
}
