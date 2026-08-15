---
status: accepted
---

# Where archive URL slugs come from

Archive slugs are **stored in Contentful**, not derived at build time. `composer`
and `conductor` gain a `slug` field; `work.slug` is repurposed in place, its 625
hashed values overwritten with the clean form; `hall.slug` is kept as it stands.
Every Arrangement's slug carries its Arranger's surname, unconditionally.
`unique: true` is removed from `work.slug` and replaced by a build assertion on
the invariant that actually holds — `(composer, slug)`.

[ADR-0001](0001-url-structure.md) settled what the slugs look like. This settles
where the strings come from, which the live schema could not supply: only `work`
and `hall` had a `slug` field at all, and the one that was populated held the
wrong value.

## Stored, not derived

Deriving was the recommendation and was rejected.

The trade is usually framed as editorial control against never drifting out of
sync. It resolved on a narrower observation: the archive is exactly the place
where a **name correction** and a **URL** should be able to move independently.
[ADR-0007](0007-period-and-form-taxonomy.md)'s IMSLP pass is the cheapest moment
to restore composer diacritics, and a stored slug lets `Dvorak` become `Dvořák`
without touching a single address. A derived slug would have coupled them —
correctly, and for no benefit, since the slug folds to ASCII either way. The
coupling buys nothing and costs the ability to pin a URL.

The cost is accepted and is the mirror image: correcting a typo in `lastName`
will not update the slug, and nothing in Contentful will say so.

## `unique: true` is the wrong constraint, and it is what caused the hash

`work.slug` carried `unique: true`. That is **space-wide**, but the invariant the
URL scheme needs is **scoped to the composer** — and Contentful cannot express a
scoped unique. This is the same conditional-validation limit
[ADR-0004](0004-design-system-and-tokens.md) hit on `sideBySide` and
[ADR-0006](0006-performance-history-content-model.md) hit on `satOut`, met a
third time.

Nine title families collide globally, across 20 records:

| Slug | Records |
| --- | --- |
| `violin-concerto-in-d-major` | 4 |
| `violin-concerto-in-d-minor` | 3 |
| `symphony-in-c-major` | 3 |
| `symphony-no-2` | 3 |
| `symphony-no-2-in-d-major` | 3 |
| `symphony-no-5-in-b-flat-major` | 2 |
| `piano-concerto-in-a-minor` | 2 |
| `trumpet-concerto` | 2 |
| `sleigh-ride` | 2 |

ADR-0001 knew the title families collide and treated it as a URL problem that
nesting solves. It does solve the URL problem. It does not solve it for a stored,
globally-unique field — Sibelius's and Rachmaninoff's *Symphony No. 2* both want
to hold `symphony-no-2`, and Contentful rejects the second.

**Keeping a space-wide constraint over a composer-scoped invariant is precisely
what forced the importer to hash in the first place.** Removing it undoes the
root cause rather than working around it. Under the final rules all 625 works
produce 625 distinct `(composer, slug)` pairs, with zero collisions.

## Every arrangement carries its arranger

Not only where it collides. A collision-only rule is unstable in a way that
defeats the entire point of storing slugs. Ravel's *Pictures at an Exhibition* is
in scope and Mussorgsky's piano original is **not in the archive at all**, so
under a collision-only rule the arrangement holds the bare
`pictures-at-an-exhibition`. Add the original later and either it takes the suffix
— inverting the rule — or Ravel's live URL changes.

| Slug | |
| --- | --- |
| `the-nutcracker-suite` | Tchaikovsky, original |
| `the-nutcracker-suite-ellington` | Ellington arrangement |
| `kindertotenlieder` | Mahler, original (pre-tenure) |
| `kindertotenlieder-roven` | Roven transcription |
| `pictures-at-an-exhibition-ravel` | stable if the original is ever added |

Roughly 25 in-scope URLs get longer in exchange for a rule that cannot invert.
37 works archive-wide carry arranger text; three pre-tenure records say a bare
`(arr.)` with no arranger named, so there is nothing to append — they keep the
bare title slug and collide with nothing.

The suffix is the **surname only**. ADR-0005's four-verb distinction is rendered
on the page, where it is legible; `-orch-ravel` puts an abbreviation in an
address for no gain.

## The Dutch/European rule for nobiliary particles

`sortName`'s second contaminant is resolved by **relocating** the prefix to the
back, not by dropping it: sort by the main root of the surname, prefix trailing.

