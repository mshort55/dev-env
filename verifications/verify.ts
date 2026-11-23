import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildImage } from './scripts/build-image.ts';

async function verify(args: string[]) {
  const bootstrapOnly = args.length === 1 && args[0] === '--bootstrap-only';
  const imageOnly =
    args.length === 2 && args[0] === '--image-only' && ['docker', 'podman'].includes(args[1]);
  if (args.length && !bootstrapOnly && !imageOnly) {
    console.error(
      'usage: node verifications/verify.ts [--bootstrap-only | --image-only docker|podman]',
    );
    return 2;
  }
  const id = randomUUID();
  const evidence = join(import.meta.dirname, 'evidence', id);
  mkdirSync(evidence, { recursive: true, mode: 0o700 });
  let status = 0;
  if (!imageOnly) {
    const scratch = mkdtempSync('/tmp/dev-env-verify-');
    const cleanup = () => rmSync(scratch, { recursive: true, force: true });
    const interrupted = () => process.exit(130);
    const terminated = () => process.exit(143);
    process.once('exit', cleanup);
    process.once('SIGINT', interrupted);
    process.once('SIGTERM', terminated);
    try {
      console.log(`ready scratch=${scratch} evidence=${evidence}`);
      writeFileSync(
        join(evidence, 'run.env'),
        `RUN_ID=${id}\nSURFACE=cli\nSCRATCH=${scratch}\nEVIDENCE_DIR=${evidence}\n`,
      );
      const { driveBootstrap } = await import('./scripts/drive-bootstrap.ts');
      await driveBootstrap(scratch, evidence);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeFileSync(join(evidence, 'bootstrap-error.log'), message + '\n');
      console.error(message);
      status = 1;
    } finally {
      cleanup();
      process.off('exit', cleanup);
      process.off('SIGINT', interrupted);
      process.off('SIGTERM', terminated);
      console.log(`cleaned scratch=${scratch} evidence=${evidence}`);
    }
  }
  if (!bootstrapOnly) {
    const engine = args[1] === 'podman' ? 'podman' : 'docker';
    console.log(`image engine=${engine} evidence=${evidence}`);
    const imageStatus = await buildImage(engine, id, evidence);
    status ||= imageStatus;
  }
  if (!status) console.log('verified evidence=' + evidence);
  return status;
}

try {
  process.exitCode = await verify(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
