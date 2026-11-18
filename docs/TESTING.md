# Testing herdr-mIDE

## Terminology (read this first)

In issues, PRs, and agent instructions, **automation testing** and **E2E
testing** mean the same thing here: the [`e2e/`](../e2e/) setup — scripts under
`e2e/scripts/`, outputs under `e2e/screenshots/<run-id>/`, always on the
**`herdr-dev`** profile (`HERDR_APP_HOME=~/.config/herdr-dev`). Start from
[`e2e/README.md`](../e2e/README.md) and `just e2e-*` recipes in the root
`justfile`.

That is **not** the same as:

- **Automated checks** — `just test`, `just check`, `just fmt-check` (Bun +
  temp staging + `herdr-app check`; required on every PR, but they do not
  exercise most interactions).
- **Smoke workflow** — `just smoke-prepare` / `just smoke-capture` (disposable
  isolated app home for CI; see below).

For a user-facing feature, “tested end-to-end” means automated checks are green
**and** the relevant `e2e/` script and/or manual scenes below were run on
`herdr-dev`, with captures or notes in the PR.

## Development profile vs production (required)

Herdr splits state in two places:

| Layer                                      | Variable / location                                                | What lives here                           |
| ------------------------------------------ | ------------------------------------------------------------------ | ----------------------------------------- |
| **Window** (layouts, mods, keys)           | `HERDR_APP_HOME` → `~/.config/herdr-dev`                           | Layout JSON, mod copies, `herdr-app.sock` |
| **Core** (spaces, tabs, agents, terminals) | `HC_SESSION` → `herdr-mide-dev` (plus XDG dirs under the dev home) | Space list, agents, terminal sessions     |

**`HERDR_APP_HOME` alone is not enough.** If the dev window shares the default
`HC_SESSION` with production, `herdr-app do space.new` and automation create
spaces in the **same sidebar as your real work** (for example “mIDE e2e” beside
`super-muse`). That is the failure mode we guard against.

| Profile         | Isolation                                                                                                                         | Use for                                                                                        |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **`herdr-dev`** | `scripts/herdr-dev-profile.sh`: `HERDR_APP_HOME`, `HC_SESSION=herdr-mide-dev`, dedicated `XDG_*` under `~/.config/herdr-dev/xdg/` | `just setup-herdr-dev`, `just dev`, `sync`, `status`, `shot`, `switch`, all **`e2e/`** scripts |
| **Production**  | default `~/.config/herdr-app` + default core                                                                                      | Owner-requested release check only — **never** development, agents, or automation              |

### One-time setup

```sh
just setup-herdr-dev    # creates dirs, prints the env block to start Herdr
```

Launch **one dedicated dev window** with that printed `env … Herdr` line (or
export the same variables in the terminal before `open` / the app binary).
Quit any older “herdr-dev” window that was started with only `HERDR_APP_HOME`
and no `HC_SESSION`, then relaunch — otherwise spaces may still be shared.

Repo recipes apply the profile for you:

- `just dev`, `just sync`, `just status`, `just shot`, `just switch` →
  `MIDE_HERDR_DEV=1` or `scripts/herdr-dev-exec.sh`
- `just e2e-*` → `e2e/scripts/lib/herdr-dev.sh` (refuses production paths,
  starts dev Herdr with full env, matches PID on `HERDR_APP_HOME` **and**
  `HC_SESSION`)

### Rules (people and agents)

1. **Never** run `just sync`, `just dev`, automation, or `herdr-app do …`
   against production. Use `just install` / `install.sh` for deliberate installs
   into `~/.config/herdr-app`, not `just sync`.
2. **Never** fall back to production when `herdr-dev` is missing — run
   `just setup-herdr-dev` and start the isolated window instead.
3. **Never** query or drive production with agents (`herdr-app status` without
   the dev profile, screenshots, `space.new`, pointer automation) unless the
   owner explicitly asks for a single release smoke.
4. E2E scripts use `--focus false` on new spaces so dev work does not steal
   focus from a production window on the same display.
