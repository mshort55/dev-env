# dev-env

Personal development container with pre-configured tools, languages, and secrets management.

## What's Included

**Languages & Runtimes:**
- Python 3.12 (Ubuntu 24.04 packages)
- Go and Node.js 24 (versions in `.env.example`)

**CLI Tools:**
- GitHub CLI (`gh`)
- Google Cloud CLI (`gcloud`)
- OpenShift Client (`oc`)
- Kubernetes Client (`kubectl`)
- Docker-in-Docker
- Git, Vim, Podman

**Agent CLIs:**
- Claude Code
- Cursor Agent
- OpenAI Codex

**VS Code Extensions:**
- Claude Code
- Python + debugpy
- Go
- GitLens
- ESLint, Prettier
- Vim keybindings

## Configuration

The `.env` file contains all configuration for the dev container. You may need to customize these variables for your environment:

**Container User Configuration:**
- `CONTAINER_USER` - Username inside the container
- `CONTAINER_UID` - User ID inside the container

**Directory Names:**
- `GENERAL_DIR_NAME` - Name for general files directory (used on both host and container)
- `REPOS_DIR_NAME` - Name for repositories directory (used on both host and container)
- `WORKSPACE_DIR_NAME` - Name for workspace sync directory (used on both host and container)

**Host Paths:**
- `HOST_GENERAL_DIR` - Local directory containing persistent files (bash history, Claude/Cursor/Codex config)
- `HOST_REPOS_DIR` - Local directory containing your git repositories
- `HOST_WORKSPACE_DIR` - Local directory containing your KeePass database and synced files

**Container Paths:**
- `DEV_ENV_DIR` - Where this dev-env repository is located inside the container
- `KEEPASS_DB_PATH` - Where the KeePass database is located inside the container

## Quick Start

1. Open this folder in VS Code
2. When prompted, click "Reopen in Container"
3. Enter your KeePass master password when the bootstrap script runs

The container automatically configures SSH keys, GPG, git, gcloud, GitHub CLI, and other credentials from your KeePass database on first startup.

## How It Works

- **Dockerfile**: Base Ubuntu 24.04 image with all tools installed
- **docker-compose.yml**: Mounts your host directories (configured in `.env`) into the container
- **devcontainer.json**: VS Code dev container configuration
- **general-setup.py**: Configures general shell environment:
  - Enhanced bash history (50k entries, persistent across sessions)
  - Shell completions (kubectl, oc, gcloud, gh)
- **bootstrap-secrets.py**: Reads secrets from your KeePass database (path configured in `.env`) and configures:
  - SSH keys (`~/.ssh/id_ed25519`)
  - GPG keys (imported and configured)
  - Git configuration (user, email, signing key)
  - gcloud authentication and configuration
  - GitHub CLI authentication
  - Docker/Podman configuration
  - Claude Code environment variables
  - Kubernetes context variables

Kubernetes cluster targets are loaded from KeePass entries named `kube_env_THREE_NODE`, `kube_env_KC`, and `kube_env_OME`, then exported into your shell as `THREE_NODE`, `KC`, and `OME`.
Those KeePass values can be stored either as raw `oc login ...` commands or wrapped in a single pair of shell quotes; the bootstrap normalizes both forms.
After adding or changing those KeePass entries, rerun `python3 scripts/bootstrap-secrets.py` inside the container to refresh your shell profile.

Jira MCP is installed from `/Repos/jira-mcp-server_stolostron` and registered with
Claude and Codex during container setup. Codex forwards `JIRA_SERVER_URL`,
`JIRA_ACCESS_TOKEN`, and `JIRA_EMAIL` from its environment; KeePass supplies these
through your shell profile. Start Codex from a new container terminal after bootstrap.
To register it in an existing container, run `bash "$DEV_ENV_DIR/scripts/setup-jira-mcp.sh"`,
then restart Codex. Repeated setup preserves an existing `jira` server configuration.

## Host Setup (macOS with Podman)

1. Install Podman Desktop
2. Set up Podman VM (may need krunkit):
   ```bash
   brew tap slp/krunkit
   brew install krunkit
   ```
3. Increase Podman VM resources:
   - CPU: 8 cores
   - Memory: 30GB
   - Disk: 480GB
4. Install VS Code and the Dev Containers extension
5. Configure VS Code to use Podman:
   ```bash
   vim "$HOME/Library/Application Support/Code/User/settings.json"
   ```
   Add: `"dev.containers.dockerPath": "podman"`
6. Set up Compose for Podman in Podman Desktop app

## Updating software

Update version variables in both `.env.example` and your local `.env`; preserve local paths and credentials.
The Dockerfile pins Ubuntu 24.04 by digest. `devcontainer.json` pins Docker/Moby,
Buildx, and VS Code extensions; regenerate `devcontainer-lock.json` when
changing a feature. `DOCKER_COMPOSE_VERSION` in `.env` controls both `docker compose`
and `docker-compose`.
The feature's Compose installer is disabled to keep this as the only Compose version.
`installDockerBuildx: false` disables the feature's second, floating GitHub download;
Moby still installs Buildx at the exact `mobyBuildxVersion` package pin.
The external `/UbuntuSync/npm-clis/package.json` and its lockfile own pnpm, Repomix,
and skills; startup installs them with `npm ci`.

Ubuntu packages still receive repository updates at image build time.
Google Cloud CLI, GitHub CLI, and AWS CLI continue to follow their existing release
channels. The local Jira source checkout remains editable.

Python dependencies target the container's Python 3.12. Update `requirements.in`
and `requirements/workspace-mcp.in` (matching `WORKSPACE_MCP_VERSION`), then regenerate:

```bash
uv pip compile --python-version 3.12 --generate-hashes -o requirements.txt requirements.in
uv pip compile --python-version 3.12 --generate-hashes -o requirements/workspace-mcp.txt requirements/workspace-mcp.in
uv pip compile --python-version 3.12 --generate-hashes -o requirements/jira-mcp.txt ../jira-mcp-server_stolostron/pyproject.toml requirements/jira-build.in requirements.in
```

The base and Jira installs require the recorded hashes. Jira's editable install
uses the locked build backend without resolving additional dependencies. Workspace
MCP uses the same dependency constraints during setup and launch.

After completing updates, run:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -v
bash tests/codex_package_survives_user_mount.sh
PYTHONDONTWRITEBYTECODE=1 bash verifications/verify.sh
```

The verification workflow uses disposable credentials and builds a temporary image.
The Docker feature and Workspace MCP also need isolated smoke tests because the
Dockerfile-only build does not run devcontainer features or post-create setup.
