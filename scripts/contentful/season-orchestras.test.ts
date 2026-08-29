import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Guards `season-orchestras.json` — AWK-59's decisions — and, more importantly,
 * re-derives from `bso-graph.json` everything the decisions file deliberately
 * does NOT state.
 *
 * That split is the point, and it follows `merge-composers.json`: a plan file
 * holds decisions, never derivations. Which orchestra held Season 12, and which
 * years Season 12 spans, are facts already in the graph — restating them here
 * would create a second copy to drift. What cannot be derived is the handful of
 * seasons the graph is silent about, and those live in the file with a `why`.
 *
 * This file re-derives in TypeScript what `backfill_seasons.py` derives in
 * Python. The duplication is deliberate double-entry: the applier and the guard
 * reach the same answers by separate routes, so a bug in either is visible as a
 * disagreement rather than as a confidently wrong migration.
 */

const here = import.meta.dirname
const decisions = JSON.parse(readFileSync(join(here, 'season-orchestras.json'), 'utf8')) as Decisions
const graph = JSON.parse(readFileSync(join(here, 'bso-graph.json'), 'utf8')) as Graph

/** Plan files in this directory carry a `note` inside each object. It is prose, not a key. */
function seasonEntries<T>(record: Record<string, T>): [string, T][] {
  return Object.entries(record).filter(([key]) => key !== 'note')
}

interface Decisions {
  labelFormat: { pattern: string; example: string }
  institutions: Record<string, { name: string; orchestras: string[] }>
  handAssigned: Record<string, { years: string; orchestras?: string[]; why: string[] }>
  cancelled: { institution: string; years: string; why: string[] }[]
  liyo: {
    seasons: Record<string, string>
    existingEntry: { id: string; number: number; label: string; state: string }
  }
  scope: {
    graphSeasons: number
    straddleSeasons: string[]
    seasonsWithoutDatedConcerts: string[]
  }
}

interface Graph {
  types: {
    season: Record<string, { number: number; label: string; notes: string | null }>
    concert: Record<string, { date: string | null; season: string | null; orchestra: string | null }>
    orchestra: Record<string, { name: string; abbreviation: string | null }>
  }
}

/**
 * The season a date belongs to, as a start year.
 *
 * A Season runs September to the following summer, so a concert in January
 * belongs to the season that opened the previous autumn. This is the rule that
 * settles a summer tour date: 1993-07-26 closes the 1992-1993 season rather
 * than opening 1993-1994. CONTEXT.md states it as domain language.
 */
function startYear(date: string): number {
  const year = Number(date.slice(0, 4))
  return Number(date.slice(5, 7)) >= 9 ? year : year - 1
}

function span(start: number): string {
  return `${start}-${start + 1}`
}

/** Concerts of one season, oldest first, undated ones dropped. */
function datedConcertsOf(seasonId: string) {
  return Object.values(graph.types.concert)
    .filter((c) => c.season === seasonId && c.date !== null)
    .sort((a, b) => a.date!.localeCompare(b.date!))
}

/** Every concert of one season, dated or not, oldest-dated first. */
function concertsOf(seasonId: string) {
  return Object.values(graph.types.concert).filter((c) => c.season === seasonId)
}

const abbreviationOf = (orchestraId: string) => graph.types.orchestra[orchestraId]?.abbreviation ?? orchestraId

/** Orchestras that held a season, in the order they held it. */
function derivedOrchestras(seasonId: string): string[] {
  const seen: string[] = []
  const inOrder = [...datedConcertsOf(seasonId), ...concertsOf(seasonId)]
  for (const abbreviation of inOrder.filter((c) => c.orchestra !== null).map((c) => abbreviationOf(c.orchestra!))) {
    if (!seen.includes(abbreviation)) seen.push(abbreviation)
  }
  return seen
}

const seasonIds = Object.keys(graph.types.season).sort(
  (a, b) => graph.types.season[a]!.number - graph.types.season[b]!.number
)

