#!/bin/sh
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/mide-uninstall-test.XXXXXX")"
trap 'rm -r "$TEST_ROOT"' EXIT HUP INT TERM
mkdir -p "$TEST_ROOT/bin" "$TEST_ROOT/poison-bin"
# Working stub for building the fixture; a failing one for the uninstaller:
# the uninstall is a pure file operation and must never talk to the CLI.
printf '#!/bin/sh\nexit 0\n' > "$TEST_ROOT/bin/herdr-app"
chmod +x "$TEST_ROOT/bin/herdr-app"
printf '#!/bin/sh\nexit 90\n' > "$TEST_ROOT/poison-bin/herdr-app"
chmod +x "$TEST_ROOT/poison-bin/herdr-app"

# Fixture: a full install, plus bystanders a person would have.
HOME="$TEST_ROOT/home"
mkdir -p "$HOME/mods/files" "$HOME/layouts"
printf 'shipped panel\n' > "$HOME/mods/files/sentinel"
printf 'person keys\n' > "$HOME/keys.json"
printf '{"bookkeeping":true}\n' > "$HOME/installed.json"
PATH="$TEST_ROOT/bin:$PATH" HERDR_APP_HOME="$HOME" sh "$ROOT/install.sh" > "$TEST_ROOT/install-output"

# Every installed mIDE path goes; every bystander stays byte-identical.
PATH="$TEST_ROOT/poison-bin:$PATH" HERDR_APP_HOME="$HOME" sh "$ROOT/scripts/uninstall.sh" > "$TEST_ROOT/output"
for mod in mide-files mide-changes mide-diff mide-editor; do
  test ! -e "$HOME/mods/$mod"
  test ! -L "$HOME/mods/$mod"
done
test ! -e "$HOME/layouts/herdr-mide.json"
test "$(cat "$HOME/mods/files/sentinel")" = 'shipped panel'
test "$(cat "$HOME/keys.json")" = 'person keys'
test "$(cat "$HOME/installed.json")" = '{"bookkeeping":true}'

# Running it again is safe: exits cleanly, still touches only mIDE names.
PATH="$TEST_ROOT/poison-bin:$PATH" HERDR_APP_HOME="$HOME" sh "$ROOT/scripts/uninstall.sh" > "$TEST_ROOT/output-again"
test "$(cat "$HOME/mods/files/sentinel")" = 'shipped panel'

# Symlinks lose the link, never the target; a dangling link still uninstalls.
TARGET="$TEST_ROOT/target"
HOME="$TEST_ROOT/links"
mkdir -p "$HOME/mods" "$HOME/layouts" "$TARGET/mide-files"
printf 'real files\n' > "$TARGET/mide-files/sentinel"
printf 'real layout\n' > "$TARGET/kept-layout.json"
ln -s "$TARGET/mide-files" "$HOME/mods/mide-files"
ln -s "$TARGET/kept-layout.json" "$HOME/layouts/herdr-mide.json"
ln -s "$TARGET/missing" "$HOME/mods/mide-editor"
PATH="$TEST_ROOT/poison-bin:$PATH" HERDR_APP_HOME="$HOME" sh "$ROOT/scripts/uninstall.sh" > "$TEST_ROOT/link-output"
test ! -e "$HOME/mods/mide-files" && test ! -L "$HOME/mods/mide-files"
test ! -e "$HOME/mods/mide-editor" && test ! -L "$HOME/mods/mide-editor"
test ! -e "$HOME/layouts/herdr-mide.json" && test ! -L "$HOME/layouts/herdr-mide.json"
test "$(cat "$TARGET/mide-files/sentinel")" = 'real files'
test "$(cat "$TARGET/kept-layout.json")" = 'real layout'
echo "uninstaller tests passed"
