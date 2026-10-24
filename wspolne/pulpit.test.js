/* Pulpit według pory dnia: podmieniamy godzinę i sprawdzamy kolejność i wielkość kart.
   Uruchomienie: node wspolne/pulpit.test.js (potrzebny jsdom, jak w pasek/test.js). */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!DOCTYPE html><div id="pulpit"></div>', { runScripts: 'outside-only', url: 'https://example.org/' });
const { window } = dom;
const bledy = [];
window.console.error = (...a) => bledy.push(a.join(' '));
['odmiana.js', 'narzedzia.js', 'pulpit.js'].forEach(f => window.eval(fs.readFileSync(path.join(__dirname, f), 'utf8')));

const { document, Pulpit } = window;
const cel = document.getElementById('pulpit');

function sprawdz(nazwa, warunek, dodatek) {
  console.log((warunek ? '  ok  ' : ' BŁĄD ') + nazwa + (dodatek ? ' — ' + dodatek : ''));
  if (!warunek) process.exitCode = 1;
}
const o = (h, m) => new Date(2026, 9, 19, h, m || 0);
const ids = s => Array.from(cel.querySelectorAll(s)).map(e => e.dataset.narzedzie).join(',');
function rysuj(h, m) {
  Pulpit.rysuj(cel, { korzen: './', teraz: o(h, m) });
  const grupa = t => { const g = cel.querySelector(`.pp-grupa[aria-label="${t}"]`); return g ? Array.from(g.querySelectorAll('.pp-w')).map(e => e.dataset.narzedzie).join(',') : ''; };
  return { pora: cel.dataset.pora, gora: ids(':scope > .pp-siatka > .pp-w'), pozniej: grupa('Później dziś'), wczesniej: grupa('Wcześniej dziś') };
}
const opis = r => `${r.pora} | góra: ${r.gora} | później: ${r.pozniej} | wcześniej: ${r.wczesniej}`;

/* --- 1. trzy pory z tabeli planu --- */
let r = rysuj(9);
sprawdz('9:00 — rano: Pasek, Tablica u góry; Plany i WOOP później', r.pora === 'rano' && r.gora === 'pasek,tablica' && r.pozniej === 'plany,woop' && r.wczesniej === '', opis(r));
r = rysuj(15);
sprawdz('15:00 — w ciągu dnia: Plany, Pasek u góry; Tablica i WOOP później', r.pora === 'dzien' && r.gora === 'plany,pasek' && r.pozniej === 'tablica,woop' && r.wczesniej === '', opis(r));
r = rysuj(21);
sprawdz('21:00 — wieczór: WOOP, Tablica u góry; Pasek i Plany wcześniej', r.pora === 'wieczor' && r.gora === 'woop,tablica' && r.pozniej === '' && r.wczesniej === 'pasek,plany', opis(r));

/* --- 2. granice godzin --- */
[[4, 59, 'wieczor'], [5, 0, 'rano'], [11, 59, 'rano'], [12, 0, 'dzien'], [17, 59, 'dzien'], [18, 0, 'wieczor'], [0, 0, 'wieczor']].forEach(([h, m, p]) => {
  sprawdz(`${h}:${String(m).padStart(2, '0')} to ${p}`, rysuj(h, m).pora === p);
});

/* --- 3. tytuły pór --- */
sprawdz('tytuły: Dzień dobry / Popołudnie / Wieczór',
  [9, 15, 21].map(h => Pulpit.pora(o(h)).tytul).join(' / ') === 'Dzień dobry / Popołudnie / Wieczór');

/* --- 4. każde narzędzie jest na pulpicie dokładnie raz, mniejsze karty działają tak samo --- */
[9, 15, 21].forEach(h => {
  rysuj(h);
  const wszystkie = ids('.pp-w').split(',').sort().join(',');
  sprawdz(`${h}:00 — każde narzędzie raz`, wszystkie === window.NARZEDZIA.map(n => n.id).sort().join(','), wszystkie);
  sprawdz(`${h}:00 — karty u góry duże, reszta mała`,
    cel.querySelectorAll(':scope > .pp-siatka > .pp-w.maly').length === 0 &&
    Array.from(cel.querySelectorAll('.pp-grupa .pp-w')).every(e => e.classList.contains('maly')));
});
rysuj(9);
const woopMaly = cel.querySelector('.pp-grupa [data-narzedzie="woop"]');
sprawdz('mała karta prowadzi do narzędzia', woopMaly && woopMaly.getAttribute('href') === './woop/');

/* --- 5. z danymi (widżet z liczbą dnia) kolejność jest ta sama --- */
const dzis = Pulpit.dzis();
window.localStorage.setItem('woop-v1', JSON.stringify({ items: [{ id: 'a', wish: 'Spokojny wieczór', updated: 1, checks: {} }] }));
window.localStorage.setItem('tablica-scoringowa-v1', JSON.stringify({ today: { date: dzis, tasks: [] }, history: [{ date: '2026-10-18' }] }));
r = rysuj(21);
sprawdz('21:00 z danymi — WOOP i Tablica jako widżety u góry', r.gora === 'woop,tablica' &&
  cel.querySelectorAll(':scope > .pp-siatka > section.pp-w').length === 2, opis(r));
r = rysuj(9);
sprawdz('9:00 z danymi — widżet WOOP jest mały, pod „Później dziś”', r.pozniej === 'plany,woop' &&
  cel.querySelector('.pp-grupa section.pp-w.maly[data-narzedzie="woop"]') !== null, opis(r));

/* --- 6. wynik dnia WOOP z kropek: jedyny zapis pulpitu --- */
const wczoraj = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();
const jutro = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();
const stanWczoraj = () => (JSON.parse(window.localStorage.getItem('woop-v1')).items[0].checks || {})[wczoraj] || '';
const kolejne = [1, 2, 3, 4].map(() => (Pulpit.ustawDzienWoop('a', wczoraj), stanWczoraj()));
sprawdz('kropka przełącza: zadziałało → nie zadziałało → nie było okazji → brak', kolejne.join(',') === 'ok,miss,skip,', kolejne.join(','));
sprawdz('przyszłego dnia nie da się zaznaczyć', Pulpit.ustawDzienWoop('a', jutro) === null && !(JSON.parse(window.localStorage.getItem('woop-v1')).items[0].checks || {})[jutro]);
sprawdz('nieznany WOOP: nic się nie zapisuje', Pulpit.ustawDzienWoop('nie-ma', wczoraj) === null);
rysuj(21);
const kropka = cel.querySelector(`[data-woop-dzien="${wczoraj}"]`);
sprawdz('kropki na karcie WOOP to przyciski z opisem dnia', kropka && kropka.tagName === 'BUTTON' && /Kliknij, żeby zmienić/.test(kropka.getAttribute('aria-label')) && cel.querySelectorAll('[data-woop-dzien]').length === 7);

console.log('\nBłędy w konsoli: ' + (bledy.length ? '\n  ' + bledy.join('\n  ') : 'brak'));
if (bledy.length) process.exitCode = 1;
