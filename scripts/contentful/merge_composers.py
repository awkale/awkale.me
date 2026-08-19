#!/usr/bin/env python3
"""Merge the split composer records and populate work.arranger, per ADR-0005.

    python3 scripts/contentful/merge_composers.py            # report, writes nothing
    python3 scripts/contentful/merge_composers.py --apply    # write AND publish

AWK-23. The archive stored the arranger inside `composer.firstName`, so one
person exists as several composer records -- `Modest Mussorgsky`, `Modest (orch.
by Ravel) Mussorgsky`, `Modest (arr. by Peters) Mussorgsky` and `Modest (orch. by
Rimsky-Korsakov) Mussorgsky` are four records for one man. This collapses them
onto one record each and moves the arranger to `work.arranger`, a link.

Five passes, in this order, because each depends on the last:

  1. CREATE the canonical composers that do not exist yet. Five people appear
     only in arranged form -- Addinsell, Badelt, Lecuona, Mancini and Zimmer --
     so there is nothing to merge them into until they exist.
  2. CREATE the arranger records. Nineteen of the 23 arrangers are not in the
     space; the four that are (Ravel, Rimsky-Korsakov, Respighi, Schoenberg) are
     reused, which is the whole reason the arranger is a link rather than a
     string -- Respighi arranged both Rossini and Rachmaninoff AND has works of
     his own, and Douglas arranged both Addinsell and Chopin.
  3. RELINK the 25 works onto their canonical composer, setting `arranger` and
     `arrangementType` on each, and `arrangementOf` on the two pairs where the
     archive holds the original too.
  4. VERIFY every contaminated record now has zero inbound links -- re-read from
     the space, not from the plan.
  5. DELETE the 25, once and only once that holds.

Safety properties:
  * DRY RUN IS THE DEFAULT, like backfill_slugs.py and seed_participation.py.
    This one deletes 25 published records; a default that writes is indefensible.
  * `--apply` PUBLISHES. There is no drafts-only mode, unlike its siblings, and
    that is deliberate: a relink left unpublished while the delete still lands
    leaves the Delivery API serving 25 works whose composer link points at an
    entry that no longer exists. Staging this as drafts has no use that is worth
    that failure mode.
  * CANONICAL TARGETS RESOLVE BY CLEANED `sortName`, never by id shape. All eight
    hand-curated composers carry auto-generated ids -- `cmp-mahler-gustav` 404s,
    the live record is `2xlZPpzsieUWQMguPlmRip` -- so matching `cmp-<x>` against
    `cmp-<x>-arr-by-*` misses exactly the three records holding curated dates.
  * ONLY THE IN-SCOPE RECORDS. 37 are contaminated archive-wide and 25 are in
    scope; the other 12 are pre-tenure and are left alone, four of them a
    different pattern entirely (a bare `(arr.)` naming no arranger, where the
    arranger IS the filed composer of traditional material).
  * SCOPE IS GUARDED. The counts in merge-composers.json are abort thresholds,
    not comments. `--force` downgrades them to warnings.
  * RELINK BEFORE DELETE, and delete only after re-reading inbound links.
    `composer.sortName` is `unique: true`, so there is no intermediate state in
    which both records hold the clean value -- decontaminating in place is
    rejected by Contentful, which is why deletion is the disposition rather than
    a preference. Archiving does not help: an archived entry still consumes the
    unique value.
  * IDEMPOTENT. A record already created is skipped, a work already relinked is
    skipped, a record already deleted is skipped. A second run reports nothing to
    do; a run interrupted halfway resumes.
  * Read-modify-write against X-Contentful-Version, so a concurrent edit in the
    web app loses the race loudly (409) rather than being silently overwritten.

NOT IN SCOPE, deliberately:
  * `work.title` is never edited. Both Nutcracker Suites stay character-
    identically `The Nutcracker Suite`; the disambiguator is derived from
    `arranger`, because putting arranger text into a title recreates the exact
    contamination this removes from `firstName`.
  * `programItem.composer` is not touched. It is null on all 384 in-scope
    program items, and the seven non-null ones are pre-tenure and point
    elsewhere.
  * The nobiliary particles. `sortName` loses its arranger text here and keeps
    its `van`; that is ADR-0008's problem and AWK-39 already relocated them.
  * The 12 pre-tenure contaminated records.

Credentials resolve exactly as the sibling scripts resolve them:
CONTENTFUL_CMA_TOKEN, else --token-file PATH, else ~/.contentful-cma-token.
That token must never enter CI (ADR-0002).
"""
import json, os, re, sys, time, unicodedata, urllib.request, urllib.error
from collections import defaultdict
from pathlib import Path

