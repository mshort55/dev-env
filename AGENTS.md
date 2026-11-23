# dev-env

- When renaming the workspace mount, follow [Setup](README.md#setup).
- When a change adds, removes, or relocates a required host file or checkout, update the [Setup checklist](README.md#setup).
- When changing environment defaults, installed tools, extensions, features, or pinned dependencies, follow [Maintenance](README.md#maintenance).
- For repository checks and host rebuilds, follow [Verification](README.md#verification).
- When changing the Dockerfile, its build arguments, or files it copies, use [verify-dev-env](.agents/skills/verify-dev-env/SKILL.md) and report the engine and evidence directory.

## Agent skills

### Issue tracker

Track issues and specs in GitHub Issues. Before reading or publishing a ticket, read `docs/agents/issue-tracker.md`.

### Triage labels

Use the five default triage roles. Before assigning a role, read `docs/agents/triage-labels.md`.

### Domain docs

This repo uses a single root glossary and `docs/adr/`. Before exploring the repo, read `docs/agents/domain.md`.
