# Plan rozwoju — jesień 2026

Ustalone z właścicielem 19 października 2026. Każdy punkt listy PR-ów to osobny PR, skończony sam w sobie,
w tej kolejności. PR jest gotowy dopiero wtedy, gdy spełnia wszystkie warunki „gotowe, gdy…” i ogólne zasady
z [`CLAUDE.md`](../CLAUDE.md).

## Decyzje

**Dla kogo.** Publicznie, dla każdego z ADHD. Ktoś obcy ma zrozumieć każdą stronę bez instrukcji.
Po polsku; nazwa i adres (czubekxd.github.io/ADHD) zostają. Przykładowe treści w narzędziach zostają — to przykłady.

**Po co.** Trzy role naraz, spięte rytmem dnia:
- obserwacja — Pasek zdrowia × SZOP,
- ogarnianie dnia — pulpit, Tablica, pomidor, skrzynka na myśli,
- trening — Plany Jeżeli… to…, WOOP.

**Granice.** Bez serwera i własnej bazy, za darmo, bez reklam, analityki i ciasteczek, bez kont poza logowaniem Google.
Powiadomienia: przypomnienia w kalendarzu użytkownika plus powiadomienie z otwartej karty dla pomidora.

**Zastrzeżenie.** Jedno zdanie w stopce pulpitu:
„Narzędzia pomagają ogarniać dzień, ale nie diagnozują i nie zastępują leczenia. W kryzysie: 116 123 lub 800 70 2222,
w zagrożeniu życia 112.” Numery sprawdzone na gov.pl („Gdzie uzyskać pomoc psychologiczną i psychiatryczną”):
116 123 i 800 70 2222 działają całą dobę, bezpłatnie.

**Pulpit według pory dnia** (stałe godziny; własne godziny w ustawieniach to późniejszy krok):

| Pora | Godziny | Karty u góry |
|---|---|---|
| Rano | 5:00–11:59 | Pasek (pierwszy wpis baterii), Tablica (ułóż dzień) |
| W ciągu dnia | 12:00–17:59 | Plany (trudny moment), Pasek (kolejny wpis) |
| Wieczorem | 18:00–4:59 | WOOP (czy plan zadziałał), Tablica (domknięcie dnia) |

Karty bieżącej pory są duże i na górze. Pozostałe są niżej, mniejsze, pod nagłówkiem „Później dziś” / „Wcześniej dziś” —
zawsze widoczne. Karty zachowują obecny układ: miniatura, ikona i nazwa, nagłówek (pytanie albo liczba dnia), przycisk.

**Skrzynka na myśli** — prawa kolumna pulpitu na komputerze.
- Pole „wrzuć myśl” (Enter zapisuje), pod nim stos karteczek. Po najechaniu stos się rozsuwa i pokazuje wszystkie.
- Starzenie: karteczka żółknie przez 7 dni (od bladej do nasyconej żółci), od 3. dnia coraz bardziej się gniecie
  (lekki obrót, zagięty róg, cień). Starsza niż 14 dni ląduje na wierzchu stosu z pytaniem „Co z tym robimy?”.
- Akcje na karteczce: → Tablica (zadanie na dziś), → Plany (wyzwalacz nowego planu), → WOOP (życzenie w kreatorze),
  ✓ zrobione, kosz. Każda akcja ma „Cofnij”. Nic nie znika samo.
- Dane pod kluczem `skrzynka-v1`, karteczka: `{ id, tekst, dodano }`. Klucz w synchronizacji (`chmura.js`) i w „Kopii
  wszystkiego”.

**Pomidor** — lewa kolumna pulpitu na komputerze.
- Domyślnie 25 min pracy i 5 przerwy, widoczne odliczanie (mm:ss), własny czas do ustawienia jednym kliknięciem.
- Wygląd: pomidor, którego miąższ ubywa jak tarcza zegara. Bez tykania.
- Działa dalej przy przechodzeniu między narzędziami: stan (start, długość, faza) w `localStorage` pod `pomidor-v1`,
  tylko na tym urządzeniu (poza synchronizacją). Gdy biegnie, w pasku górnym jest mały pomidor z czasem.
- Koniec bloku: krótki dźwięk i powiadomienie z otwartej karty (`Notification`, prośba o zgodę dopiero przy pierwszym
  starcie).
- Opcjonalnie podpięte zadanie z Tablicy; ukończone bloki zapisują się przy zadaniu (pole `pomidory` w zadaniu Tablicy).

**Telefon.** Nad kartami pasek z polem „wrzuć myśl” i małym pomidorem (dotknięcie otwiera skrzynkę / timer jako panel
od dołu). Karty w jednej kolumnie, kolejność według pory dnia.

**Przypomnienia w kalendarzu.** Strona „Przypomnienia” w menu ⋯. Domyślnie 8:00, 14:00, 20:00, godziny do zmiany:
- 8:00 „Ułóż tablicę i zrób pierwszy wpis baterii” → Tablica,
- 14:00 „Wpis baterii” → Pasek,
- 20:00 „Czy plan WOOP zadziałał? Przejrzyj skrzynkę” → WOOP.

