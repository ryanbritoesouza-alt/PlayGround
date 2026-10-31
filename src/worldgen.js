/* ============================================================
   Geração procedural do mundo: relevo, biomas, cavernas,
   árvores, cactos, flores e grama alta.
   ============================================================ */

export const CHUNK_SIZE = 16
export const WORLD_HEIGHT = 64
export const SEA_LEVEL = 24

const HASH_A = 0x27d4eb2d
const HASH_B = 0x165667b1
const HASH_C = 0x9e3779b1

export function hash2(x, z, seed) {
  let h = Math.imul(x | 0, HASH_A) ^ Math.imul(z | 0, HASH_B) ^ Math.imul(seed | 0, HASH_C)
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

function hash3(x, y, z, seed) {
  let h =
    Math.imul(x | 0, 0x8da6b343) ^
    Math.imul(y | 0, 0xd8163841) ^
    Math.imul(z | 0, 0xcb1ab31f) ^
    Math.imul(seed | 0, HASH_C)
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d)
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

function smooth(t) {
  return t * t * (3 - 2 * t)
}

export function valueNoise2(x, z, seed) {
  const xi = Math.floor(x)
  const zi = Math.floor(z)
  const xf = smooth(x - xi)
  const zf = smooth(z - zi)
  const a = hash2(xi, zi, seed)
  const b = hash2(xi + 1, zi, seed)
  const c = hash2(xi, zi + 1, seed)
  const d = hash2(xi + 1, zi + 1, seed)
  return (a + (b - a) * xf) * (1 - zf) + (c + (d - c) * xf) * zf
}

export function fbm2(x, z, seed, octaves = 4) {
  let amp = 0.5
  let freq = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise2(x * freq, z * freq, seed + i * 1013) * amp
    norm += amp
    amp *= 0.5
    freq *= 2.03
  }
  return sum / norm
}

function valueNoise3(x, y, z, seed) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  const xf = smooth(x - xi)
  const yf = smooth(y - yi)
  const zf = smooth(z - zi)
  const c000 = hash3(xi, yi, zi, seed)
  const c100 = hash3(xi + 1, yi, zi, seed)
  const c010 = hash3(xi, yi + 1, zi, seed)
  const c110 = hash3(xi + 1, yi + 1, zi, seed)
  const c001 = hash3(xi, yi, zi + 1, seed)
  const c101 = hash3(xi + 1, yi, zi + 1, seed)
  const c011 = hash3(xi, yi + 1, zi + 1, seed)
  const c111 = hash3(xi + 1, yi + 1, zi + 1, seed)
  const x00 = c000 + (c100 - c000) * xf
  const x10 = c010 + (c110 - c010) * xf
  const x01 = c001 + (c101 - c001) * xf
  const x11 = c011 + (c111 - c011) * xf
  const y0 = x00 + (x10 - x00) * yf
  const y1 = x01 + (x11 - x01) * yf
  return y0 + (y1 - y0) * zf
}

function fbm3(x, y, z, seed, octaves = 2) {
  let amp = 0.5
  let freq = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise3(x * freq, y * freq, z * freq, seed + i * 2749) * amp
    norm += amp
    amp *= 0.5
    freq *= 2.1
  }
  return sum / norm
}

export function rand2(x, z, seed) {
  return hash2(x, z, seed)
}

export function columnInfo(wx, wz, seed) {
  const broad = fbm2(wx * 0.0055, wz * 0.0055, seed, 4)
  const detail = fbm2(wx * 0.027, wz * 0.027, seed + 17, 3)
  const mountain = fbm2(wx * 0.0105, wz * 0.0105, seed + 31, 3)
  const ridge = 1 - Math.abs(mountain * 2 - 1)
  const river = Math.abs(fbm2(wx * 0.0042, wz * 0.0042, seed + 55, 2) - 0.5)

  let height = 19 + broad * 15 + detail * 4.5 + Math.pow(ridge, 4) * 16
  let riverCut = false
  if (river < 0.019) {
    height = Math.min(height, SEA_LEVEL - 2)
    riverCut = true
  }
  height = Math.floor(height)
  if (height < 2) height = 2
  if (height > 50) height = 50

  const temp = fbm2(wx * 0.0038, wz * 0.0038, seed + 101, 2)
  const moist = fbm2(wx * 0.0055, wz * 0.0055, seed + 203, 2)

  let biome
  if (height < SEA_LEVEL - 1) biome = 'oceano'
  else if (height <= SEA_LEVEL + 1) biome = 'praia'
  else if (temp > 0.615) biome = 'deserto'
  else if (temp < 0.37) biome = 'neve'
  else if (moist > 0.53) biome = 'floresta'
  else biome = 'planicie'

  return { height, biome, temp, moist, river: riverCut }
}

const BIOME_NAMES = {
  oceano: 'Oceano',
  praia: 'Praia',
  deserto: 'Deserto',
  neve: 'Serra nevada',
  floresta: 'Floresta',
  planicie: 'Planície',
}

export function biomeName(biome) {
  return BIOME_NAMES[biome] || 'Mundo'
}

function put(blocks, cx, cz, wx, wy, wz, id, force = false) {
  if (wy < 0 || wy >= WORLD_HEIGHT) return
  const lx = wx - cx * CHUNK_SIZE
  const lz = wz - cz * CHUNK_SIZE
  if (lx < 0 || lx > 15 || lz < 0 || lz > 15) return
  const i = lx + 16 * lz + 256 * wy
  if (!force && blocks[i] !== 0 && blocks[i] !== 6) return
  blocks[i] = id
}

