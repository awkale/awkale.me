import type { ReactNode } from 'react'
import {
  Cell,
  Column,
  ColumnResizer,
  ResizableTableContainer,
  Row,
  Table,
  TableBody,
  TableHeader,
} from 'react-aria-components'
import { Link } from 'react-router'

import type { Concert } from '../lib/archive'

/**
 * The Performance history's 127-row index, as a resizable React Aria table.
 *
 * WHY A COLLECTION COMPONENT AND NOT A `<table>`. It was a plain table until
 * AWK-70, and the recut that ticket asked for — orchestra in, items out, and the
 * programme moved from last to second — is entirely a statement about columns. In
 * RAC a column IS an object, so the order lives in COLUMNS below and nowhere else;
 * the old markup stated it three times over (a `<Th>` row, a `<Td>` row, and a
 * hard-coded `colSpan={5}` the ticket flagged as the next thing to go silently
 * wrong). Resizing is what made the migration worth doing rather than a reorder in
 * place, and sorting lands on the same seam under AWK-71.
 *
 * WHAT IT COSTS, both accepted deliberately:
 *
 *   1. This is a GRID, not a static table. RAC goes through `useTable`, so the
 *      rendered role is `grid` with focusable rows and arrow-key cell navigation.
 *      A resizer has to be keyboard-operable, so there was no version of this that
 *      kept the static-table reading.
 *   2. Column widths are a CLIENT MEASUREMENT. `ResizableTableContainer` feeds
 *      `tableWidth` from a resize observer, and RAC then forces
 *      `table-layout: fixed; width: min-content` on the table with a pixel width on
 *      every `th`. Those DO reach the prerendered HTML (ADR-0004, `ssr: false`) —
 *      measured, not assumed: 104/180/96/150/168, summing to 698px, with Programme
 *      collapsed to its `minWidth` because a resize observer that has never run
 *      reports a table width of 0. So the table sizes itself properly one tick
 *      after hydration, and concerts-table.css has to override that inline
 *      `min-content` for the frame before it — and for a reader with no JS at all,
 *      who would otherwise get a 698px table on an 80rem page.
 *
 * WHAT IS NOT ADOPTED, and this one matters: `Row`'s `href`. React Aria's own docs
 * are explicit that a row cannot be an `<a>` — it navigates with JavaScript — and
 * `/concerts/` is the ONLY page that links the 127 concert pages. Moving the link
 * to the row would empty every `href` out of the prerendered HTML and de-link the
 * whole section for crawlers and for a reader with no JS. So the `<Link>` stays
 * inside the Date cell, a real anchor, exactly where it was. Arrow-key navigation
 * reaches it as a focusable child.
 *
 * Widths are NOT persisted. `onResizeEnd` plus localStorage is the documented
 * pattern and it is deliberately skipped: nothing on this site persists UI state,
 * and a width that survives a reload was not asked for.
 */

/**
 * THE COLUMN ORDER, and the only place it is stated.
 *
 * Date · Programme · Orchestra · Conductor · Hall (AWK-70). Programme leads
 * because it is what the row is about; it was last only because that is where a
 * variable-width string is free.
 *
 * `1fr` on Programme is the width treatment: the four short columns take fixed
 * defaults and Programme absorbs every remaining pixel, which at the page's
 * 80rem ceiling is enough for the longest real value (93 characters) on one line.
 * Below that it truncates — and truncation is honest here in a way it would not
 * have been before, because the reader can now drag the column wider.
 *
 * The `minWidth`s sum to 520px, which fits inside the 40rem breakpoint where
 * concerts-table.css hands horizontal scrolling to the container. Changing one
 * means re-checking that sum.
 */
const COLUMNS = [
  { id: 'date', label: 'Date', defaultWidth: 104, minWidth: 92 },
  { id: 'programme', label: 'Programme', defaultWidth: '1fr', minWidth: 180 },
  { id: 'orchestra', label: 'Orchestra', defaultWidth: 96, minWidth: 64 },
  { id: 'conductor', label: 'Conductor', defaultWidth: 150, minWidth: 96 },
  { id: 'hall', label: 'Hall', defaultWidth: 168, minWidth: 88 },
] as const

type ColumnId = (typeof COLUMNS)[number]['id']

const LAST = COLUMNS[COLUMNS.length - 1].id

