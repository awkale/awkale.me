/**
 * A case study — the one surface driven by `.typeset-reading` rather than
 * `.typeset-compact`, and the reason two presets exist at all. Note the `typeset`
 * base class is required alongside the preset; the preset is variable overrides
 * only, so on its own it renders nothing.
 *
 * THIS ROUTE HAS NO PAGES AND NO `loader`, AND THE TWO FACTS ARE THE SAME FACT.
 *
 * ADR-0003 gives a project a page only when its `body` is non-empty, and the
 * `project` content type holds ZERO entries — creating the five is AWK-43. So the
 * enumerator produces no `/projects/<slug>` path, and React Router then REFUSES a
 * server `loader` here: with `ssr: false`, "a `loader` is permitted on any route
 * matched by a `prerender` path", and this route is matched by none. Exporting one
 * is a hard build failure — `Invalid route exports found when prerendering with
 * ssr:false` — not a warning, and AWK-39 hit it exactly that way.
 *
 * A `clientLoader` is the documented alternative and is WRONG here: it would fetch
 * at runtime in the browser, which needs a Contentful token client-side and a
 * `connect-src` relaxation of the policy ADR-0010 had just tightened. This site
 * has no runtime data source by decision.
 *
 * So the route stays in the table — ADR-0001 declares the URL shape whether or not
 * anything occupies it — and stays inert until there is data.
 *
 * WHAT AWK-43 DOES, once the first project carries a body:
 *
 *   1. Add the loader back. It is four lines:
 *
 *        export async function loader({ params }: Route.LoaderArgs) {
 *          const { projects } = await loadArchive()
 *          const project = projects.find((p) => p.slug === params.slug)
 *          if (!project) throw new Response(`No project ${params.slug}`, { status: 404 })
 *          return { project }
 *        }
 *
 *   2. Take `{ loaderData }: Route.ComponentProps` below and render `project`
 *      rather than the empty state.
 *   3. Render the body with
 *      `<RichText node={project.body} media={{ assets: images, groups: imageGroups }} />`
 *      — app/lib/richtext.tsx is written and tested against ADR-0003's enabled marks
 *      and nodes, and the sweep already carries `body` through for exactly this.
 *
 * EMBEDDED BLOCKS RENDER AS OF AWK-40, and only if the loader hands over `media`.
 * `loadArchive()` returns `images` and `imageGroups` — the resolved asset and group
 * lookups — and without them every embedded figure silently renders as nothing,
 * which is the pre-AWK-40 behaviour and looks exactly like a body with no images in
 * it. Return them from the loader alongside `project`.
 *
 * The other half of ADR-0013's markup rule is the loader's business too: if this page
 * renders `project.coverImage` above the body, the cover is the page's first image, so
 * the body must be given `firstImageEager={false}` or two images will both claim
 * `fetchpriority="high"`.
 */
export default function Project() {
  return (
    <main className="px-[var(--gutter)] py-[var(--space-section)]">
      <article className="mx-auto max-w-[var(--width-content)]">
        <p className="kicker">Case study</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Nothing here yet</h1>
        <p className="mt-3 max-w-[52ch] text-base text-muted-foreground">
          No project carries a case study body, so this page has no subject. Filling one field in Contentful is what
          brings it into existence — no migration, no new entry, no URL change.
        </p>
      </article>
    </main>
  )
}
