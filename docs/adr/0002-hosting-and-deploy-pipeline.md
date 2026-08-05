---
status: accepted
---

# Hosting and deploy pipeline for awkale.me

The rewritten site is built by Netlify from a fresh `awkale/awkale.me` repository
(default branch `master`), prerendering every route at build time from the
Contentful space `3iiyvj5u5c9h`. A Contentful publish webhook triggers a Netlify
build hook. DNS stays at Namecheap: an ALIAS record at the apex points to the
Netlify site, `www` follows it, and the apex remains canonical. The old
`awkale/awkale.github.io` has Pages explicitly disabled and is archived
read-only, at cutover and not before.

## Email pins the DNS zone to Namecheap

`awkale.me` carries five MX records pointing at Namecheap Email Forwarding
(`eforward1` through `eforward5.registrar-servers.com`) plus an SPF TXT scoped
to `spf.efwd.registrar-servers.com`. That is the service behind `hi@awkale.me`,
and Namecheap's free forwarding only works while the domain sits on Namecheap's
own nameservers — copying the MX records to another provider is not sufficient,
because the forwarding hosts stop accepting mail for a domain Namecheap is no
longer authoritative for.

So **delegating the zone to Netlify DNS or Cloudflare breaks email**, and any
future move must be preceded by migrating email to a real provider. This is the
single most important thing in this record: nothing in the repository hints that
the domain does anything but serve a website, and Netlify's own documentation
recommends Netlify DNS as the default. Two further TXT records — a Google
site verification and a Keybase site verification — must also survive any zone
move.

## GitHub Pages cannot issue redirects

[ADR-0001](0001-url-structure.md) commits to twelve redirects: `/portfolio/` to
`/projects/`, two `/portfolios/*` entries to their case studies, and nine
`/cheatsheets/*` URLs to external GitHub Gists. GitHub Pages has no redirect
mechanism at all — the closest approximation is twelve stub pages carrying
`<meta http-equiv="refresh">`, which return 200 rather than 301 and, for the
nine cross-origin gist targets, render a visible flash before navigating.

This, not build hooks or deploy previews, is why the site left Pages. A static
host that cannot express a redirect cannot implement the URL structure the
previous ADR settled on.

## Considered options

