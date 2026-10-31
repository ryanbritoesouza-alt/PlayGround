import * as THREE from 'three'
import './style.css'
import {
  BLOCKS,
  DEFAULT_HOTBAR,
  INVENTORY_BLOCKS,
  attachAtlasToIcons,
  blockIcon,
  createAtlas,
  createCrackTextures,
  createWaterTexture,
  tileMaterial,
} from './blocks.js'
import { World } from './world.js'
import { Player } from './player.js'
import { Mobs } from './mobs.js'
import { GameAudio } from './audio.js'
import { Particles, Clouds } from './effects.js'
import { biomeName } from './worldgen.js'

/* ============================================================
   MUNDO DE BLOCOS — jogo 3D de mundo aberto em português.
   ============================================================ */

const SAVE_KEY = 'mundoDeBlocos.save.v1'
const SETTINGS_KEY = 'mundoDeBlocos.settings.v1'
const TUTORIAL_KEY = 'mundoDeBlocos.tutorial.v1'

const $ = (id) => document.getElementById(id)
const canvas = $('game')

const isTouch =
  new URLSearchParams(location.search).get('touch') === '1' ||
  matchMedia('(pointer: coarse)').matches ||
  (navigator.maxTouchPoints > 1 && !matchMedia('(pointer: fine)').matches)
if (isTouch) document.body.classList.add('is-touch')

const DEFAULT_SETTINGS = {
  distance: 5,
  sensitivity: 1,
  volume: 0.7,
  sound: true,
  fps: false,
  bob: true,
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || typeof data.seed !== 'number' || !Array.isArray(data.pos)) return null
    return data
  } catch {
    return null
  }
}

const settings = loadSettings()

const state = {
  mode: 'loading',
  seed: 0,
  time: 0.31,
  day: 1,
  hotbar: [...DEFAULT_HOTBAR],
  selected: 0,
  target: null,
  attackHeld: false,
  placeHeld: false,
  breakPressed: false,
  breakProgress: 0,
  miningKey: null,
  placeCooldown: 0,
  swing: 0,
  save: null,
  autosave: 20,
  hudTimer: 0,
  fps: 60,
  fpsTimer: 0,
  menuAngle: Math.random() * Math.PI * 2,
  suppressPause: false,
  inventoryOpen: false,
  settingsReturn: 'menu',
  helpReturn: 'menu',
  startedAt: 0,
  stepAccum: 0,
  lastTime: 0,
}

let renderer
let scene
let camera
let world = null
let player = null
let mobs = null
let atlas
let audio
let particles
let clouds
let heldGroup
let heldMesh
let crackMesh
let crackMat
let crackTextures
let highlight
let sunSprite
let moonSprite
let stars
let hemiLight
let sunLight
let ambientLight
let waterTexture

const materials = {}
const skyColor = new THREE.Color()
const fogColor = new THREE.Color()
const tmpColor = new THREE.Color()
const white = new THREE.Color(0xffffff)
const nightTint = new THREE.Color(0x6c7cb0)
const dayTint = new THREE.Color(0xffffff)
const clock = { night: new THREE.Color(0x050a18), day: new THREE.Color(0x7ec0f0), dusk: new THREE.Color(0xef8f55) }
const cloudNight = new THREE.Color(0x3a456b)
const sunColorDay = new THREE.Color(0xfff3d6)
const sunColorDusk = new THREE.Color(0xffa45e)
const sunDir = new THREE.Vector3()
const tempVec = new THREE.Vector3()

const keys = new Set()
const touch = {
  joyActive: false,
  pointerId: null,
  forward: 0,
  right: 0,
  jump: false,
  down: false,
  breakHeld: false,
  placeHeld: false,
  lookId: null,
  lastX: 0,
  lastY: 0,
}

const tileMaterialCache = new Map()

/* ============================ SETUP ============================ */

function setupRenderer() {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    stencil: false,
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.shadowMap.enabled = false

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x7ec0f0)
  scene.fog = new THREE.Fog(0x7ec0f0, 48, 78)

  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 620)
  camera.rotation.order = 'YXZ'
  scene.add(camera)

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2))
  })
}

function radialTexture(inner, outer, edge = 0) {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const ctx = c.getContext('2d')
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 32)
  grad.addColorStop(0, inner)
  grad.addColorStop(0.55, outer)
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 64, 64)
  if (edge) {
    ctx.strokeStyle = edge
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(32, 32, 20, 0, Math.PI * 2)
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function setupWorldAssets() {
  atlas = createAtlas()
  attachAtlasToIcons(atlas)

  materials.solid = new THREE.MeshBasicMaterial({
    map: atlas.texture,
    vertexColors: true,
    alphaTest: 0.5,
    fog: true,
  })
  materials.cross = new THREE.MeshBasicMaterial({
    map: atlas.texture,
    vertexColors: true,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    fog: true,
  })
  materials.glass = new THREE.MeshBasicMaterial({
    map: atlas.texture,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    alphaTest: 0.01,
    side: THREE.DoubleSide,
    fog: true,
  })
  waterTexture = createWaterTexture()
  materials.water = new THREE.MeshBasicMaterial({
    map: waterTexture,
    vertexColors: true,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  })

  particles = new Particles(scene)
  clouds = new Clouds(scene, 68)

  crackTextures = createCrackTextures()
  crackMat = new THREE.MeshBasicMaterial({
    map: crackTextures[0],
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    fog: false,
  })
  crackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.008, 1.008, 1.008), crackMat)
  crackMesh.visible = false
  crackMesh.renderOrder = 6
  scene.add(crackMesh)

  const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004))
  highlight = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color: 0x101820, transparent: true, opacity: 0.55, fog: false }),
  )
  highlight.visible = false
  highlight.renderOrder = 5
  scene.add(highlight)

  // bloco na mão
  heldGroup = new THREE.Group()
  camera.add(heldGroup)
  const heldGeom = new THREE.BoxGeometry(0.28, 0.28, 0.28)
  heldMesh = new THREE.Mesh(heldGeom, [])
  heldGroup.add(heldMesh)
  heldGroup.position.set(0.6, -0.52, -1.2)
  heldGroup.rotation.set(0.14, -0.62, 0.12)

  // sol, lua e estrelas
  sunSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: radialTexture('rgba(255,255,235,1)', 'rgba(255,210,90,0.9)'),
      transparent: true,
      depthWrite: false,
      fog: false,
    }),
  )
  sunSprite.scale.setScalar(58)
  scene.add(sunSprite)

  moonSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: radialTexture('rgba(245,250,255,1)', 'rgba(190,214,255,0.85)', 'rgba(230,240,255,0.55)'),
      transparent: true,
      depthWrite: false,
      fog: false,
    }),
  )
  moonSprite.scale.setScalar(34)
  scene.add(moonSprite)

  const starPositions = []
  for (let i = 0; i < 1100; i++) {
    const theta = Math.random() * Math.PI * 2
    const phi = Math.random() * Math.PI * 0.52
    const r = 390
    starPositions.push(
      Math.cos(theta) * Math.cos(phi) * r,
      Math.sin(phi) * r + 6,
      Math.sin(theta) * Math.cos(phi) * r,
    )
  }
  const starGeom = new THREE.BufferGeometry()
  starGeom.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3))
  stars = new THREE.Points(
    starGeom,
    new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.7,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
    }),
  )
  scene.add(stars)

  // luzes para os mobs (o terreno usa iluminação assada)
  hemiLight = new THREE.HemisphereLight(0xcfe5ff, 0x4d5a3a, 0.8)
  scene.add(hemiLight)
  sunLight = new THREE.DirectionalLight(0xfff3d6, 1.1)
  sunLight.position.set(60, 120, 30)
  scene.add(sunLight)
  scene.add(sunLight.target)
  ambientLight = new THREE.AmbientLight(0xffffff, 0.35)
  scene.add(ambientLight)

  audio = new GameAudio()
  audio.setVolume(settings.volume)
  audio.setEnabled(settings.sound)
}

