// Prepare and inspect an isolated, user-started Herdr window. Never launch,
// or stop an app or core. Capture only queries status and requests a screenshot.
import { randomBytes } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cleared = ["HC_SOCKET", "HC_TERMINAL_ID", "HC_TERMINAL_SOCKET", "HC_SCOPE"];

export function isolatedEnv(root, session, inherited = process.env, platform = process.platform) {
  if (!isAbsolute(root) || !/^m[0-9a-f]{10}$/.test(session)) throw new Error("Invalid isolated root or session");
  const env = {
    ...inherited,
    HERDR_APP_HOME: join(root, "h"),
    HC_SESSION: session,
    XDG_STATE_HOME: join(root, "s"),
    XDG_CONFIG_HOME: join(root, "c"),
    XDG_RUNTIME_DIR: join(root, "r"),
    DO_NOT_TRACK: "1",
  };
  for (const key of cleared) delete env[key];
  if (platform === "win32") {
    env.APPDATA = join(root, "a");
    env.LOCALAPPDATA = join(root, "l");
  }
  return env;
}

export function parseStatus(text, expectedLayout) {
  const status = JSON.parse(text);
  if (!status || status.layout !== expectedLayout || !Array.isArray(status.errors))
    throw new Error("Expected the isolated herdr-mide layout and an errors list");
  if (status.errors.length) throw new Error(`Herdr reports errors: ${JSON.stringify(status.errors)}`);
  return status;
}

export function sceneName(name) {
  if (!/^[a-z][a-z0-9-]{0,31}$/.test(name)) throw new Error("Scene must be a short lowercase name");
  return name;
}

export function socketFits(root, session, platform = process.platform) {
  if (platform === "win32") return true;
  // Leave 16 bytes for core's platform-dependent socket suffixes.
  const socket = join(root, "r", "herdr-core", `${session}.sock`);
  return Buffer.byteLength(socket) + 16 <= 103;
}

export function fixtureGitEnv(root, inherited) {
  const env = { ...inherited };
  for (const key of Object.keys(env)) if (key.toUpperCase().startsWith("GIT_")) delete env[key];
  return { ...env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: join(root, "gitconfig"), GIT_TERMINAL_PROMPT: "0" };
}

