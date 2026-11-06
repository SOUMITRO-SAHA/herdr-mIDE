# Shared configuration for herdr-mIDE scripts: paths and sync rules.
# Sourced by the scripts in this folder; the Makefile is the entry point.

# The Herdr app home (override with HERDR_APP_HOME).
HERDR_APP_HOME="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"

# Repo root (this file lives in <root>/scripts).
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Artifacts herdr-app check writes beside mods — never sync them.
EXCLUDES="--exclude=.DS_Store --exclude=jsconfig.json --exclude=gpui-kit.d.ts"

# Everything that installs into the app home.
MODS="mide-files mide-changes mide-diff mide-editor"

# Copy mods, layout and theme into the app home (overwrites installed
# copies; install.sh is the no-clobber first-time installer).
sync_targets() {
  mkdir -p "$HERDR_APP_HOME/mods" "$HERDR_APP_HOME/layouts"
  for mod in $MODS; do
    rsync -a --delete $EXCLUDES "$REPO_DIR/mods/$mod/" "$HERDR_APP_HOME/mods/$mod/"
  done
  rsync -a "$REPO_DIR/layouts/herdr-mide.json" "$HERDR_APP_HOME/layouts/herdr-mide.json"
}
