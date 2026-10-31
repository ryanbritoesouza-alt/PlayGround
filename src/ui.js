import { clamp, TAU } from './noise.js';

const $ = id => document.getElementById(id);

const FRUIT_DATA = {
  ember: { name: 'Ember', glyph: '✦', skill: 'EMBER BALL', ultimate: 'INFERNO', color: '#ff7a2a', cost: 20, ultCost: 45 },
  gale: { name: 'Gale', glyph: '≋', skill: 'WIND SLASH', ultimate: 'CYCLONE', color: '#4cf0d6', cost: 18, ultCost: 42 },
  tide: { name: 'Tide', glyph: '◉', skill: 'TIDAL WAVE', ultimate: 'MAELSTROM', color: '#6db7ff', cost: 22, ultCost: 48 },
};

export class UI {
  constructor() {
    this.el = {
      start: $('start-screen'), hud: $('hud'), loading: $('loading'),
      level: $('level-value'), bounty: $('bounty-value'), beli: $('beli-value'), title: $('player-title'),
      hp: $('hp-fill'), hpText: $('hp-text'), energy: $('energy-fill'), energyText: $('energy-text'),
      xp: $('xp-fill'), xpText: $('xp-text'),
      questTitle: $('quest-title'), questObjective: $('quest-objective'), questFill: $('quest-fill'),
      questProgress: $('quest-progress-text'), questDistance: $('quest-distance'), questChapter: $('quest-chapter'),
      bossBar: $('boss-bar'), bossName: $('boss-name'), bossRank: $('boss-rank'), bossFill: $('boss-fill'), bossText: $('boss-hp-text'),
      toasts: $('toast-stack'), interact: $('interact-prompt'), interactText: $('interact-text'),
      dialogue: $('dialogue'), dialogueName: $('dialogue-name'), dialogueText: $('dialogue-text'),
      dialogueActions: $('dialogue-actions'), dialoguePortrait: $('dialogue-portrait'),
      levelup: $('levelup-banner'), levelupLevel: $('levelup-level'),
      zone: $('zone-banner'), zoneName: $('zone-banner-name'), zoneSub: $('zone-banner-sub'), zoneCurrent: $('zone-name'),
      death: $('death-screen'), deathLoss: $('death-loss'), deathCount: $('death-count'),
      victory: $('victory-screen'), pause: $('pause-menu'), map: $('map-overlay'), help: $('help-overlay'),
      minimap: $('minimap'), worldMap: $('world-map'),
      flash: $('flash'), hitVignette: $('vignette-hit'),
      skillName: $('skill-name'), ultimateName: $('ultimate-name'), skillCost: $('skill-cost'), ultimateCost: $('ultimate-cost'),
      slotSkill: $('slot-skill'), slotUltimate: $('slot-ultimate'), slotAttack: $('slot-attack'), slotDash: $('slot-dash'),
      fruitOrb: $('fruit-orb'), fruitGlyph: $('fruit-glyph'), fruitChips: [...document.querySelectorAll('.fruit-chip')],
      pauseLevel: $('pause-level'), pauseBounty: $('pause-bounty'), pauseBeli: $('pause-beli'),
      mapCoords: $('map-coords'), muteBtn: $('mute-btn'),
    };
    this.miniCtx = this.el.minimap.getContext('2d');
    this.mapCtx = this.el.worldMap.getContext('2d');
    this.isTouch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1;
    if (this.isTouch) document.body.classList.add('touch-device');
    this.touchQueue = [];
    this.touchMove = { x: 0, y: 0 };
    this.toastItems = [];
    this.dialogueTimer = null;
    this.lastHud = {};
    this.heading = 90;
    this.compassLabels = [...document.querySelectorAll('.compass-labels span')].map((el, i) => ({ el, angle: i * 45 }));
    this.initTouch();
  }

  /* ----------------------------- lifecycle ----------------------------- */
  start() {
    this.el.start.classList.add('leaving');
    setTimeout(() => this.el.start.classList.add('hidden'), 650);
    this.el.hud.classList.remove('hidden');
    this.el.loading.classList.add('done');
  }

  ready() { this.el.loading.classList.add('done'); }

  showLoading() { this.el.loading.classList.remove('done'); }

