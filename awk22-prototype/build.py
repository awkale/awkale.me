#!/usr/bin/env python3
"""
PROTOTYPE BUILDER — AWK-22 "Decide the visual direction"
Emits a single self-contained HTML file: 3 radically different visual directions
over 6 real surfaces, switchable via ?variant= and a floating bottom bar.
Throwaway. Not production code.
"""
import json, re, os, collections, html

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "awk22-visual-direction.html")

# ---------------------------------------------------------------- radix scales
def radix(name):
    """Return {step:int -> hex} from the plain (non-P3) :root block."""
    css = open(os.path.join(HERE, "radix", f"{name}.css")).read()
    block = css.split("@supports")[0]
    return {int(m.group(1)): m.group(2)
            for m in re.finditer(rf'--{name.replace("-dark","")}-(\d+):\s*(#[0-9a-fA-F]{{6}})', block)}

SCALES = {}
for s in ["slate", "sand", "orange", "bronze", "blue"]:
    SCALES[s] = {"light": radix(s), "dark": radix(f"{s}-dark")}

EMBER = json.load(open(os.path.join(HERE, "ember-ramp.json")))
SCALES["ember"] = {"light": {i + 1: h for i, h in enumerate(EMBER["light"])},
                   "dark":  {i + 1: h for i, h in enumerate(EMBER["dark"])}}

def scale_css(var, name, mode):
    return "\n".join(f"    --{var}-{k}: {v};" for k, v in sorted(SCALES[name][mode].items()))

# ---------------------------------------------------------------------- fonts
FONTS = json.load(open(os.path.join(HERE, "fonts", "embedded.json")))
def face_css(fam, css_name):
    out = []
    for f in FONTS.get(fam, []):
        out.append(
            "@font-face{font-family:'%s';font-style:%s;font-weight:100 900;font-display:swap;"
            "src:url(data:font/woff2;base64,%s) format('woff2');}" % (css_name, f["style"], f["b64"]))
    return "\n".join(out)

FONT_FACES = "\n".join([
    face_css("Fraunces", "Fraunces"),
    face_css("Newsreader", "Newsreader"),
    face_css("Inter", "Inter"),
    face_css("IBM Plex Sans", "PlexSans"),
    face_css("JetBrains Mono", "JBMono"),
    face_css("Instrument Serif", "InstrumentSerif"),
])

# ----------------------------------------------------------------- real data
concerts = json.load(open(os.path.join(HERE, "concerts.json")))
played = [c for c in concerts if not c["missed"]]

# ---- arranger enrichment -------------------------------------------------
# The checklist renders composers surname-only, which collapses AWK-15's
# contaminated "X (arr. by Y)" records back onto the bare composer. That makes
# two genuinely different works look identical on 2019-12-15. Pull the arranger
# out of the graph so the prototype can render what distinguishes them.
_graph_path = "/Users/akale/Sites/awkale.github.io/scripts/contentful/bso-graph.json"
_g = json.load(open(_graph_path))["types"]
_works = dict(_g["work"])
_comps = dict(_g["composer"])
_pis = dict(_g["programItem"])
_cncs = dict(_g["concert"])

_ARR = re.compile(r"\((?:arr\.|orch\.|trans\.|ed\.)\s*by\s*(.+?)\)", re.I)

# (date, programme position) -> (work title, arranger or None).
# Keyed on POSITION, not title: 2019-12-15 carries two items both titled
# "The Nutcracker Suite" (Tchaikovsky's own and Ellington's arrangement), so a
# title key collapses them and mislabels the original as the arrangement.
_by_pos = {}
for cid, c in _cncs.items():
    d = c.get("date")
    if not d:
        continue
    for idx, pid in enumerate(c.get("program") or [], start=1):
        pi = _pis.get(pid) or {}
        w = _works.get(pi.get("work") or "") or {}
        comp = _comps.get(w.get("composer") or "") or {}
        m = _ARR.search(comp.get("sortName") or "")
        _by_pos[(d, pi.get("order") or idx)] = (
            (w.get("title") or "").strip(), m.group(1).strip() if m else None)

_arr_hits = _arr_skipped = 0
for c in concerts:
    for i in c["items"]:
        title, arr = _by_pos.get((c["date"], i["n"]), (None, None))
        # Only trust the join when the titles agree at that position; the run
        # concerts are renumbered by the pending re-import, so they can drift.
        if title == i["work"]:
            i["arranger"] = arr
            _arr_hits += 1 if arr else 0
        else:
            i["arranger"] = None
            _arr_skipped += 1

def items_played(c):
    return [i for i in c["items"] if not i["satOut"]]

# work -> the concerts it was played at.
# Keyed on the arranger too: ADR-0005 makes an arrangement a *distinct* work, so
# Ellington's Nutcracker is not Tchaikovsky's.
perf = collections.defaultdict(list)
for c in played:
    for i in items_played(c):
        perf[(i["composer"], i["work"], i.get("arranger"))].append(c)

works_sorted = sorted(perf.keys(), key=lambda k: (k[0], k[1], k[2] or ""))

# ---- the A–Z index, built from real composer records rather than the
# checklist's surname strings. This is the one surface where ADR-0008's
# decisions are visible: the honorific merge (Walton), the role merge
# (AWK-15), and above all the *relocated* nobiliary particle, which files
# `van Beethoven, Ludwig` under B as `Beethoven, Ludwig van`.
_ROLE = re.compile(r'\s*\((?:arr\.|orch\.|trans\.|ed\.)[^)]*\)\s*$', re.I)
_HON = re.compile(r',\s*(?:Sir|Dame)\s+', re.I)
_PREFIXES = {"van", "von", "de", "di", "del", "della", "da", "du", "le", "la", "ten", "ter"}


def filing_name(sort_name):
    """ADR-0008: strip role text and honorifics; relocate a lowercase prefix
    to the back so nothing is discarded and the display name stays recoverable."""
    s = _HON.sub(", ", _ROLE.sub("", sort_name or "").strip())
    if ", " in s:
        last, first = s.split(", ", 1)
    else:
        last, first = s, ""
    parts = last.split()
    pre = []
    while len(parts) > 1 and parts[0].lower() in _PREFIXES and parts[0][:1].islower():
        pre.append(parts.pop(0))
    root = " ".join(parts)
    tail = " ".join([p for p in [first] + pre if p])
    return f"{root}, {tail}" if tail else root


_played_dates = {c["date"] for c in played}
_satout = {(c["date"], i["work"]) for c in concerts for i in c["items"] if i["satOut"]}

composers = collections.defaultdict(list)
_seen = set()
for _cid, _c in _cncs.items():
    if _c.get("date") not in _played_dates:
        continue
    for _pid in _c.get("program") or []:
        _w = _works.get((_pis.get(_pid) or {}).get("work") or "")
        if not _w:
            continue
        _title = (_w.get("title") or "").strip()
        if (_c["date"], _title) in _satout:
            continue
        _raw = (_comps.get(_w.get("composer") or "") or {}).get("sortName") or ""
        _fn = filing_name(_raw)
        _m = re.search(r'\((?:arr\.|orch\.|trans\.|ed\.)\s*by\s*(.+?)\)', _raw, re.I)
        _label = f"{_title} (arr. {_m.group(1).strip()})" if _m else _title
        if (_fn, _label) in _seen:
            continue
        _seen.add((_fn, _label))
        composers[_fn].append(_label)
composers = {k: sorted(v) for k, v in sorted(composers.items())}

# a canonical work with 2 performances for the work page, else most-performed
WORK_KEY = max(perf.keys(), key=lambda k: (len(perf[k]), k[0] == "van Beethoven"))
for cand in [("van Beethoven", "Symphony No. 5 in C Minor", None),
             ("Ravel", "Bolero", None)]:
    if cand in perf:
        WORK_KEY = cand
        break

# The 6-item concert, which is also the one carrying the two same-titled
# Nutcrackers — the case that needs the arranger rendered to be legible.
CONCERT = max(played, key=lambda c: (len(items_played(c)), c["date"]))

# Recent-first slice, plus 2007-12-16 appended deliberately: it is the only
# played concert with no conductor (ADR-0006 notes this hides it from the
# conductor filter), so it is the missing-value case worth seeing rendered.
_recent = sorted(played, key=lambda c: c["date"], reverse=True)[:13]
_ditto = [c for c in played if not c["conductor"]]
IDX = _recent + [c for c in _ditto if c not in _recent]

conductors = collections.Counter(c["conductor"] for c in played if c["conductor"])
halls = collections.Counter(c["hall"] for c in played)


def cond(c):
    return c["conductor"] or "—"


def org(c):
    return c["org"] or "—"

DATA = {
    "counts": {
        "concerts": len(played),
        "works": len(perf),
        "composers": len(composers),
        "conductors": len(conductors),
        "halls": len(halls),
        "missed": sum(1 for c in concerts if c["missed"]),
        "satOut": sum(1 for c in concerts for i in c["items"] if i["satOut"]),
    },
    "concert": CONCERT,
    "index": IDX,
    "work": {"composer": WORK_KEY[0], "title": WORK_KEY[1],
             "performances": [{"date": c["date"], "hall": c["hall"], "conductor": cond(c)}
                              for c in sorted(perf[WORK_KEY], key=lambda c: c["date"])]},
    "composers": {cm: ws for cm, ws in sorted(composers.items())},
    "facets": {"conductors": conductors.most_common(8), "halls": halls.most_common(6)},
}

