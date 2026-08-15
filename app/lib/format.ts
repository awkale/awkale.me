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
 * The credit line under a work.
 *
 * Two distinct works can share a title — Tchaikovsky's *Nutcracker Suite* and
 * Ellington's arrangement of it are the live case — and the arranger is the only
 * thing separating them on a programme.
 *
 * TODAY the arranger arrives inside the composer's own filing name, because the
 * archive still holds 25 records like `Tchaikovsky, Pyotr Ilyich (arr. by
 * Ellington)`. ADR-0005 splits those into a clean composer plus a `work.arranger`
 * link under AWK-23, at which point `arranger` here starts arriving populated and
 * the names stop carrying it. Both shapes render correctly; the second is just
 * tidier.
 */
export function byline({ composer, arranger }: { composer: string; arranger?: string | null }): string {
  return arranger ? `${composer}, arr. ${arranger}` : composer
}

/** `1` → `once`, `2` → `twice`, and a plain count after that. */
export function times(n: number): string {
  if (n === 1) return 'once'
  if (n === 2) return 'twice'
  return `${n} times`
}
