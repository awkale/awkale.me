import { describe, expect, it } from 'vitest'

import { type ArchiveShape, assertInvariants, findViolations } from './invariants'

/**
 * The invariants Contentful cannot express, and the tests that prove each one
 * both fires and stays quiet.
 *
 * Every case here is drawn from a real shape in the space rather than invented,
 * because the failure these guard against is not "someone typed nonsense" — it is
 * two individually-valid links that are collectively absurd. A test built on
 * obviously-bad data would pass while the realistic case walked through.
 */
type Work = ArchiveShape['works'][number]
type Concert = ArchiveShape['concerts'][number]

/**
 * Works and concerts are given loosely and completed here, so a case states only
 * the fields its rule reads. Without that, adding `arrangerId` and
 * `arrangementType` under AWK-23 meant editing twelve slug cases that have
 * nothing to do with arrangers, and every future field would do the same.
 *
 * Concerts joined them under AWK-59, which added `date` and `orchestras` for the
 * program-item rule and broke eight satOut and recording cases that care about
 * neither — the exact tax this pattern exists to avoid.
 */
function shape(
  over: Partial<Omit<ArchiveShape, 'works' | 'concerts'>> & {
    works?: Partial<Work>[]
    concerts?: Partial<Concert>[]
  } = {}
): ArchiveShape {
  const { works, concerts, ...rest } = over
  return {
    composers: [],
    halls: [],
    conductors: [],
    projects: [],
    imageGroups: [],
    recordings: [],
    ...rest,
    concerts: (concerts ?? []).map((c) => ({
      id: '',
      date: null,
      orchestras: [],
      program: [],
      satOut: [],
      ...c,
    })),
    works: (works ?? []).map((w) => ({
      id: '',
      slug: '',
      composerId: null,
      arrangerId: null,
      arrangementType: null,
      ...w,
    })),
  }
}

const rules = (input: ArchiveShape) => findViolations(input).map((v) => v.rule)

describe('satOut ⊆ program (ADR-0006)', () => {
  it('accepts a sit-out that is on the programme', () => {
    const input = shape({
      concerts: [{ id: 'cnc-20040219', program: ['pi-20040219-1', 'pi-20040219-2'], satOut: ['pi-20040219-2'] }],
    })

    expect(findViolations(input)).toEqual([])
  })

  it('rejects a sit-out pointing at an item that was never on that programme', () => {
    // Unenforced this renders as a silently missing item rather than an error,
    // which is why ADR-0006 pushed it into the build.
    const input = shape({
      concerts: [{ id: 'cnc-20040219', program: ['pi-20040219-1'], satOut: ['pi-20070520-3'] }],
    })

    expect(rules(input)).toEqual(['satout-subset-of-program'])
  })

  it('reads the concert from the link owner, not the item id prefix', () => {
    // A run's second night carries the FIRST night's item ids — cnc-20070523
    // links pi-20070520-*. Anything inferring a date from the prefix flags all
    // twenty shared items as violations.
    const input = shape({
      concerts: [{ id: 'cnc-20070523', program: ['pi-20070520-1', 'pi-20070520-2'], satOut: ['pi-20070520-1'] }],
    })

    expect(findViolations(input)).toEqual([])
  })
})

describe('arranger needs a type (ADR-0005)', () => {
  it('accepts a work with neither, which is 593 of 625', () => {
    const input = shape({ works: [{ id: 'wrk-a', slug: 'symphony-no-2', composerId: 'cmp-sibelius-jean' }] })

    expect(findViolations(input)).toEqual([])
  })

  it('accepts a work carrying both', () => {
    const input = shape({
      works: [
        {
          id: 'wrk-the-nutcracker-suite-65bec1',
          slug: 'the-nutcracker-suite-ellington',
          composerId: 'cmp-tchaikovsky-pyotr-ilyich',
          arrangerId: 'cmp-ellington',
          arrangementType: 'Arrangement',
        },
      ],
    })

    expect(findViolations(input)).toEqual([])
  })

  it('rejects an arranger with no type, because the credit cannot be rendered', () => {
    const input = shape({
      works: [{ id: 'wrk-a', slug: 'pictures', composerId: 'cmp-mussorgsky-modest', arrangerId: 'cmp-ravel-maurice' }],
    })

    expect(rules(input)).toEqual(['arranger-needs-a-type'])
  })

  it('rejects a type with no arranger, which is the half that reads as harmless', () => {
    // This one has a verb and nobody to attach it to, so the credit silently
    // disappears from the page rather than rendering wrong — which is exactly
    // how it survives review.
    const input = shape({
      works: [{ id: 'wrk-a', slug: 'pictures', composerId: 'cmp-mussorgsky-modest', arrangementType: 'Orchestration' }],
    })

    expect(rules(input)).toEqual(['arranger-needs-a-type'])
  })
})

