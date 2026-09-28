const $ = id => document.getElementById(id);
const U = 1000, M = 100, R = U - M, CW = U - 2 * M; // Layout in Einheiten: Breite = 1000, Höhe je nach Format
// Posterfarben: dunkel (Anthrazit mit Leinen-Schrift) oder hell (warmes Papier-Beige mit Anthrazit-Schrift); frame: Fläche hinter dem Bild
const THEMES = { dark: { bg: '#2b2b2b', fg: '#efe9dc', frame: '#000' }, light: { bg: '#efe7d7', fg: '#2b2b2b', frame: '#2b2b2b' } };
const theme = () => THEMES[$('themeLight').checked ? 'light' : 'dark'];
const font = (w, px) => `${w} ${px}px "TeX Gyre Heros", "Helvetica Neue", Helvetica, Arial, sans-serif`;
const fontsReady = Promise.all([400, 700].map(w => document.fonts.load(font(w, 10)))); // Canvas wartet sonst nicht auf Webfonts
const state = { image: null, logo: null, files: {}, dpi: 0, view: null, crowded: false };
const MODE = document.body.dataset.mode; // start, game oder album (gesetzt im Kopf von index.html)
const isAlbum = () => document.body.dataset.mode === 'album'; // live abgefragt, damit der Selbsttest beide Layouts prüfen kann
const STORE = MODE === 'album' ? 'album-' : ''; // jede Seite speichert für sich; Spiel behält die alten Schlüssel

// Formate (Breite × Höhe in cm). Alle Maße in plan() sind für 50 × 70 am Star-Wars-Beispiel gemessen (Faktor 1).
// Kleinere Formate bekommen relativ größere Schrift, und zwar mit der Wurzel der Breite: kleine Drucke liest man
// aus der Nähe, große aus der Entfernung. Titel wachsen schwächer (Exponent 0,6), damit sie klein nicht erschlagen.
const FORMATS = { a5: [14.8, 21], a4: [21, 29.7], a3: [29.7, 42], a2: [42, 59.4], a1: [59.4, 84.1],
  '30x40': [30, 40], '40x50': [40, 50], '50x70': [50, 70], '60x90': [60, 90], '70x100': [70, 100] };
function format() {
  const key = FORMATS[$('size').value] ? $('size').value : '50x70', [w, h] = FORMATS[key], inch = 2.54;
  // ponytail: höchstens 50 MP pro Export gegen Speicherabstürze im Browser, große Formate liegen daher unter 300 dpi
  const dpi = Math.min(300, Math.floor(Math.sqrt(50e6 / (w / inch * h / inch))));
  return { key, w, h, dpi, UH: U * h / w, px: [Math.round(w / inch * dpi), Math.round(h / inch * dpi)], t: Math.sqrt(50 / w) };
}

function wrap(ctx, text, maxW) {
  if (!text.trim()) return [];
  const out = [];
  for (const para of text.split('\n')) {
    let line = '';
    const start = out.length;
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const t = line ? line + ' ' + word : word;
      if (line && ctx.measureText(t).width > maxW) { out.push(line); line = word; } else line = t;
    }
    // kein einzelnes Wort allein in der letzten Zeile ("…Republic / II"), wenn die Zeile davor eins abgeben kann
    const prev = out.length > start && out.at(-1).split(' ');
    if (prev?.length > 2 && !line.includes(' ') && ctx.measureText(prev.at(-1) + ' ' + line).width <= maxW) {
      line = prev.pop() + ' ' + line;
      out[out.length - 1] = prev.join(' ');
    }
    out.push(line);
  }
  return out;
}
function ellipsis(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  while (text && ctx.measureText(text + '…').width > maxW) text = text.slice(0, -1);
  return text.trimEnd() + '…';
}

// Titelliste: eine Zeile pro Titel, Dauer (m:ss oder h:mm:ss) optional am Ende → [[Name, Dauer], …]
const trackList = text => text.split('\n').map(l => l.trim()).filter(Boolean)
  .map(l => { const m = l.match(/^(.*?)\s+(\d+:\d\d(?::\d\d)?)$/); return m ? [m[1], m[2]] : [l, '']; });
const clock = s => (s >= 3600 ? [Math.floor(s / 3600), Math.floor(s / 60) % 60] : [Math.floor(s / 60)])
  .map((n, i) => i ? String(n).padStart(2, '0') : n).join(':') + ':' + String(s % 60).padStart(2, '0');
const runtime = text => {
  const s = trackList(text).reduce((sum, [, d]) => sum + (d ? d.split(':').reduce((a, n) => a * 60 + +n, 0) : 0), 0);
  return s ? clock(s) : '';
};

// Misst alle Texte aus und verteilt sie. b/h: Faktor für Fließtext/Titel; fit < 1 verkleinert alles, wenn das Bild sonst zu klein würde.
// Spiel: Kopf (Farbbalken, Meta, Titel) über dem Bild. Album: quadratisches Cover oben, Kopf darunter, Titelliste statt Beschreibung
function plan(ctx, F, fit) {
  const v = id => $(id).value, b = F.t * fit, h = F.t ** .6 * fit, album = isAlbum();
  // fs/cap/step: Schrift, Versalhöhe und Zeilenabstand unten links; die Titelliste ist größer als die Spiel-Beschreibung
  const L = { b, h, meta: [], title: [], bottom: F.UH - M, fs: (album ? 18 : 11) * b, cap: (album ? 13 : 7.9) * b, step: (album ? 24 : 12.5) * b };

  // Meta rechts, y ab Oberkante des Farbbalkens: "Label /" vor der ersten Zeile, Werte rechtsbündig; Versalhöhe bündig mit dem Balken
  let y = 8 * b, metaLeft = R, metaBottom = 0;
  const meta = album ? [['Label', v('company')], ['Genres', v('genres')], ['Laufzeit', runtime(v('tracks'))]]
    : [['Company', v('company')], ['Genres', v('genres')]];
  for (const [label, text] of meta) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    ctx.font = font(400, 11.3 * b);
    const widths = lines.map(l => ctx.measureText(l).width);
    ctx.font = font(700, 11.3 * b);
    L.meta.push({ label, lines, y, labelX: R - widths[0] - 7 * b });
    metaLeft = Math.min(metaLeft, R - widths[0] - 7 * b - ctx.measureText(label + ' /').width, R - Math.max(...widths));
    metaBottom = y + (lines.length - 1) * 12.8 * b + 3 * b;
    y += (lines.length - 1) * 12.8 * b + 27 * b;
  }

  // Titel + Untertitel, rechts Platz fürs Logo; Laufweite: Helvetica Neue läuft ~3 % enger als Heros
  const logo = !album && state.logo;
  L.ls = logo ? Math.min(110 * h / logo.width, 28 * h / logo.height) : 0;
  const tw = CW - (logo ? logo.width * L.ls + 20 * h : 0);
  for (const [size, text] of [[85, v('title')], [50, v('subtitle')]]) {
    let px = size * h;
    const setFont = () => { ctx.font = font(700, px); ctx.letterSpacing = -.028 * px + 'px'; };
    setFont();
    // eine Zeile, die nur knapp nicht passt, lieber bis 80 % verkleinern als umbrechen
    const widest = Math.max(0, ...text.split('\n').map(l => ctx.measureText(l.trim()).width));
    if (widest > tw) { px *= Math.max(.8, tw / widest); setFont(); }
    wrap(ctx, text, tw).forEach((line, i) => L.title.push({ px, line, w: ctx.measureText(line).width, adv: px + (i ? 0 : 2 * h) }));
  }
  ctx.letterSpacing = '0px';
  // Letzte Titel-Grundlinie ab Balkenoberkante: so tief, dass keine Zeile in Farbbalken oder Meta-Block ragt
  let titleRel = 0;
  for (let i = L.title.length - 1, off = 0; i >= 0; off += L.title[i--].adv) { // off: letzte Grundlinie → Grundlinie dieser Zeile
    const t = L.title[i], above = M + t.w > metaLeft - 8 * b ? metaBottom + 8 * b : 20 * h;
    titleRel = Math.max(titleRel, above + off + t.px * .72);
  }

  // Unten: Beschreibung bzw. Titelliste links, "/Jahr Datum" rechts, beides an der Grundlinie
  const year = v('year'), day = v('day');
  ctx.font = font(400, 14 * b);
  const dayW = ctx.measureText(day).width;
  ctx.font = font(700, 45 * b);
  ctx.letterSpacing = -2.8 * b + 'px'; // Heros-Ziffern sind breiter als die von Helvetica Neue
  L.slashX = R - Math.max(ctx.measureText(year).width, dayW) - 17 * b;
  ctx.letterSpacing = '0px';
  ctx.font = font(400, L.fs);
  const leftW = (year || day ? L.slashX - (album ? 50 : 20) * b : R) - M; // die große Titelliste braucht mehr Abstand zum Jahr
  let lines;
  if (album) { // Spalten von oben nach unten gefüllt, ab 11 Titeln zwei, ab 21 drei
    const list = trackList(v('tracks')), cols = Math.min(3, Math.ceil(list.length / 10)) || 1;
    const cw = (leftW - (cols - 1) * 30 * b) / cols;
    // Schrift so weit verkleinern, dass der längste Titel samt Nummer und Dauer in seine Spalte passt,
    // aber nicht kleiner als die Spiel-Beschreibung (11); erst darunter wird mit "…" gekürzt
    const need = 1.78 * L.fs + Math.max(0, ...list.map(([n, d]) => ctx.measureText(n).width + (d ? ctx.measureText(d).width + .67 * L.fs : 0)));
    const k = Math.max(11 * b / L.fs, Math.min(1, cw / need));
    L.fs *= k; L.cap *= k; L.step *= k;
    L.tracks = { list, rows: lines = Math.ceil(list.length / cols), cw };
  } else lines = (L.desc = wrap(ctx, v('desc'), leftW)).length;
  L.blockTop = L.bottom - Math.max(45.6 * b, L.cap + (lines - 1) * L.step); // oben bündig mit dem Jahr

  if (album) { // Cover zentriert, höchstens 80 % der Satzspiegelbreite, damit Titel und Titelliste Luft haben; Titelliste bleibt unten bündig
    const room = L.blockTop - 36 * b - Math.max(titleRel, metaBottom) - 40 * h - M;
    L.iw = L.ih = Math.max(0, Math.min(.8 * CW, room));
    // übriger Platz zu gleichen Dritteln über das Cover, zwischen Cover und Titel und vor die Titelliste (die unten bündig bleibt)
    const spare = (room - L.ih) / 3;
    L.imgTop = M + spare;
    L.imgX = M + (CW - L.iw) / 2;
    L.barY = L.imgTop + L.ih + 40 * h + spare;
    L.titleY = L.barY + titleRel;
  } else { // Bildoberkante wie im Beispiel bei 2/7 der Höhe, tiefer bei langem Titel
    L.barY = 84;
    L.imgTop = Math.max(400 / 1400 * F.UH, L.barY + titleRel + 23 * h);
    L.imgX = M; L.iw = CW;
    L.ih = L.blockTop - 24 * b - L.imgTop;
    L.titleY = L.imgTop - 23 * h;
  }
  return L;
}

