---
status: accepted
---

# Content model for the performance history

Participation is two optional fields on the existing `concert` type — `attended`
and `satOut` — and it is **positively asserted** rather than inferred from a date.
`/concerts` publishes only what Alex performed: a Concert gets a page when
`attended` is true, a Work gets one when he played it on at least one occasion,
and nothing that he sat out is surfaced anywhere. No new content type, and no
performer entity.

## The section is a repertoire, not an archive

This record exists because the question it answers was posed backwards. The
ticket asked how to represent participation *on top of* the concert archive,
which framed the archive as the subject and Alex's involvement as an annotation
on it.

It is the other way round. The section exists to say **"I played Beethoven's
Fifth Symphony in 2012"** — the atomic claim is a work, a date, and a first
person. The Brooklyn Symphony Orchestra's institutional record is *substrate* for
that claim, one source among future others, and the orchestra can publish its own
programs. [ADR-0001](0001-url-structure.md) already called the section personal;
this makes it operative, because it decides what gets a page.

Everything below follows from that inversion, including the two decisions that
would otherwise look over-strict: that unmarked data publishes nothing, and that
a sat-out work is omitted rather than annotated.

## Participation is asserted, never inferred

`attended: true` is set explicitly on every Concert Alex played. **The build
reads no dates.**

The alternative — treat `date >= 2001-05-24` as the scope filter and record only
the exceptions — was the working assumption for most of this map's life, and it
survives only while the space holds exactly one source. It breaks in both
directions the moment a second arrives, and a second is planned: Alex intends to
add pre-BSO youth-orchestra programs. Those fall *outside* the window while being
performances, and the 119 pre-tenure BSO concerts sit *inside* the database while
not being performances. A date window cannot separate them, and bolting a second
window on per source multiplies the special cases forever.

Positive assertion also has a property no window has: **it fails closed.** An
import can only ever add rows that publish nothing, because nothing publishes
until a human marks it. That is the guarantee worth having on a space whose bulk
loading is done by script.

So `attended` carries three meaningful states, not two:

| Value | Meaning | Publishes? |
| --- | --- | --- |
| `true` | Alex played this Concert | yes |
| `false` | he was in the orchestra and missed this date | no |
| unset | not his history — the 119 pre-tenure seed entries | no |

`false` and unset both publish nothing, and the distinction is still worth
keeping: `false` is a considered judgement about a date he could have played,
unset is a row he was never part of. Collapsing them would lose the record of
which concerts were actually reviewed.

