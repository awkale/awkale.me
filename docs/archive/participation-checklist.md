# Performance-participation checklist

**Default is "I played it." Only mark exceptions.**

This file covers **three institutions**, under three `#` headings, and the split
is load-bearing rather than cosmetic. `seed_participation.py` and
`participation.test.ts` both read only the Brooklyn section: every concert there
is resolved against `bso-graph.json`, which holds the Brooklyn lineage alone, so
a date from any other institution stops the run. Both parsers carry a comment
saying so.

**The third institution needed no parser change**, which is worth recording
because AWK-59's version of this paragraph predicted it would. Both parsers gate
on the section heading starting with `Brooklyn lineage` and skip every other `#`
section, so the boundary was already general rather than a list of two — AWK-82
added LISFA and both parsers still see exactly the 128 Brooklyn dates.

The three sections are not the same kind of record. Brooklyn is Seed data —
loaded in bulk, most of it predating Alex, which is why every box needs review.
The Long Island Youth Orchestra and Long Island String Festival Association
sections are entered by hand, one source at a time, and Alex played all of both.

# Brooklyn lineage — in-scope concerts (2001-05-24 →)

128 concerts, 120 distinct programs, 348 distinct works.
384 distinct `programItem` entries, but **407 concert x item pairs** — the 8 two-performance
runs share one program across two dates, so the boxes below total 407.

- Tick `missed whole concert` if you weren't on that date at all.
- Tick an individual item only if you played the concert but sat that work out.
- Programs shown here are the *corrected* ones (the four split runs are merged).
- `[run]` marks a date sharing its program with another date — same program, two performances.


## Season 28 — 2001

### 2001-05-24 · Thu · Walt Whitman Hall · Nicholas Armstrong (BHO)
- [ ] missed whole concert
  - [ ] 1. Rossini — The William Tell Overture
  - [ ] 2. van Beethoven — Piano Concerto No. 3 in C Minor
  - [ ] 3. Kodaly — Variations on a Hungarian Theme ("Peacock")

## Season 29 — 2001–2002

### 2001-11-08 · Thu · Walt Whitman Hall · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Sibelius — Violin Concerto in D Minor
  - [ ] 2. Mahler — Symphony No. 1 in D Major ("Titan")

### 2001-12-20 · Thu · Walt Whitman Hall · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Schubert — Symphony No. 5 in B-flat Major
  - [ ] 2. Strauss — Duet Concertino for Clarinet and Bassoon
  - [ ] 3. Gustavson — Hymn to the Vanished
  - [ ] 4. Vaughan Williams — Symphony No. 5 in D Major

### 2002-02-14 · Thu · Walt Whitman Hall · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Kraft — Symphonic Prelude
  - [ ] 2. Hindemith — Nobilissima Visione
  - [ ] 3. Elgar — Cello Concerto in E Minor

### 2002-04-04 · Thu · Walt Whitman Hall · Arkady Leytush (BSO)
- [ ] missed whole concert
  - [ ] 1. van Beethoven — Piano Concerto No. 5 in E-flat Major ("Emperor")
  - [ ] 2. Tchaikovsky — Symphony No. 6 in B Minor ("Pathetique")

### 2002-05-23 · Thu · Walt Whitman Hall · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Debussy — Prelude a l'apres midi d'un faune
  - [ ] 2. Roussel — Concert pour petit orchestre
  - [ ] 3. Debussy — Danse Sacree et Danse Profane
  - [ ] 4. Stravinsky — Divertimento, The Fairy's Kiss Suite

## Season 30 — 2002–2003

### 2002-10-17 · Thu · Walt Whitman Hall · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. van Beethoven — Consecration of the House Overture
  - [ ] 2. Mozart — Sinfonia Concertante for 4 Winds in E-flat Major
  - [ ] 3. Dvorak — Symphony No. 9 in E Minor ("From the New World")

### 2002-12-12 · Thu · Walt Whitman Hall · Karen Pinoci (BSO)
- [ ] missed whole concert
  - [ ] 1. Leoncavallo — Scenes from I Pagliacci
  - [ ] 2. Sibelius — Symphony No. 2 in D Major

### 2003-02-13 · Thu · Walt Whitman Hall · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Adams — The Chairman Dances
  - [ ] 2. Gould — Tap Dance Concerto
  - [ ] 3. Bernstein — Fancy Free

### 2003-04-03 · Thu · Walt Whitman Hall · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Stravinsky — Symphony in C Major
  - [ ] 2. Wiprud — Hosannas of the Second Heaven
  - [ ] 3. Rachmaninoff — Piano Concerto No. 2 in C Minor

### 2003-05-21 · Wed · Walt Whitman Hall · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Vaughan Williams — Serenade to Music
  - [ ] 2. van Beethoven — Symphony No. 9 in D Minor ("Choral")

## Season 31 — 2003–2004

### 2003-10-22 · Wed · Walt Whitman Hall · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Wagner — Prelude, Die Meistersinger von Nurnberg
  - [ ] 2. Mendelssohn — Concerto for Violin, Piano and Strings
  - [ ] 3. Mussorgsky — Pictures at an Exhibition

### 2003-12-10 · Wed · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Holst — The Perfect Fool Ballet
  - [ ] 2. Haydn — Symphony No. 94 in G Major ("Surprise")
  - [ ] 3. Debussy — Images pour Orchestre, No. 2 "Iberia"

### 2004-02-11 · Wed · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Strauss — Overture, The Gypsy Baron
  - [ ] 2. Hause — Trumpet Concerto
  - [ ] 3. Shostakovich — Symphony No. 1 in F Minor

### 2004-03-31 · Wed · Church of St. Ann & the Holy Trinity · Arkady Leytush (BSO)
- [ ] missed whole concert
  - [ ] 1. Grieg — Piano Concerto in A Minor
  - [ ] 2. Brahms — Symphony No. 4 in E Minor

### 2004-05-26 · Wed · Walt Whitman Hall · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Strauss — Dance of the Seven Veils, from Salome
  - [ ] 2. Silverman — Windup
  - [ ] 3. Elgar — Variations on an Original Theme, "Enigma"

## Season 32 — 2004–2005

### 2004-10-20 · Wed · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Ravel — Valses Nobles et Sentimentales
  - [ ] 2. Rimsky-Korsakov — Scheherazade

### 2004-12-12 · Sun · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Ives — Variations on "America"
  - [ ] 2. Beavers — Concerto for Marimba
  - [ ] 3. Wood — Rogosanti for Multipercussion Solo
  - [ ] 4. Thompson — Symphony No. 2

