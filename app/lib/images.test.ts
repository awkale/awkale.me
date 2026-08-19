import { describe, expect, it } from 'vitest'

import { type ImageAsset, imageAttrs, imageUrl, ladderFor } from './images'

/**
 * ADR-0013's delivery rules, asserted where they can actually be checked.
 *
 * Three of these guard failures that are INVISIBLE in production. ADR-0010 gave up
 * every server log and any error monitoring, so a `/.netlify/images` request that
 * 400s shows a broken image to a visitor and reports nothing to anyone. That is why
 * this file leans on the URL shape rather than on eyeballing a deployed page.
 *
 * The fixtures are the real assets AWK-42 uploaded, at their measured dimensions —
 * `existing_sidebar.jpg` at 1333 × 1474 and `updated_sidebar.jpg` at 732 × 1060 are
 * the two the ticket's original 650/960/1400 ladder overshot, and 2560 × 1600 is the
 * only source with headroom for all three rungs.
 */
const asset = (over: Partial<ImageAsset> = {}): ImageAsset => ({
  id: 'wds-docs-home',
  // Contentful's own shape: PROTOCOL-RELATIVE, and that is the landmine below.
  url: '//images.ctfassets.net/3iiyvj5u5c9h/wds-docs-home/7173e3b2/ux-dv01-waterfall-2560.png',
  title: 'Waterfall Design System documentation site',
  description: 'The dv01 Waterfall Design System documentation at ux.dv01.co.',
  width: 2560,
  height: 1600,
  ...over,
})

const narrow = () =>
  asset({
    id: 'cision-sidebar-updated',
    url: '//images.ctfassets.net/3iiyvj5u5c9h/cision-sidebar-updated/2a19ad5b/updated_sidebar.jpg',
    title: 'Cision navigation sidebar, after the redesign',
    description: 'The redesigned Cision sidebar.',
    width: 732,
    height: 1060,
  })

describe('imageUrl', () => {
  it('addresses this origin, never images.ctfassets.net', () => {
    // The whole point of ADR-0013: `img-src 'self'` in public/_headers holds only
    // because the browser asks awkale.me for every image.
    const url = imageUrl(asset().url, 960)

    expect(url.startsWith('/.netlify/images?')).toBe(true)
  })

  it('gives the Contentful URL a scheme, because Contentful does not', () => {
    // THE FAILURE THIS EXISTS TO PREVENT. The CDA returns `//images.ctfassets.net/…`
    // and netlify.toml's allowlist is anchored on `https://`, so passing the field
    // through verbatim matches no pattern and every image 400s — with no log, per
    // ADR-0010, and no build failure.
    const url = new URL(imageUrl(asset().url, 960), 'https://awkale.me')

    expect(url.searchParams.get('url')).toBe(
      'https://images.ctfassets.net/3iiyvj5u5c9h/wds-docs-home/7173e3b2/ux-dv01-waterfall-2560.png'
    )
  })

  it('leaves an already-absolute https URL alone', () => {
    const url = new URL(imageUrl(`https:${asset().url}`, 960), 'https://awkale.me')

    expect(url.searchParams.get('url')).toBe(
      'https://images.ctfassets.net/3iiyvj5u5c9h/wds-docs-home/7173e3b2/ux-dv01-waterfall-2560.png'
    )
  })

  it('percent-encodes the source, so a filename with a space survives', () => {
    // Not hypothetical: the retired repo's screenshots are named `01 - Step 1@2x.png`.
    // An unencoded space breaks the query string at the proxy, not at the build.
    const url = imageUrl('//images.ctfassets.net/3iiyvj5u5c9h/x/y/01 - Step 1@2x.png', 650)

    expect(url).toContain('01%20-%20Step%201')
    expect(url).not.toContain('01 - Step 1')
  })

  it('carries the width and NOTHING else — no chained Contentful params, no fm', () => {
    // `fm` is omitted so Netlify content-negotiates on Accept: AVIF where it is
    // supported, something Safari can read otherwise, with no format hardcoded.
    const url = new URL(imageUrl(asset().url, 1400), 'https://awkale.me')

    expect([...url.searchParams.keys()]).toEqual(['url', 'w'])
    expect(url.searchParams.get('w')).toBe('1400')
  })

  it('refuses a source outside the allowlisted host, loudly and at build time', () => {
    // The alternative is a 400 nobody sees. netlify.toml is space-scoped on
    // purpose, so anything else is a mistake worth failing the build over.
    expect(() => imageUrl('https://example.com/screenshot.png', 960)).toThrow(/images\.ctfassets\.net/)
  })

  it('refuses an asset from a DIFFERENT Contentful space', () => {
    // The allowlist is space-scoped, so this is as unservable as another domain —
    // and it is the realistic version: a migration, or a file copied in from another
    // space, whose URL looks entirely correct.
    expect(() => imageUrl('//images.ctfassets.net/someoneelse/x/y/logo.png', 960)).toThrow(/3iiyvj5u5c9h/)
  })

  it('names both places that have to change if the space legitimately moves', () => {
    expect(() => imageUrl('//images.ctfassets.net/someoneelse/x/y/logo.png', 960)).toThrow(/netlify\.toml/)
  })

  it('refuses a width that is not a positive integer', () => {
    expect(() => imageUrl(asset().url, 0)).toThrow(/width/i)
    expect(() => imageUrl(asset().url, -650)).toThrow(/width/i)
  })
})

