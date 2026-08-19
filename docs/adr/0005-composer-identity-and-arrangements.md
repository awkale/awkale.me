---
status: accepted
---

# Composer identity and how arrangements are modeled

A Composer is one Contentful record per person. An Arrangement is a distinct
`work` entry rather than a variant of the original, the Arranger is a link to a
`composer` record rather than a string, and the nature of the reworking is a
controlled symbol. `work` gains three optional fields — `arranger`,
`arrangementType` and `arrangementOf`; `composer` gains nothing.

## The arranger was inside the composer's name

The archive stored the arranger in `composer.firstName`, so one person existed as
several composer records: `Modest Mussorgsky`, `Modest (orch. by Ravel)
Mussorgsky`, `Modest (arr. by Peters) Mussorgsky` and `Modest (orch. by
Rimsky-Korsakov) Mussorgsky` are four records for one man. **25 of the 173
in-scope composer records carry the pattern**, and 37 do archive-wide.

[ADR-0001](0001-url-structure.md) turned this from an untidiness into a
correctness problem:
works are canonically addressed at `/concerts/composers/<composer>/works/<work>`.
Left alone, `/concerts/composers/tchaikovsky-pyotr-ilyich` lists twelve of his
thirteen works and silently drops the thirteenth, so the site's primary
cross-reference axis quietly lies.

The 25 records are **two problems, not one**. Nineteen sit in groups where the
same person also has other records, and need merging — that is the count that
takes 173 records down to **156 people**. The other **six composers exist only in
arranged form** — Addinsell, Badelt, Herrmann, Lecuona, Mancini and Weill — so
they have nothing to merge into and do not affect the 156, but their display name
still renders as "Richard (arr. by Douglas) Addinsell". A cleanup scoped to the
merge alone leaves six visibly wrong names on the site.

## `sortName`'s uniqueness is what created the duplicates

`composer.sortName` carries `unique: true` in the live schema, and it is the only
unique field the type has. That is not incidental to the problem — **it is the
mechanism.** `Tchaikovsky, Pyotr Ilyich` and `Tchaikovsky, Pyotr Ilyich (arr. by
Ellington)` are distinct strings, so both records pass validation. The arranger
text is precisely what permits the duplicate to exist.

The consequence is that **there is no "strip the text but keep both records"
option.** Cleaning a duplicate's `sortName` while its canonical twin holds the
clean value is rejected by Contentful. The schema forces a choice between
deleting the duplicate and keeping the contamination forever, which is why the
disposition below is deletion rather than preference.

## An arrangement is a distinct work

Kept as the archive already models it. Ravel's *Pictures at an Exhibition* is a
different score from Mussorgsky's piano original — different instrumentation,
different duration, a different thing to have played.

