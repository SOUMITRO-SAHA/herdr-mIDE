// Persisted per-repo-branch PR offer state (a row kept until used). One
// `shared` key holds the whole map: every setShared re-renders all mods, so
// one write per action keeps that to a single render.
import { shared, setShared } from "herdr";
import { pullRequestBranchKey, pullRequestEligible } from "./remote-sync.js";

const STATE = "mide.changes.prOffer";

function readState() {
  const value = shared(STATE);
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function record(state, id) {
  const value = state[id];
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function pullRequestDismissed(cwd, branch) {
  const id = pullRequestBranchKey(cwd, branch);
  return id ? Boolean(record(readState(), id).dismissed) : false;
}

export function pullRequestPending(cwd, branch) {
  const id = pullRequestBranchKey(cwd, branch);
  return id ? Boolean(record(readState(), id).pending) : false;
}

export function storedPullRequestPushUrl(cwd, branch) {
  const id = pullRequestBranchKey(cwd, branch);
  if (!id) return null;
  const url = record(readState(), id).url;
  return typeof url === "string" && url ? url : null;
}

/**
 * Arms the one-time offer. A plain hint-bearing push respects an already-used
 * branch; `rearm` (a fresh `push -u` publish) starts a new cycle and re-offers.
 */
export function markPullRequestOffer(cwd, branch, { pushPrUrl, remoteUrl, defaultBranch, hasUpstream, rearm = false }) {
  const id = pullRequestBranchKey(cwd, branch);
  if (!id) return;
  if (record(readState(), id).dismissed && !rearm) return;
  if (!pullRequestEligible({ hasUpstream, branch, defaultBranch, remoteUrl, pushPrUrl })) return;
  const state = readState();
  setShared(STATE, {
    ...state,
    [id]: { pending: true, dismissed: false, url: pushPrUrl ?? record(state, id).url ?? null },
  });
}

export function dismissPullRequestOffer(cwd, branch) {
  const id = pullRequestBranchKey(cwd, branch);
  if (!id) return;
  setShared(STATE, { ...readState(), [id]: { pending: false, dismissed: true, url: null } });
}
