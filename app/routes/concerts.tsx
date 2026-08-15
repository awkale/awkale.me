import { ToggleButton } from 'react-aria-components'
import { Link } from 'react-router'

import { loadArchive } from '../lib/archive'
import type { Route } from './+types/concerts'

/**
 * The dense surface, and the one that decided direction B.
 *
 * Dates are tabular mono so a column of 121 lines up. Facets are conductor and
 * hall ONLY (ADR-0006): soloist was rejected because 256 of the 404 programme
 * occasions carry no soloist at all, and season was dropped entirely as an
 * institutional artifact. The chronological spine is the date, grouped by year.
 *
 * Filters live in the query string so a filtered view stays linkable, which is
 * why facets need no routes of their own — the decision that keeps this section
 * at ~590 pages instead of ~870.
 *
 * Every count here is COMPUTED from the published set rather than quoted. ADR-0006
 * replaced a fixed page count with a rule, and said so explicitly: the number moves
 * down as the checklist is filled in and up as pre-BSO programmes are added, so
 * anything needing it must derive it.
 */
export async function loader() {
  const { concerts, works, composers } = await loadArchive()

  const tally = (values: (string | null)[]) => {
    const counts = new Map<string, number>()
    for (const value of values) {
      if (value) counts.set(value, (counts.get(value) ?? 0) + 1)
    }
    return [...counts.entries()]
      .map(([name, n]) => ({ name, n }))
      .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
  }

  const conductors = tally(concerts.map((c) => c.conductor))
  const halls = tally(concerts.map((c) => c.hall))

  return {
    concerts,
    facets: { conductors, halls },
    counts: {
      concerts: concerts.length,
      works: works.length,
      composers: composers.length,
      conductors: conductors.length,
      halls: halls.length,
    },
  }
}

export default function Concerts({ loaderData }: Route.ComponentProps) {
  const { concerts, facets, counts } = loaderData

  return (
    <main className="px-[var(--gutter)] py-[var(--space-section)]">
      <div className="mx-auto max-w-[var(--width-wide)]">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Performance history</h1>

        <p className="mt-2 text-sm text-muted-foreground">
          <span className="tabular">{counts.concerts}</span> concerts · <span className="tabular">{counts.works}</span>{' '}
          works · <span className="tabular">{counts.composers}</span> composers ·{' '}
          <span className="tabular">{counts.conductors}</span> conductors ·{' '}
          <span className="tabular">{counts.halls}</span> halls
        </p>

        <FacetRow label="Conductor" items={facets.conductors} />
        <FacetRow label="Hall" items={facets.halls} />

        <table className="mt-5 w-full border-collapse text-[0.8rem]">
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Hall</Th>
              <Th>Conductor</Th>
              <Th className="text-right">Items</Th>
              <Th>Programme</Th>
            </tr>
          </thead>
          <tbody>
            {concerts.map((c) => (
              <tr key={c.id} className="hover:bg-muted">
                <Td className="tabular">
                  <Link to={`/concerts/${c.slug}/`} className="no-underline hover:underline">
                    {c.date}
                  </Link>
                </Td>
                <Td>{c.hall ?? '—'}</Td>
                {/* 2007-12-16 has no conductor, which also hides it from the
                    conductor filter. The em dash is the honest rendering. */}
                <Td className={c.conductor ? '' : 'text-muted-foreground'}>{c.conductor ?? '—'}</Td>
                <Td className="tabular text-right">{c.program.length}</Td>
                <Td className="text-muted-foreground">
                  {c.program
                    .slice(0, 2)
                    .map((i) => i.label)
                    .join(', ')}
                  {c.program.length > 2 ? '…' : ''}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}

/**
 * Facet chips are `ToggleButton`s, not `Button`s — each one is an independently
 * on/off filter, so React Aria gives it `aria-pressed` and selection state rather
 * than the fire-and-forget semantics of a button. Conductor and hall are the only
 * two facets that ship (ADR-0006).
 *
 * Filtering itself is not wired: ADR-0001 puts facet state in the query string so a
 * filtered view stays linkable, which is what keeps these off the route table.
 */
function FacetRow({ label, items }: { label: string; items: { name: string; n: number }[] }) {
  return (
    <div className="facet-chips">
      <span className="facet-chips-label">{label}</span>
      {items.map((f) => (
        <ToggleButton key={f.name} className="facet-chip">
          {f.name}
          <span className="facet-chip-count">{f.n}</span>
        </ToggleButton>
      ))}
    </div>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`eyebrow sticky top-[3.6rem] border-b border-border bg-background px-2 py-1.5 text-left font-medium ${className}`}
    >
      {children}
    </th>
  )
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`border-b border-border-subtle px-2 py-1.5 align-baseline ${className}`}>{children}</td>
}
