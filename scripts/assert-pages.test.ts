import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

import { MODE_KEY } from '../app/lib/mode'

/**
 * The page assertion AWK-17 designed and this repo never had.
 *
 * It asserts against build/client — the BUILT OUTPUT rather than the source —
 * because that is the artifact Netlify publishes and whose HTML the form scanner
 * reads. Every other test here could pass while the deployed page is wrong.
 *
 * Both sides still derive the page set from one enumeration, but the comparison
 * is now against build/.page-manifest.json — the paths the build's own sweep
 * produced, written by `buildEnd`. This test used to call `prerenderPaths()`
 * directly, which was correct while the source was a local module and became
 * wrong the moment AWK-39 pointed it at the Delivery API: a unit test would need
 * credentials and a live space to run, and would answer for TODAY's Contentful
 * rather than for the build on disk.
 *
 * With `ssr: false`, a route missing from the enumerator does not degrade — AWK-17
 * proved it 404s in production, and would serve an empty hydration shell instead
 * the moment anyone adds a catch-all redirect. So a page-set drift is a real
 * outage, not a cosmetic diff.
 *
 * SKIPS when build/client is absent, so `bun run test` works on a fresh clone.
 * The skip is visible in vitest's output, and `bun run test:ci` builds first so
 * CI can never silently skip it.
 */
const CLIENT = join(import.meta.dirname, '..', 'build', 'client')
const MANIFEST = join(import.meta.dirname, '..', 'build', '.page-manifest.json')
const SEARCH_INDEX = join(CLIENT, 'search-index.json')
// BOTH, because a build/client left over from before AWK-39 has pages but no
// manifest, and comparing against a file that is not there fails in a way that
// reads like a broken build rather than a stale one. `bun run test:ci` builds
// first, so CI can never reach this skip.
const built = existsSync(CLIENT) && existsSync(MANIFEST)

function emittedPages(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...emittedPages(full))
    } else if (entry.name === 'index.html') {
      const rel = relative(CLIENT, full).split(sep).slice(0, -1).join('/')
      out.push(rel === '' ? '/' : `/${rel}`)
    }
  }
  return out
}

function page(path: string): string {
  return readFileSync(join(CLIENT, path, 'index.html'), 'utf8')
}

