#!/usr/bin/env bash
# Prepare one isolated dev-env verification run.
# There is no server. Each drive starts its own process against this scratch home.
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
VERIFY_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
REPO=$(cd "$VERIFY_DIR/.." && pwd)

RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$$"
SCRATCH="/tmp/dev-env-verify-${RUN_ID}"
umask 077
mkdir -p "$SCRATCH/home" "$SCRATCH/keepass" "$VERIFY_DIR/evidence/$RUN_ID"
chmod 700 "$SCRATCH" "$SCRATCH/home" "$SCRATCH/keepass"

PYTHON="python3"
if ! "$PYTHON" -c 'import pykeepass' >/dev/null 2>&1; then
  python3 -m venv "$SCRATCH/venv"
  "$SCRATCH/venv/bin/pip" install -r "$REPO/requirements.txt"
  PYTHON="$SCRATCH/venv/bin/python3"
fi

KEEPASS_PASSWORD="verify-master"
OAUTH_CLIENT_ID="verify-client-id"
OAUTH_CLIENT_SECRET="verify-client-secret"
printf '%s\n' "$KEEPASS_PASSWORD" > "$SCRATCH/password"
chmod 600 "$SCRATCH/password"

KEEPASS_DB_PATH="$SCRATCH/keepass/verify.kdbx"
KEEPASS_PASSWORD="$KEEPASS_PASSWORD" \
OAUTH_CLIENT_ID="$OAUTH_CLIENT_ID" \
OAUTH_CLIENT_SECRET="$OAUTH_CLIENT_SECRET" \
KEEPASS_DB_PATH="$KEEPASS_DB_PATH" \
"$PYTHON" - <<'PY'
import os
from pykeepass import create_database

database = create_database(os.environ["KEEPASS_DB_PATH"], password=os.environ["KEEPASS_PASSWORD"])
database.add_entry(
    database.root_group,
    "google_workspace_mcp_env_GOOGLE_OAUTH_CLIENT_ID",
    "",
    os.environ["OAUTH_CLIENT_ID"],
)
database.add_entry(
    database.root_group,
    "google_workspace_mcp_env_GOOGLE_OAUTH_CLIENT_SECRET",
    "",
    os.environ["OAUTH_CLIENT_SECRET"],
)
database.save()
PY
chmod 600 "$KEEPASS_DB_PATH"

cat > "$SCRATCH/state.env" <<EOF
RUN_ID=$RUN_ID
SURFACE=cli
FORBIDDEN_CONTAINER_NAME=dev
SCRATCH=$SCRATCH
HOME=$SCRATCH/home
GNUPGHOME=$SCRATCH/home/.gnupg
GIT_CONFIG_GLOBAL=$SCRATCH/home/.gitconfig
KEEPASS_DB_PATH=$KEEPASS_DB_PATH
KEEPASS_PASSWORD=$KEEPASS_PASSWORD
OAUTH_CLIENT_ID=$OAUTH_CLIENT_ID
OAUTH_CLIENT_SECRET=$OAUTH_CLIENT_SECRET
DEV_ENV_REPO=$REPO
VERIFY_DIR=$VERIFY_DIR
EVIDENCE_DIR=$VERIFY_DIR/evidence/$RUN_ID
PYTHON=$PYTHON
EOF
chmod 600 "$SCRATCH/state.env"

# Paths only. The password stays in the mode-600 state file.
cat > "$VERIFY_DIR/evidence/$RUN_ID/run.env" <<EOF
RUN_ID=$RUN_ID
SURFACE=cli
STATE=$SCRATCH/state.env
EVIDENCE_DIR=$VERIFY_DIR/evidence/$RUN_ID
EOF

printf 'ready state=%s evidence=%s\n' "$SCRATCH/state.env" "$VERIFY_DIR/evidence/$RUN_ID"
