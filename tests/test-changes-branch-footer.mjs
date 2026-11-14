import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../mods/mide-changes/main.js", import.meta.url), "utf8");
const start = source.indexOf("  branchFooter(");
assert.notEqual(start, -1, "the branch footer builds its own row");
const end = source.indexOf("  historyRow(", start);
assert.ok(end > start);
const footer = source.slice(start, end);

const branch = "feature/savings-assistant-phase-2-beta-integration";
const repository = "long-repository-name";

// A fresh element per builder call, so styles can be attributed to the exact
// element that received them — the footer's truncation chain is about which
// element carries which style.
const elements = [];
const tracked = () => {
  const calls = [];
  const element = new Proxy(
    {},
    {
      get:
        (_target, method) =>
        (...args) => {
          calls.push([String(method), ...args]);
          if (method === "when" && args[0]) args[1](element);
          return element;
        },
    },
  );
  elements.push({ calls });
  return element;
};

const branchFooter = new Function("div", "v_flex", "h_flex", "svg", "Popover", `return ({${footer}}).branchFooter`)(
  () => tracked(),
  () => tracked(),
  () => tracked(),
  () => tracked(),
  { new: () => tracked() },
);
branchFooter.call(
  {
    root: `/workspace/${repository}`,
    branch,
    branchMenuOpen: false,
    branchQuery: { set_value: () => {}, focus: () => {} },
    remoteActions: () => tracked(),
    branchPicker: () => tracked(),
  },
  {},
  { text: n => n },
);

const byStyle = style => elements.filter(element => element.calls.some(([name]) => name === style));

// The row hands its free space to one branch-context group and anchors the
// remote actions at the far edge — no spacer child competes for space.
const row = elements.find(element => element.calls.some(([name]) => name === "border_t"));
assert.ok(row, "the footer row keeps its top border");
assert.ok(
  row.calls.some(([name]) => name === "justify_between"),
  "the remote actions sit via justify_between",
);
assert.equal(byStyle("flex_1").length, 1, "exactly one element grows into the free space: the branch-context group");
const group = byStyle("flex_1")[0];
assert.ok(
  group.calls.some(([name]) => name === "overflow_hidden"),
  "the group clips its children",
);
assert.ok(
  group.calls.some(([name]) => name === "min_w"),
  "the group may shrink below its content",
);
assert.ok(
  !elements.some(element => element.calls.some(([name]) => name === "max_w")),
  "names shrink proportionally — a fixed cap would freeze one of them",
);

// The repository and branch labels truncate where the text is painted: on a
// plain element that may shrink, never on the flex container around it.
const label = element =>
  element.calls.some(([name]) => name === "truncate") &&
  element.calls.some(([name, value]) => name === "child" && typeof value === "string");
const repoLabel = elements.find(
  element => label(element) && element.calls.some(([n, v]) => n === "child" && v === repository),
);
const branchLabel = elements.find(
  element => label(element) && element.calls.some(([n, v]) => n === "child" && v === branch),
);
assert.ok(repoLabel, "the repository name is painted in the footer");
assert.ok(branchLabel, "the branch name is painted in the footer");
for (const [name, element] of [
  ["repository", repoLabel],
  ["branch", branchLabel],
]) {
  assert.ok(
    element.calls.some(([n]) => n === "min_w"),
    `the ${name} label may shrink`,
  );
  assert.ok(!element.calls.some(([n]) => n === "flex"), `the ${name} label must not lay its text out as a flex row`);
}

// The switcher is the press target: it clips what overflows it, while the
// ellipsis lives on the label inside.
const trigger = elements.find(element => element.calls.some(([n, v]) => n === "id" && v === "mide-branch"));
assert.ok(trigger, "the branch switcher keeps its id");
assert.ok(
  trigger.calls.some(([n]) => n === "overflow_hidden"),
  "the switcher clips overflowing text",
);
assert.ok(!trigger.calls.some(([n]) => n === "truncate"), "the switcher is a flex container — it cannot ellipsize");
assert.ok(
  !trigger.calls.some(([n, v]) => n === "child" && typeof v === "string"),
  "the branch name belongs to the truncating label inside",
);
assert.ok(
  trigger.calls.some(([n]) => n === "cursor_pointer"),
  "the switcher stays clickable",
);
assert.ok(
  trigger.calls.some(([n]) => n === "hover"),
  "the switcher keeps its hover state",
);
assert.match(footer, /accessibility_label\(`Switch branch/);
assert.match(footer, /\.content\(this\.branchPicker\(t, typography\)\)/, "the picker still opens from the switcher");

console.log("Changes branch footer tests passed");