/* ============================ HUD / UI ============================ */

const ui = {
  hud: $('hud'),
  touch: $('touch-ui'),
  menu: $('menu'),
  loading: $('loading'),
  pause: $('pause'),
  settings: $('settings'),
  help: $('help'),
  inventory: $('inventory'),
  confirm: $('confirm'),
  fatal: $('fatal'),
  hotbar: $('hotbar'),
  slotName: $('slot-name'),
  targetName: $('target-name'),
  toasts: $('toast-area'),
  hudPlace: $('hud-place'),
  hudCoords: $('hud-coords'),
  clockIcon: $('clock-icon'),
  clockText: $('clock-text'),
  progress: $('progress-fill'),
  loadingTip: $('loading-tip'),
  inventoryGrid: $('inventory-grid'),
  menuWorldInfo: $('menu-world-info'),
  menuSeed: $('menu-seed'),
  btnPlayTitle: $('btn-play-title'),
  btnPlaySub: $('btn-play-sub'),
  pausePos: $('pause-pos'),
  pauseBiome: $('pause-biome'),
  pauseTime: $('pause-time'),
  pauseSeed: $('pause-seed'),
  waterTint: $('water-tint'),
  btnSound: $('btn-sound'),
  menuSound: $('menu-sound'),
  touchFly: document.querySelector('#touch-actions [data-act="fly"]'),
}

const body = document.body
const hide = (el) => el && el.classList.add('hidden')
const show = (el) => el && el.classList.remove('hidden')

function showToast(message, ms = 2800) {
  if (!ui.toasts) return
  while (ui.toasts.children.length >= 3) ui.toasts.firstElementChild.remove()
  const el = document.createElement('div')
  el.className = 'toast'
  el.textContent = message
  ui.toasts.appendChild(el)
  setTimeout(() => {
    el.classList.add('out')
    setTimeout(() => el.remove(), 320)
  }, ms)
}

function setProgress(value) {
  if (ui.progress) ui.progress.style.width = Math.max(4, Math.min(100, value)).toFixed(1) + '%'
}

const LOADING_TIPS = [
  'Dica: árvores dão madeira. Tábuas dão casas.',
  'Dica: segure o botão esquerdo para quebrar blocos mais duros.',
  'Dica: aperte F para voar e ver o mundo de cima.',
  'Dica: a areia é rápida de quebrar; a pedra exige paciência.',
  'Dica: o mundo salva sozinho neste navegador.',
  'Dica: à noite, o céu ganha estrelas de verdade.',
  'Dica: flores e grama alta deixam a paisagem mais viva.',
  'Dica: pressione E para abrir o inventário de blocos.',
]

function setLoading(active, tip) {
  if (active) {
    show(ui.loading)
    setProgress(4)
    if (ui.loadingTip) ui.loadingTip.textContent = tip || LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)]
  } else {
    hide(ui.loading)
  }
}

function buildHotbar() {
  if (!ui.hotbar) return
  ui.hotbar.innerHTML = ''
  for (let i = 0; i < 9; i++) {
    const id = state.hotbar[i] || 1
    const btn = document.createElement('button')
    btn.className = 'slot'
    btn.type = 'button'
    btn.setAttribute('aria-label', `Bloco ${i + 1}: ${BLOCKS[id]?.name || 'vazio'}`)
    btn.innerHTML = `<span class="num">${i + 1}</span><img alt="" src="${blockIcon(id, 64)}" />`
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      selectSlot(i)
    })
    ui.hotbar.appendChild(btn)
  }
  updateSelectionVisuals()
}

function buildInventory() {
  if (!ui.inventoryGrid) return
  ui.inventoryGrid.innerHTML = ''
  for (const id of INVENTORY_BLOCKS) {
    const def = BLOCKS[id]
    if (!def) continue
    const btn = document.createElement('button')
    btn.className = 'inv-item'
    btn.type = 'button'
    btn.dataset.block = String(id)
    btn.innerHTML = `<img alt="" src="${blockIcon(id, 64)}" /><span>${def.name}</span>`
    btn.addEventListener('click', () => {
      state.hotbar[state.selected] = id
      buildHotbar()
      selectSlot(state.selected)
      audio.play('click')
      closeInventory()
    })
    ui.inventoryGrid.appendChild(btn)
  }
}

function updateSelectionVisuals() {
  if (!ui.hotbar) return
  const slots = ui.hotbar.children
  for (let i = 0; i < slots.length; i++) {
    slots[i].classList.toggle('selected', i === state.selected)
  }
  const def = BLOCKS[state.hotbar[state.selected]] || BLOCKS[1]
  if (ui.slotName) ui.slotName.textContent = def?.name || 'Bloco'
  setHeldBlock(state.hotbar[state.selected])
  const inv = ui.inventoryGrid?.children || []
  for (const item of inv) item.classList.toggle('active', Number(item.dataset.block) === state.hotbar[state.selected])
}

function selectSlot(index) {
  if (index < 0 || index > 8) return
  state.selected = index
  updateSelectionVisuals()
  audio.play('click')
}

function setHeldBlock(id) {
  if (!heldMesh || !atlas) return
  const def = BLOCKS[id]
  if (!def) return
  const mats = getTileMaterialArray(def)
  heldMesh.material = mats
  heldGroup.userData.blockId = id
}

function getTileMaterial(tile) {
  let mat = tileMaterialCache.get(tile)
  if (!mat) {
    mat = tileMaterial(atlas, tile)
    mat.depthTest = false
    mat.fog = false
    if (tile === 'glass') {
      mat.transparent = true
      mat.alphaTest = 0.02
    } else {
      mat.transparent = false
      mat.alphaTest = 0.5
    }
    tileMaterialCache.set(tile, mat)
  }
  return mat
}

