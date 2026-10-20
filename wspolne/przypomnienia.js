/* ---------------------------------------------------------------
   PRZYPOMNIENIA W KALENDARZU — strona przypomnienia.html (menu ⋯)
   Trzy codzienne przypomnienia o stałych porach (docs/plan.md, „Przypomnienia w kalendarzu”):
     8:00  „Ułóż tablicę i zrób pierwszy wpis baterii” → Tablica
     14:00 „Wpis baterii”                               → Pasek
     20:00 „Czy plan WOOP zadziałał? Przejrzyj skrzynkę” → WOOP
   Przy każdym: „Dodaj do Google Calendar” (gotowe wydarzenie powtarzane codziennie) i „Pobierz .ics”
   (wydarzenie z RRULE:FREQ=DAILY i alarmem w chwili startu). Opis wydarzenia ma link do narzędzia.

   Nic nie trafia do kalendarza bez kliknięcia i nic nie jest wysyłane: link otwiera Google Calendar
   w przeglądarce, a plik .ics powstaje na urządzeniu. Godziny w localStorage pod 'przypomnienia-v1'
   ({ rano: 'HH:MM', dzien, wieczor }); zmiana godziny przechodzi przez Skroty (Ctrl+Z).
   --------------------------------------------------------------- */
(function () {
  'use strict';
  const KLUCZ = 'przypomnienia-v1';
  const DLUGOSC_MIN = 10;
  const LISTA = [
    { id: 'rano', godz: '08:00', tytul: 'Ułóż tablicę i zrób pierwszy wpis baterii', narzedzie: 'tablica', nazwa: 'Tablica scoringowa' },
    { id: 'dzien', godz: '14:00', tytul: 'Wpis baterii', narzedzie: 'pasek', nazwa: 'Pasek zdrowia × SZOP' },
    { id: 'wieczor', godz: '20:00', tytul: 'Czy plan WOOP zadziałał? Przejrzyj skrzynkę', narzedzie: 'woop', nazwa: 'WOOP' }
  ];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const GODZ = /^([01]\d|2[0-3]):[0-5]\d$/;

  /* ---------- godziny ---------- */
  function czytaj() {
    let z = {};
    try { z = JSON.parse(localStorage.getItem(KLUCZ) || '{}') || {}; } catch (e) {}
    const w = {};
    LISTA.forEach(p => { w[p.id] = GODZ.test(z[p.id]) ? z[p.id] : p.godz; });
    return w;
  }
  function ustaw(id, godz) {
    if (!GODZ.test(godz) || !LISTA.some(p => p.id === id)) return false;
    const w = czytaj(); w[id] = godz;
    try { localStorage.setItem(KLUCZ, JSON.stringify(w)); } catch (e) {}
    if (window.Skroty) Skroty.zapisano();
    return true;
  }

  /* ---------- wydarzenie ---------- */
  // najbliższe wystąpienie: dziś, jeśli godzina jeszcze nie minęła, inaczej jutro (czas lokalny urządzenia)
  function najblizszy(godz, teraz) {
    const [h, m] = godz.split(':').map(Number);
    const d = new Date(teraz == null ? Date.now() : teraz);
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0);
    if (t <= d) t.setDate(t.getDate() + 1);
    return t;
  }
  const lokalnie = d => d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + 'T' + pad(d.getHours()) + pad(d.getMinutes()) + '00';
  const utc = d => d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z';
  const adres = (p, baza) => new URL(p.narzedzie + '/', baza || location.href).href;
  const opis = (p, baza) => `${p.tytul}\n\nOtwórz: ${p.nazwa} — ${adres(p, baza)}`;
  const strefa = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; } };

  // Google Calendar: gotowe wydarzenie do zapisania, powtarzane codziennie
  function linkGoogle(p, godz, teraz, baza) {
    const start = najblizszy(godz, teraz), koniec = new Date(start.getTime() + DLUGOSC_MIN * 60000);
    const q = new URLSearchParams({ action: 'TEMPLATE', text: p.tytul, dates: lokalnie(start) + '/' + lokalnie(koniec),
      details: opis(p, baza), recur: 'RRULE:FREQ=DAILY' });
    const tz = strefa(); if (tz) q.set('ctz', tz);
    return 'https://calendar.google.com/calendar/render?' + q.toString();
  }

  // iCalendar (RFC 5545): tekst z ucieczką, linie zawijane do 75 bajtów, końce linii CRLF
  const tekstIcs = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const bajty = znak => { const c = znak.codePointAt(0); return c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4; };   // UTF-8
  function zawin(linia) {
    const czesci = []; let biezaca = '', dl = 0, limit = 75;
    for (const znak of linia) {
      const b = bajty(znak);
      if (dl + b > limit) { czesci.push(biezaca); biezaca = ''; dl = 0; limit = 74; }   // kolejne linie zaczynają się spacją
      biezaca += znak; dl += b;
    }
    czesci.push(biezaca);
    return czesci.join('\r\n ');
  }
  function ics(p, godz, teraz, baza) {
    const start = najblizszy(godz, teraz);
    const teraz_ = new Date(teraz == null ? Date.now() : teraz);
    const linie = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//czubekxd//Narzedzia ADHD//PL', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:' + p.id + '-' + teraz_.getTime().toString(36) + '@czubekxd.github.io',
      'DTSTAMP:' + utc(teraz_),
      'DTSTART:' + lokalnie(start),                 // czas lokalny („pływający”): 8:00 tam, gdzie jesteś
      'DURATION:PT' + DLUGOSC_MIN + 'M',
      'RRULE:FREQ=DAILY',
      'SUMMARY:' + tekstIcs(p.tytul),
      'DESCRIPTION:' + tekstIcs(opis(p, baza)),
      'URL:' + adres(p, baza),
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + tekstIcs(p.tytul), 'TRIGGER:PT0M', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'
    ];
    return linie.map(zawin).join('\r\n') + '\r\n';
  }
  function pobierz(nazwa, tekst) {
    const url = URL.createObjectURL(new Blob([tekst], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = nazwa; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }

  /* ---------- strona ---------- */
  function rysuj(el) {
    const g = czytaj();
    el.innerHTML = LISTA.map(p => `<section class="pz" data-id="${p.id}">
      <div class="pz-glowa">
        <label class="pz-godz"><span class="pz-etykieta">Godzina</span>
          <input type="time" value="${g[p.id]}" data-pz-godz="${p.id}" aria-label="Godzina przypomnienia: ${esc(p.tytul)}"></label>
        <div><h2 class="pz-tytul">${esc(p.tytul)}</h2><p class="pz-cel">→ <a href="${esc(p.narzedzie)}/">${esc(p.nazwa)}</a> · codziennie</p></div>
      </div>
      <div class="pz-akcje">
        <a class="s-przycisk glowny" data-pz-google href="${esc(linkGoogle(p, g[p.id]))}" target="_blank" rel="noopener">Dodaj do Google Calendar ↗</a>
        <button class="s-przycisk" type="button" data-pz-ics="${p.id}">Pobierz .ics</button>
      </div></section>`).join('');
  }
  function zamontuj() {
    const el = document.querySelector('[data-przypomnienia]');
    if (!el) return;
    rysuj(el);
    el.addEventListener('change', e => {
      const i = e.target.closest('[data-pz-godz]');
      if (!i) return;
      if (!ustaw(i.dataset.pzGodz, i.value)) { rysuj(el); return; }
      // odświeżamy tylko link (pole zostaje z fokusem)
      const p = LISTA.find(x => x.id === i.dataset.pzGodz);
      el.querySelector(`.pz[data-id="${p.id}"] [data-pz-google]`).href = linkGoogle(p, i.value);
      if (window.Skroty) Skroty.komunikat('Zmieniono godzinę. Dodaj przypomnienie jeszcze raz, a stare usuń w kalendarzu · Ctrl+Z cofa');
    });
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-pz-ics]');
      if (!b) return;
      const p = LISTA.find(x => x.id === b.dataset.pzIcs);
      pobierz('przypomnienie-' + p.id + '.ics', ics(p, czytaj()[p.id]));
    });
    if (window.Skroty) Skroty.init({
      snapshot: () => JSON.stringify(czytaj()),
      restore: t => { try { localStorage.setItem(KLUCZ, t); } catch (e) {} rysuj(el); }
    });
    addEventListener('storage', e => { if (e.key === KLUCZ) rysuj(el); });
  }

  window.Przypomnienia = { KLUCZ, LISTA, czytaj, ustaw, najblizszy, linkGoogle, ics, zawin, zamontuj };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', zamontuj); else zamontuj();
})();
