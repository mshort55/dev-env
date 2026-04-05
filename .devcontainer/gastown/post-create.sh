#!/bin/bash
set -e
source "${DEV_ENV_DIR}/scripts/common.sh"

init_git() {
  if [ ! -d "/opt/${GASTOWN_DIR_NAME}/.git" ]; then
    git config --global init.defaultBranch main
    git init "/opt/${GASTOWN_DIR_NAME}"
  fi
}

disable_gpg_signing() {
  git config --global commit.gpgsign false
  git config --global tag.gpgsign false
}

symlink_repos() {
  ln -sfn "/${REPOS_DIR_NAME}" "/opt/${GASTOWN_DIR_NAME}/${REPOS_DIR_NAME}"
}

init_gastown() {
  if [ ! -f "/opt/${GASTOWN_DIR_NAME}/gt/mayor/town.json" ]; then
    gt install "/opt/${GASTOWN_DIR_NAME}/gt" --shell
    cd "/opt/${GASTOWN_DIR_NAME}/gt" && gt git-init && cd -
  fi
}

bootstrap_secrets() {
  if [ -n "${KEEPASS_DB_PATH}" ] && [ -f "${KEEPASS_DB_PATH}" ]; then
    python3 "${DEV_ENV_DIR}/scripts/bootstrap-secrets-gastown.py"
  fi
}

main() {
  init_git
  symlink_repos
  bootstrap_secrets
  init_gastown
  disable_gpg_signing
  configure_claude_code
}

main
