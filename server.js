/* ============================================================
   Aqua+ Challenge, server
   Express + SQLite. Zie README.md voor installatie en API.

   De score is de TIJD. De server meet zelf hoe lang elk level
   duurt, dus de tijd is niet vanuit de browser te manipuleren.
   ============================================================ */
import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, q, hashIp, resetDb, statistiek } from './src/db.js';
import { actieveLevels, levelPubliek, GRACE_MS, MINIMUM_MS } from './src/spellen.js';
import { normaliseerTelefoon } from './src/telefoon.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3000);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
// De admin-endpoints kunnen alle inzendingen wissen. Niet starten met een
// ontbrekend, kort of nog niet vervangen voorbeeldtoken.
if (ADMIN_TOKEN.length < 32 || ADMIN_TOKEN.startsWith('verander-dit')) {
  throw new Error(
    'ADMIN_TOKEN ontbreekt, is korter dan 32 tekens of staat nog op de voorbeeldwaarde. ' +
      'Zet een lange willekeurige waarde in .env, bijvoorbeeld met:\n' +
      "  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
  );
}
const VACATURE_URL = process.env.VACATURE_URL || '/vacatures';
const REDIRECT_SECONDEN = Number(process.env.REDIRECT_SECONDEN || 5);
const SESSIE_BEWAARDAGEN = Number(process.env.SESSIE_BEWAARDAGEN || 30);
// Twee bewaartermijnen, zie de privacyverklaring hoofdstuk 7: vier weken voor
// contactgegevens zonder vervolg, twaalf maanden bij talentpool-toestemming.
const INZENDING_BEWAARDAGEN = Number(process.env.INZENDING_BEWAARDAGEN || 28);
const TALENTPOOL_BEWAARDAGEN = Number(process.env.TALENTPOOL_BEWAARDAGEN || 365);
// Versie van de privacyverklaring waarmee de kandidaat akkoord gaat. Houd dit
// gelijk aan de versiedatum bovenaan public/privacyverklaring.html.
const PRIVACY_VERSIE = process.env.PRIVACY_VERSIE || '2026-09-15';

/* De toestemmingsteksten staan hier, en nergens anders. De pagina haalt ze op
   en toont ze; bij een inzending leggen we exact deze zinnen vast. Daarmee kan
   er geen licht zitten tussen wat de kandidaat las en wat wij bewaren, ook niet
   als de tekst later verandert. Wat de browser terugstuurt gebruiken we hier
   bewust niet: een client mag niet bepalen waarmee hij akkoord ging. */
const TOESTEMMING = {
  versie: PRIVACY_VERSIE,
  bron: 'inzendformulier challenge',
  akkoord:
    'Aqua+ mag mijn gegevens gebruiken om contact met me op te nemen over werken bij Aqua+. ' +
    'Op de ranglijst komen alleen mijn voornaam en mijn tijd te staan.',
  talentpool:
    'Ja, Aqua+ mag mijn gegevens maximaal 12 maanden na het laatste relevante contactmoment ' +
    'bewaren in het recruitmentsysteem Jobylon en mij benaderen voor passende toekomstige ' +
    'vacatures. Ik kan mijn toestemming altijd intrekken via werkenbij@aqua.nl.',
};
const CONTACT = { email: process.env.CONTACT_EMAIL || '' };

// Achter nginx, Traefik of Cloudflare: TRUST_PROXY=1.
// Anders krijgt iedereen het IP van de proxy.
app.set('trust proxy', Number(process.env.TRUST_PROXY || 0));

// Beveiligingsheaders. Geen inline scripts in de pagina; wel een paar inline
// style-attributen en SVG-tekeningen, daarom style-src met 'unsafe-inline'.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  // Alleen sturen als de verbinding al beveiligd is; op http://localhost
  // negeert de browser de header toch en zet hij alleen maar aan tot verwarring.
  // req.secure kijkt naar X-Forwarded-Proto, dus TRUST_PROXY moet goed staan.
  if (req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data:; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  );
  next();
});

const LIVE_RELOAD = process.env.LIVE_RELOAD === '1';

