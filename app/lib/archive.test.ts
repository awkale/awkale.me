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

const CONFIG = {
  spaceId: 'space',
  environment: 'master',
  token: 'token',
  host: 'https://cdn.contentful.com',
  preview: false,
}

let space: Record<string, ReturnType<typeof entry>[]>

async function sweepFixture() {
  vi.resetModules()
  vi.doMock('./contentful', async () => ({
    ...(await vi.importActual<typeof import('./contentful')>('./contentful')),
    fetchAll: (_config: unknown, type: string) => Promise.resolve(space[type] ?? []),
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

  it('gives a project a page only when it has a body', async () => {
    space.project = [
      entry('project', 'prj-a', { title: 'Agent A', slug: 'agent-a', body: { content: [{}] } }),
      entry('project', 'prj-b', { title: 'awkale.me', slug: 'awkale-me' }),
    ]

    const archive = await sweepFixture()

    expect(archive.paths).toContain('/projects/agent-a')
    expect(archive.paths).not.toContain('/projects/awkale-me')
  })
})

describe('the search index', () => {
  beforeEach(() => {
    space.concert = [concert('cnc-1', '2012-03-15', { attended: true })]
  })

  it('covers every routed kind from the same sweep', async () => {
    space.project = [entry('project', 'prj-a', { title: 'Agent A', slug: 'agent-a', body: { content: [{}] } })]

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
