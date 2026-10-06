---
name: verify-dev-env
description: >-
  Verify dev-env from verifications/verify.sh: KeePass bootstrap on a
  disposable home, then an image build from .env.example. Use when checking
  bootstrap behavior or that the dev container image builds. The script does
  not start the shared dev container.
---

# Verify dev-env

Skill docs live in `.agents/skills/verify-dev-env/`. The runnable scripts live in `verifications/`. Run all of them from the dev-env repo root:

```bash
bash verifications/verify.sh
```

That entry point launches a scratch home, checks it, drives the KeePass bootstrap, builds the dev container image from `.env.example`, and then deletes the scratch home and the verify image tag. Proof stays in `verifications/evidence/<run-id>/`.

The shared container named `dev` is not started. `.devcontainer/dev/compose.yml` pins that name and bind-mounts the operator's Claude, Cursor, Codex, repository, and workspace directories. The image build uses `podman build` or `docker build` with tag `dev-env:verify-<run-id>`, then removes that tag. It does not read `.env` and does not tag `dev-env:latest`.

## Launch

`verifications/verify.sh` calls `verifications/scripts/launch.sh`. There is no server. A run is ready when launch prints `ready state=/tmp/dev-env-verify-<run-id>/state.env evidence=...` and doctor prints `doctor=ok`.

`launch.sh` creates a mode-`700` scratch directory, a disposable KeePass database containing only the two Google Workspace OAuth fixture entries, a mode-`600` password file, and the evidence directory. It installs `requirements.txt` into a scratch virtualenv only when `python3` cannot import `pykeepass`.

Source the state file only inside a subshell or inside the helper scripts. It sets `HOME` to the scratch home.

## Doctor

```bash
bash verifications/scripts/doctor.sh /tmp/dev-env-verify-<run-id>/state.env
```

Doctor is read-only. It must print `surface=cli`, `container=not-used`, `forbidden_container_name=dev`, `keepass=opens`, `oauth_entries=present`, and `doctor=ok`. It fails closed when the scratch path, `HOME`, `GIT_CONFIG_GLOBAL`, `GNUPGHOME`, or `KEEPASS_DB_PATH` is outside `/tmp/dev-env-verify-<run-id>`, or when `HOME` is the operator's home. A failed doctor means do not drive.

## Drive

Read `.agents/skills/verify-dev-env/features/README.md`, then the feature file. Drive the real scripts. Do not import `bootstrap-secrets.py` and call `setup_*` functions; `tests/test_google_workspace_mcp.py` already does that.

`scripts/bootstrap-secrets.py` asks for the master password with `getpass`, which reads `/dev/tty`. Feed it through `pty_run.py`. A stdin pipe never reaches the prompt.

Bootstrap alone:

```bash
bash verifications/scripts/drive-bootstrap.sh /tmp/dev-env-verify-<run-id>/state.env
```

Image build alone, after launch:

```bash
bash verifications/scripts/build-image.sh /tmp/dev-env-verify-<run-id>/state.env
```

The build passes each `args` name from `.devcontainer/dev/compose.yml` using the literal value in `.env.example`. `HOST_*` paths are not build args and are not read. A successful build downloads the software the Dockerfile installs. It does not run `.devcontainer/dev/post-create.sh`. The `hcp` client and Rust stay commented out in the Dockerfile, so this build does not download them.

Set `PYTHONDONTWRITEBYTECODE=1` for every Python drive so the repo does not gain `__pycache__`.

## Evidence

Proof goes to `verifications/evidence/<run-id>/`. `launch.sh` writes `run.env` there (paths only, no password). `drive-bootstrap.sh` writes `bootstrap-secrets/`. `build-image.sh` writes `container-image/`, including `build.log`, `build.exit`, and `image-id.txt`.

A bootstrap proof is complete only when all of these are true:

- The transcript shows the prompt and the result lines, and the exit code file matches the feature (`1` for a refused run, `0` for a finished bootstrap).
- `bootstrap-secrets/side-effects.txt` records mode `600` on `oauth.env`, mode `700` on its directory, matching fixture values, and that the master password and OAuth secret are absent from `success.txt`.
- `operator-home.before.stats` and `operator-home.after.stats` are identical, so the operator's `~/.gitconfig`, `~/.bashrc`, `~/.codex`, and `~/.ssh` were not rewritten.
- The scratch `~/.gitconfig` contains `gpgsign = true` even though the fixture has no git identity entries. That write is the real script, isolated by `GIT_CONFIG_GLOBAL`.

An image proof is complete when `container-image/build.exit` is `0`, `image-id.txt` is a single image id, and `side-effects.txt` records `container_started=no`, `latest_tag_used=no`, and `image_removed=yes`.

Capture the command output and the files the command created. Do not treat a unit test, a mocked `PyKeePass`, or a successful process start by itself as proof.

## Cleanup

`verifications/verify.sh` always runs cleanup, including after a failure. To clean up a run you started by hand:

```bash
bash verifications/scripts/cleanup.sh /tmp/dev-env-verify-<run-id>/state.env
```

Cleanup deletes that scratch directory and, if the build was interrupted, the `dev-env:verify-<run-id>` image tag. It refuses any other image tag, refuses paths that are not `/tmp/dev-env-verify-*`, and refuses to run when the evidence directory is missing or sits inside the scratch directory. It does not kill processes by name.

After cleanup, the evidence directory from the `cleaned ... evidence=` line must still exist. A cleanup that removes the proof is a failed cleanup.

## Helpers

Command paths below are from the dev-env repo root. Scripts live in `verifications/`. Feature notes live next to this file.

- `bash verifications/verify.sh` runs launch, doctor, bootstrap, the image build, and cleanup.
- `bash verifications/scripts/launch.sh` creates the scratch home, fixture database, state file, and evidence directory. Prints `ready state=... evidence=...`.
- `bash verifications/scripts/doctor.sh STATE` performs the read-only readiness check. Prints `doctor=ok` or exits non-zero.
- `bash verifications/scripts/drive-bootstrap.sh STATE` drives every bootstrap sub-feature and writes `evidence/<run-id>/bootstrap-secrets/`.
- `bash verifications/scripts/build-image.sh STATE` builds from `.env.example`, records the image id, and removes the verify tag.
- `python3 verifications/scripts/pty_run.py --transcript PATH [--timeout SEC] [--expect TEXT [--send TEXT | --send-file PATH]]... -- COMMAND...` runs `COMMAND` on a PTY. Use `--send-file` for the master password so it is not a process argument. Exit `2` means a prompt was missed.
- `bash verifications/scripts/cleanup.sh STATE` deletes the scratch directory and prints `cleaned scratch=... evidence=...`.
