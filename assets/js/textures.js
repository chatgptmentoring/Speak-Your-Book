/*
 * Procedural textures for the fair: everything is drawn on canvas at load time,
 * so the only image downloads are the book covers.
 */
import * as THREE from 'three';

export const SERIF = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
export const SANS = 'Manrope, "Helvetica Neue", Arial, sans-serif';
export const GOLD = '#e2bd78';
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
export function spaced(ctx, text, x, y, spacing, align = 'center') {
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

export function wrap(ctx, text, maxW) {
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

export function fit(ctx, text, { family, weight = 600, style = '', max, min, maxW, maxLines }) {
  for (let s = max; s >= min; s -= 2) {
    ctx.font = `${style} ${weight} ${s}px ${family}`;
    const lines = wrap(ctx, text, maxW);
    if (lines.length <= maxLines) return { size: s, lines };
  }
  ctx.font = `${style} ${weight} ${min}px ${family}`;
  return { size: min, lines: wrap(ctx, text, maxW).slice(0, maxLines) };
}

export function goldGradient(ctx, x0, y0, x1, y1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, GOLD_HI);
  g.addColorStop(0.5, GOLD);
  g.addColorStop(1, '#c98f45');
  return g;
}

export function ornament(ctx, x, y, w, color = GOLD) {
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

/* ---------- look inside: the pages of each book, drawn from its own words ---------- */
function paper(ctx, W, H, side) {
  const g = ctx.createRadialGradient(W * 0.6, H * 0.3, 10, W * 0.5, H * 0.5, H * 0.8);
  g.addColorStop(0, '#fffaf0');
  g.addColorStop(1, '#efe3cc');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // shade toward the spine
  const right = side === 'right';
  const gut = ctx.createLinearGradient(right ? 0 : W, 0, right ? W * 0.16 : W * 0.84, 0);
  gut.addColorStop(0, 'rgba(60,40,20,.22)');
  gut.addColorStop(1, 'rgba(60,40,20,0)');
  ctx.fillStyle = gut;
  ctx.fillRect(0, 0, W, H);
}

/* Every page is made from the book's own text: title, hook, contents, steps, description. */
export function bookPageSpecs(book) {
  const p = [{ kind: 'title' }, { kind: 'quote' }, { kind: 'contents' }];
  if (book.steps) p.push({ kind: 'steps' });
  (book.samplePages || []).forEach((src) => p.push({ kind: 'image', src: (window.FAIR_ASSET || ((s) => s))(src) }));
  book.description.forEach((text, i) => p.push({ kind: 'text', text, heading: i === 0 ? 'About this book' : '' }));
  p.push({ kind: 'for' });
  p.push({ kind: 'end' });
  // spread 0 is the endpaper + p[0]; after that pages come in pairs
  if (p.length % 2 === 0) p.push({ kind: 'blank' });
  return p;
}

export function bookPageTexture(book, page, index, img = null) {
  const W = 640, H = Math.round(640 * book.cover.h / book.cover.w);
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const side = index % 2 === 0 ? 'right' : 'left';
  paper(ctx, W, H, side);
  const cx = side === 'right' ? W * 0.53 : W * 0.47;
  const maxW = W * 0.68;
  const ink = '#2a2030';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const head = (text, y) => {
    ctx.fillStyle = '#9a6b26';
    ctx.font = `700 ${W * 0.03}px ${SANS}`;
    spaced(ctx, text.toUpperCase(), cx, y, W * 0.01);
  };
  const block = (text, y0, { size = 0.06, min = 0.036, lines = 12, italic = false, color = ink, lh = 1.32 } = {}) => {
    const r = fit(ctx, text, { family: SERIF, weight: 500, style: italic ? 'italic' : '', max: Math.round(W * size), min: Math.round(W * min), maxW, maxLines: lines });
    ctx.fillStyle = color;
    r.lines.forEach((l, i) => ctx.fillText(l, cx, y0 + i * r.size * lh));
    return y0 + r.lines.length * r.size * lh;
  };
  if (page.kind !== 'title' && page.kind !== 'blank') {
    ctx.fillStyle = '#a89580';
    ctx.font = `600 ${W * 0.022}px ${SANS}`;
    spaced(ctx, book.title.toUpperCase(), cx, H * 0.07, W * 0.006);
    ctx.font = `500 ${W * 0.03}px ${SERIF}`;
    ctx.fillText(String(index + 1), cx, H * 0.95);
  }
  switch (page.kind) {
    case 'title': {
      head('Life Coach Code · Virtual Book Fair', H * 0.16);
      ornament(ctx, cx, H * 0.21, W * 0.3, '#b98a3e');
      let y = block(book.title, H * 0.34, { size: 0.1, min: 0.06, lines: 4, lh: 1.1 });
      y = block(book.subtitle, y + W * 0.04, { size: 0.05, min: 0.032, lines: 4, italic: true, color: '#5c4a5e' });
      ornament(ctx, cx, Math.max(y + W * 0.06, H * 0.66), W * 0.3, '#b98a3e');
      ctx.fillStyle = ink;
      ctx.font = `italic 500 ${W * 0.065}px ${SERIF}`;
      ctx.fillText(book.displayAuthor || book.author, cx, H * 0.78);
      if (book.credentials) {
        ctx.fillStyle = '#7a6a70';
        ctx.font = `600 ${W * 0.026}px ${SANS}`;
        spaced(ctx, book.credentials, cx, H * 0.83, W * 0.006);
      }
      break;
    }
    case 'quote': {
      ctx.fillStyle = 'rgba(185,138,62,.35)';
      ctx.font = `600 ${W * 0.32}px ${SERIF}`;
      ctx.fillText('“', cx, H * 0.38);
      const y = block(book.hook, H * 0.42, { size: 0.072, min: 0.045, lines: 8, italic: true });
      ornament(ctx, cx, y + W * 0.03, W * 0.24, '#b98a3e');
      ctx.fillStyle = '#5c4a5e';
      ctx.font = `600 ${W * 0.026}px ${SANS}`;
      spaced(ctx, (book.displayAuthor || book.author).toUpperCase(), cx, y + W * 0.1, W * 0.008);
      break;
    }
    case 'contents': {
      head('Inside you’ll find', H * 0.17);
      ornament(ctx, cx, H * 0.21, W * 0.24, '#b98a3e');
      ctx.textAlign = 'left';
      const x0 = cx - maxW / 2;
      let y = H * 0.3;
      const n = book.inside.length;
      const size = Math.round(W * (n > 6 ? 0.04 : 0.046));
      book.inside.forEach((item, i) => {
        ctx.font = `600 ${size}px ${SERIF}`;
        ctx.fillStyle = '#b98a3e';
        ctx.fillText(String(i + 1).padStart(2, '0'), x0, y);
        ctx.font = `500 ${size}px ${SERIF}`;
        ctx.fillStyle = ink;
        const lines = wrap(ctx, item, maxW - size * 1.6).slice(0, 3);
        lines.forEach((l, j) => ctx.fillText(l, x0 + size * 1.6, y + j * size * 1.18));
        y += lines.length * size * 1.18 + size * 0.7;
      });
      ctx.textAlign = 'center';
      break;
    }
    case 'steps': {
      head(book.steps.title, H * 0.15);
      const colors = ['#1f4e79', '#2f8f9e', '#e0772e'];
      let y = H * 0.25;
      book.steps.items.forEach((st, i) => {
        ctx.fillStyle = colors[i % 3];
        ctx.beginPath();
        ctx.arc(cx, y, W * 0.045, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = `700 ${W * 0.04}px ${SANS}`;
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), cx, y + 1);
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = ink;
        ctx.font = `600 ${W * 0.06}px ${SERIF}`;
        ctx.fillText(st.name, cx, y + W * 0.13);
        y = block(st.text, y + W * 0.19, { size: 0.034, min: 0.026, lines: 5, color: '#4a3c4c', lh: 1.25 }) + W * 0.08;
      });
      break;
    }
    case 'text': {
      let y = H * 0.17;
      if (page.heading) { head(page.heading, y); ornament(ctx, cx, y + W * 0.05, W * 0.24, '#b98a3e'); y += W * 0.14; } else y = H * 0.14;
      block(page.text, y, { size: 0.044, min: 0.03, lines: 18, lh: 1.36 });
      break;
    }
    case 'for': {
      head('Perfect for', H * 0.3);
      ornament(ctx, cx, H * 0.34, W * 0.24, '#b98a3e');
      block(book.forWho, H * 0.44, { size: 0.06, min: 0.038, lines: 9, italic: true });
      break;
    }
    case 'end': {
      head('Continue the journey', H * 0.3);
      ornament(ctx, cx, H * 0.34, W * 0.24, '#b98a3e');
      block(book.status === 'coming-soon' ? 'This book is coming soon. Follow the fair to be first to read it.' : 'The full book is waiting for you on Amazon. Use the button beside this book to take it home.', H * 0.45, { size: 0.056, min: 0.036, lines: 7, italic: true });
      ctx.fillStyle = '#8b7a6c';
      ctx.font = `600 ${W * 0.024}px ${SANS}`;
      spaced(ctx, 'LIFE COACH CODE  ·  VIRTUAL BOOK FAIR', cx, H * 0.88, W * 0.006);
      break;
    }
    case 'image': {
      if (img) {
        const r = Math.min((W * 0.86) / img.width, (H * 0.86) / img.height);
        ctx.drawImage(img, cx - (img.width * r) / 2, H / 2 - (img.height * r) / 2, img.width * r, img.height * r);
      }
      break;
    }
    default:
      ornament(ctx, cx, H * 0.5, W * 0.3, 'rgba(185,138,62,.6)');
  }
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
  spaced(ctx, index < 0 ? 'FROM LIFE COACH CODE' : `BOOTH ${String(index + 1).padStart(2, '0')}  ·  OF ${String(total).padStart(2, '0')}`, W / 2, H * 0.1, W * 0.01);

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

/* ---------- the Life Coach Code crest at the entrance ---------- */
function star(ctx, x, y, r, points = 4, inner = 0.38) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * inner : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

function goldRing(ctx, cx, cy, r0, r1) {
  const g = ctx.createLinearGradient(cx - r1, cy - r1, cx + r1, cy + r1);
  g.addColorStop(0, '#fff3cf');
  g.addColorStop(0.22, '#e9c27a');
  g.addColorStop(0.48, '#9c6a2a');
  g.addColorStop(0.72, '#f3d38e');
  g.addColorStop(1, '#8a5a22');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r1, 0, Math.PI * 2);
  ctx.arc(cx, cy, r0, 0, Math.PI * 2, true);
  ctx.fill();
  const lw = Math.max(1, (r1 - r0) * 0.1);
  ctx.lineWidth = lw;
  ctx.strokeStyle = 'rgba(255,248,225,.75)';
  ctx.beginPath();
  ctx.arc(cx, cy, r1 - lw / 2, Math.PI * 0.95, Math.PI * 1.65);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(50,24,8,.6)';
  ctx.beginPath();
  ctx.arc(cx, cy, r0 + lw / 2, 0, Math.PI * 2);
  ctx.stroke();
}

function circleText(ctx, text, cx, cy, radius, size, family = SERIF, weight = 600) {
  let s = size;
  let chars, widths, total;
  for (;;) {
    ctx.font = `${weight} ${s}px ${family}`;
    chars = [...text];
    widths = chars.map((ch) => ctx.measureText(ch).width);
    total = widths.reduce((a, b) => a + b, 0);
    if (total < Math.PI * 2 * radius * 0.94 || s < 8) break;
    s -= 2;
  }
  const extra = (Math.PI * 2 * radius - total) / chars.length;
  let a = -Math.PI / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  chars.forEach((ch, i) => {
    const w = widths[i] + extra;
    const ang = a + w / 2 / radius;
    ctx.save();
    ctx.translate(cx + Math.cos(ang) * radius, cy + Math.sin(ang) * radius);
    ctx.rotate(ang + Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    a += w / radius;
  });
}

/* The medallion: a gold bezel, a starry enamel band and the logo under glass. */
export function crestTexture(img, S = 2048) {
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const cx = S / 2, R = S / 2;
  goldRing(ctx, cx, cx, R * 0.86, R * 0.995);
  const en = ctx.createRadialGradient(cx, cx * 0.82, R * 0.3, cx, cx, R * 0.86);
  en.addColorStop(0, '#4a2456');
  en.addColorStop(1, '#1b0b22');
  ctx.fillStyle = en;
  ctx.beginPath();
  ctx.arc(cx, cx, R * 0.862, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = GOLD_HI;
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    star(ctx, cx + Math.cos(a) * R * 0.822, cx + Math.sin(a) * R * 0.822, i % 5 === 0 ? R * 0.02 : R * 0.009, 4);
  }
  goldRing(ctx, cx, cx, R * 0.75, R * 0.785);
  if (img) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cx, R * 0.752, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, cx - R * 0.755, cx - R * 0.755, R * 1.51, R * 1.51);
    const sh = ctx.createLinearGradient(0, cx - R * 0.75, 0, cx + R * 0.1);
    sh.addColorStop(0, 'rgba(255,255,255,.26)');
    sh.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sh;
    ctx.beginPath();
    ctx.ellipse(cx, cx - R * 0.4, R * 0.62, R * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  return toTexture(c);
}

export function sunburstTexture(S = 1024) {
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const cx = S / 2;
  ctx.globalCompositeOperation = 'lighter';
  const n = 72;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const long = i % 2 === 0;
    const len = cx * (long ? 0.98 : 0.66) * (0.82 + 0.18 * Math.abs(Math.sin(i * 1.7)));
    const w = long ? 0.02 : 0.012;
    const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, len);
    g.addColorStop(0, 'rgba(255,236,190,0.85)');
    g.addColorStop(0.4, 'rgba(255,214,150,0.35)');
    g.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx, cx);
    ctx.lineTo(cx + Math.cos(a - w) * len, cx + Math.sin(a - w) * len);
    ctx.lineTo(cx + Math.cos(a + w) * len, cx + Math.sin(a + w) * len);
    ctx.closePath();
    ctx.fill();
  }
  const glow = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx * 0.6);
  glow.addColorStop(0, 'rgba(255,230,180,0.75)');
  glow.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, S, S);
  return toTexture(c);
}

