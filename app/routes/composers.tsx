import { Link } from "react-router";
import { COMPOSERS, COUNTS } from "../data/sample";

/**
 * The A–Z index, and the surface where ADR-0008 is visibly working.
 *
 * Names are FILING names, and the nobiliary particle is relocated to the back
 * rather than stripped: `van Beethoven, Ludwig` files as `Beethoven, Ludwig van`
 * under B. Nothing is discarded, so the display name stays recoverable from the
 * filing name alone. A slug derived from the old sortName filed Beethoven under
 * V, along with von Weber, de Falla and de Sarasate.
 *
 * Because the prefix already sits at the back, the filing letter is simply the
 * first character. That is the whole point — no stripping at read time.
 *
 * This index is also why --link-visited exists: it is a tool whose author
 * benefits from seeing which composers he has already opened. :visited can only
 * be expressed in COLOUR, so any attempt to carry it by weight or marker
 * silently fails.
 */
export default function Composers() {
  const byLetter = new Map<string, typeof COMPOSERS>();
  for (const c of COMPOSERS) {
    const letter = c.name[0].toUpperCase();
    if (!byLetter.has(letter)) byLetter.set(letter, []);
    byLetter.get(letter)!.push(c);
  }
  const letters = [...byLetter.keys()].sort();

  return (
    <main className="px-[var(--gutter)] py-[var(--space-section)]">
      <div className="mx-auto max-w-[var(--width-wide)]">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Composers A–Z</h1>
        <p className="mt-1 max-w-[56ch] text-sm text-muted-foreground">
          {COUNTS.composers} composers whose work I have played.
        </p>

        <nav className="mt-5 flex flex-wrap gap-0.5">
          {letters.map((l) => (
            <a
              key={l}
              href={`#letter-${l}`}
              className="min-w-6 rounded px-1.5 py-0.5 text-center text-sm no-underline hover:bg-muted"
            >
              {l}
            </a>
          ))}
        </nav>

        <div className="mt-6 [column-gap:3rem] [columns:18rem]">
          {letters.map((l) => (
            <section key={l} id={`letter-${l}`} className="mb-7 break-inside-avoid">
              <h2 className="font-display border-b border-border pb-1 text-lg text-[color:var(--accent-11)]">
                {l}
              </h2>
              <ul className="m-0 list-none p-0 text-sm">
                {byLetter.get(l)!.map((c) => (
                  <li key={c.name} className="flex items-baseline justify-between gap-2 py-0.5">
                    <Link to="/concerts/composers/" className="no-underline hover:underline">
                      {c.name}
                    </Link>
                    <span className="tabular text-xs text-muted-foreground">{c.works}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
