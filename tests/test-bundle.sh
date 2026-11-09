#!/bin/sh
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/mide-bundle-test.XXXXXX")"
trap 'rm -r "$TEST_ROOT"' EXIT HUP INT TERM
printf 'test preview\n' > "$TEST_ROOT/preview.png"

PREVIEW="$TEST_ROOT/preview.png" sh "$ROOT/scripts/bundle.sh" "$TEST_ROOT/first"
PREVIEW="$TEST_ROOT/preview.png" sh "$ROOT/scripts/bundle.sh" "$TEST_ROOT/second"
diff -r "$TEST_ROOT/first" "$TEST_ROOT/second"
for mod in mide-files mide-changes mide-diff mide-editor; do
  test -f "$TEST_ROOT/first/mods/$mod/main.js"
  test -f "$TEST_ROOT/first/mods/$mod/mod.json"
  cmp "$ROOT/LICENSE" "$TEST_ROOT/first/mods/$mod/LICENSE"
  cmp "$ROOT/THIRD-PARTY-NOTICES.md" "$TEST_ROOT/first/mods/$mod/THIRD-PARTY-NOTICES.md"
done
for mod in mide-editor mide-diff; do
  cmp "$ROOT/shared/syntax.js" "$TEST_ROOT/first/mods/$mod/_shared/syntax.js"
  test ! -e "$ROOT/mods/$mod/_shared/syntax.js"
done
for file in layouts/herdr-mide.json keys.json RECIPE.md preview.png LICENSE THIRD-PARTY-NOTICES.md VERSION; do
  test -f "$TEST_ROOT/first/$file"
done
printf 'keep\n' > "$TEST_ROOT/first/sentinel"
if PREVIEW="$TEST_ROOT/preview.png" sh "$ROOT/scripts/bundle.sh" "$TEST_ROOT/first"; then
  echo "bundle unexpectedly overwrote an existing directory" >&2; exit 1
fi
test "$(cat "$TEST_ROOT/first/sentinel")" = keep
if PREVIEW="$TEST_ROOT/missing.png" sh "$ROOT/scripts/bundle.sh" "$TEST_ROOT/missing"; then
  echo "bundle unexpectedly accepted a missing preview" >&2; exit 1
fi
test ! -e "$TEST_ROOT/missing"
echo "bundle tests passed"
