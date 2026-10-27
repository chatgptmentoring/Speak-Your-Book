/*
 * The two places off the hall, each over a bridge on its own floating island:
 * the Garden (left), to hang out between the talks, and Life Coach Code (right), with its
 * solutions for coaches, three ways to join, its booth and its guide.
 *
 * Built to be light on the graphics card: unlit materials with the light painted in, merged and
 * instanced meshes, no extra lights, and each island is drawn and animated only when it is near.
 */
import * as THREE from 'three';
import * as T from './textures.js';

const V3 = THREE.Vector3;
const D2R = Math.PI / 180;
const { SERIF, SANS, GOLD } = T;

/* ---------- small helpers ---------- */
// one geometry from many (each already in place): one draw call
export function merge(geos) {
  let n = 0, ni = 0;
  geos.forEach((g) => { n += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), index = new Uint32Array(ni);
  let o = 0, io = 0;
  geos.forEach((g) => {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i++) index[io + i] = a[i] + o; io += a.length; } else { for (let i = 0; i < c; i++) index[io + i] = o + i; io += c; }
    o += c;
    g.dispose();
  });
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  m.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  m.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  m.setIndex(new THREE.BufferAttribute(index, 1));
  m.computeBoundingSphere();
  return m;
}
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s3 = new V3();
export function put(geo, x, y, z, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  e.set(rx, ry, rz);
  q.setFromEuler(e);
  m4.compose(new V3(x, y, z), q, s3.set(sx, sy, sz));
  return geo.applyMatrix4(m4);
}
// a mesh that never moves: skip it when the scene updates its matrices every frame
function still(o) {
  o.updateMatrixWorld(true);
  o.traverse((c) => { c.matrixAutoUpdate = false; c.matrixWorldAutoUpdate = false; });
  return o;
}
const hdr = (c, k) => new THREE.Color(c).multiplyScalar(k);
function canvas(w, h) { const c = T.makeCanvas(w, h); return [c, c.getContext('2d')]; }
function roundRect(x, X, Y, w, h, r) {
  x.beginPath();
  x.moveTo(X + r, Y);
  x.arcTo(X + w, Y, X + w, Y + h, r);
  x.arcTo(X + w, Y + h, X, Y + h, r);
  x.arcTo(X, Y + h, X, Y, r);
  x.arcTo(X, Y, X + w, Y, r);
  x.closePath();
}
function lines(x, text, X, Y, maxW, lh, maxLines = 99) {
  const ls = T.wrap(x, text, maxW).slice(0, maxLines);
  ls.forEach((l, i) => x.fillText(l, X, Y + i * lh));
  return Y + ls.length * lh;
}

/* A sign: eyebrow, title and a line, painted gold on deep plum (unlit, always readable) */
function signTex({ eyebrow = '', title, sub = '', w = 1024, h = 300, accent = GOLD, bg = ['#2b1433', '#14091a'] }) {
  const [c, x] = canvas(w, h);
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, bg[0]);
  g.addColorStop(1, bg[1]);
  x.fillStyle = g;
  roundRect(x, 0, 0, w, h, h * 0.12);
  x.fill();
  x.strokeStyle = accent;
  x.lineWidth = h * 0.025;
  roundRect(x, h * 0.05, h * 0.05, w - h * 0.1, h - h * 0.1, h * 0.09);
  x.stroke();
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  if (eyebrow) {
    x.fillStyle = accent;
    x.font = `700 ${Math.round(h * 0.1)}px ${SANS}`;
    T.spaced(x, eyebrow, w / 2, h * 0.24, h * 0.035);
  }
  const t = T.fit(x, title, { family: SERIF, weight: 600, max: Math.round(h * 0.34), min: Math.round(h * 0.16), maxW: w * 0.86, maxLines: 1 });
  x.font = `600 ${t.size}px ${SERIF}`;
  x.fillStyle = T.goldGradient(x, 0, h * 0.3, 0, h * 0.7);
  x.fillText(t.lines[0], w / 2, eyebrow ? h * (sub ? 0.53 : 0.58) : h * (sub ? 0.42 : 0.5));
  if (sub) {
    x.fillStyle = 'rgba(247,225,176,.85)';
    const sz = T.fit(x, sub, { family: SERIF, weight: 500, style: 'italic', max: Math.round(h * 0.12), min: Math.round(h * 0.08), maxW: w * 0.86, maxLines: 1 });
    x.font = `italic 500 ${sz.size}px ${SERIF}`;
    x.fillText(sz.lines[0], w / 2, h * 0.8);
  }
  return T.toTexture(c);
}

