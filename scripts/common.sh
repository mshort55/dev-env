#!/bin/sh

configure_claude_code() {
    CLAUDE_CODE_SETTINGS_PATH="${HOME}/.claude/settings.json"
    if [ ! -f "$CLAUDE_CODE_SETTINGS_PATH" ]; then
        mkdir -p "$(dirname "$CLAUDE_CODE_SETTINGS_PATH")"
        echo '{}' > "$CLAUDE_CODE_SETTINGS_PATH"
    fi
    jq '
      # Enable Go language server plugin
      .enabledPlugins["gopls-lsp@claude-plugins-official"] = true |
      # Disable Co-Authored-By line in commit messages
      .includeCoAuthoredBy = false
    ' "$CLAUDE_CODE_SETTINGS_PATH" > tmp.json
    mv tmp.json "$CLAUDE_CODE_SETTINGS_PATH"
}
