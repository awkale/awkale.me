import { Link } from 'react-router'

import { loadArchive } from '../lib/archive'
import { arrangerCredit, formatDate, times } from '../lib/format'
import type { Route } from './+types/work'

/**
 * A work page exists iff at least one (concert, item) pair was attended AND not
 * sat out — evaluated per PAIR, not per work, since 52 works were played twice
 * and 2 three times (ADR-0006).
 *
 * That strict rule is what earns the first-person claim. The page only exists
 * because he played it, so it says so plainly rather than hedging to "on a
 * programme I played". With a laxer rule the hedge would have been mandatory.
 *
 * Resolved by BOTH params, never by the work slug alone. `(composer, slug)` is
 * unique across all 625 works while `slug` alone collides on 26 — a lookup by
 * slug alone has up to four answers (ADR-0008).
 *
 * Period and forms are filters, never routes, so they render as flat tags here.
 */
export async function loader({ params }: Route.LoaderArgs) {
  const { works } = await loadArchive()
  const work = works.find((w) => w.slug === params.work && w.composerSlug === params.composer)

  if (!work) throw new Response(`No work ${params.composer}/${params.work}`, { status: 404 })

  return { work }
}

export default function Work({ loaderData }: Route.ComponentProps) {
  const { work } = loaderData
  const credit = arrangerCredit({ arranger: work.arrangerName, arrangementType: work.arrangementType })

  return (
    <main className="px-[var(--gutter)] py-[var(--space-section)]">
      <div className="mx-auto max-w-[var(--width-wide)]">
        <p className="kicker">
          <Link to={`/concerts/composers/${work.composerSlug}/`} className="no-underline hover:underline">
            {work.composerName}
          </Link>
          {/* Outside the Link on purpose — the arranger is a different person,
              and ADR-0001 gives them no page of their own to point at. */}
          {credit ? `, ${credit}` : null}
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">{work.title}</h1>

        <dl className="mt-5 flex flex-wrap gap-9">
          <Fact label="Period">{work.period ?? '—'}</Fact>
          <Fact label="Forms">{work.forms.length > 0 ? work.forms.join(', ') : '—'}</Fact>
          <Fact label="Performances">
            <span className="tabular">{work.performances.length}</span>
          </Fact>
        </dl>

        <p className="mt-6 max-w-[var(--measure)] font-medium">I played this {times(work.performances.length)}.</p>

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
                <td className="border-b border-border-subtle px-2 py-1.5 align-baseline">{p.hall ?? '—'}</td>
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
