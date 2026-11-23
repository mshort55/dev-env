import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

test('discovery lists active tracked and new sources, including hidden directories', t => {
  const cwd = mkdtempSync(join(tmpdir(), 'dev-env-sources-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q'], { cwd });
  for (const [name, content] of Object.entries({
    '.gitignore': 'ignored/\n',
    'scripts/tracked.py': 'pass',
    'scripts/new file.ts': '',
    '.devcontainer/start.sh': '',
    '.hidden/tool.ts': '',
    'scripts/library.bash': '',
    'scripts/custom.ext': '#!/bin/bash',
    'scripts/extensionless': '#!/usr/bin/env bash',
    'scripts/options': '#!/usr/bin/env -S bash -e',
    'scripts/data': 'bash is mentioned here',
    'archive/old.py': '',
    'verifications/evidence/run/copy.sh': '',
    'ignored/local.ts': '',
    'node_modules/dep/index.ts': '',
    '.venv/lib/dep.py': '',
    'deleted.ts': '',
  })) {
    const path = join(cwd, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  execFileSync('git', ['add', 'scripts/tracked.py', 'archive/old.py', 'deleted.ts'], { cwd });
  rmSync(join(cwd, 'deleted.ts'));
  symlinkSync('scripts/tracked.py', join(cwd, 'link.py'));
  const script = fileURLToPath(new URL('../scripts/discover.ts', import.meta.url));
  const result = execFileSync(process.execPath, [script], { cwd, encoding: 'utf8' });
  assert.deepEqual(JSON.parse(result), {
    typescript: ['.hidden/tool.ts', 'scripts/new file.ts'],
    python: ['scripts/tracked.py'],
    shell: ['.devcontainer/start.sh', 'scripts/custom.ext', 'scripts/extensionless', 'scripts/library.bash', 'scripts/options'],
  });
});
