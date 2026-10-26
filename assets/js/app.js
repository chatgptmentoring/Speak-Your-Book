/*
 * The Virtual Book Fair: page logic.
 * The 3D hall (world.js) is drawn on a canvas; everything you read is regular HTML layered on
 * top, so the fair still works (as a styled page) where WebGL is unavailable.
 */
import { createLive, EMOTES } from './live.js';
import * as K from './keepsakes.js';
import { createAmbience } from './ambience.js';
import { createGuide } from './guide.js';
import { createProgram, scoreQuiz } from './program.js';

const BOOKS = window.FAIR_BOOKS || [];
const QUIZ = window.FAIR_QUIZ || [];
const STORES = window.FAIR_STORES || [];
const LINKS = window.FAIR_LINKS || {};
const EVENT = window.FAIR_EVENT || null;
const CONTACT = window.FAIR_CONTACT || {};
const AUTHORS = window.FAIR_AUTHORS || [];
const authorById = Object.fromEntries(AUTHORS.map((a) => [a.id, a]));
const authorOfSlug = {};
AUTHORS.forEach((a) => a.books.forEach((s) => { authorOfSlug[s] = a; }));

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(pointer: fine)').matches;
const bySlug = Object.fromEntries(BOOKS.map((b) => [b.slug, b]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mod = (a, m) => ((a % m) + m) % m;
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const isSoon = (b) => b.status === 'coming-soon';
const authorName = (b) => b.displayAuthor || b.author;
const asset = window.FAIR_ASSET || ((p) => p);
const coverSrc = (b, size) => asset(`assets/img/covers/${b.slug}-${size}.webp`);
const pad2 = (n) => String(n).padStart(2, '0');
const initials = (name) => { const w = name.split(/\s+/).filter((x) => /^\p{Lu}/u.test(x)); return w.length ? w[0][0] + (w.length > 1 ? w[w.length - 1][0] : '') : ''; };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// an author's photo in a gold ring, or their initials until the photo arrives
const avatar = (a, sm) => a.photo
  ? `<img class="au__photo${sm ? ' au__mono--sm' : ''}" src="${esc(a.photo)}" alt="" loading="lazy">`
  : `<span class="au__mono${sm ? ' au__mono--sm' : ''}" aria-hidden="true">${esc(initials(a.name))}</span>`;
const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return Math.abs(h); };
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
};
const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const BASE_TITLE = document.title;

let world = null;
const LOGO = new Image();
LOGO.src = asset('assets/img/brand/logo-512.png');
const loadImg = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });

/* Analytics: a no-op unless FAIR_ANALYTICS.enabled (see README). Every action is also
   dispatched as a 'fair:track' event on window for any other tool to listen to. */
function track(name, props = {}) {
  try {
    window.dispatchEvent(new CustomEvent('fair:track', { detail: { name, props } }));
    if (!(window.FAIR_ANALYTICS || {}).enabled) return;
    if (typeof window.plausible === 'function') window.plausible(name, { props });
    if (typeof window.gtag === 'function') window.gtag('event', name, props);
  } catch (e) { /* analytics never breaks the fair */ }
}

/* Panels that pause walking while they are open */
const Overlays = new Set();
function overlayChanged() {
  if (world) world.setInputEnabled(!Overlays.size && !Detail.isOpen());
}
function makeSheet(id, { onOpen, onClose } = {}) {
  const el = document.getElementById(id);
  const panel = el.querySelector('.sheet__panel');
  let last = null;
  function open() {
    if (!el.hidden) { if (onOpen) onOpen(); return; }
    last = document.activeElement;
    el.hidden = false;
    Overlays.add(id);
    overlayChanged();
    if (onOpen) onOpen();
    panel.scrollTop = 0;
    setTimeout(() => { const c = el.querySelector('.sheet__close'); if (c) c.focus({ preventScroll: true }); }, 30);
  }
  function close() {
    if (el.hidden) return;
    el.hidden = true;
    Overlays.delete(id);
    overlayChanged();
    if (onClose) onClose();
    if (last && last.focus && document.contains(last) && last !== document.body) last.focus({ preventScroll: true });
  }
  el.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    if (e.key === 'Tab') trapFocus(e, panel);
  });
  return { el, open, close, isOpen: () => !el.hidden };
}

/* =========================================================================
   The live event: dates, countdown and every place that mentions it
   ========================================================================= */
