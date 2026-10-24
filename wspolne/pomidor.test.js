/* Pomidor: odliczanie 25/5 i własny czas, pauza, koniec bloku (dźwięk, powiadomienie, komunikat),
   stan przeżywa przejście na inną stronę, mały pomidor w pasku, tarcza skokowo przy reduced-motion.
   Uruchomienie: node wspolne/pomidor.test.js (potrzebny jsdom, jak w pasek/test.js). */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const STRONA = `<!DOCTYPE html><body>
  <header data-pasek-gorny data-korzen="../"><span data-pomidor-mini></span></header>
  <aside data-pomidor></aside></body>`;
const kod = fs.readFileSync(path.join(__dirname, 'pomidor.js'), 'utf8');
const bledy = [];
function strona(stan) {
  const dom = new JSDOM(STRONA, { runScripts: 'outside-only', url: 'https://example.org/tablica/' });
  const w = dom.window;
  w.console.error = (...a) => bledy.push(a.join(' '));
  w.addEventListener('error', e => bledy.push(e.message));
  if (stan) w.localStorage.setItem('pomidor-v1', stan);
  w.eval(fs.readFileSync(path.join(__dirname, 'odmiana.js'), 'utf8'));
  w.eval(kod);
  // nowszy jsdom zostawia stronę w stanie „loading” — pomidor montuje się dopiero po DOMContentLoaded.
  // Strona z zapisanym stanem tylko czyta (bez montowania, które od razu sprawdza koniec bloku prawdziwym zegarem).
  if (!stan && w.document.readyState === 'loading') w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  return w;
}
function sprawdz(nazwa, warunek, dodatek) {
  console.log((warunek ? '  ok  ' : ' BŁĄD ') + nazwa + (dodatek ? ' — ' + dodatek : ''));
  if (!warunek) process.exitCode = 1;
}
const MIN = 60000, T0 = Date.UTC(2026, 9, 20, 8, 0, 0);

let w = strona();
let P = w.Pomidor;
const $ = s => w.document.querySelector(s);
const $$ = s => Array.from(w.document.querySelectorAll(s));
const klik = el => el.dispatchEvent(new w.Event('click', { bubbles: true }));

/* --- 1. domyślnie 25 / 5 --- */
let s = P.czytaj();
sprawdz('domyślnie 25 min pracy i 5 przerwy', s.ustawienia.praca === 25 && s.ustawienia.przerwa === 5 && s.faza === 'praca');
sprawdz('przed startem widać 25:00', P.mmss(P.pozostalo(s)) === '25:00' && $('.pm-czas').textContent === '25:00');
sprawdz('przycisk „Start pracy” i −/+ dla pracy i przerwy', /Start pracy/.test($('[data-pm="start"]').textContent) && $$('[data-pm="praca"]').length === 2 && $$('[data-pm="przerwa"]').length === 2);
sprawdz('długości widać jako liczby minut: 25 i 5', $$('.pm-min').map(e => e.textContent).join(',') === '25,5');
sprawdz('tarcza to przycisk (klik startuje i pauzuje)', $('.pm-tarcza') && $('.pm-tarcza').tagName === 'BUTTON' && $('.pm-tarcza').dataset.pm === 'tarcza');
sprawdz('mały pomidor w pasku schowany, gdy timer stoi', $('[data-pomidor-mini]').innerHTML === '');

