/**
 * AWK-71's column sort for the Performance history: the rule that turns
 * `?sort=conductor&dir=asc` into an order for the Concert table.
 *
 * A SIBLING of app/lib/facets.ts rather than an addition to it. Sorting reuses
 * every part of the facets' architecture — the query string is the state, the
 * rule is pure and DOM-free, the route composes the two — but a sort is not a
 * facet, and that file's header forbids growing the facet set for reasons
 * (ADR-0006, ADR-0012) that have nothing to do with ordering.
 *
 * IT RUNS IN THE BROWSER, AND IT HAS TO, for exactly the reason filtering does:
 * with `ssr: false` and prerendering (ADR-0009) the loader runs once at build
 * time, so a query string cannot vary its output. And it runs BEHIND THE
 * HYDRATION GATE in app/routes/concerts.tsx — before mount the route sorts by
 * DEFAULT_SORT, which is the order the sweep already produced, so the first
 * client render matches the prerendered markup. That is why the default is not
 * a free choice: change it and every visitor sees a reflow, or React 19 logs
 * #418 and discards the server HTML.
 *
 * Pure and DOM-free on purpose, like facets.ts and search.ts: route components
 * taking loader data are untestable in this repo (Vitest runs without the
 * `reactRouter()` plugin), so the whole behaviour lives where it can be
 * asserted without rendering a grid.
 */
import type { SortDescriptor, SortDirection } from 'react-aria-components'

import type { Concert } from './archive'

/**
 * The columns that sort, and the only place the set is stated. Date, Conductor
 * and Hall earn it. Programme does not: the cell is a truncated join of the
 * first two item labels, so sorting by it would sort by a display artifact.
 * Orchestra reads BSO on all but a handful of rows — sortable in principle,
 * inert in practice, so it is left out rather than offered as a control that
 * does nothing visible.
 */
export const SORT_COLUMNS = ['date', 'conductor', 'hall'] as const

export type SortColumn = (typeof SORT_COLUMNS)[number]

/**
 * Structurally the same shape as React Aria's `SortDescriptor`, with `column`
 * narrowed from `Key` to the three this table sorts by, so the route can hand
 * it straight to `<Table sortDescriptor>` and everything downstream of the
 * URL is typed.
 */
export type ConcertSort = {
  column: SortColumn
  direction: SortDirection
}

/**
 * Date descending — the sweep's order (app/lib/archive.ts, the `attended`
 * sort), and therefore the prerendered order. See the header for why this is
 * fixed rather than chosen.
 */
export const DEFAULT_SORT: ConcertSort = { column: 'date', direction: 'descending' }

function isDefaultSort(sort: ConcertSort): boolean {
  return sort.column === DEFAULT_SORT.column && sort.direction === DEFAULT_SORT.direction
}

/** Only the fields a comparison reads, so a test can build a row without a whole Concert. */
type Sortable = Pick<Concert, 'date' | 'conductor' | 'hall'>

/**
 * A new array in the requested order. Stable, so equal values keep the order
 * they arrived in — and since the input arrives date descending, a conductor's
 * concerts stay newest-first inside a conductor sort in both directions. The
 * input is not touched: it is the loader's array, and the ungated first render
 * depends on it.
 */
export function sortConcerts<T extends Sortable>(concerts: readonly T[], sort: ConcertSort): T[] {
  const sign = sort.direction === 'ascending' ? 1 : -1

  return [...concerts].sort((a, b) => {
    if (sort.column === 'date') return sign * compareDates(a.date, b.date)

    return compareNullable(a[sort.column], b[sort.column], sign)
  })
}

/** ISO `YYYY-MM-DD` orders lexically, so no parsing and no locale. */
function compareDates(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

/**
 * A null lands LAST in both directions. It is absence, not a value — the cell
 * renders an em dash — so it is not ordered among the values, and `sign` is
 * applied only to the comparison of two real strings. `localeCompare` on a
 * null would throw, which is the other reason this exists.
 */
function compareNullable(a: string | null, b: string | null, sign: 1 | -1): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1

  return sign * a.localeCompare(b)
}

/**
 * The URL vocabulary is `asc` / `desc`; React Aria's is `ascending` /
 * `descending`. The translation happens here and nowhere else.
 */
const DIRECTION_VALUE = { ascending: 'asc', descending: 'desc' } as const

/** The two query-string keys. */
const SORT_KEY = 'sort'
const DIRECTION_KEY = 'dir'

export function isSortColumn(value: unknown): value is SortColumn {
  return typeof value === 'string' && (SORT_COLUMNS as readonly string[]).includes(value)
}

/**
 * The sort, as the URL gives it.
 *
 * UNLIKE readFacet, an unknown value is NOT honoured. An unknown facet value
 * can match nothing and sit in the URL for the reader to remove; a table cannot
 * be in no order at all, so `?sort=programme` or `?sort=nonsense` reads as the
 * default. A missing or unrecognised direction reads as ascending, which is
 * also what a press on a column that was not the sorted one does.
 */
export function readSort(params: URLSearchParams): ConcertSort {
  const column = params.get(SORT_KEY)
  if (!isSortColumn(column)) return DEFAULT_SORT

  const direction = params.get(DIRECTION_KEY) === DIRECTION_VALUE.descending ? 'descending' : 'ascending'
  return { column, direction }
}

/**
 * A copy of `params` carrying `sort`, or carrying neither key when the sort is
 * the default — so `/concerts/` stays the one canonical address for the view
 * every visitor is prerendered. Every other key (the facets) passes through
 * untouched; that is how sorting composes with filtering in the URL.
 */
export function writeSort(params: URLSearchParams, sort: ConcertSort): URLSearchParams {
  const next = new URLSearchParams(params)
  next.delete(SORT_KEY)
  next.delete(DIRECTION_KEY)

  if (!isDefaultSort(sort)) {
    next.set(SORT_KEY, sort.column)
    next.set(DIRECTION_KEY, DIRECTION_VALUE[sort.direction])
  }

  return next
}

/**
 * React Aria types `column` as `Key` because a grid may sort by any column.
 * This one marks three with `allowsSorting`, so the descriptor it hands back is
 * always one of them — but the type cannot know that, so the narrowing has to
 * happen somewhere, and `null` for anything else is more honest than a cast.
 */
export function toConcertSort(descriptor: SortDescriptor): ConcertSort | null {
  return isSortColumn(descriptor.column) ? { column: descriptor.column, direction: descriptor.direction } : null
}

/**
 * The words the `facet-status` live region speaks when the sort changes. Empty
 * for the default: the region announces CHANGES, and text that appeared one
 * tick after hydration on every load would announce the page's ordinary state
 * to every screen-reader visitor. Returning to the default is therefore silent,
 * exactly as clearing the filters already is.
 *
 * A date sort is a chronology and is described as one; the two text columns
 * read alphabetically.
 */
export function describeSort(sort: ConcertSort): string {
  if (isDefaultSort(sort)) return ''

  const order =
    sort.column === 'date'
      ? sort.direction === 'ascending'
        ? 'oldest first'
        : 'newest first'
      : sort.direction === 'ascending'
        ? 'A to Z'
        : 'Z to A'

  return `Sorted by ${sort.column}, ${order}`
}
