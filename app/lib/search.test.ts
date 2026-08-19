import { describe, expect, it } from 'vitest'

import type { SearchEntry } from './archive'
import { PER_KIND, groupResults } from './search'

/**
 * The ranking half of AWK-41, tested with no DOM in sight.
 *
 * This exists as its own module precisely so these rules are assertable without
 * rendering a ComboBox: React Aria filters a collection by default, and this
 * takes that job over (`defaultFilter={() => true}` in site-search.tsx) so the
 * order and the cap are decided here rather than inside a popover.
 */
function entry(kind: SearchEntry['kind'], title: string, detail = '', path = `/${title}/`): SearchEntry {
  return { kind, title, detail, path }
}

describe('groupResults', () => {
  it('returns nothing at all for an empty query', () => {
    // 595 entries on focus is not a search result, it is a phone book. The
    // popover renders its own hint instead.
    expect(groupResults([entry('work', 'Finlandia')], '')).toEqual([])
    expect(groupResults([entry('work', 'Finlandia')], '   ')).toEqual([])
  })

  it('groups in a fixed order, whatever order the index arrives in', () => {
    // ADR-0011: a case study must never sort among 322 works.
    const index = [
      entry('concert', '2019-12-15', 'Finlandia Hall'),
      entry('work', 'Finlandia', 'Sibelius, Jean'),
      entry('composer', 'Finzi, Gerald', '3 works'),
      entry('project', 'Findings Dashboard', 'dv01'),
    ]

    expect(groupResults(index, 'fin').map((g) => g.kind)).toEqual(['project', 'composer', 'work', 'concert'])
  })

  it('omits a kind entirely when nothing in it matches', () => {
    const index = [entry('work', 'Finlandia'), entry('concert', '2019-12-15')]

    expect(groupResults(index, 'finl').map((g) => g.kind)).toEqual(['work'])
  })

  it('ranks a title prefix above the same word later in the title', () => {
    const index = [entry('work', 'The Firebird'), entry('work', 'Firebird Suite')]

    expect(groupResults(index, 'fire')[0].entries.map((e) => e.title)).toEqual(['Firebird Suite', 'The Firebird'])
  })

  it('ranks prefix, then word start, then a match buried inside a word', () => {
    const index = [
      entry('work', 'Verandah Music'),
      entry('work', 'Adagio and Andante'),
      entry('work', 'Andante festivo'),
    ]

    expect(groupResults(index, 'anda')[0].entries.map((e) => e.title)).toEqual([
      'Andante festivo',
      'Adagio and Andante',
      'Verandah Music',
    ])
  })

  it('scores the BEST occurrence in a title, not the first one it happens to find', () => {
    // `Verandah Andante` has `anda` buried at index 1 and starting a word at
    // index 9. Scoring the first hit would call the whole title "buried" and
    // sort it below a title where the query never starts a word at all.
    const index = [entry('work', 'Verandah Music'), entry('work', 'Verandah Andante')]

    expect(groupResults(index, 'anda')[0].entries.map((e) => e.title)).toEqual(['Verandah Andante', 'Verandah Music'])
  })

  it('folds letters that have no NFD decomposition, which the mark-stripper alone misses', () => {
    // `ł` is not `l` + a combining stroke — the stroke is part of the glyph — so
    // NFD leaves it intact and `lutoslawski` would miss. Nothing in the archive
    // hits this today; ADR-0007's IMSLP pass is what would bring it.
    const index = [
      entry('composer', 'Lutosławski, Witold'),
      entry('composer', 'Nørgård, Per'),
      entry('composer', 'Weiß, Sylvius'),
    ]

    expect(groupResults(index, 'lutoslawski')[0].entries[0].title).toBe('Lutosławski, Witold')
    expect(groupResults(index, 'norgard')[0].entries[0].title).toBe('Nørgård, Per')
    expect(groupResults(index, 'weiss')[0].entries[0].title).toBe('Weiß, Sylvius')
  })

  it('ranks a title match above a detail match', () => {
    const index = [entry('work', 'Nocturne', 'Sibelius, Jean'), entry('work', 'Sibelius Fragment', 'Anonymous')]

    expect(groupResults(index, 'sibelius')[0].entries.map((e) => e.title)).toEqual(['Sibelius Fragment', 'Nocturne'])
  })

  it('finds a work through its composer, which is the question the archive exists to answer', () => {
    // "Which Sibelius did I play" — the composer is the work row's detail line.
    const index = [entry('work', 'Finlandia', 'Sibelius, Jean'), entry('work', 'Bolero', 'Ravel, Maurice')]

    expect(groupResults(index, 'sibelius')[0].entries.map((e) => e.title)).toEqual(['Finlandia'])
  })

  it('ignores case', () => {
    const index = [entry('composer', 'Sibelius, Jean')]

    expect(groupResults(index, 'SIBELIUS')).toHaveLength(1)
  })

  it('folds diacritics, so an ASCII keyboard reaches every composer in the archive', () => {
    // Dvořák, Fauré and Saint-Saëns are all in here, and nobody types the marks.
    const index = [
      entry('composer', 'Dvořák, Antonín'),
      entry('composer', 'Fauré, Gabriel'),
      entry('composer', 'Saint-Saëns, Camille'),
    ]

    expect(groupResults(index, 'dvorak')[0].entries[0].title).toBe('Dvořák, Antonín')
    expect(groupResults(index, 'faure')[0].entries[0].title).toBe('Fauré, Gabriel')
    expect(groupResults(index, 'saens')[0].entries[0].title).toBe('Saint-Saëns, Camille')
  })

  it('requires EVERY word of the query to match, across title and detail together', () => {
    const index = [
      entry('work', 'Symphony No. 5', 'Beethoven, Ludwig van'),
      entry('work', 'Symphony No. 9', 'Beethoven, Ludwig van'),
      entry('work', 'Symphony No. 5', 'Sibelius, Jean'),
    ]

    const hits = groupResults(index, 'beethoven 5')[0].entries

    expect(hits).toHaveLength(1)
    expect(hits[0].detail).toBe('Beethoven, Ludwig van')
  })

  it('caps each group but reports the true total, so the header cannot lie', () => {
    const index = Array.from({ length: 20 }, (_, i) => entry('work', `Etude No. ${i + 1}`))

    const [works] = groupResults(index, 'etude')

    expect(works.entries).toHaveLength(PER_KIND)
    expect(works.total).toBe(20)
  })

  it('caps per kind rather than overall, so one crowded kind cannot crowd out another', () => {
    // 322 works against 5 projects: a global cap would bury every case study.
    const index = [
      ...Array.from({ length: 20 }, (_, i) => entry('work', `Etude No. ${i + 1}`)),
      entry('project', 'Etude Tracker'),
    ]

    expect(groupResults(index, 'etude').map((g) => g.kind)).toEqual(['project', 'work'])
  })
})
