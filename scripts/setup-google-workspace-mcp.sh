#!/bin/bash
set -euo pipefail

dev_env_dir="${DEV_ENV_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
workspace_config_dir="${CODEX_HOME:-$HOME/.codex}/google-workspace"
export PATH="$HOME/.local/bin:$PATH"
: "${WORKSPACE_MCP_VERSION:?Set WORKSPACE_MCP_VERSION from dev-env .env before configuring Google Workspace MCP}"

if ! command -v uv >/dev/null 2>&1; then
  : "${UV_VERSION:?Set UV_VERSION from dev-env .env before installing uv}"
  curl -fsSL "https://astral.sh/uv/${UV_VERSION}/install.sh" | sh
fi

# Install before Codex starts so downloads do not consume the MCP startup timeout.
uv tool install "workspace-mcp==${WORKSPACE_MCP_VERSION}"
install -d -m 700 "$workspace_config_dir" "$workspace_config_dir/credentials-read-only"

codex mcp add --env "WORKSPACE_MCP_VERSION=${WORKSPACE_MCP_VERSION}" google-workspace -- bash "$dev_env_dir/scripts/google-workspace-mcp.sh"

if [ ! -f "$workspace_config_dir/oauth.env" ]; then
  echo "Google Workspace MCP registered; OAuth client credentials are not loaded yet. Run scripts/bootstrap-secrets.py to create $workspace_config_dir/oauth.env from KeePass."
fi