PROJECTS = [
    {"title": "dv01 Waterfall Design System", "rank": 1, "body": True,
     "org": "dv01", "years": "2021 — present",
     "summary": "The design system behind dv01's loan-analytics platform: tokens, 8 component "
                "categories, AG Grid table patterns, and a public documentation site.",
     "tech": ["React", "TypeScript", "Tailwind", "Storybook", "Supernova"],
     "live": "ux.dv01.co", "repo": None, "cover": "ds"},
    {"title": "Agent A", "rank": 2, "body": True,
     "org": "dv01", "years": "2025 — 2026",
     "summary": "An agentic interface for loan-portfolio questions — designed around the problem "
                "that the answer is a table, not a sentence.",
     "tech": ["React", "TypeScript", "Claude API"],
     "live": None, "repo": None, "cover": "agent"},
    {"title": "awkale.me", "rank": None, "body": False,
     "org": "Personal", "years": "2026",
     "summary": "This site. Prerendered React over Contentful, with an indexed history of "
                "every concert I have played.",
     "tech": ["React Router", "Vite", "Contentful", "Netlify"],
     "live": "awkale.me", "repo": "awkale/awkale.me", "cover": None},
    {"title": "Cision — Report Builder", "rank": None, "body": False,
     "org": "Cision", "years": "2017 — 2019",
     "summary": "A five-step wizard for assembling media-monitoring reports.",
     "tech": ["Angular", "SCSS"], "live": None, "repo": None, "cover": "wizard"},
    {"title": "Cision — Sidebar Navigation", "rank": None, "body": False,
     "org": "Cision", "years": "2017 — 2019",
     "summary": "Rebuilding the primary navigation for a dense analytics product.",
     "tech": ["Angular", "SCSS"], "live": None, "repo": None, "cover": "sidebar"},
]

CASE_BODY = [
    ("h2", "The problem was never the components"),
    ("p", "When I joined, dv01 had four button implementations and no shared vocabulary for "
          "describing them. The interesting part of the work was not building a fifth button. "
          "It was finding out why the previous four had happened, and making the fifth one the "
          "path of least resistance."),
    ("p", "That reframing is what turned a component library into a design system. A library is "
          "a folder of components. A system is a set of decisions about which components may "
          "exist, expressed so that following them is easier than not."),
    ("h3", "Tokens came before components"),
    ("p", "The first shipped artifact was not a component at all — it was a three-layer token "
          "contract. Primitives, semantic aliases, then framework bindings. Product engineers "
          "reached for <code>bg-surface-raised</code> instead of a hex value, and the hex value "
          "became something the system could change without a migration."),
    ("blockquote", "A token nobody uses is worse than a missing one, because it looks like "
                   "something depends on it."),
    ("p", "The tables were the hard part. AG Grid brings its own opinions about layout, density "
          "and focus, and a loan-analytics product is mostly tables. The pattern we landed on "
          "wraps AG Grid rather than restyling it, so a consumer changing one column's behaviour "
          "cannot change every other consumer's."),
]

# ------------------------------------------------------------------ variants
VARIANTS = [
    {
        "key": "A", "name": "Ember", "tagline": "The old identity, carried forward",
        "neutral": "sand", "accent": "ember",
        "accent_label": "bespoke ramp from #E05822 (12-step Radix shape, step 9 exact)",
        "neutral_label": "sand",
        "font_display": "Fraunces", "font_serif": "Fraunces", "font_sans": "Inter",
        "font_mono": "JBMono",
        "display_stack": "'Fraunces', ui-serif, Georgia, serif",
        "serif_stack": "'Fraunces', ui-serif, Georgia, serif",
        "sans_stack": "'Inter', ui-sans-serif, system-ui, sans-serif",
        "mono_stack": "'JBMono', ui-monospace, monospace",
        "reading": {"size": "19px", "leading": "1.75", "flow": "1.6em", "font": "serif"},
        "compact": {"size": "15px", "leading": "1.55", "flow": "0.9em", "font": "sans"},
        "measure": "66ch", "content": "40rem", "wide": "76rem",
        "radius": "0.5rem",
        "visited": "10",
        "decor": True,
        "paid": "harfang-pro — the original display face. Coppers &amp; Brasses webfont licence, "
                "~€150 one-off for a single domain. Toggle it on to compare against Fraunces.",
        "notes": "Keeps the warm orange as the site's own colour rather than borrowing Radix's. "
                 "The hue-cycling background survives as a decorative layer <em>behind</em> the "
                 "token system, on the home page only, and stops dead under "
                 "<code>prefers-reduced-motion</code>.",
    },
    {
        "key": "B", "name": "Archive", "tagline": "A reference tool, not a showpiece",
        "neutral": "slate", "accent": "blue",
        "accent_label": "blue (stock Radix)",
        "neutral_label": "slate",
        "font_display": "Inter", "font_serif": "Inter", "font_sans": "Inter",
        "font_mono": "JBMono",
        "display_stack": "'Inter', ui-sans-serif, system-ui, sans-serif",
        "serif_stack": "'Inter', ui-sans-serif, system-ui, sans-serif",
        "sans_stack": "'Inter', ui-sans-serif, system-ui, sans-serif",
        "mono_stack": "'JBMono', ui-monospace, monospace",
        "reading": {"size": "17px", "leading": "1.65", "flow": "1.35em", "font": "sans"},
        "compact": {"size": "13px", "leading": "1.45", "flow": "0.7em", "font": "sans"},
        "measure": "72ch", "content": "44rem", "wide": "84rem",
        "radius": "0.25rem",
        "visited": "11",
        "decor": False,
        "paid": None,
        "notes": "Drops the old identity entirely. Dates and counts set in tabular mono so "
                 "columns line up across 120 rows. Nearly achromatic, so the one accent reads "
                 "as <em>link</em> rather than as branding — which is what a catalogue wants.",
    },
    {
        "key": "C", "name": "Programme", "tagline": "Printed concert programme",
        "neutral": "sand", "accent": "bronze",
        "accent_label": "bronze (stock Radix)",
        "neutral_label": "sand",
        "font_display": "Newsreader", "font_serif": "Newsreader", "font_sans": "PlexSans",
        "font_mono": "JBMono",
        "display_stack": "'Newsreader', ui-serif, Georgia, serif",
        "serif_stack": "'Newsreader', ui-serif, Georgia, serif",
        "sans_stack": "'PlexSans', ui-sans-serif, system-ui, sans-serif",
        "mono_stack": "'JBMono', ui-monospace, monospace",
        "reading": {"size": "20px", "leading": "1.8", "flow": "1.7em", "font": "serif"},
        "compact": {"size": "14px", "leading": "1.5", "flow": "0.8em", "font": "sans"},
        "measure": "62ch", "content": "38rem", "wide": "72rem",
        "radius": "0rem",
        "visited": "10",
        "decor": False,
        "paid": None,
        "notes": "The middle path: warm like Ember, sober like Archive. Hairline rules and "
                 "centred headings borrow the concert-programme page. Square corners "
                 "(<code>--radius: 0</code>) are the one place this reaches past colour to "
                 "say &ldquo;print&rdquo;.",
    },
]

# --------------------------------------------------------------------- helpers
def esc(s):
    return html.escape(str(s), quote=False)

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

def fmt_date(d, style="long"):
    y, m, dd = d.split("-")
    if style == "long":
        return f"{int(dd)} {MONTHS[int(m)-1]} {y}"
    if style == "short":
        return f"{MONTHS[int(m)-1]} {int(dd)}, {y}"
    return d

def clip(s, n):
    """Truncate on a word boundary with an ellipsis, never mid-word."""
    s = s.strip()
    if len(s) <= n:
        return s
    cut = s[:n].rsplit(" ", 1)[0].rstrip(" ,;:—-")
    return (cut or s[:n].rstrip()) + "…"


def byline(item):
    """Composer, plus the arranger when one distinguishes this work."""
    if item.get("arranger"):
        return f'{item["composer"]}, arr. {item["arranger"]}'
    return item["composer"]


def slugify(s):
    s = (s.lower()
         .replace("&", "and").replace("é", "e").replace("á", "a")
         .replace("ř", "r").replace(" á", "a").replace("ö", "o"))
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s

def theme_css(v):
    """The three token layers, per ADR-0004, for one direction."""
    n, a = v["neutral"], v["accent"]
    out = []
    for mode in ("light", "dark"):
        # Stamped on <html>, exactly as ADR-0004's blocking inline script does it,
        # so `body` and every descendant can resolve the tokens.
        sel = f'html[data-variant="{v["key"]}"][data-mode="{mode}"]'
        out.append(f"{sel} {{")
        out.append("    /* layer 1 — primitives (Radix; self-swapping by mode) */")
        out.append(scale_css("n", n, mode))
        out.append(scale_css("a", a, mode))
        out.append("""
    /* layer 2 — semantic contract (authored once per mode via the primitives above) */
    --background: var(--n-1);
    --card: var(--n-2);
    --muted: var(--n-3);
    --muted-hover: var(--n-4);
    --border-subtle: var(--n-6);
    --border: var(--n-7);
    --ring: var(--a-8);
    --primary: var(--a-9);
    --primary-hover: var(--a-10);
    --primary-foreground: #fff;
    --muted-foreground: var(--n-11);
    --foreground: var(--n-12);

    /* --- extensions: not part of shadcn's contract (ADR-0004) --- */
    --link: var(--a-11);
    --link-hover: var(--a-12);
    --link-visited: var(--visited-strategy, var(--a-%s));
    --measure: %s;
    --width-content: %s;
    --width-wide: %s;
    --radius: %s;
""" % (v["visited"], v["measure"], v["content"], v["wide"], v["radius"]))
        out.append("}")
    # fonts + typeset presets (mode-independent)
    out.append(f'html[data-variant="{v["key"]}"] {{')
    out.append(f'    --font-display: {v["display_stack"]};')
    out.append(f'    --font-serif: {v["serif_stack"]};')
    out.append(f'    --font-sans: {v["sans_stack"]};')
    out.append(f'    --font-mono: {v["mono_stack"]};')
    out.append("}")
    for preset in ("reading", "compact"):
        p = v[preset]
        out.append(f'html[data-variant="{v["key"]}"] .typeset-{preset} {{')
        out.append(f'    --typeset-font-body: var(--font-{p["font"]});')
        out.append(f'    --typeset-font-heading: var(--font-{"display" if preset=="reading" else p["font"]});')
        out.append(f'    --typeset-size: {p["size"]};')
        out.append(f'    --typeset-leading: {p["leading"]};')
        out.append(f'    --typeset-flow: {p["flow"]};')
        out.append("}")
    return "\n".join(out)


