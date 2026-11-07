# herdr-mIDE

Herdr's window with a minimal IDE in the right-hand panel: a **Files** panel
that shows file-type icons and colors each file by its git status, and a
**Changes** panel with tracked and untracked groups, per-file staging, a
detailed diff, a guided commit and an inline branch switcher. Clicking a file
in Files opens it in an editor pane beside the terminal, with syntax
highlighting and ⌘S save. Syntax and Git change colors use Ayu; other UI colors
follow Herdr's theme, which is unchanged.

![herdr-mIDE](preview.png)

## What you see

- **Everything of Herdr's `main` layout** (sidebar, tab bar, panes, status
  bar) with the panel stack holding two mIDE blocks: `files` (mod
  `mide-files`) and `changes` (mod `mide-changes`), 440px wide by default
  (300 to 900px), opened from the tab bar's Files and Changes buttons like
  the shipped panels.
- **The Files panel** (`mide-files`, 42px header "Files" + folder name,
  26px rows): a lazy tree with chevrons and theme-tinted **solid folder
  glyphs** — muted when clean, colored (glyph **and** title) by the most
  severe change underneath (golden yellow modified, red deleted, green new),
  propagating up every ancestor folder, swapping to an open glyph while
  expanded — file and folder names in regular weight, muted when clean and
  dimmer when git-ignored (dependencies, build output, local secrets),
  taking their change color when modified via dedicated theme tokens
   (`git_modified`/`git_added`/`git_deleted`/`git_conflict`) — and a full-color
   **Material Icon Theme icon** for files (MIT, © Material Extensions;
   credited in THIRD-PARTY-NOTICES.md). `icons.js`, adapted from the
   theme's own associations, maps
   338 suffixes and 297 whole names — filtered to the minimal keep
   list (top-20 languages per TIOBE/Stack Overflow/PYPL, plus
   universal files like git/yaml/json/docker/lock).
   Match order: exact name, then longest dotted suffix, then the
   theme's default file glyph for unknown types. The **whole
   file name is colored by git status**: golden yellow modified or conflicted,
   green added/untracked, red deleted, with a small bold status
   letter (`M`, `A`, `D`, `U`) on the right. Status colors come from the Ayu
   palette. Normal and ignored names
   use `file_muted` and `git_ignored` (falling back to `muted` and `dim`).
- **The Changes panel** (`mide-changes`): **Changes** and **History** tabs;
  a `View Diff` summary with aggregate `+`/`−` counts and a Stage All /
  Unstage All split action; **Tracked** and **Untracked** groups with counts,
  per-file tri-state staging checkboxes, and group-level selection. The footer
  keeps the repository and current branch (for example `main`) visible beside
  Fetch and opens the branch switcher. The commit composer sits below it.
- **The branch view** (inside `mide-changes`, replaces list + diff while
  open): 28px branch rows (selected background on the current one,
  "current" label, "delete" in red on hover for others), and a "branch
  name" input with a **New** button that creates and switches.
- **The editor pane** (`mide-editor`, opened by clicking a file in Files or
  `cmd-shift-e`): a 36px header with the file name and an orange `●` while
  unsaved, a global Settings menu with persistent Word wrap and a default
  Markdown Preview option (off by default, so files open in Raw), plus
  Raw/Preview tabs; the code with Herdr's active terminal font and size;
  Preview uses the active interface font family at the editor font size, with
  generous leading and a centered reading column while retaining Markdown
  heading and emphasis hierarchy; a 28px status
  bar with the full path and an `⌘S save`
  hint. Panel UI uses Herdr's active interface font and size, while editor and
  diff text use its terminal font and size. mIDE's
   controls follow Herdr, while syntax and Git colors use private tokens from
   `themes/ayu-dark.json`; the layout does
   not select a host theme. Native editor/input internals still use some host
   colors because Herdr does not expose per-widget overrides for them.

## How it behaves

- **Files** expands a folder on click (lazy, one `sh`/PowerShell listing per
  folder, 500 entries per folder / 5,000 total, `.git` and `.DS_Store`
  hidden); clicking a file opens it in the tab's single editor pane, beside
  the terminal. Git marks refresh with the folder watch and every
  10s; modified/added/deleted coloring follows `git status
  --porcelain=v1` per path.
- **Changes** refreshes on the repo's folder watch and every 10s. Clicking a
  row opens its diff in the dedicated Diff tab. The row checkbox stages or
  unstages the file; its indeterminate state marks a partially staged file.
  The top split action runs `git add -A` or `git reset`; group checkboxes stage
  or unstage only that group. Commit defaults to staged files, or to tracked
  changes (excluding untracked files) when nothing is staged; the menu exposes
  both scopes. Enter in the message input commits.
