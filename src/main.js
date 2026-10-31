import * as THREE from 'three';
import { buildWorld, heightAt, nearestIsland, ISLANDS } from './world.js';
import {
  createHumanoid, animateRig, createHealthBar, createMarker,
} from './entities.js';
import { Particles, FloatingText, Effects } from './effects.js';
import { UI, FRUIT_DATA } from './ui.js';
import { AudioEngine } from './audio.js';
import { clamp, lerp, damp, TAU } from './noise.js';

/* ------------------------------------------------------------------ */
/*  Renderer, scene, camera                                            */
/* ------------------------------------------------------------------ */

const canvas = document.getElementById('scene');
const isTouch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.35 : 1.7));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1400);
camera.position.set(18, 17, 43);

const clock = new THREE.Clock();
const ui = new UI();
const audio = new AudioEngine();
const world = buildWorld(scene);
const particles = new Particles(scene, 1100);
const floating = new FloatingText(document.getElementById('damage-layer'), camera);
const effects = new Effects(scene, camera, particles, floating);

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function surfaceAt(x, z) {
  let h = heightAt(x, z);
  const dock = world.landmarks.dock;
  if (x > 40.4 && x < 64.4 && Math.abs(z) < 1.78) h = Math.max(h, 2.66);
  const arena = world.landmarks.bossArena;
  if (Math.hypot(x - arena.x, z - arena.z) < 12.2) h = Math.max(h, arena.y + 0.10);
  return h;
}

function angleLerp(a, b, t) {
  let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return a + d * clamp(t, 0, 1);
}

function forwardFromYaw(yaw) {
  return new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
}

const rand = (a, b) => a + Math.random() * (b - a);

function makeBlob(radius, opacity = 0.24) {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 18),
    new THREE.MeshBasicMaterial({ color: 0x041214, transparent: true, opacity, depthWrite: false })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.04;
  return mesh;
}

function makeWorldLabel(text, color = '#ffe6ac') {
  const c = document.createElement('canvas');
  c.width = 320; c.height = 80;
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
  sprite.scale.set(3.4, 0.85, 1);
  const draw = (label = text, tint = color) => {
    ctx.clearRect(0, 0, 320, 80);
    ctx.font = '700 22px Outfit, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(4,18,22,.62)';
    ctx.fillText(label, 160, 42);
    ctx.fillStyle = tint;
    ctx.fillText(label, 160, 40);
    tex.needsUpdate = true;
  };
  draw();
  return { sprite, draw };
}

/* ------------------------------------------------------------------ */
/*  Player                                                             */
/* ------------------------------------------------------------------ */

const spawn = world.landmarks.spawn;
const playerRig = createHumanoid('player');
scene.add(playerRig.group);
playerRig.group.add(makeBlob(0.9, 0.28));

const player = {
  rig: playerRig,
  pos: new THREE.Vector3(spawn.x, surfaceAt(spawn.x, spawn.z), spawn.z),
  vel: new THREE.Vector3(),
  yaw: spawn.yaw,
  targetYaw: spawn.yaw,
  radius: 0.52,
  onGround: true,
  swimming: false,
  jumpCount: 0,
  jumpQueued: false,
  hp: 100, maxHp: 100,
  energy: 100, maxEnergy: 100,
  level: 1, xp: 0, xpNeed: 70,
  beli: 0, bounty: 0,
  title: 'ROOKIE',
  fruit: 'ember',
  unlocked: ['ember'],
  swordLevel: 1,
  cooldowns: { dash: 0, skill: 0, ultimate: 0 },
  attackTimer: 0,
  attackDuration: 0.42,
  attackCooldown: 0,
  attackHitDone: false,
  combo: 0,
  comboTimer: 0,
  dashTimer: 0,
  dashDir: new THREE.Vector3(),
  invuln: 0,
  hurtTimer: 0,
  lastDamageTime: 0,
  onBoat: false,
  dead: false,
  respawning: false,
  actionLock: 0,
};
player.rig.group.position.copy(player.pos);
player.rig.group.rotation.y = player.yaw;

const game = {
  started: false,
  stage: 0,
  kills: 0,
  killsNeeded: 6,
  bossEngaged: false,
  bossDead: false,
  chestOpened: false,
  bossChestOpened: false,
  victoryShown: false,
  victoryTimer: 0,
  zone: null,
  fireCooldown: 0,
  currentInteraction: null,
  lastPrompt: null,
  lastSave: 0,
  tutorialShown: false,
  totalKills: 0,
  playTime: 0,
  discovered: new Set(),
};

const SAVE_KEY = 'fruitbound-save-v1';

/* ------------------------------------------------------------------ */
/*  Enemies                                                            */
/* ------------------------------------------------------------------ */

const enemies = [];
let boss = null;

class Enemy {
  constructor({ x, z, type = 'rogue', boss = false, home = false, elite = false, index = 0 }) {
    this.type = type;
    this.boss = boss;
    this.home = home;
    this.elite = elite;
    this.index = index;
    this.spawn = new THREE.Vector3(x, 0, z);
    this.pos = new THREE.Vector3(x, 0, z);
    this.yaw = Math.random() * TAU;
    this.speed = 0;
    this.alive = true;
    this.maxHp = boss ? 540 : type === 'corsair' ? 105 : elite ? 145 : 72;
    this.hp = this.maxHp;
    this.damage = boss ? 21 : type === 'corsair' ? 12 : elite ? 14 : 9;
    this.aggro = boss ? 26 : type === 'corsair' ? 20 : 17;
    this.attackRange = boss ? 4.4 : 2.7;
    this.attackTimer = 0;
    this.attackCooldown = rand(0.2, 1.2);
    this.didHit = false;
    this.rangedTimer = 0;
    this.rangedCooldown = rand(1.5, 4);
    this.slam = null;
    this.slamCooldown = 5;
    this.flash = 0;
    this.deadTimer = 0;
    this.respawnTimer = 0;
    this.engaged = false;
    this.auraTime = 0;
    this.rig = createHumanoid(boss ? 'boss' : type, { sword: true });
    this.group = this.rig.group;
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
    const shadow = makeBlob(boss ? 1.8 : type === 'corsair' ? 1.0 : 0.95, 0.26);
    this.group.add(shadow);
    this.shadow = shadow;
    if (!boss) {
      this.hpBar = createHealthBar();
      this.hpBar.sprite.position.y = 3.0;
      this.group.add(this.hpBar.sprite);
      this.hpBar.draw(1, type === 'corsair' ? 'EMBER CORSAIR' : elite ? 'ROGUE BRUTE' : 'ROGUE SAILOR');
    }
    if (boss) {
      this.rig.body.scale.setScalar(1.02);
      this.name = 'ASHBEARD';
    }
    this.group.traverse(o => { if (o.isMesh) { o.castShadow = !boss; } });
    this.pos.y = surfaceAt(x, z);
    this.group.position.y = this.pos.y;
    scene.add(this.group);
  }

  reset() {
    this.alive = true;
    this.hp = this.maxHp;
    this.pos.copy(this.spawn);
    this.pos.y = surfaceAt(this.pos.x, this.pos.z);
    this.group.position.copy(this.pos);
    this.group.visible = true;
    this.group.rotation.set(0, this.yaw, 0);
    this.rig.body.rotation.set(0, 0, 0);
    this.rig.body.position.set(0, 0, 0);
    this.deadTimer = 0;
    this.attackTimer = 0;
    this.slam = null;
    this.flash = 0;
    this.engaged = false;
    if (this.hpBar) {
      this.hpBar.sprite.visible = true;
      this.hpBar.draw(1, this.type === 'corsair' ? 'EMBER CORSAIR' : this.elite ? 'ROGUE BRUTE' : 'ROGUE SAILOR');
    }
  }

  takeDamage(amount, crit, fromDir = null) {
    if (!this.alive) return;
    if (this.boss && game.stage < 3) {
      ui.toast('The Ashen Crown is sealed. Speak with <b>Captain Rhea</b> first.', { icon: '☠', kind: 'danger', time: 2600 });
      return;
    }
    if (this.boss && !this.engaged) {
      this.engaged = true;
      engageBoss(this);
    }
    this.hp -= amount;
    this.flash = 0.18;
    if (this.hpBar) this.hpBar.draw(Math.max(0, this.hp / this.maxHp), this.type === 'corsair' ? 'EMBER CORSAIR' : this.elite ? 'ROGUE BRUTE' : 'ROGUE SAILOR');
    const p = this.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
    floating.spawn(p, `${Math.round(amount)}`, 'damage', { crit });
    effects.burst(p, crit ? 0xffd24a : 0xfff0b0, crit ? 18 : 10, { speed: 6, size: 0.55, life: 0.45, gravity: 4, spread: 0.35 });
    if (this.boss) {
      effects.particles.spawn(p.x, p.y, p.z, { color: 0xff5a1a, count: 10, speed: 5, size: 0.9, life: 0.6, gravity: 1 });
    }
    if (fromDir) {
      this.pos.addScaledVector(fromDir, crit ? 0.6 : 0.32);
      this.pos.y = surfaceAt(this.pos.x, this.pos.z);
    }
    audio.hit(crit);
    if (this.hp <= 0) this.die();
  }

  die() {
    this.alive = false;
    this.deadTimer = 4.2;
    if (this.hpBar) this.hpBar.sprite.visible = false;
    this.speed = 0;
    this.attackTimer = 0;
    const p = this.pos.clone().add(new THREE.Vector3(0, 1.1, 0));
    effects.burst(p, this.boss ? 0xff4a12 : 0xffd48a, this.boss ? 50 : 22, { speed: this.boss ? 12 : 6, size: this.boss ? 1.4 : 0.7, life: 1.2, gravity: 3, spread: 0.6 });
    if (this.boss) {
      effects.explosion(p, { color: 0xff5a1a, radius: 9, duration: 1.2, particleCount: 80 });
      effects.pillars(this.pos, 0xff5a1a, 12, 7);
      effects.shakeCamera(1.1);
      effects.screenFlash(0.55);
      audio.explosion();
      audio.roar();
      onBossDefeated(this);
    } else {
      audio.hit(true);
      if (this.home) {
        game.totalKills++;
        if (game.stage === 1) {
          game.kills = Math.min(game.killsNeeded, game.kills + 1);
          if (game.kills >= game.killsNeeded) {
            game.stage = 2;
            questChanged(true);
            ui.toast('The raiders are broken. Return to <b>Captain Rhea</b>.', { icon: '⚑', kind: 'gold' });
            audio.quest();
          } else {
            questChanged(false);
            ui.toast(`Rogue defeated · <b>${game.kills} / ${game.killsNeeded}</b>`, { icon: '⚔' });
          }
        }
        addBounty(3500 + player.level * 500);
      } else {
        addBounty(9000 + player.level * 1000);
      }
      const xp = this.type === 'corsair' ? 55 : this.elite ? 70 : 38;
      const beli = this.type === 'corsair' ? rand(45, 75) : this.elite ? rand(55, 90) : rand(22, 42);
      addXP(xp + player.level * 4);
      dropCoins(this.pos, beli, 4 + Math.floor(Math.random() * 3));
      floating.spawn(p, `+${xp} XP`, 'xp', { life: 1.2 });
      this.respawnTimer = this.home ? 24 : 32;
    }
    this.rig.group.traverse(o => { if (o.isMesh) o.castShadow = false; });
  }

