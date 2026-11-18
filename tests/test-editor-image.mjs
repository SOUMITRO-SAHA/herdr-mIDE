import assert from "node:assert/strict";
import { isEditorImageFile, resolveIcon } from "../mods/mide-files/icons.js";

assert.equal(resolveIcon("logo.png"), "image");
assert.equal(resolveIcon("photo.JPEG"), "image");
assert.equal(resolveIcon("favicon.ico"), "image");
assert.equal(resolveIcon("diagram.svg"), "svg");

assert.equal(isEditorImageFile("public/logo.png"), true);
assert.equal(isEditorImageFile("/work/repo/assets/shot.webp"), true);
assert.equal(isEditorImageFile("icons/settings.svg"), true);
assert.equal(isEditorImageFile("src/main.ts"), false);
assert.equal(isEditorImageFile("README.md"), false);
assert.equal(isEditorImageFile(""), false);

console.log("editor image classification tests passed");