describe('(composer, slug) uniqueness (ADR-0008)', () => {
  it('accepts one slug held by two different composers', () => {
    // Sibelius's and Rachmaninoff's Symphony No. 2 both want `symphony-no-2`.
    // This is the exact case `unique: true` rejected and this assertion replaces:
    // space-wide it collides, composer-scoped it does not.
    const input = shape({
      works: [
        { id: 'wrk-a', slug: 'symphony-no-2', composerId: 'cmp-sibelius-jean' },
        { id: 'wrk-b', slug: 'symphony-no-2', composerId: 'cmp-rachmaninoff-sergei' },
      ],
    })

    expect(findViolations(input)).toEqual([])
  })

  it('rejects one slug held twice by the same composer', () => {
    const input = shape({
      works: [
        { id: 'wrk-a', slug: 'symphony-no-2', composerId: 'cmp-sibelius-jean' },
        { id: 'wrk-b', slug: 'symphony-no-2', composerId: 'cmp-sibelius-jean' },
      ],
    })

    expect(rules(input)).toEqual(['work-slug-unique-per-composer'])
  })

  it('keeps an arrangement apart from its original', () => {
    // Tchaikovsky's Nutcracker Suite against Ellington's — the sole real
    // (composer, work-slug) collision in the archive, which the unconditional
    // arranger suffix is what resolves.
    const input = shape({
      works: [
        { id: 'wrk-a', slug: 'the-nutcracker-suite', composerId: 'cmp-tchaikovsky-pyotr-ilyich' },
        { id: 'wrk-b', slug: 'the-nutcracker-suite-ellington', composerId: 'cmp-tchaikovsky-pyotr-ilyich' },
      ],
    })

    expect(findViolations(input)).toEqual([])
  })

  it('does not collapse works whose composer link is missing', () => {
    // Two composerless works are two unknowns, not one composer holding two
    // slugs. The archive has exactly two of these, and treating null as a key
    // would report a uniqueness violation that is really a data gap.
    const input = shape({
      works: [
        { id: 'wrk-music-of-love-interlude', slug: 'music-of-love-interlude', composerId: null },
        { id: 'wrk-various-chamber-music', slug: 'various-chamber-music', composerId: null },
      ],
    })

    expect(rules(input)).not.toContain('work-slug-unique-per-composer')
  })
})

describe('the hashed slug shape (ADR-0008)', () => {
  it('accepts a clean slug', () => {
    const input = shape({ works: [{ id: 'wrk-a', slug: 'festive-overture', composerId: 'cmp-shostakovich-dmitri' }] })

    expect(findViolations(input)).toEqual([])
  })

  it('rejects the composer-prefixed import shape', () => {
    const input = shape({
      works: [
        {
          id: 'wrk-festive-overture-814ca6',
          slug: 'shostakovich-dmitri--festive-overture-814ca6',
          composerId: 'cmp-shostakovich-dmitri',
        },
      ],
    })

    expect(rules(input)).toEqual(['work-slug-not-hashed'])
  })

  it('rejects a bare hash suffix with no composer prefix', () => {
    // ADR-0008 describes the shape as "`--` followed by six hex characters",
    // which matches NONE of the 625 live values — the real form is
    // `<composer>--<title>-<6hex>`. Both markers are checked separately so half
    // a hash cannot slip through either.
    const input = shape({ works: [{ id: 'wrk-a', slug: 'festive-overture-814ca6', composerId: 'cmp-a' }] })

    expect(rules(input)).toEqual(['work-slug-not-hashed'])
  })

  it('reports one violation per work, not one per marker', () => {
    const input = shape({
      works: [{ id: 'wrk-a', slug: 'shostakovich-dmitri--festive-overture-814ca6', composerId: 'cmp-a' }],
    })

    expect(findViolations(input)).toHaveLength(1)
  })
})

