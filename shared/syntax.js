// Per-language tokenizer registry, keyed by languageFor()'s result. Every
// language's tokenizer follows one contract — tokenizeLine(line, state,
// context) returning UTF-16 runs for one line and mutating state for
// cross-line constructs — and languages without an entry keep the generic
// tokenizer below, so nothing regresses. The tokenizers live in this file:
// Markdown's is below; Rust and further languages follow as their own
// sections and PRs (issue #33).

const LANG = {
  py: "python",
  ts: "js",
  tsx: "js",
  mts: "js",
  cts: "js",
  jsx: "js",
  mjs: "js",
  cjs: "js",
  jsonc: "json",
  md: "markdown",
  markdown: "markdown",
  mdown: "markdown",
  mkd: "markdown",
  svelte: "html",
  vue: "html",
  yaml: "toml",
};
export const languageFor = file => {
  const ext = file.includes(".") ? file.split(".").pop().toLowerCase() : "txt";
  return LANG[ext] ?? ext;
};

// Canonical mIDE syntax palette — the color values are Zed's Ayu Dark theme
// (assets/themes/ayu/ayu.json in zed-industries/zed) so Markdown and code
// render like Zed. The editor and Diff both consume this table; keep syntax
// colors out of individual mods and themes to avoid drift.
const SYNTAX_COLORS = Object.freeze({
  keyword: "#ff8f3f",
  string: "#a9d94b",
  comment: "#5c6773",
  function: "#ffb353",
  type: "#59c2ff",
  number: "#d2a6ff",
  constant: "#d2a6ff",
  boolean: "#d2a6ff",
  variable: "#bfbdb6",
  operator: "#f29668",
  punctuation: "#a6a5a0",
  heading: "#bfbdb6",
  title: "#bfbdb6",
  emphasis: "#5ac1fe",
  "emphasis.strong": "#5ac1fe",
  link_text: "#fe8f40",
  link_uri: "#aad84c",
  "text.literal": "#fe8f40",
  "markup.raw": "#fe8f40",
  "markup.bold": "#5ac1fe",
  "markup.italic": "#5ac1fe",
});

export const syntaxPalette = () => Object.freeze({ ...SYNTAX_COLORS });

// Font effects per scope, mirroring Zed's Ayu theme entries: headings and
// strong emphasis render bold, link text renders italic (emphasis does not —
// Ayu Dark sets its font_style to null). Looked up with the same
// longest-prefix rule as colors, in syntaxSegments.
const SYNTAX_EFFECTS = Object.freeze({
  title: Object.freeze({ weight: 700 }),
  heading: Object.freeze({ weight: 700 }),
  "emphasis.strong": Object.freeze({ weight: 700 }),
  link_text: Object.freeze({ italic: true }),
});

export const syntaxEffects = () => {
  const copy = {};
  for (const [scope, effect] of Object.entries(SYNTAX_EFFECTS)) copy[scope] = { ...effect };
  return copy;
};

const KEYWORDS = new Set(
  (
    "as async await break case catch class const continue debugger default delete do else export " +
    "extends finally for from function get if import in instanceof let new of return set static " +
    "super switch this throw try typeof var void while with yield abstract assert boolean byte " +
    "char double enum final float implements int interface long native package private protected " +
    "public short synchronized throws transient volatile def del elif except exec global lambda " +
    "nonlocal pass print raise self and or not is fn impl let mut pub crate mod trait type use " +
    "where match loop move ref struct unsafe dyn extern union macro_rules select go defer fallthrough " +
    "chan map range rune string const func var package type interface struct " +
    "begin end module require ensure alias undef unless until when then elsif rescue retry unless " +
    "select case end function local repeat then elseif do while for in class extends require " +
    "using namespace template typename constexpr decltype constexpr operator friend virtual override " +
    "readonly keyof infer satisfies declare as const enum implements abstract async await " +
    "true false null undefined None True False"
  ).split(/\s+/),
);

