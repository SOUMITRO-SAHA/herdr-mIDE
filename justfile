# herdr-mIDE — the one entry point for every command.
# The script logic lives in scripts/ (install.sh stays at the root).
#
#   just dev       watch loop: sync repo → Herdr app home on every change;
#                  Herdr hot-reloads each mod as it lands. Ctrl-C to stop.
#   just sync      one-shot copy of mods and layout into the app home
#   just check     herdr-app check on every mod (the runtime's own parser)
#   just install   first-time install (never overwrites; prints keys to merge)
#   just status    what the window says: layout, focus, errors from mods
#   just shot      PNG of the window → herdr-shot.png
#   just switch    show the herdr-mide layout (ctrl-shift-l cycles back)
#
# Requirements: Node.js, Git, a POSIX shell (Git Bash on Windows) and rsync —
# see TESTING.md for the Windows provisioning notes. On Windows the recipes
# run through Git Bash's bash.exe at its default install location; if your
# Git lives elsewhere, override it per invocation:
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
    @echo "  just check    herdr-app check every mod"
    @echo "  just install  first-time install (install.sh)"
    @echo "  just status   window state + mod errors"
    @echo "  just shot     window screenshot → herdr-shot.png"
    @echo "  just switch   show the herdr-mide layout (ctrl-shift-l cycles back)"
    @echo "  just bundle   create a self-contained layout bundle in dist/herdr-mide"
    @echo "  just smoke-prepare  prepare a separate app home; see TESTING.md"
    @echo "  just smoke-capture  capture a scene from a user-started test window"

dev interval=INTERVAL:
    @INTERVAL="{{interval}}" ./scripts/dev.sh

sync:
    @./scripts/sync.sh

test:
    @sh ./tests/test-shared-modules.sh
    @node ./tests/test-syntax-config.mjs
    @node ./tests/test-changes-stage-review.mjs
    @node ./tests/test-changes-tracking.mjs
    @node ./tests/test-changes-commit-branches.mjs
    @node ./tests/test-file-icons.mjs
    @node ./tests/test-file-directory.mjs
    @node ./tests/test-diff-assets.mjs
    @node ./tests/test-editor-save.mjs
    @node ./tests/test-keys.mjs
    @node ./tests/test-smoke.mjs
    @node ./tests/test-portable-temp.mjs
    @sh ./tests/test-bundle.sh
    @sh ./tests/test-install.sh

check mods=MODS: test
    @MODS="{{mods}}" sh ./scripts/check.sh

install:
    @./install.sh

status:
    @herdr-app status

shot:
    @herdr-app shot && echo "saved: {{justfile_directory()}}/herdr-shot.png"

switch:
    @herdr-app do layout.switch --name herdr-mide

bundle bundle_dir="dist/herdr-mide":
    @sh ./scripts/bundle.sh "{{bundle_dir}}"

smoke-prepare:
    @node ./scripts/smoke.mjs --prepare

smoke-capture smoke_root scene:
    @MIDE_SMOKE_ROOT="{{smoke_root}}" MIDE_SMOKE_SCENE="{{scene}}" node ./scripts/smoke.mjs --capture
