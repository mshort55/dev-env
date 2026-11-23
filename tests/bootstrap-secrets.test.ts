import { writeKeePassFixture } from '../verifications/scripts/keepass-fixture.ts';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

const bootstrap = 'scripts/bootstrap-secrets.ts';

test('manual refresh explains missing database configuration before prompting', (t) => {
  const home = mkdtempSync(join(tmpdir(), 'dev-env-secrets-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  for (const path of ['', join(home, 'missing.kdbx')]) {
    const result = spawnSync(process.execPath, [bootstrap], {
      env: { HOME: home, KEEPASS_DB_PATH: path },
      encoding: 'utf8',
    });
    assert.equal(result.status, 1);
    assert.ok(
      result.stdout.includes(
        path
          ? 'KeePass database not found at ' + path
          : 'KEEPASS_DB_PATH environment variable not set',
      ),
    );
    assert.doesNotMatch(result.stdout + result.stderr, /Enter KeePass/);
  }
});

test('PTY driver answers consecutive prompts and preserves the exit status and transcript', (t) => {
  const home = mkdtempSync(join(tmpdir(), 'dev-env-pty-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const transcript = join(home, 'transcript');
  const result = spawnSync(
    process.execPath,
    [
      'verifications/scripts/pty-run.ts',
      '--transcript',
      transcript,
      '--expect',
      'prompt one',
      '--send',
      'hello',
      '--expect',
      'received hello',
      '--',
      'bash',
      '-c',
      'test -t 0 || exit 9; echo "prompt one"; read -r reply; echo "received $reply"; exit 7',
    ],
    { env: { HOME: home, PATH: process.env.PATH }, encoding: 'utf8' },
  );
  assert.equal(result.status, 7, result.stderr);
  assert.match(readFileSync(transcript, 'utf8'), /received hello/);
});

const prompt = 'Enter KeePass master password:';
const fixturePassword = 'disposable-master';

function refresh(home: string, answers: string[]) {
  const transcript = join(home, 'transcript');
  const result = spawnSync(
    process.execPath,
    [
      'verifications/scripts/pty-run.ts',
      '--transcript',
      transcript,
      ...answers.flatMap((answer) => ['--expect', prompt, '--send', answer]),
      '--',
      process.execPath,
      bootstrap,
    ],
    {
      env: {
        HOME: home,
        PATH: process.env.PATH,
        CODEX_HOME: join(home, 'codex'),
        KEEPASS_DB_PATH: join(home, 'test.kdbx'),
      },
      encoding: 'utf8',
    },
  );
  const output = readFileSync(transcript, 'utf8');
  assert.doesNotMatch(output, /disposable-master|incorrect-master/);
  return { output, status: result.status };
}

test('interactive refresh retries, opens a KeePass database and installs its binary attachment', async (t) => {
  const home = mkdtempSync(join(tmpdir(), 'dev-env-secrets-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  await writeKeePassFixture(join(home, 'test.kdbx'), fixturePassword, [
    { title: '.config/gcloud/credentials.db', attachment: Uint8Array.of(0, 255, 42) },
  ]);
  const { output, status } = refresh(home, ['incorrect-master', fixturePassword]);
  assert.equal(status, 0, output);
  assert.match(output, /Incorrect password. 2 attempt\(s\) remaining/);
  assert.match(output, /All secrets configured successfully!/);
  const path = join(home, '.config/gcloud/credentials.db');
  assert.deepEqual([...readFileSync(path)], [0, 255, 42]);
  assert.equal(statSync(path).mode & 0o777, 0o600);
});

test('refresh rotates private OAuth credentials and preserves the last complete pair', async (t) => {
  const home = mkdtempSync(join(tmpdir(), 'dev-env-secrets-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const path = join(home, 'codex/google-workspace/oauth.env');
  const client = 'google_workspace_mcp_env_GOOGLE_OAUTH_CLIENT_ID';
  const secret = 'google_workspace_mcp_env_GOOGLE_OAUTH_CLIENT_SECRET';
  const marker = join(home, 'unexpected');
  const quoted = "quote' whitespace\n$(touch " + marker + ') `touch ' + marker + '`';
  for (const value of [undefined, quoted, 'rotated-value', '']) {
    await writeKeePassFixture(
      join(home, 'test.kdbx'),
      fixturePassword,
      value === undefined
        ? []
        : [
            { title: client, password: 'test-client' },
            { title: secret, password: value },
          ],
    );
    const result = refresh(home, [fixturePassword]);
    assert.equal(result.status, 0, result.output);
    if (value === undefined) {
      assert.ok(result.output.includes(client + ' entry not found'));
      assert.ok(result.output.includes(secret + ' entry not found'));
      assert.ok(!existsSync(path));
      continue;
    }
    if (!value) assert.match(result.output, /Skipping Google Workspace MCP credentials/);
    assert.ok(!result.output.includes('test-client'));
    if (value) assert.ok(!result.output.includes(value));
    assert.equal(statSync(path).mode & 0o777, 0o600);
    assert.equal(statSync(dirname(path)).mode & 0o777, 0o700);
    assert.deepEqual(readdirSync(dirname(path)), ['oauth.env']);
    assert.equal(
      readFileSync(path, 'utf8').match(/export GOOGLE_OAUTH_CLIENT_SECRET=/g)?.length,
      1,
    );
    const resultEnv = spawnSync(
      'bash',
      ['-c', 'source "$1"; printf "%s" "$GOOGLE_OAUTH_CLIENT_SECRET"', '_', path],
      { env: { HOME: home, PATH: process.env.PATH }, encoding: 'utf8' },
    );
    assert.equal(resultEnv.stdout, value || 'rotated-value');
    assert.ok(!existsSync(marker));
    assert.ok(!existsSync(join(home, '.bashrc')));
  }
});

test('refresh installs scoped files, shell settings and Git identity from known entries', async (t) => {
  const home = mkdtempSync(join(tmpdir(), 'dev-env-secrets-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const files = [
    '.config/gcloud/application_default_credentials.json',
    '.docker/config.json',
    '.config/gh/hosts.yml',
  ];
  await writeKeePassFixture(join(home, 'test.kdbx'), fixturePassword, [
    { title: 'ssh', password: 'test-private-key', notes: 'test-public-key' },
    { title: 'email', password: 'test@example.test' },
    { title: 'git_user_name', password: 'Fixture User' },
    { title: 'git_signingkey', password: 'test-signing-key' },
    { title: 'kube_env_KC', password: ' "kubectl test" ' },
    { title: 'claude_env_CLOUD_ML_REGION', password: 'test-region' },
    { title: 'enmaas_key', password: "test' ()\nsecond line" },
    ...files.map((title) => ({ title, password: 'contents of ' + title })),
  ]);
  writeFileSync(join(home, '.bashrc'), '# existing setting');
  for (let i = 0; i < 2; i++) {
    const { status, output } = refresh(home, [fixturePassword]);
    assert.equal(status, 0, output);
  }
  for (const path of files) {
    assert.equal(readFileSync(join(home, path), 'utf8'), 'contents of ' + path);
    assert.equal(statSync(join(home, path)).mode & 0o777, 0o600);
  }
  assert.equal(readFileSync(join(home, '.ssh/id_ed25519'), 'utf8'), 'test-private-key\n');
  assert.equal(statSync(join(home, '.ssh/id_ed25519')).mode & 0o777, 0o600);
  assert.equal(readFileSync(join(home, '.ssh/id_ed25519.pub'), 'utf8'), 'test-public-key');
  assert.equal(statSync(join(home, '.ssh/id_ed25519.pub')).mode & 0o777, 0o644);
  const profile = readFileSync(join(home, '.bashrc'), 'utf8');
  assert.ok(profile.startsWith('# existing setting\n'));
  assert.equal(profile.match(/export KC=/g)?.length, 1);
  assert.equal(statSync(join(home, '.bashrc')).mode & 0o777, 0o600);
  const environment = spawnSync(
    'bash',
    [
      '-c',
      'source "$HOME/.bashrc" && printf "%s|" "$CLOUD_ML_REGION" "$KC" "$JIRA_EMAIL" "$ENMAAS_KEY"',
    ],
    { env: { HOME: home, PATH: process.env.PATH }, encoding: 'utf8' },
  );
  assert.equal(
    environment.stdout,
    "test-region|kubectl test|test@example.test|test' ()\nsecond line|",
    environment.stderr,
  );
  for (const [key, value] of Object.entries({
    'user.email': 'test@example.test',
    'user.name': 'Fixture User',
    'user.signingkey': 'test-signing-key',
    'commit.gpgsign': 'true',
    'tag.gpgsign': 'true',
  })) {
    assert.equal(
      spawnSync('git', ['config', '--global', '--get', key], {
        env: { HOME: home, PATH: process.env.PATH },
        encoding: 'utf8',
      }).stdout.trim(),
      value,
    );
  }
});
