import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'

import type { Work } from '../lib/archive'
import { WORK_COLUMNS } from '../lib/columns'
import { WorksTable } from './works-table'

/**
 * AWK-67 moved a composer page's works off a plain `<table>` and onto the shared
 * collection, so what these lock down is the migration rather than the mechanics:
 * that the four cells still read what the plain table read, that the link out to
 * the work page survived, and that a hidden column is genuinely absent.
 *
 * The mechanics — the empty-state `key`, the resizers, `dependencies` — belong to
 * archive-table.tsx and are asserted once, in concerts-table.test.tsx, against the
 * table that actually exercises them.
 *
 * No RouterProvider, for the reason concerts-table.test.tsx gives: the link is a
 * real anchor inside the Work cell rather than a RAC `Row href`, so `MemoryRouter`
 * alone is what `<Link>` needs.
 */
/** This table counts performances and reads nothing else off one. */
const performance = (date: string) => ({ date, slug: date, orchestra: null, conductor: null, credits: [] })

const work = (over: Partial<Work> = {}): Work => ({
  id: 'wk-1',
  slug: 'symphony-no-5',
  title: 'Symphony No. 5',
  composerId: 'cmp-1',
  composerSlug: 'beethoven-ludwig-van',
  composerName: 'Ludwig van Beethoven',
  arrangerName: null,
  arrangementType: null,
  period: 'Romantic',
  periodIsOwn: false,
  forms: ['Symphony'],
  performances: [performance('2012-03-15')],
  ...over,
})

const renderTable = (works: Work[], columns: readonly (typeof WORK_COLUMNS.all)[number][] = WORK_COLUMNS.all) =>
  render(
    <MemoryRouter>
      <WorksTable works={works} columns={columns} />
    </MemoryRouter>
  )

describe('WorksTable', () => {
  afterEach(cleanup)

  it('heads the columns Work · Period · Forms · Performances', () => {
    renderTable([work()])

    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Work',
      'Period',
      'Forms',
      'Performances',
    ])
  })

  it('fills the cells in the same order as the headers', () => {
    renderTable([work()])

    // Work is the row header, so it is not a gridcell — a screen reader announces
    // the title when moving between rows.
    expect(screen.getByRole('rowheader').textContent).toBe('Symphony No. 5')
    expect(screen.getAllByRole('gridcell').map((c) => c.textContent)).toEqual(['Romantic', 'Symphony', '1'])
  })

  it('renders an em dash for an absent period and for no forms', () => {
    // Forms is legitimately empty on 104 works (ADR-0007), so the em dash is the
    // honest rendering rather than a gap to fill.
    renderTable([work({ period: null, forms: [] })])

    expect(screen.getAllByRole('gridcell').map((c) => c.textContent)).toEqual(['—', '—', '1'])
  })

  it('joins several forms rather than showing only the first', () => {
    renderTable([work({ forms: ['Symphony', 'Programme music'] })])

    expect(screen.getByRole('gridcell', { name: 'Symphony, Programme music' })).toBeTruthy()
  })

  it('links the title, and to a trailing-slash work path under its composer', () => {
    renderTable([work()])

    expect(screen.getByRole('link', { name: 'Symphony No. 5' }).getAttribute('href')).toBe(
      '/concerts/composers/beethoven-ludwig-van/works/symphony-no-5/'
    )
  })

  it('shows the arranger credit beside the title, outside the link', () => {
    // The one thing telling the two Nutcracker Suites apart on the only page that
    // lists them side by side. Outside the Link because the link addresses the
    // work and the credit describes it.
    renderTable([work({ arrangerName: 'Stokowski', arrangementType: 'arr. by' })])

    const link = screen.getByRole('link', { name: 'Symphony No. 5' })
    expect(link.textContent).toBe('Symphony No. 5')
    expect(screen.getByRole('rowheader').textContent).toContain('Stokowski')
  })

  it("keeps the credit OUT of the title's ellipsis, as its own flex sibling", () => {
    // Not cosmetic. The cell is `nowrap` with `text-overflow: ellipsis`, and a
    // trailing span is the first thing that eats — so on a narrow page the two
    // Nutcracker Suites, whose titles are character-identical after the merge,
    // would render as the same row twice pointing at two different URLs.
    // The title truncates and the credit does not, which is a layout fact jsdom
    // cannot measure; what IS assertable is the structure that produces it.
    const { container } = renderTable([work({ arrangerName: 'Stokowski', arrangementType: 'arr. by' })])

    const pair = container.querySelector('.archive-work')
    expect(pair).toBeTruthy()
    // The title gives way (it carries the truncating class), the credit is a
    // sibling rather than trailing text inside it.
    expect(pair?.querySelector('.archive-work-title')?.textContent).toBe('Symphony No. 5')
    expect(pair?.querySelector('.archive-work-credit')?.textContent).toContain('Stokowski')
    expect(pair?.querySelector('.archive-work-title .archive-work-credit')).toBeNull()
  })

  it('counts the performances', () => {
    renderTable([
      work({
        performances: [performance('2012-03-15'), performance('2018-04-22')],
      }),
    ])

    expect(screen.getByRole('gridcell', { name: '2' })).toBeTruthy()
  })
})

describe('WorksTable — the column set (AWK-67)', () => {
  afterEach(cleanup)

  it('renders the narrow default as Work + Performances', () => {
    // Period inherits from the composer and reads the same on nearly every row of
    // a page; Forms is empty on 104 works. So these are the two that go.
    renderTable([work()], WORK_COLUMNS.narrow)

    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Work', 'Performances'])
  })

  it('leaves a hidden column OUT OF THE COLLECTION rather than merely out of sight', () => {
    // `Performances` is a single unbreakable token 115px wide and no cell value
    // drives it — a `display: none` cell would still cost that width under
    // `table-layout: fixed`, which is the overflow this ticket is about.
    renderTable([work()], ['work', 'performances'])

    expect(screen.queryByText('Romantic')).toBeNull()
    expect(screen.getAllByRole('gridcell')).toHaveLength(1)
  })

  it('keeps the title a real link when every other column is hidden', () => {
    // Why columns.ts refuses to hide Work: a composer page is the only page
    // linking its work pages.
    renderTable([work()], ['work'])

    expect(screen.getByRole('link', { name: 'Symphony No. 5' }).getAttribute('href')).toBe(
      '/concerts/composers/beethoven-ludwig-van/works/symphony-no-5/'
    )
  })

  it('offers no sorting at all — that is the concerts index only (AWK-71)', () => {
    // Rows arrive title-ascending from the route, which is the order the page was
    // prerendered in. A header saying it sorts when nothing reads a sort key would
    // be a control that does nothing.
    renderTable([work()])

    for (const header of screen.getAllByRole('columnheader')) {
      expect(header.hasAttribute('aria-sort')).toBe(false)
    }
  })
})
