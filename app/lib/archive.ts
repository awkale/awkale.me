/**
 * The one build-time Contentful sweep.
 *
 * ADR-0009 chose React Router framework mode because `prerender` takes an ASYNC
 * FUNCTION: one sweep enumerates every path, and route loaders fill each page
 * from the same data. This is that sweep, and it has three consumers —
 * `prerenderPaths` (the page set), `buildEnd` (the search index), and every route
 * loader. All three read `loadArchive()`, which memoizes.
 *
 * IT RUNS TWICE PER BUILD, NOT ONCE, and the memo cannot help. Measured, not
 * assumed: react-router.config.ts and the SSR bundle the route loaders are
 * compiled into are separate module instances in the same process, so each holds
 * its own `pending`. Consumers one and two share a sweep; the loaders take a
 * second. Six hundred loaders share that second one, which is the part that
 * actually matters — the cost is 2 × ~0.3 s, not 609 × anything.
 *
 * The real exposure is not the duplicated fetch but the WINDOW between the two.
 * A Contentful edit landing mid-build gives the loaders a different archive from
 * the one that enumerated the paths, and a path whose record has since vanished
 * fails the build on the `throw new Response(..., 404)` in that route's loader.
 * That is a loud failure rather than a wrong page, which is the right way round,
 * and at a ~7 s build the window is small enough to accept.
 *
 * A SECOND ENUMERATION IS THE THING TO AVOID. AWK-41's search index and this page
 * set describe the same ~595 records, and if they were derived separately they
 * could disagree — a work in the index with no page behind it, or a page nothing
 * can find. Two consumers, one function, deliberately.
 *
 * The rules are ADR-0006's, and they are rules rather than counts:
 *
 *   Concert page   iff `attended`
 *   Work page      iff ≥1 pair where attended AND the item is not in that
 *                  concert's `satOut`
 *   Composer page  iff ≥1 qualifying work
 *
 * PER PAIR, not per work: of the in-scope works 294 were played once, 52 twice
 * and 2 three times, so sitting out one performance of a work played at another
 * must not erase it. The rule quantifies over occasions and takes the
 * disjunction.
 *
 * Nothing here reads a date to decide participation. ADR-0006 demoted 2001-05-24
 * from a rule to a seeding convenience; `attended` is asserted positively, and its
 * three states matter — `true` publishes, `false` is a reviewed miss, unset is one
 * of the 119 pre-tenure rows that were never Alex's history.
 */
import { type ContentfulConfig, type Entry, type Link, fetchAll, linkId, linkIds, readConfig } from './contentful'
import { type ArchiveShape, assertInvariants } from './invariants'

type ConcertFields = {
  title: string
  date: string
  program: Link[]
  satOut: Link[]
  hall: Link
  conductor: Link
  orchestra: Link[]
  attended: boolean
}
type ProgramItemFields = { label: string; order: number; work: Link; soloists: Link[] }
type WorkFields = { title: string; slug: string; composer: Link; period: string; forms: string[] }
type ComposerFields = { firstName: string; lastName: string; sortName: string; slug: string; period: string }
type HallFields = { name: string; slug: string }
type ConductorFields = { firstName: string; lastName: string }
type OrchestraFields = { name: string; abbreviation: string }
type RecordingFields = { url: string; label: string; kind: string; concert: Link; programItem: Link }
type ProjectFields = {
  title: string
  slug: string
  summary: string
  organization: string
  technologies: string[]
  startDate: string
  endDate: string
  featuredRank: number
  liveUrl: string
  repoUrl: string
  body: { nodeType?: string; content?: RichTextNode[] }
}
type ImageGroupFields = { label: string; images: Link[]; layout: string }

export type Recording = { id: string; url: string; label: string; kind: string; programItemId: string | null }

export type ProgramEntry = {
  id: string
  order: number
  label: string
  workId: string | null
  workSlug: string | null
  composerSlug: string | null
  composerName: string | null
}