app.use(express.json({ limit: '16kb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: LIVE_RELOAD ? 0 : '1h' }));
/* Telefoonvalidatie gedeeld met de browser: zelfde regels aan beide kanten. */
app.get('/telefoon.js', (req, res) => res.sendFile(path.join(__dirname, 'src/telefoon.js')));

/* ---------- live reload, alleen met LIVE_RELOAD=1 (ontwikkeling) ----------
   De pagina's laden altijd /dev-reload.js; zonder LIVE_RELOAD is dat een
   no-op, met LIVE_RELOAD herlaadt de browser zodra iets in public/ wijzigt. */
if (LIVE_RELOAD) {
  const { watch } = await import('node:fs');
  const kijkers = new Set();
  let timer;
  watch(path.join(__dirname, 'public'), { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      for (const res of kijkers) res.write('data: reload\n\n');
    }, 100);
  });
  app.get('/dev-reload', (req, res) => {
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' });
    res.flushHeaders();
    kijkers.add(res);
    req.on('close', () => kijkers.delete(res));
  });
}
app.get('/dev-reload.js', (req, res) => {
  res.type('js').set('Cache-Control', 'no-store');
  res.send(LIVE_RELOAD ? "new EventSource('/dev-reload').onmessage = () => location.reload();" : '');
});

/* ---------- simpele snelheidsbegrenzer per IP-hash ---------- */
const VENSTER_MS = 60_000;
const tellers = new Map();
function begrens(sleutel, max, vensterMs) {
  const nu = Date.now();
  const rij = (tellers.get(sleutel) || []).filter((t) => nu - t < vensterMs);
  rij.push(nu);
  tellers.set(sleutel, rij);
  return rij.length <= max;
}

/* Alleen sleutels weggooien die buiten het venster vallen. Eerder werd de hele
   map geleegd, en dan kon je met een beetje timing rond die schoonmaak het
   dubbele van je limiet halen. */
setInterval(() => {
  const grens = Date.now() - VENSTER_MS;
  for (const [sleutel, rij] of tellers) {
    if (rij.every((t) => t < grens)) tellers.delete(sleutel);
  }
}, 10 * 60 * 1000).unref();

const ipHashVan = (req) => hashIp(req.ip);
const levels = () => actieveLevels();
const fout = (res, code, bericht) => res.status(code).json({ fout: bericht });

/* ============================================================
   GET /api/config
   ============================================================ */
app.get('/api/config', (req, res) =>
  res.json({
    aantalLevels: levels().length,
    vacatureUrl: VACATURE_URL,
    redirectSeconden: REDIRECT_SECONDEN,
    contact: CONTACT,
  }),
);

/* ============================================================
   POST /api/sessie
   ============================================================ */
app.post('/api/sessie', (req, res) => {
  const ip_hash = ipHashVan(req);
  if (!begrens(`sessie:${ip_hash}`, 40, 60_000)) {
    return fout(res, 429, 'Te veel pogingen. Probeer het over een minuut opnieuw.');
  }
  const lijst = levels();
  if (lijst.length === 0) return fout(res, 503, 'Er staan geen levels aan.');

  const nu = Date.now();
  const id = crypto.randomUUID();
  q.nieuweSessie.run(id, ip_hash, nu, nu);

  const eerder = q.inzendingVoorIp.get(ip_hash);
  res.json({
    sessieId: id,
    aantalLevels: lijst.length,
    vacatureUrl: VACATURE_URL,
    contact: CONTACT,
    /* Wel melden dat er al is ingezonden, niet met welke tijd: op een gedeeld
       netwerk (kantoor, school, beursstand) is dat de tijd van iemand anders. */
    alIngezonden: Boolean(eerder),
    toestemming: TOESTEMMING,
  });
});

/* ============================================================
   GET /api/sessie/:id/level
   Levert het huidige level uit (zonder juist antwoord) en start
   de klok van dat level.
   ============================================================ */
app.get('/api/sessie/:id/level', (req, res) => {
  const s = q.sessie.get(req.params.id);
  if (!s) return fout(res, 404, 'Onbekende sessie.');

  const lijst = levels();
  const level = lijst[s.level_index];
  if (s.afgerond || !level) {
    return res.json({ klaar: true, totaalMs: s.totaal_ms, resultaten: JSON.parse(s.resultaten) });
  }

  const nu = Date.now();
  // De klok start bij het eerste verzoek voor dit level. Vraag je de
  // vraag opnieuw op, dan blijft de oorspronkelijke starttijd staan,
  // zodat je de klok niet kunt terugzetten met een refresh.
  if (!s.level_gestart_op) q.startLevel.run(nu, level.nummer, nu, s.id);
  else q.raakLevelAan.run(nu, s.id);

  const gestartOp = s.level_gestart_op || nu;
  const resterendeMs = Math.max(0, level.maxSeconden * 1000 - (nu - gestartOp));

  res.json({
    klaar: false,
    level: levelPubliek(level),
    aantalLevels: lijst.length,
    resterendeMs,
    foutePogingen: s.fouten_huidig,
  });
});

/* ============================================================
   POST /api/sessie/:id/antwoord   { keuze }
   Goed  -> level afgerond, tijd vastgelegd, door naar het volgende.
   Fout  -> je mag opnieuw. Dat kost tijd, en tijd is de score.
   Klok af -> level niet gehaald, volle leveltijd gerekend, door.
   ============================================================ */
app.post('/api/sessie/:id/antwoord', (req, res) => {
  /* Dit endpoint had als enige in het spel geen begrenzing. Zestig antwoorden
     per minuut is ruim voor vier levels met hervatten na een fout, en te weinig
     voor een script dat de ranglijst wil vullen. */
  if (!begrens(`antwoord:${ipHashVan(req)}`, 60, VENSTER_MS)) {
    return fout(res, 429, 'Te veel pogingen. Probeer het over een minuut opnieuw.');
  }

  const s = q.sessie.get(req.params.id);
  if (!s) return fout(res, 404, 'Onbekende sessie.');
  if (s.afgerond) return fout(res, 409, 'Deze sessie is al afgerond.');

  const lijst = levels();
  const level = lijst[s.level_index];
  if (!level) return fout(res, 409, 'Geen actief level in deze sessie.');
  if (!s.level_gestart_op) return fout(res, 409, 'De klok van dit level is niet gestart.');

  const keuze = typeof req.body?.keuze === 'string' ? req.body.keuze : null;
  const nu = Date.now();
  const verstrekenMs = nu - s.level_gestart_op;

  /* Te snel om gelezen te kunnen zijn. Het level blijft open en de klok loopt
     door, dus een mens die dit ooit ziet klikt gewoon nog een keer. */
  if (verstrekenMs < MINIMUM_MS) {
    return fout(res, 400, 'Dat ging wel erg snel. Lees de vraag en probeer het opnieuw.');
  }
  const maxMs = level.maxSeconden * 1000;
  const tijdOm = keuze === null || verstrekenMs > maxMs + GRACE_MS;
  const goed = !tijdOm && keuze === level.juist;

  /* Fout, maar de klok loopt nog: opnieuw proberen. */
  if (!goed && !tijdOm) {
    q.telFout.run(nu, s.id);
    return res.json({
      goed: false,
      tijdOm: false,
      opnieuw: true,
      uitleg: level.uitlegFout,
      foutePogingen: s.fouten_huidig + 1,
      resterendeMs: Math.max(0, maxMs - verstrekenMs),
    });
  }

  /* Goed, of de klok is afgelopen: level afsluiten. */
  const tijdMs = Math.min(verstrekenMs, maxMs);
  const resultaten = JSON.parse(s.resultaten);
  resultaten.push({
    id: level.id,
    nummer: level.nummer,
    gehaald: goed,
    tijdMs,
    foutePogingen: s.fouten_huidig,
  });

  const volgendeIndex = s.level_index + 1;
  const klaar = volgendeIndex >= lijst.length;
  const totaalMs = resultaten.reduce((a, r) => a + r.tijdMs, 0);

  q.bewaarResultaat.run(
    JSON.stringify(resultaten),
    volgendeIndex,
    klaar ? totaalMs : null,
    klaar ? 1 : 0,
    nu,
    s.id,
  );

  res.json({
    goed,
    tijdOm,
    opnieuw: false,
    juisteOptie: level.juist,
    uitleg: goed ? level.uitlegGoed : level.uitlegFout,
    motivatie: level.motivatie,
    volgendeKnop: level.volgendeKnop,
    levelTijdMs: tijdMs,
    foutePogingen: s.fouten_huidig,
    tussenstandMs: totaalMs,
    klaar,
    totaalMs: klaar ? totaalMs : null,
    alleGehaald: klaar ? resultaten.every((r) => r.gehaald) : null,
  });
});

/* ============================================================
   POST /api/sessie/:id/inzending
   Contactformulier. Per IP-hash maximaal een inzending.
   ============================================================ */
app.post('/api/sessie/:id/inzending', (req, res) => {
  const s = q.sessie.get(req.params.id);
  if (!s) return fout(res, 404, 'Onbekende sessie.');
  if (!s.afgerond) return fout(res, 409, 'De challenge is nog niet afgerond.');

  const ip_hash = ipHashVan(req);
  if (!begrens(`inzending:${ip_hash}`, 10, 60_000)) {
    return fout(res, 429, 'Te veel pogingen. Probeer het over een minuut opnieuw.');
  }

  const b = req.body || {};
  /* Alleen het eerste woord: op de ranglijst komt uitsluitend de voornaam. */
  /* Afkappen, niet weigeren: 40 tekens is ruim voor een voornaam, en wie meer
     instuurt is geen kandidaat. Zonder grens komt een naam van kilobytes lang
     ongeschonden op de ranglijst van iedere bezoeker terecht. */
  const voornaam = String(b.voornaam || '').trim().split(/\s+/)[0].slice(0, 40);
  const telefoon = normaliseerTelefoon(b.telefoon);
  const email = String(b.email || '').trim().slice(0, 254);
  const mbo = b.mboDiploma;

  /* AVG: zonder akkoord slaan we niets op. De vinkjes in de browser zijn
     geen grondslag; de server moet het eisen en het moment vastleggen. */
  if (b.akkoord !== true) {
    return fout(res, 400, 'Zonder akkoord kunnen we je gegevens niet bewaren.');
  }
  /* De talentpool is vrijwillig: geen vinkje betekent gewoon de korte
     bewaartermijn, niet een geweigerde inzending. */
  const talentpool = b.talentpool === true;
  if (voornaam.length < 2) return fout(res, 400, 'Vul je voornaam in.');
  if (!telefoon) return fout(res, 400, 'Vul een geldig telefoonnummer in, bijvoorbeeld 06 12 34 56 78.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fout(res, 400, 'Vul een geldig e-mailadres in.');
  if (mbo !== true && mbo !== false) return fout(res, 400, 'Geef aan of je een mbo-diploma elektrotechniek hebt.');

  const eerder = q.inzendingVoorIp.get(ip_hash);

  if (eerder) {
    return res.json({
      opgeslagen: false,
      reden: 'reeds_ingezonden',
      bericht:
        'Vanaf dit netwerk is al eerder meegedaan. Je gegevens zijn niet opnieuw opgeslagen.',
      vacatureUrl: VACATURE_URL,
      redirectSeconden: REDIRECT_SECONDEN,
      /* Geen eigen positie of tijd: die horen bij de eerdere inzending, en dat
         is op een gedeeld netwerk iemand anders. Alleen het publieke bord. */
      ...bordPayload(null),
    });
  }

  let nieuwId;
  try {
    nieuwId = q.bewaarInzending.run({
      sessie_id: s.id,
      ip_hash,
      voornaam,
      telefoon,
      email,
      mbo_diploma: mbo ? 1 : 0,
      totaal_ms: s.totaal_ms,
      fouten: JSON.parse(s.resultaten).reduce((a, r) => a + (r.foutePogingen || 0), 0),
      aangemaakt: Date.now(),
      toestemming_op: Date.now(),
      toestemming_versie: PRIVACY_VERSIE,
      /* De teksten komen uit TOESTEMMING, niet uit het verzoek: anders bepaalt
         de kandidaat zelf waarmee hij akkoord ging. Geen talentpool betekent
         geen talentpooltekst, zodat een lege kolom ook echt "niet gegeven" zegt. */
      toestemming_tekst: TOESTEMMING.akkoord,
      toestemming_bron: TOESTEMMING.bron,
      talentpool: talentpool ? 1 : 0,
      talentpool_tekst: talentpool ? TOESTEMMING.talentpool : null,
    }).lastInsertRowid;
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.json({
        opgeslagen: false,
        reden: 'reeds_ingezonden',
        vacatureUrl: VACATURE_URL,
        redirectSeconden: REDIRECT_SECONDEN,
        ...bordPayload(null),
      });
    }
    throw e;
  }

  res.json({
    opgeslagen: true,
    vacatureUrl: VACATURE_URL,
    redirectSeconden: REDIRECT_SECONDEN,
    ...bordPayload(nieuwId),
  });
});

/* ============================================================
   GET /api/leaderboard
   ============================================================ */
app.get('/api/leaderboard', (req, res) => res.json(bordPayload(null)));

function bordPayload(eigenId) {
  const top = q.top.all(10).map((r, i) => ({
    positie: i + 1,
    voornaam: r.voornaam,
    tijdMs: r.totaal_ms,
    fouten: r.fouten,
    ikzelf: eigenId != null && r.id === eigenId,
  }));
  let eigenPositie = null;
  let eigenTijdMs = null;
  if (eigenId != null) {
    const rij = q.inzending.get(eigenId);
    if (rij) {
      eigenPositie = q.positie.get({
        totaal_ms: rij.totaal_ms,
        fouten: rij.fouten,
        aangemaakt: rij.aangemaakt,
      }).positie;
      eigenTijdMs = rij.totaal_ms;
    }
  }
  return {
    leaderboard: top,
    totaalDeelnemers: q.aantalInzendingen.get().n,
    eigenPositie,
    eigenTijdMs,
  };
}

/* ============================================================
   Admin: statistiek en reset
   ============================================================ */
/* Het admin-token is onbeperkt te raden zolang er niets tegenover staat, en
   /api/admin/reset wist alle inzendingen. Eén begrenzer voor alle admin-routes,
   zodat een nieuwe route hem niet per ongeluk kan overslaan. */
app.use('/api/admin', (req, res, next) => {
  if (!begrens(`admin:${ipHashVan(req)}`, 10, 60_000)) {
    return fout(res, 429, 'Te veel pogingen. Probeer het over een minuut opnieuw.');
  }
  next();
});

// Beide kanten eerst hashen: dan zijn de buffers altijd even lang, lekt de
// lengte van het token niet, en gooit timingSafeEqual niet op multibyte invoer.
const tokenHash = (s) => crypto.createHash('sha256').update(String(s)).digest();
const ADMIN_HASH = tokenHash(ADMIN_TOKEN);

function adminOk(req) {
  return crypto.timingSafeEqual(tokenHash(req.get('x-admin-token') || ''), ADMIN_HASH);
}

app.get('/api/admin/statistiek', (req, res) => {
  if (!adminOk(req)) return fout(res, 401, 'Ongeldig admin-token.');
  res.json(statistiek(levels().length));
});

app.post('/api/admin/reset', (req, res) => {
  if (!adminOk(req)) return fout(res, 401, 'Ongeldig admin-token.');
  const wat = ['inzendingen', 'sessies', 'alles'].includes(req.body?.wat) ? req.body.wat : 'alles';
  res.json({ gereset: wat, resterend: resetDb(wat) });
});

app.get('/api/gezond', (req, res) =>
  res.json({ ok: true, levels: levels().map((l) => l.nummer) }),
);

/* ============================================================
   Foutafhandeling: laatste middleware, na alle routes.
   ============================================================ */
app.use((err, req, res, next) => {
  console.error('[fout]', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ fout: 'Er ging iets mis op de server.' });
});

