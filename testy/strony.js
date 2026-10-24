/* STRAŻNIK 2 — strony w prawdziwej przeglądarce
   Każda strona w czterech wariantach (1100 i 390 px × motyw ciemny i CYBER), ze stałym zegarem i przykładowymi danymi.
   Twarde progi (kod wyjścia 1):
     - błąd w konsoli albo wyjątek na stronie
     - poziome przewijanie
     - naruszenie dostępności axe (WCAG 2 A/AA) o wadze „serious” albo „critical”
     - para tekst/tło z tokenów poniżej 4,5:1 (WCAG AA)
   Do porównania zapisuje zrzuty (z wyłączonym ruchem, żeby fala nie psuła porównań).

   Użycie: node strony.js <folder strony> [--wyniki <folder>] [--tylko-zrzuty]
   CHROMIUM=/ścieżka/do/chrome — własna przeglądarka zamiast tej z „npx playwright install”. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { default: AxeBuilder } = require('@axe-core/playwright');
const { TERAZ, DANE } = require('./dane-przykladowe');

const argumenty = process.argv.slice(2);
const KORZEN = path.resolve(argumenty.find(a => !a.startsWith('--')) || '..');
const WYNIKI = path.resolve(argumenty.includes('--wyniki') ? argumenty[argumenty.indexOf('--wyniki') + 1] : path.join(__dirname, 'wyniki'));
const TYLKO_ZRZUTY = argumenty.includes('--tylko-zrzuty');

const STRONY = [
  ['pulpit', 'index.html'], ['pasek', 'pasek/'], ['tablica', 'tablica/'], ['plany', 'plany/'],
  ['woop', 'woop/'], ['prywatnosc', 'prywatnosc.html'], ['przypomnienia', 'przypomnienia.html']
];
const WARIANTY = [
  { nazwa: '1100-ciemny', szer: 1100, wys: 900, cyber: false },
  { nazwa: '390-ciemny', szer: 390, wys: 844, cyber: false },
  { nazwa: '1100-cyber', szer: 1100, wys: 900, cyber: true },
  { nazwa: '390-cyber', szer: 390, wys: 844, cyber: true }
];
// pary tekst/tło do sprawdzenia kontrastu (tło półprzezroczyste nakładamy na --s-pow)
const PARY = [
  ['--s-tusz', '--s-tlo'], ['--s-tusz', '--s-pow'], ['--s-tusz-2', '--s-pow'], ['--s-przygaszony', '--s-pow'],
  ['--s-przygaszony', '--s-tlo'], ['--s-tusz', '--s-akcent-40'], ['--s-akcent', '--s-pow'], ['--s-akcent', '--s-tlo'],
  ['--s-niepowodzenie', '--s-niepowodzenie-tlo'], ['--s-ok', '--s-ok-tlo'], ['--s-uwaga', '--s-uwaga-tlo'],
  ['--s-blad', '--s-pow'], ['--s-kartka-tusz', '--s-kartka']
];
const HOSTY_CZCIONEK = /fonts\.(googleapis|gstatic)\.com/;

/* prosty serwer plików strony (bez zależności) */
const TYPY = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
function serwer() {
  return new Promise(ok => {
    const s = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const plik = path.join(KORZEN, p);
      if (!plik.startsWith(KORZEN) || !fs.existsSync(plik) || fs.statSync(plik).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': TYPY[path.extname(plik)] || 'application/octet-stream' });
      fs.createReadStream(plik).pipe(res);
    }).listen(0, '127.0.0.1', () => ok(s));
  });
}

