import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { findViolations, type ArchiveShape } from '../../app/lib/invariants'

/**
 * Guards `mexico-tour-programs.json` — AWK-57's two Mexico 2020 tour Concerts —
 * before `transcribe_programs.py` writes any of it into a live space with no
 * staging environment.
 *
 * Same division of labour as `tilles-center-programs.test.ts` and
 * `lisfa-festival-programs.test.ts`, with one difference that changes what is
 * checkable here. Those two transcribe image-only scans, so most of their
 * content is unfalsifiable offline. THIS declaration's sources are two public
 * web pages and a public RSS feed, all of them re-readable — but not from a
 * test, which has no network. So the limit is the same in practice and the
 * reason differs: whether Chapultepec was the Sunday venue is answered by the
 * source, not by this file reading itself back.
 *
 * What is checkable is the structure, plus the decisions this declaration
 * records. Each one is a thing a later editor could undo without noticing what
 * it was for:
 *
 *   * the two Concerts SHARE one set of Program items, numbered from the first
 *     night — the archive's run shape, and the first declaration to use it
 *   * Huapango appears TWICE on each Concert, programmed and then as the encore
 *   * `dateNote` marks the second night only, in the space's exact wording
 *   * every id this reuses is the LIVE one, and three of the obvious guesses
 *     are `bso-graph.json` ids that do not exist in Contentful
 *   * nothing is created but two Halls, five Program items and two Concerts
 *
 * The last describe block is the double-entry pass both sibling tests use:
 * synthesise an `ArchiveShape` from the declaration and run the BUILD'S OWN
 * `findViolations` over it, so the transcription is checked by the code that
 * would otherwise fail the build. It earns more here than in either sibling,
 * because the shared items are exactly what `program-item-run-is-close` and
 * `program-item-one-orchestra` exist to police.
 *
 * What it cannot do is see the live space. That every reused id still resolves,
 * and still resolves to an entry of the declared name, is `verify_reuse`'s job
 * at apply time. Offline structure, online identity.
 */

const here = import.meta.dirname
const decl = JSON.parse(readFileSync(join(here, 'mexico-tour-programs.json'), 'utf8')) as Declaration

interface ProgramItem {
  id: string
  order: number
  label: string
  work: string
  composer: string
  note?: string
  why?: string
}

interface Concert {
  title: string
  date: string
  dateNote?: string
  season: string
  hall: string
  orchestra: string[]
  conductor: string
  attended: boolean
  satOut: string[]
  sourceNote: string
  program: ProgramItem[]
}

/**
 * A reused entry, typed per section rather than as one loose shape with every
 * display field optional.
 *
 * The key each section carries is not decoration: `verify_reuse` reads exactly
 * one of them per content type and compares it against the live entry, so a
 * record missing its key is a Python `KeyError` in the middle of an apply run.
 * Typing them apart, and asserting the value below, moves that failure offline.
 */
interface ReusedWork {
  id: string
  title: string
  why?: string
}
interface ReusedComposer {
  id: string
  sortName: string
  why?: string
}
/** `conductor` and `orchestra` are both compared on a `name`. */
interface ReusedNamed {
  id: string
  name: string
  why?: string
}
interface ReusedSeason {
  id: string
  label: string
  why?: string
}

interface Declaration {
  sources: Record<string, string | string[]>
  reuse: {
    works: Record<string, ReusedWork | string[]>
    composers: Record<string, ReusedComposer | string[]>
    conductors: Record<string, ReusedNamed | string[]>
    orchestras: Record<string, ReusedNamed | string[]>
    seasons: Record<string, ReusedSeason | string[]>
  }
  halls: Record<string, { name: string; location: string; slug: string; why?: string } | string[]>
  concerts: Record<string, Concert | string[]>
  pendingRecordings: Record<string, { videoId: string; item: string; title: string } | string[]>
  guards: Record<string, number | string[]>
}

