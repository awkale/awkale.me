---
status: accepted
---

# Design system and token architecture for awkale.me

The site is styled with Tailwind CSS v4, using shadcn/ui as a component *source*
rather than a framework, over a three-layer token architecture: Radix Colors
supplies the primitives, shadcn's semantic contract sits above them, and
`@theme inline` binds that contract into Tailwind's utility namespace. Colour
modes are a three-state light/dark/system choice applied by a blocking inline
script. Typography is shadcn's `typeset`, in two named presets — one for
long-form prose, one for the archive's dense reference data.

This record settles **architecture only**. The palette values, the typefaces and
the tonal ramps are deliberately not decided here; they belong to visual
direction, which is
[AWK-22](https://linear.app/awkale/issue/AWK-22/decide-the-visual-direction).

> **Amended 2026-08-03.** AWK-22 has resolved, and it did not fill these slots
> with values a record could hold. It settled the typefaces and the structure,
> and left the palette, ramps, `typeset` numbers, widths and visited colour to be
> **authored in `app/tokens.css`** instead. See
> [the amendment](#amendment--awk-22-2026-08-03) at the foot of this record;
> the inline references to "AWK-22 sets them" below are corrected in place.

## Why architecture and values were separated

[AWK-14](https://linear.app/awkale/issue/AWK-14/decide-the-design-system-and-token-approach)
as written reached into both, and the map's fog separately listed visual
direction as unresolved. Those overlap: a typography scale and a light/dark
palette *are* visual direction.

They were split because the two want different instruments. Architecture — how
many token layers exist, where values live, how a mode is activated, what is
themeable — is settled by reasoning, and this was a `wayfinder:grilling` ticket.
Values want something to react to, which is a prototype. Forcing hue choices
through conversation is the wrong tool, and the map already anticipated a
possible prototype pass.

The split has a cost worth stating: this record does not leave anyone able to
build a finished-looking page, and AWK-22 becomes a real dependency before the
spec can be called locked.

## shadcn/ui is a component source, not a framework

"React + Vite + shadcn/ui" entered
[ADR-0002](0002-hosting-and-deploy-pipeline.md)'s research as a fixed premise —
`docs/research/0001-static-rendering-layer.md` lists it among inputs "not
relitigated here," and shadcn compatibility was ranking axis 4 in choosing the
rendering layer. So it is decided-by-premise, and dropping it would partly
invalidate a closed decision.

What is decided here is *how much* of it is in play. `shadcn init` runs, so
`components.json`, the `@theme inline` block and the `cn()` helper exist, with
`tailwind.cssVariables: true` — components reach for `bg-background` and
`text-muted-foreground` rather than baked `bg-white dark:bg-slate-950`
utilities. Individual components are then added only as a page needs one.
Nothing is installed speculatively.

> **Amended 2026-08-03, twice.** First: `shadcn init` does not run; the
> `@theme inline` block and token contract are hand-authored — see
> [that amendment](#amendment--shadcn-is-not-initialised-2026-08-03).
> Then, more fundamentally: **shadcn is not the component source at all.**
> Components come from `react-aria-components` directly and are styled in plain CSS
> keyed on data attributes, with Tailwind kept for layout only. See
> [the second amendment](#amendment--react-aria-plus-plain-css-2026-08-03).

The interactive inventory is small and worth recording, because it is what
justifies this being a component *source*. [ADR-0001](0001-url-structure.md)
made soloist, conductor, hall and genre **facets on the indexes rather
than routes** — the decision that keeps ~650 pages from becoming ~870 — which
means facet filtering happens client-side on a prerendered page. Add a theme
control, an A–Z jump, and possibly archive search, and that is close to the
whole of it. The remaining ~600 pages are typography, tables and links.

[ADR-0006](0006-performance-history-content-model.md) narrowed this further after
the fact: **season is no longer a surface at all**, and of the remaining facets
only **conductor and hall ship as filters** — soloist and ensemble became
display-only credits, since 256 of the 404 program-item occasions carry no
soloist. That shrinks the interactive inventory rather than growing it, so the
reasoning above holds with fewer controls to build. The page figures are the
in-scope archive's; the published site is smaller and its size is a rule rather
than a number.

The accepted cost is that shadcn's token contract is tuned for app chrome, so a
reading-and-reference site inherits a `--sidebar-*` group it will never use, and
gaps it must fill itself. Those gaps are enumerated below.

## Three token layers

shadcn ships two layers: semantic custom properties holding literal values, and
an `@theme inline` block binding them to Tailwind. A third, primitive layer is
inserted beneath.

```css
@import "tailwindcss";
@import "@radix-ui/colors/slate.css";
@import "@radix-ui/colors/slate-dark.css";
@import "@radix-ui/colors/orange.css";
@import "@radix-ui/colors/orange-dark.css";

@custom-variant dark (&:is(.dark *));

/* layer 1 — theme: which hue fills the accent role. one block per theme. */
[data-theme="ember"] {
  --accent-9: var(--orange-9);
  --accent-11: var(--orange-11);
  --accent-12: var(--orange-12);
}

/* layer 2 — semantic: authored once, never duplicated per mode. */
:root {
  --background: var(--slate-1);
  --card: var(--slate-2);
  --muted: var(--slate-3);
  --border: var(--slate-6);
  --ring: var(--slate-7);
  --primary: var(--accent-9);
  --muted-foreground: var(--slate-11);
  --foreground: var(--slate-12);
}

/* layer 3 — Tailwind binding. */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  /* … */
}
```

Two properties of Radix Colors are doing the work.

**Its scales are self-swapping.** `--slate-1` resolves to the light-mode value
under `:root` and the dark-mode value under `.dark`, *under the same variable
name*. The mode axis is therefore handled entirely inside the primitive layer,
and the semantic layer is authored **once**. Without this, supporting multiple
light/dark theme pairs needs a block for every theme × mode combination — three
themes meaning six blocks of thirty-odd tokens kept in sympathy by hand, which
is where multi-theme systems rot. With it, the count is N rather than 2N.

**Its twelve steps have fixed role meanings**, and those map onto shadcn's
semantic names almost mechanically: step 1 app background, 2 subtle background,
3 component background, 6 subtle border, 7 border and focus ring, 9 solid, 11
low-contrast text, 12 high-contrast text. So the primitive-to-semantic mapping
is bookkeeping rather than taste — the right thing to be doing in a record that
deferred taste.

Its dark-mode convention is also already a `.dark` class, which is what the mode
decision below independently requires, so nothing needs reconciling.

The primitive layer is additionally the hedge that makes the deferral cheap.
Radix's custom-scale generator emits the same twelve-step shape, so replacing
stock `orange` with a bespoke ramp in AWK-22 is a **primitive-layer-only**
change: the semantic layer and every component above it are untouched. Had the
architecture stopped at two layers, AWK-22 would have had to retune every
semantic token in both `:root` and `.dark`, where keeping light and dark in
sympathy is the genuinely hard part.

## Extensions to the semantic contract

Auditing what this site renders against what shadcn ships, most apparent gaps
close on their own — tables, facet chips and captions are covered by `--muted`,
`--secondary` and `--muted-foreground` over Radix steps. Three do not.

```css
:root {
  /* --- extensions: not part of shadcn's contract --- */
  --link: var(--accent-11);
  --link-hover: var(--accent-12);
  --link-visited: var(--n-11);       /* distinct value; authored in tokens.css */
  --measure: 68ch;
  --width-content: 42rem;
  --width-wide: 72rem;
}
```

**`--link` is shadcn's real omission.** It has no link token at all, because
apps navigate by buttons. This site is the opposite: a cross-reference engine
where every concert page links its works, every work links its composer and back
to its concerts, and the A–Z indexes are nothing but links. Link colour is a
primary visual element here.

**`--measure`** is the reading column for long-form RichText; `typeset` does not
set a max-width. **`--width-content` and `--width-wide`** give `imageGroup`'s
`fullWidth` layout something to mean.

These live in the same `:root` block behind a comment fence rather than under an
`--awk-` prefix, which gets ugly quickly. This record is the authoritative list
of what is an extension versus what is shadcn's contract — the distinction
matters the first time a component is added and you need to know which tokens
may safely be redefined.

The approach is minimal-and-grow. Enumerating every token a content site might
want — figure, blockquote, kbd, zebra, chip-selected — was rejected because most
would be invented against imagined pages, and an unused token is worse than a
missing one because it looks like something depends on it.

## Colour modes are three-state, applied before paint

Modes are `light`, `dark` and `system`, with `system` a real selectable value
rather than merely an initial condition. `localStorage` carries `theme` and
`mode` as two values.

The mechanism is forced by
[ADR-0002](0002-hosting-and-deploy-pipeline.md)'s choice of `ssr: false` plus
`prerender`. Every page is built once and served identically; **nothing resolves
per-request.** There is no cookie to read, no server to stamp a class. So a
theme driven by `localStorage` can only be applied by JavaScript, and unless
that JavaScript runs before first paint there is a flash of the wrong theme on
every one of ~600 pages.

The resolution is a **blocking inline `<script>` in the root route's `<head>`**,
emitted via `dangerouslySetInnerHTML` so prerendering inlines it into every
page. It reads the stored values, falls back to `prefers-color-scheme` when mode
is `system`, and stamps `data-theme` plus an explicit `light`/`dark` class on
`<html>`. Because the script always writes an explicit class, the CSS needs only
the class selector and never a media query — one selector rather than two
overlapping ones.

Three consequences follow, each of which will otherwise be rediscovered
painfully:

- **React must never render a theme class onto `<html>`.** The script owns that
  attribute exclusively. If React also renders it, every page logs a hydration
  mismatch.
- **The mode control cannot know its own state during prerender**, since the
  prerendered HTML is identical for all visitors. It renders a neutral state and
  syncs on mount, or reads the class off the DOM. Never from a build-time value.
- **`system` requires a live `matchMedia` change listener** that re-stamps when
  the OS flips mid-session. A two-state toggle would not have needed this; a
  real `system` value does.

`prefers-color-scheme` alone was the simpler option and was preferred initially:
zero JS, zero flash, no `localStorage`, no inline script. It was rejected
because it offers no override — a visitor whose OS is dark cannot force light —
and the archive at `/concerts` is primarily a tool for its author, who should be
able to choose. A single theme with no dark mode was also considered and
rejected; the two-layer-plus-primitives architecture makes a second mode nearly
free, whereas adding one later means authoring a whole palette.

## Typography is `typeset`, in two presets

Prose is styled by shadcn's `typeset`: one class on a container styles every
nested element, driven by CSS variables.

```css
/* case-study bodies: serif, larger, roomy */
.typeset-reading {
  --typeset-font-body: var(--font-serif);
  --typeset-font-heading: var(--font-serif);
  --typeset-size: 18px;
  --typeset-leading: 1.9;
  --typeset-flow: 2em;
}

/* archive reference data: sans, tighter */
.typeset-compact {
  --typeset-font-body: var(--font-sans);
  --typeset-font-heading: var(--font-sans);
  --typeset-size: 14px;
  --typeset-leading: 1.6;
  --typeset-flow: 1em;
}
```

Values above are placeholders. AWK-22 resolved that they are **authored in
`app/tokens.css` rather than fixed here** — see the amendment below. The two
presets and the division of labour between them are architecture and do stand.

Two presets rather than one because the site has two genuinely different
typographic needs — long-form case-study prose, and 348 work-listing rows of
dense reference data — and `typeset` expresses that as two classes over one
system rather than two systems.

**The division of labour between scales:** `typeset` owns flowing prose,
Tailwind's `--text-*` owns UI chrome — cards, nav, tables, badges. Two scales
with a clear boundary rather than overlap. Tailwind's `--text-*` values are
overridden in place rather than a parallel `--size-*` namespace being invented,
so every added shadcn component inherits the site's scale with no edits; two
competing scales drifting apart is the failure mode avoided.

Steps are **fixed, not fluid**, for body and UI text; fluid `clamp()` is
permitted only for display sizes. Fluid body type fights two things this site
specifically has: a `ch`-based `--measure`, where sliding both the column width
and the text size means the characters-per-line you tuned stops holding; and
dense tables, where unpredictable size makes column widths unpredictable. In
Tailwind v4 unused theme values are not emitted, so pruning the number of steps
buys nothing and was not attempted.

`typeset` styles elements through `@layer components` and `:where()`, so its
specificity is effectively zero and any Tailwind utility overrides it without
`!important`. That is the specific failing of `@tailwindcss/typography`, whose
`prose` class has high specificity and requires `prose-*` modifiers or `!`
escapes to override — the reason it was not chosen.

**`typeset` is the one early bet in this record, and it is deliberate.** It
shipped in shadcn's 2026-07 changelog, weeks before this decision, and the
rendering-layer research pinned React Router to 7.18.x specifically to avoid
riding new surface area. The mitigation is that `typeset`
is generated CSS which the repo owns outright: no runtime, no API, nothing to
break on a minor release. If it disappoints, the file is edited. That is a far
smaller exposure than a framework pin — and that reasoning has since been
vindicated twice over. The pin was *dropped* on 2026-08-03 (the build ships React
Router 8.3.0, see [ADR-0009](0009-static-rendering-layer.md)), and `typeset`
turned out **not to be installable at all**: `shadcn add typeset` 404s against the
registry, which lists only the `new-york` and `default` styles and resolves no
`typeset` item under any of them. So the fallback this record named was needed
immediately. The `.typeset-*` rules now live hand-written in `app/app.css`, at zero
specificity via `:where()`, which is precisely the property `@tailwindcss/typography`
lacks. The repo owning the CSS outright was the whole mitigation, and it held —
which is why the instinct was overridden
here and not there. `@tailwindcss/typography` remains the fallback, and
hand-rolling was rejected as rebuilding what `typeset` gives free — vertical
rhythm across headings, lists, blockquotes and figures is fiddly to get right.

## Fonts are self-hosted

Faces are declared as theme tokens and served from the site's own origin as
woff2, with `font-display: swap` and a `<link rel="preload">` for the one or two
used above the fold.

```css
@theme {
  --font-sans: "…", ui-sans-serif, system-ui, sans-serif;
  --font-serif: "…", ui-serif, Georgia, serif;
  --font-mono: "…", ui-monospace, monospace;
}
```

These are the names `typeset` reaches for via `--typeset-font-body` and
`--typeset-font-heading`, so the two systems meet without an adapter.

The site being replaced loads Adobe Fonts — `_includes/head.html` carries
`//use.typekit.net/tkq1har.js` for `harfang-pro`. That is not carried forward.
It costs an extra DNS and TLS handshake before fonts begin loading, adds a
blocking third-party script to all ~600 pages, and makes the site's typography
depend on a live subscription. **That subscription has lapsed**; access appears
to persist, which is the worst shape of dependency — it works today, will stop
at an unknown date, and fails silently with no deploy on the author's side. On a
site that only rebuilds when content changes, that could go unnoticed for
months.

Two constraints on AWK-22 follow. **The shipped face must be licensable for
self-hosting**, which does not rule out `harfang-pro` — Coppers & Brasses sell
webfont licences directly — but makes carrying it forward a purchase.
And **Adobe Fonts access does not confer self-hosting rights**; having a face
through Adobe cannot become downloading and serving it. Those are different
licences and the paths do not blend. Adobe Fonts may still be used to *evaluate*
during AWK-22, which is why the entitlement is worth noting rather than ignoring.

Self-hosted fonts draw Netlify **bandwidth**, which under the credit-based
reading that
[AWK-16](https://linear.app/awkale/issue/AWK-16/confirm-what-netlify-actually-meters-and-what-throttles-deploys)
is chasing comes from the same pool as deploys. Font files are trivial beside
the eight screenshots, so this is noise — but it is the second decision AWK-16's
answer touches.

## Spacing

Tailwind v4 derives the entire spacing scale from one variable, so there is no
scale to enumerate:

```css
@theme { --spacing: 0.25rem; }  /* p-4 → calc(var(--spacing) * 4) */

:root {
  --gutter: 1.5rem;        /* page edge padding */
  --space-section: 4rem;   /* between major sections */
}
```

The 4px base is **left unchanged**, which matters more than it appears: every
shadcn component is dimensioned against it, so altering it silently re-scales
all of them at once and turns a spacing decision into debugging a button's
padding.

The two named tokens earn their place by recurring on every page, where a `px-6`
habit would drift. Nothing else is named; naming spacing used once is ceremony.

**No baseline grid.** They read well in specimens and fail against
variable-height images, tables and embedded `imageGroup` blocks — all of which
this site has. `--typeset-flow` provides rhythm where rhythm actually reads,
which is flowing prose.

`--radius` and its derived `--radius-sm`/`md`/`lg`/`xl` are inherited from
shadcn unchanged, so corner rounding is already a single knob.

## Components handed over by ADR-0003

### One `ProjectCard`, varying on data presence

```tsx
<article className="relative …">
  {coverImage ? <img … /> : null}

  <h3>
    {hasBody
      ? <Link to={`/projects/${slug}`} className="after:absolute after:inset-0">
          {title}
        </Link>
      : title}
  </h3>

  <p>{summary}</p>

  {liveUrl && <a href={liveUrl} className="relative z-10">Live</a>}
</article>
```

**One component rather than two**, because
[ADR-0003](0003-portfolio-content-model.md)'s central property is that a stub
graduates to a case study by filling a field — no migration, no new entry, no
URL change. A component swap at that boundary would reintroduce exactly the seam
the content model removed.

**No placeholder imagery for the no-image case.** `coverImage` is optional, so
the index must render a card without one and not look broken. A hashed gradient
or an initials block *announces* a missing image and reads as broken tooling;
a card whose title and summary expand into the space the image would have
occupied reads as intentional. At single-digit project counts a mixed grid is
fine provided the no-image card owns its space rather than apologising for it.

**The `after:absolute after:inset-0` overlay is what makes the card clickable,
not a styling flourish.**
Making the whole card a link while it also contains `liveUrl` and `repoUrl`
links would produce **nested anchors — invalid HTML that breaks keyboard and
screen-reader navigation.** So the real anchor is the title alone, a
pseudo-element stretches its hit area across the card, and sibling links sit
above it with `relative z-10`. The terminal variant simply omits the overlay,
which makes ADR-0003's "a card that looks clickable but is not is worse than an
obviously flat one" structural rather than a matter of paint.

### `imageGroup` stacks on narrow viewports

`sideBySide` becomes `grid gap-4 md:grid-cols-2`: one column on narrow
viewports, two when wide. `grid` becomes `md:grid-cols-2 lg:grid-cols-3` for the
wizard's five-up. `fullWidth` breaks out to `--width-wide` while prose stays at
`--measure`. `alt` comes from each Asset's `title` and the caption from its
`description`, read from the asset rather than passed as props.

**The component must tolerate any number of images, permanently.** ADR-0003
specified `images` as an array with `layout` a separate symbol, and Contentful
can set min and max items on an array but **cannot make that constraint
conditional on another field's value.** So `sideBySide` carrying five images is
authorable and always will be. This is why a draggable before/after slider and a
tab-between-states control were both rejected: each assumes exactly two images
of matched dimensions, neither of which the model guarantees.

A scroll-snap carousel on narrow viewports was considered and rejected in favour
of stacking. It would have kept each image at readable size in the same viewport
position — the property that makes differences easy to spot — where stacking
loses simultaneity, which for the Cision sidebar before/after is the item's
entire content. Stacking was preferred for simplicity, accepting that
degradation. The available mitigation costs nothing architecturally: the assets'
`description` fields reading "Before" and "After" keep stacked images
interpretable, and the model already carries them.

## Consequences

**Visual direction is now a hard dependency of the spec.** This record cannot
produce a finished page on its own. AWK-22 must resolve before the map's
destination — "nothing left to decide before a build session" — is true.
*(Resolved 2026-08-03. It discharged this differently than expected: the values
were never written into a record at all. See the amendment.)*

**Every page depends on the inline theme script.** It is not an
enhancement that can be dropped; without it the site flashes the wrong theme on
all ~600 pages. Anything that changes the root route's `<head>` must preserve it.

**`:visited` must be expressed in colour alone.** Browsers restrict `:visited`
styling to colour properties — `color`, `background-color`, `border-color`,
outline and column-rule colour, SVG fill and stroke — and lie in
`getComputedStyle`, to prevent history sniffing. Distinct visited styling was
wanted because the archive is a tool whose author benefits from seeing which
composers he has already opened. Any direction that tries to carry the
distinction by weight, underline or marker will silently fail.

**Adding a theme means one block, not two.** The `[data-theme]` remapping of
`--accent-*` is the only place a new theme is authored; light and dark fall out
of Radix. This is the payoff for the third layer and should be preserved — a
theme that reaches past `--accent-*` into semantic tokens directly defeats it.

**Three hops to debug a colour.** `bg-primary` → `--color-primary` → `--primary`
→ `--accent-9` → `--orange-9`. Accepted as the cost of the layering, and the
reason this record documents the mapping explicitly.

**Radix's notation is not shadcn's.** Radix ships hex and P3; shadcn v4 ships
OKLCH. The palette is therefore not notationally uniform with anything
hand-authored later. Harmless, but surprising on first reading.

**Analytics remains undecided.** `_includes/scripts.html` ships Google
Universal Analytics `UA-171213-13` — a property type that stopped processing
data in 2023, so it has collected nothing for three years — and Clicky
`100850507`. Neither has a ticket, a fog entry, or an ADR. Recorded here because
it was found while reading the existing site's `<head>`, and it is a genuine gap
in a map whose destination is that nothing is left to decide.

> **Resolved 2026-08-03 by [ADR-0010](0010-no-analytics.md).** The answer is
> **none** — no analytics, and no third-party client-side beacons at all,
> enforced by a CSP rather than merely stated. Two details above are wrong and
> corrected there: the tags were at the **end of `<body>`**, not in `<head>`
> (`_layouts/default.html:19`); and Universal Analytics is **deleted**, not
> merely dormant, so there was never any history to export. One consequence lands
> back on this record: the CSP hashes this ADR's blocking inline theme script, so
> changing that script invalidates the policy.

## Amendment — AWK-22 (2026-08-03)

[AWK-22](https://linear.app/awkale/issue/AWK-22/decide-the-visual-direction)
resolved after a prototype pass over three directions. It did **not** fill this
record's empty slots. Two of its eight items are settled here; the rest moved out
of the spec entirely.

### Settled, and binding

**Typefaces.** `--font-display` and `--font-serif` are **Fraunces**,
`--font-sans` is **Inter**, `--font-mono` is **JetBrains Mono**. All three are
**SIL OFL 1.1**, so self-hosting is permitted outright.

That **discharges the two constraints this record placed on AWK-22**. The
shipped faces are licensable for self-hosting, and `harfang-pro` **stays
unbought** — the Coppers & Brasses purchase is not needed, and Adobe Fonts is out
of the picture rather than merely unused. The old Typekit kit (`tkq1har.js`) does
still serve, so harfang-pro remains available to *evaluate* if the display face is
ever revisited; that is the only reason to keep the entitlement in mind.

One consequence this record could not have anticipated: the shipped woff2 files
are **`U+0000-00FF` subsets**, and
[ADR-0007](0007-period-and-form-taxonomy.md)'s IMSLP pass restores diacritics
(`ř`, `á`, `ó`, `ë`) that fall **outside** that range. The subsets must be re-cut
before that pass ships, or restored names render in a fallback face. Recorded in
`docs/fonts.md`.

**The old site's identity splits.** The warmth carries forward — the accent ramp
is bespoke, generated to Radix's twelve-step shape from `#E05822` with step 9
exact — but the structure does not. The hue-cycling background and the anime.js
fireworks are **dropped**, not preserved as a decorative layer behind the tokens.

### Moved out of this record

The palette scales, the theme count, bespoke-versus-stock ramps, the `typeset`
preset numbers, `--measure` with the width pair, and the visited-link colour are
**authored in `app/tokens.css`**, each marked `← YOURS`. This record no longer
claims to be where they are decided.

That is a resolution rather than a deferral, and it is the third token layer doing
exactly what this record built it for: a palette or ramp change is
primitive-layer-only, so there is no benefit to freezing a hex value in prose
first. Forcing hue and leading choices through a written record was the wrong
instrument — the same reasoning that split these off AWK-14 to begin with.

The practical consequence: **`app/tokens.css` is now a spec artifact**, not merely
an implementation of one. It is deliberately plain CSS with no build step, which
is what lets `preview/tokens.html` load it directly, so the specimen cannot drift
from the app.

### A detail worth keeping

Layer 2 aliases only **eight of the twelve** neutral steps and **five of the
twelve** accent steps — the ones it actually consumes. The specimen originally
rendered ramps through those aliases, so the unaliased steps painted as gaps and
read as a bug. The fix was to render the underlying scales and *outline* the
aliased ones, rather than to alias all twenty-four: this record's rule is that an
unused token is worse than a missing one, because it looks like something depends
on it.

## Amendment — shadcn is not initialised (2026-08-03)

`shadcn init` does not run, and no shadcn component is installed. The `@theme
inline` block, the semantic contract and the `typeset` rules are hand-authored.
Everything else in this record stands: three token layers, Radix Colors
primitives, two typeset presets, three colour modes, self-hosted fonts.

This reverses one sentence above, and it reverses it on this record's own logic
rather than against it.

### `init` would overwrite the third layer

`shadcn init` writes `app.css`, including its own `:root` token block and its own
`@theme inline`. That is precisely where layers 2 and 3 live. The generated block
holds literal values, which is the two-layer shape this record inserted a primitive
layer *beneath* in order to escape. Running `init` over it would replace the
architecture with the thing the architecture was chosen to avoid, and the loss
would be silent — the file still compiles, the site still renders, and the mode
axis quietly stops being handled inside the primitive layer.

### Nothing needed it

The interactive inventory this record sized turned out to be smaller still.
[ADR-0006](0006-performance-history-content-model.md) cut soloist and season as
filters, leaving conductor and hall. What is actually built is a theme control,
facet chips, an A–Z jump and a set of tables — all plain JSX over Tailwind
utilities that read this record's semantic tokens.

Measured rather than asserted: `app/` contains no `cn()`, no `@/components/ui`
import, and no Radix or React Aria primitive. The whole client-interactive surface
is `app/components/mode-toggle.tsx`. `cn()` is five lines of `clsx` plus
`tailwind-merge` if it is ever wanted.

So `init` offered nothing this repo lacked, at the cost of the one file it could not
afford to have rewritten.

### `typeset` is announced but unobtainable

This record was not wrong that `typeset` shipped — shadcn's changelog announces it
under July 2026 as *"shadcn/typeset: a styling system for HTML and rendered
markdown, in one CSS file."* It cannot be obtained. Checked on 2026-08-03, and
worth listing so nobody repeats it:

| Route | Result |
| --- | --- |
| `shadcn add typeset` | 404. The CLI requests a `new-york-v4` style that is not in the styles index |
| `/r/styles/{new-york,default}/typeset.json` | 404, while `button`/`card`/`badge`/`table` all 200 — the path pattern works |
| `/r/index.json` | 62 items, none named `typeset`, and no typography or prose item at all |
| `shadcn search @shadcn --query typeset` | "No items found" |
| `/docs/components/typeset` | 404 |
| `shadcn` npm package v4.16.1 | ships `dist/tailwind.css` with **zero** `typeset` references |
| presets | `shadcn preset` only decodes and resolves theme codes; not a CSS source |

So it is announced-then-unshipped, or withdrawn, rather than misnamed. That
distinction matters for whoever revisits: it may reappear, and the search terms
above are the ones that will find it when it does.

This record called `typeset` "the one early bet" and named the mitigation: it is
generated CSS the repo owns outright, with no runtime and no API, so if it
disappoints the file is edited. That mitigation was needed immediately rather than
eventually. The `.typeset-*` rules are hand-written in `app/app.css` through
`:where()`, holding specificity at zero so any Tailwind utility overrides them
without `!important` — the exact property `@tailwindcss/typography`'s `prose` lacks,
and the stated reason it was not chosen. The fallback named here was therefore never
needed either: the hand-rolled version *is* the shape this record wanted.

The bet was correctly identified as a bet, and correctly hedged. It simply lost
sooner than expected.

### A trap left for whoever reaches for the CLI

The current `shadcn` CLI asks for a **component library** — Radix UI, React Aria or
Base UI — and a **preset**. This record's layering assumes shadcn's *Radix-based*
contract. Choosing React Aria changes the primitive foundation, and a preset such
as `Lyra` ships a competing palette that fights `app/tokens.css` directly.

If a component ever earns its place — realistically only a combobox, and only if
[AWK-26](https://linear.app/awkale/issue/AWK-26) decides archive search happens —
run `init` in a throwaway directory, copy the component source across, and point it
at this repo's tokens. Never run it here.

## Amendment — React Aria plus plain CSS (2026-08-03)

**shadcn/ui is no longer the component source.** Components come from
`react-aria-components` directly, and are styled in **plain CSS keyed on data
attributes**, in a file beside each component. Tailwind is kept for **layout only** —
flex, grid, gap, max-width, padding in route files.

This reverses this record's opening sentence, not a detail of it. The token
architecture is untouched: three layers, Radix Colors primitives, self-swapping
scales, two `typeset` presets, three colour modes. What changes is what consumes
them.

### Why

The instruction was plain CSS and data attributes, "like waterfall-ui", with minimal
Tailwind. That system is the author's own, and reading it settles what the phrase
means concretely:

```css
/* waterfall-ui: src/button/button.css */
.btn                       { background-color: var(--btn-bg); }
.btn:hover:not(:disabled)  { background-color: var(--btn-bg-hover, var(--btn-bg)); }
.btn[data-variant='primary']      { --btn-bg: …; }
.toggle-btn[data-selected]        { --btn-bg: …; }
```

A semantic class *consumes* local component variables; data attributes and
pseudo-classes *set* them, with fallbacks so a state that defines nothing inherits
the resting value. `ToggleButton.tsx` supplies `base: 'btn toggle-btn'` and
`data-variant={variant}`, and nothing else.

Note waterfall-ui uses **both** idioms: component internals in CSS, and
`className="flex gap-4"` for layout. So "minimal Tailwind" is a split, not a
removal, and this record follows the same split.

**The combination is more coherent than what it replaces.** React Aria emits
`data-selected`, `data-hovered`, `data-pressed`, `data-focus-visible` and
`data-disabled` itself, so CSS keys straight off the component's real state with no
JavaScript deciding classes. shadcn's components express the same states as long
`cva` class strings — which is the same information, spent on utilities. Dropping
that layer removes `class-variance-authority` and roughly forty utilities per
component, and leaves the accessibility, which was the reason to want React Aria.

`clsx` and `tailwind-merge` stay for the layout classes; `cn()` is in
`app/lib/utils.ts`, hand-written.

### What this cost

`shadcn add button radio-group` had already generated two components. Both were
deleted along with `components.json`. They are recoverable in one command if this
is ever reversed, so the cost is small — but it was real work discarded, and the
sequencing is the lesson: the styling idiom should have been settled before pulling
components.

### The API correction that came free

shadcn's generated radio group used `Radio`, which **React Aria has deprecated** in
favour of `RadioField` + `RadioButton`. Building on the primitives directly surfaced
that immediately.

The two compose deliberately: `RadioField` carries the `value` and exposes only
`[data-selected]` and validity state; `RadioButton` is the visible control and
inherits the full interaction set — `[data-hovered]`, `[data-pressed]`,
`[data-focused]`, `[data-focus-visible]`, `[data-disabled]`. So **all styling keys
off the button, and the value lives on the field.** The field is `display: contents`
so segments remain flex children of the group.

### Two things worth knowing before writing more component CSS

**Selected must be restated after hovered.** `[data-selected]` and `[data-hovered]`
are independent, so a bare `[data-hovered]` rule later in the file steals the fill
from the active segment the moment a pointer crosses it. Every stateful component
here needs the `[data-selected][data-hovered]` pair.

**Prefer React Aria's `[data-hovered]` to `:hover`.** It excludes touch, and it does
not fire while disabled — so `:hover:not(:disabled)`, which waterfall-ui needs
because it styles native elements, is unnecessary here.

### Verified

`role="radiogroup"` on the mode control with three segments and a single tab stop;
facet chips are real `<button aria-pressed>` flipping `false` → `true`; clicking a
segment stamps `html.dark` and the selected segment resolves to `--primary-hover`
while the pointer remains over it, which is `[data-selected][data-hovered]` working.
Build and `tsc --noEmit` both clean.

### The naming trap this introduced

Ten tokens were added to layer 2 so the React Aria components resolve — `secondary`,
`accent`, `input`, `destructive`, `popover`, `card-foreground` and their foregrounds
— mapped onto the Radix primitives rather than taken as shadcn's literal oklch
values. A `red` scale was imported solely so `--destructive` points somewhere honest.

**`--accent` is shadcn's neutral hover surface. `--accent-9` … `--accent-12` is this
site's brand ramp.** They differ by one hyphen and mean unrelated things. `--accent`
must stay neutral or every hovered surface turns orange.
