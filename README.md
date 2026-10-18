# ADHD — narzędzia Mateusza

Cztery małe narzędzia do samomonitorowania i ogarniania dnia. Każde to osobna strona statyczna:
żadnego backendu, żadnego konta, dane zostają w przeglądarce.

Strona startowa ze wszystkimi narzędziami: **https://czubekxd.github.io/ADHD/**

| Narzędzie | Otwórz w przeglądarce | Kod |
|---|---|---|
| **Pasek zdrowia × SZOP** — energia, czynniki SZOP, czerwone flagi, regeneracja (opis niżej) | **https://czubekxd.github.io/ADHD/pasek/** | [`pasek/`](pasek/) |
| **Tablica scoringowa** — dzienna tablica zadań z punktacją 1/3/8/21, plan tygodnia, historia; specyfikacja w [`tablica/SPEC.md`](tablica/SPEC.md) | **https://czubekxd.github.io/ADHD/tablica/** | [`tablica/`](tablica/) |
| **Plany Jeżeli… to…** — drzewa kroków na trudne momenty, tryb „Teraz”, ćwiczenia z kart | **https://czubekxd.github.io/ADHD/plany/** | [`plany/`](plany/) |
| **WOOP** — życzenie, efekt, przeszkoda, plan; kreator krok po kroku i codzienny wpis, czy plan działa | **https://czubekxd.github.io/ADHD/woop/** | [`woop/`](woop/) |

Klucze danych w `localStorage` (te same nazwy mają pliki na Google Drive): `mcz.dane.v1` (Pasek), `tablica-scoringowa-v1` (Tablica), `plany-jezeli-v1` (Plany), `woop-v1` (WOOP).

W korzeniu leży `index.html` — **pulpit dnia**: dla każdego narzędzia jedna liczba z dzisiaj (bateria, punkty tablicy,
plany, które zadziałały, dzisiejszy wpis WOOP), jedno zdanie i jeden przycisk. Pulpit tylko czyta dane, zapisuje zawsze
samo narzędzie. Kto nie ma jeszcze danych, widzi kafelki z miniaturami i przyciskiem na start.
Nowe narzędzie dopisujesz w [`wspolne/narzedzia.js`](wspolne/narzedzia.js), a jego liczbę dnia w [`wspolne/pulpit.js`](wspolne/pulpit.js).

Wszystkie narzędzia są pod tym samym adresem `czubekxd.github.io`, ale każde trzyma dane
pod własnym kluczem, więc nie wchodzą sobie w drogę.

## Wspólny wygląd

Wszystkie narzędzia mają ten sam sznyt: krój **Host Grotesk**, spokojną bazę kolorów pod ADHD i **kolor przewodni**
każdego narzędzia (Pasek — szałwia, Tablica — bursztyn, Plany — granat, WOOP — śliwka). U góry każdej strony jest
wspólny pasek: kliknięcie nazwy narzędzia pokazuje listę wszystkich, obok jest CYBER i menu ⋯.