/* Text around a ring. Use with RingGeometry(0.8 * r, r): the band fills the outer fifth. */
export function textRingTexture(text, S = 2048) {
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const cx = S / 2, r0 = S * 0.4, r1 = S * 0.5;
  const band = ctx.createRadialGradient(cx, cx, r0, cx, cx, r1);
  band.addColorStop(0, 'rgba(40,16,48,.92)');
  band.addColorStop(1, 'rgba(24,10,30,.92)');
  ctx.fillStyle = band;
  ctx.beginPath();
  ctx.arc(cx, cx, r1 - 2, 0, Math.PI * 2);
  ctx.arc(cx, cx, r0 + 2, 0, Math.PI * 2, true);
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = S * 0.005;
  [r0 + S * 0.008, r1 - S * 0.008].forEach((r) => { ctx.beginPath(); ctx.arc(cx, cx, r, 0, Math.PI * 2); ctx.stroke(); });
  ctx.fillStyle = GOLD_HI;
  circleText(ctx, text, cx, cx, (r0 + r1) / 2, Math.round((r1 - r0) * 0.48));
  return toTexture(c);
}

/* Two golden laurel branches that cradle the medallion. Medallion centre: (0.5, 0.42) of the canvas. */
export function laurelTexture(W = 2048, H = 1400) {
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const cx = W / 2, cy = H * 0.42, R = H * 0.5;
  const leaf = (x, y, ang, L) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    const g = ctx.createLinearGradient(0, -L * 0.3, L, L * 0.3);
    g.addColorStop(0, '#fff0c4');
    g.addColorStop(0.45, '#e2b562');
    g.addColorStop(1, '#9c6a2a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(L * 0.45, -L * 0.36, L, 0);
    ctx.quadraticCurveTo(L * 0.45, L * 0.36, 0, 0);
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,52,16,.7)';
    ctx.lineWidth = L * 0.03;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,244,214,.7)';
    ctx.lineWidth = L * 0.025;
    ctx.beginPath();
    ctx.moveTo(L * 0.06, 0);
    ctx.lineTo(L * 0.85, 0);
    ctx.stroke();
    ctx.restore();
  };
  [-1, 1].forEach((side) => {
    const th = (t) => Math.PI / 2 - side * (0.16 + t * 1.95);
    const rr = R * 1.0;
    // stem
    ctx.strokeStyle = '#c89b52';
    ctx.lineWidth = R * 0.022;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const a = th(i / 60);
      ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.stroke();
    const N = 15;
    for (let i = 0; i < N; i++) {
      const t = (i + 0.4) / N;
      const a = th(t);
      const tx = side * Math.sin(a), ty = -side * Math.cos(a);
      const dir = Math.atan2(ty, tx);
      const L = R * 0.26 * (1 - t * 0.5);
      [1, -1].forEach((o) => {
        const px = cx + Math.cos(a) * (rr + o * R * 0.012), py = cy + Math.sin(a) * (rr + o * R * 0.012);
        leaf(px, py, dir - side * o * 0.62, L);
      });
      if (i % 3 === 1) {
        ctx.fillStyle = '#f3d38e';
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * (rr - R * 0.07), cy + Math.sin(a) * (rr - R * 0.07), R * 0.018, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
  return toTexture(c);
}

/* A swallowtail ribbon with the name of the host. */
export function ribbonTexture(title, W = 2048, H = 440) {
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const arc = H * 0.08, band = H * 0.42, top0 = H * 0.24, endW = W * 0.13;
  const yAt = (x) => top0 + arc * (((x - W / 2) / (W / 2)) ** 2);
  // tails
  [-1, 1].forEach((s) => {
    const xo = s < 0 ? 0 : W, xi = s < 0 ? endW * 1.6 : W - endW * 1.6;
    const y0 = yAt(xi) + H * 0.14;
    ctx.fillStyle = '#2a0f30';
    ctx.beginPath();
    ctx.moveTo(xi, y0);
    ctx.lineTo(xo, y0 + H * 0.02);
    ctx.lineTo(xo - s * endW * 0.45, y0 + band * 0.5 + H * 0.02);
    ctx.lineTo(xo, y0 + band + H * 0.02);
    ctx.lineTo(xi, y0 + band);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = H * 0.012;
    ctx.stroke();
    ctx.fillStyle = '#150716';
    ctx.beginPath();
    const xf = s < 0 ? endW : W - endW;
    ctx.moveTo(xf, yAt(xf) + band);
    ctx.lineTo(xi, y0 + band);
    ctx.lineTo(xi, yAt(xi) + band);
    ctx.closePath();
    ctx.fill();
  });
  // main band
  const g = ctx.createLinearGradient(0, top0, 0, top0 + band + arc);
  g.addColorStop(0, '#5a2a63');
  g.addColorStop(0.5, '#3d1846');
  g.addColorStop(1, '#2a0f30');
  ctx.fillStyle = g;
  ctx.beginPath();
  for (let x = endW; x <= W - endW; x += 16) ctx.lineTo(x, yAt(x));
  for (let x = W - endW; x >= endW; x -= 16) ctx.lineTo(x, yAt(x) + band);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = GOLD_HI;
  ctx.lineWidth = H * 0.016;
  [H * 0.03, band - H * 0.03].forEach((dy) => {
    ctx.beginPath();
    for (let x = endW; x <= W - endW; x += 16) ctx.lineTo(x, yAt(x) + dy);
    ctx.stroke();
  });
  // title along the curve
  const size = Math.round(band * 0.56);
  ctx.font = `600 ${size}px ${SERIF}`;
  const chars = [...title];
  const sp = size * 0.16;
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + sp * (chars.length - 1);
  let x = W / 2 - total / 2;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  chars.forEach((ch, i) => {
    const xm = x + widths[i] / 2;
    const slope = (2 * arc * (xm - W / 2)) / ((W / 2) ** 2);
    ctx.save();
    ctx.translate(xm, yAt(xm) + band / 2 + size * 0.04);
    ctx.rotate(Math.atan(slope));
    ctx.fillStyle = goldGradient(ctx, 0, -size / 2, 0, size / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    x += widths[i] + sp;
  });
  return toTexture(c);
}

/* The inlay on the entrance plaza floor: a compass rose around the logo. */
export function floorInlayTexture(img, text, S = 2048) {
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const cx = S / 2, R = S / 2;
  const base = ctx.createRadialGradient(cx, cx, R * 0.2, cx, cx, R);
  base.addColorStop(0, '#2a1832');
  base.addColorStop(1, '#120a17');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);
  goldRing(ctx, cx, cx, R * 0.97, R * 0.995);
  goldRing(ctx, cx, cx, R * 0.8, R * 0.815);
  ctx.fillStyle = GOLD_HI;
  circleText(ctx, text, cx, cx, R * 0.89, Math.round(R * 0.085));
  // compass rose
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
    const long = i % 4 === 0, mid = i % 2 === 0;
    const len = R * (long ? 0.78 : mid ? 0.6 : 0.5);
    const w = R * (long ? 0.09 : 0.06);
    [1, -1].forEach((s) => {
      ctx.fillStyle = s > 0 ? (long ? '#e9c27a' : '#b98a3e') : (long ? '#a8742e' : '#7a5222');
      ctx.beginPath();
      ctx.moveTo(cx, cx);
      ctx.lineTo(cx + Math.cos(a) * len, cx + Math.sin(a) * len);
      ctx.lineTo(cx + Math.cos(a + s * Math.PI / 2) * w * 0.9 + Math.cos(a) * w, cx + Math.sin(a + s * Math.PI / 2) * w * 0.9 + Math.sin(a) * w);
      ctx.closePath();
      ctx.fill();
    });
  }
  goldRing(ctx, cx, cx, R * 0.4, R * 0.44);
  if (img) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cx, R * 0.402, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, cx - R * 0.405, cx - R * 0.405, R * 0.81, R * 0.81);
    ctx.restore();
  }
  return toTexture(c);
}

