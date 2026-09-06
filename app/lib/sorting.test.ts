import { describe, expect, it } from 'vitest'

import { DEFAULT_SORT, describeSort, readSort, sortConcerts, toConcertSort, writeSort } from './sorting'

/**
 * AWK-71's column sort, tested with no DOM in sight — the same arrangement as
 * facets.test.ts, and for the same reason: the route component takes loader
 * data and is untestable under Vitest, so the whole rule lives where it can be
 * asserted without rendering a grid.
 */
function concert(date: string, conductor: string | null, hall: string | null) {
  return { date, conductor, hall }
}

// Already in the sweep's order, date descending. Names chosen so that every
// sort key disagrees with date order: the newest concert has the alphabetically
// last conductor and the first hall.
const NEWEST = concert('2018-04-22', 'Tara Simoncic', 'Brooklyn Center')
const MIDDLE = concert('2012-03-15', 'Nicholas Armstrong', 'Walt Whitman Hall')
const OLDEST = concert('2007-12-16', 'Gary Fagin', 'Kumble Theater')
const CONCERTS = [NEWEST, MIDDLE, OLDEST]

describe('sortConcerts', () => {
  it('reproduces the sweep order under the default sort, so the hydrated table matches its markup', () => {
    // The load-bearing case. ADR-0004 prerenders /concerts/ once, in the order
    // the sweep produced (date descending, archive.ts). Before mount the route
    // sorts by DEFAULT_SORT, and if that were anything but an identity on the
    // sweep's order every visitor would see a reflow — or a React #418.
    expect(sortConcerts(CONCERTS, DEFAULT_SORT)).toEqual(CONCERTS)
  })

  it('sorts by date in both directions, lexically, without parsing', () => {
    const shuffled = [MIDDLE, OLDEST, NEWEST]

    expect(sortConcerts(shuffled, { column: 'date', direction: 'descending' })).toEqual([NEWEST, MIDDLE, OLDEST])
    expect(sortConcerts(shuffled, { column: 'date', direction: 'ascending' })).toEqual([OLDEST, MIDDLE, NEWEST])
  })

  it('sorts by conductor in both directions', () => {
    expect(sortConcerts(CONCERTS, { column: 'conductor', direction: 'ascending' })).toEqual([OLDEST, MIDDLE, NEWEST])
    expect(sortConcerts(CONCERTS, { column: 'conductor', direction: 'descending' })).toEqual([NEWEST, MIDDLE, OLDEST])
  })

  it('sorts by hall in both directions', () => {
    expect(sortConcerts(CONCERTS, { column: 'hall', direction: 'ascending' })).toEqual([NEWEST, OLDEST, MIDDLE])
    expect(sortConcerts(CONCERTS, { column: 'hall', direction: 'descending' })).toEqual([MIDDLE, OLDEST, NEWEST])
  })

  it('puts a null LAST in both directions, rather than first in one of them', () => {
    // `conductor` and `hall` are `string | null` and render as an em dash. A
    // naive comparator either throws (localeCompare on null) or lets the dash
    // lead the Z-to-A view, which reads as a sort that went wrong. Absence is
    // not a value, so it is not ordered among the values.
    const unattributed = concert('2010-01-01', null, null)
    const rows = [NEWEST, unattributed, MIDDLE]

    expect(sortConcerts(rows, { column: 'conductor', direction: 'ascending' })).toEqual([MIDDLE, NEWEST, unattributed])
    expect(sortConcerts(rows, { column: 'conductor', direction: 'descending' })).toEqual([NEWEST, MIDDLE, unattributed])
    expect(sortConcerts(rows, { column: 'hall', direction: 'ascending' })).toEqual([NEWEST, MIDDLE, unattributed])
    expect(sortConcerts(rows, { column: 'hall', direction: 'descending' })).toEqual([MIDDLE, NEWEST, unattributed])
  })

  it('keeps two nulls in the order they arrived', () => {
    const a = concert('2011-01-01', null, 'A')
    const b = concert('2009-01-01', null, 'B')

    expect(sortConcerts([a, b], { column: 'conductor', direction: 'ascending' })).toEqual([a, b])
    expect(sortConcerts([a, b], { column: 'conductor', direction: 'descending' })).toEqual([a, b])
  })

  it('is stable: equal values keep the order they were given, which is the sweep chronology', () => {
    // Nearly every concert shares its conductor with many others, so what
    // happens INSIDE a run of equal values is most of what the reader sees.
    // The input arrives date descending, so a conductor sort keeps each
    // conductor's concerts newest first — in both directions.
    const later = concert('2016-12-18', 'Nicholas Armstrong', 'Kumble Theater')
    const rows = [later, NEWEST, MIDDLE]

    expect(sortConcerts(rows, { column: 'conductor', direction: 'ascending' })).toEqual([later, MIDDLE, NEWEST])
    expect(sortConcerts(rows, { column: 'conductor', direction: 'descending' })).toEqual([NEWEST, later, MIDDLE])
  })

  it('returns a new array and leaves the input alone', () => {
    // The route hands over loader data; sorting it in place would reorder the
    // array the unfiltered, unsorted first render depends on.
    const input = [MIDDLE, OLDEST, NEWEST]
    const output = sortConcerts(input, DEFAULT_SORT)

    expect(output).not.toBe(input)
    expect(input).toEqual([MIDDLE, OLDEST, NEWEST])
  })
})

