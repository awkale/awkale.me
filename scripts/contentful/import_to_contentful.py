#!/usr/bin/env python3
"""Import bso-graph.json into Contentful. Stdlib only.

    export CONTENTFUL_CMA_TOKEN=cfpat-...
    python3 import_to_contentful.py --dry-run     # report, write nothing
    python3 import_to_contentful.py               # create/update drafts
    python3 import_to_contentful.py --publish     # publish everything after

Safety properties:
  * Deterministic entry ids -> re-running updates instead of duplicating.
  * Existing entries are matched by normalized name/date, so the 33 hand-curated
    entries are reused rather than duplicated.
  * MERGE semantics: a value is only written into a field that is currently
    empty. Curated data (movement lists, composer birth/death dates) is never
    overwritten. The sole exception is concert.program, which is deliberately
    migrated from the old flat Work+Soloist list to ProgramItem links.
  * Entries are created as drafts; publishing is a separate opt-in pass.
"""
import json, os, sys, time, urllib.request, urllib.error, unicodedata, re, collections
from pathlib import Path

SPACE = os.environ.get("CONTENTFUL_SPACE_ID", "3iiyvj5u5c9h")
ENV = os.environ.get("CONTENTFUL_ENVIRONMENT_ID", "master")

def _read_token():
    """CONTENTFUL_CMA_TOKEN env var, else --token-file PATH, else
    ~/.contentful-cma-token. A file keeps the token out of shell history and
    out of this repo (which is public)."""
    if os.environ.get("CONTENTFUL_CMA_TOKEN"):
        return os.environ["CONTENTFUL_CMA_TOKEN"].strip()
    if "--token-file" in sys.argv:
        return Path(sys.argv[sys.argv.index("--token-file") + 1]).read_text().strip()
    default = Path.home() / ".contentful-cma-token"
    if default.exists():
        return default.read_text().strip()
    return None

TOKEN = _read_token()
LOCALE = os.environ.get("CONTENTFUL_LOCALE", "en-US")
BASE = f"https://api.contentful.com/spaces/{SPACE}/environments/{ENV}"

DRY = "--dry-run" in sys.argv
DO_PUBLISH = "--publish" in sys.argv
# --existing FILE : read the pre-existing entries from a local snapshot instead
# of the CMA, so the dry run can be validated without a token.
OFFLINE = None
if "--existing" in sys.argv:
    OFFLINE = Path(sys.argv[sys.argv.index("--existing") + 1])
GRAPH = Path(__file__).parent / "bso-graph.json"
STATE = Path(__file__).parent / "import-state.json"

# concert.program is intentionally replaced: the old flat Work+Soloist array
# cannot express which soloist played which piece.
OVERRIDE = {("concert", "program")}

# push order respects link dependencies
ORDER = ["genre", "season", "orchestra", "hall", "conductor", "composer",
         "soloist", "ensemble", "work", "programItem", "concert"]

LINK_FIELDS = {   # field -> True if array of links
    ("work", "composer"): False, ("work", "genre"): False,
    ("programItem", "work"): False, ("programItem", "composer"): False,
    ("programItem", "soloists"): True,
    ("concert", "season"): False, ("concert", "hall"): False,
    ("concert", "conductor"): False, ("concert", "orchestra"): True,
    ("concert", "program"): True,
}

# ------------------------------------------------------------------ http

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

# ------------------------------------------------------------------ matching

def strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFKD", str(s))
                   if not unicodedata.combining(c))

def norm(s):
    return re.sub(r"[^a-z0-9]+", " ", strip_accents(s).lower()).strip()

PARTICLES = {"van","von","de","di","du","del","della","le","la","der","den","ten"}

def name_key(first, last):
    toks = [t for t in norm(f"{first or ''} {last or ''}").split()
            if t and t not in PARTICLES]
    return " ".join(sorted(toks))

def val(fields, name):
    v = (fields or {}).get(name)
    if isinstance(v, dict):
        return v.get(LOCALE)
    return v

def is_empty(v):
    return v is None or v == "" or v == [] or v == {}

_snap = json.loads(OFFLINE.read_text()) if OFFLINE else None

def fetch_all(ctype):
    if _snap is not None:
        return [{"sys": {"id": e["id"], "version": 1},
                 "fields": {k: {LOCALE: v} for k, v in e["fields"].items()}}
                for e in _snap.get(ctype, [])]
    out, skip = [], 0
    while True:
        r = http("GET", f"/entries?content_type={ctype}&limit=100&skip={skip}")
        out.extend(r["items"])
        skip += 100
        if skip >= r["total"]:
            return out

SEASON_INSTITUTION = re.compile(r"^([A-Z]{2,})\b")


