/* ============================================================
   API-test.   npm test

   Start de server zelf op een vrije poort met een eigen, lege
   database en verse secrets, loopt de challenge af en controleert
   daarna de dingen die stuk mogen gaan zonder dat je het ziet:
   toestemming, de admin-ingang, en wat we over eerdere deelnemers
   prijsgeven.

   Geen testframework. Een mislukte check zet de exitcode op 1,
   dat is genoeg voor CI.
   ============================================================ */
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { actieveLevels } from '../src/spellen.js';

const wortel = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ADMIN_TOKEN = crypto.randomBytes(32).toString('hex');
const werkmap = fs.mkdtempSync(path.join(os.tmpdir(), 'aqua-api-test-'));

/* Vraag het besturingssysteem om een poort die vrij is. */
const vrijePoort = () =>
  new Promise((klaar) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => klaar(port));
    });
  });

let mislukt = 0;
function check(naam, goed) {
  console.log(`${goed ? 'ok  ' : 'FOUT'}  ${naam}`);
  if (!goed) mislukt++;
}

const poort = await vrijePoort();
const basis = `http://127.0.0.1:${poort}`;

async function api(pad, opties = {}) {
  const r = await fetch(basis + pad, {
    headers: { 'Content-Type': 'application/json', ...(opties.headers || {}) },
    ...opties,
    body: opties.body ? JSON.stringify(opties.body) : undefined,
  });
  return [r.status, await r.json().catch(() => ({})), r.headers];
}

const server = spawn(process.execPath, [path.join(wortel, 'server.js')], {
  cwd: wortel,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    PORT: String(poort),
    DB_PATH: path.join(werkmap, 'test.db'),
    IP_SALT: crypto.randomBytes(32).toString('hex'),
    ADMIN_TOKEN,
  },
});
let serverUitvoer = '';
server.stdout.on('data', (d) => (serverUitvoer += d));
server.stderr.on('data', (d) => (serverUitvoer += d));

/* Eerst wachten tot de server echt weg is: op Windows houdt hij het
   databasebestand vast en mislukt het verwijderen anders. Lukt het dan nog
   niet, dan laten we het erbij; het staat in de tijdelijke map. */
async function opruimen() {
  if (server.exitCode === null) {
    server.kill();
    await Promise.race([
      new Promise((klaar) => server.once('exit', klaar)),
      new Promise((klaar) => setTimeout(klaar, 2000)),
    ]);
  }
  try {
    fs.rmSync(werkmap, { recursive: true, force: true });
  } catch {
    /* niet erg */
  }
}

/* Wachten tot hij luistert. Valt de server om bij het starten, dan
   heeft doorgaan geen zin: dan tonen we zijn uitvoer en stoppen we. */
async function wachtOpServer() {
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) {
      console.error(`\nDe server stopte met code ${server.exitCode}:\n${serverUitvoer}`);
      await opruimen();
      process.exit(1);
    }
    try {
      await fetch(`${basis}/api/gezond`);
      return;
    } catch {
      await new Promise((k) => setTimeout(k, 100));
    }
  }
  console.error(`\nDe server kwam niet op tijd omhoog:\n${serverUitvoer}`);
  await opruimen();
  process.exit(1);
}

/* Speel de challenge uit. De juiste antwoorden komen uit spellen.js,
   zodat deze test niet rot zodra de levels veranderen. */
async function speelUit(sessieId) {
  for (const level of actieveLevels()) {
    const [, lv] = await api(`/api/sessie/${sessieId}/level`);
    if (lv.klaar) break;
    await api(`/api/sessie/${sessieId}/antwoord`, {
      method: 'POST',
      body: { keuze: level.juist },
    });
  }
}

