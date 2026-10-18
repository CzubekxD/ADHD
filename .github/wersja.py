"""Dopisuje ?v=<wersja> do lokalnych plików .css i .js we wszystkich stronach .html,
wpisuje wersję do <meta name="adhd-wersja"> i zapisuje wersja.json.
Uruchamiany tylko w GitHub Actions przed publikacją (pliki w repo zostają bez zmian)."""
import json, pathlib, re, sys

wersja = sys.argv[1]
korzen = pathlib.Path(__file__).resolve().parent.parent
LINK = re.compile(r'''((?:src|href)=["'])((?![a-z]+:|//)[^"'?#]+\.(?:css|js))(?:\?v=[^"']*)?(["'])''')
META = re.compile(r'(<meta name="adhd-wersja" content=")[^"]*(")')

for plik in korzen.rglob('*.html'):
    if '.git' in plik.parts:
        continue
    tekst = plik.read_text(encoding='utf-8')
    nowy = LINK.sub(lambda m: f'{m.group(1)}{m.group(2)}?v={wersja}{m.group(3)}', tekst)
    nowy = META.sub(lambda m: f'{m.group(1)}{wersja}{m.group(2)}', nowy)
    if nowy != tekst:
        plik.write_text(nowy, encoding='utf-8')
        print('wersja', wersja, '→', plik.relative_to(korzen))

(korzen / 'wersja.json').write_text(json.dumps({'wersja': wersja}), encoding='utf-8')