def season_institution(label):
    """Which institution a season entry belongs to, from its label.

    AWK-59. `number` alone stopped identifying a season the moment the space
    held a second institution: there are now two entries numbered 29, one
    Brooklyn and one Long Island Youth Orchestra. Keying on the number alone
    lets the LIYO draft claim `sea-29`, which would then point every Brooklyn
    season-29 concert at the wrong entry -- non-deterministically, since the
    winner depends on the order the CMA happens to list them in.

    An INITIALISM prefix names the institution, and the test is deliberately
    the shape rather than a list of known names, because it has to hold for
    labels written before AWK-59 as well as after:

        `Season 29`                   -> BSO   (pre-AWK-59 Brooklyn)
        `BSO Season 29, 2001-2002`    -> BSO   (post-AWK-59 Brooklyn)
        `LIYO 1991-1992`              -> LIYO  (Alex's hand-made draft)
        `LIYO Season 29, 1991-1992`   -> LIYO  (post-AWK-59 LIYO)

    `Season` fails `[A-Z]{2,}` on its second letter, so an unprefixed label
    falls through to Brooklyn, which is what every one of them is. An
    institution whose short name is not an initialism would need this widened
    -- and would need the same thought given to the two checklist parsers."""
    match = SEASON_INSTITUTION.match(label or "")
    return match.group(1) if match else "BSO"


def match_key(ctype, fields, composer_key_of=None):
    f = fields
    if ctype in ("composer", "conductor", "soloist"):
        return name_key(val(f, "firstName"), val(f, "lastName"))
    if ctype in ("orchestra", "hall", "genre", "ensemble"):
        return norm(val(f, "name") or "")
    if ctype == "season":
        return (season_institution(val(f, "label")), val(f, "number"))
    if ctype == "work":
        link = val(f, "composer")
        cid = link["sys"]["id"] if isinstance(link, dict) and "sys" in link else None
        return (composer_key_of.get(cid, "anon") if composer_key_of else "anon",
                norm(val(f, "title") or ""))
    if ctype == "concert":
        return val(f, "date")
    return None

# ------------------------------------------------------------------ load graph

graph = json.loads(GRAPH.read_text())
T = graph["types"]

print(f"space {SPACE} / env {ENV}    {'DRY RUN' if DRY else 'LIVE'}\n")
print("reading existing entries...")

existing = {}          # ctype -> {match_key: (id, fields, version)}
by_id = {}             # id -> (ctype, fields)
live_by_id = {}        # id -> (fields, version)   -- every entry already in the space
for ct in ORDER:
    items = fetch_all(ct)
    existing[ct] = {}
    for it in items:
        by_id[it["sys"]["id"]] = (ct, it["fields"])
        live_by_id[it["sys"]["id"]] = (it["fields"], it["sys"]["version"])
    print(f"  {ct:12s} {len(items):4d} existing")
    existing[ct]["__items__"] = items

# composer id -> name key, needed to match works by (composer, title)
composer_key_of = {it["sys"]["id"]: name_key(val(it["fields"], "firstName"),
                                             val(it["fields"], "lastName"))
                   for it in existing["composer"]["__items__"]}

for ct in ORDER:
    items = existing[ct].pop("__items__")
    for it in items:
        k = match_key(ct, it["fields"], composer_key_of)
        if k is not None and k not in existing[ct]:
            existing[ct][k] = (it["sys"]["id"], it["fields"], it["sys"]["version"])

# ------------------------------------------------------------------ id remap

def graph_match_key(ct, gid, rec):
    if ct in ("composer", "conductor", "soloist"):
        return name_key(rec.get("firstName"), rec.get("lastName"))
    if ct in ("orchestra", "hall", "genre", "ensemble"):
        return norm(rec.get("name") or "")
    if ct == "season":
        return (season_institution(rec.get("label")), rec.get("number"))
    if ct == "work":
        cid = rec.get("composer")
        ck = "anon"
        if cid:
            c = T["composer"].get(cid)
            if c:
                ck = name_key(c.get("firstName"), c.get("lastName"))
        return (ck, norm(rec.get("title") or ""))
    if ct == "concert":
        return rec.get("date")
    return None

remap, reused = {}, collections.Counter()
claimed = set()        # an existing entry may be claimed by only one graph entry
for ct in ORDER:
    for gid, rec in T.get(ct, {}).items():
        k = graph_match_key(ct, gid, rec)
        hit = existing.get(ct, {}).get(k) if k is not None else None
        if hit and hit[0] not in claimed:
            remap[gid] = hit[0]
            claimed.add(hit[0])
            reused[ct] += 1
        elif hit:
            # two graph entries share a match key (e.g. two concerts on the same
            # date). Letting both target one entry would make the second
            # overwrite the first, so the loser keeps its own id.
            print(f"  ! {ct} {gid} and {hit[0]} share match key {k!r}; "
                  f"{gid} keeps its own id")

def rid(gid):
    return remap.get(gid, gid)

# ------------------------------------------------------------------ payloads

def link(gid):
    return {"sys": {"type": "Link", "linkType": "Entry", "id": rid(gid)}}