This demotes **2001-05-24 from a rule to a seeding convenience.** It is how the
first 127 flags get their value, and it is read nowhere afterwards. The date and
its robustness are still recorded in
[AWK-10](https://linear.app/awkale/issue/AWK-10/list-the-concerts-i-missed-in-seasons-28-52);
they simply no longer govern anything at build time.

## The join is expressed by which Concert holds the link

Participation is per piece, and
[AWK-10](https://linear.app/awkale/issue/AWK-10/list-the-concerts-i-missed-in-seasons-28-52)
established why it cannot be a field on `programItem`: **seven in-scope programs
were performed on two dates each and share one set of `programItem` entries.**
Twenty items are shared this way, across fourteen Concerts. A flag on the item
cannot distinguish night one from night two, and sit-outs genuinely differ
between nights.

`satOut` on `concert` satisfies that requirement structurally rather than by
adding a type. The two nights are two `concert` entries, each holding its own
`satOut` array, so they diverge freely while pointing at shared items. The
`(concert, programItem)` pair is identified by *which entry the link lives on* —
there is no composite key to construct.

That also means AWK-10 ruled out slightly more than it needed to when it
dismissed "a boolean on `concert`". A lone boolean is genuinely insufficient; a
boolean *plus a link array* on the same type is not.

**Read the Concert from the link's owner, never from the item's id.** Program-item
ids are positional and derived from the concert id, and a run's second night
carries the *first* night's ids — `cnc-20070523` links `pi-20070520-*`. Anything
inferring a date from an id prefix misattributes those twenty items.

## What publishes

| Surface | Rule |
| --- | --- |
| Concert page | `attended == true` |
| Work page | at least one pair where `attended` **and** the item is not in that Concert's `satOut` |
| Composer page | at least one qualifying Work |

**The Work rule is per pair, not per Work.** Of the 348 in-scope works, 294 were
played once, 52 twice and 2 three times. Sitting out one performance of a work
played at another must not erase it, so the rule quantifies over occasions and
takes the disjunction.

Both axes cut. A missed Concert removes its page and any Work reachable only
through it; a sat-out item removes the Work if that was its only performance.
Letting `satOut` merely annotate was the runner-up and is rejected below.

**Today that yields 121 Concerts, 322 Works and 148 Composers — 591 routed pages,
roughly 597 with indexes, plus N case studies** — against 127 / 348 / 156 for the
full in-scope archive.

> **Corrected to 147 Composers by
> [ADR-0008](0008-archive-slug-source.md).** Walton is one person split across two
> records by an honorific — `Walton, Sir William` and `Walton, William` — and both
> halves hold played Works, so every figure from this record onward counted him
> twice. The Concert and Work counts are unaffected and reconcile exactly. **590
> routed pages, roughly 596 with indexes, plus N.**

The two axes cost different things, which is worth seeing separately:

| Marked | Concert pages | Work pages | Composers |
| --- | --- | --- | --- |
| 6 Concerts missed | −6 | −22 | −8 |
| 4 items sat out | 0 | −4 | 0 |

The sit-outs remove four Works because each was the only performance of that
Work; none of their Composers disappear, since Haydn, Strauss and Stravinsky all
have other Works he did play. That is the per-pair rule doing exactly its job —
had any of the four been played on another date, the sit-out would have removed
nothing.

**This replaces a fixed page count with a rule.** ADR-0001 quoted a figure;
there is now no figure to quote, because the count moves — down as the
participation checklist is filled in, up as pre-BSO programs are added. Anything
that needs the number must compute it from the same rules above.

## Surfaces

Concerts, Works and Composers are routed, as ADR-0001 set out. Of the remaining
dimensions, **Conductor and Hall are browse filters; Soloist and Ensemble are
credits that display but do not filter.**

Restricting the page set to what Alex played is what makes the filters worth
having. **16 conductors and 5 halls** read as one player's career; the
archive-wide 37 and 13 read as an institution's history. Soloist is the
instructive rejection — 144 distinct names sounds like the richest facet
available, but **256 of the 404 pairs have no soloist at all**, so as a filter it
would be empty across two-thirds of the library while remaining essential as a
per-item credit. Cardinality was the wrong measure; coverage was the right one.

**Season is dropped as a surface entirely.** This is the one facet cut on
scoping rather than data quality: it is complete, 25 seasons appear in scope, and
it is still removed, because a numbered season is a property of the orchestra's
calendar and means nothing for a youth-orchestra date or anything else added
later. `concert.season` stays on the type and stays populated for BSO entries; it
is simply never rendered. **The chronological spine is the date, grouped by
year** — the one temporal key every source can supply.

Genre is deliberately left open, as
[AWK-13](https://linear.app/awkale/issue/AWK-13/decide-the-genre-coverage-policy-for-my-348-works).
Under the published set the gap is **104 of 322 works, 32%**, with 14 of the 17
genres appearing at all.

## Rendering

**Work pages assert it — "I played this"** — with the date, conductor and hall as
provenance.

The hedged alternative ("on a program I played") was adopted first and then
reversed, and the reversal is worth recording because it was *earned* rather than
preferred. The hedge was proposed on a real asymmetry: whole-concert absences are
recallable and that axis can converge on complete, while individual sit-outs
mostly are not, so `satOut` will always be under-reported. But once sat-out works
are excluded from the page set altogether, every Work page that exists is a work
Alex played. The strict rule above is what buys the plain claim; with a laxer
rule the hedge would have been mandatory.

**Concert pages list only what he played.** A sat-out work is omitted, not marked.
Shown-but-unmarked and shown-with-a-marker were both considered on the argument
that a Concert page documents an event and a program with holes misrepresents it
— which is correct about events and wrong about this page, whose subject is
Alex's appearance on that date. Listing a work he sat out would put music in his
record that is not his.

Review state is **not** tracked. Distinguishing "reviewed and played" from "not
yet considered" requires writing to every played Concert, which is 121 writes and
defeats the seeding that makes this model cheap. The under-reporting of `satOut`
is therefore a known and accepted limitation rather than a modelled one.

**The first pass of real sit-out data suggests the asymmetry is milder than
feared, though.** All four items marked are wind pieces — Haydn's *Divertimento
(Feldparthie)*, Strauss's *Serenade for 13 Winds*, Stravinsky's *Octet for Winds*
and Strauss's *Sonatina No. 1 for Winds*. They were not recalled individually so
much as **derived from instrumentation**: a piece scored without Alex's section is
a piece he did not play, which is a rule he can apply to a program he barely
remembers. That makes `satOut` far more tractable than "what do you remember about
a Thursday in 2004" implies, and it means the residual risk is concentrated in
ordinary absences from otherwise-scored works rather than spread across all 404
occasions.

## Schema

Two optional fields added to `concert`. No other type changes.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `attended` | Boolean | no | `true` published, `false` missed, unset not-his-history |
| `satOut` | Array\<Link\<`programItem`\>\> | no | items sat out at this Concert; must be a subset of this Concert's `program` |

No performer entity. On a personal site every participation record is implicitly
Alex's, and a shared `person` type spanning composer, conductor and soloist was
already ruled out of scope by
[ADR-0005](0005-composer-identity-and-arrangements.md). No instrument or chair
field either: both were constant across all 127 Concerts, so the instrument is a
site-wide constant stated in copy, and a field that never varies is not data.

## Considered options

**Where participation lives.** A dedicated `participation` type per
`(concert, programItem)` pair — up to 404 entries — is the textbook join and the
only shape in which "played" is asserted per item rather than implied by absence
from `satOut`. It was rejected as 404 entries to author and publish for
information that two fields already carry. A `participation` type per Concert, up
to 127 entries, keeps the personal fact off the institutional `concert` type,
which is a separation this map states elsewhere; rejected because the separation
is notional in a single-tenant space with no other consumer, and
[ADR-0003](0003-portfolio-content-model.md) set the precedent of extending
existing types over adding new ones. A roster or membership concept spanning date
ranges was listed in the ticket and has no application at all — instrument and
chair were constant, and positive assertion removes the date reasoning a roster
would encode.

**What a sit-out does.** Having `attended: false` cut pages while `satOut` only
annotates has a real argument behind it: it puts the structural consequence on
the recallable axis and leaves the unreliable one cosmetic, so the page set stops
moving as sit-outs surface years later. Rejected because it leaves music on the
site that Alex did not play, which is the single thing the section exists not to
do. The cost is accepted knowingly — see Consequences.

**Index defaults.** Publishing all 127 in-scope Concerts with a "did not play"
marker was the initial recommendation, on the grounds that data entry should
never delete URLs and that ADR-0001's count assumed the full set. Rejected on the
reframe: that is an archive with annotations, and the orchestra can publish its
own archive.

## Consequences

**ADR-0001's page count is superseded, and the CI assertion changes shape.**
[ADR-0002](0002-hosting-and-deploy-pipeline.md) and
[ADR-0004](0004-design-system-and-tokens.md) both quote a fixed total; those
numbers now describe the in-scope archive rather than the published site.
ADR-0004's landmine — that an `ssr: false` route missing from the `prerender`
list degrades silently to an empty `HydrateFallback` shell — makes this more than
bookkeeping: the count assertion guarding it **must derive its expectation from
Contentful using the rules above**, because a hardcoded number is now guaranteed
to drift wrong, and the failure it catches is invisible without it.

**Contentful cannot enforce that `satOut` is a subset of `program`.** Array
validations cannot be conditional on another field — the same limit ADR-0004 hit
on `imageGroup.sideBySide`. Unenforced, a sit-out can point at a work that was
never on that program, and it would render as a silently missing item rather than
an error. This must be asserted in the build.

**Data entry now deletes URLs.** Marking a Concert missed removes its page and any
Work reachable only through it — 22 Work pages for the six already marked — and a
sit-out removes a Work outright when it was that Work's only performance, as all
four marked sit-outs were. Before
cutover that is harmless; afterwards it 404s live URLs, and Contentful offers no
confirmation step, so a mistaken `attended: false` is a silent deletion. Two
mitigations, neither of which is a decision: finish
[AWK-19](https://linear.app/awkale/issue/AWK-19/mark-up-the-participation-checklist)
before cutover, and treat later corrections as redirect work under ADR-0002's
`_redirects` mechanism.

**Participation data must be loaded after the pending re-import, not before.**
Program-item ids are positional, so the re-import that applies the `shares` fix
renumbers items on the eight run Concerts — invalidating any `satOut` link already
recorded against them. Tracked as
[AWK-20](https://linear.app/awkale/issue/AWK-20/re-import-the-archive-after-the-shares-fix-and-clean-up-13-orphaned),
which must precede
[AWK-19](https://linear.app/awkale/issue/AWK-19/mark-up-the-participation-checklist)'s
output reaching Contentful.

**One data gap now hides a Concert from a browse filter.** The 2007-12-16
Concert is the only played Concert with no conductor recorded — a ditto in the
source that AWK-10 flagged for hand-filling. With Conductor now one of only two
browse filters, that Concert is invisible to it until the cell is filled.

**Every performance added must carry a real date.** ADR-0001 keys Concert URLs by
date and the importer derives ids as `cnc-YYYYMMDD`, so a program recovered with
only a year or a month has no route and no id. This was raised as a possible
blocker for pre-BSO material and dissolved — Alex confirms those programs carry
dates — but it is a standing constraint on anything added later, not a solved
problem. `concert.dateNote` exists for imprecision in *display*; it does not
supply a key.

**The archive keeps growing while the published site shrinks.** The 119
pre-tenure Concerts, the 3 undateable ones, and every unmarked row stay in
Contentful as substrate. Anything counting entries to sanity-check the build will
find far more than the site publishes, and the difference is not an error.

**Alex is in none of the source data.** No "Kale" appears among the 310 soloists,
37 conductors or 27 ensembles, which confirms from the other direction that
section players were never recorded. Participation is entirely net-new data, so
there is nothing to reconcile against and no existing field to migrate.
