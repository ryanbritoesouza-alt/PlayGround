import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, lerp, smoothstep, fbm, mulberry32, TAU } from './noise.js';

/* ------------------------------------------------------------------ */
/*  Island data                                                        */
/* ------------------------------------------------------------------ */

export const ISLANDS = [
  {
    id: 'dawn', name: 'Dawn Harbor', x: 0, z: 0, radius: 70, height: 16,
    seed: 11.3, biome: 'home', subtitle: 'Safe waters · Quest hub',
    flatten: { x: 9, z: -3, r: 23, y: 7.1 },
  },
  {
    id: 'ember', name: 'Ember Isle', x: 225, z: -58, radius: 76, height: 27,
    seed: 31.7, biome: 'ember', subtitle: 'Volcanic waters · Danger',
    volcano: 25,
  },
  {
    id: 'spire', name: 'Gullspire', x: -185, z: 162, radius: 56, height: 25,
    seed: 47.2, biome: 'wild', subtitle: 'Rocky outcrop · Uncharted',
  },
  {
    id: 'veil', name: 'Veil Atoll', x: -152, z: -218, radius: 38, height: 9,
    seed: 63.9, biome: 'wild', subtitle: 'Shallow reef · Uncharted',
  },
];

export const ISLAND_BY_ID = Object.fromEntries(ISLANDS.map(i => [i.id, i]));

/* ------------------------------------------------------------------ */
/*  Terrain height (single source of truth for render + physics)       */
/* ------------------------------------------------------------------ */

export function islandHeight(isl, x, z) {
  const dx = x - isl.x, dz = z - isl.z;
  const d = Math.hypot(dx, dz);
  const t = clamp(1 - d / isl.radius, 0, 1);
  if (t <= 0) return -8.5;

  let h = -8.5 + (isl.height + 8.5) * Math.pow(t, 0.88);
  const rough = (fbm(x * 0.036 + isl.seed, z * 0.036 - isl.seed, 4) - 0.5) * 4.4;
  h += rough * smoothstep(0.05, 0.62, t);
  h += (fbm(x * 0.11 - isl.seed, z * 0.11 + isl.seed, 3) - 0.5) * 1.1 * t;

  if (isl.biome === 'ember') {
    const peak = Math.pow(clamp(1 - d / (isl.radius * 0.4), 0, 1), 1.55) * isl.volcano;
    const crater = Math.exp(-Math.pow(d / 7.5, 2)) * 9.5;
    const ridges = (fbm(dx * 0.08 + 5, dz * 0.08 - 2, 3) - 0.45) * 5 * smoothstep(0.5, 0.05, d / isl.radius);
    h += peak + ridges - crater;
  }
  if (isl.biome === 'wild' && isl.id === 'spire') {
    h += Math.pow(clamp(1 - d / (isl.radius * 0.45), 0, 1), 1.8) * 12;
  }
  if (isl.flatten) {
    const f = isl.flatten;
    const fd = Math.hypot(x - (isl.x + f.x), z - (isl.z + f.z));
    const w = smoothstep(f.r * 1.35, f.r * 0.55, fd);
    h = lerp(h, f.y, w * 0.92);
  }
  return h;
}

export function heightAt(x, z) {
  let h = -9.5;
  for (const isl of ISLANDS) {
    const v = islandHeight(isl, x, z);
    if (v > h) h = v;
  }
  return h;
}

export function nearestIsland(x, z) {
  let best = ISLANDS[0], bd = Infinity;
  for (const isl of ISLANDS) {
    const d = Math.hypot(x - isl.x, z - isl.z);
    if (d < bd) { bd = d; best = isl; }
  }
  return { island: best, distance: bd };
}

export function biomeAt(x, z) {
  const { island, distance } = nearestIsland(x, z);
  return distance < island.radius * 0.95 ? island.biome : 'ocean';
}

export function isOnLand(x, z, margin = 0) {
  return heightAt(x, z) > 0.2 + margin;
}

export function shoreYaw(island) {
  return Math.atan2(island.x, island.z);
}

/* ------------------------------------------------------------------ */
/*  Materials                                                          */
/* ------------------------------------------------------------------ */

const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({
  color, roughness: 0.86, metalness: 0, flatShading: true, ...opts,
});

export const MATERIALS = {
  wood: mat(0x915d36),
  woodDark: mat(0x5f3a22),
  woodLight: mat(0xc08b58),
  straw: mat(0xd7b25e, { roughness: 1 }),
  strawDark: mat(0xb98c3e, { roughness: 1 }),
  leaf: mat(0x3f9b3f),
  leafLight: mat(0x66bf4a),
  leafDark: mat(0x2d7a39),
  rock: mat(0x8c877d),
  rockDark: mat(0x625f5a),
  rockWarm: mat(0xa0947d),
  clothRed: mat(0xc8443c),
  clothCream: mat(0xf2e2c4),
  clothTeal: mat(0x2e9d92),
  clothBlue: mat(0x2c5f9e),
  metal: mat(0xb9c1c6, { metalness: 0.55, roughness: 0.42 }),
  metalDark: mat(0x5d6670, { metalness: 0.5, roughness: 0.5 }),
  gold: mat(0xf0b93c, { metalness: 0.65, roughness: 0.3 }),
  skin: mat(0xc98d64),
  skinDark: mat(0x8e5a3c),
  glass: mat(0xffdd8a, { emissive: 0xffb42e, emissiveIntensity: 1.1, roughness: 0.3 }),
  lava: new THREE.MeshStandardMaterial({ color: 0xff5a14, emissive: 0xff3c00, emissiveIntensity: 2.4, roughness: 0.7 }),
  obsidian: mat(0x2c2830, { roughness: 0.55 }),
  ash: mat(0x4a3f3d),
  banner: mat(0x8e2e27, { side: THREE.DoubleSide }),
  rope: mat(0xc9a97a),
  canvas: mat(0xf4e9d0, { side: THREE.DoubleSide }),
  dark: mat(0x2a2320),
  green: mat(0x4b8b3b),
  flowerPink: mat(0xe47ea8),
  flowerYellow: mat(0xf2cd4a),
  water: new THREE.MeshStandardMaterial({ color: 0x2aa9b8, transparent: true, opacity: 0.72, roughness: 0.15, metalness: 0.1 }),
};

/* ------------------------------------------------------------------ */
/*  Geometry helpers                                                   */
/* ------------------------------------------------------------------ */

function box(w, h, d) { return new THREE.BoxGeometry(w, h, d); }
function cyl(rt, rb, h, seg = 8) { return new THREE.CylinderGeometry(rt, rb, h, seg); }
function cone(r, h, seg = 8) { return new THREE.ConeGeometry(r, h, seg); }
function sph(r, seg = 8) { return new THREE.SphereGeometry(r, seg, Math.max(4, seg / 2)); }

function addMesh(parent, geometry, material, {
  x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, cast = true, receive = true,
} = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.scale.set(sx, sy, sz);
  m.castShadow = cast;
  m.receiveShadow = receive;
  parent.add(m);
  return m;
}

function groupAt(x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  return g;
}

/* ------------------------------------------------------------------ */
/*  Sky, sun, clouds, ocean                                            */
/* ------------------------------------------------------------------ */