That last point decides it.
[AWK-10](https://linear.app/awkale/issue/AWK-10/list-the-concerts-i-missed-in-seasons-28-52)
established that participation is recorded **per piece**, and "works I have
played" is the primary axis of `/concerts`. Collapsing an arrangement into its
original would make that axis unable to distinguish playing Ravel's orchestration
from playing the piano original — a claim the site would be making wrongly, about
its owner, on the section that exists for his own reference.

**In-scope works stay 348, composers 156, concerts 127**, so ADR-0001's total of
637 + N is untouched.

> That statement was correct when made and is left as written.
> [ADR-0006](0006-performance-history-content-model.md) has since changed the
> total for a different reason — `/concerts` now publishes only the concerts Alex
> performed, so the archive-side count is derived from participation data rather
> than fixed. The in-scope figures above are unaffected: this record genuinely
> does not move them, which is what the sentence claims.

`arrangementOf` additionally links an arrangement to its original **when the
archive holds both**, which is exactly two pairs archive-wide:

| Composition | Original | Arrangement |
| --- | --- | --- |
| The Nutcracker Suite | `wrk-the-nutcracker-suite-c5dabb` | `wrk-the-nutcracker-suite-65bec1` (Ellington) |
| Kindertotenlieder | `wrk-kindertotenlieder-5aa6c1` (pre-tenure) | `wrk-kindertotenlieder-59801d` (Roven) |

There are no other duplicate works anywhere in the archive: `work` is otherwise
one entry per composer-and-title throughout. Two pairs is thin justification for
a field on its own, and the field is accepted anyway because those two pairs are
the only places a reader can be actively misled — two entries with the same title
under the same composer, with nothing on the page explaining why.

## The arranger is a composer, not a string

`work.arranger` links to `composer`, reusing that type as "person credited with
musical authorship".

The decisive fact is that **the A–Z composer index derives from works, not from
the composer table.** A composer record with no works-as-composer therefore never
appears in the index — so adding arranger-only people pollutes nothing, and no
filter rule is needed to keep them out. The exclusion falls out of how the index
is already built rather than being a rule someone must remember.

Reuse also prevents drift that strings guarantee. Douglas arranged both Addinsell
and Chopin and is one entity rather than two unrelated values. Respighi arranged
both Rossini and Rachmaninoff *and* has works of his own. **Six of the 23
in-scope arrangers already exist as composers** — Ravel, Rimsky-Korsakov,
Respighi twice, and Schoenberg — so for those the link is to a record that is
already there.

The seventeen who do not exist yet are created **surname-only**. The concert
programs recorded "arr. by Ellington" and nothing more, so `lastName` and
`sortName` hold the surname and `firstName` stays null. Pages render "orch. Ravel"
and "arr. Ellington". Researching full names was rejected as misattribution risk:
Ellington is confident, but Douglas, Martin, Stone, Peters, Wasson and Flores are
genuinely ambiguous from a surname alone, and asserting the wrong person is a
worse error than omitting a first name. `firstName` is already optional, so any of
them can be filled in later with no structural change.

## Four verbs, not one

`arrangementType` is an `in`-validated symbol over **Arrangement**,
**Orchestration**, **Transcription** and **Edition**, matching the four verbs the
source actually uses: `arr.` on 24 records, `orch.` on 10, `trans.` on 1 and `ed.`
on 1.

This **corrects the project glossary**, which previously instructed that
orchestrator, transcriber and editor should all be called Arranger. Flattening
them puts a factual error on the page: Ravel's *Pictures* is an orchestration,
Roven's *Kindertotenlieder* a transcription, and Mauceri's *Psycho* selections an
**edition** — not an arrangement at all. For a section whose stated purpose is
being a reference library, that is the wrong trade.

The role name stays "Arranger" for all four, because the field is `work.arranger`
regardless of verb and the person is doing the same kind of job. It is the
*relationship* that varies, and that is what the new field carries.

## Two of the ticket's premises were false

Recorded because both would have produced a worse model if believed.

**The Ellington title fix does not exist.**
[AWK-15](https://linear.app/awkale/issue/AWK-15/settle-composer-identity-and-how-arrangements-are-modeled)
proposed resolving the Nutcracker collision by data: Ellington's is catalogued as
*Nutcracker Suite*, without the "The", so the titles would differ naturally.
Checked against live Contentful, **both titles are character-identically `The
Nutcracker Suite`.** There is no difference to exploit, so the disambiguator must
come from structure.

**Mussorgsky has a clean record.** The ticket implied the merge always has a
target and, separately, in-scope analysis suggested Mussorgsky had none.
`cmp-mussorgsky-modest` exists and holds one pre-tenure work, *Prelude,
Khovanshchina*, which is why it disappears from any in-scope slice. **Zimmer is
the only one of the sixteen with no clean record at all**, and so the only case
where a canonical record must be created rather than merged into.

Also rejected: `programItem.credits` as the arranger's home, which the ticket
suggested. It holds 174 distinct per-performance performer credits in scope —
"Bart Feller, Flute", "James Busby, Director". It is an occasion-level field, and
the arranger is a property of the score, not of the night it was played.

## Schema

Three optional fields added to `work`. No change to `composer`.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `arranger` | Link\<`composer`\> | no | the person who reworked the Work |
| `arrangementType` | Symbol | no | `in: [Arrangement, Orchestration, Transcription, Edition]` |
| `arrangementOf` | Link\<`work`\> | no | the original, when the archive holds it |

Set together in practice: a work with an `arranger` and no `arrangementType`
cannot be rendered correctly, and neither is required because 593 of 625 works
are not arrangements at all. Contentful cannot express "required if the other is
present", so this is asserted in the build rather than the schema.

## Considered options

**Work identity.** Collapsing an arrangement into the original as a variant
attribute was rejected for the participation reason above, and because
`genre`, `musicalKey` and `movement` all describe a particular version rather than
an abstract composition — one entry would have to hold two sets of them. A
distinct work *without* `arrangementOf` was the runner-up and is very nearly the
accepted answer; the link was added because the two same-titled pairs are exactly
where a reader needs the relationship stated.

**Arranger's home.** A `Symbol` on `work` is the smallest possible change and
would have been defensible, since ADR-0001 already rules arrangers out of URLs so
there is no arranger page to link to. It was rejected on drift: nothing connects
Ravel-the-arranger to Ravel-the-composer, "Douglas" stays two unrelated strings,
and no spelling discipline exists. A shared `person` type spanning composer,
conductor, soloist and arranger is the domain-correct answer and was rejected as
out of scope — doing it properly means reconciling 244 composers, 37 conductors
and 310 soloists, which is a larger effort than the entire section it would serve.

**Relationship type.** A linked `arrangementType` entity would follow the `genre`
precedent — 17 entries whose only field is `name` — and was rejected as four
entries with no fields of their own, plus an extra include level on every work
query to retrieve a string. Discarding the distinction entirely was rejected as
the factual error described above. The `in`-validated symbol follows
`soloist.instrument` (36 values) and `ensemble.kind` (7), and matches the
reasoning [ADR-0004](0004-design-system-and-tokens.md)'s sibling decision used for
`project.technologies`: a closed set with no data of its own is a controlled
symbol, not an entity.

**Disposition of merged-away records.** Archiving keeps them recoverable and out
of the Delivery API, and was rejected because archived entries still hold the
unique `sortName`, so the constraint stays consumed and the contamination is
preserved rather than removed. Leaving them orphaned with no inbound links was
rejected because it produces 19 records that appear in nothing but surface in
every composer query — the same failure already flagged for
`hal-grand-street-campus-high-schools`.

**Contaminated entry ids.** Seven records carry arranger text in the *id* itself,
which Contentful cannot change. Editing their fields in place is fewer operations
and was rejected because `composer` has no `slug` field at all, leaving the entry
id a live candidate for the composer slug source in
[AWK-18](https://linear.app/awkale/issue/AWK-18/decide-where-archive-url-slugs-come-from)
— and `/concerts/composers/addinsell-richard-arr-by-douglas` would be the result.
Recreating them with clean ids costs seven create-and-delete pairs and keeps that
option open. Adding a `slug` field to `composer` here was rejected as deciding
AWK-18's question from inside the ticket that blocks it.

**The Rodzinski year.** `Strauss, Richard (arr. by Rodzinski, 1944)` is the only
record carrying a date. An `arrangementYear` integer would preserve it and sit
empty on 624 of 625 works, displayed nowhere in ADR-0001's sitemap. The year is
discarded; it is recorded here, and in the source spreadsheet, so the discard is
deliberate and recoverable.

## Consequences

**The migration cannot be run by the importer, and its order matters.**
`import_to_contentful.py` never overwrites a non-empty field, so it cannot perform
a merge, and it would recreate the very derived ids being deleted. Works must be
relinked *before* the old records are deleted, because `sortName` uniqueness
blocks any intermediate state where two records hold the clean value. This is
build work rather than a decision and is tracked as
[AWK-23](https://linear.app/awkale/issue/AWK-23/merge-the-split-composer-records-and-populate-the-arranger-fields).
Net effect on the space: **244 composer records become 243** — 25 deleted, 24
created.

**Resolving canonical records by id shape is wrong and will silently half-work.**
All eight composers with hand-curated birth and death dates have Contentful's
auto-generated ids, not derived ones: `cmp-mahler-gustav` returns 404, and the
live record is `2xlZPpzsieUWQMguPlmRip`. Three of the merges — Mahler, Rossini and
Richard Strauss — therefore pair an auto-id target with a derived-id source, so
matching `cmp-<x>` against `cmp-<x>-arr-by-*` misses **exactly the three records
holding curated data.** Canonical targets must be resolved by cleaned `sortName`.

**Only the 25 in-scope records are touched; 12 pre-tenure ones are left
contaminated.** That follows ADR-0001's decision not to surface the 119
pre-tenure concerts, and it means a cleanup sweeping every `arr. by` match is
wrong. Four of those twelve are a **different pattern entirely** — a bare `(arr.)`
with no arranger named, where the arranger *is* filed as the composer of
traditional material (Cacavas, Shields, Willcocks, Salzman), so there is no
underlying composer to merge toward. One of them is not even a person: `English
Carol`.

**A two-arranger work is unrepresentable, deliberately.** The pre-tenure `English
Carol (arr. by Davis/orch. Armstrong)` carries two arrangers and two verbs in one
record; a single link plus a single symbol cannot express it. Accepted because
pre-tenure is permanently out of scope. If that ever changes, both fields become
arrays and every consumer must tolerate N — the same shape ADR-0004 accepted for
`imageGroup`.

**`arrangementOf` can point at a work with no page.** Kindertotenlieder's original
is pre-tenure: present in Contentful as substrate, deliberately not surfaced. Any
UI following the link must tolerate a target with no route, and must not assume a
link implies a destination.

**One work-slug collision is now structural and must be resolved by AWK-18.**
ADR-0001 contradicts itself on this point: it drops the importer's hash on the
grounds that composer-and-title "is already unique", while its own Consequences
note that the Nutcracker pair claims one path. The second reading is the correct
one — the two Nutcracker Suites collide on composer-and-title exactly, both are in
scope, and the collision predates any merge because the titles were always
identical. ADR-0001 has been corrected in place. The
disambiguator is settled in principle — derived from `arranger`, with titles never
edited, because putting arranger text into a title recreates the contamination
this record removes from `firstName`. The mechanics belong to AWK-18. Note that
`work.slug` also carries `unique: true` and the two entries currently coexist
*only* because of their hash suffixes, so dropping the hashed form without a
disambiguator is a schema rejection rather than merely an ugly URL.

**`sortName` loses one of its two contaminants.** After the migration it is free
of arranger text, but the nobiliary particles remain — Beethoven is still
`van Beethoven, Ludwig`. This record does not touch `lastName` at all, which
confirms rather than resolves that second, independent problem.

**Composer attribution flows only through `work.composer`.**
`programItem.composer` is null on all 384 in-scope program items, so it needs no
relinking and should not be read as an attribution source.

## Amendment — what the space actually held (2026-08-19)

Filed from [AWK-23](https://linear.app/awkale/issue/AWK-23), which executed the
migration and found three of this record's counts wrong. **The model is
unchanged**; every correction is arithmetic or a fact that moved after this
record was written. The migration followed live Contentful, per this record's own
instruction to resolve canonical targets from the space rather than from a
remembered shape.

### Nineteen arrangers were created, not seventeen

Twenty-three distinct arrangers appear across the 25 records, and only **four**
already existed as clean composers — Ravel, Rimsky-Korsakov, Respighi and
Schoenberg. This record's "six of the 23 in-scope arrangers already exist" counts
**Respighi twice**, once for Rossini and once for Rachmaninoff. That is six
*links* but four *people*, and the arranger is a link precisely so that the two
collapse onto one record. AWK-23's own enumerated list carried all nineteen
names; only the total was wrong.

### Five canonical records were created, not seven

`cmp-herrmann-bernard` and `cmp-weill-kurt` both exist clean, created 2026-07-30
alongside the rest. **Herrmann and Weill are ordinary merges**, not arranger-only
recreations, so "six composers exist only in arranged form" is really four —
Addinsell, Badelt, Lecuona and Mancini — plus Zimmer, who is the only one of the
sixteen with no clean record at all, exactly as this record says.

Creates still total **24 against 25 deletes**, so the net figure holds. Only the
composition was wrong.

### The space held 242 records, not 244, so it ended at 241

[AWK-39](https://linear.app/awkale/issue/AWK-39) archived `Walton, Sir William`
and `Sullivan, Sir Arthur` in its honorific merge, between this record being
written and the migration running. **244 → 243 was correct when written and is
241 in practice.**

### Everything else verified exactly

The in-scope slice came out at **127 concerts, 384 program items, 348 works** and
**25 of 37** contaminated records, with the 12 pre-tenure ones untouched —
including all four bare `(arr.)` records. All three auto-id canonical targets
resolved correctly through cleaned `sortName`: Mahler `2xlZPpzsieUWQMguPlmRip`,
Rossini `6jOSl95P8vp0ng2xvHFeTz`, R. Strauss `5b96GjJ5laY9p8n8cLz6Pi`. Exactly 25
works linked the 25 targets, one each, with **no pre-tenure work and no
`programItem` among them**, so all 25 deleted with zero inbound links.

The build now publishes **147 composers**, which is
[ADR-0008](0008-archive-slug-source.md)'s predicted figure reached from the other
direction. And the prediction in *The arranger is a composer, not a string* holds
literally: the nineteen arranger-only records produce **no composer pages at
all**, because the index derives from works. Ravel and Respighi keep theirs, on
the strength of their own works.

### Cleaning the names broke the page, because nothing read the new fields

The arranger reached the rendered page **only** through the contaminated composer
name. `app/lib/archive.ts` never read `work.arranger`, and `byline` in
`app/lib/format.ts` was never passed one — so the moment the migration cleaned
`composerName`, the 2019-12-15 programme rendered **the same line twice**:

```
Tchaikovsky, Pyotr Ilyich   The Nutcracker Suite
Tchaikovsky, Pyotr Ilyich   The Nutcracker Suite
```

Which is precisely the failure `app/routes/concert.tsx` had written down as the
reason the byline exists. The URLs still differed; the visible text did not. The
data migration and the rendering were **one change wearing two hats**, and
splitting them across tickets would have shipped that.

So AWK-23 also threaded `arrangerName` and `arrangementType` through the sweep
onto both `ProgramEntry` and `Work`, and taught `byline` the four verbs. The
surname comes from the arranger's `lastName` rather than `sortName`, because the
seventeen surname-only records are identical either way but Ravel files as
`Ravel, Maurice` — and "orch. Ravel, Maurice" puts a filing name in a sentence.

The work page renders the credit **outside** the link to the composer, since the
arranger is a different person and this record gives them no page to point at.

**The build assertion this record called for now exists.** "Contentful cannot
express 'required if the other is present', so this is asserted in the build" was
still unwritten; it is `arranger-needs-a-type` in `app/lib/invariants.ts`, the
eighth check. It fires in **both** directions, because a type with no arranger is
the half that reads as harmless — the credit silently disappears instead of
rendering wrong, which is how it would survive review.

### One trap this record did not anticipate

`backfill_slugs.py` derived each arrangement's slug suffix from the **composer's
contaminated `sortName`**, because `work.arranger` was empty when it was written.
This migration empties that source and fills `work.arranger` instead, so the
script had to be taught to read the new field first and fall back to the name
only for the 12 pre-tenure records. Left alone it would have recomputed
`the-nutcracker-suite` for Ellington's, colliding with Tchaikovsky's original on
`(composer, slug)` now that both sit under one merged record — caught by its own
pre-write collision check, but permanently blocking the script. Fixed under
AWK-23.
