import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Guards `period-and-forms.json` — AWK-37's decisions — against
 * `archive-schema.json`'s vocabularies and against `imslp-harvest.json`, the
 * derived half it layers over.
 *
 * The split this protects is the one ADR-0007 depends on. IMSLP is a SEED, not
 * a dependency: the harvest is regenerable and disposable, the decisions are
 * not, and the applier reads both. So the failure this file exists to catch is
 * a decision that has quietly become a derivation — a period restated from the
 * wiki, an alias for a name the fold already settles — because a second copy of
 * a derivable fact is a second thing to drift.
 *
 * It also re-derives in TypeScript what `seed_period_and_forms.py` derives in
 * Python, which is the same deliberate double-entry `season-orchestras.test.ts`
 * uses: two routes to one answer, so a bug shows up as a disagreement rather
 * than as a confidently wrong migration.
 *
 * What it CANNOT check is whether `Sibelius` should read Romantic or Early 20th
 * century. Those five are judgement calls on a browse filter and a test that
 * asserted them would only be restating the file back to itself.
 */

const here = import.meta.dirname
const decisions = JSON.parse(readFileSync(join(here, 'period-and-forms.json'), 'utf8')) as Decisions
const harvest = JSON.parse(readFileSync(join(here, 'imslp-harvest.json'), 'utf8')) as Harvest
const schema = JSON.parse(readFileSync(join(here, 'archive-schema.json'), 'utf8')) as Schema

/** Plan files in this directory carry a `note` inside each object. It is prose, not a key. */
function entries<T>(record: Record<string, T>): [string, T][] {
  return Object.entries(record).filter(([key]) => key !== 'note')
}

interface Decisions {
  composerAliases: Record<string, string | null>
  composerPeriods: Record<string, string>
  workPeriods: Record<string, { title: string; period: string; why: string }>
  genreForms: Record<string, string[]>
  excerptRule: { pattern: string; form: string }
  workForms: Record<string, { title: string; forms: string[] }>
  formCategories: Record<string, string>
  guards: Record<string, number>
}

interface Harvest {
  counts: Record<string, number | string[]>
  composers: Record<
    string,
    { sortName: string; imslpPage: string | null; eras: string[]; canonicalName: string | null }
  >
  works: Record<string, { title: string; imslpPage: string | null; styles: string[]; forms: string[] }>
  unmatched: { sortName: string; candidates: string[] }[]
}

interface Schema {
  types: {
    id: string
    addFields: {
      id: string
      type: string
      validations?: { in?: string[] }[]
      items?: { validations?: { in?: string[] }[] }
    }[]
  }[]
}

/** The `in` list a field is actually constrained to, read from the applied schema. */
function vocabulary(typeId: string, fieldId: string): string[] {
  const type = schema.types.find((candidate) => candidate.id === typeId)
  const field = type?.addFields.find((candidate) => candidate.id === fieldId)
  const validations = field?.items?.validations ?? field?.validations ?? []
  return validations.find((validation) => validation.in)?.in ?? []
}

const PERIODS = vocabulary('work', 'period')
const FORMS = vocabulary('work', 'forms')

describe('the vocabularies are the schema’s, not a second copy', () => {
  it('reads nine periods and twenty-five forms out of archive-schema.json', () => {
    // If this fails the schema moved, and every `in` assertion below is
    // asserting against the wrong list rather than failing individually.
    expect(PERIODS).toHaveLength(9)
    expect(FORMS).toHaveLength(25)
  })

  it('constrains composer.period to the same nine values as work.period', () => {
    // ADR-0007 inherits work period from composer period, so a value legal on
    // one and not the other would be a period no work could ever override.
    expect(vocabulary('composer', 'period')).toEqual(PERIODS)
  })

  it('keeps IMSLP’s casing on `Early 20th century`', () => {
    // archive-schema.json's own note flags this: the seed compares against the
    // wiki's category strings, so capitalising `Century` silently stops matching.
    expect(PERIODS).toContain('Early 20th century')
    expect(PERIODS).not.toContain('Early 20th Century')
  })
})

describe('every declared period is a legal one', () => {
  it.each(entries(decisions.composerPeriods))('composer %s -> %s', (_name, period) => {
    expect(PERIODS).toContain(period)
  })

  it.each(entries(decisions.workPeriods))('work %s -> %s', (_id, row) => {
    expect(PERIODS).toContain(row.period)
  })
})

