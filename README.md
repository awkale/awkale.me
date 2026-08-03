# awkale.me

Personal site: design and development work as the primary focus, an indexed
history of orchestral performances as a secondary section. Content lives in
Contentful; the site is prerendered at build time.

**This is a rough setup, not a finished design.** It exists so the visual design
can be done directly in code rather than specified in prose. The token
architecture and the page structures are settled; the values are not.

## What is decided, and where

The spec lives in the repo this replaces — `awkale/awkale.github.io`, under
`docs/adr/`. Nine records, tracked in Linear as [AWK-5][map]. The ones that bind
this scaffold:

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

## Not yet wired

No dependencies are installed and there is no build — this is scaffolding, so
the `.tsx` files will not typecheck until the toolchain exists. To make it
runnable:

```bash
bun create react-router@7.18 .     # answer no to overwriting app/
bun add @radix-ui/colors
bunx shadcn@latest init            # cssVariables: true
bunx shadcn@latest add typeset     # replaces the stub rules in app.css
```

Then swap the two CDN `@import`s at the top of `app/tokens.css` for the local
package:

```css
@import "@radix-ui/colors/sand.css";
@import "@radix-ui/colors/sand-dark.css";
```

The CDN form is only there so `preview/tokens.html` works with nothing
installed.

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
