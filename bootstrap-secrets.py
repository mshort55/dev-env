#!/usr/bin/env python3
"""
Bootstrap secrets from KeePass database into container.
This script runs once on container creation to set up ephemeral secrets.
"""

import os
import sys
import getpass
import subprocess
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

def setup_gpg_key(kp: PyKeePass):
    print("Setting up GPG key...")

    entry = kp.find_entries(title='gpg', first=True)
    if not entry:
        print("Warning: No GPG entry found in database")
        return

    gpg_private_key = entry.password

    try:
        subprocess.run(
            ['gpg', '--import', '--batch'],
            input=gpg_private_key.encode(),
            capture_output=True,
            check=True
        )
        print("GPG key imported successfully")
    except subprocess.CalledProcessError as e:
        print(f"Warning: Failed to import GPG key: {e.stderr.decode()}")
        return
    except FileNotFoundError:
        print("Warning: gpg command not found, skipping GPG setup")
        return

    gpg_conf_dir = Path.home() / '.gnupg'
    gpg_conf_dir.mkdir(mode=0o700, exist_ok=True)

    gpg_agent_conf = gpg_conf_dir / 'gpg-agent.conf'
    gpg_agent_conf.write_text('allow-loopback-pinentry\n')
    gpg_agent_conf.chmod(0o600)

    gpg_conf = gpg_conf_dir / 'gpg.conf'
    gpg_conf.write_text('pinentry-mode loopback\n')
    gpg_conf.chmod(0o600)

    bashrc_path = Path.home() / '.bashrc'
    gpg_tty_config = '\n# GPG configuration\nexport GPG_TTY=$(tty)\n'

    bashrc_content = bashrc_path.read_text() if bashrc_path.exists() else ''
    if 'GPG_TTY' not in bashrc_content:
        with bashrc_path.open('a') as f:
            f.write(gpg_tty_config)

    print("GPG configuration updated for container use")


def setup_gcloud_config(kp: PyKeePass):
    print("Setting up gcloud configuration...")

    gcloud_dir = Path.home() / '.config' / 'gcloud'
    gcloud_dir.mkdir(mode=0o700, parents=True, exist_ok=True)

    adc_entry = kp.find_entries(title='gcloud/application_default_credentials.json', first=True)
    if adc_entry:
        adc_path = gcloud_dir / 'application_default_credentials.json'
        adc_path.write_text(adc_entry.password)
        adc_path.chmod(0o600)
        print("  - application_default_credentials.json configured")
    else:
        print("  Warning: gcloud/application_default_credentials.json entry not found")

    config_entry = kp.find_entries(title='gcloud/configurations/config_default', first=True)
    if config_entry:
        config_dir = gcloud_dir / 'configurations'
        config_dir.mkdir(mode=0o700, exist_ok=True)
        config_path = config_dir / 'config_default'
        config_path.write_text(config_entry.password)
        config_path.chmod(0o600)
        print("  - configurations/config_default configured")
    else:
        print("  Warning: gcloud/configurations/config_default entry not found")

    creds_entry = kp.find_entries(title='gcloud/credentials.db', first=True)
    if creds_entry:
        creds_attachment = creds_entry.get_attachment('credentials.db')
        if creds_attachment:
            creds_path = gcloud_dir / 'credentials.db'
            creds_path.write_bytes(creds_attachment)
            creds_path.chmod(0o600)
            print("  - credentials.db configured")
        else:
            print("  Warning: credentials.db attachment not found in entry")
    else:
        print("  Warning: gcloud/credentials.db entry not found")

    print("gcloud configuration complete")


def main():
    kdbx_path = '/UbuntuSync/dev-env.kdbx'

    if not os.path.exists(kdbx_path):
        print(f"Error: KeePass database not found at {kdbx_path}")
        sys.exit(1)

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
    setup_gpg_key(kp)
    setup_gcloud_config(kp)

    print("\nAll secrets configured successfully!")


if __name__ == '__main__':
    main()