# ================================================================== surfaces
def surface_home(v):
    c = DATA["counts"]
    k = v["key"]
    if k == "A":
        decor = '<div class="ember-decor" aria-hidden="true"></div>' if v["decor"] else ""
        return f"""
<section class="s-home s-home--ember">
  {decor}
  <div class="home-inner">
    <p class="eyebrow">Alex W. Kale</p>
    <h1 class="display">Design, development,<br>and every concert<br>I have played.</h1>
    <p class="lede typeset-reading">I build design systems for a living and keep an index of
      {c['works']} works I have performed since 2001. Both are here.</p>
    <nav class="home-nav">
      <a href="#projects" class="cta">See the work</a>
      <a href="#concerts" class="cta cta--ghost">Browse the archive</a>
    </nav>
  </div>
</section>"""
    if k == "B":
        return f"""
<section class="s-home s-home--archive">
  <div class="ar-masthead">
    <div>
      <h1 class="ar-title">Alex W. Kale</h1>
      <p class="ar-sub">Design systems &amp; front-end engineering · Brooklyn</p>
    </div>
    <dl class="ar-stats">
      <div><dt>Concerts</dt><dd class="mono">{c['concerts']}</dd></div>
      <div><dt>Works</dt><dd class="mono">{c['works']}</dd></div>
      <div><dt>Composers</dt><dd class="mono">{c['composers']}</dd></div>
    </dl>
  </div>
  <div class="ar-directory">
    <a href="#projects" class="ar-dirrow"><span class="ar-dirkey">/projects</span>
      <span class="ar-dirdesc">Five pieces of design and development work</span>
      <span class="mono ar-dirn">5</span></a>
    <a href="#concerts" class="ar-dirrow"><span class="ar-dirkey">/concerts</span>
      <span class="ar-dirdesc">Performance history, indexed by composer and work</span>
      <span class="mono ar-dirn">{c['concerts']}</span></a>
    <a href="#composers" class="ar-dirrow"><span class="ar-dirkey">/concerts/composers</span>
      <span class="ar-dirdesc">A–Z index</span>
      <span class="mono ar-dirn">{c['composers']}</span></a>
    <span class="ar-dirrow ar-dirrow--off"><span class="ar-dirkey">/music</span>
      <span class="ar-dirdesc">Reserved</span><span class="mono ar-dirn">—</span></span>
  </div>
</section>"""
    return f"""
<section class="s-home s-home--programme">
  <div class="pr-cover">
    <p class="pr-rule-top">awkale.me</p>
    <h1 class="display">Alex W. Kale</h1>
    <p class="pr-role">Design systems &amp; front-end engineering</p>
    <div class="pr-hr"><span>&#10087;</span></div>
    <p class="pr-blurb typeset-reading">Design and development work, and a personal history of
      {c['works']} works performed across {c['concerts']} concerts since May 2001.</p>
    <div class="pr-cover-nav">
      <a href="#projects">Projects</a><span class="pr-dot">·</span>
      <a href="#concerts">Performance history</a>
    </div>
  </div>
</section>"""


def surface_projects(v):
    k = v["key"]
    ps = PROJECTS
    if k == "A":
        rows = []
        for i, p in enumerate(ps):
            feat = " is-featured" if p["rank"] else ""
            cover = (f'<div class="em-cover em-cover--{p["cover"]}" aria-hidden="true"></div>'
                     if p["cover"] else "")
            title = (f'<a href="#case">{esc(p["title"])}</a>' if p["body"] else esc(p["title"]))
            live = (f'<a class="em-live" href="#" onclick="return false">{esc(p["live"])} &#8599;</a>'
                    if p["live"] else "")
            rows.append(f"""
    <article class="em-proj{feat}">
      {cover}
      <div class="em-projbody">
        <p class="em-meta">{esc(p["org"])} · {esc(p["years"])}{'' if p["body"] else ' · index only'}</p>
        <h3 class="em-projtitle">{title}</h3>
        <p class="em-projsum">{esc(p["summary"])}</p>
        <p class="em-tech">{" · ".join(esc(t) for t in p["tech"])}</p>
        {live}
      </div>
    </article>""")
        return f"""
<section class="s-projects" id="projects">
  <header class="sec-head"><h2>Projects</h2>
    <p class="sec-note">Two carry case studies. Three are index-only — a card without a page
      does not pretend to click.</p></header>
  <div class="em-projs">{''.join(rows)}</div>
</section>"""
    if k == "B":
        rows = []
        for p in ps:
            title = (f'<a href="#case">{esc(p["title"])}</a>' if p["body"] else
                     f'<span class="ar-flat">{esc(p["title"])}</span>')
            rows.append(f"""
      <tr>
        <td class="mono ar-rank">{p["rank"] if p["rank"] else "—"}</td>
        <td class="ar-cell-title">{title}
          <span class="ar-inlinesum">{esc(p["summary"])}</span></td>
        <td>{esc(p["org"])}</td>
        <td class="mono">{esc(p["years"])}</td>
        <td class="ar-cell-page">{"case study" if p["body"] else "—"}</td>
      </tr>""")
        return f"""
<section class="s-projects" id="projects">
  <header class="sec-head"><h2>Projects</h2></header>
  <table class="ar-table">
    <thead><tr><th class="ar-rank">Rank</th><th>Title</th><th>Organization</th>
      <th>Years</th><th>Page</th></tr></thead>
    <tbody>{''.join(rows)}</tbody>
  </table>
</section>"""
    rows = []
    for p in ps:
        title = (f'<a href="#case">{esc(p["title"])}</a>' if p["body"] else esc(p["title"]))
        rows.append(f"""
    <div class="pr-proj">
      <div class="pr-projhead">
        <h3>{title}</h3>
        <p class="pr-projmeta">{esc(p["org"])}<br><span class="mono">{esc(p["years"])}</span></p>
      </div>
      <p class="pr-projsum">{esc(p["summary"])}</p>
      <p class="pr-tech">{" · ".join(esc(t) for t in p["tech"])}</p>
    </div>""")
    return f"""
<section class="s-projects" id="projects">
  <header class="sec-head"><h2>Projects</h2></header>
  <div class="pr-projs">{''.join(rows)}</div>
</section>"""


def surface_case(v):
    body = []
    for tag, text in CASE_BODY:
        if tag == "blockquote":
            body.append(f"<blockquote>{text}</blockquote>")
        else:
            body.append(f"<{tag}>{text}</{tag}>")
    body = "\n      ".join(body)
    imagegroup = """
      <figure class="ig ig--sideBySide">
        <div class="ig-img ig-img--before" aria-hidden="true"></div>
        <div class="ig-img ig-img--after" aria-hidden="true"></div>
        <figcaption>Before and after: the token contract replacing four button implementations.
          Captions come from each Asset's <code>description</code>.</figcaption>
      </figure>"""
    return f"""
<section class="s-case" id="case">
  <article class="case">
    <header class="case-head">
      <p class="eyebrow">Case study · dv01</p>
      <h2 class="display">dv01 Waterfall Design System</h2>
      <p class="case-dek">Tokens, eight component categories, AG Grid table patterns,
        and a public documentation site.</p>
      <dl class="case-facts">
        <div><dt>Organization</dt><dd>dv01</dd></div>
        <div><dt>Years</dt><dd class="mono">2021 — present</dd></div>
        <div><dt>Live</dt><dd><a href="#" onclick="return false">ux.dv01.co</a></dd></div>
      </dl>
    </header>
    <div class="typeset-reading case-body">
      {body}
      {imagegroup}
    </div>
  </article>
</section>"""


def surface_concerts(v):
    k = v["key"]
    idx = DATA["index"][:14]
    facets = DATA["facets"]
    chips = "".join(
        f'<button class="chip" type="button">{esc(n)} <span class="chip-n mono">{c}</span></button>'
        for n, c in facets["conductors"][:5])
    hall_chips = "".join(
        f'<button class="chip" type="button">{esc(n)} <span class="chip-n mono">{c}</span></button>'
        for n, c in facets["halls"][:4])
    cnt = DATA["counts"]

    if k == "A":
        groups = collections.OrderedDict()
        for c in idx:
            groups.setdefault(c["date"][:4], []).append(c)
        out = []
        for year, cs in groups.items():
            rows = "".join(f"""
        <li class="em-cnc">
          <a href="#concert" class="em-cncdate">{fmt_date(c['date'])}</a>
          <span class="em-cnchall">{esc(c['hall'])}</span>
          <span class="em-cncprog">{esc(' · '.join(clip(i['work'], 38) for i in items_played(c)[:3]))}</span>
        </li>""" for c in cs)
            out.append(f'<div class="em-year"><h3 class="em-yearno">{year}</h3>'
                       f'<ul class="em-cncs">{rows}</ul></div>')
        return f"""
<section class="s-concerts" id="concerts">
  <header class="sec-head"><h2>Performance history</h2>
    <p class="sec-note">{cnt['concerts']} concerts · {cnt['works']} works ·
      {cnt['composers']} composers. Everything here is something I played.</p></header>
  <div class="facets"><span class="facet-label">Conductor</span>{chips}</div>
  <div class="em-years">{''.join(out)}</div>
</section>"""

    if k == "B":
        rows = "".join(f"""
      <tr>
        <td class="mono ar-date"><a href="#concert">{c['date']}</a></td>
        <td class="mono ar-dow">{esc(c['dow'])}</td>
        <td>{esc(c['hall'])}</td>
        <td>{esc(cond(c))}</td>
        <td class="mono ar-num">{len(items_played(c))}</td>
        <td class="ar-prog">{esc(', '.join(clip(i['work'], 30) for i in items_played(c)[:2]))}</td>
      </tr>""" for c in idx)
        return f"""
<section class="s-concerts" id="concerts">
  <header class="sec-head"><h2>Performance history</h2></header>
  <div class="ar-summary">
    <span class="mono">{cnt['concerts']}</span> concerts ·
    <span class="mono">{cnt['works']}</span> works ·
    <span class="mono">{cnt['composers']}</span> composers ·
    <span class="mono">{cnt['conductors']}</span> conductors ·
    <span class="mono">{cnt['halls']}</span> halls
  </div>
  <div class="facets"><span class="facet-label">Conductor</span>{chips}</div>
  <div class="facets"><span class="facet-label">Hall</span>{hall_chips}</div>
  <table class="ar-table ar-table--dense">
    <thead><tr><th>Date</th><th>Day</th><th>Hall</th><th>Conductor</th>
      <th class="ar-num">Items</th><th>Programme</th></tr></thead>
    <tbody>{rows}</tbody>
  </table>
</section>"""

    groups = collections.OrderedDict()
    for c in idx:
        groups.setdefault(c["date"][:4], []).append(c)
    out = []
    for year, cs in groups.items():
        rows = "".join(f"""
      <li class="pr-cnc">
        <a href="#concert" class="pr-cncdate">{fmt_date(c['date'])}</a>
        <span class="pr-leader" aria-hidden="true"></span>
        <span class="pr-cnchall">{esc(c['hall'])}</span>
        <span class="pr-cnccond">{esc(cond(c))}</span>
      </li>""" for c in cs)
        out.append(f'<section class="pr-year"><h3 class="pr-yearno">{year}</h3>'
                   f'<ul class="pr-cncs">{rows}</ul></section>')
    return f"""
<section class="s-concerts" id="concerts">
  <header class="sec-head sec-head--centred"><h2>Performance history</h2>
    <p class="sec-note">{cnt['concerts']} concerts · {cnt['works']} works ·
      {cnt['composers']} composers</p></header>
  <div class="facets facets--centred"><span class="facet-label">Conductor</span>{chips}</div>
  <div class="pr-years">{''.join(out)}</div>
</section>"""


