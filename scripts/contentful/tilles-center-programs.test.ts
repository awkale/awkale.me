import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { findViolations, type ArchiveShape } from '../../app/lib/invariants'

/**
 * Guards `tilles-center-programs.json` — AWK-64's transcription of the three
 * scanned Tilles Center LIYO programs — before `transcribe_programs.py` writes
 * any of it into a live space with no staging environment.
 *
 * The thing worth understanding about this file is what it can and cannot see.
 *
 * The declaration is a TRANSCRIPTION, so most of its content is unfalsifiable
 * from here: whether the 1995 program really opened with Nicolai, whether the
 * bassoonist was Kazanjian, whether Deaver took the Dvořák. Only the scans can
 * answer that, they have no text layer, and a test that asserted those values
 * would be restating the file back to itself — the same trap
 * `period-and-forms.test.ts` names about its five judgement calls.
 *
 * What IS checkable is everything structural, and that turns out to be most of
 * the ways a hand-typed transcription of 35 entries actually goes wrong: an
 * item pointing at a work nobody declared, a soloist credited on the wrong
 * instrument, two items sharing an order, a slug in the importer's hashed shape,
 * a `satOut` holding something off the program.
 *
 * So the interesting assertion here is the last one. Rather than restate
 * ADR-0006's and ADR-0008's rules in a second dialect, it synthesises an
 * `ArchiveShape` from the declaration and runs the BUILD'S OWN
 * `findViolations` over it. Two consequences: the transcription is checked by
 * the same code that will fail the build if it is wrong, and a rule added to
 * `app/lib/invariants.ts` later starts guarding this file for free. It is the
 * double-entry `season-orchestras.test.ts` and `period-and-forms.test.ts` both
 * use, pointed at a plan instead of at a migration.
 *
 * What it still cannot do is see the other 649 live Works. A new slug colliding
 * with an existing one under the same composer is invisible from here, which is
 * why `transcribe_programs.py` re-checks every new slug against that composer's
 * live works before it writes. Offline structure, online uniqueness; neither
 * check subsumes the other.
 */

const here = import.meta.dirname
const decl = JSON.parse(readFileSync(join(here, 'tilles-center-programs.json'), 'utf8')) as Declaration

interface ProgramItem {
  id: string
  order: number
  label: string
  work: string
  composer: string
  conductor?: string
  soloists?: string[]
  character?: string
  credits?: string[]
  note?: string
}

interface Concert {
  title: string
  date: string
  season: string
  hall: string
  orchestra: string[]
  conductor: string
  attended: boolean
  satOut: string[]
  sourceNote: string
  program: ProgramItem[]
}

interface Declaration {
  sources: Record<string, string | string[]>
  reuse: {
    hall: { id: string; name: string }
    orchestra: { id: string; name: string }
    conductor: { id: string; name: string }
    seasons: Record<string, { id: string; label: string } | string[]>
    composers: Record<string, { id: string; sortName: string } | string[]>
    works: Record<string, { id: string; title: string; composer: string; why?: string } | string[]>
  }
  composers: Record<string, { firstName: string; lastName: string; sortName: string; slug: string } | string[]>
  conductors: Record<string, { firstName: string; lastName: string } | string[]>
  soloists: Record<string, { firstName: string; lastName: string; fullName: string; instrument: string[] } | string[]>
  works: Record<string, { title: string; slug: string; composer: string; movement?: string[] } | string[]>
  workMovements: Record<string, { title: string; movement: string[] } | string[]>
  concerts: Record<string, Concert | string[]>
  guards: Record<string, number | string[]>
}

/** Plan files in this directory carry a `note` inside each object. It is prose, not a key. */
function entries<T>(record: Record<string, T | string[]>): [string, T][] {
  return Object.entries(record).filter(([key]) => key !== 'note') as [string, T][]
}

const newComposers = entries(decl.composers)
const newConductors = entries(decl.conductors)
const newSoloists = entries(decl.soloists)
const newWorks = entries(decl.works)
const reuseWorks = entries(decl.reuse.works)
const reuseComposers = entries(decl.reuse.composers)
const concerts = entries(decl.concerts)
const guards = Object.fromEntries(entries<number>(decl.guards))

const allItems = concerts.flatMap(([cid, c]) => c.program.map((item) => ({ concertId: cid, ...item })))

/**
 * The two shapes `app/lib/invariants.ts` rejects, restated here because the
 * declaration must not contain one and the build is too late to find out.
 * Kept in sync by intent, not by import — that file holds them as private
 * consts, and exporting them to be borrowed by one test would widen its API
 * for no other caller.
 */
const COMPOSER_PREFIXED = /--/
const HASH_SUFFIX = /-[0-9a-f]{6}$/

