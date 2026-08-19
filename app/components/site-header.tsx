import { Link } from 'react-router'

import { ModeToggle } from './mode-toggle'
import { SiteSearch } from './site-search'

/**
 * Internal links carry a TRAILING SLASH deliberately. AWK-17: the build emits
 * <path>/index.html throughout and Netlify 301s the slash-free form, so every
 * slash-free <Link to> costs a needless redirect hop on fresh load across ~590
 * pages. Cheap to get right now, tedious later.
 *
 * (The prerender path list is the opposite — slash-free there is a hard build
 * failure the other way. Two layers, both correct; only the enumerator cares.)
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center gap-6 border-b border-border-subtle bg-background/90 px-[var(--gutter)] py-4 backdrop-blur">
      <Link to="/" className="font-display text-base font-semibold tracking-tight text-foreground no-underline">
        awkale.me
      </Link>

      <nav className="mr-auto flex flex-wrap gap-4">
        <Link to="/projects/" className="text-sm text-muted-foreground no-underline hover:text-foreground">
          Projects
        </Link>
        <Link to="/concerts/" className="text-sm text-muted-foreground no-underline hover:text-foreground">
          Performance history
        </Link>
        <Link to="/concerts/composers/" className="text-sm text-muted-foreground no-underline hover:text-foreground">
          Composers
        </Link>
      </nav>

      {/* ADR-0011: site-wide, in the header of every page — including Projects,
          because a search that cannot find a case study is a site-wide search
          that quietly isn't one. It loads its index on first interaction. */}
      <SiteSearch />

      <ModeToggle />
    </header>
  )
}