def build_fields(ct, rec):
    out = {}
    for k, v in rec.items():
        if v is None or v == []:
            continue
        if (ct, k) in LINK_FIELDS:
            if LINK_FIELDS[(ct, k)]:
                # array-of-links field; the graph may hold a bare id (e.g.
                # concert.orchestra is always a single orchestra)
                ids = v if isinstance(v, list) else [v]
                out[k] = [link(x) for x in ids]
            else:
                out[k] = link(v)
        else:
            out[k] = v
    return out

conflicts = []

def describe(v):
    """Render a field value (including links) for comparison/reporting."""
    if isinstance(v, dict) and "sys" in v:
        return label_of(v["sys"]["id"])
    if isinstance(v, list):
        return [describe(x) for x in v]
    return v

def label_of(eid):
    """Human label for an entry id, from the graph or the existing entries."""
    for ct in ORDER:
        rec = T.get(ct, {}).get(eid)
        if rec:
            return (rec.get("title") or rec.get("name") or rec.get("label")
                    or rec.get("abbreviation") or rec.get("fullName")
                    or rec.get("lastName") or eid)
    ct_f = by_id.get(eid)
    if ct_f:
        f = ct_f[1]
        for k in ("title", "name", "label", "fullName", "lastName"):
            if val(f, k):
                return val(f, k)
    return eid

def merge(ct, target_id, new_fields):
    """Return (payload_fields, version_or_None, action).
    Only fills fields that are currently empty, except OVERRIDE fields."""
    # look up by entry id, not by match key: program items and undated concerts
    # have no match key, and without the current version an update PUT 409s.
    cur, version = live_by_id.get(target_id, (None, None))
    if cur is None:
        return {k: {LOCALE: v} for k, v in new_fields.items()}, None, "create"

    merged = dict(cur)
    changed = []
    for k, v in new_fields.items():
        if (ct, k) in OVERRIDE:
            if val(cur, k) != v:
                merged[k] = {LOCALE: v}; changed.append(k + "*")
        elif is_empty(val(cur, k)):
            merged[k] = {LOCALE: v}; changed.append(k)
        else:
            # existing value kept; record where the sheet disagrees with it
            old, new = val(cur, k), v
            if describe(old) != describe(new):
                conflicts.append((ct, target_id, k, describe(old), describe(new)))
    if not changed:
        return None, version, "unchanged"
    return merged, version, "update:" + ",".join(changed)

# ------------------------------------------------------------------ push

plan = collections.Counter()
detail = collections.defaultdict(list)
state = json.loads(STATE.read_text()) if STATE.exists() else {"done": []}
done = set(state["done"])

for ct in ORDER:
    recs = T.get(ct, {})
    for gid, rec in recs.items():
        target = rid(gid)
        fields = build_fields(ct, rec)
        payload, version, action = merge(ct, target, fields)
        plan[f"{ct}:{action.split(':')[0]}"] += 1
        if action.startswith("update"):
            detail[ct].append(f"{target}  {action}")
        if DRY or payload is None:
            continue
        key = f"{ct}/{target}"
        if key in done:
            continue
        headers = {"X-Contentful-Content-Type": ct}
        if version is not None:
            headers["X-Contentful-Version"] = str(version)
        http("PUT", f"/entries/{target}", {"fields": payload}, headers)
        done.add(key)
        if len(done) % 50 == 0:
            STATE.write_text(json.dumps({"done": sorted(done)}))
            print(f"    ... {len(done)} entries written")

if not DRY:
    STATE.write_text(json.dumps({"done": sorted(done)}))

print("\n--- plan" if DRY else "\n--- result")
for ct in ORDER:
    row = {k.split(":")[1]: v for k, v in plan.items() if k.startswith(ct + ":")}
    if row:
        print(f"  {ct:12s} " + "  ".join(f"{k}={v}" for k, v in sorted(row.items())))
print(f"\n  reused existing entries: {dict(reused)}")
print(f"  http calls: {http.calls}")

if detail:
    print("\n--- updates to existing entries (fills empty fields; * = deliberate override)")
    for ct, lines in detail.items():
        for l in lines[:40]:
            print(f"  {ct:12s} {l}")

if conflicts:
    print(f"\n--- CONFLICTS ({len(conflicts)}): existing value kept, sheet disagrees")
    for ct, eid, field, old, new in conflicts:
        print(f"  {ct}.{field}  {eid}\n      kept  : {old!r}\n      sheet : {new!r}")

if DO_PUBLISH and not DRY:
    print("\npublishing...")
    n = 0
    for ct in ORDER:
        for gid in T.get(ct, {}):
            e = http("GET", f"/entries/{rid(gid)}", ok404=True)
            if not e:
                continue
            try:
                http("PUT", f"/entries/{rid(gid)}/published", None,
                     {"X-Contentful-Version": str(e["sys"]["version"])})
                n += 1
            except RuntimeError as err:
                print(f"  publish failed {ct}/{rid(gid)}: {str(err)[:200]}")
    print(f"  published {n}")

print("\ndone" + (" (nothing written -- dry run)" if DRY else ""))
