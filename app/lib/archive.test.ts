import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * ADR-0006's participation rules, which decide what the site publishes.
 *
 * These mock `fetchAll` rather than `fetch`, so the fixtures read as Contentful
 * entries and the test is about the RULES rather than about pagination. Every
 * fixture mirrors a real shape in the space — the shared program items across a
 * two-night run, the work played twice and sat out once, the composer whose only
 * work was sat out — because the rules are all edge cases and a happy-path
 * fixture would exercise none of them.
 */
type Fields = Record<string, unknown>

function entry(type: string, id: string, fields: Fields) {
  return { sys: { id, contentType: { sys: { id: type } } }, fields }
}

const link = (id: string) => ({ sys: { type: 'Link', linkType: 'Entry', id } })

/**
 * One Asset as the CDA returns it, protocol-relative URL and all. `image` is absent
 * on a non-image asset, which the sweep has to drop rather than size at zero.
 */
function asset(
  id: string,
  over: { title?: string; description?: string; image?: { width: number; height: number } | null } = {}
) {
  return {
    sys: { id },
    fields: {
      title: over.title ?? `Asset ${id}`,
      description: over.description ?? '',
      file: {
        url: `//images.ctfassets.net/3iiyvj5u5c9h/${id}/abc123/${id}.png`,
        fileName: `${id}.png`,
        contentType: 'image/png',
        details: { size: 1024, ...(over.image === null ? {} : { image: over.image ?? { width: 2560, height: 1600 } }) },
      },
    },
  }
}

const CONFIG = {
  spaceId: 'space',
  environment: 'master',
  token: 'token',
  host: 'https://cdn.contentful.com',
  preview: false,
}

let space: Record<string, ReturnType<typeof entry>[]>
let assets: ReturnType<typeof asset>[]

async function sweepFixture() {
  vi.resetModules()
  vi.doMock('./contentful', async () => ({
    ...(await vi.importActual<typeof import('./contentful')>('./contentful')),
    fetchAll: (_config: unknown, type: string) => Promise.resolve(space[type] ?? []),
    // Mocked for the same reason `fetchAll` is: the assets endpoint is a real
    // request, so leaving it through means every case here 404s against a fake
    // token — which is exactly how this file failed when AWK-40 added the call.
    fetchAllAssets: () => Promise.resolve(assets),
  }))
  const { sweep } = await import('./archive')
  return sweep(CONFIG)
}

/** One composer, one work, one item, on however many concerts the caller names. */
function seed() {
  space = {
    composer: [
      entry('composer', 'cmp-beethoven', {
        firstName: 'Ludwig van',
        lastName: 'Beethoven',
        sortName: 'Beethoven, Ludwig van',
        slug: 'beethoven-ludwig-van',
      }),
    ],
    work: [
      entry('work', 'wrk-fifth', {
        title: 'Symphony No. 5 in C Minor',
        slug: 'symphony-no-5-in-c-minor',
        composer: link('cmp-beethoven'),
      }),
    ],
    programItem: [entry('programItem', 'pi-1', { label: 'Symphony No. 5', order: 1, work: link('wrk-fifth') })],
    concert: [],
    hall: [entry('hall', 'hal-wwh', { name: 'Walt Whitman Hall', slug: 'walt-whitman-hall' })],
    conductor: [entry('conductor', 'cnd-armstrong', { firstName: 'Nicholas', lastName: 'Armstrong' })],
    orchestra: [entry('orchestra', 'orc-bso', { name: 'Brooklyn Symphony Orchestra', abbreviation: 'BSO' })],
    recording: [],
    project: [],
    imageGroup: [],
  }
  assets = []
}

const concert = (id: string, date: string, fields: Fields = {}) =>
  entry('concert', id, {
    date,
    program: [link('pi-1')],
    hall: link('hal-wwh'),
    conductor: link('cnd-armstrong'),
    ...fields,
  })

beforeEach(seed)

