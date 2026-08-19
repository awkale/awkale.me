import type { ReactNode } from 'react'

import { AssetFigure, ImageGroup } from '../components/asset-image'
import type { ImageGroupBlock, RichTextNode } from './archive'
import type { ImageAsset } from './images'

/**
 * Contentful RichText, rendered to the marks and nodes ADR-0003's schema enables
 * and no further.
 *
 * Lives here rather than in app/routes/project.tsx because that route cannot
 * carry a `loader` yet — see the note in the route — and this renderer should not
 * be held hostage to that. It is finished and tested; the route wires it up when
 * AWK-43 authors the first case study.
 *
 * EMBEDDED BLOCKS NOW RENDER, which is AWK-40's half. ADR-0003 restricts them to
 * `imageGroup` entries and Assets, and both arrive here as bare link ids — so the
 * caller supplies `media`, the two lookups the sweep resolved. WITHOUT `media`
 * every embedded block still renders as nothing, exactly as it did before, which
 * is why a body can be rendered by anything that has no images to hand.
 *
 * ADR-0013'S EAGER RULE LIVES HERE, and it is positional rather than authored:
 * the first image in the document is `loading="eager"` + `fetchpriority="high"`,
 * everything after it is lazy. Counting during the walk is what makes that
 * mechanical — nobody marks an image as the important one, so adding a paragraph
 * above a figure cannot silently demote it. `firstImageEager={false}` says the
 * page already spent its one eager image above the body, on a `coverImage`.
 */
export type RichTextMedia = {
  /** Every image asset in the space, keyed by id. */
  assets: Record<string, ImageAsset>
  /** Every `imageGroup`, links already resolved, keyed by id. */
  groups: Record<string, ImageGroupBlock>
}

/** Mutable only for the duration of one render pass, and created inside it. */
type Walk = { media: RichTextMedia | undefined; firstImageEager: boolean; images: number }

export function RichText({
  node,
  media,
  firstImageEager = true,
}: {
  node: RichTextNode | null
  media?: RichTextMedia
  firstImageEager?: boolean
}): ReactNode {
  if (!node) return null

  // Per render, NOT per module: a module-level counter would leak across the ~600
  // pages of one prerender and count again on hydration.
  const walk: Walk = { media, firstImageEager, images: 0 }

  return <>{(node.content ?? []).map((child, i) => renderNode(child, i, walk))}</>
}

/** True for the page's first image, and it consumes the slot on the way past. */
function claimPriority(walk: Walk, images: number): boolean {
  const first = walk.images === 0

  // Mutating the walk IS the mechanism — the count has to survive across sibling
  // nodes, and `walk` is created inside one render of `RichText` for exactly that.
  // eslint-disable-next-line no-param-reassign
  walk.images += images

  return first && walk.firstImageEager
}

function renderNode(node: RichTextNode, key: number, walk: Walk): ReactNode {
  const children = (node.content ?? []).map((child, i) => renderNode(child, i, walk))

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
    case 'embedded-asset-block': {
      const asset = walk.media?.assets[node.data?.target?.sys?.id ?? '']

      // An unresolved id means an asset the Delivery API is not serving, or a
      // caller that passed no `media`. Rendering nothing is deliberate: a broken
      // image in a case study is worse than a missing one, and ADR-0010 left
      // nothing that would report either.
      if (!asset) return null

      return <AssetFigure key={key} asset={asset} context="fullWidth" priority={claimPriority(walk, 1)} />
    }
    case 'embedded-entry-block': {
      // ADR-0003 restricts embedded BLOCKS to `imageGroup`, so an id that is not a
      // group is an entry type this renderer has no business guessing at.
      const group = walk.media?.groups[node.data?.target?.sys?.id ?? '']

      if (!group) return null

      return <ImageGroup key={key} group={group} priority={claimPriority(walk, group.images.length)} />
    }
    default:
      // An inline embed (`embedded-asset-inline` and friends) lands here. ADR-0003
      // enables none of them.
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
