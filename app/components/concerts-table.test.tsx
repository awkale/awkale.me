import { act, cleanup, render, screen } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'

import type { Concert } from '../lib/archive'
import { ConcertsTable } from './concerts-table'

/**
 * AWK-70's recut, asserted where it can actually be seen.
 *
 * The COLUMN ORDER is the ticket, and it is the one thing a passing archive test
 * cannot check: the sweep is happy whatever order a table renders its cells in.
 * These lock the header row and the cells against each other, which is the failure
 * the old markup invited — Th and Td rows stating the order twice, silently able to
 * disagree.
 *
 * No RouterProvider here, unlike site-search.test.tsx. React Aria's is what makes
 * a RAC `href` use the client router, and this table deliberately does not use one:
 * the link lives inside the Date cell as a real anchor so the prerendered HTML
 * keeps its 127 hrefs. `MemoryRouter` alone is what `<Link>` needs.
 */
const concert = (over: Partial<Concert> = {}): Concert => ({
  id: 'cnc-1',
  slug: '2012-03-15',
  date: '2012-03-15',
  hall: 'Walt Whitman Hall',
  // Present so the fixture is a whole Concert; this table has no location column
  // and never reads it — the concert page is the only surface that does.
  hallLocation: 'Brooklyn College',
  conductor: 'Nicholas Armstrong',
  orchestras: [{ name: 'Brooklyn Symphony Orchestra', abbreviation: 'BSO' }],
  program: [
    { id: 'pi-1', order: 1, label: 'Symphony No. 5', ...blanks() },
    { id: 'pi-2', order: 2, label: 'Coriolan Overture', ...blanks() },
  ],
  recordings: [],
  ...over,
})

/** The parts of a ProgramEntry this table never reads. */
function blanks() {
  return {
    workId: null,
    workSlug: null,
    composerSlug: null,
    composerName: null,
    arrangerName: null,
    arrangementType: null,
    conductorName: null,
    conductorIsOwn: false,
  }
}

function renderTable(concerts: Concert[]) {
  return render(
    <MemoryRouter>
      <ConcertsTable concerts={concerts} />
    </MemoryRouter>
  )
}

const cellText = () =>
  screen
    .getAllByRole('rowheader')
    .concat(screen.getAllByRole('gridcell'))
    .map((c) => c.textContent)

describe('ConcertsTable', () => {
  afterEach(cleanup)

  it('heads the columns Date · Programme · Orchestra · Conductor · Hall', () => {
    // The order AWK-70 asked for, in the order they are read. Items is gone.
    renderTable([concert()])

    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Date',
      'Programme',
      'Orchestra',
      'Conductor',
      'Hall',
    ])
  })

  it('fills the cells in the same order as the headers', () => {
    renderTable([concert()])

    // Date is the row header, so it is not a gridcell — which is the point of
    // marking it one: a screen reader announces the date when moving between rows.
    expect(screen.getByRole('rowheader').textContent).toBe('2012-03-15')
    expect(screen.getAllByRole('gridcell').map((c) => c.textContent)).toEqual([
      'Symphony No. 5, Coriolan Overture',
      'BSO',
      'Nicholas Armstrong',
      'Walt Whitman Hall',
    ])
  })

  it('no longer counts the programme items', () => {
    // The Items column carried `program.length`. Its data is untouched — two items
    // here — and nothing in the table says "2".
    renderTable([concert()])

    expect(cellText()).not.toContain('2')
  })

  it('names the orchestra by abbreviation, not by its full name', () => {
    // The whole reason `Concert.orchestras` carries both. 27 characters in a
    // 96px column is what this column would otherwise be.
    renderTable([concert()])

    expect(screen.getByRole('gridcell', { name: 'BSO' })).toBeTruthy()
    expect(screen.queryByText('Brooklyn Symphony Orchestra')).toBeNull()
  })

  it('falls back to the full name when the orchestra carries no abbreviation', () => {
    renderTable([concert({ orchestras: [{ name: 'All-Nassau Wind Ensemble', abbreviation: null }] })])

    expect(screen.getByRole('gridcell', { name: 'All-Nassau Wind Ensemble' })).toBeTruthy()
  })

  it('names both orchestras of a joint concert rather than only the first', () => {
    // Every attended concert links exactly one today, so this is the side-by-side
    // concert nobody has authored — joined, not truncated to `orchestras[0]`.
    renderTable([
      concert({
        orchestras: [
          { name: 'Brooklyn Symphony Orchestra', abbreviation: 'BSO' },
          { name: 'Long Island Youth Orchestra', abbreviation: 'LIYO' },
        ],
      }),
    ])

    expect(screen.getByRole('gridcell', { name: 'BSO · LIYO' })).toBeTruthy()
  })

  it('renders an em dash for every absent value rather than a blank cell', () => {
    renderTable([concert({ hall: null, conductor: null, orchestras: [] })])

    expect(screen.getAllByRole('gridcell').map((c) => c.textContent)).toEqual([
      'Symphony No. 5, Coriolan Overture',
      '—',
      '—',
      '—',
    ])
  })

  it('marks a programme longer than two items with an ellipsis', () => {
    renderTable([
      concert({
        program: [
          { id: 'pi-1', order: 1, label: 'One', ...blanks() },
          { id: 'pi-2', order: 2, label: 'Two', ...blanks() },
          { id: 'pi-3', order: 3, label: 'Three', ...blanks() },
        ],
      }),
    ])

    expect(screen.getByRole('gridcell', { name: 'One, Two…' })).toBeTruthy()
  })

  it('links the date, and to a trailing-slash concert path', () => {
    // The link React Aria's own docs would have moved onto the Row. It stays a
    // real anchor here so the prerendered HTML keeps a crawlable href — this page
    // is the only one that links the 127 concert pages.
    renderTable([concert()])

    expect(screen.getByRole('link', { name: '2012-03-15' }).getAttribute('href')).toBe('/concerts/2012-03-15/')
  })

  it('keeps the headers on screen when the filters match nothing', () => {
    // Reachable on purpose: an unknown `?conductor=` value matches nothing and is
    // honoured rather than dropped. React Aria spans the message itself, which is
    // what retired the hard-coded colSpan={5}.
    const { container } = renderTable([])

    expect(screen.getAllByRole('columnheader')).toHaveLength(5)
    expect(screen.getByText('No concerts match these filters.')).toBeTruthy()

    // The span is React Aria's, derived from the collection, so it cannot drift
    // from the column count the way the literal it replaced could.
    const cell = container.querySelector('tbody td')
    expect(cell?.getAttribute('colspan')).toBe('5')
  })
})

