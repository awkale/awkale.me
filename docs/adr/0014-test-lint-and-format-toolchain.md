---
status: accepted
---

# Tests, lint and format: Vitest and the ox toolchain, borrowed whole

`awkale.me` runs **Vitest** with **happy-dom** for tests, **oxlint** for linting and
**oxfmt** for formatting. The lint ruleset and the formatting style are **copied from
`waterfall-ui`** rather than chosen here, and a **pre-commit hook** blocks any commit
that is unformatted or fails lint.

Not decided by a ticket of its own. It came out of
[AWK-35](https://linear.app/awkale/issue/AWK-35/build-the-contact-surface), which had
to verify its own output by hand because the repo had no runner at all, and then out
of a direct instruction to add the ox tools with waterfall-ui's settings.

## Why borrow instead of decide

The ruleset is 210 rules. Choosing them here would mean re-deriving, badly and alone,
something four repos already run: `waterfall-ui`, `waterfall-website`, `website` and
`explorer/frontend` all carry the same `.oxlintrc.json` and `.oxfmtrc.json`. Alex
moves between those and this one, so **shared muscle memory is worth more than a
locally optimal config** — and a config nobody tunes is a config nobody argues with.

That is also why the *formatting style* was taken verbatim — `semi: false`,
`singleQuote: true`, `printWidth: 120` — despite this repo having been written the
other way. It cost one whole-repo sweep, once.

## Five adaptations, each forced

Copying verbatim was not possible. Each of these is a rule or path that does not
transfer, not a preference:

- **`react/react-in-jsx-scope` is off.** waterfall-ui requires React in scope; this
  repo uses the automatic JSX runtime (`tsconfig` `jsx: react-jsx`) and imports React
  nowhere. As copied, the rule errored on **every** `.tsx` file.
- **`env.jest` becomes `env.vitest`**, with `vitest` added to `plugins`.
- **`@typescript-eslint/explicit-function-return-type` is dropped.** Nothing here
  annotates return types, so it warned on essentially every function. A wall of
  warnings teaches people to ignore warnings.
- **`sortTailwindcss.stylesheet` points at `app/app.css`** and its `functions` list is
  `["cn"]`. waterfall-ui's `./src/styles/tailwind.css` does not exist here, and
  `tv`/`cva`/`tw` are not this repo's helpers — `app/lib/utils.ts` exports `cn`.
- **`ignorePatterns` point at `build/` and `.react-router/`** (both generated) and
  `preview/`, a hand-maintained specimen page.

Two findings were suppressed rather than ruled away, because both flag legitimate
code. `netlify-honeypot` is allowlisted on `react/no-unknown-property` **in config**,
since it is a Netlify platform attribute the form scanner reads
([ADR-0011](0011-input-surface.md)) and the repo should say once that it is real.
`react/no-danger` is suppressed **inline in `root.tsx`**, where the blocking theme
script is [ADR-0004](0004-design-system-and-tokens.md)'s load-bearing inline script —
local, so the next `dangerouslySetInnerHTML` still gets questioned.

## Markdown is excluded from oxfmt, and this is the sharpest thing here

**oxfmt rewrites the code inside a fenced block, not just the prose around it.** In
this very directory it turned ADR-0011's

```
<form name="contact" method="POST" action="/contact/sent/"
      data-netlify="true" netlify-honeypot="bot-field">
```

into the same tag with an invented `</form>`, closing a snippet that deliberately
shows only the opening tag and its attributes because the fields are described in
prose beneath it.

`docs/adr/` **is the spec this project builds from.** A formatter that can silently
correct a partial or deliberately-wrong example is editing the requirements — and the
next one might be an example that is wrong *on purpose*, illustrating the thing a
record forbids. Prose rewrapping is a second, smaller reason: fourteen records with
hand-set line breaks would churn on every run and make future ADR diffs unreadable.

So `**/*.md` is ignored. This is the one deviation from waterfall-ui's config, which
ignores only `CHANGELOG.md` — reasonably, for a component library where markdown is
incidental. Here it is the deliverable.

## Tests

**Vitest, because it reuses `vite.config.ts`.** CSS imports, `~/` resolution and the
Tailwind pipeline all work with no second toolchain. `bun test` was the alternative —
zero dependencies, and it matches the project's package manager — but it does not run
Vite's transform, so component tests would need CSS-import shims.

**`reactRouter()` is omitted from the plugin list under Vitest.** It owns
route-module transformation and a virtual server entry that have no meaning outside a
build, and with it present component tests fail on imports it expects to have
rewritten. The consequence is a real limit, recorded in `vite.config.ts`: anything
existing *because* of the plugin — typegen's `./+types/*` modules, prerendering, the
route manifest — is untestable here by construction. Route components that take no
loader data are testable; ones that do need their props passed by hand.

**The valuable layer is the built-output assertion**, `scripts/assert-pages.test.ts` —
the CI page assertion
[AWK-17](https://linear.app/awkale/issue/AWK-17/spike-the-637-route-prerender-build)
designed, proved in a spike repo, and that this repository never had, which is why
several tickets carried an unactionable "joins the CI page assertion" line. It asserts
against `build/client` rather than source, because that is the artifact Netlify
publishes and whose HTML the Forms scanner reads: **every other test can pass while
the deployed page is wrong.** Both sides derive the page set from `prerenderPaths()`,
which is why that function lives in `app/lib/` instead of inline in
`react-router.config.ts`.

It **skips** when `build/client` is absent so a fresh clone can run `bun run test`.
Vitest reports the skip, and `bun run test:ci` builds first so CI cannot skip it
silently.

## The hook checks; it does not fix

`.githooks/pre-commit` runs `format:check` then `lint`, and **fails with the fix
command** rather than repairing anything. Installed by `bun install` via the `prepare`
script, which sets `core.hooksPath` — so it is version-controlled and arrives with the
clone, unlike `.git/hooks/`. No husky, no lefthook, no dependency.

It does not auto-fix for two reasons, the second of which is specific to this repo:

1. Rewriting files mid-commit means the commit holds something other than what was
   staged and reviewed.
2. **oxfmt is not idempotent in one pass here.** `site-header.tsx` and
   `site-footer.tsx` — the two files with multi-line `className` strings — need a
   second run to converge, because the first pass collapses the string and the second
   sorts and rewraps it. An auto-fixing hook could therefore stage a state that still
   fails its own check.

Tests are deliberately **not** in the hook. One suite needs a build first, which is
too slow for every commit; `test:ci` is where that belongs.

## What was rejected

**ESLint and Prettier** — not seriously considered, since the four sibling repos have
already moved. oxlint runs the 210 rules in well under a second.

**`oxlint-tsgolint`**, waterfall-ui's third ox dependency, is **not installed**.
Type-aware linting is a separate decision with its own cost, and adding it later is
one dependency and one flag.

**Auto-fixing pre-commit hook** — see above.

**Testing the prerender enumerator's guards through the build** rather than by mocking
`app/data/sample` — rejected because a build failure proves the build fails, not that
bad data is what caused it.

## Consequences

**Five commands, and the hook makes two of them mandatory:** `bun run test`,
`test:watch`, `test:ci`, `lint`, `lint:fix`, `format`, `format:check`. `AGENTS.md`
carries the list.

**`bun install` now writes to git config** via `prepare`. Harmless and idempotent, but
it is the first time installing dependencies changes repository configuration, and
worth knowing before wondering why a hook appeared.

**This record is the first to describe tooling rather than the site**, which is why it
sits at 0014 and not in `docs/agents/`: it is a decision with alternatives and
consequences, not an instruction to an agent.

**Reopening trigger.** A test that needs a real browser (nothing here does today —
happy-dom covers it, and the built-output assertion covers the rest), or the ox tools
diverging from what the sibling repos run. If waterfall-ui changes its ruleset, this
repo should follow rather than fork.