const CONSTANTS = new Set([
  "true",
  "false",
  "null",
  "undefined",
  "NaN",
  "Infinity",
  "None",
  "True",
  "False",
  "nil",
  "NULL",
]);

const TYPES = new Set(
  (
    "Array Boolean Date Error Function Map Number Object Promise Proxy Reflect RegExp Set String Symbol " +
    "WeakMap WeakSet BigInt any never unknown void bool byte char double float int integer long short " +
    "str bytes list dict tuple set Optional Union Result Option Vec HashMap HashSet Self self TypeError " +
    "HTMLElement Element Node Document Event Record Partial Pick Omit Readonly PromiseLike"
  ).split(/\s+/),
);

const HASH_COMMENT_LANGUAGES = new Set([
  "bash",
  "dockerfile",
  "makefile",
  "perl",
  "python",
  "py",
  "ruby",
  "r",
  "sh",
  "shell",
  "toml",
  "yaml",
]);
const DASH_COMMENT_LANGUAGES = new Set(["haskell", "lua", "sql"]);
const SLASH_COMMENT_LANGUAGES = new Set([
  "c",
  "cc",
  "cpp",
  "csharp",
  "css",
  "cxx",
  "go",
  "h",
  "hpp",
  "hxx",
  "java",
  "javascript",
  "js",
  "json",
  "kotlin",
  "m",
  "mm",
  "php",
  "rust",
  "rs",
  "scala",
  "swift",
  "typescript",
  "tsx",
  "zig",
]);

// Languages a Markdown fence can inject — Zed resolves the info string to a
// registered grammar and renders unknown ones plain, so the same rule lives
// here: the alias table plus every language the generic tokenizer knows.
const FENCE_ALIASES = { golang: "go", "c++": "cpp", objc: "c" };
const FENCE_LANGUAGES = new Set([
  ...Object.keys(LANG),
  ...Object.values(LANG),
  ...HASH_COMMENT_LANGUAGES,
  ...DASH_COMMENT_LANGUAGES,
  ...SLASH_COMMENT_LANGUAGES,
]);
export const fenceLanguage = info => {
  const word = info.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (!word) return null;
  const language = FENCE_ALIASES[word] ?? LANG[word] ?? word;
  return FENCE_LANGUAGES.has(language) ? language : null;
};

const isWordStart = char => Boolean(char && /[A-Za-z_$]/.test(char));
const isWordPart = char => Boolean(char && /[A-Za-z0-9_$]/.test(char));
const appendRun = (runs, start, end, scope) => {
  if (start >= end) return;
  const previous = runs[runs.length - 1];
  if (previous?.scope === scope && previous.end === start) previous.end = end;
  else runs.push({ start, end, scope });
};

