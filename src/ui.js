import { FRUITS, STARTERS } from './fruits.js';
import { clamp, formatNum, formatTime, angleTo } from './util.js';

const $ = (id) => document.getElementById(id);

const TITLES = [
  [1, 'ROOKIE PIRATE'],
  [4, 'ISLAND CORSAIR'],
  [7, 'DREAD CAPTAIN'],
  [10, 'SEA LEGEND'],
];

export class UI {
  constructor(game) {
    this.game = game;
    this.selectedFruit = 'flame';
    this.lastFruit = null;
    this.bannerTimer = null;
    this.toastCount = 0;
    this.refs = {
      hud: $('hud'),
      start: $('startScreen'),
      play: $('playBtn'),
      choices: $('fruitChoices'),
      mute: $('muteBtn'),
      log: $('logBtn'),
      pauseBtn: $('pauseBtn'),
      pauseMute: $('pauseMuteBtn'),
      level: $('levelNum'),
      level2: $('levelNum2'),
      title: $('playerTitle'),
      hpFill: $('hpFill'),
      hpText: $('hpText'),
      enFill: $('enFill'),
      enText: $('enText'),
      xpFill: $('xpFill'),
      berries: $('berryText'),
      minimap: $('minimap'),
      bossWrap: $('bossWrap'),
      bossFill: $('bossFill'),
      bossWarning: $('bossWarning'),
      questTitle: $('questTitle'),
      questObj: $('questObj'),
      questFill: $('questFill'),
      questArrow: $('questArrow'),
      questDist: $('questDist'),
      fruitIcon: $('fruitIcon'),
      fruitName: $('fruitName'),
      fruitCd: $('fruitCd'),
      atkCd: $('atkCd'),
      dashCd: $('dashCd'),
      fruitAbility: $('fruitAbility'),
      atkAbility: $('atkAbility'),
      dashAbility: $('dashAbility'),
      prompt: $('prompt'),
      promptText: $('promptText'),
      toasts: $('toasts'),
      banner: $('islandBanner'),
      screenFx: $('screenFx'),
      touch: $('touchControls'),
      touchFruit: document.querySelector('.tbtn.fruit'),
      joystick: $('joystick'),
      stick: $('stick'),
      dialogue: $('dialogue'),
      dialogPortrait: $('dialogPortrait'),
      dialogKicker: $('dialogKicker'),
      dialogName: $('dialogName'),
      dialogText: $('dialogText'),
      dialogBtn: $('dialogBtn'),
      shop: $('shop'),
      shopBerries: $('shopBerries'),
      shopItems: $('shopItems'),
      shopClose: $('shopClose'),
      inventory: $('inventory'),
      invClose: $('invClose'),
      fruitCollection: $('fruitCollection'),
      fruitCount: $('fruitCount'),
      invStats: $('invStats'),
      invQuests: $('invQuests'),
      pause: $('pauseScreen'),
      resume: $('resumeBtn'),
      restart: $('restartBtn'),
      victory: $('victoryScreen'),
      victoryStats: $('victoryStats'),
      sailAgain: $('sailAgainBtn'),
      death: $('deathScreen'),
      respawn: $('respawnBtn'),
    };

    this.miniCtx = this.refs.minimap.getContext('2d');
    this.touchEnabled = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.dialogCallback = null;

    this.buildFruitChoices();
    this.bind();
    this.updateMute();
  }

  buildFruitChoices() {
    this.refs.choices.innerHTML = '';
    for (const id of STARTERS) {
      const f = FRUITS[id];
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'fruit-card' + (id === this.selectedFruit ? ' selected' : '');
      card.dataset.fruit = id;
      card.style.setProperty('--fruit-glow', f.colors.glow + '33');
      card.innerHTML = `
        <div class="fruit-card-top">
          <div class="fruit-art">${f.icon}</div>
          <div class="fruit-card-title">
            <h3>${f.name}</h3>
            <span class="rarity ${f.rarity === 'LEGENDARY' ? 'legendary' : ''}">${f.rarity}</span>
          </div>
        </div>
        <div class="fruit-card-body">
          <div class="fruit-skill">
            <span class="skill-key">Q</span>
            <div>
              <b>${f.skill.name}</b>
              <p>${f.skill.desc}</p>
            </div>
          </div>
        </div>`;
      card.addEventListener('click', () => this.selectFruit(id));
      this.refs.choices.appendChild(card);
    }
  }

