# herdr-mIDE

Herdr's familiar window gains a Files tree, a Changes panel, a diff viewer
and a small editor beside its terminals. Review an agent's changes, stage
files, commit and make small edits without changing Herdr's theme.

![herdr-mIDE](preview.png)

## What you see

- The main window keeps Herdr's spaces and agents sidebar (268px initially),
  tab bar, terminal panes and status bar. The Files and Changes buttons show
  a right panel, initially hidden, 440px wide and resizable from 300–900px.
  Herdr's shipped agents view presents working, blocked, done and idle states.
- Files has a 42px header and 26px tree rows. Folders expand to show their
  contents; their glyphs and names reflect the most severe change underneath.
  File-type icons are colored; changed names show a status letter. Ignored
  names are dimmed. Git colors are green `#a1c181`, red `#d07277`, and
  yellow `#dec184` for modified or conflicted entries.
- Changes has a 36px Changes/History tab strip, a diff summary and stage
  action, followed by Tracked and Untracked groups with tri-state checkboxes.
  Its footer shows the repository, branch and remote action; the Changes tab
  also has a commit message area. History lists recent commits.
- The branch control opens a searchable popover with the current branch,
  other local branches, delete actions and an option to create a branch.
- Diff opens beside a terminal or editor with file headers, line numbers,
  additions and deletions, Split/Unified controls and a Refresh button. Editor
  opens beside a terminal or below Diff, with a 36px header, unsaved dot,
  optional Markdown Raw/Preview tabs, Settings menu and 28px footer with Save.
- Panel controls use Herdr's interface font and colors. Editor and diff text
  use the terminal font; their syntax uses mIDE's Ayu palette. The layout does
  not change the user's selected theme.

## How it behaves

- Click folders to expand them and files to open or reuse the current tab's
  editor. Unsaved drafts stay available while switching files in that editor.
  File and Git information refresh on local folder changes and every 10 seconds.
- In Changes, clicking a file opens its diff; its checkbox stages or unstages
  it without opening Diff. Group checkboxes and Stage All/Unstage All act on
  their respective files. History displays up to 100 recent commits.
- Enter a commit message and submit it. The default commits staged changes;
  if nothing is staged, it stages tracked changes and commits them, excluding
  untracked files. The footer offers Fetch, Pull and Push; its primary action
  follows the upstream ahead/behind state. The branch popover switches,
  creates or deletes local branches.
- A failed Git action — a switch blocked by uncommitted changes, a missing
  branch, an unmerged delete — shows one short readable line where the action
  was taken and posts an error toast (for example "Uncommitted changes to
  .gitignore would be overwritten — commit or stash them first."), never git's
  raw multiline output. While the branch popover is open, the message appears
  only inside it; otherwise it appears in the panel. Long inline text is
  truncated to fit, with recovery guidance on a separate line when available.
- Diff shows tracked changes against HEAD and untracked files as additions.
  It refreshes, supports Split and Unified views, and uses Unified when the
  view is too narrow for Split.
- Editor's Save button writes the current file; the optional `⌘S`/`Ctrl+S`
  binding does the same. An external edit causes a save error instead of an overwrite;
  Reload discards the draft. Word wrap and the Markdown Preview default are
  persistent settings, with Markdown opening in Raw by default.

## Built from

- `layouts/herdr-mide.json` clones Herdr `main` at 0.1.13: root row with
  sidebar (`workspace-chrome`, `spaces`, `agents`, `workspace-chrome` footer)
  and work column (`tabs`, active tab with `pane` header, right panel stack,
  `workspace-status`). The `files` and `changes` blocks load the mIDE mods;
  the other named mods are shipped by Herdr.
- Four cooperating folders, all with `place: none` in `mod.json`:
  `mide-files` lists the tree and opens the editor; `mide-changes` handles
  status, staging, commits, branches and remote Git actions; `mide-diff`
  displays comparisons; `mide-editor` edits and saves files. Changes, Diff
  and Editor opt into focus. Editor receives `{file}`; Diff receives a
  request including `{root, files, selectedPath, on, branch, title}`. The
  panel mods derive their location from the focused workspace.
- Mods use `gpui-kit`, `gpui-base` and Herdr's `spaces`, `panes`, `focused`,
  `props`, `settings`, `theme`, `window`, `shared`, `setShared`, `exec`, `watchFolder`,
  `notify`, `readTextFile`, `writeTextFile`, `nextCommand` and `run`. Commands include
  `pane.split`, `tab.new`, `mide-editor.open`, `mide-editor.save` and
  `mide-diff.open`. `keys.json` supplies optional `cmd-shift-e`/`ctrl-shift-e`
  and `cmd-s`/`ctrl-s` bindings for manual merging, not automatic replacement.
- Local folder listings inside Herdr's granted read roots (the home folder;
  the app grants `read_roots([home()])` to every mod on every platform) run
  in-process through Herdr's fs API. A local folder outside those roots keeps
  the transports the helper always used, chosen by platform exactly as before:
  PowerShell on Windows, `sh` on macOS and Linux. Remote machines probe `sh`
  first and use PowerShell on Windows without it. Git is required for
  status, diff, history, staging, commits, branches and remote operations.
  Fetch, pull and push can contact the configured remote and use the user's
  Git/SSH credentials; commits may run Git hooks. Mods read files outside
  their own folders, and Editor writes the selected local file.
