import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

process.env.PATH = join(homedir(), '.local/bin') + ':' + process.env.PATH;
process.umask(0o077);

function setupCodex() {
  const dir = process.env.CODEX_HOME || join(homedir(), '.codex');
  mkdirSync(dir, { recursive: true });
  if (spawnSync('codex', ['mcp', 'get', 'jira'], { stdio: 'ignore' }).status === 0) {
    console.log('Jira MCP is already registered with Codex; keeping its configuration.');
  } else {
    // Parse existing settings before appending. env_vars persists names only.
    const options = { stdio: 'pipe' as const };
    execFileSync('codex', ['mcp', 'list'], options);
    appendFileSync(
      join(dir, 'config.toml'),
      `
[mcp_servers.jira]
command = "python3"
args = ["-m", "jira_mcp_server.main"]
env_vars = ["JIRA_SERVER_URL", "JIRA_ACCESS_TOKEN", "JIRA_EMAIL"]
startup_timeout_sec = 60
`,
    );
    execFileSync('codex', ['mcp', 'get', 'jira'], options);
    console.log(
      'Jira MCP registered with Codex. Start Codex from a shell with the KeePass-loaded JIRA_* variables.',
    );
  }
}

function setupClaude() {
  if (spawnSync('claude', ['mcp', 'get', 'jira-mcp-server'], { stdio: 'ignore' }).status !== 0) {
    execFileSync(
      'claude',
      [
        'mcp',
        'add',
        '--scope',
        'user',
        'jira-mcp-server',
        'python3',
        '--',
        '-m',
        'jira_mcp_server.main',
      ],
      { stdio: 'inherit' },
    );
  }
  // An empty env from Claude's CLI prevents Jira from inheriting shell credentials.
  const claudePath = join(homedir(), '.claude.json');
  const config = JSON.parse(readFileSync(claudePath, 'utf8'));
  if (config.mcpServers?.['jira-mcp-server']?.env !== undefined) {
    delete config.mcpServers['jira-mcp-server'].env;
    const temporary = claudePath + '.' + process.pid;
    writeFileSync(temporary, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
    renameSync(temporary, claudePath);
  }
}

if (process.argv[2] === 'claude') setupClaude();
else setupCodex();
