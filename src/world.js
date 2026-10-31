import * as THREE from 'three'
import {
  generateChunk,
  columnInfo,
  biomeName,
  CHUNK_SIZE,
  WORLD_HEIGHT,
  SEA_LEVEL,
} from './worldgen.js'
import { BLOCKS, isOpaque, uvFor } from './blocks.js'

const CHUNK_VOLUME = CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT
const CHUNK_KEY = (cx, cz) => cx + ',' + cz

/* Faces do cubo, em ordem anti-horária vista de fora. */
const FACES = [
  { name: 'px', n: [1, 0, 0], shade: 0.78, corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
  { name: 'nx', n: [-1, 0, 0], shade: 0.78, corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { name: 'py', n: [0, 1, 0], shade: 1.0, corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { name: 'ny', n: [0, -1, 0], shade: 0.55, corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { name: 'pz', n: [0, 0, 1], shade: 0.88, corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { name: 'nz', n: [0, 0, -1], shade: 0.88, corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
]

const UVS = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
]

export class World {
  constructor({ scene, seed, materials, edits }) {
    this.scene = scene
    this.seed = seed
    this.materials = materials
    this.group = new THREE.Group()
    this.group.name = 'mundo'
    scene.add(this.group)
    this.chunks = new Map()
    this.edits = new Map()
    this.chunkEdits = new Map()
    this.wanted = []
    this.lastView = ''
    this.lastRadius = -1
    this.stats = { chunks: 0, faces: 0 }

    if (edits && edits.length) {
      for (const e of edits) this.addEdit(e[0], e[1], e[2], e[3])
    }
  }

  /* --------------------------- edições --------------------------- */

  addEdit(x, y, z, id) {
    const key = x + ',' + y + ',' + z
    this.edits.set(key, id)
    const ck = CHUNK_KEY(Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE))
    let list = this.chunkEdits.get(ck)
    if (!list) {
      list = []
      this.chunkEdits.set(ck, list)
    }
    list.push([x, y, z, id])
  }

  getEditsArray() {
    const out = []
    for (const [key, id] of this.edits) {
      const [x, y, z] = key.split(',').map(Number)
      out.push([x, y, z, id])
    }
    return out
  }

  /* --------------------------- chunks --------------------------- */

  ensureChunk(cx, cz) {
    const key = CHUNK_KEY(cx, cz)
    let chunk = this.chunks.get(key)
    if (!chunk) {
      chunk = {
        cx,
        cz,
        key,
        blocks: new Uint8Array(CHUNK_VOLUME),
        generated: false,
        needsMesh: true,
        meshes: [],
      }
      this.chunks.set(key, chunk)
    }
    return chunk
  }

  ensureGenerated(chunk) {
    if (chunk.generated) return
    const edits = this.chunkEdits.get(chunk.key)
    generateChunk(chunk, this.seed, edits || null)
    chunk.generated = true
    chunk.needsMesh = true
  }

  getBlock(x, y, z) {
    if (y < 0) return 3
    if (y >= WORLD_HEIGHT) return 0
    const cx = x >> 4
    const cz = z >> 4
    const chunk = this.chunks.get(CHUNK_KEY(cx, cz))
    if (!chunk || !chunk.generated) return 0
    return chunk.blocks[(x & 15) + 16 * (z & 15) + 256 * y]
  }

  setBlock(x, y, z, id, record = true) {
    if (y < 0 || y >= WORLD_HEIGHT) return false
    const cx = x >> 4
    const cz = z >> 4
    const chunk = this.chunks.get(CHUNK_KEY(cx, cz))
    if (!chunk || !chunk.generated) return false
    const lx = x & 15
    const lz = z & 15
    chunk.blocks[lx + 16 * lz + 256 * y] = id
    chunk.needsMesh = true
    if (lx === 0) this.markDirty(cx - 1, cz)
    if (lx === 15) this.markDirty(cx + 1, cz)
    if (lz === 0) this.markDirty(cx, cz - 1)
    if (lz === 15) this.markDirty(cx, cz + 1)
    if (record) this.addEdit(x, y, z, id)
    return true
  }

  markDirty(cx, cz) {
    const chunk = this.chunks.get(CHUNK_KEY(cx, cz))
    if (chunk && chunk.generated) chunk.needsMesh = true
  }

  /* --------------------------- malha --------------------------- */

  buildChunk(chunk) {
    const { blocks, cx, cz } = chunk
    const baseX = cx * CHUNK_SIZE
    const baseZ = cz * CHUNK_SIZE
    const chunks = this.chunks

    const at = (lx, ly, lz) => {
      if (ly < 0 || ly >= WORLD_HEIGHT) return 0
      if (lx >= 0 && lx < 16 && lz >= 0 && lz < 16) {
        return blocks[lx + 16 * lz + 256 * ly]
      }
      const wx = baseX + lx
      const wz = baseZ + lz
      const nb = chunks.get(CHUNK_KEY(wx >> 4, wz >> 4))
      if (!nb || !nb.generated) return 0
      return nb.blocks[(wx & 15) + 16 * (wz & 15) + 256 * ly]
    }

    const opaqueAt = (lx, ly, lz) => isOpaque(at(lx, ly, lz))

    const solid = { pos: [], uv: [], col: [], idx: [] }
    const cross = { pos: [], uv: [], col: [], idx: [] }
    const glass = { pos: [], uv: [], col: [], idx: [] }
    const water = { pos: [], uv: [], col: [], idx: [] }
    let faceCount = 0
    const uvCache = new Map()

    const uv = (tileName) => {
      let rect = uvCache.get(tileName)
      if (!rect) {
        rect = uvFor(tileName)
        uvCache.set(tileName, rect)
      }
      return rect
    }

    const ao = (lx, ly, lz, n, corner) => {
      const t0 = [
        n[0] !== 0 ? 0 : corner[0] * 2 - 1,
        n[1] !== 0 ? 0 : corner[1] * 2 - 1,
        n[2] !== 0 ? 0 : corner[2] * 2 - 1,
      ]
      const axes = []
      if (t0[0] !== 0) axes.push(0)
      if (t0[1] !== 0) axes.push(1)
      if (t0[2] !== 0) axes.push(2)
      const s1 = [0, 0, 0]
      const s2 = [0, 0, 0]
      if (axes[0] !== undefined) s1[axes[0]] = t0[axes[0]]
      if (axes[1] !== undefined) s2[axes[1]] = t0[axes[1]]
      const p = [lx + n[0], ly + n[1], lz + n[2]]
      const a = opaqueAt(p[0] + s1[0], p[1] + s1[1], p[2] + s1[2])
      const b = opaqueAt(p[0] + s2[0], p[1] + s2[1], p[2] + s2[2])
      const c = opaqueAt(p[0] + s1[0] + s2[0], p[1] + s1[1] + s2[1], p[2] + s1[2] + s2[2])
      if (a && b) return 0.52
      return 1 - 0.17 * ((a ? 1 : 0) + (b ? 1 : 0) + (c ? 1 : 0))
    }

    const pushFace = (target, x, y, z, face, tileName, colorScale, waterUV) => {
      const start = target.pos.length / 3
      const u = uv(tileName)
      for (let i = 0; i < 4; i++) {
        const corner = face.corners[i]
        target.pos.push(x + corner[0], y + corner[1], z + corner[2])
        if (waterUV) target.uv.push(UVS[i][0], UVS[i][1])
        else target.uv.push(i === 0 || i === 3 ? u.u0 : u.u1, i < 2 ? u.v0 : u.v1)
        const light = colorScale * face.shade * ao(x, y, z, face.n, corner)
        target.col.push(light, light, light)
      }
      target.idx.push(start, start + 1, start + 2, start, start + 2, start + 3)
      faceCount++
    }

    for (let ly = 0; ly < WORLD_HEIGHT; ly++) {
      for (let lz = 0; lz < 16; lz++) {
        for (let lx = 0; lx < 16; lx++) {
          const id = blocks[lx + 16 * lz + 256 * ly]
          if (id === 0) continue
          const def = BLOCKS[id]
          if (!def) continue

          if (def.cross) {
            const x = baseX + lx
            const z = baseZ + lz
            const topY = ly + (id === 13 ? 0.92 : 0.82)
            const u = uv(def.side)
            const shade = 0.82 + 0.18 * ((lx * 13 + lz * 7 + ly) % 5) / 4
            const quads = [
              [
                [x + 0.08, ly, z + 0.08],
                [x + 0.92, ly, z + 0.92],
                [x + 0.92, topY, z + 0.92],
                [x + 0.08, topY, z + 0.08],
              ],
              [
                [x + 0.08, ly, z + 0.92],
                [x + 0.92, ly, z + 0.08],
                [x + 0.92, topY, z + 0.08],
                [x + 0.08, topY, z + 0.92],
              ],
            ]
            for (const quad of quads) {
              const start = cross.pos.length / 3
              for (let i = 0; i < 4; i++) {
                cross.pos.push(quad[i][0], quad[i][1], quad[i][2])
                cross.uv.push(i === 0 || i === 3 ? u.u0 : u.u1, i < 2 ? u.v0 : u.v1)
                cross.col.push(shade, shade, shade)
              }
              cross.idx.push(start, start + 1, start + 2, start, start + 2, start + 3)
              faceCount++
            }
            continue
          }

          const isWater = id === 7
          const target = isWater ? water : id === 9 ? glass : solid

          for (const face of FACES) {
            const n = face.n
            const nx = lx + n[0]
            const ny = ly + n[1]
            const nz = lz + n[2]
            const neighbor = at(nx, ny, nz)
            if (isWater) {
              if (neighbor === 7 || isOpaque(neighbor)) continue
            } else if (id === 9) {
              if (isOpaque(neighbor) || neighbor === 9) continue
            } else if (id === 6) {
              if (isOpaque(neighbor) || neighbor === 6) continue
            } else {
              if (isOpaque(neighbor)) continue
            }

            const tileName = face.name === 'py' ? def.top : face.name === 'ny' ? def.bottom : def.side
            pushFace(target, baseX + lx, ly, baseZ + lz, face, tileName, 1, isWater)
          }
        }
      }
    }

    // limpa malhas antigas
    this.clearMeshes(chunk)

    const addMesh = (data, material, order = 0) => {
      if (!data.idx.length) return
      const geom = new THREE.BufferGeometry()
      geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(data.pos), 3))
      geom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(data.uv), 2))
      geom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(data.col), 3))
      geom.setIndex(new THREE.BufferAttribute(new Uint32Array(data.idx), 1))
      geom.computeBoundingSphere()
      const mesh = new THREE.Mesh(geom, material)
      mesh.renderOrder = order
      mesh.matrixAutoUpdate = false
      mesh.updateMatrix()
      this.group.add(mesh)
      chunk.meshes.push(mesh)
    }

    addMesh(solid, this.materials.solid)
    addMesh(cross, this.materials.cross)
    addMesh(glass, this.materials.glass, 2)
    addMesh(water, this.materials.water, 1)

    chunk.needsMesh = false
  }

  clearMeshes(chunk) {
    for (const mesh of chunk.meshes) {
      this.group.remove(mesh)
      mesh.geometry.dispose()
    }
    chunk.meshes.length = 0
  }

  /* ------------------------- fluxo/streaming ------------------------- */

  update(playerPos, radius, budgetMs = 6) {
    const pcx = Math.floor(playerPos.x / CHUNK_SIZE)
    const pcz = Math.floor(playerPos.z / CHUNK_SIZE)
    const viewKey = pcx + ',' + pcz + ',' + radius
    if (viewKey !== this.lastView) {
      this.rebuildWanted(pcx, pcz, radius)
      this.lastView = viewKey
      this.lastRadius = radius
    }

    const start = performance.now()
    let generated = 0
    let meshed = 0

    for (const chunk of this.wanted) {
      if (!chunk.generated) {
        this.ensureGenerated(chunk)
        generated++
        if (performance.now() - start > budgetMs * 0.6) break
      }
    }

    for (const chunk of this.wanted) {
      if (chunk.generated && chunk.needsMesh) {
        this.buildChunk(chunk)
        meshed++
        if (performance.now() - start > budgetMs) break
      }
    }

    this.unloadFar(pcx, pcz, radius + 1)
    this.stats.chunks = this.wanted.length
    return { generated, meshed }
  }

  rebuildWanted(pcx, pcz, radius) {
    const wanted = []
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const chunk = this.ensureChunk(pcx + dx, pcz + dz)
        chunk.distance = dx * dx + dz * dz
        wanted.push(chunk)
      }
    }
    wanted.sort((a, b) => a.distance - b.distance)
    this.wanted = wanted
  }

  unloadFar(pcx, pcz, maxRadius) {
    for (const chunk of this.chunks.values()) {
      if (chunk.meshes.length === 0) continue
      const dx = chunk.cx - pcx
      const dz = chunk.cz - pcz
      if (Math.abs(dx) > maxRadius || Math.abs(dz) > maxRadius) {
        this.clearMeshes(chunk)
        chunk.needsMesh = true
      }
    }
  }

  isReady() {
    if (!this.wanted.length) return { ready: false, total: 0, built: 0 }
    let built = 0
    for (const chunk of this.wanted) {
      if (chunk.generated && !chunk.needsMesh) built++
    }
    return { ready: built === this.wanted.length, total: this.wanted.length, built }
  }

  /* dado um raio de carregamento, produz o total esperado */
  prime(playerPos, radius) {
    const pcx = Math.floor(playerPos.x / CHUNK_SIZE)
    const pcz = Math.floor(playerPos.z / CHUNK_SIZE)
    this.rebuildWanted(pcx, pcz, radius)
    this.lastView = pcx + ',' + pcz + ',' + radius
    this.lastRadius = radius
  }

  /* --------------------------- consultas --------------------------- */

  surfaceY = (x, z) => {
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
      const id = this.getBlock(x, y, z)
      if (id !== 0 && !BLOCKS[id]?.liquid) return y
    }
    return -1
  }

  isSolidAt(x, y, z) {
    const id = this.getBlock(Math.floor(x), Math.floor(y), Math.floor(z))
    const def = BLOCKS[id]
    return !!(def && def.solid)
  }

  infoAt(x, z) {
    return columnInfo(Math.floor(x), Math.floor(z), this.seed)
  }

  biomeAt(x, z) {
    return biomeName(this.infoAt(x, z).biome)
  }

  sleepingAt(x, y, z) {
    const id = this.getBlock(x, y, z)
    return id === 7
  }

  findSpawn(seed) {
    const weights = { planicie: 30, praia: 26, floresta: 10 }
    let best = null
    let bestScore = 0
    for (let x = -144; x <= 144; x += 12) {
      for (let z = -144; z <= 144; z += 12) {
        const info = columnInfo(x, z, seed)
        if (info.height <= SEA_LEVEL || info.height >= 40 || info.river) continue
        let s = weights[info.biome] || 0
        if (!s) continue
        s -= Math.hypot(x, z) / 24
        if (s > bestScore) {
          bestScore = s
          best = { x: x + 0.5, y: info.height + 1.2, z: z + 0.5, info }
        }
      }
    }
    if (best) return best

    const fallback = [
      [8, 8],
      [24, 8],
      [-8, 8],
      [40, 24],
      [-40, 24],
      [72, 64],
      [-72, -64],
      [128, 128],
    ]
    for (const [x, z] of fallback) {
      const info = columnInfo(x, z, seed)
      if (info.height > SEA_LEVEL && info.height < 40 && info.biome !== 'oceano') {
        return { x: x + 0.5, y: info.height + 1.2, z: z + 0.5, info }
      }
    }
    const info = columnInfo(8, 8, seed)
    return { x: 8.5, y: info.height + 2.2, z: 8.5, info }
  }

  dispose() {
    for (const chunk of this.chunks.values()) this.clearMeshes(chunk)
    this.chunks.clear()
    this.scene.remove(this.group)
  }
}
