/**
 * The one place a `/.netlify/images` URL is built, and the one place the two-tier
 * `loading` / `sizes` rule is decided.
 *
 * ADR-0013 asks for exactly this confinement, and the reason is not tidiness:
 * `/.netlify/images` is a NETLIFY-ONLY path, so leaving Netlify breaks every image
 * on the site at once. Confined here that is one edit; inlined into components it is
 * a sweep. This module is the single point where the site's imagery couples to
 * ADR-0002's choice of host.
 *
 * THE FAILURE MODE TO KEEP IN MIND WHILE EDITING THIS FILE: an image URL that the
 * allowlist in netlify.toml does not match returns `400 {"code":400,"msg":"url (…)
 * is not an allowed pattern"}` at request time. ADR-0010 gave up analytics, error
 * monitoring and every server log, so nothing reports that. The build is green, the
 * page ships, and the image is broken until Alex happens to look. Hence `imageUrl`
 * throws on a source it cannot address, rather than emitting a URL that will fail
 * silently and remotely.
 */

/** Contentful's Asset, to the depth ADR-0013 and ADR-0003 need. */
export type ImageAsset = {
  id: string
  /** As the CDA returns it — usually PROTOCOL-RELATIVE. See `imageUrl`. */
  url: string
  /** ADR-0003: alt text is the Asset's own `title`, never a prop at the call site. */
  title: string
  /** ADR-0003: the caption. Empty when the asset carries no description. */
  description: string
  /** `file.details.image.*`, emitted as `width`/`height` so nothing shifts. */
  width: number
  height: number
}

/** The four image contexts ADR-0013 enumerates, and the only four there are. */
export type ImageContext = 'card' | 'sideBySide' | 'grid' | 'fullWidth'

/** Netlify's transform endpoint. On by default on every site; nothing to toggle. */
const ENDPOINT = '/.netlify/images'

/** The only host netlify.toml's `remote_images` allowlists. */
const SOURCE_HOST = 'images.ctfassets.net'

/**
 * The space `remote_images` is scoped to, and the reason it is a literal here.
 *
 * NOT read from `CONTENTFUL_SPACE_ID`: this module is imported by
 * app/components/asset-image.tsx, so it runs in the BROWSER on hydration, where
 * `process.env` does not exist — an env read here throws on every page rather than
 * catching a misconfiguration. It is not a secret either; it is already committed in
 * netlify.toml, ADR-0002 and ADR-0013.
 *
 * scripts/netlify-images.test.ts asserts this equals the id in netlify.toml's
 * pattern, which is the only way the two can be kept from drifting apart.
 */
const SOURCE_SPACE = '3iiyvj5u5c9h'

/** What netlify.toml will accept, as a prefix — host AND space, not host alone. */
const SOURCE_PREFIX = `https://${SOURCE_HOST}/${SOURCE_SPACE}/`

/**
 * The rungs, before any per-image capping.
 *
 * They cost nothing to emit — Netlify generates any width on demand, so unlike a
 * build-time mirror there are no variants to keep in step with this array.
 */
const LADDER = [650, 960, 1400]

/**
 * The width `src` aims at: the fallback for a browser that ignores `srcset`
 * entirely, and the rung a `sizes` miss lands on. 960 is ADR-0013's own choice.
 */
const DEFAULT_WIDTH = 960

/**
 * What Safari reads. Approximate by design — an exact restatement of the layout at
 * every breakpoint is precisely what `sizes="auto"` exists to retire — but they are
 * the ONLY thing sizing images on ~29% of visits, so they are grounded in
 * app/tokens.css rather than guessed: `--width-content` is 42rem, `--width-wide` is
 * 80rem, and `--gutter` is 1.5rem a side.
 *
 * DELETE THIS TABLE WHEN WEBKIT SHIPS `sizes="auto"` (bug 253143). That is the whole
 * migration ADR-0013 schedules — the fallbacks go, `auto` stays, nothing else moves.
 */
const FALLBACK_SIZES: Record<ImageContext, string> = {
  // A cover image on the home page or the /projects index — roughly half of
  // --width-wide once the index carries imagery.
  card: '(min-width: 60rem) 640px, 94vw',
  // Two images abreast inside the 42rem reading column, ONE PER ROW BELOW `sm`.
  // That middle term is not decoration: app/components/asset-image.tsx stacks this
  // layout under 40rem, so a phone renders the image at ~94vw. Claiming 47vw there
  // tells the browser the slot is half its real size, and it picks a rung one step
  // too small — softening body images on exactly the Safari viewports these
  // fallbacks exist to serve, since `sizes="auto"` would have measured it correctly.
  //
  // Stated for two above `sm` because the sixth invariant asserts two; the layout
  // tolerates N regardless, and a wrong fallback at N=3 costs one rung, not a page.
  sideBySide: '(min-width: 45rem) 328px, (min-width: 40rem) 47vw, 94vw',
  // auto-fit minmax(12rem, 1fr): three abreast in the reading column, and likewise
  // one per row once the container drops below ~28rem.
  grid: '(min-width: 45rem) 216px, (min-width: 40rem) 47vw, 94vw',
  // The READING COLUMN, 42rem, because that is what this measures today: neither
  // AssetFigure nor the fullWidth stack applies a width escape, so a body figure is
  // 672px wide however wide the viewport gets. --width-wide is what the layout is
  // MEANT to reach (see that token's comment in app/tokens.css) and claiming 1280px
  // before anything breaks out just fetches the 1400w rung where 960w would do.
  // Raise this in the same change that gives the figure its break-out — AWK-43 owns
  // the container that would have to allow it.
  fullWidth: '(min-width: 45rem) 672px, 94vw',
}

