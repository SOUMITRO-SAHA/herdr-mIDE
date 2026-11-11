import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// The optional key bindings must offer every platform's modifier: cmd on
// macOS, ctrl on Windows and Linux, where Herdr's key names are
// platform-literal and cmd-s matches no key.
const keys = JSON.parse(await readFile(new URL("../keys.json", import.meta.url), "utf8"));
assert.equal(keys.global["cmd-shift-e"]?.command, "pane.split");
assert.equal(keys.global["ctrl-shift-e"]?.command, "pane.split");
assert.equal(keys.global["cmd-shift-e"].args.mod, "mide-editor");
assert.equal(keys.global["ctrl-shift-e"].args.mod, "mide-editor");
assert.equal(keys["mod:mide-editor"]["cmd-s"], "mide-editor.save");
assert.equal(keys["mod:mide-editor"]["ctrl-s"], "mide-editor.save");
console.log("key binding tests passed");
