#!/bin/sh
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/mide-update-test.XXXXXX")"
trap 'rm -r "$TEST_ROOT"' EXIT HUP INT TERM

export HOME="$TEST_ROOT/home"
PROD_HOME="$HOME/.config/herdr-app"
mkdir -p "$PROD_HOME/mods/mide-editor" "$PROD_HOME/layouts" "$TEST_ROOT/bin"
printf 'stale\n' > "$PROD_HOME/mods/mide-editor/main.js"
printf 'stale layout\n' > "$PROD_HOME/layouts/herdr-mide.json"

printf '#!/bin/sh\nprintf "%%s\\n" "$2" >> "$CHECK_LOG"\n' > "$TEST_ROOT/bin/herdr-app"
chmod +x "$TEST_ROOT/bin/herdr-app"

PATH="$TEST_ROOT/bin:$PATH" \
  CHECK_LOG="$TEST_ROOT/checks" \
  HERDR_APP_HOME="$PROD_HOME" \
  sh "$ROOT/scripts/update.sh" --quiet

test "$(wc -l < "$TEST_ROOT/checks" | tr -d ' ')" -eq 4
cmp "$ROOT/mods/mide-editor/main.js" "$PROD_HOME/mods/mide-editor/main.js"

if MIDE_HERDR_DEV=0 HERDR_APP_HOME="$HOME/.config/herdr-dev" \
  sh "$ROOT/scripts/update.sh" --quiet 2>"$TEST_ROOT/refuse"; then
  echo "update should refuse herdr-dev home" >&2
  exit 1
fi
grep -q herdr-dev "$TEST_ROOT/refuse"

echo "production update script tests passed"