#!/bin/sh
# herdr-mIDE installer — copies the mods and layout into the Herdr app
# home (~/.config/herdr-app), never overwriting anything already there.
# Keys are printed for a manual merge (per Herdr's mod-install conventions).
set -e

HOME_DIR="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
HERDR_APP_HOME="$HOME_DIR"
. "$REPO_DIR/scripts/common.sh"
# Install the complete bundle; MODS overrides are for development checks/sync.
MODS="$BUNDLE_MODS"

echo "Installing herdr-mIDE into $HOME_DIR"
installed_mods=""

install_mod() {
  name="$1"
  if [ -e "$HOME_DIR/mods/$name" ] || [ -L "$HOME_DIR/mods/$name" ]; then
    echo "  ! mods/$name already exists — skipping (review this conflict)"
  else
    mkdir -p "$HOME_DIR/mods"
    cp -R "$REPO_DIR/mods/$name" "$HOME_DIR/mods/$name"
    installed_mods="$installed_mods $name"
    echo "  + mods/$name"
  fi
}

for mod in $MODS; do install_mod "$mod"; done
materialize_shared_modules "$HOME_DIR" missing $installed_mods

if [ -e "$HOME_DIR/layouts/herdr-mide.json" ] || [ -L "$HOME_DIR/layouts/herdr-mide.json" ]; then
  echo "  ! layouts/herdr-mide.json already exists — skipping"
else
  mkdir -p "$HOME_DIR/layouts"
  cp "$REPO_DIR/layouts/herdr-mide.json" "$HOME_DIR/layouts/herdr-mide.json"
  echo "  + layouts/herdr-mide.json"
fi

echo
echo "Keys to merge into $HOME_DIR/keys.json (ask before replacing one you use):"
cat "$REPO_DIR/keys.json"
echo
echo "Checking newly installed mods (skipped folders are not checked)…"
for mod in $installed_mods; do
  herdr-app check "$HOME_DIR/mods/$mod"
  echo "  ok $mod"
done

echo
echo "Done. Try it:  herdr-app do layout.switch --name herdr-mide"
echo "Go back with:  ctrl-shift-l"