SPACE = os.environ.get("CONTENTFUL_SPACE_ID", "3iiyvj5u5c9h")
ENV = os.environ.get("CONTENTFUL_ENVIRONMENT_ID", "master")
LOCALE = os.environ.get("CONTENTFUL_LOCALE", "en-US")
BASE = f"https://api.contentful.com/spaces/{SPACE}/environments/{ENV}"
DECL = Path(__file__).parent / "merge-composers.json"

FLAGS = {"--apply", "--force"}
TAKES_VALUE = {"--token-file"}


def _parse_argv(argv):
    """Reject anything unrecognized. `--aply` reading as a report is harmless;
    the reason this exists is that a typo must never be the difference between a
    report and 25 deletions."""
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
            sys.exit(f"unknown argument {arg!r}\n"
                     f"usage: merge_composers.py [--apply] [--force] [--token-file PATH]")
        seen.add(arg)
        i += 1
    return seen


ARGS = _parse_argv(sys.argv[1:])
APPLY = "--apply" in ARGS
FORCE = "--force" in ARGS


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


class Conflict(RuntimeError):
    """A 409. Raised rather than retried: every write is version-guarded, so a
    blind retry resends a stale version and 409s again."""


class Http:
    def __init__(self):
        self.calls = 0
        self.last = 0.0

    def __call__(self, method, path, body=None, headers=None, ok404=False):
        if not TOKEN:
            sys.exit("CONTENTFUL_CMA_TOKEN is not set")
        url = path if path.startswith("http") else BASE + path
        data = json.dumps(body).encode() if body is not None else None
        h = {"Authorization": f"Bearer {TOKEN}",
             "Content-Type": "application/vnd.contentful.management.v1+json"}
        h.update(headers or {})
        for attempt in range(8):
            gap = time.monotonic() - self.last
            if gap < 0.16:                     # stay under ~6 req/s
                time.sleep(0.16 - gap)
            req = urllib.request.Request(url, data=data, headers=h, method=method)
            try:
                self.last = time.monotonic(); self.calls += 1
                with urllib.request.urlopen(req, timeout=60) as r:
                    return json.loads(r.read() or b"{}")
            except urllib.error.HTTPError as e:
                if e.code == 404 and ok404:
                    return None
                if e.code == 409:
                    raise Conflict(f"{method} {url} -> 409") from None
                if e.code == 429:
                    wait = float(e.headers.get("X-Contentful-RateLimit-Reset") or
                                 e.headers.get("Retry-After") or 2 ** attempt)
                    time.sleep(min(wait + 0.5, 30)); continue
                if e.code >= 500:
                    time.sleep(2 ** attempt); continue
                raise RuntimeError(f"{method} {url} -> {e.code}: "
                                   f"{e.read().decode()[:600]}") from None
            except urllib.error.URLError:
                time.sleep(2 ** attempt)
        raise RuntimeError(f"{method} {url}: giving up after retries")


http = Http()

# ------------------------------------------------------------------ name rules

# The four verbs, and the parenthetical they live in. `[^)]*` rather than `.*`
# so a title with a later bracket cannot be swallowed.
VERB = re.compile(r"\((arr\.|orch\.|trans\.|ed\.)\s*(?:by\s+)?([^)]*)\)", re.I)
PAREN = re.compile(r"\s*\((?:arr\.|orch\.|trans\.|ed\.)[^)]*\)\s*", re.I)


def clean_name(value):
    """The name with the arranger parenthetical removed.

    `Addinsell, Richard (arr. by Douglas)` -> `Addinsell, Richard`, and the same
    rule applied to firstName turns `Richard (arr. by Douglas)` into `Richard`.
    One rule for both fields because the contamination is identical in both."""
    return PAREN.sub("", value or "").strip() or None


