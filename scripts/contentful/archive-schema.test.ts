import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Guards archive-schema.json — the desired archive schema AWK-30 applies to
 * Contentful.
 *
 * WHAT THIS CAN AND CANNOT CATCH. It restates the vocabularies the ADRs decided,
 * so it catches a typo, a dropped value, a reordering, and any later edit that
 * quietly widens a controlled list. It cannot catch a wrong *decision* — if
 * ADR-0007 picked the wrong nine periods, this test agrees with it enthusiastically.
 * It is a drift guard on a spec artifact, in the same spirit as app/tokens.css.
 *
 * It asserts the FILE, not the space. Nothing here proves the migration ran:
 * that needs a CMA token, and ADR-0002 forbids one reaching CI. AWK-39's build
 * assertions are what will eventually check the live data.
 */
const schema = JSON.parse(readFileSync(join(import.meta.dirname, 'archive-schema.json'), 'utf8')) as Schema

type Field = {
  id: string
  name: string
  type: string
  linkType?: string
  required: boolean
  localized: boolean
  validations?: { unique?: boolean; in?: string[]; linkContentType?: string[] }[]
  items?: {
    type: string
    linkType?: string
    validations?: { in?: string[]; linkContentType?: string[] }[]
  }
}

type Schema = {
  types: { id: string; addFields: Field[] }[]
  gated: { id: string; flag: string; contentType: string; field: string; blockedBy: string }[]
}

function field(typeId: string, fieldId: string): Field {
  const group = schema.types.find((t) => t.id === typeId)
  if (!group) throw new Error(`no content type ${typeId} in archive-schema.json`)
  const found = group.addFields.find((f) => f.id === fieldId)
  if (!found) throw new Error(`no field ${typeId}.${fieldId} in archive-schema.json`)
  return found
}

function inList(f: Field): string[] | undefined {
  return f.validations?.find((v) => v.in)?.in ?? f.items?.validations?.find((v) => v.in)?.in
}

// IMSLP's vocabulary, adopted verbatim by ADR-0007. Order is IMSLP's own, which
// is chronological rather than alphabetical, and is kept because the ADR quotes
// it that way.
const PERIODS = [
  'Ancient',
  'Medieval',
  'Renaissance',
  'Baroque',
  'Classical',
  'Romantic',
  'Early 20th century',
  'Modern',
  'Jazz',
]

