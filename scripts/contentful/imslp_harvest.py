#!/usr/bin/env python3
"""Harvest period and form facts from IMSLP, per ADR-0007.

    python3 scripts/contentful/imslp_harvest.py            # harvest, cached
    python3 scripts/contentful/imslp_harvest.py --refresh  # ignore the cache

AWK-37. Writes `imslp-harvest.json` beside itself: the DERIVED half of the seed
pass. `period-and-forms.json` holds the DECIDED half, and `seed_period_and_forms.py`
applies both. Three artifacts because they have three different review costs --
this one is regenerable and disposable, the decisions are not, and the applier
is code.

IMSLP IS NEVER CONSULTED AT BUILD TIME (ADR-0007). This script is the only thing
in the repository that talks to it, it runs by hand, and its output is committed
so that a reviewer reads a diff rather than trusting a network call.

Four stages, each cached under `.imslp-cache/`:

  1. INDEX -- `API.ISCR.php?type=1` enumerates every composer page (55,461 at
     time of writing, against ADR-0007's 55,263). One request per 1,000.
  2. COMPOSERS -- match the archive's `sortName` against that index, then read
     `People from the X era` off each matched page.
  3. MEMBERS -- enumerate each matched composer's work pages, which is what makes
     work matching tractable: a title is matched against ~100 candidates by the
     same person rather than against all of IMSLP.
  4. WORKS -- read `X style` and the whitelisted form categories off each matched
     work page.

MATCHING IS DELIBERATELY CONSERVATIVE, and the reason is measured. Only an EXACT
match of the ASCII-folded name is accepted automatically. Every looser rule tried
produced confident nonsense:

  * surname-only -- `Gustavson, Mark` -> `Gustavson, Eva`, `Brant, Henry` ->
    `Brant, Per`, `Marquez, Arturo` -> `Márquez, Antonio`. All real people, none
    of them the right one.
  * surname plus first initial -- gets `Prokofiev, Sergei` -> `Sergey` and
    `Rimsky-Korsakov, Nikolai` -> `Nikolay` right, and `Thompson, Randall` ->
    `Thompson, Ray` wrong. A rule that is right four times in five is worse than
    no rule, because nothing downstream can tell which five.

So everything a fold cannot settle goes to `composerAliases` in
`period-and-forms.json` and is decided by hand. `unmatched` in the output is the
work list for that, not a failure.

THE DIACRITIC PAIR IS THE ONE LOOSE MATCH THAT IS SAFE, and it is the whole of
job 3. IMSLP holds both spellings as separate pages -- `Bartok, Bela` AND
`Bartók, Béla`, `Dvorak, Antonin` AND `Dvořák, Antonín`, `Faure, Gabriel` AND
`Fauré, Gabriel`. Identical folded key means same person BY CONSTRUCTION, so
preferring the accented page is safe, and it is also where the canonical spelling
comes from. Probing the folded title instead -- which is what "the match returns
canonical spellings for free" suggests -- does NOT work: `Category:Dvorak, Antonin`
404s, `Category:Bartok, Bela` resolves to a page carrying no era at all, and
`Category:Faure, Gabriel` resolves and returns `Romantic`, which looks exactly
like success and is unverifiable.

SCOPE IS ADR-0006'S, computed live rather than read from a count. A work is in
scope when some concert with `attended` true carries a program item pointing at
it that is not in that concert's `satOut`; a composer is in scope when some
in-scope work names them. The ticket's 322/147 are stale -- AWK-59's LIYO
transcription moved them to 338/153 -- so a hardcoded number would be wrong
again by the time this runs.

Reads the Delivery API, and writes nothing anywhere but its own cache and output.
Credentials are the three build variables in `.env`, NOT the CMA token its
sibling scripts use -- this script cannot mutate the space even by accident.
"""
import gzip
import json
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
CACHE = ROOT / ".imslp-cache"
OUT = HERE / "imslp-harvest.json"
DECL = HERE / "period-and-forms.json"

# A real contact address, because IMSLP is a volunteer wiki and an anonymous
# script pulling 13,000 pages is the kind of thing that earns a block.
UA = "awkale.me-archive-seed/1.0 (+https://awkale.me; akale@dv01.co)"
API = "https://imslp.org/api.php"
ISCR = (
    "https://imslp.org/imslpscripts/API.ISCR.php"
    "?account=worklist/disclaimer=accepted/sort=id/type=1/start={start}/retformat=json"
)

