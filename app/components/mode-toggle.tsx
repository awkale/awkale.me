import { useEffect, useState } from "react";
import { getMode, setMode, watchSystem, type Mode } from "../lib/mode";

const MODES: Mode[] = ["light", "dark", "system"];

/**
 * Renders a neutral state on the server/prerender pass and syncs on mount.
 * It CANNOT read the stored mode during render — see lib/mode.ts, consequence 2.
 */
export function ModeToggle() {
  const [mode, setLocal] = useState<Mode | null>(null);

  useEffect(() => {
    setLocal(getMode());
    return watchSystem();
  }, []);

  function choose(next: Mode) {
    setMode(next);
    setLocal(next);
  }

  return (
    <div
      role="group"
      aria-label="Colour mode"
      className="flex overflow-hidden rounded-[var(--radius)] border border-border"
    >
      {MODES.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => choose(m)}
          aria-pressed={mode === m}
          className="border-l border-border-subtle px-2.5 py-1 text-xs capitalize
                     text-muted-foreground first:border-l-0
                     aria-pressed:bg-primary aria-pressed:text-primary-foreground
                     hover:bg-muted"
        >
          {m}
        </button>
      ))}
    </div>
  );
}
