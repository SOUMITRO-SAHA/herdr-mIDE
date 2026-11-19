# herdr-mIDE — the one entry point for every command.
# The script logic lives in scripts/ (install.sh stays at the root).
#
#   just dev       watch loop: sync repo → Herdr app home on every change;
#                  Herdr hot-reloads each mod as it lands. Ctrl-C to stop.
#   just sync      one-shot copy of mods and layout into the app home
#   just check     herdr-app check on every mod (the runtime's own parser)
#   just install   first-time install (never overwrites; prints keys to merge)
#   just uninstall remove the installed mods and layout (never touches keys)
#   just status    what the window says: layout, focus, errors from mods
#   just shot      PNG of the window → herdr-shot.png
#   just e2e-*     automation testing (E2E on herdr-dev); see e2e/README.md
#   just switch    show the herdr-mide layout (ctrl-shift-l cycles back)
#
# Requirements: Bun, Git, a POSIX shell (Git Bash on Windows) and rsync —
# see TESTING.md for the Windows provisioning notes. `bun install` once
# provides the Prettier formatter behind `just fmt` / `just fmt-check`.
# On Windows the recipes run through Git Bash's bash.exe at its default
# install location; if your Git lives elsewhere, override it per invocation:
#
#   just --shell "D:/path/to/Git/bin/bash.exe" --shell-arg -lc <recipe>

set windows-shell := ['C:/Program Files/Git/bin/bash.exe', '-lc']

INTERVAL := '1'
MODS := 'mide-files mide-changes mide-diff mide-editor'

default: help

help:
    @echo "herdr-mIDE commands:"
    @echo "  just dev      live sync + hot reload (Ctrl-C to stop)"
    @echo "  just sync     one-shot copy into the Herdr app home"
    @echo "  just test     source-tree tests"
    @echo "  just shared   regenerate the auto-generated _shared copies"
    @echo "  just check    herdr-app check every mod"
    @echo "  just fmt      format the tree (Prettier via Bun)"
    @echo "  just fmt-check  verify formatting; CI enforces this on every PR"
    @echo "  just install  first-time install (install.sh)"
    @echo "  just update     overwrite mIDE in ~/.config/herdr-app (production smoke)"
    @echo "  just uninstall  remove the installed mods and layout"
    @echo "  just status   window state + mod errors"
    @echo "  just shot     window screenshot → herdr-shot.png"
    @echo "  just switch   show the herdr-mide layout (ctrl-shift-l cycles back)"
    @echo "  just bundle   create a self-contained layout bundle in dist/herdr-mide"
    @echo "  just smoke-prepare  prepare a separate app home; see TESTING.md"
    @echo "  just smoke-capture  capture a scene from a user-started test window"
    @echo "  just e2e-files-context  dev-only Files context-menu automation; see e2e/"
    @echo "  just e2e-editor-markdown  dev-only Editor Markdown Raw automation; see e2e/"
    @echo "  just e2e-editor-image     dev-only Editor image Preview automation; see e2e/"
    @echo "  just setup-herdr-dev   prepare isolated app home + core session; see docs/TESTING.md"

dev interval=INTERVAL:
    @MIDE_HERDR_DEV=1 INTERVAL="{{interval}}" ./scripts/dev.sh

sync:
    @MIDE_HERDR_DEV=1 ./scripts/sync.sh

setup-herdr-dev:
    @sh ./scripts/setup-herdr-dev.sh

shared:
    @sh ./scripts/materialize-shared.sh

test:
    @sh ./tests/test-shared-modules.sh
    @bun ./tests/test-syntax-config.mjs
    @bun ./tests/test-syntax-markdown.mjs
    @bun ./tests/test-changes-stage-review.mjs
    @bun ./tests/test-changes-tracking.mjs
    @bun ./tests/test-changes-commit-branches.mjs
    @bun ./tests/test-changes-commit-shortcut.mjs
    @bun ./tests/test-changes-footer-sizing.mjs
    @bun ./tests/test-changes-branch-footer.mjs
    @bun ./tests/test-changes-remote-sync.mjs
    @bun ./tests/test-file-icons.mjs
    @bun ./tests/test-file-actions.mjs
    @bun ./tests/test-file-context-menu.mjs
    @bun ./tests/test-file-directory.mjs
    @bun ./tests/test-diff-assets.mjs
    @bun ./tests/test-editor-save.mjs
    @bun ./tests/test-editor-shortcut.mjs
    @bun ./tests/test-editor-raw.mjs
    @bun ./tests/test-editor-image.mjs
    @bun ./tests/test-editor-svg.mjs
    @bun ./tests/test-keys.mjs
    @bun ./tests/test-smoke.mjs
    @bun ./tests/test-portable-temp.mjs
    @sh ./tests/test-bundle.sh
    @sh ./tests/test-install.sh
    @sh ./tests/test-update.sh
    @sh ./tests/test-uninstall.sh
    @sh ./tests/test-herdr-dev-profile.sh

fmt:
    @bun run --silent fmt

fmt-check:
    @bun run --silent fmt:check

check mods=MODS: test
    @MODS="{{mods}}" sh ./scripts/check.sh

install:
    @./install.sh

update *args:
    @sh ./scripts/update.sh {{args}}

uninstall:
    @./scripts/uninstall.sh

status:
    @sh ./scripts/herdr-dev-exec.sh herdr-app status

shot:
    @sh ./scripts/herdr-dev-exec.sh herdr-app shot && echo "saved: {{justfile_directory()}}/herdr-shot.png"

switch:
    @sh ./scripts/herdr-dev-exec.sh herdr-app do layout.switch --name herdr-mide

bundle bundle_dir="dist/herdr-mide":
    @sh ./scripts/bundle.sh "{{bundle_dir}}"

smoke-prepare:
    @bun ./scripts/smoke.mjs --prepare

smoke-capture smoke_root scene:
    @MIDE_SMOKE_ROOT="{{smoke_root}}" MIDE_SMOKE_SCENE="{{scene}}" bun ./scripts/smoke.mjs --capture

# Live Herdr UI automation (herdr-dev only). Sets E2E_RUN; see e2e/README.md.
e2e-files-context run="local":
    #!/usr/bin/env bash
    set -euo pipefail
    export E2E_RUN="{{run}}"
    exec ./e2e/scripts/files-context-menus.sh

e2e-editor-markdown run="local":
    #!/usr/bin/env bash
    set -euo pipefail
    export E2E_RUN="{{run}}"
    exec ./e2e/scripts/editor-markdown-raw.sh

e2e-editor-image run="local":
    #!/usr/bin/env bash
    set -euo pipefail
    export E2E_RUN="{{run}}"
    exec ./e2e/scripts/editor-image-preview.sh

e2e-editor-svg run="local":
    #!/usr/bin/env bash
    set -euo pipefail
    export E2E_RUN="{{run}}"
    exec ./e2e/scripts/editor-svg-raw-preview.sh
