# MyWallpapers

Poster-Generator für Spiele und Musikalben, druckfertig von A5 bis 70 × 100 cm. Läuft direkt im Browser: `index.html` per Doppelklick öffnen, kein Server, keine Installation. Nur die Suche nach Spielen und Alben braucht Internet.

> **Vibe-coded:** Dieses Projekt ist größtenteils mit KI (Claude Code) im Dialog entstanden, nicht klassisch von Hand programmiert. Der Code wird über einen eingebauten Selbsttest geprüft, ist aber nicht zeilenweise von Menschen reviewt. Nutzung auf eigenes Risiko.

## Funktionen

Die Startseite bietet zwei Posterarten als Kacheln, direkt erreichbar über `index.html#spiel` bzw. `index.html#album`. Jede Seite merkt sich ihren eigenen Stand.

- **Spiel**: Suche über Wikidata/Wikipedia, ohne Key. Füllt Titel, Entwickler, Genres, Datum und Beschreibung, lädt das Wikipedia-Cover als Platzhalter und das Logo von Steam bzw. Wikidata. Links zu Presskit, Alpha Coders, Google und Wallhaven helfen, ein hochauflösendes Bild zu finden.
- **Album**: Suche über MusicBrainz, ohne Key, nach Albumtitel oder Künstler; ein Klick auf einen Künstler zeigt seine Diskografie. Füllt Album, Künstler, Label, Genres, Datum und die Titelliste mit Laufzeiten, lädt das Cover in Originalgröße aus dem Cover Art Archive. Die Titelliste steht unter dem Cover in bis zu drei Spalten; ihre Schrift wird kleiner, bis auch lange Titel ganz passen.
  Spotify wird nicht genutzt, weil dessen API immer einen Key verlangt.
- **Formate**: A5 bis A1 sowie 30 × 40, 40 × 50, 50 × 70, 60 × 90 und 70 × 100 cm. Export mit 300 dpi; die großen Formate liegen etwas darunter, weil ein Export höchstens 50 Megapixel hat (sonst stürzt der Browser ab). Kleine Formate bekommen relativ größere Schrift.
- **Bildausschnitt**: in der Vorschau ziehen, zoomen mit Mausrad oder Regler, Pfeiltasten verschieben.
- **Mit KI hochskalieren**: ESRGAN läuft lokal im Browser (WebGL) und rechnet zu kleine Bilder bis zur Druckauflösung hoch (max. 4×).
- **Farben**: fünf Farbfelder, automatisch aus dem Bild oder von Hand. Hintergrund **Dunkel** (Anthrazit) oder **Hell** (warmes Papier-Beige); die Oberfläche des Generators wechselt mit.
- **Speichern**: Eingaben und Bilder bleiben im Browser. **Sichern…** legt ein Projekt als `.poster.json` ab, **Öffnen…** lädt es wieder (auf der passenden Seite).
- **Export** als PNG oder JPG, optional mit 3 mm Beschnitt für die Druckerei; die Datei enthält die dpi-Angabe.

## Bilder und Daten

Die Poster sind für den **privaten Gebrauch** gedacht. Cover, Key Art und Logos sind urheberrechtlich geschützt und gehören den jeweiligen Rechteinhabern; wer ein Poster veröffentlicht oder verkauft, braucht deren Erlaubnis.

Abgefragte Dienste und ihre Datenlizenzen:

| Dienst | Wofür | Lizenz der Daten |
|---|---|---|
| [Wikidata](https://www.wikidata.org) | Spieldaten, Logo-Verweis | CC0 |
| [Wikipedia](https://www.wikipedia.org) | Beschreibung, Cover-Platzhalter | Text CC BY-SA 4.0, Bilder je nach Datei |
| [Wikimedia Commons](https://commons.wikimedia.org) | Logos | je nach Datei |
| Steam (steamstatic.com) | Spiel-Logo | Rechte beim Publisher |
| [MusicBrainz](https://musicbrainz.org) | Albumdaten, Titelliste | Kerndaten CC0, Genres CC BY-NC-SA 3.0 |
| [Cover Art Archive](https://coverartarchive.org) | Albumcover | Rechte beim Label/Künstler |

MusicBrainz erlaubt eine Anfrage pro Sekunde; die Albumsuche hält sich daran und ist deshalb etwas langsamer als die Spielesuche.

## Aufbau

`index.html` ist **generiert** und enthält alles in einer Datei: Code, Schrift, KI-Laufzeit und Modell. So funktioniert sie auch in Browsern mit Sandbox (z. B. Brave oder Firefox als Flatpak), die beim Doppelklick nur die geöffnete Datei sehen. Aus demselben Grund sind Startseite, Spiel- und Albumseite keine eigenen Dateien, sondern Abschnitte derselben Seite.

Bearbeitet wird in `src/` (`index.html`, `app.css`, `app.js`), danach neu bauen:

```
python3 build.py
```

Selbsttest: nach dem Bauen `python3 -m http.server` im Repo starten und `http://localhost:8000/#selftest` öffnen; der Tab-Titel zeigt `SELFTEST OK` oder den ersten Fehler. Der Server ist nur nötig, weil der Test das Beispielbild aus `Examples/` lädt. Die Online-Dienste werden dabei simuliert, der Test braucht kein Internet.

## Lizenz

Der eigene Code steht unter der [MIT-Lizenz](LICENSE). Mitgelieferte Fremdteile (werden von `build.py` eingebettet) behalten ihre Lizenzen:

| Datei | Herkunft | Lizenz |
|---|---|---|
| `vendor/tf.min.js` | TensorFlow.js 4.22.0 | Apache 2.0, `vendor/LICENSE-tfjs.txt` |
| `vendor/esrgan-medium-x4.js` | @upscalerjs/esrgan-medium 1.0.0, Modell x4 | MIT, `vendor/LICENSE-esrgan.txt` |
| `fonts/fonts.css` | TeX Gyre Heros (freier Helvetica-Nachbau) | GUST Font License, `fonts/GUST-FONT-LICENSE.txt` |
