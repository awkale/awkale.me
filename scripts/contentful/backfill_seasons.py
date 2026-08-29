#!/usr/bin/env python3
"""Give every Season its orchestras and an institution-scoped label. Stdlib only.

    python3 scripts/contentful/backfill_seasons.py              # report, write nothing
    python3 scripts/contentful/backfill_seasons.py --apply      # write AND republish

AWK-59. Reads season-orchestras.json for the decisions and bso-graph.json for
everything derivable, and writes two fields on each `season` entry:

  * `orchestras` -- which Orchestra held the year. New field; see archive-schema.json.
  * `label`      -- `<INSTITUTION> Season <N>, <YYYY-YYYY>`, e.g. `BSO Season 30, 2002-2003`.

DRY RUN IS THE DEFAULT, unlike migrate_schema.py and import_to_contentful.py.
This rewrites `label` on 52 published entries, and `label` is the season type's
displayField -- the string every entry picker shows. A default that writes would
make a typo in this file indistinguishable from a migration.

Safety properties:
  * IDEMPOTENT. An entry already carrying the wanted label and orchestras AND
    holding no unpublished changes is reported `ok` and skipped, so a re-run
    after a partial failure resumes rather than rewriting. The publish half is
    part of that check on purpose: a field write that landed while its publish
    failed leaves the right values stored and the old label being served, and
    checking the fields alone would skip it forever.
  * Read-modify-write against X-Contentful-Version, so a concurrent edit in the
    web app loses the race loudly (409) rather than being silently overwritten.
  * PUBLICATION STATE IS PRESERVED, never changed. An entry that was published is
    republished so the change actually lands; an entry that was a draft stays a
    draft. Publishing Alex's hand-made LIYO draft would be a content decision,
    and this script does not make content decisions.
  * It writes `season` entries and nothing else. The bad `concert.orchestra`
    link recorded under `knownLiveErrors` is NOT repaired here -- see that entry.

Credentials resolve exactly as migrate_schema.py resolves them:
CONTENTFUL_CMA_TOKEN, else --token-file PATH, else ~/.contentful-cma-token.
That token must never enter CI (ADR-0002).
"""
import json, os, sys, time, urllib.error, urllib.request
from pathlib import Path

SPACE = os.environ.get("CONTENTFUL_SPACE_ID", "3iiyvj5u5c9h")
ENV = os.environ.get("CONTENTFUL_ENVIRONMENT_ID", "master")
BASE = f"https://api.contentful.com/spaces/{SPACE}/environments/{ENV}"
LOCALE = "en-US"

HERE = Path(__file__).parent
GRAPH = HERE / "bso-graph.json"
DECISIONS = HERE / "season-orchestras.json"

FLAGS = {"--apply"}
TAKES_VALUE = {"--token-file"}


def _parse_argv(argv):
    """Reject anything unrecognized. Less critical here than in migrate_schema.py
    -- the default is a dry run, so a typo fails safe rather than migrating --
    but an unknown flag still means the caller expected something that will not
    happen, and silently reporting instead of applying is its own surprise."""
    seen, i = set(), 0
    while i < len(argv):
        arg = argv[i]
        if arg in TAKES_VALUE:
            if i + 1 >= len(argv):
                sys.exit(f"{arg} needs a path")
            seen.add(arg)
            i += 2
            continue
        if arg not in FLAGS:
            sys.exit(
                f"unknown argument {arg!r}\n"
                f"usage: backfill_seasons.py [--apply] [--token-file PATH]"
            )
        seen.add(arg)
        i += 1
    return seen


ARGS = _parse_argv(sys.argv[1:])
APPLY = "--apply" in ARGS


def _read_token():
    if os.environ.get("CONTENTFUL_CMA_TOKEN"):
        return os.environ["CONTENTFUL_CMA_TOKEN"].strip()
    if "--token-file" in ARGS:
        return Path(sys.argv[sys.argv.index("--token-file") + 1]).read_text().strip()
    default = Path.home() / ".contentful-cma-token"
    if default.exists():
        return default.read_text().strip()
    return None


TOKEN = _read_token()

# ------------------------------------------------------------------ http


