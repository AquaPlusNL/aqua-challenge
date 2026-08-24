/* ============================================================
   Aqua+ Challenge, de vier levels.

   Dit bestand blijft op de SERVER. Het juiste antwoord en de
   uitleg gaan pas naar de browser nadat er geantwoord is.

   Twee soorten levels:
     type: 'keuze'  meerkeuzevraag met vier opties
     type: 'klik'   klikken op een onderdeel in de tekening

   Elk level heeft een eigen klok (`maxSeconden`). De score is de
   TIJD: hoe sneller je alle vier de levels haalt, hoe hoger je
   op de ranglijst staat. Loopt de klok af, dan wordt de volle
   leveltijd gerekend en ga je door naar het volgende level.

   Fout antwoord mag je opnieuw proberen. Dat kost tijd, en dat
   is meteen de straf; er zijn geen strafpunten.

   LET OP: de vraagstelling en de juiste antwoorden komen uit de
   aangeleverde uitwerking en zijn niet door mij inhoudelijk
   getoetst. Laat een monteur of engineer ze nakijken.
   ============================================================ */

export const levels = [
  /* ---------------- Level 1 ---------------- */
  {
    id: 'circuit-compleet',
    nummer: 1,
    actief: true,
    type: 'keuze',
    maxSeconden: 45,
    titel: 'Het circuit compleet maken',
    situatie: null,
    vraag: 'Welke verbinding ontbreekt om de lamp te laten branden?',
    tekening: 'circuit-onvolledig',
    opties: [
      { id: 'draad', letter: 'A', label: 'Draad tussen voeding en lamp' },
      { id: 'lamp', letter: 'B', label: 'Extra lamp' },
      { id: 'voeding', letter: 'C', label: 'Nieuwe voeding' },
      { id: 'aardpen', letter: 'D', label: 'Aardpen' },
    ],
    juist: 'draad',
    uitlegGoed: 'Een monteur ziet direct wanneer een schakeling niet compleet is.',
    uitlegFout: 'Nog niet. Kijk waar de stroom niet verder kan.',
    motivatie: null,
    volgendeKnop: 'Naar level 2',
  },

  /* ---------------- Level 2 ---------------- */
  {
    id: 'welke-component',
    nummer: 2,
    actief: true,
    type: 'keuze',
    maxSeconden: 45,
    titel: 'Welke component hoort hierbij?',
    situatie:
      'Een motor moet automatisch uitschakelen wanneer een beveiligingshek wordt geopend.',
    vraag: 'Welke component heb je hiervoor nodig?',
    tekening: 'hek-motor',
    opties: [
      { id: 'relais', letter: 'A', label: 'Relais' },
      { id: 'kabelgoot', letter: 'B', label: 'Kabelgoot' },
      { id: 'lasdoos', letter: 'C', label: 'Lasdoos' },
      { id: 'transformator', letter: 'D', label: 'Transformator' },
    ],
    juist: 'relais',
    uitlegGoed:
      'Juist. Een relais wordt vaak gebruikt om een schakeling te sturen of te onderbreken.',
    uitlegFout: 'Nog niet. Zoek het onderdeel dat een schakeling kan onderbreken.',
    motivatie: 'Je technische kennis brengt je verder dan gemiddeld.',
    volgendeKnop: 'Naar level 3',
  },

  /* ---------------- Level 3 ---------------- */
  {
    id: 'schakelkast',
    nummer: 3,
    actief: true,
    type: 'klik',
    maxSeconden: 60,
    titel: 'De schakelkast challenge',
    situatie: 'De installatie werkt niet.',
    vraag: 'Welke component controleer je als eerste? Klik het aan in de kast.',
    tekening: 'schakelkast',
    opties: [
      { id: 'automaat', label: 'automaat' },
      { id: 'relais', label: 'relais' },
      { id: 'motor', label: 'motor' },
      { id: 'voeding', label: 'voeding' },
    ],
    juist: 'automaat',
    uitlegGoed: 'Goede keuze. Controleer altijd eerst of de installatie spanning heeft.',
    uitlegFout: 'Nog niet. Begin bij de basis: heeft de installatie wel spanning?',
    motivatie: 'Jij denkt als een monteur die eerst de basis uitsluit voordat hij verder zoekt.',
    volgendeKnop: 'Naar de finale challenge',
  },

  /* ---------------- Level 4 ---------------- */
  {
    id: 'storing-zoeken',
    nummer: 4,
    actief: true,
    type: 'klik',
    maxSeconden: 90,
    titel: 'Storing zoeken',
    situatie: 'De installatie krijgt spanning, maar de motor draait niet.',
    vraag: 'Waar zit de storing? Klik de plek aan in de tekening.',
    tekening: 'storing',
    opties: [
      { id: 'voeding', label: 'voeding' },
      { id: 'automaat', label: 'zekeringsautomaat' },
      { id: 'relais', label: 'relais' },
      { id: 'draad-relais-motor', label: 'draad tussen relais en motor' },
      { id: 'motor', label: 'motor' },
    ],
    juist: 'draad-relais-motor',
    uitlegGoed: 'Storing gevonden. De draad tussen relais en motor zit los.',
    uitlegFout: 'Niet correct. Probeer nog eens.',
    motivatie: null,
    volgendeKnop: 'Bekijk je resultaat',
  },
];

export const actieveLevels = () => levels.filter((l) => l.actief);

/* Wat de browser mag zien: geen juist antwoord, geen uitleg. */
export const levelPubliek = (level) => ({
  id: level.id,
  nummer: level.nummer,
  type: level.type,
  maxSeconden: level.maxSeconden,
  titel: level.titel,
  situatie: level.situatie,
  vraag: level.vraag,
  tekening: level.tekening,
  opties: level.opties,
  volgendeKnop: level.volgendeKnop,
});

/* Marge voor netwerkvertraging bij het narekenen van de klok. */
export const GRACE_MS = 1500;