  selectFruit(id) {
    this.selectedFruit = id;
    this.game.audio.ensure();
    this.game.audio.blip(520, 0.07, 'triangle', 0.08);
    for (const card of this.refs.choices.querySelectorAll('.fruit-card')) {
      card.classList.toggle('selected', card.dataset.fruit === id);
    }
  }

  bind() {
    this.refs.play.addEventListener('click', () => {
      this.game.audio.ensure();
      this.game.begin(this.selectedFruit);
    });

    this.refs.mute.addEventListener('click', () => {
      this.game.audio.ensure();
      this.toggleMute();
    });
    this.refs.pauseMute.addEventListener('click', () => this.toggleMute());
    this.refs.log.addEventListener('click', () => {
      if (this.game.state === 'playing') this.game.openInventory();
      else if (this.game.state === 'inventory') this.game.closeInventory();
    });
    this.refs.pauseBtn.addEventListener('click', () => {
      if (this.game.state === 'playing') this.game.pause();
      else if (this.game.state === 'paused') this.game.resume();
    });

    this.refs.dialogBtn.addEventListener('click', () => this.closeDialogue());
    this.refs.shopClose.addEventListener('click', () => this.game.closeShop());
    this.refs.invClose.addEventListener('click', () => this.game.closeInventory());
    this.refs.resume.addEventListener('click', () => this.game.resume());
    this.refs.restart.addEventListener('click', () => this.game.restart());
    this.refs.sailAgain.addEventListener('click', () => this.game.restart());
    this.refs.respawn.addEventListener('click', () => this.game.respawnPlayer());

    // Touch buttons
    for (const btn of document.querySelectorAll('.tbtn')) {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.game.audio.ensure();
        this.game.onTouchAction(btn.dataset.action);
      });
    }

    // Virtual joystick
    const joy = this.refs.joystick;
    const stick = this.refs.stick;
    let joyPointer = null;
    const resetJoy = () => {
      joyPointer = null;
      stick.style.transform = 'translate(0px, 0px)';
      this.game.input.touchX = 0;
      this.game.input.touchY = 0;
      this.game.input.touchActive = false;
    };
    joy.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      joyPointer = e.pointerId;
      joy.setPointerCapture(e.pointerId);
      this.game.input.touchActive = true;
      this.game.audio.ensure();
      moveJoy(e);
    });
    joy.addEventListener('pointermove', (e) => {
      if (e.pointerId !== joyPointer) return;
      moveJoy(e);
    });
    const moveJoy = (e) => {
      const rect = joy.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const max = rect.width * 0.33;
      const len = Math.hypot(dx, dy);
      if (len > max) {
        dx = (dx / len) * max;
        dy = (dy / len) * max;
      }
      stick.style.transform = `translate(${dx}px, ${dy}px)`;
      this.game.input.touchX = dx / max;
      this.game.input.touchY = dy / max;
    };
    joy.addEventListener('pointerup', resetJoy);
    joy.addEventListener('pointercancel', resetJoy);
    joy.addEventListener('lostpointercapture', resetJoy);
  }

  toggleMute() {
    const muted = this.game.audio.toggleMute();
    this.updateMute(muted);
    if (!muted) this.game.audio.blip(660, 0.08, 'triangle', 0.1);
  }

  updateMute(muted = this.game.audio.muted) {
    this.refs.mute.classList.toggle('muted', muted);
    this.refs.mute.textContent = muted ? '×' : '♪';
    this.refs.pauseMute.textContent = muted ? 'Sound: Off' : 'Sound: On';
  }

  showStart() {
    this.refs.start.classList.remove('hidden');
    this.refs.hud.classList.add('hidden');
    this.refs.touch.classList.add('hidden');
    document.body.classList.remove('touch-ui');
    this.hideModals();
  }

  startPlaying() {
    this.refs.start.classList.add('hidden');
    this.refs.hud.classList.remove('hidden');
    const showTouch = this.touchEnabled || window.innerWidth < 760 || window.matchMedia('(pointer: coarse)').matches;
    this.refs.touch.classList.toggle('hidden', !showTouch);
    document.body.classList.toggle('touch-ui', showTouch);
  }

  hideHUD() {
    this.refs.hud.classList.add('hidden');
    this.refs.touch.classList.add('hidden');
    document.body.classList.remove('touch-ui');
  }

  updateHUD(game) {
    const p = game.player;
    const r = this.refs;
    r.level.textContent = p.level;
    r.level2.textContent = p.level;
    let title = TITLES[0][1];
    for (const [lvl, name] of TITLES) if (p.level >= lvl) title = name;
    r.title.textContent = title;
    r.hpFill.style.width = `${clamp((p.hp / p.maxHp) * 100, 0, 100)}%`;
    r.hpText.textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
    r.enFill.style.width = `${clamp((p.en / p.maxEn) * 100, 0, 100)}%`;
    r.enText.textContent = `${Math.floor(p.en)}`;
    r.xpFill.style.width = `${clamp((p.xp / p.xpNext) * 100, 0, 100)}%`;
    r.berries.textContent = formatNum(p.berries);

    const fruit = p.fruit;
    if (this.lastFruit !== fruit.id) {
      this.lastFruit = fruit.id;
      r.fruitIcon.innerHTML = fruit.icon;
      r.fruitName.textContent = fruit.skill.name;
    }
    const fruitFrac = fruit.skill.cooldown > 0 ? p.fruitCd / fruit.skill.cooldown : 0;
    r.fruitCd.style.setProperty('--cd', `${clamp(fruitFrac, 0, 1) * 360}deg`);
    r.fruitAbility.classList.toggle('ready', p.fruitCd <= 0 && p.en >= fruit.skill.cost);
    if (r.touchFruit) r.touchFruit.style.setProperty('--cd', `${clamp(fruitFrac, 0, 1) * 360}deg`);
    const atkFrac = p.attackCd > 0 ? p.attackCd / 0.52 : 0;
    r.atkCd.style.setProperty('--cd', `${clamp(atkFrac, 0, 1) * 360}deg`);
    const dashFrac = p.dashCd > 0 ? p.dashCd / 0.55 : 0;
    r.dashCd.style.setProperty('--cd', `${clamp(dashFrac, 0, 1) * 360}deg`);

    const quest = game.quests[game.questIndex];
    if (quest) {
      r.questTitle.textContent = quest.title;
      r.questObj.textContent = quest.objective;
      const prog = quest.target > 0 ? clamp(quest.progress / quest.target, 0, 1) : 0;
      r.questFill.style.width = `${prog * 100}%`;
      const target = game.getObjectiveTarget();
      if (target) {
        const d = Math.hypot(target.x - p.x, target.y - p.y);
        const meters = Math.max(1, Math.round(d / 12));
        r.questDist.textContent = `${meters} m`;
        r.questArrow.style.transform = `rotate(${angleTo(p.x, p.y, target.x, target.y)}rad)`;
      } else {
        r.questDist.textContent = '—';
      }
    }

    const boss = game.boss;
    if (boss && boss.alive && boss.aggro && game.state === 'playing') {
      r.bossWrap.classList.remove('hidden');
      r.bossFill.style.width = `${clamp((boss.hp / boss.maxHp) * 100, 0, 100)}%`;
    } else {
      r.bossWrap.classList.add('hidden');
    }
    r.bossWarning.classList.add('hidden');
  }

  updateMinimap(game) {
    const ctx = this.miniCtx;
    const size = 360;
    const world = game.world;
    const p = game.player;
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, 20);
    ctx.clip();
    ctx.drawImage(world.minimapCanvas, 0, 0, size, size);
    const k = size / world.size;

    // viewport rectangle
    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    ctx.lineWidth = 2;
    const vw = game.width / game.camera.zoom;
    const vh = game.height / game.camera.zoom;
    ctx.strokeRect((game.camera.x - vw / 2) * k, (game.camera.y - vh / 2) * k, vw * k, vh * k);

    // docks
    ctx.fillStyle = 'rgba(255,235,180,.75)';
    for (const dock of world.docks) {
      ctx.beginPath();
      ctx.arc(dock.outerX * k, dock.outerY * k, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // shrines
    for (const s of world.shrines) {
      if (s.claimed) continue;
      const pulse = 1 + Math.sin(game.time * 3 + s.bob) * 0.35;
      ctx.fillStyle = 'rgba(255,220,110,.9)';
      ctx.beginPath();
      ctx.arc(s.x * k, s.y * k, 4.5 * pulse, 0, Math.PI * 2);
      ctx.fill();
    }

    // enemies
    for (const e of game.enemies) {
      if (!e.alive) continue;
      ctx.fillStyle = e.kind === 'boss' ? '#ff4b5c' : 'rgba(235,100,90,.9)';
      const r = e.kind === 'boss' ? 7 : 2.6;
      ctx.beginPath();
      ctx.arc(e.x * k, e.y * k, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // quest target
    const target = game.getObjectiveTarget();
    if (target) {
      const pulse = 1 + Math.sin(game.time * 4) * 0.3;
      ctx.strokeStyle = '#ffe066';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(target.x * k, target.y * k, 8 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      ctx.arc(target.x * k, target.y * k, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // player arrow
    const px = p.x * k;
    const py = p.y * k;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(p.facing + Math.PI / 2);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(10,30,40,.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6.5, 7);
    ctx.lineTo(0, 3.5);
    ctx.lineTo(-6.5, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  setPrompt(text) {
    if (!text) {
      this.refs.prompt.classList.add('hidden');
      return;
    }
    this.refs.prompt.classList.remove('hidden');
    if (this.refs.promptText.textContent !== text) this.refs.promptText.textContent = text;
  }

  toast(text, type = '') {
    if (this.toastCount > 3) return;
    this.toastCount++;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = text;
    this.refs.toasts.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => {
        el.remove();
        this.toastCount--;
      }, 320);
    }, 2600);
  }

  banner(name, sub) {
    const el = this.refs.banner;
    el.querySelector('.ib-name').textContent = name;
    el.querySelector('.ib-sub').textContent = sub;
    el.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => el.classList.remove('show'), 2800);
  }

  showDamageFlash() {
    this.refs.screenFx.animate(
      [
        { boxShadow: 'inset 0 0 0 rgba(220,40,40,0)' },
        { boxShadow: 'inset 0 0 140px rgba(220,40,40,.65)' },
        { boxShadow: 'inset 0 0 0 rgba(220,40,40,0)' },
      ],
      { duration: 420, easing: 'ease-out' },
    );
  }

  showHealFlash() {
    this.refs.screenFx.animate(
      [
        { boxShadow: 'inset 0 0 0 rgba(90,220,160,0)' },
        { boxShadow: 'inset 0 0 120px rgba(90,220,160,.35)' },
        { boxShadow: 'inset 0 0 0 rgba(90,220,160,0)' },
      ],
      { duration: 500, easing: 'ease-out' },
    );
  }

  openDialogue(opts) {
    this.refs.dialogPortrait.textContent = opts.initial || 'R';
    this.refs.dialogPortrait.style.background = opts.portraitBg || 'linear-gradient(145deg, #7a4fa8, #2a1b3d)';
    this.refs.dialogKicker.textContent = opts.kicker || '';
    this.refs.dialogName.textContent = opts.name || '';
    this.refs.dialogText.textContent = opts.text || '';
    this.refs.dialogBtn.textContent = opts.button || 'Continue';
    this.dialogCallback = opts.onClose || null;
    this.refs.dialogue.classList.remove('hidden');
  }

  closeDialogue() {
    this.refs.dialogue.classList.add('hidden');
    const cb = this.dialogCallback;
    this.dialogCallback = null;
    if (cb) cb();
  }

  openShop(game) {
    this.refs.shop.classList.remove('hidden');
    this.refreshShop(game);
  }

  refreshShop(game) {
    const p = game.player;
    this.refs.shopBerries.textContent = formatNum(p.berries);
    this.refs.shopItems.innerHTML = '';
    for (const item of game.getShopItems()) {
      const row = document.createElement('div');
      row.className = 'shop-item';
      row.innerHTML = `
        <div class="si-icon">${item.icon}</div>
        <div class="si-info"><b>${item.name}${item.max < 99 ? ` <span style="color:#8faeb2">(${item.level}/${item.max})</span>` : ''}</b><span>${item.desc}</span></div>
        <button ${item.enabled ? '' : 'disabled'}><span class="coin"></span>${item.price}</button>`;
      const btn = row.querySelector('button');
      btn.addEventListener('click', () => game.buyShopItem(item.id));
      this.refs.shopItems.appendChild(row);
    }
  }

  closeShop() {
    this.refs.shop.classList.add('hidden');
  }

  openInventory(game) {
    this.renderInventory(game);
    this.refs.inventory.classList.remove('hidden');
  }

  renderInventory(game) {
    const p = game.player;
    this.refs.fruitCount.textContent = `${p.fruitsFound.size} / 6`;
    this.refs.fruitCollection.innerHTML = '';
    for (const id of Object.keys(FRUITS)) {
      const f = FRUITS[id];
      const found = p.fruitsFound.has(id);
      const equipped = p.fruitId === id;
      const el = document.createElement('div');
      el.className = `collection-item${found ? '' : ' locked'}${equipped ? ' equipped' : ''}`;
      el.innerHTML = `
        <div class="ci-art">${f.icon}</div>
        <div><b>${found ? f.short : '???'}</b><span>${found ? f.rarity : 'Undiscovered'}</span></div>
        ${equipped ? '<span class="eq-badge">EQUIPPED</span>' : ''}`;
      this.refs.fruitCollection.appendChild(el);
    }
    this.refs.invStats.innerHTML = `
      <div class="stat-cell"><span>Level</span><b>${p.level}</b></div>
      <div class="stat-cell"><span>Berries</span><b>${formatNum(p.berries)}</b></div>
      <div class="stat-cell"><span>Health</span><b>${Math.ceil(p.hp)} / ${p.maxHp}</b></div>
      <div class="stat-cell"><span>Sword Damage</span><b>${p.damage}</b></div>
      <div class="stat-cell"><span>Fruit</span><b>${p.fruit.short}</b></div>
      <div class="stat-cell"><span>Voyage Time</span><b>${formatTime(game.runTime)}</b></div>`;
    this.refs.invQuests.innerHTML = '';
    game.quests.forEach((q, i) => {
      const el = document.createElement('div');
      el.className = `inv-quest${q.done ? ' done' : i === game.questIndex ? ' current' : ''}`;
      el.innerHTML = `<i>${q.done ? '✓' : i + 1}</i><span>${q.title} — ${q.objective}</span>`;
      this.refs.invQuests.appendChild(el);
    });
  }

  closeInventory() {
    this.refs.inventory.classList.add('hidden');
  }

  openPause() {
    this.refs.pause.classList.remove('hidden');
  }

  closePause() {
    this.refs.pause.classList.add('hidden');
  }

  showVictory(stats) {
    this.refs.victoryStats.innerHTML = stats
      .map((s) => `<div class="stat-cell"><span>${s.label}</span><b>${s.value}</b></div>`)
      .join('');
    this.refs.victory.classList.remove('hidden');
    this.hideHUD();
  }

  showDeath() {
    this.refs.death.classList.remove('hidden');
  }

  hideDeath() {
    this.refs.death.classList.add('hidden');
  }

  hideModals() {
    for (const id of ['dialogue', 'shop', 'inventory', 'pause', 'victory', 'death']) {
      $(id)?.classList.add('hidden');
    }
  }
}
