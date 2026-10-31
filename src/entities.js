import * as THREE from 'three';
import { clamp, TAU } from './noise.js';

function std(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.05, flatShading: true, ...opts });
}

function mesh(parent, geometry, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

const BASE = {
  skin: 0xc98d64,
  skinDark: 0x8e5a3c,
  eye: 0x231b17,
  pants: 0x3b4252,
  boot: 0x3a2b23,
  belt: 0x5a3d28,
  metal: 0xc8d0d4,
  gold: 0xf0b93c,
};

export const STYLES = {
  player: {
    coat: 0x238d86, coatDark: 0x146e6a, sash: 0xf2a03d, skin: 0xd6a077,
    pants: 0xefe3c6, hat: 'straw', hatColor: 0xd9b45e, band: 0xc8443c, hair: 0x2d2724,
  },
  rogue: {
    coat: 0x7a3b37, coatDark: 0x4d2726, sash: 0x3e2c26, skin: 0xb77a52,
    pants: 0x39322f, hat: 'bandana', hatColor: 0xb33a33, band: 0xd2b56a, hair: 0x2a211e,
  },
  corsair: {
    coat: 0x463133, coatDark: 0x2b2022, sash: 0xff5a1f, skin: 0x9d6850,
    pants: 0x2c2527, hat: 'horned', hatColor: 0x3a2b2b, band: 0xff7a22, hair: 0x171313,
  },
  boss: {
    coat: 0x312326, coatDark: 0x1b1719, sash: 0xff4a12, skin: 0x9b6248,
    pants: 0x241c20, hat: 'horned', hatColor: 0x2a2224, band: 0xff5a14, hair: 0x120e0f,
    scale: 2.05,
  },
  npc: {
    coat: 0xb83c35, coatDark: 0x7d2b28, sash: 0xe7c46a, skin: 0xd2a077,
    pants: 0x483a34, hat: 'tricorn', hatColor: 0x2f2725, band: 0xf0c34a, hair: 0x4a2c1c,
  },
};

function buildSword(parent, { glow = 0, scale = 1, curved = false } = {}) {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0xd9e1e4, metalness: 0.7, roughness: 0.28, flatShading: true, emissive: glow, emissiveIntensity: glow ? 1.2 : 0 });
  const blade = mesh(g, new THREE.BoxGeometry(0.1, 1.35, 0.22), metal, 0, 0.82, 0);
  blade.castShadow = true;
  mesh(g, new THREE.ConeGeometry(0.09, 0.3, 4), metal, 0, 1.62, 0, 0, 0, 0, 1.1, 1, 1.0);
  mesh(g, new THREE.BoxGeometry(0.42, 0.09, 0.16), std(0xc9a246, { metalness: 0.6, roughness: 0.35 }), 0, 0.16, 0);
  mesh(g, new THREE.CylinderGeometry(0.055, 0.055, 0.42, 6), std(0x4b2f22), 0, -0.05, 0);
  mesh(g, new THREE.SphereGeometry(0.07, 6, 4), std(0xd8b24a, { metalness: 0.5 }), 0, -0.28, 0);
  if (curved) g.rotation.z = 0.2;
  g.scale.setScalar(scale);
  parent.add(g);
  return g;
}

