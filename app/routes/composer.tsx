import { Link } from 'react-router'

import { COMPOSERS, WORK } from '../data/sample'

/**
 * A composer page — 147 of these, one per person whose work Alex played.
 *
 * The page exists iff at least one of their works qualifies, evaluated per
 * (concert, item) pair (ADR-0006). So a composer whose only work was sat out
 * disappears entirely, which is the rule working as designed rather than a gap.
 *
 * The name shown is the FILING name, per ADR-0008: the nobiliary particle is
 * relocated to the back rather than stripped, so `van Beethoven, Ludwig` files as
 * `Beethoven, Ludwig van` under B and the display name stays recoverable. Nothing
 * is discarded. Honorifics ARE stripped — Walton and Sullivan were each split
 * across two records by a `Sir`, and both halves of Walton held played works, so
 * he was getting two half-empty pages.
 *
 * Works listed here are the canonical children of this page
 * (`/concerts/composers/<composer>/works/<work>`), which is why `work.slug` needs
 * to be unique only within this composer.
 */
export default function Composer() {
  // Placeholder: the real route resolves this from the :composer param.
  const composer = COMPOSERS.find((c) => c.name === 'Beethoven, Ludwig van')!
  const works = [WORK]

  return (
    <main className="px-[var(--gutter)] py-[var(--space-section)]">
      <div className="mx-auto max-w-[var(--width-wide)]">
        <p className="text-[0.72rem] tracking-[0.14em] text-muted-foreground uppercase">
          <Link to="/concerts/composers/" className="no-underline hover:underline">
            Composers
          </Link>
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">{composer.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="tabular">{composer.works}</span> {composer.works === 1 ? 'work' : 'works'} I have played
        </p>

        <table className="mt-6 w-full border-collapse text-[0.8rem]">
          <thead>
            <tr>
              {['Work', 'Period', 'Forms', 'Performances'].map((h) => (
                <th
                  key={h}
                  className="border-b border-border px-2 py-1.5 text-left text-[0.66rem] font-medium tracking-[0.09em] text-muted-foreground uppercase"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {works.map((w) => (
              <tr key={w.slug} className="hover:bg-muted">
                <td className="border-b border-border-subtle px-2 py-1.5 align-baseline">
                  <Link
                    to={`/concerts/composers/beethoven-ludwig-van/works/${w.slug}/`}
                    className="no-underline hover:underline"
                  >
                    {w.title}
                  </Link>
                  {/* The arranger is what keeps two same-titled works apart —
                      Tchaikovsky's Nutcracker Suite and Ellington's are distinct
                      works with an identical title. */}
                  {w.arranger ? <span className="text-muted-foreground"> — arr. {w.arranger}</span> : null}
                </td>
                <td className="border-b border-border-subtle px-2 py-1.5 align-baseline text-muted-foreground">
                  {w.period}
                </td>
                <td className="border-b border-border-subtle px-2 py-1.5 align-baseline text-muted-foreground">
                  {w.forms.join(', ')}
                </td>
                <td className="tabular border-b border-border-subtle px-2 py-1.5 align-baseline">
                  {w.performances.length}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}