function getTileMaterialArray(def) {
  const side = getTileMaterial(def.side)
  const top = getTileMaterial(def.top)
  const bottom = getTileMaterial(def.bottom)
  return [side, side, top, bottom, side, side]
}

function updateClockAndHud(force = false) {
  if (!player || !world) return
  const hours = state.time * 24
  const h = Math.floor(hours) % 24
  const m = Math.floor((hours - Math.floor(hours)) * 60)
  const label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  const biome = world.biomeAt(player.position.x, player.position.z)
  if (ui.hudPlace) ui.hudPlace.textContent = `${biome} · Dia ${state.day}`
  if (ui.hudCoords) {
    ui.hudCoords.textContent = `X ${Math.floor(player.position.x)} · Y ${Math.floor(player.position.y)} · Z ${Math.floor(
      player.position.z,
    )}`
  }
  if (ui.clockText) ui.clockText.textContent = label
  if (ui.clockIcon) ui.clockIcon.textContent = state.time > 0.27 && state.time < 0.75 ? '☀' : '☾'
  if (state.target && BLOCKS[state.target.id]) {
    if (ui.targetName) {
      ui.targetName.textContent = BLOCKS[state.target.id].name
      show(ui.targetName)
    }
  } else {
    hide(ui.targetName)
  }
  if (settings.fps) {
    if (!document.getElementById('fps')) {
      const el = document.createElement('div')
      el.id = 'fps'
      el.className = 'fps'
      document.body.appendChild(el)
    }
    const el = document.getElementById('fps')
    if (el) el.textContent = `${Math.round(state.fps)} FPS · ${world.stats.chunks} chunks`
  } else {
    const el = document.getElementById('fps')
    if (el) el.remove()
  }
}

function updateMenuInfo() {
  if (!player || !world) return
  const biome = world.biomeAt(player.position.x, player.position.z)
  if (ui.menuWorldInfo) ui.menuWorldInfo.textContent = `${biome} · Dia ${state.day}`
  if (ui.menuSeed) ui.menuSeed.textContent = String(state.seed)
  if (ui.btnPlayTitle) ui.btnPlayTitle.textContent = state.save ? 'CONTINUAR' : 'JOGAR'
  if (ui.btnPlaySub) ui.btnPlaySub.textContent = state.save ? 'continuar de onde parou' : 'explorar um mundo novo'
}

function updatePauseStats() {
  if (!player || !world) return
  if (ui.pausePos) {
    ui.pausePos.textContent = `${Math.floor(player.position.x)}, ${Math.floor(player.position.y)}, ${Math.floor(
      player.position.z,
    )}`
  }
  if (ui.pauseBiome) ui.pauseBiome.textContent = world.biomeAt(player.position.x, player.position.z)
  if (ui.pauseTime) ui.pauseTime.textContent = `${String(Math.floor(state.time * 24)).padStart(2, '0')}:${String(
    Math.floor(((state.time * 24) % 1) * 60),
  ).padStart(2, '0')}`
  if (ui.pauseSeed) ui.pauseSeed.textContent = String(state.seed)
}

function refreshSoundButtons() {
  for (const el of [ui.btnSound, ui.menuSound]) {
    if (!el) continue
    el.classList.toggle('off', !settings.sound)
    el.setAttribute('aria-pressed', String(settings.sound))
  }
}

function applySettings() {
  if (player) {
    player.sensitivity = settings.sensitivity
    player.bobEnabled = settings.bob
  }
  if (audio) {
    audio.setVolume(settings.volume)
    audio.setEnabled(settings.sound)
  }
  const distance = $('set-distance')
  if (distance) distance.value = String(settings.distance)
  const sens = $('set-sens')
  if (sens) sens.value = String(settings.sensitivity)
  const volume = $('set-volume')
  if (volume) volume.value = String(settings.volume)
  const sound = $('set-sound')
  if (sound) sound.checked = settings.sound
  const fps = $('set-fps')
  if (fps) fps.checked = settings.fps
  const bob = $('set-bob')
  if (bob) bob.checked = settings.bob
  const valDistance = $('val-distance')
  if (valDistance) valDistance.textContent = String(settings.distance)
  const valSens = $('val-sens')
  if (valSens) valSens.textContent = settings.sensitivity.toFixed(1).replace('.', ',') + '×'
  const valVolume = $('val-volume')
  if (valVolume) valVolume.textContent = Math.round(settings.volume * 100) + '%'
  refreshSoundButtons()
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    /* sem espaço — segue o jogo */
  }
}

/* ============================ MUNDO ============================ */

function randomSeed() {
  return Math.floor(Math.random() * 900000000) + 100000
}

function normalizeHotbar(list) {
  const out = []
  for (let i = 0; i < 9; i++) {
    const id = list?.[i]
    out.push(BLOCKS[id] && !BLOCKS[id].liquid ? id : DEFAULT_HOTBAR[i])
  }
  return out
}

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))

function clearSpawnArea() {
  if (!player || !world) return
  const px = Math.floor(player.position.x)
  const pz = Math.floor(player.position.z)
  let ground = 0
  for (let y = 63; y >= 0; y--) {
    const id = world.getBlock(px, y, pz)
    if (id !== 0 && id !== 5 && id !== 6 && id !== 7 && id !== 13 && id !== 14) {
      ground = y
      break
    }
  }
  for (let dx = -6; dx <= 6; dx++) {
    for (let dz = -6; dz <= 6; dz++) {
      for (let y = ground + 1; y <= ground + 14 && y < 64; y++) {
        const id = world.getBlock(px + dx, y, pz + dz)
        if (id === 5 || id === 6 || id === 13 || id === 14) {
          world.setBlock(px + dx, y, pz + dz, 0, true)
        }
      }
    }
  }
  player.setPosition(px + 0.5, ground + 1.05, pz + 0.5)
}

