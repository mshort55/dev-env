import assert from "node:assert/strict";
import { execFile, execFileSync, spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { createInterface } from "node:readline";
import { promisify } from "node:util";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test, type TestContext } from "node:test";

const setup = resolve(import.meta.dirname, "../scripts/setup-jira-mcp.ts");
const hasCli = (name: string) => spawnSync(name, ["--version"]).status === 0;

function fixture(t: TestContext) {
  const home = mkdtempSync(join(tmpdir(), "jira-registration-"));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const env = {
    HOME: home, PATH: process.env.PATH, CODEX_HOME: join(home, ".codex"),
    JIRA_SERVER_URL: "http://127.0.0.1:1", JIRA_ACCESS_TOKEN: "fixture-token-do-not-persist",
    JIRA_EMAIL: "developer@example.invalid", CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
  };
  const options = { env, cwd: home, encoding: "utf8" as const, stdio: "pipe" as const, timeout: 60000 };
  return { home, env, options, config: join(env.CODEX_HOME, "config.toml"),
    run: (...args: string[]) => execFileSync(process.execPath, [setup, ...args], options) };
}

test("Codex keeps unrelated settings and forwards Jira credentials by name on repeated setup", { skip: !hasCli("codex") }, t => {
  const { run, config, env, options } = fixture(t);
  mkdirSync(env.CODEX_HOME);
  const original = '# Keep this comment\n[mcp_servers.other]\ncommand = "other-server"\n';
  writeFileSync(config, original);
  const output = run();
  const contents = readFileSync(config, "utf8");
  assert.ok(contents.startsWith(original));
  assert.ok(!(contents + output).includes(env.JIRA_ACCESS_TOKEN));
  const { transport } = JSON.parse(execFileSync("codex", ["mcp", "get", "jira", "--json"], options));
  assert.equal(transport.command, "python3");
  assert.deepEqual(transport.args, ["-m", "jira_mcp_server.main"]);
  assert.deepEqual(transport.env_vars, ["JIRA_SERVER_URL", "JIRA_ACCESS_TOKEN", "JIRA_EMAIL"]);
  run();
  assert.equal(readFileSync(config, "utf8"), contents);
});

test("Claude user registration inherits shell credentials and survives repeated setup", { skip: !hasCli("claude") }, t => {
  const { home, run, options } = fixture(t);
  const config = join(home, ".claude.json");
  writeFileSync(config, JSON.stringify({ mcpServers: { other: { command: "fixture" } } }));
  run("claude");
  const servers = () => JSON.parse(readFileSync(config, "utf8")).mcpServers;
  const original = servers();
  assert.equal(original["jira-mcp-server"].command, "python3");
  assert.deepEqual(original["jira-mcp-server"].args, ["-m", "jira_mcp_server.main"]);
  assert.equal(original["jira-mcp-server"].env, undefined);
  assert.deepEqual(original.other, { command: "fixture" });
  run("claude");
  assert.deepEqual(servers(), original);
  const registration = execFileSync("claude", ["mcp", "get", "jira-mcp-server"], options);
  assert.match(registration, /jira_mcp_server\.main/);
});

test("both clients start their installed Jira server against a disposable Jira endpoint", {
  skip: !hasCli("claude") || !hasCli("codex") ||
    spawnSync("python3", ["-c", "import importlib.util, sys; sys.exit(importlib.util.find_spec('jira_mcp_server') is None)"]).status !== 0,
  timeout: 90000,
}, async t => {
  const { run, env, options } = fixture(t);
  const requests: string[] = [];
  const jira = createServer((request, response) => {
    requests.push(request.url!);
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(request.url?.endsWith("/serverInfo")
      ? { versionNumbers: [9, 0, 0], deploymentType: "Server" }
      : { accountId: "fixture", displayName: "Fixture" }));
  });
  await new Promise<void>(resolve => jira.listen(0, "127.0.0.1", resolve));
  t.after(() => { jira.closeAllConnections(); jira.close(); });
  const address = jira.address();
  assert.ok(address && typeof address === "object");
  env.JIRA_SERVER_URL = "http://127.0.0.1:" + address.port;
  // Make pip's installed user packages visible in the disposable home.
  const installed = execFileSync("python3", ["-m", "site", "--user-site"], { encoding: "utf8" }).trim();
  const isolated = execFileSync("python3", ["-m", "site", "--user-site"], options).trim();
  mkdirSync(dirname(isolated), { recursive: true });
  symlinkSync(installed, isolated);
  // The server runs a git fetch on startup. Keep its checkout and remote untouched.
  const bin = join(options.cwd, "bin");
  mkdirSync(bin);
  writeFileSync(join(bin, "git"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
  env.PATH = bin + ":" + env.PATH;
  run("claude");
  run();
  const claude = await promisify(execFile)("claude", ["mcp", "list"], options);
  assert.match(claude.stdout, /jira-mcp-server:.*Connected/i);
  assert.ok(requests.some(path => path.endsWith("/myself")));
  requests.length = 0;

  const app = spawn("codex", ["app-server", "--listen", "stdio://"], { env, cwd: options.cwd, timeout: 45000, stdio: ["pipe", "pipe", "ignore"] });
  t.after(() => app.kill());
  const messages = createInterface({ input: app.stdout })[Symbol.asyncIterator]();
  async function request(id: number, method: string, params: object) {
    app.stdin.write(JSON.stringify({ id, method, params }) + "\n");
    for (;;) {
      const line = await messages.next();
      assert.ok(!line.done, "Codex exited before responding to " + method);
      const message = JSON.parse(line.value);
      if (message.id === id) {
        assert.equal(message.error, undefined, JSON.stringify(message.error));
        return message.result;
      }
    }
  }
  await request(1, "initialize", { clientInfo: { name: "dev-env-test", version: "1" } });
  app.stdin.write('{"method":"initialized"}\n');
  const inventory = await request(2, "mcpServerStatus/list", { serverName: "jira" });
  const server = inventory.data.find((entry: { name: string }) => entry.name === "jira");
  assert.ok(server?.tools.search_issues, JSON.stringify(inventory));
  assert.ok(requests.some(path => path.endsWith("/myself")));
  app.stdin.end();
});

test("Codex creates private settings without credentials and leaves invalid or custom settings intact",
  { skip: !hasCli("codex") }, t => {
    const { run, env, config } = fixture(t);
    for (const key of ["JIRA_SERVER_URL", "JIRA_EMAIL", "JIRA_ACCESS_TOKEN"] as const) Reflect.deleteProperty(env, key);
    run();
    assert.equal(statSync(config).mode & 0o777, 0o600);
    const custom = '[mcp_servers.jira]\ncommand = "custom-jira"\nenabled = false\n';
    writeFileSync(config, custom);
    run();
    assert.equal(readFileSync(config, "utf8"), custom);
    writeFileSync(config, "[mcp_servers.\n");
    assert.throws(() => run());
    assert.equal(readFileSync(config, "utf8"), "[mcp_servers.\n");
  });
