#!/usr/bin/env python3
"""Apply a transcribed-program declaration to Contentful. Stdlib only.

    python3 transcribe_programs.py --plan PLAN.json                  # dry run
    python3 transcribe_programs.py --plan PLAN.json --apply          # drafts
    python3 transcribe_programs.py --plan PLAN.json --apply --publish

AWK-64 built this for tilles-center-programs.json -- the three scanned Tilles
Center LIYO programs: two Composers, two Conductors, five Soloists, six Works,
seventeen Program items and three Concerts, plus one movement list merged into a
Work that already exists. AWK-82 generalised it for
lisfa-festival-programs.json, the three LISFA festival programs: two
Orchestras, three Halls, three Conductors, one Composer, seven Works, seven
Program items and three Concerts. Every id a declaration links but does not
create is declared under `reuse` and verified to resolve before anything is
written.

`--plan` IS REQUIRED, and defaulting it would be the wrong kindness. Both
declarations use deterministic ids, so running the wrong one is not destructive
-- it is worse than that: it is a re-run of an already-applied transcription,
which reports `unchanged` for every entry and succeeds. A run that does nothing
and says so cheerfully is indistinguishable from a run that worked, and the
person reading the output is the one who typed the wrong flag.

WHAT A DECLARATION MAY LEAVE OUT. `composers`, `conductors`, `soloists`,
`works`, `workMovements`, `halls` and `orchestras` are each optional and absent
means none -- AWK-82 creates no Soloists and merges no movement lists, and
AWK-64 creates neither a Hall nor an Orchestra. `concert.season` is optional
too, because a festival Concert legitimately has none (ADR-0006); `hall`,
`orchestra`, `conductor`, `date`, `title` and `attended` are not.

DRY RUN IS THE DEFAULT, like seed_participation.py, backfill_slugs.py,
merge_composers.py, backfill_seasons.py and seed_period_and_forms.py. The
transcription is 35 new entries against a live space with no staging
environment, so the default has to be the harmless one.

Safety properties, in the order they matter:

  * Deterministic ids. Every entry id comes from the declaration, so a re-run
    UPDATES rather than duplicating. This is the property that makes the script
    safe to run twice, and it is why the ids are in the JSON rather than
    generated here.

  * MERGE, never clobber. A field is written only if the live one is empty.
    import_to_contentful.py established this and names movement lists as
    curated data it must never overwrite; a transcription is in no position to
    disagree with a curator who came later. There is NO override flag, and that
    is deliberate: nothing in AWK-64 needs one, and a hook for correcting a
    published value is the kind of thing that gets reached for once and then
    lives forever. A field this script declines to write is reported as
    `kept live:`, so a correction that IS wanted is visible and can be made
    where the disagreement actually is -- the web app, or the declaration.

  * Link dependency order. Composers before Works, Works and Soloists before
    Program items, Program items before Concerts. A Concert linking an
    unpublished Program item is legal in Contentful and invisible on the site,
    which is the failure this ordering avoids.

  * Publishing is opt-in and last. An entry created and left as a draft is
    inert; an entry published while the Work it links is still a draft renders a
    Concert with a hole in its program. So --publish runs as a second pass in
    the same order, after every write has landed.

  * PUBLISH ONLY WHAT THIS RUN WROTE, plus entries that have never been
    published at all. AWK-83. Until then the pass published every row in the
    plan, which meant a row reported `unchanged` -- one the space ALREADY agreed
    with -- was published anyway, and the only thing that can do is push
    someone's in-progress editing live while the run reports success. Both
    declarations are re-run to check themselves and a re-run writes nothing, so
    the hazardous path was the ordinary one. `seed_period_and_forms.py` has had
    this rule from the start and is deliberately NOT changed by that ticket: it
    plans a row only where it has something to do, and its docstring states the
    principle -- publication state is preserved, never chosen.

WHAT THIS SCRIPT DOES NOT DO: period and form. ADR-0007 puts every form
judgement in period-and-forms.json, and work.period inherits from the composer
in the build sweep. Run imslp_harvest.py then seed_period_and_forms.py after
this -- both are idempotent, and the new Concerts pull Piston, Ferdinand David
and Franck into scope.
"""
import json, os, sys, time, urllib.request, urllib.error
from pathlib import Path