async function buildWorld(seed, saveData) {
  setLoading(true)
  setProgress(6)

  if (mobs) {
    mobs.dispose()
    mobs = null
  }
  if (world) {
    world.dispose()
    world = null
  }

  world = new World({
    scene,
    seed,
    materials,
    edits: saveData?.edits || null,
  })
  player = new Player(world, camera)
  state.seed = seed
  state.time = typeof saveData?.time === 'number' ? saveData.time : 0.31
  state.day = typeof saveData?.day === 'number' ? saveData.day : 1
  state.hotbar = normalizeHotbar(saveData?.hotbar)
  state.selected = Math.max(0, Math.min(8, Number(saveData?.selected) || 0))
  state.save = saveData || null
  state.breakProgress = 0
  state.attackHeld = false
  state.placeHeld = false
  state.target = null
  state.miningKey = null

  let spawn
  if (saveData && saveData.pos) {
    spawn = { x: saveData.pos[0], y: saveData.pos[1], z: saveData.pos[2] }
    player.yaw = typeof saveData.yaw === 'number' ? saveData.yaw : 0.8
    player.pitch = typeof saveData.pitch === 'number' ? saveData.pitch : -0.1
  } else {
    spawn = world.findSpawn(seed)
    player.yaw = 0.9
    player.pitch = -0.12
  }
  player.setPosition(spawn.x, spawn.y, spawn.z)

  world.prime(player.position, 2)
  const started = performance.now()
  while (true) {
    world.update(player.position, 2, 32)
    const ready = world.isReady()
    setProgress(8 + (ready.built / Math.max(1, ready.total)) * 88)
    if (ready.ready) break
    if (performance.now() - started > 20000) break
    await nextFrame()
  }

  if (!saveData) clearSpawnArea()
  else {
    // garante que o jogador não nasça preso dentro de um bloco
    if (player.collidesAt(player.position.x, player.position.y, player.position.z)) {
      clearSpawnArea()
    }
  }

  mobs = new Mobs({ scene, world, audio })
  mobs.populate(player.position, 26)

  state.mode = 'loading'
  state.menuAngle = player.yaw + Math.PI
  updateMenuInfo()
  updateSelectionVisuals()
  applySettings()
  setProgress(100)
  await nextFrame()
  hide(ui.loading)
}

function spawnAtSafeSurface() {
  if (!player || !world) return
  const x = Math.floor(player.position.x)
  const z = Math.floor(player.position.z)
  const y = world.surfaceY(x, z)
  if (y >= 0) player.setPosition(x + 0.5, y + 1.05, z + 0.5)
}

/* ============================ LOOP ============================ */

let lastFrame = performance.now()
let loopStarted = false

function startLoop() {
  if (loopStarted) return
  loopStarted = true
  renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.05, Math.max(0.0005, (now - lastFrame) / 1000))
    lastFrame = now
    state.fps += (1 / Math.max(dt, 0.0001) - state.fps) * 0.08
    state.fpsTimer += dt

    if (state.mode === 'playing') updatePlaying(dt)
    else updateIdle(dt)

    updateEnvironment(dt)
    particles.update(dt)
    clouds.update(dt, camera.position)
    updateHeld(dt)
    renderer.render(scene, camera)
  })
}

function updateIdle(dt) {
  if (!world || !player) return
  if (state.mode === 'menu') {
    state.menuAngle += dt * 0.055
    const focus = player.position
    const angle = state.menuAngle
    const cx = focus.x + Math.cos(angle) * 20
    const cz = focus.z + Math.sin(angle) * 20
    const ground = world.surfaceY(Math.floor(cx), Math.floor(cz))
    const cy = Math.max(focus.y + 13.5, ground >= 0 ? ground + 8 : focus.y + 13.5)
    camera.position.set(cx, cy + Math.sin(angle * 0.7) * 1.1, cz)
    camera.lookAt(focus.x, focus.y + 1.6, focus.z)
    if (Math.abs(camera.fov - 62) > 0.1) {
      camera.fov += (62 - camera.fov) * Math.min(1, dt * 4)
      camera.updateProjectionMatrix()
    }
    world.update(focus, 3, 6)
    if (mobs) mobs.update(dt, focus)
  } else if (state.mode === 'paused') {
    // congelado de propósito
  }
}

function updatePlaying(dt) {
  if (!world || !player) return

  const locked = isTouch || document.pointerLockElement === canvas

  const modalOpen =
    state.inventoryOpen ||
    !ui.settings.classList.contains('hidden') ||
    !ui.help.classList.contains('hidden') ||
    !ui.confirm.classList.contains('hidden')

  let forward = 0
  let right = 0
  if (locked && !modalOpen) {
    if (keys.has('KeyW') || keys.has('ArrowUp')) forward += 1
    if (keys.has('KeyS') || keys.has('ArrowDown')) forward -= 1
    if (keys.has('KeyD') || keys.has('ArrowRight')) right += 1
    if (keys.has('KeyA') || keys.has('ArrowLeft')) right -= 1
    if (touch.joyActive) {
      forward += touch.forward
      right += touch.right
    }
    const len = Math.hypot(forward, right)
    if (len > 1) {
      forward /= len
      right /= len
    }
  }

  const sprint =
    locked &&
    !modalOpen &&
    (keys.has('ShiftLeft') || keys.has('ShiftRight') || (touch.joyActive && Math.hypot(touch.forward, touch.right) > 0.9))

  const input = {
    forward: modalOpen ? 0 : forward,
    right: modalOpen ? 0 : right,
    jump: !modalOpen && (keys.has('Space') || touch.jump),
    down: !modalOpen && (touch.down || keys.has('ControlLeft') || keys.has('KeyC')),
    sprint: !modalOpen && sprint,
  }

  const wasGround = player.onGround
  const fallSpeed = player.velocity.y
  const wasWater = player.inWater

  player.update(dt, input)
  player.updateCamera()

  if (!wasGround && player.onGround && fallSpeed < -9) {
    audio.play('land')
    particles.burst(player.position.x, player.position.y + 0.1, player.position.z, '#9a8b72', 8, 1.8)
  }
  if (!wasWater && player.inWater) audio.play('splash')

  if (player.onGround && (Math.abs(player.velocity.x) > 0.5 || Math.abs(player.velocity.z) > 0.5)) {
    state.stepAccum += Math.hypot(player.velocity.x, player.velocity.z) * dt
    if (state.stepAccum > 1.85 * (sprint ? 1.25 : 1)) {
      state.stepAccum = 0
      const gx = Math.floor(player.position.x)
      const gy = Math.floor(player.position.y - 0.2)
      const gz = Math.floor(player.position.z)
      const groundDef = BLOCKS[world.getBlock(gx, gy, gz)]
      audio.play('step', groundDef?.sound || 'dirt')
    }
  } else {
    state.stepAccum = 0
  }

  // tempo do mundo
  state.time += dt / 600
  if (state.time >= 1) {
    state.time -= 1
    state.day++
  }

  // mira, quebra e colocação
  updateInteraction(dt, modalOpen)

  // balanço do bloco na mão
  if (state.placeCooldown > 0) state.placeCooldown -= dt
  if (!modalOpen && (state.placeHeld || touch.placeHeld) && state.placeCooldown <= 0) {
    if (state.target) tryPlace(state.target)
    else state.placeCooldown = 0.1
  }

  // autosave
  state.autosave -= dt
  if (state.autosave <= 0) {
    state.autosave = 20
    saveGame(false)
  }

  state.hudTimer -= dt
  if (state.hudTimer <= 0) {
    state.hudTimer = 0.15
    updateClockAndHud()
  }

  if (world.update(player.position, settings.distance, 6).generated > 0) {
    // streaming segue em segundo plano
  }
  if (mobs) mobs.update(dt, player.position)
}

