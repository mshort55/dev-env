#!/usr/bin/env bash
# Drive the KeePass bootstrap feature and write proof under the run's evidence dir.
# Usage, from anywhere: drive-bootstrap.sh /tmp/dev-env-verify-<run-id>/state.env
set -euo pipefail

STATE=${1:?usage: drive-bootstrap.sh STATE}
REAL_HOME=$(getent passwd "$(id -un)" | cut -d: -f6)

set -a
# shellcheck disable=SC1090
. "$STATE"
set +a

[ "$HOME" != "$REAL_HOME" ] || {
  echo "drive-bootstrap: HOME is the operator home" >&2
  exit 1
}
[ "$SURFACE" = "cli" ] || {
  echo "drive-bootstrap: refusing to drive surface $SURFACE" >&2
  exit 1
}

export PYTHONDONTWRITEBYTECODE=1
export GIT_CONFIG_GLOBAL
export GNUPGHOME
unset CODEX_HOME
mkdir -p "$GNUPGHOME"
chmod 700 "$GNUPGHOME"

cd "$DEV_ENV_REPO"
OUT="$EVIDENCE_DIR/bootstrap-secrets"
mkdir -p "$OUT"
PTY="$VERIFY_DIR/scripts/pty_run.py"

operator_snapshot() {
  local label=$1
  {
    echo "label=$label"
    stat -c '%n %Y' "$REAL_HOME/.gitconfig" 2>/dev/null || echo "absent $REAL_HOME/.gitconfig"
    stat -c '%n %Y' "$REAL_HOME/.bashrc" 2>/dev/null || echo "absent $REAL_HOME/.bashrc"
    stat -c '%n %Y' "$REAL_HOME/.codex" 2>/dev/null || echo "absent $REAL_HOME/.codex"
    stat -c '%n %Y' "$REAL_HOME/.ssh" 2>/dev/null || echo "absent $REAL_HOME/.ssh"
  } > "$OUT/operator-home.$label.txt"
}

operator_snapshot before

set +e
env -u KEEPASS_DB_PATH \
  HOME="$HOME" \
  GIT_CONFIG_GLOBAL="$GIT_CONFIG_GLOBAL" \
  GNUPGHOME="$GNUPGHOME" \
  PYTHONDONTWRITEBYTECODE=1 \
  "$PYTHON" scripts/bootstrap-secrets.py \
  >"$OUT/missing-env.out" 2>"$OUT/missing-env.err"
echo $? > "$OUT/missing-env.exit"
set -e
grep -F 'KEEPASS_DB_PATH environment variable not set' "$OUT/missing-env.out" >/dev/null
[ "$(cat "$OUT/missing-env.exit")" = "1" ]

set +e
KEEPASS_DB_PATH="$SCRATCH/keepass/missing.kdbx" \
  "$PYTHON" scripts/bootstrap-secrets.py \
  >"$OUT/missing-file.out" 2>"$OUT/missing-file.err"
echo $? > "$OUT/missing-file.exit"
set -e
grep -F "KeePass database not found at $SCRATCH/keepass/missing.kdbx" "$OUT/missing-file.out" >/dev/null
[ "$(cat "$OUT/missing-file.exit")" = "1" ]

set +e
"$PYTHON" "$PTY" \
  --transcript "$OUT/wrong-password.txt" \
  --timeout 20 \
  --expect 'Enter KeePass master password:' --send 'wrong-password' \
  --expect 'Enter KeePass master password:' --send 'wrong-password' \
  --expect 'Enter KeePass master password:' --send 'wrong-password' \
  --expect 'Failed to open database after 3 attempts' \
  -- \
  "$PYTHON" scripts/bootstrap-secrets.py
status=$?
set -e
echo "$status" > "$OUT/wrong-password.exit"
[ "$status" = "1" ]
grep -F 'Incorrect password. 2 attempt(s) remaining.' "$OUT/wrong-password.txt" >/dev/null
grep -F 'Incorrect password. 1 attempt(s) remaining.' "$OUT/wrong-password.txt" >/dev/null

set +e
"$PYTHON" "$PTY" \
  --transcript "$OUT/success.txt" \
  --timeout 30 \
  --expect 'Enter KeePass master password:' --send-file "$SCRATCH/password" \
  --expect 'Successfully opened KeePass database' \
  --expect 'Google Workspace MCP credentials configured' \
  --expect 'All secrets configured successfully!' \
  -- \
  "$PYTHON" scripts/bootstrap-secrets.py
status=$?
set -e
echo "$status" > "$OUT/success.exit"
[ "$status" = "0" ]

oauth="$HOME/.codex/google-workspace/oauth.env"
[ -f "$oauth" ]
mode=$(stat -c '%a' "$oauth")
dirmode=$(stat -c '%a' "$HOME/.codex/google-workspace")
[ "$mode" = "600" ]
[ "$dirmode" = "700" ]

(
  set -a
  # shellcheck disable=SC1090
  . "$oauth"
  set +a
  [ "$GOOGLE_OAUTH_CLIENT_ID" = "$OAUTH_CLIENT_ID" ]
  [ "$GOOGLE_OAUTH_CLIENT_SECRET" = "$OAUTH_CLIENT_SECRET" ]
)

if grep -F "$OAUTH_CLIENT_SECRET" "$OUT/success.txt" >/dev/null; then
  echo "drive-bootstrap: OAuth secret appeared in the transcript" >&2
  exit 1
fi
if grep -F "$KEEPASS_PASSWORD" "$OUT/success.txt" >/dev/null; then
  echo "drive-bootstrap: master password appeared in the transcript" >&2
  exit 1
fi
grep -F 'No SSH entry found in database' "$OUT/success.txt" >/dev/null
grep -F 'No GPG entry found in database' "$OUT/success.txt" >/dev/null
grep -F 'gpgsign = true' "$HOME/.gitconfig" >/dev/null
if [ -f "$HOME/.bashrc" ] && grep -F 'GOOGLE_OAUTH_CLIENT_SECRET' "$HOME/.bashrc" >/dev/null; then
  echo "drive-bootstrap: OAuth secret was exported from .bashrc" >&2
  exit 1
fi

operator_snapshot after
tail -n +2 "$OUT/operator-home.before.txt" > "$OUT/operator-home.before.stats"
tail -n +2 "$OUT/operator-home.after.txt" > "$OUT/operator-home.after.stats"
cmp "$OUT/operator-home.before.stats" "$OUT/operator-home.after.stats"

cat > "$OUT/side-effects.txt" <<EOF
oauth_env=$oauth
oauth_env_mode=$mode
oauth_dir_mode=$dirmode
oauth_values_match=yes
secret_absent_from_transcript=yes
password_absent_from_transcript=yes
missing_ssh_warning=yes
missing_gpg_warning=yes
git_gpgsign=yes
oauth_not_in_bashrc=yes
operator_home_unchanged=yes
success_exit=0
wrong_password_exit=1
missing_env_exit=1
missing_file_exit=1
EOF

printf 'drove feature=bootstrap-secrets evidence=%s\n' "$OUT"