// o: Versatz in Pixeln (Beschnittzugabe), preview: Hinweise zeichnen, die nicht in den Export gehören
function draw(ctx, s, o = 0, preview = false) {
  const F = format(), v = id => $(id).value;
  let L;
  const minIh = isAlbum() ? Math.min(.45 * F.UH, .8 * CW) : .45 * F.UH; // das Albumcover ist ohnehin auf 80 % Breite begrenzt
  for (let i = 0; i <= 5; i++) { // Schrift in 5-%-Schritten bis 75 % verkleinern, bis das Bild mind. 45 % der Höhe hat
    L = plan(ctx, F, 1 - i * .05);
    if (L.ih >= minIh) break;
  }
  state.crowded = L.ih < minIh;
  const { b, h } = L;

  ctx.setTransform(s, 0, 0, s, o, o);
  ctx.imageSmoothingQuality = 'high';
  ctx.textBaseline = 'alphabetic';
  const { bg, fg, frame } = theme();
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, U, F.UH);
  document.querySelectorAll('.swatches input').forEach((c, i) => {
    ctx.fillStyle = c.value;
    ctx.fillRect(M + i * 34 * h, L.barY, 34.5 * h, 8.5 * h);
  });

  ctx.fillStyle = fg;
  ctx.textAlign = 'right';
  for (const m of L.meta) {
    ctx.font = font(400, 11.3 * b);
    m.lines.forEach((l, i) => ctx.fillText(l, R, L.barY + m.y + i * 12.8 * b));
    ctx.font = font(700, 11.3 * b);
    ctx.fillText(m.label + ' /', m.labelX, L.barY + m.y);
  }

  ctx.textAlign = 'left';
  let y = L.titleY; // von der letzten Grundlinie aus wachsen weitere Zeilen nach oben
  for (const t of [...L.title].reverse()) {
    ctx.font = font(700, t.px);
    ctx.letterSpacing = -.028 * t.px + 'px';
    ctx.fillText(t.line, M, y);
    y -= t.adv;
  }
  ctx.letterSpacing = '0px';
  const logo = L.ls && state.logo;
  if (logo) ctx.drawImage(logo, R - logo.width * L.ls, L.imgTop - 13 * h - logo.height * L.ls, logo.width * L.ls, logo.height * L.ls);

  const year = v('year'), day = v('day');
  ctx.textAlign = 'right';
  ctx.font = font(400, 14 * b);
  ctx.fillText(day, R, L.bottom);
  ctx.font = font(700, 45 * b);
  ctx.letterSpacing = -2.8 * b + 'px';
  ctx.fillText(year, R, L.bottom - 13 * b);
  ctx.letterSpacing = '0px';
  if (year || day) {
    ctx.strokeStyle = fg;
    ctx.lineWidth = 3 * b;
    ctx.beginPath(); ctx.moveTo(L.slashX, L.bottom); ctx.lineTo(L.slashX + 11.4 * b, L.bottom - 45.6 * b); ctx.stroke();
  }
  ctx.font = font(400, L.fs);
  ctx.textAlign = 'left';
  const lineY = i => L.blockTop + L.cap + i * L.step;
  L.desc?.forEach((l, i) => ctx.fillText(l, M, lineY(i)));
  if (L.tracks) { // "01  Titel … 4:20" je Spalte, zu lange Titel mit Auslassungspunkten
    const { list, rows, cw } = L.tracks;
    list.forEach(([name, dur], i) => {
      const x = M + Math.floor(i / rows) * (cw + 30 * b), y = lineY(i % rows);
      ctx.font = font(700, L.fs);
      ctx.textAlign = 'left';
      ctx.fillText(String(i + 1).padStart(2, '0'), x, y);
      ctx.font = font(400, L.fs);
      ctx.textAlign = 'right';
      ctx.fillText(dur, x + cw, y);
      ctx.textAlign = 'left';
      ctx.fillText(ellipsis(ctx, name, cw - 1.78 * L.fs - (dur ? ctx.measureText(dur).width + .67 * L.fs : 0)), x + 1.78 * L.fs, y);
    });
  }

  // Bild im Rahmen. Zoom 1 = füllt den Rahmen, < 1 = kleiner als der Rahmen (Rest schwarz), > 1 = hineingezoomt.
  // cropX/cropY (0…1) positionieren das Bild im Spielraum (Rahmen- minus Bildbreite), egal ob es übersteht oder Luft hat
  const { imgX, imgTop, iw, ih } = L;
  ctx.fillStyle = frame;
  ctx.fillRect(imgX, imgTop, iw, ih);
  const img = state.image;
  state.view = null;
  if (img && ih > 0) {
    const k = Math.max(iw / img.width, ih / img.height) * v('zoom'), dw = img.width * k, dh = img.height * k;
    const slackX = iw - dw, slackY = ih - dh;
    ctx.save();
    ctx.beginPath(); ctx.rect(imgX, imgTop, iw, ih); ctx.clip();
    ctx.drawImage(img, imgX + slackX * v('cropX'), imgTop + slackY * v('cropY'), dw, dh);
    ctx.restore();
    state.dpi = img.width / (dw / U * F.w / 2.54); // Quellpixel pro Zoll im Druck
    state.view = { left: imgX, top: imgTop, iw, ih, slackX, slackY };
  } else if (preview) {
    ctx.fillStyle = 'rgba(239, 233, 220, .5)';
    ctx.font = font(400, 16 * b);
    ctx.textAlign = 'center';
    ctx.fillText('Bild hier ablegen oder links auswählen', U / 2, imgTop + ih / 2);
  }
}

// 5 kräftige, unterschiedliche Farben aus dem Bild, dunkel → hell
// ponytail: naive Histogramm-Heuristik (512 Buckets, gierig nach Sättigung); bei Bedarf k-means, Farben sind ohnehin manuell änderbar
function palette(img) {
  const c = new OffscreenCanvas(48, 48), x = c.getContext('2d');
  x.drawImage(img, 0, 0, 48, 48);
  const d = x.getImageData(0, 0, 48, 48).data, buckets = new Map();
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2], key = (r >> 5) << 6 | (g >> 5) << 3 | b >> 5;
    const e = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0, w: 0 };
    e.r += r; e.g += g; e.b += b; e.n++;
    e.w += (Math.max(r, g, b) - Math.min(r, g, b)) / 255 + .05; // Sättigung bevorzugen
    buckets.set(key, e);
  }
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const lum = c => .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
  const picked = [];
  for (const e of [...buckets.values()].sort((a, b) => b.w - a.w)) {
    const rgb = [e.r / e.n, e.g / e.n, e.b / e.n];
    if (picked.every(p => dist(p, rgb) > 60)) picked.push(rgb);
    if (picked.length === 5) break;
  }
  while (picked.length < 5) picked.push(picked.at(-1) || [128, 128, 128]);
  return picked.sort((a, b) => lum(a) - lum(b))
    .map(c => '#' + c.map(n => Math.round(n).toString(16).padStart(2, '0')).join(''));
}