### 2005-03-09 · Wed · Church of St. Ann & the Holy Trinity · Tara Simoncic (BSO)
- [ ] missed whole concert
  - [ ] 1. Chabrier — Espana
  - [ ] 2. de Sarasate — Carmen Fantasy
  - [ ] 3. Tchaikovsky — Symphony No. 5 in E Minor

### 2005-04-27 · Wed · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Rossini — Overture, La Cenerentola
  - [ ] 2. Chopin — Piano Concerto No. 1 in E Minor
  - [ ] 3. van Beethoven — Symphony No. 3 in E-flat Major ("Eroica")

### 2005-06-22 · Wed · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Wagner — Overture, Tannhauser
  - [ ] 2. Puccini — Act I, Tosca
  - [ ] 3. Ponchielli — The Dance of the Hours, from La Gioconda
  - [ ] 4. Verdi — Act III, Rigoletto

## Season 33 — 2005–2006

### 2005-10-23 · Sun · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Mozart — Andante in C Major
  - [ ] 2. Mendelssohn — Violin Concerto in E Minor
  - [ ] 3. Saint-Saens — Symphony No. 3 in C Minor ("Organ")

### 2005-12-11 · Sun · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Verdi — Trumphal March & Ballet Music, from Aida (Act II)
  - [ ] 2. Janacek — Sinfonietta
  - [ ] 3. Brahms — Double Concerto in A Minor

### 2006-02-19 · Sun · Church of St. Ann & the Holy Trinity · David Hattner (BSO)
- [ ] missed whole concert
  - [ ] 1. Grofe — Grand Canyon Suite, mvt I ("Sunrise")
  - [ ] 2. Cowell — Hymn and Fuguing Tune No. 3
  - [ ] 3. Kennan — Night Soliloquy
  - [ ] 4. Griffes — Poem for Flute and Orchestra
  - [ ] 5. Barber — First Essay
  - [ ] 6. Copland — Billy the Kid Ballet Suite

### 2006-04-02 · Sun · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Strauss — The Blue Danube Waltz
  - [ ] 2. Mahler — Symphony No. 5 in C-sharp Minor / D Major

### 2006-05-17 · Wed · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO) `[run]`
- [ ] missed whole concert
  - [ ] 1. Haydn — The Creation

### 2006-05-21 · Sun · Old First Reformed Church · Nicholas Armstrong (BSO) `[run]`
- [ ] missed whole concert
  - [ ] 1. Haydn — The Creation

## Season 34 — 2006–2007

### 2006-10-28 · Sat · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Bernstein — Overture, Candide
  - [ ] 2. Mozart — Sinfonia Concertante in E-flat Major
  - [ ] 3. Stravinsky — Petroushka - A Burlesque in Four Parts (rev. 1947)

### 2006-12-17 · Sun · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Humperdinck — Prelude, Hansel und Gretel
  - [ ] 2. Purcell — Abdelazer, or The Moor's Revenge Suite
  - [ ] 3. Britten — The Young Person's Guide to the Orchestra
  - [ ] 4. Tchaikovsky — The Nutcracker Suite
  - [ ] 5. Anderson — Sleigh Ride

### 2007-02-18 · Sun · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. van Beethoven — Leonore Overture No. 3
  - [ ] 2. Petrova — Cello Concerto No. 1 "Seven Beats"
  - [ ] 3. van Beethoven — Symphony No. 4 in B-flat Major

### 2007-04-15 · Sun · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Minotto — The Persistence of Memory
  - [ ] 2. Strauss — Horn Concerto No. 1 in E-flat Major
  - [ ] 3. Glazunov — Symphony No. 4 in E-flat Major

### 2007-05-20 · Sun · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO) `[run]`
- [ ] missed whole concert
  - [ ] 1. Addinsell — Warsaw Concerto from "Dangerous Moonlight"
  - [ ] 2. Rota — Ballet Suite from "La Strada"
  - [ ] 3. Prokofiev — Cantata of "Alexander Nevsky"

### 2007-05-23 · Wed · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO) `[run]`
- [ ] missed whole concert
  - [ ] 1. Addinsell — Warsaw Concerto from "Dangerous Moonlight"
  - [ ] 2. Rota — Ballet Suite from "La Strada"
  - [ ] 3. Prokofiev — Cantata of "Alexander Nevsky"

## Season 35 — 2007–2008

### 2007-10-21 · Sun · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Enescu — Romanian Rhapsody No. 1 in A Major
  - [ ] 2. Brahms — Piano Quartet in G Minor

### 2007-12-09 · Sun · The Perry Theatre · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Mozart — Symphony No. 41 in C Major ("Jupiter")

### 2007-12-16 · Sun · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Bossert — Music for Film
  - [ ] 2. Mendelssohn — Symphony No. 3 in A Minor ("Scottish")

### 2008-02-17 · Sun · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Kodaly — Hary Janos Suite
  - [ ] 2. Schumann — Piano Concerto in A Minor
  - [ ] 3. Poulenc — Les Animaux Modeles, Suite de Ballet

### 2008-04-06 · Sun · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Turina — Danzas Fantasticas
  - [ ] 2. Villa-Lobos — Bachianas Brasileiras No. 8
  - [ ] 3. Revueltas — Sensemaya ("The Snake Killing Ritual")
  - [ ] 4. Ravel — Rapsodie Espagnole

### 2008-05-16 · Fri · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO) `[run]`
- [ ] missed whole concert
  - [ ] 1. Tippett — A Child of Our Time

### 2008-05-18 · Sun · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO) `[run]`
- [ ] missed whole concert
  - [ ] 1. Tippett — A Child of Our Time

## Season 36 — 2008–2009

### 2008-10-26 · Sun · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Puccini — Preludio Sinfonico
  - [ ] 2. Bartok — The Miraculous Manadrin Suite
  - [ ] 3. Rachmaninoff — Piano Concerto No. 4 in G Minor

### 2008-12-13 · Sat · Grand Street Campus High Schools · Nicholas Armstrong (BSO) `[run]`
- [x] missed whole concert
  - [ ] 1. Tchaikovsky — Capriccio Italien
  - [ ] 2. Liebermann — Concerto for Piccolo
  - [ ] 3. Delibes — Coppelia Ballet Suite

### 2008-12-14 · Sun · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO) `[run]`
- [ ] missed whole concert
  - [ ] 1. Tchaikovsky — Capriccio Italien
  - [ ] 2. Liebermann — Concerto for Piccolo
  - [ ] 3. Delibes — Coppelia Ballet Suite

### 2009-02-22 · Sun · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Nicolai — Overture, The Merry Wives of Windsor
  - [ ] 2. Zwilich — Concerto for Bass Trombone, Strings, Timpani & Cymbals
  - [ ] 3. van Beethoven — Symphony No. 6 in F Major ("Pastoral")

