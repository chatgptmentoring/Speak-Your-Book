/*
 * Spatial soundscapes: every booth has a quiet sound of its own, placed in 3D at the piece
 * beside the stand. Walk past and you hear water at the pond, fire at the burning
 * blueprints, birdsong at the birdcage. Only the three nearest booths ever play.
 */
const THEMES = {
  'finding-love-in-the-mirror': 'glass',
  'clarity-before-momentum': 'dawn',
  'teen-mental-health': 'plucks',
  'the-invisible-midlife-woman': 'water',
  'conscious-integrative-therapy': 'bowl',
  'more-than-a-game': 'ticks',
  'food-isnt-the-problem': 'three',
  'prince-and-the-prodigal': 'crickets',
  'journey-to-empowerment': 'leaves',
  'when-the-blueprint-burned': 'fire',
  'everything-happens-for-you': 'sand',
  'healing-unraveled': 'birds',
  'life-is-happening-now': 'leaves',
  'truly-yours-life': 'dawn',
  'curiously-certain': 'plucks',
  'how-to-build-yourself-up': 'dawn'
};
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const rnd = (a, b) => a + Math.random() * (b - a);

export function createAmbience(ctx, out, { hrtf = true } = {}) {
  const bus = ctx.createGain();
  bus.gain.value = 0.9;
  bus.connect(out);
  const noiseBuf = (() => {
    const len = ctx.sampleRate * 2, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  })();
  const voices = new Map();

  /* building blocks */
  function bed(dest, type, freq, q, level, lfoRate = 0, lfoDepth = 0) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    src.loopStart = Math.random();
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = level;
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    src.start();
    const nodes = [src];
    if (lfoRate) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = lfoRate;
      lg.gain.value = lfoDepth;
      lfo.connect(lg);
      lg.connect(g.gain);
      lfo.start();
      nodes.push(lfo);
    }
    return nodes;
  }
  function ping(dest, freq, level, decay, type = 'sine', when = 0, attack = 0.005) {
    const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + decay + 0.05);
    return o;
  }
  function chirp(dest, f0, f1, dur, level, when = 0) {
    const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + dur * 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  function burst(dest, type, freq, q, dur, level) {
    const t = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf;
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(dest);
    s.start(t, Math.random());
    s.stop(t + dur + 0.02);
  }

  function makeVoice(kind, dest) {
    const nodes = [];
    let alive = true;
    const every = (min, max, fn) => {
      const loop = () => { if (!alive) return; fn(); setTimeout(loop, rnd(min, max)); };
      setTimeout(loop, rnd(0, max));
    };
    switch (kind) {
      case 'water':
        nodes.push(...bed(dest, 'lowpass', 480, 0.7, 0.16, 0.3, 0.09));
        every(900, 2600, () => chirp(dest, rnd(260, 380), rnd(600, 900), 0.08, 0.05));
        break;
      case 'dawn':
        nodes.push(...bed(dest, 'bandpass', 700, 0.5, 0.1, 0.12, 0.06));
        every(2500, 6000, () => { const f = rnd(2600, 3400); [0, 0.14, 0.28].forEach((w) => chirp(dest, f, f * 1.35, 0.09, 0.035, w)); });
        break;
      case 'plucks':
        every(700, 1800, () => ping(dest, mtof([72, 74, 76, 79, 81, 84][Math.floor(Math.random() * 6)]), 0.05, 0.9, 'triangle'));
        break;
      case 'bowl': {
        const strike = () => [[220, 0.05], [220 * 2.71, 0.025], [220 * 5.15, 0.012]].forEach(([f, l]) => { ping(dest, f, l, 7, 'sine', 0, 0.02); ping(dest, f * 1.004, l * 0.7, 7, 'sine', 0, 0.02); });
        every(6500, 9000, strike);
        break;
      }
      case 'ticks':
        every(950, 1050, () => burst(dest, 'bandpass', 3200, 6, 0.03, 0.08));
        break;
      case 'three':
        every(5500, 7500, () => [76, 79, 84].forEach((m, i) => ping(dest, mtof(m), 0.04, 2.2, 'sine', i * 0.42)));
        break;
      case 'crickets':
        every(600, 1500, () => { for (let i = 0; i < 3; i++) ping(dest, rnd(4200, 4500), 0.018, 0.05, 'sine', i * 0.07); });
        break;
      case 'leaves':
        every(1500, 4200, () => burst(dest, 'highpass', 3000, 0.4, rnd(0.3, 0.7), 0.035));
        every(4000, 8000, () => ping(dest, mtof(88 + Math.floor(Math.random() * 5)), 0.02, 1.4));
        break;
      case 'fire':
        nodes.push(...bed(dest, 'lowpass', 180, 0.6, 0.12, 0.2, 0.05));
        every(50, 260, () => burst(dest, 'highpass', rnd(1500, 4000), 0.8, rnd(0.008, 0.03), rnd(0.03, 0.12)));
        break;
      case 'sand':
        nodes.push(...bed(dest, 'highpass', 5200, 0.3, 0.035));
        every(2800, 3200, () => ping(dest, 1760, 0.012, 0.4));
        break;
      case 'birds':
        every(1800, 4800, () => {
          const base = rnd(2200, 3200), n = 2 + Math.floor(Math.random() * 4);
          for (let i = 0; i < n; i++) chirp(dest, base * rnd(0.9, 1.1), base * rnd(1.2, 1.6), 0.07, 0.03, i * 0.11);
        });
        break;
      default:
        every(1800, 3800, () => { const f = rnd(1700, 2700); ping(dest, f, 0.025, 1.6); ping(dest, f * 2.76, 0.006, 0.7); });
    }
    return { stop() { alive = false; nodes.forEach((n) => { try { n.stop(); } catch (e) { /* already stopped */ } }); } };
  }

  function voiceFor(a) {
    const panner = ctx.createPanner();
    panner.panningModel = hrtf ? 'HRTF' : 'equalpower';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1.6;
    panner.maxDistance = 30;
    panner.rolloffFactor = 1.3;
    if (panner.positionX) { panner.positionX.value = a.x; panner.positionY.value = a.y; panner.positionZ.value = a.z; } else panner.setPosition(a.x, a.y, a.z);
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(panner);
    panner.connect(bus);
    g.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.5);
    const v = makeVoice(THEMES[a.slug] || 'glass', g);
    return {
      stop() {
        const t = ctx.currentTime;
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.linearRampToValueAtTime(0, t + 1.2);
        setTimeout(() => { v.stop(); try { panner.disconnect(); } catch (e) { /* gone */ } }, 1400);
      }
    };
  }

  return {
    update(L, anchors) {
      const l = ctx.listener;
      if (l.positionX) {
        const t = ctx.currentTime + 0.05;
        l.positionX.linearRampToValueAtTime(L.x, t);
        l.positionY.linearRampToValueAtTime(L.y, t);
        l.positionZ.linearRampToValueAtTime(L.z, t);
        l.forwardX.linearRampToValueAtTime(L.fx, t);
        l.forwardY.linearRampToValueAtTime(L.fy, t);
        l.forwardZ.linearRampToValueAtTime(L.fz, t);
        l.upX.linearRampToValueAtTime(L.ux, t);
        l.upY.linearRampToValueAtTime(L.uy, t);
        l.upZ.linearRampToValueAtTime(L.uz, t);
      } else {
        l.setPosition(L.x, L.y, L.z);
        l.setOrientation(L.fx, L.fy, L.fz, L.ux, L.uy, L.uz);
      }
      const near = anchors
        .map((a) => ({ a, d: Math.hypot(a.x - L.x, a.z - L.z) }))
        .filter((o) => o.d < 13)
        .sort((p, q) => p.d - q.d)
        .slice(0, 3)
        .map((o) => o.a);
      const keep = new Set(near.map((a) => a.slug));
      voices.forEach((v, slug) => { if (!keep.has(slug)) { v.stop(); voices.delete(slug); } });
      near.forEach((a) => { if (!voices.has(a.slug)) voices.set(a.slug, voiceFor(a)); });
    },
    stopAll() { voices.forEach((v) => v.stop()); voices.clear(); }
  };
}
