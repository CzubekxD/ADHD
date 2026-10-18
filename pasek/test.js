const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

const dom = new JSDOM(html, {
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  url: 'https://example.org/'
});
const { window } = dom;

// localStorage w jsdom bywa dostępny; dokładamy prosty zamiennik na wszelki wypadek
if (!window.localStorage) {
  const mapa = {};
  window.localStorage = {
    getItem: k => (k in mapa ? mapa[k] : null),
    setItem: (k, v) => { mapa[k] = String(v); },
    removeItem: k => { delete mapa[k]; }
  };
}
window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
window.confirm = () => true;
window.alert = () => {};
window.scrollTo = () => {};
window.URL.createObjectURL = () => 'blob:test';
window.URL.revokeObjectURL = () => {};
window.HTMLElement.prototype.scrollIntoView = function () {};

const bledy = [];
window.addEventListener('error', e => bledy.push('window error: ' + e.message));
const staryError = console.error;
console.error = (...a) => { bledy.push('console.error: ' + a.join(' ')); staryError(...a); };

['../wspolne/odmiana.js', 'config.js', 'storage.js', 'app.js'].forEach(f => {
  window.eval(fs.readFileSync(path.join(__dirname, f), 'utf8'));
});

window.document.dispatchEvent(new window.Event('DOMContentLoaded'));

const { document } = window;
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const klik = el => el.dispatchEvent(new window.Event('click', { bubbles: true }));

function sprawdz(nazwa, warunek, dodatek) {
  const znak = warunek ? '  ok  ' : ' BŁĄD ';
  console.log(znak + nazwa + (dodatek ? ' — ' + dodatek : ''));
  if (!warunek) process.exitCode = 1;
}

/* --- 1. formularz się renderuje --- */
sprawdz('formularz ma pięć segmentów baterii', $$('[data-bateria]').length === 5);
sprawdz('formularz ma cztery czynniki SZOP', $$('[data-szop]').length === 4);

/* --- 2. zapis bez baterii jest blokowany --- */
klik($('#zapisz'));
sprawdz('brak baterii pokazuje błąd', !$('#blad-bateria').classList.contains('ukryty'));
sprawdz('nic nie zapisano', window.Magazyn.wpisy().length === 0);

/* --- 3. natężenie: jedno kliknięcie ustawia domyślne --- */
klik($$('[data-bateria]')[1]);            // 30
klik($('[data-szop="stres"]'));
let szopBtn = $('[data-szop="stres"]');
sprawdz('czynnik zaznaczony', szopBtn.getAttribute('aria-pressed') === 'true');
sprawdz('kropki natężenia się pojawiły', $$('[data-szop-natezenie]').length === 5);
sprawdz('znacznik „domyślne” widoczny', /domyślne/.test($('#widok').innerHTML));
klik($('[data-szop-natezenie="stres"][data-n="5"]'));
sprawdz('po kliknięciu w kropkę znika „domyślne”', !/domyślne/.test($('#widok').innerHTML));

/* --- 4. wielokrotny wybór działa --- */
klik($('[data-szop="przebodzcowanie"]'));
sprawdz('dwa czynniki naraz', $$('[data-szop][aria-pressed="true"]').length === 2);

/* --- 5. czerwone flagi --- */
klik($('[data-flaga-tak="tak"]'));
sprawdz('lista flag się odsłania', !$('#lista-flag').classList.contains('ukryty'));
klik($$('[data-flaga]')[1]);

/* --- 6. pełny zapis --- */
$('#pole-dzialanie').value = 'Spacer z psem';
$('#pole-dzialanie').dispatchEvent(new window.Event('input', { bubbles: true }));
klik($('[data-tag="ruch"]'));
klik($('[data-ocena="pomoglo"]'));
klik($('#zapisz'));
sprawdz('wpis zapisany', window.Magazyn.wpisy().length === 1);
const w1 = window.Magazyn.wpisy()[0];
sprawdz('wpis ma dwa czynniki', w1.szop.length === 2, JSON.stringify(w1.szop));
sprawdz('natężenie stresu potwierdzone na 5', w1.szop[0].n === 5 && w1.szop[0].potwierdzone === true);
sprawdz('natężenie drugiego czynnika domyślne', w1.szop[1].n === 3 && w1.szop[1].potwierdzone === false);
sprawdz('formularz wyczyszczony po zapisie', $$('[data-szop][aria-pressed="true"]').length === 0);

