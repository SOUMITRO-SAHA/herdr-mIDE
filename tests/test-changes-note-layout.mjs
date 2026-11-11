import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../mods/mide-changes/main.js", import.meta.url), "utf8");
const start = source.indexOf("  noteRow(");
assert.notEqual(start, -1, "all inline action errors need a bounded note row");
const end = source.indexOf("  branchPicker(", start);
assert.ok(end > start);

// Exercise the row builder without a window: its height and clipping must not
// depend on the length of Git output or the currently open tab.
const calls = [];
const div = () => new Proxy({}, { get: (_target, method) => (...args) => {
  calls.push([method, ...args]);
  if (method === "when" && args[0]) args[1](element);
  return element;
} });
const element = div();
const noteRow = new Function("div", "v_flex", `return ({${source.slice(start, end)}}).noteRow`)(() => element, () => element);
noteRow.call({ note: "a very long error ".repeat(50) }, { ansi1: "red" }, { text: (n) => n });
assert.ok(calls.some(([name]) => name === "truncate"), "note text must not wrap into other controls");
assert.ok(calls.some(([name]) => name === "overflow_hidden"), "the note row must clip overflow");
assert.ok(calls.some(([name]) => name === "flex_none"), "the row must retain its own vertical space");
calls.length = 0;
noteRow.call({ note: "Uncommitted changes to a long filename would be overwritten — commit or stash them first." }, { ansi1: "red" }, { text: (n) => n });
assert.ok(calls.some(([name, text]) => name === "child" && text === "commit or stash them first."), "recovery guidance must have its own visible line");

// Picker owns the single row while open; Changes and History own it while
// closed. Check both conditional render paths, not only the Git action.
assert.match(source, /\.when\(Boolean\(this\.note\),\s*\(e\) => e\.child\(this\.noteRow\(t, typography\)\)\)/);
assert.match(source, /\.when\(Boolean\(this\.note\) && !this\.branchMenuOpen,\s*\(e\) => e\.child\(this\.noteRow\(t, typography\)\)\)/);
assert.match(source, /\.when\(this\.view === "history" && Boolean\(this\.note\) && !this\.branchMenuOpen,\s*\(el\) => el\.child\(this\.noteRow\(t, typography\)\)\)/);
console.log("Changes note layout tests passed");