def arranger_surname(sort_name):
    """The surname of the arranger named inside a contaminated record.

    Four real shapes, all handled: `(arr. by Respighi)`, `(arr.)` naming nobody,
    `(arr. by Rodzinski, 1944)` where a year trails the name -- ADR-0005 discards
    that year deliberately, and taking the trailing word of the first credit is
    what discards it -- and `(arr. by Davis/orch. Armstrong)` crediting two
    people, where the first is taken. The last two shapes are pre-tenure and out
    of scope; the rule handles them anyway so that a mis-scoped run fails on the
    scope guard rather than on a crash halfway through."""
    match = VERB.search(sort_name or "")
    if not match:
        return None
    who = match.group(2).strip()
    if not who:
        return None
    who = re.split(r"/| and ", who)[0].strip().split(",")[0].strip()
    return who.split()[-1] if who else None


def slugify(text):
    """ADR-0008's rule, identical to backfill_slugs.py's: ASCII-folded,
    lowercased, runs of non-alphanumerics collapsed to one dash."""
    text = unicodedata.normalize("NFKD", str(text))
    text = "".join(c for c in text if not unicodedata.combining(c))
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", text.lower()))


def fold(text):
    """Diacritic-blind comparison key. Used only to WARN: the archive holds
    `Schonherr` bare, and AWK-37 restores diacritics across the composer table
    later, so a fold-equal-but-not-equal surname is very likely the same person
    and must not be created twice."""
    text = unicodedata.normalize("NFKD", str(text or ""))
    return "".join(c for c in text if not unicodedata.combining(c)).lower()


# ------------------------------------------------------------------ space reads

def field(entry, name):
    value = entry.get("fields", {}).get(name)
    return value.get(LOCALE) if isinstance(value, dict) else None


def link(entry_id):
    return {"sys": {"type": "Link", "linkType": "Entry", "id": entry_id}}


def fetch_all(content_type):
    """Every entry of a type, archived ones excluded.

    `sys.archivedAt[exists]=false` is not optional: AWK-20 archived 16 superseded
    programItems rather than deleting them, so a bare count reports 823 where the
    live archive holds 807 -- and AWK-39 archived two composers on top of that."""
    out, skip = [], 0
    while True:
        page = http("GET", f"/entries?content_type={content_type}&limit=1000"
                           f"&skip={skip}&sys.archivedAt[exists]=false")
        out += page["items"]
        skip += len(page["items"])
        if skip >= page["total"] or not page["items"]:
            break
    return out


def in_scope_ids(concerts, program_items, works):
    """Tenure, not attendance.

    `attended` has three meaningful states (ADR-0006) and only UNSET means "not
    his history". `false` is one of the 6 concerts he missed, which are still his
    tenure and whose works are still in scope. Reading scope as `attended == true`
    finds 17 of the 25 contaminated records and silently leaves 8 behind."""
    concert_ids = {c["sys"]["id"] for c in concerts if field(c, "attended") is not None}
    item_ids = set()
    for concert in concerts:
        if concert["sys"]["id"] in concert_ids:
            for item in field(concert, "program") or []:
                item_ids.add(item["sys"]["id"])
    work_ids = set()
    for item in program_items:
        if item["sys"]["id"] in item_ids and field(item, "work"):
            work_ids.add(field(item, "work")["sys"]["id"])
    composer_ids = set()
    for work in works:
        if work["sys"]["id"] in work_ids and field(work, "composer"):
            composer_ids.add(field(work, "composer")["sys"]["id"])
    return concert_ids, item_ids, work_ids, composer_ids


# ------------------------------------------------------------------ planning

