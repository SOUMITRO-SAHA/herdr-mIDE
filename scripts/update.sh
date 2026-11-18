#!/bin/sh
# Push the current repo into the production Herdr app home (~/.config/herdr-app).
# Overwrites mIDE mods and herdr-mide layout; does not install or upgrade Herdr itself.
#
# Usage: scripts/update.sh          (or: just update)
#        scripts/update.sh --quiet
#        scripts/update.sh --skip-check   sync only; skip herdr-app check
# Env:   HERDR_APP_HOME  override app home (must not be herdr-dev)
set -e

. "$(dirname "$0")/common.sh"
. "$REPO_DIR/scripts/herdr-dev-profile.sh"

quiet=0
skip_check=0
for arg in "$@"; do
  case "$arg" in
    --quiet) quiet=1 ;;
    --skip-check) skip_check=1 ;;
    -h | --help)
      echo "usage: sh scripts/update.sh [--quiet] [--skip-check]"
      echo "Updates mods + layout in production HERDR_APP_HOME (default ~/.config/herdr-app)."
      echo "For herdr-dev use: just sync"
      exit 0
      ;;
    *)
      echo "unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

if [ "${MIDE_HERDR_DEV:-}" = "1" ]; then
  echo "mIDE: just update targets production — unset MIDE_HERDR_DEV or use 'just sync' for herdr-dev" >&2
  exit 1
fi

case "$HERDR_APP_HOME" in
  *herdr-dev*)
    echo "mIDE: refusing herdr-dev app home: $HERDR_APP_HOME" >&2
    echo "mIDE: use 'just sync' for the isolated dev profile" >&2
    exit 1
    ;;
esac

prod=$(mide_production_app_home)
if [ "$HERDR_APP_HOME" != "$prod" ]; then
  echo "mIDE: HERDR_APP_HOME is not production ($prod):" >&2
  echo "mIDE:   $HERDR_APP_HOME" >&2
  echo "mIDE: unset HERDR_APP_HOME to update production, or export the path you intend." >&2
  exit 1
fi

if [ "$quiet" != 1 ]; then
  echo "mIDE: updating production app home → $HERDR_APP_HOME"
  echo "mIDE: (mods + layout only — does not upgrade the Herdr application binary)"
fi

sync_targets

if [ "$skip_check" != 1 ]; then
  if [ "$quiet" != 1 ]; then
    echo "mIDE: checking installed mods…"
  fi
  for mod in $MODS; do
    herdr-app check "$HERDR_APP_HOME/mods/$mod"
    [ "$quiet" != 1 ] && echo "  ok $mod"
  done
fi

if [ "$quiet" != 1 ]; then
  echo "mIDE: updated → $HERDR_APP_HOME"
  echo "Restart Herdr or run:  herdr-app do layout.switch --name herdr-mide"
fi