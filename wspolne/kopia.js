/* ---------------------------------------------------------------
   KOPIA DANYCH — pobieranie i wczytywanie plików JSON
   Kopia.pobierz(nazwa, tekst)  zapisuje plik na dysku
   Kopia.wybierz()              otwiera okno wyboru pliku, zwraca Promise z jego treścią
   Kopia.dzis()                 dzisiejsza data jako RRRR-MM-DD, do nazw plików
   --------------------------------------------------------------- */
(function () {
  'use strict';
  const pad = n => String(n).padStart(2, '0');
  window.Kopia = {
    dzis() { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); },
    pobierz(nazwa, tekst) {
      const url = URL.createObjectURL(new Blob([tekst], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url; a.download = nazwa; a.style.display = 'none';
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
    },
    wybierz() {
      return new Promise((ok, nie) => {
        const i = document.createElement('input');
        i.type = 'file'; i.accept = 'application/json,.json'; i.style.display = 'none';
        i.addEventListener('change', () => {
          const f = i.files && i.files[0]; i.remove();
          if (!f) { nie(new Error('brak pliku')); return; }
          f.text().then(ok, nie);
        });
        document.body.appendChild(i); i.click();
      });
    }
  };
})();
