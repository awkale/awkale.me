# Issue tracker: Linear

Issues and PRDs for this repo live in **Linear**, not GitHub Issues.

| | |
| --- | --- |
| Workspace | `awkale` (`https://linear.app/awkale`) |
| Team | **AWKALE** — key `AWK`, UUID `a5c0a981-f456-48e2-b5e7-d5a81aaf75e6` |
| Issue identifiers | `AWK-<n>` (e.g. `AWK-42`) |
| Access | the `linear-server` MCP (`https://mcp.linear.app/mcp`), OAuth |

There is no Linear CLI. All operations go through MCP tools named
`mcp__claude_ai_Linear__*`. Their schemas are **deferred** — load them before
calling, e.g.
`ToolSearch("select:mcp__claude_ai_Linear__save_issue,mcp__claude_ai_Linear__get_issue")`.

If the server reports `Needs authentication`, run `/mcp` → `linear-server` and
authorize. Don't fall back to the GraphQL API; there's no API key configured.

Pass the team as `"AWKALE"` or the UUID above. **Prefer the UUID in scripted
work** — on 2026-07-31 both the name and the key were rewritten (`Alex Kale` →
`AWKALE`, `ALE` → `AWK`), which renumbered every issue. The UUID did not move,
and is the only identifier here that never has.

Old identifiers still resolve: `get_issue` with `ALE-15` returns `AWK-15`, and
`linear.app/.../issue/ALE-15/...` redirects. So pre-rename links in older ADRs
and commit messages are not broken, just stale — but write `AWK-<n>` in anything
new. Note the team name and the key are not the same string: `AWKALE` vs `AWK`.

## Conventions

- **Create an issue**: `save_issue` with `title` + `team`, and **no `id`**.
  `description` is Markdown — pass literal newlines, never `\n` escapes.
- **Read an issue**: `get_issue` with `id: "AWK-42"`. Pass
  `includeRelations: true` whenever you care about blockers, related, or
  duplicate links — **they are omitted by default**.
- **Read the discussion**: `list_comments` with `issueId: "AWK-42"`. Inline
  (anchored) comments carry a non-null `quotedText`; top-level threads don't.
- **List issues**: `list_issues` with `team`, plus `state` / `label` /
  `assignee` filters as needed. Two traps:
  - `includeArchived` defaults to **`true`**. Pass `includeArchived: false`
    for any "what's open" query, or archived issues will pollute the result.
  - Only `id` is returned by default. Ask for what you need, e.g.
    `fields: ["id", "title", "status", "statusType", "labels", "assignee", "parentId", "url"]`.
- **Comment**: `save_comment` with `issueId` + `body`. To reply in-thread pass
  `parentId` instead of `issueId`.
- **Update**: `save_issue` **with `id`**. For long descriptions prefer `patch`
  over resending `description` — it applies anchored edits atomically.
- **Close**: `save_issue` with `id` and `state: "Done"` (or `"Canceled"` — see
  `wontfix` below). Leave a `save_comment` explaining why first.

### Labels replace, they don't append

`save_issue`'s `labels` parameter **replaces the entire label set**. Anything
you omit is removed. To add or swap one label:

1. `get_issue` (or `list_issues` with `fields: ["labels"]`) to read the current set.
2. Compute the new full set.
3. `save_issue` with that complete array.

Never pass a single label expecting it to be added — that silently strips the
rest. Contrast with `blockedBy` / `blocks` / `relatedTo` / `links`, which *are*
append-only and have matching `removeBlockedBy` / `removeBlocks` /
`removeRelatedTo` parameters.

## Triage labels and workflow state

Labels are the **source of truth** — the skills read labels, not states. Keep
the workflow state in sync so the Linear UI stays honest.

| Triage label | Linear state | Note |
| --- | --- | --- |
| `needs-triage` | `Backlog` | Linear's Triage inbox is **not enabled** on this team, so `Backlog` is the home for untriaged work. If Triage is enabled later, move this to `Triage` and update this row. |
| `needs-info` | `Backlog` | Blocked on a human reply; not actionable. |
| `ready-for-agent` | `Todo` | Fully specified, an AFK agent can pick it up. |
| `ready-for-human` | `Todo` | Specified, needs human hands. |
| `wontfix` | `Canceled` | Linear's `canceled` state type is exactly this. Don't use `Done`. |