def plan(decl, composers, works, program_items, concerts):
    """Everything that would change, computed offline before a byte is written."""
    types = {k: v for k, v in decl["arrangementTypes"].items() if k != "note"}
    problems, warnings = [], []

    concert_ids, item_ids, work_ids, composer_ids = in_scope_ids(
        concerts, program_items, works)

    contaminated = [c for c in composers if VERB.search(field(c, "sortName") or "")]
    composer_by_id = {c["sys"]["id"]: c for c in composers}

    # TWO ways a contaminated record is in scope, and the second is what makes
    # the delete pass survive an interrupted run.
    #
    # Before the relink, a target is simply a contaminated record owning an
    # in-scope work. But the relink REMOVES exactly that link -- so a run that
    # crashes, 409s or is Ctrl-C'd between the last relink and the last delete
    # leaves 25 orphaned records that this set no longer sees. The re-run would
    # find nothing to do and report success over a half-applied migration, which
    # is the failure mode the scope guard cannot catch either: 0 in scope matches
    # `afterMigration`, and 37 archive-wide still matches the `before` value.
    #
    # So an orphan is re-identified from the evidence the relink LEAVES: an
    # in-scope work carrying both an arranger and a composer whose cleaned filing
    # name and arranger surname match a contaminated record still sitting there.
    # Deleting one is still gated on the live inbound-link re-read in
    # apply_plan(), so a false positive here cannot delete anything referenced.
    relinked = set()
    for work in works:
        if work["sys"]["id"] not in work_ids:
            continue
        arranger_link, composer_link = field(work, "arranger"), field(work, "composer")
        if not arranger_link or not composer_link:
            continue
        owner = composer_by_id.get(composer_link["sys"]["id"])
        arranger = composer_by_id.get(arranger_link["sys"]["id"])
        if owner and arranger:
            relinked.add((field(owner, "sortName"), field(arranger, "lastName")))

    def in_scope(entry):
        sort_name = field(entry, "sortName")
        if entry["sys"]["id"] in composer_ids:
            return True
        return (clean_name(sort_name), arranger_surname(sort_name)) in relinked

    targets = [c for c in contaminated if in_scope(c)]

    scope = {"inScopeConcerts": len(concert_ids), "inScopeProgramItems": len(item_ids),
             "inScopeWorks": len(work_ids), "inScopeContaminated": len(targets),
             "contaminatedArchiveWide": len(contaminated)}
    guard = decl["scopeGuard"]
    after = guard["afterMigration"]
    # Strict both ways: this migration creates and destroys no concert, program
    # item or work, so these must read identically before and after it.
    for key in ("inScopeConcerts", "inScopeProgramItems", "inScopeWorks"):
        if scope[key] != guard[key]:
            (warnings if FORCE else problems).append(
                f"scope drift: {key} is {scope[key]}, expected {guard[key]}")
    # Two valid states. A completed run legitimately reports 0 and 12, and an
    # abort on that is the migration failing on its own success -- which trains
    # an operator to pass --force, defeating the guard that actually matters.
    for key in ("inScopeContaminated", "contaminatedArchiveWide"):
        if scope[key] not in (guard[key], after[key]):
            (warnings if FORCE else problems).append(
                f"scope drift: {key} is {scope[key]}, expected {guard[key]} "
                f"before the migration or {after[key]} after it")

    # Clean records only -- a contaminated record must never resolve as anybody's
    # canonical target or anybody's arranger.
    target_ids = {c["sys"]["id"] for c in targets}
    clean = [c for c in composers if not VERB.search(field(c, "sortName") or "")]
    by_sort = defaultdict(list)
    by_last = defaultdict(list)
    for entry in clean:
        by_sort[field(entry, "sortName")].append(entry["sys"]["id"])
        by_last[field(entry, "lastName")].append(entry["sys"]["id"])

    existing_ids = {c["sys"]["id"] for c in composers}
    taken_slugs = {field(c, "slug"): c["sys"]["id"] for c in clean if field(c, "slug")}
    taken_sorts = {field(c, "sortName") for c in clean}

    creates, resolved = {}, {}

    def want_record(new_id, fields, kind):
        """Register a record to create, deduplicated by id. Zimmer arrives twice
        -- once via Buckley, once via Wasson -- and is one person."""
        if new_id in existing_ids:
            problems.append(f"{new_id} already exists but did not resolve as clean")
            return
        if new_id in creates:
            return
        if new_id in ("", None):
            problems.append(f"cannot derive an id for {fields!r}")
            return
        slug = fields["slug"]
        if slug in taken_slugs:
            problems.append(f"{new_id}: slug {slug!r} is already held by {taken_slugs[slug]}")
        if fields["sortName"] in taken_sorts:
            problems.append(f"{new_id}: sortName {fields['sortName']!r} already exists")
        taken_slugs[slug] = new_id
        taken_sorts.add(fields["sortName"])
        # Register the PENDING record in the same indexes the live ones use, so a
        # later resolution in this run finds it. Without this a person who is both
        # a canonical create and another record's arranger surname gets two
        # records in one run -- and the `fold` near-duplicate warning below reads
        # by_last too, so it would not fire either. Worse, a re-run after a
        # partial apply resolves that arranger to the now-existing canonical id,
        # so a fresh run and a resumed run would produce different link targets.
        # No overlap in today's data (5 canonical vs 19 surnames); latent, not live.
        by_sort[fields["sortName"]].append(new_id)
        if fields.get("lastName"):
            by_last[fields["lastName"]].append(new_id)
        creates[new_id] = {"fields": fields, "kind": kind}

    # --- canonical targets, resolved by CLEANED sortName and never by id shape
    for entry in sorted(targets, key=lambda e: field(e, "sortName") or ""):
        cid = entry["sys"]["id"]
        sort_name = field(entry, "sortName")
        clean_sort = clean_name(sort_name)
        verb = VERB.search(sort_name).group(1).lower()
        if verb not in types:
            problems.append(f"{cid}: unknown verb {verb!r}")
            continue
        surname = arranger_surname(sort_name)
        if not surname:
            problems.append(f"{cid}: names no arranger; ADR-0005 puts the bare "
                            f"`(arr.)` pattern out of scope, so scope is wrong")
            continue

        owners = by_sort.get(clean_sort, [])
        if len(owners) > 1:
            problems.append(f"{cid}: {clean_sort!r} matches {len(owners)} records")
            continue
        if owners:
            owner_id = owners[0]
        else:
            owner_id = f"cmp-{slugify(clean_sort)}"
            want_record(owner_id, {"firstName": clean_name(field(entry, "firstName")),
                                   "lastName": field(entry, "lastName"),
                                   "sortName": clean_sort,
                                   "slug": slugify(clean_sort)}, "canonical")

        # --- the arranger, matched on surname among clean records
        holders = by_last.get(surname, [])
        if len(holders) > 1:
            problems.append(f"{cid}: arranger surname {surname!r} matches "
                            f"{len(holders)} composers -- ambiguous")
            continue
        if holders:
            arranger_id = holders[0]
        else:
            near = [i for last, ids in by_last.items() if last
                    and fold(last) == fold(surname) and last != surname for i in ids]
            if near:
                warnings.append(f"{surname!r} folds equal to an existing composer "
                                f"({', '.join(near)}) -- likely the same person, "
                                f"creating a second record anyway")
            arranger_id = f"cmp-{slugify(surname)}"
            # Surname-only, per ADR-0005: the programs said "arr. by Ellington"
            # and nothing more, and asserting a wrong first name is a worse error
            # than omitting one. `firstName` stays absent, not empty.
            want_record(arranger_id, {"lastName": surname, "sortName": surname,
                                      "slug": slugify(surname)}, "arranger")

        resolved[cid] = {"sortName": sort_name, "owner": owner_id,
                         "arranger": arranger_id, "type": types[verb]}

    # --- the works. Every inbound link to a target, in-scope or not.
    pairs = {p["arrangement"]: p["original"] for p in decl["arrangementOf"]["pairs"]}
    work_by_id = {w["sys"]["id"]: w for w in works}
    for arrangement, original in pairs.items():
        if arrangement not in work_by_id:
            problems.append(f"arrangementOf: {arrangement} does not exist")
        if original not in work_by_id:
            problems.append(f"arrangementOf: {original} does not exist")

    updates = []
    linked = defaultdict(list)
    for work in works:
        composer = field(work, "composer")
        if composer and composer["sys"]["id"] in resolved:
            linked[composer["sys"]["id"]].append(work)
    for cid, entries in linked.items():
        for work in entries:
            wid = work["sys"]["id"]
            if wid not in work_ids:
                # Deleting the target would dangle this link. ADR-0005 scopes the
                # migration by WORK, and a pre-tenure work sharing a contaminated
                # record means the record cannot be deleted at all.
                problems.append(f"{cid} is also linked by PRE-TENURE work {wid}; "
                                f"deleting it would leave a dangling link")
            updates.append({"work": wid, "from": cid, "to": resolved[cid]["owner"],
                            "arranger": resolved[cid]["arranger"],
                            "type": resolved[cid]["type"],
                            "arrangementOf": pairs.get(wid)})

    # A pair that is neither queued for this run nor already applied is a stale
    # constant, not a silent no-op. Checking `updates` alone would report both
    # pairs stale on every re-run of a migration that has already set them --
    # the same false alarm the scope guard's `afterMigration` exists to avoid.
    for arrangement, original in pairs.items():
        if any(u["work"] == arrangement for u in updates):
            continue
        live = field(work_by_id.get(arrangement) or {}, "arrangementOf")
        if live and live["sys"]["id"] == original:
            continue
        problems.append(f"arrangementOf: {arrangement} is neither queued for "
                        f"relinking nor already pointing at {original}; the pair "
                        f"is stale")

    # --- anything else pointing at a target, across every type read
    for content_type, entries in (("work", works), ("programItem", program_items),
                                  ("concert", concerts), ("composer", composers)):
        for entry in entries:
            for name, value in (entry.get("fields") or {}).items():
                if content_type == "work" and name == "composer":
                    continue
                raw = value.get(LOCALE) if isinstance(value, dict) else None
                for candidate in (raw if isinstance(raw, list) else [raw]):
                    if (isinstance(candidate, dict)
                            and candidate.get("sys", {}).get("linkType") == "Entry"
                            and candidate["sys"]["id"] in target_ids):
                        problems.append(f"{content_type}.{name} on {entry['sys']['id']} "
                                        f"links {candidate['sys']['id']}; this "
                                        f"migration does not know how to move it")

    deletes = [(cid, resolved[cid]["sortName"]) for cid in resolved]
    return {"scope": scope, "creates": creates, "updates": updates,
            "deletes": deletes, "resolved": resolved,
            "problems": problems, "warnings": warnings}