const Program = createProgram(EVENT);
const EventInfo = (() => {
  if (!EVENT) return null;
  const [y, m, d] = EVENT.date.split('-').map(Number);
  const day = new Date(y, m - 1, d);
  const start = EVENT.start ? new Date(EVENT.start) : null;
  const ref = () => start || day;
  const fmt = (o) => ref().toLocaleDateString('en-GB', o);
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  function status(now = new Date()) {
    if (start) {
      const ms = start - now;
      if (ms > 0) {
        const days = Math.floor(ms / 864e5), hours = Math.floor((ms % 864e5) / 36e5), mins = Math.floor((ms % 36e5) / 6e4);
        if (days >= 2) return { phase: 'before', short: `in ${days} days`, count: `${days} days to go`, big: String(days), label: 'DAYS TO GO' };
        const h = days * 24 + hours;
        if (h >= 1) return { phase: 'soon', short: `in ${h} h ${mins} min`, count: `Starts in ${plural(h, 'hour')} ${mins} min`, big: `${h}h`, label: `${mins} MIN TO GO` };
        return { phase: 'soon', short: `in ${mins} min`, count: `Starts in ${plural(mins, 'minute')}`, big: String(mins), label: 'MINUTES TO GO' };
      }
      const lastEnd = Program.timed().reduce((m, s) => Math.max(m, +s.end), 0);
      if (now - start < 3 * 36e5 || now < lastEnd) return { phase: 'live', short: 'happening now', count: 'Happening now on Zoom', big: 'LIVE', label: 'HAPPENING NOW' };
      return { phase: 'after', short: '', count: '', big: 'THANK YOU', label: 'FOR JOINING US LIVE' };
    }
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dd = Math.round((day - today) / 864e5);
    if (dd >= 2) return { phase: 'before', short: `in ${dd} days`, count: `${dd} days to go`, big: String(dd), label: 'DAYS TO GO' };
    if (dd === 1) return { phase: 'before', short: 'tomorrow', count: 'Tomorrow', big: '1', label: 'DAY TO GO' };
    if (dd === 0) return { phase: 'today', short: 'today', count: 'Today', big: 'TODAY', label: 'LIVE ON ZOOM' };
    return { phase: 'after', short: '', count: '', big: 'THANK YOU', label: 'FOR JOINING US LIVE' };
  }
  return {
    status,
    upcoming: () => status().phase !== 'after',
    dateLong: () => fmt({ weekday: 'long', day: 'numeric', month: 'long' }),
    dateShort: () => fmt({ day: 'numeric', month: 'long' }),
    dayShort: () => fmt({ weekday: 'short', day: 'numeric', month: 'short' }),
    time: () => (start ? start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }) : ''),
    ics() {
      const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
      const escI = (t) => String(t).replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
      const when = start
        ? [`DTSTART:${start.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')}`]
        : [`DTSTART;VALUE=DATE:${EVENT.date.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${new Date(y, m - 1, d + 1).toLocaleDateString('sv').replace(/-/g, '')}`];
      return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Life Coach Code//Virtual Book Fair//EN', 'BEGIN:VEVENT',
        `UID:${EVENT.date}-speak-your-book@lifecoachcode.com`, `DTSTAMP:${stamp}`, ...when,
        `SUMMARY:${escI(`${EVENT.name} (${EVENT.where})`)}`,
        ...(EVENT.stream && EVENT.stream.zoom ? [`LOCATION:${escI(EVENT.stream.zoom)}`] : []),
        `DESCRIPTION:${escI(`${EVENT.about}\n${EVENT.stream && EVENT.stream.zoom ? `Join on Zoom: ${EVENT.stream.zoom}\n` : ''}Register free: ${EVENT.register}\nThe Virtual Book Fair: ${location.origin + location.pathname}`)}`,
        `URL:${EVENT.register}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    }
  };
})();
const ZOOM = EVENT && EVENT.stream && EVENT.stream.zoom;
const ZOOM_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="6" width="13" height="12" rx="3" fill="currentColor"/><path d="M16.5 10.5l5-3v9l-5-3z" fill="currentColor"/></svg>';
const isEventDay = () => !!EventInfo && ['today', 'soon', 'live'].includes(EventInfo.status().phase);
function eventCta() {
  if (!EventInfo || !EventInfo.upcoming()) return `<a class="btn btn--gold" href="${LINKS.discovery}" target="_blank" rel="noopener">Speak your own book</a>`;
  const join = ZOOM ? `<a class="btn ${isEventDay() ? 'btn--gold' : 'btn--ghost'} btn--zoom" data-zoom href="${esc(ZOOM)}" target="_blank" rel="noopener">${ZOOM_ICON} Join on Zoom</a>` : '';
  const reg = `<a class="btn ${isEventDay() ? 'btn--ghost' : 'btn--gold'}" data-event-register href="${esc(EVENT.register)}" target="_blank" rel="noopener">Register free</a>`;
  return isEventDay() ? join + reg : reg + join;
}
const eventLine = () => (EventInfo && EventInfo.upcoming() ? `Speaking live at ${EVENT.name} · ${EventInfo.dateLong()}, free on Zoom` : `Spoke live at ${EVENT ? EVENT.name : 'the fair'}`);

/* =========================================================================
   Sound: generative ambient pad, distant bells and soft UI sounds
   ========================================================================= */
const Sound = (() => {
  const KEY = 'lcc-fair-sound';
  let ctx = null, master, dry, verb, padBus, on = false, chordIdx = 0, chordTimer = 0, chimeTimer = 0, lastHover = 0;
  const CHORDS = [[50, 57, 62, 66, 69, 76], [47, 54, 59, 62, 66, 74], [43, 50, 55, 59, 62, 69], [45, 52, 57, 61, 64, 71]];
  const BELL = [74, 76, 78, 81, 83, 86, 88, 90, 93];
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const listeners = [];

  function impulse(sec, decay) {
    const rate = ctx.sampleRate, len = Math.floor(rate * sec), buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }
  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    master.connect(comp);
    comp.connect(ctx.destination);
    verb = ctx.createConvolver();
    verb.buffer = impulse(4, 2.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.6;
    verb.connect(wet);
    wet.connect(master);
    dry = ctx.createGain();
    dry.gain.value = 0.55;
    dry.connect(master);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1100;
    lp.Q.value = 0.4;
    padBus = ctx.createGain();
    padBus.connect(lp);
    lp.connect(dry);
    lp.connect(verb);
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain();
    lfo.frequency.value = 0.045;
    lfoG.gain.value = 420;
    lfo.connect(lfoG);
    lfoG.connect(lp.frequency);
    lfo.start();
    return true;
  }
  function pad() {
    if (!on) return;
    const notes = CHORDS[chordIdx++ % CHORDS.length], t = ctx.currentTime, dur = 11;
    notes.forEach((m, j) => {
      [-5, 5].forEach((det, k) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = k ? 'triangle' : 'sine';
        o.frequency.value = mtof(m);
        o.detune.value = det;
        const peak = (j === 0 ? 0.05 : 0.028) / (k ? 2.2 : 1);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(peak, t + 3.5);
        g.gain.setValueAtTime(peak, t + dur - 4);
        g.gain.linearRampToValueAtTime(0, t + dur);
        o.connect(g);
        g.connect(padBus);
        o.start(t);
        o.stop(t + dur + 0.1);
      });
    });
    chordTimer = setTimeout(pad, (dur - 3.5) * 1000);
  }
  function bell(m, vel = 1, when = 0) {
    if (!ctx || !on) return;
    const t = ctx.currentTime + when, f = mtof(m);
    [[1, 1, 2.6], [2.76, 0.22, 1.1], [5.4, 0.07, 0.5]].forEach(([mul, amp, dec]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f * mul;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.06 * vel * amp, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      o.connect(g);
      g.connect(dry);
      g.connect(verb);
      o.start(t);
      o.stop(t + dec + 0.05);
    });
  }
  function swish(vel = 1) {
    if (!ctx || !on) return;
    const t = ctx.currentTime, len = 0.6;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(700, t);
    bp.frequency.exponentialRampToValueAtTime(2600, t + len);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.045 * vel, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(bp);
    bp.connect(g);
    g.connect(dry);
    g.connect(verb);
    src.start(t);
  }
  function thump() {
    if (!ctx || !on) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.25);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g);
    g.connect(dry);
    o.start(t);
    o.stop(t + 0.4);
  }
  function click(when = 0) {
    if (!ctx || !on) return;
    const t = ctx.currentTime + when, len = 0.05;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = buf;
    bp.type = 'bandpass';
    bp.frequency.value = 2600;
    g.gain.value = 0.5;
    src.connect(bp);
    bp.connect(g);
    g.connect(dry);
    src.start(t);
  }
  function chimes() {
    if (!on) return;
    if (Math.random() < 0.8) bell(BELL[Math.floor(Math.random() * BELL.length)], 0.3 + Math.random() * 0.3);
    chimeTimer = setTimeout(chimes, 2600 + Math.random() * 4200);
  }
  const sounds = {
    step: () => { swish(0.45); bell(BELL[Math.floor(Math.random() * 5)], 0.2); },
    open: () => { [0, 2, 4].forEach((k, i) => bell(BELL[k], 0.5, i * 0.09)); swish(0.7); },
    flip: () => [1, 2, 3, 4, 5, 6].forEach((k, i) => bell(BELL[k], 0.32, i * 0.06)),
    stamp: () => { thump(); bell(BELL[2], 0.5, 0.05); },
    hover: () => { const now = performance.now(); if (now - lastHover < 160) return; lastHover = now; bell(BELL[3 + Math.floor(Math.random() * 5)], 0.12); },
    win: () => [0, 2, 4, 5, 7, 8].forEach((k, i) => bell(BELL[k], 0.55, i * 0.12)),
    shutter: () => { click(0); click(0.09); },
    pop: () => bell(BELL[5 + Math.floor(Math.random() * 3)], 0.3),
    wave: () => [3, 5, 7].forEach((k, i) => bell(BELL[k], 0.35, i * 0.08))
  };
  // the spatial soundscape of the booths (ambience.js), only while sound is on
  let amb = null, ambTimer = 0, anchors = null;
  function startAmbience() {
    if (!world || !ctx || amb === false) return;
    if (!amb) {
      try {
        const out = ctx.createGain();
        out.connect(dry);
        const send = ctx.createGain();
        send.gain.value = 0.35;
        out.connect(send);
        send.connect(verb);
        amb = createAmbience(ctx, out, { hrtf: finePointer });
        anchors = world.soundAnchors();
      } catch (e) { amb = false; return; }
    }
    clearInterval(ambTimer);
    ambTimer = setInterval(() => { if (on && world && !document.hidden) amb.update(world.listener(), anchors); }, 150);
  }
  function stopAmbience() { clearInterval(ambTimer); if (amb) amb.stopAll(); }
  function play(name) { if (on && sounds[name]) { try { sounds[name](); } catch (e) { /* decorative */ } } }
  function notify() { listeners.forEach((fn) => fn(on)); }
  function enable() {
    if (!ctx && !build()) return;
    if (ctx.state === 'suspended') ctx.resume();
    store.set(KEY, true);
    if (on) return;
    on = true;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(0.9, t + 2.5);
    pad();
    chimeTimer = setTimeout(chimes, 2500);
    startAmbience();
    notify();
  }
  function disable() {
    store.set(KEY, false);
    if (!on) { notify(); return; }
    on = false;
    clearTimeout(chordTimer);
    clearTimeout(chimeTimer);
    stopAmbience();
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(0, t + 0.8);
    notify();
  }
  function toggle() { if (on) disable(); else enable(); }
  function init() {
    document.addEventListener('visibilitychange', () => {
      if (!ctx || !on) return;
      if (document.hidden) ctx.suspend(); else ctx.resume();
    });
    // A remembered "music on" can only start after the visitor's first gesture.
    if (store.get(KEY, false)) {
      const go = (e) => {
        if (e.target.closest && e.target.closest('#sound-btn, #music-pill')) return;
        window.removeEventListener('pointerdown', go, true);
        window.removeEventListener('keydown', go, true);
        enable();
      };
      window.addEventListener('pointerdown', go, true);
      window.addEventListener('keydown', go, true);
    }
  }
  return { init, toggle, play, onChange: (fn) => listeners.push(fn), isOn: () => on, worldReady: () => { if (on) startAmbience(); } };
})();

/* =========================================================================
   Toasts + petals
   ========================================================================= */
function toast(html, ms = 3200, action = null) {
  const wrap = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = html;
  if (action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'toast__act';
    b.textContent = action.label;
    b.addEventListener('click', () => { action.fn(); el.remove(); });
    el.appendChild(b);
    el.classList.add('toast--action');
  }
  wrap.appendChild(el);
  setTimeout(() => { el.classList.add('is-leaving'); setTimeout(() => el.remove(), 500); }, ms);
}

const Petals = (() => {
  const c = $('#petals');
  let ctx, parts = [], raf = 0, W = 0, H = 0;
  const COLORS = ['#f7e1b0', '#e2bd78', '#f2b8c6', '#fff4e2', '#d39450', '#c792e0'];
  function frame() {
    ctx.clearRect(0, 0, W, H);
    let alive = 0;
    parts.forEach((p) => {
      p.sway += 0.03;
      p.x += p.vx + Math.sin(p.sway) * 0.8;
      p.y += p.vy;
      p.rot += p.vr;
      if (p.y < H + 30) alive++;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(Math.cos(p.sway * 1.3), 1);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    if (alive) raf = requestAnimationFrame(frame);
    else { c.classList.remove('is-active'); ctx.clearRect(0, 0, W, H); }
  }
  function burst() {
    if (reduceMotion) return;
    ctx = ctx || c.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    c.width = W * dpr;
    c.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    parts = Array.from({ length: 170 }, (_, i) => ({
      x: Math.random() * W, y: -20 - Math.random() * H * 0.7,
      vx: (Math.random() - 0.5) * 1.2, vy: 1.2 + Math.random() * 2.2,
      r: 4 + Math.random() * 7, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.12,
      sway: Math.random() * 6.28, color: COLORS[i % COLORS.length]
    }));
    c.classList.add('is-active');
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }
  return { burst };
})();

function trapFocus(e, root) {
  const f = $$('a[href], button:not([disabled]), select, input, [tabindex]:not([tabindex="-1"])', root).filter((x) => x.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

/* =========================================================================
   Passport
   ========================================================================= */
const Passport = (() => {
  const KEY = 'lcc-fair-passport-v1';
  const el = $('#passport'), btn = $('#passport-btn'), count = $('#passport-count');
  const list = $('#passport-stamps'), status = $('#passport-status'), reward = $('#passport-reward');
  const INKS = ['#8c1d2e', '#1f4e79', '#6b2f6b', '#2f5d3a', '#7a4a12', '#14505c'];
  const got = (store.get(KEY, []) || []).filter((s) => bySlug[s]);
  let fresh = null, lastFocus = null;
  const has = (slug) => got.includes(slug);
  const updateCount = () => { count.textContent = `${got.length}/${BOOKS.length}`; };
  const seal = (i) => `<svg viewBox="0 0 120 120" aria-hidden="true"><defs><path id="seal-path-${i}" d="M60,60 m-45,0 a45,45 0 1,1 90,0 a45,45 0 1,1 -90,0"/></defs>
    <circle cx="60" cy="60" r="57" fill="none" stroke="currentColor" stroke-width="2.5"/><circle cx="60" cy="60" r="36" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text font-size="8.6" font-weight="700" fill="currentColor" font-family="Manrope, sans-serif"><textPath href="#seal-path-${i}" textLength="278" lengthAdjust="spacing">VIRTUAL BOOK FAIR ✦ LIFE COACH CODE ✦</textPath></text></svg>`;
  function render() {
    list.innerHTML = BOOKS.map((b, i) => {
      const c = has(b.slug);
      const rot = (hashStr(b.slug) % 22) - 11;
      return `<li class="stamp${c ? ' is-collected' : ''}${fresh === b.slug ? ' is-new' : ''}" style="--rot:${rot}deg;--ink-color:${INKS[i % INKS.length]}">
        <button class="stamp__seal" type="button" data-slug="${b.slug}" aria-label="${c ? 'Stamp collected' : 'Not visited yet'}: ${esc(b.title)}. Open the booth">
        ${c ? seal(i) + `<img src="${coverSrc(b, 480)}" alt="" loading="lazy">` : '<span aria-hidden="true">?</span>'}</button>
        <span class="stamp__label">${esc(b.title)}</span></li>`;
    }).join('');
    const left = BOOKS.length - got.length;
    status.textContent = got.length === 0
      ? 'Your passport is empty. Open a booth to collect your first stamp.'
      : left === 0 ? 'Every stamp collected. Thank you for touring the whole fair!'
        : `${got.length} of ${BOOKS.length} stamps collected. ${left} ${left === 1 ? 'booth' : 'booths'} to go.`;
    reward.hidden = left !== 0;
  }
  function open() {
    lastFocus = document.activeElement;
    render();
    el.hidden = false;
    Overlays.add('passport');
    overlayChanged();
    setTimeout(() => $('.passport__close', el).focus({ preventScroll: true }), 30);
  }
  function close() {
    el.hidden = true;
    fresh = null;
    Overlays.delete('passport');
    overlayChanged();
    if (lastFocus && lastFocus.focus && lastFocus !== document.body) lastFocus.focus({ preventScroll: true });
  }
  function stamp(slug) {
    if (has(slug)) return;
    got.push(slug);
    store.set(KEY, got);
    fresh = slug;
    updateCount();
    btn.classList.remove('is-bump');
    void btn.offsetWidth;
    btn.classList.add('is-bump');
    Sound.play('stamp');
    toast(`<i>✓</i> Passport stamp collected · ${got.length} of ${BOOKS.length}`);
    if (got.length === BOOKS.length) {
      track('passport_complete');
      setTimeout(() => { Petals.burst(); Sound.play('win'); open(); }, 1500);
    }
  }
  async function certificate(name) {
    const covers = await Promise.all(BOOKS.map((b) => (has(b.slug) ? loadImg(coverSrc(b, 480)) : null)));
    const c = K.makeCertificate({
      name, count: got.length, total: BOOKS.length, covers, logo: LOGO,
      lines: { footer: EventInfo && EventInfo.upcoming() ? `Meet the authors live · ${EVENT.name} · ${EventInfo.dateLong()} · free on Zoom` : 'The Virtual Book Fair · Life Coach Code' },
      date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    });
    Keepsake.show(c, { eyebrow: 'Your Fair Passport', title: 'Your certificate', filename: 'virtual-book-fair-certificate.jpg', text: 'I toured every booth of the Virtual Book Fair.' });
    track('certificate');
  }
  function init() {
    updateCount();
    btn.addEventListener('click', open);
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) { close(); return; }
      const s = e.target.closest('[data-slug]');
      if (s) { close(); Detail.open(s.getAttribute('data-slug')); }
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
      if (e.key === 'Tab') trapFocus(e, $('.passport__book', el));
    });
    $('#cert-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('#cert-name').value.trim().slice(0, 40) || People.myName();
      certificate(name);
    });
  }
  return { init, open, stamp, has, count: () => got.length, isOpen: () => !el.hidden };
})();

/* =========================================================================
   Context cards: the card for the part of the fair you are standing in
   ========================================================================= */
function buildBookChapters() {
  const anchor = $('#speak');
  BOOKS.forEach((b, k) => {
    const soon = isSoon(b);
    const s = document.createElement('section');
    s.className = 'chapter chapter--book';
    s.id = 'book-' + b.slug;
    s.setAttribute('aria-labelledby', 'title-' + b.slug);
    s.innerHTML = `<article class="card card--book">
      <p class="card__count">Booth ${pad2(k + 1)} <i></i> ${pad2(BOOKS.length)}</p>
      <img class="card__cover" src="${coverSrc(b, 480)}" alt="Cover of ${esc(b.title)}" loading="lazy" width="480" height="${Math.round(480 * b.cover.h / b.cover.w)}">
      <p class="card__tags">${soon ? '<span class="soon-dot">● Coming soon</span> · ' : ''}${b.tags.map(esc).join(' · ')}</p>
      <h2 class="card__title" id="title-${b.slug}">${esc(b.title)}</h2>
      <p class="card__subtitle">${esc(b.subtitle)}</p>
      <p class="card__author">by <b>${esc(authorName(b))}</b>${b.credentials ? ', ' + esc(b.credentials) : ''}</p>
      <p class="card__hook">${esc(b.hook)}</p>
      ${b.steps ? `<ol class="card__steps">${b.steps.items.map((st, i) => `<li><span>${i + 1}</span>${esc(st.name)}</li>`).join('')}</ol>` : ''}
      <div class="card__actions">
        <button class="btn btn--gold" type="button" data-open="${b.slug}">${soon ? 'Peek inside the booth' : 'Open the book'}</button>
        ${soon
          ? `<a class="btn btn--ghost" href="${LINKS.discovery}" target="_blank" rel="noopener">Your book could be next ${ARROW}</a>`
          : `<a class="btn btn--ghost" href="${esc(b.amazon.url)}" target="_blank" rel="noopener">Buy on Amazon ${ARROW}</a>`}
      </div>
    </article>`;
    anchor.parentNode.insertBefore(s, anchor);
  });
}

const Context = (() => {
  const tour = $('#tour');
  let current = null;
  function show(id) {
    if (!id || id === current) return;
    const next = document.getElementById(id);
    if (!next || !next.classList.contains('chapter')) return;
    current = id;
    $$('.chapter.is-active', tour).forEach((c) => c.classList.remove('is-active'));
    next.classList.add('is-active');
    const card = $('.card', next);
    if (card) card.scrollTop = 0;
    tour.classList.remove('is-expanded');
  }
  function expand() {
    tour.classList.add('is-expanded');
    const c = current && document.getElementById(current);
    if (c) { c.classList.remove('is-pulse'); void c.offsetWidth; c.classList.add('is-pulse'); }
  }
  function init() {
    $$('.chapter', tour).forEach((c) => {
      const card = $('.card', c);
      if (!card) return;
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'card__more';
      more.innerHTML = '<span class="m-open">Read more</span><span class="m-close">Show less</span>';
      more.addEventListener('click', () => tour.classList.toggle('is-expanded'));
      card.appendChild(more);
    });
  }
  return { init, show, expand, current: () => current };
})();

/* =========================================================================
   Booth detail: the camera flies in, the book lifts and opens
   ========================================================================= */
const Detail = (() => {
  const el = $('#detail'), panel = $('#detail-panel'), body = $('#detail-body'), countEl = $('#detail-count');
  let current = null, lastFocus = null, pushed = false, closeTimer = 0;
  const slugFromHash = () => { const m = location.hash.match(/^#booth\/([a-z0-9-]+)/i); return m && bySlug[m[1]] ? m[1] : null; };

  function storeLinks(b) {
    let host = '';
    try { host = new URL(b.amazon.url).hostname.replace(/^www\.amazon\./, ''); } catch (e) { /* keep empty */ }
    return STORES.filter((s) => s.tld !== host)
      .map((s) => `<a href="https://www.amazon.${s.tld}/dp/${b.amazon.asin}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join('');
  }

  // Visual first: a short header, the actions, then swipeable cards. The long description waits behind "Read more".
  function html(b) {
    const soon = isSoon(b);
    const more = BOOKS.filter((x) => x.author === b.author && x !== b);
    const au = authorOfSlug[b.slug];
    const stand = (window.FAIR_STANDS || {})[b.slug];
    const first = (t) => (String(t).match(/^.*?[.!?](\s|$)/) || [t])[0].trim();
    const slides = [`<div class="slide slide--hook"><span class="slide__k">The heart of it</span><blockquote>${esc(b.hook)}</blockquote></div>`];
    slides.push(`<div class="slide"><span class="slide__k">Inside</span><ol class="slide__list">${b.inside.map((x, i) => `<li><i>${i + 1}</i><span>${esc(x)}</span></li>`).join('')}</ol></div>`);
    if (b.steps) slides.push(`<div class="slide"><span class="slide__k">${esc(b.steps.title)}</span><ol class="slide__steps">${b.steps.items.map((st, i) => `<li><i>${i + 1}</i><b>${esc(st.name)}</b><small>${esc(first(st.text))}</small></li>`).join('')}</ol></div>`);
    slides.push(`<div class="slide slide--for"><span class="slide__k">Perfect for</span><p>${esc(b.forWho)}</p></div>`);
    if (stand) slides.push(`<div class="slide slide--stand"><span class="slide__k">At the booth</span><p>${esc(stand)}</p></div>`);
    (b.testimonials || []).forEach((t) => slides.push(`<div class="slide slide--hook"><span class="slide__k">A reader says</span><blockquote>${esc(t.quote)}</blockquote>${t.name ? `<cite>${esc(t.name)}</cite>` : ''}</div>`));
    let h = `<img class="detail__cover" src="${coverSrc(b, 800)}" alt="Cover of ${esc(b.title)}">
      <div class="bi__meta">${soon ? `<span class="badge--soon">${b.workingTitle ? 'Working title · coming soon' : 'Coming soon'}</span>` : ''}${b.coverPending ? '<span class="tag">Cover reveal soon</span>' : ''}${b.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
      <h2 class="bi__title" id="detail-title">${esc(b.title)}</h2>
      <p class="bi__subtitle">${esc(b.subtitle)}</p>
      <div class="bi__look" data-look>
        <button class="icon-btn" type="button" data-page="-1" aria-label="Previous pages"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <span><b>Look inside</b><small data-page-label>Turn the pages, or click the book</small></span>
        <button class="icon-btn" type="button" data-page="1" aria-label="Next pages"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      </div>
      <div class="bi__buy">${soon
        ? `<a class="btn btn--gold" href="${LINKS.discovery}" target="_blank" rel="noopener">Your book could be next ${ARROW}</a>`
        : `<a class="btn btn--gold" href="${esc(b.amazon.url)}" target="_blank" rel="noopener">Buy on ${esc(b.amazon.store)} ${ARROW}</a>`}
        <button class="btn btn--ghost btn--sm" type="button" data-share>Share</button></div>
      <div class="slider" data-slider>
        <div class="slider__track">${slides.join('')}</div>
        <div class="slider__dots">${slides.map((_, i) => `<button type="button" aria-label="Card ${i + 1} of ${slides.length}"${i ? '' : ' aria-current="true"'} data-dot="${i}"></button>`).join('')}</div>
      </div>`;
    if (au) h += authorCard(au);
    h += `<details class="bi__more-text"><summary>Read more about this book</summary>${b.description.map((p) => `<p class="bi__desc">${esc(p)}</p>`).join('')}
      ${soon ? '' : `<p class="bi__stores"><span>Other Amazon stores:</span>${storeLinks(b)}</p>`}</details>`;
    if (more.length) {
      h += `<div class="bi__more"><h3 class="bi__h">More from ${esc(b.author)}</h3><div class="bi__more-list">${more.map((x) =>
        `<button type="button" data-goto="${x.slug}" aria-label="Visit the booth for ${esc(x.title)}"><img src="${coverSrc(x, 480)}" alt="" loading="lazy"></button>`).join('')}</div></div>`;
    }
    h += '<p class="bi__stamp"><i aria-hidden="true">✓</i> Passport stamp collected</p>';
    return h;
  }
  function authorCard(au) {
    const here = People.isOnline(au.id);
    return `<div class="bi__meet${here ? ' is-online' : ''}">
      ${avatar(au, true)}
      <span class="bi__meet-text"><b>${esc(au.displayName)}</b><small>${here ? '● At the fair right now' : EventInfo && EventInfo.upcoming() ? `Speaking live · ${esc(EventInfo.dayShort())}` : 'Author'}</small></span>
      <button class="btn btn--ghost btn--sm" type="button" data-author="${au.id}">Meet</button>
      ${au.inbox ? `<button class="icon-btn" type="button" data-author-msg="${au.id}" aria-label="Send ${esc(au.displayName)} a message">✉</button>` : ''}</div>`;
  }
  function bindSlider(root) {
    const sl = $('[data-slider]', root);
    if (!sl) return;
    const track = $('.slider__track', sl), dots = $$('[data-dot]', sl);
    const sync = () => {
      const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth * 0.86));
      dots.forEach((d, k) => d.toggleAttribute('aria-current', k === Math.min(i, dots.length - 1)));
    };
    track.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
    dots.forEach((d) => d.addEventListener('click', () => {
      const k = +d.dataset.dot;
      const slide = track.children[k];
      if (slide) track.scrollTo({ left: slide.offsetLeft - track.offsetLeft, behavior: reduceMotion ? 'auto' : 'smooth' });
    }));
  }

  function show(slug) {
    const b = bySlug[slug];
    if (!b) return;
    clearTimeout(closeTimer);
    if (!current) {
      lastFocus = document.activeElement;
      el.hidden = false;
      document.documentElement.classList.add('is-focused');
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-open')));
      if (world) world.setInputEnabled(false);
    }
    if (current === b) return;
    current = b;
    body.innerHTML = html(b);
    bindSlider(body);
    panel.scrollTop = 0;
    countEl.textContent = `Booth ${pad2(BOOKS.indexOf(b) + 1)} of ${pad2(BOOKS.length)}`;
    if (world) world.focus(slug);
    Context.show('book-' + slug);
    Sound.play('open');
    Passport.stamp(slug);
    document.title = `${b.title} · The Virtual Book Fair`;
    track('booth_open', { slug });
    setTimeout(() => { const x = $('.detail__close', el); if (x) x.focus({ preventScroll: true }); }, 60);
  }
  function pageChanged(r) {
    const l = $('[data-page-label]', el);
    if (!l || !r) return;
    l.textContent = r.spread === 0 ? 'Title page' : `Pages ${r.spread * 2} to ${r.spread * 2 + 1} of ${r.spreads * 2 - 1}`;
    $$('[data-page]', el).forEach((btn) => { const d = +btn.getAttribute('data-page'); btn.disabled = (d < 0 && r.spread === 0) || (d > 0 && r.spread >= r.spreads - 1); });
    Sound.play('flip');
  }
  function hide() {
    if (!current) return;
    current = null;
    el.classList.remove('is-open');
    document.documentElement.classList.remove('is-focused');
    if (world) world.focus(null);
    overlayChanged();
    document.title = BASE_TITLE;
    closeTimer = setTimeout(() => { el.hidden = true; body.innerHTML = ''; }, 700);
    if (lastFocus && lastFocus.focus && document.contains(lastFocus) && lastFocus !== document.body) lastFocus.focus({ preventScroll: true });
    else document.activeElement && document.activeElement.blur && document.activeElement.blur();
  }
  function open(slug) {
    if (!bySlug[slug]) return;
    if (slugFromHash() === slug) { show(slug); return; }
    if (current) { history.replaceState(null, '', '#booth/' + slug); show(slug); return; }
    pushed = true;
    location.hash = 'booth/' + slug;
  }
  function close() {
    if (slugFromHash()) {
      if (pushed) { pushed = false; history.back(); return; }
      history.replaceState(null, '', location.pathname + location.search);
    }
    hide();
  }
  function step(d) {
    if (!current) return;
    const b = BOOKS[mod(BOOKS.indexOf(current) + d, BOOKS.length)];
    history.replaceState(null, '', '#booth/' + b.slug);
    show(b.slug);
  }
  function sync() {
    const s = slugFromHash();
    if (s) show(s);
    else if (current) hide();
  }
  function share() {
    if (!current) return;
    const url = location.href.split('#')[0] + '#booth/' + current.slug;
    const data = { title: `${current.title} by ${authorName(current)}`, text: current.hook, url };
    if (navigator.share) navigator.share(data).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => toast('<i>↗</i> Link copied. Share it with someone who needs this book'));
    else window.prompt('Copy this link', url);
  }
  function init() {
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) { close(); return; }
      const g = e.target.closest('[data-goto]');
      if (g) { const s = g.getAttribute('data-goto'); history.replaceState(null, '', '#booth/' + s); show(s); return; }
      if (e.target.closest('[data-share]')) share();
      const pg = e.target.closest('[data-page]');
      if (pg && world) world.turnPage(+pg.getAttribute('data-page'));
      const au = e.target.closest('[data-author]');
      if (au) AuthorPanel.open(au.getAttribute('data-author'));
      const am = e.target.closest('[data-author-msg]');
      if (am) AuthorPanel.open(am.getAttribute('data-author-msg'), { message: true });
    });
    $('#detail-prev').addEventListener('click', () => step(-1));
    $('#detail-next').addEventListener('click', () => step(1));
    document.addEventListener('keydown', (e) => {
      if (!current || Overlays.size) return;
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'Tab' && el.contains(document.activeElement)) { trapFocus(e, panel); return; }
      if (e.target.closest && e.target.closest('a, input, select, textarea')) return;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') step(1);
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') step(-1);
      if (world && (e.key === ']' || e.key === 'PageDown')) world.turnPage(1);
      if (world && (e.key === '[' || e.key === 'PageUp')) world.turnPage(-1);
    });
    window.addEventListener('hashchange', sync);
  }
  return { init, open, close, sync, pageChanged, isOpen: () => !!current, current: () => current };
})();

