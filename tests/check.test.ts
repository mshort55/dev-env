import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const runner = resolve(import.meta.dirname, '../scripts/check.ts');

test('selected checks report missing prerequisites and still run the next check', () => {
  const result = spawnSync(process.execPath, [runner, 'mcp', 'types'], {
    env: { ...process.env, PATH: '' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing required tools: .*codex/);
  assert.match(result.stdout, /^Running types$/m);
  assert.match(result.stderr, /Failed checks:[\s\S]*mcp/);
});

test('types checks all discovered extensions inside a hidden source directory', (t) => {
  const cwd = mkdtempSync(join(tmpdir(), 'dev-env-types-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const root = resolve(import.meta.dirname, '..');
  cpSync(join(root, 'scripts'), join(cwd, 'scripts'), { recursive: true });
  for (const name of ['tsconfig.json', 'package.json']) cpSync(join(root, name), join(cwd, name));
  symlinkSync(join(root, 'node_modules'), join(cwd, 'node_modules'));
  assert.equal(spawnSync('git', ['init', '-q'], { cwd }).status, 0);
  mkdirSync(join(cwd, '.tools'));
  for (const ext of ['ts', 'mts', 'cts'])
    writeFileSync(join(cwd, '.tools/tool.' + ext), 'const answer: number = "invalid";');
  const result = spawnSync(process.execPath, ['scripts/check.ts', 'types'], {
    cwd,
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  for (const ext of ['ts', 'mts', 'cts'])
    assert.ok(result.stdout.includes('.tools/tool.' + ext + '('), result.stdout);
});
