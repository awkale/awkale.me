/**
 * The three profile links, and the single place their URLs live.
 *
 * Two surfaces render them — the site-wide footer and /contact/, which ADR-0011
 * gives "the form, plus the three profile links" — so the list is shared and the
 * markup is not. Each surface lays them out differently, but a changed handle must
 * never need finding twice. That is also why this sits in app/data/ rather than
 * being exported from the footer component: a route importing it should not pull a
 * component into its module graph to read three URLs.
 *
 * ADR-0011: GitHub, Threads and LinkedIn, in that order, as the 2016 Jekyll
 * footer's "Contact" block carried them. Note that only the GitHub handle is
 * corroborated anywhere in the repo (docs/agents/facts.md) — the other two were
 * supplied directly by Alex, since the old site is not in this repository.
 *
 * `hi@awkale.me` is deliberately NOT here and belongs on no page. The form exists
 * so the address is never scraped, and an address cannot be un-scraped.
 */
export const PROFILES = [
  { label: "GitHub", href: "https://github.com/awkale" },
  { label: "Threads", href: "https://www.threads.com/@awkale" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/awkale" },
] as const;
