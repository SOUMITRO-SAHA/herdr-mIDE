#!/bin/sh
# herdr-mIDE dev loop — syncs the repo into the Herdr app home whenever a
# file changes, so Herdr hot-reloads each mod as it lands in the running
# window. A broken save keeps the last good version running and reports
# in `herdr-app status`; nothing is lost by iterating.
#
# Usage: scripts/dev.sh    (or: make dev)
# Env:   HERDR_APP_HOME  app home (default ~/.config/herdr-app)
#        INTERVAL        poll seconds (default 1)
set -e

. "$(dirname "$0")/common.sh"
INTERVAL="${INTERVAL:-1}"

# Start from a known-good state before watching.
"$(dirname "$0")/sync.sh" --quiet

echo "Watching (every ${INTERVAL}s):"
echo "  $REPO_DIR/mods/mide-*  →  $HERDR_APP_HOME/mods/"
echo "  layouts/herdr-mide.json, themes/mide-night.json"
echo "Herdr reloads each file as it lands. Ctrl-C to stop."
echo "Verify: make status (errors) · make shot (window PNG)"

while :; do
  changed="$(
    for mod in $MODS; do
      rsync -a --delete --itemize-changes $EXCLUDES "$REPO_DIR/mods/$mod/" "$HERDR_APP_HOME/mods/$mod/" || true
    done
    rsync -a --itemize-changes "$REPO_DIR/layouts/herdr-mide.json" "$HERDR_APP_HOME/layouts/herdr-mide.json" || true
    rsync -a --itemize-changes "$REPO_DIR/themes/mide-night.json" "$HERDR_APP_HOME/themes/mide-night.json" || true
  )"
  if [ -n "$changed" ]; then
    echo ""
    echo "$(date '+%H:%M:%S') synced — Herdr is reloading:"
    echo "$changed"
  fi
  sleep "$INTERVAL"
done
