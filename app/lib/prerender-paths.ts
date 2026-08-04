/**
 * The prerender path enumerator.
 *
 * Lives here rather than inline in react-router.config.ts so the CI page
 * assertion can import the same function the build uses — AWK-17 built and proved
 * that assertion, and its value depends on both sides deriving the page set from
 * one place rather than agreeing by hand.
 *
 * PLACEHOLDER SOURCE. This reads app/data/sample.ts today because none of the
 * decided Contentful schema exists in the space yet — no `concert.attended`, no
 * `composer.slug`, no `project` type. Swapping the source for one Contentful
 * Delivery API sweep is the only change needed here; the shape is already right.
 *
 * Two rules this must keep when that swap happens:
 *
 *   - Paths are SLASH-FREE. A trailing slash is a hard build failure.
 *   - Enumeration must be exhaustive, and the rule is ADR-0006's, not a count:
 *     a concert page exists iff `attended`; a work page iff at least one
 *     (concert, item) pair is attended AND not in `satOut`; a composer page iff
 *     at least one of their works qualifies. Evaluated per PAIR, because 52 works
 *     were played twice and 2 three times.
 */
import { CONCERTS, COMPOSERS, PROJECTS, WORK } from "../data/sample";

function composerSlug(filingName: string): string {
  // ADR-0008: slugs are STORED in Contentful, not derived — this is a stand-in
  // until composer.slug exists. Note the real rule strips honorifics (Sir/Dame)
  // so `unique: true` on composer.slug becomes an active guard, and keeps
  // generational markers (Strauss, Johann Sr. vs Johann II) because dropping them
  // would silently merge four different Strausses.
  return filingName
    .toLowerCase()
    .replace(/,\s*(sir|dame)\s+/g, ", ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function prerenderPaths(): Promise<string[]> {
  const paths = [
    "/",
    "/projects",
    "/concerts",
    "/concerts/composers",
    // ADR-0011's two contact pages. Static, and the only entries here that are
    // not derived from content — they exist whatever the archive holds. Both are
    // prerendered like everything else, which is the whole reason Netlify's form
    // scanner can see the form at deploy time.
    "/contact",
    "/contact/sent",
  ];

  // Case studies only. An empty `body` means index-only with no page, which is
  // ADR-0003's central property: a stub graduates by filling one field.
  for (const p of PROJECTS) {
    if (p.hasBody) paths.push(`/projects/${p.slug}`);
  }

  for (const c of CONCERTS) {
    paths.push(`/concerts/${c.slug}`);
  }

  for (const c of COMPOSERS) {
    paths.push(`/concerts/composers/${composerSlug(c.name)}`);
  }

  // Works are addressed canonically under their composer (ADR-0001).
  paths.push(
    `/concerts/composers/${composerSlug(WORK.composer)}/works/${WORK.slug}`,
  );

  const seen = new Set<string>();
  for (const p of paths) {
    if (p.endsWith("/") && p !== "/") {
      throw new Error(`prerender path has a trailing slash, which fails the build: ${p}`);
    }
    if (seen.has(p)) throw new Error(`duplicate prerender path: ${p}`);
    seen.add(p);
  }

  return paths;
}
