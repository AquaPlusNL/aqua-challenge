import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'aqua-export-test-'));
try {
  const dbPath = path.join(directory, 'source.db');
  const output = path.join(directory, 'leads.csv');
  const db = new DatabaseSync(dbPath);
  db.exec(`CREATE TABLE inzendingen (
    id INTEGER, voornaam TEXT, telefoon TEXT, email TEXT, mbo_diploma INTEGER,
    totaal_ms INTEGER, fouten INTEGER, aangemaakt INTEGER, toestemming_op INTEGER,
    toestemming_versie TEXT, toestemming_tekst TEXT, toestemming_bron TEXT,
    talentpool INTEGER, talentpool_tekst TEXT, ip_hash TEXT
  )`);
  db.prepare(`INSERT INTO inzendingen VALUES (
    1, ?, '+31612345678', 'test@example.com', 1, 12000, 0,
    1750000000000, 1750000000000, '2026-09-15', 'akkoord',
    'challenge', 0, NULL, 'geheime-ip-hash'
  )`).run('=2+2');
  db.close();

  const command = [path.join(path.dirname(fileURLToPath(import.meta.url)), 'export-leads.js'), output];
  const options = { env: { ...process.env, DB_PATH: dbPath }, encoding: 'utf8' };
  const result = spawnSync(process.execPath, command, options);
  if (result.status !== 0) throw new Error(result.stderr || 'Export mislukt');
  const csv = fs.readFileSync(output, 'utf8');
  if (!csv.includes("\"'=2+2\"") || !csv.includes("\"'+31612345678\"")) {
    throw new Error('CSV-formule niet geneutraliseerd');
  }
  if (csv.includes('geheime-ip-hash') || !csv.includes('test@example.com')) {
    throw new Error('Export bevat verkeerde gegevens');
  }
  if (spawnSync(process.execPath, command, options).status === 0) {
    throw new Error('Bestaand exportbestand is overschreven');
  }
  console.log('lead-export ok');
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
