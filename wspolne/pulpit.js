/* ---------------------------------------------------------------
   PULPIT DNIA — skróty dnia z danych narzędzi na stronie startowej.
   Pulpit tylko CZYTA dane narzędzi (localStorage), niczego nie zapisuje.
   Przyciski prowadzą do narzędzia, które samo zapisuje zmiany.

   Każde narzędzie ma tu jedną funkcję: SKROTY[id](dane) zwraca
     null              — brak danych: pokazujemy kafelek z miniaturą i przyciskiem „start”
     { liczba, jednostka, podpis, srodek, akcja }  albo  { naglowek, podpis, … } — zdanie zamiast liczby
                       — jedna liczba, jedno zdanie, jedna akcja (ADHD: nie zasypujemy liczbami)
   Gdy narzędzie zmieni format danych, poprawia się tylko jego funkcję tutaj.
   --------------------------------------------------------------- */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const dzien = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const dzis = () => dzien(new Date());
  const godz = d => pad(d.getHours()) + ':' + pad(d.getMinutes());
  function kiedy(ts) {
    const d = new Date(ts), roznica = Math.round((new Date(dzis()) - new Date(dzien(d))) / 864e5);
    if (roznica === 0) return 'dziś ' + godz(d);
    if (roznica === 1) return 'wczoraj ' + godz(d);
    if (roznica < 7) return roznica + ' dni temu';
    return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
  }
  const odmiana = (n, a, b, c) => n === 1 ? a : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) ? b : c;

  /* ---------- Pasek zdrowia × SZOP ---------- */
  const SZOP_NAZWY = { stres: 'Stres', zmeczenie: 'Zmęczenie', oczekiwania: 'Oczekiwania', przebodzcowanie: 'Przebodźcowanie' };
  const BATERIA = [[10, '0–19'], [30, '20–39'], [50, '40–59'], [70, '60–79'], [90, '80–100']];
  function pasek(d) {
    const wpisy = (d && d.wpisy || []).filter(w => w && w.ts).sort((a, b) => a.ts < b.ts ? -1 : 1);
    if (!wpisy.length) return null;
    const konf = d.konfiguracja || {};
    const nazwaSzop = id => ((konf.szop || []).find(s => s.id === id) || {}).nazwa || SZOP_NAZWY[id] || id;
    const etykieta = v => { const b = (konf.bateria || []).find(x => x.srodek === v); if (b) return b.etykieta; const z = BATERIA.find(x => x[0] === v); return z ? z[1] : String(v); };
    const dzisiejsze = wpisy.filter(w => dzien(new Date(w.ts)) === dzis());
    const ost = wpisy[wpisy.length - 1];
    const akcja = { tekst: 'Dodaj wpis', href: 'pasek/' };
    if (!dzisiejsze.length) {
      return { naglowek: 'Jak dziś bateria?', podpis: `Dziś jeszcze bez wpisu. Ostatni ${kiedy(ost.ts)}: ${etykieta(ost.bateria)}%`, akcja };
    }
    const flagi = dzisiejsze.filter(w => w.czerwonaFlaga).length;
    const czynniki = (ost.szop || []).slice().sort((a, b) => (b.n || 0) - (a.n || 0)).slice(0, 2)
      .map(s => `<span class="pp-chip">${esc(nazwaSzop(s.id))}${s.n ? ' ' + s.n : ''}</span>`).join('');
    let wykres = '';
    if (dzisiejsze.length > 1) {
      const pkt = dzisiejsze.map(w => { const t = new Date(w.ts); return [t.getHours() + t.getMinutes() / 60, w.bateria]; });
      const h0 = Math.min(pkt[0][0], 8), h1 = Math.max(pkt[pkt.length - 1][0], h0 + 4);
      const x = h => 6 + (h - h0) / (h1 - h0) * 138, y = v => 40 - v / 100 * 36;
      const lin = pkt.map(([h, v]) => x(h).toFixed(1) + ',' + y(v).toFixed(1)).join(' ');
      const [lh, lv] = pkt[pkt.length - 1];
      wykres = `<svg class="pp-spark" viewBox="0 0 150 44" role="img" aria-label="Bateria dziś, ${dzisiejsze.length} wpisów">
        <polygon class="kt" points="${x(pkt[0][0]).toFixed(1)},40 ${lin} ${x(lh).toFixed(1)},40"/>
        <polyline class="ks" fill="none" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${lin}"/>
        <circle class="k" cx="${x(lh).toFixed(1)}" cy="${y(lv).toFixed(1)}" r="3.5"/></svg>`;
    }
    return {
      liczba: etykieta(ost.bateria), jednostka: '% baterii',
      podpis: `Ostatni wpis ${godz(new Date(ost.ts))} · ${dzisiejsze.length} ${odmiana(dzisiejsze.length, 'wpis', 'wpisy', 'wpisów')} dziś`,
      obok: wykres,
      srodek: (czynniki || flagi) ? `<div class="pp-chipy">${czynniki}${flagi ? `<span class="pp-chip flaga">${flagi} ${odmiana(flagi, 'czerwona flaga', 'czerwone flagi', 'czerwonych flag')}</span>` : ''}</div>` : '',
      akcja
    };
  }

  /* ---------- Tablica scoringowa ---------- */
  function tablica(d) {
    if (!d || !d.today) return null;
    const kat = id => (d.categories || []).find(c => c.id === id);
    const baza = t => t.points != null ? t.points : (kat(t.catId) || {}).points;
    const wartosc = t => { const b = baza(t); return b == null ? null : Math.round(b * Math.min(1 + .5 * (t.carry || 0), 2)); };
    const akcja = { tekst: 'Otwórz tablicę', href: 'tablica/' };
    const historia = (d.history || []).length;
    if (d.today.date !== dzis()) {
      const plan = ((d.plan || {})[dzis()] || []).filter(t => (t.name || '').trim()).length;
      if (!historia && !plan && !(d.today.tasks || []).some(t => (t.name || '').trim() && !t.pin)) return null;
      return { naglowek: 'Tablica na dziś czeka', podpis: plan ? `${plan} ${odmiana(plan, 'zadanie', 'zadania', 'zadań')} czeka w planie na dziś` : 'Wczoraj zamknięte. Ułóż dzisiejszą tablicę', akcja };
    }
    const zadania = (d.today.tasks || []).filter(t => (t.name || '').trim() && wartosc(t) != null);
    if (!zadania.length) {
      if (!historia) return null;
      return { liczba: '0', jednostka: 'pkt', podpis: 'Na dziś nie ma jeszcze zadań z punktami', akcja };
    }
    let zdobyte = 0, mozliwe = 0;
    zadania.forEach(t => {
      const p = wartosc(t); mozliwe += p;
      if (t.done) zdobyte += p;
      else if (t.started && t.startDay === d.today.date) zdobyte += Math.round(p * .3);
    });
    const zostalo = zadania.filter(t => !t.done).sort((a, b) => wartosc(b) - wartosc(a));
    const lista = zostalo.slice(0, 3).map(t => `<li><span class="pp-box"></span><span class="pp-nazwa">${esc(t.name)}</span><span class="pp-pkt">${wartosc(t)}</span></li>`).join('');
    const proc = mozliwe ? Math.round(zdobyte / mozliwe * 100) : 0;
    return {
      liczba: String(zdobyte), jednostka: `/ ${mozliwe} pkt`,
      podpis: zostalo.length ? `${zadania.length - zostalo.length} z ${zadania.length} zrobione` : 'Wszystko na dziś zrobione',
      srodek: `<div class="pp-postep" role="img" aria-label="${zdobyte} z ${mozliwe} punktów"><i style="width:${proc}%"></i></div>` + (lista ? `<ul class="pp-lista">${lista}</ul>` : ''),
      akcja
    };
  }

  /* ---------- Plany Jeżeli… to… ---------- */
  function plany(d) {
    const lista = (d && d.plans || []).filter(p => p && p.root);
    if (!lista.length) return null;
    const tydzien = Date.now() - 7 * 864e5;
    const ostatni = p => (p.runs || []).reduce((m, r) => r.at > (m ? m.at : 0) ? r : m, null);
    const proby = lista.flatMap(p => (p.runs || []).filter(r => r.at >= tydzien));
    const ok = proby.filter(r => r.ok).length;
    const kolejnosc = lista.slice().sort((a, b) => ((ostatni(b) || {}).at || 0) - ((ostatni(a) || {}).at || 0)).slice(0, 3);
    const wiersze = kolejnosc.map(p => {
      const r = ostatni(p);
      const stan = r ? `<span class="pp-chip ${r.ok ? 'ok' : 'flaga'}">${r.ok ? 'zadziałało' : 'nie zadziałało'} · ${esc(kiedy(r.at))}</span>` : '<span class="pp-chip">jeszcze nie użyty</span>';
      return `<li><span class="pp-nazwa">${esc(p.root.text || 'Plan bez nazwy')}</span>${stan}</li>`;
    }).join('');
    const akcja = { tekst: 'Otwórz „Teraz”', href: 'plany/' };
    if (!proby.length) return { liczba: String(lista.length), jednostka: odmiana(lista.length, 'plan gotowy', 'plany gotowe', 'planów gotowych'), podpis: 'W ostatnich 7 dniach bez uruchomień', srodek: `<ul class="pp-lista">${wiersze}</ul>`, akcja };
    return { liczba: String(ok), jednostka: `/ ${proby.length} zadziałało`, podpis: 'Uruchomienia planów w ostatnich 7 dniach', srodek: `<ul class="pp-lista">${wiersze}</ul>`, akcja };
  }

  /* ---------- WOOP ---------- */
  function woop(d) {
    const aktywne = (d && d.items || []).filter(x => x && !x.archived && (x.wish || '').trim());
    if (!aktywne.length) return null;
    const glowny = aktywne.slice().sort((a, b) => (b.updated || 0) - (a.updated || 0))[0];
    const ch = glowny.checks || {};
    const dni = [];
    for (let i = 6; i >= 0; i--) { const t = new Date(); t.setDate(t.getDate() - i); dni.push(ch[dzien(t)] || ''); }
    const OPIS = { ok: 'zadziałało', miss: 'nie zadziałało', skip: 'pominięte', '': 'brak wpisu' };
    const kropki = `<div class="pp-dni" role="img" aria-label="Ostatnie 7 dni: ${dni.map(s => OPIS[s]).join(', ')}">${dni.map(s => `<i class="${s}"></i>`).join('')}</div>`;
    const dzisiaj = ch[dzis()];
    const reszta = aktywne.length - 1;
    return {
      zyczenie: glowny.wish,
      podpis: reszta ? `+ ${reszta} ${odmiana(reszta, 'inny WOOP', 'inne WOOP', 'innych WOOP')}` : 'Ostatnie 7 dni',
      obok: kropki,
      srodek: dzisiaj
        ? `<div class="pp-pytanie gotowe"><span>Dziś: ${OPIS[dzisiaj]}</span></div>`
        : `<div class="pp-pytanie"><span>Czy plan dziś zadziałał?</span></div>`,
      akcja: { tekst: dzisiaj ? 'Otwórz WOOP' : 'Odpowiedz w WOOP', href: 'woop/', glowna: !dzisiaj }
    };
  }

  const SKROTY = { pasek, tablica, plany, woop };

  /* ---------- rysowanie ---------- */
  const czytaj = k => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } };
  const styl = n => `--k:var(--k-${n.kolor});--kt:var(--k-${n.kolor}-tlo)`;
  const znak = (n, tonal) => `<span class="pp-znak${tonal ? ' tonal' : ''}">${window.znakNarzedzia ? znakNarzedzia(n) : esc(n.znak)}</span>`;

  function kafelek(n, korzen) {
    return `<a class="pp-w pp-pusty" style="${styl(n)}" href="${esc(korzen + n.href)}">
      ${n.mini ? `<div class="pp-mini" aria-hidden="true"><svg viewBox="0 0 220 92">${n.mini}</svg></div>` : ''}
      <div class="pp-glowa">${znak(n, true)}<span class="pp-tytul">${esc(n.nazwa)}</span></div>
      <p class="pp-opis">${esc(n.opis)}</p>
      <span class="pp-akcja cicha">${esc(n.start || 'Otwórz')}</span></a>`;
  }
  function widzet(n, s, korzen) {
    const glowa = `<div class="pp-glowa">${znak(n)}<a class="pp-nazwa-n" href="${esc(korzen + n.href)}">${esc(n.nazwa)}</a></div>`;
    const tekst = s.zyczenie != null ? s.zyczenie : s.naglowek;
    const gora = tekst != null
      ? `<p class="pp-zyczenie">${esc(tekst)}</p><div class="pp-wiersz"><p class="pp-podpis">${esc(s.podpis)}</p>${s.obok || ''}</div>`
      : `<div class="pp-wiersz"><div><div class="pp-liczba">${esc(s.liczba)}<small>${esc(s.jednostka || '')}</small></div><p class="pp-podpis">${esc(s.podpis)}</p></div>${s.obok || ''}</div>`;
    const glowna = s.akcja.glowna !== false;
    return `<section class="pp-w" style="${styl(n)}" aria-label="${esc(n.nazwa)}">${glowa}${gora}${s.srodek || ''}
      <a class="pp-akcja${glowna ? '' : ' cicha'}" href="${esc(korzen + s.akcja.href)}">${esc(s.akcja.tekst)}</a></section>`;
  }

  function rysuj(cel, opcje) {
    opcje = opcje || {};
    const korzen = opcje.korzen || './';
    const lista = window.NARZEDZIA || [];
    const skroty = lista.map(n => {
      try { return SKROTY[n.id] && n.klucz ? SKROTY[n.id](czytaj(n.klucz)) : null; } catch (e) { console.warn('[pulpit]', n.id, e); return null; }
    });
    const zDanymi = skroty.filter(Boolean).length;
    // pierwsze wejście: same kafelki z miniaturami; gdy coś już ma dane, wszystkie widżety
    // mają ten sam układ — narzędzie bez danych dostaje zdanie i przycisk na start
    const html = lista.map((n, i) => {
      if (skroty[i]) return widzet(n, skroty[i], korzen);
      if (!zDanymi) return kafelek(n, korzen);
      return widzet(n, { naglowek: 'Jeszcze nie zaczęte', podpis: n.opis, akcja: { tekst: n.start || 'Otwórz', href: n.href, glowna: false } }, korzen);
    }).join('');
    cel.innerHTML = html;
    return zDanymi;
  }

  window.Pulpit = { rysuj, SKROTY, dzis };
})();