  update(dt, time) {
    if (!this.alive) {
      this.deadTimer -= dt;
      animateRig(this.rig, { time, dead: true });
      if (this.deadTimer <= 0) this.group.visible = false;
      if (this.respawnTimer > 0) {
        this.respawnTimer -= dt;
        if (this.respawnTimer <= 0) this.reset();
      }
      return;
    }
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 5);
      const v = this.flash / 0.18;
      this.rig.flashTargets.forEach(m => { m.emissive.setHex(0xff2a10); m.emissiveIntensity = v * 1.6; });
    } else {
      this.rig.flashTargets.forEach(m => { m.emissiveIntensity = 0; });
    }

    if (!game.started || player.dead || player.onBoat) {
      this.speed = damp(this.speed, 0, 8, dt);
      animateRig(this.rig, { time, speed: 0, hit: this.flash });
      return;
    }

    const dx = player.pos.x - this.pos.x;
    const dz = player.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const dy = player.pos.y - this.pos.y;
    const canSee = Math.abs(dy) < 7;
    if (this.boss && game.stage < 3) {
      this.speed = 0;
      animateRig(this.rig, { time, speed: 0 });
      return;
    }
    if (this.boss && !this.engaged && dist < this.aggro && game.stage >= 3) engageBoss(this);

    this.attackCooldown -= dt;
    this.rangedCooldown -= dt;
    this.slamCooldown -= dt;

    let moving = false;
    const awake = this.boss ? this.engaged : dist < this.aggro;
    if (awake && canSee && dist < (this.boss ? 60 : 32)) {
      if (this.boss && this.slam) {
        this.slam.t -= dt;
        this.speed = damp(this.speed, 0, 10, dt);
        this.yaw = angleLerp(this.yaw, Math.atan2(-dx, -dz), 1 - Math.exp(-8 * dt));
        if (this.slam.t <= 0) {
          const sx = this.slam.x, sz = this.slam.z, rad = this.slam.radius;
          const sy = surfaceAt(sx, sz);
          effects.explosion(new THREE.Vector3(sx, sy + 0.6, sz), { color: 0xff5a1a, radius: rad * 0.9, duration: 0.65, particleCount: 46 });
          effects.pillars(new THREE.Vector3(sx, sy, sz), 0xff6a1a, 7, rad * 0.7);
          effects.shakeCamera(0.7);
          audio.explosion();
          if (Math.hypot(player.pos.x - sx, player.pos.z - sz) < rad) {
            damagePlayer(this.hp < this.maxHp * 0.35 ? 34 : 25, this);
          }
          this.slam = null;
          this.slamCooldown = this.hp < this.maxHp * 0.35 ? 4.6 : 6.8;
        }
      } else if (dist > this.attackRange * 0.9) {
        const nx = dx / (dist || 1), nz = dz / (dist || 1);
        const sp = this.boss ? (this.hp < this.maxHp * 0.35 ? 5.4 : 4.2) : this.type === 'corsair' ? 3.6 : this.elite ? 4.1 : 3.8;
        const step = sp * dt;
        const nextX = this.pos.x + nx * step;
        const nextZ = this.pos.z + nz * step;
        if (surfaceAt(nextX, nextZ) > 0.2) {
          this.pos.x = nextX;
          this.pos.z = nextZ;
          moving = true;
        }
        this.speed = damp(this.speed, sp, 8, dt);
        this.yaw = angleLerp(this.yaw, Math.atan2(-nx, -nz), 1 - Math.exp(-9 * dt));
      } else {
        this.speed = damp(this.speed, 0, 10, dt);
        this.yaw = angleLerp(this.yaw, Math.atan2(-dx, -dz), 1 - Math.exp(-10 * dt));
      }

      // Melee
      if (this.attackTimer > 0) {
        this.attackTimer -= dt;
        if (!this.didHit && this.attackTimer <= 0.18) {
          this.didHit = true;
          const fwd = forwardFromYaw(this.yaw);
          effects.slash(this.rig.group.position.clone(), this.yaw, this.boss ? 0xff6a2a : 0xffd0a0, this.boss ? 1.5 : 0.8, -1);
          audio.swing();
          if (dist < this.attackRange + 0.5 && Math.abs(dy) < 2.4) {
            damagePlayer(this.boss && this.hp < this.maxHp * 0.35 ? 28 : this.damage, this);
          }
        }
        this.speed = 0;
      } else if (dist < this.attackRange && this.attackCooldown <= 0) {
        this.attackTimer = this.boss ? 0.62 : 0.48;
        this.didHit = false;
        this.attackCooldown = this.boss ? rand(1.5, 2.2) : rand(1.15, 1.8);
      }

      // Ranged corsair volley
      if (this.type === 'corsair' && !this.boss && dist > 7 && dist < 19 && this.rangedCooldown <= 0 && this.rangedTimer <= 0) {
        this.rangedTimer = 0.55;
      }
      if (this.rangedTimer > 0) {
        this.rangedTimer -= dt;
        if (this.rangedTimer <= 0.02) {
          this.rangedTimer = 0;
          const origin = this.pos.clone().add(new THREE.Vector3(0, 1.9, 0)).addScaledVector(forwardFromYaw(this.yaw), 0.7);
          const target = player.pos.clone().add(new THREE.Vector3(0, 1.1, 0));
          const dir = target.sub(origin).normalize();
          spawnEnemyProjectile(origin, dir, 13, 11);
          this.rangedCooldown = rand(3.4, 5.2);
        }
      }
    } else {
      // wander near the spawn
      this.speed = damp(this.speed, 0, 5, dt);
      if (awake && dist > this.attackRange) {
        const nx = dx / (dist || 1), nz = dz / (dist || 1);
        this.yaw = angleLerp(this.yaw, Math.atan2(-nx, -nz), 1 - Math.exp(-4 * dt));
      }
    }

    // Boss ground-slam telegraph
    if (this.boss && this.engaged && !this.slam && dist < 16 && this.slamCooldown <= 0) {
      const sx = player.pos.x, sz = player.pos.z;
      this.slam = { t: 1.1, x: sx, z: sz, radius: 5.4 };
      effects.telegraph(new THREE.Vector3(sx, surfaceAt(sx, sz) + 0.12, sz), 5.4, 1.1);
      this.slamCooldown = 999;
      audio.roar();
    }

    if (moving) {
      this.pos.y = damp(this.pos.y, surfaceAt(this.pos.x, this.pos.z), 16, dt);
    }
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
    animateRig(this.rig, {
      time, speed: this.speed, attacking: this.attackTimer > 0 ? this.attackTimer / (this.boss ? 0.62 : 0.48) : 0,
      hit: this.flash,
    });

    if (this.boss && this.engaged && this.alive) {
      this.auraTime += dt;
      if (Math.random() < dt * 18) {
        const p = this.pos.clone().add(new THREE.Vector3(rand(-1, 1), rand(0.4, 3), rand(-1, 1)));
        effects.particles.spawn(p.x, p.y, p.z, { color: this.hp < this.maxHp * 0.35 ? 0xff2a00 : 0xff7a22, count: 1, speed: 1, size: 0.8, life: 0.8, gravity: -1, spread: 0.4 });
      }
    }
  }
}

function spawnEnemy(def) {
  const e = new Enemy(def);
  enemies.push(e);
  return e;
}

/* ------------------------------------------------------------------ */
/*  World characters                                                   */
/* ------------------------------------------------------------------ */

const npcPos = world.landmarks.npc;
const npcRig = createHumanoid('npc', { sword: false });
npcRig.group.position.set(npcPos.x, surfaceAt(npcPos.x, npcPos.z), npcPos.z);
npcRig.group.rotation.y = 2.2;
npcRig.group.add(makeBlob(0.8, 0.24));
scene.add(npcRig.group);
const npcLabel = makeWorldLabel('CAPTAIN RHEA', '#ffe0a0');
npcLabel.sprite.position.set(0, 3.1, 0);
npcRig.group.add(npcLabel.sprite);
const npcMarker = createMarker('!');
npcMarker.sprite.position.set(0, 3.95, 0);
npcRig.group.add(npcMarker.sprite);

world.homeSpawns.forEach((s, i) => {
  spawnEnemy({ x: s.x, z: s.z, type: 'rogue', home: true, elite: i === 0 || i === 5, index: i });
});
world.emberSpawns.forEach((s, i) => {
  spawnEnemy({ x: s.x, z: s.z, type: 'corsair', home: false, elite: i === 0, index: i });
});
boss = spawnEnemy({ x: world.landmarks.bossArena.x, z: world.landmarks.bossArena.z - 2, type: 'boss', boss: true, home: false });
boss.group.visible = true;

const questMarker = createMarker('◆');
questMarker.draw('◆', '#4cf0d6');
questMarker.sprite.scale.set(1.25, 1.25, 1);
scene.add(questMarker.sprite);

/* ------------------------------------------------------------------ */
/*  Coins / pickups                                                    */
/* ------------------------------------------------------------------ */

const coins = [];
const coinGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.055, 8);
const coinMat = new THREE.MeshStandardMaterial({ color: 0xffc857, metalness: 0.7, roughness: 0.28, emissive: 0x9a5d00, emissiveIntensity: 0.55 });

function dropCoins(pos, total, count) {
  const value = Math.max(1, Math.round(total / count));
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(coinGeo, coinMat);
    mesh.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
    mesh.position.set(pos.x + rand(-1, 1), pos.y + 1.0, pos.z + rand(-1, 1));
    scene.add(mesh);
    coins.push({
      mesh,
      value,
      age: 0,
      vy: rand(2, 5),
      vx: rand(-1.6, 1.6),
      vz: rand(-1.6, 1.6),
      base: surfaceAt(mesh.position.x, mesh.position.z),
    });
  }
}

function updateCoins(dt) {
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    c.age += dt;
    c.mesh.rotation.y += dt * 5;
    c.mesh.rotation.x += dt * 2;
    const dx = player.pos.x - c.mesh.position.x;
    const dz = player.pos.z - c.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    if (c.age > 0.35 && dist < 7) {
      const pull = 18 * dt;
      c.mesh.position.x += (dx / (dist || 1)) * pull;
      c.mesh.position.z += (dz / (dist || 1)) * pull;
      c.mesh.position.y = damp(c.mesh.position.y, player.pos.y + 1.1, 7, dt);
    } else {
      c.vy -= 18 * dt;
      c.mesh.position.x += c.vx * dt;
      c.mesh.position.z += c.vz * dt;
      c.mesh.position.y += c.vy * dt;
      if (c.mesh.position.y < c.base + 0.15) {
        c.mesh.position.y = c.base + 0.15;
        c.vy *= -0.35;
        c.vx *= 0.7; c.vz *= 0.7;
      }
    }
    if (dist < 1.2 && Math.abs(player.pos.y + 1 - c.mesh.position.y) < 2.5) {
      player.beli += c.value;
      audio.coin();
      floating.spawn(c.mesh.position.clone(), `+${c.value}`, 'info', { life: 0.65 });
      scene.remove(c.mesh);
      coins.splice(i, 1);
    } else if (c.age > 40) {
      scene.remove(c.mesh);
      coins.splice(i, 1);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Projectiles                                                        */
/* ------------------------------------------------------------------ */

const playerProjectiles = [];
const enemyProjectiles = [];
const pendingStrikes = [];

function makeGlowSprite(color, size) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,.95)');
  g.addColorStop(0.25, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  sprite.scale.set(size, size, 1);
  return sprite;
}

function spawnPlayerProjectile(kind, origin, dir) {
  const data = {
    ember: { color: 0xff7a1a, glow: 'rgba(255,112,30,.85)', speed: 31, damage: 26 + player.level * 3.5, radius: 4.3, life: 1.6, size: 0.34 },
    gale: { color: 0x5cffe6, glow: 'rgba(90,255,230,.85)', speed: 44, damage: 20 + player.level * 2.6, radius: 2.4, life: 1.2, size: 0.45 },
    tide: { color: 0x5ab9ff, glow: 'rgba(80,180,255,.85)', speed: 23, damage: 28 + player.level * 3.1, radius: 5.2, life: 1.7, size: 0.6 },
  }[kind];
  const group = new THREE.Group();
  if (kind === 'gale') {
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.6, 0.10, 5, 16, Math.PI * 1.35),
      new THREE.MeshBasicMaterial({ color: data.color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    mesh.rotation.y = Math.PI / 2;
    group.add(mesh);
  } else if (kind === 'tide') {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), new THREE.MeshBasicMaterial({ color: 0xbff3ff, transparent: true, opacity: 0.9 }));
    mesh.scale.set(1.5, 1.1, 1.5);
    group.add(mesh);
  } else {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(data.size, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff0b0 }));
    group.add(mesh);
  }
  group.add(makeGlowSprite(data.glow, kind === 'tide' ? 3.2 : 2.2));
  group.position.copy(origin);
  scene.add(group);
  playerProjectiles.push({
    group, kind, data, dir: dir.clone(), life: data.life, traveled: 0,
    hitSet: new Set(), trailTimer: 0,
  });
  audio.fireball();
}

