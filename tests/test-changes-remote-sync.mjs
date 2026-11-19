import assert from "node:assert/strict";
import {
  extractPullRequestLink,
  githubCreatePullRequestUrl,
  openUrlCommand,
  parseGithubRepo,
  primaryRemoteAction,
  primaryRemoteLabel,
  publishPushArgs,
  resolvePullRequestUrl,
  shouldOfferPullRequest,
} from "../mods/mide-changes/remote-sync.js";

assert.equal(primaryRemoteAction({ hasUpstream: false, upstreamGone: false, ahead: 0, behind: 0 }), "publish");
assert.equal(primaryRemoteAction({ hasUpstream: false, upstreamGone: true, ahead: 0, behind: 0 }), "republish");
assert.equal(primaryRemoteAction({ hasUpstream: true, ahead: 0, behind: 2 }), "pull");
assert.equal(primaryRemoteAction({ hasUpstream: true, ahead: 3, behind: 0 }), "push");
assert.equal(primaryRemoteAction({ hasUpstream: true, ahead: 0, behind: 0 }), "fetch");

assert.equal(primaryRemoteLabel("publish", false), "Publish");
assert.equal(primaryRemoteLabel("republish", false), "Republish");
assert.equal(primaryRemoteLabel("fetch", true), "Working…");

assert.deepEqual(parseGithubRepo("git@github.com:herdrdev/herdr-mIDE.git"), {
  owner: "herdrdev",
  repo: "herdr-mIDE",
});
assert.deepEqual(parseGithubRepo("github-personal:SOUMITRO-SAHA/herdr-mIDE.git"), {
  owner: "SOUMITRO-SAHA",
  repo: "herdr-mIDE",
});

assert.equal(
  githubCreatePullRequestUrl("https://github.com/SOUMITRO-SAHA/herdr-mIDE.git", "feature/publish-pr"),
  "https://github.com/SOUMITRO-SAHA/herdr-mIDE/pull/new/feature%2Fpublish-pr",
);

assert.equal(
  extractPullRequestLink(
    "remote: Create a pull request for 'feature/x' on GitHub by visiting:\nremote:      https://github.com/o/r/pull/new/feature%2Fx\n",
  ),
  "https://github.com/o/r/pull/new/feature%2Fx",
);

assert.deepEqual(publishPushArgs("origin", "fix/foo"), ["push", "-u", "origin", "fix/foo:fix/foo"]);
assert.equal(publishPushArgs("origin", ""), null);

assert.equal(
  resolvePullRequestUrl({
    remoteUrl: "https://github.com/a/b",
    branch: "feature/x",
    defaultBranch: "main",
  }),
  "https://github.com/a/b/pull/new/feature%2Fx",
);
assert.equal(
  resolvePullRequestUrl({
    pushPrUrl: "https://github.com/o/r/pull/42",
    remoteUrl: "https://github.com/a/b",
    branch: "feature/x",
    defaultBranch: "main",
  }),
  "https://github.com/o/r/pull/42",
);

assert.equal(
  shouldOfferPullRequest({
    hasUpstream: true,
    branch: "feature/x",
    defaultBranch: "main",
    remoteUrl: "https://github.com/a/b",
  }),
  true,
);
assert.equal(
  shouldOfferPullRequest({
    hasUpstream: true,
    branch: "feature/x",
    defaultBranch: null,
    remoteUrl: "https://github.com/a/b",
  }),
  true,
);
assert.equal(
  shouldOfferPullRequest({
    hasUpstream: false,
    branch: "feature/x",
    defaultBranch: "main",
    remoteUrl: "https://github.com/a/b",
  }),
  false,
);

assert.deepEqual(openUrlCommand("macos", "https://example.com"), { program: "open", args: ["https://example.com"] });
assert.equal(openUrlCommand("linux", "https://example.com").program, "xdg-open");

console.log("Changes remote sync tests passed");
