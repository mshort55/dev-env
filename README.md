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
     path used by [post-create.sh](.devcontainer/dev/post-create.sh),
     `/Repos/jira-mcp-server_stolostron`.

4. Open this repository in VS Code and choose **Reopen in Container**.
   Enter your KeePass master password if credential setup is enabled.

If you change `WORKSPACE_DIR_NAME`, also update `workspaceFolder` in
[devcontainer.json](.devcontainer/dev/devcontainer.json).

## Configuration and persistence

Host directories mounted by [compose.yml](.devcontainer/dev/compose.yml) persist
across rebuilds. Other container-local files may be lost when rebuilding.

[post-create.sh](.devcontainer/dev/post-create.sh) configures each new container.
It copies some user settings from the workspace directory, replacing local copies.
Edit the source files in the workspace directory to keep changes across rebuilds. This setup does not
rerun on ordinary container restarts.

Credentials come from the optional KeePass database configured in `.env`.
To refresh them, run `python3 "$DEV_ENV_DIR/scripts/bootstrap-secrets.py"` inside
the container, then open a new terminal.

## Maintenance

- Keep shared configuration defaults in `.env.example` and local values in `.env`.
- Most tool installation lives in [Dockerfile](.devcontainer/dev/Dockerfile); editor
  extensions and container features live in `devcontainer.json`.
- Keep dependency lockfiles in sync when updating versions, then rebuild the
  container to apply image or setup changes.

## Verification

For host verification, install the Node.js version pinned by `NODE_VERSION` in
[.env.example](.env.example), then run `npm ci` in this checkout. Opening the
devcontainer requires only the host tools listed under Setup. Container creation
installs the checkout’s packages in a separate volume at `$DEV_ENV_DIR/node_modules`.

From the checkout on the host or in the container, run `npm run discover` to
list sources, `npm test` to test discovery, and `npm run typecheck` to check
TypeScript. The discovery command runs the mounted source directly, so edits
take effect on the next invocation.

Run `nox` from the repository root for lint, type, shell, test, and integration
checks. Use `nox -l` to list sessions or `nox -s lint types` to select checks.
Run `bash scripts/setup-verification.sh` if Nox is not installed.

The full suite requires Linux ARM64, network access, and Docker inside the
development container. Integration checks use disposable credentials and write
evidence to `verifications/evidence/`. See [noxfile.py](noxfile.py) for check details.

Before merging changes to the Dockerfile, its build arguments, or files it
copies, confirm the `Podman image build` CI check passed for the proposed change.
For changes to host mounts, container features, or post-create setup, verify the
affected behavior in a freshly rebuilt development container on the Mac.
