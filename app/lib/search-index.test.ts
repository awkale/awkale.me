import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SearchEntry } from './archive'
import { loadSearchIndex, resetSearchIndex } from './search-index'

/**
 * Twenty lines of module, and both of its behaviours fail SILENTLY when broken.
 *
 * site-search.tsx swallows a rejected load on purpose — a search that cannot
 * reach its index degrades to a field that finds nothing, on a site where every
 * page is still reachable by browsing. That makes the retry below invisible from
 * the outside: cache the rejection and the field is dead for the rest of the
 * session, with nothing in the console and every other test still green.
 *
 * The real import cannot be exercised here — `/search-index.js` is served by the
 * dev middleware or by Netlify and resolves to nothing under Vitest — which is
 * exactly why `loadSearchIndex` takes its loader as a parameter.
 */
const ENTRIES: SearchEntry[] = [{ kind: 'work', title: 'Finlandia', detail: 'Sibelius, Jean', path: '/w/' }]

describe('loadSearchIndex', () => {
  beforeEach(resetSearchIndex)

  it('unwraps the module default', async () => {
    await expect(loadSearchIndex(() => Promise.resolve({ default: ENTRIES }))).resolves.toEqual(ENTRIES)
  })

  it('fetches once however many times it is asked', async () => {
    const load = vi.fn(() => Promise.resolve({ default: ENTRIES }))

    const [first, second] = await Promise.all([loadSearchIndex(load), loadSearchIndex(load)])

    expect(load).toHaveBeenCalledTimes(1)
    expect(first).toBe(second)
  })

  it('memoizes the PROMISE, so two interactions a keystroke apart share one request', async () => {
    // Both callers arrive before the first resolves — the case a result-level
    // memo would miss entirely.
    const deferred: { resolve?: (module: { default: SearchEntry[] }) => void } = {}
    const load = vi.fn(
      () =>
        new Promise<{ default: SearchEntry[] }>((resolve) => {
          deferred.resolve = resolve
        })
    )

    const both = Promise.all([loadSearchIndex(load), loadSearchIndex(load)])
    deferred.resolve?.({ default: ENTRIES })

    expect(await both).toEqual([ENTRIES, ENTRIES])
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('does NOT cache a failure — one dropped connection must not kill search for the session', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ default: ENTRIES })

    await expect(loadSearchIndex(load)).rejects.toThrow('offline')
    // The retry is the whole point: the next interaction gets a real index.
    await expect(loadSearchIndex(load)).resolves.toEqual(ENTRIES)
    expect(load).toHaveBeenCalledTimes(2)
  })
})
