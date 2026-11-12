import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { handleCommitShortcut } from "../mods/mide-changes/commit-shortcut.js";

const calls = [];
const cx = { stop_propagation: () => calls.push("stop") };
const view = { typing: true, view: "changes", commit: context => calls.push(["commit", context]) };
const event = (key, modifiers = {}, is_held = false) => ({ key, modifiers, is_held });
assert.equal(handleCommitShortcut(event("enter", { control: true }), cx, view), true);
assert.deepEqual(calls, ["stop", ["commit", cx]]);
for (const input of [
  event("enter"),
  // Cmd+Enter uses the native textarea submit event; do not intercept the
  // platform key (Windows/Super on other systems) in the wrapper.
  event("enter", { platform: true }),
  event("escape", { control: true }),
  event("enter", { control: true, shift: true }),
  event("enter", { control: true, alt: true }),
  event("enter", { control: true, platform: true }),
  event("enter", { control: true }, true),
]) {
  calls.length = 0;
  assert.equal(handleCommitShortcut(input, cx, view), false);
  assert.deepEqual(calls, []);
}
for (const other of [
  { ...view, typing: false },
  { ...view, view: "history" },
]) {
  calls.length = 0;
  assert.equal(handleCommitShortcut(event("enter", { control: true }), cx, other), false);
  assert.deepEqual(calls, []);
}
const source = readFileSync(new URL("../mods/mide-changes/main.js", import.meta.url), "utf8");
assert.match(source, /import \{ handleCommitShortcut \} from "\.\/commit-shortcut\.js"/);
assert.match(source, /\.on_key_down\(\(e, cx\) => \{\s*if \(handleCommitShortcut\(e, cx, this\)\) return;/);
assert.match(source, /this\.input\.on\("submit", \(_e, cx\) => this\.commit\(cx\)\)/);
console.log("Changes commit-shortcut tests passed");
