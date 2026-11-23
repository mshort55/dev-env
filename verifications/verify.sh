#!/usr/bin/env bash
# Run every dev-env verification, then remove the scratch home and verify image tag.
# Evidence stays in verifications/evidence/<run-id>/.
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
STATE=""
case "$#:${1:-}:${2:-}" in
  0::) mode=all ;;
  1:--bootstrap-only:) mode=bootstrap ;;
  2:--image-only:docker | 2:--image-only:podman) mode=image ;;
  *)
    echo "usage: verify.sh [--bootstrap-only | --image-only docker|podman]" >&2
    exit 2
    ;;
esac

cleanup() {
  local code=$?
  if [ -n "$STATE" ] && [ -f "$STATE" ]; then
    bash "$ROOT/scripts/cleanup.sh" "$STATE" || true
  fi
  exit "$code"
}
trap cleanup EXIT

if ! ready=$(bash "$ROOT/scripts/launch.sh" "${1:-}"); then
  printf '%s\n' "$ready" >&2
  exit 1
fi
printf '%s\n' "$ready"
STATE=${ready#*state=}
STATE=${STATE%% *}

set -a
# shellcheck disable=SC1090
. "$STATE"
set +a

if [ "$mode" != image ]; then
  bash "$ROOT/scripts/doctor.sh" "$STATE" | tee "$EVIDENCE_DIR/doctor.txt"
  bash "$ROOT/scripts/drive-bootstrap.sh" "$STATE"
fi
if [ "$mode" != bootstrap ]; then
  bash "$ROOT/scripts/build-image.sh" "$STATE" "${2:-docker}"
fi

printf 'verified evidence=%s\n' "$EVIDENCE_DIR"
