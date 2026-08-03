# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those
roles to the actual label strings used in this repo's issue tracker (Linear —
see `issue-tracker.md`).

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the
corresponding label string from this table.

Edit the right-hand column to match whatever vocabulary you actually use.

## Linear specifics

The five labels sit inside a Linear **label group** named `triage`, created with
`isGroup: true`. A group makes them mutually exclusive, which matches the roles —
an issue can't sensibly be both `wontfix` and `ready-for-agent`.

Grouping does **not** change the label names. Linear displays them as
`triage → needs-triage`, but the API name is the bare `needs-triage`, exactly as
in the table above. Pass the bare name.

Two things to remember when applying them, both detailed in `issue-tracker.md`:

- **`save_issue`'s `labels` parameter replaces the whole set.** Read the current
  labels first, then write the complete new array.
- **Each label has a paired workflow state** (`needs-triage` → `Backlog`,
  `wontfix` → `Canceled`, and so on). Labels are the source of truth the skills
  read; set the state alongside so the Linear UI stays meaningful.
