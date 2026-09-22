import type { ReactNode } from 'react'
import { Link } from 'react-router'

import type { Concert } from '../lib/archive'
import { type ConcertColumnId, CONCERT_COLUMNS } from '../lib/columns'
import { type ConcertSort, isSortColumn, toConcertSort } from '../lib/sorting'
import { Absent, type ArchiveColumn, ArchiveTable } from './archive-table'

/**
 * The Performance history's 133-row index on /concerts/.
 *
 * Everything mechanical is archive-table.tsx's — the collection, the empty-state
 * `key`, the resizers, the inline-width override, and why `Row`'s `href` is not
 * adopted. Read that file before editing this one. What is left here is the three
 * things only this table knows: which columns it has, how each cell reads, and
 * which of them sort.
 *
 * WHICH COLUMNS ARE ON SCREEN IS NOT DECIDED HERE either — it arrives as
 * `columns`, from the route, from app/lib/columns.ts, from the query string
 * (AWK-67). This file states every column that COULD be shown; that module states
 * which are, and refuses to let Date be hidden because the link lives in it.
 */

/**
 * THE COLUMN ORDER comes from CONCERT_COLUMNS.all — Date · Programme · Orchestra ·
 * Conductor · Hall (AWK-70) — and this record only says how each one looks.
 * Programme leads because it is what the row is about; it was last only because
 * that is where a variable-width string is free.
 *
 * A `Record<ConcertColumnId, …>` rather than a second ordered array: it is
 * exhaustive by type, so a column added to the set without a look here fails the
 * build, and the order cannot drift between the two the way the old `<Th>`/`<Td>`
 * pair could.
 *
 * `1fr` on Programme is the width treatment: the four short columns take fixed
 * defaults and Programme absorbs every remaining pixel, which at the page's 80rem
 * ceiling is enough for the longest real value (93 characters) on one line. Below
 * that it truncates — and truncation is honest here in a way it would not have
 * been before, because the reader can now drag the column wider.
 *
 * The `minWidth`s sum to 520px across all five, which no longer has to fit a phone
 * now that AWK-67 shows two of them there — Date + Programme is 272px inside a
 * 312px container. It still has to fit the 40rem breakpoint where archive-table.css
 * hands horizontal scrolling to the container, for the reader who adds every column
 * back. Changing one means re-checking that sum.
 */
const LOOK: Record<ConcertColumnId, Omit<ArchiveColumn<ConcertColumnId>, 'id'>> = {
  date: { label: 'Date', defaultWidth: 104, minWidth: 92 },
  programme: { label: 'Programme', defaultWidth: '1fr', minWidth: 180 },
  orchestra: { label: 'Orchestra', defaultWidth: 96, minWidth: 64 },
  conductor: { label: 'Conductor', defaultWidth: 150, minWidth: 96 },
  hall: { label: 'Hall', defaultWidth: 168, minWidth: 88 },
}

/**
 * The headers, for the Columns control — so a checkbox and the column it turns on
 * are never two different words. Derived from LOOK rather than restated.
 */
export const CONCERT_LABELS = Object.fromEntries(CONCERT_COLUMNS.all.map((id) => [id, LOOK[id].label])) as Record<
  ConcertColumnId,
  string
>

/** The first two item labels, and an ellipsis when the evening ran longer. */
function programme(concert: Concert) {
  const labels = concert.program.slice(0, 2).map((item) => item.label)
  return `${labels.join(', ')}${concert.program.length > 2 ? '…' : ''}`
}

/**
 * One renderer per column, keyed by id.
 *
 * A `Record<ConcertColumnId, …>` rather than a `switch`: it is exhaustive the same
 * way — adding an id to the set without a renderer fails the build — and it does
 * not trip `default-case`, which oxlint treats as an error rather than a warning.
 *
 * A comment on the old conductor cell used to claim 2007-12-16 had no conductor
 * and was therefore invisible to the filter. That was never true in production:
 * `cnc-20071216` is published with conductor Nicholas Armstrong. The blank existed
 * only in the derived bso-graph.json, and the site builds from the Delivery API.
 */
const CELL: Record<ConcertColumnId, (concert: Concert) => ReactNode> = {
  date: (concert) => (
    <Link to={`/concerts/${concert.slug}/`} className="no-underline hover:underline">
      {concert.date}
    </Link>
  ),
  programme: (concert) => (concert.program.length > 0 ? programme(concert) : <Absent />),
  // `orchestras` carries both registers of the name (AWK-70). This is the narrow
  // column, so it takes the ABBREVIATION, and the concert page spells the same
  // orchestra out. Every attended concert in the space links exactly one, but the
  // field is the list it is, so a joint concert names both rather than silently
  // dropping the second.
  orchestra: (concert) => {
    const named = concert.orchestras.map((o) => o.abbreviation ?? o.name)
    return named.length > 0 ? named.join(' · ') : <Absent />
  },
  conductor: (concert) => concert.conductor ?? <Absent />,
  hall: (concert) => concert.hall ?? <Absent />,
}

type Props = {
  concerts: Concert[]
  /** The columns to show, in order — app/lib/columns.ts's answer, not this file's. */
  columns: readonly ConcertColumnId[]
  /** The sort the rows ARE in — the table does not reorder them, it reports them. */
  sort: ConcertSort
  onSortChange: (sort: ConcertSort) => void
}

export function ConcertsTable({ concerts, columns, sort, onSortChange }: Props) {
  return (
    <ArchiveTable
      label="Concerts"
      columns={columns.map((id) => ({ id, ...LOOK[id], allowsSorting: isSortColumn(id) }))}
      rowHeader={CONCERT_COLUMNS.rowHeader}
      rows={concerts}
      cell={(concert, id) => CELL[id](concert)}
      emptyState="No concerts match these filters."
      sort={sort}
      // React Aria hands back a `Key`; the narrowing to the three sortable columns
      // lives in sorting.ts. A press on a column without `allowsSorting` never
      // reaches here at all, so the null branch is belt and braces.
      onSortChange={(descriptor) => {
        const next = toConcertSort(descriptor)
        if (next) onSortChange(next)
      }}
    />
  )
}