/* --- 7. dosypujemy dane syntetyczne, żeby analizy miały z czego liczyć --- */
const M = window.Magazyn;
const bazaDnia = new Date();
bazaDnia.setHours(0, 0, 0, 0);
function wpisTestowy(przesuniecieDni, godz, bateria, szopIds, flaga, dzialanie, tagi, ocena) {
  const d = new Date(bazaDnia);
  d.setDate(d.getDate() - przesuniecieDni);
  d.setHours(godz, 0, 0, 0);
  M.dodajWpis({
    id: M.noweId(),
    ts: d.toISOString(),
    bateria,
    szop: szopIds.map(id => ({ id, n: 3, potwierdzone: true })),
    czerwonaFlaga: !!flaga,
    flagi: flaga ? ['bardzo silna drażliwość'] : [],
    dzialanie: dzialanie || '',
    tagi: tagi || [],
    czemu: '',
    ocena: ocena || null
  });
}
for (let d = 1; d <= 5; d++) {
  wpisTestowy(d,  9, 70, ['zmeczenie'], false, '', [], null);
  wpisTestowy(d, 12, 50, ['stres', 'przebodzcowanie'], false, 'Spacer z psem', ['ruch'], 'pomoglo');
  wpisTestowy(d, 14, 70, ['zmeczenie'], false, '', [], null);
  wpisTestowy(d, 17, 30, ['przebodzcowanie'], true, 'Scrollowanie', ['ekran / telefon'], 'pomoglo');
  wpisTestowy(d, 19, 10, ['zmeczenie'], true, '', [], null);
}
sprawdz('dane testowe dosypane', M.wpisy().length === 26, M.wpisy().length + ' wpisów');

/* --- 8. dashboard --- */
klik($('[data-widok="dashboard"]'));
const dash = $('#widok').innerHTML;
sprawdz('dashboard się wyrenderował', dash.length > 2000);
sprawdz('histogram ma słupki', $$('#widok svg rect').length > 4, $$('#widok svg rect').length + ' prostokątów');
sprawdz('linia baterii narysowana', $$('#widok svg polyline').length === 1);
sprawdz('znaczniki czerwonych flag obecne', /▲/.test(dash));
sprawdz('panel czerwonych flag pokazuje godzinę szczytu', /17:00|19:00/.test(dash));
sprawdz('macierz zawiera działanie', /Spacer z psem|ruch/.test(dash));
sprawdz('macierz wykryła spadek po scrollowaniu', /−|-\d/.test(dash) || /ekran/.test(dash));

/* --- 9. przełącznik osi macierzy --- */
klik($('[data-os="pora"]'));
sprawdz('macierz wg pory dnia', /12–15|15–18/.test($('#widok').innerHTML));

/* --- 10. filtry --- */
klik($('[data-preset="dzis"]'));
sprawdz('filtr „Dziś” działa', /Brak wpisów w tym zakresie|Jeden dzień/.test($('#widok').innerHTML));
klik($('[data-preset="wszystko"]'));
klik($('[data-typdnia="robocze"]'));
sprawdz('filtr dni roboczych nie wywala widoku', $('#widok').innerHTML.length > 1000);
klik($('[data-typdnia="wszystkie"]'));

/* --- 11. historia --- */
klik($('[data-widok="historia"]'));
sprawdz('historia grupuje po dniach', $$('.dzien-naglowek').length >= 5);
const przedUsuniemciem = M.wpisy().length;
klik($$('[data-usun]')[0]);
sprawdz('usuwanie wpisu działa', M.wpisy().length === przedUsuniemciem - 1);
klik($$('[data-wolny]')[0]);
sprawdz('oznaczenie dnia wolnego zapisane', M.dniWolne().length === 1);

/* --- 12. ustawienia --- */
klik($('[data-widok="ustawienia"]'));
sprawdz('ustawienia listują czynniki', $$('[data-szop-nazwa]').length === 4);
$('#lista-tagi').value = 'ruch\nkawa';
klik($('#zapisz-konf'));
sprawdz('zapis ustawień działa', M.konfiguracja().tagiDzialan.length === 2);
klik($('[data-widok="wpis"]'));
sprawdz('nowe tagi widać w formularzu', $$('[data-tag]').length === 2);

