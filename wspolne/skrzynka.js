/* ---------------------------------------------------------------
   SKRZYNKA NA MYŚLI — prawa kolumna pulpitu (na telefonie pasek nad kartami)
   Myśl, która krąży po głowie, wrzucasz jednym Enterem; leży na stosie karteczek,
   aż się nią zajmiesz. Nic nie znika samo.

   Dane: localStorage 'skrzynka-v1' = { kartki: [{ id, tekst, dodano }] } (dodano: ISO).
   Klucz jest w synchronizacji (chmura.js) i w „Kopii wszystkiego” na pulpicie.
   Każdy zapis przechodzi przez Skroty.zapisano(), więc Ctrl+Z cofa dodanie i wyrzucenie.

   Starzenie (docs/plan.md, „Skrzynka na myśli”): przez 7 dni karteczka żółknie od bladej
   do nasyconej żółci, od 3. dnia coraz bardziej się gniecie (obrót, zagięty róg, cień),
   a starsza niż 14 dni wraca na wierzch stosu z pytaniem „Co z tym robimy?”.

   Akcje na karteczce: → Tablica, → Plany, → WOOP, ✓ zrobione, kosz. „✓” i kosz mają „Cofnij”.
   Przenoszenie: pulpit otwiera narzędzie z ?skrzynka=<id>. Narzędzie bierze karteczkę przez
   Skrzynka.odbierz(), zapisuje ją u siebie w swoim formacie i dopiero wtedy woła
   Skrzynka.przeniesiono(id) — karteczka znika ze skrzynki po zapisie w narzędziu docelowym.

   Strona podaje miejsca atrybutami:
     form[data-skrzynka-pole]       pole „wrzuć myśl” (może być kilka: kolumna i pasek na telefonie)
     [data-skrzynka-stos]           lista <ol>, w którą rysujemy stos
     [data-skrzynka-licznik]        liczba karteczek (przycisk na telefonie)
     [data-skrzynka-otworz]         przycisk otwierający panel (dialog) od dołu
   --------------------------------------------------------------- */
