// AUTO-GENERATED FILE — never edit by hand.
// Source of truth: shared/syntax.js — regenerate with: sh scripts/materialize-shared.sh
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

// Canonical mIDE syntax palette. The editor and Diff both consume this table;
// keep syntax colors out of individual mods and themes to avoid drift.
const SYNTAX_COLORS = Object.freeze({
  keyword: "#ff8f40",
  string: "#aad94c",
  comment: "#5a6673",
  function: "#ffb454",
  type: "#59c2ff",
  number: "#d2a6ff",
  constant: "#d2a6ff",
  boolean: "#d2a6ff",
  variable: "#ffb454",
  operator: "#f29668",
  punctuation: "#8b939e",
  heading: "#aad94c",
  "markup.raw": "#f29668",
  "markup.bold": "#f07178",
  "markup.italic": "#f07178",
  link_uri: "#39bae6",
});

export const syntaxPalette = () => Object.freeze({ ...SYNTAX_COLORS });

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

const isWordStart = char => Boolean(char && /[A-Za-z_$]/.test(char));
const isWordPart = char => Boolean(char && /[A-Za-z0-9_$]/.test(char));
const appendRun = (runs, start, end, scope) => {
  if (start >= end) return;
  const previous = runs[runs.length - 1];
  if (previous?.scope === scope && previous.end === start) previous.end = end;
  else runs.push({ start, end, scope });
};

function markdownRuns(line) {
  const runs = [];
  if (/^\s{0,3}#{1,6}(?:\s|$)/.test(line)) {
    appendRun(runs, 0, line.length, "heading");
    return runs;
  }

  for (let index = 0; index < line.length;) {
    const remaining = line.slice(index);
    const code = /^(`+)(.*?)\1/.exec(remaining);
    if (code) {
      appendRun(runs, index, index + code[0].length, "markup.raw");
      index += code[0].length;
      continue;
    }
    const strong = /^(\*\*|__)(?=\S)(.+?)\1/.exec(remaining);
    if (strong) {
      appendRun(runs, index, index + strong[0].length, "markup.bold");
      index += strong[0].length;
      continue;
    }
    const emphasis = /^([*_])(?=\S)(.+?)\1/.exec(remaining);
    if (emphasis) {
      appendRun(runs, index, index + emphasis[0].length, "markup.italic");
      index += emphasis[0].length;
      continue;
    }
    const uri = /^\]\(([^)]+)\)/.exec(remaining);
    if (uri) {
      appendRun(runs, index + 2, index + uri[0].length - 1, "link_uri");
      index += uri[0].length;
      continue;
    }
    index++;
  }
  return runs;
}

function tokenizeLine(line, language, state) {
  if (language === "markdown") return markdownRuns(line);

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

// Returns 1-based source lines and UTF-16 ranges, matching JavaScript string
// slicing and the editor's line numbers. Only requested lines are returned,
// but all preceding lines are scanned so multiline comments/strings stay right.
export const highlightLines = (source, language, requestedLines) => {
  const lines = String(source ?? "").split("\n");
  const requested = new Set(
    (requestedLines ?? []).filter(line => Number.isInteger(line) && line > 0 && line <= lines.length),
  );
  if (!requested.size) return [];

  const state = { blockEnd: null, multilineQuote: null };
  const highlighted = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].endsWith("\r") ? lines[index].slice(0, -1) : lines[index];
    const runs = tokenizeLine(line, language, state);
    const lineNumber = index + 1;
    if (requested.has(lineNumber)) highlighted.push({ line: lineNumber, runs });
  }
  return highlighted;
};

const colorForScope = (scope, colors, fallbackColor) => {
  let name = scope;
  while (name) {
    if (colors[name]) return colors[name];
    const separator = name.lastIndexOf(".");
    name = separator < 0 ? "" : name.slice(0, separator);
  }
  return fallbackColor;
};

export const syntaxSegments = (text, runs, fallbackColor, colors = {}) => {
  const segments = [];
  const append = (start, end, color) => {
    if (start >= end) return;
    const previous = segments[segments.length - 1];
    if (previous?.color === color) previous.parts.push(text.slice(start, end));
    else segments.push({ parts: [text.slice(start, end)], color });
  };

  let cursor = 0;
  for (const run of runs ?? []) {
    if (!Number.isFinite(run?.start) || !Number.isFinite(run?.end)) continue;
    const start = Math.max(cursor, Math.min(text.length, Math.trunc(run.start)));
    const end = Math.max(start, Math.min(text.length, Math.trunc(run.end)));
    if (start > cursor) append(cursor, start, fallbackColor);
    append(start, end, colorForScope(run.scope, colors, fallbackColor));
    cursor = end;
  }
  if (cursor < text.length) append(cursor, text.length, fallbackColor);
  return segments.map(({ parts, color }) => ({ text: parts.join(""), color }));
};