### 2009-04-19 · Sun · Church of St. Ann & the Holy Trinity · John Yaffe (BSO)
- [ ] missed whole concert
  - [ ] 1. Earnest — Southern Exposure
  - [ ] 2. Arutiunian — Trumpet Concerto
  - [ ] 3. Shostakovich — Symphony No. 9 in E-flat Major

### 2009-05-31 · Sun · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Mahler — Das Lied von der Erde

## Season 37 — 2009–2010

### 2009-10-25 · Sun · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Wagner — Overture, Rienzi
  - [ ] 2. Mozart — Oboe Concerto in C Major
  - [ ] 3. Tchaikovsky — Suite No. 2 in C Major

### 2009-12-20 · Sun · Church of St. Ann & the Holy Trinity · Nancy Havens-Hasty (BSO)
- [ ] missed whole concert
  - [ ] 1. Sullivan — Overture, The Yeomen of the Guard (1888)
  - [ ] 2. Walton — Concerto for Viola and Orchestra (1962)
  - [ ] 3. Vaughan Williams — A London Symphony (Symphony No. 2)

### 2010-02-21 · Sun · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Smetana — The Bartered Bride, Overture and Three Dances:
  - [ ] 2. von Weber — Bassoon Concerto in F Major
  - [ ] 3. Dukas — Symphony in C Major

### 2010-04-11 · Sun · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Strauss — Spharenklange Waltzer ("Music of the Spheres")
  - [ ] 2. Holst — The Planets, 5 mvts
  - [ ] 3. Williams — Music from "Close Encounters of the Third Kind"
  - [ ] 4. Williams — Adventures on Earth, from "E.T. The Extra-Terrestrial"

### 2010-06-06 · Sun · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Weill — Suite from The Threepenny Opera
  - [ ] 2. Schoenberg — Kammersymphonie No. 1 in E Major
  - [ ] 3. Rachmaninoff — Symphonic Dances

## Season 38 — 2010–2011

### 2010-10-31 · Sun · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Cohn — Symphony No. 2 in F Major
  - [ ] 2. Mahler — Kindertotenlieder
  - [ ] 3. Ravel — La Valse

### 2010-12-19 · Sun · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Liszt — Hungarian Rhapsody No. 2 in D Minor
  - [ ] 2. Saint-Saens — La Muse et Le Poete
  - [ ] 3. Dvorak — Symphony No. 6 in D Major

### 2011-02-20 · Sun · Church of St. Ann & the Holy Trinity · Marc Cerri (BSO)
- [ ] missed whole concert
  - [ ] 1. Glinka — Overture, Russlan and Ludmilla
  - [ ] 2. Gliere — Horn Concerto in B-flat Major
  - [ ] 3. Shostakovich — Symphony No. 5 in D Minor

### 2011-04-08 · Fri · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO) `[run]`
- [ ] missed whole concert
  - [ ] 1. Respighi — Fountains of Rome
  - [ ] 2. Rossini — "Largo al Factotum", from Il Barbiere di Siviglia
  - [ ] 3. Donizetti — "Ah! Mes Amis", from La Fille du Regiment
  - [ ] 4. Bizet — "Au Fond du Temple Saint", from Les Pecheurs de Perles
  - [ ] 5. Puccini — "O Mimi, tu piu non torni", from La Boheme
  - [ ] 6. Puccini — Messa a Quattro Voci

### 2011-04-10 · Sun · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO) `[run]`
- [ ] missed whole concert
  - [ ] 1. Respighi — Fountains of Rome
  - [ ] 2. Rossini — "Largo al Factotum", from Il Barbiere di Siviglia
  - [ ] 3. Donizetti — "Ah! Mes Amis", from La Fille du Regiment
  - [ ] 4. Bizet — "Au Fond du Temple Saint", from Les Pecheurs de Perles
  - [ ] 5. Puccini — "O Mimi, tu piu non torni", from La Boheme
  - [ ] 6. Puccini — Messa a Quattro Voci

### 2011-06-05 · Sun · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Mendelssohn — Overture, A Midsummer Night's Dream
  - [ ] 2. Sedivec — Garden Gnomes of Doom
  - [ ] 3. van Beethoven — Symphony No. 5 in C Minor

## Season 39 — 2011–2012

### 2011-10-30 · Sun · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [x] 1. Haydn — Divertimento (Feldparthie) in B-flat Major
  - [ ] 2. Brahms — Variations on a Theme by Haydn
  - [ ] 3. Brahms — Piano Concerto No. 1 in D Minor

### 2011-12-18 · Sun · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Tchaikovsky — The Year 1812 Overture
  - [ ] 2. Gershwin — Porgy and Bess: A Symphonic Picture
  - [ ] 3. Dukas — The Sorcerer's Apprentice
  - [ ] 4. Tchaikovsky — The Nutcracker Suite

### 2012-02-26 · Sun · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Honegger — Mouvement Symphonique No. 1: Pacific 231
  - [ ] 2. Poulenc — Les Biches Suite
  - [ ] 3. Satie — Parade
  - [ ] 4. Stravinsky — The Firebird Suite (1919)

### 2012-04-15 · Sun · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Mussorgsky — Songs and Dances of Death
  - [ ] 2. Greenhoe — "Sojourn" for Chamber Orchestra
  - [ ] 3. Rachmaninoff — Symphony No. 2 in E Minor

### 2012-06-03 · Sun · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Dvorak — Cello Concerto in B Minor
  - [ ] 2. Sibelius — Symphony No. 5 in E-flat Major

## Season 40 — 2012–2013

### 2012-10-26 · Fri · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO) `[run]`
- [ ] missed whole concert
  - [ ] 1. Verdi — Prelude to Act I, La Traviata
  - [ ] 2. Saint-Saens — Bacchanale, from Samson et Dalila
  - [ ] 3. Delibes — Flower Duet, from Lakme
  - [ ] 4. Rossini — Act I Finale, L'Italiana in Algeri
  - [ ] 5. Bizet — Act II, Carmen
  - [ ] 6. Donizetti — Act II Finale, Lucia di Lammermoor

### 2012-10-28 · Sun · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO) `[run]`
- [ ] missed whole concert
  - [ ] 1. Verdi — Prelude to Act I, La Traviata
  - [ ] 2. Saint-Saens — Bacchanale, from Samson et Dalila
  - [ ] 3. Delibes — Flower Duet, from Lakme
  - [ ] 4. Rossini — Act I Finale, L'Italiana in Algeri
  - [ ] 5. Bizet — Act II, Carmen
  - [ ] 6. Donizetti — Act II Finale, Lucia di Lammermoor