/* =========================================================================
   Map: jump to any place in the fair
   ========================================================================= */
const MapPanel = (() => {
  const el = $('#map'), list = $('#map-list');
  let lastFocus = null;
  const GROUPS = [
    { title: 'Entrance & hall', ids: ['welcome', 'hall', 'oracle'] },
    { title: 'The booths', books: true },
    { title: 'The stage & the temple', ids: ['speak', 'about', 'finale'] }
  ];
  const LABELS = { welcome: 'Entrance arch', hall: 'The Grand Hall', oracle: 'The Book Oracle', speak: 'Speak Your Book stage', about: 'Temple of Life Coach Code', finale: 'Your book here' };
  function render() {
    list.innerHTML = GROUPS.map((g) => {
      const items = g.books
        ? BOOKS.map((b, i) => `<li><button type="button" class="map__book" data-place="book-${b.slug}"><img src="${coverSrc(b, 480)}" alt="" loading="lazy"><span><small>Booth ${pad2(i + 1)}${isSoon(b) ? ' · coming soon' : ''}${People.isOnline(authorOfSlug[b.slug] && authorOfSlug[b.slug].id) ? ' · <em>author here now</em>' : ''}</small>${esc(b.title)}</span>${Passport.has(b.slug) ? '<i class="map__stamp" aria-label="stamp collected">✓</i>' : ''}</button></li>`).join('')
        : g.ids.map((id) => `<li><button type="button" class="map__place" data-place="${id}">${esc(LABELS[id])}</button></li>`).join('');
      return `<div class="map__group"><h3>${esc(g.title)}</h3><ul class="${g.books ? 'map__books' : 'map__places'}">${items}</ul></div>`;
    }).join('');
  }
  function open() {
    lastFocus = document.activeElement;
    render();
    el.hidden = false;
    Overlays.add('map');
    overlayChanged();
    setTimeout(() => { const b = $('.map__close', el); if (b) b.focus({ preventScroll: true }); }, 30);
  }
  function close() {
    el.hidden = true;
    Overlays.delete('map');
    overlayChanged();
    if (lastFocus && lastFocus.focus && lastFocus !== document.body) lastFocus.focus({ preventScroll: true });
  }
  function init() {
    $('#map-btn').addEventListener('click', () => (el.hidden ? open() : close()));
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) { close(); return; }
      const p = e.target.closest('[data-place]');
      if (p) { close(); goPlace(p.getAttribute('data-place')); }
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'm' || e.key === 'M') { e.stopPropagation(); close(); }
      if (e.key === 'Tab') trapFocus(e, $('.map__panel', el));
    });
  }
  return { init, open, close, isOpen: () => !el.hidden };
})();

function goPlace(id) {
  if (Detail.isOpen()) Detail.close();
  if (world) world.travelTo(id);
  else { const s = document.getElementById(id); if (s) s.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }); }
  Context.show(id);
}

/* =========================================================================
   Interacting with things in the hall (E key, action button, click/tap)
   ========================================================================= */
const ACTION_LABELS = {
  book: (info) => ({ verb: isSoon(bySlug[info.slug]) ? 'Peek inside' : 'Open the book', what: bySlug[info.slug].title }),
  oracle: () => ({ verb: 'Ask the Oracle', what: 'The Book Oracle' }),
  stage: () => ({ verb: 'Speak into the microphone', what: 'Speak Your Book' }),
  temple: (info) => ({ verb: 'Read the pillar', what: info.pillar }),
  ghost: () => ({ verb: Creator.has() ? 'Your book' : 'Claim this pedestal', what: Creator.has() ? Creator.title() : 'Your book here' }),
  crest: () => ({ verb: 'Meet your hosts', what: 'Life Coach Code' }),
  event: () => (EventInfo && EventInfo.upcoming() ? { verb: 'See the live event', what: `${EVENT.name} · ${EventInfo.dayShort()}` } : { verb: 'Speak your own book', what: 'Free discovery call' }),
  author: (info) => ({ verb: People.isOnline(info.id) ? 'Say hello' : 'Meet the author', what: authorById[info.id] ? authorById[info.id].displayName : '' }),
  seat: () => ({ verb: 'Take a seat', what: 'Front row for the live event' }),
  peer: (info) => ({ verb: info.author ? 'Say hello' : 'Wave hello', what: info.author ? `${info.author.name} · Author` : (info.name || 'A visitor') })
};

function interact(info) {
  if (!info) return;
  switch (info.kind) {
    case 'book': Detail.open(info.slug); break;
    case 'oracle':
      Context.show('oracle');
      Context.expand();
      Sound.play('flip');
      setTimeout(Oracle.focus, 200);
      break;
    case 'stage':
      if (world) world.pulse('stage');
      Context.show('speak');
      Context.expand();
      Sound.play('flip');
      toast('<i>♪</i> Your voice becomes words. Your words become a book.');
      break;
    case 'temple':
      Context.show('about');
      Context.expand();
      Sound.play('open');
      break;
    case 'ghost':
      Context.show('finale');
      Context.expand();
      Sound.play('win');
      if (!Creator.has()) Petals.burst();
      break;
    case 'crest':
      Context.show('about');
      Context.expand();
      Sound.play('open');
      break;
    case 'event':
      if (EventInfo && EventInfo.upcoming()) EventUI.open();
      else window.open(LINKS.discovery, '_blank', 'noopener');
      break;
    case 'author':
      AuthorPanel.open(info.id);
      break;
    case 'seat':
      if (world) world.sit(info.index >= 0 ? info.index : 0);
      Sound.play('step');
      if (LiveStream.isOn()) setTimeout(() => LiveStream.open('theatre'), 1200);
      setTimeout(() => toast(EventInfo && EventInfo.upcoming() ? `<i>✦</i> Front row saved for you. On ${esc(EventInfo.dateLong())} the authors speak here, live.` : '<i>✦</i> Front row. Every book here began with a voice.', 4200), 900);
      break;
    case 'peer':
      People.wave(info);
      break;
    default:
  }
}

const Prompt = (() => {
  const el = $('#act'), verb = $('#act-verb'), what = $('#act-what');
  let info = null;
  function set(next) {
    info = next;
    if (!info || Detail.isOpen() || !ACTION_LABELS[info.kind]) { el.classList.remove('is-visible'); return; }
    const l = ACTION_LABELS[info.kind](info);
    verb.textContent = l.verb;
    what.textContent = l.what;
    el.classList.add('is-visible');
  }
  function init() { el.addEventListener('click', () => interact(info)); }
  return { init, set, get: () => info };
})();

/* Thumb joystick for phones and tablets */
function initJoystick() {
  const pad = $('#joystick'), knob = $('#joystick-knob');
  let id = null, cx = 0, cy = 0;
  const R = 46;
  const move = (x, y) => {
    let dx = x - cx, dy = y - cy;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    if (world) world.setMove(dx / R, -dy / R);
  };
  pad.addEventListener('pointerdown', (e) => {
    if (id !== null) return;
    id = e.pointerId;
    const r = pad.getBoundingClientRect();
    cx = r.left + r.width / 2;
    cy = r.top + r.height / 2;
    pad.setPointerCapture(id);
    pad.classList.add('is-active');
    move(e.clientX, e.clientY);
    Hints.moved();
    Tour.userMoved();
  });
  pad.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e.clientX, e.clientY); });
  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    knob.style.transform = '';
    pad.classList.remove('is-active');
    if (world) world.setMove(0, 0);
  };
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);
}

const Hints = (() => {
  let done = false;
  return {
    moved() {
      if (done) return;
      done = true;
      setTimeout(() => $$('.hint').forEach((h) => h.classList.add('is-quiet')), 2500);
    }
  };
})();

