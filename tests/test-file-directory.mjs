import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../mods/mide-files/main.js", import.meta.url), "utf8");
const start = source.indexOf("async function directory(");
const end = source.indexOf("\nexport default class", start);
assert.ok(start >= 0 && end > start, "directory listing helper must exist");
const createDirectory = new Function("exec", "window", `${source.slice(start, end)}\nreturn directory;`);

async function list(platform, on, remoteWindows = false) {
  const calls = [];
  const exec = async (program, args, options) => {
    calls.push({ program, args, on: options.on });
    if (remoteWindows && program === "sh") throw new Error("cannot start sh: program not found");
    return program === "powershell"
      ? { code: 0, stdout: '[{"name":"file.txt","dir":false}]' }
      : { code: 0, stdout: "f\0file.txt\0" };
  };
  const directory = createDirectory(exec, () => ({ platform }));
  const entries = await directory("example folder", on);
  assert.deepEqual(entries, [{ name: "file.txt", dir: false }]);
  return calls;
}

assert.deepEqual(await list("windows", null).then(c => c.map(({ program, on }) => ({ program, on }))),
  [{ program: "powershell", on: null }]);
assert.deepEqual(await list("macos", null).then(c => c.map(({ program, on }) => ({ program, on }))),
  [{ program: "sh", on: null }]);
assert.deepEqual(await list("windows", "server").then(c => c.map(({ program, on }) => ({ program, on }))),
  [{ program: "sh", on: "server" }]);
assert.deepEqual(await list("macos", "server", true).then(c => c.map(({ program, on }) => ({ program, on }))), [
  { program: "sh", on: "server" }, { program: "powershell", on: "server" },
]);

// Windows argv transport mangles arguments containing spaces or quotes, so
// the local listing must travel as a single -EncodedCommand payload that no
// transport layer can re-split, with the folder path embedded in it.
const calls = [];
const capture = async (program, args, options) => {
  calls.push({ program, args, on: options.on });
  return { code: 0, stdout: "[]" };
};
const windowsDirectory = createDirectory(capture, () => ({ platform: "windows" }));
const tricky = "C:\\smoke dir\\O'Brien's 資料";
await windowsDirectory(tricky, null);
assert.deepEqual(calls.map(c => c.program), ["powershell"]);
const args = calls[0].args;
assert.equal(args[0], "-NoProfile");
assert.equal(args[1], "-EncodedCommand", "the listing must not use -Command, which transports badly on Windows");
const payload = Buffer.from(args[2], "base64").toString("utf16le");
assert.ok(payload.includes("-LiteralPath 'C:\\smoke dir\\O''Brien''s 資料'"), `payload must embed the doubled-quote path, got: ${payload}`);
assert.ok(!payload.includes("param($p)"), "the path must be embedded, not passed as a separate argument");
assert.equal(Buffer.from(payload, "utf16le").toString("base64"), args[2],
  "the encoded value must be standard padded base64 of the script's UTF-16LE bytes");

// End-to-end through the real Windows PowerShell: folders with spaces,
// apostrophes and Unicode must list completely, including the dir flag.
if (process.platform === "win32") {
  const scratch = mkdtempSync(join(tmpdir(), "mide-dir-listing-"));
  try {
    mkdirSync(join(scratch, "sub dir"));
    writeFileSync(join(scratch, "sub dir", "meeting notes.txt"), "x");
    writeFileSync(join(scratch, "it's done.md"), "x");
    writeFileSync(join(scratch, "ünïcodé — résumé.txt"), "x");
    const real = (program, args, options) => new Promise((resolve, reject) => {
      const r = spawnSync(program, args, { encoding: "utf8", timeout: 20000 });
      if (r.error) reject(r.error); else resolve({ code: r.status, stdout: r.stdout, stderr: r.stderr });
    });
    const directory = createDirectory(real, () => ({ platform: "windows" }));
    const entries = await directory(join(scratch, "sub dir"), null);
    assert.deepEqual(entries, [{ name: "meeting notes.txt", dir: false }]);
    const parent = await directory(scratch, null);
    assert.deepEqual(parent.filter(e => e.dir), [{ name: "sub dir", dir: true }]);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
console.log("file directory platform tests passed");
