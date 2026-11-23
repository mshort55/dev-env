# Register Google Workspace MCP

The devcontainer runs `node scripts/setup-google-workspace-mcp.ts` during post-create. Setup installs the pinned third-party server with uv and saves a stdio registration named `google-workspace` in Codex. Each run updates that registration to use the [Node launcher](./google-workspace-mcp.md).

## Sub-features

- `workspace-setup-register` updates the named server while preserving unrelated registrations and existing credentials.
- `workspace-setup-dirs` sets the Workspace config and token directories to mode 700.
- `workspace-setup-reminder` prints the KeePass bootstrap command when the OAuth file is absent.

## Verification

Run `node verifications/scripts/check-mcp.ts` from a checkout with its npm dependencies installed, Codex, uv and uvx on PATH, and `/usr/bin/python3` available. The checker takes the tool versions from `.env.example` and downloads the dependencies into a temporary home. It uses separate Codex, uv and XDG directories there.

The checker verifies clean registration and starts the server. It then seeds the old Bash registration, an unrelated server and disposable credentials. After two setup runs it checks the saved command, credential contents and permissions, unrelated registration and advertised tools. The evidence directory printed at startup contains `setup.log` with setup output and Codex's registrations.
