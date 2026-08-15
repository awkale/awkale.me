import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { RichTextNode } from './archive'
import { RichText } from './richtext'

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

  it('skips an embedded block rather than emitting a broken image', () => {
    // ADR-0013 and AWK-40 own asset delivery. Rendering nothing is the deliberate
    // degradation until that lands — and the paragraph after it must survive.
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
