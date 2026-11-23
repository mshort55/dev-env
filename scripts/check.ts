import { spawnSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { discover } from './discover.ts';

const root = resolve(import.meta.dirname, '..');
const node = process.execPath;
const biome = join(root, 'node_modules/.bin/biome');
process.chdir(root);

function requireTools(...names: string[]) {
  const missing = names.filter(name => !(process.env.PATH || '').split(delimiter).some(dir => {
    try {
      accessSync(join(dir, name), constants.X_OK);
      return true;
    } catch { return false; }
  }));
  if (missing.length) throw new Error('Missing required tools: ' + missing.join(', '));
}

function run(command: string, ...args: string[]) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited ${result.status ?? result.signal}`);
}

const checks: Record<string, () => void> = {
  lint: () => run(biome, 'lint', ...discover(root).typescript),
  'format-check': () => run(biome, 'format', ...discover(root).typescript),
  format: () => run(biome, 'format', '--write', ...discover(root).typescript),
  types: () => run(node, 'node_modules/typescript/bin/tsc', '--noEmit'),
  tests: () => run(node, '--test', 'tests/*.test.ts'),
  bootstrap: () => run(node, 'verifications/verify.ts', '--bootstrap-only'),
  image: () => run(node, 'verifications/scripts/build-image.ts', 'docker'),
  integration: () => run(node, 'verifications/verify.ts'),
  mcp: () => {
    requireTools('codex', 'uv', 'uvx');
    run(node, 'verifications/scripts/check-mcp.ts');
  },
};

let names = process.argv.slice(2);
if (names.length === 0) names = ['lint', 'format-check', 'types', 'tests', 'integration', 'mcp'];
if (names.length === 1 && names[0] === '--list') {
  console.log(Object.keys(checks).join('\n'));
} else if (names.some(name => !Object.hasOwn(checks, name))) {
  console.error('Select checks from: ' + Object.keys(checks).join(', '));
  process.exitCode = 2;
} else {
  const failures = [];
  for (const name of names) {
    console.log('Running ' + name);
    try { checks[name](); }
    catch (error) {
      failures.push(name);
      console.error(error instanceof Error ? error.message : error);
    }
  }
  if (failures.length) {
    console.error('Failed checks:\n' + failures.join('\n'));
    process.exitCode = 1;
  }
}
