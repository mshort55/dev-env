#!/usr/bin/env python3
"""
General setup for dev container environment.
"""

import shutil
import subprocess
from pathlib import Path


def setup_bash_history():
    print("Setting up enhanced bash history...")

    bashrc_path = Path.home() / '.bashrc'
    bashrc_content = bashrc_path.read_text() if bashrc_path.exists() else ''

    if '# Enhanced bash history' in bashrc_content:
        print("  Bash history already configured, skipping")
        return

    history_config = '''
# Enhanced bash history
export HISTSIZE=50000
export HISTFILESIZE=50000
export HISTCONTROL=ignoredups:erasedups
shopt -s histappend
PROMPT_COMMAND="history -a; history -n; $PROMPT_COMMAND"
'''

    with bashrc_path.open('a') as f:
        f.write(history_config)

    print("  Enhanced bash history configured")


def setup_completions():
    print("Setting up shell completions...")

    bashrc_path = Path.home() / '.bashrc'
    bashrc_content = bashrc_path.read_text() if bashrc_path.exists() else ''

    if '# Shell completions' in bashrc_content:
        print("  Shell completions already configured, skipping")
        return

    completions = '''
# Shell completions
source <(kubectl completion bash)
source <(oc completion bash)
source /usr/share/google-cloud-sdk/completion.bash.inc
eval "$(gh completion -s bash)"
'''

    with bashrc_path.open('a') as f:
        f.write(completions)

    print("  Shell completions configured")
    print("    - kubectl completion")
    print("    - oc completion")
    print("    - gcloud completion")
    print("    - gh completion")


def setup_claude_commands():
    print("Setting up Claude command files...")

    source_dir = Path('/Repos/dev-env/claude_commands')
    target_dir = Path.home() / '.claude' / 'commands'

    target_dir.mkdir(parents=True, exist_ok=True)

    copied_count = 0
    for file_path in source_dir.iterdir():
        if file_path.is_file():
            shutil.copy(file_path, target_dir / file_path.name)
            print(f"    - Copied {file_path.name}")
            copied_count += 1

    if copied_count == 0:
        print("  No command files found")
    else:
        print(f"  Copied {copied_count} command file(s)")


def setup_shell_paths():
    print("Setting up shell PATH...")

    bashrc_path = Path.home() / '.bashrc'
    bashrc_content = bashrc_path.read_text() if bashrc_path.exists() else ''

    if '# User bin paths' in bashrc_content:
        print("  PATH already configured, skipping")
        return

    path_config = '''
# User bin paths
export PATH="$HOME/.local/bin:$HOME/go/bin:$PATH"
'''

    with bashrc_path.open('a') as f:
        f.write(path_config)

    print("  PATH configured successfully")


def install_claude_code():
    print("Installing Claude Code CLI...")

    install_cmd = 'curl -fsSL https://claude.ai/install.sh | bash'
    result = subprocess.run(install_cmd, shell=True)

    if result.returncode == 0:
        print("  Claude Code CLI installed successfully")
    else:
        print("  ⚠️  Warning: Claude Code installation failed")


def install_go_tools():
    print("Installing Go tools...")

    tools = [
        ('github.com/onsi/ginkgo/v2/ginkgo', 'Ginkgo'),
    ]

    for tool_path, description in tools:
        tool_name = tool_path.split('/')[-1]
        print(f"  Installing {description} ({tool_name})...")

        result = subprocess.run(
            ['go', 'install', f'{tool_path}@latest'],
            capture_output=True,
            text=True
        )

        if result.returncode == 0:
            print(f"    {tool_name} installed successfully")
        else:
            print(f"    ⚠️  Warning: {tool_name} installation failed")
            if result.stderr:
                print(f"    ⚠️  Error: {result.stderr}")


def install_binaries():
    print("Installing binaries...")

    binaries_dir = Path.home() / 'Binaries'

    if not binaries_dir.exists():
        print("  ⚠️  Warning: Binaries directory not found, skipping")
        return

    binaries = [
        ('hcp_acm216.tar.gz', 'hcp'),
    ]

    for archive_name, binary_name in binaries:
        archive_path = binaries_dir / archive_name

        if not archive_path.exists():
            print(f"  ⚠️  Warning: {archive_name} not found, skipping")
            continue

        print(f"  Installing {binary_name} from {archive_name}...")

        result = subprocess.run(
            ['tar', 'xvzf', str(archive_path)],
            cwd=binaries_dir,
            capture_output=True,
            text=True
        )

        if result.returncode != 0:
            print(f"    ⚠️  Error: Failed to extract {archive_name}")
            if result.stderr:
                print(f"    ⚠️  Error: {result.stderr}")
            continue

        binary_path = binaries_dir / binary_name

        if not binary_path.exists():
            print(f"    ⚠️  Error: Extracted binary '{binary_name}' not found")
            continue

        result = subprocess.run(
            ['chmod', '+x', str(binary_path)],
            capture_output=True,
            text=True
        )

        if result.returncode != 0:
            print(f"    ⚠️  Error: Failed to make {binary_name} executable")
            continue

        result = subprocess.run(
            ['sudo', 'mv', str(binary_path), '/usr/local/bin/.'],
            capture_output=True,
            text=True
        )

        if result.returncode == 0:
            print(f"    {binary_name} installed successfully")
        else:
            print(f"    ⚠️  Error: Failed to move {binary_name} to /usr/local/bin")
            if result.stderr:
                print(f"    ⚠️  Error: {result.stderr}")


def main():
    print("\nStarting general environment setup...\n")

    setup_bash_history()
    setup_completions()
    setup_shell_paths()
    install_claude_code()
    install_go_tools()
    # install_binaries()
    setup_claude_commands()

    print("\nGeneral setup completed!\n")


if __name__ == '__main__':
    main()
