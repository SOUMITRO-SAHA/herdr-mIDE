import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";

const source = (await readFile(new URL("../mods/mide-editor/main.js", import.meta.url), "utf8"))
  .replace(/^import .*;\n/gm, "")
  .replace("export default class MideEditor", "class MideEditor") + "\nMideEditor;";
const controls = new Map();
const rendered = new Map();
function element() {
  let id, color;
  const proxy = new Proxy({}, { get(_target, method) {
    if (method === "id") return value => { id = value; rendered.set(id, {}); return proxy; };
    if (method === "text_color") return value => { color = value; if (id) rendered.get(id).color = value; return proxy; };
    if (method === "child") return value => { if (id && typeof value === "string") rendered.get(id).text = value; return proxy; };
    if (method === "on_click") return callback => { if (id) controls.set(id, callback); return proxy; };
    if (method === "when") return (condition, callback) => condition ? callback(proxy) : proxy;
    return () => proxy;
  } });
  return proxy;
}
let write = async (path, value, expected) => {
  if (await readFile(path, "utf8") !== expected) throw new Error("File changed outside Herdr");
  await writeFile(path, value);
};
const context = {
  View: class {}, div: element, svg: element, v_flex: element, h_flex: element,
  Editor: { new: element }, EditorState: {}, TextView: { markdown: element },
  Checkbox: { new: element }, Popover: { new: element },
  theme: () => ({ accent: "primary-accent" }), settings: () => ({}), shared: () => false, setShared: () => {},
  languageFor: () => "text", syntaxPalette: () => ({}),
  readTextFile: path => readFile(path, "utf8"), writeTextFile: (...args) => write(...args),
};
const MideEditor = runInNewContext(source, context);
const pending = [];
const timers = [];
const cx = { notify() {}, timer: { after(ms, callback) { timers.push({ ms, callback }); } },
  spawn(fn) { const promise = fn(cx); pending.push(promise); return promise; } };
const root = await mkdtemp(join(tmpdir(), "mide-editor-save-"));
try {
  const file = join(root, "example.txt");
  await writeFile(file, "original\n");
  let value = "edited\n";
  const editor = new MideEditor();
  Object.assign(editor, { file, baseline: "original\n", code: { value: () => value }, dirty: true,
    truncated: false, saving: false, drafts: new Map(), editorMode: "raw" });

  editor.render(cx);
  assert.ok(controls.has("mide-editor-save"), "a visible Save control must work without a custom key binding");
  assert.equal(rendered.get("mide-editor-dirty").color, "primary-accent");
  assert.equal(rendered.get("mide-editor-save-status").text, "⌘S save");
  controls.get("mide-editor-save")(null, cx);
  await pending.pop();
  assert.equal(await readFile(file, "utf8"), "edited\n");
  assert.equal(editor.dirty, false);
  editor.render(cx);
  assert.equal(rendered.get("mide-editor-save-status").text, "Saved");
  assert.ok(timers[0].ms > 0 && timers[0].ms <= 3000);
  timers.shift().callback(cx);
  editor.render(cx);
  assert.equal(rendered.get("mide-editor-save-status").text, "⌘S save");

  value = "first edit\n";
  editor.dirty = true;
  let release;
  const realWrite = write;
  write = async (...args) => { await new Promise(resolve => { release = resolve; }); return realWrite(...args); };
  editor.save(cx);
  editor.render(cx);
  assert.equal(rendered.get("mide-editor-save-status").text, "Saving…");
  value = "later edit\n";
  release();
  await pending.pop();
  assert.equal(await readFile(file, "utf8"), "first edit\n");
  assert.equal(editor.baseline, "first edit\n");
  assert.equal(editor.dirty, true, "edits made during a write must remain unsaved");
  editor.render(cx);
  assert.equal(rendered.get("mide-editor-save-status").text, "⌘S save", "later edits must not appear fully saved");

  // A later draft must be compared with the write that actually completed,
  // even if another file is displayed before the write finishes.
  editor.save(cx);
  editor.drafts.set(file, { value: "newer draft\n", baseline: editor.baseline, truncated: false });
  editor.file = join(root, "other.txt");
  release();
  await pending.pop();
  assert.equal(await readFile(file, "utf8"), "later edit\n");
  assert.equal(editor.drafts.get(file).baseline, "later edit\n");
  assert.equal(editor.drafts.get(file).value, "newer draft\n");

  editor.file = file;
  editor.baseline = editor.drafts.get(file).baseline;
  value = editor.drafts.get(file).value;
  write = realWrite;
  await writeFile(file, "external edit\n");
  editor.save(cx);
  await pending.pop();
  assert.equal(await readFile(file, "utf8"), "external edit\n");
  assert.equal(editor.dirty, true);
  assert.match(editor.note, /Save failed/);

  editor.truncated = true;
  editor.save(cx);
  assert.match(editor.note, /Too large to save/);
  assert.equal(await readFile(file, "utf8"), "external edit\n");
  console.log("editor save tests passed");
} finally {
  await rm(root, { recursive: true, force: true });
}
