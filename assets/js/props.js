/*
 * A small, hand-built scene beside every booth that carries the spirit of its book.
 * Each builder returns { group, update(t, dt), colliders: [[x, z, r]] } in booth-local space.
 * Unknown slugs (new books) get a gentle floating-lantern piece, so adding books never breaks.
 */
import * as THREE from 'three';
import { makeCanvas, toTexture } from './textures.js';

const SERIF = '"Cormorant Garamond", Georgia, serif';
const SANS = 'Manrope, Arial, sans-serif';

export function createProps(ctx) {
  const { mat, pointsMaterial, pointMats, radial, camera, lowEnd } = ctx;
  const hdr = (c, k) => new THREE.Color(c).multiplyScalar(k);
  const glowMat = (c, k = 2) => new THREE.MeshBasicMaterial({ color: hdr(c, k) });
  const additive = (map, color, opacity = 1) => new THREE.MeshBasicMaterial({
    map, color: new THREE.Color(color), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });
  const sprite = (color, size, opacity = 0.8) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: radial, color: new THREE.Color(color), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.scale.set(size, size, 1);
    return s;
  };
  const sparks = ({ n = 40, w = 0.8, d = 0.8, y = 0, h = 2, color = 0xffc070, k = 2, size = 0.035, rise = 2, alpha = 0.9 }) => {
    const count = lowEnd ? Math.ceil(n / 2) : n;
    const g = new THREE.BufferGeometry();
    const p = [], s = [];
    for (let i = 0; i < count; i++) { p.push((Math.random() - 0.5) * w, Math.random() * h, (Math.random() - 0.5) * d); s.push(Math.random()); }
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(s, 1));
    const m = pointsMaterial(hdr(color, k), { size, alpha, rise, height: h });
    pointMats.push(m);
    const pts = new THREE.Points(g, m);
    pts.position.y = y;
    pts.frustumCulled = false;
    return pts;
  };
  const gold = mat.gold, goldSoft = mat.goldSoft;
  const cyl = (rt, rb, h, m, seg = 24) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  const box = (x, y, z, m) => new THREE.Mesh(new THREE.BoxGeometry(x, y, z), m);
  const plinth = (r = 0.45, h = 0.08) => {
    const g = new THREE.Group();
    const base = cyl(r, r + 0.03, h, mat.marble, 48);
    base.position.y = h / 2;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 8, 64), gold);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = h;
    g.add(base, rim);
    return g;
  };
  const billboard = (obj) => obj.quaternion.copy(camera.quaternion);
  const waterMaterial = (tint, glow, strip) => new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uTint: { value: new THREE.Color(tint) }, uGlow: { value: hdr(glow, 1.4) } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `uniform float uTime;uniform vec3 uTint;uniform vec3 uGlow;varying vec2 vUv;
      void main(){vec2 p=vUv-0.5;float r=length(p);
      float w=sin(p.x*31.0+uTime*1.1+sin(p.y*17.0-uTime*0.7)*1.6)*0.5+0.5;float w2=sin(p.y*43.0-uTime*1.4+sin(p.x*23.0)*1.2)*0.5+0.5;
      vec3 c=uTint*(0.62+0.25*w*w2)+uGlow*pow(w*w2,6.0)*0.4+uGlow*smoothstep(0.34,0.0,length(p-vec2(0.0,0.14)))*0.5;
      float a=${strip ? 'smoothstep(0.5,0.38,abs(p.y))*smoothstep(0.5,0.44,abs(p.x))' : 'smoothstep(0.5,0.43,r)'};
      gl_FragColor=vec4(c,a*0.94);}`,
    transparent: true, depthWrite: false
  });

  /* ---------- canvas art ---------- */
  function wingTexture() {
    const c = makeCanvas(512, 512), x = c.getContext('2d');
    x.translate(470, 470);
    for (let i = 0; i < 16; i++) {
      const a = -Math.PI * 0.52 - (i / 15) * Math.PI * 0.5;
      const len = 300 + Math.sin(i * 0.9) * 60 + (15 - i) * 6;
      x.save();
      x.rotate(a + Math.PI / 2);
      const g = x.createLinearGradient(0, 0, 0, -len);
      g.addColorStop(0, 'rgba(255,240,180,0.95)');
      g.addColorStop(0.5, 'rgba(255,150,50,0.75)');
      g.addColorStop(1, 'rgba(255,80,20,0)');
      x.fillStyle = g;
      x.beginPath();
      x.ellipse(0, -len / 2, 16 + i * 0.6, len / 2, 0, 0, Math.PI * 2);
      x.fill();
      x.restore();
    }
    return toTexture(c);
  }
  // what the mirror shows: a silhouette with wings of fire, as on the cover
  function mirrorTexture() {
    const W = 256, H = 256, c = makeCanvas(W, H), x = c.getContext('2d');
    const g = x.createRadialGradient(W / 2, H * 0.45, 10, W / 2, H / 2, W * 0.6);
    g.addColorStop(0, '#3a2232');
    g.addColorStop(1, '#0d0a14');
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
    x.save();
    x.translate(W / 2, H * 0.58);
    for (let s = -1; s <= 1; s += 2) {
      for (let i = 0; i < 12; i++) {
        const a = -Math.PI / 2 + s * (0.25 + i * 0.1);
        const len = 70 + Math.sin(i * 0.8) * 16;
        x.save();
        x.rotate(a + Math.PI / 2);
        const fg = x.createLinearGradient(0, 0, 0, -len);
        fg.addColorStop(0, 'rgba(255,230,160,.95)');
        fg.addColorStop(0.6, 'rgba(255,130,40,.7)');
        fg.addColorStop(1, 'rgba(255,60,10,0)');
        x.fillStyle = fg;
        x.beginPath();
        x.ellipse(0, -len / 2, 6, len / 2, 0, 0, Math.PI * 2);
        x.fill();
        x.restore();
      }
    }
    x.fillStyle = '#0a0709';
    x.shadowColor = '#ffb050';
    x.shadowBlur = 14;
    x.beginPath(); x.arc(0, -40, 13, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.moveTo(-20, -24); x.quadraticCurveTo(0, -30, 20, -24); x.lineTo(16, 40); x.lineTo(5, 90); x.lineTo(-5, 90); x.lineTo(-16, 40); x.closePath(); x.fill();
    x.restore();
    for (let i = 0; i < 40; i++) {
      x.fillStyle = `rgba(255,${150 + Math.random() * 90},80,${Math.random() * 0.8})`;
      x.beginPath(); x.arc(Math.random() * W, Math.random() * H, Math.random() * 1.6, 0, Math.PI * 2); x.fill();
    }
    return toTexture(c);
  }
  // The three symbols from the cover, redrawn as crisp line art
  function stepMedallion(st) {
    const S = 512, c = makeCanvas(S, S), x = c.getContext('2d');
    const g = x.createRadialGradient(S * 0.4, S * 0.35, 20, S / 2, S / 2, S / 2);
    g.addColorStop(0, shade(st.bg, 1.25));
    g.addColorStop(1, shade(st.bg, 0.85));
    x.fillStyle = g;
    x.beginPath(); x.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.7)';
    x.lineWidth = 12;
    x.beginPath(); x.arc(S / 2, S / 2, S / 2 - 14, 0, Math.PI * 2); x.stroke();
    x.strokeStyle = '#fff';
    x.fillStyle = '#fff';
    x.lineWidth = 15;
    x.lineCap = 'round';
    x.lineJoin = 'round';
    if (st.icon === 'brain') {
      for (const sgn of [-1, 1]) {
        x.save();
        x.translate(256, 0);
        x.scale(sgn, 1);
        x.beginPath();
        x.moveTo(8, 150);
        x.bezierCurveTo(-30, 120, -92, 128, -100, 172);
        x.bezierCurveTo(-140, 180, -150, 236, -122, 258);
        x.bezierCurveTo(-150, 290, -128, 344, -84, 340);
        x.bezierCurveTo(-70, 372, -24, 378, 8, 356);
        x.stroke();
        x.beginPath(); x.moveTo(-40, 170); x.quadraticCurveTo(-58, 205, -30, 228); x.stroke();
        x.beginPath(); x.moveTo(-96, 258); x.quadraticCurveTo(-60, 250, -48, 282); x.stroke();
        x.beginPath(); x.moveTo(-70, 330); x.quadraticCurveTo(-60, 300, -30, 304); x.stroke();
        x.restore();
      }
      x.beginPath(); x.moveTo(256, 150); x.lineTo(256, 356); x.stroke();
      x.beginPath(); x.moveTo(256, 356); x.quadraticCurveTo(262, 392, 290, 404); x.stroke();
    } else if (st.icon === 'heart') {
      x.beginPath();
      x.moveTo(256, 372);
      x.bezierCurveTo(150, 300, 120, 240, 150, 190);
      x.bezierCurveTo(180, 145, 240, 150, 256, 200);
      x.bezierCurveTo(272, 150, 332, 145, 362, 190);
      x.bezierCurveTo(392, 240, 362, 300, 256, 372);
      x.closePath();
      x.stroke();
    } else {
      x.beginPath(); x.arc(256, 300, 78, Math.PI, 0); x.stroke();
      for (let i = 0; i <= 6; i++) {
        const a = Math.PI + (i / 6) * Math.PI;
        x.beginPath();
        x.moveTo(256 + Math.cos(a) * 110, 300 + Math.sin(a) * 110);
        x.lineTo(256 + Math.cos(a) * 146, 300 + Math.sin(a) * 146);
        x.stroke();
      }
      x.beginPath(); x.moveTo(132, 300); x.lineTo(380, 300); x.stroke();
      x.beginPath(); x.moveTo(176, 336); x.lineTo(336, 336); x.stroke();
      x.beginPath(); x.moveTo(236, 366); x.lineTo(256, 382); x.lineTo(276, 366); x.stroke();
    }
    return toTexture(c);
  }
  function stepLabel(st) {
    const W = 600, H = 200, c = makeCanvas(W, H), x = c.getContext('2d');
    x.fillStyle = 'rgba(30,16,36,.9)';
    x.beginPath();
    x.roundRect ? x.roundRect(6, 6, W - 12, H - 12, 26) : x.rect(6, 6, W - 12, H - 12);
    x.fill();
    x.strokeStyle = '#e2bd78';
    x.lineWidth = 5;
    x.stroke();
    x.fillStyle = st.bg;
    x.beginPath(); x.arc(78, H / 2, 44, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#fff';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.font = `700 34px ${SERIF}`;
    x.fillText(st.n, 78, H / 2 + 2);
    x.textAlign = 'left';
    x.fillStyle = '#fbf0dc';
    x.font = `600 64px ${SERIF}`;
    x.fillText(st.name, 142, 80);
    x.fillStyle = '#f2c98a';
    x.font = `italic 500 38px ${SERIF}`;
    x.fillText(st.sub, 144, 140);
    return toTexture(c);
  }
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const ch = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
    return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
  }
  function textBoard(text, w = 512, h = 128, bg = '#2a1630', fg = '#f7e1b0') {
    const c = makeCanvas(w, h), x = c.getContext('2d');
    x.fillStyle = bg;
    x.fillRect(0, 0, w, h);
    x.strokeStyle = '#e2bd78';
    x.lineWidth = 6;
    x.strokeRect(8, 8, w - 16, h - 16);
    x.fillStyle = fg;
    x.font = `600 ${h * 0.46}px ${SERIF}`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(text, w / 2, h / 2 + 4);
    return toTexture(c);
  }
  function roadTexture() {
    const c = makeCanvas(128, 512), x = c.getContext('2d');
    x.fillStyle = '#231a20';
    x.fillRect(0, 0, 128, 512);
    x.fillStyle = '#e8a24a';
    x.fillRect(4, 0, 8, 512);
    x.fillRect(116, 0, 8, 512);
    for (let y = 0; y < 512; y += 64) x.fillRect(60, y + 8, 8, 34);
    return toTexture(c, { repeat: [1, 4] });
  }
  function sunTexture(inner = '#fff3c4', mid = '#ffb347', outer = 'rgba(255,90,40,0)') {
    const c = makeCanvas(256, 256), x = c.getContext('2d');
    const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, inner);
    g.addColorStop(0.35, mid);
    g.addColorStop(1, outer);
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 256);
    return toTexture(c);
  }
  function iconTexture(draw, bg) {
    const c = makeCanvas(256, 256), x = c.getContext('2d');
    x.fillStyle = bg;
    x.beginPath();
    x.roundRect ? x.roundRect(16, 16, 224, 224, 54) : x.rect(16, 16, 224, 224);
    x.fill();
    x.strokeStyle = 'rgba(255,255,255,.55)';
    x.lineWidth = 6;
    x.stroke();
    x.strokeStyle = '#fff';
    x.fillStyle = '#fff';
    x.lineWidth = 14;
    x.lineCap = 'round';
    x.lineJoin = 'round';
    draw(x);
    return toTexture(c);
  }
  const ICONS = {
    heart: (x) => { x.beginPath(); x.moveTo(128, 186); x.bezierCurveTo(40, 130, 60, 60, 128, 92); x.bezierCurveTo(196, 60, 216, 130, 128, 186); x.fill(); },
    chat: (x) => { x.beginPath(); x.roundRect ? x.roundRect(60, 70, 136, 96, 28) : x.rect(60, 70, 136, 96); x.fill(); x.beginPath(); x.moveTo(90, 160); x.lineTo(78, 196); x.lineTo(118, 164); x.fill(); },
    bell: (x) => { x.beginPath(); x.moveTo(78, 168); x.quadraticCurveTo(84, 70, 128, 70); x.quadraticCurveTo(172, 70, 178, 168); x.closePath(); x.fill(); x.beginPath(); x.arc(128, 184, 14, 0, 6.3); x.fill(); },
    wifi: (x) => { [80, 56, 32].forEach((r) => { x.beginPath(); x.arc(128, 180, r, Math.PI * 1.22, Math.PI * 1.78); x.stroke(); }); x.beginPath(); x.arc(128, 180, 10, 0, 6.3); x.fill(); },
    star: (x) => { x.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 30 : 70, a = i / 10 * Math.PI * 2 - Math.PI / 2; x.lineTo(128 + Math.cos(a) * r, 132 + Math.sin(a) * r); } x.closePath(); x.fill(); },
    smile: (x) => { x.beginPath(); x.arc(128, 128, 62, 0, 6.3); x.stroke(); x.beginPath(); x.arc(128, 128, 36, 0.2 * Math.PI, 0.8 * Math.PI); x.stroke(); x.beginPath(); x.arc(106, 112, 9, 0, 6.3); x.arc(150, 112, 9, 0, 6.3); x.fill(); },
    brain: (x) => { x.beginPath(); x.arc(104, 120, 40, Math.PI * 0.6, Math.PI * 1.9); x.arc(152, 120, 40, Math.PI * 1.1, Math.PI * 0.4); x.stroke(); x.beginPath(); x.moveTo(128, 84); x.lineTo(128, 176); x.stroke(); },
    sun: (x) => { x.beginPath(); x.arc(128, 150, 40, Math.PI, 0); x.fill(); for (let i = 0; i < 7; i++) { const a = Math.PI + i / 6 * Math.PI; x.beginPath(); x.moveTo(128 + Math.cos(a) * 56, 150 + Math.sin(a) * 56); x.lineTo(128 + Math.cos(a) * 80, 150 + Math.sin(a) * 80); x.stroke(); } x.fillRect(60, 160, 136, 12); }
  };
  function yantraTexture() {
    const S = 1024, c = makeCanvas(S, S), x = c.getContext('2d');
    x.translate(S / 2, S / 2);
    x.strokeStyle = '#ffd77a';
    x.lineWidth = 7;
    x.shadowColor = '#ffb347';
    x.shadowBlur = 18;
    [470, 440].forEach((r) => { x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.stroke(); });
    for (let i = 0; i < 16; i++) {
      x.save();
      x.rotate((i / 16) * Math.PI * 2);
      x.beginPath();
      x.moveTo(0, -300);
      x.quadraticCurveTo(60, -360, 0, -420);
      x.quadraticCurveTo(-60, -360, 0, -300);
      x.stroke();
      x.restore();
    }
    for (let i = 0; i < 8; i++) {
      x.save();
      x.rotate((i / 8) * Math.PI * 2 + Math.PI / 8);
      x.beginPath();
      x.moveTo(0, -200);
      x.quadraticCurveTo(70, -250, 0, -300);
      x.quadraticCurveTo(-70, -250, 0, -200);
      x.stroke();
      x.restore();
    }
    x.beginPath(); x.arc(0, 0, 200, 0, Math.PI * 2); x.stroke();
    const tri = (r, up, dy) => { x.beginPath(); for (let k = 0; k < 3; k++) { const a = (up ? -Math.PI / 2 : Math.PI / 2) + k * Math.PI * 2 / 3; x.lineTo(Math.cos(a) * r, Math.sin(a) * r + dy); } x.closePath(); x.stroke(); };
    tri(190, true, 10); tri(190, false, -10); tri(140, true, -16); tri(140, false, 18); tri(95, true, 6); tri(95, false, -6); tri(52, true, 0);
    x.fillStyle = '#fff1c4';
    x.beginPath(); x.arc(0, 0, 12, 0, Math.PI * 2); x.fill();
    return toTexture(c);
  }
  function dialTexture() {
    const S = 512, c = makeCanvas(S, S), x = c.getContext('2d');
    const g = x.createRadialGradient(S / 2, S / 2, 20, S / 2, S / 2, S / 2);
    g.addColorStop(0, '#f6ecd4');
    g.addColorStop(1, '#d9c8a2');
    x.fillStyle = g;
    x.beginPath(); x.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); x.fill();
    x.translate(S / 2, S / 2);
    x.strokeStyle = '#3a2c1c';
    for (let i = 0; i < 72; i++) {
      x.save(); x.rotate(i / 72 * Math.PI * 2);
      x.lineWidth = i % 9 === 0 ? 4 : 1.5;
      x.beginPath(); x.moveTo(0, -238); x.lineTo(0, i % 9 === 0 ? -212 : -224); x.stroke();
      x.restore();
    }
    x.fillStyle = '#1d1712';
    for (let i = 0; i < 8; i++) {
      const r = i % 2 ? 46 : 150, a = i / 8 * Math.PI * 2 - Math.PI / 2;
      x.beginPath(); x.moveTo(0, 0);
      x.lineTo(Math.cos(a - 0.12) * 28, Math.sin(a - 0.12) * 28);
      x.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      x.lineTo(Math.cos(a + 0.12) * 28, Math.sin(a + 0.12) * 28);
      x.fill();
    }
    x.font = `800 30px ${SANS}`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('CHARACTER', 0, -180);
    x.fillText('EFFORT', 0, 186);
    x.save(); x.rotate(Math.PI / 2); x.fillText('JOY', 0, -180); x.restore();
    x.save(); x.rotate(-Math.PI / 2); x.fillText('RESILIENCE', 0, -180); x.restore();
    return toTexture(c);
  }
  function silhouetteTexture(lean) {
    const W = 256, H = 640, c = makeCanvas(W, H), x = c.getContext('2d');
    x.translate(W / 2, 0);
    x.fillStyle = '#0c0a0e';
    x.shadowColor = '#ff9a3d';
    x.shadowBlur = 16;
    x.beginPath(); x.arc(lean, 70, 40, 0, Math.PI * 2); x.fill();
    x.beginPath();
    x.moveTo(-70 + lean, 140); x.quadraticCurveTo(lean, 110, 70 + lean, 140);
    x.lineTo(62, 360); x.lineTo(48, 620); x.lineTo(10, 620); x.lineTo(0, 400); x.lineTo(-10, 620); x.lineTo(-48, 620); x.lineTo(-62, 360);
    x.closePath(); x.fill();
    return toTexture(c);
  }
  function mountainTexture() {
    const W = 512, H = 256, c = makeCanvas(W, H), x = c.getContext('2d');
    x.fillStyle = '#16262b';
    x.beginPath(); x.moveTo(0, H);
    [[0, 170], [70, 120], [130, 150], [210, 70], [300, 140], [360, 110], [440, 160], [512, 120], [512, H]].forEach(([a, b]) => x.lineTo(a, b));
    x.fill();
    x.fillStyle = '#0d1418';
    x.beginPath(); x.moveTo(0, H);
    [[0, 210], [120, 180], [260, 215], [380, 175], [512, 200], [512, H]].forEach(([a, b]) => x.lineTo(a, b));
    x.fill();
    return toTexture(c);
  }
  function woodTexture() {
    const c = makeCanvas(256, 256), x = c.getContext('2d');
    x.fillStyle = '#5a3a22';
    x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 60; i++) {
      x.strokeStyle = `rgba(${30 + Math.random() * 40},${18 + Math.random() * 20},10,${0.2 + Math.random() * 0.3})`;
      x.lineWidth = 1 + Math.random() * 2;
      x.beginPath();
      const y = Math.random() * 256;
      x.moveTo(0, y);
      x.bezierCurveTo(80, y + (Math.random() - 0.5) * 20, 170, y + (Math.random() - 0.5) * 20, 256, y);
      x.stroke();
    }
    return toTexture(c);
  }
  function leafTexture() {
    const c = makeCanvas(64, 64), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 64, 64);
    g.addColorStop(0, '#fff0b0');
    g.addColorStop(1, '#d99a3a');
    x.fillStyle = g;
    x.beginPath(); x.moveTo(32, 4); x.quadraticCurveTo(62, 32, 32, 60); x.quadraticCurveTo(2, 32, 32, 4); x.fill();
    return toTexture(c);
  }
  function paperTexture(lines, typewriter) {
    const W = 384, H = 512, c = makeCanvas(W, H), x = c.getContext('2d');
    x.fillStyle = '#f7f1e3';
    x.fillRect(0, 0, W, H);
    x.fillStyle = '#2a2420';
    x.font = typewriter ? '500 30px "Courier New", Courier, monospace' : `italic 500 34px ${SERIF}`;
    x.textAlign = 'center';
    lines.forEach((l, i) => x.fillText(l, W / 2, 120 + i * 50));
    x.strokeStyle = '#2a2420';
    x.lineWidth = 3;
    x.beginPath();
    x.moveTo(W / 2, 380); x.bezierCurveTo(W / 2 - 40, 340, W / 2 - 20, 316, W / 2, 342); x.bezierCurveTo(W / 2 + 20, 316, W / 2 + 40, 340, W / 2, 380);
    x.stroke();
    return toTexture(c);
  }
  function blueprintTexture() {
    const W = 256, H = 340, c = makeCanvas(W, H), x = c.getContext('2d');
    x.fillStyle = '#1f4f8a';
    x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(255,255,255,.25)';
    x.lineWidth = 1;
    for (let i = 0; i < W; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); }
    for (let i = 0; i < H; i += 16) { x.beginPath(); x.moveTo(0, i); x.lineTo(W, i); x.stroke(); }
    x.strokeStyle = '#fff';
    x.lineWidth = 3;
    x.beginPath();
    x.moveTo(128, 250); x.bezierCurveTo(30, 190, 60, 90, 128, 140); x.bezierCurveTo(196, 90, 226, 190, 128, 250);
    x.stroke();
    const g = x.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.62);
    g.addColorStop(0, 'rgba(255,120,30,0)');
    g.addColorStop(0.75, 'rgba(255,120,30,.7)');
    g.addColorStop(1, 'rgba(40,10,0,1)');
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
    return toTexture(c);
  }

  /* ---------- the pieces, one per book ---------- */
  const builders = {
    // A gilded mirror with fiery wings rising behind it
    'finding-love-in-the-mirror'() {
      const g = new THREE.Group();
      g.add(plinth(0.5));
      const frame = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.04, 16, 80), gold);
      frame.scale.set(1, 1.45, 1);
      frame.position.y = 1.32;
      const mt = mirrorTexture();
      const glass = new THREE.Mesh(new THREE.CircleGeometry(0.4, 80), new THREE.MeshStandardMaterial({ map: mt, emissive: 0xffffff, emissiveMap: mt, emissiveIntensity: 0.9, metalness: 0.6, roughness: 0.08 }));
      glass.scale.set(1, 1.45, 1);
      glass.position.set(0, 1.32, 0.005);
      const crest = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), gold);
      crest.position.y = 1.97;
      const stand = cyl(0.025, 0.035, 0.75, gold);
      stand.position.y = 0.45;
      const wingTex = wingTexture();
      const wings = [-1, 1].map((s) => {
        const w = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.25), additive(wingTex, 0xffffff, 0.75));
        const pivot = new THREE.Group();
        pivot.position.set(s * 0.08, 1.35, -0.12);
        w.position.set(s * 0.48, 0.12, 0);
        w.scale.x = -s;
        pivot.add(w);
        g.add(pivot);
        return pivot;
      });
      const glow = sprite(0xff8a3a, 2.2, 0.55);
      glow.position.set(0, 1.35, -0.2);
      g.add(frame, glass, crest, stand, glow, sparks({ n: 50, w: 1.4, d: 0.6, y: 0.3, h: 2.2, color: 0xff8a3a, k: 2.6, size: 0.03 }));
      return {
        group: g,
        update(t) { wings.forEach((w, i) => { w.rotation.y = (i ? -1 : 1) * (0.25 + Math.sin(t * 1.4) * 0.18); }); },
        colliders: [[0, 0, 0.55]]
      };
    },

    // A signpost at the start of a winding road toward a rising sun
    'clarity-before-momentum'() {
      const g = new THREE.Group();
      const post = cyl(0.035, 0.045, 2.2, new THREE.MeshStandardMaterial({ color: 0x4a2e1c, roughness: 0.7 }));
      post.position.set(-0.25, 1.1, 0.25);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), gold);
      cap.position.set(-0.25, 2.22, 0.25);
      g.add(post, cap);
      [['CLARITY', 1.95, 0.5], ['PURPOSE', 1.66, -0.7], ['MOMENTUM', 1.37, 0.15]].forEach(([word, y, rot], i) => {
        const arm = new THREE.Group();
        arm.position.set(-0.25, y, 0.25);
        arm.rotation.y = rot;
        const tex = textBoard(word, 512, 128, i === 0 ? '#5a2416' : '#2a1630');
        const board = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.025), [goldSoft, goldSoft, goldSoft, goldSoft, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 })]);
        board.position.x = 0.36;
        const tip = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.09, 0.12, 3), goldSoft);
        tip.rotation.z = -Math.PI / 2;
        tip.position.x = 0.73;
        arm.add(board, tip);
        g.add(arm);
      });
      const sun = new THREE.Mesh(new THREE.CircleGeometry(0.7, 64, 0, Math.PI), additive(sunTexture(), 0xffffff, 1));
      sun.position.set(0.35, 0.02, -0.55);
      const halo = sprite(0xffa040, 2.6, 0.6);
      halo.position.set(0.35, 0.3, -0.6);
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0.35, 0.012, -0.5), new THREE.Vector3(0.0, 0.012, -0.1), new THREE.Vector3(0.45, 0.012, 0.3), new THREE.Vector3(0.05, 0.012, 0.75)]);
      g.add(sun, halo, ribbon(curve, 0.22, roadTexture()));
      return { group: g, update() {}, colliders: [[-0.25, 0.25, 0.3]] };
    },

    // Glowing app icons orbiting a bright mind
    'teen-mental-health'() {
      const g = new THREE.Group();
      g.add(plinth(0.42));
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 3), glowMat(0xffc46b, 1.5));
      core.position.y = 1.45;
      const halo = sprite(0x6fb6ff, 1.0, 0.35);
      halo.position.y = 1.45;
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.05, 1.4, 16, 1, true), additive(null, 0x6fb6ff, 0.18));
      beam.position.y = 0.75;
      const kinds = [['heart', '#e0566a'], ['chat', '#3b82c4'], ['bell', '#d9a23d'], ['wifi', '#2f9e8f'], ['star', '#8a5cd6'], ['smile', '#e07a2a'], ['heart', '#3b82c4']];
      const tiles = kinds.map(([k, c], i) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshBasicMaterial({ map: iconTexture(ICONS[k], c), transparent: true }));
        m.userData.a = (i / kinds.length) * Math.PI * 2;
        m.userData.h = 1.2 + (i % 3) * 0.22;
        g.add(m);
        return m;
      });
      g.add(core, halo, beam, sparks({ n: 60, w: 1.1, d: 1.1, y: 0.2, h: 2, color: 0x7cc4ff, k: 2.2, size: 0.03, rise: 1.5 }));
      return {
        group: g,
        update(t) {
          tiles.forEach((m, i) => {
            const a = m.userData.a + t * 0.5;
            m.position.set(Math.cos(a) * 0.58, m.userData.h + Math.sin(t * 1.3 + i) * 0.06, Math.sin(a) * 0.58);
            billboard(m);
          });
          core.rotation.y = t * 0.4;
        },
        colliders: [[0, 0, 0.5]]
      };
    },

    // A little wooden dock reaching into a misty sunrise pond
    'the-invisible-midlife-woman'() {
      const g = new THREE.Group();
      const water = waterMaterial(0x2f5a6a, 0xffb66a, false);
      const pond = new THREE.Mesh(new THREE.CircleGeometry(0.85, 64), water);
      pond.rotation.x = -Math.PI / 2;
      pond.position.set(0, 0.016, -0.3);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.03, 8, 80), mat.marble);
      rim.rotation.x = Math.PI / 2;
      rim.position.set(0, 0.02, -0.3);
      const wood = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.8 });
      for (let i = 0; i < 7; i++) {
        const p = box(0.5, 0.04, 0.12, wood);
        p.position.set(0, 0.07, 0.62 - i * 0.15);
        g.add(p);
      }
      [-0.24, 0.24].forEach((x) => {
        const post = cyl(0.03, 0.035, 0.5, wood, 12);
        post.position.set(x, 0.25, -0.3);
        g.add(post);
      });
      const lampPost = cyl(0.015, 0.015, 0.7, gold, 8);
      lampPost.position.set(0.24, 0.6, -0.3);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), glowMat(0xffb060, 3.2));
      lamp.position.set(0.24, 0.98, -0.3);
      const mists = [];
      for (let i = 0; i < 6; i++) {
        const m = sprite(0xe8e2f2, 0.9 + Math.random() * 0.5, 0.12);
        m.position.set((Math.random() - 0.5) * 1.2, 0.2 + Math.random() * 0.3, -0.3 + (Math.random() - 0.5) * 1.1);
        m.userData.ph = Math.random() * 6;
        mists.push(m);
        g.add(m);
      }
      const sunGlow = sprite(0xffa45a, 1.6, 0.4);
      sunGlow.position.set(0, 0.35, -0.9);
      g.add(pond, rim, lampPost, lamp, sunGlow);
      return {
        group: g,
        update(t) {
          water.uniforms.uTime.value = t;
          mists.forEach((m) => { m.position.x += Math.sin(t * 0.2 + m.userData.ph) * 0.0008; m.material.opacity = 0.08 + Math.sin(t * 0.5 + m.userData.ph) * 0.05; });
        },
        colliders: [[0, -0.3, 0.9]]
      };
    },

    // A slowly turning Sri Yantra above a glowing lotus
    'conscious-integrative-therapy'() {
      const g = new THREE.Group();
      g.add(plinth(0.45));
      const tex = yantraTexture();
      const outer = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.25), additive(tex, 0xffe2a0, 1));
      outer.position.y = 1.55;
      const inner = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), additive(tex, 0x9a8cff, 0.8));
      inner.position.set(0, 1.55, 0.02);
      const halo = sprite(0x5a4cff, 2.2, 0.55);
      halo.position.set(0, 1.55, -0.05);
      const petalMat = new THREE.MeshStandardMaterial({ color: 0xf2b8c6, emissive: 0xff8fb0, emissiveIntensity: 0.5, roughness: 0.5 });
      const lotus = new THREE.Group();
      lotus.position.y = 0.12;
      for (let ring = 0; ring < 2; ring++) {
        for (let i = 0; i < 8; i++) {
          const p = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), petalMat);
          p.scale.set(0.45, 0.25, 1);
          const a = (i / 8) * Math.PI * 2 + ring * 0.4;
          p.position.set(Math.cos(a) * (0.13 - ring * 0.05), 0.04 + ring * 0.05, Math.sin(a) * (0.13 - ring * 0.05));
          p.rotation.y = -a + Math.PI / 2;
          p.rotation.x = -0.6 - ring * 0.4;
          lotus.add(p);
        }
      }
      const bud = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), glowMat(0xffd27a, 2.6));
      bud.position.y = 0.1;
      lotus.add(bud);
      g.add(outer, inner, halo, lotus, sparks({ n: 40, w: 1.2, d: 0.5, y: 0.6, h: 1.8, color: 0xb6a6ff, k: 2.2, size: 0.03, rise: 1 }));
      return {
        group: g,
        update(t) { outer.rotation.z = t * 0.12; inner.rotation.z = -t * 0.25; outer.position.y = 1.55 + Math.sin(t * 0.8) * 0.04; inner.position.y = outer.position.y; },
        colliders: [[0, 0, 0.5]]
      };
    },

    // A great brass compass: character, resilience, effort, joy
    'more-than-a-game'() {
      const g = new THREE.Group();
      g.add(plinth(0.45));
      [0, 1, 2].forEach((i) => {
        const a = (i / 3) * Math.PI * 2;
        const leg = cyl(0.015, 0.02, 1.1, gold, 8);
        leg.position.set(Math.cos(a) * 0.18, 0.6, Math.sin(a) * 0.18);
        leg.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
        g.add(leg);
      });
      const comp = new THREE.Group();
      comp.position.set(0, 1.25, 0);
      comp.rotation.x = -0.75;
      const body = cyl(0.42, 0.42, 0.08, gold, 64);
      body.rotation.x = Math.PI / 2;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 12, 80), gold);
      ring.position.z = 0.045;
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.385, 64), new THREE.MeshStandardMaterial({ map: dialTexture(), roughness: 0.6, emissive: 0xffffff, emissiveIntensity: 0.25 }));
      face.material.emissiveMap = face.material.map;
      face.position.z = 0.042;
      const needle = new THREE.Group();
      needle.position.z = 0.06;
      const n1 = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.32, 4), new THREE.MeshStandardMaterial({ color: 0xc8963c, metalness: 1, roughness: 0.25 }));
      n1.position.y = 0.16;
      const n2 = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.32, 4), new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.6, roughness: 0.4 }));
      n2.position.y = -0.16;
      n2.rotation.z = Math.PI;
      const pin = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), gold);
      needle.add(n1, n2, pin);
      const loop = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.016, 8, 24), gold);
      loop.position.y = 0.5;
      const crown = cyl(0.04, 0.04, 0.08, gold, 16);
      crown.position.y = 0.45;
      comp.add(body, ring, face, needle, loop, crown);
      const glow = sprite(0xffcc80, 1.6, 0.35);
      glow.position.y = 1.25;
      g.add(comp, glow);
      return {
        group: g,
        update(t) { needle.rotation.z = 0.7 + Math.sin(t * 0.7) * 0.35 + Math.sin(t * 2.3) * 0.05; },
        colliders: [[0, 0, 0.5]]
      };
    },

    // The 3-Step Path from the cover: Name it, Claim it, Reframe it
    'food-isnt-the-problem'() {
      const g = new THREE.Group();
      const steps = [
        { n: 'I', name: 'NAME IT', sub: 'Name the feeling', icon: 'brain', bg: '#1f4e79', glow: 0x6aaeff, ribbon: 0x4a90d9 },
        { n: 'II', name: 'CLAIM IT', sub: 'It makes sense to feel it', icon: 'heart', bg: '#2f8f9e', glow: 0x6fe0d0, ribbon: 0x3fb5b0 },
        { n: 'III', name: 'REFRAME IT', sub: 'What do I truly need?', icon: 'sun', bg: '#e0772e', glow: 0xffa050, ribbon: 0xf08a3a }
      ];
      const meds = [];
      steps.forEach((st, i) => {
        const x = -0.66 + i * 0.66, h = 0.16 + i * 0.2;
        const stone = cyl(0.25, 0.28, h, mat.marble, 40);
        stone.position.set(x, h / 2, 0);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.012, 8, 48), gold);
        rim.rotation.x = Math.PI / 2;
        rim.position.set(x, h, 0);
        const label = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.2), new THREE.MeshBasicMaterial({ map: stepLabel(st), transparent: true }));
        label.position.set(x, h + 0.2, 0.02);
        const med = new THREE.Group();
        med.position.set(x, h + 0.66, 0);
        const back = cyl(0.27, 0.27, 0.03, gold, 48);
        back.rotation.x = Math.PI / 2;
        back.position.z = -0.02;
        const face = new THREE.Mesh(new THREE.CircleGeometry(0.25, 64), new THREE.MeshBasicMaterial({ map: stepMedallion(st) }));
        const halo = sprite(st.glow, 1.0, 0.35);
        halo.position.z = -0.05;
        med.add(halo, back, face);
        med.userData.base = med.position.y;
        med.userData.ph = i * 1.4;
        meds.push(med);
        // a ribbon of light flowing from each step back to the book, like the lines on the cover
        const from = new THREE.Vector3(x - 0.2, h + 0.62, -0.05);
        const curve = new THREE.CatmullRomCurve3([from, new THREE.Vector3(x - 0.55, h + 0.75 + i * 0.05, -0.25), new THREE.Vector3(-1.05, 1.15 + i * 0.12, -0.4), new THREE.Vector3(-1.38, 1.3 + i * 0.08, -0.25)]);
        g.add(stone, rim, label, med, new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.009, 6, false), glowMat(st.ribbon, 1.6)));
      });
      g.add(sparks({ n: 40, w: 1.8, d: 0.5, y: 0.3, h: 1.8, color: 0xffc27a, k: 2, size: 0.026, rise: 0.8 }));
      return {
        group: g,
        update(t) { meds.forEach((m) => { m.position.y = m.userData.base + Math.sin(t * 0.9 + m.userData.ph) * 0.04; m.rotation.y = Math.sin(t * 0.5 + m.userData.ph) * 0.2; }); },
        colliders: [[-0.66, 0, 0.32], [0, 0, 0.32], [0.66, 0, 0.32]]
      };
    },

    // Two friends facing a sunset over the mountains
    'prince-and-the-prodigal'() {
      const g = new THREE.Group();
      g.add(plinth(0.55, 0.06));
      const sun = new THREE.Mesh(new THREE.CircleGeometry(0.75, 64), additive(sunTexture('#fff5d0', '#ffb347', 'rgba(255,90,30,0)'), 0xffffff, 1));
      sun.position.set(0, 0.85, -0.45);
      const halo = sprite(0xff9a40, 3, 0.45);
      halo.position.set(0, 0.85, -0.5);
      const mountains = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75), new THREE.MeshBasicMaterial({ map: mountainTexture(), transparent: true, alphaTest: 0.1 }));
      mountains.position.set(0, 0.43, -0.35);
      const figs = [-0.17, 0.2].map((x, i) => {
        const f = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.85), new THREE.MeshBasicMaterial({ map: silhouetteTexture(i ? 4 : -4), transparent: true, alphaTest: 0.05 }));
        f.position.set(x, 0.49, 0.05 + i * 0.05);
        return f;
      });
      g.add(sun, halo, mountains, ...figs, sparks({ n: 30, w: 1.3, d: 0.4, y: 0.1, h: 1.6, color: 0xffb060, k: 2, size: 0.025, rise: 0.6 }));
      return { group: g, update(t) { sun.scale.setScalar(1 + Math.sin(t * 0.6) * 0.02); }, colliders: [[0, 0, 0.55]] };
    },

    // An open drawer, and golden vines rising out of it
    'journey-to-empowerment'() {
      const g = new THREE.Group();
      const wood = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.6 });
      const cab = box(0.8, 0.55, 0.55, wood);
      cab.position.set(0, 0.275, -0.1);
      const drawer = new THREE.Group();
      drawer.position.set(0, 0.42, 0.22);
      const bottom = box(0.66, 0.02, 0.5, wood);
      const front = box(0.72, 0.2, 0.03, wood);
      front.position.set(0, 0.02, 0.25);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), gold);
      knob.position.set(0, 0.03, 0.28);
      const sideL = box(0.02, 0.16, 0.5, wood);
      sideL.position.set(-0.33, 0.07, 0);
      const sideR = sideL.clone();
      sideR.position.x = 0.33;
      const light = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.46), additive(radial, 0xffd27a, 1.4));
      light.rotation.x = -Math.PI / 2;
      light.position.y = 0.04;
      drawer.add(bottom, front, knob, sideL, sideR, light);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.26, 1.6, 32, 1, true), additive(null, 0xffc46b, 0.12));
      beam.position.set(0, 1.25, 0.22);
      const vineMat = glowMat(0xf2c46b, 1.8);
      const leafMat = new THREE.MeshBasicMaterial({ map: leafTexture(), transparent: true, side: THREE.DoubleSide, color: new THREE.Color(1.6, 1.4, 1.0), depthWrite: false });
      const leaves = [];
      for (let v = 0; v < 5; v++) {
        const pts = [];
        const a0 = (v / 5) * Math.PI * 2;
        for (let i = 0; i <= 10; i++) {
          const t = i / 10;
          pts.push(new THREE.Vector3(Math.cos(a0 + t * 3.2) * (0.08 + t * 0.28), 0.45 + t * (1.4 + v * 0.12), 0.22 + Math.sin(a0 + t * 3.2) * (0.08 + t * 0.2)));
        }
        const curve = new THREE.CatmullRomCurve3(pts);
        g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.008, 6, false), vineMat));
        for (let k = 1; k < 7; k++) {
          const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.09), leafMat);
          leaf.position.copy(curve.getPoint(k / 7));
          leaf.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
          leaf.userData.ph = Math.random() * 6;
          leaves.push(leaf);
          g.add(leaf);
        }
      }
      g.add(cab, drawer, beam, sparks({ n: 50, w: 0.7, d: 0.5, y: 0.45, h: 1.8, color: 0xffd27a, k: 2.4, size: 0.03, rise: 1.2 }));
      return {
        group: g,
        update(t) { leaves.forEach((l) => { l.rotation.z += Math.sin(t + l.userData.ph) * 0.002; }); },
        colliders: [[0, 0, 0.55]]
      };
    },

    // A vintage typewriter, and blueprints drifting up as embers
    'when-the-blueprint-burned'() {
      const g = new THREE.Group();
      const table = cyl(0.42, 0.42, 0.04, new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.6 }), 40);
      table.position.y = 0.72;
      const leg = cyl(0.05, 0.12, 0.7, gold, 16);
      leg.position.y = 0.36;
      const tw = new THREE.Group();
      tw.position.set(0, 0.74, 0.02);
      const black = new THREE.MeshStandardMaterial({ color: 0x141214, metalness: 0.4, roughness: 0.3 });
      const bodyLow = box(0.46, 0.08, 0.32, black);
      bodyLow.position.y = 0.05;
      const bodyHigh = box(0.46, 0.1, 0.12, black);
      bodyHigh.position.set(0, 0.13, -0.09);
      const roller = cyl(0.04, 0.04, 0.54, black, 20);
      roller.rotation.z = Math.PI / 2;
      roller.position.set(0, 0.2, -0.1);
      const knobs = [-0.29, 0.29].map((x) => { const k = cyl(0.03, 0.03, 0.04, gold, 16); k.rotation.z = Math.PI / 2; k.position.set(x, 0.2, -0.1); return k; });
      const keyGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.012, 12);
      const keys = new THREE.InstancedMesh(keyGeo, new THREE.MeshStandardMaterial({ color: 0xece2cc, roughness: 0.4, metalness: 0.1 }), 33);
      const dm = new THREE.Object3D();
      let ki = 0;
      [11, 11, 11].forEach((count, row) => {
        for (let i = 0; i < count; i++) {
          dm.position.set(-0.18 + i * 0.036 + row * 0.01, 0.1 + row * 0.012, 0.12 - row * 0.045);
          dm.rotation.x = 0.25;
          dm.updateMatrix();
          keys.setMatrixAt(ki++, dm.matrix);
        }
      });
      const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.4), new THREE.MeshStandardMaterial({ map: paperTexture(['Not the life', 'I planned…', 'but the one', 'I was meant', 'to live.'], true), roughness: 0.9, side: THREE.DoubleSide, emissive: 0xffffff, emissiveIntensity: 0.25 }));
      paper.material.emissiveMap = paper.material.map;
      paper.position.set(0, 0.38, -0.14);
      paper.rotation.x = -0.18;
      tw.add(bodyLow, bodyHigh, roller, ...knobs, keys, paper);
      const bpTex = blueprintTexture();
      const sheets = [0, 1, 2, 3].map((i) => {
        const s = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.29), new THREE.MeshBasicMaterial({ map: bpTex, transparent: true, side: THREE.DoubleSide, color: new THREE.Color(1.3, 1.3, 1.3), depthWrite: false }));
        s.userData = { ph: i / 4, x: (Math.random() - 0.5) * 0.7, z: (Math.random() - 0.5) * 0.4 };
        g.add(s);
        return s;
      });
      g.add(table, leg, tw, sparks({ n: 60, w: 0.8, d: 0.5, y: 0.8, h: 1.8, color: 0xff7a2a, k: 2.6, size: 0.028, rise: 1.6 }));
      return {
        group: g,
        update(t) {
          sheets.forEach((s) => {
            const k = (t * 0.07 + s.userData.ph) % 1;
            s.position.set(s.userData.x + Math.sin(t + s.userData.ph * 6) * 0.08, 1.0 + k * 1.6, s.userData.z);
            s.rotation.set(Math.sin(t * 0.7 + s.userData.ph * 5) * 0.6, t * 0.5 + s.userData.ph * 6, Math.cos(t * 0.6) * 0.3);
            s.material.opacity = Math.sin(k * Math.PI);
          });
        },
        colliders: [[0, 0, 0.5]]
      };
    },

    // An hourglass of glowing sand: every grain falls for a reason
    'everything-happens-for-you'() {
      const g = new THREE.Group();
      g.add(plinth(0.4));
      const stand = cyl(0.05, 0.08, 0.55, gold, 20);
      stand.position.y = 0.35;
      const hg = new THREE.Group();
      hg.position.y = 0.65;
      const H = 0.9;
      [0, H].forEach((y) => { const d = cyl(0.3, 0.3, 0.04, gold, 40); d.position.y = y; hg.add(d); });
      [0, 1, 2].forEach((i) => {
        const a = (i / 3) * Math.PI * 2;
        const p = cyl(0.014, 0.014, H, gold, 8);
        p.position.set(Math.cos(a) * 0.26, H / 2, Math.sin(a) * 0.26);
        hg.add(p);
      });
      const prof = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24, y = 0.03 + t * (H - 0.06);
        const r = 0.035 + 0.17 * Math.pow(Math.abs(Math.sin(t * Math.PI)), 0.6) * (Math.abs(t - 0.5) * 2);
        prof.push(new THREE.Vector2(Math.max(0.03, r), y));
      }
      const glass = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), new THREE.MeshStandardMaterial({ color: 0x9fe3ef, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.2, depthWrite: false, side: THREE.DoubleSide }));
      const sandMat = glowMat(0xffc874, 1.7);
      const top = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.16, 32), sandMat);
      top.rotation.x = Math.PI;
      top.position.y = H * 0.68;
      const bottom = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.13, 32), sandMat);
      bottom.position.y = 0.1;
      const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, H * 0.42, 6), glowMat(0xffd08a, 2.6));
      stream.position.y = H * 0.38;
      hg.add(glass, top, bottom, stream);
      const halo = sprite(0x46a9bd, 1.8, 0.5);
      halo.position.y = 1.1;
      g.add(stand, hg, halo, sparks({ n: 40, w: 0.9, d: 0.9, y: 0.4, h: 1.8, color: 0x7fe0f0, k: 2, size: 0.028, rise: 0.8 }));
      return {
        group: g,
        update(t) { hg.rotation.y = t * 0.25; top.scale.y = 0.75 + 0.25 * Math.cos(t * 0.3); bottom.scale.y = 1.25 - 0.25 * Math.cos(t * 0.3); },
        colliders: [[0, 0, 0.45]]
      };
    },

    // A golden birdcage with its door open and a radiant diamond inside
    'healing-unraveled'() {
      const g = new THREE.Group();
      g.add(plinth(0.45));
      const col = cyl(0.06, 0.1, 0.75, gold, 20);
      col.position.y = 0.45;
      const cage = new THREE.Group();
      cage.position.y = 0.85;
      const base = cyl(0.42, 0.44, 0.06, gold, 48);
      cage.add(base);
      [0.06, 0.32, 0.6].forEach((y) => {
        const r = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.012, 8, 64), gold);
        r.rotation.x = Math.PI / 2;
        r.position.y = y;
        cage.add(r);
      });
      const N = 18;
      for (let i = 0; i < N; i++) {
        if (i === 0 || i === 1) continue;
        const a = (i / N) * Math.PI * 2;
        const c = Math.cos(a), s = Math.sin(a);
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(c * 0.4, 0.05, s * 0.4), new THREE.Vector3(c * 0.4, 0.6, s * 0.4),
          new THREE.Vector3(c * 0.3, 0.86, s * 0.3), new THREE.Vector3(c * 0.12, 1.0, s * 0.12), new THREE.Vector3(0, 1.03, 0)
        ]);
        cage.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.008, 5, false), gold));
      }
      const door = new THREE.Group();
      const a0 = (0.5 / N) * Math.PI * 2;
      door.position.set(Math.cos(a0 - 0.18) * 0.4, 0.05, Math.sin(a0 - 0.18) * 0.4);
      door.rotation.y = -a0 - 1.2;
      for (let i = 0; i < 4; i++) { const b = cyl(0.007, 0.007, 0.5, gold, 5); b.position.set(i * 0.045, 0.27, 0); door.add(b); }
      const dTop = box(0.15, 0.012, 0.012, gold);
      dTop.position.set(0.068, 0.52, 0);
      door.add(dTop);
      cage.add(door);
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 24), gold);
      hook.position.y = 1.1;
      cage.add(hook);
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), new THREE.MeshStandardMaterial({ color: 0xe9b8ff, emissive: 0xc06cff, emissiveIntensity: 1.6, metalness: 0.3, roughness: 0.05, flatShading: true }));
      gem.scale.y = 1.35;
      gem.position.y = 0.38;
      const gemGlow = sprite(0xd08cff, 1.4, 0.7);
      gemGlow.position.y = 0.38;
      cage.add(gem, gemGlow);
      const ribbons = sparks({ n: 70, w: 0.5, d: 0.5, y: 0.9, h: 1.6, color: 0xffd9a0, k: 2.4, size: 0.03, rise: 1.4 });
      ribbons.position.set(0.3, 0.9, 0.1);
      g.add(col, cage, ribbons);
      return {
        group: g,
        update(t) { gem.rotation.y = t * 0.8; gem.position.y = 0.38 + Math.sin(t * 1.2) * 0.03; },
        colliders: [[0, 0, 0.5]]
      };
    }
  };

  function sunflowerTexture() {
    const S = 256, c = makeCanvas(S, S), x = c.getContext('2d'), cx = S / 2;
    for (let ring = 0; ring < 2; ring++) {
      for (let i = 0; i < 22; i++) {
        x.save();
        x.translate(cx, cx);
        x.rotate((i / 22) * Math.PI * 2 + ring * 0.14);
        x.fillStyle = ring ? '#ffd166' : '#f2a91c';
        x.beginPath();
        x.moveTo(0, -34);
        x.quadraticCurveTo(15, -80, 0, -124 + ring * 8);
        x.quadraticCurveTo(-15, -80, 0, -34);
        x.fill();
        x.restore();
      }
    }
    x.fillStyle = '#4a2a0c';
    x.beginPath();
    x.arc(cx, cx, 44, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = 'rgba(255,209,102,.55)';
    for (let i = 0; i < 90; i++) { const r = Math.sqrt(i / 90) * 40, a = i * 2.4; x.beginPath(); x.arc(cx + Math.cos(a) * r, cx + Math.sin(a) * r, 1.8, 0, Math.PI * 2); x.fill(); }
    return toTexture(c);
  }

  Object.assign(builders, {
    // A sunlit tree in a little park, glowing footsteps leading to it, and a sign that says NOW
    'life-is-happening-now'() {
      const g = new THREE.Group();
      g.add(plinth(0.55));
      const bark = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.9 });
      const trunk = cyl(0.045, 0.08, 0.95, bark, 12);
      trunk.position.set(0.05, 0.55, -0.1);
      const leafA = new THREE.MeshStandardMaterial({ color: 0x5bb98c, roughness: 0.8, emissive: 0x2f7d4f, emissiveIntensity: 0.35 });
      const leafB = new THREE.MeshStandardMaterial({ color: 0x8fd16a, roughness: 0.8, emissive: 0x4f8f2f, emissiveIntensity: 0.35 });
      const canopy = new THREE.Group();
      canopy.position.set(0.05, 1.18, -0.1);
      [[0, 0.12, 0, 0.3, leafA], [-0.2, 0, 0.05, 0.22, leafB], [0.22, 0.02, 0, 0.23, leafA], [0.05, 0.3, -0.05, 0.2, leafB], [-0.05, -0.05, 0.18, 0.18, leafB]].forEach(([px, py, pz, r, m]) => {
        const s = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), m);
        s.position.set(px, py, pz);
        canopy.add(s);
      });
      const sun = sprite(0xffe2a0, 1.6, 0.55);
      sun.position.set(0.05, 1.35, -0.3);
      // footsteps that light up one after another, walking toward the tree
      const stepMat = [];
      const steps = [];
      for (let i = 0; i < 6; i++) {
        const m = new THREE.MeshBasicMaterial({ color: hdr(0xffd08a, 2), transparent: true, opacity: 0.3, depthWrite: false });
        stepMat.push(m);
        const f = new THREE.Mesh(new THREE.CircleGeometry(0.05, 20), m);
        f.scale.set(0.7, 1.3, 1);
        f.rotation.x = -Math.PI / 2;
        f.position.set((i % 2 ? 0.07 : -0.07) - 0.25 + i * 0.03, 0.09, 0.42 - i * 0.12);
        g.add(f);
        steps.push(f);
      }
      const post = cyl(0.015, 0.02, 0.62, gold, 8);
      post.position.set(-0.36, 0.38, 0.18);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.16), new THREE.MeshStandardMaterial({ map: textBoard('NOW', 384, 144, '#4a2a6a', '#fff1c4'), emissive: 0xffffff, emissiveIntensity: 0.45, roughness: 0.6 }));
      sign.material.emissiveMap = sign.material.map;
      sign.position.set(-0.36, 0.72, 0.19);
      g.add(trunk, canopy, sun, post, sign, sparks({ n: 30, w: 0.9, d: 0.7, y: 0.9, h: 1.0, color: 0xfff0b0, k: 2, size: 0.025, rise: 0.4 }));
      return {
        group: g,
        update(t) {
          canopy.rotation.z = Math.sin(t * 0.6) * 0.03;
          const k = (t * 1.2) % 7;
          stepMat.forEach((m, i) => { m.opacity = 0.18 + 0.8 * Math.max(0, 1 - Math.abs(k - i)); });
        },
        colliders: [[0, 0, 0.55]]
      };
    },

    // Sunflowers turning toward a warm light, and a letter signed "Truly yours" floating above
    'truly-yours-life'() {
      const g = new THREE.Group();
      g.add(plinth(0.5));
      const stemMat = new THREE.MeshStandardMaterial({ color: 0x3f7d3a, roughness: 0.8 });
      const headMat = new THREE.MeshStandardMaterial({ map: sunflowerTexture(), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.7 });
      headMat.emissiveMap = headMat.map;
      const heads = [];
      [[-0.2, 0.95, 0.05], [0.05, 1.15, -0.08], [0.25, 0.85, 0.08]].forEach(([x, h, z], i) => {
        const stem = cyl(0.012, 0.016, h, stemMat, 8);
        stem.position.set(x, 0.08 + h / 2, z);
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 6), stemMat);
        leaf.scale.set(1.6, 0.25, 0.7);
        leaf.position.set(x + 0.05, 0.08 + h * 0.45, z);
        leaf.rotation.z = -0.4;
        const head = new THREE.Mesh(new THREE.CircleGeometry(0.16 - i * 0.01, 32), headMat);
        head.position.set(x, 0.08 + h, z + 0.01);
        head.rotation.x = -0.25;
        g.add(stem, leaf, head);
        heads.push(head);
      });
      const light = sprite(0xffd98a, 1.4, 0.6);
      light.position.set(0, 1.75, 0.2);
      const letter = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.4), new THREE.MeshStandardMaterial({ map: paperTexture(['Truly yours,', 'Life'], false), side: THREE.DoubleSide, roughness: 0.8, emissive: 0xffffff, emissiveIntensity: 0.25 }));
      letter.material.emissiveMap = letter.material.map;
      letter.position.set(0.02, 1.6, 0.1);
      g.add(light, letter, sparks({ n: 36, w: 0.8, d: 0.6, y: 0.6, h: 1.4, color: 0xffd166, k: 2.2, size: 0.028, rise: 0.7 }));
      return {
        group: g,
        update(t) {
          letter.position.y = 1.6 + Math.sin(t * 0.9) * 0.05;
          letter.rotation.y = Math.sin(t * 0.4) * 0.35;
          heads.forEach((h, i) => { h.rotation.y = Math.sin(t * 0.3 + i) * 0.15; });
        },
        colliders: [[0, 0, 0.5]]
      };
    },

    // A little cafe table with two steaming cups, set for a friendly conversation
    'curiously-certain'() {
      const g = new THREE.Group();
      g.add(plinth(0.55));
      const top = cyl(0.34, 0.34, 0.03, mat.marble, 40);
      top.position.y = 0.78;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.01, 8, 48), gold);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.795;
      const leg = cyl(0.025, 0.03, 0.68, gold, 12);
      leg.position.y = 0.44;
      const foot = cyl(0.16, 0.18, 0.025, gold, 24);
      foot.position.y = 0.1;
      g.add(top, rim, leg, foot);
      const china = new THREE.MeshStandardMaterial({ color: 0xfffaf2, roughness: 0.3 });
      const coffee = new THREE.MeshStandardMaterial({ color: 0x4a2c1c, roughness: 0.2 });
      [[-0.14, 0x5a3a28], [0.15, 0xb8603a]].forEach(([x, col], i) => {
        const cupMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.4 });
        const saucer = cyl(0.085, 0.07, 0.012, china, 24);
        saucer.position.set(x, 0.802, i ? -0.05 : 0.06);
        const cup = cyl(0.05, 0.038, 0.07, cupMat, 24);
        cup.position.set(x, 0.845, i ? -0.05 : 0.06);
        const surf = new THREE.Mesh(new THREE.CircleGeometry(0.046, 20), coffee);
        surf.rotation.x = -Math.PI / 2;
        surf.position.set(x, 0.878, i ? -0.05 : 0.06);
        const handle = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 6, 16, Math.PI * 1.3), cupMat);
        handle.position.set(x + 0.055, 0.848, i ? -0.05 : 0.06);
        handle.rotation.z = -Math.PI * 0.65;
        g.add(saucer, cup, surf, handle);
        const steam = sparks({ n: 18, w: 0.05, d: 0.05, y: 0.9, h: 0.45, color: 0xfff4e0, k: 1.4, size: 0.03, rise: 0.6, alpha: 0.5 });
        steam.position.set(x, 0.9, i ? -0.05 : 0.06);
        g.add(steam);
      });
      // two bistro chairs, angled toward each other
      [-1, 1].forEach((sd) => {
        const ch = new THREE.Group();
        const seat = cyl(0.15, 0.15, 0.025, mat.velvetRed, 24);
        seat.position.y = 0.46;
        const back = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.012, 8, 24, Math.PI), gold);
        back.position.set(0, 0.66, -0.13);
        const legC = cyl(0.012, 0.012, 0.44, gold, 8);
        legC.position.y = 0.23;
        ch.add(seat, back, legC);
        ch.position.set(sd * 0.48, 0, 0.05);
        ch.rotation.y = sd * -1.2;
        g.add(ch);
      });
      const glow = sprite(0xffcf8a, 1.3, 0.45);
      glow.position.y = 1.0;
      g.add(glow);
      return { group: g, update() {}, colliders: [[0, 0, 0.62]] };
    },

    // Pain turned into a staircase: the stones of a broken wall climb into steps of light,
    // rising towards a wing of colourful feathers, as on the cover
    'how-to-build-yourself-up'() {
      const g = new THREE.Group();
      g.add(plinth(0.55));
      const stone = new THREE.MeshStandardMaterial({ color: 0x8a7f74, roughness: 0.95 });
      // the wall, broken on the side where the steps begin
      [[0, 4], [1, 3], [2, 2]].forEach(([row, n]) => {
        for (let c = 0; c < n; c++) {
          const b = box(0.15, 0.085, 0.12, stone);
          b.position.set(-0.46 + c * 0.155 + (row % 2) * 0.075, 0.125 + row * 0.09, -0.12);
          b.rotation.y = (c % 2 ? 1 : -1) * 0.04;
          g.add(b);
        }
      });
      // the staircase: each step glows warmer as it climbs
      const warm = [0x6f6a66, 0x8a6a4a, 0xa8743c, 0xc98a3a, 0xe0a24a, 0xf0b860];
      const steps = warm.map((col, i) => {
        const m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.6, emissive: new THREE.Color(0xffa040), emissiveIntensity: 0.05 + i * 0.09 });
        const s = box(0.2, 0.05, 0.16, m);
        s.position.set(-0.08 + i * 0.085, 0.2 + i * 0.16, 0.02 - i * 0.03);
        s.rotation.y = -0.25;
        g.add(s);
        return m;
      });
      // the wing of feathers waiting at the top
      const wingTex = wingTexture();
      const wing = new THREE.Group();
      wing.position.set(0.42, 1.38, -0.1);
      const feathers = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), additive(wingTex, 0xffffff, 0.8));
      feathers.position.set(0.28, 0.12, 0);
      feathers.scale.x = -1;
      wing.add(feathers);
      const light = sprite(0xffb060, 1.5, 0.55);
      light.position.set(0.42, 1.3, -0.05);
      g.add(wing, light, sparks({ n: 40, w: 0.7, d: 0.5, y: 0.3, h: 1.6, color: 0xffc070, k: 2.2, size: 0.028, rise: 0.8 }));
      return {
        group: g,
        update(t) {
          wing.rotation.z = Math.sin(t * 0.8) * 0.08;
          wing.position.y = 1.38 + Math.sin(t * 0.6) * 0.04;
          const k = (t * 1.1) % 8;
          steps.forEach((m, i) => { m.emissiveIntensity = 0.05 + i * 0.09 + 0.5 * Math.max(0, 1 - Math.abs(k - i)); });
        },
        colliders: [[0, 0, 0.58]]
      };
    }
  });

  // Fallback for books added later: a cluster of floating lanterns
  function fallback(book) {
    const g = new THREE.Group();
    g.add(plinth(0.4));
    const lamps = [0, 1, 2].map((i) => {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), glowMat(book.colors.glow, 2.6));
      l.position.set(Math.cos(i * 2.1) * 0.2, 1.1 + i * 0.25, Math.sin(i * 2.1) * 0.2);
      g.add(l);
      return l;
    });
    g.add(sparks({ n: 30, w: 0.8, d: 0.8, y: 0.2, h: 1.8, color: book.colors.glow, k: 2, size: 0.03, rise: 1 }));
    return { group: g, update(t) { lamps.forEach((l, i) => { l.position.y = 1.1 + i * 0.25 + Math.sin(t + i) * 0.05; }); }, colliders: [[0, 0, 0.45]] };
  }

  function ribbon(curve, width, map) {
    const N = 60;
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const p = curve.getPoint(t);
      const tan = curve.getTangent(t);
      const side = new THREE.Vector3(-tan.z, 0, tan.x).normalize().multiplyScalar(width / 2);
      pos.push(p.x - side.x, p.y, p.z - side.z, p.x + side.x, p.y, p.z + side.z);
      uv.push(0, t, 1, t);
      if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map, roughness: 0.7, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.35, side: THREE.DoubleSide }));
  }

  return {
    build(book) {
      const b = builders[book.slug];
      try { return b ? b() : fallback(book); } catch (e) { console.warn('Prop failed for', book.slug, e); return fallback(book); }
    }
  };
}