describe('ladderFor', () => {
  it('emits every rung a 2560px source can serve, plus the source itself', () => {
    expect(ladderFor(2560)).toEqual([650, 960, 1400, 2560])
  })

  it('never upscales: a 732px source stops at 732', () => {
    // AWK-40's own comment measured this. Netlify would happily serve `w=1400`
    // from a 732px file — blurrier than the source, for more bytes.
    expect(ladderFor(732)).toEqual([650, 732])
  })

  it('drops only the rungs that overshoot, keeping the ones that fit', () => {
    expect(ladderFor(1333)).toEqual([650, 960, 1333])
  })

  it('collapses to a single rung for a source smaller than the smallest', () => {
    expect(ladderFor(400)).toEqual([400])
  })

  it('does not repeat a rung when the source width IS a rung', () => {
    expect(ladderFor(960)).toEqual([650, 960])
  })
})

describe('imageAttrs', () => {
  it('emits the intrinsic dimensions, so no image costs a layout shift', () => {
    expect(imageAttrs(asset(), { context: 'fullWidth' })).toMatchObject({ width: 2560, height: 1600 })
  })

  it('takes alt text from the asset title, per ADR-0003', () => {
    expect(imageAttrs(asset(), { context: 'fullWidth' }).alt).toBe('Waterfall Design System documentation site')
  })

  it('builds one srcset rung per ladder width', () => {
    const { srcSet } = imageAttrs(narrow(), { context: 'sideBySide' })

    expect(srcSet.split(', ')).toHaveLength(2)
    expect(srcSet).toContain('&w=650 650w')
    expect(srcSet).toContain('&w=732 732w')
  })

  it('points src at the largest rung that is not oversized for a default box', () => {
    expect(imageAttrs(asset(), { context: 'fullWidth' }).src).toContain('&w=960')
  })

  it('points src at the top rung when the source cannot reach that width', () => {
    expect(imageAttrs(narrow(), { context: 'sideBySide' }).src).toContain('&w=732')
  })

  describe('the two tiers', () => {
    it('makes everything after the first image lazy, with sizes="auto" first', () => {
      const attrs = imageAttrs(asset(), { context: 'fullWidth' })

      expect(attrs.loading).toBe('lazy')
      expect(attrs.sizes.startsWith('auto,')).toBe(true)
      expect(attrs.fetchPriority).toBeUndefined()
    })

    it('makes the first image on a page eager and high priority', () => {
      const attrs = imageAttrs(asset(), { context: 'fullWidth', priority: true })

      expect(attrs.loading).toBe('eager')
      expect(attrs.fetchPriority).toBe('high')
    })

    it('NEVER pairs sizes="auto" with loading="eager", which cannot resolve', () => {
      // The specification, not a quirk: `auto` needs `lazy` or the value is
      // unresolvable and the browser falls through to the rest of the list. The
      // eager tier therefore keeps an explicit `sizes`, and this function is the
      // only place the pair is decided — so the invalid combination is
      // unconstructible rather than merely documented.
      expect(imageAttrs(asset(), { context: 'fullWidth', priority: true }).sizes).not.toContain('auto')
    })

    it('keeps a hand-written fallback in BOTH tiers, because Safari ignores auto', () => {
      // Blocked from Baseline since April 2026 on WebKit 253143, and a design
      // portfolio's audience skews Safari. Deleting these is a scheduled deletion
      // for whenever WebKit ships — see ADR-0013.
      const lazy = imageAttrs(asset(), { context: 'card' })
      const eager = imageAttrs(asset(), { context: 'card', priority: true })

      expect(lazy.sizes).toContain('vw')
      expect(eager.sizes).toContain('vw')
    })
  })

  it('sizes a stacked layout at the full column below its breakpoint', () => {
    // sideBySide and grid BOTH collapse to one image per row on a phone
    // (app/components/asset-image.tsx), so the narrow term has to be the full column
    // and not the column half. Getting this wrong tells the browser the slot is half
    // its real size, and it picks a rung too small — a soft image on exactly the
    // Safari viewports the fallback list exists for.
    const sides = imageAttrs(asset(), { context: 'sideBySide' }).sizes

    expect(sides.endsWith('94vw')).toBe(true)
    expect(sides).toContain('(min-width: 40rem) 47vw')
    expect(imageAttrs(asset(), { context: 'grid' }).sizes.endsWith('94vw')).toBe(true)
  })

  it('sizes fullWidth at the reading column, which is what it actually measures', () => {
    // Nothing gives a body figure a break-out to --width-wide yet, so claiming
    // 1280px would fetch the 1400w rung for a 672px box. Raise this when the
    // break-out lands, not before.
    expect(imageAttrs(asset(), { context: 'fullWidth' }).sizes).toContain('672px')
  })

  it('varies the fallback by context, since there are only four', () => {
    const contexts = (['card', 'sideBySide', 'grid', 'fullWidth'] as const).map(
      (context) => imageAttrs(asset(), { context }).sizes
    )

    expect(new Set(contexts).size).toBe(4)
  })
})
