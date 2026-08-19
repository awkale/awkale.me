import type { ImageGroupBlock } from '../lib/archive'
import { type ImageAsset, type ImageContext, imageAttrs } from '../lib/images'
import { cn } from '../lib/utils'

/**
 * ADR-0013's markup rule, as the only `<img>` this site emits.
 *
 * Every attribute comes from `app/lib/images.ts` — the URLs, the ladder, and which
 * of the two `loading` tiers this image is in. Nothing here decides any of that,
 * which is what keeps a hosting move to one edit.
 *
 * ADR-0003 supplies the other half: alt text is the Asset's `title` and the caption
 * is its `description`, both read from the asset rather than passed at the call site.
 * So there is no `alt` prop to forget, and a caption appears because someone
 * described the asset in Contentful — the reason a reused screenshot carries the same
 * caption everywhere, which that record accepted explicitly.
 */
export function AssetImage({
  asset,
  context,
  priority = false,
  className,
}: {
  asset: ImageAsset
  context: ImageContext
  /** True for the FIRST image on the page, and never for a second one. */
  priority?: boolean
  className?: string
}) {
  // `alt` is destructured out of the spread rather than left in it so that
  // jsx-a11y's alt-text rule can see it: a spread it cannot resolve statically reads
  // as a missing `alt`, and silencing that rule on the site's ONE `<img>` would
  // switch it off everywhere it could ever matter. It still comes from the asset.
  const { alt, ...attrs } = imageAttrs(asset, { context, priority })

  return <img alt={alt} {...attrs} className={cn('block h-auto w-full', className)} />
}

/**
 * An image with its caption, which is what a case study renders.
 *
 * `<figcaption>` is emitted only when the asset carries a description. An empty
 * caption element is not neutral: it takes the figure's spacing and announces an
 * empty labelled region to a screen reader.
 */
export function AssetFigure({
  asset,
  context,
  priority = false,
  className,
}: {
  asset: ImageAsset
  context: ImageContext
  priority?: boolean
  className?: string
}) {
  const caption = asset.description.trim()

  return (
    <figure className={cn('my-[var(--space-section)]', className)}>
      <AssetImage asset={asset} context={context} priority={priority} className="rounded-[var(--radius)]" />
      {caption !== '' && <figcaption className="mt-2 text-sm text-muted-foreground">{caption}</figcaption>}
    </figure>
  )
}

/**
 * An `imageGroup` block: ADR-0003's three layouts, and N images in each.
 *
 * `sideBySide` MEANS two — `app/lib/invariants.ts` fails the build on a group that
 * links any other number, because the layout is the record's decision and a
 * three-image "side by side" is an authoring mistake rather than a style. This
 * component still lays out N, for two separate reasons: Contentful cannot express the
 * cap as a validation, so the entry can exist; and the sweep drops links to
 * unpublished assets, so a legitimate pair can arrive here as one. A layout that
 * assumed two would render the second image's absence as a broken column.
 *
 * An unrecognised `layout` stacks. That is the schema having moved on without this
 * file, and a stack is the degradation that still shows every image.
 */
export function ImageGroup({
  group,
  priority = false,
  className,
}: {
  group: ImageGroupBlock
  /** True when this group holds the page's first image — only the FIRST gets it. */
  priority?: boolean
  className?: string
}) {
  if (group.images.length === 0) return null

  const caption = (group.caption ?? '').trim()
  const context: ImageContext = group.layout === 'sideBySide' || group.layout === 'grid' ? group.layout : 'fullWidth'

  return (
    <figure className={cn('my-[var(--space-section)]', className)}>
      <div className={LAYOUT[group.layout] ?? LAYOUT.fullWidth}>
        {group.images.map((asset, index) => (
          <AssetImage
            // Index-qualified because an author CAN link one asset twice: the sixth
            // invariant counts links rather than distinct assets, so a before/after
            // pair that names the same file passes the build, and a bare asset id
            // would then be a duplicate React key.
            key={`${asset.id}-${index}`}
            asset={asset}
            context={context}
            // The page's first image is one image, not one per column.
            priority={priority && index === 0}
            className="rounded-[var(--radius)]"
          />
        ))}
      </div>

      {caption !== '' && <figcaption className="mt-2 text-sm text-muted-foreground">{caption}</figcaption>}
    </figure>
  )
}

/**
 * One row of columns for `sideBySide`, an auto-fitting grid for `grid`, and a stack
 * for `fullWidth`.
 *
 * `sideBySide` is `grid-flow-col auto-cols-fr` rather than `grid-cols-2`: with N
 * images that divides the row evenly instead of overflowing a fixed pair of columns,
 * and with one it fills the row. It wraps to a stack below `sm`, where two 328px
 * columns would be two thumbnails.
 */
const LAYOUT: Record<string, string> = {
  sideBySide: 'grid grid-cols-1 items-start gap-4 sm:auto-cols-fr sm:grid-flow-col',
  grid: 'grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] items-start gap-4',
  fullWidth: 'flex flex-col gap-4',
}