def surface_concert(v):
    """A single concert page — the surface where satOut and a missing conductor show up."""
    c = DATA["concert"]
    k = v["key"]
    items = items_played(c)
    prog = ""
    if k == "B":
        prog = "".join(f"""
      <tr><td class="mono ar-num">{i['n']}</td>
        <td>{esc(byline(i))}</td>
        <td><a href="#work">{esc(i['work'])}</a></td></tr>""" for i in items)
        prog = f"""<table class="ar-table ar-table--dense"><thead><tr>
        <th class="ar-num">#</th><th>Composer</th><th>Work</th></tr></thead>
      <tbody>{prog}</tbody></table>"""
    elif k == "C":
        prog = "".join(f"""
      <li class="pr-item">
        <p class="pr-itemcomp">{esc(byline(i))}</p>
        <p class="pr-itemwork"><a href="#work">{esc(i['work'])}</a></p>
      </li>""" for i in items)
        prog = f'<ol class="pr-programme">{prog}</ol>'
    else:
        prog = "".join(f"""
      <li class="em-item">
        <span class="em-itemn mono">{i['n']}</span>
        <span class="em-itemcomp">{esc(byline(i))}</span>
        <a href="#work" class="em-itemwork">{esc(i['work'])}</a>
      </li>""" for i in items)
        prog = f'<ol class="em-programme">{prog}</ol>'

    head_cls = "sec-head--centred" if k == "C" else ""
    return f"""
<section class="s-concert" id="concert">
  <header class="sec-head {head_cls}">
    <p class="eyebrow">Concert</p>
    <h2 class="display">{fmt_date(c['date'])}</h2>
    <p class="sec-note">{esc(c['hall'])} · {esc(cond(c))} · {esc(org(c))}</p>
  </header>
  {prog}
  <p class="footnote">Only what I played is listed. A work I sat out is omitted from the
    programme entirely — {DATA['counts']['satOut']} across the whole archive.</p>
</section>"""


def surface_work(v):
    w = DATA["work"]
    k = v["key"]
    perfs = w["performances"]
    if k == "B":
        rows = "".join(f"""
      <tr><td class="mono"><a href="#concert">{p['date']}</a></td>
        <td>{esc(p['hall'])}</td><td>{esc(p['conductor'])}</td></tr>""" for p in perfs)
        body = f"""
    <dl class="ar-facts">
      <div><dt>Composer</dt><dd><a href="#composers">{esc(w['composer'])}</a></dd></div>
      <div><dt>Period</dt><dd>Romantic</dd></div>
      <div><dt>Forms</dt><dd>Symphony</dd></div>
      <div><dt>Performances</dt><dd class="mono">{len(perfs)}</dd></div>
    </dl>
    <table class="ar-table ar-table--dense"><thead><tr>
      <th>Date</th><th>Hall</th><th>Conductor</th></tr></thead><tbody>{rows}</tbody></table>"""
    else:
        rows = "".join(f"""
      <li class="w-perf">
        <a href="#concert" class="w-perfdate">{fmt_date(p['date'])}</a>
        <span class="w-perfhall">{esc(p['hall'])}</span>
        <span class="w-perfcond">{esc(p['conductor'])}</span>
      </li>""" for p in perfs)
        body = f"""
    <p class="w-claim typeset-reading">I played this
      {'twice' if len(perfs)==2 else ('once' if len(perfs)==1 else str(len(perfs))+' times')}.</p>
    <div class="w-tags"><span class="tag">Romantic</span><span class="tag">Symphony</span></div>
    <ul class="w-perfs">{rows}</ul>"""
    head_cls = "sec-head--centred" if k == "C" else ""
    return f"""
<section class="s-work" id="work">
  <header class="sec-head {head_cls}">
    <p class="eyebrow"><a href="#composers">{esc(w['composer'])}</a></p>
    <h2 class="display">{esc(w['title'])}</h2>
  </header>
  {body}
</section>"""


def surface_composers(v):
    k = v["key"]
    comps = DATA["composers"]
    by_letter = collections.OrderedDict()
    for cm in comps:
        # Filing names already carry the prefix at the back, so the first
        # character *is* the filing letter — that is the point of ADR-0008.
        by_letter.setdefault(cm[0].upper(), []).append(cm)
    letters = sorted(by_letter)
    jump = "".join(f'<a href="#" onclick="return false" class="jump">{l}</a>' for l in letters)

    if k == "B":
        blocks = []
        for l in letters:
            rows = "".join(
                f'<tr><td><a href="#composers">{esc(cm)}</a></td>'
                f'<td class="mono ar-num">{len(comps[cm])}</td>'
                f'<td class="ar-prog">{esc(", ".join(w[:34] for w in comps[cm][:2]))}</td></tr>'
                for cm in by_letter[l])
            blocks.append(f'<tbody class="ar-letter"><tr class="ar-letterrow">'
                          f'<th colspan="3">{l}</th></tr>{rows}</tbody>')
        inner = (f'<table class="ar-table ar-table--dense"><thead><tr><th>Composer</th>'
                 f'<th class="ar-num">Works</th><th>Sample</th></tr></thead>'
                 f'{"".join(blocks)}</table>')
    elif k == "C":
        blocks = []
        for l in letters:
            rows = "".join(
                f'<li><a href="#composers">{esc(cm)}</a>'
                f'<span class="pr-leader" aria-hidden="true"></span>'
                f'<span class="mono pr-n">{len(comps[cm])}</span></li>'
                for cm in by_letter[l])
            blocks.append(f'<div class="pr-letterblock"><h3 class="pr-letter">{l}</h3>'
                          f'<ul class="pr-index">{rows}</ul></div>')
        inner = f'<div class="pr-indexcols">{"".join(blocks)}</div>'
    else:
        blocks = []
        for l in letters:
            rows = "".join(
                f'<li><a href="#composers">{esc(cm)}</a>'
                f'<span class="em-n mono">{len(comps[cm])}</span></li>'
                for cm in by_letter[l])
            blocks.append(f'<div class="em-letterblock"><h3 class="em-letter">{l}</h3>'
                          f'<ul class="em-index">{rows}</ul></div>')
        inner = f'<div class="em-indexcols">{"".join(blocks)}</div>'

    head_cls = "sec-head--centred" if k == "C" else ""
    return f"""
<section class="s-composers" id="composers">
  <header class="sec-head {head_cls}"><h2>Composers A–Z</h2>
    <p class="sec-note">{DATA['counts']['composers']} composers whose work I have played.
      Visited links are a distinct colour — this index is the reason the token exists.</p></header>
  <nav class="jumps">{jump}</nav>
  {inner}
</section>"""


