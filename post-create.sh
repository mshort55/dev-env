#!/bin/bash
set -e

echo "Running post-create commands..."

# Remove due to expired GPG key
sudo rm -f /etc/apt/sources.list.d/yarn.list

sudo apt update
pip3 install --no-cache-dir -r "${DEV_ENV_DIR}/requirements.txt"

python3 "${DEV_ENV_DIR}/general-setup.py"

if [ -n "${KEEPASS_DB_PATH}" ] && [ -f "${KEEPASS_DB_PATH}" ]; then
    python3 "${DEV_ENV_DIR}/bootstrap-secrets.py"
elif [ -z "${KEEPASS_DB_PATH}" ]; then
    echo "⚠️  KEEPASS_DB_PATH not set, skipping secrets bootstrap"
    echo "   Set KEEPASS_DB_PATH in .env to enable secrets management"
else
    echo "⚠️  KeePass database not found at ${KEEPASS_DB_PATH}, skipping secrets bootstrap"
fi

echo "Post-create commands complete."