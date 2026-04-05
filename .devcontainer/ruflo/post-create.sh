#!/bin/bash
set -e
source "${DEV_ENV_DIR}/scripts/common.sh"

install_npm_packages() {
  npm install --ignore-scripts "ruflo@${RUFLO_VERSION}"
  npm install --ignore-scripts "claude-flow@${RUFLO_VERSION}"
  npm install --ignore-scripts "skills@${SKILLS_VERSION}"
  npm install --ignore-scripts "typescript@${TYPESCRIPT_VERSION}"
  npm audit --omit=dev
}

init_ruflo() {
  if [ ! -f "/opt/${RUFLO_DIR_NAME}/.claude-flow/config.yaml" ]; then
    npx ruflo init --full
  fi
}

init_git() {
  if [ ! -d "/opt/${RUFLO_DIR_NAME}/.git" ]; then
    git config --global init.defaultBranch main
    git init "/opt/${RUFLO_DIR_NAME}"
    echo node_modules >> .gitignore
  fi
}

setup_git_config() {
  git config --global user.name "Ruflo Agent"
  git config --global user.email "ruflo@agent.local"
  git config --global commit.gpgsign false
}

block_git_push() {
  git config --global url."no-push://".pushInsteadOf "git@github.com:"
  git config --global url."no-push://".pushInsteadOf "https://github.com/"
  git config --global url."no-push://".pushInsteadOf "ssh://git@github.com/"
}

symlink_repos() {
  ln -sfn "/${REPOS_DIR_NAME}" "/opt/${RUFLO_DIR_NAME}/${REPOS_DIR_NAME}"
}

bootstrap_secrets() {
  if [ -n "${KEEPASS_DB_PATH}" ] && [ -f "${KEEPASS_DB_PATH}" ]; then
    python3 "${DEV_ENV_DIR}/scripts/bootstrap-secrets-ruflo.py"
  fi
}

main() {
  install_npm_packages
  init_ruflo
  init_git
  setup_git_config
  block_git_push
  symlink_repos
  bootstrap_secrets
  enable_gopls_plugin
}

main