# ------------------------------------------------------------------ writes

def publish(entry):
    return http("PUT", f"/entries/{entry['sys']['id']}/published", None,
                {"X-Contentful-Version": str(entry["sys"]["version"])})


def create(new_id, fields):
    """PUT with an explicit id, then publish.

    Explicit because the whole point of recreating a contaminated record rather
    than editing it in place is that the id is a live candidate for the composer
    slug source (AWK-18), and Contentful entry ids are immutable -- editing in
    place would silently leave
    `/concerts/composers/addinsell-richard-arr-by-douglas` as the only option.

    ADR-0005 says seven such records; live Contentful has FIVE, because
    `cmp-herrmann-bernard` and `cmp-weill-kurt` already exist clean. See
    `correctionsToAdr0005` in merge-composers.json."""
    body = {"fields": {k: {LOCALE: v} for k, v in fields.items() if v is not None}}
    entry = http("PUT", f"/entries/{new_id}", body,
                 {"X-Contentful-Content-Type": "composer"})
    publish(entry)
    return entry


def relink(update):
    entry = http("GET", f"/entries/{update['work']}")
    fields = entry.setdefault("fields", {})
    fields.setdefault("composer", {})[LOCALE] = link(update["to"])
    fields.setdefault("arranger", {})[LOCALE] = link(update["arranger"])
    fields.setdefault("arrangementType", {})[LOCALE] = update["type"]
    if update["arrangementOf"]:
        fields.setdefault("arrangementOf", {})[LOCALE] = link(update["arrangementOf"])
    updated = http("PUT", f"/entries/{update['work']}", entry,
                   {"X-Contentful-Version": str(entry["sys"]["version"])})
    publish(updated)


