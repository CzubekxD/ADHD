/* ---------------------------------------------------------------
   REJESTR NARZĘDZI — jedno miejsce, z którego korzysta wspólny pasek
   górny (przełącznik narzędzi), strona startowa (pulpit) i synchronizacja.

   NOWE NARZĘDZIE = jeden obiekt na końcu listy:
     id      — krótka nazwa folderu, np. 'woop'
     nazwa   — pełna nazwa w pasku i na kafelku
     znak    — 1–2 litery; zapas, gdy narzędzie nie ma jeszcze ikony
     ikona   — rysunek kreską, wnętrze <svg viewBox="0 0 24 24"> (ścieżki, koła)
     mini    — miniatura ekranu na kafelku: wnętrze <svg viewBox="0 0 220 92">;
               klasy: k (kolor narzędzia), ks (jego obrys), p/ps (karta i jej obrys),
               t/ts (tusz), l (szara kreska), na (tekst na kolorze)
     kolor   — kolor przewodni; wszystkie narzędzia mają 'bursztyn' (jeden akcent na całą stronę)
     wzor    — numer faktury na karcie pulpitu (wspolne/wzory.css); narzędzia różnią się fakturą, nie kolorem
     href    — folder narzędzia względem strony startowej
     opis    — jedno zdanie do menu i kafelka
     nazwaHtml — opcjonalnie: własny, animowany znak nazwy w pasku na stronie narzędzia
     start   — tekst przycisku na kafelku, zanim ktoś zacznie
     pytanie — nagłówek kafelka bez danych (każda karta ma nagłówek w tym samym miejscu)
     klucz   — klucz danych w localStorage (kopia, synchronizacja z Google Drive)
   Widżet na pulpicie (liczba dnia) dopisujesz w wspolne/pulpit.js.
   Paleta (w kolejności przydziału): szalwia, bursztyn, granat, sliwka,
   morski, terakota, oliwka, lupek.
   --------------------------------------------------------------- */