| Current | Corrected | Slug |
| --- | --- | --- |
| `van Beethoven, Ludwig` | `Beethoven, Ludwig van` | `beethoven-ludwig-van` |
| `von Weber, Carl Maria` | `Weber, Carl Maria von` | `weber-carl-maria-von` |
| `de Falla, Manuel` | `Falla, Manuel de` | `falla-manuel-de` |
| `de Sarasate, Pablo` | `Sarasate, Pablo de` | `sarasate-pablo-de` |
| `von Suppe, Franz` | `Suppe, Franz von` | — (pre-tenure) |

Relocating beats stripping because nothing is discarded: the display name stays
reconstructible from `sortName` alone. All five prefixes are lowercase in the
data, so the rule applies uniformly with no capitalized-particle exception to
encode.

Display is untouched — it renders from `firstName` + `lastName`, which keep the
particle in place. What changes is that **`sortName` becomes genuinely the sort
key**, rather than a field whose name promises sorting while sorting must happen
somewhere else. That trap shape — a populated field whose name lies — is what
earned this decision its own ticket, and leaving a second instance of it in place
would have been the wrong trade.

Four in-scope composers stop filing under v/v/d/d. None of the five corrected
values is already taken, so `unique: true` on `sortName` does not obstruct the
update.

## Honorifics are a third contaminant on composer identity

[ADR-0005](0005-composer-identity-and-arrangements.md) removed arranger text from
`composer.firstName` and states explicitly that it does not touch `lastName`,
leaving the particles as a second, independent problem. There is a **third**, and
it is worse than the particles because it splits a person rather than misfiling
them.

**Walton exists twice**, split by an honorific, with played Works on both sides:

| Record | Works | Performed |
| --- | --- | --- |
| `cmp-walton-sir-william` | Concerto for Viola and Orchestra | 2009-12-20 |
| `cmp-walton-william` | Belshazzar's Feast · Music from Façade Suite Nos. 1 and 2 | 2015-04-23/26 · 2017-02-19 |

So he currently gets **two composer pages, each holding part of his repertoire**
— the exact failure ADR-0001 named as the cross-reference axis quietly lying,
arriving through a route ADR-0005 does not close.

**Sullivan has the identical split, and is why this stayed invisible.**
`Sullivan, Sir Arthur` holds *Overture, The Yeomen of the Guard*;
`Sullivan, Arthur` holds *Overture di Ballo* — and that performance is
2024-06-09, one of the six Concerts Alex missed. The second record therefore has
no published page, so the split self-cancelled and appeared in no count.

### The composer page count is 147

Recomputing the published set from `docs/archive/participation-checklist.md`
— 127 seeded Concerts less the 6 missed, less the 4 sat-out items, then Works
with at least one qualifying pair and Composers with at least one qualifying Work:

| | ADR-0006 | Recomputed |
| --- | --- | --- |
| Concerts | 121 | **121** |
| Works | 322 | **322** |
| Composer records | — | 161 |
| Composer people | 148 | **147** |

Concerts and Works reconcile exactly. The single discrepancy is Walton, counted
twice by every figure from ADR-0006 onward. **148 becomes 147, and 591 routed
pages becomes 590 — roughly 596 with indexes, plus N.** ADR-0006 has been
corrected in place.

### Merge, and let the schema guard the class

The two pairs are merged in the shape ADR-0005 uses for arranger duplicates,
surviving on the clean-named record so the honorific leaves the URL. Sullivan's
page moves from `sullivan-sir-arthur` to `sullivan-arthur`; the count is unchanged
at 147, because only one of his records ever had a page.

The slug rule additionally **strips `Sir` and `Dame`**, which turns `unique: true`
on `composer.slug` into an active guard: a future `Sir X` alongside an existing
`X` derives the same slug and is **rejected at publish**, rather than silently
shipping a second half-empty composer page. Converting a silent site bug into a
schema error is worth one entry in a token filter.

**Generational markers are kept.** `Sr.`, `Jr.`, `II` and `III` are not
honorifics — they are the only thing distinguishing two real people.
`Strauss, Johann Sr.` and `Strauss, Johann II` are father and son. Stripping `Sr.`
yields `strauss-johann`, which happens not to collide today only because no bare
`Strauss, Johann` record exists; with four Strausses in the archive that is a
false merge waiting for one new entry. The strip list is `sir | dame` and nothing
more.

## Facets get slugs only where they filter

Filter state lives in the query string, so a filtered view is linkable — which is
what a section that exists as Alex's own lookup tool wants:

```
/concerts?conductor=slatkin-leonard&hall=walt-whitman-hall
```

