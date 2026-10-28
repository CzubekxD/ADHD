/* STRAŻNIK 4 — synchronizacja z Google Drive między dwoma urządzeniami
   Dwie przeglądarki (A i B) z udawanym Google Drive (appDataFolder w pamięci), bez prawdziwego konta.
   Sprawdza na Skrzynce na myśli (pulpit) i WOOP:
     - myśl zapisana na A pojawia się na B po otwarciu strony
     - myśli z obu urządzeń się scalają, „zrobione” na jednym znika na drugim
     - OTWARTA karta dostaje zmianę z drugiego urządzenia bez przeładowania (okresowe sprawdzanie)
     - Ctrl+Z po takiej zmianie nie kasuje cudzej myśli
     - wynik dnia WOOP kliknięty na pulpicie B trafia do WOOP na A
   Użycie: node synchronizacja.js <folder strony>; CHROMIUM / PRZEGLADARKI jak w strony.js. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const playwright = require('playwright');

const KORZEN = path.resolve(process.argv[2] || '..');
const TYPY = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };
const serwer = () => new Promise(ok => {
  const s = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
    const plik = path.join(KORZEN, p);
    if (!plik.startsWith(KORZEN) || !fs.existsSync(plik) || fs.statSync(plik).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPY[path.extname(plik)] || 'application/octet-stream' }); fs.createReadStream(plik).pipe(res);
  }).listen(0, '127.0.0.1', () => ok(s));
});

/* udawany Drive: lista, pobranie, utworzenie (multipart), nadpisanie */
function udawanyDrive() {
  const pliki = {}; let n = 0;
  const czas = () => new Date(Date.now() + (++n)).toISOString();
  async function obsluz(route) {
    const r = route.request(), u = new URL(r.url()), m = r.method();
    if (u.hostname === 'accounts.google.com') return route.fulfill({ status: 200, contentType: 'text/javascript', body: '' });
    if (u.hostname !== 'www.googleapis.com') return route.abort();
    if (u.pathname.startsWith('/drive/v3/about')) return route.fulfill({ json: { user: { emailAddress: 'test@example.org' } } });
    if (m === 'GET' && u.pathname === '/drive/v3/files') return route.fulfill({ json: { files: Object.entries(pliki).map(([id, f]) => ({ id, name: f.name, modifiedTime: f.mod })) } });
    if (m === 'GET' && u.pathname.startsWith('/drive/v3/files/')) return route.fulfill({ status: 200, contentType: 'application/json', body: pliki[u.pathname.split('/').pop()].tekst });
    if (m === 'POST' && u.pathname === '/upload/drive/v3/files') {
      const granica = (r.headers()['content-type'] || '').split('boundary=')[1];
      const czesci = r.postData().split('--' + granica);
      const meta = JSON.parse(czesci[1].split('\r\n\r\n')[1]);
      const tekst = czesci[2].split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, '');
      const id = 'f' + (++n); pliki[id] = { name: meta.name, tekst, mod: czas() };
      return route.fulfill({ json: { id, modifiedTime: pliki[id].mod } });
    }
    if (m === 'PATCH' && u.pathname.startsWith('/upload/drive/v3/files/')) {
      const id = u.pathname.split('/').pop(); pliki[id].tekst = r.postData(); pliki[id].mod = czas();
      return route.fulfill({ json: { id, modifiedTime: pliki[id].mod } });
    }
    return route.fulfill({ status: 404, body: '' });
  }
  return { obsluz, pliki };
}

const wyniki = [];
const sprawdz = (nazwa, ok, dodatek) => { wyniki.push({ nazwa, ok }); console.log((ok ? 'ok   ' : 'BŁĄD ') + nazwa + (dodatek ? ' — ' + dodatek : '')); };

