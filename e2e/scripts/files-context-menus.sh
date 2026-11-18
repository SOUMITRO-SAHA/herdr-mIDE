#!/usr/bin/env bash
# Dev-only: Files tree context menus (root / folder / file rows).
# HERDR_APP_HOME=~/.config/herdr-dev E2E_RUN=my-run ./e2e/scripts/files-context-menus.sh
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

shot() {
  local name="$1"
  local path="$E2E_DIR/$name.png"
  rm -f "$path"
  herdr-app shot "$path"
  echo "$path"
}

right_click_mapped() {
  local dev_pid="$1"
  local ix="$2"
  local iy="$3"
  swift - "$dev_pid" "$ix" "$iy" "$REF_W" "$REF_H" <<'SWIFT'
import Cocoa
import CoreGraphics
import Foundation

let devPid = Int32(CommandLine.arguments[1])!
let ix = Double(CommandLine.arguments[2])!
let iy = Double(CommandLine.arguments[3])!
let imgW = Double(CommandLine.arguments[4])!
let imgH = Double(CommandLine.arguments[5])!

guard let app = NSRunningApplication(processIdentifier: devPid),
      app.bundleIdentifier == "dev.herdr.app"
else { exit(1) }
app.activate(options: [])
usleep(400_000)

guard let windowList = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]]
else { exit(2) }

var frame: CGRect?
for window in windowList {
  guard let owner = window[kCGWindowOwnerPID as String] as? Int, owner == Int(devPid) else { continue }
  guard let layer = window[kCGWindowLayer as String] as? Int, layer == 0 else { continue }
  guard let bounds = window[kCGWindowBounds as String] as? [String: CGFloat] else { continue }
  let x = bounds["X"] ?? 0, y = bounds["Y"] ?? 0, w = bounds["Width"] ?? 0, h = bounds["Height"] ?? 0
  guard w > 800, h > 500 else { continue }
  frame = CGRect(x: x, y: y, width: w, height: h)
  break
}
guard let f = frame else { exit(3) }

let p = CGPoint(x: f.origin.x + (ix / imgW) * f.size.width,
                y: f.origin.y + (iy / imgH) * f.size.height)
let src = CGEventSource(stateID: .combinedSessionState)
CGEvent(mouseEventSource: src, mouseType: .mouseMoved, mouseCursorPosition: p, mouseButton: .left)?.post(tap: .cghidEventTap)
usleep(80_000)
CGEvent(mouseEventSource: src, mouseType: .rightMouseDown, mouseCursorPosition: p, mouseButton: .right)?.post(tap: .cghidEventTap)
CGEvent(mouseEventSource: src, mouseType: .rightMouseUp, mouseCursorPosition: p, mouseButton: .right)?.post(tap: .cghidEventTap)
SWIFT
}

press_escape() {
  swift - <<'SWIFT'
import Cocoa
import CoreGraphics
let src = CGEventSource(stateID: .combinedSessionState)
CGEvent(keyboardEventSource: src, virtualKey: 53, keyDown: true)?.post(tap: .cghidEventTap)
CGEvent(keyboardEventSource: src, virtualKey: 53, keyDown: false)?.post(tap: .cghidEventTap)
SWIFT
}

SPACE_ID="${E2E_SPACE_ID:-}"
REPO="${E2E_REPO:-$(_e2e_repo_root)}"

e2e_start_dev_window
DEV_PID="$(e2e_herdr_dev_pid)" || { echo "e2e: no dev Herdr PID" >&2; exit 1; }
echo "e2e: dev Herdr PID=$DEV_PID HERDR_APP_HOME=$HERDR_APP_HOME"

if [[ -n "$SPACE_ID" ]]; then
  herdr-app do space.select --id "$SPACE_ID"
else
  herdr-app do space.new --name "mIDE e2e" --folder "$REPO" --focus false 2>/dev/null || true
fi
herdr-app do layout.switch --name herdr-mide
herdr-app do layout.toggle --id panel
sleep 1

shot "10-setup-files-panel"
herdr-app status >"$E2E_DIR/10-status-setup.json"

right_click_mapped "$DEV_PID" 2680 120 || true
sleep 0.3
press_escape

declare -a CASES=(
  "11-menu-root|2680|240|root"
  "11-menu-folder|2680|400|folder"
  "11-menu-file|2680|920|file"
)

for entry in "${CASES[@]}"; do
  IFS='|' read -r shot_name ix iy label <<<"$entry"
  echo "→ $label ($ix,$iy)"
  right_click_mapped "$DEV_PID" "$ix" "$iy"
  sleep 0.7
  herdr-app status >"$E2E_DIR/${shot_name}-status.json"
  shot "$shot_name"
  sleep 0.3
  press_escape
  sleep 0.2
done

herdr-app status >"$E2E_DIR/12-status-final.json"
echo "e2e: done → $E2E_DIR"