---
description: Manage the root CHANGELOG.md in Keep a Changelog format so it is release-ready
---

Manage the root-level `CHANGELOG.md` so it is ready before a release. Format:
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Mode

$ARGUMENTS

- *(empty)* → default: update the `## [Unreleased]` section from commits made since the last release
- `release` → promote `Unreleased` to a versioned release, inferring the version bump from its entries
- `release X.Y.Z` → promote `Unreleased` to exactly `X.Y.Z`
- free text → notes to fold into `Unreleased` alongside what the commits show

## Rules

- "Since the last release" means: commits after the newest versioned heading in `CHANGELOG.md`,
  falling back to the newest git tag, falling back to the full history (first release).
- Every bullet must trace back to a real commit. If a commit subject is too vague to write a good
  entry, read the diff (`git show <sha>`) before writing it. Never invent entries.
- Write entries for the user, not the developer: what changed and why it matters. No raw commit
  subjects, no hashes, no vague slop like "improved X".
- One bullet per user-facing change; squash related commits into one bullet; skip merges, chores,
  CI-only, and internal-only commits.
- Categories in this order: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.
  Breaking changes go under `Changed` as `**Breaking:** ...`.
- Newest release at the top. Never rewrite or reword old release sections — only append and edit
  `Unreleased` and the compare links at the bottom.

## On `release`

1. If `Unreleased` is empty, populate it first from the commits since the last release. If there
   is still nothing to release, stop and say so.
2. Version: use the given one; otherwise infer — any `**Breaking:**` → major bump, any
   `Added`/`Changed` → minor bump, else patch bump. First release defaults to `0.1.0`.
3. Move the entries under `## [X.Y.Z] - <today>` and leave a fresh empty `## [Unreleased]` above it.
4. Update the compare links at the bottom using the origin remote (convert `git@github.com:owner/repo.git`
   to `https://github.com/owner/repo`):
   - `[Unreleased]: .../compare/vX.Y.Z...HEAD`
   - `[vX.Y.Z]: .../commits/vX.Y.Z` (first release only; otherwise append the new version above the old one)
5. Do not tag, commit, or push. Do not modify any file other than `CHANGELOG.md`.
6. End with the release notes as a one-paragraph summary plus the suggested `git tag` command.

If `CHANGELOG.md` does not exist, create it first:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
```

## COMMITS SINCE LAST RELEASE

!`LAST=$(git describe --tags --abbrev=0 2>/dev/null); if [ -n "$LAST" ]; then git log --no-decorate --pretty=format:"- %s" "$LAST..HEAD"; else git log --no-decorate --pretty=format:"- %s"; fi`

## CURRENT CHANGELOG.md

!`cat CHANGELOG.md 2>/dev/null || echo "(CHANGELOG.md does not exist yet)"`

## GIT REMOTE

!`git remote get-url origin 2>/dev/null || echo "(no remote)"`

## TODAY

!`date +%Y-%m-%d`
