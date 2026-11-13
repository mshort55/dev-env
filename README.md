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
3. Ensure the configured host directories and external setup inputs exist.
   [post-create.sh](.devcontainer/dev/post-create.sh) defines these dependencies,
   including synced settings and local source checkouts.
4. Open this repository in VS Code and choose **Reopen in Container**.
   Enter your KeePass master password if credential setup is enabled.

If you change `WORKSPACE_DIR_NAME`, also update `workspaceFolder` in
[devcontainer.json](.devcontainer/dev/devcontainer.json).

## Configuration and persistence

Host directories mounted by [compose.yml](.devcontainer/dev/compose.yml) persist
across rebuilds. Other container-local files may be lost when rebuilding.

[post-create.sh](.devcontainer/dev/post-create.sh) configures each new container.
Some user settings are restored from the synced workspace, replacing local copies;
edit their synced sources to keep changes across rebuilds. This setup does not
rerun on ordinary container restarts.

Credentials come from the optional KeePass database configured in `.env`.
To refresh them, run `python3 "$DEV_ENV_DIR/scripts/bootstrap-secrets.py"` inside
the container, then open a new terminal.

## Maintenance

- Keep shared configuration defaults in `.env.example` and local values in `.env`.
- Tool installation lives in [Dockerfile](.devcontainer/dev/Dockerfile); editor
  extensions and container features live in `devcontainer.json`.
- Keep dependency lockfiles in sync when updating versions, then rebuild the
  container to apply image or setup changes.

## Verification

Run `nox` from the repository root for lint, type, shell, test, and integration
checks. Use `nox -l` to list sessions or `nox -s lint types` to select checks.
Run `bash scripts/setup-verification.sh` if Nox is not installed.

The full suite requires Linux ARM64, network access, and a working Podman or Docker
engine. Integration checks use disposable credentials and leave evidence in
`verifications/evidence/`; they do not exercise dev-container features or
post-create setup. See [noxfile.py](noxfile.py) for check details.