function updateInteraction(dt, modalOpen) {
  const hit = modalOpen ? null : player.raycast(6)
  state.target = hit

  if (hit) {
    highlight.visible = true
    highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5)
  } else {
    highlight.visible = false
  }

  if (state.swing > 0) state.swing = Math.max(0, state.swing - dt * 4.5)

  // acertar um porco
  if (state.breakPressed && !modalOpen && mobs) {
    state.breakPressed = false
    const eye = player.updateEye()
    const dir = player.updateLookVector()
    const mobHit = mobs.hitTest(eye, dir, 6)
    if (mobHit && (!hit || mobHit.dist < hit.dist)) {
      state.swing = 1
      const dead = mobs.hit(mobHit.pig, player.position)
      const p = mobHit.pig.state
      particles.burst(p.x, p.y + 0.9, p.z, dead ? '#ffffff' : '#f0a6b7', dead ? 22 : 8, 3)
      state.miningKey = null
      state.breakProgress = 0
      crackMesh.visible = false
      state.attackHeld = false
      state.placeCooldown = Math.max(state.placeCooldown, 0.2)
      return
    }
  } else {
    state.breakPressed = false
  }

  const wantBreak = !modalOpen && (state.attackHeld || touch.breakHeld)
  if (!wantBreak || !hit) {
    state.breakProgress = 0
    state.miningKey = null
    crackMesh.visible = false
    return
  }

  const key = hit.x + ',' + hit.y + ',' + hit.z
  if (state.miningKey !== key) {
    state.miningKey = key
    state.breakProgress = 0
    state.swing = 1
  }

  if (hit.y <= 0) {
    crackMesh.visible = false
    return
  }

  const def = BLOCKS[hit.id]
  if (!def) return
  state.breakProgress += dt / Math.max(0.09, def.hardness * 1.15)
  const stage = Math.min(9, Math.floor(state.breakProgress * 10))
  crackMat.map = crackTextures[stage]
  crackMesh.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5)
  crackMesh.visible = state.breakProgress > 0.06

  if (state.breakProgress >= 1) {
    breakBlock(hit, def)
  }
}

function breakBlock(hit, def) {
  world.setBlock(hit.x, hit.y, hit.z, 0, true)
  particles.burst(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, def.color, 16, 4)
  audio.play('break', def.sound)
  state.breakProgress = 0
  state.miningKey = null
  state.swing = 1
  crackMesh.visible = false
  state.autosave = Math.min(state.autosave, 5)
}

function playerOverlapsBlock(x, y, z) {
  const p = player.position
  const minX = p.x - 0.3
  const maxX = p.x + 0.3
  const minY = p.y
  const maxY = p.y + 1.8
  const minZ = p.z - 0.3
  const maxZ = p.z + 0.3
  return (
    maxX > x + 0.001 &&
    minX < x + 0.999 &&
    maxY > y + 0.001 &&
    minY < y + 0.999 &&
    maxZ > z + 0.001 &&
    minZ < z + 0.999
  )
}

function tryPlace(hit) {
  const id = state.hotbar[state.selected]
  const def = BLOCKS[id]
  if (!def || def.liquid) return
  const x = hit.x + hit.nx
  const y = hit.y + hit.ny
  const z = hit.z + hit.nz
  if (y < 1 || y >= 63) return
  const current = world.getBlock(x, y, z)
  if (current !== 0 && current !== 7 && current !== 13 && current !== 14) return
  if (def.solid && playerOverlapsBlock(x, y, z)) return
  world.setBlock(x, y, z, id, true)
  particles.burst(x + 0.5, y + 0.5, z + 0.5, def.color, 7, 1.7)
  audio.play('place', def.sound)
  state.swing = 1
  state.placeCooldown = 0.2
  state.autosave = Math.min(state.autosave, 5)
}

function updateHeld(dt) {
  if (!heldGroup) return
  const visible = state.mode === 'playing' && !state.inventoryOpen
  heldGroup.visible = visible
  if (!visible) return
  const s = Math.sin((1 - state.swing) * Math.PI * 0.5)
  const bob = player ? Math.sin(player.bobPhase) * 0.012 * player.bobAmount : 0
  const xBase = Math.min(0.72, Math.max(0.2, camera.aspect * 0.46))
  heldGroup.position.set(xBase - (1 - s) * 0.08, -0.44 - s * 0.08 + bob, -1.15 - s * 0.05)
  heldGroup.rotation.set(0.14 + s * 0.25, -0.62 + s * 0.35, 0.12)
}

/* ============================ AMBIENTE ============================ */

const NIGHT = new THREE.Color(0x060c1a)
const DAY_SKY = new THREE.Color(0x7ec0f0)
const DUSK = new THREE.Color(0xef8f55)
const SUN_DAY = new THREE.Color(0xfff3d6)
const SUN_DUSK = new THREE.Color(0xffa45e)
const NIGHT_CLOUD = new THREE.Color(0x39456b)

function updateEnvironment(dt) {
  if (!player) return

  const elev = Math.sin((state.time - 0.25) * Math.PI * 2)
  let day = Math.max(0, Math.min(1, (elev + 0.13) / 0.42))
  day = day * day * (3 - 2 * day)
  const sunset = Math.max(0, Math.min(1, 1 - Math.abs(elev) / 0.3))

  skyColor.copy(NIGHT).lerp(DAY_SKY, day)
  skyColor.lerp(DUSK, sunset * 0.55)
  scene.background.copy(skyColor)
  fogColor.copy(skyColor).lerp(white, 0.12)

  const underwater = state.mode !== 'menu' && player.headInWater
  if (underwater) {
    scene.fog.color.set(0x15558f)
    scene.fog.near = 1.5
    scene.fog.far = 18
    ui.waterTint.style.opacity = '0.52'
  } else {
    scene.fog.color.copy(fogColor)
    const radius = state.mode === 'menu' ? 3 : settings.distance
    const far = Math.max(40, radius * 16 - 5)
    scene.fog.near = far * 0.72
    scene.fog.far = far
    ui.waterTint.style.opacity = '0'
  }

  const tint = tmpColor.copy(nightTint).lerp(dayTint, day)
  for (const mat of [materials.solid, materials.cross, materials.glass, materials.water]) {
    if (mat) mat.color.copy(tint)
  }
  if (materials.water) materials.water.opacity = 0.72 + 0.08 * day

  const cloudTint = tmpColor.copy(white).lerp(NIGHT_CLOUD, 1 - day).lerp(DUSK, sunset * 0.28)
  clouds.setTint(cloudTint)

  const angle = (state.time - 0.25) * Math.PI * 2
  sunDir.set(Math.cos(angle), Math.sin(angle), 0.28).normalize()
  const cam = camera.position
  sunSprite.position.copy(cam).addScaledVector(sunDir, 300)
  moonSprite.position.copy(cam).addScaledVector(sunDir, -300)
  sunSprite.material.opacity = Math.max(0, Math.min(1, (elev + 0.12) / 0.2))
  moonSprite.material.opacity = Math.max(0, Math.min(1, (0.08 - elev) / 0.2))
  stars.position.copy(cam)
  stars.material.opacity = Math.max(0, (1 - day) * 0.85)

  sunLight.position.copy(cam).addScaledVector(sunDir, 130)
  sunLight.target.position.copy(cam)
  sunLight.target.updateMatrixWorld()
  sunLight.intensity = 0.12 + day * 1.05
  sunLight.color.copy(SUN_DAY).lerp(SUN_DUSK, sunset * 0.75)
  hemiLight.intensity = 0.24 + day * 0.55
  ambientLight.intensity = 0.18 + day * 0.26

  waterTexture.offset.x = (waterTexture.offset.x + dt * 0.012) % 1
  waterTexture.offset.y = (waterTexture.offset.y + dt * 0.008) % 1
}

