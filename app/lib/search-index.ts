/**
 * Fetching half of AWK-41: how the ~595-entry index reaches the browser.
 *
 * A DYNAMIC IMPORT, NOT A `fetch`, and that is a CSP decision rather than a
 * stylistic one. ADR-0010's policy carries `default-src 'self'`, so a `fetch`
 * would have worked too — but ADR-0011 chose the import so the index is covered
 * by `script-src` and needs nothing added to `connect-src`, and public/_headers
 * records that reasoning where the policy itself lives. Keep it an import.
 *
 * The URL is a literal string rather than a bundled module specifier, because
 * the index does not exist when Vite bundles: `buildEnd` writes it after the
 * client build, from the same sweep that enumerated the pages. `@vite-ignore`
 * tells Vite to leave the specifier alone instead of trying to resolve it.
 *
 * Nothing imports this at module scope. site-search.tsx calls it on the first
 * interaction with the field, which is what keeps ~50 KB off all ~600 pages for
 * everyone who never searches.
 */
import type { SearchEntry } from './archive'

/** Where react-router.config.ts publishes it. Not content-hashed — see that file. */
const INDEX_URL = '/search-index.js'

type IndexModule = { default: SearchEntry[] }

const importIndex = (): Promise<IndexModule> => import(/* @vite-ignore */ INDEX_URL) as Promise<IndexModule>

let pending: Promise<SearchEntry[]> | null = null

/**
 * `load` is a parameter so the memoizing and the retry below can be tested at
 * all. The default is the real import, which no test can exercise: the URL is
 * an absolute path served by the dev middleware or by Netlify, and resolves to
 * nothing under Vitest.
 */
export function loadSearchIndex(load: () => Promise<IndexModule> = importIndex): Promise<SearchEntry[]> {
  // Memoized on the PROMISE, not the result, so two interactions a keystroke
  // apart share one request rather than racing two.
  pending ??= load()
    .then((module) => module.default)
    .catch((error: unknown) => {
      // Drop the memo so the next interaction can try again. Caching a rejection
      // would turn one dropped connection into a search field that is broken for
      // the rest of the session — and it would do it silently, since
      // site-search.tsx swallows the error by design.
      pending = null
      throw error
    })

  return pending
}

/** Drops the memo. For tests — nothing in a browser should need it. */
export function resetSearchIndex(): void {
  pending = null
}
