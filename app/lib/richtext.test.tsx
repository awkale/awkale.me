import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { ImageGroupBlock, RichTextNode } from './archive'
import type { ImageAsset } from './images'
import { type RichTextMedia, RichText } from './richtext'

/**
 * The renderer is finished ahead of its consumer: `project` holds no entries, so
 * app/routes/project.tsx cannot carry a loader yet and nothing renders this in a
 * build. These tests are what make "finished" a claim rather than a hope.
 *
 * RTL's auto-cleanup needs a global `afterEach`, which this project does not have
 * (vitest globals are off), so the hook is explicit — same as contact.test.tsx.
 * Without it the DOM accumulates across cases and a `querySelector` finds a node
 * the previous test rendered.
 */
const doc = (...content: RichTextNode[]): RichTextNode => ({ nodeType: 'document', content })
const text = (value: string, marks: string[] = []): RichTextNode => ({
  nodeType: 'text',
  value,
  marks: marks.map((type) => ({ type })),
})

describe('RichText', () => {
  afterEach(cleanup)

  it('renders nothing for an absent body', () => {
    const { container } = render(<RichText node={null} />)

    expect(container.innerHTML).toBe('')
  })

  it('renders paragraphs and headings', () => {
    const { container } = render(
      <RichText
        node={doc(
          { nodeType: 'heading-2', content: [text('The problem was never the components')] },
          { nodeType: 'paragraph', content: [text('Four button implementations.')] }
        )}
      />
    )

    expect(container.querySelector('h2')?.textContent).toBe('The problem was never the components')
    expect(container.querySelector('p')?.textContent).toBe('Four button implementations.')
  })

  it('applies each of ADR-0003’s enabled marks', () => {
    const { container } = render(
      <RichText
        node={doc({
          nodeType: 'paragraph',
          content: [text('bold', ['bold']), text('code', ['code']), text('struck', ['strikethrough'])],
        })}
      />
    )

    expect(container.querySelector('strong')?.textContent).toBe('bold')
    expect(container.querySelector('code')?.textContent).toBe('code')
    expect(container.querySelector('s')?.textContent).toBe('struck')
  })

  it('nests marks rather than dropping all but one', () => {
    const { container } = render(
      <RichText node={doc({ nodeType: 'paragraph', content: [text('both', ['bold', 'italic'])] })} />
    )

    expect(container.querySelector('em strong, strong em')?.textContent).toBe('both')
  })

  it('renders a hyperlink with its uri', () => {
    const { container } = render(
      <RichText
        node={doc({
          nodeType: 'paragraph',
          content: [{ nodeType: 'hyperlink', data: { uri: 'https://ux.dv01.co' }, content: [text('the docs site')] }],
        })}
      />
    )

    const link = container.querySelector('a')

    expect(link?.getAttribute('href')).toBe('https://ux.dv01.co')
    expect(link?.textContent).toBe('the docs site')
  })

  it('renders lists', () => {
    const { container } = render(
      <RichText
        node={doc({
          nodeType: 'unordered-list',
          content: [{ nodeType: 'list-item', content: [{ nodeType: 'paragraph', content: [text('one')] }] }],
        })}
      />
    )

    expect(container.querySelectorAll('ul > li')).toHaveLength(1)
  })

  it('skips an embedded block when the caller passes no media', () => {
    // Unchanged from before AWK-40, and deliberately so: a body can be rendered by
    // something that has no images to hand, and a broken image is worse than a
    // missing one. The paragraph after it must survive either way.
    const { container } = render(
      <RichText
        node={doc(
          { nodeType: 'embedded-entry-block', data: { target: { sys: { id: 'img-a' } } } },
          { nodeType: 'paragraph', content: [text('after the figure')] }
        )}
      />
    )

    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('p')?.textContent).toBe('after the figure')
  })

  it('renders an entry-hyperlink as flat text, never as a wrong address', () => {
    const { container } = render(
      <RichText
        node={doc({
          nodeType: 'paragraph',
          content: [
            { nodeType: 'entry-hyperlink', data: { target: { sys: { id: 'prj-a' } } }, content: [text('Agent A')] },
          ],
        })}
      />
    )

    expect(container.querySelector('a')).toBeNull()
    expect(container.querySelector('p')?.textContent).toBe('Agent A')
  })
})

/**
 * The embedded blocks, which are AWK-40's half of this renderer.
 *
 * ADR-0013's eager rule is POSITIONAL — the first image in the document is the eager
 * one — so most of these are about ordering rather than about markup. The markup
 * itself is asserted in app/components/asset-image.test.tsx; what can only be checked
 * here is which image gets the one eager slot, and that a group of two consumes it
 * once rather than twice.
 */
