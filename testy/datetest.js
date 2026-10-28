/* DATETEST — świadoma zmiana daty tablicy (Tablica z zadaniami v13 specyfikacji)
   Stały zegar: dziś = 2026-10-20, tablica z 2026-10-19.
   Sprawdza: blokadę przy starej dacie, przeniesienie na dziś bez utraty zadań i punktów,
   scalenie z planem (z dedupem), konflikt z historią (zastąp / anuluj) i Cofnij.
   Użycie: node datetest.js   (CHROMIUM=/ścieżka — własna przeglądarka) */
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
const ciezka = { id: 'k21', name: 'głęboka praca', points: 21 };
function dane(extra) {
  return Object.assign({
    version: 3, categories: [kat, ciezka],
    pinned: { on: false, name: 'x', catName: 'x' },
    today: { date: WCZORAJ, tasks: [
      { id: 'a', name: 'Raport', catId: 'k3', points: null, done: true, doneAt: TERAZ.toISOString(), carry: 0 },
      { id: 'b', name: 'Książka', catId: 'k21', points: null, done: false, started: true, startDay: WCZORAJ, carry: 1 },
      { id: 'c', name: 'Mail', catId: 'k3', points: null, done: false, carry: 0 }
    ] },
    plan: {}, history: [], recent: []
  }, extra || {});
}

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
const zdobyte = page => page.evaluate(() => S.today.tasks.reduce((a, t) => a + earnedOf(t), 0));

(async () => {
  const srv = await serwer();
  const adres = `http://127.0.0.1:${srv.address().port}/`;
  const przegladarka = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});

  console.log('1. Blokada przy starej dacie');
  let page = await strona(przegladarka, adres, dane());
  sprawdz(await page.locator('#todayCard').evaluate(e => e.hasAttribute('inert') && e.classList.contains('zablok')), 'tabela zadań zablokowana i przygaszona');
  sprawdz(await page.locator('#dayBtns').evaluate(e => e.hasAttribute('inert')), 'przyciski dnia zablokowane');
  sprawdz(await page.locator('#rollSave').innerText() === 'Zapisz 19.10.2026 i zacznij dziś', 'akcja „Zapisz [data] i zacznij dziś”');
  sprawdz(await page.locator('#rollToday').isVisible(), 'akcja „To jest tablica na dziś”');
  sprawdz((await page.locator('#rollStay').innerText()).includes('Zostań przy 19.10.2026'), 'akcja „Zostań przy [data]”');
  await page.click('#rollStay');
  sprawdz(!(await page.locator('#todayCard').evaluate(e => e.hasAttribute('inert'))), '„Zostań przy” odblokowuje tabelę');
  sprawdz(await page.locator('#rollover .banner').count() === 0, 'baner znika po „Zostań przy”');
  sprawdz((await S(page)).today.date === WCZORAJ, 'data tablicy bez zmian');
  await page.close();

  console.log('2. „To jest tablica na dziś” zachowuje zadania i punkty');
  page = await strona(przegladarka, adres, dane());
  const przed = await zdobyte(page);
  await page.click('#rollToday');
  let s = await S(page);
  sprawdz(s.today.date === DZIS, 'data tablicy = dziś');
  sprawdz(s.today.tasks.map(t => t.id).join() === 'a,b,c', 'te same zadania, w tej samej kolejności');
  sprawdz(s.today.tasks[0].done === true, 'zaznaczenie zostaje');
  sprawdz(s.today.tasks[1].startDay === DZIS && s.today.tasks[1].carry === 1, 'start przeniesiony na dziś, carry bez zmian');
  sprawdz(await zdobyte(page) === przed && przed > 0, `punkty bez zmian (${przed})`);
  sprawdz(!(await page.locator('#todayCard').evaluate(e => e.hasAttribute('inert'))), 'tablica odblokowana');
  sprawdz((await page.locator('#todayLabel').innerText()).startsWith('20.10.2026'), 'nagłówek pokazuje nową datę');
  await page.close();

  console.log('3. Scalenie z planem dnia');
  page = await strona(przegladarka, adres, dane({ plan: {
    [DZIS]: [{ id: 'p1', name: 'mail', catId: 'k3', done: false, carry: 1 }, { id: 'p2', name: 'Zakupy', catId: 'k3', done: false, carry: 0 }],
    '2026-10-22': [{ id: 'p3', name: 'Później', catId: 'k3', done: false, carry: 0 }]
  } }));
  await page.click('#todayLabel');
  await page.locator('#dataPole').fill(DZIS);
  const opis = await page.locator('#dataSkutki').innerText();
  sprawdz(opis.includes('3 zadania przejdzie na 20.10.2026'), 'podgląd: ile zadań przejdzie');
  sprawdz(opis.includes('dojdzie 1 zadanie') && opis.includes('1 już jest na tablicy'), 'podgląd: scalenie z dedupem');
  await page.click('.modal [data-a="1"]');
  s = await S(page);
  sprawdz(s.today.tasks.map(t => t.name).join() === 'Raport,Książka,Mail,Zakupy', 'plan scalony, duplikat „mail” pominięty');
  sprawdz(!s.plan[DZIS], 'kubełek planu usunięty');
  sprawdz(!!s.plan['2026-10-22'], 'inne dni planu zostają');
  await page.close();

  console.log('4. Konflikt z historią');
  const zapis = { date: DZIS, savedAt: TERAZ.toISOString(), earned: 5, possible: 10, done: 1, total: 2, perfect: false, scale: 1, cats: [] };
  page = await strona(przegladarka, adres, dane({ history: [zapis] }));
  await page.click('#todayLabel');
  await page.locator('#dataPole').fill(DZIS);
  sprawdz((await page.locator('#dataSkutki').innerText()).includes('zapytam'), 'podgląd ostrzega o zapisie w historii');
  await page.click('.modal [data-a="1"]');
  sprawdz((await page.locator('.modal .msg').innerText()).includes('W historii jest już zapis z 20.10.2026'), 'pytanie zastąp / anuluj');
  await page.click('.modal [data-a="0"]');
  s = await S(page);
  sprawdz(s.today.date === WCZORAJ && s.history.length === 1, 'Anuluj nic nie zmienia');
  await page.click('#rollToday');
  await page.click('.modal [data-a="1"]');
  s = await S(page);
  sprawdz(s.today.date === DZIS && s.history.length === 0, 'Zastąp przenosi tablicę i zdejmuje stary zapis');

  console.log('5. Cofnij');
  await page.locator('.skroty-toast button.akcja').click();
  s = await S(page);
  sprawdz(s.today.date === WCZORAJ && s.history.length === 1 && s.history[0].date === DZIS, 'Cofnij przywraca datę i zapis historii');
  sprawdz(s.today.tasks[1].startDay === WCZORAJ, 'Cofnij przywraca startDay');
  sprawdz(await page.locator('#todayCard').evaluate(e => e.hasAttribute('inert')), 'po Cofnij tablica znowu zablokowana');
  sprawdz(page.bledy.length === 0, 'bez błędów i natywnych dialogów' + (page.bledy.length ? ': ' + page.bledy.join('; ') : ''));
  await page.close();

  await przegladarka.close(); srv.close();
  console.log(`\n${ok} ✓, ${zle} ✗`);
  process.exit(zle ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
