# 0001 — Static-rendering layer above Vite

- **Linear issue:** AWK-8 — "Choose the static-rendering layer above Vite"
- **Date:** 2026-07-31
- **Status:** Research complete — recommendation below, pending an implementation spike (see Open Questions)

## Question

`vite build` emits a client bundle and one `index.html` — a SPA, not a static site. Something has to sit above Vite and emit real prerendered HTML per route.

Fixed inputs (not relitigated here): Netlify hosting from `awkale/awkale.me` (default branch `master`); Contentful space `3iiyvj5u5c9h`, ~2,383 entries across 11 content types, publish webhook → Netlify build hook; must be prerendered at build time; React + Vite + shadcn/ui; ~637 + N pages (~127 concerts, ~156 composers, ~348 works nested at `/concerts/composers/<composer>/works/<work>`, plus facet index pages for season/hall/soloist/conductor/genre, plus project case studies); 12 real 301s already solved via Netlify `_redirects`.

Candidates evaluated: React Router framework mode with `prerender`, Vike, TanStack Start, Astro, Next.js.

## Recommendation

**Use React Router framework mode with `ssr: false` + `prerender`, pinned to the v7.x line (7.18.x) for the initial build.**

> **Superseded on the version only, 2026-08-03: the build ships React Router 8.3.0.**
>
> The framework choice, `ssr: false` + `prerender`, and every finding below stand.
> Only the pin changed. `bun create react-router` now scaffolds `react-router: ^8`,
> `@react-router/dev: ^8` and `vite: ^8` by default, so 7.18.x had become the
> off-path choice — and the pin's stated rationale, avoiding new surface area, no
> longer described reality once v8 was what the official template produced.
>
> The incremental `v8_*` future-flag sequence recommended below is therefore moot:
> those flags *are* v8. `#15350` (base path + prerender) was never checked before
> adopting, which is the one loose thread in this decision — it does not affect this
> site, which has no base path, but the "move once #15350 closes" condition was
> dropped rather than met.
>
> Re-verified on 8.3.0 rather than assumed: `prerender` with `ssr: false` emits real
> HTML per route into `build/client`, and an unknown path returns a **real 404**
> rather than an empty `HydrateFallback` shell — the finding this document calls the
> most valuable one, and the reason a catch-all redirect must never be added.
> `__spa-fallback.html` is still emitted and still unreferenced, which is the state
> to preserve.
>
> **Not re-measured on v8:** the 22 s / 594-route build time, the peak-RSS figures,
> the `concurrency` sweep, and the [#15255](https://github.com/remix-run/react-router/issues/15255)
> non-reproduction. Those were all taken on 7.18.x and are now indicative rather
> than current. The 41× headroom is wide enough that this is unlikely to matter, but
> it is unmeasured, not confirmed.
>
> **This decision has no ADR.** It lives in this research document, which by the
> map's own convention holds findings rather than records. The rendering layer,
> arguably the most consequential technical choice in the effort, is therefore
> spec'd nowhere in `docs/adr/`. ADR-0004 compounds it by attributing the pin to
> ADR-0002, which never mentions React Router at all — corrected there.

Three reasons decided it:

1. **It is the only candidate that keeps "React + Vite + shadcn/ui" literally true.** The rendering layer is the React Router Vite plugin — no new page language, no framework-specific component model, no second build system. shadcn/ui ships a first-class React Router path (`pnpm dlx shadcn@latest init -t react-router`, listed as one of seven frameworks on shadcn's installation page) ([shadcn/ui installation](https://ui.shadcn.com/docs/installation), [React Router guide](https://ui.shadcn.com/docs/installation/react-router)). Nothing needs manual wiring.

2. **`prerender` expresses the Contentful problem in its natural shape.** It accepts an async function that returns the path list, so a single build-time sweep of the Contentful Delivery API produces all 637+ paths in one place, and route `loader`s then run at build time to fill each page: *"When pre-rendering, loaders are used to fetch data during the production build"* ([Data Loading](https://reactrouter.com/start/framework/data-loading)). With `ssr: false`, *"No runtime server is needed. The application is deployed to a static file server"* ([Pre-Rendering](https://reactrouter.com/how-to/pre-rendering)). Output is `[url].html` per route in `build/client` — a plain publish directory for Netlify, which leaves `_redirects` completely alone.

3. **The SSG path is first-class in a heavily-backed project, not a community add-on.** `prerender` is a documented field of `react-router.config.ts` in the current v8 docs ([config reference](https://reactrouter.com/api/framework-conventions/react-router.config.ts)), and it has been actively developed: `prerender.unstable_concurrency` introduced in `@react-router/dev` 7.9.5 and **stabilized as `prerender.concurrency` in 7.15.0** — a maintainer investing in prerender *build speed* is the signal that matters for a 637-page budget. The repo has 56,536 stars, 801 watchers, MIT, last push 2026-07-30, and ships releases roughly weekly (7.14.1 → 7.18.2 between 2026-04-13 and 2026-07-28) ([repo metadata](https://api.github.com/repos/remix-run/react-router), [releases](https://api.github.com/repos/remix-run/react-router/releases)).

## Tradeoffs of the recommendation

Honest costs of this pick:

- **`ssr: false` forbids `action` and `headers` route exports.** *"you cannot include `actions` or `headers` functions in any routes when `ssr:false` is set because there will be no runtime server to run them on"* ([Pre-Rendering](https://reactrouter.com/how-to/pre-rendering)). Any future contact form or search endpoint needs a Netlify Function or Netlify Forms, not a React Router action.
- **Roughly double the output files.** Prerendering emits both `[url].html` and `[url].data` per route ([Pre-Rendering](https://reactrouter.com/how-to/pre-rendering)) — ~1,300 files for 637 pages. Not a problem for Netlify, but it is real build I/O and deploy-diff volume.
- **Full-app hydration.** Every page ships and hydrates the whole React tree. For a concert archive that is mostly text and tables, this is the single biggest thing given up versus Astro's islands model, where framework components *"only render on the server, as static HTML"* unless given a `client:*` directive ([Astro framework components](https://docs.astro.build/en/guides/framework-components/)).
- **Netlify does not document this path.** Netlify's React Router framework guide documents only the server deployment via `@netlify/vite-plugin-react-router` targeting Serverless or Edge Functions; the static/`ssr:false` route is not covered ([Netlify React Router guide](https://docs.netlify.com/build/frameworks/framework-setup-guides/react-router/)). Practically this means a hand-written `netlify.toml` with `publish = "build/client"` — trivial, but unsupported-by-recipe.
- **A live major-version transition.** React Router 8.0.0 shipped 2026-06-17 and 8.3.0 on 2026-07-22, while 7.18.2 still shipped 2026-07-28. v8 raises floors to Node 22.22+, React 19.2.7+, and Vite 7 with `future.v8_viteEnvironmentApi` ([v7→v8 upgrade guide](https://reactrouter.com/upgrading/v7)). Starting on 7.18.x and adopting the `v8_*` future flags incrementally is the low-risk sequence; the upgrade guide explicitly recommends adopting those flags while on 7.x.
- **Two open prerender bugs are relevant to us.** `#15350` "Base public path not working with prerender in v8" (open, 2026-07-27) and `#15255` "Preview server prerendering fails with ECONNREFUSED (cold-start race)" (open, 2026-06-29), which the reporter notes gets more frequent on constrained CI runners with many routes ([issue search](https://github.com/remix-run/react-router/issues)). At 637 routes on a Netlify build container, `#15255` is the one to watch. `prerender.concurrency` is the mitigation lever.

## Runner-up and when it would win

**Astro.** The decision should flip to Astro if either of these turns out true during the spike:

1. **Hydration cost dominates.** If the shipped-JS budget or TTI on the long-tail work/composer pages matters more than authoring everything in one React idiom, Astro's islands win outright — shadcn components ship zero JS unless explicitly marked `client:load`/`client:visible`, and shadcn has an official Astro installation guide ([shadcn Astro](https://ui.shadcn.com/docs/installation/astro), [Astro framework components](https://docs.astro.build/en/guides/framework-components/)).
2. **React Router's prerender proves flaky or slow at 637 routes.** Astro's `getStaticPaths()` is the most exercised content-site SSG story in the Vite ecosystem; it returns `params` (+ optional `props`) per page and *"executes once during your build, allowing you to populate routes from any data source"* ([Astro routing](https://docs.astro.build/en/guides/routing/)). Astro 7.1.6 shipped 2026-07-29 with a maintained first-party `@astrojs/netlify` 8.1.3 and `@astrojs/react` 6.0.2 ([releases](https://api.github.com/repos/withastro/astro/releases)).

The price of flipping: pages and layouts become `.astro` files, not React. React survives only as leaf components. That is a partial exit from the "React + Vite" stack intent, which is why it is the runner-up and not the pick.

## Comparison table

| | React Router (framework mode) | Astro | Vike | TanStack Start | Next.js |
|---|---|---|---|---|---|
| **1. True SSG output** | Yes — `[url].html` per route with loader data baked in; `ssr:false` means no runtime server. Non-prerendered paths in an `ssr:false` app degrade to a `HydrateFallback` shell (7.2.0), so the path list must be complete. | Yes — static output is the default; framework components render to static HTML with no JS unless a `client:*` directive is added. | Yes — `vike build` writes HTML to `dist/client/`, *"eliminating the need for a production server"*. | Yes in principle — prerender writes `/page/index.html` (or `/page.html` with `autoSubfolderIndex: false`). Static-only deploy is **not** a documented hosting target. | Yes — but leaves Vite entirely. |
| **2. Prerendering at this scale (637+)** | `prerender.concurrency` stabilized in 7.15.0 specifically to speed up prerendering. Open issue #15255 flags a cold-start race that worsens with many routes on constrained CI. **Wall-clock at 637 routes: unverified.** | Purpose-built for this; large content sites are the primary use case. **Wall-clock: unverified.** | `parallel` option controls concurrency; `noExtraDir` controls output shape. **Unverified at this scale.** | `concurrency` default 14, `retryCount` 2, `retryDelay` 1000ms, `failOnError` true. Retry machinery implies flakiness is expected. **Unverified at this scale.** | Well proven; irrelevant given the Vite constraint. |
| **3. Build-time Contentful loading** | **Best fit.** `prerender` accepts an async function (`async prerender({ getStaticPaths })`) returning the path array — one CDA sweep enumerates everything; route `loader`s then run at build. | `getStaticPaths()` per dynamic route, can fetch from any source at build; returns `params` + `props`, so the entry payload rides along and avoids a second fetch. | `onBeforePrerenderStart()` hook per route returns the URL list — a direct analogue of the RR function form. | **Weakest fit.** `prerender.pages` is `z.array(pageSchema)` in the plugin schema — *not* a function, not async. Dynamic enumeration is expected to come from `crawlLinks: true` crawling links out of index pages, or from making `vite.config.ts` itself async. Routes with path params are *excluded* from auto-discovery. Docs do not cover CMS enumeration. | `generateStaticParams`. Fine, but out of scope. |
| **4. shadcn/ui compatibility** | **First-class.** Listed framework; `init -t react-router`; Tailwind + `~/*` alias already present in `create-react-router`. | **First-class.** Listed framework; needs the React + Tailwind integrations and an `@/*` alias in `tsconfig.json`. Interactive components need `client:*` directives — a real authoring tax. | **Not listed.** Not among shadcn's seven framework guides; `vike.dev/tailwind-css` does not mention shadcn/ui at all. Manual Tailwind + alias + `components.json` wiring. | **First-class.** Listed framework; `init -t start`. Caveat: do not select the `shadcn` add-on in TanStack's own CLI. | **First-class** (the reference target). |
| **5. Maintenance risk** | **Low.** 56.5k stars, 801 watchers, MIT, weekly releases, Remix/Shopify-backed. Risk is v7→v8 churn, not abandonment. | **Low.** Frequent releases (7.1.6 on 2026-07-29), broad org with first-party Netlify + React adapters. | **High (bus factor).** 5,793 stars, 16 watchers. Top contributor `brillout` has 12,587 commits; #2 has 297. Still `0.4.x` after 5+ years (created 2021-01-28); 15 releases published in a single day (2026-06-23). | **Medium-high (churn).** v1 was announced as a **Release Candidate** on 2025-09-23, not a stable 1.0. Current `@tanstack/react-start` is `1.168.34` (2026-07-30) with near-daily releases and a parallel `2.0.0-beta` line for Solid. | Low, but disqualified by the Vite constraint; the releases feed in the sampled window is entirely `v16.3.0-canary`/`preview`. |

## Per-candidate notes

### React Router framework mode — **recommended**

Configuration forms, verbatim from [reactrouter.com/how-to/pre-rendering](https://reactrouter.com/how-to/pre-rendering):

```ts
export default {
  async prerender({ getStaticPaths }) {
    let slugs = await getPostSlugsFromCMS();
    return [
      ...getStaticPaths(), // "/" and "/blog"
      ...slugs.map((s) => `/blog/${s}`),
    ];
  },
} satisfies Config;
```

The v8 config reference additionally documents the object form with concurrency ([config reference](https://reactrouter.com/api/framework-conventions/react-router.config.ts)):

```ts
prerender: {
  paths: ["/", "/about", "/contact"],
  concurrency: 4,
}
```

Output, per the how-to page: `build/client/blog/my-first-post/index.html` plus `build/client/blog/my-first-post.data`. The `.data` files serve client-side navigations, which is what makes navigation between the 348 work pages feel like an SPA rather than a full document load — a genuine upside over Astro for a densely cross-linked archive.

Critical constraint discovered in the changelog for 7.2.0 ([`react-router` CHANGELOG](https://raw.githubusercontent.com/remix-run/react-router/main/packages/react-router/CHANGELOG.md)): in an `ssr:false` app, *"When a `prerender` config exists but the current path is not prerendered, only SSR down to the root `HydrateFallback` (SPA Fallback)"*. **Any route omitted from the path list silently degrades to an empty hydration shell** — exactly the failure mode axis 1 is guarding against. The path enumeration must therefore be exhaustive and should be asserted in CI (count check against the Contentful entry counts). The same release added a build-time error for a related footgun: a prerendered parent route with a `loader` (no `clientLoader`) whose children are not prerendered.

Version posture: pin `7.18.x`, adopt `future.v8_middleware`, `v8_splitRouteModules`, `v8_viteEnvironmentApi`, `v8_passThroughRequests`, `v8_trailingSlashAwareDataRequests` incrementally per the [upgrade guide](https://reactrouter.com/upgrading/v7), then move to v8 once `#15350` (base path + prerender) is closed.

### Astro — runner-up

`getStaticPaths()` in static output mode ([routing guide](https://docs.astro.build/en/guides/routing/)):

```astro
export function getStaticPaths() {
  return [
    { params: { dog: "clifford" }},
    { params: { dog: "rover" }},
    { params: { dog: "spot" }},
  ];
}
const { dog } = Astro.params;
```

The `props` channel is a genuine advantage over React Router here: `getStaticPaths` can return the Contentful entry alongside the params, so one sweep both enumerates the routes *and* supplies the data — no per-route loader refetch. Nested routes like `/concerts/composers/[composer]/works/[work]` fall out of the file-based routing directly.

The cost is architectural, not technical: pages and layouts are `.astro`. shadcn/ui works — it is one of shadcn's seven documented frameworks, requiring the React and Tailwind integrations plus `paths: { "@/*": ["./src/*"] }` ([shadcn Astro](https://ui.shadcn.com/docs/installation/astro)) — but every interactive shadcn component needs an explicit `client:*` directive, and shared React state across islands is deliberately awkward. Astro is Vite-based but replaces Vite's own build conventions, as the ticket notes.

Health is good: `astro@7.1.6` on 2026-07-29, with `@astrojs/netlify@8.1.3`, `@astrojs/react@6.0.2`, `@astrojs/mdx@7.0.5` all released the day before ([releases](https://api.github.com/repos/withastro/astro/releases)).

### Vike — ruled out on bus factor and shadcn friction

Feature-wise Vike is the closest analogue to the recommendation and would otherwise be competitive. `prerender: true` in `+config.js`, `onBeforePrerenderStart()` per route to supply the URL list for parameterized routes, `partial` opt-in/opt-out, `parallel` and `noExtraDir` for output control; HTML lands in `dist/client/` with no production server ([vike.dev/pre-rendering](https://vike.dev/pre-rendering)).

It is ruled out on maintenance risk (axis 5) and shadcn friction (axis 4):

- Contributor concentration is extreme: `brillout` 12,587 commits vs `lourot` 297 vs everyone else under 60 ([contributors API](https://api.github.com/repos/vikejs/vike/contributors)). 16 watchers, 5,793 stars ([repo metadata](https://api.github.com/repos/vikejs/vike)).
- Still pre-1.0 at `v0.4.260` (2026-06-28) after five and a half years, with fifteen releases published on a single day, 2026-06-23 ([releases](https://api.github.com/repos/vikejs/vike/releases)).
- No shadcn/ui installation path: Vike is absent from shadcn's framework list ([shadcn installation](https://ui.shadcn.com/docs/installation)), and `vike.dev/tailwind-css` only says *"Use vike.dev/new to scaffold a new Vike app that uses Tailwind CSS"* with no shadcn mention ([Vike Tailwind](https://vike.dev/tailwind-css)). A `vike.dev/shadcn-ui` page returns 404.

For a personal archive site expected to sit untouched for long stretches, a single-maintainer pre-1.0 framework is the wrong risk to take on.

### TanStack Start — ruled out on data-loading shape and stability

The prerender API is real and shipped, but the wrong shape for "generate a page per Contentful entry." From the plugin's zod schema ([`start-plugin-core/src/schema.ts`](https://raw.githubusercontent.com/TanStack/router/main/packages/start-plugin-core/src/schema.ts)):

```ts
z.object({
  enabled: z.boolean().optional(),
  concurrency: z.number().optional(),
  filter: z.custom<(page) => unknown>().optional(),
  failOnError: z.boolean().optional(),
  autoStaticPathsDiscovery: z.boolean().optional(),
  maxRedirects: z.number().min(0).optional(),
})
```

and `pages: z.array(pageSchema).optional().default([])` — **a plain array, not a function and not async.** The documented mechanisms for reaching dynamic routes are `crawlLinks: true` (extract links from rendered HTML and follow them) or manually listing pages; routes with path params such as `/users/$userId` are explicitly *excluded* from auto-discovery, and the docs do not cover CMS enumeration ([Static Prerendering](https://tanstack.com/start/latest/docs/framework/react/guide/static-prerendering)). Crawling would work for our shape only if every one of the 637 pages is reachable by link from an index page — a fragile invariant to hang the whole site on. The workaround (an async `vite.config.ts` that fetches Contentful at config time) is possible but puts CMS I/O in the build config.

Stability: the "v1" announcement of 2025-09-23 is explicitly a **Release Candidate** — *"the build we expect to ship as 1.0, pending your final feedback, docs polish, and a few last-mile fixes"* ([announcement](https://tanstack.com/blog/announcing-tanstack-start-v1)). Current `@tanstack/react-start` is `1.168.34` published 2026-07-30, with releases most days and a concurrent `@tanstack/solid-start@2.0.0-beta.29` line ([releases](https://api.github.com/repos/TanStack/router/releases), [npm registry](https://registry.npmjs.org/@tanstack/react-start)).

Hosting: TanStack Start documents Cloudflare Workers, Netlify (official partner, via `@netlify/vite-plugin-tanstack-start`), Railway, Nitro, Vercel, Node/Docker, Bun, and Appwrite — **but not a static-only deployment** ([hosting docs](https://tanstack.com/start/latest/docs/framework/react/guide/hosting)). The framework's centre of gravity is full-stack; SSG is a side path.

shadcn/ui support is genuinely first-class (`init -t start`), so axis 4 is not the problem here — axes 3 and 5 are.

### Next.js — ruled out on the Vite constraint

`generateStaticParams` + `output: 'export'` would do the job, and Netlify supports Next.js first-class. But the ticket fixes the stack as React + Vite, and Next.js leaves Vite entirely (it builds with Turbopack/webpack). It is also mid-major-cycle: the sampled release feed contains only `v16.3.0-canary.*` and `v16.3.0-preview.*` entries as of 2026-07-30 ([releases](https://api.github.com/repos/vercel/next.js/releases)). Noted for completeness; not evaluated further.

### Others considered and not pursued

- **Plain `vite build` + `vite-plugin-ssr`/custom prerender script.** `vite-plugin-ssr` *is* Vike (renamed), so it collapses into that row. A hand-rolled prerender script over `renderToString` is possible but means owning routing, data plumbing, head/meta management, and client hydration by hand — strictly more maintenance than any option above, with no offsetting benefit. Not pursued.
- **Gatsby.** Not on shadcn's framework list and no longer a credible React SSG choice; not pursued.

## Open questions

1. **Which Netlify plan is this account on, and does "300 build minutes" still describe the constraint?** Netlify's current credit-based plans have **no build-minutes line item at all**. Free includes **300 credits/month**; the usage table charges **15 credits per production deployment**, 10 credits per GB-hour of functions/preview-server compute, 20 credits per GB of bandwidth, and 2 credits per 10,000 web requests ([credit-based pricing plans](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/)). If that is the applicable plan, the binding constraint is **~20 production deploys/month before other usage**, not build duration — which would make a Contentful-publish-per-deploy webhook the thing to throttle (batch/debounce publishes), and would make build wall-clock much less important than the ticket assumes. Legacy plans do still use build minutes (300/cycle on Starter). **This needs confirming before optimising for build speed.**
2. **Build timeout headroom.** Netlify's default build time limit is **15 minutes** plus 5 for post-processing, self-serve raisable via API to **1800 seconds (30 minutes)**; beyond that requires support ([Netlify support guide](https://answers.netlify.com/t/support-guide-how-to-use-the-api-to-increase-your-sites-build-time-limit/52805)). Unverified whether 637 React Router prerendered routes plus a Contentful sweep fits in 15 minutes. **This is the single most important thing to spike.**
3. **Contentful sweep shape.** The CDA enforces *"a rate limit of 55 requests per second"*, and *"There are no limits enforced on requests that hit our CDN cache"* ([CDA overview](https://www.contentful.com/developers/docs/references/content-delivery-api/overview/)). At the documented default page size of 100, 2,383 entries is ~24 paginated requests — trivially within limits even before raising `limit`. **Unverified:** the maximum `limit` value (widely reported as 1000, but not stated on the fetchable overview page), and whether `include`-depth link resolution across the 11 content types keeps responses under Contentful's response-size ceiling, or whether the build must fetch flat and join in memory.
4. **Actual prerender wall-clock and memory at 637 routes**, and what `prerender.concurrency` value is safe on a Netlify build container. No published benchmark found; must be measured.
5. **Does open issue #15255 (preview-server ECONNREFUSED cold-start race) reproduce on Netlify's runner at this route count?** The report specifically implicates constrained CI runners with many routes. If it does, either raise `retry`-equivalent handling, lower concurrency, or reconsider Astro.
6. **Unverified: whether React Router v8's required `future.v8_viteEnvironmentApi` flag changes prerender behaviour.** The v7→v8 upgrade guide does not mention `prerender` or `ssr:false` at all, which is reassuring but not a guarantee.
7. **Forms/search.** With `ssr:false` banning `action` exports, any interactive server behaviour needs a Netlify Function. Not a blocker; just needs deciding before it is needed.
