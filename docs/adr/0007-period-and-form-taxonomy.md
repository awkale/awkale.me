---
status: accepted
---

# Period and form taxonomy for the performance history

`genre` is retired and replaced by two independent axes. **Period** is the
stylistic era a piece belongs to, held on `composer` and overridable on `work`,
taking IMSLP's nine-value vocabulary verbatim. **Form** is what kind of piece it
is, held on `work` as a multi-valued tag set. Both are stored in Contentful,
both are seeded once by script, and neither is routed — they join Conductor and
Hall as browse filters.

## Genre was never a genre

The field this replaces is not a classification of music. It is **the form word
in the title**, assigned by a first-match-wins regular expression over work
titles, so it can only ever categorise a work that names its own form.

That produces three failures, and the ticket that opened this question saw only
the first.

**A third of the repertoire is uncategorised, and it is the wrong third.** 104 of
the 322 played Works carry no genre — not because the data is incomplete, but
because their titles state no form. The list is disproportionately the canonical
repertoire: *Boléro*, *Scheherazade*, *Pictures at an Exhibition*, *The Planets*,
*An American in Paris*, *Adagio for Strings*, *Pines of Rome*, *Peter and the
Wolf*, *Das Lied von der Erde*, *The Lark Ascending*. Filling these in by hand is
not a backfill — it is inventing a category for *Boléro*, 104 times.

**Where it does fire, roughly 6% is wrong.** The `Aria` bucket holds 13 Works and
is not about arias: the pattern `,\s*from\b` matches any excerpt, so it captured
Bernstein's *Symphonic Dances from West Side Story*, Prokofiev's *Romeo and
Juliet Suites*, Tippett's *Ritual Dances* and Saint-Saëns' *Bacchanale*. About
four of the thirteen are arias. Meanwhile `Ballet` holds two Works while some
fifteen ballets sit under `Suite` — *Firebird*, *Nutcracker*, *Daphnis*,
*Appalachian Spring*, *Billy the Kid*, *Coppélia* — because their titles say
"Suite" and Suite is tested first.

**And it does not spread.** Four buckets hold 80% of everything categorised —
Symphony 58, Concerto 47, Suite 36, Overture 33, out of 218 — while six of the
fourteen live buckets hold four Works or fewer, and Cantata and Mass hold exactly
one each. Three of the four large buckets restate a word already visible in the
title of the page being read.

## Period is the axis worth browsing

