# Google Workspace MCP launcher

Codex runs `node scripts/google-workspace-mcp.ts` from the path saved by [Google Workspace setup](./setup-google-workspace-mcp.md). The launcher reads the OAuth client ID and secret from `$CODEX_HOME/google-workspace/oauth.env`. The default Codex home is `~/.codex`.

## Sub-features

- `workspace-mcp-missing-file` exits with status 1 when the OAuth file is missing.
- `workspace-mcp-incomplete-file` exits with status 1 and identifies the missing client ID or secret.
- `workspace-mcp-exec` starts the pinned Workspace server on stdio with the Drive, Docs, Sheets and Slides tools in read-only mode. The server uses the `credentials-read-only` directory beside the OAuth file.

## How to get to it (user POV)

- Start Codex after Workspace setup. Codex invokes the command saved for `google-workspace` when it connects.
- To see a credential error directly, run `node scripts/google-workspace-mcp.ts` with a disposable `CODEX_HOME`.

## Driving it with verify-dev-env

Preconditions: Run `npm ci` with the pinned Node version. Install Codex, uv and uvx on PATH and provide `/usr/bin/python3` and network access.

- **Exercise the launcher.** Run `npm run check -- mcp`. The drive checks the missing file, missing ID and missing secret before starting the saved command with disposable credentials.
- **Inspect the server.** Open `tools.json` in the printed evidence directory to inspect the advertised tools. The drive checks the read-only inventory and writes `result.txt` after removing the scratch home.

## Gotchas

- The launcher uses stdio. A direct invocation with valid credentials waits for an MCP client.
- The drive lists tools without making a Google API call. Startup diagnostics go to `server.log`.
