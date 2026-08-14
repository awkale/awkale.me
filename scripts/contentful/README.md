# BSO Archive → Contentful

Imports `Wikipedia BSO Archive.xlsx` (repo root) into the Contentful space
`3iiyvj5u5c9h`, environment `master`.

Two steps: parse the spreadsheet into a normalized entity graph, then push that
graph to the Contentful Management API.

Schema is a separate concern with **two** scripts of its own — see below. One
appends fields to existing archive types, one creates whole types. They are
separate because the properties that make appending safe are not the ones that
make creating safe. There are **three** declarations across those two appliers.

| Declaration | Applier | Ticket | Does |
| --- | --- | --- | --- |
| `archive-schema.json` | `migrate_schema.py` | AWK-30 | Appends 10 optional fields to 4 archive types |
| `portfolio-schema.json` | `migrate_portfolio.py` | AWK-31 | Creates `imageGroup` and `project` |
| `recording-schema.json` | `migrate_portfolio.py --schema` | AWK-32 | Creates `recording` |

Both take `--dry-run`, both reject unrecognized arguments, and both re-activate a
type stranded by a half-finished run.

## Schema migration

`archive-schema.json` is the desired archive schema — every field ADRs 0005–0008
decided that `master` does not have. `migrate_schema.py` applies it.

```bash
# report what is missing -- writes nothing, and this is the safe default
python3 scripts/contentful/migrate_schema.py --dry-run

# add the 10 fields and re-activate the 4 content types
python3 scripts/contentful/migrate_schema.py
```

Ten fields across four types: `concert.attended` / `satOut`, `composer.slug` /
`period`, `conductor.slug`, and `work.period` / `forms` / `arranger` /
`arrangementType` / `arrangementOf`.

**Schema only — it writes no entry data**, so it is safe to run before the
re-import and before any seeding pass. It is also **additive**: a field already
present by id is left exactly as it is, so a re-run resumes, and a hand-edit made
in the Contentful web app is reported as drift rather than silently overwritten.

**Applying is the default; `--dry-run` is opt-in.** Unrecognized arguments are
rejected rather than ignored, so a `--dryrun` typo fails instead of quietly
writing to the space.

**A drifted field exits non-zero.** Drift is never repaired automatically —
reshaping a field is the class of change Contentful refuses anyway, and doing it
silently would undo a deliberate hand-edit. Reconcile it in the web app, or
update `archive-schema.json` to match.

### Adding a field is two calls, and it can strand

`PUT /content_types/{id}` writes a **draft**; `PUT /content_types/{id}/published`
is what makes the field visible to the Delivery API. If the first lands and the
second does not — exhausted retries, a dropped connection, Ctrl-C — the fields
exist but nothing reading the CDA can see them, *and they read back as present*.

The script detects that (`version > publishedVersion + 1`) and re-activates the
type. Without it, every re-run would report `0 change(s) applied` over a
permanently half-applied migration, which is the worst available failure: silent,
and indistinguishable from success.

**Every field it adds is optional.** That is what makes adding one to a type
holding published entries safe — no existing entry becomes invalid. `attended`
in particular *must* stay optional, because unset is one of its three meaningful
states (ADR-0006): the 119 pre-tenure concerts rely on it.

### Two things it deliberately does not do

**It does not delete `work.genre`.** [ADR-0007](../../docs/adr/0007-period-and-form-taxonomy.md)
retires the field, but only after the `genre` → `forms` data migration. Deleting
it here would drop 218 assignments with nothing left to migrate from. Contentful
also deletes a field in two phases (`omitted`, then `deleted`), which is a second
reason it does not belong in a schema-only pass.

**It does not remove `unique: true` from `work.slug` on a default run.** That is
behind its own flag:

```bash
python3 scripts/contentful/migrate_schema.py --drop-work-slug-unique
```

It asks for confirmation, and refuses to run unattended without `--yes`. **That
prompt is not a check** — the script cannot see whether AWK-39's assertion is in
the build. `blockedBy` in `archive-schema.json` is a note to a human, so running
the flag to find out whether the gate is satisfied would simply remove the
constraint.