try {
  await wachtOpServer();

  /* ---------- de gewone route ---------- */
  const [, s1] = await api('/api/sessie', { method: 'POST' });
  check('sessie aangemaakt', typeof s1.sessieId === 'string');

  const [, eersteLevel] = await api(`/api/sessie/${s1.sessieId}/level`);
  check('het juiste antwoord gaat niet mee naar de browser', !('juist' in eersteLevel.level));

  const [, fout] = await api(`/api/sessie/${s1.sessieId}/antwoord`, {
    method: 'POST',
    body: { keuze: 'bestaat-niet' },
  });
  check('fout antwoord mag opnieuw', fout.opnieuw === true);

  await speelUit(s1.sessieId);
  const [, na] = await api(`/api/sessie/${s1.sessieId}/level`);
  check('challenge afgerond', na.klaar === true);

  /* ---------- toestemming (AVG) ---------- */
  const gegevens = {
    voornaam: 'Testpiet',
    telefoon: '0612345678',
    email: 'test@example.nl',
    mboDiploma: true,
  };
  const [zonderCode, zonder] = await api(`/api/sessie/${s1.sessieId}/inzending`, {
    method: 'POST',
    body: gegevens,
  });
  check('zonder akkoord geweigerd', zonderCode === 400 && /akkoord/i.test(zonder.fout || ''));

  const [stringCode] = await api(`/api/sessie/${s1.sessieId}/inzending`, {
    method: 'POST',
    body: { ...gegevens, akkoord: 'ja' },
  });
  check('akkoord moet echt true zijn, niet waarheidsachtig', stringCode === 400);

  const [metCode, met] = await api(`/api/sessie/${s1.sessieId}/inzending`, {
    method: 'POST',
    body: { ...gegevens, akkoord: true },
  });
  check('met akkoord opgeslagen', metCode === 200 && met.opgeslagen === true);

  const [, bord] = await api('/api/leaderboard');
  check('op de ranglijst', bord.leaderboard.some((r) => r.voornaam === 'Testpiet'));

  /* ---------- niets prijsgeven over een eerdere deelnemer ---------- */
  const [, s2] = await api('/api/sessie', { method: 'POST' });
  check('eerdere inzending wordt wel gemeld', s2.alIngezonden === true);
  check('maar zonder tijd erbij', s2.eerdereTijdMs === undefined);

  await speelUit(s2.sessieId);
  const [, tweede] = await api(`/api/sessie/${s2.sessieId}/inzending`, {
    method: 'POST',
    body: { ...gegevens, voornaam: 'Tweede', akkoord: true },
  });
  check('tweede inzending vanaf hetzelfde netwerk geweigerd', tweede.reden === 'reeds_ingezonden');
  check('geen positie van de ander', tweede.eigenPositie === null);
  check('geen tijd van de ander', tweede.eigenTijdMs === null);
  check('niemand als "ikzelf" gemarkeerd', tweede.leaderboard.every((r) => r.ikzelf === false));

  /* ---------- admin-ingang ---------- */
  const [foutToken] = await api('/api/admin/statistiek', { headers: { 'x-admin-token': 'fout' } });
  check('fout admin-token geeft 401', foutToken === 401);

  const [goedToken, stat] = await api('/api/admin/statistiek', {
    headers: { 'x-admin-token': ADMIN_TOKEN },
  });
  check('juist admin-token geeft de statistiek', goedToken === 200 && stat.inzendingen === 1);

  let laatste = 0;
  for (let i = 0; i < 13; i++) {
    [laatste] = await api('/api/admin/statistiek', { headers: { 'x-admin-token': 'fout' } });
  }
  check('admin-pogingen worden begrensd', laatste === 429);

  /* ---------- beveiligingsheaders ---------- */
  const [, , headers] = await api('/api/gezond');
  check('CSP staat aan', (headers.get('content-security-policy') || '').includes("script-src 'self'"));
  check('geen HSTS over gewone http', headers.get('strict-transport-security') === null);
} finally {
  await opruimen();
}

console.log(mislukt ? `\n${mislukt} check(s) mislukt` : '\napi ok');
process.exit(mislukt ? 1 : 0);
