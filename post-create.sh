#!/bin/bash
set -e

echo "Running post-create commands..."

# Remove due to expired GPG key
sudo rm -f /etc/apt/sources.list.d/yarn.list

sudo apt update
pip3 install --no-cache-dir -r "${DEV_ENV_DIR}/requirements.txt"

# claude code install
# shellcheck source=/dev/null
echo "export PATH=\"\$HOME/.local/bin:\$PATH\"" >> ~/.bashrc
curl -fsSL https://claude.ai/install.sh | bash

python3 "${DEV_ENV_DIR}/general-setup.py"
python3 "${DEV_ENV_DIR}/bootstrap-secrets.py"

echo "Post-create commands complete."