export function createHumanoid(styleName, { sword = true, marker = false, scale = 1 } = {}) {
  const s = STYLES[styleName] || STYLES.rogue;
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const mats = {
    coat: std(s.coat), coatDark: std(s.coatDark), skin: std(s.skin), pants: std(s.pants),
    boot: std(BASE.boot), belt: std(BASE.belt), hat: std(s.hatColor), band: std(s.band),
    hair: std(s.hair), metal: std(BASE.metal, { metalness: 0.5, roughness: 0.4 }),
    gold: std(BASE.gold, { metalness: 0.55, roughness: 0.35 }),
    eye: new THREE.MeshBasicMaterial({ color: BASE.eye }),
  };
  const flashTargets = [mats.coat, mats.coatDark, mats.skin, mats.pants, mats.hat, mats.band, mats.hair];

  // Torso + coat
  const torso = new THREE.Group();
  torso.position.y = 1.28;
  body.add(torso);
  mesh(torso, new THREE.CylinderGeometry(0.34, 0.42, 0.92, 8), mats.coat, 0, 0.12, 0);
  mesh(torso, new THREE.CylinderGeometry(0.44, 0.35, 0.52, 8), mats.coatDark, 0, -0.48, 0);
  mesh(torso, new THREE.BoxGeometry(0.78, 0.13, 0.52), mats.belt, 0, -0.24, 0);
  mesh(torso, new THREE.BoxGeometry(0.18, 0.16, 0.08), mats.gold, 0, -0.24, -0.26);
  // sash
  mesh(torso, new THREE.BoxGeometry(0.66, 0.16, 0.45), std(s.sash), 0, -0.05, 0, 0, 0, -0.14);
  // collar
  mesh(torso, new THREE.CylinderGeometry(0.4, 0.32, 0.18, 8), mats.coatDark, 0, 0.63, 0);

  // Head
  const head = new THREE.Group();
  head.position.y = 1.9;
  body.add(head);
  mesh(head, new THREE.SphereGeometry(0.33, 10, 8), mats.skin, 0, 0.06, 0);
  mesh(head, new THREE.SphereGeometry(0.35, 10, 6, 0, TAU, 0, Math.PI * 0.55), mats.hair, 0, 0.14, 0.02);
  // eyes
  mesh(head, new THREE.SphereGeometry(0.045, 5, 4), mats.eye, -0.12, 0.08, -0.30);
  mesh(head, new THREE.SphereGeometry(0.045, 5, 4), mats.eye, 0.12, 0.08, -0.30);
  // brows for attitude
  mesh(head, new THREE.BoxGeometry(0.12, 0.03, 0.03), mats.hair, -0.12, 0.16, -0.31, 0, 0, 0.18);
  mesh(head, new THREE.BoxGeometry(0.12, 0.03, 0.03), mats.hair, 0.12, 0.16, -0.31, 0, 0, -0.18);

  // Hat
  let hat = null;
  if (s.hat === 'straw') {
    hat = new THREE.Group();
    mesh(hat, new THREE.CylinderGeometry(0.66, 0.68, 0.045, 14), mats.hat, 0, 0.0, 0);
    mesh(hat, new THREE.CylinderGeometry(0.3, 0.36, 0.24, 10), mats.hat, 0, 0.12, 0);
    mesh(hat, new THREE.CylinderGeometry(0.31, 0.37, 0.075, 10), mats.band, 0, 0.05, 0);
  } else if (s.hat === 'bandana') {
    hat = new THREE.Group();
    mesh(hat, new THREE.SphereGeometry(0.355, 10, 5, 0, TAU, 0, Math.PI * 0.5), mats.hat, 0, 0.16, 0.01);
    mesh(hat, new THREE.BoxGeometry(0.16, 0.24, 0.04), mats.hat, 0.28, 0.08, 0.18, 0.2, 0, -0.5);
  } else if (s.hat === 'tricorn') {
    hat = new THREE.Group();
    mesh(hat, new THREE.CylinderGeometry(0.62, 0.66, 0.06, 3), mats.hat, 0, 0.03, 0, 0, 0.52, 0);
    mesh(hat, new THREE.CylinderGeometry(0.28, 0.34, 0.22, 8), mats.hat, 0, 0.13, 0);
    mesh(hat, new THREE.CylinderGeometry(0.29, 0.35, 0.06, 8), mats.band, 0, 0.05, 0);
    mesh(hat, new THREE.BoxGeometry(0.1, 0.22, 0.04), std(0xf2e3c0), 0, 0.12, -0.33);
  } else if (s.hat === 'horned') {
    hat = new THREE.Group();
    mesh(hat, new THREE.CylinderGeometry(0.58, 0.62, 0.06, 3), mats.hat, 0, 0.04, 0, 0, 0.52, 0);
    mesh(hat, new THREE.CylinderGeometry(0.27, 0.33, 0.24, 8), mats.hat, 0, 0.16, 0);
    mesh(hat, new THREE.ConeGeometry(0.09, 0.48, 5), mats.hat, -0.4, 0.15, 0, 0, 0, 0.6);
    mesh(hat, new THREE.ConeGeometry(0.09, 0.48, 5), mats.hat, 0.4, 0.15, 0, 0, 0, -0.6);
    mesh(hat, new THREE.BoxGeometry(0.26, 0.06, 0.05), mats.band, 0, 0.05, -0.33);
  }
  if (hat) {
    hat.position.y = 0.27;
    hat.rotation.set(0, styleName === 'player' ? 0.06 : 0, styleName === 'player' ? 0.04 : 0);
    head.add(hat);
  }

  // Arms
  const armGeo = new THREE.CylinderGeometry(0.115, 0.13, 0.8, 6);
  const handGeo = new THREE.SphereGeometry(0.13, 6, 5);
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.5, 1.72, 0);
  body.add(leftArm);
  mesh(leftArm, armGeo, mats.coat, 0, -0.35, 0);
  mesh(leftArm, handGeo, mats.skin, 0, -0.78, 0);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.5, 1.72, 0);
  body.add(rightArm);
  mesh(rightArm, armGeo, mats.coat, 0, -0.35, 0);
  mesh(rightArm, handGeo, mats.skin, 0, -0.78, 0);
  let swordMesh = null;
  if (sword) {
    swordMesh = buildSword(rightArm, {
      glow: styleName === 'boss' ? 0xff3c00 : styleName === 'corsair' ? 0x7a1a00 : 0,
      scale: styleName === 'boss' ? 1.25 : 1,
      curved: styleName === 'boss',
    });
    swordMesh.position.set(0, -0.78, 0);
    swordMesh.rotation.x = -1.15;
  }

  // Legs
  const legGeo = new THREE.CylinderGeometry(0.145, 0.12, 0.78, 6);
  const bootGeo = new THREE.BoxGeometry(0.23, 0.18, 0.38);
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.2, 0.98, 0);
  body.add(leftLeg);
  mesh(leftLeg, legGeo, mats.pants, 0, -0.38, 0);
  mesh(leftLeg, bootGeo, mats.boot, 0, -0.8, -0.06);
  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.2, 0.98, 0);
  body.add(rightLeg);
  mesh(rightLeg, legGeo, mats.pants, 0, -0.38, 0);
  mesh(rightLeg, bootGeo, mats.boot, 0, -0.8, -0.06);

  // Cape for bosses / captains
  let cape = null;
  if (styleName === 'boss') {
    cape = new THREE.Group();
    cape.position.set(0, 1.72, 0.32);
    body.add(cape);
    mesh(cape, new THREE.BoxGeometry(1.0, 1.45, 0.06), std(0x4a1c16), 0, -0.68, 0.04, 0.08, 0, 0);
  }

  // Ember cracks for the corsairs.
  if (styleName === 'corsair' || styleName === 'boss') {
    const emberMat = new THREE.MeshBasicMaterial({ color: 0xff5a18 });
    for (let i = 0; i < (styleName === 'boss' ? 5 : 2); i++) {
      mesh(body, new THREE.BoxGeometry(0.035, 0.3 + i * 0.05, 0.02), emberMat,
        -0.18 + i * 0.09, 1.25 + (i % 2) * 0.12, -0.4, 0, 0, 0.35 - i * 0.14);
    }
  }

  const scaleFinal = (s.scale || 1) * scale;
  group.scale.setScalar(scaleFinal);
  group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  return {
    group, body, torso, head, hat, leftArm, rightArm, leftLeg, rightLeg,
    sword: swordMesh, cape, mats, flashTargets, style: styleName,
  };
}