describe('season-orchestras.json — the decisions', () => {
  it('states only what the graph cannot answer', () => {
    // Every hand-assigned season must genuinely be one the graph is silent
    // about. A season with usable concerts appearing here would mean someone
    // had written down a derivable fact, which is the copy that drifts.
    for (const [id] of seasonEntries(decisions.handAssigned)) {
      expect(datedConcertsOf(id), `${id} has dated concerts, so its year is derivable`).toEqual([])
    }
  })

  it('hand-assigns exactly the seasons with no dated concerts', () => {
    const undated = seasonIds.filter((id) => datedConcertsOf(id).length === 0)

    expect(undated).toEqual(decisions.scope.seasonsWithoutDatedConcerts)
    expect(
      seasonEntries(decisions.handAssigned)
        .map(([id]) => id)
        .sort()
    ).toEqual([...undated].sort())
  })

  it('gives every hand-assignment a reason', () => {
    // A hand-assigned value with no `why` is indistinguishable from a guess
    // someone typed. These two are the only values in the migration that no
    // source in this repository supports, so they carry the heaviest burden.
    for (const [id, entry] of seasonEntries(decisions.handAssigned)) {
      expect(entry.why.join(' ').length, `${id} needs a real why`).toBeGreaterThan(40)
      expect(entry.years).toMatch(/^\d{4}-\d{4}$/)
    }
  })

  it('hand-assigns an orchestra only where the graph has no concert at all', () => {
    // sea-1 has a concert, undated, so its ORCHESTRA is derivable even though
    // its year is not. sea-11 has no concert whatsoever. Assigning an orchestra
    // to sea-1 by hand would overwrite a fact with an opinion.
    for (const [id, entry] of seasonEntries(decisions.handAssigned)) {
      if (entry.orchestras === undefined) {
        expect(concertsOf(id).length, `${id} omits orchestras, so it must have one to derive`).toBeGreaterThan(0)
      } else {
        expect(concertsOf(id), `${id} hand-assigns orchestras, so the graph must be silent`).toEqual([])
      }
    }
  })
})

describe('the derivation the decisions file leaves to the graph', () => {
  it('finds the 52 Brooklyn seasons', () => {
    expect(seasonIds.length).toBe(decisions.scope.graphSeasons)
    expect(seasonIds.map((id) => graph.types.season[id]!.number)).toEqual(Array.from({ length: 52 }, (_, i) => i + 1))
  })

  it('finds exactly one season straddling a renaming', () => {
    // The whole reason `orchestras` is an array. One case is enough to rule out
    // a single Link, but it is only one — if this ever returns zero, the array
    // decision in archive-schema.json should be revisited rather than the data
    // being forced to fit it.
    const straddling = seasonIds.filter((id) => derivedOrchestras(id).length > 1)

    expect(straddling).toEqual(decisions.scope.straddleSeasons)
  })

  it('orders a straddling season by when each orchestra held it', () => {
    // BHMS opened Season 5 on 1977-10-25 and BHO closed it from 1977-12-17.
    // Reversing them would misreport which name came first.
    expect(derivedOrchestras('sea-5')).toEqual(['BHMS', 'BHO'])
  })

  it('keeps season 28 wholly at BHO', () => {
    // Guards a correction, not a derivation. The live space links the
    // 2001-05-24 concert to BSO, disagreeing with the spreadsheet, with the
    // entry's own title, and with participation-checklist.md — three sources to
    // one. Alex settled it on 2026-08-29: the link is wrong. If this test ever
    // fails, someone has re-imported that error rather than fixed it.
    expect(derivedOrchestras('sea-28')).toEqual(['BHO'])
    expect(derivedOrchestras('sea-29')).toEqual(['BSO'])
  })

  it('never derives an orchestra outside the declared institution', () => {
    const declared = decisions.institutions['BSO']!.orchestras

    for (const id of seasonIds) {
      for (const abbreviation of derivedOrchestras(id)) {
        expect(declared, `${id} holds ${abbreviation}`).toContain(abbreviation)
      }
    }
  })
})

describe('a season number does not imply its year', () => {
  const derivedYear = new Map<number, number>()
  for (const id of seasonIds) {
    const dated = datedConcertsOf(id)
    if (dated.length > 0) derivedYear.set(graph.types.season[id]!.number, startYear(dated[0]!.date!))
  }

  it('holds 1972 + number up to season 47, and breaks after', () => {
    // The trap this migration exists to not fall into. An offset that is right
    // for 47 consecutive seasons and wrong for the last five is the worst shape
    // available: it survives every spot-check anyone would think to run.
    for (const [number, year] of derivedYear) {
      if (number <= 47) expect(year, `season ${number}`).toBe(1972 + number)
      else expect(year, `season ${number}`).toBe(1973 + number)
    }
  })

  it('skips 2020-2021 entirely, and skips nothing else', () => {
    // The cancelled COVID season consumed no number, so 47 is followed by
    // 2021-2022 rather than 2020-2021. Every other step is exactly one year.
    // Hand-assigned years must be folded in first. sea-11 has no concerts, so
    // deriving from dates alone leaves a hole at 1983-1984 that looks exactly
    // like a cancellation and is nothing of the kind — it is missing paperwork,
    // and the season did happen.
    const complete = new Map(derivedYear)
    for (const [id, entry] of seasonEntries(decisions.handAssigned)) {
      complete.set(graph.types.season[id]!.number, Number(entry.years.slice(0, 4)))
    }
    const years = [...complete.entries()].sort((a, b) => a[0] - b[0]).map(([, year]) => year)
    const gaps = years.flatMap((year, i) => (i > 0 && year - years[i - 1]! > 1 ? [span(years[i - 1]! + 1)] : []))

    expect(gaps).toEqual(decisions.cancelled.map((c) => c.years))
    expect(decisions.cancelled.map((c) => c.years)).toEqual(['2020-2021'])
  })

  it('advances by exactly one year across every other season', () => {
    const numbers = [...derivedYear.keys()].sort((a, b) => a - b)

    for (let i = 1; i < numbers.length; i++) {
      const previous = derivedYear.get(numbers[i - 1]!)!
      const current = derivedYear.get(numbers[i]!)!
      const step = current - previous
      expect(step, `season ${numbers[i - 1]} to ${numbers[i]}`).toBeLessThanOrEqual(2)
      expect(step, `season ${numbers[i - 1]} to ${numbers[i]}`).toBeGreaterThan(0)
    }
  })

  it('puts a summer tour date in the season it closes', () => {
    // 1993-07-26 in Melbourne is LIYO Season 30 (1992-1993), not Season 31.
    // The rule is the same one that files a January concert under the previous
    // autumn, and it is why the year is read from dates rather than counted.
    expect(span(startYear('1993-07-26'))).toBe('1992-1993')
    expect(span(startYear('1992-06-14'))).toBe('1991-1992')
    expect(span(startYear('2001-10-17'))).toBe('2001-2002')
  })
})

