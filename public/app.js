/* ============================================================
   Aqua+ Challenge, browserlogica.

   De browser weet de juiste antwoorden niet: die blijven op de
   server. De klok hier is weergave; de server meet zelf de tijd
   en die tijd is de score.
   ============================================================ */
import { normaliseerTelefoon } from './telefoon.js';

(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const SCHERMEN = ['laden', 'start', 'intro', 'level', 'resultaat', 'formulier', 'bedank'];
  const toon = (naam) => {
    SCHERMEN.forEach((s) => $(`scherm-${s}`).classList.toggle('verborgen', s !== naam));
    /* Alleen het levelscherm heeft een klok. Op elk ander scherm staat de waaier
       stil in de beginstand, met de plus recht. */
    if (naam !== 'level') $('sunStralen').style.transform = '';
  };

  const INK = '#26323D';
  const GRIJS = '#59626B';
  const BLAUW = '#0064AF';

  const staat = {
    sessieId: null,
    aantalLevels: 4,
    level: null,
    keuze: null,
    klokId: null,
    eindeOp: 0,
    totaleMs: 0,
    bezig: false,
    mbo: null,
    gedaan: [],
    aftelId: null,
  };

  const tijd = (ms) => {
    const s = Math.round(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  /* ============================================================
     Tekeningen. Groepen met class "hotspot" zijn aanklikbaar in
     levels van het type 'klik'.
     ============================================================ */
  const blok = (id, x, y, w, h, label) => `
    <g class="hotspot" data-klik="${id}" tabindex="0" role="button" aria-label="${label}">
      <rect class="vlak" x="${x}" y="${y}" width="${w}" height="${h}" rx="4"
            fill="#fff" stroke="${INK}" stroke-width="2"/>
      <text class="naam" x="${x + w / 2}" y="${y + h / 2 + 4}" font-size="14"
            text-anchor="middle" fill="${GRIJS}">${label}</text>
    </g>`;

  const tekeningen = {
    /* ---------- Level 1: circuit niet compleet ---------- */
    'circuit-onvolledig': `
      <svg viewBox="0 0 460 180" role="img"
           aria-label="Stroomkring met voeding, schakelaar en lamp, waarbij een verbinding ontbreekt">
        <rect x="24" y="56" width="70" height="48" rx="4" fill="#fff" stroke="${INK}" stroke-width="2.5"/>
        <text x="59" y="85" font-size="14" text-anchor="middle" fill="${GRIJS}">voeding</text>

        <line x1="94" y1="66" x2="180" y2="66" stroke="${INK}" stroke-width="2.5"/>
        <line x1="180" y1="66" x2="258" y2="66" stroke="${BLAUW}" stroke-width="2.5" stroke-dasharray="6 5"/>
        <line x1="196" y1="52" x2="242" y2="80" stroke="${BLAUW}" stroke-width="2.5"/>
        <line x1="242" y1="52" x2="196" y2="80" stroke="${BLAUW}" stroke-width="2.5"/>
        <text x="219" y="40" font-size="14" text-anchor="middle" fill="${BLAUW}">hier klopt iets niet</text>
        <line x1="258" y1="66" x2="356" y2="66" stroke="${INK}" stroke-width="2.5"/>

        <circle cx="356" cy="94" r="20" fill="#fff" stroke="${INK}" stroke-width="2.5"/>
        <line x1="342" y1="80" x2="370" y2="108" stroke="${INK}" stroke-width="1.6"/>
        <line x1="370" y1="80" x2="342" y2="108" stroke="${INK}" stroke-width="1.6"/>
        <line x1="356" y1="66" x2="356" y2="74" stroke="${INK}" stroke-width="2.5"/>
        <text x="384" y="98" font-size="14" text-anchor="start" fill="${GRIJS}">lamp</text>

        <line x1="356" y1="114" x2="356" y2="152" stroke="${INK}" stroke-width="2.5"/>
        <line x1="356" y1="152" x2="230" y2="152" stroke="${INK}" stroke-width="2.5"/>
        <circle cx="230" cy="152" r="3" fill="${INK}"/>
        <line x1="230" y1="152" x2="200" y2="152" stroke="${INK}" stroke-width="2.5"/>
        <circle cx="200" cy="152" r="3" fill="${INK}"/>
        <line x1="200" y1="152" x2="59" y2="152" stroke="${INK}" stroke-width="2.5"/>
        <line x1="59" y1="152" x2="59" y2="104" stroke="${INK}" stroke-width="2.5"/>
        <text x="215" y="172" font-size="14" text-anchor="middle" fill="${GRIJS}">schakelaar</text>
      </svg>`,

    /* ---------- Level 2: hek en motor ---------- */
    'hek-motor': `
      <svg viewBox="0 0 460 160" role="img"
           aria-label="Een toegangshek en een motor, met daarachter een onbekend onderdeel">
        <rect x="24" y="42" width="96" height="76" rx="4" fill="#fff" stroke="${INK}" stroke-width="2.5"/>
        <line x1="40" y1="42" x2="40" y2="118" stroke="${INK}" stroke-width="1.6"/>
        <line x1="60" y1="42" x2="60" y2="118" stroke="${INK}" stroke-width="1.6"/>
        <line x1="80" y1="42" x2="80" y2="118" stroke="${INK}" stroke-width="1.6"/>
        <line x1="100" y1="42" x2="100" y2="118" stroke="${INK}" stroke-width="1.6"/>
        <text x="72" y="138" font-size="14" text-anchor="middle" fill="${GRIJS}">toegangshek</text>

        <line x1="120" y1="80" x2="196" y2="80" stroke="${INK}" stroke-width="2.5"/>
        <circle cx="226" cy="80" r="30" fill="#fff" stroke="${INK}" stroke-width="2.5"/>
        <text x="226" y="86" font-size="16" text-anchor="middle" fill="${INK}">M</text>
        <text x="226" y="138" font-size="14" text-anchor="middle" fill="${GRIJS}">motor</text>
        <line x1="256" y1="80" x2="330" y2="80" stroke="${INK}" stroke-width="2.5"/>

        <rect x="330" y="60" width="96" height="40" rx="4" fill="#fff" stroke="${BLAUW}"
              stroke-width="2.5" stroke-dasharray="6 5"/>
        <text x="378" y="85" font-size="16" text-anchor="middle" fill="${BLAUW}">?</text>
      </svg>`,

    /* ---------- Level 3: schakelkast ---------- */
    schakelkast: `
      <svg viewBox="0 0 460 160" role="img" aria-label="Vereenvoudigde schakelkast met vier onderdelen">
        <rect x="14" y="14" width="432" height="132" rx="6" fill="none" stroke="${INK}"
              stroke-width="2" stroke-dasharray="4 4"/>
        <text x="24" y="34" font-size="14" fill="${GRIJS}" letter-spacing="1.5">SCHAKELKAST</text>
        <line x1="40" y1="96" x2="420" y2="96" stroke="${INK}" stroke-width="2"/>
        ${blok('voeding', 34, 66, 84, 60, 'voeding')}
        ${blok('automaat', 138, 66, 84, 60, 'automaat')}
        ${blok('relais', 242, 66, 84, 60, 'relais')}
        ${blok('motor', 346, 66, 84, 60, 'motor')}
      </svg>`,

    /* ---------- Level 4: storing zoeken ---------- */
    storing: `
      <svg viewBox="0 0 460 176" role="img"
           aria-label="Installatie met voeding, zekeringsautomaat, relais en motor, met een losgeraakte draad">
        <line x1="70" y1="70" x2="390" y2="70" stroke="${INK}" stroke-width="2.5"/>
        ${blok('voeding', 24, 40, 78, 60, 'voeding')}
        ${blok('automaat', 122, 40, 92, 60, 'automaat')}
        ${blok('relais', 234, 40, 78, 60, 'relais')}

        <g class="hotspot" data-klik="draad-relais-motor" tabindex="0" role="button"
           aria-label="draad tussen relais en motor">
          <rect class="raak" x="306" y="36" width="86" height="68"/>
          <rect class="vlak" x="310" y="40" width="78" height="60" rx="4" fill="none" stroke="none"/>
          <line x1="312" y1="70" x2="334" y2="70" stroke="${INK}" stroke-width="2.5"/>
          <line x1="334" y1="70" x2="352" y2="46" stroke="${INK}" stroke-width="2.5"/>
          <circle cx="353" cy="45" r="4" fill="${INK}"/>
          <circle cx="368" cy="70" r="4" fill="#fff" stroke="${INK}" stroke-width="2.5"/>
          <line x1="372" y1="70" x2="386" y2="70" stroke="${INK}" stroke-width="2.5"/>
          <text class="naam" x="350" y="116" font-size="14" text-anchor="middle" fill="${GRIJS}">draad</text>
        </g>

        <line x1="386" y1="70" x2="410" y2="70" stroke="${INK}" stroke-width="2.5"/>
        <line x1="410" y1="70" x2="410" y2="116" stroke="${INK}" stroke-width="2.5"/>
        ${blok('motor', 372, 116, 76, 56, 'motor')}
      </svg>`,
  };

  /* ============================================================
     API
     ============================================================ */
  async function api(pad, opties = {}) {
    const res = await fetch(pad, {
      headers: { 'Content-Type': 'application/json' },
      ...opties,
      body: opties.body ? JSON.stringify(opties.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.fout || 'Er ging iets mis. Probeer het opnieuw.');
    return data;
  }

  /* ============================================================
     Klok per level
     ============================================================ */
  function startKlok(resterendeMs, totaleMs) {
    stopKlok();
    staat.eindeOp = Date.now() + resterendeMs;
    staat.totaleMs = totaleMs;
    tikKlok();
    staat.klokId = setInterval(tikKlok, 100);
  }
  function stopKlok() {
    if (staat.klokId) clearInterval(staat.klokId);
    staat.klokId = null;
    /* Waaier terug in de beginstand, anders staat de plus schuin op de volgende schermen. */
    $('sunStralen').style.transform = '';
  }
  function tikKlok() {
    const over = Math.max(0, staat.eindeOp - Date.now());
    const deel = staat.totaleMs ? over / staat.totaleMs : 0;
    $('klokTekst').textContent = `${Math.ceil(over / 1000)}s`;
    $('klokvulling').style.transform = `scaleX(${deel})`;
    /* Waaier in de kop draait één rondje per level, als extra tijdindicatie. */
    if (staat.klokId && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      $('sunStralen').style.transform = `rotate(${(1 - deel) * 360}deg)`;
    }
    const niveau = over <= 5000 ? 'kritiek' : over <= 12000 ? 'laag' : '';
    $('klok').className = `klok ${niveau}`.trim();
    $('klokbalk').className = `klokbalk ${niveau}`.trim();
    if (over <= 0) {
      stopKlok();
      antwoord(null);
    }
  }

  /* ============================================================
     Level tekenen
     ============================================================ */
  function zetKnop(tekst, actie, uit = false) {
    const b = $('checkKnop');
    b.textContent = tekst;
    b.disabled = uit;
    b.onclick = actie;
  }

  function tekenStappen(huidigNummer) {
    $('stappen').innerHTML = Array.from({ length: staat.aantalLevels }, (_, i) => {
      const n = i + 1;
      const r = staat.gedaan.find((x) => x.nummer === n);
      const cls = r ? (r.gehaald ? 'gedaan' : 'gemist') : n === huidigNummer ? 'nu' : '';
      return `<i class="${cls}"></i>`;
    }).join('');
  }

  function tekenLevel(payload) {
    const lv = payload.level;
    staat.level = lv;
    staat.keuze = null;
    staat.aantalLevels = payload.aantalLevels;

    $('stap').textContent = `Level ${lv.nummer} van ${payload.aantalLevels}`;
    $('levelTitel').textContent = lv.titel;
    $('levelSituatie').textContent = lv.situatie || '';
    $('levelSituatie').classList.toggle('verborgen', !lv.situatie);
    $('levelVraag').textContent = lv.vraag;
    $('tekening').className = 'tekening';
    $('tekening').innerHTML = tekeningen[lv.tekening] || '';
    $('feedback').classList.add('verborgen');
    $('tussenstand').textContent = staat.gedaan.length
      ? `Tijd tot nu toe: ${tijd(staat.gedaan.reduce((a, r) => a + r.tijdMs, 0))}`
      : '';
    tekenStappen(lv.nummer);

    if (lv.type === 'keuze') {
      $('opties').className = 'opties letters';
      $('opties').innerHTML = lv.opties
        .map(
          (o) => `<button type="button" class="optie" data-id="${o.id}">
                    <span class="letter">${o.letter || ''}</span><span>${o.label}</span>
                  </button>`,
        )
        .join('');
      zetKnop('Controleer', () => antwoord(staat.keuze), true);
      $('checkKnop').classList.remove('verborgen');
    } else {
      // Klik-level: je klikt direct in de tekening, geen aparte knop.
      $('opties').className = 'opties verborgen';
      $('opties').innerHTML = '';
      $('checkKnop').classList.add('verborgen');
    }

    toon('level');
    startKlok(payload.resterendeMs, lv.maxSeconden * 1000);
  }

  /* Meerkeuze aanklikken */
  $('opties').addEventListener('click', (e) => {
    const el = e.target.closest('.optie');
    if (!el || el.disabled) return;
    document.querySelectorAll('.optie').forEach((o) => o.classList.remove('gekozen'));
    el.classList.add('gekozen');
    staat.keuze = el.dataset.id;
    $('checkKnop').disabled = false;
  });

  /* Klikken in de tekening */
  function hotspotActie(e) {
    const g = e.target.closest('.hotspot');
    if (!g || staat.level?.type !== 'klik' || staat.bezig) return;
    antwoord(g.dataset.klik, g);
  }
  $('tekening').addEventListener('click', hotspotActie);
  $('tekening').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      hotspotActie(e);
    }
  });

  /* ============================================================
     Antwoord versturen
     ============================================================ */
  async function antwoord(keuze, hotspotEl) {
    if (staat.bezig) return;
    staat.bezig = true;
    $('checkKnop').disabled = true;

    let r;
    try {
      r = await api(`/api/sessie/${staat.sessieId}/antwoord`, { method: 'POST', body: { keuze } });
    } catch (err) {
      staat.bezig = false;
      meldFout($('feedback'), err.message);
      return;
    }

    /* Fout, maar de klok loopt nog: opnieuw proberen. */
    if (r.opnieuw) {
      staat.bezig = false;
      const fb = $('feedback');
      fb.className = 'callout fout';
      fb.innerHTML = `<span class="teken">&#10007;</span>${r.uitleg}`;
      if (hotspotEl) {
        hotspotEl.classList.add('onjuist');
        setTimeout(() => hotspotEl.classList.remove('onjuist'), 900);
      } else {
        const el = document.querySelector(`.optie[data-id="${keuze}"]`);
        if (el) {
          el.classList.add('onjuist');
          setTimeout(() => el.classList.remove('onjuist', 'gekozen'), 900);
        }
        staat.keuze = null;
      }
      return;
    }

    /* Level afgesloten. */
    stopKlok();
    staat.gedaan.push({
      nummer: staat.level.nummer,
      gehaald: r.goed,
      tijdMs: r.levelTijdMs,
      fouten: r.foutePogingen || 0,
    });
    tekenStappen(staat.level.nummer);

    document.querySelectorAll('.optie').forEach((o) => {
      o.disabled = true;
      if (o.dataset.id === r.juisteOptie) o.classList.add('juist');
      else if (o.dataset.id === keuze) o.classList.add('onjuist');
    });
    $('tekening').classList.add('vast');
    document.querySelectorAll('.hotspot').forEach((g) => {
      if (g.dataset.klik === r.juisteOptie) g.classList.add('juist');
      else if (g.dataset.klik === keuze) g.classList.add('onjuist');
    });

    const fb = $('feedback');
    fb.className = `callout ${r.goed ? 'goed' : 'let-op'}`;
    fb.innerHTML =
      `<span class="teken">${r.goed ? '&#10003;' : '&#10007;'}</span>` +
      `${r.tijdOm ? 'Tijd om. ' : ''}${r.uitleg}` +
      (r.motivatie && r.goed ? `<br><br>${r.motivatie}` : '') +
      `<br><strong>${tijd(r.levelTijdMs)}</strong> voor dit level.`;
    fb.classList.remove('verborgen');

    $('tussenstand').textContent = `Tijd tot nu toe: ${tijd(r.tussenstandMs)}`;
    staat.bezig = false;

    $('checkKnop').classList.remove('verborgen');
    if (r.klaar) zetKnop(r.volgendeKnop || 'Bekijk je resultaat', () => naarResultaat(r));
    else zetKnop(r.volgendeKnop || 'Volgende level', volgendLevel);
  }

  async function volgendLevel() {
    zetKnop('Even laden', null, true);
    const payload = await api(`/api/sessie/${staat.sessieId}/level`);
    if (payload.klaar) return naarResultaat({ totaalMs: payload.totaalMs });
    tekenLevel(payload);
  }

  /* ============================================================
     Resultaat
     ============================================================ */
  function naarResultaat(r) {
    const alles = staat.gedaan.every((x) => x.gehaald) && staat.gedaan.length === staat.aantalLevels;
    $('resultaatPill').textContent = alles ? 'Alle levels gehaald' : 'Challenge afgerond';
    $('resultaatTitel').textContent = alles
      ? 'Jij hebt de uitdaging gehaald'
      : 'Je hebt de challenge afgerond';
    $('tijdCijfer').textContent = tijd(r.totaalMs ?? staat.gedaan.reduce((a, x) => a + x.tijdMs, 0));
    $('tijdDetail').textContent = `${staat.gedaan.filter((x) => x.gehaald).length} van ${
      staat.aantalLevels
    } levels goed`;

    $('levelTabel').innerHTML =
      `<thead><tr><th></th><th>Level</th><th style="text-align:right">Fouten</th><th style="text-align:right">Tijd</th></tr></thead><tbody>` +
      staat.gedaan
        .map(
          (x) => `<tr>
            <td class="uitslag ${x.gehaald ? 'ok' : 'nok'}">${x.gehaald ? '&#10003;' : '&#10007;'}</td>
            <td>Level ${x.nummer}</td>
            <td class="tijd">${x.fouten}</td>
            <td class="tijd">${tijd(x.tijdMs)}</td>
          </tr>`,
        )
        .join('') +
      '</tbody>';

    toon('resultaat');
  }

  $('naarFormulierKnop').addEventListener('click', () => toon('formulier'));

  /* ============================================================
     Formulier
     ============================================================ */
  document.querySelectorAll('.keuzeknop').forEach((b) =>
    b.addEventListener('click', () => {
      document.querySelectorAll('.keuzeknop').forEach((x) => x.classList.remove('aan'));
      b.classList.add('aan');
      staat.mbo = b.dataset.mbo === 'ja';
    }),
  );

  /* Telefoonnummer direct na invullen controleren, zelfde regels als de server. */
  function checkTelefoon() {
    const veld = $('telefoon');
    const fout = veld.value.trim() !== '' && !normaliseerTelefoon(veld.value);
    $('telefoonFout').classList.toggle('verborgen', !fout);
    veld.setAttribute('aria-invalid', String(fout));
    return !fout;
  }
  $('telefoon').addEventListener('blur', checkTelefoon);
  $('telefoon').addEventListener('input', () => {
    if (normaliseerTelefoon($('telefoon').value)) checkTelefoon();
  });

  $('formulier').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('formFout').classList.add('verborgen');
    if (!checkTelefoon() || !$('telefoon').value.trim()) {
      $('telefoonFout').classList.remove('verborgen');
      return $('telefoon').focus();
    }
    if (!$('akkoord').checked) {
      return meldFout($('formFout'), 'We hebben je toestemming nodig om contact op te nemen.');
    }
    if (staat.mbo === null) {
      return meldFout($('formFout'), 'Geef aan of je een mbo-diploma elektrotechniek hebt.');
    }
    $('verstuurKnop').disabled = true;
    try {
      const r = await api(`/api/sessie/${staat.sessieId}/inzending`, {
        method: 'POST',
        body: {
          voornaam: $('voornaam').value,
          telefoon: $('telefoon').value,
          email: $('email').value,
          mboDiploma: staat.mbo,
        },
      });
      tekenBedank(r);
    } catch (err) {
      meldFout($('formFout'), err.message);
      $('verstuurKnop').disabled = false;
    }
  });

  /* Podiumplek: grote medaille in beeld die uitfadet, met confetti. Puur decoratief,
     dus overgeslagen bij prefers-reduced-motion. Ruimt zichzelf op. */
  function vierMedaille(plek) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const kleuren = ['#E52A21', '#E8B923', '#FFFFFF', '#7FD1E8', '#23773A'];
    const el = document.createElement('div');
    el.className = 'viering';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML =
      `<span class="medaille groot m${plek}">${plek}</span>` +
      Array.from({ length: 70 }, (_, i) => {
        const stijl =
          `left:${Math.random() * 100}%;` +
          `background:${kleuren[i % kleuren.length]};` +
          `animation-delay:${Math.random() * 0.8}s;` +
          `animation-duration:${2 + Math.random() * 1.5}s;` +
          `transform:rotate(${Math.random() * 360}deg)`;
        return `<i class="confetti" style="${stijl}"></i>`;
      }).join('');
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4500);
  }

  /* ============================================================
     Bedanken, ranglijst en aftellen naar de vacatures
     ============================================================ */
  function tekenBedank(r) {
    const opgeslagen = r.opgeslagen !== false;
    $('bedankSub').textContent = opgeslagen
      ? 'Leuk dat je hebt meegedaan aan de Aqua+ Challenge. Een collega neemt contact met je op.'
      : 'Leuk dat je hebt meegedaan aan de Aqua+ Challenge.';
    $('bedankMelding').innerHTML = opgeslagen
      ? r.eigenPositie
        ? `<div class="callout"><span class="teken">&#10003;</span>Je tijd is
             <strong>${tijd(r.eigenTijdMs)}</strong>, plek <strong>${r.eigenPositie}</strong>
             van ${r.totaalDeelnemers}.</div>`
        : ''
      : `<div class="callout let-op"><span class="teken">Let op</span>${r.bericht || ''}</div>`;

    if (opgeslagen && r.eigenPositie >= 1 && r.eigenPositie <= 3) vierMedaille(r.eigenPositie);

    const rijen = r.leaderboard || [];
    $('bordTabel').innerHTML = rijen.length
      ? `<table class="bord">
           <thead><tr><th>#</th><th>Naam</th><th style="text-align:right">Tijd</th><th style="text-align:right">Fouten</th></tr></thead>
           <tbody>${rijen
             .map(
               (x) => `<tr class="${x.ikzelf ? 'ikzelf' : ''}">
                         <td class="pos">${x.positie <= 3
                           ? `<span class="medaille m${x.positie}" title="${['Goud', 'Zilver', 'Brons'][x.positie - 1]}">${x.positie}</span>`
                           : x.positie}</td>
                         <td>${ontsnap(x.voornaam)}</td>
                         <td class="tijd">${tijd(x.tijdMs)}</td>
                         <td class="tijd">${x.fouten ?? 0}</td>
                       </tr>`,
             )
             .join('')}</tbody>
         </table>`
      : '<p class="leeg">Nog geen tijden. Jij bent de eerste.</p>';

    const url = r.vacatureUrl || '/vacatures';
    $('nuKnop').href = url;
    startAftellen(url, r.redirectSeconden || 5);
    toon('bedank');
  }

  function startAftellen(url, seconden) {
    let over = seconden;
    const vulling = document.querySelector('.aftellen .lijn > i');
    $('aftelCijfer').textContent = over;
    vulling.style.transform = 'scaleX(1)';
    staat.aftelId = setInterval(() => {
      over -= 1;
      $('aftelCijfer').textContent = Math.max(0, over);
      vulling.style.transform = `scaleX(${Math.max(0, over / seconden)})`;
      if (over <= 0) {
        clearInterval(staat.aftelId);
        window.location.assign(url);
      }
    }, 1000);
  }

  $('blijfKnop').addEventListener('click', () => {
    if (staat.aftelId) clearInterval(staat.aftelId);
    $('aftellen').querySelector('.aftelTekst').textContent =
      'Het doorsturen is gestopt. Klik hieronder als je de vacatures wilt zien.';
    $('blijfKnop').classList.add('verborgen');
    document.querySelector('.aftellen .lijn').classList.add('verborgen');
  });

  /* ============================================================
     Hulpjes
     ============================================================ */
  const ontsnap = (s) =>
    String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
    );

  function meldFout(el, tekst) {
    el.className = 'callout fout';
    el.innerHTML = `<span class="teken">&#10007;</span>${ontsnap(tekst)}`;
    el.classList.remove('verborgen');
  }

  /* ============================================================
     Opstarten
     ============================================================ */
  $('startKnop').addEventListener('click', () => toon('intro'));

  $('introKnop').addEventListener('click', async () => {
    $('introKnop').disabled = true;
    try {
      const payload = await api(`/api/sessie/${staat.sessieId}/level`);
      if (payload.klaar) return naarResultaat({ totaalMs: payload.totaalMs });
      tekenLevel(payload);
    } catch (err) {
      $('introKnop').disabled = false;
      meldFout($('feedback'), err.message);
    }
  });

  /* Voettekst: mailto: uit .env (CONTACT_EMAIL). */
  function vulContact(c = {}) {
    const mail = $('contactMail');
    if (c.email) { mail.href = `mailto:${c.email}`; mail.title = c.email; }
    else mail.replaceWith(mail.textContent);
  }

  (async function init() {
    try {
      const s = await api('/api/sessie', { method: 'POST' });
      staat.sessieId = s.sessieId;
      staat.aantalLevels = s.aantalLevels;
      $('overslaanLink').href = s.vacatureUrl || '/vacatures';
      vulContact(s.contact);
      if (s.alIngezonden) {
        $('alIngezonden').classList.remove('verborgen');
        $('alIngezondenTekst').textContent =
          `Vanaf dit netwerk is al meegedaan${
            s.eerdereTijdMs ? ` (tijd ${tijd(s.eerdereTijdMs)})` : ''
          }. Je mag opnieuw spelen, maar het formulier kan niet nog een keer verstuurd worden.`;
      }
      toon('start');
    } catch (err) {
      $('scherm-laden').innerHTML =
        `<div class="callout fout"><span class="teken">&#10007;</span>${ontsnap(err.message)}</div>`;
    }
  })();
})();