SPACE = os.environ.get("CONTENTFUL_SPACE_ID", "3iiyvj5u5c9h")
ENV = os.environ.get("CONTENTFUL_ENVIRONMENT_ID", "master")
LOCALE = os.environ.get("CONTENTFUL_LOCALE", "en-US")
BASE = f"https://api.contentful.com/spaces/{SPACE}/environments/{ENV}"

DECLARATIONS = ("tilles-center-programs.json", "lisfa-festival-programs.json")

FLAGS = {"--apply", "--publish"}
TAKES_VALUE = {"--token-file", "--plan"}


def _parse_argv(argv):
    """Reject anything unrecognized, like every sibling script does.

    Not decoration. This script's default is the harmless one, so a typo has to
    fail rather than fall through to it: `--publsh` accepted-and-ignored writes
    35 entries and leaves every one of them an invisible draft, and the run
    reports success. merge_composers.py makes the same argument the other way
    round -- there, `--aply` reading as a report is harmless -- and the asymmetry
    is why both need the check rather than trusting the default to be safe.
    """
    options = {"apply": False, "publish": False, "token_file": None, "plan": None}
    index = 0
    while index < len(argv):
        argument = argv[index]
        if argument in TAKES_VALUE:
            if index + 1 >= len(argv):
                sys.exit(f"{argument} needs a value")
            # Keyed off the flag, not hardcoded. The first version assigned every
            # value-taking flag to token_file, which was correct while there was
            # one of them and would have made `--plan X` set the token path.
            options[argument.lstrip("-").replace("-", "_")] = argv[index + 1]
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


OPTIONS = _parse_argv(sys.argv[1:])
APPLY = OPTIONS["apply"]
DO_PUBLISH = OPTIONS["publish"]


def resolve_plan(name):
    """Required, and resolved relative to this directory as well as to the cwd,
    so `--plan lisfa-festival-programs.json` works from anywhere."""
    if not name:
        sys.exit("--plan is required; see the module docstring for why.\n"
                 "declarations in this directory:\n  " + "\n  ".join(DECLARATIONS))
    path = Path(name)
    if not path.exists():
        path = Path(__file__).parent / name
    if not path.exists():
        sys.exit(f"--plan {name}: no such file")
    return path


PLAN = resolve_plan(OPTIONS["plan"])


def read_token(token_file):
    """Same three sources as import_to_contentful.py, in the same order. The
    file default keeps the token out of shell history and out of this repo,
    which is public."""
    if os.environ.get("CONTENTFUL_CMA_TOKEN"):
        return os.environ["CONTENTFUL_CMA_TOKEN"].strip()
    if token_file:
        return Path(token_file).read_text().strip()
    default = Path.home() / ".contentful-cma-token"
    if default.exists():
        return default.read_text().strip()
    return None


TOKEN = read_token(OPTIONS["token_file"])


# ------------------------------------------------------------------ http

class Http:
    """Minimal CMA client. Counts calls and paces them, because the CMA's rate
    limit is per second and this script makes ~90 calls in a burst."""

    def __init__(self):
        self.calls = 0

    def __call__(self, method, path, body=None, headers=None, ok404=False):
        if not TOKEN:
            sys.exit("no CMA token: set CONTENTFUL_CMA_TOKEN, pass --token-file, "
                     "or put it in ~/.contentful-cma-token")
        url = path if path.startswith("http") else BASE + path
        data = json.dumps(body).encode() if body is not None else None
        h = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/vnd.contentful.management.v1+json"}
        h.update(headers or {})
        req = urllib.request.Request(url, data=data, headers=h, method=method)
        for attempt in range(5):
            try:
                self.calls += 1
                with urllib.request.urlopen(req) as r:
                    time.sleep(0.12)
                    return json.load(r) if r.status != 204 else None
            except urllib.error.HTTPError as e:
                if e.code == 404 and ok404:
                    return None
                if e.code == 429:
                    time.sleep(2 ** attempt)
                    continue
                sys.exit(f"{method} {path} -> {e.code}\n{e.read().decode()[:800]}")
        sys.exit(f"{method} {path}: rate limited five times")


