/**
 * AWK-55's browse filter for the Performance history: the rule that turns a
 * query string into a subset of the Concert table.
 *
 * IT RUNS IN THE BROWSER, AND IT HAS TO. With `ssr: false` and prerendering
 * (ADR-0009) a loader runs at BUILD time and its output is baked into a per-path
 * `.data` file, so a query string cannot vary it — every visitor to `/concerts/`
 * receives byte-identical loader data whatever follows the `?`. Moving this into
 * the loader does not fail loudly; it silently ignores the filter, which is the
 * bug AWK-55 was filed about in the first place. The array is the whole attended
 * Performance history — a few hundred rows at the outside — so doing it on the
 * client costs nothing worth measuring.
 *
 * Pure and DOM-free on purpose, for the same reason app/lib/search.ts is: route
 * components taking loader data are untestable in this repo (Vitest runs without
 * the `reactRouter()` plugin), so the whole behaviour lives where it can be
 * asserted without rendering a table.
 *
 * ADR-0006 fixes the facet set at exactly TWO. Conductor and Hall are browse
 * filters; Soloist and Ensemble are credits that display but never filter, and
 * Season is not a surface at all. Do not grow a third here — ADR-0012 declined a
 * "has a recording" filter on the grounds that discoverability is search's job,
 * and AWK-41 draws the boundary as: facets narrow a known list, search finds a
 * named thing.
 */
import type { Concert } from './archive'

/**
 * The two facets, as they arrive from the query string. Each holds display
 * names verbatim — `?conductor=Tara%20Simoncic` — because `Conductor` carries no
 * `slug` field at all and `Hall`'s slug is not plumbed into the `Concert` shape
 * the page receives. AWK-39 left `conductor.slug` unwritten deliberately.
 */
export type FacetSelection = {
  conductors: readonly string[]
  halls: readonly string[]
}

/**
 * Only the two fields the match reads, so a test can build a row without
 * standing up a whole Concert — and so this cannot quietly start depending on
 * the rest of the shape.
 */
type Faceted = Pick<Concert, 'conductor' | 'hall'>

/**
 * OR within a facet, AND across facets.
 *
 * The OR is the load-bearing half: AND-within is degenerate on this data,
 * because a Concert has exactly one Conductor and one Hall, so intersecting two
 * conductors would always yield nothing. Clicking a second conductor widens.
 */
export function filterConcerts<T extends Faceted>(concerts: readonly T[], selection: FacetSelection): T[] {
  return concerts.filter(
    (concert) => matches(concert.conductor, selection.conductors) && matches(concert.hall, selection.halls)
  )
}

/**
 * An unselected facet constrains nothing; a null field is absence and can never
 * be selected, so it drops out of any view that filters on its facet.
 *
 * Exact and case-sensitive, unlike app/lib/search.ts's folded matching. A facet
 * value is chosen from a list rather than typed from memory, so there is nothing
 * for a fold to forgive — and an unrecognised value is meant to match nothing
 * (decision 5) rather than be coerced into matching something.
 */
function matches(value: string | null, selected: readonly string[]): boolean {
  if (selected.length === 0) return true
  if (value === null) return false

  return selected.includes(value)
}

/**
 * The selected values that no option in the control can represent — `?conductor=Nobody`,
 * or a name that has since left the archive.
 *
 * They are kept rather than dropped: the value stays in the URL, matches nothing,
 * and is removed by the reader rather than by the code. Dropping one on an
 * unrelated interaction would be precisely the silent-ignore failure AWK-55
 * reports, arriving by a different route.
 *
 * This is a GUARD, not a repair. React Aria's multi-select ComboBox happens to
 * keep keys it has no item for and hand them back, but that is undocumented, so
 * the control unions its own unknowns in rather than trusting it — see
 * app/components/facet-select.tsx, where relying on it the other way round
 * duplicated every unknown value on every click.
 */
export function unknownValues(selected: readonly string[], known: readonly string[]): string[] {
  return selected.filter((value) => !known.includes(value))
}

/**
 * One facet's values, as the URL gives them.
 *
 * Repeated keys, not a delimited list: `?conductor=A&conductor=B`. It is what
 * URLSearchParams does natively, and a display name containing a comma can never
 * be ambiguous — which matters when the value IS the display name.
 *
 * Two things are dropped on the way in, and both are only reachable by typing a
 * URL by hand. A DUPLICATE changes no result, because matching is a membership
 * test, but the values are handed to React Aria as collection keys and two
 * identical keys are a different kind of problem. An EMPTY value is worse: it
 * matches no Concert, so it filters the table down to the empty state, while
 * rendering as a tag with no text at all — a filter the reader can see the
 * effects of, cannot read, and can only clear by guessing at a bare ×. That is
 * the very failure the unknown-value rule exists to prevent, so `?conductor=`
 * means no conductor filter rather than an unnameable one.
 */
export function readFacet(params: URLSearchParams, key: string): string[] {
  return [...new Set(params.getAll(key).filter((value) => value !== ''))]
}
