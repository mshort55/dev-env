import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

test('image verification retains inspection evidence and removes the temporary image', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'dev-env-test-image-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, 'bin'));
  const engine = join(dir, 'bin/podman');
  writeFileSync(
    engine,
    `#!${process.execPath}
const fs = require('node:fs');
const [cmd, ...args] = process.argv.slice(2);
const state = process.env.IMAGE_STATE;
if (cmd === 'version') console.log('Podman test engine');
else if (cmd === 'build') {
  if (!args.some(a => /^NODE_VERSION=\\d+\\.\\d+\\.\\d+$/.test(a)) || args.some(a => a.startsWith('HOST_'))) process.exit(12);
  fs.writeFileSync(state, args[args.indexOf('--tag') + 1]);
  console.log('finished build');
} else if (cmd === 'image' && args[0] === 'inspect') {
  if (fs.readFileSync(state, 'utf8') !== args.at(-1)) process.exit(2);
  console.log('sha256:1234');
} else if (cmd === 'rmi') {
  if (fs.readFileSync(state, 'utf8') !== args.at(-1)) process.exit(2);
  fs.unlinkSync(state);
} else process.exit(2);
`,
    { mode: 0o700 },
  );
  const state = join(dir, 'engine-state');
  const run = spawnSync(process.execPath, ['verifications/scripts/build-image.ts', 'podman'], {
    env: {
      ...process.env,
      PATH: join(dir, 'bin') + delimiter + process.env.PATH,
      IMAGE_STATE: state,
    },
    encoding: 'utf8',
  });
  assert.equal(run.status, 0, run.stderr);
  const out = /built feature=container-image evidence=(.+)/.exec(run.stdout)?.[1];
  assert.ok(out);
  t.after(() => rmSync(join(out, '..'), { recursive: true }));
  assert.equal(readFileSync(join(out, 'image-id.txt'), 'utf8').trim(), 'sha256:1234');
  assert.equal(readFileSync(join(out, 'build.exit'), 'utf8').trim(), '0');
  assert.match(readFileSync(join(out, 'side-effects.txt'), 'utf8'), /image_removed=yes/);
  assert.equal(existsSync(state), false);
});

test('a missing Docker executable reports the prerequisite and retains its evidence location', (t) => {
  const run = spawnSync(process.execPath, ['verifications/scripts/build-image.ts', 'docker'], {
    env: { ...process.env, PATH: '' },
    encoding: 'utf8',
  });
  const evidence = / evidence=(.+)/.exec(run.stdout)?.[1];
  assert.ok(evidence);
  t.after(() => rmSync(evidence, { recursive: true }));
  assert.equal(run.status, 1);
  assert.match(run.stderr, /docker is required/);
  assert.ok(existsSync(join(evidence, 'container-image/build.env')));
});

test('a failed build preserves the engine status and transcript and removes any partial tag', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'dev-env-test-image-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const state = join(dir, 'image-tag');
  writeFileSync(
    join(dir, 'docker'),
    `#!${process.execPath}
const fs = require('node:fs');
const [command, ...args] = process.argv.slice(2);
if (command === 'version') console.log('Docker fixture');
else if (command === 'build') {
  fs.writeFileSync(process.env.PARTIAL_TAG, args[args.indexOf('--tag') + 1]);
  console.error('network unavailable');
  process.exit(17);
} else if (command === 'rmi' && args[0] === fs.readFileSync(process.env.PARTIAL_TAG, 'utf8')) {
  fs.unlinkSync(process.env.PARTIAL_TAG);
} else process.exit(2);
`,
    { mode: 0o700 },
  );
  const run = spawnSync(
    process.execPath,
    ['verifications/scripts/build-image.ts', 'docker', join(dir, 'run')],
    {
      env: { ...process.env, PATH: dir, PARTIAL_TAG: state },
      encoding: 'utf8',
    },
  );
  const out = join(dir, 'run/container-image');
  assert.equal(run.status, 17, run.stderr);
  assert.match(run.stderr, /build failed/);
  assert.equal(readFileSync(join(out, 'build.log'), 'utf8').trim(), 'network unavailable');
  assert.equal(readFileSync(join(out, 'build.exit'), 'utf8').trim(), '17');
  assert.equal(existsSync(state), false);
  assert.equal(existsSync(join(out, 'image-id.txt')), false);
});

test('concurrent image checks with identical evidence basenames reserve different tags', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'dev-env-image-tags-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'docker'), '#!/bin/sh\nexit 0\n', { mode: 0o700 });
  const tags = await Promise.all(
    ['one', 'two'].map(async (name) => {
      const evidence = join(dir, name, 'run');
      await promisify(execFile)(
        process.execPath,
        ['verifications/scripts/build-image.ts', 'docker', evidence],
        { env: { ...process.env, PATH: dir } },
      );
      const tag = readFileSync(join(evidence, 'container-image/build.env'), 'utf8').match(
        /^tag=(.+)$/m,
      );
      assert.ok(tag);
      return tag[1];
    }),
  );
  assert.notEqual(tags[0], tags[1]);
});
