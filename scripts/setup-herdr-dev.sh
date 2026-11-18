#!/bin/sh
# Prepare the isolated herdr-dev profile on disk and print how to start Herdr.
# Does not launch, stop, or query any running window.
set -e

. "$(dirname "$0")/herdr-dev-profile.sh"
mide_export_herdr_dev_isolated_env

echo "herdr-mIDE dev profile (isolated from production)"
echo ""
echo "  App home:     $HERDR_APP_HOME"
echo "  Core session: $HC_SESSION"
echo "  XDG run dir:  $XDG_RUNTIME_DIR"
echo ""
echo "Spaces, tabs, and agents created in this profile stay in the"
echo "$HC_SESSION core — they do not appear in your production Herdr."
echo ""
echo "Start a dedicated dev window (macOS example):"
echo ""
herdr_bin="${HERDR_DEV_BIN:-/Applications/Herdr.app/Contents/MacOS/Herdr}"
if [ ! -x "$herdr_bin" ]; then
  herdr_bin="$HOME/Applications/Herdr.app/Contents/MacOS/Herdr"
fi
if [ -x "$herdr_bin" ]; then
  echo "  env \\"
  mide_herdr_dev_launch_env_lines | sed 's/^/    /' | sed '$ s/$/ \\/'
  echo "    \"$herdr_bin\""
else
  echo "  Set HERDR_DEV_BIN to your Herdr binary, then:"
  echo "  env \\"
  mide_herdr_dev_launch_env_lines | sed 's/^/    /' | sed '$ s/$/ \\/'
  echo "    /path/to/Herdr"
fi
echo ""
echo "Then from the repo (same env in the shell, or rely on just recipes):"
echo "  just sync"
echo "  just status"
echo ""
echo "If you already had a herdr-dev window open without HC_SESSION, quit it and"
echo "relaunch with the env above so core state does not mix with production."