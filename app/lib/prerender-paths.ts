/**
 * The prerender path enumerator.
 *
 * Lives here rather than inline in react-router.config.ts so the page assertion
 * can import the same function the build uses — AWK-17 built and proved that
 * assertion, and its value depends on both sides deriving the page set from one
 * place rather than agreeing by hand.
 *
 * It is now a thin consumer of app/lib/archive.ts's sweep, which reads the
 * Contentful Delivery API. It used to read app/data/sample.ts and derive composer
 * slugs from filing names; both are gone. Deriving was never the decision —
 * ADR-0008 stores archive slugs precisely so a name correction and a URL can move
 * independently, and a build-time `slugify` would have quietly re-coupled them.
 *
 * The two guards below are the reason this is a function with a body rather than
 * a one-line re-export. Both failures are silent in their own way:
 *
 *   - A TRAILING SLASH is a hard build failure. React Router matches the route as
 *     `/projects` and refuses to SSR `/projects/`. Netlify then 301s the
 *     slash-free form to the slash-ful one, so the served canonical address has
 *     the slash and the prerender input does not. Two layers, both correct; only
 *     this enumerator needs to know.
 *   - A DUPLICATE means two records claiming one address. ADR-0001 keys concert
 *     URLs by date, so a genuine double-header is data this has to catch rather
 *     than silently collapse.
 */
import { loadArchive } from './archive'

export async function prerenderPaths(): Promise<string[]> {
  const { paths } = await loadArchive()

  const seen = new Set<string>()
  for (const path of paths) {
    if (path.endsWith('/') && path !== '/') {
      throw new Error(`prerender path has a trailing slash, which fails the build: ${path}`)
    }
    if (!path.startsWith('/')) {
      throw new Error(`prerender path is not absolute: ${path}`)
    }
    if (seen.has(path)) {
      throw new Error(`duplicate prerender path: ${path}`)
    }
    seen.add(path)
  }

  return paths
}
