import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Guards merge-composers.json — the decisions AWK-23's migration executes.
 *
 * WHAT THIS CAN AND CANNOT CATCH. The declaration deliberately holds only what
 * cannot be derived from the space: the four verbs, the two arrangement pairs,
 * and the scope thresholds. Everything else — which 25 records are contaminated,
 * what their canonical targets are, which arrangers already exist — is computed
 * live by merge_composers.py, because ADR-0005 establishes that resolving those
 * from a remembered shape silently misses exactly the three records holding
 * hand-curated dates.
 *
 * So this catches a widened verb list, a mangled entry id, a scope threshold
 * edited to make an abort go away. It cannot catch a wrong decision, and it
 * asserts the FILE rather than the space — proving the migration ran needs a CMA
 * token, and ADR-0002 forbids one reaching CI.
 */
const declaration = JSON.parse(readFileSync(join(import.meta.dirname, 'merge-composers.json'), 'utf8')) as Declaration

type Declaration = {
  arrangementTypes: Record<string, string | string[]>
  arrangementOf: {
    note: string[]
    pairs: { arrangement: string; original: string; why: string }[]
  }
  scopeGuard: Record<string, number | string[] | Record<string, number>>
  correctionsToAdr0005: string[]
}

describe('merge-composers.json', () => {
  describe('the four verbs', () => {
    it('maps each marker the source writes to its ADR-0005 symbol', () => {
      // Not four words for one thing. Ravel ORCHESTRATED Pictures, Roven
      // TRANSCRIBED Kindertotenlieder, Mauceri EDITED the Psycho selections —
      // flattening these to `Arrangement` puts a factual error on 12 of 25 pages.
      const { note: _note, ...verbs } = declaration.arrangementTypes

      expect(verbs).toEqual({
        'arr.': 'Arrangement',
        'orch.': 'Orchestration',
        'trans.': 'Transcription',
        'ed.': 'Edition',
      })
    })

    it('matches the vocabulary archive-schema.json puts on the field', () => {
      // Two files, one vocabulary. The schema declares what Contentful will
      // accept; this declares what the migration writes. A value here that the
      // `in` validation rejects fails at write time, 25 entries deep.
      const schema = JSON.parse(readFileSync(join(import.meta.dirname, 'archive-schema.json'), 'utf8')) as {
        types: { id: string; addFields: { id: string; validations?: { in?: string[] }[] }[] }[]
      }

      const work = schema.types.find((t) => t.id === 'work')
      const field = work?.addFields.find((f) => f.id === 'arrangementType')
      const allowed = field?.validations?.find((v) => v.in)?.in

      const { note: _note, ...verbs } = declaration.arrangementTypes
      expect(allowed).toBeDefined()
      expect([...Object.values(verbs)].sort()).toEqual([...(allowed ?? [])].sort())
    })
  })

  describe('the two arrangement pairs', () => {
    it('holds exactly the two the archive has both halves of', () => {
      // Data, never detection. `work` is otherwise one entry per (composer,
      // title) throughout, so a same-title matcher would find nothing here and
      // would false-link the moment a genuine second setting is added.
      expect(declaration.arrangementOf.pairs).toHaveLength(2)
    })

    it('points each arrangement at its original, never the reverse', () => {
      const { pairs } = declaration.arrangementOf

      expect(pairs).toContainEqual(
        expect.objectContaining({
          arrangement: 'wrk-the-nutcracker-suite-65bec1',
          original: 'wrk-the-nutcracker-suite-c5dabb',
        })
      )
      expect(pairs).toContainEqual(
        expect.objectContaining({
          arrangement: 'wrk-kindertotenlieder-59801d',
          original: 'wrk-kindertotenlieder-5aa6c1',
        })
      )
    })

    it('never names the same entry on both sides', () => {
      for (const pair of declaration.arrangementOf.pairs) {
        expect(pair.arrangement).not.toBe(pair.original)
      }
    })

    it('records that one original is pre-tenure and has no page', () => {
      // ADR-0005's landmine: Kindertotenlieder's original is substrate, present
      // in Contentful and deliberately not surfaced. Any UI following the link
      // must tolerate a target with no route.
      expect(declaration.arrangementOf.note.join(' ')).toMatch(/pre-tenure/i)
    })
  })

  describe('the scope guard', () => {
    it('pins the in-scope counts ADR-0005 established', () => {
      expect(declaration.scopeGuard.inScopeConcerts).toBe(127)
      expect(declaration.scopeGuard.inScopeProgramItems).toBe(384)
      expect(declaration.scopeGuard.inScopeWorks).toBe(348)
    })

    it('takes 25 of the 37 contaminated records and leaves 12 alone', () => {
      // The other 12 are pre-tenure. Four of them are a different pattern
      // entirely — a bare `(arr.)` naming nobody, where the arranger IS the
      // filed composer of traditional material and there is nothing to merge
      // toward. A sweep over every `arr. by` match is wrong.
      const inScope = declaration.scopeGuard.inScopeContaminated
      const archiveWide = declaration.scopeGuard.contaminatedArchiveWide

      expect(inScope).toBe(25)
      expect(archiveWide).toBe(37)
      expect((archiveWide as number) - (inScope as number)).toBe(12)
    })

    it('accepts the completed state as well as the pending one', () => {
      // A migration that aborts on its own past work teaches the operator to
      // reach for --force, which disables the guard that actually matters. The
      // two contamination counts therefore have two valid readings; the three
      // structural counts have one, because this migration creates and destroys
      // no concert, program item or work.
      expect(declaration.scopeGuard.afterMigration).toEqual({
        inScopeContaminated: 0,
        contaminatedArchiveWide: 12,
      })
    })

    it('leaves the 12 pre-tenure records contaminated once it has run', () => {
      const after = declaration.scopeGuard.afterMigration as Record<string, number>

      expect(after.contaminatedArchiveWide).toBe(
        (declaration.scopeGuard.contaminatedArchiveWide as number) -
          (declaration.scopeGuard.inScopeContaminated as number)
      )
    })

    it('explains that scope is tenure and not attendance', () => {
      // Reading scope as `attended === true` drops the 6 concerts Alex missed,
      // which are still his history, and finds only 17 of the 25 records.
      expect(declaration.scopeGuard.note).toEqual(expect.arrayContaining([expect.stringMatching(/attended/i)]))
    })
  })

  describe('the corrections to ADR-0005', () => {
    it('records that nineteen arrangers are created, not seventeen', () => {
      // The ADR counts Respighi twice — once for Rossini, once for Rachmaninoff
      // — which is six links but four people. AWK-23's own list has all 19 names.
      expect(declaration.correctionsToAdr0005.join(' ')).toMatch(/NINETEEN arrangers/)
    })

    it('records that Herrmann and Weill already have clean records', () => {
      const text = declaration.correctionsToAdr0005.join(' ')

      expect(text).toMatch(/FIVE canonical records/)
      expect(text).toMatch(/cmp-herrmann-bernard/)
      expect(text).toMatch(/cmp-weill-kurt/)
    })

    it('keeps the ADR net figure of 24 creates against 25 deletes', () => {
      expect(declaration.correctionsToAdr0005.join(' ')).toMatch(/24 against 25 deletes/)
    })
  })
})
