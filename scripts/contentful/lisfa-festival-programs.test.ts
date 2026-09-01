import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { findViolations, type ArchiveShape } from '../../app/lib/invariants'

/**
 * Guards `lisfa-festival-programs.json` — AWK-82's transcription of the three
 * scanned LISFA festival programs — before `transcribe_programs.py` writes any
 * of it into a live space with no staging environment.
 *
 * Same division of labour as `tilles-center-programs.test.ts`, and the same
 * limit: the declaration is a TRANSCRIPTION, so most of its content is
 * unfalsifiable from here. Whether the 1993 senior high really played only the
 * Tchaikovsky, whether Bergonzi conducted it, whether the Uniondale hall was
 * the Nassau venue — only the scans answer that, they have no text layer, and a
 * test that restated those values would be reading the file back to itself.
 *
 * What is checkable is the structure, plus the handful of DECISIONS this
 * declaration records. Those are worth asserting even though they are choices
 * rather than facts, because each one is a thing a later editor could undo
 * without noticing what it was for:
 *
 *   * no Concert carries a Season (ADR-0006's festival rule)
 *   * `satOut` is empty on all three (the block-only reading of the program)
 *   * `reuse` holds Composers and nothing else (nothing else was reusable)
 *   * the two Orchestra abbreviations are distinct (`app/lib/archive.ts` treats
 *     `orchestra.abbreviation` as an identity)
 *   * the block Alex played is never repeated in `alsoOnThePage`
 *
 * The last describe block is the double-entry pass the sibling test uses:
 * synthesise an `ArchiveShape` from the declaration and run the BUILD'S OWN
 * `findViolations` over it, so the transcription is checked by the code that
 * would otherwise fail the build, and a rule added to `app/lib/invariants.ts`
 * later guards this file for free.
 *
 * What it cannot do is see the other 659 live Works. A new slug colliding with
 * an existing one under the same composer is invisible from here, which is why
 * `transcribe_programs.py` re-checks every new slug against that composer's
 * live works before it writes. Offline structure, online uniqueness.
 */

const here = import.meta.dirname
const decl = JSON.parse(readFileSync(join(here, 'lisfa-festival-programs.json'), 'utf8')) as Declaration

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
  why?: string
}

interface Division {
  division: string
  conductor: string
  chairperson: string
  program: string[]
}

interface Concert {
  title: string
  date: string
  season?: string
  hall: string
  orchestra: string[]
  conductor: string
  attended: boolean
  satOut: string[]
  sourceNote: string
  alsoOnThePage: {
    otherConcert: string
    officers: string[]
    divisions: Division[]
  }
  program: ProgramItem[]
}

interface Declaration {
  sources: Record<string, string | string[]>
  reuse: {
    composers: Record<string, { id: string; sortName: string; why?: string } | string[]>
    hall?: unknown
    orchestra?: unknown
    conductor?: unknown
    seasons?: unknown
    works?: unknown
  }
  orchestras: Record<string, { name: string; abbreviation: string } | string[]>
  halls: Record<string, { name: string; location: string; slug: string; why?: string } | string[]>
  conductors: Record<string, { firstName: string; lastName: string } | string[]>
  soloists: Record<string, { firstName: string; lastName: string } | string[]>
  composers: Record<
    string,
    { firstName: string; lastName: string; sortName: string; slug: string; why?: string } | string[]
  >
  works: Record<
    string,
    { title: string; slug: string; composer: string; movement?: string[]; nickname?: string } | string[]
  >
  workMovements: Record<string, { title: string; movement: string[] } | string[]>
  concerts: Record<string, Concert | string[]>
  guards: Record<string, number | string[]>
}

/** Plan files in this directory carry a `note` inside each object. It is prose, not a key. */
function entries<T>(record: Record<string, T | string[]>): [string, T][] {
  return Object.entries(record).filter(([key]) => key !== 'note') as [string, T][]
}