/* Tall flags on the lamp posts. */
export function flagTexture(img, lines) {
  const W = 512, H = 1536;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const notch = 150;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#4a1f55');
  g.addColorStop(1, '#1c0b22');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(W, 0);
  ctx.lineTo(W, H);
  ctx.lineTo(W / 2, H - notch);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(26, 26);
  ctx.lineTo(W - 26, 26);
  ctx.lineTo(W - 26, H - 60);
  ctx.lineTo(W / 2, H - notch - 34);
  ctx.lineTo(26, H - 60);
  ctx.closePath();
  ctx.stroke();
  const cy = 250, r = 170;
  goldRing(ctx, W / 2, cy, r, r + 18);
  if (img) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, W / 2 - r, cy - r, r * 2, r * 2);
    ctx.restore();
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let y = 560;
  lines.forEach((l) => {
    if (l === '-') { ornament(ctx, W / 2, y, W * 0.6, GOLD); y += 90; return; }
    const big = l === l.toUpperCase() && l.length < 8;
    const size = big ? 118 : 48;
    ctx.font = big ? `600 ${size}px ${SERIF}` : `700 ${size}px ${SANS}`;
    ctx.fillStyle = big ? goldGradient(ctx, 0, y - size / 2, 0, y + size / 2) : GOLD_HI;
    if (big) ctx.fillText(l, W / 2, y); else spaced(ctx, l, W / 2, y, 8);
    y += big ? 128 : 84;
  });
  return toTexture(c);
}

