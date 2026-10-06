#!/usr/bin/env bash
# Run every dev-env verification, then remove the scratch home and verify image tag.
# Evidence stays in verifications/evidence/<run-id>/.
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
STATE=""

cleanup() {
  local code=$?
  if [ -n "$STATE" ] && [ -f "$STATE" ]; then
    bash "$ROOT/scripts/cleanup.sh" "$STATE" || true
  fi
  exit "$code"
}
trap cleanup EXIT

if ! ready=$(bash "$ROOT/scripts/launch.sh"); then
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

bash "$ROOT/scripts/doctor.sh" "$STATE" | tee "$EVIDENCE_DIR/doctor.txt"
bash "$ROOT/scripts/drive-bootstrap.sh" "$STATE"
bash "$ROOT/scripts/build-image.sh" "$STATE"

printf 'verified evidence=%s\n' "$EVIDENCE_DIR"
