> [!IMPORTANT]
> Remove this line to confirm you've reviewed this PR before submitting.

# herdr-mIDE

> The minimal IDE for [Herdr](https://herdr.dev) — built for the age of AI-assisted coding.

**herdr-mIDE** is a layout + mod package for the [Herdr app](https://herdr.dev): a better file manager, a better git panel, and a minimal editor — all living inside the same window as your terminals and coding agents.

Most of the coding work today is done by AI agents. What's left for us is the *last mile*: review what the agent changed, make small surgical edits, stage the right files, and ship. Existing IDEs are built for a world where you write all the code. **herdr-mIDE is built for the world where you don't.**

![herdr-mIDE](preview.png)

## What's inside

### 📁 Files — a file manager that tells you everything at a glance

- **File-type icons** — a curated Material Icon Theme set (MIT): full-color icons for common file types, plus open/closed folder states in the tree; unknown files fall back to the theme's plain file icon.
- **Git status baked into the tree** — the whole file name is colored: 🟠 modified, 🟢 new/untracked, 🔴 deleted or conflicted, plus a bold status letter.
- Lazy folders, `.git` and `.DS_Store` hidden, live refresh from the folder watch.
- **Click a file to edit it** — it opens in the editor pane beside your terminal.

### 🌿 Changes — a git panel for the review-and-commit loop

- **Tracked and Untracked groups** — each file has a tri-state staging checkbox; partially staged files stay visible as partially staged.
- **Stage All / Unstage All** — one split action stages every change or clears the index, with per-group selection too.
- **Detailed diff view** — line-numbered, tinted additions/deletions, smooth on big diffs.
- **Commit flow** — commits staged files when present; otherwise **Commit Tracked** stages tracked edits, excluding untracked files. The menu also lets you choose the scope explicitly.
- **Branch switcher** — switch, create, and delete branches without leaving the panel.

### ⌨️ Editor — a minimal editor pane

- Syntax highlighting, ⌘S save, unsaved indicator.
- Editor syntax, Git status colors and diff additions/deletions use Ayu Dark. Other UI colors—including focus, controls and backgrounds—follow Herdr's theme without changing the app or terminal theme.
- **Vim mode is on the roadmap** — Herdr's built-in editor exposes no cursor API, so modal editing arrives as a custom editor core (see [ROADMAP](./ROADMAP.md)).

## Install

You need the [Herdr app](https://herdr.dev) (0.1.13 or later) on macOS, Linux or Windows.

```sh
git clone https://github.com/SOUMITRO-SAHA/herdr-mIDE
cd herdr-mIDE
./install.sh
herdr-app do layout.switch --name herdr-mide
```

The installer copies the mods and layout into `~/.config/herdr-app` (never overwriting), prints the key bindings to merge into your `keys.json`, and runs `herdr-app check` on every mod. It does not install or switch a Herdr or CLI theme. `ctrl-shift-l` switches back to your old layout; deleting the files removes it.

Upgrading from a version that installed `ayu-dark.json` or selected it in the layout? `make sync` updates the installed mIDE mods and layout, but leaves existing theme files and settings untouched. The no-clobber installer does not update an existing installation. If Ayu was separately selected in Herdr settings or through its theme picker, select Graphite there yourself; mIDE will not change that choice. You may remove the old app-home `themes/ayu-dark.json` yourself if nothing else uses it.

Herdr's native editor and input controls resolve internal colors (including editor background, caret and selection) from the app theme; the current mod API only exposes syntax-color overrides. The native editor's background can therefore differ from Herdr's sidebar. Ayu is limited to editor syntax and Git change coloring; other UI colors follow Herdr.

Or ask your Herdr agent to add the layout at `github.com/SOUMITRO-SAHA/herdr-mIDE`.

## How it works

herdr-mIDE doesn't fork Herdr — it rides on it. The Herdr app redraws its whole interface from files (layouts are JSON trees, panels are small JavaScript mods with a GPU UI), and it hot-reloads them while it runs. That gives herdr-mIDE terminals, agents, themes, spaces and remote machines for free, and makes every file in this repo live-editable.

```
layouts/herdr-mide.json   the window: Herdr's main layout with mIDE panels
mods/mide-files/          file tree · type icons · git-status colors
mods/mide-changes/        staging · commit · branches
mods/mide-diff/           git diff tab · split/unified · hunk navigation
mods/mide-editor/         editor pane · save · shared mIDE syntax palette
themes/ayu-dark.json      Ayu reference palette (MIT; not installed as a host theme)
keys.json                 ⌘⇧E editor pane · ⌘S save
mods/mide-files/icons/    all icons: material/ (file types) · folder/chevron glyphs
Makefile                  the entry point: dev · sync · check · install · status · shot · switch
scripts/                  the logic behind the commands (shared common.sh)
install.sh                first-time installer (never overwrites)
```

All icons live in `mods/mide-files/icons/` — the single source of truth. File-type and folder icons come from Material Icon Theme (the only icon source).

[RECIPE.md](./RECIPE.md) documents the build for humans and agents (it's the brief Herdr's ecosystem uses to install and rebuild packages). [ROADMAP.md](./ROADMAP.md) has the plan and the grounding study.

## Development

Every command lives in the root `Makefile`:

```sh
make dev        # live loop: sync on every save, Herdr hot-reloads in place
make sync       # one-shot copy into ~/.config/herdr-app
make test       # source tests for shared helpers and palette boundaries
make check      # herdr-app check every mod (the runtime's own parser)
make install    # first-time install (never overwrites; prints keys to merge)
make status     # window state + errors from files and mods
make shot       # screenshot of the window → herdr-shot.png
make switch     # show the herdr-mide layout (ctrl-shift-l cycles back)
```

The typical loop: `make dev` in one terminal, edit in your editor — each save lands in the app home within a second and Herdr reloads the mod in place. A broken save keeps the last good version running and reports in `make status`; `make shot` is the fastest visual check. Both respect `HERDR_APP_HOME`, and `make dev INTERVAL=0.3` polls faster. If a bad layout or keys edit ever wedges the window, `ctrl-alt-shift-escape` is Herdr's built-in escape hatch back to the default `main` layout.

Scripts live in `scripts/` — `dev.sh` (the watch loop) and `sync.sh` (one-shot copy) share `common.sh`, which defines the app home, the sync rules and the mod list exactly once. New scripts belong there, called from the Makefile; only `install.sh` (the no-clobber installer) stays at the root beside it.

`shared/syntax.js` owns mIDE's single syntax palette and lightweight tokenizer; the editor and Diff consume it through generated mod-local copies. It uses the documented `EditorState` syntax option and tokenizes Diff lines locally, without depending on extra host APIs. Git status/diff UI colors remain mod-specific. `themes/ayu-dark.json` is a non-runtime Ayu reference and intentionally does not duplicate syntax colors.

## Status

🚧 **v0 — foundation.** The panels and editor work today (all mods pass `herdr-app check`); vim mode, hunk-level staging and the agent-review flow are next. See the [roadmap](./ROADMAP.md).

## License

[Apache-2.0](./LICENSE) © 2026 SOUMITRO-SAHA — with these third-party pieces, each under its own license (see [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md)): file and folder icons from Material Icon Theme (MIT), and code parts plus the chevron glyphs adapted from Herdr's shipped `files` and `changes` mods (Apache-2.0).