describe('the declaration agrees with its own guards', () => {
  it('counts what it says it counts', () => {
    expect(concerts.length).toBe(guards.concerts)
    expect(allItems.length).toBe(guards.programItems)
    expect(newWorks.length).toBe(guards.worksCreated)
    expect(reuseWorks.length).toBe(guards.worksReused)
    expect(entries(decl.workMovements).length).toBe(guards.workMovementsMerged)
    expect(newComposers.length).toBe(guards.composersCreated)
    expect(reuseComposers.length).toBe(guards.composersReused)
    expect(newConductors.length).toBe(guards.conductorsCreated)
    expect(newSoloists.length).toBe(guards.soloistsCreated)
  })

  it('creates the number of entries the guards promise', () => {
    const created =
      newComposers.length +
      newConductors.length +
      newSoloists.length +
      newWorks.length +
      allItems.length +
      concerts.length
    expect(created).toBe(guards.entriesCreated)
  })

  it('names every source file, and every one is on disk', () => {
    const paths = Object.entries(decl.sources).filter(([k]) => k !== 'note')
    expect(paths.length).toBe(guards.concerts)
    for (const [date, path] of paths) {
      expect(typeof path, date).toBe('string')
      expect(existsSync(join(here, '..', '..', path as string)), path as string).toBe(true)
    }
  })
})

