#!/bin/sh
# Regenerate the in-tree _shared copies of the shared modules. The copies are
# AUTO-GENERATED (banner included) — shared/ is the source of truth, so edit
# there and run this script; never edit a copy. Tests guard every copy, so
# stale ones fail `just test` until regenerated.
#
#   scripts/materialize-shared.sh           regenerate the in-tree copies
#   scripts/materialize-shared.sh --check   exit 1 if any copy is stale
set -eu

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
. "$REPO_DIR/scripts/common.sh"

mode="generate"
if [ "${1:-}" = "--check" ]; then
  mode="check"
fi

# materialize_shared_modules writes banner-marked copies under
# <root>/mods/<mod>/<destination>; a throwaway root keeps --check read-only.
scratch="$(mktemp -d "${TMPDIR:-/tmp}/mide-shared.XXXXXX")"
trap 'rm -r "$scratch"' EXIT HUP INT TERM

status=0
while IFS=' ' read -r source destination destinations; do
  case "$source" in
    ""|\#*) continue ;;
  esac
  cr=$(printf '\r')
  source="${source%"$cr"}"
  destination="${destination%"$cr"}"
  destinations="${destinations%"$cr"}"
  for mod in $destinations; do
    in_tree="$REPO_DIR/mods/$mod/$destination"
    generated="$scratch/mods/$mod/$destination"
    if [ "$mode" = "check" ]; then
      generate_shared_copy "$REPO_DIR/$source" "$generated"
      if ! cmp -s "$generated" "$in_tree"; then
        echo "stale: mods/$mod/$destination — regenerate with: sh scripts/materialize-shared.sh" >&2
        status=1
      fi
    else
      generate_shared_copy "$REPO_DIR/$source" "$in_tree"
      printf '  + mods/%s/%s\n' "$mod" "$destination"
    fi
  done
done < "$SHARED_MODULES"

if [ "$mode" = "check" ] && [ "$status" = 0 ]; then
  echo "shared copies are up to date"
fi
exit "$status"