ERA_CATEGORY = re.compile(r"^People from the (.+) era$")
STYLE_CATEGORY = re.compile(r"^(.+) style$")

FLAGS = {"--refresh"}


def _parse_argv(argv):
    """Reject anything unrecognized, like every sibling script does.

    A typo'd flag that is silently ignored turns a `--refresh` into a run that
    quietly reuses a stale cache and reports it as fresh.
    """
    unknown = [a for a in argv if a not in FLAGS]
    if unknown:
        sys.exit(f"unrecognized argument(s): {' '.join(unknown)}\nknown flags: {' '.join(sorted(FLAGS))}")
    return {"refresh": "--refresh" in argv}


# --------------------------------------------------------------------------
# Name folding
# --------------------------------------------------------------------------

# Letters NFKD does not decompose, because the diacritic is part of the glyph
# rather than a combining mark over a base letter. Without these, `Dvořák`
# folds correctly but `Szymanowski`-class names with a slashed O or L do not,
# and the fold silently stops being a fold.
_UNDECOMPOSED = {
    "ø": "o", "Ø": "O", "ł": "l", "Ł": "L", "đ": "d", "Đ": "D",
    "ð": "d", "Ð": "D", "þ": "th", "Þ": "Th", "ı": "i",
    "æ": "ae", "Æ": "Ae", "œ": "oe", "Œ": "Oe", "ß": "ss",
}


def fold(text):
    """Strip diacritics to ASCII, preserving everything else."""
    for src, dst in _UNDECOMPOSED.items():
        text = text.replace(src, dst)
    text = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in text if not unicodedata.combining(ch))


def name_key(name):
    """The comparison key for a person: folded, lowercased, alphanumerics only.

    Punctuation and spacing are dropped so `Rimsky-Korsakov` and `Rimsky Korsakov`
    agree, and so `Gottschalk, L.M.` and `Gottschalk, L. M.` do.
    """
    return re.sub(r"[^a-z0-9]", "", fold(name).lower())


def is_ascii(text):
    return all(ord(ch) < 128 for ch in text)


# --------------------------------------------------------------------------
# HTTP
# --------------------------------------------------------------------------


def _get(url, tries=4):
    """GET with backoff. IMSLP is a volunteer wiki and rate-limits by mood."""
    last = None
    for attempt in range(tries):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "gzip"})
            with urllib.request.urlopen(request, timeout=60) as response:
                body = response.read()
                if response.headers.get("Content-Encoding") == "gzip":
                    body = gzip.decompress(body)
                return json.loads(body)
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as err:
            last = err
            if attempt == tries - 1:
                break
            time.sleep(1.5 * (attempt + 1))
    raise SystemExit(f"IMSLP request failed after {tries} tries: {url}\n  {last}")


def api(**params):
    params.setdefault("action", "query")
    params.setdefault("format", "json")
    return _get(f"{API}?{urllib.parse.urlencode(params)}")


def _continue_token(payload, module, key):
    """IMSLP runs a MediaWiki old enough to answer `query-continue`.

    The modern `continue` key is absent, so a loop written against current
    MediaWiki docs stops at the first page and reports a complete result. That
    is not hypothetical -- it silently capped Bach at 500 of 1,431 work pages,
    Mozart at 500 of 754 and Schubert at 500 of 1,023, and the truncation is
    invisible because a short list looks exactly like a small composer.
    """
    legacy = payload.get("query-continue", {}).get(module, {})
    if key in legacy:
        return legacy[key]
    return payload.get("continue", {}).get(key)


# --------------------------------------------------------------------------
# Cache
# --------------------------------------------------------------------------


def cached(name, refresh, build):
    CACHE.mkdir(exist_ok=True)
    path = CACHE / name
    if path.exists() and not refresh:
        return json.loads(path.read_text())
    value = build()
    path.write_text(json.dumps(value, ensure_ascii=False))
    return value


# --------------------------------------------------------------------------
# Stage 1 -- the composer index
# --------------------------------------------------------------------------


def fetch_composer_index():
    """Every IMSLP composer page title, from the ISCR enumeration."""
    titles = []
    start = 0
    while True:
        payload = _get(ISCR.format(start=start))
        rows = [value for key, value in payload.items() if key.isdigit()]
        titles += [row["id"] for row in rows if row.get("id", "").startswith("Category:")]
        sys.stderr.write(f"\r  index: {len(titles)}")
        if not rows or not payload.get("metadata", {}).get("moreresultsavailable"):
            break
        start += 1000
        time.sleep(0.15)
    sys.stderr.write("\n")
    return titles


