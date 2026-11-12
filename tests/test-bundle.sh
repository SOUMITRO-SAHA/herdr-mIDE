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

# The repository root IS the Gallery package. The bundle must be byte-identical
# to the root for every shipped path, and the root must be complete on its own:
# auto-generated shared syntax inside the two consuming mods (guarded by the
# generator's --check), license and notices inside every mod folder, and the
# package files at the root.
sh "$ROOT/scripts/materialize-shared.sh" --check
diff -r -x .DS_Store -x gpui-kit.d.ts -x jsconfig.json "$TEST_ROOT/first/mods" "$ROOT/mods"
for path in layouts/herdr-mide.json keys.json RECIPE.md VERSION LICENSE THIRD-PARTY-NOTICES.md; do
  cmp "$TEST_ROOT/first/$path" "$ROOT/$path"
done
echo "bundle tests passed (root is the complete package)"