async function scenariusz(silnik, adres) {
  const przegladarka = await playwright[silnik].launch(silnik === 'chromium' && process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const drive = udawanyDrive();
  const bledy = [];
  async function urzadzenie(nazwa) {
    const c = await przegladarka.newContext({ viewport: { width: 1100, height: 900 }, locale: 'pl-PL' });
    await c.route(/googleapis\.com|accounts\.google\.com|fonts\.g/, drive.obsluz);
    await c.addInitScript(() => {
      if (!localStorage.getItem('adhd.chmura')) localStorage.setItem('adhd.chmura', JSON.stringify({ wlaczona: true, email: 'test@example.org', pliki: {} }));
      localStorage.setItem('adhd.chmura.token', JSON.stringify({ t: 'token-testowy', exp: Date.now() + 3600e3 }));
      localStorage.setItem('adhd.wstep.v1', '1');   // wprowadzenie dla nowych osób już widziane — nie zasłania pulpitu
    });
    const p = await c.newPage();
    p.on('pageerror', e => bledy.push(`${nazwa}: ${e.message}`));
    await p.goto(adres); await p.waitForTimeout(1500);
    return p;
  }
  const kartki = p => p.evaluate(() => (JSON.parse(localStorage.getItem('skrzynka-v1') || '{"kartki":[]}').kartki || []).map(k => k.tekst).sort());
  const widac = p => p.evaluate(() => [...document.querySelectorAll('.sk .sk-kartka .sk-tekst')].map(e => e.textContent).sort());
  const wpisz = async (p, t) => { await p.fill('.sk form[data-skrzynka-pole] input', t); await p.press('.sk form[data-skrzynka-pole] input', 'Enter'); };
  const wyslij = p => p.evaluate(() => Chmura.synchronizuj('zmiana')).then(() => p.waitForTimeout(400));
  const sprawdzDrive = p => p.evaluate(() => Chmura.synchronizuj('okresowo')).then(() => p.waitForTimeout(400));
  const s = (n, ok, d) => sprawdz(`${silnik}: ${n}`, ok, d);

  const A = await urzadzenie('A'), B = await urzadzenie('B');
  await wpisz(A, 'myśl z A'); await wyslij(A);
  await B.reload(); await B.waitForTimeout(1500);
  s('myśl z A widać na B po otwarciu', (await widac(B)).join() === 'myśl z A', (await widac(B)).join(' | '));

  await wpisz(B, 'myśl z B'); await wyslij(B);
  await sprawdzDrive(A);
  s('otwarta karta A dostaje myśl z B bez przeładowania', (await widac(A)).join() === 'myśl z A,myśl z B', (await widac(A)).join(' | '));

  await A.keyboard.press('Control+z'); await A.waitForTimeout(300);
  s('Ctrl+Z po synchronizacji nie kasuje myśli z B', (await kartki(A)).includes('myśl z B'), (await kartki(A)).join(' | '));

  await A.evaluate(() => [...document.querySelectorAll('.sk .sk-kartka')].find(k => k.textContent.includes('myśl z A')).querySelector('.sk-zrobione').click());
  await wyslij(A); await sprawdzDrive(B);
  s('„zrobione” na A znika na otwartej karcie B', (await widac(B)).join() === 'myśl z B', (await widac(B)).join(' | '));

  // WOOP: wynik dnia z pulpitu B trafia do WOOP otwartego na A (dane narzędzia otwartego na stronie → komunikat „Wczytaj”)
  const woop = { items: [{ id: 'w1', wish: 'Czytać wieczorem', updated: 1, checks: {} }] };
  await B.evaluate(w => localStorage.setItem('woop-v1', JSON.stringify(w)), woop); await wyslij(B);
  await A.goto(adres.replace('index.html', 'woop/')); await A.waitForTimeout(2000);
  await B.reload(); await B.waitForTimeout(1500);
  const dzis = await B.evaluate(() => Pulpit.dzis());
  await B.click(`[data-woop-dzien="${dzis}"]`); await wyslij(B);
  await sprawdzDrive(A);
  const stanA = await A.evaluate(() => { const b = document.querySelector('.pg-chmura'); return b ? b.dataset.stan : ''; });
  s('WOOP otwarty na A zgłasza nowe dane z pulpitu B („Wczytaj”)', stanA === 'nowe', stanA);
  await A.evaluate(() => Chmura.synchronizuj('wczytaj')); await A.waitForTimeout(2500);
  const checkA = await A.evaluate(d => ((JSON.parse(localStorage.getItem('woop-v1') || '{}').items || [])[0] || { checks: {} }).checks[d] || '', dzis);
  s('po „Wczytaj” WOOP na A ma wynik dnia z B', checkA === 'ok', checkA || 'brak');

  s('bez błędów na stronach', bledy.length === 0, bledy.join(' | '));
  await przegladarka.close();
}

(async () => {
  const srv = await serwer();
  const adres = `http://127.0.0.1:${srv.address().port}/index.html`;
  for (const silnik of (process.env.PRZEGLADARKI || 'chromium').split(',').map(x => x.trim()).filter(Boolean)) await scenariusz(silnik, adres);
  srv.close();
  const zle = wyniki.filter(w => !w.ok);
  const md = `### Synchronizacja (dwa urządzenia, udawany Google Drive)\n\n` + wyniki.map(w => `- ${w.ok ? '✅' : '❌'} ${w.nazwa}`).join('\n') + '\n\n';
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  if (zle.length) process.exitCode = 1;
})().catch(e => { console.error(e); process.exit(1); });
