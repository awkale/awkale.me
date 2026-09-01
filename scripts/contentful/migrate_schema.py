#!/usr/bin/env python3
"""Apply archive-schema.json to the Contentful space. Stdlib only.

    python3 scripts/contentful/migrate_schema.py --dry-run   # report, write nothing
    python3 scripts/contentful/migrate_schema.py             # add the fields
    python3 scripts/contentful/migrate_schema.py --drop-work-slug-unique
    python3 scripts/contentful/migrate_schema.py --delete-work-genre

AWK-30. Schema only — this writes no entry data, so it is safe to run before the
re-import (AWK-20) and before any seeding pass.

Safety properties:
  * ADDITIVE. A field already present by id is left exactly as it is, never
    reshaped. So this cannot clobber a hand-edit in the Contentful UI, and a
    re-run after a partial failure resumes rather than duplicating.
  * Every field it adds is OPTIONAL, which is what makes adding one to a type
    with published entries safe: no existing entry becomes invalid.
  * Contentful cannot change a field's type in place, so nothing here tries.
    `work.genre` (a Link) is never touched by a default run — ADR-0007 retires
    it, and the delete is behind `--delete-work-genre` (AWK-66).
  * The destructive changes the spec calls for — removing `unique: true` from
    `work.slug`, and deleting `work.genre` — are each behind their own flag and
    do nothing on a default run. See `gated` in archive-schema.json for why the
    ordering is not negotiable.
  * ONE GATE IS ENFORCED RATHER THAN CONFIRMED. `--delete-work-genre` counts the
    Works still holding a `genre` and no `forms` and refuses above zero. The
    other four name a test or a backfill this script cannot see, so their prompt
    is the operator's word; this one is a live check.
  * Read-modify-write against X-Contentful-Version, so a concurrent edit in the
    web app loses the race loudly (409) rather than being silently overwritten.

Credentials are resolved exactly as import_to_contentful.py resolves them:
CONTENTFUL_CMA_TOKEN, else --token-file PATH, else ~/.contentful-cma-token.
That token must never enter CI (ADR-0002).
"""
import json, os, sys, time, urllib.parse, urllib.request, urllib.error
from pathlib import Path

SPACE = os.environ.get("CONTENTFUL_SPACE_ID", "3iiyvj5u5c9h")
ENV = os.environ.get("CONTENTFUL_ENVIRONMENT_ID", "master")
BASE = f"https://api.contentful.com/spaces/{SPACE}/environments/{ENV}"
SCHEMA = Path(__file__).parent / "archive-schema.json"
LOCALE = os.environ.get("CONTENTFUL_LOCALE", "en-US")

FLAGS = {"--dry-run", "--drop-work-slug-unique", "--drop-season-number-unique",
         "--require-work-slug", "--require-composer-slug", "--delete-work-genre",
         "--yes"}
TAKES_VALUE = {"--token-file"}


def _parse_argv(argv):
    """Reject anything unrecognized, because the default action WRITES.

    Testing membership without validating the rest means `--dryrun`, `--dry_run`
    or `-n` all read as "not a dry run" and apply ten fields to the production
    space. A typo must not be the difference between a report and a migration."""
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
                f"usage: migrate_schema.py [--dry-run]\n"
                f"                         [--drop-work-slug-unique [--yes]]\n"
                f"                         [--drop-season-number-unique [--yes]]\n"
                f"                         [--require-work-slug [--yes]]\n"
                f"                         [--require-composer-slug [--yes]]\n"
                f"                         [--delete-work-genre [--yes]]\n"
                f"                         [--token-file PATH]"
            )
        seen.add(arg)
        i += 1
    return seen


ARGS = _parse_argv(sys.argv[1:])
DRY = "--dry-run" in ARGS
DROP_WORK_SLUG = "--drop-work-slug-unique" in ARGS
DROP_SEASON_NUMBER = "--drop-season-number-unique" in ARGS
REQUIRE_WORK_SLUG = "--require-work-slug" in ARGS
REQUIRE_COMPOSER_SLUG = "--require-composer-slug" in ARGS
DELETE_WORK_GENRE = "--delete-work-genre" in ARGS
ASSUME_YES = "--yes" in ARGS


