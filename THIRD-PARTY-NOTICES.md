# Third-party notices

## the previous icon family file icons (`assets/icons/the previous set/`)

The file icons are from [the previous icon family](https://github.com/jesseweed/the previous icon family) by
Jesse Weed — the icon set the reference IDE's default file-icon theme is built on — used
and redistributed under its MIT license:

> Copyright (c) 2014 Jesse Weed
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

A copy also travels into the mod as
`mods/mide-files/icons/the previous set/LICENSE` (the mod must stay self-contained for
ecosystem installs). The association map
(`mods/mide-files/icons.js`) is generated from the previous icon family's own mapping and
color palette by `scripts/the retired generator`; mask-style icons get
its colors baked in. No assets from the the reference IDE's repository
are used: the reference IDE's additional icon redesigns there are GPL-licensed.

## Herdr shipped mods (Apache-2.0)

Parts of `mods/mide-files/main.js` (folder listing) and
`mods/mide-changes/main.js` (diff rendering) adapt Herdr's shipped `files`
and `changes` mods, which are Apache-2.0 licensed. See
https://github.com/herdrdev/herdr-app.
