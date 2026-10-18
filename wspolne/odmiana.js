/* ---------------------------------------------------------------
   ODMIANA PRZEZ LICZBY — wspólna dla wszystkich narzędzi
     odm(5, 'zadanie', 'zadania', 'zadań')   → 'zadań'
     ile(5, 'zadanie', 'zadania', 'zadań')   → '5 zadań'
   Polska reguła: 1 → pierwsza forma; końcówki 2–4 (poza 12–14) → druga;
   reszta (0, 5–21, 25–31, …, 112, 1001…) → trzecia.
   --------------------------------------------------------------- */
(function () {
  'use strict';
  function odm(n, jeden, kilka, wiele) {
    n = Math.abs(Math.trunc(Number(n) || 0));
    if (n === 1) return jeden;
    const j = n % 10, d = n % 100;
    return j >= 2 && j <= 4 && (d < 12 || d > 14) ? kilka : wiele;
  }
  window.odm = odm;
  window.ile = (n, jeden, kilka, wiele) => n + ' ' + odm(n, jeden, kilka, wiele);
})();
