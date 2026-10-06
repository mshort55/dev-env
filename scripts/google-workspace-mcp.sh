#!/bin/bash
set -euo pipefail

workspace_config_dir="${CODEX_HOME:-$HOME/.codex}/google-workspace"
oauth_env="$workspace_config_dir/oauth.env"

if [ ! -f "$oauth_env" ]; then
  echo "Google Workspace OAuth client file is missing: $oauth_env. Run dev-env/scripts/bootstrap-secrets.py to load the client ID and secret from KeePass." >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$oauth_env"
: "${GOOGLE_OAUTH_CLIENT_ID:?Google OAuth client ID is missing}"
: "${GOOGLE_OAUTH_CLIENT_SECRET:?Google OAuth client secret is missing}"
export GOOGLE_OAUTH_CLIENT_ID GOOGLE_OAUTH_CLIENT_SECRET
export WORKSPACE_MCP_CREDENTIALS_DIR="$workspace_config_dir/credentials-read-only"
export PATH="$HOME/.local/bin:$PATH"
: "${WORKSPACE_MCP_VERSION:?Run dev-env/scripts/setup-google-workspace-mcp.sh to configure the MCP version}"

exec uvx "workspace-mcp@${WORKSPACE_MCP_VERSION}" --transport stdio --tools drive docs sheets slides --read-only
