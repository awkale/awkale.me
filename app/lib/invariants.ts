/**
 * The invariants Contentful cannot express, asserted in the build.
 *
 * Five rules across five records, and every one of them exists because
 * Contentful validates a field against a LITERAL and never against another
 * field. Both links in a pair can be individually valid while the pair is
 * nonsense, and the schema has no way to say so:
 *
 *   satOut ⊆ program                    ADR-0006 — an array conditional on another array
 *   (composer, slug) unique             ADR-0008 — a scoped unique; Contentful has only space-wide
 *   the hashed slug shape               ADR-0008 — a format the importer emits and the URLs must not
 *   featuredRank requires body          ADR-0003 — a field conditional on another field's emptiness
 *   featuredRank is distinct            ADR-0003, per AWK-31's amendment
 *   sideBySide holds two images         ADR-0004 — an array max conditional on a sibling symbol
 *   recording.programItem ⊆ concert     ADR-0012 — a link conditional on a link's array
 *
 * Seven checks for the ticket's five rules: the slug rule is shape AND
 * uniqueness, which fail independently and need separate messages, and
 * featuredRank grew a second rule when AWK-31 noticed that one nullable field
 * still cannot stop two projects both holding rank 1.
 *
 * A SIXTH rule was listed alongside these for most of the project's life — the
 * CSP's inline-script hash (ADR-0010). It is gone rather than deferred: AWK-44
 * found nine inline scripts per page with one differing per route, so the policy
 * shipped as `script-src 'self' 'unsafe-inline'` and there is no hash to keep in
 * sync. See ADR-0010's amendment.
 *
 * These operate on plain structures rather than Delivery API responses, so the
 * rules are testable without a network and stay readable as rules. Resolving the
 * CDA's link graph into these shapes is app/lib/archive.ts's job.
 */

/** A rule id, an entry to fix, and what is wrong — in that order, because the fix happens in Contentful. */
export type InvariantViolation = {
  rule: string
  entry: string
  detail: string
}

export type ArchiveShape = {
  concerts: { id: string; program: string[]; satOut: string[] }[]
  works: { id: string; slug: string; composerId: string | null }[]
  projects: { id: string; slug: string; featuredRank: number | null; hasBody: boolean }[]
  imageGroups: { id: string; label: string; layout: string; imageCount: number }[]
  recordings: { id: string; label: string; concertId: string; programItemId: string | null }[]
}

/**
 * The importer's slug form is `<composer>--<title>-<6hex>`, and BOTH markers are
 * checked because either half alone is still not an address anyone should ship.
 *
 * ADR-0008 describes this as "`--` followed by six hex characters". That matches
 * NONE of the 625 live values — the hash trails the title, it does not follow the
 * separator — so implementing the record verbatim would have produced an
 * assertion that never fires. The record's wording is corrected in its amendment;
 * these two patterns are what the data actually holds.
 *
 * The `--` half cannot false-positive: slugify collapses runs of non-alphanumerics
 * to a single dash, so a clean slug never contains two. The hash half can, in
 * exactly one shape — a title whose last word is six letters drawn from a–f.
 * `Façade` is the live near-miss, surviving only because the archive holds it as
 * "Music from Façade Suite Nos. 1 and 2". Accepted knowingly: a build that fails
 * loudly on a real title is recoverable, and a hashed slug shipping silently into
 * ~600 addresses is the failure this whole file exists to prevent.
 */
const COMPOSER_PREFIXED = /--/
const HASH_SUFFIX = /-[0-9a-f]{6}$/