http = Http()


def loc(v):
    return {LOCALE: v}


def link(entry_id):
    return {"sys": {"type": "Link", "linkType": "Entry", "id": entry_id}}


def links(ids):
    return [link(i) for i in ids]


def live_value(entry, name):
    v = (entry.get("fields") or {}).get(name)
    return v.get(LOCALE) if isinstance(v, dict) else v


def is_empty(v):
    return v is None or v == "" or v == [] or v == {}


def has_unpublished_changes(sys_block):
    """True when the entry is published AND carries edits nobody published.

    AWK-83. The arithmetic is the part worth stating: Contentful bumps `version`
    on every save, and a publish IS a save -- so `publishedVersion` is the
    version the publish captured and a freshly published entry sits at
    `publishedVersion + 1`, not at `publishedVersion`. Anything above that is a
    draft change stacked on a published entry.

    A never-published entry is NOT this. It has no `publishedVersion` at all,
    and it is the case the publish pass exists to serve."""
    published = sys_block.get("publishedVersion")
    return published is not None and sys_block["version"] > published + 1


def entries(record):
    """Plan files in this directory carry a `note` inside each object. It is
    prose, not a key."""
    return {k: v for k, v in record.items() if k != "note"}


# ------------------------------------------------------------------ plan

def section(decl, name):
    """One optional top-level group. Absent means none -- see the docstring's
    note on what a declaration may leave out. A group that is present but holds
    only its `note` also means none, which is how AWK-82 states that it creates
    no Soloists rather than staying silent about them."""
    return entries(decl.get(name) or {})


def build_plan(decl):
    """Flatten the declaration into an ordered list of writes.

    Order is the link dependency order, and it is the reason this returns a list
    rather than the dict it came from."""
    plan = []

    # Halls and Orchestras first. Neither links anything, and both are linked BY
    # a Concert -- so they cannot be created after one, and there is nothing to
    # order them against each other.
    for hid, rec in section(decl, "halls").items():
        plan.append(("hall", hid, {
            "name": rec["name"], "location": rec["location"], "slug": rec["slug"],
        }))

    for oid, rec in section(decl, "orchestras").items():
        plan.append(("orchestra", oid, {
            "name": rec["name"], "abbreviation": rec["abbreviation"],
        }))

    for cid, rec in section(decl, "composers").items():
        plan.append(("composer", cid, {
            "firstName": rec["firstName"], "lastName": rec["lastName"],
            "sortName": rec["sortName"], "slug": rec["slug"],
        }))

    for cid, rec in section(decl, "conductors").items():
        # No slug. All 46 live conductors have it unset; see the JSON's note.
        plan.append(("conductor", cid, {
            "firstName": rec["firstName"], "lastName": rec["lastName"],
        }))

    for sid, rec in section(decl, "soloists").items():
        plan.append(("soloist", sid, {
            "firstName": rec["firstName"], "lastName": rec["lastName"],
            "fullName": rec["fullName"], "instrument": rec["instrument"],
        }))

    for wid, rec in section(decl, "works").items():
        fields = {"title": rec["title"], "slug": rec["slug"], "composer": link(rec["composer"])}
        if rec.get("movement"):
            fields["movement"] = rec["movement"]
        # AWK-82. The space's `Title ("Nickname")` convention across 46 Works
        # keeps the nickname in both places; the field is what a reader can
        # search on, the parenthetical is what renders.
        if rec.get("nickname"):
            fields["nickname"] = rec["nickname"]
        plan.append(("work", wid, fields))

    # A Work that already exists, gaining only what the scan adds.
    for wid, rec in section(decl, "workMovements").items():
        plan.append(("work", wid, {"movement": rec["movement"]}))

    for cid, concert in entries(decl["concerts"]).items():
        for item in concert["program"]:
            fields = {
                "label": item["label"], "order": item["order"],
                "work": link(item["work"]), "composer": link(item["composer"]),
            }
            if item.get("conductor"):
                fields["conductor"] = link(item["conductor"])
            if item.get("soloists"):
                fields["soloists"] = links(item["soloists"])
            if item.get("character"):
                fields["character"] = item["character"]
            if item.get("credits"):
                fields["credits"] = item["credits"]
            if item.get("note"):
                fields["note"] = item["note"]
            plan.append(("programItem", item["id"], fields))

    for cid, concert in entries(decl["concerts"]).items():
        fields = {
            "title": concert["title"], "date": concert["date"],
            "hall": link(concert["hall"]),
            "orchestra": links(concert["orchestra"]),
            "conductor": link(concert["conductor"]),
            "attended": concert["attended"],
            "program": links([i["id"] for i in concert["program"]]),
            "satOut": links(concert["satOut"]),
        }
        # AWK-82. OPTIONAL, and absent is a decision rather than a gap: ADR-0006
        # records that a festival Concert "carries no season at all and keeps
        # none". Omitted rather than written as null, so that a Concert which
        # somehow acquires one later is a merge into an empty field like any
        # other -- writing null here would make the field a value this script
        # then declines to change.
        if concert.get("season"):
            fields["season"] = link(concert["season"])
        plan.append(("concert", cid, fields))

    return plan