/* --- 13. eksport --- */
const csv = M.eksportCSV();
sprawdz('CSV ma nagłówek i wiersze', csv.split('\n').length === M.wpisy().length + 1);
const json = M.eksportJSON();
sprawdz('JSON parsuje się z powrotem', JSON.parse(json).wpisy.length === M.wpisy().length);

/* --- 14. import --- */
M.wyczyscWszystko();
const wynikImportu = M.importJSON(json);
sprawdz('import przywraca wpisy', wynikImportu.ok && M.wpisy().length === JSON.parse(json).wpisy.length);
sprawdz('import odrzuca śmieci', M.importJSON('to nie jest json').ok === false);

/* --- 15. święta --- */
klik($('[data-widok="historia"]'));

console.log('\nBłędy w konsoli: ' + (bledy.length ? '\n  ' + bledy.join('\n  ') : 'brak'));
if (bledy.length) process.exitCode = 1;

/* --- 16. podpowiadane przyciski czynności --- */
console.log('\n— podpowiadane czynności —');
M.wyczyscWszystko();
window.KONF_RESET = true;
klik($('[data-widok="wpis"]'));
sprawdz('na starcie brak przycisków czynności', $$('[data-szybkie]').length === 0);

function szybkiWpis(bateria, dzialanie, tagi, przesunMin) {
  const t = new Date(Date.now() - (przesunMin || 0) * 60000);
  M.dodajWpis({
    id: M.noweId(), ts: t.toISOString(), bateria,
    szop: [{ id: 'zmeczenie', n: 3, potwierdzone: true }],
    czerwonaFlaga: false, flagi: [], dzialanie, tagi: tagi || [], czemu: '', ocena: null
  });
}
szybkiWpis(50, 'Spacer z psem', ['ruch'], 600);
szybkiWpis(70, '', [], 560);
szybkiWpis(50, 'spacer z psem.', ['ruch'], 300);   // inny zapis tej samej czynności
szybkiWpis(70, '', [], 260);
szybkiWpis(30, 'Kawa na balkonie', [], 120);

klik($('[data-widok="wpis"]'));
const etykiety = $$('[data-szybkie]').map(b => b.textContent.trim());
sprawdz('przyciski pojawiły się same', etykiety.length === 2, etykiety.join(' | '));
sprawdz('warianty zapisu zlały się w jeden', etykiety.filter(t => /spacer/i.test(t)).length === 1);
sprawdz('częstsza czynność jest pierwsza', /spacer/i.test(etykiety[0]));

klik($$('[data-szybkie]')[0]);
sprawdz('kliknięcie wypełnia pole', $('#pole-dzialanie').value.toLowerCase().includes('spacer'));
sprawdz('kliknięcie dociąga tag', $('[data-tag="ruch"]').getAttribute('aria-pressed') === 'true');
klik($$('[data-szybkie]')[0]);
sprawdz('ponowne kliknięcie odznacza', $('#pole-dzialanie').value === '');

/* --- 17. grupowanie w macierzy --- */
szybkiWpis(50, 'Bieganie po schodach', ['ruch'], 90);
szybkiWpis(70, '', [], 60);
klik($('[data-widok="dashboard"]'));
klik($('[data-grupowanie="dzialanie"]'));
const wierszeCzynnosci = $$('.macierz .wiersz-nag').map(t => t.textContent.trim());
sprawdz('domyślnie osobne wiersze na czynności',
  wierszeCzynnosci.some(t => /Spacer/i.test(t)) && wierszeCzynnosci.some(t => /Bieganie/i.test(t)),
  wierszeCzynnosci.join(' | '));
klik($('[data-grupowanie="tag"]'));
const wierszeTagow = $$('.macierz .wiersz-nag').map(t => t.textContent.trim());
sprawdz('przełącznik zwija do tagów', wierszeTagow.some(t => /^ruch/.test(t)) && !wierszeTagow.some(t => /Bieganie/i.test(t)),
  wierszeTagow.join(' | '));
