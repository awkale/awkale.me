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
  workForms: Record<string, { title: string; forms: string[]; outOfScope?: boolean; settled?: boolean }>
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
  it('reads nine periods and thirty-four forms out of archive-schema.json', () => {
    // If this fails the schema moved, and every `in` assertion below is
    // asserting against the wrong list rather than failing individually.
    expect(PERIODS).toHaveLength(9)
    // 25 until AWK-65 added nine — Essay, Fugue, Hymn, Intermezzo, Pavane,
    // Poem, Polka, Romance, Tango — for works the curation pass had no word
    // for. ADR-0007 anticipated this: it "fixes the mechanism, not the
    // enumeration", and its own eight additions were made the same way.
    expect(FORMS).toHaveLength(34)
  })

  it('declares a vocabulary the live Contentful validation may not have yet', () => {
    // THIS TEST CANNOT CHECK THE THING THAT MATTERS, and says so rather than
    // implying coverage. The 34 values here are a declaration; the `in`
    // validation on work.forms in the space is the authority, migrate_schema.py
    // is additive and will NOT reshape an existing field, and nothing in this
    // repo reads the live list. So a value added here reaches Contentful only
    // when someone edits it in the web app by hand, and until they do, a row
    // using one is rejected at publish rather than caught here.
    const added = ['Essay', 'Fugue', 'Hymn', 'Intermezzo', 'Pavane', 'Poem', 'Polka', 'Romance', 'Tango']
    for (const form of added) expect(FORMS).toContain(form)
    // What IS checkable: no curated row may use one of the nine until the
    // web-app edit lands. Delete this block once the live validation agrees —
    // and not before, because it is the only thing standing between a curation
    // batch and a failed publish.
    const rows = entries(decisions.workForms).filter(([, row]) => row.forms.some((f) => added.includes(f)))
    expect(
      rows.map(([id]) => id),
      'a row uses a form the live space may reject; confirm the web-app edit first'
    ).toEqual([])
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
    // Six in scope, plus Papageno's from AWK-66's out-of-scope four, plus the
    // SIX AWK-65 ADDED — and those six are a deliberate widening of what the
    // word covers here, recorded because it reads like the migration error this
    // very test guards against. `Act II, Carmen`, `Selections, Carmen`, `Act I,
    // Tosca`, `Act III, Rigoletto` and the Lucia and Italiana finales are whole
    // acts and selections, not sung numbers: they CONTAIN arias rather than
    // being one, which is the distinction ADR-0007 drew when it found the old
    // bucket ~half wrong. Alex settled it on 2026-09-07 in favour of Aria on
    // all six, alongside Excerpt. The row is the decision; this note is why it
    // is not a regression.
    const arias = entries(decisions.workForms).filter(([, row]) => row.forms.includes('Aria'))
    expect(arias).toHaveLength(13)
    // Every one of the six is an excerpt too — that half is not in dispute.
    const operaRows = arias.filter(([, row]) => /^(Act |Selections, )/.test(row.title))
    expect(operaRows).toHaveLength(6)
    for (const [id, row] of operaRows) expect(row.forms, `${id} lost the Excerpt half`).toContain('Excerpt')
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
    // Scoped rows only. The harvest covers the played works and nothing else, so
    // an out-of-scope curation CANNOT be checked against it — and must say so
    // rather than be quietly exempted, which is what `outOfScope` is for. The
    // title redundancy is not lost either way: the applier re-reads every title
    // from the space and aborts on a mismatch, which is the check that actually
    // catches a renamed or deleted row.
    const scoped = entries(decisions.workForms).filter(([, row]) => !row.outOfScope)
    for (const [id, row] of scoped) {
      expect(harvest.works, `${id} is not an in-scope work; flag it outOfScope if that is deliberate`).toHaveProperty(
        id
      )
      expect(harvest.works[id].title, `${id} was written against a different title`).toBe(row.title)
    }
  })

  it('flags an out-of-scope curation as out of scope, and never the reverse', () => {
    // The claim `outOfScope` makes is checkable in the other direction: a row
    // carrying the flag must genuinely be absent from the harvest. Otherwise the
    // flag becomes a way to opt any row out of the drift guard above.
    for (const [id] of entries(decisions.workForms).filter(([, row]) => row.outOfScope)) {
      expect(harvest.works, `${id} IS in scope; drop its outOfScope flag`).not.toHaveProperty(id)
    }
  })

  it('carries AWK-66s four out-of-scope rows, which are the whole residue of the widened mapping', () => {
    // The widened genre -> forms pass carried 199 of the 203 out-of-scope works
    // holding a genre with no judgement at all. These four are what was left, and
    // the count is asserted so a change here has to move the guard with it. The
    // mode itself is retired (AWK-80); the rows stay, because they are decisions.
    const outOfScope = entries(decisions.workForms).filter(([, row]) => row.outOfScope)

    expect(outOfScope).toHaveLength(decisions.guards.worksOutOfScopeCurated)
    // All four are from the `Aria` bucket, which genreForms maps to nothing, and
    // ALL FOUR fall outside the Excerpt pattern — `Excerpt from …` and `from The
    // Magic Flute` have no comma before `from` and no quoted title after, the
    // same gap `Scenes from I Pagliacci` fell through. That is why they need
    // naming: every other row in the bucket the derived rule reaches on its own.
    const pattern = new RegExp(decisions.excerptRule.pattern)
    expect(outOfScope.filter(([, row]) => !pattern.test(row.title))).toHaveLength(4)
    // Three of the four are excerpts the rule missed; the fourth is not an
    // excerpt at all, but a waltz misfiled as an aria — ADR-0007's ~6% wrong.
    expect(outOfScope.filter(([, row]) => row.forms.includes('Excerpt'))).toHaveLength(3)
    expect(outOfScope.find(([, row]) => row.title.includes('Vienna Woods'))?.[1].forms).toEqual(['Waltz'])
  })

  it('assigns only forms in the vocabulary, and allows an empty set only as an uncurated blank', () => {
    // An empty array USED to be illegal here: omission said "considered, left
    // blank" and a row that would never write said nothing a reader could
    // trust. AWK-65 seeded the backlog as blank rows so that curating one is
    // filling an array rather than authoring an object, which spends that
    // distinction — every work is present now, so absence says nothing.
    // `settled` is what buys it back, and the two states it separates are the
    // ones that actually matter: untouched backlog, versus a work looked at and
    // left empty on purpose.
    for (const [id, row] of entries(decisions.workForms)) {
      for (const form of row.forms) expect(FORMS).toContain(form)
      // A settled row is a decision that the work carries no form, so a form
      // beside the flag is a contradiction rather than a richer row.
      if (row.settled) expect(row.forms, `${id} is settled AND carries forms; drop one`).toHaveLength(0)
      // An out-of-scope row is a curation of an unplayed work — the only reason
      // to name one at all is the form it gets, so a blank one is a stray.
      if (row.outOfScope) expect(row.forms.length, `${id} is an out-of-scope blank; delete it`).toBeGreaterThan(0)
    }
  })

  it('counts its rows and its filled rows against the guards, and repeats no form', () => {
    // Two numbers because the file now holds two kinds of row. The total moves
    // only when scope does; the filled count is what a curation batch bumps,
    // and it starts at the 38 migration repairs this test used to pin directly
    // — 28 in-scope from AWK-37, AWK-66's 4 out-of-scope, and AWK-80's 6.
    const rows = entries(decisions.workForms)
    expect(rows).toHaveLength(decisions.guards.workFormsRows)
    expect(rows.filter(([, row]) => row.forms.length > 0)).toHaveLength(decisions.guards.workFormsFilled)
    expect(rows.filter(([, row]) => row.settled)).toHaveLength(decisions.guards.workFormsSettled)
    for (const [id, row] of rows) {
      expect(new Set(row.forms).size, `${id} repeats a form`).toBe(row.forms.length)
    }
  })

  it('accounts for every row as filled, settled or not yet reached', () => {
    // The three states are exhaustive and disjoint, so they sum. A row that is
    // BOTH filled and settled is caught above as a contradiction; this catches
    // the other direction — a guard nudged without the rows moving with it.
    const rows = entries(decisions.workForms)
    const untouched = rows.filter(([, row]) => !row.forms.length && !row.settled)
    expect(decisions.guards.workFormsFilled + decisions.guards.workFormsSettled + untouched.length).toBe(
      decisions.guards.workFormsRows
    )
    // THE RESIDUE IS NOW ENTIRELY ONE CAUSE, which is the state worth asserting.
    // All 12 are DECIDED and unwritable: each uses one of the nine forms the
    // live Contentful validation does not carry yet, so writing them would buy
    // a rejected publish rather than a curated work. Nothing here is unreviewed
    // — every work of the 114 has been ruled on. When the web-app edit lands,
    // these 12 go in, this expectation becomes 0, and the stopgap test above
    // gets deleted in the same commit.
    expect(untouched).toHaveLength(12)
  })

  it('still repairs the 16 ballets ADR-0007 counted, and names the Suite half since the genre delete', () => {
    // 14 ballet suites, the two Nutcracker Suite rows excepted (their form set
    // is Ballet + Suite via the harvest), plus AWK-80's two excerpt-ballets,
    // plus AWK-65's six: Fancy Free, The Three-Cornered Hat, Petroushka,
    // Nobilissima Visione and Rodeo in the first batch, Barber's Souvenirs in
    // the second (published as `Souvenirs (Ballet Suite), Op. 28` — piano duets
    // Kirstein commissioned Barber to orchestrate for Ballet Society). All six
    // are curation rather than repair — works that carried NO form at all, not
    // ones filed wrongly — so they move this count without bearing on the 16
    // ADR-0007 counted.
    const ballets = entries(decisions.workForms).filter(([, row]) => row.forms.includes('Ballet'))
    expect(ballets).toHaveLength(24)
    // AWK-80: `genre` supplied Suite for these until AWK-66 deleted it, so the
    // row has to. A ballet-suite row naming Ballet alone is the 2026-09-06
    // conflict coming back.
    const suites = ballets.filter(([, row]) => /Suite/.test(row.title) && !/^The Nutcracker Suite$/.test(row.title))
    expect(suites).toHaveLength(14)
    for (const [id, row] of suites) expect(row.forms, `${id} lost the Suite half`).toContain('Suite')
  })

  it('settles Tzigane as a Rhapsody and not a Concerto (AWK-80)', () => {
    // Ravel's own subtitle is `rapsodie de concert`. The harvest carried
    // Rhapsody until the wiki withdrew it; Concerto was the hand-set genre.
    // Declared here so the decision outlives the next re-harvest.
    expect(decisions.workForms['7FdM6FH19h52lHS8EnFx1B']).toEqual({ title: 'Tzigane', forms: ['Rhapsody'] })
  })

  it('carries the one work needing two forms as a single row', () => {
    // The reason the shape changed. Under the old form-keyed buckets this work
    // was listed twice, in `ballets` and in `filmMusic`.
    const strada = entries(decisions.workForms).find(([, row]) => row.title.includes('La Strada'))
    // Suite joined the row under AWK-80, once `genre` could no longer supply it.
    expect(strada?.[1].forms).toEqual(['Ballet', 'Film music', 'Suite'])
  })

  it('never declares a period for an out-of-scope work', () => {
    // AWK-66 widened FORMS and nothing else. A period on an unplayed work would
    // be a value the site never renders, written by a pass that suppresses
    // period out there on purpose — see plan_works' forms_only.
    for (const [id] of entries(decisions.workPeriods)) {
      expect(harvest.works, `${id} is out of scope and cannot take a period`).toHaveProperty(id)
    }
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

  it('carries no guard for the retired --all-works mode (AWK-80)', () => {
    // AWK-66's widened mode carried the genre -> forms mapping to the unplayed
    // Works before `work.genre` was deleted. The field went on 2026-09-01, so
    // the mode had nothing left to plan and aborted on its own guard. Its three
    // numbers went with it; a reappearance means someone resurrected the flag.
    expect(decisions.guards).not.toHaveProperty('worksOutOfScopeWithGenre')
    expect(decisions.guards).not.toHaveProperty('worksOutOfScopeCarriedByMapping')
    expect(decisions.guards).not.toHaveProperty('maxWorkWritesAllWorks')
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
