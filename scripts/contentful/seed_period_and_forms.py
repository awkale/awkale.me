#!/usr/bin/env python3
"""Seed composer.period, work.period and work.forms, and restore diacritics.

    python3 scripts/contentful/seed_period_and_forms.py           # report, writes nothing
    python3 scripts/contentful/seed_period_and_forms.py --apply   # write AND publish

AWK-37, specified by ADR-0007. Retires `genre` in favour of two axes: `period`,
held on the composer and overridable on the work, and `forms`, a tag set on the
work. Both are filters and neither is routed, so the published page count is
untouched -- this pass adds no pages and removes none.

Three jobs, and they share a pass because they share a read:

  1. `composer.period` from the IMSLP era category, with hand assignments for
     the composers the wiki does not hold and the five it files under two eras.
  2. `work.forms` from the retired `genre`, repaired -- the ~15 ballets misfiled
     as suites gain Ballet, and the Aria bucket is taken apart.
  3. `composer` name diacritics, restored from the IMSLP spelling.

`work.period` rides along as an override, written ONLY where it disagrees with
the composer's period.

Two inputs, and the split is the point. `imslp-harvest.json` is DERIVED and
disposable -- regenerate it with imslp_harvest.py. `period-and-forms.json` is
DECIDED and layers over it, so a correction survives a re-harvest, which is
ADR-0007's third reason for keeping IMSLP out of the build.

Safety properties:
  * DRY RUN IS THE DEFAULT, like merge_composers.py, backfill_slugs.py,
    backfill_seasons.py and seed_participation.py.
  * `--apply` PUBLISHES. Every entry this touches is already published and read
    by the live build, so leaving a draft would make the Delivery API serve the
    old value while the web app shows the new one -- a difference nothing
    reports. Same reasoning merge_composers.py records.
  * A DISAGREEING VALUE IS NEVER OVERWRITTEN. If the space already holds a
    period or a form set that this pass did not compute and the declaration does
    not explain, the row is reported as a CONFLICT and skipped. That is what
    makes a hand correction durable; ADR-0007 keeps this pass out of the build
    precisely so corrections are not overwritten on the next deploy, and a
    re-run of the seed itself must honour the same promise.
  * WORK IDS ARE CHECKED AGAINST THEIR TITLES. Every curated row in the
    declaration carries the title it was written against, re-read from the space
    and compared. A renamed or deleted work aborts rather than writing to
    whatever now holds that id.
  * DIACRITICS ONLY WHERE THE FOLD IS EXACT. The IMSLP spelling is applied only
    when folding it reproduces the stored name character for character, on all
    three of firstName, lastName and sortName. So `Dvorak, Antonin` takes
    `Dvořák, Antonín`, and `Bologne, Joseph, Chevalier de Saint-Georges` does
    NOT take `Saint-Georges, Joseph Bologne` -- that is a filing-name change and
    ADR-0008 owns filing names, not this pass.
  * SLUGS ARE NEVER TOUCHED. ADR-0008 folds them to ASCII, so `dvorak` is
    already right and restoring the diacritic changes nothing downstream. This
    is restoring data that was never captured, not a rendering choice.
  * SCOPE IS GUARDED. The counts in period-and-forms.json are abort thresholds.
    `--force` downgrades them to warnings.
  * IDEMPOTENT. A second run reports nothing to do. A run interrupted halfway
    resumes.
  * Read-modify-write against X-Contentful-Version, so a concurrent edit in the
    web app loses the race loudly (409) rather than being silently overwritten.

NOT IN SCOPE, deliberately:
  * `work.genre` IS NOT CLEARED AND THE FIELD IS NOT DELETED. ADR-0007 sequences
    this as three separately-owned steps -- AWK-30 added `forms`, this migrates
    the data, and only then can `genre` go. Deleting it in the same pass that
    migrates it destroys the only thing a re-run could read.
  * The 109 works carrying no genre. ADR-0007 is explicit that assigning them is
    taste rather than data entry, and that nothing in the spec is blocked on it.
    They are listed in docs/archive/form-curation.md. The 5 of them IMSLP can
    answer for are seeded here; the rest wait for a human.
  * The 19 arranger-only composer records AWK-23 created. They hold zero works,
    so they are never in scope, and a null period on them is correct.
  * `work.slug`, `composer.slug`, and every filing name.

Credentials resolve exactly as the sibling scripts resolve them:
CONTENTFUL_CMA_TOKEN, else --token-file PATH, else ~/.contentful-cma-token.
That token must never enter CI (ADR-0002).
"""
import json
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
DECL = HERE / "period-and-forms.json"
HARVEST = HERE / "imslp-harvest.json"

