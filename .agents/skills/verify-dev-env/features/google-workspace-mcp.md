# Google Workspace MCP launcher

The launcher refuses to start unless both Google OAuth variables are in a private env file, then replaces itself with the read-only Workspace MCP server on stdio.

## Sub-features

- `workspace-mcp-missing-file` exits when `oauth.env` is absent.
- `workspace-mcp-incomplete-file` exits when the file does not set both variables.
- `workspace-mcp-exec` replaces the process with `uvx workspace-mcp@2.0.1` in read-only mode.

## How to get to it (user POV)

- Codex starts the server with `bash <dev-env>/scripts/google-workspace-mcp.sh` after `scripts/setup-google-workspace-mcp.sh` registers it.
- From a shell, run `bash scripts/google-workspace-mcp.sh`. The credential file is `$CODEX_HOME/google-workspace/oauth.env`, or `~/.codex/google-workspace/oauth.env` when `CODEX_HOME` is unset.

## Driving it with verify-dev-env

Preconditions:

- `doctor.sh STATE` printed `doctor=ok`.
- `CODEX_HOME` is `$SCRATCH/codex-launcher`, created mode `700` for this drive. Do not use `$HOME/.codex` from the operator, and do not reuse the bootstrap scratch `.codex` unless this drive is meant to consume that fixture.
- `HOME` is `$SCRATCH/home`.
- Evidence directory: `$EVIDENCE_DIR/google-workspace-mcp/`.
- `bash verifications/verify.sh` does not run this feature. Drive it with the commands below.

- **Refuse a missing file.** Run `mkdir -p "$CODEX_HOME" && bash scripts/google-workspace-mcp.sh` from the repo root with `CODEX_HOME` set and no `oauth.env` under it. Exit code `1`. Stderr is `Google Workspace OAuth credentials are missing; rerun dev-env/scripts/bootstrap-secrets.py after adding the KeePass entries.` Save stdout, stderr, and the exit code as `missing-file.out`, `missing-file.err`, and `missing-file.exit`.
- **Refuse an incomplete file.** Write an empty `$CODEX_HOME/google-workspace/oauth.env` (mode `600`) and run `bash scripts/google-workspace-mcp.sh`. Exit code `1`. Stderr contains `Google OAuth client ID is missing`. Save `incomplete-file.err` and `incomplete-file.exit`.
- **Hand off to the server.** Write both `export GOOGLE_OAUTH_CLIENT_ID=...` and `export GOOGLE_OAUTH_CLIENT_SECRET=...` lines into that `oauth.env` using the fixture values from `STATE`. Run `timeout 20 bash scripts/google-workspace-mcp.sh < /dev/null`. Record stdout, stderr, and the exit code as `exec.out`, `exec.err`, and `exec.exit`.
- **Proof.** The missing-file and incomplete-file exits are `1` and their stderr matches the strings above. For the handoff, stderr does not contain `Google Workspace OAuth credentials are missing`. Exit code `124` means `timeout` stopped a still-running server, which is the expected long-running stdio process. Any other exit code must be accompanied by `exec.err`; report the sub-feature unreachable when `uvx` cannot start `workspace-mcp`. Do not replace `uvx` with a stub.

## Gotchas

- With `CODEX_HOME` unset, the script reads the operator's real `~/.codex/google-workspace/oauth.env` and will start the server with their Google credentials.
- The success path never returns. `timeout` must be the parent of the script so cleanup does not have to hunt for a process by name. After it exits, confirm no child whose `/proc/<pid>/environ` contains this run's `CODEX_HOME` is still alive. Kill only those pids.
- `uvx workspace-mcp@2.0.1` may download the package. A download failure is an unreachable result, not a reason to mock the binary.
- The script exports `WORKSPACE_MCP_CREDENTIALS_DIR` under the same `CODEX_HOME` and passes `--tools drive docs sheets slides --read-only`. Assert those arguments only from `exec.err` or a process listing captured while `timeout` is still running. Do not infer them from the source file alone.