// DPI in die Datei schreiben, damit Druckprogramme 50 × 70 cm erkennen: PNG-pHYs-Chunk bzw. JFIF-Dichte
const CRC = Array.from({ length: 256 }, (_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xEDB88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
const crc32 = bytes => { let c = ~0; for (const b of bytes) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return ~c >>> 0; };
async function withDpi(blob, dpi) {
  const png = new Uint8Array(await blob.arrayBuffer()), chunk = new Uint8Array(21), v = new DataView(chunk.buffer);
  if (blob.type === 'image/jpeg') {
    if (String.fromCharCode(...png.subarray(6, 10)) === 'JFIF') { // APP0 direkt nach SOI: Einheit Zoll, X-/Y-Dichte
      const j = new DataView(png.buffer);
      png[13] = 1; j.setUint16(14, dpi); j.setUint16(16, dpi);
    }
    return new Blob([png], { type: blob.type });
  }
  const ppm = Math.round(dpi / .0254);
  v.setUint32(0, 9); chunk.set([112, 72, 89, 115], 4); v.setUint32(8, ppm); v.setUint32(12, ppm); chunk[16] = 1;
  v.setUint32(17, crc32(chunk.subarray(4, 17)));
  return new Blob([png.subarray(0, 33), chunk, png.subarray(33)], { type: 'image/png' }); // nach IHDR
}

// Vorschau
const preview = $('preview'), main = $('main');
let frame = 0;
function render() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    const cs = getComputedStyle(main);
    const w = main.clientWidth - parseFloat(cs.paddingLeft) * 2, h = main.clientHeight - parseFloat(cs.paddingTop) * 2;
    const F = format(), cssW = Math.max(50, Math.min(w, h * U / F.UH)), dpr = devicePixelRatio || 1;
    preview.style.width = cssW + 'px';
    preview.style.height = cssW * F.UH / U + 'px';
    preview.width = Math.round(cssW * dpr);
    preview.height = Math.round(cssW * F.UH / U * dpr);
    draw(preview.getContext('2d'), preview.width / U, 0, true);
    const amb = $('ambient'); // winzige Kopie des Posters, per CSS weichgezeichnet: Umgebungslicht für die Glasebene
    amb.width = 40; amb.height = Math.round(40 * F.UH / U);
    amb.getContext('2d').drawImage(preview, 0, 0, amb.width, amb.height);
    $('titleWarn').textContent = state.crowded ? 'Zu viel Text für dieses Format: Titel oder Beschreibung kürzen.' : '';
    const [w2, h2] = exportSize(), jpg = $('format').value === 'jpeg', cm = n => n.toLocaleString('de-DE');
    $('export').textContent = `Als ${jpg ? 'JPG' : 'PNG'} exportieren`;
    $('exportInfo').textContent = `${w2} × ${h2} px · ${F.dpi} dpi` + ($('bleed').checked ? ` (${cm(F.w + .6)} × ${cm(F.h + .6)} cm inkl. Beschnitt)` : '');
    if (!SELFTEST) try { localStorage.setItem(STORE + 'poster', JSON.stringify(snapshot())); } catch {}
    if (!upscaling) {
      const need = state.image ? Math.min(4, F.dpi / state.dpi) : 0;
      $('upscale').disabled = need <= 1.05;
      $('upscaleInfo').textContent = !state.image ? '' : need <= 1.05 ? 'Auflösung reicht bereits' : `≈ ${Math.round(state.dpi)} → ${Math.round(state.dpi * need)} dpi`;
    }
    document.documentElement.dataset.theme = $('themeLight').checked ? 'light' : 'dark'; // Oberfläche folgt dem Poster
    const dpiEl = $('dpi');
    dpiEl.textContent = state.image ? `Bildauflösung im Druck: ≈ ${Math.round(state.dpi)} dpi` + (state.dpi < 150 ? ' – unscharf, mind. 150 dpi empfohlen' : '') : '';
    dpiEl.classList.toggle('warn', !!state.image && state.dpi < 150);
  });
}
document.addEventListener('input', e => {
  if (e.target.id === 'title') $('website').value = ''; // Titel von Hand geändert → Website gehört evtl. zu einem anderen Spiel
  render();
});

// Speichern: Felder in localStorage, Bilder in IndexedDB (localStorage ist dafür zu klein), Projekte als Datei
const SELFTEST = location.hash === '#selftest'; // Selbsttest darf gespeicherte Arbeit nicht überschreiben
const saved = () => document.querySelectorAll('#form input[id]:not([type=file]):not(#game), #form textarea, #bleed, #format, #size');
const snapshot = () => Object.fromEntries([...saved()].map(el => [el.id, /checkbox|radio/.test(el.type) ? el.checked : el.value]));
function restore(data) {
  for (const el of saved()) if (data && el.id in data) el[/checkbox|radio/.test(el.type) ? 'checked' : 'value'] = data[el.id];
}
function idb(mode, op) {
  return new Promise((ok, fail) => {
    const r = indexedDB.open('poster', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files');
    r.onerror = () => fail(r.error);
    r.onsuccess = () => { const q = op(r.result.transaction('files', mode).objectStore('files')); q.onsuccess = () => ok(q.result); q.onerror = () => fail(q.error); };
  });
}
const storeFile = (key, file) => SELFTEST || idb('readwrite', st => file ? st.put(file, STORE + key) : st.delete(STORE + key)).catch(() => {});
const HINT = { image: 'oder in die Vorschau ziehen', logo: 'optional, PNG mit Transparenz' };
function clearImage(key) {
  state[key] = state.files[key] = null;
  storeFile(key, null);
  $(key + 'Name').textContent = HINT[key];
}
function resetCrop() {
  $('cropX').value = $('cropY').value = .5;
  $('zoom').value = 1;
}
function newPoster() {
  $('form').reset();
  $('website').value = ''; // versteckte Felder setzt reset() nicht zurück
  resetCrop();
  clearImage('image');
  clearImage('logo');
  $('games').replaceChildren();
  gameStatus();
  render();
}
$('newPoster').onclick = () => confirm('Neues Poster beginnen? Alles, was nicht als Projekt gesichert ist, geht verloren.') && newPoster();

function download(blob, name) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
const fileName = () => [$('title').value, $('subtitle').value].join(' ').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'poster';
const toDataURL = f => new Promise((ok, fail) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = fail; r.readAsDataURL(f); });
$('saveProject').onclick = async () => {
  const files = {};
  for (const [k, f] of Object.entries(state.files)) if (f) files[k] = { name: f.name, data: await toDataURL(f) };
  download(new Blob([JSON.stringify({ poster: 1, mode: MODE, fields: snapshot(), files })], { type: 'application/json' }), fileName() + '.poster.json');
};
async function openProject(p) {
  if (p?.poster !== 1 || typeof p.fields !== 'object') throw new Error('Die Datei ist kein gültiges Poster-Projekt.');
  const mode = p.mode === 'album' ? 'album' : 'game'; // ältere Projekte ohne mode sind Spiele
  if (mode !== MODE) throw new Error(`Das ist ein ${mode === 'album' ? 'Album' : 'Spiel'}-Projekt. Bitte auf der Seite „${mode === 'album' ? 'Album' : 'Spiel'}“ öffnen.`);
  newPoster();
  restore(p.fields);
  for (const k of ['image', 'logo']) {
    const f = p.files?.[k];
    if (typeof f?.data !== 'string' || !f.data.startsWith('data:image/')) continue; // nur eingebettete Bilder, keine fremden URLs
    const b = await (await fetch(f.data)).blob();
    await loadImage(new File([b], String(f.name), { type: b.type }), k, false);
  }
  render();
}
$('openProject').onchange = async e => {
  const f = e.target.files[0];
  e.target.value = '';
  let p;
  try { p = JSON.parse(await f.text()); } catch {}
  try { await openProject(p); } catch (err) { alert(err.message); }
};

// Ausschnitt: in der Vorschau ziehen, Mausrad zoomt, Pfeiltasten verschieben
const toUnits = e => { const r = preview.getBoundingClientRect(); return [(e.clientX - r.left) * U / r.width, (e.clientY - r.top) * U / r.width]; };
const onImage = e => { const [x, y] = toUnits(e), vw = state.view; return !!vw && x >= vw.left && x <= vw.left + vw.iw && y >= vw.top && y <= vw.top + vw.ih; };
function panBy(dx, dy) { // in Poster-Einheiten; Bild folgt der Bewegung
  const vw = state.view, clamp = n => Math.min(1, Math.max(0, n));
  if (!vw) return;
  if (Math.abs(vw.slackX) > .5) $('cropX').value = clamp(+$('cropX').value + dx / vw.slackX);
  if (Math.abs(vw.slackY) > .5) $('cropY').value = clamp(+$('cropY').value + dy / vw.slackY);
  render();
}
let drag = null;
preview.style.touchAction = 'none';
preview.onpointerdown = e => {
  if (!onImage(e)) return;
  drag = toUnits(e);
  preview.setPointerCapture(e.pointerId);
  preview.classList.add('dragging');
};
preview.onpointermove = e => {
  preview.classList.toggle('pannable', onImage(e));
  if (!drag) return;
  const p = toUnits(e);
  panBy(p[0] - drag[0], p[1] - drag[1]);
  drag = p;
};
preview.onpointerup = preview.onpointercancel = () => { drag = null; preview.classList.remove('dragging'); };
preview.onwheel = e => {
  if (!onImage(e)) return;
  e.preventDefault();
  const dy = e.deltaY * (e.deltaMode ? 33 : 1); // Firefox meldet Zeilen statt Pixel
  $('zoom').value = Math.min(4, Math.max(.2, $('zoom').value * Math.exp(-dy * .002)));
  render();
};
preview.onkeydown = e => {
  const d = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }[e.key];
  if (d && state.view) { e.preventDefault(); panBy(...d); }
};

