/**
 * /contact/sent/ — where the native POST lands. ADR-0011.
 *
 * This page exists because the submission is an ordinary browser POST rather than
 * a `fetch`, so the browser has to land somewhere. It is a real page in the site's
 * own typography rather than Netlify's generic confirmation: ending a conversion on
 * another company's branded page is the one moment that would be most jarring.
 *
 * It is prerendered like every other route, so it also answers a plain GET. That
 * is why it wants `X-Robots-Tag: noindex` — a real page with no inbound purpose.
 * Today the sitewide staging `noindex` in public/_headers covers it incidentally;
 * that block is marked REMOVE AT CUTOVER, and the per-path rule that must replace
 * it is AWK-44's edit, alongside the CSP. Do not delete the staging block without
 * adding the rule.
 *
 * The mailbox address stays off this page as it stays off every page — the form is
 * the reason `hi@awkale.me` is not scrapeable.
 *
 * Reachable only by submitting, so nothing links here: it is deliberately absent
 * from the header nav and the footer.
 *
 * Deliberately just a heading and a line of copy. ADR-0011 asks for "the success
 * page the native POST redirects to" in the site's own typography and no more —
 * the sitewide header and footer already carry every route out of here, so a
 * hand-written nav would be invented surface duplicating both.
 */
export default function ContactSent() {
  return (
    <main className="px-[var(--gutter)] py-[var(--space-section)]">
      <div className="mx-auto max-w-[var(--width-content)]">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Message sent</h1>
        <p className="mt-2 max-w-[52ch] text-sm text-muted-foreground">
          Thanks — that reached me. I read everything and reply to anything that wants a reply.
        </p>
      </div>
    </main>
  )
}