// ---------------------------------------------------------------------------
// Markdown tokenizer, following Zed's Markdown grammars
// (crates/grammars/src/markdown/highlights.scm and markdown-inline/
// highlights.scm, studied from the vendored checkout) rendered with Zed's
// Ayu Dark theme. Constructs map to the palette scopes as Zed maps its
// captures: headings, setext underlines and thematic breaks are "title";
// list markers are "punctuation.list_marker"; quote markers, table pipes and
// delimiter dashes are "punctuation.markup"; fence delimiters and info
// strings are "punctuation.embedded" (all resolve to punctuation gray);
// emphasis is "emphasis" with strong as "emphasis.strong"; code spans are
// "text.literal"; link text and brackets are "link_text"; destinations,
// parens and autolinks are "link_uri". Bare URLs and strikethrough stay
// plain — Zed's grammar does not capture them — and fence content with no
// info string or an unknown language renders plain (no injection).
//
// state: { fence: { char, length, language, codeState } | null, table: boolean }
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const HEADING = /^\s{0,3}#{1,6}(?:\s|$)/;
// Thematic breaks and setext underlines share Zed's "title" capture; the
// dash form needs two or more so a lone "-" stays a list marker.
const TITLE_LINE = /^ {0,3}(?:-{2,}|\*{3,}|_{3,}|=+)\s*$/;
const LIST_MARKER = /^(\s*)([-*+]|\d{1,9}[.)])( .*)?$/;
const DELIMITER_CELL = /^ *:?-+:? *$/;
const MD_CODE = /(`+)([\s\S]*?)\1/y;
const MD_STRONG = /(\*\*|__)(?=\S)(.*?\S)\1/y;
const MD_EMPHASIS = /([*_])(?=\S)(.*?\S)\1/y;
const MD_IMAGE = /!\[([^\]]*)\]\(([^)]*)\)/y;
const MD_LINK = /\[((?:[^[\]]|\[[^\]]*\])*)\]\(([^)]*)\)/y;
const MD_AUTOLINK = /<(?:[a-zA-Z][a-zA-Z\d+.-]{1,31}:[^<>\s]*|mailto:[^<>\s]+|[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+)>/y;

const isDelimiterRow = line => {
  if (!line.includes("|")) return false;
  const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|");
  return cells.length > 0 && cells.every(cell => DELIMITER_CELL.test(cell));
};

const isClosingFence = (line, char, length) => new RegExp(`^ {0,3}${char}{${length},}\\s*$`).test(line);

// Inline markdown: escapes, code spans, strong/emphasis, images, links,
// autolinks. Depth caps nesting (emphasis inside link text inside a table
// cell) so pathological prose cannot recurse deeply. Flanking follows
// CommonMark as Zed's grammar does: `*` may emphasize intraword, `_` may not.
// One slice per call with sticky regexes — no per-character substring
// copying — and runs come back in the caller's coordinates.
const inlineRuns = (runs, text, from, to, depth = 0) => {
  // Diff displays at most 4,000 characters of a line. Keep unmatched inline
  // delimiters from repeatedly scanning an unbounded suffix of the source.
  to = Math.min(to, from + 4000);
  const local = from === 0 && to === text.length ? text : text.slice(from, to);
  const inner = [];
  inlineRunsLocal(inner, local, depth);
  for (const run of inner) appendRun(runs, from + run.start, from + run.end, run.scope);
};

const inlineRunsLocal = (runs, text, depth) => {
  let index = 0;
  while (index < text.length) {
    if (text[index] === "\\") {
      // Escaped character — never opens a span.
      index += 2;
      continue;
    }

    MD_CODE.lastIndex = index;
    const code = MD_CODE.exec(text);
    if (code) {
      appendRun(runs, index, MD_CODE.lastIndex, "text.literal");
      index = MD_CODE.lastIndex;
      continue;
    }

    MD_STRONG.lastIndex = index;
    const strong = MD_STRONG.exec(text);
    if (strong) {
      const strongEnd = MD_STRONG.lastIndex;
      const underscore = strong[1][0] === "_";
      const flanking =
        !underscore ||
        ((index === 0 || !isWordPart(text[index - 1])) && (strongEnd >= text.length || !isWordPart(text[strongEnd])));
      if (flanking) {
        appendRun(runs, index, strongEnd, "emphasis.strong");
        index = strongEnd;
        continue;
      }
      // Unpaired strong marker: skip both characters so the emphasis rule
      // cannot misfire on the second one.
      index += 2;
      continue;
    }

    MD_EMPHASIS.lastIndex = index;
    const emphasis = MD_EMPHASIS.exec(text);
    if (emphasis) {
      const emphasisEnd = MD_EMPHASIS.lastIndex;
      const underscore = emphasis[1] === "_";
      const flanking =
        !underscore ||
        ((index === 0 || !isWordPart(text[index - 1])) &&
          (emphasisEnd >= text.length || !isWordPart(text[emphasisEnd])));
      if (flanking) {
        appendRun(runs, index, emphasisEnd, "emphasis");
        index = emphasisEnd;
        continue;
      }
    }

    MD_IMAGE.lastIndex = index;
    const image = MD_IMAGE.exec(text);
    if (image) {
      const altStart = index + 2;
      const altEnd = altStart + image[1].length; // before the ]
      appendRun(runs, index, index + 2, "link_text"); // ![
      const altRuns = [];
      if (depth < 2 && image[1]) inlineRuns(altRuns, text, altStart, altEnd, depth + 1);
      let cursor = altStart;
      for (const run of altRuns) {
        if (cursor < run.start) appendRun(runs, cursor, run.start, "link_text");
        runs.push(run);
        cursor = run.end;
      }
      if (cursor < altEnd) appendRun(runs, cursor, altEnd, "link_text");
      appendRun(runs, altEnd, altEnd + 1, "link_text"); // ]
      appendRun(runs, altEnd + 1, index + image[0].length, "link_uri"); // (src)
      index += image[0].length;
      continue;
    }

    MD_LINK.lastIndex = index;
    const link = MD_LINK.exec(text);
    if (link) {
      const textStart = index + 1;
      const textEnd = textStart + link[1].length;
      appendRun(runs, index, textStart, "link_text"); // [
      // Zed paints the whole link_text node and lets inner captures win where
      // they exist — fill the gaps between nested runs with link_text.
      const inner = [];
      if (depth < 2 && link[1]) inlineRuns(inner, text, textStart, textEnd, depth + 1);
      let cursor = textStart;
      for (const run of inner) {
        if (cursor < run.start) appendRun(runs, cursor, run.start, "link_text");
        runs.push(run);
        cursor = run.end;
      }
      if (cursor < textEnd) appendRun(runs, cursor, textEnd, "link_text");
      appendRun(runs, textEnd, textEnd + 1, "link_text"); // ]
      appendRun(runs, textEnd + 1, index + link[0].length, "link_uri"); // (destination)
      index += link[0].length;
      continue;
    }

    MD_AUTOLINK.lastIndex = index;
    const autolink = MD_AUTOLINK.exec(text);
    if (autolink) {
      appendRun(runs, index, MD_AUTOLINK.lastIndex, "link_uri");
      index = MD_AUTOLINK.lastIndex;
      continue;
    }

    index++;
  }
};

// Table rows (header, body): pipes are punctuation.markup and cell contents
// keep the inline rules. Zed styles nothing else — header rows are ordinary.
const tableRow = (runs, line) => {
  line = line.slice(0, 4000);
  let index = 0;
  let cellStart = 0;
  while (index < line.length) {
    if (line[index] === "\\") {
      index += 2;
      continue;
    }
    if (line[index] === "`") {
      let end = index + 1;
      while (line[end] === "`") end++;
      const marker = line.slice(index, end);
      const close = line.indexOf(marker, end);
      if (close >= 0) {
        index = close + marker.length;
        continue;
      }
      index = end;
      continue;
    }
    if (line[index] === "|") {
      inlineRuns(runs, line, cellStart, index);
      appendRun(runs, index, index + 1, "punctuation.markup");
      cellStart = index + 1;
    }
    index++;
  }
  inlineRuns(runs, line, cellStart, line.length);
};