[ADR-0008](../../docs/adr/0008-archive-slug-source.md) removes the constraint
because the invariant the URL scheme needs is `(composer, slug)` — composer-scoped,
which Contentful cannot express — and the space-wide constraint is what forced the
importer to hash in the first place. But the same ADR is explicit that the build
assertion must be written **first**: *"Otherwise there is a window in which nothing
protects the invariant at all."* That assertion is AWK-39, which AWK-30 blocks, so
a default run cannot satisfy the ordering and does not try.

**Run the flag only once AWK-39's `(composer, slug)` assertion is in the build and
passing.** Until then `unique: true` is the only thing standing between the space
and 20 work slugs colliding across 9 title families.

### What guards the file

`archive-schema.test.ts` runs in `bun run test` and pins the vocabularies — the
nine IMSLP periods, the 25 form values, the four arrangement verbs — plus the
shapes that carry a decision, such as every added field being optional.

It asserts the *file*, not the space: nothing here proves the migration ran,
because that needs a CMA token and ADR-0002 forbids one reaching CI. It also
cannot catch a wrong decision, only drift away from a recorded one.

## Portfolio content types

`portfolio-schema.json` declares ADR-0003's two types and `migrate_portfolio.py`
creates them. **Applied 2026-08-14** — the space now holds 13 content types.

```bash
# report what is missing -- writes nothing, and this is the safe default
python3 scripts/contentful/migrate_portfolio.py --dry-run

# create the two types and activate them
python3 scripts/contentful/migrate_portfolio.py
```

`imageGroup` (4 fields) and `project` (**14** fields — see below). Schema only:
it writes no entry data, so both types are created empty and stay that way until
AWK-43 authors the five entries.

### Why this is a second script rather than a flag on the first

`migrate_schema.py` appends **optional** fields to four types holding 1,155
entries between them (`concert` 249, `composer` 244, `conductor` 37, `work` 625,
counted 2026-08-14), and *every field being optional* is the property that makes
it safe. Note that the 1,228 quoted in `facts.md` and ADR-0007 is a different
five-type set — it includes `hall` and `soloist` and excludes `concert` — so it is
not the figure that describes this risk.
This schema is mostly **required** fields, which is safe only because the types
have no entries. Those are different guarantees, and one script whose safety
depends on which branch it took is a script whose safety nobody can state.

### Three things the ticket gets wrong or leaves open

**`project` has 14 fields, not 13.** AWK-31's summary says 13; ADR-0003's schema
table has fourteen rows, and the ticket itself says to copy the tables from the
record rather than re-deriving them. The record won. The field set is asserted in
`portfolio-schema.test.ts`, so the count cannot drift silently.

**`technologies`' allowed list was never specified.** ADR-0003 writes
`in: […], explicit allowed list` and enumerates nothing, and neither does the
ticket. The eleven live values were derived under AWK-31 from `package.json` and
`docs/agents/facts.md`. They cover awkale.me and the Waterfall Design System and
**do not cover Agent A or the 2019 Cision tooling** — AWK-43 will likely need to
extend the list and republish the type. `vocabularyNotes.technologies` in the JSON
records the derivation and the gap.

**`body` permits `entry-hyperlink` to any entry type.** ADR-0003 restricts
embedded *blocks* to `imageGroup` and assets, and a hyperlink is not a block, so
nothing stops a case study hyperlinking a `work` or a `concert`. Left open
deliberately — cross-linking to an archive page is plausibly wanted — but AWK-39's
RichText renderer has to resolve such a link or emit a dead href.

### Creation order is load-bearing

`imageGroup` is declared first because `project.body` restricts its embedded
blocks to `imageGroup` *by id*, and Contentful rejects a `linkContentType` naming
a type that does not exist. Creating `project` first fails the migration on its
first write. The applier walks the file in order and never sorts;
`portfolio-schema.test.ts` pins the order so a later tidy-up cannot alphabetize it.

### It refuses to add a required field to a populated type