def _read_token():
    """CONTENTFUL_CMA_TOKEN env var, else --token-file PATH, else
    ~/.contentful-cma-token. A file keeps the token out of shell history and out
    of this repo (which is public)."""
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
    """Same shape as import_to_contentful.py's client: rate-limited to ~6 req/s,
    retries 429 and 5xx, surfaces everything else."""

    def __init__(self):
        self.calls = 0
        self.last = 0.0

    def __call__(self, method, path, body=None, headers=None, ok404=False):
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
                if e.code == 404 and ok404:
                    return None
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

# ------------------------------------------------------------------ planning


def plan_additions(ct, want):
    """Fields in `want` that the live content type `ct` does not already have.

    Matched by field id only. A field whose id is present but whose shape has
    drifted is reported as PRESENT and left alone — reshaping it is exactly the
    class of change Contentful refuses for type edits anyway, and doing it
    silently would undo a deliberate hand-edit."""
    have = {f["id"]: f for f in ct["fields"]}
    add, present, drift = [], [], []
    for field in want:
        live = have.get(field["id"])
        if live is None:
            add.append(field)
        else:
            present.append(field["id"])
            if not _same_shape(live, field):
                drift.append(field["id"])
    return add, present, drift


def _same_shape(live, want):
    """Compare only what this script would have set. Contentful adds keys of its
    own to a stored field, so an exact dict equality would report drift on every
    field it has ever touched."""
    return all(live.get(k) == v for k, v in want.items())


def describe(field):
    t = field["type"]
    if t == "Array":
        items = field.get("items", {})
        inner = items.get("linkType") or items.get("type")
        if items.get("type") == "Link":
            targets = _link_targets(items.get("validations", []))
            inner = f"Link<{targets}>"
        t = f"Array<{inner}>"
    elif t == "Link":
        t = f"Link<{_link_targets(field.get('validations', []))}>"
    extra = []
    for v in field.get("validations", []):
        if v.get("unique"):
            extra.append("unique")
        if "in" in v:
            extra.append(f"in[{len(v['in'])}]")
    for v in field.get("items", {}).get("validations", []):
        if "in" in v:
            extra.append(f"in[{len(v['in'])}]")
    return f"{t}{' ' + ', '.join(extra) if extra else ''}"


def _link_targets(validations):
    for v in validations:
        if "linkContentType" in v:
            return "|".join(v["linkContentType"])
    return "any"


def fetch_entries(content_type):
    """Every entry of a type, archived ones excluded.

    The only place this schema script reads ENTRY data, and it is here because
    delete-work-genre's precondition is a fact about entries rather than about
    the type.

    `sys.archivedAt[exists]=false` is not optional tidying. AGENTS.md records
    that the management API counts archived entries while the Delivery API hides
    them — AWK-20 archived 16 superseded programItems — so counting them would
    let a row nothing serves block a delete, or worse, be counted as migrated."""
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
        payload = http("GET", f"/entries?{query}")
        items += payload["items"]
        skip += len(payload["items"])
        if skip >= payload["total"] or not payload["items"]:
            break
    return items


def unmigrated(content_type, field_id, replacement):
    """Entries holding `field_id` and nothing in `replacement`.

    THE COUNT THAT GATES THE DELETE, and the reason this gate is a check rather
    than a prompt: a field is the only record of its own data, and a deleted one
    cannot be re-derived. ADR-0007 says so in as many words — "Deleting it
    earlier discards 218 assignments with nothing to migrate from."

    An empty array and an absent field are the same state here, so `or []`
    rather than a presence test: `forms: []` is a Work that was written and
    carries nothing, which is exactly as lost as one never written to."""
    stranded = []
    for entry in fetch_entries(content_type):
        fields = entry.get("fields", {})
        held = fields.get(field_id, {}).get(LOCALE)
        carried = fields.get(replacement, {}).get(LOCALE) or []
        if held and not carried:
            stranded.append((entry["sys"]["id"], fields.get("title", {}).get(LOCALE) or "?"))
    return stranded


# ------------------------------------------------------------------ applying


