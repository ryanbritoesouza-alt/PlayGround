import { TAU, clamp, lerp, dist, angleDelta, approachAngle, roundRect, randRange } from './util.js';

const PLAYER_PALETTE = {
  coat: '#2f8496',
  coatDark: '#1d5d6c',
  shirt: '#f3ead4',
  sash: '#e05a4a',
  pants: '#31415e',
  skin: '#e2ad7b',
  hair: '#3b2a22',
  hat: '#e8c46a',
  hatBand: '#c94a3d',
  blade: '#dfe9ef',
};

const ENEMY_TYPES = {
  bandit: {
    hp: 38,
    hpPer: 17,
    dmg: 4,
    dmgPer: 1.7,
    speed: 108,
    radius: 15,
    aggro: 310,
    range: 62,
    windup: 0.42,
    cooldown: 1.15,
    xp: 20,
    xpPer: 16,
    berries: 5,
    palette: { coat: '#b6403d', coatDark: '#7c2728', shirt: '#d9b48a', sash: '#f1c14e', pants: '#43303a', skin: '#d9a06c', hair: '#3a2420', hat: '#5a2c2c', hatBand: '#f1c14e' },
  },
  marine: {
    hp: 52,
    hpPer: 19,
    dmg: 5,
    dmgPer: 1.6,
    speed: 92,
    radius: 15,
    aggro: 380,
    range: 250,
    windup: 0.55,
    cooldown: 1.9,
    xp: 30,
    xpPer: 18,
    berries: 8,
    ranged: true,
    palette: { coat: '#eef2f5', coatDark: '#b9c6d2', shirt: '#2f4a72', sash: '#3d6fb4', pants: '#2f4a72', skin: '#e0ad7c', hair: '#2a2a30', hat: '#f4f7f9', hatBand: '#3d6fb4' },
  },
  brute: {
    hp: 110,
    hpPer: 34,
    dmg: 8,
    dmgPer: 2.1,
    speed: 74,
    radius: 21,
    aggro: 320,
    range: 82,
    windup: 0.8,
    cooldown: 1.8,
    xp: 55,
    xpPer: 26,
    berries: 16,
    slam: true,
    scale: 1.28,
    palette: { coat: '#7a4d34', coatDark: '#54321f', shirt: '#c7a477', sash: '#d9a33d', pants: '#3d2e2c', skin: '#c98f60', hair: '#211a1a', hat: '#4a3126', hatBand: '#d9a33d' },
  },
  boss: {
    hp: 1350,
    hpPer: 0,
    dmg: 16,
    dmgPer: 1.2,
    speed: 118,
    radius: 28,
    aggro: 560,
    range: 92,
    windup: 0.65,
    cooldown: 1.4,
    xp: 900,
    xpPer: 0,
    berries: 500,
    boss: true,
    scale: 1.62,
    palette: { coat: '#2d1e3f', coatDark: '#1a1225', shirt: '#6a5a78', sash: '#b6303d', pants: '#1a1225', skin: '#c9d3d9', hair: '#0f0a14', hat: '#1c1428', hatBand: '#b6303d' },
  },
};

export class Player {
  constructor(game, x, y) {
    this.game = game;
    this.x = x;
    this.y = y;
    this.radius = 15;
    this.mode = 'foot';
    this.facing = -Math.PI / 2;
    this.aim = -Math.PI / 2;
    this.level = 1;
    this.xp = 0;
    this.xpNext = 50;
    this.berries = 0;
    this.maxHp = 120;
    this.hp = 120;
    this.maxEn = 100;
    this.en = 100;
    this.baseDamage = 22;
    this.hpRegenTimer = 0;
    this.enRegenTimer = 0;
    this.stamina = 100;
    this.maxStamina = 100;
    this.staminaTimer = 0;
    this.speed = 238;
    this.walkPhase = 0;
    this.moving = false;
    this.movingDir = { x: 0, y: 0 };
    this.attackCd = 0;
    this.attackAnim = 0;
    this.attackAngle = 0;
    this.attackCombo = 0;
    this.comboTimer = 0;
    this.attackHitDone = true;
    this.dashTime = 0;
    this.dashAngle = 0;
    this.dashCd = 0;
    this.invuln = 0;
    this.hitFlash = 0;
    this.dead = false;
    this.fruitId = 'flame';
    this.fruitCd = 0;
    this.fruitCasting = 0;
    this.upgrades = { hp: 0, atk: 0 };
    this.fruitsFound = new Set();
    this.inWater = false;
    this.wakeTimer = 0;
    this.boatAngle = -Math.PI / 2;
    this.boatBob = 0;
    this.lastDamageAt = -99;
    this.afterimages = [];
  }

  get damage() {
    return this.baseDamage + this.upgrades.atk * 4;
  }

  get fruit() {
    return this.game.fruits[this.fruitId];
  }

  equipFruit(id) {
    this.fruitId = id;
    this.fruitsFound.add(id);
    this.fruitCd = 0;
  }

