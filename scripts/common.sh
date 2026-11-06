# Shared configuration for herdr-mIDE scripts: paths and sync rules.
# Sourced by the scripts in this folder; the Makefile is the entry point.

# The Herdr app home (override with HERDR_APP_HOME).
HERDR_APP_HOME="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"

# Repo root (this file lives in <root>/scripts).
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Artifacts herdr-app check writes beside mods — never sync them.
EXCLUDES="--exclude=.DS_Store --exclude=jsconfig.json --exclude=gpui-kit.d.ts"

# Everything that installs into the app home.
MODS="mide-files mide-changes mide-editor"

# Canonical repo assets live in assets/ (root). Mods must stay self-contained
# for ecosystem installs (agents copy mods/<name>/ as-is), so assets are
# materialized into the mod folder before any sync. Never edit the copies in
# mods/ by hand — edit assets/ and re-run this (make assets does).
sync_assets() {
  mkdir -p "$REPO_DIR/mods/mide-files/icons/the previous set"
  rsync -a --delete --exclude=.DS_Store "$REPO_DIR/assets/icons/the previous set/" "$REPO_DIR/mods/mide-files/icons/the previous set/"
  rsync -a --exclude=.DS_Store "$REPO_DIR/assets/icons/tree/" "$REPO_DIR/mods/mide-files/icons/"
}

# Copy mods, layout and theme into the app home (overwrites installed
# copies; install.sh is the no-clobber first-time installer).
sync_targets() {
  sync_assets
  mkdir -p "$HERDR_APP_HOME/mods" "$HERDR_APP_HOME/layouts" "$HERDR_APP_HOME/themes"
  for mod in $MODS; do
    rsync -a $EXCLUDES "$REPO_DIR/mods/$mod/" "$HERDR_APP_HOME/mods/$mod/"
  done
  rsync -a "$REPO_DIR/layouts/herdr-mide.json" "$HERDR_APP_HOME/layouts/herdr-mide.json"
  rsync -a "$REPO_DIR/themes/mide-night.json" "$HERDR_APP_HOME/themes/mide-night.json"
}
