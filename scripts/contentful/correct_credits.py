#!/usr/bin/env python3
"""Apply credit-corrections.json to Contentful. Stdlib only.

    python3 correct_credits.py            # dry run
    python3 correct_credits.py --apply    # write and republish

AWK-88. Two programItem.credits strings name nobody: `['unknown']` on
pi-s1-unknown-1, a placeholder, and `['with Puppets in Japanese Bunraku style']`
on pi-19750429-2, a staging note. The first is cleared; the second moves to the
item's `note`. parse_archive.py now routes both the same way, so a re-import
agrees with this run -- credit-corrections.test.ts asserts that.

WHY NOT transcribe_programs.py. It merges and never clobbers: it writes a field
only where the live one is empty, by design. This correction is the opposite --
it EMPTIES a populated field -- so it needs its own, narrower applier.

DRY RUN IS THE DEFAULT, like seed_participation.py, backfill_slugs.py,
merge_composers.py, backfill_seasons.py, seed_period_and_forms.py and
transcribe_programs.py. Unrecognized arguments are rejected, so `--aply` fails
rather than reading as a dry run that reports success.

Safety properties, in the order they matter:

  * Pinned. Each entry must hold exactly its declared `expect` values, or the
    run aborts before writing anything. A field the space has moved off the
    declaration is someone else's decision, and this script will not overrule
    it. An entry that already holds its `set` values is reported as `already`
    and left alone, so a re-run is a no-op.

  * Published and clean, or not at all. Both entries are published with no
    draft edits as of 2026-10-04. This run republishes what it writes, and
    Contentful publishes an entry, not a field -- so an entry carrying someone's
    unpublished editing would push it live. Pre-flight refuses one instead.
    That also catches a half-finished earlier run: an entry already holding its
    `set` values as an unpublished draft is reported, not silently published.

  * Nobody linked. The ticket's whole case is a Credit with no soloist, so an
    entry whose live `soloists` is no longer empty -- someone linked a person in
    the web app -- is refused rather than stripped of what may now be a real
    Credit.

  * Only the fields this correction is about. A declaration naming anything but
    `credits` or `note` is refused, because a misspelt field would make the
    write remove nothing and the run report success.

  * All or nothing at pre-flight. Every entry is checked before the first write.
"""
import json, os, sys, time, urllib.request, urllib.error
from pathlib import Path

SPACE = os.environ.get("CONTENTFUL_SPACE_ID", "3iiyvj5u5c9h")
ENV = os.environ.get("CONTENTFUL_ENVIRONMENT_ID", "master")
LOCALE = os.environ.get("CONTENTFUL_LOCALE", "en-US")
BASE = f"https://api.contentful.com/spaces/{SPACE}/environments/{ENV}"
DECLARATION = Path(__file__).parent / "credit-corrections.json"

# The only fields a declaration may name. See the docstring.
FIELDS = {"credits", "note"}

FLAGS = {"--apply"}
TAKES_VALUE = {"--token-file"}


def _parse_argv(argv):
    """Reject anything unrecognized, as transcribe_programs.py does."""
    options = {"apply": False, "token_file": None}
    index = 0
    while index < len(argv):
        argument = argv[index]
        if argument in TAKES_VALUE:
            if index + 1 >= len(argv):
                sys.exit(f"{argument} needs a value")
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


def read_token(token_file):
    """Same three sources as import_to_contentful.py, in the same order."""
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

def http(method, path, body=None, headers=None, ok404=False):
    if not TOKEN:
        sys.exit("no CMA token: set CONTENTFUL_CMA_TOKEN, pass --token-file, "
                 "or put it in ~/.contentful-cma-token")
    data = json.dumps(body).encode() if body is not None else None
    h = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/vnd.contentful.management.v1+json"}
    h.update(headers or {})
    req = urllib.request.Request(BASE + path, data=data, headers=h, method=method)
    for attempt in range(5):
        try:
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


def live_value(entry, name):
    v = (entry.get("fields") or {}).get(name)
    return v.get(LOCALE) if isinstance(v, dict) else v


def is_empty(v):
    return v is None or v == "" or v == []


