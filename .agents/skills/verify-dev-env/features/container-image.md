# Container image

The dev container image installs its toolchain while it builds. Verification builds that image from the versions in `.env.example`, records the image id, and removes the temporary tag. It does not start the container named `dev`.

## Sub-features

- `image-build` builds `.devcontainer/dev/Dockerfile` with the compose build args taken from `.env.example`.
- `image-tag` uses `dev-env:verify-<run-id>` and leaves `dev-env:latest` untouched.
- `image-remove` deletes the verify tag after the image id is recorded.

## How to get to it (user POV)

- Open the repo in VS Code and choose Reopen in Container. That builds `.devcontainer/dev/Dockerfile` and starts the service named `dev`. Verification does not use this entry point.
- From the repo root, `bash verifications/scripts/build-image.sh STATE` performs the build without starting a container. `bash verifications/verify.sh` runs it after the bootstrap checks.

## Driving it with verify-dev-env

Preconditions:

- `doctor.sh STATE` printed `doctor=ok`.
- `.env.example` is the only env file the build reads. `.env` is not passed to the engine.
- `podman` or `docker` is on `PATH`. Podman is used when both exist.
- The build needs network access. It downloads the packages and CLIs named in the Dockerfile.

- **Build.** From the repo root, run `bash verifications/scripts/build-image.sh STATE`. The engine is `podman build` or `docker build`, the file is `.devcontainer/dev/Dockerfile`, the context is the repo root, and the tag is `dev-env:verify-<run-id>`. Each of `ATUIN_VERSION`, `BUF_VERSION`, `CONTAINER_UID`, `CONTAINER_USER`, `GINKGO_VERSION`, `GO_VERSION`, `GOPLS_VERSION`, `GRPCURL_VERSION`, `HCP_VERSION`, `JQ_VERSION`, `KIND_VERSION`, `KUSTOMIZE_VERSION`, `NODE_VERSION`, `OPENSHIFT_VERSION`, `PODMAN_VERSION`, `RUST_VERSION`, `UV_VERSION`, `WORKSPACE_DIR_NAME`, `YQ_VERSION`, and `ZELLIJ_VERSION` is passed as `--build-arg` from the matching line in `.env.example`.
- **Proof.** Exit code `0`. `container-image/build.exit` is `0`. `container-image/image-id.txt` contains one image id. `container-image/side-effects.txt` contains `container_started=no`, `latest_tag_used=no`, `env_file=.env.example`, and `image_removed=yes`. `podman images` or `docker images` no longer lists `dev-env:verify-<run-id>`. No container named `dev` was created by this command.

## Gotchas

- `podman compose build` and `docker compose build` load `.env` when that file exists and tag the image `dev-env:latest`. This check does not call compose.
- `HOST_*` values in `.env.example` are volume paths. They are not build args. Do not source `.env.example`; several of those lines interpolate `${HOME}`.
- The Dockerfile installs linux-arm64 binaries. This check matches that architecture.
- Commented-out installs, including the `hcp` client and Rust, are not downloaded. `.devcontainer/dev/post-create.sh` is not run, so npm CLIs, the Jira MCP package, and `workspace-mcp` are outside this proof.
- The build log can be large. Keep `container-image/build.log` with the evidence. Cleanup removes the image tag and the scratch directory, not the log.
