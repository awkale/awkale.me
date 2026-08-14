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
| `docs/archive/participation-checklist.md` | What Alex played: 6 concerts missed, 4 items sat out, across 127. |
| `scripts/contentful/` | Archive pipeline: parser, importer, and `bso-graph.json`. Also **three** schema declarations across **two** appliers: `archive-schema.json` + `migrate_schema.py` (AWK-30, appends fields to four archive types), and `portfolio-schema.json` (AWK-31, creates `project` and `imageGroup`) plus `recording-schema.json` (AWK-32, creates `recording`), both applied by `migrate_portfolio.py` — the second via `--schema PATH`. |
| `docs/archive/recording-curation.md` | Per-video verdicts for the BSO channel (AWK-32). Three of fifteen uploads are seedable. ADR-0012 forbids scripting this; the file is a worksheet, not an input. |
| `public/_redirects` | The thirteen redirects. Never add a catch-all — see the file's own header. |
| `scripts/curl-sweep.sh` | Post-cutover redirect sweep. ADR-0010's mitigation for having no request log. |
| `Wikipedia BSO Archive.xlsx` | The raw source the parser reads. |
| `app/tokens.css` | Design values. A spec artifact, per ADR-0004's AWK-22 amendment. |
| `docs/design/favicon.ai` | The 2015 favicon source, moved in under AWK-50. Both `public/favicon.ico` and `public/icon.svg` are **generated from it** — regenerate, never hand-edit. The artwork is live text in Clarendon LT Std, subset to `/A` and `/K`. |
| `.githooks/pre-commit` | Blocks a commit that is unformatted or fails lint. See ADR-0014. |

## Commands

`bun`, never `npm` or `yarn`. ADR-0014 covers the toolchain.

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
And live Contentful still disagrees with both the graph and the checklist on 8
concerts, because the `shares` fix is applied to the parser but the re-import has
not run. Read [ADR-0006](docs/adr/0006-performance-history-content-model.md) and
the open Linear issues before trusting either source about concert programmes.

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

**There is a test suite too, as of ADR-0014**: 31 tests across four files — the
built-output page assertion, the prerender enumerator's guards, `/contact/`'s form
attributes, and `public/_redirects`. `test`, `lint` and `format:check` all pass. Two gaps that older
tickets still assume: there is **no CI** in this repo at all (no `.github/`), so
"joins the CI page assertion" means `scripts/assert-pages.test.ts` and nothing
automatic; and route components taking loader data are untestable as written,
because Vitest runs without the `reactRouter()` plugin.

`app/data/sample.ts` is still placeholder, because **none of the decided
Contentful schema exists in the space** — `concert.attended`, `concert.satOut`,
`composer.slug`, `composer.period`, `work.forms` / `period` and the `project` type
are all absent from `master`. That is the real blocker, not the toolchain.

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

The one exception is `recording`, which holds **three entries as drafts** —
AWK-32's curated BSO videos, all on `cnc-20221218`. Drafts, so the Delivery API
would not serve them even once a token exists; publishing is a deliberate
separate act. `project` and `imageGroup` are still empty (AWK-43).

**Two fields deliberately did not change, and both are traps.** `work.genre` is
still there — it goes only after AWK-37 migrates it into `forms`. `work.slug`
still carries `unique: true` — it comes off only after AWK-39's `(composer, slug)`
assertion exists, which ADR-0008 requires in that order. `migrate_schema.py`
keeps the second behind `--drop-work-slug-unique`, and that flag is **not** a
gate the script can enforce: it cannot see whether AWK-39 landed.

> This section previously read *"There is no build… no dependencies installed, so
> the `.tsx` files do not typecheck yet"*, which had been false since the AWK-22
> scaffolding was wired up. Corrected 2026-08-03. It is the same stale-record
> failure [AWK-24](https://linear.app/awkale/issue/AWK-24/decide-whether-the-new-site-carries-analytics)
> hit from the other direction, and worth a glance whenever this file makes a
> claim about the toolchain: the repo moves faster than its index.