/* The live event poster (entrance easel). */
export function eventPosterTexture(img, d) {
  const W = 1024, H = 1400;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#3a1844');
  g.addColorStop(1, '#130818');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 330, 20, W / 2, 330, 600);
  glow.addColorStop(0, 'rgba(255,190,120,.35)');
  glow.addColorStop(1, 'rgba(255,190,120,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,240,210,.7)';
  for (let i = 0; i < 90; i++) {
    const x = (Math.sin(i * 12.9898) * 43758.5453 % 1 + 1) % 1 * W, y = (Math.sin(i * 78.233) * 12543.21 % 1 + 1) % 1 * H;
    ctx.globalAlpha = 0.2 + ((i * 37) % 10) / 14;
    ctx.fillRect(x, y, 2.5, 2.5);
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 10;
  ctx.strokeRect(24, 24, W - 48, H - 48);
  ctx.strokeStyle = 'rgba(226,189,120,.45)';
  ctx.lineWidth = 3;
  ctx.strokeRect(44, 44, W - 88, H - 88);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // live pill
  ctx.font = `700 34px ${SANS}`;
  const pw = spacedWidth(ctx, d.pill, 6) + 110;
  roundRect(ctx, W / 2 - pw / 2, 96, pw, 68, 34);
  ctx.fillStyle = 'rgba(224,86,106,.18)';
  ctx.fill();
  ctx.strokeStyle = '#ff7d90';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#ff6f82';
  ctx.beginPath();
  ctx.arc(W / 2 - pw / 2 + 44, 130, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd6dc';
  spaced(ctx, d.pill, W / 2 + 22, 132, 6);
  const cy = 330, r = 120;
  goldRing(ctx, W / 2, cy, r, r + 14);
  if (img) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, W / 2 - r, cy - r, r * 2, r * 2);
    ctx.restore();
  }
  ctx.fillStyle = GOLD;
  ctx.font = `700 30px ${SANS}`;
  spaced(ctx, d.eyebrow, W / 2, 512, 9);
  ctx.font = `600 170px ${SERIF}`;
  ctx.fillStyle = goldGradient(ctx, 0, 560, 0, 820);
  ctx.fillText(d.title1, W / 2, 630);
  ctx.fillText(d.title2, W / 2, 780);
  ctx.fillStyle = '#fbf0dc';
  ctx.font = `italic 500 78px ${SERIF}`;
  ctx.fillText(d.date, W / 2, 905);
  ornament(ctx, W / 2, 975, 420, GOLD);
  const b = fit(ctx, d.body, { family: SERIF, weight: 500, max: 50, min: 34, maxW: W * 0.76, maxLines: 3 });
  ctx.fillStyle = 'rgba(251,240,220,.88)';
  b.lines.forEach((l, i) => ctx.fillText(l, W / 2, 1050 + i * b.size * 1.2));
  // button
  ctx.font = `700 40px ${SANS}`;
  const bw = spacedWidth(ctx, d.cta, 6) + 120;
  roundRect(ctx, W / 2 - bw / 2, 1180, bw, 96, 48);
  ctx.fillStyle = goldGradient(ctx, 0, 1180, 0, 1276);
  ctx.fill();
  ctx.fillStyle = '#221606';
  spaced(ctx, d.cta, W / 2, 1230, 6);
  ctx.fillStyle = 'rgba(247,225,176,.7)';
  ctx.font = `600 26px ${SANS}`;
  spaced(ctx, d.foot, W / 2, 1320, 4);
  return toTexture(c);
}