/* ============================ FLUXO DE JOGO ============================ */

function requestLock() {
  if (isTouch) return
  try {
    const maybe = canvas.requestPointerLock()
    if (maybe && maybe.catch) maybe.catch(() => {})
  } catch {
    /* alguns navegadores exigem novo gesto */
  }
}

function startGame() {
  if (!world || !player) return
  audio.init()
  audio.play('click')
  state.mode = 'playing'
  state.autosave = 20
  state.hudTimer = 0
  state.breakProgress = 0
  state.target = null
  state.startedAt = performance.now()
  state.menuAngle = player.yaw + Math.PI

  hide(ui.menu)
  hide(ui.loading)
  hide(ui.pause)
  hide(ui.settings)
  hide(ui.help)
  hide(ui.inventory)
  hide(ui.confirm)
  show(ui.hud)
  if (isTouch) show(ui.touch)
  else hide(ui.touch)

  state.inventoryOpen = false
  state.attackHeld = false
  state.placeHeld = false
  touch.breakHeld = false
  touch.placeHeld = false
  touch.jump = false
  touch.down = false
  keys.clear()

  updateSelectionVisuals()
  updateClockAndHud(true)
  saveGame(false)
  if (!isTouch) requestLock()

  let tutorialSeen = false
  try {
    tutorialSeen = localStorage.getItem(TUTORIAL_KEY) === '1'
  } catch {
    tutorialSeen = true
  }
  if (!tutorialSeen) {
    try {
      localStorage.setItem(TUTORIAL_KEY, '1')
    } catch {
      /* ignora */
    }
    setTimeout(() => {
      showToast(isTouch ? 'Arraste na tela para olhar e use a alavanca para andar.' : 'Use WASD e o mouse para explorar o mundo.', 4200)
    }, 600)
    setTimeout(() => {
      showToast(isTouch ? 'Segure QUEBRAR para minerar e COLOCAR para construir.' : 'Segure o botão esquerdo para quebrar. Use E para o inventário.', 4600)
    }, 3000)
  }
}

function pauseGame() {
  if (state.mode !== 'playing' || state.inventoryOpen) return
  state.mode = 'paused'
  state.attackHeld = false
  state.placeHeld = false
  touch.breakHeld = false
  touch.placeHeld = false
  touch.jump = false
  touch.down = false
  keys.clear()
  updatePauseStats()
  show(ui.pause)
  hide(ui.inventory)
  hide(ui.settings)
  hide(ui.help)
  if (document.pointerLockElement) document.exitPointerLock()
  saveGame(false)
}

function resumeGame() {
  if (state.mode !== 'paused') return
  state.mode = 'playing'
  hide(ui.pause)
  hide(ui.settings)
  hide(ui.help)
  state.autosave = 20
  if (!isTouch) requestLock()
}

function saveAndExit() {
  saveGame(true)
  state.mode = 'menu'
  hide(ui.pause)
  hide(ui.hud)
  hide(ui.touch)
  hide(ui.inventory)
  hide(ui.settings)
  hide(ui.help)
  show(ui.menu)
  state.menuAngle = player ? player.yaw + Math.PI : 0
  updateMenuInfo()
  updateMenuButtonState()
  if (document.pointerLockElement) document.exitPointerLock()
}

function updateMenuButtonState() {
  if (ui.btnPlayTitle) ui.btnPlayTitle.textContent = state.save ? 'CONTINUAR' : 'JOGAR'
  if (ui.btnPlaySub) ui.btnPlaySub.textContent = state.save ? 'continuar de onde parou' : 'explorar um mundo novo'
}

function saveGame(notify = false) {
  if (!world || !player) return
  const data = {
    version: 1,
    seed: state.seed,
    pos: [player.position.x, player.position.y, player.position.z],
    yaw: player.yaw,
    pitch: player.pitch,
    time: state.time,
    day: state.day,
    hotbar: state.hotbar,
    selected: state.selected,
    edits: world.getEditsArray(),
    savedAt: Date.now(),
  }
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data))
    state.save = data
    updateMenuButtonState()
    if (notify) showToast('Mundo salvo neste navegador.')
  } catch {
    showToast('Não foi possível salvar: o armazenamento está cheio.', 3800)
  }
}

async function createNewWorld() {
  hide(ui.confirm)
  hide(ui.menu)
  hide(ui.pause)
  hide(ui.hud)
  hide(ui.touch)
  state.mode = 'loading'
  state.save = null
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch {
    /* ignora */
  }
  const seed = randomSeed()
  await buildWorld(seed, null)
  state.mode = 'menu'
  startGame()
}

function openSettings(returnTo) {
  state.settingsReturn = returnTo
  audio.play('click')
  if (returnTo === 'menu') hide(ui.menu)
  if (returnTo === 'pause') hide(ui.pause)
  show(ui.settings)
  applySettings()
}

function closeSettings() {
  hide(ui.settings)
  if (state.settingsReturn === 'pause') show(ui.pause)
  else show(ui.menu)
}

function openHelp(returnTo) {
  state.helpReturn = returnTo
  audio.play('click')
  if (returnTo === 'menu') hide(ui.menu)
  if (returnTo === 'pause') hide(ui.pause)
  show(ui.help)
}

function closeHelp() {
  hide(ui.help)
  if (state.helpReturn === 'pause') show(ui.pause)
  else show(ui.menu)
}

function openInventory() {
  if (state.mode !== 'playing' || state.inventoryOpen) return
  state.inventoryOpen = true
  state.attackHeld = false
  state.placeHeld = false
  touch.breakHeld = false
  touch.placeHeld = false
  state.suppressPause = true
  show(ui.inventory)
  updateSelectionVisuals()
  if (document.pointerLockElement) document.exitPointerLock()
  setTimeout(() => {
    state.suppressPause = false
  }, 400)
  audio.play('click')
}

