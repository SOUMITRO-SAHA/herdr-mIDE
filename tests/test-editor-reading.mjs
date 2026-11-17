import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import {
  fenceLanguage,
  highlightLines,
  languageFor,
  syntaxEffects,
  syntaxPalette,
  syntaxSegments,
} from "../shared/syntax.js";

// The Editor's Raw mode renders markdown files with the shared tokenizer's
// Zed rules (the host editor's public syntax palette has no markdown scopes,
// so it can never match). Reading view: virtualized rows with a line-number
// gutter, colored segments, and Zed's font effects; an Edit toggle swaps to
// the host editor for changes; non-markdown files and Preview are unchanged.
// The reading cache is built off the render path — in load and on click —
// because the host interrupts scripts that highlight while painting.
let highlightCalls = 0;
const source =
  (await readFile(new URL("../mods/mide-editor/main.js", import.meta.url), "utf8"))
    .replace(/\r\n/g, "\n")
    .replace(/^import[^;]*?;\n/gm, "")
    .replace("export default class MideEditor", "class MideEditor") + "\nMideEditor;";

function node() {
  const n = {
    tag: "el",
    kids: [],
    text: "",
    color: undefined,
    bold: false,
    italic: false,
    onClick: undefined,
    virtual: undefined,
    child(value) {
      if (typeof value === "string") {
        n.kids.push({ text: value });
        if (!n.text) n.text = value;
      } else n.kids.push(value.self ?? value);
      return n.proxy;
    },
    children(array) {
      for (const item of array ?? []) n.child(item);
      return n.proxy;
    },
    id(value) {
      n.id = value;
      return n.proxy;
    },
    text_color(value) {
      n.color = value;
      return n.proxy;
    },
    font_bold() {
      n.bold = true;
      return n.proxy;
    },
    italic() {
      n.italic = true;
      return n.proxy;
    },
    font_weight(value) {
      if (value >= 700) n.bold = true;
      return n.proxy;
    },
    on_click(callback) {
      n.onClick = callback;
      return n.proxy;
    },
    when(condition, callback) {
      return condition ? callback(n.proxy) : n.proxy;
    },
  };
  n.self = n;
  n.proxy = new Proxy(n, {
    get(target, method) {
      const value = target[method];
      if (typeof value === "function" || (method in target && value !== undefined)) return value;
      return () => target.proxy;
    },
  });
  return n.proxy;
}

const controls = new Map();
function element() {
  const n = node();
  const original = n.on_click.bind(n);
  n.on_click = callback => {
    if (n.id) controls.set(n.id, callback);
    return original(callback);
  };
  return n.proxy;
}

let editorNewCalls = 0;
let markdownCalls = 0;
const codeOptions = [],
  readRequests = [],
  writes = [];
const context = {
  View: class {},
  div: element,
  svg: element,
  v_flex: element,
  h_flex: element,
  Editor: {
    new: state => {
      editorNewCalls += 1;
      return element();
    },
  },
  EditorState: {
    new: options => {
      codeOptions.push(options);
      return { value: () => options?.value ?? "", on() {}, release() {} };
    },
  },
  TextView: {
    markdown: () => {
      markdownCalls += 1;
      return element();
    },
  },
  Checkbox: { new: element },
  Popover: { new: element },
  VirtualListScrollHandle: { new: () => ({}) },
  Scrollbar: { vertical: element },
  v_virtual_list: (id, count, itemHeight, rowKey, builder) => {
    const n = element();
    n.virtual = { id, count, itemHeight, rowKey, builder };
    n.id(id);
    return n;
  },
  theme: () => ({
    accent: "#accent",
    background: "#background",
    chrome: "#chrome",
    border: "#border",
    foreground: "#foreground",
    muted: "#muted",
    dim: "#dim",
    hover: "#hover",
    selected: "#selected",
    raised: "#raised",
    ansi1: "#ansi1",
  }),
  settings: () => ({}),
  shared: () => false,
  setShared: () => {},
  window: () => ({ platform: "macos" }),
  keys: {},
  props: () => undefined,
  nextCommand: async () => undefined,
  readTextFile: async (file, options) => (readRequests.push({ file, options }), MD),
  writeTextFile: async (...args) => writes.push(args),
  languageFor,
  fenceLanguage,
  syntaxPalette,
  syntaxEffects,
  syntaxSegments,
  highlightLines: (...args) => {
    highlightCalls += 1;
    return highlightLines(...args);
  },
};
const MideEditor = runInNewContext(source, context);
const pending = [];
const cx = {
  notify() {},
  timer: { after() {} },
  spawn(fn) {
    const promise = fn(cx);
    pending.push(promise);
    return promise;
  },
};

const MD = [
  "# Reading view",
  "",
  "Prose with **bold** and a [link](https://example.com).",
  "",
  "```js",
  "const value = 1;",
  "```",
].join("\n");
const codeStub = value => ({ value: () => value, release() {} });

const editor = new MideEditor();
Object.assign(editor, {
  file: "notes.md",
  baseline: MD,
  code: codeStub(MD),
  dirty: false,
  truncated: false,
  saving: false,
  saved: false,
  note: null,
  drafts: new Map(),
  editorMode: "raw",
  markdownPreviewDefault: false,
  wordWrap: false,
  rawEditing: false,
  reading: null,
});

