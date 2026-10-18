/* ---------------------------------------------------------------
   REJESTR NARZĘDZI — jedno miejsce, z którego korzysta wspólny pasek
   górny (przełącznik narzędzi) i strona startowa.

   NOWE NARZĘDZIE = jeden obiekt na końcu listy:
     id      — krótka nazwa folderu, np. 'woop'
     nazwa   — pełna nazwa w pasku i na kafelku
     znak    — 1–2 litery na kolorowym kwadracie
     kolor   — następny wolny kolor z palety (lista poniżej)
     href    — folder narzędzia względem strony startowej
     opis    — jedno zdanie do menu i kafelka
     klucz   — klucz danych w localStorage (kopia, synchronizacja z Google Drive)
   Paleta (w kolejności przydziału): szalwia, bursztyn, granat, sliwka,
   morski, terakota, oliwka, lupek.
   --------------------------------------------------------------- */
window.NARZEDZIA = [
  { id: 'pasek',   nazwa: 'Pasek zdrowia × SZOP', znak: 'PZ', kolor: 'szalwia',  klucz: 'mcz.dane.v1', href: 'pasek/',
    opis: 'Energia, czynniki SZOP, czerwone flagi i to, co realnie pomaga.' },
  { id: 'tablica', nazwa: 'Tablica scoringowa',   znak: 'TS', kolor: 'bursztyn', klucz: 'tablica-scoringowa-v1', href: 'tablica/',
    opis: 'Dzienna tablica zadań z punktacją, plan tygodnia i historia.' },
  { id: 'plany',   nazwa: 'Plany Jeżeli… to…',    znak: 'JT', kolor: 'granat',   klucz: 'plany-jezeli-v1', href: 'plany/',
    opis: 'Gotowe ścieżki na trudne momenty, krok po kroku.' },
  { id: 'woop',    nazwa: 'WOOP',                 znak: 'W',  kolor: 'sliwka',   klucz: 'woop-v1', href: 'woop/',
    opis: 'Życzenie, efekt, przeszkoda, plan — i codzienny wpis, czy działa.' }
];

/* kolory, które zostały dla kolejnych narzędzi */
window.NARZEDZIA_WOLNE_KOLORY = ['morski', 'terakota', 'oliwka', 'lupek']
  .filter(k => !window.NARZEDZIA.some(n => n.kolor === k));
