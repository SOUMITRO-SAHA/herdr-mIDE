#!/bin/sh
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
. "$SCRIPT_DIR/../scripts/common.sh"

TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/mide-shared-modules.XXXXXX")"
trap 'rm -r "$TEST_ROOT"' EXIT HUP INT TERM

mkdir -p "$TEST_ROOT/mods/mide-editor" "$TEST_ROOT/mods/mide-diff"
materialize_shared_modules "$TEST_ROOT" replace mide-editor mide-diff

# Generated copies carry the AUTO-GENERATED banner followed by the canonical
# source; verify both halves of every generated file.
for mod in mide-editor mide-diff; do
  generated="$TEST_ROOT/mods/$mod/_shared/syntax.js"
  head -2 "$generated" > "$TEST_ROOT/banner"
  shared_banner "shared/syntax.js" > "$TEST_ROOT/banner-expected"
  cmp "$TEST_ROOT/banner" "$TEST_ROOT/banner-expected"
  tail -n +3 "$generated" > "$TEST_ROOT/body"
  cmp "$REPO_DIR/shared/syntax.js" "$TEST_ROOT/body"
done

# The in-tree copies in the repository root — the Gallery package — must match
# exactly what the generator would produce today.
sh "$REPO_DIR/scripts/materialize-shared.sh" --check

printf 'local modification\n' > "$TEST_ROOT/mods/mide-editor/_shared/syntax.js"
materialize_shared_modules "$TEST_ROOT" missing mide-editor mide-diff
grep -q 'local modification' "$TEST_ROOT/mods/mide-editor/_shared/syntax.js"
materialize_shared_modules "$TEST_ROOT" replace mide-editor mide-diff
head -2 "$TEST_ROOT/mods/mide-editor/_shared/syntax.js" > "$TEST_ROOT/banner"
cmp "$TEST_ROOT/banner" "$TEST_ROOT/banner-expected"

# A CRLF checkout (Windows core.autocrlf) must not break materialization.
cr=$(printf '\r')
sed "s/\$/$cr/" "$SHARED_MODULES" > "$TEST_ROOT/list-crlf"
mkdir -p "$TEST_ROOT/crlf/mods/mide-diff"
SHARED_MODULES="$TEST_ROOT/list-crlf" materialize_shared_modules "$TEST_ROOT/crlf" missing mide-diff
tail -n +3 "$TEST_ROOT/crlf/mods/mide-diff/_shared/syntax.js" > "$TEST_ROOT/crlf-body"
cmp "$REPO_DIR/shared/syntax.js" "$TEST_ROOT/crlf-body"

echo "shared module materialization tests passed"
