# Bootstrap secrets

Bootstrap secrets opens the KeePass database at `KEEPASS_DB_PATH`, asks for the master password on the terminal, and writes the available credentials into the current user's home. Missing optional entries are warnings. A missing database path, a missing file, or a wrong password stops the command.

## Sub-features

- `bootstrap-missing-env` exits when `KEEPASS_DB_PATH` is unset.
- `bootstrap-missing-file` exits when that path is not a file.
- `bootstrap-bad-password` rejects the master password after three prompts.
- `bootstrap-oauth` writes a private Google Workspace `oauth.env` and does not print the secret.
- `bootstrap-partial` warns for absent optional entries and still finishes.

## How to get to it (user POV)

- From the dev-env repo, with `KEEPASS_DB_PATH` set, run `python3 scripts/bootstrap-secrets.py` and type the master password at `Enter KeePass master password:`.
- Inside the dev container, `.devcontainer/dev/post-create.sh` runs that same command when `KEEPASS_DB_PATH` is set and the file exists. Verification does not use this entry point.

## Driving it with verify-dev-env

Preconditions:

- `doctor.sh STATE` printed `doctor=ok` for this run.
- `HOME` is `$SCRATCH/home` and is not the operator's home.
- `CODEX_HOME` is unset, so the OAuth file lands at `$HOME/.codex/google-workspace/oauth.env`.
- `GIT_CONFIG_GLOBAL` is `$SCRATCH/home/.gitconfig` and `GNUPGHOME` is `$SCRATCH/home/.gnupg`.

- **Run the feature.** From the repo root, run `bash verifications/scripts/drive-bootstrap.sh STATE`. Stdout ends with `drove feature=bootstrap-secrets evidence=...`. The script performs the four actions below. `bash verifications/verify.sh` runs this feature as part of the full suite.
- **Refuse a missing variable.** Unset `KEEPASS_DB_PATH` and run `python3 scripts/bootstrap-secrets.py`. Exit code `1`. Stdout contains `KEEPASS_DB_PATH environment variable not set`. Evidence: `bootstrap-secrets/missing-env.out` and `missing-env.exit`.
- **Refuse a missing file.** Set `KEEPASS_DB_PATH` to `$SCRATCH/keepass/missing.kdbx` and run `python3 scripts/bootstrap-secrets.py`. Exit code `1`. Stdout contains `KeePass database not found at` that path. Evidence: `bootstrap-secrets/missing-file.out` and `missing-file.exit`.
- **Reject a bad password.** Run `python3 verifications/scripts/pty_run.py --transcript evidence/<run-id>/bootstrap-secrets/wrong-password.txt --timeout 20 --expect 'Enter KeePass master password:' --send 'wrong-password' --expect 'Enter KeePass master password:' --send 'wrong-password' --expect 'Enter KeePass master password:' --send 'wrong-password' --expect 'Failed to open database after 3 attempts' -- python3 scripts/bootstrap-secrets.py` with the scratch `HOME` and `KEEPASS_DB_PATH`. Exit code `1`. The transcript contains `Incorrect password. 2 attempt(s) remaining.` and `Incorrect password. 1 attempt(s) remaining.`
- **Open the fixture and write OAuth credentials.** Run `python3 verifications/scripts/pty_run.py --transcript evidence/<run-id>/bootstrap-secrets/success.txt --timeout 30 --expect 'Enter KeePass master password:' --send-file $SCRATCH/password --expect 'Successfully opened KeePass database' --expect 'Google Workspace MCP credentials configured' --expect 'All secrets configured successfully!' -- python3 scripts/bootstrap-secrets.py`. Exit code `0`.
- **Proof.** `success.txt` contains the three result lines and does not contain the fixture secret or master password. `$HOME/.codex/google-workspace/oauth.env` is mode `600`, its directory is mode `700`, and sourcing it reproduces `OAUTH_CLIENT_ID` and `OAUTH_CLIENT_SECRET` from `STATE`. `$HOME/.gitconfig` contains `gpgsign = true`. The transcript contains `No SSH entry found in database` and `No GPG entry found in database`. `operator-home.before.stats` and `operator-home.after.stats` match. `side-effects.txt` records each of those checks.

## Gotchas

- `getpass` reads `/dev/tty`. Piping the password on stdin leaves the command waiting at the prompt.
- `--send` puts the text in the process list. The real master password goes through `--send-file $SCRATCH/password`.
- Exit code `1` after three wrong passwords is the expected script result. Exit code `2` from `pty_run.py` means the prompt was missed.
- The fixture has no git, SSH, or GPG entries. The script still runs `git config --global` and enables `commit.gpgsign` and `tag.gpgsign`. `GIT_CONFIG_GLOBAL` must point into the scratch home or that write hits the operator's git config.
- Do not set `KEEPASS_DB_PATH` to the operator's database. The prompt will ask for their real master password and the script will write SSH keys, git config, and OAuth files into `HOME`.
- Do not satisfy this feature by calling `setup_google_workspace_mcp_credentials` from the unit test. That path never asks for a password.
