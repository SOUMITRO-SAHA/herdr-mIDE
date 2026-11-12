# Contributing to herdr-mIDE

herdr-mIDE follows an **issue-first** contribution flow: every pull request
starts with a claimed issue, and the PR links back to that issue so the
discussion closes when the code merges. The _what and why_ live in the issue;
the _how_ lives in the PR.

These rules apply to everyone — people and AI agents alike. Agents should
also read [AGENTS.md](./AGENTS.md) for mod-specific rules: public Herdr APIs
only, TDD, the `herdr-dev` profile for local testing, the two icon sources,
and third-party credit.

## The flow at a glance

1. Find or create the issue (§1)
2. Claim it (§2)
3. Branch from `main` (§3)
4. Develop — TDD, formatting, tests (§4)
5. Commit — `type(scope): summary` (§5)
6. Open a PR linked to the issue (§6)
7. Verification gate passes, review, merge (§6)

## 1. Issues first — every PR needs an issue

- **No issue, no PR.** Bug fixes need a bug report (reproduction steps);
  features need a proposal with the user-visible behavior and, where
  possible, acceptance criteria ("done when …"). Docs and tooling changes
  get issues too — small ones are fine.
- Search the open issues first; comment on an existing issue rather than
  duplicating it, and let a maintainer close the duplicate.
- The issue is where scope is agreed **before** code is written.

## 2. Claim before you code

- Comment **`/claim`** on the issue before starting work. The maintainer
  confirms the claim (assignment or a 👍 on the claim comment).
- **The claimant has the highest merge priority.** If two PRs exist for one
  issue, the claimant's PR is reviewed and merged first.
- **Do not start work on an issue someone else has claimed.** Racing a
  claimant wastes both sides' effort and produces throwaway code.
- **Claims expire, but politely.** If a claim shows no activity for 7 days,
  ask on the issue first — "still on this? need help? any ETA?". Only a
  maintainer reassigns a claim, on the record, in the issue.
- **If an already-claimed issue matters to you:** comment on it. Ask who is
  on it, what the status is, whether there is an ETA, and offer help
  (review, a reproduction case, design notes, a draft). That comment is the
  channel — not a competing PR, and not a silent takeover.

## 3. Branch names

Branch from the latest `main` as:

```
<type>/<issue-number>-<short-slug>
```

- `type` — one of the commit types: `feat`, `fix`, `docs`, `refactor`,
  `perf`, `test`, `ci`, `build`, `chore`.
- `short-slug` — two to four kebab-case words, imperative, describing the
  change.

Examples: `fix/12-editor-save-windows`, `docs/7-issue-first-contribution-flow`.

## 4. Develop

- One-time setup: install [Bun](https://bun.sh), then `bun install` — this
  provides the [Prettier](https://prettier.io) formatter. Node.js is not
  required; the recipes run the tests through Bun.
- Format before committing: `just fmt` (CI enforces `just fmt-check`).
  Formatting covers JavaScript, JSON, Markdown and YAML. Exempt on purpose:
  the compact `mods/mide-files/icons.js` association map and the vendored
  reference checkouts under `.agents/`.
- Tests first: every behavior change gets a focused failing test, then the
  implementation (see AGENTS.md). `just test` must be green before a PR.
- Mods changed → `just check` too (the Herdr runtime's own parser).
- Any live Herdr verification runs in the `herdr-dev` profile, never the
  production app home (AGENTS.md, “Local testing”).
- Update in the same change: `CHANGELOG.md` (Unreleased) for user-facing
  changes, `RECIPE.md` for behavior, asset or setup changes, and
  `THIRD-PARTY-NOTICES.md` for anything adopted from third parties.

## 5. Commits

- Format: `type(scope): summary` — Conventional Commits.
- `summary` — imperative, lowercase, at most 72 characters, no trailing
  period.
- `scope` — the mod or area: `files`, `changes`, `diff`, `editor` for the
  mods; `build`, `ci`, `docs`, `testing`, `agents`, `release` for the rest.
- The **body explains why** for users, not a narration of the diff.
  Reference the issue by number when the context is not obvious.

Examples:

- `fix(editor): save by keyboard on Windows and Linux`
- `docs(agents): require the herdr-dev profile for all local testing`
- `build(fmt): add Prettier behind just fmt and just fmt-check`

## 6. Pull requests and the merge gate

Open the PR against `main` with the template
(`.github/PULL_REQUEST_TEMPLATE.md`) filled in. A maintainer merges only
when **all** of the following hold — the template checklist mirrors this
gate:

1. **Linked issue** — the description carries a closing keyword
   (`Fixes #N`, `Closes #N` or `Resolves #N`); the issue closes on merge.
2. **Valid claim** — the PR author is the claimant of that issue, or the
   maintainer approved a takeover on the record in the issue.
3. **CI green** — the `Checks` workflow passes: `just fmt-check` and
   `just test` on every PR. `just check` and the Windows end-to-end smoke
   run where configured (the `windows-e2e` label or dispatch).
4. **Checklist complete** — tests added (TDD), changelog, recipe and
   notices updated where relevant.
5. **Review approval** — with the claimant's PR taking merge priority.

Keep PRs small and focused; split unrelated fixes into separate issues and
PRs. Draft PRs are welcome early — mark them as drafts until the checklist
is green.

## Licensing

By contributing you agree that your work is licensed under the project's
[Apache-2.0](./LICENSE) license. Third-party material — code, icons,
palettes, snippets — must follow the credit rules in
[THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md) and the two-icon-sources
rule in AGENTS.md.
