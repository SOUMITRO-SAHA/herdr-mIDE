import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { capture, bundleInvocation, createFixture, environmentFiles, fixtureGitEnv, isolatedEnv, parseStatus, sceneName, socketFits } from "../scripts/smoke.mjs";

const root = join(tmpdir(), "mide-smoke-test");
const inherited = {
  PATH: "/test/bin", HOME: "/real/home", HC_SOCKET: "/real/socket",
  HC_SESSION: "real", HC_TERMINAL_ID: "t1", HC_TERMINAL_SOCKET: "/real/terminal",
  HC_SCOPE: "real", HERDR_APP_HOME: "/real/app", XDG_RUNTIME_DIR: "/real/runtime",
  XDG_STATE_HOME: "/real/state", XDG_CONFIG_HOME: "/real/config",
};
const env = isolatedEnv(root, "m0123456789", inherited, "darwin");
assert.equal(env.HERDR_APP_HOME, join(root, "h"));
assert.equal(env.HC_SESSION, "m0123456789");
assert.equal(env.XDG_STATE_HOME, join(root, "s"));
assert.equal(env.XDG_CONFIG_HOME, join(root, "c"));
assert.equal(env.XDG_RUNTIME_DIR, join(root, "r"));
for (const key of ["HC_SOCKET", "HC_TERMINAL_ID", "HC_TERMINAL_SOCKET", "HC_SCOPE"]) assert.equal(env[key], undefined);
assert.equal(env.PATH, inherited.PATH);
assert.equal(env.HOME, inherited.HOME);
assert.throws(() => isolatedEnv(root, "real", inherited, "darwin"));
assert.throws(() => isolatedEnv("relative", "m0123456789", inherited, "darwin"));
const windows = isolatedEnv(root, "m0123456789", inherited, "win32");
assert.equal(windows.APPDATA, join(root, "a"));
assert.equal(windows.LOCALAPPDATA, join(root, "l"));
const windowsFiles = environmentFiles(windows, "win32");
assert.match(windowsFiles.shell, /^export APPDATA=/m);
assert.match(windowsFiles.shell, /^export LOCALAPPDATA=/m);
assert.match(windowsFiles.powershell, /^\$env:APPDATA =/m);
assert.match(windowsFiles.powershell, /^\$env:LOCALAPPDATA =/m);
assert.match(windowsFiles.shell, /^unset HC_SOCKET HC_TERMINAL_ID HC_TERMINAL_SOCKET HC_SCOPE$/m);
const gitEnv = fixtureGitEnv(root, { ...env, GIT_DIR: "/real/repo", GIT_OBJECT_DIRECTORY: "/real/objects", GIT_CONFIG_COUNT: "1" });
for (const key of ["GIT_DIR", "GIT_OBJECT_DIRECTORY", "GIT_CONFIG_COUNT"]) assert.equal(gitEnv[key], undefined);
assert.equal(gitEnv.GIT_CONFIG_GLOBAL, join(root, "gitconfig"));
assert.equal(gitEnv.GIT_CONFIG_NOSYSTEM, "1");
assert.deepEqual(parseStatus('{"layout":"herdr-mide","errors":[]}', "herdr-mide").errors, []);
assert.throws(() => parseStatus('{"layout":"main","errors":[]}', "herdr-mide"));
assert.throws(() => parseStatus('{"layout":"herdr-mide","errors":[{"error":"bad"}]}', "herdr-mide"));
assert.throws(() => parseStatus('{"layout":"herdr-mide"}', "herdr-mide"));
assert.equal(sceneName("files"), "files");
assert.throws(() => sceneName("../escape"));
assert.throws(() => sceneName(""));
assert.equal(socketFits("/short", "m0123456789", "darwin"), true);
assert.equal(socketFits(`/${"a".repeat(120)}`, "m0123456789", "darwin"), false);
assert.equal(socketFits(`/${"a".repeat(120)}`, "m0123456789", "win32"), true);
assert.deepEqual(bundleInvocation("darwin"), { program: "sh", args: ["./scripts/bundle.sh"] });
const windowsBundle = bundleInvocation("win32");
assert.equal(windowsBundle.program, "C:/Program Files/Git/bin/bash.exe");
assert.equal(windowsBundle.args[0], "-c");
assert.match(windowsBundle.args[1], /sh \.\/scripts\/bundle\.sh "\$1"/);

const scratch = realpathSync(mkdtempSync(join(tmpdir(), "mide-smoke-test-")));
try {
  const scratchEnv = isolatedEnv(scratch, "m0123456789", { ...inherited, PATH: process.env.PATH }, "darwin");
  createFixture(scratch, scratchEnv);
  assert.equal(readFileSync(join(scratch, "fixture", "sample.txt"), "utf8"), "changed\n");
  assert.equal(readFileSync(join(scratch, "fixture", "new.txt"), "utf8"), "new\n");
  mkdirSync(scratchEnv.HERDR_APP_HOME, { recursive: true });
  writeFileSync(join(scratch, ".mide-smoke.json"), JSON.stringify({ version: 1, root: scratch, session: "m0123456789" }));
  const calls = [];
  const fake = (program, args, actualEnv) => {
    calls.push([program, args[0]]);
    assert.equal(actualEnv.HERDR_APP_HOME, scratchEnv.HERDR_APP_HOME);
    if (args[0] === "status") return '{"layout":"herdr-mide","errors":[]}';
    assert.equal(args[0], "shot");
    const png = Buffer.alloc(24);
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
    png.writeUInt32BE(1, 16); png.writeUInt32BE(1, 20);
    writeFileSync(args[1], png);
    return "";
  };
  const shot = capture(scratch, "files", fake);
  assert.ok(shot.startsWith(join(scratch, "captures")));
  assert.deepEqual(calls, [["herdr-app", "status"], ["herdr-app", "shot"], ["herdr-app", "status"]]);
  assert.throws(() => capture(scratch, "../escape", fake));
  writeFileSync(join(scratch, ".mide-smoke.json"), JSON.stringify({ version: 1, root: "/wrong", session: "m0123456789" }));
  assert.throws(() => capture(scratch, "files", fake));
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
console.log("smoke isolation tests passed");