def verify_reuse(decl):
    """Every id the transcription links but does not create, resolved against
    the live space and CHECKED AGAINST ITS DECLARED NAME before anything is
    written.

    This is the check the declaration cannot make. A stale id does not fail
    loudly at write time -- Contentful accepts a link to a nonexistent entry and
    the build renders a Concert with a hole in it -- so it is worth a GET each.

    Three failures, and the second two are why the declared `name` / `title` /
    `sortName` are here at all. They are the checked redundancy
    seed_period_and_forms.py describes as "WORK IDS ARE CHECKED AGAINST THEIR
    TITLES ... aborts rather than writing to whatever now holds that id", not
    decoration for a human reader:

      MISSING    the id resolves to nothing
      WRONGTYPE  the id resolves to a different content type
      RENAMED    the id resolves, but to an entry the declaration would not
                 recognise -- either the entry moved on or the id is now
                 pointing at the wrong thing, and only a person can say which

    RENAMED aborts rather than warning, which it did not in the first version of
    this script. It printed `ok` beside a mismatch note, and the first thing that
    mismatch caught was real: `Franck, Cesar` became `Franck, César` when the
    period seed restored his diacritic an hour after this declaration was
    written. A check that reports a true finding under the word `ok` is a check
    nobody will read twice."""
    reuse = decl.get("reuse") or {}
    targets = []

    # TWO SHAPES, ONE WALKER, and the branch is deliberate. AWK-64 reuses exactly
    # one Hall, one Orchestra and one Conductor across its three Concerts, so it
    # declares them singular: `reuse.hall` is an object. AWK-82 reuses none of
    # the three and six Composers instead. Reading both costs the SINGULAR tuple
    # below; the alternative was restructuring a declaration whose own note says
    # a correction to it is the only record of that correction, which is a worse
    # trade than four lines here.
    #
    # The expected name is read from whichever key that content type displays --
    # the same field verify_reuse compares against the live entry.
    SINGULAR = (("hall", "name"), ("orchestra", "name"), ("conductor", "name"))
    PLURAL = (("halls", "name", "hall"), ("orchestras", "name", "orchestra"),
              ("conductors", "name", "conductor"), ("seasons", "label", "season"),
              ("composers", "sortName", "composer"), ("works", "title", "work"))

    for key, name_field in SINGULAR:
        if key in reuse:
            targets.append((key, reuse[key]["id"], reuse[key][name_field], key))
    for key, name_field, want_type in PLURAL:
        for label, rec in entries(reuse.get(key) or {}).items():
            targets.append((f"{want_type} {label}", rec["id"], rec[name_field], want_type))

    seen, bad = set(), []
    for what, eid, expected, want_type in targets:
        if eid in seen:
            continue
        seen.add(eid)
        entry = http("GET", f"/entries/{eid}", ok404=True)
        if entry is None:
            bad.append(f"  MISSING   {what:<28} {eid}  (expected {expected!r})")
            continue
        ctype = entry["sys"]["contentType"]["sys"]["id"]
        # Six content types with six display fields. `conductor` and `soloist`
        # have no single one, hence the name join.
        first, last = live_value(entry, "firstName"), live_value(entry, "lastName")
        joined = " ".join(p for p in (first, last) if p) or None
        display = (live_value(entry, "title") or live_value(entry, "name")
                   or live_value(entry, "label") or live_value(entry, "sortName")
                   or live_value(entry, "fullName") or joined)
        if ctype != want_type:
            bad.append(f"  WRONGTYPE {what:<28} {eid}  is a {ctype}, expected a {want_type}")
            continue
        if display != expected:
            bad.append(f"  RENAMED   {what:<28} {eid}  declaration says {expected!r}, "
                       f"space says {display!r}")
            continue
        print(f"  ok        {what:<28} {eid:<26} {ctype}")
    return bad


