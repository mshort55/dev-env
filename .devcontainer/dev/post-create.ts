import { spawnSync } from 'node:child_process';
import { appendFileSync, copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { dirname, join } from 'node:path';

const repo = process.env.DEV_ENV_DIR;
if (!repo) throw new Error('DEV_ENV_DIR is required');
const home = homedir();
const workspaceName = process.env.WORKSPACE_DIR_NAME;
const workspace = join('/', workspaceName || 'UbuntuSync');
process.chdir(repo);

function run(command: string, ...args: string[]) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function copySettings(source: string, target: string) {
  const destination = join(home, target);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(join(workspace, source), destination);
}

const { uid, gid } = userInfo();
run('sudo', 'chown', `${uid}:${gid}`, 'node_modules');
run('npm', 'ci', '--include=dev');
copySettings('.claude/settings.json', '.claude/settings.json');
copySettings('.claude/ccstatusline/settings.json', '.config/ccstatusline/settings.json');

run('sudo', 'rm', '-f', '/etc/apt/sources.list.d/yarn.list');
const aptSources = '/etc/apt/sources.list.d/ubuntu.sources';
if (existsSync(aptSources)) {
  run('sudo', 'sed', '-i', 's|http://ports.ubuntu.com|https://ports.ubuntu.com|g', aptSources);
}
run('sudo', 'apt-get', 'update', '-qq');

const cliPrefix = join(workspace, 'npm-clis');
const paths = [join(home, '.local/bin'), join(home, 'go/bin')];
if (workspaceName) paths.unshift(join(cliPrefix, 'node_modules/.bin'));
process.env.PATH = [...paths, process.env.PATH].join(':');
if (workspaceName && existsSync(join(cliPrefix, 'package.json'))) {
  run('npm', 'ci', '--omit=dev', '--ignore-scripts', '--prefix', cliPrefix);
} else {
  console.log(
    workspaceName
      ? `No ${cliPrefix}/package.json; skipping npm CLIs`
      : 'WORKSPACE_DIR_NAME is unset; skipping npm CLIs',
  );
}
run(
  'pip3',
  'install',
  '--break-system-packages',
  '--require-hashes',
  '-r',
  join(repo, 'requirements/jira-mcp.txt'),
);
run(
  'pip3',
  'install',
  '--break-system-packages',
  '--no-deps',
  '--no-build-isolation',
  '-e',
  '/Repos/jira-mcp-server_stolostron',
);

run(
  'curl',
  '-fsSL',
  'https://raw.githubusercontent.com/rcaloras/bash-preexec/master/bash-preexec.sh',
  '-o',
  join(home, '.bash-preexec.sh'),
);
const bashrc = join(home, '.bashrc');
appendFileSync(
  bashrc,
  `
# User bin paths
export PATH="${workspaceName ? '/$WORKSPACE_DIR_NAME/npm-clis/node_modules/.bin:' : ''}$HOME/.local/bin:$HOME/go/bin:$PATH"

# Shell completions
source <(kubectl completion bash)
source <(oc completion bash)
eval "$(gh completion -s bash)"
[[ -f /usr/share/google-cloud-sdk/completion.bash.inc ]] && source /usr/share/google-cloud-sdk/completion.bash.inc

# Atuin shell history
[[ -f ~/.bash-preexec.sh ]] && source ~/.bash-preexec.sh
eval "$(atuin init bash)"
`,
);

run(process.execPath, join(repo, 'scripts/setup-jira-mcp.ts'), 'claude');

if (
  process.env.KEEPASS_DB_PATH &&
  statSync(process.env.KEEPASS_DB_PATH, { throwIfNoEntry: false })?.isFile()
) {
  run(process.execPath, join(repo, 'scripts/bootstrap-secrets.ts'));
}
run(process.execPath, join(repo, 'scripts/setup-codex.ts'));
run(process.execPath, join(repo, 'scripts/setup-jira-mcp.ts'));
run(process.execPath, join(repo, 'scripts/setup-google-workspace-mcp.ts'));

appendFileSync(
  bashrc,
  `
# Import the shared headless keyring session in this terminal.
source <(node "$DEV_ENV_DIR/.devcontainer/dev/keyring.ts")
`,
);
