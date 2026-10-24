/* Przypomnienia w kalendarzu: trzy przypomnienia z godzinami do zmiany, link do Google Calendar
   z codziennym powtarzaniem, plik .ics (RRULE:FREQ=DAILY i alarm), strona niczego nie wysyła.
   Uruchomienie: node wspolne/przypomnienia.test.js (potrzebny jsdom, jak w pasek/test.js). */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!DOCTYPE html><div data-przypomnienia></div>', { runScripts: 'outside-only', url: 'https://czubekxd.github.io/ADHD/przypomnienia.html' });
const { window } = dom;
const bledy = [];
window.console.error = (...a) => bledy.push(a.join(' '));
window.addEventListener('error', e => bledy.push(e.message));
const kod = fs.readFileSync(path.join(__dirname, 'przypomnienia.js'), 'utf8');
['skroty.js'].forEach(f => window.eval(fs.readFileSync(path.join(__dirname, f), 'utf8')));
window.eval(kod);
// nowszy jsdom zostawia stronę w stanie „loading” — moduł montuje się dopiero po DOMContentLoaded
if (window.document.readyState === 'loading') window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
const { document, Przypomnienia: P } = window;
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
function sprawdz(nazwa, warunek, dodatek) {
  console.log((warunek ? '  ok  ' : ' BŁĄD ') + nazwa + (dodatek ? ' — ' + dodatek : ''));
  if (!warunek) process.exitCode = 1;
}
const BAZA = 'https://czubekxd.github.io/ADHD/przypomnienia.html';
const TERAZ = new Date(2026, 9, 20, 10, 30).getTime();   // wtorek 20 października, 10:30 czasu lokalnego

/* --- 1. trzy przypomnienia z planu --- */
sprawdz('trzy przypomnienia: 8:00 Tablica, 14:00 Pasek, 20:00 WOOP',
  P.LISTA.map(p => p.godz + ' ' + p.narzedzie).join(', ') === '08:00 tablica, 14:00 pasek, 20:00 woop');
sprawdz('teksty z planu', P.LISTA[0].tytul === 'Ułóż tablicę i zrób pierwszy wpis baterii' && P.LISTA[1].tytul === 'Wpis baterii' &&
  P.LISTA[2].tytul === 'Czy plan WOOP zadziałał? Przejrzyj skrzynkę');
sprawdz('na stronie trzy karty z polem godziny i dwoma przyciskami', $$('.pz').length === 3 && $$('[data-pz-godz]').length === 3 &&
  $$('[data-pz-google]').length === 3 && $$('[data-pz-ics]').length === 3);
sprawdz('domyślne godziny w polach', $$('[data-pz-godz]').map(i => i.value).join(' ') === '08:00 14:00 20:00');

/* --- 2. najbliższe wystąpienie --- */
const n8 = P.najblizszy('08:00', TERAZ), n14 = P.najblizszy('14:00', TERAZ);
sprawdz('8:00 po 10:30 → jutro', n8.getDate() === 21 && n8.getHours() === 8);
sprawdz('14:00 po 10:30 → dziś', n14.getDate() === 20 && n14.getHours() === 14);

/* --- 3. Google Calendar --- */
const g = new URL(P.linkGoogle(P.LISTA[0], '08:00', TERAZ, BAZA));
sprawdz('link do Google Calendar z action=TEMPLATE', g.origin + g.pathname === 'https://calendar.google.com/calendar/render' && g.searchParams.get('action') === 'TEMPLATE');
sprawdz('codzienne powtarzanie', g.searchParams.get('recur') === 'RRULE:FREQ=DAILY');
sprawdz('start jutro 8:00, 10 minut', g.searchParams.get('dates') === '20261021T080000/20261021T081000', g.searchParams.get('dates'));
sprawdz('tytuł i link do narzędzia w opisie', g.searchParams.get('text') === P.LISTA[0].tytul &&
  g.searchParams.get('details').includes('https://czubekxd.github.io/ADHD/tablica/'), g.searchParams.get('details'));

