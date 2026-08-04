import { Link } from 'react-router'

import { PROJECTS } from '../data/sample'

/**
 * Direction B renders the index as a table rather than a card grid.
 *
 * The property ADR-0003 protects: a stub graduates to a case study by filling
 * one field — no migration, no new entry, no URL change. So there is ONE row
 * component varying on data presence, not two. The title is a link only when a
 * body exists; otherwise it is flat text. A card that looks clickable but is
 * not is worse than an obviously flat one.
 */
export default function Projects() {
  return (
    <main className="px-[var(--gutter)] py-[var(--space-section)]">
      <div className="mx-auto max-w-[var(--width-wide)]">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Projects</h1>
        <p className="mt-1 max-w-[56ch] text-sm text-muted-foreground">Two carry case studies. Three are index-only.</p>

        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr>
              <Th className="w-12">Rank</Th>
              <Th>Title</Th>
              <Th>Organization</Th>
              <Th>Years</Th>
              <Th>Page</Th>
            </tr>
          </thead>
          <tbody>
            {PROJECTS.map((p) => (
              <tr key={p.slug} className="hover:bg-muted">
                <Td className="tabular text-muted-foreground">{p.featuredRank ?? '—'}</Td>
                <Td>
                  {p.hasBody ? (
                    <Link to={`/projects/${p.slug}/`} className="font-medium no-underline hover:underline">
                      {p.title}
                    </Link>
                  ) : (
                    <span className="font-medium">{p.title}</span>
                  )}
                  <span className="mt-0.5 block text-[0.9em] text-muted-foreground">{p.summary}</span>
                </Td>
                <Td>{p.organization}</Td>
                <Td className="tabular whitespace-nowrap">{p.years}</Td>
                <Td className="text-[0.9em] text-muted-foreground">{p.hasBody ? 'case study' : '—'}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`border-b border-border px-2 py-1.5 text-left text-[0.66rem] font-medium tracking-[0.09em] text-muted-foreground uppercase ${className}`}
    >
      {children}
    </th>
  )
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`border-b border-border-subtle px-2 py-1.5 align-baseline ${className}`}>{children}</td>
}