function spacedWidth(ctx, text, spacing) {
  const chars = [...text];
  return chars.reduce((a, ch) => a + ctx.measureText(ch).width, 0) + spacing * (chars.length - 1);
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* The screens beside the stage. Redrawn as the day of the event comes closer. */
export function drawEventScreen(canvas, kind, d) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#26112e');
  g.addColorStop(1, '#0d0612');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, H * 0.45, 10, W / 2, H * 0.45, W * 0.6);
  glow.addColorStop(0, 'rgba(255,180,110,.22)');
  glow.addColorStop(1, 'rgba(255,180,110,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(226,189,120,.55)';
  ctx.lineWidth = 4;
  ctx.strokeRect(18, 18, W - 36, H - 36);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = GOLD;
  ctx.font = `700 ${Math.round(H * 0.052)}px ${SANS}`;
  spaced(ctx, d.eyebrow, W / 2, H * 0.12, H * 0.014);
  if (kind === 'countdown') {
    // names and times change through the day: each line shrinks to fit its width
    const fitFont = (font, size, text, maxW, spacing = 0) => {
      ctx.font = font(size);
      const w = spacing ? spacedWidth(ctx, text, spacing * size) : ctx.measureText(text).width;
      if (w > maxW) ctx.font = font(Math.floor(size * maxW / w));
    };
    ctx.font = `600 ${Math.round(H * (d.big.length > 3 ? 0.2 : 0.36))}px ${SERIF}`;
    ctx.fillStyle = goldGradient(ctx, 0, H * 0.25, 0, H * 0.55);
    ctx.fillText(d.big, W / 2, H * 0.4);
    ctx.fillStyle = '#fbf0dc';
    fitFont((z) => `700 ${z}px ${SANS}`, Math.round(H * 0.06), d.label, W * 0.86, 0.27);
    spaced(ctx, d.label, W / 2, H * 0.6, parseFloat(ctx.font.match(/(\d+)px/)[1]) * 0.27);
    fitFont((z) => `italic 500 ${z}px ${SERIF}`, Math.round(H * 0.075), d.line, W * 0.88);
    ctx.fillStyle = 'rgba(251,240,220,.9)';
    ctx.fillText(d.line, W / 2, H * 0.72);
    const bw = W * 0.56, bh = H * 0.11;
    roundRect(ctx, W / 2 - bw / 2, H * 0.8, bw, bh, bh / 2);
    ctx.fillStyle = goldGradient(ctx, 0, H * 0.8, 0, H * 0.91);
    ctx.fill();
    ctx.fillStyle = '#221606';
    fitFont((z) => `700 ${z}px ${SANS}`, Math.round(H * 0.045), d.cta, bw * 0.9, 0.22);
    spaced(ctx, d.cta, W / 2, H * 0.857, parseFloat(ctx.font.match(/(\d+)px/)[1]) * 0.22);
  } else {
    ctx.font = `600 ${Math.round(H * 0.1)}px ${SERIF}`;
    ctx.fillStyle = goldGradient(ctx, 0, H * 0.16, 0, H * 0.28);
    ctx.fillText(d.title, W / 2, H * 0.23);
    const names = d.names;
    const cols = names.length > 6 ? 2 : 1;
    const rows = Math.ceil(names.length / cols);
    let size = Math.round(Math.min(H * 0.062, (H * 0.58) / rows / 1.25));
    ctx.font = `500 ${size}px ${SERIF}`;
    const lineH = size * 1.25;
    // every name fits its column, however long
    const room = cols === 2 ? W * 0.39 : W * 0.6;
    const widest = Math.max(...names.map((n) => ctx.measureText(n).width));
    if (widest > room) {
      size = Math.floor(size * room / widest);
      ctx.font = `500 ${size}px ${SERIF}`;
    }
    names.forEach((n, i) => {
      const col = cols === 2 ? Math.floor(i / rows) : 0;
      const row = cols === 2 ? i % rows : i;
      const x = cols === 2 ? W * (col ? 0.73 : 0.27) : W / 2;
      const y = H * 0.36 + row * lineH;
      ctx.fillStyle = GOLD;
      star(ctx, x - W * 0.2, y, size * 0.2, 4);
      ctx.fillStyle = '#fbf0dc';
      ctx.textAlign = 'left';
      ctx.fillText(n, x - W * 0.17, y + size * 0.04);
      ctx.textAlign = 'center';
    });
    ctx.fillStyle = 'rgba(247,225,176,.85)';
    ctx.font = `italic 500 ${Math.round(H * 0.06)}px ${SERIF}`;
    ctx.fillText(d.foot, W / 2, H * 0.9);
  }
}