describe('a stored slug is trimmed (AWK-61)', () => {
  it('accepts a clean slug', () => {
    const input = shape({ works: [{ id: 'wrk-a', slug: 'festive-overture', composerId: 'cmp-a' }] })

    expect(findViolations(input)).toEqual([])
  })

  it('rejects the trailing space that took three steps to find', () => {
    // The live case, verbatim. `work-slug-not-hashed` cannot see it -- a space is
    // neither `--` nor six hex -- and Contentful's `unique` is satisfied by the
    // very thing that is wrong, since 'x ' and 'x' are two distinct values.
    const input = shape({
      works: [{ id: 'ZP4k1djlvR7XeCAHhqKEQ', slug: 'pomp-and-circumstance-march-no-1 ', composerId: 'cmp-a' }],
    })

    expect(rules(input)).toEqual(['slug-has-no-stray-whitespace'])
  })

  it('rejects a leading space too', () => {
    const input = shape({ works: [{ id: 'wrk-a', slug: ' festive-overture', composerId: 'cmp-a' }] })

    expect(rules(input)).toEqual(['slug-has-no-stray-whitespace'])
  })

  it('quotes the value so the space is legible in the message', () => {
    // The whole point of the rule. A detail reading `slug pomp-... has stray
    // whitespace` reproduces the original problem one layer up: the reader
    // still cannot see what is wrong with the value.
    const input = shape({ works: [{ id: 'wrk-a', slug: 'festive-overture ', composerId: 'cmp-a' }] })

    expect(findViolations(input)[0]?.detail).toContain('`festive-overture `')
  })

  it('stays quiet on an empty slug', () => {
    // archive.ts maps an absent slug to '', which trims to itself. An unset
    // field is a different problem and must not be reported as whitespace.
    const input = shape({ works: [{ id: 'wrk-a', slug: '', composerId: 'cmp-a' }] })

    expect(findViolations(input)).toEqual([])
  })

  it('leaves interior whitespace alone, which is the rule as written', () => {
    // `slug === slug.trim()` by decision, not oversight. An interior space
    // percent-encodes to %20 exactly as a trailing one does, so this is a known
    // gap rather than a passing case anyone should read as correct.
    const input = shape({ works: [{ id: 'wrk-a', slug: 'festive overture', composerId: 'cmp-a' }] })

    expect(findViolations(input)).toEqual([])
  })

  it('sweeps composer slugs, which address the other built route', () => {
    const input = shape({ composers: [{ id: 'cmp-elgar-edward', slug: 'elgar-edward ' }] })

    expect(findViolations(input)).toEqual([
      {
        rule: 'slug-has-no-stray-whitespace',
        entry: 'cmp-elgar-edward',
        detail: 'slug `elgar-edward ` has leading or trailing whitespace, which percent-encodes into its URL',
      },
    ])
  })

  it('sweeps project slugs', () => {
    const input = shape({ projects: [{ id: 'prj-a', slug: ' waterfall-ui', featuredRank: null, hasBody: true }] })

    expect(rules(input)).toEqual(['slug-has-no-stray-whitespace'])
  })

  it('sweeps hall and conductor slugs, which no route reads today', () => {
    // Neither addresses a page. They are swept anyway because the cost is one
    // entry in the list and the alternative is discovering, the next time
    // something does read them, that they were never checked.
    const input = shape({
      halls: [{ id: 'hal-wwh', slug: 'walt-whitman-hall ' }],
      conductors: [{ id: 'cnd-a', slug: ' willis-huang' }],
    })

    expect(rules(input)).toEqual(['slug-has-no-stray-whitespace', 'slug-has-no-stray-whitespace'])
  })

  it('reports the whitespace alongside the shape failure, not instead of it', () => {
    // Two independent things wrong with one field. Collapsing them would fix the
    // hash, rebuild, and find the space still there on the next run.
    const input = shape({
      works: [{ id: 'wrk-a', slug: 'elgar-edward--pomp-814ca6 ', composerId: 'cmp-a' }],
    })

    expect(rules(input).sort()).toEqual(['slug-has-no-stray-whitespace', 'work-slug-not-hashed'])
  })
})

