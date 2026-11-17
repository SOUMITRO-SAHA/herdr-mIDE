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
assert.equal(keys["mod:mide-files"]["cmd-n"], "mide-files.new-file");
assert.equal(keys["mod:mide-files"]["alt-cmd-n"], "mide-files.new-folder");
assert.equal(keys["mod:mide-files"]["alt-cmd-r"], "mide-files.reveal");
assert.equal(keys["mod:mide-files"]["alt-cmd-c"], "mide-files.copy-absolute-path");
assert.equal(keys["mod:mide-files"]["alt-cmd-shift-c"], "mide-files.copy-relative-path");
assert.equal(keys["mod:mide-files"]["ctrl-n"], "mide-files.new-file");
assert.equal(keys["mod:mide-files"]["alt-ctrl-n"], "mide-files.new-folder");
assert.equal(keys["mod:mide-files"]["ctrl-alt-r"], "mide-files.reveal");
assert.equal(keys["mod:mide-files"]["ctrl-alt-c"], "mide-files.copy-absolute-path");
assert.equal(keys["mod:mide-files"]["ctrl-alt-shift-c"], "mide-files.copy-relative-path");
assert.equal(keys["mod:mide-files"]["alt-n"], "mide-files.new-folder");
assert.equal(keys["mod:mide-files"]["alt-shift-c"], "mide-files.copy-absolute-path");
for (const chord of Object.keys(keys["mod:mide-files"])) {
  assert.ok(
    !Object.entries(keys).some(([section, bindings]) => section !== "mod:mide-files" && chord in bindings),
    `${chord} must not conflict with another bundle key`,
  );
}
console.log("key binding tests passed");
