#!/bin/sh
# Path adapter: drive cwRsync's Cygwin rsync from Git Bash (MSYS).
#
# MSYS treats Cygwin's rsync.exe as a native binary and rewrites POSIX-style
# arguments (/c/...) into Windows style (C:/...). rsync then mistakes the
# drive letter for a remote host ("The source and destination cannot both be
# remote"), and it resolves MSYS's /tmp mount to Cygwin's own (usually
# missing) /tmp. This adapter:
#   1. disables MSYS argument conversion for the rsync child, and
#   2. translates C:/x, C:\x and /c/x style arguments to Cygwin's
#      /cygdrive/c/x, and /tmp/... to MSYS's Windows temp directory.
# Options and relative patterns pass through unchanged.
#
# The real rsync is found through MIDE_CWRSYNC, or rsync.exe on the PATH
# (Chocolatey's rsync package installs a shim there). Install this script
# as an executable `rsync` in a directory earlier on the PATH than the
# real rsync; see docs/TESTING.md.
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

translate_drive() {
  # "C:/x" or "C:\x" -> "/cygdrive/c/x"
  p="$1"
  d=$(printf '%s' "$p" | cut -c1 | tr 'A-Z' 'a-z')
  r=$(printf '%s' "$p" | cut -c3- | tr '\\' '/' | sed 's|^[/\\]*||')
  printf '/cygdrive/%s/%s' "$d" "$r"
}

translate_msys() {
  # "/c/x" -> "/cygdrive/c/x"
  p="$1"
  d=$(printf '%s' "$p" | cut -c2 | tr 'A-Z' 'a-z')
  r=$(printf '%s' "$p" | cut -c3-)
  printf '/cygdrive/%s/%s' "$d" "$r"
}

translate() {
  p="$1"
  case "$p" in
    [A-Za-z]:[\\/]*)
      translate_drive "$p"
      ;;
    /tmp|/tmp/*)
      printf '%s%s' "$TMP_PREFIX" "${p#/tmp}"
      ;;
    /[A-Za-z]/*|/[A-Za-z]/)
      translate_msys "$p"
      ;;
    *)
      printf '%s' "$p"
      ;;
  esac
}

# Windows location of MSYS's /tmp mount, already in /cygdrive form.
TMP_PREFIX=''
if command -v cygpath >/dev/null 2>&1; then
  TMP_PREFIX=$(translate_drive "$(cygpath -m /tmp 2>/dev/null)") || TMP_PREFIX=''
fi

REAL=${MIDE_CWRSYNC:-$(command -v rsync.exe 2>/dev/null)}
if [ -z "$REAL" ]; then
  printf 'rsync path adapter: no cwRsync rsync.exe found; set MIDE_CWRSYNC\n' >&2
  exit 127
fi

for arg; do
  set -- "$@" "$(translate "$arg")"
  shift
done

exec "$REAL" "$@"
