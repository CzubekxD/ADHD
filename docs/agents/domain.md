# Dokumentacja domenowa

Jak skille inżynierskie mają korzystać z dokumentacji domenowej tego repo, zanim zaczną przeglądać kod.
Układ: **jeden kontekst** — jeden `CONTEXT.md` i `docs/adr/` w głównym katalogu.

## Przed przeglądaniem przeczytaj

- **`CONTEXT.md`** w głównym katalogu — słownik pojęć (np. zadanie, kategoria, złoty i srebrny dzień, bateria, plan).
- **`docs/adr/`** — decyzje dotyczące obszaru, w którym będziesz pracować.
- **`docs/plan.md`** — plan rozwoju i sekcja „Decyzje” (zasada z `CLAUDE.md`), oraz `SPEC.md` danego narzędzia,
  jeśli istnieje (np. `tablica/SPEC.md`).

Jeśli któregoś z tych plików nie ma, **działaj dalej bez komentarza**. Nie zgłaszaj braku i nie proponuj zakładania ich
z góry. Skill `/domain-modeling` (wołany przez `/grill-with-docs` i `/improve-codebase-architecture`) tworzy je dopiero
wtedy, gdy jakieś pojęcie albo decyzja naprawdę zostaną ustalone.

## Struktura plików

```
/
├── CONTEXT.md
├── docs/
│   ├── plan.md
│   ├── adr/
│   │   ├── 0001-dane-w-localstorage-i-drive.md
│   │   └── 0002-…
│   └── agents/
├── tablica/ pasek/ plany/ woop/
└── wspolne/
```

## Używaj słownika

Gdy nazywasz pojęcie domeny (w tytule zgłoszenia, propozycji zmian, hipotezie, nazwie testu), użyj nazwy z `CONTEXT.md`
— po polsku, tak jak zna ją użytkownik. Nie zastępuj jej synonimami, których słownik unika.

Jeśli potrzebnego pojęcia nie ma jeszcze w słowniku, to sygnał: albo wymyślasz język, którego projekt nie używa
(przemyśl to), albo jest prawdziwa luka (zanotuj ją dla `/domain-modeling`).

## Zgłaszaj konflikt z ADR

Jeśli to, co proponujesz, przeczy istniejącemu ADR, powiedz to wprost, zamiast po cichu go nadpisywać:

> _Przeczy ADR-0007 (…), ale warto do tego wrócić, bo…_
