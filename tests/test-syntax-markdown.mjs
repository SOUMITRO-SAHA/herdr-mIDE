import assert from "node:assert/strict";
import { highlightLines, syntaxEffects, syntaxPalette, syntaxSegments } from "../shared/syntax.js";

// Markdown coloring follows Zed's rules (crates/grammars/src/markdown/
// highlights.scm + markdown-inline/highlights.scm, rendered with Zed's Ayu
// Dark theme): headings are bold text-color "title", fence delimiters and
// info strings are punctuation, list markers/quote markers/table pipes are
// punctuation.*, emphasis is blue (strong adds bold), inline code spans are
// text.literal, link text is orange italic with green URIs, bare URLs and
// strikethrough stay plain, and unknown-language fence content is plain.
const line = (source, n, language = "markdown") => highlightLines(source, language, [n])[0]?.runs ?? [];
const has = (runs, scope, start, end) =>
  runs.some(run => run.scope === scope && run.start === start && run.end === end);
const plain = runs => runs.length === 0;

// Headings — the whole atx_heading node (markers included) is "title".
assert.ok(has(line("# Title", 1), "title", 0, 7));
assert.ok(has(line("### Sub ##", 1), "title", 0, 10));
assert.equal(
  line("# Title", 1).some(run => run.scope !== "title"),
  false,
  "nothing else paints in a heading",
);

// Thematic breaks and setext underlines are "title" too.
assert.ok(has(line("---", 1), "title", 0, 3));
assert.ok(has(line("===", 1), "title", 0, 3));
assert.ok(has(line("***", 1), "title", 0, 3));

// Fenced code blocks — delimiter and info string are punctuation (Zed's
// punctuation.embedded falls back to punctuation), never a colored language.
const fenced = [
  "# Doc",
  "```js",
  'const value = "hi";',
  "/* still a comment",
  "across lines */",
  "```",
  "prose **bold** again",
].join("\n");
const open = line(fenced, 2);
assert.ok(has(open, "punctuation.embedded", 0, 5), "fence + info string are punctuation.embedded");
assert.equal(
  open.some(run => run.scope === "type"),
  false,
  "info string is not a colored language",
);
const inner = line(fenced, 3);
assert.ok(has(inner, "keyword", 0, 5), "inner language keywords come from the registry");
assert.ok(has(inner, "string", 14, 18));
assert.ok(has(line(fenced, 4), "comment", 0, 18), "block comment opens inside the fence");
assert.ok(has(line(fenced, 5), "comment", 0, 15), "comment state carries across fence lines");
assert.ok(has(line(fenced, 6), "punctuation.embedded", 0, 3));
const prose = line(fenced, 7);
assert.ok(has(prose, "emphasis.strong", 6, 14), "markdown rules resume after the fence");
assert.equal(
  prose.some(run => run.scope === "keyword"),
  false,
);

// The whole fence is scanned even when only later lines are requested.
const spread = ["```", "open fence", "```", "", "plain **text**"].join("\n");
const later = highlightLines(spread, "markdown", [5])[0].runs;
assert.ok(has(later, "emphasis.strong", 6, 14));
assert.equal(
  later.some(run => run.scope === "punctuation"),
  false,
);

// No info string or an unknown language renders fence content plain (Zed has
// no injection for those).
const tilde = ["~~~", 'say "hi" there', "~~~"].join("\n");
assert.deepEqual(line(tilde, 2), [], "no info string means no injection");
assert.equal(
  line(tilde, 2).some(run => run.scope === "heading"),
  false,
);
const unknownFence = ["```ini", 'key = "value"', "```"].join("\n");
assert.deepEqual(line(unknownFence, 2), [], "unknown fence language stays plain");
const textFence = ["```text", 'say "hi"', "```"].join("\n");
assert.deepEqual(line(textFence, 2), [], "text fences stay plain");

// Known languages resolve through aliases and keep their own rules.
const aliased = ["```JavaScript", "// real comment", "```"].join("\n");
assert.ok(has(line(aliased, 1), "punctuation.embedded", 0, 13));
assert.ok(has(line(aliased, 2), "comment", 0, 15), "alias resolution picks the js comment rules");
const shell = ["```sh", "# shell comment", "```"].join("\n");
assert.ok(has(line(shell, 2), "comment", 0, 15));
const golang = ["```golang", "// go comment", "```"].join("\n");
assert.ok(has(line(golang, 2), "comment", 0, 13), "language aliases resolve (golang → go)");

