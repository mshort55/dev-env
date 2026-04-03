#!/bin/sh

enable_gopls_plugin() {
    CLAUDE_CODE_SETTINGS_PATH="${HOME}/.claude/settings.json"
    jq '.enabledPlugins["gopls-lsp@claude-plugins-official"] = true' "$CLAUDE_CODE_SETTINGS_PATH" > tmp.json
    mv tmp.json "$CLAUDE_CODE_SETTINGS_PATH"
}
