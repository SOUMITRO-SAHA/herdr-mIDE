import assert from "node:assert/strict";
import { highlightLines } from "../shared/syntax.js";

// Per-language Markdown tokenizer (issue #33): fenced code blocks highlight
// their inner language across lines; lists, blockquotes, tables, image syntax
// and autolinks get dedicated runs. Public contract is unchanged:
// highlightLines(source, "markdown", requestedLines) with UTF-16 ranges.
const line = (source, n, language = "markdown") => highlightLines(source, language, [n])[0]?.runs ?? [];
const has = (runs, scope, start, end) =>
  runs.some(run => run.scope === scope && run.start === start && run.end === end);

// Fenced code blocks — the fence line, the inner language, cross-line state.
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
assert.ok(has(open, "punctuation", 0, 3), "fence delimiter is punctuation");
assert.ok(has(open, "type", 3, 5), "info string's language word is type");
const inner = line(fenced, 3);
assert.ok(has(inner, "keyword", 0, 5), "inner language keywords are painted");
assert.ok(has(inner, "string", 14, 18), "inner language strings are painted");
assert.ok(has(line(fenced, 4), "comment", 0, 18), "block comment opens inside the fence");
assert.ok(has(line(fenced, 5), "comment", 0, 15), "block comment state carries across fence lines");
assert.ok(has(line(fenced, 6), "punctuation", 0, 3), "closing fence is punctuation");
const prose = line(fenced, 7);
assert.ok(has(prose, "markup.bold", 6, 14), "markdown inline rules resume after the fence");
assert.equal(
  prose.some(run => run.scope === "keyword"),
  false,
  "no code keyword leaks into prose",
);

// The whole fence is scanned even when only later lines are requested — the
// multiline-state contract of highlightLines still holds for fences.
const spread = ["```", "open fence", "```", "", "plain **text**"].join("\n");
const later = highlightLines(spread, "markdown", [5])[0].runs;
assert.ok(has(later, "markup.bold", 6, 14));
assert.equal(
  later.some(run => run.scope === "punctuation"),
  false,
);

// Tilde fences work; without an info string the inner lines stay non-markdown.
const tilde = ["~~~", 'say "hi" there', "~~~"].join("\n");
assert.ok(has(line(tilde, 2), "string", 4, 8), "generic tokenizer still runs inside the fence");
assert.equal(
  line(tilde, 2).some(run => run.scope === "heading"),
  false,
);

// A closing fence must use the same character as the opener.
const mismatch = ["```js", "let x = 1;", "~~~", "return x;", "```", "back to prose"].join("\n");
assert.ok(has(line(mismatch, 2), "keyword", 0, 3));
assert.equal(
  line(mismatch, 3).some(run => run.scope === "punctuation"),
  false,
  "~~~ does not close a ``` fence",
);
assert.ok(has(line(mismatch, 4), "keyword", 0, 6), "still code after the wrong fence character");
assert.ok(has(line(mismatch, 5), "punctuation", 0, 3));
assert.equal(
  line(mismatch, 6).some(run => run.scope === "keyword"),
  false,
);

// Info strings resolve language aliases ("JavaScript" highlights like js).
const aliased = ["```JavaScript", "// real comment", "```"].join("\n");
assert.ok(has(line(aliased, 1), "type", 3, 13));
assert.ok(has(line(aliased, 2), "comment", 0, 15), "alias resolution picks the js comment rules");
const shell = ["```sh", "# shell comment", "```"].join("\n");
assert.ok(has(line(shell, 2), "comment", 0, 15), "hash-comment languages work inside fences");
const titled = ['```js title="Example"', "const x = 1;", "```"].join("\n");
assert.ok(has(line(titled, 1), "type", 3, 5), "only the language word is type");
assert.equal(
  line(titled, 1).some(run => run.scope === "type" && run.end > 5),
  false,
);

// A backtick fence whose info string contains a backtick is not a fence.
const weird = ["``` a`b", "# Heading?", "```"].join("\n");
assert.ok(has(line(weird, 2), "heading", 0, 10), "line stays markdown prose");