ADR-0006 fixed the filters at Conductor (16) and Hall (5). `conductor` gains a
`slug` (37 records, no collisions); `hall` keeps the one it has, populated 13/13
with `slugify(name, 60)` — the correct clean form, never contaminated. Its name
tells the truth, which is why it is kept rather than rebuilt.

Soloist, Ensemble, Orchestra, Season and `genre` get nothing. ADR-0007's `period`
and `forms` are controlled symbols over a fixed vocabulary, so their filter values
are slugified in the query string from code with no stored field. The line is
**stored slugs for entities, derived slugs for controlled vocabularies.**

## Schema

| Type | Field | Change |
| --- | --- | --- |
| `composer` | `slug` | new — Symbol, `unique: true` |
| `conductor` | `slug` | new — Symbol, `unique: true` |
| `work` | `slug` | `unique: true` **removed**; 625 values overwritten |
| `hall` | `slug` | unchanged |

`composer.slug` keeps `unique: true` deliberately, as the honorific guard above.
`conductor.slug` keeps it too; two real conductors sharing a name would be
blocked, which is accepted at 37 records and is the same guard working.

## Considered options

**Derived slugs** were the recommendation, and remain the better answer on every
axis except the one that decided it — see above. They would also have made the
pre-tenure *Kindertotenlieder* collision evaporate, since a derived slug need only
be unique across the 322 published Works and the Mahler original is not among
them. A stored slug must be unique across all 625, so that pair needs a
disambiguator for a page that does not exist. Accepted as a real cost.

**Storing a composer-prefixed value** to keep `unique: true` — saving
`sibelius-jean--symphony-no-2` and cutting at the `--` to get the URL segment —
was rejected because the field then is not the thing it names, and every reader
must know to split it. That is the `work.slug` trap rebuilt in a new shape.

**Disambiguating the 20 colliding Works by opus or catalogue number** was
rejected as 20 hand judgements against a field that does not exist and would have
to be populated, with some of the pieces having no number recorded at all.

**Deleting `work.slug` and adding a differently-named field** was the clean break
and was rejected as a schema migration plus a transition window with two unique
fields, to buy a rename.

**Stripping the particle** rather than relocating it was proposed and initially
accepted, then corrected: it discards data, and it leaves the display name no
longer reconstructible from `sortName`.

**Client-side-only filters** would have removed the need for any facet slug and
made `hall.slug` dead. Rejected because no filtered view could then be shared or
bookmarked and browser back would not undo a filter, on the section that exists
to be looked things up in.

**Keying filters by entry id** needed no new field and is already unique.
Rejected on readability, and because the ids are not uniform: Walt Whitman Hall is
`4ej6X1ysgy6FlHGz7QsQYX` while the rest are `hal-*`, so the URLs would leak an
import convention inconsistently.

## Consequences

**The parser keeps emitting the hashed form, so anything an import creates needs
re-cleaning.** `parse_archive.py` is deliberately left alone. The exposure is
bounded more tightly than that sounds: `import_to_contentful.py`'s `OVERRIDE` set
is exactly `{("concert", "program")}`, so an import never overwrites a non-empty
`slug`. The exposure is therefore **only entries an import creates** — 13 Work
entries from the pending re-import — not all 625. The standing rule is
consequently narrower than "re-backfill after every import": **backfill any entry
an import creates.**

**The build assertion rejects any slug still in the hashed shape.** Because the
above is invisible when it happens, the assertion checks for `--` followed by six
hex characters as well as checking `(composer, slug)` uniqueness. This converts
silent drift into a build failure, and is what makes leaving the parser alone safe
rather than merely bounded.

