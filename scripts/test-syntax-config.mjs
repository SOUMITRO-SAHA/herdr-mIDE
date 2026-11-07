import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { languageFor, syntaxSegments } from "../shared/syntax.js";

assert.equal(languageFor("src/view.tsx"), "js");
assert.equal(languageFor("notes.mdown"), "markdown");
assert.equal(languageFor("settings.jsonc"), "json");
assert.equal(languageFor("Dockerfile"), "txt");

assert.deepEqual(
  syntaxSegments("α const x", [{ start: 2, end: 7, scope: "keyword" }], "#plain", { keyword: "#123456" }),
  [
    { text: "α ", color: "#plain" },
    { text: "const", color: "#123456" },
    { text: " x", color: "#plain" },
  ],
);
assert.deepEqual(
  syntaxSegments("escape", [{ start: 0, end: 6, scope: "string.escape" }], "#plain", { string: "#654321" }),
  [{ text: "escape", color: "#654321" }],
);

const ayuReference = JSON.parse(await readFile(new URL("../themes/ayu-dark.json", import.meta.url), "utf8"));
assert.equal(Object.keys(ayuReference.colors).some(key => key.startsWith("syntax_")), false);

console.log("shared syntax configuration tests passed");
