import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { ColumnSelect } from '../components/column-select'
import { ViewMenu } from '../components/view-menu'
import { WORK_LABELS, WorksTable } from '../components/works-table'
import { loadArchive } from '../lib/archive'
import {
  describeColumns,
  readColumns,
  visibleColumns,
  WORK_COLUMNS,
  type WorkColumnId,
  writeColumns,
} from '../lib/columns'
import { useNarrow } from '../lib/use-narrow'
import type { Route } from './+types/composer'

/**
 * A composer page — one per person whose work Alex played.
 *
 * The page exists iff at least one of their works qualifies, evaluated per
 * (concert, item) pair (ADR-0006). So a composer whose only work was sat out
 * disappears entirely, which is the rule working as designed rather than a gap.
 *
 * The name shown is the FILING name, per ADR-0008: the nobiliary particle is
 * relocated to the back rather than stripped, so `van Beethoven, Ludwig` files as
 * `Beethoven, Ludwig van` under B and the display name stays recoverable.
 * Honorifics ARE stripped — Walton and Sullivan were each split across two
 * records by a `Sir`, and both halves of Walton held played works, so he was
 * getting two half-empty pages until AWK-39 merged them.
 *
 * Works listed here are the canonical children of this page
 * (`/concerts/composers/<composer>/works/<work>`), which is why `work.slug` needs
 * to be unique only within this composer — the invariant app/lib/invariants.ts
 * asserts now that `unique: true` has come off the field.
 */
export async function loader({ params }: Route.LoaderArgs) {
  const { composers, works } = await loadArchive()
  const composer = composers.find((c) => c.slug === params.composer)

  if (!composer) throw new Response(`No composer ${params.composer}`, { status: 404 })

  return {
    composer,
    works: works.filter((w) => w.composerId === composer.id).sort((a, b) => a.title.localeCompare(b.title)),
  }
}

export default function Composer({ loaderData }: Route.ComponentProps) {
  const { composer, works } = loaderData
  const [searchParams, setSearchParams] = useSearchParams()

  /*
    AWK-67's column set, behind the same hydration gate /concerts/ uses — and for
    the same reason, twice over. ADR-0004's `ssr: false` prerenders this page with
    no viewport and identical markup for every visitor, so neither `?columns=` nor
    the viewport width can be read during the first client render without the two
    disagreeing; React 19 answers that by discarding the server HTML. So the first
    frame is every column, and one tick later the reader's set or the viewport's
    default applies. See app/lib/use-narrow.ts.

    Thirty of these 159 pages pushed the DOCUMENT sideways at 375px before this —
    worst 51px on Mahler — because four headers are 364px in a 360px column. The
    narrow default takes every one of them to zero; archive-table.css's container
    scroll is the backstop for a reader who adds the columns back, or who has no
    JavaScript at all and never opens the gate.
  */
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])

  const isNarrow = useNarrow()
  const columns = visibleColumns(WORK_COLUMNS, hydrated ? readColumns(searchParams, WORK_COLUMNS) : null, isNarrow)

  /*
    REPLACE, never push, and `preventScrollReset` — the same navigation
    /concerts/ makes, for the same two reasons: Back should leave the composer
    page rather than unwind a column at a time, and `<ScrollRestoration />` in
    app/root.tsx would otherwise send the reader to the top of the page each time
    they ticked a box in a popover they are still working down.
  */
  function setColumns(next: readonly WorkColumnId[]) {
    setSearchParams(writeColumns(searchParams, WORK_COLUMNS, next, isNarrow), {
      replace: true,
      preventScrollReset: true,
    })
  }

  return (
    <main className="px-[var(--gutter)] py-[var(--space-section)]">
      <div className="mx-auto max-w-[var(--width-wide)]">
        <p className="kicker">
          <Link to="/concerts/composers/" className="no-underline hover:underline">
            Composers
          </Link>
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">{composer.filingName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="tabular">{composer.workCount}</span> {composer.workCount === 1 ? 'work' : 'works'} I have
          played
        </p>

        {/* The page's FIRST piece of interactive chrome (AWK-67). It holds one
            section where /concerts/ holds three, and says `View` anyway — the two
            surfaces are the same section of the site and a trigger that changes
            its word with its contents reads as two different controls. */}
        <div className="view-bar">
          <ViewMenu applied={null} columnsNote={describeColumns(WORK_COLUMNS, columns)}>
            <ColumnSelect set={WORK_COLUMNS} labels={WORK_LABELS} visible={columns} onChange={setColumns} />
          </ViewMenu>
        </div>

        <WorksTable works={works} columns={columns} />
      </div>
    </main>
  )
}
