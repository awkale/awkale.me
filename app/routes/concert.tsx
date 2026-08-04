import { Link } from 'react-router'

import { CONCERTS, byline, formatDate } from '../data/sample'

/**
 * A single concert. Lists ONLY what Alex played: a sat-out work is omitted from
 * the programme entirely, because the page documents his appearance rather than
 * the BSO's event (ADR-0006).
 *
 * The arranger byline is NOT decoration. 2019-12-15 carries two distinct works
 * both titled "The Nutcracker Suite" — Tchaikovsky's own and Ellington's
 * arrangement — and after AWK-15's merge both composer records read plain
 * "Tchaikovsky, Pyotr Ilyich". `arr. Ellington` is the only thing separating
 * items 3 and 4. Drop it and one real programme shows a duplicated line.
 */
export default function Concert() {
  // Placeholder: the real route resolves this from the date param.
  const concert = CONCERTS.find((c) => c.slug === '2019-12-15')!

  return (
    <main className="px-[var(--gutter)] py-[var(--space-section)]">
      <div className="mx-auto max-w-[var(--width-wide)]">
        <p className="text-[0.72rem] tracking-[0.14em] text-muted-foreground uppercase">Concert</p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">{formatDate(concert.date)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {[concert.hall, concert.conductor, concert.orchestra].filter(Boolean).join(' · ')}
        </p>

        <table className="mt-6 w-full border-collapse text-[0.8rem]">
          <thead>
            <tr>
              <th className="w-10 border-b border-border px-2 py-1.5 text-right text-[0.66rem] font-medium tracking-[0.09em] text-muted-foreground uppercase">
                #
              </th>
              <th className="border-b border-border px-2 py-1.5 text-left text-[0.66rem] font-medium tracking-[0.09em] text-muted-foreground uppercase">
                Composer
              </th>
              <th className="border-b border-border px-2 py-1.5 text-left text-[0.66rem] font-medium tracking-[0.09em] text-muted-foreground uppercase">
                Work
              </th>
            </tr>
          </thead>
          <tbody>
            {concert.program.map((item) => (
              <tr key={item.order} className="hover:bg-muted">
                <td className="tabular border-b border-border-subtle px-2 py-1.5 text-right align-baseline text-muted-foreground">
                  {item.order}
                </td>
                <td className="border-b border-border-subtle px-2 py-1.5 align-baseline">{byline(item)}</td>
                <td className="border-b border-border-subtle px-2 py-1.5 align-baseline">
                  <Link to={`/concerts/works/${item.workSlug}/`} className="no-underline hover:underline">
                    {item.work}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-6 max-w-[var(--measure)] border-t border-border-subtle pt-3 text-xs text-muted-foreground">
          Only what I played is listed.
        </p>
      </div>
    </main>
  )
}