describe('what publishes (ADR-0006)', () => {
  it('publishes a concert Alex attended', async () => {
    space.concert = [concert('cnc-1', '2012-03-15', { attended: true })]

    const archive = await sweepFixture()

    expect(archive.paths).toContain('/concerts/2012-03-15')
    expect(archive.stats).toMatchObject({ concerts: 1, works: 1, composers: 1 })
  })

  it('publishes nothing for a concert he missed', async () => {
    space.concert = [concert('cnc-1', '2012-03-15', { attended: false })]

    const archive = await sweepFixture()

    expect(archive.stats).toMatchObject({ concerts: 0, works: 0, composers: 0 })
  })

  it('publishes nothing for an unmarked concert', async () => {
    // The 119 pre-tenure rows. Unset is not-his-history, and it fails CLOSED —
    // an import can only ever add rows that publish nothing.
    space.concert = [concert('cnc-1', '1994-03-15')]

    const archive = await sweepFixture()

    expect(archive.stats.concerts).toBe(0)
  })

  it('reads no date to decide any of it', async () => {
    // 2001-05-24 is a seeding convenience, not a rule. A 1994 concert marked
    // attended publishes exactly like a 2019 one.
    space.concert = [concert('cnc-1', '1994-03-15', { attended: true })]

    const archive = await sweepFixture()

    expect(archive.paths).toContain('/concerts/1994-03-15')
  })
})

describe('the per-pair rule', () => {
  it('drops a work sat out at its only performance', async () => {
    space.concert = [concert('cnc-1', '2012-03-15', { attended: true, satOut: [link('pi-1')] })]

    const archive = await sweepFixture()

    // The concert still publishes; the work and its composer do not.
    expect(archive.stats).toMatchObject({ concerts: 1, works: 0, composers: 0 })
  })

  it('keeps a work sat out once but played at another concert', async () => {
    // 52 works were played twice and 2 three times. Sitting out one performance
    // of a work played at another must not erase it — the rule quantifies over
    // occasions and takes the disjunction.
    space.programItem.push(entry('programItem', 'pi-2', { label: 'Symphony No. 5', order: 1, work: link('wrk-fifth') }))
    space.concert = [
      concert('cnc-1', '2012-03-15', { attended: true, satOut: [link('pi-1')] }),
      concert('cnc-2', '2018-04-22', { attended: true, program: [link('pi-2')] }),
    ]

    const archive = await sweepFixture()

    expect(archive.stats).toMatchObject({ concerts: 2, works: 1, composers: 1 })
    expect(archive.works[0].performances.map((p) => p.date)).toEqual(['2018-04-22'])
  })

  it('counts one performance per concert, not per programme row', async () => {
    // A work listed across two rows of one programme — movements broken out, or
    // a repeat — is still one evening. Counting it twice renders a duplicate row
    // and makes the page say "twice" about a single night.
    space.programItem.push(
      entry('programItem', 'pi-2', { label: 'Symphony No. 5, finale', order: 2, work: link('wrk-fifth') })
    )
    space.concert = [concert('cnc-1', '2012-03-15', { attended: true, program: [link('pi-1'), link('pi-2')] })]

    const archive = await sweepFixture()

    expect(archive.concerts[0].program).toHaveLength(2)
    expect(archive.works[0].performances).toHaveLength(1)
  })

  it('omits a sat-out item from the concert programme rather than marking it', async () => {
    // A Concert page's subject is Alex's appearance, so listing a work he sat out
    // would put music in his record that is not his.
    space.programItem.push(
      entry('programItem', 'pi-2', { label: 'Coriolan Overture', order: 2, work: link('wrk-fifth') })
    )
    space.concert = [
      concert('cnc-1', '2012-03-15', { attended: true, program: [link('pi-1'), link('pi-2')], satOut: [link('pi-2')] }),
    ]

    const archive = await sweepFixture()

    expect(archive.concerts[0].program.map((i) => i.label)).toEqual(['Symphony No. 5'])
  })

  it('reads the concert from the link owner, not the item id', async () => {
    // A run's second night carries the FIRST night's item ids, and both nights
    // share one set of items. Each concert holds its own satOut, so they diverge
    // freely while pointing at the same items.
    space.concert = [
      concert('cnc-20070520', '2007-05-20', { attended: true }),
      concert('cnc-20070523', '2007-05-23', { attended: true, satOut: [link('pi-1')] }),
    ]

    const archive = await sweepFixture()

    expect(archive.concerts.find((c) => c.date === '2007-05-20')?.program).toHaveLength(1)
    expect(archive.concerts.find((c) => c.date === '2007-05-23')?.program).toHaveLength(0)
    expect(archive.stats.works).toBe(1)
  })
})

