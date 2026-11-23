import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const runner = new URL('../scripts/check.ts', import.meta.url).pathname;

test('selected checks report missing prerequisites and still run the next check', () => {
  const result = spawnSync(process.execPath, [runner, 'mcp', 'types'], {
    env: { ...process.env, PATH: '' }, encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing required tools: .*codex/);
  assert.match(result.stdout, /^Running types$/m);
  assert.match(result.stderr, /Failed checks:[\s\S]*mcp/);
});
