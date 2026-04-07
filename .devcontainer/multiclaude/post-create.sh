#!/bin/bash
set -e
source "${DEV_ENV_DIR}/scripts/common.sh"

install_npm_packages() {
  npm install --ignore-scripts "skills@${SKILLS_VERSION}"
}

disable_gpg_signing() {
  git config --global commit.gpgsign false
  git config --global tag.gpgsign false
}

symlink_repos() {
  ln -sfn "/${REPOS_DIR_NAME}" "/${MULTICLAUDE_DIR_NAME}/${REPOS_DIR_NAME}"
}

bootstrap_secrets() {
  if [ -n "${KEEPASS_DB_PATH}" ] && [ -f "${KEEPASS_DB_PATH}" ]; then
    python3 "${DEV_ENV_DIR}/scripts/bootstrap-secrets-multiclaude.py"
  fi
}

main() {
  install_npm_packages
  symlink_repos
  bootstrap_secrets
  disable_gpg_signing
  configure_claude_code
}

main
