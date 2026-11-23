import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import pty from 'node-pty';

function parse(args: string[]) {
  let transcript = '';
  let timeout = 30;
  const steps: { expect: string; send?: string }[] = [];
  let i = 0;
  for (; i < args.length && args[i] !== '--'; i += 2) {
    const option = args[i], value = args[i + 1];
    if (value === undefined) throw new Error(`missing value for ${option}`);
    switch (option) {
      case '--transcript': transcript = value; break;
      case '--timeout': timeout = Number(value); break;
      case '--expect': steps.push({ expect: value }); break;
      case '--send':
      case '--send-file': {
        const step = steps.at(-1);
        if (!step || step.send !== undefined) throw new Error(`${option} without --expect`);
        step.send = option === '--send' ? value : readFileSync(value, 'utf8').replace(/\r?\n$/, '');
        break;
      }
      default: throw new Error(`unknown argument: ${option}`);
    }
  }
  if (!transcript) throw new Error('--transcript is required');
  if (!Number.isFinite(timeout) || timeout < 0) throw new Error('invalid timeout');
  if (args[i] !== '--' || !args[i + 1]) throw new Error('missing command after --');
  return { transcript, timeout, steps, command: args.slice(i + 1) };
}

async function drive() {
  const { transcript, timeout, steps, command } = parse(process.argv.slice(2));
  mkdirSync(dirname(transcript), { recursive: true });
  const child = pty.spawn(command[0], command.slice(1), { cwd: process.cwd(), env: process.env });
  const chunks: string[] = [];
  let buffer = '', index = 0, expired = false;
  child.onData((chunk) => {
    chunks.push(chunk);
    buffer += chunk;
    while (index < steps.length) {
      const { expect, send } = steps[index];
      const position = buffer.indexOf(expect);
      if (position < 0) break;
      buffer = buffer.slice(position + expect.length);
      index++;
      if (send !== undefined) child.write(send + '\n');
    }
  });
  const deadline = setTimeout(() => {
    expired = true;
    child.kill('SIGKILL');
  }, timeout * 1000);
  const status = await new Promise<number>((resolve) =>
    child.onExit(({ exitCode, signal }) => resolve(signal ? 1 : exitCode)));
  clearTimeout(deadline);
  const missed = expired || index !== steps.length;
  if (missed) chunks.push(`\n[pty_run timeout or missed prompt waiting for: ${steps[index]?.expect ?? ''}]\n`);
  writeFileSync(transcript, chunks.join(''), { mode: 0o600 });
  return missed ? 2 : status;
}

try {
  process.exitCode = await drive();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
