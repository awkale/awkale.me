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

**Conductor**:
The person who conducted a Concert.

**Season**:
The orchestra's numbered concert year. Seasons run 1 to 52. Recorded on every
BSO-era Concert and shown nowhere on the site — a Season describes the
orchestra's calendar, not Alex's repertoire.
_Avoid_: grouping or filtering anything published by Season; the Concert date
does that

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
