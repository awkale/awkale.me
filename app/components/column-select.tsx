import { CheckboxButton, CheckboxField, CheckboxGroup, Label } from 'react-aria-components'

import { type ColumnSet, hideableColumns } from '../lib/columns'

/**
 * AWK-67's Columns control: which of an archive table's columns are on screen.
 *
 * A `CheckboxGroup`, not a multi-select `ComboBox` like facet-select.tsx. The two
 * look like the same problem and are not: a facet chooses among a few dozen values
 * that grow as the archive does, so it needs a field to type into; a table has four
 * or five columns, all of them visible at once, and the question is a set of
 * toggles. A search field over five fixed words would be ceremony.
 *
 * THE ROW-HEADER COLUMN IS NOT OFFERED. It carries the only link to the page below
 * — the concerts index is the one page linking the concert pages, and a composer
 * page the one linking its works — and React Aria's `Row` `href` is deliberately
 * not adopted, so hiding it would de-link the section. `hideableColumns` is where
 * that rule lives; app/lib/columns.ts also unions the column back in on the way out
 * of the query string, so hand-editing the URL cannot do it either. A DISABLED
 * checkbox was the other option and is worse: it would say the column is
 * conceptually hideable and merely unavailable, which is the opposite of true.
 *
 * SELECTION IS NOT STATE HERE. It arrives as `visible` and leaves through
 * `onChange`; the query string is the single source of truth, which is the rule
 * AWK-55 established for the facets and AWK-71 kept for the sort.
 *
 * Styling is in column-select.css, keyed on React Aria's data attributes, per
 * ADR-0004. Nothing here carries visual classes.
 */
export function ColumnSelect<Id extends string>({
  set,
  labels,
  visible,
  onChange,
}: {
  set: ColumnSet<Id>
  /** The header each column shows, so the control and the table read the same. */
  labels: Record<Id, string>
  visible: readonly Id[]
  onChange: (next: readonly Id[]) => void
}) {
  const hideable = hideableColumns(set)

  return (
    <CheckboxGroup
      className="column-select"
      /*
        The VALUE is the hideable columns only, so the group never reports a
        selection it cannot represent. The row header is added back by
        writeColumns, which is also the only thing standing between a hand-typed
        query string and a de-linked section — so it is written down once, there,
        rather than twice.
      */
      value={hideable.filter((id) => visible.includes(id))}
      onChange={(next) => onChange(next as Id[])}
    >
      <Label className="column-select-label eyebrow">Columns</Label>

      <div className="column-select-options">
        {/* `CheckboxField` + `CheckboxButton`, not the bare `Checkbox` React Aria
            1.20 deprecates. The field owns the state and the hidden input; the
            button is the clickable label, which is where the styling goes. */}
        {hideable.map((id) => (
          <CheckboxField key={id} value={id} className="column-select-option">
            <CheckboxButton className="column-select-button">
              {/* React Aria renders no box of its own — this span is what
                  column-select.css draws the tick into. */}
              <span className="column-select-box" aria-hidden="true" />
              {labels[id]}
            </CheckboxButton>
          </CheckboxField>
        ))}
      </div>
    </CheckboxGroup>
  )
}