const SKY_VERT = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }
`;

const SKY_FRAG = /* glsl */`
  varying vec3 vDir;
  uniform vec3 uSunDir;
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uSun;
  uniform float uTime;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
               mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  void main() {
    vec3 dir = normalize(vDir);
    float h = clamp(dir.y, -0.15, 1.0);
    vec3 col = mix(uHorizon, uZenith, pow(max(h, 0.0), 0.52));
    col = mix(col, vec3(0.16, 0.46, 0.52), smoothstep(0.0, -0.13, h));
    float sd = max(dot(dir, uSunDir), 0.0);
    col += uSun * (pow(sd, 820.0) * 1.15 + pow(sd, 22.0) * 0.20 + pow(sd, 4.0) * 0.05);
    // thin, high cirrus bands
    float band = fbm(vec2(atan(dir.z, dir.x) * 2.4, dir.y * 12.0 + uTime * 0.004));
    col += vec3(1.0, 0.96, 0.9) * smoothstep(0.58, 0.83, band) * smoothstep(0.03, 0.28, dir.y) * 0.07;
    // warm glow at the horizon away from the sun
    col += vec3(0.35, 0.12, 0.05) * pow(1.0 - abs(dir.y), 6.0) * 0.10 * (1.0 - sd);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const WATER_VERT = /* glsl */`
  uniform float uTime;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying float vCrest;
  #include <fog_pars_vertex>
  void main() {
    vec3 p = position;
    float w1 = sin(p.x * 0.115 + uTime * 1.05) * 0.24;
    float w2 = sin(p.y * 0.093 - uTime * 0.82) * 0.19;
    float w3 = sin((p.x + p.y) * 0.145 + uTime * 1.35) * 0.10;
    p.z += w1 + w2 + w3;
    vCrest = w1 + w2 + w3;
    float dx = cos(p.x * 0.115 + uTime * 1.05) * 0.115 * 0.24
             + cos((p.x + p.y) * 0.145 + uTime * 1.35) * 0.145 * 0.10;
    float dy = -cos(p.y * 0.093 - uTime * 0.82) * 0.093 * 0.19
             + cos((p.x + p.y) * 0.145 + uTime * 1.35) * 0.145 * 0.10;
    vNormalW = normalize(vec3(-dx, 1.0, dy));
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const WATER_FRAG = /* glsl */`
  uniform float uTime;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uIslands[4];
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying float vCrest;
  #include <fog_pars_fragment>

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
               mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
  }

  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorld);
    vec3 n = normalize(vNormalW);
    float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
    float dist = length(cameraPosition.xz - vWorld.xz);
    vec3 deep = vec3(0.015, 0.235, 0.36);
    vec3 shallow = vec3(0.09, 0.67, 0.66);
    vec3 col = mix(shallow, deep, smoothstep(20.0, 330.0, dist) * 0.82);
    col += vec3(0.10, 0.35, 0.38) * fres;

    // sun glitter
    vec3 halfV = normalize(uSunDir + viewDir);
    float spec = pow(max(dot(n, halfV), 0.0), 150.0);
    float sparkle = noise(vWorld.xz * 1.7 + uTime * 0.12);
    col += uSunColor * spec * 2.2;
    col += uSunColor * pow(max(dot(n, halfV), 0.0), 18.0) * 0.12;

    // crest foam
    float foamNoise = noise(vWorld.xz * 0.35 + uTime * 0.18);
    float crest = smoothstep(0.36, 0.58, vCrest * 0.9 + foamNoise * 0.30);
    col += vec3(0.72, 0.95, 0.94) * crest * 0.30;

    // shoreline foam, one band per island
    float shore = 0.0;
    for (int i = 0; i < 4; i++) {
      float d = length(vWorld.xz - uIslands[i].xy);
      float band = 1.0 - smoothstep(0.8, 7.5, abs(d - uIslands[i].z));
      float ripple = 0.55 + 0.45 * sin(uTime * 1.8 + d * 0.55 - uIslands[i].x);
      shore = max(shore, band * ripple);
    }
    float shoreNoise = 0.45 + 0.55 * noise(vWorld.xz * 0.9 + uTime * 0.35);
    col = mix(col, vec3(0.88, 0.97, 0.93), shore * shoreNoise * 0.72);

    // stylised horizontal glints
    float glint = smoothstep(0.985, 1.0, sin(vWorld.z * 0.9 + uTime * 0.5) * sin(vWorld.x * 0.45 - uTime * 0.3));
    col += vec3(0.5, 0.8, 0.8) * glint * 0.15;

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

function makeSky(scene, sunDir) {
  const uniforms = {
    uSunDir: { value: sunDir.clone() },
    uZenith: { value: new THREE.Color(0x2a7bc9) },
    uHorizon: { value: new THREE.Color(0xbfe8e5) },
    uSun: { value: new THREE.Color(0xffe6ae) },
    uTime: { value: 0 },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(720, 32, 20),
    new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms, side: THREE.BackSide, depthWrite: false, fog: false })
  );
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  scene.add(sky);

  // Sun sprite
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 4, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,251,225,1)');
  g.addColorStop(0.12, 'rgba(255,240,180,0.95)');
  g.addColorStop(0.35, 'rgba(255,206,110,0.34)');
  g.addColorStop(1, 'rgba(255,170,70,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  sun.position.copy(sunDir).multiplyScalar(600);
  sun.scale.set(150, 150, 1);
  scene.add(sun);

  return { sky, uniforms, sun };
}

function makeClouds(scene, rng) {
  const cloudMat = new THREE.MeshBasicMaterial({
    color: 0xf4fbff, fog: true, transparent: true, opacity: 0.82, depthWrite: false,
  });
  const clouds = new THREE.Group();
  for (let i = 0; i < 10; i++) {
    const g = new THREE.Group();
    const puffs = 4 + Math.floor(rng() * 5);
    for (let j = 0; j < puffs; j++) {
      const r = 3.6 + rng() * 5;
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), cloudMat);
      m.position.set((j - puffs / 2) * 5 + rng() * 2, rng() * 2.4, rng() * 4);
      m.scale.set(1.5, 0.58, 1.0);
      m.rotation.set(rng(), rng(), rng());
      g.add(m);
    }
    const angle = (i / 10) * TAU + rng() * 0.4;
    const radius = 210 + rng() * 300;
    g.position.set(Math.cos(angle) * radius, 62 + rng() * 48, Math.sin(angle) * radius);
    g.scale.setScalar(1.1 + rng() * 1.4);
    clouds.add(g);
  }
  scene.add(clouds);
  return clouds;
}

function makeWater(scene, sunDir) {
  const geo = new THREE.PlaneGeometry(1700, 1700, 150, 150);
  const shoreVecs = ISLANDS.map(i => new THREE.Vector3(i.x, i.z, i.radius * 0.715));
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uSunDir: { value: sunDir.clone() },
      uSunColor: { value: new THREE.Color(0xffdda0) },
      uIslands: { value: shoreVecs },
    },
  ]);
  const material = new THREE.ShaderMaterial({
    vertexShader: WATER_VERT,
    fragmentShader: WATER_FRAG,
    uniforms,
    transparent: false,
    depthWrite: true,
    fog: true,
    side: THREE.DoubleSide,
  });
  const water = new THREE.Mesh(geo, material);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0;
  water.renderOrder = 2;
  water.frustumCulled = false;
  scene.add(water);
  return { water, uniforms };
}