- Material Icon Theme supplies file and folder SVGs and associations; the
  chevrons come from Herdr and the branch glyph is adapted from Lucide. See `LICENSE` and
  `THIRD-PARTY-NOTICES.md` for licenses, palette sources and adaptations.
  Release bundles include these notices and the project license both at the
  root and within each mod folder so they accompany gallery-style copies.
  `shared/syntax.js` is the development source for Editor and Diff's syntax
  module; a distributable build must include its generated mod-local
  `_shared/syntax.js` in each of those two folders.

## Watch out

- This is one layout with four dependent mods, not four independent gallery
  mods. Source `mods/` is not a complete copyable package: use the assembled
  bundle or the checked-in `gallery/herdr-mide/` snapshot. Its Git UI also
  references SVGs in `mide-files`. Preserve or
  consistently rename every cross-mod reference and asset path on conflicts.
- The layout is based on Herdr 0.1.13; validate all features against the
  supported released app and each target OS before release. Herdr's initial
  mod checker does not exercise deferred rows or interactions.
- Files limits listings to 500 entries per folder and 5,000 total; Changes
  shows the first 1,000 changed files and the branch picker up to 200 branches.
  Diff truncates large input and has syntax-highlighting budgets; binary and
  conflicted files have limited views. Editor refuses to save files truncated
  past 400,000 characters and cannot edit binary files.
- Folder watch is local; remote views rely on periodic refresh. Editor reads
  and writes locally, so do not rely on it to edit a remote machine's files.
  Herdr grants its fs API reads inside the home folder only, on every
  platform: a project outside it (another mounted volume on macOS or Linux,
  another drive on Windows) is listed through that platform's shell transport
  instead — PowerShell on Windows, `sh` on macOS and Linux — so those folders
  need a working shell. Git operations can modify the index, worktree,
  branches and remote; test them in a disposable repository. Vim mode and
  hunk staging are not present.
- Git refresh reads disable optional locks and fsmonitor to avoid triggering
  the folder watcher with their own side effects.
- The source installer skips existing mod/layout names and prints keys rather
  than overwriting them; it is not an upgrade tool. Review name and shortcut
  conflicts before installing or manually updating. A `preview.png` must be a
  reviewed, representative screenshot with no private information.

## Done when

- Each of the four assembled mod folders passes `herdr-app check`, and the
  layout loads in the isolated `herdr-dev` profile without mod errors during
  local testing; a separate VM or test machine is not required.
- In a disposable Git repository, Files expands and marks changes; editing and
  saving works, and an external edit is not silently overwritten.
- Changes stages and unstages files and groups; a commit with staged changes
  includes the staged content. With no staged changes, a tracked-only commit
  excludes untracked files.
- Diff opens for a changed file and switches views. Branch selection works;
  remote actions are exercised only against a disposable remote.
- A branch switch blocked by local edits fails without moving HEAD, and the
  panel shows the short blocked-files message plus an error toast rather than
  git's raw output.
- The original layout, keys, app theme and unrelated installed mods remain
  unchanged by installation; all relevant behaviors are checked on supported
  platforms before publishing.
