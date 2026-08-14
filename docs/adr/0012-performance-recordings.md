---
status: accepted
---

# Performance recordings: links out, never embedded or hosted

Recordings of performances appear in `/concerts` as **outbound text links** to
whatever platform already hosts them. Nothing is embedded, nothing is self-hosted,
and no player runs on this site. They are held by a new `recording` content type
keyed to the **(Concert, Program Item)** pair.

Decided in
[AWK-27](https://linear.app/awkale/issue/AWK-27/decide-how-performance-audio-and-video-are-hosted).

## The option set was a false binary

AWK-27 framed the choice as *embedded from a third party* versus *self-hosted*, and
picked correctly against self-hosting. Both are ruled out, by two unrelated prior
decisions:

**Self-hosting** dies on
[AWK-16](https://linear.app/awkale/issue/AWK-16/confirm-what-netlify-actually-meters-and-what-throttles-deploys).
The account is on a frozen **Legacy Free** plan where bandwidth is 100 GB/month, and
bandwidth is one of the *"other metered features"* whose exhaustion **pauses every
site on the account** rather than billing — the same failure mode
[ADR-0011](0011-input-surface.md) documents for Forms, and strictly worse than the
build-minute case. 100 GB is noise against ~600 HTML pages and nowhere near enough
for video. A handful of hour-long recordings plus modest traffic could take the
archive offline, along with the five other projects on the personal team.

**Embedding** dies on [ADR-0010](0010-no-analytics.md). A YouTube or Vimeo iframe
needs `frame-src` naming a third-party origin and executes that vendor's code in the
page — precisely the third-party client-side surface that record bans, and against
its stated consequence that *"the site ships no third-party script tags at all."*
Embedding would require **amending** ADR-0010, not extending it.

**Linking is neither**, and that is the whole decision. An `<a href>` costs zero
Netlify bandwidth, zero CSP directives, and zero third-party origins. The page
fetches nothing from anyone.

### Rights dissolve on the same point

AWK-27 recorded rights as a real question — a concert recording involves the
orchestra, the conductor, soloists, and sometimes living composers, so *"publishing
one is not obviously Alex's call alone."* Correct, and it does not apply here.
**Linking never copies.** The Brooklyn Symphony Orchestra publishes its own
performance video on its [own channel](https://www.youtube.com/@BKLYNsymphony) and a
[Video Performances](https://www.brooklynsymphonyorchestra.org/bso-video-performances)
page; the orchestra has already made the publication decision, and this site points
at what it published. The rights question was aimed at hosting, which this record
does not do.

## The `recording` type

The fourteenth content type in the space.

> **"The twelfth" was correct when written and is corrected to "the fourteenth"
> by [AWK-32](https://linear.app/awkale/issue/AWK-32/create-the-recording-content-type-and-curate-the-bso-channel).**
> This record and [AWK-31](https://linear.app/awkale/issue/AWK-31) both claimed
> slot twelve — AWK-31 calls `project` and `imageGroup` "the twelfth and
> thirteenth" — because both were written against an 11-type space and neither
> anticipated the other landing first. AWK-31 applied on 2026-08-14 and this
> followed it, so the space went 11 → 13 → 14.
>
> Nothing about the decision changes; an ordinal was never load-bearing. It is
> corrected rather than left because a reader checking the record against the
> space would find a mismatch and have no way to tell whether the *count* drifted
> or the *type* did. `scripts/contentful/portfolio-schema.json` predicted this
> collision when it landed — its opening `note` says so in as many words — and
> that is the reason it was caught here rather than in the space.

| Field | Type | Req. | Notes |
| --- | --- | --- | --- |
| `url` | Symbol, `unique` | yes | The canonical key |
| `label` | Symbol | yes | Link text; source titles are wildly inconsistent |
| `kind` | Symbol, `in` [`video`, `audio`] | yes | Following `soloist.instrument`'s precedent |
| `concert` | Link\<`concert`\> | **yes** | The occasion — load-bearing, see below |
| `programItem` | Link\<`programItem`\> | no | Empty means a Concert-level recording |

**`url` carries the uniqueness, not the pair.** One Program Item legitimately holds
several recordings — the BSO published Tchaikovsky's Violin Concerto twice, as a
single movement and complete, and split Elgar's *Wand of Youth* across two videos.
So the pair is deliberately non-unique while the URL is. This is the one place in
this project where `unique: true` is safe on first use, after it bit
[ADR-0004](0004-design-system-and-tokens.md), [ADR-0005](0005-composer-identity-and-arrangements.md)
and [ADR-0008](0008-archive-slug-source.md): movement cuts and complete cuts are
genuinely distinct addresses.

**No `date` field.** It derives from `concert`, and a second copy would be a second
source of truth to drift. Entries are hand-authored, so they take Contentful's
auto-generated ids and need no prefix convention —
[ADR-0003](0003-portfolio-content-model.md) settled that.

### Why not a field on `programItem`, and why not on `concert`

**`programItem` is structurally unavailable, not merely unattractive.** The seven
in-scope programs that run on two dates **share one Program Item set**, so a URL
there would attach one night's recording to both nights. That is the identical trap
[ADR-0006](0006-performance-history-content-model.md) dodged when it put `satOut` on
`concert` rather than a flag on `programItem`, and it recurs here for the same
reason: a recording is a fact about an *occasion*, and Program Items are not
per-occasion.

**`concert` alone cannot hold it either.** The pair needs a URL *and* an item
reference together, and Contentful arrays hold links or symbols but never tuples.
Parallel `urls[]` / `items[]` arrays would misalign silently on reorder — exactly
what ADR-0003 rejected for `assets[]` / `captions[]`. Encoding `"label | url"` into
a symbol is the same shape wearing a disguise. So the pair needs its own entity, and
one more content type is the honest cost of a real relationship.

## Why `concert` is required: the occasion is the point

This is the sharpest thing in the record, and it emerged from a correction rather
than from analysis.

The BSO's three *"BSO Mexico 2020"* videos were first read as unattachable, on the
evidence that the archive holds no 2020–21 concert beyond `2020-02-23` and that all
thirteen Halls are Brooklyn or NYC. Both facts are true. The inference was wrong:
**the Mexico tour repeated the February 2020 program.** Verified against
`cnc-20200223` — Leonore Overture No. 3 · Danzón No. 4 · Suite No. 4 *"Mozartiana"*
· Ricercar for Sonorous Instruments · Les Préludes — two of the three videos map
exactly onto `pi-20200223-3` and `pi-20200223-5`.

**So the recording is attachable, but only to the right occasion.** Linking those
videos to `cnc-20200223` would assert they are the Brooklyn Museum performance, which
they are not. The tour date has to exist as its own Concert entry sharing
`pi-20200223-*`, exactly as a two-night run does — the archive's existing shape,
reused.

**A `work.recordingUrl` would have erased that distinction silently**, and this is
the argument against every cheaper shape considered. Hanging recordings off the Work
says "there is a recording of this piece"; hanging them off the pair says "there is a
recording of *this performance*", which is the only claim `/concerts` exists to make.

**The general form is worth keeping:** the source spreadsheet recorded the concert
series and never the tour dates, so any tour recording needs its Concert created
before it has anywhere to hang. That is net-new data entry of exactly the shape
ADR-0006 anticipated for pre-BSO youth-orchestra programs.

### Encores need nothing new

The third Mexico video is titled *"MONCAYO Ha[u]pango **Encore**"*, which explains a
puzzle rather than creating one: *Huapango*'s only appearance in the archive is
`pi-20001216-2`, on a pre-tenure 2000 concert. An encore is not on the printed
program, so the parser never saw one.

**An encore is a Program Item** — a high `order` and `note: "Encore"`, both fields
that already exist. It therefore forms a (Concert, Program Item) pair, and
**ADR-0006's page rules apply unchanged**: the Work earns a page on the same terms as
anything else played. No schema change, no rule change, no new invariant. Recorded
here because the reasoning is not obvious from either record alone.

## Seeding cannot be scripted

Three independent reasons, each sufficient on its own. This is the part most likely
to be re-attempted and worth writing down.

1. **Publish date ≠ performance date.** The Tchaikovsky Violin Concerto with Kinga
   Augustyn was published 2023-04-01 and performed **2022-12-18** (`pi-20221218-3`,
   her only Program Item) — 3.5 months out. Upload batches lag by arbitrary amounts,
   and they do not lag *together*: the Nimrod from that same concert was published
   2023-06-14, nearly six months after the performance and ten weeks after the
   Tchaikovsky. So neither "the publish date approximates the performance" nor
   "videos uploaded together share an occasion" survives contact with the corpus.
2. **Title matching lands on the wrong occasion.** *Huapango* resolves to a 2000
   concert two decades from the recording, per the encore above. Where a Work was
   played more than once — 52 twice, 2 three times — the title cannot
   disambiguate at all.
3. **Granularity does not match the model.** Publication is per *movement* as often
   as per work, and the same performance appears at two granularities.

Curation is therefore per video, by hand, and the corpus needs filtering first: of
the fifteen most recent uploads, four are non-performance (a 50th-anniversary video,
a tour montage, a slideshow, and *Taking Note*). The orchestra's SoundCloud is a
**podcast about the orchestra**, not performance, and is excluded on the same ground.

One practical note for whoever does it: the channel's RSS feed
(`youtube.com/feeds/videos.xml?channel_id=UCsDWWl_zTBj3K2_dFH6HMdg`) is readable
without JavaScript, which the channel page is not. It returns the **fifteen most
recent uploads and no more**, which is a YouTube limit rather than a channel one —
so the pass below covers the channel's recent tail, not its history.

> **That pass was done under AWK-32 and is recorded per video in
> [`docs/archive/recording-curation.md`](../archive/recording-curation.md).**
> Three videos are seedable, against **two** Program Items on one Concert
> (`cnc-20221218`): the Tchaikovsky at both granularities on `pi-20221218-3`, and
> a *Nimrod* on `pi-20221218-2` — a work with exactly one occurrence in 249
> concerts, whose video names its conductor and matches. Three are the Mexico
> batch, blocked on a tour date that no source available here records. Five are
> absent from the archive entirely, and one of those is the near-miss this record
> should have predicted: the channel's Handel is **Op. 6 No. 11**, the archive's is
> **Op. 6 No. 10**.
>
> The count in this section stands; AWK-32's ticket text undercounts the in-scope
> videos at one, having described the two Tchaikovsky uploads twice and left the
> Nimrod uncategorised.

## Surfaces

| Page | Shows |
| --- | --- |
| Concert page | recordings for that Concert, under the program |
| Work page | recordings of that performance, beside the date |

The Work page is the reason the pair key was chosen: it is where ADR-0006's *"I
played this"* assertion lives, and a link to the performance is the strongest
available evidence for it. Concert-level recordings — `programItem` empty — appear
only on the Concert page.

**No new browse filter.** ADR-0006 fixed the filter set at conductor and hall and
dropped `season` deliberately; "has a recording" describes documentation rather than
repertoire, and would be empty on virtually every pair. A third facet was weighed on
the ground that a handful of recordings is otherwise near-undiscoverable, and
rejected: that is what search is for
([ADR-0011](0011-input-surface.md)).

### Thumbnails are not shown

Considered and rejected, because it is the one way a link can leak what an embed
would have. YouTube thumbnails come from `i.ytimg.com`, a Google origin that receives
the visitor's IP and referer on **every page view** rather than on a click — a
tracking surface admitted through the back door of the record that banned tracking,
and one that would force an `img-src` entry naming Google.

Self-hosting the thumbnails as Contentful Assets was the middle option and was
rejected as disproportionate: manual per video, stale whenever the platform changes
its artwork, and it would couple this decision to
[AWK-28](https://linear.app/awkale/issue/AWK-28/decide-how-contentful-asset-images-are-delivered)
for no gain. Text links keep the two independent.

## Consequences

**A sixth invariant this project cannot express declaratively.**
`recording.programItem` must belong to `recording.concert.program`. Contentful cannot
validate one field against another — the same limit that produced `sideBySide`'s
image cap ([ADR-0004](0004-design-system-and-tokens.md)), `satOut ⊆ program`
([ADR-0006](0006-performance-history-content-model.md)), `(composer, slug)`
uniqueness ([ADR-0008](0008-archive-slug-source.md)),
`featuredRank`-requires-`body` ([ADR-0003](0003-portfolio-content-model.md)) and the
CSP's inline-script hash ([ADR-0010](0010-no-analytics.md)). It joins the CI
assertion
[AWK-17](https://linear.app/awkale/issue/AWK-17/spike-the-637-route-prerender-build)
built and proved, which already carries three of the other five.

**The page count is untouched.** Links create no routes, so the site stays at
≈600 + N. Recordings are not enumerated, not prerendered, and invisible to the page
assertion.

**The CSP is unaffected**, and that is worth stating positively: this record adds
**no** directive to ADR-0010's pending policy. No `img-src`, no `frame-src`, no
`media-src`, no `connect-src`. The CSP remains blocked on AWK-28 for `img-src` and on
nothing else — unchanged by this decision, where the embedded option would have
reopened it.

**Nothing blocks cutover.** Creating the type and authoring entries is build and
content work, sequenced after the schema items ADR-0006 and ADR-0008 already require.
The site is correct with zero `recording` entries; the feature degrades to absence.

**The prohibition is standing, not situational.** No embedded players and no
self-hosted media, in either section. Note this record governs `/concerts` only:
`/music` remains reserved by [ADR-0001](0001-url-structure.md) for Alex's own
original work, and how that material is delivered is a separate question this record
does not answer. Conflating the two is the confusion the map had to untangle once
already, when "the music section" stopped meaning the performance history.

**Reopening trigger.** Two, both observable from outside:

- **A plan change.** Self-hosting becomes discussable only on a plan where bandwidth
  is an overage rather than a stop. Migrating this account to credit-based pricing is
  **irreversible** and retightens builds to roughly 20 deploys/month, so this is not
  a cheap trigger.
- **Alex's own recordings, on `/music`.** Material he holds the rights to and wants
  presented rather than linked is a different decision with different economics, and
  belongs to whatever record settles that section.

*"Embedding would be nicer"* is not a trigger. This record answers it.
