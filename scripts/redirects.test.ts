import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * `public/_redirects` — asserted as PROPERTIES, not as a copy of itself.
 *
 * A test that restated each of the thirteen targets would be the same file written
 * twice, and would pass just as happily if both copies were wrong — which is the
 * failure ADR-0002's gist table already demonstrated. So the assertions here are
 * what can be checked without a second source: the shape of every rule, the count,
 * the absence of a catch-all, and DISTINCTNESS of the gist ids, which is how a
 * copy-paste error in this file would actually present.
 *
 * The one thing no local test can verify is whether each sheet points at the RIGHT
 * gist. Only `~/Sites/awkale.github.io/_cheatsheets/*.md` knows that, it is outside
 * this repository, and a wrong-but-live gist returns 200 — so neither this suite nor
 * the curl sweep would flag it. That check is a human reading those files against
 * the table in ADR-0002, once.
 *
 * Both the source file and the built copy are asserted: `public/_redirects` only
 * takes effect because Vite copies it to build/client, and a file that stops being
 * copied would break every redirect while this test still passed.
 */
const SOURCE = join(import.meta.dirname, '..', 'public', '_redirects')
const BUILT = join(import.meta.dirname, '..', 'build', 'client', '_redirects')

type Rule = { from: string; to: string; status: string }

function parse(path: string): Rule[] {
  return readFileSync(path, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '' && !l.startsWith('#'))
    .map((l) => {
      const [from, to, status] = l.split(/\s+/)
      return { from, to, status }
    })
}

const rules = parse(SOURCE)

describe('public/_redirects', () => {
  it("holds exactly the thirteen rules of ADR-0001's ledger", () => {
    expect(rules).toHaveLength(13)
  })

  it('adds no catch-all, which would turn every 404 into an empty shell', () => {
    // AWK-17's finding, and the reason reserved paths 404 honestly. A splat source
    // of any kind is the thing to keep out; `/*` is only its most common spelling.
    const splats = rules.filter((r) => r.from.includes('*'))

    expect(splats).toEqual([])
  })

  it('issues real 301s on every rule', () => {
    // 301 is the whole reason this site is not on GitHub Pages (ADR-0002).
    expect(rules.map((r) => r.status)).toEqual(Array(13).fill('301'))
  })

  it('writes every source slash-free and absolute', () => {
    // Slash-free so one rule catches both live forms, Netlify normalizing the
    // trailing slash. curl-sweep.sh tests that normalization rather than trusting it.
    for (const r of rules) {
      expect(r.from.startsWith('/')).toBe(true)
      expect(r.from === '/' || !r.from.endsWith('/')).toBe(true)
    }
  })

  it('sends all three portfolio URLs to the /projects/ index', () => {
    // AWK-21: both /portfolios/ items ship index-only, so the case studies the
    // original ledger aimed at will never exist.
    const portfolio = rules.filter((r) => r.from.startsWith('/portfolio'))

    expect(portfolio).toHaveLength(3)
    for (const r of portfolio) expect(r.to).toBe('/projects/')
  })

  it('lists the two /portfolios/ entries individually, never as a splat', () => {
    const froms = rules.map((r) => r.from)

    expect(froms).toContain('/portfolios/c3_sidebar')
    expect(froms).toContain('/portfolios/c3_wizard')
  })

  it('points the nine cheatsheet URLs at absolute gist URLs', () => {
    const sheets = rules.filter((r) => r.from.startsWith('/cheatsheets'))

    expect(sheets).toHaveLength(9)
    for (const r of sheets) expect(r.to.startsWith('https://gist.github.com/awkale')).toBe(true)
  })

  it('gives each cheatsheet a DISTINCT gist', () => {
    // The realistic way this file goes wrong: a duplicated line whose id was never
    // updated. Eight sheets, eight different gists, plus the bare index.
    const ids = rules
      .filter((r) => r.from.startsWith('/cheatsheets/'))
      .map((r) => r.to.replace('https://gist.github.com/awkale/', ''))

    expect(ids).toHaveLength(8)
    expect(new Set(ids).size).toBe(8)
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]+$/)
  })

  it('sends redirect thirteen to the repo, not to the slide deck', () => {
    // ADR-0001 missed this URL entirely; it is the only one here with an organic
    // audience, and awkale.github.io/... was rejected as a target whose behaviour
    // depends on what Pages does once the CNAME is removed.
    const rule = rules.find((r) => r.from === '/user-story-best-practice')

    expect(rule?.to).toBe('https://github.com/awkale/user-story-best-practice')
  })

  it('never targets the retired apex or the old Pages host', () => {
    // A redirect pointing back at the site it replaces would loop at cutover.
    for (const r of rules) {
      expect(r.to).not.toContain('awkale.github.io')
      expect(r.to).not.toMatch(/^https?:\/\/(www\.)?awkale\.me/)
    }
  })
})

describe.skipIf(!existsSync(BUILT))('built _redirects', () => {
  it('is copied to build/client byte-for-byte, or none of it applies', () => {
    expect(readFileSync(BUILT, 'utf8')).toBe(readFileSync(SOURCE, 'utf8'))
  })
})
