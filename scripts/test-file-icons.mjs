import assert from "node:assert/strict";
import { resolveIcon } from "../mods/mide-files/icons.js";

// List manifests are configuration — same gear glyph as ini/conf/npmrc.
assert.equal(resolveIcon("shared-modules.list"), "settings");
assert.equal(resolveIcon("sources.list"), "settings");

// Resolution order stays: exact name first, then longest dotted suffix.
assert.equal(resolveIcon("readme.txt"), "readme");
assert.equal(resolveIcon("LICENSE.txt"), "license");
assert.equal(resolveIcon("foo.d.ts"), "typescript-def");
assert.equal(resolveIcon("agent-relay-pairing.test.ts"), "test-ts");
assert.equal(resolveIcon("Dockerfile.prod"), "docker");
assert.equal(resolveIcon("flake.nix"), "nix");
assert.equal(resolveIcon("Makefile"), "makefile");

// Unmapped names fall back to the plain file glyph.
assert.equal(resolveIcon("unknown.zzz"), null);

console.log("file icon mapping tests passed");
