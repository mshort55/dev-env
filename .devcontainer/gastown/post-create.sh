#!/bin/bash
set -e
source "${DEV_ENV_DIR}/scripts/common.sh"

init_git() {
  if [ ! -d "/opt/${GASTOWN_DIR_NAME}/.git" ]; then
    git config --global init.defaultBranch main
    git init "/opt/${GASTOWN_DIR_NAME}"
  fi
}

setup_git_config() {
  git config --global user.name "Gastown Agent"
  git config --global user.email "gastown@agent.local"
  git config --global commit.gpgsign false
}

block_git_push() {
  git config --global url."no-push://".pushInsteadOf "git@github.com:"
  git config --global url."no-push://".pushInsteadOf "https://github.com/"
  git config --global url."no-push://".pushInsteadOf "ssh://git@github.com/"
}

symlink_repos() {
  ln -sfn "/${REPOS_DIR_NAME}" "/opt/${GASTOWN_DIR_NAME}/${REPOS_DIR_NAME}"
}

init_gastown() {
  if [ ! -d "/opt/${GASTOWN_DIR_NAME}/gt" ]; then
    gt install "/opt/${GASTOWN_DIR_NAME}/gt" --shell
  fi
}

bootstrap_secrets() {
  if [ -n "${KEEPASS_DB_PATH}" ] && [ -f "${KEEPASS_DB_PATH}" ]; then
    python3 "${DEV_ENV_DIR}/scripts/bootstrap-secrets-gastown.py"
  fi
}

main() {
  init_git
  setup_git_config
  block_git_push
  symlink_repos
  init_gastown
  bootstrap_secrets
  enable_gopls_plugin
}

main
