# awkale.me

The personal site of Alex W. Kale: design and development work as the primary
focus, and an indexed history of orchestral performances as a secondary section.
Content lives in Contentful; the site is prerendered at build time.

## Language

### The site

**Project**:
A piece of design or development work presented on the site. Lives at
`/projects`.
_Avoid_: Work — that means a musical composition, and the ambiguity is why the
section is not called `/work`

**Case study**:
The page-length write-up of a single Project.
_Avoid_: Post, article

**Performance history**:
The indexed record of concerts Alex has performed in, cross-referenced by
composer and work. Lives at `/concerts`.
_Avoid_: Archive, the music section

**Music**:
Original work Alex creates himself. Distinct from the Performance history and
permanently reserved to `/music`.
_Avoid_: using this word for the Performance history

### The concert archive

**Concert**:
A single dated performance event, given by one orchestra in one hall.
_Avoid_: Gig, show, event

**Program**:
The ordered sequence of Program items performed at one Concert.
_Avoid_: Setlist, lineup, repertoire

**Program item**:
One entry in a Concert's Program — a Work, its Composer, and any Soloists.
_Avoid_: Piece, number, track

**Work**:
A distinct musical composition as performed.
_Avoid_: Piece, song, track

**Composer**:
The person who wrote a Work. One record per person: neither an Arranger nor an
honorific is part of a Composer's identity, so "Sir William Walton" and "William
Walton" are one Composer. A generational marker is the opposite — Johann Strauss
Sr. and Johann Strauss II are two Composers, and the marker is the only thing
saying so.
_Avoid_: Author, writer

**Filing name**:
The form a Composer is sorted and addressed under: the main root of the surname
first, with a lowercase prefix moved to the back — Ludwig van Beethoven files as
_Beethoven, Ludwig van_, under B. The prefix is relocated, never dropped, so the
displayed name is always recoverable from the filing name.
_Avoid_: filing under the prefix; discarding the prefix

**Arranger**:
A person who reworked a Work for different forces than the Composer wrote for.
The role name covers all four Arrangement types, but the types themselves are
distinct and must not be collapsed — see Arrangement type.
_Avoid_: calling the person an Orchestrator, transcriber or editor; they are all
Arrangers

**Arrangement**:
A Work as reworked by an Arranger. A distinct Work in its own right, not a
variant of the original — it has its own page, and links to the original when the
Archive holds it.

**Arrangement type**:
How a Work was reworked: an Arrangement, Orchestration, Transcription or Edition.
A real distinction, not four words for one thing — Ravel orchestrated
_Pictures at an Exhibition_, Roven transcribed _Kindertotenlieder_, and Mauceri
edited the _Psycho_ selections.
_Avoid_: describing any of the four as "arranged" generically

**Period**:
The stylistic era a Work belongs to — one of nine values taken verbatim from
IMSLP: Ancient, Medieval, Renaissance, Baroque, Classical, Romantic, Early 20th
century, Modern, Jazz. Held on the Composer and inherited by their Works, except
where a Work states its own — Ellington's _Nutcracker_ is Jazz though Tchaikovsky
is Romantic. A browse filter, never a URL.
_Avoid_: Era — that is IMSLP's word for the Composer-level field, and the site
says Period for both; Style; Genre

**Form**:
What kind of piece a Work is: Symphony, Suite, Overture, Ballet, Tone Poem. A
Work carries any number of Forms, so the _Firebird Suite_ is both a Suite and a
Ballet rather than being filed under one. A browse filter, never a URL, and
allowed to be incomplete — Period carries the browsing.
_Avoid_: Genre — the retired field of that name held only whatever form word
appeared in the title, which is why it filed ballets as suites and excerpts as
arias. It is not this, and nothing should be called a Genre.

**Soloist**:
A named featured performer on a Program item. Section players are not recorded
anywhere in the archive.
_Avoid_: Performer, musician, player

**Credit**:
The verbatim line a Soloist — or a group linked in its place — was billed under
on a Program item: "Nicholle Bittlingmeyer, Carmen", "Jason Asbury, Director",
"Janine Carstein, Accompanist". One string in `programItem.credits`, kept beside
the link. The link names the person; the Credit is the only record of what they
were billed as on that item, so an opera cast lives here — nine Credits on the
Act II _Carmen_ item, one Character each. Lossless and unqueryable on purpose: a
pair entity that would make it queryable was considered under AWK-75 and
rejected, because nothing filters by it and a cast list renders straight from
the Credits.
_Avoid_: treating it as a duplicate of the Soloist link; deriving a Credited
role from it after import

