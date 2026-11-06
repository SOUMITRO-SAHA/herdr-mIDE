# AGENTS.md

Instructions for AI coding agents working in this repo.

## Icons — use the material-icons-theme skill

**For any icon work — file, folder, tree, or UI glyphs — use our
`material-icons-theme` skill first** (`.opencode/skills/material-icons-theme/SKILL.md`).

- [Material Icon Theme](https://github.com/material-extensions/vscode-material-icon-theme)
  (MIT) is the **only** icon source for this project — file icons,
  folder glyphs, any new glyph. No other icon set may be shipped.
- Glyphs land in `assets/icons/` (canonical), never hand-edited under
  `mods/`; rewrite baked fills to `currentColor` so the theme tints them.
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
- Git reads in mods must run with `--no-optional-locks -c
  core.fsmonitor=false` or the folder watcher refresh loops forever.
- Commits follow `type(scope): summary` and explain the why for users;
  `CHANGELOG.md` stays release-ready (see `.opencode/commands/`).