/* ------------------------------------------------------------------ */
/*  Animation                                                          */
/* ------------------------------------------------------------------ */

export function animateRig(rig, state) {
  const {
    time = 0, speed = 0, airborne = false, attacking = 0, attackKind = 'slash',
    dead = false, hit = 0, block = 0,
  } = state;
  const t = time;
  const walk = clamp(speed / 6.5, 0, 1.4);
  const swing = Math.sin(t * (6.2 + walk * 2.4)) * walk;
  const breathe = Math.sin(t * 1.9) * 0.012;

  if (dead) {
    rig.body.rotation.x = -Math.PI * 0.47;
    rig.body.position.y = 0.42;
    rig.body.position.z = 0.2;
    rig.body.rotation.z = 0.08;
    rig.leftArm.rotation.z = -0.4;
    rig.rightArm.rotation.z = 0.6;
    return;
  }
  rig.body.rotation.x = 0;
  rig.body.rotation.z = 0;
  rig.body.position.y = breathe;
  rig.body.position.z = 0;

  if (airborne) {
    rig.leftLeg.rotation.x = -0.55;
    rig.rightLeg.rotation.x = 0.32;
    rig.leftArm.rotation.x = -0.45;
    rig.rightArm.rotation.x = 0.2;
    rig.leftArm.rotation.z = -0.2;
    rig.rightArm.rotation.z = 0.2;
  } else {
    rig.leftLeg.rotation.x = swing * 0.62;
    rig.rightLeg.rotation.x = -swing * 0.62;
    rig.leftArm.rotation.x = -swing * 0.46;
    rig.rightArm.rotation.x = swing * 0.32;
    rig.leftArm.rotation.z = -0.10 - walk * 0.06;
    rig.rightArm.rotation.z = 0.10 + walk * 0.06;
  }

  // Torso lean when sprinting
  rig.torso.rotation.x = walk * 0.09 + (airborne ? 0.05 : 0);
  rig.torso.rotation.y = swing * 0.05;
  rig.head.rotation.y = Math.sin(t * 0.7) * 0.05 + (attacking > 0 ? -0.16 : 0);

  // Attacks override the right arm and torso.
  if (attacking > 0) {
    const p = 1 - attacking; // 0..1 through the swing
    if (attackKind === 'ultimate') {
      rig.rightArm.rotation.x = -2.4 + p * 1.2;
      rig.rightArm.rotation.z = 0.7 - p * 0.5;
      rig.leftArm.rotation.x = -2.0 + p;
      rig.leftArm.rotation.z = -0.8 + p * 0.5;
      rig.torso.rotation.y = -0.5 + p;
    } else {
      const arc = Math.sin(clamp(p, 0, 1) * Math.PI);
      rig.rightArm.rotation.x = -2.2 + p * 3.1;
      rig.rightArm.rotation.z = 0.5 - arc * 1.35;
      rig.torso.rotation.y = -0.35 + p * 0.75;
      rig.head.rotation.y = -0.3 + p * 0.55;
    }
  } else if (block > 0) {
    rig.rightArm.rotation.x = -1.1;
    rig.leftArm.rotation.x = -1.1;
  }

  // Hit recoil
  if (hit > 0) {
    rig.body.rotation.z = Math.sin(hit * 30) * 0.06 * hit;
    rig.head.rotation.z = -hit * 0.18;
  } else {
    rig.head.rotation.z = 0;
  }
}

