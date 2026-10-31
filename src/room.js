import * as THREE from '../vendor/three.module.js';
import * as TX from './textures.js';

export const ROOM_W = 9;
export const ROOM_D = 8;
export const ROOM_H = 3.2;

const SPECIAL = {
  10: 'rush', 20: 'ambush', 30: 'seek', 40: 'rush',
  50: 'library', 60: 'halt', 70: 'ambush', 80: 'seek',
  90: 'rush', 100: 'finale',
};

function rand(n, salt) {
  const x = Math.sin(n * 127.1 + salt * 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

export function makeConfig(n) {
  let type = SPECIAL[n] || 'standard';
  if (!SPECIAL[n]) {
    if (n === 4 || n === 7) type = 'dark';
    else if (n === 5 || n === 8) type = 'locked';
    else if (n === 3) type = 'standard';
    else if (n === 49) type = 'supply';
    else if (n <= 9) type = 'standard';
    else {
      const r = rand(n, 7);
      if (r < 0.17) type = 'dark';
      else if (r < 0.31) type = 'locked';
      else if (r < 0.385) type = 'rush';
      else if (r < 0.425) type = 'ambush';
      else if (r < 0.455) type = 'halt';
      else type = 'standard';
    }
  }
  if (n === 51) type = 'standard';

  const seek = type === 'seek';
  const halt = type === 'halt';
  const library = type === 'library';
  const finale = type === 'finale';
  const width = library ? 16 : seek ? 5.6 : halt ? 5.2 : finale ? 10 : 9;
  const depth = library ? 16 : seek ? 64 : halt ? 24 : finale ? 10 : 8;
  const height = library ? 4.2 : seek || halt ? 3.4 : finale ? 3.6 : 3.2;
  const palette = library ? 0 : seek ? 4 : halt ? 1 : finale ? 0 : Math.floor(rand(n, 3) * 5);
  const locked = type === 'locked' || (type === 'standard' && rand(n, 8) < 0.16) || (type === 'rush' && rand(n, 9) < 0.12);

  const titles = {
    standard: 'HOTEL ROOM', dark: 'DARK ROOM', locked: 'LOCKED ROOM', rush: 'THE HALL',
    ambush: 'THE HALL', halt: 'DINING HALL', seek: 'SERVICE TUNNEL', library: 'THE LIBRARY',
    finale: 'THE LAST DOOR', supply: 'SUPPLY ROOM',
  };

  return {
    n, type, width, depth, height, palette, locked, seed: n,
    title: titles[type] || 'HOTEL ROOM',
    exitNumber: n === 100 ? 100 : n + 1,
    chapter: library,
  };
}

/* ------------------------------------------------------------------ */
/* shared geometry + materials                                         */
/* ------------------------------------------------------------------ */

const geoCache = new Map();
function cachedGeo(key, make) {
  let g = geoCache.get(key);
  if (!g) { g = make(); geoCache.set(key, g); }
  return g;
}
const boxGeo = (w, h, d) => cachedGeo(`b${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}`, () => new THREE.BoxGeometry(w, h, d));
const cylGeo = (rt, rb, h, seg = 14) => cachedGeo(`c${rt}|${rb}|${h}|${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
const sphGeo = (r, seg = 16) => cachedGeo(`s${r}|${seg}`, () => new THREE.SphereGeometry(r, seg, seg));
const planeGeo = (w, h) => cachedGeo(`p${w}|${h}`, () => new THREE.PlaneGeometry(w, h));
const coneGeo = (r, h, seg = 16) => cachedGeo(`k${r}|${h}|${seg}`, () => new THREE.ConeGeometry(r, h, seg));
const torusGeo = (r, tube, rad = 8, seg = 20) => cachedGeo(`t${r}|${tube}|${rad}|${seg}`, () => new THREE.TorusGeometry(r, tube, rad, seg));

const matCache = new Map();
function cachedMat(key, make) {
  let m = matCache.get(key);
  if (!m) { m = make(); matCache.set(key, m); }
  return m;
}

const mWall = (v) => cachedMat(`wall${v}`, () => new THREE.MeshStandardMaterial({ map: TX.wallpaper(v), roughness: 0.94, metalness: 0.02 }));
const mCarpet = (v) => cachedMat(`carpet${v}`, () => new THREE.MeshStandardMaterial({ map: TX.carpet(v), roughness: 1, metalness: 0 }));
const mCeiling = () => cachedMat('ceil', () => new THREE.MeshStandardMaterial({ map: TX.ceiling(), roughness: 0.96 }));
const mWood = (tone = 'warm') => cachedMat(`wood-${tone}`, () => new THREE.MeshStandardMaterial({ map: TX.wood(tone), roughness: 0.72, metalness: 0.04 }));
const mTrim = () => cachedMat('trim', () => new THREE.MeshStandardMaterial({ color: 0x24160e, roughness: 0.68, metalness: 0.08 }));
const mDarkWood = () => cachedMat('darkwood', () => new THREE.MeshStandardMaterial({ map: TX.wood('dark'), roughness: 0.7 }));
const mBrass = () => cachedMat('brass', () => new THREE.MeshStandardMaterial({ color: 0xb08d4a, roughness: 0.3, metalness: 0.85 }));
const mBlack = () => cachedMat('black', () => new THREE.MeshStandardMaterial({ color: 0x0a0908, roughness: 0.9 }));
const mIron = () => cachedMat('iron', () => new THREE.MeshStandardMaterial({ color: 0x2a2a28, roughness: 0.55, metalness: 0.7 }));
const mFabric = (hex) => cachedMat(`fab-${hex}`, () => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.97 }));
const mShade = () => cachedMat('shade', () => new THREE.MeshStandardMaterial({ color: 0xf1ddb0, emissive: 0xffc06a, emissiveIntensity: 0.75, roughness: 0.75, side: THREE.DoubleSide }));
const mBulb = () => cachedMat('bulb', () => new THREE.MeshBasicMaterial({ color: 0xffe6b0, toneMapped: false }));
const mPlaque = (n, label = '') => cachedMat(`plaque-${n}-${label}`, () => new THREE.MeshStandardMaterial({ map: TX.plaque(n, label), metalness: 0.6, roughness: 0.38 }));
const mPainting = (seed) => cachedMat(`paint-${seed % 7}`, () => new THREE.MeshStandardMaterial({ map: TX.painting(seed), roughness: 0.85 }));
const mBook = (seed) => cachedMat(`book-${seed % 5}`, () => new THREE.MeshStandardMaterial({ map: TX.books(seed), roughness: 0.92 }));
const mCloth = () => cachedMat('cloth', () => new THREE.MeshStandardMaterial({ map: TX.tablecloth(), roughness: 0.96 }));
const mElevator = () => cachedMat('elev', () => new THREE.MeshStandardMaterial({ map: TX.elevator(), metalness: 0.78, roughness: 0.42 }));
const mWindow = () => cachedMat('window', () => new THREE.MeshBasicMaterial({ map: TX.windowNight(), toneMapped: false }));
const mExit = () => cachedMat('exit', () => new THREE.MeshBasicMaterial({ map: TX.exitSign(), toneMapped: false }));
const mSign = (text, color = '#d8c79c', bg = '#0b0a08') => cachedMat(`sign-${text}-${color}-${bg}`, () => new THREE.MeshBasicMaterial({ map: TX.sign(text, color, bg), toneMapped: false }));
const mFace = (kind) => cachedMat(`face-${kind}`, () => new THREE.MeshBasicMaterial({ map: TX.face(kind), transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
const mKey = () => cachedMat('keymat', () => new THREE.MeshStandardMaterial({ color: 0xe3bd66, metalness: 0.9, roughness: 0.24, emissive: 0x7a5516, emissiveIntensity: 0.6 }));
const mBattery = () => cachedMat('battery', () => new THREE.MeshStandardMaterial({ color: 0x4a7a52, metalness: 0.5, roughness: 0.4, emissive: 0x1d3a22, emissiveIntensity: 0.4 }));
const mBandage = () => cachedMat('bandage', () => new THREE.MeshStandardMaterial({ color: 0xd8cfb8, roughness: 0.9 }));
const mRed = () => cachedMat('redmat', () => new THREE.MeshStandardMaterial({ color: 0x8f2b25, roughness: 0.7 }));
const mMirror = () => cachedMat('mirror', () => new THREE.MeshStandardMaterial({ color: 0x5a6666, metalness: 0.9, roughness: 0.18 }));

function glowSprite(color = 0xffd9a0, scale = 1) {
  const mat = new THREE.SpriteMaterial({
    map: TX.glow(), color, transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(scale, scale, 1);
  return sprite;
}

/* ------------------------------------------------------------------ */
/* Room                                                                */
/* ------------------------------------------------------------------ */

export class Room {
  constructor(config, game) {
    this.config = config;
    this.game = game;
    this.n = config.n;
    this.type = config.type;
    this.width = config.width;
    this.depth = config.depth;
    this.height = config.height;
    this.palette = config.palette;
    this.group = new THREE.Group();
    this.group.name = `room-${config.n}`;
    this.colliders = [];
    this.interactables = [];
    this.hideSpots = [];
    this.lights = [];
    this.animated = [];
    this.timers = [];
    this.dust = null;
    this.exitDoor = null;
    this.exitItem = null;
    this.exitOpen = false;
    this.exitTriggered = false;
    this.locked = !!config.locked;
    this.sealed = false;
    this.lightsOn = true;
    this.flickerUntil = 0;
    this.time = 0;
    this.dark = false;
    this.objective = 'Open the next door.';
    this.bounds = {
      x1: -this.width / 2 + 0.09, x2: this.width / 2 - 0.09,
      z1: -this.depth / 2 + 0.09, z2: this.depth / 2 - 0.09,
    };
    this.ambientBase = 0.26;
    this.ambient = new THREE.HemisphereLight(0x9a8a70, 0x0a0806, this.ambientBase);
    this.group.add(this.ambient);
    this.haltPhase = 0;
    this.haltActive = false;
    this.haltDone = false;
    this.haltCooldown = 0;
    this.seekTriggered = false;
    this.build();
  }

  build() {
    switch (this.type) {
      case 'halt': this.buildHalt(); break;
      case 'seek': this.buildSeek(); break;
      case 'library': this.buildLibrary(); break;
      case 'finale': this.buildFinale(); break;
      default: this.buildHotelRoom(); break;
    }
  }

  /* ---------------- primitives ---------------- */

  addMesh(geo, mat, x, y, z, opts = {}) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    if (opts.rotY) mesh.rotation.y = opts.rotY;
    if (opts.rotX) mesh.rotation.x = opts.rotX;
    if (opts.rotZ) mesh.rotation.z = opts.rotZ;
    mesh.castShadow = opts.castShadow !== false;
    mesh.receiveShadow = opts.receiveShadow !== false;
    if (opts.parent) opts.parent.add(mesh);
    else this.group.add(mesh);
    return mesh;
  }

  addBox(w, h, d, mat, x, y, z, opts = {}) {
    return this.addMesh(boxGeo(w, h, d), mat, x, y, z, opts);
  }

  addCollider(x1, x2, z1, z2, minY = 0, maxY = this.height) {
    const c = { x1: Math.min(x1, x2), x2: Math.max(x1, x2), z1: Math.min(z1, z2), z2: Math.max(z1, z2), minY, maxY, disabled: false };
    this.colliders.push(c);
    return c;
  }

  addBoxCollider(x, z, w, d, rotY = 0, minY = 0, maxY = this.height) {
    const c = Math.abs(Math.cos(rotY)), s = Math.abs(Math.sin(rotY));
    const hw = (w * c + d * s) / 2;
    const hd = (w * s + d * c) / 2;
    return this.addCollider(x - hw, x + hw, z - hd, z + hd, minY, maxY);
  }

  addInteractable(type, position, radius, label, onUse, extra = {}) {
    const item = {
      type, position: position.clone(), radius, label, onUse, enabled: true,
      locked: false, ...extra,
    };
    this.interactables.push(item);
    return item;
  }

  after(seconds, fn) {
    this.timers.push({ t: seconds, fn });
  }

  /* ---------------- shell ---------------- */

  buildShell({ palette = this.palette, exitKind = 'door', exitOpen = false, exitNumber = this.n + 1, exitLabel = '', entryNumber = this.n, signs = [] } = {}) {
    const w = this.width, d = this.depth, h = this.height;
    const wallMat = mWall(palette);
    const carpetMat = mCarpet(palette);

    // floor + ceiling
    this.addBox(w, 0.14, d, carpetMat, 0, -0.07, 0, { receiveShadow: true, castShadow: false });
    this.addBox(w, 0.12, d, mCeiling(), 0, h + 0.06, 0, { receiveShadow: true, castShadow: false });

    // side walls
    this.addBox(0.18, h, d, wallMat, -w / 2 - 0.09, h / 2, 0);
    this.addBox(0.18, h, d, wallMat, w / 2 + 0.09, h / 2, 0);
    this.addCollider(-w / 2 - 0.3, -w / 2 + 0.02, -d / 2, d / 2);
    this.addCollider(w / 2 - 0.02, w / 2 + 0.3, -d / 2, d / 2);

    // entry wall (+Z)
    this.addBox(w, h, 0.18, wallMat, 0, h / 2, d / 2 + 0.09);
    this.addCollider(-w / 2, w / 2, d / 2 - 0.02, d / 2 + 0.3);

    // exit wall (-Z)
    const openW = 1.52;
    const openH = 2.28;
    if (exitKind === 'elevator') {
      this.addBox(w, h, 0.18, wallMat, 0, h / 2, -d / 2 - 0.09);
      this.addCollider(-w / 2, w / 2, -d / 2 - 0.3, -d / 2 + 0.02);
    } else {
      const segW = (w - openW) / 2;
      this.addBox(segW, h, 0.18, wallMat, -(openW / 2 + segW / 2), h / 2, -d / 2 - 0.09);
      this.addBox(segW, h, 0.18, wallMat, openW / 2 + segW / 2, h / 2, -d / 2 - 0.09);
      this.addBox(openW, h - openH, 0.18, wallMat, 0, openH + (h - openH) / 2, -d / 2 - 0.09);
      this.addCollider(-w / 2, -openW / 2, -d / 2 - 0.3, -d / 2 + 0.02);
      this.addCollider(openW / 2, w / 2, -d / 2 - 0.3, -d / 2 + 0.02);
      this.addCollider(-openW / 2, openW / 2, -d / 2 - 0.3, -d / 2 + 0.02, openH, h);
    }

    // wainscoting / base / crown
    const trim = mTrim();
    const wainH = 0.92, wainY = 0.48;
    this.addBox(0.07, wainH, d - 0.1, trim, -w / 2 + 0.05, wainY, 0, { castShadow: false });
    this.addBox(0.07, wainH, d - 0.1, trim, w / 2 - 0.05, wainY, 0, { castShadow: false });
    this.addBox(w - 0.1, wainH, 0.07, trim, 0, wainY, d / 2 - 0.05, { castShadow: false });
    const sideSeg = (w - openW) / 2;
    this.addBox(sideSeg, wainH, 0.07, trim, -(openW / 2 + sideSeg / 2), wainY, -d / 2 + 0.05, { castShadow: false });
    this.addBox(sideSeg, wainH, 0.07, trim, openW / 2 + sideSeg / 2, wainY, -d / 2 + 0.05, { castShadow: false });
    // chair rail
    const rail = mDarkWood();
    this.addBox(0.06, 0.05, d - 0.08, rail, -w / 2 + 0.09, 1.0, 0, { castShadow: false });
    this.addBox(0.06, 0.05, d - 0.08, rail, w / 2 - 0.09, 1.0, 0, { castShadow: false });
    this.addBox(w - 0.08, 0.05, 0.06, rail, 0, 1.0, d / 2 - 0.09, { castShadow: false });
    this.addBox(sideSeg, 0.05, 0.06, rail, -(openW / 2 + sideSeg / 2), 1.0, -d / 2 + 0.09, { castShadow: false });
    this.addBox(sideSeg, 0.05, 0.06, rail, openW / 2 + sideSeg / 2, 1.0, -d / 2 + 0.09, { castShadow: false });
    // baseboards
    this.addBox(0.05, 0.14, d - 0.06, trim, -w / 2 + 0.05, 0.07, 0, { castShadow: false });
    this.addBox(0.05, 0.14, d - 0.06, trim, w / 2 - 0.05, 0.07, 0, { castShadow: false });
    this.addBox(w - 0.06, 0.14, 0.05, trim, 0, 0.07, d / 2 - 0.05, { castShadow: false });
    this.addBox(sideSeg, 0.14, 0.05, trim, -(openW / 2 + sideSeg / 2), 0.07, -d / 2 + 0.05, { castShadow: false });
    this.addBox(sideSeg, 0.14, 0.05, trim, openW / 2 + sideSeg / 2, 0.07, -d / 2 + 0.05, { castShadow: false });
    // crown
    this.addBox(0.09, 0.12, d - 0.05, trim, -w / 2 + 0.06, h - 0.1, 0, { castShadow: false });
    this.addBox(0.09, 0.12, d - 0.05, trim, w / 2 - 0.06, h - 0.1, 0, { castShadow: false });
    this.addBox(w - 0.05, 0.12, 0.09, trim, 0, h - 0.1, d / 2 - 0.06, { castShadow: false });
    this.addBox(w - 0.05, 0.12, 0.09, trim, 0, h - 0.1, -d / 2 + 0.06, { castShadow: false });

    // entry door (sealed)
    this.buildDoor({
      x: 0, z: d / 2 - 0.1, rotY: Math.PI, number: entryNumber, width: 1.32, height: 2.22,
      interactive: false, collider: false, sealed: true,
    });

    if (exitKind === 'elevator') {
      this.buildElevator(0, -d / 2 + 0.16);
      this.addSign('ELEVATOR', 0, 2.65, -d / 2 + 0.06, 0, '#c9a961', '#0b0a08', 1.5, 0.38);
    } else {
      // exit door
      this.exitDoor = this.buildDoor({
        x: 0, z: -d / 2 + 0.1, rotY: 0, number: exitNumber, width: 1.32, height: 2.22,
        locked: this.locked, open: exitOpen, label: exitLabel,
      });
      if (exitOpen) { this.exitOpen = true; }
      const exitSign = this.addMesh(planeGeo(0.9, 0.45), mExit(), 0, 2.58, -d / 2 + 0.02, { castShadow: false });
      exitSign.material.toneMapped = false;
      const glow = glowSprite(0x86e8a8, 1.1);
      glow.position.set(0, 2.58, -d / 2 + 0.1);
      this.group.add(glow);
      const green = new THREE.PointLight(0x6fe09a, 1.6, 3.4, 2);
      green.position.set(0, 2.4, -d / 2 + 0.5);
      this.group.add(green);

      this.exitItem = this.addInteractable('door', new THREE.Vector3(0, 1.1, -d / 2 + 0.72), 2.5, 'OPEN DOOR', () => this.useExitDoor());
      this.exitItem.locked = !!this.locked;
      if (this.locked) this.exitItem.label = 'UNLOCK DOOR';
      if (exitOpen) this.exitItem.enabled = false;
    }

    // signs
    for (const s of signs) this.addSign(s.text, s.x, s.y, s.z, s.rotY || 0, s.color, s.bg, s.w || 1.4, s.h || 0.36);

    // dust
    this.addDust();
  }

  addSign(text, x, y, z, rotY, color = '#c9a961', bg = '#0b0a08', w = 1.4, h = 0.36) {
    if (!text) return null;
    const mat = mSign(text, color, bg);
    const m = this.addMesh(planeGeo(w, h), mat, x, y, z, { rotY, castShadow: false, receiveShadow: false });
    return m;
  }

  buildDoor({ x, z, rotY = 0, number, width = 1.32, height = 2.22, locked = false, open = false, label = '', interactive = true, collider = true, sealed = false }) {
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    root.rotation.y = rotY;

    const frameMat = mDarkWood();
    const postW = 0.17;
    this.addBox(postW, height + 0.22, 0.24, frameMat, -(width / 2 + postW / 2), (height + 0.22) / 2, 0, { parent: root });
    this.addBox(postW, height + 0.22, 0.24, frameMat, width / 2 + postW / 2, (height + 0.22) / 2, 0, { parent: root });
    this.addBox(width + postW * 2, 0.19, 0.24, frameMat, 0, height + 0.11, 0, { parent: root });
    this.addBox(width + 0.16, 0.06, 0.28, mBrass(), 0, 0.03, 0, { parent: root });

    const pivot = new THREE.Group();
    pivot.position.set(-width / 2, 0, 0);
    root.add(pivot);

    const doorMat = mWood('warm');
    const panelMat = mDarkWood();
    const door = this.addBox(width, height, 0.095, doorMat, width / 2, height / 2, 0, { parent: pivot });
    door.castShadow = true;
    // panels
    for (const side of [-1, 1]) {
      for (const py of [height * 0.29, height * 0.7]) {
        this.addBox(width * 0.68, height * 0.26, 0.022, panelMat, width / 2, py, side * 0.058, { parent: pivot, castShadow: false });
      }
    }
    // number plaque
    const plaque = this.addMesh(planeGeo(0.42, 0.21), mPlaque(number, label), width / 2, height - 0.3, 0.058, { parent: pivot, castShadow: false, receiveShadow: false });
    plaque.material.toneMapped = false;
    // knob
    const knob = this.addMesh(sphGeo(0.042, 12), mBrass(), width - 0.16, 1.03, 0.085, { parent: pivot });
    knob.castShadow = true;
    this.addBox(0.075, 0.075, 0.02, mBrass(), width - 0.16, 1.03, 0.062, { parent: pivot, castShadow: false });
    const knob2 = this.addMesh(sphGeo(0.042, 12), mBrass(), width - 0.16, 1.03, -0.085, { parent: pivot });
    knob2.castShadow = true;

    let lockMesh = null;
    if (locked) {
      lockMesh = this.addBox(0.11, 0.15, 0.05, mIron(), width - 0.16, 1.2, 0.1, { parent: pivot, castShadow: false });
      const led = this.addMesh(sphGeo(0.018, 8), new THREE.MeshBasicMaterial({ color: 0xb02a22, toneMapped: false }), width - 0.16, 1.2, 0.128, { parent: pivot, castShadow: false });
      led.userData.led = true;
    }

    this.group.add(root);

    let doorCollider = null;
    if (collider) {
      const c = Math.abs(Math.cos(rotY)), s = Math.abs(Math.sin(rotY));
      const hw = (width * c + 0.22 * s) / 2;
      const hd = (width * s + 0.22 * c) / 2;
      doorCollider = this.addCollider(x - hw, x + hw, z - hd, z + hd, 0, height);
    }

    const obj = {
      root, pivot, width, height, number, locked, opened: open, sealed, label,
      collider: doorCollider,
      target: open ? -1.95 : 0,
      open() {
        if (this.opened) return;
        this.opened = true;
        this.target = -1.95;
        if (this.collider) this.collider.disabled = true;
      },
      close() {
        this.opened = false;
        this.target = 0;
        if (this.collider) this.collider.disabled = false;
      },
      setLocked(v) {
        this.locked = v;
        if (lockMesh) lockMesh.visible = v;
      },
      update(dt) {
        const diff = this.target - pivot.rotation.y;
        if (Math.abs(diff) > 0.0005) pivot.rotation.y += diff * Math.min(1, dt * 7);
      },
    };
    if (open) {
      pivot.rotation.y = -1.95;
      if (doorCollider) doorCollider.disabled = true;
    }
    return obj;
  }

  buildElevator(x, z) {
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    this.group.add(root);
    const metal = mElevator();
    const frame = mIron();
    // frame
    this.addBox(2.5, 3.0, 0.22, frame, 0, 1.5, 0, { parent: root });
    this.addBox(2.1, 2.55, 0.06, metal, 0, 1.42, 0.13, { parent: root, castShadow: false });
    // doors
    const left = this.addBox(0.98, 2.35, 0.09, metal, -0.5, 1.27, 0.17, { parent: root });
    const right = this.addBox(0.98, 2.35, 0.09, metal, 0.5, 1.27, 0.17, { parent: root });
    this.addBox(0.03, 2.35, 0.1, mBlack(), 0, 1.27, 0.23, { parent: root, castShadow: false });
    // call panel
    this.addBox(0.16, 0.36, 0.08, mBrass(), 1.35, 1.25, 0.18, { parent: root });
    const button = this.addMesh(sphGeo(0.035, 10), new THREE.MeshBasicMaterial({ color: 0xe8c477, toneMapped: false }), 1.35, 1.31, 0.235, { parent: root, castShadow: false });
    const indicator = this.addMesh(sphGeo(0.028, 8), new THREE.MeshBasicMaterial({ color: 0x7a1f18, toneMapped: false }), 1.35, 1.18, 0.235, { parent: root, castShadow: false });
    // top sign
    const sign = this.addMesh(planeGeo(1.4, 0.35), mSign('ELEVATOR', '#e2c98f', '#0b0a08'), 0, 2.82, 0.24, { parent: root, castShadow: false });
    sign.material.toneMapped = false;
    const glow = glowSprite(0xd8b96e, 1.5);
    glow.position.set(0, 1.4, 0.5);
    root.add(glow);
    const light = new THREE.PointLight(0xffd9a0, 3.2, 5, 2);
    light.position.set(0, 2.2, 0.8);
    root.add(light);
    this.lights.push({ light, base: 3.2, phase: 0 });

    this.elevator = { root, left, right, button, indicator, opened: false, t: 0 };
    this.addInteractable('elevator', new THREE.Vector3(x, 1.2, z + 1.05), 2.3, 'CALL ELEVATOR', () => this.callElevator());
  }

  callElevator() {
    if (!this.elevator || this.elevator.opened) return;
    this.elevator.opened = true;
    this.elevator.indicator.material.color.setHex(0x5fd07a);
    this.game.audio.elevatorDing();
    this.game.ui.toast('THE ELEVATOR IS HERE', 'The library lets you go.');
    this.objective = 'GET IN THE ELEVATOR';
    this.game.ui.setObjective(this.objective);
    this.after(1.5, () => {
      if (this.game.mode === 'playing') this.game.escapeLibrary();
    });
  }

  /* ---------------- lights ---------------- */

  addCeilingLamp(x, z, { intensity = 16, color = 0xffd6a0, castShadow = false, y = null, on = true } = {}) {
    const h = this.height;
    const root = new THREE.Group();
    root.position.set(x, y ?? h - 0.02, z);
    this.group.add(root);
    this.addMesh(cylGeo(0.12, 0.12, 0.05, 12), mBrass(), 0, -0.02, 0, { parent: root, castShadow: false });
    this.addMesh(cylGeo(0.018, 0.018, 0.42, 8), mIron(), 0, -0.23, 0, { parent: root, castShadow: false });
    this.addMesh(cylGeo(0.27, 0.11, 0.26, 16), mShade(), 0, -0.48, 0, { parent: root, castShadow: false });
    this.addMesh(sphGeo(0.065, 10), mBulb(), 0, -0.57, 0, { parent: root, castShadow: false });
    const light = new THREE.PointLight(color, intensity, Math.max(9, this.width * 1.3), 2);
    light.position.set(0, -0.62, 0);
    if (castShadow) {
      light.castShadow = true;
      light.shadow.mapSize.set(512, 512);
      light.shadow.bias = -0.002;
      light.shadow.normalBias = 0.02;
      light.shadow.camera.near = 0.2;
      light.shadow.camera.far = 14;
    }
    root.add(light);
    const glow = glowSprite(color, 1.8);
    glow.position.set(0, -0.58, 0);
    root.add(glow);
    this.lights.push({ light, base: on ? intensity : 0, phase: Math.random() * 6, glow });
    return light;
  }

  addSconce(x, y, z, rotY = 0, { intensity = 3.5, color = 0xffc27a } = {}) {
    const root = new THREE.Group();
    root.position.set(x, y, z);
    root.rotation.y = rotY;
    this.group.add(root);
    this.addMesh(boxGeo(0.12, 0.22, 0.06), mBrass(), 0, 0, 0.03, { parent: root, castShadow: false });
    this.addMesh(cylGeo(0.12, 0.06, 0.16, 12), mShade(), 0, 0.14, 0.1, { parent: root, castShadow: false });
    this.addMesh(sphGeo(0.04, 8), mBulb(), 0, 0.06, 0.1, { parent: root, castShadow: false });
    const light = new THREE.PointLight(color, intensity, 5.5, 2);
    light.position.set(0, 0.06, 0.2);
    root.add(light);
    const glow = glowSprite(color, 0.75);
    glow.position.set(0, 0.06, 0.18);
    root.add(glow);
    this.lights.push({ light, base: intensity, phase: Math.random() * 6, glow });
  }

  addWindow(x, y, z, rotY = 0, { dark = false } = {}) {
    const root = new THREE.Group();
    root.position.set(x, y, z);
    root.rotation.y = rotY;
    this.group.add(root);
    const frame = mDarkWood();
    this.addBox(1.9, 2.0, 0.08, frame, 0, 0, 0, { parent: root, castShadow: false });
    const glass = this.addMesh(planeGeo(1.68, 1.78), mWindow(), 0, 0, 0.06, { parent: root, castShadow: false, receiveShadow: false });
    glass.material.toneMapped = false;
    // muntins
    this.addBox(0.045, 1.78, 0.04, frame, 0, 0, 0.09, { parent: root, castShadow: false });
    this.addBox(1.68, 0.045, 0.04, frame, 0, 0, 0.09, { parent: root, castShadow: false });
    // curtains
    this.addBox(0.36, 2.3, 0.09, mFabric(0x3b2020), -1.06, 0.08, 0.18, { parent: root, castShadow: false });
    this.addBox(0.36, 2.3, 0.09, mFabric(0x3b2020), 1.06, 0.08, 0.18, { parent: root, castShadow: false });
    this.addBox(2.55, 0.12, 0.12, mBrass(), 0, 1.2, 0.2, { parent: root, castShadow: false });
    if (dark) {
      const moon = new THREE.PointLight(0x6f92b8, 4.5, 8, 2);
      moon.position.set(0, 0.2, 0.9);
      root.add(moon);
      this.lights.push({ light: moon, base: 4.5, phase: 2, window: true });
    }
  }

  addDust(count = 130) {
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * (this.width - 0.8);
      positions[i * 3 + 1] = 0.2 + Math.random() * (this.height - 0.6);
      positions[i * 3 + 2] = (Math.random() - 0.5) * (this.depth - 0.8);
      phases[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      map: TX.dust(), size: 0.032, transparent: true, opacity: 0.42,
      depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffe4b0, sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this.group.add(points);
    this.dust = { points, positions, base: positions.slice(), phases, count };
  }

  /* ---------------- furniture ---------------- */

  addRug(x, z, w = 4.6, d = 3.2, variant = null) {
    const mat = mCarpet(variant ?? ((this.palette + 2) % 5));
    const rug = this.addMesh(planeGeo(w, d), mat, x, 0.009, z, { rotX: -Math.PI / 2, castShadow: false });
    rug.receiveShadow = true;
    return rug;
  }

  addBed(x, z, rotY = 0, blanketHex = 0x5a2727, openSide = '+x') {
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    root.rotation.y = rotY;
    this.group.add(root);
    const wood = mWood('dark');
    const blanket = mFabric(blanketHex);
    const sheet = mFabric(0xcfc3a8);
    const skirt = mFabric(0x2b1d17);

    // legs and rails
    for (const lx of [-0.66, 0.66]) for (const lz of [-0.94, 0.94]) {
      this.addMesh(boxGeo(0.1, 0.32, 0.1), wood, lx, 0.16, lz, { parent: root });
    }
    this.addBox(1.48, 0.12, 2.02, wood, 0, 0.32, 0, { parent: root });
    this.addBox(1.52, 0.3, 0.1, wood, 0, 0.47, 1.0, { parent: root });
    this.addBox(1.52, 0.3, 0.1, wood, 0, 0.47, -1.0, { parent: root });
    // mattress
    this.addBox(1.44, 0.26, 1.94, sheet, 0, 0.53, 0, { parent: root });
    // blanket
    this.addBox(1.5, 0.1, 1.55, blanket, 0, 0.68, -0.18, { parent: root });
    this.addBox(1.5, 0.26, 0.12, blanket, 0, 0.58, -0.94, { parent: root });
    // pillows
    for (const px of [-0.36, 0.36]) {
      this.addBox(0.56, 0.16, 0.34, sheet, px, 0.72, 0.68, { parent: root, rotZ: px * 0.08 });
    }
    // headboard
    this.addBox(1.6, 0.95, 0.09, wood, 0, 0.82, 1.05, { parent: root });
    this.addBox(1.44, 0.6, 0.03, mFabric(0x3a2a22), 0, 0.9, 1.11, { parent: root, castShadow: false });
    // skirt, leaving one side open for hiding
    const skirtY = 0.38;
    this.addBox(0.02, 0.55, 1.98, skirt, openSide === '-x' ? 0.73 : -0.73, skirtY, 0, { parent: root, castShadow: false });
    this.addBox(1.44, 0.55, 0.02, skirt, 0, skirtY, 0.99, { parent: root, castShadow: false });
    this.addBox(1.44, 0.55, 0.02, skirt, 0, skirtY, -0.99, { parent: root, castShadow: false });

    this.addBoxCollider(x, z, 1.62, 2.16, rotY, 0, 0.98);

    const side = openSide === '+x' ? 1 : -1;
    const localStand = new THREE.Vector3(side * 1.18, 0, 0);
    const localCam = new THREE.Vector3(side * 0.43, 0.34, 0);
    const stand = this.localToWorld(localStand, x, z, rotY);
    const cam = this.localToWorld(localCam, x, z, rotY);
    const yaw = rotY + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
    const spot = {
      type: 'bed', stand, camera: cam, eye: 0.34, yaw, exitYaw: yaw,
      label: 'UNDER THE BED',
    };
    this.hideSpots.push(spot);
    const item = this.addInteractable('hide', stand, 2.0, 'HIDE UNDER BED', () => this.game.player.enterHide(spot), { spot });
    spot.item = item;
    return root;
  }

  addWardrobe(x, z, rotY = 0) {
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    root.rotation.y = rotY;
    this.group.add(root);
    const wood = mWood('warm');
    const dark = mDarkWood();
    // carcass
    this.addBox(1.38, 2.28, 0.08, dark, 0, 1.14, -0.32, { parent: root });
    this.addBox(0.08, 2.28, 0.7, wood, -0.69, 1.14, 0, { parent: root });
    this.addBox(0.08, 2.28, 0.7, wood, 0.69, 1.14, 0, { parent: root });
    this.addBox(1.46, 0.1, 0.76, wood, 0, 2.3, 0, { parent: root });
    this.addBox(1.46, 0.1, 0.76, wood, 0, 0.05, 0, { parent: root });
    this.addBox(1.28, 2.1, 0.03, mBlack(), 0, 1.12, -0.25, { parent: root, castShadow: false });
    // hanging rail
    this.addMesh(cylGeo(0.015, 0.015, 1.1, 8), mBrass(), 0, 1.86, 0, { parent: root, rotZ: Math.PI / 2, castShadow: false });
    // two slatted doors
    const makeDoor = (dir) => {
      const pivot = new THREE.Group();
      pivot.position.set(dir * 0.69, 0, 0.33);
      root.add(pivot);
      const inner = new THREE.Group();
      inner.position.set(-dir * 0.345, 0, 0);
      pivot.add(inner);
      for (let i = 0; i < 5; i++) {
        const y = 0.26 + i * 0.42;
        this.addBox(0.66, 0.36, 0.045, wood, 0, y, 0, { parent: inner });
      }
      this.addBox(0.05, 2.1, 0.05, dark, -dir * 0.31, 1.14, 0, { parent: inner, castShadow: false });
      return pivot;
    };
    const leftDoor = makeDoor(-1);
    const rightDoor = makeDoor(1);
    this.addBoxCollider(x, z, 1.52, 0.84, rotY, 0, 2.34);

    const front = new THREE.Vector3(0, 0, 1);
    const worldFront = front.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
    const stand = new THREE.Vector3(x + worldFront.x * 1.02, 0, z + worldFront.z * 1.02);
    const cam = new THREE.Vector3(x + worldFront.x * 0.05, 1.36, z + worldFront.z * 0.05);
    const yaw = rotY;
    const spot = {
      type: 'wardrobe', stand, camera: cam, eye: 1.36, yaw, exitYaw: yaw,
      label: 'THE WARDROBE',
      onEnter: () => {
        leftDoor.rotation.y = 0;
        rightDoor.rotation.y = 0;
        this.game.audio.doorCreak();
      },
      onExit: () => {
        leftDoor.rotation.y = -0.8;
        rightDoor.rotation.y = 0.8;
        this.after(1.2, () => { leftDoor.rotation.y = 0; rightDoor.rotation.y = 0; });
      },
    };
    this.hideSpots.push(spot);
    const item = this.addInteractable('hide', stand, 2.0, 'HIDE IN WARDROBE', () => this.game.player.enterHide(spot), { spot });
    spot.item = item;
    return root;
  }

  addNightstand(x, z, rotY = 0) {
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    root.rotation.y = rotY;
    this.group.add(root);
    const wood = mWood('warm');
    this.addBox(0.58, 0.56, 0.46, wood, 0, 0.32, 0, { parent: root });
    this.addBox(0.62, 0.05, 0.5, mDarkWood(), 0, 0.61, 0, { parent: root });
    this.addBox(0.48, 0.16, 0.02, mDarkWood(), 0, 0.45, 0.235, { parent: root, castShadow: false });
    this.addMesh(sphGeo(0.022, 8), mBrass(), 0, 0.45, 0.255, { parent: root, castShadow: false });
    for (const lx of [-0.22, 0.22]) for (const lz of [-0.16, 0.16]) {
      this.addBox(0.05, 0.1, 0.05, mDarkWood(), lx, 0.05, lz, { parent: root });
    }
    this.addBoxCollider(x, z, 0.66, 0.54, rotY, 0, 0.68);
    return root;
  }

  addTableLamp(x, z, y = 0.65, intensity = 3.2, on = true) {
    const root = new THREE.Group();
    root.position.set(x, y, z);
    this.group.add(root);
    this.addMesh(cylGeo(0.09, 0.11, 0.04, 12), mBrass(), 0, 0, 0, { parent: root, castShadow: false });
    this.addMesh(cylGeo(0.014, 0.014, 0.28, 8), mBrass(), 0, 0.15, 0, { parent: root, castShadow: false });
    this.addMesh(cylGeo(0.16, 0.08, 0.17, 14), mShade(), 0, 0.32, 0, { parent: root, castShadow: false });
    this.addMesh(sphGeo(0.035, 8), mBulb(), 0, 0.24, 0, { parent: root, castShadow: false });
    const light = new THREE.PointLight(0xffc27a, on ? intensity : 0, 4.5, 2);
    light.position.set(0, 0.3, 0);
    root.add(light);
    const glow = glowSprite(0xffc27a, 0.7);
    glow.position.set(0, 0.3, 0);
    root.add(glow);
    this.lights.push({ light, base: on ? intensity : 0, phase: Math.random() * 6, glow });
    return light;
  }

  addDresser(x, z, rotY = 0) {
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    root.rotation.y = rotY;
    this.group.add(root);
    const wood = mWood('warm');
    this.addBox(1.55, 0.92, 0.52, wood, 0, 0.48, 0, { parent: root });
    this.addBox(1.62, 0.06, 0.58, mDarkWood(), 0, 0.97, 0, { parent: root });
    for (let i = 0; i < 3; i++) {
      this.addBox(1.36, 0.2, 0.02, mDarkWood(), 0, 0.26 + i * 0.24, 0.27, { parent: root, castShadow: false });
      this.addMesh(sphGeo(0.025, 8), mBrass(), 0, 0.26 + i * 0.24, 0.29, { parent: root, castShadow: false });
    }
    for (const lx of [-0.66, 0.66]) for (const lz of [-0.18, 0.18]) {
      this.addBox(0.06, 0.12, 0.06, mDarkWood(), lx, 0.06, lz, { parent: root });
    }
    this.addBoxCollider(x, z, 1.64, 0.6, rotY, 0, 1.02);
    return root;
  }

  addPainting(x, y, z, rotY = 0, seed = 1, w = 1.0, h = 1.3) {
    const root = new THREE.Group();
    root.position.set(x, y, z);
    root.rotation.y = rotY;
    this.group.add(root);
    const frame = mBrass();
    this.addBox(w + 0.14, h + 0.14, 0.06, mDarkWood(), 0, 0, 0, { parent: root, castShadow: false });
    const canvas = this.addMesh(planeGeo(w, h), mPainting(seed), 0, 0, 0.035, { parent: root, castShadow: false, receiveShadow: false });
    canvas.material.toneMapped = true;
    // corner ornaments
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      this.addMesh(sphGeo(0.035, 8), frame, sx * (w / 2 + 0.04), sy * (h / 2 + 0.04), 0.04, { parent: root, castShadow: false });
    }
    return root;
  }

  addArmchair(x, z, rotY = 0, color = 0x4a3030) {
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    root.rotation.y = rotY;
    this.group.add(root);
    const fabric = mFabric(color);
    this.addBox(0.9, 0.24, 0.82, fabric, 0, 0.42, 0, { parent: root });
    this.addBox(0.86, 0.85, 0.2, fabric, 0, 0.78, -0.34, { parent: root });
    this.addBox(0.18, 0.48, 0.82, fabric, -0.42, 0.6, 0, { parent: root });
    this.addBox(0.18, 0.48, 0.82, fabric, 0.42, 0.6, 0, { parent: root });
    for (const lx of [-0.34, 0.34]) for (const lz of [-0.3, 0.3]) {
      this.addBox(0.06, 0.3, 0.06, mDarkWood(), lx, 0.15, lz, { parent: root });
    }
    this.addBoxCollider(x, z, 1.02, 0.94, rotY, 0, 1.2);
    return root;
  }

  addPlant(x, z, scale = 1) {
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    root.scale.setScalar(scale);
    this.group.add(root);
    this.addMesh(cylGeo(0.2, 0.15, 0.32, 12), mFabric(0x4a2c1a), 0, 0.16, 0, { parent: root });
    this.addMesh(cylGeo(0.16, 0.16, 0.02, 12), mBlack(), 0, 0.31, 0, { parent: root, castShadow: false });
    const leafMat = mFabric(0x2f4a2f);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      this.addMesh(coneGeo(0.1, 0.8 + Math.random() * 0.5, 6), leafMat, Math.cos(a) * 0.14, 0.75, Math.sin(a) * 0.14, { parent: root, rotZ: Math.cos(a) * 0.5, rotX: Math.sin(a) * 0.5 });
    }
    this.addBoxCollider(x, z, 0.5, 0.5, 0, 0, 1.2);
    return root;
  }

  addClock(x, z, rotY = 0) {
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    root.rotation.y = rotY;
    this.group.add(root);
    const wood = mWood('dark');
    this.addBox(0.6, 1.8, 0.36, wood, 0, 0.9, 0, { parent: root });
    this.addBox(0.5, 0.5, 0.03, mBrass(), 0, 1.38, 0.19, { parent: root, castShadow: false });
    const face = this.addMesh(cylGeo(0.21, 0.21, 0.03, 24), mFabric(0xd6c9a8), 0, 1.38, 0.215, { parent: root, rotX: Math.PI / 2, castShadow: false });
    this.addBox(0.015, 0.13, 0.01, mBlack(), 0, 1.44, 0.235, { parent: root, castShadow: false });
    this.addBox(0.09, 0.015, 0.01, mBlack(), 0.045, 1.38, 0.235, { parent: root, castShadow: false });
    const pendulum = this.addBox(0.035, 0.55, 0.02, mBrass(), 0, 0.65, 0.19, { parent: root, castShadow: false });
    this.addBoxCollider(x, z, 0.68, 0.44, rotY, 0, 1.82);
    this.animated.push({ type: 'pendulum', obj: pendulum, phase: Math.random() * 6 });
    return root;
  }

  addKey(x, y, z, rotY = 0) {
    const root = new THREE.Group();
    root.position.set(x, y, z);
    root.rotation.y = rotY;
    this.group.add(root);
    this.addBox(0.025, 0.025, 0.17, mKey(), 0, 0, 0, { parent: root, castShadow: false });
    const bow = this.addMesh(torusGeo(0.055, 0.013, 8, 20), mKey(), 0, 0, -0.11, { parent: root, castShadow: false });
    bow.rotation.x = Math.PI / 2;
    this.addBox(0.055, 0.02, 0.04, mKey(), 0, 0, 0.08, { parent: root, castShadow: false });
    this.addBox(0.04, 0.02, 0.035, mKey(), 0, 0.015, 0.06, { parent: root, castShadow: false });
    const glow = glowSprite(0xffcf6a, 0.7);
    glow.position.set(0, 0.05, 0);
    root.add(glow);
    this.animated.push({ type: 'key', obj: root, baseY: y });
    const item = this.addInteractable('key', new THREE.Vector3(x, y, z), 2.2, 'TAKE KEY', () => {
      if (!item.enabled) return;
      item.enabled = false;
      this.group.remove(root);
      this.game.player.keys++;
      this.game.audio.key();
      this.game.notify('A brass key. It is warm to the touch.');
      this.game.ui.toast('KEY ACQUIRED');
      this.game.ui.setInventory(this.game.player.keys, this.game.player.bandages, this.game.player.flashlightOn);
    });
    return root;
  }

  addBattery(x, y, z) {
    const root = new THREE.Group();
    root.position.set(x, y, z);
    this.group.add(root);
    this.addMesh(cylGeo(0.045, 0.045, 0.16, 12), mBattery(), 0, 0, 0, { parent: root });
    this.addMesh(cylGeo(0.02, 0.02, 0.02, 8), mBrass(), 0, 0.09, 0, { parent: root, castShadow: false });
    const glow = glowSprite(0x8fe0a0, 0.5);
    glow.position.set(0, 0.02, 0);
    root.add(glow);
    this.animated.push({ type: 'bob', obj: root, baseY: y, phase: Math.random() * 6 });
    const item = this.addInteractable('battery', new THREE.Vector3(x, y, z), 2.0, 'TAKE BATTERY', () => {
      if (!item.enabled) return;
      item.enabled = false;
      this.group.remove(root);
      this.game.player.battery = Math.min(100, this.game.player.battery + 45);
      this.game.audio.battery();
      this.game.notify('Battery pack. Your light feels warmer.');
      this.game.ui.toast('BATTERY +45%');
      this.game.ui.setBattery(this.game.player.battery);
    });
    return root;
  }

  addBandage(x, y, z) {
    const root = new THREE.Group();
    root.position.set(x, y, z);
    this.group.add(root);
    this.addBox(0.2, 0.07, 0.12, mBandage(), 0, 0, 0, { parent: root });
    this.addBox(0.12, 0.075, 0.04, mRed(), 0, 0, 0, { parent: root, castShadow: false });
    this.addBox(0.04, 0.075, 0.12, mRed(), 0, 0, 0, { parent: root, castShadow: false });
    const glow = glowSprite(0xffe0b0, 0.45);
    glow.position.set(0, 0.03, 0);
    root.add(glow);
    this.animated.push({ type: 'bob', obj: root, baseY: y, phase: Math.random() * 6 });
    const item = this.addInteractable('bandage', new THREE.Vector3(x, y, z), 2.0, 'TAKE BANDAGE', () => {
      if (!item.enabled) return;
      item.enabled = false;
      this.group.remove(root);
      this.game.player.bandages++;
      this.game.audio.pickup();
      this.game.notify('A clean bandage. Press H to use it.');
      this.game.ui.toast('BANDAGE ACQUIRED');
      this.game.ui.setInventory(this.game.player.keys, this.game.player.bandages, this.game.player.flashlightOn);
    });
    return root;
  }

  addNote(x, y, z, text, rotX = -Math.PI / 2, rotZ = 0) {
    const mat = cachedMat('note', () => new THREE.MeshStandardMaterial({ map: TX.note(), roughness: 0.95 }));
    const note = this.addMesh(planeGeo(0.34, 0.42), mat, x, y, z, { rotX, rotZ, castShadow: false });
    this.addInteractable('note', new THREE.Vector3(x, y, z), 1.9, 'READ NOTE', () => {
      this.game.notify(text, 5.2, 'A NOTE');
      this.game.audio.pickup();
    });
    return note;
  }

  addTable(x, z, rotY = 0, { cloth = true, hide = true, lamp = true, w = 2.02, d = 1.24 } = {}) {
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    root.rotation.y = rotY;
    this.group.add(root);
    const wood = mWood('dark');
    this.addBox(w - 0.12, 0.08, d - 0.14, wood, 0, 0.79, 0, { parent: root });
    for (const lx of [-(w / 2 - 0.2), w / 2 - 0.2]) for (const lz of [-(d / 2 - 0.2), d / 2 - 0.2]) {
      this.addBox(0.08, 0.78, 0.08, wood, lx, 0.39, lz, { parent: root });
    }
    if (cloth) {
      this.addBox(w, 0.025, d, mCloth(), 0, 0.845, 0, { parent: root, castShadow: false });
      // valance on three sides, open toward +Z
      this.addBox(w, 0.34, 0.02, mCloth(), 0, 0.68, -d / 2 + 0.01, { parent: root, castShadow: false });
      this.addBox(0.02, 0.34, d, mCloth(), -w / 2 + 0.01, 0.68, 0, { parent: root, castShadow: false });
      this.addBox(0.02, 0.34, d, mCloth(), w / 2 - 0.01, 0.68, 0, { parent: root, castShadow: false });
    }
    this.addBoxCollider(x, z, w, d, rotY, 0, 0.9);
    if (lamp) {
      const lp = this.localToWorld(new THREE.Vector3(w * 0.27, 0, -0.15), x, z, rotY);
      this.addTableLamp(lp.x, lp.z, 0.9, 2.2);
    }
    if (hide) {
      const stand = this.localToWorld(new THREE.Vector3(0, 0, d / 2 + 0.05), x, z, rotY);
      const cam = this.localToWorld(new THREE.Vector3(0, 0.44, 0.12), x, z, rotY);
      const spot = {
        type: 'table', stand, camera: cam, eye: 0.44, yaw: rotY, exitYaw: rotY,
        label: 'UNDER THE TABLE',
      };
      this.hideSpots.push(spot);
      const item = this.addInteractable('hide', stand, 2.0, 'HIDE UNDER TABLE', () => this.game.player.enterHide(spot), { spot });
      spot.item = item;
    }
    return root;
  }

  addChair(x, z, rotY = 0) {
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    root.rotation.y = rotY;
    this.group.add(root);
    const wood = mWood('dark');
    this.addBox(0.5, 0.07, 0.48, wood, 0, 0.48, 0, { parent: root });
    this.addBox(0.5, 0.62, 0.06, wood, 0, 0.78, -0.22, { parent: root });
    for (const lx of [-0.2, 0.2]) for (const lz of [-0.18, 0.18]) {
      this.addBox(0.05, 0.48, 0.05, wood, lx, 0.24, lz, { parent: root });
    }
    this.addBoxCollider(x, z, 0.55, 0.52, rotY, 0, 1.1);
    return root;
  }

  addShelf(x, z, rotY = 0, length = 4.2, height = 2.6, seed = 1) {
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    root.rotation.y = rotY;
    this.group.add(root);
    const wood = mDarkWood();
    this.addBox(length, height, 0.08, wood, 0, height / 2, -0.3, { parent: root });
    this.addBox(0.08, height, 0.68, wood, -length / 2, height / 2, 0, { parent: root });
    this.addBox(0.08, height, 0.68, wood, length / 2, height / 2, 0, { parent: root });
    this.addBox(length + 0.16, 0.12, 0.74, wood, 0, height + 0.06, 0, { parent: root });
    this.addBox(length + 0.1, 0.12, 0.72, wood, 0, 0.06, 0, { parent: root });
    for (let i = 1; i <= 4; i++) {
      this.addBox(length - 0.08, 0.055, 0.66, wood, 0, (height / 5) * i, 0, { parent: root });
    }
    const books = this.addMesh(planeGeo(length - 0.14, height - 0.2), mBook(seed), 0, height / 2, -0.245, { parent: root, castShadow: false });
    books.material.toneMapped = true;
    this.addBoxCollider(x, z, length + 0.12, 0.8, rotY, 0, height + 0.12);
    return root;
  }

  addChandelier(x, z, { intensity = 22, castShadow = false } = {}) {
    const root = new THREE.Group();
    root.position.set(x, this.height - 0.1, z);
    this.group.add(root);
    this.addMesh(cylGeo(0.012, 0.012, 0.75, 6), mIron(), 0, -0.38, 0, { parent: root, castShadow: false });
    const ring = this.addMesh(torusGeo(0.55, 0.035, 8, 32), mBrass(), 0, -0.8, 0, { parent: root, castShadow: false });
    ring.rotation.x = Math.PI / 2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const cx = Math.cos(a) * 0.55, cz = Math.sin(a) * 0.55;
      this.addMesh(cylGeo(0.025, 0.025, 0.18, 8), mFabric(0xd8c9a8), cx, -0.72, cz, { parent: root, castShadow: false });
      this.addMesh(sphGeo(0.04, 8), mBulb(), cx, -0.61, cz, { parent: root, castShadow: false });
    }
    const light = new THREE.PointLight(0xffd39a, intensity, 15, 2);
    light.position.set(0, -0.75, 0);
    if (castShadow) {
      light.castShadow = true;
      light.shadow.mapSize.set(512, 512);
      light.shadow.bias = -0.002;
    }
    root.add(light);
    const glow = glowSprite(0xffd39a, 3.0);
    glow.position.set(0, -0.75, 0);
    root.add(glow);
    this.lights.push({ light, base: intensity, phase: Math.random() * 6, glow });
    return light;
  }

  addBooks(x, z, count = 6) {
    const colors = [0x5a2b24, 0x3c4a3a, 0x4b3b56, 0x6a5330, 0x2c3d4a];
    for (let i = 0; i < count; i++) {
      const w = 0.18 + Math.random() * 0.16;
      const mat = mFabric(colors[i % colors.length]);
      this.addBox(w, 0.05 + Math.random() * 0.05, 0.26, mat, x + (Math.random() - 0.5) * 1.4, 0.03, z + (Math.random() - 0.5) * 1.2, { rotY: Math.random() * Math.PI });
    }
  }

  localToWorld(local, x, z, rotY) {
    return new THREE.Vector3(
      x + local.x * Math.cos(rotY) + local.z * Math.sin(rotY),
      local.y,
      z - local.x * Math.sin(rotY) + local.z * Math.cos(rotY),
    );
  }

  /* ---------------- room types ---------------- */

  buildHotelRoom() {
    const n = this.n;
    const left = rand(n, 4) < 0.5;
    const bedX = left ? -3.0 : 3.0;
    const nightX = left ? -3.52 : 3.52;
    const dresserX = left ? 4.1 : -4.1;
    const dresserRot = left ? -Math.PI / 2 : Math.PI / 2;
    const wardrobeX = left ? 3.9 : -3.9;
    const wardrobeRot = left ? -Math.PI / 2 : Math.PI / 2;
    const wallRot = left ? Math.PI / 2 : -Math.PI / 2;
    const blanket = [0x5a2727, 0x2f4636, 0x3b3350, 0x5a4a2b, 0x4a3030][Math.floor(rand(n, 5) * 5)];

    this.buildShell({ palette: this.palette, exitNumber: this.config.exitNumber });
    this.addRug(0, 0, 4.9, 3.4, (this.palette + 2) % 5);

    this.addBed(bedX, -0.65, 0, blanket, left ? '+x' : '-x');
    this.addNightstand(nightX, 1.35, 0);
    this.addDresser(dresserX, 1.25, dresserRot);
    this.addTableLamp(dresserX, 0.9, 1.02, 2.6, this.type !== 'dark');
    this.addWardrobe(wardrobeX, -1.95, wardrobeRot);
    this.addWindow(left ? -4.37 : 4.37, 2.05, -0.65, wallRot, { dark: this.type === 'dark' });
    this.addPainting(dresserX + (left ? 0.26 : -0.26), 1.98, 1.25, dresserRot, n + 3);
    this.addArmchair(left ? 2.55 : -2.55, 2.55, left ? -2.35 : 2.35, 0x46302c);
    this.addPlant(left ? 3.9 : -3.9, -3.35, 0.9);
    this.addClock(left ? -3.95 : 3.95, 2.95, 0);
    this.addCeilingLamp(0, 0, { intensity: 17, castShadow: true });
    this.addSconce(0, 2.15, 3.86, Math.PI, { intensity: 2.2 });

    if (this.type === 'dark') {
      this.lightsOn = false;
      this.ambientBase = 0.055;
      this.addBattery(dresserX, 1.06, 0.7);
      this.setObjective('Find the next door. Your light is all you have.');
    } else if (this.type === 'supply') {
      this.addBattery(dresserX, 1.06, 0.72);
      this.addBandage(dresserX, 1.06, 1.25);
      this.addNote(bedX, 0.78, -0.4, 'If the lights begin to scream, get low and get quiet. The wardrobes are older than the hotel. They will hold you.');
      this.setObjective('Take what you can. The library is close.');
    } else if (this.locked) {
      this.addKey(nightX, 0.71, 1.35, 0.35);
      this.setObjective('The door is locked. Find the key.');
    } else if (this.type === 'rush' || this.type === 'ambush') {
      this.setObjective('Find a hiding place.');
    } else {
      this.setObjective('Open the next door.');
    }

    if (this.type === 'rush' || this.type === 'ambush' || this.type === 'finale') {
      // make sure both hiding types exist and are easy to reach
    }
  }

  buildHalt() {
    this.buildShell({ palette: 1, exitNumber: this.config.exitNumber });
    this.sealed = true;
    this.lightsOn = false;
    this.ambientBase = 0.035;
    this.exitDoor?.setLocked(true);
    if (this.exitItem) { this.exitItem.locked = true; this.exitItem.label = 'SEALED'; }
    this.addRug(0, 0, 1.7, 20.5, 0);
    for (const z of [-8, -4, 0, 4, 8]) {
      this.addTable(-1.85, z, 0, { w: 1.5, d: 1.5, cloth: false, hide: false, lamp: false });
      this.addTable(1.85, z, 0, { w: 1.5, d: 1.5, cloth: false, hide: false, lamp: false });
      this.addChair(-2.3, z + 1.05, Math.PI);
      this.addChair(2.3, z + 1.05, Math.PI);
    }
    for (const z of [-9, -4.5, 0, 4.5, 9]) {
      this.addSconce(-2.53, 1.95, z, Math.PI / 2, { intensity: 1.4, color: 0x7fa8c8 });
      this.addSconce(2.53, 1.95, z, -Math.PI / 2, { intensity: 1.4, color: 0x7fa8c8 });
    }
    for (const z of [-9, -3, 3, 9]) {
      this.addCeilingLamp(0, z, { intensity: 9, color: 0xa8c4dc, castShadow: false });
    }
    this.setObjective('Get through the dining hall.');
    this.after(1.4, () => this.game.notify('The door seals behind you. The dark is listening.', 4.2));
  }

  buildSeek() {
    this.buildShell({ palette: 4, exitNumber: this.config.exitNumber, exitOpen: true });
    this.lightsOn = true;
    this.ambientBase = 0.16;
    this.exitOpen = true;
    if (this.exitItem) this.exitItem.enabled = false;
    this.addRug(0, 0, 1.4, 61, 4);

    for (let z = -28; z <= 28; z += 8) {
      this.addCeilingLamp(0, z, { intensity: 10, color: 0xffb38a, castShadow: false });
    }
    for (let z = -28; z <= 28; z += 7) {
      for (const side of [-1, 1]) {
        const door = this.buildDoor({
          x: side * (this.width / 2 - 0.03), z, rotY: side > 0 ? -Math.PI / 2 : Math.PI / 2,
          number: 0, label: 'STAFF', width: 1.1, height: 2.05,
          interactive: false, collider: false, open: rand(this.n + z + side, 2) > 0.72,
        });
        door.root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
      }
      this.addSconce(-2.62, 2.05, z + 3.5, Math.PI / 2, { intensity: 2.0, color: 0xff9a70 });
      this.addSconce(2.62, 2.05, z + 3.5, -Math.PI / 2, { intensity: 2.0, color: 0xff9a70 });
    }

    const crate = (z, x = 0, w = 4.7, h = 0.6, d = 1.15) => {
      this.addBox(w, h, d, mWood('warm'), x, h / 2, z);
      this.addBox(w + 0.05, 0.06, d + 0.05, mDarkWood(), x, h + 0.02, z, { castShadow: false });
      this.addBoxCollider(x, z, w, d, 0, 0, h);
    };
    const beam = (z) => {
      this.addBox(this.width - 0.2, 0.85, 0.5, mDarkWood(), 0, 1.95, z);
      this.addBox(0.18, 1.6, 0.18, mIron(), -this.width / 2 + 0.22, 2.7, z, { castShadow: false });
      this.addBox(0.18, 1.6, 0.18, mIron(), this.width / 2 - 0.22, 2.7, z, { castShadow: false });
      this.addBoxCollider(0, z, this.width - 0.2, 0.55, 0, 1.42, this.height);
      this.addSign('CROUCH', 0, 1.15, z + 0.34, 0, '#e2c98f', '#160d08', 1.0, 0.28);
    };

    crate(24);
    beam(16);
    crate(8, 0.55, 3.5);
    beam(0);
    crate(-8, -0.45);
    beam(-16);
    crate(-24, 0.2, 3.2);
    crate(-28.5, -1.8, 1.0, 0.6, 1.0);
    crate(-28.5, 1.8, 1.0, 0.6, 1.0);

    this.addSign('RUN', 0, 2.7, 29.2, 0, '#d75a4a', '#140706', 1.6, 0.45);
    this.addSign('DO NOT LOOK BACK', 0, 2.7, -30.8, Math.PI, '#d75a4a', '#140706', 2.4, 0.45);
    this.setObjective('RUN. DO NOT LOOK BACK.');
  }

  buildLibrary() {
    this.buildShell({ palette: 0, exitKind: 'elevator', exitNumber: this.config.exitNumber });
    this.lightsOn = true;
    this.ambientBase = 0.22;
    this.addRug(0, 0, 2.6, 10.5, 0);

    for (const z of [-5.1, 0, 5.1]) {
      this.addShelf(-7.35, z, Math.PI / 2, 4.2, 2.85, this.n + z);
      this.addShelf(7.35, z, -Math.PI / 2, 4.2, 2.85, this.n + z + 1);
    }
    for (const side of [-1, 1]) {
      this.addShelf(side * 2.9, -3.8, Math.PI / 2, 5.2, 2.8, this.n + side);
      this.addShelf(side * 2.9, 3.8, Math.PI / 2, 5.2, 2.8, this.n + side + 4);
    }

    this.addTable(-5.15, 3.0, 0, { w: 2.0, d: 1.25, hide: true, lamp: true });
    this.addTable(5.15, -3.0, 0, { w: 2.0, d: 1.25, hide: true, lamp: true });
    this.addChair(-6.45, 3.0, Math.PI / 2);
    this.addChair(-3.85, 3.0, -Math.PI / 2);
    this.addChair(6.45, -3.0, Math.PI / 2);
    this.addChair(3.85, -3.0, -Math.PI / 2);

    this.addChandelier(0, 1.4, { intensity: 26, castShadow: true });
    this.addChandelier(0, -5.5, { intensity: 14 });
    for (const z of [-6, 0, 6]) {
      this.addSconce(-7.86, 2.6, z, Math.PI / 2, { intensity: 2.4, color: 0xffc98a });
      this.addSconce(7.86, 2.6, z, -Math.PI / 2, { intensity: 2.4, color: 0xffc98a });
    }
    this.addSign('THE LIBRARY', 0, 3.35, 7.83, Math.PI, '#e2c98f', '#0b0a08', 2.2, 0.5);
    this.addSign('QUIET', -7.82, 2.0, 1.2, Math.PI / 2, '#b8a77e', '#0b0a08', 1.0, 0.3);
    this.addNote(-5.15, 0.87, 3.0, 'It has no eyes. It hears your shoes, your breath, the floorboards. Keep low. When it comes close, hide beneath a table and do not move.');
    this.addBooks(0, 5.4, 8);
    this.addBooks(-4.8, -5.5, 6);

    this.figureSpawn = new THREE.Vector3(0, 0, -1.5);
    this.figureWaypoints = [
      new THREE.Vector3(-6.35, 0, 6.0), new THREE.Vector3(-6.35, 0, 0.0), new THREE.Vector3(-6.35, 0, -6.0),
      new THREE.Vector3(0, 0, -6.2), new THREE.Vector3(6.35, 0, -6.0), new THREE.Vector3(6.35, 0, 0.0),
      new THREE.Vector3(6.35, 0, 6.0), new THREE.Vector3(0, 0, 6.2), new THREE.Vector3(0, 0, 0),
    ];
    this.setObjective('Reach the elevator. Stay quiet.');
  }

  buildFinale() {
    this.buildShell({ palette: 0, exitNumber: 100, exitLabel: 'EXIT' });
    this.lightsOn = true;
    this.ambientBase = 0.24;
    this.addRug(0, 0, 5.8, 4.4, 0);
    this.addBed(-3.3, -0.7, 0, 0x5a2727, '+x');
    this.addWardrobe(4.15, -1.9, -Math.PI / 2);
    this.addNightstand(-3.7, 1.45, 0);
    this.addDresser(4.2, 1.4, -Math.PI / 2);
    this.addPainting(4.38, 2.05, 1.4, -Math.PI / 2, 50);
    this.addWindow(-4.42, 2.1, -0.7, Math.PI / 2, { dark: false });
    this.addArmchair(2.7, 2.9, -2.3, 0x46302c);
    this.addChandelier(0, 0, { intensity: 30, castShadow: true });
    this.addClock(-4.1, 3.1, 0);
    this.addPlant(4.1, -3.6, 1.0);
    this.exitDoor?.setLocked(true);
    if (this.exitItem) { this.exitItem.locked = true; this.exitItem.label = 'SEALED'; }
    this.sealed = true;
    this.finale = true;

    const guide = glowSprite(0x7fc8ff, 2.2);
    guide.position.set(0, 1.4, -4.3);
    guide.material.opacity = 0;
    this.group.add(guide);
    this.guiding = guide;

    this.setObjective('One last door.');
  }

  setObjective(text) {
    this.objective = text;
    this.game.ui.setObjective(text);
  }

  flicker(duration = 3) {
    this.flickerUntil = this.time + duration;
  }

  setLights(on) {
    this.lightsOn = on;
  }

  /* ---------------- lifecycle ---------------- */

  start() {
    if (this.game.roomHints) this.game.roomHints(this);
    switch (this.type) {
      case 'dark':
        this.after(5.8, () => {
          if (this.game.mode === 'playing' && !this.game.player.hidden) this.game.entities.startScreech(this);
        });
        this.after(13.5, () => {
          if (this.game.mode === 'playing' && !this.game.player.hidden) this.game.entities.startScreech(this);
        });
        break;
      case 'rush':
        this.after(1.0, () => this.game.notify('The lights are breathing. Find somewhere to hide.', 4));
        this.after(3.4, () => {
          if (this.game.mode === 'playing') this.game.entities.startRush(this, 'rush', () => this.onRushSurvived());
        });
        break;
      case 'ambush':
        this.after(1.0, () => this.game.notify('Something is coming back. Stay hidden until the lights settle.', 4.2));
        this.after(3.8, () => {
          if (this.game.mode === 'playing') this.game.entities.startAmbush(this, () => this.onRushSurvived());
        });
        break;
      case 'finale':
        this.after(2.8, () => {
          if (this.game.mode === 'playing') this.game.entities.startRush(this, 'final', () => this.onRushSurvived());
        });
        break;
      case 'halt':
        this.after(1.0, () => this.game.notify('Something is waiting in the dark. Do not let it touch you.', 4));
        break;
      case 'seek':
        this.game.player.adrenaline = true;
        this.game.audio.startChase();
        this.game.entities.startSeek(this);
        this.game.ui.warning('RUN', 2.4);
        this.after(0.6, () => this.game.notify('SPACE to jump. C to crouch. Do not stop.', 4));
        break;
      case 'library':
        this.after(1.4, () => {
          if (this.game.mode === 'playing') this.game.entities.startFigure(this);
        });
        this.after(2.4, () => this.game.notify('It cannot see you. It hears you. Crouch, and use the tables.', 5));
        break;
      default:
        break;
    }
  }

  onRushSurvived() {
    if (this.type === 'finale') {
      this.sealed = false;
      if (this.exitDoor) this.exitDoor.setLocked(false);
      if (this.exitItem) { this.exitItem.locked = false; this.exitItem.label = 'OPEN EXIT'; }
      if (this.guiding) this.guiding.material.opacity = 0.55;
      this.setObjective('Leave. Now.');
      this.game.ui.toast('THE EXIT IS OPEN', 'Do not look back.');
      this.game.audio.checkpoint();
    } else {
      this.setObjective(this.locked ? 'The door is locked. Find the key.' : 'Open the next door.');
      this.game.ui.toast('IT PASSED', 'The lights are steady again.');
    }
  }

  beginHaltPhase() {
    this.haltPhase++;
    this.haltActive = true;
    this.setLights(false);
    this.flicker(8);
    this.game.entities.startHalt(this, this.haltPhase);
    this.game.ui.warning('TURN AROUND', 0, true);
    this.game.ui.setStatic(0.14);
    this.game.audio.haltWhisper();
    this.setObjective('Back away from it.');
  }

  endHaltPhase() {
    if (!this.haltActive) return;
    this.haltActive = false;
    this.setLights(true);
    this.flicker(1.4);
    this.game.ui.warning('', 0);
    this.game.ui.setStatic(0);
    this.haltCooldown = this.time + 1.6;
    if (this.haltPhase >= 3) {
      this.haltDone = true;
      this.sealed = false;
      if (this.exitDoor) this.exitDoor.setLocked(false);
      if (this.exitItem) { this.exitItem.locked = false; this.exitItem.label = 'OPEN DOOR'; }
      this.setObjective('The hall releases you. Open the door.');
      this.game.ui.toast('THE HALL LETS YOU PASS');
      this.game.audio.checkpoint();
    } else {
      this.setObjective('Move forward.');
      this.game.notify('The dark pulls back. Keep moving.', 3);
    }
  }

  useExitDoor() {
    if (!this.exitDoor) return;
    if (this.sealed) {
      this.game.audio.doorSlam(0);
      this.game.notify(this.type === 'halt' ? 'The door will not open until the hall lets you pass.' : 'Something is holding the door shut.');
      return;
    }
    const door = this.exitDoor;
    if (door.locked) {
      if (this.game.player.keys > 0) {
        this.game.player.keys--;
        door.setLocked(false);
        if (this.exitItem) { this.exitItem.locked = false; this.exitItem.label = 'OPEN DOOR'; }
        this.game.audio.unlock();
        this.game.ui.setInventory(this.game.player.keys, this.game.player.bandages, this.game.player.flashlightOn);
        this.game.ui.toast('UNLOCKED');
        door.open();
        this.exitOpen = true;
        if (this.exitItem) this.exitItem.enabled = false;
        this.setObjective('Go through the door.');
        this.game.audio.doorCreak(0);
      } else {
        this.game.audio.doorSlam(0);
        this.game.notify('Locked. There must be a key somewhere in this room.');
      }
      return;
    }
    if (!door.opened) {
      door.open();
      this.exitOpen = true;
      if (this.exitItem) this.exitItem.enabled = false;
      this.game.audio.doorCreak(0);
      this.setObjective(this.type === 'finale' ? 'Step through.' : 'Go through the door.');
    }
  }

  update(dt, player) {
    this.time += dt;
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const t = this.timers[i];
      t.t -= dt;
      if (t.t <= 0) {
        this.timers.splice(i, 1);
        try { t.fn(); } catch (e) { console.error(e); }
      }
    }

    if (this.exitDoor) this.exitDoor.update(dt);
    if (this.elevator && this.elevator.opened) {
      this.elevator.left.position.x += (-1.12 - this.elevator.left.position.x) * Math.min(1, dt * 3.4);
      this.elevator.right.position.x += (1.12 - this.elevator.right.position.x) * Math.min(1, dt * 3.4);
      this.elevator.indicator.material.color.setHex(0x5fd07a);
    }

    for (const a of this.animated) {
      if (a.type === 'key') {
        a.obj.rotation.y += dt * 1.4;
        a.obj.position.y = a.baseY + Math.sin(this.time * 2.2) * 0.018;
      } else if (a.type === 'bob') {
        a.obj.position.y = a.baseY + Math.sin(this.time * 2 + a.phase) * 0.03;
      } else if (a.type === 'pendulum') {
        a.obj.rotation.z = Math.sin(this.time * 1.7 + a.phase) * 0.17;
      }
    }

    this.updateLights();

    if (this.dust) {
      const pos = this.dust.positions;
      for (let i = 0; i < this.dust.count; i++) {
        pos[i * 3] = this.dust.base[i * 3] + Math.sin(this.time * 0.18 + this.dust.phases[i]) * 0.12;
        pos[i * 3 + 1] = this.dust.base[i * 3 + 1] + Math.sin(this.time * 0.24 + this.dust.phases[i] * 1.7) * 0.18;
        pos[i * 3 + 2] = this.dust.base[i * 3 + 2] + Math.cos(this.time * 0.15 + this.dust.phases[i]) * 0.12;
      }
      this.dust.points.geometry.attributes.position.needsUpdate = true;
    }

    if (this.type === 'halt' && !this.haltDone && !this.haltActive && this.time > this.haltCooldown) {
      const z = player.position.z;
      if (this.haltPhase === 0 && z < 3.6) this.beginHaltPhase();
      else if (this.haltPhase === 1 && z < -1.1) this.beginHaltPhase();
      else if (this.haltPhase === 2 && z < -5.6) this.beginHaltPhase();
    }

    if (this.type === 'library') {
      this.game.ui.setNoise(this.game.player.hidden ? 0 : this.game.player.noise);
    }

    if (this.exitOpen && !this.exitTriggered && player.position.z < -this.depth / 2 - 0.22) {
      this.exitTriggered = true;
      if (this.type === 'finale') this.game.win();
      else if (this.type === 'seek') this.game.finishSeek();
      else this.game.transitionNext();
    }
  }

  updateLights() {
    const flick = this.time < this.flickerUntil;
    for (const L of this.lights) {
      let v;
      if (L.window) v = L.base;
      else v = this.lightsOn ? L.base : 0;
      if (v > 0 && flick && !L.window && this.lightsOn) {
        const r = Math.random();
        v *= r < 0.24 ? 0.03 : 0.35 + r * 0.65;
      } else if (v > 0) {
        v *= 0.975 + Math.sin(this.time * 2.1 + L.phase) * 0.025;
      }
      L.light.intensity = v;
      if (L.glow) L.glow.material.opacity = v > 0.02 ? 0.42 : 0.03;
    }
    this.ambient.intensity = this.lightsOn ? this.ambientBase : this.ambientBase * 0.2;
  }

  dispose() {
    if (this.group.parent) this.group.parent.remove(this.group);
    this.timers.length = 0;
    this.colliders.length = 0;
    this.interactables.length = 0;
    this.hideSpots.length = 0;
    this.lights.length = 0;
    this.animated.length = 0;
    this.dust = null;
  }
}