describe('featuredRank (ADR-0003)', () => {
  it('accepts a ranked project that has a body', () => {
    const input = shape({ projects: [{ id: 'prj-a', slug: 'agent-a', featuredRank: 1, hasBody: true }] })

    expect(findViolations(input)).toEqual([])
  })

  it('accepts an unranked project with no body', () => {
    // Index-only is the normal state, not a violation: ADR-0003's central
    // property is that a stub graduates by filling one field.
    const input = shape({
      projects: [{ id: 'prj-a', slug: 'cision-report-builder', featuredRank: null, hasBody: false }],
    })

    expect(findViolations(input)).toEqual([])
  })

  it('rejects a rank on a project with no body', () => {
    // The home-page card would not click, because the page does not exist.
    const input = shape({ projects: [{ id: 'prj-a', slug: 'awkale-me', featuredRank: 2, hasBody: false }] })

    expect(rules(input)).toEqual(['featured-rank-requires-body'])
  })

  it('rejects two projects holding the same rank', () => {
    // AWK-31's amendment: one nullable field cannot disagree with itself, but
    // two entries can both hold rank 1, which restores the non-deterministic
    // home-page order the single field was chosen to prevent.
    const input = shape({
      projects: [
        { id: 'prj-a', slug: 'a', featuredRank: 1, hasBody: true },
        { id: 'prj-b', slug: 'b', featuredRank: 1, hasBody: true },
      ],
    })

    expect(rules(input)).toEqual(['featured-rank-distinct'])
  })

  it('does not treat two unranked projects as a duplicate rank', () => {
    const input = shape({
      projects: [
        { id: 'prj-a', slug: 'a', featuredRank: null, hasBody: false },
        { id: 'prj-b', slug: 'b', featuredRank: null, hasBody: false },
      ],
    })

    expect(findViolations(input)).toEqual([])
  })
})

describe("sideBySide's two-image limit (ADR-0004)", () => {
  it('accepts two images side by side', () => {
    const input = shape({
      imageGroups: [{ id: 'img-a', label: 'Before and after', layout: 'sideBySide', imageCount: 2 }],
    })

    expect(findViolations(input)).toEqual([])
  })

  it('rejects five', () => {
    // Authorable and always will be — Contentful cannot make an array's max
    // conditional on another field's value.
    const input = shape({ imageGroups: [{ id: 'img-a', label: 'Wizard', layout: 'sideBySide', imageCount: 5 }] })

    expect(rules(input)).toEqual(['side-by-side-two-images'])
  })

  it('leaves the other layouts alone', () => {
    // `grid` is the wizard's five-up and `fullWidth` is a single breakout; the
    // cap belongs to sideBySide only.
    const input = shape({
      imageGroups: [
        { id: 'img-a', label: 'Wizard', layout: 'grid', imageCount: 5 },
        { id: 'img-b', label: 'Hero', layout: 'fullWidth', imageCount: 1 },
      ],
    })

    expect(findViolations(input)).toEqual([])
  })
})