function applyPalette() {
  if (!state.image) return;
  const cols = palette(state.image);
  document.querySelectorAll('.swatches input').forEach((c, i) => c.value = cols[i]);
  render();
}
// fresh: neu gewähltes Bild → Ausschnitt zurücksetzen und Farben übernehmen; beim Wiederherstellen nicht
async function loadImage(file, key, fresh = true) {
  if (!file?.type.startsWith('image/')) return;
  try { state[key] = await createImageBitmap(file); }
  catch { return alert('Das Bild konnte nicht gelesen werden.'); }
  state.files[key] = file;
  storeFile(key, file);
  $(key + 'Name').textContent = file.name;
  if (fresh && key === 'image') { resetCrop(); applyPalette(); } else render();
}
$('image').onchange = e => loadImage(e.target.files[0], 'image');
$('logo').onchange = e => loadImage(e.target.files[0], 'logo');
$('auto').onclick = applyPalette;
main.ondragover = e => { e.preventDefault(); main.classList.add('drag'); };
main.ondragleave = () => main.classList.remove('drag');
main.ondrop = e => { e.preventDefault(); main.classList.remove('drag'); loadImage(e.dataTransfer.files[0], 'image'); };

// Spieldaten: Wikidata (Fakten, Logo, Steam-Nummer) + Wikipedia (Beschreibung, Cover). Frei, ohne Key,
// sehr vollständig bei bekannten Spielen und kennt auch Abkürzungen wie "kotor"
function gameFields(g) {
  const [title, ...rest] = g.name.split(': ');
  const para = (g.description || '').split(/\n+/)[0].trim();
  const d = g.released && new Date(g.released);
  return {
    title: rest.length ? title + ':' : title,
    subtitle: rest.join(': ').replace(/ - /g, '\n'),
    company: g.developer || '',
    genres: (g.genres || []).join('\n'),
    desc: para.length > 500 ? para.slice(0, para.lastIndexOf('. ', 499) + 1) || para.slice(0, 500) : para, // am Satzende kürzen
    year: d ? String(d.getUTCFullYear()) : '',
    day: d ? shortDay(d) : '',
    website: g.website || '', // offizielle Seite, dort liegt meist das Presskit
  };
}
const shortDay = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const gameStatus = t => $('gameStatus').textContent = t ?? '';
const errText = e => e instanceof TypeError ? 'Keine Verbindung zur Datenbank. Internet prüfen.' : e.message;
async function wm(host, params) { // MediaWiki-API (Wikidata, Commons), origin=* erlaubt den Zugriff aus dem Browser
  const r = await fetch(`https://${host}/w/api.php?` + new URLSearchParams({ format: 'json', origin: '*', ...params }));
  if (!r.ok) throw new Error(`${host}: Fehler ${r.status}.`);
  return r.json();
}
const wd = params => wm('www.wikidata.org', params);
const claims = (e, p) => (e?.claims?.[p] || []).map(c => c.mainsnak?.datavalue?.value).filter(Boolean);
const wdLabel = e => (e?.labels?.en || e?.labels?.mul || e?.labels?.de)?.value || '';
const wdDate = e => claims(e, 'P577').filter(t => t.precision >= 9) // früheste Angabe mit der genauesten Präzision
  .sort((a, b) => b.precision - a.precision || a.time.localeCompare(b.time))[0];
const genreName = s => s.replace(/ (video )?games?$/i, '').replace(/(^|[\s-])\S/g, c => c.toUpperCase()); // "racing video game" → "Racing"
async function wikidataSearch(q) {
  const ids = (await wd({ action: 'query', list: 'search', srsearch: q + ' haswbstatement:P31=Q7889', srlimit: 10 })).query.search.map(r => r.title);
  if (!ids.length) return [];
  const { entities } = await wd({ action: 'wbgetentities', ids: ids.join('|'), props: 'labels|claims|sitelinks', languages: 'en|mul|de' });
  return ids.map(id => entities[id]).filter(wdLabel).map(e => ({ name: wdLabel(e), info: wdDate(e)?.time.slice(1, 5), load: () => wikidataGame(e) }));
}
async function wikidataGame(e) {
  const dev = claims(e, 'P178')[0]?.id, genres = claims(e, 'P136').map(v => v.id).slice(0, 6), logoFile = claims(e, 'P154')[0];
  const ids = [dev, ...genres].filter(Boolean);
  const [lang, page] = e.sitelinks?.enwiki ? ['en', e.sitelinks.enwiki.title] : e.sitelinks?.dewiki ? ['de', e.sitelinks.dewiki.title] : [];
  const [names, summary, logo] = await Promise.all([
    ids.length ? wd({ action: 'wbgetentities', ids: ids.join('|'), props: 'labels', languages: 'en|mul|de' }).then(r => r.entities) : {},
    page ? fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page)}`).then(r => r.ok ? r.json() : {}, () => ({})) : {},
    // Commons liefert per API direkt eine PNG-Adresse, auch für SVG-Logos (Weiterleitungen dort hätten keine CORS-Freigabe)
    logoFile ? wm('commons.wikimedia.org', { action: 'query', titles: 'File:' + logoFile, prop: 'imageinfo', iiprop: 'url', iiurlwidth: 1200 })
      .then(r => Object.values(r.query.pages)[0]?.imageinfo?.[0]?.thumburl, () => null) : null,
  ]);
  const date = wdDate(e), steam = claims(e, 'P1733')[0];
  const fields = gameFields({
    name: wdLabel(e),
    released: date?.precision >= 11 ? date.time.slice(1, 11) : undefined,
    developer: dev && wdLabel(names[dev]),
    genres: [...new Set(genres.map(id => genreName(wdLabel(names[id]))).filter(Boolean))],
    description: summary.extract,
    website: claims(e, 'P856')[0],
  });
  if (!fields.year && date) fields.year = date.time.slice(1, 5);
  return {
    fields,
    // Cover aus dem Wikipedia-Artikel, meist nur ~300 px: Platzhalter
    covers: summary.originalimage ? [['Wikipedia-Cover.jpg', summary.originalimage.source]] : [],
    logos: [steam && ['Steam-Logo.png', `https://shared.steamstatic.com/store_item_assets/steam/apps/${steam}/logo.png`],
      logo && ['Wikidata-Logo.png', logo]].filter(Boolean), // Steam zuerst: verlässlicher und meist hell für dunkle Poster
  };
}

// Albumdaten: MusicBrainz (Titel, Künstler, Label, Genres, Titelliste) + Cover Art Archive. Frei, ohne Key.
// Spotify geht nicht: dessen API verlangt immer einen Key (OAuth), auch für öffentliche Daten
let mbNext = 0;
async function mb(path, params, retry = true) { // MusicBrainz erlaubt 1 Anfrage pro Sekunde, sonst Fehler 503: Anfragen hintereinander einreihen
  const wait = mbNext - Date.now();
  mbNext = Math.max(mbNext, Date.now()) + 1000;
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  const r = await fetch(`https://musicbrainz.org/ws/2/${path}?` + new URLSearchParams({ fmt: 'json', ...params }));
  if (r.status === 503 && retry) return mb(path, params, false); // kommt trotz Takt gelegentlich vor
  if (!r.ok) throw new Error(`MusicBrainz: Fehler ${r.status}.`);
  return r.json();
}
const credit = ac => (ac || []).map(a => a.name + (a.joinphrase || '')).join('');
const fold = s => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').split(/[^\p{L}\p{N}]+/u).filter(Boolean); // "Die Ärzte" → [die, arzte]
const albumHit = g => ({ name: g.title, load: () => albumLoad(g),
  info: [credit(g['artist-credit']), g['first-release-date']?.slice(0, 4), ...(g['secondary-types'] || [])].filter(Boolean).join(' · ') });