5. CI and `just smoke-prepare` use **disposable** homes/sessions — not
   production and not a substitute for fixing local `herdr-dev`.

Canonical implementation: [`scripts/herdr-dev-profile.sh`](../scripts/herdr-dev-profile.sh)
(modeled on Herdr’s `scripts/sandbox` and our `scripts/smoke.mjs` isolation).
See [AGENTS.md](../AGENTS.md) and [e2e/README.md](../e2e/README.md).

### Documentation screenshots

Images committed in `public/examples/` (and the gallery `preview.png` when
updated) must come from the **`herdr-dev`** profile or another **owner-reviewed,
non-production** capture workflow:

1. `HERDR_APP_HOME=~/.config/herdr-dev just sync` so mods match the repo.
2. Run the relevant `just e2e-*` script or manual scenes; outputs land in
   `e2e/screenshots/<run-id>/` (gitignored) or `just shot` / `herdr-app shot
<new-file.png>`.
3. **Review every pixel** for paths, credentials, terminal output, email
   addresses and agent names before copying into `public/examples/` or
   replacing `preview.png`.
4. Never capture from production `~/.config/herdr-app` for repo documentation.

## Platform workflow

Use this workflow on each target **macOS, Linux and Windows** machine. It
does not build, install or modify Herdr itself. Run it only against a released,
already-installed `herdr-app` and `hc`; record their versions and the OS with
the results. A pass on one OS, or a mocked platform test, is not proof of a
pass on another.

This workflow has been fully exercised on macOS. On Windows, the automated
checks and `make smoke-prepare` passed on 2026-11-09 (herdr-app 0.1.14,
hc 0.1.19) after fixing CRLF-checkout and Windows symlink issues, but the
interactive desktop scenes could not run there yet: while any Herdr window is
already open, a second `herdr-app` launch exits silently (machine-wide
single-instance behavior on Windows). See the dated matrix below for later
results and remaining gaps.

Herdr's own approach separates an app home, core session and state for tests;
its Linux UI sandbox additionally uses a private Weston/Xwayland display. The
sibling `herdr-app/scripts/sandbox` also builds Herdr even when given another
binary, so **do not run it from this project**. Scripts in [`e2e/`](../e2e/) may
drive pointer/keyboard on **`herdr-dev` only** (see `e2e/README.md`); smoke and
check helpers still do not launch, stop or modify someone else's Herdr or core.

## Automated checks

On each OS, from this repo run:

```sh
herdr-app --version
hc --version
just test
just check
```

