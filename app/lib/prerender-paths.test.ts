import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Archive } from './archive'

/**
 * The enumerator is the one place that decides which pages exist, so its guards
 * matter more than its output: with `ssr: false`, a path that is wrong here is a
 * page that either fails the build or 404s in production.
 *
 * These mock the SWEEP rather than the Delivery API, because the guards are about
 * what the sweep hands over and no test here should touch the network. Each case
 * supplies its own fixture with `vi.doMock` plus `resetModules`; `vi.mock` would
 * hoist and apply to all of them.
 */
function archive(paths: string[]): Archive {
  return {
    concerts: [],
    works: [],
    composers: [],
    projects: [],
    paths,
    search: [],
    stats: { concerts: 0, works: 0, composers: 0, pairs: 0, projects: 0, paths: paths.length },
  }
}

async function enumerate(paths: string[]) {
  vi.resetModules()
  vi.doMock('./archive', () => ({ loadArchive: () => Promise.resolve(archive(paths)) }))
  const { prerenderPaths } = await import('./prerender-paths')
  return prerenderPaths()
}

describe('prerenderPaths', () => {
  afterEach(() => {
    vi.doUnmock('./archive')
    vi.resetModules()
  })

  it('passes the sweep’s page set through unchanged', async () => {
    const paths = ['/', '/concerts', '/concerts/2019-12-15']

    await expect(enumerate(paths)).resolves.toEqual(paths)
  })

  it('accepts the root path, which is the one legal trailing slash', async () => {
    await expect(enumerate(['/'])).resolves.toEqual(['/'])
  })

  it('throws rather than emitting a trailing-slash path', async () => {
    // An empty project slug is the realistic way this happens: Contentful can
    // hold a published entry whose slug was never filled, and `/projects/` would
    // fail the build with a message about the route, not the data.
    await expect(enumerate(['/', '/projects/'])).rejects.toThrow(/trailing slash/)
  })

  it('throws rather than emitting a duplicate path', async () => {
    // Two concerts on one date. ADR-0001 keys concert URLs BY DATE, so a genuine
    // double-header is data this guard has to catch rather than silently collapse.
    await expect(enumerate(['/concerts/2008-12-13', '/concerts/2008-12-13'])).rejects.toThrow(/duplicate/)
  })

  it('throws rather than emitting a relative path', async () => {
    await expect(enumerate(['concerts/2008-12-13'])).rejects.toThrow(/not absolute/)
  })

  it('names the offending path, since the fix is in the data', async () => {
    await expect(enumerate(['/', '/projects/'])).rejects.toThrow(/\/projects\//)
  })
})
