import { describe, expect, it } from 'vitest'

import { readConfig } from './contentful'

/**
 * The env assertion, which exists because the failure it catches is silent.
 *
 * Reading a variable the Netlify dashboard does not hold does not throw: it
 * fetches nothing, enumerates the six static paths, prints a green build and
 * deploys an empty site. Every case here is that failure in one of its shapes.
 */
const complete = {
  CONTENTFUL_SPACE_ID: '3iiyvj5u5c9h',
  CONTENTFUL_ENVIRONMENT: 'master',
  CONTENTFUL_DELIVERY_TOKEN: 'cda-token',
}

describe('readConfig', () => {
  it('reads the three build variables', () => {
    expect(readConfig(complete)).toMatchObject({
      spaceId: '3iiyvj5u5c9h',
      environment: 'master',
      token: 'cda-token',
      preview: false,
    })
  })

  it.each(Object.keys(complete))('throws when %s is missing', (name) => {
    expect(() => readConfig({ ...complete, [name]: undefined })).toThrow(name)
  })

  it('treats an empty value as missing, since Netlify holds one per deploy context', () => {
    // CONTENTFUL_DELIVERY_TOKEN carries four values across four contexts, unlike
    // the other two. An empty one in a single context is the realistic outage.
    expect(() => readConfig({ ...complete, CONTENTFUL_DELIVERY_TOKEN: '' })).toThrow(/DELIVERY_TOKEN/)
  })

  it('treats whitespace as missing', () => {
    expect(() => readConfig({ ...complete, CONTENTFUL_SPACE_ID: '   ' })).toThrow(/SPACE_ID/)
  })

  it('names every missing variable at once', () => {
    const bare = () => readConfig({})

    expect(bare).toThrow(/CONTENTFUL_SPACE_ID/)
    expect(bare).toThrow(/CONTENTFUL_ENVIRONMENT/)
    expect(bare).toThrow(/CONTENTFUL_DELIVERY_TOKEN/)
  })

  it('explains the failure mode rather than just naming the variable', () => {
    expect(() => readConfig({})).toThrow(/EMPTY SITE/)
  })

  it('trims, so a stray newline in .env is not a 401', () => {
    expect(readConfig({ ...complete, CONTENTFUL_DELIVERY_TOKEN: 'cda-token\n' }).token).toBe('cda-token')
  })
})

describe('the preview host', () => {
  const withPreview = { ...complete, CONTENTFUL_PREVIEW_TOKEN: 'preview-token' }

  it('is used in dev, where seeing drafts is the point', () => {
    expect(readConfig({ ...withPreview, NODE_ENV: 'development' })).toMatchObject({
      host: 'https://preview.contentful.com',
      token: 'preview-token',
      preview: true,
    })
  })

  it('is NEVER used in a production build', () => {
    // Prerendering against preview would bake unpublished entries into ~600
    // static pages — the one failure direction that ships wrong content rather
    // than no content.
    expect(readConfig({ ...withPreview, NODE_ENV: 'production' })).toMatchObject({
      host: 'https://cdn.contentful.com',
      token: 'cda-token',
      preview: false,
    })
  })

  it('fails closed when NODE_ENV is unset', () => {
    // Anything that is not explicitly a dev server reads published entries only.
    expect(readConfig(withPreview).preview).toBe(false)
  })

  it('is optional — it is not set in Netlify at all', () => {
    expect(() => readConfig({ ...complete, NODE_ENV: 'development' })).not.toThrow()
  })
})
