import { homedir } from 'node:os';
import { join } from 'node:path';

export function workspaceCredentialsDirectory() {
  return join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'google-workspace');
}