/* Floating name tags above people and authors. */
export function nameTagTexture(name, sub, { accent = GOLD, author = false } = {}) {
  const W = 640, H = 168;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.font = `600 64px ${SERIF}`;
  const nameW = Math.min(W - 80, ctx.measureText(name).width);
  ctx.font = `700 26px ${SANS}`;
  const subW = sub ? spacedWidth(ctx, sub.toUpperCase(), 4) : 0;
  const w = Math.min(W - 8, Math.max(nameW, subW) + 80);
  roundRect(ctx, (W - w) / 2, 6, w, H - 12, 44);
  ctx.fillStyle = author ? 'rgba(48,22,56,.86)' : 'rgba(14,10,22,.72)';
  ctx.fill();
  ctx.lineWidth = author ? 5 : 3;
  ctx.strokeStyle = author ? GOLD_HI : 'rgba(226,189,120,.45)';
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fbf0dc';
  ctx.font = `600 64px ${SERIF}`;
  const y = sub ? 66 : H / 2 + 2;
  ctx.fillText(name, W / 2, y, W - 80);
  if (sub) {
    ctx.fillStyle = accent;
    ctx.font = `700 26px ${SANS}`;
    spaced(ctx, sub.toUpperCase(), W / 2, 124, 4);
  }
  return toTexture(c);
}

const emoteCache = new Map();
export function emoteTexture(emoji) {
  if (emoteCache.has(emoji)) return emoteCache.get(emoji);
  const S = 192;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 10, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,240,210,.45)');
  g.addColorStop(1, 'rgba(255,240,210,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(S * 0.6)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif`;
  ctx.fillText(emoji, S / 2, S / 2 + S * 0.04);
  const t = toTexture(c);
  emoteCache.set(emoji, t);
  return t;
}

/* An author's initials in gold, for the portrait medallion until their photo arrives. */
export function monogramTexture(initials) {
  const S = 256;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S * 0.42, S * 0.36, 8, S / 2, S / 2, S * 0.62);
  g.addColorStop(0, '#5a2f63');
  g.addColorStop(0.6, '#2a1433');
  g.addColorStop(1, '#12091a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S * 0.43, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(226,189,120,.55)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${Math.round(S * 0.4)}px ${SERIF}`;
  ctx.fillStyle = goldGradient(ctx, 0, S * 0.3, 0, S * 0.7);
  ctx.fillText(initials, S / 2, S / 2 + S * 0.02);
  return toTexture(c);
}
