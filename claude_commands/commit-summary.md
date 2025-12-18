---
description: Generate a concise PR summary from recent commits
---

Generate a PR summary for the last {{num_commits}} commits on this branch.

Please follow these steps:

1. Get the last {{num_commits}} commit hashes from the current branch using `git log`
2. For each commit individually:
   - Run `git diff <commit>~1 <commit>` to see what changed in that specific commit
   - Review the commit message and changes
3. After reviewing all commits, create a brief PR summary that:
   - Focuses only on the most important changes
   - Avoids unnecessary details or minor tweaks
   - Explains the key functionality added or problems solved
   - Keeps it high-level and to the point
   - Is formatted in markdown suitable for a GitHub PR description
4. Show me the PR summary for review

Note: This assumes you are on a local dev branch that differs from main.
