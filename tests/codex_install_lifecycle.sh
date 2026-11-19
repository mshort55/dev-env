#!/usr/bin/env bash
# Exercise post-create installation with persisted state and an older daemon.
set -euo pipefail

repo=$(cd "$(dirname "$0")/.." && pwd)
# The standalone installer does not link packages stored under /tmp.
base=${CODEX_REPRO_ROOT:-${XDG_CACHE_HOME:-$HOME/.cache}/dev-env-codex-repro}
mkdir -p "$base"
task_home=$(mktemp -d "$base/lifecycle.XXXXXX")
codex_bin="$task_home/.local/bin/codex"

cleanup() {
  if [ -x "$codex_bin" ]; then
    env HOME="$task_home" CODEX_HOME="$task_home/.codex" \
      "$codex_bin" app-server daemon stop >/dev/null 2>&1 || true
  fi
  rm -rf "$task_home"
}
trap cleanup EXIT

run() {
  env -u CODEX_INSTALL_DIR -u CODEX_RELEASE HOME="$task_home" \
    CODEX_HOME="$task_home/.codex" DEV_ENV_DIR="$repo" "$@"
}

post_create() {
  # Isolate the Codex step while retaining the real post-create ordering.
  run bash -s <<'EOF'
set -euo pipefail
source <(sed '$d' "$DEV_ENV_DIR/.devcontainer/dev/post-create.sh")
for step in setup_claude_settings setup_ccstatusline_settings fix_apt_sources \
  setup_shell_paths install_npm_clis install_python_deps setup_completions \
  setup_atuin setup_claude_mcp_servers bootstrap_secrets setup_codex_jira_mcp \
  setup_google_workspace_mcp setup_verification setup_and_unlock_dummy_keyring; do
  eval "$step() { :; }"
done
main
EOF
}

seed_state() {
  mkdir -p "$task_home/.codex/sessions"
  printf 'persisted session\n' >"$task_home/.codex/sessions/keep.txt"
  printf '# persisted configuration\n' >"$task_home/.codex/config.toml"
}
seed_state
curl -fsSL https://chatgpt.com/codex/install.sh -o "$task_home/installer.sh"
# Start with the image's alternate package home and a separately persisted daemon.
run env CODEX_HOME="$task_home/.local/share/codex-package" CODEX_NON_INTERACTIVE=1 \
  sh "$task_home/installer.sh" --release 0.159.2
run "$codex_bin" app-server daemon start

post_create
version=$(run "$codex_bin" --version)
if [ "$version" = 'codex-cli 0.159.2' ]; then
  echo 'post-create kept the old CLI instead of installing the latest release' >&2
  exit 1
fi

check_install() {
  local versions target
  run "$codex_bin" app-server daemon start
  target=$(readlink -f "$codex_bin")
  case "$target" in
    "$task_home/.codex/packages/standalone/"*) ;;
    *)
      echo "CLI package is outside persisted Codex state: $target" >&2
      exit 1
      ;;
  esac
  versions=$(run "$codex_bin" app-server daemon version)
  python3 -c '
import json, sys
d = json.loads(sys.argv[1])
assert d["cliVersion"] == d["managedCodexVersion"], d
if d.get("appServerVersion") is not None:
    assert d["cliVersion"] == d["appServerVersion"], d
print("CLI and daemon package:", d["cliVersion"])
' "$versions"
  grep -Fx 'persisted session' "$task_home/.codex/sessions/keep.txt"
  grep -Fx '# persisted configuration' "$task_home/.codex/config.toml"
}
check_install

# A new container loses ~/.local but keeps the host-mounted ~/.codex directory.
run "$codex_bin" app-server daemon stop
rm -rf "$task_home/.local"
post_create
check_install

# A fresh Codex home has no selected daemon package until its first start.
cleanup
task_home=$(mktemp -d "$base/lifecycle.XXXXXX")
codex_bin="$task_home/.local/bin/codex"
seed_state
post_create
check_install
printf 'ok: latest CLI and matching daemon survive container recreation\n'
