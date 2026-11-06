# herdr-mIDE — Roadmap

> A minimal IDE for the age of AI-assisted coding. Built around one loop: **review → nudge → ship**.

Grounded in a study of `herdr-app` 0.1.13 (the Rust/GPUI app whose whole UI is
files: JSON layouts + JS mods, hot-reloaded) and `herdr-sim` (the reference
community package: `mods/` + `layouts/` + `keys.json` + `RECIPE.md`).
herdr-mIDE ships as that kind of package; every phase below is verified
against the real mod API (`herdr.d.ts`, `gpui-kit.d.ts`).

**Feasibility from the study:**

| Intended feature | Verdict | Grounding |
| --- | --- | --- |
| File viewer with type icons | ✅ | `svg()` tints per glyph; `exec` + `watchFolder` drive the tree |
| Git status colors in the tree | ✅ | `git status --porcelain=v1` per path, colored names (done in v0) |
| Detailed diff view | ✅ | `git diff [--cached]` on a virtual list (done in v0) |
| Better staging & commit flow | ✅ | per-file `git add` / `restore --staged`, commit-staged-only (done in v0) |
| Branch switching | ✅ | `git switch` / `switch -c` / `branch -d` (done in v0) |
| Theme updation | ✅ | `themes()` + `app.theme` + `themes/*.json` (done in v0) |
| Vim editing | ⚠️ | `EditorState` has **no cursor/selection API** (only `value()`/`set_value()`) — needs a custom editor core (Phase 1) |

---

## Phase 0 — Foundation ✅ (done)

- [x] Decide stack: a Herdr layout + mod package (herdr-sim distribution pattern)
- [x] Repo setup — install script, RECIPE.md, keys, example theme
- [x] Layout `herdr-mide`: Herdr's main with mIDE Files and Changes panels
- [x] `mide-files`: tree, type icons, git-status colors, open-in-editor
- [x] `mide-changes`: staged/unstaged groups, per-file staging, diff, commit, branches
- [x] `mide-editor`: pane with highlighting, ⌘S save, theme cycling
- [x] All mods pass `herdr-app check`

## Phase 1 — Editor core

> The "minimal IDE" part. Custom core, because the built-in editor exposes no cursor.

- [ ] **Buffer + cursor model** (`buffer.js`): lines, offsets, selections, undo
- [ ] **Renderer**: gpui-kit text rows on a virtual list, monospace grid, current-line highlight
- [ ] **Vim mode — normal**: motions `h j k l w b e 0 ^ $ gg G`, `x dd dw D C`, `p`, counts
- [ ] **Vim mode — insert**: `i a o I A O`, escape back
- [ ] **Vim mode — visual**: `v V`, motions extend, `d y`
- [ ] Registers and `.` repeat
- [ ] `:` command line: `:w :q :wq :e <file> :x`
- [ ] Leader key + remaps via a small config
- [ ] Syntax highlighting ported to the custom renderer (theme-driven, like today's `Editor`)
- [ ] Replace `EditorState` in `mide-editor` with the core; keep ⌘S and the mode chip showing real modes

## Phase 2 — File manager

- [ ] Fuzzy-find files by name ("go to file")
- [ ] **Filter by git status** — "show me only what the agent changed"
- [ ] New / rename / delete / reveal file actions (context row or menu)
- [ ] Respect `.gitignore` in listing (hide noise)
- [ ] More icons and a `NAMES`/`TYPES` override in shared state

## Phase 3 — Git panel

- [ ] **Hunk-level staging and discarding** (`git apply --cached` with selected hunks)
- [ ] Word-level diff highlighting within changed lines
- [ ] Side-by-side diff mode
- [ ] Commit history with per-commit file changes (`git log --stat`)
- [ ] Ahead/behind indicators and `pull`/`push`/`fetch` actions
- [ ] Draft commit message from the staged diff

## Phase 4 — The agent workflow

> Make herdr-mIDE the natural home for working *with* AI coding agents.

- [ ] "Review everything the agent changed" session: every diff in one pass, keep/discard as you go
- [ ] Commit message drafting from staged diffs
- [ ] Surface agents that touched files you are reviewing (`terminals()`, `agents()`)

## Phase 5 — Polish & hardening

- [ ] Performance on large repos and big diffs
- [ ] Keyboard-first everywhere (Vim motions beyond the editor: file tree, changes list)
- [ ] Remote machines: editor save and staging over `on` (needs upstream `writeTextFile` support)
- [ ] `preview.png` + listing on herdr.dev/layouts
- [ ] Docs & screenshots

---

## Non-goals

- **Heavyweight plugins / extension marketplaces** — config files over plugin systems
- **Built-in debugger, notebooks, remote dev** — use the right tool for those
- **AI code generation built-in** — herdr-mIDE is for *reviewing* agent output, not replacing agents
- **Feature parity with VS Code** — minimal is the point

## Suggesting roadmap changes

Open an issue or a discussion on the repo. The bar for new features is simple:

> Does this make the **review → nudge → ship** loop faster?
