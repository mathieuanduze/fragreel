# CS2 Icon Bundle — Attribution

The SVG icons in this directory (`equipment/` and `death_notice/`) are
sourced from [lexogrine/cs2-react-hud](https://github.com/lexogrine/cs2-react-hud),
licensed under the MIT License.

```
MIT License

Copyright (c) 2021 Lexogrine

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Files

- `equipment/*.svg` — 70 weapon icons (ak47, awp, m4a4, knife variants, grenades, etc)
- `death_notice/headshot.svg` — HS modifier
- `death_notice/blind.svg` — flashed kill modifier (renamed from `flashed_kill.svg` upstream)

## Notes

These icons are **community-redrawn approximations** of CS2 panorama icons,
not Valve's exact original assets. Visually similar but not byte-identical.
Maintained by Lexogrine open source community.

Original Valve CS2 panorama icons live inside `pak01_dir.vpk` in the user's
CS2 install. Extracting requires Source 2 Viewer (ValveResourceFormat).
We chose to bundle the lexogrine community set instead because:

1. Clean MIT licensing (no Valve assets redistribution)
2. Works without depending on user's CS2 install version (newer CS2 packs
   panorama in VPKs that need extraction tooling)
3. Single maintained source — Lexogrine updates with CS2 weapon adds
4. ~50KB total bundle size (negligible vendor download impact)

If a weapon SVG is missing (filename mismatch from demoparser2 weapon
string → file in this folder), the editor falls back to plain text weapon
name in the killfeed.
