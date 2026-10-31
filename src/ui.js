const $ = (id) => document.getElementById(id);

export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export class UI {
  constructor() {
    this.el = {
      hud: $('hud'),
      menu: $('menu'),
      how: $('how'),
      settings: $('settings'),
      pause: $('pause'),
      death: $('death'),
      win: $('win'),
      fade: $('fade'),
      doorNum: $('door-num'),
      roomType: $('room-type'),
      objective: $('objective'),
      prompt: $('prompt'),
      subtitle: $('subtitle'),
      warning: $('warning'),
      crosshair: $('crosshair'),
      healthFill: $('health-fill'),
      healthNum: $('health-num'),
      staminaFill: $('stamina-fill'),
      batteryFill: $('battery-fill'),
      batteryNum: $('battery-num'),
      inventory: $('inventory'),
      noiseWrap: $('noise-wrap'),
      noiseFill: $('noise-fill'),
      noiseLabel: $('noise-label'),
      hideOverlay: $('hide-overlay'),
      damage: $('damage'),
      staticEl: $('static'),
      grain: $('grain'),
      toast: $('toast'),
      loading: $('loading'),
      continueBtn: $('btn-continue'),
      continueDoor: $('continue-door'),
      bestRecord: $('best-record'),
      checkpointRecord: $('checkpoint-record'),
      pauseDoor: $('pause-door'),
      pauseTime: $('pause-time'),
      deathTitle: $('death-title'),
      deathCause: $('death-cause'),
      deathDoor: $('death-door'),
      deathBest: $('death-best'),
      deathTime: $('death-time'),
      winDeaths: $('win-deaths'),
      winTime: $('win-time'),
      retryBtn: $('btn-retry'),
    };
    this._subTimer = null;
    this._warnTimer = null;
    this._toastTimer = null;
    this._last = {};
    this._danger = document.createElement('div');
    this._danger.id = 'danger';
    document.getElementById('app').appendChild(this._danger);
    this._bindClose();
  }

  _bindClose() {
    document.querySelectorAll('[data-close]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.hide(btn.dataset.close);
        if (btn.dataset.close === 'settings' && this.onSettingsClose) this.onSettingsClose();
      });
    });
  }

  onSettingsClose = null;

  show(name) { this.el[name]?.classList.remove('hidden'); }
  hide(name) { this.el[name]?.classList.add('hidden'); }
  hideAllScreens() {
    for (const n of ['menu', 'how', 'settings', 'pause', 'death', 'win']) this.hide(n);
  }

  showHUD(show) { this.el.hud.classList.toggle('hidden', !show); }
  setPlaying(playing) { document.body.classList.toggle('playing', playing); }

  setMenuData(best, checkpoint) {
    this.el.bestRecord.textContent = best ? `DOOR ${String(best).padStart(2, '0')}` : '—';
    this.el.checkpointRecord.textContent = checkpoint ? `DOOR ${String(checkpoint).padStart(2, '0')}` : '—';
    if (checkpoint) {
      this.el.continueBtn.classList.remove('hidden');
      this.el.continueDoor.textContent = String(checkpoint).padStart(2, '0');
    } else {
      this.el.continueBtn.classList.add('hidden');
    }
  }

  setDoor(n, type = '') {
    this.el.doorNum.textContent = String(n).padStart(2, '0');
    this.el.roomType.textContent = type;
  }

  setObjective(text) {
    if (this._last.objective === text) return;
    this._last.objective = text;
    this.el.objective.textContent = text;
  }

  setHealth(hp) {
    hp = Math.max(0, Math.min(100, hp));
    this.el.healthFill.style.transform = `scaleX(${hp / 100})`;
    this.el.healthNum.textContent = Math.round(hp);
  }

  setStamina(v) {
    this.el.staminaFill.style.transform = `scaleX(${Math.max(0, Math.min(1, v))})`;
  }

  setBattery(v) {
    this.el.batteryFill.style.transform = `scaleX(${Math.max(0, Math.min(1, v / 100))})`;
    this.el.batteryNum.textContent = `${Math.round(v)}%`;
  }

  setInventory(keys, bandages, flashlightOn) {
    const key = `${keys}|${bandages}|${flashlightOn}`;
    if (this._last.inv === key) return;
    this._last.inv = key;
    this.el.inventory.innerHTML = '';
    if (keys > 0) {
      const d = document.createElement('span');
      d.className = 'inv-item';
      d.innerHTML = `KEY <b>×${keys}</b>`;
      this.el.inventory.appendChild(d);
    }
    if (bandages > 0) {
      const d = document.createElement('span');
      d.className = 'inv-item';
      d.innerHTML = `BANDAGE <b>×${bandages}</b> · H`;
      this.el.inventory.appendChild(d);
    }
    if (flashlightOn) {
      const d = document.createElement('span');
      d.className = 'inv-item';
      d.innerHTML = `FLASHLIGHT <b>ON</b>`;
      this.el.inventory.appendChild(d);
    }
  }

  setPrompt(text, key = 'E', locked = false) {
    if (!text) {
      this.el.prompt.classList.remove('show', 'locked');
      this._last.prompt = '';
      return;
    }
    if (this._last.prompt === text) return;
    this._last.prompt = text;
    this.el.prompt.innerHTML = `<kbd>${key}</kbd><span></span>`;
    this.el.prompt.querySelector('span').textContent = text;
    this.el.prompt.classList.add('show');
    this.el.prompt.classList.toggle('locked', locked);
  }

  setCrosshairHot(hot) {
    this.el.crosshair.classList.toggle('hot', !!hot);
  }

  subtitle(text, duration = 3.6, name = '') {
    if (!text) { this.el.subtitle.classList.remove('show'); return; }
    clearTimeout(this._subTimer);
    this.el.subtitle.innerHTML = name ? `<span class="name">${name}</span><span></span>` : '<span></span>';
    this.el.subtitle.querySelector('span:last-child').textContent = text;
    this.el.subtitle.classList.add('show');
    this._subTimer = setTimeout(() => this.el.subtitle.classList.remove('show'), duration * 1000);
  }

  warning(text, duration = 2.4, blue = false) {
    clearTimeout(this._warnTimer);
    if (!text) { this.el.warning.classList.remove('show'); return; }
    this.el.warning.textContent = text;
    this.el.warning.classList.toggle('blue', blue);
    this.el.warning.classList.add('show');
    if (duration > 0) {
      this._warnTimer = setTimeout(() => this.el.warning.classList.remove('show'), duration * 1000);
    }
  }

  flashDamage(strength = 1) {
    this.el.damage.style.transition = 'opacity 0.05s ease';
    this.el.damage.style.opacity = String(Math.min(0.95, 0.35 + strength * 0.45));
    setTimeout(() => {
      this.el.damage.style.transition = 'opacity 0.7s ease';
      this.el.damage.style.opacity = '0';
    }, 90);
  }

  setStatic(v) {
    this.el.staticEl.style.opacity = String(Math.max(0, Math.min(0.55, v)));
  }

  setDanger(v) {
    this._danger.style.opacity = String(Math.max(0, Math.min(0.85, v)));
  }

  setHidden(hidden) {
    this.el.hideOverlay.classList.toggle('hidden', !hidden);
  }

  setNoise(v) {
    if (v === null || v === undefined) {
      this.el.noiseWrap.classList.add('hidden');
      return;
    }
    this.el.noiseWrap.classList.remove('hidden');
    const pct = Math.max(0, Math.min(1, v));
    this.el.noiseFill.style.transform = `scaleX(${pct})`;
    this.el.noiseLabel.textContent = pct < 0.08 ? 'SILENT' : pct < 0.35 ? 'LOW' : pct < 0.7 ? 'LOUD' : 'DEAFENING';
  }

  fade(on) {
    this.el.fade.classList.toggle('on', on);
  }

  toast(text, sub = '') {
    clearTimeout(this._toastTimer);
    this.el.toast.innerHTML = sub ? `<span></span><em></em>` : '<span></span>';
    this.el.toast.querySelector('span').textContent = text;
    if (sub) this.el.toast.querySelector('em').textContent = sub;
    this.el.toast.classList.add('show');
    this._toastTimer = setTimeout(() => this.el.toast.classList.remove('show'), 3200);
  }

  showPause(door, time) {
    this.el.pauseDoor.textContent = String(door).padStart(2, '0');
    this.el.pauseTime.textContent = formatTime(time);
    this.show('pause');
  }

  showDeath({ cause, door, best, time, checkpoint }) {
    this.el.deathCause.textContent = cause;
    this.el.deathDoor.textContent = String(door).padStart(2, '0');
    this.el.deathBest.textContent = String(best).padStart(2, '0');
    this.el.deathTime.textContent = formatTime(time);
    this.el.retryBtn.textContent = checkpoint ? 'RETRY FROM CHECKPOINT' : 'TRY AGAIN';
    this.show('death');
  }

  showWin({ deaths, time }) {
    this.el.winDeaths.textContent = deaths;
    this.el.winTime.textContent = formatTime(time);
    this.show('win');
  }

  setLoading(done) {
    if (done) {
      this.el.loading.classList.add('done');
      setTimeout(() => this.el.loading.classList.add('hidden'), 900);
    }
  }

  setGrain(on) {
    document.body.classList.toggle('no-grain', !on);
  }

  bindSettings(settings, onChange) {
    const vol = $('set-volume');
    const sens = $('set-sens');
    const invert = $('set-invert');
    const grain = $('set-grain');
    const shake = $('set-shake');
    vol.value = Math.round(settings.volume * 100);
    $('vol-val').textContent = `${vol.value}%`;
    sens.value = Math.round(settings.sensitivity * 100);
    $('sens-val').textContent = settings.sensitivity.toFixed(1);
    invert.checked = settings.invert;
    grain.checked = settings.grain;
    shake.checked = settings.shake;

    vol.addEventListener('input', () => {
      $('vol-val').textContent = `${vol.value}%`;
      settings.volume = Number(vol.value) / 100;
      onChange(settings);
    });
    sens.addEventListener('input', () => {
      $('sens-val').textContent = (Number(sens.value) / 100).toFixed(1);
      settings.sensitivity = Number(sens.value) / 100;
      onChange(settings);
    });
    invert.addEventListener('change', () => { settings.invert = invert.checked; onChange(settings); });
    grain.addEventListener('change', () => { settings.grain = grain.checked; onChange(settings); this.setGrain(grain.checked); });
    shake.addEventListener('change', () => { settings.shake = shake.checked; onChange(settings); });
  }

  setPauseStats(door, time) {
    this.el.pauseDoor.textContent = String(door).padStart(2, '0');
    this.el.pauseTime.textContent = formatTime(time);
  }
}