  /* ------------------------------- stats ------------------------------- */
  setPlayer({ level, bounty, beli, title }) {
    if (level !== undefined && level !== this.lastHud.level) {
      this.el.level.textContent = level;
      this.lastHud.level = level;
    }
    if (bounty !== undefined) this.el.bounty.textContent = this.formatNumber(bounty);
    if (beli !== undefined) this.el.beli.textContent = this.formatNumber(beli);
    if (title !== undefined) this.el.title.textContent = title;
    this.el.pauseLevel.textContent = level ?? this.el.pauseLevel.textContent;
    this.el.pauseBounty.textContent = this.formatNumber(bounty ?? 0);
    this.el.pauseBeli.textContent = this.formatNumber(beli ?? 0);
  }

  setHealth(hp, max) {
    const pct = clamp(hp / max, 0, 1) * 100;
    this.el.hp.style.width = `${pct}%`;
    this.el.hpText.textContent = `${Math.ceil(Math.max(hp, 0))} / ${max}`;
    this.el.hpText.style.color = pct < 28 ? '#ffe5df' : '';
    if (pct < 25 && !this.lowHp) {
      this.lowHp = true;
    } else if (pct >= 25) this.lowHp = false;
  }

  setEnergy(en, max) {
    const pct = clamp(en / max, 0, 1) * 100;
    this.el.energy.style.width = `${pct}%`;
    this.el.energyText.textContent = `${Math.ceil(Math.max(en, 0))} / ${max}`;
  }

  setXP(xp, max) {
    this.el.xp.style.width = `${clamp(xp / max, 0, 1) * 100}%`;
    this.el.xpText.textContent = `${Math.floor(xp)} / ${max} XP`;
  }

  setZone(name) { this.el.zoneCurrent.textContent = name.toUpperCase(); }

  /* ------------------------------- quest ------------------------------- */
  setQuest({ title, objective, progress = 0, total = 0, chapter = 'CH. 1', distance = null, showProgress = true }) {
    this.el.questTitle.textContent = title;
    this.el.questObjective.textContent = objective;
    this.el.questChapter.textContent = chapter;
    this.el.questFill.style.width = total > 0 ? `${clamp(progress / total, 0, 1) * 100}%` : '0%';
    this.el.questProgress.textContent = total > 0 ? `${progress} / ${total}` : '—';
    this.el.questDistance.textContent = distance == null ? '— m' : `${Math.round(distance)} m`;
    this.el.questProgress.style.opacity = showProgress ? '' : '.28';
  }

  setQuestDistance(distance) {
    if (distance == null) { this.el.questDistance.textContent = '— m'; return; }
    this.el.questDistance.textContent = `${Math.round(distance)} m`;
  }

  /* -------------------------------- boss ------------------------------- */
  setBoss({ visible, name = 'ASHBEARD', rank = 'CAPTAIN', hp = 1, subtitle = '' }) {
    this.el.bossBar.classList.toggle('hidden', !visible);
    if (!visible) return;
    this.el.bossName.textContent = name;
    this.el.bossRank.textContent = rank;
    this.el.bossFill.style.width = `${clamp(hp, 0, 1) * 100}%`;
    this.el.bossText.textContent = `${Math.ceil(clamp(hp, 0, 1) * 100)}%`;
  }

