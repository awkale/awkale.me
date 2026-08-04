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

## Reserved paths

Two paths are spoken for and route nothing. Neither is inferable from the code,
which is why they are recorded here, and both were reserved on the same
reasoning: reserving costs nothing before cutover, while retrofitting a path
afterwards means touching a committed redirect set and a live URL space.

A reserved path ships **nothing** — no route entry, no prerender path, no
redirect, and no placeholder page. It 404s exactly like any other unknown path,
which
[AWK-17](https://linear.app/awkale/issue/AWK-17/spike-the-637-route-prerender-build)
verified is the real production behaviour, and which holds only so long as no
catch-all redirect is ever added.

**`/music`** is permanently reserved for original work Alex creates himself, and
the performance history must never occupy it. This is the reason that section is
at `/concerts` rather than the obvious `/music`.

**`/2-or-3-things`** is permanently reserved for the blog, whose title — after
Godard — it carries verbatim. Added by
[AWK-25](https://linear.app/awkale/issue/AWK-25/reserve-the-route-for-the-blog),
which also generalized this section from the single `/music` reservation it
originally held.

## Contact

> **Added by
> [AWK-26](https://linear.app/awkale/issue/AWK-26/decide-whether-anything-needs-a-server)**
> — see [ADR-0011](0011-input-surface.md). This record originally described only
> the two peer sections; contact was never in the sitemap.

Two paths outside both sections, and the only pages here that are neither a
section index nor a content record:

| Path | Holds |
| --- | --- |
| `/contact` | a Netlify Forms contact form, plus the three profile links |
| `/contact/sent` | the success page the form's native POST redirects to |

`/contact/sent` exists because the submission is an ordinary browser POST rather
than a `fetch`, so the browser has to land somewhere. It is a real page in the
site's own typography rather than Netlify's generic confirmation, and it wants
`X-Robots-Tag: noindex` — it is a prerendered page with no inbound purpose, and the
sitewide staging `noindex` that covers it today is marked *REMOVE AT CUTOVER*.

`/contact` collides with nothing, so this needed none of the care `/projects` did.
Contrast the `/work` rejection below: the collision was removed at the source there
because `work` is one of the archive's own content types. `contact` is not a term
this domain uses for anything.

Neither path takes a facet, and neither is a section — the site still has exactly
two, which is what the opening paragraph means.

## Considered options

**Base path.** `/music` was ruled out by the reservation above. `/performance`
was rejected because on a front-end developer's own domain it reads as Lighthouse
metrics. `/performances` is accurate but makes `/performances/concerts/`
redundant. `/repertoire` is the most precise term for a composer-and-work index
but is jargon outside music. `/concerts` won on brevity, and because it lets the
section landing double as the concert index with no wasted segment.

**Blog path.** `/notes` was rejected on this record's own rule — a `note` is as
overloaded as a `work` on a site whose second section is 322 musical
compositions, and unlike `work` it is not a typed entity, so there is no glossary
entry to disambiguate it. `/musings` was rejected for sharing its first four
characters with reserved `/music`: two neighbouring paths, one live and one
permanently 404, is a typo collision built in on purpose. `/writing` and `/blog`
are both clean, and `/writing` is the better of the two — `/projects` and
`/concerts` name bodies of work, while `/blog` names the software pattern that
publishes them and implies a reverse-chronological feed the title resists.
`/2-or-3-things` won anyway: it cannot collide with anything, ever, and its
opacity is the point — the reference is for people who get it. The cost is that
it welds the URL to the title, accepted below.

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

**`/2-or-3-things` welds a URL to a title.** A route named after the section's
name is stranded if the name changes, and titles drift more readily than URLs do.
Taken knowingly: the title is treated as permanent, on the same footing as the
`/music` reservation itself.

**Three namespaces are separated by kind, not by topic.** `/concerts/*` is the
record — structured, Contentful-backed, asserting "I played this";
`/2-or-3-things` is prose; `/music` is the original work itself. An essay about a
concert and that concert's page cross-link, and neither absorbs the other. An
opaque blog route is what makes this hold: claiming no topic, it cannot compete
with `/music` or `/concerts` over who owns writing about music.

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