async function albumSearch(q) {
  // jedes Wort muss im Albumtitel oder beim Künstler vorkommen ("abbey road beatles"), der ganze Text als Albumtitel zählt extra;
  // klein geschrieben, damit AND/OR keine Operatoren werden. Das letzte Wort zählt als Wortanfang, damit schon beim Tippen
  // etwas kommt ("rammst"); nicht bei Sonderzeichen ("ac/dc"), daran scheitert der Platzhalter
  const esc = s => s.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, '\\$&'), words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const terms = words.map((w, i) => esc(w) + (i === words.length - 1 && /^[\p{L}\p{N}]+$/u.test(w) ? '*' : ''));
  const query = `+(${terms.map(t => `(releasegroup:${t} OR artist:${t})`).join(' AND ')}) releasegroup:"${esc(words.join(' '))}"^8 +(primarytype:album OR primarytype:ep)`;
  const groups = (await mb('release-group', { query, limit: 100 }))['release-groups'] || [];
  // MusicBrainz kennt keine Beliebtheit; viele Veröffentlichungen (count) heißt bekanntes Album: "thriller" → Michael Jackson statt der Band Thriller.
  // Compilations, Live, Karaoke usw. hinter die Studioalben
  const rank = g => (g.score || 0) + 20 * Math.log10(1 + (g.count || 0)) - (g['secondary-types']?.length ? 15 : 0);
  // Künstler, auf deren Namen alle Wörter passen, bekommen eine eigene Zeile oben; Klick zeigt alle ihre Alben.
  // ponytail: nur Künstler unter den 100 Kandidaten mit mind. 3 Veröffentlichungen darin, sonst taucht jeder Namensvetter auf
  const artists = new Map(), qw = fold(q);
  for (const g of groups) for (const { artist } of g['artist-credit'] || []) {
    const names = fold(artist?.name || '');
    if (!artist?.id || !qw.every(w => names.some(n => n.startsWith(w)))) continue;
    const a = artists.get(artist.id) || { name: artist.name, n: 0 };
    a.n += g.count || 1;
    artists.set(artist.id, a);
  }
  const top = [...artists].filter(([, a]) => a.n >= 3).sort((x, y) => y[1].n - x[1].n).slice(0, 2)
    .map(([id, a]) => ({ name: a.name, info: 'Künstler · alle Alben zeigen', albums: () => artistAlbums(id) }));
  return [...top, ...groups.sort((a, b) => rank(b) - rank(a)).slice(0, 10).map(albumHit)];
}
async function artistAlbums(id) { // Diskografie: Studioalben zuerst, jeweils chronologisch
  const groups = (await mb('release-group', { artist: id, type: 'album|ep', inc: 'artist-credits', limit: 100 }))['release-groups'] || [];
  const key = g => (g['secondary-types']?.length ? '1' : '0') + (g['first-release-date'] || '9');
  return groups.sort((a, b) => key(a).localeCompare(key(b))).map(albumHit);
}
async function albumLoad(g) {
  const [{ releases = [] }, { genres = [] }] = await Promise.all([
    mb('release', { 'release-group': g.id, status: 'official', inc: 'recordings labels', limit: 100 }),
    mb('release-group/' + g.id, { inc: 'genres' }),
  ]);
  // ponytail: Erstveröffentlichung (genau am Datum der Albumgruppe, sonst die früheste) = meist die Originalfassung ohne Bonustitel;
  // nur die erste Seite (bis 100) wird angesehen, sonst Titelliste von Hand kürzen
  const key = r => r.date === g['first-release-date'] ? '0' : r.date || '9';
  const rel = releases.filter(r => r.media?.some(m => m.tracks?.length)).sort((a, b) => key(a).localeCompare(key(b)))[0];
  return {
    fields: albumFields({
      title: g.title, artist: credit(g['artist-credit']), date: g['first-release-date'],
      label: rel?.['label-info']?.map(l => l.label?.name).find(n => n && n !== '[no label]'),
      genres: genres.sort((a, b) => b.count - a.count).slice(0, 3).map(x => x.name),
      tracks: (rel?.media || []).flatMap(m => m.tracks || []).map(t => ({ title: t.title, ms: t.length ?? t.recording?.length })),
    }),
    covers: [['Album-Cover.jpg', `https://coverartarchive.org/release-group/${g.id}/front`]], // Original in voller Auflösung
  };
}
function albumFields(a) {
  const d = /^\d{4}-\d\d-\d\d$/.test(a.date || '') && new Date(a.date);
  return {
    title: a.title,
    subtitle: a.artist || '',
    company: a.label || '',
    genres: [...new Set(a.genres.map(genreName))].join('\n'),
    tracks: a.tracks.map(t => t.title + (t.ms ? ' ' + clock(Math.round(t.ms / 1000)) : '')).join('\n'),
    year: a.date?.slice(0, 4) || '',
    day: d ? shortDay(d) : '',
  };
}

async function applyGame(load) {
  gameStatus('Wird geladen…');
  try {
    const { fields, covers, logos } = await load();
    Object.entries(fields).forEach(([k, v]) => $(k).value = v);
    await Promise.all([autoImage('image', covers), logos && autoImage('logo', logos)]);
    gameStatus();
    render();
  } catch (err) { gameStatus(errText(err)); }
}
// Automatisch geladene Bilder ersetzen sich beim nächsten Treffer, eigene Uploads bleiben. sources: [[Name, URL], …], erste ladbare gewinnt
const AUTO = new Set(['Wikipedia-Cover.jpg', 'Steam-Logo.png', 'Wikidata-Logo.png', 'Album-Cover.jpg']);
async function autoImage(key, sources) {
  if (state[key] && !AUTO.has($(key + 'Name').textContent)) return;
  clearImage(key);
  for (const [name, url] of sources) {
    try {
      const r = await fetch(url);
      const b = r.ok && await r.blob();
      if (b?.type.startsWith('image/')) return await loadImage(new File([b], name, { type: b.type }), key);
    } catch {}
  }
  if (key === 'logo') $('logoName').textContent = 'Kein Logo gefunden';
}
// Bildquellen: öffnen die jeweilige Suche mit dem Spielnamen (ohne Key)
const SEARCH = {
  presskit: q => {
    let host = '';
    try { host = new URL($('website').value).hostname.replace(/^www\./, ''); } catch {}
    return 'https://www.google.com/search?' + new URLSearchParams({ q: host ? `site:${host} (press OR presskit OR media)` : `"${q}" press kit key art` });
  },
  alphacoders: q => 'https://wall.alphacoders.com/search.php?' + new URLSearchParams({ search: q }),
  google: q => 'https://www.google.com/search?' + new URLSearchParams({ q: q + (isAlbum() ? ' album cover' : ' key art'), tbm: 'isch', tbs: 'isz:l' }),
  wallhaven: q => 'https://wallhaven.cc/search?' + new URLSearchParams({ q, categories: '111', purity: '100', atleast: '2400x2400', sorting: 'relevance' }),
};
document.querySelectorAll('[data-search]').forEach(a => a.onclick = () => {
  const q = $('game').value.trim() || [$('title').value, $('subtitle').value].join(' ').replace(/\s+/g, ' ').trim();
  a.href = SEARCH[a.dataset.search](q);
});
// Eigene Ergebnisliste statt <datalist>: der Browser würde dort Treffer ausblenden, die den getippten
// Text nicht wörtlich enthalten ("need for speed most wanted" ≠ "Need for Speed: Most Wanted")
let searchTimer, searchSeq = 0;
async function searchGames(q) {
  const seq = ++searchSeq;
  let hits;
  try { hits = await (isAlbum() ? albumSearch : wikidataSearch)(q); }
  catch (err) { if (seq === searchSeq) gameStatus(errText(err)); return; }
  if (seq !== searchSeq) return; // Antwort auf eine ältere Eingabe
  showHits(hits);
  gameStatus(hits.length ? undefined : isAlbum() ? 'Kein Album gefunden. Albumtitel oder Künstler versuchen.' : 'Kein Spiel gefunden. Englischen Originaltitel versuchen.');
}
// Treffer: Spiel/Album lädt die Daten, Künstler (h.albums) ersetzt die Liste durch seine Alben
function showHits(hits) {
  $('games').replaceChildren(...hits.map(h => {
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'result' });
    b.append(h.name, Object.assign(document.createElement('span'), { textContent: h.info || '' }));
    b.onclick = async () => {
      if (!h.albums) { $('game').value = h.name; $('games').replaceChildren(); return applyGame(h.load); }
      const seq = ++searchSeq;
      gameStatus('Alben werden geladen…');
      try {
        const albums = await h.albums();
        if (seq !== searchSeq) return;
        showHits(albums);
        gameStatus(albums.length ? undefined : 'Keine Alben gefunden.');
        $('games').firstElementChild?.focus();
      } catch (err) { if (seq === searchSeq) gameStatus(errText(err)); }
    };
    return b;
  }));
}
if (MODE === 'album') Object.entries({ game: 'z. B. Abbey Road Beatles', title: 'z. B. Abbey Road', subtitle: 'z. B. The Beatles', company: 'z. B. Apple',
  genres: 'Rock\nPop' }).forEach(([id, p]) => $(id).placeholder = p);
