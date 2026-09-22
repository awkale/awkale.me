import { useEffect, useState } from 'react'

import { NARROW } from './columns'

/**
 * AWK-67's hydration gate for the column set: `false` until mount, then whether
 * the viewport is narrower than `NARROW`, and live thereafter.
 *
 * WHY IT CANNOT SIMPLY READ `matchMedia` DURING RENDER. With `ssr: false` and
 * prerendering (ADR-0004) the HTML is built with no viewport at all and is
 * identical for every visitor, so the column set cannot be decided at build time
 * — and reading the viewport during the FIRST client render would make that
 * render disagree with the markup it is hydrating into, which React 19 answers by
 * discarding the server HTML and logging #418. `useSyncExternalStore` would have
 * the same problem for the same reason: its server snapshot is the one that has
 * to match, and there is no viewport in it.
 *
 * So it is the gate the facets and the sort already use, one layer down: the
 * first client render is the prerendered state — `false`, every column — and one
 * tick later the real viewport applies. A phone reader sees the full table for one
 * frame, exactly as a shared `?conductor=` link shows every row for one. That cost
 * is accepted, and it is why archive-table.css's container scroll is not optional:
 * without JavaScript the gate never opens and the full set is all there is.
 *
 * IT STAYS LIVE AFTER THAT, which the facets' gate does not need to be. A device
 * rotates, and a reader who has chosen nothing should get the set that fits the
 * viewport they are now holding — so this subscribes rather than sampling once. A
 * reader who HAS chosen a set keeps it at every width; that rule is
 * `visibleColumns`', not this hook's.
 */
export function useNarrow(): boolean {
  const [isNarrow, setNarrow] = useState(false)

  useEffect(() => {
    const query = window.matchMedia(NARROW)

    setNarrow(query.matches)
    const onChange = (event: MediaQueryListEvent) => setNarrow(event.matches)
    query.addEventListener('change', onChange)

    return () => query.removeEventListener('change', onChange)
  }, [])

  return isNarrow
}
