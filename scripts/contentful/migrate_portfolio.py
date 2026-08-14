#!/usr/bin/env python3
"""Create the portfolio content types from portfolio-schema.json. Stdlib only.

    python3 scripts/contentful/migrate_portfolio.py --dry-run   # report, write nothing
    python3 scripts/contentful/migrate_portfolio.py             # create the types

AWK-31. Schema only — this writes no entry data, so it creates two empty types
and nothing authors anything into them until AWK-43.

Sibling of migrate_schema.py (AWK-30), and deliberately a separate script: that
one APPENDS optional fields to four types holding 1,155 entries between them
(concert 249, composer 244, conductor 37, work 625 — counted 2026-08-14), this
one CREATES two types that have never existed. The safety properties that make
appending safe are not the ones that make creating safe, and conflating them
would mean one script whose guarantees depend on which branch it took.

Safety properties:
  * CREATION IS THE COMMON CASE, and it is checked first. A type is created only
    after a GET proves it absent, and the creating PUT carries no version header
    so a concurrent create loses the race loudly (409) rather than clobbering.
  * ORDER IS PRESERVED FROM THE FILE, never sorted. `imageGroup` must exist
    before `project`, because `project.body` restricts embedded blocks to
    `imageGroup` by id and Contentful rejects a linkContentType naming a type
    that does not exist.
  * ADDITIVE on a type that already exists. A field already present by id is left
    exactly as it is, never reshaped, so a re-run after a partial failure resumes
    rather than duplicating, and a hand-edit in the web app is reported as drift.
  * REQUIRED FIELDS ARE REFUSED ON A POPULATED TYPE. Unlike AWK-30, this schema
    is mostly required fields — safe on a type with no entries, and a way to
    invalidate every entry at once on a type that has them. So an append that
    would add a required field counts the type's entries first and refuses.
  * Contentful cannot change a field's type in place, so nothing here tries.
  * Read-modify-write against X-Contentful-Version on the append path, so a
    concurrent edit in the web app 409s rather than being silently overwritten.

Credentials are resolved exactly as import_to_contentful.py and
migrate_schema.py resolve them: CONTENTFUL_CMA_TOKEN, else --token-file PATH,
else ~/.contentful-cma-token. That token must never enter CI (ADR-0002).
"""
import json, os, sys, time, urllib.request, urllib.error
from pathlib import Path

SPACE = os.environ.get("CONTENTFUL_SPACE_ID", "3iiyvj5u5c9h")
ENV = os.environ.get("CONTENTFUL_ENVIRONMENT_ID", "master")
BASE = f"https://api.contentful.com/spaces/{SPACE}/environments/{ENV}"
SCHEMA = Path(__file__).parent / "portfolio-schema.json"

FLAGS = {"--dry-run"}
TAKES_VALUE = {"--token-file"}


def _parse_argv(argv):
    """Reject anything unrecognized, because the default action WRITES.

    Testing membership without validating the rest means `--dryrun`, `--dry_run`
    or `-n` all read as "not a dry run" and create two content types in the
    production space. A typo must not be the difference between a report and a
    migration. Same reasoning as migrate_schema.py, same failure avoided."""
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
                f"usage: migrate_portfolio.py [--dry-run] [--token-file PATH]"
            )
        seen.add(arg)
        i += 1
    return seen


