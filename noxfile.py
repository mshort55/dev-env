"""Repository verification: run `nox`, or select sessions with `nox -s NAME`."""

from __future__ import annotations

import json
import shutil
import subprocess
from collections.abc import Iterable
from pathlib import Path

import nox

ROOT = Path(__file__).resolve().parent
nox.options.sessions = ["lint", "types", "shell", "tests", "integration"]
nox.options.default_venv_backend = "uv"
nox.options.reuse_venv = "yes"
nox.options.stop_on_first_error = False
nox.options.error_on_missing_interpreters = True


def source_files(root: Path = ROOT) -> tuple[list[str], list[str]]:
    """Find tracked and new Python/shell sources, including hidden directories."""
    output = subprocess.check_output(["node", ROOT / "scripts/discover.ts"], cwd=root, text=True)
    sources = json.loads(output)
    return sources["python"], sources["shell"]


def prepare(session: nox.Session) -> None:
    """Install the locked tooling and runtime dependencies in this session."""
    session.chdir(ROOT)
    session.env["PYTHONDONTWRITEBYTECODE"] = "1"
    session.install("--require-hashes", "-r", "requirements/verification.txt")


def require_tools(session: nox.Session, *names: str) -> None:
    """Fail visibly when an external prerequisite is unavailable."""
    missing = [name for name in names if shutil.which(name) is None]
    if missing:
        session.error("Missing required tools: " + ", ".join(missing))


def run_checks(
    session: nox.Session, commands: Iterable[list[str]], *, external: bool = False
) -> None:
    """Run independent checks to completion and report all failures."""
    failures: list[str] = []
    for command in commands:
        try:
            session.run(*command, external=external)
        except nox.command.CommandFailed:
            failures.append(" ".join(command))
    if failures:
        session.error("Failed checks:\n" + "\n".join(failures))


@nox.session(python="3.12")
def lint(session: nox.Session) -> None:
    """Check Python lint rules and formatting without editing files."""
    prepare(session)
    python, _ = source_files()
    run_checks(session, [["ruff", "check", *python], ["ruff", "format", "--check", *python]])


@nox.session(python="3.12")
def types(session: nox.Session) -> None:
    """Require complete function annotations and check Python types."""
    prepare(session)
    python, _ = source_files()
    session.run("mypy", *python)


@nox.session(python="3.12")
def shell(session: nox.Session) -> None:
    """Check all active shell sources with ShellCheck and shfmt."""
    prepare(session)
    _, scripts = source_files()
    run_checks(session, [["shellcheck", *scripts], ["shfmt", "-d", "-i", "2", "-ci", *scripts]])


@nox.session(python="3.12")
def tests(session: nox.Session) -> None:
    """Discover and run Python tests and every shell test under tests/."""
    prepare(session)
    require_tools(session, "bash", "codex", "curl")
    session.env["CODEX_REPRO_ROOT"] = str(ROOT / ".nox" / "codex-repro")
    python, scripts = source_files()
    python_tests = [
        path
        for path in python
        if path.startswith("tests/")
        and (Path(path).name.startswith("test_") or Path(path).name.endswith("_test.py"))
    ]
    commands = [["pytest", *python_tests]]
    commands.extend(["bash", path] for path in scripts if path.startswith("tests/"))
    run_checks(session, commands, external=True)


@nox.session(python="3.12")
def integration(session: nox.Session) -> None:
    """Verify bootstrap, the container image, and isolated MCP startup."""
    prepare(session)
    require_tools(session, "bash", "codex", "uv", "uvx", "git")
    if session.posargs not in ([], ["--bootstrap-only"]):
        session.error("Expected no arguments or --bootstrap-only")
    if not session.posargs:
        require_tools(session, "docker")
    run_checks(
        session,
        [
            ["bash", "verifications/verify.sh", *session.posargs],
            ["python", "verifications/scripts/check_mcp.py"],
        ],
        external=True,
    )


@nox.session(python="3.12", default=False)
def format(session: nox.Session) -> None:
    """Apply Python lint fixes and format Python and shell sources."""
    prepare(session)
    python, scripts = source_files()
    run_checks(
        session,
        [
            ["ruff", "check", "--fix", *python],
            ["ruff", "format", *python],
            ["shfmt", "-w", "-i", "2", "-ci", *scripts],
        ],
    )
