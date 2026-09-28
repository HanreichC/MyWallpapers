# MyWallpapers

Poster-Generator für Spiele, Musikalben, Filme und Serien, druckfertig von A5 bis 70 × 100 cm. Läuft direkt im Browser: `index.html` per Doppelklick öffnen, kein Server, keine Installation. Nur die Suche braucht Internet.

> **Vibe-coded:** Dieses Projekt ist größtenteils mit KI (Claude Code) im Dialog entstanden, nicht klassisch von Hand programmiert. Der Code wird über einen eingebauten Selbsttest geprüft, ist aber nicht zeilenweise von Menschen reviewt. Nutzung auf eigenes Risiko.

## Funktionen

Die Startseite bietet drei Posterarten als Kacheln, direkt erreichbar über `index.html#spiel`, `#album` und `#film`. Jede Seite merkt sich ihren eigenen Stand.

- **Spiel**: Suche über Wikidata/Wikipedia, ohne Key. Füllt Titel, Entwickler, Genres, Datum und Beschreibung und lädt das Logo von Steam bzw. Wikidata.
  **Bilder** kommen aus allen Quellen gleichzeitig (siehe **Bildauswahl**): Microsoft Store (Key Art, Cover und Screenshots bis 3840 × 2160 px), Steam (bis 3840 × 1240 px), Nintendo eShop (Key Art 1920 × 1080 px, Screenshots), die Fandom-Wiki des Spiels (Box Art und Artworks, oft über 1500 px) und Wikipedia.
- **Album**: Suche über MusicBrainz, ohne Key, nach Albumtitel oder Künstler; ein Klick auf einen Künstler zeigt seine Diskografie. Füllt Album, Künstler, Label, Genres, Datum und die Titelliste mit Laufzeiten, lädt das Cover in Originalgröße aus dem Cover Art Archive. Die Titelliste steht unter dem Cover in bis zu drei Spalten; ihre Schrift wird kleiner, bis auch lange Titel ganz passen.
  Spotify wird nicht genutzt, weil dessen API immer einen Key verlangt.
- **Film & Serie**: Umschalter Film | Serie, Layout wie beim Spiel-Poster.
  - Filme über Wikidata/Wikipedia, ohne Key: Regie, Genres, Laufzeit, Datum, Handlung; bekannte Filme stehen in der Suche oben.
  - Serien über TVmaze, ohne Key: Sender, Genres, Staffeln, Datum, Handlung.
  - Bilder aus allen Quellen: Apple TV (Szenenbilder ohne Schrift bis 4320 × 3240 px, Plakate, Staffel-Cover, Standbilder aus Trailern, dazu das Logo als transparentes PNG), TVmaze (alle Szenenbilder, Plakate und Banner), Fandom und Wikipedia.
- **Bildauswahl**: Nach einem Suchtreffer fragt die App alle Bildquellen ab, misst die Bilder und zeigt die 10 besten mit ihrer Auflösung in einem Fenster; höchstens 4 je Quelle, damit jede Quelle vorkommt. Sortiert wird nach der kürzeren Seite, weil sie bei dem fast quadratischen Bildfeld die nutzbare Auflösung bestimmt. Das beste Bild ist sofort geladen, ein Klick nimmt ein anderes; **Gefundene Bilder…** öffnet die Auswahl wieder.
  - Die Nummern bei Apple TV, Microsoft Store, Steam und Nintendo sowie die Fandom-Wikis stehen in Wikidata; Serien werden über ihre TVmaze-Nummer dort gefunden. Fehlt die Wiki, rät die App sie aus dem Titel ("Need for Speed: Most Wanted" → needforspeed.fandom.com) und nimmt dort die Seite "Titel (Jahr)".
  - Apple TV und Nintendo werden über die öffentlichen Schlüssel ihrer Webseiten abgefragt, nicht über Konto-Keys. Ändert sich einer, fehlen nur diese Bilder.
  - Findet sich nichts Großes, weist die App darauf hin: über die Links zu Presskit, TMDB, Alpha Coders, Google und Wallhaven ein Bild suchen, kopieren und mit **Strg+V** einfügen, oder mit KI hochskalieren.
  - Nicht nutzbar: TMDB, OMDb, Trakt, fanart.tv, SteamGridDB, IGDB und OpenCritic verlangen einen Key; IMDb, GOG, PlayStation Store, GameTDB, LaunchBox und speedrun.com sperren den Abruf aus dem Browser (kein CORS); die iTunes-Suche findet keine Filme mehr.
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
| Steam (steamstatic.com) | Spiel-Key-Art, Cover, Logo | Rechte beim Publisher |
| Microsoft Store (displaycatalog) | Spiel-Key-Art, Cover | Rechte beim Publisher |
| Nintendo eShop (nintendo.com, Algolia) | Spiel-Key-Art | Rechte bei Nintendo/Publisher |
| [Fandom](https://www.fandom.com) | Box Art aus Spiele-Wikis | je nach Datei |
| Apple TV (uts-api.itunes.apple.com) | Film-/Serien-Szenenbilder, Plakate, Logos | Rechte beim Studio/Sender |
| [MusicBrainz](https://musicbrainz.org) | Albumdaten, Titelliste | Kerndaten CC0, Genres CC BY-NC-SA 3.0 |
| [Cover Art Archive](https://coverartarchive.org) | Albumcover | Rechte beim Label/Künstler |
| [TVmaze](https://www.tvmaze.com) | Seriendaten, Szenenbilder, Plakate (Rückfall) | Daten CC BY-SA 4.0, Bilder Rechte beim Sender/Studio |

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
