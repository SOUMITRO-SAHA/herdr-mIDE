import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { handleSaveShortcut } from "../mods/mide-editor/save-shortcut.js";

const calls = [];
const cx = { stop_propagation: () => calls.push("stop") };
const editor = { file: "/fixture/file", code: {}, save: context => calls.push(["save", context]) };
const key = (modifiers, extras = {}) => ({ key: "s", modifiers, ...extras });
const noBindings = () => [];
const layout = () => "herdr-mide";
for (const [platform, event] of [
  ["macos", key({ platform: true })],
  ["linux", key({ control: true })],
  ["windows", key({ control: true })],
]) {
  calls.length = 0;
  assert.equal(handleSaveShortcut(event, cx, editor, platform, noBindings, layout), true);
  assert.deepEqual(calls, ["stop", ["save", cx]]);
}
for (const [platform, event] of [
  ["macos", key({ control: true })],
  ["linux", key({ platform: true })],
  ["windows", key({ platform: true })],
  ["unknown", key({ control: true })],
  ["macos", key({ platform: true, shift: true })],
  ["macos", key({ platform: true, alt: true })],
  ["macos", key({ platform: true, control: true })],
  ["macos", key({ platform: true }, { is_held: true })],
  ["macos", key({ platform: true }, { key: "a" })],
]) {
  calls.length = 0;
  assert.equal(handleSaveShortcut(event, cx, editor, platform, noBindings, layout), false);
  assert.deepEqual(calls, []);
}
for (const binding of [
  { section: "global", keys: "cmd-s", action: "some.action" },
  { section: "mod:mide-editor", keys: "cmd-s", action: "mide-editor.save" },
  { section: "layout:herdr-mide", keys: "cmd-s", action: "other.action" },
  { section: "global", keys: "secondary-s", action: "other.action" },
  { section: "global", keys: "cmd-s a", action: "other.action" },
]) {
  calls.length = 0;
  assert.equal(
    handleSaveShortcut(key({ platform: true }), cx, editor, "macos", () => [binding], layout),
    false,
  );
  assert.deepEqual(calls, []);
}
for (const binding of [
  { section: "terminal", keys: "cmd-s", action: "terminal" },
  { section: "mod:other", keys: "cmd-s", action: "other.action" },
  { section: "layout:other", keys: "cmd-s", action: "other.action" },
]) {
  calls.length = 0;
  assert.equal(
    handleSaveShortcut(key({ platform: true }), cx, editor, "macos", () => [binding], layout),
    true,
  );
  assert.deepEqual(calls, ["stop", ["save", cx]]);
}
calls.length = 0;
assert.equal(
  handleSaveShortcut(key({ platform: true }), cx, { ...editor, file: null }, "macos", noBindings, layout),
  false,
);
assert.deepEqual(calls, []);
const source = readFileSync(new URL("../mods/mide-editor/main.js", import.meta.url), "utf8");
assert.match(source, /import \{ handleSaveShortcut \} from "\.\/save-shortcut\.js"/);
assert.match(source, /\.track_focus\(this\.handle\)\s*\.on_key_down\(\(e, cx\) => handleSaveShortcut\(/);
console.log("Editor default save-shortcut tests passed");
