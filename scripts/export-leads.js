/* Eenmalige, lokale export. Geen HTTP-endpoint: alleen wie DB-leesrechten en
   toegang tot de VM heeft, kan de persoonsgegevens ophalen. */
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = process.env.DB_PATH;
const output = process.argv[2];
if (!dbPath || !output || !path.isAbsolute(output)) {
  console.error('Gebruik: DB_PATH=/pad/naar/challenge.db node scripts/export-leads.js /absoluut/pad/leads.csv');
  process.exit(2);
}

const headers = [
  'voornaam', 'telefoon', 'email', 'mbo_diploma', 'tijd_ms', 'fouten',
  'aangemaakt_utc', 'toestemming_op_utc', 'toestemming_versie',
  'toestemming_tekst', 'toestemming_bron', 'talentpool', 'talentpool_tekst',
];

// Spreadsheetsoftware interpreteert ook gequote CSV-cellen als formule.
// Een apostrof maakt zulke gebruikerswaarden tekst bij openen in Excel.
function cel(value) {
  let text = String(value ?? '');
  if (/^[\s\u0000-\u001f]*[=+\-@]/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

const iso = (milliseconds) => milliseconds == null ? '' : new Date(milliseconds).toISOString();
let db;
let fd;
let failed = false;
try {
  db = new DatabaseSync(dbPath, { readOnly: true, fileMustExist: true });
  const rows = db.prepare(`
    SELECT voornaam, telefoon, email, mbo_diploma, totaal_ms, fouten,
           aangemaakt, toestemming_op, toestemming_versie,
           toestemming_tekst, toestemming_bron, talentpool, talentpool_tekst
    FROM inzendingen ORDER BY aangemaakt, id
  `).all();
  fd = fs.openSync(output, 'wx', 0o600);
  fs.writeSync(fd, '\uFEFF' + headers.join(',') + '\r\n');
  for (const row of rows) {
    const values = [
      row.voornaam, row.telefoon, row.email, row.mbo_diploma,
      row.totaal_ms, row.fouten, iso(row.aangemaakt), iso(row.toestemming_op),
      row.toestemming_versie, row.toestemming_tekst, row.toestemming_bron,
      row.talentpool, row.talentpool_tekst,
    ];
    fs.writeSync(fd, values.map(cel).join(',') + '\r\n');
  }
  console.log(`${rows.length} leads geëxporteerd naar ${output}`);
} catch (error) {
  failed = true;
  console.error(error);
  process.exitCode = 1;
} finally {
  if (fd != null) fs.closeSync(fd);
  db?.close();
  if (failed && fd != null) {
    try { fs.unlinkSync(output); } catch { /* bestand kan al ontbreken */ }
  }
}
