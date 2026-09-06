import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { readParserEnum } from './parse-archive-source'

/**
 * Guards the shape of `bso-graph.json` against the space it is imported into.
 *
 * The graph is parser output, and the importer writes every key a work record
 * carries. So a key that names a field the content type no longer has is not
 * inert: the next re-import PUTs it and Contentful answers 422. AWK-66 deleted
 * `work.genre` on 2026-09-01 and AWK-78 took the field out of the parser rather
 * than leaving the graph describing something nothing has. This pins that.
 *
 * AWK-76 added a second reason to read the graph here: pinning how the parser
 * ROUTES a credit, not only which keys it emits. Same file because it is the
 * same fixture and the same caveat.
 *
 * It asserts the FILE, not the space — nothing here proves a re-import ran. And
 * `bso-graph.json` is gitignored parser output, so like archive-corrections.test.ts
 * this fails on a fresh clone until `parse_archive.py` has run once.
 */
const graph = JSON.parse(readFileSync(join(import.meta.dirname, 'bso-graph.json'), 'utf8')) as Graph

type Graph = {
  types: Record<string, Record<string, Record<string, unknown>>>
}

// The two tables the routing tests below read, typed once. Each block used to
// cast its own slice of `programItem`, three shapes of one table.
type ProgramItem = { soloists: string[]; credits: string[]; character: string | null }
type Soloist = { instrument: string[] | null }
const programItems = graph.types.programItem as Record<string, ProgramItem>
const soloists = graph.types.soloist as Record<string, Soloist>

describe('the graph describes no field the space lacks — AWK-78', () => {
  it('derives no genre type', () => {
    // ADR-0007 retired the concept; the form vocabulary lives in
    // archive-schema.json's `forms` list now, and the 17 live `genre` entries
    // are out of scope, not a source.
    expect(Object.keys(graph.types)).not.toContain('genre')
  })

  it('puts no genre key on any work', () => {
    const works = Object.values(graph.types.work)

    // Non-vacuity: an empty table would pass the loop below silently.
    expect(works.length).toBeGreaterThan(0)
    for (const work of works) expect(work).not.toHaveProperty('genre')
  })
})

describe('a group the keyword regex misses is still an Ensemble — AWK-76', () => {
  /**
   * `get_performer` routes a credit to `ensemble` on a keyword regex or on the
   * `ENSEMBLE_NAMES` allowlist. New York Opera Exchange carries no keyword —
   * neither "opera" nor "exchange" is one, on purpose — so before AWK-76 it fell
   * through to the personal-name branch and became a Soloist filed under "E".
   * The allowlist is the mechanism for exactly this name, and this pins it so a
   * tidy-up of that set cannot quietly re-file the company as a person.
   */
  const ensembles = graph.types.ensemble as Record<string, { name: string; kind: string }>
  const items = programItems

  it('files New York Opera Exchange as an ensemble, not a soloist', () => {
    expect(graph.types.soloist).not.toHaveProperty('sol-new-york-opera-exchange')
    // `Other`, deliberately: an opera company is neither a chorus nor a vocal
    // group, and it is the value the two other allowlisted groups carry.
    expect(ensembles['ens-new-york-opera-exchange']).toEqual({ name: 'New York Opera Exchange', kind: 'Other' })
  })

  it('links the La Traviata prelude to the ensemble through the polymorphic soloists field', () => {
    // `programItem.soloists` links `soloist | ensemble`; there is no separate
    // `ensembles` field, so the re-parent is a relink, not a new field.
    const item = items['pi-20121026-1']
    expect(item.soloists).toEqual(['ens-new-york-opera-exchange'])
    expect(item.credits).toEqual(['New York Opera Exchange'])
  })
})

describe('a Character reaches programItem.character only from a one-Credit item — AWK-75', () => {
  /**
   * The rule in CONTEXT.md and ADR-0006's 2026-09-06 amendment: `character` is
   * the one named dramatic role of an item with exactly one Credit, and a cast
   * keeps its per-singer Characters in the verbatim `credits` strings. The
   * parser enforces that in a single condition in `get_performer`'s caller,
   * which nothing else asserts. A Credited role (an instrument, a voice type,
   * a function) never belongs here — that is `soloist.instrument`'s job.
   */
  const withCharacter = Object.values(programItems).filter((item) => item.character)

  // Non-vacuity: the rule is about the items that DO carry one.
  it('has at least one item carrying a Character', () => {
    expect(withCharacter.length).toBeGreaterThan(0)
  })

  it('never sets character on an item with more than one Credit', () => {
    for (const item of withCharacter) expect(item.credits, item.character ?? '').toHaveLength(1)
  })

  it('never files a Credited role as a Character', () => {
    // Read from the parser rather than retyped here, so the two cannot drift.
    const creditedRoles = readParserEnum()
    expect(creditedRoles.length).toBeGreaterThan(40)
    for (const item of withCharacter) expect(creditedRoles).not.toContain(item.character)
  })
})

describe('Dancer and Filmmaker are Credited roles, not Characters — AWK-86', () => {
  /**
   * The two credits AWK-69 left in `character` because `ENUM` did not know
   * them. Under CONTEXT.md's rule a function is a Credited role like `Director`
   * or `Narrator`, so once the enum carries the value `get_performer` routes
   * it to the soloist and the item's `character` is empty. Pinned by id, not
   * only by the rule above, so a value dropping out of `ENUM` fails here by
   * name rather than as one line of the whole list.
   */
  const items = programItems

  it.each([
    ['sol-susan-hebach', 'Dancer', 'pi-20030213-2', 'Susan Hebach, Dancer'],
    ['sol-adam-grannick', 'Filmmaker', 'pi-20140601-3', 'Adam Grannick, Filmmaker'],
  ])('%s carries %s and %s keeps the credit but no character', (soloist, role, item, credit) => {
    expect(soloists[soloist]?.instrument).toEqual([role])
    expect(items[item]?.credits).toEqual([credit])
    expect(items[item]?.character).toBeNull()
  })

  it('leaves Isolde where she is', () => {
    // The one Character left once the other two moved, so the AWK-75 block
    // above is now one item wide. Pinned by id so that width is deliberate.
    expect(items['pi-19950328-3']?.character).toBe('Isolde')
  })
})
