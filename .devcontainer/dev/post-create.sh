#!/bin/bash
set -e
source "${DEV_ENV_DIR}/scripts/common.sh"

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

setup_atuin() {
  curl -fsSL https://raw.githubusercontent.com/rcaloras/bash-preexec/master/bash-preexec.sh -o ~/.bash-preexec.sh
  cat >> ~/.bashrc << 'EOF'

# Atuin shell history
[[ -f ~/.bash-preexec.sh ]] && source ~/.bash-preexec.sh
eval "$(atuin init bash)"
EOF
}

setup_clc() {
  cat >> ~/.bashrc << 'EOF'

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

setup_and_unlock_dummy_keyring() {
  cat >> ~/.bashrc << 'EOF'

# --- Headless Keyring Auto-Start ---
# 1. Launch D-Bus if not already running in this session
if [ -z "$DBUS_SESSION_BUS_ADDRESS" ] && type dbus-launch >/dev/null 2>&1; then
    eval "$(dbus-launch --sh-syntax)"
fi

# 2. Start and unlock gnome-keyring if it isn't already active
if [ -n "$DBUS_SESSION_BUS_ADDRESS" ] && type gnome-keyring-daemon >/dev/null 2>&1; then
    eval "$(echo "" | gnome-keyring-daemon --unlock 2>/dev/null)"
    eval "$(echo "" | gnome-keyring-daemon --start 2>/dev/null)"
fi
# -----------------------------------
EOF
}

main() {
  fix_apt_sources
  setup_shell_paths
  install_python_deps
  setup_completions
  setup_atuin
  setup_clc
  setup_claude_commands
  setup_claude_mcp_servers
  bootstrap_secrets
  configure_claude_code
  setup_and_unlock_dummy_keyring
}

main