/* --- 4. plik .ics --- */
const plik = P.ics(P.LISTA[2], '20:00', TERAZ, BAZA);
const linie = plik.split('\r\n');
sprawdz('.ics: końce linii CRLF', plik.endsWith('\r\n') && !/[^\r]\n/.test(plik));
sprawdz('.ics: kalendarz z jednym wydarzeniem', linie[0] === 'BEGIN:VCALENDAR' && linie.includes('VERSION:2.0') && linie.filter(l => l === 'BEGIN:VEVENT').length === 1);
sprawdz('.ics: dziś 20:00 czasu lokalnego, 10 min', linie.includes('DTSTART:20261020T200000') && linie.includes('DURATION:PT10M'));
sprawdz('.ics: codziennie', linie.includes('RRULE:FREQ=DAILY'));
sprawdz('.ics: alarm w chwili startu', /BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:[^\r]+\r\nTRIGGER:PT0M\r\nEND:VALARM/.test(plik));
sprawdz('.ics: link do narzędzia (URL i opis)', linie.includes('URL:https://czubekxd.github.io/ADHD/woop/') && /Otwórz/.test(plik));
sprawdz('.ics: nowe linie w opisie jako \\n', /DESCRIPTION:Czy plan WOOP zadziałał\? Przejrzyj skrzynkę\\n\\nOtwórz: WOOP/.test(plik.replace(/\r\n /g, '')));
const dlugie = plik.split('\r\n').map(l => new TextEncoder().encode(l).length);
sprawdz('.ics: linie najwyżej 75 bajtów', dlugie.every(n => n <= 75), Math.max(...dlugie) + ' bajtów');
sprawdz('.ics: zawinięcie nie gubi znaków', P.zawin('X'.repeat(70) + 'żółć'.repeat(20)).replace(/\r\n /g, '') === 'X'.repeat(70) + 'żółć'.repeat(20));
sprawdz('.ics: UID i DTSTAMP', linie.some(l => /^UID:wieczor-[a-z0-9]+@czubekxd\.github\.io$/.test(l)) && linie.some(l => /^DTSTAMP:\d{8}T\d{6}Z$/.test(l)));

/* --- 5. zmiana godziny --- */
const pole = $('[data-pz-godz="rano"]');
pole.value = '07:15'; pole.dispatchEvent(new window.Event('change', { bubbles: true }));
sprawdz('nowa godzina zapisana w przypomnienia-v1', JSON.parse(window.localStorage.getItem('przypomnienia-v1')).rano === '07:15');
sprawdz('link Google od razu z nową godziną', /T071500%2F/.test($('.pz[data-id="rano"] [data-pz-google]').getAttribute('href')));
window.Skroty.cofnij();
sprawdz('Ctrl+Z cofa zmianę godziny', P.czytaj().rano === '08:00' && $('[data-pz-godz="rano"]').value === '08:00');
sprawdz('zła godzina nie przechodzi', P.ustaw('rano', '25:99') === false && P.czytaj().rano === '08:00');

/* --- 6. niczego nie wysyła --- */
sprawdz('moduł nie wysyła danych (bez fetch / XHR / sendBeacon)', !/fetch\(|XMLHttpRequest|sendBeacon|navigator\.sendBeacon/.test(kod));
const strona = fs.readFileSync(path.join(__dirname, '..', 'przypomnienia.html'), 'utf8');
sprawdz('strona nie ładuje synchronizacji ani logowania', !/chmura\.js/.test(strona));
const pasek = fs.readFileSync(path.join(__dirname, 'pasek-gorny.js'), 'utf8');
sprawdz('„Przypomnienia” w menu ⋯', /przypomnienia\.html"><span><b>Przypomnienia<\/b>/.test(pasek));

console.log('\nBłędy w konsoli: ' + (bledy.length ? '\n  ' + bledy.join('\n  ') : 'brak'));
if (bledy.length) process.exitCode = 1;
