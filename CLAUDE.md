# Claude Code Configuration - dev-env

## Project Overview

Personal development container infrastructure that provisions isolated, containerized dev environments. Two container types exist:

- **Dev container** (`.devcontainer/dev/`) — Full Ubuntu 24.04 workstation with Python 3.11, Go 1.24, Node.js 24.11.1, and CLI tools (gcloud, kubectl, oc, gh, aws, kind, yq, hcp)
- **Ruflo container** (`.devcontainer/ruflo/`) — Lightweight Node 24 Alpine container for AI agent orchestration with push-blocking and minimal secrets

## Architecture

```
dev-env/
├── .devcontainer/
│   ├── dev/                    # Human developer container
│   │   ├── Dockerfile          # Ubuntu 24.04 + all dev tools
│   │   ├── devcontainer.json   # VS Code features: Python, Go, Node, Rust
│   │   ├── post-create.sh      # Runs general-setup.py + bootstrap-secrets.py
│   │   └── dev-compose.yml     # Volume mounts for host directories
│   └── ruflo/                  # AI agent container
│       ├── Dockerfile          # Node 24 Alpine (lightweight)
│       ├── devcontainer.json   # VS Code Ruflo workspace config
│       ├── post-create.sh      # ruflo init, git setup, symlinks, push-blocking
│       ├── ruflo-compose.yml   # Agent-specific env vars and mounts
│       └── bootstrap-secrets-ruflo.py  # Minimal secrets (gcloud + Claude only)
├── claude_commands/            # Custom Claude Code slash commands
│   ├── commit-summary.md       # Generate PR summaries from commits
│   ├── multicluster-role-assignment-release.md  # Release CI setup (8-step)
│   └── update-jira.md          # Update Jira tickets from PR status
├── bootstrap-secrets.py        # Full secrets extraction from KeePass DB
├── general-setup.py            # Shell env setup (history, completions, PATH, tools)
├── docker-compose.env-bridge.yml  # Loads .env vars for compose services
├── requirements.txt            # Python deps for KeePass/crypto
└── .env                        # User-specific config (not in git)
```

## How It Works

### Startup Flow

1. VS Code opens repo → "Reopen in Container"
2. Docker builds image from Dockerfile (tools, runtimes)
3. Compose mounts host directories (repos, binaries, persistent config)
4. `post-create.sh` runs automatically:
   - **Dev**: `general-setup.py` (shell config) → `bootstrap-secrets.py` (all credentials from KeePass)
   - **Ruflo**: npm install → `ruflo init --full` → `bootstrap-secrets-ruflo.py` (minimal secrets) → git push-blocking

### Secrets Management

Credentials are extracted at startup from a KeePass `.kdbx` database (path set via `KEEPASS_DB_PATH` env var). The user is prompted for their master password.

**bootstrap-secrets.py** (dev container — full set):

| KeePass Entry | Destination | Purpose |
|---------------|-------------|---------|
| `ssh` | `~/.ssh/id_ed25519[.pub]` | SSH authentication |
| `gpg` | GPG keyring | Commit signing |
| `git_user_email`, `git_user_name`, `git_signingkey` | git global config | Git identity |
| `.config/gcloud/*` (3 entries) | `~/.config/gcloud/` | Google Cloud auth |
| `.config/gh/hosts.yml` | `~/.config/gh/` | GitHub CLI auth |
| `.docker/config.json` | `~/.docker/` | Docker registry auth |
| `claude_env_*` | `.bashrc` exports | Claude Code config |
| `jira_env_*` | `.bashrc` exports | Jira API access |
| `kube_env_*` | `.bashrc` exports | Kubernetes contexts |

**bootstrap-secrets-ruflo.py** (ruflo container — minimal):
- Only extracts gcloud config and Claude Code env vars
- No SSH, GPG, Docker, GitHub CLI, or Jira credentials

### Environment Variables (.env)

All container config lives in `.env` (not committed). Key variables:

- `CONTAINER_USER` / `CONTAINER_UID` — Container user identity
- `HOST_GENERAL_DIR` — Persistent files (bash history, .claude config)
- `HOST_REPOS_DIR` — Git repositories directory
- `HOST_WORKSPACE_DIR` — Synced workspace (contains KeePass DB)
- `HOST_BINARIES_DIR` — Pre-built binary archives
- `HOST_RUFLO_DIR` / `HOST_RUFLO_CLAUDE_DIR` — Ruflo installation and config
- `KEEPASS_DB_PATH` — KeePass database location inside container
- `RUFLO_VERSION` — Ruflo npm package version

### Docker Compose Pattern

The env-bridge pattern separates concerns:
- `docker-compose.env-bridge.yml` — Loads `.env` variables (shared)
- `dev-compose.yml` — Dev container service definition
- `ruflo-compose.yml` — Ruflo container service definition

## Behavioral Rules

- NEVER hardcode secrets, API keys, or credentials — all secrets come from KeePass
- NEVER modify `.env` without explicit user approval — it contains host-specific paths
- NEVER push from the Ruflo container — git push is blocked by design (`no-push://` redirect)
- Always test bootstrap scripts with missing KeePass entries — they must degrade gracefully
- Keep bootstrap-secrets-ruflo.py minimal — the Ruflo container should have the smallest secret surface possible

## Key Design Decisions

1. **Two containers, two trust levels**: Dev gets all secrets; Ruflo gets only what agents need
2. **KeePass as single source of truth**: No secrets in files, images, or env — extracted fresh each startup
3. **Graceful degradation**: Missing KeePass DB or entries produce warnings, not failures
4. **Push-blocking for agents**: Ruflo's git config redirects all pushes to `no-push://` to prevent accidental commits from AI agents
5. **Persistent volumes**: Bash history, `.claude` config, and binaries survive container rebuilds via host mounts

## Claude Commands

Custom commands are copied to `~/.claude/commands/` during setup (via `general-setup.py`):

- `/commit-summary` — Generates a markdown PR summary from recent git commits
- `/multicluster-role-assignment-release` — 8-step CI configuration for release branches (version format: "2.16" in configs, "216" in Prow contexts, "release-2.16" for branches)
- `/update-jira` — Fetches PR details, generates status comment, posts to Jira ticket with user approval

## Working with bootstrap-secrets.py

When modifying the secrets bootstrap:
- Each `setup_*` function is independent — failures in one don't affect others
- `add_env_vars_to_shell_profile()` appends to `.bashrc` (Alpine: `.ashrc`) with section comment headers
- SSH keys: password field = private key, notes field = public key
- gcloud `credentials.db` is a binary file stored as a KeePass attachment (not in password field)
- GPG setup includes configuring `gpg-agent` for loopback pinentry mode

## Dependencies (requirements.txt)

All for KeePass integration: `pykeepass` (KDBX reader), `pycryptodomex` (crypto), `argon2-cffi` (password hashing), `lxml` (XML parsing), `construct` (binary parsing), `pyotp` (OTP support).
