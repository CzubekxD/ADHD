/* ---------------------------------------------------------------
   NOWA WERSJA STRONY — przeładowanie bez Ctrl+F5
   Przy publikacji (.github/workflows/strona.yml) każda strona dostaje numer
   wersji w <meta name="adhd-wersja">, a obok leży wersja.json z numerem
   najnowszej publikacji. Jeśli przeglądarka pokazuje starszą stronę
   z pamięci podręcznej, przeładowuje ją raz, sama.
   Lokalnie (content="dev" albo plik z dysku) nic nie robi.
   --------------------------------------------------------------- */
(function () {
  'use strict';
  const m = document.querySelector('meta[name="adhd-wersja"]');
  const tu = m && m.content;
  if (!tu || tu === 'dev' || location.protocol === 'file:' || !window.fetch) return;
  const skrypt = document.currentScript && document.currentScript.src;
  if (!skrypt) return;
  const adres = skrypt.replace(/wspolne\/wersja\.js.*$/, '') + 'wersja.json';
  fetch(adres, { cache: 'no-store' })
    .then(r => r.ok ? r.json() : null)
    .then(j => {
      if (!j || !j.wersja || j.wersja === tu) return;
      const k = 'adhd.wersja.przeladowano';
      try { if (sessionStorage.getItem(k) === j.wersja) return; sessionStorage.setItem(k, j.wersja); } catch (e) { return; }
      location.reload();
    })
    .catch(() => {});
})();