describe('readSort', () => {
  const read = (search: string) => readSort(new URLSearchParams(search))

  it('reads the default when the URL says nothing', () => {
    // The plain /concerts/ link IS the default view, and the default is the
    // prerendered order.
    expect(read('')).toEqual(DEFAULT_SORT)
    expect(read('?conductor=Tara+Simoncic')).toEqual(DEFAULT_SORT)
  })

  it('reads a column and a direction', () => {
    expect(read('?sort=conductor&dir=asc')).toEqual({ column: 'conductor', direction: 'ascending' })
    expect(read('?sort=hall&dir=desc')).toEqual({ column: 'hall', direction: 'descending' })
    expect(read('?sort=date&dir=asc')).toEqual({ column: 'date', direction: 'ascending' })
  })

  it('defaults the direction to ascending when only the column is given', () => {
    // Matches what a press does: a column that was not the sorted one starts
    // ascending. `?sort=date` alone is therefore oldest-first, a real view and
    // a different one from the default.
    expect(read('?sort=conductor')).toEqual({ column: 'conductor', direction: 'ascending' })
    expect(read('?sort=date')).toEqual({ column: 'date', direction: 'ascending' })
  })

  it('falls back to the default on a column that is not sortable', () => {
    // UNLIKE a facet, an unknown value is not honoured here. An unknown facet
    // value can match nothing and stay visible in the URL for the reader to
    // remove; a table cannot be in "no order", so the only honest reading of
    // `?sort=programme` (a display artifact, deliberately not sortable) or
    // `?sort=nonsense` is the order the page always has.
    expect(read('?sort=programme&dir=asc')).toEqual(DEFAULT_SORT)
    expect(read('?sort=orchestra')).toEqual(DEFAULT_SORT)
    expect(read('?sort=nonsense')).toEqual(DEFAULT_SORT)
    expect(read('?sort=')).toEqual(DEFAULT_SORT)
  })

  it('falls back to ascending on a direction it does not recognise', () => {
    expect(read('?sort=hall&dir=up')).toEqual({ column: 'hall', direction: 'ascending' })
    expect(read('?sort=hall&dir=')).toEqual({ column: 'hall', direction: 'ascending' })
    // The URL vocabulary is asc/desc, not React Aria's. The long form is not
    // a synonym.
    expect(read('?sort=hall&dir=descending')).toEqual({ column: 'hall', direction: 'ascending' })
  })

  it('ignores a direction with no column', () => {
    expect(read('?dir=asc')).toEqual(DEFAULT_SORT)
  })
})

describe('writeSort', () => {
  const write = (search: string, sort: Parameters<typeof writeSort>[1]) =>
    writeSort(new URLSearchParams(search), sort).toString()

  it('writes both keys for a non-default sort', () => {
    expect(write('', { column: 'conductor', direction: 'ascending' })).toBe('sort=conductor&dir=asc')
    expect(write('', { column: 'hall', direction: 'descending' })).toBe('sort=hall&dir=desc')
    expect(write('', { column: 'date', direction: 'ascending' })).toBe('sort=date&dir=asc')
  })

  it('writes NOTHING for the default, so the plain link stays canonical', () => {
    // `/concerts/` and `/concerts/?sort=date&dir=desc` are the same view; only
    // one of them should ever be produced.
    expect(write('', DEFAULT_SORT)).toBe('')
    expect(write('?sort=conductor&dir=asc', DEFAULT_SORT)).toBe('')
  })

  it('replaces a previous sort rather than appending to it', () => {
    expect(write('?sort=conductor&dir=asc', { column: 'hall', direction: 'descending' })).toBe('sort=hall&dir=desc')
  })

  it('leaves the facets alone — sorting composes with filtering', () => {
    expect(write('?conductor=Tara+Simoncic&hall=Kumble+Theater', { column: 'hall', direction: 'ascending' })).toBe(
      'conductor=Tara+Simoncic&hall=Kumble+Theater&sort=hall&dir=asc'
    )
    expect(write('?conductor=Tara+Simoncic&sort=hall&dir=asc', DEFAULT_SORT)).toBe('conductor=Tara+Simoncic')
  })

  it('does not mutate the params it was given', () => {
    const params = new URLSearchParams('?conductor=Tara+Simoncic')
    writeSort(params, { column: 'hall', direction: 'ascending' })

    expect(params.toString()).toBe('conductor=Tara+Simoncic')
  })
})

describe('toConcertSort', () => {
  it('narrows a React Aria descriptor for a sortable column', () => {
    expect(toConcertSort({ column: 'conductor', direction: 'descending' })).toEqual({
      column: 'conductor',
      direction: 'descending',
    })
  })

  it('refuses a column this table does not sort by', () => {
    // React Aria types the column as `Key`, and the grid only asks to sort a
    // column marked `allowsSorting` — but the type does not know that, so the
    // narrowing has to.
    expect(toConcertSort({ column: 'programme', direction: 'ascending' })).toBeNull()
    expect(toConcertSort({ column: 3, direction: 'ascending' })).toBeNull()
  })
})

describe('describeSort', () => {
  it('says nothing for the default, which is the order the page always had', () => {
    // The status line is a live region. Text here would be announced on every
    // load one tick after hydration, and would sit permanently on a page whose
    // design is quiet. Clearing the filters already goes silent the same way.
    expect(describeSort(DEFAULT_SORT)).toBe('')
  })

  it('reads a date sort as a chronology, not as A to Z', () => {
    expect(describeSort({ column: 'date', direction: 'ascending' })).toBe('Sorted by date, oldest first')
  })

  it('reads a text sort alphabetically', () => {
    expect(describeSort({ column: 'conductor', direction: 'ascending' })).toBe('Sorted by conductor, A to Z')
    expect(describeSort({ column: 'hall', direction: 'descending' })).toBe('Sorted by hall, Z to A')
  })
})
