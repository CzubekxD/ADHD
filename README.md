# ADHD — narzędzia czubekxd

Trzy małe narzędzia do samomonitorowania i ogarniania dnia. Każde to osobna strona statyczna:
żadnego backendu, żadnego konta, dane zostają w przeglądarce.

Strona startowa: **https://czubekxd.github.io/ADHD/**

| Folder | Narzędzie | Dane w `localStorage` |
|---|---|---|
| [`pasek/`](pasek/) | **Pasek zdrowia × SZOP** — energia, czynniki SZOP, czerwone flagi, regeneracja (opis niżej) | `mcz.dane.v1` |
| [`tablica/`](tablica/) | **Tablica scoringowa** — dzienna tablica zadań z punktacją 1/3/8/21, plan tygodnia, historia; specyfikacja w [`tablica/SPEC.md`](tablica/SPEC.md) | `tablica-scoringowa-v1` |
| [`plany/`](plany/) | **Plany Jeżeli… to…** — drzewa kroków na trudne momenty, tryb „Teraz”, ćwiczenia z kart | `plany-jezeli-v1` |

W korzeniu leży `index.html` — strona startowa z kafelkami wszystkich narzędzi.
Nowe narzędzie dopisujesz w tablicy `TOOLS` na jej dole.

Wszystkie narzędzia są pod tym samym adresem `czubekxd.github.io`, ale każde trzyma dane
pod własnym kluczem, więc nie wchodzą sobie w drogę. Licencja: [MIT](LICENSE).

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