window.NARZEDZIA = [
  { id: 'pasek', nazwa: 'Pasek zdrowia × SZOP', znak: 'PZ', kolor: 'bursztyn', wzor: 14, klucz: 'mcz.dane.v1', href: 'pasek/',
    opis: 'Energia, czynniki SZOP, czerwone flagi i to, co realnie pomaga.',
    start: 'Dodaj pierwszy wpis', pytanie: 'Jak dziś bateria?',
    ikona: '<rect x="2.5" y="7" width="17" height="10" rx="2.5"/><path d="M22 10.5v3M6.5 10.5v3M10 10.5v3M13.5 10.5v3"/>',
    mini: [14, 26, 20, 40, 52, 34, 22, 46, 30, 18, 12].map((h, i) =>
        `<rect class="k" opacity="${(.4 + .08 * (i % 4)).toFixed(2)}" x="${22 + i * 16}" y="${78 - h}" width="10" height="${h}" rx="2"/>`).join('') +
      '<polyline class="ts" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="27,22 43,26 59,24 75,40 91,52 107,46 123,36 139,48 155,40 171,30 187,24"/><circle class="t" cx="187" cy="24" r="3.5"/>' },
  { id: 'tablica', nazwa: 'Tablica z zadaniami', znak: 'TZ', kolor: 'bursztyn', wzor: 17, klucz: 'tablica-scoringowa-v1', href: 'tablica/',
    opis: 'Dzienna tablica zadań z punktacją, plan tygodnia i historia.',
    start: 'Ułóż dzisiejszą tablicę', pytanie: 'Co dziś domkniesz?',
    ikona: '<path d="M4.5 20v-3M9.5 20v-6.5M14.5 20v-10M19.5 20V4"/>',
    mini: [['8', 1, 124], ['3', 0, 96], ['21', 0, 140]].map(([pkt, zrob, w], i) =>
      `<rect class="p ps" x="24" y="${10 + i * 26}" width="172" height="20" rx="5" stroke-width="1"/>` +
      `<rect x="31" y="${15 + i * 26}" width="10" height="10" rx="2.5" class="${zrob ? 'k' : 'p ps'}" stroke-width="1.4"/>` +
      `<rect class="l" x="48" y="${18 + i * 26}" width="${w - 48}" height="4" rx="2"/>` +
      `<rect class="k" x="166" y="${14 + i * 26}" width="24" height="12" rx="6"/>` +
      `<text class="na" x="178" y="${23.5 + i * 26}" text-anchor="middle" font-size="9">${pkt}</text>`).join('') },
  { id: 'plany', nazwa: 'Plany Jeżeli… to…', znak: 'JT', kolor: 'bursztyn', wzor: 13, klucz: 'plany-jezeli-v1', href: 'plany/',
    opis: 'Gotowe ścieżki na trudne momenty, krok po kroku.',
    start: 'Zbuduj pierwszy plan', pytanie: 'Co zrobisz, gdy zrobi się trudno?',
    ikona: '<circle cx="12" cy="5" r="2.2"/><circle cx="6" cy="19" r="2.2"/><circle cx="18" cy="19" r="2.2"/><path d="M12 7.2v2.6c0 2.4-6 2.6-6 6.9M12 9.8c0 2.4 6 2.6 6 6.9"/>',
    mini: '<path class="ks" fill="none" stroke-width="2" d="M86 46 C104 46 104 22 122 22 M86 46 C104 46 104 70 122 70 M178 22 C190 22 190 46 200 46 M178 70 C190 70 190 46 200 46"/>' +
      '<rect class="k" x="22" y="34" width="64" height="24" rx="6"/><text class="na" x="54" y="50" text-anchor="middle" font-size="10">Jeżeli…</text>' +
      '<rect class="p ps" x="122" y="10" width="56" height="24" rx="6" stroke-width="1"/><text class="t" x="150" y="26" text-anchor="middle" font-size="10">tak</text>' +
      '<rect class="p ps" x="122" y="58" width="56" height="24" rx="6" stroke-width="1"/><text class="t" x="150" y="74" text-anchor="middle" font-size="10">nie</text>' +
      '<circle class="k" cx="202" cy="46" r="5"/>' },
  { id: 'woop', nazwa: 'WOOP', znak: 'W', kolor: 'bursztyn', wzor: 4, klucz: 'woop-v1', href: 'woop/',
    // animowany znak W-O-O-P w pasku (style i animacje są w woop/index.html, klasa .brand)
    nazwaHtml: '<b class="c1">W</b><b class="c2">O</b><b class="c3">O</b><b class="c4">P</b>',
    opis: 'Życzenie, efekt, przeszkoda, plan — i codzienny wpis, czy działa.',
    start: 'Przejdź kreator WOOP', pytanie: 'Czego naprawdę chcesz?',
    ikona: '<path d="M2.5 20.5 9.5 10l3.6 5.2 2.2-3 6.2 8.3z"/><path d="M9.5 10V3.5l4.5 1.7-4.5 1.7"/>',
    mini: ['W', 'O', 'O', 'P'].map((l, i) =>
      `<rect x="${22 + i * 46}" y="${22 + (i % 2) * 6}" width="38" height="44" rx="7" class="${i === 3 ? 'k' : 'p ps'}" stroke-width="1"/>` +
      `<text class="${i === 3 ? 'na' : 't'}" x="${41 + i * 46}" y="${51 + (i % 2) * 6}" text-anchor="middle" font-size="17">${l}</text>`).join('') }
];

/* kolory, które zostały dla kolejnych narzędzi */
window.NARZEDZIA_WOLNE_KOLORY = ['morski', 'terakota', 'oliwka', 'lupek']
  .filter(k => !window.NARZEDZIA.some(n => n.kolor === k));

/* znak narzędzia: ikona, a bez niej litery */
window.znakNarzedzia = n => n.ikona
  ? `<svg viewBox="0 0 24 24" aria-hidden="true">${n.ikona}</svg>`
  : String(n.znak || n.nazwa[0]).replace(/[&<>"']/g, '');
