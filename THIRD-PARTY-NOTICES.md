# Third-party notices

## the previous glyph set tree glyphs (`mods/mide-files/icons/`)

The chevron glyphs are from
[the previous glyph set](https://the previous glyph set.dev), used under its ISC license:

> ISC License
>
> Copyright (c) 2026 the previous glyph set Icons and Contributors
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

The chevrons are among the icons the previous glyph set derives from the Feather project
(MIT, © 2013-present Cole Bemis), as noted in the previous glyph set's own license file.

## Material Icon Theme icons (`mods/mide-files/icons/`)

All icons in this project — the file-type icons
(`mods/mide-files/icons/material/`) and the closed/open folder glyphs
(`mods/mide-files/icons/folder.svg`, `folder-open.svg`) — are from
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
16×16 SVGs), with one modification: the baked fill (`#90a4ae`) is
rewritten to `currentColor` so Herdr's theme tints the glyphs — muted
when clean, change-colored underneath. The association map
(`mods/mide-files/icons.js`) is generated from the theme's own
`fileIcons.ts` mapping by `scripts/update-icons.sh`. Sourcing rule:
Material Icon Theme is the only icon source in this project (see
`.opencode/skills/material-icons-theme/SKILL.md`, local agent config).

## Herdr shipped mods (Apache-2.0)

Parts of `mods/mide-files/main.js` (folder listing) and
`mods/mide-changes/main.js` (diff rendering) adapt Herdr's shipped `files`
and `changes` mods, which are Apache-2.0 licensed. See
https://github.com/herdrdev/herdr-app.
