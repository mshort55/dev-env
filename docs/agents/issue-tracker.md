# GitHub Issues

Track issues and specs in `mshort55/dev-env`. Run `gh` from the repo root.
Before creating the first issue in a session, check the target with
`gh repo view --json nameWithOwner`. If it differs, pass `-R mshort55/dev-env`.

- Publish a ticket with `gh issue create --title "<title>" --body-file <file>`.
- Fetch a ticket with `gh issue view <number> --json number,title,body,labels,comments`.
- Find open tickets with `gh issue list --state open`. Use `--label` to filter by role.
- Apply or remove a role with `gh issue edit <number> --add-label <label>` or `--remove-label <label>`.
- Post the resolution with `gh issue comment <number> --body-file <file>`, then close the ticket with `gh issue close <number>`.

PRs as a request surface: no.

## Parent issues and blockers

Link a child to its parent as a GitHub sub-issue. If sub-issues are unavailable,
put `Part of #<parent>` in the child and link it from the parent's task list.

Record blockers with GitHub issue dependencies. If dependencies are unavailable,
add `Blocked by: #<number>` to the child and list each blocker there.
A ticket is unblocked when all its blockers are closed.

## Wayfinding

Use one issue labelled `wayfinder:map` for the map. Keep Notes, Decisions-so-far,
and Fog in its body. Link each decision ticket as a child and label it by type:
`wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, or `wayfinder:task`.

In map order, choose the first open, unassigned child whose blockers are closed.
Claim it with `gh issue edit <number> --add-assignee @me`. To resolve it, comment
with the answer, close the child, and add the decision and ticket link to Decisions-so-far.
