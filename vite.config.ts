import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

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
export default defineConfig({
  plugins: [tailwindcss(), ...(process.env.VITEST ? [] : [reactRouter()])],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    // happy-dom over jsdom: lighter, and nothing here needs jsdom's fidelity.
    environment: "happy-dom",
  },
});
