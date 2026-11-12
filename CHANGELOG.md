# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- An issue-first contribution flow in CONTRIBUTING.md: every PR needs a tracked issue claimed before work starts (`/claim`), claimants get merge priority, claimed issues are off-limits to others (ask for owner, status and ETA in a comment instead), branches follow `<type>/<issue-number>-<slug>` and commits `type(scope): summary`; a PR-template checklist and a merge gate formalize verification before merging.
- Code formatting via Prettier run through Bun (`just fmt`, `just fmt-check`, config tuned to the existing house style). The compact `mods/mide-files/icons.js` association map and the vendored `.agents/` reference checkouts are exempt by design.
- A `Checks` workflow that runs `just fmt-check` and `just test` on every pull request and push to `main`; the Windows end-to-end workflow installs Bun for the Bun-driven recipes.
- TESTING.md documents provisioning cwRsync and its Git Bash path-adapter shim (`scripts/rsync-path-adapter.sh`) for Windows machines, where rsync must be provided separately.
- A dispatch-only GitHub Actions workflow that repeats the Windows workflow on a disposable hosted VM: it provisions rsync and the path adapter, installs the released Herdr app, runs `just test` and `just check`, prepares the isolated smoke fixture, launches the app in the isolated app home, and captures the command-driven scenes.

### Removed

- The root Makefile. The `justfile` is the single entry point (`just dev`, `sync`, `test`, `check`, `install`, `status`, `shot`, `switch`, `bundle`, `smoke-prepare`, `smoke-capture`), and smoke preparation builds its bundle by driving `scripts/bundle.sh` through the POSIX shell (Git Bash on Windows) instead of spawning GNU Make.
- A cross-platform testing guide and isolated smoke preparation/capture helpers for user-started Herdr test windows.
- Windows testing guidance: provisioning GNU Make and cwRsync (with a Git Bash path-adapter note for its Cygwin rsync), the real-symlink requirement (`MSYS=winsymlinks:nativestrict` with Developer Mode), and Herdr's machine-wide single-instance behavior on Windows, which blocks a second isolated smoke window while one is already open.
- A single version for the layout and four cooperating mods, and a reproducible self-contained bundle for release and gallery preparation.
- A release checklist covering a privacy-reviewed preview, compatibility testing and Herdr Gallery discovery.
- Screenshots of the file tree, editor, diffs and Git workflows, including a real layout preview for the release bundle.

### Changed

- The test and smoke recipes run through Bun instead of Node.js (`bun install` once replaces any Node setup), and the whole tree is normalized once to the Prettier style — formatting only, no behavior change; `just test` and `just check` stay green. `tests/test-diff-assets.mjs` now matches its source-snippet assertions across line breaks so formatting cannot break it.
- The rebuild recipe now documents the complete layout bundle, current Git actions, dependencies and limitations.
- Opening files from the Files panel now reuses the editor pane; the first editor opens below an existing Diff pane, or to the right of the matching terminal, and modified drafts remain available when switching files.
- mIDE panel UI typography now follows Herdr's active interface font and size; editor and diff content follows its active terminal font and size.
- The editor Settings menu now includes persistent Word wrap and a Markdown Preview-by-default option, off by default so Markdown files open in Raw mode.
- Markdown Preview uses Herdr's active interface font family and editor font size, with more generous line spacing and a centered reading column; the renderer retains its built-in heading and inline emphasis hierarchy.
- The editor header now shows just the file name and unsaved indicator; saving is available in the footer or via the optional ⌘S binding.
- Removed the palette, theme-test and icon-generation scripts; the existing mod palettes, icons and associations remain bundled and can be maintained directly.
- Editor syntax and Git status/diff colors use Ayu Dark — syntax colors are owned once in `shared/syntax.js` and shared by the editor and Diff; mIDE controls, focus colors and panel backgrounds follow Herdr's active theme. Switching the layout leaves host and CLI theme settings untouched.
- The project is now licensed under Apache-2.0 (was MIT), matching the Herdr app it extends.
- Generic UI glyphs — the tree chevrons — are now sourced from Herdr's own shipped mods (Apache-2.0, credited in THIRD-PARTY-NOTICES.md); the previous external glyph source is retired from the notices. File-type and folder icons remain Material Icon Theme (MIT), the only source for those.
- The Changes panel now follows the reference Git-panel layout: Changes/History tabs, tracked/untracked groups with tri-state staging checkboxes, a Stage All/Unstage All split action, and a repository/branch footer. Commit defaults to staged changes, or tracked changes when nothing is staged.
- The separate root `assets/` icon tree is gone — `mods/mide-files/icons/` is the single home for every icon, since the mod has to be self-contained anyway. One place to edit, no copy step, and `make assets` is removed.
- **Icons now come entirely from Material Icon Theme (MIT)** — 62 file-type icons replace the previous 169-icon set — a researched minimal keep-list (the top-20 languages cross-referenced from TIOBE, the Stack Overflow 2025 survey and PYPL, plus universal files like git, yaml, json, docker and lockfiles, and famous formats like svg, zip, pdf, fonts, media, keys and certificates). The association map is adapted from the theme's own mapping filtered to that list (338 suffixes + 297 names); anything uncommon renders as the plain file glyph. Folder glyphs and chevrons are unchanged.

