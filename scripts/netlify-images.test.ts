import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { imageUrl } from '../app/lib/images'

/**
 * `netlify.toml`'s `[images]` allowlist — the four lines ADR-0013 buys the site's
 * whole image pipeline with.
 *
 * Asserted here because the two ways to get it wrong are both invisible:
 *
 *  1. WRITTEN IN DOUBLE QUOTES, a TOML basic string consumes each `\` before the
 *     regex sees it, so `\.` arrives as `.` and the pattern matches any character
 *     in those positions — a quietly wider allowlist than the record decided.
 *     Netlify's own documented example is written that way.
 *  2. A PATTERN THAT DOES NOT MATCH what app/lib/images.ts emits fails at REQUEST
 *     time with a 400 and reports nothing, because ADR-0010 left this project with
 *     no server log and no error monitoring.
 *
 * So the last test below is the one that matters most: it runs the committed pattern
 * against a URL the helper actually builds. Neither half can drift without failing.
 */
const TOML = readFileSync(join(import.meta.dirname, '..', 'netlify.toml'), 'utf8')

/** The raw right-hand side, quotes included — the quoting IS the thing under test. */
const declaration = /^remote_images\s*=\s*\[(.+)\]\s*$/m.exec(TOML)?.[1] ?? ''

/** The pattern as Netlify will compile it, once TOML has handed over the literal. */
const patterns = [...declaration.matchAll(/'([^']*)'/g)].map((match) => match[1])

/**
 * Netlify's matcher, simulated as a WHOLE-URL match.
 *
 * A bare `.test()` would be a substring search, which is the weaker of the two
 * semantics Netlify's documentation leaves open — and a test that models the weaker
 * one would pass an unanchored pattern that an open-proxy URL satisfies. The pattern
 * carries its own `^`/`$` as well; both halves are asserted below.
 */
const matches = (url: string): boolean => new RegExp(`^(?:${patterns[0]})$`).test(url)

/** One real asset, as the CDA returns it: protocol-relative, no query string. */
const SOURCE = '//images.ctfassets.net/3iiyvj5u5c9h/wds-docs-home/7173e3b2/ux-dv01-waterfall-2560.png'

describe('the [images] block', () => {
  it('exists at all, or every image on the site 400s', () => {
    expect(TOML).toContain('[images]')
    expect(patterns).toHaveLength(1)
  })

  it('is a TOML literal string, so a backslash stays a backslash', () => {
    // Double quotes here would need `\\.` to mean the same thing, and Netlify's
    // documented example omits the escapes entirely rather than doubling them.
    expect(declaration.trim().startsWith("'")).toBe(true)
    expect(declaration).not.toContain('"')
  })

  it('escapes the dots, so they match dots and not any character', () => {
    expect(patterns[0]).toContain('images\\.ctfassets\\.net')
  })

  it('is scoped to this space, not to the whole domain', () => {
    // Domain-wide would let awkale.me fetch, transform and serve any Contentful
    // customer's public asset. ADR-0013 rejected that explicitly.
    expect(patterns[0]).toContain('/3iiyvj5u5c9h/')
    expect(matches('https://images.ctfassets.net/someoneelse/x/y/logo.png')).toBe(false)
  })

  it('requires https, which is why app/lib/images.ts adds the scheme', () => {
    expect(patterns[0]).toContain('https://')
    expect(matches(SOURCE)).toBe(false)
  })

  it('is anchored, so it cannot be satisfied by a URL that merely CONTAINS one', () => {
    // Netlify documents these as whole-URL matches, but that is their word rather
    // than something this repo can see. Under substring semantics an unanchored
    // pattern makes the site an open image proxy for anyone who appends an
    // allowlisted URL to their own. Anchoring is true under either reading.
    expect(patterns[0].startsWith('^')).toBe(true)
    expect(patterns[0].endsWith('$')).toBe(true)
    expect(matches(`https://attacker.example/r?u=${SOURCE.replace('//', 'https://')}`)).toBe(false)
  })

  it('matches what the helper actually sends — the assertion neither side can dodge', () => {
    // Also the space-id cross-check: app/lib/images.ts carries `3iiyvj5u5c9h` as its
    // own constant (it cannot read the env, since it runs in the browser too), so if
    // either side moved without the other, this either throws or fails to match.
    const url = new URL(imageUrl(SOURCE, 960), 'https://awkale.me').searchParams.get('url')!

    expect(matches(url)).toBe(true)
  })
})
