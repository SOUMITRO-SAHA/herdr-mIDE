#!/bin/sh
# herdr-mIDE sync — one-shot copy of mods and layout into the Herdr
# app home. Overwrites the installed copies (dev semantics); install.sh at
# the repo root is the no-clobber first-time installer.
#
# Usage: scripts/sync.sh          (or: make sync)
#        scripts/sync.sh --quiet  no output unless something fails
# Env:   HERDR_APP_HOME  app home (default ~/.config/herdr-app)
set -e

. "$(dirname "$0")/common.sh"

sync_targets

if [ "$1" != "--quiet" ]; then
  echo "synced → $HERDR_APP_HOME"
fi