export type Concert = {
  id: string
  /** ADR-0001 keys concert URLs by date, so the slug IS the date. */
  slug: string
  date: string
  hall: string | null
  conductor: string | null
  orchestras: string[]
  /** Only what he played — a sat-out item is omitted, never marked (ADR-0006). */
  program: ProgramEntry[]
  recordings: Recording[]
}

export type Performance = { date: string; slug: string; hall: string | null; conductor: string | null }

export type Work = {
  id: string
  slug: string
  title: string
  composerId: string
  composerSlug: string
  composerName: string
  period: string | null
  forms: string[]
  performances: Performance[]
}

export type Composer = {
  id: string
  slug: string
  /** `Beethoven, Ludwig van` — files under B, per ADR-0008. */
  filingName: string
  displayName: string
  period: string | null
  workCount: number
}

export type Project = {
  id: string
  slug: string
  title: string
  summary: string
  organization: string
  technologies: string[]
  years: string
  liveUrl: string | null
  repoUrl: string | null
  featuredRank: number | null
  /** Empty body means index-only: no page, and the card must not look clickable. */
  hasBody: boolean
  /**
   * The raw RichText document, or null when there is none.
   *
   * Left untyped beyond `RichTextNode` deliberately: ADR-0003 restricts embedded
   * BLOCKS to `imageGroup` and assets, and rendering those is AWK-40's asset
   * delivery, not this ticket's. Carrying the document through now means the
   * page is real the moment AWK-43 authors one.
   */
  body: RichTextNode | null
}

/** Contentful's RichText shape, to the depth this site renders. */
export type RichTextNode = {
  nodeType: string
  value?: string
  marks?: { type: string }[]
  content?: RichTextNode[]
  data?: { uri?: string; target?: { sys?: { id?: string } } }
}

/** One row of AWK-41's index. `kind` is what groups the ComboBox. */
export type SearchEntry = {
  kind: 'project' | 'composer' | 'work' | 'concert'
  title: string
  detail: string
  path: string
}

export type Archive = {
  concerts: Concert[]
  works: Work[]
  composers: Composer[]
  projects: Project[]
  paths: string[]
  search: SearchEntry[]
  stats: { concerts: number; works: number; composers: number; pairs: number; projects: number; paths: number }
}

function name(entry: Entry<{ firstName: string; lastName: string }> | undefined): string | null {
  if (!entry) return null
  return [entry.fields.firstName, entry.fields.lastName].filter(Boolean).join(' ') || null
}

/**
 * The six paths that are not derived from content. They exist whatever the
 * archive holds, and both contact pages are prerendered like everything else —
 * which is the whole reason Netlify's form scanner can see the form at deploy
 * time (ADR-0011).
 */
const STATIC_PATHS = ['/', '/projects', '/concerts', '/concerts/composers', '/contact', '/contact/sent']

