#!/usr/bin/env python3
"""Archive programItem entries that no concert references. Stdlib only.

    export CONTENTFUL_CMA_TOKEN=cfpat-...
    python3 archive_orphans.py --dry-run     # report, write nothing
    python3 archive_orphans.py               # unpublish, then archive

Written for AWK-20. Merging a two-performance run moves its items out of the
second date's id namespace and into the first's -- program item ids derive from
the concert id (`parse_archive.py`, `pi-{concert-date}-{index}`) -- so the
re-import creates the merged items and leaves the second date's originals behind.
The importer never deletes, so nothing else cleans them up.

Safety properties:
  * The orphan set is DERIVED, never hardcoded: live programItems minus the ones
    bso-graph.json accounts for. A hardcoded list goes stale the moment the sheet
    or the parser changes, and would then name entries that are still in use.
  * Zero inbound links is a HARD GATE, checked twice -- once for the report, and
    again for each entry immediately before its own write, because the two passes
    are minutes apart at ~6 req/s and an import or a web-app edit in between could
    link something the first pass cleared.
    This is also what makes running this before the import harmless: the old
    program arrays still reference those items, so the gate refuses everything.
  * A FLOOR on the derived set. An empty or truncated bso-graph.json would
    otherwise make every live entry look unreferenced.
  * Archive, not delete. Reversible from the Contentful web app, and out of
    Delivery API results either way.
  * Unpublish first. Contentful refuses to archive a published entry, so the two
    steps are ordered rather than optional.
"""
import json, os, sys, time, urllib.request, urllib.error
from pathlib import Path

SPACE = os.environ.get("CONTENTFUL_SPACE_ID", "3iiyvj5u5c9h")
ENV = os.environ.get("CONTENTFUL_ENVIRONMENT_ID", "master")
BASE = f"https://api.contentful.com/spaces/{SPACE}/environments/{ENV}"
CONTENT_TYPE = "programItem"

# Refuse to treat the orphan set as trustworthy if the graph came back
# implausibly small. bso-graph.json is a regenerated artifact, so a partial
# write is a realistic failure, and it fails in the worst direction: fewer
# graph ids means MORE apparent orphans.
MIN_GRAPH_IDS = 500

FLAGS = {"--dry-run", "--yes"}
TAKES_VALUE = {"--token-file"}


def _parse_argv(argv):
    """Reject anything unrecognized, because the default action WRITES.

    Same parser shape as migrate_schema.py, and for the same reason: testing
    membership alone means `--dryrun`, `--dry_run` or `-n` all read as "not a
    dry run" and archive entries in the production space. A typo must not be the
    difference between a report and a destructive run."""
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
                     f"usage: archive_orphans.py [--dry-run] [--yes] "
                     f"[--token-file PATH]")
        seen.add(arg)
        i += 1
    return seen


ARGS = _parse_argv(sys.argv[1:])
DRY = "--dry-run" in ARGS
ASSUME_YES = "--yes" in ARGS
GRAPH = Path(__file__).parent / "bso-graph.json"


def _read_token():
    """Same resolution order as import_to_contentful.py: env var, then
    --token-file PATH, then ~/.contentful-cma-token."""
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
    """A 409. Raised rather than retried: every write here is version-guarded,
    so a blind retry of a write whose response was lost resends a stale version
    and 409s. The caller re-reads the entry and decides."""


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

# The CMA returns archived entries from /entries by default (unlike the Delivery
# API, which hides them). Every query here has to say so explicitly, or this
# script re-reports everything it archived on a previous run as a fresh orphan.
NOT_ARCHIVED = "sys.archivedAt[exists]=false"


def all_ids(content_type):
    """Every *active* entry id of a type, paged."""
    out, skip = [], 0
    while True:
        d = http("GET", f"/entries?content_type={content_type}&{NOT_ARCHIVED}"
                        f"&limit=1000&skip={skip}&order=sys.createdAt")
        out += [e["sys"]["id"] for e in d["items"]]
        skip += len(d["items"])
        if skip >= d["total"] or not d["items"]:
            return out


def referrers(entry_id):
    """Active entries linking to this one. Archived referrers are excluded for
    the same reason archived entries are: an archived concert's link is inert,
    and it could otherwise block the run forever -- an archived entry cannot be
    edited to release the reference without unarchiving it first."""
    d = http("GET", f"/entries?links_to_entry={entry_id}&{NOT_ARCHIVED}")
    return [f"{i['sys']['id']} ({i['sys']['contentType']['sys']['id']})"
            for i in d["items"]]


