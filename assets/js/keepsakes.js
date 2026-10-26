/*
 * Things visitors take home: their own book cover, a postcard from the fair, a framed
 * photo of the hall and a certificate for touring every booth. All drawn on canvas.
 */
const SERIF = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
const SANS = 'Manrope, "Helvetica Neue", Arial, sans-serif';
const GOLD = '#e2bd78';
const GOLD_HI = '#f7e1b0';

export const COVER_STYLES = [
  { id: 'midnight', label: 'Midnight gold', bg: ['#3a1d4a', '#140a1f'], ink: '#f7e1b0', accent: '#e2bd78', spine: '#24112f', glow: '#e2bd78' },
  { id: 'rose', label: 'Rose', bg: ['#f6dade', '#d98fa0'], ink: '#3b1426', accent: '#8c2f4c', spine: '#b9687c', glow: '#ff9fb4' },
  { id: 'ocean', label: 'Ocean', bg: ['#2a7f9e', '#0d2e47'], ink: '#fbf3e4', accent: '#9fe0ef', spine: '#123d58', glow: '#6fd0ea' },
  { id: 'forest', label: 'Forest', bg: ['#46745a', '#15291f'], ink: '#f4e7c8', accent: '#d9b56a', spine: '#1d3a2b', glow: '#9fdc9a' },
  { id: 'ember', label: 'Sunrise', bg: ['#e0772e', '#5a1612'], ink: '#fff3e2', accent: '#ffd29a', spine: '#7a2416', glow: '#ffb070' },
  { id: 'ivory', label: 'Ivory', bg: ['#fbf6ec', '#e3d3b6'], ink: '#2a2030', accent: '#b98a3e', spine: '#cdb48c', glow: '#ffe2a8' }
];

const make = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