function spawnEnemyProjectile(origin, dir, speed, damage) {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff6a1a }));
  group.add(mesh);
  group.add(makeGlowSprite('rgba(255,90,20,.8)', 1.8));
  group.position.copy(origin);
  scene.add(group);
  enemyProjectiles.push({ group, dir: dir.clone(), speed, damage, life: 2.4, trail: 0 });
}

function explodeAt(pos, radius, color, particleCount = 35) {
  effects.explosion(pos, { color, radius, duration: 0.7, particleCount });
  audio.explosion();
}

function updateProjectiles(dt) {
  for (let i = playerProjectiles.length - 1; i >= 0; i--) {
    const p = playerProjectiles[i];
    p.life -= dt;
    const step = p.data.speed * dt;
    p.group.position.addScaledVector(p.dir, step);
    p.traveled += step;
    p.trailTimer -= dt;
    if (p.trailTimer <= 0) {
      p.trailTimer = 0.03;
      const col = p.kind === 'gale' ? 0x5cffe6 : p.kind === 'tide' ? 0x5ab9ff : 0xff8a2a;
      effects.particles.spawn(p.group.position.x, p.group.position.y, p.group.position.z, {
        color: col, count: 2, speed: 1.2, size: p.kind === 'tide' ? 1.2 : 0.7, life: 0.4, gravity: -0.4, spread: 0.2, drag: 2,
      });
    }
    let hit = false;
    for (const e of enemies) {
      if (!e.alive || p.hitSet.has(e)) continue;
      if (e.boss && !e.engaged) continue;
      const d = p.group.position.distanceTo(e.pos.clone().add(new THREE.Vector3(0, 1, 0)));
      if (d < (e.boss ? 2.8 : 1.5) + p.data.size) {
        p.hitSet.add(e);
        if (p.kind === 'gale') {
          e.takeDamage(p.data.damage * 0.75, Math.random() < 0.2, p.dir);
          hit = true;
        } else {
          e.takeDamage(p.data.damage, Math.random() < 0.2, p.dir);
          hit = true;
        }
      }
    }
    const ground = surfaceAt(p.group.position.x, p.group.position.z);
    const waterHit = p.group.position.y <= 0.2;
    if (hit || p.group.position.y <= ground + 0.2 || waterHit || p.life <= 0) {
      const pos = p.group.position.clone();
      if (p.kind === 'gale') {
        if (hit) {
          effects.burst(pos, 0x5cffe6, 24, { speed: 7, size: 0.9, life: 0.5, gravity: 0 });
          effects.ring(new THREE.Vector3(pos.x, Math.max(pos.y, ground + 0.1), pos.z), 0x5cffe6, 2.8, 0.4, 0.6);
          audio.hit(false);
          // Gale pierces, so keep flying for a moment.
          if (p.life > 0 && !waterHit) continue;
        }
        scene.remove(p.group);
        playerProjectiles.splice(i, 1);
        continue;
      }
      if (waterHit) {
        effects.burst(pos, 0x9ff4ff, 20, { speed: 5, size: 1, life: 0.6, gravity: 7 });
        audio.wave();
      } else {
        explodeAt(pos, p.data.radius, p.kind === 'tide' ? 0x63c5ff : 0xff7a2a, p.kind === 'tide' ? 48 : 35);
        if (p.kind === 'tide') effects.ring(new THREE.Vector3(pos.x, Math.max(ground + 0.1, 0.1), pos.z), 0x7fd8ff, p.data.radius * 1.6, 0.7, 1.1);
      }
      // AoE damage
      for (const e of enemies) {
        if (!e.alive) continue;
        if (e.boss && !e.engaged) continue;
        const d = Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z);
        if (d < p.data.radius) {
          const falloff = 1 - clamp(d / p.data.radius, 0, 0.55);
          e.takeDamage(p.data.damage * (0.55 + falloff * 0.55), Math.random() < 0.18, new THREE.Vector3(e.pos.x - pos.x, 0, e.pos.z - pos.z).normalize());
        }
      }
      scene.remove(p.group);
      playerProjectiles.splice(i, 1);
    }
  }

  for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
    const p = enemyProjectiles[i];
    p.life -= dt;
    p.group.position.addScaledVector(p.dir, p.speed * dt);
    p.group.rotation.x += dt * 9;
    p.trail -= dt;
    if (p.trail <= 0) {
      p.trail = 0.05;
      effects.particles.spawn(p.group.position.x, p.group.position.y, p.group.position.z, {
        color: 0xff5a1a, count: 1, speed: 0.6, size: 0.65, life: 0.35, gravity: -0.3, spread: 0.2, drag: 2,
      });
    }
    const ground = surfaceAt(p.group.position.x, p.group.position.z);
    if (p.group.position.y <= ground + 0.1 || p.group.position.y <= 0.1 || p.life <= 0) {
      const pos = p.group.position.clone();
      effects.burst(pos, 0xff6a1a, 18, { speed: 5, size: 0.9, life: 0.6, gravity: 3 });
      if (pos.distanceTo(player.pos.clone().add(new THREE.Vector3(0, 1, 0))) < 1.7) damagePlayer(p.damage, null);
      scene.remove(p.group);
      enemyProjectiles.splice(i, 1);
      continue;
    }
    const d = p.group.position.distanceTo(player.pos.clone().add(new THREE.Vector3(0, 1.1, 0)));
    if (d < 1.25) {
      damagePlayer(p.damage, null);
      effects.burst(p.group.position, 0xff6a1a, 16, { speed: 4, size: 0.8, life: 0.5, gravity: 2 });
      scene.remove(p.group);
      enemyProjectiles.splice(i, 1);
    }
  }

  for (let i = pendingStrikes.length - 1; i >= 0; i--) {
    const s = pendingStrikes[i];
    s.t -= dt;
    if (s.t <= 0) { s.fn(); pendingStrikes.splice(i, 1); }
  }
}

/* ------------------------------------------------------------------ */
/*  Progression                                                        */
/* ------------------------------------------------------------------ */

function xpNeeded(level) {
  return Math.floor(70 * Math.pow(level, 1.42));
}

function addBounty(amount) {
  player.bounty += Math.round(amount);
  const titles = [[0, 'ROOKIE'], [50000, 'RISING TIDE'], [200000, 'SEA SCOURGE'], [600000, 'GRAND TIDE'], [1200000, 'LEGEND']];
  for (const [threshold, title] of titles) if (player.bounty >= threshold) player.title = title;
}

function addXP(amount) {
  player.xp += amount;
  let leveled = false;
  while (player.xp >= player.xpNeed) {
    player.xp -= player.xpNeed;
    player.level += 1;
    player.xpNeed = xpNeeded(player.level);
    player.maxHp = 100 + (player.level - 1) * 16;
    player.maxEnergy = 100 + (player.level - 1) * 6;
    player.hp = player.maxHp;
    player.energy = player.maxEnergy;
    leveled = true;
    ui.levelUp(player.level);
    ui.toast(`Level <b>${player.level}</b> · Vitality restored`, { icon: '★', kind: 'gold' });
    audio.levelUp();
    effects.heal(player.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), 0xffd76a);
    ui.whiteFlash(0.12);
  }
  if (leveled) {
    if (player.level >= 3 && player.level - 1 < 3) {
      ui.toast('<b>ULTIMATE UNLOCKED</b> · Press R to unleash your fruit', { icon: '✹', kind: 'gold', time: 5200 });
    }
    saveGame();
  }
}

/* ------------------------------------------------------------------ */
/*  Damage / death                                                     */
/* ------------------------------------------------------------------ */

function damagePlayer(amount, source) {
  if (player.dead || player.invuln > 0 || game.stage >= 4 && ui.victorious) return;
  player.invuln = 0.7;
  player.hp -= amount;
  player.lastDamageTime = game.playTime;
  player.hurtTimer = 0.25;
  ui.hurtFlash();
  effects.shakeCamera(0.22);
  effects.burst(player.pos.clone().add(new THREE.Vector3(0, 1.3, 0)), 0xff5a44, 12, { speed: 3, size: 0.6, life: 0.5, gravity: 3 });
  floating.spawn(player.pos.clone().add(new THREE.Vector3(0, 2.2, 0)), `-${Math.round(amount)}`, 'hurt');
  audio.hurt();
  if (source) {
    const knock = player.pos.clone().sub(source.pos).setY(0).normalize().multiplyScalar(0.7);
    player.pos.add(knock);
  }
  if (player.hp <= 0) {
    player.hp = 0;
    killPlayer();
  }
}

function killPlayer() {
  player.dead = true;
  player.hp = 0;
  player.onBoat = false;
  player.rig.group.visible = true;
  boatState.boarded = false;
  const loss = Math.min(player.beli, Math.round(player.beli * 0.1));
  player.beli -= loss;
  ui.setHealth(0, player.maxHp);
  ui.showDeath(loss, 3);
  effects.shakeCamera(0.7);
  audio.hurt();
  clearKeys();
  setTimeout(() => {
    if (!player.dead) return;
    respawnPlayer();
  }, 3400);
}

function respawnPlayer() {
  player.dead = false;
  player.hp = player.maxHp;
  player.energy = player.maxEnergy;
  player.pos.set(spawn.x, surfaceAt(spawn.x, spawn.z), spawn.z);
  player.vel.set(0, 0, 0);
  player.yaw = spawn.yaw;
  player.invuln = 1.5;
  player.rig.group.visible = true;
  player.rig.body.rotation.set(0, 0, 0);
  player.rig.group.position.copy(player.pos);
  ui.hideDeath();
  look.yaw = spawn.yaw;
  look.pitch = 0.25;
  camera.position.set(spawn.x + Math.sin(spawn.yaw) * 8, player.pos.y + 4, spawn.z + Math.cos(spawn.yaw) * 8);
  ui.toast('Dawn Harbor\'s fire mends your wounds.', { icon: '♥', kind: 'gold' });
  game.stage = game.stage >= 3 ? 3 : game.stage;
  saveGame();
}

/* ------------------------------------------------------------------ */
/*  Abilities                                                          */
/* ------------------------------------------------------------------ */

const FRUIT_ABILITY = {
  ember: { cost: 20, cooldown: 4.2, ultCost: 45, ultCooldown: 24, ultRadius: 9.5 },
  gale: { cost: 18, cooldown: 3.4, ultCost: 42, ultCooldown: 22, ultRadius: 10.5 },
  tide: { cost: 22, cooldown: 4.8, ultCost: 48, ultCooldown: 26, ultRadius: 10 },
};

function canAct() {
  return game.started && !player.dead && !player.onBoat && !ui.paused && !ui.dialogueOpen && !ui.mapOpen && !ui.helpOpen && !ui.victorious;
}

function castSkill() {
  if (!canAct() || player.swimming) return;
  const def = FRUIT_ABILITY[player.fruit];
  if (player.cooldowns.skill > 0) { audio.error(); return; }
  if (player.energy < def.cost) { ui.toast('Not enough energy', { icon: '✺', kind: 'danger', time: 1600 }); audio.error(); return; }
  player.energy -= def.cost;
  player.cooldowns.skill = def.cooldown;
  const yaw = look.yaw;
  player.yaw = yaw;
  player.actionLock = 0.32;
  const origin = player.pos.clone().add(new THREE.Vector3(0, 1.35, 0)).addScaledVector(forwardFromYaw(yaw), 0.9);
  spawnPlayerProjectile(player.fruit, origin, forwardFromYaw(yaw).normalize());
  ui.pulseSlot('skill');
  effects.particles.spawn(origin.x, origin.y, origin.z, {
    color: player.fruit === 'ember' ? 0xff9a3a : player.fruit === 'gale' ? 0x6cffe8 : 0x7fc9ff,
    count: 16, speed: 4, size: 0.7, life: 0.4, gravity: 0, spread: 0.3, drag: 2,
  });
}