def matches(entry, wanted):
    """True when every declared field holds its declared value. Null and an
    absent field agree: Contentful stores no empty array, so a cleared
    `credits` reads back as absent rather than as `[]`."""
    for name, value in wanted.items():
        current = live_value(entry, name)
        if not (current == value or (is_empty(current) and is_empty(value))):
            return False
    return True


def has_unpublished_changes(sys_block):
    """A published entry sits at `publishedVersion + 1`, because the publish is
    itself a save; anything above that is a draft edit. See AWK-83's note in
    transcribe_programs.py."""
    published = sys_block.get("publishedVersion")
    return published is not None and sys_block["version"] > published + 1


def shown(entry, names):
    return ", ".join(f"{n}={json.dumps(live_value(entry, n))}" for n in names)


# ------------------------------------------------------------------ main

def preflight(decl):
    """-> ([(id, live_entry, set_fields)] to write, [problem lines]).

    Reads every entry before any write, so a failure anywhere writes nothing."""
    todo, already, bad = [], [], []
    for eid, c in decl["corrections"].items():
        pinned, target = c["expect"], c["set"]
        if set(pinned) != set(target):
            bad.append(f"  {eid}: `expect` and `set` must name the same fields")
            continue
        if not set(target) <= FIELDS:
            bad.append(f"  {eid}: names {sorted(set(target) - FIELDS)}; only {sorted(FIELDS)} are allowed")
            continue
        live = http("GET", f"/entries/{eid}", ok404=True)
        if live is None:
            bad.append(f"  {eid}: not found")
            continue
        s = live["sys"]
        if s.get("archivedAt"):
            bad.append(f"  {eid}: archived")
            continue
        if s["contentType"]["sys"]["id"] != decl["contentType"]:
            bad.append(f"  {eid}: is a {s['contentType']['sys']['id']}, not a {decl['contentType']}")
            continue
        if not is_empty(live_value(live, "soloists")):
            bad.append(f"  {eid}: now links a soloist, so its Credit may be real. Not touching it.")
            continue
        if s.get("publishedVersion") is None:
            bad.append(f"  {eid}: never published; this run republishes, so it will not touch a draft")
            continue
        if has_unpublished_changes(s):
            state = "already holds its `set` values but UNPUBLISHED" if matches(live, target) else "holds unpublished edits"
            bad.append(f"  {eid}: {state} (v{s['version']}, published v{s['publishedVersion']})."
                       " Review and publish it in the web app, then re-run.")
            continue
        if matches(live, target):
            already.append(eid)
            print(f"  already   {eid}   {shown(live, target)}")
        elif matches(live, pinned):
            todo.append((eid, live, target))
            print(f"  planned   {eid}\n"
                  f"      live: {shown(live, pinned)}\n"
                  f"      set:  {', '.join(f'{n}={json.dumps(v)}' for n, v in target.items())}")
        else:
            bad.append(f"  {eid}: live holds neither `expect` nor `set` -- {shown(live, pinned)}")
    return todo, already, bad


def write(eid, live, target):
    fields = dict(live["fields"])
    for name, value in target.items():
        if is_empty(value):
            fields.pop(name, None)
        else:
            fields[name] = {LOCALE: value}
    saved = http("PUT", f"/entries/{eid}", {"fields": fields},
                 {"X-Contentful-Version": str(live["sys"]["version"])})
    http("PUT", f"/entries/{eid}/published", None,
         {"X-Contentful-Version": str(saved["sys"]["version"])})


def main():
    decl = json.loads(DECLARATION.read_text())
    print(f"space {SPACE} / env {ENV}")
    print(f"declaration {DECLARATION.name}: {len(decl['corrections'])} {decl['contentType']} entries\n")

    todo, already, bad = preflight(decl)
    if bad:
        print("\n" + "\n".join(bad))
        sys.exit("\npre-flight failed. Nothing written.")

    if not todo:
        print("\nNothing to do: every entry already holds its declared values.")
        return
    if not APPLY:
        print(f"\n--- DRY RUN, nothing written. Re-run with --apply to write and "
              f"republish {len(todo)} entries. ---")
        return

    print("\napplying:")
    for eid, live, target in todo:
        write(eid, live, target)
        print(f"  written and published   {eid}")
    print(f"\n{len(todo)} written, {len(already)} already. "
          "Verify through the Delivery API that neither item carries `credits`.")


if __name__ == "__main__":
    main()
