import assert from "node:assert/strict";
import { execFile, execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test, type TestContext } from "node:test";

const source = resolve(import.meta.dirname, "..");

function workstation(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), "dev-env-workstation-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const home = join(root, "home");
  const workspace = join(root, "shared workspace");
  const repo = join(root, "dev-env");
  const bin = join(root, "bin");
  for (const dir of [home, join(workspace, ".claude/ccstatusline"), join(workspace, "npm-clis"), bin, join(repo, "scripts")]) {
    mkdirSync(dir, { recursive: true });
  }
  cpSync(join(source, ".devcontainer/dev"), join(repo, ".devcontainer/dev"), { recursive: true });
  const env = {
    HOME: home, PATH: [bin, dirname(process.execPath), "/usr/local/bin", "/usr/bin", "/bin"].join(":"), DEV_ENV_DIR: repo,
    WORKSPACE_DIR_NAME: workspace.slice(1), XDG_RUNTIME_DIR: join(root, "runtime"),
    npm_config_cache: join(root, "npm-cache"), npm_config_offline: "true",
    KEEPASS_DB_PATH: join(root, "fixture.kdbx"),
  };
  writeFileSync(env.KEEPASS_DB_PATH, "");
  writeFileSync(join(workspace, ".claude/settings.json"), '{"theme":"dark"}');
  writeFileSync(join(workspace, ".claude/ccstatusline/settings.json"), '{"text":"fixture"}');
  const cli = join(workspace, "npm-clis");
  mkdirSync(join(cli, "sample"), { recursive: true });
  writeFileSync(join(cli, "sample/package.json"), JSON.stringify({ name: "workspace-cli", version: "1.0.0", bin: "cli.js" }));
  writeFileSync(join(cli, "sample/cli.js"), "#!/usr/bin/env node\n", { mode: 0o755 });
  writeFileSync(join(cli, "package.json"), JSON.stringify({ dependencies: { "workspace-cli": "file:sample" } }));
  writeFileSync(join(repo, "package.json"), JSON.stringify({ type: "module" }));
  for (const cwd of [repo, cli]) {
    execFileSync("npm", ["install", "--package-lock-only", "--ignore-scripts"], { cwd, env, stdio: "pipe" });
  }
  for (const tool of ["sudo", "pip3", "curl", "atuin"]) {
    writeFileSync(join(bin, tool), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  }
  for (const tool of ["kubectl", "oc", "gh"]) {
    writeFileSync(join(bin, tool), `#!/bin/sh\necho 'complete -W fixture ${tool}'\n`, { mode: 0o755 });
  }
  writeFileSync(join(bin, "claude"), `#!/bin/sh
case "$2" in
  get) exit 1 ;;
  add) echo '{"mcpServers":{"jira-mcp-server":{"env":{}},"other":{"url":"keep"}}}' > "$HOME/.claude.json" ;;
esac
`, { mode: 0o755 });
  for (const step of ["bootstrap-secrets", "setup-codex", "setup-jira-mcp", "setup-google-workspace-mcp"]) {
    writeFileSync(join(repo, "scripts", step + ".ts"), `
import { appendFileSync } from "node:fs";
appendFileSync(process.env.HOME + "/setup-steps", "${step}\\n");
`);
  }
  const config = JSON.parse(readFileSync(join(repo, ".devcontainer/dev/devcontainer.json"), "utf8"));
  const result = spawnSync("bash", ["-ec", config.postCreateCommand], { env, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return { home, workspace, bin, env };
}

test("container creation installs workspace settings and CLIs and loads credentials before MCP setup", t => {
  const { home, workspace, bin, env } = workstation(t);
  assert.equal(readFileSync(join(home, ".claude/settings.json"), "utf8"), '{"theme":"dark"}');
  assert.equal(readFileSync(join(home, ".config/ccstatusline/settings.json"), "utf8"), '{"text":"fixture"}');
  assert.deepEqual(JSON.parse(readFileSync(join(home, ".claude.json"), "utf8")).mcpServers,
    { "jira-mcp-server": {}, other: { url: "keep" } });
  assert.deepEqual(readFileSync(join(home, "setup-steps"), "utf8").trim().split("\n"),
    ["bootstrap-secrets", "setup-codex", "setup-jira-mcp", "setup-google-workspace-mcp"]);
  // Skip keyring startup in this test; a separate Linux test exercises the real services.
  writeFileSync(join(bin, "flock"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  const shell = execFileSync("bash", ["-ec", '. "$HOME/.bashrc"; complete -p gh kubectl oc; command -v workspace-cli'],
    { env, encoding: "utf8" });
  assert.equal(shell.trim().split("\n").at(-1), join(workspace, "npm-clis/node_modules/.bin/workspace-cli"));
});

test("two new terminals share one unlocked login collection", {
  skip: process.platform !== "linux" || spawnSync("gnome-keyring-daemon", ["--version"]).status !== 0,
}, async t => {
  const { env } = workstation(t);
  const terminal = (command = "") => new Promise<string>((resolve, reject) => {
    execFile("bash", ["-ec", `
      . "$HOME/.bashrc"
      ${command}
      echo "$DBUS_SESSION_BUS_PID"
      dbus-send --session --print-reply --dest=org.freedesktop.DBus /org/freedesktop/DBus org.freedesktop.DBus.GetId
      dbus-send --session --print-reply --dest=org.freedesktop.secrets /org/freedesktop/secrets/collection/login \
        org.freedesktop.DBus.Properties.Get string:org.freedesktop.Secret.Collection string:Locked
    `], { env, timeout: 15000 }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr || error.message));
      else resolve(stdout);
    });
  });
  const [first, second] = await Promise.all([terminal(), terminal()]);
  const pid = Number(first.split("\n")[0]);
  if (pid > 1) t.after(() => process.kill(pid, "SIGTERM"));
  const locked = await terminal("dbus-send --session --print-reply --dest=org.freedesktop.secrets /org/freedesktop/secrets org.freedesktop.Secret.Service.Lock array:objpath:/org/freedesktop/secrets/collection/login");
  assert.match(locked, /boolean true/);
  assert.match(await terminal(), /boolean false/);
  assert.match(first, /boolean false/);
  assert.match(second, /boolean false/);
  assert.match(first, /string "[a-f0-9]+"/);
  assert.equal(first.match(/string "[a-f0-9]+"/)?.[0], second.match(/string "[a-f0-9]+"/)?.[0]);
});
