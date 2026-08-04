import { ToggleButton } from 'react-aria-components'
import { Link } from 'react-router'

import { COUNTS, CONCERTS, FACETS } from '../data/sample'

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
 */
export default function Concerts() {
  return (
    <main className="px-[var(--gutter)] py-[var(--space-section)]">
      <div className="mx-auto max-w-[var(--width-wide)]">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Performance history</h1>

        <p className="mt-2 text-sm text-muted-foreground">
          <span className="tabular">{COUNTS.concerts}</span> concerts · <span className="tabular">{COUNTS.works}</span>{' '}
          works · <span className="tabular">{COUNTS.composers}</span> composers ·{' '}
          <span className="tabular">{COUNTS.conductors}</span> conductors ·{' '}
          <span className="tabular">{COUNTS.halls}</span> halls
        </p>

        <FacetRow label="Conductor" items={FACETS.conductors} />
        <FacetRow label="Hall" items={FACETS.halls} />

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
            {CONCERTS.map((c) => (
              <tr key={c.slug} className="hover:bg-muted">
                <Td className="tabular">
                  <Link to={`/concerts/${c.slug}/`} className="no-underline hover:underline">
                    {c.date}
                  </Link>
                </Td>
                <Td>{c.hall}</Td>
                {/* 2007-12-16 has no conductor, which also hides it from the
                    conductor filter. The em dash is the honest rendering. */}
                <Td className={c.conductor ? '' : 'text-muted-foreground'}>{c.conductor ?? '—'}</Td>
                <Td className="tabular text-right">{c.program.length}</Td>
                <Td className="text-muted-foreground">
                  {c.program
                    .slice(0, 2)
                    .map((i) => i.work)
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
      className={`sticky top-[3.6rem] border-b border-border bg-background px-2 py-1.5 text-left text-[0.66rem] font-medium tracking-[0.09em] text-muted-foreground uppercase ${className}`}
    >
      {children}
    </th>
  )
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`border-b border-border-subtle px-2 py-1.5 align-baseline ${className}`}>{children}</td>
}
