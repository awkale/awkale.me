import { describe, expect, it } from 'vitest'

import {
  CONCERT_COLUMNS,
  columnsKey,
  describeColumns,
  hideableColumns,
  readColumns,
  visibleColumns,
  WORK_COLUMNS,
  writeColumns,
} from './columns'

/**
 * AWK-67's column set, tested with no DOM in sight — the same bargain
 * facets.test.ts and sorting.test.ts strike, and for the same reason: with
 * `ssr: false` the route's loader data arrives at build time and Vitest runs
 * without the `reactRouter()` plugin, so a route component taking loader data is
 * not testable here at all. The rules live where they can be asserted.
 *
 * The two things most worth locking down are the ones a reader can reach by hand:
 * a malformed `?columns=` must not empty a table, and no value of it may hide the
 * column carrying the row's link.
 */
const params = (query: string) => new URLSearchParams(query)

describe('readColumns', () => {
  it('reads nothing as no override, so the viewport default applies', () => {
    expect(readColumns(params(''), CONCERT_COLUMNS)).toBeNull()
  })

  it('reads a comma-delimited set', () => {
    expect(readColumns(params('columns=date,hall'), CONCERT_COLUMNS)).toEqual(['date', 'hall'])
  })

  it('orders by the column order, not by the URL', () => {
    // Which columns exist and in what order was settled by AWK-70 and AWK-71.
    // This key says WHICH are on screen; it does not rearrange them.
    expect(readColumns(params('columns=hall,conductor,date'), CONCERT_COLUMNS)).toEqual(['date', 'conductor', 'hall'])
  })

  it('drops an unknown id rather than honouring it', () => {
    // Sorting's rule, not facets'. An unknown facet value is a legible statement
    // that matches nothing; an unknown column is simply not a column.
    expect(readColumns(params('columns=date,soloist,hall'), CONCERT_COLUMNS)).toEqual(['date', 'hall'])
  })

  it('falls back to no override when NOTHING recognisable survives, rather than emptying the table', () => {
    // The failure this exists to prevent: a hand-typed `?columns=nonsense`
    // rendering a table with no columns in it at all.
    expect(readColumns(params('columns=nonsense'), CONCERT_COLUMNS)).toBeNull()
    expect(readColumns(params('columns='), CONCERT_COLUMNS)).toBeNull()
    expect(readColumns(params('columns=,,,'), CONCERT_COLUMNS)).toBeNull()
  })

  it('unions the row header back in, so the query string cannot de-link the section', () => {
    // `/concerts/` is the only page linking the concert pages, and the link lives
    // in the Date cell because React Aria's Row href is not adopted.
    expect(readColumns(params('columns=hall'), CONCERT_COLUMNS)).toEqual(['date', 'hall'])
    expect(readColumns(params('columns=forms'), WORK_COLUMNS)).toEqual(['work', 'forms'])
  })

  it('tolerates whitespace around an id, rather than dropping the column', () => {
    // Hand-editing this key is a supported path — it is why the row header is
    // unioned back in — and `date, programme` is what a URL looks like after a
    // chat client has wrapped it and a reader has retyped it. Untrimmed, that one
    // space drops a column and says nothing about why.
    expect(readColumns(params('columns=date,%20programme'), CONCERT_COLUMNS)).toEqual(['date', 'programme'])
    expect(readColumns(params('columns=%20hall%20'), CONCERT_COLUMNS)).toEqual(['date', 'hall'])
  })

  it('ignores a repeated id rather than showing the column twice', () => {
    expect(readColumns(params('columns=hall,hall,date'), CONCERT_COLUMNS)).toEqual(['date', 'hall'])
  })

  it('reads the works table by its own ids', () => {
    expect(readColumns(params('columns=work,period'), WORK_COLUMNS)).toEqual(['work', 'period'])
    // A concerts id means nothing here, so it drops and leaves no override.
    expect(readColumns(params('columns=conductor'), WORK_COLUMNS)).toBeNull()
  })
})

describe('visibleColumns', () => {
  it('shows every column at 40rem and above when the reader has said nothing', () => {
    expect(visibleColumns(CONCERT_COLUMNS, null, false)).toEqual([
      'date',
      'programme',
      'orchestra',
      'conductor',
      'hall',
    ])
  })

  it('shows the narrow default below 40rem when the reader has said nothing', () => {
    // The triage decisions: the date is the link and the spine, the programme is
    // the only thing on the row saying what was played.
    expect(visibleColumns(CONCERT_COLUMNS, null, true)).toEqual(['date', 'programme'])
    // Period is identical on nearly every row of a page, Forms empty on 104 works.
    expect(visibleColumns(WORK_COLUMNS, null, true)).toEqual(['work', 'performances'])
  })

  it('keeps an override at EVERY width, including a narrow one', () => {
    // The whole point of the control. A narrow viewport re-hiding a column the
    // reader just added back would make the control unusable on the one device
    // that needs it; the container's horizontal scroll is the backstop instead.
    const chosen = ['date', 'programme', 'conductor'] as const

    expect(visibleColumns(CONCERT_COLUMNS, chosen, true)).toEqual(chosen)
    expect(visibleColumns(CONCERT_COLUMNS, chosen, false)).toEqual(chosen)
  })
})

