# dev-env

Personal development container with pre-configured tools, languages, and secrets management.

## What's Included

**Languages & Runtimes:**
- Python 3.11
- Go 1.24
- Node.js 24.11.1

**CLI Tools:**
- GitHub CLI (`gh`)
- Google Cloud CLI (`gcloud`)
- OpenShift Client (`oc`)
- Kubernetes Client (`kubectl`)
- Docker-in-Docker
- Git, Vim, Podman

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
- `HOST_GENERAL_DIR` - Local directory containing persistent files (bash history, Claude config)
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