function initKeys() {
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    if (Overlays.size && !MapPanel.isOpen()) return;
    if ((e.key === 'm' || e.key === 'M') && !Detail.isOpen()) { MapPanel.isOpen() ? MapPanel.close() : MapPanel.open(); return; }
    if (MapPanel.isOpen()) return;
    if (e.key === 'p' || e.key === 'P') { takePhoto(); return; }
    if (Detail.isOpen()) return;
    if (e.key === 'e' || e.key === 'E') { interact(Prompt.get()); return; }
    if (e.key === 't' || e.key === 'T') { doAction('tour'); return; }
    if (/^[1-5]$/.test(e.key) && People.live()) { People.emote(EMOTES[+e.key - 1].id); return; }
    if (['w', 'a', 's', 'd', 'W', 'A', 'S', 'D', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      Hints.moved();
      Tour.userMoved();
      // walking keys belong to the fair, not to a focused button
      if (document.activeElement && document.activeElement !== document.body && document.activeElement.closest('.tour, .hud')) document.activeElement.blur();
    }
  });
}

/* =========================================================================
   The Book Oracle: three questions, and the book that is waiting for you
   ========================================================================= */
const Oracle = (() => {
  const box = $('#oracle-chips'), card = $('#oracle-card'), front = $('#oracle-front'), more = $('#oracle-more');
  let answers = [], last = null, busy = false;
  const frontHTML = (b) => `<img class="of__cover" src="${coverSrc(b, 480)}" alt="Cover of ${esc(b.title)}">
    <div class="of__text"><p class="of__eyebrow">The Oracle reveals</p>
    <h3 class="of__title">${esc(b.title)}</h3>
    <p class="of__author">${esc(authorName(b))}${isSoon(b) ? ' · coming soon' : ''}</p>
    <p class="of__msg">“${esc(b.oracle)}”</p>
    <div class="of__actions"><button class="btn btn--ink btn--sm" type="button" data-walk="${b.slug}">Walk me to its booth</button></div></div>`;
  function reveal(b) {
    busy = true;
    const flip = () => {
      front.innerHTML = frontHTML(b);
      card.classList.add('is-flipped', 'is-revealing');
      Sound.play('flip');
      last = b;
      setTimeout(() => { card.classList.remove('is-revealing'); busy = false; }, reduceMotion ? 50 : 1100);
    };
    if (card.classList.contains('is-flipped')) { card.classList.remove('is-flipped'); setTimeout(flip, reduceMotion ? 0 : 650); } else flip();
  }
  function ask() {
    const i = answers.length;
    const q = QUIZ[i];
    box.innerHTML = `<p class="oq__step"><span>${i + 1} of ${QUIZ.length}</span>${i ? '<button class="text-link" type="button" data-oq-back>Back</button>' : ''}</p>
      <p class="oq__q">${esc(q.q)}</p>
      <div class="oq__opts">${q.options.map((o, k) => `<button class="chip" type="button" data-oq="${k}">${esc(o.label)}</button>`).join('')}
      ${i === 0 ? '<button class="chip chip--surprise" type="button" data-oq="surprise">✦ Surprise me</button>' : ''}</div>`;
  }
  function done(best, also, mine) {
    box.innerHTML = `${mine ? `<p class="oq__why"><span>You asked for</span> ${answers.map((k, i) => `<b>${esc(QUIZ[i].options[k].label)}</b>`).join(' · ')}</p>` : ''}
      <p class="oq__step"><button class="text-link" type="button" data-oq-again>Ask the Oracle again</button></p>`;
    more.hidden = !also.length;
    more.innerHTML = also.length ? `<p class="oq__also">Also for you</p><div class="oq__books">${also.map((b) => `<button type="button" data-open="${b.slug}"><img src="${coverSrc(b, 480)}" alt="" loading="lazy"><span><b>${esc(b.title)}</b><small>${esc(authorName(b))}</small></span></button>`).join('')}</div>` : '';
    reveal(best);
  }
  function answer(k) {
    if (busy) return;
    if (k === 'surprise') {
      const pool = BOOKS.filter((b) => b !== last);
      done(pool[Math.floor(Math.random() * pool.length)], [], false);
      track('oracle_surprise');
      return;
    }
    answers.push(+k);
    if (answers.length < QUIZ.length) { ask(); Sound.play('pop'); return; }
    let ranked = scoreQuiz(QUIZ, answers, BOOKS).map((x) => x.b);
    if (ranked.length > 1 && ranked[0] === last) ranked = [...ranked.slice(1, 2), ranked[0], ...ranked.slice(2)];
    const best = ranked[0] || BOOKS[Math.floor(Math.random() * BOOKS.length)];
    done(best, ranked.filter((b) => b !== best).slice(0, 2), true);
    track('oracle_quiz', { book: best.slug });
  }
  function restart() {
    answers = [];
    more.hidden = true;
    card.classList.remove('is-flipped');
    ask();
  }
  function init() {
    if (!QUIZ.length) return;
    ask();
    box.addEventListener('click', (e) => {
      const o = e.target.closest('[data-oq]');
      if (o) { answer(o.getAttribute('data-oq')); return; }
      if (e.target.closest('[data-oq-back]')) { answers.pop(); ask(); }
      if (e.target.closest('[data-oq-again]')) restart();
    });
    card.addEventListener('click', (e) => {
      const w = e.target.closest('[data-walk]');
      if (w) goPlace('book-' + w.getAttribute('data-walk'));
    });
  }
  return { init, restart, focus: () => { const c = $('[data-oq]', box); if (c && finePointer) c.focus({ preventScroll: true }); } };
})();

/* =========================================================================
   The live event: HUD pill, ribbons, the event card, the panel and the stage screens
   ========================================================================= */
const EventUI = (() => {
  const sheet = makeSheet('event-panel', { onOpen: () => { render(); track('event_panel'); } });
  let lastBig = '';
  const setText = (key, v) => $$(`[data-event="${key}"]`).forEach((el) => { el.textContent = v; });
  // during the event: who is speaking now, or how long until the next talk
  const firstName = (a) => a.displayName.replace(/^(Dr|Prof)\.\s+/, '').split(/\s+/)[0];
  function now() {
    if (!EventInfo || !['today', 'soon', 'live'].includes(EventInfo.status().phase)) return null;
    const ps = Program.state();
    if (!ps || (ps.kind !== 'talk' && ps.kind !== 'break')) return null;
    const s = ps.kind === 'talk' ? ps.cur : ps.next;
    const a = s && authorById[s.author];
    return a ? { ...ps, s, a } : null;
  }
  function screens(st) {
    const after = st.phase === 'after';
    const n = now();
    let countdown = after
      ? { eyebrow: EVENT.name.toUpperCase(), big: 'THANK YOU', label: 'FOR JOINING US LIVE', line: 'Your book could be next', cta: 'FREE DISCOVERY CALL · PRESS E' }
      : { eyebrow: `${EVENT.name} · ${EVENT.where}`.toUpperCase(), big: st.big, label: st.label, line: `${EventInfo.dateLong()} · ${EVENT.price.toLowerCase()}`, cta: isEventDay() && ZOOM ? 'JOIN ON ZOOM · PRESS E' : 'REGISTER FREE · PRESS E' };
    if (n && n.kind === 'talk') {
      countdown = { eyebrow: `NOW SPEAKING · ${EVENT.where}`.toUpperCase(), big: 'LIVE', label: n.a.displayName.toUpperCase(), line: n.s.title || EVENT.name, cta: LiveStream.available() ? 'WATCH HERE OR JOIN ON ZOOM · PRESS E' : 'JOIN ON ZOOM · PRESS E' };
    } else if (n && n.kind === 'break') {
      const m = Program.minsTo(n.s);
      countdown = { eyebrow: 'BETWEEN THE TALKS', big: String(m), label: m === 1 ? 'MINUTE TO THE NEXT TALK' : 'MINUTES TO THE NEXT TALK', line: `Next: ${n.a.displayName} · ${n.s.time}`, cta: 'BREATHE · LANTERNS · THE ORACLE' };
    }
    return {
      countdown,
      lineup: { eyebrow: after ? 'THE AUTHORS OF THE FAIR' : 'SPEAKING LIVE AT THE EVENT', title: 'Meet the authors', names: AUTHORS.map((a) => a.displayName), foot: 'Find each of them at their booth' }
    };
  }
  function signs() {
    if (!EventInfo) return {};
    const st = EventInfo.status();
    const after = st.phase === 'after';
    return {
      plaque: after ? '' : `${EVENT.name}  ·  ${EventInfo.dateLong()}`.toUpperCase(),
      flag: after ? ['SPEAK', 'YOUR', 'BOOK', '-', 'VIRTUAL BOOK FAIR'] : ['SPEAK', 'YOUR', 'BOOK', '-', EventInfo.dateShort().toUpperCase(), EVENT.where.toUpperCase()],
      poster: after
        ? { pill: 'LIFE COACH CODE', eyebrow: 'THANK YOU FOR JOINING US', title1: 'Speak', title2: 'Your Book', date: 'Your book could be next', body: 'Book a free discovery call and tell us about the book you have been carrying.', cta: 'FREE DISCOVERY CALL', foot: 'PRESS E OR TAP' }
        : { pill: `${EVENT.where} · ${EVENT.price}`.toUpperCase(), eyebrow: 'LIFE COACH CODE PRESENTS', title1: 'Speak', title2: 'Your Book', date: EventInfo.dateLong(), body: 'Meet every author of this fair, live. Each of them speaks at the event.', cta: 'REGISTER FREE', foot: 'PRESS E OR TAP TO SAVE YOUR SEAT' },
      screens: screens(st)
    };
  }
  function fill() {
    if (!EventInfo) return;
    const st = EventInfo.status();
    const after = st.phase === 'after';
    const live = st.phase === 'live' || st.phase === 'today';
    setText('pill', live ? `Live today · ${EVENT.where.replace(/^Live /, '')}` : `Live · ${EventInfo.dayShort()}`);
    setText('pill-sub', `${st.short} · ${EVENT.price.toLowerCase()} on Zoom`);
    setText('ribbon', `${EVENT.name}, live`);
    setText('ribbon-sub', `${EventInfo.dateLong()} · ${EVENT.price.toLowerCase()} on Zoom · ${st.count.toLowerCase()}`);
    setText('menu', `${EventInfo.dateLong()} · ${EVENT.price.toLowerCase()} on Zoom`);
    setText('eyebrow', `${EVENT.where} · ${EVENT.price}`);
    setText('name', EVENT.name);
    setText('date', EventInfo.dateLong());
    setText('time', EventInfo.time() ? ` · ${EventInfo.time()}` : '');
    setText('count', st.count ? ` · ${st.count}` : '');
    setText('about', EVENT.about);
    setText('lineup-title', `${after ? 'The authors' : 'Speaking live'} · ${AUTHORS.length}`);
    setText('fine', `Hosted by Life Coach Code · ${EVENT.price.toLowerCase()} to attend`);
    $$('[data-event="countdown"]').forEach((el) => {
      el.innerHTML = after ? '' : `<b>${esc(st.big === 'TODAY' ? 'Today' : st.big)}</b><span>${esc(st.big === 'TODAY' ? 'live on Zoom' : st.label.toLowerCase())}</span>`;
    });
    $$('[data-event-register]').forEach((a) => {
      a.href = after ? LINKS.discovery : EVENT.register;
      if (after) a.textContent = 'Book a free discovery call';
    });
    // the Zoom room: everyone joins from here (a new window, or the Zoom app on phones)
    const cta = $('[data-event-cta]');
    if (cta && ZOOM && !after && !$('[data-zoom]', cta)) cta.insertAdjacentHTML('afterbegin', `<a class="btn btn--ghost btn--lg btn--zoom" data-zoom href="${esc(ZOOM)}" target="_blank" rel="noopener">${ZOOM_ICON} Join on Zoom</a>`);
    $$('[data-zoom]').forEach((z) => { z.hidden = after || !ZOOM; if (ZOOM) z.href = ZOOM; z.classList.toggle('btn--gold', isEventDay()); z.classList.toggle('btn--ghost', !isEventDay()); });
    if (isEventDay()) setText('pill-sub', 'join on Zoom now');
    const n = now();
    if (n && n.kind === 'talk') { setText('pill', `Now: ${n.a.displayName}`); setText('pill-sub', 'speaking live · join on Zoom'); }
    if (n && n.kind === 'break') { setText('pill', `Next: ${firstName(n.a)} · ${n.s.time}`); setText('pill-sub', `in ${Program.minsTo(n.s)} min · a break to enjoy the fair`); }
    Between.check(n);
    $('#event-pill').hidden = after;
    $$('.event-ribbon').forEach((r) => { r.hidden = after; });
    $('#event-pill').classList.toggle('is-live', live);
    const sc = screens(st);
    const key = JSON.stringify(sc.countdown);
    if (world && key !== lastBig) { lastBig = key; world.setScreens(sc); }
  }
  function programme() {
    const list = Program.timed();
    $('#ev-prog').hidden = !list.length;
    if (!list.length) return;
    const ps = Program.state();
    $('#ev-programme').innerHTML = list.map((s) => {
      const on = ps && ps.cur === s;
      if (s.break) {
        return `<li class="pg__item pg__item--break${on ? ' is-now' : ''}"><time>${esc(s.time)}</time>
          <span><b>${esc(s.title || 'Break')}</b><small>Breathe, release a lantern, ask the Oracle</small></span>
          ${on ? '<button class="chip" type="button" data-do="between">Things to do</button>' : ''}</li>`;
      }
      const a = authorById[s.author];
      return `<li class="pg__item${on ? ' is-now' : ''}"><time>${esc(s.time)}</time>${a ? avatar(a, true) : ''}
        <span><b>${esc(a ? a.displayName : s.author)}</b>${s.title ? `<small>${esc(s.title)}</small>` : ''}</span>
        ${on ? '<em>● Speaking now</em>' : Reminders.button(s)}</li>`;
    }).join('');
  }
  function render() {
    fill();
    programme();
    $('#ev-lineup').innerHTML = AUTHORS.map((a) => {
      const b = bySlug[a.books[0]];
      const here = People.isOnline(a.id);
      return `<li><button type="button" data-place="book-${b.slug}">
        ${avatar(a, true)}
        <span><b>${esc(a.displayName)}</b><small>${(EVENT.schedule || []).filter((x) => x.author === a.id).map((x) => esc(x.time) + ' · ').join('')}${a.books.map((s) => esc(bySlug[s].title)).join(' · ')}</small>${here ? '<em>● At the fair now</em>' : ''}</span>
        <img class="lu__cover" src="${coverSrc(b, 480)}" alt="" loading="lazy"></button></li>`;
    }).join('');
  }
  function init() {
    if (!EventInfo) { $('#event-pill').hidden = true; return; }
    fill();
    setInterval(fill, 30000);
    $('#event-pill').addEventListener('click', () => sheet.open());
    sheet.el.addEventListener('click', (e) => {
      const p = e.target.closest('[data-place]');
      if (p) { sheet.close(); goPlace(p.getAttribute('data-place')); return; }
      if (e.target.closest('[data-ics]')) {
        const blob = new Blob([EventInfo.ics()], { type: 'text/calendar' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'speak-your-book.ics';
        document.body.appendChild(a);
        a.click();
        a.remove();
        track('event_calendar');
      }
      if (e.target.closest('[data-seat]')) { sheet.close(); takeSeat(); }
    });
  }
  return { init, open: () => sheet.open(), signs, refresh: fill, now, rerender: () => { if (sheet.isOpen()) programme(); } };
})();

/* =========================================================================
   Reminders for the talks: 30, 10 and 5 minutes before, and when it starts
   ========================================================================= */
const Reminders = (() => {
  const KEY = 'lcc-fair-reminders', DONE = 'lcc-fair-reminded';
  const STEPS = [30, 10, 5, 0];
  const keys = new Set(store.get(KEY, []) || []);
  let actx = null;
  const nameOf = (s) => (authorById[s.author] ? authorById[s.author].displayName : 'The next speaker');
  const has = (s) => !!s && keys.has(s.key);
  // a soft bell that rings even with the fair's music off (the click that set the reminder allows it)
  function prime() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); } catch (e) { actx = null; } }
  function ring() {
    if (!actx) return;
    try {
      actx.resume();
      [880, 1175, 1568].forEach((f, i) => {
        const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + i * 0.22;
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
        o.connect(g);
        g.connect(actx.destination);
        o.start(t);
        o.stop(t + 1.5);
      });
    } catch (e) { /* decorative */ }
  }
  function button(s, cls = 'chip') {
    if (!s || s.start <= new Date()) return '';
    const on = has(s);
    return `<button class="${cls} chip--remind" type="button" data-remind="${esc(s.key)}" aria-pressed="${on}">${on ? '✓ Reminder set' : '🔔 Remind me'}</button>`;
  }
  function paint() {
    $$('[data-remind]').forEach((b) => {
      const on = keys.has(b.getAttribute('data-remind'));
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.textContent = on ? '✓ Reminder set' : '🔔 Remind me';
    });
  }
  function save() { store.set(KEY, [...keys]); paint(); }
  function calendar(s) {
    const blob = new Blob([Program.ics(s, { authorName: nameOf(s), zoom: ZOOM, pageUrl: location.origin + location.pathname })], { type: 'text/calendar' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${s.author}-talk.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    track('reminder_calendar', { author: s.author });
  }
  function set(s) {
    if (!s || s.start <= new Date()) return;
    prime();
    keys.add(s.key);
    save();
    Sound.play('stamp');
    track('reminder_set', { author: s.author });
    toast(`<i>🔔</i> We’ll remind you 30, 10 and 5 minutes before <b>${esc(nameOf(s))}</b> (${esc(s.time)}) while the fair is open. For a reminder on your phone, add it to your calendar.`, 9000, { label: 'Add to calendar', fn: () => calendar(s) });
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
    check();
  }
  function toggle(s) {
    if (!s) return;
    if (has(s)) { keys.delete(s.key); save(); toast(`<i>✓</i> Reminder for ${esc(nameOf(s))} removed`); } else set(s);
  }
  function alert(s, mins) {
    const who = nameOf(s);
    const text = mins > 0 ? `${who} speaks in ${mins} minute${mins === 1 ? '' : 's'}` : `${who} is speaking now`;
    const go = LiveStream.available() ? { label: 'Watch here', fn: () => LiveStream.open() }
      : ZOOM ? { label: 'Join on Zoom', fn: () => { window.open(ZOOM, '_blank', 'noopener'); track('zoom_join', { from: 'reminder' }); } }
        : { label: 'The programme', fn: () => EventUI.open() };
    toast(`<i>🔔</i> <b>${esc(text)}</b>${s.title ? ` · <em>${esc(s.title)}</em>` : ''}`, 20000, go);
    ring();
    if (navigator.vibrate) navigator.vibrate([120, 80, 120]);
    if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
      try {
        const n = new Notification(text, { body: `${s.title ? s.title + ' · ' : ''}${EVENT.name}, live on Zoom`, icon: asset('assets/img/brand/logo-512.png'), tag: s.key });
        n.onclick = () => { window.focus(); n.close(); };
      } catch (e) { /* notifications are a bonus */ }
    }
    track('reminder_alert', { author: s.author, mins });
  }
  function check() {
    if (!keys.size) return;
    const now = new Date();
    const done = store.get(DONE, {}) || {};
    let dirty = false;
    keys.forEach((k) => {
      const s = Program.byKey(k);
      if (!s) return;
      const left = (s.start - now) / 6e4;
      const due = STEPS.filter((m) => left <= m);
      if (!due.length || left < -10) return;
      // only the latest reminder that is due: earlier ones are skipped if the fair was closed
      const step = Math.min(...due);
      if ((done[k] || []).includes(step)) return;
      done[k] = due;
      dirty = true;
      alert(s, Math.max(0, Math.ceil(left)));
    });
    if (dirty) store.set(DONE, done);
  }
  function init() {
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-remind]');
      if (b) toggle(Program.byKey(b.getAttribute('data-remind')));
    });
    setInterval(check, 15000);
    document.addEventListener('visibilitychange', check);
    check();
  }
  return {
    init, button, toggle, check,
    setFor(id) { const s = Program.talksBy(id).find((x) => x.start > new Date()); if (s && !has(s)) set(s); return !!s; },
    canFor: (id) => Program.talksBy(id).some((x) => x.start > new Date())
  };
})();