function castUltimate() {
  if (!canAct() || player.swimming) return;
  if (player.level < 3) {
    ui.toast('Ultimate unlocks at <b>Level 3</b>', { icon: '🔒', kind: 'danger', time: 2200 });
    audio.error();
    return;
  }
  const def = FRUIT_ABILITY[player.fruit];
  if (player.cooldowns.ultimate > 0) { audio.error(); return; }
  if (player.energy < def.ultCost) { ui.toast('Not enough energy', { icon: '✺', kind: 'danger', time: 1600 }); audio.error(); return; }
  player.energy -= def.ultCost;
  player.cooldowns.ultimate = def.ultCooldown;
  player.actionLock = 0.65;
  player.yaw = look.yaw;
  ui.pulseSlot('ultimate');
  const c = player.pos.clone().add(new THREE.Vector3(0, 0.35, 0));
  const base = {
    ember: { color: 0xff5a1a, ring: 0xffd26a, dmg: 62 + player.level * 7, name: 'INFERNO' },
    gale: { color: 0x54f7dc, ring: 0xc8fff4, dmg: 50 + player.level * 6, name: 'CYCLONE' },
    tide: { color: 0x4fb6ff, ring: 0xbcecff, dmg: 56 + player.level * 6.5, name: 'MAELSTROM' },
  }[player.fruit];
  audio.wave();
  effects.screenFlash(0.22);
  effects.shakeCamera(0.55);
  ui.setBoss({ visible: game.bossEngaged && !game.bossDead, hp: boss.hp / boss.maxHp });
  ui.toast(`<b>${base.name}</b> unleashed`, { icon: '✹', kind: 'gold', time: 1600 });

  if (player.fruit === 'ember') {
    effects.explosion(c, { color: base.color, radius: def.ultRadius, duration: 1.0, particleCount: 70 });
    effects.pillars(c, base.color, 12, def.ultRadius * 0.72);
    effects.ring(c, base.ring, def.ultRadius * 1.5, 1.0, 1.4);
    damageArea(c, def.ultRadius, base.dmg, true);
    audio.explosion();
  } else if (player.fruit === 'gale') {
    effects.ring(c, base.color, 3, 0.6, 0.8);
    for (let i = 0; i < 3; i++) {
      pendingStrikes.push({
        t: 0.15 + i * 0.22,
        fn: () => {
          effects.ring(c, i % 2 ? 0x9effed : base.color, def.ultRadius * (0.7 + i * 0.18), 0.55, 1.1);
          effects.particles.spawn(c.x, c.y + 1, c.z, { color: base.color, count: 30, speed: 11, size: 0.8, life: 0.7, gravity: -2, spread: 0.5, drag: 1.4 });
          damageArea(c, def.ultRadius, base.dmg / 3, i === 2);
          audio.wave();
        },
      });
    }
  } else {
    const target = c.clone().addScaledVector(forwardFromYaw(look.yaw), 5);
    target.y = surfaceAt(target.x, target.z) + 0.3;
    effects.ring(target, base.color, def.ultRadius, 1.1, 1.5);
    effects.ring(target, base.ring, def.ultRadius * 0.7, 0.8, 0.8);
    effects.particles.spawn(target.x, target.y + 0.5, target.z, { color: base.color, count: 60, speed: 13, size: 1.1, life: 0.9, gravity: -2, spread: 1, drag: 1.2 });
    for (let i = 0; i < 2; i++) {
      pendingStrikes.push({
        t: 0.3 + i * 0.28,
        fn: () => {
          damageArea(target, def.ultRadius, base.dmg / 2, i === 1);
          effects.particles.spawn(target.x, target.y + 1, target.z, { color: base.ring, count: 30, speed: 10, size: 0.9, life: 0.6, gravity: -2, spread: 0.7, drag: 1.5 });
          audio.wave();
        },
      });
    }
  }
  saveGame();
}

function damageArea(pos, radius, damage, big = false) {
  for (const e of enemies) {
    if (!e.alive) continue;
    if (e.boss && !e.engaged) continue;
    const d = Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z);
    if (d < radius) {
      const dir = new THREE.Vector3(e.pos.x - pos.x, 0, e.pos.z - pos.z).normalize();
      e.takeDamage(damage * (1 - clamp(d / radius, 0, 0.4) * 0.4), big || Math.random() < 0.18, dir);
    }
  }
}

function dash() {
  if (!canAct() || player.swimming) return;
  if (player.cooldowns.dash > 0) { audio.error(); return; }
  player.cooldowns.dash = 5.2;
  const move = getMoveInput();
  let dir;
  if (Math.abs(move.x) + Math.abs(move.y) > 0.1) {
    dir = new THREE.Vector3(-Math.sin(look.yaw), 0, -Math.cos(look.yaw)).multiplyScalar(move.y)
      .add(new THREE.Vector3(Math.cos(look.yaw), 0, -Math.sin(look.yaw)).multiplyScalar(move.x)).normalize();
  } else {
    dir = forwardFromYaw(player.yaw);
  }
  player.dashDir.copy(dir);
  player.dashTimer = 0.22;
  player.invuln = Math.max(player.invuln, 0.28);
  player.actionLock = 0.25;
  player.yaw = Math.atan2(-dir.x, -dir.z);
  effects.ring(player.pos.clone().add(new THREE.Vector3(0, 0.15, 0)), player.fruit === 'gale' ? 0x6cffe8 : 0xffffff, 2.2, 0.35, 0.5);
  effects.burst(player.pos.clone().add(new THREE.Vector3(0, 1, 0)), 0xcffcf6, 16, { speed: 4, size: 0.6, life: 0.4, gravity: 0 });
  audio.dash();
  ui.pulseSlot('dash');
}

function tryAttack() {
  if (!canAct() || player.swimming) return;
  if (player.attackCooldown > 0) return;
  if (player.comboTimer <= 0) player.combo = 0;
  const combo = player.combo % 3;
  player.attackTimer = player.attackDuration;
  player.attackCooldown = combo === 2 ? 0.46 : 0.34;
  player.attackHitDone = false;
  player.comboTimer = 0.95;
  player.combo = combo + 1;
  player.yaw = look.yaw;
  player.actionLock = 0.2;
  audio.swing();
  const fwd = forwardFromYaw(player.yaw);
  player.vel.addScaledVector(fwd, combo === 2 ? 3.2 : 1.5);
  effects.slash(player.pos.clone().addScaledVector(fwd, 0.9), player.yaw, combo === 2 ? 0xffe39a : 0xc8f8ff, combo === 2 ? 1.2 : 0.9, 1);
}

function swordHit() {
  const combo = (player.combo - 1) % 3;
  const base = 12 + player.level * 2.4 + (player.swordLevel - 1) * 6;
  const dmg = base * (combo === 2 ? 1.65 : combo === 1 ? 1.18 : 1);
  const fwd = forwardFromYaw(player.yaw);
  let hitAny = false;
  for (const e of enemies) {
    if (!e.alive) continue;
    if (e.boss && !e.engaged) continue;
    const dx = e.pos.x - player.pos.x;
    const dz = e.pos.z - player.pos.z;
    const dist = Math.hypot(dx, dz);
    const range = e.boss ? 4.7 : 3.35;
    if (dist > range) continue;
    if (Math.abs(e.pos.y - player.pos.y) > 3.2) continue;
    const nd = new THREE.Vector3(dx, 0, dz).normalize();
    if (nd.dot(fwd) < 0.28) continue;
    const crit = Math.random() < 0.17;
    e.takeDamage(dmg * (crit ? 1.8 : 1), crit, nd);
    effects.shakeCamera(crit ? 0.24 : 0.12);
    hitAny = true;
  }
  if (hitAny) {
    ui.pulseSlot('attack');
    effects.screenFlash(0.03);
  }
}

/* ------------------------------------------------------------------ */
/*  Quest / boss / dialogue                                            */
/* ------------------------------------------------------------------ */

function questChanged(celebrate = false) {
  const stage = game.stage;
  let title = 'The Rogue Tide', objective = '', progress = game.kills, total = game.killsNeeded, chapter = 'CH. 1';
  if (stage === 0) {
    objective = 'Talk to Captain Rhea at Dawn Harbor.';
    total = 0;
    chapter = 'CH. 1';
  } else if (stage === 1) {
    objective = 'Defeat the rogue sailors raiding the north beach.';
    chapter = 'CH. 1';
  } else if (stage === 2) {
    objective = 'Return to Captain Rhea at the harbor.';
    chapter = 'CH. 1';
  } else if (stage === 3) {
    title = 'The Ashen Crown';
    objective = 'Sail east to Ember Isle and defeat Captain Ashbeard.';
    chapter = 'CH. 2';
    progress = 0; total = 0;
  } else {
    title = 'The Grand Tide';
    objective = 'The Ashen Crown is broken. Sail wherever the wind takes you.';
    chapter = 'EPILOGUE';
    progress = 1; total = 1;
  }
  ui.setQuest({ title, objective, progress, total, chapter, distance: questDistance(), showProgress: total > 0 });
  updateMarker();
  if (celebrate) ui.whiteFlash(0.1);
}

function questTarget() {
  if (game.stage === 0 || game.stage === 2) return { x: npcPos.x, z: npcPos.z, label: 'Captain Rhea' };
  if (game.stage === 1) return { x: world.landmarks.rogueCamp.x, z: world.landmarks.rogueCamp.z, label: 'Rogue camp' };
  if (game.stage === 3 && !game.bossDead) return { x: world.landmarks.bossArena.x, z: world.landmarks.bossArena.z, label: 'Ashbeard' };
  return null;
}

function questDistance() {
  const t = questTarget();
  if (!t) return null;
  return Math.hypot(player.pos.x - t.x, player.pos.z - t.z);
}

function updateMarker() {
  const t = questTarget();
  if (!t) { questMarker.sprite.visible = false; return; }
  questMarker.sprite.visible = true;
  questMarker.sprite.position.set(t.x, surfaceAt(t.x, t.z) + 4.2, t.z);
  questMarker.draw(game.stage === 2 ? '?' : game.stage === 3 ? '☠' : '◆', game.stage === 3 ? '#ff8a5a' : '#4cf0d6');
  npcMarker.sprite.visible = game.stage === 0 || game.stage === 2;
  if (npcMarker.sprite.visible) npcMarker.draw(game.stage === 2 ? '?' : '!', game.stage === 2 ? '#4cf0d6' : '#ffc63c');
}

function engageBoss(b) {
  if (game.bossEngaged || b !== boss) return;
  game.bossEngaged = true;
  boss.engaged = true;
  ui.setBoss({ visible: true, name: 'ASHBEARD', rank: 'CAPTAIN', hp: boss.hp / boss.maxHp });
  ui.showZone('Captain Ashbeard', 'The Ashen Crown · Final duel');
  ui.toast('<b>Captain Ashbeard</b> has noticed you.', { icon: '☠', kind: 'danger', time: 3800 });
  audio.roar();
  effects.shakeCamera(0.5);
  effects.screenFlash(0.12);
}

function onBossDefeated() {
  game.bossDead = true;
  game.stage = 4;
  game.bossEngaged = false;
  ui.setBoss({ visible: false });
  ui.setQuest({ title: 'The Grand Tide', objective: 'The Ashen Crown is broken. Sail wherever the wind takes you.', progress: 1, total: 1, chapter: 'EPILOGUE', distance: null, showProgress: true });
  questMarker.sprite.visible = false;
  addXP(1200);
  player.beli += 5000;
  addBounty(500000);
  unlockFruit('tide');
  if (!world.landmarks.emberChest.group.visible) {
    world.landmarks.emberChest.group.visible = true;
    effects.ring(world.landmarks.emberChest.pos.clone(), 0xffc857, 4, 1.2, 1.2);
    effects.particles.spawn(world.landmarks.emberChest.pos.x, world.landmarks.emberChest.pos.y + 1, world.landmarks.emberChest.pos.z, {
      color: 0xffd76a, count: 40, speed: 6, size: 0.9, life: 1.4, gravity: -1, spread: 0.6,
    });
  }
  saveGame();
  setTimeout(() => {
    game.victoryShown = true;
    saveGame();
    ui.showVictory();
    audio.quest();
  }, 2200);
}

