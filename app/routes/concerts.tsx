import { useEffect, useRef, useState } from 'react'
import { Button, Dialog, DialogTrigger, Heading, Popover } from 'react-aria-components'
import { useSearchParams } from 'react-router'

import { ConcertsTable } from '../components/concerts-table'
import { FacetSelect } from '../components/facet-select'
import { loadArchive } from '../lib/archive'
import { filterConcerts, readFacet } from '../lib/facets'
import type { Route } from './+types/concerts'

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
 *
 * Every count here is COMPUTED from the published set rather than quoted. ADR-0006
 * replaced a fixed page count with a rule, and said so explicitly: the number moves
 * down as the checklist is filled in and up as pre-BSO programmes are added, so
 * anything needing it must derive it.
 */
export async function loader() {
  const { concerts, works, composers } = await loadArchive()

  const tally = (values: (string | null)[]) => {
    const counts = new Map<string, number>()
    for (const value of values) {
      if (value) counts.set(value, (counts.get(value) ?? 0) + 1)
    }
    return [...counts.entries()]
      .map(([name, n]) => ({ name, n }))
      .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
  }

  const conductors = tally(concerts.map((c) => c.conductor))
  const halls = tally(concerts.map((c) => c.hall))

  return {
    concerts,
    facets: { conductors, halls },
    counts: {
      concerts: concerts.length,
      works: works.length,
      composers: composers.length,
      conductors: conductors.length,
      halls: halls.length,
    },
  }
}

/**
 * The query string IS the selection. Nothing mirrors it into component state —
 * that duplication is what AWK-55 was filed about, in its original form: chips
 * that held React Aria's own uncontrolled selection while the table read the
 * unfiltered array, so the styling moved and nothing else did.
 */
const CONDUCTOR = 'conductor'
const HALL = 'hall'