// Delimiter row: pipes and dashes are punctuation.markup; alignment colons
// and padding stay plain, exactly as Zed captures only "|" and "-".
const delimiterRow = (runs, line) => {
  let index = 0;
  while (index < line.length) {
    const char = line[index];
    if (char === "|" || char === "-") {
      let end = index;
      while (end < line.length && line[end] === char) end++;
      appendRun(runs, index, end, "punctuation.markup");
      index = end;
      continue;
    }
    index++;
  }
};

// Fence prefixes belong to their containing quote/list, not the injected
// language. Keep source offsets so the resulting runs still address the
// original line.
const quotePrefix = (line, limit = Infinity) => {
  const markers = [];
  let offset = 0;
  while (markers.length < limit) {
    const match = /^ {0,3}> ?/.exec(line.slice(offset));
    if (!match) break;
    const marker = offset + match[0].indexOf(">");
    markers.push(marker);
    offset += match[0].length;
  }
  return { offset, markers };
};

const markdownTokenizeLine = (line, state, context) => {
  const runs = [];

  if (state.fence) {
    const { char, length, language, codeState, quotes, indent } = state.fence;
    const prefix = quotePrefix(line, quotes);
    let offset = quotes ? prefix.offset : 0;
    const missingQuote = quotes && prefix.markers.length < quotes;
    const spaces = /^ */.exec(line.slice(offset))[0].length;
    const missingIndent = indent && spaces < indent && line.slice(offset).trim() !== "";
    if (missingQuote || missingIndent) {
      state.fence = null;
    } else {
      if (quotes) for (const marker of prefix.markers) appendRun(runs, marker, marker + 1, "punctuation.markup");
      offset += Math.min(spaces, indent);
      const content = line.slice(offset);
      if (isClosingFence(content, char, length)) {
        appendRun(runs, offset, line.length, "punctuation.embedded");
        state.fence = null;
        return runs;
      }
      if (language) {
        for (const run of context.tokenize(content, language, codeState))
          appendRun(runs, offset + run.start, offset + run.end, run.scope);
      }
      return runs;
    }
  }

  const prefix = quotePrefix(line);
  let offset = prefix.offset;
  const containerList = LIST_MARKER.exec(line.slice(offset));
  let indent = 0;
  if (containerList?.[3]) {
    indent = containerList[1].length + containerList[2].length + 1;
    offset += indent;
  }
  const opening = FENCE_OPEN.exec(line.slice(offset));
  if (opening) {
    const char = opening[1][0];
    const info = opening[2].trim();
    // A backtick fence's info string may not contain backticks (CommonMark);
    // such a line is prose, not a fence.
    if (char !== "`" || !info.includes("`")) {
      const word = info.split(/\s+/)[0] ?? "";
      for (const marker of prefix.markers) appendRun(runs, marker, marker + 1, "punctuation.markup");
      if (indent) {
        const start = prefix.offset + containerList[1].length;
        appendRun(runs, start, start + containerList[2].length, "punctuation.list_marker");
      }
      appendRun(runs, offset, line.length, "punctuation.embedded");
      state.fence = {
        char,
        length: opening[1].length,
        language: context.resolveLanguage(word),
        codeState: {},
        quotes: prefix.markers.length,
        indent,
      };
      state.table = false;
      return runs;
    }
  }

  if (HEADING.test(line)) {
    // Zed captures the whole atx_heading node — markers and text alike.
    appendRun(runs, 0, line.length, "title");
    return runs;
  }

  if (TITLE_LINE.test(line)) {
    appendRun(runs, 0, line.length, "title");
    return runs;
  }

  if (/^ {0,3}>/.test(line)) {
    let index = line.match(/^ {0,3}/)[0].length;
    while (line[index] === ">") {
      appendRun(runs, index, index + 1, "punctuation.markup");
      index += 1;
      if (line[index] === " ") index += 1;
    }
    inlineRuns(runs, line, index, line.length);
    return runs;
  }

  const list = LIST_MARKER.exec(line);
  if (list) {
    const markerStart = list[1].length;
    const markerEnd = markerStart + list[2].length;
    appendRun(runs, markerStart, markerEnd, "punctuation.list_marker");
    inlineRuns(runs, line, list[3] ? markerEnd + 1 : markerEnd, line.length);
    return runs;
  }

  if (isDelimiterRow(line)) {
    delimiterRow(runs, line);
    state.table = true;
    return runs;
  }
  if (state.table) {
    if (line.includes("|")) {
      tableRow(runs, line);
      return runs;
    }
    state.table = false;
  }

  // A pipe row directly above a delimiter row is that table's header — an
  // ordinary row: pipes painted, cells inline.
  if (line.includes("|") && isDelimiterRow(context.lines[context.index + 1] ?? "")) {
    tableRow(runs, line);
    return runs;
  }

  inlineRuns(runs, line, 0, line.length);
  return runs;
};

