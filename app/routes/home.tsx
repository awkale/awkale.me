import { Link } from "react-router";
import { COUNTS } from "../data/sample";

/**
 * Home is a landing page distinct from the /projects/ index (ADR-0001).
 *
 * Structure is direction B: a masthead with the counts, then a directory of
 * routes. It gives immediate access to the indexes rather than selling anything,
 * which suits a section that is primarily a tool for its author.
 */
export default function Home() {
  return (
    <main className="px-[var(--gutter)] py-[var(--space-section)]">
      <div className="mx-auto max-w-[var(--width-wide)]">
        <div className="flex flex-wrap items-end justify-between gap-8 border-b-2 border-foreground pb-6">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Alex W. Kale</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Design systems &amp; front-end engineering · Brooklyn
            </p>
          </div>

          <dl className="flex gap-8">
            <Stat label="Concerts" value={COUNTS.concerts} />
            <Stat label="Works" value={COUNTS.works} />
            <Stat label="Composers" value={COUNTS.composers} />
          </dl>
        </div>

        <div className="mt-8 overflow-hidden rounded-[var(--radius)] border border-border-subtle">
          <DirRow to="/projects/" path="/projects" desc="Five pieces of design and development work" n="5" />
          <DirRow
            to="/concerts/"
            path="/concerts"
            desc="Performance history, indexed by composer and work"
            n={String(COUNTS.concerts)}
          />
          <DirRow
            to="/concerts/composers/"
            path="/concerts/composers"
            desc="A–Z index"
            n={String(COUNTS.composers)}
          />
          {/* Reserved permanently for Alex's own original work (ADR-0001). */}
          <DirRow path="/music" desc="Reserved" n="—" />
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[0.66rem] uppercase tracking-[0.1em] text-muted-foreground">{label}</dt>
      <dd className="tabular mt-0.5 text-2xl">{value}</dd>
    </div>
  );
}

function DirRow({
  to,
  path,
  desc,
  n,
}: {
  to?: string;
  path: string;
  desc: string;
  n: string;
}) {
  const cells = (
    <>
      <span className="font-mono text-sm">{path}</span>
      <span className="hidden text-muted-foreground sm:block">{desc}</span>
      <span className="tabular text-right text-muted-foreground">{n}</span>
    </>
  );

  const grid =
    "grid grid-cols-[1fr_auto] items-baseline gap-4 border-b border-border-subtle px-4 py-3 text-sm last:border-b-0 sm:grid-cols-[16rem_1fr_4rem]";

  // A row without a destination is rendered flat, never as a dead link.
  if (!to) {
    return <span className={`${grid} text-muted-foreground`}>{cells}</span>;
  }

  return (
    <Link to={to} className={`${grid} text-foreground no-underline hover:bg-muted`}>
      {cells}
    </Link>
  );
}