SPACE = os.environ.get("CONTENTFUL_SPACE_ID", "3iiyvj5u5c9h")
ENV = os.environ.get("CONTENTFUL_ENVIRONMENT_ID", "master")
LOCALE = os.environ.get("CONTENTFUL_LOCALE", "en-US")
BASE = f"https://api.contentful.com/spaces/{SPACE}/environments/{ENV}"

FLAGS = {"--apply", "--force"}
TAKES_VALUE = {"--token-file"}


def _parse_argv(argv):
    options = {"apply": False, "force": False, "token_file": None}
    index = 0
    while index < len(argv):
        argument = argv[index]
        if argument in TAKES_VALUE:
            if index + 1 >= len(argv):
                sys.exit(f"{argument} needs a value")
            options["token_file"] = argv[index + 1]
            index += 2
            continue
        if argument not in FLAGS:
            sys.exit(
                f"unrecognized argument: {argument}\n"
                f"known flags: {' '.join(sorted(FLAGS | TAKES_VALUE))}"
            )
        options[argument.lstrip("-").replace("-", "_")] = True
        index += 1
    return options


def read_token(token_file):
    token = os.environ.get("CONTENTFUL_CMA_TOKEN")
    if token:
        return token.strip()
    for path in (Path(token_file) if token_file else None, Path.home() / ".contentful-cma-token"):
        if path and path.exists():
            return path.read_text().strip()
    sys.exit(
        "no CMA token. Set CONTENTFUL_CMA_TOKEN, pass --token-file PATH, "
        "or write ~/.contentful-cma-token"
    )


# --------------------------------------------------------------------------
# Contentful
# --------------------------------------------------------------------------


def request(method, path, token, body=None, version=None, tolerate=()):
    """`tolerate` names HTTP codes to RETURN rather than die on.

    Used for publish, which can fail on one entry for a reason that has nothing
    to do with this pass -- a slug that collides space-wide, say. Killing a
    234-entry migration over one such row leaves the space half-seeded and tells
    nobody which half.
    """
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/vnd.contentful.management.v1+json",
    }
    if version is not None:
        headers["X-Contentful-Version"] = str(version)
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{BASE}{path}", data=data, headers=headers, method=method)
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=60) as response:
                raw = response.read()
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as err:
            # 429 is Contentful's rate limit and is expected on a run this size.
            if err.code == 429 and attempt < 4:
                time.sleep(float(err.headers.get("X-Contentful-RateLimit-Reset", 2)) + 1)
                continue
            if err.code in tolerate:
                return {"error": err.code, "detail": err.read().decode()}
            raise SystemExit(f"{method} {path} -> {err.code}\n{err.read().decode()[:600]}")
        except (urllib.error.URLError, TimeoutError):
            if attempt == 4:
                raise
            time.sleep(1.5 * (attempt + 1))
    raise SystemExit(f"{method} {path} failed")


def fetch_entries(content_type, token):
    """Every entry of a type, archived ones excluded.

    `sys.archivedAt[exists]=false` is not optional tidying: AGENTS.md records
    that the management API counts archived entries while the Delivery API hides
    them, so AWK-20's 16 superseded programItems make the two sides disagree by
    exactly that many. Counting them here would break the scope guards.
    """
    items, skip = [], 0
    while True:
        query = urllib.parse.urlencode(
            {
                "content_type": content_type,
                "limit": 1000,
                "skip": skip,
                "sys.archivedAt[exists]": "false",
            }
        )
        payload = request("GET", f"/entries?{query}", token)
        items += payload["items"]
        skip += len(payload["items"])
        if skip >= payload["total"] or not payload["items"]:
            break
    return items


def field(entry, name):
    return entry.get("fields", {}).get(name, {}).get(LOCALE)


def set_field(entry, name, value):
    entry.setdefault("fields", {}).setdefault(name, {})[LOCALE] = value


def link_id(link):
    return (link or {}).get("sys", {}).get("id")


def is_published(entry):
    sys_block = entry["sys"]
    return sys_block.get("publishedVersion") is not None and sys_block["version"] <= sys_block["publishedVersion"] + 1


def has_pending_changes(entry):
    """True when the entry was published once and now holds unpublished edits.

    This is how the pass RESUMES. A row written but not published -- because its
    publish was refused, or because the run was interrupted between the two
    calls -- already holds the planned values, so the next run computes an empty
    change set and would skip it forever. The published version would stay stale
    silently, which is the one outcome worse than failing.
    """
    sys_block = entry["sys"]
    return sys_block.get("publishedVersion") is not None and sys_block["version"] > sys_block["publishedVersion"] + 1