# --------------------------------------------------------------------------
# Contentful, read-only
# --------------------------------------------------------------------------


def read_env():
    """The three build variables, from the environment or `.env`."""
    values = {}
    env_file = ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                values[key.strip()] = value.strip()
    values.update({k: v for k, v in os.environ.items() if k.startswith("CONTENTFUL_")})
    missing = [k for k in ("CONTENTFUL_SPACE_ID", "CONTENTFUL_ENVIRONMENT", "CONTENTFUL_DELIVERY_TOKEN") if not values.get(k)]
    if missing:
        sys.exit(f"missing environment variable(s): {', '.join(missing)}\nsee .env.example")
    return values


def fetch_archive(env):
    """Every entry of the four types scope depends on."""
    base = f"https://cdn.contentful.com/spaces/{env['CONTENTFUL_SPACE_ID']}/environments/{env['CONTENTFUL_ENVIRONMENT']}"
    archive = {}
    for content_type in ("composer", "work", "concert", "programItem"):
        items = []
        while True:
            query = urllib.parse.urlencode(
                {"content_type": content_type, "limit": 1000, "skip": len(items), "include": 0}
            )
            request = urllib.request.Request(
                f"{base}/entries?{query}",
                headers={"Authorization": f"Bearer {env['CONTENTFUL_DELIVERY_TOKEN']}"},
            )
            with urllib.request.urlopen(request, timeout=60) as response:
                payload = json.loads(response.read())
            items += payload["items"]
            if len(items) >= payload["total"] or not payload["items"]:
                break
        archive[content_type] = items
    return archive


def link_id(link):
    return (link or {}).get("sys", {}).get("id")


def in_scope(archive):
    """ADR-0006's rules, quantified over PAIRS rather than works.

    Of the in-scope works most were played once but 54 were played twice or
    three times, so sitting one performance out must not erase a work played at
    another concert. The rule takes the disjunction over occasions, exactly as
    `app/lib/archive.ts` does -- this function and that sweep must agree, or the
    seed writes fields onto works that have no page.
    """
    works = {w["sys"]["id"]: w for w in archive["work"]}
    items = {i["sys"]["id"]: i for i in archive["programItem"]}
    work_ids = set()
    for concert in archive["concert"]:
        fields = concert["fields"]
        if fields.get("attended") is not True:
            continue
        sat_out = {link_id(entry) for entry in fields.get("satOut", [])}
        for link in fields.get("program", []):
            item_id = link_id(link)
            if item_id in sat_out or item_id not in items:
                continue
            work_id = link_id(items[item_id]["fields"].get("work"))
            if work_id in works:
                work_ids.add(work_id)
    composer_ids = {link_id(works[w]["fields"].get("composer")) for w in work_ids}
    composer_ids.discard(None)
    return sorted(work_ids), sorted(composer_ids)


# --------------------------------------------------------------------------
# Stage 2 -- composers
# --------------------------------------------------------------------------


def match_composers(archive, composer_ids, index, aliases):
    """Fold-match the archive's composers onto IMSLP composer pages.

    Returns (resolved, unmatched). `resolved` maps sortName -> IMSLP page name;
    `unmatched` is the hand-curation queue.
    """
    by_key = defaultdict(list)
    for title in index:
        by_key[name_key(title[len("Category:"):])].append(title[len("Category:"):])

    composers = {c["sys"]["id"]: c for c in archive["composer"]}
    resolved, unmatched = {}, []
    for composer_id in composer_ids:
        sort_name = composers[composer_id]["fields"].get("sortName", "")
        if sort_name in aliases:
            # A hand decision, including an explicit null for "not in IMSLP".
            if aliases[sort_name]:
                resolved[sort_name] = aliases[sort_name]
            continue
        candidates = by_key.get(name_key(sort_name), [])
        if len(candidates) == 1:
            resolved[sort_name] = candidates[0]
            continue
        # Same folded key, several spellings: the diacritic pair. Same person by
        # construction, so prefer the accented page -- that IS the canonical
        # spelling, and job 3 is nothing more than reading it off.
        accented = [c for c in candidates if not is_ascii(c)]
        if len(candidates) > 1 and len(accented) == 1:
            resolved[sort_name] = accented[0]
            continue
        unmatched.append({"sortName": sort_name, "candidates": candidates})
    return resolved, unmatched


