import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { promises as fs } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../mods/mide-files/main.js", import.meta.url), "utf8");
const start = source.indexOf("async function directory(");
const end = source.indexOf("\nexport default class", start);
assert.ok(start >= 0 && end > start, "directory listing helper must exist");
const createDirectory = new Function("exec", "window", "readdir", `${source.slice(start, end)}\nreturn directory;`);

const dirents = list => list.map(([name, dir]) => ({ name, isDirectory: () => dir }));

// Local listings run in-process through Herdr's fs API — no process spawn:
// one PowerShell listing costs seconds on Windows and dominated every refresh.
async function localListing(platform, path, entries) {
  const calls = [];
  const exec = async (program, args) => { calls.push({ program, args }); return { code: 0, stdout: "[]" }; };
  const directory = createDirectory(exec, () => ({ platform }), async p => (calls.push({ readdir: p }), dirents(entries)));
  const result = await directory(path, null);
  return { result, calls };
}

const win = await localListing("windows", "C:\\smoke dir", [["meeting notes.txt", false], ["資料", true]]);
assert.deepEqual(win.result, [{ name: "meeting notes.txt", dir: false }, { name: "資料", dir: true }]);
assert.deepEqual(win.calls.map(c => Object.keys(c)[0]), ["readdir"], "local listings must not spawn a process");
const mac = await localListing("darwin", "/tmp/smoke", [["a.txt", false]]);
assert.deepEqual(mac.calls.map(c => Object.keys(c)[0]), ["readdir"], "local listings must not spawn a process");
assert.deepEqual(mac.result, [{ name: "a.txt", dir: false }]);

// .git and .DS_Store are filtered before the 501-entry cap.
const filtered = await localListing("windows", "C:\\repo", [[".git", true], [".DS_Store", false], ["keep.txt", false]]);
assert.deepEqual(filtered.result, [{ name: "keep.txt", dir: false }]);

// Remote listings keep the shell transports: sh first, and on a Windows
// machine without sh, one encoded PowerShell payload with the path inside.
const remoteCalls = [];
const remoteExec = async (program, args) => {
  remoteCalls.push({ program, args });
  if (program === "sh") throw new Error("cannot start sh: program not found");
  return { code: 0, stdout: '[{"name":"remote.txt","dir":false}]' };
};
const remoteDirectory = createDirectory(remoteExec, () => ({ platform: "windows" }), async () => []);
const remote = await remoteDirectory("example folder", "server");
assert.deepEqual(remote, [{ name: "remote.txt", dir: false }]);
assert.deepEqual(remoteCalls.map(c => c.program), ["sh", "powershell"], "remote Windows must fall back to PowerShell");
const encodedArgs = remoteCalls[1].args;
assert.equal(encodedArgs[0], "-NoProfile");
assert.equal(encodedArgs[1], "-EncodedCommand", "remote PowerShell listing must travel encoded");
const payload = Buffer.from(encodedArgs[2], "base64").toString("utf16le");
assert.ok(payload.includes("-LiteralPath 'example folder'"), `payload must embed the path, got: ${payload}`);
assert.equal(Buffer.from(payload, "utf16le").toString("base64"), encodedArgs[2], "payload must be standard padded base64 of UTF-16LE bytes");

// Remote macOS keeps the sh helper.
const shCalls = [];
const shExec = async (program, args) => { shCalls.push({ program, args }); return { code: 0, stdout: "f\0file.txt\0" }; };
const macRemote = createDirectory(shExec, () => ({ platform: "darwin" }), async () => []);
assert.deepEqual(await macRemote("example folder", "server"), [{ name: "file.txt", dir: false }]);
assert.deepEqual(shCalls.map(c => c.program), ["sh"]);

// End-to-end through the real Windows fs and the real PowerShell.
if (process.platform === "win32") {
  const scratch = mkdtempSync(join(tmpdir(), "mide-dir-listing-"));
  try {
    mkdirSync(join(scratch, "sub dir"));
    writeFileSync(join(scratch, "sub dir", "meeting notes.txt"), "x");
    writeFileSync(join(scratch, "it's done.md"), "x");
    writeFileSync(join(scratch, "ünïcodé — résumé.txt"), "x");
    const real = (program, args) => new Promise((resolve, reject) => {
      const r = spawnSync(program, args, { encoding: "utf8", timeout: 20000 });
      if (r.error) reject(r.error); else resolve({ code: r.status, stdout: r.stdout, stderr: r.stderr });
    });
    const directory = createDirectory(real, () => ({ platform: "windows" }), p => fs.readdir(p, { withFileTypes: true }));
    const entries = await directory(join(scratch, "sub dir"), null);
    assert.deepEqual(entries, [{ name: "meeting notes.txt", dir: false }]);
    const parent = await directory(scratch, null);
    assert.deepEqual(parent.filter(e => e.dir), [{ name: "sub dir", dir: true }]);
    // The remote fallback still works against the real PowerShell.
    const gated = createDirectory(async (program, args) => {
      if (program === "sh") throw new Error("cannot start sh: program not found");
      return real(program, args);
    }, () => ({ platform: "windows" }), async () => []);
    const remoteEntries = await gated(scratch, "server");
    assert.deepEqual(remoteEntries.map(e => e.name).sort(),
      ["it's done.md", "sub dir", "ünïcodé — résumé.txt"].sort());
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
console.log("file directory platform tests passed");
