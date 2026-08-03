---
status: accepted
---

# Static rendering layer for awkale.me

The site is built with **React Router in framework mode, `ssr: false` plus
`prerender`**, currently on **8.3.0**. Every route is rendered to real HTML at build
time into `build/client`, which Netlify serves as a plain static publish directory
with no functions.

This record exists late and deliberately. The decision was made in
[AWK-8](https://linear.app/awkale/issue/AWK-8/choose-the-static-rendering-layer-above-vite)
and written up as `docs/research/0001-static-rendering-layer.md`, then measured in
[AWK-17](https://linear.app/awkale/issue/AWK-17/spike-the-637-route-prerender-build).
Neither produced an ADR, so the most consequential technical choice in the effort
was spec'd only in a research document — which by this repo's convention holds
findings, not records. [ADR-0004](0004-design-system-and-tokens.md) compounded the
gap by attributing the version pin to [ADR-0002](0002-hosting-and-deploy-pipeline.md),
which never mentions React Router at all.

The research document remains the reasoning and the evidence. This is the decision.

## Why this layer

[ADR-0002](0002-hosting-and-deploy-pipeline.md) fixed prerendering at build time as
a premise, and React + Vite as the stack. Plain `vite build` emits a SPA, not HTML
per route, so a framework layer above it is required.

Three things decided it.

**`prerender` takes an async function, not an array.** That is the whole reason this
option won. It means one build-time Contentful sweep enumerates every path in a
single place, and route `loader`s then fill each page during the build. The
alternative shape — a static array, or link-crawling from a root — cannot express
"ask the CMS what exists" without a separate generation step.

**It keeps the stack literally true.** React, Vite and shadcn/ui were premises
rather than preferences; this is the only candidate that satisfies all three without
reinterpretation.

**The static path is first-class, not a community add-on.** `prerender` is a
documented field of `react-router.config.ts`, and its concurrency control was
stabilised rather than left experimental — a maintainer investing in prerender build
speed is the signal that matters for a page set this size.

## Considered and rejected

**Astro** was runner-up and remains the fallback if hydration cost ever dominates,
or if prerender proves flaky at scale. It loses on the premises: shadcn/ui and the
React component model become adaptations rather than the native path.

**TanStack Start** was ruled out on shape, not quality: `prerender.pages` is a plain
array, and enumeration is expected to come from link-crawling. Expressing 600 CMS
paths through that is fighting the tool.

**Vike** was ruled out on bus factor — one dominant contributor, still `0.4.x` after
five and a half years.

**Next.js** was ruled out because it leaves Vite, contradicting a premise.

## Version: 8.3.0, not the 7.18.x originally pinned

The research pinned `7.18.x` and set an exit condition: adopt the `v8_*` future flags
incrementally, then move to v8 once
[#15350](https://github.com/remix-run/react-router/issues/15350) (base path +
prerender) closed.

**That pin was dropped on 2026-08-03, and the exit condition was not met.** It was
superseded rather than satisfied: `bun create react-router` now scaffolds
`react-router: ^8`, `@react-router/dev: ^8` and `vite: ^8` by default, so 7.18.x had
become the off-path choice. The pin's stated rationale — avoid riding new surface
area — stopped describing reality once v8 was what the official template produced.

Being honest about the cost: **#15350 was never checked.** It concerns base path plus
prerender, and this site has no base path, so it is very likely irrelevant here. But
the condition was abandoned, not cleared, and if base-path behaviour ever matters
that thread is still loose.

### Re-verified on 8.3.0

- `prerender` with `ssr: false` emits real HTML per route into `build/client`.
- **An unknown path returns a real 404**, not an empty `HydrateFallback` shell.
- `__spa-fallback.html` is still emitted and still unreferenced.

### Not re-measured on 8.3.0

The 22-second/594-route build, the peak-RSS figures, the `concurrency` sweep, and
the [#15255](https://github.com/remix-run/react-router/issues/15255)
non-reproduction were all taken on 7.18.x. They are **indicative, not current**. The
measured headroom was roughly 41×, wide enough that this is unlikely to bite, but it
is unmeasured rather than confirmed.

## Consequences

**Never add a catch-all redirect.** This is the single most valuable thing AWK-17
found. In an `ssr: false` app, a route missing from the prerender list would serve an
empty `HydrateFallback` shell — but only if a catch-all rule routes unknown paths to
`__spa-fallback.html`. Without one, a missing page 404s loudly, which is what you
want. So it is the *redirect*, not the framework, that would turn every gap in the
archive into a silent blank page. `netlify.toml` carries this warning at the point
someone would add it.

**Prerender paths are slash-free; served URLs are not.** A trailing slash in the path
list is a hard build failure — React Router matches the route as `/projects` and
refuses to SSR `/projects/`. Netlify then 301s the slash-free form to the slash-ful
one. Two layers, both correct, and only the enumerator needs to know. Corollary from
[ADR-0001](0001-url-structure.md): write every internal `<Link to>` **with** the
trailing slash, or each one costs a needless redirect hop across ~590 pages.

**Enumeration must be exhaustive, and it is a rule rather than a count.** The path
list derives from [ADR-0006](0006-performance-history-content-model.md)'s
participation rules — a concert page iff `attended`, a work page iff at least one
(concert, item) pair is attended and not sat out, a composer page iff one of their
works qualifies. AWK-17 built the CI assertion that checks this and proved it fails
correctly: dropping a route made the build print success and exit 0 with the page
silently gone. The enumerator lives in `app/lib/prerender-paths.ts` rather than
inline in the config specifically so the assertion can import the same function the
build uses.

**`concurrency` must be omitted, never set to `undefined`.** The validator tests the
key's presence, not its value. Spread it conditionally or leave it out. The default
is `1` — fully sequential — so there was never an over-aggressive default to tame.

**`@react-router/node` is required even with `ssr: false`**, because prerendering
still renders server-side at build time. The research document does not list it.

**No `action` or `headers` exports.** Anything accepting input needs a Netlify
Function, which would be this site's first non-static surface.
[AWK-26](https://linear.app/awkale/issue/AWK-26) decides whether that ever happens;
a `mailto:` link and a build-time search index may mean it does not.

**Netlify's static path works but is undocumented.** Netlify's own React Router guide
covers only the server deployment via `@netlify/vite-plugin-react-router` targeting
Functions. The static route needs a hand-written `netlify.toml` with
`publish = "build/client"`. AWK-17 confirmed Netlify auto-detects
`framework: "react-router"` and serves it correctly regardless — a documentation gap,
not a capability gap.

**Output is roughly 2× the file count**, since each route emits both HTML and a
`.data` hydration sidecar. The sidecars are slash-free and sit as siblings of the
directory, so the namespaces do not collide. React Router 7.18 warned that v8 changes
data-request URL formats via `future.v8_trailingSlashAwareDataRequests`; on v8 that
flag is moot, but it is the one place the trailing-slash commitment touched the
upgrade path.

**Full-app hydration is accepted.** Every page ships the whole client bundle. Astro's
islands model would not, which is why it stays the recorded fallback.