/* kontrast WCAG z koloru CSS (rgb(…) albo color(srgb …)), z nakładaniem półprzezroczystego tła */
function rgba(css) {
  let m = css.match(/rgba?\(([^)]+)\)/);
  if (m) { const c = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [c[0] / 255, c[1] / 255, c[2] / 255, c[3] == null ? 1 : c[3]]; }
  m = css.match(/color\(srgb ([^)]+)\)/);
  if (m) { const c = m[1].split(/[ /]+/).filter(Boolean).map(Number); return [c[0], c[1], c[2], c[3] == null ? 1 : c[3]]; }
  throw new Error('nie rozumiem koloru: ' + css);
}
const naloz = (g, d) => [0, 1, 2].map(i => g[i] * g[3] + d[i] * (1 - g[3])).concat(1);
const lum = c => { const f = v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const kontrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

async function main() {
  fs.mkdirSync(path.join(WYNIKI, 'zrzuty'), { recursive: true });
  const srv = await serwer();
  const adres = `http://127.0.0.1:${srv.address().port}/`;
  const przegladarka = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const raport = { strony: [], kontrast: [], porazki: [] };

  for (const w of WARIANTY) {
    for (const [id, url] of STRONY) {
      const kontekst = await przegladarka.newContext({
        viewport: { width: w.szer, height: w.wys }, locale: 'pl-PL', timezoneId: 'Europe/Warsaw',
        reducedMotion: 'reduce', colorScheme: 'dark'
      });
      await kontekst.addInitScript(([dane, cyber]) => {
        if (sessionStorage.getItem('straznik')) return;
        sessionStorage.setItem('straznik', '1');
        localStorage.clear();
        for (const k in dane) localStorage.setItem(k, typeof dane[k] === 'string' ? dane[k] : JSON.stringify(dane[k]));
        if (cyber) localStorage.setItem('adhd.skin', 'cyber');
      }, [DANE, w.cyber]);
      const strona = await kontekst.newPage();
      await strona.clock.install({ time: TERAZ });
      const bledy = [];
      strona.on('pageerror', e => bledy.push('wyjątek: ' + e.message));
      strona.on('console', m => {
        if (m.type() !== 'error') return;
        const zrodlo = (m.location() || {}).url || '';
        if (HOSTY_CZCIONEK.test(zrodlo) || (/Failed to load resource/.test(m.text()) && HOSTY_CZCIONEK.test(m.text() + zrodlo))) return;
        bledy.push('konsola: ' + m.text());
      });
      strona.on('requestfailed', r => { if (!HOSTY_CZCIONEK.test(r.url())) bledy.push('nie wczytano: ' + r.url()); });

      await strona.goto(adres + url, { waitUntil: 'load' });
      await strona.clock.runFor(1500);   // pozwól stronie dorysować się (timery, montowanie modułów)
      const poziome = await strona.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);

      let dostepnosc = [];
      if (!TYLKO_ZRZUTY) {
        const a11y = await new AxeBuilder({ page: strona }).withTags(['wcag2a', 'wcag2aa']).analyze();
        dostepnosc = a11y.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')
          .map(v => ({ regula: v.id, waga: v.impact, opis: v.help, ile: v.nodes.length, przyklad: (v.nodes[0] || {}).target }));
      }

      const plik = `${id}-${w.nazwa}.png`;
      await strona.screenshot({ path: path.join(WYNIKI, 'zrzuty', plik), fullPage: true });

      // kontrast tokenów: raz na motyw, na pulpicie
      if (!TYLKO_ZRZUTY && id === 'pulpit' && w.szer === 1100) {
        const kolory = await strona.evaluate(tokeny => {
          // przeglądarka sama przelicza kolor (także color-mix w oklch) na piksel RGBA na kanwie
          const el = document.createElement('div'); document.body.appendChild(el);
          const ctx = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true });
          const wynik = {};
          tokeny.forEach(t => {
            el.style.color = `var(${t})`;
            ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = getComputedStyle(el).color; ctx.fillRect(0, 0, 1, 1);
            const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
            wynik[t] = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
          });
          el.remove(); return wynik;
        }, [...new Set(PARY.flat())]);
        const pow = rgba(kolory['--s-pow']);
        PARY.forEach(([tekst, tlo]) => {
          const t = rgba(kolory[tekst]), b = naloz(rgba(kolory[tlo]), pow);
          const k = kontrast(naloz(t, b), b);
          raport.kontrast.push({ motyw: w.cyber ? 'CYBER' : 'ciemny', tekst, tlo, kontrast: Math.round(k * 100) / 100, ok: k >= 4.5 });
        });
      }

      raport.strony.push({ strona: id, wariant: w.nazwa, bledy, poziome, dostepnosc, zrzut: plik });
      await kontekst.close();
      const stan = bledy.length || poziome || dostepnosc.length ? 'BŁĄD' : 'ok  ';
      console.log(`${stan} ${id} ${w.nazwa}${bledy.length ? ' — ' + bledy.join(' | ') : ''}${poziome ? ' — poziome przewijanie' : ''}${dostepnosc.length ? ' — dostępność: ' + dostepnosc.map(d => `${d.regula} (${d.ile})`).join(', ') : ''}`);
    }
  }
  await przegladarka.close();
  srv.close();

  if (!TYLKO_ZRZUTY) {
    raport.strony.forEach(s => {
      s.bledy.forEach(b => raport.porazki.push(`${s.strona} ${s.wariant}: ${b}`));
      if (s.poziome) raport.porazki.push(`${s.strona} ${s.wariant}: poziome przewijanie`);
      s.dostepnosc.forEach(d => raport.porazki.push(`${s.strona} ${s.wariant}: ${d.regula} (${d.waga}, ${d.ile}×) — ${d.opis}`));
    });
    raport.kontrast.filter(k => !k.ok).forEach(k => raport.porazki.push(`kontrast ${k.motyw}: ${k.tekst} na ${k.tlo} = ${k.kontrast}:1 (wymagane 4,5:1)`));
    raport.kontrast.forEach(k => console.log(`${k.ok ? 'ok  ' : 'BŁĄD'} kontrast ${k.motyw}: ${k.tekst} na ${k.tlo} = ${k.kontrast}:1`));
  }
  fs.writeFileSync(path.join(WYNIKI, 'raport.json'), JSON.stringify(raport, null, 1));

  let md = '';
  if (!TYLKO_ZRZUTY) {
    md += `### Strony w przeglądarce\n\n${raport.strony.length} widoków (7 stron × 1100/390 px × ciemny/CYBER). `;
    md += raport.porazki.length ? `**${raport.porazki.length} problemów:**\n\n` + raport.porazki.map(p => `- ${p}`).join('\n') + '\n\n' : 'Bez błędów w konsoli, bez poziomego przewijania, bez poważnych naruszeń dostępności.\n\n';
    md += '<details><summary>Kontrast par tekst/tło z tokenów</summary>\n\n| Motyw | Tekst | Tło | Kontrast |\n|---|---|---|---|\n' +
      raport.kontrast.map(k => `| ${k.motyw} | \`${k.tekst}\` | \`${k.tlo}\` | ${k.ok ? '✅' : '❌'} ${k.kontrast}:1 |`).join('\n') + '\n\n</details>\n\n';
  }
  fs.writeFileSync(path.join(WYNIKI, 'raport.md'), md);
  if (process.env.GITHUB_STEP_SUMMARY && md) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  if (raport.porazki.length) process.exitCode = 1;
}
main().catch(e => { console.error(e); process.exit(1); });
