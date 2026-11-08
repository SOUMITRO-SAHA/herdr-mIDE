# Third-party notices

## OpenCode in screenshots (`preview.png`, `public/`)

Some screenshots show [OpenCode](https://github.com/anomalyco/opencode)
running in a Herdr terminal beside the mIDE panels. OpenCode is by the
opencode contributors (MIT License, Copyright (c) 2025 opencode). These
screenshots were captured from the running interface and supplied for this
project; no OpenCode source or standalone assets are bundled. The examples
are renamed and linked from the README; `preview.png` is artwork incorporating
a screenshot of the interface.

## Material Icon Theme icons (`mods/mide-files/icons/`)

The file-type icons (`mods/mide-files/icons/material/`) and the
closed/open folder glyphs (`mods/mide-files/icons/folder.svg`,
`folder-open.svg`) are from
[Material Icon Theme](https://github.com/material-extensions/vscode-material-icon-theme)
by the Material Extensions team, used and redistributed under its MIT
license:

> Copyright (c) 2025 Material Extensions
>
> Permission is hereby granted, free of charge, to any person obtaining
> a copy of this software and associated documentation files (the
> "Software"), to deal in the Software without restriction, including
> without limitation the rights to use, copy, modify, merge, publish,
> distribute, sublicense, and/or sell copies of the Software, and to
> permit persons to whom the Software is furnished to do so, subject to
> the following conditions:
>
> The above copyright notice and this permission notice shall be
> included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
> OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
> MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
> NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
> LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
> OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
> WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

Taken from the MIT npm package `material-icon-theme` (the theme's built
16×16 SVGs). The file-type icons (`icons/material/`) ship verbatim with
the theme's baked brand colors and render as plain images; the only
modification is on the folder glyphs (`icons/folder.svg`,
`icons/folder-open.svg`), whose baked fill (`#90a4ae`) is rewritten to
`currentColor` so Herdr's theme tints them — muted when clean,
change-colored underneath. The association map
(`mods/mide-files/icons.js`) was generated from the theme's own
`fileIcons.ts` mapping (exact names and longest dotted suffixes;
filename-pattern and icon-pack-gated entries skipped). Sourcing rule:
Material Icon Theme is the only source for file-type and folder icons;
generic UI glyphs come from Herdr's own mods (the "Herdr shipped mods"
section below; see also
`.opencode/skills/material-icons-theme/SKILL.md`, local agent config).

## Ayu Dark theme (`themes/ayu-dark.json`)

The Ayu Dark palette is adapted from the Ayu editor theme, version 1.6.0:
[ayu-theme/vscode-ayu](https://github.com/ayu-theme/vscode-ayu), by Ike
Kurghinyan. It is licensed under the MIT License. The adopted syntax colors
are kept once in mIDE's `shared/syntax.js`; Git UI color mappings remain in
the mIDE mods, and the git status values themselves are Zed One Dark's
(next section). The reference JSON omits syntax values so they cannot drift
from the shared palette;
no reference-IDE theme file, code, or assets are included.

> MIT License
>
> Copyright (c) 2016 Ike Kurghinyan
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE.

## Zed One Dark git-status colors

The git status colors — `git_added` `#a1c181`, `git_deleted` `#d07277`,
and `git_modified`/`git_conflict` `#dec184`, defined in
`themes/ayu-dark.json` and the `palette.js` shipped with `mide-files`,
`mide-changes` and `mide-diff` — are taken from the One Dark theme of the
[zed editor](https://github.com/zed-industries/zed)
(`assets/themes/one/one.json`: `created` `#a1c181ff`, `deleted`
`#d07277ff`, `modified`/`conflict` `#dec184ff`). The zed repository is
licensed under
[GPL-3.0](https://github.com/zed-industries/zed/blob/main/LICENSE);
only these color values were adopted — no zed code, theme files, or
icons are included in this repository.

## Herdr shipped mods (Apache-2.0)

Parts of `mods/mide-files/main.js` (folder listing) and
`mods/mide-changes/main.js` (diff rendering) adapt Herdr's shipped `files`
and `changes` mods, and the tree chevron glyphs
(`mods/mide-files/icons/chevron-down.svg`, `chevron-right.svg`) are taken
from Herdr's shipped `files` mod (`defaults/mods/files/` in the app
repo, name-bearing class attributes stripped). All Apache-2.0 licensed.
See https://github.com/herdrdev/herdr-app.

## Lucide icons (`settings.svg`, `git-branch.svg`)

`mods/mide-files/icons/settings.svg` is copied unchanged from Herdr's shipped
`defaults/mods/workspace-chrome/settings.svg`. The source is the Lucide
Settings icon and is covered by the ISC license and copyright below (as
listed in Herdr's `defaults/icons/LICENSE-Lucide.txt`).

`mods/mide-files/icons/git-branch.svg` is a redraw of the Lucide Git
Branch icon: it first shipped as the verbatim 24×24 Lucide glyph and was
then restyled onto a 16×16 grid (1.2 stroke, geometry re-anchored) to
match the tree's tinted-stroke chevrons. It is covered by the same ISC
license and copyright below.

> ISC License
>
> Copyright (c) 2026 Lucide Icons and Contributors
>
> Permission to use, copy, modify, and/or distribute this software for any
> purpose with or without fee is hereby granted, provided that the above
> copyright notice and this permission notice appear in all copies.
>
> THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
> WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
> MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
> ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
> WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
> ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
> OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