describe('a program item is one performance (AWK-59)', () => {
  /** The real shape: a run is one program played twice by one orchestra. */
  const run = [
    { id: 'cnc-20110408', date: '2011-04-08', orchestras: ['orc-bso'], program: ['pi-20110408-1'] },
    { id: 'cnc-20110410', date: '2011-04-10', orchestras: ['orc-bso'], program: ['pi-20110408-1'] },
  ]

  it('accepts a run — one program, two dates, one orchestra', () => {
    // 24 items in the space are exactly this, spanning 1 to 4 days. A rule that
    // flagged them would be worse than no rule: it would be turned off.
    expect(findViolations(shape({ concerts: run }))).toEqual([])
  })

  it('accepts an item on a single concert', () => {
    const input = shape({
      concerts: [{ id: 'cnc-20110408', date: '2011-04-08', orchestras: ['orc-bso'], program: ['pi-1'] }],
    })

    expect(findViolations(input)).toEqual([])
  })

  it('rejects an item shared across two orchestras', () => {
    // The case that prompted the rule: an Offenbach overture entered on a 2017
    // BSO concert, then reused on a 1992 LIYO one during hand entry.
    const input = shape({
      concerts: [
        { id: 'cnc-19920614', date: '1992-06-14', orchestras: ['orc-liyo'], program: ['pi-20170219-1'] },
        { id: 'cnc-20170219', date: '2017-02-19', orchestras: ['orc-bso'], program: ['pi-20170219-1'] },
      ],
    })

    const rules = findViolations(input).map((v) => v.rule)

    // Both fire, and they are genuinely independent — see the two cases below.
    expect(rules).toContain('program-item-one-orchestra')
    expect(rules).toContain('program-item-run-is-close')
    expect(findViolations(input)[0]?.entry).toBe('pi-20170219-1')
  })

  it('rejects a same-orchestra share too far apart to be a run', () => {
    // Orchestra alone is not enough. An orchestra replaying a work years later
    // is a new performance, with its own soloists and its own place in a program.
    const input = shape({
      concerts: [
        { id: 'cnc-20110408', date: '2011-04-08', orchestras: ['orc-bso'], program: ['pi-20110408-1'] },
        { id: 'cnc-20180408', date: '2018-04-08', orchestras: ['orc-bso'], program: ['pi-20110408-1'] },
      ],
    })

    expect(findViolations(input).map((v) => v.rule)).toEqual(['program-item-run-is-close'])
  })

  it('rejects a same-day share across two orchestras', () => {
    // And date alone is not enough either. Two orchestras on one day is a
    // shared bill, not one performance.
    const input = shape({
      concerts: [
        { id: 'cnc-a', date: '2011-04-08', orchestras: ['orc-bso'], program: ['pi-x'] },
        { id: 'cnc-b', date: '2011-04-08', orchestras: ['orc-bho'], program: ['pi-x'] },
      ],
    })

    expect(findViolations(input).map((v) => v.rule)).toEqual(['program-item-one-orchestra'])
  })

  it('holds at the 14-day boundary and fails past it', () => {
    const at = (date: string) => [
      { id: 'cnc-a', date: '2011-04-08', orchestras: ['orc-bso'], program: ['pi-x'] },
      { id: 'cnc-b', date, orchestras: ['orc-bso'], program: ['pi-x'] },
    ]

    expect(findViolations(shape({ concerts: at('2011-04-22') }))).toEqual([])
    expect(findViolations(shape({ concerts: at('2011-04-23') })).map((v) => v.rule)).toEqual([
      'program-item-run-is-close',
    ])
  })

  it('does not invent a span for undated concerts', () => {
    // Three concerts in the archive have no usable date. A missing date is not
    // evidence of a bad share, and guessing one would flag them all.
    const input = shape({
      concerts: [
        { id: 'cnc-a', date: null, orchestras: ['orc-bho'], program: ['pi-x'] },
        { id: 'cnc-b', date: null, orchestras: ['orc-bho'], program: ['pi-x'] },
      ],
    })

    expect(findViolations(input)).toEqual([])
  })

  it('reads the orchestra from the concert, not from the item id', () => {
    // invariants.ts:83's warning, as a test. A run's second night carries the
    // FIRST night's item ids, so cnc-20070523 legitimately links pi-20070520-*.
    // Any rule deriving a date from the id would flag all 24 good items.
    const input = shape({
      concerts: [
        { id: 'cnc-20070520', date: '2007-05-20', orchestras: ['orc-bso'], program: ['pi-20070520-1'] },
        { id: 'cnc-20070523', date: '2007-05-23', orchestras: ['orc-bso'], program: ['pi-20070520-1'] },
      ],
    })

    expect(findViolations(input)).toEqual([])
  })
})

