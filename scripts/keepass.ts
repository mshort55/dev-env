import { readFile } from 'node:fs/promises';
import { hashRaw } from '@node-rs/argon2';
import kdbx from 'kdbxweb';

kdbx.CryptoEngine.setArgon2Impl(async (password, salt, memory, iterations, length, parallelism, type, version) => {
  const key = await hashRaw(new Uint8Array(password), {
    salt: new Uint8Array(salt), memoryCost: memory, timeCost: iterations,
    outputLen: length, parallelism, algorithm: type, version: version === 0x10 ? 0 : 1,
  });
  return Uint8Array.from(key).buffer;
});

export function credentials(password: string) {
  return new kdbx.Credentials(kdbx.ProtectedValue.fromString(password));
}

export async function loadKeePass(path: string, password: string) {
  return kdbx.Kdbx.load(Uint8Array.from(await readFile(path)).buffer, credentials(password));
}
