import { type RefObject, useRef, useState } from 'react'
import {
  Button,
  ComboBox,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Tag,
  TagGroup,
  TagList,
} from 'react-aria-components'

import { unknownValues } from '../lib/facets'

export type FacetItem = { name: string; n: number }

/**
 * One of the Performance history's two browse facets (ADR-0006 fixes the set at
 * exactly two: Conductor and Hall).
 *
 * A MULTI-SELECT `ComboBox`, which React Aria supports natively — the component
 * is generic over its selection mode, so `selectionMode="multiple"` is all it
 * takes. Two consequences worth knowing before editing this:
 *
 *   - Selection is controlled through `value` / `onChange`, carrying an array of
 *     keys. The `selectedKey` / `onSelectionChange` pair sitting beside them in
 *     the types is the DEPRECATED single-select path, typed `Key | null`, and
 *     using it here would silently collapse a multi-selection to one value.
 *   - Filtering the option list is React Aria's own, not ours. `ComboBox`
 *     applies a language-sensitive "contains" by default, which is the opposite
 *     of the call site-search.tsx makes — there the collection filter is switched
 *     OFF because app/lib/search.ts ranks and folds better than it does. Here
 *     there is no ranking to preserve and the list is a few dozen names, so the
 *     built-in is exactly right.
 *
 * This replaced a row of `ToggleButton` chips under AWK-55. The chips were the
 * bug: bare `<ToggleButton>` with no `isSelected` and no `onChange` gets its own
 * UNCONTROLLED on/off state from React Aria, which is why clicking one moved its
 * styling and nothing else. Thirty-seven conductors also made the row a wall
 * above the table it filtered. Both problems die with the control.
 *
 * COUNTS ARE ABSOLUTE AND NEVER RECOMPUTE. `Tara Simoncic 53` is a claim about
 * the Performance history — 53 concerts of Alex's career under that conductor —
 * not about the rows currently on screen. Cross-filtering them would redefine
 * the number as the latter, and would need exactly the extra pass the ticket
 * rejected.
 *
 * Styling is in facet-select.css, keyed on React Aria's data attributes, per
 * ADR-0004. Nothing here carries visual classes.
 */
export function FacetSelect({
  label,
  plural,
  items,
  selected,
  onChange,
  inputRef,
}: {
  label: string
  /** The lower-case plural, for the labels a screen reader reads. */
  plural: string
  items: FacetItem[]
  selected: string[]
  onChange: (next: string[]) => void
  /**
   * Lets a caller put focus on this field — the route uses it to catch focus
   * when the clear control unmounts itself. Optional, because the component
   * needs the same handle internally whether or not anyone asked for it.
   */
  inputRef?: RefObject<HTMLInputElement | null>
}) {
  /*
    The typed filter query, and the ONLY state this component owns. Selection is
    not state here — it lives in the URL and arrives as a prop, which is the
    whole point of AWK-55. Keeping the query local is safe because it describes
    what the reader is looking at, not what they have chosen.
  */
  const [query, setQuery] = useState('')

  const localField = useRef<HTMLInputElement>(null)
  const field = inputRef ?? localField

  /*
    Values in the URL that this control has no option for — see unknownValues.
    `?conductor=Nobody` has to survive a selection change rather than vanishing
    from the URL, which would be the same silent-ignore failure AWK-55 reports
    arriving from a different direction. The tag list below renders these like
    any other selection, so they stay removable one at a time rather than only
    by the clear control.

    React Aria turns out to KEEP keys it has no item for in `value`, and hands
    them back on its own. That is undocumented and not worth building on, so the
    write below carries them explicitly — as a UNION rather than an append,
    precisely because React Aria already returns them: concatenating duplicates
    every unknown value on every click, which is what the first run of
    facet-select.test.ts caught.
  */
  const unknown = unknownValues(
    selected,
    items.map((item) => item.name)
  )

  return (
    <div className="facet-select">
      <ComboBox
        className="facet-select-box"
        selectionMode="multiple"
        defaultItems={items}
        value={selected}
        onChange={(keys) => onChange([...new Set([...keys.map(String), ...unknown])])}
        inputValue={query}
        onInputChange={setQuery}
        // Reopening on last time's query would show a short list with no
        // indication that anything was hidden — a reader who typed "arm" once
        // and came back later would be told this orchestra has one conductor.
        // site-search.tsx clears its field on navigation for the same reason.
        onOpenChange={(isOpen) => {
          if (!isOpen) setQuery('')
        }}
        // The popover has to be able to open on a query that matches nothing,
        // or the "No matches" state below is unreachable.
        allowsEmptyCollection
      >
        <Label className="facet-select-label eyebrow">{label}</Label>

        <div className="facet-select-field">
          <Input ref={field} className="facet-select-input" placeholder={`Filter by ${label.toLowerCase()}`} />
          <Button className="facet-select-trigger" aria-label={`Show all ${plural}`} />
        </div>

        <Popover className="facet-select-popover" offset={4}>
          <ListBox
            className="facet-select-list"
            renderEmptyState={() => <div className="facet-select-empty">No matches</div>}
          >
            {(item: FacetItem) => (
              /* The name IS the id, which is also what the query string carries
                 and what a Concert holds. One string, no derivation, no slug. */
              <ListBoxItem id={item.name} textValue={item.name} className="facet-select-option">
                <span>{item.name}</span>
                <span className="facet-select-count tabular">{item.n}</span>
              </ListBoxItem>
            )}
          </ListBox>
        </Popover>
      </ComboBox>

      {/*
        Driven from `selected` — the URL — rather than from the ComboBox's
        `ComboBoxValue`, which reports only the items its collection can resolve
        and would drop an unknown value on the floor. The URL is the single
        source of truth for selection everywhere in this feature, and this is
        the place that is easiest to accidentally make a second one.
      */}
      <TagGroup
        className="facet-select-tags"
        aria-label={`Selected ${plural}`}
        onRemove={(keys) => {
          const next = selected.filter((value) => !keys.has(value))
          onChange(next)

          // Removing the LAST tag unmounts the group the reader is standing in,
          // so catch focus on the field rather than letting it fall to <body>.
          if (next.length === 0) field.current?.focus()
        }}
      >
        <TagList className="facet-select-taglist" items={selected.map((name) => ({ id: name }))}>
          {(item) => (
            <Tag className="facet-select-tag" textValue={item.id}>
              {({ allowsRemoving }) => (
                <>
                  {item.id}
                  {allowsRemoving && (
                    <Button slot="remove" className="facet-select-tag-remove" aria-label={`Remove ${item.id}`}>
                      ×
                    </Button>
                  )}
                </>
              )}
            </Tag>
          )}
        </TagList>
      </TagGroup>
    </div>
  )
}
