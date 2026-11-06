#!/bin/sh
# herdr-mIDE installer — copies the mods and layout into the Herdr app
# home (~/.config/herdr-app), never overwriting anything already there.
# Keys are printed for a manual merge (per Herdr's mod-install conventions).
set -e

HOME_DIR="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Installing herdr-mIDE into $HOME_DIR"

install_mod() {
  name="$1"
  if [ -e "$HOME_DIR/mods/$name" ]; then
    echo "  ! mods/$name already exists — skipping (remove it first to replace)"
  else
    mkdir -p "$HOME_DIR/mods"
    cp -R "$REPO_DIR/mods/$name" "$HOME_DIR/mods/$name"
    echo "  + mods/$name"
  fi
}

install_mod mide-files
install_mod mide-changes
install_mod mide-editor

if [ -e "$HOME_DIR/layouts/herdr-mide.json" ]; then
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
echo "Checking mods…"
for mod in mide-files mide-changes mide-editor; do
  herdr-app check "$HOME_DIR/mods/$mod" && echo "  ok $mod"
done

echo
echo "Done. Try it:  herdr-app do layout.switch --name herdr-mide"
echo "Go back with:  ctrl-shift-l"
