import { World } from './world.js';
import { UI } from './ui.js';
import { AudioManager } from './audio.js';
import { Player, Enemy, Projectile, Pickup, SlashEffect, RingEffect, BeamEffect, StormEffect, VortexEffect } from './entities.js';
import { FRUITS } from './fruits.js';
import { TAU, clamp, lerp, dist, angleDelta, formatTime, formatNum, mulberry32 } from './util.js';

class Camera {
  constructor() {
    this.x = 1040;
    this.y = 1060;
    this.zoom = 1;
    this.baseZoom = 1;
    this.shakeMag = 0;
    this.shakeTime = 0;
    this.shakeMax = 0;
    this.ox = 0;
    this.oy = 0;
  }

  apply(ctx) {
    ctx.save();
    ctx.translate((this.viewW || window.innerWidth) / 2 + this.ox, (this.viewH || window.innerHeight) / 2 + this.oy);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }

  restore(ctx) {
    ctx.restore();
  }

  shake(mag, time) {
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeTime = Math.max(this.shakeTime, time);
    this.shakeMax = Math.max(this.shakeMax, time);
  }

  updateShake(dt) {
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const t = Math.max(0, this.shakeTime / (this.shakeMax || 1));
      this.ox = (Math.random() * 2 - 1) * this.shakeMag * t;
      this.oy = (Math.random() * 2 - 1) * this.shakeMag * t;
      if (this.shakeTime <= 0) {
        this.shakeMag = 0;
        this.ox = 0;
        this.oy = 0;
      }
    }
  }

  screenToWorld(sx, sy, w, h) {
    return {
      x: (sx - w / 2) / this.zoom + this.x,
      y: (sy - h / 2) / this.zoom + this.y,
    };
  }
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.fruits = FRUITS;
    this.audio = new AudioManager();
    this.camera = new Camera();
    this.world = new World();
    this.state = 'menu';
    this.time = 0;
    this.runTime = 0;
    this.hitStop = 0;
    this.kills = 0;
    this.questIndex = 0;
    this.quests = this.buildQuests();
    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.particles = [];
    this.texts = [];
    this.effects = [];
    this.respawnQueue = [];
    this.boss = null;
    this.bossKilled = false;
    this.victoryTimer = -1;
    this.bossWarningVisible = false;
    this.bossWarningTimer = 0;
    this.warnedSkull = false;
    this.lastIslandId = null;
    this.mouseAim = -Math.PI / 2;
    this.mouseTimer = 0;
    this.startFruit = 'flame';
    this.input = {
      moving: false,
      dirX: 0,
      dirY: 0,
      aimAngle: null,
      touchX: 0,
      touchY: 0,
      touchActive: false,
    };
    this.keys = new Set();

    const spawn = this.spawnPoint();
    this.player = new Player(this, spawn.x, spawn.y);
    this.player.equipFruit('flame');

    this.ui = new UI(this);
    this.resize();
    this.bindEvents();
    this.last = performance.now();
    this.menuTime = 0;
    this.raf = this.loop.bind(this);
    this.ui.showStart();
    requestAnimationFrame(this.raf);
  }

  buildQuests() {
    return [
      {
        id: 'landfall',
        title: 'Landfall',
        objective: 'Talk to Captain Rhea at Dawn Isle',
        target: 0,
        progress: 0,
        done: false,
        type: 'talk',
        reward: { berries: 80, xp: 40 },
      },
      {
        id: 'corsairs',
        title: 'Cull the Corsairs',
        objective: 'Defeat 6 corsairs around Dawn Isle',
        target: 6,
        progress: 0,
        done: false,
        type: 'kill',
        kind: 'bandit',
        reward: { berries: 250, xp: 300 },
      },
      {
        id: 'fruit',
        title: "The Devil's Fruit",
        objective: 'Claim a Devil Fruit from a glowing shrine',
        target: 1,
        progress: 0,
        done: false,
        type: 'shrine',
        reward: { berries: 350, xp: 500 },
      },
      {
        id: 'marines',
        title: 'Break the Blockade',
        objective: 'Defeat 8 Marines at Fort Marina',
        target: 8,
        progress: 0,
        done: false,
        type: 'kill',
        kind: 'marine',
        reward: { berries: 600, xp: 800 },
      },
      {
        id: 'morro',
        title: 'Captain Morro',
        objective: 'Defeat Captain Morro at Skull Rock',
        target: 1,
        progress: 0,
        done: false,
        type: 'boss',
        reward: { berries: 1000, xp: 1200 },
      },
    ];
  }

  spawnPoint() {
    const dawn = this.world.islands.find((i) => i.id === 'dawn');
    return { x: dawn.village.x, y: dawn.village.y + 45 };
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    this.camera.baseZoom = this.computeZoom();
    this.camera.viewW = this.width;
    this.camera.viewH = this.height;
    if (this.state === 'menu') this.camera.zoom = this.camera.baseZoom;
  }

  computeZoom() {
    const w = this.width;
    const h = this.height;
    if (h > w * 1.05) return clamp(Math.max(w / 560, h / 1080), 0.62, 1.2);
    if (h < 560) return clamp(Math.max(w / 1020, h / 640), 0.66, 1.15);
    return clamp(Math.min(w / 1280, h / 800) * 1.18, 0.8, 1.45);
  }

  bindEvents() {
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.input.touchActive = false;
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const p = this.camera.screenToWorld(sx, sy, this.width, this.height);
      if (this.player && dist(p.x, p.y, this.player.x, this.player.y) > 24) {
        this.mouseAim = Math.atan2(p.y - this.player.y, p.x - this.player.x);
        this.mouseTimer = 4;
      }
    });
    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.state !== 'playing' || e.pointerType === 'touch') return;
      if (e.button === 0) this.player.tryAttack();
      if (e.button === 2) this.player.castFruit();
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  onKeyDown(e) {
    const code = e.code;
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(code)) e.preventDefault();

    if (code === 'KeyM') {
      this.audio.ensure();
      this.ui.toggleMute();
      return;
    }

    if (code === 'Escape') {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
      else if (this.state === 'dialogue') this.ui.closeDialogue();
      else if (this.state === 'shop') this.closeShop();
      else if (this.state === 'inventory') this.closeInventory();
      return;
    }

    if (code === 'Tab' || code === 'KeyI') {
      e.preventDefault();
      if (this.state === 'playing') this.openInventory();
      else if (this.state === 'inventory') this.closeInventory();
      return;
    }

    if (this.state !== 'playing') return;

    if (code === 'KeyQ') this.player.castFruit();
    if (code === 'ShiftLeft' || code === 'ShiftRight') this.player.tryDash();
    if (code === 'KeyE') this.interact();
    if (code === 'Space' || code === 'KeyJ') this.player.tryAttack();

    this.keys.add(code);
  }

  onKeyUp(e) {
    this.keys.delete(e.code);
  }

  onTouchAction(action) {
    if (this.state !== 'playing') return;
    if (action === 'attack') this.player.tryAttack();
    else if (action === 'fruit') this.player.castFruit();
    else if (action === 'dash') this.player.tryDash();
    else if (action === 'interact') this.interact();
  }

  updateInput() {
    let dx = 0;
    let dy = 0;
    if (this.input.touchActive) {
      dx = this.input.touchX;
      dy = this.input.touchY;
      const len = Math.hypot(dx, dy);
      if (len < 0.16) {
        dx = 0;
        dy = 0;
      } else {
        const scale = Math.min(1, len) / len;
        dx *= scale;
        dy *= scale;
      }
    } else {
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) dx -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) dx += 1;
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) dy -= 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) dy += 1;
      const len = Math.hypot(dx, dy);
      if (len > 1) {
        dx /= len;
        dy /= len;
      }
    }
    this.input.dirX = dx;
    this.input.dirY = dy;
    this.input.moving = Math.hypot(dx, dy) > 0.05;
    this.mouseTimer = Math.max(0, this.mouseTimer - 1 / 60);
    this.input.aimAngle = this.mouseTimer > 0 && !this.input.touchActive ? this.mouseAim : null;
    if (this.input.moving && !this.input.touchActive && this.mouseTimer <= 0) {
      this.input.aimAngle = Math.atan2(dy, dx);
    }
  }

  loop(now) {
    const raw = Math.min(0.05, (now - this.last) / 1000 || 0);
    this.last = now;
    if (this.state === 'playing') {
      let dt = raw;
      if (this.hitStop > 0) {
        this.hitStop -= raw;
        dt *= 0.22;
      }
      this.time += dt;
      this.update(dt);
    } else if (this.state === 'menu') {
      this.time += raw;
      this.menuTime += raw;
      this.world.update(raw);
      this.updateMenuCamera(raw);
      this.audio.update(raw);
    } else if (this.state === 'dead' || this.state === 'victory') {
      this.time += raw * 0.35;
      this.world.update(raw * 0.35);
      this.updateParticles(raw * 0.35);
      this.effects.forEach((e) => e.update(raw * 0.35, this));
      this.effects = this.effects.filter((e) => !e.dead);
      this.camera.updateShake(raw);
      this.audio.update(raw);
    } else {
      this.audio.update(raw);
    }
    this.draw();
    requestAnimationFrame(this.raf);
  }

  updateMenuCamera(dt) {
    const dawn = this.world.islands[0];
    const t = this.menuTime;
    this.camera.x = dawn.x + Math.sin(t * 0.09) * 130;
    this.camera.y = dawn.y + Math.cos(t * 0.12) * 80;
    this.camera.zoom = lerp(this.camera.zoom, this.camera.baseZoom * 0.92, 1 - Math.pow(0.01, dt));
  }

  update(dt) {
    this.runTime += dt;
    this.world.update(dt);
    this.updateInput();

    if (this.keys.has('Space') || this.keys.has('KeyJ')) this.player.tryAttack();

    this.player.update(dt, this.input);
    if (this.world.safeZoneAt(this.player.x, this.player.y)) {
      this.player.hpRegenTimer = 0;
      this.player.enRegenTimer = 0;
    }

    // camera follow with a little look-ahead
    const p = this.player;
    const look = p.mode === 'boat' ? 0.34 : 0.16;
    const tx = p.x + (p.moving ? Math.cos(p.facing) * 55 * look : 0);
    const ty = p.y + (p.moving ? Math.sin(p.facing) * 55 * look : 0);
    const k = 1 - Math.pow(0.0008, dt);
    this.camera.x = lerp(this.camera.x, tx, k);
    this.camera.y = lerp(this.camera.y, ty, k);
    const targetZoom = this.camera.baseZoom * (p.mode === 'boat' ? 0.9 : 1);
    this.camera.zoom = lerp(this.camera.zoom, targetZoom, 1 - Math.pow(0.05, dt));
    this.camera.updateShake(dt);

    for (const enemy of this.enemies) enemy.update(dt);
    this.enemies = this.enemies.filter((e) => !e.dead || e.deathTimer > 0);

    for (const proj of this.projectiles) proj.update(dt, this);
    this.projectiles = this.projectiles.filter((p) => !p.dead);

    for (const pickup of this.pickups) pickup.update(dt, this);
    this.pickups = this.pickups.filter((p) => !p.dead);

    for (const effect of this.effects) effect.update(dt, this);
    this.effects = this.effects.filter((e) => !e.dead);

    this.updateParticles(dt);

    for (const t of this.texts) {
      t.life -= dt;
      t.y += t.vy * dt;
      t.vy *= Math.pow(0.1, dt);
      t.x += (t.vx || 0) * dt;
    }
    this.texts = this.texts.filter((t) => t.life > 0);

    // respawn far-away enemies so the seas stay dangerous
    for (let i = this.respawnQueue.length - 1; i >= 0; i--) {
      const r = this.respawnQueue[i];
      if (this.time >= r.at) {
        const d = dist(r.spawn.x, r.spawn.y, this.player.x, this.player.y);
        if (d > 700 || this.enemies.length < 6) {
          this.spawnEnemy(r.spawn);
          this.respawnQueue.splice(i, 1);
        } else {
          r.at = this.time + 6;
        }
      }
    }

    this.updatePrompt();
    this.updateZoneBanners();
    this.updateBossWarning(dt);

    if (this.victoryTimer > 0) {
      this.victoryTimer -= dt;
      if (this.victoryTimer <= 0) this.triggerVictory();
    }

    this.ui.updateHUD(this);
    this.ui.updateMinimap(this);
    this.audio.update(dt);
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.life -= dt;
      p.vy += (p.gravity || 0) * dt;
      p.vx *= Math.pow(p.drag ?? 0.2, dt);
      p.vy *= Math.pow(p.drag ?? 0.2, dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.size > 0.1) p.size *= Math.pow(0.7, dt);
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  updateZoneBanners() {
    if (!this.player || this.state !== 'playing') return;
    const isl = this.world.isLand(this.player.x, this.player.y);
    if (isl) {
      if (this.lastIslandId !== isl.id) {
        this.lastIslandId = isl.id;
        this.ui.banner(isl.name, isl.subtitle.toUpperCase());
      }
    } else {
      this.lastIslandId = null;
    }
  }

  updateBossWarning(dt) {
    if (this.bossWarningTimer > 0) {
      this.bossWarningTimer -= dt;
      if (this.bossWarningTimer <= 0) this.bossWarningVisible = false;
    }
    const onSkull = this.world.isLand(this.player.x, this.player.y)?.id === 'skull';
    if (onSkull && this.boss && this.boss.alive && !this.warnedSkull) {
      this.warnedSkull = true;
      this.bossWarningVisible = false;
      this.ui.toast('Captain Morro — the undead captain of Skull Rock', 'boss');
      this.audio.thunder();
      this.shake(9, 0.6);
    }
    if (!onSkull) this.warnedSkull = false;
  }

  getInteractable() {
    const p = this.player;
    if (p.mode === 'boat') {
      const isl = this.nearestLanding();
      if (isl) return { type: 'land', island: isl, text: `Go ashore at ${isl.name}` };
      return null;
    }

    for (const npc of this.world.npcs) {
      if (dist(p.x, p.y, npc.x, npc.y) < 95) {
        return {
          type: 'npc',
          npc,
          text: npc.role === 'shop' ? "Browse Old Marlow's wares" : 'Speak with Captain Rhea',
        };
      }
    }
    for (const shrine of this.world.shrines) {
      if (!shrine.claimed && dist(p.x, p.y, shrine.x, shrine.y) < 92) {
        return { type: 'shrine', shrine, text: `Claim the ${FRUITS[shrine.fruitId].short} Fruit` };
      }
    }
    for (const chest of this.world.chests) {
      if (!chest.opened && dist(p.x, p.y, chest.x, chest.y) < 82) {
        return { type: 'chest', chest, text: 'Open the treasure chest' };
      }
    }
    const dock = this.world.nearestDock(p.x, p.y);
    if (dock && dist(p.x, p.y, dock.x, dock.y) < 120) {
      return { type: 'dock', dock, text: 'Board your ship' };
    }
    if (this.world.isWater(p.x, p.y)) {
      return { type: 'summon', text: 'Summon your ship' };
    }
    return null;
  }

  nearestLanding() {
    const p = this.player;
    let best = null;
    let bestD = 260;
    for (const isl of this.world.islands) {
      const d = dist(p.x, p.y, isl.x, isl.y);
      const rad = this.world.radiusAt(isl, Math.atan2((p.y - isl.y) / 0.94, p.x - isl.x));
      const gap = d - rad;
      if (gap < bestD && gap > -20) {
        bestD = gap;
        best = isl;
      }
    }
    return best;
  }

  updatePrompt() {
    if (this.state !== 'playing') {
      this.ui.setPrompt(null);
      return;
    }
    const it = this.getInteractable();
    this.ui.setPrompt(it ? it.text : null);
  }

  interact() {
    if (this.state !== 'playing') return;
    const it = this.getInteractable();
    if (!it) return;

    if (it.type === 'npc') {
      if (it.npc.role === 'shop') this.openShop();
      else this.talkToRhea();
      return;
    }

    if (it.type === 'shrine') {
      const s = it.shrine;
      s.claimed = true;
      this.shrinesClaimed = (this.shrinesClaimed || 0) + 1;
      const fruit = FRUITS[s.fruitId];
      this.player.equipFruit(s.fruitId);
      this.audio.freeze();
      this.audio.levelUp();
      this.burst(s.x, s.y - 50, 34, fruit.colors.a, { speed: 230, life: 0.9, size: 5, gravity: 80 });
      this.burst(s.x, s.y - 50, 22, fruit.colors.b, { speed: 150, life: 1.1, size: 4, gravity: 40 });
      this.effects.push(new RingEffect(s.x, s.y, 12, 180, 0.8, fruit.colors.glow, 6));
      this.ui.toast(`${fruit.name} equipped!`, '');
      this.spawnFloatText(s.x, s.y - 80, fruit.short.toUpperCase(), fruit.colors.a);
      this.shake(7, 0.3);
      const q = this.quests[this.questIndex];
      if (q && q.type === 'shrine') {
        q.progress++;
        this.completeQuest(this.questIndex);
      }
      return;
    }

    if (it.type === 'chest') {
      const c = it.chest;
      c.opened = true;
      this.player.addBerries(c.berries);
      this.audio.coin();
      this.spawnFloatText(c.x, c.y - 36, `+${c.berries}`, '#ffd76b');
      this.burst(c.x, c.y - 16, 20, '#ffd76b', { speed: 150, life: 0.7, size: 4, gravity: 220 });
      this.ui.toast(`Treasure! +${c.berries} berries`, '');
      return;
    }

    if (it.type === 'dock') {
      this.boardShip(it.dock);
      return;
    }

    if (it.type === 'summon') {
      this.summonShip();
      return;
    }

    if (it.type === 'land') {
      this.landAt(it.island);
    }
  }

  boardShip(dock) {
    const p = this.player;
    p.mode = 'boat';
    p.x = dock.boat.x;
    p.y = dock.boat.y;
    p.boatAngle = dock.angle;
    p.facing = dock.angle;
    p.moving = false;
    this.audio.splash();
    this.burst(p.x, p.y + 8, 18, 'rgba(225,250,255,.9)', { speed: 110, life: 0.7, size: 4, gravity: 180 });
    this.ui.toast('Ship boarded — press E near an island to go ashore', '');
  }

  summonShip() {
    const p = this.player;
    p.mode = 'boat';
    p.boatAngle = p.facing;
    this.audio.splash();
    this.burst(p.x, p.y + 8, 22, 'rgba(225,250,255,.9)', { speed: 140, life: 0.8, size: 4, gravity: 160 });
    this.ui.toast('Your ship answers the call', '');
  }

  landAt(island) {
    const p = this.player;
    const shore = this.world.nearestShore(island, p.x, p.y);
    p.mode = 'foot';
    p.x = shore.x;
    p.y = shore.y;
    p.invuln = 1.2;
    p.inWater = false;
    this.audio.splash();
    this.burst(p.x, p.y + 6, 20, 'rgba(225,250,255,.9)', { speed: 120, life: 0.6, size: 4, gravity: 200 });
    this.ui.toast(`Ashore at ${island.name}`, '');
  }

  talkToRhea() {
    const q = this.quests[this.questIndex];
    let text;
    let button = 'Continue';
    let onClose = () => {
      this.state = 'playing';
    };

    if (this.questIndex === 0) {
      text =
        '"So you\'re the new blood. The sea doesn\'t care about your dreams, rookie — it cares about whether you can keep your footing when the deck tilts. The Corsairs have been raiding our docks. Cut down six of them, and I\'ll point you toward something far more dangerous: a Devil Fruit."';
      button = 'Accept the hunt';
      onClose = () => {
        this.state = 'playing';
        this.completeQuest(0);
      };
    } else if (q?.id === 'corsairs') {
      text = `"Six red bandanas, rookie. You've sent ${q.progress} to the deep so far. Keep swinging that blade."`;
    } else if (q?.id === 'fruit') {
      text = '"A shrine glows on Palm Cove, south of here. Sail close, go ashore, and claim what the sea left behind. A Devil Fruit picks its own captain — try not to argue with it."';
    } else if (q?.id === 'marines') {
      text = '"The Marines have bottled up Fort Marina to the east. Eight of them stand between us and open water. Break their line."';
    } else if (q?.id === 'morro') {
      text = '"Captain Morro. Undead, cruel, and too fond of that oversized cutlass. He\'s holed up on Skull Rock in the far southeast. Finish this, and the seas are ours."';
    } else {
      text = '"The horizon is yours now, Captain. Try not to sink."';
    }

    this.state = 'dialogue';
    this.ui.setPrompt(null);
    this.ui.openDialogue({
      name: 'Captain Rhea',
      kicker: 'DAWN ISLE · QUESTMASTER',
      initial: 'R',
      portraitBg: 'linear-gradient(145deg, #8a5cc0, #2a1b3d)',
      text,
      button,
      onClose,
    });
  }

  openShop() {
    this.state = 'shop';
    this.ui.setPrompt(null);
    this.ui.openShop(this);
  }

  closeShop() {
    this.ui.closeShop();
    this.state = 'playing';
  }

  getShopItems() {
    const p = this.player;
    const hpPrice = 250 + p.upgrades.hp * 120;
    const atkPrice = 300 + p.upgrades.atk * 140;
    return [
      {
        id: 'repair',
        icon: '✚',
        name: 'Shipwright Repair',
        desc: 'Restore all health. Because holes in a captain are worse than holes in a hull.',
        price: 60,
        level: 0,
        max: 99,
        enabled: p.berries >= 60 && p.hp < p.maxHp,
      },
      {
        id: 'charm',
        icon: '❤',
        name: 'Sea Charm',
        desc: '+15 maximum health, permanently.',
        price: hpPrice,
        level: p.upgrades.hp,
        max: 5,
        enabled: p.upgrades.hp < 5 && p.berries >= hpPrice,
      },
      {
        id: 'whetstone',
        icon: '⚔',
        name: 'Whetstone',
        desc: '+4 sword damage, permanently.',
        price: atkPrice,
        level: p.upgrades.atk,
        max: 5,
        enabled: p.upgrades.atk < 5 && p.berries >= atkPrice,
      },
      {
        id: 'tonic',
        icon: '✦',
        name: 'Fruit Tonic',
        desc: 'Refill energy and instantly reset your fruit cooldown.',
        price: 120,
        level: 0,
        max: 99,
        enabled: p.berries >= 120 && (p.en < p.maxEn || p.fruitCd > 0),
      },
    ];
  }

  buyShopItem(id) {
    const item = this.getShopItems().find((i) => i.id === id);
    if (!item) return;
    const p = this.player;
    if (!item.enabled) {
      this.audio.error();
      this.ui.toast(p.berries < item.price ? 'Not enough berries' : 'Nothing to repair', 'warn');
      return;
    }
    p.berries -= item.price;
    if (id === 'repair') {
      p.hp = p.maxHp;
      this.ui.showHealFlash();
      this.ui.toast('Hull patched. Health restored.', '');
    } else if (id === 'charm') {
      p.upgrades.hp++;
      p.maxHp += 15;
      p.hp += 15;
      this.ui.toast('Sea Charm equipped. +15 max health.', '');
    } else if (id === 'whetstone') {
      p.upgrades.atk++;
      this.ui.toast('Blade sharpened. +4 sword damage.', '');
    } else if (id === 'tonic') {
      p.en = p.maxEn;
      p.fruitCd = 0;
      this.ui.toast('Fruit Tonic downed. Powers recharged.', '');
    }
    this.audio.coin();
    this.ui.refreshShop(this);
  }

  openInventory() {
    this.state = 'inventory';
    this.ui.setPrompt(null);
    this.ui.openInventory(this);
  }

  closeInventory() {
    this.ui.closeInventory();
    this.state = 'playing';
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.ui.setPrompt(null);
    this.ui.openPause();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.ui.closePause();
  }

  begin(fruitId) {
    this.startFruit = fruitId;
    this.audio.ensure();
    this.resetRun(fruitId);
    this.ui.startPlaying();
    this.ui.banner('Dawn Isle', 'WHERE EVERY LEGEND STARTS');
    this.ui.toast('Welcome to Dawn Isle, Captain', '');
  }

  resetRun(fruitId) {
    this.world = new World();
    const spawn = this.spawnPoint();
    this.player = new Player(this, spawn.x, spawn.y);
    this.player.equipFruit(fruitId || this.startFruit);
    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.particles = [];
    this.texts = [];
    this.effects = [];
    this.respawnQueue = [];
    this.quests = this.buildQuests();
    this.questIndex = 0;
    this.shrinesClaimed = 0;
    this.boss = null;
    this.bossKilled = false;
    this.victoryTimer = -1;
    this.bossWarningVisible = false;
    this.bossWarningTimer = 0;
    this.warnedSkull = false;
    this.lastIslandId = null;
    this.kills = 0;
    this.runTime = 0;
    this.time = 0;
    this.hitStop = 0;
    this.state = 'playing';
    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
    this.camera.zoom = this.camera.baseZoom;
    this.spawnAllEnemies();
    this.ui.hideModals();
    this.ui.hideDeath();
    this.ui.updateMute();
    this.lastIslandId = 'dawn';
  }

  restart() {
    this.ui.hideModals();
    this.resetRun(this.startFruit);
    this.ui.startPlaying();
    this.ui.banner('Dawn Isle', 'WHERE EVERY LEGEND STARTS');
  }

  spawnAllEnemies() {
    for (const spawn of this.world.spawnPoints) this.spawnEnemy(spawn);
  }

  spawnEnemy(spawn) {
    const e = new Enemy(this, spawn);
    this.enemies.push(e);
    if (e.kind === 'boss') this.boss = e;
    return e;
  }

  respawnPlayer() {
    const spawn = this.spawnPoint();
    this.player.respawn(spawn.x, spawn.y);
    this.state = 'playing';
    this.ui.hideDeath();
    this.ui.hideModals();
    this.camera.x = spawn.x;
    this.camera.y = spawn.y;
    this.lastIslandId = 'dawn';
    this.ui.banner('Dawn Isle', 'BACK FROM THE BRINK');
    this.enemies.forEach((e) => {
      e.aggro = false;
      e.aggroTimer = 0;
      if (e.kind !== 'boss') {
        e.x = e.homeX;
        e.y = e.homeY;
      }
    });
    this.ui.toast('The tide carried you home. Berries kept safe.', '');
  }

  onPlayerHurt(amount, source) {
    this.ui.showDamageFlash();
  }

  onPlayerDeath() {
    this.state = 'dead';
    this.audio.death();
    this.ui.setPrompt(null);
    this.burst(this.player.x, this.player.y - 20, 24, '#ffd0b0', { speed: 150, life: 0.9, size: 4, gravity: 200 });
    setTimeout(() => {
      if (this.state === 'dead') this.ui.showDeath();
    }, 550);
  }

  onLevelUp() {
    const p = this.player;
    this.audio.levelUp();
    this.effects.push(new RingEffect(p.x, p.y, 10, 160, 0.8, 'rgba(255,220,110,.9)', 6));
    this.burst(p.x, p.y - 20, 28, '#ffe066', { speed: 200, life: 1, size: 5, gravity: -30 });
    this.spawnFloatText(p.x, p.y - 90, `LEVEL ${p.level}!`, '#ffe066');
    this.ui.toast(`Level ${p.level} — max health and damage increased`, '');
  }

  onEnemyKilled(enemy) {
    this.kills++;
    const p = this.player;
    p.addXp(enemy.xp);
    this.spawnFloatText(enemy.x, enemy.y - 50 * enemy.scale, `+${enemy.xp} XP`, '#a9e8ff');
    const coins = enemy.kind === 'boss' ? 7 : 3;
    for (let i = 0; i < coins; i++) {
      this.pickups.push(new Pickup(enemy.x, enemy.y - 10, Math.max(1, Math.floor(enemy.berries / coins))));
    }
    this.burst(enemy.x, enemy.y - 25 * enemy.scale, 18, '#ffd0a0', { speed: 160, life: 0.7, size: 4, gravity: 240 });
    this.effects.push(new RingEffect(enemy.x, enemy.y, 8, 70 * enemy.scale, 0.45, 'rgba(255,180,120,.7)', 3));
    this.audio.hit(true);

    if (enemy.kind === 'boss') {
      this.bossKilled = true;
      this.shake(14, 0.9);
      this.effects.push(new RingEffect(enemy.x, enemy.y, 20, 340, 1.4, 'rgba(255,220,120,.9)', 10));
      this.burst(enemy.x, enemy.y - 40, 60, '#ffe066', { speed: 320, life: 1.6, size: 6, gravity: 60 });
      this.burst(enemy.x, enemy.y - 40, 30, '#b26bff', { speed: 220, life: 1.8, size: 7, gravity: -40 });
      this.ui.toast('Captain Morro has fallen!', 'boss');
    } else if (!enemy.summoned) {
      this.respawnQueue.push({ spawn: { kind: enemy.kind, level: enemy.level, x: enemy.homeX, y: enemy.homeY, islandId: enemy.islandId }, at: this.time + 32 });
    }

    const q = this.quests[this.questIndex];
    if (q && !q.done) {
      if (q.type === 'kill' && enemy.kind === q.kind) {
        q.progress++;
        this.ui.toast(`${q.title}: ${q.progress} / ${q.target}`, '');
        if (q.progress >= q.target) this.completeQuest(this.questIndex);
      } else if (q.type === 'boss' && enemy.kind === 'boss') {
        q.progress = 1;
        this.completeQuest(this.questIndex);
      }
    } else if (q && q.type === 'boss' && enemy.kind === 'boss') {
      // The captain can be sunk early; the quest chain will resolve when it reaches him.
      this.ui.toast('Morro is dead — but the chain of command remains', 'warn');
    }
  }

  completeQuest(index) {
    const q = this.quests[index];
    if (!q || q.done) return;
    q.done = true;
    q.progress = q.target;
    const p = this.player;
    p.addBerries(q.reward.berries);
    p.addXp(q.reward.xp);
    this.audio.coin();
    this.effects.push(new RingEffect(p.x, p.y, 8, 130, 0.7, 'rgba(255,220,110,.9)', 5));
    this.ui.toast(`Quest complete: ${q.title}  ·  +${q.reward.berries} berries  ·  +${q.reward.xp} XP`, '');
    this.spawnFloatText(p.x, p.y - 74, 'QUEST COMPLETE', '#ffe066');

    if (q.id === 'morro') {
      this.victoryTimer = 2;
      return;
    }

    const next = this.quests.findIndex((qq) => !qq.done);
    if (next === -1) {
      this.victoryTimer = 2;
      return;
    }
    this.questIndex = next;
    const nq = this.quests[next];
    // A fruit claimed early still counts — the shrine quest should never soft-lock.
    if (nq.type === 'shrine' && this.shrinesClaimed > 0) {
      nq.progress = nq.target;
      this.completeQuest(next);
      return;
    }
    setTimeout(() => {
      if (this.state === 'playing' || this.state === 'dead') this.ui.toast(`New quest: ${nq.title}`, '');
    }, 1200);
    if (nq.type === 'boss' && this.bossKilled) {
      this.completeQuest(next);
    }
  }

  triggerVictory() {
    if (this.state === 'victory') return;
    this.state = 'victory';
    this.audio.victory();
    this.ui.setPrompt(null);
    const p = this.player;
    this.ui.showVictory([
      { label: 'Level', value: p.level },
      { label: 'Berries', value: formatNum(p.berries) },
      { label: 'Corsairs Felled', value: this.kills },
      { label: 'Voyage Time', value: formatTime(this.runTime) },
      { label: 'Fruits Found', value: `${p.fruitsFound.size} / 6` },
    ]);
  }

  getObjectiveTarget() {
    const q = this.quests[this.questIndex];
    if (!q) return null;
    if (q.id === 'landfall') {
      const npc = this.world.npcs.find((n) => n.id === 'rhea');
      return npc ? { x: npc.x, y: npc.y } : null;
    }
    if (q.id === 'corsairs') {
      const list = this.enemies.filter((e) => e.alive && e.kind === 'bandit');
      return this.nearestOf(list) || this.islandCenter('dawn');
    }
    if (q.id === 'fruit') {
      const list = this.world.shrines.filter((s) => !s.claimed);
      return this.nearestOf(list) || this.islandCenter('palm');
    }
    if (q.id === 'marines') {
      const list = this.enemies.filter((e) => e.alive && e.kind === 'marine');
      return this.nearestOf(list) || this.islandCenter('fort');
    }
    if (q.id === 'morro') {
      if (this.boss && this.boss.alive) return { x: this.boss.x, y: this.boss.y };
      return this.islandCenter('skull');
    }
    return null;
  }

  nearestOf(list) {
    let best = null;
    let bd = Infinity;
    for (const item of list) {
      const d = dist(this.player.x, this.player.y, item.x, item.y);
      if (d < bd) {
        bd = d;
        best = item;
      }
    }
    return best;
  }

  islandCenter(id) {
    const isl = this.world.islands.find((i) => i.id === id);
    return isl ? { x: isl.x, y: isl.y } : null;
  }

  resolveMelee(player, angle, range, combo) {
    let hits = 0;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const d = dist(player.x, player.y, enemy.x, enemy.y);
      if (d > range + enemy.radius) continue;
      const a = Math.atan2(enemy.y - player.y, enemy.x - player.x);
      if (Math.abs(angleDelta(angle, a)) > 1.0) continue;
      const crit = Math.random() < 0.16;
      const dmg = player.damage * (combo === 3 ? 1.65 : 1) * (crit ? 1.5 : 1);
      enemy.takeDamage(dmg, {
        crit,
        angle: a,
        knockback: combo === 3 ? 280 : 120,
        particle: '#ffe0b0',
      });
      hits++;
    }
    if (hits > 0) {
      this.hitStop = combo === 3 ? 0.055 : 0.03;
      this.shake(combo === 3 ? 7 : 3.5, 0.16);
      if (combo === 3) {
        this.effects.push(new RingEffect(player.x, player.y, 30, 120, 0.3, 'rgba(255,220,130,.8)', 5));
      }
    }
  }

  castFruitSkill(player) {
    const id = player.fruitId;
    const aim = player.aim;
    const f = player.fruit;

    if (id === 'flame') {
      const speed = 540;
      this.projectiles.push(
        new Projectile({
          x: player.x + Math.cos(aim) * 24,
          y: player.y - 26 + Math.sin(aim) * 24,
          vx: Math.cos(aim) * speed,
          vy: Math.sin(aim) * speed,
          owner: 'player',
          damage: player.damage * 1.5 + 28,
          radius: 12,
          color: '#ff9a3d',
          life: 1.15,
          type: 'fireball',
          pierce: true,
        }),
      );
      this.audio.fire();
      this.burst(player.x + Math.cos(aim) * 28, player.y - 26 + Math.sin(aim) * 28, 12, '#ffb23d', { speed: 150, life: 0.4, size: 4, gravity: -60 });
      this.effects.push(new RingEffect(player.x, player.y, 8, 60, 0.25, 'rgba(255,150,70,.7)', 3));
      this.shake(3, 0.12);
    } else if (id === 'ice') {
      this.audio.freeze();
      let hit = 0;
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;
        const d = dist(player.x, player.y, enemy.x, enemy.y);
        if (d > 270) continue;
        const a = Math.atan2(enemy.y - player.y, enemy.x - player.x);
        if (Math.abs(angleDelta(aim, a)) > 1.15) continue;
        enemy.takeDamage(player.damage * 1.2 + 22, { freeze: 2.3, slow: 3, particle: '#bff6ff' });
        this.burst(enemy.x, enemy.y - 28 * enemy.scale, 12, '#bff6ff', { speed: 100, life: 0.8, size: 4, gravity: -40 });
        hit++;
      }
      this.effects.push(new RingEffect(player.x, player.y, 16, 280, 0.55, 'rgba(150,235,255,.8)', 7));
      this.burst(player.x + Math.cos(aim) * 80, player.y + Math.sin(aim) * 80, 20, '#d8f8ff', { speed: 180, life: 0.7, size: 4, gravity: -50 });
      this.shake(4, 0.2);
      if (!hit) this.ui.toast('Ice Age — no targets in the cone', 'warn');
    } else if (id === 'lightning') {
      this.audio.thunder();
      const targets = this.enemies
        .filter((e) => e.alive && dist(player.x, player.y, e.x, e.y) < 380)
        .sort((a, b) => dist(player.x, player.y, a.x, a.y) - dist(player.x, player.y, b.x, b.y))
        .slice(0, 3);
      let prev = { x: player.x, y: player.y - 40 };
      const chain = [{ x: player.x, y: player.y - 40 }];
      for (const enemy of targets) {
        enemy.takeDamage(player.damage * 1.6 + 25, { stun: 0.6, particle: '#ffe66b' });
        this.burst(enemy.x, enemy.y - 30 * enemy.scale, 16, '#fff6a0', { speed: 180, life: 0.5, size: 4, gravity: 0 });
        this.effects.push(new RingEffect(enemy.x, enemy.y, 4, 60, 0.3, 'rgba(255,230,100,.9)', 3));
        prev = enemy;
      }
      if (!targets.length) {
        const tx = player.x + Math.cos(aim) * 220;
        const ty = player.y + Math.sin(aim) * 220 - 30;
        this.effects.push(new BeamEffect(this.jagged(player.x, player.y - 40, tx, ty), '#ffe66b', 0.28, 4));
        this.burst(tx, ty, 14, '#fff6a0', { speed: 130, life: 0.5, size: 3, gravity: 100 });
      } else {
        let from = { x: player.x, y: player.y - 40 };
        for (const enemy of targets) {
          this.effects.push(new BeamEffect(this.jagged(from.x, from.y, enemy.x, enemy.y - 30 * enemy.scale), '#ffe66b', 0.3, 4));
          from = { x: enemy.x, y: enemy.y - 30 * enemy.scale };
        }
      }
      this.effects.push(new RingEffect(player.x, player.y, 10, 90, 0.35, 'rgba(255,230,100,.8)', 4));
      this.shake(8, 0.3);
    } else if (id === 'rubber') {
      this.audio.swing();
      setTimeout(() => this.audio.swing(), 90);
      setTimeout(() => this.audio.swing(), 180);
      const dmg = player.damage * 0.48;
      let hits = 0;
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;
        const d = dist(player.x, player.y, enemy.x, enemy.y);
        if (d > 235) continue;
        const a = Math.atan2(enemy.y - player.y, enemy.x - player.x);
        if (Math.abs(angleDelta(aim, a)) > 0.95) continue;
        for (let i = 0; i < 5; i++) {
          setTimeout(() => {
            if (enemy.alive) enemy.takeDamage(dmg, { knockback: 40, particle: '#ff9ec8', quiet: i > 0 });
          }, i * 45);
        }
        this.burst(enemy.x, enemy.y - 30, 12, '#ff9ec8', { speed: 160, life: 0.45, size: 4, gravity: 40 });
        hits++;
      }
      for (let i = 0; i < 5; i++) {
        const tx = player.x + Math.cos(aim) * (70 + i * 34);
        const ty = player.y - 28 + Math.sin(aim) * (70 + i * 34);
        this.effects.push(new RingEffect(tx, ty, 6, 28, 0.25, 'rgba(255,180,220,.8)', 3));
      }
      this.effects.push(new RingEffect(player.x, player.y, 20, 230, 0.4, 'rgba(255,160,210,.55)', 5));
      this.shake(5, 0.2);
      if (!hits) this.ui.toast('Gatling — nothing in reach', 'warn');
    } else if (id === 'sand') {
      const storm = new StormEffect(player.x, player.y, 200, 3.2, 'rgba(255,225,160,.85)', (s, game) => {
        for (const enemy of game.enemies) {
          if (!enemy.alive) continue;
          if (dist(enemy.x, enemy.y, s.x, s.y) < s.radius) {
            enemy.takeDamage(10 + game.player.level * 1.6, { slow: 0.9, particle: '#e6c98a', quiet: true });
          }
        }
        game.burst(s.x + (Math.random() - 0.5) * s.radius, s.y + (Math.random() - 0.5) * s.radius * 0.7, 3, '#f4d79b', { speed: 60, life: 0.5, size: 4, gravity: -20 });
        game.shake(2, 0.1);
      });
      this.effects.push(storm);
      this.audio.fire();
      this.ui.toast('Sand Storm unleashed', '');
    } else if (id === 'dark') {
      const tx = player.x + Math.cos(aim) * Math.min(230, 160);
      const ty = player.y + Math.sin(aim) * Math.min(230, 160);
      const vortex = new VortexEffect(tx, ty, 195, 2.8, (v, game) => {
        for (const enemy of game.enemies) {
          if (!enemy.alive) continue;
          if (dist(enemy.x, enemy.y, v.x, v.y) < v.radius) {
            enemy.takeDamage(14 + game.player.level * 2, { particle: '#b26bff', quiet: true, stun: 0.1 });
          }
        }
        game.burst(v.x + (Math.random() - 0.5) * v.radius, v.y + (Math.random() - 0.5) * v.radius * 0.6, 2, '#b26bff', { speed: 40, life: 0.6, size: 4, gravity: -30 });
      });
      this.effects.push(vortex);
      this.audio.thunder();
      this.effects.push(new RingEffect(tx, ty, 10, 210, 0.5, 'rgba(150,80,220,.7)', 5));
      this.shake(6, 0.3);
      this.ui.toast('Black Vortex opened', '');
    }

    this.effects.push(new RingEffect(player.x, player.y, 12, 60, 0.3, f.colors.glow, 3));
  }

  jagged(x1, y1, x2, y2) {
    const pts = [{ x: x1, y: y1 }];
    const steps = 7;
    const nx = -(y2 - y1);
    const ny = x2 - x1;
    const len = Math.hypot(nx, ny) || 1;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const jitter = (Math.random() - 0.5) * 26;
      pts.push({
        x: lerp(x1, x2, t) + (nx / len) * jitter,
        y: lerp(y1, y2, t) + (ny / len) * jitter,
      });
    }
    pts.push({ x: x2, y: y2 });
    return pts;
  }

  explodeFireball(x, y, damage, radius) {
    this.audio.fire();
    this.audio.hit(true);
    this.shake(8, 0.35);
    this.effects.push(new RingEffect(x, y, 10, radius * 1.15, 0.45, 'rgba(255,160,70,.9)', 7));
    this.burst(x, y, 30, '#ffb23d', { speed: 260, life: 0.8, size: 5, gravity: 100 });
    this.burst(x, y, 18, '#ffe066', { speed: 170, life: 0.6, size: 4, gravity: -30 });
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      if (dist(x, y, enemy.x, enemy.y) < radius + enemy.radius) {
        const a = Math.atan2(enemy.y - y, enemy.x - x);
        enemy.takeDamage(damage, { burn: 3, knockback: 200, angle: a, particle: '#ff9a3d' });
      }
    }
  }

  burst(x, y, count, color, opts = {}) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const sp = (opts.speed || 120) * (0.35 + Math.random() * 0.65);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - (opts.lift || 0),
        life: (opts.life || 0.6) * (0.6 + Math.random() * 0.5),
        max: opts.life || 0.6,
        size: (opts.size || 3) * (0.6 + Math.random() * 0.7),
        color,
        gravity: opts.gravity ?? 120,
        drag: opts.drag ?? 0.25,
        square: opts.square ?? Math.random() < 0.3,
      });
    }
  }

  spawnDamageText(x, y, text, color = '#fff', crit = false) {
    this.texts.push({
      x: x + (Math.random() - 0.5) * 18,
      y,
      vy: -70,
      vx: (Math.random() - 0.5) * 25,
      life: 0.75,
      max: 0.75,
      text: crit ? `${text}!` : `${text}`,
      color,
      size: crit ? 19 : 13,
    });
  }

  spawnFloatText(x, y, text, color = '#ffe066') {
    this.texts.push({ x, y, vy: -34, vx: 0, life: 1.4, max: 1.4, text, color, size: 14 });
  }

  shake(mag, time) {
    this.camera.shake(mag, time);
  }

  toast(text, type) {
    this.ui.toast(text, type);
  }

  draw() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    this.world.drawOcean(ctx, this.camera, w, h, this.time);
    this.world.drawIslands(ctx, this.camera, w, h, this.time);

    this.camera.apply(ctx);
    this.world.drawFlat(ctx, this.time);

    // ground-level effects
    for (const e of this.effects) {
      if (e instanceof RingEffect || e instanceof StormEffect || e instanceof VortexEffect) e.draw(ctx, this.time);
    }

    const list = this.world.collectDrawables(this.time);
    for (const e of this.enemies) {
      if (e.dead && e.deathTimer <= 0) continue;
      list.push({ y: e.y, kind: 'enemy', ref: e });
    }
    for (const pk of this.pickups) list.push({ y: pk.y, kind: 'pickup', ref: pk });
    if (this.state !== 'menu' && this.player && !this.player.dead) {
      list.push({ y: this.player.y, kind: 'player', ref: this.player });
    }
    list.sort((a, b) => a.y - b.y);

    for (const item of list) {
      switch (item.kind) {
        case 'prop':
          this.world.drawProp(ctx, item.ref, this.time);
          break;
        case 'shrine':
          this.world.drawShrine(ctx, item.ref, this.time);
          break;
        case 'chest':
          this.world.drawChest(ctx, item.ref, this.time);
          break;
        case 'npc':
          this.world.drawNPC(ctx, item.ref, this.time);
          break;
        case 'enemy':
          item.ref.draw(ctx, this.time);
          break;
        case 'pickup':
          item.ref.draw(ctx, this.time);
          break;
        case 'player':
          item.ref.draw(ctx, this.time);
          break;
      }
    }

    for (const e of this.effects) {
      if (!(e instanceof RingEffect || e instanceof StormEffect || e instanceof VortexEffect)) e.draw(ctx, this.time);
    }

    for (const proj of this.projectiles) proj.draw(ctx, this.time);
    this.drawParticles(ctx);
    this.drawTexts(ctx);

    this.camera.restore(ctx);
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      const a = clamp(p.life / (p.max || 0.6), 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.square) {
        const s = p.size;
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  drawTexts(ctx) {
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      const a = clamp(t.life / (t.max || 1), 0, 1);
      ctx.globalAlpha = a;
      ctx.font = `900 ${t.size}px "Trebuchet MS", sans-serif`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(10, 20, 28, .8)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }
}
