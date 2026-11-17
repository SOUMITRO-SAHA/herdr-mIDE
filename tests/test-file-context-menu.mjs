import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import * as actions from "../mods/mide-files/file-actions.js";

const source =
  (await readFile(new URL("../mods/mide-files/main.js", import.meta.url), "utf8"))
    .replace(/\r\n/g, "\n")
    .replace(/^import[^;]*?;\n/gm, "")
    .replace("export default class MideFiles", "class MideFiles") + "\nMideFiles;";

const ids = new Set(),
  labels = [],
  controls = new Map(),
  sharedValues = new Map(),
  commands = [],
  closed = [],
  clipboard = [],
  inputKeyHandlers = new Map(),
  inputStates = [],
  writes = [],
  execCalls = [];
function element() {
  let id;
  const proxy = new Proxy(
    {},
    {
      get(_target, method) {
        if (method === "id")
          return value => {
            id = value;
            ids.add(id);
            return proxy;
          };
        if (method === "child")
          return value => {
            if (typeof value === "string") labels.push(value);
            return proxy;
          };
        if (method === "on_click")
          return callback => {
            if (id) controls.set(id, callback);
            return proxy;
          };
        if (method === "on_key_down")
          return callback => {
            if (id) inputKeyHandlers.set(id, callback);
            return proxy;
          };
        if (method === "when") return (condition, callback) => (condition ? callback(proxy) : proxy);
        return () => proxy;
      },
    },
  );
  return proxy;
}

let currentProps;
let latestOverlay;
const context = {
  View: class {},
  div: element,
  svg: element,
  image: element,
  h_flex: element,
  v_flex: element,
  InputState: {
    new: options => {
      const state = {
        text: "",
        handlers: {},
        value() {
          return this.text;
        },
        on(event, callback) {
          this.handlers[event] = callback;
          return true;
        },
        focus() {},
        release() {
          return true;
        },
      };
      inputStates.push({ state, options });
      return state;
    },
  },
  Input: { new: () => element() },
  readdir: async () => [],
  spaces: () => [],
  panes: () => [],
  focused: () => null,
  exec: async (program, args, options) => {
    execCalls.push({ program, args, options });
    return { code: 0, stdout: "", stderr: "" };
  },
  watchFolder: async () => [],
  theme: () => ({ chrome: "#chrome", border: "#border", foreground: "#foreground", hover: "#hover", dim: "#dim" }),
  settings: () => ({ ui_font_size: 13, ui_font_family: "Geist" }),
  setShared: (key, value) => sharedValues.set(key, value),
  run: (name, args) => commands.push({ name, args }),
  window: () => ({ platform: "macos" }),
  props: () => currentProps,
  nextCommand: async () => undefined,
  shared: key => sharedValues.get(key),
  openOverlay: spec => ((latestOverlay = spec), "overlay"),
  closeOverlay: id => closed.push(id),
  notify: () => {},
  writeTextFile: async (...args) => writes.push(args),
  keys: () => [
    { section: "mod:mide-files", keys: "cmd-n", action: "mide-files.new-file" },
    { section: "mod:mide-files", keys: "cmd-shift-n", action: "mide-files.new-folder" },
  ],
  resolveIcon: () => null,
  gitColors: {},
  ...actions,
};
const MideFiles = runInNewContext(source, context);
const panel = new MideFiles();
Object.assign(panel, { root: "/work/repo", on: null, context: { space: "space-1" } });
panel.showContextMenu({ path: "src/main.js", rowKind: "file" }, { x: 84, y: 126 });
assert.equal(latestOverlay.mod, "mide-files");
assert.equal(latestOverlay.kind, "popup");
assert.deepEqual(latestOverlay.at, { x: 84, y: 126 });
assert.equal(latestOverlay.props.contextMenu.path, "src/main.js");
assert.equal(latestOverlay.props.contextMenu.root, "/work/repo");
assert.ok(latestOverlay.height > 0);

function renderMenu(menu, overlay) {
  currentProps = { contextMenu: menu, overlay };
  const view = new MideFiles();
  view.init({}, {});
  view.render({});
  return view;
}

