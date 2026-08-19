import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ImageGroupBlock } from '../lib/archive'
import type { ImageAsset } from '../lib/images'
import { AssetFigure, AssetImage, ImageGroup } from './asset-image'

/**
 * The rendered half of ADR-0013 — attribute NAMES and their presence, which is where
 * this can go wrong without any test in app/lib/images.test.ts noticing.
 *
 * React's `fetchPriority` prop lowercases to the `fetchpriority` attribute, and
 * getting that wrong is a silent no-op rather than an error: the eager tier simply
 * stops being high priority, and only a network panel would show it. So these read
 * `getAttribute`, not props.
 *
 * RTL's auto-cleanup needs an explicit `afterEach` here — vitest globals are off in
 * this project, same as richtext.test.tsx and contact.test.tsx.
 */
const asset = (over: Partial<ImageAsset> = {}): ImageAsset => ({
  id: 'wds-docs-home',
  url: '//images.ctfassets.net/3iiyvj5u5c9h/wds-docs-home/7173e3b2/ux-dv01-waterfall-2560.png',
  title: 'Waterfall Design System documentation site',
  description: 'The dv01 Waterfall Design System documentation at ux.dv01.co.',
  width: 2560,
  height: 1600,
  ...over,
})

const group = (over: Partial<ImageGroupBlock> = {}): ImageGroupBlock => ({
  id: 'grp-sidebars',
  label: 'Sidebar, before and after',
  layout: 'sideBySide',
  caption: null,
  images: [
    asset({ id: 'cision-sidebar-existing', title: 'Before', width: 1333, height: 1474 }),
    asset({ id: 'cision-sidebar-updated', title: 'After', width: 732, height: 1060 }),
  ],
  ...over,
})

describe('AssetImage', () => {
  afterEach(cleanup)

  it('asks THIS origin for every candidate, src and srcset alike', () => {
    // `img-src 'self'` in public/_headers is enforced by the browser, so a candidate
    // addressed to ctfassets is a blocked request rather than a slow one. The
    // ctfassets URL appears only percent-encoded INSIDE the `url` parameter, where it
    // is Netlify's business and never the browser's.
    const { container } = render(<AssetImage asset={asset()} context="fullWidth" />)
    const img = container.querySelector('img')!
    const candidates = [
      img.getAttribute('src')!,
      ...img
        .getAttribute('srcset')!
        .split(', ')
        .map((c) => c.split(' ')[0]),
    ]

    for (const candidate of candidates) {
      expect(candidate.startsWith('/.netlify/images?')).toBe(true)
      expect(new URL(candidate, 'https://awkale.me').host).toBe('awkale.me')
    }
  })

  it('emits width and height, so the image costs no layout shift', () => {
    const { container } = render(<AssetImage asset={asset()} context="fullWidth" />)
    const img = container.querySelector('img')!

    expect(img.getAttribute('width')).toBe('2560')
    expect(img.getAttribute('height')).toBe('1600')
  })

  it('takes alt text from the asset, with no prop to forget', () => {
    const { container } = render(<AssetImage asset={asset()} context="fullWidth" />)

    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Waterfall Design System documentation site')
  })

  it('is lazy with sizes="auto" by default', () => {
    const { container } = render(<AssetImage asset={asset()} context="fullWidth" />)
    const img = container.querySelector('img')!

    expect(img.getAttribute('loading')).toBe('lazy')
    expect(img.getAttribute('sizes')?.startsWith('auto,')).toBe(true)
    expect(img.getAttribute('fetchpriority')).toBeNull()
  })

  it('emits the lowercase fetchpriority attribute on the eager tier', () => {
    // React maps `fetchPriority` → `fetchpriority`. Passing the lowercase prop
    // instead warns and drops it, which nothing else here would catch.
    const { container } = render(<AssetImage asset={asset()} context="fullWidth" priority />)
    const img = container.querySelector('img')!

    expect(img.getAttribute('loading')).toBe('eager')
    expect(img.getAttribute('fetchpriority')).toBe('high')
    expect(img.getAttribute('sizes')).not.toContain('auto')
  })
})