### 2012-12-16 · Sun · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Glazunov — Concert Waltz No. 2 in F Major
  - [ ] 2. Chopin — Les Sylphides Ballet Suite
  - [ ] 3. Tchaikovsky — Piano Concerto No. 1 in B-flat Minor

### 2013-02-24 · Sun · Church of St. Ann & the Holy Trinity · Nolan Dresen (BSO)
- [ ] missed whole concert
  - [ ] 1. Dvorak — Carnival Overture
  - [ ] 2. Mackey — Redline Tango
  - [ ] 3. Barber — Serenade for Strings
  - [ ] 4. Respighi — Pines of Rome

### 2013-04-14 · Sun · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Haydn — Symphony No. 104 In D Major ("London")
  - [ ] 2. Bach — Brandenburg Concerto No. 1 in F Major
  - [ ] 3. Mendelssohn — Symphony No. 5 in D Major ("Reformation")

### 2013-05-31 · Fri · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO) `[run]`
- [ ] missed whole concert
  - [ ] 1. van Beethoven — Missa Solemnis (Mass in D Major)

### 2013-06-02 · Sun · Church of St. Ann & the Holy Trinity · Nicholas Armstrong (BSO) `[run]`
- [ ] missed whole concert
  - [ ] 1. van Beethoven — Missa Solemnis (Mass in D Major)

## Season 41 — 2013–2014

### 2013-10-20 · Sun · Brooklyn Museum of Art · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Marquez — Danzon No. 2
  - [ ] 2. Rastegar — Ode to Youth
  - [ ] 3. Brahms — Symphony No. 2 in D Major

### 2013-12-15 · Sun · Brooklyn Museum of Art · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Barber — Overture to Sheridan's The School for Scandal
  - [ ] 2. Respighi — Ancient Airs and Dances, Suite No. 2
  - [ ] 3. Ng — How Fair Thou Dost Shine
  - [ ] 4. Khachaturian — Spartacus, Suite No. 2

### 2014-02-23 · Sun · Brooklyn Museum of Art · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Copland — Lincoln Portrait
  - [ ] 2. Tchaikovsky — Symphony No. 5 in E Minor

### 2014-04-20 · Sun · Brooklyn Museum of Art · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Rimsky-Korsakov — Russian Easter Overture
  - [ ] 2. Anderson — Spirit Guide (World Premiere)
  - [ ] 3. Mahler — Totenfeier

### 2014-06-01 · Sun · Brooklyn Museum of Art · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Prokofiev — Romeo and Juliet Suite No. 2
  - [ ] 2. Greenhoe — Learning to Dance
  - [ ] 3. Berlioz — Symphonie Fantastique

## Season 42 — 2014–2015

### 2014-10-26 · Sun · Brooklyn Museum of Art · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Mozart — Symphony No. 41 in C Major ("Jupiter")
  - [ ] 2. Brahms — Violin Concerto in D Major

### 2014-12-21 · Sun · Brooklyn Museum of Art · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Delius — Sleigh Ride
  - [ ] 2. Butterworth — A Shropshire Lad, "Rhapsody for Orchestra"
  - [ ] 3. Vaughan Williams — Fantasia on a Theme by Thomas Tallis
  - [ ] 4. Hely-Hutchinson — A Carol Symphony

### 2015-02-22 · Sun · Brooklyn Museum of Art · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. von Weber — Overture, Der Freischutz
  - [ ] 2. Villa-Lobos — Bachianas Brasileiras No. 5 for Soprano and Cellos
  - [ ] 3. Wagner — Vorspiel und Liebestod, from Tristan und Isolde
  - [ ] 4. Strauss — Four Last Songs

### 2015-04-23 · Thu · Brooklyn Museum of Art · Nicholas Armstrong (BSO) `[run]`
- [ ] missed whole concert
  - [ ] 1. Tippett — Ritual Dances, from The Midsummer Marriage
  - [ ] 2. Walton — Belshazzar's Feast

### 2015-04-26 · Sun · Brooklyn Museum of Art · Nicholas Armstrong (BSO) `[run]`
- [ ] missed whole concert
  - [ ] 1. Tippett — Ritual Dances, from The Midsummer Marriage
  - [ ] 2. Walton — Belshazzar's Feast

### 2015-05-31 · Sun · Brooklyn Museum of Art · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Strauss — Der Rosenkavalier Suite
  - [ ] 2. Prokofiev — Symphony No. 5 in B-flat Major

## Season 43 — 2015–2016

### 2015-10-25 · Sun · Brooklyn Museum of Art · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Verdi — Overture, Nabucco
  - [ ] 2. Janacek — The Cunning Little Vixen Suite
  - [ ] 3. Bruch — Double Concerto in E Minor

### 2015-12-13 · Sun · Brooklyn Museum of Art · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Gershwin — Cuban Overture
  - [ ] 2. Rodrigo — Concierto de Aranjuez
  - [ ] 3. Whelan — Symphonic Suite, from Riverdance

### 2016-02-28 · Sun · Brooklyn Museum of Art · Linus Lerner (BSO)
- [ ] missed whole concert
  - [ ] 1. Brahms — Double Concerto in A Minor
  - [ ] 2. Sibelius — Symphony No. 2 in D Major

### 2016-04-17 · Sun · Brooklyn Museum of Art · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Khachaturian — Masquerade Suite
  - [ ] 2. Barber — Knoxville: Summer of 1915
  - [ ] 3. Dvorak — Symphony No. 7 in D Minor

### 2016-05-22 · Sun · Brooklyn Museum of Art · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Debussy — Petite Suite
  - [ ] 2. Dvorak — Violin Concerto in A Minor, mvt I
  - [ ] 3. Elgar — Cello Concerto in E Minor, mvts I, II
  - [ ] 4. Mozart — Clarinet Concerto in A Major, mvt I
  - [ ] 5. Ravel — Le Tombeau de Couperin

## Season 44 — 2016–2017

### 2016-10-23 · Sun · Brooklyn Museum of Art · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Rossini — Overture, Semiramide
  - [ ] 2. Bartok — Viola Concerto
  - [ ] 3. van Beethoven — Symphony No. 7 in A Major

### 2016-12-18 · Sun · Brooklyn Museum of Art · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Tchaikovsky — Fantasy Overture, Romeo and Juliet
  - [ ] 2. Rimsky-Korsakov — Capriccio Espagnol
  - [ ] 3. de Falla — The Three-Cornered Hat
  - [ ] 4. Ravel — Bolero

### 2017-02-19 · Sun · Brooklyn Museum of Art · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Offenbach — Overture, Orpheus in the Underworld
  - [ ] 2. Faure — Pelleas et Melisande Suite
  - [ ] 3. Walton — Music from Façade Suite Nos. 1 and 2
  - [ ] 4. Gershwin — An American in Paris

