import { Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router'

import { SiteFooter } from './components/site-footer'
import { SiteHeader } from './components/site-header'
import { themeScript } from './lib/mode'

import './app.css'

export function Layout({ children }: { children: React.ReactNode }) {
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

          NO `type` attribute, deliberately. public/favicon.ico is 32x32 PNG
          data despite the extension (it is the old site's 363-byte file, byte
          for byte), so naming a type would either misdescribe the bytes or
          contradict the extension. Browsers sniff the content and render it
          correctly; asserting the wrong MIME is what would break them.

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

          One caveat on how far the .ico reaches: it is PNG bytes, so it serves
          anything that sniffs content — every browser — but a consumer that
          parses the ICO container strictly will reject it, header and all. That
          is the same file the old site served for a decade, so this is not a
          regression; it is just narrower than "the .ico covers everything else".

          Colour is one value for both schemes (#f76b15) rather than a
          prefers-color-scheme rule. A theme-aware fill worked, but only in the
          browsers that take the SVG — Safari would still have shown a near-black
          mark from the .ico, so the inversion bought a consistency it could not
          finish.
        */}
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      </head>
      <body>
        <SiteHeader />
        {children}
        {/* ADR-0011. See site-footer.tsx for what it carries and why. */}
        <SiteFooter />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return <Outlet />
}