// The per-language registry: dedicated tokenizers first, generic fallback.
const LANGUAGE_MODULES = {
  markdown: { tokenizeLine: markdownTokenizeLine },
};

function genericTokenizeLine(line, language, state) {
  const runs = [];
  const add = (start, end, scope) => appendRun(runs, start, end, scope);
  const html = language === "html" || language === "xml" || language === "svg";
  const hashComments = HASH_COMMENT_LANGUAGES.has(language);
  const dashComments = DASH_COMMENT_LANGUAGES.has(language);
  const slashComments = SLASH_COMMENT_LANGUAGES.has(language);

  let index = 0;
  while (index < line.length) {
    if (state.blockEnd) {
      const end = line.indexOf(state.blockEnd, index);
      if (end < 0) {
        add(index, line.length, "comment");
        break;
      }
      add(index, end + state.blockEnd.length, "comment");
      index = end + state.blockEnd.length;
      state.blockEnd = null;
      continue;
    }

    if (state.multilineQuote) {
      const { delimiter, scope } = state.multilineQuote;
      let end = index;
      while (end < line.length) {
        if (line.startsWith(delimiter, end) && line[end - 1] !== "\\") break;
        end++;
      }
      if (end === line.length) {
        add(index, line.length, scope);
        break;
      }
      add(index, end + delimiter.length, scope);
      index = end + delimiter.length;
      state.multilineQuote = null;
      continue;
    }

    if (html && line.startsWith("<!--", index)) {
      const end = line.indexOf("-->", index + 4);
      if (end < 0) {
        add(index, line.length, "comment");
        state.blockEnd = "-->";
        break;
      }
      add(index, end + 3, "comment");
      index = end + 3;
      continue;
    }
    if (line.startsWith("/*", index)) {
      const end = line.indexOf("*/", index + 2);
      if (end < 0) {
        add(index, line.length, "comment");
        state.blockEnd = "*/";
        break;
      }
      add(index, end + 2, "comment");
      index = end + 2;
      continue;
    }
    if (
      (slashComments && line.startsWith("//", index)) ||
      (dashComments && line.startsWith("--", index)) ||
      (hashComments && line[index] === "#")
    ) {
      add(index, line.length, "comment");
      break;
    }

    const quote = line[index];
    if (
      (quote === '"' || quote === "'" || quote === "`") &&
      language === "python" &&
      line.startsWith(quote.repeat(3), index)
    ) {
      const delimiter = quote.repeat(3);
      const end = line.indexOf(delimiter, index + 3);
      if (end < 0) {
        add(index, line.length, "string");
        state.multilineQuote = { delimiter, scope: "string" };
        break;
      }
      add(index, end + 3, "string");
      index = end + 3;
      continue;
    }
    if (quote === '"' || quote === "'" || quote === "`") {
      let end = index + 1;
      while (end < line.length) {
        if (line[end] === "\\") {
          end += 2;
          continue;
        }
        if (line[end] === quote) {
          end++;
          break;
        }
        end++;
      }
      add(index, Math.min(end, line.length), "string");
      if (quote === "`" && end >= line.length && line[line.length - 1] !== "`") {
        state.multilineQuote = { delimiter: "`", scope: "string" };
      }
      index = Math.min(end, line.length);
      continue;
    }

    const tail = line.slice(index);
    const number = /^(?:0[xX][\da-fA-F]+|0[bB][01]+|0[oO][0-7]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?n?)/.exec(tail);
    if (number) {
      add(index, index + number[0].length, "number");
      index += number[0].length;
      continue;
    }
    if (isWordStart(line[index])) {
      let end = index + 1;
      while (isWordPart(line[end])) end++;
      const word = line.slice(index, end);
      const next = line.slice(end).match(/^\s*/)?.[0].length ?? 0;
      const tagStart = html ? line.lastIndexOf("<", index) : -1;
      const tagOpen = tagStart > line.lastIndexOf(">", index);
      const tagPrefix = tagOpen ? line.slice(tagStart + 1, index) : "";
      const htmlScope = tagOpen ? (/^\/?$/.test(tagPrefix) ? "type" : "keyword") : null;
      const scope =
        htmlScope ??
        (CONSTANTS.has(word)
          ? word === "true" || word === "false" || word === "True" || word === "False"
            ? "boolean"
            : "constant"
          : KEYWORDS.has(word)
            ? "keyword"
            : TYPES.has(word) || /^[A-Z]/.test(word)
              ? "type"
              : line[end + next] === "("
                ? "function"
                : null);
      if (scope) add(index, end, scope);
      index = end;
      continue;
    }

    if (/[+\-*%=&|^!<>?:~]/.test(line[index])) add(index, index + 1, "operator");
    else if (/[()[\]{}.,;:]/.test(line[index])) add(index, index + 1, "punctuation");
    index++;
  }
  return runs;
}

