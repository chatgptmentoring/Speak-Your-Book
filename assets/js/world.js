/*
 * The 3D fair: a candlelit hall with a booth for every book, the Speak Your Book stage,
 * the four pillars of Life Coach Code and an empty pedestal waiting for the next author.
 * The camera follows a tour (driven by page scroll) and can fly into any booth.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as T from './textures.js';
import { createProps } from './props.js';
import { createSky } from './sky.js';

const V3 = THREE.Vector3;
const BOOK_W = 0.5;
const BOOK_D = 0.07;
const BOOTH_X = 4.3;
const BOOTH_Z0 = -9;
const BOOTH_STRIDE = 5;
const ORACLE_POS = new V3(4.5, 0, -3.2);

const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const PILLARS = [
  { label: 'Spirit', img: 'assets/img/brand/pillar-spirit.svg' },
  { label: 'Mind', img: 'assets/img/brand/pillar-mind.svg' },
  { label: 'Body', img: 'assets/img/brand/pillar-body.svg' },
  { label: 'Heart', img: 'assets/img/brand/pillar-heart.svg' }
];

/* ---------- shaders ---------- */
const coneMaterial = (color, opacity) => new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity } },
  vertexShader: 'varying vec2 vUv;varying vec3 vN;varying vec3 vV;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.0);vV=-mv.xyz;vN=normalMatrix*normal;gl_Position=projectionMatrix*mv;}',
  fragmentShader: 'uniform vec3 uColor;uniform float uOpacity;varying vec2 vUv;varying vec3 vN;varying vec3 vV;void main(){float f=abs(dot(normalize(vN),normalize(vV)));float a=pow(vUv.y,1.6)*pow(f,2.0)*uOpacity;gl_FragColor=vec4(uColor,a);}',
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
});

const POINT_VS = `
attribute float aSeed;
uniform float uTime; uniform float uScale; uniform float uSize; uniform float uRise; uniform float uHeight;
varying float vA;
void main(){
  vec3 p = position;
  p.y = uRise > 0.0 ? mod(p.y + uTime * (0.04 + aSeed * 0.08) * uRise, uHeight) : p.y;
  p.x += sin(uTime * 0.25 + aSeed * 40.0) * 0.25 * uRise;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = min(uSize * (0.6 + aSeed * 0.8) * uScale / max(-mv.z, 0.05), 96.0);
  vA = 0.35 + 0.65 * abs(sin(uTime * (0.6 + aSeed) + aSeed * 50.0));
  gl_Position = projectionMatrix * mv;
}`;
const POINT_FS = `
uniform vec3 uColor; uniform float uAlpha;
varying float vA;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  a = a * a * vA * uAlpha;
  gl_FragColor = vec4(uColor, a);
}`;

function pointsMaterial(color, { size = 0.05, alpha = 1, rise = 0, height = 9 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uScale: { value: 600 }, uSize: { value: size }, uColor: { value: new THREE.Color(color) },
      uAlpha: { value: alpha }, uRise: { value: rise }, uHeight: { value: height }
    },
    vertexShader: POINT_VS, fragmentShader: POINT_FS,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
}