// A closing fence must use the same character as the opener.
const mismatch = ["```js", "let x = 1;", "~~~", "return x;", "```", "back to prose"].join("\n");
assert.ok(has(line(mismatch, 2), "keyword", 0, 3));
assert.equal(
  line(mismatch, 3).some(run => run.scope === "punctuation"),
  false,
  "~~~ does not close a ``` fence",
);
assert.ok(has(line(mismatch, 4), "keyword", 0, 6), "still code after the wrong fence character");
assert.ok(has(line(mismatch, 5), "punctuation.embedded", 0, 3));
assert.equal(
  line(mismatch, 6).some(run => run.scope === "keyword"),
  false,
);

// Lists — markers are punctuation.list_marker, content keeps inline rules.
const list = line("- **bold** item", 1);
assert.ok(has(list, "punctuation.list_marker", 0, 1));
assert.ok(has(list, "emphasis.strong", 2, 10));
assert.ok(has(line("1. first", 1), "punctuation.list_marker", 0, 2));
assert.ok(has(line("2) alt", 1), "punctuation.list_marker", 0, 2));
assert.ok(has(line("* star", 1), "punctuation.list_marker", 0, 1));
assert.ok(has(line("  - nested", 1), "punctuation.list_marker", 2, 3));
assert.ok(has(line("- use `fmt` now", 1), "text.literal", 6, 11), "inline code in list content");

// Blockquotes — each > marker is punctuation.markup, content stays inline.
const quote = line("> quoted **bold** too", 1);
assert.ok(has(quote, "punctuation.markup", 0, 1));
assert.ok(has(quote, "emphasis.strong", 9, 17));
const deep = line("> > deep", 1);
assert.ok(has(deep, "punctuation.markup", 0, 1));
assert.ok(has(deep, "punctuation.markup", 2, 3));

// Tables — pipes (and delimiter dashes) are punctuation.markup; cells keep
// inline rules; header rows are NOT special (Zed styles only the pipes).
const table = ["| Name | Type |", "|------|------|", "| id   | `u32` |", "", "not | table"].join("\n");
const header = line(table, 1);
assert.ok(has(header, "punctuation.markup", 0, 1), "header leading pipe");
assert.ok(has(header, "punctuation.markup", 7, 8), "header middle pipe");
assert.ok(has(header, "punctuation.markup", 14, 15), "header trailing pipe");
assert.equal(
  header.some(run => run.scope === "title"),
  false,
  "header text is not a title",
);
assert.equal(
  header.some(run => run.scope === "markup.bold" || run.scope === "emphasis.strong"),
  false,
  "header is not bold",
);
assert.equal(
  header.some(run => run.start <= 2 && run.end >= 6),
  false,
  "header cell text stays plain",
);
const delimiter = line(table, 2);
assert.ok(has(delimiter, "punctuation.markup", 0, 15), "delimiter pipes and dashes painted");
const colonRow = line("| :--- |", 1);
assert.ok(has(colonRow, "punctuation.markup", 0, 1));
assert.ok(has(colonRow, "punctuation.markup", 3, 6), "delimiter dashes painted");
assert.ok(has(colonRow, "punctuation.markup", 7, 8));
assert.equal(
  colonRow.some(run => run.start <= 2 && run.end >= 3),
  false,
  "alignment colons stay plain",
);
const body = line(table, 3);
assert.ok(has(body, "punctuation.markup", 0, 1));
assert.ok(has(body, "punctuation.markup", 15, 16));
assert.ok(has(body, "text.literal", 9, 14), "inline rules work inside cells");
assert.equal(
  line(table, 5).some(run => run.scope === "punctuation.markup"),
  false,
  "the table ended at the blank line",
);
assert.equal(line("| a | b |\nbut next is prose", 1).length, 0, "no table without a delimiter row");

// Emphasis and strong — the whole node including delimiters, blue per Ayu.
assert.ok(has(line("*em*", 1), "emphasis", 0, 4));
assert.ok(has(line("*em* and _em_", 1), "emphasis", 0, 4));
assert.ok(has(line("*em* and _em_", 1), "emphasis", 9, 13));
assert.ok(has(line("**strong**", 1), "emphasis.strong", 0, 10));
assert.ok(has(line("__strong__", 1), "emphasis.strong", 0, 10));
assert.ok(has(line("a*b*c", 1), "emphasis", 1, 4), "intraword asterisks emphasize (CommonMark)");
assert.ok(has(line("2**3**2", 1), "emphasis.strong", 1, 6), "intraword double asterisks");
assert.deepEqual(line("snake_case_name", 1), [], "intraword underscores do not");
assert.deepEqual(line("_a_b", 1), [], "underscore closed by a word character does not");

