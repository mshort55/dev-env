import { workspaceCredentialsDirectory } from './workspace-credentials.ts';
import {
  existsSync,
  openSync,
  writeSync,
  mkdirSync,
  writeFileSync,
  chmodSync,
  readFileSync,
  renameSync,
  rmSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { createInterface } from 'node:readline';
import { ReadStream } from 'node:tty';
import { Writable } from 'node:stream';
import kdbx from 'kdbxweb';
import { loadKeePass } from './keepass.ts';

async function unlock(path: string) {
  let tty: ReadStream | undefined;
  let promptFd = 2;
  try {
    const fd = openSync('/dev/tty', 'r+');
    tty = new ReadStream(fd);
    promptFd = fd;
  } catch {
    // A detached process can still receive password lines on stdin.
  }
  const reader = createInterface({
    input: tty ?? process.stdin,
    terminal: Boolean(tty),
    output: new Writable({
      write(_chunk, _encoding, done) {
        done();
      },
    }),
  });
  let cancelled = false;
  reader.on('SIGINT', () => {
    cancelled = true;
    reader.close();
  });
  const lines = reader[Symbol.asyncIterator]();
  try {
    for (let attempt = 1; attempt <= 3; attempt++) {
      writeSync(promptFd, 'Enter KeePass master password: ');
      const line = await lines.next();
      writeSync(promptFd, '\n');
      if (cancelled || line.done) {
        console.log('⚠️  Bootstrap cancelled');
        return;
      }
      try {
        return await loadKeePass(path, line.value);
      } catch (error) {
        console.log(
          attempt < 3
            ? `⚠️  Error: Incorrect password. ${3 - attempt} attempt(s) remaining.`
            : `⚠️  Error: Failed to open database after 3 attempts: ${error}`,
        );
      }
    }
  } finally {
    reader.close();
    tty?.destroy();
  }
}

function writeCredential(path: string, data: string | Uint8Array, mode = 0o600) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, data, { mode });
  chmodSync(path, mode);
}

function field(entry: kdbx.KdbxEntry | undefined, name: string) {
  const value = entry?.fields.get(name);
  return typeof value === 'string' ? value : value?.getText();
}

type Entries = Map<string, kdbx.KdbxEntry>;

function password(entries: Entries, title: string) {
  const value = field(entries.get(title), 'Password');
  if (!value) console.log(`  ⚠️  Warning: ${title} entry not found or has no password`);
  return value;
}

function shellQuote(value: string) {
  if (/^[a-zA-Z0-9_@%+=:,./-]+$/.test(value)) return value;
  return "'" + value.replaceAll("'", `'"'"'`) + "'";
}

function googleWorkspace(entries: Entries) {
  console.log('Setting up Google Workspace MCP credentials...');
  const exports: string[] = [];
  for (const name of ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET']) {
    const value = password(entries, 'google_workspace_mcp_env_' + name);
    if (value) exports.push(`export ${name}=${shellQuote(value)}\n`);
  }
  if (exports.length < 2) {
    console.log(
      '  ⚠️  Skipping Google Workspace MCP credentials until both OAuth entries are available',
    );
    return;
  }
  const directory = workspaceCredentialsDirectory();
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);
  const temporary = join(directory, '.oauth-' + randomUUID());
  try {
    writeFileSync(temporary, exports.join(''), { mode: 0o600, flag: 'wx' });
    renameSync(temporary, join(directory, 'oauth.env'));
  } finally {
    rmSync(temporary, { force: true });
  }
  console.log('Google Workspace MCP credentials configured');
}

