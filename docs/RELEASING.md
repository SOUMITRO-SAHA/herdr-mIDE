# Releasing herdr-mIDE

This is a maintainer checklist, not an automated publisher. Nothing here
publishes, tags, changes GitHub topics or installs into a user's Herdr home.
The first planned bundle version is `0.0.1`; it is not released yet.

## What is versioned

`VERSION` is the intended version of the **whole bundle**: one layout,
`mide-files`, `mide-changes`, `mide-diff` and `mide-editor`. These are
interdependent; we do not promise independent mod versions or automatic
updates. Use SemVer, keep `CHANGELOG.md` under Unreleased while preparing,
and, when approved, record the release date and matching `v<VERSION>` Git tag.
Do not move an already published tag. A GitHub release and its source tag are
our distribution conventions, not a Herdr mod-versioning API. Herdr Gallery
does not document a mod-version manifest or automatic upgrades; do not invent
one or assume a tag alone updates a gallery listing.

## Prepare and verify

1. Update the recipe, README, notices, `VERSION` and release notes to match
   the actual build. Confirm the app version and public APIs against the
   intended released Herdr version; test macOS, Linux and Windows or state
   precisely which remain unsupported/unverified. The layout's clone metadata
   is 0.1.13, not proof that every feature works on that version.
2. Follow the platform workflow in [TESTING.md](./TESTING.md). Run `just test`
   and `just check`. Check uses the installed app to render
   initial mod states; additionally test the layout, editor saves/conflicts,
   tree, diff, staging, commits and branches in an isolated app home and a
   disposable Git repository. Test remote actions only with a disposable
   remote. Record app version, OS and results. Never restart another person's
   app or core.
3. `preview.png` is preview artwork containing a screenshot; feature
   screenshots live in `public/examples/` and the demo video lives in
   `public/`. Verify that the preview meets Herdr's screenshot requirements
   before publication. Confirm that the media still represents the released
   code and review it for names, paths, credentials, terminal output and other
   private content. Check the video's audio and visual material for third-party
   rights and notices. Inclusion in the repo is not a substitute for the
   owner's final review.
4. Run `just bundle`. The **repository root is the complete, installable
   package** — `just test` proves it: every generated `_shared` copy matches
   `shared/syntax.js` via the generator's `--check`, every mod folder carries
   LICENSE and notices, and a fresh `just bundle` output is byte-identical to
   the root for all shipped paths. The bundle copy exists for release
   attachments and smoke staging. It refuses an existing destination; choose
   another with `just bundle dist/herdr-mide-candidate` rather than
   overwriting unreviewed work. The builder checks that a preview file
   exists, not its quality or privacy. The listing preview is the repository
   `preview.png` (owner-selected artwork). `dist/` is ignored and is not
   itself published.
5. Inspect the root package: licenses, notices, references. Run `herdr-app
check` on each root `mods/<name>` and exercise a clean install with
   `install.sh` into an isolated home (this was verified live in the
   `herdr-dev` profile on 2026-11-12). Check name collisions and
   key conflicts; never replace existing user files silently. The source
   `install.sh` is a no-clobber first install, not an upgrade mechanism;
   `just sync` is a destructive development sync for mIDE-owned installed
   paths and is not a safe general-purpose upgrade. A failed installation
   may leave partial copies; inspect them before retrying, since a retry skips
   existing names.

## Gallery submission — Herdr's standard and our standing

The standard this project follows, quoted from Herdr's own documentation, and
exactly where we stand against it. Publication (the GitHub topic) happens only
after the owner approves it; everything before that is local preparation.

Sources of truth, verified 2026-11-12 against `herdrdev/herdr-app` `master`:

