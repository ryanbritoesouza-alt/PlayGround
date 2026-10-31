import * as THREE from 'three'

/* ============================================================
   Texturas pixel art geradas em canvas + definição dos blocos.
   Tudo em português brasileiro.
   ============================================================ */

export const TILE = 16
export const ATLAS_COLS = 8
export const ATLAS_ROWS = 4

const TILE_NAMES = []
const TILE_INDEX = new Map()
const PAINTERS = new Map()

function defTile(name, painter) {
  TILE_INDEX.set(name, TILE_NAMES.length)
  TILE_NAMES.push(name)
  PAINTERS.set(name, painter)
}

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

function px(ctx, x, y, color) {
  ctx.fillStyle = color
  ctx.fillRect(x, y, 1, 1)
}

function fill(ctx, color) {
  ctx.fillStyle = color
  ctx.fillRect(0, 0, TILE, TILE)
}

function pick(list, r) {
  return list[Math.floor(r * list.length) % list.length]
}

/* -------------------------- tiles -------------------------- */

defTile('grass_top', (ctx) => {
  const r = rng(101)
  const patch = []
  for (let y = 0; y < 8; y++) {
    patch.push([])
    for (let x = 0; x < 8; x++) patch[y].push(r())
  }
  const pal = ['#4e7f2c', '#578a33', '#5f9339', '#4a7928', '#659b3d']
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      let v = patch[y >> 1][x >> 1]
      if (r() < 0.18) v = Math.random()
      px(ctx, x, y, pal[Math.floor(v * pal.length) % pal.length])
    }
  }
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(r() * 7) * 2
    const y = Math.floor(r() * 7) * 2
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) px(ctx, x + dx, y + dy, '#3f6b22')
  }
  for (let i = 0; i < 6; i++) px(ctx, Math.floor(r() * 16), Math.floor(r() * 16), '#72a847')
})

defTile('grass_side', (ctx) => {
  const r = rng(202)
  const dirt = ['#7b5536', '#845e3d', '#6f4a2c', '#8a6543', '#765031', '#8f6a47']
  const patch = []
  for (let y = 0; y < 8; y++) {
    patch.push([])
    for (let x = 0; x < 8; x++) patch[y].push(r())
  }
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) px(ctx, x, y, dirt[Math.floor(patch[y >> 1][x >> 1] * dirt.length) % dirt.length])
  }
  const grass = ['#4e7f2c', '#578a33', '#62973b', '#487628']
  for (let x = 0; x < 16; x++) {
    const depth = 3 + (r() < 0.4 ? 1 : 0) + (r() < 0.16 ? 1 : 0)
    for (let y = 0; y < depth; y++) px(ctx, x, y, grass[Math.floor(r() * grass.length)])
    if (r() < 0.35) px(ctx, x, depth, '#426e24')
  }
  for (let i = 0; i < 9; i++) px(ctx, Math.floor(r() * 16), 5 + Math.floor(r() * 11), '#5c3d24')
  for (let i = 0; i < 4; i++) px(ctx, Math.floor(r() * 16), 5 + Math.floor(r() * 11), '#96704c')
})

defTile('dirt', (ctx) => {
  const r = rng(303)
  const pal = ['#7b5536', '#845e3d', '#6f4a2c', '#8a6543', '#765031', '#8f6a47']
  const patch = []
  for (let y = 0; y < 8; y++) {
    patch.push([])
    for (let x = 0; x < 8; x++) patch[y].push(r())
  }
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) px(ctx, x, y, pal[Math.floor(patch[y >> 1][x >> 1] * pal.length) % pal.length])
  }
  for (let i = 0; i < 10; i++) {
    const x = Math.floor(r() * 15)
    const y = Math.floor(r() * 15)
    px(ctx, x, y, '#5b3b22')
    if (r() < 0.4) px(ctx, x + 1, y, '#63422a')
  }
  for (let i = 0; i < 7; i++) px(ctx, Math.floor(r() * 16), Math.floor(r() * 16), '#9d7550')
})

