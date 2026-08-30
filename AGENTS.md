# AGENTS.md

Instructions for coding agents working in this repository.

Moved here from `awkale/awkale.github.io` on 2026-08-03, along with the spec it
points at. That repo is retired per [ADR-0002](docs/adr/0002-hosting-and-deploy-pipeline.md);
this one replaces it.

## Agent skills

### Issue tracker

Issues live in **Linear** — workspace `awkale`, team **AWKALE** (key `AWK`) —
reached via the `linear-server` MCP. Not GitHub Issues.
See `docs/agents/issue-tracker.md`.

Note that doc was written while the tracker governed the *old* repo. The team,
the `AWK-<n>` identifiers, the label conventions and the wayfinding operations
are all unchanged — only the repository moved.

### Triage labels

The five canonical roles, used verbatim (`needs-triage`, `needs-info`,
`ready-for-agent`, `ready-for-human`, `wontfix`) as a mutually-exclusive Linear
label group. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — `CONTEXT.md` + `docs/adr/` at the repo root.
See `docs/agents/domain.md`.

## What is where

| Path | Holds |
| --- | --- |
| `CONTEXT.md` | The ubiquitous language. Read before naming anything. |
| `docs/adr/` | Fourteen accepted records. The spec. |
| `docs/research/` | Research output backing a decision — currently ADR-0009's rendering-layer comparison. |
| `docs/agents/facts.md` | 62 findings — the AWK-5 map's 58 plus later additions, which carry an `Added by` line. Findings, not spec — verify before trusting. The file's own header still says fifty-nine; count with `grep -c '^\* '` rather than trusting either number. |
| `docs/archive/participation-checklist.md` | What Alex played: 6 concerts missed, 4 items sat out, across 127. **Seeded into Contentful under AWK-36** — tick the boxes here and regenerate, never hand-edit the plan. |
| `scripts/contentful/participation.json` | The seeding plan derived from that checklist. Generated, guarded by `participation.test.ts`. Keys on **date**; `graphId` is a join key, not an address. |
| `.env.example` | The three build variables, with the token blank. Committed on purpose — `.gitignore` carries a `!.env.example` exception — because the NAMES are what has to be right, and a wrong one renders an empty site rather than erroring. |
| `app/lib/contentful.ts` | The CDA client. No SDK: `fetch`, pagination, retry. Asserts the three env vars before fetching anything. |
| `app/lib/archive.ts` | **The one build-time sweep.** Three consumers — `prerenderPaths`, `buildEnd`'s search index, and every route loader — all read `loadArchive()`, which fetches once and memoizes. A second enumeration is the thing this exists to prevent. |
| `app/lib/invariants.ts` | The **eight** checks Contentful cannot express as validations. See ADR-0008's amendment on the hashed-slug shape. The eighth is AWK-23's `arranger-needs-a-type`, which ADR-0005 called for before the data existed. |
| `app/lib/search.ts` | AWK-41's ranking, grouping and per-kind cap. Pure and DOM-free **on purpose** — React Aria's own collection filter is switched off so these rules are the only ones running, and can be tested without a popover. Folds diacritics, so `dvorak` reaches `Dvořák`. |
| `app/lib/images.ts` | **The only place a `/.netlify/images` URL is built** (ADR-0013, AWK-40), and the only place the eager/lazy tier is decided. `/.netlify/images` is Netlify-only, so this module is where the site's imagery couples to ADR-0002's host. It throws on a source outside the allowlist, because the alternative is a 400 nothing reports. |
| `app/components/asset-image.tsx` | The site's ONE `<img>`, plus `imageGroup`'s three layouts. `sideBySide` lays out **N** images even though the sixth invariant fails a build where it links anything but two. |
| `app/lib/search-index.ts` | Loads `/search-index.js` by dynamic import, memoized on the promise, on first interaction with the header field. An import rather than a `fetch` is a **CSP decision** — see `public/_headers`. |
| `app/components/site-search.tsx` | The header ComboBox. Results are `<a href>`, which is why `onSelectionChange` is unused: React Aria fires it with **null** for link rows. |
| `scripts/contentful/` | Archive pipeline: parser, importer, `archive_orphans.py` (AWK-20's orphan sweep), `seed_participation.py` (AWK-36's participation pass — **dry run is its default**, unlike its siblings), `backfill_slugs.py` (AWK-39's slug pass — dry run also its default; it does the two **honorific** merges), `merge_composers.py` + `merge-composers.json` (AWK-23's arranger merge — **ran 2026-08-19**; dry run is its default and `--apply` also publishes, because a relink left as a draft while the delete lands leaves the CDA serving works whose composer no longer exists), `backfill_seasons.py` + `season-orchestras.json` (AWK-59's season pass — dry run is its default; it rewrites the season **displayField**, and preserves each entry's publication state rather than choosing one), and `bso-graph.json`. Also **three** schema declarations across **two** appliers: `archive-schema.json` + `migrate_schema.py` (AWK-30, appends fields to four archive types — five since AWK-59 added `season.orchestras`), and `portfolio-schema.json` (AWK-31, creates `project` and `imageGroup`) plus `recording-schema.json` (AWK-32, creates `recording`), both applied by `migrate_portfolio.py` — the second via `--schema PATH`. |
| `docs/archive/recording-curation.md` | Per-video verdicts for the BSO channel (AWK-32). Three of fifteen uploads are seedable. ADR-0012 forbids scripting this; the file is a worksheet, not an input. |
| `docs/archive/program-19930726-liyo-dallas-brooks-hall.jpg` | Photographed printed program, Long Island Youth Orchestra at Dallas Brooks Hall, Melbourne, 1993-07-26. **A primary source for a concert no other source here holds** — not in the xlsx, not in `bso-graph.json`. **Transcribed 2026-08-30** under AWK-59 — the concert is `cnc-19930726`, and the source stays as the record of what the page came from. 57 entries: Dallas Brooks Hall, five choir `ensemble`s, the five choir/guest conductors, 12 composers, Willis Huang, 15 works, 17 program items and the Concert. Ten items are the visiting choirs' blocks and carry `satOut`, so the page renders the seven LIYO played. **This is the first published LIYO concert**, and it needed AWK-60's `programItem.conductor` — six conductors across six blocks do not fit one `concert.conductor`. |
| `public/_redirects` | The thirteen redirects. Never add a catch-all — see the file's own header. |
| `netlify.toml`'s `[images]` | ADR-0013's allowlist, in a TOML **literal** string. Double quotes eat the `\.` escapes; `scripts/netlify-images.test.ts` runs the committed pattern against a URL the helper builds so neither can drift. |
| `scripts/curl-sweep.sh` | Post-cutover redirect sweep. ADR-0010's mitigation for having no request log. |
| `Wikipedia BSO Archive.xlsx` | The raw source the parser reads. |
| `app/tokens.css` | Design values. A spec artifact, per ADR-0004's AWK-22 amendment. |
| `docs/design/favicon.ai` | The 2015 favicon source, moved in under AWK-50. Both `public/favicon.ico` and `public/icon.svg` are **generated from it** — regenerate, never hand-edit. The artwork is live text in Clarendon LT Std, subset to `/A` and `/K`. |
| `.githooks/pre-commit` | Blocks a commit that is unformatted or fails lint. See ADR-0014. |