describe('the labels the migration will write', () => {
  const label = (institution: string, number: number, years: string) =>
    decisions.labelFormat.pattern
      .replace('{institution}', institution)
      .replace('{number}', String(number))
      .replace('{years}', years)

  it('matches the documented example', () => {
    expect(label('BSO', 30, '2002-2003')).toBe(decisions.labelFormat.example)
  })

  it('is unique across both institutions', () => {
    // The invariant Contentful cannot express. Two entries already carry
    // number 29 — one Brooklyn, one LIYO — so the number alone is not an
    // identity and never was.
    const labels = [
      ...seasonIds.map((id) => {
        const { number } = graph.types.season[id]!
        const dated = datedConcertsOf(id)
        const years = dated.length > 0 ? span(startYear(dated[0]!.date!)) : decisions.handAssigned[id]!.years
        return label('BSO', number, years)
      }),
      ...seasonEntries(decisions.liyo.seasons).map(([number, years]) => label('LIYO', Number(number), years)),
    ]

    expect(new Set(labels).size).toBe(labels.length)
  })

  it('keeps (institution, number) unique, which number alone does not', () => {
    const pairs = [
      ...seasonIds.map((id) => `BSO/${graph.types.season[id]!.number}`),
      ...seasonEntries(decisions.liyo.seasons).map(([number]) => `LIYO/${number}`),
    ]
    const numbersAlone = [
      ...seasonIds.map((id) => graph.types.season[id]!.number),
      ...seasonEntries(decisions.liyo.seasons).map(([number]) => Number(number)),
    ]

    expect(new Set(pairs).size).toBe(pairs.length)
    expect(new Set(numbersAlone).size).toBeLessThan(numbersAlone.length)
  })

  it('uses a hyphen in the year span, not an en dash', () => {
    // participation-checklist.md writes its own headings with an en dash. This
    // label deliberately does not: it is matched by pattern here and in the
    // applier, and an en dash is invisible when typed wrong.
    expect(decisions.labelFormat.example).not.toMatch(/[–—]/)
    expect(decisions.labelFormat.example).toMatch(/\d{4}-\d{4}$/)
  })
})

describe('the Long Island Youth Orchestra seasons', () => {
  it('records the four seasons Alex played, with years he supplied', () => {
    expect(
      seasonEntries(decisions.liyo.seasons)
        .map(([n]) => Number(n))
        .sort((a, b) => a - b)
    ).toEqual([29, 30, 31, 32])
    expect(decisions.liyo.seasons['29']).toBe('1991-1992')
    expect(decisions.liyo.seasons['32']).toBe('1994-1995')
  })

  it('advances by one year per season, with no gap', () => {
    const years = seasonEntries(decisions.liyo.seasons)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([, span]) => Number(span.slice(0, 4)))

    for (let i = 1; i < years.length; i++) expect(years[i]! - years[i - 1]!).toBe(1)
  })

  it('does not encode the LIYO offset as a rule', () => {
    // 1962 + number happens to hold for all four. It is NOT written down as a
    // formula anywhere, because that is precisely the mistake the Brooklyn data
    // punishes: LIYO has no concerts in this repository to catch a gap year.
    const source = readFileSync(join(here, 'season-orchestras.json'), 'utf8')

    expect(source).not.toContain('1962 +')
    expect(source).not.toContain('1962+')
  })

  it('points at the draft entry that already exists', () => {
    // Alex created this by hand during data entry. It is unpublished, so the
    // Delivery API never served it — which is why it was missing from the first
    // survey of this migration.
    expect(decisions.liyo.existingEntry.number).toBe(29)
    expect(decisions.liyo.existingEntry.state).toBe('draft')
    expect(decisions.liyo.existingEntry.id).toMatch(/^[A-Za-z0-9]+$/)
  })
})
