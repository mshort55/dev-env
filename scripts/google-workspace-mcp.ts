import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const directory = join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'google-workspace');
const oauth = join(directory, 'oauth.env');
function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
if (!existsSync(oauth)) {
  fail(
    `Google Workspace OAuth client file is missing: ${oauth}. Run node dev-env/scripts/bootstrap-secrets.ts to load the client ID and secret from KeePass.`,
  );
}

// Existing oauth.env files are shell exports. Let Bash read their quoting exactly as written.
const imported = spawnSync(
  'bash',
  [
    '-c',
    'source "$1" && printf "%s\\0%s\\0" "$GOOGLE_OAUTH_CLIENT_ID" "$GOOGLE_OAUTH_CLIENT_SECRET"',
    'oauth',
    oauth,
  ],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
);
if (imported.status !== 0) fail('Could not load Google Workspace OAuth client file');
const [id, secret] = imported.stdout.split('\0');
if (!id) fail('Google OAuth client ID is missing');
if (!secret) fail('Google OAuth client secret is missing');
const version = process.env.WORKSPACE_MCP_VERSION;
if (!version)
  fail('Run node dev-env/scripts/setup-google-workspace-mcp.ts to configure the MCP version');

const repo = process.env.DEV_ENV_DIR || join(import.meta.dirname, '..');
process.env.GOOGLE_OAUTH_CLIENT_ID = id;
process.env.GOOGLE_OAUTH_CLIENT_SECRET = secret;
process.env.WORKSPACE_MCP_CREDENTIALS_DIR = join(directory, 'credentials-read-only');
process.env.PATH = `${join(homedir(), '.local/bin')}:${process.env.PATH}`;
if (!process.execve) fail('The Workspace launcher requires Node.js with POSIX execve support');
process.execve(
  '/usr/bin/env',
  [
    'env',
    'uvx',
    '--python',
    '/usr/bin/python3',
    '--constraints',
    join(repo, 'requirements/workspace-mcp.txt'),
    `workspace-mcp@${version}`,
    '--transport',
    'stdio',
    '--tools',
    'drive',
    'docs',
    'sheets',
    'slides',
    '--read-only',
  ],
  process.env,
);
