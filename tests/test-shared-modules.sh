#!/bin/sh
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
. "$SCRIPT_DIR/../scripts/common.sh"

TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/mide-shared-modules.XXXXXX")"
trap 'rm -r "$TEST_ROOT"' EXIT HUP INT TERM

mkdir -p "$TEST_ROOT/mods/mide-editor" "$TEST_ROOT/mods/mide-diff"
materialize_shared_modules "$TEST_ROOT" replace mide-editor mide-diff

cmp "$REPO_DIR/shared/syntax.js" "$TEST_ROOT/mods/mide-editor/_shared/syntax.js"
cmp "$REPO_DIR/shared/syntax.js" "$TEST_ROOT/mods/mide-diff/_shared/syntax.js"
test ! -e "$REPO_DIR/mods/mide-editor/_shared/syntax.js"
test ! -e "$REPO_DIR/mods/mide-diff/_shared/syntax.js"

printf 'local modification\n' > "$TEST_ROOT/mods/mide-editor/_shared/syntax.js"
materialize_shared_modules "$TEST_ROOT" missing mide-editor mide-diff
grep -q 'local modification' "$TEST_ROOT/mods/mide-editor/_shared/syntax.js"
materialize_shared_modules "$TEST_ROOT" replace mide-editor mide-diff
cmp "$REPO_DIR/shared/syntax.js" "$TEST_ROOT/mods/mide-editor/_shared/syntax.js"

# A CRLF checkout (Windows core.autocrlf) must not break materialization.
cr=$(printf '\r')
sed "s/\$/$cr/" "$SHARED_MODULES" > "$TEST_ROOT/list-crlf"
mkdir -p "$TEST_ROOT/crlf/mods/mide-diff"
SHARED_MODULES="$TEST_ROOT/list-crlf" materialize_shared_modules "$TEST_ROOT/crlf" missing mide-diff
cmp "$REPO_DIR/shared/syntax.js" "$TEST_ROOT/crlf/mods/mide-diff/_shared/syntax.js"

echo "shared module materialization tests passed"
