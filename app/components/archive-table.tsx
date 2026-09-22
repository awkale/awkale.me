import type { ReactNode } from 'react'
import {
  Cell,
  Column,
  type ColumnProps,
  ColumnResizer,
  ResizableTableContainer,
  Row,
  type SortDescriptor,
  Table,
  TableBody,
  TableHeader,
} from 'react-aria-components'

import { columnsKey } from '../lib/columns'

/**
 * The archive's ONE collection table, rendering both the Performance history's
 * 133-row index (concerts-table.tsx) and the works table on each of the 159
 * composer pages (works-table.tsx).
 *
 * WHY A COLLECTION COMPONENT AND NOT A `<table>`. Both were plain tables once.
 * The concerts index stopped being one under AWK-70, whose recut — orchestra in,
 * items out, programme moved from last to second — was entirely a statement about
 * columns, and in React Aria a column IS an object, so the order lives in one
 * array and nowhere else; the old markup stated it three times over (a `<Th>` row,
 * a `<Td>` row, and a hard-coded `colSpan={5}` the ticket flagged as the next
 * thing to go silently wrong). Resizing is what made that migration worth doing
 * rather than a reorder in place, and sorting landed on the same seam under
 * AWK-71.
 *
 * THE WORKS TABLE JOINED IT UNDER AWK-67, which needed a reader-controlled column
 * set on both surfaces. Cloning the concerts table for it would have cloned the
 * empty-state `key`, the `dependencies` rule, the inline-width override and every
 * comment explaining them — the two tables differ in their columns, their row link
 * and their empty state, not in their mechanics. So the mechanics live here and
 * each caller supplies the rest.
 *
 * WHAT IT COSTS, all accepted deliberately, and now paid on 160 pages rather than
 * one:
 *
 *   1. This is a GRID, not a static table. RAC goes through `useTable`, so the
 *      rendered role is `grid` with focusable rows and arrow-key cell navigation.
 *      A resizer has to be keyboard-operable, so there was no version of this that
 *      kept the static-table reading.
 *   2. Column widths are a CLIENT MEASUREMENT. `ResizableTableContainer` feeds
 *      `tableWidth` from a resize observer, and RAC then forces
 *      `table-layout: fixed; width: min-content` on the table with a pixel width on
 *      every `th`. Those DO reach the prerendered HTML (ADR-0004, `ssr: false`) —
 *      measured, not assumed: the concerts index prerenders at 698px, with
 *      Programme collapsed to its `minWidth` because a resize observer that has
 *      never run reports a table width of 0. So the table sizes itself properly one
 *      tick after hydration, and archive-table.css has to override that inline
 *      `min-content` for the frame before it — and for a reader with no JS at all,
 *      who would otherwise get a 698px table on an 80rem page.
 *   3. CELLS TRUNCATE RATHER THAN WRAP. `table-layout: fixed` plus the `nowrap`
 *      in the CSS is what keeps a dense index one line per row. The works table
 *      wrapped long titles before AWK-67 and now ellipses them instead; at the
 *      page's 80rem ceiling Work is given ~800px, so no real title reaches it, and
 *      resizing is the recovery where one does.
 *
 * WHAT IS NOT ADOPTED, and this one matters: `Row`'s `href`. React Aria's own docs
 * are explicit that a row cannot be an `<a>` — it navigates with JavaScript — and
 * these two tables are the ONLY pages linking the 133 concert pages and the 359
 * work pages respectively. Moving the link to the row would empty every `href` out
 * of the prerendered HTML and de-link the whole section for crawlers and for a
 * reader with no JS. So the `<Link>` stays inside the row-header cell, a real
 * anchor, exactly where it was — which is also why app/lib/columns.ts refuses to
 * let that column be hidden. Arrow-key navigation reaches it as a focusable child.
 *
 * Widths are NOT persisted, and neither is the column set. `onResizeEnd` plus
 * localStorage is the documented pattern and it is deliberately skipped: nothing
 * on this site persists UI state. The column set lives in the query string
 * instead, which is linkable rather than remembered.
 *
 * THE COLUMNS ARRIVE ONE FRAME LATE, AND THAT COST IS THE POINT OF THE DESIGN.
 * `columns` is decided behind the same hydration gate the facets and the sort go
 * through (app/lib/use-narrow.ts, and the routes). ADR-0004 prerenders every page
 * with `ssr: false`, so the HTML is built with NO VIEWPORT and is byte-identical
 * for every visitor — the narrow set cannot be baked in, and reading `matchMedia`
 * during the first client render would make that render disagree with the markup
 * it is hydrating into, which React 19 answers by discarding the server HTML and
 * logging #418. So the first client render is what was prerendered — every column
 * — and the narrow default applies on the tick after. A phone reader sees the full
 * table for one frame, exactly as a shared `?conductor=` link shows every row for
 * one; the same cost, taken for the same reason.
 *
 * Which is also why archive-table.css's container scroll is NOT redundant with the
 * column set. For a reader with no JavaScript the gate never opens at all, and the
 * full set is permanent: the container has to be able to scroll, or the document
 * will.
 */