(function () {
  'use strict';
  const KLUCZ = 'skrzynka-v1';
  const DZIEN = 864e5;
  const MAKS_ZNAKOW = 280;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ile = (n, a, b, c) => window.ile ? window.ile(n, a, b, c) : n + ' ' + (n === 1 ? a : c);   // wspolne/odmiana.js
  const KOSZ = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';
  const PTASZEK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
  // dokąd można przenieść karteczkę: narzędzie (folder) i opis dla czytnika ekranu
  const CELE = [
    { id: 'tablica', nazwa: 'Tablica', opis: 'Zadanie na dziś w Tablicy' },
    { id: 'plany', nazwa: 'Plany', opis: 'Nowy plan Jeżeli… to… z tym wyzwalaczem' },
    { id: 'woop', nazwa: 'WOOP', opis: 'Życzenie w kreatorze WOOP' }
  ];
  let korzen = './';

  /* ---------- dane ---------- */
  function czytaj() {
    try {
      const d = JSON.parse(localStorage.getItem(KLUCZ) || 'null');
      return d && Array.isArray(d.kartki) ? d : { kartki: [] };
    } catch (e) { return { kartki: [] }; }
  }
  function zapisz(d) {
    try { localStorage.setItem(KLUCZ, JSON.stringify(d)); } catch (e) {}
    if (window.Skroty) Skroty.zapisano();
  }
  const noweId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function dodaj(tekst, teraz) {
    tekst = String(tekst || '').trim().slice(0, MAKS_ZNAKOW);
    if (!tekst) return null;
    const d = czytaj();
    const k = { id: noweId(), tekst, dodano: new Date(teraz || Date.now()).toISOString() };
    d.kartki.push(k);
    zapisz(d);
    return k;
  }
  function usun(id) {
    const d = czytaj();
    const przed = d.kartki.length;
    d.kartki = d.kartki.filter(k => k.id !== id);
    if (d.kartki.length === przed) return false;
    zapisz(d);
    return true;
  }

  /* ---------- przenoszenie do narzędzi ----------
     odbierz(): karteczka z ?skrzynka=<id> w adresie; undefined — adres bez karteczki,
     null — karteczki już nie ma (np. przeniesiona w innej karcie). Parametr znika z adresu,
     żeby odświeżenie strony nie przeniosło jej drugi raz. */
  function odbierz() {
    let id = null;
    try { id = new URLSearchParams(location.search).get('skrzynka'); } catch (e) {}
    if (!id) return undefined;
    try { const u = new URL(location.href); u.searchParams.delete('skrzynka'); history.replaceState(history.state, '', u.pathname + u.search + u.hash); } catch (e) {}
    return czytaj().kartki.find(k => k.id === id) || null;
  }
  // po zapisie w narzędziu docelowym; bez Skroty — Ctrl+Z narzędzia dotyczy jego własnych danych
  function przeniesiono(id) {
    const d = czytaj();
    d.kartki = d.kartki.filter(k => k.id !== id);
    try { localStorage.setItem(KLUCZ, JSON.stringify(d)); } catch (e) {}
  }

  /* ---------- starzenie ---------- */
  function wyglad(k, teraz) {
    const dni = Math.max(0, ((teraz == null ? Date.now() : +teraz) - new Date(k.dodano).getTime()) / DZIEN);
    return {
      dni: Math.floor(dni),
      zolc: Math.min(dni / 7, 1),                            // 0 = blada, 1 = nasycona (7. dzień)
      zgniecenie: Math.min(Math.max((dni - 2) / 12, 0), 1),  // rośnie od 3. dnia do 14.
      stara: dni > 14                                        // starsza niż 14 dni
    };
  }
  // na wierzchu stare (najstarsza pierwsza), pod nimi reszta od najnowszej
  function kolejnosc(kartki, teraz) {
    const z = kartki.map(k => ({ k, w: wyglad(k, teraz) }));
    const czas = x => new Date(x.k.dodano).getTime();
    return z.filter(x => x.w.stara).sort((a, b) => czas(a) - czas(b))
      .concat(z.filter(x => !x.w.stara).sort((a, b) => czas(b) - czas(a)));
  }
  const kiedy = dni => dni === 0 ? 'dziś' : dni === 1 ? 'wczoraj' : ile(dni, 'dzień', 'dni', 'dni') + ' temu';
  // stały kierunek obrotu dla karteczki (z id), żeby stos nie „tańczył” przy każdym rysowaniu
  const strona = id => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) | 0; return h & 1 ? 1 : -1; };

  /* ---------- rysowanie ---------- */
  function kartka({ k, w }, i) {
    const obrot = (strona(k.id) * w.zgniecenie * 3).toFixed(2);
    return `<li class="sk-kartka${w.stara ? ' stara' : ''}" tabindex="0" data-id="${esc(k.id)}"
      style="--i:${i};--zolc:${w.zolc.toFixed(3)};--zgn:${w.zgniecenie.toFixed(3)};--obrot:${obrot}deg">
      ${w.stara ? '<p class="sk-pytanie">Co z tym robimy?</p>' : ''}
      <p class="sk-tekst">${esc(k.tekst)}</p>
      <div class="sk-przenies">${CELE.map(c => `<a class="sk-cel" href="${esc(korzen + c.id + '/?skrzynka=' + encodeURIComponent(k.id))}"
        title="${esc(c.opis)}" aria-label="${esc(c.opis)}: ${esc(k.tekst)}">→ ${esc(c.nazwa)}</a>`).join('')}</div>
      <div class="sk-dol"><time datetime="${esc(k.dodano)}">${esc(kiedy(w.dni))}</time>
        <span class="sk-przyciski"><button class="sk-zrobione" type="button" aria-label="Zrobione: ${esc(k.tekst)}" title="Zrobione">${PTASZEK}</button>
        <button class="sk-usun" type="button" aria-label="Wyrzuć: ${esc(k.tekst)}" title="Wyrzuć">${KOSZ}</button></span></div></li>`;
  }
  function rysuj(teraz) {
    const lista = kolejnosc(czytaj().kartki, teraz);
    document.querySelectorAll('[data-skrzynka-stos]').forEach(el => {
      el.innerHTML = lista.map(kartka).join('');
      el.dataset.ile = lista.length;
      el.setAttribute('aria-label', lista.length ? ile(lista.length, 'karteczka', 'karteczki', 'karteczek') : 'Pusto');
    });
    document.querySelectorAll('[data-skrzynka-licznik]').forEach(el => { el.textContent = lista.length; });
    document.querySelectorAll('[data-skrzynka-pusto]').forEach(el => { el.hidden = lista.length > 0; });
    return lista.length;
  }

  /* komunikat z „Cofnij”; otwarty panel (dialog) leży nad całą stroną, więc komunikat przenosimy do niego */
  function komunikat(tekst) {
    if (!window.Skroty) return;
    Skroty.komunikat(tekst);
    const t = document.querySelector('.skroty-toast'), d = document.querySelector('dialog.sk-panel[open]');
    if (t && d && t.parentNode !== d) d.appendChild(t);
  }

  /* ---------- montowanie na stronie ---------- */
  // opcje.korzen — ścieżka do strony startowej (linki „→ narzędzie”), na pulpicie './'
  function zamontuj(opcje) {
    korzen = (opcje && opcje.korzen) || './';
    document.querySelectorAll('form[data-skrzynka-pole]').forEach(f => {
      f.addEventListener('submit', e => {
        e.preventDefault();
        const pole = f.querySelector('input, textarea');
        const k = dodaj(pole.value);
        if (!k) { pole.focus(); return; }
        pole.value = '';
        rysuj();
        komunikat('Wrzucone do skrzynki · Ctrl+Z cofa');
      });
    });

    // ✓ zrobione i kosz: karteczka znika ze stosu, „Cofnij” w komunikacie ją przywraca
    document.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('.sk-usun, .sk-zrobione');
      if (!b) return;
      const zrobione = b.classList.contains('sk-zrobione');
      const li = b.closest('.sk-kartka');
      const nastepna = li.nextElementSibling || li.previousElementSibling;
      const idNast = nastepna && nastepna.dataset.id;
      const stos = li.closest('[data-skrzynka-stos]');
      if (!usun(li.dataset.id)) return;
      rysuj();
      // fokus zostaje w stosie (na sąsiedniej karteczce), żeby klawiaturą dało się dalej porządkować
      const cel = idNast && stos && Array.from(stos.querySelectorAll('.sk-kartka')).find(x => x.dataset.id === idNast);
      if (cel) cel.focus(); else { const p = document.querySelector('form[data-skrzynka-pole] input'); if (p && p.offsetParent) p.focus(); }
      komunikat((zrobione ? 'Zrobione' : 'Wyrzucono karteczkę') + ' · Ctrl+Z cofa');
    });

    // panel od dołu (telefon)
    document.querySelectorAll('[data-skrzynka-otworz]').forEach(b => {
      const d = document.getElementById(b.getAttribute('aria-controls'));
      if (!d || !d.showModal) return;
      b.addEventListener('click', () => { rysuj(); d.showModal(); b.setAttribute('aria-expanded', 'true'); });
      d.addEventListener('close', () => {
        b.setAttribute('aria-expanded', 'false');
        const t = d.querySelector('.skroty-toast'); if (t) document.body.appendChild(t);
      });
      d.addEventListener('click', e => { if (e.target === d) d.close(); });    // klik w tło zamyka
      d.querySelectorAll('[data-skrzynka-zamknij]').forEach(z => z.addEventListener('click', () => d.close()));
    });

    // opcje.skroty === false: strona sama ustawia Ctrl+Z (pulpit cofa też wynik dnia WOOP)
    if (window.Skroty && !(opcje && opcje.skroty === false)) {
      Skroty.init({
        snapshot: () => JSON.stringify(czytaj()),
        restore: t => { try { localStorage.setItem(KLUCZ, t); } catch (e) {} rysuj(); },
        wiersz: '.sk-kartka',
        przycisk: '.sk-usun'
      });
    }
    // dane z innej karty albo z Google Drive; po powrocie na kartę karteczki są o dzień starsze
    addEventListener('storage', e => { if (!e.key || e.key === KLUCZ) rysuj(); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') rysuj(); });
    rysuj();
  }

  window.Skrzynka = { KLUCZ, czytaj, dodaj, usun, wyglad, kolejnosc, rysuj, zamontuj, odbierz, przeniesiono };
})();
