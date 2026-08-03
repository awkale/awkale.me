---
status: accepted
---

# URL structure for awkale.me

The site has two peer sections: design/dev work at `/projects` and the
performance history at `/concerts`. Works are addressed canonically under their composer, at
`/concerts/composers/<composer>/works/<work>`; concerts are keyed by date, at
`/concerts/2008-12-13`. Only concerts, composers and works get pages — soloist,
conductor, hall and genre are facets on the indexes, which keeps roughly
650 prerendered pages from becoming roughly 870, and keeps genre's 33% coverage
gap off the URL surface entirely.

> **Superseded in part by
> [ADR-0006](0006-performance-history-content-model.md).** Two corrections, both
> to *what is published* rather than to the URL shapes below, which stand
> unchanged.
>
> **Season is no longer a surface at all** — not a route and not a facet. It is
> recorded on BSO-era concerts and never rendered, because a numbered season
> describes the orchestra's calendar rather than Alex's repertoire. This
> paragraph originally listed it alongside the other four facets.
>
> **The page count is now a rule, not a figure.** `/concerts` publishes only the
> concerts Alex performed, so the total is derived from participation data and
> moves — 121 concerts, 322 works and 148 composers when ADR-0006 was accepted,
> so 591 routed pages or roughly 597 with indexes, plus N. It falls as further
> participation exceptions are recorded and rises as pre-BSO programs are added.
> The ~650 and ~870 figures here describe the full in-scope archive and remain
> valid as the comparison that justified facets over routes.

## `/music` is reserved

`/music` is permanently reserved for original work Alex creates himself, and the
performance history must never occupy it. This is the reason the section is at
`/concerts` rather than the obvious `/music`, and it is not inferable from the
code — hence this record.

## Considered options

**Base path.** `/music` was ruled out by the reservation above. `/performance`
was rejected because on a front-end developer's own domain it reads as Lighthouse
metrics. `/performances` is accurate but makes `/performances/concerts/`
redundant. `/repertoire` is the most precise term for a composer-and-work index
but is jargon outside music. `/concerts` won on brevity, and because it lets the
section landing double as the concert index with no wasted segment.

**Work URLs.** A flat composer-prefixed slug (`/concerts/works/brahms-johannes-violin-concerto-in-d-major`)
is equally collision-proof and was the alternative; nesting won for shorter
segments and no repetition of the composer's name. Bare titles were rejected as
unstable — eight title families already collide (three `violin-concerto-in-d-major`,
two `sleigh-ride`), so any new work sharing a title would force a live URL to
change. The importer's generated slugs
(`tchaikovsky-pyotr-ilyich--suite-no-4-in-g-major-mozartiana-054ffb`) were
dropped: truncated mid-word, up to 67 characters, and the hash buys almost
nothing because (composer, title) is unique for 347 of the 348 in-scope works.
The exception is real and is not the arranger merge described below: Tchaikovsky's
*The Nutcracker Suite* and Ellington's arrangement of it carry
**character-identical titles** under the same composer, so the pair collides on
(composer, title) itself. Since `work.slug` also carries `unique: true`, the two
entries currently coexist *only* because of those hash suffixes — dropping the
hash without supplying a disambiguator is a schema rejection, not merely an ugly
URL. See [ADR-0005](0005-composer-identity-and-arrangements.md).

**Home page.** `/` is a positioning statement with two or three selected
projects; `/projects/` is the exhaustive index. With a single-digit project count
these two pages will list many of the same things. That duplication is accepted
as the price of a front door that isn't just a list.

## Consequences

**Composer records must be merged first.** Nesting puts composer identity in
every work URL. **25** of 173 in-scope composer records carry an arranger inside
the first-name field, of which 19 split 16 real composers across 33 records — so
`/concerts/composers/tchaikovsky-pyotr-ilyich` would list 12 of his 13 works and
silently drop the 13th. The true in-scope count is 156 composers. The remaining
six are composers who exist *only* in arranged form, so they have nothing to merge
into and do not affect the 156, but their display name still renders as "Richard
(arr. by Douglas) Addinsell". Arrangers are page detail and never appear in a URL,
with one exception: Tchaikovsky's *The Nutcracker Suite* and the Ellington
arrangement claim the same path, so an arranger surname may be appended to break
a tie (`…/the-nutcracker-suite-ellington`). 347 of 348 nested URLs are otherwise
unique. Settled by [ADR-0005](0005-composer-identity-and-arrangements.md), which
also establishes that the collision is *not* created by the merge — the two titles
were already identical.

**`/concerts` hard-codes the spine.** A future recital, pit gig or chamber
performance would sit under a path named for concerts. Taken knowingly; if that
content appears, the base path is what gives.

**Composers and works hang off an events path.** `/concerts/composers/brahms-johannes`
reads as though the composer belongs to a concert. URLs stay unique and stable,
but the hierarchy is not semantically clean.

**The portfolio section is `/projects`, not `/work`.** A `work` is a musical
composition — one of the archive's core content types — so `/work` for the
portfolio would have left "the work page" permanently ambiguous. `/projects`
removes the collision at the source rather than papering over it in the
glossary. Portfolio items are *Projects* everywhere: routes, prose, and
`CONTEXT.md`.

**Twelve URLs need redirects.** `/portfolio/` to `/projects/`, the two
`/portfolios/*` entries to their case studies, and nine `/cheatsheets/*` URLs to
their GitHub Gists. The cheatsheets carry no content of their own — each is a
single `<script src="gist.github.com/…">` embed, untouched since 2017 — so they
get no routes.

> **Thirteen, and two of the targets were wrong.** Corrected by
> [AWK-21](https://linear.app/awkale/issue/AWK-21/decide-which-projects-ship-and-which-get-case-studies).
>
> **`/user-story-best-practice/` was missed entirely.** It returns 200 today, and
> not from this repo — GitHub Pages serves it from the `gh-pages` branch of the
> separate `awkale/user-story-best-practice` repo, which resolves under
> `awkale.me` only because the user site holds the `CNAME`. Nothing in this
> record or [ADR-0002](0002-hosting-and-deploy-pipeline.md) mentions it, so the
> apex cutover would have silently 404'd it. It redirects to the repo
> (`github.com/awkale/user-story-best-practice`) rather than to the 2015 slide
> deck: the deck and the repo's `README.md` carry the same guide, the README is
> the better rendering, and the repo is what the URL's 65 stars actually point
> at. Redirecting to `awkale.github.io/user-story-best-practice/` was rejected
> as the one option whose target depends on how Pages behaves once the `CNAME`
> is removed — an unknown resolved at cutover, on the one URL here with an
> organic audience.
>
> **The two `/portfolios/*` URLs redirect to the `/projects/` index, not to case
> studies.** Both are Cision items and AWK-21 ships them index-only, so the
> pages this sentence promises them will not exist. A redirect to a case study
> that was never written is a 404 with extra steps.
