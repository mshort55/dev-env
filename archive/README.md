# Archived Multiclaude And Ruflo Support

This directory preserves the retired `multiclaude` and `ruflo` setup without keeping it in the active repository surface area.

The layout intentionally mirrors the original repository-relative paths:

- `archive/.devcontainer/multiclaude/`
- `archive/.devcontainer/ruflo/`
- `archive/scripts/bootstrap-secrets-multiclaude.py`
- `archive/scripts/bootstrap-secrets-ruflo.py`

The archived files are preserved verbatim for easy restoration and are not expected to run from inside `archive/`. If you want to restore one of these environments, move the files back to their original locations at the repository root and uncomment the matching variables from the `Archived` section at the bottom of `.env` and `.env.example`.
