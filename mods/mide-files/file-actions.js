const slash = path => String(path ?? "").replace(/\\/g, "/");

export function contextMenuActions({ rowKind, remote = false }) {
  if (rowKind === "root") return ["new-file", "new-folder"];
  const actions = ["open", "new-file", "new-folder"];
  if (!remote) actions.push("reveal");
  actions.push("copy-absolute-path", "copy-relative-path", "copy-name");
  if (rowKind === "folder") actions.push("open-in-new-tab");
  return actions;
}

export function shortcutHint(bindings, action, platform) {
  const shortcut = {
    "new-file": {
      macos: ["cmd-n", "⌘N"],
      linux: ["ctrl-n", "Ctrl+N"],
      windows: ["ctrl-n", "Ctrl+N"],
    },
    "new-folder": {
      macos: ["alt-cmd-n", "⌥⌘N"],
      linux: ["alt-ctrl-n", "Ctrl+Alt+N"],
      windows: ["alt-n", "Alt+N"],
    },
    reveal: {
      macos: ["alt-cmd-r", "⌥⌘R"],
      linux: ["ctrl-alt-r", "Ctrl+Alt+R"],
      windows: ["ctrl-alt-r", "Ctrl+Alt+R"],
    },
    "copy-absolute-path": {
      macos: ["alt-cmd-c", "⌥⌘C"],
      linux: ["ctrl-alt-c", "Ctrl+Alt+C"],
      windows: ["alt-shift-c", "Alt+Shift+C"],
    },
    "copy-relative-path": {
      macos: ["alt-cmd-shift-c", "⌥⌘⇧C"],
      linux: ["ctrl-alt-shift-c", "Ctrl+Alt+Shift+C"],
    },
  }[action]?.[platform];
  if (
    !shortcut ||
    !bindings.some(
      binding =>
        binding.section === "mod:mide-files" &&
        binding.keys.trim().toLowerCase() === shortcut[0] &&
        binding.action === `mide-files.${action}`,
    )
  )
    return null;
  return shortcut[1];
}

export function creationFolder(path, rowKind) {
  const relative = slash(path).replace(/^\/+|\/+$/g, "");
  if (!relative || rowKind === "folder" || rowKind === "root") return relative;
  const separator = relative.lastIndexOf("/");
  return separator < 0 ? "" : relative.slice(0, separator);
}

export function createAbsolutePath(root, folder, name) {
  const base = slash(root).replace(/\/+$/g, ""),
    relative = [folder, name].filter(Boolean).join("/"),
    path = [base, relative].filter(Boolean).join("/");
  return path.startsWith("/") || /^[A-Za-z]:\//.test(path) ? path : `/${path}`;
}

export function validateCreateName(value, existingNames = [], caseSensitive = true) {
  const name = String(value ?? "");
  if (!name.trim()) return "Enter a name";
  if (name.trim() !== name) return "Names cannot start or end with whitespace";
  if (name === "." || name === "..") return "Choose a name other than . or ..";
  if (/[\\/]/.test(name)) return "Use a single name without / or \\";
  if (/[\u0000-\u001f<>:"|?*]/.test(name)) return "This name contains a character the file system cannot use";
  if (/[. ]$/.test(name)) return "Names cannot end with a space or dot";
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(name)) return "This name is reserved on Windows";
  const comparable = caseSensitive ? item => item : item => item.toLocaleLowerCase();
  if (existingNames.some(existing => comparable(String(existing)) === comparable(name)))
    return "An entry with this name already exists";
  return null;
}

export function utf16leBase64(text) {
  const bytes = [];
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    bytes.push(unit & 255, (unit >> 8) & 255);
  }
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i + 2 < bytes.length; i += 3) {
    const chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out +=
      alphabet[(chunk >> 18) & 63] + alphabet[(chunk >> 12) & 63] + alphabet[(chunk >> 6) & 63] + alphabet[chunk & 63];
  }
  const rest = bytes.length % 3;
  if (rest === 1) out += alphabet[bytes[bytes.length - 1] >> 2] + alphabet[(bytes[bytes.length - 1] << 4) & 63] + "==";
  else if (rest === 2) {
    const chunk = (bytes[bytes.length - 2] << 8) | bytes[bytes.length - 1];
    out += alphabet[(chunk >> 10) & 63] + alphabet[(chunk >> 4) & 63] + alphabet[(chunk << 2) & 63] + "=";
  }
  return out;
}

export function createShellCommands(path, kind) {
  const posixScript = kind === "file" ? 'set -C; : > "$1"' : 'mkdir "$1"',
    escapedPath = String(path).replace(/'/g, "''"),
    windowsScript =
      "$ErrorActionPreference = 'Stop'; " +
      `$p = '${escapedPath}'; ` +
      (kind === "file"
        ? "$stream = [System.IO.File]::Open($p, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None); $stream.Dispose()"
        : "if ([System.IO.File]::Exists($p) -or [System.IO.Directory]::Exists($p)) { throw 'Already exists' }; [System.IO.Directory]::CreateDirectory($p) | Out-Null");
  return {
    posix: { program: "sh", args: ["-c", posixScript, "mide-files", path] },
    windows: { program: "powershell", args: ["-NoProfile", "-EncodedCommand", utf16leBase64(windowsScript)] },
  };
}

export function revealCommand(platform, path, rowKind) {
  if (platform === "macos") return { program: "open", args: ["-R", path] };
  if (platform === "windows") {
    const escapedPath = String(path).replace(/'/g, "''"),
      script =
        `$p = '${escapedPath}'; ` + `Start-Process -FilePath 'explorer.exe' -ArgumentList @('/select,"' + $p + '"')`;
    return {
      program: "powershell",
      args: ["-NoProfile", "-EncodedCommand", utf16leBase64(script)],
    };
  }
  const directory = rowKind === "folder" ? path : path.slice(0, Math.max(path.lastIndexOf("/"), 0)) || "/";
  return { program: "xdg-open", args: [directory] };
}