function unlockFruit(key) {
  if (!player.unlocked.includes(key)) {
    player.unlocked.push(key);
    ui.setFruit(player.fruit, player.unlocked, player.level);
    const data = FRUIT_DATA[key];
    const label = key === 'gale' ? 'GALE FRUIT' : 'TIDE FRUIT';
    ui.toast(`<b>${label}</b> awakened · Press <b>${player.unlocked.length}</b> to equip`, { icon: data.glyph, kind: 'gold', time: 6000 });
    audio.chest();
    saveGame();
  }
}

function setFruit(key) {
  if (!player.unlocked.includes(key)) {
    ui.toast('That devil fruit is still sleeping.', { icon: '🔒', kind: 'danger', time: 1600 });
    audio.error();
    return;
  }
  if (player.fruit === key) return;
  player.fruit = key;
  player.cooldowns.skill = Math.min(player.cooldowns.skill, 0.6);
  ui.setFruit(key, player.unlocked, player.level);
  const data = FRUIT_DATA[key];
  ui.toast(`<b>${data.name.toUpperCase()} FRUIT</b> equipped`, { icon: data.glyph, kind: 'gold', time: 2200 });
  effects.burst(player.pos.clone().add(new THREE.Vector3(0, 1.4, 0)), key === 'gale' ? 0x5cffe6 : key === 'tide' ? 0x5ab9ff : 0xff8a2a, 28, { speed: 5, size: 0.8, life: 0.8, gravity: 0 });
  audio.click();
  saveGame();
}

function openNpcDialogue() {
  if (document.pointerLockElement) document.exitPointerLock();
  if (game.stage === 0) {
    ui.showDialogue({
      name: 'CAPTAIN RHEA', role: 'HARBOR MASTER', portrait: 'R',
      text: 'Kai — the Rogue Tide has camped on our north beach. Six cutthroats, one stolen chart. Clear them out and the harbor will owe you a ship, a sword, and a story worth telling.',
      options: [
        { label: 'I\'ll clear the beach', primary: true, onClick: () => {
          game.stage = 1;
          questChanged(true);
          ui.toast('Quest accepted · <b>The Rogue Tide</b>', { icon: '⚑', kind: 'gold' });
          audio.quest();
          saveGame();
        } },
        { label: 'Not yet', onClick: () => {} },
      ],
    });
  } else if (game.stage === 1) {
    ui.showDialogue({
      name: 'CAPTAIN RHEA', role: 'HARBOR MASTER', portrait: 'R',
      text: `The north beach reeks of cheap rum and bad intentions. You've cut down ${game.kills} of the six. Keep your blade sharp — their captain wears a stolen naval coat.`,
      options: [{ label: 'Back to the fight', primary: true }],
    });
  } else if (game.stage === 2) {
    ui.showDialogue({
      name: 'CAPTAIN RHEA', role: 'HARBOR MASTER', portrait: 'R',
      text: 'Not a scratch on the harbor. You were born for this tide, Kai. Their chart points east — to Ember Isle, where Captain Ashbeard keeps the Ashen Crown. Take the skiff at the dock. End him.',
      options: [
        { label: 'I\'ll sail at once', primary: true, onClick: () => {
          game.stage = 3;
          addXP(360);
          player.beli += 420;
          addBounty(12000);
          questChanged(true);
          ui.toast('Quest updated · <b>The Ashen Crown</b>', { icon: '☠', kind: 'gold' });
          ui.toast('Take the skiff at the dock · Press <b>F</b> to board', { icon: '⚓', kind: 'gold', time: 6000 });
          audio.quest();
          saveGame();
        } },
        { label: 'I need a moment', onClick: () => {} },
      ],
    });
  } else if (game.stage === 3) {
    ui.showDialogue({
      name: 'CAPTAIN RHEA', role: 'HARBOR MASTER', portrait: 'R',
      text: 'Ashbeard\'s sails are ash and his cutlass drinks fire. Sail east, beach the skiff, and do not let him reach the crater. The tide is with you.',
      options: [{ label: 'For the Grand Tide', primary: true }],
    });
  } else {
    ui.showDialogue({
      name: 'CAPTAIN RHEA', role: 'HARBOR MASTER', portrait: 'R',
      text: 'The Ashen Crown is broken and the harbor is singing your name. There will be other tides, Kai. Rest. Upgrade that cutlass. Then sail farther than any chart remembers.',
      options: [{ label: 'For the horizon', primary: true }],
    });
  }
}

function openChest(chest, isBoss = false) {
  if (isBoss ? game.bossChestOpened : game.chestOpened) return;
  if (isBoss) game.bossChestOpened = true; else game.chestOpened = true;
  chest.opening = true;
  chest.opened = true;
  effects.ring(chest.pos.clone(), 0xffc857, 3.4, 0.8, 1.2);
  effects.particles.spawn(chest.pos.x, chest.pos.y + 0.6, chest.pos.z, { color: 0xffd76a, count: 42, speed: 7, size: 0.8, life: 1.2, gravity: -1, spread: 0.5 });
  audio.chest();
  if (isBoss) {
    player.beli += 2400;
    addXP(500);
    ui.toast('<b>Ashen Crown cache</b> · +2,400 Beli · +500 XP', { icon: '◈', kind: 'gold', time: 5000 });
  } else {
    player.beli += 320;
    addXP(180);
    unlockFruit('gale');
    ui.toast('<b>Sunken chest</b> · +320 Beli · +180 XP', { icon: '◈', kind: 'gold', time: 4200 });
    ui.toast('<b>Gale Fruit</b> added to your arsenal · Press <b>2</b>', { icon: '≋', kind: 'gold', time: 6500 });
  }
  floating.spawn(chest.pos.clone().add(new THREE.Vector3(0, 1.5, 0)), isBoss ? '+2,400' : '+320', 'info', { life: 1.2, scale: 1.2 });
  saveGame();
}

function openForgeDialogue() {
  const costs = [0, 260, 700, 1500];
  const next = player.swordLevel + 1;
  if (player.swordLevel >= 4) {
    ui.showDialogue({
      name: 'THE FORGE', role: 'DAWN HARBOR', portrait: '⚒', portraitColor: 'radial-gradient(circle at 35% 28%, #ffd697, #b96a2f 45%, #4b2415)',
      text: 'Your cutlass has been folded four times. Any more heat and the steel will forget its own name. It is done, captain.',
      options: [{ label: 'Leave', primary: true }],
    });
    return;
  }
  const cost = costs[next - 1];
  ui.showDialogue({
    name: 'THE FORGE', role: 'DAWN HARBOR', portrait: '⚒', portraitColor: 'radial-gradient(circle at 35% 28%, #ffd697, #b96a2f 45%, #4b2415)',
    text: `Your cutlass is at tier ${player.swordLevel}. Another fold will add +6 damage to every strike. Cost: ${cost} Beli. The coals are hot.`,
    options: [
      { label: `Upgrade · ${cost} Beli`, primary: true, onClick: () => {
        if (player.beli < cost) { ui.toast('Not enough Beli', { icon: 'Ƀ', kind: 'danger' }); audio.error(); return; }
        player.beli -= cost;
        player.swordLevel++;
        ui.toast(`<b>Cutlass tier ${player.swordLevel}</b> · +6 damage`, { icon: '⚔', kind: 'gold' });
        effects.burst(player.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), 0xffb24a, 30, { speed: 5, size: 0.7, life: 0.8, gravity: 1 });
        audio.chest();
        saveGame();
      } },
      { label: 'Maybe later' },
    ],
  });
}

function useCampfire() {
  if (game.fireCooldown > 0) {
    ui.toast(`The coals need <b>${Math.ceil(game.fireCooldown)}s</b>`, { icon: '♨', time: 1600 });
    return;
  }
  if (player.hp >= player.maxHp && player.energy >= player.maxEnergy) {
    ui.toast('You are already at full strength.', { icon: '♥', time: 1600 });
    return;
  }
  player.hp = player.maxHp;
  player.energy = player.maxEnergy;
  game.fireCooldown = 24;
  effects.heal(player.pos.clone().add(new THREE.Vector3(0, 1, 0)));
  ui.toast('<b>Wounds mended</b> · Health and energy restored', { icon: '♥', kind: 'gold' });
  audio.heal();
}

function getInteraction() {
  if (player.dead || player.onBoat) return null;
  const dist = (x, z) => Math.hypot(player.pos.x - x, player.pos.z - z);
  if (dist(npcPos.x, npcPos.z) < 4.2) return { type: 'npc', label: game.stage === 2 ? 'Turn in quest to <b>Captain Rhea</b>' : 'Talk to <b>Captain Rhea</b>' };
  const chest = world.landmarks.chest;
  if (!game.chestOpened && dist(chest.pos.x, chest.pos.z) < 3.6) return { type: 'chest', label: 'Open the <b>sunken chest</b>' };
  if (game.bossDead && !game.bossChestOpened && dist(world.landmarks.emberChest.pos.x, world.landmarks.emberChest.pos.z) < 3.8) return { type: 'bossChest', label: 'Open the <b>Ashen Crown cache</b>' };
  if (dist(world.landmarks.forge.x, world.landmarks.forge.z) < 4.2) return { type: 'forge', label: 'Upgrade your <b>cutlass</b>' };
  const fire = world.landmarks.campfire;
  if (dist(fire.x, fire.z) < 4.0) return { type: 'campfire', label: 'Rest at the <b>campfire</b>' };
  const b = boatState.pos;
  if (!player.onBoat && dist(b.x, b.z) < 6.2) return { type: 'boat', label: 'Board the <b>skiff</b>' };
  return null;
}

function interact() {
  if (!game.started || player.dead || player.onBoat) return;
  const it = getInteraction();
  if (!it) return;
  if (it.type === 'npc') openNpcDialogue();
  else if (it.type === 'chest') openChest(world.landmarks.chest, false);
  else if (it.type === 'bossChest') openChest(world.landmarks.emberChest, true);
  else if (it.type === 'forge') openForgeDialogue();
  else if (it.type === 'campfire') useCampfire();
  else if (it.type === 'boat') boardBoat();
}

/* ------------------------------------------------------------------ */
/*  Boat                                                               */
/* ------------------------------------------------------------------ */

const boatState = {
  pos: world.landmarks.boatPos.clone(),
  yaw: Math.PI / 2 - 0.12,
  speed: 0,
  boarded: false,
  wakeTimer: 0,
  bob: 0,
};
world.landmarks.boat.rotation.y = boatState.yaw;

function boardBoat() {
  if (player.onBoat) return;
  const d = Math.hypot(player.pos.x - boatState.pos.x, player.pos.z - boatState.pos.z);
  if (d > 6.5) { ui.toast('Get closer to the skiff', { icon: '⚓', time: 1600 }); return; }
  player.onBoat = true;
  player.rig.group.visible = false;
  boatState.boarded = true;
  boatState.speed = 0;
  look.distance = 16;
  look.pitch = 0.26;
  look.yaw = boatState.yaw + Math.PI;
  ui.toast('<b>Skiff boarded</b> · W/S sail · A/D steer · F to disembark', { icon: '⚓', kind: 'gold', time: 5200 });
  audio.board();
  effects.burst(boatState.pos.clone().add(new THREE.Vector3(0, 0.8, 0)), 0xbfefff, 18, { speed: 3, size: 0.7, life: 0.6, gravity: 5 });
}

