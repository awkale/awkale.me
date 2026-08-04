import { Link } from "react-router";
import { PROFILES } from "../data/profiles";

/**
 * Site-wide, rendered from root.tsx's Layout so it lands on all ~600 pages.
 * Carries the three profile links (app/data/profiles.ts) and the only link to
 * /contact/ — ADR-0011.
 *
 * Internal links carry a TRAILING SLASH, as SiteHeader's do and for the same
 * reason — the build emits <path>/index.html and Netlify 301s the slash-free
 * form, so a slash-free <Link to> costs a redirect hop on fresh load.
 *
 * Tailwind for layout only (ADR-0004). Nothing here has internal state, so it
 * needs no component CSS file — contrast contact-form.css, which styles form
 * controls.
 */
export function SiteFooter() {
  return (
    <footer
      className="mt-[var(--space-section)] border-t border-border-subtle
                 px-[var(--gutter)] py-8"
    >
      <div className="mx-auto flex max-w-[var(--width-wide)] flex-wrap items-center gap-x-6 gap-y-3">
        <nav className="flex flex-wrap gap-4">
          {PROFILES.map((p) => (
            <a key={p.label} href={p.href} className="text-sm no-underline hover:underline">
              {p.label}
            </a>
          ))}
        </nav>

        <Link
          to="/contact/"
          className="text-sm text-muted-foreground no-underline hover:text-foreground"
        >
          Contact
        </Link>
      </div>
    </footer>
  );
}
