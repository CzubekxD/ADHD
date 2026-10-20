/* ---------------------------------------------------------------
   SYNCHRONIZACJA Z GOOGLE DRIVE — wspólna dla wszystkich narzędzi
   Dane dalej żyją najpierw w przeglądarce (localStorage). Po zalogowaniu
   przez Google każda zmiana trafia też do ukrytego folderu aplikacji
   na Drive tej osoby (zakres drive.appdata — aplikacja nie widzi
   żadnych innych plików). Każde narzędzie = jeden plik <klucz>.json.

   Scalanie: trójstronne (ostatnia wspólna wersja, ta przeglądarka,
   Drive), więc wpis dodany na telefonie i drugi dodany na laptopie
   zostają oba, a usunięcie na jednym urządzeniu usuwa i na drugim.

   Ładowany w <head>, PRZED skryptami narzędzia — podsłuchuje zapisy
   do localStorage, więc narzędzia nie muszą nic wiedzieć o chmurze.
   Przycisk stanu i pozycje menu rysuje we wspólnym pasku górnym.
   --------------------------------------------------------------- */
(function () {
  'use strict';
  const CLIENT_ID = '777740099765-sadip7o73stafnbthm5vmvlo0osfk9le.apps.googleusercontent.com';
  const ZAKRES = 'https://www.googleapis.com/auth/drive.appdata';
  const API = 'https://www.googleapis.com/drive/v3';
  const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
  const K_STAN = 'adhd.chmura', K_TOKEN = 'adhd.chmura.token', K_BAZA = 'adhd.chmura.baza:';
  // klucze danych narzędzi; nowe narzędzie dopisuje swój `klucz` w rejestrze (narzedzia.js).
  // skrzynka-v1: skrzynka na myśli z pulpitu (wspolne/skrzynka.js) — nie jest narzędziem z rejestru
  const DOMYSLNE = ['mcz.dane.v1', 'tablica-scoringowa-v1', 'plany-jezeli-v1', 'woop-v1', 'skrzynka-v1'];
  const OPOZNIENIE = 2500;   // tyle ms po ostatniej zmianie wysyłamy na Drive

  const ls = window.localStorage;
  const orygSet = Storage.prototype.setItem;
  const czytajJSON = (k, z) => { try { const v = ls.getItem(k); return v ? JSON.parse(v) : z; } catch (e) { return z; } };
  const piszWewn = (k, v) => { try { orygSet.call(ls, k, v); } catch (e) {} };
  const usunWewn = k => { try { ls.removeItem(k); } catch (e) {} };

  let stan = czytajJSON(K_STAN, null);         // {email, pliki:{klucz:{id}}}
  const wlaczona = () => !!(stan && stan.wlaczona);
  const zapiszStan = () => piszWewn(K_STAN, JSON.stringify(stan));

  function klucze() {
    const z = (window.NARZEDZIA || []).map(n => n.klucz).filter(Boolean);
    return [...new Set(DOMYSLNE.concat(z))];
  }

  /* ================= SCALANIE ================= */
  const obiekt = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  function rowne(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (!rowne(a[i], b[i])) return false; return true; }
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (const k of ka) if (!Object.prototype.hasOwnProperty.call(b, k) || !rowne(a[k], b[k])) return false;
    return true;
  }
  // element tablicy rozpoznajemy po id (albo dacie) — wtedy da się scalać listy wpisów
  function kluczEl(el) {
    if (obiekt(el)) { for (const p of ['id', 'date', 'data']) if (el[p] != null && typeof el[p] !== 'object') return p + ':' + el[p]; return null; }
    if (el === null || typeof el !== 'object') return 'v:' + JSON.stringify(el);
    return null;
  }
  function mapa(arr) {
    const m = new Map();
    for (const el of arr) { const k = kluczEl(el); if (k == null || m.has(k)) return null; m.set(k, el); }
    return m;
  }
  function scalTablice(b, l, z) {
    const mb = mapa(Array.isArray(b) ? b : []), ml = mapa(l), mz = mapa(z);
    if (!mb || !ml || !mz) return l;                    // nie da się bezpiecznie — wygrywa to urządzenie
    const wynik = [], uzyte = new Set();
    const rozstrzygnij = k => {
      const wL = ml.has(k), wZ = mz.has(k), wB = mb.has(k);
      if (wL && wZ) return { el: scal(wB ? mb.get(k) : undefined, ml.get(k), mz.get(k)) };
      if (wL) return (wB && rowne(mb.get(k), ml.get(k))) ? null : { el: ml.get(k) };   // usunięte na Drive
      if (wZ) return (wB && rowne(mb.get(k), mz.get(k))) ? null : { el: mz.get(k) };   // usunięte tutaj
      return null;
    };
    for (const k of ml.keys()) { uzyte.add(k); const r = rozstrzygnij(k); if (r) wynik.push(r.el); }
    // nowe elementy z Drive wstawiamy za ich poprzednikiem z Drive
    let poprzedni = null, pierwszy = true;
    for (const k of mz.keys()) {
      const naPoczatku = pierwszy; pierwszy = false;
      if (!uzyte.has(k)) {
        uzyte.add(k);
        const r = rozstrzygnij(k);
        if (r) {
          // bez poprzednika: na początek tylko, jeśli na Drive też był pierwszy; inaczej na koniec
          const i = poprzedni != null ? wynik.findIndex(e => kluczEl(e) === poprzedni) : (naPoczatku ? -1 : wynik.length - 1);
          wynik.splice(i + 1, 0, r.el);
          poprzedni = k; continue;
        }
      }
      if (wynik.some(e => kluczEl(e) === k)) poprzedni = k;
    }
    // listy dni (historia po dacie) trzymamy chronologicznie
    const dni = wynik.map(kluczEl);
    if (wynik.length > 1 && dni.every(k => /^(date|data):\d{4}-\d{2}-\d{2}/.test(k))) {
      const rosnaco = l.every((e, i) => i === 0 || kluczEl(l[i - 1]).slice(5) <= kluczEl(e).slice(5));
      if (rosnaco) wynik.sort((a, b) => kluczEl(a).slice(5) < kluczEl(b).slice(5) ? -1 : 1);
    }
    return wynik;
  }
  function scal(b, l, z) {
    if (rowne(l, z)) return l;
    if (b !== undefined && rowne(l, b)) return z;
    if (b !== undefined && rowne(z, b)) return l;
    if (Array.isArray(l) && Array.isArray(z)) return scalTablice(b, l, z);
    if (obiekt(l) && obiekt(z)) {
      const bb = obiekt(b) ? b : {}, w = {};
      const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
      for (const k of Object.keys(l).concat(Object.keys(z).filter(k => !has(l, k)))) {
        const wL = has(l, k), wZ = has(z, k), wB = has(bb, k);
        if (wL && wZ) w[k] = scal(wB ? bb[k] : undefined, l[k], z[k]);
        else if (wL) { if (!(wB && rowne(bb[k], l[k]))) w[k] = l[k]; }
        else if (!(wB && rowne(bb[k], z[k]))) w[k] = z[k];
      }
      return w;
    }
    return l;                                            // sprzeczne zmiany jednej wartości — wygrywa to urządzenie
  }
  // na tekstach JSON; zwraca dokładnie ten sam tekst, jeśli treść się nie zmieniła
  function scalTekst(bT, lT, zT) {
    let b, l, z;
    try { l = JSON.parse(lT); } catch (e) { return zT; }
    try { z = JSON.parse(zT); } catch (e) { return lT; }
    try { b = bT == null ? undefined : JSON.parse(bT); } catch (e) { b = undefined; }
    const w = scal(b, l, z);
    if (rowne(w, l)) return lT;
    if (rowne(w, z)) return zT;
    return JSON.stringify(w);
  }

  /* ================= TOKEN GOOGLE ================= */
  let gis = null, klientTokenu = null;
  function zaladujGIS() {
    if (gis) return gis;
    gis = new Promise((ok, zle) => {
      if (window.google && google.accounts && google.accounts.oauth2) return ok();
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
      s.onload = () => ok(); s.onerror = () => { gis = null; zle(new Error('gis')); };
      document.head.appendChild(s);
    });
    return gis;
  }
  const token = () => { const t = czytajJSON(K_TOKEN, null); return t && t.exp > Date.now() + 60000 ? t.t : null; };
  // musi być wywołane z kliknięcia — Google otwiera okienko logowania
  function zaloguj(pierwszy) {
    return zaladujGIS().then(() => new Promise((ok, zle) => {
      klientTokenu = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID, scope: ZAKRES,
        callback: r => {
          if (r && r.access_token) { piszWewn(K_TOKEN, JSON.stringify({ t: r.access_token, exp: Date.now() + (Number(r.expires_in) || 3600) * 1000 })); ok(r.access_token); }
          else zle(new Error((r && r.error) || 'odmowa'));
        },
        error_callback: e => zle(new Error((e && e.type) || 'okno'))
      });
      const opcje = { prompt: pierwszy ? 'consent' : '' };
      if (stan && stan.email) opcje.login_hint = stan.email;
      klientTokenu.requestAccessToken(opcje);
    }));
  }

  /* ================= DRIVE ================= */
  class BladAuth extends Error {}
  async function api(url, opcje) {
    const t = token();
    if (!t) throw new BladAuth('brak tokenu');
    opcje = opcje || {};
    opcje.headers = Object.assign({ Authorization: 'Bearer ' + t }, opcje.headers || {});
    const r = await fetch(url, opcje);
    if (r.status === 401 || r.status === 403) { usunWewn(K_TOKEN); throw new BladAuth('auth ' + r.status); }
    if (!r.ok) throw new Error('drive ' + r.status);
    return r;
  }
  const lista = async () => {
    const r = await api(API + '/files?spaces=appDataFolder&pageSize=100&fields=files(id,name,modifiedTime)');
    const j = await r.json(), m = {};
    for (const f of j.files || []) if (!m[f.name] || m[f.name].modifiedTime < f.modifiedTime) m[f.name] = f;
    return m;
  };
  const pobierz = async id => (await api(API + '/files/' + id + '?alt=media')).text();
  async function utworz(nazwa, tekst) {
    const g = 'adhd' + Math.random().toString(36).slice(2);
    const cialo = `--${g}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify({ name: nazwa, parents: ['appDataFolder'], mimeType: 'application/json' }) +
      `\r\n--${g}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${tekst}\r\n--${g}--`;
    return (await api(UPLOAD + '/files?uploadType=multipart&fields=id,modifiedTime', { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + g }, body: cialo })).json();
  }
  const nadpisz = async (id, tekst) => (await api(UPLOAD + '/files/' + id + '?uploadType=media&fields=id,modifiedTime',
    { method: 'PATCH', headers: { 'Content-Type': 'application/json; charset=UTF-8' }, body: tekst })).json();

  /* plik na Drive: {adhd:1, rev, historia:[poprzednie rev], tekst} — historia mówi,
     od której wersji pochodzi zawartość, żeby równoległy zapis nie wyglądał jak usunięcie */
  const nowyRev = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  function zapakuj(tekst, historia) {
    const h = [...new Set(historia.filter(Boolean))].slice(-100), rev = nowyRev();
    return { rev, historia: h, tekst, plik: JSON.stringify({ adhd: 1, rev, historia: h, tekst }) };
  }
  function rozpakuj(surowy) {
    try { const o = JSON.parse(surowy); if (o && o.adhd === 1 && typeof o.tekst === 'string') return { rev: o.rev, historia: o.historia || [], tekst: o.tekst }; } catch (e) {}
    return { rev: null, historia: [], tekst: surowy };
  }
  const ustawBaze = (k, w, tekst) => piszWewn(K_BAZA + k, JSON.stringify({ rev: w.rev, historia: w.historia || [], tekst }));

  /* ================= SYNCHRONIZACJA ================= */
  const start = performance.now();
  let interakcja = false, trwa = false, jeszczeRaz = false, blokada = false, timer = 0, ostatnia = 0;
  let oczekujace = false;                 // na Drive są zmiany, których ta karta jeszcze nie pokazuje
  let stanUI = { s: 'wyl' };
  const zdalneCache = {};                 // klucz → {mod, tekst}: nie pobieramy dwa razy tego samego
  addEventListener('pointerdown', () => { interakcja = true; }, { capture: true });
  addEventListener('keydown', () => { interakcja = true; }, { capture: true });

  // zapisy narzędzi do localStorage → wyślij na Drive chwilę po ostatniej zmianie
  Storage.prototype.setItem = function (k, v) {
    if (this === ls && blokada && klucze().includes(k)) return;      // strona zaraz się przeładuje z nowszymi danymi
    orygSet.call(this, k, v);
    if (this === ls && wlaczona() && klucze().includes(k)) zaplanuj();
  };
  function zaplanuj(ms) {
    clearTimeout(timer);
    timer = setTimeout(() => synchronizuj('zmiana'), ms == null ? OPOZNIENIE : ms);
    if (stanUI.s === 'ok') ustawUI({ s: 'czeka-wysylka' });
  }

  async function synchronizuj(powod) {
    if (!wlaczona()) return;
    if (!navigator.onLine) { ustawUI({ s: 'offline' }); return; }
    if (!token()) { ustawUI({ s: 'logowanie' }); return; }
    if (trwa) { jeszczeRaz = true; return; }
    trwa = true; jeszczeRaz = false;
    ustawUI({ s: 'pracuje' });
    const moznaPrzeladowac = powod === 'polacz' || powod === 'wczytaj' || (powod === 'start' && !interakcja && performance.now() - start < 8000);
    let przeladuj = false, noweZDrive = false, zapisano = false;
    try {
      const pliki = await lista();
      stan.pliki = stan.pliki || {};
      for (const k of klucze()) {
        const nazwa = k + '.json';
        const lok = ls.getItem(k);
        const plik = pliki[nazwa];
        const baza = czytajJSON(K_BAZA + k, null);          // {rev, historia, tekst} — ostatnia wspólna wersja
        if (!plik) {
          if (lok != null) { zapisano = true; const w = zapakuj(lok, []); const m = await utworz(nazwa, w.plik); zdalneCache[k] = { mod: m.modifiedTime, plik: w.plik }; ustawBaze(k, w, lok); }
          continue;
        }
        const surowy = zdalneCache[k] && zdalneCache[k].mod === plik.modifiedTime ? zdalneCache[k].plik : await pobierz(plik.id);
        zdalneCache[k] = { mod: plik.modifiedTime, plik: surowy };
        const zdal = rozpakuj(surowy);
        // trójstronnie tylko, gdy wersja na Drive pochodzi od naszej bazy; inaczej (ktoś nadpisał
        // równolegle) scalamy bez bazy — nic nie ginie, najwyżej wróci coś usuniętego
        const potomek = baza && (zdal.rev === baza.rev || zdal.historia.includes(baza.rev));
        const wynik = lok == null ? zdal.tekst : scalTekst(potomek ? baza.tekst : null, lok, zdal.tekst);
        let naDrive = zdal;
        if (wynik !== zdal.tekst || (baza && !potomek)) {
          const w = zapakuj(wynik, zdal.historia.concat(zdal.rev ? [zdal.rev] : [], baza ? baza.historia.concat([baza.rev]) : []));
          const m = await nadpisz(plik.id, w.plik);
          zdalneCache[k] = { mod: m.modifiedTime, plik: w.plik };
          naDrive = w; zapisano = true;
        }
        if (wynik === lok) { ustawBaze(k, naDrive, wynik); continue; }
        // ta przeglądarka musi dostać zmiany z Drive
        if (moznaPrzeladowac) { piszWewn(k, wynik); ustawBaze(k, naDrive, wynik); przeladuj = true; }
        else noweZDrive = true;          // baza zostaje stara — to nadal ostatnia wspólna wersja
      }
      zapiszStan();
      ostatnia = Date.now();
      oczekujace = noweZDrive;
      if (przeladuj) { blokada = true; ustawUI({ s: 'pracuje' }); location.reload(); return; }
      ustawUI(oczekujace ? { s: 'nowe' } : { s: 'ok', czas: new Date() });
      // drugie urządzenie mogło zapisać w tej samej chwili — krótka kontrola naprawia to od razu
      if (zapisano && powod !== 'kontrola') setTimeout(() => synchronizuj('kontrola'), 6000);
      if (oczekujace && window.Skroty && Skroty.komunikat) Skroty.komunikat('Są nowsze dane z innego urządzenia', { akcja: 'Wczytaj', fn: () => synchronizuj('wczytaj') });
    } catch (e) {
      if (e instanceof BladAuth) ustawUI({ s: 'logowanie' });
      else ustawUI({ s: navigator.onLine ? 'blad' : 'offline' });
      console.warn('[chmura]', e);
    } finally {
      trwa = false;
      if (jeszczeRaz && !blokada) zaplanuj(300);
    }
  }

  async function polacz() {
    try {
      ustawUI({ s: 'pracuje' });
      await zaloguj(!(stan && stan.email));
      stan = Object.assign({ pliki: {} }, stan || {}, { wlaczona: true });
      try {
        const r = await api(API + '/about?fields=user(emailAddress)');
        const j = await r.json(); if (j.user && j.user.emailAddress) stan.email = j.user.emailAddress;
      } catch (e) {}
      zapiszStan();
      await synchronizuj('polacz');
    } catch (e) {
      console.warn('[chmura] logowanie', e);
      ustawUI(wlaczona() ? { s: 'logowanie' } : { s: 'wyl' });
      komunikat('Nie udało się połączyć z Google. Spróbuj jeszcze raz.');
    }
  }

  function rozlacz() {
    const t = token();
    if (t && window.google && google.accounts && google.accounts.oauth2) { try { google.accounts.oauth2.revoke(t, () => {}); } catch (e) {} }
    usunWewn(K_TOKEN); usunWewn(K_STAN);
    for (const k of klucze()) usunWewn(K_BAZA + k);
    stan = null;
    ustawUI({ s: 'wyl' });
    komunikat('Rozłączono. Dane zostają w tej przeglądarce i na Twoim Drive.');
  }

  /* ================= WYGLĄD (pasek górny) ================= */
  const IKONA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5z"/><path class="ch-znak" d=""/></svg>';
  const ZNAKI = { ok: 'm9.5 13.5 2 2 3.5-3.5', nowe: 'M12 11v5m-2.5-2.5L12 16l2.5-2.5', 'czeka-wysylka': 'M12 16v-5m-2.5 2.5L12 11l2.5 2.5', logowanie: 'M12 11v2.5m0 2.3v.2', blad: 'M12 11v2.5m0 2.3v.2', offline: 'M9.5 11.5l5 5m0-5-5 5', pracuje: 'M9 13.5h6' };
  const OPIS = {
    ok: s => 'Zapisane na Google Drive' + (s.czas ? ' o ' + s.czas.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : ''),
    'czeka-wysylka': () => 'Zmiany czekają na wysłanie',
    pracuje: () => 'Synchronizuję z Google Drive…',
    nowe: () => 'Są nowsze dane z innego urządzenia. Kliknij, żeby wczytać',
    logowanie: () => 'Kliknij, żeby połączyć z Google Drive',
    offline: () => 'Brak internetu. Zapisuję tylko w tej przeglądarce',
    blad: () => 'Nie udało się zsynchronizować. Kliknij, żeby spróbować ponownie'
  };
  const KROTKO = { logowanie: 'Połącz', nowe: 'Wczytaj', blad: 'Ponów' };

  function ustawUI(s) {
    stanUI = s;
    document.querySelectorAll('[data-chmura]').forEach(rysujPrzycisk);
    document.querySelectorAll('[data-chmura-menu]').forEach(rysujMenu);
  }
  function rysujPrzycisk(slot) {
    if (!wlaczona() || stanUI.s === 'wyl') { slot.innerHTML = ''; return; }
    let b = slot.querySelector('button');
    if (!b) {
      slot.innerHTML = `<button type="button" class="pg-chmura">${IKONA}<span class="ch-tekst"></span></button>`;
      b = slot.querySelector('button');
      b.addEventListener('click', () => {
        const s = stanUI.s;
        if (s === 'logowanie') polacz();
        else if (s === 'nowe') synchronizuj('wczytaj');
        else synchronizuj('reczna');
      });
    }
    const opis = (OPIS[stanUI.s] || OPIS.ok)(stanUI);
    b.dataset.stan = stanUI.s;
    b.title = opis; b.setAttribute('aria-label', opis);
    b.querySelector('.ch-znak').setAttribute('d', ZNAKI[stanUI.s] || '');
    b.querySelector('.ch-tekst').textContent = KROTKO[stanUI.s] || '';
  }
  function rysujMenu(el) {
    const wl = wlaczona();
    el.innerHTML = wl
      ? `<span><b>Synchronizacja włączona</b><small>${stan.email ? esc(stan.email) + ' · ' : ''}Rozłącz to urządzenie</small></span>`
      : `<span><b>Zapisuj na Google Drive</b><small>Te same dane na telefonie i komputerze</small></span>`;
    el.onclick = () => { const m = el.closest('.pg-lista'); if (m) { m.hidden = true; const p = m.previousElementSibling; if (p) p.setAttribute('aria-expanded', 'false'); } wl ? rozlacz() : polacz(); };
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function komunikat(t) {
    if (window.Skroty && Skroty.komunikat) Skroty.komunikat(t);
    else { const s = document.querySelector('[data-chmura] button'); if (s) s.title = t; }
  }

  /* ================= START ================= */
  function uruchom() {
    if (!wlaczona()) { ustawUI({ s: 'wyl' }); return; }
    ustawUI({ s: token() ? 'pracuje' : 'logowanie' });
    setTimeout(() => synchronizuj('start'), 200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', uruchom); else uruchom();
  addEventListener('online', () => synchronizuj('online'));
  addEventListener('offline', () => wlaczona() && ustawUI({ s: 'offline' }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - ostatnia > 60000) synchronizuj('powrot');
    if (document.visibilityState === 'hidden' && timer && stanUI.s === 'czeka-wysylka') { clearTimeout(timer); synchronizuj('zmiana'); }
  });

  window.Chmura = {
    zamontuj: () => ustawUI(stanUI),
    polacz, rozlacz, synchronizuj,
    scal, scalTekst,                      // do testów
    get wlaczona() { return wlaczona(); }
  };
})();
