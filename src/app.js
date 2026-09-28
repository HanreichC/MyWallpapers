const $ = id => document.getElementById(id);
const U = 1000, UH = 1400, M = 100, R = U - M, CW = U - 2 * M; // Layout in Einheiten: 1000 = 50 cm
const EW = 5906, EH = 8268;                                     // 50 × 70 cm @ 300 dpi
const IMG_TOP = 400; // fester Bildrahmen wie im Beispiel: Titel steht darüber, Beschreibung darunter
const BG = '#2b2b2b', FG = '#efe9dc';
const font = (w, px) => `${w} ${px}px "TeX Gyre Heros", "Helvetica Neue", Helvetica, Arial, sans-serif`;
const fontsReady = Promise.all([400, 700].map(w => document.fonts.load(font(w, 10)))); // Canvas wartet sonst nicht auf Webfonts
const state = { image: null, logo: null, files: {}, dpi: 0, view: null, titleClash: false };

function wrap(ctx, text, maxW) {
  if (!text.trim()) return [];
  const out = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const t = line ? line + ' ' + word : word;
      if (line && ctx.measureText(t).width > maxW) { out.push(line); line = word; } else line = t;
    }
    out.push(line);
  }
  return out;
}

// o: Versatz in Pixeln (Beschnittzugabe), preview: Hinweise zeichnen, die nicht in den Export gehören
function draw(ctx, s, o = 0, preview = false) {
  const v = id => $(id).value;
  ctx.setTransform(s, 0, 0, s, o, o);
  ctx.imageSmoothingQuality = 'high';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, U, UH);

  document.querySelectorAll('.swatches input').forEach((c, i) => {
    ctx.fillStyle = c.value;
    ctx.fillRect(M + i * 34, 84, 34.5, 8.5);
  });

  // Meta rechts oben: "Label /" vor der ersten Zeile, Werte rechtsbündig
  ctx.fillStyle = FG;
  ctx.textAlign = 'right';
  let y = 92, metaLeft = R, metaBottom = 0;
  for (const [label, text] of [['Company', v('company')], ['Genres', v('genres')]]) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    ctx.font = font(400, 11.3);
    const widths = lines.map(l => ctx.measureText(l).width);
    lines.forEach((l, i) => ctx.fillText(l, R, y + i * 12.8));
    ctx.font = font(700, 11.3);
    ctx.fillText(label + ' /', R - widths[0] - 7, y);
    metaLeft = Math.min(metaLeft, R - widths[0] - 7 - ctx.measureText(label + ' /').width, R - Math.max(...widths));
    metaBottom = y + (lines.length - 1) * 12.8 + 3;
    y = metaBottom - 3 + 27;
  }

  // Titel + Untertitel, rechts Platz fürs Logo lassen
  const logo = state.logo;
  const ls = logo ? Math.min(110 / logo.width, 28 / logo.height) : 0;
  const tw = CW - (logo ? logo.width * ls + 20 : 0);
  ctx.textAlign = 'left';
  // Größen, Zeilenabstände und Laufweite am Star-Wars-Beispiel gemessen; Helvetica Neue läuft ~3 % enger als Heros
  const titleLines = []; // [Schriftgröße, Text, Abstand zur vorigen Grundlinie]
  for (const [px, text] of [[85, v('title')], [50, v('subtitle')]]) {
    ctx.font = font(700, px);
    ctx.letterSpacing = -.028 * px + 'px';
    wrap(ctx, text, tw).forEach((line, i) => titleLines.push([px, line, px + (i ? 0 : 2)]));
  }
  y = IMG_TOP - 23; // letzte Grundlinie sitzt auf dem Bild, weitere Zeilen wachsen nach oben
  const clashes = []; // Titelzeilen, die in Farbbalken oder Meta-Block ragen
  for (const [px, line, adv] of titleLines.reverse()) {
    ctx.font = font(700, px);
    ctx.letterSpacing = -.028 * px + 'px';
    ctx.fillText(line, M, y);
    const top = y - px * .72, w = ctx.measureText(line).width;
    if (top < 95 || (M + w > metaLeft - 8 && top < metaBottom + 8)) clashes.push([M - 4, top - 4, w + 8, px * .72 + 8]);
    y -= adv;
  }
  ctx.letterSpacing = '0px';
  state.titleClash = clashes.length > 0;
  if (preview) {
    ctx.strokeStyle = '#ff3b30';
    ctx.lineWidth = 2;
    clashes.forEach(r => ctx.strokeRect(...r));
  }
  if (logo) ctx.drawImage(logo, R - logo.width * ls, IMG_TOP - 13 - logo.height * ls, logo.width * ls, logo.height * ls);

  // Unten: Beschreibung links, "/Jahr Datum" rechts, beides an der Grundlinie UH - M
  const bottom = UH - M, year = v('year'), day = v('day');
  ctx.font = font(400, 14);
  const dayW = ctx.measureText(day).width;
  ctx.textAlign = 'right';
  ctx.fillText(day, R, bottom);
  ctx.font = font(700, 45);
  ctx.letterSpacing = '-2.8px'; // Heros-Ziffern sind breiter als die von Helvetica Neue
  const slashX = R - Math.max(ctx.measureText(year).width, dayW) - 17;
  ctx.fillText(year, R, bottom - 13);
  ctx.letterSpacing = '0px';
  if (year || day) {
    ctx.strokeStyle = FG;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(slashX, bottom); ctx.lineTo(slashX + 11.4, bottom - 45.6); ctx.stroke();
  }
  ctx.font = font(400, 11);
  ctx.textAlign = 'left';
  const lines = wrap(ctx, v('desc'), (year || day ? slashX - 20 : R) - M);
  const blockTop = bottom - Math.max(45.6, 7.9 + (lines.length - 1) * 12.5); // oben bündig mit dem Jahr
  lines.forEach((l, i) => ctx.fillText(l, M, blockTop + 7.9 + i * 12.5));

  // Bild im festen Rahmen; nur sehr lange Beschreibungen kürzen ihn unten.
  // Zoom 1 = füllt den Rahmen, < 1 = kleiner als der Rahmen (Rest schwarz), > 1 = hineingezoomt.
  // cropX/cropY (0…1) positionieren das Bild im Spielraum (CW - Bildbreite), egal ob es übersteht oder Luft hat
  const imgTop = IMG_TOP, ih = blockTop - 24 - imgTop;
  ctx.fillStyle = '#000';
  ctx.fillRect(M, imgTop, CW, ih);
  const img = state.image;
  state.view = null;
  if (img && ih > 0) {
    const k = Math.max(CW / img.width, ih / img.height) * v('zoom'), dw = img.width * k, dh = img.height * k;
    const slackX = CW - dw, slackY = ih - dh;
    ctx.save();
    ctx.beginPath(); ctx.rect(M, imgTop, CW, ih); ctx.clip();
    ctx.drawImage(img, M + slackX * v('cropX'), imgTop + slackY * v('cropY'), dw, dh);
    ctx.restore();
    state.dpi = img.width / (dw * 50 / U / 2.54); // Quellpixel pro Zoll im Druck
    state.view = { top: imgTop, ih, slackX, slackY };
  } else if (preview) {
    ctx.fillStyle = 'rgba(239, 233, 220, .5)';
    ctx.font = font(400, 16);
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
    const cssW = Math.max(50, Math.min(w, h * U / UH)), dpr = devicePixelRatio || 1;
    preview.style.width = cssW + 'px';
    preview.style.height = cssW * UH / U + 'px';
    preview.width = Math.round(cssW * dpr);
    preview.height = Math.round(cssW * UH / U * dpr);
    draw(preview.getContext('2d'), preview.width / U, 0, true);
    $('titleWarn').textContent = state.titleClash ? 'Der Titel ragt in die Angaben oben rechts. Kürzen oder Zeilen umbrechen.' : '';
    const [w2, h2] = exportSize(), jpg = $('format').value === 'jpeg';
    $('export').textContent = `Als ${jpg ? 'JPG' : 'PNG'} exportieren`;
    $('exportInfo').textContent = `${w2} × ${h2} px` + ($('bleed').checked ? ' (50,6 × 70,6 cm inkl. Beschnitt)' : '');
    if (!SELFTEST) try { localStorage.setItem('poster', JSON.stringify(snapshot())); } catch {}
    if (!upscaling) {
      const need = state.image ? Math.min(4, 300 / state.dpi) : 0;
      $('upscale').disabled = need <= 1.05;
      $('upscaleInfo').textContent = !state.image ? '' : need <= 1.05 ? 'Auflösung reicht bereits' : `≈ ${Math.round(state.dpi)} → ${Math.round(state.dpi * need)} dpi`;
    }
    const dpiEl = $('dpi');
    dpiEl.textContent = state.image ? `Bildauflösung im Druck: ≈ ${Math.round(state.dpi)} dpi` + (state.dpi < 150 ? ' – unscharf, mind. 150 dpi empfohlen' : '') : '';
    dpiEl.classList.toggle('warn', !!state.image && state.dpi < 150);
  });
}
document.addEventListener('input', e => {
  if (e.target.id === 'title') $('website').value = ''; // Titel von Hand geändert → Website gehört evtl. zu einem anderen Spiel
  if (e.target.id !== 'apiKey') render();
});

