import assert from "node:assert/strict";
import { resolveIcon } from "../mods/mide-files/icons.js";

// List manifests are configuration — same gear glyph as ini/conf/npmrc.
assert.equal(resolveIcon("shared-modules.list"), "settings");
assert.equal(resolveIcon("sources.list"), "settings");

// systemd unit files are declarative service config — gear glyph too.
assert.equal(resolveIcon("herdr.service"), "settings");
assert.equal(resolveIcon("ssh.service"), "settings");

// The whole .env.* family reads as environment config, however it is
// suffixed — covered by the prefix rule, not one-by-one names.
assert.equal(resolveIcon(".env"), "tune");
assert.equal(resolveIcon(".env.production.local"), "tune");
assert.equal(resolveIcon(".env.vault"), "tune");
assert.equal(resolveIcon(".env.keys"), "tune");
assert.equal(resolveIcon(".env.shared"), "tune");
assert.equal(resolveIcon(".env.staging.local.example"), "tune");
// …while env-adjacent names keep their own glyphs.
assert.equal(resolveIcon(".envrc"), "console");
assert.equal(resolveIcon(".dev.vars"), "tune");
// A bare `env` file (the dot-less dotenv convention) is env config too,
// and sudoers is a credentials file.
assert.equal(resolveIcon("env"), "tune");
assert.equal(resolveIcon("sudoers"), "key");

// Task-runner and release files in this repo's root were missed by the
// generated map: Just's justfile takes the theme's dedicated Just glyph
// (upstream maps justfile/.justfile → just), and a bare VERSION file is
// release metadata — the same gear glyph the theme gives .tool-versions.
assert.equal(resolveIcon("justfile"), "just");
assert.equal(resolveIcon(".justfile"), "just");
assert.equal(resolveIcon("VERSION"), "settings");
// Shell scripts keep the console glyph.
assert.equal(resolveIcon("install.sh"), "console");

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