export default function Concerts({ loaderData }: Route.ComponentProps) {
  const { concerts, facets, counts } = loaderData
  const [searchParams, setSearchParams] = useSearchParams()
  const conductorField = useRef<HTMLInputElement>(null)

  /*
    ADR-0004's landmine: with `ssr: false` the prerendered HTML is identical for
    every visitor, so ANYTHING derived from the query string differs between the
    server markup and the first client render. Not just the table — the clear
    control, the status line and the selected tags are all URL-derived, and each
    one would mismatch on a shared `?conductor=X` link.

    So the gate goes here, on the selection itself, rather than on any one of
    them: before mount the page renders exactly as it was prerendered, unfiltered
    and unselected. One tick later the URL takes over. ModeToggle starts at
    `null` and site-search starts with an empty index for the same reason.
  */
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])

  const selection = hydrated
    ? { conductors: readFacet(searchParams, CONDUCTOR), halls: readFacet(searchParams, HALL) }
    : { conductors: [], halls: [] }

  /*
    How many values are applied, across both facets — the number on the trigger's
    badge. It counts VALUES, not facets: two Conductors and a Hall reads 3, which
    is what someone deciding whether to open the popover wants to know.
  */
  const appliedCount = selection.conductors.length + selection.halls.length
  const isFiltered = appliedCount > 0

  /*
    FILTERING HAPPENS HERE, IN THE BROWSER, AND CANNOT MOVE INTO THE LOADER.
    With `ssr: false` and prerendering (ADR-0009) the loader above runs at BUILD
    time and its output is baked into a per-path `.data` file, so a query string
    cannot vary it. A loader-based attempt does not fail loudly; it ignores the
    filter. See app/lib/facets.ts, which holds the rule and the tests.

    Before mount `selection` is empty, so this returns every row and the table
    matches the markup it hydrates into. A shared filtered link therefore shows
    all rows for one frame. That cost was accepted deliberately — holding the
    table back would tax every visitor to serve that one case, and would cost the
    page its correct no-JavaScript reading. What is NOT acceptable is paying it
    through a hydration error: filtering during the first client render made
    React 19 discard the server markup and log #418 on a page that otherwise
    logs nothing at all.
  */
  const visible = filterConcerts(concerts, selection)

  /*
    REPLACE, never push: Back should leave `/concerts/` rather than unwind a
    selection one value at a time, and the clear control is the intended undo.

    `preventScrollReset` because every one of these is a navigation, and
    `<ScrollRestoration />` in app/root.tsx would otherwise send the reader to
    the top of the page each time they touched a filter — mid-interaction, while
    the popover they are working down is still open.
  */
  const NAVIGATE = { replace: true, preventScrollReset: true }

  function setFacet(key: string, values: string[]) {
    const next = new URLSearchParams(searchParams)
    next.delete(key)
    for (const value of values) next.append(key, value)

    setSearchParams(next, NAVIGATE)
  }

  function clearFacets() {
    const next = new URLSearchParams(searchParams)
    next.delete(CONDUCTOR)
    next.delete(HALL)
    setSearchParams(next, NAVIGATE)

    /*
      The button unmounts the moment this lands, taking the focused element with
      it and dropping focus to <body> — a keyboard reader would have to tab in
      from the top of the document again. Hand focus to the first facet instead,
      which is both a real target and where someone who just cleared is likely
      to go next.

      Not solved by keeping the control mounted-but-disabled: the clear control
      is absent until there is something to clear, and a permanently visible
      disabled button says the opposite.
    */
    conductorField.current?.focus()
  }

  return (
    <main className="px-[var(--gutter)] py-[var(--space-section)]">
      <div className="mx-auto max-w-[var(--width-wide)]">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Performance history</h1>

        {/* Career totals, and they do NOT respond to the filter. `121 concerts ·
            322 works · …` is a fact about the Performance history, not a
            description of what is on screen; the status line below is what
            describes the view. */}
        <p className="mt-2 text-sm text-muted-foreground">
          <span className="tabular">{counts.concerts}</span> concerts · <span className="tabular">{counts.works}</span>{' '}
          works · <span className="tabular">{counts.composers}</span> composers ·{' '}
          <span className="tabular">{counts.conductors}</span> conductors ·{' '}
          <span className="tabular">{counts.halls}</span> halls
        </p>

        {/*
          Both browse filters live behind ONE control, after the shape of React
          Aria's own filterable-table example: a single trigger carrying a count
          of what is applied, a popover holding every filter, and a clear control
          inside it. Two facets do not need a whole row of the page, and the set
          is fixed at two (ADR-0006) only until it isn't — this shape absorbs a
          third without redesigning the header.

          The cost, and it is a real one: with the popover shut the reader sees
          HOW MANY filters are applied but not WHICH. The count and the status
          line below carry it; the names are one click away. Inline chips showed
          them at all times, which is what this trades for a quiet page.
        */}
        <div className="facet-bar">
          <DialogTrigger>
            <Button
              className="facet-filters-trigger"
              // The badge is a visual count; the label has to say it too, or a
              // screen reader hears "Filters" whether two are applied or none.
              aria-label={isFiltered ? `Filters, ${appliedCount} applied` : 'Filters'}
            >
              Filters
              {isFiltered && <span className="facet-filters-badge tabular">{appliedCount}</span>}
            </Button>

            <Popover className="facet-filters-popover" offset={6}>
              <Dialog className="facet-filters-dialog" aria-label="Filters">
                <div className="facet-filters-head">
                  <Heading slot="title" className="facet-filters-title">
                    Filters
                  </Heading>

                  {isFiltered && (
                    <Button className="facet-clear" onPress={clearFacets}>
                      Clear
                    </Button>
                  )}
                </div>

                <FacetSelect
                  label="Conductor"
                  plural="conductors"
                  inputRef={conductorField}
                  items={facets.conductors}
                  selected={selection.conductors}
                  onChange={(next) => setFacet(CONDUCTOR, next)}
                />
                <FacetSelect
                  label="Hall"
                  plural="halls"
                  items={facets.halls}
                  selected={selection.halls}
                  onChange={(next) => setFacet(HALL, next)}
                />
              </Dialog>
            </Popover>
          </DialogTrigger>

          {/*
            OUTSIDE the popover, and permanently mounted with empty text when
            nothing is selected. A live region that mounts on demand does not
            announce reliably — assistive technology has to be observing the node
            before its contents change. One inside the popover would be worse
            still: it would not exist at all until the reader opened it.
            This is the repo's first live region.
          */}
          <p className="facet-status" role="status">
            {isFiltered ? `Showing ${visible.length} of ${counts.concerts} concerts` : ''}
          </p>
        </div>

        <ConcertsTable concerts={visible} />
      </div>
    </main>
  )
}
