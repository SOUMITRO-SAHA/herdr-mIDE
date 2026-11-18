import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { languageFor, syntaxPalette } from "../shared/syntax.js";
import { isEditorRasterImage, isEditorSvgImage } from "../mods/mide-files/icons.js";

const repo = fileURLToPath(new URL("..", import.meta.url));
const svgFixture = `${repo}/mods/mide-files/icons/settings.svg`;
const pngFixture = `${repo}/public/logo.png`;

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
    onClick: undefined,
    child(value) {
      if (typeof value === "string") {
        n.kids.push({ text: value });
        if (!n.text) n.text = value;
      } else n.kids.push(value.self ?? value);
      return n.proxy;
    },
    when(condition, callback) {
      return condition ? callback(n.proxy) : n.proxy;
    },
    id(value) {
      n.id = value;
      return n.proxy;
    },
    on_click(callback) {
      n.onClick = callback;
      return n.proxy;
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

const SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">',
  '  <rect width="16" height="16" fill="#336"/>',
  "</svg>",
].join("\n");

let fileText = SVG;
let editorNewCalls = 0;
const pending = [];

const context = {
  View: class {},
  div: element,
  svg: element,
  image: path => {
    const el = element();
    el.imagePath = path;
    return el;
  },
  v_flex: element,
  h_flex: element,
  Editor: {
    new: () => {
      editorNewCalls += 1;
      return element();
    },
  },
  EditorState: {
    new: options => {
      let value = options?.value ?? "";
      return {
        value: () => value,
        on() {},
        release() {},
      };
    },
  },
  TextView: { markdown: () => element() },
  Checkbox: { new: element },
  Popover: { new: element },
  theme: () => ({
    accent: "#a",
    background: "#b",
    chrome: "#c",
    border: "#d",
    foreground: "#e",
    muted: "#f",
    dim: "#g",
    hover: "#h",
    selected: "#i",
    raised: "#j",
    ansi1: "#k",
  }),
  settings: () => ({}),
  shared: () => false,
  setShared: () => {},
  window: () => ({ platform: "macos" }),
  keys: {},
  props: () => undefined,
  nextCommand: async () => undefined,
  readTextFile: async () => fileText,
  writeTextFile: async () => {},
  languageFor,
  syntaxPalette,
  isEditorRasterImage,
  isEditorSvgImage,
  checking: () => false,
  appHome: () => "/tmp/herdr-app-home",
  exec: async (cmd, args) => {
    if (cmd === "sips") return { code: 0, stdout: "  pixelWidth: 32\n  pixelHeight: 32\n", stderr: "" };
    if (cmd === "cmp") return { code: 1, stdout: "", stderr: "" };
    return { code: 0, stdout: "", stderr: "" };
  },
};

const MideEditor = runInNewContext(source, context);
const cx = {
  notify() {},
  timer: { after() {} },
  spawn(fn) {
    const promise = fn(cx);
    pending.push(promise);
    return promise;
  },
};

const find = (parent, id) => {
  parent = parent.self ?? parent;
  if (parent.id === id) return parent;
  for (const kid of parent.kids ?? []) {
    if (kid.tag) {
      const hit = find(kid, id);
      if (hit) return hit;
    }
    if (kid.imagePath !== undefined && (id === "mide-editor-image-asset" || kid.id === id)) return kid;
  }
  return null;
};

const editor = new MideEditor();
Object.assign(editor, {
  drafts: new Map(),
  markdownPreviewDefault: false,
  wordWrap: false,
  settingsOpen: false,
});

// SVG: default Raw, Raw/Preview tabs, Preview stages and shows image().
assert.ok(isEditorSvgImage(svgFixture));
assert.ok(!isEditorRasterImage(svgFixture));
editor.load(svgFixture, null, cx);
await Promise.all(pending.splice(0));
assert.equal(editor.editorMode, "raw");
assert.ok(editor.code, "SVG Raw loads editable text");
editorNewCalls = 0;
let root = editor.render(cx);
root = root.self ?? root;
assert.ok(find(root, "mide-editor-raw"), "SVG shows Raw tab");
assert.ok(find(root, "mide-editor-preview"), "SVG shows Preview tab");
assert.equal(find(root, "mide-editor-image-preview"), null, "Raw mode does not show image pane");
assert.ok(editorNewCalls > 0, "SVG Raw uses host editor");

controls.get("mide-editor-preview")(null, cx);
await Promise.all(pending.splice(0));
assert.equal(editor.editorMode, "preview");
assert.equal(editor.imagePreviewPath, "mide-editor-preview/settings.svg");
root = editor.render(cx);
root = root.self ?? root;
assert.ok(find(root, "mide-editor-image-preview"), "SVG Preview shows image pane");
const asset = find(root, "mide-editor-image-asset");
assert.ok(asset, "SVG Preview uses image()");
assert.equal(asset.imagePath, "mide-editor-preview/settings.svg");

controls.get("mide-editor-raw")(null, cx);
await Promise.all(pending.splice(0));
assert.equal(editor.editorMode, "raw");
editorNewCalls = 0;
root = editor.render(cx);
root = root.self ?? root;
assert.equal(find(root, "mide-editor-image-preview"), null, "back to Raw drops image pane");
assert.ok(editorNewCalls > 0, "SVG Raw again uses host editor");

// Raster: always Preview, no tabs.
assert.ok(isEditorRasterImage(pngFixture));
editor.load(pngFixture, null, cx);
await Promise.all(pending.splice(0));
assert.equal(editor.editorMode, "preview");
root = editor.render(cx);
root = root.self ?? root;
assert.equal(find(root, "mide-editor-raw"), null, "PNG has no Raw tab");
assert.equal(find(root, "mide-editor-preview"), null, "PNG has no Preview tab");
assert.ok(find(root, "mide-editor-image-preview"), "PNG opens in image preview");

console.log("editor SVG and raster preview tests passed");