// Speichern: Felder in localStorage, Bilder in IndexedDB (localStorage ist dafür zu klein), Projekte als Datei
const SELFTEST = location.hash === '#selftest'; // Selbsttest darf gespeicherte Arbeit nicht überschreiben
const saved = () => document.querySelectorAll('#form input[id]:not([type=file]):not(#game), #form textarea, #bleed, #format');
const snapshot = () => Object.fromEntries([...saved()].map(el => [el.id, el.type === 'checkbox' ? el.checked : el.value]));
function restore(data) {
  for (const el of saved()) if (data && el.id in data) el[el.type === 'checkbox' ? 'checked' : 'value'] = data[el.id];
}
function idb(mode, op) {
  return new Promise((ok, fail) => {
    const r = indexedDB.open('poster', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files');
    r.onerror = () => fail(r.error);
    r.onsuccess = () => { const q = op(r.result.transaction('files', mode).objectStore('files')); q.onsuccess = () => ok(q.result); q.onerror = () => fail(q.error); };
  });
}
const storeFile = (key, file) => SELFTEST || idb('readwrite', st => file ? st.put(file, key) : st.delete(key)).catch(() => {});
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
  download(new Blob([JSON.stringify({ poster: 1, fields: snapshot(), files })], { type: 'application/json' }), fileName() + '.poster.json');
};
async function openProject(p) {
  if (p?.poster !== 1 || typeof p.fields !== 'object') throw new Error('kein Poster-Projekt');
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
  try { await openProject(JSON.parse(await f.text())); }
  catch { alert('Die Datei ist kein gültiges Poster-Projekt.'); }
};

