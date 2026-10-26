/*
 * The Virtual Book Fair: page logic.
 * Scrolling walks the camera through the 3D hall (world.js); everything you read is regular HTML
 * layered on top, so the fair still works (as a styled page) where WebGL is unavailable.
 */
const BOOKS = window.FAIR_BOOKS || [];
const INTENTS = window.FAIR_INTENTS || [];
const STORES = window.FAIR_STORES || [];
const LINKS = window.FAIR_LINKS || {};

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
const coverSrc = (b, size) => `assets/img/covers/${b.slug}-${size}.webp`;
const pad2 = (n) => String(n).padStart(2, '0');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return Math.abs(h); };
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
};
const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const BASE_TITLE = document.title;

let world = null;

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
    win: () => [0, 2, 4, 5, 7, 8].forEach((k, i) => bell(BELL[k], 0.55, i * 0.12))
  };
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
    notify();
  }
  function disable() {
    store.set(KEY, false);
    if (!on) { notify(); return; }
    on = false;
    clearTimeout(chordTimer);
    clearTimeout(chimeTimer);
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
  return { init, toggle, play, onChange: (fn) => listeners.push(fn), isOn: () => on };
})();

/* =========================================================================
   Toasts + petals
   ========================================================================= */
function toast(html, ms = 3200) {
  const wrap = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = html;
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
    if (world) world.setInputEnabled(false);
    setTimeout(() => $('.passport__close', el).focus({ preventScroll: true }), 30);
  }
  function close() {
    el.hidden = true;
    fresh = null;
    if (world && !Detail.isOpen() && !MapPanel.isOpen()) world.setInputEnabled(true);
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
    if (got.length === BOOKS.length) setTimeout(() => { Petals.burst(); Sound.play('win'); open(); }, 1500);
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
  }
  return { init, stamp, has, isOpen: () => !el.hidden };
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

  function html(b) {
    const soon = isSoon(b);
    const more = BOOKS.filter((x) => x.author === b.author && x !== b);
    let h = `<img class="detail__cover" src="${coverSrc(b, 800)}" alt="Cover of ${esc(b.title)}">
      <div class="bi__meta">${soon ? '<span class="badge--soon">Coming soon</span>' : ''}${b.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
      <h2 class="bi__title" id="detail-title">${esc(b.title)}</h2>
      <p class="bi__subtitle">${esc(b.subtitle)}</p>
      <p class="bi__author">by <b>${esc(authorName(b))}</b>${b.credentials ? ', ' + esc(b.credentials) : ''}</p>
      <blockquote class="bi__hook">${esc(b.hook)}</blockquote>
      ${b.description.map((p) => `<p class="bi__desc">${esc(p)}</p>`).join('')}
      <h3 class="bi__h">Inside you’ll find</h3>
      <ul class="bi__inside">${b.inside.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      ${b.steps ? `<h3 class="bi__h">${esc(b.steps.title)}</h3><ol class="bi__steps">${b.steps.items.map((st, i) => `<li><span>${i + 1}</span><div><b>${esc(st.name)}</b><p>${esc(st.text)}</p></div></li>`).join('')}</ol>` : ''}
      <p class="bi__for"><span>Perfect for</span>${esc(b.forWho)}</p>`;
    if (soon) {
      h += `<div class="bi__soon"><p><b>On its way to the shelves.</b>This book is coming soon. While you wait: is there a book inside you, too? Life Coach Code helps coaches speak their book into being.</p>
        <div class="bi__buy"><a class="btn btn--gold btn--lg" href="${LINKS.discovery}" target="_blank" rel="noopener">Book a free discovery call ${ARROW}</a>
        <button class="btn btn--ghost btn--sm" type="button" data-share>Share this booth</button></div></div>`;
    } else {
      h += `<div class="bi__buy"><a class="btn btn--gold btn--lg" href="${esc(b.amazon.url)}" target="_blank" rel="noopener">Buy on ${esc(b.amazon.store)} ${ARROW}</a>
        <button class="btn btn--ghost btn--sm" type="button" data-share>Share this book</button></div>
        <p class="bi__stores"><span>Shopping from elsewhere?</span>${storeLinks(b)}</p>`;
    }
    if (more.length) {
      h += `<div class="bi__more"><h3 class="bi__h">More from ${esc(b.author)}</h3><div class="bi__more-list">${more.map((x) =>
        `<button type="button" data-goto="${x.slug}" aria-label="Visit the booth for ${esc(x.title)}"><img src="${coverSrc(x, 480)}" alt="" loading="lazy"></button>`).join('')}</div></div>`;
    }
    h += '<p class="bi__stamp"><i aria-hidden="true">✓</i> Passport stamp collected at this booth</p>';
    return h;
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
    panel.scrollTop = 0;
    countEl.textContent = `Booth ${pad2(BOOKS.indexOf(b) + 1)} of ${pad2(BOOKS.length)}`;
    if (world) world.focus(slug);
    Context.show('book-' + slug);
    Sound.play('open');
    Passport.stamp(slug);
    document.title = `${b.title} · The Virtual Book Fair`;
    setTimeout(() => { const x = $('.detail__close', el); if (x) x.focus({ preventScroll: true }); }, 60);
  }
  function hide() {
    if (!current) return;
    current = null;
    el.classList.remove('is-open');
    document.documentElement.classList.remove('is-focused');
    if (world) { world.focus(null); world.setInputEnabled(true); }
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
    });
    $('#detail-prev').addEventListener('click', () => step(-1));
    $('#detail-next').addEventListener('click', () => step(1));
    document.addEventListener('keydown', (e) => {
      if (!current || Passport.isOpen()) return;
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'Tab' && el.contains(document.activeElement)) { trapFocus(e, panel); return; }
      if (e.target.closest && e.target.closest('a, input, select, textarea')) return;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') step(1);
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') step(-1);
    });
    window.addEventListener('hashchange', sync);
  }
  return { init, open, close, sync, isOpen: () => !!current };
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
        ? BOOKS.map((b, i) => `<li><button type="button" class="map__book" data-place="book-${b.slug}"><img src="${coverSrc(b, 480)}" alt="" loading="lazy"><span><small>Booth ${pad2(i + 1)}${isSoon(b) ? ' · coming soon' : ''}</small>${esc(b.title)}</span>${Passport.has(b.slug) ? '<i class="map__stamp" aria-label="stamp collected">✓</i>' : ''}</button></li>`).join('')
        : g.ids.map((id) => `<li><button type="button" class="map__place" data-place="${id}">${esc(LABELS[id])}</button></li>`).join('');
      return `<div class="map__group"><h3>${esc(g.title)}</h3><ul class="${g.books ? 'map__books' : 'map__places'}">${items}</ul></div>`;
    }).join('');
  }
  function open() {
    lastFocus = document.activeElement;
    render();
    el.hidden = false;
    if (world) world.setInputEnabled(false);
    setTimeout(() => { const b = $('.map__close', el); if (b) b.focus({ preventScroll: true }); }, 30);
  }
  function close() {
    el.hidden = true;
    if (world && !Detail.isOpen()) world.setInputEnabled(true);
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
  ghost: () => ({ verb: 'Claim this pedestal', what: 'Your book here' })
};

