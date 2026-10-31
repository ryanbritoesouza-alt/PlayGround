import * as THREE from 'three'

const MAX_PARTICLES = 260

export class Particles {
  constructor(scene) {
    const geom = new THREE.BoxGeometry(1, 1, 1)
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true })
    this.mesh = new THREE.InstancedMesh(geom, mat, MAX_PARTICLES)
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.frustumCulled = false
    this.mesh.count = 0
    this.mesh.renderOrder = 4
    scene.add(this.mesh)
    this.items = []
    this.dummy = new THREE.Object3D()
    this.color = new THREE.Color()
    this.colors = new Float32Array(MAX_PARTICLES * 3)
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(this.colors, 3)
  }

  burst(x, y, z, colorHex, count = 14, power = 3.4) {
    const base = new THREE.Color(colorHex)
    for (let i = 0; i < count; i++) {
      if (this.items.length >= MAX_PARTICLES) this.items.shift()
      const shade = 0.75 + Math.random() * 0.4
      this.items.push({
        x: x + (Math.random() - 0.5) * 0.7,
        y: y + (Math.random() - 0.5) * 0.7,
        z: z + (Math.random() - 0.5) * 0.7,
        vx: (Math.random() - 0.5) * power,
        vy: 1 + Math.random() * power,
        vz: (Math.random() - 0.5) * power,
        life: 0.5 + Math.random() * 0.55,
        maxLife: 1,
        size: 0.07 + Math.random() * 0.1,
        r: base.r * shade,
        g: base.g * shade,
        b: base.b * shade,
      })
      this.items[this.items.length - 1].maxLife = this.items[this.items.length - 1].life
    }
    this.writeColors()
  }

  writeColors() {
    for (let i = 0; i < this.items.length; i++) {
      const p = this.items[i]
      const fade = Math.max(0.35, p.life / p.maxLife)
      this.colors[i * 3] = p.r * fade
      this.colors[i * 3 + 1] = p.g * fade
      this.colors[i * 3 + 2] = p.b * fade
    }
    this.mesh.instanceColor.needsUpdate = true
  }

  update(dt) {
    if (!this.items.length) {
      this.mesh.count = 0
      return
    }
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i]
      p.life -= dt
      if (p.life <= 0) {
        this.items.splice(i, 1)
        continue
      }
      p.vy -= 17 * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt
      const scale = p.size * Math.max(0.15, p.life / p.maxLife)
      const idx = i
      this.dummy.position.set(p.x, p.y, p.z)
      this.dummy.rotation.set(p.x * 3.1, p.y * 4.2, p.z * 2.7)
      this.dummy.scale.setScalar(scale)
      this.dummy.updateMatrix()
      this.mesh.setMatrixAt(idx, this.dummy.matrix)
    }
    this.mesh.count = this.items.length
    this.mesh.instanceMatrix.needsUpdate = true
    this.writeColors()
  }
}

export class Clouds {
  constructor(scene, count = 64) {
    const geom = new THREE.BoxGeometry(1, 1, 1)
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      fog: false,
    })
    this.mesh = new THREE.InstancedMesh(geom, mat, count)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = -1
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    scene.add(this.mesh)
    this.material = mat
    this.items = []
    const dummy = new THREE.Object3D()
    for (let i = 0; i < count; i++) {
      const item = {
        x: (Math.random() - 0.5) * 460,
        y: 76 + Math.random() * 12,
        z: (Math.random() - 0.5) * 460,
        sx: 7 + Math.random() * 18,
        sy: 2.2 + Math.random() * 2.6,
        sz: 6 + Math.random() * 14,
      }
      this.items.push(item)
      dummy.position.set(item.x, item.y, item.z)
      dummy.scale.set(item.sx, item.sy, item.sz)
      dummy.updateMatrix()
      this.mesh.setMatrixAt(i, dummy.matrix)
    }
    this.mesh.instanceMatrix.needsUpdate = true
    this.dummy = dummy
  }

  update(dt, playerPos) {
    const dummy = this.dummy
    for (let i = 0; i < this.items.length; i++) {
      const c = this.items[i]
      c.x += dt * 1.6
      if (c.x - playerPos.x > 260) c.x -= 520
      if (c.x - playerPos.x < -260) c.x += 520
      if (c.z - playerPos.z > 260) c.z -= 520
      if (c.z - playerPos.z < -260) c.z += 520
      dummy.position.set(c.x, c.y, c.z)
      dummy.scale.set(c.sx, c.sy, c.sz)
      dummy.updateMatrix()
      this.mesh.setMatrixAt(i, dummy.matrix)
    }
    this.mesh.instanceMatrix.needsUpdate = true
  }

  setTint(color) {
    this.material.color.copy(color)
  }
}