describe('the page set', () => {
  beforeEach(() => {
    space.concert = [concert('cnc-1', '2012-03-15', { attended: true })]
  })

  it('nests a work under its composer, which is the canonical address', async () => {
    const archive = await sweepFixture()

    expect(archive.paths).toContain('/concerts/composers/beethoven-ludwig-van/works/symphony-no-5-in-c-minor')
  })

  it('always carries the six static paths', async () => {
    const archive = await sweepFixture()

    expect(archive.paths).toEqual(
      expect.arrayContaining(['/', '/projects', '/concerts', '/concerts/composers', '/contact', '/contact/sent'])
    )
  })

  it('emits every path slash-free', async () => {
    const archive = await sweepFixture()

    expect(archive.paths.filter((p) => p !== '/' && p.endsWith('/'))).toEqual([])
  })

  it('gives no project a page while none has a body', async () => {
    space.project = [entry('project', 'prj-b', { title: 'awkale.me', slug: 'awkale-me' })]

    const archive = await sweepFixture()

    expect(archive.paths.filter((p) => p.startsWith('/projects/'))).toEqual([])
  })

  it('fails the build the moment a project carries a body, rather than shipping the empty state', async () => {
    // app/routes/project.tsx has no loader — React Router forbids one on a route
    // no prerender path matches — so a newly authored body would prerender
    // "Nothing here yet" and ship it as the case study, with nothing failing.
    // ADR-0003 actively invites this: "a stub graduates by filling one field".
    space.project = [entry('project', 'prj-a', { title: 'Agent A', slug: 'agent-a', body: { content: [{}] } })]

    await expect(sweepFixture()).rejects.toThrow(/AWK-43/)
  })
})

describe('the search index', () => {
  beforeEach(() => {
    space.concert = [concert('cnc-1', '2012-03-15', { attended: true })]
  })

  it('covers every routed kind from the same sweep', async () => {
    // Body-less on purpose: a body currently fails the build, and an index-only
    // project is still indexed — a header search that cannot find a case study is
    // a site-wide search that quietly isn't one (AWK-41).
    space.project = [entry('project', 'prj-a', { title: 'Agent A', slug: 'agent-a' })]

    const archive = await sweepFixture()

    expect(new Set(archive.search.map((e) => e.kind))).toEqual(new Set(['project', 'composer', 'work', 'concert']))
  })

  it('writes paths WITH the trailing slash, unlike the prerender list', async () => {
    // These become `<Link to>` targets, and each slash-free one costs a needless
    // 301 hop across ~600 pages.
    const archive = await sweepFixture()

    expect(archive.search.every((e) => e.path.endsWith('/'))).toBe(true)
  })

  it('sends a body-less project to the index rather than a page that does not exist', async () => {
    space.project = [entry('project', 'prj-b', { title: 'awkale.me', slug: 'awkale-me' })]

    const archive = await sweepFixture()

    expect(archive.search.find((e) => e.title === 'awkale.me')?.path).toBe('/projects/')
  })
})

