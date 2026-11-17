import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { languageFor, syntaxPalette } from "../shared/syntax.js";

// Markdown Raw uses the same editable host editor as other files. Preview
// remains available, and restoring a draft must retain its editable buffer.
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
let editorOptions;
let fileText;
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
      editorOptions = options;
      codeOptions.push(options);
      let value = options?.value ?? "";
      let change;
      return {
        value: () => value,
        edit(text, cx) {
          value = text;
          change?.(null, cx);
        },
        on(_event, callback) {
          change = callback;
        },
        release() {},
      };
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
  readTextFile: async (file, options) => (readRequests.push({ file, options }), fileText ?? MD),
  writeTextFile: async (...args) => writes.push(args),
  languageFor,
  syntaxPalette,
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
});

// Raw Markdown is immediately editable and never exposes an Edit/View toggle.
const renderedRoot = editor.render(cx);
const root = renderedRoot.self ?? renderedRoot;
const readingList = find(root, "mide-editor-reading-list");
assert.equal(readingList, null);
assert.ok(editorNewCalls > 0, "Markdown Raw uses the host editor directly");
assert.equal(find(root, "mide-editor-reading-toggle"), null);

// Preview and Raw switch back to the same editable buffer.
Object.assign(editor, { editorMode: "preview" });
editor.render(cx);
controls.get("mide-editor-raw")(null, cx);
assert.equal(editor.editorMode, "raw");

// Non-markdown files keep the host editor with no reading view or toggle.
editorNewCalls = 0;
Object.assign(editor, { file: "main.js", editorMode: "raw" });
editor.code = codeStub("const x = 1;\n");
const jsRoot = editor.render(cx);
assert.ok(editorNewCalls > 0, "code files edit in the host editor");
assert.equal(find(jsRoot, "mide-editor-reading-list"), null);

// Preview mode is unchanged.
Object.assign(editor, { file: "notes.md", editorMode: "preview" });
markdownCalls = 0;
editor.render(cx);
assert.ok(markdownCalls > 0, "preview still renders TextView markdown");

// A freshly loaded Markdown file and restored draft open in the host editor.
Object.assign(editor, { file: "doc.md", editorMode: "raw" });
editor.load("doc.md", null, cx);
await pending.pop();
assert.equal(editorOptions.language, "markdown");
assert.deepEqual(editorOptions.syntax, syntaxPalette());
editorNewCalls = 0;
editor.render(cx);
assert.ok(editorNewCalls > 0);
editor.code.edit("unsaved draft", cx);
editor.openFile("other.md", null, cx);
await pending.pop();
editor.openFile("doc.md", null, cx);
editorNewCalls = 0;
editor.render(cx);
assert.ok(editorNewCalls > 0, "restored draft opens in the editor");
assert.equal(editor.code.value(), "unsaved draft");
fileText = "long ".repeat(2000);
editor.openFile("long.md", null, cx);
await pending.pop();
assert.equal(editor.code.value(), fileText, "long Markdown lines remain intact in Raw");
editorNewCalls = 0;
editor.render(cx);
assert.ok(editorNewCalls > 0);

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

console.log("editor Markdown Raw tests passed");