/* ------------------------------------------------------------------ */
/*  Prop builders (added to a bucket then merged)                      */
/* ------------------------------------------------------------------ */

function palm(parent, x, z, scale, rng, tint = 0) {
  const y = heightAt(x, z);
  const g = groupAt(x, y - 0.2, z);
  g.rotation.y = rng() * TAU;
  g.scale.setScalar(scale);
  const trunkMat = MATERIALS.wood;
  const leafMat = tint ? MATERIALS.leafDark : MATERIALS.leaf;
  const leafMat2 = tint ? MATERIALS.leaf : MATERIALS.leafLight;
  let px = 0, pz = 0, py = 0;
  const segs = 5;
  for (let i = 0; i < segs; i++) {
    const t = i / segs;
    const h = 2.0;
    const lean = t * t * 0.9;
    addMesh(g, cyl(0.22 - t * 0.06, 0.30 - t * 0.06, h, 6), trunkMat, {
      x: px + lean * 0.35, y: py + h / 2, z: pz,
      rz: -0.06 - t * 0.05, ry: rng() * 0.2,
    });
    py += h * 0.92;
    px += lean * 0.28;
    pz += (rng() - 0.5) * 0.06;
  }
  const topX = px + 0.45, topY = py + 0.16, topZ = pz;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + rng() * 0.3;
    const droop = 0.55 + rng() * 0.35;
    addMesh(g, cone(0.5, 3.8, 4), i % 3 ? leafMat : leafMat2, {
      x: topX + Math.cos(a) * 1.55, y: topY - 0.35 - droop * 0.25, z: topZ + Math.sin(a) * 1.55,
      rx: Math.sin(a) * 1.18 + 0.1, rz: -Math.cos(a) * 1.18,
      ry: a, sy: 1.0, sz: 0.22,
    });
  }
  for (let i = 0; i < 3; i++) {
    const a = rng() * TAU;
    addMesh(g, sph(0.26, 6), MATERIALS.strawDark, {
      x: topX + Math.cos(a) * 0.3, y: topY - 0.35, z: topZ + Math.sin(a) * 0.3,
      cast: false,
    });
  }
  parent.add(g);
  return { x, z, r: 0.55 * scale };
}

function rock(parent, x, z, s, rng, material = MATERIALS.rock) {
  const y = heightAt(x, z);
  const g = groupAt(x, y + s * 0.28, z);
  const m = addMesh(g, new THREE.DodecahedronGeometry(s, 0), material, {
    sx: 1 + rng() * 0.6, sy: 0.7 + rng() * 0.5, sz: 0.9 + rng() * 0.5,
    rx: rng(), ry: rng() * TAU, rz: rng(),
  });
  m.castShadow = true;
  parent.add(g);
  return { x, z, r: s * 0.85 };
}

function hut(parent, x, z, scale, rng, colors = {}) {
  const y = heightAt(x, z);
  const g = groupAt(x, y - 0.15, z);
  g.rotation.y = rng() * TAU;
  g.scale.setScalar(scale);
  const wall = colors.wall || MATERIALS.woodLight;
  const roof = colors.roof || MATERIALS.straw;
  addMesh(g, cyl(2.6, 2.9, 3.4, 8), wall, { y: 1.7 });
  addMesh(g, cyl(2.75, 2.75, 0.35, 8), MATERIALS.woodDark, { y: 0.18 });
  addMesh(g, cone(3.9, 2.3, 8), roof, { y: 4.35 });
  addMesh(g, cone(4.05, 0.35, 8), MATERIALS.strawDark, { y: 3.35 });
  // door
  addMesh(g, box(1.15, 2.2, 0.25), MATERIALS.woodDark, { y: 1.05, z: 2.52 });
  addMesh(g, sph(0.08, 6), MATERIALS.gold, { x: 0.42, y: 1.0, z: 2.68, cast: false });
  // windows
  for (const a of [-1.1, 1.25]) {
    addMesh(g, box(0.75, 0.7, 0.18), MATERIALS.woodDark, { x: Math.sin(a) * 2.55, y: 2.0, z: Math.cos(a) * 2.55, ry: a });
    addMesh(g, box(0.56, 0.5, 0.1), MATERIALS.glass, { x: Math.sin(a) * 2.64, y: 2.0, z: Math.cos(a) * 2.64, ry: a, cast: false });
  }
  // barrel + crate beside the hut
  for (let i = 0; i < 2; i++) {
    const a = rng() * TAU, r = 3.4 + rng() * 1.1;
    addMesh(g, cyl(0.4, 0.46, 0.95, 8), MATERIALS.woodDark, {
      x: Math.cos(a) * r, y: 0.48, z: Math.sin(a) * r,
    });
    addMesh(g, cyl(0.42, 0.42, 0.09, 8), MATERIALS.metalDark, {
      x: Math.cos(a) * r, y: 0.75, z: Math.sin(a) * r, cast: false,
    });
  }
  // pennant
  addMesh(g, cyl(0.04, 0.04, 2.0, 4), MATERIALS.woodDark, { x: 2.7, y: 5.0, z: 0.4, cast: false });
  addMesh(g, box(0.85, 0.5, 0.04), colors.flag || MATERIALS.clothRed, { x: 3.12, y: 5.75, z: 0.4, ry: 0.1, cast: false });
  parent.add(g);
  return { x, z, r: 3.0 * scale };
}

function dock(parent) {
  const z = 0;
  const start = 41, end = 64;
  const y = 2.55;
  for (let x = start; x <= end; x += 2.0) {
    addMesh(parent, box(1.86, 0.18, 3.3), MATERIALS.wood, { x, y, z });
    if ((x - start) % 4 < 0.1) {
      addMesh(parent, cyl(0.22, 0.26, 5.2, 6), MATERIALS.woodDark, { x, y: y - 2.6, z: z - 1.7 });
      addMesh(parent, cyl(0.22, 0.26, 5.2, 6), MATERIALS.woodDark, { x, y: y - 2.6, z: z + 1.7 });
    }
  }
  // rails and lanterns
  for (const zz of [-1.72, 1.72]) {
    for (let x = start; x <= end; x += 4) {
      addMesh(parent, cyl(0.08, 0.08, 1.15, 5), MATERIALS.woodDark, { x, y: y + 0.62, z: zz, cast: false });
    }
    addMesh(parent, box(end - start, 0.1, 0.1), MATERIALS.woodDark, { x: (start + end) / 2, y: y + 1.16, z: zz, cast: false });
  }
  for (const x of [end - 1, start + 3]) {
    addMesh(parent, box(0.36, 0.55, 0.36), MATERIALS.metalDark, { x, y: y + 1.55, z: 1.72, cast: false });
    addMesh(parent, box(0.26, 0.36, 0.26), MATERIALS.glass, { x, y: y + 1.57, z: 1.72, cast: false });
    addMesh(parent, cone(0.32, 0.24, 4), MATERIALS.metalDark, { x, y: y + 1.93, z: 1.72, cast: false });
  }
  // crates on the dock
  addMesh(parent, box(1.1, 1.0, 1.1), MATERIALS.woodDark, { x: 48, y: y + 0.6, z: -0.85 });
  addMesh(parent, box(0.9, 0.8, 0.9), MATERIALS.woodLight, { x: 49.1, y: y + 0.5, z: 0.7 });
  return { x: 52, z: 0, y };
}