**Credited role**:
What a Soloist was billed as: an instrument (Violin), a voice type
(Mezzo-Soprano) or a function (Director, Narrator). Held in
`soloist.instrument`, whose label _Instrument / Voice / Role_ is the honest
name — the field is a controlled list of roles, not of instruments, and the
parser mirrors that list by hand. A cast member billed by Character alone has
no Credited role, and that empty is the rule, not a gap: the source never
recorded a voice type, and none is being recovered.
_Avoid_: Instrument, as the name of the concept — a Narrator has none and is
filed here anyway; Voice type; reading an empty value as missing data

**Character**:
The named dramatic role a Soloist played on a Program item — Isolde, Carmen,
Royal Pianist. It belongs to the (Program item, Soloist) pair, so its record is
the Credit; `programItem.character` restates it only when the item has exactly
one Credit, and is otherwise empty. A Character says who was played, never what
the performer was: Royal Pianist is a Character even though it names an
instrument.
_Avoid_: Role, alone — ambiguous with Credited role; filing an instrument or
voice type here; expecting the field to hold a cast

**Conductor**:
The person who conducted a Concert.

**Season**:
An institution's numbered concert year, running September to the following
summer. A summer tour date closes the season before it, rather than opening the
next one — the Long Island Youth Orchestra concert of 1993-07-26 is Season 30,
1992-1993. The Brooklyn lineage's seasons run 1 to 52 — one continuous
numbering carried across two renamings, so Season 1 is a Brooklyn Heights Music
Society year and Season 52 a Brooklyn Symphony one. Shown nowhere on the site:
a Season describes the institution's calendar, not Alex's repertoire.

A Season belongs to an institution, not to an Orchestra, which is why `number`
alone does not identify one — a Long Island Youth Orchestra Season 12 and a
Brooklyn Season 12 are different years of different calendars. `orchestras` on
the Season records which Orchestra held it; Season 5 straddles a renaming and
carries both.

**A Season's number does not imply its year.** `1972 + number` holds through
Season 47 (2019-2020) and then breaks: Season 48 is 2021-2022, because the
cancelled 2020-2021 season consumed no number. Derive the year from the Concert
dates; never compute it.
_Avoid_: grouping or filtering anything published by Season; the Concert date
does that. Also: computing a Season's year from its number

**Archive**:
The complete institutional record of the Brooklyn Symphony Orchestra and its
sibling organizations, including concerts predating Alex. Substrate for the
Performance history, never a published surface of its own.
_Avoid_: using this word for the Performance history

### Participation

**Participation**:
The record of what Alex himself performed, held as `attended` and `satOut` on
each Concert. The only thing that decides what the site publishes.
_Avoid_: Attendance — he was playing, not attending

**Attended**:
True when Alex played a Concert, false when he was in the orchestra and missed
that date, unset when the Concert is not part of his history at all. Both false
and unset publish nothing, and the two are kept distinct so a considered
judgement is not confused with an unreviewed row.
_Avoid_: reading unset as "not yet checked" — it means "not his"

**Sat out**:
A Program item Alex did not play at a Concert he otherwise played. Listed in that
Concert's `satOut`. Not shown anywhere: a sat-out Work is omitted from the
Concert's program, and loses its page if that was its only Performance.
_Avoid_: Skipped, missed — Missed applies to a whole Concert

**Played**:
Said of a Work when at least one Performance of it was Attended and not Sat out.
The claim the site exists to make, stated plainly in the first person.
_Avoid_: hedging it to "on a program I played" — the page only exists because he
played it

### Scope

**Tenure**:
The period from Alex's first BSO-era Concert (2001-05-24) onward. Still a real
period, and still the reason "pre-tenure" is a useful word, but it no longer
decides what the site shows.

**In scope**:
Attended is true. Nothing else. A Concert qualifies because Alex played it, never
because of when it happened.
_Avoid_: treating the Tenure date as a filter — it seeds Participation for the
BSO-era Concerts and is read nowhere at build time

**Seed data**:
The BSO Archive Concerts loaded in bulk, 119 of which predate Tenure. The only
source that will ever contain Concerts Alex did not play — everything added by
hand afterwards is a Performance by construction, which is why unmarked data
publishes nothing.
