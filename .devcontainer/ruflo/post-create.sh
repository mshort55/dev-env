#!/bin/sh
set -e

echo "Running ruflo post-create commands..."

# npm installations
echo "Installing ruflo..."
npm install --ignore-scripts "ruflo@${RUFLO_VERSION}"
npm install --ignore-scripts "claude-flow@${RUFLO_VERSION}"

echo "Installing skills..."
npm install --ignore-scripts "skills@${SKILLS_VERSION}"

echo "Installing typescript..."
npm install --ignore-scripts "typescript@${TYPESCRIPT_VERSION}"
    
npm audit --omit=dev

# Initialize ruflo on first run
if [ ! -f "/opt/${RUFLO_DIR_NAME}/.claude-flow/config.yaml" ]; then
    echo "First run detected, initializing ruflo..."
    npx ruflo init --full
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

# Symlink repos dir into ruflo workspace - this helps agents get to repos
if [ ! -L "/opt/${RUFLO_DIR_NAME}/${REPOS_DIR_NAME}" ]; then
    ln -s "/${REPOS_DIR_NAME}" "/opt/${RUFLO_DIR_NAME}/${REPOS_DIR_NAME}"
fi

# Git configs
git config --global user.name "Ruflo Agent"
git config --global user.email "ruflo@agent.local"
git config --global commit.gpgsign false

# Git: block all pushes
git config --global url."no-push://".pushInsteadOf "git@github.com:"
git config --global url."no-push://".pushInsteadOf "https://github.com/"
git config --global url."no-push://".pushInsteadOf "ssh://git@github.com/"

echo "Ruflo post-create commands complete."
