# De Aqua+ Challenge

Werving-game voor de vacature elektromonteur. De kandidaat speelt vier
technische levels op tijd, vult daarna een kort contactformulier in, ziet de
ranglijst en wordt automatisch doorgestuurd naar het vacatureoverzicht.

De score is de **tijd**: hoe sneller je alle vier de levels haalt, hoe hoger je
op de ranglijst staat. De server houdt daarnaast bij hoe ver iedere kandidaat
komt, zodat je kunt zien waar mensen afhaken.

---

## Snel starten

```bash
npm install
cp .env.example .env      # vul IP_SALT, ADMIN_TOKEN en VACATURE_URL in
npm start                 # http://localhost:3000
```

Node 20 of nieuwer. `better-sqlite3` compileert bij het installeren, dus op een
schone server heb je build-tools nodig (`apt install build-essential python3`).

---

## De acht stappen

| Stap | Scherm | Wat er gebeurt |
| --- | --- | --- |
| 1 | Start | Korte uitleg, knop Start. |
| 2 | Introductie | "Welkom", de drie geruststellingen, knop *Speel level 1*. |
| 3 | Level 1 tot 4 | Elk level heeft een eigen klok. Fout mag je opnieuw proberen; dat kost tijd. |
| 4 | Resultaat | Totale tijd plus de tijd per level. |
| 5 | Formulier | Voornaam, telefoonnummer, e-mailadres, mbo-diploma ja of nee. |
| 6 | Bedankt | Bevestiging, eigen tijd en positie. |
| 7 | Aftellen | Vijf seconden, met een link om direct te gaan en een knop om te blijven. |
| 8 | Redirect | Automatisch naar `VACATURE_URL`. |

**Stap 6 en 7 zijn samengevoegd tot één scherm.** In de opzet stonden ze los,
maar dan heeft de kandidaat vijf seconden voor twee schermen en leest niemand de
ranglijst. Nu staat de ranglijst op het bedankscherm met de aftelklok eronder.
Wil je ze toch splitsen, dan is dat een kleine wijziging in `public/index.html`.

Vijf seconden is kort voor een top 10. Zet `REDIRECT_SECONDEN` in `.env` hoger
(10 of 15) als je wilt dat mensen de lijst echt lezen. De knop *Blijf hier*
stopt het aftellen, zodat niemand weggeklikt wordt terwijl hij aan het kijken is.

---

## De vier levels

Staan in `src/spellen.js`. Twee soorten:

- `type: 'keuze'` meerkeuzevraag met vier opties (level 1 en 2)
- `type: 'klik'` klikken op een onderdeel in de tekening (level 3 en 4)

| Level | Titel | Klok | Juist antwoord |
| --- | --- | --- | --- |
| 1 | Het circuit compleet maken | 45s | A, draad tussen voeding en lamp |
| 2 | Welke component hoort hierbij? | 45s | A, relais |
| 3 | De schakelkast challenge | 60s | automaat |
| 4 | Storing zoeken | 90s | draad tussen relais en motor |

De kloktijden zijn een aanname van mij, ze stonden niet in de opzet. Pas
`maxSeconden` per level aan naar wat jullie redelijk vinden. Loopt de klok af,
dan wordt de volle leveltijd gerekend en gaat de kandidaat door naar het
volgende level; niemand loopt vast.

De vraagstelling, de antwoordopties en de juiste antwoorden komen uit de
aangeleverde uitwerking. **Ik heb ze niet inhoudelijk getoetst.** Laat een
monteur of engineer ze nakijken, met name level 2: of een relais daar het
antwoord is dat jullie willen horen, of dat een veiligheidsrelais of
eindschakelaar meer op zijn plaats is, kan ik niet beoordelen.

De tekeningen zijn zelfgemaakte SVG-schetsen in `public/app.js`. Bewust
schematisch: geen normtekeningen. Als je echte symbolen volgens
NEN-EN-IEC 60617 wilt, laat die dan aanleveren door engineering.

---

## Score en tracking

Per level slaat de server op: de tijd, of het gehaald is en het aantal foute
pogingen. Per sessie: hoe ver iemand kwam (`hoogste_level`), de totaaltijd en of
de challenge is afgerond.

```bash
npm run stats
```

```
Sessies gestart:      2
Aan level 1 begonnen: 2
Alle levels afgerond: 1
Formulier ingevuld:   1

Level  bereikt  gehaald  afgehaakt  gem. tijd  foute pogingen
  1         2        2          0        1.2s               1
  2         2        1          1        0.9s               0
```

Zelfde gegevens via `GET /api/admin/statistiek` met de header `x-admin-token`.

De tijd wordt volledig op de server gemeten, vanaf het moment dat de vraag
uitgeleverd wordt. Het juiste antwoord staat niet in de paginabron. Een refresh
zet de klok niet terug. De ranglijst is dus niet te manipuleren met devtools.

---

## API

| Methode | Pad | Wat het doet |
| --- | --- | --- |
| `GET` | `/api/config` | Aantal levels, vacature-URL, aantal aftelseconden. |
| `POST` | `/api/sessie` | Start een sessie. Geeft `sessieId`, `aantalLevels`, `alIngezonden`. |
| `GET` | `/api/sessie/:id/level` | Huidig level zonder antwoord, start de klok. |
| `POST` | `/api/sessie/:id/antwoord` | Body `{ keuze }`. Fout antwoord geeft `opnieuw: true`. |
| `POST` | `/api/sessie/:id/inzending` | Body `{ voornaam, telefoon, email, mboDiploma }`. |
| `GET` | `/api/leaderboard` | Tien snelste tijden. |
| `GET` | `/api/admin/statistiek` | Afhaakmomenten per level. Header `x-admin-token`. |
| `POST` | `/api/admin/reset` | Body `{ wat: "inzendingen" \| "sessies" \| "alles" }`. |
| `GET` | `/api/gezond` | Statuscheck. |