/* ---------- the islands ---------- */
export function createAreas(ctx) {
  const { scene, mat, tex, poolMat, pointsMaterial, pointMats, addFairy, catenary, coneMaterial, holoGeo, holoMaterial, holoMats, logoImg, lowEnd, camera, data } = ctx;
  const logoTex = ctx.logoTex || T.logoMedallionTexture(logoImg);
  const { GARDEN_C, LCC_C, R, PATH_Z, BRIDGE_X0, BRIDGE_X1 } = ctx.layout;
  const LCC = data.LCC || {};
  const GARDEN = data.GARDEN || {};
  const colliders = [], interactables = [], clickables = [], places = [], animated = [];
  const S = lowEnd ? 0.5 : 1; // canvas sizes on phones
  // a point on an island, by its bearing from the side that faces the hall
  const toHall = (c) => (c.x < 0 ? 0 : 180);
  const at = (c, deg, r, y = 0) => { const a = (toHall(c) + deg) * D2R; return new V3(c.x + Math.cos(a) * r, y, c.z + Math.sin(a) * r); };
  const faceTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
  const tag = (o, info) => { o.traverse((m) => { if (m.isMesh) { m.userData.info = info; clickables.push(m); } }); };
  const interact = (pos, range, info) => interactables.push({ pos: pos.clone().setY(0), range, info });

  const rock = new THREE.MeshLambertMaterial({ color: 0x2c2234, flatShading: true });
  const rockLight = new THREE.MeshLambertMaterial({ color: 0x5a4a5e, flatShading: true });
  const wood = new THREE.MeshLambertMaterial({ color: 0x6b4630 });
  const glowGold = new THREE.MeshBasicMaterial({ color: hdr(0xffc27a, 2.2) });

  function plainSign(o, w, h, texture) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texture, transparent: true }));
    return m;
  }
  function pool(c, r, color, opacity, y = 0.012) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), poolMat(color, opacity));
    p.rotation.x = -Math.PI / 2;
    p.position.set(c.x, y, c.z);
    return p;
  }

  /* the island itself: a painted top, a gold rim, and rock tapering away below */
  function island(c, topTexture) {
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CircleGeometry(R, 72), new THREE.MeshBasicMaterial({ map: topTexture }));
    top.rotation.x = -Math.PI / 2;
    top.position.set(c.x, 0.004, c.z);
    const side = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.97, 0.7, 48, 1, true), rock);
    side.position.set(c.x, -0.35, c.z);
    const under = new THREE.Mesh(new THREE.ConeGeometry(R * 0.97, 8, 12, 3), rock);
    under.rotation.x = Math.PI;
    under.position.set(c.x, -0.7 - 4, c.z);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.06, 6, 120), mat.gold);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(c.x, 0.03, c.z);
    // a few stones drifting beneath, all one draw call
    const bits = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 0), rock, 7);
    const d = new THREE.Object3D();
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2 + 0.4;
      d.position.set(c.x + Math.cos(a) * (R + 1.5 + (i % 3)), -2.5 - (i % 4) * 1.2, c.z + Math.sin(a) * (R + 1.5 + (i % 3)));
      d.rotation.set(i, i * 2, i * 3);
      d.scale.setScalar(0.5 + (i % 3) * 0.35);
      d.updateMatrix();
      bits.setMatrixAt(i, d.matrix);
    }
    g.add(top, side, under, rim, bits);
    return g;
  }

  /* the path across the hall floor, the gateway and the bridge out to an island */
  function bridge(side, label, accent) {
    const g = new THREE.Group();
    const x0 = side * BRIDGE_X0, x1 = side * BRIDGE_X1, len = Math.abs(x1 - x0), cx = (x0 + x1) / 2;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(len, 0.24, 2.4), mat.marble);
    deck.position.set(cx, -0.12, PATH_Z);
    const under = new THREE.Mesh(new THREE.BoxGeometry(len, 0.5, 1.6), rock);
    under.position.set(cx, -0.48, PATH_Z);
    g.add(deck, under);
    // railings and lamp posts: two meshes for the whole bridge
    const railGeo = [];
    const posts = [];
    [-1, 1].forEach((sz) => {
      railGeo.push(put(new THREE.CylinderGeometry(0.03, 0.03, len, 6), cx, 0.95, PATH_Z + sz * 1.12, 0, 0, Math.PI / 2));
      for (let i = 0; i <= 4; i++) posts.push([x0 + (x1 - x0) * (i / 4), PATH_Z + sz * 1.12]);
    });
    posts.forEach(([x, z]) => railGeo.push(put(new THREE.CylinderGeometry(0.035, 0.05, 1.0, 6), x, 0.5, z)));
    const rails = new THREE.Mesh(merge(railGeo), mat.gold);
    const lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 10, 8), new THREE.MeshBasicMaterial({ color: hdr(accent, 2.6) }), posts.length);
    const d = new THREE.Object3D();
    posts.forEach(([x, z], i) => { d.position.set(x, 1.06, z); d.updateMatrix(); lamps.setMatrixAt(i, d.matrix); addFairy([new V3(x, 1.06, z)]); });
    g.add(rails, lamps);
    // a soft path of light across the hall floor, leading the eye from the aisle to the bridge
    const [pc, px] = canvas(512, 64);
    const pg = px.createLinearGradient(0, 0, 0, 64);
    pg.addColorStop(0, 'rgba(0,0,0,0)');
    pg.addColorStop(0.5, '#' + new THREE.Color(accent).getHexString());
    pg.addColorStop(1, 'rgba(0,0,0,0)');
    px.fillStyle = pg;
    px.globalAlpha = 0.5;
    px.fillRect(0, 0, 512, 64);
    px.globalAlpha = 1;
    px.fillStyle = 'rgba(255,240,210,.85)';
    for (let i = 0; i < 8; i++) {
      const X = 30 + i * 64;
      px.beginPath();
      px.moveTo(X, 20); px.lineTo(X + 18, 32); px.lineTo(X, 44); px.lineTo(X + 6, 32);
      px.fill();
    }
    const pathTex = T.toTexture(pc);
    pathTex.wrapS = THREE.RepeatWrapping;
    pathTex.repeat.set(1.6, 1);
    const run = new THREE.Mesh(new THREE.PlaneGeometry(BRIDGE_X0 - 2.4, 1.2), new THREE.MeshBasicMaterial({ map: pathTex, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    run.rotation.x = -Math.PI / 2;
    if (side < 0) run.rotation.z = Math.PI;
    run.position.set(side * (2.4 + (BRIDGE_X0 - 2.4) / 2), 0.009, PATH_Z);
    g.add(run);
    // the gateway: two slim pillars and a sign you can read from the middle of the hall
    const gx = side * (BRIDGE_X0 - 0.2);
    const gate = new THREE.Group();
    [-1, 1].forEach((sz) => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 3.4, 10), mat.marble);
      p.position.set(gx, 1.7, PATH_Z + sz * 1.3);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), glowGold);
      cap.position.set(gx, 3.47, PATH_Z + sz * 1.3);
      gate.add(p, cap);
    });
    const signT = signTex(label);
    const sign = plainSign(null, 2.8, 0.82, signT);
    sign.position.set(gx, 2.95, PATH_Z);
    sign.rotation.y = -side * Math.PI / 2;
    const back = sign.clone();
    back.rotation.y = side * Math.PI / 2;
    back.position.x += side * 0.01;
    gate.add(sign, back);
    g.add(gate);
    colliders.push({ x: gx, z: PATH_Z + 1.3, r: 0.2 }, { x: gx, z: PATH_Z - 1.3, r: 0.2 });
    return { group: g, gate };
  }

  /* ======================= THE GARDEN ======================= */
  const G = GARDEN_C;
  const garden = new THREE.Group();
  {
    // the ground: moss, a ring of pale stone round the tree and paths out to each spot
    const N = Math.round(1024 * S);
    const [c, x] = canvas(N, N);
    const k = N / (2 * R);
    const P = (deg, r) => { const a = (toHall(G) + deg) * D2R; return [N / 2 + Math.cos(a) * r * k, N / 2 + Math.sin(a) * r * k]; };
    const bg = x.createRadialGradient(N / 2, N / 2, N * 0.05, N / 2, N / 2, N / 2);
    bg.addColorStop(0, '#24452f');
    bg.addColorStop(0.7, '#183324');
    bg.addColorStop(1, '#0d1d16');
    x.fillStyle = bg;
    x.fillRect(0, 0, N, N);
    for (let i = 0; i < 2400 * S; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * N / 2;
      x.fillStyle = `rgba(${60 + Math.random() * 40},${100 + Math.random() * 60},${60 + Math.random() * 30},${0.25 + Math.random() * 0.3})`;
      x.fillRect(N / 2 + Math.cos(a) * r, N / 2 + Math.sin(a) * r, 2 * S + 1, 2 * S + 1);
    }
    const flowers = ['#f7b6d2', '#fff4e2', '#f7e1b0', '#c792e0', '#ffb877'];
    for (let i = 0; i < 520 * S; i++) {
      const a = Math.random() * Math.PI * 2, r = (0.55 + Math.random() * 0.43) * N / 2;
      x.fillStyle = flowers[i % flowers.length];
      x.beginPath();
      x.arc(N / 2 + Math.cos(a) * r, N / 2 + Math.sin(a) * r, (1.6 + Math.random() * 2.2) * S, 0, Math.PI * 2);
      x.fill();
    }
    x.strokeStyle = 'rgba(232,214,180,.55)';
    x.lineCap = 'round';
    const path = (a, b) => { x.lineWidth = 0.75 * k; x.beginPath(); x.moveTo(...a); x.lineTo(...b); x.stroke(); };
    path(P(0, R), P(0, 2.9));
    [40, 100, -45, -110, 180].forEach((deg) => path(P(deg, 2.9), P(deg, deg === 180 ? R : 4.4)));
    x.lineWidth = 0.9 * k;
    x.beginPath();
    x.arc(N / 2, N / 2, 2.9 * k, 0, Math.PI * 2);
    x.stroke();
    garden.add(island(G, T.toTexture(c)));
  }
  const gBridge = bridge(-1, { eyebrow: 'THIS WAY', title: 'The Garden', sub: 'Drinks · fortune cookies · lanterns · meditation', accent: '#9fe0b0' }, 0x9fe0b0);
  garden.add(gBridge.group);
  tag(gBridge.gate, { kind: 'spot', id: 'garden-gate' });
  interact(new V3(-BRIDGE_X0 + 1.4, 0, PATH_Z), 2.6, { kind: 'spot', id: 'garden-gate' });
  // and its entrance arch on the island
  {
    const p = at(G, 0, R - 0.5);
    const a = new THREE.Group();
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.08, 8, 32, Math.PI), wood);
    arch.position.set(0, 2.2, 0);
    a.add(arch);
    [-1, 1].forEach((sz) => { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.2, 8), wood); post.position.set(sz * 1.45, 1.1, 0); a.add(post); });
    const sign = plainSign(null, 2.2, 0.62, signTex({ eyebrow: 'WELCOME TO', title: 'The Garden', sub: 'Hang out between the talks', w: 900, h: 260, accent: '#bfe8c4', bg: ['#173326', '#0b1a12'] }));
    sign.position.set(0, 2.55, 0.02);
    const back = sign.clone();
    back.rotation.y = Math.PI;
    back.position.z = -0.02;
    a.add(sign, back);
    a.position.copy(p);
    a.rotation.y = faceTo(p, G) + Math.PI;
    garden.add(a);
    a.updateMatrixWorld(true);
    // blossoms climbing the arch
    const pts = [];
    for (let i = 0; i <= 26; i++) { const t = i / 26 * Math.PI; pts.push(a.localToWorld(new V3(Math.cos(t) * 1.45, 2.2 + Math.sin(t) * 1.45, 0))); }
    addFairy(pts);
    colliders.push(...[-1, 1].map((sz) => { const w = a.localToWorld(new V3(sz * 1.45, 0, 0)); return { x: w.x, z: w.z, r: 0.18 }; }));
  }

  // the tree at the heart of the garden, with benches round it
  {
    const trunk = new THREE.Mesh(merge([
      put(new THREE.CylinderGeometry(0.2, 0.34, 2.6, 8), G.x, 1.3, G.z),
      put(new THREE.CylinderGeometry(0.08, 0.14, 1.4, 6), G.x + 0.35, 2.7, G.z, 0, 0, -0.7),
      put(new THREE.CylinderGeometry(0.08, 0.14, 1.3, 6), G.x - 0.3, 2.75, G.z + 0.2, 0, 0.5, 0.6),
      put(new THREE.CylinderGeometry(0.07, 0.12, 1.2, 6), G.x, 2.8, G.z - 0.35, 0, -0.6, 0)
    ]), wood);
    const blossom = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.7, 1), new THREE.MeshLambertMaterial({ color: 0xf4a9c9, emissive: 0x6a2448, flatShading: true }), 11);
    const d = new THREE.Object3D();
    for (let i = 0; i < 11; i++) {
      const a = i / 11 * Math.PI * 2;
      const r = i < 3 ? 0.3 : 1.0 + (i % 2) * 0.3;
      d.position.set(G.x + Math.cos(a) * r, 3.3 + (i % 3) * 0.32 + (i < 3 ? 0.5 : 0), G.z + Math.sin(a) * r);
      d.scale.setScalar(0.85 + (i % 4) * 0.12);
      d.rotation.set(i, i * 1.3, 0);
      d.updateMatrix();
      blossom.setMatrixAt(i, d.matrix);
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.radial, color: 0xff9ccc, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.set(6, 5, 1);
    glow.position.set(G.x, 3.4, G.z);
    garden.add(trunk, blossom, glow, pool(G, 3.2, 0xffb0d0, 0.32));
    // petals drifting down
    const pg = new THREE.BufferGeometry(), pp = [], ps = [];
    for (let i = 0; i < (lowEnd ? 60 : 140); i++) { const a = Math.random() * Math.PI * 2, r = Math.random() * 2.6; pp.push(G.x + Math.cos(a) * r, Math.random() * 3.6, G.z + Math.sin(a) * r); ps.push(Math.random()); }
    pg.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3));
    pg.setAttribute('aSeed', new THREE.Float32BufferAttribute(ps, 1));
    const pm = pointsMaterial(new THREE.Color(1.0, 0.7, 0.85).multiplyScalar(1.6), { size: 0.05, alpha: 0.8, rise: -0.5, height: 3.8 });
    pointMats.push(pm);
    garden.add(new THREE.Points(pg, pm));
    colliders.push({ x: G.x, z: G.z, r: 0.45 });
    // string lights from the tree out to poles round the edge
    [25, 75, 140, 220, 285, 335].forEach((deg, i) => {
      const p = at(G, deg, R - 0.7);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 3.2, 6), wood);
      pole.position.set(p.x, 1.6, p.z);
      garden.add(pole);
      addFairy(catenary(new V3(G.x, 3.6, G.z), new V3(p.x, 3.15, p.z), 0.5, 14 + (i % 2) * 2));
    });
    // benches: one mesh, four places to sit together
    const benchGeo = merge([
      put(new THREE.BoxGeometry(1.5, 0.08, 0.45), 0, 0.46, 0),
      put(new THREE.BoxGeometry(1.5, 0.42, 0.06), 0, 0.72, -0.22, 0, -0.12),
      put(new THREE.BoxGeometry(0.08, 0.44, 0.4), -0.65, 0.22, 0),
      put(new THREE.BoxGeometry(0.08, 0.44, 0.4), 0.65, 0.22, 0)
    ]);
    const benchDeg = [60, 135, 225, 300];
    const benches = new THREE.InstancedMesh(benchGeo, wood, benchDeg.length);
    benchDeg.forEach((deg, i) => {
      const p = at(G, deg, 2.05);
      d.position.copy(p);
      d.rotation.set(0, faceTo(p, G), 0);
      d.scale.setScalar(1);
      d.updateMatrix();
      benches.setMatrixAt(i, d.matrix);
      const info = { kind: 'spot', id: 'bench', seat: p.clone(), look: new V3(G.x, 2.4, G.z) };
      interact(p, 1.15, info);
      colliders.push({ x: p.x, z: p.z, r: 0.5 });
    });
    benches.userData.info = { kind: 'spot', id: 'bench' };
    garden.add(benches);
  }

  /* the Elixir Bar: a curved counter, glowing bottles and a barista made of light */
  const barPos = at(G, 100, 5.3);
  let serve = () => {};
  {
    const g = new THREE.Group();
    const shape = (ro, ri, a0, a1) => {
      const s = new THREE.Shape();
      s.absarc(0, 0, ro, a0, a1, false);
      s.absarc(0, 0, ri, a1, a0, true);
      return s;
    };
    const counter = new THREE.Mesh(new THREE.ExtrudeGeometry(shape(1.75, 1.3, -1.2, 1.2), { depth: 1.0, bevelEnabled: false, curveSegments: 20 }), wood);
    counter.rotation.x = -Math.PI / 2;
    const top = new THREE.Mesh(new THREE.ExtrudeGeometry(shape(1.82, 1.24, -1.24, 1.24), { depth: 0.06, bevelEnabled: false, curveSegments: 20 }), mat.marble);
    top.rotation.x = -Math.PI / 2;
    top.position.y = 1.0;
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.0, 2.4), wood);
    shelf.position.set(-0.55, 1.4, 0);
    const shelfGlow = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.7), new THREE.MeshBasicMaterial({ color: hdr(0xffb36b, 0.55) }));
    shelfGlow.position.set(-0.39, 1.55, 0);
    shelfGlow.rotation.y = Math.PI / 2;
    g.add(counter, top, shelf, shelfGlow);
    const bottleColors = [0xff7a59, 0x7fe0a8, 0xf7e1b0, 0xc792e0, 0x6ac8ff, 0xffd166, 0xff9ccc];
    const nB = 14;
    const bottles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.06, 0.26, 8), new THREE.MeshBasicMaterial(), nB);
    const d = new THREE.Object3D();
    for (let i = 0; i < nB; i++) {
      d.position.set(-0.32, 1.0 + Math.floor(i / 7) * 0.62 + 0.14, -0.95 + (i % 7) * 0.32);
      d.updateMatrix();
      bottles.setMatrixAt(i, d.matrix);
      bottles.setColorAt(i, hdr(bottleColors[i % bottleColors.length], 1.6));
    }
    const ledges = new THREE.Mesh(merge([0, 1].map((r) => put(new THREE.BoxGeometry(0.22, 0.03, 2.3), -0.32, 1.0 + r * 0.62, 0))), mat.gold);
    g.add(bottles, ledges);
    // the barista: a figure of light behind the counter
    const m = holoMaterial(new THREE.Color(0.55, 0.95, 0.75), 0.9);
    holoMats.push(m);
    const barista = new THREE.Mesh(holoGeo, m);
    barista.position.set(0.15, 1.05, 0);
    barista.rotation.y = Math.PI / 2;
    g.add(barista);
    const sign = plainSign(null, 2.0, 0.56, signTex({ eyebrow: 'THE GARDEN', title: 'The Elixir Bar', sub: 'Press E to order', w: 900, h: 252, accent: '#bfe8c4', bg: ['#173326', '#0b1a12'] }));
    sign.position.set(-0.36, 2.75, 0);
    sign.rotation.y = Math.PI / 2;
    g.add(sign, pool(new V3(0.6, 0, 0), 2.2, 0xffc27a, 0.35));
    g.position.copy(barPos);
    g.rotation.y = faceTo(barPos, G) - Math.PI / 2;
    garden.add(g);
    g.updateMatrixWorld(true);
    const info = { kind: 'spot', id: 'bar' };
    tag(g, info);
    interact(g.localToWorld(new V3(2.2, 0, 0)), 2.3, info);
    for (let a = -1.1; a <= 1.1; a += 0.37) { const w = g.localToWorld(new V3(Math.cos(a) * 1.52, 0, Math.sin(a) * 1.52)); colliders.push({ x: w.x, z: w.z, r: 0.26 }); }
    const sw = g.localToWorld(new V3(-0.55, 0, 0));
    colliders.push({ x: sw.x, z: sw.z, r: 0.6 });
    animated.push((t) => { barista.rotation.y = Math.PI / 2 + Math.sin(t * 0.5) * 0.4; barista.position.y = 1.05 + Math.sin(t * 1.3) * 0.01; });
    // a cup on the counter when you order: the one in front of you
    const cup = new THREE.Group();
    const cupBody = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.045, 0.12, 14), new THREE.MeshLambertMaterial({ color: 0xfff6ea }));
    const drink = new THREE.Mesh(new THREE.CircleGeometry(0.055, 14), new THREE.MeshBasicMaterial({ color: hdr(0xffb36b, 1.3) }));
    drink.rotation.x = -Math.PI / 2;
    drink.position.y = 0.055;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.01, 6, 12, Math.PI), cupBody.material);
    handle.position.set(0.065, 0.0, 0);
    handle.rotation.z = -Math.PI / 2;
    const sg = new THREE.BufferGeometry(), sp = [], ss = [];
    for (let i = 0; i < 16; i++) { sp.push((Math.random() - 0.5) * 0.05, Math.random() * 0.3, (Math.random() - 0.5) * 0.05); ss.push(Math.random()); }
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    sg.setAttribute('aSeed', new THREE.Float32BufferAttribute(ss, 1));
    const sm = pointsMaterial(0xfff4e0, { size: 0.03, alpha: 0.45, rise: 0.4, height: 0.32 });
    pointMats.push(sm);
    const steam = new THREE.Points(sg, sm);
    steam.position.y = 0.07;
    cup.add(cupBody, drink, handle, steam);
    cup.visible = false;
    garden.add(cup);
    serve = (color, near) => {
      // the spot on the counter closest to you
      const local = g.worldToLocal(near.clone());
      const a = Math.max(-1.0, Math.min(1.0, Math.atan2(local.z, local.x)));
      cup.position.copy(g.localToWorld(new V3(Math.cos(a) * 1.55, 1.12, Math.sin(a) * 1.55)));
      drink.material.color.copy(hdr(color, 1.3));
      cup.visible = true;
      clearTimeout(serve.t);
      serve.t = setTimeout(() => { cup.visible = false; }, 180000);
    };
  }

  /* fortune cookies under a glass dome */
  const cookiePos = at(G, 40, 4.6);
  {
    const g = new THREE.Group();
    const table = new THREE.Mesh(merge([
      put(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 24), 0, 0.92, 0),
      put(new THREE.CylinderGeometry(0.05, 0.07, 0.9, 8), 0, 0.45, 0),
      put(new THREE.CylinderGeometry(0.28, 0.3, 0.04, 16), 0, 0.02, 0)
    ]), mat.goldSoft);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.28, 0.03, 24), new THREE.MeshLambertMaterial({ color: 0xc23b3b }));
    plate.position.y = 0.96;
    const nC = 7;
    const cookies = new THREE.InstancedMesh(new THREE.TorusGeometry(0.075, 0.045, 8, 14, Math.PI), new THREE.MeshLambertMaterial({ color: 0xe8b25c, emissive: 0x5a3010 }), nC);
    const d = new THREE.Object3D();
    for (let i = 0; i < nC; i++) {
      const a = i / nC * Math.PI * 2;
      const r = i === 0 ? 0 : 0.17;
      d.position.set(Math.cos(a) * r, 1.0 + (i === 0 ? 0.06 : 0), Math.sin(a) * r);
      d.rotation.set(Math.PI / 2, a, 0.4);
      d.updateMatrix();
      cookies.setMatrixAt(i, d.matrix);
    }
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending }));
    dome.position.y = 0.95;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), glowGold);
    knob.position.y = 1.39;
    const sign = plainSign(null, 1.3, 0.36, signTex({ eyebrow: 'TAKE ONE', title: 'Fortune cookies', w: 760, h: 210, accent: '#f7e1b0' }));
    sign.position.set(0, 1.75, 0);
    g.add(table, plate, cookies, dome, knob, sign, pool(new V3(0, 0, 0), 1.3, 0xffd08a, 0.35));
    g.position.copy(cookiePos);
    g.rotation.y = faceTo(cookiePos, G);
    garden.add(g);
    const info = { kind: 'spot', id: 'cookies' };
    tag(g, info);
    interact(cookiePos, 2.3, info);
    colliders.push({ x: cookiePos.x, z: cookiePos.z, r: 0.55 });
    animated.push((t) => { sign.position.y = 1.75 + Math.sin(t * 1.1) * 0.03; });
  }

  /* the lantern pier, reaching out over the stars */
  const pierEnd = at(G, 180, R + 2.6);
  {
    const a0 = at(G, 180, R - 0.6);
    const len = a0.distanceTo(pierEnd) + 0.6;
    const mid = a0.clone().lerp(pierEnd, 0.5);
    const g = new THREE.Group();
    const deck = new THREE.Mesh(new THREE.BoxGeometry(len, 0.16, 1.8), wood);
    deck.position.set(mid.x, -0.08, mid.z);
    const posts = [];
    for (let i = 0; i <= 3; i++) [-1, 1].forEach((sz) => posts.push(a0.clone().lerp(pierEnd, i / 3).add(new V3(0, 0, sz * 0.85))));
    const postGeo = merge(posts.map((p) => put(new THREE.CylinderGeometry(0.04, 0.05, 1.0, 6), p.x, 0.5, p.z)));
    g.add(deck, new THREE.Mesh(postGeo, wood));
    // two tall poles hung with paper lanterns
    const lanternGeo = [];
    [-1, 1].forEach((sz) => {
      const p = pierEnd.clone().add(new V3(0.4, 0, sz * 0.85));
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.6, 6), wood);
      pole.position.set(p.x, 1.3, p.z);
      g.add(pole);
      lanternGeo.push(put(new THREE.CylinderGeometry(0.12, 0.12, 0.26, 10), p.x, 2.2, p.z));
      addFairy([new V3(p.x, 2.2, p.z)]);
    });
    // a basket of lanterns waiting to be lit
    [0, 1, 2].forEach((i) => lanternGeo.push(put(new THREE.CylinderGeometry(0.1, 0.1, 0.22, 10), pierEnd.x + 0.15, 0.32 + (i === 2 ? 0.18 : 0), pierEnd.z - 0.12 + i * 0.12)));
    g.add(new THREE.Mesh(merge(lanternGeo), new THREE.MeshBasicMaterial({ color: hdr(0xffa860, 1.5) })));
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.3, 14, 1, true), wood);
    basket.position.set(pierEnd.x + 0.15, 0.15, pierEnd.z);
    const sign = plainSign(null, 1.6, 0.45, signTex({ eyebrow: 'MAKE A WISH', title: 'Lantern pier', sub: 'Write an intention, let it rise', w: 820, h: 230, accent: '#ffc27a' }));
    sign.position.set(pierEnd.x + 0.4, 2.65, pierEnd.z);
    sign.rotation.y = Math.PI / 2;
    g.add(basket, sign, pool(pierEnd, 1.6, 0xffa860, 0.4, 0.01));
    garden.add(g);
    const info = { kind: 'spot', id: 'pier' };
    tag(g, info);
    interact(pierEnd, 2.4, info);
  }

  /* the meditation circle: cushions round a singing bowl */
  const medPos = at(G, -110, 4.6);
  {
    const g = new THREE.Group();
    const N = Math.round(512 * S);
    const [c, x] = canvas(N, N);
    const h = N / 2;
    const rg = x.createRadialGradient(h, h, 0, h, h, h);
    rg.addColorStop(0, '#3a2a5a');
    rg.addColorStop(1, '#1a1430');
    x.fillStyle = rg;
    x.beginPath(); x.arc(h, h, h - 2, 0, Math.PI * 2); x.fill();
    x.strokeStyle = 'rgba(247,225,176,.6)';
    x.lineWidth = 2 * S + 1;
    for (let r = 0.3; r < 1; r += 0.18) { x.beginPath(); x.arc(h, h, h * r, 0, Math.PI * 2); x.stroke(); }
    for (let i = 0; i < 12; i++) {
      x.save(); x.translate(h, h); x.rotate(i / 12 * Math.PI * 2);
      x.beginPath(); x.ellipse(0, -h * 0.55, h * 0.08, h * 0.26, 0, 0, Math.PI * 2); x.stroke();
      x.restore();
    }
    const matTop = new THREE.Mesh(new THREE.CircleGeometry(1.7, 48), new THREE.MeshBasicMaterial({ map: T.toTexture(c), transparent: true }));
    matTop.rotation.x = -Math.PI / 2;
    matTop.position.y = 0.01;
    const nCu = 8;
    const cushions = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.27, 0.3, 0.14, 16), new THREE.MeshLambertMaterial({ color: 0xffffff }), nCu);
    const d = new THREE.Object3D();
    const cols = [0x7a5cc2, 0xc792e0, 0x5aa9c9, 0xe88aa6];
    for (let i = 0; i < nCu; i++) {
      const a = i / nCu * Math.PI * 2;
      d.position.set(Math.cos(a) * 1.25, 0.08, Math.sin(a) * 1.25);
      d.updateMatrix();
      cushions.setMatrixAt(i, d.matrix);
      cushions.setColorAt(i, new THREE.Color(cols[i % cols.length]));
    }
    const prof = [[0, 0], [0.16, 0.0], [0.22, 0.05], [0.26, 0.14], [0.27, 0.2], [0.25, 0.2], [0.23, 0.14], [0.19, 0.07], [0, 0.07]].map(([r, y]) => new THREE.Vector2(r, y));
    const bowl = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), mat.gold);
    bowl.position.y = 0.02;
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.235, 24), new THREE.MeshBasicMaterial({ color: hdr(0x9fd8ff, 1.6) }));
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.19;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.radial, color: 0x9fb8ff, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.set(2.2, 2.2, 1);
    glow.position.y = 0.6;
    const mg = new THREE.BufferGeometry(), mp = [], ms = [];
    for (let i = 0; i < 40; i++) { const a = Math.random() * Math.PI * 2, r = Math.random() * 0.9; mp.push(Math.cos(a) * r, Math.random() * 2.6, Math.sin(a) * r); ms.push(Math.random()); }
    mg.setAttribute('position', new THREE.Float32BufferAttribute(mp, 3));
    mg.setAttribute('aSeed', new THREE.Float32BufferAttribute(ms, 1));
    const mm = pointsMaterial(new THREE.Color(0.75, 0.82, 1.0).multiplyScalar(1.8), { size: 0.04, alpha: 0.7, rise: 0.25, height: 2.6 });
    pointMats.push(mm);
    const sign = plainSign(null, 1.7, 0.47, signTex({ eyebrow: 'BREATHE WITH US', title: 'Meditation circle', sub: 'Sit, press E, and let a minute slow down', w: 860, h: 240, accent: '#c9b8ff', bg: ['#251c44', '#120d24'] }));
    sign.position.set(0, 2.35, 0);
    g.add(matTop, cushions, bowl, water, glow, new THREE.Points(mg, mm), sign);
    g.position.copy(medPos);
    g.rotation.y = faceTo(medPos, G);
    garden.add(g);
    const info = { kind: 'spot', id: 'meditate', seat: at(G, -110, 3.4), look: new V3(medPos.x, 0.4, medPos.z) };
    tag(g, info);
    interact(medPos, 2.6, info);
    colliders.push({ x: medPos.x, z: medPos.z, r: 0.35 });
    animated.push((t) => { glow.material.opacity = 0.35 + Math.sin(t * 0.8) * 0.12; sign.lookAt(camera.position.x, sign.getWorldPosition(new V3()).y, camera.position.z); });
  }

  /* the stone that asks: should you write a book? */
  const quizPos = at(G, -45, 4.8);
  {
    const g = new THREE.Group();
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.62, 0), rockLight);
    stone.scale.set(1, 0.85, 0.8);
    stone.position.y = 0.42;
    // an open book floating above it, and a golden quill
    const page = new THREE.MeshBasicMaterial({ color: hdr(0xfff3dc, 1.25), side: THREE.DoubleSide });
    const book = new THREE.Group();
    [-1, 1].forEach((sd) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.56), page); p.position.set(sd * 0.2, 0, 0); p.rotation.y = sd * 0.25; book.add(p); });
    book.rotation.x = -1.0;
    book.position.y = 1.55;
    const quill = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.02, 0.6, 6), mat.gold);
    const vane = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.42), new THREE.MeshBasicMaterial({ color: hdr(0xf7e1b0, 1.4), side: THREE.DoubleSide }));
    vane.position.y = 0.12;
    quill.add(shaft, vane);
    quill.position.set(0.28, 1.9, 0);
    quill.rotation.z = -0.5;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.radial, color: 0xffe2a8, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.set(1.8, 1.8, 1);
    glow.position.y = 1.6;
    const sign = plainSign(null, 1.9, 0.53, signTex({ eyebrow: 'SEVEN QUESTIONS', title: 'Should you write a book?', sub: 'Press E and find out', w: 900, h: 252 }));
    sign.position.set(0, 2.55, 0);
    g.add(stone, book, quill, glow, sign, pool(new V3(), 1.6, 0xffd08a, 0.35));
    g.position.copy(quizPos);
    g.rotation.y = faceTo(quizPos, G);
    garden.add(g);
    const info = { kind: 'spot', id: 'quiz' };
    tag(g, info);
    interact(quizPos, 2.5, info);
    colliders.push({ x: quizPos.x, z: quizPos.z, r: 0.6 });
    animated.push((t) => {
      book.position.y = 1.55 + Math.sin(t * 1.2) * 0.05;
      quill.position.y = 1.9 + Math.sin(t * 1.2 + 1) * 0.06;
      quill.rotation.y = Math.sin(t * 0.7) * 0.4;
    });
  }

  /* ======================= LIFE COACH CODE ======================= */
  const L = LCC_C;
  const lcc = new THREE.Group();
  {
    const N = Math.round(1024 * S);
    const [c, x] = canvas(N, N);
    const k = N / (2 * R);
    const bg = x.createRadialGradient(N / 2, N / 2, N * 0.05, N / 2, N / 2, N / 2);
    bg.addColorStop(0, '#2a1838');
    bg.addColorStop(0.75, '#170d21');
    bg.addColorStop(1, '#0c0712');
    x.fillStyle = bg;
    x.fillRect(0, 0, N, N);
    x.strokeStyle = 'rgba(226,189,120,.5)';
    [1.6, 2.6, 4.4, 6.9].forEach((r, i) => { x.lineWidth = (i === 3 ? 3 : 1.5) * S + 0.5; x.beginPath(); x.arc(N / 2, N / 2, r * k, 0, Math.PI * 2); x.stroke(); });
    // rays out to the twelve solutions
    x.strokeStyle = 'rgba(226,189,120,.28)';
    for (let i = 0; i < 12; i++) {
      const a = (180 + 115 + i * (130 / 11)) * D2R;
      x.beginPath();
      x.moveTo(N / 2 + Math.cos(a) * 1.7 * k, N / 2 + Math.sin(a) * 1.7 * k);
      x.lineTo(N / 2 + Math.cos(a) * 5.6 * k, N / 2 + Math.sin(a) * 5.6 * k);
      x.stroke();
    }
    if (logoImg) {
      x.globalAlpha = 0.9;
      x.drawImage(logoImg, N / 2 - 1.2 * k, N / 2 - 1.2 * k, 2.4 * k, 2.4 * k);
      x.globalAlpha = 1;
    }
    lcc.add(island(L, T.toTexture(c)));
  }
  const lBridge = bridge(1, { eyebrow: 'THIS WAY', title: 'Life Coach Code', sub: '12 solutions · join as a coach · our books' }, 0xffc27a);
  lcc.add(lBridge.group);
  tag(lBridge.gate, { kind: 'spot', id: 'lcc-gate' });
  interact(new V3(BRIDGE_X0 - 1.4, 0, PATH_Z), 2.6, { kind: 'spot', id: 'lcc-gate' });

  // the gate: the name on the way in, the numbers on the way out
  {
    const p = at(L, 0, R - 0.55);
    const g = new THREE.Group();
    [-1, 1].forEach((sz) => {
      const pil = new THREE.Mesh(new THREE.BoxGeometry(0.42, 3.6, 0.42), mat.marble);
      pil.position.set(sz * 1.75, 1.8, 0);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.52), mat.gold);
      cap.position.set(sz * 1.75, 3.66, 0);
      g.add(pil, cap);
    });
    const front = plainSign(null, 3.9, 1.0, signTex({ eyebrow: 'SOLUTIONS FOR COACHES', title: 'Life Coach Code', sub: 'The partner behind the coach', w: 1024, h: 262 }));
    front.position.set(0, 3.15, 0.04);
    const stats = (LCC.stats || []).map(([n, l]) => `${n} ${l.toUpperCase()}`).join('  ·  ');
    const back = plainSign(null, 3.9, 1.0, signTex({ eyebrow: 'FOR COACHES, BY COACHES', title: 'Become unmissable', sub: stats || 'Twelve done-for-you solutions', w: 1024, h: 262 }));
    back.position.set(0, 3.15, -0.04);
    back.rotation.y = Math.PI;
    const medal = new THREE.Mesh(new THREE.CircleGeometry(0.42, 40), new THREE.MeshBasicMaterial({ map: logoTex, transparent: true }));
    medal.position.set(0, 4.15, 0.05);
    const medalB = medal.clone();
    medalB.rotation.y = Math.PI;
    medalB.position.z = -0.05;
    g.add(front, back, medal, medalB);
    g.position.copy(p);
    g.rotation.y = faceTo(p, L) + Math.PI;
    lcc.add(g);
    g.updateMatrixWorld(true);
    [-1, 1].forEach((sz) => { const w = g.localToWorld(new V3(sz * 1.75, 0, 0)); colliders.push({ x: w.x, z: w.z, r: 0.32 }); });
  }

  /* twelve solutions in an arc: one mesh, one texture, one draw call */
  const sol = LCC.solutions || [];
  const solPos = [];
  if (sol.length) {
    const cols = 4, rows = Math.ceil((sol.length + 1) / cols);
    const cw = Math.round(400 * S), ch = Math.round(700 * S);
    const [c, x] = canvas(cols * cw, rows * ch);
    const cell = (i) => [(i % cols) * cw, Math.floor(i / cols) * ch];
    sol.forEach((s, i) => {
      const [X, Y] = cell(i);
      const u = cw / 400;
      const g = x.createLinearGradient(X, Y, X, Y + ch);
      g.addColorStop(0, s.flagship ? '#3a1d3e' : '#2a1636');
      g.addColorStop(1, '#120a1a');
      x.fillStyle = g;
      x.fillRect(X, Y, cw, ch);
      x.strokeStyle = s.flagship ? '#f7e1b0' : GOLD;
      x.lineWidth = (s.flagship ? 6 : 4) * u;
      x.strokeRect(X + 10 * u, Y + 10 * u, cw - 20 * u, ch - 20 * u);
      x.textAlign = 'left';
      x.textBaseline = 'alphabetic';
      x.font = `600 ${Math.round(120 * u)}px ${SERIF}`;
      x.fillStyle = T.goldGradient(x, 0, Y + 40 * u, 0, Y + 150 * u);
      x.fillText(String(i + 1).padStart(2, '0'), X + 34 * u, Y + 140 * u);
      x.fillStyle = GOLD;
      x.font = `800 ${Math.round(22 * u)}px ${SANS}`;
      T.spaced(x, s.area.toUpperCase(), X + 36 * u, Y + 186 * u, 4 * u, 'left');
      if (s.flagship) { x.fillStyle = '#f7e1b0'; x.font = `800 ${Math.round(17 * u)}px ${SANS}`; T.spaced(x, '★ FLAGSHIP', X + cw - 36 * u, Y + 64 * u, 3 * u, 'right'); }
      x.fillStyle = '#fbf3e4';
      const t = T.fit(x, s.title, { family: SERIF, weight: 600, max: Math.round(46 * u), min: Math.round(30 * u), maxW: cw - 72 * u, maxLines: 4 });
      x.font = `600 ${t.size}px ${SERIF}`;
      let y = Y + 250 * u;
      t.lines.forEach((l) => { x.fillText(l, X + 36 * u, y); y += t.size * 1.08; });
      y += 18 * u;
      x.font = `600 ${Math.round(21 * u)}px ${SANS}`;
      (s.features || []).slice(0, 4).forEach((f) => {
        x.fillStyle = GOLD;
        x.beginPath(); x.arc(X + 42 * u, y - 7 * u, 4 * u, 0, Math.PI * 2); x.fill();
        x.fillStyle = 'rgba(242,234,221,.86)';
        x.fillText(f, X + 56 * u, y);
        y += 34 * u;
      });
      x.fillStyle = 'rgba(226,189,120,.16)';
      x.fillRect(X + 24 * u, Y + ch - 92 * u, cw - 48 * u, 62 * u);
      x.fillStyle = '#f7e1b0';
      x.font = `800 ${Math.round(18 * u)}px ${SANS}`;
      x.textAlign = 'center';
      T.spaced(x, 'PRESS E  ·  BOOK A FREE CALL', X + cw / 2, Y + ch - 53 * u, 2.5 * u);
    });
    // the back of every panel
    {
      const [X, Y] = cell(sol.length);
      x.fillStyle = '#160c1e';
      x.fillRect(X, Y, cw, ch);
      if (logoImg) { x.globalAlpha = 0.55; x.drawImage(logoImg, X + cw * 0.2, Y + ch / 2 - cw * 0.3, cw * 0.6, cw * 0.6); x.globalAlpha = 1; }
    }
    const atlas = T.toTexture(c);
    const W = 1.18, H = W * 700 / 400;
    const quads = [];
    const uvq = (geo, i) => {
      const [X, Y] = cell(i);
      const u0 = X / c.width, u1 = (X + cw) / c.width, v1 = 1 - Y / c.height, v0 = 1 - (Y + ch) / c.height;
      const uv = geo.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) ? u1 : u0, uv.getY(k) ? v1 : v0);
      return geo;
    };
    const bases = [];
    sol.forEach((s, i) => {
      const deg = 115 + i * (130 / Math.max(1, sol.length - 1));
      const p = at(L, deg, 6.15);
      const ry = faceTo(p, L);
      solPos.push(p);
      quads.push(put(uvq(new THREE.PlaneGeometry(W, H), i), p.x, 0.42 + H / 2, p.z, ry));
      quads.push(put(uvq(new THREE.PlaneGeometry(W, H), sol.length), p.x - Math.sin(ry) * 0.012, 0.42 + H / 2, p.z - Math.cos(ry) * 0.012, ry + Math.PI));
      bases.push(put(new THREE.BoxGeometry(W + 0.12, 0.42, 0.2), p.x, 0.21, p.z, ry));
      bases.push(put(new THREE.BoxGeometry(W + 0.1, 0.05, 0.12), p.x, 0.44 + H, p.z, ry));
      const info = { kind: 'solution', index: i };
      interact(p.clone().lerp(L, 0.22), 2.5, info);
      colliders.push({ x: p.x, z: p.z, r: 0.5 });
    });
    const panels = new THREE.Mesh(merge(quads), new THREE.MeshBasicMaterial({ map: atlas }));
    panels.userData.solutions = true;
    clickables.push(panels);
    const frames = new THREE.Mesh(merge(bases), mat.gold);
    lcc.add(panels, frames);
    // light spilling at the foot of each panel: one mesh
    const spill = merge(solPos.map((p) => put(new THREE.PlaneGeometry(1.8, 1.8), p.x, 0.012, p.z, 0, -Math.PI / 2)));
    lcc.add(new THREE.Mesh(spill, poolMat(0xffc27a, 0.3)));
  }

  /* the guide of Life Coach Code, at the centre */
  {
    const g = new THREE.Group();
    const dais = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.35, 0.14, 40), mat.marble);
    dais.position.y = 0.07;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.035, 6, 64), mat.gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.15;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 1.1, 14), mat.gold);
    pillar.position.y = 0.7;
    const medal = new THREE.Group();
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.42, 40), new THREE.MeshBasicMaterial({ map: logoTex }));
    const back = new THREE.Mesh(new THREE.CircleGeometry(0.44, 40).rotateY(Math.PI), mat.gold);
    back.position.z = -0.01;
    medal.add(face, back);
    medal.position.y = 1.75;
    const orbitA = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.012, 6, 64), new THREE.MeshBasicMaterial({ color: hdr(0xffd08a, 2.0) }));
    const orbitB = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.01, 6, 64), new THREE.MeshBasicMaterial({ color: hdr(0x9fd8ff, 1.8) }));
    orbitA.position.y = orbitB.position.y = 1.75;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.5, 0.6, 24, 1, true).rotateX(Math.PI), coneMaterial(0xffe2b0, 0.25));
    beam.position.y = 1.4;
    const tagTex = T.nameTagTexture('Your Life Coach Code guide', 'Ask me anything');
    const tagS = new THREE.Sprite(new THREE.SpriteMaterial({ map: tagTex, transparent: true, depthWrite: false }));
    tagS.scale.set(1.5, 1.5 * 168 / 640, 1);
    tagS.position.y = 2.42;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.radial, color: 0xffd9a0, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.set(2, 2, 1);
    glow.position.y = 1.75;
    g.add(dais, ring, pillar, beam, glow, medal, orbitA, orbitB, tagS, pool(new V3(), 2.4, 0xffd08a, 0.35));
    g.position.copy(L);
    lcc.add(g);
    const info = { kind: 'spot', id: 'lcc-guide' };
    tag(g, info);
    interact(L, 2.8, info);
    colliders.push({ x: L.x, z: L.z, r: 1.1 });
    const look = new V3();
    animated.push((t, dt) => {
      g.worldToLocal(look.copy(camera.position));
      medal.rotation.y += (Math.atan2(look.x, look.z) - medal.rotation.y) * Math.min(1, dt * 2.5);
      orbitA.rotation.set(Math.sin(t * 0.5) * 0.6 + 1.2, t * 0.4, 0);
      orbitB.rotation.set(Math.cos(t * 0.4) * 0.6 + 0.4, -t * 0.3, 0.3);
      medal.position.y = 1.75 + Math.sin(t * 0.9) * 0.03;
    });
  }

  /* boards: three ways to join, the free call, and words from coaches */
  function board(pos, w, h, texture, info, range = 2.4) {
    const g = new THREE.Group();
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texture }));
    face.position.y = 0.55 + h / 2;
    const backing = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, h + 0.12, 0.06), mat.gold);
    backing.position.set(0, 0.55 + h / 2, -0.04);
    const legs = new THREE.Mesh(merge([-1, 1].map((sd) => put(new THREE.BoxGeometry(0.08, 0.6, 0.08), sd * (w / 2 - 0.2), 0.3, -0.04))), mat.gold);
    g.add(face, backing, legs);
    g.position.copy(pos);
    g.rotation.y = faceTo(pos, L);
    lcc.add(g);
    tag(g, info);
    interact(pos.clone().lerp(L, 0.25), range, info);
    g.updateMatrixWorld(true);
    [-1, 0, 1].forEach((sd) => { const wp = g.localToWorld(new V3(sd * w / 3, 0, 0)); colliders.push({ x: wp.x, z: wp.z, r: w / 6 + 0.1 }); });
    return { group: g, face };
  }
  // join: three panels side by side
  const joinPos = at(L, -66, 5.3);
  {
    const ways = LCC.join || [];
    const u = S;
    const [c, x] = canvas(Math.round(1500 * u), Math.round(760 * u));
    const g = x.createLinearGradient(0, 0, 0, c.height);
    g.addColorStop(0, '#2a1636');
    g.addColorStop(1, '#110a19');
    x.fillStyle = g;
    x.fillRect(0, 0, c.width, c.height);
    x.textAlign = 'center';
    x.fillStyle = GOLD;
    x.font = `800 ${Math.round(28 * u)}px ${SANS}`;
    T.spaced(x, 'BE PART OF IT', c.width / 2, 64 * u, 6 * u);
    x.font = `600 ${Math.round(62 * u)}px ${SERIF}`;
    x.fillStyle = T.goldGradient(x, 0, 80 * u, 0, 150 * u);
    x.fillText('Join Life Coach Code as a coach', c.width / 2, 140 * u);
    const cwid = (c.width - 120 * u) / 3;
    ways.slice(0, 3).forEach((w, i) => {
      const X = 40 * u + i * (cwid + 20 * u), Y = 180 * u;
      x.fillStyle = 'rgba(255,255,255,.05)';
      x.fillRect(X, Y, cwid, c.height - Y - 40 * u);
      x.strokeStyle = 'rgba(226,189,120,.6)';
      x.lineWidth = 2 * u;
      x.strokeRect(X, Y, cwid, c.height - Y - 40 * u);
      x.font = `600 ${Math.round(90 * u)}px ${SERIF}`;
      x.fillStyle = T.goldGradient(x, 0, Y + 30 * u, 0, Y + 120 * u);
      x.fillText(String(i + 1), X + cwid / 2, Y + 112 * u);
      x.font = `600 ${Math.round(40 * u)}px ${SERIF}`;
      x.fillStyle = '#fbf3e4';
      x.fillText(w.title, X + cwid / 2, Y + 176 * u);
      x.font = `500 ${Math.round(24 * u)}px ${SANS}`;
      x.fillStyle = 'rgba(242,234,221,.82)';
      lines(x, w.text, X + cwid / 2, Y + 228 * u, cwid - 50 * u, 34 * u, 5);
    });
    x.fillStyle = '#f7e1b0';
    x.font = `800 ${Math.round(20 * u)}px ${SANS}`;
    T.spaced(x, 'PRESS E TO CHOOSE YOUR WAY IN', c.width / 2, c.height - 12 * u, 3 * u);
    board(joinPos, 3.3, 3.3 * 760 / 1500, T.toTexture(c), { kind: 'spot', id: 'lcc-join' }, 2.8);
  }
  // the free call
  const callPos = at(L, 24, 5.5);
  {
    const u = S;
    const [c, x] = canvas(Math.round(760 * u), Math.round(900 * u));
    const g = x.createLinearGradient(0, 0, 0, c.height);
    g.addColorStop(0, '#3a1d3e');
    g.addColorStop(1, '#120a1a');
    x.fillStyle = g;
    x.fillRect(0, 0, c.width, c.height);
    x.strokeStyle = '#f7e1b0';
    x.lineWidth = 5 * u;
    x.strokeRect(14 * u, 14 * u, c.width - 28 * u, c.height - 28 * u);
    // a calendar
    const cx = c.width / 2;
    x.fillStyle = 'rgba(255,255,255,.08)';
    x.fillRect(cx - 110 * u, 70 * u, 220 * u, 190 * u);
    x.fillStyle = '#c98f45';
    x.fillRect(cx - 110 * u, 70 * u, 220 * u, 50 * u);
    x.fillStyle = GOLD;
    for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) x.fillRect(cx - 88 * u + k * 48 * u, 142 * u + r * 38 * u, 30 * u, 22 * u);
    x.fillStyle = '#fff6e8';
    x.beginPath(); x.arc(cx + 72 * u, 228 * u, 30 * u, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#3a1d3e';
    x.font = `800 ${Math.round(34 * u)}px ${SANS}`;
    x.textAlign = 'center';
    x.fillText('✓', cx + 72 * u, 240 * u);
    x.fillStyle = GOLD;
    x.font = `800 ${Math.round(24 * u)}px ${SANS}`;
    T.spaced(x, 'ONE CONVERSATION', cx, 330 * u, 5 * u);
    x.font = `600 ${Math.round(60 * u)}px ${SERIF}`;
    x.fillStyle = T.goldGradient(x, 0, 360 * u, 0, 520 * u);
    lines(x, 'Book your free strategy call', cx, 410 * u, c.width - 100 * u, 66 * u, 2);
    x.font = `500 ${Math.round(26 * u)}px ${SANS}`;
    x.fillStyle = 'rgba(242,234,221,.85)';
    lines(x, 'In 30 minutes we find the one move that changes the most for your coaching, and you leave with a plan whether we work together or not.', cx, 590 * u, c.width - 110 * u, 36 * u, 5);
    x.fillStyle = '#f7e1b0';
    x.font = `800 ${Math.round(22 * u)}px ${SANS}`;
    T.spaced(x, 'PRESS E · FREE, NO PRESSURE', cx, c.height - 50 * u, 3 * u);
    board(callPos, 1.5, 1.5 * 900 / 760, T.toTexture(c), { kind: 'spot', id: 'lcc-call' });
  }
  // words from coaches: one quote at a time, turning every few seconds
  const wordsPos = at(L, -24, 5.5);
  const quotes = LCC.testimonials || [];
  if (quotes.length) {
    const u = S;
    const [c, x] = canvas(Math.round(900 * u), Math.round(640 * u));
    const texQ = T.toTexture(c);
    let qi = 0;
    const draw = () => {
      const qd = quotes[qi % quotes.length];
      const g = x.createLinearGradient(0, 0, 0, c.height);
      g.addColorStop(0, '#2a1636');
      g.addColorStop(1, '#110a19');
      x.fillStyle = g;
      x.fillRect(0, 0, c.width, c.height);
      x.textAlign = 'center';
      x.fillStyle = GOLD;
      x.font = `800 ${Math.round(24 * u)}px ${SANS}`;
      T.spaced(x, 'IN THEIR WORDS', c.width / 2, 62 * u, 6 * u);
      x.font = `600 ${Math.round(110 * u)}px ${SERIF}`;
      x.fillText('“', c.width / 2, 160 * u);
      const t = T.fit(x, qd.quote, { family: SERIF, weight: 500, style: 'italic', max: Math.round(38 * u), min: Math.round(24 * u), maxW: c.width - 120 * u, maxLines: 7 });
      x.font = `italic 500 ${t.size}px ${SERIF}`;
      x.fillStyle = '#fbf3e4';
      t.lines.forEach((l, i) => x.fillText(l, c.width / 2, 200 * u + i * t.size * 1.2));
      x.fillStyle = '#f7e1b0';
      x.font = `700 ${Math.round(26 * u)}px ${SANS}`;
      x.fillText(qd.name, c.width / 2, c.height - 72 * u);
      x.fillStyle = 'rgba(242,234,221,.6)';
      x.font = `600 ${Math.round(20 * u)}px ${SANS}`;
      x.fillText(qd.role || '', c.width / 2, c.height - 40 * u);
      texQ.needsUpdate = true;
    };
    draw();
    board(wordsPos, 1.9, 1.9 * 640 / 900, texQ, { kind: 'spot', id: 'lcc-words' });
    let next = 9;
    animated.push((t) => { if (t > next) { next = t + 9; qi++; draw(); } });
  }

  // everything that never moves stops costing a matrix update every frame
  [garden, lcc].forEach((g) => { scene.add(g); });
  still(garden.children[0]);
  still(lcc.children[0]);

  /* ---------- places ---------- */
  const place = (id, label, pos, look) => places.push({ id, label, pos: pos.setY(0), look });
  place('garden', 'The Garden', at(G, 0, R - 1.6), new V3(G.x, 2.4, G.z));
  place('garden-bar', 'The Elixir Bar', at(G, 100, 3.0), barPos.clone().setY(1.5));
  place('garden-cookies', 'Fortune cookies', at(G, 40, 2.75), cookiePos.clone().setY(1.2));
  place('garden-pier', 'Lantern pier', at(G, 180, R + 0.7), pierEnd.clone().setY(1.6).add(new V3(-3, 0, 0)));
  place('garden-meditation', 'Meditation circle', at(G, -110, 2.7), medPos.clone().setY(0.5));
  place('garden-quiz', 'Should you write a book?', at(G, -45, 3.1), quizPos.clone().setY(1.6));
  place('lcc', 'Life Coach Code', at(L, 0, R - 1.4), new V3(L.x, 1.8, L.z));
  place('lcc-solutions', 'Twelve solutions for coaches', at(L, 180, 2.8), at(L, 180, 6, 1.5));
  place('lcc-join', 'Join as a coach', joinPos.clone().lerp(L, 0.62), joinPos.clone().setY(1.4));
  place('lcc-guide', 'Your Life Coach Code guide', at(L, 0, 2.3), new V3(L.x, 1.7, L.z));
  place('lcc-call', 'Book a free call', callPos.clone().lerp(L, 0.5), callPos.clone().setY(1.4));

  /* ---------- where you can walk ---------- */
  const regions = [];
  [-1, 1].forEach((sd) => {
    const xa = Math.min(sd * (BRIDGE_X0 - 0.4), sd * (BRIDGE_X1 + 0.8)), xb = Math.max(sd * (BRIDGE_X0 - 0.4), sd * (BRIDGE_X1 + 0.8));
    regions.push((x, z) => [Math.max(xa, Math.min(xb, x)), Math.max(PATH_Z - 0.85, Math.min(PATH_Z + 0.85, z))]);
  });
  [G, L].forEach((c) => regions.push((x, z) => {
    const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), r = R - 0.55;
    return d <= r ? [x, z] : [c.x + dx / d * r, c.z + dz / d * r];
  }));
  {
    const a0 = at(G, 180, R - 0.8);
    const xa = Math.min(a0.x, pierEnd.x - 0.2), xb = Math.max(a0.x, pierEnd.x - 0.2);
    regions.push((x, z) => [Math.max(xa, Math.min(xb, x)), Math.max(G.z - 0.65, Math.min(G.z + 0.65, z))]);
  }

  /* ---------- draw and animate only what is near ---------- */
  const near = { garden: false, lcc: false };
  function update(t, dt, cam) {
    const dG = Math.hypot(cam.x - G.x, cam.z - G.z), dL = Math.hypot(cam.x - L.x, cam.z - L.z);
    garden.visible = dG < 75;
    lcc.visible = dL < 75;
    near.garden = dG < 34;
    near.lcc = dL < 34;
    if (near.garden || near.lcc) animated.forEach((fn) => fn(t, dt));
  }
  function zoneOf(p) {
    if (Math.hypot(p.x - G.x, p.z - G.z) < R + 3.5 || (p.x < -BRIDGE_X0 + 0.5 && Math.abs(p.z - PATH_Z) < 2)) return 'garden';
    if (Math.hypot(p.x - L.x, p.z - L.z) < R + 1 || (p.x > BRIDGE_X0 - 0.5 && Math.abs(p.z - PATH_Z) < 2)) return 'lcc';
    return null;
  }

  return {
    colliders, interactables, clickables, places, regions, update, zoneOf,
    pierEnd: pierEnd.clone(),
    serveDrink: (color, nearPos) => serve(color, nearPos),
    solutionAt: (i) => solPos[i] || null
  };
}