function disembark() {
  if (!player.onBoat) return;
  let target = null;
  let bestD = Infinity;
  for (const isl of ISLANDS) {
    const d = Math.hypot(boatState.pos.x - isl.x, boatState.pos.z - isl.z);
    const shore = isl.radius * 0.96;
    if (d < shore && d < bestD) { bestD = d; target = isl; }
  }
  if (!target) {
    ui.toast('No shore in reach. Sail closer to an island.', { icon: '≈', kind: 'danger', time: 2200 });
    audio.error();
    return;
  }
  const dx = boatState.pos.x - target.x;
  const dz = boatState.pos.z - target.z;
  const len = Math.hypot(dx, dz) || 1;
  let x = target.x + dx / len * target.radius * 0.67;
  let z = target.z + dz / len * target.radius * 0.67;
  let y = surfaceAt(x, z);
  if (y < 0.4) {
    x = target.x + dx / len * target.radius * 0.58;
    z = target.z + dz / len * target.radius * 0.58;
    y = surfaceAt(x, z);
  }
  if (target.id === 'dawn') {
    x = 49; z = 0; y = surfaceAt(x, z);
  }
  player.pos.set(x, Math.max(y, 0.5), z);
  player.vel.set(0, 0, 0);
  player.onBoat = false;
  player.rig.group.visible = true;
  // Push the anchored skiff offshore so the follow camera never starts inside its sail.
  const bx = boatState.pos.x - target.x;
  const bz = boatState.pos.z - target.z;
  const bl = Math.hypot(bx, bz) || 1;
  boatState.pos.x += (bx / bl) * 10;
  boatState.pos.z += (bz / bl) * 10;
  boatState.speed = 0;
  player.yaw = Math.atan2(-(target.x - x), -(target.z - z));
  boatState.boarded = false;
  look.distance = 9;
  look.pitch = 0.25;
  look.yaw = player.yaw;
  camera.position.set(x + Math.sin(look.yaw) * 9, y + 4.5, z + Math.cos(look.yaw) * 9);
  ui.toast(`Landfall · <b>${target.name}</b>`, { icon: '⚓', kind: 'gold' });
  audio.board();
  if (target.id === 'ember') {
    ui.showZone('Ember Isle', 'Volcanic waters · Danger');
    if (game.stage === 3) ui.toast('Ashbeard waits at the stone ring to the east.', { icon: '☠', kind: 'danger', time: 5200 });
  }
}

function updateBoat(dt) {
  if (!player.onBoat) {
    boatState.speed = damp(boatState.speed, 0, 4, dt);
  } else {
    const fwdPressed = keys.has('KeyW') || keys.has('ArrowUp');
    const backPressed = keys.has('KeyS') || keys.has('ArrowDown');
    const left = keys.has('KeyA') || keys.has('ArrowLeft');
    const right = keys.has('KeyD') || keys.has('ArrowRight');
    let throttle = fwdPressed ? 1 : backPressed ? -0.45 : 0;
    const touch = ui.touchMove;
    if (Math.abs(touch.y) > 0.12) throttle = touch.y;
    const steer = (right ? 1 : 0) - (left ? 1 : 0) + touch.x * 0.9;
    const targetSpeed = throttle * 27;
    boatState.speed = damp(boatState.speed, targetSpeed, 1.8, dt);
    if (Math.abs(boatState.speed) > 0.2) boatState.yaw += steer * 1.15 * dt * (boatState.speed > 0 ? 1 : -0.6);
    const fwd = new THREE.Vector3(Math.sin(boatState.yaw), 0, Math.cos(boatState.yaw));
    const nextX = boatState.pos.x + fwd.x * boatState.speed * dt;
    const nextZ = boatState.pos.z + fwd.z * boatState.speed * dt;
    const aheadX = boatState.pos.x + fwd.x * (2.5 + Math.abs(boatState.speed) * 0.12);
    const aheadZ = boatState.pos.z + fwd.z * (2.5 + Math.abs(boatState.speed) * 0.12);
    const shallow = heightAt(aheadX, aheadZ) > -1.0;
    if (shallow && Math.abs(boatState.speed) > 2) {
      boatState.speed = -boatState.speed * 0.25;
      effects.burst(new THREE.Vector3(aheadX, 0.5, aheadZ), 0xd8f8ff, 16, { speed: 4, size: 1, life: 0.7, gravity: 7 });
      audio.wave();
    } else if (!shallow) {
      boatState.pos.x = clamp(nextX, -620, 620);
      boatState.pos.z = clamp(nextZ, -620, 620);
    }
    player.pos.set(boatState.pos.x, 0.8, boatState.pos.z);
    // auto camera behind the bow
    look.yaw = angleLerp(look.yaw, boatState.yaw + Math.PI, 1 - Math.exp(-2.4 * dt));
    if (Math.abs(boatState.speed) > 3) {
      boatState.wakeTimer -= dt;
      if (boatState.wakeTimer <= 0) {
        boatState.wakeTimer = 0.04;
        const back = boatState.pos.clone().addScaledVector(fwd, -3.8);
        effects.particles.spawn(back.x + rand(-1, 1), 0.25, back.z + rand(-1, 1), {
          color: 0xc9f7f6, count: 2, speed: 1.2, size: 1.4, life: 0.9, gravity: 0.6, spread: 0.5, drag: 1.2,
        });
      }
    }
  }
  boatState.bob = Math.sin(clock.elapsedTime * 1.25) * 0.12;
  world.landmarks.boat.position.set(boatState.pos.x, 0.35 + boatState.bob, boatState.pos.z);
  world.landmarks.boat.rotation.y = boatState.yaw;
  world.landmarks.boat.rotation.z = Math.sin(clock.elapsedTime * 1.05 + 0.5) * 0.022;
  world.landmarks.boat.rotation.x = Math.sin(clock.elapsedTime * 0.9) * 0.016;
}

/* ------------------------------------------------------------------ */
/*  Input                                                              */
/* ------------------------------------------------------------------ */

const keys = new Set();
const look = { yaw: spawn.yaw, pitch: 0.24, distance: 9 };
let rightDrag = false;
let touchLookId = null;
let touchLookLast = { x: 0, y: 0 };
let attackHeld = false;
const lastPoint = new THREE.Vector3();

function clearKeys() {
  keys.clear();
  attackHeld = false;
}

function getMoveInput() {
  let x = 0, y = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  x += ui.touchMove.x;
  y += ui.touchMove.y;
  const len = Math.hypot(x, y);
  if (len > 1) { x /= len; y /= len; }
  return { x, y, active: len > 0.08 };
}

function handleTouchActions() {
  const actions = ui.consumeTouch();
  for (const action of actions) {
    if (action === 'attack') tryAttack();
    else if (action === 'dash') dash();
    else if (action === 'skill') castSkill();
    else if (action === 'ultimate') castUltimate();
    else if (action === 'jump') player.jumpQueued = true;
    else if (action === 'interact') { if (player.onBoat) disembark(); else interact(); }
  }
}

window.addEventListener('keydown', e => {
  if (!game.started) {
    if (e.code === 'Enter') startGame();
    return;
  }
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'Space') player.jumpQueued = true;
  if (ui.dialogueOpen) {
    if (e.code === 'Escape' || e.code === 'KeyF') ui.hideDialogue();
    return;
  }
  if (e.code === 'KeyQ') dash();
  if (e.code === 'KeyE') castSkill();
  if (e.code === 'KeyR') castUltimate();
  if (e.code === 'KeyF') { if (player.onBoat) disembark(); else interact(); }
  if (e.code === 'Digit1') setFruit('ember');
  if (e.code === 'Digit2') setFruit('gale');
  if (e.code === 'Digit3') setFruit('tide');
  if (e.code === 'KeyM') toggleMap();
  if (e.code === 'KeyH') toggleHelp();
  if (e.code === 'KeyP') togglePause();
  if (e.code === 'Escape') {
    if (ui.mapOpen) ui.hideMap();
    else if (ui.helpOpen) ui.hideHelp();
    else togglePause();
  }
});
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', clearKeys);

canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  if (!game.started) return;
  if (ui.paused || ui.mapOpen || ui.helpOpen || ui.victorious || ui.dialogueOpen) return;
  if (e.pointerType === 'touch') {
    if (e.clientX > window.innerWidth * 0.38) {
      touchLookId = e.pointerId;
      touchLookLast = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture?.(e.pointerId);
    }
    return;
  }
  if (e.button === 0) {
    if (document.pointerLockElement !== canvas) {
      canvas.requestPointerLock?.();
    } else {
      attackHeld = true;
      tryAttack();
    }
  } else if (e.button === 2) {
    rightDrag = true;
    touchLookLast = { x: e.clientX, y: e.clientY };
  }
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerType === 'touch' && e.pointerId === touchLookId) {
    const dx = e.clientX - touchLookLast.x;
    const dy = e.clientY - touchLookLast.y;
    touchLookLast = { x: e.clientX, y: e.clientY };
    look.yaw -= dx * 0.006;
    look.pitch = clamp(look.pitch + dy * 0.0045, -0.18, 1.0);
    return;
  }
  if (document.pointerLockElement === canvas) {
    look.yaw -= e.movementX * 0.00225;
    look.pitch = clamp(look.pitch + e.movementY * 0.0019, -0.18, 1.0);
  } else if (rightDrag) {
    look.yaw -= e.movementX * 0.0042;
    look.pitch = clamp(look.pitch + e.movementY * 0.0034, -0.18, 1.0);
  }
});
window.addEventListener('pointerup', e => {
  if (e.pointerType === 'touch' && e.pointerId === touchLookId) touchLookId = null;
  if (e.button === 0) attackHeld = false;
  if (e.button === 2) rightDrag = false;
});
canvas.addEventListener('wheel', e => {
  if (!game.started) return;
  look.distance = clamp(look.distance + e.deltaY * 0.006, 5.2, 14.5);
  e.preventDefault();
}, { passive: false });
document.addEventListener('pointerlockchange', () => {
  document.body.classList.toggle('locked', document.pointerLockElement === canvas);
  if (document.pointerLockElement !== canvas) attackHeld = false;
});

/* ------------------------------------------------------------------ */
/*  Player update                                                      */
/* ------------------------------------------------------------------ */

let stepTimer = 0;
let swimSplash = 0;