describe('ConcertsTable — filtering down to nothing', () => {
  afterEach(cleanup)

  it('shows the empty state on the HYDRATION path, which is the only one the page takes', async () => {
    // THE REGRESSION TEST FOR THE `key` ON <Table>. Without it this fails and every
    // other test in this file still passes: React Aria's collection update does not
    // reach `renderEmptyState` when the table is emptied after hydrating with rows,
    // so /concerts/?conductor=<no match> renders headers over an empty tbody.
    // ADR-0004 prerenders the page unfiltered, so that IS the live path.
    const Page = () => {
      const [mounted, setMounted] = useState(false)
      useEffect(() => setMounted(true), [])
      return <ConcertsTable concerts={mounted ? [] : [concert()]} />
    }

    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <Page />
      </MemoryRouter>
    )
    const host = document.createElement('div')
    host.innerHTML = markup
    document.body.appendChild(host)

    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(
        host,
        <MemoryRouter>
          <Page />
        </MemoryRouter>
      )
    })

    // `finally`, so the root is torn down even when the assertion throws. `cleanup`
    // only knows about roots Testing Library created, and a failing hydrated root
    // left mounted leaks into the next test — measured: with the fix reverted, this
    // failing made the re-render case below fail too, which it does not do alone.
    try {
      expect(host.textContent).toContain('No concerts match these filters.')
    } finally {
      await act(async () => root?.unmount())
      host.remove()
    }
  })

  it('shows the empty state when a filter empties an already-rendered table', () => {
    // THE PATH THE PAGE ACTUALLY TAKES, and the one rendering `[]` from the start
    // never exercises. ADR-0004's mount gate means /concerts/?conductor=X renders
    // all 127 rows for one frame and only then applies the selection — so the table
    // goes 127 to 0 by re-render, never mounting empty.
    const { rerender } = render(
      <MemoryRouter>
        <ConcertsTable concerts={[concert(), concert({ id: 'cnc-2', slug: '2018-04-22', date: '2018-04-22' })]} />
      </MemoryRouter>
    )
    expect(screen.getAllByRole('row')).toHaveLength(3)

    rerender(
      <MemoryRouter>
        <ConcertsTable concerts={[]} />
      </MemoryRouter>
    )

    expect(screen.getByText('No concerts match these filters.')).toBeTruthy()
  })
})
