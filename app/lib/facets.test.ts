import { describe, expect, it } from 'vitest'

import { filterConcerts, readFacet, unknownValues } from './facets'

/**
 * AWK-55's filter, tested with no DOM in sight.
 *
 * This is a module rather than a handful of lines in the route precisely so
 * these rules are assertable without rendering a table: with `ssr: false` the
 * route's loader data arrives at build time and Vitest runs without the
 * `reactRouter()` plugin, so a route component taking loader data is not
 * testable here at all. The combining rule is the whole behaviour, and it lives
 * where it can be asserted.
 */
function concert(conductor: string | null, hall: string | null) {
  return { conductor, hall }
}

const SIMONCIC_AT_BROOKLYN = concert('Tara Simoncic', 'Brooklyn Center')
const SIMONCIC_AT_KUMBLE = concert('Tara Simoncic', 'Kumble Theater')
const ARMSTRONG_AT_BROOKLYN = concert('Nicholas Armstrong', 'Brooklyn Center')
const CONCERTS = [SIMONCIC_AT_BROOKLYN, SIMONCIC_AT_KUMBLE, ARMSTRONG_AT_BROOKLYN]

describe('filterConcerts', () => {
  it('returns everything when nothing is selected', () => {
    // The unfiltered table is the default view, not a special case.
    expect(filterConcerts(CONCERTS, { conductors: [], halls: [] })).toEqual(CONCERTS)
  })

  it('narrows to one value within a facet', () => {
    expect(filterConcerts(CONCERTS, { conductors: ['Nicholas Armstrong'], halls: [] })).toEqual([ARMSTRONG_AT_BROOKLYN])
  })

  it('WIDENS on a second value in the same facet, rather than emptying', () => {
    // Decision 1: OR within a facet. AND-within is degenerate on this data —
    // a Concert has exactly one Conductor — so the intersection of two
    // conductors is always empty, which is the failure this asserts against.
    const both = filterConcerts(CONCERTS, {
      conductors: ['Tara Simoncic', 'Nicholas Armstrong'],
      halls: [],
    })

    expect(both).toEqual(CONCERTS)
  })

  it('narrows across facets — conductor AND hall', () => {
    expect(
      filterConcerts(CONCERTS, {
        conductors: ['Tara Simoncic'],
        halls: ['Brooklyn Center'],
      })
    ).toEqual([SIMONCIC_AT_BROOKLYN])
  })

  it('combines OR within each facet and AND across them', () => {
    // Two conductors and one hall: both conductors qualify, the hall then cuts
    // the pair down. This is the one case the two rules could disagree on.
    expect(
      filterConcerts(CONCERTS, {
        conductors: ['Tara Simoncic', 'Nicholas Armstrong'],
        halls: ['Kumble Theater'],
      })
    ).toEqual([SIMONCIC_AT_KUMBLE])
  })

  it('honours an unknown value by matching nothing', () => {
    // Decision 5. Dropping an unrecognised value would reinstate exactly the
    // failure AWK-55 reports: a filter in the URL that is silently ignored.
    expect(filterConcerts(CONCERTS, { conductors: ['Nobody'], halls: [] })).toEqual([])
  })

  it('leaves an unknown value ORed with a real one, not intersected', () => {
    expect(filterConcerts(CONCERTS, { conductors: ['Nobody', 'Tara Simoncic'], halls: [] })).toEqual([
      SIMONCIC_AT_BROOKLYN,
      SIMONCIC_AT_KUMBLE,
    ])
  })

  it('matches exactly and case-sensitively', () => {
    // Decision 5 again. The query string carries the display name verbatim, so
    // there is no folding step here — unlike app/lib/search.ts, which folds
    // because a searcher types from memory. A facet value is clicked, not typed.
    expect(filterConcerts(CONCERTS, { conductors: ['tara simoncic'], halls: [] })).toEqual([])
    expect(filterConcerts(CONCERTS, { conductors: ['Tara Simoncic '], halls: [] })).toEqual([])
  })

  it('never matches a Concert whose field is null', () => {
    // `hall` and `conductor` are both nullable on Concert. A null is absence,
    // and absence is not a value anyone can select — so it drops out of a
    // filtered view rather than matching everything.
    const unattributed = concert(null, null)

    expect(filterConcerts([...CONCERTS, unattributed], { conductors: ['Tara Simoncic'], halls: [] })).not.toContain(
      unattributed
    )
    expect(filterConcerts([...CONCERTS, unattributed], { conductors: [], halls: ['Brooklyn Center'] })).not.toContain(
      unattributed
    )
  })

  it('keeps a Concert with a null field while that facet is unselected', () => {
    // The other half of the rule above: a null conductor must not hide the
    // Concert from a HALL filter. Only the facet that is selected can exclude.
    const noConductor = concert(null, 'Brooklyn Center')

    expect(filterConcerts([noConductor], { conductors: [], halls: ['Brooklyn Center'] })).toEqual([noConductor])
  })

  it('preserves the order it was given', () => {
    // The loader hands over concerts already ordered, and the table's
    // chronological spine is not this module's to re-sort.
    expect(filterConcerts([...CONCERTS].reverse(), { conductors: ['Tara Simoncic'], halls: [] })).toEqual([
      SIMONCIC_AT_KUMBLE,
      SIMONCIC_AT_BROOKLYN,
    ])
  })
})