- [`wspolne/system.css`](wspolne/system.css) — kolory, pismo, odstępy i komponenty (przycisk, pole, chip, zakładki, komunikat z „Cofnij”).
- [`wspolne/narzedzia.js`](wspolne/narzedzia.js) — rejestr narzędzi: nazwa, kolor, ikona i miniatura. **Nowe narzędzie = jeden wpis** z kolejnym wolnym kolorem.
- [`wspolne/pulpit.js`](wspolne/pulpit.js) — liczby dnia na stronie startowej, po jednej funkcji na narzędzie.
- [`wspolne/pasek-gorny.js`](wspolne/pasek-gorny.js) — wspólny pasek górny.
- [`wspolne/przejscie.css`](wspolne/przejscie.css) — podpina starsze style narzędzi pod wspólne kolory i krój.
- Podgląd wszystkich elementów: [`wspolne/wzorce.html`](https://czubekxd.github.io/ADHD/wspolne/wzorce.html).

## Wspólne dla wszystkich narzędzi

Folder [`wspolne/`](wspolne/) trzyma to, co działa tak samo w każdym narzędziu:

- **Skróty klawiszowe** ([`skroty.js`](wspolne/skroty.js)): <kbd>Ctrl</kbd>+<kbd>Z</kbd> cofa ostatnią zmianę,
  <kbd>Ctrl</kbd>+<kbd>Y</kbd> (albo <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd>) ponawia, <kbd>Delete</kbd> usuwa zaznaczony
  element — wiersz zadania lub wpisu, węzeł planu, kartę WOOP. W polu z tekstem oba klawisze działają zwyczajnie, na tekście.
  Historia cofania żyje do odświeżenia strony.
- **Synchronizacja z Google Drive** ([`chmura.js`](wspolne/chmura.js)): menu ⋯ → „Zapisuj na Google Drive”. Po zalogowaniu
  dane każdego narzędzia trafiają do ukrytego folderu aplikacji na Drive tej osoby (zakres `drive.appdata` — aplikacja nie widzi
  innych plików), więc telefon i komputer mają te same dane. Zmiany z dwóch urządzeń są scalane: wpisy dodane tu i tam zostają oba,
  usunięte na jednym znikają na drugim. Chmurka w pasku pokazuje stan; „Połącz” pojawia się, gdy Google prosi o ponowne
  potwierdzenie (dostęp od Google wygasa po godzinie; wtedy jedno kliknięcie). Nowe narzędzie synchronizuje się samo, jeśli ma `klucz` w rejestrze.
  Szczegóły: [prywatność](https://czubekxd.github.io/ADHD/prywatnosc.html).
- **Motyw CYBER** ([`cyber.js`](wspolne/cyber.js), [`cyber.css`](wspolne/cyber.css)): przełącznik w nagłówku każdego narzędzia.
  Ustawienie leży pod kluczem `adhd.skin`, więc włączone w jednym miejscu działa wszędzie. WOOP ma pełną wersję motywu u siebie. Licencja: [PolyForm Noncommercial 1.0.0](LICENSE).

## Licencja

Kod jest otwarty i darmowy do **użytku niekomercyjnego**: prywatnie, do nauki, w hobbystycznych projektach,
w organizacjach non-profit, szkołach i instytucjach publicznych. Możesz go pobrać, zmieniać i dzielić się nim dalej —
razem z plikiem [`LICENSE`](LICENSE) i linijką `Required Notice`.

**Nie wolno** go sprzedawać ani używać komercyjnie, w tym robić z niego płatnej aplikacji czy usługi online.
Pełne warunki: [PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0).
Wersje opublikowane wcześniej na licencji MIT zostają na MIT dla tych, którzy je wtedy pobrali.

---

# Pasek zdrowia × SZOP

Narzędzie do notowania własnego poziomu energii, czynników SZOP (stres, zmęczenie,
oczekiwania, przebodźcowanie) i czerwonych flag przeciążenia, z dashboardem
pokazującym, kiedy przychodzą kłopoty i co na nie realnie działa. Pliki leżą w `pasek/`.

## Wrzucenie na GitHub Pages

1. Załóż repozytorium na GitHubie (może być prywatne — Pages działa też
   na prywatnych repo na planie Pro; na darmowym musi być publiczne).
2. Wrzuć do niego wszystkie pliki z tego katalogu, zachowując foldery —
   `index.html` strony startowej musi wylądować w katalogu głównym repozytorium.
3. W repozytorium: **Settings → Pages**.
4. W sekcji *Build and deployment* ustaw **Source: Deploy from a branch**,
   gałąź `main`, katalog `/ (root)`. Zapisz.
5. Po minucie strona startowa będzie pod `https://TWOJA-NAZWA.github.io/NAZWA-REPO/`,
   a Pasek pod `…/NAZWA-REPO/pasek/`.

Każde narzędzie działa też po zwykłym otwarciu jego `index.html` z dysku, bez serwera.

## Gdzie mieszkają dane

W `localStorage` przeglądarki, pod kluczem `mcz.dane.v1`. Wynikają z tego trzy rzeczy,
o których warto pamiętać:

- **Telefon i laptop mają osobne dane.** Przeniesienie: Ustawienia → Pobierz JSON
  na jednym urządzeniu, Wczytaj JSON na drugim. Import pomija duplikaty, więc możesz
  wczytywać ten sam plik wielokrotnie bez bałaganu.
- **Wyczyszczenie danych przeglądarki kasuje wpisy.** Rób kopię JSON co jakiś czas.
- **Tryb prywatny bywa ulotny.** Aplikacja wykrywa zablokowany zapis i mówi o tym
  wprost w Ustawieniach, zamiast po cichu gubić wpisy.

Jeśli kiedyś zechcesz synchronizację między urządzeniami, wymianie podlega wyłącznie
`storage.js` — reszta aplikacji rozmawia z danymi tylko przez obiekt `Magazyn`
i nie wie, skąd one przychodzą.

## Pliki

| Plik | Za co odpowiada |
|---|---|
| `index.html` | szkielet strony, ładuje resztę |
| `config.js` | **wszystkie treści i progi** — czynniki, kolory, listy flag, tagi, parametry analiz |
| `storage.js` | zapis, odczyt, eksport, import |
| `app.js` | formularz, dashboard, historia, ustawienia, obliczenia |
| `styles.css` | wygląd, w tym tryb ciemny |
| `test.js` | test dymny (opcjonalny) |

Nic nie jest zaszyte w kodzie widoków: dopisanie piątego czynnika SZOP w `config.js`
albo w zakładce Ustawienia sprawia, że pojawia się on w formularzu, legendzie,
histogramie i macierzy sam z siebie.

## Jak to działa

**Bateria** — pięć przedziałów co 20%, zgodnie ze skalą energii. W obliczeniach
używany jest środek przedziału (10, 30, 50, 70, 90).

**Czynniki SZOP** — można zaznaczyć kilka naraz, każdy z natężeniem 1–5.
Kliknięcie w czynnik ustawia natężenie na 3 i oznacza je jako *domyślne*;
doprecyzowanie kropkami jest opcjonalne. W Ustawieniach da się kazać statystykom
pomijać niepotwierdzone natężenia — zobaczysz wtedy, czy domyślne trójki
nie rozmywają obrazu.

**Histogram** — wysokość słupka to suma natężeń w danej godzinie, kolor segmentu
to czynnik. Gdy zakres obejmuje jeden dzień, oś to godziny tego dnia; przy dłuższym
zakresie dni nakładają się na dobę. Czarna linia to średnia bateria (skala po prawej),
trójkąty oznaczają godziny z czerwonymi flagami.

**Podpowiadane czynności** — nic nie trzeba konfigurować z góry. Wpisujesz w polu
„Co robiłem”, co akurat zrobiłeś, a aplikacja zapamiętuje to i przy kolejnych wpisach
pokazuje jako przycisk. Kolejność przycisków to częstość wygaszana świeżością:
rzecz robiona często i niedawno wychodzi przed tę sprzed miesiąca. Kliknięcie
wypełnia pole i dociąga tagi, którymi opisałeś tę czynność wcześniej;
ponowne kliknięcie odznacza.

Różne zapisy tej samej rzeczy — „Spacer z psem”, „spacer z psem”, „spacer z psem.” —
lądują w jednym wierszu. Aplikacja porównuje je bez względu na wielkość liter,
nadmiarowe spacje i końcową interpunkcję, a wyświetla ten wariant, którego użyłeś
najczęściej.

**Grupowanie** — domyślnie każda czynność ma własny wiersz w macierzy, bo spacer
i scrollowanie telefonu potrafią mieć przeciwny skutek, choć oba „zmieniają bodźce”.
Przełącznik nad macierzą zwija wiersze do tagów, gdy konkretnych czynności zebrało się
za mało na wiarygodną próbkę. Domyślny tryb zmienisz w Ustawieniach.

**Zmiana baterii** — liczona jako różnica względem następnego wpisu, o ile padł
w ciągu 4 godzin (parametr do zmiany w Ustawieniach). To obiektywna miara obok
Twojej subiektywnej oceny „pomogło / bez zmian / pogorszyło”. Rozjazd między nimi
jest wychwytywany osobno i pokazywany w panelu regeneracji — to zwykle najciekawszy
sygnał w całym dashboardzie.

**Macierz** — działania w wierszach, czynniki SZOP albo pory dnia w kolumnach.
Kratka pokazuje średnią zmianę baterii; przy mniej niż dwóch próbkach zostaje pusta,
zamiast udawać wynik.

**Dni wolne** — weekendy i polskie święta (także ruchome) liczone automatycznie.
Urlop czy dzień chorobowy oznaczasz jednym kliknięciem w Historii.

## Test

```bash
npm install jsdom
node pasek/test.js
```

Przechodzi przez formularz, walidację, wszystkie widoki, filtry, eksport i import.

## Uwaga

To narzędzie do obserwowania siebie, nie do diagnozowania. Jeśli wykres pokazuje coś,
co Cię niepokoi, jest to materiał do rozmowy z człowiekiem, a nie wyrok.
