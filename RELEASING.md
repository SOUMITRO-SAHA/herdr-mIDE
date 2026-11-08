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
2. Run `make test` and `make check`. Check uses the installed app to render
   initial mod states; additionally test the layout, editor saves/conflicts,
   tree, diff, staging, commits and branches in an isolated app home and a
   disposable Git repository. Test remote actions only with a disposable
   remote. Record app version, OS and results. Never restart another person's
   app or core.
3. The real `preview.png` is a copy of `public/editor-markdown-raw.png`;
   other feature screenshots live in `public/`. Before publication, confirm
   that these screenshots still represent the released code and review each
   for names, paths, credentials, terminal output and other private content.
   The existing screenshots show a development workspace, so inclusion in the
   repo is not a substitute for the owner's final privacy review.
4. Run `make bundle`. This creates `dist/herdr-mide/` from the source layout,
   all four mods, keys, recipe, preview, license, notices and `VERSION`.
   It materializes shared files inside the two consuming mod copies. It
   refuses an existing destination; choose another with
   `make bundle BUNDLE_DIR=dist/herdr-mide-candidate` rather than overwriting
   unreviewed work. The builder checks that a preview file exists, not its
   quality or privacy. `dist/` is ignored and is not itself published.
5. Inspect the assembled contents, licenses and references. Run `herdr-app
   check` on each **assembled** `mods/<name>` and exercise a clean install
   from the assembled files in an isolated home. Check name collisions and
   key conflicts; never replace existing user files silently. The source
   `install.sh` is a no-clobber first install, not an upgrade mechanism;
   `make sync` is a destructive development sync for mIDE-owned installed
   paths and is not a safe general-purpose upgrade. A failed installation
   may leave partial copies; inspect them before retrying, since a retry skips
   existing names.

## Gallery submission, only after approval

The [Gallery](https://herdr.dev/gallery/?type=mods) says a standalone mod
listing contains `mods/<name>/`, a recipe, preview and optional keys snippet,
**without** a `layouts/` folder. Its layout listing contains a layout and all
its needed mods. Since mIDE ships a layout and four dependent mods, publish it
as **one `herdr-layout` entry**, not four supposedly standalone `herdr-mod`
entries. The separate Herdr TUI plugin marketplace is not this app's mod
gallery; do not add a TUI plugin manifest for this package.

After the owner approves publication, place the reviewed assembled bundle in
a public GitHub repository/folder, with `layouts/`, `mods/`, `RECIPE.md` and
`preview.png` together, and add the GitHub topic `herdr-layout`. Herdr says
discovery takes up to an hour and community images are screened. A generated
bundle in ignored `dist/`, or only as a GitHub Release attachment, is not a
public repository folder for discovery. The development repository root is
also not directly copyable because it intentionally omits the shared mod
copies; do not add the topic to that incomplete root and assume it is safe.
Choose a public location for the complete snapshot, then verify the actual
listing and its linked files after publication. The gallery's exact handling of
multiple nested candidates and updates is not specified here; verify it rather
than claiming a particular path or automatic update behavior.

Create the approved `v0.0.1` tag and GitHub release separately, referencing
the matching source commit and attaching the reviewed assembled bundle if
desired. Users should back up and review existing customizations before a
manual update; this project has no automatic migration or updater. Publish,
topic changes, tags and releases all require explicit owner approval.
