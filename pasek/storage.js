/* ---------------------------------------------------------------
   ZAPIS DANYCH
   Cała aplikacja rozmawia z danymi wyłącznie przez ten obiekt.
   Podmiana localStorage na Supabase czy inny backend to
   przepisanie tego jednego pliku — reszta zostaje nietknięta.
   --------------------------------------------------------------- */

const Magazyn = (() => {

  const KLUCZ = 'mcz.dane.v1';
  const WERSJA = 1;

  const pustyStan = () => ({
    wersja: WERSJA,
    wpisy: [],
    konfiguracja: null,   // null = używamy DOMYSLNA_KONFIGURACJA
    dniWolne: []
  });

  let dostepny = true;
  try {
    const test = '__mcz_test__';
    localStorage.setItem(test, '1');
    localStorage.removeItem(test);
  } catch (e) {
    dostepny = false;
  }

  let pamiecZapasowa = pustyStan();

  function czytaj() {
    if (!dostepny) return pamiecZapasowa;
    try {
      const surowe = localStorage.getItem(KLUCZ);
      if (!surowe) return pustyStan();
      const dane = JSON.parse(surowe);
      return Object.assign(pustyStan(), dane);
    } catch (e) {
      console.error('Nie udało się odczytać danych', e);
      return pustyStan();
    }
  }

  function zapisz(stan) {
    if (!dostepny) { pamiecZapasowa = stan; if (window.Skroty) window.Skroty.zapisano(); return { ok: true, ostrzezenie: 'pamiec-ulotna' }; }
    try {
      localStorage.setItem(KLUCZ, JSON.stringify(stan));
      if (window.Skroty) window.Skroty.zapisano();
      return { ok: true };
    } catch (e) {
      return { ok: false, blad: e.message };
    }
  }

  function noweId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* --- operacje na wpisach --- */

  function wpisy() {
    return czytaj().wpisy.slice().sort((a, b) => a.ts.localeCompare(b.ts));
  }

  function dodajWpis(wpis) {
    const stan = czytaj();
    wpis.id = wpis.id || noweId();
    stan.wpisy.push(wpis);
    return zapisz(stan) && wpis;
  }

  function aktualizujWpis(id, zmiany) {
    const stan = czytaj();
    const i = stan.wpisy.findIndex(w => w.id === id);
    if (i === -1) return false;
    stan.wpisy[i] = Object.assign({}, stan.wpisy[i], zmiany);
    zapisz(stan);
    return stan.wpisy[i];
  }

  function usunWpis(id) {
    const stan = czytaj();
    stan.wpisy = stan.wpisy.filter(w => w.id !== id);
    zapisz(stan);
  }

  /* --- konfiguracja --- */

  function konfiguracja() {
    const stan = czytaj();
    const domyslna = JSON.parse(JSON.stringify(window.DOMYSLNA_KONFIGURACJA));
    if (!stan.konfiguracja) return domyslna;
    return Object.assign(domyslna, stan.konfiguracja);
  }

  function zapiszKonfiguracje(konf) {
    const stan = czytaj();
    stan.konfiguracja = konf;
    zapisz(stan);
  }

  function resetujKonfiguracje() {
    const stan = czytaj();
    stan.konfiguracja = null;
    zapisz(stan);
  }

  /* --- dni wolne --- */

  function dniWolne() {
    return czytaj().dniWolne || [];
  }

  function przelaczDzienWolny(data) {
    const stan = czytaj();
    stan.dniWolne = stan.dniWolne || [];
    const i = stan.dniWolne.indexOf(data);
    if (i === -1) stan.dniWolne.push(data); else stan.dniWolne.splice(i, 1);
    zapisz(stan);
    return stan.dniWolne;
  }

  /* --- eksport i import --- */

  function eksportJSON() {
    const stan = czytaj();
    stan.wyeksportowano = new Date().toISOString();
    return JSON.stringify(stan, null, 2);
  }

  function eksportCSV() {
    const konf = konfiguracja();
    const naglowki = ['data', 'godzina', 'bateria', 'szop', 'natezenia',
                      'czerwone_flagi', 'ktore_flagi', 'co_robilem',
                      'tagi', 'czemu_dzialalo', 'ocena'];
    const wiersze = wpisy().map(w => {
      const d = new Date(w.ts);
      const szopNazwy = (w.szop || []).map(s => {
        const k = konf.szop.find(x => x.id === s.id);
        return k ? k.nazwa : s.id;
      });
      const natez = (w.szop || []).map(s => s.n == null ? '' : s.n);
      return [
        d.toISOString().slice(0, 10),
        String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'),
        w.bateria,
        szopNazwy.join('; '),
        natez.join('; '),
        w.czerwonaFlaga ? 'tak' : 'nie',
        (w.flagi || []).join('; '),
        w.dzialanie || '',
        (w.tagi || []).join('; '),
        w.czemu || '',
        w.ocena || ''
      ];
    });
    const uciecz = v => {
      const s = String(v == null ? '' : v);
      return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return [naglowki, ...wiersze].map(r => r.map(uciecz).join(';')).join('\n');
  }

  function importJSON(tekst) {
    let dane;
    try {
      dane = JSON.parse(tekst);
    } catch (e) {
      return { ok: false, blad: 'To nie jest poprawny plik JSON.' };
    }
    if (!dane || !Array.isArray(dane.wpisy)) {
      return { ok: false, blad: 'W pliku nie ma listy wpisów.' };
    }
    const stan = czytaj();
    const istniejace = new Set(stan.wpisy.map(w => w.id));
    let dodane = 0;
    dane.wpisy.forEach(w => {
      if (!w.id) w.id = noweId();
      if (istniejace.has(w.id)) return;
      stan.wpisy.push(w);
      dodane++;
    });
    if (dane.konfiguracja) stan.konfiguracja = dane.konfiguracja;
    if (Array.isArray(dane.dniWolne)) {
      stan.dniWolne = Array.from(new Set((stan.dniWolne || []).concat(dane.dniWolne)));
    }
    zapisz(stan);
    return { ok: true, dodane, pominiete: dane.wpisy.length - dodane };
  }

  function wyczyscWszystko() {
    zapisz(pustyStan());
  }

  return {
    dostepny: () => dostepny,
    wpisy, dodajWpis, aktualizujWpis, usunWpis,
    konfiguracja, zapiszKonfiguracje, resetujKonfiguracje,
    dniWolne, przelaczDzienWolny,
    eksportJSON, eksportCSV, importJSON, wyczyscWszystko,
    noweId,
    // dla skrótów Ctrl+Z / Ctrl+Y: cały stan jako tekst i powrót do niego
    surowe: () => JSON.stringify(czytaj()),
    wczytajSurowe: tekst => zapisz(Object.assign(pustyStan(), JSON.parse(tekst)))
  };
})();

if (typeof window !== 'undefined') window.Magazyn = Magazyn;