/**
 * One column, as the table needs it: the presentation half. The policy half —
 * which columns exist, in what order, which are shown narrow, and which one can
 * never be hidden — is app/lib/columns.ts's, and a caller derives this array from
 * that module's `all` rather than restating the order.
 */
export type ArchiveColumn<Id extends string> = {
  id: Id
  label: string
  /**
   * `1fr` on the column that should absorb the leftover width; px on the rest.
   * Typed off React Aria's own `ColumnProps` rather than `number | string`, which
   * `ColumnSize` is narrower than — the library does not re-export that type, and
   * a widened alias here would only fail at the `<Column>` below.
   */
  defaultWidth: ColumnProps['defaultWidth']
  minWidth: number
  allowsSorting?: boolean
}

type Props<Id extends string, RowData extends { id: string }> = {
  /** The grid's accessible name. */
  label: string
  /** The VISIBLE columns, already filtered and in `all` order. */
  columns: readonly ArchiveColumn<Id>[]
  /** The column carrying the row's link; marked `isRowHeader` so it is announced. */
  rowHeader: Id
  rows: readonly RowData[]
  cell: (row: RowData, id: Id) => ReactNode
  /** Shown when `rows` is empty. React Aria spans it across the collection itself. */
  emptyState: string
  /** Omitted entirely by a table that does not sort — the works table does not. */
  sort?: SortDescriptor
  onSortChange?: (descriptor: SortDescriptor) => void
}

