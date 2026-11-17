import assert from "node:assert/strict";
import {
  contextMenuActions,
  creationFolder,
  createAbsolutePath,
  createShellCommands,
  revealCommand,
  shortcutHint,
  utf16leBase64,
  validateCreateName,
} from "../mods/mide-files/file-actions.js";

assert.deepEqual(contextMenuActions({ rowKind: "file" }), [
  "open",
  "new-file",
  "new-folder",
  "reveal",
  "copy-absolute-path",
  "copy-relative-path",
  "copy-name",
]);
assert.deepEqual(contextMenuActions({ rowKind: "folder" }), [
  "open",
  "new-file",
  "new-folder",
  "reveal",
  "copy-absolute-path",
  "copy-relative-path",
  "copy-name",
  "open-in-new-tab",
]);
assert.deepEqual(contextMenuActions({ rowKind: "file", remote: true }), [
  "open",
  "new-file",
  "new-folder",
  "copy-absolute-path",
  "copy-relative-path",
  "copy-name",
]);
assert.deepEqual(contextMenuActions({ rowKind: "root" }), ["new-file", "new-folder"]);
const createShortcuts = [
  { section: "mod:mide-files", keys: "cmd-n", action: "mide-files.new-file" },
  { section: "mod:mide-files", keys: "alt-cmd-n", action: "mide-files.new-folder" },
  { section: "mod:mide-files", keys: "alt-cmd-r", action: "mide-files.reveal" },
  { section: "mod:mide-files", keys: "alt-cmd-c", action: "mide-files.copy-absolute-path" },
  { section: "mod:mide-files", keys: "alt-cmd-shift-c", action: "mide-files.copy-relative-path" },
  { section: "mod:mide-files", keys: "ctrl-n", action: "mide-files.new-file" },
  { section: "mod:mide-files", keys: "alt-ctrl-n", action: "mide-files.new-folder" },
  { section: "mod:mide-files", keys: "ctrl-alt-r", action: "mide-files.reveal" },
  { section: "mod:mide-files", keys: "ctrl-alt-c", action: "mide-files.copy-absolute-path" },
  { section: "mod:mide-files", keys: "ctrl-alt-shift-c", action: "mide-files.copy-relative-path" },
  { section: "mod:mide-files", keys: "alt-n", action: "mide-files.new-folder" },
  { section: "mod:mide-files", keys: "ctrl-alt-r", action: "mide-files.reveal" },
  { section: "mod:mide-files", keys: "alt-shift-c", action: "mide-files.copy-absolute-path" },
];
assert.equal(shortcutHint(createShortcuts, "new-file", "macos"), "⌘N");
assert.equal(shortcutHint(createShortcuts, "new-folder", "macos"), "⌥⌘N");
assert.equal(shortcutHint(createShortcuts, "new-folder", "linux"), "Ctrl+Alt+N");
assert.equal(shortcutHint(createShortcuts, "new-folder", "windows"), "Alt+N");
assert.equal(shortcutHint(createShortcuts, "reveal", "macos"), "⌥⌘R");
assert.equal(shortcutHint(createShortcuts, "copy-absolute-path", "macos"), "⌥⌘C");
assert.equal(shortcutHint(createShortcuts, "copy-relative-path", "macos"), "⌥⌘⇧C");
assert.equal(shortcutHint(createShortcuts, "copy-relative-path", "linux"), "Ctrl+Alt+Shift+C");
assert.equal(shortcutHint(createShortcuts, "copy-absolute-path", "windows"), "Alt+Shift+C");
assert.equal(shortcutHint(createShortcuts, "copy-relative-path", "windows"), null);
assert.equal(
  shortcutHint([{ section: "mod:mide-files", keys: "cmd-n", action: "other.action" }], "new-file", "macos"),
  null,
  "a conflicting user binding must not be advertised as the create shortcut",
);
assert.equal(shortcutHint([], "new-file", "macos"), null, "unmerged optional bindings have no hint");

assert.equal(creationFolder("", "folder"), "");
assert.equal(creationFolder("src", "folder"), "src");
assert.equal(creationFolder("src/lib/main.js", "file"), "src/lib");
assert.equal(creationFolder("main.js", "file"), "");
assert.equal(createAbsolutePath("/work/repo/", "src/lib", "new file.js"), "/work/repo/src/lib/new file.js");
assert.equal(createAbsolutePath("C:\\work\\repo", "src", "new file.js"), "C:/work/repo/src/new file.js");
assert.equal(createAbsolutePath("/", "", "new file.js"), "/new file.js");

for (const value of [
  "",
  "   ",
  " leading",
  "trailing ",
  ".",
  "..",
  "a/b",
  "a\\b",
  "a:b",
  "a*file",
  "a. ",
  "\u0000name",
]) {
  assert.ok(validateCreateName(value), `must reject invalid name ${JSON.stringify(value)}`);
}
assert.equal(validateCreateName(".gitignore"), null, "leading dots are valid names");
assert.equal(validateCreateName("notes — 你好.txt"), null, "Unicode names are valid");
assert.ok(validateCreateName("README.md", ["README.md"]), "an exact duplicate must be rejected");
assert.ok(
  validateCreateName("readme.md", ["README.md"], false),
  "case-insensitive targets reject case-only duplicates",
);
assert.equal(validateCreateName("readme.md", ["README.md"], true), null, "case-sensitive targets may differ by case");

const path = "/work/It's a folder/📝.txt";
const commands = createShellCommands(path, "file");
assert.equal(commands.posix.program, "sh");
assert.deepEqual(commands.posix.args, ["-c", 'set -C; : > "$1"', "mide-files", path]);
assert.equal(commands.windows.program, "powershell");
assert.deepEqual(commands.windows.args.slice(0, 2), ["-NoProfile", "-EncodedCommand"]);
const windowsScript = Buffer.from(commands.windows.args[2], "base64").toString("utf16le");
assert.ok(windowsScript.includes("$p = '/work/It''s a folder/📝.txt'"), windowsScript);
assert.ok(windowsScript.includes("[System.IO.FileMode]::CreateNew"), windowsScript);

const folderScript = Buffer.from(createShellCommands(path, "folder").windows.args[2], "base64").toString("utf16le");
assert.ok(folderScript.includes("[System.IO.Directory]::CreateDirectory($p)"), folderScript);
assert.deepEqual(revealCommand("macos", "/work/file.txt", "file"), {
  program: "open",
  args: ["-R", "/work/file.txt"],
});
assert.deepEqual(revealCommand("linux", "/work/sub/file.txt", "file"), {
  program: "xdg-open",
  args: ["/work/sub"],
});
const revealScript = Buffer.from(
  revealCommand("windows", "C:/work/It's a file.txt", "file").args[2],
  "base64",
).toString("utf16le");
assert.ok(revealScript.includes("'/select,\"' + $p + '\"'"), revealScript);
assert.ok(revealScript.includes("$p = 'C:/work/It''s a file.txt'"), revealScript);
assert.equal(Buffer.from(utf16leBase64("surrogate pair 😀"), "base64").toString("utf16le"), "surrogate pair 😀");

console.log("file actions tests passed");