Przy każdym: „Dodaj do Google Calendar” (link `calendar.google.com/calendar/render?action=TEMPLATE` z `recur=RRULE:FREQ=DAILY`)
i „Pobierz .ics” (wydarzenie z `RRULE:FREQ=DAILY` i `VALARM` w chwili startu). Opis wydarzenia zawiera link do narzędzia.
Nic nie trafia do kalendarza bez kliknięcia użytkownika. Godziny w `localStorage` pod `przypomnienia-v1`.

**Zgłoszenia.** Przycisk „Zgłoś błąd / pomysł” w menu ⋯ i w stopce. Najpierw prowadzi do formularza zgłoszeń na GitHubie
(szablony `.github/ISSUE_TEMPLATE/`), później do formularza Google. Pola: typ (błąd / pomysł / inne), którego narzędzia
dotyczy, opis, e-mail (opcjonalnie).

## Lista PR-ów

### 1. Zastrzeżenie i zgłoszenia
Gotowe, gdy:
- zdanie z sekcji „Zastrzeżenie” stoi w stopce pulpitu (numery jako zwykły tekst, `tel:` tylko jako dodatek),
- `.github/ISSUE_TEMPLATE/` ma formularze „Błąd” i „Pomysł” z polami z sekcji „Zgłoszenia”, a pusty issue jest wyłączony,
- „Zgłoś błąd / pomysł” jest w menu ⋯ na każdej stronie i w stopce pulpitu.

### 2. Pulpit według pory dnia
Gotowe, gdy:
- kolejność i wielkość kart wynika z tabeli pór, a pora jest liczona z godziny urządzenia i odświeża się przy powrocie na kartę,
- karty spoza bieżącej pory są mniejsze, pod nagłówkiem „Później dziś” / „Wcześniej dziś”, i działają tak samo,
- tytuł pulpitu mówi porę („Dzień dobry” / „Popołudnie” / „Wieczór”) obok daty,
- test podmienia godzinę (np. 9:00, 15:00, 21:00) i sprawdza kolejność kart.

### 3. Skrzynka na myśli — wrzucanie i stos
Gotowe, gdy:
- na komputerze prawa kolumna pulpitu ma pole „wrzuć myśl” i stos karteczek rozsuwany po najechaniu (i po fokusie z klawiatury),
- na telefonie pole jest w pasku nad kartami, a stos otwiera się panelem od dołu,
- kolor i pognięcie zależą od wieku zgodnie z sekcją „Skrzynka”, karteczki starsze niż 14 dni są na wierzchu z pytaniem,
- dane w `skrzynka-v1` są w synchronizacji i w „Kopii wszystkiego”, Ctrl+Z cofa dodanie i usunięcie,
- animacje respektują `prefers-reduced-motion`.

### 4. Skrzynka — przenoszenie
Gotowe, gdy:
- → Tablica dodaje zadanie na dziś (bez kategorii), → Plany tworzy plan z karteczką jako wyzwalaczem i otwiera go,
  → WOOP otwiera kreator z karteczką jako życzeniem; karteczka znika ze skrzynki dopiero po zapisie w narzędziu docelowym,
- ✓ i kosz mają „Cofnij” w komunikacie,
- przeniesione dane trafiają pod klucze narzędzi docelowych w ich formacie (sprawdzone otwarciem narzędzia).

### 5. Pomidor — timer
Gotowe, gdy:
- lewa kolumna pulpitu (telefon: pasek nad kartami) ma pomidora z odliczaniem 25/5 i własnym czasem,
- timer przeżywa przejście do innego narzędzia i odświeżenie strony; w pasku górnym widać mały pomidor z czasem,
- koniec bloku daje dźwięk i powiadomienie z otwartej karty; bez zgody na powiadomienia zostaje dźwięk i komunikat na stronie,
- przy `prefers-reduced-motion` tarcza zmienia się skokowo, bez animacji.

### 6. Pomidor — zadania z Tablicy
Gotowe, gdy:
- przy starcie można wybrać zadanie z dzisiejszej Tablicy (albo „bez zadania”),
- ukończony blok dopisuje się do zadania (`pomidory`) i jest widoczny w Tablicy przy zadaniu,
- przy zadaniu w Tablicy jest „▶ 25 min”, które uruchamia pomidora z tym zadaniem.

### 7. Przypomnienia w kalendarzu
Gotowe, gdy:
- strona „Przypomnienia” w menu ⋯ ma trzy przypomnienia z sekcji „Przypomnienia” z godzinami do zmiany,
- „Dodaj do Google Calendar” otwiera gotowe, codziennie powtarzane wydarzenie z linkiem do narzędzia,
- „Pobierz .ics” daje plik, który poprawnie importuje się do Google Calendar (sprawdzone importem) z powtarzaniem i alarmem,
- strona działa bez logowania i niczego nie wysyła.

### 8. Formularz Google (właściciel)
Formularz tworzy właściciel na swoim koncie albo Claude w przeglądarce, za jego zgodą, z polami z sekcji „Zgłoszenia”.
Gotowe, gdy przycisk „Zgłoś błąd / pomysł” prowadzi do formularza Google, a link do GitHuba zostaje jako drugi.

## Później (poza tym planem)

- Własne godziny pór dnia w ustawieniach.
- Wnętrza narzędzi na wspólnych komponentach zamiast warstwy `przejscie.css`.
- Timer jako osobna strona (body doubling bez zadania).
