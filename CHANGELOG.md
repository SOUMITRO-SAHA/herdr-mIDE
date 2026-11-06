# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- **Icons now come entirely from Material Icon Theme (MIT)** — 523 file-type icons — exactly the set the map references, pruned of everything unused — replace the previous 169-icon set, and the association map is generated from the theme's own mapping (1332 suffixes + 1084 names, roughly four times the previous coverage). `scripts/update-icons.sh` is the one regeneration entry point. Folder glyphs and chevrons are unchanged.

### Fixed
- Files panel: macOS `.DS_Store` files no longer appear in the tree (filtered in both the `sh` and PowerShell listings; other dotfiles still show).
- Files panel: a file's *name prefix* no longer outranks its *type* in icon matching — `Dockerfile.rs` used to show the Docker glyph; the Rust type now wins, while `Dockerfile.prod` still reads as a Dockerfile.

### Changed
- File-icon matching resolves like a full IDE: exact file name first (`package.json`, `docker-compose.yml`, `CMakeLists.txt`…), then the longest dotted suffix (`foo.d.ts` tries `d.ts` before `ts`), then name prefixes — and lockfiles (`Cargo.lock`, `poetry.lock`…) now get the lock glyph. Tree icons render at 16px, level with the row text.
- Folder glyphs follow the theme instead of a fixed yellow: muted like the rest of the chrome, taking the change color of their contents — orange for modifications, red for deletions and conflicts, green for new files (the most severe change wins for mixed folders) — so where work happened reads at a glance. They are solid fills now, taken from the Material Icon Theme set (MIT, closed and open pair), so the shape reads instantly at 16px; chevrons stay the previous glyph set.
- File names render calm: muted against the foreground instead of full-bright, and git-ignored paths (dependencies, build output, local secrets) go one step deeper so they stop shouting; changed names keep their orange/red/green. The night theme ships tuned `muted` and `dim` values for the hierarchy.

### Added
- Folders in the tree now switch between closed and open glyphs on expand/collapse (the previous glyph set folder pair, tree-tinted like before).
- Root `assets/` folder as the canonical home for icons (`icons/material/`, `icons/tree/`); `make assets` materializes them into the mod, and `make dev`/`make sync` do it automatically, so mods stay self-contained while assets are managed in one place.
- Root `Makefile` as the one entry point: `make dev` (live sync into the app home with Herdr hot-reloading every landed file), `make sync`, `make check`, `make install`, `make status`, `make shot` and `make switch`.
- Script logic standardized under `scripts/` (`dev.sh`, `sync.sh`, shared `common.sh` for paths and sync rules); only `install.sh` remains at the root as the first-time installer.
- OpenCode slash commands for working in this repo: `/changelog` keeps a release-ready `CHANGELOG.md` (refresh `Unreleased` from commits, or promote it to a versioned release), `/commit` standardizes commit messages, `/learn` captures non-obvious codebase insights into `AGENTS.md` files, and `/rmslop` strips AI-generated slop from a branch before review.
