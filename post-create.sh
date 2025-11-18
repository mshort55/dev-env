#!/bin/bash
set -e

echo "Running post-create commands..."

pip3 install --no-cache-dir pykeepass
npm install -g @anthropic-ai/claude-code
python3 /Repos/dev-env/general-setup.py
python3 /Repos/dev-env/bootstrap-secrets.py

echo "Post-create commands complete."