def token_panel(v):
    a, n = v["accent"], v["neutral"]
    def swatches(name):
        return "".join(
            f'<span class="sw" style="background:{SCALES[name]["light"][i]}" '
            f'title="{name}-{i} light {SCALES[name]["light"][i]}"></span>' for i in range(1, 13)) + \
            '<span class="sw-gap"></span>' + "".join(
            f'<span class="sw" style="background:{SCALES[name]["dark"][i]}" '
            f'title="{name}-{i} dark {SCALES[name]["dark"][i]}"></span>' for i in range(1, 13))
    paid = (f'<div class="tp-paid"><strong>Paid option</strong> {v["paid"]}'
            f'<label class="tp-toggle"><input type="checkbox" class="hp-toggle"> '
            f'Use harfang-pro for display &amp; serif</label></div>') if v["paid"] else ""
    return f"""
<aside class="tokenpanel">
  <h2 class="tp-h">What this direction writes into ADR-0004</h2>
  <p class="tp-note">{v["notes"]}</p>
  <div class="tp-grid">
    <div class="tp-row"><span class="tp-k">Neutral scale</span>
      <span class="tp-v">{v["neutral_label"]}</span></div>
    <div class="tp-swrow">{swatches(n)}</div>
    <div class="tp-row"><span class="tp-k">Accent scale</span>
      <span class="tp-v">{v["accent_label"]}</span></div>
    <div class="tp-swrow">{swatches(a)}</div>
    <div class="tp-row"><span class="tp-k">Themes in v1</span>
      <span class="tp-v">one — <code>{v["name"].lower()}</code> (architecture supports N)</span></div>
    <div class="tp-row"><span class="tp-k">Ramps</span>
      <span class="tp-v">{"bespoke, primitive layer only" if a == "ember" else "stock Radix"}</span></div>
    <div class="tp-row"><span class="tp-k">--font-display</span>
      <span class="tp-v">{v["font_display"]}</span></div>
    <div class="tp-row"><span class="tp-k">--font-serif</span>
      <span class="tp-v">{v["font_serif"]}</span></div>
    <div class="tp-row"><span class="tp-k">--font-sans</span>
      <span class="tp-v">{v["font_sans"]}</span></div>
    <div class="tp-row"><span class="tp-k">--font-mono</span>
      <span class="tp-v">{v["font_mono"]}</span></div>
    <div class="tp-row"><span class="tp-k">.typeset-reading</span>
      <span class="tp-v mono">{v["reading"]["size"]} / {v["reading"]["leading"]} / flow {v["reading"]["flow"]}</span></div>
    <div class="tp-row"><span class="tp-k">.typeset-compact</span>
      <span class="tp-v mono">{v["compact"]["size"]} / {v["compact"]["leading"]} / flow {v["compact"]["flow"]}</span></div>
    <div class="tp-row"><span class="tp-k">--measure</span>
      <span class="tp-v mono">{v["measure"]}</span></div>
    <div class="tp-row"><span class="tp-k">--width-content / --width-wide</span>
      <span class="tp-v mono">{v["content"]} / {v["wide"]}</span></div>
    <div class="tp-row"><span class="tp-k">--radius</span>
      <span class="tp-v mono">{v["radius"]}</span></div>
    <div class="tp-row"><span class="tp-k">--link</span>
      <span class="tp-v"><span class="tp-link">accent-11</span></span></div>
    <div class="tp-row tp-row--stack"><span class="tp-k">--link-visited</span>
      <span class="tp-v">
        <span class="tp-vnote">Item 7 is open, so pick it here rather than reading my guess.
          Scroll up to <a href="#composers">Composers A–Z</a> — the links you have
          already clicked are the live test.</span>
        <span class="visgroup" role="radiogroup" aria-label="Visited link strategy">
          <button type="button" class="visbtn" data-vis="var(--a-{v["visited"]})"
            aria-pressed="true">accent-{v["visited"]} · subtle</button>
          <button type="button" class="visbtn" data-vis="var(--n-11)"
            aria-pressed="false">neutral-11 · greyed</button>
          <button type="button" class="visbtn" data-vis="var(--a-12)"
            aria-pressed="false">accent-12 · deepened</button>
        </span>
      </span></div>
  </div>
  {paid}
</aside>"""


def variant_html(v):
    return f"""
<div class="variant" data-variant-root="{v['key']}">
  <header class="sitehead">
    <a class="brand" href="#">awkale.me</a>
    <nav class="sitenav">
      <a href="#projects">Projects</a>
      <a href="#concerts">Performance history</a>
      <a href="#composers">Composers</a>
    </nav>
    <div class="modeswitch" role="group" aria-label="Colour mode">
      <button type="button" data-mode-btn="light">Light</button>
      <button type="button" data-mode-btn="dark">Dark</button>
      <button type="button" data-mode-btn="system">System</button>
    </div>
  </header>
  <main>
    {surface_home(v)}
    {surface_projects(v)}
    {surface_case(v)}
    {surface_concerts(v)}
    {surface_concert(v)}
    {surface_work(v)}
    {surface_composers(v)}
    {token_panel(v)}
  </main>
  <footer class="sitefoot">
    <p>PROTOTYPE — AWK-22. Throwaway. Real archive data, {DATA['counts']['concerts']} played
      concerts.</p>
  </footer>
</div>"""


# ===================================================================== styles
BASE_CSS = r"""
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--background);color:var(--foreground);
  font-family:var(--font-sans);
  transition:background-color .25s ease,color .25s ease}
img{max-width:100%;height:auto}
a{color:var(--link);text-decoration-thickness:.06em;text-underline-offset:.18em}
a:hover{color:var(--link-hover)}
a:visited{color:var(--link-visited)}
:focus-visible{outline:2px solid var(--ring);outline-offset:2px;border-radius:2px}
code{font-family:var(--font-mono);font-size:.88em;background:var(--muted);
  padding:.1em .34em;border-radius:calc(var(--radius) * .5)}
.mono{font-family:var(--font-mono);font-variant-numeric:tabular-nums}
.variant{display:none}
.variant.is-active{display:block}

/* ---------- chrome ---------- */
.sitehead{display:flex;align-items:center;gap:1.5rem;flex-wrap:wrap;
  padding:1.1rem var(--gutter,1.5rem);border-bottom:1px solid var(--border-subtle);
  position:sticky;top:0;background:color-mix(in srgb,var(--background) 88%,transparent);
  backdrop-filter:blur(8px);z-index:20}
.brand{font-family:var(--font-display);font-weight:600;font-size:1.05rem;
  color:var(--foreground);text-decoration:none;letter-spacing:-.01em}
.sitenav{display:flex;gap:1.1rem;margin-inline-end:auto;flex-wrap:wrap}
.sitenav a{font-size:.86rem;color:var(--muted-foreground);text-decoration:none}
.sitenav a:hover{color:var(--foreground)}
.modeswitch{display:flex;border:1px solid var(--border);border-radius:var(--radius);
  overflow:hidden}
.modeswitch button{font:inherit;font-size:.74rem;padding:.3rem .6rem;border:0;
  background:transparent;color:var(--muted-foreground);cursor:pointer}
.modeswitch button+button{border-left:1px solid var(--border-subtle)}
.modeswitch button[aria-pressed="true"]{background:var(--primary);
  color:var(--primary-foreground)}
.sitefoot{padding:2.5rem var(--gutter,1.5rem);border-top:1px solid var(--border-subtle);
  color:var(--muted-foreground);font-size:.78rem}

main>section{padding:var(--space-section,4rem) var(--gutter,1.5rem);
  border-bottom:1px solid var(--border-subtle)}
.sec-head{max-width:var(--width-wide);margin:0 auto 2rem}
.sec-head--centred{text-align:center}
.sec-head h2{font-family:var(--font-display);font-size:1.9rem;margin:0 0 .4rem;
  letter-spacing:-.015em;line-height:1.15}
.sec-note{color:var(--muted-foreground);font-size:.9rem;margin:0;max-width:56ch}
.sec-head--centred .sec-note{margin-inline:auto}
.eyebrow{font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;
  color:var(--muted-foreground);margin:0 0 .7rem;font-family:var(--font-sans)}
.display{font-family:var(--font-display);letter-spacing:-.02em;line-height:1.05;
  margin:0 0 .6rem}
.footnote{max-width:var(--measure);margin:2rem auto 0;font-size:.8rem;
  color:var(--muted-foreground);border-top:1px solid var(--border-subtle);padding-top:.9rem}

/* ---------- typeset ---------- */
.typeset-reading,.typeset-compact{font-family:var(--typeset-font-body);
  font-size:var(--typeset-size);line-height:var(--typeset-leading)}
.typeset-reading>*+*,.typeset-compact>*+*{margin-top:var(--typeset-flow)}
.typeset-reading h2,.typeset-reading h3{font-family:var(--typeset-font-heading);
  line-height:1.2;letter-spacing:-.012em;margin-bottom:.2em}
.typeset-reading h2{font-size:1.5em}
.typeset-reading h3{font-size:1.18em}
.typeset-reading p,.typeset-compact p{margin:0}
.typeset-reading blockquote{margin:0;padding-left:1.1em;
  border-left:3px solid var(--primary);font-style:italic;color:var(--muted-foreground)}

/* ---------- facets / chips ---------- */
.facets{max-width:var(--width-wide);margin:0 auto 1rem;display:flex;
  align-items:center;gap:.45rem;flex-wrap:wrap}
.facets--centred{justify-content:center}
.facet-label{font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;
  color:var(--muted-foreground);margin-inline-end:.3rem}
.chip{font:inherit;font-size:.78rem;padding:.24rem .6rem;border-radius:999px;
  border:1px solid var(--border);background:var(--card);color:var(--foreground);
  cursor:pointer;display:inline-flex;gap:.4rem;align-items:center}
.chip:hover{background:var(--muted)}
.chip-n{color:var(--muted-foreground);font-size:.72em}
.jumps{max-width:var(--width-wide);margin:0 auto 1.6rem;display:flex;gap:.2rem;
  flex-wrap:wrap}
.jump{font-size:.8rem;min-width:1.6rem;text-align:center;padding:.16rem .3rem;
  text-decoration:none;border-radius:calc(var(--radius) * .6)}
.jump:hover{background:var(--muted)}
.tag{font-size:.74rem;padding:.2rem .55rem;border-radius:999px;
  background:var(--muted);color:var(--muted-foreground)}
.w-tags{display:flex;gap:.4rem;max-width:var(--measure);margin:0 auto 1.6rem}

/* ---------- imageGroup ---------- */
.ig{margin:0}
.ig--sideBySide{display:grid;gap:1rem}
@media(min-width:48rem){.ig--sideBySide{grid-template-columns:1fr 1fr}}
.ig-img{aspect-ratio:4/3;border-radius:var(--radius);border:1px solid var(--border-subtle)}
.ig-img--before{background:
  repeating-linear-gradient(0deg,var(--muted) 0 8px,var(--card) 8px 16px)}
.ig-img--after{background:
  linear-gradient(135deg,var(--primary) 0%,var(--muted) 70%)}
.ig figcaption{grid-column:1/-1;font-size:.78rem;color:var(--muted-foreground);
  margin-top:.2rem}

/* ---------- case study ---------- */
.case{max-width:var(--width-content);margin:0 auto}
.case-head{margin-bottom:2.4rem}
.case-head .display{font-size:2.3rem}
.case-dek{font-size:1.05rem;color:var(--muted-foreground);margin:.5rem 0 1.4rem;
  max-width:52ch}
.case-facts{display:flex;gap:2rem;flex-wrap:wrap;margin:0;padding-top:1.1rem;
  border-top:1px solid var(--border-subtle)}
.case-facts div{margin:0}
.case-facts dt{font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;
  color:var(--muted-foreground);margin-bottom:.2rem}
.case-facts dd{margin:0;font-size:.9rem}
.case-body{max-width:var(--measure)}

/* ---------- shared work-page bits ---------- */
.w-claim{max-width:var(--measure);margin:0 auto 1.4rem;font-weight:500}
.w-perfs{max-width:var(--measure);margin:0 auto;padding:0;list-style:none}
.w-perf{display:grid;grid-template-columns:9rem 1fr auto;gap:.8rem;
  padding:.7rem 0;border-top:1px solid var(--border-subtle);font-size:.88rem;
  align-items:baseline}
.w-perfdate{text-decoration:none;font-weight:500}
.w-perfhall{color:var(--muted-foreground)}
.w-perfcond{color:var(--muted-foreground);font-size:.85em}
@media(max-width:34rem){.w-perf{grid-template-columns:1fr}}

/* ---------- token panel ---------- */
.tokenpanel{max-width:var(--width-content);margin:0 auto}
.tp-h{font-family:var(--font-display);font-size:1.25rem;margin:0 0 .6rem}
.tp-note{color:var(--muted-foreground);font-size:.88rem;margin:0 0 1.4rem;
  line-height:1.6}
.tp-grid{border:1px solid var(--border-subtle);border-radius:var(--radius);
  overflow:hidden}
.tp-row{display:flex;gap:1rem;justify-content:space-between;align-items:baseline;
  padding:.5rem .8rem;font-size:.82rem;border-bottom:1px solid var(--border-subtle)}
.tp-row:last-child{border-bottom:0}
.tp-k{color:var(--muted-foreground);font-family:var(--font-mono);font-size:.76rem;
  flex:0 0 auto}
.tp-v{text-align:right}
.tp-swrow{display:flex;padding:.45rem .8rem;gap:2px;
  border-bottom:1px solid var(--border-subtle)}
.sw{width:100%;height:20px;border-radius:2px}
.sw-gap{flex:0 0 10px}
.tp-link{color:var(--link)}
.tp-linkv{color:var(--link-visited)}
.tp-row--stack{flex-direction:column;align-items:stretch;gap:.6rem}
.tp-row--stack .tp-v{text-align:left}
.tp-vnote{display:block;color:var(--muted-foreground);font-size:.95em;
  line-height:1.55;margin-bottom:.55rem}
.visgroup{display:flex;gap:.35rem;flex-wrap:wrap}
.visbtn{font:inherit;font-size:.76rem;padding:.3rem .6rem;cursor:pointer;
  border:1px solid var(--border);border-radius:var(--radius);
  background:var(--card);color:var(--muted-foreground)}
.visbtn:hover{background:var(--muted)}
.visbtn[aria-pressed="true"]{background:var(--link-visited);color:#fff;
  border-color:var(--link-visited)}
.tp-paid{margin-top:1.2rem;padding:.9rem 1rem;border:1px dashed var(--border);
  border-radius:var(--radius);font-size:.82rem;color:var(--muted-foreground);
  line-height:1.6}
.tp-paid strong{color:var(--foreground)}
.tp-toggle{display:flex;gap:.45rem;align-items:center;margin-top:.6rem;
  color:var(--foreground);cursor:pointer}

/* ---------- switcher ---------- */
.switcher{position:fixed;bottom:1.1rem;left:50%;transform:translateX(-50%);
  z-index:100;display:flex;align-items:stretch;
  background:#0b0b0c;color:#fff;border-radius:999px;
  box-shadow:0 8px 30px rgba(0,0,0,.4),0 0 0 1px rgba(255,255,255,.14);
  font:500 13px/1 ui-sans-serif,system-ui,sans-serif;overflow:hidden}
.switcher button{font:inherit;background:transparent;border:0;color:#fff;
  cursor:pointer;padding:.7rem .95rem}
.switcher button:hover{background:rgba(255,255,255,.14)}
.switcher .sw-label{padding:.7rem .5rem;display:flex;align-items:center;gap:.5rem;
  min-width:15rem;justify-content:center;white-space:nowrap}
.sw-key{background:#fff;color:#0b0b0c;border-radius:999px;width:1.35rem;
  height:1.35rem;display:grid;place-items:center;font-weight:700;font-size:11px}
.sw-tag{opacity:.62;font-weight:400}
.switcher .sw-hint{padding:.7rem .95rem;border-left:1px solid rgba(255,255,255,.16);
  opacity:.55;font-size:11px;display:flex;align-items:center}
@media(max-width:40rem){.switcher .sw-label{min-width:8rem}.switcher .sw-hint{display:none}}
"""