  /* ------------------------------ toasts ------------------------------- */
  toast(text, { kind = 'default', icon = '✦', time = 3600 } = {}) {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.innerHTML = `<span class="t-icon">${icon}</span><span>${text}</span>`;
    this.el.toasts.appendChild(el);
    this.toastItems.push(el);
    while (this.toastItems.length > 4) {
      const old = this.toastItems.shift();
      old.remove();
    }
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => {
        el.remove();
        this.toastItems = this.toastItems.filter(t => t !== el);
      }, 320);
    }, time);
  }

  /* ----------------------------- interaction --------------------------- */
  setInteract(text) {
    if (!text) { this.el.interact.classList.add('hidden'); return; }
    this.el.interact.classList.remove('hidden');
    this.el.interactText.innerHTML = text;
  }

  /* ------------------------------ dialogue ----------------------------- */
  showDialogue({ name, role, text, options = [], portrait = 'R', portraitColor = '' }) {
    if (document.pointerLockElement) document.exitPointerLock();
    this.el.dialogue.classList.remove('hidden');
    this.el.dialogueName.innerHTML = `${name} <span>${role || ''}</span>`;
    this.el.dialoguePortrait.textContent = portrait;
    this.el.dialoguePortrait.style.background = portraitColor || '';
    this.el.dialogueText.textContent = '';
    this.el.dialogueActions.innerHTML = '';
    if (this.dialogueTimer) clearInterval(this.dialogueTimer);
    let i = 0;
    const input = text;
    this.dialogueTimer = setInterval(() => {
      i += 2;
      this.el.dialogueText.textContent = input.slice(0, i);
      if (i >= input.length) { clearInterval(this.dialogueTimer); this.dialogueTimer = null; }
    }, 12);
    options.forEach((opt, index) => {
      const btn = document.createElement('button');
      btn.textContent = opt.label;
      if (opt.primary) btn.className = 'primary';
      btn.addEventListener('click', () => {
        this.hideDialogue();
        opt.onClick?.();
      });
      this.el.dialogueActions.appendChild(btn);
    });
  }

  hideDialogue() {
    this.el.dialogue.classList.add('hidden');
    if (this.dialogueTimer) clearInterval(this.dialogueTimer);
    this.dialogueTimer = null;
  }

  get dialogueOpen() { return !this.el.dialogue.classList.contains('hidden'); }

  /* ------------------------------- hotbar ------------------------------ */
  setFruit(fruitKey, unlocked = ['ember'], level = 1) {
    const data = FRUIT_DATA[fruitKey] || FRUIT_DATA.ember;
    this.el.skillName.textContent = data.skill;
    this.el.ultimateName.textContent = data.ultimate;
    this.el.skillCost.textContent = data.cost;
    this.el.ultimateCost.textContent = data.ultCost;
    this.el.fruitGlyph.textContent = data.glyph;
    this.el.fruitOrb.style.background = `radial-gradient(circle at 34% 26%, #ffe5b0, ${data.color} 44%, #6d1b0d 80%, #3a0b05)`;
    this.el.slotUltimate.classList.toggle('locked-ult', level < 3);
    this.el.fruitChips.forEach(chip => {
      const key = chip.dataset.fruit;
      chip.classList.toggle('active', key === fruitKey);
      chip.classList.toggle('locked', !unlocked.includes(key));
      const lock = chip.querySelector('.lock');
      if (lock) lock.style.display = unlocked.includes(key) ? 'none' : 'block';
    });
    this.lastHud.fruit = fruitKey;
  }

  setCooldowns({ dash = 0, dashMax = 1, skill = 0, skillMax = 1, ultimate = 0, ultimateMax = 1 }) {
    const set = (slot, remaining, max) => {
      const cd = slot.querySelector('.cooldown');
      const text = slot.querySelector('.cd-text');
      const ratio = max > 0 ? clamp(remaining / max, 0, 1) : 0;
      cd.style.transform = `scaleY(${ratio})`;
      if (text) {
        text.textContent = remaining > 0.08 ? (remaining < 1 ? remaining.toFixed(1) : Math.ceil(remaining)) : '';
        text.style.opacity = ratio > 0.02 ? '1' : '0';
      }
    };
    set(this.el.slotDash, dash, dashMax);
    set(this.el.slotSkill, skill, skillMax);
    set(this.el.slotUltimate, ultimate, ultimateMax);
  }

  pulseSlot(which) {
    const slot = { attack: this.el.slotAttack, dash: this.el.slotDash, skill: this.el.slotSkill, ultimate: this.el.slotUltimate }[which];
    if (!slot) return;
    slot.classList.add('active');
    slot.classList.remove('pulse');
    void slot.offsetWidth;
    slot.classList.add('pulse');
    setTimeout(() => slot.classList.remove('active'), 140);
  }

  /* ------------------------------- banners ----------------------------- */
  levelUp(level) {
    this.el.levelupLevel.textContent = level;
    this.el.levelup.classList.remove('hidden');
    const el = this.el.levelup;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    setTimeout(() => this.el.levelup.classList.add('hidden'), 2500);
  }

  showZone(name, subtitle) {
    this.el.zoneName.textContent = name.toUpperCase();
    this.el.zoneSub.textContent = subtitle || '';
    this.el.zone.classList.remove('hidden');
    const el = this.el.zone;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    setTimeout(() => this.el.zone.classList.add('hidden'), 3500);
    this.setZone(name);
  }

  /* ------------------------------- flash ------------------------------- */
  hurtFlash() {
    this.el.hitVignette.style.opacity = '1';
    setTimeout(() => { this.el.hitVignette.style.opacity = '0'; }, 130);
  }

  whiteFlash(strength = 0.2) {
    this.el.flash.style.transition = 'none';
    this.el.flash.style.opacity = String(strength);
    setTimeout(() => {
      this.el.flash.style.transition = 'opacity .35s ease-out';
      this.el.flash.style.opacity = '0';
    }, 30);
  }

  /* ------------------------------- death ------------------------------- */
  showDeath(loss, seconds, onCount) {
    if (document.pointerLockElement) document.exitPointerLock();
    this.el.death.classList.remove('hidden');
    this.el.deathLoss.textContent = this.formatNumber(loss);
    this.el.deathCount.textContent = seconds;
    this.deathTimer = setInterval(() => {
      seconds -= 1;
      this.el.deathCount.textContent = Math.max(0, seconds);
      onCount?.(seconds);
      if (seconds <= 0) {
        clearInterval(this.deathTimer);
        this.deathTimer = null;
      }
    }, 1000);
  }

  hideDeath() {
    this.el.death.classList.add('hidden');
    if (this.deathTimer) clearInterval(this.deathTimer);
    this.deathTimer = null;
  }

  showVictory() {
    if (document.pointerLockElement) document.exitPointerLock();
    this.el.victory.classList.remove('hidden');
  }
  hideVictory() { this.el.victory.classList.add('hidden'); }
  showPause() {
    if (document.pointerLockElement) document.exitPointerLock();
    this.el.pause.classList.remove('hidden');
  }
  hidePause() { this.el.pause.classList.add('hidden'); }
  showMap() {
    if (document.pointerLockElement) document.exitPointerLock();
    this.el.map.classList.remove('hidden');
  }
  hideMap() { this.el.map.classList.add('hidden'); }
  showHelp() {
    if (document.pointerLockElement) document.exitPointerLock();
    this.el.help.classList.remove('hidden');
  }
  hideHelp() { this.el.help.classList.add('hidden'); }
  get mapOpen() { return !this.el.map.classList.contains('hidden'); }
  get helpOpen() { return !this.el.help.classList.contains('hidden'); }
  get paused() { return !this.el.pause.classList.contains('hidden'); }
  get dead() { return !this.el.death.classList.contains('hidden'); }
  get victorious() { return !this.el.victory.classList.contains('hidden'); }

  /* ------------------------------ compass ------------------------------ */
  updateCompass(yaw) {
    const heading = ((-yaw * 180 / Math.PI) + 360) % 360;
    this.heading = heading;
    for (const { el, angle } of this.compassLabels) {
      let delta = ((angle - heading + 540) % 360) - 180;
      const x = delta * 2.1;
      el.style.left = `calc(50% + ${x.toFixed(1)}px)`;
      el.style.opacity = String(clamp(1 - Math.abs(delta) / 110, 0.08, 1));
      if (Math.abs(delta) < 4) el.style.color = '#ffc857';
      else el.style.color = '';
    }
  }

  /* ------------------------------ minimap ------------------------------ */
  drawMinimap(data) {
    const ctx = this.miniCtx;
    const size = this.el.minimap.width;
    const R = size / 2;
    const scale = size / 620;
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(R, R, R - 3, 0, TAU);
    ctx.clip();
    const g = ctx.createRadialGradient(R, R, 10, R, R, R);
    g.addColorStop(0, '#0d5964');
    g.addColorStop(0.55, '#073741');
    g.addColorStop(1, '#032029');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    const px = data.player.x, pz = data.player.z;
    const toMap = (x, z) => [R + (x - px) * scale, R + (z - pz) * scale];

    // wave rings
    ctx.strokeStyle = 'rgba(100, 220, 215, 0.08)';
    ctx.lineWidth = 2;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath(); ctx.arc(R, R, i * 52 + (data.time * 6) % 52, 0, TAU); ctx.stroke();
    }

    // islands
    for (const island of data.islands) {
      const [x, y] = toMap(island.x, island.z);
      const r = island.radius * scale;
      if (x + r < 0 || x - r > size || y + r < 0 || y - r > size) continue;
      ctx.beginPath(); ctx.arc(x, y, r * 1.01, 0, TAU);
      ctx.fillStyle = 'rgba(221, 205, 156, .55)'; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, r * 0.86, 0, TAU);
      ctx.fillStyle = island.biome === 'ember' ? '#5c3b36' : island.biome === 'home' ? '#4e8c4e' : '#5d8256';
      ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, r * 0.25, 0, TAU);
      ctx.fillStyle = island.biome === 'ember' ? 'rgba(255, 88, 24, .55)' : 'rgba(255,255,255,.06)';
      ctx.fill();
      if (island.id === 'dawn') {
        // dock line
        const [dx, dy] = toMap(52, 0);
        ctx.strokeStyle = 'rgba(238,213,165,.7)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x + r * 0.55, y); ctx.lineTo(dx, dy); ctx.stroke();
      }
    }

    // enemies
    for (const e of data.enemies) {
      if (!e.alive) continue;
      let [x, y] = toMap(e.x, e.z);
      const dx = x - R, dy = y - R;
      if (Math.hypot(dx, dy) > R - 12) {
        const k = (R - 12) / Math.hypot(dx, dy);
        x = R + dx * k; y = R + dy * k;
      }
      ctx.beginPath(); ctx.arc(x, y, e.boss ? 6 : 3.4, 0, TAU);
      ctx.fillStyle = e.boss ? '#ff4d1a' : '#ff7a5a'; ctx.fill();
      if (e.boss) {
        ctx.beginPath(); ctx.arc(x, y, 11 + Math.sin(data.time * 5) * 1.5, 0, TAU);
        ctx.strokeStyle = 'rgba(255,80,30,.65)'; ctx.lineWidth = 2; ctx.stroke();
      }
    }

    // markers
    const marker = (x, z, color, r = 5, ring = true) => {
      let [mx, my] = toMap(x, z);
      const dx = mx - R, dy = my - R;
      const dist = Math.hypot(dx, dy);
      if (dist > R - 14) { const k = (R - 14) / dist; mx = R + dx * k; my = R + dy * k; }
      if (ring) {
        ctx.beginPath(); ctx.arc(mx, my, r + 4 + Math.sin(data.time * 4) * 1.6, 0, TAU);
        ctx.strokeStyle = color + '66'; ctx.lineWidth = 2; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(mx, my, r, 0, TAU);
      ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = 'rgba(5,20,24,.7)'; ctx.lineWidth = 1.5; ctx.stroke();
    };
    for (const npc of data.npcs || []) marker(npc.x, npc.z, '#ffc857', 5);
    for (const chest of data.chests || []) marker(chest.x, chest.z, '#ffd76a', 4, false);
    if (data.questTarget) marker(data.questTarget.x, data.questTarget.z, '#4cf0d6', 5);

    // boat
    if (data.boat) {
      let [bx, by] = toMap(data.boat.x, data.boat.z);
      const dx = bx - R, dy = by - R, dist = Math.hypot(dx, dy);
      if (dist > R - 12) { const k = (R - 12) / dist; bx = R + dx * k; by = R + dy * k; }
      ctx.save(); ctx.translate(bx, by); ctx.rotate(-data.boat.yaw);
      ctx.fillStyle = '#e7c88b';
      ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(0, 2); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // player arrow
    ctx.save();
    ctx.translate(R, R);
    ctx.rotate(-data.player.yaw + Math.PI);
    ctx.beginPath();
    ctx.moveTo(0, -14); ctx.lineTo(9, 10); ctx.lineTo(0, 5); ctx.lineTo(-9, 10); ctx.closePath();
    ctx.fillStyle = '#ffe19a';
    ctx.shadowColor = '#ffc857'; ctx.shadowBlur = 12;
    ctx.fill();
    ctx.strokeStyle = 'rgba(55,35,4,.8)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();

    // vignette around edge
    ctx.beginPath(); ctx.arc(R, R, R - 2, 0, TAU);
    ctx.strokeStyle = 'rgba(180,240,235,.10)'; ctx.lineWidth = 6; ctx.stroke();
    ctx.restore();
  }

  /* ----------------------------- world map ----------------------------- */
  drawWorldMap(data) {
    const ctx = this.mapCtx;
    const w = this.el.worldMap.width, h = this.el.worldMap.height;
    ctx.clearRect(0, 0, w, h);
    const bounds = { x0: -335, x1: 340, z0: -305, z1: 285 };
    const sx = w / (bounds.x1 - bounds.x0);
    const sz = h / (bounds.z1 - bounds.z0);
    const s = Math.min(sx, sz) * 0.93;
    const ox = w / 2 - ((bounds.x0 + bounds.x1) / 2) * s;
    const oy = h / 2 - ((bounds.z0 + bounds.z1) / 2) * s;
    const toMap = (x, z) => [ox + x * s, oy + z * s];

    // sea
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#082b35');
    bg.addColorStop(0.5, '#06323c');
    bg.addColorStop(1, '#041f28');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

    // chart grid
    ctx.strokeStyle = 'rgba(120, 220, 210, 0.055)'; ctx.lineWidth = 1;
    for (let x = -300; x <= 340; x += 50) { const [gx] = toMap(x, 0); ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
    for (let z = -300; z <= 280; z += 50) { const [, gy] = toMap(0, z); ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }

    // sea texture dashes
    ctx.strokeStyle = 'rgba(100, 210, 200, 0.07)'; ctx.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
      const x = (i * 211) % w, y = (i * 137) % h;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 18, y - 6, x + 34, y); ctx.stroke();
    }

    // trade route
    const route = [[0, 0], [225, -58], [-185, 162], [-152, -218]];
    ctx.setLineDash([8, 10]); ctx.strokeStyle = 'rgba(255, 200, 87, 0.18)'; ctx.lineWidth = 2;
    for (let i = 0; i < route.length - 1; i++) {
      const [ax, ay] = toMap(...route[i]); const [bx, by] = toMap(...route[i + 1]);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }
    ctx.setLineDash([]);

    // islands
    for (const island of data.islands) {
      const [x, y] = toMap(island.x, island.z);
      const r = island.radius * s;
      // reef glow
      let grd = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 1.45);
      grd.addColorStop(0, 'rgba(90, 210, 200, .16)'); grd.addColorStop(1, 'rgba(90, 210, 200, 0)');
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(x, y, r * 1.45, 0, TAU); ctx.fill();
      // irregular island silhouette
      ctx.beginPath();
      const points = 24;
      for (let i = 0; i <= points; i++) {
        const a = (i / points) * TAU;
        const n = 0.86 + Math.sin(i * 2.7 + island.seed) * 0.09 + Math.sin(i * 5.1) * 0.05;
        const px = x + Math.cos(a) * r * n, py = y + Math.sin(a) * r * n;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(220, 205, 160, .85)'; ctx.fill();
      ctx.save(); ctx.clip();
      const land = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      if (island.biome === 'ember') { land.addColorStop(0, '#8f4b32'); land.addColorStop(0.5, '#5b3b38'); land.addColorStop(1, '#3e2f30'); }
      else if (island.biome === 'home') { land.addColorStop(0, '#91c56a'); land.addColorStop(0.55, '#4a8c4a'); land.addColorStop(1, '#2e663c'); }
      else { land.addColorStop(0, '#7ca369'); land.addColorStop(0.6, '#4f7c4f'); land.addColorStop(1, '#355d3d'); }
      ctx.fillStyle = land; ctx.fillRect(x - r, y - r, r * 2, r * 2);
      // ridges
      ctx.strokeStyle = 'rgba(20, 40, 30, .18)'; ctx.lineWidth = 2;
      for (let k = -2; k <= 2; k++) {
        ctx.beginPath(); ctx.arc(x + k * r * 0.22, y - r * 0.08, r * 0.32, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      }
      // volcano
      if (island.biome === 'ember') {
        ctx.beginPath(); ctx.arc(x, y, r * 0.16, 0, TAU); ctx.fillStyle = '#ff5a1a'; ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, r * 0.26, 0, TAU); ctx.strokeStyle = 'rgba(255,120,40,.55)'; ctx.lineWidth = 3; ctx.stroke();
      }
      ctx.restore();
      // outline
      ctx.strokeStyle = 'rgba(240, 228, 188, .35)'; ctx.lineWidth = 1.5; ctx.stroke();

      // label
      ctx.textAlign = 'center';
      ctx.font = '700 15px Outfit, sans-serif';
      ctx.fillStyle = 'rgba(255, 246, 218, .92)';
      ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 8;
      ctx.fillText(island.name.toUpperCase(), x, y + r + 21);
      ctx.font = '700 8px Outfit, sans-serif';
      ctx.fillStyle = island.biome === 'ember' ? 'rgba(255,130,90,.8)' : 'rgba(200, 238, 230, .52)';
      ctx.fillText(island.subtitle.toUpperCase(), x, y + r + 34);
      ctx.shadowBlur = 0;

      // dock
      if (island.id === 'dawn') {
        const [dx, dy] = toMap(52, 0);
        ctx.strokeStyle = 'rgba(255, 215, 150, .8)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x + r * 0.6, y); ctx.lineTo(dx, dy); ctx.stroke();
      }
      if (island.id === 'ember') {
        const [bx, by] = toMap(238, -38);
        ctx.beginPath(); ctx.arc(bx, by, 6 + Math.sin(data.time * 4) * 1.5, 0, TAU);
        ctx.fillStyle = '#ff4d1a'; ctx.fill();
        ctx.beginPath(); ctx.arc(bx, by, 13, 0, TAU);
        ctx.strokeStyle = 'rgba(255,77,26,.5)'; ctx.lineWidth = 2; ctx.stroke();
      }
    }

    // quest target
    if (data.questTarget) {
      const [x, y] = toMap(data.questTarget.x, data.questTarget.z);
      ctx.strokeStyle = '#4cf0d6'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 15 + Math.sin(data.time * 4) * 2, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y); ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5); ctx.stroke();
    }

    // boat
    if (data.boat) {
      const [x, y] = toMap(data.boat.x, data.boat.z);
      ctx.save(); ctx.translate(x, y); ctx.rotate(-data.boat.yaw);
      ctx.fillStyle = '#f0d49a';
      ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(7, 7); ctx.lineTo(0, 3); ctx.lineTo(-7, 7); ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // player
    const [px, py] = toMap(data.player.x, data.player.z);
    ctx.save(); ctx.translate(px, py); ctx.rotate(-data.player.yaw + Math.PI);
    ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(10, 11); ctx.lineTo(0, 5); ctx.lineTo(-10, 11); ctx.closePath();
    ctx.fillStyle = '#ffe19a'; ctx.shadowColor = '#ffc857'; ctx.shadowBlur = 16; ctx.fill();
    ctx.strokeStyle = 'rgba(50,30,4,.9)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();

    // compass rose
    const cx = w - 78, cy = h - 70;
    ctx.save(); ctx.translate(cx, cy);
    ctx.strokeStyle = 'rgba(255,200,87,.22)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, 38, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 28, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(255,200,87,.7)'; ctx.font = '700 9px Outfit'; ctx.textAlign = 'center';
    ctx.fillText('N', 0, -45); ctx.fillText('S', 0, 50); ctx.fillText('E', 47, 3); ctx.fillText('W', -47, 3);
    ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(5, 0); ctx.lineTo(0, 24); ctx.lineTo(-5, 0); ctx.closePath();
    ctx.fillStyle = 'rgba(255,200,87,.4)'; ctx.fill();
    ctx.restore();

    // border and title
    ctx.strokeStyle = 'rgba(255, 200, 87, .12)'; ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
    ctx.fillStyle = 'rgba(255,200,87,.4)'; ctx.font = '700 9px Outfit'; ctx.textAlign = 'left';
    ctx.fillText('THE GRAND TIDE · NAVIGATION CHART · SCALE 1:12', 16, 22);
    if (data.mapCoords) this.el.mapCoords.textContent = data.mapCoords;
  }

  /* ------------------------------ touch -------------------------------- */
  initTouch() {
    const joy = $('joystick');
    const knob = $('joy-knob');
    let joyId = null;
    const max = 46;
    const update = (e) => {
      const rect = joy.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > max) { dx = dx / d * max; dy = dy / d * max; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.touchMove.x = dx / max;
      this.touchMove.y = -dy / max;
    };
    joy.addEventListener('pointerdown', e => {
      joyId = e.pointerId; joy.setPointerCapture(e.pointerId); update(e); e.preventDefault();
    });
    joy.addEventListener('pointermove', e => { if (e.pointerId === joyId) update(e); });
    const end = e => {
      if (e.pointerId !== joyId) return;
      joyId = null; this.touchMove.x = 0; this.touchMove.y = 0;
      knob.style.transform = '';
    };
    joy.addEventListener('pointerup', end);
    joy.addEventListener('pointercancel', end);

    document.querySelectorAll('#touch-actions .touch-btn').forEach(btn => {
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        this.touchQueue.push(btn.dataset.action);
        btn.classList.add('pressed');
      });
      btn.addEventListener('pointerup', () => btn.classList.remove('pressed'));
      btn.addEventListener('pointercancel', () => btn.classList.remove('pressed'));
    });
  }

  consumeTouch() { return this.touchQueue.splice(0); }

  formatNumber(n) {
    const v = Math.round(n);
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 10_000) return `${(v / 1000).toFixed(1)}K`;
    return v.toLocaleString('en-US');
  }
}

export { FRUIT_DATA };
