/* Przykładowe dane dla strażnika stron: każde narzędzie ma coś do pokazania (widżety, karteczki, niepowodzenia).
   Daty liczone od stałego „dziś” strażnika (wtorek 20.10.2026, 14:00 — pora „Popołudnie”). */
const TERAZ = new Date('2026-10-20T14:00:00+02:00').getTime();
const DZIEN = 864e5;
const dzien = i => new Date(TERAZ - i * DZIEN).toISOString().slice(0, 10);
const iso = i => new Date(TERAZ - i * DZIEN).toISOString();

module.exports = {
  TERAZ,
  DANE: {
    'plany-jezeli-v1': { plans: [{ id: 'p1', root: { text: 'mam ochotę kupić coś impulsywnie', kids: [] }, runs: [{ at: TERAZ - 2 * DZIEN, ok: false }, { at: TERAZ - 4 * DZIEN, ok: true }], drill: { ok: 0, miss: 0 } }] },
    'woop-v1': { items: [{ id: 'w1', wish: 'Regularnie czytać wieczorem', outcome: 'spokój przed snem', obstacle: 'telefon w łóżku', plan: 'odkładam telefon do kuchni', updated: TERAZ, checks: { [dzien(0)]: 'ok', [dzien(2)]: 'miss', [dzien(3)]: 'ok', [dzien(5)]: 'skip' } }] },
    'mcz.dane.v1': { wpisy: [{ id: 'b1', ts: iso(3), bateria: 70, szop: [{ id: 'stres', n: 2 }] }, { id: 'b2', ts: new Date(TERAZ - 2 * 3600e3).toISOString(), bateria: 50, czerwonaFlaga: true }] },
    'tablica-scoringowa-v1': { today: { date: dzien(1), tasks: [] }, history: [{ date: dzien(1) }] },
    'skrzynka-v1': { kartki: [{ id: 'k1', tekst: 'nakręcanie się', dodano: iso(1) }, { id: 'k2', tekst: 'zadzwonić do dentysty', dodano: iso(4) }] },
    'adhd.kopia.ostatnia': iso(0)
  }
};