VARIANT_CSS = r"""
/* ============================== A — EMBER ============================== */
[data-variant="A"]{--gutter:1.6rem;--space-section:5.5rem}
[data-variant="A"] .display{font-weight:600}
[data-variant="A"] .s-home--ember{position:relative;overflow:hidden;
  padding-block:7rem 6rem;border-bottom:0}
[data-variant="A"] .ember-decor{position:absolute;inset:0;z-index:0;
  background:var(--a-9);animation:ember-cycle 200s linear infinite;opacity:.14}
[data-variant="A"][data-mode="dark"] .ember-decor{opacity:.24}
@keyframes ember-cycle{from{filter:hue-rotate(0deg)}to{filter:hue-rotate(360deg)}}
@media(prefers-reduced-motion:reduce){[data-variant="A"] .ember-decor{animation:none}}
[data-variant="A"] .home-inner{position:relative;z-index:1;
  max-width:var(--width-wide);margin:0 auto}
[data-variant="A"] .s-home--ember .display{font-size:clamp(2.6rem,7vw,5rem)}
[data-variant="A"] .lede{max-width:38ch;margin:1.4rem 0 2rem;
  color:var(--muted-foreground)}
[data-variant="A"] .home-nav{display:flex;gap:.7rem;flex-wrap:wrap}
[data-variant="A"] .cta{display:inline-block;padding:.7rem 1.3rem;
  border-radius:999px;background:var(--primary);color:var(--primary-foreground);
  text-decoration:none;font-size:.9rem;font-weight:500}
[data-variant="A"] .cta:hover{background:var(--primary-hover);
  color:var(--primary-foreground)}
[data-variant="A"] .cta--ghost{background:transparent;color:var(--foreground);
  border:1px solid var(--border)}
[data-variant="A"] .cta--ghost:hover{background:var(--muted);color:var(--foreground)}
[data-variant="A"] .em-projs{max-width:var(--width-wide);margin:0 auto;
  display:flex;flex-direction:column;gap:3.5rem}
[data-variant="A"] .em-proj{display:grid;gap:1.6rem;align-items:center}
@media(min-width:52rem){
  [data-variant="A"] .em-proj{grid-template-columns:1.1fr 1fr}
  [data-variant="A"] .em-proj:nth-child(even) .em-cover{order:2}
  [data-variant="A"] .em-proj.is-featured{grid-template-columns:1.35fr 1fr}
}
[data-variant="A"] .em-cover{aspect-ratio:16/10;border-radius:var(--radius);
  border:1px solid var(--border-subtle)}
[data-variant="A"] .em-cover--ds{background:
  linear-gradient(140deg,var(--a-9),var(--a-6) 55%,var(--n-3))}
[data-variant="A"] .em-cover--agent{background:
  radial-gradient(circle at 30% 30%,var(--a-8),var(--n-4) 70%)}
[data-variant="A"] .em-cover--wizard{background:
  repeating-linear-gradient(100deg,var(--n-4) 0 22px,var(--n-3) 22px 44px)}
[data-variant="A"] .em-cover--sidebar{background:
  linear-gradient(90deg,var(--n-6) 0 26%,var(--n-2) 26%)}
[data-variant="A"] .em-meta{font-size:.72rem;letter-spacing:.11em;
  text-transform:uppercase;color:var(--muted-foreground);margin:0 0 .5rem}
[data-variant="A"] .em-projtitle{font-family:var(--font-display);font-size:1.7rem;
  margin:0 0 .55rem;line-height:1.15;letter-spacing:-.015em}
[data-variant="A"] .em-projtitle a{text-decoration:none;color:var(--foreground)}
[data-variant="A"] .em-projtitle a:hover{color:var(--link)}
[data-variant="A"] .em-projsum{margin:0 0 .8rem;color:var(--muted-foreground);
  max-width:46ch;line-height:1.65;font-size:.95rem}
[data-variant="A"] .em-tech{font-size:.76rem;color:var(--muted-foreground);
  margin:0 0 .6rem;font-family:var(--font-mono)}
[data-variant="A"] .em-live{font-size:.85rem;text-decoration:none;font-weight:500}
[data-variant="A"] .em-years{max-width:var(--width-wide);margin:0 auto;
  display:flex;flex-direction:column;gap:2.6rem}
[data-variant="A"] .em-yearno{font-family:var(--font-display);font-size:2.6rem;
  margin:0 0 .5rem;color:var(--a-6);line-height:1;letter-spacing:-.03em}
[data-variant="A"] .em-cncs,[data-variant="A"] .em-programme{list-style:none;
  margin:0;padding:0}
[data-variant="A"] .em-cnc{display:grid;gap:.2rem .9rem;padding:.85rem 0;
  border-top:1px solid var(--border-subtle)}
@media(min-width:52rem){[data-variant="A"] .em-cnc{
  grid-template-columns:11rem 15rem 1fr;align-items:baseline}}
[data-variant="A"] .em-cncdate{text-decoration:none;font-weight:500;font-size:.95rem}
[data-variant="A"] .em-cnchall{color:var(--muted-foreground);font-size:.85rem}
[data-variant="A"] .em-cncprog{color:var(--muted-foreground);font-size:.85rem}
[data-variant="A"] .em-programme{max-width:var(--measure);margin-inline:auto}
[data-variant="A"] .em-item{display:grid;grid-template-columns:2rem 12rem 1fr;
  gap:.8rem;padding:.8rem 0;border-top:1px solid var(--border-subtle);
  align-items:baseline;font-size:.95rem}
[data-variant="A"] .em-itemn{color:var(--a-9);font-weight:600}
[data-variant="A"] .em-itemcomp{color:var(--muted-foreground)}
[data-variant="A"] .em-itemwork{text-decoration:none}
@media(max-width:40rem){[data-variant="A"] .em-item{grid-template-columns:1.6rem 1fr}}
[data-variant="A"] .em-indexcols{max-width:var(--width-wide);margin:0 auto;
  columns:16rem;column-gap:2.4rem}
[data-variant="A"] .em-letterblock{break-inside:avoid;margin-bottom:1.6rem}
[data-variant="A"] .em-letter{font-family:var(--font-display);font-size:1.5rem;
  color:var(--a-9);margin:0 0 .3rem;border-bottom:1px solid var(--border-subtle);
  padding-bottom:.2rem}
[data-variant="A"] .em-index{list-style:none;margin:0;padding:0;font-size:.9rem}
[data-variant="A"] .em-index li{display:flex;justify-content:space-between;
  gap:.6rem;padding:.2rem 0}
[data-variant="A"] .em-index a{text-decoration:none}
[data-variant="A"] .em-index a:hover{text-decoration:underline}
[data-variant="A"] .em-n{color:var(--muted-foreground);font-size:.74rem}

/* ============================= B — ARCHIVE ============================= */
[data-variant="B"]{--gutter:1.5rem;--space-section:3rem}
[data-variant="B"] .display{font-weight:600;letter-spacing:-.025em}
[data-variant="B"] .sec-head h2{font-size:1.35rem}
[data-variant="B"] .ar-masthead{max-width:var(--width-wide);margin:0 auto 2rem;
  display:flex;justify-content:space-between;align-items:flex-end;gap:2rem;
  flex-wrap:wrap;padding-bottom:1.4rem;border-bottom:2px solid var(--foreground)}
[data-variant="B"] .ar-title{font-size:1.6rem;margin:0;letter-spacing:-.03em;
  font-weight:600}
[data-variant="B"] .ar-sub{margin:.25rem 0 0;color:var(--muted-foreground);
  font-size:.86rem}
[data-variant="B"] .ar-stats{display:flex;gap:1.8rem;margin:0}
[data-variant="B"] .ar-stats div{margin:0}
[data-variant="B"] .ar-stats dt{font-size:.66rem;letter-spacing:.1em;
  text-transform:uppercase;color:var(--muted-foreground)}
[data-variant="B"] .ar-stats dd{margin:.1rem 0 0;font-size:1.35rem;font-weight:500}
[data-variant="B"] .ar-directory{max-width:var(--width-wide);margin:0 auto;
  border:1px solid var(--border-subtle);border-radius:var(--radius);overflow:hidden}
[data-variant="B"] .ar-dirrow{display:grid;grid-template-columns:16rem 1fr 4rem;
  gap:1rem;padding:.7rem .9rem;text-decoration:none;color:var(--foreground);
  border-bottom:1px solid var(--border-subtle);align-items:baseline;font-size:.88rem}
[data-variant="B"] .ar-dirrow:last-child{border-bottom:0}
[data-variant="B"] .ar-dirrow:hover{background:var(--muted)}
[data-variant="B"] .ar-dirrow--off{color:var(--muted-foreground);cursor:default}
[data-variant="B"] .ar-dirrow--off:hover{background:transparent}
[data-variant="B"] .ar-dirkey{font-family:var(--font-mono);color:var(--link);
  font-size:.84rem}
[data-variant="B"] .ar-dirrow--off .ar-dirkey{color:var(--muted-foreground)}
[data-variant="B"] .ar-dirdesc{color:var(--muted-foreground)}
[data-variant="B"] .ar-dirn{text-align:right;color:var(--muted-foreground)}
@media(max-width:44rem){[data-variant="B"] .ar-dirrow{grid-template-columns:1fr auto}
  [data-variant="B"] .ar-dirdesc{display:none}}
[data-variant="B"] .ar-summary{max-width:var(--width-wide);margin:0 auto 1.1rem;
  font-size:.84rem;color:var(--muted-foreground)}
[data-variant="B"] .ar-table{max-width:var(--width-wide);margin:0 auto;
  width:100%;border-collapse:collapse;font-size:.86rem}
[data-variant="B"] .ar-table--dense{font-size:.8rem}
[data-variant="B"] .ar-table th{text-align:left;font-size:.66rem;
  letter-spacing:.09em;text-transform:uppercase;color:var(--muted-foreground);
  font-weight:500;padding:.4rem .55rem;border-bottom:1px solid var(--border);
  position:sticky;top:3.6rem;background:var(--background)}
[data-variant="B"] .ar-table td{padding:.4rem .55rem;
  border-bottom:1px solid var(--border-subtle);vertical-align:baseline}
[data-variant="B"] .ar-table tbody tr:hover{background:var(--muted)}
[data-variant="B"] .ar-num{text-align:right}
[data-variant="B"] .ar-rank{width:3rem;color:var(--muted-foreground)}
[data-variant="B"] .ar-date a{text-decoration:none}
[data-variant="B"] .ar-dow{color:var(--muted-foreground);width:3rem}
[data-variant="B"] .ar-prog{color:var(--muted-foreground)}
[data-variant="B"] .ar-cell-title a{font-weight:500;text-decoration:none}
[data-variant="B"] .ar-flat{font-weight:500}
[data-variant="B"] .ar-inlinesum{display:block;color:var(--muted-foreground);
  font-size:.9em;margin-top:.15rem}
[data-variant="B"] .ar-cell-page{color:var(--muted-foreground);font-size:.9em}
[data-variant="B"] .ar-letterrow th{font-family:var(--font-mono);font-size:.9rem;
  color:var(--foreground);background:var(--muted);letter-spacing:0;
  text-transform:none;padding:.3rem .55rem;top:3.6rem}
[data-variant="B"] .ar-facts{max-width:var(--width-wide);margin:0 auto 1.6rem;
  display:flex;gap:2.2rem;flex-wrap:wrap}
[data-variant="B"] .ar-facts div{margin:0}
[data-variant="B"] .ar-facts dt{font-size:.66rem;letter-spacing:.09em;
  text-transform:uppercase;color:var(--muted-foreground)}
[data-variant="B"] .ar-facts dd{margin:.15rem 0 0;font-size:.9rem}
[data-variant="B"] .case-head .display{font-size:1.8rem}

/* ============================ C — PROGRAMME ============================ */
[data-variant="C"]{--gutter:1.5rem;--space-section:5rem}
[data-variant="C"] .display{font-weight:400}
[data-variant="C"] .sitehead{border-bottom:1px solid var(--foreground)}
[data-variant="C"] .brand{letter-spacing:.02em;font-weight:400;font-size:1.1rem}
[data-variant="C"] .pr-cover{max-width:44rem;margin:0 auto;text-align:center;
  padding-block:3.5rem}
[data-variant="C"] .pr-rule-top{font-size:.7rem;letter-spacing:.3em;
  text-transform:uppercase;color:var(--muted-foreground);margin:0 0 2.4rem}
[data-variant="C"] .pr-cover .display{font-size:clamp(2.4rem,6vw,3.9rem);
  line-height:1.08}
[data-variant="C"] .pr-role{font-size:.95rem;color:var(--muted-foreground);
  margin:.5rem 0 0;letter-spacing:.02em}
[data-variant="C"] .pr-hr{display:flex;align-items:center;gap:1rem;
  margin:2.2rem 0;color:var(--a-9)}
[data-variant="C"] .pr-hr::before,[data-variant="C"] .pr-hr::after{content:"";
  flex:1;height:1px;background:var(--border)}
[data-variant="C"] .pr-hr span{font-size:.8rem}
[data-variant="C"] .pr-blurb{margin:0 auto;max-width:46ch}
[data-variant="C"] .pr-cover-nav{margin-top:2.4rem;font-size:.9rem;
  letter-spacing:.04em}
[data-variant="C"] .pr-cover-nav a{text-decoration:none}
[data-variant="C"] .pr-cover-nav a:hover{text-decoration:underline}
[data-variant="C"] .pr-dot{color:var(--muted-foreground);margin-inline:.7rem}
[data-variant="C"] .pr-projs{max-width:var(--width-wide);margin:0 auto;
  display:grid;gap:0}
[data-variant="C"] .pr-proj{padding:1.8rem 0;
  border-top:1px solid var(--border-subtle)}
[data-variant="C"] .pr-proj:first-child{border-top:1px solid var(--foreground)}
[data-variant="C"] .pr-projhead{display:flex;justify-content:space-between;
  gap:2rem;align-items:baseline;flex-wrap:wrap}
[data-variant="C"] .pr-projhead h3{font-family:var(--font-display);
  font-size:1.55rem;font-weight:400;margin:0;letter-spacing:-.01em}
[data-variant="C"] .pr-projhead h3 a{text-decoration:none;color:var(--foreground)}
[data-variant="C"] .pr-projhead h3 a:hover{color:var(--link)}
[data-variant="C"] .pr-projmeta{margin:0;text-align:right;font-size:.76rem;
  color:var(--muted-foreground);line-height:1.5}
[data-variant="C"] .pr-projsum{max-width:56ch;margin:.7rem 0 0;
  color:var(--muted-foreground);line-height:1.7;font-size:.95rem}
[data-variant="C"] .pr-tech{font-size:.74rem;letter-spacing:.08em;
  text-transform:uppercase;color:var(--muted-foreground);margin:.8rem 0 0}
[data-variant="C"] .pr-years{max-width:38rem;margin:0 auto;
  display:flex;flex-direction:column;gap:2.6rem}
[data-variant="C"] .pr-year{text-align:center}
[data-variant="C"] .pr-yearno{font-family:var(--font-display);font-weight:400;
  font-size:.8rem;letter-spacing:.3em;color:var(--muted-foreground);
  margin:0 0 1rem;text-transform:uppercase}
[data-variant="C"] .pr-cncs{list-style:none;margin:0;padding:0;text-align:left}
[data-variant="C"] .pr-cnc{display:grid;grid-template-columns:auto 1fr auto;
  gap:.5rem;align-items:baseline;padding:.5rem 0;font-size:.92rem}
[data-variant="C"] .pr-cnc .pr-cnchall{grid-column:1/-1;font-size:.78rem;
  color:var(--muted-foreground)}
[data-variant="C"] .pr-cncdate{text-decoration:none}
[data-variant="C"] .pr-cnccond{font-size:.78rem;color:var(--muted-foreground)}
[data-variant="C"] .pr-leader{border-bottom:1px dotted var(--border);
  transform:translateY(-.24em)}
[data-variant="C"] .pr-programme{max-width:var(--measure);margin:0 auto;
  padding:0;list-style:none;text-align:center}
[data-variant="C"] .pr-item{padding:1.15rem 0}
[data-variant="C"] .pr-item+.pr-item{border-top:1px solid var(--border-subtle)}
[data-variant="C"] .pr-itemcomp{margin:0 0 .2rem;font-size:.8rem;
  letter-spacing:.12em;text-transform:uppercase;color:var(--muted-foreground)}
[data-variant="C"] .pr-itemwork{margin:0;font-family:var(--font-display);
  font-size:1.25rem}
[data-variant="C"] .pr-itemwork a{text-decoration:none;color:var(--foreground)}
[data-variant="C"] .pr-itemwork a:hover{color:var(--link)}
[data-variant="C"] .pr-indexcols{max-width:var(--width-wide);margin:0 auto;
  columns:17rem;column-gap:3rem}
[data-variant="C"] .pr-letterblock{break-inside:avoid;margin-bottom:1.8rem}
[data-variant="C"] .pr-letter{font-family:var(--font-display);font-weight:400;
  font-size:.8rem;letter-spacing:.3em;color:var(--a-11);margin:0 0 .5rem;
  padding-bottom:.3rem;border-bottom:1px solid var(--border)}
[data-variant="C"] .pr-index{list-style:none;margin:0;padding:0;font-size:.9rem}
[data-variant="C"] .pr-index li{display:grid;grid-template-columns:auto 1fr auto;
  gap:.4rem;align-items:baseline;padding:.22rem 0}
[data-variant="C"] .pr-index a{text-decoration:none}
[data-variant="C"] .pr-index a:hover{text-decoration:underline}
[data-variant="C"] .pr-n{color:var(--muted-foreground);font-size:.76rem}
[data-variant="C"] .case-head{text-align:center}
[data-variant="C"] .case-facts{justify-content:center}
[data-variant="C"] .w-claim{text-align:center;font-style:italic}
[data-variant="C"] .w-tags{justify-content:center}

/* harfang-pro evaluation toggle (Typekit, licence required to ship) */
html.hp-on[data-variant="A"]{
  --font-display:"harfang-pro-1","harfang-pro-2",ui-serif,serif;
  --font-serif:"harfang-pro-1","harfang-pro-2",ui-serif,serif}
"""

