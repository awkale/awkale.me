#!/usr/bin/env python3
"""Seed concert.attended and concert.satOut from the participation checklist.

    python3 seed_participation.py --plan       # regenerate participation.json, offline
    python3 seed_participation.py              # report what would change, writes nothing
    python3 seed_participation.py --apply      # write the fields as drafts
    python3 seed_participation.py --apply --publish

Written for AWK-36. ADR-0006 made every route participation-driven -- a Concert
gets a page when `attended` is true, a Work when it was played on at least one
occasion, a Composer when it holds a qualifying Work -- so this one pass is what
generates the site's page set. Nothing in the build reads a date.

Expected result: 121 concerts, 322 works, 147 composers = 590 routed pages.

Safety properties:
  * DRY RUN IS THE DEFAULT, unlike its sibling scripts. Participation is
    destructive to the sitemap: a stray `attended: false` silently deletes pages,
    and after cutover it 404s a live URL. Writing takes an explicit --apply.
  * satOut links are RESOLVED THROUGH concert.program, never constructed. Program
    item ids are positional and derive from the CONCERT id, so a run's second
    night carries the first night's ids (cnc-20070523 links pi-20070520-*).
    Building `pi-{own date}-{index}` is wrong for 20 items across 14 concerts.
  * The LIVE program must equal the graph's, per concert, before anything is
    written. bso-graph.json is parser output, not Contentful state, and the
    positional ids mean a stale graph aims satOut at a renumbered item.
  * The checklist's item LABELS are matched against the graph's, so a checklist
    whose numbering has drifted out of step with a re-import fails loudly instead
    of silently sitting out the wrong piece.
  * THREE STATES, not two. `true` played, `false` was-around-and-missed, unset
    arrived via the BSO seed and was never Alex's history. The 119 pre-tenure
    concerts are never named in the plan, so they are never written -- not even
    to `false`.
  * Never overwrites a disagreeing value. A field already set to something other
    than the plan is a human edit; it is reported under CONFLICTS and skipped
    unless --force says otherwise.
  * Idempotent. A second run finds everything already in place and writes nothing.
"""
import json, os, re, sys, time, urllib.request, urllib.error
from pathlib import Path

SPACE = os.environ.get("CONTENTFUL_SPACE_ID", "3iiyvj5u5c9h")
ENV = os.environ.get("CONTENTFUL_ENVIRONMENT_ID", "master")
LOCALE = os.environ.get("CONTENTFUL_LOCALE", "en-US")
BASE = f"https://api.contentful.com/spaces/{SPACE}/environments/{ENV}"

HERE = Path(__file__).parent
GRAPH = HERE / "bso-graph.json"
PLAN = HERE / "participation.json"
CHECKLIST = HERE.parent.parent / "docs" / "archive" / "participation-checklist.md"

# Refuse to trust a checklist that came back implausibly short. It fails in the
# worst direction: fewer parsed concerts means fewer pages published, and the
# missing ones look exactly like concerts Alex never played.
MIN_CONCERTS = 100

FLAGS = {"--plan", "--apply", "--publish", "--force"}
TAKES_VALUE = {"--token-file"}


def _parse_argv(argv):
    """Reject anything unrecognized. Same parser shape as archive_orphans.py and
    migrate_schema.py: testing membership alone means `--aply` reads as "not an
    apply" -- harmless here, since the default is a report -- but `--publish`
    misspelt would silently leave 127 drafts the Delivery API cannot see."""
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
                     f"usage: seed_participation.py [--plan] [--apply] [--publish] "
                     f"[--force] [--token-file PATH]")
        seen.add(arg)
        i += 1
    return seen


ARGS = _parse_argv(sys.argv[1:])
PLAN_ONLY = "--plan" in ARGS
APPLY = "--apply" in ARGS
DO_PUBLISH = "--publish" in ARGS
FORCE = "--force" in ARGS

# --plan exits before the space is ever touched, so pairing it with a write flag
# would regenerate the file, report success, and silently write nothing.
if PLAN_ONLY and (APPLY or DO_PUBLISH or FORCE):
    sys.exit("--plan regenerates the file offline and writes nothing to the space. "
             "Run it alone, then run --apply separately.")