export function findViolations(archive: ArchiveShape): InvariantViolation[] {
  const violations: InvariantViolation[] = []

  // ADR-0006. Read the Concert from the link's OWNER — program-item ids are
  // positional and a run's second night carries the first night's ids, so
  // cnc-20070523 legitimately links pi-20070520-*. Comparing an id prefix to a
  // date would flag all twenty shared items.
  for (const concert of archive.concerts) {
    const program = new Set(concert.program)
    for (const item of concert.satOut) {
      if (!program.has(item)) {
        violations.push({
          rule: 'satout-subset-of-program',
          entry: concert.id,
          detail: `satOut holds ${item}, which is not on this concert's program`,
        })
      }
    }
  }

  // ADR-0008, two independent failures per work. Shape first: a hashed slug is
  // reported once however many markers it carries, because it is one thing wrong.
  const slugsByComposer = new Map<string, Map<string, string>>()
  for (const work of archive.works) {
    if (COMPOSER_PREFIXED.test(work.slug) || HASH_SUFFIX.test(work.slug)) {
      violations.push({
        rule: 'work-slug-not-hashed',
        entry: work.id,
        detail: `slug \`${work.slug}\` is still the importer's hashed form, so its URL leaks an import convention`,
      })
    }

    // A missing composer is a data gap, not a shared key: two composerless works
    // are two unknowns. Grouping them under `null` would report a uniqueness
    // violation for something that is really an unaddressable work — it has no
    // canonical URL at all, since works are addressed under their composer.
    if (work.composerId !== null) {
      const taken = slugsByComposer.get(work.composerId) ?? new Map<string, string>()
      const holder = taken.get(work.slug)
      if (holder === undefined) {
        taken.set(work.slug, work.id)
        slugsByComposer.set(work.composerId, taken)
      } else {
        violations.push({
          rule: 'work-slug-unique-per-composer',
          entry: work.id,
          detail: `slug \`${work.slug}\` is already held by ${holder} under composer ${work.composerId}`,
        })
      }
    }
  }

  // ADR-0003, both rules on the same field. A rank with no body puts a card on
  // the front door that does not click, because the page does not exist.
  const rankHolders = new Map<number, string>()
  const ranked = archive.projects.filter(
    (p): p is ArchiveShape['projects'][number] & { featuredRank: number } => p.featuredRank !== null
  )
  for (const project of ranked) {
    if (!project.hasBody) {
      violations.push({
        rule: 'featured-rank-requires-body',
        entry: project.id,
        detail: `featuredRank ${project.featuredRank} on a project with an empty body, which has no page to link to`,
      })
    }

    const holder = rankHolders.get(project.featuredRank)
    if (holder === undefined) {
      rankHolders.set(project.featuredRank, project.id)
    } else {
      violations.push({
        rule: 'featured-rank-distinct',
        entry: project.id,
        detail: `featuredRank ${project.featuredRank} is already held by ${holder}, so the home page's order is undefined`,
      })
    }
  }

  // ADR-0004. The COMPONENT must tolerate any number of images permanently — that
  // is the record's decision and it is why the before/after slider was rejected.
  // This asserts the authoring intent instead, which is the part that can be
  // wrong without anything looking broken.
  for (const group of archive.imageGroups) {
    if (group.layout === 'sideBySide' && group.imageCount !== 2) {
      violations.push({
        rule: 'side-by-side-two-images',
        entry: group.id,
        detail: `sideBySide holds ${group.imageCount} image(s); the layout means two`,
      })
    }
  }

  // ADR-0012. The Mexico-tour shape: three videos whose works ARE on
  // cnc-20200223's program but whose performance was the Mexico tour rather than
  // the Brooklyn Museum night. Both links pass every validation on the type.
  const programsByConcert = new Map(archive.concerts.map((c) => [c.id, new Set(c.program)]))
  // An empty programItem means the recording covers the whole concert, which is
  // the modelled case and not a gap — so those are filtered out rather than
  // checked.
  const pinned = archive.recordings.filter(
    (r): r is ArchiveShape['recordings'][number] & { programItemId: string } => r.programItemId !== null
  )
  for (const recording of pinned) {
    const program = programsByConcert.get(recording.concertId)
    if (program === undefined) {
      violations.push({
        rule: 'recording-item-on-concert-program',
        entry: recording.id,
        detail: `points at concert ${recording.concertId}, which is not in the published archive`,
      })
    } else if (!program.has(recording.programItemId)) {
      violations.push({
        rule: 'recording-item-on-concert-program',
        entry: recording.id,
        detail: `programItem ${recording.programItemId} is not on concert ${recording.concertId}'s program`,
      })
    }
  }

  return violations
}

/**
 * Throws with EVERY violation rather than the first.
 *
 * A build that fails one at a time costs a full CDA sweep per fix, and the person
 * reading the failure is in the Contentful web app with no way to see the rest of
 * the list. The message is the whole report.
 */
export function assertInvariants(archive: ArchiveShape): void {
  const violations = findViolations(archive)
  if (violations.length === 0) return

  const lines = violations.map((v) => `  ${v.rule}  ${v.entry}\n    ${v.detail}`)

  throw new Error(
    `${violations.length} invariant violation(s) in Contentful. These cannot be expressed as ` +
      `schema validations, so the build is the only thing checking them:\n\n${lines.join('\n')}\n`
  )
}