defTile('stone', (ctx) => {
  const r = rng(404)
  const pal = ['#7c7c7c', '#868686', '#727272', '#8f8f8f', '#818181']
  const patch = []
  for (let y = 0; y < 8; y++) {
    patch.push([])
    for (let x = 0; x < 8; x++) patch[y].push(r())
  }
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) px(ctx, x, y, pal[Math.floor(patch[y >> 1][x >> 1] * pal.length) % pal.length])
  }
  for (let i = 0; i < 4; i++) {
    let x = Math.floor(r() * 16)
    let y = Math.floor(r() * 16)
    for (let s = 0; s < 4; s++) {
      px(ctx, x, y, '#616161')
      x += r() < 0.5 ? 1 : 0
      y += 1
      if (x > 15 || y > 15) break
    }
  }
  for (let i = 0; i < 7; i++) px(ctx, Math.floor(r() * 16), Math.floor(r() * 16), '#9c9c9c')
})

defTile('sand', (ctx) => {
  const r = rng(505)
  const pal = ['#dccb92', '#e3d39d', '#d3c288', '#e8daa7', '#d8c78d']
  const patch = []
  for (let y = 0; y < 8; y++) {
    patch.push([])
    for (let x = 0; x < 8; x++) patch[y].push(r())
  }
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) px(ctx, x, y, pal[Math.floor(patch[y >> 1][x >> 1] * pal.length) % pal.length])
  }
  for (let i = 0; i < 8; i++) px(ctx, Math.floor(r() * 16), Math.floor(r() * 16), '#c2ae72')
  for (let i = 0; i < 4; i++) px(ctx, Math.floor(r() * 16), Math.floor(r() * 16), '#f1e7bb')
})

defTile('log_side', (ctx) => {
  const r = rng(606)
  const bands = ['#6b4a2b', '#785434', '#5f4024', '#7f5b38', '#66452a']
  for (let x = 0; x < 16; x++) {
    const base = bands[x % bands.length]
    for (let y = 0; y < 16; y++) {
      px(ctx, x, y, r() < 0.12 ? '#5b3d21' : base)
    }
  }
  for (const x of [0, 5, 10, 15]) for (let y = 0; y < 16; y++) if (r() < 0.75) px(ctx, x, y, '#53361d')
  for (let i = 0; i < 5; i++) {
    const x = 2 + Math.floor(r() * 12)
    const y = Math.floor(r() * 16)
    px(ctx, x, y, '#8f6841')
    px(ctx, x, Math.min(15, y + 1), '#8f6841')
  }
})

defTile('log_top', (ctx) => {
  const r = rng(707)
  const bark = ['#5b3c20', '#6b4a2b', '#513519']
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (x === 0 || y === 0 || x === 15 || y === 15) px(ctx, x, y, pick(bark, r()))
    else {
      const d = Math.hypot(x - 7.5, y - 7.5)
      const ring = Math.sin(d * 1.75) > 0
      px(ctx, x, y, ring ? (r() < 0.2 ? '#a57a49' : '#b38653') : r() < 0.2 ? '#8d6339' : '#9a6f42')
    }
  }
  px(ctx, 7, 7, '#6f4c29')
  px(ctx, 8, 8, '#6f4c29')
})

defTile('leaves', (ctx) => {
  const r = rng(808)
  const pal = ['#2f6b1e', '#387a25', '#43882c', '#4f9633', '#2a601b', '#57a039']
  ctx.clearRect(0, 0, 16, 16)
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (r() < 0.13) continue
      px(ctx, x, y, pick(pal, r()))
    }
  }
  for (let i = 0; i < 18; i++) px(ctx, Math.floor(r() * 16), Math.floor(r() * 16), '#69b447')
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(r() * 16)
    const y = Math.floor(r() * 16)
    ctx.clearRect(x, y, 1, 1)
  }
})

defTile('planks', (ctx) => {
  const r = rng(909)
  const pal = ['#a97b47', '#b0824d', '#9c7040', '#b98b55']
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) px(ctx, x, y, pick(pal, r()))
    if (y % 4 === 3) for (let x = 0; x < 16; x++) px(ctx, x, y, '#7c562f')
  }
  for (let row = 0; row < 4; row++) {
    const x = row % 2 === 0 ? 4 : 11
    for (let y = row * 4; y < row * 4 + 3; y++) px(ctx, x, y, '#7c562f')
  }
  for (let i = 0; i < 10; i++) px(ctx, Math.floor(r() * 16), Math.floor(r() * 16), '#c79a63')
  for (let i = 0; i < 6; i++) px(ctx, Math.floor(r() * 16), Math.floor(r() * 16), '#8a6135')
})