function takeSeat() {
  if (!world) return;
  interact({ kind: 'seat', index: Math.floor(Math.random() * 8) });
}

/* =========================================================================
   Meet the author
   ========================================================================= */
const AuthorPanel = (() => {
  const sheet = makeSheet('author-panel');
  let currentId = null;
  function render() {
    const a = authorById[currentId];
    if (!a) return;
    const here = People.onlinePeer(a.id);
    const books = a.books.map((s) => bySlug[s]);
    $('#author-body').innerHTML = `
      <div class="au__head">${avatar(a)}
        <div><p class="eyebrow">Meet the author</p><h2 class="sheet__title" id="au-name">${esc(a.displayName)}</h2>${a.credentials ? `<p class="au__cred">${esc(a.credentials)}</p>` : ''}</div></div>
      <div class="au__chips">
        <span class="au__status${here ? ' is-online' : ''}"><i></i>${here ? 'Here at the fair now' : EventInfo && EventInfo.upcoming() ? `Speaking live · ${esc(EventInfo.dayShort())}` : 'Author at the fair'}</span>
        ${a.websiteByLCC ? '<span class="au__badge" title="Life Coach Code helped create this website">✦ Website made with Life Coach Code</span>' : ''}
      </div>
      ${talkHtml(a)}
      ${bioHtml(a)}
      ${a.welcome ? `<blockquote class="bi__hook">${esc(a.welcome)}</blockquote>` : ''}
      ${a.voice ? `<p class="au__voice"><span>A welcome from ${esc(a.displayName)}</span><audio controls preload="none" src="${esc(a.voice)}"></audio></p>` : ''}
      <ul class="au__shelf">${books.map((b) => `<li><button type="button" data-open="${b.slug}" aria-label="Open ${esc(b.title)}"><img src="${coverSrc(b, 480)}" alt="" loading="lazy"><span>${esc(b.title)}${isSoon(b) ? '<small>Coming soon</small>' : ''}</span></button></li>`).join('')}</ul>
      ${authorLinksHtml(a)}
      <div class="card__actions">
        ${eventCta()}
        ${here ? `<button class="btn btn--ghost" type="button" data-wave="${here.id}">Wave hello 👋</button><button class="btn btn--ghost" type="button" data-go="${here.id}">Walk over</button>` : ''}
        ${inboxOf(a) ? '<button class="btn btn--ghost" type="button" data-msg>Send a message ✉</button>' : ''}
      </div>
      ${inboxOf(a) ? mailHtml(a) : ''}`;
  }
  function talkHtml(a) {
    const talks = Program.talksBy(a.id);
    if (!talks.length) return '';
    const now = new Date();
    return talks.map((s) => {
      const when = s.end <= now ? 'Spoke live at' : s.start <= now ? 'Speaking live now, since' : 'Speaks live at';
      return `<p class="au__talk"><span>${when} <b>${esc(s.time)}</b>${s.title ? ` · <em>${esc(s.title)}</em>` : ''}</span>${Reminders.button(s)}</p>`;
    }).join('');
  }
  function bioHtml(a) {
    if (!a.bio) return '';
    const m = a.bio.match(/^(.*?[.!?])\s+(.+)$/);
    return m ? `<details class="au__bio"><summary>${esc(m[1])}</summary><p>${esc(m[2])}</p></details>` : `<p class="au__bio">${esc(a.bio)}</p>`;
  }
  function authorLinksHtml(a) {
    const l = [[a.website, 'Website'], [a.linkedin, 'LinkedIn'], [a.profile, 'Life Coach Code profile'], [a.interview, 'Interview']].filter(([u]) => u);
    return l.length ? `<p class="au__links">${l.map(([u, t]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${t} <span aria-hidden="true">↗</span></a>`).join('')}</p>` : '';
  }
  // where a message to this author goes: their own inbox, or Life Coach Code's to pass along
  const inboxOf = (a) => (CONTACT.enabled ? (a.inbox || CONTACT.fallbackInbox || '').trim() : '');
  // the visitor writes from their own email: a new message opens, addressed and already begun
  function draft(a) {
    const own = !!(a.inbox || '').trim();
    const first = a.name.split(/\s+/)[0];
    const books = a.books.map((s) => bySlug[s].title);
    const about = books.length === 1 ? `your book ${books[0]}` : 'your books';
    const me = People.myName();
    const body = [
      own ? `Hello ${first},` : `Hello Life Coach Code, please pass this message on to ${a.displayName}.\n\nHello ${first},`,
      '',
      `I visited your booth at the Virtual Book Fair by Life Coach Code and wanted to write to you about ${about}.`,
      '',
      '',
      '',
      'Warm regards,',
      me || ''
    ].join('\n');
    return { to: inboxOf(a), subject: own ? `Hello from the Virtual Book Fair` : `For ${a.displayName}: a message from the Virtual Book Fair`, body };
  }
  function mailHtml(a) {
    const d = draft(a);
    const enc = encodeURIComponent;
    const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${enc(d.to)}&su=${enc(d.subject)}&body=${enc(d.body)}`;
    const app = `mailto:${d.to}?subject=${enc(d.subject)}&body=${enc(d.body.replace(/\n/g, '\r\n'))}`;
    const own = !!(a.inbox || '').trim();
    // phones open their own mail app (often Gmail itself); computers open Gmail in a new tab
    const btns = [
      `<a class="btn ${finePointer ? 'btn--gold' : 'btn--ghost'}" href="${esc(gmail)}" target="_blank" rel="noopener" data-mail="gmail">Write in Gmail</a>`,
      `<a class="btn ${finePointer ? 'btn--ghost' : 'btn--gold'}" href="${esc(app)}" data-mail="app">${finePointer ? 'Other email app' : 'Open my email app'}</a>`
    ];
    if (!finePointer) btns.reverse();
    return `<div class="au__msg" id="au-msg" hidden>
      <h3 class="bi__h">Write to ${esc(a.displayName)}</h3>
      <p class="au__msg-lead">A new email opens, addressed and already begun. Add your words and send it from your own email${own ? `: ${esc(a.name.split(/\s+/)[0])} replies to you directly` : `. Life Coach Code passes it on to ${esc(a.displayName)}`}.</p>
      <div class="card__actions">${btns.join('')}<button class="text-link" type="button" data-mail="copy">Copy the address</button></div>
    </div>`;
  }
  function open(id, { message = false } = {}) {
    if (!authorById[id]) return;
    currentId = id;
    render();
    sheet.open();
    Sound.play('open');
    track('author_open', { author: id });
    if (message) setTimeout(() => { const b = $('[data-msg]', sheet.el); if (b) b.click(); }, 120);
  }
  sheet.el.addEventListener('click', (e) => {
    if (e.target.closest('[data-open]')) { sheet.close(); return; }
    const w = e.target.closest('[data-wave]');
    if (w) { const p = People.peer(w.getAttribute('data-wave')); if (p) People.wave({ kind: 'peer', id: p.id, name: p.name, author: p.author }); }
    const g = e.target.closest('[data-go]');
    if (g) { sheet.close(); if (Detail.isOpen()) Detail.close(); People.goTo(g.getAttribute('data-go')); }
    const f = $('#au-msg', sheet.el);
    if (f && e.target.closest('[data-msg]')) {
      f.hidden = false;
      f.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
      setTimeout(() => { const first = $('[data-mail]', f); if (first) first.focus({ preventScroll: true }); }, 250);
    }
    const m = e.target.closest('[data-mail]');
    if (m) {
      const a = authorById[currentId];
      const via = m.getAttribute('data-mail');
      track('author_email', { author: a.id, via });
      if (via === 'copy') {
        const to = inboxOf(a);
        const done = () => toast(`<i>✓</i> ${esc(to)} copied`);
        if (navigator.clipboard) navigator.clipboard.writeText(to).then(done, () => window.prompt('Copy this address', to));
        else window.prompt('Copy this address', to);
      }
    }
  });
  return { open, refresh: () => { if (sheet.isOpen() && !$('#au-msg:not([hidden])', sheet.el)) render(); } };
})();

/* =========================================================================
   Everyone at the fair right now (live.js)
   ========================================================================= */
