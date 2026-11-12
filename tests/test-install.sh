#!/bin/sh
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/mide-install-test.XXXXXX")"
trap 'rm -r "$TEST_ROOT"' EXIT HUP INT TERM
mkdir -p "$TEST_ROOT/bin" "$TEST_ROOT/home/mods/mide-editor" "$TEST_ROOT/home/layouts"
printf '#!/bin/sh\nprintf "%%s\\n" "$2" >> "$CHECK_LOG"\ncase "$2" in */"${FAIL_MOD:-__none__}") exit 1;; esac\n' > "$TEST_ROOT/bin/herdr-app"
chmod +x "$TEST_ROOT/bin/herdr-app"
printf 'existing editor\n' > "$TEST_ROOT/home/mods/mide-editor/sentinel"
printf 'existing layout\n' > "$TEST_ROOT/home/layouts/herdr-mide.json"
PATH="$TEST_ROOT/bin:$PATH" CHECK_LOG="$TEST_ROOT/checks" MODS=mide-files HERDR_APP_HOME="$TEST_ROOT/home" sh "$ROOT/install.sh" > "$TEST_ROOT/output"
test ! -e "$TEST_ROOT/home/mods/mide-editor/_shared"
test "$(cat "$TEST_ROOT/home/mods/mide-editor/sentinel")" = 'existing editor'
test "$(cat "$TEST_ROOT/home/layouts/herdr-mide.json")" = 'existing layout'
# The installed copy is AUTO-GENERATED: banner + the canonical source body.
head -2 "$TEST_ROOT/home/mods/mide-diff/_shared/syntax.js" > "$TEST_ROOT/banner"
. "$ROOT/scripts/common.sh"
shared_banner "shared/syntax.js" > "$TEST_ROOT/banner-expected"
cmp "$TEST_ROOT/banner" "$TEST_ROOT/banner-expected"
tail -n +3 "$TEST_ROOT/home/mods/mide-diff/_shared/syntax.js" > "$TEST_ROOT/body"
cmp "$ROOT/shared/syntax.js" "$TEST_ROOT/body"
for mod in mide-files mide-changes mide-diff; do test -f "$TEST_ROOT/home/mods/$mod/main.js"; done
test "$(wc -l < "$TEST_ROOT/checks" | tr -d ' ')" = 3
if grep -q '/mide-editor$' "$TEST_ROOT/checks"; then
  echo "installer checked a pre-existing mod" >&2; exit 1
fi
mkdir -p "$TEST_ROOT/links/mods" "$TEST_ROOT/links/layouts"
ln -s "$TEST_ROOT/missing-mod" "$TEST_ROOT/links/mods/mide-editor"
ln -s "$TEST_ROOT/missing-layout" "$TEST_ROOT/links/layouts/herdr-mide.json"
PATH="$TEST_ROOT/bin:$PATH" CHECK_LOG="$TEST_ROOT/link-checks" HERDR_APP_HOME="$TEST_ROOT/links" sh "$ROOT/install.sh" > "$TEST_ROOT/link-output"
test -L "$TEST_ROOT/links/mods/mide-editor"
test -L "$TEST_ROOT/links/layouts/herdr-mide.json"
test ! -e "$TEST_ROOT/missing-mod"
test ! -e "$TEST_ROOT/missing-layout"
if PATH="$TEST_ROOT/bin:$PATH" CHECK_LOG="$TEST_ROOT/fail-checks" FAIL_MOD=mide-files HERDR_APP_HOME="$TEST_ROOT/fail" sh "$ROOT/install.sh" > "$TEST_ROOT/fail-output"; then
  echo "installer ignored a failed mod check" >&2; exit 1
fi
echo "no-clobber installer tests passed"