function updatePlayer(dt) {
  if (player.dead) {
    animateRig(player.rig, { time: clock.elapsedTime, dead: true });
    return;
  }
  player.cooldowns.dash = Math.max(0, player.cooldowns.dash - dt);
  player.cooldowns.skill = Math.max(0, player.cooldowns.skill - dt);
  player.cooldowns.ultimate = Math.max(0, player.cooldowns.ultimate - dt);
  player.invuln = Math.max(0, player.invuln - dt);
  player.hurtTimer = Math.max(0, player.hurtTimer - dt);
  player.actionLock = Math.max(0, player.actionLock - dt);
  player.attackCooldown = Math.max(0, player.attackCooldown - dt);
  player.comboTimer = Math.max(0, player.comboTimer - dt);
  game.fireCooldown = Math.max(0, game.fireCooldown - dt);
  if (player.comboTimer <= 0) player.combo = 0;
  player.energy = Math.min(player.maxEnergy, player.energy + dt * (player.swimming ? 5 : 11));
  if (game.playTime - player.lastDamageTime > 6 && player.hp < player.maxHp) {
    player.hp = Math.min(player.maxHp, player.hp + dt * 2.2);
  }

  if (player.attackTimer > 0) {
    player.attackTimer -= dt;
    if (!player.attackHitDone && player.attackTimer <= player.attackDuration - 0.105) {
      player.attackHitDone = true;
      swordHit();
    }
    if (player.attackTimer < 0) player.attackTimer = 0;
  }
  if (attackHeld && player.attackCooldown <= 0 && !player.onBoat) tryAttack();

  if (player.onBoat) {
    if (player.jumpQueued) player.jumpQueued = false;
    player.rig.group.visible = false;
    return;
  }
  player.rig.group.visible = true;

  const move = getMoveInput();
  const fwd = forwardFromYaw(look.yaw);
  const right = new THREE.Vector3(Math.cos(look.yaw), 0, -Math.sin(look.yaw));
  const wish = new THREE.Vector3().addScaledVector(fwd, move.y).addScaledVector(right, move.x);
  if (wish.lengthSq() > 0.001) wish.normalize();
  if (move.active) player.targetYaw = Math.atan2(-wish.x, -wish.z);
  if (player.attackTimer > 0 || player.actionLock > 0) player.targetYaw = look.yaw;
  player.yaw = angleLerp(player.yaw, player.targetYaw, 1 - Math.exp(-13 * dt));

  if (player.jumpQueued) {
    player.jumpQueued = false;
    if (player.swimming) {
      // no jumping while swimming
    } else if (player.onGround) {
      player.vel.y = 10.6;
      player.onGround = false;
      player.jumpCount = 1;
      effects.burst(player.pos.clone().add(new THREE.Vector3(0, 0.2, 0)), 0xe6d7ac, 8, { speed: 2, size: 0.5, life: 0.4, gravity: 5 });
    } else if (player.jumpCount < 2) {
      player.vel.y = 9.8;
      player.jumpCount = 2;
      effects.ring(player.pos.clone().add(new THREE.Vector3(0, 0.1, 0)), 0x9ff6ff, 1.5, 0.35, 0.5);
      effects.particles.spawn(player.pos.x, player.pos.y + 0.2, player.pos.z, { color: 0x9ff6ff, count: 14, speed: 3, size: 0.5, life: 0.4, gravity: 1 });
      audio.dash();
    }
  }

  const sprint = (keys.has('ShiftLeft') || keys.has('ShiftRight')) && move.y > 0.15 && !player.swimming;
  let speed = player.swimming ? 3.3 : sprint ? 10.4 : 6.4;
  if (player.attackTimer > 0) speed *= 0.45;
  if (player.actionLock > 0) speed *= 0.6;
  if (player.dashTimer > 0) {
    player.dashTimer -= dt;
    player.pos.addScaledVector(player.dashDir, 26 * dt);
    if (Math.random() < 0.8) {
      effects.particles.spawn(player.pos.x, player.pos.y + 1.0, player.pos.z, { color: 0xbffff8, count: 2, size: 0.8, life: 0.4, gravity: 0, speed: 0.4, spread: 0.45, drag: 2 });
    }
  } else {
    const targetVX = wish.x * speed;
    const targetVZ = wish.z * speed;
    player.vel.x = damp(player.vel.x, targetVX, player.onGround ? 12 : 5, dt);
    player.vel.z = damp(player.vel.z, targetVZ, player.onGround ? 12 : 5, dt);
  }

  player.vel.y -= (player.swimming ? 26 : 31) * dt;
  player.pos.x += player.vel.x * dt;
  player.pos.z += player.vel.z * dt;
  player.pos.y += player.vel.y * dt;

  // Circle collision with props.
  for (const c of world.colliders) {
    const dx = player.pos.x - c.x;
    const dz = player.pos.z - c.z;
    const min = player.radius + c.r;
    const d2 = dx * dx + dz * dz;
    if (d2 < min * min && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      const push = (min - d);
      player.pos.x += (dx / d) * push;
      player.pos.z += (dz / d) * push;
      player.vel.x *= 0.4;
      player.vel.z *= 0.4;
    }
  }

  const ground = surfaceAt(player.pos.x, player.pos.z);
  player.swimming = ground < -0.85 && player.pos.y < 0.75;
  if (player.swimming) {
    player.pos.y = 0.55 + Math.sin(clock.elapsedTime * 2.4) * 0.08;
    player.vel.y = 0;
    player.onGround = false;
    swimSplash -= dt;
    if (Math.abs(player.vel.x) + Math.abs(player.vel.z) > 1 && swimSplash <= 0) {
      swimSplash = 0.28;
      effects.particles.spawn(player.pos.x, 0.15, player.pos.z, { color: 0xbdf6ff, count: 4, size: 0.5, life: 0.5, gravity: 6, speed: 1.5 });
    }
  } else if (player.pos.y <= ground + 0.02) {
    player.pos.y = ground;
    if (player.vel.y < 0) player.vel.y = 0;
    player.onGround = true;
    player.jumpCount = 0;
  } else {
    player.onGround = false;
  }
  player.pos.x = clamp(player.pos.x, -600, 600);
  player.pos.z = clamp(player.pos.z, -600, 600);

  player.rig.group.position.copy(player.pos);
  player.rig.group.rotation.y = player.yaw;
  const hspeed = Math.hypot(player.vel.x, player.vel.z);
  animateRig(player.rig, {
    time: clock.elapsedTime,
    speed: player.swimming ? hspeed * 1.1 : hspeed,
    airborne: !player.onGround && !player.swimming,
    attacking: player.attackTimer > 0 ? player.attackTimer / player.attackDuration : 0,
    hit: player.hurtTimer,
  });
  if (player.actionLock > 0 && player.attackTimer <= 0) {
    animateRig(player.rig, { time: clock.elapsedTime, speed: 0, attacking: 0.7, attackKind: 'ultimate' });
  }

  // Footstep dust / sand
  if (hspeed > 1.5 && player.onGround && !player.swimming) {
    stepTimer -= dt;
    if (stepTimer <= 0) {
      stepTimer = sprint ? 0.22 : 0.34;
      const onSand = surfaceAt(player.pos.x, player.pos.z) < 2.6;
      effects.particles.spawn(player.pos.x, player.pos.y + 0.12, player.pos.z, {
        color: onSand ? 0xdfc99b : 0xa9c286, count: 1, speed: 1.3, size: 0.5, life: 0.45, gravity: 2.5, spread: 0.35,
      });
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Camera                                                             */
/* ------------------------------------------------------------------ */

let currentFov = 62;
const camLook = new THREE.Vector3();
const desiredCam = new THREE.Vector3();
let startCamInitialized = false;

function updateStartCamera(time) {
  camera.position.set(9 + Math.sin(time * 0.07) * 2.2, 17.5 + Math.sin(time * 0.11) * 0.4, 36 + Math.cos(time * 0.07) * 1.8);
  camera.lookAt(46, 5.2, 1);
  camera.fov = 55;
  camera.updateProjectionMatrix();
}

function updateCamera(dt) {
  let target;
  let distance = look.distance;
  if (player.onBoat) {
    target = new THREE.Vector3(boatState.pos.x, 3.4 + boatState.bob, boatState.pos.z);
    distance = Math.max(distance, 13);
  } else {
    target = player.pos.clone().add(new THREE.Vector3(0, 2.12, 0));
    distance = look.distance;
  }
  const cp = Math.cos(look.pitch);
  desiredCam.set(
    target.x + Math.sin(look.yaw) * cp * distance,
    target.y + Math.sin(look.pitch) * distance,
    target.z + Math.cos(look.yaw) * cp * distance
  );
  if (player.onBoat) {
    desiredCam.y = Math.max(desiredCam.y, 1.4);
  } else {
    const camGround = surfaceAt(desiredCam.x, desiredCam.z);
    if (desiredCam.y < camGround + 0.7) desiredCam.y = camGround + 0.7;
    if (desiredCam.y < 0.8) desiredCam.y = 0.8;
  }
  const follow = 1 - Math.exp(-9 * dt);
  camera.position.lerp(desiredCam, follow);
  camLook.lerp(target, 1 - Math.exp(-13 * dt));
  camera.lookAt(camLook);

  // camera shake
  if (effects.shake > 0.001) {
    const s = effects.shake * 0.28;
    camera.position.x += (Math.random() - 0.5) * s;
    camera.position.y += (Math.random() - 0.5) * s;
    camera.position.z += (Math.random() - 0.5) * s;
    camera.rotation.z += (Math.random() - 0.5) * effects.shake * 0.012;
  }
  const sprinting = (keys.has('ShiftLeft') || keys.has('ShiftRight')) && !player.onBoat && !player.swimming && (keys.has('KeyW') || Math.abs(ui.touchMove.y) > 0.7);
  const fovTarget = 62 + (sprinting ? 2.5 : 0) + (player.dashTimer > 0 ? 7 : 0) + (player.onBoat ? Math.abs(boatState.speed) * 0.08 : 0);
  currentFov = damp(currentFov, fovTarget, 7, dt);
  camera.fov = currentFov;
  camera.updateProjectionMatrix();
}

/* ------------------------------------------------------------------ */
/*  HUD                                                                */
/* ------------------------------------------------------------------ */

let miniTimer = 0;
let hudTimer = 0;
let zoneTimer = 0;
let promptTimer = 0;
let lastSkillLevel = -1;
let lastFruit = '';

function updateHud(dt) {
  ui.setPlayer({ level: player.level, bounty: player.bounty, beli: player.beli, title: player.title });
  ui.setHealth(player.hp, player.maxHp);
  ui.setEnergy(player.energy, player.maxEnergy);
  ui.setXP(player.xp, player.xpNeed);
  ui.updateCompass(look.yaw);
  ui.setCooldowns({
    dash: player.cooldowns.dash, dashMax: 5.2,
    skill: player.cooldowns.skill, skillMax: FRUIT_ABILITY[player.fruit].cooldown,
    ultimate: player.cooldowns.ultimate, ultimateMax: FRUIT_ABILITY[player.fruit].ultCooldown,
  });
  if (lastSkillLevel !== player.level || lastFruit !== player.fruit) {
    lastSkillLevel = player.level;
    lastFruit = player.fruit;
    ui.setFruit(player.fruit, player.unlocked, player.level);
  }
  if (game.bossEngaged && !game.bossDead) {
    ui.setBoss({ visible: true, name: 'ASHBEARD', rank: 'CAPTAIN', hp: boss.hp / boss.maxHp });
  }

  hudTimer -= dt;
  if (hudTimer <= 0) {
    hudTimer = 0.22;
    const target = questTarget();
    ui.setQuestDistance(target ? Math.hypot(player.pos.x - target.x, player.pos.z - target.z) : null);
    if (target) {
      const b = Math.sin(clock.elapsedTime * 2.2) * 0.16;
      questMarker.sprite.position.set(target.x, surfaceAt(target.x, target.z) + 4.2 + b, target.z);
    }
    npcMarker.sprite.position.y = 3.95 + Math.sin(clock.elapsedTime * 2.2 + 1) * 0.10;
  }

  promptTimer -= dt;
  if (promptTimer <= 0) {
    promptTimer = 0.12;
    updatePrompt();
  }

  miniTimer -= dt;
  if (miniTimer <= 0) {
    miniTimer = 0.11;
    if (!ui.mapOpen) ui.drawMinimap(minimapData());
    else ui.drawWorldMap(worldMapData());
  }
}

function minimapData() {
  const chests = [];
  if (!game.chestOpened) chests.push({ x: world.landmarks.chest.pos.x, z: world.landmarks.chest.pos.z });
  if (game.bossDead && !game.bossChestOpened) chests.push({ x: world.landmarks.emberChest.pos.x, z: world.landmarks.emberChest.pos.z });
  return {
    time: clock.elapsedTime,
    player: { x: player.pos.x, z: player.pos.z, yaw: player.yaw },
    boat: { x: boatState.pos.x, z: boatState.pos.z, yaw: boatState.yaw },
    islands: ISLANDS,
    enemies: enemies.filter(e => e.alive && (e.home || Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z) < 190)).map(e => ({ x: e.pos.x, z: e.pos.z, boss: e.boss, alive: e.alive })),
    npcs: [{ x: npcPos.x, z: npcPos.z }],
    chests,
    questTarget: questTarget(),
  };
}

function worldMapData() {
  return {
    ...minimapData(),
    mapCoords: `X ${Math.round(player.pos.x)} · Z ${Math.round(player.pos.z)}`,
  };
}

function updatePrompt() {
  if (!game.started || player.dead || ui.dialogueOpen || ui.paused || ui.mapOpen || ui.helpOpen || ui.victorious) {
    ui.setInteract(null);
    game.currentInteraction = null;
    game.lastPrompt = null;
    return;
  }
  let prompt = null;
  if (player.onBoat) {
    let near = null;
    for (const isl of ISLANDS) {
      const d = Math.hypot(boatState.pos.x - isl.x, boatState.pos.z - isl.z);
      if (d < isl.radius * 0.99) near = isl;
    }
    if (near) prompt = { type: 'disembark', label: `Disembark at <b>${near.name}</b>` };
  } else {
    prompt = getInteraction();
  }
  game.currentInteraction = prompt;
  if (!prompt) {
    if (game.lastPrompt !== null) { ui.setInteract(null); game.lastPrompt = null; }
    return;
  }
  if (prompt.label !== game.lastPrompt) {
    ui.setInteract(prompt.label);
    game.lastPrompt = prompt.label;
  }
}

function updateZone(dt) {
  zoneTimer -= dt;
  if (zoneTimer > 0) return;
  zoneTimer = 0.35;
  const near = nearestIsland(player.pos.x, player.pos.z);
  const inZone = near.distance < near.island.radius * 0.94;
  const id = inZone ? near.island.id : 'ocean';
  if (id === game.zone) return;
  game.zone = id;
  if (id === 'ocean') {
    ui.setZone('The Grand Tide');
    return;
  }
  const isl = near.island;
  ui.setZone(isl.name);
  if (game.started) {
    ui.showZone(isl.name, isl.subtitle);
    if (!game.discovered.has(id)) {
      game.discovered.add(id);
      if (id === 'ember') {
        ui.toast('<b>Ember Isle discovered</b> · Volcanic waters', { icon: '☼', kind: 'danger', time: 4200 });
        audio.quest();
      } else if (id === 'spire' || id === 'veil') {
        ui.toast(`<b>${isl.name}</b> discovered · Uncharted waters`, { icon: '✧', kind: 'gold', time: 3600 });
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Save / load                                                        */
/* ------------------------------------------------------------------ */

function saveGame() {
  if (!game.started) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      v: 1,
      level: player.level,
      xp: player.xp,
      beli: player.beli,
      bounty: player.bounty,
      title: player.title,
      fruit: player.fruit,
      unlocked: player.unlocked,
      swordLevel: player.swordLevel,
      stage: game.stage,
      kills: game.kills,
      chestOpened: game.chestOpened,
      bossChestOpened: game.bossChestOpened,
      bossDead: game.bossDead,
      totalKills: game.totalKills,
    }));
  } catch {}
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (!s || s.v !== 1) return false;
    player.level = Math.max(1, Math.min(60, s.level || 1));
    player.xp = Math.max(0, s.xp || 0);
    player.xpNeed = xpNeeded(player.level);
    player.maxHp = 100 + (player.level - 1) * 16;
    player.maxEnergy = 100 + (player.level - 1) * 6;
    player.hp = player.maxHp;
    player.energy = player.maxEnergy;
    player.beli = Math.max(0, s.beli || 0);
    player.bounty = Math.max(0, s.bounty || 0);
    player.title = s.title || 'ROOKIE';
    player.swordLevel = Math.max(1, Math.min(4, s.swordLevel || 1));
    player.unlocked = Array.isArray(s.unlocked) && s.unlocked.length ? s.unlocked.filter(k => ['ember', 'gale', 'tide'].includes(k)) : ['ember'];
    if (!player.unlocked.includes('ember')) player.unlocked.unshift('ember');
    player.fruit = player.unlocked.includes(s.fruit) ? s.fruit : 'ember';
    game.stage = Math.max(0, Math.min(4, s.stage || 0));
    game.kills = Math.max(0, Math.min(game.killsNeeded, s.kills || 0));
    game.chestOpened = Boolean(s.chestOpened);
    game.bossChestOpened = Boolean(s.bossChestOpened);
    game.bossDead = Boolean(s.bossDead);
    game.totalKills = s.totalKills || 0;
    if (game.stage === 1 && game.kills >= game.killsNeeded) game.stage = 2;
    if (game.bossDead) {
      game.stage = 4;
      boss.alive = false;
      boss.group.visible = false;
      world.landmarks.emberChest.group.visible = true;
    }
    if (game.chestOpened) {
      world.landmarks.chest.opened = true;
      world.landmarks.chest.lid.rotation.x = -1.28;
      world.landmarks.chest.glow.intensity = 0.5;
    }
    if (game.bossChestOpened) {
      world.landmarks.emberChest.opened = true;
      world.landmarks.emberChest.lid.rotation.x = -1.28;
    }
    return true;
  } catch { return false; }
}

setInterval(saveGame, 8000);
window.addEventListener('beforeunload', saveGame);

/* ------------------------------------------------------------------ */
/*  UI bindings                                                        */
/* ------------------------------------------------------------------ */

function togglePause() {
  if (!game.started || player.dead || ui.victorious) return;
  if (ui.paused) {
    ui.hidePause();
    clearKeys();
  } else {
    ui.showPause();
    ui.hideMap();
    ui.hideHelp();
    clearKeys();
    if (document.pointerLockElement) document.exitPointerLock();
  }
}

function toggleMap() {
  if (!game.started) return;
  if (ui.mapOpen) { ui.hideMap(); return; }
  if (ui.paused || ui.helpOpen || ui.dialogueOpen || ui.victorious) return;
  ui.hideHelp();
  ui.showMap();
  ui.drawWorldMap(worldMapData());
  clearKeys();
  if (document.pointerLockElement) document.exitPointerLock();
}

function toggleHelp() {
  if (!game.started) return;
  if (ui.helpOpen) { ui.hideHelp(); return; }
  if (ui.paused || ui.mapOpen || ui.dialogueOpen || ui.victorious) return;
  ui.showHelp();
  clearKeys();
  if (document.pointerLockElement) document.exitPointerLock();
}

function updateMuteIcon() {
  const on = ui.el.muteBtn.querySelector('.sound-on');
  const off = ui.el.muteBtn.querySelector('.sound-off');
  on.classList.toggle('hidden', audio.muted);
  off.classList.toggle('hidden', !audio.muted);
  ui.el.muteBtn.title = audio.muted ? 'Unmute (M)' : 'Mute';
}

document.getElementById('play-btn').addEventListener('click', startGame);
document.getElementById('start-map-btn').addEventListener('click', () => { startGame(); setTimeout(() => { ui.showMap(); ui.drawWorldMap(worldMapData()); }, 200); });
document.getElementById('map-btn').addEventListener('click', toggleMap);
document.getElementById('map-close').addEventListener('click', () => ui.hideMap());
document.getElementById('help-close').addEventListener('click', () => ui.hideHelp());
document.getElementById('resume-btn').addEventListener('click', togglePause);
document.getElementById('reset-btn').addEventListener('click', () => {
  if (!confirm('Reset your voyage? All progress will be lost.')) return;
  localStorage.removeItem(SAVE_KEY);
  location.reload();
});
document.getElementById('respawn-btn').addEventListener('click', () => { if (player.dead) respawnPlayer(); });
document.getElementById('victory-btn').addEventListener('click', () => {
  ui.hideVictory();
  ui.toast('<b>Tide Fruit</b> unlocked · Press <b>3</b> to equip', { icon: '◉', kind: 'gold', time: 6000 });
  saveGame();
});
document.getElementById('dialogue-close').addEventListener('click', () => ui.hideDialogue());
ui.el.muteBtn.addEventListener('click', () => { audio.init(); audio.toggleMute(); updateMuteIcon(); });
ui.el.fruitChips.forEach(chip => chip.addEventListener('click', () => setFruit(chip.dataset.fruit)));

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  const touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, touch ? 1.35 : 1.7));
});