export function ArchiveTable<Id extends string, RowData extends { id: string }>({
  label,
  columns,
  rowHeader,
  rows,
  cell,
  emptyState,
  sort,
  onSortChange,
}: Props<Id, RowData>) {
  /*
    THE VALUE REACT ARIA'S THREE CACHES ARE COMPARED AGAINST (AWK-67), and IT IS
    NEEDED ON ALL THREE — TableHeader, TableBody AND Row. Adding a column back
    threw `Cell count must match column count. Found 2 cells and 3 columns.` on the
    built page with it on only two of them, and React Router caught it as a render
    error, so the page went to the error boundary.

    WHY THE ONE ON `Row` IS NOT ENOUGH, which is the whole trap. `TableBody` caches
    the rendered `<Row>` ELEMENT against the row object. When the column set changes
    but the rows do not, that cache hits, the stale element is reused, and the
    `dependencies` written on it are never read — the prop cannot invalidate a
    render that does not happen. So the header rebuilds to three columns while the
    body still holds two-cell rows. `TableBody` is what has to be told first; `Row`
    then invalidates the cells inside the row it rebuilds.

    IT ONLY BITES WHEN THE ROW OBJECTS ARE STABLE, which is exactly the live case
    and exactly what a naive test misses. `/concerts/` re-derives its array every
    render but the Concerts inside it are the loader's, identical across renders, so
    the cache hits. A test whose fixture builds a fresh row object each render never
    hits it and passes against the broken code — mine did, until it was rewritten to
    hold one row object across the re-render. Keep it that way.

    A STRING rather than the array. `dependencies` is compared element-wise like a
    hook's dependency list, so handing it the freshly filtered array would
    invalidate on every render and defeat the caching entirely.
  */
  const visible = columnsKey(columns.map((column) => column.id))

  /*
    No resizer on the LAST VISIBLE column, which is why this is computed from
    `columns` rather than from the full set: with no scroll container above the
    breakpoint there is nothing to its right to give width back, so dragging it
    would widen the table past the page. Hide the last column and its neighbour
    inherits the rule.
  */
  const last = columns[columns.length - 1]?.id

  return (
    <ResizableTableContainer className="archive-table">
      {/*
        THE `key` IS A BUG FIX, NOT A HABIT, and removing it silently breaks the
        empty state in production while every unit test still passes.

        React Aria builds its collection once and updates it; on the HYDRATION path
        the update that empties the table does not reach `renderEmptyState`. The
        tbody ends up with no rows, no `data-empty` and no message — headers over a
        void. That is exactly the path /concerts/ takes, and only that path:
        ADR-0004 prerenders it unfiltered, so `?conductor=X` hydrates every row and
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

        The column set does NOT belong in this key. Rebuilding the whole collection
        when a column is added back would reset the widths and the scroll position
        on the common interaction rather than the rare one; `dependencies` is the
        mechanism for that, and it is what `visible` above feeds.
      */}
      <Table
        key={rows.length === 0 ? 'empty' : 'rows'}
        aria-label={label}
        className="archive-grid"
        sortDescriptor={sort}
        onSortChange={onSortChange}
      >
        <TableHeader columns={columns} dependencies={[visible]}>
          {(column) => (
            <Column
              isRowHeader={column.id === rowHeader}
              allowsSorting={column.allowsSorting}
              defaultWidth={column.defaultWidth}
              minWidth={column.minWidth}
              className="eyebrow archive-th"
            >
              {({ sortDirection }) => (
                <>
                  <span className="archive-th-content">
                    <span className="archive-th-label">{column.label}</span>
                    {/* Decorative: `aria-sort` on the th is what assistive tech
                        reads, and the status line announces the change. Present
                        on the sorted column only — an idle arrow on every sortable
                        header is the busier reading these pages keep declining. */}
                    {sortDirection && (
                      <span className="archive-sort-indicator" aria-hidden="true">
                        {sortDirection === 'ascending' ? '↑' : '↓'}
                      </span>
                    )}
                  </span>
                  {/* Rendering the resizer is what makes a column resizable — there
                      is no `allowsResizing` prop on React Aria's own Column, only on
                      the starter template's wrapper around it. */}
                  {column.id !== last && <ColumnResizer className="archive-resizer" />}
                </>
              )}
            </Column>
          )}
        </TableHeader>

        {/* `renderEmptyState` rather than a full-width row of our own, which is what
            retires the hard-coded colSpan: React Aria spans the cell across the
            collection's own column count — so it stays correct as columns are
            hidden and shown, which a literal could not have done. */}
        <TableBody items={rows} dependencies={[visible]} renderEmptyState={() => emptyState}>
          {(row) => (
            <Row id={row.id} columns={columns} dependencies={[visible]} className="archive-row">
              {(column) => <Cell className={`archive-cell archive-cell-${column.id}`}>{cell(row, column.id)}</Cell>}
            </Row>
          )}
        </TableBody>
      </Table>
    </ResizableTableContainer>
  )
}

/**
 * Honest defensive rendering, not a known gap — the same em dash both plain tables
 * used, carrying its own class so no cell needs a conditional one.
 */
export const Absent = () => <span className="archive-absent">—</span>
