/* ---------------------------------------------------------------
   POMIDOR — timer pracy i przerwy (domyślnie 25 / 5 min)
   Na pulpicie lewa kolumna (telefon: pomidor w pasku nad kartami, timer w panelu od dołu),
   na każdej stronie mały pomidor z czasem w pasku górnym, gdy timer biegnie.
   Wygląd: pomidor, którego miąższ ubywa jak tarcza zegara. Bez tykania.

   Stan: localStorage 'pomidor-v1' — tylko na tym urządzeniu (poza synchronizacją i kopią):
     { ustawienia: { praca, przerwa },  // minuty
       faza: 'praca' | 'przerwa',
       koniec: ts | null,                // biegnie do tej chwili
       pauza: ms | null,                 // zatrzymany, tyle zostało
       dlugosc: ms,                      // długość bieżącego bloku (do tarczy)
       zadanie: { id, nazwa } | null }   // zadanie z dzisiejszej Tablicy, nad którym pracujesz
   Czas liczymy od końca bloku, a nie co sekundę, więc timer przeżywa przejście do innego
   narzędzia, odświeżenie strony i uśpioną kartę.

   Koniec bloku: krótki dźwięk, powiadomienie z otwartej karty (zgoda pytana przy pierwszym
   starcie) i komunikat na stronie z przyciskiem na następny blok. Kilka otwartych kart:
   koniec obsługuje pierwsza, która go zauważy (pozostałe widzą już nowy stan).

   Zadania z Tablicy: przed startem można wybrać zadanie z dzisiejszej tablicy (albo „bez zadania”);
   „▶ 25 min” przy zadaniu w Tablicy rusza pomidora z tym zadaniem (startZadania). Ukończony blok
   pracy dopisuje się do zadania jako pole `pomidory` (liczba) pod kluczem Tablicy, a strona dostaje
   zdarzenie 'adhd:zapis' — Tablica otwarta w tej samej karcie od razu je pokazuje.

   Strona podaje miejsca atrybutami:
     [data-pomidor]          pełny timer (pulpit: kolumna i panel na telefonie)
     [data-pomidor-mini]     mały pomidor z czasem (pasek górny; wspolne/pasek-gorny.js)
     [data-pomidor-otworz]   przycisk otwierający panel (dialog) od dołu
   --------------------------------------------------------------- */
