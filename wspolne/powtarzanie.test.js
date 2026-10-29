/* Powtarzanie: reguły (codziennie, dni robocze, wybrane dni, co N dni, co miesiąc), opis i pola wyboru.
   Uruchomienie: node wspolne/powtarzanie.test.js (potrzebny jsdom, jak w pasek/test.js). */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!DOCTYPE html><body><div id="k"></div></body>', { runScripts: 'outside-only' });
const w = dom.window;
w.eval(fs.readFileSync(path.join(__dirname, 'odmiana.js'), 'utf8'));
w.eval(fs.readFileSync(path.join(__dirname, 'powtarzanie.js'), 'utf8'));
const P = w.Powtarzanie;
function sprawdz(nazwa, warunek, dodatek) {
  console.log((warunek ? '  ok  ' : ' BŁĄD ') + nazwa + (dodatek ? ' — ' + dodatek : ''));
  if (!warunek) process.exitCode = 1;
}
// 2026-10-31 to sobota, 2026-11-02 poniedziałek
sprawdz('brak reguły = codziennie', P.pasuje(undefined, '2026-10-29') && P.opis(null) === 'codziennie');
sprawdz('dni robocze: pt tak, sob nie', P.pasuje({ typ: 'robocze' }, '2026-10-30') && !P.pasuje({ typ: 'robocze' }, '2026-10-31'));
const sob = { typ: 'tydzien', dni: [5] };
sprawdz('w soboty: tylko sobota', P.pasuje(sob, '2026-10-31') && !P.pasuje(sob, '2026-10-29') && P.pasuje(sob, '2026-11-07'));
sprawdz('opis „w soboty”', P.opis(sob) === 'w soboty', P.opis(sob));
sprawdz('opis kilku dni', P.opis({ typ: 'tydzien', dni: [4, 0, 2] }) === 'w poniedziałki, środy i piątki', P.opis({ typ: 'tydzien', dni: [4, 0, 2] }));
sprawdz('najbliższa sobota od czwartku', P.najblizszy(sob, '2026-10-29') === '2026-10-31');
const co3 = { typ: 'coN', co: 3, od: '2026-10-29' };
sprawdz('co 3 dni od czwartku', P.pasuje(co3, '2026-10-29') && !P.pasuje(co3, '2026-10-30') && P.pasuje(co3, '2026-11-01') && !P.pasuje(co3, '2026-10-26'));
sprawdz('co 3 dni przez zmianę czasu', P.pasuje({ typ: 'coN', co: 3, od: '2026-10-23' }, '2026-10-26'));
sprawdz('opis co 3 dni', P.opis(co3) === 'co 3 dni');
const m31 = { typ: 'miesiac', dzien: 31 };
sprawdz('31. w listopadzie = 30.', P.pasuje(m31, '2026-11-30') && !P.pasuje(m31, '2026-11-29') && P.pasuje(m31, '2026-10-31'));
sprawdz('puste dni tygodnia → codziennie', P.norm({ typ: 'tydzien', dni: [] }).typ === 'codziennie');

/* pola wyboru */
const k = w.document.getElementById('k');
k.innerHTML = P.html({ typ: 'codziennie' }, 'Jak często');
let ost = null;
P.podepnij(k, r => { ost = r; });
const typ = k.querySelector('.powt-typ');
sprawdz('na start dni tygodnia ukryte', k.querySelector('.powt-dni').hidden);
typ.value = 'tydzien'; typ.dispatchEvent(new w.Event('change', { bubbles: true }));
sprawdz('wybór „dni tygodnia” pokazuje dni', !k.querySelector('.powt-dni').hidden && ost.typ === 'tydzien' && ost.dni.length === 1);
k.querySelectorAll('.powt-dni input').forEach(x => { x.checked = x.value === '5'; });
k.querySelector('.powt-dni input[value="5"]').dispatchEvent(new w.Event('change', { bubbles: true }));
sprawdz('zaznaczona sobota', JSON.stringify(ost) === JSON.stringify(sob), JSON.stringify(ost));
const sb = k.querySelector('.powt-dni input[value="5"]'); sb.checked = false; sb.dispatchEvent(new w.Event('change', { bubbles: true }));
sprawdz('ostatniego dnia nie da się odznaczyć', sb.checked && ost.dni.length === 1);
typ.value = 'miesiac'; typ.dispatchEvent(new w.Event('change', { bubbles: true }));
sprawdz('co miesiąc pokazuje dzień miesiąca', !k.querySelector('.powt-m').hidden && k.querySelector('.powt-dni').hidden && ost.typ === 'miesiac');
