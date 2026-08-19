import { RouterProvider as AriaRouterProvider } from 'react-aria-components'
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useNavigate } from 'react-router'

import { SiteFooter } from './components/site-footer'
import { SiteHeader } from './components/site-header'
import { themeScript } from './lib/mode'

import './app.css'

export function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />

        {/*
          Blocking, inline, first. ADR-0004: every page depends on this — without
          it the site flashes the wrong theme on all ~600 pages. It is not an
          enhancement that can be dropped, and anything editing this <head> must
          preserve it.

          NOTE the deliberate absence of className / data-theme on <html> above.
          This script owns those attributes; if React also renders them, every
          page logs a hydration mismatch.
        */}
        {/*
          oxlint's react/no-danger is correct in general and wrong here: the
          content is a module-local constant in lib/mode.ts with no interpolation
          and no external input, so there is nothing to inject. Suppressed locally
          rather than repo-wide, so the next dangerouslySetInnerHTML still gets
          questioned.
        */}
        {/* eslint-disable-next-line react/no-danger */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />

        {/* One preload per above-the-fold face. */}
        <link
          rel="preload"
          href="/fonts/fraunces-latin-var.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link rel="preload" href="/fonts/inter-latin-var.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />

        {/*
          AWK-50. Declared here AND served as a real file at /favicon.ico, which
          browsers request unprompted on a first visit with no markup involved —
          the file is the half that cannot be skipped, this link is the half
          everything else reads.

          public/favicon.ico is a REAL ICO container — two frames, 16 and 32, as
          classic BMP rather than PNG-in-ICO, so a strict ICO parser reads it and
          not just a browser that sniffs. It replaced the old site's 363-byte
          file, which was bare PNG bytes wearing an .ico extension; that worked
          everywhere it was asked to, but only because browsers sniff content.

          Do NOT read the source order of this <head> as the shipped order.
          React Router hoists <Links /> output, so in build/client the inline
          theme script above lands LAST in <head> — after the stylesheet and
          every modulepreload, these two icon links included. It still runs
          before <body> and before first paint, so the no-flash behaviour holds,
          but ADR-0004's "blocking, inline, first" describes this JSX and not the
          emitted document. Measured, not assumed. Nothing here caused it.

          BOTH links are needed. Chrome and Firefox take the SVG because of its
          `type`; Safari does not support SVG favicons at all and falls back to
          the .ico. Dropping either one loses a real set of clients.

          Colour is one value for both schemes (#f76b15) rather than a
          prefers-color-scheme rule, and both files carry it. A theme-aware fill
          shipped first and was dropped: it only ever applied in the browsers
          that take the SVG, so Safari kept showing a near-black mark from the
          .ico and the inversion bought a consistency it could not finish. One
          mid-orange reads against a white and a near-black tab strip alike.

          Both files are generated from docs/design/favicon.ai, which is now in
          the repo. Regenerate rather than hand-editing either one.
        */}
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      </head>
      <body>
        {/*
          React Aria's RouterProvider, NOT React Router's — the two packages
          export the same name, hence the alias on the import.

          It hands React Aria a `navigate` function, which is what makes any
          React Aria component carrying an `href` navigate client-side instead
          of reloading the document. Today that is exactly one surface: the
          header search's results (AWK-41), which are anchors precisely so
          cmd-click, middle-click and "copy link address" behave like the rest
          of the web.

          REMOVING THIS DOES NOT BREAK ANYTHING VISIBLY. Every result keeps its
          href and still goes to the right page — as a full page load, on a site
          whose whole point is that navigation is instant. That is the failure
          mode to know about, because nothing throws and no test here can see it.

          `useHref` is deliberately not passed: it is only needed under a
          basename, and this site is served from the root.
        */}
        <AriaRouterProvider navigate={navigate}>
          <SiteHeader />
          {children}
          {/* ADR-0011. See site-footer.tsx for what it carries and why. */}
          <SiteFooter />
        </AriaRouterProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return <Outlet />
}
