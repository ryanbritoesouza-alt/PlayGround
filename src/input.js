export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.locked = false;
    this.onLockChange = null;
    this.onEscape = null;
    this.touchMove = { x: 0, y: 0 };
    this.touchActive = false;
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this._bind();
    if (this.isTouch) this._buildTouch();
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (e.code === 'Escape') {
        if (this.locked) document.exitPointerLock();
        else if (this.onEscape) this.onEscape();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDX = 0; this.mouseDY = 0;
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0 && !this.locked) this.lock();
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (this.onLockChange) this.onLockChange(this.locked);
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // If the player clicks a menu button, pointer lock should not grab the canvas.
    document.addEventListener('pointerdown', (e) => {
      if (e.target.closest && e.target.closest('button, input, .screen')) return;
    }, true);
  }

  lock() {
    if (this.locked) return;
    const p = this.canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  }

  unlock() {
    if (this.locked) document.exitPointerLock();
  }

  consumeLook() {
    const out = { dx: this.mouseDX, dy: this.mouseDY };
    this.mouseDX = 0; this.mouseDY = 0;
    return out;
  }

  down(code) { return this.keys.has(code); }
  wasPressed(code) { return this.pressed.has(code); }

  endFrame() {
    this.pressed.clear();
  }

  _buildTouch() {
    const wrap = document.createElement('div');
    wrap.id = 'touch-controls';
    wrap.innerHTML = `
      <div id="touch-stick"><div id="touch-knob"></div></div>
      <div id="touch-look"></div>
      <div id="touch-buttons">
        <button data-code="KeyE">USE</button>
        <button data-code="KeyF">LIGHT</button>
        <button data-code="ControlLeft">CROUCH</button>
        <button data-code="ShiftLeft">RUN</button>
        <button data-code="Space">JUMP</button>
      </div>`;
    document.getElementById('app').appendChild(wrap);
    this.touchWrap = wrap;

    const stick = wrap.querySelector('#touch-stick');
    const knob = wrap.querySelector('#touch-knob');
    let stickId = null, cx = 0, cy = 0;
    const startStick = (e) => {
      const t = e.changedTouches[0];
      stickId = t.identifier;
      const r = stick.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      moveStick(t);
      e.preventDefault();
    };
    const moveStick = (t) => {
      const max = 46;
      let dx = t.clientX - cx, dy = t.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > max) { dx = dx / d * max; dy = dy / d * max; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.touchMove.x = dx / max;
      this.touchMove.y = dy / max;
    };
    stick.addEventListener('touchstart', startStick, { passive: false });
    stick.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) if (t.identifier === stickId) { moveStick(t); e.preventDefault(); }
    }, { passive: false });
    const endStick = (e) => {
      for (const t of e.changedTouches) if (t.identifier === stickId) {
        stickId = null; this.touchMove.x = 0; this.touchMove.y = 0;
        knob.style.transform = 'translate(0,0)';
      }
    };
    stick.addEventListener('touchend', endStick);
    stick.addEventListener('touchcancel', endStick);

    const look = wrap.querySelector('#touch-look');
    let lookId = null, lx = 0, ly = 0;
    look.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0]; lookId = t.identifier; lx = t.clientX; ly = t.clientY;
      e.preventDefault();
    }, { passive: false });
    look.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) if (t.identifier === lookId) {
        this.mouseDX += (t.clientX - lx) * 1.6;
        this.mouseDY += (t.clientY - ly) * 1.6;
        lx = t.clientX; ly = t.clientY;
        e.preventDefault();
      }
    }, { passive: false });
    const endLook = (e) => { for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null; };
    look.addEventListener('touchend', endLook);
    look.addEventListener('touchcancel', endLook);

    wrap.querySelectorAll('#touch-buttons button').forEach((btn) => {
      const code = btn.dataset.code;
      const press = (e) => {
        e.preventDefault();
        this.keys.add(code); this.pressed.add(code);
        btn.classList.add('on');
      };
      const release = (e) => {
        e.preventDefault();
        this.keys.delete(code); btn.classList.remove('on');
      };
      btn.addEventListener('touchstart', press, { passive: false });
      btn.addEventListener('touchend', release, { passive: false });
      btn.addEventListener('touchcancel', release, { passive: false });
    });
  }

  showTouch(show) {
    if (this.touchWrap) this.touchWrap.classList.toggle('hidden', !show);
  }
}