function interact(info) {
  if (!info) return;
  switch (info.kind) {
    case 'book': Detail.open(info.slug); break;
    case 'oracle':
      Context.show('oracle');
      Context.expand();
      Sound.play('flip');
      setTimeout(() => { const c = $('#oracle-chips .chip'); if (c && finePointer) c.focus({ preventScroll: true }); }, 200);
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
      Petals.burst();
      break;
    default:
  }
}

const Prompt = (() => {
  const el = $('#act'), verb = $('#act-verb'), what = $('#act-what');
  let info = null;
  function set(next) {
    info = next;
    if (!info || Detail.isOpen()) { el.classList.remove('is-visible'); return; }
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
    if (Passport.isOpen()) return;
    if ((e.key === 'm' || e.key === 'M') && !Detail.isOpen()) { MapPanel.isOpen() ? MapPanel.close() : MapPanel.open(); return; }
    if (MapPanel.isOpen() || Detail.isOpen()) return;
    if (e.key === 'e' || e.key === 'E') { interact(Prompt.get()); return; }
    if (['w', 'a', 's', 'd', 'W', 'A', 'S', 'D', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      Hints.moved();
      // walking keys belong to the fair, not to a focused button
      if (document.activeElement && document.activeElement !== document.body && document.activeElement.closest('.tour, .hud')) document.activeElement.blur();
    }
  });
}

/* =========================================================================
   The Book Oracle
   ========================================================================= */
function initOracle() {
  const chips = $('#oracle-chips'), card = $('#oracle-card'), front = $('#oracle-front');
  let last = null, busy = false;
  chips.innerHTML = INTENTS.map((it, i) => `<button class="chip" type="button" data-intent="${i}" aria-pressed="false">${esc(it.label)}</button>`).join('') +
    '<button class="chip chip--surprise" type="button" data-intent="surprise" aria-pressed="false">✦ Surprise me</button>';
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
  chips.addEventListener('click', (e) => {
    const c = e.target.closest('[data-intent]');
    if (!c || busy) return;
    $$('[data-intent]', chips).forEach((x) => x.setAttribute('aria-pressed', x === c ? 'true' : 'false'));
    const key = c.getAttribute('data-intent');
    let pool = key === 'surprise' ? BOOKS.slice() : INTENTS[+key].books.map((s) => bySlug[s]).filter(Boolean);
    if (pool.length > 1) pool = pool.filter((b) => b !== last);
    reveal(pool[Math.floor(Math.random() * pool.length)]);
  });
  card.addEventListener('click', (e) => {
    const w = e.target.closest('[data-walk]');
    if (w) goPlace('book-' + w.getAttribute('data-walk'));
  });
}

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
  initOracle();
  initLinks();
  initKeys();
  initJoystick();

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
      onProgress: setLoad,
      onHover: (info, x, y) => tooltip(Detail.isOpen() ? null : info, x, y),
      onSelect: (info) => interact(info),
      onZone: (id) => { if (!Detail.isOpen()) Context.show(id); },
      onNear: (info) => Prompt.set(info),
      onMoved: () => Hints.moved()
    });
    setLoad(1);
    if (new URLSearchParams(location.search).has('debug')) window.__fair = world;
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
