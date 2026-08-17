/* ---------------------------------------------------------------
   KONFIGURACJA
   To jedyny plik, który trzeba ruszać, żeby zmienić zawartość
   aplikacji. Każdą z tych list można też edytować w zakładce
   "Ustawienia" — zmiany zapisują się w przeglądarce i nadpisują
   to, co jest tutaj.
   --------------------------------------------------------------- */

const DOMYSLNA_KONFIGURACJA = {

  /* Czynniki SZOP. Dodaj piąty, a pojawi się w formularzu,
     legendzie, histogramie i macierzy sam z siebie. */
  szop: [
    { id: 'stres',           nazwa: 'Stres',           kolor: '#C25A3E' },
    { id: 'zmeczenie',       nazwa: 'Zmęczenie',       kolor: '#7C74C4' },
    { id: 'oczekiwania',     nazwa: 'Oczekiwania',     kolor: '#2E8C6E' },
    { id: 'przebodzcowanie', nazwa: 'Przebodźcowanie', kolor: '#C39329' }
  ],

  /* Ile czynników na jeden wpis. false = jeden główny. */
  pozwalajNaWieleSzop: true,

  /* Natężenie 1–5 przy czynniku. Kliknięcie w czynnik ustawia
     wartość domyślną; doprecyzowanie jest opcjonalne. */
  natezenie: {
    wlaczone: true,
    domyslne: 3,
    maks: 5,
    /* true = do statystyk wchodzą tylko natężenia, które
       potwierdziłeś klikając w kropki */
    liczTylkoPotwierdzone: false
  },

  /* Poziomy baterii — pięć przedziałów co 20%.
     "srodek" to wartość używana w obliczeniach. */
  bateria: [
    { id: 'b0', min:  0, max:  19, srodek: 10, etykieta: '0–19',   opis: 'Jestem na granicy',            kolor: '#A9463C' },
    { id: 'b1', min: 20, max:  39, srodek: 30, etykieta: '20–39',  opis: 'Wyraźne wyczerpanie',          kolor: '#C07A3A' },
    { id: 'b2', min: 40, max:  59, srodek: 50, etykieta: '40–59',  opis: 'Pierwsze oznaki kosztu',       kolor: '#B0973E' },
    { id: 'b3', min: 60, max:  79, srodek: 70, etykieta: '60–79',  opis: 'Normalne funkcjonowanie',      kolor: '#6E9455' },
    { id: 'b4', min: 80, max: 100, srodek: 90, etykieta: '80–100', opis: 'Dużo energii',                 kolor: '#3F7F5E' }
  ],

  /* Czerwone flagi — sygnały "jestem już przeciążony". */
  czerwoneFlagi: [
    'nie mogę zacząć nawet prostego zadania',
    'bardzo silna drażliwość',
    'poczucie chaosu',
    'nie mogę podejmować decyzji',
    'silne przebodźcowanie',
    'wycofanie / odcięcie',
    'impulsywne reakcje',
    'muszę od wszystkiego uciec',
    'ból głowy i oczu',
    'duże napięcie mięśni',
    'mgła w głowie'
  ],

  /* Tagi działań regeneracyjnych — grupują wpisy w macierzy. */
  tagiDzialan: [
    'ruch',
    'odbodźcowanie',
    'jedzenie / picie',
    'stimowanie',
    'sen / drzemka',
    'hobby',
    'wsparcie społeczne',
    'delegowanie',
    'zmiana bodźców',
    'wyjście na zewnątrz',
    'ekran / telefon'
  ],

  /* Ocena subiektywna działania. */
  ocenaDzialania: [
    { id: 'pomoglo',    nazwa: 'Pomogło',    waga:  1, kolor: '#3F7F5E' },
    { id: 'bezZmian',   nazwa: 'Bez zmian',  waga:  0, kolor: '#8A8F93' },
    { id: 'pogorszylo', nazwa: 'Pogorszyło', waga: -1, kolor: '#A9463C' }
  ],

  analiza: {
    /* Jak grupować działania w macierzy i rankingu:
       'dzialanie' — każda czynność osobno (dokładniej)
       'tag'       — czynności zwijają się do tagów (szybciej zbiera próbki) */
    grupowanieDzialan: 'dzialanie',
    /* Ile podpowiadanych przycisków czynności pokazać w formularzu. */
    szybkieDzialania: 8,
    /* W ilu godzinach od działania szukać kolejnego wpisu,
       żeby policzyć zmianę baterii. */
    oknoZmianyBateriiGodz: 4,
    /* Poniżej tylu próbek komórka macierzy pokazuje "—"
       zamiast udawać wynik. */
    minProbek: 2
  },

  histogram: {
    /* Godziny pokazywane na osi, gdy brak danych. */
    domyslnyZakres: [7, 22]
  },

  /* Dni wolne poza weekendem i świętami — dopisujesz je
     klikając w historii. Format: 'RRRR-MM-DD'. */
  dniWolne: []
};

if (typeof window !== 'undefined') window.DOMYSLNA_KONFIGURACJA = DOMYSLNA_KONFIGURACJA;
