import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Guards portfolio-schema.json — the two content types AWK-31 creates, specified
 * by ADR-0003.
 *
 * WHAT THIS CAN AND CANNOT CATCH. It restates ADR-0003's schema tables, so it
 * catches a typo, a dropped field, a widened controlled list, and any later edit
 * that quietly relaxes one of the restrictions that carry a decision. It cannot
 * catch a wrong *decision* — if ADR-0003 picked the wrong fourteen fields, this
 * test agrees with it enthusiastically. Drift guard on a spec artifact, same
 * spirit as archive-schema.test.ts and app/tokens.css.
 *
 * It asserts the FILE, not the space. Nothing here proves the types were created:
 * that needs a CMA token, and ADR-0002 forbids one reaching CI. AWK-39's build
 * assertions are what will eventually check live data.
 *
 * Several assertions below check that something is ABSENT. Those are the load
 * bearing ones — see `the invariants Contentful cannot hold`. An absence is
 * invisible on inspection, so it needs a test or the next reader adds the
 * validation back in good faith and breaks an invariant that lives elsewhere.
 */
const schema = JSON.parse(readFileSync(join(import.meta.dirname, 'portfolio-schema.json'), 'utf8')) as Schema

type Validation = {
  unique?: boolean
  in?: string[]
  size?: { min?: number; max?: number }
  linkContentType?: string[]
  regexp?: { pattern: string; flags?: string }
  enabledMarks?: string[]
  enabledNodeTypes?: string[]
  nodes?: Record<string, { linkContentType?: string[]; size?: { min?: number; max?: number } }[]>
}

type Field = {
  id: string
  name: string
  type: string
  linkType?: string
  required: boolean
  localized: boolean
  validations?: Validation[]
  items?: {
    type: string
    linkType?: string
    validations?: Validation[]
  }
}

type Schema = {
  createTypes: { id: string; name: string; displayField: string; fields: Field[] }[]
  deferredInvariants: { id: string; assertedBy: string; why: string[] }[]
}

function type(typeId: string) {
  const found = schema.createTypes.find((t) => t.id === typeId)
  if (!found) throw new Error(`no content type ${typeId} in portfolio-schema.json`)
  return found
}

function field(typeId: string, fieldId: string): Field {
  const found = type(typeId).fields.find((f) => f.id === fieldId)
  if (!found) throw new Error(`no field ${typeId}.${fieldId} in portfolio-schema.json`)
  return found
}

function inList(f: Field): string[] | undefined {
  return f.validations?.find((v) => v.in)?.in ?? f.items?.validations?.find((v) => v.in)?.in
}

function richTextValidation(key: keyof Validation) {
  return field('project', 'body').validations?.find((v) => v[key] !== undefined)?.[key]
}

// Contentful's own URL pattern, verbatim from a content type authored in the web
// app. Matching it exactly is what makes the web app render `liveUrl` as its
// built-in URL match rather than an opaque custom regexp.
const URL_PATTERN = '^(ftp|http|https):\\/\\/(\\w+:{0,1}\\w*@)?(\\S+)(:[0-9]+)?(\\/|\\/([\\w#!:.?+=&%@!\\-/]))?$'

