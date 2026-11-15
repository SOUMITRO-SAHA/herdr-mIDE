// AUTO-GENERATED FILE — never edit by hand.
// Source of truth: shared/syntax/markdown.js — regenerate with: sh scripts/materialize-shared.sh
// Markdown tokenizer for mIDE's shared syntax module. Registered in
// shared/syntax.js's per-language map; the contract matches the generic
// tokenizer's — one line in, UTF-16 runs out, `state` mutated so fenced code
// blocks and table context survive across lines (highlightLines scans all
// preceding lines, so only the requested ones need returning).
//
// state: { fence: { char, length, language, codeState } | null, table: boolean }
//
// Run-append and word-part helpers mirror syntax.js's rather than importing
// them: syntax.js imports this module, so the graph must stay cycle-free.

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const HEADING = /^\s{0,3}#{1,6}(?:\s|$)/;
const LIST_MARKER = /^(\s*)([-*+]|\d{1,9}[.)])( .*)?$/;
const DELIMITER_CELL = /^ *:?-+:? *$/;
const STRONG = /^(\*\*|__)(?=\S)(.*?\S)\1/;
const EMPHASIS = /^([*_])(?=\S)(.*?\S)\1/;
const IMAGE = /^!\[([^\]]*)\]\(([^)]*)\)/;
const LINK = /^\[((?:[^[\]]|\[[^\]]*\])*)\]\(([^)]*)\)/;
const AUTOLINK = /^<(?:[a-zA-Z][a-zA-Z\d+.-]{1,31}:[^<>\s]*|mailto:[^<>\s]+|[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+)>/;
const BARE_URL = /^(?:https?:\/\/|mailto:)[^\s<>]+/;
const URI_ONLY = /^\]\(([^)]*)\)/;

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

// GFM strips one run of trailing punctuation from bare URLs (and unbalanced
// closing parentheses, so "(https://x)" links cleanly).
const bareUrlEnd = url => {
  let end = url.length;
  for (;;) {
    const last = url[end - 1];
    if (last === ")") {
      const opens = (url.slice(0, end).match(/\(/g) ?? []).length;
      const closes = (url.slice(0, end).match(/\)/g) ?? []).length;
      if (closes > opens) {
        end--;
        continue;
      }
    } else if (last && /[.,;:!?'"]/.test(last)) {
      end--;
      continue;
    }
    break;
  }
  return end;
};

// Inline markdown: code spans, strong/emphasis with delimiter flanking rules,
// images, links, autolinks, bare URLs. `depth` caps nesting (emphasis inside
// link text inside a table cell) so pathological prose cannot recurse deeply.
// Intraword `*`/`_` never emphasizes — snake_case and 2**3**2 stay plain,
// which is the safer default for a review pane.
const inlineRuns = (runs, text, from, to, depth = 0) => {
  let index = from;
  while (index < to) {
    const rest = text.slice(index, to);

    const code = /^(`+)([\s\S]*?)\1/.exec(rest);
    if (code) {
      appendRun(runs, index, index + code[0].length, "markup.raw");
      index += code[0].length;
      continue;
    }

    const flanking = index === 0 || !isWordPart(text[index - 1]);
    const strong = STRONG.exec(rest);
    if (strong) {
      const strongEnd = index + strong[0].length;
      if (flanking && (strongEnd >= to || !isWordPart(text[strongEnd]))) {
        appendRun(runs, index, strongEnd, "markup.bold");
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
      if (flanking && (emphasisEnd >= to || !isWordPart(text[emphasisEnd]))) {
        appendRun(runs, index, emphasisEnd, "markup.italic");
        index = emphasisEnd;
        continue;
      }
    }

    const image = IMAGE.exec(rest);
    if (image) {
      appendRun(runs, index, index + image[0].length, "link_uri");
      index += image[0].length;
      continue;
    }

    const link = LINK.exec(rest);
    if (link) {
      const textEnd = index + 1 + link[1].length;
      appendRun(runs, index, index + 1, "link_uri");
      if (depth < 2 && link[1]) inlineRuns(runs, text, index + 1, textEnd, depth + 1);
      else appendRun(runs, index + 1, textEnd, "link_uri");
      appendRun(runs, textEnd, index + link[0].length, "link_uri");
      index += link[0].length;
      continue;
    }

    const autolink = AUTOLINK.exec(rest);
    if (autolink) {
      appendRun(runs, index, index + autolink[0].length, "link_uri");
      index += autolink[0].length;
      continue;
    }

    const bare = BARE_URL.exec(rest);
    if (bare && (index === 0 || (!isWordPart(text[index - 1]) && text[index - 1] !== "/"))) {
      appendRun(runs, index, index + bareUrlEnd(bare[0]), "link_uri");
      index += bare[0].length;
      continue;
    }

    const uri = URI_ONLY.exec(rest);
    if (uri) {
      appendRun(runs, index + 2, index + 2 + uri[1].length, "link_uri");
      index += uri[0].length;
      continue;
    }

    index++;
  }
};

// Table body row: pipes are punctuation, cell contents stay inline markdown.
const tableRow = (runs, line) => {
  let index = 0;
  while (index < line.length) {
    const pipe = line.indexOf("|", index);
    if (pipe < 0) {
      inlineRuns(runs, line, index, line.length);
      break;
    }
    inlineRuns(runs, line, index, pipe);
    appendRun(runs, pipe, pipe + 1, "punctuation");
    index = pipe + 1;
  }
};

export const tokenizeLine = (line, state, context) => {
  const runs = [];

  if (state.fence) {
    const { char, length, language, codeState } = state.fence;
    if (isClosingFence(line, char, length)) {
      appendRun(runs, 0, line.length, "punctuation");
      state.fence = null;
      return runs;
    }
    // Inner lines highlight with the fenced language; context.tokenize goes
    // through the registry, so fenced blocks of dedicated languages (today:
    // markdown itself) keep their module, everything else stays generic.
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
      appendRun(runs, 0, opening[1].length, "punctuation");
      if (word) appendRun(runs, opening[1].length, opening[1].length + word.length, "type");
      state.fence = {
        char,
        length: opening[1].length,
        language: word.toLowerCase() || "txt",
        codeState: {},
      };
      state.table = false;
      return runs;
    }
  }

  if (HEADING.test(line)) {
    appendRun(runs, 0, line.length, "heading");
    return runs;
  }

  if (/^ {0,3}>/.test(line)) {
    let index = line.match(/^ {0,3}/)[0].length;
    while (line[index] === ">") {
      appendRun(runs, index, index + 1, "punctuation");
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
    appendRun(runs, markerStart, markerEnd, "punctuation");
    inlineRuns(runs, line, list[3] ? markerEnd + 1 : markerEnd, line.length);
    return runs;
  }

  if (isDelimiterRow(line)) {
    appendRun(runs, 0, line.length, "punctuation");
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

  // A pipe row directly above a delimiter row is that table's header.
  if (line.includes("|") && isDelimiterRow(context.lines[context.index + 1] ?? "")) {
    appendRun(runs, 0, line.length, "markup.bold");
    return runs;
  }

  inlineRuns(runs, line, 0, line.length);
  return runs;
};
