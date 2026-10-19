/* Skrzynka na myśli: starzenie karteczek, kolejność na stosie, wrzucanie i wyrzucanie z Ctrl+Z.
   Uruchomienie: node wspolne/skrzynka.test.js (potrzebny jsdom, jak w pasek/test.js). */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const dom = new JSDOM(`<!DOCTYPE html><body>
  <form data-skrzynka-pole><input></form>
  <p data-skrzynka-pusto>Pusto</p>
  <ol data-skrzynka-stos></ol>
  <span data-skrzynka-licznik></span></body>`, { runScripts: 'outside-only', url: 'https://example.org/' });
const { window } = dom;
const bledy = [];
window.console.error = (...a) => bledy.push(a.join(' '));
window.addEventListener('error', e => bledy.push(e.message));
['odmiana.js', 'skroty.js', 'skrzynka.js'].forEach(f => window.eval(fs.readFileSync(path.join(__dirname, f), 'utf8')));

const { document, Skrzynka, Skroty } = window;
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
function sprawdz(nazwa, warunek, dodatek) {
  console.log((warunek ? '  ok  ' : ' BŁĄD ') + nazwa + (dodatek ? ' — ' + dodatek : ''));
  if (!warunek) process.exitCode = 1;
}
const DZIEN = 864e5;
const TERAZ = new Date(2026, 9, 19, 12).getTime();
const kartkaSprzed = dni => ({ id: 'k' + dni, tekst: 'myśl ' + dni, dodano: new Date(TERAZ - dni * DZIEN).toISOString() });
const dane = () => JSON.parse(window.localStorage.getItem(Skrzynka.KLUCZ) || '{"kartki":[]}');

/* --- 1. starzenie --- */
const w = dni => Skrzynka.wyglad(kartkaSprzed(dni), TERAZ);
sprawdz('nowa: blada i gładka', w(0).zolc === 0 && w(0).zgniecenie === 0 && !w(0).stara);
sprawdz('2 dni: żółknie, jeszcze niepognieciona', w(2).zolc > 0.28 && w(2).zolc < 0.29 && w(2).zgniecenie === 0);
sprawdz('3. dzień (2,5 doby): zaczyna się gnieść', w(2.5).zgniecenie > 0 && w(2.5).zgniecenie < 0.1);
sprawdz('7 dni: nasycona żółć', w(7).zolc === 1 && w(10).zolc === 1);
sprawdz('pognieciona coraz bardziej', w(5).zgniecenie < w(9).zgniecenie && w(9).zgniecenie < w(13).zgniecenie);
sprawdz('14 dni: pognieciona do końca, ale jeszcze nie „stara”', w(14).zgniecenie === 1 && !w(14).stara);
sprawdz('starsza niż 14 dni: „stara”', w(14.5).stara && w(30).stara);

/* --- 2. kolejność na stosie --- */
const kol = Skrzynka.kolejnosc([kartkaSprzed(1), kartkaSprzed(20), kartkaSprzed(0), kartkaSprzed(16), kartkaSprzed(5)], TERAZ).map(x => x.k.id).join(',');
sprawdz('stare na wierzchu (najstarsza pierwsza), reszta od najnowszej', kol === 'k20,k16,k0,k1,k5', kol);

/* --- 3. rysowanie --- */
window.localStorage.setItem(Skrzynka.KLUCZ, JSON.stringify({ kartki: [kartkaSprzed(0), kartkaSprzed(16)] }));
Skrzynka.rysuj(TERAZ);
const karty = $$('.sk-kartka');
sprawdz('stara karteczka na wierzchu z pytaniem „Co z tym robimy?”', karty[0].dataset.id === 'k16' && /Co z tym robimy\?/.test(karty[0].textContent));
sprawdz('świeża karteczka bez pytania, „dziś”', karty[1].dataset.id === 'k0' && !/Co z tym/.test(karty[1].textContent) && /dziś/.test(karty[1].textContent));
sprawdz('wiek trafia do stylu karteczki', /--zolc:1\.000/.test(karty[0].getAttribute('style')) && /--zgn:1\.000/.test(karty[0].getAttribute('style')));
sprawdz('licznik i komunikat „pusto”', $('[data-skrzynka-licznik]').textContent === '2' && $('[data-skrzynka-pusto]').hidden);
sprawdz('każda karteczka ma kosz z celem i opisem', karty.every(k => k.querySelector('.sk-usun[aria-label^="Wyrzuć"]')));

/* --- 4. wrzucanie i Ctrl+Z --- */
window.localStorage.removeItem(Skrzynka.KLUCZ);
Skrzynka.zamontuj();
const pole = $('form[data-skrzynka-pole] input');
const wyslij = t => { pole.value = t; $('form[data-skrzynka-pole]').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); };
sprawdz('na start pusto', $$('.sk-kartka').length === 0 && !$('[data-skrzynka-pusto]').hidden);
wyslij('   ');
sprawdz('pusta myśl się nie zapisuje', dane().kartki.length === 0);
wyslij('  Zadzwonić do dentysty  ');
const k1 = dane().kartki[0];
sprawdz('Enter zapisuje karteczkę { id, tekst, dodano }', dane().kartki.length === 1 && k1.tekst === 'Zadzwonić do dentysty' && k1.id && !isNaN(Date.parse(k1.dodano)), JSON.stringify(k1));
sprawdz('pole czyści się po zapisie', pole.value === '');
sprawdz('karteczka jest na stosie', $$('.sk-kartka').length === 1);
Skroty.cofnij();
sprawdz('Ctrl+Z cofa dodanie', dane().kartki.length === 0 && $$('.sk-kartka').length === 0);
Skroty.ponow();
sprawdz('Ctrl+Y przywraca', dane().kartki.length === 1 && $$('.sk-kartka').length === 1);

/* --- 5. wyrzucanie i Ctrl+Z --- */
wyslij('Kupić baterie');
sprawdz('druga karteczka na wierzchu (najnowsza pierwsza)', $$('.sk-kartka')[0].textContent.includes('Kupić baterie'));
$$('.sk-kartka')[0].querySelector('.sk-usun').dispatchEvent(new window.Event('click', { bubbles: true }));
sprawdz('kosz wyrzuca karteczkę', dane().kartki.length === 1 && dane().kartki[0].tekst === 'Zadzwonić do dentysty');
sprawdz('komunikat z „Cofnij”', /Wyrzucono/.test($('.skroty-toast').textContent) && $('.skroty-toast .akcja').textContent === 'Cofnij');
$('.skroty-toast .akcja').dispatchEvent(new window.Event('click', { bubbles: true }));
sprawdz('„Cofnij” przywraca wyrzuconą', dane().kartki.length === 2 && $$('.sk-kartka').length === 2);

/* --- 6. synchronizacja i kopia --- */
const chmura = fs.readFileSync(path.join(__dirname, 'chmura.js'), 'utf8');
sprawdz('klucz skrzynki w synchronizacji (chmura.js)', /DOMYSLNE = \[[^\]]*'skrzynka-v1'/.test(chmura));
const pulpit = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
sprawdz('klucz skrzynki w „Kopii wszystkiego”', /klucz: Skrzynka\.KLUCZ/.test(pulpit));

console.log('\nBłędy w konsoli: ' + (bledy.length ? '\n  ' + bledy.join('\n  ') : 'brak'));
if (bledy.length) process.exitCode = 1;