def fetch_eras(page_names):
    """Read `People from the X era` off each matched composer page."""
    eras = {}
    titles = [f"Category:{name}" for name in page_names]
    for offset in range(0, len(titles), 40):
        payload = api(prop="categories", cllimit=500, titles="|".join(titles[offset : offset + 40]))
        for page in payload.get("query", {}).get("pages", {}).values():
            found = []
            for category in page.get("categories", []):
                match = ERA_CATEGORY.match(category["title"][len("Category:"):])
                if match:
                    found.append(match.group(1))
            eras[page["title"][len("Category:"):]] = {
                "eras": sorted(found),
                "missing": "missing" in page,
            }
        sys.stderr.write(f"\r  eras: {len(eras)}/{len(titles)}")
        time.sleep(0.2)
    sys.stderr.write("\n")
    return eras


# --------------------------------------------------------------------------
# Stage 3 -- a composer's work pages
# --------------------------------------------------------------------------


def fetch_members(page_name):
    """Every mainspace work page filed under a composer's category."""
    titles, token = [], None
    while True:
        query = dict(list="categorymembers", cmtitle=f"Category:{page_name}", cmnamespace=0, cmlimit=500)
        if token:
            query["cmcontinue"] = token
        payload = api(**query)
        titles += [m["title"] for m in payload.get("query", {}).get("categorymembers", [])]
        token = _continue_token(payload, "categorymembers", "cmcontinue")
        if not token:
            break
    return titles


# --------------------------------------------------------------------------
# Stage 4 -- work titles and categories
# --------------------------------------------------------------------------

# Catalogue sigla stripped before comparing titles. `Op.` and friends are written
# a dozen ways across the two sources -- `Op. 35`, `Op.35`, `Opus 39` -- and the
# number is never the thing being matched.
_CATALOGUE = re.compile(
    r",?\s*\b(op|opus|bwv|kv?|b|d|m|hob|woo|s|trv|jw|sz|bb|rv|hwv)\.?\s*[\divx]+[a-z]?(\s*no\.?\s*\d+)?\b",
    re.IGNORECASE,
)
_KEY = re.compile(r"\bin\s+[a-g](\s*(flat|sharp|-flat|-sharp))?\s*(major|minor)\b", re.IGNORECASE)
_ARTICLE = re.compile(r"^(the|a|an|le|la|les|el|il|der|die|das|l')\s*", re.IGNORECASE)
_PARENTHETICAL = re.compile(r"\s*\([^)]*\)\s*$")


def title_key(title):
    """The comparison key for a work title.

    Lossy on purpose, and known to be lossy: ADR-0007 records that the archive
    says `The Moldau` where IMSLP files `Má vlast`, and no amount of folding
    bridges a translation. What this DOES bridge is spelling and catalogue noise
    -- `Scheherazade` to `Shéhérazade`, `Opus 39` to `Op.39`.
    """
    title = _PARENTHETICAL.sub("", fold(title).lower())
    title = _CATALOGUE.sub("", title)
    title = _KEY.sub("", title)
    title = _ARTICLE.sub("", title)
    title = re.sub(r"\bno\.?\s*(\d+)", r"no\1", title)
    return re.sub(r"[^a-z0-9]", "", title)


def fetch_work_categories(titles):
    categories = {}
    for offset in range(0, len(titles), 20):
        payload = api(prop="categories", cllimit=500, titles="|".join(titles[offset : offset + 20]))
        for page in payload.get("query", {}).get("pages", {}).values():
            categories[page["title"]] = [c["title"][len("Category:"):] for c in page.get("categories", [])]
        sys.stderr.write(f"\r  work categories: {len(categories)}/{len(titles)}")
        time.sleep(0.2)
    sys.stderr.write("\n")
    return categories


# --------------------------------------------------------------------------


