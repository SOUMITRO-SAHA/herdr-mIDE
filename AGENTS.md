# AGENTS.md

Instructions for AI coding agents working in this repo.

## Icons — two sources, nothing else

**For any icon work, use our `material-icons-theme` skill first**
(`.opencode/skills/material-icons-theme/SKILL.md`).

- [Material Icon Theme](https://github.com/material-extensions/vscode-material-icon-theme)
  (MIT) is the only source for **file-type and folder icons**.
- **Generic UI glyphs** (chevrons, tree controls) come from Herdr's own
  icon system — the shipped mods in `../herdr-app/defaults/mods/` —
  carried under Herdr's Apache-2.0 license. No other external resource.
- Icons live in `mods/mide-files/icons/` — that folder is the single
  source of truth, hand-editable; `scripts/update-icons.sh` regenerates
  the file-icon set from upstream.
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
