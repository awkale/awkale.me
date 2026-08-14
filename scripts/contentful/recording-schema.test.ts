import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Guards recording-schema.json — the `recording` content type AWK-32 creates,
 * specified by ADR-0012.
 *
 * WHAT THIS CAN AND CANNOT CATCH. It restates ADR-0012's schema table, so it
 * catches a typo, a dropped field, a widened controlled list, and any later edit
 * that quietly relaxes a restriction carrying a decision. It cannot catch a wrong
 * *decision* — if ADR-0012 picked the wrong five fields, this test agrees with it
 * enthusiastically. Drift guard on a spec artifact, same spirit as
 * archive-schema.test.ts and portfolio-schema.test.ts.
 *
 * It asserts the FILE, not the space. Nothing here proves the type was created:
 * that needs a CMA token, and ADR-0002 forbids one reaching CI.
 *
 * It also cannot reach the invariant this type most needs — `programItem` must
 * belong to `concert.program`, which is a fact about ENTRIES and not about the
 * schema. See `the invariant Contentful cannot hold` at the bottom: all this file
 * can do is assert that the schema does not pretend to hold it.
 */
const schema = JSON.parse(readFileSync(join(import.meta.dirname, 'recording-schema.json'), 'utf8')) as Schema

type Validation = {
  unique?: boolean
  in?: string[]
  size?: { min?: number; max?: number }
  linkContentType?: string[]
  regexp?: { pattern: string; flags?: string | null }
}

type Field = {
  id: string
  name: string
  type: string
  linkType?: string
  required: boolean
  localized: boolean
  validations?: Validation[]
  items?: {
    type: string
    linkType?: string
    validations?: Validation[]
  }
}

type Schema = {
  createTypes: { id: string; name: string; description?: string; displayField: string; fields: Field[] }[]
  deferredInvariants: { id: string; assertedBy: string; harness: string; why: string[] }[]
  deliberateAbsences: { id: string; why: string[] }[]
  beyondTheRecord: string[]
}

function type(typeId: string) {
  const found = schema.createTypes.find((t) => t.id === typeId)
  if (!found) throw new Error(`no content type ${typeId} in recording-schema.json`)
  return found
}

function field(fieldId: string): Field {
  const found = type('recording').fields.find((f) => f.id === fieldId)
  if (!found) throw new Error(`no field recording.${fieldId} in recording-schema.json`)
  return found
}

function inList(f: Field): string[] | undefined {
  return f.validations?.find((v) => v.in)?.in ?? f.items?.validations?.find((v) => v.in)?.in
}

function linkTargets(f: Field): string[] | undefined {
  return f.validations?.find((v) => v.linkContentType)?.linkContentType
}

// Contentful's own URL pattern, verbatim from a content type authored in the web
// app — the same constant portfolio-schema.test.ts pins for liveUrl and repoUrl.
// Matching it exactly is what makes the web app render `url` as its built-in URL
// match rather than an opaque custom regexp.
const URL_PATTERN = '^(ftp|http|https):\\/\\/(\\w+:{0,1}\\w*@)?(\\S+)(:[0-9]+)?(\\/|\\/([\\w#!:.?+=&%@!\\-/]))?$'