def main(argv):
    options = _parse_argv(argv)
    refresh = options["refresh"]

    declaration = json.loads(DECL.read_text())
    aliases = {k: v for k, v in declaration["composerAliases"].items() if k != "note"}
    whitelist = {k: v for k, v in declaration["formCategories"].items() if k != "note"}

    print("reading the archive through the Delivery API…")
    env = read_env()
    archive = cached("archive.json", refresh, lambda: fetch_archive(env))
    work_ids, composer_ids = in_scope(archive)
    print(f"  in scope: {len(work_ids)} works, {len(composer_ids)} composers")

    print("stage 1 — the IMSLP composer index")
    index = cached("composer-index.json", refresh, fetch_composer_index)
    print(f"  {len(index)} composer pages")

    print("stage 2 — composers")
    resolved, unmatched = match_composers(archive, composer_ids, index, aliases)
    eras = cached("eras.json", refresh, lambda: fetch_eras(sorted(resolved.values())))

    print("stage 3 — work pages per composer")
    members = cached(
        "members.json",
        refresh,
        lambda: {
            name: fetch_members(name)
            for name in sorted(set(resolved.values()))
            if not eras.get(name, {}).get("missing")
        },
    )
    print(f"  {sum(len(v) for v in members.values())} work pages across {len(members)} composers")

    print("stage 4 — works")
    composers = {c["sys"]["id"]: c for c in archive["composer"]}
    works = {w["sys"]["id"]: w for w in archive["work"]}
    by_title = {}
    for name, titles in members.items():
        table = defaultdict(list)
        for title in titles:
            table[title_key(title)].append(title)
        by_title[name] = table

    work_matches = {}
    for work_id in work_ids:
        fields = works[work_id]["fields"]
        composer = composers.get(link_id(fields.get("composer")), {}).get("fields", {})
        page = resolved.get(composer.get("sortName"))
        candidates = by_title.get(page, {}).get(title_key(fields["title"]), []) if page else []
        if len(candidates) == 1:
            work_matches[work_id] = candidates[0]

    work_categories = cached(
        "work-categories.json", refresh, lambda: fetch_work_categories(sorted(set(work_matches.values())))
    )

    # ---- assemble ----------------------------------------------------------
    composer_rows = {}
    for composer_id in composer_ids:
        sort_name = composers[composer_id]["fields"].get("sortName", "")
        page = resolved.get(sort_name)
        record = eras.get(page, {}) if page else {}
        composer_rows[composer_id] = {
            "sortName": sort_name,
            "imslpPage": page,
            "eras": record.get("eras", []),
            "canonicalName": page if page and not is_ascii(page) else None,
        }

    work_rows = {}
    for work_id in work_ids:
        page = work_matches.get(work_id)
        categories = work_categories.get(page, []) if page else []
        styles = sorted({m.group(1) for m in (STYLE_CATEGORY.match(c) for c in categories) if m})
        forms = sorted({whitelist[c] for c in categories if whitelist.get(c)})
        work_rows[work_id] = {
            "title": works[work_id]["fields"]["title"],
            "imslpPage": page,
            "styles": styles,
            "forms": forms,
        }

    single = sum(1 for r in composer_rows.values() if len(r["eras"]) == 1)
    multi = sorted(r["sortName"] for r in composer_rows.values() if len(r["eras"]) > 1)
    harvested = sum(1 for r in work_rows.values() if r["forms"])

    OUT.write_text(
        json.dumps(
            {
                "note": [
                    "GENERATED by imslp_harvest.py -- do not hand-edit.",
                    "",
                    "The DERIVED half of AWK-37. Corrections belong in period-and-forms.json,",
                    "which the applier layers over this and which a re-harvest cannot clobber.",
                    "",
                    "`eras` with two entries is NOT a match failure -- IMSLP files the",
                    "transitional composers under both, and `composer.period` is a single",
                    "Symbol, so those are settled by hand in `composerPeriods`.",
                ],
                "harvestedAt": time.strftime("%Y-%m-%d"),
                "counts": {
                    "worksInScope": len(work_ids),
                    "composersInScope": len(composer_ids),
                    "composersMatched": len(resolved),
                    "composersWithOneEra": single,
                    "composersWithSeveralEras": multi,
                    "composersUnmatched": len(unmatched),
                    "worksMatched": len(work_matches),
                    "worksWithHarvestedForms": harvested,
                },
                "composers": dict(sorted(composer_rows.items())),
                "works": dict(sorted(work_rows.items())),
                "unmatched": sorted(unmatched, key=lambda r: r["sortName"]),
            },
            ensure_ascii=False,
            indent=1,
        )
        + "\n"
    )

    print(f"\nwrote {OUT.relative_to(ROOT)}")
    print(f"  composers matched            {len(resolved)}/{len(composer_ids)}")
    print(f"  … with exactly one era       {single}")
    print(f"  … with several eras          {len(multi)}  {', '.join(multi)}")
    print(f"  works matched                {len(work_matches)}/{len(work_ids)}")
    print(f"  … yielding a form            {harvested}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
