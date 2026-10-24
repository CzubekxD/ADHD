/* ---------------------------------------------------------------
   SKRÓTY KLAWISZOWE — wspólne dla wszystkich narzędzi
   Ctrl+Z            cofa ostatnią zmianę danych
   Ctrl+Y / Ctrl+Shift+Z   ponawia cofniętą zmianę
   Delete            usuwa zaznaczony element (wiersz, węzeł, kartę)
   Na Macu zamiast Ctrl działa Cmd.

   Narzędzie podłącza się raz:
     Skroty.init({
       snapshot: () => tekst,        // cały stan danych jako tekst (JSON)
       restore:  tekst => {...},     // wczytaj stan z tekstu i przerysuj widok
       usun:     () => true/false,   // opcjonalnie: usuń zaznaczony element, true = coś usunięto
       wiersz:   '.selektor',        // opcjonalnie: zamiast usun — element z przyciskiem usuwania
       przycisk: '.selektor',        //   …i ten przycisk w środku (kliknie go Delete)
       toast:    tekst => {...}      // opcjonalnie: własny komunikat narzędzia
     });
   i po każdym zapisie danych woła Skroty.zapisano().

   W polu tekstowym Ctrl+Z i Delete działają jak zwykle (na tekście).
   Wyjątek: jeśli od wejścia w pole nic w nim nie zmieniłeś, Ctrl+Z cofa zmianę danych.
   --------------------------------------------------------------- */
