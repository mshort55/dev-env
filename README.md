# dev-env

Personal development container for CLI, cloud, Kubernetes, and AI-assisted work.
Includes language runtimes, development tools, shell configuration, and optional
KeePass-based credential setup.

## Setup

1. Install VS Code with Dev Containers and configure your container engine.
   The current configuration uses Podman; on macOS, configure VS Code's
   `dev.containers.dockerPath` as `podman` and enable Compose in Podman Desktop.
2. Copy `.env.example` to `.env`. Set your container username and UID, host mount
   paths, and the repository's container path (`DEV_ENV_DIR`). See
   [.env.example](.env.example) for available settings.
3. Check the configured host directories before opening the container.

   - In the [workspace directory](GLOSSARY.md) (`HOST_WORKSPACE_DIR`), place
     your settings files at `.claude/settings.json` and
     `.claude/ccstatusline/settings.json`.
   - In the repositories directory (`HOST_REPOS_DIR`), place the `dev-env`
     checkout where it will be mounted at `DEV_ENV_DIR` (default `/Repos/dev-env`).
     Place the Jira MCP checkout directly under `HOST_REPOS_DIR` as `jira-mcp-server_stolostron`.
     Keep `REPOS_DIR_NAME=Repos` so the Jira checkout is available at the exact
     path used by [post-create.ts](.devcontainer/dev/post-create.ts),
     `/Repos/jira-mcp-server_stolostron`.

4. Open this repository in VS Code and choose **Reopen in Container**.
   Enter your KeePass master password if credential setup is enabled.

If you change `WORKSPACE_DIR_NAME`, also update `workspaceFolder` in
[devcontainer.json](.devcontainer/dev/devcontainer.json).

## Configuration and persistence

Host directories mounted by [compose.yml](.devcontainer/dev/compose.yml) persist
across rebuilds. Other container-local files may be lost when rebuilding.

[post-create.ts](.devcontainer/dev/post-create.ts) configures each new container.
It copies some user settings from the workspace directory, replacing local copies.
Edit the source files in the workspace directory to keep changes across rebuilds. This setup does not
rerun on ordinary container restarts.

Credentials come from the optional KeePass database configured in `.env`.
To refresh them, run `node "$DEV_ENV_DIR/scripts/bootstrap-secrets.ts"` inside
the container, then open a new terminal.

Container creation runs `node scripts/setup-codex.ts` to install the latest
Codex CLI and update an existing managed daemon. To verify this lifecycle in
disposable homes, run `node --test tests/codex-install-lifecycle.ts` with network access.
To repeat Jira registration inside the container, run `node scripts/setup-jira-mcp.ts claude`
for Claude Code or `node scripts/setup-jira-mcp.ts` for Codex from the checkout.

## Maintenance

- Keep shared configuration defaults in `.env.example` and local values in `.env`.
- The [Dockerfile](.devcontainer/dev/Dockerfile) installs Node and runs
  [install-tools.ts](.devcontainer/dev/install-tools.ts) to install workstation tools.
  Editor extensions and container features live in `devcontainer.json`.
- Keep dependency lockfiles in sync when updating versions, then rebuild the
  container to apply image or setup changes.

## Verification

For host verification, install the Node.js version pinned by `NODE_VERSION` in
[.env.example](.env.example), then run `npm ci` in this checkout. Opening the
devcontainer requires only the host tools listed under Setup. Container creation
installs the checkout’s packages in a separate volume at `$DEV_ENV_DIR/node_modules`.

Run `npm run check` for the full suite. Select checks by name, for example
`npm run check -- lint format-check types tests` for code checks or
`npm run check -- bootstrap mcp` for the KeePass and Workspace MCP drives.
Use `npm run check -- --list` to list checks. The runner reports every failed
check after the selected checks finish. Run `npm run format` to apply formatting
or `npm run discover` to list the active sources.

The full suite requires Linux ARM64, network access, Docker, Git, Bash, curl,
Codex, uv and uvx. The `lifecycle` check installs disposable copies of Codex
and exercises its daemon under your user cache directory. To change this
location, set `CODEX_REPRO_ROOT` to a writable directory outside the system
temporary directory.
Integration evidence stays under `verifications/evidence/`.

To build the image alone, run `node verifications/scripts/build-image.ts docker`
or select `podman` for the Linux ARM64 CI build. The command prints the evidence
directory and removes its temporary image tag after inspection.

Before merging changes to the Dockerfile, its build arguments, or files it
copies, confirm the `Podman image build` CI check passed for the proposed change.
For changes to host mounts, container features, or post-create setup, verify the
affected behavior in a freshly rebuilt development container on the Mac.
Choose **Dev Containers: Rebuild Container** in VS Code. Open two Bash terminals
and run the following in each.

```sh
echo "$DBUS_SESSION_BUS_ADDRESS"
dbus-send --session --print-reply --dest=org.freedesktop.secrets \
  /org/freedesktop/secrets/collection/login org.freedesktop.DBus.Properties.Get \
  string:org.freedesktop.Secret.Collection string:Locked
```

Both terminals should print the same bus address and report `boolean false`.
