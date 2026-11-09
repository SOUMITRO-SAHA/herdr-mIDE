#!/bin/sh
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
. "$SCRIPT_DIR/common.sh"

CHECK_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/mide-check.XXXXXX")"
trap 'rm -r "$CHECK_ROOT"' EXIT HUP INT TERM

mkdir -p "$CHECK_ROOT/mods"
for mod in $MODS; do
  mkdir -p "$CHECK_ROOT/mods/$mod"
  rsync -a --exclude=.DS_Store "$REPO_DIR/mods/$mod/" "$CHECK_ROOT/mods/$mod/"
done
materialize_shared_modules "$CHECK_ROOT" replace $MODS

for mod in $MODS; do
  herdr-app check "$CHECK_ROOT/mods/$mod"
done