# --------------------------------------------------------------------------
# Folding -- must agree with imslp_harvest.py
# --------------------------------------------------------------------------

_UNDECOMPOSED = {
    "ø": "o", "Ø": "O", "ł": "l", "Ł": "L", "đ": "d", "Đ": "D",
    "ð": "d", "Ð": "D", "þ": "th", "Þ": "Th", "ı": "i",
    "æ": "ae", "Æ": "Ae", "œ": "oe", "Œ": "Oe", "ß": "ss",
}


def fold(text):
    for src, dst in _UNDECOMPOSED.items():
        text = text.replace(src, dst)
    text = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in text if not unicodedata.combining(ch))


# --------------------------------------------------------------------------
# Scope -- must agree with app/lib/archive.ts
# --------------------------------------------------------------------------


def in_scope(concerts, program_items, works):
    """`works` is the id -> entry map the caller already built."""
    work_ids = set()
    items = {i["sys"]["id"]: i for i in program_items}
    known = set(works)
    for concert in concerts:
        if field(concert, "attended") is not True:
            continue
        sat_out = {link_id(link) for link in (field(concert, "satOut") or [])}
        for link in field(concert, "program") or []:
            item_id = link_id(link)
            if item_id in sat_out or item_id not in items:
                continue
            work_id = link_id(field(items[item_id], "work"))
            if work_id in known:
                work_ids.add(work_id)
    return work_ids


# --------------------------------------------------------------------------
# Planning
# --------------------------------------------------------------------------


def plan_composers(composers, composer_ids, harvest, declaration):
    """What period, and what spelling, each in-scope composer should carry."""
    hand = {k: v for k, v in declaration["composerPeriods"].items() if k != "note"}
    rows = []
    for composer_id in sorted(composer_ids):
        entry = composers[composer_id]
        sort_name = field(entry, "sortName") or ""
        harvested = harvest["composers"].get(composer_id, {})
        eras = harvested.get("eras", [])

        # The declaration wins wherever it speaks. It is the only thing that can
        # settle a two-era composer, and it is where a correction is recorded.
        if sort_name in hand:
            period, source = hand[sort_name], "declared"
        elif len(eras) == 1:
            period, source = eras[0], "imslp"
        else:
            period, source = None, "unresolved"

        # Diacritics, only where folding the IMSLP name reproduces the stored
        # one exactly on all three fields. Anything else is a filing-name change.
        page = harvested.get("imslpPage")
        spelling = None
        if page and "," in page and not all(ord(c) < 128 for c in page):
            last, first = (part.strip() for part in page.split(",", 1))
            stored_last = field(entry, "lastName") or ""
            stored_first = field(entry, "firstName") or ""
            if (
                fold(page) == sort_name
                and fold(last) == stored_last
                and fold(first) == stored_first
                and page != sort_name
            ):
                spelling = {"sortName": page, "lastName": last, "firstName": first}

        rows.append(
            {
                "id": composer_id,
                "sortName": sort_name,
                "period": period,
                "source": source,
                "current": field(entry, "period"),
                "spelling": spelling,
                "pending": has_pending_changes(entry),
            }
        )
    return rows


def plan_works(works, work_ids, genre_names, harvest, declaration, composer_period):
    """What forms and what period override each in-scope work should carry."""
    genre_forms = {k: v for k, v in declaration["genreForms"].items() if k != "note"}
    curated = declaration["workForms"]
    excerpt = declaration["excerptRule"]
    excerpt_re = re.compile(excerpt["pattern"])
    overrides = {k: v for k, v in declaration["workPeriods"].items() if k != "note"}

    # Curated buckets, flattened to workId -> [forms]. Each bucket names one form
    # and lists the works that gain it.
    additions, titles_expected = {}, {}
    for bucket, form in (
        ("ballets", "Ballet"),
        ("arias", "Aria"),
        ("dances", "Dance"),
        ("excerpts", "Excerpt"),
        ("filmMusic", "Film music"),
    ):
        for work_id, title in curated[bucket].items():
            if work_id == "note":
                continue
            additions.setdefault(work_id, set()).add(form)
            titles_expected.setdefault(work_id, title)
    for work_id, row in overrides.items():
        titles_expected.setdefault(work_id, row["title"])

    rows, mismatches = [], []
    for work_id in sorted(work_ids):
        entry = works[work_id]
        title = field(entry, "title") or ""
        if work_id in titles_expected and titles_expected[work_id] != title:
            mismatches.append((work_id, titles_expected[work_id], title))

        forms = set()
        genre_id = link_id(field(entry, "genre"))
        if genre_id and genre_id in genre_names:
            forms |= set(genre_forms.get(genre_names[genre_id], []))
        forms |= set(harvest["works"].get(work_id, {}).get("forms", []))
        forms |= additions.get(work_id, set())
        if excerpt_re.search(title):
            forms.add(excerpt["form"])

        # A period override is written only where it DISAGREES with what the
        # work already inherits. An agreeing style is the inheritance working.
        inherited = composer_period.get(link_id(field(entry, "composer")))
        if work_id in overrides:
            period = overrides[work_id]["period"]
        else:
            styles = harvest["works"].get(work_id, {}).get("styles", [])
            period = styles[0] if len(styles) == 1 and styles[0] != inherited else None
        if period == inherited:
            period = None

        rows.append(
            {
                "id": work_id,
                "title": title,
                "forms": sorted(forms),
                "period": period,
                "currentForms": field(entry, "forms") or [],
                "currentPeriod": field(entry, "period"),
                "pending": has_pending_changes(entry),
            }
        )
    return rows, mismatches