def _read_token():
    """Same resolution order as the other scripts: env var, then --token-file
    PATH, then ~/.contentful-cma-token."""
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
    blind retry of a write whose response was lost resends a stale version and
    409s again. The caller re-reads and decides."""


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

# ------------------------------------------------------------------ checklist

HEADING = re.compile(r"^### (\d{4}-\d{2}-\d{2}) · ")
MISSED = re.compile(r"^- \[([ x])\] missed whole concert")
ITEM = re.compile(r"^  - \[([ x])\] (\d+)\. (.+)$")


def parse_checklist(text):
    """Three line forms and nothing else: an `###` heading opens a concert, a
    top-level box is missed-whole-concert, an indented box is one numbered item.

    The heading anchors on a date, and items are only collected once a concert is
    open, because the instructions near the top of the file also say "missed whole
    concert" in prose."""
    concerts, current = [], None
    for line in text.splitlines():
        heading = HEADING.match(line)
        if heading:
            current = {"date": heading.group(1), "missed": False, "items": []}
            concerts.append(current)
            continue
        if current is None:
            continue
        missed = MISSED.match(line)
        if missed:
            current["missed"] = missed.group(1) == "x"
            continue
        item = ITEM.match(line)
        if item:
            current["items"].append({"index": int(item.group(2)),
                                     "satOut": item.group(1) == "x",
                                     "label": item.group(3)})
    return concerts


def squeeze(text):
    """Collapse internal runs of whitespace.

    13 programItem labels carry a doubled space straight out of the spreadsheet --
    'Rodeo:  Four Dance Episodes' -- where the checklist renders them single. That
    is a source-formatting artifact, and the label check exists to catch an index
    pointing at the WRONG WORK, not to police whitespace."""
    return re.sub(r"\s+", " ", text or "").strip()


def build_plan(concerts, graph):
    """Resolve each checklist concert into the graph and derive its write.

    Every lookup is by DATE, and every satOut link comes out of that concert's own
    `program` array. Nothing here constructs an id."""
    by_date = {}
    for cid, c in graph["types"]["concert"].items():
        if c["date"]:
            by_date.setdefault(c["date"], []).append(cid)

    items = graph["types"]["programItem"]
    problems, plan = [], []

    for c in concerts:
        matches = by_date.get(c["date"], [])
        if len(matches) != 1:
            problems.append(f"{c['date']}: resolves to {len(matches)} concerts, expected 1")
            continue
        cid = matches[0]
        program = graph["types"]["concert"][cid]["program"]

        if len(program) != len(c["items"]):
            problems.append(f"{c['date']}: checklist lists {len(c['items'])} items, "
                            f"graph program holds {len(program)}")
            continue

        # The count matching does not make the NUMBERING sound: 1, 2, 4 against a
        # 3-item program passes the check above, and then program[3] raises rather
        # than reporting. An index of 0 is worse -- program[-1] quietly resolves to
        # the LAST item, and only the label check below would catch it.
        indices = sorted(item["index"] for item in c["items"])
        if indices != list(range(1, len(program) + 1)):
            problems.append(f"{c['date']}: items are numbered {indices}, "
                            f"expected 1..{len(program)}")
            continue

        sat_out = []
        for item in c["items"]:
            pid = program[item["index"] - 1]
            # "Composer — Title"; the graph's label is the title half.
            title = item["label"].split(" — ", 1)[-1]
            if squeeze(items[pid]["label"]) != squeeze(title):
                problems.append(f"{c['date']} item {item['index']}: checklist says "
                                f"{title!r}, {pid} is {items[pid]['label']!r}")
            if item["satOut"]:
                sat_out.append(pid)

        plan.append({"date": c["date"], "graphId": cid,
                     "attended": not c["missed"], "satOut": sat_out})

    return plan, problems


SAT_OUT_ARRAY = re.compile(r'"satOut": \[\n(?P<body>[^\[\]]*?)\n\s*\]')


