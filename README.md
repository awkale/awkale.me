# awkale.me

Personal site: design and development work as the primary focus, an indexed
history of orchestral performances as a secondary section. Content lives in
Contentful; the site is prerendered at build time.

**This is a rough setup, not a finished design.** It exists so the visual design
can be done directly in code rather than specified in prose. The token
architecture and the page structures are settled; the values are not.

## What is decided, and where

The spec lives in `docs/adr/` — **eight records**, moved here from the repo this
replaces (`awkale/awkale.github.io`) so they are not stranded when it is archived.
Tracked in Linear as [AWK-5][map]. The ones that bind this scaffold:

| Record | Binds |
| --- | --- |
| ADR-0001 | URL structure. Two peer sections, `/projects` and `/concerts`. `/music` permanently reserved. Trailing slashes are canonical. |
| ADR-0002 | Netlify, React Router `ssr: false` + `prerender`, pinned 7.18.x. Apex stays on Namecheap DNS. |
| ADR-0003 | `project` + `imageGroup` content model. Optional `body`: empty means index-only. |
| ADR-0004 | **The token architecture this scaffold implements.** Three layers, `typeset` in two presets, self-hosted fonts, three colour modes. |
| ADR-0005 | An arrangement is a distinct `work`; the arranger is a reused `composer` link. |
| ADR-0006 | Participation. `attended` + `satOut`; the page set is what Alex played. Conductor and hall are the only filters. |
| ADR-0007 | Period and form replace `genre`. Filters, never routes. |
| ADR-0008 | Slugs stored in Contentful. Nobiliary particles relocated, honorifics stripped. |

[AWK-22][awk22] settled the visual direction as: **direction B's structure,
direction A's typeface, and the remaining values authored here rather than
locked in an ADR.** That is why so much of `app/tokens.css` is marked
`← YOURS`.

## Layout

```
app/
  tokens.css      ← THE FILE YOU DESIGN IN. Plain CSS, no build step.
  app.css            Tailwind entry: layer 3 binding, @font-face, base.
  root.tsx           The blocking inline theme script lives here.
  lib/mode.ts        light | dark | system. Read the comments before touching.
  components/        site-header, mode-toggle
  routes/            home · projects · project · concerts · concert · work · composers
  data/sample.ts     Placeholder. Delete when the CDA is wired.
preview/
  tokens.html     ← Specimen. Open it in a browser, no toolchain needed.
public/fonts/        Self-hosted woff2 (Fraunces, Inter, JetBrains Mono).
```

## Designing

Open `preview/tokens.html` in a browser. It loads `app/tokens.css` **directly**,
so it cannot drift from the app: edit the CSS, refresh, see it. It shows both
12-step ramps in light and dark, every semantic token, the two `typeset` presets
at real paragraph length, the concert table at real density, and the A–Z index
with live `:visited` links.

Three things in there are load-bearing and will bite if changed casually:

- **Radix scales are self-swapping.** `--sand-1` is the light value under
  `:root` and the dark value under `.dark`, *under the same variable name*. That
  is the whole reason layer 2 is authored once instead of once per mode. Keep
  importing scales in light/dark pairs.
- **A theme remaps `--accent-*` and nothing else.** Reaching past it into layer 2
  defeats the layering, and a second theme stops being one block of five lines.
- **`:visited` can only be expressed in colour.** Browsers restrict it to colour
  properties and lie in `getComputedStyle`. Weight, underline and marker changes
  silently fail. The specimen has three candidate values to compare.

## Running it

```bash
bun install
bun run build      # 35 prerendered pages -> build/client
bun run dev
```

The build works. Do **not** run `bun create react-router` in this directory — the
toolchain is already wired, and that command's overwrite prompt is all-or-nothing:
continuing replaces `.gitignore`, `app/app.css`, `app/root.tsx` and every route
file at once.

Version note: this ships **React Router 8.3.0**, not the 7.18.x the research
document originally pinned. See the superseded note in
`docs/research/0001-static-rendering-layer.md` for what was re-verified on v8 and
what was not.

## shadcn is deliberately not initialised

ADR-0004 says `shadcn init` runs so `components.json`, the `@theme inline` block
and `cn()` exist. **Don't.** Two things changed after that record was written.

**`init` would clobber the token layers.** It rewrites `app.css` with its own
`:root` token block and `@theme inline`, which is exactly where layers 2 and 3
live. The block it would generate is the thing this repo already hand-authors over
Radix primitives — that third layer is the whole architecture.

**Nothing here needs it.** Grep the tree: no `cn()`, no `@/components/ui`, no
Radix or React Aria primitive anywhere. The entire interactive inventory is
`app/components/mode-toggle.tsx`. ADR-0006 shrank it further by cutting soloist and
season as filters, so what remains is a theme control, facet chips and an A–Z jump
— all built as plain JSX and Tailwind classes.

**`typeset` is not installable.** `shadcn add typeset` 404s; the registry lists only
the `new-york` and `default` styles and resolves no `typeset` item under either.
ADR-0004 called typeset its one early bet and named the mitigation — the repo owns
the CSS outright. It does: the `.typeset-*` rules are hand-written in `app/app.css`
at zero specificity via `:where()`, which is the precise property
`@tailwindcss/typography` lacks and the reason it wasn't chosen.

If a component genuinely earns its place later — a combobox for archive search, say,
and only if [AWK-26](https://linear.app/awkale/issue/AWK-26) decides search happens
— add it **without** `init`:

```bash
bunx shadcn@latest init    # in a THROWAWAY directory, never here
```

then copy the component source across and point it at this repo's tokens. `cn()` is
five lines of `clsx` + `tailwind-merge` if it turns out to be wanted.

Note also that the newer CLI asks for a component library (Radix UI / React Aria /
Base UI) and a preset. ADR-0004's layering assumes shadcn's **Radix-based** contract;
picking React Aria, or a preset like Lyra, brings a competing palette that fights
`tokens.css`. That is an ADR-0004 amendment, not a prompt to answer quickly.

Beyond that, and tracked outside the map as build work: creating the `project`
and `imageGroup` content types, the composer merge, seeding participation, the
period/form fields, the re-import after the `shares` fix, redirect thirteen, and
wiring the CI page assertion to the CDA. **None of the decided schema exists in
Contentful yet**, which is why `app/data/sample.ts` exists.

## Figures

121 concerts · 322 works · 147 composers · 16 conductors · 5 halls. Six concerts
missed, four items sat out. Independently reconciled three times — see
`app/data/sample.ts` for how, and what collapses if you derive them the obvious
way instead.

[map]: https://linear.app/awkale/issue/AWK-5
[awk22]: https://linear.app/awkale/issue/AWK-22
