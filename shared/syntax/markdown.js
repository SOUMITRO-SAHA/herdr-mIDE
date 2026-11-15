// Markdown tokenizer for mIDE's shared syntax module. Registered in
// shared/syntax.js's per-language map; the contract matches the generic
// tokenizer's — one line in, UTF-16 runs out, `state` mutated so fenced code
// blocks and table context survive across lines (highlightLines scans all
// preceding lines, so only the requested ones need returning).
//
// The coloring rules mirror Zed's Markdown grammars
// (crates/grammars/src/markdown/highlights.scm and markdown-inline/
// highlights.scm, studied from the vendored checkout): headings, setext
// underlines and thematic breaks are "title"; list markers are
// "punctuation.list_marker"; quote markers, table pipes and delimiter dashes
// are "punctuation.markup"; fence delimiters and info strings are
// "punctuation.embedded" (all resolve to Ayu punctuation gray); emphasis is
// "emphasis", strong is "emphasis.strong"; code spans are "text.literal";
// link text/brackets are "link_text" and destinations/parens/autolinks are
// "link_uri". Bare URLs and strikethrough stay plain — Zed's grammar does not
// capture them — and fence content with no info string or an unknown language
// renders plain (no injection).
//
// state: { fence: { char, length, language, codeState } | null, table: boolean }
//
// Run-append and word-part helpers mirror syntax.js's rather than importing
// them: syntax.js imports this module, so the graph must stay cycle-free.

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const HEADING = /^\s{0,3}#{1,6}(?:\s|$)/;
// Thematic breaks and setext underlines share Zed's "title" capture; the
// dash form needs two or more so a lone "-" stays a list marker.
const TITLE_LINE = /^ {0,3}(?:-{2,}|\*{3,}|_{3,}|=+)\s*$/;
const LIST_MARKER = /^(\s*)([-*+]|\d{1,9}[.)])( .*)?$/;
const DELIMITER_CELL = /^ *:?-+:? *$/;
const STRONG = /^(\*\*|__)(?=\S)(.*?\S)\1/;
const EMPHASIS = /^([*_])(?=\S)(.*?\S)\1/;
const IMAGE = /^!\[([^\]]*)\]\(([^)]*)\)/;
const LINK = /^\[((?:[^[\]]|\[[^\]]*\])*)\]\(([^)]*)\)/;
const AUTOLINK = /^<(?:[a-zA-Z][a-zA-Z\d+.-]{1,31}:[^<>\s]*|mailto:[^<>\s]+|[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+)>/;

const appendRun = (runs, start, end, scope) => {
  if (start >= end) return;
  const previous = runs[runs.length - 1];
  if (previous?.scope === scope && previous.end === start) previous.end = end;
  else runs.push({ start, end, scope });
};

const isWordPart = char => Boolean(char && /[A-Za-z0-9_$]/.test(char));

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
const inlineRuns = (runs, text, from, to, depth = 0) => {
  let index = from;
  while (index < to) {
    if (text[index] === "\\") {
      // Escaped character — never opens a span.
      index += 2;
      continue;
    }

    const rest = text.slice(index, to);

    const code = /^(`+)([\s\S]*?)\1/.exec(rest);
    if (code) {
      appendRun(runs, index, index + code[0].length, "text.literal");
      index += code[0].length;
      continue;
    }

    const strong = STRONG.exec(rest);
    if (strong) {
      const strongEnd = index + strong[0].length;
      const underscore = strong[1][0] === "_";
      const flanking =
        !underscore ||
        ((index === 0 || !isWordPart(text[index - 1])) && (strongEnd >= to || !isWordPart(text[strongEnd])));
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

    const emphasis = EMPHASIS.exec(rest);
    if (emphasis) {
      const emphasisEnd = index + emphasis[0].length;
      const underscore = emphasis[1] === "_";
      const flanking =
        !underscore ||
        ((index === 0 || !isWordPart(text[index - 1])) && (emphasisEnd >= to || !isWordPart(text[emphasisEnd])));
      if (flanking) {
        appendRun(runs, index, emphasisEnd, "emphasis");
        index = emphasisEnd;
        continue;
      }
    }

    const image = IMAGE.exec(rest);
    if (image) {
      const altStart = index + 2;
      const altEnd = altStart + image[1].length; // before the ]
      appendRun(runs, index, index + 2, "link_text"); // ![
      const inner = [];
      if (depth < 2 && image[1]) inlineRuns(inner, text, altStart, altEnd, depth + 1);
      let cursor = altStart;
      for (const run of inner) {
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

    const link = LINK.exec(rest);
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

    const autolink = AUTOLINK.exec(rest);
    if (autolink) {
      appendRun(runs, index, index + autolink[0].length, "link_uri");
      index += autolink[0].length;
      continue;
    }

    index++;
  }
};

// Table rows (header, body): pipes are punctuation.markup and cell contents
// keep the inline rules. Zed styles nothing else — header rows are ordinary.
const tableRow = (runs, line) => {
  let index = 0;
  while (index < line.length) {
    const pipe = line.indexOf("|", index);
    if (pipe < 0) {
      inlineRuns(runs, line, index, line.length);
      break;
    }
    inlineRuns(runs, line, index, pipe);
    appendRun(runs, pipe, pipe + 1, "punctuation.markup");
    index = pipe + 1;
  }
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

export const tokenizeLine = (line, state, context) => {
  const runs = [];

  if (state.fence) {
    const { char, length, language, codeState } = state.fence;
    if (isClosingFence(line, char, length)) {
      appendRun(runs, 0, line.length, "punctuation.embedded");
      state.fence = null;
      return runs;
    }
    // Inner lines highlight with the fenced language's own rules — Zed's
    // injection — and unknown languages (or no info string) render plain.
    if (!language) return runs;
    return context.tokenize(line, language, codeState);
  }

  const opening = FENCE_OPEN.exec(line);
  if (opening) {
    const char = opening[1][0];
    const info = opening[2].trim();
    // A backtick fence's info string may not contain backticks (CommonMark);
    // such a line is prose, not a fence.
    if (char !== "`" || !info.includes("`")) {
      const word = info.split(/\s+/)[0] ?? "";
      appendRun(runs, 0, opening[1].length, "punctuation.embedded");
      if (word) appendRun(runs, opening[1].length, opening[1].length + word.length, "punctuation.embedded");
      state.fence = {
        char,
        length: opening[1].length,
        language: context.resolveLanguage(word),
        codeState: {},
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