const newOrchestras = entries(decl.orchestras)
const newHalls = entries(decl.halls)
const newComposers = entries(decl.composers)
const newConductors = entries(decl.conductors)
const newSoloists = entries(decl.soloists)
const newWorks = entries(decl.works)
const reuseComposers = entries(decl.reuse.composers)
const concerts = entries(decl.concerts)
const guards = Object.fromEntries(entries<number>(decl.guards))

const allItems = concerts.flatMap(([cid, c]) => c.program.map((item) => ({ concertId: cid, ...item })))

const abbreviationOf = new Map(newOrchestras.map(([id, o]) => [id, o.abbreviation]))

/**
 * The two shapes `app/lib/invariants.ts` rejects, restated here because the
 * declaration must not contain one and the build is too late to find out.
 * Kept in sync by intent, not by import — that file holds them as private
 * consts, and exporting them to be borrowed by a test would widen its API for
 * no other caller.
 */
const COMPOSER_PREFIXED = /--/
const HASH_SUFFIX = /-[0-9a-f]{6}$/

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

describe('the declaration agrees with its own guards', () => {
  it('counts what it says it counts', () => {
    expect(concerts.length).toBe(guards.concerts)
    expect(allItems.length).toBe(guards.programItems)
    expect(newWorks.length).toBe(guards.worksCreated)
    expect(newComposers.length).toBe(guards.composersCreated)
    expect(reuseComposers.length).toBe(guards.composersReused)
    expect(newConductors.length).toBe(guards.conductorsCreated)
    expect(newHalls.length).toBe(guards.hallsCreated)
    expect(newOrchestras.length).toBe(guards.orchestrasCreated)
    expect(newSoloists.length).toBe(guards.soloistsCreated)
    expect(entries(decl.workMovements).length).toBe(guards.workMovementsMerged)
  })

  /**
   * The four zeroes are findings, not unfilled fields — this transcription
   * reuses no Work, merges no movement list into a live record, creates no
   * Soloist and gives no item its own conductor. AWK-64 was the opposite on the
   * first two, so a future reader comparing the files should see the zeroes
   * asserted rather than assume the keys were forgotten.
   */
  it('holds its four zeroes on purpose', () => {
    expect(guards.worksReused).toBe(0)
    expect(guards.workMovementsMerged).toBe(0)
    expect(guards.soloistsCreated).toBe(0)
    expect(guards.itemsWithOwnConductor).toBe(0)

    // Cast because `reuse.works` is typed `unknown` here on purpose: the point
    // of the key in this declaration's interface is that it must NOT be present.
    expect(entries((decl.reuse.works ?? {}) as Record<string, unknown>).length).toBe(0)
    expect(allItems.filter((i) => i.conductor).length).toBe(0)
    expect(allItems.filter((i) => i.soloists?.length).length).toBe(guards.itemsWithSoloists)
    expect(guards.itemsWithSoloists).toBe(0)
  })

  it('sums entriesCreated from every creation section', () => {
    const sum =
      newOrchestras.length +
      newHalls.length +
      newConductors.length +
      newComposers.length +
      newWorks.length +
      newSoloists.length +
      allItems.length +
      concerts.length
    expect(sum).toBe(guards.entriesCreated)
  })
})

describe('the sources', () => {
  it('names one scan per Concert, and each exists', () => {
    const paths = entries<string>(decl.sources)
    expect(paths.length).toBe(concerts.length)
    for (const [date, path] of paths) {
      expect(
        concerts.map(([, c]) => c.date),
        date
      ).toContain(date)
      expect(existsSync(join(here, '..', '..', path)), path).toBe(true)
      // The convention AWK-82 renamed them to. `program-` and the concert's own
      // date, so the file a Concert came from is derivable from the Concert.
      expect(path, date).toContain(`program-${date.replaceAll('-', '')}-lisfa-`)
    }
  })
})

