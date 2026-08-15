import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import type { Config } from '@react-router/dev/config'

import { loadArchive } from './app/lib/archive'
import { prerenderPaths } from './app/lib/prerender-paths'

/**
 * ADR-0002 / AWK-8: React Router framework mode, `ssr: false` + `prerender`.
 * No runtime server — the output is real HTML per route in `build/client`, a
 * plain static publish directory, which is what leaves `_redirects` alone.
 *
 * Three things here are load-bearing and were learned the hard way in AWK-17:
 *
 *  1. `prerender` takes an ASYNC FUNCTION, not an array. That is the whole reason
 *     this framework was chosen: one build-time Contentful sweep enumerates every
 *     path in one place, and route `loader`s then fill each page at build time.
 *
 *  2. Paths must be SLASH-FREE here. A trailing slash is a hard build failure —
 *     React Router matches the route as `/projects` and refuses to SSR
 *     `/projects/`. Netlify then 301s the slash-free form to the slash-ful one, so
 *     the served canonical address has the slash and the prerender input does not.
 *     Two layers, both correct; only this enumerator needs to know.
 *
 *  3. `concurrency` must be OMITTED entirely to get the default, never set to
 *     `undefined` — the validator tests the key's presence, not its value, so
 *     `concurrency: undefined` is rejected. The default is 1 (fully sequential),
 *     and AWK-17 measured that raising it to 14 buys about a second on a ~6 s
 *     build with flat peak RSS. Not worth a lever.
 *
 * Enumeration must be EXHAUSTIVE. With `ssr: false`, any route missing from the
 * list would serve an empty HydrateFallback shell — except that AWK-17 proved a
 * missing page actually 404s in production, because the silent-shell failure mode
 * requires a catch-all redirect. So: never add a catch-all redirect, and assert
 * the page set in CI.
 */
const BUILD_DIR = 'build'

/** Published, and dynamically imported by the header search on first interaction (AWK-41). */
const SEARCH_INDEX = join(BUILD_DIR, 'client', 'search-index.json')

/**
 * NOT published — it sits beside `client/`, not inside it.
 *
 * This is what scripts/assert-pages.test.ts compares the emitted pages against.
 * The assertion used to call `prerenderPaths()` itself, which was right when the
 * source was a local module and became wrong the moment it was a network fetch:
 * a unit test would need credentials and a live space to run. Recording what the
 * build enumerated keeps the property that matters — one enumeration, checked
 * against what actually reached disk — with no second source to drift.
 */
const PAGE_MANIFEST = join(BUILD_DIR, '.page-manifest.json')

function write(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`)
}

export default {
  ssr: false,
  prerender: prerenderPaths,

  /**
   * Runs once the build is on disk. Both files come from the SAME memoized sweep
   * `prerender` already ran, so neither is a second enumeration — `loadArchive`
   * resolves the promise it cached rather than fetching again.
   */
  async buildEnd() {
    const archive = await loadArchive()

    write(SEARCH_INDEX, archive.search)
    write(PAGE_MANIFEST, archive.paths)

    const { concerts, works, composers, projects, pairs, paths } = archive.stats
    console.log(
      `\nContentful sweep — ${concerts} concerts · ${works} works · ${composers} composers · ` +
        `${projects} projects, from ${pairs} qualifying (concert, item) pairs\n` +
        `  ${paths} paths prerendered · ${archive.search.length} search entries\n`
    )
  },
} satisfies Config
