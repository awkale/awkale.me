---
status: accepted
---

# Asset images: proxied by Netlify, never fetched from Contentful by the browser

Contentful asset images are delivered through **Netlify Image CDN** from
`awkale.me`'s own origin. Netlify fetches the source file from Contentful
server-side, transforms it, and caches the result at its edge; **the browser never
connects to `images.ctfassets.net`.** That makes the CSP's image directive
`img-src 'self'`, which completes the policy
[ADR-0010](0010-no-analytics.md) left unfinished.

Decided in
[AWK-28](https://linear.app/awkale/issue/AWK-28/decide-how-contentful-asset-images-are-delivered).

## The option set was a false binary, again

AWK-28 framed the choice as **hotlink `images.ctfassets.net`** versus **fetch at
build time and serve the copies**, and treated free per-request transforms as the
price of the second. Netlify Image CDN is neither option and pays neither price:
a request to `/.netlify/images?url=…&w=960` is served from this site's origin, so
there is no third-party origin *and* no build machinery — no fetch step, no image
library, no copies.

It is a **platform feature**, not code. That is the second time this map has found
one where it expected to write something: ADR-0011 found that Netlify Forms needs no
function, and the same shape holds here. Nothing is written and nothing is
maintained.

## What actually rules out hotlinking

Privacy was the stated argument and it is real, but it is not the decisive one.

**Contentful's Free plan pauses delivery at 100%.** The plan meters **50 GB of asset
bandwidth** and **100K API calls** per month with *no overages*, and Contentful's own
changelog is explicit that on reaching either limit it **automatically pauses the
delivery APIs** — CDA, CPA and GraphQL — until the start of the next calendar month
or an upgrade to a paid plan. The failure mode is an **outage, not an invoice.**

That is the third instance of the asymmetry
[AWK-16](https://linear.app/awkale/issue/AWK-16/confirm-what-netlify-actually-meters-and-what-throttles-deploys)
taught this project to look for, after Netlify's build minutes and the Forms limit
[ADR-0011](0011-input-surface.md) accepted — and the first one on a **second
vendor.** Hotlinking would put the visible correctness of the portfolio behind a
free tier this project does not administer.

**And nothing here could report it.** [ADR-0010](0010-no-analytics.md) gave up
analytics, error monitoring *and* any server log, deliberately and with its eyes
open. A broken image is exactly the class of failure that decision accepted having
no instrument for. So the realistic scenario is not 50 GB of traffic — it is the
slow version: free-tier terms change, or the space is tidied up in some later year,
and the images 404 in place until Alex happens to look at his own portfolio.

**The privacy argument still counts, and consistency decides it.**
[ADR-0012](0012-performance-recordings.md) refused YouTube thumbnails four days ago
on precisely this ground — that `i.ytimg.com` would receive the visitor's IP and
referer on every page view and *"would force an `img-src` entry naming Google."*
Admitting `images.ctfassets.net` is the same act against a different vendor. A
project that rejected thumbnails to avoid a third-party image origin cannot adopt a
third-party image origin for its own screenshots.

## Why not a build-time mirror

Fetching the files into the deploy is the **strictest** option and was not rejected
on privacy — it wins there too, and it wins on durability: a self-contained deploy
cannot rot, and Contentful becomes a build-time dependency only.

Rejected as **disproportionate to a set of about twenty screenshots.** It needs a
fetch step, an image library in the build, and `srcset` generation moved into
build code — which is the *"second unmeasured term in the build budget"* AWK-28
named, after the CDA sweep. Netlify's proxy buys the identical `img-src 'self'`
for four lines of configuration.

**The residual difference, recorded honestly:** Contentful stays a **runtime**
dependency on a cold cache, where a mirror would have made it build-time only.
Accepted, because the cache is warm for anything anyone actually looks at, and
because a mirror has its own failure mode — copies silently diverging from the
asset an editor has since replaced — that is not obviously the better one.

## The configuration

```toml
[images]
  remote_images = ['https://images\.ctfassets\.net/3iiyvj5u5c9h/.*']
```

**Space-scoped, not domain-wide.** The space id is already committed in
`netlify.toml`'s notes and in [ADR-0002](0002-hosting-and-deploy-pipeline.md), so
it is not a secret being leaked here. Domain-wide (`images\.ctfassets\.net/.*`)
would survive a space change untouched, and was rejected because it would let this
site fetch, transform and serve **any** Contentful customer's public asset.

**Use a TOML literal string** — single quotes, as above. Netlify's own documented
example uses double quotes, where `\.` must be written `\\.` or the backslash is
eaten before the regex ever sees it. Their example sidesteps this by leaving the
dots unescaped entirely. Single quotes make the pattern mean what it looks like.

### Verified live, and it behaves better than Forms

Probed on two existing personal-team projects — `uxstash` and `agent-a`, both
static, both zero-function, both on the same frozen Legacy Free plan:

- **The endpoint is on by default.** `/.netlify/images` answers from `Netlify Edge`
  with `{"code":400,"msg":"must provide the url param"}`. There is **no per-site
  toggle** and nothing to remember at site-creation time — the direct opposite of
  ADR-0011's Forms detection, which is UI-only, appears in no diff, and fails
  silently when forgotten.
- **The allowlist is fail-closed and loud.** An un-allowlisted source returns
  `400 {"code":400,"msg":"url (…) is not an allowed pattern"}`. Omitting the block
  above cannot degrade into an accidental hotlink.

**Not a metered feature on legacy Free.** The legacy plan meters build minutes,
bandwidth, function invocations, edge-function invocations and form submissions;
image transformations appear nowhere on that list. So this does not join the
pause-every-site family.

**But bandwidth does, and that is what this decision moved.** Transformed bytes now
leave Netlify's edge and count against its **100 GB**, where hotlinking would have
spent Contentful's **50 GB**. Both are hard stops. The trade is deliberate: twice
the allowance, one vendor instead of two, and the meter that stops is the one this
project already watches.

## Netlify does all of the resizing

The `url` parameter carries the **bare** Contentful file URL. Contentful's own
Images API is not chained in front of Netlify's.

One resizer means one place to reason about and no double compression. It also
avoids a live footgun: a source URL carrying its own query string must be
percent-encoded inside `url`, or its parameters merge into Netlify's. Pre-shrinking
at Contentful would cut the bytes crossing between the two vendors on a cold miss,
which is a real but small gain against ~200 KB screenshots that Alex uploads himself.

**`fm` is omitted.** With no format parameter Netlify content-negotiates on the
request's `Accept` header, so AVIF-capable browsers get AVIF and Safari gets
something it can read, with no format hardcoded and one fewer parameter to revisit.

## Markup: `sizes="auto"`, with a fallback that Safari reads

Responsive images follow
[*The end of responsive images*](https://piccalil.li/blog/the-end-of-responsive-images/) —
the browser measures the rendered box itself instead of the author restating the
layout at every breakpoint:

```html
<img
  loading="lazy"
  sizes="auto, (min-width: 60rem) 640px, 94vw"
  srcset="/.netlify/images?url=…&w=650   650w,
          /.netlify/images?url=…&w=960   960w,
          /.netlify/images?url=…&w=1400 1400w"
  src="/.netlify/images?url=…&w=960"
  width="2560" height="1578"
  alt="…">
```

This composes with the decision above rather than merely coexisting: Netlify
generates **any** width on demand, so a `srcset` ladder costs nothing to emit and no
build-time variants exist to keep in step.

> **Amended under [AWK-40](https://linear.app/awkale/issue/AWK-40) (2026-08-19): the
> ladder is capped per image, and the example's dimensions are not real.** The three
> rungs above are emitted only where the source can serve them —
> `app/lib/images.ts` keeps every rung below `file.details.image.width` and then adds
> the source width itself as the top rung. Measured against the assets that actually
> ship: `updated_sidebar.jpg` is **732 × 1060**, so `960w` and `1400w` both upscale,
> and `existing_sidebar.jpg` is **1333 × 1474**, so `1400w` does. Netlify serves an
> upscaled rung happily — blurrier than the source, for more bytes than the source.
> Only the two 2560 × 1600 screenshots have headroom for the full ladder.
>
> The `width="2560" height="1578"` in the snippet belongs to `01 - Step 1@2x.png`,
> one of the six screenshots [AWK-21](https://linear.app/awkale/issue/AWK-21) dropped
> when the Cision projects went index-only. Nothing shipping has those dimensions.
> This does not change the decision — it makes reading `file.details.image.*` do more
> work than it looked like, since the ladder derives from the same numbers.

**`sizes="auto"` requires `loading="lazy"`.** That is the specification, not a quirk
— without it the value cannot resolve and the browser falls back through the rest of
the list. It is the reason the two-tier rule below exists.

**Safari does not support it,** desktop or iOS, through 26.5. Chrome and Edge from
126, Firefox from 150 (April 2026), ~71% globally; the feature is **blocked from
Baseline since April 2026** on WebKit bug 253143. So the hand-written fallback is
not legacy politeness — it is what serves Safari today, and a design portfolio's
audience skews toward Safari. **Delete the fallback when WebKit ships**; that is the
whole migration.

The fallback is cheap here because there are only four image contexts — index card,
`sideBySide`, `grid`, `fullWidth` — so it is four strings, not forty. The article's
premise is weakest on a small site, and adopting the technique anyway is justified by
where it goes rather than what it saves now.

### The first image on a page loads eagerly

**Rule:** the first image on any page is `loading="eager" fetchpriority="high"` with
an explicit `sizes`; every image after it is `loading="lazy"` with `sizes="auto"`.

Mechanical, and it lands correctly by construction on all three page types — the
home page's leading featured card, the first card in the `/projects` index, a case
study's `fullWidth` hero. Enumerating the eager images by hand was rejected because
it makes adding a project a judgement call; making everything lazy was rejected
because it slows largest-contentful-paint on exactly the pages a prospective
employer lands on.

### Two build instructions that are cheap now and obscure later

**Emit `width` and `height` from the asset's own metadata.** The CDA returns
`file.details.image.width` / `height`, so there is no excuse for layout shift and
nothing to measure by hand.

**Build these URLs in one helper.** `/.netlify/images` is a Netlify-only path, so a
hosting move breaks **every** image on the site. Confined to a single module that is
one edit; inlined into components it is a sweep. This is the one place this decision
is coupled to [ADR-0002](0002-hosting-and-deploy-pipeline.md)'s choice of host.

## Scope: this is a portfolio-only concern

Worth stating because it bounds everything above. **Images exist only on the home
page, the `/projects` index, and the case studies** — around twenty files, all
screenshots Alex made. The **590 archive pages carry no images at all**:
[ADR-0012](0012-performance-recordings.md) made recordings outbound text links and
rejected thumbnails, and the archive was never illustrated. Eight source files exist
in the retired repo's `assets/images` (1.1 MB total, 2560px `@2x`), of which
[AWK-21](https://linear.app/awkale/issue/AWK-21/decide-which-projects-ship-and-which-get-case-studies)
needs two as Cision `coverImage`s.

## Consequences

**[ADR-0010](0010-no-analytics.md)'s CSP is now complete.** `img-src 'self'` was its
last unwritten directive, after `script-src` in the record itself and
`form-action 'self'` from [ADR-0011](0011-input-surface.md). No `data:` — nothing in
the repo uses an inline image today, and adding blur placeholders later would fail
visibly rather than silently.

**This record adds no new invariant**, which is worth stating after four of the last
five did. Nothing new joins AWK-17's CI assertion.

**It amends two records.** [ADR-0003](0003-portfolio-content-model.md) gains the
delivery half it never specified; ADR-0002 gains the `[images]` block as the second
piece of `netlify.toml` this project hand-writes.

**The work is build work.** The config block, the URL helper, and the markup are
sequenced with the case studies and the CSP edit, not done here.

**Reopening triggers**, all three observable from outside:

- **Volume.** Many hundreds of images, or video, changes the bandwidth arithmetic
  and reopens the mirror option — not the hotlink one, which stays closed on
  ADR-0012's consistency argument regardless of volume.
- **Leaving Netlify.** The proxy is the host's feature; a move makes build-time
  mirroring the default answer rather than the expensive one.
- **Safari shipping `sizes="auto"`.** Not a reopening so much as a scheduled
  deletion: the fallback lists go, and nothing else changes.
