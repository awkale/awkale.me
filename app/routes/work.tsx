import { Link } from 'react-router'

import { WORK, byline, formatDate } from '../data/sample'

/**
 * A work page exists iff at least one (concert, item) pair was attended AND not
 * sat out — evaluated per PAIR, not per work, since 52 works were played twice
 * and 2 three times (ADR-0006).
 *
 * That strict rule is what earns the first-person claim. The page only exists
 * because he played it, so it says so plainly rather than hedging to "on a
 * programme I played".
 *
 * Period and forms are filters, never routes, so they render as flat tags here.
 */
export default function Work() {
  const work = WORK

  return (
    <main className="px-[var(--gutter)] py-[var(--space-section)]">
      <div className="mx-auto max-w-[var(--width-wide)]">
        <p className="kicker">
          <Link to="/concerts/composers/beethoven-ludwig-van/" className="no-underline hover:underline">
            {byline(work)}
          </Link>
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">{work.title}</h1>

        <dl className="mt-5 flex flex-wrap gap-9">
          <Fact label="Period">{work.period}</Fact>
          <Fact label="Forms">{work.forms.join(', ')}</Fact>
          <Fact label="Performances">
            <span className="tabular">{work.performances.length}</span>
          </Fact>
        </dl>

        <p className="mt-6 max-w-[var(--measure)] font-medium">
          I played this {work.performances.length === 1 ? 'once' : 'twice'}.
        </p>

        <table className="mt-4 w-full border-collapse text-[0.8rem]">
          <thead>
            <tr>
              {['Date', 'Hall', 'Conductor'].map((h) => (
                <th key={h} className="eyebrow border-b border-border px-2 py-1.5 text-left font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {work.performances.map((p) => (
              <tr key={p.slug} className="hover:bg-muted">
                <td className="tabular border-b border-border-subtle px-2 py-1.5 align-baseline">
                  <Link to={`/concerts/${p.slug}/`} className="no-underline hover:underline">
                    {formatDate(p.date)}
                  </Link>
                </td>
                <td className="border-b border-border-subtle px-2 py-1.5 align-baseline">{p.hall}</td>
                <td className="border-b border-border-subtle px-2 py-1.5 align-baseline text-muted-foreground">
                  {p.conductor ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  )
}