describe('entry ids', () => {
  it('are unique across everything the transcription creates', () => {
    const ids = [
      ...newComposers.map(([id]) => id),
      ...newConductors.map(([id]) => id),
      ...newSoloists.map(([id]) => id),
      ...newWorks.map(([id]) => id),
      ...allItems.map((i) => i.id),
      ...concerts.map(([id]) => id),
    ]
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('never reuses an id the transcription also links as existing', () => {
    const created = new Set([...newWorks.map(([id]) => id), ...newComposers.map(([id]) => id)])
    for (const [, work] of reuseWorks) expect(created.has(work.id), work.id).toBe(false)
    for (const [, composer] of reuseComposers) expect(created.has(composer.id), composer.id).toBe(false)
  })

  it('follows AWK-59’s naming, so a reader can find the 1993-07-26 precedent', () => {
    for (const [cid, concert] of concerts) {
      const compact = concert.date.replaceAll('-', '')
      expect(cid).toBe(`cnc-${compact}`)
      expect(concert.title).toBe(`${concert.date} — LIYO`)
      // An em dash, not a hyphen. cnc-19930726 uses one and a mismatch here is invisible.
      expect(concert.title).toContain('—')
      concert.program.forEach((item, index) => {
        expect(item.id).toBe(`pi-${compact}-${index + 1}`)
      })
    }
  })
})

describe('each concert’s program', () => {
  it('is ordered from 1 with no gaps and no duplicates', () => {
    for (const [cid, concert] of concerts) {
      const orders = concert.program.map((i) => i.order)
      expect(orders, cid).toEqual(Array.from({ length: concert.program.length }, (_, n) => n + 1))
    }
  })

  it('carries a non-empty label with no stray whitespace', () => {
    for (const item of allItems) {
      expect(item.label.length, item.id).toBeGreaterThan(0)
      expect(item.label, item.id).toBe(item.label.trim())
    }
  })

  it('links a work that is either created here or declared as reused', () => {
    const known = new Set([...newWorks.map(([id]) => id), ...reuseWorks.map(([, w]) => w.id)])
    for (const item of allItems) expect(known.has(item.work), `${item.id} -> ${item.work}`).toBe(true)
  })

  it('links a composer that is either created here or declared as reused', () => {
    const known = new Set([...newComposers.map(([id]) => id), ...reuseComposers.map(([, c]) => c.id)])
    for (const item of allItems) {
      expect(known.has(item.composer), `${item.id} -> ${item.composer}`).toBe(true)
    }
  })

  /**
   * The check that earns its place. An item names a Work and a Composer
   * independently, and Contentful validates each link on its own — so an item
   * can point at Gershwin's Rhapsody in Blue while crediting Debussy and
   * nothing rejects it. Both halves are declared here, so the pair is
   * checkable here.
   */
  it('credits the composer the work actually belongs to', () => {
    const composerOf = new Map<string, string>([
      ...newWorks.map(([id, w]) => [id, w.composer] as [string, string]),
      ...reuseWorks.map(([, w]) => [w.id, w.composer] as [string, string]),
    ])
    for (const item of allItems) {
      expect(item.composer, `${item.id} (${item.label})`).toBe(composerOf.get(item.work))
    }
  })

  it('holds no satOut, because no visiting ensemble played on these three', () => {
    for (const [cid, concert] of concerts) {
      expect(concert.satOut, cid).toEqual([])
      expect(concert.attended, cid).toBe(true)
    }
  })

  /**
   * `sourceNote` is the one key here the applier deliberately does not write —
   * the content model has nowhere for a season ordinal or a start time. Left
   * unasserted it reads as dead weight someone will later delete, taking the
   * only record of how these dates were assigned to their Seasons with it. So
   * it is pinned from both sides: present in the declaration, absent from the
   * applier.
   */
  it('records each program’s own account of itself, which Contentful cannot hold', () => {
    for (const [cid, concert] of concerts) {
      expect(concert.sourceNote, cid).toBeTruthy()
      expect(concert.sourceNote, cid).toBe(concert.sourceNote.trim())
    }
  })

  it('is never written to the space by the applier', () => {
    const applier = readFileSync(join(here, 'transcribe_programs.py'), 'utf8')
    const buildPlan = applier.slice(applier.indexOf('def build_plan'), applier.indexOf('def verify_reuse'))
    expect(buildPlan).not.toContain('sourceNote')
  })
})

describe('the two items that carry their own conductor', () => {
  it('are exactly the count the guards name, and both resolve', () => {
    const declared = new Set(newConductors.map(([id]) => id))
    const overrides = allItems.filter((i) => i.conductor)
    expect(overrides.length).toBe(guards.itemsWithOwnConductor)
    for (const item of overrides) {
      expect(declared.has(item.conductor!), `${item.id} -> ${item.conductor}`).toBe(true)
    }
  })

  it('never restates the concert’s own conductor, which would say nothing', () => {
    for (const [, concert] of concerts) {
      for (const item of concert.program) {
        if (item.conductor) expect(item.conductor).not.toBe(concert.conductor)
      }
    }
  })

  it('uses each new conductor, so neither is created for nothing', () => {
    const used = new Set(allItems.map((i) => i.conductor).filter(Boolean))
    for (const [id] of newConductors) expect(used.has(id), id).toBe(true)
  })
})

describe('soloists', () => {
  it('appear on the number of items the guards name, and all resolve', () => {
    const declared = new Set(newSoloists.map(([id]) => id))
    const withSoloists = allItems.filter((i) => i.soloists?.length)
    expect(withSoloists.length).toBe(guards.itemsWithSoloists)
    for (const item of withSoloists) {
      for (const sid of item.soloists!) expect(declared.has(sid), `${item.id} -> ${sid}`).toBe(true)
    }
  })

  it('are each credited exactly once, since each played one piece', () => {
    const counts = new Map<string, number>()
    for (const item of allItems) {
      for (const sid of item.soloists ?? []) counts.set(sid, (counts.get(sid) ?? 0) + 1)
    }
    expect(counts.size).toBe(newSoloists.length)
    for (const [id] of newSoloists) expect(counts.get(id), id).toBe(1)
  })

  /**
   * `credits` restates the soloist's name and instrument on the item, the way
   * cnc-19930726's items do. Two copies of one fact is two things to get wrong,
   * so this asserts the free text agrees with the soloist record rather than
   * trusting five hand-typed strings to match.
   */
  it('are credited with the name and instrument their own record names', () => {
    const soloist = new Map(newSoloists)
    for (const item of allItems.filter((i) => i.soloists?.length)) {
      const record = soloist.get(item.soloists![0])!
      expect(item.credits, item.id).toEqual([`${record.fullName}, ${record.instrument[0]}`])
    }
  })

  /**
   * `character` is for the non-instrument role — `Isolde`, `Dancer`,
   * `Filmmaker`. An instrument goes on `soloist.instrument`. This file set it to
   * the instrument in its first version, copying AWK-59, and the assertion ran
   * the wrong way round to match; both were corrected on 2026-08-31. Asserted
   * rather than merely removed, because the tempting thing for the next person
   * holding a program that names an instrument is to put it back.
   */
  it('never restate the instrument as a `character`', () => {
    for (const item of allItems) {
      expect(item.character, `${item.id} (${item.label})`).toBeUndefined()
    }
  })

  it('gives every soloist a full name matching its parts', () => {
    for (const [id, s] of newSoloists) {
      expect(s.fullName, id).toBe(`${s.firstName} ${s.lastName}`)
      expect(s.instrument.length, id).toBeGreaterThan(0)
    }
  })
})

describe('slugs, per ADR-0008', () => {
  const slugged = [
    ...newWorks.map(([id, w]) => ({ id, slug: w.slug, what: 'work' })),
    ...newComposers.map(([id, c]) => ({ id, slug: c.slug, what: 'composer' })),
  ]

  it('are hand-written, not the importer’s hashed form', () => {
    for (const { id, slug } of slugged) {
      expect(COMPOSER_PREFIXED.test(slug), `${id}: ${slug}`).toBe(false)
      expect(HASH_SUFFIX.test(slug), `${id}: ${slug}`).toBe(false)
    }
  })

  it('carry no stray whitespace, per AWK-61', () => {
    for (const { id, slug } of slugged) expect(slug, id).toBe(slug.trim())
  })

  it('are lowercase kebab-case with no leading or trailing dash', () => {
    for (const { id, slug } of slugged) expect(slug, id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  })

  it('are unique per composer among the works created here', () => {
    const seen = new Map<string, string>()
    for (const [id, work] of newWorks) {
      const key = `${work.composer} ${work.slug}`
      expect(seen.get(key), `${id} collides with ${seen.get(key)}`).toBeUndefined()
      seen.set(key, id)
    }
  })

  it('gives every new composer a distinct slug and sort name', () => {
    expect(new Set(newComposers.map(([, c]) => c.slug)).size).toBe(newComposers.length)
    for (const [id, c] of newComposers) {
      expect(c.sortName, id).toBe(`${c.lastName}, ${c.firstName}`)
    }
  })
})

describe('the decisions the ticket did not make', () => {
  /** All 46 live conductors have conductor.slug unset. Decided by Alex, 2026-08-31. */
  it('leaves conductor.slug off both new conductors', () => {
    for (const [id, c] of newConductors) {
      expect(Object.keys(c).sort(), id).toEqual(['firstName', 'lastName'])
    }
  })

  /**
   * ADR-0007 keeps every form judgement in period-and-forms.json and lets Form
   * stay incomplete. A `forms` key here would be a second home for a decision
   * that already has one, and a `period` would pre-empt the inheritance the
   * build sweep performs.
   */
  it('sets neither period nor forms on a new work or composer', () => {
    for (const [id, w] of newWorks) {
      expect(w, id).not.toHaveProperty('period')
      expect(w, id).not.toHaveProperty('forms')
    }
    for (const [id, c] of newComposers) {
      expect(c, id).not.toHaveProperty('period')
    }
  })

  it('records movements only where the scan prints them', () => {
    const withMovements = newWorks.filter(([, w]) => w.movement?.length)
    // Piston's nine and Hindemith's four; Franck's three merge into a live record.
    expect(withMovements.length).toBe(2)
    for (const [id, w] of withMovements) {
      for (const m of w.movement!) {
        expect(m, id).toBe(m.trim())
        expect(m.length, id).toBeGreaterThan(0)
      }
    }
    for (const [id, w] of entries(decl.workMovements)) {
      expect(w.movement.length, id).toBeGreaterThan(0)
    }
  })
})

/**
 * The double-entry pass: the declaration, shaped into what the build reads, run
 * through the build's own rules.
 */
describe('the build’s own invariants, run over the declaration', () => {
  const archive: ArchiveShape = {
    concerts: concerts.map(([id, c]) => ({
      id,
      date: c.date,
      // The shape holds abbreviations rather than ids — see its comment.
      orchestras: ['LIYO'],
      program: c.program.map((i) => i.id),
      satOut: c.satOut,
    })),
    works: [
      ...newWorks.map(([id, w]) => ({
        id,
        slug: w.slug,
        composerId: w.composer,
        arrangerId: null,
        arrangementType: null,
      })),
      // The reused works carry no slug here: this file cannot see their live
      // values, and inventing one would assert a fact it does not hold.
    ],
    composers: newComposers.map(([id, c]) => ({ id, slug: c.slug })),
    halls: [],
    conductors: newConductors.map(([id]) => ({ id, slug: '' })),
    projects: [],
    imageGroups: [],
    recordings: [],
  }

  it('finds nothing to complain about', () => {
    expect(findViolations(archive)).toEqual([])
  })

  it('would have caught the duplicate the ticket’s checklist implied', () => {
    // AWK-64 says "create the 17 Works". Doing so for the Tchaikovsky excerpt —
    // which AWK-59 already created for the 1993-07-26 program — collides on
    // (composer, slug). This asserts the guard that makes that a build failure
    // rather than a second URL, now that work.slug's unique constraint is gone.
    const withDuplicate: ArchiveShape = {
      ...archive,
      works: [
        ...archive.works,
        {
          id: 'wrk-theme-and-variations-suite-no-3',
          slug: 'theme-and-variations-from-suite-no-3-in-g-major',
          composerId: 'cmp-tchaikovsky-pyotr-ilyich',
          arrangerId: null,
          arrangementType: null,
        },
        {
          id: 'wrk-theme-and-variations-from-suite-3-again',
          slug: 'theme-and-variations-from-suite-no-3-in-g-major',
          composerId: 'cmp-tchaikovsky-pyotr-ilyich',
          arrangerId: null,
          arrangementType: null,
        },
      ],
    }
    const violations = findViolations(withDuplicate)
    expect(violations.map((v) => v.rule)).toContain('work-slug-unique-per-composer')
  })
})
