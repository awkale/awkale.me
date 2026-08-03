# AWK-22 prototype — THROWAWAY

Primary source for [AWK-22](https://linear.app/awkale/issue/AWK-22/decide-the-visual-direction),
which is **closed**. This branch exists so the artifact behind a resolved decision
is not lost; it is **never merged to `master`**.

Delete the branch once you are confident the decision needs no re-litigating. The
validated outcome already lives on `master`, in `app/tokens.css` and
`docs/adr/0004-design-system-and-tokens.md`.

## What it is

Three radically different visual directions over six real surfaces, switchable via
`?variant=` and a floating bottom bar (← → or arrow keys).

| | Structure | Neutral | Accent | Display |
| --- | --- | --- | --- | --- |
| **A — Ember** | expressive, editorial | sand | bespoke `#E05822` ramp | Fraunces |
| **B — Archive** | dense catalogue | slate | blue | Inter |
| **C — Programme** | printed concert programme | sand | bronze | Newsreader |

**Alex chose B's structure with A's typeface**, and left the remaining values to be
authored in `app/tokens.css` rather than fixed in an ADR.

## Looking at it

```bash
python3 -m http.server 8747        # from this directory
```

Then `http://localhost:8747/awk22-visual-direction.html?variant=A`

Open in a real browser — it needs URL params and `localStorage`. Fonts are embedded
as woff2 data URIs, so it renders faithfully offline. Direction A can load
`harfang-pro` from the old Typekit kit for evaluation, which is the one thing that
needs network.

## Rebuilding

```bash
python3 parse.py     # participation-checklist.md -> concerts.json
python3 build.py     # -> awk22-visual-direction.html
node shoot.mjs       # -> shots/  (needs a local Chrome)
```

`parse.py` reads `docs/archive/participation-checklist.md` and `build.py` reads
`scripts/contentful/bso-graph.json` — both by absolute path, pinned to
`/Users/akale/Sites/awkale.github.io` where they lived at the time. **Those paths
are now wrong**: both files moved to this repo on 2026-08-03. Fix the two constants
before rerunning, or don't rerun — the built HTML is checked in.

## What it found, beyond the direction

Two things that hold regardless of which direction won, both recorded on the ticket
and the map:

**The concert programme must render the arranger.** 2019-12-15 carries two distinct
`work` records both titled *The Nutcracker Suite* — Tchaikovsky's own, and one whose
composer is the contaminated record `Tchaikovsky, Pyotr Ilyich (arr. by Ellington)`.
After AWK-15's merge both read plain Tchaikovsky, so the byline is the only thing
separating the two lines. No ADR required this. I shipped the bug first: the initial
join keyed on title, so both lines claimed Ellington.

**Independent third reconciliation of 121 / 322 / 147**, agreeing with AWK-19 and
AWK-17. Two traps on the way: the checklist writes conductor and orchestra as `—` on
2007-12-16, so a header regex requiring them silently drops that concert (121→120);
and it renders composers **surname-only**, collapsing the four Strausses and hiding
ADR-0008's particle relocation, so an A–Z index has to be built from composer
records rather than from the checklist (144→147).

## Contents

- `awk22-visual-direction.html` — the prototype, self-contained, 624 KB
- `build.py` · `parse.py` — generators
- `shoot.mjs` · `shoot2.mjs` — screenshot drivers
- `concerts.json` · `ember-ramp.json` · `radix/` · `fonts/embedded.json` — build inputs
- `shots/` — 16 stills: the three directions, plus the token specimen from the
  scaffold that followed