print(f"space {SPACE} / env {ENV}" + ("    DRY RUN" if DRY else ""))

if not GRAPH.exists():
    sys.exit(f"{GRAPH} is missing -- run parse_archive.py first")
try:
    graph_ids = set(json.loads(GRAPH.read_text())["types"][CONTENT_TYPE])
except (KeyError, ValueError) as e:
    sys.exit(f"{GRAPH} has no usable types.{CONTENT_TYPE}: {e}")
if len(graph_ids) < MIN_GRAPH_IDS:
    sys.exit(f"{GRAPH} lists only {len(graph_ids)} {CONTENT_TYPE}(s), below the "
             f"{MIN_GRAPH_IDS} floor -- it looks truncated. Re-run "
             f"parse_archive.py; a short graph would mark live entries orphaned.")

live_ids = all_ids(CONTENT_TYPE)
orphans = sorted(set(live_ids) - graph_ids)

print(f"\n  live {CONTENT_TYPE:12s} {len(live_ids)}")
print(f"  in bso-graph.json   {len(graph_ids)}")
print(f"  unaccounted for     {len(orphans)}")

if not orphans:
    # Success, not failure: a re-run after a clean pass lands here.
    print("\nnothing to archive")
    sys.exit(0)

print("\n--- checking inbound links")
referenced = {}
for oid in orphans:
    refs = referrers(oid)
    if refs:
        referenced[oid] = refs
    print(f"  {oid:20s} {len(refs)} inbound")

if referenced:
    print(f"\n--- REFUSING: {len(referenced)} of {len(orphans)} are still linked")
    for oid, refs in referenced.items():
        print(f"  {oid}\n      linked from: {', '.join(refs)}")
    sys.exit("\nNothing was written. Re-run the import first, or reconcile "
             "these by hand -- an entry something still links to is not an "
             "orphan, and archiving it would break that link.")

print(f"\n--- {len(orphans)} orphan(s) to unpublish and archive")
for oid in orphans:
    print(f"  {oid}")

if DRY:
    print(f"\n  http calls: {http.calls}")
    print("\ndone (nothing written -- dry run)")
    sys.exit(0)

if not ASSUME_YES:
    if not sys.stdin.isatty():
        sys.exit("refusing to run unattended without --yes")
    if input(f"\narchive {len(orphans)} entries? [y/N] ").strip().lower() != "y":
        sys.exit("aborted")

print()
done, skipped = 0, []
for oid in orphans:
    e = http("GET", f"/entries/{oid}", ok404=True)
    if e is None:
        skipped.append((oid, "no longer exists"))
        print(f"  skipped  {oid} -- no longer exists")
        continue
    if e["sys"].get("archivedAt"):
        skipped.append((oid, "already archived"))
        print(f"  skipped  {oid} -- already archived")
        continue

    # Re-check the gate for THIS entry, immediately before writing to it.
    refs = referrers(oid)
    if refs:
        skipped.append((oid, f"became linked: {', '.join(refs)}"))
        print(f"  skipped  {oid} -- became linked since the check: "
              f"{', '.join(refs)}")
        continue

    try:
        # publishedVersion, not the unpublish call's status code, is the
        # discriminator: an entry that was never published has no /published
        # to delete, and the API's exact code for that is not worth assuming.
        if e["sys"].get("publishedVersion"):
            e = http("DELETE", f"/entries/{oid}/published", None,
                     {"X-Contentful-Version": str(e["sys"]["version"])})
        http("PUT", f"/entries/{oid}/archived", None,
             {"X-Contentful-Version": str(e["sys"]["version"])})
    except Conflict:
        # Someone else moved this entry, or a lost response means the write
        # already landed. Re-read and accept only the intended end state.
        cur = http("GET", f"/entries/{oid}", ok404=True)
        if cur is not None and cur["sys"].get("archivedAt"):
            done += 1
            print(f"  archived {oid} (confirmed after conflict)")
            continue
        skipped.append((oid, "version conflict"))
        print(f"  skipped  {oid} -- version conflict, entry changed underneath")
        continue

    done += 1
    print(f"  archived {oid}")

print(f"\n  archived {done}")
if skipped:
    print(f"  skipped  {len(skipped)}")
    for oid, why in skipped:
        print(f"    {oid}: {why}")
print(f"  http calls: {http.calls}")
print("\ndone")
sys.exit(0 if done == len(orphans) else 1)
