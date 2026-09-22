import type { ReactNode } from 'react'
import { Link } from 'react-router'

import type { Work } from '../lib/archive'
import { type WorkColumnId, WORK_COLUMNS } from '../lib/columns'
import { arrangerCredit } from '../lib/format'
import { Absent, type ArchiveColumn, ArchiveTable } from './archive-table'

/**
 * One composer's works, on each of the 159 composer pages.
 *
 * Everything mechanical is archive-table.tsx's — the collection, the empty-state
 * `key`, the resizers, the inline-width override, and why `Row`'s `href` is not
 * adopted. Read that file before editing this one.
 *
 * IT WAS A PLAIN `<table>` UNTIL AWK-67. Thirty of the 159 pages pushed the whole
 * document sideways at 375px — worst 51px on Mahler, median 12px — and the cause
 * was HEADER MIN-CONTENT rather than data: Work 97 · Period 72 · Forms 80 ·
 * Performances 115 is 364px in a 360px column, and `Performances` is a single
 * unbreakable token no cell value drives. Hiding Period and Forms takes every one
 * of them to zero, which is what the narrow default in app/lib/columns.ts does.
 *
 * TWO THINGS CHANGED BEYOND THE COLUMN SET, and both come with the collection
 * rather than being chosen here: cells truncate rather than wrap (the plain table
 * let a long title run to two lines), and the rendered role is `grid` with
 * arrow-key navigation. At the page's 80rem ceiling Work is given roughly 800px,
 * which no real title reaches, and a resizer is the recovery where one does.
 *
 * THIS TABLE DOES NOT SORT. The rows arrive title-ascending from the route, which
 * is the order the page was prerendered in. AWK-71 put sorting on the concerts
 * index only, and adding it here would need its own query-string keys and its own
 * hydration story — out of scope, and a separate ticket if it is ever wanted.
 */

/**
 * THE COLUMN ORDER comes from WORK_COLUMNS.all — Work · Period · Forms ·
 * Performances — and this record only says how each one looks. Exhaustive by type,
 * so a column added to the set without a look here fails the build.
 *
 * `1fr` on Work for the same reason Programme has it on the concerts index: the
 * three short columns take fixed defaults and the variable-length one absorbs the
 * rest. `performances` is deliberately WIDER than the count it holds — its header
 * is the widest token on the row, and a column narrower than its own title reads
 * as breakage rather than as density.
 */
const LOOK: Record<WorkColumnId, Omit<ArchiveColumn<WorkColumnId>, 'id'>> = {
  work: { label: 'Work', defaultWidth: '1fr', minWidth: 160 },
  period: { label: 'Period', defaultWidth: 110, minWidth: 72 },
  forms: { label: 'Forms', defaultWidth: 160, minWidth: 80 },
  performances: { label: 'Performances', defaultWidth: 120, minWidth: 116 },
}

/**
 * The headers, for the Columns control — so a checkbox and the column it turns on
 * are never two different words. Derived from LOOK rather than restated.
 */
export const WORK_LABELS = Object.fromEntries(WORK_COLUMNS.all.map((id) => [id, LOOK[id].label])) as Record<
  WorkColumnId,
  string
>

/**
 * One renderer per column, keyed by id — a `Record` rather than a `switch`, for
 * the reason concerts-table.tsx gives.
 */
const CELL: Record<WorkColumnId, (work: Work) => ReactNode> = {
  work: (work) => {
    const credit = arrangerCredit({ arranger: work.arrangerName, arrangementType: work.arrangementType })

    return (
      // A flex pair, not a text run: the cell truncates with an ellipsis, and a
      // trailing span is the first thing it eats. archive-table.css says why that
      // would be a correctness bug rather than a cosmetic one.
      <span className="archive-work">
        <Link
          to={`/concerts/composers/${work.composerSlug}/works/${work.slug}/`}
          className="archive-work-title no-underline hover:underline"
        >
          {work.title}
        </Link>
        {/* The third place the credit has to appear, and the one it is easiest to
            forget: this page is the ONLY view listing both Nutcracker Suites side
            by side, since the merge put them under one composer with
            character-identical titles. Without it the table shows the same row
            twice, pointing at two different URLs. Outside the Link because the link
            addresses the work and the credit describes it. */}
        {credit && <span className="archive-work-credit">{credit}</span>}
      </span>
    )
  },
  // AWK-37 filled both. Period is the work's own or its composer's, already
  // resolved by loadArchive() — every row on this page shows the same value unless
  // a work overrides it, which is the point of inheriting, and also why it is one
  // of the two columns the narrow default drops. Forms may legitimately be empty on
  // 104 works, so the em dash stays the honest rendering there (ADR-0007).
  period: (work) => work.period ?? <Absent />,
  forms: (work) => (work.forms.length > 0 ? work.forms.join(', ') : <Absent />),
  performances: (work) => work.performances.length,
}

type Props = {
  works: Work[]
  /** The columns to show, in order — app/lib/columns.ts's answer, not this file's. */
  columns: readonly WorkColumnId[]
}

export function WorksTable({ works, columns }: Props) {
  return (
    <ArchiveTable
      label="Works"
      columns={columns.map((id) => ({ id, ...LOOK[id] }))}
      rowHeader={WORK_COLUMNS.rowHeader}
      rows={works}
      cell={(work, id) => CELL[id](work)}
      /* Unreachable on this surface today: a composer page exists iff at least one
         of their works qualifies (ADR-0006), so `works` is never empty. The message
         is here because the table cannot promise that on the composer's behalf, and
         headers over a void is the failure AWK-70 measured on the other one. */
      emptyState="No works to show."
    />
  )
}
