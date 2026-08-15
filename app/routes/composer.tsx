import { Link } from 'react-router'

import { loadArchive } from '../lib/archive'
import type { Route } from './+types/composer'

/**
 * A composer page — one per person whose work Alex played.
 *
 * The page exists iff at least one of their works qualifies, evaluated per
 * (concert, item) pair (ADR-0006). So a composer whose only work was sat out
 * disappears entirely, which is the rule working as designed rather than a gap.
 *
 * The name shown is the FILING name, per ADR-0008: the nobiliary particle is
 * relocated to the back rather than stripped, so `van Beethoven, Ludwig` files as
 * `Beethoven, Ludwig van` under B and the display name stays recoverable.
 * Honorifics ARE stripped — Walton and Sullivan were each split across two
 * records by a `Sir`, and both halves of Walton held played works, so he was
 * getting two half-empty pages until AWK-39 merged them.
 *
 * Works listed here are the canonical children of this page
 * (`/concerts/composers/<composer>/works/<work>`), which is why `work.slug` needs
 * to be unique only within this composer — the invariant app/lib/invariants.ts
 * asserts now that `unique: true` has come off the field.
 */
export async function loader({ params }: Route.LoaderArgs) {
  const { composers, works } = await loadArchive()
  const composer = composers.find((c) => c.slug === params.composer)

  if (!composer) throw new Response(`No composer ${params.composer}`, { status: 404 })

  return {
    composer,
    works: works.filter((w) => w.composerId === composer.id).sort((a, b) => a.title.localeCompare(b.title)),
  }
}

export default function Composer({ loaderData }: Route.ComponentProps) {
  const { composer, works } = loaderData

  return (
    <main className="px-[var(--gutter)] py-[var(--space-section)]">
      <div className="mx-auto max-w-[var(--width-wide)]">
        <p className="kicker">
          <Link to="/concerts/composers/" className="no-underline hover:underline">
            Composers
          </Link>
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">{composer.filingName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="tabular">{composer.workCount}</span> {composer.workCount === 1 ? 'work' : 'works'} I have
          played
        </p>

        <table className="mt-6 w-full border-collapse text-[0.8rem]">
          <thead>
            <tr>
              {['Work', 'Period', 'Forms', 'Performances'].map((h) => (
                <th key={h} className="eyebrow border-b border-border px-2 py-1.5 text-left font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {works.map((w) => (
              <tr key={w.id} className="hover:bg-muted">
                <td className="border-b border-border-subtle px-2 py-1.5 align-baseline">
                  <Link
                    to={`/concerts/composers/${w.composerSlug}/works/${w.slug}/`}
                    className="no-underline hover:underline"
                  >
                    {w.title}
                  </Link>
                </td>
                {/* Period and forms are AWK-37's, and empty until it runs. An em
                    dash is the honest rendering of a field nobody has filled. */}
                <td className="border-b border-border-subtle px-2 py-1.5 align-baseline text-muted-foreground">
                  {w.period ?? '—'}
                </td>
                <td className="border-b border-border-subtle px-2 py-1.5 align-baseline text-muted-foreground">
                  {w.forms.length > 0 ? w.forms.join(', ') : '—'}
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