The five labels live in a mutually-exclusive Linear **label group** named
`triage`, so an issue can't be both `wontfix` and `ready-for-agent`. Their API
names are unprefixed (`needs-triage`, not `triage/needs-triage`) — see
`triage-labels.md`.

Create them, once, with `create_issue_label`: first the group
(`name: "triage", isGroup: true, teamId: "a5c0a981-…"`), then each of the five
with `parent: "triage"`.

`state` accepts a state **type**, name, or ID. Prefer names from the table —
this team has two `started`-type states (`In Progress`, `In Review`), so
passing the bare type `"started"` is ambiguous.

## Priority

Linear's scale is `0=None, 1=Urgent, 2=High, 3=Medium, 4=Low`.

**Default new bug reports to `priority: 3` (Medium).** Never file higher
without being asked — higher priorities trigger triage swarming. If something
genuinely looks more severe, say so in the summary and let a human bump it.

## Pull requests as a triage surface

**PRs as a request surface: no.** This is a solo repo and Linear has no PR
concept of its own, so triage reads Linear issues only. GitHub PRs against
`awkale/awkale.github.io` are not part of the triage queue.

## When a skill says "publish to the issue tracker"

Create a Linear issue on team **AWKALE** via `save_issue`.

## When a skill says "fetch the relevant ticket"

`get_issue` with the `AWK-<n>` identifier, plus `list_comments` for the
discussion. Add `includeRelations: true` if blockers matter.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **sub-issues** as
tickets. All of this is native Linear — no task-list or body-convention
fallbacks needed.

- **Map**: an issue labelled `wayfinder:map`, holding the Notes /
  Decisions-so-far / Fog body.
- **Child ticket**: an issue with `parentId` set to the map's identifier.
  Labels: `wayfinder:<type>` (`research` / `prototype` / `grilling` / `task`).
- **Blocking**: native issue relations. Add with `save_issue`
  (`id: "<child>", blockedBy: ["AWK-7"]`); remove with `removeBlockedBy`.
  Read them back with `get_issue` + `includeRelations: true`.
- **Frontier query**: `list_issues` with `parentId: "<map>"`,
  `includeArchived: false`, and
  `fields: ["id", "title", "status", "statusType", "labels", "assignee"]`.
  Drop anything with a `completed`/`canceled` `statusType`, anything already
  `In Progress`, and anything with an unfinished blocker (check each candidate
  with `get_issue` + `includeRelations: true`). First in sub-issue order wins.
- **Claim**: `save_issue` with `id` and `state: "In Progress"` — the session's
  first write.

### The claim signal is workflow state, not assignee

`/wayfinder` as written treats the **assignee** as the claim, and an open
unassigned ticket as unclaimed. **That does not work here.** This is a solo
repo: every issue is assigned to Alex, so "has an assignee" is universally true
and distinguishes nothing. A frontier query that drops anything assigned returns
an empty frontier forever.

So the claim is the **workflow state**, and assignee stays what it naturally is
— ownership, always Alex. The mapping:

| State | Frontier meaning |
| --- | --- |
| `Backlog` | has an unfinished blocker; not takeable |
| `Todo` | unblocked and unclaimed — **this is the frontier** |
| `In Progress` | claimed, or a human task underway |
| `Done` / `Canceled` | closed, off the frontier |

This also expresses something assignee could not: assignee is binary, but state
separates **blocked** from **merely unclaimed**, which is exactly the
distinction the frontier needs.

**Blocking relations stay authoritative.** State is a fast index, not the source
of truth — nothing enforces that `Backlog` and "has a blocker" agree. On AWK-5
they agreed exactly (all four `Backlog` children blocked, all four `Todo`
children unblocked) but that is maintained by hand. So still check
`includeRelations: true` on each candidate rather than trusting `Todo` alone,
and if you find an unblocked ticket sitting in `Backlog`, move it to `Todo`
rather than skipping it.

Setting `In Progress` as the session's first write is also what keeps two
concurrent agent sessions off the same ticket — the role the assignee played in
the original design.
- **Resolve**: `save_comment` with the answer, then `save_issue` with
  `state: "Done"`, then append a context pointer to the map's
  Decisions-so-far (use `patch` with an `append` op).

## Useful discovery calls

- `list_teams` — teams in the workspace.
- `get_team` — team detail by UUID, key, or name.
- `list_issue_statuses` with `team` — the authoritative state list. Re-run this
  if the table above looks stale.
- `list_issue_labels` with `team` — existing labels.
- `list_users` / `get_user` — for assignment by name or email.
