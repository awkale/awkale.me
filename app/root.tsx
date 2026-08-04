import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import { themeScript } from "./lib/mode";
import { SiteHeader } from "./components/site-header";
import { SiteFooter } from "./components/site-footer";
import "./app.css";

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
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />

        {/* One preload per above-the-fold face. */}
        <link
          rel="preload"
          href="/fonts/fraunces-latin-var.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/inter-latin-var.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
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
  );
}

export default function App() {
  return <Outlet />;
}