function command(program, args, env, cwd = repo) {
  const result = spawnSync(program, args, { cwd, env, encoding: "utf8", timeout: 30000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${program} ${args[0]} failed: ${result.stderr || result.stdout}`);
  return result.stdout;
}

export function bundleInvocation(platform = process.platform) {
  // How prepare() builds the bundle: Git Bash drives the same
  // scripts/bundle.sh on Windows, where Node cannot spawn a bare `sh` by
  // name. The justfile is the only entry point; nothing here runs GNU Make.
  if (platform !== "win32") return { program: "sh", args: ["./scripts/bundle.sh"] };
  return {
    program: "C:/Program Files/Git/bin/bash.exe",
    args: ["-c", `sh ./scripts/bundle.sh "$1"`, "bundle"],
  };
}

function posixQuote(value) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}
function psQuote(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

export function environmentFiles(env, platform = process.platform) {
  const names = [
    "HERDR_APP_HOME",
    "HC_SESSION",
    "XDG_STATE_HOME",
    "XDG_CONFIG_HOME",
    "XDG_RUNTIME_DIR",
    "DO_NOT_TRACK",
    ...(platform === "win32" ? ["APPDATA", "LOCALAPPDATA"] : []),
  ];
  const shell =
    names
      .map(key => `export ${key}=${posixQuote(env[key])}`)
      .concat(`unset ${cleared.join(" ")}`)
      .join("\n") + "\n";
  const powershell =
    names
      .map(key => `$env:${key} = ${psQuote(env[key])}`)
      .concat(`Remove-Item ${cleared.map(key => `Env:${key}`).join(", ")} -ErrorAction SilentlyContinue`)
      .join("\n") + "\n";
  return { shell, powershell };
}

export function createFixture(root, env) {
  const fixture = join(root, "fixture"),
    hooks = join(root, "hooks"),
    globalConfig = join(root, "gitconfig");
  mkdirSync(fixture, { mode: 0o700 });
  mkdirSync(hooks, { mode: 0o700 });
  writeFileSync(globalConfig, "", { flag: "wx", mode: 0o600 });
  const gitEnv = fixtureGitEnv(root, env);
  const git = (...args) => command("git", args, gitEnv, fixture);
  git("init", "-q");
  git("config", "user.name", "mIDE Smoke");
  git("config", "user.email", "mide-smoke@example.invalid");
  git("config", "commit.gpgsign", "false");
  git("config", "core.hooksPath", hooks);
  writeFileSync(join(fixture, "sample.txt"), "original\n");
  git("add", "sample.txt");
  git("commit", "-q", "-m", "Initial smoke fixture");
  writeFileSync(join(fixture, "sample.txt"), "changed\n");
  writeFileSync(join(fixture, "new.txt"), "new\n");
  return fixture;
}

function prepare() {
  const session = `m${randomBytes(5).toString("hex")}`;
  // Prefer the configured temp directory, falling back to Herdr's /var/tmp
  // convention only when Unix-domain socket limits require a shorter path.
  const candidates = [tmpdir(), ...(process.platform === "win32" ? [] : ["/var/tmp"])];
  const base = candidates
    .filter(existsSync)
    .map(path => realpathSync(path))
    .find(path => socketFits(join(path, "mXXXXXX"), session));
  if (!base)
    throw new Error("No private temp path is short enough for Herdr's socket; set TMPDIR to a shorter directory");
  // Short names leave room for Unix-domain sockets. No existing path is reused.
  const root = realpathSync(mkdtempSync(join(base, "m")));
  const env = isolatedEnv(root, session);
  for (const key of [
    "HERDR_APP_HOME",
    "XDG_STATE_HOME",
    "XDG_CONFIG_HOME",
    "XDG_RUNTIME_DIR",
    ...(process.platform === "win32" ? ["APPDATA", "LOCALAPPDATA"] : []),
  ]) {
    mkdirSync(env[key], { recursive: true, mode: 0o700 });
  }
  const bundle = join(root, "bundle");
  const buildEnv = { ...process.env, PREVIEW: join(repo, "preview.png") };
  const invocation = bundleInvocation(process.platform);
  command(invocation.program, [...invocation.args, bundle], buildEnv);
  cpSync(join(bundle, "mods"), join(env.HERDR_APP_HOME, "mods"), { recursive: true, errorOnExist: true, force: false });
  cpSync(join(bundle, "layouts"), join(env.HERDR_APP_HOME, "layouts"), {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
  createFixture(root, env);
  writeFileSync(join(root, ".mide-smoke.json"), JSON.stringify({ version: 1, root, session }) + "\n", {
    flag: "wx",
    mode: 0o600,
  });
  const { shell, powershell } = environmentFiles(env);
  writeFileSync(join(root, "env.sh"), shell, { flag: "wx", mode: 0o600 });
  writeFileSync(join(root, "env.ps1"), powershell, { flag: "wx", mode: 0o600 });
  console.log(`Prepared: ${root}\nNo app or core was launched. Follow TESTING.md in a disposable desktop environment.`);
}

export function capture(rootArg, label, run = command) {
  if (!rootArg || !isAbsolute(rootArg)) throw new Error("Set SMOKE_ROOT to the absolute prepared directory");
  const root = realpathSync(rootArg);
  const marker = JSON.parse(readFileSync(join(root, ".mide-smoke.json"), "utf8"));
  if (marker.version !== 1 || marker.root !== root) throw new Error("Not an mIDE-prepared smoke directory");
  const env = isolatedEnv(root, marker.session);
  const scene = sceneName(label);
  parseStatus(run("herdr-app", ["status"], env), "herdr-mide");
  const captures = join(root, "captures");
  mkdirSync(captures, { recursive: true, mode: 0o700 });
  const directory = mkdtempSync(join(captures, `${scene}-`));
  const shot = join(directory, "screen.png");
  if (existsSync(shot)) throw new Error("Refusing to overwrite a screenshot");
  run("herdr-app", ["shot", shot], env);
  const png = readFileSync(shot);
  if (
    png.length < 24 ||
    !png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    !png.readUInt32BE(16) ||
    !png.readUInt32BE(20)
  )
    throw new Error("Herdr did not produce a valid PNG header");
  parseStatus(run("herdr-app", ["status"], env), "herdr-mide");
  return shot;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    if (process.argv[2] === "--prepare") prepare();
    else if (process.argv[2] === "--capture") {
      const shot = capture(process.env.MIDE_SMOKE_ROOT, process.env.MIDE_SMOKE_SCENE || "screen");
      console.log(
        `No mod errors reported. Screenshot: ${shot}\nInspect the image and test interactions manually; capture is not a visual assertion.`,
      );
    } else throw new Error("Use just smoke-prepare or just smoke-capture");
  } catch (error) {
    console.error(`smoke: ${error.message}`);
    process.exitCode = 1;
  }
}
