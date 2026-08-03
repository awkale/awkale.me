import { useEffect, useState } from "react";
import { RadioGroup, RadioField, RadioButton } from "react-aria-components";
import { getMode, setMode, watchSystem, type Mode } from "../lib/mode";

const MODES: Mode[] = ["light", "dark", "system"];

/**
 * A three-way colour-mode control, built on React Aria's `RadioGroup`.
 *
 * A segmented control IS a radio group semantically — one value from a mutually
 * exclusive set — which buys real keyboard behaviour: a single tab stop for the
 * group, arrow keys between options, correct `radiogroup`/`radio` roles. An earlier
 * hand-rolled version used three `<button aria-pressed>` in a `role="group"`, which
 * is a weaker and different contract: three tab stops, no arrow keys, and
 * `aria-pressed` describing independent toggles rather than a single choice.
 *
 * `RadioButton`, not `Radio`: React Aria deprecated `Radio` in favour of
 * `RadioField` + `RadioButton`. `RadioField` pairs a control with a label and
 * description, which a segmented control does not want — the segment *is* the label.
 *
 * Styling lives in mode-toggle.css, keyed on the `data-*` attributes React Aria
 * sets. Nothing here carries visual classes.
 *
 * ADR-0004's landmine is why `value` starts null: with `ssr: false` the prerendered
 * HTML is identical for every visitor, so this control cannot know its own state at
 * build time. It renders unselected and syncs on mount. Reading the stored mode
 * during render would produce a hydration mismatch on all ~600 pages.
 */
export function ModeToggle() {
  const [mode, setLocal] = useState<Mode | null>(null);

  useEffect(() => {
    setLocal(getMode());
    return watchSystem();
  }, []);

  return (
    <RadioGroup
      aria-label="Colour mode"
      value={mode}
      onChange={(next) => {
        setMode(next as Mode);
        setLocal(next as Mode);
      }}
      className="mode-toggle"
    >
      {MODES.map((m) => (
        /* RadioField owns the value; RadioButton owns the interaction states and
           is the thing you see. Only RadioButton gets [data-hovered],
           [data-pressed] and [data-focus-visible] — RadioField exposes just
           [data-selected] and validity — so all styling keys off the button.
           The field is display:contents so the segment stays a flex child. */
        <RadioField key={m} value={m} className="mode-toggle-field">
          <RadioButton className="mode-toggle-segment">{m}</RadioButton>
        </RadioField>
      ))}
    </RadioGroup>
  );
}
