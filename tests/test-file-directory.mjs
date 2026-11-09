import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../mods/mide-files/main.js", import.meta.url), "utf8");
const start = source.indexOf("async function directory(");
const end = source.indexOf("\nexport default class", start);
assert.ok(start >= 0 && end > start, "directory listing helper must exist");
const createDirectory = new Function("exec", "window", `${source.slice(start, end)}\nreturn directory;`);

async function list(platform, on, remoteWindows = false) {
  const calls = [];
  const exec = async (program, _args, options) => {
    calls.push({ program, on: options.on });
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

assert.deepEqual(await list("windows", null), [{ program: "powershell", on: null }]);
assert.deepEqual(await list("macos", null), [{ program: "sh", on: null }]);
assert.deepEqual(await list("windows", "server"), [{ program: "sh", on: "server" }]);
assert.deepEqual(await list("macos", "server", true), [
  { program: "sh", on: "server" }, { program: "powershell", on: "server" },
]);
console.log("file directory platform tests passed");
