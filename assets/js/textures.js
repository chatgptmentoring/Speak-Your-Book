/*
 * Procedural textures for the fair: everything is drawn on canvas at load time,
 * so the only image downloads are the book covers.
 */
import * as THREE from 'three';

const SERIF = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
const SANS = 'Manrope, "Helvetica Neue", Arial, sans-serif';
const GOLD = '#e2bd78';
const GOLD_HI = '#f7e1b0';

let maxAniso = 8;
export function setAnisotropy(n) { maxAniso = n; }

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function toTexture(c, { srgb = true, repeat = null } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

export async function loadFonts() {
  if (!document.fonts || !document.fonts.load) return;
  const specs = [
    '500 64px "Cormorant Garamond"', '600 64px "Cormorant Garamond"',
    'italic 500 64px "Cormorant Garamond"', '600 32px Manrope', '700 32px Manrope'
  ];
  try {
    await Promise.race([
      Promise.all(specs.map((s) => document.fonts.load(s))),
      new Promise((r) => setTimeout(r, 3000))
    ]);
  } catch (e) { /* fall back to system fonts */ }
}

/* ---------- text helpers ---------- */
function spaced(ctx, text, x, y, spacing, align = 'center') {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const prev = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((c, i) => { ctx.fillText(c, cx, y); cx += widths[i] + spacing; });
  ctx.textAlign = prev;
  return total;
}

function wrap(ctx, text, maxW) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  words.forEach((w) => {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  });
  if (line) lines.push(line);
  return lines;
}

function fit(ctx, text, { family, weight = 600, style = '', max, min, maxW, maxLines }) {
  for (let s = max; s >= min; s -= 2) {
    ctx.font = `${style} ${weight} ${s}px ${family}`;
    const lines = wrap(ctx, text, maxW);
    if (lines.length <= maxLines) return { size: s, lines };
  }
  ctx.font = `${style} ${weight} ${min}px ${family}`;
  return { size: min, lines: wrap(ctx, text, maxW).slice(0, maxLines) };
}

function goldGradient(ctx, x0, y0, x1, y1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, GOLD_HI);
  g.addColorStop(0.5, GOLD);
  g.addColorStop(1, '#c98f45');
  return g;
}

function ornament(ctx, x, y, w, color = GOLD) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1, w * 0.012);
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x - w * 0.08, y);
  ctx.moveTo(x + w * 0.08, y);
  ctx.lineTo(x + w / 2, y);
  ctx.stroke();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  const s = w * 0.035;
  ctx.fillRect(-s, -s, s * 2, s * 2);
  ctx.restore();
}

/* Draw an image to fill a box (like CSS object-fit: cover). */
function drawCover(ctx, img, w, h) {
  const r = Math.max(w / img.width, h / img.height);
  const iw = img.width * r, ih = img.height * r;
  ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
}

/* ---------- noise ---------- */
function makeNoise(seed) {
  const P = 256;
  const perm = new Uint8Array(P * 2);
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const base = Array.from({ length: P }, (_, i) => i);
  for (let i = P - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [base[i], base[j]] = [base[j], base[i]]; }
  for (let i = 0; i < P * 2; i++) perm[i] = base[i % P];
  const val = new Float32Array(P);
  for (let i = 0; i < P; i++) val[i] = rnd();
  /* tileable value noise: per = period in cells */
  return function noise(x, y, per) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const g = (a, b) => val[perm[(((a % per) + per) % per) + perm[(((b % per) + per) % per)]]];
    const a = g(xi, yi), b = g(xi + 1, yi), c = g(xi, yi + 1), d = g(xi + 1, yi + 1);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  };
}

