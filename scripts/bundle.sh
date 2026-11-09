#!/bin/sh
# Assemble a copyable Herdr layout package without changing the source mods.
set -eu

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
. "$REPO_DIR/scripts/common.sh"
# A release is always the complete bundle, regardless of development overrides.
MODS="$BUNDLE_MODS"
bundle_root="${1:?bundle destination required}"
preview="${PREVIEW:-$REPO_DIR/preview.png}"

if [ ! -f "$preview" ]; then
  echo "Missing preview: $preview (capture and review a real Herdr screenshot first)" >&2
  exit 1
fi
if [ -e "$bundle_root" ] || [ -L "$bundle_root" ]; then
  echo "Bundle destination already exists: $bundle_root (choose a new path)" >&2
  exit 1
fi
mkdir -p "$(dirname "$bundle_root")"
mkdir "$bundle_root"
mkdir "$bundle_root/mods" "$bundle_root/layouts"
for mod in $MODS; do
  mkdir "$bundle_root/mods/$mod"
  rsync -a $EXCLUDES "$REPO_DIR/mods/$mod/" "$bundle_root/mods/$mod/"
  # Gallery installs copy mod folders independently of package-root notices.
  cp "$REPO_DIR/LICENSE" "$REPO_DIR/THIRD-PARTY-NOTICES.md" "$bundle_root/mods/$mod/"
done
materialize_shared_modules "$bundle_root" replace $MODS
cp "$REPO_DIR/layouts/herdr-mide.json" "$bundle_root/layouts/"
cp "$REPO_DIR/keys.json" "$REPO_DIR/RECIPE.md" "$REPO_DIR/LICENSE" \
  "$REPO_DIR/THIRD-PARTY-NOTICES.md" "$REPO_DIR/VERSION" "$bundle_root/"
cp "$preview" "$bundle_root/preview.png"
echo "Bundle created: $bundle_root"
