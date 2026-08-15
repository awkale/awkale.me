import type { ReactNode } from 'react'

import type { RichTextNode } from './archive'

/**
 * Contentful RichText, rendered to the marks and nodes ADR-0003's schema enables
 * and no further.
 *
 * Lives here rather than in app/routes/project.tsx because that route cannot
 * carry a `loader` yet — see the note in the route — and this renderer should not
 * be held hostage to that. It is finished and tested; the route wires it up when
 * AWK-43 authors the first case study.
 *
 * EMBEDDED BLOCKS ARE NOT RENDERED. ADR-0003 restricts them to `imageGroup` and
 * Assets, and both need Contentful's Image API — sizes, formats, and the `alt`
 * read from each Asset's `title` rather than passed as a prop. That is ADR-0013
 * and AWK-40, a separate ticket with its own decisions to honour. An embedded
 * block renders as nothing rather than as a broken image.
 */
export function RichText({ node }: { node: RichTextNode | null }): ReactNode {
  if (!node) return null

  return <>{(node.content ?? []).map((child, i) => renderNode(child, i))}</>
}

function renderNode(node: RichTextNode, key: number): ReactNode {
  const children = (node.content ?? []).map((child, i) => renderNode(child, i))

  switch (node.nodeType) {
    case 'text':
      return applyMarks(node, key)
    case 'paragraph':
      return <p key={key}>{children}</p>
    case 'heading-1':
      return <h1 key={key}>{children}</h1>
    case 'heading-2':
      return <h2 key={key}>{children}</h2>
    case 'heading-3':
      return <h3 key={key}>{children}</h3>
    case 'heading-4':
      return <h4 key={key}>{children}</h4>
    case 'heading-5':
      return <h5 key={key}>{children}</h5>
    case 'heading-6':
      return <h6 key={key}>{children}</h6>
    case 'unordered-list':
      return <ul key={key}>{children}</ul>
    case 'ordered-list':
      return <ol key={key}>{children}</ol>
    case 'list-item':
      return <li key={key}>{children}</li>
    case 'blockquote':
      return <blockquote key={key}>{children}</blockquote>
    case 'hr':
      return <hr key={key} />
    case 'hyperlink':
      return (
        <a key={key} href={node.data?.uri}>
          {children}
        </a>
      )
    case 'entry-hyperlink':
      // ADR-0003 permits these to ANY entry type, because it restricts embedded
      // BLOCKS and a hyperlink is not one. Resolving an arbitrary entry to a URL
      // needs the same address rules the sweep owns; until a body exists to carry
      // one, the text renders without the link rather than with a wrong one.
      return <span key={key}>{children}</span>
    default:
      // Embedded blocks land here. See the note above.
      return null
  }
}

function applyMarks(node: RichTextNode, key: number): ReactNode {
  let out: ReactNode = node.value ?? ''

  for (const mark of node.marks ?? []) {
    switch (mark.type) {
      case 'bold':
        out = <strong>{out}</strong>
        break
      case 'italic':
        out = <em>{out}</em>
        break
      case 'underline':
        out = <u>{out}</u>
        break
      case 'code':
        out = <code>{out}</code>
        break
      case 'superscript':
        out = <sup>{out}</sup>
        break
      case 'subscript':
        out = <sub>{out}</sub>
        break
      case 'strikethrough':
        out = <s>{out}</s>
        break
      // ADR-0003's enabledMarks list is exactly the seven above, so an eighth
      // would be a schema change — and rendering it unstyled is the right
      // degradation for one.
      // no default
    }
  }

  return <span key={key}>{out}</span>
}