/* --- 2. własny czas: −/+ bez listy gotowych długości --- */
klik($('[data-pm="praca"][data-krok="1"]'));
klik($('[data-pm="przerwa"][data-krok="1"]'));
s = P.czytaj();
sprawdz('+ przy pracy dodaje 5 min, + przy przerwie 1 min', s.ustawienia.praca === 30 && s.ustawienia.przerwa === 6 && $('.pm-czas').textContent === '30:00');
klik($('[data-pm="praca"][data-krok="-1"]'));
sprawdz('− przy pracy odejmuje 5 min', P.czytaj().ustawienia.praca === 25);
sprawdz('granice: praca 5–90, przerwa 1–30', P.ustawPrace(200).ustawienia.praca === 90 && P.ustawPrace(1).ustawienia.praca === 5 && P.ustawPrzerwe(0.5).ustawienia.przerwa === 1 && P.ustawPrzerwe(99).ustawienia.przerwa === 30);
P.ustawPrace(25); P.ustawPrzerwe(5); P.rysuj();
sprawdz('przy granicy przycisk jest wyłączony', (P.ustawPrzerwe(1), P.rysuj(), $('[data-pm="przerwa"][data-krok="-1"]').disabled));
P.ustawPrzerwe(5); P.rysuj();

/* --- 3. odliczanie --- */
s = P.start(T0);
sprawdz('start: koniec za 25 min', s.koniec === T0 + 25 * MIN && s.pauza === null);
sprawdz('po minucie zostało 24:00', P.mmss(P.pozostalo(s, T0 + MIN)) === '24:00');
sprawdz('po 61,5 s zostało 23:59 (mm:ss w górę)', P.mmss(P.pozostalo(s, T0 + 61500)) === '23:59');
sprawdz('ustawianie długości zablokowane w trakcie', P.ustawPrace(60).ustawienia.praca === 25);

/* --- 4. tarcza --- */
sprawdz('w połowie zostaje pół miąższu', Math.abs(P.ulamek(s, T0 + 12.5 * MIN, false) - 0.5) < 1e-9);
sprawdz('płynnie: po 30 s ubywa', P.ulamek(s, T0 + 30000, false) < 1);
sprawdz('reduced-motion: skokowo co pełną minutę', P.ulamek(s, T0 + 30000, true) === 1 && P.ulamek(s, T0 + 61000, true) === 24 / 25);

P.rysuj(T0);
sprawdz('na starcie naczynie pełne (--pm-f:1)', /--pm-f:1\.000/.test($('.pm-tarcza .pm-ikona').getAttribute('style')));
P.rysuj(T0 + 12.5 * MIN);
sprawdz('w połowie ciecz do połowy (--pm-f:0.5)', /--pm-f:0\.500/.test($('.pm-tarcza .pm-ikona').getAttribute('style')));

/* --- 5. pauza i wznowienie --- */
s = P.pauza(T0 + 10 * MIN);
sprawdz('pauza zatrzymuje czas', s.koniec === null && s.pauza === 15 * MIN && P.pozostalo(s, T0 + 99 * MIN) === 15 * MIN);
s = P.wznow(T0 + 20 * MIN);
sprawdz('wznowienie liczy dalej od tego miejsca', s.koniec === T0 + 35 * MIN && s.pauza === null);

/* --- 6. przeżywa przejście do innego narzędzia i odświeżenie --- */
const zapisany = w.localStorage.getItem('pomidor-v1');
const w2 = strona(zapisany);
sprawdz('nowa strona czyta ten sam stan', w2.Pomidor.pozostalo(w2.Pomidor.czytaj(), T0 + 21 * MIN) === 14 * MIN);
w2.Pomidor.rysuj(T0 + 21 * MIN);
const mini = w2.document.querySelector('[data-pomidor-mini] .pg-pomidor');
sprawdz('mały pomidor w pasku z czasem i linkiem na pulpit', mini && /14:00/.test(mini.textContent) && mini.getAttribute('href') === '../', mini && mini.outerHTML.slice(0, 80));
w2.close();

