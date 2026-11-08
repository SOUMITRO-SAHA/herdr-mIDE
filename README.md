# herdr-mIDE

> The minimal IDE for [Herdr](https://herdr.dev) — built for the age of AI-assisted coding.

**herdr-mIDE** is a layout + mod package for the [Herdr app](https://herdr.dev): a better file manager, a better git panel, and a minimal editor — all living inside the same window as your terminals and coding agents.

Most of the coding work today is done by AI agents. What's left for us is the *last mile*: review what the agent changed, make small surgical edits, stage the right files, and ship. Existing IDEs are built for a world where you write all the code. **herdr-mIDE is built for the world where you don't.**

> A public preview is pending; the release bundle is blocked until a reviewed
> screenshot is available.

## What's inside

### 📁 Files — a file manager that tells you everything at a glance

- **File-type icons** — a curated Material Icon Theme set (MIT): full-color icons for common file types, plus open/closed folder states in the tree; unknown files fall back to the theme's plain file icon.
- **Git status baked into the tree** — the whole file name is colored: 🟡 modified or conflicted, 🟢 new/untracked, 🔴 deleted, plus a bold status letter.
- Lazy folders, `.git` and `.DS_Store` hidden, live refresh from the folder watch.
- **Click a file to edit it** — it opens in the editor pane beside your terminal.

### 🌿 Changes — a git panel for the review-and-commit loop

- **Tracked and Untracked groups** — each file has a tri-state staging checkbox; partially staged files stay visible as partially staged.
- **Stage All / Unstage All** — one split action stages every change or clears the index, with per-group selection too.
- **Detailed diff view** — line-numbered, tinted additions/deletions, smooth on big diffs.
- **Commit flow** — commits staged files when present; otherwise **Commit Tracked** stages tracked edits, excluding untracked files. The menu also lets you choose the scope explicitly.
- **Branch switcher** — switch, create, and delete branches without leaving the panel.

### ⌨️ Editor — a minimal editor pane

- Syntax highlighting, a Save button, optional ⌘S shortcut, and an unsaved indicator.
- Editor syntax uses Ayu Dark; Git status colors use Zed One Dark values, and diff colors use the bundled palette. Other UI colors—including focus, controls and backgrounds—follow Herdr's theme without changing the app or terminal theme.
- **Vim mode is on the roadmap** — Herdr's built-in editor exposes no cursor API, so modal editing arrives as a custom editor core (see [ROADMAP](./ROADMAP.md)).

## Install

The layout is based on [Herdr app](https://herdr.dev) 0.1.13. The full
macOS, Linux and Windows compatibility matrix still needs release testing.
The source installer below needs a POSIX shell; Git is needed for Git features.
Mods run with your access: Files reads your workspace, Editor can write files,
and Changes runs Git, including network operations when requested. Review the
source and [Herdr's security guidance](https://github.com/herdrdev/herdr-app/blob/master/docs/security.md) before installing.

```sh
git clone https://github.com/SOUMITRO-SAHA/herdr-mIDE
cd herdr-mIDE
./install.sh
herdr-app do layout.switch --name herdr-mide
```

The installer copies the mods and layout into `~/.config/herdr-app` (or `HERDR_APP_HOME`), skipping existing names without modifying them, prints the key bindings to merge into your `keys.json`, and runs `herdr-app check` on newly installed mods. Skipped existing folders are not checked and may belong to another version: review conflicts before continuing. It does not install or switch a Herdr or CLI theme. `ctrl-shift-l` cycles layouts; deleting the installed files removes this bundle.

If a copy or check fails, installation may be partial; inspect the reported
files before retrying. A retry skips existing names rather than repairing them.

Use **Save** in the editor to write changes to disk. The footer briefly shows **Saved** after the current contents are written, and the unsaved dot disappears. To also use ⌘S, merge the printed `mod:mide-editor` binding into your Herdr `keys.json`; the installer does not change your existing keys.

The no-clobber installer is not an upgrade tool. `make sync` is for development: it overwrites the installed mIDE layout and replaces mod-folder contents, including local edits, while leaving theme files and settings alone. Back up and review existing customizations before a manual upgrade.

Herdr's native editor and input controls resolve internal colors (including editor background, caret and selection) from the app theme; the current mod API only exposes syntax-color overrides. The native editor's background can therefore differ from Herdr's sidebar. Ayu applies to syntax, while Git colors use the bundled palette; other UI colors follow Herdr.

Do not copy the source `mods/` folders directly: Editor and Diff need generated
shared files. Use the installer above or a complete, separately assembled
release bundle. Gallery publication has not yet happened.

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
Makefile                  the entry point: dev · sync · test · check · install · status · shot · switch · bundle
VERSION                   version of the complete layout + four-mod bundle
scripts/                  the logic behind the commands (shared common.sh)
install.sh                first-time installer (never overwrites)
```

All icons live in `mods/mide-files/icons/` — the single source of truth. File-type and folder icons come from Material Icon Theme (the only icon source).

[RECIPE.md](./RECIPE.md) documents the build for humans and agents (it's the brief Herdr's ecosystem uses to install and rebuild packages). [RELEASING.md](./RELEASING.md) explains versioning, bundle assembly and gallery publication; [ROADMAP.md](./ROADMAP.md) has the plan and the grounding study.

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
make bundle     # build a copyable layout bundle; needs a reviewed preview.png
```

The typical loop: `make dev` in one terminal, edit in your editor — each save lands in the app home within a second and Herdr reloads the mod in place. A broken save keeps the last good version running and reports in `make status`; `make shot` is the fastest visual check. Both respect `HERDR_APP_HOME`, and `make dev INTERVAL=0.3` polls faster. If a bad layout or keys edit ever wedges the window, `ctrl-alt-shift-escape` is Herdr's built-in escape hatch back to the default `main` layout.

Scripts live in `scripts/` — `dev.sh` (the watch loop) and `sync.sh` (one-shot copy) share `common.sh`, which defines the app home, the sync rules and the mod list exactly once. New scripts belong there, called from the Makefile; only `install.sh` (the no-clobber installer) stays at the root beside it.

`shared/syntax.js` owns mIDE's single syntax palette and lightweight tokenizer; the editor and Diff consume it through generated mod-local copies. It uses the documented `EditorState` syntax option and tokenizes Diff lines locally, without depending on extra host APIs. Git status/diff UI colors remain mod-specific. `themes/ayu-dark.json` is a non-runtime Ayu reference and intentionally does not duplicate syntax colors.

## Status

🚧 **v0.0.1 in preparation.** The bundle has not been released or submitted to the gallery. `herdr-app check` covers initial mod rendering, not the complete interaction or platform matrix. Vim mode, hunk-level staging and the agent-review flow are future work. See the [roadmap](./ROADMAP.md).

## License

[Apache-2.0](./LICENSE) © 2026 SOUMITRO-SAHA — with third-party icons, palettes and adapted code under their own licenses; see [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).
