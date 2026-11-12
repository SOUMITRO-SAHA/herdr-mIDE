#!/bin/sh
# herdr-mIDE uninstaller — removes the mods and layout the installer put down
# in the Herdr app home, touching nothing else. Deleting the files is Herdr's
# documented way to remove a mod: Herdr's own bookkeeping stays, and a person's
# keys.json stays too, because the installer only ever prints keys for a manual
# merge — so removal is a manual decision, not this script's.
set -e

HOME_DIR="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HERDR_APP_HOME="$HOME_DIR"
. "$REPO_DIR/scripts/common.sh"
# Uninstall the complete bundle; MODS overrides are for development checks/sync.
MODS="$BUNDLE_MODS"

echo "Uninstalling herdr-mIDE from $HOME_DIR"
removed_any=0

remove_mod() {
  name="$1"
  if [ -e "$HOME_DIR/mods/$name" ] || [ -L "$HOME_DIR/mods/$name" ]; then
    rm -r "$HOME_DIR/mods/$name"
    removed_any=1
    echo "  - mods/$name"
  else
    echo "  = mods/$name not present"
  fi
}

for mod in $MODS; do remove_mod "$mod"; done

if [ -e "$HOME_DIR/layouts/herdr-mide.json" ] || [ -L "$HOME_DIR/layouts/herdr-mide.json" ]; then
  rm -f "$HOME_DIR/layouts/herdr-mide.json"
  removed_any=1
  echo "  - layouts/herdr-mide.json"
else
  echo "  = layouts/herdr-mide.json not present"
fi

echo
if [ "$removed_any" = 0 ]; then
  echo "Nothing to remove — herdr-mIDE is not installed in this app home."
  exit 0
fi

echo "Everything else keeps as it was: your keys.json, shipped mods and Herdr's own bookkeeping."
echo
echo "Keys this bundle printed at install time (remove them from $HOME_DIR/keys.json by hand if you want them gone):"
cat "$REPO_DIR/keys.json"
echo
echo "If a herdr-mide layout is on screen, switch back with ctrl-shift-l."
