# BSO Archive → Contentful

Imports `Wikipedia BSO Archive.xlsx` (repo root) into the Contentful space
`3iiyvj5u5c9h`, environment `master`.

Three steps: parse the spreadsheet into a normalized entity graph, push that
graph to the Contentful Management API, then archive whatever the push
superseded — the importer never deletes, so the third step is not optional
after a merge.

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

## Participation seeding

`seed_participation.py` writes `concert.attended` and `concert.satOut` from
[`docs/archive/participation-checklist.md`](../../docs/archive/participation-checklist.md).
AWK-36. ADR-0006 made every route participation-driven, so this one pass is what
generates the site's page set — **121 concerts, 322 works, 147 composers = 590
routed pages**.

```bash
# regenerate the plan -- offline, no token, no space access
python3 scripts/contentful/seed_participation.py --plan

# report what would change -- writes nothing, and this is the safe default
python3 scripts/contentful/seed_participation.py

# write, then publish
python3 scripts/contentful/seed_participation.py --apply --publish
```

Ran on 2026-08-15: 127 concerts written and published, 121 `true` against 6
`false`, 4 carrying a `satOut` link.

### Dry run is the default here, unlike every other script

`import_to_contentful.py` and `archive_orphans.py` write unless told otherwise.
This one reports unless told to `--apply`, because participation is **destructive
to the sitemap**: a stray `attended: false` does not annotate a page, it deletes
one, and after the apex cutover it 404s a live URL.

### The date is the identity, and the derived id is not

The plan keys on **date** and carries `graphId` only to join `bso-graph.json`.
Addressing the CMA by the derived id 404s on four of the 127: the importer matches
concerts on date and reuses whatever entry it finds, so 33 hand-curated concerts
live under Contentful auto-ids — 2001-05-24 is `1LPJsOTpuDin0YfbRM2RPW` — and
`cnc-20081213-2` still carries the suffix left by the row 912/913 duplicate header.

### satOut is resolved, never constructed

Program item ids are positional and derive from the **concert** id, so a run's
second night carries the first night's ids. Building `pi-{own date}-{index}` is
wrong for 20 items across 14 concerts. Every link is read out of that concert's own
`program` array instead, and the run refuses outright if the live `program`
disagrees with the graph's — a stale graph aims `satOut` at a renumbered item, and
Contentful cannot validate `satOut ⊆ program` itself.

### Three states, and the third is not a default

`true` played, `false` was-around-and-missed, **unset** arrived via the BSO seed
and was never Alex's history. The 119 pre-tenure concerts are absent from
`participation.json` entirely, so they cannot be written even by accident. After
the run the space holds 121 / 6 / 122 — and 122 is those 119 plus the 3 undated
concerts.

### What guards the file

`participation.test.ts` re-derives the whole plan from the checklist and the graph
independently, rather than reading the generator's output, and asserts the page
counts ADR-0006 predicts. It asserts the FILE, not the space; proving the space
matches is AWK-39's build assertion.

## The arranger merge

`merge_composers.py` executes [ADR-0005](../../docs/adr/0005-composer-identity-and-arrangements.md),
and `merge-composers.json` holds the decisions it executes. **Applied 2026-08-19**
under AWK-23; the space went from 242 composer records to 241.

```bash
# report what would change -- writes nothing, and this is the safe default
python3 scripts/contentful/merge_composers.py

# create 24 records, relink 25 works, delete 25 -- and publish all of it
python3 scripts/contentful/merge_composers.py --apply
```

The archive stored the arranger inside `composer.firstName`, so one person existed
as several records: `Modest Mussorgsky`, `Modest (orch. by Ravel) Mussorgsky`,
`Modest (arr. by Peters) Mussorgsky` and `Modest (orch. by Rimsky-Korsakov)
Mussorgsky` are four records for one man. This collapses them and moves the
arranger onto `work.arranger`, a link.

Five passes: create the five canonical composers that exist only in arranged form,
create the nineteen arrangers who are not in the space yet, relink the 25 works
(setting `arranger`, `arrangementType`, and `arrangementOf` on the two pairs),
re-read the space to confirm nothing still points at the 25, then delete them.

### `--apply` publishes, unlike every sibling script

There is no drafts-only mode here and that is deliberate. `backfill_slugs.py` can
leave drafts because the worst case is stale URLs; this script **deletes 25
published records**, so a relink left unpublished while the delete still lands
leaves the Delivery API serving 25 works whose composer link points at an entry
that no longer exists. Staging that as drafts has no use worth the failure mode.

