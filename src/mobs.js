import * as THREE from 'three'
import { SEA_LEVEL } from './worldgen.js'

const PINK = 0xf0a6b7
const PINK_DARK = 0xdb8ea2
const SNOUT = 0xe295a9
const HOOF = 0x6b4a4a

function box(w, h, d, color) {
  return new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  )
}

function makePig() {
  const group = new THREE.Group()
  const body = box(0.92, 0.72, 1.3, PINK)
  body.position.set(0, 0.88, 0)
  group.add(body)

  const head = box(0.68, 0.66, 0.62, PINK)
  head.position.set(0, 1.0, -0.92)
  group.add(head)

  const snout = box(0.36, 0.24, 0.14, SNOUT)
  snout.position.set(0, 0.9, -1.27)
  group.add(snout)

  for (const sx of [-1, 1]) {
    const ear = box(0.16, 0.18, 0.1, PINK_DARK)
    ear.position.set(sx * 0.22, 1.4, -0.88)
    ear.rotation.z = sx * 0.25
    group.add(ear)
    const eye = box(0.07, 0.09, 0.05, 0x2b1d20)
    eye.position.set(sx * 0.21, 1.08, -1.24)
    group.add(eye)
  }

  const legs = []
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const pivot = new THREE.Group()
      pivot.position.set(sx * 0.29, 0.56, sz * 0.42)
      const leg = box(0.22, 0.54, 0.22, PINK_DARK)
      leg.position.set(0, -0.27, 0)
      pivot.add(leg)
      const hoof = box(0.23, 0.1, 0.23, HOOF)
      hoof.position.set(0, -0.56, 0)
      pivot.add(hoof)
      group.add(pivot)
      legs.push(pivot)
    }
  }

  const tail = box(0.08, 0.08, 0.2, PINK_DARK)
  tail.position.set(0, 1.06, 0.7)
  tail.rotation.x = 0.5
  group.add(tail)

  return { group, legs, tail }
}

export class Mobs {
  constructor({ scene, world, audio }) {
    this.scene = scene
    this.world = world
    this.audio = audio
    this.pigs = []
    this.spawnTimer = 8
    this.target = 10
  }

  clear() {
    for (const pig of this.pigs) {
      this.scene.remove(pig.group)
      pig.group.traverse((o) => {
        if (o.isMesh) {
          o.geometry.dispose()
          o.material.dispose()
        }
      })
    }
    this.pigs.length = 0
  }

