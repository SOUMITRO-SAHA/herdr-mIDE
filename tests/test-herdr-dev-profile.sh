#!/bin/sh
set -e

. "$(dirname "$0")/../scripts/herdr-dev-profile.sh"

tmp=$(mktemp -d)
cleanup() { rm -rf "$tmp"; }
trap cleanup EXIT

export HOME="$tmp/home"
mkdir -p "$HOME"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

mide_export_herdr_dev_isolated_env

[ "$HERDR_APP_HOME" = "$HOME/.config/herdr-dev" ] || fail "HERDR_APP_HOME"
[ "$HC_SESSION" = "herdr-mide-dev" ] || fail "HC_SESSION"
[ -d "$XDG_RUNTIME_DIR" ] || fail "XDG_RUNTIME_DIR not created"
[ -z "${HC_SOCKET:-}" ] || fail "HC_SOCKET should be unset"
[ -z "${HC_TERMINAL_ID:-}" ] || fail "HC_TERMINAL_ID should be unset"

HERDR_DEV_ROOT="$HOME/custom-dev" mide_export_herdr_dev_isolated_env
[ "$HERDR_APP_HOME" = "$HOME/custom-dev" ] || fail "HERDR_DEV_ROOT override"

if ( mide_refuse_production_app_home "$HOME/.config/herdr-app" ); then
  fail "should refuse production app home"
fi

echo "test-herdr-dev-profile: ok"