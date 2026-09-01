# Form curation — the 115 works nothing can answer for

Generated under AWK-37 from the live space, and regenerated under AWK-64, which
added five: the new Works of the three Tilles Center LIYO programs that no
automatic route could file. The sixth, Piston's *Suite from the ballet "The
Incredible Flutist"*, is absent because the derived `Excerpt` rule caught its
title — which is the rule doing its job, not a form judgement anyone made.
Regenerating found no row that had gone stale; all 104 of AWK-37's still carry
zero forms.

Regenerated again under AWK-82, which added **six** of the three LISFA festival
programs' seven new Works. IMSLP holds a page for only one of the seven, *Fiddle
Faddle*, and that page carries no form category — so six arrive here by the
ordinary route, with nothing automatic left to try. The seventh, Mozart's
*Serenade No. 13 in G major, K. 525*, is absent for a reason no earlier row has:
**it was curated by hand in the web app** rather than by any route this file
describes, minutes after the transcription published, and it carries `Serenade`.
That makes it the one case where `worksLeftToCurate` in
`scripts/contentful/period-and-forms.json` counts a work this worksheet does not
list — the guard's decomposition has no term for a hand-set form, and 7 is the
number that keeps its arithmetic true.

**A worksheet, not an input** —
nothing reads this file, and the seed does not consult it. Fill a row in by
adding the work to a bucket in `workForms` in
`scripts/contentful/period-and-forms.json`, then re-run the seed.

These are the works that end up with **zero** forms after every automatic route
has run: the retired `genre` mapping, the IMSLP harvest, and the derived
`Excerpt` rule. ADR-0007 is explicit that assigning them is taste rather than
data entry — doing it is "inventing a category for *Boléro*", 115 times — and
equally explicit that **nothing in the spec is blocked on them**. Period carries
the browse load and Form is permitted to stay incomplete, so an empty row here
is a decided state, not a defect.

The vocabulary is the 25 values in `archive-schema.json`. Extending it means
editing that `in` list and re-running the applier; there is no `genre` entry to
create any more.

No work reaches this list still carrying a retired `genre`, which is worth
stating because it is the check that the migration lost nothing: everything the
old field labelled came out with at least one form. That includes the 13-strong
`Aria` bucket ADR-0007 dismantles — `genreForms` maps `Aria` to nothing on
purpose, and all thirteen are re-filed by hand or by the derived `Excerpt` rule
rather than dropped.

