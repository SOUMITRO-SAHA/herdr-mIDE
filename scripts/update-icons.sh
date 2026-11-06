#!/bin/sh
# Pulls icons and file associations from Material Icon Theme (MIT) — this
# project's only icon source:
#   1. npm tarball → assets/icons/material/ (built 16×16 full-color SVGs;
#      _light and highContrast variants skipped)
#   2. its src/core/icons/fileIcons.ts → mods/mide-files/icons.js
#      (parsed by scripts/material-icons.js)
# The folder glyphs in assets/icons/tree/ come from the same package.
#
# Usage: scripts/update-icons.sh [version]   (default: 5.39.0)
set -e

VERSION="${1:-5.39.0}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
TMP="${TMPDIR:-/tmp}/material-icons-$VERSION"
mkdir -p "$TMP" && cd "$TMP"

echo "fetching material-icon-theme@$VERSION"
curl -sL "https://registry.npmjs.org/material-icon-theme/-/material-icon-theme-$VERSION.tgz" -o mit.tgz
tar -xzf mit.tgz
curl -sL "https://raw.githubusercontent.com/material-extensions/vscode-material-icon-theme/main/src/core/icons/fileIcons.ts" -o fileIcons.ts

OUT="$REPO/assets/icons/material"
echo "copying icons → $OUT"
rm -rf "$OUT" && mkdir -p "$OUT"
for f in package/icons/*.svg; do
  case "$f" in *_light.svg|*highContrast.svg) continue ;; esac
  cp "$f" "$OUT/"
done
find "$OUT" -name "*.svg" -exec chmod 644 {} +

echo "generating associations"
node "$REPO/scripts/material-icons.js" "$TMP/fileIcons.ts" "$OUT" "$REPO/mods/mide-files/icons.js" "$VERSION"
chmod 644 "$REPO/mods/mide-files/icons.js"
echo "done: $(ls "$OUT" | wc -l | tr -d ' ') icons in assets/icons/material + icons.js"
