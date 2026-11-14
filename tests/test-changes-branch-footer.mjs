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
  elements.push({ calls, element });
  return element;
};

const branchFooter = new Function("div", "v_flex", "h_flex", "svg", "Popover", `return ({${footer}}).branchFooter`)(
  () => tracked(),
  () => tracked(),
  () => tracked(),
  () => tracked(),
  { new: () => tracked() },
);
const view = {
  root: `/workspace/${repository}`,
  branch,
  branchMenuOpen: false,
  branchQuery: { set_value: () => {}, focus: () => {} },
  remoteActions: () => tracked(),
  branchPicker: () => tracked(),
};
branchFooter.call(view, {}, { text: n => n });

// The row reserves the remote action's intrinsic width before assigning the
// remaining width to the names, including the popover's own layout wrapper.
const row = elements.find(element => element.calls.some(([name]) => name === "border_t"));
assert.ok(row, "the footer row keeps its top border");
assert.ok(
  row.calls.some(([name]) => name === "justify_between"),
  "the remote actions sit via justify_between",
);
const childElements = element =>
  element.calls.filter(([name]) => name === "child").map(([, child]) => elements.find(e => e.element === child));
const left = childElements(row).find(element => element?.calls.some(([name]) => name === "flex_1"));
assert.ok(left, "the names share a constrained flex item beside the remote action");
assert.ok(left.calls.some(([name, value]) => name === "min_w" && value === 0));
assert.ok(left.calls.some(([name]) => name === "overflow_hidden"));
const onNamesSize = left.calls.find(([name]) => name === "on_size_change")?.[1];
assert.equal(typeof onNamesSize, "function", "name limits adapt to the actual remaining width");
const remote = childElements(row).at(-1);
assert.ok(remote, "the remote action remains a direct child of the footer");

// Keep the repository visible without allowing a long name to take the row.
const repoLabel = elements.find(
  element =>
    element.calls.some(([n, v]) => n === "child" && v === repository) && element.calls.some(([n]) => n === "truncate"),
);
assert.ok(repoLabel, "the repository name is painted in the footer");
assert.ok(
  repoLabel.calls.some(([n, v]) => n === "flex_shrink" && v === 0),
  "the repository box stays visible",
);
assert.ok(
  repoLabel.calls.some(([n]) => n === "max_w"),
  "the repository box is capped so long names truncate",
);
assert.ok(!repoLabel.calls.some(([n]) => n === "min_w"), "the repository box must not carry the collapsing min_w(0)");
assert.ok(!repoLabel.calls.some(([n]) => n === "flex"), "the repository label must not lay its text out as a flex row");
assert.ok(childElements(left).includes(repoLabel), "the repository belongs to the constrained names group");

// The switcher takes the row's leftover space and ellipsizes where the text
// is painted — never on the flex container around it.
const trigger = elements.find(element => element.calls.some(([n, v]) => n === "id" && v === "mide-branch"));
assert.ok(trigger, "the branch switcher keeps its id");
const branchSlot = childElements(left).find(element => element?.calls.some(([name]) => name === "flex_1"));
assert.ok(branchSlot, "a flex slot constrains the popover, not only its trigger");
assert.ok(branchSlot.calls.some(([name, value]) => name === "min_w" && value === 0));
assert.ok(branchSlot.calls.some(([name]) => name === "overflow_hidden"));
const popover = childElements(branchSlot)[0];
assert.ok(popover.calls.some(([name, child]) => name === "trigger" && child === trigger.element));
const onSize = branchSlot.calls.find(([name]) => name === "on_size_change")?.[1];
assert.equal(typeof onSize, "function", "the slot reports its actual available width");
let notifications = 0;
onNamesSize({ width: 250 }, { notify: () => notifications++ });
onSize({ width: 120 }, { notify: () => notifications++ });
assert.equal(notifications, 2, "size changes cause a redraw");
onNamesSize({ width: 250 }, { notify: () => notifications++ });
onSize({ width: 120 }, { notify: () => notifications++ });
assert.equal(notifications, 2, "unchanged sizes do not cause repeated redraws");
elements.length = 0;
branchFooter.call(view, {}, { text: n => n });
const resizedRepo = elements.find(element => element.calls.some(([n, v]) => n === "child" && v === repository));
assert.ok(resizedRepo.calls.some(([n, value]) => n === "max_w" && value === 100));
const resizedTrigger = elements.find(element => element.calls.some(([n, v]) => n === "id" && v === "mide-branch"));
assert.ok(resizedTrigger.calls.some(([n, value]) => n === "w" && value === 120));
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
const branchLabel = elements.find(
  element =>
    element.calls.some(([n, v]) => n === "child" && v === branch) && element.calls.some(([n]) => n === "truncate"),
);
assert.ok(branchLabel, "the branch name is painted in the footer");
assert.ok(
  branchLabel.calls.some(([n, value]) => n === "w" && value === 112),
  "the label fits inside trigger padding",
);
assert.ok(!branchLabel.calls.some(([n]) => n === "flex"), "the branch label must not lay its text out as a flex row");

onSize({ width: 3 }, { notify: () => notifications++ });
elements.length = 0;
branchFooter.call(view, {}, { text: n => n });
const tinyLabel = elements.find(element => element.calls.some(([n, v]) => n === "child" && v === branch));
assert.ok(
  tinyLabel.calls.some(([n, value]) => n === "w" && value === 0),
  "tiny widths never produce negative sizes",
);

assert.match(footer, /accessibility_label\(`Switch branch/);
assert.match(footer, /\.content\(this\.branchPicker\(t, typography\)\)/, "the picker still opens from the switcher");

console.log("Changes branch footer tests passed");