Only reachable on a re-run against a type that already exists. Adding a required
field to a type holding entries invalidates **every one of them at once** — they
all fail validation on a field none of them has a value for. So before appending
any required field the applier counts the type's entries and refuses if there are
any, exiting non-zero. Populate the field by hand first, or add it as optional.

On the greenfield path this branch never runs, which is exactly why it is worth
having: the dangerous case is the second run, months later, against a type that
by then holds the five project entries.

### Two invariants are deliberately absent

Both are handed to AWK-39's build assertions, and both are recorded under
`deferredInvariants` in the JSON with the reasoning:

* **`sideBySide` means two images**, but a Contentful array's `size` cannot depend
  on another field's value — a `max: 2` would cap `grid` and `fullWidth` too, and
  the wizard item alone needs five. So `images` carries no size validation, and
  the consequence is permanent: **the component must tolerate N forever.** An
  assertion catches bad data at build time; it does not stop a three-asset
  `sideBySide` group existing in the space.
* **`featuredRank` requires a non-empty `body`**, or the home page gets a card
  that does not click. Both fields must stay independently optional — three of the
  five entries that ship are index-only.

`portfolio-schema.test.ts` asserts these are *absent*. An absence is invisible on
inspection, so without the test the next reader adds a `max: 2` in good faith and
breaks an invariant that lives somewhere else entirely.

**A third gap, found while implementing and not in any record:** ADR-0003 chose a
single nullable `featuredRank` over a boolean-plus-order pair *"so the
contradictory state does not exist"* — but nothing stops two projects both being
rank 1, which reintroduces the same non-deterministic home-page order the record
rejected a bare boolean for. `unique: true` was considered and **not** applied,
because swapping ranks 1 and 2 transiently needs a duplicate and Contentful would
block the publish — a real cost on a 2–3 item hand-edited list. Assert
distinctness in the build instead.

### What guards the file

`portfolio-schema.test.ts` runs in `bun run test` and pins the field sets, the
three vocabularies, the required set, the RichText restrictions, the creation
order, and the deliberate absences above. Same limits as the archive guard: it
asserts the file, not the space, and it cannot catch a wrong decision.

## The `recording` content type

`recording-schema.json` declares [ADR-0012](../../docs/adr/0012-performance-recordings.md)'s
one type. **Applied 2026-08-14** — the space now holds 14 content types.

```bash
# report -- writes nothing, and this is the safe default
python3 scripts/contentful/migrate_portfolio.py \
    --schema scripts/contentful/recording-schema.json --dry-run

# create the type and activate it
python3 scripts/contentful/migrate_portfolio.py \
    --schema scripts/contentful/recording-schema.json
```

Five fields, of which **four are required**: `url` (required, unique) · `label`
(required) · `kind` (required, `video` or `audio`) · `concert` (required) ·
`programItem` (**the only optional one** — empty means the recording covers the
whole concert rather than one item).

### Why it reuses `migrate_portfolio.py` instead of a third script

The safety property that matters here is the one that makes **creation** safe —
a GET proves the type absent, the creating PUT carries no version header so a
concurrent create 409s rather than clobbering, and required fields are refused on
a type that already holds entries. That is exactly `migrate_portfolio.py`, and
copying ~300 lines to change one filename would mean the next fix to that logic
has to land in two places.

So it grew a `--schema PATH`, defaulting to `portfolio-schema.json` — AWK-31's
invocation is unchanged, and the file kept its name so AWK-31's records still
name a script that exists. **The name is narrower than the script.** It applies
any schema shaped like `portfolio-schema.json`: a `createTypes` array of whole
types. It is still the wrong tool for appending to a populated type; that is
`migrate_schema.py`.

A mistyped `--schema` path exits rather than falling back to the default, because
the failure mode of falling back is applying the *portfolio* schema while an
operator reads a report about recordings.

### It is the fourteenth type, not the twelfth