describe('recording.programItem ⊆ recording.concert.program (ADR-0012)', () => {
  it('accepts an item that is on its concert programme', () => {
    const input = shape({
      concerts: [{ id: 'cnc-20221218', program: ['pi-20221218-3'], satOut: [] }],
      recordings: [
        {
          id: 'rec-a',
          label: 'Tchaikovsky Violin Concerto',
          concertId: 'cnc-20221218',
          programItemId: 'pi-20221218-3',
        },
      ],
    })

    expect(findViolations(input)).toEqual([])
  })

  it('accepts a whole-concert recording with no item', () => {
    // An empty programItem means the recording covers the whole concert.
    const input = shape({
      concerts: [{ id: 'cnc-20221218', program: ['pi-20221218-3'], satOut: [] }],
      recordings: [{ id: 'rec-a', label: 'Full concert', concertId: 'cnc-20221218', programItemId: null }],
    })

    expect(findViolations(input)).toEqual([])
  })

  it('rejects the Mexico-tour shape', () => {
    // The error ADR-0012 spends its longest section preventing: both links are
    // individually valid and the pair asserts that a 2020 Brooklyn Museum
    // performance happened at a 2022 concert.
    const input = shape({
      concerts: [
        { id: 'cnc-20221218', program: ['pi-20221218-3'], satOut: [] },
        { id: 'cnc-20200223', program: ['pi-20200223-3'], satOut: [] },
      ],
      recordings: [
        { id: 'rec-a', label: 'BSO Mexico 2020', concertId: 'cnc-20221218', programItemId: 'pi-20200223-3' },
      ],
    })

    expect(rules(input)).toEqual(['recording-item-on-concert-program'])
  })

  it('rejects a recording pointing at a concert that does not exist', () => {
    const input = shape({
      recordings: [{ id: 'rec-a', label: 'Orphan', concertId: 'cnc-19990101', programItemId: 'pi-19990101-1' }],
    })

    expect(rules(input)).toEqual(['recording-item-on-concert-program'])
  })

  it('lets one item carry several recordings', () => {
    // The Tchaikovsky was published twice — first movement alone and complete —
    // and both are pi-20221218-3. The pair MUST stay non-unique.
    const input = shape({
      concerts: [{ id: 'cnc-20221218', program: ['pi-20221218-3'], satOut: [] }],
      recordings: [
        { id: 'rec-a', label: 'I. Allegro', concertId: 'cnc-20221218', programItemId: 'pi-20221218-3' },
        { id: 'rec-b', label: 'Complete', concertId: 'cnc-20221218', programItemId: 'pi-20221218-3' },
      ],
    })

    expect(findViolations(input)).toEqual([])
  })
})

describe('assertInvariants', () => {
  it('says nothing when the space is clean', () => {
    expect(() => assertInvariants(shape())).not.toThrow()
  })

  it('reports every violation at once rather than the first', () => {
    // A build that fails on one violation at a time costs one full CDA sweep per
    // fix. The message is the whole report.
    const input = shape({
      concerts: [{ id: 'cnc-a', program: [], satOut: ['pi-nowhere'] }],
      projects: [{ id: 'prj-a', slug: 'a', featuredRank: 1, hasBody: false }],
    })

    expect(() => assertInvariants(input)).toThrow(/satout-subset-of-program[\s\S]*featured-rank-requires-body/)
  })

  it('names the offending entry, since the fix happens in Contentful', () => {
    const input = shape({ concerts: [{ id: 'cnc-20040219', program: [], satOut: ['pi-20070520-3'] }] })

    expect(() => assertInvariants(input)).toThrow(/cnc-20040219/)
  })
})
