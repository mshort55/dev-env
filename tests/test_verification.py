"""Exercise file discovery and failure reporting with real Git and Nox processes."""

import os
import subprocess
import sys
from pathlib import Path

import noxfile


def test_discovery_includes_new_and_hidden_sources_and_excludes_generated_files(
    tmp_path: Path,
) -> None:
    subprocess.run(["git", "init", "-q", str(tmp_path)], check=True)
    files = {
        ".gitignore": "ignored/\n.venv/\n",
        "scripts/tracked.py": "pass\n",
        "scripts/new file.py": "pass\n",
        ".devcontainer/start.sh": "#!/bin/bash\n",
        "scripts/library.bash": ":\n",
        "scripts/custom.extension": "#!/bin/bash\n",
        "scripts/extensionless": "#!/usr/bin/env bash\n",
        "scripts/env-options": "#!/usr/bin/env -S bash -e\n",
        "scripts/data": "bash is mentioned but this is not a script\n",
        "archive/old.py": "pass\n",
        "verifications/evidence/run/copy.sh": "#!/bin/bash\n",
        "ignored/untracked.py": "pass\n",
        ".venv/lib/dep.py": "pass\n",
        "scripts/deleted.py": "pass\n",
    }
    for name, content in files.items():
        path = tmp_path / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)
    subprocess.run(
        ["git", "add", "scripts/tracked.py", "scripts/deleted.py", "archive/old.py"],
        cwd=tmp_path,
        check=True,
    )
    (tmp_path / "scripts/deleted.py").unlink()
    (tmp_path / "scripts/link.py").symlink_to(tmp_path / "scripts/tracked.py")
    python, shell = noxfile.source_files(tmp_path)
    assert python == ["scripts/new file.py", "scripts/tracked.py"]
    assert shell == [
        ".devcontainer/start.sh",
        "scripts/custom.extension",
        "scripts/env-options",
        "scripts/extensionless",
        "scripts/library.bash",
    ]


def test_failed_command_does_not_hide_later_checks_or_sessions(tmp_path: Path) -> None:
    config = tmp_path / "probe_noxfile.py"
    config.write_text("""
import nox
import sys
from noxfile import run_checks

@nox.session(venv_backend="none")
def first(session):
    run_checks(session, [
        [sys.executable, "-c", "raise SystemExit(7)"],
        [sys.executable, "-c", "from pathlib import Path; Path('later-check').touch()"],
    ], external=True)

@nox.session(venv_backend="none")
def second(session):
    session.run(sys.executable, "-c", "from pathlib import Path; Path('later-session').touch()", external=True)
""")
    result = subprocess.run(
        [sys.executable, "-m", "nox", "-f", str(config), "-s", "first", "second"],
        cwd=tmp_path,
        env={**os.environ, "PYTHONPATH": str(noxfile.ROOT)},
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode != 0
    assert (tmp_path / "later-check").exists(), result.stderr
    assert (tmp_path / "later-session").exists(), result.stderr
    assert "Failed checks:" in result.stderr


def test_missing_tool_is_a_failure(tmp_path: Path) -> None:
    config = tmp_path / "probe_noxfile.py"
    config.write_text("""
import nox
from noxfile import require_tools

@nox.session(venv_backend="none")
def prerequisite(session):
    require_tools(session, "dev-env-nonexistent-verification-tool")
""")
    result = subprocess.run(
        [sys.executable, "-m", "nox", "-f", str(config), "-s", "prerequisite"],
        cwd=tmp_path,
        env={**os.environ, "PYTHONPATH": str(noxfile.ROOT)},
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode != 0
    assert "Missing required tools: dev-env-nonexistent-verification-tool" in result.stderr
