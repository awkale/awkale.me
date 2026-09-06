import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Guards the shape of `bso-graph.json` against the space it is imported into.
 *
 * The graph is parser output, and the importer writes every key a work record
 * carries. So a key that names a field the content type no longer has is not
 * inert: the next re-import PUTs it and Contentful answers 422. AWK-66 deleted
 * `work.genre` on 2026-09-01 and AWK-78 took the field out of the parser rather
 * than leaving the graph describing something nothing has. This pins that.
 *
 * It asserts the FILE, not the space — nothing here proves a re-import ran. And
 * `bso-graph.json` is gitignored parser output, so like archive-corrections.test.ts
 * this fails on a fresh clone until `parse_archive.py` has run once.
 */
const graph = JSON.parse(readFileSync(join(import.meta.dirname, 'bso-graph.json'), 'utf8')) as Graph

type Graph = {
  types: Record<string, Record<string, Record<string, unknown>>>
}

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
