#!/bin/sh
# Isolated herdr-mIDE development profile — app home + core session + XDG roots.
# Source from scripts or bash e2e helpers. Never point automation at production.
#
# Herdr keeps layouts/mods in HERDR_APP_HOME, but spaces/tabs/agents live in
# herdr-core. Sharing the default HC_SESSION with production makes space.new and
# agents show up in the person's real window even when HERDR_APP_HOME is herdr-dev.

# POSIX sh — no bash-isms (sourced from scripts/*.sh on Windows Git Bash too).

mide_herdr_dev_root() {
  printf '%s' "${HERDR_DEV_ROOT:-$HOME/.config/herdr-dev}"
}

mide_production_app_home() {
  if [ -n "${XDG_CONFIG_HOME:-}" ]; then
    printf '%s' "$XDG_CONFIG_HOME/herdr-app"
  else
    printf '%s' "$HOME/.config/herdr-app"
  fi
}

# Default core session name for local mIDE work (short: macOS socket path limits).
mide_herdr_dev_hc_session() {
  printf '%s' "${HERDR_DEV_HC_SESSION:-herdr-mide-dev}"
}

mide_refuse_production_app_home() {
  home=$1
  prod=$(mide_production_app_home)
  case "$home" in
    *herdr-app*)
      case "$home" in
        *herdr-dev*) ;;
        *)
          echo "mIDE: refusing production app home: $home" >&2
          echo "mIDE: use HERDR_APP_HOME=\$(mide_herdr_dev_root) or just dev/sync on herdr-dev" >&2
          exit 1
          ;;
      esac
      ;;
  esac
  if [ "$home" = "$prod" ]; then
    echo "mIDE: refusing production app home: $home" >&2
    exit 1
  fi
}

mide_herdr_dev_unset_inherited_core() {
  unset HC_SOCKET HC_TERMINAL_ID HC_TERMINAL_SOCKET HC_SCOPE 2>/dev/null || true
}

# Export the full isolated profile for this shell and child processes.
mide_export_herdr_dev_isolated_env() {
  root=$(mide_herdr_dev_root)
  session=$(mide_herdr_dev_hc_session)

  mide_refuse_production_app_home "$root"

  export HERDR_APP_HOME="$root"
  export HC_SESSION="$session"
  export XDG_STATE_HOME="$root/xdg/state"
  export XDG_CONFIG_HOME="$root/xdg/config"
  export XDG_RUNTIME_DIR="$root/xdg/run"
  export DO_NOT_TRACK=1

  mide_herdr_dev_unset_inherited_core

  mkdir -p "$HERDR_APP_HOME" \
    "$XDG_STATE_HOME" \
    "$XDG_CONFIG_HOME" \
    "$XDG_RUNTIME_DIR"
}

# Print env assignments for `env` / launchd / manual Herdr start (one KEY=value per line).
mide_herdr_dev_launch_env_lines() {
  mide_export_herdr_dev_isolated_env
  printf 'HERDR_APP_HOME=%s\n' "$HERDR_APP_HOME"
  printf 'HC_SESSION=%s\n' "$HC_SESSION"
  printf 'XDG_STATE_HOME=%s\n' "$XDG_STATE_HOME"
  printf 'XDG_CONFIG_HOME=%s\n' "$XDG_CONFIG_HOME"
  printf 'XDG_RUNTIME_DIR=%s\n' "$XDG_RUNTIME_DIR"
  printf 'DO_NOT_TRACK=1\n'
}