class Http:
    """Same shape as migrate_schema.py's client: rate-limited to ~6 req/s,
    retries 429 and 5xx, surfaces everything else."""

    def __init__(self):
        self.calls = 0
        self.last = 0.0

    def __call__(self, method, path, body=None, headers=None):
        if not TOKEN:
            sys.exit("CONTENTFUL_CMA_TOKEN is not set")
        url = path if path.startswith("http") else BASE + path
        data = json.dumps(body).encode() if body is not None else None
        h = {
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/vnd.contentful.management.v1+json",
        }
        h.update(headers or {})
        for attempt in range(8):
            gap = time.monotonic() - self.last
            if gap < 0.16:
                time.sleep(0.16 - gap)
            req = urllib.request.Request(url, data=data, headers=h, method=method)
            try:
                self.last = time.monotonic()
                self.calls += 1
                with urllib.request.urlopen(req, timeout=60) as r:
                    return json.loads(r.read() or b"{}")
            except urllib.error.HTTPError as e:
                if e.code == 429:
                    wait = float(
                        e.headers.get("X-Contentful-RateLimit-Reset")
                        or e.headers.get("Retry-After")
                        or 2**attempt
                    )
                    time.sleep(min(wait + 0.5, 30))
                    continue
                if e.code >= 500:
                    time.sleep(2**attempt)
                    continue
                raise RuntimeError(
                    f"{method} {url} -> {e.code}: {e.read().decode()[:600]}"
                ) from None
            except urllib.error.URLError:
                time.sleep(2**attempt)
        raise RuntimeError(f"{method} {url}: giving up after retries")


http = Http()

# ------------------------------------------------------------------ derivation


def start_year(date):
    """The year a Season opened, from a date inside it.

    A Season runs September to the following summer, so a January concert
    belongs to the Season that opened the previous autumn. This is also what
    files a summer tour under the Season it closes: 1993-07-26 is 1992-1993.
    CONTEXT.md carries the rule as domain language."""
    year = int(date[:4])
    return year if int(date[5:7]) >= 9 else year - 1


def span(year):
    return f"{year}-{year + 1}"


def derive(graph, decisions):
    """One row per Brooklyn Season: number, years, orchestra abbreviations.

    Everything here comes from the graph except the two Seasons it holds no
    dated concert for, which come from `handAssigned`. The year is READ, never
    computed from the number -- season 48 is 2021-2022, not 2020-2021, because
    the cancelled COVID season consumed no number."""
    seasons = graph["types"]["season"]
    concerts = graph["types"]["concert"]
    orchestras = graph["types"]["orchestra"]
    hand = {k: v for k, v in decisions["handAssigned"].items() if k != "note"}

    rows = []
    for sid, season in sorted(seasons.items(), key=lambda kv: kv[1]["number"]):
        mine = [c for c in concerts.values() if c.get("season") == sid]
        dated = sorted(
            (c for c in mine if c.get("date")), key=lambda c: c["date"]
        )

        if dated:
            years = span(start_year(dated[0]["date"]))
        elif sid in hand:
            years = hand[sid]["years"]
        else:
            sys.exit(f"{sid} has no dated concert and no hand-assigned year")

        held = []
        for concert in dated + mine:
            oid = concert.get("orchestra")
            if not oid:
                continue
            abbreviation = orchestras[oid]["abbreviation"]
            if abbreviation not in held:
                held.append(abbreviation)
        if not held:
            held = list(hand.get(sid, {}).get("orchestras", []))
        if not held:
            sys.exit(f"{sid} has no orchestra and no hand-assigned one")

        rows.append(
            {
                "id": sid,
                "number": season["number"],
                "institution": "BSO",
                "years": years,
                "orchestras": held,
            }
        )
    return rows


def label_for(decisions, row):
    return (
        decisions["labelFormat"]["pattern"]
        .replace("{institution}", row["institution"])
        .replace("{number}", str(row["number"]))
        .replace("{years}", row["years"])
    )


# ------------------------------------------------------------------ live space


def val(fields, key):
    holder = fields.get(key)
    return holder.get(LOCALE) if isinstance(holder, dict) else holder


def fetch_all(content_type):
    """Every entry of a type, drafts included.

    Drafts included is the whole point: the Delivery API serves published
    entries only, which is why the first survey of this migration reported 52
    seasons and missed the LIYO draft Alex had already made by hand."""
    out, skip = [], 0
    while True:
        page = http("GET", f"/entries?content_type={content_type}&limit=100&skip={skip}")
        out.extend(page["items"])
        skip += 100
        if skip >= page["total"]:
            return out


