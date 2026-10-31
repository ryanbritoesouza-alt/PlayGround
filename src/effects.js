import * as THREE from 'three';
import { clamp, TAU } from './noise.js';

/* ------------------------------------------------------------------ */
/*  GPU particle pool                                                  */
/* ------------------------------------------------------------------ */

const PARTICLE_VERT = /* glsl */`
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (330.0 / max(-mv.z, 0.1));
    gl_Position = projectionMatrix * mv;
  }
`;

const PARTICLE_FRAG = /* glsl */`
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p);
    if (d > 0.5) discard;
    float glow = smoothstep(0.5, 0.06, d);
    gl_FragColor = vec4(vColor, vAlpha * glow);
  }
`;

export class Particles {
  constructor(scene, capacity = 900) {
    this.capacity = capacity;
    this.positions = new Float32Array(capacity * 3);
    this.colors = new Float32Array(capacity * 3);
    this.sizes = new Float32Array(capacity);
    this.alphas = new Float32Array(capacity);
    this.vel = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.gravity = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.baseSize = new Float32Array(capacity);
    this.cursor = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1).setUsage(THREE.DynamicDrawUsage));
    const material = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    this.geo = geo;
    this.scene = scene;
  }

  spawn(x, y, z, {
    color = 0xffc86a, count = 1, speed = 2, size = 0.6, life = 0.8,
    gravity = 4, spread = 1, drag = 0.8, up = 1,
  } = {}) {
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      const idx = this.cursor;
      this.cursor = (this.cursor + 1) % this.capacity;
      const a = Math.random() * TAU;
      const b = Math.acos(Math.random() * 2 - 1);
      const sp = speed * (0.35 + Math.random() * 0.9);
      const pos = idx * 3;
      this.positions[pos] = x + (Math.random() - 0.5) * spread;
      this.positions[pos + 1] = y + (Math.random() - 0.5) * spread;
      this.positions[pos + 2] = z + (Math.random() - 0.5) * spread;
      this.vel[pos] = Math.sin(b) * Math.cos(a) * sp;
      this.vel[pos + 1] = Math.abs(Math.cos(b)) * sp * up + 0.4;
      this.vel[pos + 2] = Math.sin(b) * Math.sin(a) * sp;
      const tint = 0.8 + Math.random() * 0.4;
      this.colors[pos] = c.r * tint;
      this.colors[pos + 1] = c.g * tint;
      this.colors[pos + 2] = c.b * tint;
      this.baseSize[idx] = size * (0.55 + Math.random() * 0.9);
      this.sizes[idx] = this.baseSize[idx];
      this.alphas[idx] = 1;
      this.life[idx] = life * (0.65 + Math.random() * 0.7);
      this.maxLife[idx] = this.life[idx];
      this.gravity[idx] = gravity;
      this.drag[idx] = drag;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
  }

  update(dt) {
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) { this.alphas[i] = 0; continue; }
      this.life[i] -= dt;
      const p = i * 3;
      const d = Math.exp(-this.drag[i] * dt);
      this.vel[p] *= d;
      this.vel[p + 1] = this.vel[p + 1] * d - this.gravity[i] * dt;
      this.vel[p + 2] *= d;
      this.positions[p] += this.vel[p] * dt;
      this.positions[p + 1] += this.vel[p + 1] * dt;
      this.positions[p + 2] += this.vel[p + 2] * dt;
      const t = clamp(this.life[i] / this.maxLife[i], 0, 1);
      this.alphas[i] = Math.pow(t, 1.4);
      this.sizes[i] = this.baseSize[i] * (0.35 + t * 0.75);
      if (this.life[i] <= 0) this.alphas[i] = 0;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
  }
}

/* ------------------------------------------------------------------ */
/*  Floating combat text                                               */
/* ------------------------------------------------------------------ */

const TEMP = new THREE.Vector3();

export class FloatingText {
  constructor(container, camera) {
    this.container = container;
    this.camera = camera;
    this.items = [];
    this.width = window.innerWidth;
    this.height = window.innerHeight;
  }