/* ------------------------------------------------------------------ */
/*  Start / loop                                                       */
/* ------------------------------------------------------------------ */

function startGame() {
  if (game.started) return;
  game.started = true;
  audio.init();
  audio.setMuted(audio.muted);
  updateMuteIcon();
  ui.start();
  ui.setFruit(player.fruit, player.unlocked, player.level);
  ui.setPlayer({ level: player.level, bounty: player.bounty, beli: player.beli, title: player.title });
  ui.setHealth(player.hp, player.maxHp);
  ui.setEnergy(player.energy, player.maxEnergy);
  ui.setXP(player.xp, player.xpNeed);
  questChanged(false);
  updateMarker();
  game.zone = 'dawn';
  ui.setZone('Dawn Harbor');
  look.yaw = spawn.yaw;
  look.pitch = 0.23;
  look.distance = 9;
  camera.position.set(spawn.x + Math.sin(spawn.yaw) * 9, player.pos.y + 4.2, spawn.z + Math.cos(spawn.yaw) * 9);
  camLook.copy(player.pos).add(new THREE.Vector3(0, 2.1, 0));
  const target = questTarget();
  if (target) ui.toast('A new voyage begins · <b>Talk to Captain Rhea</b>', { icon: '⚑', kind: 'gold', time: 4400 });
  setTimeout(() => {
    if (!game.started) return;
    ui.toast('<b>WASD</b> move · <b>Right-drag</b> look · <b>Click</b> lock mouse · <b>F</b> interact', { icon: '✦', time: 5200 });
  }, 900);
  saveGame();
}

function updateFire() {
  const fire = world.landmarks.campfire;
  if (!fire || !fire.flame) return;
  const t = clock.elapsedTime;
  fire.flame.children.forEach((m, i) => {
    m.scale.y = 1 + Math.sin(t * 9 + i * 1.7) * 0.16;
    m.scale.x = 1 + Math.sin(t * 7 + i) * 0.08;
    m.rotation.y += 0.02;
  });
  fire.glow.intensity = 8 + Math.sin(t * 11) * 2.2 + Math.sin(t * 4.3) * 1.1;
  const chest = world.landmarks.chest;
  if (chest.opening) {
    chest.lid.rotation.x = damp(chest.lid.rotation.x, -1.28, 6, 1 / 60);
    chest.glow.intensity = damp(chest.glow.intensity, 0.6, 3, 1 / 60);
  }
  const bchest = world.landmarks.emberChest;
  if (bchest.opening) {
    bchest.lid.rotation.x = damp(bchest.lid.rotation.x, -1.28, 6, 1 / 60);
    bchest.glow.intensity = damp(bchest.glow.intensity, 0.6, 3, 1 / 60);
  }
}

let lastFrame = performance.now();

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;
  const time = clock.elapsedTime;
  game.playTime += dt;

  world.update(time);
  updateFire();

  if (!game.started) {
    updateStartCamera(time);
    if (player.rig) animateRig(player.rig, { time, speed: 0 });
    npcMarker.sprite.position.y = 3.95 + Math.sin(time * 2.2 + 1) * 0.1;
    effects.ambient(time, dt, player.pos, 'home');
    effects.update(dt, time);
    renderer.render(scene, camera);
    return;
  }

  const frozen = ui.paused || ui.mapOpen || ui.helpOpen || ui.dialogueOpen || player.dead || ui.victorious;
  if (!frozen) {
    handleTouchActions();
    updatePlayer(dt);
    updateBoat(dt);
    for (const e of enemies) e.update(dt, time);
    updateCoins(dt);
    updateProjectiles(dt);
    updateZone(dt);
    if (player.level >= 3) ui.el.slotUltimate.classList.remove('locked-ult');
    effects.ambient(time, dt, player.pos, game.zone === 'ember' ? 'ember' : 'home');
    if (game.started && !ui.dialogueOpen) {
      // Interaction prompt is refreshed less often in updateHud.
    }
  } else {
    updateBoat(0);
  }
  updateCamera(dt);
  updateHud(dt);

  // sun follows the player so shadows stay crisp everywhere
  const sunTarget = player.onBoat ? boatState.pos : player.pos;
  world.sunLight.position.copy(sunTarget).addScaledVector(world.sunDir, 150);
  world.sunLight.target.position.copy(sunTarget);
  world.sunLight.target.updateMatrixWorld();

  effects.update(frozen ? dt * 0.35 : dt, time);
  renderer.render(scene, camera);

  // Periodic save
  if (now - game.lastSave > 9000) { game.lastSave = now; saveGame(); }
}

/* ------------------------------------------------------------------ */
/*  Boot                                                               */
/* ------------------------------------------------------------------ */

const hadSave = loadGame();
window.__fb = { scene, camera, world, player, game, ui, renderer, enemies, boatState, npcPos, look, floating, effects };
if (game.bossDead) {
  ui.setBoss({ visible: false });
  questMarker.sprite.visible = false;
}
questChanged(false);
updateMarker();
ui.setFruit(player.fruit, player.unlocked, player.level);
ui.setPlayer({ level: player.level, bounty: player.bounty, beli: player.beli, title: player.title });
ui.setHealth(player.hp, player.maxHp);
ui.setEnergy(player.energy, player.maxEnergy);
ui.setXP(player.xp, player.xpNeed);
updateMuteIcon();
lastFrame = performance.now();
requestAnimationFrame(() => {
  renderer.compile(scene, camera);
  ui.ready();
  if (hadSave) {
    setTimeout(() => {
      if (!game.started) {
        // A subtle nudge on the start screen for returning captains.
        const tag = document.querySelector('.tagline');
        if (tag) tag.innerHTML = `Welcome back, <b>${player.title.toLowerCase()}</b>. Your voyage is saved.<br />Level ${player.level} · ${ui.formatNumber(player.bounty)} bounty · ${ui.formatNumber(player.beli)} Beli`;
      }
    }, 250);
  }
  animate();
});

