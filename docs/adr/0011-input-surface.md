---
status: accepted
---

# The input surface: no functions

`awkale.me` runs **no serverless functions and no edge functions**. Two things on
the site accept input — a contact form and archive search — and neither needs one.
The publish directory stays what [ADR-0002](0002-hosting-and-deploy-pipeline.md)
says it is: a plain static directory, with nothing beside it.

Decided in
[AWK-26](https://linear.app/awkale/issue/AWK-26/decide-whether-anything-needs-a-server).

## The premise that had to be tested, and was wrong

[ADR-0009](0009-static-rendering-layer.md) settles `ssr: false` + `prerender`,
which forbids `action` and `headers` route exports. The apparent consequence —
carried by AWK-26's own framing — was that **anything accepting input means a
Netlify Function**, the site's first non-static surface, first secret, and first
thing that can fail silently.

It does not. **Netlify Forms is a platform feature, not a function.** The build
post-processor scans the *deployed HTML* for a form carrying `data-netlify="true"`,
strips the attribute, and injects a hidden `form-name` input. Submissions POST to
the site's own origin and land in a managed store with email notification. No
function is written, deployed, or maintained.

**And it works precisely because the site is prerendered.** Netlify's own
documentation warns that forms rendered client-side by React or Vue are *not
detected*, because detection needs the markup present at deploy time — the
documented workaround is to ship a duplicate hidden form purely so the scanner can
find it. `ssr: false` + `prerender` emits real HTML per route, so this site lands on
the supported side of that warning and needs no workaround. The rendering layer was
chosen for static output and cheap hosting; that it also makes a form work without a
function is a dividend nothing planned for.

That is the third time this map has found a constraint inverted on inspection,
after
[AWK-16](https://linear.app/awkale/issue/AWK-16/confirm-what-netlify-actually-meters-and-what-throttles-deploys)'s
HITL ticket that resolved AFK and
[AWK-17](https://linear.app/awkale/issue/AWK-17/spike-the-637-route-prerender-build)'s
`prerender.concurrency` default that turned out to be fully sequential rather than
over-aggressive.

## Contact

**A form, not a `mailto:`.** `hi@awkale.me` works today via Namecheap forwarding
and is **deliberately not printed on the site** — publishing it hands the address to
scrapers permanently, and an address cannot be un-scraped. A form keeps the mailbox
private and puts Akismet in front of it.

Worth recording what the site did before, because it frames the change: the 2016
Jekyll footer's "Contact" block held **three profile links and no email at all**.
The address has never appeared on `awkale.me`.

**Two new pages, both prerendered.**

| Path | Holds |
| --- | --- |
| `/contact/` | the form, plus the three profile links |
| `/contact/sent/` | the success page the native POST redirects to |

```html
<form name="contact" method="POST" action="/contact/sent/"
      data-netlify="true" netlify-honeypot="bot-field">
```

A **native POST**, not React Router's `<Form>` and not `fetch`. React Router's
`<Form>` would intercept the submission, and `ssr: false` leaves no `action` export
to receive it. A plain `<form>` element does the ordinary browser thing, which is
exactly what Netlify's endpoint expects. It also means the form works with
JavaScript disabled and adds nothing to the client bundle —
[ADR-0004](0004-design-system-and-tokens.md) measured the site's entire
client-interactive surface as one file, and this keeps it that way.

`/contact/sent/` is a real page in the site's own typography rather than Netlify's
generic confirmation. Ending a conversion on another company's branded page is the
one moment that would be most jarring.

A **site-wide footer** carries GitHub, Threads and LinkedIn, as the old site's did,
plus a link to `/contact/`.

### Spam handling is honeypot plus Akismet, and that is all there is

**Akismet runs by default** on every submission; only submissions that pass appear
in Verified submissions, and the rest are filed as Spam. On top of that,
`netlify-honeypot="bot-field"` adds a hidden field that bots complete and humans
never see. Netlify strips the attribute during post-processing.

**reCAPTCHA is unavailable to this site**, and by prior decision rather than by
preference. Netlify's built-in option injects Google's reCAPTCHA script, which
[ADR-0010](0010-no-analytics.md) bans outright — *"no third-party client-side
beacons at all"* — and which its `script-src 'self' 'sha256-…'` would block anyway.
So the strongest anti-abuse control available on the platform is off the table, and
the two weaker ones carry the whole load.

## The failure mode that makes this different from every other limit here

This is the sharpest thing in this record, and it is a property of the plan rather
than of the form.

`awkale.me` is on a frozen **Legacy Free** account
([AWK-16](https://linear.app/awkale/issue/AWK-16/confirm-what-netlify-actually-meters-and-what-throttles-deploys)),
where Forms is metered at **100 submissions per month**. Netlify's legacy billing
documentation is explicit about what reaching a metered limit does, and forms are
not the build-minute case:

> If the build limit is reached, your sites will still be served to visitors, but
> new builds will be disabled for **all sites on your account**. For all other
> metered features, when reaching 100% of the limit, new builds will be disabled and
> **all sites on your account will be paused**.

And there is no cheap escape once it happens: *"Deleting the site with overages will
not restore the account. Once a limit is reached on the free tier, the account must
be upgraded to restore service."*

So the contact form is, in principle, a **remotely operable kill switch for every
site on the personal team** — `awkale.me` plus `awkale-starwars`, `bso`, `uxstash`,
`agent-a` and `brave-swirles-c3e5f7`. AWK-16 recorded build minutes as a hard stop
that *keeps serving*; this is a hard stop that *stops serving*, which is strictly
worse and is a distinct category. Free-tier accounts get **no automatic upgrade** to
a paid Forms level — they are simply blocked.

**What bounds it, and why this is accepted rather than fatal:**

- **Spam-flagged submissions do not consume the allowance.** Only Verified
  submissions count, so an attacker needs ~100 messages that *pass Akismet*, not 100
  POSTs. That single fact is what makes the risk tolerable.
- **Netlify emails at 50%, 75%, 90% and 100%**, so the wall is visible well before
  it arrives.
- **The kill switch has an off switch.** Disabling form detection in the Netlify UI
  takes effect immediately and needs no deploy.
- The realistic traffic for a personal site's contact form is single digits per
  month against an allowance of 100.

Accepted knowingly. The mitigation is the warning emails plus a one-click disable,
not a technical control — there is no rate limiting available without the function
this record exists to avoid.

## Archive search

**Search ships, as a build-time index filtered on the client.** No server, no
hosted service, no WASM.

The corpus is small and **fully known at build time** — 5 Projects, 147 composers,
322 works, 121 concerts, about 595 entries. The same Contentful sweep that
`prerenderPaths` already performs emits a JSON index of title, kind and path.
AWK-17 measured ~41× headroom in the build, so this costs nothing measurable.

**Scope is the whole site, not just the archive.** A search field in the site header
that could not find a case study would be a site-wide search that quietly isn't one,
so the five Projects are indexed alongside the archive and **results group by kind**
— Projects, Composers, Works, Concerts — so a case study never sorts among 322
works.

**The control is `ComboBox` from `react-aria-components`**, already a dependency at
`^1.20.0`. The index is **dynamically imported on first interaction**, so it stays
out of the initial bundle on all ~600 pages, and a dynamic import is covered by
`script-src 'self'` — no `connect-src` is needed, which a `fetch` would have
required.

### What was rejected

**Hosted search (Algolia and similar)** — ruled out on
[ADR-0010](0010-no-analytics.md) without re-litigation. It is a third-party
client-side service and a `connect-src` opening, in a record that just banned
exactly that.

**Pagefind** — the closest call, and genuinely designed for this shape:
self-hosted, post-processes built HTML, no index authoring. Rejected on two counts.
It indexes **page prose and chrome** rather than structured fields, which for a
reference tool answering "which Sibelius did I play" is the wrong retrieval model;
and it needs **`wasm-unsafe-eval`** in the CSP, a relaxation in the policy
ADR-0010 had just tightened.

**No search at all** was a defensible answer — an A–Z index plus two facets over 590
pages — and was rejected because the section's stated purpose is a *fully indexed
reference library* for its author, and the index is nearly free.

## Consequences

**Two new routes, so [ADR-0001](0001-url-structure.md) is amended.** `/contact` and
`/contact/sent` join the route table, the prerender enumerator and AWK-17's CI page
assertion. Slash-free in the enumerator, slash-ful in every `<Link to>` — the usual
two layers.

**`/contact/sent/` needs `X-Robots-Tag: noindex`.** It is a real prerendered page
with no inbound purpose. Today the sitewide staging `noindex` in `public/_headers`
covers it incidentally; that block is marked *REMOVE AT CUTOVER*, and removing it
exposes this page unless a per-path rule replaces it. The same edit already carries
the CSP, so all three want doing together.

**This record supplies the second of [ADR-0010](0010-no-analytics.md)'s two
unwritten CSP directives.** `form-action` has **no `default-src` fallback**, so that
policy as drafted would have permitted a form to POST to any origin — harmless while
no form existed, load-bearing now. `form-action 'self'` is the value. The CSP
remains blocked on
[AWK-28](https://linear.app/awkale/issue/AWK-28/decide-how-contentful-asset-images-are-delivered)
for `img-src`, and on nothing else.

**[ADR-0004](0004-design-system-and-tokens.md)'s combobox trap is moot**, and is
amended there. It instructs whoever needs a combobox to run `shadcn init` in a
throwaway directory and copy the source across, *"only if AWK-26 decides archive
search happens"*. Search happens — but that warning predates the same record's
second amendment, which replaced shadcn with `react-aria-components` as the
component source, and React Aria ships a `ComboBox`.

**Form detection is a per-site toggle in the Netlify UI, not `netlify.toml`.** This
is the first piece of this project's configuration that lives outside the repo, and
it cuts against [ADR-0002](0002-hosting-and-deploy-pipeline.md)'s config-as-code
rationale for choosing Netlify. Unavoidable — Netlify exposes no file-based
equivalent — so it belongs on the site-creation checklist beside the
`awkale.netlify.app` reclaim, where forgetting it means the form silently accepts
nothing.

**The deployed HTML no longer equals the built HTML.** Netlify's post-processor
mutates the two contact pages — stripping `data-netlify` and `netlify-honeypot`,
injecting `form-name`. This is the first step in the pipeline to do that, and it is
worth knowing before debugging a diff between `build/client` and what the browser
receives. AWK-17's CI assertion checks the page *set*, not page *contents*, so
nothing there collides with it.

**The prohibition is standing, not situational.** No functions and no edge
functions. ADR-0002 already rejected one once — an edge function doing basic auth
over the staging site — on the narrow ground that it was friction for design review.
This generalizes that into a property of the site: the publish directory is the
whole deployment. Anything proposing to break it is proposing to change this record.

**Reopening trigger.** A requirement that genuinely cannot be served by static
output plus a platform feature — not "a form would be nicer", which this record
already answers. Note that the contact form's 100-submission ceiling is *not* such a
trigger: the escape from it is a plan migration, and migrating this account to
credit-based pricing is **irreversible** and would retighten builds to roughly 20
deploys per month.
