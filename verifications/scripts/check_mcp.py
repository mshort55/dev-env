#!/usr/bin/env python3
"""Exercise Workspace MCP setup and stdio with fixture credentials in a scratch home."""

from __future__ import annotations

import asyncio
import json
import os
import subprocess
import tempfile
import tomllib
from datetime import UTC, datetime
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

ROOT = Path(__file__).resolve().parents[2]
LAUNCHER = ROOT / "scripts/google-workspace-mcp.sh"


async def check_stdio(env: dict[str, str], evidence: Path) -> None:
    server = StdioServerParameters(command="bash", args=[str(LAUNCHER)], env=env)
    with (evidence / "server.log").open("w") as log:
        async with asyncio.timeout(120):
            async with stdio_client(server, errlog=log) as (read, write):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    result = await session.list_tools()
                    names = {tool.name for tool in result.tools}
                    required = {
                        "search_drive_files",
                        "get_doc_content",
                        "read_sheet_values",
                        "get_presentation",
                    }
                    if not required.issubset(names):
                        raise RuntimeError(f"Missing Workspace tools: {required - names}")
                    mutating = {
                        name
                        for name in names
                        if name.startswith(
                            ("create_", "update_", "delete_", "send_", "write_", "batch_update_")
                        )
                    }
                    if mutating:
                        raise RuntimeError(f"Unexpected write tools: {mutating}")
                    (evidence / "tools.json").write_text(json.dumps(sorted(names), indent=2) + "\n")
                    print(f"Workspace MCP initialize and tools/list passed ({len(names)} tools)")


def check_setup(home: Path, evidence: Path) -> None:
    versions = dict(
        line.split("=", 1)
        for line in (ROOT / ".env.example").read_text().splitlines()
        if line.startswith(("WORKSPACE_MCP_VERSION=", "UV_VERSION="))
    )
    # Pass only runtime prerequisites; keep operator credentials and config out of the child.
    env = {
        "PATH": os.environ["PATH"],
        "HOME": str(home),
        "CODEX_HOME": str(home / ".codex"),
        "UV_TOOL_DIR": str(home / "uv-tools"),
        "UV_TOOL_BIN_DIR": str(home / ".local/bin"),
        "UV_CACHE_DIR": str(home / "cache/uv"),
        "XDG_CACHE_HOME": str(home / "cache"),
        "XDG_CONFIG_HOME": str(home / ".config"),
        "DEV_ENV_DIR": str(ROOT),
        "PYTHONDONTWRITEBYTECODE": "1",
        **versions,
    }
    with (evidence / "setup.log").open("w") as log:
        subprocess.run(
            ["bash", str(ROOT / "scripts/setup-google-workspace-mcp.sh")],
            env=env,
            stdout=log,
            stderr=subprocess.STDOUT,
            check=True,
            timeout=300,
        )
    config = tomllib.loads((home / ".codex/config.toml").read_text())
    server = config["mcp_servers"]["google-workspace"]
    if server["command"] != "bash" or server["args"] != [str(LAUNCHER)]:
        raise RuntimeError("Codex registration does not point to the Workspace launcher")
    if server["env"]["WORKSPACE_MCP_VERSION"] != versions["WORKSPACE_MCP_VERSION"]:
        raise RuntimeError("Codex registration has the wrong Workspace version")

    oauth = home / ".codex/google-workspace/oauth.env"
    cases = [
        (None, "client file is missing"),
        ("", "client ID is missing"),
        ("export GOOGLE_OAUTH_CLIENT_ID=verify-client-id\n", "client secret is missing"),
    ]
    for content, expected in cases:
        if content is not None:
            oauth.write_text(content)
            oauth.chmod(0o600)
        result = subprocess.run(
            ["bash", str(LAUNCHER)],
            env=env,
            capture_output=True,
            text=True,
            timeout=15,
        )
        if result.returncode == 0 or expected not in result.stderr:
            raise RuntimeError(f"Missing-credential check failed: {expected}: {result.stderr}")
    oauth.write_text(
        "export GOOGLE_OAUTH_CLIENT_ID=verify-client-id\n"
        "export GOOGLE_OAUTH_CLIENT_SECRET=verify-client-secret\n"
    )
    oauth.chmod(0o600)
    asyncio.run(check_stdio(env, evidence))


def main() -> None:
    run_id = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ") + f"-{os.getpid()}"
    evidence = ROOT / "verifications/evidence" / f"mcp-{run_id}"
    evidence.mkdir(mode=0o700, parents=True)
    print(f"Workspace MCP evidence: {evidence}", flush=True)
    with tempfile.TemporaryDirectory(prefix="dev-env-mcp-") as scratch:
        check_setup(Path(scratch), evidence)
    (evidence / "result.txt").write_text(
        "passed; scratch home removed; no Google API tools called\n"
    )


if __name__ == "__main__":
    main()
