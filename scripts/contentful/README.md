# BSO Archive → Contentful

Imports `Wikipedia BSO Archive.xlsx` (repo root) into the Contentful space
`3iiyvj5u5c9h`, environment `master`.

Two steps: parse the spreadsheet into a normalized entity graph, then push that
graph to the Contentful Management API.

## Usage

```bash
# 1. parse the spreadsheet -> scripts/contentful/bso-graph.json
python3 -m venv /tmp/bso && /tmp/bso/bin/pip install -q openpyxl
/tmp/bso/bin/python scripts/contentful/parse_archive.py "Wikipedia BSO Archive.xlsx"

# 2. review what would change -- writes nothing
python3 scripts/contentful/import_to_contentful.py --dry-run

# 3. create/update entries as DRAFTS
python3 scripts/contentful/import_to_contentful.py

# 4. publish (separate on purpose -- unpublishing thousands of entries is painful)
python3 scripts/contentful/import_to_contentful.py --publish
```

Step 1 needs `openpyxl`. Steps 2–4 are stdlib only.

### Credentials

A Content Management token (`CFPAT-...`), from Contentful → Settings → API keys
→ Content management tokens. **Not** a Delivery/Preview key — those are
read-only and fail on the first write. Resolved in this order:

1. `CONTENTFUL_CMA_TOKEN` env var
2. `--token-file PATH`
3. `~/.contentful-cma-token`

Never commit the token. `.gitignore` covers the usual filenames, but this repo
is a public GitHub Pages site, so treat a leaked token as compromised and
rotate it.

Space and environment can be overridden with `CONTENTFUL_SPACE_ID` and
`CONTENTFUL_ENVIRONMENT_ID`.

## Safety properties

* **Idempotent.** Entry ids are derived from the content, so re-running updates
  in place rather than duplicating. `import-state.json` also lets an
  interrupted run resume.
* **Existing entries are matched, not duplicated.** Composers, soloists and
  conductors match on a name key that ignores accents and nobiliary particles,
  so the sheet's `van Beethoven, Ludwig` resolves to an existing `Beethoven`.
  Works match on (composer, title); concerts on date.
* **Never overwrites a non-empty field.** Values are only written where the
  existing field is empty, so hand-curated data (movement lists, composer
  birth/death dates) survives a re-import. Where the sheet disagrees with a
  populated field, the existing value wins and the difference is printed under
  `CONFLICTS`.
  The one deliberate exception is `concert.program`, listed in `OVERRIDE`.
* **Drafts first.** Publishing is a separate flag, and runs in dependency order
  so links always resolve.

## Sheet conventions the parser relies on

Verified against the source; these are what make the 1,489 rows parseable:

* `SEASON n` in column A starts a season, `SEASON n, cont.` continues it.
* A non-empty column A that isn't a season header starts a new concert.
* **Leading whitespace means "continues the row above."** Wrapped piece titles
  and extra soloist credits are indented.
* A row with no piece and no composer carries **additional soloists for the
  piece above** — 232 rows do this.
* A dated row can be an **additional performance of the preceding program** (a
  two-night run) rather than a new program. Both concerts link the same program
  items. The sheet writes this two ways, 8 rows in total:
  * **Bare date** — no piece and no composer (4 rows).
  * **Date on the run's next piece**, leaving conductor, orchestra and venue
    empty (4 rows: 879, 966, 1006, 1091). All three cells must be blank to
    qualify. Row 266 (`var. dates, 1983`) has a blank conductor and venue but
    names BHO, and is a genuine concert — testing only two of the three would
    silently swallow it.

  `report["shared_program"]` labels which form matched, so a future edit to the
  sheet that trips the heuristic is visible rather than silent.
* Each soloist cell holds exactly one credit, `Name` or `Name, Role[, Role...]`.
  Multiple roles mean one player on several instruments. Roles that aren't
  instruments or voices are treated as opera characters.

## Known gaps

* **Genre is inferred from the title** by keyword and covers ~68% of works. The
  rest are left unset rather than guessed.
* **Composer birth/death dates are not in the spreadsheet.** Only the handful
  curated by hand have them.
* **Opera casts are only partly modeled.** A single performer's role lands in
  `programItem.character`; a full cast keeps its per-singer roles in the
  verbatim `credits` array, since one field can't hold six. Lossless as text,
  but not queryable. A `credit` join type would fix it.
* Three concerts have no usable date (`unknown`, `May, 1981 (date n/a)`,
  `var. dates, 1983`); the raw text is preserved in `concert.dateNote`.
* **Rows 912–913 (Dec 13 2008) are ambiguous in the source and the parser makes
  a judgment call.** Both rows give the same date, piece, composer, conductor
  and orchestra, but *different venues* — `Grand Street Campus High Schools`
  vs `Church of St. Ann & the Holy Trinity`. Only row 913 has the remaining two
  pieces beneath it.
  `duplicate_header()` treats row 912 as a superseded edit and skips it, which
  matches how the entry was resolved in Contentful. The cost: `Grand Street
  Campus High Schools` appears nowhere else in the archive, so that venue is no
  longer referenced by any concert (the `hall` entry still exists, orphaned).
  If the two rows are in fact one program performed at two venues on one day,
  delete `duplicate_header` and instead give row 912 a `shares`-style link to
  row 913's program. Check the season programs before assuming either way.

## Content model

```
concert ──┬─ season
          ├─ hall
          ├─ orchestra[]
          ├─ conductor
          └─ program[] ─→ programItem ──┬─ work ──┬─ composer
                                        │         └─ genre
                                        ├─ composer      (when no work is named)
                                        └─ soloists[] ─→ soloist | ensemble
```

`programItem` is what makes the archive queryable: it records a work *as
performed on one occasion*, so the soloists attach to the specific piece they
played. A flat `program` array of works and soloists cannot express that.
