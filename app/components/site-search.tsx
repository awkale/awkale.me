import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Collection,
  ComboBox,
  Header,
  Input,
  ListBox,
  ListBoxItem,
  ListBoxSection,
  Popover,
} from 'react-aria-components'
import { useLocation } from 'react-router'

import type { SearchEntry } from '../lib/archive'
import { groupResults } from '../lib/search'
import { loadSearchIndex } from '../lib/search-index'

/**
 * ADR-0011's archive search: a build-time index, filtered on the client, in the
 * header of every page.
 *
 * Four things here are load-bearing.
 *
 * 1. THE INDEX IS NOT TOUCHED UNTIL SOMEONE INTERACTS. This renders on all ~600
 *    prerendered pages; importing ~50 KB of index on each one, for the majority
 *    who never search, is the cost the deferral exists to avoid. `loadIndex` is
 *    a prop purely so the test can prove it was not called.
 *
 * 2. RESULTS ARE ANCHORS, via `href` on ListBoxItem. React Aria then treats each
 *    row as a link rather than a selectable option — `onSelectionChange` fires
 *    with NULL and never with the key, so wiring navigation through selection
 *    silently does nothing. The payoff is the ordinary web: cmd-click,
 *    middle-click, "open in new tab", "copy link address". Client-side routing
 *    comes from the React Aria RouterProvider in app/root.tsx; without it these
 *    still work, as full page loads.
 *
 * 3. REACT ARIA'S OWN FILTER IS OFF (`defaultFilter={() => true}`). It defaults
 *    to a language-sensitive "contains" over the collection, which would throw
 *    away rows app/lib/search.ts deliberately kept — `dvorak` matching `Dvořák`
 *    is exactly such a row. One filter, in the module that can be tested.
 *
 * 4. IT RENDERS EMPTY AND STAYS EMPTY UNTIL MOUNT, per ADR-0004's landmine.
 *    With `ssr: false` the prerendered HTML is identical for every visitor, so
 *    state that differs per visitor has to arrive after hydration. An empty
 *    index is the same on the server and the client, so there is nothing to
 *    mismatch — the same reason ModeToggle starts at `null`.
 *
 * Styling is in site-search.css, keyed on React Aria's data attributes. Nothing
 * here carries visual classes, per ADR-0004.
 */
export function SiteSearch({ loadIndex = loadSearchIndex }: { loadIndex?: () => Promise<SearchEntry[]> }) {
  const [index, setIndex] = useState<SearchEntry[]>([])
  const [query, setQuery] = useState('')
  const requested = useRef(false)
  const { pathname } = useLocation()

  // Opening a result leaves the query sitting in the field, so the next focus
  // would reopen last time's search. Clearing on navigation also covers the
  // header's own links, which is the behaviour you want there too.
  useEffect(() => {
    setQuery('')
  }, [pathname])

  function ensureIndex() {
    if (requested.current) return
    requested.current = true

    loadIndex()
      .then(setIndex)
      .catch(() => {
        // A search that cannot load its index degrades to a field that finds
        // nothing, on a site where every page is still reachable by browsing.
        // Allow a retry on the next interaction rather than failing loudly.
        requested.current = false
      })
  }

  const groups = useMemo(() => groupResults(index, query), [index, query])

  return (
    <ComboBox
      aria-label="Search awkale.me"
      className="site-search"
      // The index is the filter (see 3 above).
      defaultFilter={() => true}
      // Without this the popover cannot open before anything matches, which is
      // where both the prompt and the no-matches message live.
      allowsEmptyCollection
      menuTrigger="focus"
      inputValue={query}
      onInputChange={(next) => {
        ensureIndex()
        setQuery(next)
      }}
    >
      <Input className="site-search-input" placeholder="Search" onFocus={ensureIndex} />

      <Popover className="site-search-popover" offset={6}>
        <ListBox
          aria-label="Search results"
          className="site-search-results"
          items={groups}
          renderEmptyState={() => (
            <div className="site-search-empty">
              {query.trim() === '' ? 'Search concerts, works, composers and projects' : 'No matches'}
            </div>
          )}
        >
          {(group) => (
            <ListBoxSection id={group.kind} className="site-search-group">
              <Header className="site-search-group-label">
                {group.label}
                {/* The TRUE match count, not the capped one, so a group showing six
                    of forty says forty. */}
                <span className="site-search-group-count tabular">{group.total}</span>
              </Header>

              <Collection items={group.entries}>
                {(entry) => (
                  /*
                    The id is NOT the path, though the path is what it links to.
                    app/lib/archive.ts points every project WITHOUT a body at
                    `/projects/`, since it has no page of its own — so all five
                    projects share one path the moment AWK-43 seeds them, and a
                    path-keyed collection silently renders one row instead of
                    five. Title and kind make it unique without inventing an id
                    the index does not carry.
                  */
                  <ListBoxItem
                    id={`${entry.kind}:${entry.title}:${entry.path}`}
                    href={entry.path}
                    textValue={entry.title}
                    className="site-search-result"
                  >
                    <span className="site-search-result-title">{entry.title}</span>
                    {entry.detail !== '' && <span className="site-search-result-detail">{entry.detail}</span>}
                  </ListBoxItem>
                )}
              </Collection>
            </ListBoxSection>
          )}
        </ListBox>
      </Popover>
    </ComboBox>
  )
}
