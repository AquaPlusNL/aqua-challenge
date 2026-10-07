import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'aqua-backup-test-'));
try {
  const dbPath = path.join(directory, 'source.db');
  const backups = path.join(directory, 'backups');
  const source = new DatabaseSync(dbPath);
  source.exec("CREATE TABLE check_backup (value TEXT); INSERT INTO check_backup VALUES ('bewaard')");
  const result = spawnSync(process.execPath, ['scripts/backup.js', backups], {
    cwd: path.dirname(path.dirname(fileURLToPath(import.meta.url))),
    env: { ...process.env, DB_PATH: dbPath },
    encoding: 'utf8',
  });
  source.close();
  if (result.status !== 0) throw new Error(result.stderr || 'Backup mislukt');
  const files = fs.readdirSync(backups).filter((name) => name.endsWith('.db'));
  if (files.length !== 1) throw new Error('Verwacht precies één backup');
  const snapshot = new DatabaseSync(path.join(backups, files[0]), { readOnly: true });
  try {
    if (snapshot.prepare('SELECT value FROM check_backup').get().value !== 'bewaard') {
      throw new Error('Backup bevat niet de verwachte gegevens');
    }
  } finally {
    snapshot.close();
  }
  console.log('backup ok');
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