// Ausschnitt: in der Vorschau ziehen, Mausrad zoomt, Pfeiltasten verschieben
const toUnits = e => { const r = preview.getBoundingClientRect(); return [(e.clientX - r.left) * U / r.width, (e.clientY - r.top) * U / r.width]; };
const onImage = e => { const [x, y] = toUnits(e), vw = state.view; return !!vw && x >= M && x <= R && y >= vw.top && y <= vw.top + vw.ih; };
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

// RAWG: Spiel suchen, Felder füllen
const rawgKey = () => { try { return localStorage.getItem('rawgKey') || ''; } catch { return ''; } };
async function rawg(path, params = {}) {
  const r = await fetch(`https://api.rawg.io/api/${path}?` + new URLSearchParams({ key: rawgKey(), ...params }));
  if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? 'API-Key ungültig.' : `RAWG-Fehler ${r.status}.`);
  return r.json();
}
function fromRawg(g) {
  const [title, ...rest] = g.name.split(': ');
  const para = (g.description_raw || '').split(/\n+/)[0].trim();
  const d = g.released && new Date(g.released);
  return {
    title: rest.length ? title + ':' : title,
    subtitle: rest.join(': ').replace(/ - /g, '\n'),
    company: g.developers?.[0]?.name ?? '',
    genres: (g.genres || []).map(x => x.name).join('\n'),
    desc: para.length > 500 ? para.slice(0, para.lastIndexOf('. ', 499) + 1) || para.slice(0, 500) : para, // am Satzende kürzen
    year: d ? String(d.getUTCFullYear()) : '',
    day: d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '',
    website: g.website || '', // offizielle Seite, dort liegt meist das Presskit
  };
}
const gameStatus = t => $('gameStatus').textContent = t ?? '';
const errText = e => e instanceof TypeError ? 'Keine Verbindung zur Spieldatenbank. Internet prüfen.' : e.message;
const rawgGame = id => async () => {
  const [g, stores] = await Promise.all([rawg(`games/${id}`), rawg(`games/${id}/stores`).catch(() => ({ results: [] }))]);
  return { fields: fromRawg(g), image: g.background_image, appId: steamAppId(stores.results || []) };
};
async function rawgSearch(q) {
  const { results } = await rawg('games', { search: q, page_size: 10 });
  return results.map(g => ({ name: g.name, year: g.released?.slice(0, 4), info: (g.platforms || []).slice(0, 3).map(p => p.platform?.name).join(', '),
    source: 'RAWG', load: rawgGame(g.id) }));
}