function ssh(entries: Entries) {
  console.log('Setting up SSH keys...');
  const entry = entries.get('ssh');
  const privateKey = field(entry, 'Password');
  const publicKey = field(entry, 'Notes');
  if (!entry) console.log('⚠️  Warning: No SSH entry found in database');
  else if (!privateKey) console.log('⚠️  Warning: SSH entry has no password (private key)');
  else if (!publicKey) console.log('⚠️  Warning: SSH entry has no notes (public key)');
  else {
    writeCredential(
      join(homedir(), '.ssh/id_ed25519'),
      privateKey.endsWith('\n') ? privateKey : privateKey + '\n',
    );
    writeCredential(join(homedir(), '.ssh/id_ed25519.pub'), publicKey, 0o644);
    console.log('SSH keys config complete');
  }
}

function gpg(entries: Entries) {
  console.log('Setting up GPG key...');
  const entry = entries.get('gpg');
  const key = field(entry, 'Password');
  if (!entry || !key) {
    console.log(
      entry
        ? '⚠️  Warning: GPG entry has no password (private key)'
        : '⚠️  Warning: No GPG entry found in database',
    );
    return;
  }
  const result = spawnSync('gpg', ['--import', '--batch'], { input: key, encoding: 'utf8' });
  if (result.status !== 0) {
    console.log(
      result.error
        ? '⚠️  Warning: gpg command not found, skipping GPG setup'
        : '⚠️  Warning: Failed to import GPG key: ' + result.stderr,
    );
    return;
  }
  console.log('GPG key imported successfully');
  writeCredential(join(homedir(), '.gnupg/gpg-agent.conf'), 'allow-loopback-pinentry\n');
  writeCredential(join(homedir(), '.gnupg/gpg.conf'), 'pinentry-mode loopback\n');
  const path = join(homedir(), '.bashrc');
  const content = existsSync(path) ? readFileSync(path, 'utf8') : '';
  if (!content.includes('GPG_TTY'))
    writeCredential(path, content + '\n# GPG configuration\nexport GPG_TTY=$(tty)\n');
  console.log('GPG configuration complete');
}

