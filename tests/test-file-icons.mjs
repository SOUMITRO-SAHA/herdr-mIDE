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

// Repository root docs take the theme's dedicated glyphs where upstream
// has them (exact fileNames in the v5.39.0 manifest); docs without an
// upstream mapping keep the markdown glyph — VS Code with the theme
// renders those the same way.
assert.equal(resolveIcon("AGENTS.md"), "agent");
assert.equal(resolveIcon("CHANGELOG.md"), "changelog");
assert.equal(resolveIcon("changelog.rst"), "changelog");
assert.equal(resolveIcon("CONTRIBUTING.md"), "contributing");
assert.equal(resolveIcon("CONTRIBUTING"), "contributing");
assert.equal(resolveIcon("ROADMAP.md"), "roadmap");
assert.equal(resolveIcon("roadmap.txt"), "roadmap");
assert.equal(resolveIcon("RECIPE.md"), "markdown");
assert.equal(resolveIcon("RELEASING.md"), "markdown");
assert.equal(resolveIcon("TESTING.md"), "markdown");
assert.equal(resolveIcon("THIRD-PARTY-NOTICES.md"), "markdown");
assert.equal(resolveIcon("roadmap"), null); // no bare "roadmap" upstream; a dotless name has no md suffix either

// The Prettier config family takes the theme's Prettier glyph. Upstream
// maps it via the Cosmiconfig filename pattern, which the generated map
// skips — so the expansion is enumerated: .prettierrc and its suffixed
// variants, the .config/prettierrc* convention (lifted to bare basenames
// because resolution is name-only), and prettier.config.* files.
assert.equal(resolveIcon(".prettierrc"), "prettier");
assert.equal(resolveIcon(".prettierrc.json"), "prettier");
assert.equal(resolveIcon(".prettierrc.jsonc"), "prettier");
assert.equal(resolveIcon(".prettierrc.json5"), "prettier");
assert.equal(resolveIcon(".prettierrc.yaml"), "prettier");
assert.equal(resolveIcon(".prettierrc.yml"), "prettier");
assert.equal(resolveIcon(".prettierrc.toml"), "prettier");
assert.equal(resolveIcon(".prettierrc.js"), "prettier");
assert.equal(resolveIcon(".prettierrc.mjs"), "prettier");
assert.equal(resolveIcon(".prettierrc.cjs"), "prettier");
assert.equal(resolveIcon(".prettierrc.ts"), "prettier");
assert.equal(resolveIcon(".prettierrc.mts"), "prettier");
assert.equal(resolveIcon(".prettierrc.cts"), "prettier");
assert.equal(resolveIcon(".prettierignore"), "prettier");
// .config/prettierrc* basenames — see the comment above.
assert.equal(resolveIcon("prettierrc"), "prettier");
assert.equal(resolveIcon("prettierrc.json"), "prettier");
assert.equal(resolveIcon("prettierrc.yaml"), "prettier");
assert.equal(resolveIcon("prettierrc.toml"), "prettier");
assert.equal(resolveIcon("prettierrc.cts"), "prettier");
// prettier.config.* — no bare "prettier.config" upstream.
assert.equal(resolveIcon("prettier.config.js"), "prettier");
assert.equal(resolveIcon("prettier.config.mjs"), "prettier");
assert.equal(resolveIcon("prettier.config.cjs"), "prettier");
assert.equal(resolveIcon("prettier.config.ts"), "prettier");
assert.equal(resolveIcon("prettier.config.mts"), "prettier");
assert.equal(resolveIcon("prettier.config.cts"), "prettier");
assert.equal(resolveIcon("prettier.config.json"), "prettier");
assert.equal(resolveIcon("prettier.config.yaml"), "prettier");
assert.equal(resolveIcon("prettier.config.yml"), "prettier");
assert.equal(resolveIcon("prettier.config.toml"), "prettier");
assert.equal(resolveIcon("prettier.config.jsonc"), "prettier");
assert.equal(resolveIcon("prettier.config.json5"), "prettier");
// Bare "prettier.config" is not an upstream convention; it keeps the
// generic settings gear via the "config" suffix.
assert.equal(resolveIcon("prettier.config"), "settings");
// Exact names still win over suffixes: .prettierrc.json is Prettier
// config, not a plain JSON file.
assert.notEqual(resolveIcon(".prettierrc.json"), "json");

// Unmapped names fall back to the plain file glyph.
assert.equal(resolveIcon("unknown.zzz"), null);

console.log("file icon mapping tests passed");