defTile('glass', (ctx) => {
  ctx.clearRect(0, 0, 16, 16)
  ctx.fillStyle = 'rgba(205, 238, 255, 0.14)'
  ctx.fillRect(1, 1, 14, 14)
  for (let i = 0; i < 16; i++) {
    px(ctx, i, 0, '#d8f4ff')
    px(ctx, i, 15, '#b7e2f2')
    px(ctx, 0, i, '#d8f4ff')
    px(ctx, 15, i, '#b7e2f2')
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'
  for (let i = 0; i < 7; i++) px(ctx, 2 + i, 11 - i, '#f2fbff')
  for (let i = 0; i < 4; i++) px(ctx, 9 + i, 5 - i + 4, '#eaf9ff')
  px(ctx, 3, 3, '#ffffff')
})

defTile('bricks', (ctx) => {
  const r = rng(1111)
  const mortar = '#c9c1ab'
  fill(ctx, mortar)
  const rows = [0, 4, 8, 12]
  const pal = ['#9e4330', '#a94a35', '#933d2b', '#b0523c']
  for (let ri = 0; ri < rows.length; ri++) {
    const y0 = rows[ri]
    const offset = ri % 2 === 0 ? 0 : 4
    for (let x = 0; x < 16; x++) {
      const seam = (x + offset) % 8 === 0
      for (let y = y0; y < Math.min(16, y0 + 3); y++) {
        if (seam) px(ctx, x, y, '#b8af99')
        else px(ctx, x, y, pick(pal, r()))
      }
    }
  }
})

defTile('snow', (ctx) => {
  const r = rng(1212)
  const pal = ['#eef7ff', '#e4f0fa', '#f7fbff', '#dceaf6']
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(ctx, x, y, pick(pal, r()))
  for (let i = 0; i < 10; i++) px(ctx, Math.floor(r() * 16), Math.floor(r() * 16), '#c9dcee')
  for (let i = 0; i < 8; i++) px(ctx, Math.floor(r() * 16), Math.floor(r() * 16), '#ffffff')
})

defTile('cactus_side', (ctx) => {
  const r = rng(1313)
  const pal = ['#357c2e', '#3f8a35', '#2f7029', '#468f3a']
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(ctx, x, y, pick(pal, r()))
  for (const x of [1, 5, 10, 14]) for (let y = 0; y < 16; y++) px(ctx, x, y, '#286323')
  for (let i = 0; i < 14; i++) {
    const x = 2 + Math.floor(r() * 12)
    const y = Math.floor(r() * 16)
    px(ctx, x, y, '#8fce7e')
    if (r() < 0.4) px(ctx, x, Math.min(15, y + 1), '#e8f7de')
  }
})

defTile('cactus_top', (ctx) => {
  const r = rng(1414)
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = Math.hypot(x - 7.5, y - 7.5)
    px(ctx, x, y, d < 4 ? '#5aa34c' : d < 6.5 ? '#3f8a35' : '#2f7029')
  }
  for (let i = 0; i < 12; i++) px(ctx, 3 + Math.floor(r() * 10), 3 + Math.floor(r() * 10), '#7fc070')
})

defTile('sandstone', (ctx) => {
  const r = rng(1515)
  const pal = ['#d9c690', '#e0cf9b', '#d0bc82', '#e5d6a5']
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(ctx, x, y, pick(pal, r()))
  for (const y of [4, 9, 13]) {
    for (let x = 0; x < 16; x++) px(ctx, x, y, '#c1ab70')
  }
  for (let i = 0; i < 10; i++) px(ctx, Math.floor(r() * 16), Math.floor(r() * 16), '#bda66c')
})

defTile('tallgrass', (ctx) => {
  const r = rng(1616)
  ctx.clearRect(0, 0, 16, 16)
  const pal = ['#4b8b2c', '#5a9d37', '#68ad43', '#3d7722']
  for (let blade = 0; blade < 7; blade++) {
    let x = 1 + Math.floor(r() * 14)
    const height = 5 + Math.floor(r() * 9)
    const lean = r() < 0.5 ? 0 : r() < 0.5 ? 1 : -1
    for (let i = 0; i < height; i++) {
      const y = 15 - i
      const xx = Math.max(0, Math.min(15, x + Math.round((i / height) * lean * 2)))
      px(ctx, xx, y, pick(pal, r()))
    }
  }
})

