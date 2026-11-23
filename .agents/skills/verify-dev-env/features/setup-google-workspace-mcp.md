# Register Google Workspace MCP

The devcontainer runs `node scripts/setup-google-workspace-mcp.ts` during post-create. Setup installs the pinned third-party server with uv and saves a stdio registration named `google-workspace` in Codex. Each run updates that registration to use the [Node launcher](./google-workspace-mcp.md).

## Sub-features

- `workspace-setup-register` updates the named server while preserving unrelated registrations and existing credentials.
- `workspace-setup-dirs` sets the Workspace config and token directories to mode 700.
- `workspace-setup-reminder` prints the KeePass bootstrap command when the OAuth file is absent.

## How to get to it (user POV)

- Rebuild the development container to run setup during post-create.
- Inside a configured workstation, repeat setup with `node scripts/setup-google-workspace-mcp.ts`.

## Driving it with verify-dev-env

Preconditions: Run `npm ci` with the pinned Node version. Install Codex, uv and uvx on PATH and provide `/usr/bin/python3` and network access.

- **Register and upgrade.** Run `npm run check -- mcp`. The drive checks clean registration, then seeds the old Bash registration, an unrelated server and disposable credentials. Two setup runs must preserve the credentials, permissions and unrelated server.
- **Inspect the registration.** Read `setup.log` in the printed evidence directory for setup output and Codex's saved command. The drive starts the server from that registration and records the advertised tools in `tools.json`.

## Gotchas

- The drive downloads the pinned tool into disposable uv and XDG directories and removes the scratch home on exit. Read the retained evidence under `verifications/evidence/`.
