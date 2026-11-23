import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const codexHome = process.env.CODEX_HOME || join(homedir(), ".codex");
const installDir = join(homedir(), ".local/bin");
const env = { ...process.env, CODEX_HOME: codexHome, CODEX_INSTALL_DIR: installDir, CODEX_NON_INTERACTIVE: "1" };
mkdirSync(codexHome, { recursive: true });
const installer = execFileSync("curl", ["-fsSL", "https://chatgpt.com/codex/install.sh"]);
execFileSync("sh", ["-s", "--", "--release", "latest"], { input: installer, env, stdio: ["pipe", "inherit", "inherit"] });

const codex = join(installDir, "codex");
// On a fresh installation the daemon selects its package on first start.
if (existsSync(join(codexHome, "packages/app-server-daemon/current"))) {
  execFileSync(codex, ["app-server", "daemon", "update", "--from-cli", "--yes"], { env, stdio: "inherit" });
}
execFileSync(codex, ["--version"], { env, stdio: "inherit" });