**Host.** GitHub Pages via Actions was the incumbent-flavoured option — no new
vendor, DNS and TLS already correct — but it fails the redirect requirement
above, and the Contentful webhook would have to reach it through a hand-rolled
`repository_dispatch` chain with a PAT. There is no existing `.github/workflows`
to extend, so this was a greenfield build either way. Netlify won on
`_redirects` giving real 301s, a build hook that pairs directly with a Contentful
webhook, and env-var secret storage that keeps tokens out of a public repository.
Cloudflare Pages is comparable but its natural pairing is Cloudflare DNS, which
the email constraint forbids. Vercel is strongest when the framework is Next,
which is a question ADR-0002 does not answer and
[AWK-8](https://linear.app/awkale/issue/AWK-8/choose-the-static-rendering-layer-above-vite)
does.

**Repository.** Rewriting in place would have kept 83 commits, the Contentful
importer, and this ADR directory with no migration work, and the repository
would have been renamed to `awkale.me` at cutover — `awkale.github.io` names a
service that will no longer exist. A fresh repository was chosen instead, at the
cost of hand-migrating `scripts/contentful/`, `Wikipedia BSO Archive.xlsx`,
`CONTEXT.md`, `docs/adr/`, `AGENTS.md`, `docs/agents/`, the `.gitignore` token
rules, and the eight Cision screenshots in `assets/images/`. Left behind:
`bower_components/` (217 tracked files of jQuery, bootstrap-sass 3 and animejs),
a committed `.sass-cache/`, all Jekyll scaffolding, `_cheatsheets/`, and the two
`_portfolios/` stubs.

`awkale/awkale` was proposed as an existing empty repository and rejected on
inspection: it is the GitHub **profile README** repository, whose `README.md`
renders at `github.com/awkale`. Using it would make the site's README the
profile page. The name carries no advantage, since Netlify is indifferent to it.

**Staging before cutover.** Netlify serves the new site at `<site>.netlify.app`
from the first deploy, so `awkale.me` can keep serving the 2016 Jekyll site for
as long as the rewrite takes. That URL is public, and a partially built site of
637 pages is exactly what a crawler will index and then rank. Site-wide password
protection is a paid Netlify feature; an edge function doing basic auth was
rejected as friction for design review, given the content is destined to be
public. The chosen answer is a sitewide `X-Robots-Tag: noindex` in `_headers`,
removed at cutover.

**Rebuild trigger.** `import_to_contentful.py --publish` publishes roughly 2,383
entries one at a time in dependency order. A naively wired publish webhook turns
that single command into roughly 2,383 builds, against a free-tier budget of 300
build minutes per month and a 637-page prerender that plausibly takes one to
three minutes. A daily scheduled build sidesteps the problem entirely but makes
a typo fix wait up to 24 hours; a debouncing function handles it automatically
but needs stateful coalescing on serverless. The chosen answer is a webhook
scoped to the content types the site renders, plus a mandatory step in
`scripts/contentful/README.md` to disable the build hook before any bulk run.
Bulk publishing is already a deliberate multi-command ritual; it gains one more
command.

**Cutover shape.** A staged cutover — flip DNS once `/projects` and the twelve
redirects work, with `/concerts` following — would retire the old site sooner and
decouple the rewrite from the archive's unresolved data problems. A single
cutover with both sections live was chosen instead, matching ADR-0001's v1
sitemap and treating the twelve redirects as one ledger.

## Consequences

**The apex stays canonical, and Namecheap supports the ALIAS it needs.** Every
URL in ADR-0001, the existing TLS certificate, and the current `CNAME` file
assume `awkale.me` rather than `www.awkale.me`. An apex cannot use a CNAME — the
name has to carry the zone's `NS` and `SOA` records, which a CNAME may not
coexist with — so pointing it at a platform hostname needs an ALIAS/ANAME.
Namecheap offers one on `BasicDNS`, `FreeDNS` and `PremiumDNS` alike at no extra
cost, and `awkale.me` is on `BasicDNS`. Netlify's target is the hostname
`apex-loadbalancer.netlify.com`, so the earlier fallback — a plain A record to
`75.2.60.5` — is not needed, and neither is the concern about maintaining a
hardcoded third-party address.

Two operational details follow. The apex currently holds **four GitHub Pages A
records** (`185.199.108–111.153`), and Namecheap will not create an ALIAS on a
host that already has `A`, `AAAA` or `CNAME` records — so the cutover is
delete-then-add, not add. And Namecheap caps ALIAS TTL at one or five minutes,
which bounds the rollback window to about five minutes and shrinks the
propagation half of the TLS gap below — issuance time is Let's Encrypt's and is
not governed by the TTL.

**`netlify.toml` gains an `[images]` block.**

> **Added by
> [AWK-28](https://linear.app/awkale/issue/AWK-28/decide-how-contentful-asset-images-are-delivered)**
> — see [ADR-0013](0013-asset-image-delivery.md).

Asset images are proxied through **Netlify Image CDN**, which requires remote source
origins to be named in a `remote_images` allowlist. That is the second thing this
project hand-writes into `netlify.toml` after the build block, and it sits well with
the config-as-code reasoning that chose Netlify here — unlike ADR-0011's Forms
detection, which is a dashboard toggle with no file equivalent.

It also puts image bytes on **this account's** 100 GB bandwidth meter rather than
Contentful's 50 GB one. Both are hard stops on their respective free plans; the
choice was deliberate and ADR-0013 records why.

**The apex costs some CDN routing, and that is accepted.** Netlify's guidance
for third-party DNS is that an apex configured this way "can't take advantage of
direct DNS routing on a global CDN like Netlify's", and it recommends a
subdomain as the primary hostname whenever external DNS is in play. That
conflicts with the apex-canonical commitment above, and the conflict does not
resolve: the email forwarding pins the zone to Namecheap, and the twelve
redirects, the existing certificate and every URL in ADR-0001 assume the bare
domain. The routing cost is therefore accepted knowingly rather than avoided.

**There is a short TLS window at cutover.** The current certificate covers
`awkale.me` and `www.awkale.me` and expires 2026-09-30. Netlify provisions its
own via Let's Encrypt, but validation requires DNS to already resolve to
Netlify — so the certificate cannot be pre-issued, and there is a brief gap
between flipping the ALIAS and the certificate being served.

**Disabling Pages is a separate step from archiving.** `awkale.github.io` is a
user site, so after DNS moves it would continue serving the 2016 Jekyll site at
`https://awkale.github.io/` as a duplicate of content now living at `awkale.me`.
Archiving a repository does not disable Pages. Both steps belong in the cutover
runbook, in that order.

**Build duration is a recurring cost, not a one-off.** Because every content
publish triggers a rebuild, the time to prerender 637 pages consumes the monthly
build-minute budget continuously. This is a selection criterion for the static
rendering layer, and is recorded on
[AWK-8](https://linear.app/awkale/issue/AWK-8/choose-the-static-rendering-layer-above-vite).

> **Note on the figures above.** The `637 pages` used throughout this record —
> in the staging-and-crawler reasoning, the webhook cost estimate, and the
> paragraph immediately above — is superseded by
> [ADR-0006](0006-performance-history-content-model.md), which limited `/concerts`
> to the concerts Alex actually performed. The published total is now a rule
> rather than a figure, roughly 597 + N and moving. None of the conclusions here
> change: a smaller site indexes just as readily, and a smaller prerender is
> cheaper, so both arguments hold with room to spare.
>
> The *other* premise in the webhook estimate — that build minutes are what
> Netlify meters — has since been **confirmed**, by
> [AWK-16](https://linear.app/awkale/issue/AWK-16/confirm-what-netlify-actually-meters-and-what-throttles-deploys).
> Netlify's credit-based plans do meter deployments rather than build minutes,
> but they bind only accounts created after 2025-09-04; the `awkale` team dates
> to 2018-10-08 and so sits on a **Legacy Free** plan, where the 300
> build-minutes figure used above is correct.
>
> One correction to it, though: on the Free tier the 300 minutes is a **hard
> stop, not a budget**. Legacy Starter and Pro buy their way past it at $7 per
> 500 minutes; Free cannot, so exhausting the allowance does not produce an
> invoice, it produces a site that cannot be deployed until the cycle resets —
> the worse failure during a cutover. Bandwidth (100 GB/month) is a hard limit
> on the same terms, and legacy does not meter web requests at all.
>
> This also settles the alternative the *Rebuild trigger* section weighed. At a
> one-to-three-minute prerender, 300 minutes is 100–300 builds per month, which
> is ample for steady-state publishing — so the scoped webhook plus a manual
> disable before bulk runs is sufficient, and the debouncing function it was
> measured against solves a problem this plan does not have. Under the credit
> reading the same allowance would have been roughly 20 production deploys per
> month, and debouncing would have been mandatory rather than optional. The
> bulk-import conclusion itself was never at risk either way: ~2,383 publishes
> cost 2,383–7,149 build minutes, or 35,745 credits, against an allowance of
> 300.
>
> **Do not optimise into the build-minute model.** Legacy plans are closed to
> new accounts and migrating off one is irreversible, so if the plan ever moves
> the binding constraint flips from build *duration* to deploy *frequency* and
> the debouncing question reopens immediately. The design above happens to be
> robust to that flip; it should stay that way.

**An unpublished import renders an empty site.** The build reads the Contentful
Delivery API, which returns only published entries, and the importer creates
drafts by default with publishing behind a separate `--publish` flag. If the BSO
import ran but was never published, the site prerenders successfully with no
content. Verifying this is
[AWK-9](https://linear.app/awkale/issue/AWK-9/audit-the-contentful-space).

**Two Contentful tokens with different homes.** The build needs a read-only
Delivery token, held in Netlify env vars alongside `CONTENTFUL_SPACE_ID` and
`CONTENTFUL_ENVIRONMENT`. The `CFPAT-…` Content Management token can write and
must never enter CI — it stays local, in `~/.contentful-cma-token`, because the
repository is public.

**The nine gist targets are recorded here.** ADR-0001's redirect ledger names the
cheatsheet URLs but not their gists. All eight sheets live under
`gist.github.com/awkale/`, with `/cheatsheets/` itself going to
`gist.github.com/awkale`:

| Cheatsheet | Gist |
| --- | --- |
| `bash` | `2de8e3b6334f1f1514b8` |
| `git` | `922318f72934b500ce468d0ae36fc3fa` |
| `homebrew` | `2a4c8f344b04bc29deb500aad2d72636` |
| `javascript` | `1128e3349d5c2e79cc5e` |
| `rails` | `5b1c5b8f63de792b6c86` |
| `ruby` | `459ffd17364956d98bd0` |
| `terminal` | `6116732` |
| `vim` | `e9be49111319b0b28b206b5aa217f7fb` |

> **This table was wrong on all eight pairings, and is corrected above.** Found by
> [AWK-45](https://linear.app/awkale/issue/AWK-45/write-the-thirteen-redirects-then-run-the-post-cutover-curl-sweep)
> while writing `public/_redirects` from it.
>
> The **set** of ids was right; the pairing was a permutation of it — a six-cycle
> (`bash`→`homebrew`→`git`→`terminal`→`javascript`→`vim`→`bash`) plus a
> `rails`/`ruby` swap. Written from this record unchecked, **every one of the eight
> cheatsheets would have redirected to the wrong gist** — and each wrong target
> returns a healthy 200, so the curl sweep would have passed, and nothing would
> ever have caught it. It is the worst failure shape available here: silent,
> permanent, and invisible to its own test.
>
> **The claim that made it dangerous was this record's own.** It said the ids
> "existed only in `_cheatsheets/*.md` in a repository scheduled for archival",
> which reads as *this is now the only copy* — so a reader has no reason to look
> further. That was never true, and is not true now: the old repo is still on disk
> at `~/Sites/awkale.github.io`, unarchived, and `_cheatsheets/*.md` carries one
> `<script src="…">` per file. **It is the source of truth; this table is a
> convenience.** The corrected pairings were read from it and re-verified against it
> file by file.
>
> **Corrected in place, unlike every other amendment here.** ADR-0001 keeps its
> "Twelve URLs need redirects" sentence standing with the correction beneath it, and
> that is the right default: it keeps the history legible. A wrong **reference table**
> is different, because its whole purpose is to be copied — leaving eight bad ids
> above a note saying they are bad invites exactly the mistake this amendment exists
> to stop. The history is not lost: the permutation is described precisely enough
> above to reconstruct the old table.
>
> This is the second time a redirect fact has been wrong in exactly this way — see
> ADR-0001's amendment on redirect thirteen, which the same repository would have
> revealed. The generalization is [AWK-5](https://linear.app/awkale/issue/AWK-5/rewrite-awkaleme-portfolio-performance-history)'s
> most-repeated lesson pointed at a specific place: **for any question about the old
> URL space, read the old repo, not a record about it.**
