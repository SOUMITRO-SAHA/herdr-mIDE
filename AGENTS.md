# AGENTS.md

Instructions for AI coding agents working in this repo.

## Ownership and API boundary

- This repository owns herdr-mIDE only. `herdr-app` is an external project;
  never edit, patch, build, install, or replace it to support an mIDE feature.
- Implement against Herdr's publicly documented and released mod APIs only.
  Do not treat sibling-repository source, vendored internals, or unannounced
  exports as supported API.
- If a feature cannot be implemented with those public APIs, stop before
  implementing or building a host-side change and ask the user for direction.
  Do not silently add a host dependency or private-API fallback.
- Running the installed `herdr-app check` command to validate mIDE mods is
  allowed; building or modifying the Herdr app is not.

## Third-party software — everything credited

- **Any third-party program, software, or service used in this project
  must be properly mentioned in
  [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md) before commit** —
  source project and link, license, copyright holder, exactly what was
  adopted or used, and any modifications noted. Notices list only what
  is actually shipped.
- The rule covers it all: libraries, tools, icons, themes, palettes,
  fonts, color values, snippets, and generated outputs derived from
  someone else's work. Merely studying a project for patterns needs no
  notice; anything copied or derived does. When unsure, credit it or
  stop and ask.

## Icons — two sources, nothing else

**For any icon work, use our `material-icons-theme` skill first**
(`.opencode/skills/material-icons-theme/SKILL.md`).

- [Material Icon Theme](https://github.com/material-extensions/vscode-material-icon-theme)
  (MIT) is the only source for **file-type and folder icons**.
- **Generic UI glyphs** (chevrons, tree controls) come from Herdr's own
  icon system — the shipped mods in `herdr-app/defaults/mods/` —
  carried under Herdr's Apache-2.0 license. No other external resource.
- Icons live in `mods/mide-files/icons/` — that folder is the single
  source of truth, hand-editable. File associations live in
  `mods/mide-files/icons.js`.
- **Every adopted icon must be credited in
  [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md) before commit** —
  license text, copyright holder, and any modifications noted. Notices
  list only what is actually shipped.
- Never copy icons from GPL-licensed sources; study them and draw fresh.

## House rules

- The root `Makefile` is the only entry point (`make dev`, `sync`,
  `check`, `install`, `shot`, `switch`); scripts live in `scripts/`,
  only `install.sh` at the root.
- Validate mods with `make check` after every edit — the app's checker
  is the only truth.
- Follow TDD for every behavior change: add a focused test, confirm it fails
  before implementing, then run `make test` and `make check`.
- Keep shared mod logic in one canonical source under `shared/` and list its
  consuming mods in `shared-modules.list`. The runtime isolates each mod, so
  materialize local copies under that mod's `_shared/` only in staging or the
  app home; never generate copies in `mods/` during development.
- Prefer small pure helpers and data-driven mappings over repeated logic or
  mod-specific forks; keep generated outputs reproducible and test their
  materialization.
- Keep mIDE-owned syntax configuration and palette in one canonical module
  under `shared/`; consume it from mods via generated copies. Use only public
  Herdr highlighting APIs. If they do not expose a required capability, stop
  and ask rather than depending on private host APIs.
- Git reads in mods must run with `--no-optional-locks -c
  core.fsmonitor=false` or the folder watcher refresh loops forever.
- Commits follow `type(scope): summary` and explain the why for users;
  `CHANGELOG.md` stays release-ready (see `.opencode/commands/`).
