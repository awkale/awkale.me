import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { RouterProvider } from 'react-aria-components'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { SearchEntry } from '../lib/archive'
import { PER_KIND } from '../lib/search'
import { SiteSearch } from './site-search'

/**
 * AWK-41's header field. The ranking rules are asserted without a DOM in
 * app/lib/search.test.ts; what is worth testing HERE is the wiring that the
 * pure module cannot see:
 *
 *   - the index is NOT loaded until someone interacts, on all ~600 pages
 *   - results are real anchors, so cmd-click and "open in new tab" work
 *   - those anchors route client-side rather than reloading the document
 *
 * The third one is a contract with app/root.tsx, which owns the React Aria
 * RouterProvider. Removing it there would not fail this file — it is asserted
 * here so the expected behaviour is at least written down next to the component
 * that depends on it.
 */
const INDEX: SearchEntry[] = [
  { kind: 'project', title: 'Agent A', detail: 'dv01', path: '/projects/agent-a/' },
  { kind: 'composer', title: 'Sibelius, Jean', detail: '4 works', path: '/concerts/composers/sibelius-jean/' },
  {
    kind: 'work',
    title: 'Finlandia',
    detail: 'Sibelius, Jean',
    path: '/concerts/composers/sibelius-jean/works/finlandia/',
  },
  { kind: 'concert', title: '2019-12-15', detail: 'Symphony Hall · Nelsons', path: '/concerts/2019-12-15/' },
]

function renderSearch(index: SearchEntry[] = INDEX) {
  const loadIndex = vi.fn(() => Promise.resolve(index))
  const navigate = vi.fn()

  render(
    <MemoryRouter>
      <RouterProvider navigate={navigate}>
        <SiteSearch loadIndex={loadIndex} />
      </RouterProvider>
    </MemoryRouter>
  )

  const field = screen.getByRole('combobox')
  return { loadIndex, navigate, field }
}

async function search(field: HTMLElement, query: string) {
  field.focus()
  fireEvent.change(field, { target: { value: query } })
  // The listbox only appears once the imported index has resolved into state.
  await screen.findByRole('listbox')
}

describe('SiteSearch', () => {
  afterEach(cleanup)

  it('renders a named search field', () => {
    const { field } = renderSearch()

    expect(field.getAttribute('aria-label')).toBe('Search awkale.me')
  })

  it('does NOT touch the index on mount — that is the whole point of deferring it', () => {
    // This component renders on every one of ~600 prerendered pages. Loading the
    // index here would put ~50 KB on all of them for the people who never search.
    const { loadIndex } = renderSearch()

    expect(loadIndex).not.toHaveBeenCalled()
  })

  it('loads the index on first interaction, once, however many interactions follow', async () => {
    const { loadIndex, field } = renderSearch()

    field.focus()
    await waitFor(() => expect(loadIndex).toHaveBeenCalled())

    fireEvent.blur(field)
    field.focus()
    fireEvent.change(field, { target: { value: 'sib' } })

    expect(loadIndex).toHaveBeenCalledTimes(1)
  })

  it('renders each result as a real anchor at the slash-ful path', async () => {
    // Anchors are what make cmd-click, middle-click and "copy link address"
    // work. A listbox that only responds to selection has none of that.
    const { field } = renderSearch()
    await search(field, 'finlandia')

    const hit = await screen.findByRole('option', { name: /Finlandia/ })

    expect(hit.tagName).toBe('A')
    expect(hit.getAttribute('href')).toBe('/concerts/composers/sibelius-jean/works/finlandia/')
  })

  it('navigates client-side instead of reloading the document', async () => {
    const { navigate, field } = renderSearch()
    await search(field, 'finlandia')

    const hit = await screen.findByRole('option', { name: /Finlandia/ })
    fireEvent.pointerDown(hit, { pointerType: 'mouse', button: 0, pointerId: 1 })
    fireEvent.pointerUp(hit, { pointerType: 'mouse', button: 0, pointerId: 1 })
    fireEvent.click(hit, { detail: 1 })

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/concerts/composers/sibelius-jean/works/finlandia/', undefined)
    )
  })

  it('groups results by kind so a case study never sorts among 322 works', async () => {
    const { field } = renderSearch()
    await search(field, 'a')

    const headings = [...document.querySelectorAll('[role="group"] header')].map((h) => h.textContent)

    expect(headings.some((h) => h?.includes('Projects'))).toBe(true)
    expect(headings.some((h) => h?.includes('Works'))).toBe(true)
  })

  it('reports the true match count in a capped group, so the heading cannot lie', async () => {
    const crowded: SearchEntry[] = Array.from({ length: 20 }, (_, i) => ({
      kind: 'work',
      title: `Etude No. ${i + 1}`,
      detail: 'Chopin, Frederic',
      path: `/concerts/composers/chopin-frederic/works/etude-${i + 1}/`,
    }))
    const { field } = renderSearch(crowded)
    await search(field, 'etude')

    expect(await screen.findAllByRole('option')).toHaveLength(PER_KIND)
    expect(document.querySelector('[role="group"] header')?.textContent).toContain('20')
  })

  it('prompts rather than listing the whole archive on an empty query', async () => {
    const { field } = renderSearch()
    field.focus()

    // 595 entries on focus is a phone book, not a search result.
    expect(await screen.findByText(/Search concerts, works, composers/i)).toBeTruthy()
    // NOT `queryAllByRole('option')`: React Aria wraps renderEmptyState in a
    // `role="option"` of its own, so the empty state itself counts as one. The
    // rows that would actually navigate are the anchors.
    expect(document.querySelectorAll('a[role="option"]')).toHaveLength(0)
    expect(screen.getByRole('listbox').getAttribute('data-empty')).toBe('true')
  })

  it('says so when nothing matches', async () => {
    const { field } = renderSearch()
    await search(field, 'zzzzz')

    expect(await screen.findByText(/No matches/i)).toBeTruthy()
  })

  it('keeps rows distinct when several share one path, as body-less projects all do', async () => {
    // NOT hypothetical. app/lib/archive.ts sends every project without a body to
    // `/projects/`, because there is no page of its own to send it to — so the
    // moment AWK-43 seeds the five projects, five index rows share one path.
    // Keying the collection on the path would collapse them into one row, or
    // worse, collide inside React Aria's collection. There are zero projects in
    // the space today, which is exactly why this needs a test rather than a look.
    const stubs: SearchEntry[] = [
      { kind: 'project', title: 'Agent A', detail: 'dv01', path: '/projects/' },
      { kind: 'project', title: 'Alpha Reports', detail: 'dv01', path: '/projects/' },
    ]
    const { field } = renderSearch(stubs)
    await search(field, 'a')

    const rows = await screen.findAllByRole('option')

    expect(rows.map((row) => row.textContent)).toEqual(['Agent Adv01', 'Alpha Reportsdv01'])
    expect(rows.every((row) => row.getAttribute('href') === '/projects/')).toBe(true)
  })
})
