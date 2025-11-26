#!/bin/bash
set -e

echo "Running post-create commands..."

pip3 install --no-cache-dir pykeepass==4.1.1.post1
# npm install -g @anthropic-ai/claude-code
curl -fsSL https://claude.ai/install.sh | bash
sudo mv ~/.local/bin/claude /usr/local/bin/
python3 "${DEV_ENV_DIR}/general-setup.py"
python3 "${DEV_ENV_DIR}/bootstrap-secrets.py"

echo "Post-create commands complete."