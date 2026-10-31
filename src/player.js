import * as THREE from '../vendor/three.module.js';

const EYE_STAND = 1.64;
const EYE_CROUCH = 0.98;
const RADIUS = 0.29;

export class Player {
  constructor(camera, input, audio, game) {
    this.camera = camera;
    this.input = input;
    this.audio = audio;
    this.game = game;

    this.position = new THREE.Vector3(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.y = 0;
    this.vy = 0;
    this.onGround = true;
    this.crouched = false;
    this.crouchAmt = 0;
    this.sprinting = false;
    this.moving = false;
    this.stamina = 100;
    this.staminaLock = false;
    this.staminaDelay = 0;
    this.health = 100;
    this.battery = 100;
    this.keys = 0;
    this.bandages = 1;
    this.flashlightOn = true;
    this.invuln = 0;
    this.hidden = false;
    this.hideSpot = null;
    this.hideReturn = null;
    this.hideLerp = 0;
    this.hideEye = EYE_STAND;
    this.stepDist = 0;
    this.bobTime = 0;
    this.bobAmount = 0;
    this.shake = 0;
    this.noise = 0;
    this.adrenaline = false;
    this.dead = false;
    this.speed = 0;

    this._buildFlashlight();
  }

  _buildFlashlight() {
    const light = new THREE.SpotLight(0xfff0c4, 42, 26, 0.46, 0.42, 1.15);
    light.position.set(0.16, -0.08, 0.02);
    light.castShadow = false;
    const target = new THREE.Object3D();
    target.position.set(0, -0.03, -1);
    this.camera.add(light);
    this.camera.add(target);
    light.target = target;
    this.flashlight = light;
    this.flashTarget = target;

    const group = new THREE.Group();
    group.position.set(0.3, -0.29, -0.56);
    group.rotation.set(-0.08, -0.08, 0.05);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x15130f, roughness: 0.45, metalness: 0.65 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0x8a6a35, roughness: 0.35, metalness: 0.8 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xfff3cf, emissive: 0xffe4a3, emissiveIntensity: 1.5, roughness: 0.2 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.24, 12), bodyMat);
    body.rotation.x = Math.PI / 2;
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.04, 0.1, 12), brassMat);
    head.rotation.x = Math.PI / 2;
    head.position.z = -0.15;
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.045, 16), glassMat);
    lens.position.z = -0.201;
    lens.rotation.y = Math.PI;
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.09, 0.05), bodyMat);
    grip.position.set(0, -0.07, 0.02);
    group.add(body, head, lens, grip);
    group.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
    this.camera.add(group);
    this.viewmodel = group;
    this.lensMat = glassMat;
  }

  resetForRoom(position, yaw = 0) {
    this.position.copy(position);
    this.y = 0; this.vy = 0; this.onGround = true;
    this.yaw = yaw; this.pitch = 0;
    this.crouched = false; this.crouchAmt = 0;
    this.stamina = 100; this.staminaLock = false; this.staminaDelay = 0;
    this.hidden = false; this.hideSpot = null; this.hideReturn = null; this.hideLerp = 0;
    this.hideEye = EYE_STAND;
    this.stepDist = 0; this.bobTime = 0; this.bobAmount = 0;
    this.shake = 0; this.invuln = 0;
    this.noise = 0;
    this.dead = false;
    this.speed = 0;
    this.audio.setHidden(false);
    this.flashlight.visible = this.flashlightOn;
    this.viewmodel.visible = true;
    this.lensMat.emissiveIntensity = this.flashlightOn ? 1.5 : 0.05;
  }

  setLook(dx, dy, sens, invert) {
    if (this.hidden) {
      this.yaw -= dx * sens * 0.0011;
      this.pitch -= (invert ? -dy : dy) * sens * 0.0011;
    } else {
      this.yaw -= dx * sens * 0.0011;
      this.pitch -= (invert ? -dy : dy) * sens * 0.0011;
    }
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
  }

  get eyeHeight() {
    if (this.hidden) return this.hideEye;
    return EYE_STAND + (EYE_CROUCH - EYE_STAND) * this.crouchAmt;
  }

  get headHeight() {
    return this.y + (this.crouched ? 1.08 : 1.78);
  }

  getForward(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  getLookDirection(out = new THREE.Vector3()) {
    const cp = Math.cos(this.pitch);
    return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp).normalize();
  }

  isLookingAt(worldPos, threshold = 0.9) {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const to = worldPos.clone().sub(this.camera.position).normalize();
    return dir.dot(to) >= threshold;
  }

  toggleFlashlight() {
    if (this.battery <= 0) {
      this.audio.flashlight(false);
      this.game.notify('The battery is dead.');
      return;
    }
    this.flashlightOn = !this.flashlightOn;
    this.flashlight.visible = this.flashlightOn && !this.hidden;
    this.lensMat.emissiveIntensity = this.flashlightOn ? 1.5 : 0.05;
    this.audio.flashlight();
    this.game.ui.setInventory(this.keys, this.bandages, this.flashlightOn);
  }

  useBandage() {
    if (this.bandages <= 0) { this.game.notify('No bandages left.'); return; }
    if (this.health >= 99.5) { this.game.notify('You are unhurt.'); return; }
    this.bandages--;
    this.heal(35);
    this.audio.bandage();
    this.game.ui.setInventory(this.keys, this.bandages, this.flashlightOn);
    this.game.notify('Bandage applied.');
  }

  heal(amount) {
    this.health = Math.min(100, this.health + amount);
    this.game.ui.setHealth(this.health);
  }

  damage(amount, cause = 'The hotel', opts = {}) {
    if (this.dead) return;
    if (this.invuln > 0 && !opts.ignoreInvuln) return;
    this.invuln = opts.invuln || 0.7;
    this.health -= amount;
    this.shake = Math.max(this.shake, 0.35 + amount / 80);
    this.game.ui.setHealth(this.health);
    this.game.ui.flashDamage(amount / 60);
    this.audio.hurt();
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      this.game.death(cause);
    }
  }

  enterHide(spot) {
    if (this.hidden) return;
    this.hideReturn = { position: this.position.clone(), yaw: this.yaw, pitch: this.pitch };
    this.hidden = true;
    this.hideSpot = spot;
    this.hideLerp = 0;
    this.hideEye = spot.eye;
    this.yaw = spot.yaw;
    this.pitch = 0;
    this.crouched = true;
    this.flashlightOn = false;
    this.flashlight.visible = false;
    this.lensMat.emissiveIntensity = 0.05;
    this.audio.setHidden(true);
    this.game.ui.setHidden(true);
    this.game.ui.setInventory(this.keys, this.bandages, this.flashlightOn);
    if (spot.onEnter) spot.onEnter();
    this.audio.doorCreak();
  }

  exitHide() {
    if (!this.hidden) return;
    const spot = this.hideSpot;
    this.hidden = false;
    this.hideSpot = null;
    this.crouched = false;
    this.position.copy(spot.stand);
    this.yaw = spot.exitYaw ?? spot.yaw;
    this.pitch = 0;
    this.flashlightOn = true;
    this.flashlight.visible = true;
    this.lensMat.emissiveIntensity = 1.5;
    this.audio.setHidden(false);
    this.game.ui.setHidden(false);
    this.audio.doorCreak();
    if (spot.onExit) spot.onExit();
    this.game.onUnhide();
  }

  update(dt, room) {
    const input = this.input;
    const settings = this.game.settings;
    const look = input.consumeLook();
    if (!this.hidden && !this.game.inputLocked) this.setLook(look.dx, look.dy, settings.sensitivity, settings.invert);
    else if (this.hidden) this.setLook(look.dx, look.dy, settings.sensitivity * 0.65, settings.invert);

    this.invuln = Math.max(0, this.invuln - dt);
    this.crouchAmt += ((this.crouched ? 1 : 0) - this.crouchAmt) * Math.min(1, dt * 11);
    this.shake = Math.max(0, this.shake - dt * 1.6);

    if (this.hidden) {
      this.moving = false;
      this.sprinting = false;
      this.noise = 0;
      this.speed = 0;
      this.updateCamera(dt, room);
      return;
    }

    if (this.game.inputLocked || this.game.mode !== 'playing') {
      this.moving = false; this.sprinting = false;
      this.updateCamera(dt, room);
      return;
    }

    // crouch toggle (hold or toggle with C? hold is canonical)
    const wantsCrouch = input.down('ControlLeft') || input.down('KeyC');
    if (wantsCrouch !== this.crouched) {
      if (wantsCrouch && !this.onGround) { /* allow */ }
      this.crouched = wantsCrouch;
    }

    let fwd = 0, strafe = 0;
    if (input.down('KeyW') || input.down('ArrowUp')) fwd += 1;
    if (input.down('KeyS') || input.down('ArrowDown')) fwd -= 1;
    if (input.down('KeyA') || input.down('ArrowLeft')) strafe -= 1;
    if (input.down('KeyD') || input.down('ArrowRight')) strafe += 1;
    if (input.touchActive) {
      fwd += -input.touchMove.y;
      strafe += input.touchMove.x;
    }
    const mag = Math.hypot(fwd, strafe);
    if (mag > 1) { fwd /= mag; strafe /= mag; }
    this.moving = mag > 0.06;

    const wantsSprint = (input.down('ShiftLeft') || input.down('ShiftRight')) && !this.crouched && this.moving && !this.staminaLock;
    this.sprinting = wantsSprint;

    if (this.sprinting) {
      const drain = this.adrenaline ? 6.5 : 20;
      this.stamina = Math.max(0, this.stamina - drain * dt);
      this.staminaDelay = 0.9;
      if (this.stamina <= 0) { this.staminaLock = true; this.sprinting = false; }
    } else {
      this.staminaDelay = Math.max(0, this.staminaDelay - dt);
      if (this.staminaDelay <= 0) this.stamina = Math.min(100, this.stamina + (this.adrenaline ? 26 : 15) * dt);
      if (this.staminaLock && this.stamina > 22) this.staminaLock = false;
    }

    let speed = this.crouched ? 1.5 : this.sprinting ? 5.55 : 3.1;
    if (room && room.type === 'seek') speed *= 1.08;
    this.speed = speed;

    if (this.moving) {
      const forward = this.getForward();
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      const dx = (forward.x * fwd + right.x * strafe) * speed * dt;
      const dz = (forward.z * fwd + right.z * strafe) * speed * dt;
      this.moveWithCollision(dx, dz, room);
    }

    // jump
    if (input.wasPressed('Space') && this.onGround && !this.crouched) {
      this.vy = 4.9;
      this.onGround = false;
      this.audio.footstep(false, true);
    }
    if (!this.onGround) {
      this.vy -= 13.5 * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) { this.y = 0; this.vy = 0; this.onGround = true; }
    }

    // bounds
    if (room && room.bounds) {
      const b = room.bounds;
      this.position.x = Math.max(b.x1 + RADIUS, Math.min(b.x2 - RADIUS, this.position.x));
      const maxZ = b.z2 - RADIUS;
      const minZ = room.exitOpen ? b.z1 - 3.2 : b.z1 + RADIUS;
      this.position.z = Math.max(minZ, Math.min(maxZ, this.position.z));
    }

    // footsteps
    if (this.moving && this.onGround) {
      this.stepDist += speed * dt;
      const stride = this.crouched ? 1.9 : this.sprinting ? 2.7 : 2.15;
      if (this.stepDist > stride) {
        this.stepDist = 0;
        this.audio.footstep(this.sprinting, this.crouched);
        if (this.game.onFootstep) this.game.onFootstep(this.sprinting, this.crouched);
      }
    } else {
      this.stepDist = 0;
    }

    this.noise = this.hidden ? 0 : this.crouched ? (this.moving ? 0.07 : 0) : this.sprinting ? 1 : this.moving ? 0.42 : 0;

    // flashlight battery
    if (this.flashlightOn) {
      this.battery = Math.max(0, this.battery - dt * 0.42);
      if (this.battery <= 0) {
        this.flashlightOn = false;
        this.flashlight.visible = false;
        this.lensMat.emissiveIntensity = 0.05;
        this.audio.flashlight();
        this.game.notify('Your flashlight dies.');
      } else if (this.battery < 18) {
        const flick = Math.random() > 0.06 ? 1 : 0.1;
        this.flashlight.intensity = 42 * flick * (0.5 + this.battery / 36);
        this.lensMat.emissiveIntensity = 1.5 * flick;
      } else {
        this.flashlight.intensity = 42;
        this.lensMat.emissiveIntensity = 1.5;
      }
    } else {
      this.flashlight.intensity = 0;
    }

    this.updateCamera(dt, room);
    this.game.ui.setStamina(this.stamina / 100);
    this.game.ui.setBattery(this.battery);
    this.game.ui.setInventory(this.keys, this.bandages, this.flashlightOn);
  }

  moveWithCollision(dx, dz, room) {
    if (!room) { this.position.x += dx; this.position.z += dz; return; }
    const colliders = room.colliders;
    const feet = this.y;
    const head = this.headHeight;
    const r = RADIUS;

    let nx = this.position.x + dx;
    for (const c of colliders) {
      if (c.disabled) continue;
      if (c.maxY !== undefined && c.maxY <= feet + 0.04) continue;
      if (c.minY !== undefined && c.minY >= head - 0.04) continue;
      if (nx + r > c.x1 && nx - r < c.x2 && this.position.z + r > c.z1 && this.position.z - r < c.z2) {
        if (dx > 0) nx = c.x1 - r;
        else if (dx < 0) nx = c.x2 + r;
      }
    }
    this.position.x = nx;

    let nz = this.position.z + dz;
    for (const c of colliders) {
      if (c.disabled) continue;
      if (c.maxY !== undefined && c.maxY <= feet + 0.04) continue;
      if (c.minY !== undefined && c.minY >= head - 0.04) continue;
      if (this.position.x + r > c.x1 && this.position.x - r < c.x2 && nz + r > c.z1 && nz - r < c.z2) {
        if (dz > 0) nz = c.z1 - r;
        else if (dz < 0) nz = c.z2 + r;
      }
    }
    this.position.z = nz;
  }

  updateCamera(dt, room) {
    const speedFactor = this.speed / 5.5;
    if (this.moving && !this.hidden) this.bobTime += dt * (this.sprinting ? 12 : 8);
    this.bobAmount += ((this.moving && this.onGround ? 1 : 0) - this.bobAmount) * Math.min(1, dt * 8);
    const bobY = Math.sin(this.bobTime * 2) * 0.023 * this.bobAmount * (this.sprinting ? 1.5 : 1);
    const bobX = Math.cos(this.bobTime) * 0.014 * this.bobAmount * (this.sprinting ? 1.4 : 1);

    let px, py, pz;
    if (this.hidden && this.hideSpot) {
      const target = this.hideSpot.camera;
      this.hideLerp = Math.min(1, this.hideLerp + dt * 5.5);
      const t = 1 - Math.pow(1 - this.hideLerp, 3);
      px = this.position.x + (target.x - this.position.x) * t;
      py = this.y + (target.y - this.y) * t;
      pz = this.position.z + (target.z - this.position.z) * t;
      py += Math.sin(performance.now() * 0.0012) * 0.004;
    } else {
      px = this.position.x + bobX;
      py = this.y + this.eyeHeight + bobY;
      pz = this.position.z;
    }

    let sx = 0, sy = 0;
    if (this.shake > 0 && this.game.settings.shake) {
      sx = (Math.random() - 0.5) * this.shake * 0.14;
      sy = (Math.random() - 0.5) * this.shake * 0.14;
    }
    this.camera.position.set(px + sx, py + sy, pz);
    this.camera.rotation.set(this.pitch, this.yaw, Math.sin(this.bobTime) * 0.004 * this.bobAmount, 'YXZ');

    const targetFov = this.sprinting ? 78 : 72;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 5);
    this.camera.updateProjectionMatrix();

    if (this.viewmodel) {
      this.viewmodel.position.y = -0.29 + bobY * 0.5;
      this.viewmodel.position.x = 0.3 + bobX * 0.4;
    }
  }
}