describe('archive-schema.json', () => {
  it('declares every field AWK-30 exists to create, and no others', () => {
    const declared = schema.types.flatMap((t) => t.addFields.map((f) => `${t.id}.${f.id}`))

    expect(declared.sort()).toEqual(
      [
        'composer.period',
        'composer.slug',
        'concert.attended',
        'concert.satOut',
        'conductor.slug',
        'programItem.conductor',
        'season.orchestras',
        'work.arrangementOf',
        'work.arrangementType',
        'work.arranger',
        'work.forms',
        'work.period',
      ].sort()
    )
  })

  it('adds nothing required, so existing published entries stay valid', () => {
    // This is the property that makes the migration safe to run against a space
    // holding 1,228 archive records. One `required: true` would invalidate every
    // entry of that type at once.
    const required = schema.types.flatMap((t) => t.addFields.filter((f) => f.required).map((f) => `${t.id}.${f.id}`))

    expect(required).toEqual([])
  })

  it('puts no explanation in a field name', () => {
    // The name is the label alone. It is what every entry picker, reference row
    // and validation message shows, so a parenthetical reads badly in all three
    // and duplicates guidance that has a proper home.
    //
    // That home is help text, which this file CANNOT set -- Contentful keeps it
    // on the editor interface, not the content type. So this asserts the half
    // that is checkable and the top-level `note` records the half that is not.
    const named = schema.types.flatMap((t) => t.addFields.map((f) => `${t.id}.${f.id}: ${f.name}`))

    // Non-vacuity: an empty list would pass this loop silently.
    expect(named.length).toBeGreaterThan(0)
    for (const entry of named) expect(entry, 'explanation belongs in help text').not.toMatch(/[()]/)
  })

  it('leaves work.genre alone', () => {
    // ADR-0007 retires `genre`, but only AFTER the genre -> forms data migration
    // in AWK-37. A `genre` entry appearing in this file would mean someone had
    // brought a destructive change forward into the schema-only ticket.
    const touched = schema.types.flatMap((t) => t.addFields.map((f) => f.id))

    expect(touched).not.toContain('genre')
  })

  describe('period — ADR-0007', () => {
    it("takes IMSLP's nine values verbatim, on both composer and work", () => {
      expect(inList(field('composer', 'period'))).toEqual(PERIODS)
      expect(inList(field('work', 'period'))).toEqual(PERIODS)
    })

    it("spells `Early 20th century` with IMSLP's lowercase c", () => {
      // Called out because it is the one value a reasonable person would
      // "correct" to `Early 20th Century`, and doing so breaks AWK-37's seed
      // match against the wiki's category strings — silently, by matching nothing.
      expect(PERIODS).toContain('Early 20th century')
      expect(inList(field('work', 'period'))).not.toContain('Early 20th Century')
    })

    it('is a plain Symbol on both, so the work value can override the composer', () => {
      expect(field('composer', 'period').type).toBe('Symbol')
      expect(field('work', 'period').type).toBe('Symbol')
    })
  })

  describe('forms — ADR-0007', () => {
    const forms = field('work', 'forms')

    it('is a multi-valued tag set, which is the whole repair', () => {
      // The single-valued `genre` got the choice wrong ~15 times by answering
      // "whichever form word appeared first in the title". Array is the fix.
      expect(forms.type).toBe('Array')
      expect(forms.items?.type).toBe('Symbol')
    })

    it('carries the 17 existing genre names plus ADR-0007s 8 additions', () => {
      expect(inList(forms)).toEqual([
        'Aria',
        'Ballet',
        'Cantata',
        'Capriccio',
        'Chamber work',
        'Concerto',
        'Concerto Grosso',
        'Dance',
        'Excerpt',
        'Fantasia',
        'Film music',
        'March',
        'Mass',
        'Oratorio',
        'Overture',
        'Prelude',
        'Rhapsody',
        'Serenade',
        'Sonata',
        'Song cycle',
        'Suite',
        'Symphony',
        'Tone Poem',
        'Variations',
        'Waltz',
      ])
    })

    it('keeps every one of the 17 live genre entry names', () => {
      // Sourced from bso-graph.json's `genre` type. Dropping one here would
      // strand its assignments when AWK-37 migrates genre -> forms, and the loss
      // would show up as works quietly losing a tag rather than as an error.
      const live = [
        'Aria',
        'Ballet',
        'Cantata',
        'Concerto',
        'Concerto Grosso',
        'Fantasia',
        'March',
        'Mass',
        'Overture',
        'Prelude',
        'Rhapsody',
        'Serenade',
        'Sonata',
        'Suite',
        'Symphony',
        'Variations',
        'Waltz',
      ]

      expect(live).toHaveLength(17)
      expect(inList(forms)).toEqual(expect.arrayContaining(live))
    })

    it('holds the 8 additions with ADR-0007s exact casing', () => {
      // `Song cycle`, `Chamber work` and `Film music` carry a lowercase second
      // word in the ADR while `Tone Poem` does not. Inconsistent, and verbatim.
      expect(inList(forms)).toEqual(
        expect.arrayContaining([
          'Tone Poem',
          'Dance',
          'Song cycle',
          'Oratorio',
          'Excerpt',
          'Capriccio',
          'Chamber work',
          'Film music',
        ])
      )
    })
  })

  describe('the gated steps', () => {
    const { gated } = schema as unknown as {
      gated: {
        id: string
        contentType: string
        field: string
        blockedBy: string
        why: string[]
        removeValidation?: string
        setRequired?: boolean
      }[]
    }

    it('holds the four gated steps, and nothing else', () => {
      // This is the only mechanism in the repo that takes a guarantee AWAY from
      // a production space, or adds one that can invalidate an entry. A gate
      // appearing here that nobody expected means the mechanism was widened
      // past what it was built for.
      expect(gated.map((g) => g.id).sort()).toEqual([
        'drop-season-number-unique',
        'drop-work-slug-unique',
        'require-composer-slug',
        'require-work-slug',
      ])
    })

    it('gives every gate exactly one operation', () => {
      // `removeValidation` loosens, `setRequired` tightens. A gate declaring
      // both, or neither, is one the applier cannot dispatch.
      for (const gate of gated) {
        const ops = [gate.removeValidation, gate.setRequired].filter((o) => o !== undefined)
        expect(ops, `${gate.id} needs one operation`).toHaveLength(1)
      }
    })

    it('requires a slug only where one addresses a page', () => {
      // ADR-0008 stores slugs rather than deriving them, so an empty one is a
      // record with no address. That is true of work and composer, which build
      // /concerts/composers/{composer}/works/{work}, and of nothing else.
      //
      // conductor.slug is deliberately absent: all 39 lack one, because
      // backfill_slugs.py names it under NOT IN SCOPE — the conductor facet is
      // a query-string filter, not a route. Requiring it would invalidate every
      // conductor for a field nothing reads.
      const required = gated.filter((g) => g.setRequired).map((g) => `${g.contentType}.${g.field}`)

      expect(required.sort()).toEqual(['composer.slug', 'work.slug'])
    })

    it('names the assertion that has to exist first, for each', () => {
      // ADR-0008's ordering: the replacement assertion is written BEFORE the
      // constraint is dropped, 'otherwise there is a window in which nothing
      // protects the invariant at all'.
      for (const gate of gated) {
        expect(gate.blockedBy.trim(), `${gate.id} needs a blockedBy`).not.toBe('')
        // The reasoning is the load-bearing part: this is the one mechanism in
        // the repo that removes a constraint from a production space.
        expect(gate.why.join(' ').length, `${gate.id} needs a real why`).toBeGreaterThan(200)
      }
    })

    it('does not drop unique from season.label', () => {
      // The label is the stronger of the two guards — it is what stops two
      // seasons reading identically in an entry picker, which is the problem
      // AWK-59 opened with. Only `number` is composite-scoped.
      const seasonGates = gated.filter((g) => g.contentType === 'season')

      expect(seasonGates.map((g) => g.field)).toEqual(['number'])
    })
  })

  describe('orchestras — AWK-59', () => {
    const orchestras = field('season', 'orchestras')

    it('is a list of links, because a Season straddles a renaming', () => {
      // Season 5 opens at the Music Society on 1977-10-25 and closes at the
      // Heights Orchestra from 1977-12-17. A single Link would force a false
      // answer for it, and there is no third option: the numbering belongs to
      // the institution, which outlived two of its own names.
      //
      // One case, not two. Season 28 looks like a second against the live
      // space, where its 2001-05-24 concert is mislinked to BSO — see
      // `knownLiveErrors` in season-orchestras.json.
      expect(orchestras.type).toBe('Array')
      expect(orchestras.items?.type).toBe('Link')
      expect(orchestras.items?.linkType).toBe('Entry')
    })

    it('accepts orchestra entries and nothing else', () => {
      expect(orchestras.items?.validations).toEqual([{ linkContentType: ['orchestra'] }])
    })

    it('is not unique, because Contentful cannot express the constraint that matters', () => {
      // The real invariant is (institution, number), which is composite. Contentful
      // offers space-wide uniqueness only — the same wall ADR-0008 hit with
      // (composer, slug). It is enforced in season-orchestras.test.ts instead, and
      // deliberately NOT in the build: `season` is not in loadArchive() and ADR-0006
      // keeps it that way.
      expect(orchestras.validations).toEqual([])
    })
  })

  describe('conductor — AWK-60', () => {
    const conductor = field('programItem', 'conductor')

    it('is a single link, because one item is conducted by one person', () => {
      // `concert.conductor` is also a single Link and stays that way. The split
      // this field records is BETWEEN items, not within one — on 2022-12-18
      // Armstrong took two items and Tristan the Tchaikovsky.
      expect(conductor.type).toBe('Link')
      expect(conductor.linkType).toBe('Entry')
    })

    it('accepts conductor entries and nothing else', () => {
      expect(conductor.validations).toEqual([{ linkContentType: ['conductor'] }])
    })

    it('is optional, because empty is the value 807 of 819 items carry', () => {
      // Null means "the concert's conductor", resolved in app/lib/archive.ts.
      // Required would force the concert's conductor to be copied onto every
      // item — the same value in two places, free to drift, and 819 writes to
      // record something already recorded once per concert.
      expect(conductor.required).toBe(false)
    })
  })

  describe('slug — ADR-0008', () => {
    it('keeps unique on composer, as the honorific guard', () => {
      // The slug rule strips `Sir` and `Dame`, so a future `Sir X` alongside an
      // existing `X` derives the same slug and is rejected at publish — instead
      // of silently shipping a second half-empty composer page, which is what
      // Walton and Sullivan already did.
      expect(field('composer', 'slug').validations).toContainEqual({ unique: true })
    })

    it('keeps unique on conductor too', () => {
      // The ticket table omits `unique` here; ADR-0008's schema table specifies
      // it. The ADR wins — it is the spec, and two real conductors sharing a name
      // being blocked at 37 records is the same guard working.
      expect(field('conductor', 'slug').validations).toContainEqual({ unique: true })
    })

    it('does not add a slug to work, which already has one', () => {
      // work.slug is repurposed in place — its 625 hashed values overwritten —
      // not created. Adding it would fail against the live type.
      const workFields = schema.types.find((t) => t.id === 'work')?.addFields ?? []

      expect(workFields.map((f) => f.id)).not.toContain('slug')
    })
  })

  describe('arrangements — ADR-0005', () => {
    it('links the arranger to composer rather than storing a string', () => {
      // Six of the 23 in-scope arrangers already exist as composers. A string
      // would leave Ravel-the-arranger unconnected to Ravel-the-composer.
      const arranger = field('work', 'arranger')

      expect(arranger.type).toBe('Link')
      expect(arranger.linkType).toBe('Entry')
      expect(arranger.validations).toContainEqual({ linkContentType: ['composer'] })
    })

    it('keeps all four verbs distinct', () => {
      // Flattening these puts a factual error on the page: Ravel's Pictures is an
      // orchestration and Mauceri's Psycho selections are an edition, not
      // arrangements. This corrects the old project glossary.
      expect(inList(field('work', 'arrangementType'))).toEqual([
        'Arrangement',
        'Orchestration',
        'Transcription',
        'Edition',
      ])
    })

    it('points arrangementOf at another work', () => {
      const of = field('work', 'arrangementOf')

      expect(of.type).toBe('Link')
      expect(of.validations).toContainEqual({ linkContentType: ['work'] })
    })
  })

  describe('participation — ADR-0006', () => {
    it('makes attended a Boolean with three meaningful states', () => {
      // true published, false missed, UNSET not-his-history. Which is why it must
      // not be required: unset is a value, and the 119 pre-tenure entries rely on
      // it. The `required: false` sweep above is what enforces that.
      expect(field('concert', 'attended').type).toBe('Boolean')
      expect(field('concert', 'attended').required).toBe(false)
    })

    it('hangs satOut off concert, not programItem', () => {
      // Twenty programItems are shared across fourteen concerts by seven
      // two-night runs. A flag on the item cannot tell night one from night two,
      // and sit-outs genuinely differ between nights.
      const satOut = field('concert', 'satOut')

      expect(satOut.type).toBe('Array')
      expect(satOut.items?.linkType).toBe('Entry')
      expect(satOut.items?.validations).toContainEqual({
        linkContentType: ['programItem'],
      })
    })
  })

  describe('the work.slug gate', () => {
    it('keeps removing unique out of the default run', () => {
      // ADR-0008: "Write the assertion before removing unique: true. Otherwise
      // there is a window in which nothing protects the invariant at all." That
      // assertion is AWK-39, which AWK-30 blocks — so this cannot be a default.
      const gate = schema.gated.find((g) => g.id === 'drop-work-slug-unique')

      expect(gate).toBeDefined()
      expect(gate?.flag).toBe('--drop-work-slug-unique')
      expect(gate?.contentType).toBe('work')
      expect(gate?.field).toBe('slug')
      expect(gate?.blockedBy).toBe('AWK-39')
    })
  })
})
