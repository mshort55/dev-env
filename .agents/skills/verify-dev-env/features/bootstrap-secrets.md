# Bootstrap secrets

Bootstrap secrets opens the KeePass database at `KEEPASS_DB_PATH`, asks for the master password on the terminal, and writes the available credentials into the current user's home. Missing optional entries are warnings. A missing database path, a missing file, or a wrong password stops the command.

## Sub-features

- `bootstrap-missing-env` exits when `KEEPASS_DB_PATH` is unset.
- `bootstrap-missing-file` exits when that path is not a file.
- `bootstrap-bad-password` rejects the master password after three prompts.
- `bootstrap-oauth` writes a private Google Workspace `oauth.env` and does not print the secret.
- `bootstrap-partial` warns for absent optional entries and still finishes.

## How to get to it (user POV)

- From the dev-env repo, with `KEEPASS_DB_PATH` set, run `node scripts/bootstrap-secrets.ts` and type the master password at `Enter KeePass master password:`.
- Inside the dev container, `.devcontainer/dev/post-create.ts` runs that same command when `KEEPASS_DB_PATH` is set and the file exists. Verification does not use this entry point.

## Driving it with verify-dev-env

Preconditions: install the pinned Node version and run `npm ci`.

- **Run.** Use `npm run check -- bootstrap`. The doctor opens the disposable database and checks its OAuth entries before the driver starts a child with the scratch home. Its report stays in `doctor.txt`.
- **Missing database.** Inspect `bootstrap-secrets/missing-env.out` and `missing-file.out` for the missing variable and missing path. Each corresponding `.exit` file contains `1`.
- **Rejected password.** Read `wrong-password.txt` for three prompts and the remaining-attempt counts. The process exits with `1`.
- **Successful retry.** Read `success.txt` for a rejected password followed by a successful retry. The process exits with `0`. Read `side-effects.txt` for the verified OAuth file and directory modes, matching values, Git signing settings, and warnings for absent SSH and GPG entries.

## Gotchas

The master-password prompt reads a terminal. The driver uses `verifications/scripts/pty-run.ts` with a mode-`600` password file for the successful attempt. Use the disposable fixture for verification. Running the bootstrap manually against a configured database writes credentials under the active home.