| Composer | Work | Entry id |
| --- | --- | --- |
| Adams, John | The Chairman Dances | `wrk-the-chairman-dances-d90614` |
| Anderson, Douglas | Spirit Guide (World Premiere) | `wrk-spirit-guide-world-premiere-da26d7` |
| Anderson, Leroy | Fiddle Faddle | `wrk-fiddle-faddle` |
| Anderson, Leroy | Sleigh Ride | `wrk-sleigh-ride-9d083f` |
| Barber, Samuel | Adagio for Strings | `wrk-adagio-for-strings-cc12ae` |
| Barber, Samuel | First Essay | `wrk-first-essay-5f6ea3` |
| Barber, Samuel | Knoxville: Summer of 1915 | `wrk-knoxville-summer-of-1915-b7355f` |
| Barber, Samuel | Souvenirs | `wrk-souvenirs-d4cfd0` |
| Basulto, Alejandro | Habanera-Reggaeton (World Premiere) | `wrk-habanera-reggaeton-world-premi-58162b` |
| Bernstein, Leonard | Fancy Free | `wrk-fancy-free-790295` |
| Bernstein, Leonard | On the Town: Three Dance Episodes | `wrk-on-the-town-three-dance-episod-2bbd25` |
| Bizet, Georges | Act II, Carmen | `wrk-act-ii-carmen-ee0161` |
| Bizet, Georges | Selections, Carmen | `wrk-selections-carmen-4f94b5` |
| Bossert, Cameron | Music for Film | `wrk-music-for-film-6bcb97` |
| Brahms, Johannes | Piano Quartet in G Minor | `wrk-piano-quartet-in-g-minor-6ef24c` |
| Bridge, Frank | The Sea | `wrk-the-sea-c4cde8` |
| Britten, Benjamin | The Young Person's Guide to the Orchestra | `wrk-the-young-person-s-guide-to-th-8a1f37` |
| Canteloube, Marie Joseph | Chants d'Auvergne | `wrk-chants-d-auvergne-cc23c7` |
| Chase, Bruce | Happy Hoedown | `3dSEdscwQ5DP6GdWJwF87M` |
| Copland, Aaron | El Salon Mexico | `wrk-el-salon-mexico-cc2afd` |
| Copland, Aaron | Lincoln Portrait | `wrk-lincoln-portrait-0712fc` |
| Copland, Aaron | Quiet City | `wrk-quiet-city-94ef93` |
| Copland, Aaron | Rodeo: Four Dance Episodes | `wrk-rodeo-four-dance-episodes-f5f13f` |
| Cowan, Marie | Waltzing Matilda | `wrk-waltzing-matilda` |
| Cowell, Henry | Hymn and Fuguing Tune No. 3 | `wrk-hymn-and-fuguing-tune-no-3-2c0f0c` |
| David, Ferdinand | Concertino, for trombone and orchestra | `wrk-concertino-for-trombone-and-orchestra` |
| Debussy, Claude | Danse Sacree et Danse Profane | `wrk-danse-sacree-et-danse-profane-2fba35` |
| Debussy, Claude | Images pour Orchestre, No. 2 "Iberia" | `wrk-images-pour-orchestre-no-2-ibe-383379` |
| Debussy, Claude | Marche Ecossaise | `wrk-marche-ecossaise` |
| Del Borgo, Elliot | Petite Overture | `5YEj92lOrzdwen2auHp0JP` |
| Delius, Frederick | Sleigh Ride | `wrk-sleigh-ride-2805ce` |
| Delius, Frederick | The Walk to the Paradise Garden | `wrk-the-walk-to-the-paradise-garde-a5cc9d` |
| Diamond, David | Rounds for String Orchestra | `wrk-rounds-for-string-orchestra` |
| Donizetti, Gaetano | Act II Finale, Lucia di Lammermoor | `wrk-act-ii-finale-lucia-di-lammerm-dae3fb` |
| Dukas, Paul | The Sorcerer's Apprentice | `wrk-the-sorcerer-s-apprentice-f55d91` |
| Earnest, John David | Southern Exposure | `wrk-southern-exposure-c49a53` |
| Elgar, Edward | "Enigma" Variation No. 9, Nimrod | `wrk-enigma-variation-no-9-nimrod-08dbf4` |
| Elgar, Edward | Imperial March | `wrk-imperial-march` |
| Elgar, Edward | Pomp and Circumstance March No. 1 in D Major, Opus 39 | `ZP4k1djlvR7XeCAHhqKEQ` |
| Elgar, Edward | Sea Pictures | `wrk-sea-pictures-0fdd4c` |
| Falla, Manuel de | The Three-Cornered Hat | `wrk-the-three-cornered-hat-1b74f1` |
| Faure, Gabriel | Pavane for Orchestra | `wrk-pavane-for-orchestra-f79d04` |
| Frank, Gabriela Lena | Three Latin American Dances | `wrk-three-latin-american-dances-964215` |
| Gershwin, George | Porgy and Bess: A Symphonic Picture | `wrk-porgy-and-bess-a-symphonic-pic-26550e` |
| Gershwin, George | Rhapsody in Blue | `wrk-rhapsody-in-blue` |
| Greenhoe, Eli | "Sojourn" for Chamber Orchestra | `wrk-sojourn-for-chamber-orchestra-e590c7` |
| Greenhoe, Eli | Learning to Dance | `wrk-learning-to-dance-f76f89` |
| Griffes, Charles | Poem for Flute and Orchestra | `wrk-poem-for-flute-and-orchestra-62bdc2` |
| Gurria-Cardenas, Jose | Malintzin | `wrk-malintzin-bf7724` |
| Gustavson, Mark | Hymn to the Vanished | `542oxPwDnDOCKEQ7pDIXJr` |
| Handel, George Frideric | Overture to The Messiah | `wrk-overture-to-the-messiah` |
| Haydn, Franz Joseph | The Creation | `wrk-the-creation-fd7c46` |
| Hindemith, Paul | Nobilissima Visione | `wrk-nobilissima-visione-b3313c` |
| Hindemith, Paul | Symphonic Metamorphosis on Themes of Carl Maria von Weber | `wrk-symphonic-metamorphosis-on-themes-of-carl-maria-von-weber` |
| Holst, Gustav | Brook Green Suite | `wrk-brook-green-suite` |
| Holst, Gustav | The Planets, 5 mvts | `wrk-the-planets-5-mvts-ce17cb` |
| Honegger, Arthur | Mouvement Symphonique No. 1: Pacific 231 | `wrk-mouvement-symphonique-no-1-pac-1e3fdb` |
| Kempton, Jeremy Niles | Ricercar for Sonorous Instruments | `wrk-ricercar-for-sonorous-instrume-ed9460` |
| Kennan, Kent | Night Soliloquy | `wrk-night-soliloquy-507f8a` |
| Liszt, Franz | Hungarian Rhapsody No. 1 | `wrk-hungarian-rhapsody-no-1` |
| Liszt, Franz | Les Preludes (d'apres Lamartine) | `wrk-les-preludes-d-apres-lamartine-2a1468` |
| Mackey, John | Redline Tango | `wrk-redline-tango-6f46e6` |
| Mahler, Gustav | Das Lied von der Erde | `wrk-das-lied-von-der-erde-86e602` |
| Mahler, Gustav | Kindertotenlieder | `wrk-kindertotenlieder-59801d` |
| Mahler, Gustav | Totenfeier | `wrk-totenfeier-ea23a3` |
| Marquez, Arturo | Danzon No. 2 | `wrk-danzon-no-2-a544d0` |
| Marquez, Arturo | Danzon No. 4 | `wrk-danzon-no-4-e6645c` |
| Minotto, Paul | The Persistence of Memory | `wrk-the-persistence-of-memory-a7a439` |
| Mozart, Wolfgang Amadeus | Andante in C Major | `wrk-andante-in-c-major-aa83cd` |
| Mussorgsky, Modest | Pictures at an Exhibition | `wrk-pictures-at-an-exhibition-981048` |
| Mussorgsky, Modest | Songs and Dances of Death | `wrk-songs-and-dances-of-death-b552b9` |
| Ng, Ian | How Fair Thou Dost Shine | `wrk-how-fair-thou-dost-shine-180160` |
| Piazzolla, Astor | Tangazo | `wrk-tangazo-7304a0` |
| Price, Florence | String Quartet No. 2 in A Minor for String Orchestra, mvt II | `wrk-string-quartet-no-2-in-a-minor-30870f` |
| Prokofiev, Sergei | Peter and the Wolf | `wrk-peter-and-the-wolf-6fd0cb` |
| Puccini, Giacomo | Act I, Tosca | `wrk-act-i-tosca-a29b2e` |
| Puccini, Giacomo | Messa a Quattro Voci | `wrk-messa-a-quattro-voci-602909` |
| Purcell, Henry | Voluntary and March | `5EW1K5eENrxVd4NkjkeTOC` |
| Rachmaninoff, Sergei | Symphonic Dances | `wrk-symphonic-dances-7e6195` |
| Rastegar, Nicholas | Ode to Youth | `wrk-ode-to-youth-c4edd2` |
| Ravel, Maurice | Le Tombeau de Couperin | `wrk-le-tombeau-de-couperin-4a9a87` |
| Ravel, Maurice | Rapsodie Espagnole | `wrk-rapsodie-espagnole-584920` |
| Ravel, Maurice | Valses Nobles et Sentimentales | `wrk-valses-nobles-et-sentimentales-51832b` |
| Respighi, Ottorino | Ancient Airs and Dances, Suite No. 3 | `wrk-ancient-airs-and-dances-suite-no-3` |
| Respighi, Ottorino | Fountains of Rome | `wrk-fountains-of-rome-1afa0e` |
| Respighi, Ottorino | Pines of Rome | `wrk-pines-of-rome-262724` |
| Revueltas, Silvestre | Sensemaya ("The Snake Killing Ritual") | `wrk-sensemaya-the-snake-killing-ri-4096c8` |
| Revueltas, Silvestre | Ventanas | `wrk-ventanas-e3f856` |
| Rimsky-Korsakov, Nikolai | Scheherazade | `wrk-scheherazade-7b23e4` |
| Rodrigo, Joaquin | Concierto de Aranjuez | `wrk-concierto-de-aranjuez-b2315c` |
| Rossini, Gioachino | Act I Finale, L'Italiana in Algeri | `wrk-act-i-finale-l-italiana-in-alg-ad9781` |
| Saint-Saens, Camille | Introduction and Rondo Capriccioso | `wrk-introduction-and-rondo-capriccioso` |
| Saint-Saens, Camille | La Muse et Le Poete | `wrk-la-muse-et-le-poete-2d515a` |
| Schoenberg, Arnold | Kammersymphonie No. 1 in E Major | `wrk-kammersymphonie-no-1-in-e-majo-189b0a` |
| Sedivec, Kristen | Garden Gnomes of Doom | `wrk-garden-gnomes-of-doom-a3be3a` |
| Silverman, Eric | Windup | `wrk-windup-6fac65` |
| Steffe, William | Battle Hymn of the Republic | `wrk-battle-hymn-of-the-republic` |
| Stookey, Nathaniel | The Composer is Dead | `wrk-the-composer-is-dead-e0ea20` |
| Strauss, Johann II | Perpetuum Mobile | `wrk-perpetuum-mobile-5eeb0c` |
| Strauss, Josef | Spharenklange Waltzer ("Music of the Spheres") | `wrk-spharenklange-waltzer-music-of-29fe4d` |
| Strauss, Richard | Death and Transfiguration | `wrk-death-and-transfiguration-9b791c` |
| Strauss, Richard | Four Last Songs | `wrk-four-last-songs-5c975a` |
| Stravinsky, Igor | Petroushka - A Burlesque in Four Parts (rev. 1947) | `wrk-petroushka-a-burlesque-in-four-37cd26` |
| Tchaikovsky, Pyotr Ilyich | Capriccio Italien | `wrk-capriccio-italien-1b9d75` |
| Tchaikovsky, Pyotr Ilyich | Serenade for Strings | `wrk-serenade-for-strings` |
| Tippett, Michael | A Child of Our Time | `wrk-a-child-of-our-time-189af2` |
| Vaughan Williams, Ralph | The Lark Ascending | `wrk-the-lark-ascending-cd5f4e` |
| Verdi, Giuseppe | Act III, Rigoletto | `wrk-act-iii-rigoletto-b1491b` |
| Viens, Michael C. | Hummingbirds for Orchestra | `wrk-hummingbirds-for-orchestra-wor-d97c31` |
| Villa-Lobos, Heitor | Bachianas Brasileiras No. 5 for Soprano and Cellos | `wrk-bachianas-brasileiras-no-5-for-b82393` |
| Villa-Lobos, Heitor | Bachianas Brasileiras No. 8 | `wrk-bachianas-brasileiras-no-8-b4997d` |
| Walton, William | Belshazzar's Feast | `wrk-belshazzar-s-feast-e793e7` |
| White, Richard | Childhood Scenes | `wrk-childhood-scenes-8e8456` |
| Wiprud, Theodore | Hosannas of the Second Heaven | `wrk-hosannas-of-the-second-heaven-0945c7` |
| Wood, James | Rogosanti for Multipercussion Solo | `wrk-rogosanti-for-multipercussion-d0981d` |
