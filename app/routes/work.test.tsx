import { cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'

import type { Performance, Work as WorkRecord } from '../lib/archive'
import Work from './work'

/**
 * AWK-68 on the work page, where the Credits hang off a performance rather than
 * a programme row — so the container is a spanning row beneath it, not a cell.
 *
 * The case that makes the spanning row worth asserting is the run: the Act II
 * _Carmen_ item belongs to two nights and both were played, so the same
 * nine-name cast renders twice, once under each date. Loader data is passed by
 * hand for the reason given in app/routes/concert.test.tsx.
 */
const performance = (over: Partial<Performance> = {}): Performance => ({
  date: '2007-05-20',
  slug: '2007-05-20',
  orchestra: 'BSO',
  conductor: 'Nicholas Armstrong',
  credits: [],
  ...over,
})

const record = (performances: Performance[]): WorkRecord => ({
  id: 'wrk-carmen-act-ii',
  slug: 'carmen-act-ii',
  title: 'Carmen, Act II',
  composerId: 'cmp-bizet',
  composerSlug: 'bizet-georges',
  composerName: 'Bizet, Georges',
  arrangerName: null,
  arrangementType: null,
  period: 'Romantic',
  periodIsOwn: false,
  forms: ['Opera'],
  performances,
})

function renderWork(performances: Performance[]) {
  const props = { loaderData: { work: record(performances) } } as unknown as React.ComponentProps<typeof Work>
  const { container } = render(
    <MemoryRouter>
      <Work {...props} />
    </MemoryRouter>
  )
  return container
}

const creditLines = (container: HTMLElement) => [...container.querySelectorAll('tbody li')].map((li) => li.textContent)

describe('/concerts/composers/:composer/works/:work credits (AWK-68)', () => {
  afterEach(cleanup)

  it('lists the Credits beneath the performance they belong to', () => {
    const container = renderWork([performance({ credits: ['Seth Abrams, Violin', 'Jessica Hull, Flute'] })])

    expect(creditLines(container)).toEqual(['Seth Abrams, Violin', 'Jessica Hull, Flute'])
  })

  it('spans the row rather than sitting in one of its cells', () => {
    // A cast is about the evening, not about the Conductor column it would
    // otherwise land in — and it has to span however many columns the header
    // declares, or a fourth column later leaves it silently short.
    const container = renderWork([performance({ credits: ['Nicholle Bittlingmeyer, Carmen'] })])

    const headers = container.querySelectorAll('thead th')
    const spanning = container.querySelector('tbody td[colspan]')
    expect(spanning?.getAttribute('colspan')).toBe(String(headers.length))
  })

  it('repeats a shared cast under every night of a run', () => {
    // The Act II Carmen item belongs to both nights, so both rows carry it. This
    // is the acceptance case that a naive "render it once under the table" would
    // pass the string check on and still get wrong.
    const cast = Array.from({ length: 9 }, (_, i) => `Singer ${i + 1}, Role ${i + 1}`)
    const container = renderWork([
      performance({ date: '2007-05-20', slug: '2007-05-20', credits: cast }),
      performance({ date: '2007-05-23', slug: '2007-05-23', credits: cast }),
    ])

    expect(creditLines(container)).toEqual([...cast, ...cast])
    expect(container.querySelectorAll('tbody td[colspan]')).toHaveLength(2)
  })

  it('adds no row for a performance with no Credits', () => {
    const container = renderWork([performance(), performance({ date: '2012-03-15', slug: '2012-03-15' })])

    expect(container.querySelectorAll('tbody tr')).toHaveLength(2)
    expect(container.querySelectorAll('tbody li')).toHaveLength(0)
  })

  it('keeps the date link on the performance row itself', () => {
    // The spanning row must not come between the date and its concert, nor
    // duplicate the link.
    const container = renderWork([performance({ credits: ['Nicholle Bittlingmeyer, Carmen'] })])

    const links = container.querySelectorAll('tbody a')
    expect(links).toHaveLength(1)
    expect(links[0].getAttribute('href')).toBe('/concerts/2007-05-20/')
  })
})