describe('recording-schema.json', () => {
  it('creates exactly the one type ADR-0012 specifies', () => {
    expect(schema.createTypes.map((t) => t.id)).toEqual(['recording'])
  })

  describe('recording — ADR-0012s schema table', () => {
    it('declares the five fields, in the records order', () => {
      expect(type('recording').fields.map((f) => f.id)).toEqual(['url', 'label', 'kind', 'concert', 'programItem'])
    })

    it('takes label as its display field', () => {
      // Not `url`. A list of entries titled by URL is unreadable in the web app,
      // and `label` exists precisely because the source titles are inconsistent
      // enough that a human has to write the link text anyway.
      expect(type('recording').displayField).toBe('label')
      expect(field('label').type).toBe('Symbol')
      expect(field('label').required).toBe(true)
    })

    it('requires everything except programItem', () => {
      // `programItem` empty is not a missing value — it MEANS the recording covers
      // the whole concert rather than one item. Requiring it would delete
      // ADR-0012s concert-level case, which is the only thing that renders a
      // recording under the program rather than beside a date.
      const required = type('recording')
        .fields.filter((f) => f.required)
        .map((f) => f.id)

      expect(required).toEqual(['url', 'label', 'kind', 'concert'])
      expect(field('programItem').required).toBe(false)
    })

    it('keeps url unique, because the URL is the canonical key', () => {
      // ADR-0012: the one place in this project where `unique: true` is safe on
      // first use, after it bit ADR-0004, ADR-0005 and ADR-0008. Safe because the
      // thing being constrained is an address that genuinely cannot repeat, not a
      // slug that only looks like one.
      expect(field('url').validations).toContainEqual({ unique: true })
    })

    it("URL-validates url with Contentful's own pattern", () => {
      // NOT in ADR-0012's table — see `beyondTheRecord` in the JSON. Asserted here
      // so the addition is visible and reversible rather than folklore.
      expect(field('url').validations).toContainEqual({
        regexp: { pattern: URL_PATTERN, flags: null },
      })
    })

    it('offers exactly the two kinds, lowercase', () => {
      // Stored values a component switches on, not display strings — which is why
      // they are not Title Case like `period` and `forms`.
      expect(inList(field('kind'))).toEqual(['video', 'audio'])
      expect(field('kind').required).toBe(true)
    })

    it('links concert to a concert entry and requires it', () => {
      // The load-bearing field. A recording is a fact about an OCCASION, which is
      // why it cannot hang off `work` (that would say "a recording of this piece
      // exists") or off `programItem` alone (the seven two-date programs share one
      // Program Item set, so it would attach one nights recording to both nights).
      const concert = field('concert')

      expect(concert.type).toBe('Link')
      expect(concert.linkType).toBe('Entry')
      expect(concert.required).toBe(true)
      expect(linkTargets(concert)).toEqual(['concert'])
    })

    it('links programItem to a programItem entry and leaves it optional', () => {
      const item = field('programItem')

      expect(item.type).toBe('Link')
      expect(item.linkType).toBe('Entry')
      expect(item.required).toBe(false)
      expect(linkTargets(item)).toEqual(['programItem'])
    })
  })

  describe('the deliberate absences', () => {
    it('names both, with reasoning', () => {
      expect(schema.deliberateAbsences.map((a) => a.id).sort()).toEqual(['no-date-field', 'no-unique-on-the-pair'])

      for (const absence of schema.deliberateAbsences) {
        expect(absence.why.join(' ').length).toBeGreaterThan(0)
      }
    })

    it('carries no date field, which derives from the concert', () => {
      // The trap this guards is specific and was hit in curation: the RSS feed
      // hands you a <published> per video and it is the WRONG date. The
      // Tchaikovsky was published 2023-04-01 for a 2022-12-18 performance, and the
      // Nimrod from the same concert 2023-06-14 — nearly six months out. A `date`
      // field would have captured the publish date on both, silently.
      expect(type('recording').fields.map((f) => f.id)).not.toContain('date')
    })

    it('leaves the (concert, programItem) pair non-unique', () => {
      // Load-bearing absence. One Program Item legitimately holds several
      // recordings — the BSO published the Tchaikovsky Violin Concerto twice, as a
      // single movement and complete, and both are pi-20221218-3. A `unique` on
      // either link would make the second video unpublishable.
      for (const id of ['concert', 'programItem']) {
        expect(field(id).validations ?? []).not.toContainEqual({ unique: true })
      }
    })
  })

  describe('the invariant Contentful cannot hold', () => {
    it('names the sixth one, and hands it to a build assertion', () => {
      expect(schema.deferredInvariants.map((i) => i.id)).toEqual(['program-item-belongs-to-concert'])
      expect(schema.deferredInvariants[0].assertedBy).toBe('AWK-39')
    })

    it('does not pretend the schema holds it', () => {
      // `recording.programItem` must belong to `recording.concert.program`, and
      // Contentful validates a field against a literal but never against another
      // field. So both links can be individually valid while the pair is nonsense.
      //
      // This asserts the only thing a schema test can: that neither link carries a
      // validation implying the check happens here. A future reader who adds one
      // has not fixed the invariant — they have hidden it.
      const targets = [linkTargets(field('concert')), linkTargets(field('programItem'))]

      expect(targets).toEqual([['concert'], ['programItem']])
      expect(field('programItem').validations).toHaveLength(1)
    })
  })
})