/** Plan files in this directory carry a `note` inside each object. It is prose, not a key. */
function entries<T>(record: Record<string, T | string[]>): [string, T][] {
  return Object.entries(record).filter(([key]) => key !== 'note') as [string, T][]
}

const newHalls = entries(decl.halls)
const concerts = entries(decl.concerts)
const guards = Object.fromEntries(entries<number>(decl.guards))
const pending = entries(decl.pendingRecordings)

const reuseWorks = entries(decl.reuse.works)
const reuseComposers = entries(decl.reuse.composers)
const reuseConductors = entries(decl.reuse.conductors)
const reuseOrchestras = entries(decl.reuse.orchestras)
const reuseSeasons = entries(decl.reuse.seasons)

/**
 * The five Program items, ONCE — not once per Concert. Both Concerts carry the
 * same five, which is the whole point of the declaration, so flattening the way
 * the sibling tests do would double every count.
 */
const [, firstConcert] = concerts[0]!
const items = firstConcert.program

/**
 * Every entry id this declaration actually LINKS — as values, never as text.
 *
 * Both the graph-id test and the Huapango test ask "does this file point at X?",
 * and the answer has to come from the links rather than from the file's prose.
 * The notes name `orc-bso` and `pi-20001216-2` on purpose, to say what is being
 * avoided; a string search over the JSON would make documenting a trap
 * indistinguishable from falling into it.
 *
 * Ids the declaration CREATES are excluded — the question is only what it
 * reaches for outside itself, plus the item ids each Concert's program names.
 */
function everyLink(): string[] {
  return [
    ...concerts.flatMap(([, c]) => c.program.flatMap((i) => [i.id, i.work, i.composer])),
    ...concerts.flatMap(([, c]) => [c.hall, c.season, c.conductor, ...c.orchestra, ...c.satOut]),
    ...pending.map(([, r]) => r.item),
  ]
}

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
/** The two shapes `app/lib/invariants.ts` rejects, restated — see the sibling tests. */
const COMPOSER_PREFIXED = /--/
const HASH_SUFFIX = /-[0-9a-f]{6}$/

describe('the declaration agrees with its own guards', () => {
  it('counts what it says it counts', () => {
    expect(concerts.length).toBe(guards.concerts)
    expect(items.length).toBe(guards.programItems)
    expect(newHalls.length).toBe(guards.hallsCreated)
    expect(reuseWorks.length).toBe(guards.worksReused)
    expect(reuseComposers.length).toBe(guards.composersReused)
    expect(reuseConductors.length).toBe(guards.conductorsReused)
    expect(reuseOrchestras.length).toBe(guards.orchestrasReused)
    expect(reuseSeasons.length).toBe(guards.seasonsReused)
  })

  /**
   * EVERY guard is asserted by something, which the `guards` note claims of
   * itself: *"Counts the test asserts, so a hand edit that drops or doubles
   * something fails rather than applying quietly."* These three were the
   * exceptions — `transcribe_programs.py` checks only the eight creation
   * counts, so a number nothing here reads is a number free to drift while
   * reading as checked. The facts behind them are tested elsewhere in this
   * file; what was missing is the comparison against the declared count.
   */
  it('leaves no guard unasserted', () => {
    expect(items.filter((i) => i.note).length).toBe(guards.itemsWithNote)
    expect(concerts.filter(([, c]) => c.dateNote).length).toBe(guards.concertsWithDateNote)
    // No `workMovements` section at all — this declaration merges none, which
    // is the applier's `worksCreated + workMovementsMerged` sum reading zero.
    expect(entries((decl as unknown as Record<string, Record<string, unknown>>).workMovements ?? {}).length).toBe(
      guards.workMovementsMerged
    )
  })

  /**
   * `programItems` is FIVE, not ten, and the applier has to agree. Both
   * Concerts declare the same five, so `build_plan` sees ten rows and dedupes
   * them by entry id before comparing against this guard. That dedupe is
   * AWK-57's change to the applier, and this is the number that would catch its
   * removal — a regression there fails the run with "declaration disagrees with
   * its own guards" rather than writing anything.
   */
  it('counts program items as entities, not as plan rows', () => {
    expect(guards.programItems).toBe(5)
    const rows = concerts.flatMap(([, c]) => c.program.map((i) => i.id))
    expect(rows.length).toBe(10)
    expect(new Set(rows).size).toBe(5)
  })

  /**
   * The zeroes are findings, not unfilled fields. This declaration creates NO
   * Work, Composer, Conductor or Orchestra — the whole tour program was already
   * in the archive, which is the opposite of AWK-82 where all seven works were
   * new. A later reader comparing the files should see the zeroes asserted.
   */
  it('holds its zeroes on purpose', () => {
    expect(guards.worksCreated).toBe(0)
    expect(guards.composersCreated).toBe(0)
    expect(guards.conductorsCreated).toBe(0)
    expect(guards.orchestrasCreated).toBe(0)
    expect(guards.soloistsCreated).toBe(0)
    expect(guards.itemsWithSoloists).toBe(0)
    expect(guards.itemsWithOwnConductor).toBe(0)

    for (const key of ['works', 'composers', 'conductors', 'orchestras', 'soloists'] as const) {
      expect(entries((decl as unknown as Record<string, Record<string, unknown>>)[key] ?? {}).length, key).toBe(0)
    }
  })

  it('sums entriesCreated from every creation section', () => {
    expect(newHalls.length + items.length + concerts.length).toBe(guards.entriesCreated)
  })
})