/* ------------ periodieke opruiming ------------
   Sessies zijn voortgangstracking. Inzendingen bevatten persoonsgegevens en
   vallen onder de AVG-bewaartermijn: weg als de termijn verstreken is. Let op:
   daarmee verdwijnt die deelnemer ook van de ranglijst, en vervalt de
   IP-blokkade, want die zit in dezelfde tabel. */
function ruimOp() {
  const nu = Date.now();
  const sessies = q.verwijderOudeSessies.run(nu - SESSIE_BEWAARDAGEN * 86_400_000).changes;
  if (sessies) console.log(`[opruiming] ${sessies} oude sessies verwijderd`);

  const inzendingen = q.verwijderOudeInzendingen.run({
    kort: nu - INZENDING_BEWAARDAGEN * 86_400_000,
    lang: nu - TALENTPOOL_BEWAARDAGEN * 86_400_000,
  }).changes;
  if (inzendingen) console.log(`[opruiming] ${inzendingen} verlopen inzendingen verwijderd`);
}
ruimOp();
setInterval(ruimOp, 6 * 60 * 60 * 1000).unref();

app.listen(PORT, () => {
  console.log(`Aqua+ Challenge draait op http://localhost:${PORT}`);
  console.log(`Levels: ${levels().length} | redirect na afloop naar: ${VACATURE_URL}`);
});
