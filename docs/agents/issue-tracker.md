# Zgłoszenia: GitHub

Zgłoszenia i specyfikacje tego repo żyją jako GitHub Issues w `CzubekxD/ADHD`. Wszystko robimy przez `gh`.
Tytuły, treści i komentarze piszemy po polsku (zasada z `CLAUDE.md`).

## Jak

- **Nowe zgłoszenie**: `gh issue create --title "..." --body "..."`. Dłuższą treść podaj przez heredoc.
- **Odczyt**: `gh issue view <numer> --comments`, razem z etykietami.
- **Lista**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`,
  z filtrami `--label` i `--state` według potrzeby.
- **Komentarz**: `gh issue comment <numer> --body "..."`
- **Etykiety**: `gh issue edit <numer> --add-label "..."` / `--remove-label "..."`
- **Zamknięcie**: `gh issue close <numer> --comment "..."`

Repo `gh` bierze sam z `git remote -v`, gdy działa wewnątrz klonu.

**Gdy GraphQL jest zablokowany** (np. sesja Claude w chmurze zwraca `HTTP 403: GitHub GraphQL is not available`),
te same operacje robimy przez REST:

- nowe: `gh api repos/CzubekxD/ADHD/issues -f title="..." -F body=@plik.md`
- odczyt: `gh api repos/CzubekxD/ADHD/issues/<numer>` i `.../issues/<numer>/comments`
- komentarz: `gh api repos/CzubekxD/ADHD/issues/<numer>/comments -F body=@plik.md`
- etykiety: `gh api repos/CzubekxD/ADHD/issues/<numer>/labels -f "labels[]=..."`
- zamknięcie: `gh api -X PATCH repos/CzubekxD/ADHD/issues/<numer> -f state=closed`
- PR: `gh api repos/CzubekxD/ADHD/pulls -f base=main -f head=<gałąź> -f title="..." -F body=@plik.md`

## Pull requesty jako zgłoszenia

**PR-y jako źródło próśb: nie.** _(Ustaw `tak`, jeśli zewnętrzne PR-y mają trafiać do triażu jak prośby o funkcje; `/triage` czyta tę flagę.)_

Przy `tak` PR-y przechodzą przez te same etykiety i stany co zgłoszenia, odpowiednikami `gh pr`:

- **Odczyt**: `gh pr view <numer> --comments` i `gh pr diff <numer>`.
- **Zewnętrzne PR-y do triażu**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments`,
  zostaw tylko `authorAssociation` równe `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR` albo `NONE`.
- **Komentarz / etykiety / zamknięcie**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub ma wspólną numerację zgłoszeń i PR-ów, więc samo `#42` może być jednym albo drugim: sprawdź `gh pr view 42`,
a gdy nie ma, `gh issue view 42`.

## Gdy skill mówi „opublikuj w trackerze”

Załóż zgłoszenie na GitHubie.

## Gdy skill mówi „pobierz zgłoszenie”

`gh issue view <numer> --comments`.

## Wayfinder

Dla `/wayfinder`. **Mapa** to jedno zgłoszenie, a bilety to zgłoszenia **podrzędne**.

- **Mapa**: zgłoszenie z etykietą `wayfinder:map`, w treści Notatki / Dotychczasowe decyzje / Mgła. `gh issue create --label wayfinder:map`.
- **Bilet podrzędny**: zgłoszenie podpięte pod mapę jako sub-issue GitHuba (`gh api` na endpoint sub-issues). Gdy sub-issues
  nie działają, dopisz bilet do listy zadań w treści mapy i daj `Część #<mapa>` na górze biletu. Etykiety:
  `wayfinder:<typ>` (`research`/`prototype`/`grilling`/`task`). Wzięty bilet ma przypisaną osobę prowadzącą.
- **Blokady**: natywne zależności zgłoszeń GitHuba. Krawędź: `gh api --method POST repos/CzubekxD/ADHD/issues/<bilet>/dependencies/blocked_by -F issue_id=<id-bazy-blokera>`,
  gdzie `<id-bazy-blokera>` to liczbowe **id z bazy** (`gh api repos/CzubekxD/ADHD/issues/<n> --jq .id`, _nie_ `#numer` ani `node_id`).
  GitHub podaje `issue_dependencies_summary.blocked_by` (tylko otwarte blokery). Gdy zależności nie działają, linia
  `Zablokowane przez: #<n>, #<n>` na górze biletu. Bilet jest odblokowany, gdy wszystkie blokery są zamknięte.
- **Front prac**: otwarte bilety mapy (`gh issue list --state open`, zawężone do jej sub-issues / listy zadań), bez tych
  z otwartym blokerem albo przypisaną osobą; wygrywa pierwszy w kolejności mapy.
- **Wzięcie**: `gh issue edit <n> --add-assignee @me`, pierwszy zapis w sesji.
- **Rozwiązanie**: `gh issue comment <n> --body "<odpowiedź>"`, potem `gh issue close <n>`, potem dopisz wskazówkę
  (sedno + link) do Dotychczasowych decyzji na mapie.
