import * as THREE from 'three'
import { BLOCKS } from './blocks.js'

const HALF = 0.3
const HEIGHT = 1.8
const EYE = 1.62
const EPS = 1e-4

export class Player {
  constructor(world, camera) {
    this.world = world
    this.camera = camera
    this.position = new THREE.Vector3(0, 40, 0)
    this.velocity = new THREE.Vector3()
    this.yaw = 0.8
    this.pitch = -0.08
    this.onGround = false
    this.flying = false
    this.inWater = false
    this.headInWater = false
    this.sprinting = false
    this.moving = false
    this.bobPhase = 0
    this.bobAmount = 0
    this.sensitivity = 1
    this.bobEnabled = true
    this.walked = 0
    this.stepDistance = 0
    this.landImpact = 0
    this.eye = new THREE.Vector3()
    this.look = new THREE.Vector3()
  }

  setPosition(x, y, z) {
    this.position.set(x, y, z)
    this.velocity.set(0, 0, 0)
  }

  toggleFly() {
    this.flying = !this.flying
    this.velocity.y = 0
    return this.flying
  }

  look2(dx, dy) {
    const s = 0.0022 * this.sensitivity
    this.yaw -= dx * s
    this.pitch -= dy * s
    const limit = Math.PI / 2 - 0.015
    if (this.pitch > limit) this.pitch = limit
    if (this.pitch < -limit) this.pitch = -limit
  }