const People = (() => {
  const LIVE = window.FAIR_LIVE || {};
  const KEY = 'lcc-fair-me', AKEY = 'lcc-fair-author';
  const HUES = [36, 350, 300, 262, 205, 160];
  const sheet = makeSheet('people-panel', { onOpen: () => { render(); track('people_open'); } });
  const btn = $('#people-btn'), countEl = $('#people-count');
  let live = null, peers = [], status = 'off', online = new Map(), selfAuthor = null;
  const me = { name: '', hue: HUES[Math.floor(Math.random() * HUES.length)], visible: true, ...(store.get(KEY, null) || {}) };
  const save = () => store.set(KEY, me);
  const emojiOf = (id) => (EMOTES.find((e) => e.id === id) || EMOTES[0]).emoji;

  function readAuthorLink() {
    const q = new URLSearchParams(location.search);
    // fair-author: WordPress keeps ?author= for its own author pages; ?author= still works on GitHub Pages
    const id = q.get('fair-author') || q.get('author');
    const m = location.hash.match(/^#key=([A-Za-z0-9_-]{20,})$/);
    if (id && m && authorById[id]) {
      store.set(AKEY, { id, d: m[1] });
      q.delete('fair-author');
      q.delete('author');
      history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : ''));
    }
    return store.get(AKEY, null);
  }

  function onPeers(list) {
    peers = list;
    if (world) world.setPeers(list.map((p) => ({ id: p.id, name: p.name, hue: p.hue, x: p.x, z: p.z, yaw: p.yaw, seated: p.seated, author: p.author })));
    const now = new Map();
    list.forEach((p) => { if (p.author) now.set(p.author.id, p); });
    online.forEach((p, id) => { if (!now.has(id) && id !== selfAuthor && world) world.setAuthorOnline(id, false); });
    now.forEach((p, id) => { if (!online.has(id) && world) world.setAuthorOnline(id, true); });
    online = now;
    updateCount();
    if (sheet.isOpen()) renderList();
    EmoteBar.update(peers.length > 0 && status === 'live');
  }
  function onEvent(ev) {
    if (ev.k === 'emote') {
      if (world) world.peerEmote(ev.peer.id, emojiOf(ev.emote));
      if (ev.toMe) {
        const who = ev.peer.author ? ev.peer.author.name : ev.peer.name || 'A visitor';
        toast(`<i>${emojiOf(ev.emote)}</i> ${esc(who)} ${ev.emote === 'wave' ? 'waves at you' : 'reacted to you'}`, 4200, ev.emote === 'wave' ? { label: 'Wave back', fn: () => wave({ id: ev.peer.id, name: ev.peer.name, author: ev.peer.author }) } : null);
        Sound.play('wave');
      } else Sound.play('pop');
    }
    if (ev.k === 'lantern') Lantern.fromPeer(ev.peer);
    if (ev.k === 'author-here') {
      const a = authorById[ev.peer.author.id];
      if (!a) return;
      const b = bySlug[a.books[0]];
      toast(`<i>✦</i> ${esc(a.displayName)}, author of <em>${esc(b.title)}</em>, just arrived`, 6500, { label: 'Go say hi', fn: () => goTo(ev.peer.id) });
      Sound.play('wave');
      AuthorPanel.refresh();
    }
  }
  function onStatus(s) {
    status = s;
    btn.hidden = s !== 'live';
    btn.classList.toggle('is-live', s === 'live');
    btn.classList.toggle('is-off', s !== 'live');
    updateCount();
    if (sheet.isOpen()) render();
  }
  function updateCount() {
    const n = peers.length + 1;
    countEl.textContent = status === 'live' ? String(n) : '·';
    btn.setAttribute('aria-label', status === 'live' ? `${n} ${n === 1 ? 'person' : 'people'} in the fair right now. See who's here` : 'Who is in the fair');
  }

  function renderList() {
    const authorsHere = peers.filter((p) => p.author);
    const visitors = peers.filter((p) => !p.author);
    const item = (p) => {
      const a = p.author && authorById[p.author.id];
      return `<li class="pp__item${a ? ' pp__item--author' : ''}">
        <span class="pp__dot" style="--h:${a ? 40 : p.hue}"></span>
        <span class="pp__name">${a ? '✦ ' + esc(a.displayName) : esc(p.name || 'Visitor')}<small>${a ? 'Author · ' + esc(bySlug[a.books[0]].title) : (p.seated ? 'Sitting by the stage' : 'Exploring the fair')}</small></span>
        <button class="btn btn--ghost btn--sm" type="button" data-go="${p.id}">Go say hi</button></li>`;
    };
    $('#pp-list').innerHTML = [...authorsHere, ...visitors].slice(0, 60).map(item).join('');
    const others = peers.length;
    $('#pp-lead').textContent = status !== 'live'
      ? (status === 'connecting' ? 'Joining the live fair…' : 'The live connection is resting. Keep exploring: other visitors appear as soon as it reconnects.')
      : others === 0 ? 'Right now it is just you. Anyone who arrives appears as a glowing figure with their name, and authors glow gold.'
        : `You are here with ${others} ${others === 1 ? 'other person' : 'other people'}${authorsHere.length ? `, including ${authorsHere.length} ${authorsHere.length === 1 ? 'author' : 'authors'}` : ''}.`;
  }
  function render() {
    $('#pp-status').textContent = status === 'live' ? 'Live now' : status === 'connecting' ? 'Connecting…' : 'Offline';
    $('#pp-dot').className = 'live-dot' + (status === 'live' ? ' is-live' : '');
    $('#pp-name').value = me.name;
    $('#pp-visible').checked = me.visible;
    $('#pp-hues').innerHTML = HUES.map((h) => `<button type="button" role="radio" aria-checked="${h === me.hue}" aria-label="Colour" style="--h:${h}" data-hue="${h}"></button>`).join('');
    const au = selfAuthor && authorById[selfAuthor];
    $('#pp-author').hidden = !au;
    if (au) $('#pp-author').innerHTML = `✦ Visitors see you as the author <b>${esc(au.displayName)}</b>. <button class="text-link" type="button" data-signout>Stop appearing as the author</button>`;
    $('#pp-form').hidden = !!au;
    renderList();
  }

  function wave(info) {
    if (!live || !info) return;
    if (live.emote('wave', info.id)) {
      const who = info.author ? info.author.name : info.name || 'a visitor';
      toast(`<i>👋</i> You waved at ${esc(who)}`);
      Sound.play('wave');
      track('wave');
    }
    if (info.author) AuthorPanel.open(info.author.id);
  }
  function emote(id) {
    if (!live || status !== 'live') { toast('<i>✦</i> Reactions work when other visitors are here'); return; }
    if (live.emote(id)) { EmoteBar.burst(emojiOf(id)); Sound.play('pop'); track('emote', { emote: id }); }
  }
  function goTo(id) {
    const p = world && world.peerPos(id);
    if (!p) return;
    if (Detail.isOpen()) Detail.close();
    sheet.close();
    world.travelNear(p.x, p.z);
  }

  async function start() {
    if (!LIVE.enabled || !world || !('WebSocket' in window)) return;
    live = createLive(LIVE, { authors: AUTHORS, onPeers, onEvent, onStatus });
    const link = readAuthorLink();
    if (link) {
      const ok = await live.setAuthor(link.id, link.d);
      if (ok) {
        selfAuthor = link.id;
        world.setAuthorOnline(link.id, true);
        setTimeout(() => AuthorHi.show(authorById[link.id]), 1800);
        track('author_online', { author: link.id });
      } else {
        store.set(AKEY, null);
        setTimeout(() => toast('<i>!</i> That author link did not work. Ask Life Coach Code for a fresh one.', 6000), 2500);
      }
    }
    if (!selfAuthor) live.setName(me.name);
    live.setHue(me.hue);
    if (!me.visible) live.setVisible(false);
    live.start();
    setInterval(() => { if (world) live.update(world.playerState()); }, 200);
  }

  function init() {
    btn.addEventListener('click', () => sheet.open());
    $('#pp-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const raw = $('#pp-name').value;
      const name = live ? live.setName(raw) : raw.trim();
      me.name = name;
      save();
      $('#pp-name').value = name;
      toast(name ? `<i>✓</i> Others now see you as ${esc(name)}` : (raw.trim() ? '<i>!</i> Please use a first name with letters only' : '<i>✓</i> Others see you as a visitor'));
    });
    $('#pp-visible').addEventListener('change', (e) => {
      me.visible = e.target.checked;
      save();
      if (live) live.setVisible(me.visible);
    });
    sheet.el.addEventListener('click', (e) => {
      const h = e.target.closest('[data-hue]');
      if (h) { me.hue = +h.getAttribute('data-hue'); save(); if (live) live.setHue(me.hue); $$('[data-hue]', sheet.el).forEach((b) => b.setAttribute('aria-checked', b === h ? 'true' : 'false')); }
      const g = e.target.closest('[data-go]');
      if (g) goTo(g.getAttribute('data-go'));
      const em = e.target.closest('[data-emote]');
      if (em) emote(em.getAttribute('data-emote'));
      if (e.target.closest('[data-signout]')) { store.set(AKEY, null); location.reload(); }
    });
    $('#pp-emotes').innerHTML = EMOTES.map((e, i) => `<button type="button" data-emote="${e.id}" aria-label="${esc(e.label)}" title="${esc(e.label)} (${i + 1})">${e.emoji}</button>`).join('');
    updateCount();
  }
  return {
    init, start, wave, emote, goTo,
    lantern: () => !!(live && status === 'live' && me.visible && live.lantern()),
    open: () => sheet.open(),
    isOnline: (id) => !!id && (online.has(id) || id === selfAuthor),
    onlinePeer: (id) => online.get(id) || null,
    peer: (id) => peers.find((p) => p.id === id) || null,
    myName: () => me.name,
    live: () => status === 'live'
  };
})();

/* Reactions bar (desktop, when others are here) and the little burst you see when you send one */
const EmoteBar = (() => {
  const bar = $('#emote-bar');
  bar.innerHTML = EMOTES.map((e, i) => `<button type="button" data-emote="${e.id}" aria-label="${esc(e.label)}" title="${esc(e.label)} (${i + 1})">${e.emoji}</button>`).join('');
  bar.addEventListener('click', (e) => { const b = e.target.closest('[data-emote]'); if (b) People.emote(b.getAttribute('data-emote')); });
  return {
    update(show) { bar.hidden = !show || !finePointer; },
    burst(emoji) {
      const el = document.createElement('span');
      el.className = 'emote-burst';
      el.textContent = emoji;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1600);
    }
  };
})();

/* =========================================================================
   Keepsakes: photos, postcards, certificates
   ========================================================================= */
const Keepsake = (() => {
  const sheet = makeSheet('keepsake-panel', { onClose: () => { if (url) { URL.revokeObjectURL(url); url = null; } } });
  const img = $('#ks-img');
  let canvas = null, opts = null, url = null;
  async function show(c, o) {
    canvas = c;
    opts = o;
    $('#ks-title').textContent = o.title;
    $('#ks-eyebrow').textContent = o.eyebrow;
    $('[data-ks-event]').hidden = !(EventInfo && EventInfo.upcoming());
    const blob = await K.toBlob(c);
    if (url) URL.revokeObjectURL(url);
    url = blob ? URL.createObjectURL(blob) : c.toDataURL('image/jpeg', 0.9);
    img.src = url;
    img.alt = o.title;
    sheet.open();
  }
  sheet.el.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-ks]');
    if (!a || !canvas) return;
    if (a.getAttribute('data-ks') === 'save') { await K.saveImage(canvas, opts.filename); track('keepsake_save', { kind: opts.filename }); return; }
    const pageUrl = location.origin + location.pathname;
    const r = await K.shareImage(canvas, opts.filename, { title: 'The Virtual Book Fair', text: opts.text || 'A keepsake from the Virtual Book Fair by Life Coach Code.', url: pageUrl });
    if (r === 'unsupported') {
      if (navigator.clipboard) navigator.clipboard.writeText(pageUrl).then(() => toast('<i>↗</i> Link to the fair copied. Save the image to share it too'));
      else window.prompt('Copy this link', pageUrl);
    }
    if (r === 'shared') track('keepsake_share', { kind: opts.filename });
  });
  return { show };
})();

async function takePhoto() {
  if (!world) return;
  const fl = $('#flash');
  fl.classList.remove('is-on');
  void fl.offsetWidth;
  fl.classList.add('is-on');
  Sound.play('shutter');
  const shot = await world.capture();
  const framed = K.framePhoto(shot, {
    logo: LOGO,
    lines: {
      left: 'Hosted by Life Coach Code',
      right: EventInfo && EventInfo.upcoming() ? `${EVENT.name} · live on Zoom · ${EventInfo.dateShort()}` : EVENT ? EVENT.name : 'Speak Your Book'
    }
  });
  Keepsake.show(framed, { eyebrow: 'Photo mode', title: 'Your photo from the fair', filename: 'virtual-book-fair-photo.jpg', text: 'I am walking the Virtual Book Fair by Life Coach Code.' });
  track('photo');
}

/* =========================================================================
   Your book at the fair: design a cover, place it on the last pedestal
   ========================================================================= */
const Creator = (() => {
  const KEY = 'lcc-fair-mybook';
  const sheet = makeSheet('creator-panel', { onOpen: () => { fillForm(); draw(); track('creator_open'); } });
  const cnv = $('#cr-canvas'), form = $('#cr-form');
  let saved = store.get(KEY, null), raf = 0;
  // form.title and form.name are the form's own properties, so reach the inputs by name
  const field = (n) => form.elements.namedItem(n);
  const data = () => {
    const sel = form.querySelector('[data-style][aria-checked="true"]');
    return {
      title: field('title').value.trim().slice(0, 60),
      subtitle: field('subtitle').value.trim().slice(0, 80),
      name: field('name').value.trim().slice(0, 40),
      style: sel ? sel.dataset.style : 'midnight'
    };
  };
  $('#cr-styles').innerHTML = K.COVER_STYLES.map((s, i) => `<button type="button" role="radio" aria-checked="${i === 0}" data-style="${s.id}" style="--a:${s.bg[0]};--b:${s.bg[1]}"><span>${esc(s.label)}</span></button>`).join('');
  function fillForm() {
    const d = saved || { title: '', subtitle: '', name: People.myName(), style: 'midnight' };
    field('title').value = d.title;
    field('subtitle').value = d.subtitle || '';
    field('name').value = d.name || '';
    $$('[data-style]', form).forEach((b) => b.setAttribute('aria-checked', b.dataset.style === d.style ? 'true' : 'false'));
    $('[data-cr="remove"]', form).hidden = !saved;
  }
  function draw() { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => K.drawCover(cnv, data())); }
  function coverCanvas(d) {
    const c = document.createElement('canvas');
    c.width = 600;
    c.height = 900;
    const r = K.drawCover(c, d);
    return { canvas: c, colors: r.colors };
  }
  function apply() {
    if (!world) return;
    if (!saved) { world.setCustomBook(null); return; }
    const { canvas, colors } = coverCanvas(saved);
    world.setCustomBook({ canvas, colors, title: saved.title, subtitle: saved.subtitle, name: saved.name });
  }
  function syncCards() {
    Spot.render();
    $$('[data-mybook="postcard"]').forEach((b) => { b.hidden = !saved; });
    $$('[data-mybook="edit"]').forEach((b) => { b.textContent = saved ? 'Edit my cover' : 'Design my cover'; });
    $$('[data-mybook="line"]').forEach((l) => { l.textContent = saved ? `“${saved.title}” is on the pedestal. Take a postcard home, or make it real with a free discovery call.` : 'Picture it first: design your cover and set it on this pedestal.'; });
  }
  async function postcard() {
    const d = saved || data();
    if (!d.title) { if (!sheet.isOpen()) sheet.open(); setTimeout(() => field('title').focus(), 60); toast('<i>!</i> Give your book a title first'); return; }
    const { canvas } = coverCanvas(d);
    const scene = world ? await world.capture() : null;
    const up = EventInfo && EventInfo.upcoming();
    const card = K.makePostcard({
      cover: canvas, title: d.title, name: d.name, scene, logo: LOGO,
      lines: {
        eyebrow: 'My book has a place at',
        headline: 'The Virtual Book Fair',
        footer1: up ? `${EVENT.name} · ${EVENT.where}` : 'Speak Your Book · Life Coach Code',
        footer2: up ? `${EventInfo.dateLong()} · ${EVENT.price.toLowerCase()} · meet the authors` : 'Your book is already inside you. Speak it.'
      }
    });
    Keepsake.show(card, { eyebrow: 'Your book at the fair', title: 'Your postcard', filename: 'my-book-at-the-fair.jpg', text: `My book "${d.title}" has a place at the Virtual Book Fair.` });
    track('postcard');
  }
  function init() {
    form.addEventListener('input', draw);
    form.addEventListener('click', (e) => {
      const st = e.target.closest('[data-style]');
      if (st) { $$('[data-style]', form).forEach((b) => b.setAttribute('aria-checked', b === st ? 'true' : 'false')); draw(); }
      const act = e.target.closest('[data-cr]');
      if (!act) return;
      if (act.dataset.cr === 'postcard') postcard();
      if (act.dataset.cr === 'remove') {
        saved = null;
        store.set(KEY, null);
        apply();
        syncCards();
        sheet.close();
        toast('<i>✓</i> The pedestal is waiting again');
      }
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const d = data();
      if (!d.title) { field('title').focus(); return; }
      saved = d;
      store.set(KEY, saved);
      apply();
      syncCards();
      sheet.close();
      goPlace('finale');
      Sound.play('win');
      setTimeout(() => { Petals.burst(); toast(`<i>✦</i> “${esc(d.title)}” is on the pedestal`, 4200, { label: 'Get my postcard', fn: postcard }); }, 2600);
      track('mybook_place');
    });
    syncCards();
  }
  return { init, apply, postcard, open: () => sheet.open(), has: () => !!saved, title: () => (saved ? saved.title : '') };
})();

