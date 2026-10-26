/*
 * Live presence: everyone walking the fair at the same moment can see each other.
 * A tiny MQTT 3.1.1 client (QoS 0) over a secure WebSocket talks to a public broker.
 * Only positions, a first name, a colour and a fixed set of reactions are ever sent:
 * no free text, no accounts. Authors prove who they are with a signature from their
 * private author link, checked against the public keys in books.js.
 */
const enc = new TextEncoder();
const dec = new TextDecoder();

export const EMOTES = [
  { id: 'wave', emoji: '\u{1F44B}', label: 'Wave' },
  { id: 'heart', emoji: '❤️', label: 'Love this' },
  { id: 'clap', emoji: '\u{1F44F}', label: 'Applaud' },
  { id: 'spark', emoji: '✨', label: 'Inspired' },
  { id: 'book', emoji: '\u{1F4D6}', label: 'I want to read it' }
];
const EMOTE_IDS = new Set(EMOTES.map((e) => e.id));

/* ---------- MQTT over WebSocket ---------- */
const varLen = (n) => { const out = []; do { let b = n % 128; n = Math.floor(n / 128); if (n > 0) b |= 128; out.push(b); } while (n > 0); return out; };
const str = (s) => { const b = enc.encode(s); return [b.length >> 8, b.length & 255, ...b]; };
const packet = (type, body) => new Uint8Array([type, ...varLen(body.length), ...body]);

function mqtt(url, { clientId, keepalive = 30, will, onOpen, onMessage, onClose }) {
  let ws, buf = new Uint8Array(0), ping = 0, pid = 1, open = false;
  try {
    ws = new WebSocket(url, 'mqtt');
  } catch (e) {
    setTimeout(() => onClose(false), 0);
    return null;
  }
  ws.binaryType = 'arraybuffer';
  const send = (p) => { if (ws.readyState === 1) ws.send(p); };
  ws.onopen = () => {
    const flags = 0x02 | (will ? 0x04 : 0);
    const body = [...str('MQTT'), 4, flags, keepalive >> 8, keepalive & 255, ...str(clientId)];
    if (will) body.push(...str(will.topic), ...str(will.payload));
    send(packet(0x10, body));
  };
  ws.onmessage = (ev) => {
    const chunk = new Uint8Array(ev.data);
    const next = new Uint8Array(buf.length + chunk.length);
    next.set(buf);
    next.set(chunk, buf.length);
    buf = next;
    for (;;) {
      if (buf.length < 2) break;
      let len = 0, mul = 1, i = 1, b;
      do { if (i >= buf.length) return; b = buf[i++]; len += (b & 127) * mul; mul *= 128; } while (b & 128 && i < 5);
      if (buf.length < i + len) break;
      const type = buf[0], body = buf.subarray(i, i + len);
      buf = buf.slice(i + len);
      if ((type & 0xf0) === 0x20) {
        if (body[1] === 0) {
          open = true;
          ping = setInterval(() => send(new Uint8Array([0xc0, 0])), keepalive * 800);
          onOpen();
        } else ws.close();
      } else if ((type & 0xf0) === 0x30) {
        const qos = (type >> 1) & 3;
        const tl = (body[0] << 8) | body[1];
        const topic = dec.decode(body.subarray(2, 2 + tl));
        const payload = dec.decode(body.subarray(2 + tl + (qos ? 2 : 0)));
        try { onMessage(topic, payload); } catch (e) { /* ignore bad messages */ }
      }
    }
  };
  ws.onclose = () => { clearInterval(ping); onClose(open); };
  ws.onerror = () => {};
  return {
    subscribe(topic) { const id = pid++; send(packet(0x82, [id >> 8, id & 255, ...str(topic), 0])); },
    publish(topic, payload) { send(packet(0x30, [...str(topic), ...enc.encode(payload)])); },
    close() { send(new Uint8Array([0xe0, 0])); try { ws.close(); } catch (e) { /* closed */ } },
    get open() { return open && ws.readyState === 1; }
  };
}