### Fixed

- The Files panel gives the repository's root docs their dedicated theme glyphs instead of a generic markdown page: `AGENTS.md` takes the agent mark, `CHANGELOG.md` the changelog clock, `CONTRIBUTING.md` the contributing clipboard and `ROADMAP.md` the roadmap glyph — exact upstream `fileNames` (v5.39.0), including the `.rst`/`.txt` variants and bare `changelog`/`contributing`. Docs with no upstream mapping (`RECIPE.md`, `RELEASING.md`, `TESTING.md`, `THIRD-PARTY-NOTICES.md`) keep the markdown glyph, now pinned by tests.
- The Files panel shows the Prettier glyph for the whole Prettier config family instead of only `.prettierignore`: `.prettierrc` and its suffixed variants (`.prettierrc.json`, `.prettierrc.yaml`, `.prettierrc.js`, …), the `.config/prettierrc` convention, and `prettier.config.js`/`.ts`/… files — enumerated from the theme's Cosmiconfig pattern, which the generated map skips. A bare `prettier.config` file keeps the generic settings gear.
- Files lists projects stored outside the home folder again, per platform: Herdr grants its fs API reads inside the home folder only (`read_roots([home()])` in the app's mods policy, on every platform), and the perf change that read local folders in-process surfaced that refusal as a panel error for any project on another volume or drive. Local listings still read in-process first; when Herdr refuses the path, the original platform dispatch returns unchanged — the encoded PowerShell payload on Windows (chosen directly by `window().platform`, without an `sh` probe: the argv transport mangles space- or quote-containing paths and stock Windows has no sh), `sh` on macOS and Linux — and remote machines keep their `sh`-then-PowerShell probe exactly as before.
- The Files panel shows dedicated glyphs for task-runner and release files the generated map missed: `justfile` (and `.justfile`) gets the theme's Just mark, and a bare `VERSION` file shares the settings gear the theme gives other version metadata such as `.tool-versions`; `install.sh` keeps the console glyph it already had.
- Editor saving works by keyboard on Windows and Linux: Herdr's key names are platform-literal (`cmd-s` matches only on macOS), so `keys.json` now offers `ctrl-s` and `ctrl-shift-e` beside the macOS bindings, and the footer hint shows the platform's modifier (⌘S on macOS, Ctrl+S elsewhere) instead of always ⌘S.
- Windows CRLF checkouts (`core.autocrlf=true`) no longer break shared-module materialization: a carriage return surviving in the last field of `shared-modules.list` silently stopped mods like Diff from receiving shared syntax. CR is now stripped when parsing the list, the editor test tolerates CRLF sources, and `.gitattributes` pins LF line endings so every OS checks out the tree the POSIX tooling expects.
- Files works on Windows: folder listings travel as a single PowerShell `-EncodedCommand` payload with the folder path embedded (Windows argv transport mangles space- or quote-containing arguments, and the runtime Buffer's base64 was itself rejected by PowerShell), and Git status marks — name colors, status letters, folder tints — now compare Git's forward-slash repository paths against the space folder consistently instead of missing every lookup on Windows. Local folder listings now read in-process through Herdr's fs API instead of spawning PowerShell — a listing spawn measured at seconds each on Windows, and listings for the root and expanded folders ran serially besides — so the tree appears immediately and stays live without spawn churn.
- Diff's Split view now highlights changed lines the same way Unified does: the split panes resolved syntax highlighting through their "left"/"right" names, but the per-file maps are keyed "old"/"new", so every split cell silently rendered as plain text.
- Failed Git actions in Changes — a branch switch blocked by uncommitted changes, a missing branch, an unmerged delete, a failed commit or remote action — now show one short readable line ("Uncommitted changes to .gitignore would be overwritten — commit or stash them first.") instead of git's raw multiline output, once at the action site and once as an error toast.
- Git error messages are constrained to their own rows in the open branch picker or the closed panel, preventing long messages from overlapping adjacent controls.
- Files uses Herdr's documented platform API to select PowerShell for local Windows folder listings.
- Diff uses a labeled Refresh control instead of depending on a private Herdr frame asset.
- Gallery-ready bundles carry the license and third-party notices inside each mod folder, so they accompany copied mods.
- The no-clobber installer no longer changes or checks a pre-existing mod folder, and reports a failed mod check instead of claiming success.
- Changes disables optional Git locks and filesystem monitoring for its repository lookup as well as its other refresh reads.
- Changes keeps newly added files in the Untracked section when staged or unstaged, and refreshes their status after overlapping Git operations.
- Staging or unstaging an individual file no longer opens a Diff pane from the checkbox; clicking the file row remains the explicit review action.
- The commit message box uses Herdr's regular background for a subtler contrast against the Changes panel than the raised surface.
- Files panel labels now use regular weight and the host theme's muted and ignored colors; ignored folders themselves are correctly dimmed, and mixed Git statuses use the reference IDE's conflict/deletion/modification/addition precedence.
- Git status colors use Ayu's modified, deleted and added colors consistently across Files, Changes and Diff.
- Editor: a visible Save button writes files even when the optional ⌘S key binding has not been installed. The unsaved dot uses the app accent, and the footer briefly confirms a successful save before showing the shortcut again. Edits made during a save remain marked unsaved, and drafts retain the correct disk baseline when switching files. Saves carry the loaded baseline so external edits are caught, with a `Reload (discard draft)` action on failure; oversized files refuse to save instead of silently truncating. The `mide-editor.save` command handles both plain strings and named command objects.
- Files panel: macOS `.DS_Store` files no longer appear in the tree (filtered in both the `sh` and PowerShell listings; other dotfiles still show).
- Files panel: a file's _name prefix_ no longer outranks its _type_ in icon matching — `Dockerfile.rs` used to show the Docker glyph; the Rust type now wins, while `Dockerfile.prod` still reads as a Dockerfile.

### Changed

- File-icon matching resolves like a full IDE: exact file name first (`package.json`, `docker-compose.yml`, `CMakeLists.txt`…), then the longest dotted suffix (`foo.d.ts` tries `d.ts` before `ts`), then name prefixes — and lockfiles (`Cargo.lock`, `poetry.lock`…) now get the lock glyph. Tree icons render at 16px, level with the row text.
- Folder status colorization now works the way the reference IDE does it: the color of the most severe change underneath paints the folder's glyph **and its title**, propagating up every ancestor folder, so the path to a changed file lights up as a whole. The colors use the private Ayu Git status tokens.
- File names render calm: muted against the foreground instead of full-bright, and git-ignored paths (dependencies, build output, local secrets) go one step deeper so they stop shouting; changed names keep their orange/red/green.

### Added

- **Syntax-highlighted diffs.** Diff rows use mIDE's shared lightweight tokenizer and palette on both old and new sides, in Split and Unified views; files highlight in small batches under per-file and total character budgets, so large diffs stay responsive and binary or unsupported files fall back to plain text.
- Shared mod logic now lives once under `shared/`, with `shared-modules.list` naming each consuming mod; sync, install and `make check` materialize every `_shared/` copy (never kept in `mods/`), and `make test` runs source tests for the shared helpers, the palette boundary and the file-icon mappings.
- **Ayu Dark for mIDE**: the MIT-licensed palette covers editor syntax and Git change colors without changing Herdr's theme.
- **A dedicated Git Diff tab.** Clicking a file in Changes opens `Diff · <file>` instead of squeezing the diff into the panel: file header with status and +/− stats, old/new line-number gutters, tinted additions and deletions, dim `···` excerpt bands, side-by-side Split view (default) with a Unified toggle, hunk navigation (`⌘F8` / `⇧⌘F8`), and staged/unstaged sides in one tab. Untracked files render as a full-file addition. The Changes panel keeps staging, Stage All, Fetch, branches and the commit composer, and now uses its full height for the file list.
- Folders in the tree now switch between closed and open glyphs on expand/collapse (both glyphs follow the tree tint).
- More Material file-type icons and associations: `.nix` files (like `flake.nix`) show the Nix snowflake, `.prettierignore` the Prettier glyph, PowerShell scripts (`.ps1`, `.psm1`, `.psd1`…) the PowerShell glyph, plain `.txt` files the document glyph (`readme.txt` and `LICENSE.txt` keep their special glyphs), and list manifests (`shared-modules.list`, `sources.list`) and systemd unit files (`*.service`) the gear glyph like other configuration. The whole `.env.*` family gets the environment glyph through a new prefix rule, so unenumerated combinations (`.env.vault`, `.env.staging.local.example`…) resolve too; the dot-less `env` convention gets the same glyph, and `sudoers` reads as a credentials file. `.gitleaksignore` reads as git like the rest of the `.gitignore` family, and bare `install` scripts get the same bash glyph as `.sh` instead of the anonymous plain-file icon. Test files get their proper glyphs too — `*.test.ts` / `*.spec.ts` (and the tsx/jsx/js, `e2e-spec` and `.snap` variants) now show the Material test flasks instead of passing for regular source files.
- Root `Makefile` as the one entry point: `make dev` (live sync into the app home with Herdr hot-reloading every landed file), `make sync`, `make check`, `make install`, `make status`, `make shot` and `make switch`.
- Script logic standardized under `scripts/` (`dev.sh`, `sync.sh`, shared `common.sh` for paths and sync rules); only `install.sh` remains at the root as the first-time installer.
- OpenCode slash commands for working in this repo: `/changelog` keeps a release-ready `CHANGELOG.md` (refresh `Unreleased` from commits, or promote it to a versioned release), `/commit` standardizes commit messages, `/learn` captures non-obvious codebase insights into `AGENTS.md` files, and `/rmslop` strips AI-generated slop from a branch before review.
