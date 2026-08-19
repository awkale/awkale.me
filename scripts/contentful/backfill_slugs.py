#!/usr/bin/env python3
"""Backfill composer.slug and clean work.slug, per ADR-0008.

    python3 scripts/contentful/backfill_slugs.py              # report, writes nothing
    python3 scripts/contentful/backfill_slugs.py --apply      # write as drafts
    python3 scripts/contentful/backfill_slugs.py --apply --publish

Written for AWK-39, which needs stored slugs to exist before the build can
enumerate a single composer or work page. ADR-0008 decided slugs are STORED, not
derived, so an empty composer.slug is not a cosmetic gap -- it is zero composer
pages and zero work pages.

Four passes, in this order, because each one depends on the last:

  1. RELOCATE the five nobiliary particles in sortName. `van Beethoven, Ludwig`
     becomes `Beethoven, Ludwig van`. The slug derives from the filing name, so
     this has to happen before any slug is computed.
  2. MERGE the two honorific-split composers. `Walton, Sir William` and
     `Walton, William` are one person, and the slug rule strips `Sir`, so both
     records derive `walton-william` -- and composer.slug carries `unique: true`,
     which rejects the second publish. The merge is not optional decoration; it
     is what makes pass 3 possible at all.
  3. composer.slug on every surviving record.
  4. work.slug on all 625, replacing the importer's hashed form.

Safety properties:
  * DRY RUN IS THE DEFAULT, like seed_participation.py. Slugs are addresses.
  * COLLISIONS ARE COMPUTED BEFORE ANYTHING IS WRITTEN, for both composer.slug
    (space-wide, still `unique: true`) and (composer, slug) on works. A collision
    aborts the whole run rather than failing halfway and leaving the space in a
    state where some URLs moved and some did not.
  * Works are repointed onto the surviving composer BEFORE the honorific record
    is archived, so no link is ever left dangling.
  * Idempotent. A second run finds every value already in place and writes
    nothing; a merge whose links have already moved reports zero to repoint.
  * Read-modify-write against X-Contentful-Version, so a concurrent edit in the
    web app loses the race loudly (409) rather than being silently overwritten.

NOT IN SCOPE, deliberately:
  * The 12 PRE-TENURE records still carrying `(arr. by ...)` in sortName. They
    slug validly here (`bach-johann-sebastian-arr-by-stokowski`), just ugly, and
    ADR-0005 leaves them contaminated on purpose. Their arranger surname IS read,
    to build work slugs -- see below.
  * conductor.slug. ADR-0008's table adds it, but nothing in AWK-39's page set
    reads it -- the conductor facet is a query-string filter, not a route.

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

FLAGS = {"--apply", "--publish"}
TAKES_VALUE = {"--token-file"}


def _parse_argv(argv):
    """Reject anything unrecognized, same shape as the sibling scripts. Testing
    membership alone would make `--aply` read as a report -- harmless -- but
    `--pubish` would silently leave 869 drafts the Delivery API cannot see, which
    is the ADR-0002 failure mode: an empty site that exits 0."""
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
                     f"usage: backfill_slugs.py [--apply] [--publish] [--token-file PATH]")
        seen.add(arg)
        i += 1
    return seen


ARGS = _parse_argv(sys.argv[1:])
APPLY = "--apply" in ARGS
DO_PUBLISH = "--publish" in ARGS


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

# ------------------------------------------------------------------ slug rules

# ADR-0008's Dutch/European rule. All five are lowercase in the data, so the rule
# applies uniformly with no capitalized-particle exception to encode.
PARTICLES = ("van", "von", "de", "di", "du", "del", "della", "le", "la", "der",
             "den", "ten")
PARTICLE_LEAD = re.compile(r"^((?:%s)(?:\s+(?:%s))*)\s+(.+)$"
                           % ("|".join(PARTICLES), "|".join(PARTICLES)))

# `Sir` and `Dame` and NOTHING more. Generational markers are kept: `Sr.`, `Jr.`,
# `II` and `III` are the only thing distinguishing two real people, and with four
# Strausses in the archive, stripping `Sr.` is a false merge waiting for one new
# entry.
HONORIFIC = re.compile(r",\s*(sir|dame)\s+", re.I)

# The arranger named inside a contaminated composer record. Three pre-tenure
# records say a bare `(arr.)` with no arranger, so there is nothing to append and
# they keep the bare title slug -- they collide with nothing.
ARRANGER = re.compile(r"\((?:arr\.|orch\.|trans\.|ed\.)\s*(?:by\s+)?([^)]*)", re.I)


def slugify(text):
    """ASCII-folded, lowercased, runs of non-alphanumerics collapsed to one dash.

    Folding matters beyond tidiness: ADR-0007's IMSLP pass restores diacritics
    across the composer table, and a stored slug is what lets `Dvorak` become
    `Dvorak` with an accent without touching a single address."""
    text = unicodedata.normalize("NFKD", str(text))
    text = "".join(c for c in text if not unicodedata.combining(c))
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", text.lower()))


def filing_name(sort_name):
    """Relocate a leading nobiliary particle to the back, never strip it.

    Relocating beats stripping because nothing is discarded -- the display name
    stays reconstructible from sortName alone, which is what makes sortName
    genuinely the sort key rather than a field whose name promises sorting."""
    match = PARTICLE_LEAD.match(sort_name)
    if not match:
        return sort_name
    particle, rest = match.group(1), match.group(2)
    if "," in rest:
        last, first = rest.split(",", 1)
        return f"{last.strip()}, {first.strip()} {particle}"
    return f"{rest} {particle}"


def composer_slug(sort_name):
    """The filing name, honorifics stripped, slugified."""
    return slugify(HONORIFIC.sub(", ", filing_name(sort_name)))


def arranger_surname(sort_name):
    """The surname of the arranger named in a contaminated composer record.

    ADR-0008: every Arrangement's slug carries its Arranger's SURNAME,
    unconditionally -- not only where it collides, because a collision-only rule
    inverts the moment the original is added to the archive.

    This is now the FALLBACK, not the primary source. AWK-23 ran on 2026-08-19
    and moved the arranger onto `work.arranger` for the 25 in-scope records,
    deleting the composer records this reads. What is left for it is the 12
    pre-tenure records AWK-23 deliberately left contaminated, which have no
    `work.arranger` and never will.

    Four real shapes, all handled: `(arr. by Respighi)`, `(arr.)` with no name at
    all, `(arr. by Rodzinski, 1944)` where a year trails the name, and
    `(arr. by Davis/orch. Armstrong)` where two people are credited and the first
    is taken."""
    match = ARRANGER.search(sort_name or "")
    if not match:
        return None
    who = match.group(1).strip()
    if not who:
        return None
    # `Davis/orch. Armstrong` and `Eric and Eger, Joseph` -- take the first
    # credit, then the trailing word of it, which drops `, 1944` with it.
    who = re.split(r"/| and ", who)[0].strip()
    who = who.split(",")[0].strip()
    return who.split()[-1] if who else None


# ------------------------------------------------------------------ space reads

def field(entry, name):
    value = entry.get("fields", {}).get(name)
    return value.get(LOCALE) if isinstance(value, dict) else None


def fetch_all(content_type):
    """Every entry of a type, archived ones excluded.

    `sys.archivedAt[exists]=false` is not optional: AWK-20 archived 16 superseded
    programItems rather than deleting them, so a bare count reports 823 where the
    live archive holds 807."""
    out, skip = [], 0
    while True:
        page = http("GET", f"/entries?content_type={content_type}&limit=1000"
                           f"&skip={skip}&sys.archivedAt[exists]=false")
        out += page["items"]
        skip += len(page["items"])
        if skip >= page["total"] or not page["items"]:
            break
    return out


# ------------------------------------------------------------------ planning

# ADR-0008 names both pairs. Kept as data rather than detected, because "two
# records whose slugs collide" would also match a genuine pair of different people
# and silently merge them.
HONORIFIC_MERGES = [("Walton, Sir William", "Walton, William"),
                    ("Sullivan, Sir Arthur", "Sullivan, Arthur")]


def plan(composers, works, program_items):
    """Everything that would change, computed offline before a byte is written."""
    by_sort = {}
    for entry in composers:
        by_sort.setdefault(field(entry, "sortName"), entry["sys"]["id"])

    # --- pass 1: particle relocations
    relocations = []
    for entry in composers:
        sort_name = field(entry, "sortName")
        if sort_name and filing_name(sort_name) != sort_name:
            relocations.append((entry["sys"]["id"], sort_name, filing_name(sort_name)))

    # --- pass 2: honorific merges
    merge = {}
    merges = []
    for honorific, clean in HONORIFIC_MERGES:
        if honorific in by_sort and clean in by_sort:
            merge[by_sort[honorific]] = by_sort[clean]
            merges.append((by_sort[honorific], honorific, by_sort[clean], clean))

    repoints = []
    for entry in works + program_items:
        link = field(entry, "composer")
        if link and link["sys"]["id"] in merge:
            repoints.append((entry["sys"]["id"], entry["sys"]["contentType"]["sys"]["id"],
                             link["sys"]["id"], merge[link["sys"]["id"]]))

    # --- pass 3: composer slugs, on the records that survive the merge
    composer_slugs, taken = [], defaultdict(list)
    for entry in composers:
        cid = entry["sys"]["id"]
        if cid in merge:
            continue                      # about to be archived; needs no address
        sort_name = field(entry, "sortName")
        if not sort_name:
            print(f"  ! {cid} has no sortName and cannot be slugged")
            continue
        want = composer_slug(sort_name)
        taken[want].append(cid)
        if field(entry, "slug") != want:
            composer_slugs.append((cid, sort_name, want))

    collisions = {slug: ids for slug, ids in taken.items() if len(ids) > 1}

    # --- pass 4: work slugs. TWO sources for the arranger surname, in this order.
    #
    # `work.arranger` FIRST, because AWK-23 has now populated it on the 25
    # in-scope arrangements and simultaneously stripped the `(arr. by X)` text
    # out of their composer records. Reading only the composer name would find
    # nothing there any more and drop the suffix from all 25 -- which ADR-0008
    # forbids unconditionally, and which would collide `the-nutcracker-suite`
    # with Tchaikovsky's original on (composer, slug) now that both sit under the
    # one merged record.
    #
    # The composer's `sortName` SECOND, for the 12 pre-tenure records AWK-23
    # deliberately left contaminated. They have no `work.arranger` and never will,
    # so their suffix still has to come from the name. Three of them say a bare
    # `(arr.)` with no arranger, so nothing is appended and they keep the bare
    # title slug -- they collide with nothing.
    surname_of = {e["sys"]["id"]: field(e, "lastName") for e in composers}
    arranger_of = {e["sys"]["id"]: arranger_surname(field(e, "sortName")) for e in composers}
    work_slugs, pairs = [], defaultdict(list)
    for entry in works:
        wid = entry["sys"]["id"]
        link = field(entry, "composer")
        arranger = field(entry, "arranger")
        title = field(entry, "title")
        if not title:
            print(f"  ! {wid} has no title and cannot be slugged")
            continue
        want = slugify(title)
        suffix = surname_of.get(arranger["sys"]["id"]) if arranger else None
        if suffix is None and link:
            suffix = arranger_of.get(link["sys"]["id"])
        # Applied outside the `if link` below on purpose: an arrangement with no
        # composer link still earns its suffix. It has no canonical URL either
        # way, but a slug that silently changes meaning when a composer is later
        # attached is worse than one that is simply unreachable for now.
        if suffix:
            want = f"{want}-{slugify(suffix)}"
        if link:
            owner = merge.get(link["sys"]["id"], link["sys"]["id"])
            pairs[(owner, want)].append(wid)
        # A work with no composer link has no canonical URL -- works are addressed
        # under their composer -- so it is slugged but never keyed. Two of these
        # exist; neither is in the published 322. AWK-38.
        if field(entry, "slug") != want:
            work_slugs.append((wid, title, want))

    pair_collisions = {key: ids for key, ids in pairs.items() if len(ids) > 1}

    return {"relocations": relocations, "merges": merges, "repoints": repoints,
            "composer_slugs": composer_slugs, "collisions": collisions,
            "work_slugs": work_slugs, "pair_collisions": pair_collisions,
            "merge": merge}


# ------------------------------------------------------------------ writes

def save(entry, note):
    """Version-guarded update, then publish if asked."""
    updated = http("PUT", f"/entries/{entry['sys']['id']}", entry,
                   {"X-Contentful-Version": str(entry["sys"]["version"])})
    if DO_PUBLISH:
        http("PUT", f"/entries/{updated['sys']['id']}/published", None,
             {"X-Contentful-Version": str(updated["sys"]["version"])})
    print(f"    {note}")
    return updated


def set_field(entry_id, name, value, note):
    entry = http("GET", f"/entries/{entry_id}")
    entry.setdefault("fields", {}).setdefault(name, {})[LOCALE] = value
    return save(entry, note)


def apply_plan(steps):
    print("\n--- writing")

    for cid, was, now in steps["relocations"]:
        set_field(cid, "sortName", now, f"{cid}  sortName  {was!r} -> {now!r}")

    for eid, ctype, was, now in steps["repoints"]:
        entry = http("GET", f"/entries/{eid}")
        entry["fields"]["composer"][LOCALE] = {"sys": {"type": "Link", "linkType": "Entry", "id": now}}
        save(entry, f"{eid}  {ctype}.composer  {was} -> {now}")

    for cid, sort_name, slug in steps["composer_slugs"]:
        set_field(cid, "slug", slug, f"{cid}  slug  {slug}   ({sort_name})")

    for wid, title, slug in steps["work_slugs"]:
        set_field(wid, "slug", slug, f"{wid}  slug  {slug}")

    # Archive LAST, once nothing links to them any more. Unpublish first: the CMA
    # refuses to archive a published entry.
    for honorific_id, honorific, clean_id, clean in steps["merges"]:
        entry = http("GET", f"/entries/{honorific_id}")
        if entry["sys"].get("publishedVersion"):
            entry = http("DELETE", f"/entries/{honorific_id}/published", None,
                         {"X-Contentful-Version": str(entry["sys"]["version"])})
        http("PUT", f"/entries/{honorific_id}/archived", None,
             {"X-Contentful-Version": str(entry["sys"]["version"])})
        print(f"    {honorific_id}  archived   {honorific!r} merged into {clean!r} ({clean_id})")


# ------------------------------------------------------------------ main

def main():
    print(f"{'WRITING to' if APPLY else 'DRY RUN --'} {SPACE}/{ENV}")
    if APPLY and not DO_PUBLISH:
        print("NOTE: --apply without --publish leaves drafts the Delivery API cannot read.")

    composers = fetch_all("composer")
    works = fetch_all("work")
    program_items = fetch_all("programItem")
    print(f"read {len(composers)} composers, {len(works)} works, "
          f"{len(program_items)} program items\n")

    steps = plan(composers, works, program_items)

    print(f"sortName relocations   {len(steps['relocations'])}")
    for cid, was, now in steps["relocations"]:
        print(f"    {was!r} -> {now!r}")
    print(f"honorific merges       {len(steps['merges'])}")
    for honorific_id, honorific, clean_id, clean in steps["merges"]:
        print(f"    {honorific!r} ({honorific_id}) -> {clean!r} ({clean_id})")
    print(f"links to repoint       {len(steps['repoints'])}")
    print(f"composer.slug to write {len(steps['composer_slugs'])}")
    print(f"work.slug to write     {len(steps['work_slugs'])}")

    # Abort BEFORE writing anything. A collision found halfway through leaves some
    # URLs moved and some not, which is worse than either end state.
    if steps["collisions"]:
        print("\ncomposer.slug COLLISIONS -- composer.slug carries `unique: true`, "
              "so the second publish would be rejected:")
        for slug, ids in steps["collisions"].items():
            print(f"    {slug}  <- {', '.join(ids)}")
        sys.exit("aborting; nothing written")

    if steps["pair_collisions"]:
        print("\n(composer, slug) COLLISIONS -- this is the invariant AWK-39 asserts "
              "in the build, and it must hold before these values are written:")
        for (cid, slug), ids in steps["pair_collisions"].items():
            print(f"    {cid} / {slug}  <- {', '.join(ids)}")
        sys.exit("aborting; nothing written")

    pending = (len(steps["relocations"]) + len(steps["repoints"])
               + len(steps["composer_slugs"]) + len(steps["work_slugs"])
               + len(steps["merges"]))
    if not pending:
        print("\nnothing to do")
        return

    if not APPLY:
        print(f"\n{pending} change(s) pending · {http.calls} API call(s)")
        print("Re-run with --apply --publish to write.")
        return

    apply_plan(steps)
    print(f"\n{pending} change(s) applied · {http.calls} API call(s)")
    if not DO_PUBLISH:
        print("Drafts only. The Delivery API still reads the OLD slugs.")


if __name__ == "__main__":
    main()