JS = r"""
(function(){
  var VARIANTS = __VARIANT_META__;
  var keys = VARIANTS.map(function(v){return v.key});

  function qs(){ return new URLSearchParams(location.search); }
  function currentKey(){
    var k = (qs().get('variant') || 'A').toUpperCase();
    return keys.indexOf(k) === -1 ? 'A' : k;
  }
  function meta(k){ return VARIANTS[keys.indexOf(k)]; }

  /* ---- mode: light | dark | system, per ADR-0004's three-state control ---- */
  var mql = window.matchMedia('(prefers-color-scheme: dark)');
  function storedMode(){ return localStorage.getItem('awk22-mode') || 'system'; }
  function resolve(m){ return m === 'system' ? (mql.matches ? 'dark' : 'light') : m; }
  function applyMode(){
    var m = storedMode(), r = resolve(m);
    /* The tokens live on <html>, as ADR-0004's inline script does it. */
    document.documentElement.setAttribute('data-mode', r);
    document.querySelectorAll('[data-mode-btn]').forEach(function(b){
      b.setAttribute('aria-pressed', b.getAttribute('data-mode-btn') === m ? 'true' : 'false');
    });
  }
  mql.addEventListener('change', function(){ if (storedMode() === 'system') applyMode(); });
  document.addEventListener('click', function(e){
    var b = e.target.closest('[data-mode-btn]');
    if (!b) return;
    localStorage.setItem('awk22-mode', b.getAttribute('data-mode-btn'));
    applyMode();
  });

  /* ---- harfang-pro evaluation toggle ---- */
  var kitLoaded = false;
  document.addEventListener('change', function(e){
    if (!e.target.classList.contains('hp-toggle')) return;
    if (e.target.checked && !kitLoaded){
      kitLoaded = true;
      var s = document.createElement('script');
      s.src = 'https://use.typekit.net/tkq1har.js';
      s.onload = function(){ try { Typekit.load({ async: false }); } catch(err){} };
      document.head.appendChild(s);
    }
    document.documentElement.classList.toggle('hp-on', e.target.checked);
  });

  /* ---- visited-link strategy (AWK-22 item 7, left to Alex) ---- */
  function applyVisited(){
    var v = localStorage.getItem('awk22-visited');
    if (v) document.documentElement.style.setProperty('--visited-strategy', v);
    else   document.documentElement.style.removeProperty('--visited-strategy');
    document.querySelectorAll('.visbtn').forEach(function(b){
      var isDefault = !v && b === b.parentElement.firstElementChild;
      b.setAttribute('aria-pressed',
        (v ? b.getAttribute('data-vis') === v : isDefault) ? 'true' : 'false');
    });
  }
  document.addEventListener('click', function(e){
    var b = e.target.closest('.visbtn');
    if (!b) return;
    localStorage.setItem('awk22-visited', b.getAttribute('data-vis'));
    applyVisited();
  });

  /* ---- variant switching ---- */
  function render(){
    var k = currentKey(), m = meta(k);
    document.documentElement.setAttribute('data-variant', k);
    document.querySelectorAll('.variant').forEach(function(el){
      el.classList.toggle('is-active', el.getAttribute('data-variant-root') === k);
    });
    document.getElementById('sw-key').textContent = k;
    document.getElementById('sw-name').textContent = m.name;
    document.getElementById('sw-tag').textContent = '— ' + m.tagline;
    document.title = 'AWK-22 · ' + k + ' — ' + m.name;
    applyMode();
    applyVisited();
  }
  function go(delta){
    var i = keys.indexOf(currentKey());
    var next = keys[(i + delta + keys.length) % keys.length];
    var p = qs(); p.set('variant', next);
    history.replaceState(null, '', location.pathname + '?' + p.toString() + location.hash);
    render();
  }
  window.__awkGo = go;
  document.addEventListener('keydown', function(e){
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.key === 'ArrowLeft'){ go(-1); }
    else if (e.key === 'ArrowRight'){ go(1); }
  });
  render();
})();
"""


