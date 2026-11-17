---
name: herdr-mide-e2e
description: >-
  Automation testing and E2E for herdr-mIDE: e2e/ scripts on herdr-dev (project
  vocabulary — not just test alone). Also covers just dev/sync/check, Herdr CLI,
  and docs/TESTING.md manual scenes.
---

# herdr-mIDE end-to-end testing

When the user says **automation testing** or **E2E testing**, they mean
[`e2e/`](../../../e2e/) on **`herdr-dev`** — read the terminology table in
[`e2e/README.md`](../../../e2e/README.md) first. `just test` / `just check` are
automated checks, not E2E.

This skill matches [`AGENTS.md`](../../../AGENTS.md) and
[`docs/TESTING.md`](../../../docs/TESTING.md).

## Layout

| Path                           | Role                                     |
| ------------------------------ | ---------------------------------------- |
| `e2e/scripts/`                 | All Herdr UI automation entrypoints      |
| `e2e/screenshots/<run-id>/`    | Gitignored PNG + status JSON (`E2E_RUN`) |
| `e2e/scripts/lib/herdr-dev.sh` | Dev profile guard, PID, start window     |

## Gates (no window)

```sh
just test
just check
just fmt-check   # before PR
```

## Dev profile (always)

```sh
export HERDR_APP_HOME="${HERDR_APP_HOME:-$HOME/.config/herdr-dev}"
HERDR_APP_HOME=~/.config/herdr-dev just sync
```

Never use production `~/.config/herdr-app` for development or automation.
Target the dev Herdr **process** when multiple windows are open.

## Live automation

```sh
E2E_RUN=pr-32-files-context-actions just e2e-files-context pr-32-files-context-actions
# or
HERDR_APP_HOME=~/.config/herdr-dev E2E_RUN=my-run ./e2e/scripts/files-context-menus.sh
```

Read `herdr-app --skill` before unfamiliar `do` commands.

## Command-driven capture (no pointer)

```sh
HERDR_APP_HOME=~/.config/herdr-dev just status
HERDR_APP_HOME=~/.config/herdr-dev just switch
herdr-app shot /tmp/new-capture-name.png
```

## Definition of done

1. `just test` and `just check` green.
2. Dev `just status` has no mod errors on `herdr-mide`.
3. Manual scene from TESTING.md **or** reviewed `e2e/screenshots/<run-id>/` capture.
4. State what was not verified.
