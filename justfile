# herdr-mIDE — the Makefile's commands for machines without GNU Make.
# The root Makefile stays the canonical entry point; this file runs the
# identical scripts so `just` is a drop-in alternative, which matters on
# Windows where the workflow lives in Git Bash (see TESTING.md).
#
# Requirements are the same as `make test` / `make check`: Node.js, Git, a
# POSIX shell and rsync. On Windows the recipes run through Git Bash's
# bash.exe at its default install location; if your Git lives elsewhere,
# override it per invocation:
#
#   just --shell "D:/path/to/Git/bin/bash.exe" --shell-arg -lc <recipe>
#
# Provision rsync per TESTING.md — for example cwRsync, driven from Git Bash
# through the small path-adapter shim described there — and put it on the
# PATH the recipes see before running just.

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