def build():
    variant_meta = json.dumps([{"key": v["key"], "name": v["name"], "tagline": v["tagline"]}
                               for v in VARIANTS])
    themes = "\n".join(theme_css(v) for v in VARIANTS)
    bodies = "\n".join(variant_html(v) for v in VARIANTS)
    js = JS.replace("__VARIANT_META__", variant_meta)

    doc = f"""<!DOCTYPE html>
<html lang="en" data-mode="light" data-variant="A">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AWK-22 · Visual direction prototype</title>
<meta name="robots" content="noindex">
<style>
{FONT_FACES}
</style>
<style>
{themes}
</style>
<style>
{BASE_CSS}
</style>
<style>
{VARIANT_CSS}
</style>
</head>
<body>
{bodies}

<div class="switcher" role="group" aria-label="Prototype variant switcher">
  <button type="button" onclick="__awkGo(-1)" aria-label="Previous variant">&#8592;</button>
  <span class="sw-label">
    <span class="sw-key" id="sw-key">A</span>
    <strong id="sw-name">Ember</strong>
    <span class="sw-tag" id="sw-tag"></span>
  </span>
  <button type="button" onclick="__awkGo(1)" aria-label="Next variant">&#8594;</button>
  <span class="sw-hint">&#8592; &#8594; to switch</span>
</div>

<script>
{js}
</script>
</body>
</html>
"""
    open(OUT, "w").write(doc)
    print(f"wrote {OUT}  ({len(doc)/1024:.0f} KB)")
    print("variants:", ", ".join(f"?variant={v['key']} ({v['name']})" for v in VARIANTS))
    print("data:", DATA["counts"])
    print("work page:", DATA["work"]["composer"], "—", DATA["work"]["title"],
          f"({len(DATA['work']['performances'])} performances)")
    print("concert page:", DATA["concert"]["date"], DATA["concert"]["hall"],
          f"({len(items_played(DATA['concert']))} items)")
    print(f"arranger join: {_arr_hits} items labelled, "
          f"{_arr_skipped} positions skipped on a title mismatch")
    print("2019-12-15 programme:")
    for i in items_played(DATA["concert"]):
        print(f"   {i['n']}. {byline(i)} — {i['work']}")


if __name__ == "__main__":
    build()
