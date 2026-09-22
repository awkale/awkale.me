import type { ReactNode } from 'react'
import { Button, Dialog, DialogTrigger, Heading, Popover } from 'react-aria-components'

/**
 * The one control on an archive page that opens onto everything about the view:
 * on /concerts/ the two browse facets AND the column set, on a composer page the
 * column set alone.
 *
 * IT WAS `Filters`, INSIDE app/routes/concerts.tsx, UNTIL AWK-67. Two things moved
 * it here. It stopped being only about filters, so the word on the face had to
 * widen to `View`; and a composer page needed the same chrome — its first
 * interactive control of any kind — which made a shell duplicated across two
 * routes the alternative. `View` reads the same on both even though the composer
 * page's popover holds one section, which is the trade: one word for the section
 * rather than a label that changes with the contents.
 *
 * THE BADGE COUNTS APPLIED FILTER VALUES AND NOTHING ELSE. Hidden columns are
 * reported in the accessible label instead, and the reason is the narrow default:
 * below 40rem app/lib/columns.ts hides columns on its own, so a badge counting
 * them would light up on every phone load and report the page's ordinary state as
 * an applied one. A count of facet VALUES and a count of hidden COLUMNS are also
 * not the same unit and cannot be summed into one number. So the two readings
 * divide the work rather than contradicting each other: the badge is what is
 * applied, the label says the rest.
 *
 * `Heading slot="title"` is what names the dialog; the `aria-label` on it is
 * belt and braces for the same string.
 */
export function ViewMenu({
  /** Values applied across the facets, or `null` on a page with no facets. */
  applied,
  /** `describeColumns`'s sentence, or '' when every column is on screen. */
  columnsNote,
  /**
   * Rendered beside the title — /concerts/ puts its Clear control here, and it
   * stays the route's because clearing has to hand focus somewhere the route
   * owns. A composer page passes nothing.
   */
  headAction,
  children,
}: {
  applied: number | null
  columnsNote: string
  headAction?: ReactNode
  children: ReactNode
}) {
  const isFiltered = applied !== null && applied > 0

  /*
    Both clauses, either of which may be absent: "View" / "View, 2 filters
    applied" / "View, 3 columns hidden" / "View, 2 filters applied, 3 columns
    hidden". The badge is a visual count of the first clause only, so the label
    has to say it too — a screen reader would otherwise hear "View" whether two
    filters are applied or none.
  */
  const label = ['View', isFiltered ? `${applied} ${applied === 1 ? 'filter' : 'filters'} applied` : '', columnsNote]
    .filter((clause) => clause !== '')
    .join(', ')

  return (
    <DialogTrigger>
      <Button className="view-menu-trigger" aria-label={label}>
        View
        {isFiltered && <span className="view-menu-badge tabular">{applied}</span>}
      </Button>

      <Popover className="view-menu-popover" offset={6}>
        <Dialog className="view-menu-dialog" aria-label="View">
          <div className="view-menu-head">
            <Heading slot="title" className="view-menu-title">
              View
            </Heading>

            {headAction}
          </div>

          {children}
        </Dialog>
      </Popover>
    </DialogTrigger>
  )
}
