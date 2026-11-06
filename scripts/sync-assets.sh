#!/bin/sh
# Materializes the canonical root-level assets into the mods that ship them:
#   assets/icons/the previous set/ → mods/mide-files/icons/the previous set/   (169 file-type icons)
#   assets/icons/tree/ → mods/mide-files/icons/         (folder + chevrons)
#
# Mods stay self-contained (herdr ecosystem installs copy mods/<name>/ as-is),
# so the copies are committed too — but assets/ is the source of truth.
# make sync and make dev run this automatically before shipping.
#
# Usage: scripts/sync-assets.sh   (or: make assets)
set -e

. "$(dirname "$0")/common.sh"

sync_assets
echo "assets → mods/mide-files/icons"