// Dispatch to the language's own module when one is registered; the generic
// tokenizer is the fallback. `context` carries the scan position and lets
// language modules re-enter the registry (e.g. fenced code blocks).
const tokenizeWith = (line, language, state, context) => {
  const module = LANGUAGE_MODULES[language];
  if (module) return module.tokenizeLine(line, state, context);
  return genericTokenizeLine(line, language, state);
};

// Returns 1-based source lines and UTF-16 ranges, matching JavaScript string
// slicing and the editor's line numbers. Only requested lines are returned,
// but all preceding lines are scanned so multiline comments/strings — and the
// per-language modules' fenced code blocks — stay right.
export const highlightLines = (source, language, requestedLines) => {
  const lines = String(source ?? "")
    .split("\n")
    .map(line => (line.endsWith("\r") ? line.slice(0, -1) : line));
  const requested = new Set(
    (requestedLines ?? []).filter(line => Number.isInteger(line) && line > 0 && line <= lines.length),
  );
  if (!requested.size) return [];

  const state = { blockEnd: null, multilineQuote: null };
  const context = {
    index: 0,
    lines,
    tokenize: (line, innerLanguage, innerState) => tokenizeWith(line, innerLanguage, innerState, context),
    resolveLanguage: fenceLanguage,
  };
  const highlighted = [];
  for (let index = 0; index < lines.length; index++) {
    context.index = index;
    const runs = tokenizeWith(lines[index], language, state, context);
    const lineNumber = index + 1;
    if (requested.has(lineNumber)) highlighted.push({ line: lineNumber, runs });
  }
  return highlighted;
};

