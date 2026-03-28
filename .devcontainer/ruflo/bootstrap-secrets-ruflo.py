#!/usr/bin/env python3
"""
Ruflo-specific secrets bootstrap. Only configures what ruflo needs.
Imports shared functions from the dev-env bootstrap-secrets.py.
"""

import importlib.util
import os
import sys
import types
from pathlib import Path

from pykeepass import PyKeePass


def load_bootstrap_secrets() -> types.ModuleType:
    dev_env_dir = Path(__file__).parent.parent.parent
    spec = importlib.util.spec_from_file_location("bootstrap_secrets", dev_env_dir / "bootstrap-secrets.py")
    assert spec and spec.loader, f"Could not load bootstrap-secrets.py from {dev_env_dir}"
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def open_database(bootstrap_secrets: types.ModuleType) -> PyKeePass:
    kdbx_path = os.environ.get('KEEPASS_DB_PATH')
    if not kdbx_path:
        print("⚠️  Error: KEEPASS_DB_PATH environment variable not set")
        sys.exit(1)

    if not os.path.exists(kdbx_path):
        print(f"⚠️  Error: KeePass database not found at {kdbx_path}")
        sys.exit(1)

    kp = bootstrap_secrets.open_keepass_database(kdbx_path)
    print("\nSuccessfully opened KeePass database\n")
    return kp


def main():
    bootstrap_secrets = load_bootstrap_secrets()
    kp = open_database(bootstrap_secrets)

    bootstrap_secrets.setup_gcloud_config(kp)
    bootstrap_secrets.setup_claude_code_env(kp)

    print("\nRuflo secrets configured successfully!")


if __name__ == '__main__':
    main()
