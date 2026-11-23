// Each terminal imports the same session. Only the lock holder can replace it.
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { userInfo } from 'node:os';
import { join } from 'node:path';

const runtime = process.env.XDG_RUNTIME_DIR || `/tmp/runtime-${userInfo().uid}`;
process.env.XDG_RUNTIME_DIR = runtime;
mkdirSync(runtime, { recursive: true, mode: 0o700 });
chmodSync(runtime, 0o700);
const session = join(runtime, 'keyring-session.json');
const keys = [
  'DBUS_SESSION_BUS_ADDRESS',
  'DBUS_SESSION_BUS_PID',
  'GNOME_KEYRING_CONTROL',
  'SSH_AUTH_SOCK',
];
const env: NodeJS.ProcessEnv = { ...process.env };

function load() {
  if (existsSync(session)) Object.assign(env, JSON.parse(readFileSync(session, 'utf8')));
}

function dbus(...args: string[]) {
  return spawnSync('dbus-send', ['--session', '--print-reply', '--reply-timeout=1000', ...args], {
    env,
    encoding: 'utf8',
    timeout: 2000,
  });
}

function busReady() {
  return (
    env.DBUS_SESSION_BUS_ADDRESS &&
    dbus('--dest=org.freedesktop.DBus', '/org/freedesktop/DBus', 'org.freedesktop.DBus.GetId')
      .status === 0
  );
}

function unlocked() {
  const result = dbus(
    '--dest=org.freedesktop.secrets',
    '/org/freedesktop/secrets/collection/login',
    'org.freedesktop.DBus.Properties.Get',
    'string:org.freedesktop.Secret.Collection',
    'string:Locked',
  );
  return result.status === 0 && result.stdout.includes('boolean false');
}

function importOutput(output: string) {
  for (const line of output.split('\n')) {
    const index = line.indexOf('=');
    const name = line.slice(0, index);
    if (keys.includes(name)) env[name] = line.slice(index + 1);
  }
}

load();
if (process.argv[2] === '--ensure') {
  const existingBus = busReady();
  if (!existingBus) {
    const start = spawnSync('dbus-launch', [], { env, encoding: 'utf8', timeout: 3000 });
    if (start.status !== 0) process.exit(1);
    importOutput(start.stdout);
  }
  if (!existingBus || !unlocked()) {
    // Unlock before --start. Replace a locked daemon on this session only.
    const args = existingBus ? ['--replace', '--unlock'] : ['--unlock'];
    const unlock = spawnSync('gnome-keyring-daemon', args, {
      env,
      input: '\n',
      encoding: 'utf8',
      timeout: 3000,
    });
    if (unlock.status === 0) importOutput(unlock.stdout);
    const start = spawnSync('gnome-keyring-daemon', ['--start', '--components=secrets,ssh'], {
      env,
      encoding: 'utf8',
      timeout: 3000,
    });
    if (start.status === 0) importOutput(start.stdout);
  }
  const saved = Object.fromEntries(keys.filter((key) => env[key]).map((key) => [key, env[key]]));
  writeFileSync(session + '.tmp', JSON.stringify(saved), { mode: 0o600 });
  renameSync(session + '.tmp', session);
} else {
  if (!existsSync(session) || !busReady() || !unlocked()) {
    // --close prevents daemons launched by the child from retaining the lock.
    spawnSync(
      'flock',
      [
        '--wait',
        '3',
        '--close',
        join(runtime, 'keyring-session.lock'),
        process.execPath,
        import.meta.filename,
        '--ensure',
      ],
      { stdio: 'ignore' },
    );
    load();
  }
  for (const key of ['XDG_RUNTIME_DIR', ...keys]) {
    if (env[key]) console.log(`export ${key}='${env[key].replaceAll("'", "'\\''")}'`);
  }
}