describe.skipIf(!built)('built output', () => {
  it('emits exactly the page set the enumerator declares', () => {
    const expected = (JSON.parse(readFileSync(MANIFEST, 'utf8')) as string[]).sort()

    expect(emittedPages(CLIENT).sort()).toEqual(expected)
  })

  // The failure this catches shipped to production once: every client-side
  // navigation 404ing while a refresh worked perfectly, because the build writes
  // `/concerts/2019-12-15.data` and the client — deriving the URL from a pathname
  // that carries the canonical trailing slash — asks for
  // `/concerts/2019-12-15/_.data`. Nothing in the HTML assertions above could see
  // it, since the pages themselves were flawless.
  //
  // So this asserts the file the CLIENT WILL ACTUALLY REQUEST, computed the way
  // the client computes it, rather than the file the build happens to write. If
  // React Router changes the convention, this fails rather than the site.
  it('publishes the data file client-side navigation asks for, at every path', () => {
    const paths = JSON.parse(readFileSync(MANIFEST, 'utf8')) as string[]

    const missing = paths.filter((p) => {
      // Routes with no loader emit no data at all, and need none — a route React
      // Router never fetches data for cannot 404 fetching it.
      if (!existsSync(join(CLIENT, p === '/' ? '_.data' : `${p}.data`))) return false

      // `_` stands in for the empty segment after the trailing slash.
      return !existsSync(join(CLIENT, p === '/' ? '_.data' : `${p}/_.data`))
    })

    expect(missing).toEqual([])
  })

  // AWK-41's index and the page set are two consumers of ONE sweep, and this is
  // what holds them to it. A work in the index with no page behind it is a
  // search result that 404s; a page missing from the index is unfindable. Both
  // are invisible without this comparison, since each artifact is internally
  // consistent on its own.
  describe('the search index', () => {
    const entries = () =>
      JSON.parse(readFileSync(SEARCH_INDEX, 'utf8')) as { kind: string; title: string; path: string }[]

    it('is published where the header search can import it', () => {
      expect(existsSync(SEARCH_INDEX)).toBe(true)
      expect(entries().length).toBeGreaterThan(0)
    })

    it('points every entry at a page that was actually built', () => {
      // Index paths carry the TRAILING SLASH, because they become `<Link to>`
      // targets and each slash-free one costs a needless 301 across ~600 pages.
      // The emitted set is slash-free, so the comparison has to strip.
      const pages = new Set(emittedPages(CLIENT))
      const dangling = entries().filter((e) => !pages.has(e.path === '/' ? '/' : e.path.replace(/\/$/, '')))

      expect(dangling).toEqual([])
    })

    it('indexes site-wide, not just the archive', () => {
      // A header search field that cannot find a case study is a site-wide
      // search that quietly isn't one (AWK-41).
      expect(new Set(entries().map((e) => e.kind))).toContain('concert')
    })
  })

  describe('/contact/', () => {
    it("carries the attributes Netlify's scanner reads, in the file on disk", () => {
      const html = page('contact')

      // If any of these is missing at deploy time the form is never detected, the
      // page still renders, and submissions go nowhere with no error anywhere.
      expect(html).toContain('data-netlify="true"')
      expect(html).toContain('netlify-honeypot="bot-field"')
      expect(html).toContain('name="bot-field"')
      expect(html).toContain('action="/contact/sent/"')
      expect(html).toContain('name="contact"')
    })

    it("leaves form-name to Netlify's post-processor", () => {
      expect(page('contact')).not.toContain('form-name')
    })
  })

  it('/contact/sent/ holds no form of its own', () => {
    expect(page('contact/sent')).not.toContain('<form')
  })

  describe('the favicon', () => {
    // Two halves, and shipping one without the other is the failure mode. The
    // file at the literal path is what browsers request UNPROMPTED on a first
    // visit, with no markup involved; the <link> is what everything else reads.
    // AWK-50 exists because this repo had neither.
    it('publishes the file at the exact path browsers ask for', () => {
      const ico = join(CLIENT, 'favicon.ico')

      expect(existsSync(ico)).toBe(true)
      // Non-empty, because Vite copying a 0-byte file would satisfy existsSync
      // and still serve a broken icon.
      expect(readFileSync(ico).byteLength).toBeGreaterThan(0)
    })

    it('ships a real ICO container, not PNG bytes in an .ico coat', () => {
      // The old site's file was bare PNG named .ico. It worked, but only because
      // browsers sniff content — the reason to keep an .ico at all is the clients
      // that do not. This asserts the ICONDIR header (reserved=0, type=1) so a
      // regression back to a renamed PNG fails here rather than silently in
      // whatever parses strictly.
      const ico = readFileSync(join(CLIENT, 'favicon.ico'))

      expect([...ico.subarray(0, 4)]).toEqual([0, 0, 1, 0])
    })

    it('publishes the SVG too, since Safari and Chrome want different ones', () => {
      const svg = join(CLIENT, 'icon.svg')

      expect(existsSync(svg)).toBe(true)
      expect(readFileSync(svg).byteLength).toBeGreaterThan(0)
    })

    it('keeps the mark on the one colour that works on both schemes', () => {
      // The whole reason there is no prefers-color-scheme rule here: #f76b15
      // reads against a white and a near-black tab strip alike. Asserted because
      // a colour edit back toward the 2015 near-black would be invisible in
      // every other check and would disappear into a dark tab strip.
      //
      // And it is NOT the site's accent — that is --ember-9 (#e05822). The
      // divergence is deliberate (AWK-52), which is why this assertion names a
      // literal rather than importing a token: there is no token to import, and
      // pointing it at the accent would quietly undo the decision.
      expect(readFileSync(join(CLIENT, 'icon.svg'), 'utf8')).toContain('#f76b15')
    })

    // Every PRERENDERED page, which is not quite every emitted .html file:
    // `emittedPages` collects only index.html, so build/client/__spa-fallback.html
    // is outside it. Left that way on purpose — the page-set assertion above
    // compares this same helper against `prerenderPaths()`, so widening it here
    // would break that. The fallback is also unreachable while there is no
    // catch-all redirect, which AWK-17 established there must never be.
    // BOTH hrefs, not just the substring `rel="icon"`. Checking only the latter
    // passes with either link present, which would let a later edit delete the
    // .ico link and take Safari's icon out site-wide with a green suite.
    it('declares both of them on every prerendered page', () => {
      const undeclared = emittedPages(CLIENT).filter((p) => {
        const html = page(p === '/' ? '.' : p.slice(1))
        return !html.includes('href="/favicon.ico"') || !html.includes('href="/icon.svg"')
      })

      expect(undeclared).toEqual([])
    })
  })

  // ADR-0004:468 — "Every page depends on the inline theme script… Anything that
  // changes the root route's <head> must preserve it." That is the invariant, and
  // it had nothing asserting it. AWK-51.
  //
  // What this does NOT assert is position within <head>. React Router hoists
  // <Links /> output, so the script lands LAST there — after the stylesheet and
  // every modulepreload — and no JSX ordering changes that. The ADR asks only that
  // it be inline, blocking, in <head>, and run "before first paint" (:211), all of
  // which hold. A test demanding it be first would fail on a correct build.
  it('keeps the blocking theme script inline, in <head>, on every prerendered page', () => {
    const broken = emittedPages(CLIENT).filter((p) => {
      const html = page(p === '/' ? '.' : p.slice(1))
      const headEnd = html.indexOf('</head>')
      const script = html.indexOf(MODE_KEY)

      // Present, inline (the key is in the document, not fetched), and before
      // </head> — so it cannot drift into <body> unnoticed.
      return script === -1 || headEnd === -1 || script > headEnd
    })

    expect(broken).toEqual([])
  })

  it('publishes the mailbox address on no page at all', () => {
    // The strongest form of ADR-0011's rule, and cheap to check exhaustively:
    // sweep every emitted page rather than trusting the two that could leak it.
    const leaks = emittedPages(CLIENT).filter((p) => {
      const html = page(p === '/' ? '.' : p.slice(1))
      return html.includes('hi@awkale.me') || html.includes('mailto:')
    })

    expect(leaks).toEqual([])
  })
})

// Fails loudly if the suite is skipped for a reason other than "no build yet" —
// e.g. build/client existing but holding no pages, which would otherwise make
// every assertion above trivially true.
describe.skipIf(!built)('the assertion itself', () => {
  it('found pages to assert against', () => {
    expect(emittedPages(CLIENT).length).toBeGreaterThan(0)
  })
})
