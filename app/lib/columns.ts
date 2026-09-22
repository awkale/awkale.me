/**
 * AWK-67's column set for the two archive tables: the rule that decides which
 * columns a table shows, so that neither the document nor a container has to
 * scroll sideways to read a row.
 *
 * A THIRD SIBLING of app/lib/facets.ts and app/lib/sorting.ts, and it earns the
 * shape for the same three reasons they do: the query string is the state, the
 * rule is pure and DOM-free, and the route composes it. A column set is not a
 * facet and not a sort — it narrows nothing and orders nothing — but it is the
 * same kind of thing: a reader's statement about the view, carried in the URL so
 * the view stays linkable.
 *
 * WHAT IT IS FOR. At 375px the Performance history's five columns are a 698px
 * grid inside a 312px container, so the reader scrolls sideways INSIDE the table
 * and loses the column they were reading; and 30 of the 159 composer pages push
 * the whole document sideways, worst at 51px on Mahler. The cause there is header
 * min-content rather than data — `Performances` is a single unbreakable token no
 * cell value drives. Fewer columns is the fix in both cases, and which columns is
 * the reader's to say.
 *
 * IT RUNS IN THE BROWSER, AND IT HAS TO, exactly as filtering and sorting do:
 * with `ssr: false` and prerendering (ADR-0009) the loader runs once at BUILD
 * time, so a query string cannot vary its output. And it runs BEHIND THE SAME
 * HYDRATION GATE — see `visibleColumns`, and the note on `NARROW` about why the
 * viewport cannot be read during the first client render either.
 *
 * Pure and DOM-free on purpose, like its two siblings: route components taking
 * loader data are untestable in this repo (Vitest runs without the
 * `reactRouter()` plugin), so the whole behaviour lives where it can be asserted
 * without rendering a grid.
 */

/**
 * The media query the narrow default answers to, and the one place JavaScript
 * states it.
 *
 * IT IS DUPLICATED IN CSS, unavoidably: archive-table.css hands horizontal
 * scrolling to the container at this same 40rem, and there is no way to share a
 * number between a stylesheet and a module without shipping one to read the
 * other. The two are load-bearing together — the CSS backstop is what a reader
 * with no JavaScript gets, and this is what everyone else gets — so changing one
 * means changing both. Both sites carry a comment saying so.
 */
export const NARROW = '(width < 40rem)'

/** The one query-string key. Both tables use it; they never share a page. */
const COLUMNS_KEY = 'columns'

/**
 * One table's columns, as policy rather than presentation.
 *
 * `all` IS THE COLUMN ORDER, and the only place it is stated — the component
 * derives its ordered array from this rather than restating it, so a column
 * cannot exist in one and not the other. Labels, widths and cell renderers stay
 * in the component, keyed by id and exhaustive by type.
 */
export type ColumnSet<Id extends string> = {
  /** Every column, in the order they are read. */
  all: readonly Id[]
  /** What a viewport narrower than NARROW shows when the reader has said nothing. */
  narrow: readonly Id[]
  /**
   * The column carrying the row's link, which can NEVER be hidden.
   *
   * React Aria's `Row` `href` is deliberately not adopted (see
   * archive-table.tsx), so the link lives in this cell and nowhere else. Hiding
   * it would de-link every page below this one — the concerts index is the only
   * page linking the 133 concert pages, and a composer page the only one linking
   * its works. The control does not offer it, and `readColumns` unions it back
   * in, so hand-editing the query string cannot do it either.
   */
  rowHeader: Id
}

export type ConcertColumnId = 'date' | 'programme' | 'orchestra' | 'conductor' | 'hall'

/**
 * Date · Programme · Orchestra · Conductor · Hall (AWK-70, and AWK-71 put the
 * sort on the same seam). Which columns exist and in what order is settled; this
 * ticket only decides which of them are on screen.
 *
 * NARROW IS DATE + PROGRAMME. Decided in triage: the date is the link and the
 * chronological spine, and the programme is the only thing on the row that says
 * what was played. Orchestra reads BSO on 120 of 133 rows, and Conductor and
 * Hall are both reachable as facets.
 */
export const CONCERT_COLUMNS: ColumnSet<ConcertColumnId> = {
  all: ['date', 'programme', 'orchestra', 'conductor', 'hall'],
  narrow: ['date', 'programme'],
  rowHeader: 'date',
}

export type WorkColumnId = 'work' | 'period' | 'forms' | 'performances'

/**
 * NARROW IS WORK + PERFORMANCES. Decided in triage, and the data is the argument:
 * Period inherits from the composer (AWK-37, ADR-0007) and is therefore identical
 * on nearly every row of a page, and Forms is empty on 104 of the works.
 */
export const WORK_COLUMNS: ColumnSet<WorkColumnId> = {
  all: ['work', 'period', 'forms', 'performances'],
  narrow: ['work', 'performances'],
  rowHeader: 'work',
}

/** The columns the reader may turn off — everything but the row header. */
export function hideableColumns<Id extends string>(set: ColumnSet<Id>): Id[] {
  return set.all.filter((id) => id !== set.rowHeader)
}

