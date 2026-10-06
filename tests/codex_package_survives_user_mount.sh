#!/usr/bin/env bash
# The image installs Codex during docker build. compose.yml then bind-mounts
# the operator directory over ~/.codex. The installer must leave the package
# outside that mount, or the mount hides the image copy and the CLI stays
# on whatever the operator directory already has.
set -euo pipefail

repo=$(cd "$(dirname "$0")/.." && pwd)
dockerfile="$repo/.devcontainer/dev/Dockerfile"
compose="$repo/.devcontainer/dev/compose.yml"
if ! grep -F '/.codex' "$compose" >/dev/null; then
  echo "compose.yml no longer bind-mounts ~/.codex" >&2
  exit 1
fi
# Codex refuses to link its command when the package home is under /tmp.
base=${CODEX_REPRO_ROOT:-${XDG_CACHE_HOME:-$HOME/.cache}/dev-env-codex-repro}
mkdir -p "$base"
home=$(mktemp -d "$base/home.XXXXXX")
trap 'rm -rf "$home"' EXIT

recipe=$(awk '/chatgpt.com\/codex\/install.sh/ { print; exit }' "$dockerfile")
recipe=$(printf '%s\n' "$recipe" | sed -E 's/^[[:space:]]+//; s/[[:space:]]*&&[[:space:]]*\\?[[:space:]]*$//')
if [ -z "$recipe" ]; then
  echo "codex install recipe missing from $dockerfile" >&2
  exit 1
fi

# The Dockerfile path is /home/${CONTAINER_USER}/... inside the image.
# Run the same recipe against this scratch home.
recipe=${recipe//\/home\/\$\{CONTAINER_USER\}/$home}
recipe=${recipe//\$\{HOME\}/$home}

install_sh="$home/install-codex.sh"
printf '%s\n' 'set -euo pipefail' "$recipe" > "$install_sh"
env -u CODEX_HOME HOME="$home" CODEX_NON_INTERACTIVE=1 bash "$install_sh"

link="$home/.local/bin/codex"
if [ ! -x "$link" ]; then
  echo "installer did not create $link" >&2
  exit 1
fi
before=$("$link" --version)
target=$(readlink -f "$link")

# Same effect as the compose bind mount: image contents of ~/.codex disappear.
if [ -e "$home/.codex" ] || [ -L "$home/.codex" ]; then
  mv "$home/.codex" "$home/.codex.image-layer"
fi
mkdir -p "$home/.codex"

if ! after=$("$link" --version 2>&1); then
  echo "covering ~/.codex broke codex ($before): $after" >&2
  echo "payload was $target" >&2
  exit 1
fi
if [ "$before" != "$after" ]; then
  echo "version changed after covering ~/.codex: before=$before after=$after" >&2
  exit 1
fi
case "$target" in
  "$home/.codex" | "$home/.codex"/*)
    echo "codex payload is under the user mount: $target" >&2
    exit 1
    ;;
esac

printf 'ok %s\n' "$after"
printf 'payload %s\n' "$target"
