import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../mods/mide-diff/main.js", import.meta.url), "utf8");
assert.ok(!source.includes("frame/settings/refresh.svg"), "Diff must not reference Herdr's private frame assets");
assert.match(source, /\.accessibility_label\("Refresh diff"\).*\.child\("Refresh"\)/, "Diff must offer a labeled refresh control");

// The syntax maps are keyed "old"/"new" (see highlightFile); the split view's
// panes are "left"/"right", and a pane-name lookup silently yields no
// highlighting. Both panes must translate to the syntax side they show.
const splitPaneRow = /splitPaneRow\(row, side, t, typography\) \{[\s\S]*?\n  \}/.exec(source)?.[0] ?? "";
assert.ok(splitPaneRow, "splitPaneRow must exist");
assert.match(splitPaneRow, /syntax\?\.\[side === "left" \? "old" : "new"\]/,
  "split panes must resolve highlighting through the old/new syntax sides");
assert.ok(!/syntax\?\.\[side\]/.test(splitPaneRow), "panes must not look up a 'left'/'right' syntax side");
console.log("diff asset boundary tests passed");
