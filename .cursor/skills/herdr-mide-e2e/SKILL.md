---
name: herdr-mide-e2e
description: >-
  Automation testing and E2E for herdr-mIDE on herdr-dev (e2e/ scripts — not
  just test alone). Live verification via just dev/sync/check/status/shot/switch,
  Herdr CLI skills, app-home types, docs/TESTING.md scenes. Use when changing
  mods or layout, when the user asks for live, smoke, or e2e testing, or before
  claiming UI behavior is verified.
---

# herdr-mIDE end-to-end testing

When the user says **automation testing** or **E2E testing**, they mean
[`e2e/`](../../../e2e/) on **`herdr-dev`** — read the terminology table in
[`e2e/README.md`](../../../e2e/README.md) first. `just test` / `just check` are
**automated checks**, not E2E.

This skill wires Cursor agents into the same workflow people use to validate
mIDE in a real Herdr window. It does **not** replace Herdr’s own manuals —
load those when driving the window or core. It aligns with
[`AGENTS.md`](../../../AGENTS.md) and [`docs/TESTING.md`](../../../docs/TESTING.md).

## `e2e/` layout (automation testing)

| Path                           | Role                                               |
| ------------------------------ | -------------------------------------------------- |
| `e2e/scripts/`                 | Herdr UI automation entrypoints (`just e2e-*`)     |
| `e2e/screenshots/<run-id>/`    | Gitignored PNG + status JSON (`E2E_RUN`)           |
| `e2e/scripts/lib/herdr-dev.sh` | Dev profile guard, PID, start window               |
| `e2e/local.env`                | Gitignored machine overrides (`local.env.example`) |

```sh
E2E_RUN=my-feature just e2e-files-context my-feature
# or
HERDR_APP_HOME=~/.config/herdr-dev E2E_RUN=my-run ./e2e/scripts/files-context-menus.sh
```

Target the dev Herdr **process** when production and dev windows are both open.

## Herdr manuals (read on demand)

| Source   | Command or path                               | Use for                                             |
| -------- | --------------------------------------------- | --------------------------------------------------- |
| Window   | `herdr-app --skill`                           | `status`, `ls`, `do`, `shot`, layouts, keys, mods   |
| Core     | `hc --skill`                                  | terminals, agents, `run`, `send`, `wait`, `read`    |
| App home | `$HERDR_APP_HOME/AGENTS.md`                   | Same window guide as files (rewritten on app start) |
| Mod APIs | `$HERDR_APP_HOME/herdr.d.ts`, `gpui-kit.d.ts` | Public types for the **installed** Herdr version    |

Do not edit app-home `AGENTS.md` or the `.d.ts` files; the app overwrites them.

## Repository boundaries (mIDE `AGENTS.md`)

- Implement only against **public** Herdr mod APIs in those type files.
- Do **not** build, patch, or depend on sibling `herdr-app` source.
- **Never** use production `~/.config/herdr-app` for development or agent
  testing unless the owner explicitly asks for a release smoke on production.
- Do **not** launch, stop, restart, or fake input on someone else’s window or
  core.

## Profile: isolated `herdr-dev` (app home **and** core)

Herdr keeps mods in `HERDR_APP_HOME` but **spaces/agents in herdr-core**
(`HC_SESSION`). Exporting only `HERDR_APP_HOME=~/.config/herdr-dev` pollutes
production sidebars with E2E spaces — never do that.

```sh
just setup-herdr-dev   # dirs + env block to launch Herdr
just sync              # MIDE_HERDR_DEV=1 (full profile)
just status            # herdr-dev-exec.sh — never production
```

Canonical env: [`scripts/herdr-dev-profile.sh`](../../../scripts/herdr-dev-profile.sh)
(`HC_SESSION=herdr-mide-dev`, XDG roots under `~/.config/herdr-dev/xdg/`).
E2E: `e2e/scripts/lib/herdr-dev.sh` enforces the same before `space.new`.

If isolation is broken, fix `herdr-dev` — **never** query or automate
production `~/.config/herdr-app`.

## Automated gate (no window required)

From the repo root:

```sh
herdr-app --version
hc --version
just fmt-check    # before PR
just test         # includes smoke helper unit tests
just check        # materialize shared + herdr-app check each mod
```

After editing `shared/` or `shared-modules.list`, run `just shared` (or let
`just test` / `just check` regenerate copies). Never hand-edit `_shared/` in
mods.

`just check` proves initial load and render only — not deferred rows,
interactions, or layout integration.

## Live dev loop (hot reload)

Prerequisites: **isolated** dev window (`just setup-herdr-dev` launch line);
production may stay open — do not target it.

```sh
just sync         # herdr-dev app home only (not production)
just dev          # watch + hot reload on herdr-dev
just status       # dev socket only
just switch       # herdr-mide on dev window
just shot         # dev window PNG
```

Iterate: edit mod → `just dev` syncs → `just status` → `just shot` to inspect
UI. A broken save keeps the last good mod; errors appear in `status`.

Open the mIDE repo (or `just smoke-prepare` fixture) as a **space** and
exercise panels manually per `docs/TESTING.md` (Files, Editor, Changes, Diff,
branches, safety). Prefer an `e2e/` script when one exists for the feature.
Do not claim a scene passed without doing it or inspecting a fresh capture.

## Command-driven checks (agents)

Use Herdr CLI instead of guessing focus:

```sh
sh scripts/herdr-dev-exec.sh herdr-app status
sh scripts/herdr-dev-exec.sh herdr-app ls
sh scripts/herdr-dev-exec.sh herdr-app do layout.switch --name herdr-mide
sh scripts/herdr-dev-exec.sh herdr-app shot /absolute/path/new-name.png
```

Never run bare `herdr-app` without the dev profile — that hits production.

Read `herdr-app --skill` before `do` subcommands you have not used in this
session. Prefer IDs from `ls` over assumed pane/terminal IDs.

## Isolated smoke home (CI / disposable VM — not daily dev)

```sh
just smoke-prepare
# prints a scratch root with bundle/, fixture/, env.sh — does NOT start Herdr
```

**Local interactive testing uses `herdr-dev`, not the smoke `env.sh` home.**
Smoke `env.sh` is for isolated CI-style captures (`just smoke-capture`) after
a **user-started** window in that home; see `docs/TESTING.md`.

## Definition of done for a mod change

1. `just test` and `just check` green.
2. `HERDR_APP_HOME=~/.config/herdr-dev just status` reports no mod errors on
   `herdr-mide`.
3. **E2E / automation testing** when user-visible: `e2e/` script run and/or
   manual scene from `docs/TESTING.md`, with reviewed capture under
   `e2e/screenshots/<run-id>/` or `just shot` / `herdr-app shot`.
4. Report what was **not** verified (interactions, deferred list rows, etc.).

## Quick reference

| Goal                     | Command                                                          |
| ------------------------ | ---------------------------------------------------------------- |
| Prepare isolation        | `just setup-herdr-dev` then launch Herdr with printed `env`      |
| Automation testing (E2E) | `E2E_RUN=<id> just e2e-files-context <id>` — see `e2e/README.md` |
| Copy mods into dev home  | `just sync` (never production)                                   |
| Watch + hot reload       | `just dev`                                                       |
| Runtime parser check     | `just check`                                                     |
| Mod errors               | `just status` (with dev home exported)                           |
| Screenshot               | `just shot` or `herdr-app shot <new-file.png>`                   |
| Show mIDE layout         | `just switch`                                                    |
| Full manual matrix       | `docs/TESTING.md`                                                |