def verify_new_work_slugs(decl):
    """Every new work's slug, checked against its composer's LIVE works.

    ADR-0008 scopes work slugs to the composer, and AWK-37 dropped
    work.slug's space-wide `unique` on 2026-08-30 -- so Contentful will now
    accept a colliding pair at publish time and app/lib/invariants.ts fails the
    next build instead. That moves the guard from write time to build time, and
    this closes the gap: a collision found here costs a re-read of the JSON,
    the same collision found by the build costs a hunt through 649 works.

    tilles-center-programs.test.ts checks the six slugs against each other and
    against both rejected shapes. It cannot see the space, which is the half
    this does."""
    by_composer = {}
    for wid, rec in section(decl, "works").items():
        by_composer.setdefault(rec["composer"], []).append((wid, rec["slug"]))

    bad = []
    for composer_id, wanted in sorted(by_composer.items()):
        live, skip = [], 0
        while True:
            batch = http("GET", f"/entries?content_type=work&limit=1000&skip={skip}"
                                f"&fields.composer.sys.id={composer_id}"
                                f"&sys.archivedAt%5Bexists%5D=false")
            live += batch["items"]
            skip += len(batch["items"])
            if skip >= batch["total"] or not batch["items"]:
                break
        taken = {}
        for entry in live:
            taken[live_value(entry, "slug")] = entry["sys"]["id"]
        for wid, slug in wanted:
            holder = taken.get(slug)
            if holder and holder != wid:
                bad.append(f"  COLLIDES {slug!r} under composer {composer_id} "
                           f"is already held by {holder} (wanted for {wid})")
            else:
                print(f"  free     {slug:<56} under {composer_id} "
                      f"({len(live)} live work(s) for this composer)")
    return bad


# ------------------------------------------------------------------ write