/* =========================================================================
   The one next step, always in reach: visitors make their own book, authors go to their booth
   ========================================================================= */
const Spot = (() => {
  const el = $('#spot');
  let author = null;
  function render() {
    if (author) {
      $('#spot-icon').innerHTML = avatar(author, true);
      $('#spot-title').textContent = 'Go to my booth';
      $('#spot-sub').textContent = 'Visitors look for you there';
    } else {
      $('#spot-title').textContent = Creator.has() ? 'Your book' : 'Make your book';
      $('#spot-sub').textContent = Creator.has() ? 'Edit it or get your postcard' : 'Put it in the fair';
    }
    el.classList.toggle('spot--author', !!author);
    $$('[data-do="mybooth"]').forEach((b) => { b.hidden = !author; });
    $$('[data-visitor]').forEach((b) => { b.hidden = !!author; });
    document.documentElement.classList.toggle('is-author', !!author);
  }
  function init() {
    el.hidden = false;
    render();
    el.addEventListener('click', () => {
      if (author) { AuthorHi.go(); return; }
      track('spot_creator');
      Creator.open();
    });
  }
  return { init, render, setAuthor(a) { author = a; render(); } };
})();

/* When an author opens their private link: a warm welcome and one clear first step */
const AuthorHi = (() => {
  const sheet = makeSheet('author-hi');
  const SEEN = 'lcc-fair-author-hi';
  let a = null;
  function go() {
    if (!a) return;
    sheet.close();
    goPlace('book-' + a.books[0]);
    track('author_go_booth', { author: a.id });
    setTimeout(() => toast(`<i>✦</i> You're at your booth. When visitors come by they can wave, and you can wave back${finePointer ? ' with <b>E</b>' : ''}.`, 7000), 2600);
  }
  function show(au) {
    a = au;
    Spot.setAuthor(au);
    const first = au.name.split(/\s+/)[0];
    const day = isEventDay() && !!ZOOM;
    const after = !!EventInfo && EventInfo.status().phase === 'after';
    $('#ah-face').innerHTML = avatar(au);
    $('#ah-title').textContent = `Welcome, ${first}`;
    const zs = $('#ah-zoom-step');
    zs.hidden = !ZOOM || after;
    zs.classList.toggle('is-first', day);
    $('#ah-zoom').href = ZOOM || '#';
    $('#ah-zoom').innerHTML = `${ZOOM_ICON} Join on Zoom`;
    $('#ah-zoom').classList.toggle('btn--gold', day);
    $('#ah-zoom').classList.toggle('btn--ghost', !day);
    $('#ah-go').classList.toggle('btn--gold', !day);
    $('#ah-go').classList.toggle('btn--ghost', day);
    $$('.ah__num', sheet.el).forEach((n, i) => { n.textContent = String(day ? 2 - i : i + 1); });
    let seen = false;
    try { seen = sessionStorage.getItem(SEEN) === au.id; sessionStorage.setItem(SEEN, au.id); } catch (e) { /* private mode */ }
    if (seen) toast(`<i>✦</i> Welcome back, ${esc(first)}. Visitors see you glowing gold.`, 6500, { label: 'Go to my booth', fn: go });
    else sheet.open();
  }
  function init() {
    $('#ah-go').addEventListener('click', go);
    $('#ah-zoom').addEventListener('click', () => track('zoom_join', { from: 'author' }));
  }
  return { init, show, go };
})();

/* =========================================================================
   The guided tour: the fair walks you through, with captions and optional narration
   ========================================================================= */
const Tour = (() => {
  const bar = $('#tourbar'), stepEl = $('#tourbar-step'), titleEl = $('#tourbar-title'), textEl = $('#tourbar-text');
  const prog = $('#tourbar-progress'), playBtn = $('#tour-play'), voiceBtn = $('#tour-voice');
  const synth = window.speechSynthesis || null;
  let steps = [], i = 0, active = false, playing = false, timer = 0, poll = 0, voice = store.get('lcc-fair-narrate', false);
  function build() {
    const up = EventInfo && EventInfo.upcoming();
    steps = [
      { id: 'welcome', title: 'Welcome to the fair', text: 'Life Coach Code is your host. Every book in this hall was written by a coach, a therapist or a leader. Let’s walk it together.' },
      { id: 'hall', title: 'The Grand Hall', text: `${BOOKS.length} booths, each with a book, its author beside it, and a piece that carries the spirit of the story.` },
      { id: 'oracle', title: 'The Book Oracle', text: 'Not sure where to begin? Answer three questions and the Oracle turns over the book that is waiting for you.' },
      ...BOOKS.map((b, k) => ({
        id: 'book-' + b.slug,
        title: `Booth ${k + 1} · ${b.title}`,
        text: `${isSoon(b) ? 'Coming soon. ' : ''}${b.hook} By ${authorName(b)}.`
      })),
      { id: 'speak', title: 'The Speak Your Book stage', text: up ? `On ${EventInfo.dateLong()} the authors speak here, live on Zoom. Registration is free.` : 'Where coaches learn to speak their book into being.' },
      { id: 'about', title: 'Life Coach Code', text: 'Four pillars, Spirit, Mind, Body and Heart, and a team that helps coaches get seen, get heard and get published.' },
      { id: 'finale', title: 'This pedestal is waiting', text: 'Your book could stand here next. Design your cover now, or book a free discovery call.' }
    ];
  }
  function render() {
    const st = steps[i];
    stepEl.textContent = `${i + 1} / ${steps.length}`;
    titleEl.textContent = st.title;
    textEl.textContent = st.text;
    prog.style.transform = `scaleX(${(i + 1) / steps.length})`;
    bar.classList.toggle('is-paused', !playing);
    playBtn.setAttribute('aria-label', playing ? 'Pause the tour' : 'Continue the tour');
    voiceBtn.setAttribute('aria-pressed', voice ? 'true' : 'false');
  }
  function clear() { clearTimeout(timer); clearInterval(poll); if (synth) synth.cancel(); }
  function go(k) {
    clear();
    i = clamp(k, 0, steps.length - 1);
    const st = steps[i];
    if (Detail.isOpen()) Detail.close();
    if (world) world.travelTo(st.id);
    Context.show(st.id);
    render();
    if (playing) arrive();
  }
  function arrive() {
    clearInterval(poll);
    poll = setInterval(() => {
      if (world && world.isTraveling()) return;
      clearInterval(poll);
      dwell();
    }, 200);
  }
  function dwell() {
    const st = steps[i];
    const advance = () => { if (playing) (i < steps.length - 1 ? go(i + 1) : finish()); };
    if (voice && synth) {
      const u = new SpeechSynthesisUtterance(`${st.title}. ${st.text}`);
      const v = synth.getVoices().find((x) => /^en(-|_)/i.test(x.lang) && /natural|google|samantha|daniel|serena/i.test(x.name)) || synth.getVoices().find((x) => /^en/i.test(x.lang));
      if (v) u.voice = v;
      u.rate = 0.98;
      const t0 = performance.now();
      u.onend = () => { timer = setTimeout(advance, Math.max(1200, 4000 - (performance.now() - t0))); };
      u.onerror = () => { timer = setTimeout(advance, 6000); };
      synth.speak(u);
    } else timer = setTimeout(advance, Math.max(6500, st.text.length * 45));
  }
  function start() {
    if (!world) { goPlace('hall'); return; }
    build();
    active = true;
    playing = true;
    bar.hidden = false;
    document.documentElement.classList.add('is-touring');
    go(0);
    Sound.play('step');
    track('tour_start');
  }
  function stop() {
    clear();
    active = false;
    playing = false;
    bar.hidden = true;
    document.documentElement.classList.remove('is-touring');
  }
  function finish() {
    stop();
    Petals.burst();
    Sound.play('win');
    toast('<i>✦</i> That was the whole fair. Thank you for walking it with us', 5200, EventInfo && EventInfo.upcoming() ? { label: 'Register for the live event', fn: () => EventUI.open() } : null);
    track('tour_complete');
  }
  function pause() { if (!active || !playing) return; playing = false; clear(); render(); }
  function resume() { if (!active || playing) return; playing = true; render(); arrive(); }
  function init() {
    playBtn.addEventListener('click', () => (playing ? pause() : resume()));
    $('#tour-next').addEventListener('click', () => { if (i < steps.length - 1) go(i + 1); else finish(); });
    $('#tour-prev').addEventListener('click', () => go(i - 1));
    $('#tour-stop').addEventListener('click', stop);
    if (!synth) voiceBtn.hidden = true;
    voiceBtn.addEventListener('click', () => {
      voice = !voice;
      store.set('lcc-fair-narrate', voice);
      render();
      if (!voice && synth) synth.cancel();
      if (voice && playing && world && !world.isTraveling()) { clear(); dwell(); }
    });
  }
  return { init, start, stop, pause, isActive: () => active, userMoved: () => { if (active && playing) pause(); } };
})();

/* =========================================================================
   The "more" menu and every [data-do] button
   ========================================================================= */
function doAction(name) {
  switch (name) {
    case 'tour': Tour.isActive() ? Tour.stop() : Tour.start(); break;
    case 'event': EventUI.open(); break;
    case 'people': People.open(); break;
    case 'creator': Creator.open(); break;
    case 'postcard': Creator.postcard(); break;
    case 'photo': takePhoto(); break;
    case 'map': MapPanel.open(); break;
    case 'sound': Sound.toggle(); break;
    case 'guide': if (Guide) Guide.open(); break;
    case 'watch': LiveStream.open(); break;
    case 'passport': Passport.open(); break;
    case 'mybooth': AuthorHi.go(); break;
    case 'between': Between.open(); break;
    case 'breathe': Breathe.open(); break;
    case 'lantern': Lantern.open(); break;
    case 'quiz': Oracle.restart(); goPlace('oracle'); Context.expand(); setTimeout(Oracle.focus, 400); break;
    default:
  }
}

/* =========================================================================
   The live talks: a window beside you as you walk, bigger, or full screen
   ========================================================================= */
const LiveStream = (() => {
  const S = (EVENT && EVENT.stream) || {};
  const el = $('#live'), frame = $('#live-frame');
  // YouTube and Vimeo links become their embeddable players; anything else is used as given
  function toEmbed(u) {
    if (!u || !/^https:\/\//.test(u)) return '';
    let m = u.match(/(?:youtube\.com\/(?:watch\?v=|live\/|embed\/)|youtu\.be\/)([\w-]{6,})/);
    if (m) return `https://www.youtube-nocookie.com/embed/${m[1]}?autoplay=1&playsinline=1&rel=0`;
    m = u.match(/vimeo\.com\/event\/(\d+)/);
    if (m) return `https://vimeo.com/event/${m[1]}/embed`;
    m = u.match(/vimeo\.com\/(\d+)/);
    if (m) return `https://player.vimeo.com/video/${m[1]}?autoplay=1`;
    return u;
  }
  const src = toEmbed(S.url);
  const phase = () => (EventInfo ? EventInfo.status().phase : 'after');
  function setMode(mode) {
    el.dataset.mode = mode;
    document.documentElement.classList.toggle('is-watching', mode !== 'min');
    document.documentElement.classList.toggle('is-theatre', mode === 'theatre');
  }
  function open(mode = 'dock') {
    if (!src) { EventUI.open(); return; }
    if (!frame.getAttribute('src')) frame.src = src;
    el.hidden = false;
    setMode(mode);
    track('stream_open', { mode });
  }
  function close() {
    el.hidden = true;
    frame.removeAttribute('src');
    document.documentElement.classList.remove('is-watching', 'is-theatre');
  }
  function init() {
    if (!src) return;
    $$('[data-do="watch"]').forEach((b) => { b.hidden = false; });
    if (S.zoom) { const z = $('#live-zoom'); z.href = S.zoom; z.hidden = false; }
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-live]');
      if (!b) { if (el.dataset.mode === 'min' && e.target.closest('.live__bar')) setMode('dock'); return; }
      const a = b.getAttribute('data-live');
      if (a === 'close') close();
      if (a === 'min') setMode(el.dataset.mode === 'min' ? 'dock' : 'min');
      if (a === 'theatre') setMode(el.dataset.mode === 'theatre' ? 'dock' : 'theatre');
      if (a === 'full') { const f = el.requestFullscreen || el.webkitRequestFullscreen; if (f) f.call(el); else setMode('theatre'); }
    });
    // on the day, the talks open by themselves in the corner (once per visit)
    if (phase() === 'live' && !sessionStorage.getItem('lcc-fair-stream')) {
      try { sessionStorage.setItem('lcc-fair-stream', '1'); } catch (e) { /* private mode */ }
      setTimeout(() => open('dock'), 4000);
    }
  }
  return { init, open, close, available: () => !!src, isOn: () => !!src && ['live', 'today', 'soon'].includes(phase()) };
})();

/* =========================================================================
   Between the talks: what is on now and next, and three things to do meanwhile
   ========================================================================= */
const Between = (() => {
  const el = $('#between');
  const SEEN = 'lcc-fair-between';
  function render(n) {
    const next = $('#bt-next');
    const ps = n ? null : Program.state();
    const up = n ? n : ps && ps.next && authorById[ps.next.author] ? { kind: 'break', s: ps.next, a: authorById[ps.next.author] } : null;
    const talk = !!up && up.kind === 'talk';
    $('#bt-eyebrow').textContent = talk ? 'Speaking now' : n ? 'Between the talks' : 'Things to do';
    $('#bt-title').textContent = talk ? 'While you listen, wander' : 'Take a moment in the fair';
    next.hidden = !up;
    if (!up) return;
    const { s, a } = up;
    const go = talk
      ? `${LiveStream.available() ? '<button class="btn btn--gold btn--sm" type="button" data-do="watch">Watch here</button>' : ''}${ZOOM ? `<a class="btn btn--ghost btn--sm btn--zoom" href="${esc(ZOOM)}" target="_blank" rel="noopener">${ZOOM_ICON} Join on Zoom</a>` : ''}`
      : `${Reminders.button(s, 'btn btn--ghost btn--sm')}<button class="btn btn--ghost btn--sm" type="button" data-place="book-${a.books[0]}">Visit the booth</button>`;
    const when = talk ? 'Now speaking' : `Next up · ${s.time}${s.start > new Date() ? ` · in ${Program.minsTo(s)} min` : ''}`;
    next.innerHTML = `<div class="between__who">${avatar(a, true)}<span><small>${esc(when)}</small><b>${esc(a.displayName)}</b>${s.title ? `<em>${esc(s.title)}</em>` : ''}</span></div><div class="card__actions">${go}</div>`;
  }
  function open(n) { render(n || EventUI.now()); el.hidden = false; track('between_open'); }
  function close() { el.hidden = true; }
  // called every 30 seconds: at the start of each break the card appears once by itself
  function check(n) {
    if (!el.hidden) render(n || EventUI.now());
    if (!n || n.kind !== 'break') return;
    let seen = '';
    try { seen = sessionStorage.getItem(SEEN) || ''; sessionStorage.setItem(SEEN, n.s.key); } catch (e) { /* private mode */ }
    if (seen === n.s.key) return;
    if (!Overlays.size && !Detail.isOpen() && !Tour.isActive()) open(n);
    else toast('<i>✦</i> A break between the talks', 7000, { label: 'Things to do', fn: () => open() });
  }
  function init() {
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-between-close], [data-do]')) { close(); return; }
      const p = e.target.closest('[data-place]');
      if (p) { close(); goPlace(p.getAttribute('data-place')); }
    });
    el.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  }
  return { init, open, close, check };
})();

