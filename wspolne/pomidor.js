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
       dlugosc: ms }                     // długość bieżącego bloku (do tarczy)
   Czas liczymy od końca bloku, a nie co sekundę, więc timer przeżywa przejście do innego
   narzędzia, odświeżenie strony i uśpioną kartę.

   Koniec bloku: krótki dźwięk, powiadomienie z otwartej karty (zgoda pytana przy pierwszym
   starcie) i komunikat na stronie z przyciskiem na następny blok. Kilka otwartych kart:
   koniec obsługuje pierwsza, która go zauważy (pozostałe widzą już nowy stan).

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
  const DLUGOSCI = [15, 25, 45, 60];          // jedno kliknięcie ustawia blok pracy
  const PRZERWA = { 15: 5, 25: 5, 45: 10, 60: 10 };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ile = (n, a, b, c) => window.ile ? window.ile(n, a, b, c) : n + ' ' + (n === 1 ? a : c);   // wspolne/odmiana.js
  const spokojnie = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

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
  function ustawPrace(min) {
    const s = czytaj();
    if (biegnie(s) || zatrzymany(s) || !(min > 0)) return s;
    s.ustawienia.praca = min; s.ustawienia.przerwa = PRZERWA[min] || 5;
    s.dlugosc = dlugoscFazy(s);
    zapisz(s); return s;
  }
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
    return { byla, minut, kiedy, nastepna: s.faza, nastepnaMinut: Math.round(s.dlugosc / MIN) };
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
    return k.byla === 'praca'
      ? { tytul: 'Koniec pracy', opis: `Czas na ${k.nastepnaMinut} min przerwy.`, przycisk: 'Start przerwy' }
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
  // miąższ: wycinek koła od godziny 12 zgodnie ze wskazówkami zegara
  function wycinek(f) {
    const r = 33, cx = 50, cy = 55;
    if (f >= 0.9995) return `<circle class="pm-miazsz" cx="${cx}" cy="${cy}" r="${r}"/>`;
    if (f <= 0) return '';
    const a = f * 2 * Math.PI, x = cx + r * Math.sin(a), y = cy - r * Math.cos(a);
    return `<path class="pm-miazsz" d="M${cx} ${cy}L${cx} ${cy - r}A${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}Z"/>`;
  }
  const LISC = '<path class="pm-lisc" d="M50 22c-3-6-9-8-15-6 5 1 8 3 10 7-6-1-11 1-14 5 6-1 11 0 15 2-2 3-2 7 0 10 2-3 2-7 4-10 4-2 9-3 15-2-3-4-8-6-14-5 2-4 5-6 10-7-6-2-12 0-15 6z"/>';
  const ikona = (f) => `<svg class="pm-ikona" viewBox="0 0 100 100" aria-hidden="true"><circle class="pm-skorka" cx="50" cy="55" r="38"/>${wycinek(f)}${LISC}</svg>`;

  function opisCzasu(s, teraz) {
    const min = Math.ceil(pozostalo(s, teraz) / MIN);
    return (s.faza === 'praca' ? 'Praca' : 'Przerwa') + ': zostało ' + ile(min, 'minuta', 'minuty', 'minut');
  }
  function przyciski(s) {
    if (biegnie(s)) return `<button class="s-przycisk" type="button" data-pm="pauza">Pauza</button><button class="s-przycisk cichy" type="button" data-pm="stop">Stop</button>`;
    if (zatrzymany(s)) return `<button class="s-przycisk glowny" type="button" data-pm="wznow">Wznów</button><button class="s-przycisk cichy" type="button" data-pm="stop">Stop</button>`;
    return `<button class="s-przycisk glowny" type="button" data-pm="start">Start ${s.faza === 'praca' ? 'pracy' : 'przerwy'}</button>` +
      (s.faza === 'przerwa' ? `<button class="s-przycisk cichy" type="button" data-pm="stop">Pomiń</button>` : '');
  }
  function pelny(s, teraz) {
    const wolny = !biegnie(s) && !zatrzymany(s);
    return `<div class="pm" data-faza="${s.faza}">
      <h2 class="pm-naglowek">Pomidor</h2>
      <div class="pm-tarcza" role="img" aria-label="${esc(opisCzasu(s, teraz))}">${ikona(ulamek(s, teraz, spokojnie()))}</div>
      <p class="pm-czas" role="timer" aria-hidden="true">${mmss(pozostalo(s, teraz))}</p>
      <p class="pm-faza">${s.faza === 'praca' ? 'Praca' : 'Przerwa'}${zatrzymany(s) ? ' · pauza' : ''}</p>
      <div class="pm-przyciski">${przyciski(s)}</div>
      ${wolny && s.faza === 'praca' ? `<div class="pm-dlugosci" role="group" aria-label="Długość bloku pracy">${DLUGOSCI.map(m =>
        `<button class="s-chip" type="button" data-pm="dlugosc" data-min="${m}" aria-pressed="${s.ustawienia.praca === m}">${m} min</button>`).join('')}</div>
        <p class="pm-pomoc">Po pracy ${s.ustawienia.przerwa} min przerwy.</p>` : ''}
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
    document.querySelectorAll('.pm-ikona').forEach(svg => {
      const m = svg.querySelector('.pm-miazsz'), nowy = wycinek(f);
      if (m) m.remove();
      if (nowy) svg.querySelector('.pm-skorka').insertAdjacentHTML('afterend', nowy);
    });
    document.querySelectorAll('.pm-tarcza').forEach(el => el.setAttribute('aria-label', opis));
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
      const co = b.dataset.pm;
      if (co === 'start') { odblokujDzwiek(); popros(); schowajKoniec(); start(); }
      else if (co === 'pauza') pauza();
      else if (co === 'wznow') { odblokujDzwiek(); wznow(); }
      else if (co === 'stop') { schowajKoniec(); stop(); }
      else if (co === 'dlugosc') ustawPrace(+b.dataset.min);
      else if (co === 'zamknij-koniec') { schowajKoniec(); return; }
      rysuj();
      // fokus wraca na odpowiednik klikniętego przycisku po przerysowaniu
      const cel = b.closest('[data-pomidor]');
      const nast = cel && (cel.querySelector('[data-pm="pauza"], [data-pm="wznow"], [data-pm="start"]'));
      if (nast && co !== 'dlugosc') nast.focus();
      else if (cel && co === 'dlugosc') { const c = cel.querySelector(`[data-pm="dlugosc"][data-min="${b.dataset.min}"]`); if (c) c.focus(); }
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
    addEventListener('storage', e => { if (!e.key || e.key === KLUCZ) rysuj(); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { tik(); rysuj(); } });
    setInterval(tik, 1000);
    tik();
  }

  window.Pomidor = { KLUCZ, czytaj, start, pauza, wznow, stop, ustawPrace, pozostalo, ulamek, sprawdzKoniec, mmss, wycinek, rysuj, tik, zamontuj, odswiez: rysuj };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', zamontuj); else zamontuj();
})();