---

## Handmatige reset

```bash
npm run reset                # wist inzendingen en sessies
npm run reset inzendingen    # wist de inzendingen, en dus de IP-blokkades
npm run reset sessies        # wist alleen de voortgangstracking
```

```bash
curl -X POST http://localhost:3000/api/admin/reset \
  -H "x-admin-token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" -d '{"wat":"alles"}'
```

---

## Eén inzending per IP

Spelen mag altijd en zo vaak als je wil. Het contactformulier kan per netwerk
één keer verstuurd worden. Dat voorkomt dubbele leads zonder dat de tweede
monteur op hetzelfde kantoornetwerk buitengesloten wordt.

Waterdicht is het niet: wie echt wil, gebruikt een ander netwerk of een VPN.
Voor een wervingscampagne is dat meestal geen probleem, maar reken er niet op
als er een prijs aan hangt.

---

## AVG-punten om te laten checken

Aandachtspunten, geen juridisch advies. Leg ze voor aan wie bij Aqua+ over
privacy gaat.

- **IP-adressen staan niet onversleuteld in de database.** Alleen een SHA-256-hash
  met een geheim zout uit `.env` (`IP_SALT`). Verander je het zout, dan vervallen
  alle blokkades.
- **Een IP-adres is een persoonsgegeven.** Een gehasht IP geldt als
  pseudonimisering, niet als anonimisering. Benoem het in de privacyverklaring.
- **Op de ranglijst staan alleen voornaam en tijd.** Telefoonnummer en e-mailadres
  staan in de database voor het terugbelmoment en komen niet op de pagina.
  Woonplaats is uit het formulier gehaald, die stond niet in de nieuwe opzet.
- **Zonder vinkje slaat de server niets op.** De toestemmingstekst noemt expliciet
  wat er op de ranglijst komt.
- **Bewaartermijn leads: 12 maanden.** Contactgegevens in `inzendingen` worden na
  12 maanden verwijderd. Deze opruimtaak is nog niet in code ingebouwd (alleen de
  beslissing staat vast); dat is een kleine toevoeging, zelfde patroon als de
  sessie-opruiming hieronder.
- **Sessies (voortgangstracking) worden na 30 dagen automatisch opgeruimd**
  (`SESSIE_BEWAARDAGEN` in `.env`). Dit bevat geen contactgegevens, alleen
  spelvoortgang, en houdt de tabel klein.
- **De link `/privacyverklaring`** is een placeholder.

---

## Nog te doen voordat dit live gaat

1. **`VACATURE_URL` invullen** met de echte URL van het vacatureoverzicht,
   gefilterd op elektrotechniek. Nu staat er een tijdelijke testpagina
   (`public/vacatures.html`); die kan weg zodra de echte URL erin staat.
2. **Inhoud laten nakijken** door een monteur of engineer: vragen, antwoorden,
   de tekeningen en de kloktijden.
3. **Lettertype.** De pagina gebruikt standaard Calibri (systeemfont, geen
   licentie nodig). Het merkfont Pill Gothic 600mg is bewust niet meegeleverd:
   het is betaald en de licentie spreekt over intern Aqua+-gebruik. Wil je het
   merkfont tóch gebruiken, laat dan eerst controleren of publicatie als webfont
   onder de licentie valt; daarna zet je de `.ttf`'s in `public/fonts/`, herstel
   je de `@font-face`-regels in `public/aqua-tokens.css` en zet je
   `"Pill Gothic 600mg"` vooraan in `--font-brand`.
4. **`TRUST_PROXY=1`** zetten als de app achter nginx, Traefik of Cloudflare staat.
   Anders krijgt iedereen het IP van de proxy en blokkeert de eerste inzending
   alle volgende.
5. **`IP_SALT` en `ADMIN_TOKEN`** vullen met lange willekeurige waarden.
6. **Privacyverklaring-URL** invullen.
7. **Back-up van `data/challenge.db`** regelen; daar zitten de leads in.
   Dagelijkse kopie naar een andere locatie is ruim genoeg (laag schrijfvolume,
   maar de leads zijn onvervangbaar). Bewaar circa 30 dagen aan dagelijkse back-ups.
8. **Waar gaan de leads naartoe?** Nu staan ze alleen in de database. Wil je een
   mail naar recruitment of een koppeling met jullie ATS, dan is dat een aparte
   stap.

---

## Twee afwijkingen van de huisstijl

Het design system schrijft een statische stijl voor: geen decoratieve animaties.
De opzet vraagt om een bewegende elektrische lijn en een laadanimatie. Ik heb dat
teruggebracht tot twee rustige elementen: de aftelbalk op het laatste scherm en
de kloklijn per level. Beide staan uit als de bezoeker in zijn systeem
"minder beweging" heeft aangezet.

De opzet gebruikt de emoji ✅ en ❌. Het design system schrijft de tekens ✓ en ✕
voor en geen emoji. Ik heb ✓ en ✕ aangehouden.
