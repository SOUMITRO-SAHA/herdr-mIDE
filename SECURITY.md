# Security policy

## Scope

herdr-mIDE is a layout and mod package for the [Herdr app](https://herdr.dev).
Its mods run with **your** access: Files reads your workspace, Editor can
write files, Changes runs Git — including network operations when you ask
it to. Anything in this repository that runs on a person's machine is in
scope:

- `mods/mide-files`, `mods/mide-changes`, `mods/mide-diff`,
  `mods/mide-editor`, and their shared sources under `shared/`
- `install.sh` and `scripts/`
- the assembled gallery bundle under `gallery/herdr-mide/`

Out of scope: the Herdr app itself — window manager, terminals, agent
runtime, theme handling. Report those upstream at
[herdrdev/herdr-app](https://github.com/herdrdev/herdr-app), and read
Herdr's [mod security guidance](https://github.com/herdrdev/herdr-app/blob/master/docs/security.md),
which explains how mods run with your access and how to evaluate them.

## Reporting a vulnerability

Please report privately — **never open a public issue** for anything you
believe is exploitable or exposes user data:

1. Use the repository's **Security** tab → **Report a vulnerability**
   (GitHub private vulnerability reporting), or
2. if you cannot use that form, contact the maintainer (@SOUMITRO-SAHA)
   through GitHub and say clearly that it is a security report.

Include what is affected, how to reproduce it, the impact, and any
suggested fix.

## What to expect

This is a small project maintained in spare time. We aim to acknowledge
reports within a few days and to ship a fix or a documented mitigation as
soon as we can. Details stay private until a fix is available, disclosure
is coordinated with you, and credit is given on request.

## Review tips for users

- Review the mod source before installing; the installer prints what it
  copies and never overwrites existing folders.
- Prefer installing from tagged releases or the assembled gallery bundle,
  and review skipped folders instead of force-overwriting them.
- The README lists what each mod can do with your access — read it before
  installing.
