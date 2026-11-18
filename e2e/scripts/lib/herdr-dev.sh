# Shared helpers for e2e Herdr automation (source from e2e/scripts/*.sh).
# Requires bash 3.2+.

_e2e_repo_root() {
  local here="${BASH_SOURCE[1]:-${BASH_SOURCE[0]}}"
  here="$(cd "$(dirname "$here")/../../.." && pwd)"
  echo "$here"
}

_e2e_load_local_env() {
  local root
  root="$(_e2e_repo_root)"
  if [[ -f "$root/e2e/local.env" ]]; then
    # shellcheck disable=SC1091
    set -a
    source "$root/e2e/local.env"
    set +a
  fi
}

_e2e_source_profile() {
  local root
  root="$(_e2e_repo_root)"
  # shellcheck source=../../../scripts/herdr-dev-profile.sh
  source "$root/scripts/herdr-dev-profile.sh"
  mide_export_herdr_dev_isolated_env
}

e2e_resolve_herdr_bin() {
  if [[ -n "${E2E_HERDR_BIN:-}" && -x "${E2E_HERDR_BIN}" ]]; then
    echo "$E2E_HERDR_BIN"
    return 0
  fi
  local candidate
  for candidate in \
    "/Applications/Herdr.app/Contents/MacOS/Herdr" \
    "$HOME/Applications/Herdr.app/Contents/MacOS/Herdr"; do
    if [[ -x "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done
  echo "e2e: set E2E_HERDR_BIN to your Herdr.app binary (see e2e/local.env.example)" >&2
  return 1
}

e2e_assert_herdr_dev_home() {
  _e2e_load_local_env
  local root
  root="$(_e2e_repo_root)"
  # shellcheck source=../../../scripts/herdr-dev-profile.sh
  source "$root/scripts/herdr-dev-profile.sh"
  case "${HERDR_APP_HOME:-}" in
    *herdr-app*)
      if [[ "${HERDR_APP_HOME}" != *herdr-dev* ]]; then
        echo "e2e: ignoring inherited production HERDR_APP_HOME=$HERDR_APP_HOME" >&2
        unset HERDR_APP_HOME
      fi
      ;;
  esac
  prod="$(mide_production_app_home)"
  if [[ -n "${HERDR_APP_HOME:-}" && "$HERDR_APP_HOME" = "$prod" ]]; then
    echo "e2e: ignoring inherited production HERDR_APP_HOME" >&2
    unset HERDR_APP_HOME
  fi
  _e2e_source_profile
  echo "e2e: isolated profile HERDR_APP_HOME=$HERDR_APP_HOME HC_SESSION=$HC_SESSION"
}

e2e_screenshots_dir() {
  local root
  root="$(_e2e_repo_root)"
  local run="${E2E_RUN:-local}"
  echo "$root/e2e/screenshots/$run"
}

e2e_herdr_dev_pid() {
  local pid session
  session="${HC_SESSION:-herdr-mide-dev}"
  for pid in $(pgrep -f '/Contents/MacOS/Herdr' 2>/dev/null || true); do
  ps eww -p "$pid" 2>/dev/null | grep -q "HERDR_APP_HOME=.*herdr-dev" \
      && ps eww -p "$pid" 2>/dev/null | grep -q "HC_SESSION=$session" \
      && {
        echo "$pid"
        return 0
      }
  done
  return 1
}

e2e_require_dev_window() {
  if ! herdr-app status >/dev/null 2>&1; then
    echo "e2e: no Herdr window for HERDR_APP_HOME=$HERDR_APP_HOME (socket missing?)" >&2
    return 1
  fi
  e2e_herdr_dev_pid >/dev/null || {
    echo "e2e: herdr-app status succeeded but no dev process matches HERDR_APP_HOME + HC_SESSION" >&2
    echo "e2e: quit any old herdr-dev window launched without HC_SESSION, then: just setup-herdr-dev" >&2
    return 1
  }
}

e2e_start_dev_window() {
  e2e_assert_herdr_dev_home
  if e2e_require_dev_window 2>/dev/null; then
    return 0
  fi
  local herdr_bin
  herdr_bin="$(e2e_resolve_herdr_bin)" || return 1
  echo "e2e: starting isolated Herdr (app home + core session)"
  # shellcheck disable=SC2086
  nohup env \
    HERDR_APP_HOME="$HERDR_APP_HOME" \
    HC_SESSION="$HC_SESSION" \
    XDG_STATE_HOME="$XDG_STATE_HOME" \
    XDG_CONFIG_HOME="$XDG_CONFIG_HOME" \
    XDG_RUNTIME_DIR="$XDG_RUNTIME_DIR" \
    DO_NOT_TRACK="${DO_NOT_TRACK:-1}" \
    "$herdr_bin" >>/tmp/herdr-dev-e2e.log 2>&1 &
  local _ i
  for i in $(seq 1 45); do
    sleep 1
    e2e_require_dev_window 2>/dev/null && return 0
  done
  echo "e2e: dev Herdr window did not become ready (see /tmp/herdr-dev-e2e.log)" >&2
  return 1
}