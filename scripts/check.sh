#!/bin/sh
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
. "$SCRIPT_DIR/common.sh"

CHECK_ROOT="$(mktemp -d "${TMPDIR:-/private/var/folders/0t/m74t111s18j5ppj8_0cy10wc0000gn/T/opencode}/mide-check.XXXXXX")"
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
