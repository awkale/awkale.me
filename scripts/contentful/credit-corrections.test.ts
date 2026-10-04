import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Guards `credit-corrections.json`, AWK-88's declaration, against the parser.
 *
 * The declaration corrects the space; `parse_archive.py` decides what a re-import
 * would write. If the two disagree, the next re-import silently undoes the
 * correction — so each `set` is asserted equal to the graph's value for the same
 * item. A null in `set` means the field is absent, which the graph spells `[]`
 * for `credits` and `null` for `note`.
 *
 * It asserts the FILES, not the space — nothing here proves `--apply` ran. And
 * `bso-graph.json` is gitignored parser output, so like bso-graph.test.ts this
 * fails on a fresh clone until `parse_archive.py` has run once.
 */
const here = import.meta.dirname
const read = (name: string) => JSON.parse(readFileSync(join(here, name), 'utf8'))

type Fields = { credits?: string[] | null; note?: string | null }
type Declaration = {
  contentType: string
  corrections: Record<string, { note: string; expect: Fields; set: Fields }>
}
type ProgramItem = { soloists: string[]; credits: string[]; note: string | null }

const declaration = read('credit-corrections.json') as Declaration
const programItems = read('bso-graph.json').types.programItem as Record<string, ProgramItem>
const corrections = Object.entries(declaration.corrections)

describe('credit-corrections.json — AWK-88', () => {
  it('corrects exactly the two program items the ticket names', () => {
    expect(declaration.contentType).toBe('programItem')
    expect(corrections.map(([id]) => id).sort()).toEqual(['pi-19750429-2', 'pi-s1-unknown-1'])
  })

  it.each(corrections)('%s pins every field it writes', (_, { expect: pinned, set }) => {
    // The applier refuses an entry whose live value has moved off `expect`. A
    // field written but not pinned would be overwritten unchecked.
    expect(Object.keys(pinned).sort()).toEqual(Object.keys(set).sort())
  })

  it.each(corrections)('%s ends where the parser now puts it', (id, { set }) => {
    const item = programItems[id]
    expect(item, id).toBeDefined()
    expect(item.credits).toEqual(set.credits ?? [])
    expect(item.note).toEqual(set.note ?? null)
  })

  it.each(corrections)('%s starts from a credit with nobody linked', (id, { expect: pinned }) => {
    // The ticket's tell: a Credit with no soloist link is usually not a Credit.
    expect(pinned.credits).toHaveLength(1)
    expect(programItems[id]?.soloists).toEqual([])
  })
})
