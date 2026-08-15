/**
 * The Contentful Delivery API client the build reads through.
 *
 * There is no SDK here on purpose. `contentful.js` would be a runtime dependency
 * for what is four fetches and a pagination loop, and this file mirrors the
 * retry and rate-limit behaviour of scripts/contentful/import_to_contentful.py's
 * `Http` class so that both halves of the pipeline fail the same way.
 *
 * THE FAILURE THIS FILE EXISTS TO PREVENT: reading an environment variable the
 * dashboard does not hold does not error. It yields no entries, the sweep
 * enumerates the six static paths, the build prints `✓ built` and exits 0, and
 * the site deploys EMPTY. That is the same shape as ADR-0002's unpublished-import
 * warning, and it is why `readConfig` asserts before anything is fetched.
 */

/** Live values in the Netlify dashboard, verified 2026-08-15. See .env.example. */
const SPACE_ID = 'CONTENTFUL_SPACE_ID'
const ENVIRONMENT = 'CONTENTFUL_ENVIRONMENT'
const DELIVERY_TOKEN = 'CONTENTFUL_DELIVERY_TOKEN'
const PREVIEW_TOKEN = 'CONTENTFUL_PREVIEW_TOKEN'

const DELIVERY_HOST = 'https://cdn.contentful.com'
const PREVIEW_HOST = 'https://preview.contentful.com'

export type ContentfulConfig = {
  spaceId: string
  environment: string
  token: string
  host: string
  /** True when reading drafts. Never true in a build — see readConfig. */
  preview: boolean
}

export type Link = { sys: { type: 'Link'; linkType: 'Entry' | 'Asset'; id: string } }

export type Entry<F> = {
  sys: { id: string; contentType: { sys: { id: string } } }
  fields: Partial<F>
}

/**
 * Reads and asserts the three build variables.
 *
 * `CONTENTFUL_PREVIEW_TOKEN` is deliberately NOT required: it is a local
 * convenience for seeing drafts in `bun run dev` and is not set in Netlify. It is
 * also deliberately ignored unless NODE_ENV is exactly `development`, because
 * prerendering with the preview host would bake unpublished entries into ~600
 * static pages — failing OPEN in the one direction that ships wrong content.
 * Anything that is not explicitly a dev server reads published entries only.
 */
export function readConfig(env: Record<string, string | undefined> = process.env): ContentfulConfig {
  const missing = [SPACE_ID, ENVIRONMENT, DELIVERY_TOKEN].filter((name) => !env[name]?.trim())

  if (missing.length > 0) {
    throw new Error(
      `Contentful is not configured: ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} missing or empty.\n\n` +
        `These are set in the Netlify UI (Site configuration → Environment variables), never in netlify.toml, ` +
        `which is committed. Locally they come from .env — copy .env.example.\n\n` +
        `This is asserted rather than tolerated because an unset variable does not error: it reads zero entries, ` +
        `enumerates only the static paths, and deploys an EMPTY SITE with a green build.`
    )
  }

  const preview = env.NODE_ENV === 'development' && Boolean(env[PREVIEW_TOKEN]?.trim())

  return {
    spaceId: env[SPACE_ID]!.trim(),
    environment: env[ENVIRONMENT]!.trim(),
    token: (preview ? env[PREVIEW_TOKEN]! : env[DELIVERY_TOKEN]!).trim(),
    host: preview ? PREVIEW_HOST : DELIVERY_HOST,
    preview,
  }
}

/** Contentful's page cap. Asking for more is rejected, not clamped. */
const PAGE_SIZE = 1000
const MAX_ATTEMPTS = 6

type Page = { items: unknown[]; total: number }

/** One attempt: the page, or how long to wait before the next one. */
type Attempt = { ok: true; page: Page } | { ok: false; waitMs: number; error: unknown }

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function attemptGet(url: string, token: string, attempt: number): Promise<Attempt> {
  const backoff = 2 ** attempt * 1000

  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })

    if (response.ok) return { ok: true, page: (await response.json()) as Page }

    // 429 carries the wait in a header; 5xx is worth a backoff. Everything else
    // — 401 on a bad token, 404 on a wrong space or environment — is a
    // configuration error that retrying only makes slower, so it throws past the
    // retry loop entirely.
    if (response.status === 429) {
      const reset = Number(response.headers.get('x-contentful-ratelimit-reset') ?? 2 ** attempt)
      return { ok: false, waitMs: Math.min(reset + 0.5, 30) * 1000, error: '429' }
    }
    if (response.status >= 500) {
      return { ok: false, waitMs: backoff, error: `${response.status}` }
    }

    throw new Error(`${response.status} ${response.statusText} — ${(await response.text()).slice(0, 400)}`)
  } catch (error) {
    // A thrown Error above is a configuration failure and must not be retried;
    // a TypeError from fetch is a network blip and must be.
    if (error instanceof Error && !(error instanceof TypeError)) throw error
    return { ok: false, waitMs: backoff, error }
  }
}

async function getJson(url: string, token: string): Promise<Page> {
  let lastError: unknown

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Sequential by definition: each retry exists BECAUSE the previous one
    // failed, and the backoff between them is the point. Running them together
    // would be one burst against a rate limit we are already over.
    // eslint-disable-next-line no-await-in-loop
    const result = await attemptGet(url, token, attempt)

    if (result.ok) return result.page

    lastError = result.error
    // eslint-disable-next-line no-await-in-loop
    await sleep(result.waitMs)
  }

  throw new Error(`Contentful did not answer after ${MAX_ATTEMPTS} attempts: ${String(lastError)}`)
}

/**
 * Every published entry of one content type.
 *
 * `include=0` is deliberate. Resolving links through `includes.Entry` looks
 * cheaper, but the include set is capped and silently truncated on large pages —
 * so a link would resolve to `undefined` for some entries and not others,
 * producing a page set that is wrong in a way nothing reports. Every type is
 * fetched whole and links are resolved against our own maps instead, which is
 * deterministic and costs one request per thousand entries.
 *
 * The Delivery API hides drafts and archived entries, so no `sys.archivedAt`
 * filter is needed here — unlike the CMA scripts, where AWK-20's 16 archived
 * programItems make a bare count read 823 against a live 807.
 */
export async function fetchAll<F>(config: ContentfulConfig, contentType: string): Promise<Entry<F>[]> {
  const base = `${config.host}/spaces/${config.spaceId}/environments/${config.environment}/entries`
  const entries: Entry<F>[] = []
  let skip = 0

  for (;;) {
    const url = `${base}?content_type=${contentType}&limit=${PAGE_SIZE}&skip=${skip}&include=0&order=sys.id`
    // Sequential because the NEXT skip is not knowable until this page answers
    // with its total. Every type in this space fits in one page anyway.
    // eslint-disable-next-line no-await-in-loop
    const page = await getJson(url, config.token)

    entries.push(...(page.items as Entry<F>[]))
    skip += page.items.length

    if (skip >= page.total || page.items.length === 0) return entries
  }
}

/** A link's target id, or null — the shape every optional link field arrives in. */
export function linkId(link: Link | undefined | null): string | null {
  return link?.sys.id ?? null
}

/** An array-of-links field's target ids, tolerating the field being absent entirely. */
export function linkIds(links: Link[] | undefined | null): string[] {
  return (links ?? []).map((link) => link.sys.id)
}
