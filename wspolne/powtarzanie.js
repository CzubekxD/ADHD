/* ---------------------------------------------------------------
   POWTARZANIE — jak często coś wraca (jak w Kalendarzu Google)
   Reguła (zapisywana w danych narzędzia):
     brak / { typ: 'codziennie' }          — każdego dnia
     { typ: 'robocze' }                    — od poniedziałku do piątku
     { typ: 'tydzien', dni: [5] }          — w wybrane dni tygodnia (0 = pon … 6 = nd)
     { typ: 'coN', co: 2, od: '2026-10-29' } — co N dni, licząc od dnia „od”
     { typ: 'miesiac', dzien: 15 }         — co miesiąc tego dnia (31 → ostatni dzień krótszego miesiąca)
   Powtarzanie.pasuje(r, '2026-10-31') → true/false
   Powtarzanie.opis(r)                 → 'w soboty'
   Powtarzanie.najblizszy(r, od)       → najbliższy pasujący dzień od „od” włącznie
   Powtarzanie.html(r, etykieta)       → pola wyboru; Powtarzanie.podepnij(kontener, zmiana) je ożywia
   --------------------------------------------------------------- */
(function () {
  'use strict';
  const DNI = ['pon', 'wt', 'śr', 'czw', 'pt', 'sob', 'nd'];
  const DNI_DL = ['poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota', 'niedziela'];
  const DNI_MN = ['poniedziałki', 'wtorki', 'środy', 'czwartki', 'piątki', 'soboty', 'niedziele'];
  const pad = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const naDate = k => { const [y, m, d] = String(k).split('-').map(Number); return new Date(y, m - 1, d, 12); };
  const dzisISO = () => iso(new Date());
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function norm(r) {
    if (!r || typeof r !== 'object') return { typ: 'codziennie' };
    if (r.typ === 'robocze') return { typ: 'robocze' };
    if (r.typ === 'tydzien') {
      const dni = Array.isArray(r.dni) ? [...new Set(r.dni.map(Number).filter(n => n >= 0 && n <= 6))].sort() : [];
      return dni.length ? { typ: 'tydzien', dni } : { typ: 'codziennie' };
    }
    if (r.typ === 'coN') {
      const co = Math.max(1, Math.min(365, Math.trunc(+r.co) || 1));
      return { typ: 'coN', co, od: /^\d{4}-\d{2}-\d{2}$/.test(r.od || '') ? r.od : dzisISO() };
    }
    if (r.typ === 'miesiac') return { typ: 'miesiac', dzien: Math.max(1, Math.min(31, Math.trunc(+r.dzien) || 1)) };
    return { typ: 'codziennie' };
  }

  function pasuje(r, dzien) {
    r = norm(r);
    const d = naDate(dzien), dt = (d.getDay() + 6) % 7;
    switch (r.typ) {
      case 'robocze': return dt < 5;
      case 'tydzien': return r.dni.includes(dt);
      case 'coN': {
        const roznica = Math.round((d - naDate(r.od)) / 864e5);
        return roznica >= 0 && roznica % r.co === 0;
      }
      case 'miesiac': {
        const ostatni = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        return d.getDate() === Math.min(r.dzien, ostatni);
      }
      default: return true;
    }
  }

  function najblizszy(r, od) {
    const d = naDate(od || dzisISO());
    for (let i = 0; i < 400; i++) { const k = iso(d); if (pasuje(r, k)) return k; d.setDate(d.getDate() + 1); }
    return null;
  }

  function opis(r) {
    r = norm(r);
    switch (r.typ) {
      case 'robocze': return 'w dni robocze';
      case 'tydzien': return r.dni.length === 7 ? 'codziennie' : 'w ' + r.dni.map(i => DNI_MN[i]).join(', ').replace(/, ([^,]*)$/, ' i $1');
      case 'coN': return r.co === 1 ? 'codziennie' : 'co ' + r.co + ' ' + (window.odm ? window.odm(r.co, 'dzień', 'dni', 'dni') : 'dni');
      case 'miesiac': return 'co miesiąc, ' + r.dzien + '. dnia';
      default: return 'codziennie';
    }
  }

  /* pola wyboru: lista „jak często” i szczegóły tylko dla wybranego rodzaju */
  function html(r, etykieta) {
    r = norm(r);
    const opcje = [['codziennie', 'Codziennie'], ['robocze', 'W dni robocze (pon–pt)'], ['tydzien', 'W wybrane dni tygodnia'],
      ['coN', 'Co kilka dni'], ['miesiac', 'Co miesiąc']]
      .map(([v, t]) => `<option value="${v}"${r.typ === v ? ' selected' : ''}>${t}</option>`).join('');
    const dni = r.typ === 'tydzien' ? r.dni : [(naDate(dzisISO()).getDay() + 6) % 7];
    return `<div class="powt" data-powt data-od="${esc(r.od || dzisISO())}">
      <select class="powt-typ" aria-label="${esc(etykieta || 'Jak często')}">${opcje}</select>
      <div class="powt-dni" role="group" aria-label="Dni tygodnia"${r.typ === 'tydzien' ? '' : ' hidden'}>${DNI.map((t, i) =>
        `<label class="powt-dzien" title="${DNI_DL[i]}"><input type="checkbox" value="${i}"${dni.includes(i) ? ' checked' : ''} aria-label="${DNI_DL[i]}"><span>${t}</span></label>`).join('')}</div>
      <label class="powt-n"${r.typ === 'coN' ? '' : ' hidden'}>co <input type="number" min="1" max="365" value="${r.co || 2}" aria-label="Co ile dni"> dni, od <input type="date" value="${esc(r.od || dzisISO())}" aria-label="Pierwszy dzień"></label>
      <label class="powt-m"${r.typ === 'miesiac' ? '' : ' hidden'}><input type="number" min="1" max="31" value="${r.dzien || naDate(dzisISO()).getDate()}" aria-label="Dzień miesiąca">. dnia miesiąca</label>
    </div>`;
  }

  function czytaj(el) {
    const typ = el.querySelector('.powt-typ').value;
    if (typ === 'tydzien') return norm({ typ, dni: [...el.querySelectorAll('.powt-dni input:checked')].map(x => +x.value) });
    if (typ === 'coN') { const [co, od] = el.querySelectorAll('.powt-n input'); return norm({ typ, co: co.value, od: od.value }); }
    if (typ === 'miesiac') return norm({ typ, dzien: el.querySelector('.powt-m input').value });
    return norm({ typ });
  }

  /* zmiana(reguła) przy każdej zmianie pól; zwraca kontener */
  function podepnij(kontener, zmiana) {
    kontener.querySelectorAll('[data-powt]').forEach(el => {
      if (el.dataset.podpiete) return;
      el.dataset.podpiete = '1';
      const pokaz = () => {
        const t = el.querySelector('.powt-typ').value;
        el.querySelector('.powt-dni').hidden = t !== 'tydzien';
        el.querySelector('.powt-n').hidden = t !== 'coN';
        el.querySelector('.powt-m').hidden = t !== 'miesiac';
      };
      el.addEventListener('change', e => {
        if (e.target.matches('.powt-dni input') && !el.querySelector('.powt-dni input:checked')) e.target.checked = true;   // co najmniej jeden dzień
        pokaz(); zmiana(czytaj(el));
      });
    });
    return kontener;
  }

  window.Powtarzanie = { norm, pasuje, najblizszy, opis, html, czytaj, podepnij, DNI_DL };
})();