def destroy(entry_id):
    """Unpublish, then delete. The CMA refuses to delete a published entry, and
    ADR-0005 rules out archiving: an archived record still holds the unique
    `sortName`, so the constraint stays consumed and the contamination is
    preserved rather than removed."""
    entry = http("GET", f"/entries/{entry_id}", ok404=True)
    if entry is None:
        return False
    if entry["sys"].get("publishedVersion"):
        entry = http("DELETE", f"/entries/{entry_id}/published", None,
                     {"X-Contentful-Version": str(entry["sys"]["version"])})
    http("DELETE", f"/entries/{entry_id}", None,
         {"X-Contentful-Version": str(entry["sys"]["version"])})
    return True


def still_linked(target_ids):
    """Re-read the space and report which targets anything still points at.

    Re-read rather than trusting the plan: the plan was computed before the
    writes, and Contentful will happily delete an entry that is still linked,
    leaving a dangling reference the Delivery API serves as a broken include."""
    holders = defaultdict(list)
    for content_type in ("work", "programItem"):
        for entry in fetch_all(content_type):
            for name, value in (entry.get("fields") or {}).items():
                raw = value.get(LOCALE) if isinstance(value, dict) else None
                for candidate in (raw if isinstance(raw, list) else [raw]):
                    if (isinstance(candidate, dict)
                            and candidate.get("sys", {}).get("linkType") == "Entry"
                            and candidate["sys"]["id"] in target_ids):
                        holders[candidate["sys"]["id"]].append(
                            f"{entry['sys']['id']}.{name}")
    return holders


