#!/bin/bash
set -euo pipefail

export PATH="$HOME/.local/bin:$PATH"
codex_dir="${CODEX_HOME:-$HOME/.codex}"
umask 077
mkdir -p "$codex_dir"

if codex mcp get jira >/dev/null 2>&1; then
  echo "Jira MCP is already registered with Codex; keeping its configuration."
  exit 0
fi

# Reject an invalid existing config before appending a new server.
codex mcp list >/dev/null

# The CLI's --env option stores values; env_vars forwards names from the shell.
cat >> "$codex_dir/config.toml" <<'EOF'

[mcp_servers.jira]
command = "python3"
args = ["-m", "jira_mcp_server.main"]
env_vars = ["JIRA_SERVER_URL", "JIRA_ACCESS_TOKEN", "JIRA_EMAIL"]
startup_timeout_sec = 60
EOF

codex mcp get jira >/dev/null
echo "Jira MCP registered with Codex. Start Codex from a shell with the KeePass-loaded JIRA_* variables."
