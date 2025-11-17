#!/usr/bin/env python3
"""
Bootstrap secrets from KeePass database into container.
"""

import os
import sys
import getpass
import subprocess
from pathlib import Path
from typing import cast, Optional
from pykeepass import PyKeePass
from pykeepass.entry import Entry


def add_env_vars_to_bashrc(env_vars: dict[str, str], section_name: str):
    bashrc_path = Path.home() / '.bashrc'
    bashrc_content = bashrc_path.read_text() if bashrc_path.exists() else ''

    section_comment = f'# {section_name}\n'

    if section_comment.strip() in bashrc_content:
        return

    env_lines = [f'\n{section_comment}']

    for env_name, env_value in env_vars.items():
        env_lines.append(f'export {env_name}={env_value}\n')

    with bashrc_path.open('a') as f:
        f.writelines(env_lines)


def setup_ssh_keys(kp: PyKeePass):
    print("Setting up SSH keys...")

    entry = cast(Optional[Entry], kp.find_entries(title='ssh', first=True))
    if not entry:
        print("⚠️  Warning: No SSH entry found in database")
        return

    if not entry.password:
        print("⚠️  Warning: SSH entry has no password (private key)")
        return

    if not entry.notes:
        print("⚠️  Warning: SSH entry has no notes (public key)")
        return

    ssh_dir = Path.home() / '.ssh'
    ssh_dir.mkdir(mode=0o700, exist_ok=True)

    private_key_path = ssh_dir / 'id_ed25519'
    private_key_content = entry.password if entry.password.endswith('\n') else entry.password + '\n'
    private_key_path.write_text(private_key_content)
    private_key_path.chmod(0o600)

    public_key_path = ssh_dir / 'id_ed25519.pub'
    public_key_path.write_text(entry.notes)
    public_key_path.chmod(0o644)

    print(f"SSH keys config complete")


def setup_gpg_key(kp: PyKeePass):
    print("Setting up GPG key...")

    entry = cast(Optional[Entry], kp.find_entries(title='gpg', first=True))
    if not entry:
        print("⚠️  Warning: No GPG entry found in database")
        return

    if not entry.password:
        print("⚠️  Warning: GPG entry has no password (private key)")
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
        print(f"⚠️  Warning: Failed to import GPG key: {e.stderr.decode()}")
        return
    except FileNotFoundError:
        print("⚠️  Warning: gpg command not found, skipping GPG setup")
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

    print("GPG configuration complete")


def setup_gcloud_config(kp: PyKeePass):
    print("Setting up gcloud configuration...")

    GCLOUD_ADC_ENTRY_TITLE = '.config/gcloud/application_default_credentials.json'
    GCLOUD_CONFIG_ENTRY_TITLE = '.config/gcloud/configurations/config_default'
    GCLOUD_CREDENTIALS_DB_ENTRY_TITLE = '.config/gcloud/credentials.db'

    gcloud_dir = Path.home() / '.config' / 'gcloud'
    gcloud_dir.mkdir(mode=0o700, parents=True, exist_ok=True)

    adc_entry = cast(Optional[Entry], kp.find_entries(title=GCLOUD_ADC_ENTRY_TITLE, first=True))
    if adc_entry and adc_entry.password:
        adc_filename = Path(GCLOUD_ADC_ENTRY_TITLE).name
        adc_path = gcloud_dir / adc_filename
        adc_path.write_text(adc_entry.password)
        adc_path.chmod(0o600)
        print(f"  - {GCLOUD_ADC_ENTRY_TITLE} configured")
    else:
        print(f"  ⚠️  Warning: {GCLOUD_ADC_ENTRY_TITLE} entry not found or has no password")

    config_entry = cast(Optional[Entry], kp.find_entries(title=GCLOUD_CONFIG_ENTRY_TITLE, first=True))
    if config_entry and config_entry.password:
        config_parts = Path(GCLOUD_CONFIG_ENTRY_TITLE).parts
        config_dir = gcloud_dir / config_parts[-2]
        config_dir.mkdir(mode=0o700, exist_ok=True)
        config_path = config_dir / config_parts[-1]
        config_path.write_text(config_entry.password)
        config_path.chmod(0o600)
        print(f"  - {GCLOUD_CONFIG_ENTRY_TITLE} configured")
    else:
        print(f"  ⚠️  Warning: {GCLOUD_CONFIG_ENTRY_TITLE} entry not found or has no password")

    creds_entry = cast(Optional[Entry], kp.find_entries(title=GCLOUD_CREDENTIALS_DB_ENTRY_TITLE, first=True))
    if creds_entry:
        if creds_entry.attachments:
            attachment = creds_entry.attachments[0]
            creds_data = attachment.data
            creds_filename = Path(GCLOUD_CREDENTIALS_DB_ENTRY_TITLE).name
            creds_path = gcloud_dir / creds_filename
            creds_path.write_bytes(creds_data)
            creds_path.chmod(0o600)
            print(f"  - {GCLOUD_CREDENTIALS_DB_ENTRY_TITLE} configured")
        else:
            print(f"  ⚠️  Warning: {GCLOUD_CREDENTIALS_DB_ENTRY_TITLE} entry has no attachments")
    else:
        print(f"  ⚠️  Warning: {GCLOUD_CREDENTIALS_DB_ENTRY_TITLE} entry not found")

    print("gcloud configuration complete")


