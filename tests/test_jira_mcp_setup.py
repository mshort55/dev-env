"""Exercise Jira registration with the real Codex CLI and a disposable home."""

import os
import shutil
import subprocess
import tempfile
import tomllib
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SETUP = REPO / "scripts" / "setup-jira-mcp.sh"


@unittest.skipUnless(shutil.which("codex"), "Codex CLI is required")
class JiraMcpSetupTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.home = Path(self.temp.name)
        self.codex_dir = self.home / "codex"
        self.codex_dir.mkdir()
        self.config = self.codex_dir / "config.toml"
        self.env = {
            **os.environ,
            "HOME": str(self.home),
            "CODEX_HOME": str(self.codex_dir),
            "JIRA_ACCESS_TOKEN": "fixture-token-do-not-persist",
        }

    def run_setup(self) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["bash", str(SETUP)],
            cwd=self.home,
            env=self.env,
            capture_output=True,
            text=True,
        )

    def test_registration_preserves_other_settings_and_forwards_names_only(self) -> None:
        original = '# Keep this comment\n[mcp_servers.other]\ncommand = "other-server"\n'
        self.config.write_text(original)
        result = self.run_setup()
        self.assertEqual(result.returncode, 0, result.stderr)
        contents = self.config.read_text()
        self.assertTrue(contents.startswith(original))
        jira = tomllib.loads(contents)["mcp_servers"]["jira"]
        self.assertEqual(jira["command"], "python3")
        self.assertEqual(jira["args"], ["-m", "jira_mcp_server.main"])
        self.assertEqual(jira["env_vars"], ["JIRA_SERVER_URL", "JIRA_ACCESS_TOKEN", "JIRA_EMAIL"])
        self.assertNotIn(self.env["JIRA_ACCESS_TOKEN"], contents + result.stdout + result.stderr)
        self.assertEqual(self.run_setup().returncode, 0)
        self.assertEqual(self.config.read_text(), contents)

    def test_existing_jira_configuration_is_preserved(self) -> None:
        original = '[mcp_servers.jira]\ncommand = "custom-jira"\nenabled = false\n'
        self.config.write_text(original)
        result = self.run_setup()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.config.read_text(), original)

    def test_missing_credentials_do_not_block_first_registration(self) -> None:
        self.codex_dir.rmdir()
        for name in ("JIRA_SERVER_URL", "JIRA_ACCESS_TOKEN", "JIRA_EMAIL"):
            self.env.pop(name, None)
        result = self.run_setup()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.config.stat().st_mode & 0o777, 0o600)
        self.assertIn("jira", tomllib.loads(self.config.read_text())["mcp_servers"])

    def test_invalid_config_is_not_modified(self) -> None:
        original = "[mcp_servers.\n"
        self.config.write_text(original)
        result = self.run_setup()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.config.read_text(), original)


if __name__ == "__main__":
    unittest.main()