describe('the sources', () => {
  it('names one page per Concert, each an https URL', () => {
    const pages = entries<string>(decl.sources).filter(([key]) => key !== 'feed')
    expect(pages.length).toBe(concerts.length)
    for (const [date, url] of pages) {
      expect(
        concerts.map(([, c]) => c.date),
        date
      ).toContain(date)
      expect(url, date).toMatch(/^https:\/\//)
    }
  })

  /**
   * The feed is the corroborating source, not the primary one — it supplies the
   * conductor and the word "Encore" and no date at all. Kept because the whole
   * reason this ticket sat blocked for a week was that the feed was read as the
   * only source there was.
   */
  it('keeps the channel feed as a second, weaker source', () => {
    expect(decl.sources.feed).toBeDefined()
    expect(decl.sources.feed as string).toContain('youtube.com/feeds/videos.xml')
  })
})

describe('the ids', () => {
  it('derives every Concert id and title from its date', () => {
    for (const [id, c] of concerts) {
      expect(id).toBe(`cnc-${c.date.replaceAll('-', '')}`)
      // An em dash, not a hyphen — AWK-59's convention, asserted rather than
      // eyeballed because the two are indistinguishable in most editors.
      expect(c.title).toBe(`${c.date} — BSO`)
    }
  })

  it('covers the two dates the sources give, in order', () => {
    expect(concerts.map(([id]) => id)).toEqual(['cnc-20200229', 'cnc-20200301'])
  })

  /**
   * ITEM IDS DERIVE FROM THE FIRST NIGHT, on both Concerts. This is the archive's
   * run convention — `archive-corrections.test.ts` asserts the same of the
   * 2008-12-13/14 pair, and `cnc-20070523` legitimately links `pi-20070520-*`.
   * A renumbering here would silently invalidate `satOut`, which resolves
   * positionally against the program.
   */
  it('numbers the shared items from the first night, on both Concerts', () => {
    for (const [cid, c] of concerts) {
      c.program.forEach((item, index) => {
        expect(item.id, cid).toBe(`pi-20200229-${index + 1}`)
        expect(item.order, item.id).toBe(index + 1)
      })
    }
  })

  /**
   * The two programs are the SAME five items, declared twice, and the applier
   * merges per field — so a label edited on one copy and not the other would
   * write the first and then report the second as `DIFFERS`, a confusing
   * failure a long way from its cause.
   *
   * Compared on the WRITTEN fields only. `why` is prose, it is stripped before
   * anything reaches Contentful, and the two copies carry different prose on
   * purpose: the first documents each item, the second explains why it is a
   * repeat. Asserting raw deep equality would force those to be identical and
   * turn the useful note into duplication.
   */
  it('declares one identical program on both nights', () => {
    const written = ({ id, order, label, work, composer, note }: ProgramItem) => ({
      id,
      order,
      label,
      work,
      composer,
      note,
    })
    const [, first] = concerts[0]!
    const [, second] = concerts[1]!
    expect(second.program.map(written)).toEqual(first.program.map(written))
  })

  it('points every item at a Work and a Composer the declaration reuses', () => {
    const declaredWorks = new Set(reuseWorks.map(([, w]) => w.id))
    const declaredComposers = new Set(reuseComposers.map(([, c]) => c.id))
    for (const item of items) {
      expect(declaredWorks.has(item.work), item.id).toBe(true)
      expect(declaredComposers.has(item.composer), item.id).toBe(true)
    }
  })

  /**
   * `verify_reuse` reads ONE display key per content type and compares it
   * against the live entry — `title` for a work, `sortName` for a composer,
   * `name` for a conductor or orchestra, `label` for a season. A record missing
   * its key is not a soft failure: it is a `KeyError` raised part-way through
   * an apply run, after earlier rows have already been written. Asserted here
   * so that lands offline instead.
   */
  it('gives every reused record the key the applier compares it on', () => {
    // Read through the typed field rather than by string key: the interfaces
    // declare each one required, and this is the test that the JSON agrees.
    const compared: [string, unknown][] = [
      ...reuseWorks.map(([k, r]) => [`work ${k}.title`, r.title] as [string, unknown]),
      ...reuseComposers.map(([k, r]) => [`composer ${k}.sortName`, r.sortName] as [string, unknown]),
      ...reuseConductors.map(([k, r]) => [`conductor ${k}.name`, r.name] as [string, unknown]),
      ...reuseOrchestras.map(([k, r]) => [`orchestra ${k}.name`, r.name] as [string, unknown]),
      ...reuseSeasons.map(([k, r]) => [`season ${k}.label`, r.label] as [string, unknown]),
    ]
    expect(compared.length).toBe(
      reuseWorks.length + reuseComposers.length + reuseConductors.length + reuseOrchestras.length + reuseSeasons.length
    )
    for (const [what, value] of compared) {
      expect(typeof value, what).toBe('string')
      const text = value as string
      expect(text.trim(), what).toBe(text)
      expect(text.length, what).toBeGreaterThan(0)
    }
  })

  it('reuses every declared id somewhere, and no more', () => {
    const used = new Set([
      ...items.map((i) => i.work),
      ...items.map((i) => i.composer),
      ...concerts.map(([, c]) => c.conductor),
      ...concerts.flatMap(([, c]) => c.orchestra),
      ...concerts.map(([, c]) => c.season),
    ])
    for (const [key, rec] of [
      ...reuseWorks,
      ...reuseComposers,
      ...reuseConductors,
      ...reuseOrchestras,
      ...reuseSeasons,
    ]) {
      expect(used.has(rec.id), key).toBe(true)
    }
  })

  /**
   * THE GRAPH IDS ARE NOT THE SPACE'S IDS, and this declaration was first
   * drafted with three that do not exist in Contentful. `bso-graph.json` is
   * parser output; 33 hand-curated concerts and an unknown number of their
   * links live under Contentful auto-ids instead. Asserted as an absence
   * because the failure mode is silent: Contentful accepts a link to a
   * nonexistent entry and the build renders a Concert with a hole in it.
   */
  it('uses no id that exists only in the parser graph', () => {
    const graphOnly = ['orc-bso', 'cmp-van-beethoven-ludwig', 'cnd-nicholas-armstrong']
    for (const id of graphOnly) {
      expect(everyLink(), id).not.toContain(id)
    }
  })
})

describe('the halls', () => {
  it('creates exactly the two the sources name', () => {
    expect(newHalls.map(([id]) => id)).toEqual(['hal-auditorio-silvestre-revueltas', 'hal-castillo-de-chapultepec'])
  })

  /**
   * THE ARCHIVE'S FIRST HALLS OUTSIDE THE UNITED STATES. Every other `location`
   * in the space ends `NY` or names a Brooklyn or New York institution, and
   * `docs/agents/facts.md` records "all 13 halls are Brooklyn/NYC" as the
   * general form of this ticket's problem. Asserted so the country is not
   * quietly dropped to match the neighbours' shorter format.
   */
  it('names the city and the country, unlike every hall before them', () => {
    for (const [id, hall] of newHalls) {
      expect(hall.location, id).toContain('Mexico City')
      expect(hall.location, id).toContain('Mexico')
      expect(hall.location, id).not.toContain('NY')
    }
  })

  it('carries slugs that are kebab-case and free of both rejected shapes', () => {
    for (const [id, hall] of newHalls) {
      expect(hall.slug, id).toBe(hall.slug.trim())
      expect(hall.slug, id).toMatch(KEBAB)
      expect(COMPOSER_PREFIXED.test(hall.slug), `${id}: ${hall.slug}`).toBe(false)
      expect(HASH_SUFFIX.test(hall.slug), `${id}: ${hall.slug}`).toBe(false)
    }
  })

  it('gives each Concert its own hall', () => {
    const used = concerts.map(([, c]) => c.hall)
    expect(new Set(used).size).toBe(concerts.length)
    for (const hall of used) expect(newHalls.map(([id]) => id)).toContain(hall)
  })
})

describe('the program', () => {
  it('plays the four works the sources print, in their printed order', () => {
    expect(items.slice(0, 4).map((i) => i.label)).toEqual([
      'Leonore Overture No. 3',
      'Suite No. 4 in G Major ("Mozartiana")',
      'Huapango',
      "Les Preludes (d'apres Lamartine)",
    ])
  })

  /**
   * HUAPANGO TWICE, and this is the finding the ticket did not have. Both
   * source pages print it third of four; the video is titled "Encore" and its
   * description reads `Program: *Encore* MONCAYO Huapango`. Alex resolved the
   * apparent conflict on 2026-09-06: it was programmed AND repeated at the end.
   * ADR-0012 assumed the encore was a work the printed program did not hold, and
   * that half of its reasoning does not survive the sources.
   */
  it('carries Huapango twice, programmed and then as the encore', () => {
    const huapango = items.filter((i) => i.work === items[2]!.work)
    expect(huapango.length).toBe(2)
    expect(huapango.map((i) => i.order)).toEqual([3, 5])
    expect(huapango[0]!.note).toBeUndefined()
    expect(huapango[1]!.note).toBe('Encore')
  })

  it('marks exactly one item an encore, and puts it last', () => {
    const noted = items.filter((i) => i.note)
    expect(noted.length).toBe(1)
    expect(noted[0]!.order).toBe(Math.max(...items.map((i) => i.order)))
    expect(noted[0]!.id).toBe('pi-20200229-5')
  })

  /**
   * The trap ADR-0012 names, made executable. The archive's only prior Huapango
   * Program item is `pi-20001216-2`, on a pre-tenure 2000 concert two decades
   * from the recording. The WORK is reused; that item must not be.
   *
   * Asserted over the LINKS, not over the file's text — the declaration names
   * that item in prose, on purpose, to say what it is avoiding. A string search
   * would make documenting the trap indistinguishable from falling into it.
   */
  it('reuses the Huapango Work and never the 2000 Program item', () => {
    expect(items[2]!.work).toBe('wrk-huapango-7422ba')
    for (const link of everyLink()) expect(link.startsWith('pi-20001216'), link).toBe(false)
  })

  it('gives every item a label that is non-empty and carries no stray whitespace', () => {
    for (const item of items) {
      expect(item.label.trim(), item.id).toBe(item.label)
      expect(item.label.length, item.id).toBeGreaterThan(0)
    }
  })

  it('carries no soloist, credit, character or per-item conductor', () => {
    for (const item of items) {
      for (const key of ['soloists', 'credits', 'character', 'conductor'] as const) {
        expect(item, `${item.id}.${key}`).not.toHaveProperty(key)
      }
    }
  })
})

describe('the concerts', () => {
  /**
   * `dateNote` IN THE SPACE'S EXACT WORDING, on the second night only. Twelve
   * live Concerts carry the field and every one is either a fuzzy date
   * ("unknown", "var. dates, 1983") or this string on a run's second night.
   * `archive-corrections.test.ts` asserts the same sentence for 2008-12-14.
   * The first night of a run has never carried one and does not start here.
   */
  it('marks the second night an additional performance, and the first nothing', () => {
    const [, first] = concerts[0]!
    const [, second] = concerts[1]!
    expect(first).not.toHaveProperty('dateNote')
    expect(second.dateNote).toBe('Additional performance of the 2020-02-29 program')
  })

  it('puts both Concerts in the season the Brooklyn date already belongs to', () => {
    for (const [id, c] of concerts) {
      expect(c.season, id).toBe('sea-47')
    }
    expect(guards.concertsWithSeason).toBe(concerts.length)
  })

  /**
   * ADR-0006 lets a festival Concert carry no Season. A tour date is not that:
   * these are the Brooklyn Symphony's own 47th season, played abroad, and
   * `sea-47` is the calendar they belong to. Asserted because AWK-82 made the
   * field optional and the absence would now pass the applier silently.
   */
  it('does not take AWK-82’s seasonless festival shape', () => {
    expect(guards.concertsWithSeason).not.toBe(0)
  })

  it('was attended in full on both nights', () => {
    for (const [id, c] of concerts) {
      expect(c.attended, id).toBe(true)
      expect(c.satOut, id).toEqual([])
    }
  })

  it('carries the same conductor and orchestra on both nights', () => {
    const [, first] = concerts[0]!
    for (const [id, c] of concerts) {
      expect(c.conductor, id).toBe(first.conductor)
      expect(c.orchestra, id).toEqual(first.orchestra)
    }
  })

  it('gives each Concert a sourceNote, which is not written to Contentful', () => {
    for (const [id, c] of concerts) {
      expect(c.sourceNote.trim().length, id).toBeGreaterThan(0)
    }
  })
})

describe('the recordings this declaration does not attach', () => {
  /**
   * Three videos, deliberately unattached — the one thing AWK-57 set out to do
   * that these two Concerts do not finish. Both nights share one program, so
   * `recording-item-on-concert-program` is satisfied by either Concert and
   * cannot catch a wrong guess; the descriptions say only "February-March 2020"
   * and name three participating institutions, so there were tour dates beyond
   * these two. The ids are kept here so the next pass does not re-derive them
   * from a feed that returns only the 15 most recent uploads.
   */
  it('records all three, each pointing at an item on the program', () => {
    expect(pending.length).toBe(3)
    const ids = new Set(items.map((i) => i.id))
    for (const [key, rec] of pending) {
      expect(ids.has(rec.item), key).toBe(true)
      expect(rec.videoId, key).toMatch(/^[\w-]{11}$/)
    }
  })

  it('points the encore video at the encore item', () => {
    const encore = pending.find(([, r]) => r.title.toLowerCase().includes('encore'))
    expect(encore).toBeDefined()
    expect(encore![1].item).toBe('pi-20200229-5')
  })

  /**
   * `entriesCreated` is asserted once, in the guards block. What matters here
   * is the different claim: that these three are not entries at all, so adding
   * or removing one must not move that number.
   */
  it('is not counted as an entry this declaration creates', () => {
    expect(guards.entriesCreated).toBe(newHalls.length + items.length + concerts.length)
    expect(guards.entriesCreated).not.toBe(newHalls.length + items.length + concerts.length + pending.length)
  })
})

/**
 * The double-entry pass: the declaration, shaped into what the build reads, run
 * through the build's own rules.
 */
describe('the build’s own invariants, run over the declaration', () => {
  /** The live abbreviation of the Orchestra both Concerts reuse. */
  const BSO = 'BSO'

  const archive: ArchiveShape = {
    concerts: concerts.map(([id, c]) => ({
      id,
      date: c.date,
      // The shape holds abbreviations rather than ids — see its comment. This
      // declaration creates no Orchestra, so the abbreviation is a literal here
      // as it is in the Tilles test.
      orchestras: c.orchestra.map(() => BSO),
      program: c.program.map((i) => i.id),
      satOut: c.satOut,
    })),
    works: [],
    composers: [],
    halls: newHalls.map(([id, h]) => ({ id, slug: h.slug })),
    conductors: [],
    projects: [],
    imageGroups: [],
    recordings: [],
  }

  it('finds nothing to complain about', () => {
    expect(findViolations(archive)).toEqual([])
  })

  /**
   * The rule the shared items actually engage. The two nights are CONSECUTIVE —
   * 2020 is a leap year, so the 29th is followed by the 1st — which is one day,
   * well inside the 14-day ceiling. Asserted because the leap day makes the
   * span the one number here that is easy to get wrong by counting calendar
   * columns, and AWK-57's own brief got it wrong.
   */
  it('accepts the two nights as one run', () => {
    const span = (Date.parse('2020-03-01') - Date.parse('2020-02-29')) / 86_400_000
    expect(span).toBe(1)
    expect(findViolations(archive).map((v) => v.rule)).not.toContain('program-item-run-is-close')
  })

  /**
   * The reason these items are NOT shared with `cnc-20200223`. The 7-day span
   * would pass the invariant, so the build could never have told anyone this
   * was wrong — the program differing is what makes it wrong, and no rule reads
   * that. Asserted as a passing case precisely because it is the trap: the
   * check that would have caught a bad idea does not.
   */
  it('would have accepted the Brooklyn date too, which is why the rule is not the argument', () => {
    const withBrooklyn: ArchiveShape = {
      ...archive,
      concerts: [
        ...archive.concerts,
        { id: 'cnc-20200223', date: '2020-02-23', orchestras: [BSO], program: items.map((i) => i.id), satOut: [] },
      ],
    }
    expect(findViolations(withBrooklyn)).toEqual([])
  })

  it('would catch the same items shared onto a distant Concert', () => {
    const withDistant: ArchiveShape = {
      ...archive,
      concerts: [
        ...archive.concerts,
        { id: 'cnc-20200401', date: '2020-04-01', orchestras: [BSO], program: items.map((i) => i.id), satOut: [] },
      ],
    }
    expect(findViolations(withDistant).map((v) => v.rule)).toContain('program-item-run-is-close')
  })

  it('would catch the same items shared with a second orchestra', () => {
    const withOther: ArchiveShape = {
      ...archive,
      concerts: [
        ...archive.concerts,
        { id: 'cnc-20200302', date: '2020-03-02', orchestras: ['LIYO'], program: items.map((i) => i.id), satOut: [] },
      ],
    }
    expect(findViolations(withOther).map((v) => v.rule)).toContain('program-item-one-orchestra')
  })

  it('would catch a satOut item that is not on the program', () => {
    const withStray: ArchiveShape = {
      ...archive,
      concerts: archive.concerts.map((c) => ({ ...c, satOut: ['pi-20200223-2'] })),
    }
    expect(findViolations(withStray).map((v) => v.rule)).toContain('satout-subset-of-program')
  })
})