export function marbleTexture({ size = 512, base = [238, 230, 216], vein = [150, 128, 104], veinGold = null, seed = 3, scale = 4, contrast = 1 } = {}) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const noise = makeNoise(seed);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = (px / size) * scale, y = (py / size) * scale;
      let f = 0, amp = 0.5, fr = 1;
      for (let o = 0; o < 5; o++) { f += amp * noise(x * fr, y * fr, scale * fr); fr *= 2; amp *= 0.5; }
      const t = Math.abs(Math.sin((px / size) * 3 * Math.PI + (py / size) * 2 * Math.PI + f * 7.0));
      const veinAmt = Math.pow(1 - Math.min(1, t * 3.2), 3) * contrast;
      const cloud = (f - 0.5) * 26;
      let r = base[0] + cloud, g = base[1] + cloud, b = base[2] + cloud;
      const vc = veinGold && f > 0.52 ? veinGold : vein;
      r += (vc[0] - r) * veinAmt;
      g += (vc[1] - g) * veinAmt;
      b += (vc[2] - b) * veinAmt;
      const i = (py * size + px) * 4;
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/* ---------- simple gradients ---------- */
export function radialTexture(stops = [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']], size = 256) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return toTexture(c, { srgb: false });
}

/* ---------- carpet runner ---------- */
export function carpetTexture() {
  const W = 512, H = 512;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, '#3a0d1f');
  g.addColorStop(0.5, '#5a1730');
  g.addColorStop(1, '#3a0d1f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // damask motif
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#e2bd78';
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      const x = W * (0.32 + col * 0.36), y = H * (0.25 + row * 0.5) + (col ? H * 0.25 : 0);
      ctx.save();
      ctx.translate(x, y % H);
      for (let k = 0; k < 4; k++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.ellipse(0, -26, 9, 24, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
  // borders
  const border = (x) => {
    ctx.fillStyle = '#c9a35a';
    ctx.fillRect(x, 0, 10, H);
    ctx.fillStyle = '#2a0814';
    ctx.fillRect(x + (x < W / 2 ? 14 : -10), 0, 6, H);
    ctx.fillStyle = 'rgba(226,189,120,.6)';
    ctx.fillRect(x + (x < W / 2 ? 24 : -18), 0, 3, H);
  };
  border(26);
  border(W - 36);
  // fibre noise
  const img = ctx.getImageData(0, 0, W, H);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 18;
    img.data[i] += n; img.data[i + 1] += n * 0.6; img.data[i + 2] += n * 0.7;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/* ---------- book pieces ---------- */
export function pagesTexture(vertical) {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f1e8d8';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i += 2) {
    const shade = 200 + Math.random() * 40;
    ctx.fillStyle = `rgba(${shade - 30},${shade - 40},${shade - 60},${0.25 + Math.random() * 0.3})`;
    if (vertical) ctx.fillRect(i, 0, 1, 256); else ctx.fillRect(0, i, 256, 1);
  }
  return toTexture(c);
}

export function spineTexture(book, h = 1600) {
  const W = 128, H = h;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = book.colors.spine;
  ctx.fillRect(0, 0, W, H);
  const sh = ctx.createLinearGradient(0, 0, W, 0);
  sh.addColorStop(0, 'rgba(0,0,0,.35)');
  sh.addColorStop(0.35, 'rgba(255,255,255,.12)');
  sh.addColorStop(1, 'rgba(0,0,0,.3)');
  ctx.fillStyle = sh;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = book.colors.spineText;
  ctx.globalAlpha = 0.7;
  [40, 52, H - 56, H - 44].forEach((y) => ctx.fillRect(10, y, W - 20, 4));
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const { size } = fit(ctx, book.title, { family: SERIF, weight: 600, max: 64, min: 30, maxW: H * 0.66, maxLines: 1 });
  ctx.font = `600 ${size}px ${SERIF}`;
  ctx.fillText(book.title, -H * 0.06, 0);
  ctx.font = `700 26px ${SANS}`;
  spaced(ctx, book.author.split(' ').slice(-1)[0].toUpperCase(), H * 0.36, 0, 6);
  ctx.restore();
  return toTexture(c);
}

export function insidePageTexture(book) {
  const W = 640, H = Math.round(640 * book.cover.h / book.cover.w);
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(W * 0.65, H * 0.3, 10, W * 0.5, H * 0.5, H * 0.8);
  g.addColorStop(0, '#fffaf0');
  g.addColorStop(1, '#efe3cc');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const gut = ctx.createLinearGradient(0, 0, W * 0.16, 0);
  gut.addColorStop(0, 'rgba(60,40,20,.22)');
  gut.addColorStop(1, 'rgba(60,40,20,0)');
  ctx.fillStyle = gut;
  ctx.fillRect(0, 0, W * 0.16, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#9a6b26';
  ctx.font = `700 ${W * 0.03}px ${SANS}`;
  spaced(ctx, 'FROM THE BOOTH OF', W * 0.53, H * 0.2, W * 0.012);
  ctx.fillStyle = '#2a2030';
  ctx.font = `italic 500 ${W * 0.085}px ${SERIF}`;
  ctx.fillText(book.displayAuthor || book.author, W * 0.53, H * 0.29);
  ornament(ctx, W * 0.53, H * 0.35, W * 0.4, '#b98a3e');
  const r = fit(ctx, book.hook, { family: SERIF, weight: 500, max: Math.round(W * 0.075), min: Math.round(W * 0.05), maxW: W * 0.66, maxLines: 6 });
  ctx.fillStyle = '#2a2030';
  r.lines.forEach((l, i) => ctx.fillText(l, W * 0.53, H * 0.46 + i * r.size * 1.25));
  ctx.fillStyle = '#8b7a6c';
  ctx.font = `600 ${W * 0.024}px ${SANS}`;
  spaced(ctx, 'LIFE COACH CODE  ·  VIRTUAL BOOK FAIR', W * 0.53, H * 0.92, W * 0.006);
  return toTexture(c);
}

export function endpaperTexture(book) {
  const W = 640, H = Math.round(640 * book.cover.h / book.cover.w);
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ece1cc';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = book.colors.spine;
  ctx.globalAlpha = 0.22;
  for (let y = 0; y < H; y += 28) {
    for (let x = (y / 28) % 2 ? 14 : 0; x < W; x += 28) {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  const pw = W * 0.6, ph = H * 0.3, px = (W - pw) / 2, py = (H - ph) / 2;
  ctx.fillStyle = '#fbf6ec';
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#c9a46a';
  ctx.lineWidth = 3;
  ctx.strokeRect(px + 10, py + 10, pw - 20, ph - 20);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#9a6b26';
  ctx.font = `700 ${W * 0.03}px ${SANS}`;
  spaced(ctx, 'EX LIBRIS', W / 2, py + ph * 0.3, 8);
  ctx.fillStyle = '#2a2030';
  ctx.font = `italic 500 ${W * 0.07}px ${SERIF}`;
  ctx.fillText('Virtual Book Fair', W / 2, py + ph * 0.6);
  ctx.fillStyle = '#5a4630';
  ctx.font = `600 ${W * 0.026}px ${SANS}`;
  spaced(ctx, 'LIFE COACH CODE', W / 2, py + ph * 0.82, 5);
  return toTexture(c);
}

/* ---------- booth signage ---------- */
export function posterTexture(img, book, index, total, width = 640) {
  const W = width, H = Math.round(width * 1.35);
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  // soft, blurred cover art (downscale then upscale = blur that works everywhere)
  const tiny = makeCanvas(18, 24);
  drawCover(tiny.getContext('2d'), img, 18, 24);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(tiny, -W * 0.15, -H * 0.15, W * 1.3, H * 1.3);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(12,7,16,.78)');
  g.addColorStop(0.45, 'rgba(12,7,16,.55)');
  g.addColorStop(1, 'rgba(12,7,16,.8)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(226,189,120,.75)';
  ctx.lineWidth = Math.max(2, W * 0.004);
  ctx.strokeRect(W * 0.04, W * 0.04, W - W * 0.08, H - W * 0.08);
  ctx.strokeStyle = 'rgba(226,189,120,.3)';
  ctx.strokeRect(W * 0.055, W * 0.055, W - W * 0.11, H - W * 0.11);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = GOLD;
  ctx.font = `700 ${Math.round(W * 0.027)}px ${SANS}`;
  spaced(ctx, `BOOTH ${String(index + 1).padStart(2, '0')}  ·  OF ${String(total).padStart(2, '0')}`, W / 2, H * 0.1, W * 0.01);

  const t = fit(ctx, book.title, { family: SERIF, weight: 600, max: Math.round(W * 0.115), min: Math.round(W * 0.06), maxW: W * 0.8, maxLines: 3 });
  ctx.fillStyle = '#fbf3e4';
  let y = H * 0.1 + t.size * 1.25;
  t.lines.forEach((l) => { ctx.fillText(l, W / 2, y); y += t.size * 1.02; });
  ornament(ctx, W / 2, y + t.size * 0.05, W * 0.42);
  ctx.fillStyle = goldGradient(ctx, 0, y, 0, y + 60);
  ctx.font = `italic 500 ${Math.round(W * 0.055)}px ${SERIF}`;
  ctx.fillText('by ' + (book.displayAuthor || book.author), W / 2, y + t.size * 0.62);

  ctx.fillStyle = 'rgba(242,234,221,.72)';
  ctx.font = `700 ${Math.round(W * 0.02)}px ${SANS}`;
  spaced(ctx, 'LIFE COACH CODE  ·  VIRTUAL BOOK FAIR', W / 2, H * 0.95, W * 0.006);

  if (book.status === 'coming-soon') {
    ctx.save();
    ctx.translate(W * 0.84, W * 0.16);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#b3283c';
    ctx.fillRect(-W * 0.4, -W * 0.045, W * 0.8, W * 0.09);
    ctx.fillStyle = '#fff1df';
    ctx.font = `700 ${Math.round(W * 0.03)}px ${SANS}`;
    ctx.textBaseline = 'middle';
    spaced(ctx, 'COMING SOON', 0, 0, W * 0.008);
    ctx.restore();
  }
  return toTexture(c);
}

export function plateTexture(lines, { w = 768, h = 320, soon = false } = {}) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#2a1630');
  bg.addColorStop(1, '#170c1c');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 5;
  ctx.strokeRect(12, 12, w - 24, h - 24);
  ctx.strokeStyle = 'rgba(226,189,120,.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, w - 48, h - 48);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const [title, sub] = lines;
  const t = fit(ctx, title, { family: SERIF, weight: 600, max: 74, min: 38, maxW: w * 0.84, maxLines: 2 });
  ctx.fillStyle = '#fbf0dc';
  const top = h * (sub ? 0.42 : 0.5) - (t.lines.length - 1) * t.size * 0.5;
  t.lines.forEach((l, i) => ctx.fillText(l, w / 2, top + i * t.size));
  if (sub) {
    ctx.fillStyle = soon ? '#ff9aa8' : GOLD;
    ctx.font = `700 ${Math.round(h * 0.085)}px ${SANS}`;
    spaced(ctx, sub.toUpperCase(), w / 2, h * 0.8, 5);
  }
  return toTexture(c);
}

export function signTexture({ eyebrow, title, sub, w = 2048, h = 512, bg = true, titleFont = SERIF, titleWeight = 600 }) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  if (bg) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#2b1433');
    g.addColorStop(1, '#14091a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = h * 0.02;
    ctx.strokeRect(h * 0.04, h * 0.04, w - h * 0.08, h - h * 0.08);
    ctx.strokeStyle = 'rgba(226,189,120,.4)';
    ctx.lineWidth = h * 0.006;
    ctx.strokeRect(h * 0.08, h * 0.08, w - h * 0.16, h - h * 0.16);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let ty = h * 0.55;
  if (eyebrow) {
    ctx.fillStyle = GOLD;
    ctx.font = `700 ${Math.round(h * 0.085)}px ${SANS}`;
    spaced(ctx, eyebrow, w / 2, h * 0.26, h * 0.035);
    ty = h * (sub ? 0.56 : 0.6);
  } else if (sub) ty = h * 0.44;
  const t = fit(ctx, title, { family: titleFont, weight: titleWeight, max: Math.round(h * 0.38), min: Math.round(h * 0.16), maxW: w * 0.88, maxLines: 1 });
  ctx.font = `${titleWeight} ${t.size}px ${titleFont}`;
  ctx.fillStyle = goldGradient(ctx, 0, ty - t.size / 2, 0, ty + t.size / 2);
  spaced(ctx, title, w / 2, ty, t.size * 0.08);
  if (sub) {
    ctx.fillStyle = 'rgba(247,225,176,.85)';
    ctx.font = `italic 500 ${Math.round(h * 0.13)}px ${SERIF}`;
    ctx.fillText(sub, w / 2, h * 0.82);
  }
  return toTexture(c);
}

export function bannerTexture(words, motif) {
  const W = 384, H = 1152;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, '#240a1e');
  g.addColorStop(0.5, '#4a1636');
  g.addColorStop(1, '#240a1e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // swallow-tail bottom
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(W / 2, H - 110);
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(22, 0);
  ctx.lineTo(22, H - 30);
  ctx.lineTo(W / 2, H - 140);
  ctx.lineTo(W - 22, H - 30);
  ctx.lineTo(W - 22, 0);
  ctx.stroke();
  ctx.fillStyle = GOLD;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // motif star
  ctx.save();
  ctx.translate(W / 2, 170);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 ? 22 : 64;
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#f6e6c6';
  words.forEach((wd, i) => {
    ctx.font = `600 ${wd.length > 6 ? 62 : 74}px ${SERIF}`;
    spaced(ctx, wd.toUpperCase(), W / 2, 360 + i * 120, 8);
  });
  if (motif) {
    ctx.fillStyle = GOLD;
    ctx.font = `italic 500 40px ${SERIF}`;
    ctx.fillText(motif, W / 2, 360 + words.length * 120 + 30);
  }
  return toTexture(c);
}

/* Glowing medallion for each of the four pillars, carrying its Life Coach Code symbol. */
export function emblemTexture(label, img) {
  const W = 512, H = 660;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const cx = W / 2, cy = 250, R = 220;
  const glow = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R + 24);
  glow.addColorStop(0, 'rgba(247,225,176,.0)');
  glow.addColorStop(0.85, 'rgba(247,225,176,.35)');
  glow.addColorStop(1, 'rgba(226,189,120,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  const disc = ctx.createRadialGradient(cx, cy - 40, 20, cx, cy, R);
  disc.addColorStop(0, '#3a2346');
  disc.addColorStop(1, '#140a1c');
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(cx, cy, R - 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = GOLD_HI;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(cx, cy, R - 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.setLineDash([4, 10]);
  ctx.beginPath();
  ctx.arc(cx, cy, R - 34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  if (img) {
    const s = 250;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, cx - s / 2, cy - s / 2, s, s);
  }
  ctx.fillStyle = GOLD_HI;
  ctx.textAlign = 'center';
  ctx.font = `600 84px ${SERIF}`;
  spaced(ctx, label.toUpperCase(), cx, 600, 14);
  return toTexture(c);
}

/* The Life Coach Code logo set in a gold medallion. */
export function logoMedallionTexture(img) {
  const S = 1024;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const cx = S / 2;
  ctx.fillStyle = goldGradient(ctx, 0, 0, S, S);
  ctx.beginPath();
  ctx.arc(cx, cx, S / 2 - 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a1630';
  ctx.beginPath();
  ctx.arc(cx, cx, S / 2 - 40, 0, Math.PI * 2);
  ctx.fill();
  if (img) ctx.drawImage(img, 60, 60, S - 120, S - 120);
  return toTexture(c);
}

export function cardBackTexture() {
  const W = 256, H = 400;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#3a2150');
  g.addColorStop(1, '#170c22');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, W - 20, H - 20);
  ctx.translate(W / 2, H / 2);
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 ? 14 : 60;
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(226,189,120,.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 80, 0, Math.PI * 2);
  ctx.stroke();
  return toTexture(c);
}

/* Glyph atlas for the "voice becomes words" particles on the stage. */
export function letterAtlas() {
  const S = 512, N = 8;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZaeioustn';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `italic 500 ${S / N * 0.78}px ${SERIF}`;
  for (let i = 0; i < N * N; i++) {
    const x = (i % N + 0.5) * (S / N), y = (Math.floor(i / N) + 0.5) * (S / N);
    ctx.fillText(letters[i % letters.length], x, y);
  }
  return toTexture(c, { srgb: false });
}

export function glowPageTexture() {
  const W = 512, H = 680;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, '#e9dcc4');
  g.addColorStop(0.15, '#fff8ea');
  g.addColorStop(1, '#fbf1de');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(70,50,60,.42)';
  for (let i = 0; i < 18; i++) {
    const y = 80 + i * 30;
    const len = i % 6 === 5 ? 0.45 : 0.72 + ((i * 37) % 10) / 50;
    ctx.fillRect(60, y, (W - 120) * len, 6);
  }
  return toTexture(c);
}