def orchestra_ids(live_orchestras, decisions):
    """Abbreviation -> live entry id, for every orchestra the plan names.

    Matched on `abbreviation` and on nothing else. The graph's ids (`orc-bso`)
    and the space's (a generated key) do not agree -- the importer remapped
    them -- so the abbreviation is the join, and using it keeps live ids out of
    the committed plan file entirely.

    That makes `abbreviation` a REQUIRED field in practice for any orchestra a
    season links to, even though the content type marks it optional. An
    orchestra created by hand without one cannot be resolved, so the error below
    says to add the abbreviation rather than to create the entry."""
    by_abbreviation = {}
    for entry in live_orchestras:
        abbreviation = val(entry["fields"], "abbreviation")
        if abbreviation:
            by_abbreviation[abbreviation] = entry["sys"]["id"]

    wanted = {a for i in decisions["institutions"].values() if isinstance(i, dict)
              for a in i.get("orchestras", [])}
    missing = sorted(wanted - set(by_abbreviation))
    if missing:
        named = ", ".join(
            f"{val(e['fields'], 'name')!r}" for e in live_orchestras
            if not val(e["fields"], "abbreviation")
        )
        sys.exit(
            f"no orchestra entry carries abbreviation(s) {', '.join(missing)}.\n"
            f"Orchestras in the space with NO abbreviation set: {named or 'none'}.\n"
            f"Add the abbreviation to the right one, or correct season-orchestras.json."
        )
    return by_abbreviation


def link(entry_id):
    return {"sys": {"type": "Link", "linkType": "Entry", "id": entry_id}}


def wanted_links(row, ids):
    return [link(ids[a]) for a in row["orchestras"]]


def current_links(fields):
    return [l["sys"]["id"] for l in (val(fields, "orchestras") or [])]


def needs_republish(entry):
    """True when an entry holds unpublished changes.

    Contentful has no `changed` flag; the state is `publishedVersion` existing
    AND `version` running more than one ahead of it, because publishing itself
    bumps the version by one. A draft has no publishedVersion and is never
    republished by this script."""
    published = entry["sys"].get("publishedVersion")
    return published is not None and entry["sys"]["version"] > published + 1


# ------------------------------------------------------------------ plan