function closeInventory() {
  if (!state.inventoryOpen) return
  state.inventoryOpen = false
  hide(ui.inventory)
  if (state.mode === 'playing' && !isTouch) requestLock()
  audio.play('click')
}

function toggleFly() {
  if (!player || state.mode !== 'playing') return
  const flying = player.toggleFly()
  audio.play('fly')
  showToast(flying ? 'Modo voo ativado. Espaço sobe, Ctrl desce.' : 'Modo voo desativado.', 2200)
  ui.touchFly?.classList.toggle('active', flying)
}

function toggleSound() {
  settings.sound = !settings.sound
  audio.init()
  applySettings()
  audio.play('click')
  showToast(settings.sound ? 'Som ligado.' : 'Som desligado.', 1400)
}

/* ============================ EVENTOS ============================ */

function setupEvents() {
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'Tab') e.preventDefault()
    if (e.repeat) return
    keys.add(e.code)

    if (e.code === 'Escape') {
      if (!ui.confirm.classList.contains('hidden')) {
        hide(ui.confirm)
        show(ui.menu)
      } else if (state.inventoryOpen) {
        closeInventory()
      } else if (!ui.settings.classList.contains('hidden')) {
        closeSettings()
      } else if (!ui.help.classList.contains('hidden')) {
        closeHelp()
      } else if (state.mode === 'playing') {
        pauseGame()
      }
      return
    }

    if (state.mode === 'menu') return
    if (state.mode !== 'playing') return
    if (state.inventoryOpen) {
      if (e.code === 'KeyE') closeInventory()
      return
    }

    if (e.code === 'KeyE') {
      openInventory()
      return
    }
    if (e.code === 'KeyF') {
      toggleFly()
      return
    }
    if (e.code === 'Space' && !e.repeat) {
      const now = performance.now()
      if (now - state.lastSpace < 330) {
        toggleFly()
        state.lastSpace = 0
      } else {
        state.lastSpace = now
      }
    }
    if (e.code.startsWith('Digit')) {
      const n = Number(e.code.slice(5))
      if (n >= 1 && n <= 9) selectSlot(n - 1)
    }
  })

  window.addEventListener('keyup', (e) => keys.delete(e.code))
  window.addEventListener('blur', () => {
    keys.clear()
    if (state.mode === 'playing' && !isTouch) pauseGame()
  })

  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === canvas
    if (!locked && state.mode === 'playing' && !isTouch && !state.suppressPause) {
      pauseGame()
    }
  })
  document.addEventListener('pointerlockerror', () => {
    showToast('Não foi possível travar o mouse. Clique na tela e tente de novo.', 3000)
  })

  // mouse
  document.addEventListener('mousemove', (e) => {
    if (state.mode !== 'playing' || state.inventoryOpen) return
    if (isTouch) return
    if (document.pointerLockElement === canvas) {
      player.look2(e.movementX, e.movementY)
    }
  })

  document.addEventListener('mousedown', (e) => {
    if (state.mode !== 'playing' || state.inventoryOpen) return
    if (isTouch) return
    if (document.pointerLockElement !== canvas) return
    if (e.button === 0) {
      state.attackHeld = true
      state.breakPressed = true
      state.swing = 1
    } else if (e.button === 2) {
      state.placeHeld = true
      state.placeCooldown = 0
    }
  })

  document.addEventListener('mouseup', (e) => {
    if (e.button === 0) state.attackHeld = false
    if (e.button === 2) state.placeHeld = false
  })

  document.addEventListener('contextmenu', (e) => e.preventDefault())
  document.addEventListener(
    'wheel',
    (e) => {
      if (state.mode !== 'playing' || state.inventoryOpen) return
      e.preventDefault()
      const dir = e.deltaY > 0 ? 1 : -1
      selectSlot((state.selected + dir + 9) % 9)
    },
    { passive: false },
  )

  canvas.addEventListener('click', () => {
    if (isTouch) return
    if (state.mode === 'playing' && document.pointerLockElement !== canvas) requestLock()
  })

  // toque
  setupTouchControls()

  // menu / botões
  $('btn-play').addEventListener('click', () => startGame())
  $('btn-new').addEventListener('click', () => {
    audio.play('click')
    if (state.save || (world && world.edits.size > 0)) show(ui.confirm)
    else createNewWorld()
  })
  $('btn-help').addEventListener('click', () => openHelp('menu'))
  $('btn-settings').addEventListener('click', () => openSettings('menu'))
  $('btn-help-close').addEventListener('click', closeHelp)
  $('btn-help-ok').addEventListener('click', closeHelp)
  $('btn-settings-close').addEventListener('click', closeSettings)
  $('btn-inventory-close').addEventListener('click', closeInventory)
  $('btn-resume').addEventListener('click', resumeGame)
  $('btn-pause-settings').addEventListener('click', () => openSettings('pause'))
  $('btn-save-exit').addEventListener('click', saveAndExit)
  $('btn-confirm-cancel').addEventListener('click', () => {
    hide(ui.confirm)
    show(ui.menu)
  })
  $('btn-confirm-new').addEventListener('click', () => createNewWorld())
  $('btn-pause').addEventListener('click', pauseGame)
  $('btn-fatal-reload').addEventListener('click', () => location.reload())

  ui.btnSound?.addEventListener('click', toggleSound)
  ui.menuSound?.addEventListener('click', toggleSound)
  $('menu-fullscreen').addEventListener('click', toggleFullscreen)
  $('set-fullscreen').addEventListener('click', toggleFullscreen)

  // sliders
  $('set-distance').addEventListener('input', (e) => {
    settings.distance = Number(e.target.value)
    applySettings()
  })
  $('set-sens').addEventListener('input', (e) => {
    settings.sensitivity = Number(e.target.value)
    applySettings()
  })
  $('set-volume').addEventListener('input', (e) => {
    settings.volume = Number(e.target.value)
    applySettings()
    audio.play('click')
  })
  $('set-sound').addEventListener('change', (e) => {
    settings.sound = e.target.checked
    applySettings()
  })
  $('set-fps').addEventListener('change', (e) => {
    settings.fps = e.target.checked
    applySettings()
    updateClockAndHud(true)
  })
  $('set-bob').addEventListener('change', (e) => {
    settings.bob = e.target.checked
    applySettings()
  })
  $('set-reset').addEventListener('click', () => {
    Object.assign(settings, DEFAULT_SETTINGS)
    applySettings()
    showToast('Ajustes restaurados.', 1800)
  })

  window.addEventListener('beforeunload', () => {
    if (state.mode === 'playing' || state.mode === 'paused') saveGame(false)
  })
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (state.mode === 'playing') {
        saveGame(false)
        if (!isTouch) pauseGame()
      }
    }
  })
}

function toggleFullscreen() {
  const el = document.documentElement
  if (!document.fullscreenElement) {
    const req = el.requestFullscreen?.() || el.webkitRequestFullscreen?.()
    if (req && req.catch) req.catch(() => showToast('Tela cheia não está disponível aqui.', 2000))
  } else {
    document.exitFullscreen?.()
  }
}