/* --- 7. koniec bloku --- */
sprawdz('przed końcem nic się nie dzieje', P.sprawdzKoniec(T0 + 34 * MIN) === null);
const k = P.sprawdzKoniec(T0 + 35 * MIN);
sprawdz('koniec pracy → przerwa 5 min', k && k.byla === 'praca' && k.nastepna === 'przerwa' && k.nastepnaMinut === 5, JSON.stringify(k));
s = P.czytaj();
sprawdz('po końcu czeka przerwa (nie rusza sama)', s.faza === 'przerwa' && s.koniec === null && P.mmss(P.pozostalo(s)) === '05:00');
sprawdz('druga karta nie obsłuży końca drugi raz', P.sprawdzKoniec(T0 + 36 * MIN) === null);

/* powiadomienie z otwartej karty (gdy jest zgoda) i komunikat na stronie */
const powiadomienia = [];
w.Notification = function (tytul, o) { powiadomienia.push({ tytul, body: o.body, tag: o.tag }); };
w.Notification.permission = 'granted';
P.stop(); P.start(Date.now() - 26 * MIN);
P.tik();
sprawdz('koniec bloku: powiadomienie „Koniec pracy”', powiadomienia.length === 1 && powiadomienia[0].tytul === 'Koniec pracy' && powiadomienia[0].tag === 'pomidor', JSON.stringify(powiadomienia));
const kom = $('.pm-koniec');
sprawdz('koniec bloku: komunikat na stronie z „Start przerwy”', kom && kom.classList.contains('widoczny') && /Start przerwy/.test(kom.textContent));
klik($('.pm-koniec [data-pm="start"]'));
s = P.czytaj();
sprawdz('„Start przerwy” rusza przerwę i chowa komunikat', s.faza === 'przerwa' && s.koniec !== null && !$('.pm-koniec').classList.contains('widoczny'));
sprawdz('w trakcie: Pauza i Stop, długości zablokowane', $('[data-pm="pauza"]') && $('[data-pm="stop"]') && $$('.pm-krok').every(b => b.disabled));

/* bez zgody na powiadomienia zostaje dźwięk i komunikat */
w.Notification.permission = 'denied';
P.stop(); P.start(Date.now() - 26 * MIN);
P.tik();
sprawdz('bez zgody: brak powiadomienia, jest komunikat', powiadomienia.length === 1 && $('.pm-koniec').classList.contains('widoczny'));
klik($('.pm-koniec [data-pm="zamknij-koniec"]'));
sprawdz('komunikat da się zamknąć', !$('.pm-koniec').classList.contains('widoczny'));

/* --- 8. Stop wraca do pracy --- */
klik($('[data-pm="start"]'));
klik($('[data-pm="stop"]'));
s = P.czytaj();
sprawdz('Stop: z powrotem praca, timer stoi', s.faza === 'praca' && s.koniec === null && s.pauza === null);

/* --- 9. zadania z dzisiejszej Tablicy --- */
const TABLICA = 'tablica-scoringowa-v1';
const d0 = new Date(), dzis = d0.getFullYear() + '-' + String(d0.getMonth() + 1).padStart(2, '0') + '-' + String(d0.getDate()).padStart(2, '0');
const tablica = date => JSON.stringify({ version: 3, today: { date, tasks: [
  { id: 'a', name: 'Raport kwartalny', catId: null, points: 8, done: false, carry: 0 },
  { id: 'b', name: 'Zrobione wcześniej', done: true },
  { id: 'c', name: '   ', done: false }] }, plan: {}, history: [] });
