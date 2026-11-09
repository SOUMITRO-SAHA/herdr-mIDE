import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../mods/mide-diff/main.js", import.meta.url), "utf8");
assert.ok(!source.includes("frame/settings/refresh.svg"), "Diff must not reference Herdr's private frame assets");
assert.match(source, /\.accessibility_label\("Refresh diff"\).*\.child\("Refresh"\)/, "Diff must offer a labeled refresh control");
console.log("diff asset boundary tests passed");