## Commands

`bun`, never `npm` or `yarn`. ADR-0014 covers the toolchain.

**`@react-aria/optimize-locales-plugin` is pinned to `en-US` in `vite.config.ts`,
and it is not optional tidying.** React Aria imports all 34 languages' strings
statically, so tree-shaking cannot drop them; without the plugin every page carries
~5.4 KB gzipped of languages this site never serves. Adding a language to the site
means adding it to that list too, or its screen-reader announcements stay English.
Note React Aria's React Router guide describes the **SSR** setup for this, which
does not apply to a site with no requests — the client-only Vite variant is ours.

| | |
| --- | --- |
| `bun run dev` | Dev server. |
| `bun run build` | Prerenders every route into `build/client`. |
| `bun run typecheck` | `react-router typegen && tsc`. Run this before believing an editor error. |
| `bun run test` | Vitest. Skips the built-output block if `build/client` is absent. |
| `bun run test:ci` | Builds first, so the built-output assertion cannot skip. |
| `bun run lint` / `lint:fix` | oxlint, 210 rules copied from `waterfall-ui`. |
| `bun run format` / `format:check` | oxfmt. **Markdown is excluded** — see ADR-0014. |

`scripts/curl-sweep.sh [host]` is not a `bun` script and is **not run at build
time**: it curls a live host, defaults to `awkale.me`, and only makes sense after
the apex cutover (AWK-46). Against the old site every redirect fails, correctly.

