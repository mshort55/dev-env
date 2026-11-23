import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('launcher reports the missing OAuth file in the configured Codex home', (t) => {
  const home = mkdtempSync(join(tmpdir(), 'workspace-launcher-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, ['scripts/google-workspace-mcp.ts'], {
    env: { HOME: home, CODEX_HOME: join(home, 'codex'), PATH: process.env.PATH },
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.ok(
    result.stderr.includes(
      `client file is missing: ${join(home, 'codex/google-workspace/oauth.env')}`,
    ),
  );
});

test('launcher imports existing quoted credentials and starts only the read-only tool groups', (t) => {
  const home = mkdtempSync(join(tmpdir(), 'workspace-launcher-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const directory = join(home, '.codex/google-workspace');
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, 'oauth.env'),
    "export GOOGLE_OAUTH_CLIENT_ID=fixture-id\nexport GOOGLE_OAUTH_CLIENT_SECRET='test '\"'\"' value'\n",
  );
  writeFileSync(
    join(home, 'uvx'),
    '#!/bin/sh\nprintf "%s\\n" "$GOOGLE_OAUTH_CLIENT_SECRET" "$WORKSPACE_MCP_CREDENTIALS_DIR" "$@"\n',
    { mode: 0o700 },
  );
  const result = spawnSync(process.execPath, ['scripts/google-workspace-mcp.ts'], {
    env: { HOME: home, PATH: `${home}:${process.env.PATH}`, WORKSPACE_MCP_VERSION: '2.2.1' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.stdout.trimEnd().split('\n'), [
    "test ' value",
    join(directory, 'credentials-read-only'),
    '--python',
    '/usr/bin/python3',
    '--constraints',
    join(process.cwd(), 'requirements/workspace-mcp.txt'),
    'workspace-mcp@2.2.1',
    '--transport',
    'stdio',
    '--tools',
    'drive',
    'docs',
    'sheets',
    'slides',
    '--read-only',
  ]);
});
