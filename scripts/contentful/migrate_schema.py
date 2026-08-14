#!/usr/bin/env python3
"""Apply archive-schema.json to the Contentful space. Stdlib only.

    python3 scripts/contentful/migrate_schema.py --dry-run   # report, write nothing
    python3 scripts/contentful/migrate_schema.py             # add the fields
    python3 scripts/contentful/migrate_schema.py --drop-work-slug-unique

AWK-30. Schema only — this writes no entry data, so it is safe to run before the
re-import (AWK-20) and before any seeding pass.

Safety properties:
  * ADDITIVE. A field already present by id is left exactly as it is, never
    reshaped. So this cannot clobber a hand-edit in the Contentful UI, and a
    re-run after a partial failure resumes rather than duplicating.
  * Every field it adds is OPTIONAL, which is what makes adding one to a type
    with published entries safe: no existing entry becomes invalid.
  * Contentful cannot change a field's type in place, so nothing here tries.
    `work.genre` (a Link) is left alone entirely — ADR-0007 retires it, but only
    after the genre -> forms migration in AWK-37.
  * The one destructive change the spec calls for — removing `unique: true` from
    `work.slug` — is behind its own flag and does nothing on a default run. See
    `gated` in archive-schema.json for why the ordering is not negotiable.
  * Read-modify-write against X-Contentful-Version, so a concurrent edit in the
    web app loses the race loudly (409) rather than being silently overwritten.

Credentials are resolved exactly as import_to_contentful.py resolves them:
CONTENTFUL_CMA_TOKEN, else --token-file PATH, else ~/.contentful-cma-token.
That token must never enter CI (ADR-0002).
"""
import json, os, sys, time, urllib.request, urllib.error
from pathlib import Path

SPACE = os.environ.get("CONTENTFUL_SPACE_ID", "3iiyvj5u5c9h")
ENV = os.environ.get("CONTENTFUL_ENVIRONMENT_ID", "master")
BASE = f"https://api.contentful.com/spaces/{SPACE}/environments/{ENV}"
SCHEMA = Path(__file__).parent / "archive-schema.json"

FLAGS = {"--dry-run", "--drop-work-slug-unique", "--yes"}
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
                f"usage: migrate_schema.py [--dry-run] [--drop-work-slug-unique [--yes]]\n"
                f"                         [--token-file PATH]"
            )
        seen.add(arg)
        i += 1
    return seen


ARGS = _parse_argv(sys.argv[1:])
DRY = "--dry-run" in ARGS
DROP_UNIQUE = "--drop-work-slug-unique" in ARGS
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


def drop_work_slug_unique():
    """The gated step. Separate on purpose — see `gated` in archive-schema.json."""
    schema = json.loads(SCHEMA.read_text())
    gate = next(g for g in schema["gated"] if g["id"] == "drop-work-slug-unique")

    print(f"\n{gate['contentType']}.{gate['field']} — removing `unique`")
    # NOT a gate this script can enforce. It cannot see whether AWK-39's
    # assertion is in the build, so `blockedBy` is a note to a human, and running
    # this flag to "check" would remove the constraint. Say so plainly, and make
    # the operator confirm rather than implying the script is guarding anything.
    print(f"  {gate['blockedBy']} must already be landed and green. This script")
    print("  CANNOT verify that — it is your confirmation, not a check.")

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

    if not ASSUME_YES:
        if not sys.stdin.isatty():
            sys.exit("  refusing to run unattended; pass --yes if that is intended")
        answer = input(f"  Is {gate['blockedBy']} landed and green? [y/N] ").strip()
        if answer.lower() not in ("y", "yes"):
            print("  aborted; nothing written")
            return 0

    field["validations"] = after
    save(ct, f"-> wrote and re-activated {gate['contentType']}")
    return 1


# ------------------------------------------------------------------ main


def main():
    if DRY:
        print(f"DRY RUN — {SPACE}/{ENV} — nothing will be written")
    else:
        print(f"WRITING to {SPACE}/{ENV}")

    if DROP_UNIQUE:
        # Gated step runs alone. Bundling it with the additions would make a
        # single command satisfy and violate ADR-0008's ordering at once.
        changed, drift = drop_work_slug_unique(), 0
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
