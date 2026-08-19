import netlify from '@netlify/vite-plugin'
import optimizeLocales from '@react-aria/optimize-locales-plugin'
import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

/**
 * Serves `/search-index.js` in DEV ONLY, and it exists because the search was
 * otherwise dead on the dev server in a way nothing announced.
 *
 * `buildEnd` writes the real file into `build/client`, which only exists after a
 * build and which `bun run dev` does not serve. So the header field's dynamic
 * import 404s, the component swallows it, and search silently finds nothing —
 * while working perfectly in production. Measured, not assumed: 404 on
 * `localhost:5173/search-index.js`.
 *
 * Same shape and same source as the built artifact — one `loadArchive()`, the
 * function the whole build already funnels through — so dev and production
 * cannot disagree about what is in the index. `apply: 'serve'` keeps it out of
 * the build entirely, which is why the sweep accounting in app/lib/archive.ts
 * still describes the build correctly.
 *
 * The module is reached through `ssrLoadModule` rather than an ordinary import
 * at the top of this file, for two reasons. Importing app code into a Vite
 * config makes Vite warn that the extensionless specifier is unsupported by the
 * `configLoader: 'native'` it is moving to — on every typecheck, dev start and
 * build — and fixing that would mean `.ts` extensions cascading through
 * app/lib. Going through Vite's own module graph also means an edit to
 * archive.ts is picked up without restarting the dev server.
 */
const searchIndexDevServer: Plugin = {
  name: 'awkale-search-index-dev',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/search-index.js', (_request, response) => {
      server
        .ssrLoadModule('/app/lib/archive.ts')
        .then((module) => (module as typeof import('./app/lib/archive')).loadArchive())
        .then(({ search }) => {
          response.setHeader('Content-Type', 'text/javascript')
          // The sweep is memoized for the life of the process, so caching this
          // in the browser too would just add a second stale layer.
          response.setHeader('Cache-Control', 'no-store')
          response.end(`export default ${JSON.stringify(search)}`)
        })
        .catch((error: unknown) => {
          // Loud here, unlike in the browser: on a dev server this is almost
          // always the three Contentful variables missing from `.env`, and a
          // silent 500 would look exactly like the 404 this plugin fixes.
          response.statusCode = 500
          response.end(`// search index unavailable: ${error instanceof Error ? error.message : String(error)}`)
        })
    })
  },
}

/**
 * `defineConfig` comes from `vitest/config`, not `vite`, purely so the `test` key
 * below typechecks. It re-exports Vite's own, so the build is unaffected.
 *
 * The reactRouter() plugin is OMITTED under Vitest, and that is load-bearing: it
 * owns route-module transformation and a virtual server entry, which have no
 * meaning outside a real build and make component tests fail on imports the
 * plugin expects to have rewritten. Tests import route modules as ordinary
 * modules, which is exactly what they are — a route file is a component plus
 * optional exports.
 *
 * Consequence worth knowing: anything that only exists BECAUSE of the plugin
 * (typegen's ./+types/* modules, prerendering, the route manifest) is untestable
 * here by construction. Route components that take no loader data are testable;
 * ones that do will need their props passed by hand.
 */
/**
 * `netlify()` is dev-and-build tooling, not a runtime dependency, and it does NOT
 * make this a Functions deployment. It enables Netlify's own behaviour in local dev
 * — `_redirects`, `_headers`, env vars, blobs — so `bun run dev` behaves like the
 * deployed site without the `netlify dev` wrapper. It picks up `netlify/functions/`
 * if that directory exists; ADR-0011 says it never will.
 *
 * The concrete win: the thirteen redirects and `_headers` are testable locally, so
 * scripts/curl-sweep.sh can run against a dev server instead of waiting for the
 * apex cutover.
 *
 * ⚠️ DO NOT FOLLOW NETLIFY'S REACT ROUTER ADVICE. Their Vite guide
 * (netlify/context-and-tools, skills/netlify-frameworks/references/vite.md) tells
 * SPA frameworks including React Router to add:
 *
 *     [[redirects]]
 *     from = "/*"
 *     to = "/index.html"
 *     status = 200
 *
 * That is correct for a client-rendered SPA and WRONG HERE. This site is
 * `ssr: false` + `prerender`, so every route already has real HTML on disk. A
 * catch-all would make every unknown path serve an empty hydration shell instead of
 * a real 404 — across the whole archive — and would stop ADR-0001's reserved paths
 * (/music, /2-or-3-things) from 404ing, which is the only thing that reserves them.
 * AWK-17 verified both halves live. See public/_redirects and netlify.toml, which
 * carry the same warning.
 *
 * Excluded under Vitest for the same reason reactRouter() is: it is build/dev
 * machinery with nothing to do in a unit test.
 */
/**
 * React Aria ships localized strings for 34 languages, and `intlStrings.mjs`
 * imports every one of them STATICALLY into a single object — so tree-shaking
 * cannot drop the 33 this site will never serve. This plugin rewrites those
 * imports down to the listed locales.
 *
 * It became load-bearing with AWK-41: `ComboBox` is the first localized
 * component on the site, which is why the bundle carried no locale data before
 * it. Measured on disk, combobox plus overlays is 47.6 KB raw / ~5.9 KB gzipped
 * across all 34, against 1.2 KB / ~0.5 KB for `en-US` alone — about 5.4 KB
 * gzipped of pure waste on every one of ~600 pages.
 *
 * `en-US` ONLY, matching root.tsx's hardcoded `<html lang="en">`. Adding a
 * language to the site means adding it here too, or its screen-reader
 * announcements silently stay English.
 *
 * NOT excluded under Vitest, unlike the two plugins below: it only rewrites
 * imports inside react-aria, so the test environment and the build agree on
 * which strings exist. `enforce: 'pre'` is required — it has to run before
 * Vite's own import analysis.
 *
 * NOTE React Aria's React Router guide describes a different setup — revealing
 * `entry.server.tsx` and injecting strings per request from `accept-language`.
 * That is the SSR path and does not apply here: `ssr: false` + `prerender`
 * means there is no request, and every page is built once. The client-only Vite
 * path below is the applicable half.
 */
export default defineConfig({
  plugins: [
    { ...optimizeLocales.vite({ locales: ['en-US'] }), enforce: 'pre' },
    searchIndexDevServer,
    tailwindcss(),
    ...(process.env.VITEST ? [] : [reactRouter(), netlify()]),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    // happy-dom over jsdom: lighter, and nothing here needs jsdom's fidelity.
    environment: 'happy-dom',
  },
})