/**
 * The set the reader asked for, or `null` when they asked for nothing.
 *
 * Comma-delimited — `?columns=date,programme` — where readFacet takes repeated
 * keys. The difference is what the values ARE: a facet value is a display name
 * that may itself contain a comma, so it cannot be delimited; a column id is a
 * controlled slug from `all`, so it can, and a five-column set in one short key
 * beats five repetitions of it.
 *
 * UNKNOWN IDS ARE DROPPED RATHER THAN HONOURED, which is sorting's rule and not
 * facets'. An unknown facet value is a legible statement that matches nothing and
 * sits in the URL for the reader to remove; an unknown column is not a column, so
 * there is nothing for it to do. And if nothing recognisable survives — `?columns=`,
 * `?columns=nonsense` — this returns `null` rather than an empty table: a malformed
 * value reads as NO OVERRIDE, and the viewport default applies, which is the same
 * answer as never having said anything.
 *
 * The row header is unioned back in unconditionally. `?columns=hall` is a request
 * for Hall, not a request to de-link the section.
 *
 * Order comes from `all`, never from the URL: `?columns=hall,date` shows Date then
 * Hall. Column order was settled by AWK-70 and AWK-71 and is not the reader's to
 * rearrange here.
 */
export function readColumns<Id extends string>(params: URLSearchParams, set: ColumnSet<Id>): Id[] | null {
  const raw = params.get(COLUMNS_KEY)
  if (raw === null) return null

  // Trimmed, because hand-editing this key is a SUPPORTED path — it is the reason
  // the row header is unioned back in below — and `?columns=date, programme` is
  // what a URL that has been through a chat client and been retyped looks like.
  // Untrimmed, that one space drops a column and says nothing about why.
  const asked = new Set(raw.split(',').map((id) => id.trim()))
  const known = set.all.filter((id) => asked.has(id))
  if (known.length === 0) return null

  return set.all.filter((id) => id === set.rowHeader || asked.has(id))
}

/**
 * What the table renders: the reader's set when they have one, and the viewport's
 * default otherwise.
 *
 * THE DEFAULT FOLLOWS THE VIEWPORT; AN OVERRIDE DOES NOT. A reader who has said
 * nothing gets the narrow set on a phone and every column on a desktop, and that
 * flips when the device rotates. A reader who HAS said something keeps what they
 * said at every width — which is the whole point of the control, and why a narrow
 * viewport cannot quietly re-hide a column they just added back while they are
 * looking at it. The container's horizontal scroll is the backstop for that case
 * (archive-table.css).
 *
 * "HAS SAID SOMETHING" MEANS "IS CARRYING A `?columns=` KEY", AND THAT IS NARROWER
 * THAN IT SOUNDS. `writeColumns` drops the key the moment the chosen set equals the
 * viewport's own default, because the site's standing rule is that a default view
 * carries no query string — `writeSort` does exactly the same with its two keys, so
 * that `/concerts/` stays the one address everyone is prerendered at.
 *
 * So ticking back to exactly the default is how a reader RETURNS TO AUTOMATIC, and
 * the consequence is worth naming rather than discovering: hide Hall on a desktop
 * and show it again, and the key is gone — narrow the window afterwards and the
 * table takes the narrow default. "All five columns on a desktop" is not a
 * statement, because it is what a desktop does anyway. A reader who wants all five
 * on a phone can say so, on the phone, where it IS a statement and the key is
 * written.
 *
 * The alternative — keeping a key that merely restates the default — buys
 * stickiness across a resize at the cost of `/concerts/` having two addresses for
 * the same view. That trade was already made, twice, for the facets and the sort.
 */
export function visibleColumns<Id extends string>(
  set: ColumnSet<Id>,
  override: readonly Id[] | null,
  isNarrow: boolean
): readonly Id[] {
  if (override) return override

  return isNarrow ? set.narrow : set.all
}

/**
 * A copy of `params` carrying the set, or carrying no `columns` key at all when
 * `next` is already this viewport's default — so `/concerts/` and a composer page
 * stay the one canonical address for the view every visitor is prerendered.
 * Every other key (the facets, the sort) passes through untouched.
 *
 * Note what this means at the two widths: choosing Date + Programme on a phone
 * writes nothing, because that IS the phone's default; choosing the same pair on
 * a desktop writes `?columns=date,programme`, because there it is a statement.
 * The URL therefore always says exactly as much as the reader did.
 */
export function writeColumns<Id extends string>(
  params: URLSearchParams,
  set: ColumnSet<Id>,
  next: readonly Id[],
  isNarrow: boolean
): URLSearchParams {
  const copy = new URLSearchParams(params)
  copy.delete(COLUMNS_KEY)

  const chosen = set.all.filter((id) => id === set.rowHeader || next.includes(id))
  const fallback = isNarrow ? set.narrow : set.all

  if (!sameSet(chosen, fallback)) copy.set(COLUMNS_KEY, chosen.join(','))

  return copy
}

/** Both arrays are `all`-ordered subsets, so equality is length plus position. */
function sameSet<Id extends string>(a: readonly Id[], b: readonly Id[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index])
}

/**
 * A stable string for React Aria's `dependencies`, which invalidates its column
 * and cell caches. It has to be a VALUE and not the array: `dependencies` is
 * compared element-wise like a hook's dependency list, so handing it the freshly
 * filtered array would invalidate the cache on every render, and handing it
 * nothing leaves cells rendered against a column that is no longer there.
 */
export function columnsKey<Id extends string>(visible: readonly Id[]): string {
  return visible.join('|')
}

/**
 * What the View trigger's `aria-label` says about columns, appended to whatever
 * it says about filters.
 *
 * Empty when nothing is hidden. Deliberately NOT folded into the trigger's badge:
 * below 40rem the default hides columns on its own, so a badge counting them
 * would light up on every phone load and report the ordinary state as an applied
 * one — and a count of facet VALUES and a count of hidden COLUMNS are not the
 * same unit and cannot be summed. The badge keeps meaning applied filters; this
 * says the rest.
 */
export function describeColumns<Id extends string>(set: ColumnSet<Id>, visible: readonly Id[]): string {
  const hidden = set.all.length - visible.length
  if (hidden <= 0) return ''

  return `${hidden} ${hidden === 1 ? 'column' : 'columns'} hidden`
}