function marketStall(parent, x, z, rng) {
  const y = heightAt(x, z);
  const g = groupAt(x, y, z);
  g.rotation.y = -0.35;
  // counter
  addMesh(g, box(4.2, 0.25, 2.0), MATERIALS.woodLight, { y: 1.15 });
  addMesh(g, box(4.0, 0.9, 1.8), MATERIALS.wood, { y: 0.6 });
  for (const [px, pz] of [[-1.9, -0.85], [1.9, -0.85], [-1.9, 0.85], [1.9, 0.85]]) {
    addMesh(g, cyl(0.09, 0.11, 3.0, 5), MATERIALS.woodDark, { x: px, y: 2.0, z: pz });
  }
  // striped awning
  for (let i = 0; i < 6; i++) {
    addMesh(g, box(0.7, 0.08, 2.6), i % 2 ? MATERIALS.clothCream : MATERIALS.clothRed, {
      x: -1.75 + i * 0.7, y: 3.48, z: 0, rz: 0.06,
    });
  }
  addMesh(g, box(4.6, 0.14, 0.2), MATERIALS.woodDark, { y: 3.35, z: 1.3, cast: false });
  // fruit crates
  for (let i = 0; i < 5; i++) {
    addMesh(g, box(0.55, 0.4, 0.55), MATERIALS.woodDark, { x: -1.35 + i * 0.62, y: 1.35, z: -0.1 });
    addMesh(g, sph(0.24, 7), i % 2 ? MATERIALS.flowerPink : MATERIALS.flowerYellow, {
      x: -1.35 + i * 0.62, y: 1.58, z: -0.1, cast: false,
    });
  }
  // hanging sign
  addMesh(g, box(1.5, 0.62, 0.08), MATERIALS.woodLight, { y: 2.8, z: 1.35, cast: false });
  addMesh(g, cyl(0.03, 0.03, 0.6, 4), MATERIALS.rope, { x: -0.6, y: 3.15, z: 1.35, cast: false });
  parent.add(g);
  return { x, z, r: 2.4 };
}

function campfire(parent, x, z) {
  const y = heightAt(x, z);
  const g = groupAt(x, y, z);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    addMesh(g, new THREE.DodecahedronGeometry(0.32, 0), MATERIALS.rockDark, {
      x: Math.cos(a) * 1.05, y: 0.08, z: Math.sin(a) * 1.05, ry: a,
    });
  }
  for (let i = 0; i < 4; i++) {
    addMesh(g, cyl(0.10, 0.14, 1.8, 5), MATERIALS.woodDark, {
      x: Math.cos(i * 1.7) * 0.25, y: 0.38, z: Math.sin(i * 1.7) * 0.25,
      rz: Math.PI / 2 + 0.2, ry: i * 1.7,
    });
  }
  const flame = new THREE.Group();
  flame.position.y = 0.55;
  for (let i = 0; i < 3; i++) {
    const c = i === 0 ? 0xff7a1a : i === 1 ? 0xffc23d : 0xfff0b0;
    const m = new THREE.Mesh(cone(0.42 - i * 0.11, 1.4 - i * 0.32, 5),
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.88, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.set((i - 1) * 0.1, i * 0.16, 0);
    flame.add(m);
  }
  g.add(flame);
  const glow = new THREE.PointLight(0xff9a44, 9, 16, 2);
  glow.position.set(0, 1.3, 0);
  g.add(glow);
  return { group: g, x, z, flame, glow, pos: new THREE.Vector3(x, y + 1, z) };
}

function forge(parent, x, z) {
  const y = heightAt(x, z);
  const g = groupAt(x, y, z);
  g.rotation.y = 0.6;
  addMesh(g, new THREE.DodecahedronGeometry(1.7, 0), MATERIALS.rockDark, { y: 0.3, sx: 1.2, sy: 0.65, sz: 1.1 });
  addMesh(g, box(0.9, 0.55, 0.5), MATERIALS.metalDark, { x: 2.0, y: 1.0 });
  addMesh(g, box(1.6, 0.2, 0.7), MATERIALS.metalDark, { x: 2.0, y: 1.33 });
  addMesh(g, box(0.18, 0.6, 0.18), MATERIALS.woodDark, { x: 2.0, y: 0.42 });
  // weapon rack
  addMesh(g, cyl(0.09, 0.09, 2.5, 5), MATERIALS.woodDark, { x: -2.2, y: 1.25, z: 0 });
  addMesh(g, cyl(0.09, 0.09, 2.5, 5), MATERIALS.woodDark, { x: -0.7, y: 1.25, z: 0 });
  addMesh(g, box(1.7, 0.12, 0.12), MATERIALS.woodDark, { x: -1.45, y: 2.35, z: 0 });
  for (let i = 0; i < 3; i++) {
    addMesh(g, box(0.08, 1.5, 0.15), MATERIALS.metal, { x: -1.9 + i * 0.45, y: 1.6, z: 0.05, rz: 0.05 - i * 0.03, cast: false });
    addMesh(g, box(0.3, 0.08, 0.1), MATERIALS.gold, { x: -1.9 + i * 0.45, y: 0.9, z: 0.05, cast: false });
  }
  const glow = new THREE.PointLight(0xff6a20, 6, 10, 2);
  glow.position.set(2.0, 1.4, 0);
  g.add(glow);
  parent.add(g);
  return { x, z, glow };
}

function trainingDummy(parent, x, z) {
  const y = heightAt(x, z);
  const g = groupAt(x, y, z);
  g.rotation.y = 0.2;
  addMesh(g, cyl(0.12, 0.16, 2.4, 6), MATERIALS.woodDark, { y: 1.2 });
  addMesh(g, cyl(0.52, 0.45, 0.9, 7), MATERIALS.straw, { y: 2.0 });
  addMesh(g, sph(0.36, 7), MATERIALS.strawDark, { y: 2.7 });
  addMesh(g, box(2.0, 0.12, 0.12), MATERIALS.woodDark, { y: 2.25 });
  addMesh(g, new THREE.TorusGeometry(0.38, 0.045, 4, 10), MATERIALS.rope, { y: 2.25, z: 0.05, cast: false });
  parent.add(g);
  return { x, z, r: 0.8 };
}

function signpost(parent, x, z) {
  const y = heightAt(x, z);
  const g = groupAt(x, y, z);
  addMesh(g, cyl(0.1, 0.12, 3.0, 5), MATERIALS.woodDark, { y: 1.5 });
  addMesh(g, box(2.2, 0.7, 0.14), MATERIALS.woodLight, { x: 0.55, y: 2.5 });
  addMesh(g, box(0.5, 0.12, 0.16), MATERIALS.woodDark, { x: 1.7, y: 2.5, cast: false });
  addMesh(g, box(1.7, 0.16, 0.16), MATERIALS.woodLight, { x: 0.4, y: 1.8, rz: 0.04 });
  addMesh(g, box(0.4, 0.1, 0.18), MATERIALS.woodDark, { x: 1.1, y: 1.8, cast: false });
  parent.add(g);
  return { x, z, r: 0.5 };
}