def write(ctype, eid, fields):
    """Create or merge one entry.

    Returns (action, differing_field_names) -- where a differing field is one
    the space holds a DIFFERENT non-empty value for. That is the only outcome
    here a person needs to look at: the declaration and the space disagree, and
    this script will not resolve it either way."""
    live = http("GET", f"/entries/{eid}", ok404=True)
    if live is None:
        body = {"fields": {k: loc(v) for k, v in fields.items()}}
        http("PUT", f"/entries/{eid}", body, {"X-Contentful-Content-Type": ctype})
        return "created", [], False

    # AWK-83. Read BEFORE the merge, because our own write is about to make this
    # true of every row we touch. What it means afterwards is: this entry already
    # held someone's unpublished editing when we arrived.
    foreign_draft = has_unpublished_changes(live["sys"])

    # Merge, three outcomes per field. There is deliberately no override flag --
    # see the note on merge semantics in the module docstring.
    #
    # AGREES has to be checked BEFORE empty, and that ordering is the whole of
    # this function's history. `is_empty` is true of `[]`, and `concert.satOut`
    # is legitimately `[]` on all three of these Concerts -- so a version that
    # asked only "is the live value empty?" rewrote satOut on every run, bumped
    # each Concert's version, and left three published entries showing
    # unpublished changes that differed from the published version in nothing at
    # all. An applier whose second run is not a no-op cannot be re-run to check
    # itself, which is most of why deterministic ids are worth having.
    #
    # The equality alone is not enough either, and this is the part worth
    # knowing: CONTENTFUL DOES NOT STORE AN EMPTY ARRAY. Writing `satOut: []`
    # leaves the field absent from the entry, so it reads back as None and never
    # equals the `[]` that was sent. Two empties therefore have to be treated as
    # agreement explicitly -- comparing the values is not sufficient when the
    # round trip does not preserve them.
    merged = dict(live["fields"])
    wrote, agrees, differs = [], [], []
    for name, value in fields.items():
        current = live_value(live, name)
        if current == value or (is_empty(current) and is_empty(value)):
            agrees.append(name)
        elif is_empty(current):
            merged[name] = loc(value)
            wrote.append(name)
        else:
            differs.append(name)
    if not wrote:
        return "unchanged", differs, foreign_draft
    http("PUT", f"/entries/{eid}", {"fields": merged},
         {"X-Contentful-Version": str(live["sys"]["version"])})
    return "merged", differs, foreign_draft


def publish(eid, wrote_it):
    """Publish an entry this run WROTE, or one that has never been published.
    Leave anything else exactly as it was found.

    AWK-83. The first version of this published every row in the plan, declining
    only where there was nothing unpublished to publish -- which inverted the
    intent. A row reported `unchanged` is one the space already agreed with, so
    the only thing a publish can do to it is push somebody's in-progress editing
    live, and the run would then report success. `seed_period_and_forms.py` had
    the rule right from the start: publication state is preserved, never chosen.

    THE NEVER-PUBLISHED CLAUSE IS NOT A LOOPHOLE, it is the two-step flow.
    `--apply` alone leaves drafts and says so; a later `--publish` has to be able
    to publish them, and by then it writes nothing, so "wrote it" is false for
    every row. Those drafts are the declaration's own -- it created them -- which
    is what makes publishing them a resumption rather than a decision.

    A draft edit sitting on an entry we DO write is not separable from our own:
    Contentful publishes an entry, not a field. Those go live with ours, so the
    caller warns about them by name instead of letting the run pass quietly."""
    live = http("GET", f"/entries/{eid}")
    sys_ = live["sys"]
    never_published = sys_.get("publishedVersion") is None

    if not wrote_it and not never_published:
        return "left alone" if has_unpublished_changes(sys_) else "already"
    if not never_published and sys_["version"] == sys_["publishedVersion"] + 1:
        return "already"
    http("PUT", f"/entries/{eid}/published", None, {"X-Contentful-Version": str(sys_["version"])})
    return "published"


# ------------------------------------------------------------------ main