export async function sweep(config: ContentfulConfig): Promise<Archive> {
  const [concerts, items, works, composers, halls, conductors, orchestras, recordings, projects, imageGroups] =
    await Promise.all([
      fetchAll<ConcertFields>(config, 'concert'),
      fetchAll<ProgramItemFields>(config, 'programItem'),
      fetchAll<WorkFields>(config, 'work'),
      fetchAll<ComposerFields>(config, 'composer'),
      fetchAll<HallFields>(config, 'hall'),
      fetchAll<ConductorFields>(config, 'conductor'),
      fetchAll<OrchestraFields>(config, 'orchestra'),
      fetchAll<RecordingFields>(config, 'recording'),
      fetchAll<ProjectFields>(config, 'project'),
      fetchAll<ImageGroupFields>(config, 'imageGroup'),
    ])

  const byId = <F>(entries: Entry<F>[]) => new Map(entries.map((e) => [e.sys.id, e]))
  const itemById = byId(items)
  const workById = byId(works)
  const composerById = byId(composers)
  const hallById = byId(halls)
  const conductorById = byId(conductors)
  const orchestraById = byId(orchestras)

  // Asserted against the WHOLE space, not the published subset. A satOut pointing
  // off-programme on an unattended concert is still wrong, and hiding it until
  // someone marks that concert attended would surface it at the worst moment.
  const shape: ArchiveShape = {
    concerts: concerts.map((c) => ({
      id: c.sys.id,
      program: linkIds(c.fields.program),
      satOut: linkIds(c.fields.satOut),
    })),
    works: works.map((w) => ({
      id: w.sys.id,
      slug: w.fields.slug ?? '',
      composerId: linkId(w.fields.composer),
    })),
    projects: projects.map((p) => ({
      id: p.sys.id,
      slug: p.fields.slug ?? '',
      featuredRank: p.fields.featuredRank ?? null,
      hasBody: (p.fields.body?.content?.length ?? 0) > 0,
    })),
    imageGroups: imageGroups.map((g) => ({
      id: g.sys.id,
      label: g.fields.label ?? '',
      layout: g.fields.layout ?? '',
      imageCount: (g.fields.images ?? []).length,
    })),
    recordings: recordings.map((r) => ({
      id: r.sys.id,
      label: r.fields.label ?? '',
      concertId: linkId(r.fields.concert) ?? '',
      programItemId: linkId(r.fields.programItem),
    })),
  }
  assertInvariants(shape)

  const recordingsByConcert = new Map<string, Recording[]>()
  for (const recording of recordings) {
    // `concert` is required on the type, so a null here means a link to an entry
    // the Delivery API is not serving — unpublished or deleted.
    const concertId = linkId(recording.fields.concert)
    if (concertId !== null) {
      const list = recordingsByConcert.get(concertId) ?? []
      list.push({
        id: recording.sys.id,
        url: recording.fields.url ?? '',
        label: recording.fields.label ?? '',
        kind: recording.fields.kind ?? 'video',
        programItemId: linkId(recording.fields.programItem),
      })
      recordingsByConcert.set(concertId, list)
    }
  }

  // --- ADR-0006, applied per pair.
  const attended = concerts
    .filter((c) => c.fields.attended === true)
    .sort((a, b) => (b.fields.date ?? '').localeCompare(a.fields.date ?? ''))

  const qualifyingWorks = new Set<string>()
  const performances = new Map<string, Performance[]>()
  const publishedConcerts: Concert[] = []
  let pairs = 0

  for (const concert of attended) {
    const satOut = new Set(linkIds(concert.fields.satOut))
    const hall = hallById.get(linkId(concert.fields.hall) ?? '')?.fields.name ?? null
    const conductor = name(conductorById.get(linkId(concert.fields.conductor) ?? ''))
    const date = concert.fields.date ?? ''

    const program: ProgramEntry[] = []
    // THE per-pair rule, and the only place it is applied: an item sat out at
    // THIS concert is dropped here, which is what removes it from the page, from
    // the work's performance list, and from the work and composer page sets all
    // at once. An item id that resolves to nothing is a link the Delivery API is
    // not serving.
    const played = linkIds(concert.fields.program)
      .filter((itemId) => !satOut.has(itemId))
      .map((itemId) => itemById.get(itemId))
      .filter((item): item is NonNullable<typeof item> => item !== undefined)
    const playedIds = new Set(played.map((item) => item.sys.id))

    for (const item of played) {
      const itemId = item.sys.id
      pairs++

      const workId = linkId(item.fields.work)
      const work = workId === null ? undefined : workById.get(workId)
      const composer = work ? composerById.get(linkId(work.fields.composer) ?? '') : undefined

      if (workId !== null && work) {
        qualifyingWorks.add(workId)
        const list = performances.get(workId) ?? []
        // ONE PERFORMANCE PER CONCERT, however many program items carry the work.
        // A concert that lists a work across two rows — movements broken out, or
        // a repeat — is still one evening, and counting it twice would render a
        // duplicated row and make `times()` say "twice" about a single night.
        if (!list.some((p) => p.date === date)) {
          list.push({ date, slug: date, hall, conductor })
        }
        performances.set(workId, list)
      }

      program.push({
        id: itemId,
        order: item.fields.order ?? program.length + 1,
        label: item.fields.label ?? work?.fields.title ?? '',
        workId,
        workSlug: work?.fields.slug ?? null,
        composerSlug: composer?.fields.slug ?? null,
        composerName: composer?.fields.sortName ?? null,
      })
    }

    publishedConcerts.push({
      id: concert.sys.id,
      slug: date,
      date,
      hall,
      conductor,
      orchestras: linkIds(concert.fields.orchestra)
        .map((id) => orchestraById.get(id)?.fields.name)
        .filter((n): n is string => Boolean(n)),
      program: program.sort((a, b) => a.order - b.order),
      // A SAT-OUT ITEM'S RECORDING IS DROPPED WITH THE ITEM. The invariant only
      // requires `programItem ∈ program`, which a sat-out item still satisfies —
      // so without this filter a concert page omits the work from its programme
      // and then links a video of it three inches lower, which is exactly the
      // "music in his record that is not his" ADR-0006 exists to prevent.
      //
      // An item-less recording covers the whole concert and is kept regardless:
      // he played the concert, whatever he sat out within it.
      recordings: (recordingsByConcert.get(concert.sys.id) ?? []).filter(
        (r) => r.programItemId === null || playedIds.has(r.programItemId)
      ),
    })
  }

  // A qualifying record with no stored slug has no address, and ADR-0008 is
  // explicit that slugs are STORED rather than derived — so this cannot be
  // papered over by slugifying a name here. It means the backfill has not run.
  const unaddressable: string[] = []

  const publishedWorks: Work[] = []
  const workCounts = new Map<string, number>()
  for (const workId of qualifyingWorks) {
    const work = workById.get(workId)!
    const composerId = linkId(work.fields.composer)
    const composer = composerId === null ? undefined : composerById.get(composerId)

    if (!composer?.fields.slug || !work.fields.slug) {
      unaddressable.push(`${workId} (${work.fields.title ?? 'untitled'})`)
    } else {
      publishedWorks.push({
        id: workId,
        slug: work.fields.slug,
        title: work.fields.title ?? '',
        composerId: composer.sys.id,
        composerSlug: composer.fields.slug,
        composerName: composer.fields.sortName ?? '',
        period: work.fields.period ?? null,
        forms: work.fields.forms ?? [],
        performances: (performances.get(workId) ?? []).sort((a, b) => a.date.localeCompare(b.date)),
      })
      workCounts.set(composer.sys.id, (workCounts.get(composer.sys.id) ?? 0) + 1)
    }
  }

  if (unaddressable.length > 0) {
    throw new Error(
      `${unaddressable.length} qualifying work(s) have no stored slug, or a composer with none:\n\n` +
        `${unaddressable.slice(0, 10).join('\n')}${unaddressable.length > 10 ? '\n  …' : ''}\n\n` +
        `ADR-0008 stores archive slugs rather than deriving them, so this is not something the build can ` +
        `work around — it means scripts/contentful/backfill_slugs.py has not run against this space.`
    )
  }

  const publishedComposers: Composer[] = [...workCounts.keys()]
    .map((composerId) => {
      const composer = composerById.get(composerId)!
      return {
        id: composerId,
        slug: composer.fields.slug!,
        filingName: composer.fields.sortName ?? '',
        displayName: [composer.fields.firstName, composer.fields.lastName].filter(Boolean).join(' '),
        period: composer.fields.period ?? null,
        workCount: workCounts.get(composerId) ?? 0,
      }
    })
    .sort((a, b) => a.filingName.localeCompare(b.filingName))

  const publishedProjects: Project[] = projects
    .map((project) => ({
      id: project.sys.id,
      slug: project.fields.slug ?? '',
      title: project.fields.title ?? '',
      summary: project.fields.summary ?? '',
      organization: project.fields.organization ?? '',
      technologies: project.fields.technologies ?? [],
      years: [project.fields.startDate?.slice(0, 4), project.fields.endDate?.slice(0, 4)].filter(Boolean).join(' — '),
      liveUrl: project.fields.liveUrl ?? null,
      repoUrl: project.fields.repoUrl ?? null,
      featuredRank: project.fields.featuredRank ?? null,
      hasBody: (project.fields.body?.content?.length ?? 0) > 0,
      body: (project.fields.body as RichTextNode | undefined) ?? null,
    }))
    .sort((a, b) => (a.featuredRank ?? Infinity) - (b.featuredRank ?? Infinity) || a.title.localeCompare(b.title))

  // THE TRIPWIRE FOR app/routes/project.tsx, which currently has no `loader`.
  //
  // React Router forbids a `loader` on a route no prerender path matches, and
  // `/projects/:slug` matches none while `project` holds zero bodies — so AWK-39
  // shipped that route rendering a hardcoded empty state. The moment ANYONE fills
  // one `body` field, a path appears, the route prerenders, `/projects/` links to
  // it, the search index points at it, and it serves "Nothing here yet". Nothing
  // fails. That is the silent-wrong-content shape this whole file exists to
  // prevent, arriving through the one door ADR-0003 most encourages people to
  // walk through: "a stub graduates by filling one field".
  //
  // So the first authored body fails the build instead, and says what to do.
  const authored = publishedProjects.filter((p) => p.hasBody)
  if (authored.length > 0) {
    throw new Error(
      `${authored.length} project(s) now carry a body — ${authored.map((p) => p.slug).join(', ')} — but ` +
        `app/routes/project.tsx still has no loader, so each would prerender the "Nothing here yet" empty state ` +
        `and ship it as the case study.\n\n` +
        `This is AWK-43's cue. Restore the loader and the component exactly as that route's comment sets out; ` +
        `app/lib/richtext.tsx is written and tested for the body. Then delete this check.`
    )
  }

  // --- the page set. Slash-free: a trailing slash is a hard build failure.
  const paths = [
    ...STATIC_PATHS,
    ...publishedProjects.filter((p) => p.hasBody).map((p) => `/projects/${p.slug}`),
    ...publishedConcerts.map((c) => `/concerts/${c.slug}`),
    ...publishedComposers.map((c) => `/concerts/composers/${c.slug}`),
    ...publishedWorks.map((w) => `/concerts/composers/${w.composerSlug}/works/${w.slug}`),
  ]

  const search: SearchEntry[] = [
    ...publishedProjects.map((p) => ({
      kind: 'project' as const,
      title: p.title,
      detail: p.organization,
      path: p.hasBody ? `/projects/${p.slug}/` : '/projects/',
    })),
    ...publishedComposers.map((c) => ({
      kind: 'composer' as const,
      title: c.filingName,
      detail: `${c.workCount} work${c.workCount === 1 ? '' : 's'}`,
      path: `/concerts/composers/${c.slug}/`,
    })),
    ...publishedWorks.map((w) => ({
      kind: 'work' as const,
      title: w.title,
      detail: w.composerName,
      path: `/concerts/composers/${w.composerSlug}/works/${w.slug}/`,
    })),
    ...publishedConcerts.map((c) => ({
      kind: 'concert' as const,
      title: c.date,
      detail: [c.hall, c.conductor].filter(Boolean).join(' · '),
      path: `/concerts/${c.slug}/`,
    })),
  ]

  return {
    concerts: publishedConcerts,
    works: publishedWorks,
    composers: publishedComposers,
    projects: publishedProjects,
    paths,
    search,
    stats: {
      concerts: publishedConcerts.length,
      works: publishedWorks.length,
      composers: publishedComposers.length,
      pairs,
      projects: publishedProjects.length,
      paths: paths.length,
    },
  }
}

/**
 * Fetched once per build, however many consumers ask.
 *
 * A module-level promise is a singleton, with the usual cost: a long-running dev
 * server will not see a Contentful edit until it restarts. Accepted, because the
 * alternative is three full sweeps of ~2,400 entries in one build — and because
 * the build is the case that matters, where the data cannot change underneath it.
 */
let pending: Promise<Archive> | null = null

export function loadArchive(): Promise<Archive> {
  pending ??= sweep(readConfig())
  return pending
}

/** Drops the memo. For tests — nothing in a build should need it. */
export function resetArchive(): void {
  pending = null
}