describe('writeColumns', () => {
  it('writes the set as one comma-delimited key', () => {
    const next = writeColumns(params(''), CONCERT_COLUMNS, ['date', 'programme', 'hall'], false)

    expect(next.get('columns')).toBe('date,programme,hall')
  })

  it('writes NOTHING when the chosen set is already this viewport default', () => {
    // Same rule as writeSort dropping its two keys on the default: `/concerts/`
    // stays the one canonical address for the view everyone is prerendered.
    const wide = writeColumns(params(''), CONCERT_COLUMNS, [...CONCERT_COLUMNS.all], false)
    expect(wide.has('columns')).toBe(false)

    const narrow = writeColumns(params(''), CONCERT_COLUMNS, ['date', 'programme'], true)
    expect(narrow.has('columns')).toBe(false)
  })

  it('writes the SAME pair on a wide viewport, where it is a statement rather than the default', () => {
    const next = writeColumns(params(''), CONCERT_COLUMNS, ['date', 'programme'], false)

    expect(next.get('columns')).toBe('date,programme')
  })

  it('clears an existing key when the reader returns to the default', () => {
    const next = writeColumns(params('columns=date,hall'), CONCERT_COLUMNS, [...CONCERT_COLUMNS.all], false)

    expect(next.has('columns')).toBe(false)
  })

  it('leaves the facets and the sort untouched, which is how the keys compose', () => {
    const next = writeColumns(params('conductor=Tara+Simoncic&sort=hall&dir=asc'), CONCERT_COLUMNS, ['date'], false)

    expect(next.get('conductor')).toBe('Tara Simoncic')
    expect(next.get('sort')).toBe('hall')
    expect(next.get('dir')).toBe('asc')
  })

  it('writes the row header even when it was not chosen', () => {
    const next = writeColumns(params(''), CONCERT_COLUMNS, ['hall'], false)

    expect(next.get('columns')).toBe('date,hall')
  })

  it('round-trips through readColumns', () => {
    // The acceptance criterion: a link carrying the set reproduces the set.
    const chosen = ['date', 'orchestra', 'hall'] as const
    const written = writeColumns(params(''), CONCERT_COLUMNS, chosen, false)

    expect(readColumns(written, CONCERT_COLUMNS)).toEqual(chosen)
  })
})

describe('hideableColumns', () => {
  it('offers every column but the one carrying the row link', () => {
    expect(hideableColumns(CONCERT_COLUMNS)).toEqual(['programme', 'orchestra', 'conductor', 'hall'])
    expect(hideableColumns(WORK_COLUMNS)).toEqual(['period', 'forms', 'performances'])
  })
})

describe('columnsKey', () => {
  it('is a value rather than the array, so React Aria can compare it', () => {
    // `dependencies` is compared element-wise like a hook's dependency list, so a
    // freshly filtered array would invalidate the cell cache on every render.
    expect(columnsKey(['date', 'hall'])).toBe(columnsKey(['date', 'hall']))
    expect(columnsKey(['date', 'hall'])).not.toBe(columnsKey(['date']))
  })
})

describe('describeColumns', () => {
  it('says nothing when every column is on screen', () => {
    expect(describeColumns(CONCERT_COLUMNS, CONCERT_COLUMNS.all)).toBe('')
  })

  it('counts the hidden ones, singular and plural', () => {
    expect(describeColumns(CONCERT_COLUMNS, ['date', 'programme', 'orchestra', 'conductor'])).toBe('1 column hidden')
    expect(describeColumns(CONCERT_COLUMNS, ['date', 'programme'])).toBe('3 columns hidden')
  })
})

describe('the column sets themselves', () => {
  /*
    `writeColumns` decides whether to write the key by comparing the chosen set
    against the viewport default POSITIONALLY — both are `all`-ordered subsets, so
    equality is length plus position (see `sameSet`). That holds only while `narrow`
    is written in `all` order, which nothing but this test enforces: a `narrow` of
    `['programme', 'date']` would compare unequal to the identical chosen set, and
    the URL would carry `?columns=date,programme` on a phone forever — a key saying
    exactly what the default already says.

    And `narrow` must contain the row header, or the narrow default would drop the
    only link on the row. `readColumns` unions it back in and the control never
    offers it, so this is the one path that could still lose it.
  */
  for (const [name, set] of [
    ['CONCERT_COLUMNS', CONCERT_COLUMNS],
    ['WORK_COLUMNS', WORK_COLUMNS],
  ] as const) {
    it(`${name}'s narrow default is a subset of its columns, in the same order`, () => {
      expect(set.narrow).toEqual(set.all.filter((id) => (set.narrow as readonly string[]).includes(id)))
    })

    it(`${name}'s narrow default carries the row header`, () => {
      expect(set.narrow).toContain(set.rowHeader)
    })

    it(`${name}'s row header is one of its columns`, () => {
      expect(set.all).toContain(set.rowHeader)
    })
  }
})
