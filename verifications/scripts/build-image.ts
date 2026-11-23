import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { closeSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { constants } from 'node:os';
import { basename, join, resolve } from 'node:path';

const repo = resolve(import.meta.dirname, '../..');
const dockerfile = '.devcontainer/dev/Dockerfile';
type Engine = 'docker' | 'podman';

function buildArgs() {
  const example = new Map(readFileSync(join(repo, '.env.example'), 'utf8')
    .split('\n').map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  return Array.from(readFileSync(join(repo, dockerfile), 'utf8').matchAll(/^ARG (\w+)\s*$/gm), ([, name]) => {
    const value = example.get(name);
    if (value === undefined || value.includes('$')) throw new Error(`expected literal ${name} in .env.example`);
    return `${name}=${value}`;
  });
}

async function command(engine: Engine, args: string[], stdout: string, stderr = stdout): Promise<number> {
  const out = openSync(stdout, 'w');
  const err = stderr === stdout ? out : openSync(stderr, 'w');
  try {
    const child = spawn(engine, args, { stdio: ['ignore', out, err] });
    const terminate = () => { child.kill('SIGTERM'); };
    const interrupt = () => { child.kill('SIGINT'); };
    process.on('SIGTERM', terminate);
    process.on('SIGINT', interrupt);
    try {
      return await new Promise((done, reject) => {
        child.on('error', (error: NodeJS.ErrnoException) => {
          reject(error.code === 'ENOENT' ? new Error(`${engine} is required`) : error);
        });
        child.on('close', (code, signal) => done(code ?? 128 + constants.signals[signal!]));
      });
    } finally {
      process.off('SIGTERM', terminate);
      process.off('SIGINT', interrupt);
    }
  } finally {
    closeSync(out);
    if (err !== out) closeSync(err);
  }
}

export async function buildImage(engine: Engine, runId: string, evidenceDir: string): Promise<number> {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,100}$/.test(runId)) throw new Error('invalid image verification run ID');
  const out = join(evidenceDir, 'container-image');
  const tag = `dev-env:verify-${runId}`;
  mkdirSync(out, { recursive: true, mode: 0o700 });
  const file = (name: string) => join(out, name);
  const args = buildArgs();
  writeFileSync(file('build-args.txt'), args.join('\n') + '\n');
  writeFileSync(file('build.env'), `engine=${engine}\ntag=${tag}\nenv_file=.env.example\ndockerfile=${dockerfile}\ncontainer_started=no\n`);
  const version = await command(engine, ['version'], file('engine-version.txt'));
  if (version) return version;
  const status = await command(engine, ['build', '--file', join(repo, dockerfile), '--tag', tag,
    ...args.flatMap(arg => ['--build-arg', arg]), repo], file('build.log'));
  writeFileSync(file('build.exit'), status + '\n');
  if (status) {
    console.error(`build-image: ${engine} build failed; log is ${file('build.log')}`);
    await command(engine, ['rmi', tag], file('rmi.out'), file('rmi.err'));
    return status;
  }
  let inspection: number;
  let removal: number;
  try {
    inspection = await command(engine, ['image', 'inspect', '--format', '{{.Id}}', tag], file('image-id.txt'));
  } finally {
    removal = await command(engine, ['rmi', tag], file('rmi.out'), file('rmi.err'));
  }
  if (inspection || removal) return inspection || removal;
  writeFileSync(file('side-effects.txt'), `engine=${engine}\ntag=${tag}\nimage_removed=yes\ncontainer_started=no\nenv_file=.env.example\nlatest_tag_used=no\nbuild_exit=0\n`);
  console.log(`built feature=container-image evidence=${out}`);
  return 0;
}

if (import.meta.main) {
  const [engine, runDirectory, ...extra] = process.argv.slice(2);
  if ((engine !== 'docker' && engine !== 'podman') || extra.length) {
    console.error('usage: node verifications/scripts/build-image.ts docker|podman [RUN_EVIDENCE_DIR]');
    process.exitCode = 2;
  } else {
    const evidence = runDirectory ? resolve(runDirectory) : join(repo, 'verifications/evidence', randomUUID());
    const runId = basename(evidence);
    console.log(`image engine=${engine} evidence=${evidence}`);
    try {
      process.exitCode = await buildImage(engine, runId, evidence);
    } catch (error) {
      console.error(`build-image: ${error instanceof Error ? error.message : error}`);
      process.exitCode = 1;
    }
  }
}
