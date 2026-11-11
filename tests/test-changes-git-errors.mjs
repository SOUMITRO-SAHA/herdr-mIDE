import assert from "node:assert/strict";
import { friendlyGitError, gitActionLabel } from "../mods/mide-changes/git-errors.js";

// The exact stderr from the reported bug: switching branches with a dirty
// .gitignore. Git writes a multiline "error:" block with a tab-indented file
// list and an "Aborting" tail; the panel must show one short readable line.
const dirty = [
  "error: Your local changes to the following files would be overwritten by checkout:",
  "\t.gitignore",
  "Please commit your changes or stash them before you switch branches.",
  "Aborting",
].join("\n");
assert.equal(
  friendlyGitError(dirty),
  "Uncommitted changes to .gitignore would be overwritten — commit or stash them first.",
);

// Several blocked files are summarized, not dumped.
const several = dirty.replace("\t.gitignore", "\ta.txt\n\tb.txt\n\tc.txt\n\td.txt");
assert.equal(
  friendlyGitError(several),
  "Uncommitted changes to a.txt, b.txt, c.txt +1 more would be overwritten — commit or stash them first.",
);

// Callers wrap git output in an Error, and String(e) adds its own "Error: " —
// which is what read as "Error: error: …" before.
assert.equal(friendlyGitError(new Error(dirty)), friendlyGitError(dirty));
assert.equal(friendlyGitError(`Error: ${dirty}`), friendlyGitError(dirty));

const branches = [
  ["fatal: invalid reference: nope", "No branch named “nope”."],
  ["fatal: a branch named 'x' already exists", "Branch 'x' already exists."],
  ["fatal: a branch named \"x\" already exists", "Branch \"x\" already exists."],
  [
    "error: The branch 'old' is not fully merged.\nIf you are sure you want to delete it, run 'git branch -D old'.\nAborting",
    "Branch 'old' has unmerged commits — force-delete it with git branch -D old.",
  ],
  [
    "hint: You have divergent branches and need to specify how to reconcile them.\nhint: You can do so by running one of the following commands sometime before your next pull:\nhint:   git config pull.rebase false  # merge\nhint:   git config pull.rebase true   # rebase\nhint:   git config pull.ff only       # fast-forward only\nfatal: Need to specify how to reconcile divergent branches.",
    "Local and upstream branches have diverged — pull with a merge or rebase strategy set.",
  ],
];
for (const [raw, expected] of branches) assert.equal(friendlyGitError(raw), expected, raw);

// Anything else keeps git's first meaningful line, as one line: hint and
// "Aborting" tails dropped, prefix and folded whitespace cleaned.
assert.equal(friendlyGitError("fatal: cannot lock ref 'refs/heads/x': group writable"), "cannot lock ref 'refs/heads/x': group writable");
assert.equal(
  friendlyGitError("warning: some note\nerror: the real failure\nAborting"),
  "the real failure",
);
const long = friendlyGitError(`fatal: ${"x".repeat(300)}`);
assert.equal(long.length, 180);
assert.ok(long.endsWith("…"));
assert.equal(friendlyGitError(""), "Git command failed");
assert.equal(friendlyGitError(undefined), "Git command failed");
assert.ok(!friendlyGitError(dirty).includes("\n"), "messages must be one line");

// Data-driven labels name the failed action in the toast title.
assert.equal(gitActionLabel(["switch", "main"]), "Branch switch");
assert.equal(gitActionLabel(["switch", "-c", "new"]), "Branch create");
assert.equal(gitActionLabel(["add", "-A"]), "Stage");
assert.equal(gitActionLabel(["restore", "--staged", "--", "f"]), "Unstage");
assert.equal(gitActionLabel(["reset", "-q", "HEAD", "--", "."]), "Unstage");
assert.equal(gitActionLabel(["branch", "-d", "old"]), "Branch delete");
assert.equal(gitActionLabel(["fetch", "--prune"]), "Fetch");
assert.equal(gitActionLabel(["pull"]), "Pull");
assert.equal(gitActionLabel(["push"]), "Push");
assert.equal(gitActionLabel(["commit", "-m", "msg"]), "Commit");
assert.equal(gitActionLabel(["mystery"]), "Git");
console.log("Changes friendly git error tests passed");