const asset = (id: string, over: Partial<ImageAsset> = {}): ImageAsset => ({
  id,
  url: `//images.ctfassets.net/3iiyvj5u5c9h/${id}/abc123/${id}.png`,
  title: `Alt for ${id}`,
  description: '',
  width: 2560,
  height: 1600,
  ...over,
})

const group = (id: string, over: Partial<ImageGroupBlock> = {}): ImageGroupBlock => ({
  id,
  label: 'Sidebar, before and after',
  layout: 'sideBySide',
  caption: null,
  images: [asset('cision-sidebar-existing'), asset('cision-sidebar-updated')],
  ...over,
})

const media: RichTextMedia = {
  assets: { 'wds-docs-home': asset('wds-docs-home'), 'agent-a-home': asset('agent-a-home') },
  groups: { 'grp-sidebars': group('grp-sidebars') },
}

const embeddedAsset = (id: string): RichTextNode => ({
  nodeType: 'embedded-asset-block',
  data: { target: { sys: { id } } },
})
const embeddedGroup = (id: string): RichTextNode => ({
  nodeType: 'embedded-entry-block',
  data: { target: { sys: { id } } },
})

describe('embedded blocks (ADR-0013)', () => {
  afterEach(cleanup)

  it('renders an embedded asset as a captioned figure', () => {
    const { container } = render(
      <RichText
        node={doc(embeddedAsset('wds-docs-home'))}
        media={{
          ...media,
          assets: { 'wds-docs-home': asset('wds-docs-home', { description: 'The docs site.' }) },
        }}
      />
    )

    expect(container.querySelector('figure img')?.getAttribute('alt')).toBe('Alt for wds-docs-home')
    expect(container.querySelector('figcaption')?.textContent).toBe('The docs site.')
  })

  it('renders an embedded imageGroup with every image it resolved', () => {
    const { container } = render(<RichText node={doc(embeddedGroup('grp-sidebars'))} media={media} />)

    expect(container.querySelectorAll('img')).toHaveLength(2)
  })

  it('renders nothing for an id that resolves to neither, and keeps going', () => {
    // An asset the Delivery API is not serving, or an embedded entry of some type
    // ADR-0003 does not permit as a block.
    const { container } = render(
      <RichText
        node={doc(embeddedAsset('deleted-asset'), { nodeType: 'paragraph', content: [text('after the figure')] })}
        media={media}
      />
    )

    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('p')?.textContent).toBe('after the figure')
  })

  it('makes the first image in the document eager and every later one lazy', () => {
    const { container } = render(
      <RichText
        node={doc(
          { nodeType: 'paragraph', content: [text('A paragraph above cannot demote the figure below it.')] },
          embeddedAsset('wds-docs-home'),
          embeddedAsset('agent-a-home')
        )}
        media={media}
      />
    )
    const [first, second] = [...container.querySelectorAll('img')]

    expect(first.getAttribute('loading')).toBe('eager')
    expect(first.getAttribute('fetchpriority')).toBe('high')
    expect(second.getAttribute('loading')).toBe('lazy')
  })

  it('spends the eager slot once on a group, not once per image in it', () => {
    const { container } = render(
      <RichText node={doc(embeddedGroup('grp-sidebars'), embeddedAsset('wds-docs-home'))} media={media} />
    )
    const eager = [...container.querySelectorAll('img')].filter((img) => img.getAttribute('loading') === 'eager')

    expect(eager).toHaveLength(1)
    expect(container.querySelectorAll('img')).toHaveLength(3)
  })

  it('makes every body image lazy when the page already spent its eager slot', () => {
    // A case study with a coverImage above the body. The cover is the page's first
    // image, so nothing in the body may claim `fetchpriority="high"` as well.
    const { container } = render(
      <RichText node={doc(embeddedAsset('wds-docs-home'))} media={media} firstImageEager={false} />
    )
    const img = container.querySelector('img')!

    expect(img.getAttribute('loading')).toBe('lazy')
    expect(img.getAttribute('fetchpriority')).toBeNull()
    expect(img.getAttribute('sizes')?.startsWith('auto,')).toBe(true)
  })

  it('counts a nothing-rendered block as no image at all', () => {
    // An unresolved id must not consume the eager slot, or an unpublished asset
    // would silently make the page's real first image lazy.
    const { container } = render(
      <RichText node={doc(embeddedAsset('deleted-asset'), embeddedAsset('wds-docs-home'))} media={media} />
    )

    expect(container.querySelector('img')?.getAttribute('loading')).toBe('eager')
  })
})