function bannerPole(parent, x, z, color = MATERIALS.clothRed) {
  const y = heightAt(x, z);
  addMesh(parent, cyl(0.08, 0.1, 4.2, 6), MATERIALS.woodDark, { x, y: y + 2.1, z });
  addMesh(parent, chamferedBox(0.06, 1.7, 0.9), color, { x: x + 0.52, y: y + 3.1, z, cast: false });
  addMesh(parent, cone(0.16, 0.4, 5), MATERIALS.gold, { x, y: y + 4.35, z, cast: false });
}

function chamferedBox(w, h, d) {
  return new THREE.BoxGeometry(w, h, d);
}

function chestModel(x, z, gold = true) {
  const y = heightAt(x, z);
  const g = groupAt(x, y, z);
  g.rotation.y = Math.random() * TAU;
  const body = addMesh(g, box(1.5, 0.85, 1.0), gold ? MATERIALS.woodLight : MATERIALS.woodDark, { y: 0.48 });
  addMesh(g, box(1.58, 0.13, 1.08), MATERIALS.gold, { y: 0.14 });
  addMesh(g, box(1.58, 0.13, 1.08), MATERIALS.gold, { y: 0.82 });
  for (const zz of [-0.36, 0.36]) addMesh(g, box(1.6, 0.1, 0.1), MATERIALS.gold, { y: 0.5, z: zz, cast: false });
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.9, -0.5);
  const lid = addMesh(lidPivot, box(1.52, 0.38, 1.02), MATERIALS.woodLight, { y: 0.1, z: 0.5 });
  addMesh(lidPivot, box(1.6, 0.1, 0.12), MATERIALS.gold, { y: 0.3, z: 0.5 });
  addMesh(lidPivot, box(0.22, 0.28, 0.1), MATERIALS.gold, { y: 0.05, z: 1.02, cast: false });
  g.add(lidPivot);
  const glow = new THREE.PointLight(0xffca66, 4.5, 8, 2);
  glow.position.set(0, 1.2, 0);
  g.add(glow);
  return { group: g, lid: lidPivot, glow, pos: new THREE.Vector3(x, y + 1, z), opened: false };
}

function boatModel() {
  const g = new THREE.Group();
  const hullMat = MATERIALS.woodDark;
  const hull = new THREE.Group();
  // hull shell
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10, 0, TAU, Math.PI / 2, Math.PI / 2), hullMat);
  shell.scale.set(1.55, 1.15, 4.2);
  shell.position.y = 0.4;
  shell.castShadow = true;
  hull.add(shell);
  const deck = addMesh(hull, box(2.55, 0.18, 6.9), MATERIALS.woodLight, { y: 0.78 });
  // gunwales
  for (const sx of [-1, 1]) {
    addMesh(hull, box(0.22, 0.52, 7.2), MATERIALS.wood, { x: sx * 1.5, y: 0.98, rz: sx * 0.10 });
  }
  addMesh(hull, box(3.2, 0.45, 0.3), MATERIALS.wood, { y: 0.95, z: -3.5 });
  // bowsprit
  addMesh(hull, cyl(0.07, 0.12, 2.8, 6), MATERIALS.woodDark, { y: 1.0, z: 4.05, rx: Math.PI / 2 - 0.18 });
  addMesh(hull, cone(0.3, 1.2, 5), MATERIALS.gold, { y: 1.1, z: 5.25, rx: Math.PI / 2, cast: false });
  // mast
  addMesh(hull, cyl(0.12, 0.17, 7.4, 7), MATERIALS.woodDark, { y: 4.2, z: 0.3 });
  // sail texture
  const sailCanvas = document.createElement('canvas');
  sailCanvas.width = 256; sailCanvas.height = 320;
  const ctx = sailCanvas.getContext('2d');
  ctx.fillStyle = '#f3e7cb'; ctx.fillRect(0, 0, 256, 320);
  ctx.strokeStyle = 'rgba(130,95,55,0.28)'; ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo((i / 8) * 256, 0); ctx.lineTo((i / 8) * 256, 320); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(128, 150, 58, 0, TAU); ctx.fillStyle = '#c94534'; ctx.fill();
  ctx.beginPath(); ctx.arc(128, 150, 42, 0, TAU); ctx.fillStyle = '#f2c34a'; ctx.fill();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    ctx.beginPath(); ctx.moveTo(128 + Math.cos(a) * 24, 150 + Math.sin(a) * 24);
    ctx.lineTo(128 + Math.cos(a + 0.35) * 40, 150 + Math.sin(a + 0.35) * 40);
    ctx.lineTo(128 + Math.cos(a - 0.35) * 40, 150 + Math.sin(a - 0.35) * 40);
    ctx.closePath(); ctx.fillStyle = '#c94534'; ctx.fill();
  }
  const sail = addMesh(hull, new THREE.PlaneGeometry(4.6, 5.4, 8, 8), new THREE.MeshStandardMaterial({
    map: new THREE.CanvasTexture(sailCanvas), side: THREE.DoubleSide, roughness: 0.95, flatShading: true,
  }), { y: 4.7, z: 0.28, ry: 0.1, cast: false });
  // bellied sail shape
  const pos = sail.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / 4.6;
    pos.setZ(i, Math.cos(u * Math.PI) * 0.38);
  }
  pos.needsUpdate = true;
  sail.geometry.computeVertexNormals();
  // crossbeam + rigging
  addMesh(hull, cyl(0.08, 0.08, 5.0, 5), MATERIALS.woodDark, { y: 7.3, z: 0.3, rz: Math.PI / 2, cast: false });
  for (const side of [-1, 1]) {
    addMesh(hull, cyl(0.025, 0.025, 5.2, 3), MATERIALS.rope, { x: side * 2.3, y: 5.1, z: 0.3, rz: side * 0.45, cast: false });
  }
  // flag
  addMesh(hull, cyl(0.035, 0.035, 1.7, 3), MATERIALS.woodDark, { y: 8.2, z: 0.3, cast: false });
  addMesh(hull, box(0.06, 0.65, 1.05), MATERIALS.banner, { x: 0.32, y: 8.8, z: 0.3, cast: false });
  // wheel
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.07, 5, 14), MATERIALS.woodDark);
  wheel.position.set(0, 1.55, -2.4); wheel.rotation.x = Math.PI / 2 - 0.25; hull.add(wheel);
  for (let i = 0; i < 5; i++) {
    addMesh(hull, cyl(0.035, 0.035, 1.2, 4), MATERIALS.woodDark, { y: 1.55, z: -2.4, rx: Math.PI / 2 - 0.25, rz: (i / 5) * Math.PI, cast: false });
  }
  // lantern
  addMesh(hull, box(0.3, 0.42, 0.3), MATERIALS.glass, { y: 1.55, z: 2.9, cast: false });
  const lanternGlow = new THREE.PointLight(0xffbf6a, 4, 8, 2);
  lanternGlow.position.set(0, 1.6, 2.9);
  hull.add(lanternGlow);
  g.add(hull);
  return g;
}

