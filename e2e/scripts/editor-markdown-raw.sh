#!/usr/bin/env bash
# Dev-only: Editor Markdown Raw — open a .md file, capture Raw header (no Edit toggle).
# HERDR_APP_HOME=~/.config/herdr-dev E2E_RUN=pr51-markdown-raw ./e2e/scripts/editor-markdown-raw.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=e2e/scripts/lib/herdr-dev.sh
source "$SCRIPT_DIR/lib/herdr-dev.sh"

export PATH="${HOME}/.local/bin:/usr/bin:/bin:${PATH:-}"
e2e_assert_herdr_dev_home

REF_W="${E2E_REF_WIDTH:-2940}"
REF_H="${E2E_REF_HEIGHT:-1846}"
E2E_DIR="$(e2e_screenshots_dir)"
mkdir -p "$E2E_DIR"
REPO="${E2E_REPO:-$(_e2e_repo_root)}"
MD_FILE="${E2E_MD_FILE:-$REPO/CODE_OF_CONDUCT.md}"

shot() {
  local name="$1"
  local path="$E2E_DIR/$name.png"
  rm -f "$path"
  herdr-app shot "$path"
  echo "$path"
}

left_click_mapped() {
  local dev_pid="$1" ix="$2" iy="$3"
  swift - "$dev_pid" "$ix" "$iy" "$REF_W" "$REF_H" <<'SWIFT'
import Cocoa, CoreGraphics, Foundation
let devPid = Int32(CommandLine.arguments[1])!
let ix = Double(CommandLine.arguments[2])!, iy = Double(CommandLine.arguments[3])!
let imgW = Double(CommandLine.arguments[4])!, imgH = Double(CommandLine.arguments[5])!
guard let app = NSRunningApplication(processIdentifier: devPid), app.bundleIdentifier == "dev.herdr.app" else { exit(1) }
app.activate(options: []); usleep(400_000)
guard let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] else { exit(2) }
var frame: CGRect?
for w in list {
  guard let owner = w[kCGWindowOwnerPID as String] as? Int, owner == Int(devPid) else { continue }
  guard let layer = w[kCGWindowLayer as String] as? Int, layer == 0 else { continue }
  guard let b = w[kCGWindowBounds as String] as? [String: CGFloat] else { continue }
  let wd = b["Width"] ?? 0, h = b["Height"] ?? 0
  guard wd > 800, h > 500 else { continue }
  frame = CGRect(x: b["X"] ?? 0, y: b["Y"] ?? 0, width: wd, height: h); break
}
guard let f = frame else { exit(3) }
let p = CGPoint(x: f.origin.x + (ix / imgW) * f.size.width, y: f.origin.y + (iy / imgH) * f.size.height)
let src = CGEventSource(stateID: .combinedSessionState)
CGEvent(mouseEventSource: src, mouseType: .leftMouseDown, mouseCursorPosition: p, mouseButton: .left)?.post(tap: .cghidEventTap)
CGEvent(mouseEventSource: src, mouseType: .leftMouseUp, mouseCursorPosition: p, mouseButton: .left)?.post(tap: .cghidEventTap)
SWIFT
}

fail() {
  echo "e2e: $*" >&2
  exit 1
}

e2e_start_dev_window || fail "could not start herdr-dev"
DEV_PID="$(e2e_herdr_dev_pid)" || fail "no dev Herdr PID (HERDR_APP_HOME must be herdr-dev)"
echo "e2e: dev Herdr PID=$DEV_PID"

herdr-app do space.new --name "mIDE markdown raw e2e" --folder "$REPO"
herdr-app do layout.switch --name herdr-mide
sleep 0.8

props="$(jq -nc --arg file "$MD_FILE" '{file:$file}')"
herdr-app do tab.new --mod mide-editor --props "$props"
sleep 1.2

shot "20-editor-markdown-raw"
herdr-app status >"$E2E_DIR/20-status.json"
grep -q '"layout": "herdr-mide"' "$E2E_DIR/20-status.json" || fail "layout is not herdr-mide"

if left_click_mapped "$DEV_PID" 2100 95 2>/dev/null; then
  sleep 0.8
  shot "30-editor-markdown-preview"
  herdr-app status >"$E2E_DIR/30-status.json"
fi

herdr-app status >"$E2E_DIR/99-status-final.json"
echo "e2e: captures → $E2E_DIR"
echo "e2e: review 20-editor-markdown-raw.png — expect Raw + Preview only, no Edit, host editor body"