def setup_claude_code_env(kp: PyKeePass):
    print("Setting up Claude Code environment variables...")

    env_var_mappings = {
        'ANTHROPIC_VERTEX_PROJECT_ID': 'claude_env_ANTHROPIC_VERTEX_PROJECT_ID',
        'CLAUDE_CODE_USE_VERTEX': 'claude_env_CLAUDE_CODE_USE_VERTEX',
        'CLOUD_ML_REGION': 'claude_env_CLOUD_ML_REGION'
    }

    env_vars = {}

    for env_name, keepass_title in env_var_mappings.items():
        entry = cast(Optional[Entry], kp.find_entries(title=keepass_title, first=True))
        if entry and entry.password:
            env_vars[env_name] = entry.password
            print(f"  - {env_name} configured")
        else:
            print(f"  ⚠️  Warning: {keepass_title} entry not found or has no password")

    if env_vars:
        add_env_vars_to_bashrc(env_vars, "Claude Code environment variables")

    print("Claude Code environment variables config complete")


def setup_kube_context_env(kp: PyKeePass):
    print("Setting up Kubernetes context environment variables...")

    env_var_mappings = {
        'THREE_NODE': 'kube_env_THREE_NODE'
    }

    env_vars = {}

    for env_name, keepass_title in env_var_mappings.items():
        entry = cast(Optional[Entry], kp.find_entries(title=keepass_title, first=True))
        if entry and entry.password:
            env_vars[env_name] = entry.password
            print(f"  - {env_name} configured")
        else:
            print(f"  ⚠️  Warning: {keepass_title} entry not found or has no password")

    if env_vars:
        add_env_vars_to_bashrc(env_vars, "Kubernetes context environment variables")

    print("Kubernetes context environment variables config complete")


def setup_github_cli_config(kp: PyKeePass):
    print("Setting up GitHub CLI configuration...")

    GH_HOSTS_ENTRY_TITLE = '.config/gh/hosts.yml'

    gh_dir = Path.home() / '.config' / 'gh'
    gh_dir.mkdir(mode=0o700, parents=True, exist_ok=True)

    entry = cast(Optional[Entry], kp.find_entries(title=GH_HOSTS_ENTRY_TITLE, first=True))
    if entry and entry.password:
        hosts_filename = Path(GH_HOSTS_ENTRY_TITLE).name
        hosts_path = gh_dir / hosts_filename
        hosts_path.write_text(entry.password)
        hosts_path.chmod(0o600)
        print(f"  - {GH_HOSTS_ENTRY_TITLE} configured")
    else:
        print(f"  ⚠️  Warning: {GH_HOSTS_ENTRY_TITLE} entry not found or has no password")

    print("GitHub CLI configuration complete")


