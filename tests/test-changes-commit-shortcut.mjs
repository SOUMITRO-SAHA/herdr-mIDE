import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { handleCommitShortcut } from "../mods/mide-changes/commit-shortcut.js";

const calls = [];
const cx = { stop_propagation: () => calls.push("stop") };
const view = { typing: true, view: "changes", commit: context => calls.push(["commit", context]) };
const event = (key, modifiers = {}, is_held = false) => ({ key, modifiers, is_held });

// Ctrl+Enter submits everywhere.
assert.equal(handleCommitShortcut(event("enter", { control: true }), cx, view), true);
assert.equal(handleCommitShortcut(event("enter", { control: true }), cx, view, "linux"), true);
assert.equal(handleCommitShortcut(event("enter", { control: true }), cx, view, "macos"), true);
assert.deepEqual(calls, ["stop", ["commit", cx], "stop", ["commit", cx], "stop", ["commit", cx]]);

// The platform key (Cmd on macOS) submits there, and only there.
calls.length = 0;
assert.equal(handleCommitShortcut(event("enter", { platform: true }), cx, view, "macos"), true);
assert.deepEqual(calls, ["stop", ["commit", cx]]);
for (const platform of ["linux", "windows", ""]) {
  calls.length = 0;
  assert.equal(handleCommitShortcut(event("enter", { platform: true }), cx, view, platform), false);
  assert.deepEqual(calls, []);
}

for (const input of [
  event("enter"),
  // Windows/Super on other systems stays with the system even on macOS chords.
  event("enter", { platform: true, control: true }, false),
  event("escape", { control: true }),
  event("enter", { control: true, shift: true }),
  event("enter", { control: true, alt: true }),
  event("enter", { control: true, platform: true }),
  event("enter", { platform: true, shift: true }),
  event("enter", { platform: true, alt: true }),
  event("enter", { platform: true, function: true }),
  event("enter", { control: true }, true),
]) {
  calls.length = 0;
  assert.equal(handleCommitShortcut(input, cx, view, "macos"), false);
  assert.deepEqual(calls, []);
}
for (const other of [
  { ...view, typing: false },
  { ...view, view: "history" },
]) {
  calls.length = 0;
  assert.equal(handleCommitShortcut(event("enter", { control: true }), cx, other, "macos"), false);
  assert.deepEqual(calls, []);
}

// A fresh element per builder call, so the button's calls can be attributed.
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

const source = readFileSync(new URL("../mods/mide-changes/main.js", import.meta.url), "utf8");
const start = source.indexOf("  commitSubmitButton(");
assert.notEqual(start, -1, "the composer has a dedicated submit control");
const end = source.indexOf("  commitStack(", start);
assert.ok(end > start);
const svgPaths = [];
const svgBuilder = path => {
  svgPaths.push(path);
  return tracked();
};
const commitSubmitButton = new Function(
  "h_flex",
  "svg",
  "div",
  `return ({${source.slice(start, end)}}).commitSubmitButton`,
)(tracked, svgBuilder, tracked);

const submitted = [];
const buttonView = state => ({ commit: () => submitted.push(true), ...state });
const buttonFor = state => {
  const before = elements.length;
  const button = commitSubmitButton.call(
    buttonView(state),
    { foreground: 1, border: 2, background: 3, hover: 4, muted: 5, surface: 6 },
    { text: n => n },
  );
  return elements.slice(before);
};

// With a message and a repository, the button commits on click. Following the
// reference IDE's ghost icon buttons, the chip is always drawn in the
// surface fill so it reads against the footer: the glyph brightens to the
// foreground when a commit can run, and the disabled state keeps the fill
// with a border ring rather than fading out.
let built = buttonFor({ root: "/repo", message: "fix: something", busy: false, loading: false });
let button = built.find(({ calls }) => calls.some(([m, v]) => m === "id" && v === "mide-commit-submit"));
assert.ok(button, "the submit control renders");
assert.ok(
  button.calls.some(([m, v]) => m === "bg" && v === 6),
  "an enabled button is filled with the surface color",
);
assert.ok(!button.calls.some(([m]) => m === "border_color"), "an enabled button keeps the ghost fill borderless");
assert.ok(button.calls.some(([m, v]) => m === "accessibility_label" && v === "Commit"));
assert.ok(
  svgPaths.includes("mods/mide-files/icons/chevron-right.svg"),
  "the control shows the credited chevron-right glyph",
);
assert.ok(
  built.some(({ calls }) => calls.some(([m, v]) => m === "text_color" && v === 1)),
  "an enabled glyph brightens to the foreground color",
);
assert.ok(
  button.calls.some(([m]) => m === "cursor_pointer"),
  "an enabled button is pointer-styled",
);
assert.ok(
  button.calls.some(([m]) => m === "hover"),
  "an enabled button registers hover feedback",
);
button.calls.find(([m]) => m === "on_click")[1](undefined, cx);
assert.deepEqual(submitted, [true], "clicking an enabled button commits");

// Without a message it renders disabled and clicks do nothing.
submitted.length = 0;
built = buttonFor({ root: "/repo", message: "   ", busy: false, loading: false });
button = built.find(({ calls }) => calls.some(([m, v]) => m === "id" && v === "mide-commit-submit"));
assert.ok(
  button.calls.some(([m, v]) => m === "bg" && v === 6),
  "a disabled button keeps the visible surface fill",
);
assert.ok(
  button.calls.some(([m, v]) => m === "border_color" && v === 2),
  "a disabled button carries a border ring",
);
assert.ok(
  built.some(({ calls }) => calls.some(([m, v]) => m === "text_color" && v === 5)),
  "a disabled glyph reads as muted, not invisible",
);
button.calls.find(([m]) => m === "on_click")[1](undefined, cx);
assert.deepEqual(submitted, [], "a disabled button does not commit");
assert.ok(!button.calls.some(([m]) => m === "cursor_pointer"), "a disabled button is not pointer-styled");

// The composer wires the button in beside the staged count, and the key
// handler passes the platform so Cmd+Enter can submit on macOS.
assert.match(source, /\.child\(this\.commitSubmitButton\(t, typography\)\)/);
assert.match(source, /import \{ handleCommitShortcut \} from "\.\/commit-shortcut\.js"/);
assert.match(source, /if \(handleCommitShortcut\(e, cx, this, window\(\)\.platform\)\) return;/);
console.log("Changes commit-shortcut tests passed");
