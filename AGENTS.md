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

## Herdr mod development

- Before changing a layout or mod, consult the guide and generated
  `herdr.d.ts` and `gpui-kit.d.ts` in the target Herdr app home. They describe
  that installed version. Herdr's public layout and mod guide is
  [`docs/mods.md`](https://github.com/herdrdev/herdr-app/blob/master/docs/mods.md),
  which points to [`defaults/AGENTS.md`](https://github.com/herdrdev/herdr-app/blob/master/defaults/AGENTS.md).
  The public guide and sibling checkout may document a newer, unreleased
  version. Verify required APIs against the
  supported released version, not just the checkout or the locally installed
  version. If they disagree or availability cannot be established, stop and
  ask rather than assuming support or raising the minimum version silently.
- Mods are native GPUI JavaScript, not web pages: follow the versioned guide
  for `mods/<name>/main.js`, `mod.json`, relative modules and assets. A
  `main.js` default-exports a `View` subclass. Do not assume a DOM, HTML/CSS,
  general Node APIs, `setTimeout` or `setInterval`; use documented runtime
  facilities and check the actual type declarations for supported APIs.
- Use each callback's own `cx`; never retain one for later. Use documented
  spawn and timer facilities for asynchronous work and data refresh, not
  top-level `await` or timer-driven animation. Prefer native animation and
  theme tokens where appropriate. Remember that hidden mod copies can remain
  alive and poll gently. Make initialization safe with absent props and the
  empty state used by the checker.
- Treat shipped Herdr layouts and mods as read-only. Work on mIDE-owned
  copies, keep layout references and mod asset paths consistent, and credit
  any shipped adaptations. Do not overwrite a person's files or key bindings
  without permission; respect the repository's no-clobber install workflow.
- `just check` tests and copies all configured mods into temporary staging, materializes shared
  modules, and runs the installed `herdr-app check` on each. The checker
  loads and renders the initial mod, but does not prove layout, deferred
  rows, later asynchronous states, or interactions work. For user-facing
  changes also exercise the affected layout, states and interactions in Herdr
  when possible; report what could not be verified. Never stop or restart
  someone else's app or core; use an isolated app home and core for testing —
  locally that means the `herdr-dev` profile (see below), never production.

## Local testing — always the `herdr-dev` profile

- All local testing and development runs against our dedicated developer
  profile, **`herdr-dev`**: its own app home and core session, selected by
  pointing `HERDR_APP_HOME` at it (e.g. `HERDR_APP_HOME=~/.config/herdr-dev`)
  for every command that touches a Herdr environment — `just dev`, `just
  sync`, `just status`, `just shot`, `just switch`.
- Never run, sync, install, hot-reload, switch layouts or capture screenshots
  against the original production environment (the default `~/.config/herdr-app`
  app home with no `HERDR_APP_HOME` override). Do not point tests at it "just
  this once", and do not treat it as a fallback when the dev profile is
  missing, broken or not set up — prepare or fix `herdr-dev` instead.
- Production has exactly one purpose: verifying the live, released version of
  our mods as a person sees them. Touch it only deliberately for that check,
  never as a side effect of development, testing or automation.
- Disposable fixtures (CI, `just smoke-prepare`) use their own isolated app
  homes and never production; `just check` stages into temporary directories
  and touches no app home at all.

## Maintaining RECIPE.md

- Keep [`RECIPE.md`](./RECIPE.md) current in the same change as any relevant
  layout, mod, behavior, dependency, asset, setup or verification change.
  It is Herdr's ecosystem brief for another agent to rebuild the package in
  an empty folder, not a wishlist or a substitute for API documentation.
- Follow Herdr's public recipe guidance in
  [“Layouts and mods other people made”](https://github.com/herdrdev/herdr-app/blob/master/defaults/AGENTS.md#layouts-and-mods-other-people-made):
  start with `# Name`, a paragraph describing what the person sees and
  `![Name](preview.png)`; then, in order:
  1. **What you see:** regions in visual order, sizes, colors, type and content.
  2. **How it behaves:** clicks, keys, hovers and motion, including each agent
     status and its appearance wherever agent statuses are shown.
  3. **Built from:** layout node tree and blocks, every mod and the roles of
     its props, reused shipped mods, Herdr functions and commands, programs,
     art and other assets needed to reconstruct it.
  4. **Watch out:** pitfalls, limits, incomplete controls and setup assumptions.
  5. **Done when:** observable checks for behavior the build actually has.
- Put the person and visible behavior first; keep implementation details in
  **Built from** and **Watch out**. Prefer exact verified dimensions, colors,
  names and commands over vague descriptions. Distinguish shipped behavior
  from roadmap items; never claim an unimplemented capability or an unrun
  verification as fact.
- Derive and cross-check the recipe against the current layout, all mod
  manifests and source, shared-module materialization, keys, installer,
  justfile, tests and third-party notices. Resolve contradictions and remove
  stale claims rather than copying old recipe text. Document required
  programs, side effects, platform and remote limitations, supported Herdr
  version, key merging and no-overwrite behavior where relevant. Reference
  `preview.png` as specified and describe any missing or outdated preview
  honestly; do not invent a screenshot or test result.
- Herdr's guide also requires a real `preview.png` and the appropriate
  `herdr-layout` or `herdr-mod` GitHub topic when sharing. Do not create a
  topic, take a screenshot, install or switch a layout without the scope and
  environment needed to do so safely.

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

- The root `justfile` is the only entry point (`just dev`, `sync`, `test`,
  `check`, `install`, `shot`, `switch`, `bundle`, `smoke-prepare`,
  `smoke-capture`); scripts live in `scripts/`,
  only `install.sh` at the root. There is no Makefile; do not reintroduce a
  second runner.
- Validate mods with `just check` after every edit; the app's checker is the
  runtime check for initial loading, not a replacement for interaction tests.
- Follow TDD for every behavior change: add a focused test, confirm it fails
  before implementing, then run `just test` and `just check`.
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
- Version and release the layout and its four dependent mods together; follow
  `VERSION` and `RELEASING.md`. Never publish, tag, or change gallery topics
  without explicit owner approval. Gallery copies need a self-contained
  assembled bundle, not the incomplete development `mods/` tree.
- Follow `TESTING.md` for cross-platform checks. Smoke preparation and capture
  never start or stop a window or core; never fake input on a real display or
  claim a visual/interaction test was automated when it was not.
