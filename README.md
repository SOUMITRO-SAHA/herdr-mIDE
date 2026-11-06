> [!IMPORTANT]
> Remove this line to confirm you've reviewed this PR before submitting.

# herdr-mIDE

> The minimal IDE for [Herdr](https://herdr.dev) — built for the age of AI-assisted coding.

**herdr-mIDE** is a layout + mod package for the [Herdr app](https://herdr.dev): a better file manager, a better git panel, and a minimal editor — all living inside the same window as your terminals and coding agents.

Most of the coding work today is done by AI agents. What's left for us is the *last mile*: review what the agent changed, make small surgical edits, stage the right files, and ship. Existing IDEs are built for a world where you write all the code. **herdr-mIDE is built for the world where you don't.**

![herdr-mIDE](preview.png)

## What's inside

### 📁 Files — a file manager that tells you everything at a glance

- **File-type icons** — the Material Icon Theme set (MIT): full-color icons for 1300+ file types, plus open/closed folder states in the tree; unknown files fall back to the theme's plain file icon. `scripts/update-icons.sh` regenerates everything from the MIT source set.
- **Git status baked into the tree** — the whole file name is colored: 🟠 modified, 🟢 new/untracked, 🔴 deleted or conflicted, plus a bold status letter.
- Lazy folders, `.git` and `.DS_Store` hidden, live refresh from the folder watch.
- **Click a file to edit it** — it opens in the editor pane beside your terminal.

### 🌿 Changes — a git panel for the review-and-commit loop

- **STAGED and CHANGES groups** — see exactly what a commit will contain.
- **Per-file staging** — `+` to stage, `−` to unstage, "stage all" for everything the agent touched.
- **Detailed diff view** — line-numbered, tinted additions/deletions, smooth on big diffs.
- **Guided commit flow** — commit is enabled only with a message *and* staged files; nothing is staged implicitly.
- **Branch switcher** — switch, create, and delete branches without leaving the panel.

### ⌨️ Editor — a minimal editor pane

- Syntax highlighting, ⌘S save, unsaved indicator.
- Uses Herdr's active theme and updates with Herdr's theme settings; syntax colors come from the theme's `syntax_*` tokens — the shipped [`themes/mide-night.json`](themes/mide-night.json) mimics the One Dark look.
- **Vim mode is on the roadmap** — Herdr's built-in editor exposes no cursor API, so modal editing arrives as a custom editor core (see [ROADMAP](./ROADMAP.md)).

## Install

You need the [Herdr app](https://herdr.dev) (0.1.13 or later) on macOS, Linux or Windows.

```sh
git clone https://github.com/SOUMITRO-SAHA/herdr-mIDE
cd herdr-mIDE
./install.sh
herdr-app do layout.switch --name herdr-mide
```

The installer copies the mods, layout and theme into `~/.config/herdr-app` (never overwriting), prints the key bindings to merge into your `keys.json`, and runs `herdr-app check` on every mod. `ctrl-shift-l` switches back to your old layout; deleting the files removes it.

Or ask your Herdr agent to add the layout at `github.com/SOUMITRO-SAHA/herdr-mIDE`.

## How it works

herdr-mIDE doesn't fork Herdr — it rides on it. The Herdr app redraws its whole interface from files (layouts are JSON trees, panels are small JavaScript mods with a GPU UI), and it hot-reloads them while it runs. That gives herdr-mIDE terminals, agents, themes, spaces and remote machines for free, and makes every file in this repo live-editable.

```
layouts/herdr-mide.json   the window: Herdr's main layout with mIDE panels
mods/mide-files/          file tree · type icons · git-status colors
mods/mide-changes/        staging · commit · branches
mods/mide-diff/           git diff tab · split/unified · hunk navigation
mods/mide-editor/         editor pane · save · One Dark-syntax colors
themes/mide-night.json    dark theme with syntax tokens (One Dark-style)
keys.json                 ⌘⇧E editor pane · ⌘S save
mods/mide-files/icons/    all icons: material/ (file types) · folder/chevron glyphs
Makefile                  the entry point: dev · sync · assets · check · install · status · shot · switch
scripts/                  the logic behind the commands (shared common.sh)
install.sh                first-time installer (never overwrites)
```

All icons live in `mods/mide-files/icons/` — the single source of truth. `scripts/update-icons.sh` regenerates the file-type set from Material Icon Theme (the only icon source).

[RECIPE.md](./RECIPE.md) documents the build for humans and agents (it's the brief Herdr's ecosystem uses to install and rebuild packages). [ROADMAP.md](./ROADMAP.md) has the plan and the grounding study.

## Development

Every command lives in the root `Makefile`:

```sh
make dev        # live loop: sync on every save, Herdr hot-reloads in place
make sync       # one-shot copy into ~/.config/herdr-app
make check      # herdr-app check every mod (the runtime's own parser)
make install    # first-time install (never overwrites; prints keys to merge)
make status     # window state + errors from files and mods
make shot       # screenshot of the window → herdr-shot.png
make switch     # show the herdr-mide layout (ctrl-shift-l cycles back)
```

The typical loop: `make dev` in one terminal, edit in your editor — each save lands in the app home within a second and Herdr reloads the mod in place. A broken save keeps the last good version running and reports in `make status`; `make shot` is the fastest visual check. Both respect `HERDR_APP_HOME`, and `make dev INTERVAL=0.3` polls faster. If a bad layout or keys edit ever wedges the window, `ctrl-alt-shift-escape` is Herdr's built-in escape hatch back to the default `main` layout.

Scripts live in `scripts/` — `dev.sh` (the watch loop) and `sync.sh` (one-shot copy) share `common.sh`, which defines the app home, the sync rules and the mod list exactly once. New scripts belong there, called from the Makefile; only `install.sh` (the no-clobber installer) stays at the root beside it.

## Status

🚧 **v0 — foundation.** The panels and editor work today (all mods pass `herdr-app check`); vim mode, hunk-level staging and the agent-review flow are next. See the [roadmap](./ROADMAP.md).

## License

[MIT](./LICENSE) © 2026 SOUMITRO-SAHA — with these third-party pieces, each under its own license (see [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md)): icons from Material Icon Theme (MIT), chevron glyphs from the previous glyph set (ISC), and parts adapted from Herdr's shipped `files` and `changes` mods (Apache-2.0).