**A commit runs `format:check` and `lint` and fails on either.** The hook is
installed by `bun install` (the `prepare` script sets `core.hooksPath`), so it
arrives with the clone. It checks and never fixes; `--no-verify` skips it.

## Four things that will bite

**The pipeline's paths are positional.** `parse_archive.py` defaults to
`"Wikipedia BSO Archive.xlsx"` **relative to the working directory**, and writes
`bso-graph.json` beside itself. So run it from the repo root:

```bash
python3 scripts/contentful/parse_archive.py    # needs openpyxl
```

Moving the xlsx off the root, or running from inside `scripts/contentful/`,
silently breaks the default. Nothing else in either script reaches outside the
repo.

**`bso-graph.json` is parser output, not Contentful state.** As of the last audit
the two agree on every count except `hall` — the graph has 12, Contentful has 13.
Read [ADR-0006](docs/adr/0006-performance-history-content-model.md) and the open
Linear issues before trusting either source about concert programmes.

> This previously read *"live Contentful still disagrees with both the graph and
> the checklist on 8 concerts, because the `shares` fix is applied to the parser
> but the re-import has not run"*. **AWK-20 ran it on 2026-08-14** — the four
> merged pairs now carry identical programs on both dates (lengths 3, 6, 6, 2),
> and `2007-12-16` got its conductor and orchestra by hand. The graph and live
> `concert.program` agree.

**Counting entries through the CMA includes archived ones, and that will mislead
you.** AWK-20 archived 16 superseded `programItem`s rather than deleting them, so
`/entries?content_type=programItem` reports **823** while the live archive holds
**807**. The Delivery API hides them, so only the management side sees the gap.
Pass `sys.archivedAt[exists]=false` to get the real number — that filter is why
`archive_orphans.py` is idempotent instead of re-reporting its own past work
forever.

The audited total of **2,384** is the eleven *archive* types only. The space now
answers **2,387**, because AWK-32's three `recording` entries postdate that
figure. Neither number is wrong; they count different sets.

**A fresh clone shows seven route files erroring, and it is not a real failure.**
Every route imports `./+types/<name>`, which React Router *generates* into
`.react-router/types/` — gitignored, as its own convention intends. Until typegen
runs, an editor's TypeScript server reports `Cannot find module './+types/…'`
across all of `app/routes/`, plus a cascade of implicit-`any` errors on the loader
data those types would have described. Nothing is wrong with the code:

```bash
bun run typecheck    # react-router typegen && tsc
```

`bun run dev` and `bun run build` regenerate them too. Report these as a real
break only if they survive that command.

**`oxfmt` is not idempotent in one pass.** `app/components/site-header.tsx` and
`site-footer.tsx` — the two files with multi-line `className` strings — need a
second run to converge, because the first pass collapses the string and the second
sorts and rewraps it. So `bun run format` reporting nothing to do is not proof it
is settled: if `format:check` still fails, run `format` again before assuming a bug.
It is also why the pre-commit hook checks rather than fixes (ADR-0014).

## Build state

**There is a build, and it is clean.** Dependencies are installed, `bun run build`
and `bun run typecheck` both pass, and the repo carries `package.json`,
`bun.lock`, `netlify.toml`, `react-router.config.ts`, `vite.config.ts` and
self-hosted fonts. It is not yet connected to Netlify.

**There is a test suite too, as of ADR-0014**: **191 tests across twelve files** —
the built-output page assertion, the prerender enumerator's guards, `/contact/`'s
form attributes, `public/_redirects`, the three schema declarations, AWK-36's
participation plan, and AWK-39's four new files (the seven invariants, the env
assertion, the sweep's participation rules, and the RichText renderer).
`test`, `lint` and `format:check` all pass.

