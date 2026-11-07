#!/usr/bin/env python3
"""Exercise install and sync without touching a real Herdr home."""
import json
import os
import subprocess
import tempfile
from pathlib import Path

root = Path(__file__).resolve().parent.parent
layout = json.loads((root / "layouts/herdr-mide.json").read_text(encoding="utf-8"))
assert "theme" not in layout, "The layout must inherit Herdr's configured theme"
for mod in ("mide-files", "mide-changes", "mide-diff", "mide-editor"):
    main = (root / "mods" / mod / "main.js").read_text(encoding="utf-8")
    assert "{ ...mideTheme, background: theme().background }" in main, f"{mod} must use Herdr's background"

with tempfile.TemporaryDirectory(prefix="mide-theme-test-") as directory:
    home = Path(directory)
    app = home / "app"
    themes = app / "themes"
    themes.mkdir(parents=True)
    sentinels = {
        themes / "ayu-dark.json": b"user's existing ayu theme\n",
        themes / "mide-night.json": b"user's existing mide-night theme\n",
        app / "settings.json": b'{"theme":"graphite"}\n',
        home / ".config/herdr/config.json": b"user's CLI settings\n",
    }
    for path, contents in sentinels.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(contents)
    bin_dir = home / "bin"
    bin_dir.mkdir()
    checker = bin_dir / "herdr-app"
    checker.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
    checker.chmod(0o755)
    env = {**os.environ, "HOME": str(home), "HERDR_APP_HOME": str(app),
           "PATH": str(bin_dir) + os.pathsep + os.environ["PATH"]}
    for script in ("install.sh", "scripts/sync.sh"):
        subprocess.run([str(root / script)], cwd=root, env=env, check=True,
                       stdout=subprocess.DEVNULL)
        for path, contents in sentinels.items():
            assert path.read_bytes() == contents, f"{script} changed {path}"
        assert {p.name for p in themes.iterdir()} == {"ayu-dark.json", "mide-night.json"}
        for mod in ("mide-files", "mide-changes", "mide-diff", "mide-editor"):
            assert (app / "mods" / mod / "palette.js").is_file(), f"{script} missed {mod}'s palette"
print("theme isolation checks passed")
