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

  // zmiana w innej karcie przeglądarki
  addEventListener('storage', e => { if (e.key === KLUCZ) ustaw(czytaj()); });

  window.Cyber = { wlaczony: czytaj, przelacz, zamontuj };
})();
