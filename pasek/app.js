/* ---------------------------------------------------------------
   APLIKACJA
   --------------------------------------------------------------- */

(() => {

/* ===== drobiazgi ===== */

const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const dwie = n => String(n).padStart(2, '0');
const naDate = d => d.getFullYear() + '-' + dwie(d.getMonth() + 1) + '-' + dwie(d.getDate());
const naGodzine = d => dwie(d.getHours()) + ':' + dwie(d.getMinutes());
const zaokr = (n, m = 0) => {
  const p = Math.pow(10, m);
  return Math.round(n * p) / p;
};
const zeZnakiem = n => (n > 0 ? '+' : '') + zaokr(n, 1);

const DNI_TYGODNIA = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
const MIESIACE = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
                  'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];

function ludzkaData(iso) {
  const [r, m, d] = iso.split('-').map(Number);
  const dt = new Date(r, m - 1, d);
  return DNI_TYGODNIA[dt.getDay()] + ', ' + d + ' ' + MIESIACE[m - 1];
}

/* Wielkanoc metodą Meeusa — potrzebna do świąt ruchomych. */
function wielkanoc(rok) {
  const a = rok % 19, b = Math.floor(rok / 100), c = rok % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const miesiac = Math.floor((h + l - 7 * m + 114) / 31);
  const dzien = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(rok, miesiac - 1, dzien);
}

const cacheSwiat = {};
function swietaPL(rok) {
  if (cacheSwiat[rok]) return cacheSwiat[rok];
  const w = wielkanoc(rok);
  const plus = n => { const d = new Date(w); d.setDate(d.getDate() + n); return naDate(d); };
  const zbior = new Set([
    rok + '-01-01', rok + '-01-06', rok + '-05-01', rok + '-05-03',
    rok + '-08-15', rok + '-11-01', rok + '-11-11', rok + '-12-25', rok + '-12-26',
    naDate(w), plus(1), plus(49), plus(50), plus(60)
  ]);
  cacheSwiat[rok] = zbior;
  return zbior;
}

function czyWolny(iso, dniWolne) {
  const [r, m, d] = iso.split('-').map(Number);
  const dzien = new Date(r, m - 1, d).getDay();
  if (dzien === 0 || dzien === 6) return true;
  if (swietaPL(r).has(iso)) return true;
  return dniWolne.indexOf(iso) !== -1;
}

/* Miesza kolor z tłem, żeby dostać jaśniejszy odcień tej samej barwy. */
function przygas(hex, ile) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const jasne = 20;   // jeden motyw: ciemny
  const mix = c => Math.round(c * (1 - ile) + jasne * ile);
  return '#' + [mix(r), mix(g), mix(b)].map(c => dwie(c.toString(16))).join('');
}

function czyCiemnyMotyw() {
  return true;   // jeden motyw: ciemny
}

/* ===== stan ===== */

let KONF = null;
let widok = 'wpis';
let SZYBKIE = [];

const roboczy = {
  ts: null,
  bateria: null,
  szop: [],          // [{ id, n, potwierdzone }]
  czerwonaFlaga: null,
  flagi: [],
  dzialanie: '',
  tagi: [],
  czemu: '',
  ocena: null
};

const filtry = {
  preset: '7dni',
  od: null,
  do: null,
  typDnia: 'wszystkie',
  osMacierzy: 'szop',
  grupowanie: null,     // null = bierzemy z konfiguracji
  tylkoPelne: false
};

function zeruj() {
  roboczy.ts = null;
  roboczy.bateria = null;
  roboczy.szop = [];
  roboczy.czerwonaFlaga = null;
  roboczy.flagi = [];
  roboczy.dzialanie = '';
  roboczy.tagi = [];
  roboczy.czemu = '';
  roboczy.ocena = null;
}

function komunikat(tekst) {
  const stary = document.querySelector('.toast');
  if (stary) stary.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = tekst;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

/* ===== analizy ===== */

function poziomBaterii(wartosc) {
  return KONF.bateria.find(b => wartosc >= b.min && wartosc <= b.max) || null;
}

function kategoriaSzop(id) {
  return KONF.szop.find(s => s.id === id) || { id, nazwa: id, kolor: '#8C9297' };
}

/* Waga czynnika w histogramie: natężenie albo 1, gdy natężeń nie używamy. */
function waga(czynnik) {
  if (!KONF.natezenie.wlaczone) return 1;
  if (KONF.natezenie.liczTylkoPotwierdzone && !czynnik.potwierdzone) return 0;
  return czynnik.n || KONF.natezenie.domyslne;
}

/* Zmiana baterii między wpisem a następnym — liczona na pełnej
   liście, żeby filtr dnia nie zerwał pary wpisów. */
function mapaZmian(wszystkie) {
  const mapa = {};
  const okno = KONF.analiza.oknoZmianyBateriiGodz * 3600000;
  for (let i = 0; i < wszystkie.length - 1; i++) {
    const teraz = wszystkie[i], potem = wszystkie[i + 1];
    const odstep = new Date(potem.ts) - new Date(teraz.ts);
    if (odstep > 0 && odstep <= okno) mapa[teraz.id] = potem.bateria - teraz.bateria;
  }
  return mapa;
}

/* Sprowadza zapis czynności do wspólnej postaci, żeby „Spacer z psem”,
   „spacer z psem” i „spacer z psem.” trafiły do jednego wiersza. */
function normalizujDzialanie(t) {
  return (t || '').toLowerCase()
    .replace(/[.,;:!?…]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/* Klucz grupujący. Domyślnie liczy się konkretna czynność;
   tag wchodzi do gry, gdy pola tekstowego nie wypełniłeś
   albo gdy sam przełączysz widok na tagi. */
function kluczDzialania(w, tryb) {
  const jak = tryb || filtry.grupowanie || KONF.analiza.grupowanieDzialan;
  const tekst = (w.dzialanie || '').trim();
  const tag = (w.tagi && w.tagi.length) ? w.tagi[0] : null;
  const zTekstu = () => ({ klucz: 'txt:' + normalizujDzialanie(tekst), nazwa: tekst });
  const zTagu = () => ({ klucz: 'tag:' + tag, nazwa: tag });
  if (jak === 'tag') return tag ? zTagu() : (tekst ? zTekstu() : null);
  return tekst ? zTekstu() : (tag ? zTagu() : null);
}

/* Czynności, które już notowałeś — do podpowiadanych przycisków.
   Ranking to częstość wygaszana świeżością: rzecz robiona często
   i niedawno wychodzi przed tę sprzed miesiąca. */
function znaneDzialania(limit) {
  const mapa = {};
  Magazyn.wpisy().forEach(w => {
    const tekst = (w.dzialanie || '').trim();
    if (!tekst) return;
    const k = normalizujDzialanie(tekst);
    if (!k) return;
    if (!mapa[k]) mapa[k] = { n: 0, ostatni: w.ts, tagi: (w.tagi || []).slice(), warianty: {} };
    const m = mapa[k];
    m.n++;
    m.warianty[tekst] = (m.warianty[tekst] || 0) + 1;
    if (w.ts >= m.ostatni) {
      m.ostatni = w.ts;
      if ((w.tagi || []).length) m.tagi = w.tagi.slice();
    }
  });
  const teraz = Date.now();
  return Object.values(mapa).map(m => {
    m.nazwa = Object.entries(m.warianty).sort((a, b) => b[1] - a[1])[0][0];
    const dni = (teraz - new Date(m.ostatni)) / 86400000;
    m.wynik = m.n / (1 + dni / 14);
    return m;
  }).sort((a, b) => b.wynik - a.wynik).slice(0, limit || 8);
}

function filtrujWpisy(wszystkie) {
  const dniWolne = Magazyn.dniWolne();
  const dzis = new Date();
  let od = null, doo = null;

  if (filtry.preset === 'dzis') {
    od = naDate(dzis); doo = naDate(dzis);
  } else if (filtry.preset === '7dni' || filtry.preset === '30dni') {
    const ile = filtry.preset === '7dni' ? 6 : 29;
    const start = new Date(dzis); start.setDate(start.getDate() - ile);
    od = naDate(start); doo = naDate(dzis);
  } else if (filtry.preset === 'zakres') {
    od = filtry.od; doo = filtry.do;
  }

  return wszystkie.filter(w => {
    const dzien = w.ts.slice(0, 10);
    if (od && dzien < od) return false;
    if (doo && dzien > doo) return false;
    if (filtry.typDnia === 'robocze' && czyWolny(dzien, dniWolne)) return false;
    if (filtry.typDnia === 'wolne' && !czyWolny(dzien, dniWolne)) return false;
    if (filtry.tylkoPelne && !(w.bateria != null && (w.szop || []).length)) return false;
    return true;
  });
}

/* Wpis "pełny" = ma i baterię, i przynajmniej jeden czynnik SZOP.
   Tylko takie niosą korelację między stanem a energią. */
function czyPelny(w) {
  return w.bateria != null && (w.szop || []).length > 0;
}

/* ===== widok: nowy wpis ===== */

function rysujWpis() {
  if (!roboczy.ts) {
    const t = new Date();
    roboczy.ts = naDate(t) + 'T' + naGodzine(t);
  }

  const segmenty = KONF.bateria.map(b => {
    const wybrany = roboczy.bateria === b.srodek;
    const nizej = roboczy.bateria != null && b.srodek < roboczy.bateria;
    return `<button type="button" class="bateria-segment" data-bateria="${b.srodek}"
        aria-pressed="${wybrany}" data-nizej="${nizej}"
        aria-label="Bateria ${b.etykieta}, ${b.opis}">
        <span class="wypelnienie" style="background:${b.kolor}"></span>
        <span class="liczba">${b.etykieta}</span>
      </button>`;
  }).join('');

  const wybranyPoziom = roboczy.bateria != null ? poziomBaterii(roboczy.bateria) : null;

  const szopHtml = KONF.szop.map(s => {
    const wybrany = roboczy.szop.find(x => x.id === s.id);
    const kropki = (wybrany && KONF.natezenie.wlaczone) ? `
      <div class="natezenie" role="group" aria-label="Natężenie: ${esc(s.nazwa)}">
        <span class="opis">natężenie</span>
        ${Array.from({ length: KONF.natezenie.maks }, (_, i) => {
          const n = i + 1, akt = n <= wybrany.n;
          return `<button type="button" class="kropka" data-szop-natezenie="${s.id}" data-n="${n}"
            data-aktywna="${akt}" style="${akt ? 'background:' + s.kolor : ''}"
            aria-label="${n} z ${KONF.natezenie.maks}"></button>`;
        }).join('')}
        ${!wybrany.potwierdzone ? '<span class="znacznik-domyslny">domyślne</span>' : ''}
      </div>` : '';
    return `<div class="szop-blok">
        <button type="button" class="zeton" data-szop="${s.id}" aria-pressed="${!!wybrany}"
          style="${wybrany ? 'background:' + s.kolor : ''}">${esc(s.nazwa)}</button>
        ${kropki}
      </div>`;
  }).join('');

  const flagiHtml = KONF.czerwoneFlagi.map(f => `
    <button type="button" class="zeton maly" data-flaga="${esc(f)}"
      aria-pressed="${roboczy.flagi.includes(f)}"
      style="${roboczy.flagi.includes(f) ? 'background:var(--alarm)' : ''}">${esc(f)}</button>`).join('');

  const tagiHtml = KONF.tagiDzialan.map(t => `
    <button type="button" class="zeton maly" data-tag="${esc(t)}"
      aria-pressed="${roboczy.tagi.includes(t)}"
      style="${roboczy.tagi.includes(t) ? 'background:var(--akcent)' : ''}">${esc(t)}</button>`).join('');

  const ocenyHtml = KONF.ocenaDzialania.map(o => `
    <button type="button" class="zeton maly" data-ocena="${o.id}"
      aria-pressed="${roboczy.ocena === o.id}"
      style="${roboczy.ocena === o.id ? 'background:' + o.kolor : ''}">${esc(o.nazwa)}</button>`).join('');

  SZYBKIE = znaneDzialania(KONF.analiza.szybkieDzialania);
  const trafione = s => normalizujDzialanie(roboczy.dzialanie) === normalizujDzialanie(s.nazwa);

  const liczbaWpisow = Magazyn.wpisy().length;
  const prog = (KONF.oStronie && KONF.oStronie.pokazWskazowkeDoWpisow) || 0;
  const wskazowkaHtml = (prog && liczbaWpisow < prog) ? `
    <p class="wskazowka-nowy">Pierwszy raz? Zajrzyj do
      <button type="button" class="link-tekst" data-idz-ostronie>„Pomoc”</button>
      — jak działają Twoje dane i dlaczego są bezpieczne. Ta wskazówka zniknie po pierwszym wpisie.</p>` : '';

  $('#widok').innerHTML = `
    <div class="karta jasna">
      ${wskazowkaHtml}
      <label class="etykieta" for="pole-ts">Kiedy</label>
      <div class="rzad" style="margin-bottom:22px">
        <input type="datetime-local" id="pole-ts" value="${roboczy.ts}" style="width:auto">
        <button type="button" class="przycisk cichy" id="teraz">teraz</button>
      </div>

      <span class="etykieta">Bateria</span>
      <div class="bateria-pasek">${segmenty}</div>
      <p class="bateria-opis">${wybranyPoziom ? esc(wybranyPoziom.opis) : 'Stuknij w segment, żeby ustawić poziom'}</p>
      <p class="blad-pola ukryty" id="blad-bateria">Wybierz poziom baterii — bez niego wpis nic nie powie.</p>

      <div style="margin-top:22px">
        <span class="etykieta">Który to był SZOP${KONF.pozwalajNaWieleSzop ? '' : ' (jeden główny)'}</span>
        <div class="zetony">${szopHtml}</div>
      </div>

      <div style="margin-top:22px">
        <span class="etykieta">Czerwone flagi</span>
        <div class="zetony" style="margin-bottom:10px">
          <button type="button" class="zeton" data-flaga-tak="tak" aria-pressed="${roboczy.czerwonaFlaga === true}"
            style="${roboczy.czerwonaFlaga === true ? 'background:var(--alarm)' : ''}">Tak, widziałem</button>
          <button type="button" class="zeton" data-flaga-tak="nie" aria-pressed="${roboczy.czerwonaFlaga === false}"
            style="${roboczy.czerwonaFlaga === false ? 'background:var(--akcent)' : ''}">Nie</button>
        </div>
        <div class="zetony ${roboczy.czerwonaFlaga === true ? '' : 'ukryty'}" id="lista-flag">${flagiHtml}</div>
      </div>

      ${SZYBKIE.length ? `<div style="margin-top:22px">
        <span class="etykieta">Co robiłem — robiłeś już</span>
        <div class="zetony">
          ${SZYBKIE.map((s, i) => `<button type="button" class="zeton maly" data-szybkie="${i}"
            aria-pressed="${trafione(s)}" style="${trafione(s) ? 'background:var(--akcent)' : ''}"
            title="zanotowane ${s.n} ${s.n === 1 ? 'raz' : 'razy'}">${esc(s.nazwa)}</button>`).join('')}
        </div>
      </div>` : ''}

      <details class="rozwijane" ${(roboczy.dzialanie || roboczy.czemu || roboczy.tagi.length) ? 'open' : ''}>
        <summary>${SZYBKIE.length ? 'Wpisz coś nowego i oceń, czy zadziałało' : 'Co robiłem i czy zadziałało'}</summary>
        <div class="wnetrze">
          <div class="siatka2">
            <div>
              <label class="etykieta" for="pole-dzialanie">Co robiłem</label>
              <textarea id="pole-dzialanie" placeholder="Spacer z psem, słuchawki wygłuszające">${esc(roboczy.dzialanie)}</textarea>
              <div class="zetony" style="margin-top:9px">${tagiHtml}</div>
            </div>
            <div>
              <label class="etykieta" for="pole-czemu">Czemu to na mnie działało</label>
              <textarea id="pole-czemu" placeholder="Cisza i ruch rozładowały napięcie mięśni">${esc(roboczy.czemu)}</textarea>
              <span class="etykieta" style="margin-top:14px">Czy zadziałało</span>
              <div class="zetony">${ocenyHtml}</div>
            </div>
          </div>
        </div>
      </details>

      <div class="rzad" style="margin-top:24px">
        <button type="button" class="przycisk glowny" id="zapisz">Zapisz wpis</button>
        <button type="button" class="przycisk cichy" id="wyczysc">Wyczyść</button>
      </div>
    </div>
  `;

  podepnijWpis();
}

function podepnijWpis() {
  const wsk = $('[data-idz-ostronie]');
  if (wsk) wsk.addEventListener('click', () => przelacz('ostronie'));
  $('#pole-ts').addEventListener('change', e => { roboczy.ts = e.target.value; });
  $('#teraz').addEventListener('click', () => {
    const t = new Date();
    roboczy.ts = naDate(t) + 'T' + naGodzine(t);
    $('#pole-ts').value = roboczy.ts;
  });

  document.querySelectorAll('[data-bateria]').forEach(b => {
    b.addEventListener('click', () => {
      roboczy.bateria = Number(b.dataset.bateria);
      $('#blad-bateria').classList.add('ukryty');
      rysujWpis();
    });
  });

  document.querySelectorAll('[data-szop]').forEach(b => {
    b.addEventListener('click', () => {
      const id = b.dataset.szop;
      const i = roboczy.szop.findIndex(x => x.id === id);
      if (i !== -1) {
        roboczy.szop.splice(i, 1);
      } else {
        const nowy = { id, n: KONF.natezenie.domyslne, potwierdzone: false };
        if (KONF.pozwalajNaWieleSzop) roboczy.szop.push(nowy);
        else roboczy.szop = [nowy];
      }
      rysujWpis();
    });
  });

  document.querySelectorAll('[data-szop-natezenie]').forEach(b => {
    b.addEventListener('click', () => {
      const cz = roboczy.szop.find(x => x.id === b.dataset.szopNatezenie);
      if (!cz) return;
      cz.n = Number(b.dataset.n);
      cz.potwierdzone = true;
      rysujWpis();
    });
  });

  document.querySelectorAll('[data-flaga-tak]').forEach(b => {
    b.addEventListener('click', () => {
      const tak = b.dataset.flagaTak === 'tak';
      roboczy.czerwonaFlaga = roboczy.czerwonaFlaga === tak ? null : tak;
      if (roboczy.czerwonaFlaga !== true) roboczy.flagi = [];
      rysujWpis();
    });
  });

  document.querySelectorAll('[data-flaga]').forEach(b => {
    b.addEventListener('click', () => {
      const f = b.dataset.flaga;
      const i = roboczy.flagi.indexOf(f);
      if (i === -1) roboczy.flagi.push(f); else roboczy.flagi.splice(i, 1);
      rysujWpis();
    });
  });

  document.querySelectorAll('[data-tag]').forEach(b => {
    b.addEventListener('click', () => {
      zbierzTeksty();
      const t = b.dataset.tag;
      const i = roboczy.tagi.indexOf(t);
      if (i === -1) roboczy.tagi.push(t); else roboczy.tagi.splice(i, 1);
      rysujWpis();
    });
  });

  document.querySelectorAll('[data-ocena]').forEach(b => {
    b.addEventListener('click', () => {
      zbierzTeksty();
      roboczy.ocena = roboczy.ocena === b.dataset.ocena ? null : b.dataset.ocena;
      rysujWpis();
    });
  });

  document.querySelectorAll('[data-szybkie]').forEach(b => {
    b.addEventListener('click', () => {
      zbierzTeksty();
      const s = SZYBKIE[Number(b.dataset.szybkie)];
      if (!s) return;
      if (normalizujDzialanie(roboczy.dzialanie) === normalizujDzialanie(s.nazwa)) {
        roboczy.dzialanie = '';
        roboczy.tagi = roboczy.tagi.filter(t => !s.tagi.includes(t));
      } else {
        roboczy.dzialanie = s.nazwa;
        s.tagi.forEach(t => {
          if (KONF.tagiDzialan.includes(t) && !roboczy.tagi.includes(t)) roboczy.tagi.push(t);
        });
      }
      rysujWpis();
      const pole = $('#pole-dzialanie');
      if (pole && roboczy.dzialanie) pole.focus();
    });
  });

  $('#pole-dzialanie').addEventListener('input', e => { roboczy.dzialanie = e.target.value; });
  $('#pole-czemu').addEventListener('input', e => { roboczy.czemu = e.target.value; });

  $('#zapisz').addEventListener('click', zapiszWpis);
  $('#wyczysc').addEventListener('click', () => { zeruj(); rysujWpis(); });
}

function zbierzTeksty() {
  const a = $('#pole-dzialanie'), b = $('#pole-czemu');
  if (a) roboczy.dzialanie = a.value;
  if (b) roboczy.czemu = b.value;
}

function zapiszWpis() {
  zbierzTeksty();
  if (roboczy.bateria == null) {
    $('#blad-bateria').classList.remove('ukryty');
    document.querySelector('.bateria-pasek').scrollIntoView({ block: 'center', behavior: 'smooth' });
    return;
  }
  const wpis = {
    id: Magazyn.noweId(),
    ts: new Date(roboczy.ts).toISOString(),
    bateria: roboczy.bateria,
    szop: roboczy.szop.map(s => ({ id: s.id, n: s.n, potwierdzone: s.potwierdzone })),
    czerwonaFlaga: roboczy.czerwonaFlaga === true,
    flagi: roboczy.flagi.slice(),
    dzialanie: roboczy.dzialanie.trim(),
    tagi: roboczy.tagi.slice(),
    czemu: roboczy.czemu.trim(),
    ocena: roboczy.ocena
  };
  Magazyn.dodajWpis(wpis);
  zeruj();
  rysujWpis();
  odswiezLicznik();
  komunikat('Zapisano');
}

/* ===== widok: dashboard ===== */

function rysujDashboard() {
  const wszystkie = Magazyn.wpisy();
  if (!wszystkie.length) {
    $('#widok').innerHTML = `<div class="pusty-stan">
      <strong>Brak wpisów</strong>
      Przegląd policzy korelacje, gdy będzie z czego. Zacznij od zakładki „Nowy wpis”.
    </div>`;
    return;
  }

  const zmiany = mapaZmian(wszystkie);
  const dane = filtrujWpisy(wszystkie);
  const grupTeraz = filtry.grupowanie || KONF.analiza.grupowanieDzialan;

  $('#widok').innerHTML = `
    ${filtryHtml()}
    ${dane.length === 0
      ? `<div class="pusty-stan"><strong>Brak wpisów w tym zakresie</strong>Poszerz zakres dat albo zdejmij filtr dni.</div>`
      : `
      <div class="karta">
        <h2>Obciążenie w ciągu doby</h2>
        <p class="wskazowka">${opisHistogramu(dane)}</p>
        ${legendaHtml()}
        <div class="wykres-otoczka">${histogram(dane)}</div>
      </div>

      <div class="siatka3">
        ${panelFlagi(dane)}
        ${panelRegeneracja(dane, zmiany)}
        ${panelKorelacja(dane)}
      </div>

      <div class="karta">
        <div class="rzad" style="margin-bottom:4px">
          <h2>Co działa, kiedy i na co</h2>
          <div class="rozdziel" style="display:flex;gap:8px;flex-wrap:wrap">
            <div style="display:flex;gap:2px;background:var(--powierzchnia-2);border:1px solid var(--linia);border-radius:var(--promien);padding:2px">
              <button class="przycisk cichy" data-grupowanie="dzialanie" style="padding:5px 11px;font-size:13px;${grupTeraz === 'dzialanie' ? 'color:var(--tusz);font-weight:500' : ''}">konkretne czynności</button>
              <button class="przycisk cichy" data-grupowanie="tag" style="padding:5px 11px;font-size:13px;${grupTeraz === 'tag' ? 'color:var(--tusz);font-weight:500' : ''}">zwinięte do tagów</button>
            </div>
            <div style="display:flex;gap:2px;background:var(--powierzchnia-2);border:1px solid var(--linia);border-radius:var(--promien);padding:2px">
              <button class="przycisk cichy" data-os="szop" style="padding:5px 11px;font-size:13px;${filtry.osMacierzy === 'szop' ? 'color:var(--tusz);font-weight:500' : ''}">wg SZOP</button>
              <button class="przycisk cichy" data-os="pora" style="padding:5px 11px;font-size:13px;${filtry.osMacierzy === 'pora' ? 'color:var(--tusz);font-weight:500' : ''}">wg pory dnia</button>
            </div>
          </div>
        </div>
        <p class="wskazowka">Liczba w kratce to średnia zmiana baterii po działaniu. Puste kratki to za mało wpisów, żeby cokolwiek twierdzić.</p>
        ${macierz(dane, zmiany)}
      </div>
    `}
  `;

  podepnijFiltry();
  document.querySelectorAll('[data-os]').forEach(b => {
    b.addEventListener('click', () => { filtry.osMacierzy = b.dataset.os; rysujDashboard(); });
  });
  document.querySelectorAll('[data-grupowanie]').forEach(b => {
    b.addEventListener('click', () => { filtry.grupowanie = b.dataset.grupowanie; rysujDashboard(); });
  });
}

function filtryHtml() {
  const presety = [['dzis', 'Dziś'], ['7dni', '7 dni'], ['30dni', '30 dni'],
                   ['wszystko', 'Wszystko'], ['zakres', 'Zakres dat']];
  const typy = [['wszystkie', 'Wszystkie dni'], ['robocze', 'Robocze'], ['wolne', 'Wolne']];
  return `<div class="filtry">
    <div class="grupa">${presety.map(([id, n]) =>
      `<button data-preset="${id}" aria-pressed="${filtry.preset === id}">${n}</button>`).join('')}</div>
    <div class="grupa">${typy.map(([id, n]) =>
      `<button data-typdnia="${id}" aria-pressed="${filtry.typDnia === id}">${n}</button>`).join('')}</div>
    <button class="przycisk ${filtry.tylkoPelne ? 'glowny' : 'cichy'}" id="tylko-pelne"
      style="padding:6px 13px;font-size:13px" aria-pressed="${filtry.tylkoPelne}"
      title="Zostaw tylko wpisy, które mają i baterię, i czynnik SZOP — czyli te niosące korelację">
      ${filtry.tylkoPelne ? '✓ ' : ''}tylko pełne (bateria + SZOP)</button>
    <div class="rzad ${filtry.preset === 'zakres' ? '' : 'ukryty'}" id="zakres-dat">
      <input type="date" id="data-od" value="${filtry.od || ''}" aria-label="Data od">
      <span style="color:var(--slaby)">→</span>
      <input type="date" id="data-do" value="${filtry.do || ''}" aria-label="Data do">
    </div>
  </div>`;
}

function podepnijFiltry() {
  document.querySelectorAll('[data-preset]').forEach(b => {
    b.addEventListener('click', () => {
      filtry.preset = b.dataset.preset;
      if (filtry.preset === 'zakres' && !filtry.od) {
        const dzis = new Date(), start = new Date(); start.setDate(start.getDate() - 13);
        filtry.od = naDate(start); filtry.do = naDate(dzis);
      }
      rysujDashboard();
    });
  });
  document.querySelectorAll('[data-typdnia]').forEach(b => {
    b.addEventListener('click', () => { filtry.typDnia = b.dataset.typdnia; rysujDashboard(); });
  });
  const pelne = $('#tylko-pelne');
  if (pelne) pelne.addEventListener('click', () => { filtry.tylkoPelne = !filtry.tylkoPelne; rysujDashboard(); });
  const od = $('#data-od'), doo = $('#data-do');
  if (od) od.addEventListener('change', e => { filtry.od = e.target.value; rysujDashboard(); });
  if (doo) doo.addEventListener('change', e => { filtry.do = e.target.value; rysujDashboard(); });
}

function opisHistogramu(dane) {
  const dni = new Set(dane.map(w => w.ts.slice(0, 10)));
  const jednostka = KONF.natezenie.wlaczone ? 'suma natężeń' : 'liczba wpisów';
  return dni.size <= 1
    ? `Jeden dzień, godzina po godzinie. Wysokość słupka to ${jednostka}.`
    : `${dni.size} dni nałożone na dobę — słupek to ${jednostka} o tej godzinie we wszystkich dniach zakresu.`;
}

function legendaHtml() {
  const szop = KONF.szop.map(s =>
    `<span class="klucz"><i class="probka" style="background:${s.kolor}"></i>${esc(s.nazwa)}</span>`).join('');
  return `<div class="legenda">${szop}
    <span class="klucz"><i class="probka linia" style="background:var(--tusz)"></i>średnia bateria</span>
    <span class="klucz" style="color:var(--alarm)">▲ czerwona flaga</span>
  </div>`;
}

function histogram(dane) {
  const W = 720, H = 300;
  const mL = 40, mR = 42, mT = 18, mB = 46;
  const szerWykr = W - mL - mR, wysWykr = H - mT - mB;

  const godziny = {};
  dane.forEach(w => {
    const g = new Date(w.ts).getHours();
    if (!godziny[g]) godziny[g] = { szop: {}, bateria: [], flagi: 0, wpisy: 0 };
    const k = godziny[g];
    k.wpisy++;
    k.bateria.push(w.bateria);
    if (w.czerwonaFlaga) k.flagi++;
    (w.szop || []).forEach(c => { k.szop[c.id] = (k.szop[c.id] || 0) + waga(c); });
  });

  const obecne = Object.keys(godziny).map(Number);
  let odG = Math.min.apply(null, obecne.concat(KONF.histogram.domyslnyZakres[0]));
  let doG = Math.max.apply(null, obecne.concat(KONF.histogram.domyslnyZakres[1]));
  const liczbaKolumn = doG - odG + 1;
  const szerKol = szerWykr / liczbaKolumn;
  const szerSlupka = Math.min(30, szerKol * 0.62);

  let maks = 0;
  Object.values(godziny).forEach(k => {
    const suma = Object.values(k.szop).reduce((a, b) => a + b, 0);
    if (suma > maks) maks = suma;
  });
  if (maks === 0) maks = 1;
  const gornaOs = Math.ceil(maks / 4) * 4 || 4;

  const x = g => mL + (g - odG) * szerKol + szerKol / 2;
  const y = v => mT + wysWykr - (v / gornaOs) * wysWykr;
  const yBat = v => mT + wysWykr - (v / 100) * wysWykr;

  let out = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Histogram godzinny obciążenia SZOP z linią średniej baterii">`;

  /* siatka */
  for (let i = 0; i <= 4; i++) {
    const wart = gornaOs * i / 4;
    const yy = y(wart);
    out += `<line x1="${mL}" y1="${yy}" x2="${W - mR}" y2="${yy}" stroke="var(--linia)" stroke-width="1"/>`;
    out += `<text x="${mL - 8}" y="${yy + 4}" text-anchor="end" font-family="var(--mono)" font-size="10.5" fill="var(--slaby)">${zaokr(wart)}</text>`;
    out += `<text x="${W - mR + 8}" y="${yBat(100 * i / 4) + 4}" font-family="var(--mono)" font-size="10.5" fill="var(--slaby)">${25 * i}</text>`;
  }

  /* słupki */
  for (let g = odG; g <= doG; g++) {
    const k = godziny[g];
    if (!k) continue;
    let dolem = 0;
    KONF.szop.forEach(s => {
      const v = k.szop[s.id] || 0;
      if (!v) return;
      const wys = (v / gornaOs) * wysWykr;
      const yy = y(dolem + v);
      out += `<rect x="${zaokr(x(g) - szerSlupka / 2, 1)}" y="${zaokr(yy, 1)}" width="${zaokr(szerSlupka, 1)}" height="${zaokr(wys, 1)}"
        rx="2" fill="${s.kolor}"><title>${esc(s.nazwa)} o ${g}:00 — ${zaokr(v, 1)}</title></rect>`;
      dolem += v;
    });
    if (k.flagi) {
      out += `<text x="${zaokr(x(g), 1)}" y="${zaokr(y(dolem) - 7, 1)}" text-anchor="middle" font-size="11" fill="var(--alarm)">▲<title>Czerwone flagi o ${g}:00 — ${k.flagi}</title></text>`;
    }
  }

  /* linia baterii */
  const punkty = [];
  for (let g = odG; g <= doG; g++) {
    const k = godziny[g];
    if (!k || !k.bateria.length) continue;
    const sr = k.bateria.reduce((a, b) => a + b, 0) / k.bateria.length;
    punkty.push([x(g), yBat(sr), g, sr]);
  }
  if (punkty.length > 1) {
    out += `<polyline fill="none" stroke="var(--tusz)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
      points="${punkty.map(p => zaokr(p[0], 1) + ',' + zaokr(p[1], 1)).join(' ')}"/>`;
  }
  punkty.forEach(p => {
    out += `<circle cx="${zaokr(p[0], 1)}" cy="${zaokr(p[1], 1)}" r="3" fill="var(--tusz)">
      <title>Średnia bateria o ${p[2]}:00 — ${zaokr(p[3])}</title></circle>`;
  });

  /* oś godzin */
  const krok = liczbaKolumn > 16 ? 2 : 1;
  for (let g = odG; g <= doG; g++) {
    if ((g - odG) % krok !== 0) continue;
    out += `<text x="${zaokr(x(g), 1)}" y="${H - mB + 20}" text-anchor="middle" font-family="var(--mono)" font-size="10.5" fill="var(--slaby)">${g}</text>`;
  }
  out += `<line x1="${mL}" y1="${mT + wysWykr}" x2="${W - mR}" y2="${mT + wysWykr}" stroke="var(--linia-mocna)" stroke-width="1"/>`;
  out += `<text x="${mL}" y="${H - 8}" font-family="var(--mono)" font-size="10.5" fill="var(--slaby)">godzina →</text>`;
  out += `<text x="${W - mR + 8}" y="${mT - 5}" font-family="var(--mono)" font-size="10.5" fill="var(--slaby)">bateria</text>`;
  out += `</svg>`;
  return out;
}

function panelFlagi(dane) {
  const zFlaga = dane.filter(w => w.czerwonaFlaga);
  if (!zFlaga.length) {
    return `<div class="karta metryka"><h3>Czerwone flagi</h3>
      <p class="liczba-duza">0</p>
      <p class="pod">w tym zakresie — nic do pokazania</p></div>`;
  }

  const wgGodziny = {};
  zFlaga.forEach(w => {
    const g = new Date(w.ts).getHours();
    wgGodziny[g] = (wgGodziny[g] || 0) + 1;
  });
  const szczyt = Object.entries(wgGodziny).sort((a, b) => b[1] - a[1])[0];

  const liczFlag = {};
  zFlaga.forEach(w => (w.flagi || []).forEach(f => { liczFlag[f] = (liczFlag[f] || 0) + 1; }));
  const top = Object.entries(liczFlag).sort((a, b) => b[1] - a[1]).slice(0, 4);

  const srZ = zFlaga.reduce((a, w) => a + w.bateria, 0) / zFlaga.length;
  const bez = dane.filter(w => !w.czerwonaFlaga);
  const srB = bez.length ? bez.reduce((a, w) => a + w.bateria, 0) / bez.length : null;
  const udzial = zaokr(zFlaga.length / dane.length * 100);

  return `<div class="karta metryka">
    <h3>Czerwone flagi</h3>
    <p class="liczba-duza">${szczyt[0]}:00</p>
    <p class="pod">godzina największego ryzyka — ${szczyt[1]} ${szczyt[1] === 1 ? 'raz' : 'razy'}</p>
    <ul class="lista-rankingu">
      <li>Wpisy z flagą <span class="wart">${zFlaga.length} / ${dane.length} · ${udzial}%</span></li>
      <li>Bateria z flagą <span class="wart ujemny">${zaokr(srZ)}</span></li>
      ${srB != null ? `<li>Bateria bez flagi <span class="wart dodatni">${zaokr(srB)}</span></li>` : ''}
    </ul>
    ${top.length ? `<span class="etykieta" style="margin-top:14px">Najczęstsze sygnały</span>
    <ul class="lista-rankingu">
      ${top.map(([f, n]) => `<li>${esc(f)}<span class="wart neutralny">×${n}</span></li>`).join('')}
    </ul>` : ''}
  </div>`;
}

function panelRegeneracja(dane, zmiany) {
  const grupy = {};
  dane.forEach(w => {
    const g = kluczDzialania(w);
    if (!g) return;
    if (!grupy[g.klucz]) grupy[g.klucz] = { nazwa: g.nazwa, delty: [], oceny: [], n: 0 };
    const grupa = grupy[g.klucz];
    grupa.n++;
    if (zmiany[w.id] != null) grupa.delty.push(zmiany[w.id]);
    if (w.ocena) {
      const o = KONF.ocenaDzialania.find(x => x.id === w.ocena);
      if (o) grupa.oceny.push(o.waga);
    }
  });

  const lista = Object.values(grupy).map(g => ({
    nazwa: g.nazwa,
    n: g.n,
    delta: g.delty.length ? g.delty.reduce((a, b) => a + b, 0) / g.delty.length : null,
    proby: g.delty.length,
    ocena: g.oceny.length ? g.oceny.reduce((a, b) => a + b, 0) / g.oceny.length : null
  })).sort((a, b) => {
    const da = a.delta == null ? -999 : a.delta;
    const db = b.delta == null ? -999 : b.delta;
    return db - da;
  });

  if (!lista.length) {
    return `<div class="karta metryka"><h3>Regeneracja</h3>
      <p class="liczba-duza">—</p>
      <p class="pod">brak zapisanych działań w tym zakresie</p>
      <p style="font-size:13px;color:var(--slaby)">Wypełnij „Co robiłem” przy choć kilku wpisach, a tu pojawi się ranking.</p></div>`;
  }

  const najlepsze = lista.find(x => x.delta != null);
  const rozjazd = lista.find(x => x.ocena != null && x.ocena > 0 && x.delta != null && x.delta < 0);

  return `<div class="karta metryka">
    <h3>Regeneracja</h3>
    <p class="liczba-duza ${najlepsze && najlepsze.delta > 0 ? 'dodatni' : ''}">${najlepsze ? zeZnakiem(najlepsze.delta) : '—'}</p>
    <p class="pod">${najlepsze ? esc(najlepsze.nazwa) + ' — najlepszy średni zysk baterii' : 'za mało par wpisów, żeby policzyć zmianę'}</p>
    <ul class="lista-rankingu">
      ${lista.slice(0, 6).map(x => `<li>${esc(x.nazwa)}
        <span class="wart ${x.delta == null ? 'neutralny' : x.delta > 0 ? 'dodatni' : x.delta < 0 ? 'ujemny' : 'neutralny'}">${x.delta == null ? '—' : zeZnakiem(x.delta)}</span></li>`).join('')}
    </ul>
    ${rozjazd ? `<p style="font-size:12.5px;color:var(--alarm);margin-top:12px">
      Uwaga na rozjazd: „${esc(rozjazd.nazwa)}” oceniasz jako pomocne, a bateria po nim spada (${zeZnakiem(rozjazd.delta)}).</p>` : ''}
  </div>`;
}

function panelKorelacja(dane) {
  const zSzop = dane.filter(w => (w.szop || []).length);
  if (!zSzop.length) {
    return `<div class="karta metryka"><h3>Bateria × SZOP</h3>
      <p class="liczba-duza">—</p>
      <p class="pod">brak wpisów z zaznaczonym czynnikiem</p></div>`;
  }

  const srOgolna = dane.reduce((a, w) => a + w.bateria, 0) / dane.length;

  const wyniki = KONF.szop.map(s => {
    const pas = zSzop.filter(w => (w.szop || []).some(c => c.id === s.id));
    if (!pas.length) return { s, n: 0, srednia: null, roznica: null, natezenie: null };
    const srednia = pas.reduce((a, w) => a + w.bateria, 0) / pas.length;
    const natez = pas.map(w => (w.szop.find(c => c.id === s.id) || {}).n)
                     .filter(n => n != null);
    return {
      s, n: pas.length, srednia,
      roznica: srednia - srOgolna,
      natezenie: natez.length ? natez.reduce((a, b) => a + b, 0) / natez.length : null
    };
  }).filter(x => x.n > 0).sort((a, b) => a.srednia - b.srednia);

  const najgorszy = wyniki[0];
  const maksN = Math.max.apply(null, wyniki.map(x => x.n));

  return `<div class="karta metryka">
    <h3>Bateria × SZOP</h3>
    <p class="liczba-duza ujemny">${zeZnakiem(najgorszy.roznica)}</p>
    <p class="pod">${esc(najgorszy.s.nazwa)} — najmocniej ciągnie baterię w dół<br>względem Twojej średniej ${zaokr(srOgolna)}</p>
    ${wyniki.map(x => `
      <div class="paskowy">
        <span class="nazwa">${esc(x.s.nazwa)}</span>
        <span class="tor"><i style="width:${zaokr(x.n / maksN * 100)}%;background:${x.s.kolor}"></i></span>
        <span class="wart">${zaokr(x.srednia)}</span>
      </div>`).join('')}
    <p style="font-size:12px;color:var(--slaby);margin-top:10px">
      Długość paska to liczba wpisów, liczba po prawej to średnia bateria przy tym czynniku.
      ${wyniki.some(x => x.natezenie != null) ? '<br>Średnie natężenie: ' +
        wyniki.filter(x => x.natezenie != null).map(x => esc(x.s.nazwa) + ' ' + zaokr(x.natezenie, 1)).join(' · ') : ''}
    </p>
  </div>`;
}

const BLOKI_PORY = [
  { id: 'p1', nazwa: '6–9',   od: 6,  do: 9 },
  { id: 'p2', nazwa: '9–12',  od: 9,  do: 12 },
  { id: 'p3', nazwa: '12–15', od: 12, do: 15 },
  { id: 'p4', nazwa: '15–18', od: 15, do: 18 },
  { id: 'p5', nazwa: '18–21', od: 18, do: 21 },
  { id: 'p6', nazwa: '21–6',  od: 21, do: 30 }
];

function macierz(dane, zmiany) {
  const kolumny = filtry.osMacierzy === 'szop'
    ? KONF.szop.map(s => ({ id: s.id, nazwa: s.nazwa }))
    : BLOKI_PORY.map(p => ({ id: p.id, nazwa: p.nazwa }));

  function kolumnyWpisu(w) {
    if (filtry.osMacierzy === 'szop') return (w.szop || []).map(c => c.id);
    let g = new Date(w.ts).getHours();
    const blok = BLOKI_PORY.find(p => (g >= p.od && g < p.do) || (p.do > 24 && (g >= p.od || g + 24 < p.do)));
    return blok ? [blok.id] : [];
  }

  const wiersze = {};
  dane.forEach(w => {
    const g = kluczDzialania(w);
    if (!g) return;
    if (!wiersze[g.klucz]) {
      wiersze[g.klucz] = { nazwa: g.nazwa, komorki: {}, oceny: [], n: 0 };
      kolumny.forEach(k => { wiersze[g.klucz].komorki[k.id] = []; });
    }
    const wiersz = wiersze[g.klucz];
    wiersz.n++;
    if (w.ocena) {
      const o = KONF.ocenaDzialania.find(x => x.id === w.ocena);
      if (o) wiersz.oceny.push(o.waga);
    }
    const delta = zmiany[w.id];
    if (delta == null) return;
    kolumnyWpisu(w).forEach(kid => {
      if (wiersz.komorki[kid]) wiersz.komorki[kid].push(delta);
    });
  });

  const lista = Object.values(wiersze).sort((a, b) => b.n - a.n);
  if (!lista.length) {
    return `<div class="pusty-stan"><strong>Jeszcze nic tu nie ma</strong>
      Macierz potrzebuje wpisów z wypełnionym polem „Co robiłem” oraz kolejnego wpisu w ciągu
      ${KONF.analiza.oknoZmianyBateriiGodz} h, żeby zmierzyć zmianę baterii.</div>`;
  }

  const min = KONF.analiza.minProbek;
  const wszystkieDelty = lista.flatMap(w => Object.values(w.komorki).flat());
  const skala = Math.max(10, ...wszystkieDelty.map(Math.abs));

  function komorka(delty) {
    if (delty.length < min) return `<td class="pusto" title="${delty.length} z ${min} wymaganych próbek">—</td>`;
    const sr = delty.reduce((a, b) => a + b, 0) / delty.length;
    const sila = Math.min(1, Math.abs(sr) / skala);
    const bazowy = sr >= 0 ? '#3F7F5E' : '#A9463C';
    const tlo = przygas(bazowy, 1 - (0.25 + sila * 0.75));
    const kolorTekstu = sila > 0.5
      ? '#FFFFFF'
      : (czyCiemnyMotyw() ? '#E2E5E1' : (sr >= 0 ? '#22463A' : '#5A231E'));
    return `<td style="background:${tlo};color:${kolorTekstu}" title="${ile(delty.length, 'wpis', 'wpisy', 'wpisów')}">${zeZnakiem(sr)}</td>`;
  }

  return `<div class="macierz-otoczka"><table class="macierz">
    <thead><tr>
      <th class="wiersz-nag">Działanie</th>
      ${kolumny.map(k => `<th>${esc(k.nazwa)}</th>`).join('')}
      <th>ocena</th>
    </tr></thead>
    <tbody>
      ${lista.map(w => `<tr>
        <th class="wiersz-nag">${esc(w.nazwa)} <span style="color:var(--slaby);font-family:var(--mono);font-size:11px">×${w.n}</span></th>
        ${kolumny.map(k => komorka(w.komorki[k.id])).join('')}
        <td class="pusto" style="background:none">${w.oceny.length
          ? (w.oceny.reduce((a, b) => a + b, 0) / w.oceny.length > 0.33 ? '✓'
            : w.oceny.reduce((a, b) => a + b, 0) / w.oceny.length < -0.33 ? '✗' : '·')
          : '—'}</td>
      </tr>`).join('')}
    </tbody>
  </table></div>`;
}

/* ===== widok: czerwone flagi ===== */

function rysujFlagi() {
  const wszystkie = Magazyn.wpisy();
  const zFlaga = wszystkie.filter(w => w.czerwonaFlaga);

  if (!wszystkie.length) {
    $('#widok').innerHTML = `<div class="pusty-stan"><strong>Brak wpisów</strong>
      Ta zakładka pokaże wzory czerwonych flag, gdy zaczniesz notować.</div>`;
    return;
  }
  if (!zFlaga.length) {
    $('#widok').innerHTML = `<div class="pusty-stan"><strong>Żadnej czerwonej flagi — na razie</strong>
      Dobrze. Gdy przy którymś wpisie zaznaczysz „Tak, widziałem”, tutaj pojawi się rozkład:
      o której godzinie, jak często i które sygnały wracają.</div>`;
    return;
  }

  const udzial = zaokr(zFlaga.length / wszystkie.length * 100);

  /* rozkład godzinowy */
  const wgGodz = {};
  zFlaga.forEach(w => { const g = new Date(w.ts).getHours(); wgGodz[g] = (wgGodz[g] || 0) + 1; });
  const szczyt = Object.entries(wgGodz).sort((a, b) => b[1] - a[1])[0];

  /* które sygnały */
  const wgSygnalu = {};
  zFlaga.forEach(w => (w.flagi || []).forEach(f => { wgSygnalu[f] = (wgSygnalu[f] || 0) + 1; }));
  const sygnaly = Object.entries(wgSygnalu).sort((a, b) => b[1] - a[1]);
  const maksSygnal = sygnaly.length ? sygnaly[0][1] : 1;

  /* rozkład dzienny — ostatnie 14 dni */
  const dni = [];
  const dzis = new Date(); dzis.setHours(0, 0, 0, 0);
  for (let i = 13; i >= 0; i--) {
    const d = new Date(dzis); d.setDate(d.getDate() - i);
    const iso = naDate(d);
    dni.push({ iso, etykieta: d.getDate() + '.' + dwie(d.getMonth() + 1),
               dzien: DNI_TYGODNIA[d.getDay()].slice(0, 2),
               n: zFlaga.filter(w => w.ts.slice(0, 10) === iso).length });
  }
  const maksDzien = Math.max(1, ...dni.map(d => d.n));

  /* dni tygodnia */
  const wgTyg = [0, 0, 0, 0, 0, 0, 0];
  zFlaga.forEach(w => { wgTyg[new Date(w.ts).getDay()]++; });
  const kolejnoscTyg = [1, 2, 3, 4, 5, 6, 0];
  const maksTyg = Math.max(1, ...wgTyg);

  /* stan przy fladze: bateria i najczęstszy czynnik */
  const baterie = zFlaga.map(w => w.bateria).filter(b => b != null);
  const srBat = baterie.length ? zaokr(baterie.reduce((a, b) => a + b, 0) / baterie.length) : null;
  const wgSzop = {};
  zFlaga.forEach(w => (w.szop || []).forEach(c => { wgSzop[c.id] = (wgSzop[c.id] || 0) + 1; }));
  const szopSort = Object.entries(wgSzop).sort((a, b) => b[1] - a[1]);

  $('#widok').innerHTML = `
    <div class="siatka3">
      <div class="karta metryka">
        <h3>Ile</h3>
        <p class="liczba-duza">${zFlaga.length}</p>
        <p class="pod">${zFlaga.length === 1 ? 'raz' : 'razy'} na ${ile(wszystkie.length, 'wpis', 'wpisy', 'wpisów')} · ${udzial}%</p>
      </div>
      <div class="karta metryka">
        <h3>Kiedy najczęściej</h3>
        <p class="liczba-duza">${szczyt[0]}:00</p>
        <p class="pod">tu wybucha najczęściej — ${szczyt[1]}×</p>
      </div>
      <div class="karta metryka">
        <h3>Stan przy fladze</h3>
        <p class="liczba-duza ${srBat != null && srBat < 40 ? 'ujemny' : ''}">${srBat != null ? srBat : '—'}</p>
        <p class="pod">średnia bateria${szopSort.length ? ' · najczęściej: ' + esc(kategoriaSzop(szopSort[0][0]).nazwa) : ''}</p>
      </div>
    </div>

    <div class="karta">
      <h2>O której godzinie</h2>
      <p class="wskazowka">Rozkład czerwonych flag w ciągu doby — ze wszystkich wpisów, nie tylko z zakresu.</p>
      ${histogramFlag(wgGodz)}
    </div>

    <div class="siatka2">
      <div class="karta">
        <h2>Które sygnały wracają</h2>
        ${sygnaly.length ? sygnaly.map(([f, n]) => `
          <div class="paskowy">
            <span class="nazwa" style="width:auto;flex:1">${esc(f)}</span>
            <span class="tor" style="max-width:120px"><i style="width:${zaokr(n / maksSygnal * 100)}%;background:var(--alarm)"></i></span>
            <span class="wart">${n}×</span>
          </div>`).join('') : '<p class="wskazowka">Flagi zaznaczone bez wskazania konkretnego sygnału.</p>'}
      </div>

      <div class="karta">
        <h2>Które dni tygodnia</h2>
        ${kolejnoscTyg.map(d => `
          <div class="paskowy">
            <span class="nazwa" style="width:92px">${DNI_TYGODNIA[d]}</span>
            <span class="tor"><i style="width:${zaokr(wgTyg[d] / maksTyg * 100)}%;background:${d === 0 || d === 6 ? 'var(--akcent)' : 'var(--alarm)'}"></i></span>
            <span class="wart">${wgTyg[d] || ''}</span>
          </div>`).join('')}
      </div>
    </div>

    <div class="karta">
      <h2>Ostatnie 14 dni</h2>
      <p class="wskazowka">Czy flag ostatnio przybywa, czy ubywa.</p>
      ${histogramDni(dni, maksDzien)}
    </div>
  `;
}

function histogramFlag(wgGodz) {
  const W = 720, H = 200, mL = 30, mR = 16, mT = 14, mB = 30;
  const szerWykr = W - mL - mR, wysWykr = H - mT - mB;
  const godziny = Object.keys(wgGodz).map(Number);
  const odG = Math.min(...godziny), doG = Math.max(...godziny);
  const rozpietosc = Math.max(doG - odG, 1) + 1;
  const szerKol = szerWykr / rozpietosc;
  const maks = Math.max(...Object.values(wgGodz));
  const gornaOs = Math.max(2, maks);

  let out = `<div class="wykres-otoczka"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Rozkład godzinowy czerwonych flag">`;
  for (let i = 0; i <= gornaOs; i++) {
    if (gornaOs > 6 && i % 2) continue;
    const yy = mT + wysWykr - (i / gornaOs) * wysWykr;
    out += `<line x1="${mL}" y1="${yy}" x2="${W - mR}" y2="${yy}" stroke="var(--linia)" stroke-width="1"/>`;
    out += `<text x="${mL - 6}" y="${yy + 4}" text-anchor="end" font-family="var(--mono)" font-size="10.5" fill="var(--slaby)">${i}</text>`;
  }
  for (let g = odG; g <= doG; g++) {
    const n = wgGodz[g] || 0;
    const x = mL + (g - odG) * szerKol + szerKol / 2;
    const szer = Math.min(28, szerKol * 0.6);
    if (n) {
      const wys = (n / gornaOs) * wysWykr;
      out += `<rect x="${zaokr(x - szer / 2, 1)}" y="${zaokr(mT + wysWykr - wys, 1)}" width="${zaokr(szer, 1)}" height="${zaokr(wys, 1)}" rx="2" fill="var(--alarm)"><title>${g}:00 — ${n}</title></rect>`;
    }
    if (rozpietosc <= 16 || (g - odG) % 2 === 0) {
      out += `<text x="${zaokr(x, 1)}" y="${H - mB + 18}" text-anchor="middle" font-family="var(--mono)" font-size="10.5" fill="var(--slaby)">${g}</text>`;
    }
  }
  out += `<line x1="${mL}" y1="${mT + wysWykr}" x2="${W - mR}" y2="${mT + wysWykr}" stroke="var(--linia-mocna)" stroke-width="1"/>`;
  out += `</svg></div>`;
  return out;
}

function histogramDni(dni, maks) {
  const W = 720, H = 190, mL = 30, mR = 16, mT = 14, mB = 34;
  const szerWykr = W - mL - mR, wysWykr = H - mT - mB;
  const szerKol = szerWykr / dni.length;
  const gornaOs = Math.max(2, maks);
  let out = `<div class="wykres-otoczka"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Czerwone flagi w ostatnich 14 dniach">`;
  for (let i = 0; i <= gornaOs; i++) {
    if (gornaOs > 6 && i % 2) continue;
    const yy = mT + wysWykr - (i / gornaOs) * wysWykr;
    out += `<line x1="${mL}" y1="${yy}" x2="${W - mR}" y2="${yy}" stroke="var(--linia)" stroke-width="1"/>`;
    out += `<text x="${mL - 6}" y="${yy + 4}" text-anchor="end" font-family="var(--mono)" font-size="10.5" fill="var(--slaby)">${i}</text>`;
  }
  dni.forEach((d, idx) => {
    const x = mL + idx * szerKol + szerKol / 2;
    const szer = Math.min(26, szerKol * 0.62);
    if (d.n) {
      const wys = (d.n / gornaOs) * wysWykr;
      out += `<rect x="${zaokr(x - szer / 2, 1)}" y="${zaokr(mT + wysWykr - wys, 1)}" width="${zaokr(szer, 1)}" height="${zaokr(wys, 1)}" rx="2" fill="var(--alarm)"><title>${d.etykieta} — ${d.n}</title></rect>`;
    }
    out += `<text x="${zaokr(x, 1)}" y="${H - mB + 16}" text-anchor="middle" font-family="var(--mono)" font-size="9.5" fill="var(--slaby)">${d.etykieta}</text>`;
    out += `<text x="${zaokr(x, 1)}" y="${H - mB + 27}" text-anchor="middle" font-family="var(--mono)" font-size="9" fill="var(--slaby)">${d.dzien}</text>`;
  });
  out += `<line x1="${mL}" y1="${mT + wysWykr}" x2="${W - mR}" y2="${mT + wysWykr}" stroke="var(--linia-mocna)" stroke-width="1"/>`;
  out += `</svg></div>`;
  return out;
}

/* ===== widok: historia ===== */

function rysujHistoria() {
  const wpisy = Magazyn.wpisy().slice().reverse();
  if (!wpisy.length) {
    $('#widok').innerHTML = `<div class="pusty-stan"><strong>Brak wpisów</strong>
      Historia zapełni się, gdy zapiszesz pierwszy wpis.</div>`;
    return;
  }
  const dniWolne = Magazyn.dniWolne();
  const dni = {};
  wpisy.forEach(w => {
    const d = w.ts.slice(0, 10);
    (dni[d] = dni[d] || []).push(w);
  });

  $('#widok').innerHTML = Object.entries(dni).map(([dzien, lista]) => {
    const wolny = czyWolny(dzien, dniWolne);
    const oznaczony = dniWolne.indexOf(dzien) !== -1;
    return `
    <div class="dzien-naglowek">
      ${ludzkaData(dzien)}
      ${wolny ? '<span class="plakietka">dzień wolny</span>' : ''}
      <button class="przycisk cichy rozdziel" data-wolny="${dzien}" style="font-size:12.5px;padding:4px 10px">
        ${oznaczony ? 'cofnij oznaczenie' : 'oznacz jako wolny'}</button>
    </div>
    <div class="karta" style="padding:12px 16px">
    <table class="historia">
      <thead><tr><th>godz.</th><th>bateria</th><th>SZOP</th><th>flaga</th><th>działanie</th><th></th></tr></thead>
      <tbody>${lista.map(w => {
        const p = poziomBaterii(w.bateria);
        return `<tr>
          <td style="font-family:var(--mono);font-size:12.5px">${naGodzine(new Date(w.ts))}</td>
          <td><span class="plakietka" style="background:${p ? p.kolor : '#888'};color:#FFF">${p ? p.etykieta : w.bateria}</span></td>
          <td>${(w.szop || []).map(c => {
            const k = kategoriaSzop(c.id);
            return `<span style="white-space:nowrap"><i class="kropka-szop" style="background:${k.kolor}"></i>${esc(k.nazwa)}${c.n != null && KONF.natezenie.wlaczone ? ' <span style="font-family:var(--mono);font-size:11px;color:var(--slaby)">' + c.n + (c.potwierdzone ? '' : '?') + '</span>' : ''}</span>`;
          }).join(' ') || '<span style="color:var(--slaby)">—</span>'}</td>
          <td>${w.czerwonaFlaga ? '<span class="plakietka alarm">tak</span>' : '<span style="color:var(--slaby)">—</span>'}</td>
          <td>${esc(w.dzialanie) || '<span style="color:var(--slaby)">—</span>'}
            ${w.ocena ? '<span style="color:var(--slaby);font-size:12px"> · ' + esc((KONF.ocenaDzialania.find(o => o.id === w.ocena) || {}).nazwa || '') + '</span>' : ''}
            ${w.czemu ? '<div style="color:var(--przygaszony);font-size:12.5px;margin-top:3px">' + esc(w.czemu) + '</div>' : ''}
            ${(w.flagi || []).length ? '<div style="color:var(--alarm);font-size:12px;margin-top:3px">' + w.flagi.map(esc).join(' · ') + '</div>' : ''}
          </td>
          <td style="text-align:right"><button class="przycisk cichy grozny" data-usun="${w.id}" style="padding:3px 9px;font-size:12px">usuń</button></td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
  }).join('');

  document.querySelectorAll('[data-usun]').forEach(b => {
    b.addEventListener('click', () => {
      Magazyn.usunWpis(b.dataset.usun);
      rysujHistoria(); odswiezLicznik(); (window.Skroty ? Skroty.komunikat : komunikat)('Usunięto wpis · Ctrl+Z cofa');
    });
  });
  document.querySelectorAll('[data-wolny]').forEach(b => {
    b.addEventListener('click', () => { Magazyn.przelaczDzienWolny(b.dataset.wolny); rysujHistoria(); });
  });
}

/* ===== widok: ustawienia ===== */

function rysujUstawienia() {
  const k = KONF;
  $('#widok').innerHTML = `
    ${!Magazyn.dostepny() ? `<div class="ostrzezenie">
      Ta przeglądarka blokuje zapis lokalny — wpisy przepadną po zamknięciu karty.
      Sprawdź tryb prywatny albo ustawienia plików cookie.</div>` : ''}

    <div class="karta">
      <h2>Czynniki SZOP</h2>
      <p class="wskazowka">Nazwa i kolor. Usunięcie kategorii nie kasuje starych wpisów — przestaną się tylko pokazywać na wykresach.</p>
      <div id="lista-szop">
        ${k.szop.map((s, i) => `<div class="rzad" style="margin-bottom:8px">
          <input type="color" value="${s.kolor}" data-szop-kolor="${i}" style="width:44px;height:38px;padding:2px">
          <input type="text" value="${esc(s.nazwa)}" data-szop-nazwa="${i}" style="flex:1;min-width:150px">
          <button class="przycisk cichy grozny" data-szop-usun="${i}">usuń</button>
        </div>`).join('')}
      </div>
      <button class="przycisk" id="dodaj-szop" style="margin-top:6px">Dodaj czynnik</button>
    </div>

    <div class="karta">
      <h2>Sposób zapisywania</h2>
      <label class="rzad" style="margin-bottom:10px">
        <input type="checkbox" id="wiele-szop" ${k.pozwalajNaWieleSzop ? 'checked' : ''} style="width:auto">
        <span>Pozwalaj zaznaczyć kilka czynników naraz</span>
      </label>
      <label class="rzad" style="margin-bottom:10px">
        <input type="checkbox" id="natezenie-on" ${k.natezenie.wlaczone ? 'checked' : ''} style="width:auto">
        <span>Natężenie 1–${k.natezenie.maks} przy czynniku</span>
      </label>
      <label class="rzad" style="margin-bottom:16px">
        <input type="checkbox" id="tylko-potwierdzone" ${k.natezenie.liczTylkoPotwierdzone ? 'checked' : ''} style="width:auto">
        <span>Do statystyk licz tylko potwierdzone natężenia (pomiń domyślne ${k.natezenie.domyslne})</span>
      </label>
      <div class="siatka2">
        <div>
          <label class="etykieta" for="grupowanie">Domyślne grupowanie działań</label>
          <select id="grupowanie">
            <option value="dzialanie" ${k.analiza.grupowanieDzialan === 'dzialanie' ? 'selected' : ''}>Konkretne czynności</option>
            <option value="tag" ${k.analiza.grupowanieDzialan === 'tag' ? 'selected' : ''}>Zwinięte do tagów</option>
          </select>
        </div>
        <div>
          <label class="etykieta" for="ile-szybkich">Ile podpowiadanych przycisków czynności</label>
          <input type="number" id="ile-szybkich" min="0" max="24" value="${k.analiza.szybkieDzialania}">
        </div>
        <div>
          <label class="etykieta" for="okno-zmiany">Okno pomiaru zmiany baterii (godziny)</label>
          <input type="number" id="okno-zmiany" min="1" max="24" value="${k.analiza.oknoZmianyBateriiGodz}">
        </div>
        <div>
          <label class="etykieta" for="min-probek">Minimum próbek w kratce macierzy</label>
          <input type="number" id="min-probek" min="1" max="20" value="${k.analiza.minProbek}">
        </div>
      </div>
    </div>

    <div class="karta">
      <h2>Listy</h2>
      <div class="siatka2">
        <div>
          <label class="etykieta" for="lista-flagi">Czerwone flagi — jedna na linię</label>
          <textarea id="lista-flagi" style="min-height:200px">${esc(k.czerwoneFlagi.join('\n'))}</textarea>
        </div>
        <div>
          <label class="etykieta" for="lista-tagi">Tagi działań — jeden na linię</label>
          <textarea id="lista-tagi" style="min-height:200px">${esc(k.tagiDzialan.join('\n'))}</textarea>
        </div>
      </div>
    </div>

    <div class="karta">
      <div class="rzad">
        <button class="przycisk glowny" id="zapisz-konf">Zapisz ustawienia</button>
        <button class="przycisk cichy" id="resetuj-konf">Przywróć domyślne</button>
      </div>
    </div>

    <div class="karta">
      <h2>Kopia danych</h2>
      <p class="wskazowka">Dane siedzą tylko w tej przeglądarce. Plik JSON to Twoja kopia zapasowa i sposób
        przeniesienia wpisów na inne urządzenie. CSV otworzysz w arkuszu.</p>
      <div class="rzad">
        <button class="przycisk" id="eksport-json">Pobierz JSON</button>
        <button class="przycisk" id="eksport-csv">Pobierz CSV</button>
        <label class="przycisk" style="cursor:pointer">Wczytaj JSON
          <input type="file" id="import-plik" accept="application/json,.json" class="ukryty"></label>
        <button class="przycisk cichy grozny rozdziel" id="wyczysc-wszystko">Usuń wszystkie dane</button>
      </div>
    </div>
  `;
  podepnijUstawienia();
}

function podepnijUstawienia() {
  const roboczaKonf = JSON.parse(JSON.stringify(KONF));

  document.querySelectorAll('[data-szop-nazwa]').forEach(i => {
    i.addEventListener('input', e => { roboczaKonf.szop[Number(i.dataset.szopNazwa)].nazwa = e.target.value; });
  });
  document.querySelectorAll('[data-szop-kolor]').forEach(i => {
    i.addEventListener('input', e => { roboczaKonf.szop[Number(i.dataset.szopKolor)].kolor = e.target.value; });
  });
  document.querySelectorAll('[data-szop-usun]').forEach(b => {
    b.addEventListener('click', () => {
      roboczaKonf.szop.splice(Number(b.dataset.szopUsun), 1);
      Magazyn.zapiszKonfiguracje(roboczaKonf); KONF = Magazyn.konfiguracja(); rysujUstawienia();
    });
  });
  $('#dodaj-szop').addEventListener('click', () => {
    const n = roboczaKonf.szop.length + 1;
    roboczaKonf.szop.push({ id: 'wlasny' + Date.now().toString(36), nazwa: 'Nowy czynnik ' + n, kolor: '#6B7C93' });
    Magazyn.zapiszKonfiguracje(roboczaKonf); KONF = Magazyn.konfiguracja(); rysujUstawienia();
  });

  $('#zapisz-konf').addEventListener('click', () => {
    roboczaKonf.pozwalajNaWieleSzop = $('#wiele-szop').checked;
    roboczaKonf.natezenie.wlaczone = $('#natezenie-on').checked;
    roboczaKonf.natezenie.liczTylkoPotwierdzone = $('#tylko-potwierdzone').checked;
    roboczaKonf.analiza.oknoZmianyBateriiGodz = Math.max(1, Number($('#okno-zmiany').value) || 4);
    roboczaKonf.analiza.minProbek = Math.max(1, Number($('#min-probek').value) || 2);
    roboczaKonf.analiza.grupowanieDzialan = $('#grupowanie').value;
    roboczaKonf.analiza.szybkieDzialania = Math.max(0, Number($('#ile-szybkich').value) || 0);
    filtry.grupowanie = null;
    roboczaKonf.czerwoneFlagi = $('#lista-flagi').value.split('\n').map(s => s.trim()).filter(Boolean);
    roboczaKonf.tagiDzialan = $('#lista-tagi').value.split('\n').map(s => s.trim()).filter(Boolean);
    roboczaKonf.szop = roboczaKonf.szop.filter(s => s.nazwa.trim());
    Magazyn.zapiszKonfiguracje(roboczaKonf);
    KONF = Magazyn.konfiguracja();
    komunikat('Zapisano ustawienia');
    rysujUstawienia();
  });

  $('#resetuj-konf').addEventListener('click', () => {
    if (!confirm('Przywrócić domyślne ustawienia? Wpisy zostaną nietknięte.')) return;
    Magazyn.resetujKonfiguracje();
    KONF = Magazyn.konfiguracja();
    rysujUstawienia();
    komunikat('Przywrócono domyślne');
  });

  const pobierz = (tresc, nazwa, typ) => {
    const blob = new Blob([tresc], { type: typ });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nazwa;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  $('#eksport-json').addEventListener('click', () =>
    pobierz(Magazyn.eksportJSON(), 'pasek-zdrowia-' + naDate(new Date()) + '.json', 'application/json'));
  $('#eksport-csv').addEventListener('click', () =>
    pobierz('\ufeff' + Magazyn.eksportCSV(), 'pasek-zdrowia-' + naDate(new Date()) + '.csv', 'text/csv;charset=utf-8'));

  $('#import-plik').addEventListener('change', e => {
    const plik = e.target.files[0];
    if (!plik) return;
    const czytnik = new FileReader();
    czytnik.onload = () => {
      const wynik = Magazyn.importJSON(czytnik.result);
      if (!wynik.ok) { komunikat(wynik.blad); return; }
      KONF = Magazyn.konfiguracja();
      odswiezLicznik();
      komunikat('Wczytano ' + ile(wynik.dodane, 'wpis', 'wpisy', 'wpisów') + (wynik.pominiete ? ', pominięto ' + ile(wynik.pominiete, 'duplikat', 'duplikaty', 'duplikatów') : ''));
      rysujUstawienia();
    };
    czytnik.readAsText(plik);
  });

  $('#wyczysc-wszystko').addEventListener('click', () => {
    if (!confirm('Usunąć wszystkie wpisy i ustawienia? Tego się nie cofnie.')) return;
    if (!confirm('Na pewno? Pobierz najpierw kopię JSON, jeśli chcesz ją zachować.')) return;
    Magazyn.wyczyscWszystko();
    KONF = Magazyn.konfiguracja();
    odswiezLicznik();
    rysujUstawienia();
    komunikat('Dane usunięte');
  });
}

/* ===== widok: o stronie ===== */

function rysujOStronie() {
  const o = KONF.oStronie || {};
  const kawa = (o.buyMeACoffee || '').trim();
  const mail = (o.mailUwagi || '').trim();

  $('#widok').innerHTML = `
    <div class="karta jasna" style="max-width:640px">
      <h2>Pomoc</h2>
      <p style="margin-bottom:16px">To narzędzie do obserwowania własnego stanu — poziomu energii,
      czynników SZOP i czerwonych flag przeciążenia. Powstało po to, żeby pomagać, i
      <strong>jest oraz pozostanie darmowe</strong>.</p>

      <h3 style="margin-top:22px">Twoje dane są tylko Twoje</h3>
      <p class="wskazowka" style="font-size:13.5px;line-height:1.6">
        Wpisy są zapisywane wyłącznie w tej przeglądarce, na tym urządzeniu.
        Nie trafiają na żaden serwer — nikt poza Tobą ich nie widzi.
        Oznacza to też dwie rzeczy, o których warto pamiętać: nie zobaczysz ich
        na innym urządzeniu, a wyczyszczenie danych przeglądarki je usunie.
        Dlatego w <button type="button" class="link-tekst" data-idz-ustawienia>Ustawieniach</button>
        jest „Pobierz JSON” — to Twoja kopia zapasowa i sposób przeniesienia wpisów
        na inny sprzęt.</p>

      <h3 style="margin-top:22px">Wspólny komputer?</h3>
      <p class="wskazowka" style="font-size:13.5px;line-height:1.6">
        Jeśli chcesz, żeby strona nie otwierała się od razu każdemu, kto sięgnie po Twoją
        przeglądarkę, rozważ wtyczkę
        <a href="https://addons.mozilla.org/firefox/addon/leechblock-ng/" target="_blank" rel="noopener noreferrer" class="link-tekst">LeechBlock NG</a>
        — pozwala ukryć stronę za hasłem albo limitem. To wygodna zasłona, nie prawdziwe
        szyfrowanie: chroni przed przypadkowym zajrzeniem, nie przed kimś zdeterminowanym.</p>

      ${kawa ? `<h3 style="margin-top:22px">Wsparcie</h3>
      <p style="margin-bottom:12px">Jeśli strona Ci się przydała, możesz postawić kawę.
      To miłe, ale całkowicie dobrowolne — nic za tym nie jest zamknięte.</p>
      <a class="przycisk glowny" href="${esc(kawa)}" target="_blank" rel="noopener noreferrer"
        style="text-decoration:none;display:inline-block">☕ Postaw kawę</a>` : ''}

      ${mail ? `<h3 style="margin-top:26px">Masz uwagi?</h3>
      <p style="margin-bottom:8px">Napisz, co poprawić albo co nie działa. Adres do skopiowania:</p>
      <div class="rzad">
        <code class="adres-kopiuj" id="adres-uwagi">${esc(mail)}</code>
        <button type="button" class="przycisk cichy" id="kopiuj-adres">kopiuj</button>
      </div>` : ''}

      <p class="wskazowka" style="margin-top:26px;font-size:12.5px">
        To narzędzie do obserwowania siebie, nie do diagnozowania. Jeśli coś Cię niepokoi,
        to materiał do rozmowy z człowiekiem, nie wyrok.</p>
    </div>
  `;

  const doUst = $('[data-idz-ustawienia]');
  if (doUst) doUst.addEventListener('click', () => przelacz('ustawienia'));

  const kopiuj = $('#kopiuj-adres');
  if (kopiuj) kopiuj.addEventListener('click', () => {
    const tekst = mail;
    const zrobione = () => komunikat('Skopiowano adres');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(tekst).then(zrobione).catch(() => reczneZaznaczenie());
    } else {
      reczneZaznaczenie();
    }
    function reczneZaznaczenie() {
      const el = $('#adres-uwagi');
      const zakres = document.createRange();
      zakres.selectNodeContents(el);
      const sel = window.getSelection();
      sel.removeAllRanges(); sel.addRange(zakres);
      try { document.execCommand('copy'); komunikat('Skopiowano adres'); }
      catch (e) { komunikat('Zaznacz i skopiuj ręcznie'); }
    }
  });
}

/* ===== router ===== */

function odswiezLicznik() {
  const n = Magazyn.wpisy().length;
  $('#licznik-wpisow').textContent = n ? ile(n, 'wpis', 'wpisy', 'wpisów') : '';
}

/* przerysowuje bieżący widok bez przewijania — po Ctrl+Z / Ctrl+Y */
function odswiezWidok() {
  if (widok === 'wpis') rysujWpis();
  else if (widok === 'dashboard') rysujDashboard();
  else if (widok === 'flagi') rysujFlagi();
  else if (widok === 'historia') rysujHistoria();
  else if (widok === 'ostronie') rysujOStronie();
  else rysujUstawienia();
}

function przelacz(nowy) {
  widok = nowy;
  document.querySelectorAll('nav.zakladki button').forEach(b =>
    b.setAttribute('aria-selected', String(b.dataset.widok === nowy)));
  if (nowy === 'wpis') rysujWpis();
  else if (nowy === 'dashboard') rysujDashboard();
  else if (nowy === 'flagi') rysujFlagi();
  else if (nowy === 'historia') rysujHistoria();
  else if (nowy === 'ostronie') rysujOStronie();
  else rysujUstawienia();
  window.scrollTo({ top: 0 });
}

function start() {
  KONF = Magazyn.konfiguracja();
  document.querySelectorAll('nav.zakladki button').forEach(b =>
    b.addEventListener('click', () => przelacz(b.dataset.widok)));
  odswiezLicznik();
  przelacz('wpis');
  if (window.Skroty) Skroty.init({
    snapshot: () => Magazyn.surowe(),
    restore: tekst => { Magazyn.wczytajSurowe(tekst); KONF = Magazyn.konfiguracja(); odswiezLicznik(); odswiezWidok(); },
    wiersz: 'table.historia tbody tr',
    przycisk: '[data-usun]',
    toast: komunikat
  });
}

document.addEventListener('DOMContentLoaded', start);

})();
