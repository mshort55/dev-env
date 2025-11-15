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

## Quick Start

1. Open this folder in VS Code
2. When prompted, click "Reopen in Container"
3. Enter your KeePass master password when the bootstrap script runs
4. Start coding

The container automatically configures SSH keys, GPG, git, gcloud, GitHub CLI, and other credentials from your KeePass database on first startup.

## How It Works

- **Dockerfile**: Base Ubuntu 24.04 image with all tools installed
- **docker-compose.yml**: Mounts `~/UbuntuSync` and `~/Repos` into the container
- **devcontainer.json**: VS Code dev container configuration
- **bootstrap-secrets.py**: Reads secrets from `/UbuntuSync/dev-env.kdbx` and configures:
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