// Wikidata + Wikipedia: frei, ohne Key, sehr vollständig bei bekannten Spielen, kennt auch Abkürzungen wie "kotor"
async function wd(params) {
  const r = await fetch('https://www.wikidata.org/w/api.php?' + new URLSearchParams({ format: 'json', origin: '*', ...params }));
  if (!r.ok) throw new Error(`Wikidata-Fehler ${r.status}.`);
  return r.json();
}
const claims = (e, p) => (e?.claims?.[p] || []).map(c => c.mainsnak?.datavalue?.value).filter(Boolean);
const wdLabel = e => (e?.labels?.en || e?.labels?.mul || e?.labels?.de)?.value || '';
const wdDate = e => claims(e, 'P577').filter(t => t.precision >= 9) // früheste Angabe mit der genauesten Präzision
  .sort((a, b) => b.precision - a.precision || a.time.localeCompare(b.time))[0];
const genreName = s => s.replace(/ (video )?games?$/i, '').replace(/(^|[\s-])\S/g, c => c.toUpperCase()); // "racing video game" → "Racing"
async function wikidataSearch(q) {
  const ids = (await wd({ action: 'query', list: 'search', srsearch: q + ' haswbstatement:P31=Q7889', srlimit: 8 })).query.search.map(r => r.title);
  if (!ids.length) return [];
  const { entities } = await wd({ action: 'wbgetentities', ids: ids.join('|'), props: 'labels|claims|sitelinks', languages: 'en|mul|de' });
  return ids.map(id => entities[id]).filter(wdLabel)
    .map(e => ({ name: wdLabel(e), year: wdDate(e)?.time.slice(1, 5), source: 'Wikidata', load: () => wikidataGame(e) }));
}
async function wikidataGame(e) {
  const dev = claims(e, 'P178')[0]?.id, genres = claims(e, 'P136').map(v => v.id).slice(0, 6);
  const ids = [dev, ...genres].filter(Boolean);
  const names = ids.length ? (await wd({ action: 'wbgetentities', ids: ids.join('|'), props: 'labels', languages: 'en|mul|de' })).entities : {};
  const [lang, page] = e.sitelinks?.enwiki ? ['en', e.sitelinks.enwiki.title] : e.sitelinks?.dewiki ? ['de', e.sitelinks.dewiki.title] : [];
  const summary = page ? await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page)}`)
    .then(r => r.ok ? r.json() : {}, () => ({})) : {};
  const date = wdDate(e);
  const fields = fromRawg({
    name: wdLabel(e),
    released: date?.precision >= 11 ? date.time.slice(1, 11) : undefined,
    developers: dev ? [{ name: wdLabel(names[dev]) }] : [],
    genres: [...new Set(genres.map(id => genreName(wdLabel(names[id]))).filter(Boolean))].map(name => ({ name })),
    description_raw: summary.extract,
    website: claims(e, 'P856')[0],
  });
  if (!fields.year && date) fields.year = date.time.slice(1, 5);
  return { fields, appId: claims(e, 'P1733')[0] };
}

async function applyGame(load) {
  gameStatus('Wird geladen…');
  try {
    const { fields, image, appId } = await load();
    Object.entries(fields).forEach(([k, v]) => $(k).value = v);
    await Promise.all([
      autoImage('image', 'RAWG-Bild.jpg', image), // nur Platzhalter, zu klein für den Druck
      autoImage('logo', 'Steam-Logo.png', appId && `https://shared.steamstatic.com/store_item_assets/steam/apps/${appId}/logo.png`),
    ]);
    gameStatus();
    render();
  } catch (err) { gameStatus(errText(err)); }
}
const steamAppId = stores => stores.map(s => s.url?.match(/store\.steampowered\.com\/app\/(\d+)/)?.[1]).find(Boolean);
// Automatisch geladene Bilder ersetzen sich beim nächsten Spiel, eigene Uploads bleiben
async function autoImage(key, name, url) {
  if (state[key] && $(key + 'Name').textContent !== name) return;
  clearImage(key);
  const missing = () => { if (key === 'logo') $(key + 'Name').textContent = 'Kein Steam-Logo gefunden'; };
  if (!url) return missing();
  try {
    const r = await fetch(url);
    if (!r.ok) return missing();
    const b = await r.blob();
    await loadImage(new File([b], name, { type: b.type }), key);
  } catch {}
}
// Bildquellen: öffnen die jeweilige Suche mit dem Spielnamen (ohne Key)
const SEARCH = {
  presskit: q => {
    let host = '';
    try { host = new URL($('website').value).hostname.replace(/^www\./, ''); } catch {}
    return 'https://www.google.com/search?' + new URLSearchParams({ q: host ? `site:${host} (press OR presskit OR media)` : `"${q}" press kit key art` });
  },
  alphacoders: q => 'https://wall.alphacoders.com/search.php?' + new URLSearchParams({ search: q }),
  google: q => 'https://www.google.com/search?' + new URLSearchParams({ q: q + ' key art', tbm: 'isch', tbs: 'isz:l' }),
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
  const results = await Promise.allSettled([wikidataSearch(q), rawgKey() ? rawgSearch(q) : []]);
  if (seq !== searchSeq) return; // Antwort auf eine ältere Eingabe
  const seen = new Set(), hits = [];
  for (const h of results.flatMap(r => r.value || [])) { // gleiches Spiel aus beiden Quellen nur einmal, Wikidata zuerst
    const key = h.name.toLowerCase().replace(/[^a-z0-9]/g, '') + h.year;
    if (!seen.has(key)) { seen.add(key); hits.push(h); }
  }
  $('games').replaceChildren(...hits.map(h => {
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'result' });
    b.append(h.name, Object.assign(document.createElement('span'), { textContent: [h.year, h.info, h.source].filter(Boolean).join(' · ') }));
    b.onclick = () => { $('game').value = h.name; $('games').replaceChildren(); applyGame(h.load); };
    return b;
  }));
  const failed = results.find(r => r.status === 'rejected')?.reason;
  gameStatus(hits.length ? failed && `Nicht alle Quellen erreichbar: ${errText(failed)}`
    : failed ? errText(failed) : 'Kein Spiel gefunden. Englischen Originaltitel versuchen.');
}
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
$('openSettings').onclick = () => {
  $('apiKey').value = rawgKey();
  $('keyStatus').textContent = 'Wird nur in diesem Browser gespeichert.';
  $('settings').showModal();
};
$('settingsForm').onsubmit = async e => {
  e.preventDefault();
  const key = $('apiKey').value.trim();
  $('keyStatus').textContent = 'Wird geprüft…';
  try {
    if (key) await rawg('games', { key, page_size: 1 });
    try { localStorage.setItem('rawgKey', key); } catch { throw new Error('Speichern im Browser nicht möglich (privates Fenster?).'); }
    gameStatus();
    $('settings').close();
  } catch (err) {
    $('keyStatus').textContent = err instanceof TypeError ? 'RAWG nicht erreichbar. Internetverbindung prüfen.' : err.message;
  }
};
gameStatus();

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
  let targetW = img.width * Math.min(4, 300 / state.dpi) * 1.02;
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