### Delete is forced, and so is the order

`composer.sortName` is `unique: true` and is the only unique field the type has.
That is not incidental — **it is the mechanism that let the duplicates exist**, and
it also means there is no "strip the text but keep both records" option: cleaning a
duplicate's `sortName` while its canonical twin holds the clean value is rejected.
Archiving does not help either, because an archived entry still consumes the unique
value. So works are relinked **before** the old records are deleted, and the script
re-reads inbound links from the space between the two rather than trusting its own
plan.

### Canonical targets resolve by cleaned `sortName`, never by id shape

All eight hand-curated composers carry auto-generated ids — `cmp-mahler-gustav`
**404s**, and the live record is `2xlZPpzsieUWQMguPlmRip`. Three of the merges pair
an auto-id target with a derived-id source, so matching `cmp-<x>` against
`cmp-<x>-arr-by-*` misses **exactly the three records holding curated dates**.

### Scope is tenure, not attendance

In scope means `concert.attended` is **non-null**. Unset is the pre-tenure seed
rows; `false` is one of the 6 concerts Alex missed, which are still his history and
whose works are still in scope. Reading scope as `attended == true` finds **17 of
the 25** contaminated records and silently leaves 8 behind. The counts in
`merge-composers.json` are abort thresholds that catch exactly that, and `--force`
downgrades them to warnings.

Those thresholds have **two** valid readings for the contamination counts —
25/37 before and 0/12 after — because a migration that aborts on its own past work
trains an operator to reach for `--force`, which disables the guard that matters.

### It leaves 12 records contaminated on purpose

37 records are contaminated archive-wide and 25 are in scope. The other 12 are
pre-tenure, and four of them are a **different pattern entirely**: a bare `(arr.)`
naming no arranger, where the arranger *is* the filed composer of traditional
material and there is nothing to merge toward. One is not even a person — `English
Carol`. A sweep over every `arr. by` match is wrong.

### What guards the file

`merge-composers.test.ts` pins the four verbs, cross-checks them against the `in`
validation `archive-schema.json` puts on the field, pins the two arrangement pairs
and the scope thresholds, and records the three counts this migration corrected in
ADR-0005. It asserts the FILE, not the space.

## Seasons carry their institution — AWK-59

`season.number` never identified a Season on its own, and once a second
institution exists it plainly does not: the space holds two entries numbered 29,
one Brooklyn and one Long Island Youth Orchestra. `backfill_seasons.py` gives
every Season an `orchestras` list and a label of the form
`BSO Season 30, 2002-2003`.

Three things about it are worth knowing before running it.

**The year is read from concert dates, never computed from the number.**
`1972 + number` is right through Season 47 (2019-2020) and wrong after it —
Season 48 is **2021-2022**, because the cancelled COVID season consumed no
number. An offset that holds for 47 consecutive seasons and breaks on the last
five survives every spot-check anyone would think to run.

**`orchestras` is an array because one Season straddles a renaming.** Season 5
opens at the Music Society and closes at the Heights Orchestra. Season 28 looks
like a second case against the live space and is not — its 2001-05-24 concert is
mislinked there to BSO, against the spreadsheet, against the entry's own title,
and against `participation-checklist.md`. That is recorded under
`knownLiveErrors` in `season-orchestras.json`, and deriving from the graph rather
than from the space is what keeps the migration from ratifying it.

**Dry run is the default.** It rewrites `label`, which is the season type's
displayField, on 52 published entries. It also preserves publication state rather
than picking one: published entries are republished, and the LIYO draft Alex made
by hand stays a draft.

```bash
python3 scripts/contentful/migrate_schema.py      # adds season.orchestras first
python3 scripts/contentful/backfill_seasons.py    # report, writes nothing
python3 scripts/contentful/backfill_seasons.py --apply
```

`season-orchestras.test.ts` asserts the FILE and re-derives from the graph in
TypeScript what the applier derives in Python — deliberate double-entry, so a
bug in either shows up as a disagreement rather than a confident migration.

## Period, form and diacritics — AWK-37

ADR-0007 retires `genre` for two axes: `period`, held on the composer and
overridable on the work, and `forms`, a tag set on the work. Both are filters and
neither is routed, so **the published page count is unchanged**. Two scripts and
two artifacts, because the derived half and the decided half have different
review costs:

