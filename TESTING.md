# Testing herdr-mIDE

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
single-instance behavior on Windows), so the isolated smoke needs a machine
or disposable VM with no Herdr window open. Linux still needs testing.

Herdr's own approach separates an app home, core session and state for tests;
its Linux UI sandbox additionally uses a private Weston/Xwayland display. The
sibling `herdr-app/scripts/sandbox` also builds Herdr even when given another
binary, so **do not run it from this project**. Our helpers do not automate
pointer or keyboard input and do not launch, stop or modify Herdr or a core.

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
enabled (or run elevated) so the installer test can create real symlinks.
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
automate pointer interactions; scenes still need the manual or VM-desktop
work below.

## Isolated desktop smoke checks

Use a disposable VM or dedicated test machine on the target OS, with the
released Herdr and core already available. Isolating the app home and core
does **not** isolate the installed app binary: Herdr releases may update
themselves. Never run fake input on a person's real display, and never stop or
restart an app or core you did not start. No helper here starts or stops either.

1. Run `just smoke-prepare` from the project. It creates a unique temporary
   directory, a self-contained staged bundle, a separate app home, a unique
   core session, private XDG state/config/runtime directories and a disposable
   Git fixture with one modified and one untracked file. It prints the
   **absolute scratch directory**. Nothing is installed into your app home.
   If the Unix socket path is too long, set `TMPDIR` to a shorter private temp
   directory. The helper uses `/var/tmp` as a shorter Unix fallback.
2. In the disposable desktop environment, open a **new terminal** and load
   the generated environment file. Substitute the printed path:

   ```sh
   # macOS/Linux
   . "/absolute/scratch/path/env.sh"
   ```

   On Windows, use `. 'C:\absolute\scratch\path\env.ps1'` in PowerShell.
   In Git Bash, convert the printed native scratch path to a shell path first,
   for example `. "$(cygpath -u 'C:\absolute\scratch\path')/env.sh"`.
   These files set `HERDR_APP_HOME`, `HC_SESSION`, XDG directories and
   `DO_NOT_TRACK`, and clear inherited core socket/terminal overrides. On
   Windows both files also isolate `APPDATA` and `LOCALAPPDATA`.
   Prepare a fresh directory **on each target OS**; do not transfer env files
   between machines.

3. In that same isolated environment, start the installed `herdr-app` yourself.
   Complete any first-run prompts, select `herdr-mide`, and open a space at
   the scratch directory's `fixture/`. Before using any Herdr CLI command,
   verify that this terminal still has the generated `HERDR_APP_HOME` and
   `HC_SESSION`. Do not use your normal window, core, or Git repository.
   On Windows this step fails while any Herdr window is already open: the
   second launch exits without a new window, socket or isolated state
   (observed with herdr-app 0.1.14). Use a machine or disposable VM with no
   Herdr window open for the interactive scenes.
4. Exercise each scene below in that test window. From the project in a second
   terminal, run, replacing the path and scene name each time:

   ```sh
   just smoke-capture /absolute/scratch/path files
   ```

   On Windows, pass the printed native path using forward slashes, for example
   `just smoke-capture "C:/absolute/scratch/path" files`;
   the Node helper requires an absolute native path rather than `/c/...`.
   The helper connects **only** to the prepared app home's control socket,
   requires the `herdr-mide` layout and no reported mod errors, and asks Herdr
   for a PNG in a new scratch capture directory. It checks the PNG header and
   dimensions, not its pixels or the interaction's outcome. Inspect each image
   and the window yourself. Scene names are lowercase letters, digits and
   hyphens; repeat captures never overwrite earlier ones.

5. When finished, close only the test window and stop only the isolated core
   session and terminals you started, using the generated environment. Keep or
   remove the scratch directory only after confirming that nothing in it is
   still running. The helper deliberately does not delete it.

### Scenes and expected results

- **Files:** expand folders; check icons, modified/untracked marks and refresh.
  On Windows, include folder names with spaces, apostrophes and Unicode.
- **Editor:** open `sample.txt`, edit and save, switch files and return to a
  draft; then change the same file externally and confirm save refuses the
  stale baseline. Test Markdown Raw/Preview and word wrap.
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
headless pointer automation is appropriate only in an independently
provisioned private Weston/Xwayland display or VM. On macOS and Windows, use
an isolated interactive test environment; the current helper does not provide
native pointer automation. Never report a manual or visual check as passed
unless it was actually performed.

For each release, record a fresh matrix rather than carrying old passes forward:

| Platform | App/core versions                         | `just check`                                                                                                                                                 | Interactive scenes                                                                                                                                                                                                                                                                                                                                                                                         | Notes / screenshots                                                                                                                                                 |
| -------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS    | pending                                   | pending                                                                                                                                                      | pending                                                                                                                                                                                                                                                                                                                                                                                                    |                                                                                                                                                                     |
| Linux    | pending                                   | pending                                                                                                                                                      | pending                                                                                                                                                                                                                                                                                                                                                                                                    |                                                                                                                                                                     |
| Windows  | herdr-app 0.1.14 / hc 0.1.19 (2026-11-09) | pass — after CRLF-checkout, Windows symlink, Files `-EncodedCommand` and Git-marks fixes                                                                     | pending — Files scene verified on-window via screenshots; Editor/Changes/Diff/Remotes need the remaining clicks                                                                                                                                                                                                                                                                                            | `make test`, `make check`, `make smoke-prepare` green; single-instance finding above                                                                                |
| Windows  | herdr-app 0.1.15 / hc 0.1.20 (2026-11-11) | pass — `just test`/`just check` (GNU Make not installed; the justfile and path-adapter shim above), locally and on a hosted VM by the `windows-e2e` workflow | partial — Files tree with space/apostrophe/Unicode names, editor Save button and the Ctrl+S binding fix, draft persistence, external-edit save conflict, Reload, Markdown Raw/Preview, word wrap, staging checkboxes, Stage All/Unstage All, row diffs, Split/Unified and Refresh verified on-window with independent Git checks; UI commits, history, the branch picker and fetch/pull/push not exercised | `just smoke-prepare` green; single-instance finding above; hosted-VM command-driven scenes (layout, space, panels, screenshots, no mod errors) green with artifacts |