def apply_plan(steps):
    print("\n--- writing")

    for new_id, spec in steps["creates"].items():
        create(new_id, spec["fields"])
        print(f"    created  {new_id:<32} {spec['kind']}")

    for update in steps["updates"]:
        relink(update)
        extra = f"  arrangementOf={update['arrangementOf']}" if update["arrangementOf"] else ""
        print(f"    relinked {update['work']:<42} -> {update['to']}"
              f"  arr={update['arranger']} {update['type']}{extra}")

    # Pass 4. Between the plan and here, every link should have moved; anything
    # left is a link this migration does not understand, and deleting under it
    # would be the one unrecoverable mistake available.
    target_ids = {cid for cid, _ in steps["deletes"]}
    holders = still_linked(target_ids)
    if holders:
        print("\n    STOPPING BEFORE DELETE -- these are still linked:")
        for cid, where in holders.items():
            print(f"      {cid}  <- {', '.join(where)}")
        sys.exit("nothing deleted; the relink is applied and safe to re-run")

    for cid, sort_name in steps["deletes"]:
        print(f"    deleted  {cid:<45} {sort_name!r}"
              if destroy(cid) else f"    absent   {cid:<45} (already deleted)")


# ------------------------------------------------------------------ main

def main():
    decl = json.loads(DECL.read_text())
    print(f"{'WRITING to' if APPLY else 'DRY RUN --'} {SPACE}/{ENV}")

    composers = fetch_all("composer")
    works = fetch_all("work")
    program_items = fetch_all("programItem")
    concerts = fetch_all("concert")
    print(f"read {len(composers)} composers, {len(works)} works, "
          f"{len(program_items)} program items, {len(concerts)} concerts\n")

    steps = plan(decl, composers, works, program_items, concerts)

    scope = steps["scope"]
    print(f"in scope: {scope['inScopeConcerts']} concerts · "
          f"{scope['inScopeProgramItems']} program items · "
          f"{scope['inScopeWorks']} works")
    print(f"contaminated: {scope['contaminatedArchiveWide']} archive-wide, "
          f"{scope['inScopeContaminated']} in scope "
          f"({scope['contaminatedArchiveWide'] - scope['inScopeContaminated']} "
          f"pre-tenure, untouched)\n")

    canonical = [i for i, s in steps["creates"].items() if s["kind"] == "canonical"]
    arrangers = [i for i, s in steps["creates"].items() if s["kind"] == "arranger"]
    print(f"composers to create  {len(steps['creates'])}"
          f"  ({len(canonical)} canonical, {len(arrangers)} arranger)")
    for new_id in canonical:
        print(f"    {new_id:<34} {steps['creates'][new_id]['fields']['sortName']!r}")
    for new_id in arrangers:
        print(f"    {new_id:<34} {steps['creates'][new_id]['fields']['sortName']!r}")

    print(f"\nworks to relink      {len(steps['updates'])}")
    for update in steps["updates"]:
        print(f"    {update['work']:<42} -> {update['to']:<32} "
              f"{update['type']:<14} arr={update['arranger']}")

    print(f"\ncomposers to delete  {len(steps['deletes'])}")
    for cid, sort_name in steps["deletes"]:
        print(f"    {cid:<45} {sort_name!r}")

    net = len(composers) - len(steps["deletes"]) + len(steps["creates"])
    print(f"\ncomposer records     {len(composers)} -> {net}")

    for warning in steps["warnings"]:
        print(f"\n! {warning}")

    if steps["problems"]:
        # Abort BEFORE writing anything. Half of this migration applied is worse
        # than none of it: works relinked onto records that were never created,
        # or records deleted out from under links that never moved.
        print(f"\n{len(steps['problems'])} problem(s):")
        for problem in steps["problems"]:
            print(f"    {problem}")
        sys.exit("aborting; nothing written"
                 + ("" if FORCE else "   (--force downgrades scope drift to a warning)"))

    pending = len(steps["creates"]) + len(steps["updates"]) + len(steps["deletes"])
    if not pending:
        print("\nnothing to do")
        return

    if not APPLY:
        print(f"\n{pending} change(s) pending · {http.calls} API call(s)")
        print("Re-run with --apply to write. This DELETES 25 published records.")
        return

    apply_plan(steps)
    print(f"\n{pending} change(s) applied · {http.calls} API call(s)")


if __name__ == "__main__":
    main()