describe('stored slugs', () => {
  it('fails loudly when a qualifying composer has no slug', async () => {
    // ADR-0008 stores slugs rather than deriving them, so this cannot be papered
    // over with a build-time slugify — it means the backfill has not run.
    space.composer[0].fields.slug = undefined
    space.concert = [concert('cnc-1', '2012-03-15', { attended: true })]

    await expect(sweepFixture()).rejects.toThrow(/backfill_slugs\.py/)
  })

  it('fails loudly when a qualifying work has no slug', async () => {
    space.work[0].fields.slug = undefined
    space.concert = [concert('cnc-1', '2012-03-15', { attended: true })]

    await expect(sweepFixture()).rejects.toThrow(/no stored slug/)
  })
})

describe('the invariants run over the whole space', () => {
  it('rejects a satOut off the programme even on a concert nobody attended', async () => {
    // Hiding it until someone marks that concert attended would surface it at the
    // worst possible moment.
    space.concert = [concert('cnc-1', '1994-03-15', { satOut: [link('pi-nowhere')] })]

    await expect(sweepFixture()).rejects.toThrow(/satout-subset-of-program/)
  })

  it('rejects a recording pinned to the wrong concert', async () => {
    space.concert = [concert('cnc-1', '2012-03-15', { attended: true })]
    space.recording = [
      entry('recording', 'rec-1', {
        url: 'https://youtube.com/watch?v=x',
        label: 'BSO Mexico 2020',
        kind: 'video',
        concert: link('cnc-1'),
        programItem: link('pi-elsewhere'),
      }),
    ]

    await expect(sweepFixture()).rejects.toThrow(/recording-item-on-concert-program/)
  })
})

describe('a work inherits its composer’s period (AWK-37)', () => {
  /**
   * ADR-0007: Period is "held on the Composer and inherited by their Works,
   * except where a Work states its own". The seed writes `composer.period` on
   * all 153 in-scope composers and `work.period` on 5, so WITHOUT the
   * inheritance 333 of 338 work pages render an em dash while the data sits
   * right there on the composer.
   *
   * Resolved here rather than at the route, matching AWK-60's `conductorName`:
   * a page never repeats the fallback, and `periodIsOwn` keeps the distinction
   * for anything that needs it.
   */
  beforeEach(() => {
    space.concert = [concert('cnc-1', '2012-03-15', { attended: true })]
  })

  it('takes the composer’s period when the work states none', async () => {
    space.composer[0].fields.period = 'Classical'

    const archive = await sweepFixture()

    expect(archive.works[0]).toMatchObject({ period: 'Classical', periodIsOwn: false })
  })

  it('prefers the work’s own period over the composer’s', async () => {
    // ADR-0007's worked example, in the shape the seed actually wrote it:
    // Ellington's Nutcracker inherits Tchaikovsky's Romantic and must read Jazz.
    space.composer[0].fields.period = 'Romantic'
    space.work[0].fields.period = 'Jazz'

    const archive = await sweepFixture()

    expect(archive.works[0]).toMatchObject({ period: 'Jazz', periodIsOwn: true })
  })

  it('stays null when neither states one', async () => {
    // 45 composers took a hand period precisely so this stays rare, but a work
    // by a composer with no period must render an em dash rather than throw.
    const archive = await sweepFixture()

    expect(archive.works[0]).toMatchObject({ period: null, periodIsOwn: false })
  })

  it('leaves the composer’s own period alone', async () => {
    // The composer page reads `composer.period` directly. Inheritance is a
    // property of the WORK, and must not write anything back.
    space.composer[0].fields.period = 'Classical'
    space.work[0].fields.period = 'Jazz'

    const archive = await sweepFixture()

    expect(archive.composers[0].period).toBe('Classical')
  })
})