/* ---------- names: first names only, nothing rude, no pretending to be an author ---------- */
const NAME_RE = /^[\p{L}][\p{L}\p{M} .'-]{0,17}$/u;
const BLOCKED = ['fuck', 'shit', 'cunt', 'bitch', 'nigg', 'fag', 'whore', 'slut', 'cock', 'pussy', 'rape', 'nazi', 'hitler', 'porn', 'penis', 'vagina', 'asshole', 'bastard', 'retard', 'admin', 'moderator'];
const fold = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
export function cleanName(n, authors = []) {
  if (typeof n !== 'string') return '';
  n = n.trim().replace(/\s+/g, ' ').slice(0, 18);
  if (!NAME_RE.test(n)) return '';
  const f = fold(n);
  if (BLOCKED.some((w) => f.includes(w))) return '';
  if (authors.some((a) => fold(a.name) === f || fold(a.displayName) === f)) return n.split(' ')[0];
  return n;
}

/* ---------- author signatures (ECDSA P-256) ---------- */
const b64uToBytes = (s) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
const bytesToB64u = (b) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const subtle = () => (window.crypto && window.crypto.subtle) || null;
const ALG = { name: 'ECDSA', namedCurve: 'P-256' };
const SIG = { name: 'ECDSA', hash: 'SHA-256' };

export async function importAuthorKey(pub, d) {
  const s = subtle();
  if (!s || !pub || !d) return null;
  try {
    const raw = b64uToBytes(pub);
    const jwk = { kty: 'EC', crv: 'P-256', x: bytesToB64u(raw.slice(1, 33)), y: bytesToB64u(raw.slice(33, 65)), d, ext: true };
    const key = await s.importKey('jwk', jwk, ALG, false, ['sign']);
    const pk = await s.importKey('raw', raw, ALG, false, ['verify']);
    const probe = enc.encode('probe');
    const ok = await s.verify(SIG, pk, await s.sign(SIG, key, probe), probe);
    return ok ? key : null;
  } catch (e) { return null; }
}

/* ---------- presence ---------- */
export function createLive(cfg, { authors = [], onPeers, onEvent, onStatus }) {
  const base = `lcc-vbf/v1/${cfg.room}`;
  const id = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
  const brokers = cfg.brokers || [];
  const authorById = Object.fromEntries(authors.map((a) => [a.id, a]));
  const pubKeys = new Map();
  const verified = new Map();
  const peers = new Map();
  let client = null, brokerIdx = 0, failures = 0, retry = 0, status = 'off', stopped = true;
  let me = { name: '', hue: Math.floor(Math.random() * 360), author: null, key: null, sig: null, t: 0 };
  let visible = true, state = null, lastSent = 0, lastPayload = '', lastHiReply = 0, lastEmote = 0, lastLantern = 0, beat = 0, resign = 0;
  const lanternFrom = new Map();

  const setStatus = (s) => { if (s !== status) { status = s; onStatus(s); } };
  const emitPeers = () => onPeers([...peers.values()].filter((p) => p.x != null));

  function connect() {
    if (stopped || !brokers.length) return;
    setStatus('connecting');
    const url = brokers[brokerIdx % brokers.length];
    client = mqtt(url, {
      clientId: 'vbf-' + id,
      keepalive: 30,
      will: { topic: `${base}/s/${id}`, payload: '{"v":1,"bye":1}' },
      onOpen() {
        failures = 0;
        retry = 0;
        client.subscribe(`${base}/#`);
        setStatus('live');
        publishState(true);
        send('e', { k: 'hi' });
      },
      onMessage,
      onClose(wasOpen) {
        client = null;
        peers.clear();
        emitPeers();
        if (stopped) return;
        setStatus('offline');
        if (!wasOpen && ++failures >= 2) { brokerIdx++; failures = 0; }
        retry = Math.min(30000, (retry || 1500) * 2);
        setTimeout(connect, retry);
      }
    });
  }

  function send(kind, obj) {
    if (!client || !client.open) return;
    client.publish(`${base}/${kind}${kind === 's' ? '/' + id : ''}`, JSON.stringify({ v: 1, f: id, ...obj }));
  }

  async function refreshSignature() {
    if (!me.key || !me.author) return;
    const t = Math.floor(Date.now() / 1000);
    try {
      const sig = await subtle().sign(SIG, me.key, enc.encode(`${me.author}|${id}|${t}`));
      me.sig = bytesToB64u(new Uint8Array(sig));
      me.t = t;
    } catch (e) { me.sig = null; }
  }

  function publishState(force) {
    if (!client || !client.open || !state) return;
    if (!visible) return;
    const now = performance.now();
    const msg = { n: me.name, h: me.hue, x: state.x, z: state.z, r: state.yaw, s: state.seated ? 1 : 0 };
    if (me.author && me.sig) Object.assign(msg, { a: me.author, t: me.t, g: me.sig });
    const payload = JSON.stringify(msg);
    if (!force && payload === lastPayload && now - lastSent < 5000) return;
    if (!force && now - lastSent < 280) return;
    lastSent = now;
    lastPayload = payload;
    send('s', msg);
  }

  async function verifyAuthor(p, m) {
    const key = `${p.id}|${m.a}|${m.t}`;
    if (verified.has(key)) return verified.get(key);
    verified.set(key, false);
    const pub = cfg.authorKeys && cfg.authorKeys[m.a];
    const s = subtle();
    if (!pub || !s || typeof m.g !== 'string' || Math.abs(Date.now() / 1000 - m.t) > 900) return false;
    try {
      if (!pubKeys.has(m.a)) pubKeys.set(m.a, await s.importKey('raw', b64uToBytes(pub), ALG, false, ['verify']));
      const ok = await s.verify(SIG, pubKeys.get(m.a), b64uToBytes(m.g), enc.encode(`${m.a}|${p.id}|${m.t}`));
      verified.set(key, ok);
      if (ok) {
        const arrived = !p.author;
        p.author = { id: m.a, name: authorById[m.a] ? authorById[m.a].displayName : m.a };
        emitPeers();
        if (arrived) onEvent({ k: 'author-here', peer: p });
      }
      return ok;
    } catch (e) { return false; }
  }

  function onMessage(topic, payload) {
    const rest = topic.slice(base.length + 1);
    if (rest.startsWith('s/')) {
      const pid = rest.slice(2);
      if (!/^[0-9a-f]{16}$/.test(pid) || pid === id) return;
      if (payload.length > 600) return;
      const m = JSON.parse(payload);
      if (m.bye) { if (peers.delete(pid)) emitPeers(); return; }
      let p = peers.get(pid);
      const now = performance.now();
      if (!p) { p = { id: pid, seen: 0, budget: 12, budgetAt: now, author: null }; peers.set(pid, p); }
      if (now - p.budgetAt > 2000) { p.budget = 12; p.budgetAt = now; }
      if (--p.budget < 0) return;
      const num = (v, a, b) => (typeof v === 'number' && isFinite(v) ? Math.max(a, Math.min(b, v)) : null);
      p.x = num(m.x, -14, 14);
      p.z = num(m.z, -200, 30);
      if (p.x == null || p.z == null) { peers.delete(pid); return; }
      p.yaw = num(m.r, -100, 100) || 0;
      p.seated = m.s === 1;
      p.hue = num(m.h, 0, 359) || 0;
      p.name = cleanName(m.n, authors);
      p.seen = now;
      if (m.a && authorById[m.a] && m.t && m.g) {
        const key = `${pid}|${m.a}|${m.t}`;
        if (!verified.has(key)) verifyAuthor(p, m);
        else if (!verified.get(key)) p.author = null;
      } else p.author = null;
      emitPeers();
    } else if (rest === 'e') {
      if (payload.length > 300) return;
      const m = JSON.parse(payload);
      if (!m || m.f === id || !/^[0-9a-f]{16}$/.test(m.f)) return;
      if (m.k === 'hi') {
        const now = performance.now();
        if (now - lastHiReply > 2000) { lastHiReply = now; publishState(true); }
        return;
      }
      if (m.k === 'emote' && EMOTE_IDS.has(m.e)) {
        const p = peers.get(m.f);
        if (!p) return;
        onEvent({ k: 'emote', peer: p, emote: m.e, toMe: m.to === id });
      }
      // a wishing lantern: only that one rose, never the words written on it
      if (m.k === 'lantern') {
        const p = peers.get(m.f);
        const now = performance.now();
        if (!p || now - (lanternFrom.get(m.f) || -1e9) < 15000) return;
        lanternFrom.set(m.f, now);
        onEvent({ k: 'lantern', peer: p });
      }
    }
  }

  function tick() {
    const now = performance.now();
    let changed = false;
    peers.forEach((p, pid) => { if (now - p.seen > 15000) { peers.delete(pid); changed = true; } });
    if (changed) emitPeers();
    if (status === 'live') publishState(false);
  }

  const onVisibility = () => {
    if (document.hidden) return;
    publishState(true);
  };
  const onLeave = () => { if (client && client.open) { send('s', { bye: 1 }); client.close(); } };

  return {
    id,
    start() {
      if (!stopped || !brokers.length || !('WebSocket' in window)) return;
      stopped = false;
      connect();
      beat = setInterval(tick, 1000);
      resign = setInterval(refreshSignature, 60000);
      document.addEventListener('visibilitychange', onVisibility);
      window.addEventListener('pagehide', onLeave);
    },
    stop() {
      stopped = true;
      clearInterval(beat);
      clearInterval(resign);
      onLeave();
      peers.clear();
      emitPeers();
      setStatus('off');
    },
    update(s) { state = s; if (status === 'live' && !document.hidden) publishState(false); },
    setName(name) { me.name = cleanName(name, me.author ? [] : authors); publishState(true); return me.name; },
    setHue(h) { me.hue = Math.round(h) % 360; publishState(true); },
    setVisible(v) {
      visible = v;
      if (!v && client && client.open) client.publish(`${base}/s/${id}`, '{"v":1,"bye":1}');
      else publishState(true);
    },
    async setAuthor(authorId, d) {
      const pub = cfg.authorKeys && cfg.authorKeys[authorId];
      const key = await importAuthorKey(pub, d);
      if (!key) return false;
      me.author = authorId;
      me.key = key;
      me.name = (authorById[authorId] && authorById[authorId].displayName) || '';
      await refreshSignature();
      publishState(true);
      return true;
    },
    emote(e, to = null) {
      const now = performance.now();
      if (!EMOTE_IDS.has(e) || now - lastEmote < 700) return false;
      lastEmote = now;
      send('e', { k: 'emote', e, to });
      return true;
    },
    lantern() {
      const now = performance.now();
      if (now - lastLantern < 15000) return false;
      lastLantern = now;
      send('e', { k: 'lantern' });
      return true;
    },
    status: () => status,
    count: () => peers.size,
    peers: () => [...peers.values()]
  };
}
