/**
 * The ranking half of AWK-41's archive search.
 *
 * Pure, and separate from the ComboBox on purpose. React Aria filters a
 * collection itself by default — a language-sensitive "contains" from
 * `useFilter` — and site-search.tsx switches that OFF with
 * `defaultFilter={() => true}` so that ordering, the per-kind cap and the group
 * headers are decided here, where they can be asserted without a DOM. Leaving
 * both filters on would silently drop rows this ranker deliberately kept: the
 * diacritic folding below matches `dvorak` against `Dvořák`, which RAC's
 * contains-filter would then throw away.
 *
 * Nothing here reads Contentful or knows what a route is. The input is the
 * index emitted by the one build-time sweep (app/lib/archive.ts), and every
 * entry already carries the slash-ful path it links to.
 */
import type { SearchEntry } from './archive'

export type SearchGroup = {
  kind: SearchEntry['kind']
  /** The group heading. ADR-0011 groups by kind so a case study never sorts among 322 works. */
  label: string
  /** How many matched BEFORE the cap, so the heading cannot overstate what is shown. */
  total: number
  entries: SearchEntry[]
}

/**
 * Per kind, never overall. The archive is lopsided — 322 works against 5
 * projects — so a global cap would bury every case study under the Etudes.
 */
export const PER_KIND = 6

/** Fixed display order, independent of the index's own order. */
const GROUPS: { kind: SearchEntry['kind']; label: string }[] = [
  { kind: 'project', label: 'Projects' },
  { kind: 'composer', label: 'Composers' },
  { kind: 'work', label: 'Works' },
  { kind: 'concert', label: 'Concerts' },
]

/**
 * Letters that NFD does NOT decompose, because the mark is part of the glyph
 * rather than a combining character over a base letter. `Lutosławski` is the
 * one most likely to arrive here — ADR-0007's IMSLP pass is what would bring
 * it — and without this line it would be unreachable from an ASCII keyboard
 * while `Dvořák` works fine, which is a confusing half-broken.
 */
const INDECOMPOSABLE: Record<string, string> = {
  ø: 'o',
  ł: 'l',
  đ: 'd',
  ð: 'd',
  æ: 'ae',
  œ: 'oe',
  ß: 'ss',
  þ: 'th',
}

/**
 * Case- and diacritic-insensitive, because the archive is full of `Dvořák`,
 * `Fauré` and `Saint-Saëns` and nobody types the marks. NFD splits each letter
 * into base + combining mark, the mark is dropped, and the table above catches
 * the letters that have no such decomposition.
 */
function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[øłđðæœßþ]/g, (letter) => INDECOMPOSABLE[letter])
}

/**
 * Folding the whole index on every keystroke is 603 entries × two fields ×
 * `normalize` plus a Unicode-property regex, with no debounce in front of it.
 * The index entries are stable objects for the life of the page — they come
 * from one imported module — so each is folded once and remembered.
 */
const foldedEntries = new WeakMap<SearchEntry, { title: string; detail: string; haystack: string }>()

function foldEntry(entry: SearchEntry): { title: string; detail: string; haystack: string } {
  const cached = foldedEntries.get(entry)
  if (cached) return cached

  const title = fold(entry.title)
  const detail = fold(entry.detail)
  const folded = { title, detail, haystack: `${title} ${detail}` }
  foldedEntries.set(entry, folded)

  return folded
}

/** Anything that is not a letter or a number starts a new word — including `-`, so `Saint-Saëns` matches on `saens`. */
const NOT_WORD_CHARACTER = /[^\p{L}\p{N}]/u

/**
 * Three tiers per field: at the start (`base`), at the start of a later word
 * (`base + 1`), buried inside a word (`base + 2`). Null when absent.
 *
 * EVERY occurrence is considered, not just the first, and that distinction is
 * the whole reason this is a loop. `Verandah Andante` searched for `anda` has a
 * buried hit at index 1 and a word start at index 9; scoring the first hit
 * would rank the title as "buried" and bury a title that plainly starts a word
 * with the query.
 */
function positionRank(haystack: string, needle: string, base: number): number | null {
  if (!haystack.includes(needle)) return null
  if (haystack.startsWith(needle)) return base

  for (let at = haystack.indexOf(needle); at >= 0; at = haystack.indexOf(needle, at + 1)) {
    if (NOT_WORD_CHARACTER.test(haystack[at - 1])) return base + 1
  }

  return base + 2
}

/**
 * EVERY word of the query must appear, across title and detail together — so
 * `beethoven 5` finds the Fifth and not the Ninth. The position of the FIRST
 * word then decides the rank, with the title outranking the detail: a work
 * called `Sibelius Fragment` should beat a nocturne merely composed by him.
 */
function rank(entry: SearchEntry, tokens: string[]): number | null {
  const { title, detail, haystack } = foldEntry(entry)

  if (!tokens.every((token) => haystack.includes(token))) return null

  // `?? `, not `|| ` — a rank of 0 is the best possible score, not a miss.
  return positionRank(title, tokens[0], 0) ?? positionRank(detail, tokens[0], 3) ?? 6
}

export function groupResults(index: SearchEntry[], query: string): SearchGroup[] {
  const tokens = fold(query).split(/\s+/).filter(Boolean)

  // An empty query returns nothing rather than everything. 595 entries on focus
  // is a phone book, not a search result; the popover renders a hint instead.
  if (tokens.length === 0) return []

  const hits = new Map<SearchEntry['kind'], { entry: SearchEntry; rank: number }[]>()
  for (const entry of index) {
    const scored = rank(entry, tokens)
    if (scored !== null) {
      const list = hits.get(entry.kind) ?? []
      list.push({ entry, rank: scored })
      hits.set(entry.kind, list)
    }
  }

  return GROUPS.flatMap(({ kind, label }) => {
    const matched = hits.get(kind)
    if (!matched || matched.length === 0) return []

    return [
      {
        kind,
        label,
        total: matched.length,
        // Array#sort is stable, so equal ranks keep the index's own order — which
        // is already meaningful: composers file by surname, concerts run newest first.
        entries: matched
          .sort((a, b) => a.rank - b.rank)
          .slice(0, PER_KIND)
          .map((hit) => hit.entry),
      },
    ]
  })
}
