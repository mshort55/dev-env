#!/usr/bin/env bash
# Read-only check that this verification scratch is safe to drive.
# Usage: doctor.sh /tmp/dev-env-verify-<run-id>/state.env
set -euo pipefail

STATE=${1:?usage: doctor.sh STATE}
if [ ! -f "$STATE" ]; then
  echo "doctor: state file missing: $STATE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$STATE"
set +a

fail() {
  echo "doctor: $*" >&2
  exit 1
}

REAL_HOME=$(getent passwd "$(id -un)" | cut -d: -f6)
case "$SCRATCH" in
  /tmp/dev-env-verify-*) ;;
  *) fail "scratch is not under /tmp/dev-env-verify-: $SCRATCH" ;;
esac
[ "$SURFACE" = "cli" ] || fail "surface is $SURFACE, want cli"
[ "$FORBIDDEN_CONTAINER_NAME" = "dev" ] || fail "forbidden container name was not recorded"
[ "$HOME" = "$SCRATCH/home" ] || fail "HOME is not the scratch home"
[ "$HOME" != "$REAL_HOME" ] || fail "HOME is the operator home"
[ "$GIT_CONFIG_GLOBAL" = "$SCRATCH/home/.gitconfig" ] || fail "git config is not inside the scratch home"
[ "$GNUPGHOME" = "$SCRATCH/home/.gnupg" ] || fail "GNUPGHOME is not inside the scratch home"
case "$KEEPASS_DB_PATH" in
  "$SCRATCH"/keepass/*.kdbx) ;;
  *) fail "KeePass path is outside the scratch keepass directory: $KEEPASS_DB_PATH" ;;
esac
[ -f "$KEEPASS_DB_PATH" ] || fail "KeePass database missing"
[ -f "$SCRATCH/password" ] || fail "password file missing"
[ -f "$DEV_ENV_REPO/scripts/bootstrap-secrets.py" ] || fail "bootstrap-secrets.py missing"
[ -f "$DEV_ENV_REPO/scripts/google-workspace-mcp.sh" ] || fail "google-workspace-mcp.sh missing"
[ -f "$DEV_ENV_REPO/scripts/setup-google-workspace-mcp.sh" ] || fail "setup-google-workspace-mcp.sh missing"
[ -f "$DEV_ENV_REPO/.env.example" ] || fail ".env.example missing"
[ -f "$DEV_ENV_REPO/.devcontainer/dev/Dockerfile" ] || fail "Dockerfile missing"
case "$EVIDENCE_DIR" in
  "$VERIFY_DIR"/evidence/*) ;;
  *) fail "evidence dir is outside the verification evidence directory" ;;
esac
[ -d "$EVIDENCE_DIR" ] || fail "evidence dir missing"

"$PYTHON" - "$KEEPASS_DB_PATH" "$KEEPASS_PASSWORD" <<'PY'
import sys
from pykeepass import PyKeePass

database = PyKeePass(sys.argv[1], password=sys.argv[2])
titles = [
    "google_workspace_mcp_env_GOOGLE_OAUTH_CLIENT_ID",
    "google_workspace_mcp_env_GOOGLE_OAUTH_CLIENT_SECRET",
]
for title in titles:
    entry = database.find_entries(title=title, first=True)
    if entry is None or not entry.password:
        raise SystemExit(f"doctor: fixture entry missing: {title}")
print("keepass=opens")
print("oauth_entries=present")
PY

printf 'surface=cli\n'
printf 'home=%s\n' "$HOME"
printf 'keepass=%s\n' "$KEEPASS_DB_PATH"
printf 'evidence=%s\n' "$EVIDENCE_DIR"
printf 'container=not-used\n'
printf 'forbidden_container_name=dev\n'
printf 'doctor=ok\n'