function environment(
  entries: Entries,
  section: string,
  titles: Record<string, string>,
  unquote = false,
) {
  console.log(`Setting up ${section}...`);
  const exports = [];
  for (const [name, title] of Object.entries(titles)) {
    let value = password(entries, title);
    if (!value) continue;
    if (unquote) value = value.trim().replace(/^(['"])([\s\S]*)\1$/, '$2');
    exports.push(`export ${name}=${shellQuote(value)}\n`);
    console.log(`  - ${name} configured`);
  }
  if (exports.length) {
    const shell = spawnSync('bash', ['--version'], { stdio: 'ignore' }).error
      ? '.ashrc'
      : '.bashrc';
    const path = join(homedir(), shell);
    let profile = existsSync(path) ? readFileSync(path, 'utf8') : '';
    const heading = '# ' + section;
    const replacement = heading + '\n' + exports.join('');
    // shlex-quoted values from earlier refreshes can span multiple lines.
    const exportedLine = /export (?:[^'"\n]|'[^']*'|"[^"]*")*(?:\n|$)/.source;
    const block = new RegExp('^' + heading + '(?:\\n|$)(?:' + exportedLine + ')*', 'm');
    if (block.test(profile)) profile = profile.replace(block, () => replacement);
    else {
      if (profile && !profile.endsWith('\n')) profile += '\n';
      if (profile.trimEnd() && !/\n\s*\n$/.test(profile)) profile += '\n';
      profile += replacement;
    }
    writeCredential(path, profile);
  }
  console.log(`${section} config complete`);
}

function credentialFile(entries: Entries, title: string) {
  const path = join(homedir(), title);
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const value = password(entries, title);
  if (value) {
    writeCredential(path, value);
    console.log(`  - ${title} configured`);
  }
}

function git(entries: Entries) {
  console.log('Setting up git configuration...');
  const settings = {
    'user.email': 'email',
    'user.name': 'git_user_name',
    'user.signingkey': 'git_signingkey',
  };
  for (const [name, title] of Object.entries(settings)) {
    const value = password(entries, title);
    if (!value) continue;
    const result = spawnSync('git', ['config', '--global', name, value], { encoding: 'utf8' });
    if (result.error) {
      console.log('  ⚠️  Warning: git command not found, skipping git configuration');
      return;
    }
    console.log(
      result.status === 0
        ? `  - ${name} configured`
        : `  ⚠️  Warning: Failed to set ${name}: ${result.stderr}`,
    );
  }
  for (const name of ['commit.gpgsign', 'tag.gpgsign']) {
    const result = spawnSync('git', ['config', '--global', name, 'true'], { encoding: 'utf8' });
    if (result.status !== 0) {
      console.log(`  ⚠️  Warning: Failed to set gpgsign flags: ${result.error ?? result.stderr}`);
      return;
    }
  }
  console.log('  - commit.gpgsign and tag.gpgsign enabled');
  console.log('Git configuration complete');
}

function configure(database: kdbx.Kdbx) {
  const entries = new Map<string, kdbx.KdbxEntry>();
  for (const group of database.groups) {
    for (const entry of group.allEntries()) {
      const title = field(entry, 'Title');
      if (title && !entries.has(title)) entries.set(title, entry);
    }
  }
  ssh(entries);
  gpg(entries);
  console.log('Setting up gcloud configuration...');
  credentialFile(entries, '.config/gcloud/application_default_credentials.json');
  const title = '.config/gcloud/credentials.db';
  const entry = entries.get(title);
  const attachment = entry?.binaries.values().next().value;
  if (attachment) {
    const data = 'value' in attachment ? attachment.value : attachment;
    writeCredential(
      join(homedir(), title),
      data instanceof kdbx.ProtectedValue ? data.getBinary() : new Uint8Array(data),
    );
    console.log(`  - ${title} configured`);
  } else {
    console.log(`  ⚠️  Warning: ${title} entry ${entry ? 'has no attachments' : 'not found'}`);
  }
  console.log('gcloud configuration complete');
  environment(entries, 'Claude Code environment variables', {
    ANTHROPIC_VERTEX_PROJECT_ID: 'claude_env_ANTHROPIC_VERTEX_PROJECT_ID',
    CLAUDE_CODE_USE_VERTEX: 'claude_env_CLAUDE_CODE_USE_VERTEX',
    CLOUD_ML_REGION: 'claude_env_CLOUD_ML_REGION',
  });
  environment(
    entries,
    'Kubernetes context environment variables',
    {
      THREE_NODE: 'kube_env_THREE_NODE',
      KC: 'kube_env_KC',
      OME: 'kube_env_OME',
    },
    true,
  );
  environment(entries, 'Jira environment variables', {
    JIRA_ACCESS_TOKEN: 'jira_mcp_env_JIRA_ACCESS_TOKEN',
    JIRA_EMAIL: 'email',
    JIRA_SERVER_URL: 'jira_mcp_env_JIRA_SERVER_URL',
  });
  environment(entries, 'EnMaaS environment variable', { ENMAAS_KEY: 'enmaas_key' });
  googleWorkspace(entries);
  console.log('Setting up GitHub CLI configuration...');
  credentialFile(entries, '.config/gh/hosts.yml');
  console.log('GitHub CLI configuration complete');
  console.log('Setting up Docker configuration...');
  credentialFile(entries, '.docker/config.json');
  console.log('Docker configuration complete');
  git(entries);
}

const path = process.env.KEEPASS_DB_PATH;
if (!path) {
  console.log('⚠️  Error: KEEPASS_DB_PATH environment variable not set');
  process.exitCode = 1;
} else if (!existsSync(path)) {
  console.log(`⚠️  Error: KeePass database not found at ${path}`);
  process.exitCode = 1;
} else {
  const database = await unlock(path);
  if (database) {
    console.log('\nSuccessfully opened KeePass database\n');
    configure(database);
    console.log('\nAll secrets configured successfully!');
  } else {
    process.exitCode = 1;
  }
}
