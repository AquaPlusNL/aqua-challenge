import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DB_PATH = process.env.DB_PATH || './data/challenge.db';
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');

db.exec(`
  /* Een sessie is een poging. We bewaren per sessie hoe ver iemand
     kwam, hoe lang elk level duurde en hoeveel foute pogingen er
     waren. Daarmee kun je zien waar kandidaten afhaken. */
  CREATE TABLE IF NOT EXISTS sessies (
    id               TEXT PRIMARY KEY,
    ip_hash          TEXT NOT NULL,
    gestart_op       INTEGER NOT NULL,
    level_index      INTEGER NOT NULL DEFAULT 0,
    level_gestart_op INTEGER,
    resultaten       TEXT NOT NULL DEFAULT '[]',
    hoogste_level    INTEGER NOT NULL DEFAULT 0,
    totaal_ms        INTEGER,
    afgerond         INTEGER NOT NULL DEFAULT 0,
    fouten_huidig    INTEGER NOT NULL DEFAULT 0,
    laatst_actief    INTEGER NOT NULL
  );

  /* Een inzending is een ingevuld contactformulier. Per IP-hash
     kan er maximaal een inzending zijn. */
  CREATE TABLE IF NOT EXISTS inzendingen (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    sessie_id    TEXT NOT NULL,
    ip_hash      TEXT NOT NULL UNIQUE,
    voornaam     TEXT NOT NULL,
    telefoon     TEXT NOT NULL,
    email        TEXT NOT NULL,
    mbo_diploma  INTEGER NOT NULL,
    totaal_ms    INTEGER NOT NULL,
    aangemaakt   INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_tijd    ON inzendingen (totaal_ms ASC, aangemaakt ASC);
  CREATE INDEX IF NOT EXISTS idx_ses_ip  ON sessies (ip_hash);
  CREATE INDEX IF NOT EXISTS idx_ses_lvl ON sessies (hoogste_level);
`);

/* ------------------------------------------------------------
   IP-hash. Het IP-adres wordt NOOIT onversleuteld opgeslagen:
   alleen een SHA-256-hash met een geheim zout uit .env. Daarmee
   kun je zien of vanaf dit netwerk al is ingezonden, maar niet
   herleiden welk IP dat was.
   ------------------------------------------------------------ */
const SALT = process.env.IP_SALT || '';
if (!SALT) {
  console.warn(
    '[let op] IP_SALT is niet gezet. Zet een lange willekeurige waarde in .env voordat je live gaat.',
  );
}
export const hashIp = (ip) =>
  crypto.createHash('sha256').update(`${SALT}:${ip || 'onbekend'}`).digest('hex');

export const q = {
  nieuweSessie: db.prepare(
    `INSERT INTO sessies (id, ip_hash, gestart_op, laatst_actief) VALUES (?, ?, ?, ?)`,
  ),
  sessie: db.prepare(`SELECT * FROM sessies WHERE id = ?`),
  startLevel: db.prepare(
    `UPDATE sessies SET level_gestart_op = ?, hoogste_level = MAX(hoogste_level, ?),
            laatst_actief = ? WHERE id = ?`,
  ),
  raakLevelAan: db.prepare(`UPDATE sessies SET laatst_actief = ? WHERE id = ?`),
  telFout: db.prepare(
    `UPDATE sessies SET fouten_huidig = fouten_huidig + 1, laatst_actief = ? WHERE id = ?`,
  ),
  bewaarResultaat: db.prepare(
    `UPDATE sessies SET resultaten = ?, level_index = ?, level_gestart_op = NULL,
            totaal_ms = ?, afgerond = ?, fouten_huidig = 0, laatst_actief = ?
     WHERE id = ?`,
  ),

  inzendingVoorIp: db.prepare(`SELECT * FROM inzendingen WHERE ip_hash = ?`),
  inzending: db.prepare(`SELECT * FROM inzendingen WHERE id = ?`),
  bewaarInzending: db.prepare(
    `INSERT INTO inzendingen (sessie_id, ip_hash, voornaam, telefoon, email,
                              mbo_diploma, totaal_ms, aangemaakt)
     VALUES (@sessie_id, @ip_hash, @voornaam, @telefoon, @email,
             @mbo_diploma, @totaal_ms, @aangemaakt)`,
  ),
  /* Snelste tijden bovenaan. */
  top: db.prepare(
    `SELECT id, voornaam, totaal_ms FROM inzendingen
     ORDER BY totaal_ms ASC, aangemaakt ASC LIMIT ?`,
  ),
  positie: db.prepare(
    `SELECT COUNT(*) + 1 AS positie FROM inzendingen
     WHERE totaal_ms < ? OR (totaal_ms = ? AND aangemaakt < ?)`,
  ),
  aantalInzendingen: db.prepare(`SELECT COUNT(*) AS n FROM inzendingen`),
  verwijderOudeSessies: db.prepare(`DELETE FROM sessies WHERE laatst_actief < ?`),
};

/* ------------------------------------------------------------
   Statistiek: waar haken kandidaten af?
   ------------------------------------------------------------ */
export function statistiek(aantalLevels) {
  const totaalSessies = db.prepare('SELECT COUNT(*) AS n FROM sessies').get().n;
  const gestartMetSpel = db
    .prepare('SELECT COUNT(*) AS n FROM sessies WHERE hoogste_level >= 1')
    .get().n;
  const afgerond = db.prepare('SELECT COUNT(*) AS n FROM sessies WHERE afgerond = 1').get().n;

  const rijen = db.prepare('SELECT resultaten, hoogste_level, afgerond FROM sessies').all();
  const perLevel = [];
  for (let n = 1; n <= aantalLevels; n++) {
    const bereikt = rijen.filter((r) => r.hoogste_level >= n).length;
    const gehaald = rijen.filter((r) => {
      const res = JSON.parse(r.resultaten);
      return res.some((x) => x.nummer === n && x.gehaald);
    }).length;
    const tijden = rijen
      .flatMap((r) => JSON.parse(r.resultaten))
      .filter((x) => x.nummer === n && x.gehaald)
      .map((x) => x.tijdMs);
    const fouten = rijen
      .flatMap((r) => JSON.parse(r.resultaten))
      .filter((x) => x.nummer === n)
      .reduce((a, x) => a + (x.foutePogingen || 0), 0);
    perLevel.push({
      level: n,
      bereikt,
      gehaald,
      afgehaakt: bereikt - gehaald,
      gemiddeldeSeconden: tijden.length
        ? Math.round(tijden.reduce((a, b) => a + b, 0) / tijden.length / 100) / 10
        : null,
      foutePogingen: fouten,
    });
  }

  return {
    sessies: totaalSessies,
    gestartMetSpel,
    afgerond,
    inzendingen: q.aantalInzendingen.get().n,
    perLevel,
  };
}

export function resetDb(wat = 'alles') {
  if (wat === 'inzendingen' || wat === 'alles') db.exec('DELETE FROM inzendingen');
  if (wat === 'sessies' || wat === 'alles') db.exec('DELETE FROM sessies');
  return {
    inzendingen: q.aantalInzendingen.get().n,
    sessies: db.prepare('SELECT COUNT(*) AS n FROM sessies').get().n,
  };
}