> This previously read *"31 tests across four files"*, then *"118 across eight"*.
> Both were true when written and went stale within a ticket or two. Corrected
> 2026-08-15 under AWK-39, which contributed 73. **Count with `bun run test`
> rather than trusting this number either** — that instruction is the durable part
> of this paragraph.
>
> It went stale again immediately, as predicted: the suite answered **196** by the
> time AWK-41 opened, not the 191 above. It is **224 across fifteen files** as of
> 2026-08-19 — AWK-41 added the search ranker's 14, the header field's 10 and the
> index loader's 4. Which is to say: count it, do not read it.
>
> Counted again the same day, after AWK-23: **321 across twenty files**, of which
> that ticket contributed 31 — 13 in `format.test.ts`, 14 in
> `merge-composers.test.ts` and 4 in `invariants.test.ts`. The gap between 224 and
> the 290 that preceded those is work this paragraph never recorded, which is the
> point it keeps making about itself.
>
> It was written as "304 across nineteen" and was wrong within the same ticket,
> because it was typed before the last two test files existed. Caught in review.
> **Run the command.**

**Archive search ships, and its index is a JS module.** AWK-41 landed the client
half on 2026-08-18. `buildEnd` now writes `build/client/search-index.js` — an ES
module, `export default [...]`, **not** the `.json` the earlier comments here
promised, because `import()` of a `.json` URL needs import attributes and ADR-0011
chose an import over a `fetch` precisely to stay inside `script-src`. The last
build emitted **603 entries** (87.5 KB raw / 14.4 KB gzipped), fetched only when
someone touches the field.

> **`bun run dev` serves that index from a dev-only Vite plugin**, not from disk —
> the built file lives in `build/client`, which the dev server does not serve, so
> before that plugin existed the header search 404'd its index and silently found
> nothing in dev while working in production. Same `loadArchive()` behind both, so
> they cannot disagree. `apply: 'serve'` keeps it out of the build.
>
> Two traps for whoever edits this next. **Results are anchors**, so React Aria
> fires `onSelectionChange` with `null` and routing must come from the
> `RouterProvider` in `app/root.tsx` — delete that and every result still works, as
> a full page load, which nothing tests and nobody notices. And **React Aria's own
> collection filter is off** (`defaultFilter={() => true}`); turning it back on
> re-drops the diacritic matches `app/lib/search.ts` exists to keep.

Two gaps that older tickets still assume: there is **no CI** in this repo at all (no `.github/`), so
"joins the CI page assertion" means `scripts/assert-pages.test.ts` and nothing
automatic; and route components taking loader data are untestable as written,
because Vitest runs without the `reactRouter()` plugin.

`app/data/sample.ts` is still placeholder, because **none of the decided
Contentful schema exists in the space** — `concert.attended`, `concert.satOut`,
`composer.slug`, `composer.period`, `work.forms` / `period` and the `project` type
are all absent from `master`. That is the real blocker, not the toolchain.

> **`app/data/sample.ts` is DELETED.** AWK-39 pointed the build at the Delivery
> API on 2026-08-15: `bun run build` sweeps Contentful once, enumerates **609
> paths** (6 static · 121 concerts · 322 works · 160 composers · 0 projects, from
> 370 qualifying pairs) and emits `build/client/search-index.json` from the same
> sweep. **The build now requires the three environment variables** — see
> `.env.example`. Its display helpers moved to `app/lib/format.ts`.
>
> **The sweep costs ~0.3 s cold and ~30 ms warm** against a ~7 s local build and
> Netlify's 900 s limit, so it is not a term worth optimising. It was the last
> unmeasured item in the build budget.
>
> One route is deliberately inert: **`app/routes/project.tsx` has no `loader`**,
> because with `ssr: false` React Router permits one only on a route matched by a
> prerender path, and `/projects/:slug` matches none while `project` holds zero
> entries. Exporting one is a hard build failure, not a warning. The route's own
> comment says exactly what AWK-43 must restore.