  spawn(position, text, kind = 'damage', options = {}) {
    const el = document.createElement('div');
    el.className = `floaters ${kind}`;
    el.textContent = text;
    if (options.crit) el.classList.add('crit');
    this.container.appendChild(el);
    this.items.push({
      el,
      pos: position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.7, 2.5 + Math.random() * 0.6, (Math.random() - 0.5) * 0.7)),
      life: options.life || 1.05,
      max: options.life || 1.05,
      drift: (Math.random() - 0.5) * 34,
      scale: options.scale || 1,
    });
  }

  update(dt) {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.life -= dt;
      if (item.life <= 0) {
        item.el.remove();
        this.items.splice(i, 1);
        continue;
      }
      item.pos.y += dt * 1.6;
      TEMP.copy(item.pos).project(this.camera);
      const visible = TEMP.z < 1;
      const x = (TEMP.x * 0.5 + 0.5) * this.width + item.drift * (1 - item.life / item.max);
      const y = (-TEMP.y * 0.5 + 0.5) * this.height;
      const t = item.life / item.max;
      item.el.style.opacity = visible ? String(Math.min(1, t * 2.4)) : '0';
      const pop = 1 + Math.sin(Math.min(1, (1 - t) * 4) * Math.PI) * 0.28;
      item.el.style.transform = `translate(-50%,-50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${(pop * item.scale).toFixed(3)})`;
    }
  }

  clear() {
    this.items.forEach(i => i.el.remove());
    this.items.length = 0;
  }
}

/* ------------------------------------------------------------------ */
/*  World effects                                                      */
/* ------------------------------------------------------------------ */

export class Effects {
  constructor(scene, camera, particles, floating) {
    this.scene = scene;
    this.camera = camera;
    this.particles = particles;
    this.floating = floating;
    this.items = [];
    this.shake = 0;
    this.shakeTime = 0;
    this.flash = 0;
  }

  shakeCamera(amount) {
    this.shake = Math.max(this.shake, amount);
    this.shakeTime = 0;
  }

  screenFlash(amount) {
    this.flash = Math.max(this.flash, amount);
  }

  burst(pos, color = 0xffc86a, count = 18, options = {}) {
    this.particles.spawn(pos.x, pos.y, pos.z, { color, count, ...options });
  }

  ring(pos, color = 0xffa64a, radius = 2, duration = 0.55, thickness = 0.6) {
    const geo = new THREE.RingGeometry(Math.max(0.01, radius - thickness * radius), radius, 44, 1);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.95, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(pos);
    mesh.position.y += 0.08;
    mesh.renderOrder = 4;
    this.scene.add(mesh);
    this.items.push({ mesh, mat, life: duration, max: duration, kind: 'ring', radius });
  }

  slash(pos, yaw, color = 0x9ff6ff, scale = 1, flip = 1) {
    const geo = new THREE.RingGeometry(1.1 * scale, 3.0 * scale, 32, 1, 0, Math.PI * 0.95);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = yaw + (flip > 0 ? -1.9 : -1.2);
    mesh.position.copy(pos);
    mesh.position.y += 1.25;
    mesh.renderOrder = 4;
    this.scene.add(mesh);
    this.items.push({ mesh, mat, life: 0.24, max: 0.24, kind: 'slash' });
  }

