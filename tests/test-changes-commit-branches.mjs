import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "mide-release-git-"));
try {
  const globalConfig = join(root, "empty-gitconfig");
  writeFileSync(globalConfig, "");
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.toUpperCase().startsWith("GIT_")) delete env[key];
  Object.assign(env, { GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: globalConfig, GIT_TERMINAL_PROMPT: "0" });
  const git = (...args) =>
    execFileSync("git", args, { cwd: root, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "-q");
  git("config", "user.name", "mIDE Test");
  git("config", "user.email", "mide-test@example.invalid");
  git("config", "commit.gpgsign", "false");
  mkdirSync(join(root, "empty-hooks"));
  git("config", "core.hooksPath", join(root, "empty-hooks"));
  writeFileSync(join(root, "staged.txt"), "before\n");
  writeFileSync(join(root, "tracked.txt"), "before\n");
  git("add", "staged.txt", "tracked.txt");
  git("commit", "-q", "-m", "initial");
  const initialBranch = git("branch", "--show-current");
  writeFileSync(join(root, "staged.txt"), "staged\n");
  writeFileSync(join(root, "tracked.txt"), "tracked\n");
  writeFileSync(join(root, "untracked.txt"), "untracked\n");
  git("add", "staged.txt");

  const source = readFileSync(new URL("../mods/mide-changes/main.js", import.meta.url), "utf8");
  const method = (start, end) =>
    source.slice(source.indexOf(`  ${start}(`), source.indexOf(`  ${end}(`, source.indexOf(`  ${start}(`)));
  const exec = async (program, args, options) => {
    const result = spawnSync(program, args, { cwd: options.cwd, env, encoding: "utf8" });
    if (result.error) throw result.error;
    return { code: result.status, stdout: result.stdout, stderr: result.stderr };
  };
  const toasts = [];
  const notify = toast => {
    toasts.push(toast);
    return `toast-${toasts.length}`;
  };
  const { friendlyGitError, gitActionLabel } = await import("../mods/mide-changes/git-errors.js");
  const methods = new Function(
    "friendlyGitError",
    "gitActionLabel",
    "exec",
    "notify",
    `return ({${method("fail", "git")}, ${method("git", "stage")}, ${method("fetch", "pull")}, ${method("pull", "push")}, ${method("push", "selectTab")}, ${method("commit", "loadBranches")}, ${method("switchBranch", "createBranch")}, ${method("createBranch", "deleteBranch")}, ${method("deleteBranch", "menuItem")}})`,
  )(friendlyGitError, gitActionLabel, exec, notify);
  const tasks = [];
  const cx = {
    notify() {},
    spawn(fn) {
      tasks.push(fn(cx));
    },
  };
  const drain = async () => {
    while (tasks.length) await tasks.shift();
  };
  let query = "release test";
  const view = {
    ...methods,
    root,
    on: null,
    context: "test",
    currentKey: () => "test",
    loading: false,
    busy: false,
    staged: 1,
    message: "staged only",
    branch: initialBranch,
    files: [{ fresh: false }, { fresh: false }, { fresh: true }],
    view: "changes",
    branches: [],
    input: { set_value() {} },
    branchQuery: {
      value: () => query,
      set_value(value) {
        query = value;
      },
    },
    refresh() {
      this.branch = git("branch", "--show-current");
    },
  };
  view.commit(cx);
  await drain();
  assert.equal(view.note, null);
  assert.equal(git("show", "--format=", "--name-only", "HEAD"), "staged.txt");
  assert.match(git("status", "--porcelain"), /tracked\.txt/);
  assert.match(git("status", "--porcelain"), /\?\? untracked\.txt/);

  view.staged = 0;
  view.message = "tracked only";
  view.commit(cx);
  await drain();
  assert.equal(view.note, null);
  assert.equal(git("show", "--format=", "--name-only", "HEAD"), "tracked.txt");
  assert.match(git("status", "--porcelain"), /\?\? untracked\.txt/);

  view.createBranch(cx);
  await drain();
  assert.equal(view.note, null);
  assert.equal(git("branch", "--show-current"), "release-test");
  view.switchBranch(initialBranch, cx);
  await drain();
  assert.equal(git("branch", "--show-current"), initialBranch);
  view.deleteBranch("release-test", cx);
  await drain();
  assert.equal(view.note, null);
  assert.ok(!git("branch", "--list", "release-test"));

  // Exercise remote actions against a local bare repository only; no network.
  const remote = join(root, "remote.git");
  git("init", "--bare", "-q", remote);
  git("remote", "add", "origin", remote);
  git("push", "-q", "-u", "origin", initialBranch);
  writeFileSync(join(root, "staged.txt"), "local push\n");
  git("add", "staged.txt");
  git("commit", "-q", "-m", "local push");
  view.push(cx);
  await drain();
  assert.equal(view.note, null);
  assert.equal(git("--git-dir", remote, "rev-parse", initialBranch), git("rev-parse", "HEAD"));

  const other = join(root, "other-clone");
  git("clone", "-q", "--branch", initialBranch, remote, other);
  const otherGit = (...args) =>
    execFileSync("git", args, { cwd: other, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  otherGit("config", "user.name", "mIDE Test");
  otherGit("config", "user.email", "mide-test@example.invalid");
  otherGit("config", "commit.gpgsign", "false");
  otherGit("config", "core.hooksPath", join(root, "empty-hooks"));
  writeFileSync(join(other, "upstream.txt"), "upstream\n");
  otherGit("add", "upstream.txt");
  otherGit("commit", "-q", "-m", "upstream");
  otherGit("push", "-q");
  view.fetch(cx);
  await drain();
  assert.equal(view.note, null);
  assert.equal(git("rev-parse", "@{upstream}"), otherGit("rev-parse", "HEAD"));
  view.pull(cx);
  await drain();
  assert.equal(view.note, null);
  assert.equal(readFileSync(join(root, "upstream.txt"), "utf8"), "upstream\n");

  // A switch that would clobber local edits must fail with one short,
  // readable line and an error toast — not git's raw multiline output.
  git("switch", "-q", "-c", "diverged");
  writeFileSync(join(root, "tracked.txt"), "diverged\n");
  git("commit", "-q", "-a", "-m", "diverged");
  git("switch", "-q", initialBranch);
  writeFileSync(join(root, "tracked.txt"), "local edit\n");
  toasts.length = 0;
  view.switchBranch("diverged", cx);
  await drain();
  assert.equal(git("branch", "--show-current"), initialBranch, "the blocked switch must not move HEAD");
  assert.equal(view.note, `Uncommitted changes to tracked.txt would be overwritten — commit or stash them first.`);
  assert.ok(!view.note.includes("\n"), "the inline note must be one line");
  assert.equal(toasts.length, 1, "a failed switch posts one toast");
  assert.equal(toasts[0].level, "error");
  assert.equal(toasts[0].title, "Branch switch failed");
  assert.equal(toasts[0].body, view.note);

  // Switching to a branch that is gone reads as a missing branch, not a raw fatal.
  toasts.length = 0;
  view.switchBranch("deleted-elsewhere", cx);
  await drain();
  assert.equal(view.note, "No branch named “deleted-elsewhere”.");
  assert.equal(toasts.length, 1);
  assert.equal(toasts[0].body, view.note);
  console.log("Changes commit, branch and local-remote integration tests passed");
} finally {
  rmSync(root, { recursive: true, force: true });
}