/* ------------------------------------------------------------------ */
/*  Enemy nameplate / health bar                                       */
/* ------------------------------------------------------------------ */

export function createHealthBar() {
  const c = document.createElement('canvas');
  c.width = 192; c.height = 40;
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
  sprite.scale.set(2.15, 0.45, 1);
  const draw = (ratio, label = '', boss = false) => {
    ctx.clearRect(0, 0, 192, 40);
    if (label) {
      ctx.font = '700 15px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(8,18,20,0.62)';
      ctx.fillText(label, 96, 14);
      ctx.fillStyle = '#fff8e8';
      ctx.fillText(label, 96, 13);
    }
    const x = 16, y = label ? 20 : 10, w = 160, h = 9;
    ctx.fillStyle = 'rgba(6,15,18,0.80)';
    ctx.beginPath(); ctx.roundRect(x - 2, y - 2, w + 4, h + 4, 5); ctx.fill();
    ctx.fillStyle = boss ? '#ff5a24' : '#ff6b5a';
    ctx.beginPath(); ctx.roundRect(x, y, w * clamp(ratio, 0, 1), h, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.36)';
    ctx.beginPath(); ctx.roundRect(x, y, w * clamp(ratio, 0, 1), 3, 2); ctx.fill();
    tex.needsUpdate = true;
  };
  draw(1);
  return { sprite, draw, texture: tex };
}

export function createMarker(kind = '!') {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
  sprite.scale.set(1.1, 1.1, 1);
  const draw = (icon = kind, color = '#ffc63c') => {
    ctx.clearRect(0, 0, 128, 128);
    ctx.beginPath(); ctx.arc(64, 64, 43, 0, TAU);
    ctx.fillStyle = 'rgba(10,24,26,0.72)'; ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = color; ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = '700 70px Bangers, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(icon, 64, 70);
    tex.needsUpdate = true;
  };
  draw(kind);
  return { sprite, draw, texture: tex };
}
