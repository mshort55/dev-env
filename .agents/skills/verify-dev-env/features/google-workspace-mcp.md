# Google Workspace MCP launcher

Codex runs `node scripts/google-workspace-mcp.ts` from the path saved by [Google Workspace setup](./setup-google-workspace-mcp.md). The launcher reads the OAuth client ID and secret from `$CODEX_HOME/google-workspace/oauth.env`. The default Codex home is `~/.codex`.

## Sub-features

- `workspace-mcp-missing-file` exits with status 1 when the OAuth file is missing.
- `workspace-mcp-incomplete-file` exits with status 1 and identifies the missing client ID or secret.
- `workspace-mcp-exec` starts the pinned Workspace server on stdio with the Drive, Docs, Sheets and Slides tools in read-only mode. The server uses the `credentials-read-only` directory beside the OAuth file.

## Verification

From the dev-env checkout, run `node verifications/scripts/check-mcp.ts` after installing the repository dependencies with `npm ci`. The check exercises both credential errors and launches the real server using the command saved in Codex. It initializes MCP and lists tools with disposable credentials. It makes no Google API calls.

The command prints its evidence directory under `verifications/evidence/mcp-*`. Inspect `server.log` for startup errors and `tools.json` for the advertised tools. A successful run writes `result.txt` after removing the temporary home.