$('game').oninput = e => {
  const q = e.target.value.trim();
  clearTimeout(searchTimer);
  searchSeq++;
  $('games').replaceChildren();
  if (q.length < 2) return gameStatus();
  searchTimer = setTimeout(() => searchGames(q), 350);
};
$('game').onkeydown = e => {
  const first = $('games').firstElementChild;
  if (e.key === 'ArrowDown' && first) { e.preventDefault(); first.focus(); }
  if (e.key === 'Enter' && first) { e.preventDefault(); first.click(); }
};
$('games').onkeydown = e => {
  const t = e.target, next = { ArrowDown: t.nextElementSibling, ArrowUp: t.previousElementSibling || $('game') }[e.key];
  if (next) { e.preventDefault(); next.focus(); }
  if (e.key === 'Escape') { $('games').replaceChildren(); $('game').focus(); }
};

// KI-Hochskalieren mit ESRGAN (RDN, 4×) über TensorFlow.js. build.py bettet vendor/ als inaktive
// <script type="text/plain">-Blöcke ein; ausgeführt werden sie erst beim ersten Klick (schneller Seitenstart)
function runVendor(id) {
  const code = document.getElementById(id)?.textContent;
  if (!code) throw new Error(`Eingebettetes Skript "${id}" fehlt. index.html mit "python3 build.py" neu bauen.`);
  document.head.append(Object.assign(document.createElement('script'), { textContent: code })); // läuft sofort beim Einfügen
}
let esrgan = null, upscaling = false;
async function loadEsrgan() {
  if (esrgan) return esrgan;
  if (!window.tf) runVendor('vendor-tf');
  if (!window.ESRGAN_X4) runVendor('vendor-esrgan');
  if (!await tf.setBackend('webgl').catch(() => false)) await tf.setBackend('cpu'); // ohne WebGL deutlich langsamer
  const { modelTopology, weightSpecs, weights } = window.ESRGAN_X4;
  const weightData = Uint8Array.from(atob(weights), c => c.charCodeAt(0)).buffer;
  return esrgan = await tf.loadLayersModel(tf.io.fromMemory({ modelTopology, weightSpecs, weightData }));
}
// Rechnet img auf targetW Pixel Breite hoch: Eingabe erst so verkleinern, dass 4× genau passt, dann in
// Kacheln mit Überlappung durchs Modell (ganze Bilder sprengen den Grafikspeicher)
async function upscale(img, targetW, onProgress = () => {}) {
  const model = await loadEsrgan(), T = 128, P = 8;
  const w = Math.max(1, Math.round(Math.min(img.width, targetW / 4))), h = Math.max(1, Math.round(img.height * w / img.width));
  const src = new OffscreenCanvas(w, h).getContext('2d');
  src.imageSmoothingQuality = 'high';
  src.drawImage(img, 0, 0, w, h);
  const out = new OffscreenCanvas(w * 4, h * 4), octx = out.getContext('2d');
  const total = Math.ceil(w / T) * Math.ceil(h / T);
  let done = 0;
  for (let y = 0; y < h; y += T) for (let x = 0; x < w; x += T) {
    const x0 = Math.max(0, x - P), y0 = Math.max(0, y - P), x1 = Math.min(w, x + T + P), y1 = Math.min(h, y + T + P);
    const res = tf.tidy(() => model.predict(tf.browser.fromPixels(src.getImageData(x0, y0, x1 - x0, y1 - y0)).toFloat().expandDims(0))
      .squeeze().clipByValue(0, 255).round().toInt());
    const px = await tf.browser.toPixels(res);
    res.dispose();
    // nur den Kern der Kachel übernehmen, der Überlappungsrand verhindert sichtbare Nähte
    octx.putImageData(new ImageData(px, (x1 - x0) * 4, (y1 - y0) * 4), x0 * 4, y0 * 4, (x - x0) * 4, (y - y0) * 4, Math.min(T, w - x) * 4, Math.min(T, h - y) * 4);
    onProgress(++done / total);
  }
  return out;
}
$('upscale').onclick = async ({ currentTarget: b }) => {
  const img = state.image, file = state.files.image;
  if (!img) return;
  const MAX_PX = 50e6; // ponytail: feste Obergrenze gegen Speicherabstürze; besser wäre, sie aus dem Gerätespeicher abzuleiten
  let targetW = img.width * Math.min(4, format().dpi / state.dpi) * 1.02;
  targetW = Math.min(targetW, Math.sqrt(MAX_PX * img.width / img.height));
  upscaling = b.disabled = true;
  const bar = $('upscaleProgress');
  bar.hidden = false; bar.removeAttribute('value');
  $('upscaleInfo').textContent = 'KI wird geladen…';
  try {
    const out = await upscale(img, targetW, f => { bar.value = f; $('upscaleInfo').textContent = `${Math.round(f * 100)} %`; });
    if (state.image !== img) return; // Bild wurde währenddessen gewechselt
    const blob = await out.convertToBlob({ type: 'image/jpeg', quality: .95 });
    const name = (file?.name || 'bild').replace(/\.\w+$/, '') + '-ki.jpg';
    await loadImage(new File([blob], name, { type: blob.type }), 'image', false); // Ausschnitt und Farben bleiben
  } catch (err) {
    alert('Hochskalieren fehlgeschlagen: ' + err.message);
  } finally {
    upscaling = false;
    bar.hidden = true;
    render();
  }
};

const bleedPx = F => Math.round(3 / 25.4 * F.dpi); // 3 mm Beschnitt
const exportSize = () => { const F = format(), b = $('bleed').checked ? 2 * bleedPx(F) : 0; return [F.px[0] + b, F.px[1] + b]; };
function renderFull() {
  const c = document.createElement('canvas'), ctx = c.getContext('2d'), F = format();
  [c.width, c.height] = exportSize();
  ctx.fillStyle = theme().bg;
  ctx.fillRect(0, 0, c.width, c.height); // Beschnittzugabe in Hintergrundfarbe
  draw(ctx, F.px[0] / U, (c.width - F.px[0]) / 2);
  return c;
}
$('export').onclick = async ({ currentTarget: b }) => {
  const label = b.textContent;
  b.disabled = true; b.textContent = 'Wird exportiert…';
  await new Promise(r => setTimeout(r, 30));
  try {
    const c = renderFull();
    const type = 'image/' + $('format').value;
    const blob = await new Promise((ok, fail) => c.toBlob(b => b ? ok(b) : fail(new Error('Canvas zu groß für diesen Browser')), type, .92));
    download(await withDpi(blob, format().dpi), `${fileName()}-${format().key}${type === 'image/jpeg' ? '.jpg' : '.png'}`);
  } catch (err) {
    alert('Export fehlgeschlagen: ' + err.message);
  } finally {
    b.disabled = false; b.textContent = label;
  }
};

// Start: Schrift laden, letzte Sitzung wiederherstellen, dann zeichnen
if (MODE !== 'start') fontsReady.finally(async () => { // Startseite zeichnet nichts und darf nichts überschreiben
  if (!SELFTEST) {
    try { restore(JSON.parse(localStorage.getItem(STORE + 'poster'))); } catch {}
    for (const k of ['image', 'logo']) {
      const f = await idb('readonly', st => st.get(STORE + k)).catch(() => null);
      if (f) await loadImage(f, k, false);
    }
  }
  new ResizeObserver(render).observe(main);
});

