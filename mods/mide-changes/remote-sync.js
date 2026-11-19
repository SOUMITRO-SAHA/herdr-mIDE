// Primary remote action labels and hosting URLs for mIDE Changes.

export function primaryRemoteAction({ hasUpstream, upstreamGone, ahead, behind }) {
  if (!hasUpstream) return upstreamGone ? "republish" : "publish";
  if (behind) return "pull";
  if (ahead) return "push";
  return "fetch";
}

export function primaryRemoteLabel(action, busy) {
  if (busy) return "Working…";
  if (action === "publish") return "Publish";
  if (action === "republish") return "Republish";
  if (action === "pull") return "Pull";
  if (action === "push") return "Push";
  return "Fetch";
}

export function parseGithubRepo(remoteUrl) {
  const raw = String(remoteUrl ?? "").trim();
  if (!raw) return null;
  const ssh = raw.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (ssh) return { owner: ssh[1], repo: ssh[2] };
  const scp = raw.match(/^github[^:]+:([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (scp) return { owner: scp[1], repo: scp[2] };
  try {
    const url = new URL(raw.replace(/^git\+/, ""));
    if (!/github\.com$/i.test(url.hostname)) return null;
    const parts = url.pathname
      .replace(/^\//, "")
      .replace(/\.git$/, "")
      .split("/")
      .filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
}

/** GitHub “new PR” URL (pull/new/{branch}). */
export function githubCreatePullRequestUrl(remoteUrl, headBranch) {
  const repo = parseGithubRepo(remoteUrl);
  const head = String(headBranch ?? "").trim();
  if (!repo || !head) return null;
  return `https://github.com/${repo.owner}/${repo.repo}/pull/new/${encodeURIComponent(head)}`;
}

export function resolvePullRequestUrl({ pushPrUrl, remoteUrl, branch, defaultBranch }) {
  if (pushPrUrl) return pushPrUrl;
  if (!branch) return null;
  if (defaultBranch && branch === defaultBranch) return null;
  if (!defaultBranch && (branch === "main" || branch === "master")) return null;
  return githubCreatePullRequestUrl(remoteUrl, branch);
}

/** Stable id for per-branch PR-offer state (persisted via Herdr `shared`). */
export function pullRequestBranchKey(cwd, branch) {
  const root = String(cwd ?? "").trim();
  const name = String(branch ?? "").trim();
  if (!root || !name) return null;
  return `${root}\0${name}`;
}

export function pullRequestEligible({ hasUpstream, branch, defaultBranch, remoteUrl, pushPrUrl }) {
  if (!hasUpstream || !branch) return false;
  return Boolean(resolvePullRequestUrl({ pushPrUrl, remoteUrl, branch, defaultBranch }));
}

/**
 * Offer only while `pending` (set after publish / push hint) until the
 * person opens the URL once (`dismissed`).
 */
export function shouldOfferPullRequest({
  hasUpstream,
  branch,
  defaultBranch,
  remoteUrl,
  pushPrUrl,
  pending = false,
  dismissed = false,
}) {
  if (dismissed || (!pending && !pushPrUrl)) return false;
  return pullRequestEligible({ hasUpstream, branch, defaultBranch, remoteUrl, pushPrUrl });
}

/** True when git push output should arm a one-time PR offer (publish `-u` or host PR hint). */
export function shouldArmPullRequestOffer(gitArgs, stderr) {
  if (gitArgs[0] !== "push") return false;
  if (gitArgs.includes("-u")) return true;
  return Boolean(extractPullRequestLink(stderr));
}

const PR_HINTS = ["create a pull request", "create pull request", "create a merge request", "view merge request"];

function extractUrl(line) {
  const match = line.match(/https?:\/\/\S+/);
  if (!match) return null;
  return match[0].replace(/[.,)\]>]+$/, "");
}

/** Parse git push stderr — pull-request hints. */
export function extractPullRequestLink(stderr) {
  let pending = false;
  for (const line of String(stderr ?? "").split("\n")) {
    const trimmed = line.trimStart();
    const body = trimmed.startsWith("remote:") ? trimmed.slice(7).trim() : trimmed;
    const lower = body.toLowerCase();
    if (PR_HINTS.some(hint => lower.includes(hint))) pending = true;
    const url = extractUrl(body);
    if (url && pending) return url;
    if (url && /pull|merge_request|compare/i.test(url)) return url;
    if (!trimmed.startsWith("remote:")) pending = false;
  }
  return null;
}

export function publishPushArgs(remote, branch) {
  const name = String(branch ?? "").trim();
  const target = String(remote ?? "").trim();
  if (!name || !target) return null;
  return ["push", "-u", target, `${name}:${name}`];
}

export function openUrlCommand(platform, url) {
  if (platform === "macos") return { program: "open", args: [url] };
  if (platform === "windows") {
    const escaped = String(url).replace(/'/g, "''");
    return {
      program: "powershell",
      args: ["-NoProfile", "-Command", `Start-Process '${escaped}'`],
    };
  }
  return { program: "xdg-open", args: [url] };
}