- **The branch chip** opens the branch view: clicking a branch runs `git
  switch`, **New** runs `git switch -c`, "delete" runs `git branch -d`;
  every action refreshes the panel; Escape (or the chip) returns to the
  changes view.
- **The editor** loads `props().file`, marks dirty on any edit, uses Ayu syntax
  colors independently of Herdr's theme, and saves with
  `mide-editor.save` (bound to `cmd-s` in
  `keys.json`'s `mod:mide-editor` section) and shows `Save failed: …` on
  error.

## Built from

- **Layout** `layouts/herdr-mide.json`: a clone of Herdr 0.1.13's `main`
  (`cloned_from: {name: "main", version: "0.1.13"}`); only the `panel-body`
  stack's two blocks point at `mide-files` and `mide-changes`, the panel is
  440px, and the shipped `tabs` mod is kept — its Files and Changes buttons
  already toggle the `files` and `changes` block ids.
- **`mods/mide-files`**: `main.js` (tree, marks, icons, open-in-editor),
  `icons/` (folder + chevron glyphs) and `icons/material/` (62 Material Icon Theme SVGs — a researched minimal set), `icons.js` (the generated suffix/name map). Herdr
  functions: `spaces`, `panes`, `focused`, `exec`, `watchFolder`,
   `run`. Folder listing adapted from Herdr's shipped `files`
  mod (Apache-2.0). All icons live in the mod itself
  (`mods/mide-files/icons/` — the single source of truth).
  Material Icon Theme is the only file-type and folder icon source.
- **`mods/mide-changes`**: `main.js`. Herdr functions: `spaces`, `panes`,
  `focused`, `exec`, `readTextFile`, `watchFolder`.
  Diff rows and the virtual list adapt Herdr's shipped `changes` mod
  (Apache-2.0). Programs: `git` only.
- **`mods/mide-editor`** (`"focusable": true`): `main.js`. Herdr functions:
  `props`, `settings`, `readTextFile`, `writeTextFile`,
  `nextCommand`; gpui-base's `Editor` /
  `EditorState`.
- **`keys.json`**: global `cmd-shift-e` splits an editor pane;
  `mod:mide-editor` binds `cmd-s` to `mide-editor.save`.

## Watch out

- **Icons have one home**: `mods/mide-files/icons/` — the mod folder
  is self-contained (ecosystem installs copy `mods/<name>/` as-is), so
  there is no separate assets tree and no copy step. Never commit file-type
  or folder icons from any other source.

- **The built-in EditorState has no cursor or selection API** — only
  `value()`/`set_value()`/`on(change…)`. Modal (Vim) editing therefore
  needs a custom editor core drawn from gpui-kit primitives; the `mod:` key
  plumbing in `mide-editor` is its landing pad
  (see ROADMAP Phase 1).
- **`props()` can be null** — `herdr-app check` runs the mod with no props;
  read it as `props()?.file ?? null` or init crashes.
- **Paren balancing in long builder chains**: the runtime's parser rejects
  what some Node versions accept in ESM files; run `herdr-app check` after
  every edit (it is the only truth).
- Git reads use `--no-optional-locks -c core.fsmonitor=false -c
  diff.autoRefreshIndex=false` so they write nothing under `.git` —
  otherwise the folder watch sees its own side effects and refreshes
  forever.
- The commit flow stages nothing implicitly: an unstaged work tree and a
  message leave Commit disabled on purpose ("better file adding" means
  explicit).
- Remote machines (`on`) list, diff and stage fine, but `writeTextFile` is
  local-only, so the editor pane only saves local files.
- No `preview.png` yet: take one with `herdr-app shot` after the first real
  run (the layout must be visible) and save it over the placeholder slot at
  the repo root.
- The branch view is inline, not an overlay, so it never fights the panel
  stack; Escape returns to changes.

## Done when

- `herdr-app check` passes for all three mods after `./install.sh`.
- `herdr-app do layout.switch --name herdr-mide` shows the Files panel with
  colored, icon-differentiated files in a dirty git repo (orange modified,
  green new, red deleted), updating within a second of a file changing.
- Clicking a file opens the editor pane beside the terminal; editing marks
  the dot, `cmd-s` saves, and the saved state survives reopening the file.
- In Changes: staging one file moves it to STAGED within a second, the `+`
  and `−` buttons move files between groups, and Commit with a message
  creates a commit containing exactly the staged files.
- The branch chip lists branches; switching changes the chip and the tree's
  marks; New creates and switches; delete removes a merged branch.
- Herdr retains its configured theme and terminal colors when the layout is
  opened; mIDE controls follow Herdr while editor syntax and Git changes use Ayu.
