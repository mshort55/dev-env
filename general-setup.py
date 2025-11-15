#!/usr/bin/env python3
"""
General setup for dev container environment.
"""

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


def main():
    print("\nStarting general environment setup...\n")

    setup_bash_history()
    setup_completions()

    print("\nGeneral setup completed!\n")


if __name__ == '__main__':
    main()
