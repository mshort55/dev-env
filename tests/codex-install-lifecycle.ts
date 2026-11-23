// The standalone installer refuses to link executables inside the system temp directory.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { test, type TestContext } from 'node:test';

const setup = resolve(import.meta.dirname, '../scripts/setup-codex.ts');
const base =
  process.env.CODEX_REPRO_ROOT ||
  join(process.env.XDG_CACHE_HOME || join(homedir(), '.cache'), 'dev-env-codex-repro');

function installation(t: TestContext) {
  mkdirSync(base, { recursive: true });
  const home = mkdtempSync(join(base, 'lifecycle-'));
  const codexHome = join(home, '.codex');
  const bin = join(home, '.local/bin/codex');
  const env = { HOME: home, CODEX_HOME: codexHome, PATH: process.env.PATH };
  const options = { cwd: home, env, encoding: 'utf8' as const, timeout: 300000 };
  t.after(() => {
    try {
      spawnSync(bin, ['app-server', 'daemon', 'stop'], { ...options, stdio: 'ignore' });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
  mkdirSync(join(codexHome, 'sessions'), { recursive: true });
  writeFileSync(join(codexHome, 'sessions/keep.txt'), 'persisted session\n');
  writeFileSync(join(codexHome, 'config.toml'), '# persisted configuration\n');

  function verify() {
    execFileSync(bin, ['app-server', 'daemon', 'start'], options);
    assert.ok(realpathSync(bin).startsWith(join(codexHome, 'packages/standalone') + '/'));
    const version = JSON.parse(execFileSync(bin, ['app-server', 'daemon', 'version'], options));
    assert.ok(version.cliVersion);
    assert.equal(version.managedCodexVersion, version.cliVersion);
    if (version.appServerVersion != null)
      assert.equal(version.appServerVersion, version.cliVersion);
    assert.equal(readFileSync(join(codexHome, 'sessions/keep.txt'), 'utf8'), 'persisted session\n');
    assert.ok(
      readFileSync(join(codexHome, 'config.toml'), 'utf8')
        .split('\n')
        .includes('# persisted configuration'),
    );
  }
  return {
    home,
    bin,
    options,
    verify,
    install: () => execFileSync(process.execPath, [setup], options),
  };
}

test('a fresh installation starts the matching Codex daemon in the persisted home', (t) => {
  const state = installation(t);
  state.install();
  state.verify();
});

test('setup updates the older daemon and restores the CLI after container recreation', (t) => {
  const { home, bin, options, install, verify } = installation(t);
  const installer = join(home, 'installer.sh');
  execFileSync('curl', ['-fsSL', 'https://chatgpt.com/codex/install.sh', '-o', installer], options);
  execFileSync('sh', [installer, '--release', '0.159.2'], {
    ...options,
    env: {
      ...options.env,
      CODEX_HOME: join(home, '.local/share/codex-package'),
      CODEX_NON_INTERACTIVE: '1',
    },
  });
  execFileSync(bin, ['app-server', 'daemon', 'start'], options);
  install();
  assert.notEqual(execFileSync(bin, ['--version'], options).trim(), 'codex-cli 0.159.2');
  verify();
  execFileSync(bin, ['app-server', 'daemon', 'stop'], options);
  rmSync(join(home, '.local'), { recursive: true });
  install();
  verify();
});