def needs_activation(ct):
    """True when the type holds edits the Delivery API is not serving.

    Adding a field is TWO calls — PUT the type, then PUT /published — and only
    the second makes the field visible to anything reading the CDA. If the first
    lands and the second does not (retries exhausted, dropped connection, Ctrl-C)
    the fields exist as an unactivated draft, and a naive re-run reads them back,
    finds every field present, and reports "nothing to do" while the CDA still
    cannot see them. That is a silent, permanent half-migration.

    Contentful bumps `version` on the publish itself, so a freshly activated type
    satisfies `version == publishedVersion + 1`. Anything higher means unpublished
    changes; a missing `publishedVersion` means it was never activated at all."""
    published = ct["sys"].get("publishedVersion")
    return published is None or ct["sys"]["version"] > published + 1


def save(ct, note):
    """PUT the modified content type, then re-activate it.

    Both halves matter. A content type edit lands as a new DRAFT version, and the
    Delivery API keeps serving the last activated one — so skipping the publish
    leaves the field invisible to everything that reads the CDA, which is the
    entire point of the ticket.

    The body is the content type MINUS `sys`, rather than a rebuilt set of the
    keys this script happens to know about. PUT replaces the whole type, so an
    allow-list silently drops anything outside it — `metadata`, which carries
    taxonomy concepts and annotations, being the one that exists today. Sending
    back what was read cannot lose a property that gets added later either."""
    cid = ct["sys"]["id"]
    version = ct["sys"]["version"]
    body = {k: v for k, v in ct.items() if k != "sys"}
    updated = http(
        "PUT",
        f"/content_types/{cid}",
        body,
        {"X-Contentful-Version": str(version)},
    )
    activate(cid, updated["sys"]["version"])
    print(f"  {note}")


def activate(cid, version):
    """PUT /published — the half that makes a field visible to the CDA."""
    http(
        "PUT",
        f"/content_types/{cid}/published",
        None,
        {"X-Contentful-Version": str(version)},
    )


def add_fields():
    schema = json.loads(SCHEMA.read_text())
    total_added = total_drift = total_stranded = 0

    for group in schema["types"]:
        cid = group["id"]
        ct = http("GET", f"/content_types/{cid}", ok404=True)
        if ct is None:
            sys.exit(f"content type {cid!r} does not exist in {SPACE}/{ENV}")

        add, present, drift = plan_additions(ct, group["addFields"])
        stranded = not add and needs_activation(ct)

        print(f"\n{cid}")
        for fid in present:
            print(f"  = {fid:<16} already present, untouched")
        for fid in drift:
            print(f"  ! {fid:<16} present but its shape differs from the spec")
        for field in add:
            print(f"  + {field['id']:<16} {describe(field)}")
        if stranded:
            print("  ! this type has unactivated changes — the CDA is not serving them")

        total_drift += len(drift)

        if stranded:
            # A previous run wrote the fields and failed before activating. The
            # fields read back as present, so without this the migration is
            # permanently half-applied and every re-run says "nothing to do".
            total_stranded += 1
            if not DRY:
                activate(cid, ct["sys"]["version"])
                print(f"  -> re-activated {cid}")
            continue

        if not add:
            continue
        total_added += len(add)
        if DRY:
            continue

        ct["fields"].extend(add)
        save(ct, f"-> wrote {len(add)} field(s) and re-activated {cid}")

    return total_added + total_stranded, total_drift


def _gate(gate_id, enforced=False):
    """The gate's declaration, and the confirmation it demands.

    Shared by every gated step rather than copied, because the WARNING is the
    load-bearing part. Each of these removes a guarantee from a production
    space on the operator's word, and a prompt that drifts between them is a
    prompt someone stops reading.

    `enforced` says the caller checks `blockedBy` itself against the live space,
    which is true of exactly one gate — delete-work-genre, whose precondition is
    a countable property of the data rather than a test that has landed. Printing
    the CANNOT-verify warning there would be a lie, and a warning that is
    sometimes false is the fastest way to teach someone to skip it."""
    schema = json.loads(SCHEMA.read_text())
    gate = next(g for g in schema["gated"] if g["id"] == gate_id)

    if enforced:
        print(f"  blocked by: {gate['blockedBy']}")
        print("  This script CHECKS that below, against the live space.")
        return gate

    # NOT a gate this script can enforce. It cannot see whether the replacement
    # is in place, so `blockedBy` is a note to a human, and running the flag to
    # "check" would perform the change. Say so plainly, and make the operator
    # confirm rather than implying the script is guarding anything.
    print(f"  {gate['blockedBy']} must already be landed and green. This script")
    print("  CANNOT verify that — it is your confirmation, not a check.")
    return gate


