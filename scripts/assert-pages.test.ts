import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

import { prerenderPaths } from '../app/lib/prerender-paths'

/**
 * The page assertion AWK-17 designed and this repo never had.
 *
 * It asserts against build/client — the BUILT OUTPUT rather than the source —
 * because that is the artifact Netlify publishes and whose HTML the form scanner
 * reads. Every other test here could pass while the deployed page is wrong.
 *
 * Both sides derive the page set from `prerenderPaths()`, which is the whole
 * reason that function lives in app/lib/ instead of inline in
 * react-router.config.ts. Agreeing by hand would defeat it.
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
const built = existsSync(CLIENT)

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
  it('emits exactly the page set the enumerator declares', async () => {
    const expected = (await prerenderPaths()).sort()

    expect(emittedPages(CLIENT).sort()).toEqual(expected)
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
