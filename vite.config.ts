import netlify from '@netlify/vite-plugin'
import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

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
export default defineConfig({
  plugins: [tailwindcss(), ...(process.env.VITEST ? [] : [reactRouter(), netlify()])],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    // happy-dom over jsdom: lighter, and nothing here needs jsdom's fidelity.
    environment: 'happy-dom',
  },
})