def main():
    decl = json.loads(PLAN.read_text())
    plan = build_plan(decl)
    guards = entries(decl["guards"])

    print(f"space {SPACE} / env {ENV}")
    print(f"declaration {PLAN.name}: {len(plan)} writes\n")

    # The declaration's own arithmetic, before the network is touched.
    counts = {}
    for ctype, _, _ in plan:
        counts[ctype] = counts.get(ctype, 0) + 1
    # `.get(..., 0)` on the creation counts, because a declaration that creates
    # none of something says so by omitting the guard as well as the group --
    # AWK-64 declares no `hallsCreated`. The two counts a declaration cannot
    # omit are `programItems` and `concerts`: a transcription with neither is
    # not a transcription, and a missing guard there should read as a broken
    # file rather than as zero.
    expected = {
        "hall": guards.get("hallsCreated", 0),
        "orchestra": guards.get("orchestrasCreated", 0),
        "composer": guards.get("composersCreated", 0),
        "conductor": guards.get("conductorsCreated", 0),
        "soloist": guards.get("soloistsCreated", 0),
        "work": guards.get("worksCreated", 0) + guards.get("workMovementsMerged", 0),
        "programItem": guards["programItems"],
        "concert": guards["concerts"],
    }
    for ctype, want in expected.items():
        got = counts.get(ctype, 0)
        flag = "" if got == want else f"   <-- MISMATCH, guards say {want}"
        print(f"  {ctype:<12} {got}{flag}")
        if got != want:
            sys.exit("declaration disagrees with its own guards; fix the JSON")

    print("\nverifying the ids this transcription reuses:")
    bad = verify_reuse(decl)

    print("\nchecking each new work's slug against its composer's live works:")
    bad += verify_new_work_slugs(decl)

    if bad:
        print("\n" + "\n".join(bad))
        sys.exit("\npre-flight checks failed. Nothing written.")

    if not APPLY:
        print("\n--- DRY RUN, nothing written. Pass --apply to write. ---\n")
        for ctype, eid, fields in plan:
            live = http("GET", f"/entries/{eid}", ok404=True)
            state = "new" if live is None else "exists"
            shown = ", ".join(sorted(fields))
            print(f"  {state:<7} {ctype:<12} {eid:<52} {shown}")
        print(f"\n{http.calls} API calls. Re-run with --apply to write {len(plan)} entries.")
        return

    print("\napplying:")
    actions, disagreements = {}, []
    written, swept = set(), []
    for ctype, eid, fields in plan:
        action, differs, foreign_draft = write(ctype, eid, fields)
        actions[action] = actions.get(action, 0) + 1
        tail = f"   DIFFERS, left alone: {', '.join(differs)}" if differs else ""
        if differs:
            disagreements.append(f"  {ctype} {eid}: {', '.join(differs)}")
        # AWK-83. `written` is what the publish pass is allowed to publish.
        if action in ("created", "merged"):
            written.add(eid)
            if foreign_draft:
                swept.append(f"  {ctype} {eid}")
        print(f"  {action:<10} {ctype:<12} {eid}{tail}")
    print("  " + "  ".join(f"{k}={v}" for k, v in sorted(actions.items())))
    if disagreements:
        print("\nThe space holds a different value for these, and they were NOT overwritten.\n"
              "Reconcile in the web app or correct the declaration:")
        print("\n".join(disagreements))
    if swept:
        print("\nWARNING — these already held unpublished edits when this run wrote to them.\n"
              "Contentful publishes an entry, not a field, so anything unpublished on them\n"
              "goes live with this run's values. Check them in the web app:")
        print("\n".join(swept))

    if DO_PUBLISH:
        print("\npublishing what this run wrote, in the same order:")
        states, left = {}, []
        for ctype, eid, _ in plan:
            state = publish(eid, eid in written)
            states[state] = states.get(state, 0) + 1
            if state == "left alone":
                left.append(f"  {ctype} {eid}")
            print(f"  {state:<11} {ctype:<12} {eid}")
        print("  " + "  ".join(f"{k}={v}" for k, v in sorted(states.items())))
        if left:
            print("\nLEFT ALONE — published already, holding unpublished edits this run did not\n"
                  "make. Someone is mid-edit, or a publish was refused. Either way it is not\n"
                  "this script's to decide; publish them in the web app when they are ready:")
            print("\n".join(left))
    else:
        print("\nEntries this run created are DRAFTS. Nothing renders until --publish runs.")

    print(f"\n{http.calls} API calls.")
    # --refresh, not a plain re-run: the harvest caches the Delivery read in
    # .imslp-cache/archive.json, so the first pass after a transcription reads
    # yesterday's scope and reports nothing new. AWK-64 lost a pass to this.
    print("Next: imslp_harvest.py --refresh, then seed_period_and_forms.py --apply, "
          "then bun run build.")


if __name__ == "__main__":
    main()
