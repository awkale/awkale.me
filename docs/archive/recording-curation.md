# Recording curation — the @BKLYNsymphony channel

Per-video verdicts for the `recording` content type, done by hand under
[AWK-32](https://linear.app/awkale/issue/AWK-32) as
[ADR-0012](../adr/0012-performance-recordings.md) requires. Sourced from the
channel's RSS feed on **2026-08-14**:

```bash
curl -s 'https://www.youtube.com/feeds/videos.xml?channel_id=UCsDWWl_zTBj3K2_dFH6HMdg'
```

The feed returns the **15 most recent uploads and no more** — that is a YouTube
limit, not a channel one, so this covers the channel's recent tail and not its
history. Older uploads need the channel page, which does not render without
JavaScript.

**This file is the worksheet, not the data.** ADR-0012's *"seeding cannot be
scripted"* is the whole point, and a script that read this file back and seeded
from it would be that same script wearing a disguise — it would run again one day
against a channel that has moved on. The three entries below were typed in once,
from verdicts reached by hand, and **nothing in this repo will reproduce them**.

## Verdicts

Fifteen videos, three seedable.

| # | Published | Title | Verdict |
| --- | --- | --- | --- |
| 1 | 2024-07-10 | Brooklyn Symphony Orchestra 50th Anniversary Video | ✗ not a performance |
| 2 | 2024-06-21 | BSO Trip to Merida, Mexico in February 2024 | ✗ not a performance |
| 3 | 2024-06-16 | BSO 50th Anniversary Slideshow | ✗ not a performance |
| 4 | 2023-06-14 | Taking Note | ✗ not a performance |
| 5 | 2023-06-14 | NIMROD from "Enigma Variations", cond. Nick Armstrong | ✅ **`pi-20221218-2`** |
| 6 | 2023-04-01 | Tchaikovsky — Violin Concerto, I. Movement | ✅ **`pi-20221218-3`** |
| 7 | 2023-04-01 | Tchaikovsky — Violin Concerto, Complete | ✅ **`pi-20221218-3`** |
| 8 | 2021-04-23 | BSO Mexico 2020 — LISZT — Les Préludes | ⛔ blocked: tour Concert does not exist |
| 9 | 2021-04-23 | Wolf-Ferrari — Serenade for Strings | ✗ not in the archive |
| 10 | 2021-04-23 | BSO Mexico 2020 — MONCAYO Haupango Encore | ⛔ blocked: tour Concert does not exist |
| 11 | 2021-04-23 | Concerto Grosso Op. 6, No. 11, in A major — Händel | ✗ not in the archive |
| 12 | 2021-04-23 | Elgar — Wand of Youth — March | ✗ not in the archive |
| 13 | 2021-04-23 | Elgar — Wand of Youth — Fountain Dances / Wild Bears | ✗ not in the archive |
| 14 | 2021-04-09 | BSO Mexico 2020 — TCHAIKOVSKY "Mozartiana" | ⛔ blocked: tour Concert does not exist |
| 15 | 2021-03-26 | Tchaikovsky — Serenade for Strings — Elegie | ✗ not in the archive |

## The three, authored and published 2026-08-14

All three are the same Concert — `cnc-20221218`, 2022-12-18, Brooklyn Museum of
Art, Nicholas Armstrong — whose full program is `La Boutique Fantasque` ·
`"Enigma" Variation No. 9, Nimrod` · `Violin Concerto in D Major`.

| Entry | `url` | `label` | `kind` | `concert` | `programItem` |
| --- | --- | --- | --- | --- | --- |
| `5k1O8x3ebT2aZ0JzI30Bkc` | `https://www.youtube.com/watch?v=ONote9yGXEE` | Complete performance | `video` | `cnc-20221218` | `pi-20221218-2` |
| `2zKNekuWa2ClOC5wNT3nyr` | `https://www.youtube.com/watch?v=2wXcvF6Q85A` | Complete concerto | `video` | `cnc-20221218` | `pi-20221218-3` |
| `4cT2XzTtTzcprqWD9YBuVE` | `https://www.youtube.com/watch?v=MOFEvJAIqlk` | First movement only | `video` | `cnc-20221218` | `pi-20221218-3` |

**They were created as drafts and published separately**, the same split
`import_to_contentful.py` makes, with the labels reviewed in between.

**Publishing is what proved the `unique: true` on `url`.** Contentful enforces
uniqueness at publish and not at draft, so three drafts with the same URL sit
quietly until someone tries to publish the second. That is harmless at three
entries and worth knowing before there are thirty: a duplicate is discovered at
the moment it is least convenient, and the type's whole key rests on it.

**The link targets were verified against Contentful, not against
`bso-graph.json`.** The graph is parser output and the two are known to disagree —
`AGENTS.md` records a hall-count difference and eight concerts where live
Contentful differs from both the graph and the participation checklist. All three
ids above were read back from the space, published, before anything linked to
them.

All four other fields are **required** — only `programItem` is optional, and it is
populated on all three because none of these is a concert-level recording.

**The three `label` values are proposed, not sourced.** ADR-0012 gives `label` the
job of being link text precisely *because* "source titles are wildly
inconsistent", so nothing upstream supplies them and these are a judgment call to
overrule freely. What they have to survive is appearing twice under one Program
Item, where "Complete concerto" and "First movement only" have to distinguish
themselves from each other and not from the surrounding page — the work's title
is already the heading.

**`label` is also the type's `displayField`, and the two jobs pull apart.** Good
link text is short and leans on its surroundings; a good display value is
self-identifying, because the web app's entry list is flat and has no
surroundings. "Complete performance" on the Nimrod and "Complete concerto" on the
Tchaikovsky are already the compromise — a bare "Complete performance" on both
would have been better link text and two identical rows in the entry list.

That tension does not resolve, it only gets managed: with three entries the list
is legible either way, and at thirty it will not be. Whoever hits that should
reach for the `label`-as-link-text reading ADR-0012 actually specifies and accept
the flat list, rather than quietly turning `label` into a title and leaving the
Concert page reading "Tchaikovsky — Violin Concerto, Complete" under a heading
that already says Violin Concerto.

**Use the `watch?v=` form, not `youtu.be`.** Both resolve, but `url` is `unique`
and the two spellings of one video are two distinct strings, so the constraint
that exists to stop a duplicate would not catch this one. Nothing enforces the
choice; it is a convention this file records so the second curator makes the same
one.

### Why these three are provable and title-matching is not

The evidence is per video and does not generalize — which is ADR-0012's point
about scripting, restated in the affirmative:

- **Nimrod (#5).** `"Enigma" Variation No. 9, Nimrod` is a *distinct work record*
  in the archive from `Variations on an Original Theme, "Enigma"`, and it has
  exactly **one** occurrence in 250 concerts. The video names its conductor —
  "Nick Armstrong" — and `cnc-20221218`'s conductor is Nicholas Armstrong. One
  candidate, corroborated.
- **Tchaikovsky (#6, #7).** `pi-20221218-3` is Kinga Augustyn's **only** Program
  Item in the entire archive, so the soloist named in both titles identifies the
  occasion by itself. The work alone would not: `Violin Concerto in D Major` also
  resolves to Tchaikovsky in 1986, plus Beethoven and Brahms.

Neither route is a rule a matcher could follow. Both depend on a fact that
happens to be unique in this archive and would not be in another.

### The publish dates would have been wrong three times out of three

Worth stating because the RSS feed offers a `<published>` element per video and
it is the obvious thing to reach for:

| Video | Published | Performed | Out by |
| --- | --- | --- | --- |
| Tchaikovsky, I. Movement | 2023-04-01 | 2022-12-18 | 3.5 months |
| Tchaikovsky, Complete | 2023-04-01 | 2022-12-18 | 3.5 months |
| **Nimrod** | **2023-06-14** | **2022-12-18** | **~6 months** |

ADR-0012 records the 3.5-month case. The Nimrod is worse and is from the *same
concert* — one performance published in two batches **ten weeks** apart, so even
"videos uploaded together share an occasion" fails as a heuristic in both
directions. This is why `recording` has no `date` field.

## The three that are blocked, and on what

The "BSO Mexico 2020" batch (#8, #10, #14). Two of the three map cleanly onto
works on `cnc-20200223`'s program:

- Les Préludes → `pi-20200223-5`
- "Mozartiana" → `pi-20200223-3`

**Attaching them there would be wrong**, and ADR-0012's longest section exists to
say so: the Mexico tour repeated the February 2020 program, so linking these
videos to `cnc-20200223` asserts they are the Brooklyn Museum performance, which
they are not. The tour date has to exist as its own Concert sharing
`pi-20200223-*`, exactly as the archive's eight two-night runs already do.

**AWK-38 made one of those eight a closer precedent than it was.** 2008-12-13/14
is a run at two *different* Halls — Grand Street on the Saturday, St Ann on the
Sunday — which is the same shape this needs, since the tour Concert is plainly
not at the Brooklyn Museum. Note the mechanism does not transfer wholesale: that
pair is declared in `parse_archive.py`'s `SOURCE_CORRECTIONS` because the sheet
holds both rows, whereas the sheet holds **no row at all** for the tour date. See
AWK-57.

**What is actually missing is the date.** The spreadsheet recorded the concert
series and never the tour dates, and neither the video titles nor the feed give
one — "BSO Mexico 2020" is the whole of it. So this is blocked on a fact from
outside every source this repo has, not on schema and not on effort.

The third (#10, *Huapango*) is blocked twice over: it is an **encore**, so it is
not on the printed program and the parser never saw one. It needs a new Program
Item on that new Concert — a high `order` and `note: "Encore"`, both fields that
already exist. The archive's only `Huapango` is `pi-20001216-2`, a 2000 concert
two decades away, and it is the trap ADR-0012 names: a title matcher lands there
confidently.

## The five that are simply not in the archive

Checked individually against `bso-graph.json`, and none is a near miss:

- **Wolf-Ferrari — Serenade for Strings** (#9). Wolf-Ferrari is **not a composer
  in the archive at all** — 244 composers, no entry. The only Serenades for
  Strings are Elgar's (1982, 1988) and Barber's (2013).
- **Händel — Concerto Grosso Op. 6 No. 11** (#11). The archive holds Handel's
  Op. 6 **No. 10** (1974-11-20) and several Corelli Op. 6s. No. 11 is absent, and
  the near-identical title is exactly the kind of thing a fuzzy matcher would
  claim.
- **Elgar — Wand of Youth**, both halves (#12, #13). No such work, under any
  spelling, among Elgar's ten records.
- **Tchaikovsky — Serenade for Strings, Elegie** (#15). Absent.

The honest reading is that the 2021-03/04 batch is not drawn from the concert
series this archive indexes. Do not force them.

## Two things this pass found that the ticket did not

**AWK-32 undercounts the in-scope videos.** Its corpus note says *"2 the same
performance at two granularities, and 1 provably in scope (`pi-20221218-3`)"*,
which describes the two Tchaikovsky videos twice and leaves the Nimrod
uncategorized — its own arithmetic, 4 + 3 + 5 + 2 + 1 = 15, only balances because
the Nimrod fills the slot the Tchaikovsky already occupies. There are **three**
seedable videos across **two** Program Items. ADR-0012 was corrected under AWK-32;
the ticket text was left as written, since it is a record of what was believed.

**A per-item conductor the archive cannot express.** Video #6/#7 credit
*"Kinga Augustyn, Felipe Tristan"*, and Felipe Tristan is a real BSO conductor in
the archive (11 concerts, 2018 → 2026) — but `cnc-20221218`'s conductor is
Nicholas Armstrong, and video #5 from the same concert names Armstrong
explicitly. The straightforward reading is that Tristan conducted the concerto
and Armstrong the rest, which ADR-0006's model cannot hold: `conductor` is a
field on `concert`, not on `programItem`.

**This changes nothing about the three recordings** — they attach to a Concert
and a Program Item, and both are correct either way. It is logged because it is a
question about the *archive*, surfaced by curation, and it has three possible
answers worth separating before anyone edits data: the sheet is wrong, the video
credit means something other than conducting, or the model needs a per-item
conductor. Nothing here establishes which.
