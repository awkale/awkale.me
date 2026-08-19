import { describe, expect, it } from 'vitest'

import { arrangerCredit, byline, formatDate, times } from './format'

/**
 * The display helpers. `byline` carries the weight here: until AWK-23 the
 * arranger reached the page inside the composer's contaminated filing name, and
 * cleaning those names made this function the only thing rendering the credit.
 */
describe('byline', () => {
  it('renders a composer with no arranger unchanged', () => {
    expect(byline({ composer: 'Prokofiev, Sergei' })).toBe('Prokofiev, Sergei')
  })

  it('renders each of ADR-0005 four verbs distinctly', () => {
    // NOT four words for one thing. Flattening them to `arr.` puts a factual
    // error on 12 of the 25 arranged pages — which is why this is a table rather
    // than one representative case.
    const cases = [
      ['Arrangement', 'Tchaikovsky, Pyotr Ilyich', 'Ellington', 'Tchaikovsky, Pyotr Ilyich, arr. Ellington'],
      ['Orchestration', 'Mussorgsky, Modest', 'Ravel', 'Mussorgsky, Modest, orch. Ravel'],
      ['Transcription', 'Mahler, Gustav', 'Roven', 'Mahler, Gustav, trans. Roven'],
      ['Edition', 'Herrmann, Bernard', 'Mauceri', 'Herrmann, Bernard, ed. Mauceri'],
    ] as const

    for (const [arrangementType, composer, arranger, expected] of cases) {
      expect(byline({ composer, arranger, arrangementType })).toBe(expected)
    }
  })

  it('separates the two Nutcracker Suites, which is the whole point', () => {
    // 2019-12-15 carries both. Identical titles, identical composer after the
    // merge — the credit is the only thing left distinguishing the rows.
    const original = byline({ composer: 'Tchaikovsky, Pyotr Ilyich' })
    const ellington = byline({
      composer: 'Tchaikovsky, Pyotr Ilyich',
      arranger: 'Ellington',
      arrangementType: 'Arrangement',
    })

    expect(original).not.toBe(ellington)
  })

  it('falls back to arr. when a type is missing rather than dropping the name', () => {
    // A backstop, not a supported shape: `arranger-needs-a-type` fails the build
    // first. An imprecise verb beats a credit that silently vanishes.
    expect(byline({ composer: 'Chopin, Frederic', arranger: 'Douglas' })).toBe('Chopin, Frederic, arr. Douglas')
  })

  it('ignores a type it does not recognise rather than printing it raw', () => {
    expect(byline({ composer: 'Bizet, Georges', arranger: 'Guiraud', arrangementType: 'Reduction' })).toBe(
      'Bizet, Georges, arr. Guiraud'
    )
  })

  it('does not walk the prototype for a type that names an Object member', () => {
    // `VERBS['constructor']` is a function, and interpolating it yields
    // `function Object() { [native code] } Ravel`.
    for (const arrangementType of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      expect(byline({ composer: 'Mussorgsky, Modest', arranger: 'Ravel', arrangementType })).toBe(
        'Mussorgsky, Modest, arr. Ravel'
      )
    }
  })

  it('drops the credit entirely when a type arrives with no arranger', () => {
    expect(byline({ composer: 'Ravel, Maurice', arrangementType: 'Orchestration' })).toBe('Ravel, Maurice')
  })
})

describe('arrangerCredit', () => {
  it('returns just the arranger half, for the work page link split', () => {
    expect(arrangerCredit({ arranger: 'Ravel', arrangementType: 'Orchestration' })).toBe('orch. Ravel')
  })

  it('returns null with no arranger, so the caller renders nothing', () => {
    expect(arrangerCredit({ arranger: null, arrangementType: null })).toBeNull()
  })

  it('agrees with byline, which is built on it', () => {
    const credit = arrangerCredit({ arranger: 'Doppler', arrangementType: 'Orchestration' })

    expect(byline({ composer: 'Liszt, Franz', arranger: 'Doppler', arrangementType: 'Orchestration' })).toBe(
      `Liszt, Franz, ${credit}`
    )
  })
})

describe('formatDate', () => {
  it('turns an ISO date into a readable one without a leading zero', () => {
    expect(formatDate('2012-03-05')).toBe('5 Mar 2012')
  })

  it('reads December as the twelfth month, not off the end', () => {
    expect(formatDate('2019-12-15')).toBe('15 Dec 2019')
  })
})

describe('times', () => {
  it('words the first two counts and numbers the rest', () => {
    expect(times(1)).toBe('once')
    expect(times(2)).toBe('twice')
    expect(times(3)).toBe('3 times')
  })
})