function getLocal(blocks, cx, cz, wx, wy, wz) {
  const lx = wx - cx * CHUNK_SIZE
  const lz = wz - cz * CHUNK_SIZE
  if (lx < 0 || lx > 15 || lz < 0 || lz > 15 || wy < 0 || wy >= WORLD_HEIGHT) return -1
  return blocks[lx + 16 * lz + 256 * wy]
}

function treeKind(wx, wz, info, seed) {
  const r = rand2(wx, wz, seed + 7919)
  if (info.biome === 'deserto') return r < 0.016 ? 'cactus' : null
  if (info.biome === 'neve') return r < 0.016 ? 'spruce' : null
  if (info.biome === 'floresta') return r < 0.042 ? 'oak' : null
  if (info.biome === 'planicie') return r < 0.008 ? 'oak' : null
  return null
}

function plantTree(blocks, cx, cz, wx, wz, info, seed) {
  const kind = treeKind(wx, wz, info, seed)
  if (!kind) return
  const h = info.height
  if (h <= SEA_LEVEL + 1) return

  if (kind === 'cactus') {
    const height = 2 + Math.floor(rand2(wx, wz, seed + 61) * 3)
    for (let i = 1; i <= height; i++) put(blocks, cx, cz, wx, h + i, wz, 12, true)
    return
  }

  const rr = mulberry(seed ^ (wx * 73856093) ^ (wz * 19349663))
  if (kind === 'oak') {
    const trunk = 4 + Math.floor(rr() * 3)
    const top = h + trunk
    for (let dy = -2; dy <= 1; dy++) {
      const radius = dy <= -1 ? 2 : 1
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (radius === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue
          if (dy === 1 && Math.abs(dx) + Math.abs(dz) > 1) continue
          put(blocks, cx, cz, wx + dx, top + dy, wz + dz, 6)
        }
      }
    }
    for (let i = 1; i <= trunk; i++) put(blocks, cx, cz, wx, h + i, wz, 5, true)
    put(blocks, cx, cz, wx, top + 2, wz, 6)
    return
  }

  // pinheiro
  const trunk = 6 + Math.floor(rr() * 3)
  const top = h + trunk
  for (let dy = -5; dy <= 1; dy++) {
    const radius = dy >= 0 ? 0 : Math.min(2, Math.floor((-dy + 1) / 2))
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        if (radius > 0 && Math.abs(dx) === radius && Math.abs(dz) === radius) continue
        put(blocks, cx, cz, wx + dx, top + dy, wz + dz, 6)
      }
    }
  }
  for (let i = 1; i <= trunk; i++) put(blocks, cx, cz, wx, h + i, wz, 5, true)
}

function mulberry(seed) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

/* Preenche o chunk inteiro. `edits` é uma lista [x,y,z,id] das
   alterações do jogador que devem prevalecer. */
export function generateChunk(chunk, seed, edits) {
  const { cx, cz, blocks } = chunk
  const baseX = cx * CHUNK_SIZE
  const baseZ = cz * CHUNK_SIZE

  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const wx = baseX + lx
      const wz = baseZ + lz
      const info = columnInfo(wx, wz, seed)
      const h = info.height
      const waterTop = h < SEA_LEVEL ? SEA_LEVEL : h

      let topBlock = 1
      let subBlock = 2
      const isBeach = info.biome === 'praia' || h <= SEA_LEVEL
      if (info.biome === 'deserto') {
        topBlock = 4
        subBlock = 15
      } else if (info.biome === 'neve') {
        topBlock = 11
        subBlock = 2
      } else if (isBeach) {
        topBlock = 4
        subBlock = 4
      }

      for (let y = 0; y <= h; y++) {
        let id
        if (y === 0) id = 3
        else if (y === h) id = topBlock
        else if (y > h - 4) id = subBlock
        else id = 3

        const i = lx + 16 * lz + 256 * y
        if (y > 2 && y < h - 2) {
          const cave = fbm3(wx * 0.055, y * 0.08, wz * 0.055, seed + 700, 2)
          const tunnel = Math.abs(fbm3(wx * 0.032, y * 0.055, wz * 0.032, seed + 900, 2) - 0.5)
          if (cave > 0.655 || tunnel < 0.012) {
            blocks[i] = 0
            continue
          }
        }
        blocks[i] = id
      }

      for (let y = h + 1; y <= waterTop; y++) {
        blocks[lx + 16 * lz + 256 * y] = 7
      }

      if (h > SEA_LEVEL && h < WORLD_HEIGHT - 2) {
        const r = hash2(wx, wz, seed + 4441)
        if (blocks[lx + 16 * lz + 256 * h] === 1 && blocks[lx + 16 * lz + 256 * (h + 1)] === 0) {
          if (r < 0.055) blocks[lx + 16 * lz + 256 * (h + 1)] = 13
          else if (r < 0.067) blocks[lx + 16 * lz + 256 * (h + 1)] = 14
        }
      }
    }
  }

  // árvores com margem, para copas que atravessam a borda do chunk
  for (let wz = baseZ - 3; wz < baseZ + CHUNK_SIZE + 3; wz++) {
    for (let wx = baseX - 3; wx < baseX + CHUNK_SIZE + 3; wx++) {
      const info = columnInfo(wx, wz, seed)
      plantTree(blocks, cx, cz, wx, wz, info, seed)
    }
  }

  if (edits && edits.length) {
    for (let i = 0; i < edits.length; i++) {
      const [x, y, z, id] = edits[i]
      const lx = x - baseX
      const lz = z - baseZ
      if (lx < 0 || lx > 15 || lz < 0 || lz > 15 || y < 0 || y >= WORLD_HEIGHT) continue
      blocks[lx + 16 * lz + 256 * y] = id
    }
  }
}