  updateLookVector() {
    const cp = Math.cos(this.pitch)
    this.look.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp)
    return this.look
  }

  updateEye() {
    this.eye.set(this.position.x, this.position.y + EYE, this.position.z)
    return this.eye
  }

  solidAt(x, y, z) {
    const def = BLOCKS[this.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z))]
    return !!(def && def.solid)
  }

  collidesAt(px, py, pz) {
    const minX = Math.floor(px - HALF + EPS)
    const maxX = Math.floor(px + HALF - EPS)
    const minY = Math.floor(py + EPS)
    const maxY = Math.floor(py + HEIGHT - EPS)
    const minZ = Math.floor(pz - HALF + EPS)
    const maxZ = Math.floor(pz + HALF - EPS)
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let x = minX; x <= maxX; x++) {
          const def = BLOCKS[this.world.getBlock(x, y, z)]
          if (def && def.solid) return true
        }
      }
    }
    return false
  }

  moveAxis(axis, amount) {
    if (amount === 0) return false
    const p = this.position
    p[axis] += amount
    const minX = Math.floor(p.x - HALF + EPS)
    const maxX = Math.floor(p.x + HALF - EPS)
    const minY = Math.floor(p.y + EPS)
    const maxY = Math.floor(p.y + HEIGHT - EPS)
    const minZ = Math.floor(p.z - HALF + EPS)
    const maxZ = Math.floor(p.z + HALF - EPS)
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let x = minX; x <= maxX; x++) {
          const def = BLOCKS[this.world.getBlock(x, y, z)]
          if (!def || !def.solid) continue
          if (axis === 'x') {
            p.x = amount > 0 ? x - HALF - EPS : x + 1 + HALF + EPS
            this.velocity.x = 0
          } else if (axis === 'y') {
            if (amount < 0) {
              p.y = y + 1
              this.onGround = true
              if (this.velocity.y < -8) this.landImpact = Math.min(1, -this.velocity.y / 18)
            } else {
              p.y = y - HEIGHT - EPS
            }
            this.velocity.y = 0
          } else {
            p.z = amount > 0 ? z - HALF - EPS : z + 1 + HALF + EPS
            this.velocity.z = 0
          }
          return true
        }
      }
    }
    return false
  }

  moveWithCollision(dt) {
    const v = this.velocity
    const maxMove = Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)) * dt
    const steps = Math.max(1, Math.ceil(maxMove / 0.25))
    const sx = (v.x * dt) / steps
    const sy = (v.y * dt) / steps
    const sz = (v.z * dt) / steps
    for (let i = 0; i < steps; i++) {
      this.moveAxis('y', sy)
      this.moveAxis('x', sx)
      this.moveAxis('z', sz)
    }
  }

  update(dt, input) {
    const world = this.world
    const feet = world.getBlock(
      Math.floor(this.position.x),
      Math.floor(this.position.y + 0.3),
      Math.floor(this.position.z),
    )
    const head = world.getBlock(
      Math.floor(this.position.x),
      Math.floor(this.position.y + 1.55),
      Math.floor(this.position.z),
    )
    this.inWater = feet === 7 || head === 7
    this.headInWater = head === 7
    this.sprinting = !!input.sprint && !this.flying && input.forward > 0.25 && !this.inWater

    const sin = Math.sin(this.yaw)
    const cos = Math.cos(this.yaw)
    let wx = -sin * input.forward + cos * input.right
    let wz = -cos * input.forward - sin * input.right
    const wishLen = Math.hypot(wx, wz)
    if (wishLen > 1) {
      wx /= wishLen
      wz /= wishLen
    }
    this.moving = wishLen > 0.12

    let speed
    if (this.flying) speed = this.sprinting ? 24 : input.sprint ? 18 : 11
    else if (this.inWater) speed = 3.2
    else speed = this.sprinting ? 6.4 : 4.4

    const accel = this.flying ? 9 : this.onGround ? 14 : 4.6
    const blend = Math.min(1, accel * dt)
    this.velocity.x += (wx * speed - this.velocity.x) * blend
    this.velocity.z += (wz * speed - this.velocity.z) * blend

    if (this.flying) {
      let targetY = 0
      if (input.jump) targetY = 9.5
      else if (input.down) targetY = -9.5
      this.velocity.y += (targetY - this.velocity.y) * Math.min(1, 10 * dt)
    } else if (this.inWater) {
      this.velocity.y -= 7 * dt
      if (input.jump) this.velocity.y = 4.6
      this.velocity.y = Math.max(-3.5, Math.min(4.6, this.velocity.y))
    } else {
      this.velocity.y -= 27 * dt
      if (input.jump && this.onGround) {
        this.velocity.y = 8.7
        this.onGround = false
      }
      if (this.velocity.y < -32) this.velocity.y = -32
    }

    this.onGround = false
    this.moveWithCollision(dt)

    // balanço da câmera ao andar
    const speedH = Math.hypot(this.velocity.x, this.velocity.z)
    if (this.onGround && speedH > 0.6 && this.bobEnabled) {
      this.bobPhase += dt * speedH * 1.75
      this.bobAmount += (1 - this.bobAmount) * Math.min(1, 8 * dt)
    } else {
      this.bobAmount += (0 - this.bobAmount) * Math.min(1, 7 * dt)
    }
    if (this.bobAmount < 0.001) this.bobAmount = 0

    this.landImpact *= Math.max(0, 1 - dt * 7)
  }

  updateCamera() {
    const p = this.position
    const bobY = Math.sin(this.bobPhase * 2) * 0.045 * this.bobAmount
    const bobX = Math.cos(this.bobPhase) * 0.03 * this.bobAmount
    const rightX = Math.cos(this.yaw)
    const rightZ = -Math.sin(this.yaw)
    this.camera.position.set(p.x + rightX * bobX, p.y + EYE + bobY - this.landImpact * 0.12, p.z + rightZ * bobX)
    this.camera.rotation.order = 'YXZ'
    this.camera.rotation.set(this.pitch - this.landImpact * 0.06, this.yaw, 0)
  }

  raycast(maxDist = 6) {
    const origin = this.updateEye()
    const dir = this.updateLookVector()
    let x = Math.floor(origin.x)
    let y = Math.floor(origin.y)
    let z = Math.floor(origin.z)

    const stepX = dir.x > 0 ? 1 : -1
    const stepY = dir.y > 0 ? 1 : -1
    const stepZ = dir.z > 0 ? 1 : -1

    const tDeltaX = Math.abs(1 / (dir.x || 1e-9))
    const tDeltaY = Math.abs(1 / (dir.y || 1e-9))
    const tDeltaZ = Math.abs(1 / (dir.z || 1e-9))

    const boundary = (o, d, s) => (d > 0 ? Math.floor(o) + 1 - o : o - Math.floor(o))
    let tMaxX = boundary(origin.x, dir.x, stepX) * tDeltaX
    let tMaxY = boundary(origin.y, dir.y, stepY) * tDeltaY
    let tMaxZ = boundary(origin.z, dir.z, stepZ) * tDeltaZ
    if (dir.x === 0) tMaxX = Infinity
    if (dir.y === 0) tMaxY = Infinity
    if (dir.z === 0) tMaxZ = Infinity

    let nx = 0
    let ny = 0
    let nz = 0
    let t = 0
    for (let i = 0; i < 64; i++) {
      const id = this.world.getBlock(x, y, z)
      const def = BLOCKS[id]
      if (def && !def.liquid) {
        return { x, y, z, id, nx, ny, nz, dist: t }
      }
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX
        t = tMaxX
        tMaxX += tDeltaX
        nx = -stepX
        ny = 0
        nz = 0
      } else if (tMaxY < tMaxZ) {
        y += stepY
        t = tMaxY
        tMaxY += tDeltaY
        nx = 0
        ny = -stepY
        nz = 0
      } else {
        z += stepZ
        t = tMaxZ
        tMaxZ += tDeltaZ
        nx = 0
        ny = 0
        nz = -stepZ
      }
      if (t > maxDist) break
    }
    return null
  }

  eyeAboveGround() {
    const x = Math.floor(this.position.x)
    const z = Math.floor(this.position.z)
    const y = Math.floor(this.position.y + 0.01)
    return this.world.getBlock(x, y - 1, z)
  }
}