ARGS = _parse_argv(sys.argv[1:])
DRY = "--dry-run" in ARGS


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
    """Same shape as migrate_schema.py's client: rate-limited to ~6 req/s,
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

# ------------------------------------------------------------------ describing


def describe(field):
    """One-line field summary for the report. Same vocabulary as
    migrate_schema.py's, extended for the types this schema introduces —
    RichText, Date, Integer and Asset links, none of which existed in the space
    before these two content types."""
    t = field["type"]
    if t == "Array":
        items = field.get("items", {})
        inner = items.get("linkType") or items.get("type")
        if items.get("type") == "Link":
            inner = f"Link<{items.get('linkType', 'any')}>"
        t = f"Array<{inner}>"
    elif t == "Link":
        t = f"Link<{field.get('linkType', 'any')}>"
    extra = []
    if field.get("required"):
        extra.append("required")
    for v in field.get("validations", []):
        if v.get("unique"):
            extra.append("unique")
        if "in" in v:
            extra.append(f"in[{len(v['in'])}]")
        if "size" in v:
            extra.append(f"size{v['size']}")
        if "regexp" in v:
            extra.append("regexp")
        if "nodes" in v:
            for node, rules in v["nodes"].items():
                targets = [t for r in rules for t in r.get("linkContentType", [])]
                extra.append(f"{node}->{'|'.join(targets) or 'any'}")
        if "enabledNodeTypes" in v:
            extra.append(f"nodeTypes[{len(v['enabledNodeTypes'])}]")
    for v in field.get("items", {}).get("validations", []):
        if "in" in v:
            extra.append(f"in[{len(v['in'])}]")
    return f"{t}{' ' + ', '.join(extra) if extra else ''}"


# ------------------------------------------------------------------ applying


def needs_activation(ct):
    """True when the type holds edits the Delivery API is not serving.

    Writing a type is TWO calls — PUT the type, then PUT /published — and only
    the second makes it visible to anything reading the CDA. If the first lands
    and the second does not (retries exhausted, dropped connection, Ctrl-C) the
    type exists as an unactivated draft, and a naive re-run reads it back, finds
    every field present, and reports "nothing to do" while the CDA still cannot
    see it. That is a silent, permanent half-migration.

    Contentful bumps `version` on the publish itself, so a freshly activated type
    satisfies `version == publishedVersion + 1`. Anything higher means unpublished
    changes; a missing `publishedVersion` means it was never activated at all —
    which is exactly the state a created-but-not-activated type is in."""
    published = ct["sys"].get("publishedVersion")
    return published is None or ct["sys"]["version"] > published + 1


def activate(cid, version):
    """PUT /published — the half that makes a type visible to the CDA."""
    http(
        "PUT",
        f"/content_types/{cid}/published",
        None,
        {"X-Contentful-Version": str(version)},
    )


def entry_count(cid):
    """How many entries the type holds, published or draft.

    Only called on the append path, and only to decide whether adding a required
    field is safe. `limit=0` asks for the count without paging 2,384 entries.

    `limit=0` is load-bearing and was verified against this space on 2026-08-14
    rather than assumed: it returns HTTP 200 with `total` set and `items` empty
    (`work` -> total 625, 0 items). Worth stating because the repo's only other
    entries query, import_to_contentful.py, uses `limit=100` — so a reader has
    reason to doubt that 0 is accepted, and a raise here would abort the run at
    the exact moment this guard is supposed to protect something."""
    result = http("GET", f"/entries?content_type={cid}&limit=0")
    return result.get("total", 0)


def create_type(group):
    """PUT with NO version header, which is how the CMA creates rather than updates.

    The body is built from the declaration rather than read-modify-written,
    because there is nothing to read: this is the type's first version. Sending
    `name`, `description`, `displayField` and `fields` is the whole type."""
    cid = group["id"]
    body = {
        "name": group["name"],
        "displayField": group["displayField"],
        "fields": group["fields"],
    }
    if group.get("description"):
        body["description"] = group["description"]
    created = http("PUT", f"/content_types/{cid}", body)
    activate(cid, created["sys"]["version"])
    print(f"  -> created {cid} with {len(group['fields'])} field(s) and activated it")


def append_fields(ct, add):
    """PUT the modified content type, then re-activate it.

    Both halves matter — a content type edit lands as a new DRAFT version and the
    Delivery API keeps serving the last activated one, so skipping the publish
    leaves the fields invisible to everything reading the CDA.

    The body is the content type MINUS `sys`, rather than a rebuilt set of the
    keys this script happens to know about. PUT replaces the whole type, so an
    allow-list silently drops anything outside it — `metadata`, which carries
    taxonomy concepts and annotations, being the one that exists today."""
    cid = ct["sys"]["id"]
    ct["fields"].extend(add)
    body = {k: v for k, v in ct.items() if k != "sys"}
    updated = http(
        "PUT",
        f"/content_types/{cid}",
        body,
        {"X-Contentful-Version": str(ct["sys"]["version"])},
    )
    activate(cid, updated["sys"]["version"])
    print(f"  -> wrote {len(add)} field(s) and re-activated {cid}")


def _same_shape(live, want):
    """Compare only what this script would have set. Contentful adds keys of its
    own to a stored field, so exact dict equality would report drift on every
    field it has ever touched."""
    return all(live.get(k) == v for k, v in want.items())


def apply_schema():
    schema = json.loads(SCHEMA.read_text())
    created = appended = stranded_fixed = drift = refused = 0

    # File order, never sorted. `project.body` names `imageGroup` in a
    # linkContentType, so imageGroup has to exist by the time project is written.
    for group in schema["createTypes"]:
        cid = group["id"]
        ct = http("GET", f"/content_types/{cid}", ok404=True)

        print(f"\n{cid}")

        if ct is None:
            print(f"  + CREATE type, displayField {group['displayField']!r}")
            for field in group["fields"]:
                print(f"    + {field['id']:<14} {describe(field)}")
            created += 1
            if not DRY:
                create_type(group)
            continue

        # The type exists. Everything below is the resume/reconcile path.
        print("  = type already exists")
        have = {f["id"]: f for f in ct["fields"]}
        add, present, drifted = [], [], []
        for field in group["fields"]:
            live = have.get(field["id"])
            if live is None:
                add.append(field)
            else:
                present.append(field["id"])
                if not _same_shape(live, field):
                    drifted.append(field["id"])

        for fid in present:
            print(f"  = {fid:<14} already present, untouched")
        for fid in drifted:
            print(f"  ! {fid:<14} present but its shape differs from the spec")
        for field in add:
            print(f"  + {field['id']:<14} {describe(field)}")

        drift += len(drifted)

        if group["displayField"] != ct.get("displayField"):
            # Not repaired automatically: changing the display field is a
            # deliberate editorial act, and the live value may be the correct one.
            print(
                f"  ! displayField is {ct.get('displayField')!r},"
                f" the spec says {group['displayField']!r}"
            )
            drift += 1

        required_add = [f for f in add if f.get("required")]
        if required_add:
            # THE GUARD. Adding a required field to a type that holds entries
            # invalidates every one of them at once — they all now fail validation
            # on a field none of them has a value for. Safe on an empty type,
            # which is the only state this schema was designed against.
            total = entry_count(cid)
            if total:
                names = ", ".join(f["id"] for f in required_add)
                print(f"  ! REFUSING {len(required_add)} required field(s): {names}")
                print(f"    {total} entry/entries exist and none has a value for them,")
                print("    so all would become invalid at once. Populate each entry")
                print("    first, or add the field as optional by hand.")
                refused += 1
                # Refuse ONLY the required ones. Dropping the optional fields in the
                # same batch would be collateral, not a safety property — they cannot
                # invalidate anything — and silently skipping them means a re-run
                # never makes progress on the safe half.
                add = [f for f in add if not f.get("required")]
                if add:
                    names = ", ".join(f["id"] for f in add)
                    print(f"    Proceeding with the optional field(s): {names}")
            else:
                print(f"  = 0 entries, so adding {len(required_add)} required field(s) is safe")

        if add:
            appended += len(add)
            if not DRY:
                # append_fields re-activates, so it also clears any stranding.
                append_fields(ct, add)
        elif needs_activation(ct):
            # A previous run wrote the type and failed before activating. It reads
            # back complete, so without this the migration is permanently
            # half-applied and every re-run says "nothing to do".
            #
            # Reachable even after a refusal, deliberately: re-activating is safe,
            # idempotent and unrelated to why the required field was refused. An
            # early `continue` here would leave a stranded type invisible to the
            # CDA because of a completely separate problem.
            print("  ! unactivated changes — the CDA is not serving them")
            stranded_fixed += 1
            if not DRY:
                activate(cid, ct["sys"]["version"])
                print(f"  -> re-activated {cid}")

    return created, appended, stranded_fixed, drift, refused


# ------------------------------------------------------------------ main


def main():
    if DRY:
        print(f"DRY RUN — {SPACE}/{ENV} — nothing will be written")
    else:
        print(f"WRITING to {SPACE}/{ENV}")

    created, appended, stranded, drift, refused = apply_schema()

    changes = created + appended + stranded
    # Verbs gate on DRY. Printing "2 type(s) created" after writing nothing is the
    # same confusion _parse_argv exists to prevent, on the output side: an operator
    # who scrolls past the header to the summary concludes the types exist.
    # migrate_schema.py hedges the same way, for the same reason.
    if DRY:
        print(
            f"\nWOULD create {created} type(s) · append {appended} field(s)"
            f" · re-activate {stranded} · {http.calls} API call(s) so far"
        )
    else:
        print(
            f"\n{created} type(s) created · {appended} field(s) appended"
            f" · {stranded} re-activated · {http.calls} API call(s)"
        )
    if DRY and changes:
        print("Re-run without --dry-run to apply.")

    if drift:
        # Non-zero, because drift is invisible in the summary line otherwise: an
        # operator reading "0 type(s) created" would conclude the space matches the
        # spec when a field has been reshaped by hand underneath it.
        print(f"\n{drift} item(s) differ from the spec and were NOT modified.")
        print("Reconcile them in the Contentful web app, or update portfolio-schema.json.")
    if refused:
        print(f"\n{refused} type(s) skipped to avoid invalidating existing entries.")
    if drift or refused:
        sys.exit(1)


if __name__ == "__main__":
    main()
