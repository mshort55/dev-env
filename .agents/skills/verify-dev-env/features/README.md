# dev-env verification map

This directory is the maintained source for verifying the user-facing behavior of dev-env. Read the index before driving the scripts, then use the matching feature file as the recipe.

## Running a verification

From the repository root, run `npm ci` and select the feature in the table.
The bootstrap and Workspace MCP checks each create a private home and remove
it after the drive. Evidence directories are printed on the terminal.

| Feature | Command |
| --- | --- |
| KeePass bootstrap | `npm run check -- bootstrap` |
| Workspace MCP setup and launcher | `npm run check -- mcp` |
| Jira MCP through Claude and Codex | `npm run check -- jira` |
| Container image | `node verifications/scripts/build-image.ts docker` or `node verifications/scripts/build-image.ts podman` |
| All checks | `npm run check` |

## Proof and skip reporting

- Capture the user action and the resulting state, not only the final status line.
- CLI proof includes the command, stdout, stderr, and exit code. `pty-run.ts` transcripts are the stdout/stderr record for interactive runs.
- Image proof includes `container-image/build.log`, `build.exit`, and `image-id.txt`.
- Mutation proof includes a second view of the written file: mode, sourced value comparison, and a check that the secret is absent from the transcript.
- Record the feature id in the evidence subdirectory name.
- Report an unreachable path with the attempted command and the unmet precondition.
- Do not report a skipped entry point as verified through a different path. A unit test is not a stand-in for these scripts.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with verify-dev-env` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

## Features

- [Bootstrap secrets](./bootstrap-secrets.md) covers a missing KeePass path, a missing database file, a wrong master password, and a finished bootstrap that writes a private Google Workspace `oauth.env`.
- [Container image](./container-image.md) covers building the dev image from `.env.example` and removing the verify tag without starting the `dev` container.
- [Google Workspace MCP launcher](./google-workspace-mcp.md) covers a missing credential file, an incomplete credential file, and the handoff to `workspace-mcp`.
- [Register Google Workspace MCP](./setup-google-workspace-mcp.md) covers installing the tool into a scratch uv directory and registering it with Codex under `CODEX_HOME`.
