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
