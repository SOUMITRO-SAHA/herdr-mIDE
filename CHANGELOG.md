# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- The Changes panel now groups files by staging state, offers per-file Stage/Unstage actions plus Stage All/Unstage All, and keeps the current branch visible in its footer selector.
- The separate root `assets/` icon tree is gone — `mods/mide-files/icons/` is the single home for every icon, since the mod has to be self-contained anyway. One place to edit, no copy step, and `make assets` is removed; `scripts/update-icons.sh` regenerates the file-type set in place.
- **Icons now come entirely from Material Icon Theme (MIT)** — 62 file-type icons replace the previous 169-icon set — a researched minimal keep-list (the top-20 languages cross-referenced from TIOBE, the Stack Overflow 2025 survey and PYPL, plus universal files like git, yaml, json, docker and lockfiles, and famous formats like svg, zip, pdf, fonts, media, keys and certificates). The association map is generated from the theme's own mapping filtered to that list (338 suffixes + 297 names); anything uncommon renders as the plain file glyph, and the generator prunes everything outside the list. `scripts/update-icons.sh` is the one regeneration entry point. Folder glyphs and chevrons are unchanged.

### Fixed
- Files panel: macOS `.DS_Store` files no longer appear in the tree (filtered in both the `sh` and PowerShell listings; other dotfiles still show).
- Files panel: a file's *name prefix* no longer outranks its *type* in icon matching — `Dockerfile.rs` used to show the Docker glyph; the Rust type now wins, while `Dockerfile.prod` still reads as a Dockerfile.

### Changed
- File-icon matching resolves like a full IDE: exact file name first (`package.json`, `docker-compose.yml`, `CMakeLists.txt`…), then the longest dotted suffix (`foo.d.ts` tries `d.ts` before `ts`), then name prefixes — and lockfiles (`Cargo.lock`, `poetry.lock`…) now get the lock glyph. Tree icons render at 16px, level with the row text.
- Folder status colorization now works the way the reference IDE does it: the color of the most severe change underneath (conflict/deleted red, modified orange, new green) paints the folder's glyph **and its title**, propagating up every ancestor folder, so the path to a changed file lights up as a whole. The colors use dedicated Herdr theme tokens when available, with ANSI fallbacks for other themes.
- File names render calm: muted against the foreground instead of full-bright, and git-ignored paths (dependencies, build output, local secrets) go one step deeper so they stop shouting; changed names keep their orange/red/green.

### Added
- **The editor palette is theme-driven with One Dark fallbacks**: themes define `syntax_*` tokens (keyword, string, comment, function, type, number, constant, boolean, variable, operator, punctuation + markdown heading/code-span/bold/italic/link names) and the editor follows them; themes without the tokens get the built-in One Dark set. The shipped mide-night theme defines the full list, so markdown headings, inline code, bold and links are finally colored in the editor pane.
- **A dedicated Git Diff tab.** Clicking a file in Changes opens `Diff · <file>` instead of squeezing the diff into the panel: file header with status and +/− stats, old/new line-number gutters, tinted additions and deletions, dim `···` excerpt bands, side-by-side Split view (default) with a Unified toggle, hunk navigation (`⌘F8` / `⇧⌘F8`), and staged/unstaged sides in one tab. Untracked files render as a full-file addition. The Changes panel keeps staging, Stage All, Fetch, branches and the commit composer, and now uses its full height for the file list.
- Folders in the tree now switch between closed and open glyphs on expand/collapse (the previous glyph set folder pair, tree-tinted like before).
- Root `Makefile` as the one entry point: `make dev` (live sync into the app home with Herdr hot-reloading every landed file), `make sync`, `make check`, `make install`, `make status`, `make shot` and `make switch`.
- Script logic standardized under `scripts/` (`dev.sh`, `sync.sh`, shared `common.sh` for paths and sync rules); only `install.sh` remains at the root as the first-time installer.
- OpenCode slash commands for working in this repo: `/changelog` keeps a release-ready `CHANGELOG.md` (refresh `Unreleased` from commits, or promote it to a versioned release), `/commit` standardizes commit messages, `/learn` captures non-obvious codebase insights into `AGENTS.md` files, and `/rmslop` strips AI-generated slop from a branch before review.
