# Claude Code Configuration - dev-env

## Project Overview

Personal development container infrastructure centered on a single active dev container in `.devcontainer/dev/`.

Retired `multiclaude` and `ruflo` assets are preserved under `archive/` using the same repository-relative layout they originally had, so they are easy to restore later.

## Architecture

```
dev-env/
├── .devcontainer/
│   └── dev/
│       ├── Dockerfile              # Ubuntu 24.04 workstation image
│       ├── compose.yml             # Active compose service definition
│       ├── devcontainer.json       # VS Code container entrypoint
│       └── post-create.sh          # Shell/tooling/bootstrap setup
├── archive/
│   ├── .devcontainer/
│   │   ├── multiclaude/            # Archived multiclaude container config
│   │   └── ruflo/                  # Archived ruflo container config
│   ├── scripts/
│   │   ├── bootstrap-secrets-multiclaude.py
│   │   └── bootstrap-secrets-ruflo.py
│   └── README.md                   # Restore notes for archived stacks
├── claude_commands/                # Custom Claude Code slash commands
├── scripts/
│   ├── bootstrap-secrets.py        # Active KeePass bootstrap
│   ├── clc.sh                      # Claude session helper
│   └── common.sh                   # Shared shell helpers
├── docker-compose.env-bridge.yml   # Loads `.env` for compose
├── requirements.txt                # Python deps for KeePass integration
└── .env                            # User-specific config (gitignored)
```

## How It Works

### Startup Flow

1. VS Code opens the repo and reopens in the `dev` container.
2. Docker builds `.devcontainer/dev/Dockerfile`.
3. Compose mounts host directories defined in `.env`.
4. `.devcontainer/dev/post-create.sh` runs to:
   - fix apt source drift
   - install the local Jira MCP dependency
   - configure shell paths, history, completions, and Atuin
   - wire in `clc.sh` and custom Claude commands
   - bootstrap secrets from KeePass when available
   - apply Claude Code settings via `scripts/common.sh`

Archived `multiclaude` and `ruflo` definitions are kept only for future restoration. They are not part of the active startup path.

### Secrets Management

Credentials are extracted at startup from a KeePass `.kdbx` database when `KEEPASS_DB_PATH` points to an existing file.

`scripts/bootstrap-secrets.py` configures:

| KeePass Entry | Destination | Purpose |
|---------------|-------------|---------|
| `ssh` | `~/.ssh/id_ed25519[.pub]` | SSH authentication |
| `gpg` | GPG keyring | Commit signing |
| `git_user_email`, `git_user_name`, `git_signingkey` | git global config | Git identity |
| `.config/gcloud/*` (3 entries) | `~/.config/gcloud/` | Google Cloud auth |
| `.config/gh/hosts.yml` | `~/.config/gh/` | GitHub CLI auth |
| `.docker/config.json` | `~/.docker/` | Docker registry auth |
| `claude_env_*` | shell profile exports | Claude Code config |
| `jira_mcp_env_*` | shell profile exports | Jira API access |
| `kube_env_*` | shell profile exports | Kubernetes contexts |

### Environment Variables (`.env`)

The active `.env` surface now covers only the live dev container:

- `GENERAL_DIR_NAME`, `REPOS_DIR_NAME`, `WORKSPACE_DIR_NAME`, `BINARIES_DIR_NAME`
- `HOST_GENERAL_DIR`, `HOST_REPOS_DIR`, `HOST_WORKSPACE_DIR`, `HOST_BINARIES_DIR`
- `HOST_DEV_*` directories for Claude, Cursor, Codex, Atuin, and Zellij persistence
- `CONTAINER_USER`, `CONTAINER_UID`
- `DEV_ENV_DIR`, `KEEPASS_DB_PATH`
- shared tool versions still used by `.devcontainer/dev/`

Retired `ruflo` and `multiclaude` variables live in a commented `Archived` section at the bottom of `.env` and `.env.example`.

### Docker Compose Pattern

The compose setup separates shared env loading from the active service definition:

- `docker-compose.env-bridge.yml` - shared `.env` loader
- `.devcontainer/dev/compose.yml` - active dev container
- `archive/.devcontainer/*/compose.yml` - preserved retired definitions

## Behavioral Rules

- NEVER hardcode secrets, API keys, or credentials - all secrets come from KeePass
- NEVER modify `.env` without explicit user approval - it contains host-specific paths
- Always test bootstrap scripts with missing KeePass entries - they must degrade gracefully
- Keep archived `multiclaude` and `ruflo` files under `archive/` with their original relative layout so restoration stays obvious

## Key Design Decisions

1. **Single active container**: the repo now optimizes for the day-to-day `dev` environment only
2. **KeePass as single source of truth**: no secrets are committed to the repo or baked into images
3. **Graceful degradation**: missing KeePass files or entries warn instead of crashing unrelated setup
4. **Archive instead of delete**: retired agent/container setups stay in-repo under `archive/` so they can be restored without guesswork
5. **Persistent host mounts**: shell history, Claude config, Cursor config, Codex config, and tool caches survive rebuilds

## Claude Commands

Custom commands are copied to `~/.claude/commands/` during dev container setup:

- `/commit-summary` - Generates a markdown PR summary from recent git commits
- `/multicluster-role-assignment-release` - 8-step CI configuration for release branches
- `/update-jira` - Fetches PR details, generates a status comment, and prepares a Jira update

## Working with `scripts/bootstrap-secrets.py`

When modifying the active secrets bootstrap:

- Each `setup_*` function is independent, so one failure does not block the rest
- `add_env_vars_to_shell_profile()` appends to `.bashrc` (or `.ashrc` when bash is unavailable)
- SSH keys use the KeePass password field for the private key and notes for the public key
- gcloud `credentials.db` is stored as a KeePass attachment
- GPG setup enables loopback pinentry for non-interactive use

## Dependencies (`requirements.txt`)

All Python dependencies support KeePass access and related crypto/parsing: `pykeepass`, `pycryptodomex`, `argon2-cffi`, `lxml`, `construct`, and `pyotp`.
