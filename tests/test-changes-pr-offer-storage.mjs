import assert from "node:assert/strict";
import { mock } from "bun:test";

// pr-offer-storage reads and writes through Herdr's `shared` store, and every
// setShared re-renders all mods: stand in for it here so the persistence
// rules — and the one-write-per-action contract — can be tested outside the app.
const store = new Map();
let writes = 0;
mock.module("herdr", () => ({
  shared: key => store.get(key),
  setShared: (key, value) => {
    writes += 1;
    store.set(key, value);
  },
}));

const {
  dismissPullRequestOffer,
  markPullRequestOffer,
  pullRequestDismissed,
  pullRequestPending,
  storedPullRequestPushUrl,
} = await import("../mods/mide-changes/pr-offer-storage.js");

const repo = "/repos/demo";
const eligible = { pushPrUrl: null, remoteUrl: "https://github.com/a/b", defaultBranch: "main", hasUpstream: true };

// Arming stores one pending entry in a single shared write.
markPullRequestOffer(repo, "feature/x", { ...eligible, pushPrUrl: "https://github.com/a/b/pull/new/feature%2Fx" });
assert.equal(pullRequestPending(repo, "feature/x"), true);
assert.equal(pullRequestDismissed(repo, "feature/x"), false);
assert.equal(storedPullRequestPushUrl(repo, "feature/x"), "https://github.com/a/b/pull/new/feature%2Fx");
assert.equal(writes, 1, "arming the offer writes once");

// Entries are per repo branch: another branch sees nothing.
assert.equal(pullRequestPending(repo, "feature/y"), false);
assert.equal(storedPullRequestPushUrl(repo, "feature/y"), null);

// Using the offer retires it — also in one write.
dismissPullRequestOffer(repo, "feature/x");
assert.equal(pullRequestPending(repo, "feature/x"), false);
assert.equal(pullRequestDismissed(repo, "feature/x"), true);
assert.equal(storedPullRequestPushUrl(repo, "feature/x"), null);
assert.equal(writes, 2, "dismissing the offer writes once");

// A later plain push with a hint must not nag a branch whose offer was used.
markPullRequestOffer(repo, "feature/x", { ...eligible, pushPrUrl: "https://github.com/a/b/pull/new/feature%2Fx" });
assert.equal(pullRequestPending(repo, "feature/x"), false);
assert.equal(writes, 2, "a dismissed branch is not re-armed by a plain push");

// A fresh publish (`push -u`) starts a new cycle and re-offers the branch.
markPullRequestOffer(repo, "feature/x", { ...eligible, rearm: true });
assert.equal(pullRequestPending(repo, "feature/x"), true);
assert.equal(pullRequestDismissed(repo, "feature/x"), false);
// The used URL is gone; the re-armed offer rebuilds from the remote URL.
assert.equal(storedPullRequestPushUrl(repo, "feature/x"), null);
assert.equal(writes, 3);

// Re-arming again keeps the newest URL git printed.
markPullRequestOffer(repo, "feature/x", { ...eligible, rearm: true, pushPrUrl: "https://github.com/a/b/pull/7" });
assert.equal(storedPullRequestPushUrl(repo, "feature/x"), "https://github.com/a/b/pull/7");
assert.equal(writes, 4);

// Non-GitHub remotes without a printed URL are never offered.
markPullRequestOffer(repo, "feature/z", {
  pushPrUrl: null,
  remoteUrl: "https://gitlab.example/group/repo",
  defaultBranch: "main",
  hasUpstream: true,
});
assert.equal(pullRequestPending(repo, "feature/z"), false);
assert.equal(writes, 4, "an ineligible branch writes nothing");

// A missing repo or branch name never writes.
markPullRequestOffer("", "feature/x", { ...eligible });
markPullRequestOffer(repo, "", { ...eligible });
assert.equal(writes, 4);

console.log("Changes PR offer storage tests passed");
