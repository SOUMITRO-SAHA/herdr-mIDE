# Shared configuration for herdr-mIDE scripts: paths and sync rules.
# Sourced by the scripts in this folder; the Makefile is the entry point.

# The Herdr app home (override with HERDR_APP_HOME).
HERDR_APP_HOME="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"

# Repo root (this file lives in <root>/scripts).
REPO_DIR="${REPO_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"

# Artifacts herdr-app check writes beside mods — never sync them.
EXCLUDES="--exclude=.DS_Store --exclude=jsconfig.json --exclude=gpui-kit.d.ts --exclude=_shared/"

# Everything that installs into the app home.
MODS="${MODS:-mide-files mide-changes mide-diff mide-editor}"
SHARED_MODULES="$REPO_DIR/shared-modules.list"

materialize_shared_modules() {
  destination_root="$1"
  mode="$2"
  shift 2
  requested_mods=" $* "

  while IFS=' ' read -r source destination destinations; do
    case "$source" in
      ""|\#*) continue ;;
    esac
    for mod in $destinations; do
      case "$requested_mods" in *" $mod "*) ;; *) continue ;; esac
      source_path="$REPO_DIR/$source"
      target_path="$destination_root/mods/$mod/$destination"
      mkdir -p "$(dirname "$target_path")"
      if [ ! -f "$target_path" ] || { [ "$mode" = "replace" ] && ! cmp -s "$source_path" "$target_path"; }; then
        cp "$source_path" "$target_path"
        printf '  + mods/%s/%s\n' "$mod" "$destination"
      fi
    done
  done < "$SHARED_MODULES"
}

# Copy only mIDE's mods and layout; never touch the host's theme registry.
sync_targets() {
  mkdir -p "$HERDR_APP_HOME/mods" "$HERDR_APP_HOME/layouts"
  for mod in $MODS; do
    rsync -a --delete $EXCLUDES "$REPO_DIR/mods/$mod/" "$HERDR_APP_HOME/mods/$mod/"
  done
  materialize_shared_modules "$HERDR_APP_HOME" replace $MODS
  rsync -a "$REPO_DIR/layouts/herdr-mide.json" "$HERDR_APP_HOME/layouts/herdr-mide.json"
}