describe('portfolio-schema.json', () => {
  it('creates exactly the two types ADR-0003 specifies', () => {
    expect(schema.createTypes.map((t) => t.id)).toEqual(['imageGroup', 'project'])
  })

  it('declares imageGroup BEFORE project, because project.body references it', () => {
    // Not cosmetic, and not alphabetical-by-accident. `project.body` restricts its
    // embedded blocks to `imageGroup` by id, and Contentful rejects a
    // linkContentType naming a type that does not exist yet. Creating `project`
    // first fails the whole migration on its first write.
    const order = schema.createTypes.map((t) => t.id)

    expect(order.indexOf('imageGroup')).toBeLessThan(order.indexOf('project'))
  })

  describe('project — ADR-0003s schema table', () => {
    // FOURTEEN, not the thirteen AWK-31's summary claims. ADR-0003's schema table
    // has fourteen rows and the ticket says to copy the record rather than
    // re-derive it, so the record wins. This assertion is the thing that makes the
    // count checkable instead of arguable.
    it('declares the fourteen fields, in the records order', () => {
      expect(type('project').fields.map((f) => f.id)).toEqual([
        'title',
        'slug',
        'summary',
        'organization',
        'role',
        'disciplines',
        'technologies',
        'startDate',
        'endDate',
        'featuredRank',
        'coverImage',
        'liveUrl',
        'repoUrl',
        'body',
      ])
    })

    it('takes title as its display field', () => {
      expect(type('project').displayField).toBe('title')
      expect(field('project', 'title').type).toBe('Symbol')
    })

    it('requires exactly title, slug, summary and startDate', () => {
      // Everything else is optional, and two of those optionals carry decisions:
      // `body` empty means index-only (it defines N), and `coverImage` empty means
      // the index must render a card with no image without looking broken.
      const required = type('project')
        .fields.filter((f) => f.required)
        .map((f) => f.id)

      expect(required).toEqual(['title', 'slug', 'summary', 'startDate'])
    })

    it('keeps slug unique, because a project URL is what gets pasted into an application', () => {
      expect(field('project', 'slug').validations).toContainEqual({ unique: true })
    })

    it('caps summary at 160, for the consumer that needs the cap', () => {
      // ADR-0003: the cap "exists for the second consumer, not the first" — the
      // <meta name="description">, not the index card. A cap nothing enforces is
      // not a cap.
      expect(field('project', 'summary').validations).toContainEqual({ size: { max: 160 } })
      expect(field('project', 'summary').required).toBe(true)
    })

    it('holds disciplines as an in-validated symbol array', () => {
      const disciplines = field('project', 'disciplines')

      expect(disciplines.type).toBe('Array')
      expect(disciplines.items?.type).toBe('Symbol')
      expect(inList(disciplines)).toEqual(['Design', 'Development'])
    })

    it('holds technologies as an in-validated symbol array, never free text', () => {
      // ADR-0003 rejected unvalidated free text outright: nothing then prevents
      // `React`, `react` and `ReactJS` becoming three tags, which silently breaks
      // any grouping on the index. Extending the vocabulary means editing this
      // list and republishing the type — an accepted cost, stated in the record.
      const technologies = field('project', 'technologies')

      expect(technologies.type).toBe('Array')
      expect(technologies.items?.type).toBe('Symbol')
      expect(inList(technologies)).toEqual([
        'AG Grid',
        'Contentful',
        'Figma',
        'Netlify',
        'React',
        'React Router',
        'Storybook',
        'Supernova',
        'Tailwind CSS',
        'TypeScript',
        'Vite',
      ])
    })

    it('gives the index a total order via startDate plus an optional endDate', () => {
      // A single `date` compresses a months-long project into one arbitrary day —
      // which is exactly how the meaningless 2019-03-15/16 on the two Cision stubs
      // came to exist. A `year` integer leaves same-year projects unordered.
      expect(field('project', 'startDate').type).toBe('Date')
      expect(field('project', 'startDate').required).toBe(true)
      expect(field('project', 'endDate').type).toBe('Date')
      expect(field('project', 'endDate').required).toBe(false)
    })

    it('carries home-page selection and order in one nullable integer', () => {
      // A boolean `featured` plus a separate `order` can disagree and nothing keeps
      // them consistent; a boolean alone leaves the front door's order to whatever
      // the CDA happens to return. One nullable rank cannot hold the contradictory
      // state — see the featuredRank caveat under deferred invariants for the part
      // this does NOT solve.
      const rank = field('project', 'featuredRank')

      expect(rank.type).toBe('Integer')
      expect(rank.required).toBe(false)
    })

    it('links coverImage to an Asset and leaves it optional', () => {
      const cover = field('project', 'coverImage')

      expect(cover.type).toBe('Link')
      expect(cover.linkType).toBe('Asset')
      expect(cover.required).toBe(false)
    })

    it("URL-validates both outbound links with Contentful's own pattern", () => {
      for (const id of ['liveUrl', 'repoUrl']) {
        expect(field('project', id).validations).toContainEqual({
          regexp: { pattern: URL_PATTERN, flags: null },
        })
      }
    })
  })

  describe('project.body — the spaces first RichText field', () => {
    it('is RichText and optional, because empty is what defines N', () => {
      // ADR-0003: a project with an empty body appears in the index and has no
      // route, and filling it later ADDS a URL rather than changing one. Requiring
      // it would delete that affordance, which awkale.me itself depends on.
      expect(field('project', 'body').type).toBe('RichText')
      expect(field('project', 'body').required).toBe(false)
    })

    it('restricts embedded entry blocks to imageGroup and nothing else', () => {
      expect(richTextValidation('nodes')).toEqual({
        'embedded-entry-block': [{ linkContentType: ['imageGroup'] }],
      })
    })

    it('does NOT enable embedded-entry-inline, which would defeat that restriction', () => {
      // The `nodes` validation above only constrains embedded-entry-BLOCK. Leaving
      // the inline variant enabled lets an author inline-embed any entry in the
      // space — a concert, a work, a composer — straight into a case study, and
      // "embedded blocks restricted to imageGroup and assets" becomes false.
      // Dropping it is the only place this file trims Contentful's default set.
      expect(richTextValidation('enabledNodeTypes')).not.toContain('embedded-entry-inline')
    })

    it('enables embedded-asset-block, which is the other half of the restriction', () => {
      expect(richTextValidation('enabledNodeTypes')).toContain('embedded-asset-block')
      expect(richTextValidation('enabledNodeTypes')).toContain('embedded-entry-block')
    })

    it('enables no cross-space resource nodes', () => {
      // `embedded-resource-block` / `-inline` and `resource-hyperlink` address
      // entries in OTHER spaces. This space has one environment and no siblings,
      // so an enabled resource node is a surface with nothing legitimate behind it.
      const enabled = richTextValidation('enabledNodeTypes') as string[]

      expect(enabled.filter((n) => n.includes('resource'))).toEqual([])
    })

    it("keeps Contentful's seven marks", () => {
      // Not trimmed: ADR-0003 restricts embedded blocks and says nothing about
      // formatting, so narrowing the marks here would be this file inventing an
      // editorial policy the record did not decide.
      expect(richTextValidation('enabledMarks')).toEqual([
        'bold',
        'italic',
        'underline',
        'code',
        'superscript',
        'subscript',
        'strikethrough',
      ])
    })
  })

  describe('imageGroup — ADR-0003s schema table', () => {
    it('declares the four fields, in the records order', () => {
      expect(type('imageGroup').fields.map((f) => f.id)).toEqual(['label', 'images', 'layout', 'caption'])
    })

    it('takes label as its display field', () => {
      expect(type('imageGroup').displayField).toBe('label')
      expect(field('imageGroup', 'label').type).toBe('Symbol')
      expect(field('imageGroup', 'label').required).toBe(true)
    })

    it('holds an ordered array of Asset links', () => {
      const images = field('imageGroup', 'images')

      expect(images.type).toBe('Array')
      expect(images.items?.type).toBe('Link')
      expect(images.items?.linkType).toBe('Asset')
      expect(images.required).toBe(true)
    })

    it('offers exactly the three layouts', () => {
      expect(inList(field('imageGroup', 'layout'))).toEqual(['sideBySide', 'grid', 'fullWidth'])
      expect(field('imageGroup', 'layout').required).toBe(true)
    })

    it('keeps caption optional and group-level', () => {
      expect(field('imageGroup', 'caption').type).toBe('Symbol')
      expect(field('imageGroup', 'caption').required).toBe(false)
    })

    it('carries no captions[] array, which was rejected outright', () => {
      // Parallel images[]/captions[] align only by index, so reordering or deleting
      // one image shifts every caption onto the wrong image — and it fails silently
      // in the rendered page rather than at build time. Per-image captions come
      // from the Asset: `title` is alt text, `description` is the caption.
      expect(type('imageGroup').fields.map((f) => f.id)).not.toContain('captions')
    })
  })

  describe('the invariants Contentful cannot hold', () => {
    it('names both, and hands both to the same build assertion', () => {
      expect(schema.deferredInvariants.map((i) => i.id).sort()).toEqual([
        'featured-rank-requires-body',
        'side-by-side-is-two-images',
      ])

      for (const invariant of schema.deferredInvariants) {
        expect(invariant.assertedBy).toBe('AWK-39')
      }
    })

    it('puts no size validation on images, because the limit cannot be conditional', () => {
      // `sideBySide` means two images and the other two layouts mean N, but a
      // Contentful array's min/max cannot depend on another field's value. A `max`
      // here would cap `grid` and `fullWidth` too — the wizard alone needs five.
      // So the component must tolerate N forever, and AWK-39 asserts the pair.
      const images = field('imageGroup', 'images')

      expect(images.validations ?? []).toEqual([])
      expect(images.items?.validations ?? []).toEqual([])
    })

    it('leaves featuredRank and body independently optional', () => {
      // The dependency is real — a featured project with no body puts a card on the
      // front door that either does not click or clicks off-site, next to one that
      // opens a case study — but no Contentful validation can express it. Making
      // either field required to fake it would break the index-only entries, which
      // are three of the five that ship.
      expect(field('project', 'featuredRank').required).toBe(false)
      expect(field('project', 'body').required).toBe(false)
    })
  })
})
