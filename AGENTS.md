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
| `docs/agents/facts.md` | 58 findings from the AWK-5 map, kept so they are not rediscovered. Findings, not spec — verify before trusting. |
| `docs/archive/participation-checklist.md` | What Alex played: 6 concerts missed, 4 items sat out, across 127. |
| `scripts/contentful/` | Archive pipeline: parser, importer, and `bso-graph.json`. |
| `Wikipedia BSO Archive.xlsx` | The raw source the parser reads. |
| `app/tokens.css` | Design values. A spec artifact, per ADR-0004's AWK-22 amendment. |
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

**There is a test suite too, as of ADR-0014**: 20 tests over three layers — the
built-output page assertion, the prerender enumerator's guards, and `/contact/`'s
form attributes. `test`, `lint` and `format:check` all pass. Two gaps that older
tickets still assume: there is **no CI** in this repo at all (no `.github/`), so
"joins the CI page assertion" means `scripts/assert-pages.test.ts` and nothing
automatic; and route components taking loader data are untestable as written,
because Vitest runs without the `reactRouter()` plugin.

`app/data/sample.ts` is still placeholder, because **none of the decided
Contentful schema exists in the space** — `concert.attended`, `concert.satOut`,
`composer.slug`, `composer.period`, `work.forms` / `period` and the `project` type
are all absent from `master`. That is the real blocker, not the toolchain.

> This section previously read *"There is no build… no dependencies installed, so
> the `.tsx` files do not typecheck yet"*, which had been false since the AWK-22
> scaffolding was wired up. Corrected 2026-08-03. It is the same stale-record
> failure [AWK-24](https://linear.app/awkale/issue/AWK-24/decide-whether-the-new-site-carries-analytics)
> hit from the other direction, and worth a glance whenever this file makes a
> claim about the toolchain: the repo moves faster than its index.