### 2017-04-09 · Sun · Brooklyn Museum of Art · David Bernard (BSO)
- [ ] missed whole concert
  - [ ] 1. Stravinsky — The Firebird Suite (1919)
  - [ ] 2. Rimsky-Korsakov — Scheherazade

### 2017-06-04 · Sun · Brooklyn Museum of Art · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Mussorgsky — Night on Bald Mountain
  - [ ] 2. Shostakovich — Cello Concerto in E-flat Major
  - [ ] 3. Borodin — Symphony No. 2 in B Minor

## Season 45 — 2017–2018

### 2017-10-29 · Sun · Brooklyn Museum of Art · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Mozart — Symphony No. 36 in C Major ("Linz")
  - [ ] 2. Bruckner — Symphony No. 1 (1866)

### 2017-12-17 · Sun · Brooklyn Museum of Art · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Liszt — Mephisto Waltz No. 1
  - [ ] 2. Bottesini — Bass Concerto No. 2 in B Minor
  - [ ] 3. Schumann — Symphony No. 4 in D Minor (1851)

### 2018-02-25 · Sun · Brooklyn Museum of Art · Felipe Tristan (BSO)
- [ ] missed whole concert
  - [x] 1. Strauss — Seranade for 13 Winds
  - [ ] 2. Bernstein — Symphonic Dances, from West Side Story
  - [ ] 3. Barber — Adagio for Strings
  - [ ] 4. Respighi — Pines of Rome

### 2018-04-22 · Sun · Brooklyn Museum of Art · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Delius — The Walk to the Paradise Garden
  - [ ] 2. Brant — Concerto for Alto Saxophone
  - [ ] 3. Elgar — Variations on an Original Theme, "Enigma"

### 2018-06-16 · Sat · Brooklyn Museum of Art · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Gottschalk — Symphonie Romantique: A Night in the Tropics
  - [ ] 2. Copland — Rodeo: Four Dance Episodes
  - [ ] 3. Dvorak — Symphony No. 9 in E Minor ("From the New World")

## Season 46 — 2018–2019

### 2018-10-28 · Sun · Brooklyn Museum of Art · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Bizet — Carmen Suite No. 2
  - [ ] 2. Canteloube — Chants d'Auvergne
  - [ ] 3. Ravel — Daphnis et Chloe Suite No. 2

### 2018-12-16 · Sun · Brooklyn Museum of Art · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Arnold — A Grand, Grand Overture
  - [ ] 2. Rimsky-Korsakov — Christmas Eve Suite
  - [ ] 3. Piazzolla — Tangazo
  - [ ] 4. Stookey — The Composer is Dead

### 2019-02-24 · Sun · Brooklyn Museum of Art · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Revueltas — Ventanas
  - [ ] 2. Copland — El Salon Mexico
  - [ ] 3. Gershwin — Overture to Girl Crazy
  - [ ] 4. Chavez — Horse-Power: Ballet Symphony

### 2019-04-14 · Sun · Brooklyn Museum of Art · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Mendelssohn — The Hebrides Overture
  - [ ] 2. Vaughan Williams — Norfolk Rhapsody No. 1
  - [ ] 3. Holst — Symphony in F Major ("The Cotswolds")
  - [ ] 4. Korngold — Violin Concerto in D Major

### 2019-06-09 · Sun · Brooklyn Museum of Art · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Borodin — Overture, Prince Igor
  - [x] 2. Stravinsky — Octet for Winds
  - [ ] 3. Shostakovich — Symphony No. 10 in E Minor

## Season 47 — 2019–2020  
*SUSPENDED; 2020-2021 SEASON CANCELED, DUE TO COVID-19 PANDEMIC*

### 2019-10-27 · Sun · Brooklyn Museum of Art · Ian Shafer (BSO)
- [ ] missed whole concert
  - [ ] 1. Wagner — Vorspiel und Liebestod, from Tristan und Isolde
  - [ ] 2. Vaughan Williams — The Lark Ascending
  - [ ] 3. Brahms — Symphony No. 3 in F Major

### 2019-12-15 · Sun · Brooklyn Museum of Art · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. White — Childhood Scenes
  - [ ] 2. Prokofiev — Peter and the Wolf
  - [ ] 3. Tchaikovsky — The Nutcracker Suite
  - [ ] 4. Tchaikovsky — The Nutcracker Suite
  - [ ] 5. Strauss — Perpetuum Mobile
  - [ ] 6. Anderson — Sleigh Ride

