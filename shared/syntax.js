const LANG = {
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
export const languageFor = (file) => {
  const ext = file.includes(".") ? file.split(".").pop().toLowerCase() : "txt";
  return LANG[ext] ?? ext;
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
