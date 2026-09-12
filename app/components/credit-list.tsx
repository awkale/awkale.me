import { cn } from '../lib/utils'

/**
 * One Program item's Credits, as the only place this site renders them.
 *
 * AWK-68, under ADR-0006's *"the Credit is the render path"* amendment. A Credit is
 * the verbatim line a Soloist — or an Ensemble billed in its place — appeared under,
 * and the `programItem.soloists` links beside it are never resolved: the strings
 * already carry the display name for both, so `'Grace Choral Society of Brooklyn'`
 * needs no branch on content type. It renders on 2006-05-17 as exactly that.
 *
 * A STACKED LIST, never a table column. The AWK-60 conductor precedent does not
 * transfer — a conductor is always one name, which is what makes a column right for
 * it, while a Credit is one to fourteen. The Serenade to Music item of 2003-05-21
 * carries fourteen.
 *
 * ARRAY ORDER, unsorted, and that is the rule rather than an omission: `'3 Genii:'`
 * heads the three names beneath it and `'-Ambassador of The Netherlands'` continues
 * the line above it, so either one reordered is nonsense. The index is an honest key
 * for the same reason — printed order never reorders, and two Credits on one item
 * can read identically.
 *
 * NOTHING AT ALL when there are none, which is 306 of the 429 published
 * (concert, item) pairs — measured 2026-09-12, not inherited. An empty `<ul>` would
 * space every one of those rows differently for no content.
 */
export function CreditList({ credits, className }: { credits: string[]; className?: string }) {
  if (credits.length === 0) return null

  return (
    <ul className={cn('m-0 list-none p-0 text-xs text-muted-foreground', className)}>
      {credits.map((credit, index) => (
        // oxlint-disable-next-line react/no-array-index-key
        <li key={index}>{credit}</li>
      ))}
    </ul>
  )
}
