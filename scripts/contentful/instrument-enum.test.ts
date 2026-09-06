import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { readParserAlias, readParserEnum } from './parse-archive-source'

/**
 * Guards the one controlled list in this pipeline that lives in two places on
 * purpose: `soloist.instrument`'s `in` validation, and `parse_archive.py`'s
 * `ENUM`, which the parser uses to recognise a credit segment as a Credited
 * role. Contentful enforces `in` at PUBLISH time, so a value in one list and
 * not the other is written and then left unpublished with nothing reporting it
 * — AWK-69 found that the expensive way, in both directions at once.
 *
 * WHAT THIS CAN AND CANNOT CATCH. It asserts the parser against the committed
 * declaration in archive-schema.json's `pinnedFields`, so it catches the two
 * lists moving apart in this repo. It CANNOT see the live space: no test here
 * makes a network call, and a CMA token must never reach CI (ADR-0002). The
 * declaration-vs-live half is `migrate_schema.py --dry-run`, run by hand, which
 * reports the pinned field as drift when the space disagrees. Do not read a
 * green run here as proof the space matches.
 */
type PinnedField = {
  id: string
  type: string
  validations?: { in?: string[]; size?: { max?: number } }[]
  items?: { type: string; validations?: { in?: string[] }[] }
}

const schema = JSON.parse(readFileSync(join(import.meta.dirname, 'archive-schema.json'), 'utf8')) as {
  pinnedFields: { id: string; fields: PinnedField[] }[]
}

const instrument = schema.pinnedFields
  .find((group) => group.id === 'soloist')
  ?.fields.find((field) => field.id === 'instrument')
if (!instrument) throw new Error('archive-schema.json pins no soloist.instrument')

// Deliberately read from `items`, not the field. The field is an Array, its own
// `validations` carry only `size`, and the `in` lives one level down — which is
// how AWK-69 came to believe the field was unconstrained.
const declared = instrument.items?.validations?.find((v) => v.in)?.in ?? []

const ENUM = readParserEnum()
const ALIAS = readParserAlias()

describe("parse_archive.py's ENUM against archive-schema.json — AWK-73", () => {
  it('reads a real list from both sides', () => {
    // Non-vacuity only. The count itself is pinned once, in
    // archive-schema.test.ts, so extending the enum bumps one number, not two.
    expect(declared.length).toBeGreaterThan(40)
    expect(ENUM.length).toBeGreaterThan(40)
  })

  it('equals the declaration, in the same order', () => {
    // Order is asserted, not just membership: the `in` list is what the
    // Contentful editor shows in its dropdown, and both lists are ordered by
    // instrument family rather than alphabet for that reason.
    expect(ENUM).toEqual(declared)
  })

  it('keeps each late addition beside its family, not in alphabetical order', () => {
    // The six adjacencies AWK-69, AWK-74 and AWK-86 chose. `toEqual` above would
    // pass if both lists were re-sorted alphabetically together; this would not.
    const after = (value: string, predecessor: string) =>
      expect(declared.indexOf(value), `${value} directly after ${predecessor}`).toBe(declared.indexOf(predecessor) + 1)
    after('Piccolo', 'Flute')
    after('Organ', 'Piano')
    after('Bass-Baritone', 'Baritone')
    after('Bass Trombone', 'Trombone')
    // AWK-86: the two functions sit with `Director`, `Narrator`, `Soloist` at
    // the tail, where the list keeps the roles that are not instruments or
    // voices — not under D and F among the instruments.
    after('Dancer', 'Soloist')
    after('Filmmaker', 'Dancer')
    // And the family ordering is what keeps these two look-alikes apart in the
    // dropdown: a `Baritone Saxophone` next to `Baritone` invites the wrong click.
    expect(Math.abs(declared.indexOf('Baritone Saxophone') - declared.indexOf('Baritone'))).toBeGreaterThan(1)
  })

  it('holds no duplicate, in either copy', () => {
    expect(new Set(declared).size).toBe(declared.length)
    expect(new Set(ENUM).size).toBe(ENUM.length)
  })

  describe('ALIAS is a spelling map into ENUM, not a part of it', () => {
    // `cello` -> `Violoncello`. The keys are what the spreadsheet writes; the
    // values are what reaches Contentful. So every value must be publishable
    // and no key may be, or the alias would be a second spelling of one thing.
    const entries = Object.entries(ALIAS)

    it('is non-empty, so the two checks below are not vacuous', () => {
      expect(entries.length).toBeGreaterThan(0)
    })

    it('maps every alias onto a value in ENUM', () => {
      for (const [sheet, canonical] of entries) expect(ENUM, `${sheet} -> ${canonical}`).toContain(canonical)
    })

    it('never uses an ENUM value as an alias key', () => {
      for (const [sheet] of entries) expect(ENUM, `${sheet} is canonical, not an alias`).not.toContain(sheet)
    })

    it("never shadows an ENUM value under the parser's own normalisation", () => {
      // The check above is nearly free to pass: keys are sheet spellings in
      // lowercase and ENUM is Title Case. The parser does not compare
      // verbatim. It builds ENUM_LOOKUP from norm(value) and then lets
      // norm(alias key) OVERWRITE it, so an alias whose key normalises like an
      // ENUM value but points somewhere else — `{"alto": "Contralto"}` — would
      // silently redirect every `Alto` credit. Re-derived here in TypeScript,
      // like period-and-forms.test.ts re-derives its seed's mapping.
      //
      // `mezzo soprano` and `mezzo-soprano` both normalise like
      // `Mezzo-Soprano` and map to it, so they are redundant and harmless, and
      // this passes them: the hazard is a different target, not a same one.
      const norm = (value: string) =>
        value
          .normalize('NFKD')
          .replace(/\p{M}/gu, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, ' ')
          .trim()
      const canonical = new Map(ENUM.map((value) => [norm(value), value]))

      for (const [sheet, target] of entries) {
        const shadowed = canonical.get(norm(sheet))
        if (shadowed) expect(target, `${sheet} would redirect ${shadowed}`).toBe(shadowed)
      }
    })
  })
})
