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
  export HERDR_APP_HOME="${HERDR_APP_HOME:-$HOME/.config/herdr-dev}"
  case "$HERDR_APP_HOME" in
    *herdr-app*)
      if [[ "$HERDR_APP_HOME" != *herdr-dev* ]]; then
        echo "e2e: refusing production app home: $HERDR_APP_HOME" >&2
        exit 1
      fi
      ;;
  esac
}

e2e_screenshots_dir() {
  local root
  root="$(_e2e_repo_root)"
  local run="${E2E_RUN:-local}"
  echo "$root/e2e/screenshots/$run"
}

e2e_herdr_dev_pid() {
  local pid
  for pid in $(pgrep -f '/Contents/MacOS/Herdr' 2>/dev/null || true); do
    if ps eww -p "$pid" 2>/dev/null | grep -q 'HERDR_APP_HOME=.*herdr-dev'; then
      echo "$pid"
      return 0
    fi
  done
  return 1
}

e2e_start_dev_window() {
  if herdr-app status >/dev/null 2>&1; then return 0; fi
  local herdr_bin
  herdr_bin="$(e2e_resolve_herdr_bin)" || return 1
  echo "e2e: starting Herdr with HERDR_APP_HOME=$HERDR_APP_HOME"
  nohup env HERDR_APP_HOME="$HERDR_APP_HOME" "$herdr_bin" >>/tmp/herdr-dev-e2e.log 2>&1 &
  local _ i
  for i in $(seq 1 45); do
    sleep 1
    herdr-app status >/dev/null 2>&1 && return 0
  done
  echo "e2e: dev Herdr window did not become ready" >&2
  return 1
}