  explosion(pos, {
    color = 0xff8a2a, radius = 4, duration = 0.7, ringColor = 0xffc46a, particleCount = 34,
  } = {}) {
    const geo = new THREE.SphereGeometry(1, 14, 10);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.scale.setScalar(0.4);
    this.scene.add(mesh);
    this.items.push({ mesh, mat, life: duration, max: duration, kind: 'explosion', radius });
    const core = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({
      color: 0xfff3c9, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    core.position.copy(pos);
    core.scale.setScalar(0.2);
    this.scene.add(core);
    this.items.push({ mesh: core, mat: core.material, life: duration * 0.55, max: duration * 0.55, kind: 'core' });
    this.ring(pos, ringColor, radius * 1.25, duration * 0.85, 1.2);
    this.particles.spawn(pos.x, pos.y, pos.z, {
      color, count: particleCount, speed: radius * 2.2, size: 1.2, life: 0.9, gravity: 1.5, spread: 0.7, drag: 1.4,
    });
    this.particles.spawn(pos.x, pos.y, pos.z, {
      color: 0xfff0b0, count: Math.floor(particleCount * 0.4), speed: radius * 1.1, size: 0.8, life: 0.5, gravity: 0.5, spread: 0.4, drag: 2,
    });
    this.shakeCamera(0.34);
    this.screenFlash(0.22);
  }

  pillars(pos, color = 0xff5a1a, count = 8, radius = 6) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU;
      const x = pos.x + Math.cos(a) * radius;
      const z = pos.z + Math.sin(a) * radius;
      const geo = new THREE.CylinderGeometry(0.4, 0.1, 1, 6, 1, true);
      const mat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.85, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, pos.y, z);
      mesh.scale.y = 0.1;
      this.scene.add(mesh);
      this.items.push({ mesh, mat, life: 0.65, max: 0.65, kind: 'pillar', burst: true });
      this.particles.spawn(x, pos.y + 0.4, z, { color, count: 8, speed: 5, size: 0.9, life: 0.6, gravity: -1.5, drag: 1.5 });
    }
  }

  heal(pos, color = 0x7dffb0) {
    this.particles.spawn(pos.x, pos.y, pos.z, { color, count: 24, speed: 2.4, size: 0.7, life: 1.2, gravity: -2.2, spread: 0.6, drag: 0.4 });
    this.ring(pos, color, 2.5, 0.8, 0.15);
  }

  telegraph(pos, radius, duration = 1.2, color = 0xff4018) {
    const geo = new THREE.RingGeometry(radius * 0.92, radius, 48, 1);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(pos);
    mesh.position.y += 0.12;
    this.scene.add(mesh);
    const fillMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
    const fill = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), fillMat);
    fill.rotation.x = -Math.PI / 2;
    fill.position.copy(mesh.position);
    fill.position.y += 0.01;
    this.scene.add(fill);
    const item = { mesh, mat, fill, fillMat, life: duration, max: duration, kind: 'telegraph' };
    this.items.push(item);
    return item;
  }

  update(dt, time) {
    this.shake = Math.max(0, this.shake - dt * 2.4);
    this.flash = Math.max(0, this.flash - dt * 3.6);
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life -= dt;
      const t = clamp(it.life / it.max, 0, 1);
      const p = 1 - t;
      if (it.life <= 0) {
        if (it.fill) { this.scene.remove(it.fill); it.fill.geometry.dispose(); it.fillMat.dispose(); }
        this.scene.remove(it.mesh);
        it.mesh.geometry.dispose();
        it.mat.dispose();
        this.items.splice(i, 1);
        continue;
      }
      if (it.kind === 'explosion') {
        it.mesh.scale.setScalar(0.4 + p * it.radius * 1.35);
        it.mat.opacity = Math.pow(t, 0.7) * 0.85;
      } else if (it.kind === 'core') {
        it.mesh.scale.setScalar(0.2 + p * 2.1);
        it.mat.opacity = t;
      } else if (it.kind === 'ring') {
        it.mesh.scale.setScalar(0.25 + p * 1.3);
        it.mat.opacity = Math.pow(t, 1.2) * 0.95;
      } else if (it.kind === 'slash') {
        it.mesh.scale.setScalar(1 + p * 0.6);
        it.mat.opacity = Math.sin(t * Math.PI) * 0.9;
      } else if (it.kind === 'pillar') {
        it.mesh.scale.y = 0.1 + p * 7;
        it.mesh.position.y += dt * 1.2;
        it.mat.opacity = t * 0.8;
      } else if (it.kind === 'telegraph') {
        it.mat.opacity = 0.35 + Math.sin(time * 18) * 0.2 + p * 0.35;
        it.fillMat.opacity = 0.05 + p * 0.2;
        it.mesh.scale.setScalar(1 + Math.sin(time * 8) * 0.015);
      }
    }
    this.particles.update(dt);
    this.floating.update(dt);
  }

  ambient(time, dt, playerPos, biome) {
    // Cheap atmosphere: leaves around the home island, embers on the volcano.
    if (Math.random() > dt * 13) return;
    if (biome === 'ember') {
      this.particles.spawn(playerPos.x + (Math.random() - 0.5) * 45, playerPos.y + 4 + Math.random() * 10, playerPos.z + (Math.random() - 0.5) * 45, {
        color: Math.random() > 0.5 ? 0xff5a1a : 0xffb020, count: 1, speed: 0.5, size: 0.28, life: 3, gravity: -0.25, spread: 2, drag: 0.1,
      });
    } else if (biome === 'home') {
      this.particles.spawn(playerPos.x + (Math.random() - 0.5) * 36, playerPos.y + 2 + Math.random() * 5, playerPos.z + (Math.random() - 0.5) * 36, {
        color: Math.random() > 0.5 ? 0xb9e26a : 0x7fcf5a, count: 1, speed: 0.4, size: 0.22, life: 4, gravity: -0.05, spread: 2, drag: 0.02,
      });
    }
  }
}