// Real flow: load builds the cache off the render path; render only reads it.
editor.buildReading();
highlightCalls = 0;
const renderedRoot = editor.render(cx);
const root = renderedRoot.self ?? renderedRoot;
const find = (parent, id) => {
  parent = parent.self ?? parent;
  if (parent.id === id) return parent;
  for (const kid of parent.kids ?? []) {
    if (kid.tag) {
      const hit = find(kid, id);
      if (hit) return hit;
    }
  }
  return null;
};
const readingList = find(root, "mide-editor-reading-list");
assert.ok(readingList?.virtual, "markdown raw mode renders the reading view");
assert.equal(readingList.virtual.count, 7);
assert.equal(readingList.virtual.itemHeight, 20, "line height follows the editor font size");
assert.equal(editorNewCalls, 0, "the host editor is not rendered in reading mode");
assert.ok(controls.has("mide-editor-reading-toggle"), "an Edit toggle is present");
assert.equal(highlightCalls, 0, "render never highlights — the cache was built off the render path");

const rows = readingList.virtual.builder({ start: 0, end: 7 });
assert.equal(rows.length, 7);
const flatten = parent => {
  const out = [];
  for (const kid of parent.kids ?? []) {
    out.push(kid);
    if (kid.tag) out.push(...flatten(kid));
  }
  return out;
};
const flat = flatten(rows[0]);
assert.ok(
  flat.some(kid => kid.text === "1"),
  "gutter shows the line number",
);
assert.ok(
  flat.some(kid => kid.bold && kid.color === "#bfbdb6" && kid.text?.includes("#")),
  "headings render bold in Zed's title color",
);
const proseFlat = flatten(rows[2]);
assert.ok(
  proseFlat.some(kid => kid.italic && kid.color === "#fe8f40"),
  "link text renders orange italic",
);
assert.ok(
  proseFlat.some(kid => kid.color === "#aad84c" && kid.text === "(https://example.com)"),
  "link destinations render green",
);
const codeFlat = flatten(rows[5]);
assert.ok(
  codeFlat.some(kid => kid.color === "#ff8f3f" && kid.text === "const"),
  "fenced code keeps the inner language colors",
);
assert.ok(
  flatten(rows[1]).every(kid => !kid.color || kid.color === "#foreground" || kid.color === "#dim"),
  "plain lines stay in the theme foreground (gutter aside)",
);

controls.get("mide-editor-reading-toggle")(null, cx);
const editRoot = editor.render(cx).self ?? editor.render(cx);
assert.ok(editorNewCalls > 0, "the Edit toggle swaps to the host editor");
const toggleText = flatten(find(editRoot, "mide-editor-reading-toggle")).find(kid => kid.text);
assert.equal(toggleText?.text, "View", "the toggle offers the way back");

editor.code = codeStub(MD + "\nEdited after the fact.");
controls.get("mide-editor-reading-toggle")(null, cx);
const backRoot = editor.render(cx).self ?? editor.render(cx);
const rebuilt = find(backRoot, "mide-editor-reading-list");
assert.ok(rebuilt?.virtual, "the toggle returns to the reading view");
assert.equal(rebuilt.virtual.count, 8, "the cache rebuilt from the edited buffer");
assert.ok(highlightCalls > 0, "the toggle built the cache off the render path");

// The Raw tab click also builds the cache before rendering.
Object.assign(editor, { editorMode: "preview", reading: null });
editor.render(cx);
highlightCalls = 0;
controls.get("mide-editor-raw")(null, cx);
assert.equal(editor.editorMode, "raw");
assert.ok(editor.reading, "the Raw tab built the cache in the click handler");

// Non-markdown files keep the host editor with no reading view or toggle.
editorNewCalls = 0;
Object.assign(editor, { file: "main.js", editorMode: "raw", rawEditing: false, reading: null });
editor.code = codeStub("const x = 1;\n");
const jsRoot = editor.render(cx);
assert.ok(editorNewCalls > 0, "code files edit in the host editor");
assert.equal(find(jsRoot, "mide-editor-reading-list"), null);

// Preview mode is unchanged.
Object.assign(editor, { file: "notes.md", editorMode: "preview" });
markdownCalls = 0;
editor.render(cx);
assert.ok(markdownCalls > 0, "preview still renders TextView markdown");

// A freshly loaded markdown file builds its cache in the load task.
Object.assign(editor, { file: "doc.md", editorMode: "raw", rawEditing: true, reading: null });
editor.load("doc.md", null, cx);
await pending.pop();
assert.equal(editor.rawEditing, false, "a freshly opened file starts in the reading view");
assert.equal(editor.reading?.length, MD.split("\n").length, "load built the reading cache");

editor.load("/remote/repo/new file.txt", "build-machine", cx);
await pending.pop();
assert.equal(readRequests.at(-1).file, "/remote/repo/new file.txt");
assert.equal(readRequests.at(-1).options.on, "build-machine", "remote opens read from the target machine");
assert.equal(codeOptions.at(-1).readonly, true, "remote files open read-only without a public remote write API");
assert.equal(editor.on, "build-machine");
editor.save(cx);
assert.match(editor.note, /read-only/);
assert.equal(writes.length, 0, "saving a remote buffer must never write to the local machine");
const remoteRoot = editor.render(cx);
assert.equal(find(remoteRoot, "mide-editor-save"), null, "remote files do not show a Save action");
assert.equal(find(remoteRoot, "mide-editor-save-status").text, "Remote · read-only");

console.log("editor markdown reading view tests passed");
