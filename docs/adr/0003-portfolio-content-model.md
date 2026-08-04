---
status: accepted
---

# Portfolio content model for awkale.me

The `/projects` section is two new Contentful content types — `project` and
`imageGroup` — created in the existing space `3iiyvj5u5c9h`, environment
`master`, alongside the eleven archive types. A `project` carries its index-level
facts as flat fields and its case study as an optional RichText `body`; a project
with no `body` is listed in the index but has no page of its own. `imageGroup` is
a block type embedded in that body, holding an ordered set of assets and a layout
hint. Image captions and alt text live on the Contentful Assets themselves rather
than on either type.

## Field IDs are scoped per content type

[AWK-11](https://linear.app/awkale/issue/AWK-11/design-the-content-model-for-designdev-work)
was framed around a constraint that does not exist: that portfolio types must
coexist with the archive types "without id or naming collisions," with splitting
them into a separate environment as the escape hatch. **Contentful scopes field
IDs per content type.** `project.title` cannot collide with `work.title` or
`concert.title`; there is no shared field namespace to pollute, and no amount of
overlap between the two sets of field names creates a problem.

Only two namespaces are space-global. **Content-type IDs** — `project` and
`imageGroup` are both free, verified against the live space, which holds exactly
eleven types. And **entry IDs** — which were also never at risk. The archive's
derived ids (`cmp-`, `cnc-`, `wrk-`, `pi-`) exist only because
`import_to_contentful.py` computes them; entries created by hand in this space
already carry Contentful's auto-generated ids, including the eight composers with
curated dates, the Brooklyn Symphony Orchestra (`7GW6fT7mUQE6pZLJXHj1TC`) and
Walt Whitman Hall (`4ej6X1ysgy6FlHGz7QsQYX`). Projects are authored by hand, so
they take auto-generated ids and need no prefix convention at all.

This is worth recording because the collision fear was the entire motivation for
the environment split, and because the inverse mistake is easy: a future reader
seeing `title` on four content types may assume it needs disambiguating.

## The optional body defines N

[ADR-0001](0001-url-structure.md) put the prerendered total at **637 + N**
without defining N beyond "the number of case studies that ship." N is now
precise: **projects whose `body` is non-empty.** A project with an empty `body`
appears in the `/projects/` index and has no route; filling the body later *adds*
a URL rather than changing one, so a stub can graduate to a case study with no
migration, no new entry, and no redirect.

That makes shipping a project and writing its case study two independent
editorial decisions, which is the point — ADR-0001 describes `/projects/` as "the
exhaustive index including smaller and older items," and a model that demanded
prose for every minor item would either block those items or ship thin pages. The
two existing `_portfolios/` entries are exactly that failure case already: 606 and
947 bytes, each a single user-story `<h3>` over a set of screenshots.

Which projects ship, and which get bodies, is deliberately not settled here. It
is
[AWK-21](https://linear.app/awkale/issue/AWK-21/decide-which-projects-ship-and-which-get-case-studies),
and until it resolves the site's page count is 637 plus an unknown.

> **The 637 is superseded by
> [ADR-0006](0006-performance-history-content-model.md)**, which limited
> `/concerts` to the concerts Alex performed. The archive side of the total is now
> derived from participation data rather than fixed, so the page count is *two*
> unknowns: a computed concert-side figure plus N. Nothing about N or about the
> optional-`body` reasoning above changes — N is still projects whose `body` is
> non-empty, and it remains the only unknown this record is responsible for.

> **N is settled at 2, then 3.** Resolved by
> [AWK-21](https://linear.app/awkale/issue/AWK-21/decide-which-projects-ship-and-which-get-case-studies).
> Five projects ship in the index — the dv01 **Waterfall Design System**, **Agent
> A**, **awkale.me** itself, and the two **Cision** items — and two carry a `body`
> at cutover: Waterfall and Agent A. So the site publishes **≈598** pages at
> cutover and **≈599** once awkale.me gains its case study.
>
> **awkale.me ships index-only because its case study cannot be written honestly
> before it exists.** A write-up of building the site, published on the site, at
> cutover, is either future tense or a claim about something unproven. This is the
> first time the optional `body` earns its keep rather than merely being
> available: the entry ships with no page and graduates post-launch by filling one
> field, which *adds* a URL rather than changing one. The same affordance holds
> the deferred dv01 product screens, which arrive as a `body` edit if dv01 ever
> agrees to them.
>
> **`imageGroup`'s justification has moved from validated to expected.** *Image
> grouping* below claims the type "is required by 100% of the case-study content
> that currently exists, so nothing about it is speculative" — and that content
> was the two Cision items, which now get no bodies. The sidebar before/after
> *was* the `sideBySide` case and the wizard *was* the `fullWidth` + `grid` case;
> both variants are now justified by case studies not yet written. The type is
> kept, because a Waterfall before/after is very likely, but it is no longer
> validated against anything real and this record should not keep implying it is.

## Schema

`project` — display field `title`, auto-generated entry ids.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `title` | Symbol | yes | |
| `slug` | Symbol | yes | `unique: true` |
| `summary` | Symbol | yes | ~160 char cap; index card and `<meta name="description">` |
| `organization` | Symbol | no | employer or client |
| `role` | Symbol | no | free text, one phrase |
| `disciplines` | Array\<Symbol\> | no | `in: [Design, Development]` |
| `technologies` | Array\<Symbol\> | no | `in: […]`, explicit allowed list |
| `startDate` | Date | yes | index sort key, descending |
| `endDate` | Date | no | empty means ongoing |
| `featuredRank` | Integer | no | set puts it on the home page, ascending; empty is index-only |
| `coverImage` | Link\<Asset\> | no | index and home card |
| `liveUrl` | Symbol | no | URL-validated |
| `repoUrl` | Symbol | no | URL-validated |
| `body` | RichText | no | empty means index-only; embedded blocks restricted to `imageGroup` and assets |

`imageGroup` — display field `label`, embedded in `project.body` only.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `label` | Symbol | yes | internal identification, not necessarily rendered |
| `images` | Array\<Link\<Asset\>\> | yes | ordered; captions and alt text come from each Asset |
| `layout` | Symbol | yes | `in: [sideBySide, grid, fullWidth]` |
| `caption` | Symbol | no | group-level |

Checked against the content that exists: the Cision sidebar item is one
`imageGroup` with `layout: sideBySide` and two assets; the wizard item is a
`fullWidth` hero followed by a `grid` of five step screenshots. Neither leaves a
residue the model cannot express.

## Asset delivery

> **Added by
> [AWK-28](https://linear.app/awkale/issue/AWK-28/decide-how-contentful-asset-images-are-delivered)**
> — see [ADR-0013](0013-asset-image-delivery.md).

This record specifies where images *live* — Contentful Assets, embedded in `body` or
grouped by `imageGroup`, with alt text and captions on the Asset itself — and was
**silent on how they reach a visitor.** Since Contentful serves assets from
`images.ctfassets.net` by default, silence was not neutral: it picked hotlinking.

**Decided: proxied by Netlify Image CDN from this site's own origin.** The browser
never connects to Contentful; Netlify fetches the source server-side and transforms
it per request. This makes [ADR-0010](0010-no-analytics.md)'s CSP `img-src 'self'`,
and it means every `coverImage` and every asset embedded in a `body` is addressed
through `/.netlify/images`, never by its `ctfassets` URL.

Nothing in the schema above changes. ADR-0013 carries the reasoning, the
`netlify.toml` block, and the responsive-image markup.

## Considered options

**Partitioning.** A separate Contentful space would give real editorial
separation and independent schema evolution, at the cost of two space IDs and two
Delivery tokens in the build for no gain at this content volume. A separate
environment was the option the ticket proposed and is the one worth explicitly
rejecting: Contentful environments are schema-staging branches of a single space,
each carrying a full copy of the schema and entries, so the archive would be
either duplicated into the portfolio environment or absent from it, and one build
cannot query two environments as one dataset without two clients. The live space
has exactly one environment, `master`, created 2019-05-19 — so the option was
never available without first creating one. The accepted cost of sharing
`master` is that the Contentful web UI's entry list mixes a handful of projects
into 2,384 archive entries, making a content-type filter mandatory when editing.

**Type count.** A page for every project was rejected for the reasons in *The
optional body defines N*. A split `project` + `caseStudy` pair was rejected as
the more expensive shape: it doubles the authoring steps for the common case,
adds a join the build resolves on every page, and turns "this stub deserves a
real write-up" into a migration between types rather than filling a field.

**Body shape.** Markdown in a `Text` field is the cheapest to author and render
and matches the space's existing all-`Symbol`/`Text` precedent, but images
degrade to hardcoded URLs — losing the Image API's resized and WebP derivatives,
losing alt text as asset metadata, and losing any guarantee the referenced image
exists. Modular section blocks (an array of links to `textSection`,
`imageSection`, `comparisonSection`) are the most expressive and handle
comparison layouts natively, but that is a great deal of schema for a
single-digit project count, makes every page a multi-level include resolve, and
turns authoring a paragraph into several clicks. RichText with embedded assets
won as the native option that keeps images as real Asset links.

**Image grouping.** Embedding single assets inline needs no extra type, but it
stacks the sidebar's before/after vertically and destroys the comparison that is
the item's entire content, and it turns the wizard into six full-width images
down the page. One `imageGroup` type covers both cases, and is required by 100%
of the case-study content that currently exists, so nothing about it is
speculative.

**Caption placement.** Parallel `images[]` and `captions[]` arrays on
`imageGroup` keep captions per-placement with no extra type, and were rejected
outright: the arrays align only by index, so reordering or deleting one image
shifts every caption onto the wrong image, and it fails silently in the rendered
page rather than at build time. A `captionedImage` entry type per image is
strictly correct and reuse-safe, at the cost of an entry per image — six extra
entries for the wizard alone — reintroducing one layer of the modular-block
overhead already declined. Reading `title` as alt text and `description` as
caption from the Asset needs no extra structure and attaches alt text to the
image everywhere it is used; the accepted cost is that a caption is global to the
asset, so reusing one screenshot in two groups gives both the same caption. That
is acceptable for screenshots, which are used once.

**Taxonomy.** The space already contains both patterns, so this was a choice
between established precedents rather than an invention. Controlled values as
`in`-validated symbols: `soloist.instrument` carries 36 that way,
`ensemble.kind` 7. Linked single-field entities: `genre`, 17 entries whose only
field is `name`. `technologies` follows the first. A linked `technology` type
would let a tag carry an icon or URL later and would permit tag pages, but it
repeats the `genre` shape — a content type holding one string — and adds an
entry-creation step plus a build-time join per tag. Unvalidated free text was
rejected because nothing then prevents `React`, `react` and `ReactJS` becoming
three tags, which silently breaks any grouping on the index. The accepted cost of
an `in` list is that adding a tool means republishing the content type.

**Naming the company.** `client` is the portfolio convention and reads naturally
on an index, but it is factually wrong for the work in hand: both existing
projects are Cision C3, which was an employer, and most future entries will also
be employer product work. Using it would force the glossary to stretch one word
to cover "employer" — the same overload that ADR-0001 refused when it chose
`/projects` over `/work`. `organization` covers employer, client and future
freelance engagements without stretching. A linked `organization` type was
rejected as a second `genre`-shaped type plus a join, for two or three companies.

**Home selection.** A boolean `featured` plus a separate `order` integer is the
conventional pair and is immediately legible in the Contentful UI, but the two
fields can disagree and nothing keeps them consistent. A boolean alone is the
simplest to author but leaves the order of the front door's two or three items to
whatever the Delivery API happens to return, which is not a guarantee the most
important page of the site should depend on. A single nullable
`featuredRank` carries selection and order in one field, so the contradictory
state does not exist.

**Dates.** A single `date` is enough to sort the index but compresses a project
that ran for months into one arbitrary day — which is precisely how the
meaningless `2019-03-15` and `2019-03-16` on the two existing stubs came to
exist. Those are the dates the Jekyll files were written, one day apart, not when
the C3 work happened. A `year` integer matches the granularity a portfolio
actually displays, but leaves two projects from the same year with no defined
relative order, which is non-deterministic exactly where recent work clusters.
`startDate` plus optional `endDate` gives a total order and keeps display
granularity presentational — "2019" or "2019–2020" render from the same data.

**Slug source.** Deriving the slug from the title removes a field and guarantees
the two never drift apart, but the inverse is the problem: sharpening a project
title silently rewrites a published URL, and on the portfolio side those are the
URLs that get pasted into applications. ADR-0001 already commits to maintaining
twelve redirects, so URL stability is worth a field. A stored-but-optional slug
with derivation as fallback was rejected as two code paths behind a value whose
origin cannot be determined by looking at the entry — the same ambiguity that
made `work.slug` a trap worth its own ticket.

## Consequences

**The index needs a no-image card treatment.** `coverImage` is optional, because
requiring it would encode a content policy as a schema constraint while ADR-0001
promises an index containing smaller and older items that may have no imagery at
all. The index must therefore render a card with no image without looking broken.
There is a second state to design alongside it: a project with a `body` links to
its case study, one without links nowhere or only outward via `liveUrl` /
`repoUrl`, and a card that looks clickable but is not is worse than an obviously
flat one. Both are recorded on
[AWK-14](https://linear.app/awkale/issue/AWK-14/decide-the-design-system-and-token-approach).

**These are the space's first RichText and Asset fields.** Every text field
across all eleven archive types is a `Symbol` or a `Text`, and no archive content
type references a media asset anywhere. That is why the space holds exactly one
asset (`alex.kale.jpg`, 2019) — there has never been a field capable of holding
one. The build therefore gains two capabilities it could not previously need: a
RichText renderer, and the Image API for asset derivatives.

**The eight Cision screenshots must be uploaded as Assets before any case study
can be authored**, each with `title` set for alt text and `description` set for
caption, since the model reads captions from the asset. They are the only
portfolio imagery that exists and none of it has been migrated. This is build
work rather than a decision.

> **Two, not eight.**
> [AWK-21](https://linear.app/awkale/issue/AWK-21/decide-which-projects-ship-and-which-get-case-studies)
> ships both Cision items index-only, so neither has a `body` and neither uses an
> `imageGroup`. Each needs a single `coverImage` — `updated_sidebar.jpg` and
> `Wizard v2@2x.png` — and the remaining six screenshots are never uploaded. The
> `title`/`description` requirement still applies to the two, and the two case
> studies that *do* ship bring their own imagery, which for Waterfall means
> **screenshots of `ux.dv01.co` rather than hotlinks to it**: it is a live
> internal-facing property that can be restructured or put behind auth without
> notice, and a case study should not break when it is.
>
> An index-only Cision entry with no image at all was rejected as
> indistinguishable from an omission — if that were the outcome, dropping both
> entries would have been the honest version. Two cover images keep them what they
> are: small, dated, real work, which is the "smaller and older items" index
> [ADR-0001](0001-url-structure.md) promised.

**Publishing a project triggers a site build.** There is deliberately no draft
field; Contentful's native publish state carries it. That couples project
authoring to the rebuild trigger in [ADR-0002](0002-hosting-and-deploy-pipeline.md),
and to whatever
[AWK-16](https://linear.app/awkale/issue/AWK-16/confirm-what-netlify-actually-meters-and-what-throttles-deploys)
establishes about what Netlify actually meters. Iterating on a case study across
several publishes costs several deploys.

**Project slugs and archive slugs are settled separately, and may differ.**
Storing project slugs does not prejudge
[AWK-18](https://linear.app/awkale/issue/AWK-18/decide-where-archive-url-slugs-come-from).
Hand-authoring a slug is trivial across a single-digit number of projects and
near-impossible across 156 composers and 348 works, so the stored-versus-derived
tradeoff genuinely resolves differently at the two scales. The two records
disagreeing on mechanism is not an inconsistency, and `work.slug` and `hall.slug`
already carry `unique: true` if a stored answer is wanted there too.

**`summary` is required and doubles as the meta description.** It is the only
field both the index card and `<meta name="description">` depend on, so a project
cannot be created without the text that both surfaces need. The ~160 character
cap exists for the second consumer, not the first.

**`featuredRank` requires a non-empty `body`, and the build must assert it.**
Established by
[AWK-21](https://linear.app/awkale/issue/AWK-21/decide-which-projects-ship-and-which-get-case-studies).
The schema above cannot express the dependency — both fields are independently
optional — but the two interact badly at exactly the worst place. A featured
project with no `body` has no page, so its home-page card either does not click at
all, or clicks *off-site* to `liveUrl` while the card beside it opens a case
study. The no-image and no-link card states this record already hands to
[ADR-0004](0004-design-system-and-tokens.md) are an index-card problem;
`featuredRank` puts the same state on the front door, where 2–3 cards carry the
whole positioning statement.

This is the fourth invariant Contentful cannot hold — after `sideBySide`'s image
count, `satOut`'s subset rule and `(composer, slug)`'s scoped uniqueness — and it
belongs in the same build assertion. It also fixes the ordering of two editorial
decisions that look independent: awkale.me joins the home page when it gains its
body, not before, so N and the featured set move together.