def _confirm(gate, question=None):
    """False when the operator declines. `--yes` is the unattended answer.

    `question` overrides the default for a gate whose `blockedBy` this script has
    already checked. Asking "is the migration landed and green?" after verifying
    it live would be asking the operator to confirm something already known; the
    thing still worth confirming there is the one-way door itself."""
    if ASSUME_YES:
        return True
    if not sys.stdin.isatty():
        sys.exit("  refusing to run unattended; pass --yes if that is intended")
    answer = input(question or f"  Is {gate['blockedBy']} landed and green? [y/N] ").strip()
    if answer.lower() in ("y", "yes"):
        return True
    print("  aborted; nothing written")
    return False


def require_field(gate_id):
    """Make a field required. The opposite direction of travel from add_fields().

    Every field this script ADDS is optional, which is what makes adding one to
    a type full of published entries safe. This does the reverse, so it is gated:
    a required field does not invalidate stored data, but every entry lacking a
    value fails its next publish. The gate's `why` records the gap count checked
    before it was written."""
    print(f"\n{gate_id}")
    gate = _gate(gate_id)

    ct = http("GET", f"/content_types/{gate['contentType']}")
    field = next((f for f in ct["fields"] if f["id"] == gate["field"]), None)
    if field is None:
        sys.exit(f"  {gate['contentType']}.{gate['field']} does not exist")

    if field.get("required"):
        print(f"  = {gate['contentType']}.{gate['field']} is already required; nothing to do")
        return 0

    print(f"  + required     {gate['contentType']}.{gate['field']}")
    if DRY:
        return 1
    if not _confirm(gate):
        return 0

    field["required"] = True
    save(ct, f"-> wrote and re-activated {gate['contentType']}")
    return 1


def drop_unique(gate_id):
    """A gated step. Separate on purpose — see `gated` in archive-schema.json.

    Takes the gate by id rather than hardcoding one, because there are now two
    and they are the same operation on different fields: remove a space-wide
    `unique` that stands in for an invariant Contentful cannot express, once the
    composite assertion replacing it exists elsewhere. Duplicating this function
    per gate would duplicate the confirmation prompt, which is the part that
    must not drift."""
    schema = json.loads(SCHEMA.read_text())
    gate_preview = next(g for g in schema["gated"] if g["id"] == gate_id)
    print(f"\n{gate_preview['contentType']}.{gate_preview['field']} — removing `unique`")
    gate = _gate(gate_id)

    ct = http("GET", f"/content_types/{gate['contentType']}")
    field = next((f for f in ct["fields"] if f["id"] == gate["field"]), None)
    if field is None:
        sys.exit(f"  {gate['contentType']}.{gate['field']} does not exist")

    before = field.get("validations", [])
    after = [v for v in before if "unique" not in v]
    if len(after) == len(before):
        print("  = no `unique` validation to remove; nothing to do")
        return 0

    print(f"  - unique       removed ({len(before)} validation(s) -> {len(after)})")
    if DRY:
        return 1
    if not _confirm(gate):
        return 0

    field["validations"] = after
    save(ct, f"-> wrote and re-activated {gate['contentType']}")
    return 1


