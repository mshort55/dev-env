#!/bin/bash
set -e
source "${DEV_ENV_DIR}/scripts/common.sh"

setup_bash_history() {
  cat >> ~/.bashrc << 'EOF'

# Enhanced bash history
export HISTSIZE=50000
export HISTFILESIZE=50000
export HISTCONTROL=ignoredups:erasedups
shopt -s histappend
PROMPT_COMMAND="history -a; history -n; $PROMPT_COMMAND"
EOF
}

setup_completions() {
  cat >> ~/.bashrc << 'EOF'

# Shell completions
source <(kubectl completion bash)
source <(oc completion bash)
eval "$(gh completion -s bash)"
source /usr/share/google-cloud-sdk/completion.bash.inc
EOF
}

setup_shell_paths() {
  export PATH="$HOME/.local/bin:$HOME/go/bin:$PATH"
  cat >> ~/.bashrc << 'EOF'

# User bin paths
export PATH="$HOME/.local/bin:$HOME/go/bin:$PATH"
EOF
}

setup_clc() {
  cat >> ~/.bashrc << EOF

# Claude session manager
source "${DEV_ENV_DIR}/scripts/clc.sh"
EOF
}

setup_claude_commands() {
  mkdir -p ~/.claude/commands
  cp "${DEV_ENV_DIR}/claude_commands/"* ~/.claude/commands/
}

setup_claude_mcp_servers() {
  # claude mcp add atlassian npx mcp-remote https://mcp.atlassian.com/v1/mcp
  claude mcp add --scope user jira-mcp-server python3 -- -m jira_mcp_server.main
}

fix_apt_sources() {
  sudo rm -f /etc/apt/sources.list.d/yarn.list
  sudo apt-get update -qq
}

install_python_deps() {
  pip3 install --break-system-packages -e /Repos/jira-mcp-server_stolostron
}

bootstrap_secrets() {
  if [ -n "${KEEPASS_DB_PATH}" ] && [ -f "${KEEPASS_DB_PATH}" ]; then
    python3 "${DEV_ENV_DIR}/scripts/bootstrap-secrets.py"
  fi
}

main() {
  fix_apt_sources
  setup_shell_paths
  install_python_deps
  setup_bash_history
  setup_completions
  setup_clc
  setup_claude_commands
  setup_claude_mcp_servers
  bootstrap_secrets
  configure_claude_code
}

main
