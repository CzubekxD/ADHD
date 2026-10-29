/* CODZIENNIE — szablon stałych zadań na tablicy (Tablica z zadaniami v17 specyfikacji)
   Stały zegar: dziś = 2026-10-20, tablica z 2026-10-19.
   Sprawdza: migrację „stałej pozycji” do szablonu, dodawanie w zakładce, kolejność na nowej tablicy
   (przypięte → Codziennie → Plan), brak przerzucania niezamkniętych zadań stałych na jutro.
   Użycie: node codziennie.js   (CHROMIUM=/ścieżka — własna przeglądarka) */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const KORZEN = path.resolve(__dirname, '..');
const KEY = 'tablica-scoringowa-v1';
const DZIS = '2026-10-20', WCZORAJ = '2026-10-19';
const TERAZ = new Date(DZIS + 'T14:00:00+02:00');

function serwer() {
  return new Promise(ok => {
    const s = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const plik = path.join(KORZEN, p);
      if (!plik.startsWith(KORZEN) || !fs.existsSync(plik) || fs.statSync(plik).isDirectory()) { res.writeHead(404); res.end(); return; }
      const typ = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(plik)] || 'application/octet-stream';
      res.writeHead(200, { 'content-type': typ });
      fs.createReadStream(plik).pipe(res);
    }).listen(0, '127.0.0.1', () => ok(s));
  });
}

const kat = { id: 'k3', name: 'praca administracyjna', points: 3 };
const dom = { id: 'k1', name: 'dom', points: 1 };
const staraKopia = () => ({
  version: 3, categories: [kat, dom],
  pinned: { on: true, name: 'SZOP', catName: 'praca administracyjna' },
  today: { date: WCZORAJ, tasks: [
    { id: 'p', name: 'SZOP', catId: 'k3', points: null, done: false, carry: 0, pin: true },
    { id: 'a', name: 'Raport', catId: 'k3', points: null, done: false, carry: 0 }
  ] },
  plan: { [DZIS]: [{ id: 'z', name: 'Z planu', catId: 'k1', points: null, done: false, carry: 0 }] },
  history: [], recent: []
});

let ok = 0, zle = 0;
function sprawdz(warunek, opis) {
  if (warunek) { ok++; console.log('  ✓ ' + opis); } else { zle++; console.log('  ✗ ' + opis); }
}

async function strona(przegladarka, adres, stan) {
  const ctx = await przegladarka.newContext({ viewport: { width: 1100, height: 900 } });
  const page = await ctx.newPage();
  const bledy = [];
  page.on('pageerror', e => bledy.push(String(e)));
  page.on('dialog', d => { bledy.push('natywny dialog: ' + d.type()); d.dismiss(); });
  await page.clock.setFixedTime(TERAZ);
  await page.addInitScript(([k, v]) => {
    if (!sessionStorage.getItem('zasiane')) { localStorage.setItem(k, v); sessionStorage.setItem('zasiane', '1'); }
  }, [KEY, JSON.stringify(stan)]);
  await page.goto(adres + 'tablica/');
  page.bledy = bledy;
  return page;
}
const S = page => page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);

