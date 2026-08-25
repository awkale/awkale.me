import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Guards the three source corrections AWK-38 applies in `parse_archive.py`.
 *
 * WHY THIS FILE EXISTS AT ALL. The spreadsheet is a received primary source and is
 * never edited — the corrections live in the parser, keyed by sheet row. That makes
 * them invisible in the source and easy for a later tidy-up to drop, because each
 * one looks like a special case with no test behind it. This is that test: it reads
 * the emitted graph and asserts the corrected shape, so removing a correction fails
 * here rather than silently reverting the archive.
 *
 * It asserts `bso-graph.json`, not the Contentful space, in the same spirit as
 * participation.test.ts — nothing here proves the import ran.
 *
 * NOTE `bso-graph.json` IS GITIGNORED — it is parser output, regenerated with
 * `python3 scripts/contentful/parse_archive.py` (needs openpyxl). This file
 * therefore fails on a fresh clone until the parser has been run once, exactly as
 * participation.test.ts already does. Harmless while the suite is local-only;
 * it is the thing to fix first if this repo ever grows a CI job.
 *
 * THE ONE THING IT CANNOT CATCH is whether the corrections are factually right.
 * That 2008-12-13 was Grand Street and 2008-12-14 was St Ann came from Alex, not
 * from any source in this repo, and no test can re-derive it.
 */
const here = import.meta.dirname
const graph = JSON.parse(readFileSync(join(here, 'bso-graph.json'), 'utf8')) as Graph

type Concert = {
  title: string
  date: string | null
  dateNote: string | null
  hall: string | null
  orchestra: string | null
  conductor: string | null
  program: string[]
}

type Graph = {
  types: {
    concert: Record<string, Concert>
    hall: Record<string, { name: string }>
    programItem: Record<string, { label: string; order: number | null }>
  }
  report: Record<string, string[]>
}

const concerts = graph.types.concert

describe('correction 1 — 2007-12-16 conductor and orchestra', () => {
  /**
   * Row 888 left both cells blank where every neighbouring concert in the season
   * reads Armstrong / BSO. ADR-0006 ships conductor as one of only two browse
   * filters, so a blank conductor is not cosmetic: the concert is unreachable from
   * the filter while it is the only played concert missing one.
   */
  it('fills the conductor, which the browse filter depends on', () => {
    expect(concerts['cnc-20071216']?.conductor).toBe('cnd-nicholas-armstrong')
  })

  it('fills the orchestra', () => {
    expect(concerts['cnc-20071216']?.orchestra).toBe('orc-bso')
  })

  it('leaves the hall the source already recorded', () => {
    expect(concerts['cnc-20071216']?.hall).toBe('hal-church-of-st-ann-the-holy-trinity')
  })
})

describe('correction 2 — the 2008-12 two-venue run', () => {
  /**
   * Rows 912 and 913 are the archive's first run at two different venues: Saturday
   * at Grand Street, Sunday at St Ann. The sheet typed the Sunday's day-of-month as
   * 13 while labelling it "Sun"; Dec 13 2008 was a Saturday, so the weekday is the
   * half that survives and the date is the typo.
   *
   * Before this correction the two rows parsed as one concert — `duplicate_header()`
   * saw a matching date and a matching opening piece and dropped row 912 — which is
   * why the graph held 12 halls against Contentful's 13.
   */
  it('keeps the Saturday as its own concert at Grand Street', () => {
    const sat = concerts['cnc-20081213']
    expect(sat?.date).toBe('2008-12-13')
    expect(sat?.hall).toBe('hal-grand-street-campus-high-schools')
  })

  it('creates the Sunday as a separate concert at St Ann', () => {
    const sun = concerts['cnc-20081214']
    expect(sun?.date).toBe('2008-12-14')
    expect(sun?.hall).toBe('hal-church-of-st-ann-the-holy-trinity')
  })

  /**
   * The point of the whole exercise: one program, two occasions. Sharing the item
   * records by reference is what makes a (concert, item) pair addressable, which is
   * what ADR-0006's Work rule and ADR-0012's recording model both hang off.
   */
  it('shares one program across both nights', () => {
    const sat = concerts['cnc-20081213']
    const sun = concerts['cnc-20081214']
    expect(sat?.program).toEqual(['pi-20081213-1', 'pi-20081213-2', 'pi-20081213-3'])
    expect(sun?.program).toEqual(sat?.program)
  })

  /**
   * Item ids derive from the FIRST night's concert id, exactly as the seven
   * pre-existing runs do. Asserted because a renumbering here would silently
   * invalidate every `satOut` link, which resolves positionally.
   */
  it('numbers the shared items from the first night', () => {
    for (const [id, order] of [
      ['pi-20081213-1', 1],
      ['pi-20081213-2', 2],
      ['pi-20081213-3', 3],
    ] as const) {
      expect(graph.types.programItem[id]?.order).toBe(order)
    }
  })

  it('marks the Sunday as an additional performance', () => {
    expect(concerts['cnc-20081214']?.dateNote).toBe('Additional performance of the 2008-12-13 program')
  })

  it('carries the same conductor and orchestra on both nights', () => {
    for (const id of ['cnc-20081213', 'cnc-20081214']) {
      expect(concerts[id]?.conductor).toBe('cnd-nicholas-armstrong')
      expect(concerts[id]?.orchestra).toBe('orc-bso')
    }
  })

  /** Grand Street stops being an orphan — the graph now agrees with the space. */
  it('registers Grand Street as a real hall', () => {
    expect(graph.types.hall['hal-grand-street-campus-high-schools']).toBeDefined()
  })

  it('no longer reports row 912 as a duplicate header', () => {
    const dupes = graph.report['duplicate_concert_row'] ?? []
    expect(dupes.filter((line) => line.includes('row 912'))).toEqual([])
  })

  it('reports row 913 as a shared program instead', () => {
    const shared = graph.report['shared_program'] ?? []
    expect(shared.some((line) => line.includes('row 913'))).toBe(true)
  })
})

describe('the corrections change nothing else', () => {
  /**
   * The blast radius, pinned. `parse_archive.py` is the hot path for every concert
   * in the archive, so the risk of this change was never the three rows it targets
   * — it was the 1,484 it does not. One concert added, one hall un-orphaned, and
   * the program items untouched because the run shares rather than duplicates.
   */
  it('adds exactly one concert', () => {
    expect(Object.keys(concerts).length).toBe(250)
  })

  it('adds exactly one hall', () => {
    expect(Object.keys(graph.types.hall).length).toBe(13)
  })

  it('leaves the program item count untouched', () => {
    expect(Object.keys(graph.types.programItem).length).toBe(807)
  })

  /**
   * Nine runs in the graph against the eight the checklist header quotes, and the
   * difference is not drift: the checklist counts only IN-SCOPE runs (2001-05-24 →)
   * and the 1978-02-14 pair is pre-tenure. Eight of these nine are in scope now
   * that 2008-12 has joined them.
   */
  it('records nine shared-program runs', () => {
    expect(graph.report['shared_program']?.length).toBe(9)
  })
})