function wrap(ctx, text, maxW) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  words.forEach((w) => {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  });
  if (line) lines.push(line);
  return lines;
}
function fit(ctx, text, { font, max, min, maxW, maxLines }) {
  for (let s = max; s >= min; s -= 2) {
    ctx.font = font(s);
    const lines = wrap(ctx, text, maxW);
    if (lines.length <= maxLines) return { size: s, lines };
  }
  ctx.font = font(min);
  return { size: min, lines: wrap(ctx, text, maxW).slice(0, maxLines) };
}
function spaced(ctx, text, x, y, sp) {
  const chars = [...text];
  const ws = chars.map((c) => ctx.measureText(c).width);
  let cx = x - (ws.reduce((a, b) => a + b, 0) + sp * (chars.length - 1)) / 2;
  const al = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((c, i) => { ctx.fillText(c, cx, y); cx += ws[i] + sp; });
  ctx.textAlign = al;
}
function gold(ctx, y0, y1) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, GOLD_HI);
  g.addColorStop(0.5, GOLD);
  g.addColorStop(1, '#c98f45');
  return g;
}
function ornament(ctx, x, y, w, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1, w * 0.01);
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x - w * 0.07, y);
  ctx.moveTo(x + w * 0.07, y);
  ctx.lineTo(x + w / 2, y);
  ctx.stroke();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  const s = w * 0.03;
  ctx.fillRect(-s, -s, s * 2, s * 2);
  ctx.restore();
}
function stars(ctx, W, H, n, seed = 1) {
  let s = seed;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = 0.2 + r() * 0.7;
    ctx.fillStyle = r() > 0.8 ? '#ffe2b0' : '#fff';
    const z = r() * 2.2 + 0.6;
    ctx.fillRect(r() * W, r() * H, z, z);
  }
  ctx.globalAlpha = 1;
}
function logoDisc(ctx, logo, x, y, r) {
  ctx.save();
  ctx.fillStyle = gold(ctx, y - r, y + r);
  ctx.beginPath();
  ctx.arc(x, y, r + r * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  if (logo) ctx.drawImage(logo, x - r, y - r, r * 2, r * 2);
  ctx.restore();
}
function coverImage(ctx, img, x, y, w, h) {
  const r = Math.max(w / img.width, h / img.height);
  ctx.drawImage(img, x + (w - img.width * r) / 2, y + (h - img.height * r) / 2, img.width * r, img.height * r);
}
/* ---------- the visitor's own cover ---------- */
export function drawCover(canvas, { title, subtitle, name, style }) {
  const st = COVER_STYLES.find((s) => s.id === style) || COVER_STYLES[0];
  const W = canvas.width, H = canvas.height, k = W / 600;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, W * 0.3, H);
  g.addColorStop(0, st.bg[0]);
  g.addColorStop(1, st.bg[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // a soft sun of light behind the title, and fine rays
  const glow = ctx.createRadialGradient(W / 2, H * 0.36, 10, W / 2, H * 0.36, W * 0.7);
  glow.addColorStop(0, hexA(st.glow, 0.45));
  glow.addColorStop(1, hexA(st.glow, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H * 0.36);
  ctx.strokeStyle = hexA(st.accent, 0.22);
  ctx.lineWidth = 1.2 * k;
  for (let i = 0; i < 48; i++) {
    ctx.rotate((Math.PI * 2) / 48);
    ctx.beginPath();
    ctx.moveTo(0, W * 0.14);
    ctx.lineTo(0, W * (i % 2 ? 0.3 : 0.42));
    ctx.stroke();
  }
  ctx.strokeStyle = hexA(st.accent, 0.7);
  ctx.lineWidth = 2 * k;
  ctx.beginPath();
  ctx.arc(0, 0, W * 0.12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  if (st.id === 'midnight' || st.id === 'ocean' || st.id === 'forest') stars(ctx, W, H * 0.6, 70, title.length + 3);
  // frame
  ctx.strokeStyle = hexA(st.accent, 0.8);
  ctx.lineWidth = 3 * k;
  ctx.strokeRect(24 * k, 24 * k, W - 48 * k, H - 48 * k);
  ctx.lineWidth = 1 * k;
  ctx.strokeRect(34 * k, 34 * k, W - 68 * k, H - 68 * k);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const t = fit(ctx, title || 'Your Book', { font: (s) => `600 ${s}px ${SERIF}`, max: Math.round(86 * k), min: Math.round(40 * k), maxW: W * 0.8, maxLines: 3 });
  ctx.fillStyle = st.ink;
  let y = H * 0.62 - ((t.lines.length - 1) * t.size * 1.02) / 2;
  t.lines.forEach((l, i) => ctx.fillText(l, W / 2, y + i * t.size * 1.02));
  y += (t.lines.length - 1) * t.size * 1.02;
  if (subtitle) {
    const s = fit(ctx, subtitle, { font: (z) => `italic 500 ${z}px ${SERIF}`, max: Math.round(32 * k), min: Math.round(20 * k), maxW: W * 0.74, maxLines: 2 });
    ctx.fillStyle = hexA(st.ink, 0.85);
    s.lines.forEach((l, i) => ctx.fillText(l, W / 2, y + 52 * k + i * s.size * 1.2));
  }
  ornament(ctx, W / 2, H * 0.86, W * 0.36, st.accent);
  ctx.fillStyle = st.ink;
  ctx.font = `700 ${Math.round(22 * k)}px ${SANS}`;
  spaced(ctx, (name || 'Your name').toUpperCase(), W / 2, H * 0.92, 5 * k);
  return { colors: { spine: st.spine, spineText: st.ink, glow: st.glow } };
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* ---------- a postcard from the fair ---------- */
export function makePostcard({ cover, title, name, scene, logo, lines }) {
  const W = 1080, H = 1350;
  const c = make(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#120818';
  ctx.fillRect(0, 0, W, H);
  if (scene) coverImage(ctx, scene, 0, 0, W, 820);
  else {
    const g = ctx.createRadialGradient(W * 0.6, 260, 20, W * 0.6, 260, 900);
    g.addColorStop(0, '#5a2a63');
    g.addColorStop(1, '#120818');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, 820);
    stars(ctx, W, 820, 260, 7);
  }
  const fade = ctx.createLinearGradient(0, 380, 0, 860);
  fade.addColorStop(0, 'rgba(18,8,24,0)');
  fade.addColorStop(1, 'rgba(18,8,24,1)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 380, W, 480);
  ctx.fillStyle = '#120818';
  ctx.fillRect(0, 858, W, H - 858);
  // the book
  const cw = 360, ch = Math.round(cw * cover.height / cover.width);
  ctx.save();
  ctx.translate(84 + cw / 2, 560 + ch / 2);
  ctx.rotate(-0.045);
  ctx.shadowColor = 'rgba(0,0,0,.7)';
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 24;
  ctx.drawImage(cover, -cw / 2, -ch / 2, cw, ch);
  ctx.restore();
  // words
  const x = 500, maxW = W - x - 70;
  ctx.textAlign = 'left';
  ctx.fillStyle = GOLD;
  ctx.font = `700 24px ${SANS}`;
  ctx.fillText(lines.eyebrow.toUpperCase(), x, 680);
  ctx.font = `600 68px ${SERIF}`;
  ctx.fillStyle = gold(ctx, 700, 840);
  wrap(ctx, lines.headline, maxW).slice(0, 2).forEach((l, i) => ctx.fillText(l, x, 760 + i * 70));
  const tt = fit(ctx, title, { font: (s) => `italic 500 ${s}px ${SERIF}`, max: 46, min: 30, maxW, maxLines: 2 });
  ctx.fillStyle = '#fbf0dc';
  tt.lines.forEach((l, i) => ctx.fillText(l, x, 930 + i * tt.size * 1.15));
  ctx.fillStyle = 'rgba(251,240,220,.7)';
  ctx.font = `600 26px ${SANS}`;
  if (name) ctx.fillText('by ' + name, x, 940 + tt.lines.length * tt.size * 1.15);
  // footer band
  ctx.strokeStyle = 'rgba(226,189,120,.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(70, 1150);
  ctx.lineTo(W - 70, 1150);
  ctx.stroke();
  logoDisc(ctx, logo, 140, 1245, 58);
  ctx.textAlign = 'left';
  ctx.fillStyle = GOLD;
  ctx.font = `700 26px ${SANS}`;
  ctx.fillText(lines.footer1.toUpperCase(), 230, 1228);
  ctx.fillStyle = '#fbf0dc';
  ctx.font = `italic 500 34px ${SERIF}`;
  ctx.fillText(lines.footer2, 230, 1276);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  ctx.strokeRect(22, 22, W - 44, H - 44);
  return c;
}

/* ---------- a framed photo of the hall ---------- */
export function framePhoto(shot, { logo, lines }) {
  const scale = Math.min(1, 2400 / shot.width);
  const W = Math.round(shot.width * scale), H = Math.round(shot.height * scale);
  const c = make(W, H);
  const ctx = c.getContext('2d');
  ctx.drawImage(shot, 0, 0, W, H);
  const u = Math.min(W, H) / 100;
  const band = ctx.createLinearGradient(0, H - u * 22, 0, H);
  band.addColorStop(0, 'rgba(10,6,17,0)');
  band.addColorStop(1, 'rgba(10,6,17,.85)');
  ctx.fillStyle = band;
  ctx.fillRect(0, H - u * 22, W, u * 22);
  ctx.strokeStyle = 'rgba(226,189,120,.85)';
  ctx.lineWidth = Math.max(2, u * 0.35);
  ctx.strokeRect(u * 2, u * 2, W - u * 4, H - u * 4);
  logoDisc(ctx, logo, u * 9, H - u * 9, u * 4.2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fbf0dc';
  ctx.font = `600 ${Math.round(u * 4.2)}px ${SERIF}`;
  ctx.fillText('The Virtual Book Fair', u * 15, H - u * 10.6);
  ctx.fillStyle = GOLD;
  ctx.font = `700 ${Math.round(u * 1.7)}px ${SANS}`;
  ctx.fillText(lines.left.toUpperCase(), u * 15.2, H - u * 6.4);
  ctx.textAlign = 'right';
  ctx.fillStyle = GOLD_HI;
  ctx.font = `italic 500 ${Math.round(u * 2.6)}px ${SERIF}`;
  ctx.fillText(lines.right, W - u * 5, H - u * 6.8);
  return c;
}

/* ---------- certificate for touring every booth ---------- */
export function makeCertificate({ name, count, total, covers, logo, lines, date }) {
  const W = 1600, H = 1131;
  const c = make(W, H);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(W * 0.5, H * 0.35, 50, W * 0.5, H * 0.5, W * 0.75);
  g.addColorStop(0, '#fffaf0');
  g.addColorStop(1, '#ecdfc6');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#b98a3e';
  ctx.lineWidth = 10;
  ctx.strokeRect(36, 36, W - 72, H - 72);
  ctx.lineWidth = 2;
  ctx.strokeRect(58, 58, W - 116, H - 116);
  [[58, 58], [W - 58, 58], [58, H - 58], [W - 58, H - 58]].forEach(([x, y]) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#b98a3e';
    ctx.fillRect(-12, -12, 24, 24);
    ctx.restore();
  });
  logoDisc(ctx, logo, W / 2, 160, 70);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#9a6b26';
  ctx.font = `700 26px ${SANS}`;
  spaced(ctx, 'CERTIFICATE OF EXPLORATION', W / 2, 290, 10);
  ctx.fillStyle = '#2a2030';
  ctx.font = `500 76px ${SERIF}`;
  ctx.fillText('The Virtual Book Fair', W / 2, 370);
  ctx.fillStyle = '#5c4a5e';
  ctx.font = `italic 500 38px ${SERIF}`;
  ctx.fillText('This certifies that', W / 2, 440);
  const n = fit(ctx, name || 'A curious reader', { font: (s) => `600 ${s}px ${SERIF}`, max: 112, min: 60, maxW: W * 0.7, maxLines: 1 });
  ctx.fillStyle = '#2a2030';
  ctx.fillText(n.lines[0], W / 2, 560);
  ornament(ctx, W / 2, 600, 640, '#b98a3e');
  const body = `visited all ${total} booths of the Virtual Book Fair and collected every stamp in the Fair Passport.`;
  const b = fit(ctx, count >= total ? body : `visited ${count} of ${total} booths of the Virtual Book Fair.`, { font: (s) => `500 ${s}px ${SERIF}`, max: 40, min: 30, maxW: W * 0.62, maxLines: 2 });
  ctx.fillStyle = '#3b2d3f';
  b.lines.forEach((l, i) => ctx.fillText(l, W / 2, 670 + i * b.size * 1.25));
  // a row of the covers
  const shown = covers.filter(Boolean);
  const cw = Math.min(72, (W * 0.74) / Math.max(1, shown.length) - 14), ch = cw * 1.5;
  let x = W / 2 - (shown.length * (cw + 14) - 14) / 2;
  shown.forEach((im) => {
    ctx.save();
    ctx.shadowColor = 'rgba(40,20,10,.35)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 5;
    coverImage(ctx, im, x, 780, cw, ch);
    ctx.restore();
    x += cw + 14;
  });
  ctx.fillStyle = '#5c4a5e';
  ctx.font = `600 22px ${SANS}`;
  ctx.textAlign = 'left';
  ctx.fillText(date, 150, 1005);
  ctx.textAlign = 'right';
  ctx.fillText('Your hosts, Life Coach Code', W - 150, 1005);
  ctx.strokeStyle = 'rgba(92,74,94,.5)';
  ctx.lineWidth = 1.5;
  [[150, 400], [W - 400, W - 150]].forEach(([a, z]) => { ctx.beginPath(); ctx.moveTo(a, 970); ctx.lineTo(z, 970); ctx.stroke(); });
  ctx.textAlign = 'center';
  ctx.fillStyle = '#9a6b26';
  ctx.font = `700 20px ${SANS}`;
  spaced(ctx, lines.footer.toUpperCase(), W / 2, 1065, 4);
  return c;
}

/* ---------- the intention written on a wishing lantern ---------- */
export function makeIntentionCard({ text, name, logo, lines }) {
  const W = 1080, H = 1350;
  const c = make(W, H);
  const ctx = c.getContext('2d');
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#120a22');
  sky.addColorStop(0.55, '#2a1438');
  sky.addColorStop(1, '#4a2236');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  // stars
  for (let i = 0; i < 160; i++) {
    const x = (Math.sin(i * 12.9898) * 43758.5453 % 1 + 1) % 1 * W, y = (Math.sin(i * 78.233) * 12543.21 % 1 + 1) % 1 * H * 0.7;
    ctx.fillStyle = `rgba(255,244,226,${0.25 + (i % 7) / 12})`;
    ctx.beginPath();
    ctx.arc(x, y, 1 + (i % 3) * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // the lantern, glowing
  const lx = W / 2, ly = 330;
  const halo = ctx.createRadialGradient(lx, ly, 10, lx, ly, 260);
  halo.addColorStop(0, 'rgba(255,190,110,.75)');
  halo.addColorStop(0.35, 'rgba(255,150,80,.25)');
  halo.addColorStop(1, 'rgba(255,150,80,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, 700);
  const body = ctx.createLinearGradient(lx - 70, 0, lx + 70, 0);
  body.addColorStop(0, '#e07b32');
  body.addColorStop(0.5, '#ffd08a');
  body.addColorStop(1, '#e07b32');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(lx - 62, ly - 95);
  ctx.lineTo(lx + 62, ly - 95);
  ctx.lineTo(lx + 82, ly + 95);
  ctx.lineTo(lx - 82, ly + 95);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#5a2a14';
  ctx.fillRect(lx - 66, ly - 104, 132, 12);
  ctx.fillStyle = 'rgba(255,240,200,.95)';
  ctx.beginPath();
  ctx.ellipse(lx, ly + 95, 82, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = GOLD;
  ctx.font = `700 26px ${SANS}`;
  spaced(ctx, 'A WISHING LANTERN', W / 2, 560, 9);
  const t = fit(ctx, `“${text}”`, { font: (s) => `italic 500 ${s}px ${SERIF}`, max: 78, min: 44, maxW: W * 0.78, maxLines: 5 });
  ctx.fillStyle = '#fbf0dc';
  const top = 680 + (5 - t.lines.length) * t.size * 0.5;
  t.lines.forEach((l, i) => ctx.fillText(l, W / 2, top + i * t.size * 1.22));
  ornament(ctx, W / 2, 1090, 420, GOLD);
  if (name) {
    ctx.fillStyle = GOLD_HI;
    ctx.font = `500 40px ${SERIF}`;
    ctx.fillText(name, W / 2, 1150);
  }
  logoDisc(ctx, logo, W / 2, 1222, 36);
  ctx.fillStyle = GOLD;
  ctx.font = `700 20px ${SANS}`;
  spaced(ctx, lines.footer.toUpperCase(), W / 2, 1300, 5);
  return c;
}

/* ---------- save or share an image ---------- */
export function toBlob(canvas, type = 'image/jpeg', q = 0.92) {
  return new Promise((res) => canvas.toBlob(res, type, q));
}
export async function saveImage(canvas, filename) {
  const blob = await toBlob(canvas);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
export async function shareImage(canvas, filename, { title, text, url }) {
  const blob = await toBlob(canvas);
  if (blob && navigator.canShare) {
    const file = new File([blob], filename, { type: 'image/jpeg' });
    if (navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title, text: `${text} ${url}` }); return 'shared'; } catch (e) { return e && e.name === 'AbortError' ? 'cancelled' : 'failed'; }
    }
  }
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); return 'shared'; } catch (e) { return 'cancelled'; }
  }
  return 'unsupported';
}
