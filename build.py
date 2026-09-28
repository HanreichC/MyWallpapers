#!/usr/bin/env python3
"""Baut index.html als eine einzige Datei aus src/, fonts/ und vendor/.

Eine Datei, weil Browser in einer Sandbox (z. B. Brave/Firefox als Flatpak) beim Doppelklick
nur die geöffnete Datei sehen, nicht die Ordner daneben. Aufruf: python3 build.py
"""
from pathlib import Path

ROOT = Path(__file__).parent


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def embeddable(path, end_tag):
    text = read(path)
    # Diese Folgen würden den umgebenden <script>/<style>-Block im HTML vorzeitig beenden
    for bad in (end_tag, '<!--'):
        if bad in text.lower():
            raise SystemExit(f'{path} enthält "{bad}" und kann so nicht eingebettet werden')
    return text


parts = {
    '<!-- build:css -->': '<style>\n' + embeddable('fonts/fonts.css', '</style') + embeddable('src/app.css', '</style') + '</style>',
    '<!-- build:vendor -->': '\n'.join(
        f'<script type="text/plain" id="{id}">{embeddable(path, "</script")}</script>'
        for id, path in [('vendor-tf', 'vendor/tf.min.js'), ('vendor-esrgan', 'vendor/esrgan-medium-x4.js')]),
    '<!-- build:js -->': '<script>\n' + embeddable('src/app.js', '</script') + '</script>',
}

html = read('src/index.html')
for marker, content in parts.items():
    if html.count(marker) != 1:
        raise SystemExit(f'Platzhalter {marker} muss genau einmal in src/index.html stehen')
    html = html.replace(marker, content)
html = html.replace('<!doctype html>', '<!doctype html>\n<!-- GENERIERT von build.py – Änderungen in src/ machen, dann "python3 build.py" -->', 1)

(ROOT / 'index.html').write_text(html, encoding='utf-8')
print(f'index.html gebaut ({len(html.encode()) / 1e6:.1f} MB)')
