/* STRAŻNIK 1 — testy jednostkowe (jsdom)
   Uruchamia wszystkie pliki testów z CLAUDE.md i zbiera wynik w jedno podsumowanie.
   Użycie: npm run jednostkowe (w folderze testy/). Kod wyjścia 1, gdy któryś test pada. */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const KORZEN = path.join(__dirname, '..');
const PLIKI = ['pasek/test.js', 'wspolne/pulpit.test.js', 'wspolne/skrzynka.test.js', 'wspolne/pomidor.test.js', 'wspolne/przypomnienia.test.js', 'wspolne/powtarzanie.test.js'];

const wyniki = PLIKI.map(plik => {
  const r = spawnSync(process.execPath, [path.join(KORZEN, plik)], {
    cwd: KORZEN, encoding: 'utf8', timeout: 120000,
    env: { ...process.env, NODE_PATH: path.join(__dirname, 'node_modules') }
  });
  const wyjscie = (r.stdout || '') + (r.stderr || '');
  const ok = (wyjscie.match(/^ {2}ok /gm) || []).length;
  const bledy = wyjscie.split('\n').filter(l => /BŁĄD|Error:/.test(l));
  // test z timerem (setInterval) nie kończy się sam — przekroczenie czasu przy zerze błędów to sukces
  const przeszedl = bledy.length === 0 && (r.status === 0 || (r.error && r.error.code === 'ETIMEDOUT')) && ok > 0;
  return { plik, ok, bledy, przeszedl };
});

let md = '### Testy jednostkowe\n\n| Plik | Sprawdzeń | Wynik |\n|---|---|---|\n';
wyniki.forEach(w => {
  md += `| \`${w.plik}\` | ${w.ok} | ${w.przeszedl ? '✅' : '❌ ' + w.bledy.slice(0, 3).join('; ').replace(/\|/g, '/')} |\n`;
  console.log(`${w.przeszedl ? 'ok  ' : 'BŁĄD'} ${w.plik}: ${w.ok} sprawdzeń${w.bledy.length ? ' — ' + w.bledy.join(' | ') : ''}`);
});
const wyjscieMd = process.env.GITHUB_STEP_SUMMARY;
if (wyjscieMd) fs.appendFileSync(wyjscieMd, md + '\n');
if (wyniki.some(w => !w.przeszedl)) process.exitCode = 1;