describe('the per-item conductor (AWK-60)', () => {
  /** Tristan, the second conductor of the 2022-12-18 fixture this models. */
  function addTristan() {
    space.conductor.push(entry('conductor', 'cnd-tristan', { firstName: 'Felipe', lastName: 'Tristan' }))
  }

  it('inherits the concert conductor when the item names none', async () => {
    // The case 807 of 819 items are in. `conductorIsOwn` is what keeps the page
    // from repeating one name down a column nobody needed.
    space.concert = [concert('cnc-1', '2012-03-15', { attended: true })]

    const archive = await sweepFixture()

    expect(archive.concerts[0].program[0]).toMatchObject({
      conductorName: 'Nicholas Armstrong',
      conductorIsOwn: false,
    })
  })

  it("prefers the item's own conductor over the concert's", async () => {
    // 2022-12-18: Armstrong took the Rossini and the Elgar, Tristan the
    // Tchaikovsky, and before this field the entry said Armstrong three times.
    addTristan()
    space.programItem[0].fields.conductor = link('cnd-tristan')
    space.concert = [concert('cnc-1', '2022-12-18', { attended: true })]

    const archive = await sweepFixture()

    expect(archive.concerts[0].program[0]).toMatchObject({
      conductorName: 'Felipe Tristan',
      conductorIsOwn: true,
    })
    // The concert still names its own principal. The override is per item and
    // says nothing about the evening's heading.
    expect(archive.concerts[0].conductor).toBe('Nicholas Armstrong')
  })

  it('splits one concert between two conductors', async () => {
    addTristan()
    space.programItem.push(
      entry('programItem', 'pi-2', {
        label: 'Coriolan Overture',
        order: 2,
        work: link('wrk-fifth'),
        conductor: link('cnd-tristan'),
      })
    )
    space.concert = [concert('cnc-1', '2022-12-18', { attended: true, program: [link('pi-1'), link('pi-2')] })]

    const archive = await sweepFixture()

    expect(archive.concerts[0].program.map((i) => [i.conductorName, i.conductorIsOwn])).toEqual([
      ['Nicholas Armstrong', false],
      ['Felipe Tristan', true],
    ])
  })

  it("records the item's conductor on the work's performance list", async () => {
    // The semantic change AWK-60 makes to output that already shipped: a work
    // page names who conducted THAT WORK, which on a split concert is the finer
    // answer and on every other concert is the same string as before.
    addTristan()
    space.programItem[0].fields.conductor = link('cnd-tristan')
    space.concert = [concert('cnc-1', '2022-12-18', { attended: true })]

    const archive = await sweepFixture()

    expect(archive.works[0].performances[0]).toMatchObject({
      date: '2022-12-18',
      conductor: 'Felipe Tristan',
    })
  })

  it('falls back to null when neither item nor concert names one', async () => {
    // 2007-12-16 has no conductor at all, and an item on it must not invent one.
    space.concert = [concert('cnc-1', '2007-12-16', { attended: true, conductor: undefined })]

    const archive = await sweepFixture()

    expect(archive.concerts[0].program[0]).toMatchObject({
      conductorName: null,
      conductorIsOwn: false,
    })
  })
})