def setup_docker_config(kp: PyKeePass):
    print("Setting up Docker configuration...")

    DOCKER_CONFIG_ENTRY_TITLE = '.docker/config.json'

    docker_dir = Path.home() / '.docker'
    docker_dir.mkdir(mode=0o700, parents=True, exist_ok=True)

    entry = cast(Optional[Entry], kp.find_entries(title=DOCKER_CONFIG_ENTRY_TITLE, first=True))
    if entry and entry.password:
        config_filename = Path(DOCKER_CONFIG_ENTRY_TITLE).name
        config_path = docker_dir / config_filename
        config_path.write_text(entry.password)
        config_path.chmod(0o600)
        print(f"  - {DOCKER_CONFIG_ENTRY_TITLE} configured")
    else:
        print(f"  ⚠️  Warning: {DOCKER_CONFIG_ENTRY_TITLE} entry not found or has no password")

    print("Docker configuration complete")


def setup_git_config(kp: PyKeePass):
    print("Setting up git configuration...")

    git_configs = {
        'user.email': 'git_user_email',
        'user.name': 'git_user_name',
        'user.signingkey': 'git_signingkey'
    }

    for config_key, keepass_title in git_configs.items():
        entry = cast(Optional[Entry], kp.find_entries(title=keepass_title, first=True))
        if entry and entry.password:
            try:
                subprocess.run(
                    ['git', 'config', '--global', config_key, entry.password],
                    capture_output=True,
                    check=True
                )
                print(f"  - {config_key} configured")
            except subprocess.CalledProcessError as e:
                print(f"  ⚠️  Warning: Failed to set {config_key}: {e.stderr.decode()}")
            except FileNotFoundError:
                print("  ⚠️  Warning: git command not found, skipping git configuration")
                return
        else:
            print(f"  ⚠️  Warning: {keepass_title} entry not found or has no password")

    try:
        subprocess.run(['git', 'config', '--global', 'commit.gpgsign', 'true'], check=True)
        subprocess.run(['git', 'config', '--global', 'tag.gpgsign', 'true'], check=True)
        print("  - commit.gpgsign and tag.gpgsign enabled")
    except subprocess.CalledProcessError as e:
        print(f"  ⚠️  Warning: Failed to set gpgsign flags: {e}")

    print("Git configuration complete")


def open_keepass_database(kdbx_path: str, max_attempts: int = 3) -> PyKeePass:
    for attempt in range(1, max_attempts + 1):
        try:
            master_password = getpass.getpass("Enter KeePass master password: ")
        except KeyboardInterrupt:
            print("\n⚠️  Bootstrap cancelled")
            sys.exit(1)

        try:
            return PyKeePass(kdbx_path, password=master_password)
        except Exception as e:
            if attempt < max_attempts:
                print(f"⚠️  Error: Incorrect password. {max_attempts - attempt} attempt(s) remaining.")
            else:
                print(f"⚠️  Error: Failed to open database after {max_attempts} attempts: {e}")
                sys.exit(1)

    # This line should never be reached, but satisfies type checker
    raise RuntimeError("Unreachable: should have returned or exited")


def main():
    kdbx_path = '/UbuntuSync/dev-env.kdbx'

    if not os.path.exists(kdbx_path):
        print(f"⚠️  Error: KeePass database not found at {kdbx_path}")
        sys.exit(1)

    kp = open_keepass_database(kdbx_path)
    print("\nSuccessfully opened KeePass database\n")

    setup_ssh_keys(kp)
    setup_gpg_key(kp)
    setup_gcloud_config(kp)
    setup_claude_code_env(kp)
    setup_kube_context_env(kp)
    setup_github_cli_config(kp)
    setup_docker_config(kp)
    setup_git_config(kp)

    print("\nAll secrets configured successfully!")


if __name__ == '__main__':
    main()