> **"`--` followed by six hex characters" describes a shape the data does not
> hold, and an assertion written to it would never have fired.** Recorded while
> [AWK-39](https://linear.app/awkale/issue/AWK-39/point-the-build-at-the-cda-and-wire-the-invariant-assertions)
> implemented it. The importer's real form is
> `<composer>--<title>-<6hex>` — `rachmaninoff-sergei-arr--cinq-etudes-tableaux-5bd833`
> — so the hash trails the *title*, it does not follow the separator. Measured
> across all 625 live values: **625 contain `--`, 625 end in `-[0-9a-f]{6}`, and
> zero match `--[0-9a-f]{6}`.**
>
> `app/lib/invariants.ts` therefore checks **both markers independently**, since
> either half alone is still not an address to ship. The `--` half cannot
> false-positive, because slugify collapses runs of non-alphanumerics to a single
> dash and a clean slug never holds two. The trailing-hex half can, in exactly one
> shape: a title whose last word is six letters drawn from a–f. *Façade* is the
> live near-miss, surviving only because the archive holds it as
> "Music from Façade Suite Nos. 1 and 2". Kept anyway — a loud failure on a real
> title is recoverable, and a hashed slug shipping silently across ~600 addresses
> is the thing the assertion exists to stop.

> **The collision figures have moved: 10 families across 26 records, not 9 across
> 20.** Recounted from the live space under AWK-39 by cleaning all 625 slugs and
> tallying space-wide duplicates. The record's table above is the state at the
> time it was written; the archive has grown since. The composer-scoped invariant
> is unaffected and holds exactly — **623 works with a composer produce 623
> distinct `(composer, slug)` pairs, zero collisions.** The other two works carry
> no composer link at all and so have no canonical address; they are
> [AWK-38](https://linear.app/awkale/issue/AWK-38/fix-the-three-archive-data-gaps)'s.

**Write the assertion before removing `unique: true`.** Otherwise there is a
window in which nothing protects the invariant at all.

**Sequencing is fixed, and the middle step is not optional.** Re-import
([AWK-20](https://linear.app/awkale/issue/AWK-20/re-import-the-archive-after-the-shares-fix-and-clean-up-13-orphaned)),
then the composer merge
([AWK-23](https://linear.app/awkale/issue/AWK-23/merge-the-split-composer-records-and-populate-the-arranger-fields)),
then the slug backfill. The merge **creates 24 composer records**, so
`composer.slug` must be written *by the merge script* rather than by a later pass
— a separate backfill would be written against records that did not yet exist.

> **The sequencing deadlocked, and AWK-39 broke it by splitting the merge in
> two.** AWK-39 needs stored slugs to enumerate a single composer or work page,
> and AWK-23 had not been scheduled — so the build could not be pointed at the CDA
> at all. The unblocking observation is that the two merges this record names are
> *different in kind* from the 25 ADR-0005 names:
>
> * The **honorific** merges (Walton, Sullivan) are **forced**. The slug rule
>   strips `Sir`, so both halves of each pair derive one slug, and
>   `composer.slug` carries `unique: true` — the second publish is rejected. There
>   is no backfill at all without resolving them, and this record already
>   specifies the resolution exactly. `scripts/contentful/backfill_slugs.py` does
>   them: repoint the works, then archive the honorific record.
> * The **arranger** merges (25 records reading `(arr. by Respighi)` and similar)
>   are **editorial**, involving judgements this record does not make — e.g.
>   `English Carol (arr. by Davis/orch. Armstrong)` and
>   `Salzman, Eric and Eger, Joseph (arr.)`. They stay in AWK-23. They slug
>   validly, if ugly, and they are the entire gap between **161 composer records
>   and this record's 147 people**.
>
> So the published composer count is **160 today, thirteen above the 147 this
> record computes**, and it converges when AWK-23 runs. The Concert and Work
> figures are unaffected — 121 and 322, exactly as computed above. The rule about
> writing `composer.slug` from the merge script still holds for the records AWK-23
> creates.
>
> **160 rather than 159, because only the Walton merge removes a page.** The
> qualifying set held 161 composer *records*; merging `Walton, Sir William` into
> `Walton, William` collapses two pages into one, and merging `Sullivan, Sir
> Arthur` into `Sullivan, Arthur` collapses none — the works simply move onto the
> clean record, which had no page before because its own performance was one of
> the six Alex missed. That is this record's own "the split self-cancelled and
> appeared in no count", observed from the other side.

**AWK-23's scope grows.** It now also merges Walton and Sullivan, and performs the
five `sortName` relocations. Neither was in ADR-0005's account of the work, and a
sweep matching only `(arr. by …)` finds neither.

**Stored slugs drift from names by design.** That is what they are for. But the
IMSLP pass restores diacritics across the composer table, so any "the slug no
longer matches the name" warning must compare accent-folded, or it fires on every
accented composer and is learned to be ignored.

**The importer writes every non-null key generically.** `build_fields` iterates
the graph record, so what the parser emits is what lands in Contentful,
field-for-field. There is no allow-list to add a field to — which is why the
parser's output is the thing to reason about, not the importer's.

**Nesting is sound even though the flat field is not.** `(composer, slug)` is
unique across all 625 Works while `slug` alone collides on 20. Anything that
resolves a Work must carry the Composer with it; a lookup by slug alone has up to
four answers.