/* Holograms: the authors at their booths, and everyone else walking the fair live. */
function holoMaterial(color, opacity = 1) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity }, uHeight: { value: 0.74 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY; varying vec3 vC;
      void main(){
        vec4 lp = vec4(position, 1.0);
        vec3 n = normal;
        #ifdef USE_INSTANCING
          lp = instanceMatrix * lp;
          n = mat3(instanceMatrix) * n;
        #endif
        vC = vec3(1.0);
        #ifdef USE_INSTANCING_COLOR
          vC = instanceColor;
        #endif
        vY = position.y;
        vec4 mv = modelViewMatrix * lp;
        vN = normalMatrix * n;
        vV = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float uOpacity; uniform float uHeight;
      varying vec3 vN; varying vec3 vV; varying float vY; varying vec3 vC;
      void main(){
        float nl = length(vN);
        vec3 n = nl > 1e-4 ? vN / nl : vec3(0.0, 1.0, 0.0);
        float f = clamp(1.0 - abs(dot(n, normalize(vV))), 0.0, 1.0);
        float scan = 0.55 + 0.45 * smoothstep(-0.2, 0.6, sin(vY * 180.0 - uTime * 6.0));
        float band = 0.7 + 0.3 * smoothstep(0.0, 0.05, fract(vY * 1.3 - uTime * 0.28));
        float fade = smoothstep(0.0, 0.5, vY / uHeight);
        float flick = 0.94 + 0.06 * sin(uTime * 23.0 + vY * 4.0);
        float a = (0.07 + 0.75 * pow(f, 1.7)) * scan * band * fade * flick * uOpacity;
        gl_FragColor = vec4(uColor * vC * (0.45 + 0.9 * pow(f, 2.0)), a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
}

// head and shoulders, flattened front to back below the neck
function bustGeometry() {
  const prof = [[0, 0], [0.26, 0], [0.285, 0.08], [0.3, 0.18], [0.29, 0.25], [0.24, 0.3], [0.16, 0.335], [0.075, 0.36], [0.062, 0.41],
    [0.07, 0.44], [0.098, 0.47], [0.117, 0.52], [0.123, 0.58], [0.118, 0.64], [0.1, 0.69], [0.07, 0.725], [0, 0.74]];
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 32);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getZ(i) * THREE.MathUtils.lerp(0.56, 0.92, smooth(0.3, 0.42, pos.getY(i))));
  g.computeVertexNormals();
  // the poles have no area, so no normal: point them straight up or down (a zero normal would
  // become NaN in the shader, and bloom would smear it across the whole screen)
  const nrm = g.attributes.normal;
  for (let i = 0; i < nrm.count; i++) {
    if (Math.hypot(nrm.getX(i), nrm.getY(i), nrm.getZ(i)) < 1e-4) nrm.setXYZ(i, 0, pos.getY(i) > 0.37 ? 1 : -1, 0);
  }
  return g;
}

export async function createWorld(opts) {
  const noop = () => {};
  const { canvas, books, authors = [], leftInset = () => 0.3, onProgress = noop, onHover = noop, onSelect = noop, onZone = noop, onNear = noop, onMoved = noop, onPage = noop } = opts;
  const SIGNS = {
    crestRing: '\u2726 LIFE COACH CODE \u2726 YOUR HOSTS \u2726 THE VIRTUAL BOOK FAIR \u2726 SPEAK YOUR BOOK ',
    floorRing: '\u2726 THE VIRTUAL BOOK FAIR \u2726 HOSTED BY LIFE COACH CODE ',
    flag: ['SPEAK', 'YOUR', 'BOOK', '-', 'VIRTUAL BOOK FAIR'],
    plaque: '',
    poster: { pill: 'LIVE ON ZOOM \u00b7 FREE', eyebrow: 'LIFE COACH CODE PRESENTS', title1: 'Speak', title2: 'Your Book', date: '', body: '', cta: 'REGISTER FREE', foot: '' },
    screens: null,
    authors: [],
    ...(opts.signs || {})
  };
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 640;
  const lowEnd = coarse || small || (navigator.hardwareConcurrency || 8) <= 4;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const Q = {
    dpr: Math.min(window.devicePixelRatio || 1, lowEnd ? 1.5 : (navigator.hardwareConcurrency || 8) >= 8 ? 2 : 1.75),
    reflector: !lowEnd,
    shadows: !lowEnd,
    msaa: lowEnd ? 0 : 4,
    lights: lowEnd ? 3 : 6,
    cover: lowEnd ? 480 : 800,
    poster: lowEnd ? 448 : 768,
    dust: lowEnd ? 700 : 1600
  };
  // the hall grows with the number of books: the stage and the temple always sit past the last booth
  const LAST_BOOTH_Z = BOOTH_Z0 - (books.length - 1) * BOOTH_STRIDE;
  const STAGE_Z = Math.min(-76, LAST_BOOTH_Z - 12);
  const TEMPLE_Z = STAGE_Z - 15;

  /* ---------- renderer, scene, camera ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false });
  renderer.setPixelRatio(Q.dpr);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = Q.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.info.autoReset = false;
  T.setAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));

  const scene = new THREE.Scene();
  const FOG = new THREE.Color(0x0c0818);
  scene.background = new THREE.Color(0x05030a);
  scene.fog = new THREE.FogExp2(FOG, 0.0135);
  const sky = createSky({ lowEnd });
  scene.add(sky.group);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.32;

  const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.05, 140);
  camera.position.set(0, 7, 34);

  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: Q.msaa });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(Q.dpr);
  composer.setSize(window.innerWidth, window.innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.75, 0.6, 1.0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `uniform sampler2D tDiffuse;uniform float uTime;uniform vec2 uRes;varying vec2 vUv;
      void main(){vec2 p=vUv-0.5;
        float ca=dot(p,p)*0.0035;
        vec4 c=vec4(texture2D(tDiffuse,vUv+p*ca).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-p*ca).b,1.0);
        float v=smoothstep(0.95,0.25,length(p*vec2(1.0,1.15)));
        c.rgb*=mix(0.68,1.0,v);
        float l=dot(c.rgb,vec3(0.299,0.587,0.114));
        c.rgb=mix(c.rgb,c.rgb*vec3(1.04,1.0,0.95),smoothstep(0.35,1.0,l)*0.6);
        c.rgb+=vec3(0.006,0.003,0.014)*(1.0-l);
        float g=fract(sin(dot(vUv*uRes+fract(uTime)*91.7,vec2(12.9898,78.233)))*43758.5453);
        c.rgb+=(g-0.5)*0.022;
        gl_FragColor=c;}`
  });
  composer.addPass(grade);

  /* ---------- loading ---------- */
  let loaded = 0;
  const totalToLoad = books.length + 1;
  const tick = () => { loaded++; onProgress(loaded / totalToLoad); };
  const loadImage = (url) => new Promise((res) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => { tick(); res(im); };
    im.onerror = () => { tick(); res(null); };
    im.src = url;
  });
  const imagesP = Promise.all(books.map((b) => loadImage(`assets/img/covers/${b.slug}-${Q.cover}.webp`)));
  const brandP = Promise.all(['assets/img/brand/logo.svg', ...PILLARS.map((p) => p.img)].map((u) => new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = u;
  })));
  await T.loadFonts();
  tick();
  const images = await imagesP;
  const [logoImg, ...pillarImgs] = await brandP;
  const logoTex = T.logoMedallionTexture(logoImg);

  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const imageTexture = (img) => {
    const t = new THREE.Texture(img);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    t.needsUpdate = true;
    return t;
  };

  /* ---------- shared materials ---------- */
  const tex = {
    marble: T.toTexture(T.marbleTexture({ size: 512, seed: 7 }), { repeat: [1, 1] }),
    floor: T.toTexture(T.marbleTexture({ size: 512, base: [24, 17, 30], vein: [58, 44, 46], veinGold: [96, 72, 46], seed: 11, contrast: 0.55 }), { repeat: [7, 22] }),
    carpet: T.toTexture(T.carpetTexture(), { repeat: [1, 34] }),
    radial: T.radialTexture(),
    pagesV: T.pagesTexture(true),
    pagesH: T.pagesTexture(false)
  };
  const mat = {
    gold: new THREE.MeshStandardMaterial({ color: 0xd2a75a, metalness: 1, roughness: 0.3 }),
    goldSoft: new THREE.MeshStandardMaterial({ color: 0xc89b52, metalness: 0.85, roughness: 0.45 }),
    marble: new THREE.MeshStandardMaterial({ map: tex.marble, roughness: 0.28, metalness: 0 }),
    velvet: new THREE.MeshStandardMaterial({ color: 0x2c0d26, roughness: 0.95 }),
    velvetRed: new THREE.MeshStandardMaterial({ color: 0x7a1424, roughness: 0.8 }),
    pagesSide: new THREE.MeshStandardMaterial({ map: tex.pagesV, roughness: 0.9 }),
    pagesTop: new THREE.MeshStandardMaterial({ map: tex.pagesH, roughness: 0.9 }),
    paper: new THREE.MeshStandardMaterial({ color: 0xf1e7d4, roughness: 0.85 })
  };

  const poolMat = (color, opacity = 0.5) => new THREE.MeshBasicMaterial({ map: tex.radial, color: new THREE.Color(color), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });

  const clickables = [];
  const colliders = [];
  const interactables = [];
  let stageBoost = 0;
  const animated = [];
  const pointMats = [];
  const IDENTITY = new THREE.Quaternion();

  /* ---------- floor ---------- */
  const FLOOR_FRONT = 24, FLOOR_BACK = TEMPLE_Z - 13;
  const FLOOR_LEN = FLOOR_FRONT - FLOOR_BACK, FLOOR_Z = (FLOOR_FRONT + FLOOR_BACK) / 2, FLOOR_W = 28;
  if (Q.reflector) {
    const mirror = new Reflector(new THREE.PlaneGeometry(FLOOR_W, FLOOR_LEN), {
      clipBias: 0.003,
      textureWidth: Math.round(window.innerWidth * Q.dpr * 0.5),
      textureHeight: Math.round(window.innerHeight * Q.dpr * 0.5),
      color: 0x8a8090
    });
    mirror.rotation.x = -Math.PI / 2;
    mirror.position.set(0, -0.002, FLOOR_Z);
    scene.add(mirror);
  }
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(FLOOR_W, FLOOR_LEN),
    new THREE.MeshStandardMaterial({
      map: tex.floor, roughness: 0.22, metalness: 0.1,
      transparent: Q.reflector, opacity: Q.reflector ? 0.74 : 1
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, FLOOR_Z);
  floor.receiveShadow = true;
  scene.add(floor);
  {
    // the fair floats in space: a marble slab with a glowing golden rim
    const slab = new THREE.Mesh(new THREE.BoxGeometry(FLOOR_W, 2.2, FLOOR_LEN), new THREE.MeshStandardMaterial({ map: tex.floor, color: 0x6a5a70, roughness: 0.5 }));
    slab.position.set(0, -1.11, FLOOR_Z);
    scene.add(slab);
    const rimMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.72, 0.38).multiplyScalar(2.4) });
    const hw = FLOOR_W / 2, hl = FLOOR_LEN / 2;
    [[FLOOR_W + 0.1, hl, 0], [FLOOR_W + 0.1, -hl, 0], [FLOOR_LEN, 0, hw], [FLOOR_LEN, 0, -hw]].forEach(([len, dz, dx], i) => {
      const r = new THREE.Mesh(new THREE.BoxGeometry(i < 2 ? len : 0.06, 0.06, i < 2 ? 0.06 : len), rimMat);
      r.position.set(dx, 0.01, FLOOR_Z + dz);
      scene.add(r);
      const r2 = r.clone();
      r2.position.y = -2.2;
      r2.material = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 0.4, 1.0).multiplyScalar(1.6) });
      scene.add(r2);
    });
    const under = new THREE.Mesh(new THREE.PlaneGeometry(FLOOR_W * 2.4, FLOOR_LEN * 1.3), new THREE.MeshBasicMaterial({ map: tex.radial, color: new THREE.Color(0.45, 0.25, 0.8), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    under.rotation.x = Math.PI / 2;
    under.position.set(0, -4, FLOOR_Z);
    scene.add(under);
  }

  const CARPET_LEN = 8 - (STAGE_Z + 2);
  tex.carpet.repeat.set(1, Math.round(CARPET_LEN / 2.4));
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(2.5, CARPET_LEN), new THREE.MeshStandardMaterial({ map: tex.carpet, roughness: 0.96 }));
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.set(0, 0.006, 8 - CARPET_LEN / 2);
  carpet.receiveShadow = true;
  scene.add(carpet);

  /* ---------- lights ---------- */
  scene.add(new THREE.HemisphereLight(0xffe3c4, 0x1a0f22, 0.55));
  const lampZs = [5];
  for (let z = -12; z > STAGE_Z - 4; z -= 16) lampZs.push(z);
  lampZs.forEach((z, i) => {
    if (Q.lights < 6 && i % 2) return;
    const l = new THREE.PointLight(0xffb070, Q.lights < 6 ? 60 : 40, 22, 1.6);
    l.position.set(0, 5.4, z);
    scene.add(l);
  });
  const spot = new THREE.SpotLight(0xfff0d8, 26, 14, 0.46, 0.7, 2);
  spot.position.set(0, 5, -8);
  spot.castShadow = Q.shadows;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0004;
  spot.shadow.camera.near = 0.5;
  spot.shadow.camera.far = 14;
  scene.add(spot, spot.target);

  /* ---------- architecture helpers ---------- */
  function columnGeometry(height, r) {
    const p = [];
    const add = (x, y) => p.push(new THREE.Vector2(x, y));
    add(0.001, 0); add(r * 1.6, 0); add(r * 1.6, r * 0.4); add(r * 1.4, r * 0.5); add(r * 1.35, r * 0.8);
    add(r * 1.12, r * 0.95); add(r, r * 1.2); add(r * 0.9, height - r * 1.3); add(r * 1.08, height - r * 1.05);
    add(r * 1.3, height - r * 0.8); add(r * 1.65, height - r * 0.5); add(r * 1.65, height); add(0.001, height);
    return new THREE.LatheGeometry(p, 40);
  }
  const colGeo = columnGeometry(6.5, 0.32);
  const colGeoShort = columnGeometry(4.3, 0.3);

  function catenary(a, b, sag, n) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = a.clone().lerp(b, t);
      p.y -= Math.sin(t * Math.PI) * sag;
      pts.push(p);
    }
    return pts;
  }

  const fairyPos = [];
  const fairySeed = [];
  const addFairy = (pts) => pts.forEach((p) => { fairyPos.push(p.x, p.y, p.z); fairySeed.push(Math.random()); });

  /* ---------- entrance arch ---------- */
  {
    const g = new THREE.Group();
    [-3.4, 3.4].forEach((x) => {
      const c = new THREE.Mesh(colGeo, mat.marble);
      c.position.set(x, 0, 0);
      g.add(c);
      colliders.push({ x, z: 0, r: 0.6 });
    });
    const arch = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.34, 20, 80, Math.PI), mat.marble);
    arch.position.set(0, 6.5, 0);
    g.add(arch);
    const archTrim = new THREE.Mesh(new THREE.TorusGeometry(3.06, 0.05, 10, 80, Math.PI), mat.gold);
    archTrim.position.set(0, 6.5, 0.12);
    g.add(archTrim);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(4.6, 1.15),
      new THREE.MeshStandardMaterial({
        map: T.signTexture({ eyebrow: 'LIFE COACH CODE PRESENTS', title: 'THE VIRTUAL BOOK FAIR', w: 2048, h: 512 }),
        emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.6
      })
    );
    sign.material.emissiveMap = sign.material.map;
    sign.position.set(0, 7.35, 0.18);
    g.add(sign);
    [-1.6, 1.6].forEach((x) => {
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.6), mat.gold);
      chain.position.set(x, 8.7, 0.18);
      g.add(chain);
    });
    // the live event, hanging under the sign
    if (SIGNS.plaque) {
      const plaque = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 0.44), new THREE.MeshStandardMaterial({
        map: T.signTexture({ title: SIGNS.plaque, w: 2048, h: 256 }), emissive: 0xffffff, emissiveIntensity: 0.7, roughness: 0.55
      }));
      plaque.material.emissiveMap = plaque.material.map;
      plaque.position.set(0, 6.42, 0.18);
      g.add(plaque);
      [-1.2, 1.2].forEach((x) => {
        const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16), mat.gold);
        chain.position.set(x, 6.7, 0.18);
        g.add(chain);
      });
    }
    scene.add(g);
    const archPts = [];
    for (let i = 0; i <= 60; i++) {
      const a = (i / 60) * Math.PI;
      archPts.push(new V3(Math.cos(a) * 3.85, 6.5 + Math.sin(a) * 3.85, 0.25));
    }
    addFairy(archPts);
    [-3.4, 3.4].forEach((x) => {
      const pts = [];
      for (let i = 0; i <= 18; i++) pts.push(new V3(x + Math.sin(i * 1.3) * 0.36, i * 0.36, 0.4 + Math.cos(i * 1.3) * 0.2));
      addFairy(pts);
    });
    // lamp posts outside, each flying a Life Coach Code flag
    const flagTex = T.flagTexture(logoImg, SIGNS.flag);
    [-5.6, 5.6].forEach((x) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 3.2, 16), mat.gold);
      post.position.set(x, 1.6, 5);
      const globe = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.7, 0.4).multiplyScalar(3.2) }));
      globe.position.set(x, 3.4, 5);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.16, 24), mat.gold);
      cap.position.set(x, 3.66, 5);
      const inward = -Math.sign(x);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.78, 8), mat.gold);
      arm.rotation.z = Math.PI / 2;
      arm.position.set(x + inward * 0.39, 3.02, 5);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.86), new THREE.MeshStandardMaterial({
        map: flagTex, emissive: 0xffffff, emissiveMap: flagTex, emissiveIntensity: 0.35, roughness: 0.85, side: THREE.DoubleSide, alphaTest: 0.5, transparent: true
      }));
      flag.position.set(x + inward * 0.42, 2.06, 5);
      scene.add(post, globe, cap, arm, flag);
      animated.push((t) => { flag.rotation.y = Math.sin(t * 0.8 + x) * 0.06; });
      colliders.push({ x, z: 5, r: 0.18 });
    });
  }

  /* ---------- the Life Coach Code crest: the hosts of the fair, crowning the entrance ---------- */
  {
    const C = new V3(0, 12.6, 0.1);
    const crest = new THREE.Group();
    crest.position.copy(C);
    crest.scale.setScalar(1.2);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.radial, color: new THREE.Color(1.0, 0.72, 0.42), transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.set(8, 8, 1);
    glow.position.z = -0.7;
    const rays = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 8.6), new THREE.MeshBasicMaterial({
      map: T.sunburstTexture(), color: new THREE.Color(1.0, 0.82, 0.55).multiplyScalar(0.85), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    rays.position.z = -0.55;
    const laurel = new THREE.Mesh(new THREE.PlaneGeometry(5.7, 3.9), new THREE.MeshStandardMaterial({
      map: T.laurelTexture(), transparent: true, alphaTest: 0.3, metalness: 0.35, roughness: 0.4, emissive: 0xffffff, emissiveIntensity: 0.38
    }));
    laurel.material.emissiveMap = laurel.material.map;
    laurel.position.set(0, -0.08 * 3.9, -0.3);
    const ringTex = T.textRingTexture(SIGNS.crestRing);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.376, 1.72, 160, 1), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, color: new THREE.Color(1.15, 1.08, 1.0) }));
    ring.position.z = -0.02;
    const rimOuter = new THREE.Mesh(new THREE.TorusGeometry(1.74, 0.045, 12, 160), mat.gold);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.36, 1.36, 0.22, 96), mat.gold);
    body.rotation.x = Math.PI / 2;
    const face = new THREE.Mesh(new THREE.CircleGeometry(1.35, 96), new THREE.MeshStandardMaterial({
      map: T.crestTexture(logoImg), emissive: 0xffffff, roughness: 0.38, metalness: 0.1, emissiveIntensity: 0.3
    }));
    face.material.emissiveMap = face.material.map;
    face.position.z = 0.112;
    const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 5.2 * 440 / 2048), new THREE.MeshStandardMaterial({
      map: T.ribbonTexture('LIFE COACH CODE'), transparent: true, alphaTest: 0.4, roughness: 0.6, emissive: 0xffffff, emissiveIntensity: 0.55
    }));
    ribbon.material.emissiveMap = ribbon.material.map;
    ribbon.position.set(0, -1.62, 0.32);
    crest.add(glow, rays, laurel, ring, rimOuter, body, face, ribbon);
    // searchlights sweeping the sky behind the crest: the opening night of the fair
    const beams = [];
    if (!lowEnd) {
      const beamGeo = new THREE.CylinderGeometry(0.06, 1.5, 18, 32, 1, true);
      beamGeo.translate(0, -9, 0);
      [-0.55, -0.2, 0.2, 0.55].forEach((tilt, i) => {
        const beam = new THREE.Mesh(beamGeo, coneMaterial(0xffd9a0, 0.14));
        beam.rotation.set(-0.18, 0, Math.PI + tilt);
        beam.position.set(tilt * 1.6, -1.2, -1.1);
        beam.userData.tilt = tilt;
        beam.userData.ph = i * 1.7;
        crest.add(beam);
        beams.push(beam);
      });
      const crestLight = new THREE.PointLight(0xffd9a0, 5, 10, 1.6);
      crestLight.position.set(0, 11.4, 4.2);
      scene.add(crestLight);
    }
    const cInfo = { kind: 'crest' };
    [face, body, ribbon, laurel].forEach((m) => { m.userData.info = cInfo; clickables.push(m); });
    scene.add(crest);
    animated.push((t) => {
      rays.rotation.z = t * 0.035;
      ring.rotation.z = -t * 0.05;
      rays.material.opacity = 0.5 + Math.sin(t * 0.9) * 0.08;
      glow.material.opacity = 0.28 + Math.sin(t * 0.7) * 0.04;
      beams.forEach((b) => { b.rotation.z = Math.PI + b.userData.tilt + Math.sin(t * 0.22 + b.userData.ph) * 0.18; });
    });
    // fairy lights tracing the laurel
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const a = Math.PI * (1.08 + (i / 40) * 0.84);
      pts.push(new V3(C.x + Math.cos(a + Math.PI) * 2.5, C.y + Math.sin(a + Math.PI) * 2.5 - 0.12, C.z + 0.12));
    }
    addFairy(pts);
  }

  /* ---------- the plaza: a compass rose inlaid with the logo, and posters for the live event ---------- */
  {
    const inlayTex = T.floorInlayTexture(logoImg, SIGNS.floorRing);
    const inlay = new THREE.Mesh(new THREE.CircleGeometry(2.6, 96), new THREE.MeshStandardMaterial({
      map: inlayTex, emissive: 0xffffff, emissiveMap: inlayTex, emissiveIntensity: 0.16, roughness: 0.32, metalness: 0.2
    }));
    inlay.rotation.x = -Math.PI / 2;
    inlay.position.set(0, 0.012, 11);
    inlay.receiveShadow = Q.shadows;
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), poolMat(0xffb36b, 0.45));
    halo.rotation.x = -Math.PI / 2;
    halo.position.set(0, 0.008, 11);
    scene.add(halo, inlay);

    const posterTex = T.eventPosterTexture(logoImg, SIGNS.poster);
    const eInfo = { kind: 'event' };
    [-1, 1].forEach((side) => {
      const easel = buildEasel(posterTex);
      easel.position.set(side * 2.3, 0, 1.7);
      easel.rotation.y = -side * 0.32;
      scene.add(easel);
      easel.traverse((o) => { if (o.isMesh) { o.userData.info = eInfo; clickables.push(o); } });
      colliders.push({ x: side * 2.3, z: 1.7, r: 0.45 });
      interactables.push({ pos: new V3(side * 2.3, 0, 2.2), range: 3.0, info: eInfo });
    });
  }

  function buildEasel(posterTex) {
    const g = new THREE.Group();
    const wood = mat.goldSoft;
    [-0.42, 0.42].forEach((x) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 2.2, 8), wood);
      leg.position.set(x, 1.05, 0.06);
      leg.rotation.z = -x * 0.12;
      leg.rotation.x = -0.1;
      g.add(leg);
    });
    const back = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 2.1, 8), wood);
    back.position.set(0, 1.0, -0.28);
    back.rotation.x = 0.28;
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.04, 0.12), wood);
    ledge.position.set(0, 0.58, 0.12);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.18, 1.6, 0.04), mat.gold);
    frame.position.set(0, 1.4, 0.09);
    frame.rotation.x = -0.1;
    const poster = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.5), new THREE.MeshStandardMaterial({
      map: posterTex, emissive: 0xffffff, emissiveMap: posterTex, emissiveIntensity: 0.55, roughness: 0.7
    }));
    poster.position.set(0, 1.4, 0.115);
    poster.rotation.x = -0.1;
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), poolMat(0xffb36b, 0.4));
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(0, 0.01, 0.4);
    g.add(back, ledge, frame, poster, pool);
    return g;
  }

  /* ---------- colonnade along the hall ---------- */
  const bannerSets = [['Virtual', 'Book', 'Fair'], ['Speak', 'Your', 'Book'], ['Life', 'Coach', 'Code']];
  const bannerTex = bannerSets.map((w) => T.bannerTexture(w));
  const COLS = Math.ceil((-6 - STAGE_Z) / 10) + 1;
  for (let i = 0; i < COLS; i++) {
    const z = -6 - i * 10;
    [-1, 1].forEach((side) => {
      const x = side * 7.6;
      const c = new THREE.Mesh(colGeo, mat.marble);
      c.position.set(x, 0, z);
      scene.add(c);
      if (i < COLS - 1) {
        const arc = new THREE.Mesh(new THREE.TorusGeometry(5, 0.24, 12, 48, Math.PI), mat.marble);
        arc.rotation.y = Math.PI / 2;
        arc.position.set(x, 6.5, z - 5);
        scene.add(arc);
        const banner = new THREE.Mesh(
          new THREE.PlaneGeometry(1.25, 3.75),
          new THREE.MeshStandardMaterial({ map: bannerTex[(i + (side > 0 ? 1 : 0)) % 3], transparent: true, alphaTest: 0.5, roughness: 0.9, side: THREE.DoubleSide, emissive: 0xffffff, emissiveIntensity: 0.12 })
        );
        banner.material.emissiveMap = banner.material.map;
        banner.position.set(side * 7.45, 7.1, z - 5);
        banner.rotation.y = -side * Math.PI / 2;
        scene.add(banner);
        addFairy(catenary(new V3(x, 6.3, z), new V3(x, 6.3, z - 10), 1.1, 30));
      }
      if (i % 2 === 0 && i < COLS - 1) {
        addFairy(catenary(new V3(-7.6, 6.4, z), new V3(7.6, 6.4, z), 1.6, 46));
      }
    });
  }

  /* ---------- floating lanterns ---------- */
  const lanternCount = Math.max(12, Math.floor((-2 - STAGE_Z) / 2.5));
  const lanterns = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.12, 16, 12),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.6, 0.28).multiplyScalar(4.2) }),
    lanternCount
  );
  const lanternBase = [];
  const lanternHaloPos = [];
  for (let i = 0; i < lanternCount; i++) {
    const side = i % 2 ? 1 : -1;
    const p = new V3(side * (2.0 + Math.random() * 1.6), 4.3 + Math.random() * 1.8, -2 - i * 2.5 + Math.random());
    lanternBase.push({ p, ph: Math.random() * 6.28 });
    lanternHaloPos.push(p.x, p.y, p.z);
  }
  scene.add(lanterns);
  const haloGeo = new THREE.BufferGeometry();
  haloGeo.setAttribute('position', new THREE.Float32BufferAttribute(lanternHaloPos, 3));
  haloGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(lanternBase.map(() => 0.5), 1));
  const haloMat = pointsMaterial(0xffa860, { size: 1.1, alpha: 0.22 });
  const halos = new THREE.Points(haloGeo, haloMat);
  scene.add(halos);
  const dummy = new THREE.Object3D();

  /* ---------- booths ---------- */
  const props = createProps({ mat, pointsMaterial, pointMats, radial: tex.radial, camera, lowEnd });
  const PROP_AT = new V3(1.5, 0, 0.12);
  const pedGeo = new RoundedBoxGeometry(0.78, 1.05, 0.78, 4, 0.035);
  const trimGeo = new THREE.BoxGeometry(0.86, 0.05, 0.86);
  const backGeo = new RoundedBoxGeometry(1.95, 3.05, 0.08, 2, 0.02);
  const posterGeo = new THREE.PlaneGeometry(1.6, 2.16);
  const frameGeo = (() => {
    const s = new THREE.Shape();
    s.moveTo(-0.86, -1.14); s.lineTo(0.86, -1.14); s.lineTo(0.86, 1.14); s.lineTo(-0.86, 1.14); s.lineTo(-0.86, -1.14);
    const h = new THREE.Path();
    h.moveTo(-0.8, -1.08); h.lineTo(-0.8, 1.08); h.lineTo(0.8, 1.08); h.lineTo(0.8, -1.08); h.lineTo(-0.8, -1.08);
    s.holes.push(h);
    return new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 2 });
  })();
  const coneGeo = new THREE.CylinderGeometry(0.12, 1.3, 5.2, 40, 1, true);
  const plateGeo = new THREE.PlaneGeometry(0.62, 0.26);
  const poolGeo = new THREE.PlaneGeometry(3.4, 3.4);

  // A box whose faces share materials where they can: fewer draw calls per book.
  function box6(w, h, d, mats) {
    const g = new THREE.BoxGeometry(w, h, d);
    const uniq = [];
    const idx = mats.map((m) => { let i = uniq.indexOf(m); if (i < 0) { uniq.push(m); i = uniq.length - 1; } return i; });
    g.clearGroups();
    for (let f = 0; f < 6; f++) {
      if (f > 0 && idx[f] === idx[f - 1]) g.groups[g.groups.length - 1].count += 6;
      else g.addGroup(f * 6, 6, idx[f]);
    }
    return new THREE.Mesh(g, uniq);
  }

  function buildBook(book, coverTex) {
    const w = BOOK_W, h = w * book.cover.h / book.cover.w, d = BOOK_D;
    const g = new THREE.Group();
    const edge = new THREE.MeshStandardMaterial({ color: book.colors.spine, roughness: 0.55 });
    const front = new THREE.MeshStandardMaterial({ map: coverTex, emissive: 0xffffff, emissiveMap: coverTex, emissiveIntensity: 0.4, roughness: 0.4 });
    const spineMat = new THREE.MeshStandardMaterial({ map: T.spineTexture(book), roughness: 0.5 });
    const inside = mat.paper.clone();
    const endpaper = mat.paper.clone();
    const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.008), edge);
    back.position.set(0, 0, -d / 2 + 0.004);
    const pages = box6(w - 0.014, h - 0.016, d - 0.018, [mat.pagesSide, mat.pagesSide, mat.pagesTop, mat.pagesTop, inside, mat.paper]);
    pages.position.set(0.003, 0, 0);
    const spine = box6(0.01, h, d, [edge, spineMat, edge, edge, edge, edge]);
    spine.position.set(-w / 2, 0, 0);
    const hinge = new THREE.Group();
    hinge.position.set(-w / 2, 0, d / 2 - 0.004);
    const cover = box6(w, h, 0.008, [edge, edge, edge, edge, front, endpaper]);
    cover.position.set(w / 2, 0, 0);
    hinge.add(cover);
    g.add(back, pages, spine, hinge);
    [back, pages, spine, cover].forEach((m) => { m.castShadow = Q.shadows; });
    return { group: g, hinge, w, h, d, front, inside, endpaper, meshes: [back, pages, spine, cover] };
  }

  /* the author of every book, waiting beside the booth as a hologram */
  const holoGeo = bustGeometry();
  const holoParts = {
    pillar: new THREE.CylinderGeometry(0.08, 0.12, 0.92, 20),
    disc: new THREE.CylinderGeometry(0.15, 0.15, 0.03, 32),
    beam: new THREE.CylinderGeometry(0.11, 0.42, 0.62, 24, 1, true).rotateX(Math.PI)
  };
  const holoMats = [];
  const authorOf = {};
  authors.forEach((a) => a.books.forEach((slug) => { authorOf[slug] = a; }));
  const tagCache = new Map();
  const tagTexture = (name, sub, o) => {
    const key = `${name}|${sub}|${o && o.author ? 1 : 0}`;
    if (!tagCache.has(key)) tagCache.set(key, T.nameTagTexture(name, sub, o));
    return tagCache.get(key);
  };
  function buildHolo(author, book) {
    const g = new THREE.Group();
    const m = holoMaterial(new THREE.Color(1.0, 0.72, 0.38), 0.9);
    holoMats.push(m);
    const bust = new THREE.Mesh(holoGeo, m);
    bust.position.y = 1.15;
    const pillar = new THREE.Mesh(holoParts.pillar, mat.gold);
    pillar.position.y = 0.46;
    const discMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.8, 0.5).multiplyScalar(2.2) });
    const disc = new THREE.Mesh(holoParts.disc, discMat);
    disc.position.y = 0.935;
    const beamMat = coneMaterial(0xffe2b0, 0.2);
    const beam = new THREE.Mesh(holoParts.beam, beamMat);
    beam.position.y = 1.25;
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tagTexture(author.name, 'Meet the author'), transparent: true, depthWrite: false }));
    tag.scale.set(0.98, 0.98 * 168 / 640, 1);
    tag.position.y = 2.14;
    g.add(pillar, disc, beam, bust, tag);
    const info = { kind: 'author', id: author.id, slug: book.slug };
    [bust, pillar, tag].forEach((o) => { o.userData.info = info; clickables.push(o); });
    const phase = Math.random() * 6.28;
    const h = { group: g, info, online: 0, onlineT: 0, author };
    h.setOnline = (on) => {
      h.online = on ? 1 : 0;
      tag.material.map = tagTexture(author.name, on ? '\u25cf Here now' : 'Meet the author', { author: on });
      tag.material.needsUpdate = true;
    };
    h.update = (t, dt) => {
      h.onlineT = damp(h.onlineT, h.online, 3, dt);
      bust.rotation.y = Math.sin(t * 0.4 + phase) * 0.35;
      bust.position.y = 1.15 + Math.sin(t * 1.1 + phase) * 0.015;
      m.uniforms.uOpacity.value = 0.85 + 0.35 * h.onlineT;
      beamMat.uniforms.uOpacity.value = 0.2 + 0.2 * h.onlineT;
    };
    return h;
  }

  const booths = books.map((book, k) => {
    const side = k % 2 === 0 ? -1 : 1;
    const z = BOOTH_Z0 - k * BOOTH_STRIDE;
    const group = new THREE.Group();
    group.position.set(side * BOOTH_X, 0, z);
    const dir = new V3(-side, 0, 0.38).normalize();
    group.rotation.y = Math.atan2(dir.x, dir.z);
    const img = images[k];
    const coverTex = img ? imageTexture(img) : null;
    const soon = book.status === 'coming-soon';

    const back = new THREE.Mesh(backGeo, mat.velvet);
    back.position.set(0, 1.56, -0.98);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.1, 12), mat.gold);
    rod.rotation.z = Math.PI / 2;
    rod.position.set(0, 3.12, -0.93);
    const posterTex = img ? T.posterTexture(img, book, k, books.length, Q.poster) : null;
    const poster = new THREE.Mesh(posterGeo, new THREE.MeshStandardMaterial({ map: posterTex, emissive: 0xffffff, emissiveMap: posterTex, emissiveIntensity: 0.5, roughness: 0.75 }));
    poster.position.set(0, 1.78, -0.92);
    const frame = new THREE.Mesh(frameGeo, mat.gold);
    frame.position.set(0, 1.78, -0.945);
    const ped = new THREE.Mesh(pedGeo, mat.marble);
    ped.position.set(0, 0.525, 0);
    ped.castShadow = ped.receiveShadow = Q.shadows;
    const trim = new THREE.Mesh(trimGeo, mat.gold);
    trim.position.set(0, 1.06, 0);
    trim.receiveShadow = Q.shadows;
    const baseTrim = new THREE.Mesh(trimGeo, mat.gold);
    baseTrim.position.set(0, 0.025, 0);
    const plateTex = T.plateTexture([book.title, soon ? 'Coming soon' : (book.displayAuthor || book.author)], { soon });
    const plate = new THREE.Mesh(plateGeo, new THREE.MeshStandardMaterial({ map: plateTex, emissive: 0xffffff, emissiveMap: plateTex, emissiveIntensity: 0.3, roughness: 0.45 }));
    plate.position.set(0, 0.72, 0.393);
    const pool = new THREE.Mesh(poolGeo, poolMat(book.colors.glow, 0.42));
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(0, 0.014, 0.2);
    const cone = new THREE.Mesh(coneGeo, coneMaterial(0xffe2b0, 0.1));
    cone.position.set(0, 2.62, 0.05);

    const bk = buildBook(book, coverTex);
    const holder = new THREE.Group();
    holder.add(bk.group);
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.02), mat.gold);
    stand.position.set(0, 1.32, -0.12);
    stand.rotation.x = -0.34;

    group.add(back, rod, poster, frame, ped, trim, baseTrim, plate, pool, cone, stand, holder);

    if (soon) {
      const ropeMat = mat.velvetRed;
      [-0.62, 0.62].forEach((x) => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.04, 0.95, 16), mat.gold);
        post.position.set(x, 0.475, 0.78);
        const top = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), mat.gold);
        top.position.set(x, 0.97, 0.78);
        const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.03, 24), mat.gold);
        foot.position.set(x, 0.015, 0.78);
        group.add(post, top, foot);
      });
      const curve = new THREE.CatmullRomCurve3(catenary(new V3(-0.6, 0.9, 0.78), new V3(0.6, 0.9, 0.78), 0.22, 16));
      group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.022, 10, false), ropeMat));
    }

    scene.add(group);
    group.updateMatrixWorld(true);
    const restPos = new V3(0, 1.09 + (bk.h / 2) * Math.cos(0.2) + 0.012, 0.03);
    const restRot = new THREE.Euler(-0.2, 0, 0);
    holder.position.copy(restPos);
    holder.rotation.copy(restRot);
    const presentPos = new V3(0, 1.82, 0.72);

    const booth = {
      book, k, side, group, holder, bk, coverTex, restPos, restQuat: new THREE.Quaternion().setFromEuler(restRot),
      presentPos, present: 0, hover: 0, phase: Math.random() * 6.28, hdLoaded: false, pagesReady: false
    };
    const info = { kind: 'book', slug: book.slug };
    booth.info = info;
    [poster, ped, plate, frame, ...bk.meshes].forEach((m) => { m.userData.info = info; clickables.push(m); });
    // the piece beside the stand that carries the spirit of the book
    const prop = props.build(book);
    prop.group.position.copy(PROP_AT);
    group.add(prop.group);
    group.updateMatrixWorld(true);
    prop.group.traverse((o) => { if (o.isMesh) { o.userData.info = info; clickables.push(o); } });
    prop.colliders.forEach(([x, z, r]) => {
      const w = group.localToWorld(new V3(PROP_AT.x + x, 0, PROP_AT.z + z));
      colliders.push({ x: w.x, z: w.z, r });
    });
    booth.prop = prop;
    animated.push((t, dt) => { if (booth.awake) prop.update(t, dt); });
    const author = authorOf[book.slug];
    if (author) {
      const holo = buildHolo(author, book);
      const HOLO_AT = new V3(-1.32, 0, 0.3);
      holo.group.position.copy(HOLO_AT);
      group.add(holo.group);
      group.updateMatrixWorld(true);
      const w = group.localToWorld(HOLO_AT.clone());
      colliders.push({ x: w.x, z: w.z, r: 0.22 });
      interactables.push({ pos: group.localToWorld(new V3(HOLO_AT.x, 0, HOLO_AT.z + 0.5)), range: 2.5, info: holo.info });
      booth.holo = holo;
      animated.push((t, dt) => { if (booth.awake) holo.update(t, dt); });
    }
    [[0, 0, soon ? 0.85 : 0.6], [-0.62, -0.98, 0.42], [0, -0.98, 0.42], [0.62, -0.98, 0.42]].forEach(([x, zz, r]) => {
      const w = group.localToWorld(new V3(x, 0, zz));
      colliders.push({ x: w.x, z: w.z, r });
    });
    group.updateMatrixWorld(true);
    const ip = group.localToWorld(new V3(0, 0, 0.4));
    interactables.push({ pos: ip, range: 4.6, info, booth });
    return booth;
  });

  function boothWorld(b, local) { return b.group.localToWorld(local.clone()); }
  function boothDir(b) { return new V3(0, 0, 1).applyQuaternion(b.group.quaternion); }

  /* ---------- the Book Oracle ---------- */
  const oracle = new THREE.Group();
  {
    oracle.position.copy(ORACLE_POS);
    const dir = new V3(-1, 0, 0.5).normalize();
    oracle.rotation.y = Math.atan2(dir.x, dir.z);
    const cloth = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.84, 0.86, 48, 1, true), mat.velvet);
    cloth.material = mat.velvet.clone();
    cloth.material.side = THREE.DoubleSide;
    cloth.position.y = 0.43;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.64, 0.04, 48), mat.velvet);
    top.position.y = 0.87;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.012, 8, 64), mat.gold);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.89;
    const ballMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: 'varying vec3 vN;varying vec3 vV;varying vec3 vP;void main(){vP=position;vec4 mv=modelViewMatrix*vec4(position,1.0);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'uniform float uTime;varying vec3 vN;varying vec3 vV;varying vec3 vP;void main(){float f=1.0-abs(dot(vN,vV));float s=sin(vP.x*18.0+uTime*1.3+sin(vP.y*14.0-uTime*0.9)*2.0)*0.5+0.5;vec3 c=mix(vec3(0.32,0.16,0.85),vec3(1.0,0.72,0.38),s);c*=0.55+1.6*pow(f,2.2)+0.5*s;gl_FragColor=vec4(c*1.3,1.0);}'
    });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.21, 48, 32), ballMat);
    ball.position.y = 1.12;
    const ballBase = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.08, 24), mat.gold);
    ballBase.position.y = 0.93;
    const cardTex = T.cardBackTexture();
    const cardMat = new THREE.MeshStandardMaterial({ map: cardTex, roughness: 0.6 });
    [-0.34, 0, 0.34].forEach((x, i) => {
      const c = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.25), cardMat);
      c.rotation.x = -Math.PI / 2;
      c.rotation.z = (i - 1) * 0.25;
      c.position.set(x, 0.895, 0.32 - Math.abs(x) * 0.25);
      oracle.add(c);
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.375), new THREE.MeshStandardMaterial({
      map: T.signTexture({ title: 'THE BOOK ORACLE', sub: 'Let the fair choose for you', w: 1024, h: 256 }), emissive: 0xffffff, emissiveIntensity: 0.5, roughness: 0.6
    }));
    sign.material.emissiveMap = sign.material.map;
    sign.position.set(-0.95, 2.05, -0.2);
    sign.rotation.y = 0.35;
    const signPost = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.85, 12), mat.gold);
    signPost.position.set(-0.95, 0.92, -0.25);
    const pool = new THREE.Mesh(poolGeo, poolMat(0x9a6bff, 0.5));
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.015;
    const glowLight = new THREE.PointLight(0x9d74ff, 4, 4, 2);
    glowLight.position.y = 1.2;
    oracle.add(cloth, top, rim, ball, ballBase, sign, signPost, pool, glowLight);
    const oInfo = { kind: 'oracle' };
    [ball, cloth, top, sign].forEach((m) => { m.userData.info = oInfo; clickables.push(m); });
    colliders.push({ x: ORACLE_POS.x, z: ORACLE_POS.z, r: 0.95 });
    interactables.push({ pos: ORACLE_POS.clone(), range: 3.4, info: oInfo });
    animated.push((t) => { ballMat.uniforms.uTime.value = t; ball.position.y = 1.12 + Math.sin(t * 1.2) * 0.012; });
    scene.add(oracle);
  }

  /* ---------- Speak Your Book stage ---------- */
  const stageMicHead = new V3(0, 1.98, STAGE_Z + 2.6);
  {
    const g = new THREE.Group();
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.4, 0.35, 72), mat.marble);
    plat.position.set(0, 0.175, STAGE_Z);
    plat.receiveShadow = Q.shadows;
    const step = new THREE.Mesh(new THREE.CylinderGeometry(4.75, 4.85, 0.16, 72), mat.marble);
    step.position.set(0, 0.08, STAGE_Z);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.035, 8, 120), mat.gold);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, 0.35, STAGE_Z);
    g.add(plat, step, rim);
    // microphone
    const micBase = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.04, 32), mat.gold);
    micBase.position.set(0, 0.37, STAGE_Z + 2.6);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.45, 12), mat.gold);
    pole.position.set(0, 1.1, STAGE_Z + 2.6);
    const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.13, 8, 20), new THREE.MeshStandardMaterial({ color: 0xd8b56a, metalness: 1, roughness: 0.55 }));
    head.position.copy(stageMicHead);
    head.rotation.x = 0.35;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.012, 8, 32), mat.gold);
    ring.position.copy(stageMicHead);
    ring.rotation.x = Math.PI / 2 + 0.35;
    g.add(micBase, pole, head, ring);
    const sInfo = { kind: 'stage' };
    [micBase, pole, head, ring].forEach((m) => { m.userData.info = sInfo; clickables.push(m); });
    colliders.push({ x: 0, z: STAGE_Z + 2.6, r: 0.3 }, { x: 0, z: STAGE_Z - 3, r: 1.3 }, { x: -0.9, z: STAGE_Z - 3, r: 0.9 }, { x: 0.9, z: STAGE_Z - 3, r: 0.9 });
    interactables.push({ pos: new V3(0, 0, STAGE_Z + 2.6), range: 3.2, info: sInfo });
    // floating open book
    const bookG = new THREE.Group();
    bookG.position.set(0, 2.95, STAGE_Z - 3);
    const pageTex = T.glowPageTexture();
    const pageMat = new THREE.MeshStandardMaterial({ map: pageTex, emissive: 0xffffff, emissiveMap: pageTex, emissiveIntensity: 0.24, roughness: 0.8, side: THREE.DoubleSide, color: 0xf3e2c4 });
    const mkPage = (sideSign) => {
      const geo = new THREE.PlaneGeometry(1.5, 2.0, 24, 1);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) + 0.75;
        pos.setXYZ(i, sideSign * x, pos.getY(i), Math.sin((x / 1.5) * Math.PI * 0.85) * 0.18);
      }
      geo.computeVertexNormals();
      if (sideSign < 0) {
        const uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
      }
      const m = new THREE.Mesh(geo, pageMat);
      m.rotation.y = sideSign * -0.32;
      return m;
    };
    const coverMat = new THREE.MeshStandardMaterial({ color: 0x3a1636, roughness: 0.7 });
    const coverL = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.1, 0.03), coverMat);
    coverL.position.set(-0.74, 0, -0.1);
    coverL.rotation.y = 0.32;
    const coverR = coverL.clone();
    coverR.position.x = 0.74;
    coverR.rotation.y = -0.32;
    const bookHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.radial, color: new THREE.Color(1.0, 0.62, 0.3), transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }));
    bookHalo.scale.set(5.0, 3.8, 1);
    bookHalo.position.z = -0.4;
    bookG.add(bookHalo, mkPage(-1), mkPage(1), coverL, coverR);
    g.add(bookG);
    animated.push((t) => { bookG.position.y = 2.95 + Math.sin(t * 0.7) * 0.06; bookG.rotation.z = Math.sin(t * 0.5) * 0.015; });
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.4), new THREE.MeshStandardMaterial({
      map: T.signTexture({ eyebrow: 'THE OPPORTUNITY FOR COACHES', title: 'SPEAK YOUR BOOK', sub: 'Your voice. Your story. Your book.', w: 2048, h: 448 }), emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.6
    }));
    banner.material.emissiveMap = banner.material.map;
    banner.position.set(0, 5.85, STAGE_Z - 3.6);
    g.add(banner);
    const stageLight = new THREE.PointLight(0xffd29a, 16, 12, 1.6);
    stageLight.position.set(0, 4.5, STAGE_Z);
    g.add(stageLight);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), poolMat(0xffb36b, 0.45));
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(0, 0.36, STAGE_Z);
    g.add(pool);
    scene.add(g);

    // letters flowing from the microphone into the book
    const N = lowEnd ? 160 : 320;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3), seed = new Float32Array(N), glyph = new Float32Array(N), end = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      seed[i] = Math.random();
      glyph[i] = Math.floor(Math.random() * 64);
      const sideSign = Math.random() < 0.5 ? -1 : 1;
      end[i * 3] = sideSign * (0.2 + Math.random() * 1.1);
      end[i * 3 + 1] = 2.95 + (Math.random() - 0.5) * 1.6;
      end[i * 3 + 2] = STAGE_Z - 3 + 0.12;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    geo.setAttribute('aGlyph', new THREE.BufferAttribute(glyph, 1));
    geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 3));
    const letterMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uScale: { value: 600 }, uBoost: { value: 0 }, uStart: { value: stageMicHead.clone() }, uAtlas: { value: T.letterAtlas() }, uColor: { value: new THREE.Color(1.0, 0.82, 0.5).multiplyScalar(2.2) } },
      vertexShader: `attribute float aSeed;attribute float aGlyph;attribute vec3 aEnd;uniform float uTime;uniform float uScale;uniform vec3 uStart;uniform float uBoost;varying float vA;varying vec2 vCell;
        void main(){float life=(3.4+aSeed*1.8)/(1.0+uBoost*1.6);float t=fract(uTime/life+aSeed);
        vec3 ctrl=mix(uStart,aEnd,0.5)+vec3((aSeed-0.5)*2.4,1.3+aSeed*0.9,0.9);
        float e=t*t*(3.0-2.0*t);vec3 p=mix(mix(uStart,ctrl,e),mix(ctrl,aEnd,e),e);
        vec4 mv=modelViewMatrix*vec4(p,1.0);gl_PointSize=min((0.1+0.07*aSeed)*uScale/max(-mv.z,0.05),96.0);
        vA=smoothstep(0.0,0.1,t)*(1.0-smoothstep(0.85,1.0,t))*(1.0+uBoost);vCell=vec2(mod(aGlyph,8.0),floor(aGlyph/8.0));gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `uniform sampler2D uAtlas;uniform vec3 uColor;varying float vA;varying vec2 vCell;
        void main(){vec2 uv=vec2((vCell.x+gl_PointCoord.x)/8.0,1.0-(vCell.y+gl_PointCoord.y)/8.0);float a=texture2D(uAtlas,uv).a*vA;gl_FragColor=vec4(uColor,a);}`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    const letters = new THREE.Points(geo, letterMat);
    letters.frustumCulled = false;
    scene.add(letters);
    animated.push((t, dt) => {
      stageBoost = Math.max(0, stageBoost - (dt || 0) * 0.25);
      letterMat.uniforms.uBoost.value = stageBoost;
    });
    pointMats.push(letterMat);
  }

  /* ---------- the live event: screens beside the stage and seats for the audience ---------- */
  const screens = [];
  const seats = [];
  {
    const eInfo = { kind: 'event' };
    const SW = 3.0, SH = 3.0 * 780 / 1280;
    [-1, 1].forEach((side) => {
      const g = new THREE.Group();
      const x = side * 5.6, z = STAGE_Z + 0.4;
      g.position.set(x, 0, z);
      g.rotation.y = Math.atan2(-x, STAGE_Z + 10.6 - z);
      const cnv = T.makeCanvas(1280, 780);
      const st = T.toTexture(cnv);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ map: st, color: new THREE.Color(1.05, 1.02, 1.0) }));
      scr.position.set(0, 2.55, 0.05);
      const bezel = new THREE.Mesh(new RoundedBoxGeometry(SW + 0.16, SH + 0.16, 0.08, 3, 0.03), mat.gold);
      bezel.position.set(0, 2.55, 0);
      g.add(bezel, scr);
      [-1.15, 1.15].forEach((px) => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.7, 12), mat.gold);
        post.position.set(px, 0.85, -0.02);
        g.add(post);
      });
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(SW * 1.9, SH * 2.2), new THREE.MeshBasicMaterial({ map: tex.radial, color: new THREE.Color(1.0, 0.62, 0.35), transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.position.set(0, 2.55, -0.1);
      g.add(glow);
      scene.add(g);
      g.updateMatrixWorld(true);
      [scr, bezel].forEach((m) => { m.userData.info = eInfo; clickables.push(m); });
      [-1.15, 1.15].forEach((px) => { const w = g.localToWorld(new V3(px, 0, 0)); colliders.push({ x: w.x, z: w.z, r: 0.18 }); });
      interactables.push({ pos: g.localToWorld(new V3(0, 0, 1.3)), range: 3.4, info: eInfo });
      screens.push({ kind: side < 0 ? 'lineup' : 'countdown', canvas: cnv, tex: st });
    });

    // two blocks of velvet chairs, a centre aisle between them
    const spots = [];
    [STAGE_Z + 6.4, STAGE_Z + 7.6].forEach((z, r) => [1.45, 2.2, 2.95, 3.7].forEach((x) => [-1, 1].forEach((sd) => spots.push(new V3(sd * (x + r * 0.12), 0, z)))));
    const n = spots.length;
    const seatI = new THREE.InstancedMesh(new RoundedBoxGeometry(0.5, 0.09, 0.46, 2, 0.025), mat.velvetRed, n);
    const backI = new THREE.InstancedMesh(new RoundedBoxGeometry(0.5, 0.52, 0.07, 2, 0.025), mat.velvetRed, n);
    const legI = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.016, 0.012, 0.44, 6), mat.gold, n * 4);
    const railI = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.016, 0.016, 0.54, 8), mat.gold, n);
    const o = new THREE.Object3D();
    const M = new THREE.Matrix4(), Mp = new THREE.Matrix4(), qY = new THREE.Quaternion(), ONE = new V3(1, 1, 1), UP = new V3(0, 1, 0);
    const part = (mesh, idx, x, y, z, rx = 0, rz = 0) => {
      o.position.set(x, y, z);
      o.rotation.set(rx, 0, rz);
      o.updateMatrix();
      mesh.setMatrixAt(idx, Mp.copy(M).multiply(o.matrix));
    };
    spots.forEach((p, i) => {
      const dx = -p.x, dz = (STAGE_Z - 1) - p.z;
      const yaw = Math.atan2(-dx, -dz);
      M.compose(p, qY.setFromAxisAngle(UP, yaw), ONE);
      part(seatI, i, 0, 0.47, 0);
      part(backI, i, 0, 0.78, 0.21, 0.12);
      part(railI, i, 0, 1.05, 0.245, 0, Math.PI / 2);
      [[-0.21, -0.19], [0.21, -0.19], [-0.21, 0.19], [0.21, 0.19]].forEach(([lx, lz], j) => part(legI, i * 4 + j, lx, 0.22, lz));
      colliders.push({ x: p.x, z: p.z, r: 0.3 });
      interactables.push({ pos: p.clone(), range: 1.7, info: { kind: 'seat', index: i } });
      seats.push({ pos: p.clone(), yaw });
    });
    [seatI, backI, legI, railI].forEach((m) => { m.castShadow = false; m.receiveShadow = Q.shadows; scene.add(m); });
    [seatI, backI].forEach((m) => { m.userData.info = { kind: 'seat', index: -1 }; m.userData.instanced = 'seat'; clickables.push(m); });
  }

  function drawScreens() {
    if (!SIGNS.screens) return;
    screens.forEach((sc) => {
      T.drawEventScreen(sc.canvas, sc.kind, SIGNS.screens[sc.kind]);
      sc.tex.needsUpdate = true;
    });
  }
  drawScreens();

  /* ---------- the temple of Life Coach Code + the empty pedestal ---------- */
  let ghost = null;
  const finale = {};
  {
    const g = new THREE.Group();
    const xs = [-5.4, -1.85, 1.85, 5.4];
    xs.forEach((x, i) => {
      const c = new THREE.Mesh(colGeoShort, mat.marble);
      c.position.set(x, 0, TEMPLE_Z);
      g.add(c);
      const em = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.48), new THREE.MeshBasicMaterial({ map: T.emblemTexture(PILLARS[i].label, pillarImgs[i]), transparent: true, depthWrite: false, color: new THREE.Color(1.25, 1.2, 1.1) }));
      em.position.set(x, 2.55, TEMPLE_Z + 0.42);
      g.add(em);
      const tInfo = { kind: 'temple', pillar: PILLARS[i].label };
      em.userData.info = tInfo;
      c.userData.info = tInfo;
      clickables.push(em, c);
      colliders.push({ x, z: TEMPLE_Z, r: 0.55 });
      interactables.push({ pos: new V3(x, 0, TEMPLE_Z + 0.5), range: 3.4, info: tInfo });
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), poolMat(0xffc27a, 0.35));
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(x, 0.013, TEMPLE_Z + 0.4);
      g.add(pool);
    });
    const lintel = new THREE.Mesh(new RoundedBoxGeometry(13.4, 0.6, 1.0, 3, 0.05), mat.marble);
    lintel.position.set(0, 4.6, TEMPLE_Z);
    const lintelText = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 0.52), new THREE.MeshStandardMaterial({
      map: T.signTexture({ title: 'LIFE COACH CODE  ·  REPROGRAM TO SUPERHUMAN', w: 3072, h: 168 }), emissive: 0xffffff, emissiveIntensity: 0.7, roughness: 0.5
    }));
    lintelText.material.emissiveMap = lintelText.material.map;
    lintelText.position.set(0, 4.6, TEMPLE_Z + 0.505);
    g.add(lintel, lintelText);
    const crest = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.14, 64), mat.gold);
    crest.rotation.x = Math.PI / 2;
    crest.position.set(0, 5.95, TEMPLE_Z + 0.2);
    const crestLogo = new THREE.Mesh(new THREE.CircleGeometry(0.88, 64), new THREE.MeshBasicMaterial({ map: logoTex, color: new THREE.Color(0.95, 0.95, 0.95) }));
    crestLogo.position.set(0, 5.95, TEMPLE_Z + 0.28);
    const crestGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.radial, color: new THREE.Color(1.0, 0.8, 0.5), transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }));
    crestGlow.scale.set(3.8, 3.8, 1);
    crestGlow.position.set(0, 5.95, TEMPLE_Z + 0.1);
    g.add(crestGlow, crest, crestLogo);
    const goldBand = new THREE.Mesh(new THREE.BoxGeometry(13.5, 0.05, 1.04), mat.gold);
    goldBand.position.set(0, 4.28, TEMPLE_Z);
    g.add(goldBand);

    // empty pedestal for the next book
    const ped = new THREE.Mesh(pedGeo, mat.marble);
    ped.position.set(0, 0.525, TEMPLE_Z + 1.6);
    const trim = new THREE.Mesh(trimGeo, mat.gold);
    trim.position.set(0, 1.06, TEMPLE_Z + 1.6);
    const plate = new THREE.Mesh(plateGeo, new THREE.MeshStandardMaterial({ map: T.plateTexture(['Your book here', 'Speak your book']), emissive: 0xffffff, emissiveIntensity: 0.4, roughness: 0.45 }));
    plate.material.emissiveMap = plate.material.map;
    plate.position.set(0, 0.72, TEMPLE_Z + 1.6 + 0.393);
    const ghostMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(1.0, 0.78, 0.45).multiplyScalar(1.6) } },
      vertexShader: 'varying vec3 vN;varying vec3 vV;void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'uniform float uTime;uniform vec3 uColor;varying vec3 vN;varying vec3 vV;void main(){float f=1.0-abs(dot(vN,vV));float a=0.1+0.6*pow(f,1.5)+0.06*sin(uTime*2.0);gl_FragColor=vec4(uColor,a);}',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    const gGeo = new THREE.BoxGeometry(BOOK_W, BOOK_W / 0.6265, BOOK_D);
    ghost = new THREE.Mesh(gGeo, ghostMat);
    ghost.add(new THREE.LineSegments(new THREE.EdgesGeometry(gGeo), new THREE.LineBasicMaterial({ color: new THREE.Color(1.0, 0.82, 0.5).multiplyScalar(2.5), transparent: true, opacity: 0.9 })));
    ghost.position.set(0, 1.7, TEMPLE_Z + 1.6);
    const gInfo = { kind: 'ghost' };
    [ghost, ped, plate].forEach((m) => { m.userData.info = gInfo; clickables.push(m); });
    colliders.push({ x: 0, z: TEMPLE_Z + 1.6, r: 0.62 });
    interactables.push({ pos: new V3(0, 0, TEMPLE_Z + 1.6), range: 3.4, info: gInfo });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 1.1, 6, 40, 1, true), coneMaterial(0xffd9a0, 0.22));
    beam.position.set(0, 3.0, TEMPLE_Z + 1.6);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), poolMat(0xffc27a, 0.65));
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(0, 0.014, TEMPLE_Z + 1.8);
    const l = new THREE.PointLight(0xffcf90, 12, 7, 1.8);
    l.position.set(0, 3.2, TEMPLE_Z + 2.6);
    g.add(ped, trim, plate, ghost, beam, pool, l);
    Object.assign(finale, { group: g, plate, plateTex: plate.material.map, info: gInfo, pos: new V3(0, 0, TEMPLE_Z + 1.6) });
    animated.push((t) => {
      ghostMat.uniforms.uTime.value = t;
      ghost.rotation.y = Math.sin(t * 0.5) * 0.5;
      ghost.position.y = 1.62 + Math.sin(t * 0.9) * 0.05;
    });
    // sparkles rising from the empty pedestal
    const N = 90;
    const sg = new THREE.BufferGeometry();
    const sp = [], ss = [];
    for (let i = 0; i < N; i++) { const a = Math.random() * 6.28, r = Math.random() * 0.6; sp.push(Math.cos(a) * r, Math.random() * 4, TEMPLE_Z + 1.6 + Math.sin(a) * r); ss.push(Math.random()); }
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    sg.setAttribute('aSeed', new THREE.Float32BufferAttribute(ss, 1));
    const sm = pointsMaterial(new THREE.Color(1.0, 0.8, 0.5).multiplyScalar(2), { size: 0.05, alpha: 0.9, rise: 3, height: 4.2 });
    const sparkles = new THREE.Points(sg, sm);
    sparkles.position.y = 1.0;
    sparkles.frustumCulled = false;
    g.add(sparkles);
    pointMats.push(sm);
    scene.add(g);
  }

  /* ---------- the visitor's own book, placed on the empty pedestal ---------- */
  let customBook = null;
  function setCustomBook(spec) {
    if (customBook) {
      finale.group.remove(customBook.holder, customBook.stand);
      customBook.bk.meshes.forEach((m) => { const i = clickables.indexOf(m); if (i >= 0) clickables.splice(i, 1); });
      customBook.coverTex.dispose();
      customBook = null;
    }
    if (!spec) {
      ghost.visible = true;
      finale.plate.material.map = finale.plateTex;
      finale.plate.material.emissiveMap = finale.plateTex;
      finale.plate.material.needsUpdate = true;
      return;
    }
    const pseudo = { title: spec.title, author: spec.name || 'You', cover: { w: spec.canvas.width, h: spec.canvas.height }, colors: spec.colors };
    const coverTex = T.toTexture(spec.canvas);
    const bk = buildBook(pseudo, coverTex);
    const holder = new THREE.Group();
    holder.add(bk.group);
    const base = new V3(0, 1.09 + (bk.h / 2) * Math.cos(0.2) + 0.012, TEMPLE_Z + 1.6 + 0.03);
    holder.position.copy(base);
    holder.rotation.x = -0.2;
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.02), mat.gold);
    stand.position.set(0, 1.32, TEMPLE_Z + 1.6 - 0.12);
    stand.rotation.x = -0.34;
    finale.group.add(holder, stand);
    bk.meshes.forEach((m) => { m.userData.info = finale.info; clickables.push(m); });
    ghost.visible = false;
    const pt = T.plateTexture([spec.title, spec.name ? 'by ' + spec.name : 'Your book']);
    finale.plate.material.map = pt;
    finale.plate.material.emissiveMap = pt;
    finale.plate.material.needsUpdate = true;
    customBook = { holder, stand, bk, coverTex, base, phase: 0 };
  }
  animated.push((t) => {
    if (!customBook) return;
    customBook.holder.position.y = customBook.base.y + Math.sin(t * 0.8) * 0.008;
    customBook.holder.rotation.y = Math.sin(t * 0.45) * 0.08;
  });

  /* ---------- fairy lights + dust ---------- */
  {
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(fairyPos, 3));
    fg.setAttribute('aSeed', new THREE.Float32BufferAttribute(fairySeed, 1));
    const fm = pointsMaterial(new THREE.Color(1.0, 0.7, 0.38).multiplyScalar(3.2), { size: 0.075, alpha: 1 });
    const fairy = new THREE.Points(fg, fm);
    fairy.frustumCulled = false;
    scene.add(fairy);
    pointMats.push(fm);

    const dg = new THREE.BufferGeometry();
    const dp = [], ds = [];
    for (let i = 0; i < Q.dust; i++) { dp.push((Math.random() - 0.5) * 16, Math.random() * 9, 14 - Math.random() * (19 - TEMPLE_Z)); ds.push(Math.random()); }
    dg.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3));
    dg.setAttribute('aSeed', new THREE.Float32BufferAttribute(ds, 1));
    const dm = pointsMaterial(0xffd9a8, { size: 0.035, alpha: 0.55, rise: 1, height: 9 });
    const dust = new THREE.Points(dg, dm);
    dust.frustumCulled = false;
    scene.add(dust);
    pointMats.push(dm);
  }
  pointMats.push(haloMat);

  /* ---------- other visitors and authors, walking the fair live ---------- */
  const MAX_PEERS = lowEnd ? 20 : 48;
  const peerMat = holoMaterial(new THREE.Color(1, 1, 1), 0.95);
  holoMats.push(peerMat);
  const peerMesh = new THREE.InstancedMesh(holoGeo, peerMat, MAX_PEERS);
  peerMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PEERS * 3), 3);
  peerMesh.count = 0;
  peerMesh.frustumCulled = false;
  const peerGlow = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.3, 1.3).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
    map: tex.radial, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false
  }), MAX_PEERS);
  peerGlow.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PEERS * 3), 3);
  peerGlow.count = 0;
  peerGlow.frustumCulled = false;
  scene.add(peerMesh, peerGlow);
  const peers = new Map();
  const emotes = [];
  const GOLD_PEER = new THREE.Color(1.0, 0.8, 0.45);
  function setPeers(list) {
    const seen = new Set();
    list.forEach((d) => {
      seen.add(d.id);
      let p = peers.get(d.id);
      if (!p) {
        p = { id: d.id, pos: new V3(d.x, 0, d.z), yaw: d.yaw || 0, color: new THREE.Color(), phase: Math.random() * 6.28, key: '', tag: null, info: { kind: 'peer', id: d.id } };
        p.tag = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
        scene.add(p.tag);
        peers.set(d.id, p);
      }
      p.tx = d.x;
      p.tz = d.z;
      p.tyaw = d.yaw || 0;
      p.seated = !!d.seated;
      p.author = d.author || null;
      Object.assign(p.info, { name: d.name, author: d.author || null });
      const key = `${d.name}|${p.author ? p.author.id : ''}`;
      if (p.key !== key) {
        p.key = key;
        p.tag.material.map = p.author ? tagTexture(p.author.name, '\u2726 Author \u00b7 here now', { author: true }) : tagTexture(d.name || 'Visitor', '');
        p.tag.material.needsUpdate = true;
        const s = p.author ? 1.0 : 0.82;
        p.tag.scale.set(s, s * 168 / 640, 1);
      }
      if (p.author) p.color.copy(GOLD_PEER);
      else p.color.setHSL(((d.hue || 0) % 360) / 360, 0.65, 0.7);
    });
    peers.forEach((p, id) => {
      if (seen.has(id)) return;
      scene.remove(p.tag);
      p.tag.material.dispose();
      peers.delete(id);
    });
  }
  function peerEmote(id, emoji) {
    const p = peers.get(id);
    if (!p) return;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.emoteTexture(emoji), transparent: true, depthWrite: false }));
    sp.scale.set(0.5, 0.5, 1);
    scene.add(sp);
    emotes.push({ sp, peer: p, t: 0, dx: (Math.random() - 0.5) * 0.3 });
  }
  const peerList = [];
  function updatePeers(t, dt) {
    peerList.length = 0;
    peers.forEach((p) => {
      p.pos.x = damp(p.pos.x, p.tx, 4, dt);
      p.pos.z = damp(p.pos.z, p.tz, 4, dt);
      let dy = p.tyaw - p.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      p.yaw += dy * (1 - Math.exp(-4 * dt));
      p.dist = Math.hypot(p.pos.x - player.pos.x, p.pos.z - player.pos.z);
      peerList.push(p);
    });
    if (peerList.length > MAX_PEERS) peerList.sort((a, b) => a.dist - b.dist);
    let i = 0;
    peerList.forEach((p) => {
      if (i >= MAX_PEERS || p.dist > 60) { p.tag.visible = false; p.y = null; return; }
      p.y = (p.seated ? 0.5 : 0.96) + Math.sin(t * 1.3 + p.phase) * 0.03;
      dummy.position.set(p.pos.x, p.y, p.pos.z);
      dummy.rotation.set(0, p.yaw, 0);
      dummy.scale.setScalar(p.author ? 1.06 : 1);
      dummy.updateMatrix();
      peerMesh.setMatrixAt(i, dummy.matrix);
      peerMesh.setColorAt(i, p.color);
      dummy.position.y = 0.02;
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      peerGlow.setMatrixAt(i, dummy.matrix);
      peerGlow.setColorAt(i, p.color);
      p.tag.position.set(p.pos.x, p.y + 0.98, p.pos.z);
      p.tag.visible = p.dist < 22;
      i++;
    });
    peerMesh.count = peerGlow.count = i;
    [peerMesh, peerGlow].forEach((m) => { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
    for (let k = emotes.length - 1; k >= 0; k--) {
      const e = emotes[k];
      e.t += dt;
      const y = e.peer.y == null ? 1.0 : e.peer.y;
      e.sp.position.set(e.peer.pos.x + e.dx, y + 1.2 + e.t * 0.45, e.peer.pos.z);
      e.sp.material.opacity = Math.min(1, e.t * 4) * (1 - smooth(1.6, 2.6, e.t));
      const sc = 0.42 + Math.min(1, e.t * 3) * 0.12;
      e.sp.scale.set(sc, sc, 1);
      if (e.t > 2.6 || !peers.has(e.peer.id)) { scene.remove(e.sp); e.sp.material.dispose(); emotes.splice(k, 1); }
    }
  }

  /* ---------- places (map stops) ---------- */
  const places = [];
  const addPlace = (id, label, pos, lookAt, extra = {}) => places.push({ id, label, pos, look: lookAt, ...extra });
  addPlace('welcome', 'Entrance', new V3(0, 0, 19), new V3(0, 5.6, 0), { lookPortrait: new V3(0, 11.2, 0) });
  addPlace('hall', 'The Grand Hall', new V3(0, 0, -1.5), new V3(0, 1.4, -30));
  {
    const F = new V3(0, 0, 1).applyQuaternion(oracle.quaternion);
    addPlace('oracle', 'The Book Oracle', ORACLE_POS.clone().addScaledVector(F, 2.4), ORACLE_POS.clone().add(new V3(0, 1.0, 0)));
  }
  booths.forEach((b) => {
    // wide screens: the author's hologram, the book and the themed piece; phones: the book and the piece
    const F = boothDir(b);
    const center = boothWorld(b, new V3(b.holo ? 0.2 : 0.95, 1.25, 0));
    const p = center.clone().addScaledVector(F, b.holo ? 4.5 : 4.1);
    p.y = 0;
    const narrow = boothWorld(b, new V3(0.95, 1.2, 0));
    narrow.y += narrow.distanceTo(p) * 0.07;
    addPlace('book-' + b.book.slug, b.book.title, p, center, { booth: b, lookPortrait: narrow });
  });
  addPlace('speak', 'Speak Your Book', new V3(0, 0, STAGE_Z + 10.6), new V3(0, 2.6, STAGE_Z - 2), { shift: 0.35 });
  addPlace('about', 'Life Coach Code', new V3(0, 0, TEMPLE_Z + 9.6), new V3(0, 2.9, TEMPLE_Z));
  addPlace('finale', 'Your book here', new V3(0, 0, TEMPLE_Z + 5.2), new V3(0, 1.5, TEMPLE_Z + 1.6));

  /* ---------- player ---------- */
  const EYE = 1.65;
  const player = { pos: new V3(0, 0, 19), vel: new V3(), yaw: 0, pitch: 0.12, yawT: 0, pitchT: 0.12, ground: 0, bob: 0, bobAmp: 0, eye: EYE, seated: false };
  const keys = Object.create(null);
  const joy = { x: 0, y: 0 };
  let inputEnabled = true, travel = null, pendingPlace = null;
  const yawPitchTo = (from, to) => {
    const d = to.clone().sub(from);
    return { yaw: Math.atan2(-d.x, -d.z), pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)) };
  };
  {
    const yp = yawPitchTo(new V3(0, EYE, 19), framedLook(places[0], new V3(0, EYE, 19)));
    player.yaw = player.yawT = yp.yaw;
    player.pitch = player.pitchT = yp.pitch;
  }

  function groundAt(x, z) {
    const d = Math.hypot(x, z - STAGE_Z);
    return d < 4.25 ? 0.35 : d < 4.8 ? 0.16 : 0;
  }

  function collide(p) {
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      const dx = p.x - c.x, dz = p.z - c.z;
      const min = c.r + 0.32;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min) {
        const d = Math.sqrt(d2) || 0.0001;
        p.x = c.x + (dx / d) * min;
        p.z = c.z + (dz / d) * min;
      }
    }
    p.z = Math.max(TEMPLE_Z + 1.0, Math.min(26, p.z));
    const half = p.z < 0.4 ? 6.8 : 13;
    p.x = Math.max(-half, Math.min(half, p.x));
  }

  // keep the subject beside the info card (desktop) or below it (phones)
  function framedLook(place, eye) {
    const look = place.look.clone();
    const d = look.clone().sub(eye);
    const dist = d.length();
    const isPortrait = window.innerWidth / window.innerHeight < 0.85;
    if (isPortrait && place.lookPortrait) return place.lookPortrait.clone();
    if (isPortrait) return look.add(new V3(0, dist * 0.07, 0));
    if (window.innerWidth < 900) return look;
    // turn just enough that the subject sits in the middle of the space the card leaves free
    const tanH = Math.tan(THREE.MathUtils.degToRad(56) / 2) * (window.innerWidth / window.innerHeight);
    const k = (place.shift != null ? place.shift : 1) * leftInset() * tanH;
    const right = new V3().crossVectors(d.normalize(), new V3(0, 1, 0)).normalize();
    return look.addScaledVector(right, -dist * k);
  }

  function travelTo(id, { instant = false } = {}) {
    const place = typeof id === 'object' ? id : places.find((p) => p.id === id);
    if (!place) return;
    player.seated = false;
    const eye = new V3(place.pos.x, groundAt(place.pos.x, place.pos.z) + EYE, place.pos.z);
    const yp = yawPitchTo(eye, framedLook(place, eye));
    if (instant) {
      player.pos.copy(place.pos);
      player.vel.set(0, 0, 0);
      player.yaw = player.yawT = yp.yaw;
      player.pitch = player.pitchT = yp.pitch;
      travel = null;
      wakeBooths(true);
      return;
    }
    let dy = yp.yaw - player.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const dist = player.pos.distanceTo(place.pos);
    travel = {
      from: player.pos.clone(), to: place.pos.clone(),
      ctrl: new V3(0, 0, (player.pos.z + place.pos.z) / 2),
      yaw0: player.yaw, yaw1: player.yaw + dy, pitch0: player.pitch, pitch1: yp.pitch,
      t: 0, dur: reduceMotion ? 0.01 : Math.min(4.2, Math.max(place.minDur || 1.3, dist / 11)), lift: Math.min(2.2, dist * 0.04), seat: place.seat
    };
  }

  // walk to a point beside someone (or something) and turn to face it
  function travelNear(x, z, lookY = 1.5) {
    const to = new V3(x, 0, z);
    const from = player.pos.clone();
    const d = from.clone().sub(to);
    d.y = 0;
    if (d.length() < 0.01) d.set(0, 0, 1);
    d.normalize();
    const pos = to.clone().addScaledVector(d, 2.2);
    collide(pos);
    travelTo({ id: 'near', pos, look: new V3(x, lookY, z) });
  }

  function sit(i) {
    const s = seats[i];
    if (!s) return;
    travelTo({ id: 'seat', pos: s.pos.clone(), look: new V3(0, 2.2, STAGE_Z - 1), seat: true, minDur: 0.8 });
  }

  function updatePlayer(dt) {
    if (travel) {
      travel.t = Math.min(1, travel.t + (wallDt || dt) / travel.dur);
      const e = easeInOut(travel.t);
      // a gentle curve that bows toward the aisle, so the glide doesn't cut through booths
      const u = 1 - e;
      player.pos.set(
        u * u * travel.from.x + 2 * u * e * travel.ctrl.x + e * e * travel.to.x, 0,
        u * u * travel.from.z + 2 * u * e * travel.ctrl.z + e * e * travel.to.z
      );
      player.liftY = Math.sin(Math.PI * e) * travel.lift;
      player.yaw = player.yawT = travel.yaw0 + (travel.yaw1 - travel.yaw0) * e;
      player.pitch = player.pitchT = travel.pitch0 + (travel.pitch1 - travel.pitch0) * e;
      player.vel.set(0, 0, 0);
      if (travel.t >= 1) {
        if (travel.seat) player.seated = true;
        travel = null;
        player.liftY = 0;
      }
    } else {
      player.liftY = 0;
      const active = inputEnabled && !focus && introT >= 1;
      let fw = 0, st = 0, turn = 0;
      if (active) {
        fw = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) + joy.y;
        st = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + joy.x;
        turn = (keys.ArrowLeft ? 1 : 0) - (keys.ArrowRight ? 1 : 0);
      }
      player.yawT += turn * 1.9 * dt;
      if (player.seated && (fw || st)) player.seated = false;
      const len = Math.hypot(fw, st);
      if (len > 1) { fw /= len; st /= len; }
      const run = keys.ShiftLeft || keys.ShiftRight;
      const speed = run ? 6.4 : 3.4;
      const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
      const wantX = (-sin * fw + cos * st) * speed;
      const wantZ = (-cos * fw - sin * st) * speed;
      player.vel.x = damp(player.vel.x, wantX, 9, dt);
      player.vel.z = damp(player.vel.z, wantZ, 9, dt);
      player.pos.x += player.vel.x * dt;
      player.pos.z += player.vel.z * dt;
      if (!player.seated) collide(player.pos);
      const sp = Math.hypot(player.vel.x, player.vel.z);
      player.bob += sp * dt * 2.1;
      player.bobAmp = damp(player.bobAmp, Math.min(1, sp / 3.4), 6, dt);
      if (sp > 0.4 && !movedOnce) { movedOnce = true; onMoved(); }
    }
    player.yaw = damp(player.yaw, player.yawT, 16, dt);
    player.pitch = damp(player.pitch, player.pitchT, 16, dt);
    player.ground = damp(player.ground, groundAt(player.pos.x, player.pos.z), 8, dt);
    player.eye = damp(player.eye, player.seated ? 1.16 : EYE, 4, dt);
  }
  let movedOnce = false;

  /* ---------- zones + what you can interact with ---------- */
  const fwd = new V3();
  let zone = null, near = null;
  function updateAwareness() {
    if (focus) return;
    const p = player.pos;
    fwd.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    // nearest interactable you are facing
    let best = null, bestScore = Infinity;
    interactables.forEach((it) => {
      if (player.seated && it.info.kind === 'seat') return;
      const dx = it.pos.x - p.x, dz = it.pos.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > it.range) return;
      const facing = (dx * fwd.x + dz * fwd.z) / (d || 1);
      if (facing < 0.35 && d > 1.4) return;
      const score = d - facing * 1.2;
      if (score < bestScore) { bestScore = score; best = it; }
    });
    peers.forEach((pr) => {
      if (pr.y == null) return;
      const dx = pr.pos.x - p.x, dz = pr.pos.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > 3.4) return;
      const facing = (dx * fwd.x + dz * fwd.z) / (d || 1);
      if (facing < 0.5) return;
      const score = d - facing * 1.2 - 0.6;
      if (score < bestScore) {
        bestScore = score;
        pr.it = pr.it || { info: pr.info };
        best = pr.it;
      }
    });
    if (best !== near) { near = best; onNear(near ? near.info : null); }
    // which card to show
    let z = null;
    let bz = null, bzScore = Infinity;
    booths.forEach((b) => {
      const c = b.group.position;
      const dx = c.x - p.x, dz = c.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > 5.4) return;
      const facing = (dx * fwd.x + dz * fwd.z) / (d || 1);
      if (facing < 0.05 && d > 3) return;
      const s = d - facing * 1.6;
      if (s < bzScore) { bzScore = s; bz = b; }
    });
    if (player.seated) z = 'event';
    else if (bz) z = 'book-' + bz.book.slug;
    else if (p.distanceTo(ORACLE_POS) < 4.6) z = 'oracle';
    else if (p.z > 0.6) z = 'welcome';
    else if (p.z > -6.5) z = 'hall';
    else if (Math.hypot(p.x, p.z - (TEMPLE_Z + 1.6)) < 4.6) z = 'finale';
    else if (p.z < STAGE_Z - 4.4) z = 'about';
    else if (p.z < STAGE_Z + 11.5) z = 'speak';
    else z = 'hall';
    if (z !== zone) { zone = z; onZone(zone); }
  }

  /* ---------- camera ---------- */
  const camQ = new THREE.Quaternion(), focusQ = new THREE.Quaternion(), introQ = new THREE.Quaternion();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const lookCam = new THREE.PerspectiveCamera();
  const introFrom = new V3(0, 10, 44);
  {
    lookCam.position.copy(introFrom);
    lookCam.lookAt(0, 4.5, 0);
    introQ.copy(lookCam.quaternion);
  }
  let introT = reduceMotion ? 1 : 0, introStarted = false;
  let focus = null, focusT = 0, lastFocus = null, portrait = false;
  const shift = new THREE.Vector2();
  let hovered = null, running = true, last = performance.now(), elapsed = 0, lastWall = 0, wallDt = 0;
  const spotTarget = new V3(0, 1.4, -9), spotPos = new V3(0, 5, -8);
  const tmpPos = new V3(), fp = new V3(), fl = new V3();

  function focusPose(b) {
    const F = boothDir(b);
    fl.copy(boothWorld(b, new V3(0, b.presentPos.y, b.presentPos.z)));
    fp.copy(fl).addScaledVector(F, portrait ? 2.35 : 1.62).add(new V3(0, 0.04, 0));
    lookCam.position.copy(fp);
    lookCam.lookAt(fl);
    focusQ.copy(lookCam.quaternion);
  }

  function updateCamera(dt) {
    portrait = window.innerWidth / window.innerHeight < 0.85;
    const bob = reduceMotion ? 0 : Math.sin(player.bob * 2) * 0.03 * player.bobAmp;
    tmpPos.set(player.pos.x, player.ground + player.eye + bob + (player.liftY || 0), player.pos.z);
    euler.set(player.pitch, player.yaw, Math.sin(player.bob) * 0.004 * player.bobAmp);
    camQ.setFromEuler(euler);

    if (introT < 1) {
      const e = easeInOut(introT);
      tmpPos.lerpVectors(introFrom, tmpPos, e);
      camQ.copy(introQ).slerp(camQ.clone(), e);
    }

    focusT = damp(focusT, focus ? 1 : 0, 3.0, dt);
    let sx = 0, sy = 0;
    const fb = focus || lastFocus;
    if (fb && focusT > 0.0005) {
      focusPose(fb);
      const e = easeInOut(Math.min(1, focusT));
      tmpPos.lerp(fp, e);
      camQ.slerp(focusQ, e);
      sx = portrait ? 0 : 0.21 * e;
      sy = portrait ? 0.26 * e : 0;
      // a booth opened from far away: move the visitor there while the book fills the view
      if (pendingPlace && focusT > 0.97) { travelTo(pendingPlace, { instant: true }); pendingPlace = null; }
    }
    camera.position.copy(tmpPos);
    camera.quaternion.copy(camQ);

    shift.x = damp(shift.x, sx, 8, dt);
    shift.y = damp(shift.y, sy, 8, dt);
    const W = window.innerWidth, H = window.innerHeight;
    if (Math.abs(shift.x) > 0.0005 || Math.abs(shift.y) > 0.0005) camera.setViewOffset(W, H, shift.x * W, shift.y * H, W, H);
    else if (camera.view && camera.view.enabled) camera.clearViewOffset();

    const fovT = portrait ? 66 : 56;
    if (Math.abs(camera.fov - fovT) > 0.01) { camera.fov = fovT; camera.updateProjectionMatrix(); updatePointScale(); }
  }

  function updateBooths(dt, t) {
    booths.forEach((b) => {
      const target = focus === b ? 1 : 0;
      b.present = damp(b.present, target, target ? 2.2 : 3.4, dt);
      b.hover = damp(b.hover, (hovered === b || (near && near.booth === b)) && !focus ? 1 : 0, 8, dt);
      const p = easeInOut(Math.min(1, b.present));
      const open = smooth(0.42, 1, b.present);
      b.holder.position.lerpVectors(b.restPos, b.presentPos, p);
      b.holder.position.x += (b.bk.w / 2) * open;
      b.holder.position.y += b.hover * 0.06 + (reduceMotion ? 0 : Math.sin(t * 0.8 + b.phase) * 0.008 * (1 - p));
      b.holder.quaternion.copy(b.restQuat).slerp(IDENTITY, p);
      if (!reduceMotion) b.holder.rotateY(Math.sin(t * 0.45 + b.phase) * 0.05 * (1 - p) + b.hover * 0.12);
      b.bk.hinge.rotation.y = -2.72 * open;
      if (b.turn) updateTurn(b, dt);
      else if (b !== focus && b.spread && b.present < 0.3) resetPages(b);
    });
  }

  /* ---------- look inside: turn the pages of the open book ---------- */
  function pageTex(b, i) {
    b.pageCache = b.pageCache || new Map();
    if (!b.pageCache.has(i)) {
      const spec = b.pageSpecs[i];
      const t = T.bookPageTexture(b.book, spec.kind === 'image' ? { kind: 'blank' } : spec, i);
      if (spec.kind === 'image') {
        const im = new Image();
        im.onload = () => { const full = T.bookPageTexture(b.book, spec, i, im); t.image = full.image; t.needsUpdate = true; };
        im.src = spec.src;
      }
      b.pageCache.set(i, t);
    }
    return b.pageCache.get(i);
  }
  const leftOf = (b, s) => (s === 0 ? b.endTex : pageTex(b, 2 * s - 1));
  const rightOf = (b, s) => pageTex(b, 2 * s);
  function setPage(m, t) { m.map = t; m.needsUpdate = true; }
  function makeLeaf(b) {
    const w = b.bk.w - 0.014, h = b.bk.h - 0.016;
    const front = new THREE.PlaneGeometry(w, h, 16, 1).translate(w / 2, 0, 0);
    const back = front.clone();
    const uv = back.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
    const fm = new THREE.MeshStandardMaterial({ map: b.endTex, roughness: 0.85 });
    const bm = new THREE.MeshStandardMaterial({ map: b.endTex, roughness: 0.85, side: THREE.BackSide });
    const g = new THREE.Group();
    g.add(new THREE.Mesh(front, fm), new THREE.Mesh(back, bm));
    g.position.set(-b.bk.w / 2 + 0.01, 0, b.bk.d / 2 - 0.006);
    g.visible = false;
    b.bk.group.add(g);
    b.leaf = { group: g, front, back, fm, bm, w, base: front.attributes.position.array.slice() };
    g.children.forEach((m) => { m.userData.info = b.info; m.userData.page = b; });
  }
  function bendLeaf(b, amount) {
    const L = b.leaf;
    [L.front, L.back].forEach((geo) => {
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = L.base[i * 3];
        pos.setZ(i, Math.sin((x / L.w) * Math.PI) * amount + (x / L.w) * (x / L.w) * amount * 0.5);
      }
      pos.needsUpdate = true;
    });
  }
  // the leaf lands just above the open cover, wherever the cover is
  const leafOpen = (b) => b.bk.hinge.rotation.y + 0.06;
  function turnPage(dir) {
    const b = focus;
    if (!dir || !b || b.turn || b.present < 0.8) return null;
    const next = b.spread + dir;
    if (next < 0 || next >= b.spreads) return null;
    if (!b.leaf) makeLeaf(b);
    const L = b.leaf;
    if (dir > 0) {
      setPage(L.fm, rightOf(b, b.spread));
      setPage(L.bm, leftOf(b, next));
      setPage(b.bk.inside, rightOf(b, next));
    } else {
      setPage(L.fm, rightOf(b, next));
      setPage(L.bm, leftOf(b, b.spread));
      setPage(b.bk.endpaper, leftOf(b, next));
    }
    L.group.visible = true;
    L.group.rotation.y = dir > 0 ? 0 : leafOpen(b);
    b.turn = { t: 0, dir, to: next };
    return { spread: next, spreads: b.spreads };
  }
  function updateTurn(b, dt) {
    const tr = b.turn;
    tr.t = Math.min(1, tr.t + dt / (reduceMotion ? 0.05 : 0.9));
    const e = easeInOut(tr.t);
    b.leaf.group.rotation.y = tr.dir > 0 ? leafOpen(b) * e : leafOpen(b) * (1 - e);
    bendLeaf(b, Math.sin(e * Math.PI) * 0.06);
    if (tr.t < 1) return;
    if (tr.dir > 0) setPage(b.bk.endpaper, leftOf(b, tr.to));
    else setPage(b.bk.inside, rightOf(b, tr.to));
    b.spread = tr.to;
    b.leaf.group.visible = false;
    b.turn = null;
  }
  function resetPages(b) {
    b.spread = 0;
    setPage(b.bk.inside, rightOf(b, 0));
    setPage(b.bk.endpaper, b.endTex);
    if (b.leaf) b.leaf.group.visible = false;
    // keep only the title page in memory
    b.pageCache.forEach((t, i) => { if (i !== 0) { t.dispose(); b.pageCache.delete(i); } });
  }

  function nearestBoothTo(p) {
    let best = null, bd = 7;
    booths.forEach((b) => { const d = p.distanceTo(b.group.position); if (d < bd) { bd = d; best = b; } });
    return best;
  }

  function updateSpot(dt) {
    const b = focus || nearestBoothTo(player.pos);
    if (b) {
      const tp = boothWorld(b, new V3(0, 4.7, 2.1));
      const tt = boothWorld(b, focus ? b.presentPos : new V3(0, 1.35, 0));
      spotPos.lerp(tp, 1 - Math.exp(-dt * 4));
      spotTarget.lerp(tt, 1 - Math.exp(-dt * 4));
      spot.intensity = damp(spot.intensity, focus ? 18 : 26, 3, dt);
    } else {
      spot.intensity = damp(spot.intensity, 0, 3, dt);
    }
    spot.position.copy(spotPos);
    spot.target.position.copy(spotTarget);
  }

  function updateLanterns(t) {
    lanternBase.forEach((l, i) => {
      dummy.position.set(l.p.x, l.p.y + Math.sin(t * 0.6 + l.ph) * 0.12, l.p.z);
      dummy.updateMatrix();
      lanterns.setMatrixAt(i, dummy.matrix);
      haloGeo.attributes.position.setY(i, dummy.position.y);
    });
    lanterns.instanceMatrix.needsUpdate = true;
    haloGeo.attributes.position.needsUpdate = true;
  }

  /* ---------- only animate what is near, and sharpen covers as you approach ---------- */
  let wakeTick = 0;
  const captureWaiters = [];
  function wakeBooths(force) {
    if (!force && ++wakeTick % 10 && wakeTick > 2) return;
    const p = focus ? boothWorld(focus, new V3()) : player.pos;
    booths.forEach((b) => {
      const d = b.group.position.distanceTo(p);
      b.awake = d < 26;
      b.prop.group.visible = d < 34;
      if (b.holo) b.holo.group.visible = d < 34;
      if (d < 7 && !lowEnd) loadHD(b);
    });
  }
  function loadHD(b) {
    if (b.hdLoaded || Q.cover >= b.book.cover.w) return;
    b.hdLoaded = true;
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => {
      const t = imageTexture(im);
      b.bk.front.map = t;
      b.bk.front.emissiveMap = t;
      b.bk.front.needsUpdate = true;
    };
    im.src = `assets/img/covers/${b.book.slug}-full.webp`;
  }

  /* ---------- adaptive quality ---------- */
  let perfFrames = 0, perfTime = 0, perfChecked = false;
  function checkPerf(dt) {
    if (perfChecked || introT < 1) return;
    perfFrames++;
    perfTime += dt;
    if (perfFrames >= 90) {
      perfChecked = true;
      const fps = perfFrames / perfTime;
      if (fps < 38) {
        const dpr = Math.max(1, renderer.getPixelRatio() * 0.75);
        renderer.setPixelRatio(dpr);
        composer.setPixelRatio(dpr);
        resize();
        if (fps < 28) { bloom.enabled = false; renderer.shadowMap.enabled = false; }
      }
    }
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    elapsed += dt;
    const wall = Math.min(0.25, (now - (lastWall || now)) / 1000);
    lastWall = now;
    if (introStarted && introT < 1) introT = Math.min(1, introT + wall / 4.2);
    wallDt = wall;
    updatePlayer(dt);
    updateCamera(dt);
    updateAwareness();
    updateBooths(dt, elapsed);
    updateSpot(dt);
    updateLanterns(elapsed);
    sky.update(elapsed, camera);
    grade.uniforms.uTime.value = elapsed;
    wakeBooths();
    updatePeers(elapsed, dt);
    holoMats.forEach((m) => { m.uniforms.uTime.value = elapsed; });
    animated.forEach((fn) => fn(elapsed, dt));
    pointMats.forEach((m) => { m.uniforms.uTime.value = elapsed; });
    renderer.info.reset();
    composer.render(dt);
    if (captureWaiters.length) {
      // the drawing buffer is only valid until this task ends: copy it now
      const c = document.createElement('canvas');
      c.width = canvas.width;
      c.height = canvas.height;
      c.getContext('2d').drawImage(canvas, 0, 0);
      captureWaiters.splice(0).forEach((fn) => fn(c));
    }
    checkPerf(dt);
    requestAnimationFrame(frame);
  }

  /* ---------- resize ---------- */
  function updatePointScale() {
    const h = renderer.domElement.height;
    const s = h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    pointMats.forEach((m) => { m.uniforms.uScale.value = s; });
  }
  function resize() {
    const W = window.innerWidth, H = window.innerHeight;
    renderer.setSize(W, H, false);
    composer.setSize(W, H);
    grade.uniforms.uRes.value.set(W, H);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    updatePointScale();
  }
  window.addEventListener('resize', resize, { passive: true });
  updatePointScale();

  /* ---------- input: keys, drag to look, click/tap on things ---------- */
  const isTyping = (e) => e.target && e.target.closest && e.target.closest('input, textarea, select, [contenteditable]');
  const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'];
  window.addEventListener('keydown', (e) => {
    if (!inputEnabled || isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (MOVE_KEYS.includes(e.code)) {
      keys[e.code] = true;
      if (e.code.startsWith('Arrow')) e.preventDefault();
      if (travel && !e.code.startsWith('Shift')) travel = null;
    }
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => { Object.keys(keys).forEach((k) => { keys[k] = false; }); });

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const drag = { down: false, active: false, id: null, x: 0, y: 0, lx: 0, ly: 0, moved: 0 };
  function pick(clientX, clientY) {
    ndc.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(clickables, false)[0];
    if (!hit || hit.distance > 18) return null;
    if (hit.object.userData.instanced === 'seat') return { kind: 'seat', index: hit.instanceId };
    return hit.object.userData.info || null;
  }
  function pickPage(clientX, clientY) {
    const b = focus;
    if (!b || b.present < 0.8) return 0;
    ndc.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const targets = [...b.bk.meshes, ...(b.leaf ? b.leaf.group.children : [])];
    const hit = ray.intersectObjects(targets, false)[0];
    if (!hit) return 0;
    const local = b.bk.group.worldToLocal(hit.point.clone());
    return local.x > -b.bk.w / 2 ? 1 : -1;
  }
  let hoverQueued = 0;
  canvas.addEventListener('pointerdown', (e) => {
    if (drag.down || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag.down = true;
    drag.active = false;
    drag.id = e.pointerId;
    drag.x = drag.lx = e.clientX;
    drag.y = drag.ly = e.clientY;
    drag.moved = 0;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (drag.down && e.pointerId === drag.id) {
      const dx = e.clientX - drag.lx, dy = e.clientY - drag.ly;
      drag.lx = e.clientX;
      drag.ly = e.clientY;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      if (drag.moved > 6 && inputEnabled && !focus && introT >= 1) {
        drag.active = true;
        const k = e.pointerType === 'touch' ? 0.0052 : 0.0034;
        player.yawT += dx * k;
        player.pitchT = Math.max(-1.1, Math.min(1.05, player.pitchT + dy * k * 0.8));
        if (travel) travel = null;
        canvas.style.cursor = 'grabbing';
      }
      return;
    }
    if (e.pointerType === 'mouse' && !hoverQueued) {
      hoverQueued = requestAnimationFrame(() => {
        hoverQueued = 0;
        if (focus || drag.down) { setHover(null, e); return; }
        setHover(pick(e.clientX, e.clientY), e);
      });
    }
  });
  function setHover(info, e) {
    hovered = info && info.kind === 'book' ? booths.find((b) => b.book.slug === info.slug) : null;
    canvas.style.cursor = info ? 'pointer' : 'grab';
    onHover(info, e ? e.clientX : 0, e ? e.clientY : 0);
  }
  const endDrag = (e) => {
    if (!drag.down || e.pointerId !== drag.id) return;
    drag.down = false;
    const wasDrag = drag.active;
    drag.active = false;
    canvas.style.cursor = 'grab';
    if (focus && !wasDrag && e.type !== 'pointercancel') {
      const dir = pickPage(e.clientX, e.clientY);
      if (dir) { const r = turnPage(dir); if (r) onPage(r); }
      return;
    }
    if (wasDrag || e.type === 'pointercancel' || !inputEnabled || introT < 1) return;
    const info = pick(e.clientX, e.clientY);
    if (info) onSelect(info);
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', () => { if (!drag.down && hovered !== undefined) setHover(null); });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) running = false;
    else if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
  });

  /* ---------- lazy HD + inside pages for the focused book ---------- */
  function prepareBooth(b) {
    if (!b.pagesReady) {
      b.pagesReady = true;
      b.pageSpecs = T.bookPageSpecs(b.book);
      b.spreads = 1 + (b.pageSpecs.length - 1) / 2;
      b.spread = 0;
      b.endTex = T.endpaperTexture(b.book);
      setPage(b.bk.inside, rightOf(b, 0));
      setPage(b.bk.endpaper, b.endTex);
    }
    loadHD(b);
  }

  // compile everything before the first visible frame to avoid hitches
  renderer.compile(scene, camera);
  requestAnimationFrame(frame);

  return {
    places: places.map((p) => ({ id: p.id, label: p.label })),
    startIntro(skip) { introStarted = true; if (skip) introT = 1; },
    travelTo,
    focus(slug) {
      const b = booths.find((x) => x.book.slug === slug) || null;
      if (b) {
        prepareBooth(b);
        lastFocus = b;
        travel = null;
        const place = places.find((p) => p.booth === b);
        pendingPlace = place && place.pos.distanceTo(player.pos) > 3.5 ? place.id : null;
      }
      focus = b;
      if (b) { hovered = null; onHover(null); }
    },
    setMove(x, y) { joy.x = x; joy.y = y; if ((x || y) && travel) travel = null; },
    travelNear,
    sit,
    isTraveling: () => !!travel,
    turnPage(dir) { const r = turnPage(dir); if (r) onPage(r); return r; },
    pageInfo: () => (focus && focus.pagesReady ? { spread: focus.spread, spreads: focus.spreads } : null),
    setPeers,
    peerEmote,
    peerPos(id) { const p = peers.get(id); return p ? { x: p.pos.x, z: p.pos.z } : null; },
    setAuthorOnline(id, on) { booths.forEach((b) => { if (b.holo && b.holo.info.id === id) b.holo.setOnline(on); }); },
    setCustomBook,
    setScreens(data) { SIGNS.screens = data; drawScreens(); },
    capture: () => new Promise((res) => { captureWaiters.push(res); }),
    playerState: () => ({ x: +player.pos.x.toFixed(2), z: +player.pos.z.toFixed(2), yaw: +player.yaw.toFixed(2), seated: player.seated }),
    listener() {
      const f = new V3(0, 0, -1).applyQuaternion(camera.quaternion);
      const u = new V3(0, 1, 0).applyQuaternion(camera.quaternion);
      return { x: camera.position.x, y: camera.position.y, z: camera.position.z, fx: f.x, fy: f.y, fz: f.z, ux: u.x, uy: u.y, uz: u.z };
    },
    soundAnchors: () => booths.map((b) => { const w = b.prop.group.getWorldPosition(new V3()); return { slug: b.book.slug, x: w.x, y: 1.2, z: w.z }; }),
    setInputEnabled(v) { inputEnabled = v; if (!v) Object.keys(keys).forEach((k) => { keys[k] = false; }); },
    near: () => (near ? near.info : null),
    zone: () => zone,
    pulse(kind) { if (kind === 'stage') stageBoost = 1; },
    stats: () => ({ book: focus ? { present: +focus.present.toFixed(3), hinge: +focus.bk.hinge.rotation.y.toFixed(3), spread: focus.spread, turning: !!focus.turn, leaf: focus.leaf ? { visible: focus.leaf.group.visible, rot: +focus.leaf.group.rotation.y.toFixed(3) } : null } : null, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries, player: player.pos.toArray().map((v) => +v.toFixed(2)), zone, near: near ? near.info : null }),
    quality: Q,
    debug: { bloom: (v) => { bloom.enabled = v; }, scene, renderer, camera, composer }
  };
}
