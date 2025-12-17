---
description: Update a Jira ticket with PR details and status change
---

Update Jira ticket with the following information:

**Jira Issue:** {{jira_issue}}
**Desired Status:** {{status}}
**PR Link:** {{pr_link}}

Please follow these steps:

1. Fetch the PR description from the provided PR link using HTTP
2. Create a concise summary of the PR description
3. Generate an appropriate comment based on the status:
   - If status is "In Review" or "Review": Add a comment indicating work is completed, include the PR summary and PR link
   - If status is "In Progress": Add a comment indicating this is still work in progress, include the PR link (note: there may be multiple in progress comments)
4. Show me the proposed comment for approval before posting
5. Once I approve, use the Jira MCP server to:
   - Post the comment to the ticket
   - Add the PR link to the ticket's PR field
   - Update the ticket status to the desired status
6. Confirm when all updates are complete