describe('unknownValues', () => {
  it('finds the selected values no option can represent', () => {
    expect(unknownValues(['Tara Simoncic', 'Nobody'], ['Tara Simoncic', 'Nicholas Armstrong'])).toEqual(['Nobody'])
  })

  it('finds nothing when every selected value is a real option', () => {
    expect(unknownValues(['Tara Simoncic'], ['Tara Simoncic', 'Nicholas Armstrong'])).toEqual([])
  })

  it('finds nothing when nothing is selected', () => {
    expect(unknownValues([], ['Tara Simoncic'])).toEqual([])
  })

  it('treats every value as unknown when there are no options at all', () => {
    expect(unknownValues(['Tara Simoncic'], [])).toEqual(['Tara Simoncic'])
  })
})

describe('readFacet', () => {
  const read = (search: string, key = 'conductor') => readFacet(new URLSearchParams(search), key)

  it('reads repeated keys as one facet', () => {
    expect(read('?conductor=Tara+Simoncic&conductor=Nicholas+Armstrong')).toEqual([
      'Tara Simoncic',
      'Nicholas Armstrong',
    ])
  })

  it('decodes what the URL encoded, and does not split on a comma', () => {
    // The value IS the display name, so a name carrying a comma has to survive
    // intact. This is the reason the encoding is repeated keys rather than a
    // delimited list.
    expect(read('?conductor=Smith%2C+Jr.')).toEqual(['Smith, Jr.'])
  })

  it('reads only its own facet', () => {
    expect(read('?conductor=Tara+Simoncic&hall=Kumble+Theater')).toEqual(['Tara Simoncic'])
    expect(read('?conductor=Tara+Simoncic&hall=Kumble+Theater', 'hall')).toEqual(['Kumble Theater'])
  })

  it('reads nothing when the facet is absent', () => {
    expect(read('?hall=Kumble+Theater')).toEqual([])
    expect(read('')).toEqual([])
  })

  it('drops a duplicate, which would otherwise be a repeated collection key', () => {
    expect(read('?conductor=Tara+Simoncic&conductor=Tara+Simoncic')).toEqual(['Tara Simoncic'])
  })

  it('DROPS an empty value rather than filtering on the unnameable', () => {
    // `?conductor=` matched no Concert, so the table went to its empty state
    // while the only thing on screen to undo it was a tag rendering as a bare
    // ×, labelled "Remove ". Visible effect, invisible cause — the exact
    // failure the unknown-value rule exists to prevent.
    expect(read('?conductor=')).toEqual([])
    expect(read('?conductor=&conductor=Tara+Simoncic')).toEqual(['Tara Simoncic'])
  })

  it('keeps a value that is merely unknown, which is a different thing', () => {
    // Empty is dropped; unrecognised is honoured. An unknown value names
    // something, so the reader can read it, see it match nothing, and remove it.
    expect(read('?conductor=Nobody')).toEqual(['Nobody'])
  })
})