| File | Is | Regenerate? |
| --- | --- | --- |
| `imslp_harvest.py` | The only thing here that talks to IMSLP | — |
| `imslp-harvest.json` | Derived: matched pages, eras, styles, harvested forms | Yes, freely |
| `period-and-forms.json` | Decided: aliases, hand periods, form curation, guards | **Never** |
| `seed_period_and_forms.py` | Applies the second layered over the first | — |

```bash
python3 scripts/contentful/imslp_harvest.py            # cached under .imslp-cache/
python3 scripts/contentful/seed_period_and_forms.py    # report, writes nothing
python3 scripts/contentful/seed_period_and_forms.py --apply
```

Five things are worth knowing before running it.

**Only an exact folded name match is accepted automatically.** Every looser rule
was tried and produced confident nonsense — surname-only gives `Gustavson, Mark`
→ `Gustavson, Eva` and `Marquez, Arturo` → `Márquez, Antonio`; surname-plus-initial
gets Prokofiev and Rimsky-Korsakov right and `Thompson, Randall` → `Thompson, Ray`
wrong. A rule right four times in five is worse than none, because nothing
downstream can tell which five. The 40 names a fold cannot settle are decided in
`composerAliases`, where **a null means checked-and-absent**, not unchecked.

**Diacritics come from the pair, not from a probe.** IMSLP holds both spellings
as separate pages — `Bartok, Bela` *and* `Bartók, Béla` — so an identical folded
key means the same person by construction and the accented page is the canonical
spelling. Probing the folded title instead does **not** work: `Dvorak, Antonin`
404s, `Bartok, Bela` resolves to a page carrying no era, and `Faure, Gabriel`
resolves and returns `Romantic`, which looks exactly like success. 13 composers
gain an accent; slugs fold to ASCII and are untouched.

**IMSLP runs a MediaWiki old enough to answer `query-continue`.** A pagination
loop written against current MediaWiki docs stops at the first page and reports a
complete result — it silently capped Bach at 500 of 1,431 work pages. A short
list looks exactly like a small composer.

**The form harvest yields seven works, and that is not a bug to fix.** Of the 114
played works carrying no genre, 24 match an IMSLP page and 7 carry a whitelisted
category. The cause is structural: the archive names excerpts (`Act II, Carmen`)
where IMSLP names works, and Barber, Bernstein, Britten, Khachaturian, Glass,
Tippett, Rota, Piazzolla and John Williams have **no IMSLP work pages at all**,
being in copyright. The remaining 107 are `docs/archive/form-curation.md` — a
worksheet, not an input. ADR-0007 permits `forms` to stay incomplete.

**`work.genre` is not cleared and the field is not deleted.** ADR-0007 sequences
this as three separately-owned steps: AWK-30 added `forms`, this migrates the
data, and only then can `genre` go. Deleting it in the pass that migrates it
destroys the only thing a re-run could read.

Dry run is the default, `--apply` publishes, and **a disagreeing value is never
overwritten** — the contested FIELD is reported as a CONFLICT and skipped while
the rest of the row still writes, which is what makes a hand correction durable
across re-runs. Skipping the whole row instead would quietly drop an unrelated
change beside the contested one, and it would first do so on the first re-run
after a correction — exactly when the conflict check is supposed to help.

**A refused publish does not stop the run.** One entry can fail to publish for a
reason that has nothing to do with this pass, and killing a 234-entry migration
over it leaves the space half-seeded and tells nobody which half. The entry is
reported as written-but-unpublished — the Delivery API keeps serving its previous
value, so the site stays consistent — and the pass **republishes it on the next
run without rewriting it**. That last property is not free: a row already holding
the planned values computes an empty change set, so without an explicit
pending-publish check it would be skipped forever and stay stale silently. This
is not hypothetical; it is how the 11 works blocked by the `work.slug` collision
were recovered on 2026-08-30.

`period-and-forms.test.ts` asserts the FILE against `archive-schema.json`'s
vocabularies and against the harvest, the same double-entry as above. It cannot
check whether Sibelius should read Romantic or Early 20th century; those five
two-era composers are judgement calls, and the test only asserts that whatever
was chosen is one of the two IMSLP actually files.

## The Tilles Center transcription — AWK-64

Three scanned Long Island Youth Orchestra programs — 1992-12-13, 1993-05-02 and
1995-06-11 — written into the space by `transcribe_programs.py` from
`tilles-center-programs.json`. Ran 2026-08-31: 35 entries created, one merged,
all published. The space went from two LIYO Concerts to five.

