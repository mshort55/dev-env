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
  local npm_clis_bin=""
  if [ -n "${WORKSPACE_DIR_NAME:-}" ]; then
    npm_clis_bin="/${WORKSPACE_DIR_NAME}/npm-clis/node_modules/.bin"
  fi
  export PATH="${npm_clis_bin:+$npm_clis_bin:}$HOME/.local/bin:$HOME/go/bin:$PATH"
  cat >> ~/.bashrc << EOF

# User bin paths
export PATH="${npm_clis_bin:+$npm_clis_bin:}\$HOME/.local/bin:\$HOME/go/bin:\$PATH"
EOF
}

install_npm_clis() {
  if [ -z "${WORKSPACE_DIR_NAME:-}" ]; then
    echo "WORKSPACE_DIR_NAME is unset; skipping npm CLIs"
    return 0
  fi
  local prefix="/${WORKSPACE_DIR_NAME}/npm-clis"
  if [ ! -f "${prefix}/package.json" ]; then
    echo "No ${prefix}/package.json; skipping npm CLIs"
    return 0
  fi
  npm ci --omit=dev --ignore-scripts --prefix "${prefix}"
}

setup_atuin() {
  curl -fsSL https://raw.githubusercontent.com/rcaloras/bash-preexec/master/bash-preexec.sh -o ~/.bash-preexec.sh
  cat >> ~/.bashrc << 'EOF'

# Atuin shell history
[[ -f ~/.bash-preexec.sh ]] && source ~/.bash-preexec.sh
eval "$(atuin init bash)"
EOF
}

setup_claude_mcp_servers() {
  # claude mcp add atlassian npx mcp-remote https://mcp.atlassian.com/v1/mcp
  if ! claude mcp get jira-mcp-server >/dev/null 2>&1; then
    claude mcp add --scope user jira-mcp-server python3 -- -m jira_mcp_server.main
  fi
  # `claude mcp add` always writes an empty "env": {} for the server, which
  # replaces (rather than merges with) the inherited process environment at
  # spawn time, wiping out the JIRA_* vars exported in ~/.bashrc. Drop the
  # key so the server inherits the environment normally.
  jq 'del(.mcpServers["jira-mcp-server"].env)' ~/.claude.json > ~/.claude.json.tmp \
    && mv ~/.claude.json.tmp ~/.claude.json
}

setup_google_workspace_mcp() {
  bash "${DEV_ENV_DIR}/scripts/setup-google-workspace-mcp.sh"
}

fix_apt_sources() {
  sudo rm -f /etc/apt/sources.list.d/yarn.list
  # Keep Ubuntu mirrors on HTTPS — HTTP to ports.ubuntu.com:80 can time out.
  if [ -f /etc/apt/sources.list.d/ubuntu.sources ]; then
    sudo sed -i 's|http://ports.ubuntu.com|https://ports.ubuntu.com|g' /etc/apt/sources.list.d/ubuntu.sources
  fi
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

# --- Shared Headless Keyring ---
# One D-Bus session + one gnome-keyring for ALL terminals.
# --start/--unlock are incompatible; unlock MUST run before --start.
# Daemons started inside flock MUST close fd 9 (9<&-) or they hold the
# lock forever and every new shell stalls for the flock timeout.
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/tmp/runtime-$(id -u)}"
mkdir -p "$XDG_RUNTIME_DIR"
chmod 700 "$XDG_RUNTIME_DIR"

_kr_env="$XDG_RUNTIME_DIR/keyring-session.env"
_kr_lock="$XDG_RUNTIME_DIR/keyring-session.lock"

_kr_bus_ok() {
  [ -n "${DBUS_SESSION_BUS_ADDRESS:-}" ] &&
    dbus-send --session --dest=org.freedesktop.DBus \
      --type=method_call --print-reply /org/freedesktop/DBus \
      org.freedesktop.DBus.GetId >/dev/null 2>&1
}

_kr_unlocked() {
  dbus-send --session --print-reply --dest=org.freedesktop.secrets \
    /org/freedesktop/secrets/collection/login \
    org.freedesktop.DBus.Properties.Get \
    string:org.freedesktop.Secret.Collection string:Locked 2>/dev/null |
    grep -q 'boolean false'
}

# Fast path: reuse healthy shared session (no flock).
_kr_ready=0
if [ -f "$_kr_env" ]; then
  # shellcheck disable=SC1090
  . "$_kr_env"
  if _kr_bus_ok && _kr_unlocked; then
    _kr_ready=1
  fi
fi

if [ "$_kr_ready" -eq 0 ]; then
  (
    flock -w 3 9 || exit 0

    # shellcheck disable=SC1090
    [ -f "$_kr_env" ] && . "$_kr_env"

    if ! _kr_bus_ok && type dbus-launch >/dev/null 2>&1; then
      # Close flock fd so dbus-daemon does not inherit it.
      dbus-launch --sh-syntax 9<&- > "$_kr_env"
      # shellcheck disable=SC1090
      . "$_kr_env"
    fi

    if [ -n "${DBUS_SESSION_BUS_ADDRESS:-}" ] &&
       type gnome-keyring-daemon >/dev/null 2>&1 &&
       ! _kr_unlocked; then
      # Unlock-while-running does not unlock login; restart cleanly.
      killall gnome-keyring-daemon >/dev/null 2>&1 || true
      # Empty login-keyring password required. Close fd 9 so the daemon
      # cannot keep the startup lock after this subshell exits.
      printf '\n' | gnome-keyring-daemon --unlock 9<&- >/dev/null 2>&1
      {
        cat "$_kr_env" 2>/dev/null
        gnome-keyring-daemon --start --components=secrets,ssh 9<&- 2>/dev/null
      } > "$_kr_env.tmp" && mv "$_kr_env.tmp" "$_kr_env"
    fi
  ) 9>"$_kr_lock"

  if [ -f "$_kr_env" ]; then
    # shellcheck disable=SC1090
    . "$_kr_env"
  fi
fi

unset _kr_env _kr_lock _kr_ready
unset -f _kr_bus_ok _kr_unlocked
# -----------------------------------
EOF
}

main() {
  fix_apt_sources
  setup_shell_paths
  install_npm_clis
  install_python_deps
  setup_completions
  setup_atuin
  setup_claude_mcp_servers
  setup_google_workspace_mcp
  bootstrap_secrets
  setup_and_unlock_dummy_keyring
}

main
