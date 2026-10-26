/*
 * Deep space around the fair: a painted nebula sky, a band of the Milky Way, thousands of
 * twinkling stars, a ringed planet, a small moon and the occasional shooting star.
 * Everything here follows the camera, so it reads as infinitely far away.
 */
import * as THREE from 'three';
import { makeCanvas, toTexture } from './textures.js';

export function createSky({ lowEnd = false } = {}) {
  const group = new THREE.Group();
  group.name = 'sky';
  const SUN = new THREE.Vector3(0.75, 0.35, 0.55).normalize();

  /* ---------- nebula dome ---------- */
  const skyMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec3 vDir;void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `
      uniform float uTime; varying vec3 vDir;
      float hash(vec3 p){p=fract(p*0.3183099+0.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
      float noise(vec3 x){vec3 i=floor(x);vec3 f=fract(x);f=f*f*(3.0-2.0*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      float fbm(vec3 p){float v=0.0;float a=0.5;for(int i=0;i<5;i++){v+=a*noise(p);p*=2.03;a*=0.5;}return v;}
      void main(){
        vec3 d=normalize(vDir);
        vec3 col=mix(vec3(0.028,0.016,0.05),vec3(0.006,0.005,0.018),smoothstep(-0.3,0.9,d.y));
        vec3 bandN=normalize(vec3(0.42,0.82,-0.38));
        float band=pow(1.0-abs(dot(d,bandN)),5.0);
        float n=fbm(d*2.6+vec3(0.0,0.0,uTime*0.002));
        float n2=fbm(d*6.0+11.0);
        float n3=fbm(d*1.4-4.0);
        vec3 violet=vec3(0.42,0.16,0.58), teal=vec3(0.08,0.32,0.55), rose=vec3(0.75,0.25,0.42), amber=vec3(1.0,0.62,0.32);
        float neb=smoothstep(0.42,0.85,n);
        col+=mix(violet,teal,smoothstep(0.3,0.7,n2))*neb*0.26;
        col+=rose*smoothstep(0.55,0.9,n3)*0.14;
        col+=amber*band*smoothstep(0.35,0.8,n)*(0.35+0.6*n2)*0.55;
        col+=vec3(0.85,0.8,1.0)*band*0.07;
        col*=1.0-0.55*smoothstep(0.55,0.72,fbm(d*10.0))*band;
        vec3 sd=d*360.0; vec3 id=floor(sd); float r=hash(id);
        if(r>0.996){vec3 f=fract(sd)-0.5;col+=vec3(0.9,0.92,1.0)*smoothstep(0.32,0.0,length(f))*(r-0.996)*240.0;}
        col+=vec3(0.04,0.02,0.06)*(1.0-smoothstep(-0.2,0.25,d.y));
        gl_FragColor=vec4(col,1.0);
      }`,
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(120, 64, 40), skyMat);
  dome.renderOrder = -100;
  dome.frustumCulled = false;
  group.add(dome);

  /* ---------- stars ---------- */
  const N = lowEnd ? 2600 : 5200;
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N), seed = new Float32Array(N);
  const bandN = new THREE.Vector3(0.42, 0.82, -0.38).normalize();
  const tmp = new THREE.Vector3();
  const palette = [[1, 1, 1], [0.75, 0.85, 1.1], [1.1, 0.9, 0.7], [1.1, 0.75, 0.6], [0.9, 0.8, 1.1]];
  for (let i = 0; i < N; i++) {
    tmp.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
    if (i % 3 === 0) {
      // pull a third of the stars toward the Milky Way band
      const along = tmp.clone().sub(bandN.clone().multiplyScalar(tmp.dot(bandN))).normalize();
      tmp.lerp(along, 0.85).normalize();
    }
    tmp.multiplyScalar(110);
    pos.set([tmp.x, tmp.y, tmp.z], i * 3);
    const p = palette[Math.floor(Math.random() * palette.length)];
    const bright = Math.random() < 0.02 ? 3.2 : Math.random() < 0.15 ? 1.6 : 1;
    col.set([p[0] * bright, p[1] * bright, p[2] * bright], i * 3);
    size[i] = bright > 2 ? 5 + Math.random() * 3 : 1.2 + Math.pow(Math.random(), 3) * 3.2;
    seed[i] = Math.random();
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sg.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  sg.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  sg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const starMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPR: { value: Math.min(window.devicePixelRatio || 1, 2) } },
    vertexShader: `attribute vec3 aColor;attribute float aSize;attribute float aSeed;uniform float uTime;uniform float uPR;varying vec3 vC;
      void main(){float tw=0.65+0.35*sin(uTime*(0.6+aSeed*2.4)+aSeed*80.0);vC=aColor*tw;
      vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=aSize*uPR*(0.85+0.15*tw);gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `varying vec3 vC;void main(){vec2 c=gl_PointCoord-0.5;float d=length(c);
      float core=pow(smoothstep(0.5,0.0,d),2.4);float cross=smoothstep(0.08,0.0,abs(c.x))*smoothstep(0.5,0.1,abs(c.y))+smoothstep(0.08,0.0,abs(c.y))*smoothstep(0.5,0.1,abs(c.x));
      float a=core+cross*0.25;gl_FragColor=vec4(vC*a,a);}`,
    transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, fog: false
  });
  const stars = new THREE.Points(sg, starMat);
  stars.renderOrder = -90;
  stars.frustumCulled = false;
  group.add(stars);

  /* ---------- ringed planet ---------- */
  const planetDir = new THREE.Vector3(-0.62, 0.3, -0.72).normalize();
  const planetMat = new THREE.ShaderMaterial({
    uniforms: { uSun: { value: SUN }, uTime: { value: 0 } },
    vertexShader: 'varying vec3 vN;varying vec3 vP;varying vec3 vV;void main(){vP=normalize(position);vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.0);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
    fragmentShader: `uniform vec3 uSun;uniform float uTime;varying vec3 vN;varying vec3 vP;varying vec3 vV;
      float h(float n){return fract(sin(n)*43758.5453);}
      void main(){
        float b=vP.y*9.0+sin(vP.x*4.0+vP.z*3.0)*0.7+sin(vP.y*31.0)*0.08;
        vec3 c1=vec3(0.36,0.2,0.5),c2=vec3(0.92,0.6,0.42),c3=vec3(0.2,0.32,0.62);
        vec3 base=mix(c1,c2,smoothstep(-0.6,0.9,sin(b)));
        base=mix(base,c3,smoothstep(0.4,1.0,sin(b*0.47+1.3))*0.6);
        float diff=smoothstep(-0.12,0.65,dot(vP,uSun));
        float rim=pow(1.0-max(dot(vN,vV),0.0),2.6);
        vec3 col=base*diff*1.15+vec3(0.45,0.6,1.0)*rim*(0.25+0.9*diff)+vec3(0.08,0.04,0.12)*(1.0-diff);
        gl_FragColor=vec4(col,1.0);
      }`,
    depthWrite: false, depthTest: true, fog: false
  });
  const planet = new THREE.Mesh(new THREE.SphereGeometry(17, 96, 64), planetMat);
  planet.position.copy(planetDir).multiplyScalar(100);
  planet.renderOrder = -80;
  const ringMat = new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: 'varying float vR;void main(){vR=length(position.xy);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `varying float vR;void main(){float t=(vR-22.0)/14.0;
      float bands=0.55+0.45*sin(t*70.0)*sin(t*23.0+1.0);float edge=smoothstep(0.0,0.08,t)*smoothstep(1.0,0.82,t);
      float gap=1.0-0.85*smoothstep(0.46,0.5,t)*smoothstep(0.56,0.52,t);
      vec3 c=mix(vec3(1.0,0.82,0.6),vec3(0.75,0.6,0.9),t);float a=bands*edge*gap*0.55;gl_FragColor=vec4(c*a,a);}`,
    transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(22, 36, 160, 1), ringMat);
  ring.position.copy(planet.position);
  ring.lookAt(planet.position.clone().add(new THREE.Vector3(0.25, 1, 0.35)));
  ring.renderOrder = -79;
  const atm = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(0.5, 0.55, 1.0), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, fog: false }));
  atm.scale.set(56, 56, 1);
  atm.position.copy(planet.position);
  atm.renderOrder = -81;
  group.add(atm, planet, ring);

  /* ---------- moon ---------- */
  const moonMat = planetMat.clone();
  moonMat.fragmentShader = `uniform vec3 uSun;varying vec3 vN;varying vec3 vP;varying vec3 vV;
    float hash(vec3 p){p=fract(p*0.3183099+0.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
    void main(){float c=0.7+0.3*hash(floor(vP*9.0));float diff=smoothstep(-0.05,0.5,dot(vP,uSun));float rim=pow(1.0-max(dot(vN,vV),0.0),3.0);
    gl_FragColor=vec4(vec3(0.85,0.82,0.9)*c*diff+vec3(0.5,0.5,0.8)*rim*0.3,1.0);}`;
  moonMat.uniforms = { uSun: { value: SUN } };
  const moon = new THREE.Mesh(new THREE.SphereGeometry(3.2, 48, 32), moonMat);
  moon.position.set(0.55, 0.42, -0.72).normalize().multiplyScalar(100);
  moon.renderOrder = -80;
  group.add(moon);

  /* ---------- shooting stars ---------- */
  const streakTex = (() => {
    const c = makeCanvas(256, 16), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.85, 'rgba(255,240,220,.9)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    x.fillStyle = g;
    x.fillRect(0, 6, 256, 4);
    return toTexture(c, { srgb: false });
  })();
  const streak = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: streakTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, fog: false, side: THREE.DoubleSide }));
  streak.renderOrder = -70;
  group.add(streak);
  let shoot = null, nextShoot = 4;
  const up = new THREE.Vector3(0, 1, 0);

  function update(t, cam) {
    group.position.copy(cam.position);
    skyMat.uniforms.uTime.value = t;
    starMat.uniforms.uTime.value = t;
    ring.rotation.z += 0.00005;
    if (!shoot && t > nextShoot) {
      const start = new THREE.Vector3(Math.random() * 2 - 1, 0.35 + Math.random() * 0.5, Math.random() * 2 - 1).normalize().multiplyScalar(95);
      const dir = new THREE.Vector3().crossVectors(start, up).normalize().applyAxisAngle(start.clone().normalize(), (Math.random() - 0.5) * 1.2);
      shoot = { start, dir, t0: t, dur: 0.9 + Math.random() * 0.5 };
    }
    if (shoot) {
      const k = (t - shoot.t0) / shoot.dur;
      if (k >= 1) { shoot = null; streak.material.opacity = 0; nextShoot = t + 6 + Math.random() * 9; return; }
      const p = shoot.start.clone().addScaledVector(shoot.dir, k * 30);
      streak.position.copy(p);
      const xAxis = shoot.dir.clone();
      const toCenter = p.clone().normalize().negate();
      const yAxis = new THREE.Vector3().crossVectors(toCenter, xAxis).normalize();
      const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
      streak.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
      streak.scale.set(14, 0.6, 1);
      streak.material.opacity = Math.sin(k * Math.PI);
    }
  }

  function glowTexture() {
    const c = makeCanvas(256, 256), x = c.getContext('2d');
    const g = x.createRadialGradient(128, 128, 60, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,255,255,.5)');
    g.addColorStop(0.55, 'rgba(255,255,255,.18)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 256);
    return toTexture(c, { srgb: false });
  }

  return { group, update, sun: SUN };
}
