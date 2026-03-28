#!/bin/sh
set -e

echo "Running ruflo post-create commands..."

# Install ruflo on first run
if [ ! -d "/opt/${RUFLO_DIR_NAME}/node_modules" ]; then
    echo "Installing ruflo..."
    npm install --ignore-scripts "ruflo@${RUFLO_VERSION}" && \
    npm audit --omit=dev
fi

# Initialize ruflo on first run
if [ ! -f "/opt/${RUFLO_DIR_NAME}/.claude-flow/config.yaml" ]; then
    echo "First run detected, initializing ruflo..."
    npx ruflo init --yes
fi

# Initialize git repo if not already initialized
if [ ! -d "/opt/${RUFLO_DIR_NAME}/.git" ]; then
    echo "Initializing git repository in /opt/${RUFLO_DIR_NAME}..."
    git init "/opt/${RUFLO_DIR_NAME}"
    git config --global init.defaultBranch main
    echo node_modules >> .gitignore
fi

if [ -n "${KEEPASS_DB_PATH}" ] && [ -f "${KEEPASS_DB_PATH}" ]; then
    python3 "${DEV_ENV_DIR}/.devcontainer/ruflo/bootstrap-secrets-ruflo.py"
elif [ -z "${KEEPASS_DB_PATH}" ]; then
    echo "⚠️  KEEPASS_DB_PATH not set, skipping secrets bootstrap"
else
    echo "⚠️  KeePass database not found at ${KEEPASS_DB_PATH}, skipping secrets bootstrap"
fi

git config --global user.name "Ruflo Agent"
git config --global user.email "ruflo@agent.local"
git config --global commit.gpgsign false

# Git: block all pushes (no credentials here)
git config --global url."no-push://".pushInsteadOf "git@github.com:"
git config --global url."no-push://".pushInsteadOf "https://github.com/"
git config --global url."no-push://".pushInsteadOf "ssh://git@github.com/"

echo "Ruflo post-create commands complete."