Period is sourced from [IMSLP](https://imslp.org), whose controlled vocabulary is
adopted **verbatim**, without translation:

`Ancient` · `Medieval` · `Renaissance` · `Baroque` · `Classical` · `Romantic` ·
`Early 20th century` · `Modern` · `Jazz`

It passes the test [ADR-0006](0006-performance-history-content-model.md) applied
when it dropped Season as a surface: it describes the music rather than the
institution. And it beats form on every measure taken:

| | form (`genre`) | period |
| -- | -- | -- |
| Coverage of the 322 played Works | 68% | ~90% after name matching |
| Buckets in use | 14, four holding 80% | 6, well spread |
| Correctness | ~6% actively wrong | derived from a curated source |
| The canonical repertoire | systematically absent | covered |

Measured distribution over the played Works: Romantic 127, Early 20th century 90,
Modern 23, Classical 15, Baroque 3, with 64 unresolved. Around twenty of those 64
are name-matching failures rather than absences — Mozart, Dvořák, Haydn, Chopin,
Bartók, Prokofiev and Rimsky-Korsakov all have IMSLP pages and were rejected by
an over-strict first-name rule.

## Period is inherited from the Composer and overridden on the Work

IMSLP exposes the fact twice, at different granularities and different quality.

**The Composer page carries `People from the X era`**, and it is well populated —
present on 108 of the 113 Composers matched. Reading period here means matching
148 names rather than 322 titles, which matters because name matching is far more
tractable than title matching.

**The Work page carries `X style`**, which is accurate but sparse. It correctly
distinguishes Beethoven's First Symphony (`Classical`) from his Ninth
(`Romantic`) — exactly the nuance a composer-level field loses. But it was absent
on five of eight canonical works probed, including *The Firebird*, the Tallis
*Fantasia*, Schubert's Fifth, Shostakovich's Fifth and *Les préludes*, all of
which are live pages.

So the Composer supplies the base and the Work overrides it where it disagrees.
Inverting that dependency — Work as the source, Composer as the fallback — would
produce a mostly-empty field.

The override is not hypothetical. Ellington's *Nutcracker* is a Work whose
Composer is Tchaikovsky, so it inherits `Romantic` and must be corrected to
`Jazz`.

## Form survives, as a tag set

Form is kept as a second axis and moved from a single link to **an unordered set
of tags**. This is what repairs the misfiling, and it repairs it without
adjudication: the *Firebird Suite* becomes `[Suite, Ballet]` rather than forcing
a choice between them. The single-valued field got that choice wrong roughly
fifteen times by answering "whichever word appeared first in the title".

It also matches the source. IMSLP files *Boléro* under both `Boleros` and
`Dances`.

Form is permitted to stay incomplete in a way period is not. Period carries the
browse load; form is a refinement, so a Work with no form tags is not a defect.

The existing seventeen `genre` entries are reused as the starting vocabulary and
extended during curation — `Tone Poem`, `Dance`, `Song cycle`, `Oratorio`,
`Excerpt`, `Capriccio`, `Chamber work` and `Film music` are the additions the 104
uncategorised Works call for, with `Ballet` finally populated. This record fixes
the mechanism, not the enumeration.

`Excerpt` is where the `Aria` bucket's accidental discovery lands. "Is this drawn
from a larger staged work" is a real fact about a Work that the data records
nowhere else, and it is orthogonal to form rather than a value of it — which is
precisely why a tag set can hold it and a single field could not.

## Neither axis is routed

Period and Form are **filters**. Routed surfaces remain Composer, Work and
Concert, exactly as [ADR-0006](0006-performance-history-content-model.md) fixed
them, and the filter set grows from two to four: Conductor, Hall, Period, Form.

The published page count is therefore unchanged — 121 Concerts, 322 Works, 148
Composers, 591 routed pages, roughly 597 with indexes, plus N.

## IMSLP is a seed, not a dependency

A one-time script performs the match and writes the results into Contentful.
**IMSLP is never consulted at build time.**

Three reasons. The prerender must stay hermetic, because
[ADR-0001](0001-url-structure.md)'s enumeration failure mode is silent — a route
missing from the path list serves an empty shell rather than an error. Netlify
meters deployments, so a build that depends on a third-party wiki is a build that
can fail for reasons outside this repository. And corrections made by hand must
survive; a build-time fetch would overwrite them on the next deploy.

Access is confirmed working. IMSLP runs MediaWiki, so
`imslp.org/api.php?action=query&prop=categories&titles=…` returns both the
Work's `X style` and the Composer's `People from the X era` category. A separate
endpoint — `API.ISCR.php` with `type=1` — enumerates all 55,263 Composer pages,
which allows the whole name match to be computed offline rather than by probing.

Form can be partly harvested the same way, from Work categories such as
`Symphonic poems`, `Boleros`, `Dances`, `Capriccios` and `Scherzos`. But IMSLP's
category namespace is flat and mixed with operational junk — `OM Parts`,
`Sibley Mirroring Project`, `Manuscripts`, `Scordatura`, `Quintuple time` — so
harvesting requires an explicit whitelist rather than taking every category.

## Schema

```
composer  (existing type; listed fields are the additions)
+ period       Symbol, in [Ancient, Medieval, Renaissance, Baroque, Classical,
               Romantic, Early 20th century, Modern, Jazz]

work      (existing type; listed fields are the additions)
+ period       Symbol, same `in` list, optional — overrides composer.period
+ forms        Array<Link genre>, optional, unordered
- genre        Link<genre> — removed after migration
```

`period` follows the `in`-validated symbol precedent set by
`soloist.instrument`; `forms` reuses the linked-entity `genre` records, changing
only their cardinality and their name at the point of use.

## Considered options

**Drop genre entirely and add nothing.** The cheapest answer, and defensible on
the evidence — a field 32% empty and 6% wrong, whose largest buckets restate the
title. Rejected because `/concerts` is a reference library and period is a
genuine way to browse a repertoire, not an artifact of the source data.

**Hand-curate the 104 and keep form as the sole axis.** Rejected because it
mistakes taste for data entry, and because it leaves the axis structurally unable
to categorise any work whose title does not name a form — the problem recurs with
every future addition.

**Period from the Work only.** Rejected on measured sparsity; see above.

**Period from the Composer only.** Simpler, needs no title matching at all, and
loses every transitional case — Beethoven's Ninth, Ellington's *Nutcracker*.
Rejected because the override is cheap to express and the cases are real.

**Form as a single value with separate booleans** for cross-cutting facts such as
is-an-excerpt. Rejected as two mechanisms where one suffices.

**Period as a routed surface** at `/concerts/periods/romantic`. Rejected for
consistency with ADR-0006: filters do not get URLs.

## Consequences

**This amends [ADR-0005](0005-composer-identity-and-arrangements.md)**, which
states that `composer` gains no new fields. `composer.period` breaks that. The
rest of ADR-0005 is untouched.

**`work.genre` cannot be changed in place.** Contentful does not permit altering
an existing field's type, so moving from `Link` to `Array<Link>` is a new field,
a migration, and a delete — not an edit. This is the same class of limit as the
conditional-validation gaps already recorded on `sideBySide`
([ADR-0004](0004-design-system-and-tokens.md)) and `satOut`
([ADR-0006](0006-performance-history-content-model.md)).

**Title matching is lossy and cannot be assumed complete.** Two of ten probes
missed using IMSLP's own spellings, because the archive holds `Scheherazade` and
`The Moldau` where IMSLP files *Shéhérazade* and *Má vlast*. Both the per-Work
override and the form harvest need a manual verification pass.

**Roughly 25 to 30 Works are absent from IMSLP entirely** — the world premieres
and the living composers, among them Greenhoe, Mackey, Zwilich, Frank, Stookey,
Viens and Sedivec. These are assigned by hand, and trivially: a 2019 premiere is
`Modern` without research.

**Keeping both axes is the more expensive answer.** The 104 form assignments are
real work. It is defensible because period carries the browse load while form may
stay incomplete, but nothing else in the spec is blocked on that curation.

**The seeding pass is also the cheapest moment to restore diacritics.** The
archive holds none — exactly one non-ASCII string across 1,228 Composer, Work,
Hall, Soloist and Conductor records — so it stores `Dvorak`, `Saint-Saens`,
`Bartok` and `Faure`. IMSLP files Composers in `Lastname, Firstname` form with
correct diacritics, so the match returns canonical spellings as a byproduct.
Whether display names are stored or derived belongs to the open question of where
slugs come from; slugs fold to ASCII either way, so `dvorak` is unaffected.

**Both the composer merge and this seed mutate the same records.** ADR-0005's
merge deletes and recreates Composer entries, so the period seed must run after
it or be redone.