const BLEED = Math.round(3 / 25.4 * 300); // 3 mm @ 300 dpi
const exportSize = () => { const b = $('bleed').checked ? 2 * BLEED : 0; return [EW + b, EH + b]; };
function renderFull() {
  const c = document.createElement('canvas'), ctx = c.getContext('2d');
  [c.width, c.height] = exportSize();
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, c.width, c.height); // Beschnittzugabe in Hintergrundfarbe
  draw(ctx, EW / U, (c.width - EW) / 2);
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
    download(await withDpi(blob, 300), fileName() + (type === 'image/jpeg' ? '.jpg' : '.png'));
  } catch (err) {
    alert('Export fehlgeschlagen: ' + err.message);
  } finally {
    b.disabled = false; b.textContent = label;
  }
};

// Start: Schrift laden, letzte Sitzung wiederherstellen, dann zeichnen
fontsReady.finally(async () => {
  if (!SELFTEST) {
    try { restore(JSON.parse(localStorage.getItem('poster'))); } catch {}
    for (const k of ['image', 'logo']) {
      const f = await idb('readonly', st => st.get(k)).catch(() => null);
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
    const f = fromRawg({ name: 'Star Wars: Knights of the Old Republic II - The Sith Lords', released: '2004-12-06',
      developers: [{ name: 'Obsidian Entertainment' }], genres: [{ name: 'Action' }, { name: 'RPG' }], description_raw: 'Aa bb. '.repeat(100) + '\nZweiter Absatz' });
    ok(f.title === 'Star Wars:' && f.subtitle === 'Knights of the Old Republic II\nThe Sith Lords' && f.company === 'Obsidian Entertainment'
      && f.genres === 'Action\nRPG' && f.year === '2004' && f.day === 'Dec 6' && f.desc.length <= 500 && f.desc.endsWith('.'), 'fromRawg');
    const h = fromRawg({ name: 'Hollow Knight' });
    ok(h.title === 'Hollow Knight' && h.subtitle === '' && h.year === '' && h.desc === '', 'fromRawg minimal');
    // Wikidata/Wikipedia simulieren: Treffer muss trotz Doppelpunkt erscheinen und alle Felder füllen
    const realFetch = window.fetch, v = value => ({ mainsnak: { datavalue: { value } } });
    const fake = {
      Q1: { id: 'Q1', labels: { en: { value: 'Need for Speed: Most Wanted' } }, sitelinks: { enwiki: { title: 'Need for Speed: Most Wanted (2012 video game)' } },
        claims: { P577: [v({ time: '+2012-00-00T00:00:00Z', precision: 9 }), v({ time: '+2012-10-30T00:00:00Z', precision: 11 })], P178: [v({ id: 'Q2' })],
          P136: [v({ id: 'Q3' }), v({ id: 'Q4' })], P856: [v('https://www.ea.com/nfs')], P1733: [v('1262560')] } },
      Q2: { labels: { mul: { value: 'Criterion Games' } } }, Q3: { labels: { en: { value: 'racing video game' } } }, Q4: { labels: { en: { value: 'open world' } } },
    };
    window.fetch = async url => {
      const u = new URL(url), json = o => new Response(JSON.stringify(o));
      if (u.hostname.endsWith('wikipedia.org')) return json({ extract: 'Need for Speed: Most Wanted is a 2012 racing game.\nZweiter Absatz.' });
      if (u.searchParams.get('list') === 'search') return json({ query: { search: [{ title: 'Q1' }] } });
      return json({ entities: Object.fromEntries(u.searchParams.get('ids').split('|').map(id => [id, fake[id]])) });
    };
    try {
      await searchGames('need for speed most wanted');
      ok($('games').children.length === 1 && $('games').textContent === 'Need for Speed: Most Wanted2012 · Wikidata', 'Wikidata-Suche');
      const w = await wikidataGame(fake.Q1);
      ok(w.fields.title === 'Need for Speed:' && w.fields.subtitle === 'Most Wanted' && w.fields.company === 'Criterion Games'
        && w.fields.genres === 'Racing\nOpen World' && w.fields.year === '2012' && w.fields.day === 'Oct 30'
        && w.fields.desc === 'Need for Speed: Most Wanted is a 2012 racing game.' && w.fields.website === 'https://www.ea.com/nfs' && w.appId === '1262560', 'Wikidata-Felder');
    } finally { window.fetch = realFetch; }
    $('games').replaceChildren();
    ok(fromRawg({ name: 'X', website: 'https://www.teamcherry.com.au/' }).website === 'https://www.teamcherry.com.au/', 'fromRawg website');
    $('website').value = 'https://www.teamcherry.com.au/';
    ok(decodeURIComponent(SEARCH.presskit('Hollow Knight')).includes('site:teamcherry.com.au'), 'Presskit auf offizieller Seite');
    $('website').value = 'kein link';
    ok(decodeURIComponent(SEARCH.presskit('Hollow Knight').replace(/\+/g, ' ')).includes('"Hollow Knight" press kit'), 'Presskit ohne Website');
    ok(steamAppId([{ url: 'https://www.gog.com/game/x' }, { url: 'https://store.steampowered.com/app/367520/Hollow_Knight/' }]) === '367520'
      && steamAppId([{ url: '' }]) === undefined, 'steamAppId');
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

    // Titel-Kollision
    draw(ctx, preview.width / U);
    ok(!state.titleClash, 'keine Kollision im Beispiel');
    const t = $('title').value;
    $('title').value = 'Wwwwwwwwwwww Wwwwwwwwwwwww Wwwwwwwwwwww';
    draw(ctx, preview.width / U);
    ok(state.titleClash, 'Kollision erkannt');
    $('title').value = t;

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

    const px = renderFull().getContext('2d').getImageData(EW - 1, EH - 1, 1, 1).data;
    ok(px[3] === 255 && px[0] === 0x2b, 'Export in voller Größe');
    $('bleed').checked = true;
    const c = renderFull();
    ok(c.width === EW + 70 && c.height === EH + 70 && c.getContext('2d').getImageData(0, 0, 1, 1).data[0] === 0x2b, 'Beschnitt');
    $('bleed').checked = false;
    document.title = 'SELFTEST OK';
  } catch (e) { document.title = 'SELFTEST FAIL: ' + e.message; }
  $('dpi').textContent = document.title;
  navigator.sendBeacon('/selftest', document.title + (window.upscaleInfo ? ' | ' + window.upscaleInfo : ''));
  render(); requestAnimationFrame(() => setTimeout(() => preview.toBlob(b => navigator.sendBeacon('/preview.png', b)), 50));
})();