// Inline code spans — backticks and content are text.literal.
assert.ok(has(line("a `code` span", 1), "text.literal", 2, 8));

// Links — [text] is link_text (orange italic), (uri) is link_uri (green);
// nested inline markup inside link text survives.
const linked = line("[**docs**](https://example.com)", 1);
assert.ok(has(linked, "link_text", 0, 1), "opening bracket is link_text");
assert.ok(has(linked, "emphasis.strong", 1, 9), "emphasis inside link text");
assert.ok(has(linked, "link_text", 9, 10), "closing bracket is link_text");
assert.ok(has(linked, "link_uri", 10, 31), "parens and destination are link_uri");
const simpleLink = line("[text](https://x)", 1);
assert.ok(has(simpleLink, "link_text", 0, 6));
assert.ok(has(simpleLink, "link_uri", 6, 17));

// Images — ![alt] is link_text, (src) is link_uri.
const image = line("![logo](assets/logo.png)", 1);
assert.ok(has(image, "link_text", 0, 7), "bang, brackets and alt are link_text");
assert.ok(has(image, "link_uri", 7, 24), "parens and source are link_uri");

// Autolinks — <uri> and <email> are link_uri. Bare URLs stay plain (Zed's
// grammar has no GFM autolink extension), and a stray ](uri) is not a link.
assert.ok(has(line("<https://example.com>", 1), "link_uri", 0, 21));
assert.ok(has(line("<me@example.com>", 1), "link_uri", 0, 16));
assert.deepEqual(line("see https://example.com/x, now", 1), [], "bare URLs are plain");
assert.deepEqual(
  line("`https://x`", 1).filter(run => run.scope === "link_uri"),
  [],
  "code spans swallow URLs",
);
assert.deepEqual(line("docs](https://x) fallback", 1), [], "a ](uri) without a link is plain");

// Strikethrough has no theme entry in Zed's Ayu — plain text.
assert.deepEqual(line("~~struck~~", 1), []);

// Escaped markers never emphasize.
assert.deepEqual(line("\\*not emphasis\\*", 1), []);

// The palette is Zed's Ayu Dark.
const palette = syntaxPalette();
assert.equal(palette.keyword, "#ff8f3f");
assert.equal(palette.string, "#a9d94b");
assert.equal(palette.comment, "#5c6773");
assert.equal(palette.function, "#ffb353");
assert.equal(palette.punctuation, "#a6a5a0");
assert.equal(palette.title, "#bfbdb6");
assert.equal(palette.heading, "#bfbdb6");
assert.equal(palette.emphasis, "#5ac1fe");
assert.equal(palette["emphasis.strong"], "#5ac1fe");
assert.equal(palette.link_text, "#fe8f40");
assert.equal(palette.link_uri, "#aad84c");
assert.equal(palette["text.literal"], "#fe8f40");

// Font effects match Zed's theme entries (title/emphasis.strong bold,
// link_text italic) and flow through syntaxSegments.
const effects = syntaxEffects();
assert.deepEqual(effects.title, { weight: 700 });
assert.deepEqual(effects["emphasis.strong"], { weight: 700 });
assert.deepEqual(effects.link_text, { italic: true });
assert.deepEqual(
  syntaxSegments("**h**", [{ start: 0, end: 5, scope: "title" }], "#plain", { title: "#bfbdb6" }, effects),
  [{ text: "**h**", color: "#bfbdb6", bold: true }],
);
assert.deepEqual(
  syntaxSegments("[l]", [{ start: 0, end: 3, scope: "link_text" }], "#plain", { link_text: "#fe8f40" }, effects),
  [{ text: "[l]", color: "#fe8f40", italic: true }],
);
assert.deepEqual(
  syntaxSegments("x", [{ start: 0, end: 1, scope: "keyword" }], "#plain", { keyword: "#ff8f3f" }, effects),
  [{ text: "x", color: "#ff8f3f" }],
);

// The registry is per language — everything else keeps the generic tokenizer.
const python = highlightLines("x = None  # note", "python", [1])[0].runs;
assert.ok(has(python, "constant", 4, 8));
assert.ok(has(python, "comment", 10, 16));
assert.ok(has(highlightLines('say "hi"', "txt", [1])[0].runs, "string", 4, 8));

console.log("shared markdown syntax tests passed");
