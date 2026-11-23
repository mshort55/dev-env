import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadKeePass } from '../../scripts/keepass.ts';
import { writeKeePassFixture } from './keepass-fixture.ts';

const root = resolve(import.meta.dirname, '../..');
const bootstrap = join(root, 'scripts/bootstrap-secrets.ts');
const master = 'verify-master';
const oauth = {
  GOOGLE_OAUTH_CLIENT_ID: 'verify-client-id',
  GOOGLE_OAUTH_CLIENT_SECRET: 'verify-client-secret',
};

export async function driveBootstrap(scratch: string, evidence: string) {
  const home = join(scratch, 'home');
  const keepass = join(scratch, 'keepass');
  const database = join(keepass, 'verify.kdbx');
  const password = join(scratch, 'password');
  const out = join(evidence, 'bootstrap-secrets');
  for (const dir of [home, keepass, out]) mkdirSync(dir, { mode: 0o700 });
  const env = {
    HOME: home,
    PATH: process.env.PATH || '',
    GIT_CONFIG_GLOBAL: join(home, '.gitconfig'),
    GNUPGHOME: join(home, '.gnupg'),
    KEEPASS_DB_PATH: database,
    XDG_CONFIG_HOME: join(home, '.config'),
    XDG_CACHE_HOME: join(home, '.cache'),
  };
  const git = spawnSync('git', ['--version'], { env });
  if (git.error || git.status !== 0) throw new Error('Missing required tools: git');
  const entries = Object.entries(oauth).map(([name, value]) => ({
    title: 'google_workspace_mcp_env_' + name,
    password: value,
  }));
  writeFileSync(password, master + '\n', { mode: 0o600 });
  await writeKeePassFixture(database, master, entries);

  const fixture = await loadKeePass(database, master);
  const titles = new Set(
    Array.from(fixture.getDefaultGroup().allEntries(), (entry) => entry.fields.get('Title')),
  );
  for (const entry of entries)
    assert.ok(titles.has(entry.title), 'Missing fixture entry: ' + entry.title);
  const doctor = `keepass=opens\noauth_entries=present\nsurface=cli\nhome=${home}\nkeepass=${database}\nevidence=${evidence}\ncontainer=not-used\nforbidden_container_name=dev\ndoctor=ok\n`;
  writeFileSync(join(evidence, 'doctor.txt'), doctor);
  process.stdout.write(doctor);

  function drive(name: string, args: string[], dbPath: string | undefined, expected: number) {
    const result = spawnSync(process.execPath, args, {
      cwd: root,
      env: { ...env, KEEPASS_DB_PATH: dbPath },
      encoding: 'utf8',
      timeout: 60_000,
    });
    writeFileSync(join(out, name + '.out'), result.stdout || '');
    writeFileSync(join(out, name + '.err'), result.stderr || '');
    writeFileSync(join(out, name + '.exit'), `${result.status ?? result.signal}\n`);
    if (result.error) throw result.error;
    assert.equal(result.status, expected, `See ${join(out, name)} evidence`);
    return result.stdout;
  }
  assert.match(
    drive('missing-env', [bootstrap], undefined, 1),
    /KEEPASS_DB_PATH environment variable not set/,
  );
  const missing = join(keepass, 'missing.kdbx');
  assert.ok(
    drive('missing-file', [bootstrap], missing, 1).includes(
      'KeePass database not found at ' + missing,
    ),
  );
  const prompt = 'Enter KeePass master password:';
  function interactive(name: string, steps: string[], expected: number) {
    const transcript = join(out, name + '.txt');
    drive(
      name,
      [
        join(import.meta.dirname, 'pty-run.ts'),
        '--transcript',
        transcript,
        '--timeout',
        '40',
        ...steps,
        '--',
        process.execPath,
        bootstrap,
      ],
      database,
      expected,
    );
    return readFileSync(transcript, 'utf8');
  }
  const wrong = ['--expect', prompt, '--send', 'wrong-password'];
  const rejected = interactive(
    'wrong-password',
    [...wrong, ...wrong, ...wrong, '--expect', 'Failed to open database after 3 attempts'],
    1,
  );
  assert.match(rejected, /2 attempt\(s\) remaining/);
  assert.match(rejected, /1 attempt\(s\) remaining/);
  const success = interactive(
    'success',
    [
      ...wrong,
      '--expect',
      prompt,
      '--send-file',
      password,
      '--expect',
      'Successfully opened KeePass database',
      '--expect',
      'Google Workspace MCP credentials configured',
      '--expect',
      'All secrets configured successfully!',
    ],
    0,
  );
  assert.ok(!success.includes(master) && !success.includes(oauth.GOOGLE_OAUTH_CLIENT_SECRET));
  assert.match(success, /No SSH entry found in database/);
  assert.match(success, /No GPG entry found in database/);
  const dir = join(home, '.codex/google-workspace');
  const file = join(dir, 'oauth.env');
  assert.equal(statSync(dir).mode & 0o777, 0o700);
  assert.equal(statSync(file).mode & 0o777, 0o600);
  const sourced = spawnSync(
    'bash',
    [
      '--noprofile',
      '--norc',
      '-c',
      '. "$1" && test "$GOOGLE_OAUTH_CLIENT_ID" = "$2" && test "$GOOGLE_OAUTH_CLIENT_SECRET" = "$3"',
      'verify-oauth',
      file,
      oauth.GOOGLE_OAUTH_CLIENT_ID,
      oauth.GOOGLE_OAUTH_CLIENT_SECRET,
    ],
    { env },
  );
  assert.equal(sourced.status, 0, 'OAuth file did not reproduce fixture values');
  assert.match(readFileSync(env.GIT_CONFIG_GLOBAL, 'utf8'), /gpgsign = true/);
  const profile = join(home, '.bashrc');
  if (existsSync(profile))
    assert.doesNotMatch(readFileSync(profile, 'utf8'), /GOOGLE_OAUTH_CLIENT_SECRET/);
  writeFileSync(
    join(out, 'side-effects.txt'),
    [
      'oauth_env=' + file,
      'oauth_env_mode=600',
      'oauth_dir_mode=700',
      'oauth_values_match=yes',
      'secret_absent_from_transcript=yes',
      'password_absent_from_transcript=yes',
      'missing_ssh_warning=yes',
      'missing_gpg_warning=yes',
      'git_gpgsign=yes',
      'oauth_not_in_bashrc=yes',
      'success_exit=0',
      'wrong_password_exit=1',
      'missing_env_exit=1',
      'missing_file_exit=1',
    ].join('\n') + '\n',
  );
}