/**
 * One transformed-image URL, served from this origin.
 *
 * `url` carries the BARE Contentful file URL: Contentful's own Images API is not
 * chained in front of Netlify's, so there is one resizer, no double compression, and
 * no percent-encoding hazard from a source that already has a query string.
 *
 * `fm` is deliberately absent. With no format parameter Netlify content-negotiates
 * on the request's `Accept` header — AVIF where it is supported, something Safari can
 * read otherwise — so no format is hardcoded and there is one fewer parameter to
 * revisit.
 */
export function imageUrl(source: string, width: number): string {
  if (!Number.isInteger(width) || width <= 0) {
    throw new Error(`A transform width must be a positive integer; got ${width}.`)
  }

  // The CDA returns `//images.ctfassets.net/…`, and netlify.toml's allowlist is
  // anchored on `https://`. Passing the field through as it arrives matches no
  // pattern, so EVERY image 400s — invisibly, per the note at the top of this file.
  const absolute = source.startsWith('//') ? `https:${source}` : source

  // The SPACE is checked, not just the host. An asset from another space — a
  // migration, or a file copied in from elsewhere — is exactly as unservable as one
  // from another domain, and checking only the host would let it through a guard
  // whose own message claims otherwise.
  if (!absolute.startsWith(SOURCE_PREFIX)) {
    throw new Error(
      `${absolute} cannot be served through Netlify's image proxy: netlify.toml allowlists ` +
        `${SOURCE_PREFIX} only, space-scoped on purpose so this site cannot proxy another ` +
        `Contentful customer's assets.\n\n` +
        `If CONTENTFUL_SPACE_ID has legitimately changed, netlify.toml's [images] pattern and SOURCE_SPACE in ` +
        `this file both have to change with it.\n\n` +
        `This throws at build time because the alternative is a 400 at request time that nothing reports — ` +
        `ADR-0010 left this project with no server log and no error monitoring.`
    )
  }

  return `${ENDPOINT}?url=${encodeURIComponent(absolute)}&w=${width}`
}

/**
 * The rungs a given source can actually serve, capped at its own width.
 *
 * AWK-40 measured the overshoot that makes this necessary: of the assets that ship,
 * `updated_sidebar.jpg` is 732px wide and `existing_sidebar.jpg` 1333px, so the bare
 * 650/960/1400 ladder asks Netlify to UPSCALE two of three sources. It obliges — the
 * result is simply blurrier than the original, for more bytes than the original.
 *
 * The source width itself is always the top rung, so a retina viewport still gets
 * every pixel that exists.
 */
export function ladderFor(sourceWidth: number): number[] {
  const rungs = LADDER.filter((width) => width < sourceWidth)

  return [...rungs, sourceWidth]
}

export type ImageAttrs = {
  src: string
  srcSet: string
  sizes: string
  loading: 'lazy' | 'eager'
  /** Only ever `'high'`, and only on the first image of a page. */
  fetchPriority?: 'high'
  width: number
  height: number
  alt: string
}

/**
 * Every attribute of one `<img>`, including which tier it belongs to.
 *
 * ADR-0013's rule: the FIRST image on any page is `loading="eager"` +
 * `fetchpriority="high"` with an explicit `sizes`; every image after it is
 * `loading="lazy"` with `sizes="auto"` in front of the fallback. Mechanical on
 * purpose — enumerating the eager images by hand makes adding a project a judgement
 * call.
 *
 * The two tiers are decided HERE rather than at each call site because `sizes="auto"`
 * REQUIRES `loading="lazy"` by specification: without it the value cannot resolve and
 * the browser falls through to the rest of the list. Deciding both together makes the
 * invalid pair unconstructible instead of merely documented.
 */
export function imageAttrs(asset: ImageAsset, options: { context: ImageContext; priority?: boolean }): ImageAttrs {
  const widths = ladderFor(asset.width)
  const fallback = FALLBACK_SIZES[options.context]

  return {
    src: imageUrl(asset.url, widths.filter((width) => width <= DEFAULT_WIDTH).at(-1) ?? widths.at(-1)!),
    srcSet: widths.map((width) => `${imageUrl(asset.url, width)} ${width}w`).join(', '),
    sizes: options.priority === true ? fallback : `auto, ${fallback}`,
    loading: options.priority === true ? 'eager' : 'lazy',
    ...(options.priority === true ? { fetchPriority: 'high' as const } : {}),
    width: asset.width,
    height: asset.height,
    alt: asset.title,
  }
}
