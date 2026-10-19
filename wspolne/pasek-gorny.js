/* ---------------------------------------------------------------
   WSPÓLNY PASEK GÓRNY
   Użycie w narzędziu (po wspolne/narzedzia.js):
     <header class="pg" data-pasek-gorny data-narzedzie="tablica" data-korzen="../"></header>
     <script src="../wspolne/pasek-gorny.js"></script>
   data-narzedzie — id z rejestru (puste na stronie startowej)
   data-korzen    — ścieżka do strony startowej ('../' w narzędziu, './' w korzeniu)

   Pasek pokazuje: kolorowy znak i nazwę narzędzia (klik = lista wszystkich
   narzędzi), przełącznik CYBER i menu ⋯ (kopia danych, skróty, kod).
   Inne narzędzia są pod ręką, ale schowane — żeby nie kusiły w trakcie pracy.
   --------------------------------------------------------------- */
(function () {
  'use strict';
  const IKONA = {
    w_dol: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
    wiecej: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></svg>',
    dom: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11 12 4l8 7"/><path d="M6 10v10h12V10"/></svg>'
  };
  // zgłoszenia: wybór formularza („Błąd” / „Pomysł”) z .github/ISSUE_TEMPLATE/
  const ZGLOS = 'https://github.com/CzubekxD/ADHD/issues/new/choose';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ikonka w karcie przeglądarki: ikona narzędzia na jego kolorze (strona startowa: domek, łupek) */
  const HEX = { szalwia: '#2E6B5E', bursztyn: '#875810', granat: '#2F5591', sliwka: '#74407E',
                morski: '#1D6A80', terakota: '#9A4730', oliwka: '#56631C', lupek: '#4A5868' };
  function ikonaKarty(n) {
    const rysunek = n && n.ikona ? n.ikona : '<path d="M4 11 12 4l8 7"/><path d="M6 10v10h12V10"/>';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="${HEX[n ? n.kolor : 'lupek'] || HEX.lupek}"/>` +
      `<g transform="translate(4 4)" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${rysunek}</g></svg>`;
    let l = document.querySelector('link[rel="icon"]');
    if (!l) { l = document.createElement('link'); l.rel = 'icon'; document.head.appendChild(l); }
    l.type = 'image/svg+xml';
    l.href = 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  function zbuduj(el) {
    const lista = window.NARZEDZIA || [];
    const korzen = el.dataset.korzen || '../';
    const id = el.dataset.narzedzie || '';
    const ja = lista.find(n => n.id === id);
    const de = document.documentElement;
    de.dataset.kolor = ja ? ja.kolor : 'lupek';
    if (ja) de.dataset.narzedzie = ja.id;

    const pozycja = n => `<a class="pg-poz" role="menuitem" href="${esc(korzen + n.href)}" data-kolor="${esc(n.kolor)}" ${n.id === id ? 'aria-current="page"' : ''}>
        <span class="pg-znak" style="background:var(--k-${esc(n.kolor)})">${window.znakNarzedzia ? znakNarzedzia(n) : esc(n.znak)}</span>
        <span><b>${esc(n.nazwa)}</b><small>${esc(n.opis)}</small></span></a>`;

    el.innerHTML = `<div class="pg-in">
      <div class="pg-menu">
        <button class="pg-narzedzie" type="button" aria-haspopup="menu" aria-expanded="false" data-pg="narzedzia">
          ${ja ? `<span class="pg-znak">${window.znakNarzedzia ? znakNarzedzia(ja) : esc(ja.znak)}</span>${ja.nazwaHtml ? `<span class="pg-nazwa brand" aria-label="${esc(ja.nazwa)}">${ja.nazwaHtml}</span>` : `<span class="pg-nazwa">${esc(ja.nazwa)}</span>`}`
               : `<span class="pg-znak">${IKONA.dom}</span><span class="pg-nazwa">Narzędzia</span>`}
          ${IKONA.w_dol}
        </button>
        <div class="pg-lista" role="menu" aria-label="Narzędzia" hidden>
          ${lista.map(pozycja).join('')}
          <div class="pg-sep" role="separator"></div>
          <a class="pg-poz" role="menuitem" href="${esc(korzen)}"><span class="pg-znak" style="background:var(--s-pow-3);color:var(--s-tusz)">${IKONA.dom}</span>
            <span><b>Wszystkie narzędzia</b><small>Strona startowa</small></span></a>
        </div>
      </div>
      <span class="pg-odstep"></span>
      <span data-chmura></span>
      <span data-cyber></span>
      <div class="pg-menu">
        <button class="pg-wiecej" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="Więcej" data-pg="wiecej">${IKONA.wiecej}</button>
        <div class="pg-lista prawa" role="menu" aria-label="Więcej" hidden>
          ${window.Chmura ? '<button class="pg-poz" role="menuitem" type="button" data-chmura-menu></button>' : ''}
          <a class="pg-poz" role="menuitem" href="${esc(korzen)}#kopia"><span><b>Kopia wszystkich danych</b><small>Pobierz albo wczytaj jeden plik dla wszystkich narzędzi</small></span></a>
          <a class="pg-poz" role="menuitem" href="https://github.com/CzubekxD/ADHD" target="_blank" rel="noopener"><span><b>Kod na GitHubie ↗</b><small>Licencja niekomercyjna</small></span></a>
          <a class="pg-poz" role="menuitem" href="${esc(korzen)}prywatnosc.html"><span><b>Prywatność</b><small>Gdzie leżą Twoje dane</small></span></a>
          <a class="pg-poz" role="menuitem" href="${ZGLOS}" target="_blank" rel="noopener"><span><b>Zgłoś błąd / pomysł ↗</b><small>Formularz na GitHubie</small></span></a>
          <div class="pg-sep" role="separator"></div>
          <ul class="pg-skroty" aria-label="Skróty klawiszowe">
            <li><kbd>Ctrl</kbd> + <kbd>Z</kbd> cofa ostatnią zmianę</li>
            <li><kbd>Ctrl</kbd> + <kbd>Y</kbd> ponawia</li>
            <li><kbd>Delete</kbd> usuwa zaznaczony element</li>
          </ul>
        </div>
      </div>
    </div>`;

    // menu: otwieranie, zamykanie (Esc, klik obok), strzałki góra/dół
    const przyciski = el.querySelectorAll('[data-pg]');
    const zamknij = (wyj) => przyciski.forEach(b => { if (b === wyj) return; b.setAttribute('aria-expanded', 'false'); b.nextElementSibling.hidden = true; });
    przyciski.forEach(b => {
      const menu = b.nextElementSibling;
      b.addEventListener('click', e => {
        e.stopPropagation();
        const otwarte = b.getAttribute('aria-expanded') === 'true';
        zamknij(b);
        b.setAttribute('aria-expanded', String(!otwarte));
        menu.hidden = otwarte;
        if (!otwarte) { const p = menu.querySelector('[aria-current="page"]') || menu.querySelector('.pg-poz'); if (p) p.focus(); }
      });
      menu.addEventListener('keydown', e => {
        const poz = [...menu.querySelectorAll('.pg-poz')];
        const i = poz.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') { e.preventDefault(); (poz[i + 1] || poz[0]).focus(); }
        if (e.key === 'ArrowUp') { e.preventDefault(); (poz[i - 1] || poz[poz.length - 1]).focus(); }
        if (e.key === 'Escape') { e.preventDefault(); zamknij(); b.focus(); }
      });
    });
    document.addEventListener('click', e => { if (!el.contains(e.target)) zamknij(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') zamknij(); });

    ikonaKarty(ja);
    if (window.Cyber && window.Cyber.zamontuj) window.Cyber.zamontuj();
    if (window.Chmura && window.Chmura.zamontuj) window.Chmura.zamontuj();
    // włączenie CYBER: krótki „glitch” animowanego znaku (WOOP)
    if (!el.dataset.burst) {
      el.dataset.burst = '1';
      addEventListener('adhd:skin', e => {
        const b = el.querySelector('.brand');
        if (!b || !(e.detail && e.detail.on)) return;
        b.classList.remove('burst'); b.getBoundingClientRect(); b.classList.add('burst');
        setTimeout(() => b.classList.remove('burst'), 900);
      });
    }
  }

  function start() { document.querySelectorAll('[data-pasek-gorny]').forEach(zbuduj); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.PasekGorny = { odswiez: start };
})();
