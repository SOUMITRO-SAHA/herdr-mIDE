#!/usr/bin/env python3
"""Generate self-contained mod palettes from the private Ayu source."""
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
source = json.loads((root / "themes/ayu-dark.json").read_text(encoding="utf-8"))
colors = dict(source["colors"])
colors.update({f"ansi{i}": color for i, color in enumerate(source["ansi"])})
output = (
    "// Generated from themes/ayu-dark.json by make palette; do not edit.\n"
    "// Private to this mod; never registered as a Herdr theme.\n"
    "export const mideTheme = " + json.dumps(colors, indent=2) + ";\n"
)
check = sys.argv[1:] == ["--check"]
if sys.argv[1:] not in ([], ["--check"]):
    sys.exit("usage: palette.py [--check]")
stale = []
for mod in ("mide-files", "mide-changes", "mide-diff", "mide-editor"):
    path = root / "mods" / mod / "palette.js"
    if check:
        if not path.exists() or path.read_text(encoding="utf-8") != output:
            stale.append(str(path.relative_to(root)))
    else:
        path.write_text(output, encoding="utf-8")
if stale:
    sys.exit("Stale private palettes: " + ", ".join(stale) + ". Run make palette.")