def _as_oxfmt(text):
    """Collapse each satOut array onto one line, the way oxfmt would.

    The repo formats JSON too, and a pre-commit hook fails on anything oxfmt would
    rewrite (ADR-0014). Emitting json.dumps' expanded form would mean every --plan
    run leaves the file needing `bun run format` before it can be committed, so the
    generator matches the formatter instead of fighting it.

    Only satOut is touched: it is short enough that oxfmt always collapses it, and
    `note` is long enough that oxfmt always keeps it expanded. An empty array is
    already on one line and never matches."""
    def collapse(m):
        items = [line.strip().rstrip(",") for line in m.group("body").splitlines() if line.strip()]
        return '"satOut": [' + ", ".join(items) + "]"

    return SAT_OUT_ARRAY.sub(collapse, text)


NOTE = [
    "The participation seeding plan -- AWK-36.",
    "",
    "GENERATED by seed_participation.py --plan from docs/archive/participation-checklist.md",
    "and bso-graph.json. Do not hand-edit: tick the checklist and regenerate.",
    "",
    "One entry per in-scope concert. `attended: false` means Alex was in the",
    "orchestra and missed that date; the 119 pre-tenure concerts are absent from",
    "this file entirely, because unset is a third state and not a synonym for false.",
    "",
    "THE DATE IS THE IDENTITY, not `graphId`. The importer matches concerts on date",
    "and reuses whatever entry it finds, so 33 hand-curated concerts live under",
    "Contentful auto-ids (1LPJsOTpuDin0YfbRM2RPW is 2001-05-24) and cnc-20081213-2",
    "keeps a suffix from the row 912/913 duplicate header. `graphId` is the id",
    "parse_archive.py DERIVES; it is what joins this file to bso-graph.json, and it",
    "is the wrong thing to address the CMA with.",
    "",
    "satOut ids are resolved through each concert's own program array. They are",
    "NOT derivable from the concert date -- a run's second night carries the first",
    "night's program item ids.",
    "",
    "Asserted by participation.test.ts, which re-derives all of it independently.",
]

# ------------------------------------------------------------------ plan pass

if not GRAPH.exists():
    sys.exit(f"{GRAPH} is missing -- run parse_archive.py first")
if not CHECKLIST.exists():
    sys.exit(f"{CHECKLIST} is missing")

graph = json.loads(GRAPH.read_text())
checklist = parse_checklist(CHECKLIST.read_text())

if len(checklist) < MIN_CONCERTS:
    sys.exit(f"{CHECKLIST} parsed to only {len(checklist)} concerts, below the "
             f"{MIN_CONCERTS} floor -- it looks truncated. A short checklist "
             f"publishes fewer pages and looks exactly like concerts never played.")

plan, problems = build_plan(checklist, graph)

if problems:
    print("the checklist and the graph disagree:\n", file=sys.stderr)
    for p in problems:
        print(f"  {p}", file=sys.stderr)
    sys.exit("\nrefusing to plan against a graph the checklist does not match -- "
             "re-run parse_archive.py, or re-check the checklist's numbering")

attended = [c for c in plan if c["attended"]]
sat_out_links = [pid for c in plan for pid in c["satOut"]]

print(f"checklist  {len(plan)} concerts    "
      f"{len(attended)} attended, {len(plan) - len(attended)} missed, "
      f"{len(sat_out_links)} items sat out")

if PLAN_ONLY:
    PLAN.write_text(_as_oxfmt(json.dumps({"note": NOTE, "concerts": plan}, indent=2)) + "\n")
    # Kept on one line deliberately: a newline inside an f-string replacement field
    # needs PEP 701, so the multi-line form makes this whole module -- including the
    # offline --plan pass -- a SyntaxError on Python 3.11 and earlier, which is what
    # macOS ships as `python3`. Nothing else in scripts/contentful/ requires 3.12.
    shown = PLAN.relative_to(Path.cwd()) if PLAN.is_relative_to(Path.cwd()) else PLAN
    print(f"wrote {shown}")
    sys.exit(0)

if not PLAN.exists():
    sys.exit(f"{PLAN} is missing -- run with --plan first, and commit it")
committed = json.loads(PLAN.read_text())["concerts"]
if committed != plan:
    sys.exit(f"{PLAN} is stale -- it no longer follows from the checklist and the "
             f"graph. Re-run with --plan, review the diff, and commit it.")