### 2020-02-23 · Sun · Brooklyn Museum of Art · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. van Beethoven — Leonore Overture No. 3
  - [ ] 2. Marquez — Danzon No. 4
  - [ ] 3. Tchaikovsky — Suite No. 4 in G Major ("Mozartiana")
  - [ ] 4. Kempton — Ricercar for Sonorous Instruments
  - [ ] 5. Liszt — Les Preludes (d'apres Lamartine)

## Season 48 — 2021–2022

### 2021-10-24 · Sun · Brooklyn Museum of Art · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Perry — Suite from Tawawa House
  - [ ] 2. Coleridge-Taylor — Overture to The Song of Hiawatha
  - [ ] 3. Price — Symphony No. 4 in D Minor

### 2021-12-12 · Sun · Brooklyn Museum of Art · Andy Bhasin (BSO)
- [ ] missed whole concert
  - [ ] 1. Copland — Quiet City
  - [ ] 2. Bernstein — On the Town: Three Dance Episodes
  - [ ] 3. Viens — Hummingbirds for Orchestra (World Premiere)
  - [ ] 4. Glass — Saxophone Quartet Concerto

### 2022-02-20 · Sun · Brooklyn Museum of Art · Felipe Tristan (BSO)
- [ ] missed whole concert
  - [ ] 1. Glinka — Overture, Russlan and Ludmilla
  - [ ] 2. Gurria-Cardenas — Malintzin
  - [ ] 3. Brahms — Symphony No. 4 in E Minor

### 2022-04-24 · Sun · Brooklyn Museum of Art · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [x] 1. Strauss — Sonatina No. 1 for Winds in F Major
  - [ ] 2. Finzi — Clarinet Concerto
  - [ ] 3. van Beethoven — Symphony No. 1 in C Major

### 2022-06-12 · Sun · Brooklyn Museum of Art · Andy Bhasin (BSO)
- [ ] missed whole concert
  - [ ] 1. Strauss — Emperor Waltz
  - [ ] 2. Mahler — Symphony No. 1 in D Major ("Titan")

## Season 49 — 2022–2023

### 2022-10-30 · Sun · Brooklyn Museum of Art · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Mendelssohn — Calm Sea and Prosperous Voyage Overture
  - [ ] 2. Elgar — Sea Pictures
  - [ ] 3. Bridge — The Sea

### 2022-12-18 · Sun · Brooklyn Museum of Art · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Rossini — La Boutique Fantasque
  - [ ] 2. Elgar — "Enigma" Variation No. 9, Nimrod
  - [ ] 3. Tchaikovsky — Violin Concerto in D Major

### 2023-02-26 · Sun · Brooklyn Museum of Art · Andy Bhasin (BSO)
- [ ] missed whole concert
  - [ ] 1. Wagner — Prelude to Act I, Lohengrin
  - [ ] 2. Barber — Souvenirs
  - [ ] 3. Schumann — Symphony No. 4 in D Minor (1851)

### 2023-04-16 · Sun · Brooklyn Museum of Art · David Bernard (BSO)
- [ ] missed whole concert
  - [ ] 1. Grieg — Peer Gynt Suite No. 1
  - [ ] 2. Sibelius — Violin Concerto in D Minor
  - [ ] 3. Sibelius — Symphony No. 2 in D Major

### 2023-06-11 · Sun · Brooklyn Museum of Art · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Lecuona — Andalucia Suite
  - [ ] 2. Borzoni — Antinous and Hadrian Suite
  - [ ] 3. Mozart — Piano Concerto No. 20 in D Minor
  - [ ] 4. Dvorak — Symphony No. 8. in G Major

## Season 50 — 2023–2024

### 2023-10-29 · Sun · Brooklyn Museum of Art · Felipe Tristan (BSO)
- [ ] missed whole concert
  - [ ] 1. van Beethoven — Symphony No. 7 in A Major
  - [ ] 2. Prokofiev — Selections from Romeo and Juliet Suites

### 2023-12-10 · Sun · Brooklyn Museum of Art · Felipe Tristan (BSO)
- [ ] missed whole concert
  - [ ] 1. Rossini — Overture, La Gazza Ladra
  - [ ] 2. Reinecke — Flute Concerto in D Major
  - [ ] 3. Tchaikovsky — Selections from The Nutcracker Suite

### 2024-02-18 · Sun · Brooklyn Museum of Art · Felipe Tristan (BSO)
- [ ] missed whole concert
  - [ ] 1. Khachaturian — Masquerade Suite
  - [ ] 2. Basulto — Habanera-Reggaeton (World Premiere)
  - [ ] 3. Chavez — Sinfonia India
  - [ ] 4. Bizet — Selections, Carmen

### 2024-04-21 · Sun · Brooklyn Museum of Art · Felipe Tristan (BSO)
- [x] missed whole concert
  - [ ] 1. Newman — 20th Century Fox Fanfare
  - [ ] 2. Silvestri — Suite for Orchestra from "Back to the Future"
  - [ ] 3. Debussy — Clair de Lune from Suite Bergamasque
  - [ ] 4. Badelt — Medley from "Pirates of the Caribbean"
  - [ ] 5. Rota — Love Theme from "Romeo and Juliet" (A Time for Us)
  - [ ] 6. Herrmann — Selections from "Psycho"
  - [ ] 7. Zimmer — Music from "Gladiator"
  - [ ] 8. Mancini — Theme from "The Pink Panther"
  - [ ] 9. Zimmer — Main Theme from "The Crown"
  - [ ] 10. Williams — Selections from "Star Wars"

### 2024-06-09 · Sun · Brooklyn Museum of Art · Nicholas Armstrong (BSO)
- [x] missed whole concert
  - [ ] 1. Sullivan — Overture di Ballo
  - [ ] 2. Elgar — Cello Concerto in E Minor
  - [ ] 3. Vaughan Williams — A Pastoral Symphony (Symphony No. 3)

## Season 51 — 2024–2025

### 2024-10-27 · Sun · Brooklyn Museum of Art · David Hagy (BSO)
- [ ] missed whole concert
  - [ ] 1. Price — String Quartet No. 2 in A Minor for String Orchestra, mvt II
  - [ ] 2. van Beethoven — Symphony No. 8 in F Major
  - [ ] 3. Shostakovich — Symphony No. 5 in D Minor

### 2024-12-15 · Sun · Brooklyn Museum of Art · Andrew Kim (BSO)
- [x] missed whole concert
  - [ ] 1. Berko — Condense Eternity
  - [ ] 2. Mendelssohn — Violin Concerto in E Minor
  - [ ] 3. Mendelssohn — The Hebrides Overture
  - [ ] 4. Elgar — In the South (Alassio)

### 2025-02-23 · Sun · Brooklyn Museum of Art · Nico Olarte-Hayes (BSO)
- [ ] missed whole concert
  - [ ] 1. Bologne — Overture, L'Amant Anonyme
  - [ ] 2. Faure — Pavane for Orchestra
  - [ ] 3. Sankey — Carmen Fantasy, on Themes from Bizet's Carmen
  - [ ] 4. Dvorak — Symphony No. 7 in D Minor

### 2025-04-13 · Sun · Brooklyn Museum of Art · David Bernard (BSO)
- [ ] missed whole concert
  - [ ] 1. Rimsky-Korsakov — Capriccio Espagnol
  - [ ] 2. Copland — Appalachian Spring Suite for Full Orchestra
  - [ ] 3. Brahms — Symphony No. 3 in F Major

### 2025-06-15 · Sun · Brooklyn Museum of Art · Felipe Tristan (BSO)
- [x] missed whole concert
  - [ ] 1. Verdi — Overture, La Forza del Destino
  - [ ] 2. Verdi — "Pace, pace, mio Dio", from La Forza del Destino
  - [ ] 3. Leoncavallo — "Recitar!...Vesti la giubba", from I Pagliacci
  - [ ] 4. Puccini — "O soave fanciulla", from La Boheme
  - [ ] 5. Leoncavallo — "Qual fiamma avea nel guardo!", from I Pagliacci
  - [ ] 6. Puccini — "Nessun dorma", from Turandot
  - [ ] 7. Tchaikovsky — Symphony No. 4 in F Minor

## Season 52 — 2025–2026

### 2025-10-26 · Sun · Brooklyn Museum of Art · Nicholas Armstrong (BSO)
- [ ] missed whole concert
  - [ ] 1. Adams — The Chairman Dances
  - [ ] 2. Sachse — Trombone Concertino in B-flat Major
  - [ ] 3. Roussel — Sinfonietta for String Orchestra
  - [ ] 4. Strauss — Death and Transfiguration

### 2025-12-14 · Sun · Brooklyn Museum of Art · Felipe Tristan (BSO)
- [ ] missed whole concert
  - [ ] 1. Shostakovich — Festive Overture
  - [ ] 2. Frank — Three Latin American Dances
  - [ ] 3. van Beethoven — Symphony No. 5 in C Minor

### 2026-02-15 · Sun · Brooklyn Museum of Art · Felipe Tristan (BSO)
- [x] missed whole concert
  - [ ] 1. de Falla — The Three-Cornered Hat
  - [ ] 2. Dvorak — Symphony No. 9 in E Minor ("From the New World")

### 2026-04-26 · Sun · Brooklyn Museum of Art · Felipe Tristan (BSO)
- [ ] missed whole concert
  - [ ] 1. van Beethoven — Overture, Coriolan
  - [ ] 2. Saint-Saens — Cello Concerto in A Minor
  - [ ] 3. Mendelssohn — Symphony No. 4 in A Major ("Italian")

### 2026-06-14 · Sun · Brooklyn Museum of Art · Felipe Tristan (BSO)
- [x] missed whole concert
  - [ ] 1. Debussy — Prelude a l'apres midi d'un faune
  - [ ] 2. Debussy — Danse Sacree et Danse Profane
  - [ ] 3. Rachmaninoff — Cinq Etudes-Tableaux
  - [ ] 4. Ravel — Bolero

# Long Island Youth Orchestra — Seasons 29 to 32 (1991-1992 → 1994-1995)

**Not read by `seed_participation.py`.** See the note at the top of this file.
Participation for these Concerts is set by hand in Contentful.

**Alex played every Concert of these four Seasons.** No `missed whole concert`
box is ticked and none is expected to be. Stated by Alex on 2026-08-29; no source
in this repository corroborates it, and none contradicts it.

**Item boxes here mean something narrower than in the Brooklyn section.** A
shared concert's printed program includes blocks played by the *visiting
ensembles* rather than by the orchestra, and the Concert entry holds the whole
program as printed. Those items are ticked — they are `satOut` in Contentful and
so are omitted from the rendered page — but the tick records "another ensemble
performed this", not a work Alex declined. Ten of the seventeen items on
1993-07-26 are that, and **it is the only Concert here where any of it applies**:
the three Tilles Center programs are the orchestra's own subscription concerts,
carry no visiting ensemble, and hold no `satOut` at all.

**This section is incomplete by construction.** Five Concerts are known. The rest
of Seasons 29 to 32 is undocumented here — absent from `Wikipedia BSO Archive.xlsx`,
absent from `bso-graph.json`, and represented by no program in `docs/archive/`.
Do not read the five entries below as the whole of what Alex played at this
orchestra. Add Concerts as sources appear.

A Program is listed only where a source has been transcribed. Four have been —
1993-07-26 under AWK-59, and the three Tilles Center dates under AWK-64. Only
1992-06-14 has not, and it is the one with no source in this repository.

## Season 29 — 1991–1992

### 1992-06-14 · Sun · hall not recorded · conductor not recorded (LIYO)
- [ ] missed whole concert
  - *Program not transcribed. No source in this repository — the date is Alex's
    own record.*

## Season 30 — 1992–1993

### 1992-12-13 · Sun · Tilles Center, Brookville · Martin Dreiwitz (LIYO)
- [ ] missed whole concert
  - [ ] 1. Dvorak — Carneval Overture
  - [ ] 2. Vaughan Williams — Norfolk Rhapsody #1
  - [ ] 3. Piston — Suite from the ballet "The Incredible Flutist"
  - [ ] 4. Franck — Symphony in D minor
  - *Transcribed from `docs/archive/program-19921213-liyo-tilles-center.pdf`
    under AWK-64. The 30th Anniversary season's first concert. **Susan Deaver
    conducted item 1** as Associate Conductor and Martin Dreiwitz the rest, which
    is `programItem.conductor`'s second use. Titles are the program's own
    wording: it prints "Carneval", and the Work it links has been "Carnival
    Overture" since the import. The Piston suite's nine movements and the
    Franck's three are recorded on the Works.*

### 1993-05-02 · Sun · Tilles Center, Brookville · Martin Dreiwitz (LIYO)
- [ ] missed whole concert
  - [ ] 1. van Beethoven — Leonore Overture # 3, opus 72a
  - [ ] 2. Debussy — Marche Ecossaise
  - [ ] 3. Hindemith — Symphonic Metamorphosis on Themes of Carl Maria von Weber
  - [ ] 4. Gershwin — Rhapsody in Blue
  - [ ] 5. Tchaikovsky — Overture - Fantasy "Romeo and Juliet"
  - *Transcribed from `docs/archive/program-19930502-liyo-tilles-center.pdf`
    under AWK-64. The same season's third program. Dreiwitz conducted
    throughout. **Thomas Jennings, piano**, soloed in the Rhapsody in Blue. The
    Hindemith's four movements are recorded on the Work.*

### 1993-07-26 · Mon · Dallas Brooks Hall, Melbourne · Martin Dreiwitz (LIYO)
- [ ] missed whole concert
  - [x] 1. Möller — The Happy Wanderer *(Recital Choir)*
  - [x] 2. Möller — Cuckoo Cries *(Recital Choir)*
  - [x] 3. Victoria — Ne Timeas Maria *(Victoria State Youth Choir)*
  - [x] 4. Troup — Route 66 *(Victoria State Youth Choir)*
  - [x] 5. McCartney — The Long and Winding Road *(Victoria State Youth Choir)*
  - [x] 6. Traditional — Heidenroslein *(Chamber Choir)*
  - [x] 7. Brahms — Lullaby *(Chamber Choir)*
  - [x] 8. Lloyd Webber — Pie Jesu *(Chamber Choir)*
  - [x] 9. Raposo — Tu Me Gustas *(Combined Training & Performing Choirs)*
  - [x] 10. Burns — Let's Open Up Our Hearts *(Combined Training & Performing Choirs)*
  - [ ] 11. Elgar — Imperial March
  - [ ] 12. Saint-Saens — Introduction and Rondo Capriccioso
  - [ ] 13. Tchaikovsky — "Theme and Variations", from Suite No. 3 in G Major
  - [ ] 14. Gershwin — Porgy and Bess: A Symphonic Picture
  - [ ] 15. Humperdinck — "Evening Prayer", from Hansel und Gretel *(combined)*
  - [ ] 16. Cowan — Waltzing Matilda *(combined)*
  - [ ] 17. Steffe — Battle Hymn of the Republic *(combined)*
  - *Transcribed from `docs/archive/program-19930726-liyo-dallas-brooks-hall.jpg`,
    a photographed printed Program. A summer tour date closes the Season before
    it, so this is Season 30 and not Season 31. Items 1-10 are the visiting
    choirs' own blocks — see the ticking note above. Items 15-17 are the combined
    choirs and orchestra; Bruce Worland conducted 15 and 16, Martin Dreiwitz the
    rest of the orchestra's program. Keith Glover compered; the content model has
    nowhere to record that.*

## Season 32 — 1994–1995

### 1995-06-11 · Sun · Tilles Center, Brookville · Martin Dreiwitz (LIYO)
- [ ] missed whole concert
  - [ ] 1. Nicolai — Overture to "The Merry Wives of Windsor"
  - [ ] 2. Mozart — Violin Concerto #5 (first movement)
  - [ ] 3. von Weber — Bassoon Concerto #1 (first movement)
  - [ ] 4. Tchaikovsky — Theme and variations from Suite #3
  - [ ] 5. Liszt — Hungarian Rhapsody #1
  - [ ] 6. Griffes — Poem for Flute and Orchestra
  - [ ] 7. David — Concertino, for trombone and orchestra
  - [ ] 8. Chabrier — "Espana" Rhapsody
  - *Transcribed from `docs/archive/program-19950611-liyo-tilles-center.pdf`
    under AWK-64. The 32nd Season's fourth concert. **Scott Stickley conducted
    item 5** as Associate Conductor and Martin Dreiwitz the rest —
    `programItem.conductor`'s third use. Four student soloists: Seth Abrams
    (violin, 2), Dickran Kazanjian (bassoon, 3), Jessica Hull (flute, 6) and
    Terrence Fay (trombone, 7). Items 2 and 3 were first movements only, which is
    recorded on the Program items rather than as separate Works — the complete
    Works are linked and the qualification sits on the performance. Item 4 is the
    same Work as 1993-07-26's item 13, reused rather than duplicated.*

# Long Island String Festival Association — Nassau County, 1992 to 1994

**Not read by `seed_participation.py`.** See the note at the top of this file.
Participation for these Concerts is set by hand in Contentful. Both parsers gate
on the `# Brooklyn lineage` heading and skip every other `#` section, so this
third institution needed no change to either of them — the boundary AWK-59 asked
for was already general.

**LISFA is not the All-County festival.** The space also holds three
`All-Nassau …` Orchestras, abbreviated `All-County …`, and one Concert that uses
one of them — `1989-01-08 — All County`, which is not in this file at all. That
is a different festival, and the two were nearly conflated when AWK-82 began:
two of those Orchestra records had been created and left unused, which made them
look exactly like the records a Nassau junior high and high school division
needed. Alex corrected it on 2026-09-01.

**A festival, not an orchestra, and that is why each Concert is short.** Three
divisions — Elementary, Junior High, Senior High — rehearsed and performed
separately on one afternoon, each under its own conductor. Alex played in one
division per year: **Junior High in 1992, Senior High in 1993 and 1994**, stated
2026-09-01. Each Concert below holds **only his division's block**, so a program
of one or two works is complete rather than truncated. The other divisions'
blocks are not `satOut` — they were never his to sit out — and are recorded in
`scripts/contentful/lisfa-festival-programs.json` under each Concert's
`alsoOnThePage`, together with the Suffolk County concert each program also
covers and never transcribed.

**No Season on any of the three.** ADR-0006's rule for a festival date, which
`1989-01-08` already follows. The festival's own ordinal — 36th, 37th and 38th
Annual Concert — is in the declaration's `sourceNote`.

**Alex played every Concert of these three years.** No `missed whole concert` box
is ticked and none is expected to be; no item box is ticked either, because a
sat-out work would have to be one of his own division's.

**This section is complete for what it covers and no more.** Three festivals,
three Concerts, one per year, each from a program in `docs/archive/`. Whether
Alex played the festival in any other year is not recorded here, and no source in
this repository answers it.

## 1992 — 36th Annual Concert

### 1992-02-09 · Sun · Uniondale High School · Ming-Feng Hsin (LISFA Jr. High)
- [ ] missed whole concert
  - [ ] 1. Handel — Overture to The Messiah
  - [ ] 2. Mozart — Serenade (Eine Kleine Nachtmusik)
  - [ ] 3. Holst — Brook Green Suite
  - [ ] 4. Anderson — Fiddle Faddle
  - *Transcribed from
    `docs/archive/program-19920209-lisfa-uniondale-high-school.pdf` under
    AWK-82, the Junior High School Orchestra's block. Krista Weis chaired the
    division. Item 2 was the **Romanze only**, one movement of four, recorded on
    the Program item rather than as a separate Work — AWK-64's precedent.*
  - ***The program's spelling of item 2 survives nowhere in the archive.** The
    page prints `Serenade (Eine Kleine Nachmusik)`, without the `t`. The
    transcription created the Work as `Serenade ("Eine Kleine Nachtmusik")` and
    kept the printed form on the item label, which is where a per-performance
    misspelling belongs — the arrangement that lets 1992-12-13 read "Carneval
    Overture". Alex overruled both in the web app on 2026-09-01: the Work is now
    `Serenade No. 13 in G major, K. 525` with all four movements from the
    catalogue, and the label reads `Nachtmusik` too. The scan is the only record
    of what the page says.*

## 1993 — 37th Annual Concert

### 1993-02-07 · Sun · Oceanside Senior High School · Louis Bergonzi (LISFA Senior High)
- [ ] missed whole concert
  - [ ] 1. Tchaikovsky — Serenade
  - *Transcribed from
    `docs/archive/program-19930207-lisfa-oceanside-senior-high-school.pdf` under
    AWK-82, the Senior High School Orchestra's block. Lisa Ramos chaired the
    division. **One work, and the page is not truncated** — the block is the
    Serenade's four movements and the program page ends there, which makes this
    the shortest Concert in the archive. The Work is titled `Serenade for
    Strings`, matching Barber's and Elgar's; the program prints a bare
    `Serenade` and that is what the item's label says.*

## 1994 — 38th Annual Concert

### 1994-02-06 · Sun · A.G. Berner Junior High School · David Holland (LISFA Senior High)
- [ ] missed whole concert
  - [ ] 1. Diamond — Rounds for String Orchestra
  - [ ] 2. Respighi — Ancient Airs and Dances, Suite #3
  - *Transcribed from
    `docs/archive/program-19940206-lisfa-a-g-berner-junior-high-school.pdf` under
    AWK-82, the Senior High School Orchestra's block — held in a junior high
    school's auditorium, which is a coincidence of the venue and not a division.
    Catherine Fairweather chaired. **David Diamond is the archive's 158th
    Composer** and IMSLP holds no page for him, so his Period is hand-assigned:
    `Modern`, with Barber and Bernstein rather than Copland and Piston. Item 2's
    printed `Suite #3` is normalised to `No. 3` on the Work and kept on the
    label.*