# --------------------------------------------------------------------------


def main(argv):
    options = _parse_argv(argv)
    token = read_token(options["token_file"])
    declaration = json.loads(DECL.read_text())
    if not HARVEST.exists():
        sys.exit(f"missing {HARVEST.name} — run imslp_harvest.py first")
    harvest = json.loads(HARVEST.read_text())
    guards = declaration["guards"]

    print("reading the space…")
    composers = {c["sys"]["id"]: c for c in fetch_entries("composer", token)}
    works = {w["sys"]["id"]: w for w in fetch_entries("work", token)}
    concerts = fetch_entries("concert", token)
    program_items = fetch_entries("programItem", token)
    genre_names = {g["sys"]["id"]: field(g, "name") for g in fetch_entries("genre", token)}

    work_ids = in_scope(concerts, program_items, works)
    composer_ids = {link_id(field(works[w], "composer")) for w in work_ids}
    composer_ids.discard(None)
    print(f"  in scope: {len(work_ids)} works, {len(composer_ids)} composers")

    problems = []
    if len(work_ids) != guards["worksInScope"]:
        problems.append(f"works in scope {len(work_ids)}, declaration says {guards['worksInScope']}")
    if len(composer_ids) != guards["composersInScope"]:
        problems.append(f"composers in scope {len(composer_ids)}, declaration says {guards['composersInScope']}")

    composer_rows = plan_composers(composers, composer_ids, harvest, declaration)
    composer_period = {r["id"]: r["period"] for r in composer_rows}
    work_rows, mismatches = plan_works(works, work_ids, genre_names, harvest, declaration, composer_period)

    for work_id, expected, actual in mismatches:
        problems.append(f"{work_id}: declaration says {expected!r}, space says {actual!r}")

    # ---- what would change -------------------------------------------------
    #
    # A CONFLICT IS PER FIELD, NOT PER ENTRY. Skipping the whole row would
    # silently discard an unrelated change beside the contested one -- a
    # composer whose period is disputed would also lose its restored spelling,
    # and a work whose period is disputed would lose its entire form migration.
    # That failure cannot happen on the first run, because nothing is set yet.
    # It happens on the FIRST RE-RUN AFTER A HAND CORRECTION, which is precisely
    # the case the conflict check exists to protect.
    composer_writes, composer_conflicts = [], []
    for row in composer_rows:
        changes = {}
        if row["period"] and row["current"] != row["period"]:
            # The declaration is allowed to overrule the space; the harvest is not.
            if row["current"] and row["source"] != "declared":
                composer_conflicts.append((row, "period"))
            else:
                changes["period"] = row["period"]
        if row["spelling"]:
            changes.update(row["spelling"])
        if changes or row["pending"]:
            composer_writes.append((row, changes))

    work_writes, work_conflicts = [], []
    for row in work_rows:
        changes = {}
        if row["forms"] and sorted(row["currentForms"]) != row["forms"]:
            # Extending a form set is not a conflict; contradicting one is.
            if row["currentForms"] and not set(row["currentForms"]) <= set(row["forms"]):
                work_conflicts.append((row, "forms"))
            else:
                changes["forms"] = row["forms"]
        if row["period"] and row["currentPeriod"] != row["period"]:
            if row["currentPeriod"]:
                work_conflicts.append((row, "period"))
            else:
                changes["period"] = row["period"]
        if changes or row["pending"]:
            work_writes.append((row, changes))

    if len(composer_writes) > guards["maxComposerWrites"]:
        problems.append(f"{len(composer_writes)} composer writes exceeds the {guards['maxComposerWrites']} ceiling")
    if len(work_writes) > guards["maxWorkWrites"]:
        problems.append(f"{len(work_writes)} work writes exceeds the {guards['maxWorkWrites']} ceiling")

    # ---- report ------------------------------------------------------------
    unresolved = [r for r in composer_rows if not r["period"]]
    spellings = [r for r in composer_rows if r["spelling"]]
    from collections import Counter

    print("\ncomposer.period")
    for period, count in Counter(r["period"] for r in composer_rows if r["period"]).most_common():
        print(f"  {count:4d}  {period}")
    print(f"  {len(unresolved):4d}  (none)")
    print(f"  sources: {dict(Counter(r['source'] for r in composer_rows))}")

    print(f"\ndiacritics — {len(spellings)} composer(s) take an accented spelling")
    for row in spellings:
        print(f"  {row['sortName']:34s} -> {row['spelling']['sortName']}")

    print("\nwork.forms")
    print(f"  {sum(1 for r in work_rows if r['forms']):4d}  works receive at least one form")
    print(f"  {sum(1 for r in work_rows if not r['forms']):4d}  works receive none (the curation backlog)")
    for form, count in Counter(f for r in work_rows for f in r["forms"]).most_common():
        print(f"    {count:4d}  {form}")

    print("\nwork.period overrides")
    for row in work_rows:
        if row["period"]:
            print(f"  {row['title'][:52]:54s} {row['period']}")

    print(f"\nwrites: {len(composer_writes)} composer(s), {len(work_writes)} work(s)")
    if composer_conflicts or work_conflicts:
        print("\nCONFLICTS — the named FIELD is left alone; the rest of the row still writes:")
        for row, name in composer_conflicts:
            print(f"  composer {row['sortName']:32s} {name}: space {row['current']!r}, computed {row['period']!r}")
        for row, name in work_conflicts:
            current = row["currentForms"] if name == "forms" else row["currentPeriod"]
            computed = row["forms"] if name == "forms" else row["period"]
            print(f"  work     {row['title'][:32]:32s} {name}: space {current!r}, computed {computed!r}")

    if problems:
        print("\nGUARD:")
        for problem in problems:
            print(f"  {problem}")
        if not options["force"]:
            sys.exit("\naborted. Re-read the diff; --force downgrades these to warnings.")
        print("  (--force: continuing)")

    if not options["apply"]:
        print("\nDRY RUN — nothing was written. Re-run with --apply to write and publish.")
        return 0

    # ---- apply -------------------------------------------------------------
    print("\napplying…")
    written, refused = 0, []
    for kind, rows in (("composer", composer_writes), ("work", work_writes)):
        for row, changes in rows:
            entry = request("GET", f"/entries/{row['id']}", token)
            label = row.get("sortName") or row.get("title")
            # Publish an entry that already holds the planned values but was
            # left unpublished by an earlier run; do not rewrite it.
            should_publish = is_published(entry) or has_pending_changes(entry)
            version = entry["sys"]["version"]
            if changes:
                for name, value in changes.items():
                    set_field(entry, name, value)
                updated = request(
                    "PUT", f"/entries/{row['id']}", token, body={"fields": entry["fields"]}, version=version
                )
                version = updated["sys"]["version"]
                written += 1
            if should_publish:
                result = request("PUT", f"/entries/{row['id']}/published", token, version=version, tolerate=(422,))
                if result.get("error"):
                    reason = json.loads(result["detail"])
                    paths = {
                        ".".join(str(p) for p in err.get("path", []))
                        for err in reason.get("details", {}).get("errors", [])
                    }
                    refused.append((kind, label, row["id"], ", ".join(sorted(paths)) or reason.get("message", "?")))
                    print(f"  {kind:8s} {label[:44]:46s} WRITTEN, PUBLISH REFUSED")
                    continue
            print(f"  {kind:8s} {label[:44]:46s} {', '.join(sorted(changes)) or 'published only'}")

    print(f"\nwrote {written} entr{'y' if written == 1 else 'ies'}.")
    if refused:
        print(f"\n{len(refused)} entr{'y' if len(refused) == 1 else 'ies'} WRITTEN BUT NOT PUBLISHED.")
        print("The Delivery API still serves their previous values, so the site is unchanged.")
        print("Fix the cause and re-run — the pass republishes them without rewriting.\n")
        for kind, label, entry_id, why in refused:
            print(f"  {kind:8s} {label[:40]:42s} {entry_id:38s} {why}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
