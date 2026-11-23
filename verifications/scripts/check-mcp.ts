import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const repo = resolve(import.meta.dirname, '../..');
const timestamp = new Date()
  .toISOString()
  .replaceAll(/[-:]/g, '')
  .replace(/\.\d{3}Z$/, 'Z');
const evidence = join(repo, 'verifications/evidence', `mcp-${timestamp}-${process.pid}`);
mkdirSync(evidence, { mode: 0o700, recursive: true });
console.log(`Workspace MCP evidence: ${evidence}`);
const home = mkdtempSync(join(tmpdir(), 'dev-env-mcp-'));
const directory = join(home, '.codex/google-workspace');
const credentials = join(directory, 'credentials-read-only');
const oauth = join(directory, 'oauth.env');
const oauthFixture =
  'export GOOGLE_OAUTH_CLIENT_ID=verify-client-id\nexport GOOGLE_OAUTH_CLIENT_SECRET=verify-client-secret\n';
const tokenFile = join(credentials, 'fixture.json');
const tokenFixture = JSON.stringify({ refresh_token: 'disposable-refresh-token' });
const versionPins = Object.fromEntries(
  readFileSync(join(repo, '.env.example'), 'utf8')
    .split('\n')
    .filter((line) => /^(WORKSPACE_MCP_VERSION|UV_VERSION)=/.test(line))
    .map((line) => line.split('=')),
);
const env = {
  PATH: process.env.PATH || '/usr/bin:/bin',
  HOME: home,
  CODEX_HOME: join(home, '.codex'),
  UV_TOOL_DIR: join(home, 'uv-tools'),
  UV_TOOL_BIN_DIR: join(home, '.local/bin'),
  UV_CACHE_DIR: join(home, 'cache/uv'),
  XDG_CACHE_HOME: join(home, 'cache'),
  XDG_CONFIG_HOME: join(home, '.config'),
  DEV_ENV_DIR: repo,
  PYTHONDONTWRITEBYTECODE: '1',
  ...versionPins,
};
const setupLog = openSync(join(evidence, 'setup.log'), 'w', 0o600);
const launcher = join(repo, 'scripts/google-workspace-mcp.ts');
function run(command: string, ...args: string[]) {
  const result = spawnSync(command, args, {
    env,
    stdio: ['ignore', 'pipe', setupLog],
    encoding: 'utf8',
    timeout: 300_000,
  });
  writeFileSync(setupLog, result.stdout ?? '');
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${command} failed; see ${join(evidence, 'setup.log')}`);
  return result.stdout;
}
function setup() {
  return run(process.execPath, join(repo, 'scripts/setup-google-workspace-mcp.ts'));
}

type Registration = {
  name: string;
  enabled: boolean;
  transport: { command: string; args: string[]; env: Record<string, string> };
};
function registrations(): Registration[] {
  return JSON.parse(run('codex', 'mcp', 'list', '--json'));
}
async function checkStartup(label: string) {
  const servers = registrations().filter((server) => server.name === 'google-workspace');
  assert.equal(servers.length, 1);
  const [server] = servers;
  assert.ok(server.enabled);
  const { command, args, env: saved } = server.transport;
  assert.equal(command, 'node');
  assert.deepEqual(args, [launcher]);
  assert.equal(saved.WORKSPACE_MCP_VERSION, versionPins.WORKSPACE_MCP_VERSION);
  const log = openSync(join(evidence, 'server.log'), 'a', 0o600);
  const client = new Client({ name: 'dev-env-verification', version: '1' });
  try {
    const transport = new StdioClientTransport({
      command,
      args,
      env: { ...env, ...saved },
      stderr: log,
    });
    await client.connect(transport, { timeout: 120_000 });
    const names: string[] = [];
    let cursor: string | undefined;
    do {
      const response = await client.listTools({ cursor });
      names.push(...response.tools.map((tool) => tool.name));
      cursor = response.nextCursor;
    } while (cursor);
    names.sort();
    writeFileSync(join(evidence, 'tools.json'), `${JSON.stringify(names, null, 2)}\n`);
    // The pinned server exposes this tool surface with drive, docs, sheets and slides in read-only mode.
    assert.deepEqual(names, [
      'check_drive_file_public_access',
      'debug_table_structure',
      'get_doc_as_markdown',
      'get_doc_content',
      'get_drive_file_content',
      'get_drive_file_download_url',
      'get_drive_file_permissions',
      'get_drive_shareable_link',
      'get_page',
      'get_presentation',
      'get_spreadsheet_info',
      'inspect_doc_structure',
      'list_docs_in_folder',
      'list_document_comments',
      'list_drive_items',
      'list_presentation_comments',
      'list_sheet_tables',
      'list_spreadsheet_comments',
      'list_spreadsheets',
      'read_sheet_values',
      'render_page_to_image',
      'search_docs',
      'search_drive_files',
      'start_google_auth',
    ]);
    console.log(`${label}: initialize and tools/list passed (${names.length} tools)`);
  } finally {
    try {
      await client.close();
    } finally {
      closeSync(log);
    }
  }
}

try {
  mkdirSync(env.CODEX_HOME, { mode: 0o700 });
  assert.match(setup(), /OAuth client credentials are not loaded yet/);
  assert.equal(statSync(directory).mode & 0o777, 0o700);
  assert.equal(statSync(credentials).mode & 0o777, 0o700);
  for (const [content, expected] of [
    [undefined, 'client file is missing'],
    ['', 'client ID is missing'],
    ['export GOOGLE_OAUTH_CLIENT_ID=verify-client-id\n', 'client secret is missing'],
  ] as const) {
    if (content !== undefined) writeFileSync(oauth, content, { mode: 0o600 });
    const result = spawnSync(process.execPath, [launcher], {
      env,
      timeout: 15_000,
      encoding: 'utf8',
    });
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes(expected), result.stderr);
  }
  writeFileSync(oauth, oauthFixture);
  await checkStartup('Fresh registration');

  run(
    'codex',
    'mcp',
    'add',
    '--env',
    `WORKSPACE_MCP_VERSION=${versionPins.WORKSPACE_MCP_VERSION}`,
    'google-workspace',
    '--',
    'bash',
    join(repo, 'scripts/google-workspace-mcp.sh'),
  );
  run(
    'codex',
    'mcp',
    'add',
    '--env',
    'FIXTURE=yes',
    'unrelated-fixture',
    '--',
    'echo',
    'unrelated',
  );
  const unrelated = registrations().find((server) => server.name === 'unrelated-fixture');
  assert.ok(unrelated);
  writeFileSync(tokenFile, tokenFixture, { mode: 0o600 });
  for (const path of [directory, credentials]) chmodSync(path, 0o755);
  setup();
  setup();
  assert.deepEqual(
    registrations().find((server) => server.name === 'unrelated-fixture'),
    unrelated,
  );
  assert.equal(readFileSync(oauth, 'utf8'), oauthFixture);
  assert.equal(readFileSync(tokenFile, 'utf8'), tokenFixture);
  for (const path of [oauth, tokenFile]) assert.equal(statSync(path).mode & 0o777, 0o600);
  for (const path of [directory, credentials]) assert.equal(statSync(path).mode & 0o777, 0o700);
  await checkStartup('Upgraded registration after two setup runs');
} finally {
  closeSync(setupLog);
  rmSync(home, { recursive: true, force: true });
}
assert.ok(!existsSync(home));
writeFileSync(
  join(evidence, 'result.txt'),
  'passed; scratch home removed; no Google API tools called\n',
);
