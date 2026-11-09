import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

// Load the whole mod body with its imports stripped, so refresh()'s Git
// marks pipeline runs against stubbed Herdr APIs — including a Windows
// space cwd in backslash form.
const source = (await readFile(new URL("../mods/mide-files/main.js", import.meta.url), "utf8"))
  .replace(/^import .*;\n/gm, "")
  .replace(/\r\n/g, "\n")
  .replace("export default class MideFiles", "class MideFiles") + "\nMideFiles;";

const element = () => new Proxy({}, { get: () => () => element() });
const ROOT = "C:\\repo\\top";
const dirents = list => list.map(([name, dir]) => ({ name, isDirectory: () => dir }));
const calls = [];
const exec = async (program, args) => {
  calls.push({ program, args });
  if (args.includes("rev-parse")) return { code: 0, stdout: "C:/repo/top\n" };
  if (args.includes("--ignored=matching")) return { code: 0, stdout: " M sample.txt\0?? new.txt\0?? Agent notes/meeting notes.txt\0!! secret.log\0" };
  return { code: 0, stdout: " M sample.txt\0?? new.txt\0?? Agent notes/meeting notes.txt\0" };
};
const context = {
  View: class {}, div: element, svg: element, image: element, v_flex: element, h_flex: element,
  spaces: () => [{ id: "s1", active: true, tabs: [{ id: "t1" }], folder: ROOT }],
  panes: () => [{ tab: "t1", pane: "p1", terminal: "term-1", cwd: ROOT }],
  focused: () => ({ space: "s1", pane: "p1", tab: "t1" }),
  exec, watchFolder: () => new Promise(() => {}),
  theme: () => ({}), settings: () => ({}), setShared: () => {}, run: () => {},
  resolveIcon: () => null, gitColors: () => ({}),
  readdir: async () => dirents([["sample.txt", false], ["new.txt", false], ["Agent notes", true]]),
};
const MideFiles = runInNewContext(source, context);

const mod = new MideFiles();
let pending;
const cx = {
  spawn(fn) { pending = fn(this); return pending; },
  timer: { every() {} },
  notify() {},
};
mod.init({}, cx);
await pending;

// Mark keys are git-style forward-slash repository paths, so lookups built
// from the space's backslash cwd must be normalized before comparing.
assert.deepEqual({ ...mod.marks }, {
  "C:/repo/top/sample.txt": "M",
  "C:/repo/top/new.txt": "A",
  "C:/repo/top/Agent notes/meeting notes.txt": "A",
});
assert.equal(mod.marks[`${ROOT}/sample.txt`], undefined, "backslash keys must not be built");
const lookup = key => mod.marks[key.replace(/\\/g, "/")];
assert.equal(lookup(`${ROOT}/sample.txt`), "M", "render lookup (normalized) must hit the mark");

// A folder takes the most severe mark under it, derived through the
// backslash cwd prefix on Windows too.
assert.equal(mod.folderMarks.get("Agent notes"), "A", "folder marks must be derived through a backslash cwd");

assert.equal(mod.marks["C:/repo/top/secret.log"], undefined);
assert.ok(mod.ignored.has("C:/repo/top/secret.log"), "ignored paths must be keyed forward-slash");
assert.equal(calls.filter(c => c.program === "git").length, 3, "rev-parse + status + ignored status");

// Folder listings must be issued together, not walked serially: the tree
// should not wait for one folder before asking for the next.
let release;
const gate = new Promise(resolve => { release = resolve; });
let listings = 0;
context.readdir = async () => {
  listings++;
  await gate;
  return dirents([["x.txt", false]]);
};
mod.folders = new Set(["Agent notes"]);
let secondPending;
const secondCx = {
  spawn(fn) { secondPending = fn(this); return secondPending; },
  timer: { every() {} },
  notify() {},
};
mod.refresh(secondCx);
await Promise.resolve();
const concurrent = listings;
release();
await secondPending;
assert.ok(concurrent >= 2, `root and expanded-folder listings must run concurrently, got ${concurrent}`);

console.log("file git marks tests passed");
