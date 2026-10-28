# Tablica z zadaniami — specyfikacja (wersja 13)

Jeden plik HTML, bez zewnętrznych bibliotek i assetów (wyjątek: opcjonalny OCR), dane w `localStorage` (klucz `tablica-scoringowa-v1`). Docelowo `tablica/index.html` w repo `czubekxd/ADHD`.

## Model danych (schemat 3)

```
{ version:3, fx, lastExport, autoBackup, backupName, importMode,
  categories:[{id,name,points}], pinned:{on,name,catName},
  today:{date, goldShown, silverShown, tasks:[{id,name,catId,points,done,doneAt,started,startDay,carry,repeat,src,pin}]},
  plan:{ "YYYY-MM-DD":[task] },            // zastąpiło płaskie `tomorrow`
  history:[{date,savedAt,earned,possible,done,total,perfect,allDone,heavyDone,heavyTotal,scale,order,cats}],
  recent, theme, sortMode, dayMode, period, fixFrom, fixTo }
```

- `S.tomorrow` istnieje jako **nieenumerowalny getter** na `plan[następny dzień po today.date]` — cały starszy kod działa bez zmian, a eksport nie dubluje danych. Każde przypisanie nowego obiektu do `S` musi przejść przez `bindS()`.
- `migrate()` podnosi 1→2 (skala 2/3/5/7 → 1/3/8/21) i 2→3 (`tomorrow` → `plan`), zapisuje od razu po wczytaniu, działa też na importowanych kopiach.

## System punktacji

Skala **1 / 3 / 8 / 21** (wykładnicza) · start ciężkiego zadania (≥8) płaci 30% od razu, raz, w dniu startu · każde przerzucenie na kolejny dzień +50%, sufit ×2 · złoty dzień wymaga kompletu **i** domkniętego zadania ≥8 pkt · komplet bez takiego zadania to **srebrny dzień** (v16). Jeden medal na dzień: złoto wygrywa, a po złotym świętowaniu srebro już się nie pokazuje. Regułę trzyma jedna funkcja `medalDnia()` (+ mapa `MEDALE`): srebrny nagłówek z podpowiedzią, srebrny TOTAL i paski kategorii w 100%, legenda, słupki i „☆ 100%” w Historii, krótsze świętowanie raz dziennie (`silverShown`). Srebro nie jest zapisywane osobno — liczy się z `allDone && !perfect`; starsze wpisy historii bez pola `allDone` zostają bez medalu. Przesłanka: w ADHD stromo spada wartość nagrody odroczonej, nie wysiłkowej (Mies i wsp., Cortex 2018; metaanaliza Marx i wsp.).

### Poziomy Check (v12)
Gotowa ścieżka dociskania sprawy, dodawana przyciskiem w Kategoriach: **Check L1 czat** (1), **Check L2 telefon / przełożony** (3), **Check L3 wizyta osobista** (8).

## Data tablicy (v13)

Data tablicy zmienia się tylko świadomie.
- **Stara data** (`today.date` ≠ dziś): tabela zadań i przyciski dnia są zablokowane (`inert`) i przygaszone, a baner daje trzy akcje: **„Zapisz [data] i zacznij dziś”** (zapis wyniku, przerzucenie niezamkniętych i `freshBoard(true)`), **„To jest tablica na dziś”** (zmiana daty na dziś bez utraty zadań) i **„Zostań przy [data]”** (odblokowanie do końca sesji, zmienna `zostanPrzy`, niezapisywana).
- **Data w nagłówku** to przycisk. Otwiera okno w stylu `ask()` z `<input type=date>` i podglądem skutków: ile zadań przejdzie, ile dojdzie z planu, ile duplikatów zostanie pominiętych, ile rozpoczętych zadań zachowa punkty i czy w historii jest już zapis z tego dnia.
- **Zmiana daty** (`przeniesTablice`): scala `plan[nowa]` z tablicą z dedupem po nazwie i usuwa ten kubełek. Zadania rozpoczęte w starym dniu dostają `startDay = nowa`, więc punkty za start zostają. `carry` się nie zmienia: to ten sam dzień pracy, nie przerzucenie. Zapis w `history` z nową datą wymaga odpowiedzi „Zastąp” albo „Anuluj”; po „Zastąp” stary zapis znika. Na koniec `bindS()`, zapis i komunikat z „Cofnij” (Ctrl+Z działa tak samo). Ręcznie wybrana data inna niż dziś nie blokuje się ponownie w tej sesji.

## Zakładki

**Dziś** — zadania, combobox kategorii, wykres dnia (szary = do zdobycia, kolor rośnie; kategorie/trudność), wykres kolejności domykania, trzy przyciski dnia, baner nowego dnia. Ciężkie zadania wyróżnione typograficznie: 21 pkt = złote, bold, 18px, akcent na krawędzi, połysk plakietki, przycisk „+6" zamiast kwadracika, podpowiedź „Ruszam to" w nagłówku. Kolumna **→ jutro** (`t.repeat`) kopiuje zadanie do jutrzejszej kolumny planu (kopia nosi `src` = id źródła, odznaczenie ją usuwa, zmiana nazwy ją aktualizuje).
**Plan** (v12, dawniej Jutro) — siedem kolumn pn–nd, weekend wyszarzony; strzałki ‹ › przesuwają zadanie o dobę, „→ dziś" ściąga całą kolumnę na tablicę, nawigacja po tygodniach. `freshBoard(true)` zabiera wszystkie kubełki o dacie ≤ dziś, więc zaległości nie giną w kalendarzu.
**Historia** — okresy, wykres dzień po dniu ze złotymi i srebrnymi dniami, bilans kategorii, 6 statystyk, kolejność domykania zbiorczo, tabela dni.
**Kategorie** — punktacja, stała pozycja, poziomy Check, świętowanie, dane i kopie.
**Import** — CSV/TSV z Asany, wklejona lista (dzieli też po `;`, `\t`, ` | `), screen przez tesseract.js; podgląd z dedupem.
**Jak to działa** — mechanika, uzasadnienie z badań, dane i prywatność, buycoffee, źródła, raport diagnostyczny.

## Kopie i dialogi

Licznik ostatniej kopii, stały plik kopii (File System Access API + uchwyt w IndexedDB), autokopia przy zapisie dnia, tryby dołącz/zastąp, awaryjnie schowek i pole JSON. **Żadnych natywnych `confirm()`** — własne okno `ask()`, bo przeglądarka potrafi zdusić natywne dialogi i wtedy „Zapisz i przerzuć" milczało (błąd naprawiony w v10).

## Stan testów

Playwright, 149 asercji w ośmiu plikach (`test`, `rolltest`, `fixtest`, `imptest`, `baktest`, `ordtest`, `fxtest`, `exp2`, `wktest`) — wszystkie przechodzą.
v13: `testy/datetest.js` (`npm run datetest`, część `npm run wszystko`) — 28 asercji: blokada przy starej dacie, przeniesienie na dziś z zachowaniem zadań i punktów, scalenie z planem, konflikt z historią, Cofnij.

## Otwarte pomysły

- Etap pośredni („kamień milowy") dla zadań 21-punktowych.
- Przycisk umorzenia zadania wiszącego zbyt długo.
- Dźwięki Kenney, domyślnie wyciszone.
- Zapamiętywanie dopasowań słowo → kategoria z importu.
- Automatyczna propozycja kolejnego poziomu Check przy powtórce (L1 → L2 → L3).