function setupTouchControls() {
  const zone = $('joy-zone')
  const base = $('joy-base')
  const knob = $('joy-knob')

  const resetJoystick = () => {
    touch.joyActive = false
    touch.pointerId = null
    touch.forward = 0
    touch.right = 0
    knob.style.transform = 'translate(0px, 0px)'
  }

  const updateJoystick = (clientX, clientY) => {
    const rect = base.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    let dx = clientX - cx
    let dy = clientY - cy
    const max = rect.width * 0.33
    const len = Math.hypot(dx, dy)
    if (len > max) {
      dx = (dx / len) * max
      dy = (dy / len) * max
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`
    touch.forward = -dy / max
    touch.right = dx / max
    if (Math.hypot(touch.forward, touch.right) < 0.08) {
      touch.forward = 0
      touch.right = 0
    }
  }

  zone.addEventListener('pointerdown', (e) => {
    if (state.mode !== 'playing' || state.inventoryOpen) return
    e.preventDefault()
    e.stopPropagation()
    touch.joyActive = true
    touch.pointerId = e.pointerId
    zone.setPointerCapture?.(e.pointerId)
    updateJoystick(e.clientX, e.clientY)
  })
  zone.addEventListener('pointermove', (e) => {
    if (!touch.joyActive || e.pointerId !== touch.pointerId) return
    e.preventDefault()
    updateJoystick(e.clientX, e.clientY)
  })
  const endJoy = (e) => {
    if (e.pointerId === touch.pointerId) resetJoystick()
  }
  zone.addEventListener('pointerup', endJoy)
  zone.addEventListener('pointercancel', endJoy)
  zone.addEventListener('lostpointercapture', () => resetJoystick())

  // olhar arrastando na tela
  canvas.addEventListener('pointerdown', (e) => {
    if (!isTouch || state.mode !== 'playing' || state.inventoryOpen) return
    if (touch.lookId !== null) return
    touch.lookId = e.pointerId
    touch.lastX = e.clientX
    touch.lastY = e.clientY
    canvas.setPointerCapture?.(e.pointerId)
  })
  canvas.addEventListener('pointermove', (e) => {
    if (!isTouch || e.pointerId !== touch.lookId) return
    const dx = e.clientX - touch.lastX
    const dy = e.clientY - touch.lastY
    touch.lastX = e.clientX
    touch.lastY = e.clientY
    player.look2(dx * 1.25, dy * 1.25)
  })
  const endLook = (e) => {
    if (e.pointerId === touch.lookId) touch.lookId = null
  }
  canvas.addEventListener('pointerup', endLook)
  canvas.addEventListener('pointercancel', endLook)

  for (const btn of document.querySelectorAll('#touch-actions [data-act]')) {
    const act = btn.dataset.act
    btn.addEventListener('pointerdown', (e) => {
      if (state.mode !== 'playing' || state.inventoryOpen) return
      e.preventDefault()
      e.stopPropagation()
      btn.classList.add('held')
      btn.setPointerCapture?.(e.pointerId)
      if (act === 'jump') touch.jump = true
      if (act === 'down') touch.down = true
      if (act === 'break') {
        touch.breakHeld = true
        state.breakPressed = true
        state.swing = 1
      }
      if (act === 'place') {
        touch.placeHeld = true
        state.placeCooldown = 0
      }
      if (act === 'fly') toggleFly()
    })
    const release = (e) => {
      e.preventDefault()
      btn.classList.remove('held')
      if (act === 'jump') touch.jump = false
      if (act === 'down') touch.down = false
      if (act === 'break') touch.breakHeld = false
      if (act === 'place') touch.placeHeld = false
    }
    btn.addEventListener('pointerup', release)
    btn.addEventListener('pointercancel', release)
    btn.addEventListener('lostpointercapture', release)
  }

  for (const btn of document.querySelectorAll('#touch-top [data-act]')) {
    const act = btn.dataset.act
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (state.mode !== 'playing') return
      if (act === 'inventory') openInventory()
      if (act === 'pause') pauseGame()
    })
  }
}

/* ============================ BOOT ============================ */

function showFatal(message) {
  hide(ui.loading)
  hide(ui.menu)
  show(ui.fatal)
  const el = $('fatal-message')
  if (el) el.textContent = message
}

async function boot() {
  try {
    setupRenderer()
    setupWorldAssets()
    setupEvents()
    buildHotbar()
    buildInventory()

    if (isTouch) {
      const tip = $('menu-tip')
      if (tip) {
        tip.innerHTML =
          '<b>Dica:</b> arraste na tela para olhar e use a alavanca para andar. Segure <b>QUEBRAR</b> para minerar.'
      }
    }

    const logo = blockIcon(1, 128)
    const logoEl = $('logo-block')
    if (logoEl) logoEl.src = logo
    const loadLogo = $('loading-block')
    if (loadLogo) loadLogo.src = blockIcon(1, 96)

    const save = loadSave()
    const params = new URLSearchParams(location.search)
    const urlSeed = Number(params.get('seed'))
    const seed = save?.seed || (Number.isFinite(urlSeed) && urlSeed > 0 ? Math.floor(urlSeed) : randomSeed())

    state.mode = 'loading'
    show(ui.loading)
    setProgress(3)
    await buildWorld(seed, save)

    state.mode = 'menu'
    show(ui.menu)
    hide(ui.hud)
    hide(ui.touch)
    state.menuAngle = player.yaw + Math.PI
    updateMenuInfo()
    updateMenuButtonState()
    applySettings()
    startLoop()

    const autoPlay = params.get('play') === '1'
    if (params.get('time')) {
      const t = Number(params.get('time'))
      if (Number.isFinite(t)) state.time = ((t % 1) + 1) % 1
    }
    if (autoPlay) {
      startGame()
      if (params.get('yaw')) player.yaw = Number(params.get('yaw'))
      if (params.get('pitch')) player.pitch = Number(params.get('pitch'))
      player.updateCamera()
    }

    // API de depuração/captura
    window.__mundo = {
      state,
      world: () => world,
      player: () => player,
      mobs: () => mobs,
      start: startGame,
      pause: pauseGame,
      menu: saveAndExit,
      save: () => saveGame(true),
      setTime: (t) => {
        state.time = ((t % 1) + 1) % 1
      },
      look: (yaw, pitch) => {
        player.yaw = yaw
        player.pitch = pitch
        player.updateCamera()
      },
      teleport: (x, y, z) => {
        player.setPosition(x, y, z)
      },
      ready: () => world?.isReady(),
    }
  } catch (err) {
    console.error(err)
    showFatal('Não foi possível iniciar o mundo 3D. Verifique se o WebGL está habilitado no seu navegador.')
  }
}

boot()