const zTablicy = id => JSON.parse(w.localStorage.getItem(TABLICA)).today.tasks.find(t => t.id === id);
w.localStorage.setItem(TABLICA, tablica('2020-01-01'));
sprawdz('tablica z innego dnia: brak zadań do wyboru', P.zadaniaNaDzis().length === 0);
P.rysuj();
sprawdz('bez zadań na dziś nie ma pola wyboru', !$('[data-pm-zadanie]'));
w.localStorage.setItem(TABLICA, tablica(dzis));
sprawdz('na dziś: tylko niezrobione zadania z nazwą', P.zadaniaNaDzis().map(z => z.id).join(',') === 'a');
P.rysuj();
const sel = $('[data-pm-zadanie]');
sprawdz('przed startem: wybór „bez zadania” albo zadanie z Tablicy', sel && Array.from(sel.options).map(o => o.textContent.trim()).join(' | ') === 'bez zadania | Raport kwartalny');
sel.value = 'a'; sel.dispatchEvent(new w.Event('change', { bubbles: true }));
sprawdz('wybrane zadanie zapisuje się w stanie', P.czytaj().zadanie && P.czytaj().zadanie.id === 'a');
let zapisy = 0;
w.addEventListener('adhd:zapis', e => { if (e.detail && e.detail.klucz === TABLICA) zapisy++; });
P.start(T0);
P.rysuj(T0 + MIN);
sprawdz('w trakcie widać nazwę zadania', /Raport kwartalny/.test($('.pm-zad-nazwa') && $('.pm-zad-nazwa').textContent));
let kz = P.sprawdzKoniec(T0 + 25 * MIN);
sprawdz('ukończony blok dopisuje się do zadania (pomidory: 1)', zTablicy('a').pomidory === 1 && kz.zadanie.id === 'a' && kz.pomidory === 1, JSON.stringify(kz));
sprawdz('Tablica w tej karcie dostaje zdarzenie adhd:zapis', zapisy === 1);
sprawdz('reszta zadania nietknięta', zTablicy('a').points === 8 && zTablicy('a').name === 'Raport kwartalny');
P.start(T0 + 30 * MIN);
kz = P.sprawdzKoniec(T0 + 35 * MIN);
sprawdz('koniec przerwy niczego nie dopisuje', zTablicy('a').pomidory === 1 && !kz.zadanie);
P.start(T0 + 40 * MIN);
P.sprawdzKoniec(T0 + 65 * MIN);
sprawdz('drugi blok pracy: pomidory 2', zTablicy('a').pomidory === 2);

P.stop();
s = P.startZadania({ id: 'a', nazwa: 'Raport kwartalny' }, T0);
sprawdz('„▶ 25 min” z Tablicy: blok pracy z tym zadaniem', s.faza === 'praca' && s.zadanie.id === 'a' && s.koniec === T0 + 25 * MIN);
const t2 = JSON.parse(w.localStorage.getItem(TABLICA)); t2.today.tasks = t2.today.tasks.filter(t => t.id !== 'a'); w.localStorage.setItem(TABLICA, JSON.stringify(t2));
kz = P.sprawdzKoniec(T0 + 25 * MIN);
sprawdz('zadanie usunięte w międzyczasie: koniec bez dopisywania', kz && !kz.zadanie && kz.pomidory === 0);
w.localStorage.setItem(TABLICA, tablica(dzis));
P.stop(); P.ustawZadanie({ id: 'b', nazwa: 'Zrobione wcześniej' }); P.rysuj();
klik($('[data-pm="start"]'));
sprawdz('start z zadaniem już zrobionym → blok bez zadania', P.czytaj().zadanie === null && P.czytaj().koniec !== null);
P.stop();

/* --- 10. pasek górny ma miejsce na pomidora i dociąga go na każdej stronie --- */
const pasek = fs.readFileSync(path.join(__dirname, 'pasek-gorny.js'), 'utf8');
sprawdz('pasek górny: miejsce [data-pomidor-mini] i dociąganie pomidor.js', /data-pomidor-mini/.test(pasek) && /pomidor\.js/.test(pasek));
sprawdz('stan tylko na tym urządzeniu (poza synchronizacją)', !/pomidor-v1/.test(fs.readFileSync(path.join(__dirname, 'chmura.js'), 'utf8')));

console.log('\nBłędy w konsoli: ' + (bledy.length ? '\n  ' + bledy.join('\n  ') : 'brak'));
if (bledy.length) process.exitCode = 1;
w.close();   // zatrzymuje setInterval timera, żeby node mógł się zakończyć