(function () {
  'use strict';
  if (window.Pomidor) return;      // pasek górny dociąga ten plik sam, gdy strona go nie ładuje
  const KLUCZ = 'pomidor-v1';
  const MIN = 60000;
  // długości ustawia człowiek przyciskami −/+ (bez listy gotowych czasów): krok i granice w minutach
  const ZAKRES = { praca: { krok: 5, min: 5, max: 90 }, przerwa: { krok: 1, min: 1, max: 30 } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ile = (n, a, b, c) => window.ile ? window.ile(n, a, b, c) : n + ' ' + (n === 1 ? a : c);   // wspolne/odmiana.js
  const spokojnie = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

  /* ---------- zadania z Tablicy ---------- */
  const TABLICA = 'tablica-scoringowa-v1';
  const pad = n => String(n).padStart(2, '0');
  const dzis = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  function czytajTablice() { try { return JSON.parse(localStorage.getItem(TABLICA) || 'null'); } catch (e) { return null; } }
  // niezrobione zadania z nazwą z dzisiejszej tablicy (tablica z wczoraj jeszcze nie przerzucona → brak)
  function zadaniaNaDzis() {
    const t = czytajTablice();
    if (!t || !t.today || t.today.date !== dzis()) return [];
    return (t.today.tasks || []).filter(z => z && z.id && (z.name || '').trim() && !z.done).map(z => ({ id: z.id, nazwa: z.name.trim() }));
  }
  // ukończony blok pracy → +1 w polu `pomidory` zadania; zwraca nową liczbę albo 0, gdy zadania już nie ma
  function dopiszPomidora(id) {
    const t = czytajTablice();
    const z = t && t.today && (t.today.tasks || []).find(x => x && x.id === id);
    if (!z) return 0;
    z.pomidory = (z.pomidory || 0) + 1;
    try { localStorage.setItem(TABLICA, JSON.stringify(t)); } catch (e) { return 0; }
    try { dispatchEvent(new CustomEvent('adhd:zapis', { detail: { klucz: TABLICA } })); } catch (e) {}
    return z.pomidory;
  }

  /* ---------- stan ---------- */
  const NOWY = () => ({ ustawienia: { praca: 25, przerwa: 5 }, faza: 'praca', koniec: null, pauza: null, dlugosc: 25 * MIN });
  function czytaj() {
    try {
      const s = JSON.parse(localStorage.getItem(KLUCZ) || 'null');
      if (s && s.ustawienia && (s.faza === 'praca' || s.faza === 'przerwa')) return s;
    } catch (e) {}
    return NOWY();
  }
  function zapisz(s) { try { localStorage.setItem(KLUCZ, JSON.stringify(s)); } catch (e) {} }
  const dlugoscFazy = s => (s.faza === 'praca' ? s.ustawienia.praca : s.ustawienia.przerwa) * MIN;
  const biegnie = s => s.koniec != null;
  const zatrzymany = s => s.pauza != null;
  function pozostalo(s, teraz) {
    teraz = teraz == null ? Date.now() : teraz;
    if (biegnie(s)) return Math.max(0, s.koniec - teraz);
    if (zatrzymany(s)) return s.pauza;
    return dlugoscFazy(s);
  }
  // ułamek miąższu (1 = cały pomidor); przy prefers-reduced-motion skokowo co pełną minutę
  function ulamek(s, teraz, skokowo) {
    const dl = biegnie(s) || zatrzymany(s) ? s.dlugosc : dlugoscFazy(s);
    let p = pozostalo(s, teraz);
    if (skokowo) p = Math.ceil(p / MIN) * MIN;
    return dl ? Math.min(1, Math.max(0, p / dl)) : 0;
  }
  const mmss = ms => { const t = Math.ceil(ms / 1000); return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };

  /* ---------- akcje ---------- */
  function start(teraz) {
    const s = czytaj();
    teraz = teraz == null ? Date.now() : teraz;
    s.dlugosc = dlugoscFazy(s);
    s.koniec = teraz + s.dlugosc;
    s.pauza = null;
    zapisz(s); return s;
  }
  function pauza(teraz) {
    const s = czytaj();
    if (!biegnie(s)) return s;
    s.pauza = pozostalo(s, teraz); s.koniec = null;
    zapisz(s); return s;
  }
  function wznow(teraz) {
    const s = czytaj();
    if (!zatrzymany(s)) return s;
    s.koniec = (teraz == null ? Date.now() : teraz) + s.pauza; s.pauza = null;
    zapisz(s); return s;
  }
  function stop() {
    const s = czytaj();
    s.koniec = null; s.pauza = null; s.faza = 'praca'; s.dlugosc = dlugoscFazy(s);
    zapisz(s); return s;
  }
  function ustawZadanie(zad) {
    const s = czytaj();
    s.zadanie = zad && zad.id ? { id: zad.id, nazwa: String(zad.nazwa || '') } : null;
    zapisz(s); return s;
  }
  // „▶ 25 min” w Tablicy (z kliknięcia): nowy blok pracy z tym zadaniem; bieżący blok, jeśli był, kończy się bez zapisu
  function startZadania(zad, teraz) {
    odblokujDzwiek(); popros(); schowajKoniec();
    const s = czytaj();
    s.zadanie = zad && zad.id ? { id: zad.id, nazwa: String(zad.nazwa || '') } : null;
    s.faza = 'praca'; s.koniec = null; s.pauza = null;
    zapisz(s);
    const nowy = start(teraz);
    rysuj(teraz);
    return nowy;
  }
  // długość pracy albo przerwy; w trakcie bloku (i w pauzie) zablokowana, poza granicami przycinana
  function ustawDlugosc(faza, min) {
    const s = czytaj(), z = ZAKRES[faza];
    if (!z || biegnie(s) || zatrzymany(s) || !(min > 0)) return s;
    s.ustawienia[faza] = Math.min(z.max, Math.max(z.min, Math.round(min)));
    s.dlugosc = dlugoscFazy(s);
    zapisz(s); return s;
  }
  const ustawPrace = min => ustawDlugosc('praca', min);
  const ustawPrzerwe = min => ustawDlugosc('przerwa', min);
  /* Koniec bloku: zwraca opis zakończonego bloku albo null. Stan czytamy świeżo z localStorage,
     więc druga karta, która spóźni się o chwilę, widzi już następną fazę i nic nie robi. */
  function sprawdzKoniec(teraz) {
    const s = czytaj();
    teraz = teraz == null ? Date.now() : teraz;
    if (!biegnie(s) || teraz < s.koniec) return null;
    const byla = s.faza, minut = Math.round(s.dlugosc / MIN), kiedy = s.koniec;
    s.faza = byla === 'praca' ? 'przerwa' : 'praca';
    s.koniec = null; s.pauza = null; s.dlugosc = dlugoscFazy(s);
    zapisz(s);
    // najpierw nowy stan (żeby druga karta nie dopisała drugi raz), potem pomidor przy zadaniu
    const zadanie = byla === 'praca' && s.zadanie ? s.zadanie : null;
    const pomidory = zadanie ? dopiszPomidora(zadanie.id) : 0;
    return { byla, minut, kiedy, nastepna: s.faza, nastepnaMinut: Math.round(s.dlugosc / MIN), zadanie: pomidory ? zadanie : null, pomidory };
  }

  /* ---------- dźwięk i powiadomienie ---------- */
  let audio = null;
  // dźwięk wolno odtworzyć dopiero po geście użytkownika — przygotowujemy go przy „Start”
  function odblokujDzwiek() {
    try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); } catch (e) {}
  }
  function dzwiek() {
    try {
      odblokujDzwiek();
      if (!audio) return;
      const t0 = audio.currentTime + 0.02;
      [[784, 0], [1047, 0.18]].forEach(([hz, od]) => {        // dwa krótkie, łagodne tony
        const o = audio.createOscillator(), g = audio.createGain();
        o.type = 'sine'; o.frequency.value = hz;
        g.gain.setValueAtTime(0.0001, t0 + od);
        g.gain.exponentialRampToValueAtTime(0.18, t0 + od + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + od + 0.32);
        o.connect(g).connect(audio.destination); o.start(t0 + od); o.stop(t0 + od + 0.34);
      });
    } catch (e) {}
  }
  const moznaPowiadomic = () => 'Notification' in window && Notification.permission === 'granted';
  function popros() {
    try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch (e) {}
  }
  function tekstKonca(k) {
    const zad = k.zadanie ? `„${k.zadanie.nazwa}”: ${ile(k.pomidory, 'pomidor', 'pomidory', 'pomidorów')}. ` : '';
    return k.byla === 'praca'
      ? { tytul: 'Koniec pracy', opis: `${zad}Czas na ${k.nastepnaMinut} min przerwy.`, przycisk: 'Start przerwy' }
      : { tytul: 'Koniec przerwy', opis: `Gotowe na ${k.nastepnaMinut} min pracy?`, przycisk: 'Start pracy' };
  }
  function powiadom(k) {
    if (!moznaPowiadomic()) return false;
    try {
      const t = tekstKonca(k);
      const n = new Notification(t.tytul, { body: t.opis, tag: 'pomidor', renotify: true });
      n.onclick = () => { try { window.focus(); } catch (e) {} n.close(); };
      return true;
    } catch (e) { return false; }
  }
  // komunikat na stronie zostaje, aż ktoś go zamknie albo ruszy następny blok
  function komunikatKonca(k) {
    const t = tekstKonca(k);
    let el = document.querySelector('.pm-koniec');
    if (!el) {
      el = document.createElement('div');
      el.className = 's-komunikat pm-koniec';
      el.setAttribute('role', 'alert');
      document.body.appendChild(el);
    }
    el.innerHTML = `<span><b>${esc(t.tytul)}.</b> ${esc(t.opis)}</span>
      <button type="button" class="akcja" data-pm="start">${esc(t.przycisk)}</button>
      <button type="button" class="akcja" data-pm="zamknij-koniec" aria-label="Zamknij">✕</button>`;
    const d = document.querySelector('dialog[open]');
    (d || document.body).appendChild(el);          // otwarty panel leży nad stroną
    el.classList.add('widoczny');
  }
  const schowajKoniec = () => { const el = document.querySelector('.pm-koniec'); if (el) el.classList.remove('widoczny'); };

  /* ---------- rysowanie ---------- */
  // naczynie z cieczą: --pm-f = ile bloku zostało (1 pełne → 0 puste); ciecz opada jak spuszczana woda
  // i odsłania tło. Praca w bursztynie, przerwa w błękicie (system.css, sekcja pomidora).
  const ikona = (f) => `<span class="pm-ikona" aria-hidden="true" style="--pm-f:${f.toFixed(3)}"><span class="pm-ciecz"></span></span>`;

  function opisCzasu(s, teraz) {
    const min = Math.ceil(pozostalo(s, teraz) / MIN);
    return (s.faza === 'praca' ? 'Praca' : 'Przerwa') + ': zostało ' + ile(min, 'minuta', 'minuty', 'minut');
  }
  // −/+ dla pracy i przerwy (zablokowane w trakcie bloku, jak w klasycznym timerze)
  function dlugosci(s) {
    const zablok = biegnie(s) || zatrzymany(s) ? ' disabled' : '';
    const wiersz = (faza, nazwa) => { const z = ZAKRES[faza], m = s.ustawienia[faza];
      return `<div class="pm-dl"><span>${nazwa}</span>
        <button class="pm-krok" type="button" data-pm="${faza}" data-krok="-1" aria-label="${nazwa} krócej"${zablok || (m <= z.min ? ' disabled' : '')}>−</button>
        <output class="pm-min" aria-label="${nazwa}: ${ile(m, 'minuta', 'minuty', 'minut')}">${m}</output>
        <button class="pm-krok" type="button" data-pm="${faza}" data-krok="1" aria-label="${nazwa} dłużej"${zablok || (m >= z.max ? ' disabled' : '')}>+</button></div>`; };
    return `<div class="pm-dlugosci" role="group" aria-label="Długość pracy i przerwy w minutach">${wiersz('praca', 'Praca')}${wiersz('przerwa', 'Przerwa')}</div>`;
  }
  function przyciski(s) {
    if (biegnie(s)) return `<button class="s-przycisk" type="button" data-pm="pauza">Pauza</button><button class="s-przycisk cichy" type="button" data-pm="stop">Stop</button>`;
    if (zatrzymany(s)) return `<button class="s-przycisk glowny" type="button" data-pm="wznow">Wznów</button><button class="s-przycisk cichy" type="button" data-pm="stop">Stop</button>`;
    return `<button class="s-przycisk glowny" type="button" data-pm="start">Start ${s.faza === 'praca' ? 'pracy' : 'przerwy'}</button>` +
      (s.faza === 'przerwa' ? `<button class="s-przycisk cichy" type="button" data-pm="stop">Pomiń</button>` : '');
  }
  // przed startem pracy: zadanie z dzisiejszej Tablicy albo „bez zadania” (bez zadań na dziś — nic nie pokazujemy)
  function wyborZadania(s) {
    const lista = zadaniaNaDzis();
    if (!lista.length) return '';
    const wybrane = s.zadanie && lista.some(z => z.id === s.zadanie.id) ? s.zadanie.id : '';
    return `<label class="pm-zadanie"><span>Zadanie z Tablicy</span><select data-pm-zadanie>
      <option value="">bez zadania</option>${lista.map(z => `<option value="${esc(z.id)}"${z.id === wybrane ? ' selected' : ''}>${esc(z.nazwa)}</option>`).join('')}
      </select></label>`;
  }
  function pelny(s, teraz) {
    const wolny = !biegnie(s) && !zatrzymany(s);
    const akcja = biegnie(s) ? 'pauza' : zatrzymany(s) ? 'wznów' : 'start';
    return `<div class="pm" data-faza="${s.faza}">
      <h2 class="pm-naglowek">Pomidor</h2>
      <div class="pm-cialo">
        <button class="pm-tarcza" type="button" data-pm="tarcza" aria-label="${esc(opisCzasu(s, teraz))}. Kliknij: ${akcja}">
          ${ikona(ulamek(s, teraz, spokojnie()))}
          <span class="pm-odczyt"><span class="pm-czas" role="timer" aria-hidden="true">${mmss(pozostalo(s, teraz))}</span>
          <span class="pm-faza">${s.faza === 'praca' ? 'Praca' : 'Przerwa'}${zatrzymany(s) ? ' · pauza' : ''}</span></span>
        </button>
        <div class="pm-stery"><div class="pm-przyciski">${przyciski(s)}</div>${dlugosci(s)}</div>
      </div>
      ${!wolny && s.faza === 'praca' && s.zadanie ? `<p class="pm-zad-nazwa">${esc(s.zadanie.nazwa)}</p>` : ''}
      ${wolny && s.faza === 'praca' ? wyborZadania(s) : ''}
    </div>`;
  }
  function mini(s, teraz, korzen) {
    if (!biegnie(s) && !zatrzymany(s)) return '';
    return `<a class="pg-pomidor" href="${esc(korzen)}" title="${esc(opisCzasu(s, teraz))}" aria-label="Pomidor. ${esc(opisCzasu(s, teraz))}" data-faza="${s.faza}">
      ${ikona(ulamek(s, teraz, spokojnie()))}<span class="pm-mini-czas">${mmss(pozostalo(s, teraz))}</span></a>`;
  }
  // pełne przerysowanie tylko przy zmianie stanu; co sekundę zmieniają się sam czas i tarcza
  function rysuj(teraz) {
    const s = czytaj();
    document.querySelectorAll('[data-pomidor]').forEach(el => { el.innerHTML = pelny(s, teraz); });
    document.querySelectorAll('[data-pomidor-mini]').forEach(el => {
      const h = document.querySelector('[data-pasek-gorny]');
      el.innerHTML = mini(s, teraz, (h && h.dataset.korzen) || './');
    });
    document.querySelectorAll('[data-pomidor-otworz]').forEach(b => {
      const c = b.querySelector('[data-pomidor-czas]');
      if (c) c.textContent = biegnie(s) || zatrzymany(s) ? mmss(pozostalo(s, teraz)) : '';
      b.dataset.biegnie = biegnie(s) ? '1' : '';
    });
  }
  function tik() {
    const k = sprawdzKoniec();
    if (k) { rysuj(); dzwiek(); powiadom(k); komunikatKonca(k); return; }
    const s = czytaj();
    if (!biegnie(s)) return;
    const f = ulamek(s, null, spokojnie()), czas = mmss(pozostalo(s)), opis = opisCzasu(s);
    document.querySelectorAll('.pm-czas, .pm-mini-czas, [data-pomidor-otworz] [data-pomidor-czas]').forEach(el => { if (el.textContent !== czas) el.textContent = czas; });
    document.querySelectorAll('.pm-ikona').forEach(el => el.style.setProperty('--pm-f', f.toFixed(3)));
    document.querySelectorAll('.pm-tarcza').forEach(el => el.setAttribute('aria-label', opis + '. Kliknij: pauza'));
    document.querySelectorAll('.pg-pomidor').forEach(el => { el.title = opis; el.setAttribute('aria-label', 'Pomidor. ' + opis); });
  }

  /* ---------- montowanie ---------- */
  let zamontowany = false;
  function zamontuj() {
    rysuj();
    if (zamontowany) return;
    zamontowany = true;
    document.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('[data-pm]');
      if (!b) return;
      let co = b.dataset.pm;
      // klik w tarczę: start, pauza albo wznowienie — zależnie od stanu
      if (co === 'tarcza') { const s = czytaj(); co = biegnie(s) ? 'pauza' : zatrzymany(s) ? 'wznow' : 'start'; }
      if (co === 'start') {
        odblokujDzwiek(); popros(); schowajKoniec();
        // zadanie zrobione albo usunięte w międzyczasie → blok bez zadania
        const s = czytaj();
        if (s.faza === 'praca' && s.zadanie && !zadaniaNaDzis().some(z => z.id === s.zadanie.id)) ustawZadanie(null);
        start();
      }
      else if (co === 'pauza') pauza();
      else if (co === 'wznow') { odblokujDzwiek(); wznow(); }
      else if (co === 'stop') { schowajKoniec(); stop(); }
      else if (co === 'praca' || co === 'przerwa') { const s = czytaj(); ustawDlugosc(co, s.ustawienia[co] + ZAKRES[co].krok * +b.dataset.krok); }
      else if (co === 'zamknij-koniec') { schowajKoniec(); return; }
      rysuj();
      // fokus wraca na odpowiednik klikniętego przycisku po przerysowaniu
      const cel = b.closest('[data-pomidor]');
      const nast = cel && (cel.querySelector('[data-pm="pauza"], [data-pm="wznow"], [data-pm="start"]'));
      const krok = co === 'praca' || co === 'przerwa';
      if (cel && b.dataset.pm === 'tarcza') { const t = cel.querySelector('[data-pm="tarcza"]'); if (t) t.focus(); }
      else if (nast && !krok) nast.focus();
      else if (cel && krok) { const c = cel.querySelector(`[data-pm="${co}"][data-krok="${b.dataset.krok}"]:not([disabled])`) || cel.querySelector(`[data-pm="${co}"]:not([disabled])`); if (c) c.focus(); }
    });
    document.addEventListener('change', e => {
      const sel = e.target.closest && e.target.closest('[data-pm-zadanie]');
      if (!sel) return;
      ustawZadanie(zadaniaNaDzis().find(z => z.id === sel.value) || null);
      const cel = sel.closest('[data-pomidor]');
      rysuj();
      const nowy = cel && cel.querySelector('[data-pm-zadanie]');
      if (nowy) nowy.focus();
    });
    // panel od dołu (telefon)
    document.querySelectorAll('[data-pomidor-otworz]').forEach(b => {
      const d = document.getElementById(b.getAttribute('aria-controls'));
      if (!d || !d.showModal) return;
      b.addEventListener('click', () => { rysuj(); d.showModal(); b.setAttribute('aria-expanded', 'true'); });
      d.addEventListener('close', () => { b.setAttribute('aria-expanded', 'false'); const k = d.querySelector('.pm-koniec'); if (k) document.body.appendChild(k); });
      d.addEventListener('click', e => { if (e.target === d) d.close(); });
      d.querySelectorAll('[data-pomidor-zamknij]').forEach(z => z.addEventListener('click', () => d.close()));
    });
    addEventListener('storage', e => { if (!e.key || e.key === KLUCZ || e.key === TABLICA) rysuj(); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { tik(); rysuj(); } });
    setInterval(tik, 1000);
    tik();
  }

  window.Pomidor = { KLUCZ, czytaj, start, pauza, wznow, stop, ustawPrace, ustawPrzerwe, ustawDlugosc, ustawZadanie, startZadania, zadaniaNaDzis, pozostalo, ulamek, sprawdzKoniec, mmss, rysuj, tik, zamontuj, odswiez: rysuj };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', zamontuj); else zamontuj();
})();
