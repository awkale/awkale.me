/**
 * PLACEHOLDER DATA — delete once the Contentful CDA is wired.
 *
 * None of the decided schema exists in the space yet (`concert.attended`,
 * `concert.satOut`, `composer.slug`, `composer.period`, `work.forms`, the
 * `project` type), so the routes below read this instead. Real figures, so the
 * structures are honest about density:
 *
 *   121 concerts · 322 works · 147 composers · 16 conductors · 5 halls
 *   6 concerts missed · 4 items sat out
 *
 * Independently reconciled three times — AWK-19, AWK-17, and again while
 * prototyping AWK-22 — by joining bso-graph.json to participation-checklist.md
 * and applying: AWK-15's arranger merge, ADR-0008's honorific merge and
 * particle relocation, kept generational markers, and ADR-0005's rule that an
 * arrangement is a distinct work.
 */

export const COUNTS = {
  concerts: 121,
  works: 322,
  composers: 147,
  conductors: 16,
  halls: 5,
  missed: 6,
  satOut: 4,
} as const

export type ProgramItem = {
  order: number
  /** Filing name of the composer, per ADR-0008. */
  composer: string
  /** Surname only. The source recorded no first names for arrangers. */
  arranger: string | null
  work: string
  workSlug: string
}

export type Concert = {
  date: string
  slug: string
  hall: string
  /** Null on 2007-12-16 — the one played concert with no conductor recorded. */
  conductor: string | null
  orchestra: string | null
  program: ProgramItem[]
}

export const CONCERTS: Concert[] = [
  {
    date: '2026-04-26',
    slug: '2026-04-26',
    hall: 'Brooklyn Museum of Art',
    conductor: 'Felipe Tristan',
    orchestra: 'BSO',
    program: [
      {
        order: 1,
        composer: 'Beethoven, Ludwig van',
        arranger: null,
        work: 'Coriolan Overture',
        workSlug: 'coriolan-overture',
      },
      {
        order: 2,
        composer: 'Elgar, Edward',
        arranger: null,
        work: 'Cello Concerto in A Minor',
        workSlug: 'cello-concerto-in-a-minor',
      },
      {
        order: 3,
        composer: 'Dvorak, Antonin',
        arranger: null,
        work: 'Symphony No. 8 in G Major',
        workSlug: 'symphony-no-8-in-g-major',
      },
    ],
  },
  {
    date: '2019-12-15',
    slug: '2019-12-15',
    hall: 'Brooklyn Museum of Art',
    conductor: 'Nicholas Armstrong',
    orchestra: 'BSO',
    // The case that forces the arranger byline: two distinct works, identical
    // title, and after AWK-15's merge both composers read plain Tchaikovsky.
    // Without `arranger` rendered, items 3 and 4 are indistinguishable.
    program: [
      { order: 1, composer: 'White, Andrew', arranger: null, work: 'Childhood Scenes', workSlug: 'childhood-scenes' },
      {
        order: 2,
        composer: 'Prokofiev, Sergei',
        arranger: null,
        work: 'Peter and the Wolf',
        workSlug: 'peter-and-the-wolf',
      },
      {
        order: 3,
        composer: 'Tchaikovsky, Pyotr Ilyich',
        arranger: null,
        work: 'The Nutcracker Suite',
        workSlug: 'the-nutcracker-suite',
      },
      {
        order: 4,
        composer: 'Tchaikovsky, Pyotr Ilyich',
        arranger: 'Ellington',
        work: 'The Nutcracker Suite',
        workSlug: 'the-nutcracker-suite-ellington',
      },
      {
        order: 5,
        composer: 'Strauss, Johann II',
        arranger: null,
        work: 'Perpetuum Mobile',
        workSlug: 'perpetuum-mobile',
      },
      { order: 6, composer: 'Anderson, Leroy', arranger: null, work: 'Sleigh Ride', workSlug: 'sleigh-ride' },
    ],
  },
  {
    date: '2007-12-16',
    slug: '2007-12-16',
    hall: 'Church of St. Ann & the Holy Trinity',
    conductor: null,
    orchestra: null,
    program: [
      { order: 1, composer: 'Bossert, Cameron', arranger: null, work: 'Music for Film', workSlug: 'music-for-film' },
      {
        order: 2,
        composer: 'Mendelssohn, Felix',
        arranger: null,
        work: 'Symphony No. 3 in A Minor ("Scottish")',
        workSlug: 'symphony-no-3-in-a-minor-scottish',
      },
    ],
  },
]

export type Work = {
  title: string
  slug: string
  composer: string
  arranger: string | null
  period: string
  forms: string[]
  performances: { date: string; slug: string; hall: string; conductor: string | null }[]
}

export const WORK: Work = {
  title: 'Symphony No. 5 in C Minor',
  slug: 'symphony-no-5-in-c-minor',
  composer: 'Beethoven, Ludwig van',
  arranger: null,
  period: 'Romantic',
  forms: ['Symphony'],
  performances: [
    { date: '2012-03-15', slug: '2012-03-15', hall: 'Walt Whitman Hall', conductor: 'Nicholas Armstrong' },
    { date: '2018-04-22', slug: '2018-04-22', hall: 'Brooklyn Museum of Art', conductor: 'David Bernard' },
  ],
}