describe('every declared form is a legal one', () => {
  it.each(entries(decisions.genreForms))('genre %s maps into the vocabulary', (_name, forms) => {
    for (const form of forms) expect(FORMS).toContain(form)
  })

  it.each(entries(decisions.formCategories))('IMSLP category %s -> %s', (_category, form) => {
    expect(FORMS).toContain(form)
  })

  it('derives Excerpt, which is in the vocabulary', () => {
    expect(FORMS).toContain(decisions.excerptRule.form)
  })
})

describe('the retired genre vocabulary survives the migration', () => {
  it('names all seventeen genre entries', () => {
    // ADR-0007 seeds `forms` from the seventeen `genre` NAMES. A missing key is
    // silent data loss: works carrying that genre would migrate to no form.
    expect(entries(decisions.genreForms)).toHaveLength(17)
  })

  it('maps sixteen of the seventeen to themselves', () => {
    const identity = entries(decisions.genreForms).filter(([name, forms]) => forms.length === 1 && forms[0] === name)
    expect(identity).toHaveLength(16)
  })

  it('maps Aria to nothing, because that bucket is the thing being repaired', () => {
    // ADR-0007: the bucket holds 13 works and about four are arias. Carrying the
    // name over would migrate the error rather than the data, so the genuine
    // ones are named individually in workForms instead.
    expect(decisions.genreForms.Aria).toEqual([])
    const arias = entries(decisions.workForms).filter(([, row]) => row.forms.includes('Aria'))
    expect(arias).toHaveLength(6)
  })
})

describe('the composer decisions do not restate what the fold already settles', () => {
  it('gives every alias a period, or a page, and never leaves one dangling', () => {
    for (const [sortName, page] of entries(decisions.composerAliases)) {
      if (page === null) {
        // Checked-and-absent. Something has to supply the period instead.
        expect(decisions.composerPeriods, `${sortName} is absent from IMSLP and needs a hand period`).toHaveProperty(
          sortName
        )
      } else {
        expect(typeof page).toBe('string')
      }
    }
  })

  it('hand-assigns a period only where the harvest cannot', () => {
    // The guard against decisions silently becoming derivations. A composer with
    // exactly one harvested era needs no hand period — except the five the wiki
    // files under two, and those resolve to one era each only after this file
    // chooses, so they are legitimately here.
    const harvestedEras = new Map(Object.values(harvest.composers).map((row) => [row.sortName, row.eras] as const))
    const redundant = entries(decisions.composerPeriods).filter(([sortName]) => {
      const eras = harvestedEras.get(sortName)
      return eras?.length === 1
    })
    expect(redundant).toEqual([])
  })

  it('resolves each of the five two-era composers exactly once', () => {
    const twoEras = Object.values(harvest.composers).filter((row) => row.eras.length > 1)
    expect(twoEras).toHaveLength(5)
    for (const { sortName, eras } of twoEras) {
      expect(decisions.composerPeriods, `${sortName} is filed under two eras and must be settled`).toHaveProperty(
        sortName
      )
      // Whatever was chosen must be one of the two the wiki actually names.
      expect(eras, `${sortName} was settled as a period IMSLP does not file it under`).toContain(
        decisions.composerPeriods[sortName]
      )
    }
  })

  it('leaves no in-scope composer without a period', () => {
    // The claim the report makes — 153 of 153. A composer with neither a
    // harvested era nor a hand period renders an em dash on its own page.
    const unresolved = Object.values(harvest.composers).filter(
      (row) => row.eras.length !== 1 && !(row.sortName in decisions.composerPeriods)
    )
    expect(unresolved.map((row) => row.sortName)).toEqual([])
  })
})