/* ------------------------------------------------------------------ */
/*  Terrain mesh                                                       */
/* ------------------------------------------------------------------ */

function terrainColor(isl, x, z, h, slope, color) {
  const n = fbm(x * 0.13 + isl.seed, z * 0.13 - isl.seed, 3);
  const ember = isl.biome === 'ember';
  let c;
  if (h < -0.4) {
    c = new THREE.Color(0x9a8c6b).lerp(new THREE.Color(0x315f58), clamp((-h) / 7, 0, 1));
  } else if (h < 1.25) {
    c = new THREE.Color(0xe8d19c).lerp(new THREE.Color(0xf1dfb4), n);
  } else if (h < 2.3) {
    c = new THREE.Color(0xe4cd94).lerp(new THREE.Color(ember ? 0x52443f : 0x6c9b45), smoothstep(1.25, 2.3, h));
  } else {
    if (ember) {
      c = new THREE.Color(0x533b38).lerp(new THREE.Color(0x332b2c), clamp(h / 30, 0, 1));
      c.lerp(new THREE.Color(0x6c3528), clamp((n - 0.5) * 1.8, 0, 0.5));
      if (slope > 0.65) c.lerp(new THREE.Color(0x241f22), 0.4);
    } else {
      c = new THREE.Color(0x65a94b).lerp(new THREE.Color(0x3d7f3d), clamp((h - 2) / 10, 0, 1) * 0.6 + n * 0.2);
      if (slope > 0.6) c.lerp(new THREE.Color(0x837d6c), clamp((slope - 0.6) * 2, 0, 0.65));
      if (h > 12) c.lerp(new THREE.Color(0x8b8577), clamp((h - 12) / 6, 0, 0.8));
    }
  }
  c.offsetHSL(0, 0, (n - 0.5) * 0.035);
  color.copy(c);
}

function buildIsland(scene, isl) {
  const size = isl.radius * 2.65;
  const seg = isl.id === 'dawn' || isl.id === 'ember' ? 82 : 54;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + isl.x;
    const z = pos.getZ(i) + isl.z;
    const h = heightAt(x, z);
    pos.setY(i, h);
    const e = 1.1;
    const dx = heightAt(x + e, z) - heightAt(x - e, z);
    const dz = heightAt(x, z + e) - heightAt(x, z - e);
    const slope = Math.hypot(dx, dz) / (2 * e);
    terrainColor(isl, x, z, h, slope, color);
    colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.96, metalness: 0, flatShading: true,
  }));
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.position.set(isl.x, 0, isl.z);
  scene.add(mesh);
  return mesh;
}

/* ------------------------------------------------------------------ */
/*  Static batching                                                    */
/* ------------------------------------------------------------------ */

