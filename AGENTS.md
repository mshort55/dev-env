# dev-env

## Container changes

- Put image-level tool installs in the [Dockerfile](.devcontainer/dev/Dockerfile). Configure VS Code extensions and container features in [devcontainer.json](.devcontainer/dev/devcontainer.json). Update the corresponding lockfile when changing a pinned dependency.
- Put shared environment defaults in [.env.example](.env.example) and machine-specific values in the local `.env`. If you rename the workspace mount, update `workspaceFolder` in `devcontainer.json` to match.

## Verification

Run `nox` from the checkout root for the full suite. For a focused check, use `nox -l` to list sessions and `nox -s <session>` to run one. See the [verification prerequisites](README.md#verification) for setup and container engine requirements.

For changes to container features or post-create setup, verify the affected behavior in a freshly rebuilt development container. The Nox integration session exercises the image and bootstrap scripts independently of that lifecycle.
