# MyWallpapers

Poster-Generator (50 × 70 cm, 300 dpi). Läuft komplett offline: `index.html` per Doppelklick öffnen, kein Server, keine Installation. Die Startseite bietet zwei Posterarten als Kacheln (direkt erreichbar über `index.html#spiel` bzw. `#album`), jede merkt sich ihren eigenen Stand.

- **Spiel**: Suche über Wikidata/Wikipedia, ohne Key (braucht Internet): füllt Titel, Entwickler, Genres, Datum und Beschreibung, lädt das Wikipedia-Cover als Platzhalter und das Logo von Steam bzw. Wikidata.
- **Album**: Suche über MusicBrainz, ohne Key (Spotify geht nicht, dessen API verlangt immer einen Key): füllt Album, Künstler, Label, Genres, Datum und die Titelliste mit Laufzeiten, lädt das Cover in Originalgröße aus dem Cover Art Archive. Die Titel stehen unter dem Cover in bis zu drei Spalten.
- Bildausschnitt: in der Vorschau ziehen, zoomen mit Mausrad oder Regler.
- **Mit KI hochskalieren**: ESRGAN läuft lokal im Browser (WebGL) und rechnet zu kleine Bilder auf bis zu 300 dpi hoch (max. 4×).
- Eingaben und Bilder bleiben im Browser gespeichert. **Sichern…** legt ein Projekt als `.poster.json` ab, **Öffnen…** lädt es wieder.
- Export als PNG oder JPG, optional mit 3 mm Beschnitt für die Druckerei.

## Aufbau

`index.html` ist **generiert** und enthält alles in einer Datei: Code, Schrift, KI-Laufzeit und Modell. So funktioniert sie auch in Browsern mit Sandbox (z. B. Brave oder Firefox als Flatpak), die beim Doppelklick nur die geöffnete Datei sehen.

Bearbeitet wird in `src/` (`index.html`, `app.css`, `app.js`), danach neu bauen:

```
python3 build.py
```

Mitgelieferte Fremdteile (werden von `build.py` eingebettet):

| Datei | Herkunft | Lizenz |
|---|---|---|
| `vendor/tf.min.js` | TensorFlow.js 4.22.0 | Apache 2.0, `vendor/LICENSE-tfjs.txt` |
| `vendor/esrgan-medium-x4.js` | @upscalerjs/esrgan-medium 1.0.0, Modell x4 | MIT, `vendor/LICENSE-esrgan.txt` |
| `fonts/fonts.css` | TeX Gyre Heros (freier Helvetica-Nachbau) | GUST Font License, `fonts/GUST-FONT-LICENSE.txt` |

Selbsttest: nach dem Bauen `python3 -m http.server` im Repo starten und `http://localhost:8000/#selftest` öffnen, der Tab-Titel zeigt `SELFTEST OK` (der Server ist nur nötig, weil der Test das Beispielbild lädt).
