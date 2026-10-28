# Narzędzia ADHD — zasady pracy

Publiczny zestaw małych narzędzi dla osób z ADHD (Pasek zdrowia × SZOP, Tablica z zadaniami, Plany Jeżeli… to…, WOOP)
i pulpit dnia na stronie startowej. Statyczne strony na GitHub Pages: bez serwera, bez kroku budowania, dane w
`localStorage` przeglądarki i opcjonalnie w ukrytym folderze aplikacji na Google Drive użytkownika.

**Plan i decyzje produktowe: [`docs/plan.md`](docs/plan.md).** Zanim zaczniesz zadanie z planu, przeczytaj jego sekcję
„Decyzje” i kryteria „gotowe, gdy…” tego PR-a.

## Jak pracujemy

- **Gałąź i PR** dla każdej zmiany; `main` zmienia tylko właściciel, scalając PR. Jeden PR = jeden punkt planu,
  skończony sam w sobie.
- **Polski** wszędzie: nazwy w kodzie, komentarze, teksty w interfejsie, opisy commitów i PR-ów.
- Teksty dla użytkownika: krótkie zdania, nazwy rzeczy tak, jak je zna człowiek, liczby z odmianą przez
  `ile(n, 'zadanie', 'zadania', 'zadań')` z `wspolne/odmiana.js`.
- **Granice produktu** (nie przekraczamy bez zgody właściciela): bez serwera i własnej bazy, za darmo, bez reklam,
  analityki i ciasteczek, bez kont poza logowaniem Google, tylko po polsku.

## Wspólny system (`wspolne/`)

Każde narzędzie i każda nowa funkcja korzysta ze wspólnych modułów, zamiast pisać własne:

- **Rejestr narzędzi** `narzedzia.js`: nazwa, kolor, ikona, miniatura, `klucz` danych. Nowe narzędzie = jeden wpis;
  jego liczba dnia na pulpicie = jedna funkcja w `pulpit.js`.
- **Wygląd** `system.css`: tylko tokeny `--s-*` i `--k-*` (kolory działają w ciemnym i CYBER; jasnego motywu nie ma), komponenty `s-*`,
  cel kliknięcia co najmniej 44 px. `przejscie.css` podpina stare style narzędzi pod tokeny — nowy kod pisz od razu
  na tokenach.
- **Cofnij** `skroty.js`: każda zmiana danych przechodzi przez `Skroty.zapisano()`, więc działa Ctrl+Z, Ctrl+Y, Delete
  i przycisk „Cofnij” w komunikacie.
- **Kopia** `kopia.js`: eksport i import JSON w każdym narzędziu.
- **Synchronizacja** `chmura.js` podsłuchuje zapisy do `localStorage` dla kluczy z rejestru — nowe dane zapisuj pod
  kluczem z rejestru, a synchronizują się same. Elementy list mają `id` (albo `date`), żeby scalanie z dwóch urządzeń
  działało.
- **Pasek górny** `pasek-gorny.js` i **CYBER** `cyber.js` montują się same na każdej stronie.

Linki do `.css` i `.js` piszemy bez numerów wersji; workflow publikacji dopisuje `?v=` sam.

## Zanim otworzysz PR

Sprawdzają to **strażnicy** (`testy/`, workflow `Strażnicy` przy każdym PR):
testy jednostkowe jsdom, każda strona przy 1100 i 390 px w motywie ciemnym i CYBER, w Chromium i Safari (WebKit)
(zero błędów w konsoli, brak poziomego przewijania, zero poważnych naruszeń dostępności axe WCAG AA, kontrast tokenów
≥ 4,5:1, tokeny mieszane w kolorze prostej mieszanki sRGB — `color-mix` pisz `in srgb`, nie `in oklch`),
synchronizacja dwóch urządzeń przez udawany Google Drive (`testy/synchronizacja.js`) i porównanie zrzutów
z gałęzią bazową. PR z czerwonym strażnikiem nie jest gotowy.
Lokalnie: `cd testy && npm ci && npx playwright install chromium && npm run wszystko`.
Ręcznie zostaje: Ctrl+Z cofa nową zmianę. Zrzuty i obrazy różnic są w artefakcie „zrzuty” przebiegu.