defTile('flower', (ctx) => {
  const r = rng(1717)
  ctx.clearRect(0, 0, 16, 16)
  for (let y = 8; y < 16; y++) px(ctx, 8, y, '#4b8b2c')
  px(ctx, 7, 11, '#4b8b2c')
  px(ctx, 6, 10, '#5a9d37')
  px(ctx, 9, 13, '#3d7722')
  px(ctx, 10, 12, '#4b8b2c')
  const petals = [[7, 4], [8, 3], [9, 4], [6, 5], [10, 5], [7, 6], [8, 6], [9, 6], [6, 6], [10, 6], [8, 5]]
  for (const [x, y] of petals) px(ctx, x, y, r() < 0.3 ? '#e8503b' : '#d63a2c')
  px(ctx, 8, 4, '#ffd23f')
  px(ctx, 8, 5, '#ffb52e')
  px(ctx, 7, 5, '#f0c235')
})

/* ---------------------- atlas + uv ---------------------- */

export function createAtlas() {
  const canvas = document.createElement('canvas')
  canvas.width = ATLAS_COLS * TILE
  canvas.height = ATLAS_ROWS * TILE
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false

  const canvases = new Map()
  for (const name of TILE_NAMES) {
    const c = document.createElement('canvas')
    c.width = TILE
    c.height = TILE
    const cx = c.getContext('2d')
    cx.imageSmoothingEnabled = false
    PAINTERS.get(name)(cx)
    canvases.set(name, c)
    const index = TILE_INDEX.get(name)
    const col = index % ATLAS_COLS
    const row = Math.floor(index / ATLAS_COLS)
    ctx.drawImage(c, col * TILE, row * TILE)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true

  return { texture, canvas, canvases }
}

const PAD = 0.5 / (ATLAS_COLS * TILE)

export function uvFor(name) {
  const index = TILE_INDEX.get(name) ?? 0
  const col = index % ATLAS_COLS
  const row = Math.floor(index / ATLAS_COLS)
  return {
    u0: col / ATLAS_COLS + PAD,
    u1: (col + 1) / ATLAS_COLS - PAD,
    v1: 1 - row / ATLAS_ROWS - PAD,
    v0: 1 - (row + 1) / ATLAS_ROWS + PAD,
  }
}

/* ----------------------- água / rachaduras ----------------------- */

export function createWaterTexture() {
  const c = document.createElement('canvas')
  c.width = TILE
  c.height = TILE
  const ctx = c.getContext('2d')
  const r = rng(2222)
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const v = r()
    px(ctx, x, y, v < 0.2 ? '#2a6cc4' : v < 0.7 ? '#3177cf' : '#3a83da')
  }
  for (let i = 0; i < 16; i++) {
    const y = Math.floor(r() * 16)
    const x = Math.floor(r() * 16)
    px(ctx, x, y, '#61a8ee')
    if (r() < 0.6) px(ctx, (x + 1) % 16, y, '#5aa2ea')
  }
  const texture = new THREE.CanvasTexture(c)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function createCrackTextures() {
  const r = rng(7777)
  const arms = []
  for (let i = 0; i < 14; i++) {
    let angle = (i / 14) * Math.PI * 2 + (r() - 0.5) * 0.6
    let x = 8
    let y = 8
    const points = [[x, y]]
    const length = 2 + Math.floor(r() * 4)
    for (let s = 0; s < length; s++) {
      angle += (r() - 0.5) * 0.85
      x += Math.cos(angle) * 1.55
      y += Math.sin(angle) * 1.55
      points.push([Math.round(x), Math.round(y)])
    }
    arms.push(points)
  }

  const textures = []
  for (let stage = 0; stage < 10; stage++) {
    const c = document.createElement('canvas')
    c.width = 16
    c.height = 16
    const ctx = c.getContext('2d')
    const active = Math.min(arms.length, 2 + Math.floor(stage * 1.35))
    ctx.fillStyle = 'rgba(8, 12, 18, 0.72)'
    for (let a = 0; a < active; a++) {
      const pts = arms[a]
      for (let i = 0; i < pts.length; i++) {
        const [x, y] = pts[i]
        if (x >= 0 && x < 16 && y >= 0 && y < 16) ctx.fillRect(x, y, 1, 1)
        if (i > 1 && i < pts.length - 1 && r() < 0.4) {
          const ddx = Math.round((r() - 0.5) * 2)
          const ddy = Math.round((r() - 0.5) * 2)
          ctx.fillRect(Math.max(0, Math.min(15, x + ddx)), Math.max(0, Math.min(15, y + ddy)), 1, 1)
        }
      }
    }
    const tex = new THREE.CanvasTexture(c)
    tex.magFilter = THREE.NearestFilter
    tex.minFilter = THREE.NearestFilter
    tex.generateMipmaps = false
    textures.push(tex)
  }
  return textures
}

/* -------------------------- blocos -------------------------- */

function block(data) {
  return {
    solid: true,
    opaque: true,
    liquid: false,
    cross: false,
    glass: false,
    alpha: false,
    hardness: 0.4,
    sound: 'dirt',
    ...data,
  }
}

export const BLOCKS = [
  null,
  block({ id: 1, key: 'grass', name: 'Grama', top: 'grass_top', side: 'grass_side', bottom: 'dirt', hardness: 0.28, sound: 'grass', color: '#6ba53e' }),
  block({ id: 2, key: 'dirt', name: 'Terra', top: 'dirt', side: 'dirt', bottom: 'dirt', hardness: 0.25, sound: 'dirt', color: '#7d5637' }),
  block({ id: 3, key: 'stone', name: 'Pedra', top: 'stone', side: 'stone', bottom: 'stone', hardness: 0.6, sound: 'stone', color: '#828282' }),
  block({ id: 4, key: 'sand', name: 'Areia', top: 'sand', side: 'sand', bottom: 'sand', hardness: 0.22, sound: 'sand', color: '#dccb93' }),
  block({ id: 5, key: 'log', name: 'Tronco', top: 'log_top', side: 'log_side', bottom: 'log_top', hardness: 0.5, sound: 'wood', color: '#755333' }),
  block({ id: 6, key: 'leaves', name: 'Folhas', top: 'leaves', side: 'leaves', bottom: 'leaves', hardness: 0.16, sound: 'grass', color: '#3c7f26', opaque: false, alpha: true }),
  block({ id: 7, key: 'water', name: 'Água', top: 'sand', side: 'sand', bottom: 'sand', liquid: true, solid: false, opaque: false, hardness: 0, color: '#3278cc' }),
  block({ id: 8, key: 'planks', name: 'Tábuas', top: 'planks', side: 'planks', bottom: 'planks', hardness: 0.42, sound: 'wood', color: '#a97b47' }),
  block({ id: 9, key: 'glass', name: 'Vidro', top: 'glass', side: 'glass', bottom: 'glass', hardness: 0.2, sound: 'glass', opaque: false, glass: true, color: '#cdeaf7' }),
  block({ id: 10, key: 'bricks', name: 'Tijolos', top: 'bricks', side: 'bricks', bottom: 'bricks', hardness: 0.65, sound: 'stone', color: '#a34a35' }),
  block({ id: 11, key: 'snow', name: 'Neve', top: 'snow', side: 'snow', bottom: 'snow', hardness: 0.18, sound: 'sand', color: '#eef7ff' }),
  block({ id: 12, key: 'cactus', name: 'Cacto', top: 'cactus_top', side: 'cactus_side', bottom: 'cactus_top', hardness: 0.32, sound: 'grass', color: '#3f8a35' }),
  block({ id: 13, key: 'tallgrass', name: 'Grama alta', top: 'tallgrass', side: 'tallgrass', bottom: 'tallgrass', cross: true, solid: false, opaque: false, hardness: 0.04, sound: 'grass', color: '#579a35' }),
  block({ id: 14, key: 'flower', name: 'Flor', top: 'flower', side: 'flower', bottom: 'flower', cross: true, solid: false, opaque: false, hardness: 0.04, sound: 'grass', color: '#d64a35' }),
  block({ id: 15, key: 'sandstone', name: 'Arenito', top: 'sandstone', side: 'sandstone', bottom: 'sandstone', hardness: 0.52, sound: 'stone', color: '#d8c58e' }),
]

export const INVENTORY_BLOCKS = [1, 2, 3, 4, 5, 8, 6, 9, 10, 15, 11, 12, 14, 13]
export const DEFAULT_HOTBAR = [1, 2, 3, 4, 5, 6, 8, 9, 10]

export function getBlock(id) {
  return BLOCKS[id] || null
}

export function isSolid(id) {
  const b = BLOCKS[id]
  return !!(b && b.solid)
}

export function isOpaque(id) {
  const b = BLOCKS[id]
  return !!(b && b.opaque)
}

export function isLiquid(id) {
  const b = BLOCKS[id]
  return !!(b && b.liquid)
}

export function isTargetable(id) {
  const b = BLOCKS[id]
  return !!(b && !b.liquid)
}

/* ---------------------- ícones isométricos ---------------------- */

const iconCache = new Map()
const shadedCache = new Map()

function shadedTile(tileCanvas, shade) {
  const key = tileCanvas
  let variants = shadedCache.get(key)
  if (!variants) {
    variants = new Map()
    shadedCache.set(key, variants)
  }
  if (variants.has(shade)) return variants.get(shade)
  const c = document.createElement('canvas')
  c.width = TILE
  c.height = TILE
  const ctx = c.getContext('2d')
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(tileCanvas, 0, 0)
  if (shade > 0) {
    ctx.fillStyle = `rgba(4, 9, 16, ${shade})`
    ctx.fillRect(0, 0, TILE, TILE)
  }
  variants.set(shade, c)
  return c
}

export function blockIcon(id, size = 64) {
  const key = id + ':' + size
  if (iconCache.has(key)) return iconCache.get(key)
  const b = BLOCKS[id]
  const atlas = blockIcon.atlas
  if (!b || !atlas) return ''
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  const S = size

  if (b.cross) {
    const tile = atlas.canvases.get(b.side)
    ctx.drawImage(tile, Math.round(S * 0.18), Math.round(S * 0.18), Math.round(S * 0.64), Math.round(S * 0.64))
    const url = canvas.toDataURL()
    iconCache.set(key, url)
    return url
  }

  const top = shadedTile(atlas.canvases.get(b.top), 0.03)
  const left = shadedTile(atlas.canvases.get(b.side), 0.26)
  const right = shadedTile(atlas.canvases.get(b.side), 0.12)

  const drawFace = (tile, t, polygon) => {
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(polygon[0], polygon[1])
    for (let i = 2; i < polygon.length; i += 2) ctx.lineTo(polygon[i], polygon[i + 1])
    ctx.closePath()
    ctx.clip()
    ctx.setTransform(t[0], t[1], t[2], t[3], t[4], t[5])
    ctx.drawImage(tile, 0, 0, 16, 16, 0, 0, 16, 16)
    ctx.restore()
  }

  // topo
  drawFace(top, [0.025 * S, -0.0125 * S, 0.025 * S, 0.0125 * S, 0.1 * S, 0.3 * S], [
    0.1 * S, 0.3 * S, 0.5 * S, 0.1 * S, 0.9 * S, 0.3 * S, 0.5 * S, 0.5 * S,
  ])
  // esquerda
  drawFace(left, [0.025 * S, 0.0125 * S, 0, 0.025 * S, 0.1 * S, 0.3 * S], [
    0.1 * S, 0.3 * S, 0.5 * S, 0.5 * S, 0.5 * S, 0.9 * S, 0.1 * S, 0.7 * S,
  ])
  // direita
  drawFace(right, [0.025 * S, -0.0125 * S, 0, 0.025 * S, 0.5 * S, 0.5 * S], [
    0.5 * S, 0.5 * S, 0.9 * S, 0.3 * S, 0.9 * S, 0.7 * S, 0.5 * S, 0.9 * S,
  ])

  const url = canvas.toDataURL()
  iconCache.set(key, url)
  return url
}

export function attachAtlasToIcons(atlas) {
  blockIcon.atlas = atlas
}

/* material individual para o bloco na mão */
export function tileMaterial(atlas, tileName) {
  const uv = uvFor(tileName)
  const tex = atlas.texture.clone()
  tex.needsUpdate = true
  tex.repeat.set(uv.u1 - uv.u0, uv.v1 - uv.v0)
  tex.offset.set(uv.u0, uv.v0)
  return new THREE.MeshBasicMaterial({ map: tex, alphaTest: tileName === 'glass' ? 0.02 : 0.5, transparent: tileName === 'glass' })
}
