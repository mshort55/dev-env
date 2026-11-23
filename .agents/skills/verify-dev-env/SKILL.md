---
name: verify-dev-env
description: Verify the dev-env KeePass bootstrap and isolated MCP startup, or build the Linux ARM64 workstation image with Docker or Podman. Use when checking the Dockerfile, its inputs, credentials setup, or MCP registration.
---

# Verify dev-env

Run `npm ci` from the dev-env checkout with the Node version in `.env.example`.
Run `npm run check` for the full suite, or select checks from the
[feature map](features/README.md). Host rebuild instructions and system
prerequisites are in the [verification guide](../../../README.md#verification).

## Bootstrap and MCP

Run `npm run check -- bootstrap mcp`. Bootstrap creates a mode-`700` scratch
directory, a disposable KeePass database, and a password file. The child
receives a scratch home and private Git and GPG paths. The doctor checks the
fixture before the PTY drives password entry. Workspace MCP starts through the
registered launcher with disposable credentials and checks its advertised tools.

Read `doctor.txt` and `bootstrap-secrets/side-effects.txt` in the printed
bootstrap evidence directory. Check the transcripts and exit codes against the
[bootstrap recipe](features/bootstrap-secrets.md). Workspace MCP prints its own
evidence directory containing setup and server logs.

## Image build

Run `node verifications/scripts/build-image.ts docker` in the development
container. The Linux ARM64 CI image job uses `podman` in place of `docker`.
The build reads its arguments from `.env.example`, inspects the image, and
removes its temporary tag. Record the engine and evidence directory. Check
`container-image/build.exit`, `image-id.txt` and `side-effects.txt` against the
[image recipe](features/container-image.md).

## Cleanup and failures

The bootstrap and MCP drives delete their own scratch homes. The image build
removes its run-specific tag. Evidence remains under `verifications/evidence/`.
For a failed drive, report the command, the observed failure, and the evidence
path. For mount or post-create changes, record the host rebuild separately.
