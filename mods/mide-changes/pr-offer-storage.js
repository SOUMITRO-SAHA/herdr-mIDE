// Persisted per-repo-branch PR offer state (a row kept until used).

import { shared, setShared } from "herdr";
import { pullRequestBranchKey, pullRequestEligible } from "./remote-sync.js";

const DISMISSED = "mide.changes.prDismissed";
const PENDING = "mide.changes.prPending";
const PUSH_URL = "mide.changes.prPushUrl";

function readMap(key) {
  const value = shared(key);
  return value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
}

function writeMap(key, map) {
  setShared(key, map);
}

export function pullRequestDismissed(cwd, branch) {
  const id = pullRequestBranchKey(cwd, branch);
  return id ? Boolean(readMap(DISMISSED)[id]) : false;
}

export function pullRequestPending(cwd, branch) {
  const id = pullRequestBranchKey(cwd, branch);
  return id ? Boolean(readMap(PENDING)[id]) : false;
}

export function storedPullRequestPushUrl(cwd, branch) {
  const id = pullRequestBranchKey(cwd, branch);
  if (!id) return null;
  const url = readMap(PUSH_URL)[id];
  return typeof url === "string" && url ? url : null;
}

export function markPullRequestOffer(cwd, branch, { pushPrUrl, remoteUrl, defaultBranch, hasUpstream }) {
  const id = pullRequestBranchKey(cwd, branch);
  if (!id || pullRequestDismissed(cwd, branch)) return;
  if (!pullRequestEligible({ hasUpstream, branch, defaultBranch, remoteUrl, pushPrUrl })) return;
  const pending = readMap(PENDING);
  pending[id] = true;
  writeMap(PENDING, pending);
  if (pushPrUrl) {
    const urls = readMap(PUSH_URL);
    urls[id] = pushPrUrl;
    writeMap(PUSH_URL, urls);
  }
}

export function dismissPullRequestOffer(cwd, branch) {
  const id = pullRequestBranchKey(cwd, branch);
  if (!id) return;
  const pending = readMap(PENDING);
  delete pending[id];
  writeMap(PENDING, pending);
  const dismissed = readMap(DISMISSED);
  dismissed[id] = true;
  writeMap(DISMISSED, dismissed);
  const urls = readMap(PUSH_URL);
  delete urls[id];
  writeMap(PUSH_URL, urls);
}