**The declaration is DECIDED and never regenerated**, in the sense
`period-and-forms.json` is. The sources are image-only scans with no text layer;
nothing derives this file, there is no parser to re-run, and re-reading it means
rendering two pages by eye. A correction to it is the only record of that
correction. (To read the scans, extract the embedded `DCTDecode` streams — each
page *is* a JPEG, and no renderer is installed here.)

Four things about it are worth knowing before running it.

**Eleven of the seventeen program lines were already in the space, and the
ticket said to create all seventeen.** Works are shared across Concerts — 649 of
them serve 253 Concerts — so a Work is looked up before it is created, and only
six were new. This is not an optimisation. Creating all seventeen would have
written a second `"Theme and Variations", from Suite No. 3 in G Major` under
Tchaikovsky, colliding with the one AWK-59 made for the 1993-07-26 program and
failing `work-slug-unique-per-composer` at build time — the guard that replaced
`work.slug`'s `unique` when AWK-37 dropped it. The eleven reused ids live under
`reuse.works`, each with a `why` recording how the printed line was identified.

**The program's wording lives on `programItem.label`, not on the Work.** ADR-0006
makes a Work the composition as performed and the ticket said to keep the printed
wording, but a reused Work already carries a title written for a different
concert. Both hold at once because `app/lib/archive.ts` resolves an item as
`label ?? work.title`. So 1992-12-13 item 1 reads **Carneval Overture** while the
Work it links stays **Carnival Overture**; the scan says one, the archive has said
the other since the import, and neither is corrected to match.

**The pre-flight is the interesting half of the script.** Before any write it
resolves all 31 reused ids and aborts on three conditions — the id resolves to
nothing, to a different content type, or to an entry whose live name no longer
matches the declaration. That last one is the checked redundancy this file
describes for `seed_period_and_forms.py`'s curated work ids, and it earned itself
immediately: `Franck, Cesar` became `Franck, César` when the period seed restored
his diacritic an hour later. It then re-checks all six new slugs against their
composer's live works, which is the half `tilles-center-programs.test.ts` cannot
do offline.

**Period and form are deliberately absent from the new records.** ADR-0007 keeps
every form judgement in `period-and-forms.json` and lets Form stay incomplete, so
the applier writes neither. Period arrives on its own — run `imslp_harvest.py`
then `seed_period_and_forms.py` afterwards. **The harvest needs `--refresh`
here**: it caches the Delivery API read in `.imslp-cache/archive.json`, so a
plain re-run after a transcription reports the *previous* scope and matches none
of the new composers. Partial invalidation does not work either, because
`eras.json`, `members.json` and `work-categories.json` are all keyed off the
resolved composer set.

**`programItem.character` is for a role, not an instrument**, and this
transcription got that wrong first time. The field holds the credit left over
once `parse_archive.py`'s instrument enumeration has claimed what it recognises —
`Isolde`, `Dancer`, `Filmmaker` — while the instrument belongs on
`soloist.instrument`. All five of AWK-64's soloist items set it to the instrument,
copying AWK-59's `pi-19930726-12`; both were cleared on 2026-08-31 so the field
means one thing. Three live values elsewhere in the space (`Piccolo`, `Organ`,
`Bass-Baritone`) are still instruments and were left alone — they belong to other
tickets.

`tilles-center-programs.test.ts` asserts the FILE: contiguous orders, ids unique
and following AWK-59's naming, every link resolving to something the declaration
declares, each soloist's `credits` string agreeing with their own record, no item
restating an instrument as a `character`, and no slug in either shape ADR-0008
rejects. Its last pass builds an `ArchiveShape` out
of the declaration and runs the build's own `findViolations` over it, so the
transcription is checked by the same code that would fail the build — and a rule
added to `app/lib/invariants.ts` later starts guarding this file for free.

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