/* =========================================================================
   A breathing minute with the four pillars
   ========================================================================= */
const Breathe = (() => {
  const sheet = makeSheet('breathe', { onClose: () => stop() });
  const orb = $('#br-orb'), cue = $('#br-cue'), word = $('#br-word'), left = $('#br-left');
  const PHASES = [['in', 'Breathe in', 4], ['hold', 'Hold', 2], ['out', 'Breathe out', 6]];
  const WORDS = [['Spirit', 'I am guided'], ['Mind', 'I am clear'], ['Body', 'I am here'], ['Heart', 'I am loved']];
  const synth = window.speechSynthesis || null;
  let minutes = 1, timer = 0, tick = 0, endAt = 0, cycle = 0, running = false;
  function say(text) {
    if (!synth || !$('#br-voice').checked) return;
    try { synth.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 0.8; u.pitch = 0.95; synth.speak(u); } catch (e) { /* voice is a bonus */ }
  }
  function clock() {
    const s = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    left.textContent = `${Math.floor(s / 60)}:${pad2(s % 60)}`;
  }
  function phase(i) {
    if (!running) return;
    if (i === 0 && Date.now() >= endAt) { finish(); return; }
    const [k, text, sec] = PHASES[i];
    if (i === 0) {
      const w = WORDS[cycle % WORDS.length];
      word.innerHTML = `<b>${w[0]}</b> · ${w[1]}`;
      cycle++;
    }
    orb.style.setProperty('--dur', `${sec}s`);
    orb.dataset.phase = k;
    cue.textContent = text;
    say(text);
    timer = setTimeout(() => phase((i + 1) % PHASES.length), sec * 1000);
  }
  function start() {
    running = true;
    cycle = 0;
    endAt = Date.now() + minutes * 60000;
    $('#br-setup').hidden = true;
    $('#br-run').hidden = false;
    clock();
    tick = setInterval(clock, 500);
    track('breathe_start', { minutes });
    phase(0);
  }
  function stop() {
    running = false;
    clearTimeout(timer);
    clearInterval(tick);
    if (synth) synth.cancel();
    orb.dataset.phase = '';
    $('#br-setup').hidden = false;
    $('#br-run').hidden = true;
    cue.textContent = 'Sit comfortably, soften your shoulders.';
    word.textContent = '';
  }
  function finish() {
    running = false;
    clearInterval(tick);
    orb.dataset.phase = 'rest';
    cue.textContent = 'Welcome back.';
    word.innerHTML = '<b>✦</b> Take this calm with you through the fair.';
    say('Welcome back.');
    Sound.play('win');
    track('breathe_done', { minutes });
    timer = setTimeout(() => { sheet.close(); toast('<i>✦</i> A calmer breath, a clearer heart. Welcome back to the fair.', 5000); }, 4500);
  }
  function init() {
    sheet.el.addEventListener('click', (e) => {
      const m = e.target.closest('[data-br-min]');
      if (m) { minutes = +m.getAttribute('data-br-min'); $$('[data-br-min]', sheet.el).forEach((x) => x.setAttribute('aria-pressed', x === m ? 'true' : 'false')); }
    });
    $('#br-start').addEventListener('click', start);
    $('#br-stop').addEventListener('click', () => { stop(); sheet.close(); });
  }
  return { init, open() { stop(); sheet.open(); track('breathe_open'); } };
})();

/* =========================================================================
   Wishing lanterns: write an intention, let it rise for everyone in the fair to see
   ========================================================================= */
const Lantern = (() => {
  const sheet = makeSheet('lantern-panel', { onOpen: () => setTimeout(() => { if (finePointer) $('#lt-text').focus({ preventScroll: true }); }, 80) });
  const IDEAS = ['The courage to begin', 'Healing for my family', 'Gratitude for the people who carried me', 'May my story help someone', 'Peace in my heart'];
  let lastToast = 0;
  function card(text) {
    const c = K.makeIntentionCard({ text, name: People.myName(), logo: LOGO, lines: { footer: 'The Virtual Book Fair · Life Coach Code' } });
    Keepsake.show(c, { title: 'Your intention', eyebrow: 'A wishing lantern from the fair', filename: 'my-intention.jpg', text: 'My wishing lantern from the Virtual Book Fair by Life Coach Code.' });
    track('lantern_card');
  }
  function release(text) {
    sheet.close();
    track('lantern_release', { shared: People.lantern() });
    if (!world) { if (text) card(text); return; }
    world.releaseLantern({ mine: true });
    Sound.play('win');
    setTimeout(() => toast('<i>✦</i> Your lantern is rising over the fair. Look up.', 9000, text ? { label: 'Keep my words', fn: () => card(text) } : null), 600);
  }
  function fromPeer(peer) {
    if (!world) return;
    world.releaseLantern(world.peerPos(peer.id) || {});
    if (Date.now() - lastToast < 15000) return;
    lastToast = Date.now();
    const who = peer.author ? peer.author.name : peer.name || 'A visitor';
    toast(`<i>✦</i> ${esc(who)} released a wishing lantern`, 5000, { label: 'Release one too', fn: open });
  }
  function open() { sheet.open(); track('lantern_open'); }
  function init() {
    $('#lt-ideas').innerHTML = IDEAS.map((t) => `<button class="chip" type="button" data-idea>${esc(t)}</button>`).join('');
    sheet.el.addEventListener('click', (e) => {
      const i = e.target.closest('[data-idea]');
      if (i) { $('#lt-text').value = i.textContent; $('#lt-text').focus({ preventScroll: true }); }
    });
    $('#lt-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const text = $('#lt-text').value.replace(/\s+/g, ' ').trim().slice(0, 120);
      $('#lt-text').value = '';
      release(text);
    });
  }
  return { init, open, fromPeer };
})();

let Guide = null;
const More = (() => {
  const btn = $('#more-btn'), menu = $('#more');
  function set(open) {
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) setTimeout(() => { const f = $('button, a', menu); if (f) f.focus({ preventScroll: true }); }, 20);
  }
  function init() {
    btn.addEventListener('click', (e) => { e.stopPropagation(); set(menu.hidden); });
    document.addEventListener('click', (e) => { if (!menu.hidden && !e.target.closest('#more, #more-btn')) set(false); });
    menu.addEventListener('keydown', (e) => { if (e.key === 'Escape') { set(false); btn.focus(); } });
    document.addEventListener('click', (e) => {
      const d = e.target.closest('[data-do]');
      if (!d) return;
      if (menu.contains(d)) set(false);
      doAction(d.getAttribute('data-do'));
    });
    Sound.onChange((on) => $$('[data-sound-label]').forEach((el) => { el.textContent = on ? 'Music off' : 'Music on'; }));
  }
  return { init };
})();

/* =========================================================================
   Small pieces
   ========================================================================= */
function initStats() {
  const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
    'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
  const authors = new Set(BOOKS.map((b) => b.author)).size;
  const soon = BOOKS.filter(isSoon).length;
  const vals = { books: BOOKS.length, authors, soon, 'books-word': WORDS[BOOKS.length] || BOOKS.length };
  $$('[data-stat]').forEach((el) => {
    const k = el.dataset.stat;
    if (k in vals) el.textContent = vals[k];
    if (k === 'soon' && !soon) el.closest('li').hidden = true;
  });
  $('#year').textContent = new Date().getFullYear();
}

function initSoundUI() {
  const btn = $('#sound-btn'), pill = $('#music-pill');
  const ui = (on) => {
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute('aria-label', on ? 'Turn music off' : 'Turn music on');
    pill.setAttribute('aria-pressed', on ? 'true' : 'false');
    $('.music-pill__text', pill).textContent = on ? 'Music is playing · tap to pause' : 'Play the fair’s music';
  };
  btn.addEventListener('click', Sound.toggle);
  pill.addEventListener('click', Sound.toggle);
  Sound.onChange(ui);
  ui(false);
}

function initTooltip() {
  const tip = $('#tooltip');
  return (info, x, y) => {
    if (!info || !finePointer) { tip.classList.remove('is-visible'); delete tip.dataset.key; return; }
    const key = info.kind + (info.slug || info.pillar || '');
    if (tip.dataset.key !== key) {
      let text;
      if (info.kind === 'book') {
        const b = bySlug[info.slug];
        text = `<b>${esc(b.title)}</b><span>by ${esc(authorName(b))} · click to open</span>`;
      } else {
        const l = ACTION_LABELS[info.kind](info);
        text = `<b>${esc(l.what)}</b><span>${esc(l.verb)}</span>`;
      }
      tip.innerHTML = text;
      tip.dataset.key = key;
      Sound.play('hover');
    }
    tip.style.transform = `translate(${Math.round(x + 18)}px, ${Math.round(y + 18)}px)`;
    tip.classList.add('is-visible');
  };
}

function initLinks() {
  document.addEventListener('click', (e) => {
    const out = e.target.closest('a[href^="http"]');
    if (out) {
      const h = out.href;
      const cur = Detail.current();
      if (EVENT && h === EVENT.register) track('register_click');
      else if (ZOOM && h === ZOOM) track('zoom_join');
      else if (h === LINKS.discovery) track('discovery_click');
      else if (/amazon\./.test(h)) track('amazon_click', { slug: cur ? cur.slug : '' });
    }
    const o = e.target.closest('[data-open]');
    if (o) { Detail.open(o.getAttribute('data-open')); return; }
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    if (!id || id.startsWith('booth/')) return;
    const target = document.getElementById(id);
    if (!target || !target.classList.contains('chapter')) return;
    if (document.documentElement.classList.contains('no-webgl')) return;
    e.preventDefault();
    goPlace(id);
  });
}

/* =========================================================================
   Boot
   ========================================================================= */
function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch (e) { return false; }
}

async function boot() {
  initStats();
  buildBookChapters();
  Context.init();
  Sound.init();
  initSoundUI();
  Passport.init();
  Detail.init();
  MapPanel.init();
  Prompt.init();
  Oracle.init();
  initLinks();
  initKeys();
  initJoystick();
  EventUI.init();
  People.init();
  Creator.init();
  Spot.init();
  AuthorHi.init();
  Tour.init();
  More.init();
  LiveStream.init();
  Reminders.init();
  Between.init();
  Breathe.init();
  Lantern.init();
  const G = window.FAIR_GUIDE || {};
  if (G.enabled !== false) {
    Guide = createGuide({
      data: { BOOKS, AUTHORS, EVENT, LINKS, STANDS: window.FAIR_STANDS || {}, CFG: G },
      eventInfo: EventInfo,
      store,
      track,
      zone: () => (world ? world.zone() : Context.current()),
      act: {
        goto: (id) => goPlace(id),
        book: (slug) => Detail.open(slug),
        author: (id) => AuthorPanel.open(id),
        message: (id) => AuthorPanel.open(id, { message: true }),
        event: () => EventUI.open(),
        creator: () => Creator.open(),
        tour: () => Tour.start(),
        watch: () => LiveStream.open(),
        canWatch: () => LiveStream.available(),
        remind: (id) => Reminders.setFor(id),
        canRemind: (id) => Reminders.canFor(id),
        breathe: () => Breathe.open(),
        lantern: () => Lantern.open(),
        quiz: () => doAction('quiz'),
        between: () => Between.open()
      }
    });
    Guide.hello();
  } else $('#guide').hidden = true;
  $('#photo-btn').addEventListener('click', takePhoto);

  const loader = $('#loader'), loaderBar = $('#loader-bar'), loaderMsg = $('#loader-msg');
  const messages = ['Lighting the lanterns…', 'Polishing the marble…', 'Setting out the books…', 'Opening the doors…'];
  const setLoad = (p) => {
    loaderBar.style.transform = `scaleX(${p.toFixed(3)})`;
    loaderMsg.textContent = messages[Math.min(messages.length - 1, Math.floor(p * messages.length))];
  };
  const finishLoading = () => {
    loader.classList.add('is-done');
    document.documentElement.classList.add('is-ready');
    setTimeout(() => loader.remove(), 1400);
  };

  if (!webglAvailable()) {
    document.documentElement.classList.add('no-webgl');
    finishLoading();
    Detail.sync();
    return;
  }

  document.documentElement.classList.add('is-3d');
  Context.show('welcome');
  try {
    const { createWorld } = await import('./world.js');
    const tooltip = initTooltip();
    world = await createWorld({
      canvas: $('#world'),
      books: BOOKS,
      authors: AUTHORS.map((a) => ({ id: a.id, name: a.displayName, books: a.books, photo: a.photo || '', mono: initials(a.name) })),
      leftInset: () => {
        const r = $('#tour').getBoundingClientRect();
        return clamp((r.right + 8) / window.innerWidth, 0, 0.5);
      },
      signs: EventUI.signs(),
      onPage: (r) => Detail.pageChanged(r),
      onProgress: setLoad,
      onHover: (info, x, y) => tooltip(Detail.isOpen() ? null : info, x, y),
      onSelect: (info) => interact(info),
      onZone: (id) => { if (!Detail.isOpen()) Context.show(id); if (Guide) Guide.zoneChanged(id); },
      onNear: (info) => Prompt.set(info),
      onMoved: () => Hints.moved()
    });
    setLoad(1);
    if (new URLSearchParams(location.search).has('debug')) window.__fair = world;
    Creator.apply();
    Sound.worldReady();
    People.start();
    // on phones the controls hint steps aside by itself, leaving the fair clear to explore
    if (!finePointer) setTimeout(() => Hints.moved(), 5000);
    const hashId = location.hash.slice(1);
    const startPlace = hashId && !hashId.startsWith('booth/') && world.places.some((p) => p.id === hashId) ? hashId : null;
    if (startPlace) { world.travelTo(startPlace, { instant: true }); Context.show(startPlace); }
    world.startIntro(!!startPlace || reduceMotion);
    setTimeout(finishLoading, 250);
  } catch (err) {
    console.error('The 3D fair could not start:', err);
    document.documentElement.classList.remove('is-3d');
    document.documentElement.classList.add('no-webgl');
    finishLoading();
  }
  Detail.sync();
}

boot();
