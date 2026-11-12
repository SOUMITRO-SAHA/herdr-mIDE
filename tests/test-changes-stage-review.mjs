import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { toggleStage } from "../mods/mide-changes/stage-action.js";

const file = { path: "AGENTS.md" };
const cx = { id: "context" };
const calls = [];
const actions = {
  openDiff: (f, context) => calls.push(["openDiff", f, context]),
  stage: (f, context) => calls.push(["stage", f, context]),
  unstage: (f, context) => calls.push(["unstage", f, context]),
};

toggleStage(file, true, cx, actions);
assert.deepEqual(calls, [["stage", file, cx]]);

calls.length = 0;
toggleStage(file, false, cx, actions);
assert.deepEqual(calls, [["unstage", file, cx]]);

assert.equal(
  calls.some(([action]) => action === "openDiff"),
  false,
);

// Exercise the actual file-row builder and bubble clicks through its tree.
// The checkbox may consume its own click in the host, so do not rely on a
// checkbox click listener to stop the row's separate click handler.
function element() {
  const node = { children: [], parent: null, click: null };
  return new Proxy(node, {
    get(target, property, receiver) {
      if (property in target) return Reflect.get(target, property, receiver);
      if (property === "child")
        return child => {
          if (child && typeof child === "object") {
            child.parent = receiver;
            target.children.push(child);
          }
          return receiver;
        };
      if (property === "on_click")
        return handler => {
          target.click = handler;
          return receiver;
        };
      if (property === "when") return (condition, fn) => (condition ? fn(receiver) : receiver);
      return () => receiver;
    },
  });
}
const source = readFileSync(new URL("../mods/mide-changes/main.js", import.meta.url), "utf8");
const rowMethod = source.slice(source.indexOf("  fileRow("), source.indexOf("  group(", source.indexOf("  fileRow(")));
const fileRow = new Function("h_flex", "div", "gitStatusColor", "toggleStage", `return ({${rowMethod}}).fileRow`)(
  element,
  element,
  () => "color",
  toggleStage,
);
let checkbox;
const rowCalls = [];
const view = {
  open: null,
  openDiff: () => rowCalls.push("openDiff"),
  stage: () => rowCalls.push("stage"),
  unstage: () => rowCalls.push("unstage"),
  stageCheckbox: (_id, _label, _checked, _indeterminate, _t, _type, onChange) => {
    checkbox = element();
    checkbox.click = () => onChange(true, cx);
    return checkbox;
  },
};
const row = fileRow.call(view, { path: "test.js", status: "M", unstaged: true }, {}, { text: n => n });
for (let node = checkbox; node; node = node.parent) node.click?.({}, cx);
assert.deepEqual(rowCalls, ["stage"], "clicking a checkbox must not open the diff");
rowCalls.length = 0;
for (let node = row.children[0]; node; node = node.parent) node.click?.({}, cx);
assert.deepEqual(rowCalls, ["openDiff"], "clicking the file content opens the diff");
console.log("Changes stage-action tests passed");