- [defaults/AGENTS.md, "Layouts and mods other people made"](https://github.com/herdrdev/herdr-app/blob/master/defaults/AGENTS.md#layouts-and-mods-other-people-made)
- [herdr.dev/gallery](https://herdr.dev/gallery/): "Put the layout, its mods,
  the recipe and a screenshot named preview.png in one folder, push it to a
  public GitHub repo and add the topic herdr-layout."

### Herdr's rule, verbatim

> To share one: put that folder in a public GitHub repo (one folder each if
> there are several), write its `RECIPE.md`, save a screenshot of it as
> `preview.png` and add the repo topic `herdr-layout` for a layout or
> `herdr-mod` for a mod. It shows up at herdr.dev/layouts or herdr.dev/mods
> within the hour.

A layout folder contains `layouts/<name>.json` plus the `mods/<name>/` it
needs. Both layouts and mods carry a `RECIPE.md` (the brief to build it from
scratch) and a `preview.png`. A mod folder may add a `keys.json` with the keys
it expects. The files are one build of the recipe. Herdr does not review
listings; community preview images are screened.

When a person's agent adds a listing, Herdr's documented installer flow is:
read the recipe and every file first and disclose network, `exec`/`hc` and
outside-folder file access; copy the layout and each mod folder, leaving the
recipe and preview out; never overwrite — rename on any name clash; merge a
mod's `keys.json` into the person's, asking before replacing keys they use;
`herdr-app check` each mod, then `layout.switch`; `ctrl-shift-l` switches
back and deleting the files removes it. Our package is built for exactly this
flow: the four mods are interdependent (all `place: "none"`), and the bundled
`RECIPE.md`'s **Built from** already discloses that Changes runs Git
(including network remotes), Files reads workspace folders, and Editor writes
the selected file.

### What Herdr requires vs. where we stand

| Herdr requires                                                                                                   | Our artifact                                                                                                                                         | Status                        |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| A public GitHub repository                                                                                       | `SOUMITRO-SAHA/herdr-mIDE` (public)                                                                                                                  | done                          |
| One folder laid out like a Herdr home                                                                            | **The repository root**: `layouts/herdr-mide.json`, `mods/{mide-files,mide-changes,mide-diff,mide-editor}/`                                          | done                          |
| Complete mod folders                                                                                             | Editor and Diff carry AUTO-GENERATED in-tree `_shared/syntax.js`; every mod folder carries LICENSE and notices — the root installs as-is             | done                          |
| `RECIPE.md`, structured (name + intro + preview; What you see; How it behaves; Built from; Watch out; Done when) | The root `RECIPE.md`, all six sections, cross-checked against the files                                                                              | done                          |
| A reviewed screenshot named `preview.png`                                                                        | The owner-approved artwork at the root `preview.png` (owner's choice for the listing card; feature screenshots live in `public/examples/`)           | done                          |
| Optional `keys.json` the installer can merge                                                                     | The root `keys.json` (`cmd/ctrl-shift-e`, `cmd/ctrl-s`), documented as merge-don't-replace                                                           | done                          |
| The repo topic `herdr-layout`                                                                                    | Added 2026-11-12 with owner approval                                                                                                                 | done                          |
| Listing appears within an hour; verify it                                                                        | Took longer than an hour; then indexed BOTH layout-shaped folders (see verification log). Restructured so the root is the single complete candidate  | verifying after re-crawl      |
| One build of the recipe                                                                                          | `tests/test-bundle.sh`: generator `--check` on every shared copy, plus a fresh `just bundle` output byte-identical to the root for all shipped paths | done, enforced by `just test` |

The original two-candidate ambiguity is resolved: the root is now the single
complete candidate, so the crawler's root-indexing behavior (confirmed
empirically — see the verification log) works in our favor. The stale nested
listing is expected to disappear on re-crawl; if it lingers, use Herdr's
"Report this layout" link on that card.

### Before a publication PR

Local, no approval needed; all gates must be green:

1. `just fmt-check` and `just check` — CI runs the same. `just check` proves
   the root is the complete package: generator `--check` on every shared
   copy, license/notices in every mod folder, and a fresh bundle
   byte-identical to the root for all shipped paths.
2. `herdr-app check` each of the four root mods in a fresh isolated home
   (`HERDR_APP_HOME` at a scratch directory), with pre-existing test keys and
   layouts retained untouched — the no-clobber behavior Herdr's installer
   flow relies on.
3. `preview.png` reviewed by the owner; no private content.
4. `RECIPE.md` cross-checked against the real files (names, sizes, colors,
   behaviors); anything the build does not do must not be claimed.

Record the results in the verification log at the bottom of this file.

### Publication steps — owner approval required

1. Merge the gallery-preparation PR (issue #15 branch).
2. Owner says "publish". Then, and only then, add exactly the topic
   `herdr-layout` to the repository (`gh repo edit --add-topic herdr-layout`
   or the GitHub web UI).
3. Wait up to an hour for discovery.
4. Verify: the listing exists at `herdr.dev/layouts/<owner>/<repo>`; the
   preview, recipe link and file listing point at the repository root's
   content (layouts, all four mods with `_shared/`, keys.json). Open the
   listed files and check.
5. Record the listing URL, date, and what was checked in the verification
   log. If a wrong or stale candidate was listed, use Herdr's per-listing
   "Report this layout" link and, if needed, agree remediation with the
   owner before touching the topic or structure.

### Updating a published listing

Herdr documents no mod-version manifest or automatic update flow; treat the
listing as reflecting the repository content. To update: bump `VERSION` per
" What is versioned" above, make the change at the root (for shared modules:
edit `shared/`, run `just shared`, let `just test` prove the copies and the
bundle are exact), merge, and re-verify the listing's linked files
afterwards. Never move an already published tag; tags and GitHub releases are
our conventions, not Herdr's.

### Guardrails

- Nothing publishes, tags, or changes topics without explicit owner approval.
- Never claim a listing or visual check was verified unless it actually was.
- The repository root is the single candidate: keep it complete and
  installable at all times (tests enforce it).
- Licenses and third-party notices travel at the root and inside each mod
  folder so gallery-style copies keep them.

### Verification log

- 2026-11-12: Snapshot built from the rebased sources (includes the merged
  Ctrl+Enter commit submit and default ⌘S/Ctrl+S save). `just check` green —
  drift test, all 14 suites, and `herdr-app check` on the four assembled
  snapshot mods in an isolated home with pre-existing keys/layouts retained.
  `preview.png` is the owner-approved screenshot. Topic not added; no
  listing verified yet.
- 2026-11-12: Owner media sign-off — `preview.png`, the README screenshots
  and the demo video are approved for the v0.0.1 release.
- 2026-11-12: Owner accepted the recorded platform gaps for v0.0.1 — Windows
  and Linux hands-on coverage remains partial and tracked in
  [TESTING.md](./TESTING.md); macOS was fully exercised live in the
  `herdr-dev` profile.
- 2026-11-12: Publication executed with owner approval — topic
  `herdr-layout` added, tag `v0.0.1` and the GitHub release with the bundle
  attachment published.
- 2026-11-12: Discovery indexed BOTH layout-shaped folders as separate
  listings — the repository root (artwork preview; **broken** installs, no
  `_shared` copies) and the nested `gallery/herdr-mide/` snapshot (complete).
  Diagnosis: the crawler indexes repository roots — two repos pushed after
  ours were listed while ours was skipped past the documented hour. Owner
  decision: restructure so the root is the single complete package
  (AUTO-GENERATED `_shared` in-tree via
  `scripts/materialize-shared.sh`, LICENSE/notices per mod folder) and keep
  the artwork as the listing preview. `install.sh` verified live in the
  `herdr-dev` profile against the restructured root: fresh install, four
  checks green, layout loads with zero mod errors in an isolated core
  session, no-clobber re-run leaves keys and existing files untouched. The
  stale nested listing is expected to drop on re-crawl; fallback is Herdr's
  per-listing report link.

Create the approved `v0.0.1` tag and GitHub release separately, referencing
the matching source commit and attaching the reviewed assembled bundle if
desired. Users should back up and review existing customizations before a
manual update; this project has no automatic migration or updater. Publish,
topic changes, tags and releases all require explicit owner approval.
