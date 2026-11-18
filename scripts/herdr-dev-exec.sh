#!/bin/sh
# Run a command with the isolated herdr-dev profile (app home + HC_SESSION).
# Used by just status/shot/switch and safe for manual: scripts/herdr-dev-exec.sh herdr-app status
set -e
. "$(dirname "$0")/herdr-dev-profile.sh"
mide_export_herdr_dev_isolated_env
if [ $# -eq 0 ]; then
  echo "usage: sh scripts/herdr-dev-exec.sh <command> [args...]" >&2
  exit 1
fi
exec "$@"