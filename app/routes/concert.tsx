import { Link } from 'react-router'

import { loadArchive } from '../lib/archive'
import { byline, formatDate } from '../lib/format'
import type { Route } from './+types/concert'

/**
 * A single concert. Lists ONLY what Alex played: a sat-out work is omitted from
 * the programme entirely, because the page documents his appearance rather than
 * the BSO's event (ADR-0006). The sweep has already applied that rule, so
 * anything reaching this component is his.
 *
 * The arranger byline is NOT decoration. 2019-12-15 carries two distinct works
 * both titled "The Nutcracker Suite" — Tchaikovsky's own and Ellington's
 * arrangement — and without the byline rendered, those two items are an
 * identical repeated line.
 */
export async function loader({ params }: Route.LoaderArgs) {
  const { concerts } = await loadArchive()
  const concert = concerts.find((c) => c.slug === params.date)

  // Unreachable in a build, since every path came from this same sweep. It is
  // here because the alternative is a `!` that turns a data gap into a null
  // dereference three lines further down.
  if (!concert) throw new Response(`No concert on ${params.date}`, { status: 404 })

  return { concert }
}

export default function Concert({ loaderData }: Route.ComponentProps) {
  const { concert } = loaderData

  return (
    <main className="px-[var(--gutter)] py-[var(--space-section)]">
      <div className="mx-auto max-w-[var(--width-wide)]">
        <p className="kicker">Concert</p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">{formatDate(concert.date)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {[concert.hall, concert.conductor, ...concert.orchestras].filter(Boolean).join(' · ')}
        </p>

        <table className="mt-6 w-full border-collapse text-[0.8rem]">
          <thead>
            <tr>
              <th className="eyebrow w-10 border-b border-border px-2 py-1.5 text-right font-medium">#</th>
              <th className="eyebrow border-b border-border px-2 py-1.5 text-left font-medium">Composer</th>
              <th className="eyebrow border-b border-border px-2 py-1.5 text-left font-medium">Work</th>
            </tr>
          </thead>
          <tbody>
            {concert.program.map((item) => (
              <tr key={item.id} className="hover:bg-muted">
                <td className="tabular border-b border-border-subtle px-2 py-1.5 text-right align-baseline text-muted-foreground">
                  {item.order}
                </td>
                <td className="border-b border-border-subtle px-2 py-1.5 align-baseline">
                  {item.composerName
                    ? byline({
                        composer: item.composerName,
                        arranger: item.arrangerName,
                        arrangementType: item.arrangementType,
                      })
                    : '—'}
                </td>
                <td className="border-b border-border-subtle px-2 py-1.5 align-baseline">
                  {/* Works are addressed canonically under their composer
                      (ADR-0001), so an item whose work has no composer has no
                      address and renders flat rather than as a dead link. */}
                  {item.composerSlug && item.workSlug ? (
                    <Link
                      to={`/concerts/composers/${item.composerSlug}/works/${item.workSlug}/`}
                      className="no-underline hover:underline"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    item.label
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ADR-0012: an outbound text link to whoever already publishes the
            recording. Never embedded, never self-hosted. An item-less recording
            covers the whole concert. */}
        {concert.recordings.length > 0 ? (
          <section className="mt-6 border-t border-border-subtle pt-3">
            <h2 className="eyebrow">Recordings</h2>
            <ul className="m-0 mt-1.5 list-none p-0 text-sm">
              {concert.recordings.map((recording) => (
                <li key={recording.id} className="py-0.5">
                  <a href={recording.url}>{recording.label}</a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="mt-6 max-w-[var(--measure)] border-t border-border-subtle pt-3 text-xs text-muted-foreground">
          Only what I played is listed.
        </p>
      </div>
    </main>
  )
}