describe('concert detail', () => {
  it('resolves hall, conductor and orchestra through their links', async () => {
    space.concert = [concert('cnc-1', '2012-03-15', { attended: true, orchestra: [link('orc-bso')] })]

    const archive = await sweepFixture()

    expect(archive.concerts[0]).toMatchObject({
      hall: 'Walt Whitman Hall',
      conductor: 'Nicholas Armstrong',
      orchestras: ['Brooklyn Symphony Orchestra'],
    })
  })

  it('tolerates the one played concert with no conductor recorded', async () => {
    // 2007-12-16. A ditto in the source; it renders without the credit rather
    // than failing.
    space.concert = [concert('cnc-1', '2007-12-16', { attended: true, conductor: undefined })]

    const archive = await sweepFixture()

    expect(archive.concerts[0].conductor).toBeNull()
  })

  it('drops a recording of a work he sat out', async () => {
    // The invariant only requires `programItem ∈ program`, which a sat-out item
    // still satisfies — so without an explicit filter the page omits the work
    // from the programme and links a video of it three inches lower.
    space.concert = [concert('cnc-1', '2012-03-15', { attended: true, satOut: [link('pi-1')] })]
    space.recording = [
      entry('recording', 'rec-1', {
        url: 'https://youtube.com/watch?v=x',
        label: 'The piece he sat out',
        kind: 'video',
        concert: link('cnc-1'),
        programItem: link('pi-1'),
      }),
    ]

    const archive = await sweepFixture()

    expect(archive.concerts[0].program).toHaveLength(0)
    expect(archive.concerts[0].recordings).toEqual([])
  })

  it('keeps a whole-concert recording even when something was sat out', async () => {
    // He played the concert, whatever he sat out within it.
    space.concert = [concert('cnc-1', '2012-03-15', { attended: true, satOut: [link('pi-1')] })]
    space.recording = [
      entry('recording', 'rec-1', {
        url: 'https://youtube.com/watch?v=x',
        label: 'Complete performance',
        kind: 'video',
        concert: link('cnc-1'),
        programItem: undefined,
      }),
    ]

    const archive = await sweepFixture()

    expect(archive.concerts[0].recordings).toHaveLength(1)
  })

  it('hangs a recording off the concert it belongs to', async () => {
    space.concert = [concert('cnc-1', '2012-03-15', { attended: true })]
    space.recording = [
      entry('recording', 'rec-1', {
        url: 'https://youtube.com/watch?v=x',
        label: 'Complete performance',
        kind: 'video',
        concert: link('cnc-1'),
        programItem: link('pi-1'),
      }),
    ]

    const archive = await sweepFixture()

    expect(archive.concerts[0].recordings).toHaveLength(1)
  })
})