// Lists — the marker is punctuation, the content keeps inline rules.
const list = line("- **bold** item", 1);
assert.ok(has(list, "punctuation", 0, 1));
assert.ok(has(list, "markup.bold", 2, 10));
assert.ok(has(line("1. first", 1), "punctuation", 0, 2));
assert.ok(has(line("2) alt", 1), "punctuation", 0, 2));
assert.ok(has(line("* star", 1), "punctuation", 0, 1));
assert.ok(has(line("  - nested", 1), "punctuation", 2, 3));
assert.ok(has(line("- use `fmt` now", 1), "markup.raw", 6, 11), "inline code still works in list content");

// Blockquotes — each > marker is punctuation, the rest stays inline markdown.
const quote = line("> quoted **bold** too", 1);
assert.ok(has(quote, "punctuation", 0, 1));
assert.ok(has(quote, "markup.bold", 9, 17));
const deep = line("> > deep", 1);
assert.ok(has(deep, "punctuation", 0, 1));
assert.ok(has(deep, "punctuation", 2, 3));

// Tables — a delimiter row turns the previous row into a bold header and the
// following pipe rows into body rows; a blank line ends the table.
const table = ["| Name | Type |", "|------|------|", "| id   | `u32` |", "", "not | table"].join("\n");
const header = line(table, 1);
assert.ok(has(header, "markup.bold", 0, 15), "header row is bold when the next row delimits a table");
assert.ok(has(line(table, 2), "punctuation", 0, 15), "delimiter row is punctuation");
const body = line(table, 3);
assert.ok(has(body, "punctuation", 0, 1), "leading pipe of a body row");
assert.ok(has(body, "punctuation", 15, 16), "trailing pipe of a body row");
assert.ok(has(body, "markup.raw", 9, 14), "inline rules work inside cells");
assert.equal(
  line(table, 5).some(run => run.scope === "punctuation"),
  false,
  "the table ended at the blank line",
);
const notHeader = line("| a | b |\nbut next is prose", 1);
assert.equal(
  notHeader.some(run => run.scope === "markup.bold"),
  false,
  "no table without a delimiter row",
);

// Image syntax ![alt](src) is one link_uri run.
const image = line("![logo](assets/logo.png)", 1);
assert.ok(has(image, "link_uri", 0, 24));

// Links [text](uri) — brackets and URI are link_uri, nested emphasis survives.
const linked = line("[**docs**](https://example.com)", 1);
assert.ok(has(linked, "markup.bold", 1, 9), "emphasis inside link text");
assert.ok(
  linked.some(run => run.scope === "link_uri" && run.end === 31 && run.start <= 10),
  "brackets and URI are link_uri",
);

// Autolinks — <scheme:…>, <mailto:…> and bare URLs are link_uri; trailing
// punctuation is not part of the link.
const auto = line("<https://example.com>", 1);
assert.ok(has(auto, "link_uri", 0, 21));
const bare = line("see https://example.com/x, now", 1);
assert.ok(has(bare, "link_uri", 4, 25), "bare URL without the trailing comma");
const mail = line("<me@example.com>", 1);
assert.ok(has(mail, "link_uri", 0, 16));
assert.equal(
  line("`https://x`", 1).some(run => run.scope === "link_uri"),
  false,
  "code spans swallow URLs",
);

// Existing inline rules keep working.
assert.ok(has(line("# Title", 1), "heading", 0, 7));
assert.ok(has(line("### Sub ##", 1), "heading", 0, 10));
assert.ok(has(line("a `code` span", 1), "markup.raw", 2, 8));
assert.ok(has(line("**strong**", 1), "markup.bold", 0, 10));
assert.ok(has(line("*em* and _em_", 1), "markup.italic", 0, 4));
assert.ok(has(line("docs](https://x) fallback", 1), "link_uri", 6, 15), "bare ](uri) fallback is preserved");

// Underscores inside words are not emphasis (snake_case, exponentiation).
assert.deepEqual(line("snake_case_name", 1), []);
assert.deepEqual(line("2**3**2", 1), []);

// The registry is per language — everything else keeps the generic tokenizer.
const python = highlightLines("x = None  # note", "python", [1])[0].runs;
assert.ok(has(python, "constant", 4, 8));
assert.ok(has(python, "comment", 10, 16));
assert.ok(has(highlightLines('say "hi"', "txt", [1])[0].runs, "string", 4, 8));

console.log("shared markdown syntax tests passed");
