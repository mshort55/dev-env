#!/bin/sh
set -e

echo "Running ruflo post-create commands..."

# Install ruflo on first run
if [ ! -d /opt/ruflo/node_modules ]; then
    echo "Installing ruflo..."
    npm install --ignore-scripts "ruflo@${RUFLO_VERSION}" && \
    npm audit --omit=dev
fi

# Initialize ruflo on first run
if [ ! -f /opt/ruflo/.claude-flow/config.yaml ]; then
    echo "First run detected, initializing ruflo..."
    npx ruflo init --yes
fi

echo "Ruflo post-create commands complete."