(function () {
  'use strict';
  const MAKS = 100;          // tyle kroków wstecz pamiętamy
  const SCAL_MS = 1200;      // pisanie w polu w tym oknie czasu to jeden krok cofania

  let cfg = null, wstecz = [], naprzod = [], ostatni = null, ostatniCzas = 0, ostatniZPola = false, cicho = false;
  let najechany = null, wartoscPrzyWejsciu = new WeakMap();

  const piszeTekst = el => {
    if (!el) return false;
    if (el.isContentEditable) return true;
    if (el.tagName === 'TEXTAREA') return true;
    if (el.tagName === 'INPUT') {
      const t = (el.type || 'text').toLowerCase();
      return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image'].includes(t);
    }
    return false;
  };

  /* --- komunikat ---
     Jeden wygląd we wszystkich narzędziach (klasa s-komunikat z system.css).
     Komunikat po usunięciu albo zmianie ma przycisk „Cofnij” — na telefonie nie ma Ctrl+Z.
     Tekst kończący się na „· Ctrl+Z cofa” automatycznie dostaje ten przycisk. */
  let toastEl = null, toastT = 0;
  function komunikat(tekst, opcje) {
    opcje = opcje || {};
    tekst = String(tekst || '');
    const OGON = /\s*·\s*Ctrl\+Z cofa\s*$/;
    if (OGON.test(tekst)) { tekst = tekst.replace(OGON, ''); if (!opcje.akcja) opcje = { akcja: 'Cofnij', fn: cofnij }; }
    tekst = tekst.replace(/\s*·\s*Ctrl\+Y ponawia\s*$/, '');
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 's-komunikat skroty-toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = '';
    const span = document.createElement('span'); span.textContent = tekst; toastEl.appendChild(span);
    if (opcje.akcja && typeof opcje.fn === 'function') {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'akcja'; b.textContent = opcje.akcja;
      b.addEventListener('click', () => { toastEl.classList.remove('widoczny'); opcje.fn(); });
      toastEl.appendChild(b);
    }
    toastEl.classList.add('widoczny');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('widoczny'), opcje.akcja ? 6000 : 2400);
  }

  /* --- historia zmian --- */
  function zapisano() {
    if (!cfg || cicho) return;
    let teraz;
    try { teraz = cfg.snapshot(); } catch (e) { return; }
    if (teraz === ostatni) return;
    const czas = Date.now();
    // scalamy tylko pisanie: zapis z kliknięcia albo wysłania formularza to osobny krok, nawet gdy fokus
    // został w polu (Safari nie przenosi fokusu na kliknięty przycisk, więc kosz kleił się z wpisaną myślą)
    const zdarzenie = window.event && window.event.type;
    const zPola = piszeTekst(document.activeElement) && !/^(click|submit|keydown|change)$/.test(zdarzenie || '');
    // kolejne znaki wpisywane w pole łączymy w jeden krok cofania
    const scal = zPola && ostatniZPola && czas - ostatniCzas < SCAL_MS && wstecz.length;
    if (!scal && ostatni != null) {
      wstecz.push(ostatni);
      if (wstecz.length > MAKS) wstecz.shift();
    }
    naprzod = [];
    ostatni = teraz; ostatniCzas = czas; ostatniZPola = zPola;
  }

  function przywroc(tekst) {
    cicho = true;
    try { cfg.restore(tekst); } finally { cicho = false; }
    try { ostatni = cfg.snapshot(); } catch (e) { ostatni = tekst; }
    ostatniZPola = false;
  }

  function cofnij() {
    if (!cfg) return;
    if (!wstecz.length) { komunikat('Nie ma czego cofnąć'); return; }
    const teraz = cfg.snapshot();
    naprzod.push(teraz);
    przywroc(wstecz.pop());
    komunikat('Cofnięto', { akcja: 'Ponów', fn: ponow });
  }

  function ponow() {
    if (!cfg) return;
    if (!naprzod.length) { komunikat('Nie ma czego ponowić'); return; }
    wstecz.push(cfg.snapshot());
    przywroc(naprzod.pop());
    komunikat('Ponowiono');
  }

  /* --- Delete --- */
  function wierszDoUsuniecia() {
    if (!cfg || !cfg.wiersz) return null;
    const a = document.activeElement;
    const zFokusa = a && a !== document.body && a.closest ? a.closest(cfg.wiersz) : null;
    if (zFokusa) return zFokusa;
    if (najechany && document.contains(najechany) && najechany.matches(':hover')) return najechany;
    return null;
  }

  function usun() {
    if (!cfg) return false;
    if (cfg.usun) return !!cfg.usun();
    const w = wierszDoUsuniecia();
    if (!w) return false;
    const b = w.querySelector(cfg.przycisk);
    if (!b) return false;
    b.click();
    return true;
  }

  document.addEventListener('mouseover', e => {
    if (!cfg || !cfg.wiersz || !e.target.closest) return;
    const w = e.target.closest(cfg.wiersz);
    if (w) najechany = w;
  });

  document.addEventListener('focusin', e => {
    const el = e.target;
    if (piszeTekst(el)) wartoscPrzyWejsciu.set(el, el.value);
  });

  document.addEventListener('keydown', e => {
    if (!cfg || e.defaultPrevented || e.altKey) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const k = (e.key || '').toLowerCase();
    const el = document.activeElement;
    const wPolu = piszeTekst(el);
    const poleNieruszone = wPolu && wartoscPrzyWejsciu.get(el) === el.value;

    if (ctrl && k === 'z' && !e.shiftKey) {
      if (wPolu && !poleNieruszone) return;          // zwykłe cofanie tekstu
      e.preventDefault(); cofnij(); return;
    }
    if (ctrl && (k === 'y' || (k === 'z' && e.shiftKey))) {
      if (wPolu && !poleNieruszone) return;
      e.preventDefault(); ponow(); return;
    }
    if (e.key === 'Delete' && !ctrl && !e.shiftKey) {
      if (wPolu && el.value !== '') return;           // w polu z tekstem Delete kasuje znak
      if (usun()) { e.preventDefault(); komunikat('Usunięto', { akcja: 'Cofnij', fn: cofnij }); }
    }
  });

  window.Skroty = {
    init(c) {
      cfg = c; wstecz = []; naprzod = [];
      try { ostatni = c.snapshot(); } catch (e) { ostatni = null; }
    },
    zapisano,
    cofnij,
    ponow,
    komunikat
  };
})();