describe('the ids', () => {
  it('derives every Concert id and title from its date', () => {
    for (const [id, c] of concerts) {
      expect(id).toBe(`cnc-${c.date.replaceAll('-', '')}`)
      // An em dash, not a hyphen — AWK-59's convention, and the reason this is
      // asserted rather than eyeballed is that the two are indistinguishable in
      // most editors at most sizes.
      expect(c.title).toBe(`${c.date} — LISFA`)
    }
  })

  it('numbers program items from 1, contiguously, matching their order', () => {
    for (const [cid, c] of concerts) {
      const date = c.date.replaceAll('-', '')
      c.program.forEach((item, index) => {
        expect(item.id, cid).toBe(`pi-${date}-${index + 1}`)
        expect(item.order, item.id).toBe(index + 1)
      })
    }
  })

  it('points every item at a Work and a Composer the declaration accounts for', () => {
    const declaredWorks = new Set(newWorks.map(([id]) => id))
    const declaredComposers = new Set([...newComposers.map(([id]) => id), ...reuseComposers.map(([, c]) => c.id)])
    for (const item of allItems) {
      expect(declaredWorks.has(item.work), item.id).toBe(true)
      expect(declaredComposers.has(item.composer), item.id).toBe(true)
    }
  })

  it('links each item’s Composer to the same Composer as its Work', () => {
    const composerOfWork = new Map(newWorks.map(([id, w]) => [id, w.composer]))
    for (const item of allItems) {
      expect(composerOfWork.get(item.work), item.id).toBe(item.composer)
    }
  })

  it('reuses every declared id exactly where it is used, and no more', () => {
    const usedComposers = new Set(allItems.map((i) => i.composer))
    for (const [key, composer] of reuseComposers) {
      expect(usedComposers.has(composer.id), key).toBe(true)
      expect(composer.sortName.trim(), key).toBe(composer.sortName)
      expect(composer.sortName, key).toContain(', ')
    }
  })
})

describe('the slugs', () => {
  const slugs = [
    ...newWorks.map(([id, w]) => [id, w.slug] as const),
    ...newHalls.map(([id, h]) => [id, h.slug] as const),
    ...newComposers.map(([id, c]) => [id, c.slug] as const),
  ]

  it('carries no stray whitespace, and is kebab-case throughout', () => {
    for (const [id, slug] of slugs) {
      expect(slug, id).toBe(slug.trim())
      expect(slug, id).toMatch(KEBAB)
    }
  })

  it('avoids both shapes the build rejects as the importer’s hashed form', () => {
    for (const [id, slug] of slugs) {
      expect(COMPOSER_PREFIXED.test(slug), `${id}: ${slug}`).toBe(false)
      expect(HASH_SUFFIX.test(slug), `${id}: ${slug}`).toBe(false)
    }
  })

  /**
   * `fiddle-faddle` ends in six characters, five of which are hex. It passes
   * only because `l` is not, and it is the closest thing in either declaration
   * to the shape `HASH_SUFFIX` exists to catch. Asserted so that a rename to
   * anything ending `-faddle`-shaped-but-hex is caught here rather than at the
   * next build.
   */
  it('keeps the near-miss slug the JSON warns about', () => {
    const fiddle = newWorks.find(([id]) => id === 'wrk-fiddle-faddle')
    expect(fiddle).toBeDefined()
    expect(fiddle![1].slug).toBe('fiddle-faddle')
    expect(HASH_SUFFIX.test('fiddle-faddle')).toBe(false)
  })

  it('gives each new Work a slug distinct within its composer', () => {
    const byComposer = new Map<string, string[]>()
    for (const [, w] of newWorks) {
      byComposer.set(w.composer, [...(byComposer.get(w.composer) ?? []), w.slug])
    }
    for (const [composer, list] of byComposer) {
      expect(new Set(list).size, composer).toBe(list.length)
    }
  })
})