# 5. sweep up anything the re-import stranded -- writes nothing without the
#    second form, and refuses outright if a concert still links to it
python3 scripts/contentful/archive_orphans.py --dry-run
python3 scripts/contentful/archive_orphans.py
```

Step 1 needs `openpyxl`. Steps 2–5 are stdlib only.

### Step 5 is not optional after a merge

**The importer never deletes**, and program item ids derive from the *concert*
id (`pi-{concert-date}-{index}`). So merging a two-performance run moves its
items into the first date's namespace, creates them there, and abandons the
second date's originals — referenced by nothing, but still counted and still in
the space.

`archive_orphans.py` derives that set as *live programItems minus the ones
`bso-graph.json` accounts for*, refuses to touch anything a concert still links
to, and unpublishes then archives the remainder. It is **archive, not delete**:
reversible from the web app, and out of Delivery API results either way.

Run under AWK-20 on 2026-08-14, which archived **16** — the 13 the ticket
predicted from the `shares` fix, plus 3 more it did not. `cnc-20081213-2` is an
older artifact of the row 912/913 duplicate header: live carried
`pi-20081213-2-1…3` while the post-fix graph derives `pi-20081213-1…3` from a
single concert row. The importer matches concerts **on date**, so it reused the
existing entry and rewrote its program; the three superseded items were verified
field-by-field as identical before being archived.

**A count through the CMA still shows them.** `/entries` returns archived entries
by default, so `programItem` reads 823 against 807 active. Every query in
`archive_orphans.py` carries `sys.archivedAt[exists]=false` for that reason —
without it the script re-reports its own previous run as a fresh set of orphans,
forever. The Delivery API hides them, so the built site sees 807.

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
* **It never deletes or unlinks.** Anything a re-import supersedes is left in
  place rather than removed, which is what makes the import safe to re-run and
  why `archive_orphans.py` exists as a separate, deliberate second step.

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
  items. The sheet writes this three ways, 9 rows in total:
  * **Bare date** — no piece and no composer (4 rows).
  * **Date on the run's next piece**, leaving conductor, orchestra and venue
    empty (4 rows: 879, 966, 1006, 1091). All three cells must be blank to
    qualify. Row 266 (`var. dates, 1983`) has a blank conductor and venue but
    names BHO, and is a genuine concert — testing only two of the three would
    silently swallow it.
  * **Declared in `SOURCE_CORRECTIONS`** (1 row: 913). The only form that is not
    sniffed, because the other two **cannot express a run at two different
    venues**: both require a blank venue, and a blank venue is exactly what makes
    the second night inherit the first's hall. Those are the same condition, so a
    two-venue run is undetectable by any widening of the heuristic and is named
    instead. See *Source corrections* below.

  `report["shared_program"]` labels which form matched, so a future edit to the
  sheet that trips the heuristic is visible rather than silent.

* Each soloist cell holds exactly one credit, `Name` or `Name, Role[, Role...]`.
  Multiple roles mean one player on several instruments. Roles that aren't
  instruments or voices are treated as opera characters.

### Source corrections

Three transcription errors in the spreadsheet are fixed in `parse_archive.py`'s
`SOURCE_CORRECTIONS`, keyed by sheet row — **not** in the `.xlsx`, which is a
received primary source this repo keeps intact. A correction in code is greppable,
shows up in a diff, and is covered by `archive-corrections.test.ts`; an edited
binary is none of those.

| Row | Correction | Why |
| --- | --- | --- |
| 888 | Fill conductor / orchestra | 2007-12-16 left both blank. ADR-0006 ships conductor as one of two browse filters, so a blank made it the one played concert no filter could reach. |
| 912 | Clear piece / composer | Sat 2008-12-13 at Grand Street, the run's first night. Its piece cell restates only the opening work; row 913 carries the program. |
| 913 | Date → 2008-12-14 | Labelled `Sun, Dec 13, 2008`, but Dec 13 2008 was a **Saturday**. The weekday is right; the day-of-month is the typo. |

**Every entry pins the value it expects to find and the run aborts on a mismatch** —
the same posture `migrate_schema.py` takes toward drift. A correction applied
silently to data that has since changed is worse than no correction.

`duplicate_header()` consequently **matches nothing now** and is kept anyway: rows
912–913 were its only instance, but the artifact it guards against is a property of
how the sheet was maintained, not of that one pair.

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
* ~~**Rows 912–913 (Dec 13 2008) are ambiguous in the source.**~~ **Resolved by
  AWK-38**, and close to the way this entry guessed: they are one program
  performed at two venues, so row **913** now carries a declared `shares`-style
  link to row **912's** program — the reverse of the direction this entry
  guessed, and the direction that matters: item ids are named from the FIRST
  night, so they stay `pi-20081213-*`. The other thing the guess got wrong is
  that it is not *one day* —
  Alex confirmed **Saturday at Grand Street, Sunday at St Ann**, and Dec 13 2008
  was a Saturday, so row 913's `Sun` label is right and its day-of-month is the
  typo. `duplicate_header()` was kept rather than deleted; see *Source
  corrections*. `Grand Street Campus High Schools` is no longer orphaned, which is
  what closed the graph's 12 halls against Contentful's 13.

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