  findPatch(cx, cz, radius) {
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2
      const dist = 6 + Math.random() * radius
      const x = Math.floor(cx + Math.cos(angle) * dist)
      const z = Math.floor(cz + Math.sin(angle) * dist)
      const top = this.world.surfaceY(x, z)
      if (top < SEA_LEVEL + 1 || top > 44) continue
      const ground = this.world.getBlock(x, top, z)
      if (ground !== 1 && ground !== 11) continue
      const above = this.world.getBlock(x, top + 1, z)
      if (above !== 0 && above !== 13 && above !== 14) continue
      return { x: x + 0.5, y: top + 1, z: z + 0.5 }
    }
    return null
  }

  spawnAt(x, y, z, initial = false) {
    const pig = makePig()
    pig.group.position.set(x, y, z)
    this.scene.add(pig.group)
    const state = {
      ...pig,
      state: {
        x,
        z,
        y,
        dirX: Math.random() * 2 - 1,
        dirZ: Math.random() * 2 - 1,
        timer: Math.random() * 3,
        speed: 0.7 + Math.random() * 0.7,
        phase: Math.random() * Math.PI * 2,
        moving: false,
        panic: 0,
        hits: 0,
        idle: initial ? Math.random() < 0.5 : false,
      },
    }
    const len = Math.hypot(state.state.dirX, state.state.dirZ) || 1
    state.state.dirX /= len
    state.state.dirZ /= len
    this.pigs.push(state)
    return state
  }

  populate(playerPos, radius = 26) {
    this.clear()
    let attempts = 0
    while (this.pigs.length < this.target && attempts < 160) {
      attempts++
      const patch = this.findPatch(playerPos.x, playerPos.z, radius)
      if (!patch) continue
      let tooClose = false
      for (const p of this.pigs) {
        if (Math.hypot(p.state.x - patch.x, p.state.z - patch.z) < 2.4) tooClose = true
      }
      if (tooClose) continue
      this.spawnAt(patch.x, patch.y, patch.z, true)
    }
  }

  update(dt, playerPos) {
    const px = playerPos.x
    const pz = playerPos.z

    for (let i = this.pigs.length - 1; i >= 0; i--) {
      const pig = this.pigs[i]
      const s = pig.state

      if (s.panic > 0) s.panic -= dt
      s.timer -= dt

      if (s.timer <= 0) {
        s.timer = 2 + Math.random() * 5
        if (Math.random() < 0.35) {
          s.moving = false
        } else {
          s.moving = true
          const angle = Math.random() * Math.PI * 2
          s.dirX = Math.cos(angle)
          s.dirZ = Math.sin(angle)
          s.speed = (s.panic > 0 ? 2.7 : 0.65) + Math.random() * 0.6
        }
      }

      if (s.panic > 0) {
        s.moving = true
        const dx = s.x - px
        const dz = s.z - pz
        const len = Math.hypot(dx, dz) || 1
        s.dirX = dx / len
        s.dirZ = dz / len
        s.speed = 2.9
      }

      let nx = s.x
      let nz = s.z
      if (s.moving) {
        nx += s.dirX * s.speed * dt
        nz += s.dirZ * s.speed * dt
      }

      const top = this.world.surfaceY(Math.floor(nx), Math.floor(nz))
      const topNow = this.world.surfaceY(Math.floor(s.x), Math.floor(s.z))
      const groundBlock = this.world.getBlock(Math.floor(nx), top, Math.floor(nz))

      if (top < 0) {
        s.moving = false
        s.timer = Math.min(s.timer, 0.5)
        continue
      }

      const blocked =
        top < SEA_LEVEL ||
        groundBlock === 7 ||
        (topNow >= 0 && top - topNow > 1) ||
        (topNow >= 0 && topNow - top > 2)

      if (blocked && s.moving) {
        s.dirX = -s.dirX
        s.dirZ = -s.dirZ
        s.timer = Math.min(s.timer, 0.6)
        nx = s.x
        nz = s.z
      } else {
        s.x = nx
        s.z = nz
      }

      const targetY = top + 1
      s.y += (targetY - s.y) * Math.min(1, dt * 9)
      if (Math.abs(targetY - s.y) < 0.05) s.y = targetY

      pig.group.position.set(s.x, s.y, s.z)
      const targetRot = Math.atan2(-s.dirX, -s.dirZ)
      let diff = targetRot - pig.group.rotation.y
      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2
      pig.group.rotation.y += diff * Math.min(1, dt * 6)

      if (s.moving) s.phase += dt * s.speed * 7.5
      const swing = s.moving ? Math.sin(s.phase) * 0.55 : 0
      pig.legs[0].rotation.x = swing
      pig.legs[1].rotation.x = -swing
      pig.legs[2].rotation.x = -swing
      pig.legs[3].rotation.x = swing
      pig.group.position.y += s.moving ? Math.abs(Math.sin(s.phase)) * 0.015 : 0
      pig.tail.rotation.y = Math.sin(s.phase * 0.7) * 0.5
    }

    this.spawnTimer -= dt
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 16 + Math.random() * 10
      if (this.pigs.length < this.target) {
        const patch = this.findPatch(px, pz, 30)
        if (patch) this.spawnAt(patch.x, patch.y, patch.z)
      }
    }
  }

  hitTest(origin, dir, maxDist = 6) {
    let best = null
    for (const pig of this.pigs) {
      const cx = pig.state.x
      const cy = pig.state.y + 0.9
      const cz = pig.state.z
      const ox = cx - origin.x
      const oy = cy - origin.y
      const oz = cz - origin.z
      const tca = ox * dir.x + oy * dir.y + oz * dir.z
      if (tca < 0 || tca > maxDist) continue
      const d2 = ox * ox + oy * oy + oz * oz - tca * tca
      const r = 0.85
      if (d2 > r * r) continue
      const t = tca - Math.sqrt(Math.max(0, r * r - d2))
      if (!best || t < best.dist) best = { pig, dist: t }
    }
    return best
  }

  hit(pig, playerPos) {
    pig.state.hits++
    pig.state.panic = 4.5
    const dx = pig.state.x - playerPos.x
    const dz = pig.state.z - playerPos.z
    const len = Math.hypot(dx, dz) || 1
    pig.state.dirX = dx / len
    pig.state.dirZ = dz / len
    this.audio?.play('oink')
    if (pig.state.hits >= 3) {
      this.scene.remove(pig.group)
      pig.group.traverse((o) => {
        if (o.isMesh) {
          o.geometry.dispose()
          o.material.dispose()
        }
      })
      this.pigs.splice(this.pigs.indexOf(pig), 1)
      return true
    }
    return false
  }

  dispose() {
    this.clear()
  }
}