  addXp(amount) {
    this.xp += amount;
    let leveled = false;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = Math.round(50 * Math.pow(this.level, 1.45));
      this.maxHp += 24;
      this.maxEn += 8;
      this.baseDamage += 4;
      this.hp = this.maxHp;
      this.en = this.maxEn;
      leveled = true;
    }
    if (leveled) {
      this.game.onLevelUp();
    }
  }

  addBerries(n) {
    this.berries += n;
  }

  heal(n) {
    this.hp = Math.min(this.maxHp, this.hp + n);
  }

  tryAttack() {
    if (this.dead || this.mode !== 'foot' || this.attackCd > 0) return false;
    this.attackCombo = this.comboTimer > 0 ? (this.attackCombo % 3) + 1 : 1;
    this.comboTimer = 0.85;
    this.attackCd = this.attackCombo === 3 ? 0.52 : 0.34;
    this.attackAnim = 0.26;
    this.attackAngle = this.aim;
    this.attackHitDone = false;
    this.game.audio.swing();
    this.game.effects.push(new SlashEffect(this.x, this.y, this.attackAngle, 82 + this.attackCombo * 6, this.attackCombo === 3 ? '#ffd76b' : '#e9fbff', this.attackCombo === 3));
    return true;
  }

  tryDash() {
    if (this.dead || this.mode !== 'foot' || this.dashCd > 0 || this.stamina < 22) {
      if (this.stamina < 22) this.game.toast('Not enough stamina', 'warn');
      return false;
    }
    const a = this.moving ? Math.atan2(this.movingDir.y, this.movingDir.x) : this.aim;
    this.dashTime = 0.17;
    this.dashAngle = a;
    this.dashCd = 0.55;
    this.stamina -= 22;
    this.staminaTimer = 0.7;
    this.invuln = Math.max(this.invuln, 0.3);
    this.facing = a;
    this.game.audio.dash();
    for (let i = 0; i < 5; i++) {
      this.game.burst(this.x, this.y + 8, 3, '#bff4ff', { speed: 70, life: 0.35, size: 3 });
    }
    return true;
  }

  castFruit() {
    if (this.dead || this.mode !== 'foot') return false;
    if (this.fruitCd > 0) {
      this.game.audio.error();
      return false;
    }
    if (this.en < this.fruit.skill.cost) {
      this.game.toast('Not enough energy', 'warn');
      this.game.audio.error();
      return false;
    }
    this.en -= this.fruit.skill.cost;
    this.enRegenTimer = 1.2;
    this.fruitCd = this.fruit.skill.cooldown;
    this.fruitCasting = 0.35;
    this.game.castFruitSkill(this);
    return true;
  }

  takeDamage(amount, source) {
    if (this.dead || this.invuln > 0 || this.mode === 'boat') return false;
    this.hp = Math.max(0, this.hp - amount);
    this.invuln = 0.55;
    this.hitFlash = 0.2;
    this.hpRegenTimer = 6;
    this.lastDamageAt = this.game.time;
    this.game.onPlayerHurt(amount, source);
    this.game.shake(7, 0.24);
    this.game.audio.hit(false);
    this.game.burst(this.x, this.y - 28, 10, '#ff6b6b', { speed: 120, life: 0.45, size: 4, gravity: 200 });
    if (this.hp <= 0) {
      this.dead = true;
      this.game.onPlayerDeath();
    }
    return true;
  }

  respawn(x, y) {
    this.x = x;
    this.y = y;
    this.hp = Math.ceil(this.maxHp * 0.6);
    this.en = this.maxEn;
    this.dead = false;
    this.mode = 'foot';
    this.invuln = 2;
    this.inWater = false;
  }

  update(dt, input) {
    if (this.dead) return;
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    this.attackAnim = Math.max(0, this.attackAnim - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.fruitCd = Math.max(0, this.fruitCd - dt);
    this.fruitCasting = Math.max(0, this.fruitCasting - dt);
    this.dashTime = Math.max(0, this.dashTime - dt);
    this.hpRegenTimer = Math.max(0, this.hpRegenTimer - dt);
    this.enRegenTimer = Math.max(0, this.enRegenTimer - dt);
    this.staminaTimer = Math.max(0, this.staminaTimer - dt);

    if (this.attackAnim > 0 && !this.attackHitDone && this.attackAnim < 0.19) {
      this.attackHitDone = true;
      this.game.resolveMelee(this, this.attackAngle, 80 + this.attackCombo * 8, this.attackCombo);
    }

    if (this.mode === 'boat') {
      this.updateBoat(dt, input);
      return;
    }

    this.moving = input.moving;
    this.movingDir.x = input.dirX;
    this.movingDir.y = input.dirY;
    if (input.aimAngle != null) this.aim = input.aimAngle;

    let vx = 0;
    let vy = 0;
    if (this.dashTime > 0) {
      vx = Math.cos(this.dashAngle) * 920;
      vy = Math.sin(this.dashAngle) * 920;
      if (Math.random() < 0.6) {
        this.afterimages.push({ x: this.x, y: this.y, facing: this.facing, life: 0.22, max: 0.22 });
      }
    } else if (input.moving) {
      vx = input.dirX * this.speed;
      vy = input.dirY * this.speed;
      this.facing = Math.atan2(input.dirY, input.dirX);
    }

    const onLand = !!this.game.world.isLand(this.x, this.y);
    this.inWater = !onLand;
    if (this.inWater) {
      vx *= 0.38;
      vy *= 0.38;
      this.stamina -= 9 * dt;
      this.staminaTimer = 0.7;
      if (this.stamina <= 0) {
        this.stamina = 0;
        vx *= 0.55;
        vy *= 0.55;
      }
      if (Math.random() < dt * 8) {
        this.game.burst(this.x + randRange(Math.random, -12, 12), this.y + 4, 1, 'rgba(200,250,255,.8)', { speed: 18, life: 0.5, size: 2.5, gravity: -20 });
      }
    } else if (this.staminaTimer <= 0) {
      this.stamina = Math.min(this.maxStamina, this.stamina + 22 * dt);
    }

    if (!input.moving && this.dashTime <= 0) {
      // still face the mouse / last aim while standing
      if (input.aimAngle != null) this.facing = approachAngle(this.facing, this.aim, dt * 10);
    }

    if (input.moving || this.dashTime > 0) {
      this.walkPhase += dt * (this.dashTime > 0 ? 18 : 11);
    }

    const nx = this.x + vx * dt;
    const ny = this.y + vy * dt;
    // Let the player swim, but never pass through the world edge.
    this.x = clamp(nx, 40, this.game.world.size - 40);
    this.y = clamp(ny, 40, this.game.world.size - 40);

    if (this.hpRegenTimer <= 0 && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + 2.4 * dt);
    }
    if (this.enRegenTimer <= 0 && this.en < this.maxEn) {
      this.en = Math.min(this.maxEn, this.en + 10 * dt);
    }

    this.afterimages = this.afterimages.filter((a) => {
      a.life -= dt;
      return a.life > 0;
    });

    if (this.inWater && this.moving && Math.random() < dt * 10) {
      this.game.burst(this.x, this.y + 4, 2, 'rgba(180,245,255,.7)', { speed: 30, life: 0.5, size: 2.5 });
    }
  }

  updateBoat(dt, input) {
    const speed = 345;
    let vx = 0;
    let vy = 0;
    if (input.moving) {
      vx = input.dirX * speed;
      vy = input.dirY * speed;
      this.facing = Math.atan2(input.dirY, input.dirX);
      this.boatAngle = this.facing;
    }
    const nx = clamp(this.x + vx * dt, 60, this.game.world.size - 60);
    const ny = clamp(this.y + vy * dt, 60, this.game.world.size - 60);
    const world = this.game.world;
    if (!world.isLand(nx, ny)) {
      this.x = nx;
      this.y = ny;
    } else {
      if (!world.isLand(nx, this.y)) this.x = nx;
      if (!world.isLand(this.x, ny)) this.y = ny;
    }
    this.boatBob += dt;
    if (input.moving) {
      this.wakeTimer -= dt;
      if (this.wakeTimer <= 0) {
        this.wakeTimer = 0.05;
        const back = this.facing + Math.PI;
        this.game.burst(
          this.x + Math.cos(back) * 26 + randRange(Math.random, -8, 8),
          this.y + Math.sin(back) * 26 + randRange(Math.random, -6, 6),
          2,
          'rgba(225,250,255,.75)',
          { speed: 40, life: 0.8, size: 4, gravity: 0, drag: 0.9 },
        );
      }
    }
  }

  draw(ctx, time) {
    if (this.dead) return;
    if (this.mode === 'boat') {
      this.game.world.drawBoat(ctx, this.x, this.y, this.boatAngle, time, 1);
      // little sailor on deck
      ctx.save();
      ctx.translate(this.x, this.y - 6);
      ctx.scale(0.72, 0.72);
      drawHumanoid(ctx, {
        x: 0,
        y: 0,
        facing: this.boatAngle - Math.PI / 2,
        walk: 0,
        moving: false,
        palette: PLAYER_PALETTE,
        hat: 'straw',
        time,
        bob: Math.sin(time * 2.4) * 1.2,
        attack: 0,
      });
      ctx.restore();
      return;
    }

    for (const a of this.afterimages) {
      ctx.save();
      ctx.globalAlpha = (a.life / a.max) * 0.28;
      drawHumanoid(ctx, {
        x: a.x,
        y: a.y,
        facing: a.facing,
        walk: this.walkPhase,
        moving: true,
        palette: PLAYER_PALETTE,
        hat: 'straw',
        time,
        attack: 0,
      });
      ctx.restore();
    }

    const ripple = this.inWater ? Math.sin(time * 4) * 0.5 + 0.5 : 0;
    if (this.inWater) {
      ctx.save();
      ctx.strokeStyle = `rgba(220,250,255,${0.35 + ripple * 0.2})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + 2, 16 + i * 8 + ripple * 4, 7 + i * 3, 0, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    if (this.invuln > 0 && Math.floor(time * 14) % 2 === 0) ctx.globalAlpha = 0.65;
    drawHumanoid(ctx, {
      x: this.x,
      y: this.y,
      facing: this.facing,
      walk: this.walkPhase,
      moving: this.moving || this.dashTime > 0,
      palette: PLAYER_PALETTE,
      hat: 'straw',
      time,
      attack: this.attackAnim,
      attackAngle: this.attackAngle,
      flash: this.hitFlash,
      inWater: this.inWater,
      dash: this.dashTime > 0,
    });
    ctx.restore();
  }
}

export class Enemy {
  constructor(game, spawn) {
    const type = ENEMY_TYPES[spawn.kind] || ENEMY_TYPES.bandit;
    this.game = game;
    this.kind = spawn.kind;
    this.type = type;
    this.level = spawn.level;
    this.name = spawn.kind === 'boss' ? 'Captain Morro' : spawn.kind === 'marine' ? 'Marine Grunt' : spawn.kind === 'brute' ? 'Dock Brute' : 'Corsair';
    this.x = spawn.x;
    this.y = spawn.y;
    this.homeX = spawn.x;
    this.homeY = spawn.y;
    this.islandId = spawn.islandId;
    this.summoned = !!spawn.summoned;
    this.radius = type.radius;
    this.scale = type.scale || 1;
    this.maxHp = type.hp + type.hpPer * (spawn.level - 1);
    this.hp = this.maxHp;
    this.damage = type.dmg + type.dmgPer * (spawn.level - 1);
    this.speed = type.speed;
    this.xp = type.xp + type.xpPer * (spawn.level - 1);
    this.berries = type.berries + Math.floor(spawn.level * 1.6);
    this.facing = Math.PI / 2;
    this.walkPhase = Math.random() * 10;
    this.moving = false;
    this.state = 'idle';
    this.windup = 0;
    this.cooldown = Math.random() * 0.8;
    this.aggro = false;
    this.aggroTimer = 0;
    this.stun = 0;
    this.freeze = 0;
    this.slow = 0;
    this.burn = 0;
    this.burnTick = 0;
    this.flash = 0;
    this.dead = false;
    this.deathTimer = 0;
    this.knockX = 0;
    this.knockY = 0;
    this.wanderAngle = Math.random() * TAU;
    this.wanderTimer = Math.random() * 2;
    this.attackAngle = 0;
    this.slam = null;
    this.summonTimer = 8;
    this.phase2 = false;
    this.hitPulse = 0;
    this.id = Enemy.nextId++;
  }

  get alive() {
    return !this.dead;
  }

  takeDamage(amount, opts = {}) {
    if (this.dead) return;
    this.hp -= amount;
    this.flash = 0.18;
    this.hitPulse = 1;
    this.aggro = true;
    this.aggroTimer = 8;
    this.game.spawnDamageText(this.x, this.y - 58 * this.scale, Math.round(amount), opts.crit ? '#ffe066' : opts.color || '#ffffff', opts.crit);
    this.game.burst(this.x, this.y - 30 * this.scale, opts.crit ? 12 : 7, opts.particle || '#ffe0b0', {
      speed: 150,
      life: 0.4,
      size: opts.crit ? 4.5 : 3.2,
      gravity: 260,
    });
    if (opts.knockback) {
      const a = opts.angle ?? Math.atan2(this.y - this.game.player.y, this.x - this.game.player.x);
      this.knockX += Math.cos(a) * opts.knockback;
      this.knockY += Math.sin(a) * opts.knockback;
    }
    if (opts.stun) this.stun = Math.max(this.stun, opts.stun);
    if (opts.freeze) this.freeze = Math.max(this.freeze, opts.freeze);
    if (opts.slow) this.slow = Math.max(this.slow, opts.slow);
    if (opts.burn) {
      this.burn = Math.max(this.burn, opts.burn);
      this.burnTick = 0.4;
    }
    if (!opts.quiet) {
      this.game.audio.hit(amount > 45);
      this.game.shake(amount > 45 ? 6 : 2.5, 0.14);
    }
    if (this.hp <= 0) {
      this.die();
    }
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.deathTimer = 0.7;
    this.hp = 0;
    this.game.onEnemyKilled(this);
  }

  update(dt) {
    if (this.dead) {
      this.deathTimer -= dt;
      return;
    }
    this.flash = Math.max(0, this.flash - dt);
    this.hitPulse = Math.max(0, this.hitPulse - dt * 5);
    this.stun = Math.max(0, this.stun - dt);
    this.freeze = Math.max(0, this.freeze - dt);
    this.slow = Math.max(0, this.slow - dt);

    if (this.burn > 0) {
      this.burn -= dt;
      this.burnTick -= dt;
      if (this.burnTick <= 0) {
        this.burnTick = 0.5;
        this.takeDamage(6 + this.game.player.level * 1.2, { color: '#ff9a4d', particle: '#ff7a3d', quiet: true });
        if (this.dead) return;
      }
      if (Math.random() < dt * 12) {
        this.game.burst(this.x + randRange(Math.random, -10, 10), this.y - 26 * this.scale, 1, '#ff8a3d', { speed: 40, life: 0.4, size: 3, gravity: -90 });
      }
    }

    this.cooldown = Math.max(0, this.cooldown - dt);
    this.aggroTimer = Math.max(0, this.aggroTimer - dt);
    if (this.aggroTimer <= 0 && this.state !== 'windup') this.aggro = false;

    const player = this.game.player;
    const d = dist(this.x, this.y, player.x, player.y);
    const canSee = !player.dead && player.mode === 'foot';
    const playerInSafeHarbor = this.islandId === 'dawn' && this.game.world.safeZoneAt(player.x, player.y);
    if (playerInSafeHarbor) {
      this.aggro = false;
      this.aggroTimer = 0;
      this.state = 'idle';
      this.slam = null;
    }

    if (canSee && !playerInSafeHarbor && (d < this.type.aggro || this.aggro)) {
      this.aggro = true;
      this.aggroTimer = 5;
    } else if (this.aggro && (!canSee || d > this.type.aggro * 1.9)) {
      this.aggro = false;
      this.state = 'idle';
    }

    if (this.stun > 0 || this.freeze > 0) {
      this.applyKnockback(dt);
      return;
    }

    if (this.type.boss && this.aggro) this.updateBoss(dt, d, player);
    else if (this.aggro) this.updateAggro(dt, d, player);
    else this.updateIdle(dt);

    this.applyKnockback(dt);
    this.separate(dt);
  }

  applyKnockback(dt) {
    if (Math.abs(this.knockX) > 1 || Math.abs(this.knockY) > 1) {
      const nx = this.x + this.knockX * dt;
      const ny = this.y + this.knockY * dt;
      if (this.game.world.isLand(nx, ny)) {
        this.x = nx;
        this.y = ny;
      }
      this.knockX *= Math.pow(0.0016, dt);
      this.knockY *= Math.pow(0.0016, dt);
    }
  }

  separate(dt) {
    for (const other of this.game.enemies) {
      if (other === this || other.dead) continue;
      const d = dist(this.x, this.y, other.x, other.y);
      const min = this.radius + other.radius;
      if (d < min && d > 0.01) {
        const push = (min - d) * 0.5;
        const a = Math.atan2(this.y - other.y, this.x - other.x);
        const nx = this.x + Math.cos(a) * push;
        const ny = this.y + Math.sin(a) * push;
        if (this.game.world.isLand(nx, ny)) {
          this.x = nx;
          this.y = ny;
        }
      }
    }
  }

  moveToward(tx, ty, dt, speedMul = 1) {
    const a = Math.atan2(ty - this.y, tx - this.x);
    const sp = this.speed * speedMul * (this.slow > 0 ? 0.45 : 1);
    const nx = this.x + Math.cos(a) * sp * dt;
    const ny = this.y + Math.sin(a) * sp * dt;
    let moved = false;
    if (this.game.world.isLand(nx, ny)) {
      this.x = nx;
      this.y = ny;
      moved = true;
    } else if (this.game.world.isLand(nx, this.y)) {
      this.x = nx;
      moved = true;
    } else if (this.game.world.isLand(this.x, ny)) {
      this.y = ny;
      moved = true;
    }
    this.facing = approachAngle(this.facing, a, dt * 8);
    this.moving = moved;
    if (moved) this.walkPhase += dt * 10;
    return moved;
  }

  updateIdle(dt) {
    this.moving = false;
    // Corsairs are not welcome inside the safe harbor.
    if (this.islandId === 'dawn' && this.game.world.safeZoneAt(this.x, this.y)) {
      this.moveToward(this.homeX, this.homeY, dt, 1.35);
      return;
    }
    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0) {
      this.wanderTimer = randRange(Math.random, 1.5, 4);
      this.wanderAngle = Math.random() * TAU;
      this.wandering = Math.random() < 0.6;
    }
    if (this.wandering) {
      const nx = this.x + Math.cos(this.wanderAngle) * 22 * dt;
      const ny = this.y + Math.sin(this.wanderAngle) * 22 * dt;
      if (this.game.world.isLand(nx, ny) && dist(nx, ny, this.homeX, this.homeY) < 170) {
        this.x = nx;
        this.y = ny;
        this.moving = true;
        this.walkPhase += dt * 6;
        this.facing = approachAngle(this.facing, this.wanderAngle, dt * 4);
      } else {
        this.wandering = false;
      }
    }
  }

  updateAggro(dt, d, player) {
    const type = this.type;
    this.attackAngle = Math.atan2(player.y - this.y, player.x - this.x);
    this.facing = approachAngle(this.facing, this.attackAngle, dt * 9);

    if (this.state === 'windup') {
      this.windup -= dt;
      this.moving = false;
      if (this.windup <= 0) {
        this.state = 'idle';
        this.cooldown = type.cooldown;
        this.performAttack(player);
      }
      return;
    }

    if (type.ranged) {
      const ideal = type.range;
      if (d > ideal + 40) this.moveToward(player.x, player.y, dt);
      else if (d < ideal - 80) this.moveToward(this.x - (player.x - this.x), this.y - (player.y - this.y), dt, 0.8);
      else {
        this.moving = false;
        const strafe = this.attackAngle + Math.PI / 2;
        if (Math.sin(this.walkPhase + this.id) > 0) this.moveToward(this.x + Math.cos(strafe) * 40, this.y + Math.sin(strafe) * 40, dt, 0.4);
      }
      if (this.cooldown <= 0 && d < type.range + 130) {
        this.state = 'windup';
        this.windup = type.windup;
      }
    } else if (d > type.range) {
      this.moveToward(player.x, player.y, dt);
      if (this.cooldown <= 0 && d < type.range + 50) {
        // start winding up a little before contact for a telegraphed strike
        this.state = 'windup';
        this.windup = type.windup;
      }
    } else if (this.cooldown <= 0) {
      this.state = 'windup';
      this.windup = type.windup;
    } else {
      this.moving = false;
    }
  }

  performAttack(player) {
    const type = this.type;
    if (type.ranged) {
      const a = Math.atan2(player.y - this.y, player.x - this.x);
      const speed = 430;
      this.game.projectiles.push(
        new Projectile({
          x: this.x + Math.cos(a) * 20,
          y: this.y - 30 * this.scale + Math.sin(a) * 20,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          owner: 'enemy',
          damage: this.damage,
          radius: 5,
          color: '#ffd36b',
          life: 1.4,
          type: 'bullet',
        }),
      );
      this.game.audio.blip(320, 0.06, 'square', 0.08);
      this.game.burst(this.x + Math.cos(a) * 22, this.y - 30 * this.scale + Math.sin(a) * 22, 4, '#ffe9a3', { speed: 80, life: 0.2, size: 2 });
      return;
    }

    const d = dist(this.x, this.y, player.x, player.y);
    if (type.slam || (type.boss && this.bossSlam)) {
      this.game.effects.push(new RingEffect(this.x, this.y, 14, 120, 0.35, 'rgba(255,120,70,.75)', 5));
      this.game.shake(5, 0.2);
      if (d < 128) player.takeDamage(this.damage * 1.35, this);
      this.game.burst(this.x, this.y, 16, '#d9a06c', { speed: 180, life: 0.5, size: 5, gravity: 300 });
      this.game.audio.hit(true);
      return;
    }

    if (d < type.range + 26) {
      player.takeDamage(this.damage, this);
    }
    this.game.effects.push(new SlashEffect(this.x, this.y, this.facing, 64, '#ffb3a0', false));
    this.game.burst(this.x + Math.cos(this.facing) * 30, this.y + Math.sin(this.facing) * 30 - 20, 5, '#ffd0b0', { speed: 90, life: 0.3, size: 3 });
  }

  updateBoss(dt, d, player) {
    const type = this.type;
    if (!this.phase2 && this.hp < this.maxHp * 0.5) {
      this.phase2 = true;
      this.game.toast('Captain Morro is enraged!', 'boss');
      this.game.shake(12, 0.6);
      this.game.effects.push(new RingEffect(this.x, this.y, 20, 220, 0.7, 'rgba(255,70,90,.8)', 8));
      this.game.audio.thunder();
    }

    this.summonTimer -= dt;
    if (this.summonTimer <= 0 && this.game.enemies.filter((e) => e.alive && e.kind !== 'boss').length < 6) {
      this.summonTimer = this.phase2 ? 9 : 14;
      for (let i = 0; i < 2; i++) {
        const a = Math.random() * TAU;
        const x = this.x + Math.cos(a) * 70;
        const y = this.y + Math.sin(a) * 70;
        if (this.game.world.isLand(x, y)) {
          this.game.spawnEnemy({ kind: 'bandit', level: 9, x, y, islandId: 'skull', summoned: true });
          this.game.effects.push(new RingEffect(x, y, 6, 50, 0.5, 'rgba(120,40,160,.8)', 4));
        }
      }
      this.game.toast('Morro calls his crew!', 'boss');
    }

    if (this.state === 'windup') {
      this.windup -= dt;
      this.moving = false;
      if (this.slam) {
        this.slam.timer -= dt;
        if (this.slam.timer <= 0) {
          const sd = dist(player.x, player.y, this.slam.x, this.slam.y);
          this.game.effects.push(new RingEffect(this.slam.x, this.slam.y, 12, 150, 0.45, 'rgba(255,80,80,.9)', 9));
          this.game.shake(10, 0.35);
          this.game.audio.hit(true);
          if (sd < 150) player.takeDamage(this.damage * 1.6, this);
          this.game.burst(this.slam.x, this.slam.y, 26, '#8a4b3a', { speed: 240, life: 0.7, size: 6, gravity: 260 });
          this.slam = null;
          this.state = 'idle';
          this.cooldown = 0.9;
        }
      } else if (this.windup <= 0) {
        this.state = 'idle';
        this.cooldown = this.phase2 ? 0.7 : 1.1;
        this.performAttack(player);
      }
      return;
    }

    this.attackAngle = Math.atan2(player.y - this.y, player.x - this.x);
    this.facing = approachAngle(this.facing, this.attackAngle, dt * 6);

    if (this.cooldown <= 0 && d < 500) {
      if (d > 120) {
        this.slam = { x: player.x, y: player.y, timer: this.phase2 ? 0.7 : 0.9 };
        this.state = 'windup';
        this.windup = 1.2;
        this.game.audio.blip(120, 0.2, 'sawtooth', 0.12);
      } else {
        this.state = 'windup';
        this.windup = type.windup;
      }
      return;
    }

    if (d > type.range) this.moveToward(player.x, player.y, dt, this.phase2 ? 1.15 : 1);
    else this.moving = false;
  }

  draw(ctx, time) {
    if (this.dead && this.deathTimer <= 0) return;
    const alpha = this.dead ? clamp(this.deathTimer / 0.7, 0, 1) : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (this.dead) {
      ctx.translate(0, (1 - alpha) * 16);
    }

    if (this.type.boss) {
      const aura = ctx.createRadialGradient(this.x, this.y - 20, 8, this.x, this.y - 20, 80);
      aura.addColorStop(0, this.phase2 ? 'rgba(255,40,60,.22)' : 'rgba(120,60,180,.16)');
      aura.addColorStop(1, 'rgba(120,60,180,0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(this.x, this.y - 20, 80, 0, TAU);
      ctx.fill();
    }

    drawHumanoid(ctx, {
      x: this.x,
      y: this.y,
      facing: this.facing,
      walk: this.walkPhase,
      moving: this.moving,
      palette: this.type.palette,
      hat: this.kind === 'marine' ? 'marine' : this.kind === 'boss' ? 'tricorn' : this.kind === 'brute' ? 'bandana' : 'bandana',
      time,
      attack: this.state === 'windup' ? 1 - clamp(this.windup / this.type.windup, 0, 1) : 0,
      attackAngle: this.attackAngle,
      flash: this.flash,
      scale: this.scale,
      boss: this.type.boss,
      phase2: this.phase2,
      frozen: this.freeze > 0,
      bob: Math.sin(time * 2 + this.id) * 0.8,
    });

    if (this.freeze > 0) {
      ctx.strokeStyle = 'rgba(150,235,255,.8)';
      ctx.fillStyle = 'rgba(130,220,255,.22)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + 0.4;
        const x = this.x + Math.cos(a) * 14 * this.scale;
        const y = this.y - 26 * this.scale + Math.sin(a) * 22 * this.scale;
        ctx.beginPath();
        ctx.moveTo(x - 4, y + 4);
        ctx.lineTo(x, y - 8);
        ctx.lineTo(x + 4, y + 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    // telegraphs
    if (this.state === 'windup' && this.alive) {
      const progress = 1 - clamp(this.windup / this.type.windup, 0, 1);
      ctx.save();
      if (this.slam) {
        const pulse = 0.5 + Math.sin(time * 12) * 0.2;
        ctx.fillStyle = `rgba(255,60,60,${0.12 + progress * 0.16})`;
        ctx.strokeStyle = `rgba(255,80,80,${0.4 + pulse * 0.4})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.slam.x, this.slam.y, 150, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(this.slam.x, this.slam.y, 150 * progress, 0, TAU);
        ctx.stroke();
      } else if (this.type.slam) {
        ctx.fillStyle = `rgba(255,80,60,${0.1 + progress * 0.12})`;
        ctx.strokeStyle = 'rgba(255,110,80,.7)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 128, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(this.x, this.y, 128 * progress, 0, TAU);
        ctx.stroke();
      } else if (!this.type.ranged) {
        ctx.translate(this.x, this.y);
        ctx.rotate(this.attackAngle);
        ctx.fillStyle = `rgba(255,90,70,${0.08 + progress * 0.15})`;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, this.type.range + 20, -0.6, 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,120,90,.7)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }

    if (!this.dead && (this.hp < this.maxHp || this.aggro)) {
      const w = this.type.boss ? 86 : 40 * this.scale;
      const y = this.y - (this.type.boss ? 110 : 78 * this.scale);
      ctx.fillStyle = 'rgba(10,16,22,.75)';
      roundRect(ctx, this.x - w / 2, y, w, 6, 3);
      ctx.fill();
      ctx.fillStyle = this.type.boss ? '#d94a4a' : this.kind === 'marine' ? '#5fa8ff' : '#e0635a';
      roundRect(ctx, this.x - w / 2 + 1, y + 1, (w - 2) * clamp(this.hp / this.maxHp, 0, 1), 4, 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
Enemy.nextId = 1;

export class Projectile {
  constructor(opts) {
    Object.assign(this, {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      owner: 'player',
      damage: 10,
      radius: 5,
      color: '#fff',
      life: 1,
      type: 'bullet',
      pierce: false,
      gravity: 0,
      spin: 0,
      trail: true,
    });
    Object.assign(this, opts);
    this.maxLife = this.life;
    this.dead = false;
    this.hitSet = new Set();
    this.angle = Math.atan2(this.vy, this.vx);
  }

  update(dt, game) {
    this.life -= dt;
    if (this.life <= 0) {
      this.expire(game);
      return;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.angle += this.spin * dt;

    if (this.trail) {
      if (this.type === 'fireball') {
        game.burst(this.x + randRange(Math.random, -5, 5), this.y + randRange(Math.random, -5, 5), 1, Math.random() < 0.5 ? '#ff8a3d' : '#ffd86b', {
          speed: 30,
          life: 0.4,
          size: 4 + Math.random() * 3,
          gravity: -40,
        });
      } else if (this.type === 'bullet') {
        game.burst(this.x, this.y, 1, 'rgba(255,230,160,.8)', { speed: 15, life: 0.2, size: 2 });
      }
    }

    if (this.owner === 'player') {
      for (const enemy of game.enemies) {
        if (!enemy.alive || this.hitSet.has(enemy.id)) continue;
        if (dist(this.x, this.y, enemy.x, enemy.y - 24 * enemy.scale) < this.radius + enemy.radius + 8) {
          this.hitSet.add(enemy.id);
          this.hitEnemy(enemy, game);
          if (!this.pierce) {
            this.dead = true;
            return;
          }
        }
      }
    } else {
      const p = game.player;
      if (!p.dead && p.mode === 'foot' && dist(this.x, this.y, p.x, p.y - 26) < this.radius + p.radius + 6) {
        p.takeDamage(this.damage, this);
        this.dead = true;
        game.burst(this.x, this.y, 8, '#ffd36b', { speed: 120, life: 0.3, size: 3 });
        return;
      }
      // ship is safe from stray bullets
      if (!p.dead && p.mode === 'boat' && dist(this.x, this.y, p.x, p.y) < 30) {
        this.dead = true;
        return;
      }
    }
  }

  hitEnemy(enemy, game) {
    if (this.type === 'fireball') {
      game.explodeFireball(this.x, this.y, this.damage, 96);
    } else {
      enemy.takeDamage(this.damage, { particle: this.color, knockback: 80 });
    }
  }

  expire(game) {
    this.dead = true;
    if (this.type === 'fireball') game.explodeFireball(this.x, this.y, this.damage, 96);
  }

  draw(ctx, time) {
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.type === 'fireball') {
      const r = this.radius;
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 2.4);
      g.addColorStop(0, '#fff6c2');
      g.addColorStop(0.35, '#ffb23d');
      g.addColorStop(0.7, 'rgba(255,80,30,.7)');
      g.addColorStop(1, 'rgba(255,60,20,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r * 2.4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff3b0';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.55, 0, TAU);
      ctx.fill();
    } else if (this.type === 'iceShard') {
      ctx.rotate(this.angle);
      ctx.fillStyle = '#d8f8ff';
      ctx.strokeStyle = 'rgba(70,180,230,.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(-4, 6);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-4, -6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.8)';
      ctx.beginPath();
      ctx.arc(-1, -1, this.radius * 0.4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

export class Pickup {
  constructor(x, y, amount) {
    this.x = x;
    this.y = y;
    this.amount = amount;
    this.vx = randRange(Math.random, -70, 70);
    this.vy = randRange(Math.random, -120, -40);
    this.z = 20;
    this.vz = 150;
    this.life = 22;
    this.dead = false;
    this.bob = Math.random() * TAU;
  }

  update(dt, game) {
    this.life -= dt;
    if (this.life <= 0) {
      this.dead = true;
      return;
    }
    this.vz -= 420 * dt;
    this.z = Math.max(0, this.z + this.vz * dt);
    if (this.z === 0) this.vz = 0;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= Math.pow(0.02, dt);
    this.vy *= Math.pow(0.02, dt);
    this.bob += dt * 3;
    const p = game.player;
    const d = dist(this.x, this.y, p.x, p.y);
    if (d < 120) {
      const a = Math.atan2(p.y - this.y, p.x - this.x);
      const pull = 280 * (1 - d / 120);
      this.x += Math.cos(a) * pull * dt;
      this.y += Math.sin(a) * pull * dt;
    }
    if (d < 30 && !p.dead) {
      p.addBerries(this.amount);
      game.audio.coin();
      game.spawnFloatText(this.x, this.y - 12, `+${this.amount}`, '#ffd76b');
      this.dead = true;
      game.burst(this.x, this.y, 6, '#ffd76b', { speed: 80, life: 0.35, size: 3 });
    }
  }

  draw(ctx, time) {
    ctx.save();
    ctx.translate(this.x, this.y);
    const bob = Math.sin(this.bob) * 2;
    ctx.fillStyle = 'rgba(15,30,30,.2)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 7, 3, 0, 0, TAU);
    ctx.fill();
    ctx.translate(0, -this.z - bob);
    const glow = 0.4 + Math.sin(time * 4 + this.bob) * 0.2;
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 18);
    g.addColorStop(0, `rgba(255,220,110,${glow})`);
    g.addColorStop(1, 'rgba(255,220,110,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#f2c14e';
    ctx.strokeStyle = '#8a5b1f';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff0b0';
    ctx.beginPath();
    ctx.arc(-2, -2, 2, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

export class SlashEffect {
  constructor(x, y, angle, range, color, heavy) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.range = range;
    this.color = color;
    this.heavy = heavy;
    this.life = 0.24;
    this.max = 0.24;
    this.dead = false;
  }

  update(dt) {
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }

  draw(ctx) {
    const t = 1 - this.life / this.max;
    const alpha = Math.sin(t * Math.PI) * (this.heavy ? 0.9 : 0.7);
    ctx.save();
    ctx.translate(this.x, this.y - 22);
    ctx.rotate(this.angle);
    ctx.strokeStyle = this.color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = this.heavy ? 9 : 5;
    ctx.lineCap = 'round';
    const spread = 0.95;
    const start = -spread + t * 0.55;
    const end = start + spread * 1.45;
    ctx.beginPath();
    ctx.arc(0, 0, this.range * (0.72 + t * 0.3), start, end);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.8)';
    ctx.lineWidth = this.heavy ? 3 : 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, this.range * (0.72 + t * 0.3), start, end);
    ctx.stroke();
    ctx.restore();
  }
}

export class RingEffect {
  constructor(x, y, r0, r1, life, color, width = 4, follow = null) {
    this.x = x;
    this.y = y;
    this.r0 = r0;
    this.r1 = r1;
    this.life = life;
    this.max = life;
    this.color = color;
    this.width = width;
    this.follow = follow;
    this.dead = false;
  }

  update(dt) {
    this.life -= dt;
    if (this.follow) {
      this.x = this.follow.x;
      this.y = this.follow.y;
    }
    if (this.life <= 0) this.dead = true;
  }

  draw(ctx) {
    const t = 1 - this.life / this.max;
    const ease = 1 - Math.pow(1 - t, 2);
    const r = lerp(this.r0, this.r1, ease);
    ctx.save();
    ctx.globalAlpha = (1 - t) * 0.9;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.width * (1 - t * 0.5);
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, r, r * 0.72, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}

export class BeamEffect {
  constructor(points, color, life = 0.3, width = 4) {
    this.points = points;
    this.color = color;
    this.life = life;
    this.max = life;
    this.width = width;
    this.dead = false;
  }

  update(dt) {
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }

  draw(ctx) {
    const a = clamp(this.life / this.max, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.width * 2.2;
    ctx.globalAlpha = a * 0.22;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    this.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
    ctx.globalAlpha = a;
    ctx.strokeStyle = '#fffbe0';
    ctx.lineWidth = this.width * 0.55;
    ctx.stroke();
    ctx.restore();
  }
}

export class StormEffect {
  constructor(x, y, radius, duration, color, onTick) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.life = duration;
    this.max = duration;
    this.color = color;
    this.onTick = onTick;
    this.tick = 0;
    this.dead = false;
  }

  update(dt, game) {
    this.life -= dt;
    this.tick -= dt;
    if (this.tick <= 0) {
      this.tick = 0.4;
      this.onTick(this, game);
    }
    if (this.life <= 0) this.dead = true;
  }

  draw(ctx, time) {
    const a = clamp(this.life / this.max, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.9 * a;
    const g = ctx.createRadialGradient(this.x, this.y, 4, this.x, this.y, this.radius);
    g.addColorStop(0, 'rgba(255, 232, 160, .28)');
    g.addColorStop(0.7, 'rgba(230, 180, 90, .14)');
    g.addColorStop(1, 'rgba(230, 180, 90, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, this.radius, this.radius * 0.72, 0, 0, TAU);
    ctx.fill();
    for (let i = 0; i < 5; i++) {
      const ang = time * 2.4 + i * 1.25;
      const rr = this.radius * (0.35 + (i % 3) * 0.22);
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = 0.3 * a;
      ctx.beginPath();
      ctx.ellipse(this.x + Math.cos(ang) * 12, this.y + Math.sin(ang) * 8, rr, rr * 0.35, ang, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }
}

export class VortexEffect {
  constructor(x, y, radius, duration, onTick) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.life = duration;
    this.max = duration;
    this.onTick = onTick;
    this.tick = 0;
    this.dead = false;
    this.spin = 0;
  }

  update(dt, game) {
    this.life -= dt;
    this.spin += dt * 3;
    this.tick -= dt;
    if (this.tick <= 0) {
      this.tick = 0.35;
      this.onTick(this, game);
    }
    for (const e of game.enemies) {
      if (!e.alive) continue;
      const d = dist(e.x, e.y, this.x, this.y);
      if (d < this.radius && d > 8) {
        const a = Math.atan2(this.y - e.y, this.x - e.x);
        const pull = (1 - d / this.radius) * 160 * dt;
        const nx = e.x + Math.cos(a) * pull;
        const ny = e.y + Math.sin(a) * pull;
        if (game.world.isLand(nx, ny)) {
          e.x = nx;
          e.y = ny;
        }
      }
    }
    if (this.life <= 0) this.dead = true;
  }

  draw(ctx, time) {
    const a = clamp(this.life / this.max, 0, 1);
    ctx.save();
    ctx.translate(this.x, this.y);
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, this.radius);
    g.addColorStop(0, 'rgba(15, 4, 24, .85)');
    g.addColorStop(0.55, 'rgba(60, 18, 90, .35)');
    g.addColorStop(1, 'rgba(90, 30, 140, 0)');
    ctx.globalAlpha = a;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, this.radius, this.radius * 0.72, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(190,120,255,.55)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const ang = this.spin + i * 1.4;
      const rr = this.radius * (0.3 + (i % 3) * 0.25);
      ctx.beginPath();
      ctx.ellipse(0, 0, rr, rr * 0.5, ang, 0, Math.PI * 1.3);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/** Shared blocky character renderer for the player, NPCs and enemies. */
export function drawHumanoid(ctx, o) {
  const s = o.scale || 1;
  const p = o.palette;
  const bob = o.bob ?? 0;
  const walk = o.walk || 0;
  const swing = o.moving ? Math.sin(walk) * 5 : 0;
  const swing2 = o.moving ? Math.sin(walk + Math.PI) * 5 : 0;
  const attack = o.attack || 0;
  const facing = o.facing ?? 0;
  const dirX = Math.cos(facing);
  const dirY = Math.sin(facing);
  const face = Math.abs(dirX) > 0.3 ? Math.sign(dirX) : 0;
  const inWater = o.inWater;
  const y = o.y + bob;

  ctx.save();
  ctx.translate(o.x, y);
  ctx.scale(s, s);

  if (o.dash) {
    ctx.globalAlpha *= 0.9;
  }

  // shadow
  ctx.fillStyle = 'rgba(12,25,30,.24)';
  ctx.beginPath();
  ctx.ellipse(0, 2, 16, 6, 0, 0, TAU);
  ctx.fill();

  if (inWater) {
    ctx.globalAlpha *= 0.9;
  }

  // legs
  ctx.fillStyle = p.pants;
  roundRect(ctx, -9 + swing2 * 0.3, -18, 7, inWater ? 12 : 18, 2);
  ctx.fill();
  roundRect(ctx, 2 + swing * 0.3, -18, 7, inWater ? 12 : 18, 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.fillRect(-9 + swing2 * 0.3, -5, 7, 3);
  ctx.fillRect(2 + swing * 0.3, -5, 7, 3);

  // cape (boss)
  if (o.boss) {
    ctx.fillStyle = o.phase2 ? 'rgba(120,20,40,.85)' : 'rgba(40,22,60,.85)';
    ctx.beginPath();
    ctx.moveTo(-15, -44);
    ctx.quadraticCurveTo(-24, -10, -16 + Math.sin(walk) * 2, 2);
    ctx.lineTo(16 + Math.sin(walk) * 2, 2);
    ctx.quadraticCurveTo(24, -10, 15, -44);
    ctx.closePath();
    ctx.fill();
  }

  // torso
  ctx.fillStyle = p.coat;
  roundRect(ctx, -13, -46, 26, 30, 5);
  ctx.fill();
  ctx.fillStyle = p.shirt;
  roundRect(ctx, -6, -44, 12, 25, 3);
  ctx.fill();
  ctx.fillStyle = p.coatDark;
  ctx.fillRect(-13, -22, 26, 5);
  ctx.fillStyle = p.sash;
  ctx.fillRect(-13, -28, 26, 5);
  ctx.fillStyle = 'rgba(255,255,255,.13)';
  ctx.fillRect(-13, -46, 6, 30);

  // arms
  const armSwing = o.moving ? Math.sin(walk + Math.PI) * 4 : 0;
  ctx.fillStyle = p.coat;
  roundRect(ctx, -17, -43 + armSwing, 5, 19, 2);
  ctx.fill();
  roundRect(ctx, 12, -43 - armSwing, 5, 19, 2);
  ctx.fill();
  ctx.fillStyle = p.skin;
  roundRect(ctx, -17, -26 + armSwing, 5, 5, 2);
  ctx.fill();
  roundRect(ctx, 12, -26 - armSwing, 5, 5, 2);
  ctx.fill();

  // head
  ctx.fillStyle = p.skin;
  roundRect(ctx, -10, -68, 20, 22, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.1)';
  ctx.fillRect(-10, -50, 20, 4);
  ctx.fillStyle = p.hair;
  roundRect(ctx, -10, -69, 20, 6, 3);
  ctx.fill();
  if (face === 0) {
    ctx.fillRect(-10, -65, 3, 8);
    ctx.fillRect(7, -65, 3, 8);
  } else {
    ctx.fillRect(face > 0 ? 6 : -10, -65, 4, 9);
  }

  // eyes (shift toward facing)
  const eyeShift = clamp(dirX * 3, -2.4, 2.4);
  ctx.fillStyle = o.boss ? (o.phase2 ? '#ff4b5c' : '#e6f7ff') : '#2a2230';
  ctx.fillRect(-4 + eyeShift, -59, 2.6, 3.4);
  ctx.fillRect(2 + eyeShift, -59, 2.6, 3.4);
  if (o.boss) {
    ctx.fillStyle = o.phase2 ? 'rgba(255,60,80,.45)' : 'rgba(150,220,255,.35)';
    ctx.beginPath();
    ctx.arc(-2.7 + eyeShift, -57.3, 4, 0, TAU);
    ctx.arc(3.3 + eyeShift, -57.3, 4, 0, TAU);
    ctx.fill();
  }

  // mouth
  ctx.fillStyle = 'rgba(90,40,35,.55)';
  ctx.fillRect(-2 + eyeShift, -52, 4, 1.5);

  // hats
  if (o.hat === 'straw') {
    ctx.fillStyle = p.hat;
    ctx.beginPath();
    ctx.ellipse(0, -68, 18, 6, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, -74, 11, 8, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = p.hatBand;
    ctx.fillRect(-11, -71, 22, 3);
    ctx.strokeStyle = 'rgba(120,80,30,.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, -68, 18, 6, 0, 0, TAU);
    ctx.stroke();
  } else if (o.hat === 'marine') {
    ctx.fillStyle = p.hat;
    ctx.beginPath();
    ctx.ellipse(0, -69, 16, 5, 0, 0, TAU);
    ctx.fill();
    roundRect(ctx, -9, -77, 18, 9, 4);
    ctx.fill();
    ctx.fillStyle = p.hatBand;
    ctx.fillRect(-9, -72, 18, 3);
    ctx.fillStyle = '#2f5f9e';
    ctx.fillRect(-2, -76, 4, 4);
  } else if (o.hat === 'tricorn') {
    ctx.fillStyle = p.hat;
    ctx.beginPath();
    ctx.moveTo(-22, -68);
    ctx.quadraticCurveTo(-8, -82, 0, -78);
    ctx.quadraticCurveTo(8, -82, 22, -68);
    ctx.quadraticCurveTo(0, -62, -22, -68);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = p.hatBand;
    ctx.fillRect(-12, -73, 24, 3);
    ctx.fillStyle = '#d9d9d9';
    ctx.beginPath();
    ctx.arc(0, -76, 3.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#2a2230';
    ctx.beginPath();
    ctx.arc(-1.2, -76.5, 1, 0, TAU);
    ctx.arc(1.2, -76.5, 1, 0, TAU);
    ctx.fill();
  } else if (o.hat === 'bandana') {
    ctx.fillStyle = p.hat;
    ctx.fillRect(-11, -70, 22, 6);
    ctx.beginPath();
    ctx.moveTo(8, -68);
    ctx.lineTo(18, -64 + Math.sin(o.time * 3) * 2);
    ctx.lineTo(12, -62);
    ctx.closePath();
    ctx.fill();
  }

  // sword / weapon
  if (o.boss) {
    ctx.save();
    ctx.translate(14, -30);
    ctx.rotate(0.5);
    ctx.fillStyle = '#3a2a1e';
    ctx.fillRect(-2, -2, 4, 12);
    ctx.fillStyle = '#cfd8dd';
    ctx.beginPath();
    ctx.moveTo(-4, -2);
    ctx.lineTo(4, -2);
    ctx.lineTo(2, -42);
    ctx.lineTo(0, -48);
    ctx.lineTo(-2, -42);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(80,40,60,.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  } else if (!o.noWeapon) {
    // sheathed cutlass
    ctx.save();
    ctx.translate(-14, -26);
    ctx.rotate(-0.55);
    ctx.fillStyle = '#6b4a2c';
    ctx.fillRect(-2, -3, 4, 9);
    ctx.fillStyle = '#c9d4da';
    ctx.fillRect(-2.5, -28, 5, 26);
    ctx.fillStyle = '#aab6bd';
    ctx.fillRect(-2.5, -28, 2, 26);
    ctx.restore();
  }

  if (attack > 0) {
    // swinging blade
    const prog = 1 - clamp(attack / 0.26, 0, 1);
    const a = (o.attackAngle ?? facing) + lerp(-1.1, 1.15, prog);
    ctx.save();
    ctx.translate(0, -32);
    ctx.rotate(a);
    ctx.fillStyle = p.skin;
    roundRect(ctx, 8, -3, 8, 6, 2);
    ctx.fill();
    ctx.fillStyle = '#6b4a2c';
    ctx.fillRect(14, -2, 6, 4);
    ctx.fillStyle = '#e8f4fa';
    ctx.beginPath();
    ctx.moveTo(19, -3);
    ctx.lineTo(48, -2.5);
    ctx.lineTo(55, 0);
    ctx.lineTo(48, 2.5);
    ctx.lineTo(19, 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#b9cbd4';
    ctx.fillRect(19, 1.4, 30, 1.6);
    ctx.restore();
  }

  if (o.flash > 0) {
    ctx.globalAlpha = clamp(o.flash / 0.18, 0, 1) * 0.55;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, -14, -68, 28, 52, 6);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

export { ENEMY_TYPES, PLAYER_PALETTE };
