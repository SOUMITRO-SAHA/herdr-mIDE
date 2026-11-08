import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { groupChanges } from "../mods/mide-changes/change-groups.js";

const root = mkdtempSync(join(tmpdir(), "mide-tracking-"));
try {
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  git("init", "-q");
  git("-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-q", "--allow-empty", "-m", "initial");
  writeFileSync(join(root, "new.txt"), "new file\n");

  const source = readFileSync(new URL("../mods/mide-changes/main.js", import.meta.url), "utf8");
  const method = (start, end) => source.slice(source.indexOf(`  ${start}(`), source.indexOf(end, source.indexOf(`  ${start}(`)));
  let releaseStatus, statusCaptured;
  const captured = new Promise((resolve) => { statusCaptured = resolve; });
  const blocked = new Promise((resolve) => { releaseStatus = resolve; });
  let blockStatus = true;
  const reads = [];
  const exec = async (_command, args) => {
    if (args.includes("rev-parse") || args.includes("status") || args.includes("diff") || args.includes("branch") || args.includes("rev-list")) reads.push(args);
    let result;
    try { result = { code: 0, stdout: git(...args), stderr: "" }; }
    catch (error) { result = { code: error.status, stdout: String(error.stdout || ""), stderr: String(error.stderr || "") }; }
    if (blockStatus && args.includes("status")) {
      blockStatus = false;
      statusCaptured();
      await blocked;
    }
    return result;
  };
  const makeMethods = new Function("location", "key", "exec", "READ", `return ({${method("refresh", "  // Open the review diff")}, ${method("git", "  stage(file")}})`);
  const methods = makeMethods(() => ({ cwd: root, on: null }), () => "context", exec, ["--no-optional-locks", "-c", "core.fsmonitor=false"]);
  const view = { ...methods, context: "context", loading: false, busy: false, files: [], currentKey: () => "context", watch: () => {} };
  const tasks = [];
  const cx = { spawn: (fn) => tasks.push(fn(cx)), notify: () => {} };
  const drain = async () => { while (tasks.length) await tasks.shift(); };

  // Capture the untracked status, then stage before that refresh completes.
  view.refresh(cx);
  await captured;
  view.git(cx, ["add", "--", "new.txt"]);
  await tasks[1];
  releaseStatus();
  await drain();
  for (const args of reads) {
    assert.deepEqual(args.slice(0, 3), ["--no-optional-locks", "-c", "core.fsmonitor=false"], "Git reads must not trigger watcher refresh loops");
  }
  assert.equal(view.files.length, 1);
  assert.equal(view.files[0].fresh, false, "staged addition must no longer be Git-untracked after an overlapping refresh");
  assert.equal(view.files[0].created, true, "a staged new file stays in the Untracked section");
  assert.equal(view.files[0].staged, true);
  assert.deepEqual(groupChanges(view.files).untracked.map((file) => file.path), ["new.txt"]);
  assert.deepEqual(groupChanges(view.files).tracked, []);

  writeFileSync(join(root, "new.txt"), "new file\nmore edits\n");
  view.refresh(cx);
  await drain();
  assert.equal(view.files[0].staged, true);
  assert.equal(view.files[0].unstaged, true);
  assert.deepEqual(groupChanges(view.files).untracked.map((file) => file.path), ["new.txt"], "partially staged new files stay in Untracked");

  view.git(cx, ["restore", "--staged", "--", "new.txt"]);
  await drain();
  assert.equal(view.files[0].fresh, true, "unstaged new file must return to untracked");
  assert.equal(view.files[0].created, true, "an unstaged new file stays in the Untracked section");
  assert.equal(view.files[0].staged, false);

  writeFileSync(join(root, "existing.txt"), "original\n");
  git("add", "--", "existing.txt");
  git("-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-q", "-m", "tracked file");
  writeFileSync(join(root, "existing.txt"), "changed\n");
  view.refresh(cx);
  await drain();
  assert.deepEqual(groupChanges(view.files).tracked.map((file) => file.path), ["existing.txt"]);
  view.git(cx, ["add", "--", "existing.txt"]);
  await drain();
  assert.deepEqual(groupChanges(view.files).tracked.map((file) => file.path), ["existing.txt"], "staged existing files stay in Tracked");
  console.log("Changes tracking categorization tests passed");
} finally {
  rmSync(root, { recursive: true, force: true });
}