# ------------------------------------------------------------------ live pass

print(f"space {SPACE} / env {ENV}" + ("" if APPLY else "    DRY RUN -- pass --apply to write"))
print("\n--- reading live concerts")


def live_concerts_by_date():
    """Every active concert, indexed by date.

    One paged sweep rather than 127 lookups, and keyed by DATE because that is
    what identifies a concert in this space -- see participation.json's note. The
    archived filter matters for the same reason it does in archive_orphans.py: the
    CMA returns archived entries by default, and a superseded concert sharing a
    date would make its date look ambiguous."""
    by_date, skip = {}, 0
    while True:
        d = http("GET", f"/entries?content_type=concert&sys.archivedAt[exists]=false"
                        f"&limit=1000&skip={skip}&order=sys.createdAt")
        for e in d["items"]:
            date = e.get("fields", {}).get("date", {}).get(LOCALE)
            if date:
                by_date.setdefault(date, []).append(e)
        skip += len(d["items"])
        if skip >= d["total"] or not d["items"]:
            return by_date


def is_published(entry):
    """Published, with no newer draft on top.

    Contentful leaves `version == publishedVersion + 1` immediately after a
    publish, so anything higher means an unpublished edit is sitting in front of
    the served version. Same idiom as migrate_schema.py."""
    sys_ = entry["sys"]
    pv = sys_.get("publishedVersion")
    return pv is not None and sys_["version"] == pv + 1


live_by_date = live_concerts_by_date()
print(f"  {sum(len(v) for v in live_by_date.values())} dated concerts in the space")

writes, republish, unchanged, conflicts, drifted = [], [], [], [], []

for entry_plan in plan:
    date, gid = entry_plan["date"], entry_plan["graphId"]
    matches = live_by_date.get(date, [])
    if len(matches) != 1:
        drifted.append(f"{date}: resolves to {len(matches)} live concerts, expected 1")
        continue
    live = matches[0]
    cid = live["sys"]["id"]

    fields = live.get("fields", {})
    live_program = [l["sys"]["id"] for l in fields.get("program", {}).get(LOCALE, [])]

    # The graph is parser output. If live has been renumbered since it was
    # generated, every satOut index below aims at the wrong item.
    if live_program != graph["types"]["concert"][gid]["program"]:
        drifted.append(f"{date} ({cid}): live program differs from bso-graph.json")
        continue

    # SUBSUMED by the check above, and kept anyway. Once live_program equals the
    # graph's, and build_plan took every satOut id out of that same array, this
    # cannot fire -- so read it as an assertion of the invariant Contentful itself
    # cannot express (satOut is a subset of that concert's own program), not as a
    # net that is currently catching anything. It becomes load-bearing the moment
    # the equality check above is relaxed.
    escaped = [pid for pid in entry_plan["satOut"] if pid not in live_program]
    if escaped:
        drifted.append(f"{date} ({cid}): satOut {escaped} is not in its own program")
        continue

    live_attended = fields.get("attended", {}).get(LOCALE)
    live_sat_out = [l["sys"]["id"] for l in fields.get("satOut", {}).get(LOCALE, [])]

    if live_attended == entry_plan["attended"] and live_sat_out == entry_plan["satOut"]:
        # Right fields is not the same as visible. An entry whose values already
        # match but which was never published -- the documented two-step leaves
        # exactly that, and so does any crash between the write and publish passes
        # -- must still be publishable, or --publish silently does nothing and the
        # Delivery API keeps serving the version without participation on it.
        if DO_PUBLISH and not is_published(live):
            republish.append((live, entry_plan))
        else:
            unchanged.append(cid)
        continue

    if not FORCE and live_attended is not None and live_attended != entry_plan["attended"]:
        conflicts.append(f"{date} ({cid}): attended is {live_attended!r} live, "
                         f"plan says {entry_plan['attended']!r}")
        continue
    if not FORCE and live_sat_out and live_sat_out != entry_plan["satOut"]:
        conflicts.append(f"{date} ({cid}): satOut is {live_sat_out} live, "
                         f"plan says {entry_plan['satOut']}")
        continue

    writes.append((live, entry_plan))

