#!/usr/bin/env bash
set -euo pipefail

repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
uv tool install --python 3.12 --constraints "$repo/requirements/verification.txt" nox