describe('AssetFigure', () => {
  afterEach(cleanup)

  it('captions the image from the asset description, per ADR-0003', () => {
    const { container } = render(<AssetFigure asset={asset()} context="fullWidth" />)

    expect(container.querySelector('figure figcaption')?.textContent).toBe(
      'The dv01 Waterfall Design System documentation at ux.dv01.co.'
    )
  })

  it('emits no figcaption at all for an asset with no description', () => {
    // An empty one takes the figure's spacing and announces an empty region.
    const { container } = render(<AssetFigure asset={asset({ description: '  ' })} context="fullWidth" />)

    expect(container.querySelector('figcaption')).toBeNull()
    expect(container.querySelector('img')).not.toBeNull()
  })
})

describe('ImageGroup', () => {
  afterEach(cleanup)

  it('renders every image in the authored order', () => {
    const { container } = render(<ImageGroup group={group()} />)
    const alts = [...container.querySelectorAll('img')].map((img) => img.getAttribute('alt'))

    expect(alts).toEqual(['Before', 'After'])
  })

  it('tolerates a sideBySide group of three, which the build has already failed on', () => {
    // The sixth invariant fails a build where sideBySide links anything but two, and
    // this still lays out N: Contentful cannot express the cap, so the entry can
    // exist, and a layout that assumed two would render the extra image on top of
    // the row or not at all.
    const three = group({ images: [...group().images, asset({ id: 'third', title: 'Third' })] })
    const { container } = render(<ImageGroup group={three} />)

    expect(container.querySelectorAll('img')).toHaveLength(3)
  })

  it('tolerates a sideBySide group of one, which is what an unpublished asset leaves', () => {
    const one = group({ images: [group().images[0]] })
    const { container } = render(<ImageGroup group={one} />)

    expect(container.querySelectorAll('img')).toHaveLength(1)
  })

  it('renders both copies when a group links the same asset twice', () => {
    // The sixth invariant counts LINKS, so a before/after pair that names one file
    // twice passes the build. Keying on the asset id alone would be a duplicate React
    // key, which React reports as an error and then reconciles unpredictably.
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const twice = group({ images: [group().images[0], group().images[0]] })
    const { container } = render(<ImageGroup group={twice} />)

    expect(container.querySelectorAll('img')).toHaveLength(2)
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })

  it('renders nothing at all when no link resolved', () => {
    const { container } = render(<ImageGroup group={group({ images: [] })} />)

    expect(container.innerHTML).toBe('')
  })

  it('gives priority to the first image only, never to every column', () => {
    const { container } = render(<ImageGroup group={group()} priority />)
    const [first, second] = [...container.querySelectorAll('img')]

    expect(first.getAttribute('loading')).toBe('eager')
    expect(first.getAttribute('fetchpriority')).toBe('high')
    expect(second.getAttribute('loading')).toBe('lazy')
  })

  it('captions the group from the group, not from an asset', () => {
    const { container } = render(<ImageGroup group={group({ caption: 'Before, and after.' })} />)

    expect(container.querySelector('figcaption')?.textContent).toBe('Before, and after.')
  })

  it('stacks an unrecognised layout rather than rendering nothing', () => {
    // A fourth value means ADR-0003's schema moved. Every image still shows.
    const { container } = render(<ImageGroup group={group({ layout: 'carousel' })} />)

    expect(container.querySelectorAll('img')).toHaveLength(2)
  })

  it('sizes a sideBySide image for a column, not for the full width', () => {
    const side = render(<ImageGroup group={group()} />)
      .container.querySelector('img')!
      .getAttribute('sizes')
    cleanup()
    const full = render(<ImageGroup group={group({ layout: 'fullWidth' })} />)
      .container.querySelector('img')!
      .getAttribute('sizes')

    expect(side).not.toBe(full)
  })
})
