# Register Google Workspace MCP

Setup installs the Workspace MCP tool and registers a Codex stdio server named `google-workspace` that launches `scripts/google-workspace-mcp.sh`. When the OAuth file is not there yet, it prints a reminder and still exits successfully.

## Sub-features

- `workspace-setup-register` adds the `google-workspace` server to the Codex config for `CODEX_HOME`.
- `workspace-setup-dirs` creates the private config directory and the read-only credentials directory.
- `workspace-setup-reminder` prints the KeePass reminder when `oauth.env` is absent.

## How to get to it (user POV)

- From the dev-env repo, run `bash scripts/setup-google-workspace-mcp.sh`.
- The dev container runs that command from `.devcontainer/dev/post-create.sh`. Verification does not use the container entry point.

## Driving it with verify-dev-env

Preconditions:

- `doctor.sh STATE` printed `doctor=ok`.
- `HOME` is `$SCRATCH/home`.
- `CODEX_HOME` is `$SCRATCH/codex-setup`, not the operator's `~/.codex`.
- `UV_TOOL_DIR` is `$SCRATCH/uv/tools` and `UV_TOOL_BIN_DIR` is `$SCRATCH/uv/bin`.
- `XDG_CACHE_HOME` is `$SCRATCH/cache`.
- `uv` is on `PATH`. If it is not, set `UV_VERSION` from the `UV_VERSION=` line in `.env.example` (`0.12.23`) so the script can install it. Do not read `.env`; it is host-specific.
- Evidence directory: `$EVIDENCE_DIR/setup-google-workspace-mcp/`.
- This drive needs network access for `uv tool install workspace-mcp==2.0.1` unless that exact version is already installed inside `UV_TOOL_DIR`.
- `bash verifications/verify.sh` does not run this feature. Drive it with the command below.

- **Register the server.** Create the scratch uv and Codex directories mode `700`. From the repo root run `bash scripts/setup-google-workspace-mcp.sh`. Save stdout, stderr, and the exit code as `register.out`, `register.err`, and `register.exit`.
- **Proof.** Exit code `0`. `$CODEX_HOME/config.toml` contains a `[mcp_servers.google-workspace]` table whose `command` is `bash` and whose `args` include `$DEV_ENV_REPO/scripts/google-workspace-mcp.sh`. `$CODEX_HOME/google-workspace` and `$CODEX_HOME/google-workspace/credentials-read-only` exist and are mode `700`. Stdout contains `Google Workspace MCP configured; add the Google OAuth KeePass entries and rerun scripts/bootstrap-secrets.py.` when `oauth.env` was absent before the command. `register.err` may contain `Refusing to create helper binaries under temporary dir "/tmp"` because `CODEX_HOME` is under `/tmp`; the toml file is still the proof. The operator's `~/.codex/config.toml` mtime is unchanged.

## Gotchas

- `codex mcp add` writes `$CODEX_HOME/config.toml`. Without `CODEX_HOME`, that file is the operator's `~/.codex/config.toml`.
- `uv tool install` writes the user tool directory unless `UV_TOOL_DIR` and `UV_TOOL_BIN_DIR` are both inside the scratch directory. `HOME` alone does not redirect an already-installed `uv`.
- The `/tmp` helper-binary warning is expected for this scratch layout. Do not retarget `CODEX_HOME` into the operator's home to silence it.
- Do not run `.devcontainer/dev/post-create.sh` to reach this command. It also runs apt, npm, and the secrets bootstrap.
