import { execFileSync } from 'node:child_process';
import { closeSync, lstatSync, openSync, readSync } from 'node:fs';
import { extname, join } from 'node:path';

const excluded = new Set(['archive', '.git', '.nox', '.venv', '__pycache__', 'node_modules']);

function hasShellShebang(path: string): boolean {
  const fd = openSync(path, 'r');
  try {
    const prefix = Buffer.alloc(256);
    const size = readSync(fd, prefix);
    const line = prefix.toString('utf8', 0, size).split('\n', 1)[0];
    return /^#!.*\b(?:bash|sh|dash|ksh)\b/.test(line);
  } finally {
    closeSync(fd);
  }
}

export function discover(root: string) {
  const listing = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  const sources = { typescript: [] as string[], python: [] as string[], shell: [] as string[] };
  for (const name of [...new Set(listing.split('\0'))].sort()) {
    if (!name || name.startsWith('verifications/evidence/') || name.split('/').some(part => excluded.has(part))) continue;
    const path = join(root, name);
    if (!lstatSync(path, { throwIfNoEntry: false })?.isFile()) continue;
    const extension = extname(name);
    if (['.ts', '.mts', '.cts'].includes(extension)) sources.typescript.push(name);
    else if (extension === '.py') sources.python.push(name);
    else if (['.sh', '.bash'].includes(extension) || hasShellShebang(path)) sources.shell.push(name);
  }
  return sources;
}

if (import.meta.main) console.log(JSON.stringify(discover(process.cwd())));