describe('the Orchestras', () => {
  it('spells the festival out in name and abbreviates it in abbreviation', () => {
    for (const [id, o] of newOrchestras) {
      expect(o.name, id).toContain('Long Island String Festival Association')
      expect(o.abbreviation, id).toContain('LISFA')
      // The short register has to stay short: it is a table column and a work
      // page's byline, not a sentence.
      expect(o.abbreviation.length, id).toBeLessThan(20)
      expect(o.name.length, id).toBeGreaterThan(o.abbreviation.length)
    }
  })

  /**
   * `app/lib/archive.ts` substitutes `orchestra.abbreviation` for an id in
   * invariant messages BECAUSE it is unique. Two divisions sharing one would
   * make those messages ambiguous and the concerts table unreadable, and the
   * temptation is real — both are "LISFA".
   */
  it('keeps the two abbreviations distinct', () => {
    const abbreviations = newOrchestras.map(([, o]) => o.abbreviation)
    expect(new Set(abbreviations).size).toBe(abbreviations.length)
    const names = newOrchestras.map(([, o]) => o.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('gives the senior high division both of its Concerts', () => {
    const used = concerts.flatMap(([, c]) => c.orchestra)
    expect(used.length).toBe(concerts.length)
    for (const id of used) expect(abbreviationOf.has(id)).toBe(true)
    // 1993 and 1994 are one ensemble in two years; 1992 is the other division.
    const counts = new Map<string, number>()
    for (const id of used) counts.set(id, (counts.get(id) ?? 0) + 1)
    expect([...counts.values()].sort()).toEqual([1, 2])
  })
})

describe('the Halls', () => {
  it('locates each one as the space formats a location', () => {
    for (const [id, h] of newHalls) {
      expect(h.location, id).toMatch(/, NY$/)
      expect(h.name.trim(), id).toBe(h.name)
      expect(h.location.trim(), id).toBe(h.location)
    }
  })

  it('is used by exactly one Concert each', () => {
    const used = concerts.map(([, c]) => c.hall)
    expect(new Set(used).size).toBe(concerts.length)
    for (const hall of used) {
      expect(newHalls.map(([id]) => id)).toContain(hall)
    }
  })
})

describe('the decisions this file records', () => {
  /**
   * ADR-0006: the space's one festival Concert "carries no season at all and
   * keeps none". Writing one here would invent a calendar nothing else uses,
   * and it is the assertion most likely to be undone by someone tidying up a
   * field that looks missing.
   */
  it('gives no Concert a Season', () => {
    for (const [id, c] of concerts) {
      expect(c, id).not.toHaveProperty('season')
    }
    expect(guards.concertsWithSeason).toBe(0)
  })

  it('reuses Composers and nothing else', () => {
    expect(Object.keys(decl.reuse).filter((k) => k !== 'note')).toEqual(['composers'])
    for (const key of ['hall', 'orchestra', 'conductor', 'seasons', 'works'] as const) {
      expect(decl.reuse[key], key).toBeUndefined()
    }
  })

  /**
   * The block-only reading of a festival program. `satOut` means a work Alex
   * declined at a concert he played (CONTEXT.md); the other two divisions'
   * blocks were never his to decline.
   */
  it('marks every Concert attended, with nothing sat out', () => {
    for (const [id, c] of concerts) {
      expect(c.attended, id).toBe(true)
      expect(c.satOut, id).toEqual([])
    }
  })

  it('never repeats Alex’s own division under alsoOnThePage', () => {
    for (const [id, c] of concerts) {
      const page = c.alsoOnThePage
      expect(page.otherConcert, id).toContain('Sunday')
      expect(page.officers.length, id).toBe(3)
      // Three divisions perform; two of them are not his.
      expect(page.divisions.length, id).toBe(2)

      const mine = abbreviationOf.get(c.orchestra[0])!
      const own = mine.includes('Jr.') ? 'Junior High School Orchestra' : 'Senior High School Orchestra'
      for (const division of page.divisions) {
        expect(division.division, `${id}: ${own}`).not.toBe(own)
        expect(division.program.length, division.division).toBeGreaterThan(0)
        expect(division.conductor.trim().length, division.division).toBeGreaterThan(0)
      }
    }
  })

  it('keeps a sourceNote on every Concert, carrying the festival ordinal', () => {
    for (const [id, c] of concerts) {
      expect(c.sourceNote, id).toMatch(/\d+(?:th|st|nd|rd) Annual Concert/)
      expect(c.sourceNote, id).toContain('Nassau County')
    }
  })
})

describe('the Works', () => {
  /**
   * ADR-0007 keeps every form judgement in period-and-forms.json and lets Form
   * stay incomplete. A `forms` key here would be a second home for a decision
   * that already has one, and a `period` would pre-empt the build sweep's
   * inheritance.
   */
  it('sets neither period nor forms on a new Work or Composer', () => {
    for (const [id, w] of newWorks) {
      expect(w, id).not.toHaveProperty('period')
      expect(w, id).not.toHaveProperty('forms')
    }
    for (const [id, c] of newComposers) {
      expect(c, id).not.toHaveProperty('period')
    }
  })

  it('trims and fills every movement it records', () => {
    const withMovements = newWorks.filter(([, w]) => w.movement?.length)
    // The Holst suite's three, the Tchaikovsky serenade's four — both printed on
    // their pages — and the Mozart's four, which are NOT: they are the curator's,
    // added in the web app from the catalogue. See that Work's `movementsNote`.
    expect(withMovements.length).toBe(3)
    for (const [id, w] of withMovements) {
      for (const movement of w.movement!) {
        expect(movement, id).toBe(movement.trim())
        expect(movement.length, id).toBeGreaterThan(0)
      }
    }
  })

  /**
   * The Mozart is the one item that is part of a Work rather than a Work, and
   * that stays true however the Work is titled: it follows AWK-64's Violin
   * Concerto #5 precedent, linking the complete Work and qualifying it on the
   * item. The Work now carries all four movements — Alex added them — so the
   * item's note is the only thing left saying which one was played, which makes
   * it more load-bearing than when this file was written, not less.
   */
  it('leaves the single-movement performance on the item', () => {
    const mozart = newWorks.find(([id]) => id === 'wrk-serenade-eine-kleine-nachtmusik')!
    expect(mozart[1].movement).toHaveLength(4)
    expect(mozart[1].movement![1]).toContain('Romance')

    const qualified = allItems.filter((i) => i.note)
    expect(qualified.length).toBe(guards.itemsWithMovementNote)
    expect(qualified.map((i) => i.id)).toEqual(['pi-19920209-2'])
    expect(qualified[0].note).toMatch(/Romanze/)
  })

  /**
   * One direction only, and the asymmetry is the point. A title carrying a
   * parenthetical nickname must set the field, or the page renders the nickname
   * while nothing can search on it. The reverse does NOT hold: the space's 46
   * nicknamed Works mostly put it in both, but the catalogue title Alex chose
   * for the Mozart carries the nickname in the field alone — `Serenade No. 13 in
   * G major, K. 525` plus `Eine Kleine Nachtmusik` — and asserting both
   * directions would forbid that.
   */
  it('sets the nickname field wherever the title carries a parenthetical', () => {
    for (const [id, w] of newWorks) {
      if (w.title.includes('("')) {
        expect(w.nickname, id).toBeDefined()
        expect(w.title, id).toContain(`("${w.nickname}")`)
      }
    }
  })

  /**
   * The printed typo survives nowhere, which is NOT where this declaration
   * started. It created the Work as `Serenade ("Eine Kleine Nachtmusik")` with
   * the printed `Nachmusik` on the item label — a label being the place a
   * per-performance misspelling belongs, the way 1992-12-13 reads "Carneval
   * Overture". Alex then corrected both in the web app: the Work to the
   * catalogue title, and later the label too. The declaration follows the space.
   *
   * Asserted as an absence across BOTH fields, because the reason to keep this
   * test is the thing that would quietly undo it: someone re-reading the scan,
   * seeing `Nachmusik`, and restoring it as a faithful transcription.
   */
  it('carries the printed typo nowhere', () => {
    const mozart = newWorks.find(([id]) => id === 'wrk-serenade-eine-kleine-nachtmusik')!
    expect(mozart[1].title).toContain('K. 525')
    expect(mozart[1].nickname).toBe('Eine Kleine Nachtmusik')
    expect(mozart[1].slug).toContain('nachtmusik')

    const item = allItems.find((i) => i.work === 'wrk-serenade-eine-kleine-nachtmusik')!
    expect(item.label).toBe('Serenade (Eine Kleine Nachtmusik)')

    for (const [id, w] of newWorks) expect(w.title, id).not.toContain('Nachmusik)')
    for (const item of allItems) expect(item.label, item.id).not.toContain('Nachmusik)')
  })

  it('normalises the printed #3 on the Work and keeps it on the item', () => {
    const respighi = newWorks.find(([id]) => id === 'wrk-ancient-airs-and-dances-suite-no-3')!
    expect(respighi[1].title).toContain('Suite No. 3')
    expect(respighi[1].title).not.toContain('#')

    const item = allItems.find((i) => i.work === 'wrk-ancient-airs-and-dances-suite-no-3')!
    expect(item.label).toContain('#3')
  })
})

describe('the program items', () => {
  it('carries no character on any item', () => {
    // AWK-69 cleared the last instruments out of this field, and AWK-64 records
    // why copying its first use was wrong. Nothing here has a performer at all.
    for (const item of allItems) {
      expect(item, item.id).not.toHaveProperty('character')
      expect(item, item.id).not.toHaveProperty('credits')
    }
  })

  it('gives every item a label the scan printed', () => {
    for (const item of allItems) {
      expect(item.label.trim(), item.id).toBe(item.label)
      expect(item.label.length, item.id).toBeGreaterThan(0)
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
      // The shape holds abbreviations rather than ids — see its comment. This
      // declaration creates its own Orchestras, so unlike the Tilles test the
      // abbreviation is a value here rather than a literal.
      orchestras: c.orchestra.map((oid) => abbreviationOf.get(oid) ?? oid),
      program: c.program.map((i) => i.id),
      satOut: c.satOut,
    })),
    works: newWorks.map(([id, w]) => ({
      id,
      slug: w.slug,
      composerId: w.composer,
      arrangerId: null,
      arrangementType: null,
    })),
    composers: newComposers.map(([id, c]) => ({ id, slug: c.slug })),
    // Unlike the Tilles declaration, this one creates Halls — so their slugs go
    // through the same whitespace sweep as everything else's.
    halls: newHalls.map(([id, h]) => ({ id, slug: h.slug })),
    conductors: newConductors.map(([id]) => ({ id, slug: '' })),
    projects: [],
    imageGroups: [],
    recordings: [],
  }

  it('finds nothing to complain about', () => {
    expect(findViolations(archive)).toEqual([])
  })

  /**
   * The reason `serenade-for-strings` is allowed to be Barber's slug too, made
   * executable. ADR-0008 scopes a work slug to its composer; if that ever
   * changed to space-wide, this test fails and the declaration needs a new slug
   * rather than a surprise at build time.
   */
  it('permits the slug this declaration shares with another composer’s Work', () => {
    const withBarber: ArchiveShape = {
      ...archive,
      works: [
        ...archive.works,
        {
          id: 'wrk-serenade-for-strings-eb7ac3',
          slug: 'serenade-for-strings',
          composerId: 'cmp-barber-samuel',
          arrangerId: null,
          arrangementType: null,
        },
      ],
    }
    expect(findViolations(withBarber)).toEqual([])
  })

  it('would catch the same slug used twice under one composer', () => {
    const withDuplicate: ArchiveShape = {
      ...archive,
      works: [
        ...archive.works,
        {
          id: 'wrk-serenade-for-strings-again',
          slug: 'serenade-for-strings',
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