(async () => {
  const srv = await serwer();
  const adres = `http://127.0.0.1:${srv.address().port}/`;
  const przegladarka = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});

  console.log('\n1. Migracja stałej pozycji do szablonu');
  let page = await strona(przegladarka, adres, staraKopia());
  let s = await S(page);
  sprawdz(s.version === 4, 'schemat podniesiony do 4');
  sprawdz(!('pinned' in s), 'pole pinned zniknęło');
  sprawdz(s.daily.length === 1 && s.daily[0].name === 'SZOP' && s.daily[0].catId === 'k3', 'SZOP w szablonie, z kategorią');

  console.log('\n2. Dodawanie w zakładce Stałe zadania');
  await page.click('button[data-tab="codziennie"]');
  await page.click('#btnAddDaily');
  await page.keyboard.type('Leki');
  s = await S(page);
  sprawdz(s.daily.length === 2 && s.daily[1].name === 'Leki', 'nowe zadanie zapisane w szablonie');
  sprawdz(await page.locator('#dailyRows tr:not(.kiedy)').count() === 2, 'dwa wiersze na liście');

  console.log('\n3. Nowy dzień: Codziennie przed Planem, stałe niezamknięte nie idą na jutro');
  await page.click('button[data-tab="dzis"]');
  await page.click('#rollSave');
  s = await S(page);
  const nazwy = s.today.tasks.map(t => t.name);
  sprawdz(nazwy.slice(0, 3).join() === 'SZOP,Leki,Z planu',
    'kolejność: SZOP, Leki, Z planu (jest: ' + nazwy.join(', ') + ')');
  sprawdz(s.today.tasks.filter(t => t.daily).length === 2 && s.today.tasks.filter(t => t.daily).every(t => t.pin), 'stałe oznaczone daily i pin');
  sprawdz(s.today.tasks.filter(t => t.name === 'SZOP').length === 1, 'SZOP jest raz (stary przypięty nie wrócił z przerzucenia)');
  const raport = s.today.tasks.find(t => t.name === 'Raport');
  sprawdz(raport && raport.carry === 1 && !raport.daily, 'zwykłe niezamknięte zadanie wróciło z premią (carry 1)');
  sprawdz(Object.values(s.plan).flat().length === 0, 'plan pusty po wciągnięciu na tablicę');

  console.log('\n4. „Zamknij i zacznij nowy dzień” z tablicy dziś');
  await page.click('#btnSaveRoll');
  s = await S(page);
  const jutro2 = Object.values(s.plan).flat().filter(t => t.name === 'SZOP' || t.name === 'Leki');
  sprawdz(jutro2.length === 0, 'stałe nie trafiły do planu z premią');
  sprawdz(s.today.tasks.filter(t => t.daily).length === 2, 'czysta tablica ma od razu stałe zadania');

  console.log('\n5. „Zamknij i zacznij nowy dzień” wciąga z Planu zadania na dziś');
  const dzis = staraKopia(); dzis.today.date = DZIS;
  const page2 = await strona(przegladarka, adres, dzis);
  await page2.click('#btnSaveRoll');
  s = await S(page2);
  sprawdz(s.today.tasks.some(t => t.name === 'Z planu'), 'zadanie z Planu na dziś jest na tablicy');
  sprawdz(!(s.plan[DZIS] || []).length, 'kubełek planu na dziś opróżniony');

  console.log('\n6. Powtarzanie: stałe zadanie tylko w soboty nie wjeżdża we wtorek');
  await page2.click('button[data-tab="codziennie"]');
  const wiersz = page2.locator('#dailyRows tr.kiedy').first();
  await wiersz.locator('.powt-typ').selectOption('tydzien');
  await wiersz.locator('.powt-dzien[title="sobota"]').click();
  await wiersz.locator('.powt-dzien[title="wtorek"]').click();
  s = await S(page2);
  sprawdz(JSON.stringify(s.daily[0].powt) === JSON.stringify({ typ: 'tydzien', dni: [5] }), 'zapisane: w soboty (jest: ' + JSON.stringify(s.daily[0].powt) + ')');
  await page2.click('button[data-tab="dzis"]');
  await page2.click('#btnSaveRoll');
  s = await S(page2);
  sprawdz(!s.today.tasks.some(t => t.name === 'SZOP'), 'we wtorek SZOP (w soboty) nie ma na tablicy');
  sprawdz(page2.bledy.length === 0, 'brak błędów na drugiej stronie' + (page2.bledy.length ? ': ' + page2.bledy.join('; ') : ''));

  sprawdz(page.bledy.length === 0, 'brak błędów na stronie' + (page.bledy.length ? ': ' + page.bledy.join('; ') : ''));
  await przegladarka.close(); srv.close();
  console.log(`\n${ok} ok, ${zle} błędów`);
  process.exit(zle ? 1 : 0);
})();
