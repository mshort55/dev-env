import { workspaceCredentialsDirectory } from './workspace-credentials.ts';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const repo = resolve(process.env.DEV_ENV_DIR || join(import.meta.dirname, '..'));
const directory = workspaceCredentialsDirectory();
process.env.PATH = `${join(homedir(), '.local/bin')}:${process.env.PATH}`;

function required(name: string) {
  const value = process.env[name];
  if (!value) {
    console.error(`Set ${name} from dev-env .env before configuring Google Workspace MCP`);
    process.exit(1);
  }
  return value;
}
function run(command: string, args: string[], input?: Buffer) {
  const result = spawnSync(command, args, {
    input,
    stdio: [input ? 'pipe' : 'inherit', 'inherit', 'inherit'],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const version = required('WORKSPACE_MCP_VERSION');
const probe = spawnSync('uv', ['--version'], { stdio: 'ignore' });
if ((probe.error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') {
  const url = `https://astral.sh/uv/${required('UV_VERSION')}/install.sh`;
  const installer = spawnSync('curl', ['-fsSL', url], { stdio: ['ignore', 'pipe', 'inherit'] });
  if (installer.error) throw installer.error;
  if (installer.status !== 0) process.exit(installer.status ?? 1);
  run('sh', [], installer.stdout);
}
run('uv', [
  'tool',
  'install',
  '--force',
  '--python',
  '/usr/bin/python3',
  '--constraints',
  join(repo, 'requirements/workspace-mcp.txt'),
  `workspace-mcp==${version}`,
]);
for (const path of [directory, join(directory, 'credentials-read-only')]) {
  mkdirSync(path, { recursive: true, mode: 0o700 });
  chmodSync(path, 0o700);
}
run('codex', [
  'mcp',
  'add',
  '--env',
  `WORKSPACE_MCP_VERSION=${version}`,
  'google-workspace',
  '--',
  'node',
  join(repo, 'scripts/google-workspace-mcp.ts'),
]);
if (!existsSync(join(directory, 'oauth.env'))) {
  console.log(
    `Google Workspace MCP registered; OAuth client credentials are not loaded yet. Run node scripts/bootstrap-secrets.ts to create ${join(directory, 'oauth.env')} from KeePass.`,
  );
}
