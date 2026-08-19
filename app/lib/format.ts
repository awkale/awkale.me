/**
 * Display helpers, moved out of app/data/sample.ts when AWK-39 deleted it.
 *
 * They are presentation, not data, which is why they survived the file that held
 * the placeholder archive: nothing here knows where a concert came from.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** `2012-03-15` → `15 Mar 2012`. Dates are ISO everywhere they are stored or routed. */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`
}

/**
 * ADR-0005's four verbs, in the abbreviations the source itself used.
 *
 * Not four words for one thing, and NOT collapsible to `arr.`: Ravel
 * orchestrated *Pictures*, Roven transcribed *Kindertotenlieder*, and Mauceri
 * edited the *Psycho* selections. Flattening them puts a factual error on 12 of
 * the 25 arranged pages, which for a section whose stated purpose is being a
 * reference library is the wrong trade.
 */
const VERBS: Record<string, string> = {
  Arrangement: 'arr.',
  Orchestration: 'orch.',
  Transcription: 'trans.',
  Edition: 'ed.',
}

/**
 * The credit line under a work.
 *
 * Two distinct works can share a title — Tchaikovsky's *Nutcracker Suite* and
 * Ellington's arrangement of it are the live case — and the arranger is the only
 * thing separating them on a programme.
 *
 * Until AWK-23 the arranger arrived inside the composer's own filing name, because
 * the archive held 25 records like `Tchaikovsky, Pyotr Ilyich (arr. by Ellington)`.
 * That migration moved it onto `work.arranger` and cleaned the names — so this
 * function became the ONLY thing rendering the credit, and the 2019-12-15
 * programme showed the same line twice until it was wired up.
 *
 * An arranger with no type falls back to `arr.` rather than dropping the credit,
 * because a missing name is worse than an imprecise verb. `arranger-needs-a-type`
 * in app/lib/invariants.ts is what stops that fallback from ever being reached;
 * it is a backstop, not a supported shape.
 */
export function byline({
  composer,
  arranger,
  arrangementType,
}: {
  composer: string
  arranger?: string | null
  arrangementType?: string | null
}): string {
  const credit = arrangerCredit({ arranger, arrangementType })
  return credit ? `${composer}, ${credit}` : composer
}

/**
 * Just the arranger half — `orch. Ravel`, or null when there is no arranger.
 *
 * Separate from `byline` because the work page links the composer's name to the
 * composer's page, and the arranger is a DIFFERENT person: sweeping the credit
 * into that link would point "arr. Ellington" at Tchaikovsky. The concert table
 * has no such link and takes the whole line as one string.
 */
export function arrangerCredit({
  arranger,
  arrangementType,
}: {
  arranger?: string | null
  arrangementType?: string | null
}): string | null {
  if (!arranger) return null
  // `Object.hasOwn`, not a bare lookup: `VERBS['constructor']` walks the
  // prototype and returns a function, which interpolates as
  // `function Object() { [native code] } Ravel`. Contentful's `in` validation
  // makes that unreachable from real data, but the fallback is documented as
  // total and a guard is cheaper than the assumption.
  const verb = arrangementType && Object.hasOwn(VERBS, arrangementType) ? VERBS[arrangementType] : 'arr.'
  return `${verb} ${arranger}`
}

/** `1` → `once`, `2` → `twice`, and a plain count after that. */
export function times(n: number): string {
  if (n === 1) return 'once'
  if (n === 2) return 'twice'
  return `${n} times`
}