def delete_field(gate_id):
    """Delete a field outright. TWO phases, and the order is Contentful's.

    `omitted: true` activated FIRST — which hides the field from the Delivery API
    while leaving the data in place — and only then is `deleted: true` accepted.
    Each phase is its own PUT plus activate, so this is four calls and it can
    strand in three places.

    THE STRAND HERE IS WORSE THAN add_fields(). An omitted field reads back as
    PRESENT from the management API, because the CMA returns the draft. So a
    re-run after a failed activate would find `omitted` already true, skip phase
    1, and send `deleted` against an omission the CDA has never seen — which
    Contentful refuses. Hence the activation check before either phase, which is
    the same guarantee add_fields() gives by re-activating a stranded type.

    A MISSING FIELD IS SUCCESS, not an error, which is where this differs from
    every other gated step. The others exit when their field is absent because
    for them absence means the wrong space or a typo; here absence is the goal,
    so a second run reports nothing to do and returns 0."""
    schema = json.loads(SCHEMA.read_text())
    gate_preview = next(g for g in schema["gated"] if g["id"] == gate_id)
    print(f"\n{gate_preview['contentType']}.{gate_preview['field']} — deleting the field")
    gate = _gate(gate_id, enforced=True)

    cid, fid = gate["contentType"], gate["field"]
    ct = http("GET", f"/content_types/{cid}")
    if not any(f["id"] == fid for f in ct["fields"]):
        print(f"  = {cid}.{fid} does not exist; nothing to do")
        return 0

    # The gate, checked rather than promised.
    stranded = unmigrated(cid, fid, gate["replacedBy"])
    print(f"  {len(stranded)} {cid}(s) hold a {fid} and no {gate['replacedBy']}")
    if stranded:
        for entry_id, title in stranded[:10]:
            print(f"    {entry_id:44s} {title[:44]}")
        if len(stranded) > 10:
            print(f"    … and {len(stranded) - 10} more")
        sys.exit(
            f"  REFUSING to delete {cid}.{fid}: it is still the only record of "
            f"{len(stranded)} {cid}(s)' {fid}.\n"
            f"  Run the migration first — {gate['blockedBy']}"
        )

    if needs_activation(ct):
        # A previous run wrote a phase and failed before activating it. Left
        # alone, `omitted` reads true from the draft while the CDA still serves
        # the field, and phase 2 would be refused.
        print("  ! this type has unactivated changes — activating before continuing")
        if not DRY:
            activate(cid, ct["sys"]["version"])
            ct = http("GET", f"/content_types/{cid}")

    field = next(f for f in ct["fields"] if f["id"] == fid)
    omitted = field.get("omitted", False)
    print(f"  {'=' if omitted else '-'} omitted       "
          f"{'already true, phase 1 is done' if omitted else 'phase 1 — hide it from the Delivery API'}")
    print(f"  - deleted       phase 2 — remove it from {cid}")

    if DRY:
        return 1
    if not _confirm(gate, f"  Delete {cid}.{fid}? It cannot be re-derived. [y/N] "):
        return 0

    if not omitted:
        field["omitted"] = True
        save(ct, f"-> phase 1: omitted {cid}.{fid} and re-activated {cid}")
        # Re-read: save() bumped the version twice and the local copy is stale.
        ct = http("GET", f"/content_types/{cid}")
        field = next(f for f in ct["fields"] if f["id"] == fid)

    field["deleted"] = True
    save(ct, f"-> phase 2: deleted {cid}.{fid} and re-activated {cid}")
    return 1


# ------------------------------------------------------------------ main


def main():
    if DRY:
        print(f"DRY RUN — {SPACE}/{ENV} — nothing will be written")
    else:
        print(f"WRITING to {SPACE}/{ENV}")

    gates = {
        "--drop-work-slug-unique": (drop_unique, "drop-work-slug-unique"),
        "--drop-season-number-unique": (drop_unique, "drop-season-number-unique"),
        "--require-work-slug": (require_field, "require-work-slug"),
        "--require-composer-slug": (require_field, "require-composer-slug"),
        "--delete-work-genre": (delete_field, "delete-work-genre"),
    }
    asked = [flag for flag in gates if flag in ARGS]

    if len(asked) > 1:
        sys.exit(
            f"run one gated step at a time; they are separate decisions "
            f"({', '.join(asked)})"
        )

    if asked:
        # A gated step runs alone. Bundling one with the additions would make a
        # single command satisfy and violate ADR-0008's ordering at once.
        run, gate_id = gates[asked[0]]
        changed, drift = run(gate_id), 0
    else:
        changed, drift = add_fields()

    print(f"\n{changed} change(s) {'pending' if DRY else 'applied'}"
          f" · {http.calls} API call(s)")
    if DRY and changed:
        print("Re-run without --dry-run to apply.")

    if drift:
        # Non-zero, because drift is invisible in the summary line otherwise: an
        # operator reading "0 change(s) applied" would conclude the space matches
        # the spec when a field has been reshaped by hand underneath it.
        print(f"\n{drift} field(s) differ from the spec and were NOT modified.")
        print("Reconcile them in the Contentful web app, or update archive-schema.json.")
        sys.exit(1)


if __name__ == "__main__":
    main()
