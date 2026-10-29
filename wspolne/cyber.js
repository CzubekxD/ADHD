/* ---------------------------------------------------------------
   MOTYW CYBER — wspólny przełącznik dla wszystkich narzędzi
   Ustawienie leży pod kluczem 'adhd.skin' (wartość 'cyber' albo brak),
   więc włączenie go w jednym narzędziu włącza je wszędzie na tej stronie.
   Skrypt ładujemy w <head>, żeby motyw był ustawiony przed pierwszym rysowaniem.
   Przełącznik pojawia się w każdym elemencie z atrybutem data-cyber.
   --------------------------------------------------------------- */
(function () {
  'use strict';
  const KLUCZ = 'adhd.skin';
  const de = document.documentElement;

  const czytaj = () => { try { return localStorage.getItem(KLUCZ) === 'cyber'; } catch (e) { return false; } };
  // 'off' zamiast usuwania klucza: WOOP odróżnia wtedy „wyłączone” od „jeszcze nie ustawione”
  const zapisz = on => { try { localStorage.setItem(KLUCZ, on ? 'cyber' : 'off'); } catch (e) {} };

  function ustaw(on) {
    if (on) de.dataset.skin = 'cyber'; else delete de.dataset.skin;
    document.querySelectorAll('.skin[data-cyber-btn]').forEach(b => b.setAttribute('aria-checked', String(on)));
  }
  ustaw(czytaj());

  // czcionki motywu: dociągamy raz, w tle
  const font = document.createElement('link');
  font.rel = 'stylesheet';
  font.href = 'https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@600;700&family=Share+Tech+Mono&display=swap';
  document.head.appendChild(font);

  const spokojnie = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

  function przelacz(btn) {
    const on = !czytaj();
    const zastosuj = () => { zapisz(on); ustaw(on); dispatchEvent(new CustomEvent('adhd:skin', { detail: { on } })); };
    if (!document.startViewTransition || spokojnie() || document.hidden || !btn) { zastosuj(); return; }
    // nowy wygląd rozlewa się kołem od przełącznika
    const r = btn.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    de.classList.add('vt-skin');
    const t = document.startViewTransition(zastosuj);
    t.ready.then(() => {
      de.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${R}px at ${x}px ${y}px)`] },
        { duration: 600, easing: 'cubic-bezier(.6,0,.2,1)', pseudoElement: '::view-transition-new(root)' });
    }).catch(() => {});
    t.finished.finally(() => de.classList.remove('vt-skin'));
  }

  function zamontuj() {
    document.querySelectorAll('[data-cyber]').forEach(slot => {
      if (slot.querySelector('[data-cyber-btn]')) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'skin';
      b.setAttribute('data-cyber-btn', '');
      b.setAttribute('role', 'switch');
      b.setAttribute('aria-checked', String(czytaj()));
      b.title = 'Motyw cyberpunk — działa we wszystkich narzędziach';
      b.innerHTML = '<span class="knob" aria-hidden="true"></span>CYBER';
      b.addEventListener('click', () => przelacz(b));
      slot.appendChild(b);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', zamontuj);
  else zamontuj();

  /* Bloki na klikalnym tekście: po najechaniu litery zamieniają się w losowe ░▒▓█
     i wracają na miejsce w przypadkowej kolejności. Tylko w CYBER, tylko z myszą,
     bez animacji przy prefers-reduced-motion. Zmieniamy same węzły tekstu, więc ikony,
     pola i nasłuchiwacze w środku zostają nietknięte. */
  const KLIKALNE = 'a[href],button,[role="button"],[role="tab"],summary,label';
  const BLOKI = '░▒▓█';
  const trwa = new Map(); // element → funkcja kończąca animację

  function tekstyW(el) {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: n => n.nodeValue.trim() && !n.parentElement.closest('input,textarea,select,svg,[contenteditable]')
        ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    });
    const wynik = [];
    while (w.nextNode()) wynik.push(w.currentNode);
    return wynik;
  }

  function bloki(el) {
    if (trwa.has(el)) return;
    const wezly = tekstyW(el);
    if (!wezly.length) return;
    const oryginaly = wezly.map(n => n.nodeValue);
    // każda litera dostaje własny, losowy moment powrotu
    const momenty = oryginaly.map(t => [...t].map(() => 3 + Math.random() * 16 | 0));
    const ostatni = Math.max(...momenty.flat());
    // blokujemy wymiary, żeby bloki o innej szerokości nie przesuwały układu
    // getComputedStyle podaje wymiary zgodne z box-sizing elementu
    const cs = getComputedStyle(el);
    const styl = { width: el.style.width, height: el.style.height };
    if (cs.display !== 'inline') { el.style.width = cs.width; el.style.height = cs.height; }
    let k = 0;
    const koniec = () => {
      clearInterval(licznik);
      wezly.forEach((n, i) => { n.nodeValue = oryginaly[i]; });
      el.style.width = styl.width; el.style.height = styl.height;
      trwa.delete(el);
    };
    const licznik = setInterval(() => {
      if (++k > ostatni || !el.isConnected) return koniec();
      wezly.forEach((n, i) => {
        n.nodeValue = [...oryginaly[i]].map((z, j) =>
          k >= momenty[i][j] || !z.trim() ? z : BLOKI[Math.random() * 4 | 0]).join('');
      });
    }, 28);
    trwa.set(el, koniec);
  }

  document.addEventListener('pointerover', e => {
    if (e.pointerType !== 'mouse' || !czytaj() || spokojnie()) return;
    const el = e.target.closest && e.target.closest(KLIKALNE);
    // tylko przy wejściu w element, nie przy ruchu między jego dziećmi
    if (!el || (e.relatedTarget && el.contains(e.relatedTarget))) return;
    bloki(el);
  });
  // kliknięcie w trakcie animacji: najpierw przywracamy prawdziwy tekst
  document.addEventListener('pointerdown', () => { trwa.forEach(koniec => koniec()); }, true);

  // zmiana w innej karcie przeglądarki
  addEventListener('storage', e => { if (e.key === KLUCZ) ustaw(czytaj()); });

  window.Cyber = { wlaczony: czytaj, przelacz, zamontuj };
})();