> **All of that schema now exists.** AWK-30 applied the ten fields ADRs 0005–0008
> decided, AWK-31 created ADR-0003's two portfolio types, and AWK-32 created
> ADR-0012's `recording`, all on 2026-08-14, and every affected content type is
> activated. The space holds **14 content types**, up from 11. There are two
> appliers over three declarations — `migrate_schema.py` reads
> `archive-schema.json`; `migrate_portfolio.py` reads `portfolio-schema.json` by
> default and `recording-schema.json` via `--schema PATH` — and each takes
> `--dry-run`, which is how to check the space rather than trusting this
> paragraph.
>
> **`recording` is the fourteenth type, and two accepted records call it the
> twelfth.** ADR-0012 said "twelfth" and AWK-31 claimed twelve and thirteen for
> `project`/`imageGroup`; both were written against an 11-type space. ADR-0012 is
> corrected. Do not trust an ordinal in this repo — count with `--dry-run`.
>
> Three AWK-31 details that are easy to get wrong from the ticket alone: `project`
> has **14 fields, not the 13 the ticket claims** (ADR-0003's table has fourteen
> rows and the ticket says to copy the record); `technologies`' allowed list was
> **never specified in any record**, so its eleven values were derived under
> AWK-31 and do not yet cover Agent A or Cision; and `body` permits
> `entry-hyperlink` to **any** entry type, because ADR-0003 restricts embedded
> *blocks* and a hyperlink is not one.

**Schema is not data.** Every field AWK-30 added is empty — it wrote no entry
data — and no CDA token is configured here, so `app/data/sample.ts` is still what
the routes read. A field that exists and is empty looks exactly like a field that
does not exist, to anything reading the Delivery API. Seeding is AWK-36 and
AWK-37; wiring the CDA is AWK-39.

> **Participation is now seeded.** AWK-36 ran on 2026-08-15: `concert.attended` on
> all 127 in-scope concerts (121 `true`, 6 `false`) and `satOut` on the 4 that sat
> a work out, all published. The space answers 121 / 6 / 122 unset, and that 122 is
> the 119 pre-tenure concerts plus the 3 undated ones. So the page set ADR-0006
> predicts — **121 concerts, 322 works, 147 composers = 590 routed pages** — is
> real data now, not a projection, and it is the second thing AWK-39 can read
> through the CDA after the three recordings.
>
> `app/data/sample.ts` is still what the routes read regardless: seeding filled
> the space, not the build. **AWK-37 is still outstanding** — `work.forms` and
> `period`, `composer.period` and the `genre` migration are all still empty.

The one exception is `recording`, which holds **three published entries** —
AWK-32's curated BSO videos, all on `cnc-20221218`. They are the only real
content in the space outside the imported archive, so they are the first thing
AWK-39 can read through the CDA to prove the wiring end to end, and the only
data the sixth invariant (`programItem ∈ concert.program`) can be asserted
against. `project` and `imageGroup` are still empty (AWK-43).

**Two fields deliberately did not change, and both are traps.** `work.genre` is
still there — it goes only after AWK-37 migrates it into `forms`. `work.slug`
still carries `unique: true` — it comes off only after AWK-39's `(composer, slug)`
assertion exists, which ADR-0008 requires in that order. `migrate_schema.py`
keeps the second behind `--drop-work-slug-unique`, and that flag is **not** a
gate the script can enforce: it cannot see whether AWK-39 landed.

> **`unique: true` is off `work.slug` as of 2026-08-15.** AWK-39 landed the
> assertion first, per ADR-0008's ordering, then ran the gated flag. So
> `app/lib/invariants.ts` is now the ONLY thing standing between the space and 26
> space-wide colliding work slugs — the constraint will not catch them any more,
> and it is a one-way door. `work.genre` is unchanged and still AWK-37's.

> This section previously read *"There is no build… no dependencies installed, so
> the `.tsx` files do not typecheck yet"*, which had been false since the AWK-22
> scaffolding was wired up. Corrected 2026-08-03. It is the same stale-record
> failure [AWK-24](https://linear.app/awkale/issue/AWK-24/decide-whether-the-new-site-carries-analytics)
> hit from the other direction, and worth a glance whenever this file makes a
> claim about the toolchain: the repo moves faster than its index.