describe('the work curations address real rows', () => {
  it('names only works the harvest also saw, with the titles they were written against', () => {
    for (const [id, row] of entries(decisions.workForms)) {
      expect(harvest.works, `${id} is not an in-scope work`).toHaveProperty(id)
      expect(harvest.works[id].title, `${id} was written against a different title`).toBe(row.title)
    }
  })

  it('assigns only forms in the vocabulary, and never an empty set', () => {
    // An empty array is not "no opinion" — it is a row that will never write,
    // which the worksheet already expresses by omission. Keeping the two apart
    // stops a half-finished edit from looking like a decision.
    for (const [id, row] of entries(decisions.workForms)) {
      expect(row.forms.length, `${id} has an empty forms array; delete the row instead`).toBeGreaterThan(0)
      for (const form of row.forms) expect(FORMS).toContain(form)
    }
  })

  it('holds the 28 migration repairs, and no rows with duplicate forms', () => {
    const rows = entries(decisions.workForms)
    expect(rows).toHaveLength(28)
    for (const [id, row] of rows) {
      expect(new Set(row.forms).size, `${id} repeats a form`).toBe(row.forms.length)
    }
  })

  it('still repairs the 16 ballets ADR-0007 counted', () => {
    const ballets = entries(decisions.workForms).filter(([, row]) => row.forms.includes('Ballet'))
    expect(ballets).toHaveLength(16)
  })

  it('carries the one work needing two forms as a single row', () => {
    // The reason the shape changed. Under the old form-keyed buckets this work
    // was listed twice, in `ballets` and in `filmMusic`.
    const strada = entries(decisions.workForms).find(([, row]) => row.title.includes('La Strada'))
    expect(strada?.[1].forms).toEqual(['Ballet', 'Film music'])
  })

  it('names work period overrides that are in scope, with the right titles', () => {
    for (const [id, row] of entries(decisions.workPeriods)) {
      expect(harvest.works, `${id} is not an in-scope work`).toHaveProperty(id)
      expect(harvest.works[id].title).toBe(row.title)
    }
  })

  it('keeps the two Nutcrackers apart', () => {
    // The reason works are keyed by id: (composer, title) is not unique, and
    // these two rows are the exact case the period override exists for.
    const nutcrackers = Object.entries(harvest.works).filter(([, row]) => row.title === 'The Nutcracker Suite')
    expect(nutcrackers).toHaveLength(2)
    const jazz = entries(decisions.workPeriods).filter(([, row]) => row.period === 'Jazz')
    expect(jazz).toHaveLength(1)
    expect(nutcrackers.map(([id]) => id)).toContain(jazz[0][0])
    // Both are ballets; only one is Ellington's.
    for (const [id] of nutcrackers) expect(decisions.workForms[id].forms).toContain('Ballet')
  })
})

describe('the Excerpt rule reads titles rather than judging them', () => {
  const pattern = new RegExp(decisions.excerptRule.pattern)

  it.each([
    'Bacchanale, from Samson et Dalila',
    'Selections from Romeo and Juliet Suites',
    'Adventures on Earth, from "E.T. The Extra-Terrestrial"',
    'Memory (from the musical "Cats")',
  ])('matches %s', (title) => {
    expect(pattern.test(title)).toBe(true)
  })

  it.each(['Symphony No. 5 in B-flat Major', 'The Firebird Suite (1919)', 'Bolero', 'Finlandia'])(
    'leaves %s alone',
    (title) => {
      expect(pattern.test(title)).toBe(false)
    }
  )
})

describe('the guards match what the harvest measured', () => {
  it('agrees with the harvest on scope', () => {
    expect(decisions.guards.worksInScope).toBe(harvest.counts.worksInScope)
    expect(decisions.guards.composersInScope).toBe(harvest.counts.composersInScope)
    expect(decisions.guards.composersMatchedToImslp).toBe(harvest.counts.composersMatched)
  })

  it('leaves headroom above the writes it expects, and not much', () => {
    // A ceiling below the real write count aborts every run; one far above it
    // stops being a guard. Both are failures, so both are asserted.
    expect(decisions.guards.maxWorkWrites).toBeGreaterThan(decisions.guards.worksInScope - 1)
    expect(decisions.guards.maxComposerWrites).toBeGreaterThan(decisions.guards.composersInScope)
    expect(decisions.guards.maxWorkWrites).toBeLessThan(decisions.guards.worksInScope * 2)
    expect(decisions.guards.maxComposerWrites).toBeLessThan(decisions.guards.composersInScope * 2)
  })

  it('accounts for every uncategorised work', () => {
    expect(decisions.guards.worksWithGenre + decisions.guards.worksWithoutGenre).toBe(decisions.guards.worksInScope)
    // The routes by which a work carrying no genre can still end up with a form
    // — harvested from IMSLP, or derived from its own title — plus the residue.
    // A work reached by two routes would break this sum, which is the point: it
    // would mean the report and `docs/archive/form-curation.md` disagree about
    // the size of the backlog, and the worksheet is what a human works from.
    expect(
      decisions.guards.worksHarvestedFromImslp +
        decisions.guards.worksExcerptFromTitle +
        decisions.guards.worksLeftToCurate
    ).toBe(decisions.guards.worksWithoutGenre)
  })
})