const fileMenu = latestOverlay.props.contextMenu;
const fileView = renderMenu(fileMenu, "file-menu");
assert.ok(ids.has("mide-files-menu-open"));
assert.ok(ids.has("mide-files-menu-reveal"));
assert.ok(ids.has("mide-files-menu-copy-absolute-path"));
assert.ok(ids.has("mide-files-menu-copy-relative-path"));
assert.ok(ids.has("mide-files-menu-copy-name"));
assert.ok(ids.has("mide-files-menu-new-file"));
assert.ok(ids.has("mide-files-menu-new-folder"));
assert.ok(labels.includes("⌘N"), "the shortcut hint appears when the matching key is merged");

controls.get("mide-files-menu-copy-absolute-path")(null, {
  write_to_clipboard: value => clipboard.push(value),
});
assert.deepEqual(clipboard, ["/work/repo/src/main.js"]);
assert.deepEqual(closed, ["file-menu"]);

fileView.dispatchMenuAction("new-file", {});
assert.equal(sharedValues.get("mide.files.action.request").action, "new-file");
assert.deepEqual(commands.at(-1), { name: "mide-files.new-file", args: undefined });

panel.showContextMenu({ path: "src", rowKind: "folder" }, { x: 10, y: 20 });
const folderView = renderMenu(latestOverlay.props.contextMenu, "folder-menu");
assert.ok(ids.has("mide-files-menu-open-in-new-tab"));
folderView.dispatchMenuAction("open-in-new-tab", {});
assert.equal(commands.at(-1).name, "tab.new");
assert.equal(commands.at(-1).args.space, "space-1");
assert.equal(commands.at(-1).args.folder, "/work/repo/src");

panel.on = "build-machine";
panel.showContextMenu({ path: "src/main.js", rowKind: "file" }, { x: 10, y: 20 });
ids.clear();
renderMenu(latestOverlay.props.contextMenu, "remote-menu");
assert.equal(ids.has("mide-files-menu-reveal"), false, "remote rows must not offer local Reveal");
assert.match(source, /\.on_mouse_down\("right"/, "tree rows register a right-button handler");

const createCx = {
  notify() {},
  stop_propagation() {},
  spawn(callback) {
    const task = callback(createCx);
    tasks.push(task);
  },
};
const tasks = [];
Object.assign(panel, {
  root: "/work/repo",
  on: null,
  context: { key: "workspace", space: "space-1" },
  entries: new Map([["", [{ name: "exists.txt", dir: false }]]]),
  folders: new Set(),
  current: () => true,
  refresh: () => {},
  open: path => opened.push(path),
});
const opened = [];
panel.selected = { path: "", rowKind: "root" };
panel.startCreate("file", createCx);
const creationInput = inputStates.at(-1).state;
assert.equal(inputStates.at(-1).options.placeholder, "New file name");
creationInput.text = "exists.txt";
creationInput.handlers.submit(null, createCx);
assert.match(panel.createNote, /already exists/i, "duplicate targets stay in the inline editor");
assert.equal(writes.length, 0);
creationInput.text = "new.txt";
creationInput.handlers.submit(null, createCx);
await tasks.at(-1);
assert.deepEqual(writes, [["/work/repo/new.txt", "", null]]);
assert.deepEqual(opened, ["new.txt"], "a new file opens in the editor");
assert.equal(panel.pendingCreate, null);

panel.selected = { path: "", rowKind: "root" };
panel.startCreate("folder", createCx);
panel.createInputRow(0, { accent: "#accent", foreground: "#text", dim: "#dim" }, { text: n => n });
assert.equal(inputStates.at(-1).options.placeholder, "New folder name");
inputKeyHandlers.get("mide-files-create-input")({ key: "escape" }, createCx);
assert.equal(panel.pendingCreate, null, "Escape cancels inline creation");
assert.equal(writes.length, 1, "canceling does not create a file");

panel.startCreate("file", createCx);
const blurInput = inputStates.at(-1).state;
blurInput.text = "blur.txt";
blurInput.handlers.blur(null, createCx);
await tasks.at(-1);
assert.deepEqual(writes.at(-1), ["/work/repo/blur.txt", "", null], "blur confirms a valid name");

await panel.createWithShell("/remote/repo/new.txt", "file", "build-machine");
assert.equal(execCalls.at(-1).program, "sh");
assert.equal(execCalls.at(-1).options.on, "build-machine");
assert.equal(execCalls.at(-1).args.at(-1), "/remote/repo/new.txt");

console.log("file context menu tests passed");
