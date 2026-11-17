# herdr-mIDE end-to-end automation

This folder is what we mean by **automation testing** (and **E2E testing**) in
this project: scripted, repeatable runs against a real **`herdr-dev`** Herdr
window, with evidence under `e2e/screenshots/<run-id>/`.

| Say this                                        | Means                                                                                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Automation testing** / **E2E testing**        | [`e2e/`](.) — scripts in `e2e/scripts/`, [`e2e/README.md`](README.md), `just e2e-*` recipes                                                 |
| **Automated checks** (not “automation testing”) | `just test`, `just check`, `just fmt-check` — Bun tests and `herdr-app check`; mostly no live window                                        |
| **Smoke workflow**                              | `just smoke-prepare` / `just smoke-capture` + [`scripts/smoke.mjs`](../scripts/smoke.mjs) — isolated app home for CI, not daily `herdr-dev` |
| **Manual E2E scenes**                           | Checklist in [`docs/TESTING.md`](../docs/TESTING.md) when no `e2e/` script exists yet                                                       |

End-to-end **feature** verification = run (or add) an `e2e/` script and/or
perform the matching TESTING.md scenes on `herdr-dev`, then review captures.
`just test` / `just check` are required gates but **do not** replace that.

## What lives here

Scripts drive a live `herdr-dev` window, capture evidence, and complement
`just test`, `just check`, and the manual matrix in
[`docs/TESTING.md`](../docs/TESTING.md).

## Boundary: `e2e/` vs root `scripts/`

Verified layout for this repo:

| Location           | Role                                                                                        | Examples                                                  |
| ------------------ | ------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **`e2e/scripts/`** | Live **`herdr-dev`** UI automation (pointer/keyboard, repeated scenes, PR evidence)         | `files-context-menus.sh`                                  |
| **`scripts/`**     | Install, sync, bundle, mod check staging, isolated smoke **fixture** (no local dev profile) | `sync.sh`, `dev.sh`, `check.sh`, `smoke.mjs`, `bundle.sh` |
| **`tests/`**       | Automated unit/integration tests (`just test`; no Herdr window required for most)           | `test-file-context-menu.mjs`, `test-smoke.mjs`            |

Migrated from `scripts/` → `e2e/scripts/`:

- `e2e-dev-context-menus.sh` → [`scripts/files-context-menus.sh`](scripts/files-context-menus.sh) (removed from `scripts/`; captures under `e2e/screenshots/`, not `.e2e-screenshots/`).

**Stays in `scripts/` on purpose** (do not move to `e2e/`):

- [`scripts/smoke.mjs`](../scripts/smoke.mjs) — disposable app home + `just smoke-prepare` / `just smoke-capture` (CI/isolated profile, not daily `herdr-dev`; see TESTING.md).
- [`scripts/check.sh`](../scripts/check.sh) — temp tree + `herdr-app check` for `just check`.
- [`scripts/dev.sh`](../scripts/dev.sh), [`scripts/sync.sh`](../scripts/sync.sh) — hot reload and one-shot install into an app home.
- [`scripts/bundle.sh`](../scripts/bundle.sh), [`install.sh`](../install.sh), [`scripts/uninstall.sh`](../scripts/uninstall.sh) — packaging and install flow.

There are no remaining live-automation scripts under `scripts/`; grep the tree for `e2e-dev` or `.e2e-screenshots` before adding duplicates.

## Layout

```text
e2e/
  README.md                 ← you are here
  scripts/                  ← all automation entrypoints live here
  screenshots/              ← gitignored; PNG + status JSON from runs
    <run-id>/               ← e.g. pr-32-files-context-actions
```

- Put **every** new Herdr UI automation script under `e2e/scripts/`.
- Write captures only under `e2e/screenshots/<run-id>/`. Nothing under
  `screenshots/` is committed.
- Prefer `E2E_RUN=<run-id>` when running a script so outputs stay grouped.
- Quick one-off window captures from the repo root may still use `just shot`
  (`herdr-shot.png`, already gitignored).

## Local configuration (not in git)

Machine-specific values belong in **`e2e/local.env`** (gitignored). Copy
[`local.env.example`](local.env.example) and set only what you need (Herdr.app
path, optional space id, screenshot calibration size). Never commit
`local.env`, captures, or status JSON from a run.

## Profile: always `herdr-dev`

```sh
export HERDR_APP_HOME="${HERDR_APP_HOME:-$HOME/.config/herdr-dev}"
```

Use that for `just sync`, every `herdr-app` / `hc` command, and every script
here. Do not use production `~/.config/herdr-app` for development or automation.
Scripts must refuse a production-only app home when they detect one.

When both production and dev windows are open, automation must target the
process whose environment includes `HERDR_APP_HOME=…/herdr-dev` (see
`e2e/scripts/lib/herdr-dev.sh`).

## Before you run

1. `just test` and `just check` green.
2. `HERDR_APP_HOME=~/.config/herdr-dev just sync`.
3. Dev window up: `HERDR_APP_HOME=~/.config/herdr-dev herdr-app status`.
4. Read `herdr-app --skill` for any unfamiliar `do` commands.

## Available scripts

| Script                                                             | Purpose                                                                                                                       |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| [`scripts/files-context-menus.sh`](scripts/files-context-menus.sh) | Files panel: show panel, right-click root/folder/file rows, `herdr-app shot` + status JSON (macOS; targets dev PID only).     |
| [`scripts/editor-markdown-raw.sh`](scripts/editor-markdown-raw.sh) | Editor: open a `.md` via `tab.new`, capture Raw (Raw + Preview only, no Edit toggle); optional Preview click (macOS dev PID). |

Run via `just` when a recipe exists (see root `justfile`), or directly:

```sh
E2E_RUN=pr-32-files-context-actions \
  HERDR_APP_HOME=~/.config/herdr-dev \
  ./e2e/scripts/files-context-menus.sh
```

## Adding a script

1. Add `e2e/scripts/<name>.sh` (or `.mjs` if Bun-driven).
2. `source` shared helpers from `e2e/scripts/lib/herdr-dev.sh` where useful.
3. Write artifacts under `e2e/screenshots/${E2E_RUN:-local}/`.
4. Document the script in this README and, if agents need it, in
   [`AGENTS.md`](../AGENTS.md).
5. Do not commit screenshots; rely on `.gitignore` under `e2e/screenshots/`.

## Definition of done (live automation)

1. Automated gates still green (`just test`, `just check`).
2. Script exits zero on the target OS (today: macOS dev profile).
3. Captures reviewed for the intended UI; `herdr-app status` shows expected
   overlays/focus when the script claims an interaction.
4. Report what the script does **not** cover (deferred rows, remote machine,
   other OSes).
