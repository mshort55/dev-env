#!/usr/bin/env bash
# Remove the scratch home, KeePass fixture, and verify image tag for one run.
# Evidence under verifications/evidence is left in place.
# Usage: cleanup.sh /tmp/dev-env-verify-<run-id>/state.env
set -euo pipefail

STATE=${1:?usage: cleanup.sh STATE}
if [ ! -f "$STATE" ]; then
  echo "cleanup: state file missing: $STATE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$STATE"
set +a

case "$SCRATCH" in
  /tmp/dev-env-verify-*) ;;
  *)
    echo "cleanup: refusing to delete $SCRATCH" >&2
    exit 1
    ;;
esac
[ -n "$HOME" ] && [ "$HOME" = "$SCRATCH/home" ] || {
  echo "cleanup: HOME is not inside the scratch directory" >&2
  exit 1
}
[ -n "$EVIDENCE_DIR" ] && [ -d "$EVIDENCE_DIR" ] || {
  echo "cleanup: evidence dir missing; refusing to delete scratch before proof is stored" >&2
  exit 1
}
case "$EVIDENCE_DIR" in
  "$SCRATCH"*)
    echo "cleanup: evidence dir is inside the scratch directory" >&2
    exit 1
    ;;
esac

if [ -f "$SCRATCH/image-tag" ]; then
  tag=$(cat "$SCRATCH/image-tag")
  engine=$(cat "$SCRATCH/image-engine" 2>/dev/null || true)
  case "$tag" in
    dev-env:verify-*)
      if [ -n "$engine" ] && command -v "$engine" >/dev/null 2>&1; then
        "$engine" rmi "$tag" >/dev/null 2>&1 || true
      fi
      ;;
    *)
      echo "cleanup: refusing to remove image tag $tag" >&2
      exit 1
      ;;
  esac
fi

if [ -d "$SCRATCH/pids" ]; then
  for pid_file in "$SCRATCH/pids"/*; do
    [ -f "$pid_file" ] || continue
    pid=$(cat "$pid_file")
    if [ -d "/proc/$pid" ] && tr '\0' '\n' < "/proc/$pid/environ" | grep -Fxq "SCRATCH=$SCRATCH"; then
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
    fi
  done
fi

rm -rf "$SCRATCH"
printf 'cleaned scratch=%s evidence=%s\n' "$SCRATCH" "$EVIDENCE_DIR"
