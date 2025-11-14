#!/usr/bin/env python3
"""
Bootstrap secrets from KeePass database into container.
This script runs once on container creation to set up ephemeral secrets.
"""

import os
import sys
import getpass
from pathlib import Path
from pykeepass import PyKeePass


def setup_ssh_keys(kp: PyKeePass):
    print("Setting up SSH keys...")

    entry = kp.find_entries(title='ssh', first=True)
    if not entry:
        print("Warning: No SSH entry found in database")
        return

    ssh_dir = Path.home() / '.ssh'
    ssh_dir.mkdir(mode=0o700, exist_ok=True)

    private_key_path = ssh_dir / 'id_ed25519'
    private_key_path.write_text(entry.password)
    private_key_path.chmod(0o600)

    public_key_path = ssh_dir / 'id_ed25519.pub'
    public_key_path.write_text(entry.notes)
    public_key_path.chmod(0o644)

    print(f"SSH keys configured at {ssh_dir}")


def main():
    kdbx_path = '/UbuntuSync/dev-env.kdbx'

    if not os.path.exists(kdbx_path):
        print(f"Error: KeePass database not found at {kdbx_path}")
        sys.exit(1)

    # Prompt for master password
    try:
        master_password = getpass.getpass("Enter KeePass master password: ")
    except KeyboardInterrupt:
        print("\nBootstrap cancelled")
        sys.exit(1)

    try:
        kp = PyKeePass(kdbx_path, password=master_password)
    except Exception as e:
        print(f"Error: Failed to open database: {e}")
        sys.exit(1)

    print("\nSuccessfully opened KeePass database\n")

    setup_ssh_keys(kp)

    print("\nAll secrets configured successfully!")


if __name__ == '__main__':
    main()