/** Filing names, so the A–Z index files `Beethoven, Ludwig van` under B. */
export const COMPOSERS: { name: string; works: number }[] = [
  { name: 'Adams, John', works: 1 },
  { name: 'Anderson, Douglas', works: 1 },
  { name: 'Anderson, Leroy', works: 1 },
  { name: 'Bach, Johann Sebastian', works: 1 },
  { name: 'Barber, Samuel', works: 6 },
  { name: 'Beethoven, Ludwig van', works: 14 },
  { name: 'Bologne, Joseph, Chevalier de Saint-Georges', works: 1 },
  { name: 'Brahms, Johannes', works: 8 },
  { name: 'Dvorak, Antonin', works: 7 },
  { name: 'Elgar, Edward', works: 5 },
  { name: 'Falla, Manuel de', works: 1 },
  { name: 'Mendelssohn, Felix', works: 8 },
  { name: 'Mozart, Leopold', works: 1 },
  { name: 'Mozart, Wolfgang Amadeus', works: 8 },
  { name: 'Ravel, Maurice', works: 6 },
  { name: 'Sarasate, Pablo de', works: 1 },
  { name: 'Shostakovich, Dmitri', works: 6 },
  { name: 'Strauss, Johann II', works: 4 },
  { name: 'Strauss, Josef', works: 1 },
  { name: 'Strauss, Richard', works: 6 },
  { name: 'Sullivan, Arthur', works: 1 },
  { name: 'Tchaikovsky, Pyotr Ilyich', works: 12 },
  { name: 'Vaughan Williams, Ralph', works: 6 },
  { name: 'Walton, William', works: 3 },
  { name: 'Weber, Carl Maria von', works: 2 },
]

/** Only conductor and hall ship as filters (ADR-0006). */
export const FACETS = {
  conductors: [
    { name: 'Nicholas Armstrong', n: 94 },
    { name: 'Felipe Tristan', n: 7 },
    { name: 'David Bernard', n: 3 },
    { name: 'Andy Bhasin', n: 3 },
    { name: 'Arkady Leytush', n: 2 },
  ],
  halls: [
    { name: 'Brooklyn Museum of Art', n: 53 },
    { name: 'Church of St. Ann & the Holy Trinity', n: 52 },
    { name: 'Walt Whitman Hall', n: 13 },
    { name: 'Old First Reformed Church', n: 1 },
  ],
}

export type Project = {
  title: string
  slug: string
  organization: string
  years: string
  summary: string
  technologies: string[]
  liveUrl: string | null
  repoUrl: string | null
  /** Empty body means index-only: no page, and the card must not look clickable. */
  hasBody: boolean
  /** Requires a non-empty body — the fourth Contentful-inexpressible invariant. */
  featuredRank: number | null
}

export const PROJECTS: Project[] = [
  {
    title: 'dv01 Waterfall Design System',
    slug: 'dv01-waterfall-design-system',
    organization: 'dv01',
    years: '2021 — present',
    summary:
      "The design system behind dv01's loan-analytics platform: tokens, eight component categories, AG Grid table patterns, and a public documentation site.",
    technologies: ['React', 'TypeScript', 'Tailwind', 'Storybook', 'Supernova'],
    liveUrl: 'https://ux.dv01.co',
    repoUrl: null,
    hasBody: true,
    featuredRank: 1,
  },
  {
    title: 'Agent A',
    slug: 'agent-a',
    organization: 'dv01',
    years: '2025 — 2026',
    summary:
      'An agentic interface for loan-portfolio questions, designed around the problem that the answer is a table, not a sentence.',
    technologies: ['React', 'TypeScript', 'Claude API'],
    liveUrl: null,
    repoUrl: null,
    hasBody: true,
    featuredRank: 2,
  },
  {
    title: 'awkale.me',
    slug: 'awkale-me',
    organization: 'Personal',
    years: '2026',
    summary: 'This site. Prerendered React over Contentful, with an indexed history of every concert I have played.',
    technologies: ['React Router', 'Vite', 'Contentful', 'Netlify'],
    liveUrl: 'https://awkale.me',
    repoUrl: 'https://github.com/awkale/awkale.me',
    hasBody: false,
    featuredRank: null,
  },
  {
    title: 'Cision — Report Builder',
    slug: 'cision-report-builder',
    organization: 'Cision',
    years: '2017 — 2019',
    summary: 'A five-step wizard for assembling media-monitoring reports.',
    technologies: ['Angular', 'SCSS'],
    liveUrl: null,
    repoUrl: null,
    hasBody: false,
    featuredRank: null,
  },
  {
    title: 'Cision — Sidebar Navigation',
    slug: 'cision-sidebar-navigation',
    organization: 'Cision',
    years: '2017 — 2019',
    summary: 'Rebuilding the primary navigation for a dense analytics product.',
    technologies: ['Angular', 'SCSS'],
    liveUrl: null,
    repoUrl: null,
    hasBody: false,
    featuredRank: null,
  },
]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`
}

/** The byline that keeps two same-titled works apart. */
export function byline(item: { composer: string; arranger: string | null }): string {
  return item.arranger ? `${item.composer}, arr. ${item.arranger}` : item.composer
}
