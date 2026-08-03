#!/usr/bin/env python3
"""Parse participation-checklist.md -> concerts.json for the AWK-22 prototype."""
import re, json, collections

SRC = "/Users/akale/Sites/awkale.github.io/scripts/contentful/participation-checklist.md"
OUT = "/private/tmp/claude-502/-Users-akale-Sites-awkale-github-io/083f1ca0-a11e-4314-892d-fe3bb6d54d89/scratchpad/concerts.json"

# The conductor/orchestra fields are "—" on 2007-12-16 (the documented ditto
# concert), so they must be optional or that concert is silently dropped.
HEAD = re.compile(
    r'^### (\d{4}-\d\d-\d\d) · (\w+) · (.+?) · (.+?) \((.+?)\)(.*)$')

concerts, cur = [], None
for line in open(SRC).read().splitlines():
    m = HEAD.match(line)
    if m:
        cond, org = m.group(4).strip(), m.group(5).strip()
        cur = dict(date=m.group(1), dow=m.group(2), hall=m.group(3).strip(),
                   conductor=None if cond == "—" else cond,
                   org=None if org == "—" else org,
                   run="[run]" in m.group(6), missed=False, items=[])
        concerts.append(cur)
        continue
    if cur is None:
        continue
    if re.match(r'^- \[(x| )\] missed whole concert', line):
        cur["missed"] = "[x]" in line
        continue
    mi = re.match(r'^  - \[(x| )\] (\d+)\. (.+?) — (.+)$', line)
    if mi:
        cur["items"].append(dict(satOut=mi.group(1) == "x", n=int(mi.group(2)),
                                 composer=mi.group(3).strip(),
                                 work=mi.group(4).strip()))

played = [c for c in concerts if not c["missed"]]
print(f"parsed {len(concerts)} concerts, {len(played)} played")
print(f"missing conductor: {[c['date'] for c in played if not c['conductor']]}")
print(f"missed: {sum(c['missed'] for c in concerts)}, "
      f"satOut: {sum(1 for c in concerts for i in c['items'] if i['satOut'])}")
json.dump(concerts, open(OUT, "w"))