/**
 * Honest defensive rendering, not a known gap — the same em dash the plain table
 * used, now carrying its own class so no cell needs a conditional one.
 *
 * A comment on the old conductor cell used to claim 2007-12-16 had no conductor
 * and was therefore invisible to the filter. That was never true in production:
 * `cnc-20071216` is published with conductor Nicholas Armstrong. The blank existed
 * only in the derived bso-graph.json, and the site builds from the Delivery API.
 */
const Absent = () => <span className="concerts-absent">—</span>

/** The first two item labels, and an ellipsis when the evening ran longer. */
function programme(concert: Concert) {
  const labels = concert.program.slice(0, 2).map((item) => item.label)
  return `${labels.join(', ')}${concert.program.length > 2 ? '…' : ''}`
}

/**
 * One renderer per column, keyed by id.
 *
 * A `Record<ColumnId, …>` rather than a `switch`: it is exhaustive the same way —
 * adding an id to COLUMNS without a renderer fails the build — and it does not
 * trip `default-case`, which oxlint treats as an error rather than a warning.
 */
const CELL: Record<ColumnId, (concert: Concert) => ReactNode> = {
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

export function ConcertsTable({ concerts }: { concerts: Concert[] }) {
  return (
    <ResizableTableContainer className="concerts-table">
      {/*
        THE `key` IS A BUG FIX, NOT A HABIT, and removing it silently breaks the
        empty state in production while every unit test still passes.

        React Aria builds its collection once and updates it; on the HYDRATION path
        the update that empties the table does not reach `renderEmptyState`. The
        tbody ends up with no rows, no `data-empty` and no message — headers over a
        void. That is exactly the path this page takes, and only that path: ADR-0004
        prerenders `/concerts/` unfiltered, so `?conductor=X` hydrates 127 rows and
        THEN applies the selection. Mounting empty works, and re-rendering to empty
        after a plain client mount works, which is why this survived a passing test
        that asserted the message and its colSpan.
        Measured on the built site at `/concerts/?conductor=Nobody%20At%20All`:
        "Showing 0 of 127 concerts" beside an empty tbody.

        Keying on emptiness alone rebuilds the collection across that one transition.
        `dependencies` on TableBody does not fix it and neither does a key on
        TableBody — the collection belongs to the Table. The cost is that column
        widths reset when the table empties and refills; widths are not persisted
        anyway, and filtering to nothing and back is not the common path.
      */}
      <Table key={concerts.length === 0 ? 'empty' : 'rows'} aria-label="Concerts" className="concerts-grid">
        <TableHeader columns={COLUMNS}>
          {(column) => (
            <Column
              isRowHeader={column.id === 'date'}
              defaultWidth={column.defaultWidth}
              minWidth={column.minWidth}
              className="eyebrow concerts-th"
            >
              <span className="concerts-th-label">{column.label}</span>
              {/* Rendering the resizer is what makes a column resizable — there is
                  no `allowsResizing` prop on React Aria's own Column, only on the
                  starter template's wrapper around it. None on the last column: with
                  no scroll container above the breakpoint there is nothing to its
                  right to give width back, so dragging it would widen the table past
                  the page. */}
              {column.id !== LAST && <ColumnResizer className="concerts-resizer" />}
            </Column>
          )}
        </TableHeader>

        {/* `renderEmptyState` rather than a full-width row of our own, which is what
            retires the hard-coded colSpan: React Aria spans the cell across the
            collection's own column count. A selection that yields nothing is
            reachable on purpose — an unknown `?conductor=` value matches nothing and
            is honoured rather than dropped (app/lib/facets.ts) — so the headers stay
            on screen with the message under them. The clear control is NOT on screen
            here, contrary to what the comment this replaced said: it lives inside
            the Filters popover and is absent from the DOM until that opens. The
            status line above the table is what tells the reader nothing matched. */}
        <TableBody items={concerts} renderEmptyState={() => 'No concerts match these filters.'}>
          {(concert) => (
            <Row id={concert.id} columns={COLUMNS} className="concerts-row">
              {(column) => (
                <Cell className={`concerts-cell concerts-cell-${column.id}`}>{CELL[column.id](concert)}</Cell>
              )}
            </Row>
          )}
        </TableBody>
      </Table>
    </ResizableTableContainer>
  )
}