const resolveScope = (scope, table) => {
  let name = scope;
  while (name) {
    if (table[name]) return table[name];
    const separator = name.lastIndexOf(".");
    name = separator < 0 ? "" : name.slice(0, separator);
  }
  return null;
};

// Returns colored segments for one line. `effects` (from syntaxEffects()) adds
// Zed-style font effects: weight >= 700 becomes bold, italic becomes italic.
export const syntaxSegments = (text, runs, fallbackColor, colors = {}, effects = {}) => {
  const segments = [];
  const append = (start, end, color, bold, italic) => {
    if (start >= end) return;
    const previous = segments[segments.length - 1];
    if (previous?.color === color && previous?.bold === bold && previous?.italic === italic)
      previous.parts.push(text.slice(start, end));
    else segments.push({ parts: [text.slice(start, end)], color, bold, italic });
  };

  let cursor = 0;
  for (const run of runs ?? []) {
    if (!Number.isFinite(run?.start) || !Number.isFinite(run?.end)) continue;
    const start = Math.max(cursor, Math.min(text.length, Math.trunc(run.start)));
    const end = Math.max(start, Math.min(text.length, Math.trunc(run.end)));
    if (start > cursor) append(cursor, start, fallbackColor, false, false);
    const color = resolveScope(run.scope, colors) ?? fallbackColor;
    const effect = resolveScope(run.scope, effects);
    append(
      start,
      end,
      typeof color === "string" ? color : fallbackColor,
      Boolean(effect?.weight && effect.weight >= 700),
      Boolean(effect?.italic),
    );
    cursor = end;
  }
  if (cursor < text.length) append(cursor, text.length, fallbackColor, false, false);
  return segments.map(({ parts, color, bold, italic }) => {
    const segment = { text: parts.join(""), color };
    if (bold) segment.bold = true;
    if (italic) segment.italic = true;
    return segment;
  });
};