function bakeStatic(scene, group) {
  group.updateMatrixWorld(true);
  const buckets = new Map();
  group.traverse(obj => {
    if (!obj.isMesh) return;
    const material = obj.material;
    if (!material || Array.isArray(material)) return;
    const key = `${material.uuid}:${obj.castShadow ? 1 : 0}`;
    if (!buckets.has(key)) buckets.set(key, { material, cast: obj.castShadow, list: [] });
    let g = obj.geometry.clone();
    g.applyMatrix4(obj.matrixWorld);
    // Normalise attributes across primitives.
    if (!g.attributes.uv) {
      const count = g.attributes.position.count;
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    if (!g.attributes.normal) g.computeVertexNormals();
    if (g.index) g = g.toNonIndexed();
    buckets.get(key).list.push(g);
  });
  let tris = 0;
  for (const { material, cast, list } of buckets.values()) {
    if (!list.length) continue;
    let merged;
    try { merged = mergeGeometries(list, false); } catch { merged = null; }
    if (!merged) continue;
    merged.computeBoundingSphere();
    tris += merged.attributes.position.count / 3;
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
  group.clear();
  return tris;
}

/* ------------------------------------------------------------------ */
/*  Scatter helpers                                                    */
/* ------------------------------------------------------------------ */

function safeScatter(isl, rng, count, { minH = 1.4, maxH = 10.5, maxSlope = 0.55, avoid = [], minR = 2.2, inner = 0.18, outer = 0.92 } = {}) {
  const out = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 40) {
    const a = rng() * TAU;
    const d = isl.radius * (inner + rng() * (outer - inner));
    const x = isl.x + Math.cos(a) * d;
    const z = isl.z + Math.sin(a) * d;
    const h = heightAt(x, z);
    if (h < minH || h > maxH) continue;
    const e = 1.2;
    const slope = Math.hypot(heightAt(x + e, z) - heightAt(x - e, z), heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
    if (slope > maxSlope) continue;
    if (avoid.some(p => Math.hypot(x - p.x, z - p.z) < minR)) continue;
    if (out.some(p => Math.hypot(x - p.x, z - p.z) < 2.6)) continue;
    out.push({ x, z, h });
  }
  return out;
}

function grassField(scene, isl, rng) {
  const points = safeScatter(isl, rng, isl.id === 'dawn' ? 950 : isl.id === 'ember' ? 260 : 420, {
    minH: 1.8, maxH: 9.5, maxSlope: 0.4,
    avoid: [{ x: isl.x + 9, z: isl.z - 3 }], minR: 12, inner: 0.2, outer: 0.85,
  });
  const geo = new THREE.ConeGeometry(0.09, 0.75, 3);
  geo.translate(0, 0.37, 0);
  const material = isl.biome === 'ember'
    ? new THREE.MeshStandardMaterial({ color: 0x5a4a35, roughness: 1, flatShading: true })
    : new THREE.MeshStandardMaterial({ color: 0x4a9c3e, roughness: 1, flatShading: true });
  const inst = new THREE.InstancedMesh(geo, material, points.length);
  const dummy = new THREE.Object3D();
  points.forEach((p, i) => {
    dummy.position.set(p.x, p.h, p.z);
    dummy.rotation.y = rng() * TAU;
    dummy.scale.set(0.7 + rng() * 0.9, 0.65 + rng() * 0.8, 0.7 + rng() * 0.9);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
  });
  inst.castShadow = false;
  inst.receiveShadow = true;
  scene.add(inst);
  return inst;
}

/* ------------------------------------------------------------------ */
/*  Island dressing                                                    */
/* ------------------------------------------------------------------ */

function dressHome(parent, rng, colliders) {
  const palmSpots = safeScatter(ISLAND_BY_ID.dawn, rng, 34, {
    minH: 1.5, maxH: 9, maxSlope: 0.65,
    avoid: [{ x: 9, z: -3 }, { x: 52, z: 0 }, { x: 30, z: 2 }], minR: 10, inner: 0.25, outer: 0.88,
  });
  palmSpots.forEach((p, i) => {
    const c = palm(parent, p.x, p.z, 0.8 + rng() * 0.55, rng, i % 4 === 0 ? 1 : 0);
    colliders.push({ x: c.x, z: c.z, r: c.r, type: 'tree' });
  });

  // Huts ring the village green.
  const hutSpots = [
    [1, -12, 1.0, 0], [-11, -4, 0.9, 2], [-2, 8, 1.05, 1], [13, -1, 0.82, 3],
    [-20, 12, 0.78, 5], [22, -14, 0.85, 4],
  ];
  hutSpots.forEach(([ox, oz, s, ci], i) => {
    const x = 9 + ox, z = -3 + oz;
    const flags = [MATERIALS.clothRed, MATERIALS.clothTeal, MATERIALS.clothBlue];
    const c = hut(parent, x, z, s, rng, { flag: flags[ci % 3] });
    colliders.push({ x: c.x, z: c.z, r: c.r, type: 'hut' });
  });

  const dockInfo = dock(parent);
  // Village green details
  marketStall(parent, 20, -6, rng); colliders.push({ x: 20, z: -6, r: 2.4, type: 'stall' });
  const fire = campfire(parent, 13, 11);
  forge(parent, 0, 13);
  signpost(parent, 27, 10);
  trainingDummy(parent, 23, -12); colliders.push({ x: 23, z: -12, r: 0.8, type: 'prop' });
  trainingDummy(parent, 26, -10);

  for (const [x, z] of [[-4, -19], [-16, -19], [17, -19], [-24, 3], [32, -5], [6, 20], [-13, 18]]) {
    colliders.push(rock(parent, x, z, 0.8 + rng() * 1.7, rng));
  }
  for (const [x, z] of [[-7, 6], [17, 14], [35, -12], [-30, 18]]) bannerPole(parent, x, z, rng() > 0.5 ? MATERIALS.clothRed : MATERIALS.clothTeal);

  // The wrecked pirate camp to the north-west.
  const campX = -10, campZ = -30;
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + 0.4;
    const tx = campX + Math.cos(a) * 5.5, tz = campZ + Math.sin(a) * 5.5;
    const ty = heightAt(tx, tz);
    addMesh(parent, cone(2.4, 1.8, 5), MATERIALS.banner, { x: tx, y: ty + 1.5, z: tz, ry: a, rz: 0.05, cast: true });
    addMesh(parent, cyl(0.07, 0.09, 2.4, 4), MATERIALS.woodDark, { x: tx + 1.6, y: ty + 1.2, z: tz + 0.8 });
  }
  for (const [ox, oz] of [[-8, -4], [8, 3], [4, -7], [-12, 2]]) {
    const x = campX + ox, z = campZ + oz;
    const y = heightAt(x, z);
    addMesh(parent, box(1.0, 0.9, 1.0), MATERIALS.woodDark, { x, y: y + 0.45, z, ry: rng() * TAU });
    addMesh(parent, box(0.9, 0.9, 1.1), MATERIALS.wood, { x: x + 1.1, y: y + 0.45, z, ry: rng() * TAU });
    colliders.push({ x, z, r: 1.1, type: 'crate' });
  }
  addMesh(parent, cyl(0.08, 0.1, 4.0, 5), MATERIALS.woodDark, { x: campX, y: heightAt(campX, campZ) + 2, z: campZ });
  addMesh(parent, box(0.06, 2.0, 1.5), MATERIALS.banner, { x: campX + 0.5, y: heightAt(campX, campZ) + 3.1, z: campZ, cast: false });

  // Treasure chest behind the village, and a second at the far shore.
  const chest = chestModel(7.5, -17);
  chest.group.rotation.y = 2.3;

  // Floating dust motes are handled by the effects layer.
  return { dock: dockInfo, fire, chest };
}

function dressEmber(parent, rng, colliders) {
  const isl = ISLAND_BY_ID.ember;
  const palmSpots = safeScatter(isl, rng, 10, {
    minH: 2, maxH: 12, maxSlope: 0.7, avoid: [{ x: 238, z: -38 }], minR: 15, inner: 0.35, outer: 0.9,
  });
  palmSpots.forEach(p => {
    const c = palm(parent, p.x, p.z, 0.65 + rng() * 0.3, rng, 1);
    colliders.push({ x: c.x, z: c.z, r: c.r, type: 'tree' });
  });
  for (let i = 0; i < 26; i++) {
    const p = safeScatter(isl, rng, 1, { minH: 0.5, maxH: 30, maxSlope: 1.2, avoid: [{ x: 238, z: -38 }], minR: 12, inner: 0.1, outer: 0.9 })[0];
    if (p) colliders.push(rock(parent, p.x, p.z, 0.8 + rng() * 1.8, rng, rng() > 0.45 ? MATERIALS.obsidian : MATERIALS.ash));
  }
  // Dead, charred trees.
  for (let i = 0; i < 14; i++) {
    const p = safeScatter(isl, rng, 1, { minH: 1, maxH: 26, maxSlope: 0.9, avoid: [{ x: 238, z: -38 }], minR: 14, inner: 0.2, outer: 0.9 })[0];
    if (!p) continue;
    const g = groupAt(p.x, p.h, p.z);
    const h = 3 + rng() * 3;
    addMesh(g, cyl(0.12, 0.26, h, 5), MATERIALS.obsidian, { y: h / 2, rz: (rng() - 0.5) * 0.25 });
    for (let b = 0; b < 4; b++) {
      const a = rng() * TAU, bl = 1.0 + rng() * 1.6;
      addMesh(g, cyl(0.04, 0.1, bl, 4), MATERIALS.obsidian, {
        x: Math.cos(a) * bl * 0.35, y: h * (0.55 + rng() * 0.35), z: Math.sin(a) * bl * 0.35,
        rz: Math.PI / 2 - 0.5 + rng(), ry: a,
      });
    }
    parent.add(g);
  }
  // Lava pools and molten cracks.
  const lavaSpots = [[214, -79], [247, -70], [216, -33], [244, -27], [229, -92]];
  lavaSpots.forEach(([x, z], i) => {
    const y = heightAt(x, z);
    if (y < 0.5) return;
    const g = groupAt(x, y + 0.06, z);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(2.4 + rng() * 2, 9), MATERIALS.lava);
    pool.rotation.x = -Math.PI / 2;
    pool.scale.set(1.4, 0.7, 1);
    pool.receiveShadow = false;
    g.add(pool);
    const glow = new THREE.PointLight(0xff4c10, 7, 15, 2);
    glow.position.y = 1.4;
    g.add(glow);
    // obsidian rim
    for (let j = 0; j < 7; j++) {
      const a = (j / 7) * TAU;
      addMesh(g, new THREE.DodecahedronGeometry(0.5 + rng() * 0.4, 0), MATERIALS.obsidian, {
        x: Math.cos(a) * (2.8 + rng()), y: 0.1, z: Math.sin(a) * (1.6 + rng() * 0.8), ry: a,
      });
    }
    parent.add(g);
  });
  // Boss arena: stone ring and braziers.
  const bx = 238, bz = -38, by = heightAt(bx, bz);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    const x = bx + Math.cos(a) * 12.5, z = bz + Math.sin(a) * 12.5;
    const y = heightAt(x, z);
    addMesh(parent, cyl(0.7, 0.95, 2.6 + rng() * 1.4, 6), MATERIALS.obsidian, { x, y: y + 1.2, z, ry: a });
    if (i % 2 === 0) {
      addMesh(parent, box(0.16, 1.6, 1.0), MATERIALS.banner, { x: x + Math.cos(a) * 0.4, y: y + 3.0, z: z + Math.sin(a) * 0.4, ry: -a, cast: false });
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.3, 5), new THREE.MeshBasicMaterial({
        color: 0xff7a22, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      flame.position.set(x, y + 3.9, z);
      parent.add(flame);
    }
  }
  // arena floor tint
  const floor = new THREE.Mesh(new THREE.CircleGeometry(12.2, 24), new THREE.MeshStandardMaterial({
    color: 0x3b2f2f, roughness: 0.9, metalness: 0.1,
  }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(bx, by + 0.08, bz);
  floor.receiveShadow = true;
  parent.add(floor);

  // Boss altar chest.
  const chest = chestModel(238, -49);
  chest.group.rotation.y = 0;
  chest.group.visible = false;

  // Ruined arch near the landing beach.
  const ax = 196, az = -53, ay = heightAt(ax, az);
  for (const s of [-1, 1]) {
    addMesh(parent, cyl(0.8, 1.1, 5.5, 6), MATERIALS.ash, { x: ax + s * 2.6, y: ay + 2.6, z: az });
    addMesh(parent, new THREE.DodecahedronGeometry(0.9, 0), MATERIALS.obsidian, { x: ax + s * 2.6, y: ay + 5.3, z: az });
  }
  addMesh(parent, box(6.4, 0.9, 1.2), MATERIALS.ash, { x: ax, y: ay + 5.5, z: az });
  return { chest, arena: { x: bx, z: bz, y: by } };
}

function coneflame(x, y, z) {
  const geo = new THREE.ConeGeometry(0.5, 1.4, 5);
  const m = new THREE.Mesh(geo);
  m.position.set(x, y, z);
  return m;
}

function dressWild(parent, isl, rng, colliders) {
  const palms = safeScatter(isl, rng, isl.id === 'spire' ? 12 : 8, {
    minH: 1.2, maxH: 16, maxSlope: 0.85, minR: 0, inner: 0.15, outer: 0.9,
  });
  palms.forEach(p => {
    const c = palm(parent, p.x, p.z, 0.7 + rng() * 0.4, rng, 0);
    colliders.push({ x: c.x, z: c.z, r: c.r, type: 'tree' });
  });
  for (let i = 0; i < 18; i++) {
    const p = safeScatter(isl, rng, 1, { minH: 0.8, maxH: 24, maxSlope: 1.4, minR: 0, inner: 0.1, outer: 0.9 })[0];
    if (p) colliders.push(rock(parent, p.x, p.z, 1 + rng() * 2.6, rng));
  }
  // old watchtower on Gullspire
  if (isl.id === 'spire') {
    const x = isl.x + 8, z = isl.z - 6, y = heightAt(x, z);
    for (const [ox, oz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
      addMesh(parent, cyl(0.18, 0.26, 7.5, 5), MATERIALS.woodDark, { x: x + ox, y: y + 3.7, z: z + oz, rz: ox * 0.02 });
    }
    addMesh(parent, box(5.4, 0.3, 5.4), MATERIALS.wood, { x, y: y + 7.5, z });
    addMesh(parent, cone(4.2, 2.4, 4), MATERIALS.strawDark, { x, y: y + 8.8, z });
    for (const [ox, oz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
      addMesh(parent, cyl(0.06, 0.06, 1.6, 4), MATERIALS.wood, { x: x + ox, y: y + 8.2, z: z + oz, cast: false });
    }
  }
}

/* ------------------------------------------------------------------ */
/*  World entry point                                                  */
/* ------------------------------------------------------------------ */

export function buildWorld(scene) {
  scene.fog = new THREE.FogExp2(0xbfe4df, 0.00155);
  scene.background = new THREE.Color(0x9adade);

  const sunDir = new THREE.Vector3(0.62, 0.46, -0.38).normalize();
  const sky = makeSky(scene, sunDir);
  const rng = mulberry32(1337);
  const clouds = makeClouds(scene, rng);
  const water = makeWater(scene, sunDir);

  // Lighting: warm late-afternoon sun, cool sky bounce.
  const hemi = new THREE.HemisphereLight(0xcdeeff, 0x477a63, 1.15);
  scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(0xffe1b0, 2.7);
  sunLight.position.copy(sunDir).multiplyScalar(150);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1536, 1536);
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 380;
  sunLight.shadow.camera.left = -90;
  sunLight.shadow.camera.right = 90;
  sunLight.shadow.camera.top = 90;
  sunLight.shadow.camera.bottom = -90;
  sunLight.shadow.bias = -0.0007;
  sunLight.shadow.normalBias = 0.05;
  scene.add(sunLight, sunLight.target);
  const fill = new THREE.DirectionalLight(0x7bc4d8, 0.55);
  fill.position.set(-80, 40, 80);
  scene.add(fill);

  for (const isl of ISLANDS) buildIsland(scene, isl);

  const colliders = [];
  const staticGroup = new THREE.Group();
  scene.add(staticGroup);
  const home = dressHome(staticGroup, rng, colliders);
  const ember = dressEmber(staticGroup, rng, colliders);
  for (const id of ['spire', 'veil']) dressWild(staticGroup, ISLAND_BY_ID[id], rng, colliders);
  const grass = ISLANDS.map(i => grassField(scene, i, rng));
  const bakedTris = bakeStatic(scene, staticGroup);

  // Animated landmarks stay outside the static batch.
  scene.add(home.fire.group);
  scene.add(home.chest.group);
  scene.add(ember.chest.group);
  const forgeGlow = new THREE.PointLight(0xff6a20, 6, 12, 2);
  forgeGlow.position.set(0, heightAt(0, 13) + 1.6, 13);
  scene.add(forgeGlow);

  const boat = boatModel();
  const boatPos = new THREE.Vector3(59, 0.35, 6.2);
  boat.position.copy(boatPos);
  boat.rotation.y = Math.PI + 0.16;
  scene.add(boat);

  // Waterfall of light motes around the village: tiny emissive quads are added
  // by the particle layer in main.js; here we only return anchors.

  const landmarks = {
    spawn: { x: 23.5, z: 8.5, yaw: -Math.PI / 2 + 0.10 },
    npc: { x: 31.5, z: 4.0 },
    chest: home.chest,
    campfire: home.fire,
    dock: home.dock,
    boat,
    boatPos,
    emberChest: ember.chest,
    bossArena: ember.arena,
    rogueCamp: { x: -10, z: -30 },
    forge: { x: 0, z: 13 },
  };

  const homeSpawns = [
    [-18, -22], [-25, -10], [-6, -35], [4, -31], [-28, -28], [-16, -38], [12, -32], [22, -25],
  ].map(([x, z]) => ({ x, z }));

  const emberSpawns = [
    [201, -61], [212, -45], [224, -70], [246, -55], [239, -28], [205, -84],
  ].map(([x, z]) => ({ x, z }));

  return {
    islands: ISLANDS,
    heightAt,
    colliders,
    water,
    sky,
    sunLight,
    sunDir,
    clouds,
    landmarks,
    homeSpawns,
    emberSpawns,
    bakedTris,
    update(time) {
      sky.uniforms.uTime.value = time;
      water.uniforms.uTime.value = time;
      water.uniforms.uSunDir.value.copy(sunDir);
      clouds.rotation.y = time * 0.0018;
      // Keep the shadow frustum centred on the action.
      sunLight.target.position.set(0, 0, 0);
    },
  };
}
