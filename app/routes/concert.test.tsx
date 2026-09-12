import { cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'

import type { Concert as ConcertRecord, ProgramEntry } from '../lib/archive'
import Concert from './concert'

/**
 * AWK-68's half of the render path: the Credit strings reaching a page at all.
 *
 * The sweep is tested in app/lib/archive.test.ts; what is worth asserting HERE is
 * the shape ADR-0006's amendment chose over the AWK-60 column — a stacked list in
 * the flow of the row — and the one thing that shape can silently get wrong,
 * which is emitting an empty container on the 306 of 429 published pairs with no
 * Credits at all.
 *
 * Loader data is passed BY HAND, per the note in vite.config.ts: the reactRouter
 * plugin is omitted under Vitest, so a route module is an ordinary component and
 * nothing supplies its props. `MemoryRouter` is needed because the programme
 * table links each work to its composer-nested address.
 */
const item = (over: Partial<ProgramEntry> = {}): ProgramEntry => ({
  id: 'pi-1',
  order: 1,
  label: 'Symphony No. 5',
  workId: 'wrk-fifth',
  workSlug: 'symphony-no-5-in-c-minor',
  composerSlug: 'beethoven-ludwig-van',
  composerName: 'Beethoven, Ludwig van',
  arrangerName: null,
  arrangementType: null,
  conductorName: 'Nicholas Armstrong',
  conductorIsOwn: false,
  credits: [],
  ...over,
})

const record = (program: ProgramEntry[]): ConcertRecord => ({
  id: 'cnc-1',
  slug: '1993-07-26',
  date: '1993-07-26',
  hall: 'Walt Whitman Hall',
  hallLocation: 'Brooklyn College',
  conductor: 'Nicholas Armstrong',
  orchestras: [{ name: 'Brooklyn Symphony Orchestra', abbreviation: 'BSO' }],
  program,
  recordings: [],
})

function renderConcert(program: ProgramEntry[]) {
  const props = { loaderData: { concert: record(program) } } as unknown as React.ComponentProps<typeof Concert>
  const { container } = render(
    <MemoryRouter>
      <Concert {...props} />
    </MemoryRouter>
  )
  return container
}

/** Every Credit line on the page, in document order. */
const creditLines = (container: HTMLElement) => [...container.querySelectorAll('tbody li')].map((li) => li.textContent)

describe('/concerts/:date credits (AWK-68)', () => {
  afterEach(cleanup)

  it('prints the Credit the archive has held all along', () => {
    // pi-19930726-12. Willis Huang has been linked since AWK-59 and `grep -c` on
    // the built page returned 0 until this ticket.
    const container = renderConcert([item({ credits: ['Willis Huang, Violin'] })])

    expect(creditLines(container)).toEqual(['Willis Huang, Violin'])
  })

  it('stacks each Credit on its own line, in the stored order', () => {
    // Unsorted: `3 Genii:` heads the names beneath it and the Ambassador line
    // continues the one above, so array order is the only legible order.
    const credits = ['3 Genii:', 'Thomas Jennings, Treble', 'Seth Abrams, Treble', '-Ambassador of The Netherlands']
    const container = renderConcert([item({ credits })])

    expect(creditLines(container)).toEqual(credits)
  })

  it('renders an Ensemble and an accompanist with no branch of its own', () => {
    // 2006-05-17 bills an Ensemble in a Soloist's place and an accompanist who is
    // no Soloist link at all. Both are just strings here — the whole point of
    // resolving neither content type.
    //
    // NOT 1993-07-26, which the AWK-68 brief named for this and which cannot
    // show it: that concert's ensemble items (pi-19930726-15/16/17) carry links
    // and no `credits` at all, and its ten `Janine Carstein, Accompanist` items
    // are every one of them in `satOut`. Seven items in the space hold a link
    // with no Credit, so ADR-0006's "links but no credit = 0" does not hold
    // outside the parser's graph.
    const container = renderConcert([
      item({ credits: ['Grace Choral Society of Brooklyn', 'Janine Carstein, Accompanist'] }),
    ])

    expect(creditLines(container)).toEqual(['Grace Choral Society of Brooklyn', 'Janine Carstein, Accompanist'])
  })

  it('emits nothing at all for an item with no Credits', () => {
    // The common case, and the one that has to stay byte-for-byte what it was:
    // no empty list, no placeholder, no stray element to space the row out.
    const container = renderConcert([item()])

    expect(container.querySelectorAll('tbody li')).toHaveLength(0)
    expect(container.querySelectorAll('tbody ul')).toHaveLength(0)
  })

  it('keeps the Credits inside the work’s own cell, adding no column', () => {
    // The AWK-60 conductor precedent deliberately does NOT transfer: a Credit is
    // one to fourteen names, so it hangs under the work rather than widening the
    // table. A fourteen-credit row must have the same cell count as a bare one.
    const fourteen = Array.from({ length: 14 }, (_, i) => `Singer ${i + 1}, Soprano`)
    const container = renderConcert([item({ credits: fourteen }), item({ id: 'pi-2', order: 2 })])

    const [loaded, bare] = [...container.querySelectorAll('tbody tr')]
    expect(loaded.querySelectorAll('td')).toHaveLength(bare.querySelectorAll('td').length)
    expect(creditLines(container)).toHaveLength(14)
    // Under the work, not under the composer or the number.
    expect(loaded.querySelectorAll('td')[2].querySelectorAll('li')).toHaveLength(14)
  })

  it('leaves the work title a link with the Credits beneath it', () => {
    const container = renderConcert([item({ credits: ['Willis Huang, Violin'] })])

    const link = container.querySelector('tbody a')
    expect(link?.textContent).toBe('Symphony No. 5')
    expect(link?.getAttribute('href')).toBe('/concerts/composers/beethoven-ludwig-van/works/symphony-no-5-in-c-minor/')
  })
})