print(f"\n  to write   {len(writes)}")
if DO_PUBLISH:
    print(f"  to publish {len(republish)}   (fields already correct, never published)")
print(f"  unchanged  {len(unchanged)}")
print(f"  conflicts  {len(conflicts)}")
print(f"  drifted    {len(drifted)}")

if drifted:
    print("\nDRIFT -- the space no longer matches bso-graph.json:", file=sys.stderr)
    for d in drifted:
        print(f"  {d}", file=sys.stderr)
    sys.exit("\nrefusing to write: satOut links would point at renumbered items. "
             "Re-run parse_archive.py and the importer first.")

if conflicts:
    print("\nCONFLICTS -- a live value disagrees with the plan and was NOT overwritten:")
    for c in conflicts:
        print(f"  {c}")
    print("  (--force overwrites these)")

if not writes and not republish:
    # Success, not failure: a second run after a clean pass lands here.
    print("\nnothing to write")
    sys.exit(1 if conflicts else 0)

for live, entry_plan in writes[:10] if not APPLY else []:
    print(f"    {entry_plan['date']}  {live['sys']['id']:24s} "
          f"attended={entry_plan['attended']}"
          + (f"  satOut={entry_plan['satOut']}" if entry_plan["satOut"] else ""))
if not APPLY:
    if len(writes) > 10:
        print(f"    ... and {len(writes) - 10} more")
    print("\nDRY RUN -- nothing was written. Pass --apply to write.")
    sys.exit(0)

# ------------------------------------------------------------------ write pass

print("\n--- writing")
written = []

for live, entry_plan in writes:
    cid = live["sys"]["id"]
    # A CMA update REPLACES the fields object, so the existing fields are carried
    # through rather than patched. Anything not named here survives untouched.
    fields = dict(live.get("fields", {}))
    fields["attended"] = {LOCALE: entry_plan["attended"]}
    if entry_plan["satOut"]:
        fields["satOut"] = {LOCALE: [{"sys": {"type": "Link", "linkType": "Entry", "id": pid}}
                                     for pid in entry_plan["satOut"]]}
    else:
        # DROP, do not skip. `fields` is a copy of the live entry, so leaving the
        # key alone writes any existing links straight back -- which would make
        # --force unable to clear a sit-out that has been un-ticked in the
        # checklist, reporting it as written and finding the same conflict
        # forever, with the work's page suppressed the whole time.
        fields.pop("satOut", None)

    try:
        updated = http("PUT", f"/entries/{cid}", {"fields": fields},
                       {"X-Contentful-Version": str(live["sys"]["version"])})
    except Conflict:
        print(f"  {entry_plan['date']}  SKIPPED -- changed underneath this run, "
              f"re-run to pick it up")
        continue
    written.append(updated)
    print(f"  {entry_plan['date']}  {cid:24s} attended={entry_plan['attended']}"
          + (f"  satOut={entry_plan['satOut']}" if entry_plan["satOut"] else ""))

print(f"\nwrote {len(written)} of {len(writes)}")

if not DO_PUBLISH:
    print("\nDrafts only. The Delivery API cannot see these until they are "
          "published -- re-run with --apply --publish.")
    sys.exit(0)

# Publishing is separate because unpublishing in bulk is painful, and because the
# archive's concerts were already published: a field write leaves a draft ahead of
# the published version, which the CDA does not serve.
#
# `republish` carries the entries this run did NOT write because their fields were
# already correct but never published. Without them, the documented two-step
# (--apply, then --apply --publish) would find everything unchanged and publish
# nothing at all.
print("\n--- publishing")
published = 0
for entry in written + [live for live, _ in republish]:
    cid = entry["sys"]["id"]
    try:
        http("PUT", f"/entries/{cid}/published", None,
             {"X-Contentful-Version": str(entry["sys"]["version"])})
    except Conflict:
        print(f"  {cid}  SKIPPED -- changed underneath this run")
        continue
    published += 1

to_publish = len(written) + len(republish)
print(f"\npublished {published} of {to_publish}    ({http.calls} API calls)")