ADR-0012 says "the twelfth content type in the space" and AWK-31 says `project`
and `imageGroup` are "the twelfth and thirteenth". Both were written against an
11-type space; AWK-31 landed first, so the space went 11 → 13 → 14. ADR-0012 was
corrected under AWK-32. Ordinals are the fragile way to say this, which is why
`portfolio-schema.json` flagged the collision when it landed.

### One validation is not in the record

`url` carries Contentful's URL regexp alongside `unique: true`; ADR-0012
specifies `Symbol, unique` and is silent on format. Added because the field's only
consumer is an `<a href>`, so a non-URL value fails in a built page rather than at
authoring time — and `project.liveUrl`/`repoUrl` already carry that exact pattern.
It is a format check, not an editorial policy, which is the line
`portfolio-schema.json` drew when it declined to trim RichText marks. Recorded
under `beyondTheRecord` in the JSON and pinned by the test, so it can be reversed
deliberately.

### The sixth invariant Contentful cannot hold

`recording.programItem` must belong to `recording.concert.program`. Both links
can be individually valid while the pair is nonsense — and that is not
hypothetical: it is precisely the Mexico-tour error ADR-0012's longest section
exists to prevent, where the works *are* on `cnc-20200223`'s program but the
performance was the tour, not the Brooklyn Museum night.

Deferred to AWK-39. The harness is `scripts/assert-pages.test.ts` (built under
AWK-17), but the check cannot run until entries are readable through the Delivery
API. Note "joins the CI assertion" is aspirational in ADR-0012's sense: there is
no CI in this repo, so it runs in `bun run test` and nothing runs it
automatically.

### Two absences are load-bearing

* **No `date` field.** It derives from `concert`. The trap is specific: the RSS
  feed hands you a `<published>` per video and it is the wrong date every time —
  3.5 months out on the Tchaikovsky, ~6 months on the Nimrod from the same
  concert.
* **No uniqueness on the (`concert`, `programItem`) pair.** One Program Item
  legitimately holds several recordings — the Tchaikovsky Violin Concerto is
  published twice, first movement and complete, both `pi-20221218-3`.

### Seeding is by hand, and the curation is written down

ADR-0012's "seeding cannot be scripted" is a conclusion with three independent
proofs, not a warning. The per-video pass lives in
[`docs/archive/recording-curation.md`](../../docs/archive/recording-curation.md):
of the fifteen uploads the feed returns, **three are seedable** (two Program
Items, one Concert), three are blocked on a Mexico tour date no source here
records, four are not performances, and five are absent from the archive.

The type is created **empty**. Nothing in this repo authors a `recording` entry.

## Usage

```bash
# 1. parse the spreadsheet -> scripts/contentful/bso-graph.json
python3 -m venv /tmp/bso && /tmp/bso/bin/pip install -q openpyxl
/tmp/bso/bin/python scripts/contentful/parse_archive.py "Wikipedia BSO Archive.xlsx"

# 2. review what would change -- writes nothing
python3 scripts/contentful/import_to_contentful.py --dry-run

# 3. create/update entries as DRAFTS
python3 scripts/contentful/import_to_contentful.py

# 4. publish (separate on purpose -- unpublishing thousands of entries is painful)
python3 scripts/contentful/import_to_contentful.py --publish
```

Step 1 needs `openpyxl`. Steps 2–4 are stdlib only.

### Credentials

A Content Management token (`CFPAT-...`), from Contentful → Settings → API keys
→ Content management tokens. **Not** a Delivery/Preview key — those are
read-only and fail on the first write. Resolved in this order:

1. `CONTENTFUL_CMA_TOKEN` env var
2. `--token-file PATH`
3. `~/.contentful-cma-token`

Never commit the token. `.gitignore` covers the usual filenames, but this repo
is a public GitHub Pages site, so treat a leaked token as compromised and
rotate it.

Space and environment can be overridden with `CONTENTFUL_SPACE_ID` and
`CONTENTFUL_ENVIRONMENT_ID`.

## Safety properties

* **Idempotent.** Entry ids are derived from the content, so re-running updates
  in place rather than duplicating. `import-state.json` also lets an
  interrupted run resume.