describe('the asset half (ADR-0013)', () => {
  it('keys every image asset by id, whether or not anything links it', () => {
    // Whole-space rather than per project, so the renderer can resolve a body's
    // embedded link ids without a second walk. See the Archive type's comment.
    assets = [asset('wds-docs-home'), asset('agent-a-home')]

    return sweepFixture().then((archive) => {
      expect(Object.keys(archive.images)).toEqual(['wds-docs-home', 'agent-a-home'])
      expect(archive.images['wds-docs-home']).toMatchObject({ width: 2560, height: 1600 })
    })
  })

  it('carries the URL through protocol-relative, exactly as Contentful gave it', async () => {
    // The scheme is app/lib/images.ts's job and only its job — a second place that
    // rewrites it is a second place to forget to.
    assets = [asset('wds-docs-home')]

    const archive = await sweepFixture()

    expect(archive.images['wds-docs-home'].url.startsWith('//images.ctfassets.net/')).toBe(true)
  })

  it('drops an asset with no image dimensions rather than sizing it at zero', async () => {
    // A PDF, say. ADR-0013 emits width/height from `file.details.image.*`, so a
    // zero would render a collapsed box that nothing reports.
    assets = [asset('a-pdf', { image: null }), asset('wds-docs-home')]

    const archive = await sweepFixture()

    expect(Object.keys(archive.images)).toEqual(['wds-docs-home'])
  })

  it('resolves a project’s coverImage, which ADR-0003 leaves optional', async () => {
    assets = [asset('cision-sidebar-updated', { title: 'Cision navigation sidebar, after the redesign' })]
    space.project = [
      entry('project', 'prj-cision', {
        title: 'Cision navigation',
        slug: 'cision-navigation',
        summary: 'A sidebar redesign.',
        coverImage: { sys: { type: 'Link', linkType: 'Asset', id: 'cision-sidebar-updated' } },
      }),
      entry('project', 'prj-bare', { title: 'No imagery', slug: 'no-imagery', summary: 'An older item.' }),
    ]

    const archive = await sweepFixture()

    expect(archive.projects.find((p) => p.slug === 'cision-navigation')?.coverImage).toMatchObject({
      id: 'cision-sidebar-updated',
      title: 'Cision navigation sidebar, after the redesign',
    })
    // The no-image card state ADR-0003 requires the index to render.
    expect(archive.projects.find((p) => p.slug === 'no-imagery')?.coverImage).toBeNull()
  })

  it('leaves coverImage null when the link points at an unpublished asset', async () => {
    assets = []
    space.project = [
      entry('project', 'prj-cision', {
        title: 'Cision navigation',
        slug: 'cision-navigation',
        summary: 'A sidebar redesign.',
        coverImage: { sys: { type: 'Link', linkType: 'Asset', id: 'cision-sidebar-updated' } },
      }),
    ]

    const archive = await sweepFixture()

    expect(archive.projects[0].coverImage).toBeNull()
  })

  it('resolves an imageGroup’s links in the authored order', async () => {
    // ADR-0003 made this an ordered array specifically so captions could not drift
    // out of step with it — the parallel-arrays shape it rejected.
    assets = [asset('cision-sidebar-existing'), asset('cision-sidebar-updated')]
    space.imageGroup = [
      entry('imageGroup', 'grp-sidebars', {
        label: 'Sidebar, before and after',
        layout: 'sideBySide',
        caption: 'Before, and after.',
        images: [
          { sys: { type: 'Link', linkType: 'Asset', id: 'cision-sidebar-existing' } },
          { sys: { type: 'Link', linkType: 'Asset', id: 'cision-sidebar-updated' } },
        ],
      }),
    ]

    const archive = await sweepFixture()

    expect(archive.imageGroups['grp-sidebars']).toMatchObject({
      layout: 'sideBySide',
      caption: 'Before, and after.',
    })
    expect(archive.imageGroups['grp-sidebars'].images.map((image) => image.id)).toEqual([
      'cision-sidebar-existing',
      'cision-sidebar-updated',
    ])
  })

  it('keeps a group whose links only partly resolve, and says so', async () => {
    // Warned rather than thrown: ADR-0013 states it adds no new invariant. The
    // narrower row is still the honest render of what is published.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    assets = [asset('cision-sidebar-existing')]
    space.imageGroup = [
      entry('imageGroup', 'grp-sidebars', {
        label: 'Sidebar, before and after',
        layout: 'sideBySide',
        images: [
          { sys: { type: 'Link', linkType: 'Asset', id: 'cision-sidebar-existing' } },
          { sys: { type: 'Link', linkType: 'Asset', id: 'cision-sidebar-updated' } },
        ],
      }),
    ]

    const archive = await sweepFixture()

    expect(archive.imageGroups['grp-sidebars'].images).toHaveLength(1)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('grp-sidebars'))
    warn.mockRestore()
  })

  it('names a REFERENCED asset with no title, because its alt text is then empty', async () => {
    // ADR-0003 reads alt text from the title, so an untitled asset renders as
    // decorative to a screen reader — invisible in every other way.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    assets = [asset('untitled-shot', { title: '' })]
    space.imageGroup = [
      entry('imageGroup', 'grp-one', {
        label: 'One shot',
        layout: 'fullWidth',
        images: [{ sys: { type: 'Link', linkType: 'Asset', id: 'untitled-shot' } }],
      }),
    ]

    await sweepFixture()

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('untitled-shot'))
    warn.mockRestore()
  })

  it('says nothing about an untitled asset no page renders', async () => {
    // The space carries a 2019 portrait nothing links. A warning that is usually
    // noise is a warning nobody reads.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    assets = [asset('untitled-and-unused', { title: '' })]

    await sweepFixture()

    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('names a project whose coverImage resolved to nothing', async () => {
    // Symmetry with the group warning: a dropped cover renders the deliberate
    // no-image card, which looks exactly like a project that never had imagery.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    assets = []
    space.project = [
      entry('project', 'prj-cision', {
        title: 'Cision navigation',
        slug: 'cision-navigation',
        summary: 'A sidebar redesign.',
        coverImage: { sys: { type: 'Link', linkType: 'Asset', id: 'cision-sidebar-updated' } },
      }),
    ]

    await sweepFixture()

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('cision-navigation'))
    warn.mockRestore()
  })
})
