/* STRAŻNIK 3 — porównanie zrzutów PR z main
   Oba zestawy zrzutów robi ten sam strażnik w tej samej przeglądarce, więc różnica to zmiana wyglądu, nie środowiska.
   Nie blokuje PR (zmiana wyglądu bywa zamierzona) — pokazuje, które widoki się zmieniły i o ile,
   a obrazy różnic trafiają do artefaktu, żeby nie trzeba było robić zrzutów ręcznie.
   Użycie: node porownaj.js <zrzuty main> <zrzuty PR> <folder na różnice> */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch');

const [przed, po, roznice] = process.argv.slice(2).map(p => path.resolve(p));
fs.mkdirSync(roznice, { recursive: true });

const pliki = fs.readdirSync(po).filter(f => f.endsWith('.png')).sort();
const wiersze = pliki.map(f => {
  const b = PNG.sync.read(fs.readFileSync(path.join(po, f)));
  if (!fs.existsSync(path.join(przed, f))) return { f, opis: 'nowy widok', proc: 100 };
  const a = PNG.sync.read(fs.readFileSync(path.join(przed, f)));
  // różna wysokość strony: porównujemy wspólną część, a zmianę wysokości zgłaszamy osobno
  const w = Math.min(a.width, b.width), h = Math.min(a.height, b.height);
  const wytnij = (img) => { const o = new PNG({ width: w, height: h }); PNG.bitblt(img, o, 0, 0, w, h, 0, 0); return o; };
  const A = wytnij(a), B = wytnij(b), D = new PNG({ width: w, height: h });
  const inne = pixelmatch(A.data, B.data, D.data, w, h, { threshold: 0.05 });
  const proc = Math.round(inne / (w * h) * 1000) / 10;
  if (inne) fs.writeFileSync(path.join(roznice, f.replace('.png', '-roznica.png')), PNG.sync.write(D));
  const wys = a.height !== b.height ? ` · wysokość ${a.height} → ${b.height} px` : '';
  const opis = inne ? (proc >= 0.1 ? `${String(proc).replace('.', ',')}% pikseli` : 'poniżej 0,1% pikseli') : 'bez zmian';
  return { f, opis: opis + wys, proc: (inne ? Math.max(proc, 0.01) : 0) + (wys ? 0.001 : 0) };
});

const zmienione = wiersze.filter(r => r.proc > 0).sort((x, y) => y.proc - x.proc);
let md = `### Zmiany wyglądu względem main\n\n`;
md += zmienione.length
  ? `${zmienione.length} z ${wiersze.length} widoków wygląda inaczej. Zrzuty i obrazy różnic są w artefakcie **zrzuty** tego przebiegu.\n\n| Widok | Zmiana |\n|---|---|\n` +
    zmienione.map(r => `| \`${r.f.replace('.png', '')}\` | ${r.opis} |`).join('\n') + '\n'
  : `Żaden z ${wiersze.length} widoków nie zmienił wyglądu.\n`;
console.log(md);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
