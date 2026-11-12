import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { highlightLines, languageFor, syntaxPalette, syntaxSegments } from "../shared/syntax.js";

assert.equal(languageFor("src/view.tsx"), "js");
assert.equal(languageFor("src/tool.py"), "python");
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

const highlighted = highlightLines('const value = "hi";\n/* open\nclose */\n', "js", [1, 3]);
assert.deepEqual(
  highlighted.map(({ line }) => line),
  [1, 3],
);
assert.ok(highlighted[0].runs.some(run => run.scope === "keyword" && run.start === 0 && run.end === 5));
assert.ok(highlighted[0].runs.some(run => run.scope === "string" && run.start === 14 && run.end === 18));
assert.ok(highlighted[1].runs.some(run => run.scope === "comment" && run.start === 0 && run.end === 8));
const html = highlightLines('<main id="x">Hi</main>', "html", [1])[0].runs;
assert.ok(html.some(run => run.scope === "type" && run.start === 1 && run.end === 5));
assert.ok(html.some(run => run.scope === "keyword" && run.start === 6 && run.end === 8));
assert.ok(html.some(run => run.scope === "string" && run.start === 9 && run.end === 12));
assert.equal(syntaxPalette().keyword, "#ff8f40");
assert.notEqual(syntaxPalette(), syntaxPalette());

const ayuReference = JSON.parse(await readFile(new URL("../themes/ayu-dark.json", import.meta.url), "utf8"));
assert.equal(
  Object.keys(ayuReference.colors).some(key => key.startsWith("syntax_")),
  false,
);

console.log("shared syntax configuration tests passed");
