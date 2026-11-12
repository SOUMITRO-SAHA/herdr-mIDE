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
4. Run `just bundle`. This creates `dist/herdr-mide/` from the source layout,
   all four mods, keys, recipe, preview, license, notices and `VERSION`.
   It materializes shared files inside the two consuming mod copies and puts
   license and notice copies in each mod folder for gallery-style installs. It
   refuses an existing destination; choose another with
   `just bundle dist/herdr-mide-candidate` rather than overwriting
   unreviewed work. The builder checks that a preview file exists, not its
   quality or privacy. To select a different reviewed screenshot for the
   bundle without replacing the README artwork, set `PREVIEW=/path/to/image.png`.
   `dist/` is ignored and is not itself published. The checked-in
   `gallery/herdr-mide/` snapshot uses `public/examples/files-git-status.png`;
   `just test` builds a fresh comparison and fails if the snapshot drifts.
   To update it, assemble a new bundle in a new staging directory with that
   preview, review the differences, then replace only the reviewed snapshot
   as part of the same change. Never overwrite an unreviewed destination.
5. Inspect the assembled contents, licenses and references. Run `herdr-app
check` on each **assembled** `mods/<name>` and exercise a clean install
   from the assembled files in an isolated home. Check name collisions and
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

| Herdr requires                                                                                                   | Our artifact                                                                                                                                                                  | Status                        |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| A public GitHub repository                                                                                       | `SOUMITRO-SAHA/herdr-mIDE` (public)                                                                                                                                           | done                          |
| One folder laid out like a Herdr home                                                                            | `gallery/herdr-mide/`: `layouts/herdr-mide.json`, `mods/{mide-files,mide-changes,mide-diff,mide-editor}/`                                                                     | done                          |
| Complete mod folders                                                                                             | The snapshot carries the materialized `_shared/syntax.js` for Editor and Diff — the development tree does not, which is why the snapshot, not the repo root, is the candidate | done                          |
| `RECIPE.md`, structured (name + intro + preview; What you see; How it behaves; Built from; Watch out; Done when) | `gallery/herdr-mide/RECIPE.md`, all six sections, cross-checked against the files by `just test`                                                                              | done                          |
| A reviewed screenshot named `preview.png`                                                                        | The owner-approved `public/examples/files-git-status.png` (1920×1080), committed as the snapshot's `preview.png`                                                              | done                          |
| Optional `keys.json` the installer can merge                                                                     | `gallery/herdr-mide/keys.json` (`cmd/ctrl-shift-e`, `cmd/ctrl-s`), documented as merge-don't-replace                                                                          | done                          |
| The repo topic `herdr-layout`                                                                                    | Not added — publication act, owner approval required                                                                                                                          | pending approval              |
| Listing appears within an hour; verify it                                                                        | Not applicable until the topic is added                                                                                                                                       | pending publication           |
| One build of the recipe                                                                                          | `tests/test-bundle.sh` rebuilds a bundle and fails if the snapshot drifts from the sources                                                                                    | done, enforced by `just test` |

Known ambiguity, handled by verification rather than assumption: this
repository's root also looks layout-shaped but is **not** a complete package
(no `_shared/` copies). Herdr documents neither which candidate its discovery
prefers nor update behavior, so after the topic is added we must verify the
actual listing and its linked files (step 4 below) and remediate if the wrong
one was listed.

### Before a publication PR

Local, no approval needed; all gates must be green:

1. `just fmt-check` and `just check` — CI runs the same. `just check`'s
   bundle test rebuilds the package and fails on drift, so the snapshot is
   always one build of the recipe.
2. `herdr-app check` each of the four **assembled** snapshot mods in a fresh
   isolated home (`HERDR_APP_HOME` at a scratch directory), with pre-existing
   test keys and layouts retained untouched — the no-clobber behavior Herdr's
   installer flow relies on.
3. `gallery/herdr-mide/preview.png` reviewed by the owner; no private
   content.
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
   preview, recipe link and file listing point at `gallery/herdr-mide/`
   content (layouts, all four mods with `_shared/`, keys.json) — not at the
   incomplete repository root. Open the listed files and check.
5. Record the listing URL, date, and what was checked in the verification
   log. If the wrong candidate was listed, remove the topic, restructure
   (e.g. move the package to the repository root as the single complete
   candidate), and repeat steps 2–4 with the owner's approval.

### Updating a published listing

Herdr documents no mod-version manifest or automatic update flow; treat the
listing as reflecting the repository content. To update: bump `VERSION` per
" What is versioned" above, regenerate the snapshot (`PREVIEW=... just
bundle` into a fresh staging directory, review, then replace
`gallery/herdr-mide/`), let `just test` prove no drift, merge, and re-verify
the listing's linked files afterwards. Never move an already published tag;
tags and GitHub releases are our conventions, not Herdr's.

### Guardrails

- Nothing publishes, tags, or changes topics without explicit owner approval.
- Never claim a listing or visual check was verified unless it actually was.
- The gallery candidate is the snapshot folder only; do not add the topic
  while the root could be mistaken for the package.
- Licenses and third-party notices travel inside the snapshot (root and each
  mod folder) so gallery-style copies keep them.

### Verification log

- 2026-11-12: Snapshot built from the rebased sources (includes the merged
  Ctrl+Enter commit submit and default ⌘S/Ctrl+S save). `just check` green —
  drift test, all 14 suites, and `herdr-app check` on the four assembled
  snapshot mods in an isolated home with pre-existing keys/layouts retained.
  `preview.png` is the owner-approved screenshot. Topic not added; no
  listing verified yet.

Create the approved `v0.0.1` tag and GitHub release separately, referencing
the matching source commit and attaching the reviewed assembled bundle if
desired. Users should back up and review existing customizations before a
manual update; this project has no automatic migration or updater. Publish,
topic changes, tags and releases all require explicit owner approval.
