// One short line out of git's raw output. Git writes multiline "error:"
// blocks with tab-indented file lists, hint paragraphs and an "Aborting"
// tail; surfacing them verbatim read as "Error: error: … Aborting" run onto
// the panel's one-line note. Both known shapes arrive here: git's own
// stderr/stdout, and `String(new Error(stderr))` with its "Error: " prefix.
const LEAD = /^(?:fatal|error|warning|hint):\s*/;
const NOISE = /^(?:aborting|if you are sure|please\b)/i;
const CAP = 180;

const oneLine = message => message.replace(/\s+/g, " ").trim();

const quoted = name => name.replace(/^['"]|['"]$/g, "");

export function friendlyGitError(raw) {
  const text = String(raw?.message ?? raw ?? "")
    .replace(/^Error:\s*/i, "")
    .trim();
  if (!text) return "Git command failed";

  // A blocked switch, checkout or pull lists the files it would clobber,
  // tab-indented under its "would be overwritten" line.
  if (/would be overwritten/i.test(text)) {
    const files = text
      .split("\n")
      .map(line => line.match(/^\t+(.+?)\s*$/)?.[1])
      .filter(name => name && !LEAD.test(name.trim()));
    const shown = files.slice(0, 3).join(", ");
    const extra = files.length > 3 ? ` +${files.length - 3} more` : "";
    return oneLine(
      `Uncommitted changes to ${shown || "some files"}${extra} would be overwritten — commit or stash them first.`,
    );
  }

  const missing = text.match(/invalid reference:\s*(.+?)\s*$/im);
  if (missing) return `No branch named “${quoted(missing[1])}”.`;

  const exists = text.match(/a branch named (.+?) already exists/i);
  if (exists) return `Branch ${exists[1]} already exists.`;

  const unmerged = text.match(/branch (.+?) is not fully merged/i);
  if (unmerged)
    return `Branch ${unmerged[1]} has unmerged commits — force-delete it with git branch -D ${quoted(unmerged[1])}.`;

  if (/divergent branches|reconcile divergent/i.test(text)) {
    return "Local and upstream branches have diverged — pull with a merge or rebase strategy set.";
  }

  const lines = text
    .split("\n")
    .map(line => ({
      kind: line.match(LEAD)?.[0]?.trim().replace(/:$/, "").toLowerCase() ?? null,
      body: oneLine(line.replace(LEAD, "")),
    }))
    .filter(({ body }) => body && !NOISE.test(body));
  const first = lines.find(({ kind }) => kind === "error" || kind === "fatal") ?? lines[0];
  const message = first?.body ?? "Git command failed";
  return message.length > CAP ? `${message.slice(0, CAP - 1)}…` : message;
}

// Names the action in the failure toast title, from the git subcommand.
const ACTION_LABELS = {
  add: "Stage",
  branch: "Branch delete",
  commit: "Commit",
  fetch: "Fetch",
  pull: "Pull",
  push: "Push",
  reset: "Unstage",
  restore: "Unstage",
};

export function gitActionLabel(args) {
  if (args?.[0] === "switch") return args[1] === "-c" ? "Branch create" : "Branch switch";
  return ACTION_LABELS[args?.[0]] ?? "Git";
}