The root `justfile` is the only entry point; install
[just](https://github.com/casey/just) (1.59 tested) alongside Bun, Git,
a POSIX shell and `rsync` (`bun install` once, for the Prettier formatter). On Windows, run the commands from PowerShell or
cmd: the recipes drive Git Bash's `bash.exe -lc` at the default install path
(a non-default Git location overrides that per invocation with
`just --shell "<path>/bin/bash.exe" --shell-arg -lc <target>`), and rsync
must be provisioned separately — Git for Windows does not include it.
Provisioning cwRsync that worked here: install Chocolatey's `rsync` package
or unpack the free zip after verifying its published SHA-256, then place an
executable `rsync` shim earlier on the PATH —
`scripts/rsync-path-adapter.sh` is the reference implementation. It sets
`MSYS_NO_PATHCONV=1` and `MSYS2_ARG_CONV_EXCL='*'` and translates `C:/...`
and `/c/...` arguments to Cygwin's `/cygdrive/c/...` before exec'ing
cwRsync's rsync, and maps MSYS's `/tmp` mount (which cwRsync resolves to its
own missing root) to the Windows temp directory.
Export `MSYS=winsymlinks:nativestrict` with Windows Developer Mode
enabled (or run elevated) so the installer and uninstaller tests can create
real symlinks.
`just check` also needs the installed Herdr CLI. Tests use disposable Git
repositories; remote-action tests use a local bare repository, not the
network. The mod checker loads and renders the initial state but does not
exercise deferred rows or user interactions.

A dispatch-only GitHub Actions workflow
(`.github/workflows/windows-e2e.yml`) repeats this workflow on a disposable
hosted Windows VM: it provisions rsync through the committed adapter,
installs the released Herdr app, runs `just test` and `just check`, prepares
the isolated fixture, starts the app in the isolated app home and captures
the command-driven scenes (screen, files, changes, editor). It does not
automate pointer interactions; scenes still need the manual work below.

## Local desktop checks

Use the **`herdr-dev` profile** on the target OS; a dedicated VM or test
machine is not required. Set `HERDR_APP_HOME` to the dev home for every app
command and separately verify that the app uses the intended dev core session:
the app-home override alone does not select a core. Never use production as a
fallback. The app binary is still shared and installed releases may update
themselves. Never fake input on a person's real display, or stop, restart or
overwrite an app, core, file or key binding belonging to someone else.

1. Run `just smoke-prepare` to make a disposable Git fixture. It prints the
   scratch directory; use its `fixture/` only for local live checks. The
   helper also creates an app home and environment files for CI, but **do not
   source those files or start a local test window in that home**: they select
   the scratch profile instead of `herdr-dev`. No app or core is launched.
2. In the dev home, inspect for name collisions before installing the reviewed
   assembled layout and mods. Do not overwrite existing folders, layouts or
   keys; resolve conflicts with the owner first. Merge optional keys only with
   permission. Check each installed mod with `herdr-app check`.
3. Start or use only an appropriately isolated `herdr-dev` window and its
   intended dev core. Before commands, verify both `HERDR_APP_HOME` and the
   core session, including inherited socket or terminal overrides. Open the
   disposable `fixture/` as a space and select `herdr-mide`. If the window or
   core cannot be positively identified, stop and ask; never restart another
   person's app or core. On Windows, Herdr 0.1.14 was observed to refuse a
   second window while another was open: do not close that window without
   permission; report the conflict instead.
4. Exercise the scenes below manually in the dev window. To capture a scene,
   use `herdr-app shot` with `HERDR_APP_HOME` set to the dev home and a **new,
   non-existing** filename under a scratch directory, or run the curated scripts
   in [`e2e/`](../e2e/) (outputs go to `e2e/screenshots/<run-id>/`, gitignored).
   Inspect the image and window yourself; a screenshot is not an interaction or
   visual assertion. `just smoke-capture` targets the helper's separate app home
   and is not the local `herdr-dev` capture workflow.
5. When finished, close or stop only the dev window, core and terminals that
   you started and are authorized to stop. Preserve the scratch directory until
   nothing uses it; the preparation helper does not delete it.

### Scenes and expected results

- **Files:** expand folders; check icons, modified/untracked marks and refresh.
  Right-click root, folder and file rows — context menu actions, New File/New
  Folder inline naming, and optional shortcut hints when keys are merged. On
  macOS, `just e2e-files-context <run-id>` captures a repeatable dev run; on
  Windows, include folder names with spaces, apostrophes and Unicode.
- **Editor:** open `sample.txt`, edit and save, switch files and return to a
  draft; then change the same file externally and confirm save refuses the
  stale baseline. Test Markdown Raw/Preview and word wrap; on macOS,
  `just e2e-editor-markdown <run-id>` captures the Raw header scene. Open a
  changed `.md` in Changes/Diff and confirm inline Markdown coloring in the diff
  pane.
- **Changes and Diff:** stage and unstage a file and group, verify checkbox
  clicks do not open Diff, open a row and use Split/Unified and Refresh.
  Commit staged changes, then tracked-only changes; verify the commit contents
  and that untracked files remain excluded. Use only the scratch repository.
- **Branches and remotes:** create, switch and delete a merged test branch.
  In the scratch repository, make conflicting changes on two branches and
  attempt to switch with an uncommitted edit. Check the error with the branch
  picker open, then closed, in both Changes and History; text must not overlap
  controls and the error toast should appear. Confirm the edit remains intact.
  Exercise fetch/pull/push only against a disposable local bare remote. The
  automated Git integration test already exercises these methods against one,
  but it is not a UI test.
- **Safety:** confirm the layout and controls follow the active theme, and
  that the person's normal app home, keys, layouts and core were not touched.

Capture e.g. `files`, `editor`, `changes` and `diff`; record the OS, app/core
versions, commands, visual results, failures and screenshot paths. On Linux,
use the `herdr-dev` profile for local interaction on every platform. The helper
does not provide native pointer automation, and agents must not fake input on
a person's real display. Never report a manual or visual check as passed unless
it was actually performed.

For each release, record a fresh matrix rather than carrying old passes forward:

| Platform | App/core versions                         | `just check`                                                                                                                                                 | Interactive scenes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Notes / screenshots                                                                                                                                                                                                                                                                                      |
| -------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS    | herdr-app 0.1.16 (2026-11-17)             | pass — `just test`, `just check`, `just fmt-check` on `main` after PR #50–#51                                                                                | partial — `e2e/` on **`herdr-dev`**: Files context menus (`just e2e-files-context`), Editor Markdown Raw (`just e2e-editor-markdown`). `public/examples/files-context-menu.png` shows the menu; terminal panes in some examples may still need cropping or a smoke-fixture re-capture before Gallery refresh. Full manual matrix (branches, remotes, conflicts) not re-run for this doc pass.                                                                                                                                                                                                                                       | Production app home not used; dev window started via `e2e/scripts/lib/herdr-dev.sh`                                                                                                                                                                                                                      |
| Linux    | herdr-app 0.1.15 / hc 0.1.20 (2026-11-12) | pass — `just test`/`just check`/`just fmt-check` (Bun 1.4.4, just 1.45.0) at `b57580c`; Ubuntu 26.04.1 x86_64, GNOME Wayland (VMware VM)                     | partial — command-driven layout/space setup with captures; Files in and outside the granted read root: special-char names, Git marks, external add/rename auto-refresh, tree→editor open; editor Ctrl+S save on an apostrophe path (optional keys merged into the smoke home), unsaved-dot drafts; staging checkboxes, staged and tracked-only UI commits verified with Git; branch picker create/switch; panel resize 300–900; 12 clean captures, no mod errors. Not exercised (owner-accepted before v0.0.1): branch delete, blocked-switch error + toast, editor save conflict, Markdown Raw/Preview, word wrap, fetch/pull/push | second instance runs alongside an open window; Wayland socket panic + workaround in the smoke steps above; the Files/Changes buttons render only while the panel is visible, so a fresh space's hidden panel has no mouse path; commit submits only via Ctrl+Enter; captures kept locally, not committed |
| Windows  | herdr-app 0.1.14 / hc 0.1.19 (2026-11-09) | pass — after CRLF-checkout, Windows symlink, Files `-EncodedCommand` and Git-marks fixes                                                                     | pending — Files scene verified on-window via screenshots; Editor/Changes/Diff/Remotes need the remaining clicks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `make test`, `make check`, `make smoke-prepare` green; single-instance finding above                                                                                                                                                                                                                     |
| Windows  | herdr-app 0.1.15 / hc 0.1.20 (2026-11-11) | pass — `just test`/`just check` (GNU Make not installed; the justfile and path-adapter shim above), locally and on a hosted VM by the `windows-e2e` workflow | partial — Files tree with space/apostrophe/Unicode names, editor Save button and the Ctrl+S binding fix, draft persistence, external-edit save conflict, Reload, Markdown Raw/Preview, word wrap, staging checkboxes, Stage All/Unstage All, row diffs, Split/Unified and Refresh verified on-window with independent Git checks; UI commits, history, the branch picker and fetch/pull/push not exercised                                                                                                                                                                                                                          | `just smoke-prepare` green; single-instance finding above; hosted-VM command-driven scenes (layout, space, panels, screenshots, no mod errors) green with artifacts                                                                                                                                      |