def main():
    if not GRAPH.exists():
        sys.exit(f"{GRAPH} is missing -- run parse_archive.py first")
    graph = json.loads(GRAPH.read_text())
    decisions = json.loads(DECISIONS.read_text())

    rows = derive(graph, decisions)
    expected = decisions["scope"]["graphSeasons"]
    if len(rows) != expected:
        sys.exit(
            f"derived {len(rows)} seasons, but season-orchestras.json expects "
            f"{expected}. The graph has moved; re-read the decisions before running."
        )

    straddling = sorted(r["id"] for r in rows if len(r["orchestras"]) > 1)
    if straddling != sorted(decisions["scope"]["straddleSeasons"]):
        sys.exit(
            f"seasons straddling a renaming are {straddling}, but the plan expects "
            f"{decisions['scope']['straddleSeasons']}. See knownLiveErrors before "
            f"changing either."
        )

    print(f"space {SPACE} / env {ENV}    {'APPLY' if APPLY else 'DRY RUN'}\n")

    # `orchestras` is added by migrate_schema.py, not by this script. Writing to
    # a field the type does not have fails with a 422 halfway through the run,
    # which leaves some entries relabelled and the rest not -- the one outcome
    # the idempotent skip cannot tidy up on its own.
    season_type = http("GET", "/content_types/season")
    if not any(f["id"] == "orchestras" for f in season_type["fields"]):
        sys.exit(
            "the `season` content type has no `orchestras` field.\n"
            "Run `python3 scripts/contentful/migrate_schema.py` first -- it adds it."
        )

    live_seasons = fetch_all("season")
    ids = orchestra_ids(fetch_all("orchestra"), decisions)
    by_id = {e["sys"]["id"]: e for e in live_seasons}

    # Brooklyn rows match on entry id: the graph's season ids ARE the live ids
    # for this type, and matching on `number` would be ambiguous now that a LIYO
    # season 29 exists alongside the Brooklyn one.
    planned, unresolved = [], []
    for row in rows:
        entry = by_id.get(row["id"])
        if entry is None:
            unresolved.append(row["id"])
            continue
        planned.append((row, entry))

    # A row that does not resolve is not a skippable oddity. The importer remaps
    # graph ids onto live ones whenever a match key hits an existing entry -- 33
    # concerts already live under Contentful auto-ids for exactly that reason --
    # so if seasons were ever remapped too, EVERY row here misses. Without this,
    # that run prints `0 change(s), 0 already correct` and exits 0, which reads
    # as "already migrated" and is the opposite of the truth.
    if unresolved:
        sys.exit(
            f"{len(unresolved)} of {len(rows)} season(s) in the graph have no entry "
            f"of that id in the space: {', '.join(unresolved[:5])}"
            f"{' ...' if len(unresolved) > 5 else ''}\n"
            f"The graph's season ids are assumed to BE the live ids. If the importer "
            f"remapped them, this script needs to match on (institution, number) the "
            f"way import_to_contentful.py now does."
        )

    # LIYO seasons are found in the space, not assumed from the plan file. The
    # plan names the one entry that existed when it was written; hand-creating
    # Season 30 tomorrow should get it labelled by the next run, not leave it
    # reported missing forever.
    liyo = decisions["liyo"]
    existing = liyo["existingEntry"]
    liyo_numbers = {int(n) for n in liyo["seasons"] if n != "note"}
    brooklyn_ids = {r["id"] for r in rows}

    live_liyo = {}
    for entry in live_seasons:
        if entry["sys"]["id"] in brooklyn_ids:
            continue
        number = val(entry["fields"], "number")
        if number in liyo_numbers:
            live_liyo[number] = entry

    duplicated = sorted(
        n for n in live_liyo
        if sum(1 for e in live_seasons
               if e["sys"]["id"] not in brooklyn_ids and val(e["fields"], "number") == n) > 1
    )
    if duplicated:
        sys.exit(
            f"more than one non-Brooklyn season carries number(s) "
            f"{', '.join(map(str, duplicated))}; cannot tell which to label"
        )

    if existing["id"] not in {e["sys"]["id"] for e in live_liyo.values()}:
        print(
            f"  ! {existing['id']}, the LIYO entry season-orchestras.json names, is not "
            f"in the space under a planned number. It may have been deleted or renumbered."
        )

    for number, entry in sorted(live_liyo.items()):
        planned.append(
            (
                {
                    "id": entry["sys"]["id"],
                    "number": number,
                    "institution": "LIYO",
                    "years": liyo["seasons"][str(number)],
                    "orchestras": ["LIYO"],
                },
                entry,
            )
        )

    changes, ok = [], 0
    for row, entry in planned:
        fields = entry["fields"]
        want_label = label_for(decisions, row)
        want_ids = [ids[a] for a in row["orchestras"]]
        same = val(fields, "label") == want_label and current_links(fields) == want_ids
        # `same` is not enough on its own. If a previous run's field write landed
        # and its publish then failed, the entry holds the right values but the
        # Delivery API still serves the old label -- and skipping it here would
        # make that permanent while reporting success. Contentful marks that
        # state as version > publishedVersion + 1.
        if same and not needs_republish(entry):
            ok += 1
            continue
        changes.append((row, entry, want_label, want_ids))

    for row, entry, want_label, want_ids in changes:
        state = "draft" if entry["sys"].get("publishedVersion") is None else "published"
        print(
            f"  {row['id']:<26} {val(entry['fields'], 'label')!r:<22} -> {want_label!r}"
            f"   [{', '.join(row['orchestras'])}] ({state})"
        )

    missing = sorted(liyo_numbers - set(live_liyo))
    if missing:
        print(
            f"\n  LIYO seasons {', '.join(map(str, missing))} have no entry in the space. "
            f"Not created here -- creating an entry is a different act from correcting "
            f"one, and belongs to the data-entry pass."
        )

    print(f"\n{len(changes)} change(s), {ok} already correct · {http.calls} API call(s)")

    if not APPLY:
        print("Re-run with --apply to write. This rewrites the displayField of "
              f"{len(changes)} entr{'y' if len(changes) == 1 else 'ies'}.")
        return

    for row, entry, want_label, want_ids in changes:
        entry_id = entry["sys"]["id"]
        was_published = entry["sys"].get("publishedVersion") is not None
        # The body is the entry AS READ with two fields mutated, never a rebuilt
        # `{"fields": ...}`. PUT replaces the whole entry, so an allow-list
        # silently drops anything outside it -- `metadata`, which carries
        # taxonomy concepts and annotations, being the one that exists today.
        # migrate_schema.py documents this for content types and
        # merge_composers.py does the same for entries.
        entry["fields"]["label"] = {LOCALE: want_label}
        entry["fields"]["orchestras"] = {LOCALE: [link(i) for i in want_ids]}
        updated = http(
            "PUT",
            f"/entries/{entry_id}",
            entry,
            {"X-Contentful-Version": str(entry["sys"]["version"])},
        )
        # Republish only what was already published. A draft stays a draft:
        # publishing Alex's hand-made LIYO entry is a content decision, and this
        # migration does not make content decisions.
        if was_published:
            http(
                "PUT",
                f"/entries/{entry_id}/published",
                None,
                {"X-Contentful-Version": str(updated["sys"]["version"])},
            )
        print(f"  wrote {entry_id}  {want_label}{'' if was_published else '  (left as draft)'}")

    print(f"\ndone · {http.calls} API call(s)")


if __name__ == "__main__":
    main()