// Selbsttest: http://localhost:8000/#selftest (braucht einen lokalen Server für Examples/)
if (location.hash === '#selftest') (async () => {
  const ok = (c, m) => { if (!c) throw new Error(m); };
  try {
    ok(crc32(new TextEncoder().encode('IEND')) === 0xAE426082, 'crc32');
    const png = new Uint8Array(await (await withDpi(await new OffscreenCanvas(2, 2).convertToBlob(), 300)).arrayBuffer());
    ok(String.fromCharCode(...png.subarray(37, 41)) === 'pHYs' && new DataView(png.buffer).getUint32(41) === 11811, 'pHYs');
    ok((await fontsReady).every(f => f.length), 'Poster-Schrift geladen');
    const ctx = preview.getContext('2d');
    ctx.font = font(400, 10);
    ok(wrap(ctx, 'aa bb cc', 1).length === 3 && wrap(ctx, 'aa bb\n\ncc', 1e4).length === 3 && !wrap(ctx, ' ', 1).length, 'wrap');
    const wr = ctx.measureText('aa bb cc dd').width + 1; // "aa bb cc dd ee" würde "ee" allein lassen
    ok(wrap(ctx, 'aa bb cc dd ee', wr).join('|') === 'aa bb cc|dd ee', 'wrap ohne einzelnes Wort am Ende');
    const f = gameFields({ name: 'Star Wars: Knights of the Old Republic II - The Sith Lords', released: '2004-12-06',
      developer: 'Obsidian Entertainment', genres: ['Action', 'RPG'], description: 'Aa bb. '.repeat(100) + '\nZweiter Absatz', website: 'https://x.y/' });
    ok(f.title === 'Star Wars:' && f.subtitle === 'Knights of the Old Republic II\nThe Sith Lords' && f.company === 'Obsidian Entertainment'
      && f.genres === 'Action\nRPG' && f.year === '2004' && f.day === 'Dec 6' && f.desc.length <= 500 && f.desc.endsWith('.') && f.website === 'https://x.y/', 'gameFields');
    const h = gameFields({ name: 'Hollow Knight' });
    ok(h.title === 'Hollow Knight' && h.subtitle === '' && h.year === '' && h.desc === '' && h.company === '', 'gameFields minimal');

    // Wikidata/Wikipedia/Commons simulieren: Treffer trotz Doppelpunkt, alle Felder, Cover, Logo-Rückfall Steam → Wikidata
    const realFetch = window.fetch, v = value => ({ mainsnak: { datavalue: { value } } });
    const tinyPng = await new OffscreenCanvas(4, 4).convertToBlob();
    const fake = {
      Q1: { id: 'Q1', labels: { en: { value: 'Need for Speed: Most Wanted' } }, sitelinks: { enwiki: { title: 'Need for Speed: Most Wanted (2012 video game)' } },
        claims: { P577: [v({ time: '+2012-00-00T00:00:00Z', precision: 9 }), v({ time: '+2012-10-30T00:00:00Z', precision: 11 })], P178: [v({ id: 'Q2' })],
          P136: [v({ id: 'Q3' }), v({ id: 'Q4' })], P856: [v('https://www.ea.com/nfs')], P1733: [v('1262560')], P154: [v('NFS Logo.svg')] } },
      Q2: { labels: { mul: { value: 'Criterion Games' } } }, Q3: { labels: { en: { value: 'racing video game' } } }, Q4: { labels: { en: { value: 'open world' } } },
    };
    window.fetch = async url => {
      const u = new URL(url), json = o => new Response(JSON.stringify(o));
      if (u.hostname.endsWith('wikipedia.org')) return json({ extract: 'Need for Speed: Most Wanted is a 2012 racing game.\nZweiter Absatz.', originalimage: { source: 'https://upload.wikimedia.org/cover.jpg' } });
      if (u.hostname === 'commons.wikimedia.org') return json({ query: { pages: { 1: { imageinfo: [{ thumburl: 'https://upload.wikimedia.org/logo.png' }] } } } });
      if (u.hostname === 'upload.wikimedia.org') return new Response(tinyPng);
      if (u.hostname.includes('steamstatic')) return new Response('', { status: 404 }); // kein Steam-Logo → Wikidata-Logo
      if (u.searchParams.get('list') === 'search') return json({ query: { search: [{ title: 'Q1' }] } });
      return json({ entities: Object.fromEntries(u.searchParams.get('ids').split('|').map(id => [id, fake[id]])) });
    };
    try {
      await searchGames('need for speed most wanted');
      ok($('games').children.length === 1 && $('games').textContent === 'Need for Speed: Most Wanted2012', 'Wikidata-Suche');
      const w = await wikidataGame(fake.Q1);
      ok(w.fields.title === 'Need for Speed:' && w.fields.subtitle === 'Most Wanted' && w.fields.company === 'Criterion Games'
        && w.fields.genres === 'Racing\nOpen World' && w.fields.year === '2012' && w.fields.day === 'Oct 30'
        && w.fields.desc === 'Need for Speed: Most Wanted is a 2012 racing game.' && w.fields.website === 'https://www.ea.com/nfs', 'Wikidata-Felder');
      ok(w.covers[0][1] === 'https://upload.wikimedia.org/cover.jpg' && w.logos.map(l => l[0]).join() === 'Steam-Logo.png,Wikidata-Logo.png'
        && w.logos[0][1].includes('/1262560/') && w.logos[1][1] === 'https://upload.wikimedia.org/logo.png', 'Cover und Logo-Quellen');
      await applyGame(() => wikidataGame(fake.Q1));
      ok($('imageName').textContent === 'Wikipedia-Cover.jpg' && $('logoName').textContent === 'Wikidata-Logo.png' && state.logo, 'Logo-Rückfall auf Wikidata');
      state.files.logo = new File([tinyPng], 'mein-logo.png'); $('logoName').textContent = 'mein-logo.png'; // eigener Upload bleibt
      await autoImage('logo', w.logos);
      ok($('logoName').textContent === 'mein-logo.png', 'eigenes Logo bleibt');
    } finally { window.fetch = realFetch; }
    $('games').replaceChildren();
    $('website').value = 'https://www.teamcherry.com.au/';
    ok(decodeURIComponent(SEARCH.presskit('Hollow Knight')).includes('site:teamcherry.com.au'), 'Presskit auf offizieller Seite');
    $('website').value = 'kein link';
    ok(decodeURIComponent(SEARCH.presskit('Hollow Knight').replace(/\+/g, ' ')).includes('"Hollow Knight" press kit'), 'Presskit ohne Website');
    const jpg = new Uint8Array(await (await withDpi(await new OffscreenCanvas(2, 2).convertToBlob({ type: 'image/jpeg' }), 300)).arrayBuffer());
    ok(jpg[13] === 1 && jpg[14] * 256 + jpg[15] === 300, 'JPG-DPI');

    // Beispiel als Projekt öffnen (prüft Laden inkl. eingebettetem Bild)
    const sw = await toDataURL(await (await fetch('Examples/StarWars_KOTOR2.jpg')).blob());
    await openProject({ poster: 1, files: { image: { name: 'kotor.jpg', data: sw }, logo: { name: 'x', data: 'https://example.com/x.png' } }, fields: {
      title: 'Star Wars:', subtitle: 'Knights of the Old Republic II\nThe Sith Lords', company: 'Obsidian Entertainment',
      genres: 'Action\nAdventure\nDrama\nFantasy\nMystery\nSci-Fi', year: '2004', day: 'Dec 6', zoom: '1', color1: '#7a1f1a', unbekannt: 'x',
      desc: 'Star Wars: Knights of the Old Republic II - The Sith Lords: In the aftermath of the Jedi Civil War, the galaxy teeters on the brink of collapse. As the Exile, a lone Jedi disconnected from the Force, you must navigate a shattered galaxy haunted by the Sith Triumvirate, who seek to annihilate the Jedi Order. Your choices shape allies, enemies, and the fate of the Force itself in a story of redemption, betrayal, and the blurred lines between light and dark.' } });
    ok(state.image && !state.logo && $('title').value === 'Star Wars:' && $('color1').value === '#7a1f1a', 'Projekt öffnen');
    ok(JSON.stringify(snapshot()) === JSON.stringify((restore(snapshot()), snapshot())), 'snapshot/restore');

    // Layout: 50 × 70 exakt wie gemessen (Faktor 1, Bild ab 400); langer Titel schiebt das Bild nach unten statt in die Genres
    let L = plan(ctx, format(), 1);
    ok(L.b === 1 && L.h === 1 && Math.abs(L.imgTop - 400) < 1e-9 && L.barY + L.meta[0].y === 92 && L.bottom === 1300, '50 × 70 unverändert');
    const t = $('title').value;
    $('title').value = 'Wwwwwwwwwwww Wwwwwwwwwwwww Wwwwwwwwwwww';
    ok(plan(ctx, format(), 1).imgTop > 450, 'langer Titel schiebt Bild nach unten');
    $('title').value = t;
    // Jedes Format: Beispiel mit langer Beschreibung passt, kleine Formate haben relativ größere Schrift
    for (const size of Object.keys(FORMATS)) {
      $('size').value = size;
      draw(ctx, preview.width / U);
      ok(!state.crowded && state.view.ih >= .45 * format().UH, 'genug Platz fürs Bild in ' + size);
    }
    $('size').value = 'a5';
    ok(plan(ctx, format(), 1).b > 1.8 && format().dpi === 300, 'A5: größere Schrift, 300 dpi');
    $('size').value = '70x100';
    ok(format().px[0] * format().px[1] <= 50e6 && format().dpi < 300, '70 × 100: höchstens 50 MP');
    $('size').value = '50x70';
    ok(format().px.join() === '5906,8268', '50 × 70: 5906 × 8268 px');

    // Ausschnitt: verschieben bleibt in 0…1, Zoom verkleinert die Quellfläche
    draw(ctx, preview.width / U);
    const dpi1 = state.dpi;
    panBy(-1e6, -1e6); // Hochformat-Bild: nur vertikal beschnitten, horizontal nichts zu verschieben
    ok(+$('cropX').value === .5 && +$('cropY').value === 1, 'panBy klemmt');
    $('zoom').value = 2;
    draw(ctx, preview.width / U);
    ok(Math.abs(state.dpi - dpi1 / 2) < 1, 'Zoom');
    $('zoom').value = .5; // kleiner als der Rahmen: doppelte Auflösung, frei verschiebbar innerhalb des Rahmens
    draw(ctx, preview.width / U);
    ok(Math.abs(state.dpi - dpi1 * 2) < 1 && state.view.slackX > 0 && state.view.slackY > 0, 'Herauszoomen');
    panBy(1e6, 1e6);
    ok(+$('cropX').value === 1 && +$('cropY').value === 1, 'panBy beim Herauszoomen');
    resetCrop();

    // KI-Hochskalieren: mehrere Kacheln inkl. Randkacheln; verkleinert muss das Ergebnis dem Original entsprechen
    const tc = new OffscreenCanvas(150, 100), tx = tc.getContext('2d');
    for (let i = 0; i < 30; i++) { tx.fillStyle = `hsl(${i * 37}, 70%, ${30 + i % 5 * 10}%)`; tx.fillRect(i * 13 % 150, i * 7 % 100, 40, 25); }
    const t0 = performance.now(), up = await upscale(await createImageBitmap(tc), 600);
    ok(up.width === 600 && up.height === 400, 'Upscale-Größe');
    const back = new OffscreenCanvas(150, 100).getContext('2d');
    back.drawImage(up, 0, 0, 150, 100);
    const a1 = tx.getImageData(0, 0, 150, 100).data, a2 = back.getImageData(0, 0, 150, 100).data;
    let diff = 0;
    for (let i = 0; i < a1.length; i += 4) diff += Math.abs(a1[i] - a2[i]) + Math.abs(a1[i + 1] - a2[i + 1]) + Math.abs(a1[i + 2] - a2[i + 2]);
    diff /= 150 * 100 * 3;
    ok(diff < 8, 'Upscale-Inhalt (Abweichung ' + diff.toFixed(1) + ')');
    console.log('upscale', tf.getBackend(), Math.round(performance.now() - t0) + ' ms', 'diff', diff.toFixed(2));
    window.upscaleInfo = `${tf.getBackend()} ${Math.round(performance.now() - t0)} ms diff ${diff.toFixed(2)}`;

    const [EW, EH] = format().px, px = renderFull().getContext('2d').getImageData(EW - 1, EH - 1, 1, 1).data;
    ok(px[3] === 255 && px[0] === 0x2b, 'Export in voller Größe');
    $('bleed').checked = true;
    const c = renderFull();
    ok(c.width === EW + 70 && c.height === EH + 70 && c.getContext('2d').getImageData(0, 0, 1, 1).data[0] === 0x2b, 'Beschnitt');
    $('bleed').checked = false;
    $('themeLight').checked = true; // heller Hintergrund inkl. Beschnitt, wird mit dem Projekt gespeichert
    const lc = renderFull().getContext('2d').getImageData(0, 0, 1, 1).data;
    ok(lc.join() === '239,231,215,255' && snapshot().themeLight === true && snapshot().themeDark === false, 'heller Hintergrund');
    $('themeDark').checked = true;

    // Album: Titelliste, Laufzeit, MusicBrainz (simuliert), quadratisches, zentriertes Cover in jedem Format
    ok(clock(59) === '0:59' && clock(3725) === '1:02:05' && runtime('A 4:20\nB 1:00:05\nC') === '1:04:25' && runtime('A\nB') === '', 'Laufzeit');
    ok(JSON.stringify(trackList('Come Together 4:20\n\n  Her Majesty  ')) === '[["Come Together","4:20"],["Her Majesty",""]]', 'Titelliste');
    const mbFake = { 'release-groups': [{ id: 'rg1', title: 'Abbey Road', 'first-release-date': '1969-09-26', 'artist-credit': [{ name: 'The Beatles' }] }],
      releases: [{ date: '2019-09-27', 'label-info': [{ label: { name: 'Apple' } }], media: [{ tracks: [{ title: 'Bonus', length: 1000 }] }] },
        { date: '1969', 'label-info': [{ label: { name: 'Odeon' } }], media: [{ tracks: [{ title: 'Andere Pressung' }] }] },
        { date: '1969-09-26', 'label-info': [{ label: { name: '[no label]' } }, { label: { name: 'Apple Records' } }],
          media: [{ tracks: [{ title: 'Come Together', length: 259946 }] }, { tracks: [{ title: 'Her Majesty', recording: { length: 23000 } }] }] }],
      genres: [{ name: 'pop', count: 1 }, { name: 'rock', count: 5 }] };
    const mbUrls = [];
    window.fetch = async url => { mbUrls.push(new URL(url)); return new Response(JSON.stringify(mbFake)); };
    document.body.dataset.mode = 'album';
    try {
      await searchGames('Abbey AC/DC');
      ok($('games').textContent === 'Abbey RoadThe Beatles · 1969', 'MusicBrainz-Suche');
      ok(mbUrls[0].searchParams.get('query') === '+((releasegroup:abbey OR artist:abbey) AND (releasegroup:ac\\/dc OR artist:ac\\/dc)) releasegroup:"abbey ac\\/dc"^8 +(primarytype:album OR primarytype:ep)', 'MusicBrainz-Abfrage');
      mbFake['release-groups'].push({ id: 'rg2', title: 'Thriller', score: 100, count: 1 }, { id: 'rg3', title: 'Thriller', score: 87, count: 87, 'artist-credit': [{ name: 'Michael Jackson' }] },
        { id: 'rg4', title: 'Thriller Live', score: 100, count: 87, 'secondary-types': ['Live'] });
      ok((await albumSearch('thriller')).map(h => h.info).join('|') === 'Michael Jackson|Live||The Beatles · 1969', 'bekannte Alben zuerst, Live danach');
      ok(mbUrls.at(-1).searchParams.get('query').includes('(releasegroup:thriller* OR artist:thriller*)'), 'letztes Wort als Wortanfang');
      // Künstlerzeile: "beatl" passt auf "The Beatles" (genug Veröffentlichungen), Klick zeigt die Diskografie, Studioalben zuerst
      mbFake['release-groups'] = [{ ...mbFake['release-groups'][0], count: 73, 'artist-credit': [{ name: 'The Beatles', artist: { id: 'a1', name: 'The Beatles' } }] },
        { id: 'rg5', title: '1', 'first-release-date': '2000', 'secondary-types': ['Compilation'] }, { id: 'rg6', title: 'Please Please Me', 'first-release-date': '1963' }];
      const beatles = await albumSearch('beatl');
      ok(beatles[0].name === 'The Beatles' && beatles[0].albums && beatles[1].name === 'Abbey Road', 'Künstler in der Suche');
      showHits(beatles);
      $('games').firstElementChild.click();
      for (let i = 0; i < 40 && $('games').children.length !== 3; i++) await new Promise(r => setTimeout(r, 100));
      ok([...$('games').children].map(b => b.firstChild.textContent).join('|') === 'Please Please Me|Abbey Road|1'
        && mbUrls.at(-1).searchParams.get('artist') === 'a1' && mbUrls.at(-1).searchParams.get('type') === 'album|ep', 'Diskografie des Künstlers');
      mbFake['release-groups'].length = 1;
      const a = await albumLoad(mbFake['release-groups'][0]);
      ok(a.fields.title === 'Abbey Road' && a.fields.subtitle === 'The Beatles' && a.fields.company === 'Apple Records' && a.fields.genres === 'Rock\nPop'
        && a.fields.tracks === 'Come Together 4:20\nHer Majesty 0:23' && a.fields.year === '1969' && a.fields.day === 'Sep 26'
        && a.covers[0][1] === 'https://coverartarchive.org/release-group/rg1/front', 'Albumfelder');
      Object.entries(a.fields).forEach(([k, v]) => $(k).value = v);
      $('tracks').value = Array.from({ length: 17 }, (_, i) => `Track number ${i + 1} with a rather long title 3:0${i % 10}`).join('\n');
      for (const size of Object.keys(FORMATS)) {
        $('size').value = size;
        draw(ctx, preview.width / U);
        const vw = state.view;
        ok(!state.crowded && vw.iw === vw.ih && Math.abs(vw.left + vw.iw / 2 - U / 2) < 1e-9, 'Album passt in ' + size);
      }
      $('size').value = '50x70';
      ok(plan(ctx, format(), 1).ih === .8 * CW, 'Album 50 × 70: Cover in voller Größe');
      $('tracks').value = 'Kurz 1:00';
      ok(plan(ctx, format(), 1).fs === 18, 'kurze Titel: volle Schrift');
      $('tracks').value = Array.from({ length: 15 }, (_, i) => (i === 5 ? 'Bittersweet Poetry (feat. John Mayer)' : 'Song') + ' 4:32').join('\n');
      const T = plan(ctx, format(), 1);
      ctx.font = font(400, T.fs);
      ok(T.fs < 18 && T.fs >= 11 && ctx.measureText('Bittersweet Poetry (feat. John Mayer)').width <= T.tracks.cw - 1.78 * T.fs - ctx.measureText('4:32').width - .67 * T.fs + 1e-6,
        'lange Titel: Schrift verkleinert, nichts abgeschnitten (' + T.fs.toFixed(1) + ')');
    } finally { window.fetch = realFetch; document.body.dataset.mode = 'game'; }
    $('games').replaceChildren();
    document.title = 'SELFTEST OK';
  } catch (e) { document.title = 'SELFTEST FAIL: ' + e.message; }
  $('dpi').textContent = document.title;
  navigator.sendBeacon('/selftest', document.title + (window.upscaleInfo ? ' | ' + window.upscaleInfo : ''));
  render(); requestAnimationFrame(() => setTimeout(() => preview.toBlob(b => navigator.sendBeacon('/preview.png', b)), 50));
})();
