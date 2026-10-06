"""Check Google Workspace credentials without touching the user's KeePass database."""

import contextlib
import importlib.util
import io
import os
from pathlib import Path
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch


SCRIPT_PATH = Path(__file__).resolve().parents[1] / 'scripts' / 'bootstrap-secrets.py'
spec = importlib.util.spec_from_file_location('bootstrap_secrets', SCRIPT_PATH)
assert spec is not None and spec.loader is not None
bootstrap = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bootstrap)


class GoogleWorkspaceCredentialsTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.task_home = Path(self.temp_dir.name)
        self.addCleanup(patch.stopall)
        patch.object(bootstrap.Path, 'home', return_value=self.task_home).start()
        patch.dict(os.environ, {}, clear=True).start()
        self.oauth_env = self.task_home / '.codex' / 'google-workspace' / 'oauth.env'

    def configure(self, entries):
        kp = SimpleNamespace(find_entries=lambda title, first: entries.get(title))
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            bootstrap.setup_google_workspace_mcp_credentials(kp)
        return output.getvalue()

    def entries(self, client_id='test-client', secret='test-secret'):
        return {
            'google_workspace_mcp_env_GOOGLE_OAUTH_CLIENT_ID': SimpleNamespace(password=client_id),
            'google_workspace_mcp_env_GOOGLE_OAUTH_CLIENT_SECRET': SimpleNamespace(password=secret),
        }

    def test_missing_entries_warn_without_writing(self):
        output = self.configure({})
        self.assertIn('GOOGLE_OAUTH_CLIENT_ID entry not found', output)
        self.assertIn('GOOGLE_OAUTH_CLIENT_SECRET entry not found', output)
        self.assertFalse(self.oauth_env.exists())

    def test_partial_entries_preserve_existing_credentials(self):
        self.configure(self.entries())
        previous = self.oauth_env.read_bytes()
        output = self.configure(self.entries(client_id='new-client', secret=''))
        self.assertIn('Skipping Google Workspace MCP credentials', output)
        self.assertEqual(self.oauth_env.read_bytes(), previous)

    def test_credentials_are_private_and_not_logged_or_exported_globally(self):
        output = self.configure(self.entries())
        self.assertEqual(self.oauth_env.stat().st_mode & 0o777, 0o600)
        self.assertEqual(self.oauth_env.parent.stat().st_mode & 0o777, 0o700)
        self.assertNotIn('test-client', output)
        self.assertNotIn('test-secret', output)
        self.assertFalse((self.task_home / '.bashrc').exists())
        self.assertNotIn('GOOGLE_OAUTH_CLIENT_SECRET', os.environ)

    def test_shell_metacharacters_round_trip_without_execution(self):
        marker = self.task_home / 'unexpected-command'
        secret = f"quote' whitespace\n$(touch {marker}) `touch {marker}`"
        self.configure(self.entries(secret=secret))
        result = subprocess.run(
            ['bash', '-c', 'source "$1"; printf "%s" "$GOOGLE_OAUTH_CLIENT_SECRET"',
             'credentials-test', str(self.oauth_env)],
            check=True, capture_output=True, text=True,
        )
        self.assertEqual(result.stdout, secret)
        self.assertFalse(marker.exists())

    def test_rotation_replaces_credentials_without_duplicate_exports(self):
        self.configure(self.entries())
        self.configure(self.entries(secret='rotated-secret'))
        contents = self.oauth_env.read_text()
        self.assertIn('rotated-secret', contents)
        self.assertNotIn('test-secret', contents)
        self.assertEqual(contents.count('export GOOGLE_OAUTH_CLIENT_SECRET='), 1)
        self.assertEqual(list(self.oauth_env.parent.iterdir()), [self.oauth_env])


class GoogleWorkspaceStartupTests(unittest.TestCase):
    def test_first_start_loads_keepass_before_checking_oauth_client_file(self):
        post_create = SCRIPT_PATH.parents[1] / '.devcontainer' / 'dev' / 'post-create.sh'
        # Load the real startup sequence without executing its final main call.
        script = post_create.read_text().rsplit('\nmain', 1)[0]
        script += '''
fix_apt_sources() { :; }
setup_shell_paths() { :; }
install_npm_clis() { :; }
install_python_deps() { :; }
setup_completions() { :; }
setup_atuin() { :; }
setup_claude_mcp_servers() { :; }
setup_and_unlock_dummy_keyring() { :; }
task_oauth_file="$1"
bootstrap_secrets() { touch "$task_oauth_file"; }
setup_google_workspace_mcp() {
  if [ ! -f "$task_oauth_file" ]; then
    echo "OAuth client file checked before KeePass bootstrap" >&2
    return 1
  fi
}
main
'''
        with tempfile.TemporaryDirectory() as task_dir:
            result = subprocess.run(
                ['bash', '-c', script, 'startup-test', str(Path(task_dir) / 'oauth.env')],
                env={**os.environ, 'DEV_ENV_DIR': str(SCRIPT_PATH.parents[1])},
                capture_output=True, text=True,
            )
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == '__main__':
    unittest.main()
