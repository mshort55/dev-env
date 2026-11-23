import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const verify = resolve(import.meta.dirname, '../verifications/verify.ts');

for (const succeeds of [true, false]) {
  test(`bootstrap keeps evidence and removes scratch after ${succeeds ? 'success' : 'failure'}`, () => {
    const result = spawnSync(process.execPath, [verify, '--bootstrap-only'], {
      encoding: 'utf8',
      env: succeeds ? process.env : { ...process.env, PATH: '' },
      timeout: 120_000,
    });
    const paths = result.stdout.match(/^ready scratch=(.+) evidence=(.+)$/m);
    assert.ok(paths, result.stderr);
    const [, scratch, evidence] = paths;
    assert.equal(result.status, succeeds ? 0 : 1, result.stderr);
    assert.equal(existsSync(scratch), false);
    assert.ok(existsSync(join(evidence, 'run.env')));
    const report = succeeds ? 'bootstrap-secrets/side-effects.txt' : 'bootstrap-error.log';
    assert.match(
      readFileSync(join(evidence, report), 'utf8'),
      succeeds ? /oauth_values_match=yes/ : /git/,
    );
  });
}
