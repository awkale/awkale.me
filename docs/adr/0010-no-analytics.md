---
status: accepted
---

# No analytics, and no third-party client-side beacons

`awkale.me` carries **no analytics**. The prohibition extends to **every
third-party client-side beacon**, error monitoring included, and is **enforced by a
Content-Security-Policy** in `public/_headers` rather than left as a convention.

This is a decision, not an omission. [ADR-0004](0004-design-system-and-tokens.md)
recorded analytics as *"a genuine gap in a map whose destination is that nothing is
left to decide"*; this record closes it. Decided in
[AWK-24](https://linear.app/awkale/issue/AWK-24/decide-whether-the-new-site-carries-analytics).

## Why none

**No decision traffic data would change.** That test came first and settled
everything after it. `/concerts` is, by
[ADR-0006](0006-performance-history-content-model.md)'s own framing, a personal
repertoire — primarily a tool for its author. The portfolio half has a real outside
audience, but "do recruiters reach the case studies" is not a question that would
alter what gets built today.

The corroboration, rather than the argument: **the site has collected nothing since
2023 and nobody noticed.** Universal Analytics stopped processing data that year and
no GA4 property was ever created. Three years of silence is evidence about how much
the data was ever consulted.

### The one argument that could have overturned it

Not measurement — **diagnosis**. With `ssr: false` there is no server request log
([ADR-0009](0009-static-rendering-layer.md)), so **nothing reports a 404 on an
inbound URL nobody anticipated**, across ~598 pages and thirteen redirects.

**Accepted, because analytics is the wrong instrument for it.** Two better ones
already exist:

- **Internal completeness** is covered by the CI page assertion AWK-17 built and
  proved fails correctly. It derives the expected page set from
  [ADR-0006](0006-performance-history-content-model.md)'s participation rules, so a
  route silently vanishing is caught at build time, not by a visitor.
- **Inbound coverage is a finite, known set** — [ADR-0001](0001-url-structure.md)'s
  thirteen redirects plus the old site's URL inventory — testable deterministically
  by a one-time `curl` sweep at cutover.

Analytics would only surface URLs nobody *imagined*, and at this traffic level the
sample cannot distinguish a broken deep link from an empty week.

**Residual risk, taken knowingly:** an external link to a URL nobody enumerated stays
broken silently and indefinitely.

## Why the ban covers error monitoring too

Ruled out in the same decision, deliberately, because **"different purpose" is the
drift path an analytics-only prohibition leaves open.** Error monitoring is
diagnosis rather than measurement, so a future reader could argue past a narrower
record without technically violating it.

It had the better case of the two.
[ADR-0004](0004-design-system-and-tokens.md) commits every page to a **blocking
inline theme script**, and [ADR-0009](0009-static-rendering-layer.md) carries a
hydration landmine — both client-side failure modes that nothing currently reports.

Ruled out anyway: ~598 near-static pages with minimal interactivity, and the real
failure modes are build-time and already asserted. Note it would **not** have closed
the 404 gap either way — a 404 is a server response, not a JS error.

## Reopening trigger

Two forms, both recorded so that adding analytics later is a conscious amendment to
this record rather than a quiet fill-in.

**Concrete: an active job search.** It makes `/projects` load-bearing, at which
point "do recruiters reach the case studies" becomes a question that would change
what is written and what is featured. Observable from outside the data, and
self-limiting — it ends when the search does.

**General: the purpose test.** A specific question the author would *act* on.

**Rejected as circular: *"if the site starts getting real traffic."*** It cannot be
observed without the analytics it would authorize. Any trigger has to be visible from
outside the data.

## The two existing installs

`_includes/scripts.html` in the retired `awkale.github.io` shipped both — at the
**end of `<body>`** (`_layouts/default.html:19`), not in `<head>` as
[ADR-0004](0004-design-system-and-tokens.md) and AWK-24 both assumed.

**Google Universal Analytics `UA-171213-13` — nothing to do, and nothing that could
be done.** Google removed UA properties, their data **and** the API the week of
2024-07-01, inaccessible even read-only, with no export path afterwards. So both
halves of the question — delete the property, or export its history — were settled
externally two years ago. `analytics.js` nonetheless still returns 200 (52 KB), so
the old site ships a script that silently discards every hit: a no-op, not a broken
request. The tag dies with the repo.

**Clicky `100850507` — left alone.** Contrary to the assumption that it was defunct,
the service is alive (`clicky.com` → 200, `static.getclicky.com/js` → 200), so the
script still loads and the site id plausibly holds ~2016–2026 — **the only surviving
analytics history for this domain**, precisely what GA lost. Export was weighed and
**declined as inconsistent with this decision**: if the data would never be looked
at, preserving it is sentiment. No export, no teardown, no login. Collection ends
when the old site stops serving at cutover.

## Consent needs nothing, by construction

Not a preference — there is no decision left in it. With no beacons and no
third-party origins, nothing tracks anyone.

**The site's only client-side persistence is `localStorage`, and there are no
cookies at all.** `app/lib/mode.ts` writes `theme` and `mode`; both are
first-party, functional, and set by the user's own action.
[ADR-0004](0004-design-system-and-tokens.md) already serves fonts from the site's
own origin. **So: no consent banner, no cookie notice.**

## Enforcement: a CSP, not a promise

`public/_headers` exists and carried **no `Content-Security-Policy`** — verified
repo-wide when this was decided. Every "no third-party origin" property this project
asserts was therefore a convention any future edit could break silently.

**Decided: `script-src 'self' 'sha256-…'`,** with the hash computed at build over
[ADR-0004](0004-design-system-and-tokens.md)'s inline theme script. A future
`<script src="…">` from another origin then fails **loudly** instead of shipping.

The wrinkle that makes this non-trivial: that blocking inline script means
`script-src` cannot be plain `'self'`, and **`ssr: false` makes a nonce impossible**
— there is no server to mint one per request. The alternatives were:

- **`'unsafe-inline'`** — blocks external origins but permits *any* injected inline
  script, which would readmit exactly what this record bans. Rejected.
- **A build-time hash** — strict, at the cost of regenerating it whenever the theme
  script changes. Chosen.

This is the **fifth invariant this project cannot express declaratively**, joining
`sideBySide`'s two-image limit ([ADR-0004](0004-design-system-and-tokens.md)),
`satOut ⊆ program` ([ADR-0006](0006-performance-history-content-model.md)),
`(composer, slug)` uniqueness ([ADR-0008](0008-archive-slug-source.md)) and
`featuredRank`-requires-`body` ([ADR-0003](0003-portfolio-content-model.md)).

> ### The hash was impossible, and `'unsafe-inline'` is what shipped
>
> **Amended by
> [AWK-44](https://linear.app/awkale/issue/AWK-44/the-public-headers-cutover-edit-csp-and-the-two-noindex-changes)
> on 2026-08-05, when the header was actually written.** The reasoning above is kept
> because it is right about the goal and wrong about one fact.
>
> **The fact: there is not one inline script. There are nine per page, and one of them
> differs on every page.** Measured across four built pages. The theme script is
> stable; so are React Router's scroll-restoration shim, `__reactRouterContext`, the
> three streaming shims and the enqueue/close pair. But the **route import map** —
> `import "/assets/manifest-…"; import * as route0 from …` — is per-route, and gave
> four distinct hashes across four pages. At ~600 pages that is ~600 hashes, which a
> single sitewide header cannot carry and a per-path header could only carry by
> regenerating six hundred blocks every build.
>
> So `script-src 'self' 'sha256-<theme>'` would have **blocked eight of the nine
> inline scripts on every page**: no hydration, no colour-mode control. And this
> record's own decisions are what would have hidden it — no error monitoring, no
> request log, and a CI assertion that checks the page *set*, not whether a page
> works. Silent, sitewide, invisible to its own tests.
>
> **What shipped: `script-src 'self' 'unsafe-inline'`.** This record rejected that on
> the grounds it "would readmit exactly what this record bans", and that conflated two
> different threats. What this record bans is **third-party client-side beacons**;
> `'self'` still blocks `<script src="…">` from any other origin, so a future
> analytics snippet still fails loudly and the property this policy exists to enforce
> is intact. What `'unsafe-inline'` gives up is hardening against **injected inline
> script**, which requires attacker-controlled content — and this site has none: no
> user-generated content, no query-parameter rendering, no remote HTML. The rejection
> was of the right thing for the wrong reason.
>
> `style-src` needs `'unsafe-inline'` too, measured rather than assumed: the built
> output carries **114 inline `style=` attributes**, all React Aria's visually-hidden
> text.
>
> **Note for anyone tightening this later: browsers IGNORE `'unsafe-inline'` when a
> hash or nonce is present.** Adding a hash "as well" silently disables the keyword
> and blocks the eight scripts all over again. It is one or the other.
>
> **The route to the strict policy, if it is ever wanted, is dropping `<Scripts />`**
> — no hydration, no client bundle, one inline script, one stable hash. Considered and
> rejected: it costs React interactivity, which means rewriting the colour-mode
> control in vanilla JS and hand-building the archive-search combobox that
> [ADR-0011](0011-input-surface.md) assigns to `react-aria-components`. Reopening two
> settled records to harden against a threat this site does not have is a poor trade.
>
> **So this is no longer the fifth undeclarable invariant.** There is no hash to keep
> in sync, and AWK-39's assertion list loses that item. The other four stand.
>
> Verified when written, against the real policy in a browser: no CSP violation
> logged, the theme script runs and stamps `class` and `data-theme` on `<html>`, all
> three self-hosted faces load, and the colour-mode control still switches
> light↔dark and persists. That last check matters because a blocked inline script
> would have shown up as the wrong colour mode and nothing else.

### `form-action 'self'` — supplied later, and it was a real gap

> **Added by
> [AWK-26](https://linear.app/awkale/issue/AWK-26/decide-whether-anything-needs-a-server)**
> — see [ADR-0011](0011-input-surface.md).

`form-action` has **no fallback to `default-src`**. This record named only
`script-src`, so the policy as drafted would have permitted a form on this site to
POST to **any origin** — harmless while the site had no form, load-bearing the
moment it got one.

ADR-0011 ships a contact form, and supplies the value: **`form-action 'self'`**.
Netlify Forms posts to the site's own origin, so `'self'` is exactly sufficient and
nothing broader is needed.

Worth noting what this directive is *not* protecting against. It does not stop spam,
and it does not stop abuse of the form itself; it stops a future edit — or an
injection — from pointing the form's `action` at somewhere else and exfiltrating what
a visitor typed. That is the same class of protection `script-src` gives, applied to
the one surface on this site that accepts input.

### `img-src 'self'` — supplied later, and the policy is now complete

> **Added by
> [AWK-28](https://linear.app/awkale/issue/AWK-28/decide-how-contentful-asset-images-are-delivered)**
> — see [ADR-0013](0013-asset-image-delivery.md).

This directive was left unset because writing it required knowing how Contentful
assets are delivered, and [ADR-0003](0003-portfolio-content-model.md) **did not
say**. Contentful serves assets from `images.ctfassets.net` by default, a
third-party origin — so hotlinking would have let a tracking surface in through the
back door of the decision that just banned tracking, without violating its letter.

ADR-0013 closes it: asset images are proxied by **Netlify Image CDN** from this
site's own origin, so the browser never connects to Contentful. The value is
therefore **`img-src 'self'`** — nothing else, not even `data:`.

**With `script-src`, `form-action` and `img-src` all settled, this policy is fully
specified** and blocked on nothing. Writing it remains build work.

Note the argument that decided it was **not** the privacy one this record would have
made. Contentful's Free plan pauses its delivery APIs at 100% of a 50 GB asset
bandwidth limit, so hotlinking would have put image availability behind a second
vendor's free tier — and this record's own consequence is that **nothing on this site
can report a failure like that.** See ADR-0013.

## Consequences

**Nothing is added to the document head or body for measurement.** The site ships no
third-party script tags at all.

**Writing the CSP and wiring the script hash is build work**, and since
[AWK-28](https://linear.app/awkale/issue/AWK-28/decide-how-contentful-asset-images-are-delivered)
supplied `img-src 'self'` it is **blocked on nothing** — every directive is settled.
Note `public/_headers` also carries the staging `noindex` block
marked *REMOVE AT CUTOVER*, and [ADR-0011](0011-input-surface.md) adds a per-path
`noindex` for `/contact/sent/` that the removal of that block would otherwise
expose — so the same edit now touches three things and they want doing together.

**The `curl` sweep is the accepted mitigation for having no request log.** One
post-cutover pass over the thirteen redirects and the old URL inventory. It is
tracked with redirect thirteen rather than separately, because it tests exactly that
file's output.

**The hash couples this record to the theme script.** Any change to
[ADR-0004](0004-design-system-and-tokens.md)'s inline script invalidates the CSP and
must regenerate it. That is the standing cost of choosing enforcement over a stated
intention.

**Netlify Analytics was never evaluated on its merits**, and deliberately so. AWK-16
established the account is on a frozen **Legacy Free** plan where migrating to
credit-based pricing is **irreversible**, so a paid server-side add-on was not a
neutral option. Since the answer is "none", the question never had to be opened —
but if the trigger ever fires, note that this path costs more than a subscription.

**Requests are unmetered on legacy**, so nothing here was driven by cost. This is a
preference about being measured, recorded as a decision.
