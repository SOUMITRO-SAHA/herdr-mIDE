# herdr-mIDE — Roadmap

> A minimal IDE for the age of AI-assisted coding. Built around one loop: **review → nudge → ship**.

Grounded in a study of `herdr-app` 0.1.13 (the Rust/GPUI app whose whole UI is
files: JSON layouts + JS mods, hot-reloaded) and `herdr-sim` (the reference
community package: `mods/` + `layouts/` + `keys.json` + `RECIPE.md`).
herdr-mIDE ships as that kind of package; every phase below is verified
against the real mod API (`herdr.d.ts`, `gpui-kit.d.ts`).

**Feasibility from the study:**

| Intended feature              | Verdict | Grounding                                                                                                           |
| ----------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| File viewer with type icons   | ✅      | `svg()` tints per glyph; `exec` + `watchFolder` drive the tree                                                      |
| Git status colors in the tree | ✅      | `git status --porcelain=v1` per path, colored names (done in v0)                                                    |
| Detailed diff view            | ✅      | `git diff [--cached]` on a virtual list (done in v0)                                                                |
| Better staging & commit flow  | ✅      | per-file `git add` / `restore --staged`, commit-staged-only (done in v0)                                            |
| Branch switching              | ✅      | `git switch` / `switch -c` / `branch -d` (done in v0)                                                               |
| Herdr theme integration       | ✅      | Panels and editor use the active Herdr theme                                                                        |
| Vim editing                   | ⚠️      | `EditorState` has **no cursor/selection API** (only `value()`/`set_value()`) — needs a custom editor core (Phase 1) |

---

## Release plan — the v0.0.x waves

The near-term roadmap ships as themed **milestones** on GitHub
([milestones](https://github.com/SOUMITRO-SAHA/herdr-mIDE/milestones)), each a
wave of claimable issues (comment `/claim` per
[CONTRIBUTING.md](./CONTRIBUTING.md)). The order is deliberate: foundation
issues first, items that build on them next, research-heavy items later —
nothing in a wave depends on a capability nobody has verified yet. The big
rock (Phase 1, the editor core) stays deliberately unscheduled until these
waves land.

| Milestone                                  | Theme                                       | Issues                                                                                                                       |
| ------------------------------------------ | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **v0.0.2** — a file manager you can act on | The tree stops being read-only              | #32 context menu · #45 restore file · #44 new file/folder · #41 hide git-ignored · #40 go-to-file · #27 listing housekeeping |
| **v0.0.3** — see every file                | The editor pane learns what files look like | #33 per-language highlighting (Markdown, Rust) · #35 image preview · #43 SVG Raw/Preview · #34 Markdown images               |
| **v0.0.4** — history you can act on        | The Changes panel acts on the past          | #36 commit preview · #38 revert with pre-filled message · #42 word-level diff                                                |
| **v0.0.5** — beyond the pane               | Reaching outside herdr-mIDE                 | #39 open in an installed editor · #37 drag-and-drop (Finder → folder)                                                        |

Within v0.0.2, #32 lands first — #45 and #44 add their items to the menu it
builds. Within v0.0.3, #35 verifies how `image()` resolves paths; #43 and #34
build on that conclusion.

---

## Phase 0 — Foundation ✅ (done)

- [x] Decide stack: a Herdr layout + mod package (herdr-sim distribution pattern)
- [x] Repo setup — install script, RECIPE.md, keys
- [x] Layout `herdr-mide`: Herdr's main with mIDE Files and Changes panels
- [x] `mide-files`: tree, type icons, git-status colors, open-in-editor
- [x] `mide-changes`: staged/unstaged groups, per-file staging, diff, commit, branches
- [x] `mide-editor`: pane with highlighting, ⌘S save, active Herdr theme
- [x] All mods pass `herdr-app check`

## Phase 1 — Editor core (the big rock — unscheduled)

> The "minimal IDE" part. Custom core, because the built-in editor exposes no
> cursor. This is one large, coherent piece of work rather than a wave of
> community issues; it starts after the v0.0.x waves above have shipped, as
> its own major push.

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

## Phase 2 — File manager (ships across v0.0.2 and v0.0.5)

- [ ] Fuzzy-find files by name ("go to file") — [#40](https://github.com/SOUMITRO-SAHA/herdr-mIDE/issues/40) (v0.0.2)
- [ ] **Filter by git status** — "show me only what the agent changed" (no issue yet)
- [ ] New / rename / delete / reveal file actions (context row or menu) — create [#44](https://github.com/SOUMITRO-SAHA/herdr-mIDE/issues/44), restore [#45](https://github.com/SOUMITRO-SAHA/herdr-mIDE/issues/45), the menu itself [#32](https://github.com/SOUMITRO-SAHA/herdr-mIDE/issues/32) (v0.0.2); rename and delete still need issues
- [ ] Respect `.gitignore` in listing (hide noise) — [#41](https://github.com/SOUMITRO-SAHA/herdr-mIDE/issues/41) (v0.0.2)
- [ ] Drop files from Finder onto a folder to move them — [#37](https://github.com/SOUMITRO-SAHA/herdr-mIDE/issues/37) (v0.0.5)
- [ ] More icons and a `NAMES`/`TYPES` override in shared state (no issue yet)

## Phase 3 — Git panel (ships across v0.0.4)

- [ ] **Hunk-level staging and discarding** (`git apply --cached` with selected hunks) (no issue yet)
- [ ] Word-level diff highlighting within changed lines — [#42](https://github.com/SOUMITRO-SAHA/herdr-mIDE/issues/42) (v0.0.4)
- [ ] Side-by-side diff mode (no issue yet)
- [ ] Commit history with per-commit file changes (`git log --stat`) — [#36](https://github.com/SOUMITRO-SAHA/herdr-mIDE/issues/36) (v0.0.4), acting on it: revert [#38](https://github.com/SOUMITRO-SAHA/herdr-mIDE/issues/38)
- [ ] Ahead/behind indicators and `pull`/`push`/`fetch` actions (no issue yet)
- [ ] Draft commit message from the staged diff (no issue yet)

## Phase 4 — The agent workflow (unscheduled)

> Make herdr-mIDE the natural home for working _with_ AI coding agents.

- [ ] "Review everything the agent changed" session: every diff in one pass, keep/discard as you go
- [ ] Commit message drafting from staged diffs
- [ ] Surface agents that touched files you are reviewing (`terminals()`, `agents()`)

## Phase 5 — Polish & hardening (ongoing)

- [ ] Performance on large repos and big diffs
- [ ] Keyboard-first everywhere (Vim motions beyond the editor: file tree, changes list)
- [ ] Remote machines: editor save and staging over `on` (needs upstream `writeTextFile` support)
- [ ] `preview.png` + listing on herdr.dev/layouts — the listing half is [#27](https://github.com/SOUMITRO-SAHA/herdr-mIDE/issues/27) (v0.0.2)
- [ ] Docs & screenshots

---

## Non-goals

- **Heavyweight plugins / extension marketplaces** — config files over plugin systems
- **Built-in debugger, notebooks, remote dev** — use the right tool for those
- **AI code generation built-in** — herdr-mIDE is for _reviewing_ agent output, not replacing agents
- **Feature parity with full IDEs** — minimal is the point

## Suggesting roadmap changes

Open an issue or a discussion on the repo. The bar for new features is simple:

> Does this make the **review → nudge → ship** loop faster?

Unplanned items above ("no issue yet") are up for grabs: open the issue
following the feature template, and it joins a milestone from there.
