import { writeFile } from 'node:fs/promises';
import kdbx from 'kdbxweb';
import { credentials } from '../../scripts/keepass.ts';

type FixtureEntry = { title: string; password?: string; notes?: string; attachment?: Uint8Array };

export async function writeKeePassFixture(path: string, password: string, entries: FixtureEntry[]) {
  const db = kdbx.Kdbx.create(credentials(password), 'Disposable verification database');
  for (const { title, password, notes, attachment } of entries) {
    const entry = db.createEntry(db.getDefaultGroup());
    entry.fields.set('Title', title);
    if (password !== undefined) entry.fields.set('Password', kdbx.ProtectedValue.fromString(password));
    if (notes !== undefined) entry.fields.set('Notes', notes);
    if (attachment) entry.binaries.set('fixture.bin', await db.createBinary(Uint8Array.from(attachment).buffer));
  }
  await writeFile(path, new Uint8Array(await db.save()), { mode: 0o600 });
}
