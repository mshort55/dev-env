#!/usr/bin/env bash
# Install after the host Codex directory is mounted; keep both packages current.
set -euo pipefail

codex_dir=${CODEX_HOME:-$HOME/.codex}
codex_bin="$HOME/.local/bin/codex"
mkdir -p "$codex_dir"

# Resolve latest on every container creation, outside the image build cache.
curl -fsSL https://chatgpt.com/codex/install.sh |
  CODEX_HOME="$codex_dir" CODEX_INSTALL_DIR="$HOME/.local/bin" \
    CODEX_NON_INTERACTIVE=1 sh -s -- --release latest

# The daemon keeps its own package selection across container rebuilds.
# With no selected package, its first start installs from the current CLI.
if [ -e "$codex_dir/packages/app-server-daemon/current" ]; then
  CODEX_HOME="$codex_dir" "$codex_bin" app-server daemon update --from-cli --yes
fi

"$codex_bin" --version