* **Existing entries are matched, not duplicated.** Composers, soloists and
  conductors match on a name key that ignores accents and nobiliary particles,
  so the sheet's `van Beethoven, Ludwig` resolves to an existing `Beethoven`.
  Works match on (composer, title); concerts on date.
* **Never overwrites a non-empty field.** Values are only written where the
  existing field is empty, so hand-curated data (movement lists, composer
  birth/death dates) survives a re-import. Where the sheet disagrees with a
  populated field, the existing value wins and the difference is printed under
  `CONFLICTS`.
  The one deliberate exception is `concert.program`, listed in `OVERRIDE`.
* **Drafts first.** Publishing is a separate flag, and runs in dependency order
  so links always resolve.

## Sheet conventions the parser relies on

Verified against the source; these are what make the 1,489 rows parseable:

* `SEASON n` in column A starts a season, `SEASON n, cont.` continues it.
* A non-empty column A that isn't a season header starts a new concert.
* **Leading whitespace means "continues the row above."** Wrapped piece titles
  and extra soloist credits are indented.
* A row with no piece and no composer carries **additional soloists for the
  piece above** — 232 rows do this.
* A dated row can be an **additional performance of the preceding program** (a
  two-night run) rather than a new program. Both concerts link the same program
  items. The sheet writes this two ways, 8 rows in total:
  * **Bare date** — no piece and no composer (4 rows).
  * **Date on the run's next piece**, leaving conductor, orchestra and venue
    empty (4 rows: 879, 966, 1006, 1091). All three cells must be blank to
    qualify. Row 266 (`var. dates, 1983`) has a blank conductor and venue but
    names BHO, and is a genuine concert — testing only two of the three would
    silently swallow it.

  `report["shared_program"]` labels which form matched, so a future edit to the
  sheet that trips the heuristic is visible rather than silent.
* Each soloist cell holds exactly one credit, `Name` or `Name, Role[, Role...]`.
  Multiple roles mean one player on several instruments. Roles that aren't
  instruments or voices are treated as opera characters.

## Known gaps

* **Genre is inferred from the title** by keyword and covers ~68% of works. The
  rest are left unset rather than guessed.
* **Composer birth/death dates are not in the spreadsheet.** Only the handful
  curated by hand have them.
* **Opera casts are only partly modeled.** A single performer's role lands in
  `programItem.character`; a full cast keeps its per-singer roles in the
  verbatim `credits` array, since one field can't hold six. Lossless as text,
  but not queryable. A `credit` join type would fix it.
* Three concerts have no usable date (`unknown`, `May, 1981 (date n/a)`,
  `var. dates, 1983`); the raw text is preserved in `concert.dateNote`.
* **Rows 912–913 (Dec 13 2008) are ambiguous in the source and the parser makes
  a judgment call.** Both rows give the same date, piece, composer, conductor
  and orchestra, but *different venues* — `Grand Street Campus High Schools`
  vs `Church of St. Ann & the Holy Trinity`. Only row 913 has the remaining two
  pieces beneath it.
  `duplicate_header()` treats row 912 as a superseded edit and skips it, which
  matches how the entry was resolved in Contentful. The cost: `Grand Street
  Campus High Schools` appears nowhere else in the archive, so that venue is no
  longer referenced by any concert (the `hall` entry still exists, orphaned).
  If the two rows are in fact one program performed at two venues on one day,
  delete `duplicate_header` and instead give row 912 a `shares`-style link to
  row 913's program. Check the season programs before assuming either way.

## Content model

```
concert ──┬─ season
          ├─ hall
          ├─ orchestra[]
          ├─ conductor
          └─ program[] ─→ programItem ──┬─ work ──┬─ composer
                                        │         └─ genre
                                        ├─ composer      (when no work is named)
                                        └─ soloists[] ─→ soloist | ensemble
```

`programItem` is what makes the archive queryable: it records a work *as
performed on one occasion*, so the soloists attach to the specific piece they
played. A flat `program` array of works and soloists cannot express that.
