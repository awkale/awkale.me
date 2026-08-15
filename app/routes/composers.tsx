import { Link } from 'react-router'

import { loadArchive } from '../lib/archive'
import type { Route } from './+types/composers'

/**
 * The A–Z index, and the surface where ADR-0008 is visibly working.
 *
 * Names are FILING names, and the nobiliary particle is relocated to the back
 * rather than stripped: `van Beethoven, Ludwig` files as `Beethoven, Ludwig van`
 * under B. Nothing is discarded, so the display name stays recoverable from the
 * filing name alone. Before AWK-39 ran the relocation, Beethoven filed under V,
 * along with von Weber, de Falla and de Sarasate.
 *
 * Because the prefix already sits at the back, the filing letter is simply the
 * first character. That is the whole point — no stripping at read time.
 *
 * This index is also why --link-visited exists: it is a tool whose author
 * benefits from seeing which composers he has already opened. :visited can only
 * be expressed in COLOUR, so any attempt to carry it by weight or marker
 * silently fails.
 */
export async function loader() {
  const { composers } = await loadArchive()

  // Grouped in the loader rather than the component so the work happens once at
  // build time instead of on every hydration.
  const byLetter = new Map<string, typeof composers>()
  for (const composer of composers) {
    const letter = (composer.filingName[0] ?? '?').toUpperCase()
    const group = byLetter.get(letter) ?? []
    group.push(composer)
    byLetter.set(letter, group)
  }

  return {
    total: composers.length,
    letters: [...byLetter.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([letter, group]) => ({ letter, group })),
  }
}

export default function Composers({ loaderData }: Route.ComponentProps) {
  const { total, letters } = loaderData

  return (
    <main className="px-[var(--gutter)] py-[var(--space-section)]">
      <div className="mx-auto max-w-[var(--width-wide)]">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Composers A–Z</h1>
        <p className="mt-1 max-w-[56ch] text-sm text-muted-foreground">{total} composers whose work I have played.</p>

        <nav className="mt-5 flex flex-wrap gap-0.5">
          {letters.map(({ letter }) => (
            <a
              key={letter}
              href={`#letter-${letter}`}
              className="min-w-6 rounded px-1.5 py-0.5 text-center text-sm no-underline hover:bg-muted"
            >
              {letter}
            </a>
          ))}
        </nav>

        <div className="mt-6 [columns:18rem] [column-gap:3rem]">
          {letters.map(({ letter, group }) => (
            <section key={letter} id={`letter-${letter}`} className="mb-7 break-inside-avoid">
              <h2 className="border-b border-border pb-1 font-display text-lg text-[color:var(--accent-11)]">
                {letter}
              </h2>
              <ul className="m-0 list-none p-0 text-sm">
                {group.map((c) => (
                  <li key={c.id} className="flex items-baseline justify-between gap-2 py-0.5">
                    <Link to={`/concerts/composers/${c.slug}/`} className="no-underline hover:underline">
                      {c.filingName}
                    </Link>
                    <span className="tabular text-xs text-muted-foreground">{c.workCount}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}
