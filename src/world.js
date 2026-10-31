import { TAU, mulberry32, randRange, pick, dist, clamp, hash2, roundRect } from './util.js';
import { SHRINE_FRUITS, getFruit, drawFruit, hexA } from './fruits.js';

const ISLAND_DEFS = [
  {
    id: 'dawn',
    name: 'Dawn Isle',
    subtitle: 'Where every legend starts',
    x: 1040,
    y: 1060,
    r: 410,
    biome: 'meadow',
    dockAngle: 0.72,
    seed: 1337,
    safe: true,
  },
  {
    id: 'palm',
    name: 'Palm Cove',
    subtitle: 'Jungle drums and hidden fruit',
    x: 1160,
    y: 2520,
    r: 345,
    biome: 'jungle',
    dockAngle: -1.18,
    seed: 4242,
  },
  {
    id: 'fort',
    name: 'Fort Marina',
    subtitle: 'Marines hold the harbor',
    x: 2760,
    y: 1450,
    r: 440,
    biome: 'fort',
    dockAngle: 2.52,
    seed: 9091,
  },
  {
    id: 'skull',
    name: 'Skull Rock',
    subtitle: 'Captain Morro awaits',
    x: 3170,
    y: 3070,
    r: 395,
    biome: 'volcanic',
    dockAngle: -2.32,
    seed: 6660,
  },
];

const BIOME_COLORS = {
  meadow: {
    grass: '#5fb568',
    grassDark: '#3e8f53',
    grassLight: '#7cc97c',
    sand: '#f2d89e',
    sandDark: '#d6b77a',
    shallow: 'rgba(124, 228, 224, .38)',
    deep: 'rgba(84, 204, 214, .28)',
  },
  jungle: {
    grass: '#3e9b62',
    grassDark: '#27764a',
    grassLight: '#5db977',
    sand: '#ecd095',
    sandDark: '#c9a96e',
    shallow: 'rgba(124, 228, 224, .38)',
    deep: 'rgba(84, 204, 214, .28)',
  },
  fort: {
    grass: '#8ca17f',
    grassDark: '#6d8465',
    grassLight: '#a7b895',
    sand: '#dcc494',
    sandDark: '#b79c6c',
    shallow: 'rgba(124, 228, 224, .34)',
    deep: 'rgba(84, 204, 214, .26)',
  },
  volcanic: {
    grass: '#6d5650',
    grassDark: '#4e3b39',
    grassLight: '#846b5f',
    sand: '#b99a80',
    sandDark: '#8e7059',
    shallow: 'rgba(130, 210, 206, .3)',
    deep: 'rgba(80, 184, 194, .24)',
  },
};

const PALETTES = {
  bandit: { coat: '#b6403d', pants: '#43303a', skin: '#d9a06c', accent: '#f1c14e', hair: '#3a2420' },
  marine: { coat: '#e9eef2', pants: '#2f4a72', skin: '#e0ad7c', accent: '#3d6fb4', hair: '#2a2a30' },
  brute: { coat: '#7a4d34', pants: '#3d2e2c', skin: '#c98f60', accent: '#d9a33d', hair: '#211a1a' },
  boss: { coat: '#2d1e3f', pants: '#1a1225', skin: '#c9d3d9', accent: '#b6303d', hair: '#0f0a14' },
};

export class World {
  constructor() {
    this.size = 4200;
    this.islands = [];
    this.props = [];
    this.npcs = [];
    this.shrines = [];
    this.chests = [];
    this.docks = [];
    this.spawnPoints = [];
    this.time = 0;
    this.build();
    this.buildMinimap();
  }

  build() {
    ISLAND_DEFS.forEach((def) => {
      const rng = mulberry32(def.seed);
      const phase = rng() * TAU;
      const island = {
        ...def,
        phase,
        rng,
        colors: BIOME_COLORS[def.biome],
        points: this.makeBlob(def.x, def.y, def.r, phase, 64),
        grassPoints: this.makeBlob(def.x, def.y, def.r * 0.8, phase + 0.7, 48),
        patches: [],
        paths: [],
        village: { x: def.x + 10, y: def.y - 30 },
      };
      island.dock = this.makeDock(island);
      this.islands.push(island);
      this.buildIsland(island);
    });

    // sort props once so draw order is stable
    this.props.sort((a, b) => a.y - b.y);
  }

  makeBlob(cx, cy, r, phase, steps) {
    const pts = [];
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * TAU;
      const wob = 1 + 0.075 * Math.sin(a * 3 + phase) + 0.045 * Math.sin(a * 5 + phase * 2.3) + 0.022 * Math.sin(a * 9 + phase * 1.7);
      pts.push({ x: cx + Math.cos(a) * r * wob, y: cy + Math.sin(a) * r * wob * 0.94 });
    }
    return pts;
  }

  radiusAt(island, angle) {
    return (
      island.r *
      (1 +
        0.075 * Math.sin(angle * 3 + island.phase) +
        0.045 * Math.sin(angle * 5 + island.phase * 2.3) +
        0.022 * Math.sin(angle * 9 + island.phase * 1.7))
    );
  }

  makeDock(island) {
    const a = island.dockAngle;
    const rad = this.radiusAt(island, a);
    const inner = { x: island.x + Math.cos(a) * (rad - 14), y: island.y + Math.sin(a) * (rad - 14) * 0.94 };
    const outer = { x: island.x + Math.cos(a) * (rad + 78), y: island.y + Math.sin(a) * (rad + 78) * 0.94 };
    const boat = { x: island.x + Math.cos(a) * (rad + 128), y: island.y + Math.sin(a) * (rad + 128) * 0.94 };
    return { x: inner.x, y: inner.y, outerX: outer.x, outerY: outer.y, angle: a, boat, islandId: island.id };
  }

  buildIsland(island) {
    const rng = mulberry32(island.seed + 77);
    const c = island.colors;

    // colour patches on the grass
    for (let i = 0; i < 11; i++) {
      const a = rng() * TAU;
      const d = Math.sqrt(rng()) * island.r * 0.66;
      island.patches.push({
        x: island.x + Math.cos(a) * d,
        y: island.y + Math.sin(a) * d * 0.94,
        rx: randRange(rng, 30, 95),
        ry: randRange(rng, 18, 55),
        rot: rng() * TAU,
        dark: rng() < 0.55,
      });
    }

    const v = island.village;
    const dock = island.dock;
    const reserved = [
      { x: v.x, y: v.y, r: 115 },
      { x: dock.x, y: dock.y, r: 85 },
      { x: dock.outerX, y: dock.outerY, r: 60 },
    ];

    // path from dock into the village
    const midX = (dock.x + v.x) / 2 + Math.sin(island.phase) * 35;
    const midY = (dock.y + v.y) / 2 + Math.cos(island.phase) * 25;
    island.paths.push({ x1: dock.x, y1: dock.y, cx: midX, cy: midY, x2: v.x, y2: v.y });

    this.docks.push(dock);

    if (island.id === 'dawn') {
      this.buildVillage(island, reserved, rng);
    } else if (island.id === 'fort') {
      this.buildFort(island, reserved, rng);
    } else if (island.id === 'skull') {
      this.buildSkull(island, reserved, rng);
    } else {
      this.buildPalmCove(island, reserved, rng);
    }

    // shrine
    const shrineOffsets = { palm: { x: 30, y: -55 }, fort: { x: -35, y: 70 }, skull: { x: 50, y: 10 } };
    const so = shrineOffsets[island.id];
    if (so) {
      const shrine = {
        type: 'shrine',
        x: island.x + so.x,
        y: island.y + so.y,
        islandId: island.id,
        fruitId: SHRINE_FRUITS[island.id],
        claimed: false,
        bob: rng() * TAU,
      };
      this.shrines.push(shrine);
      reserved.push({ x: shrine.x, y: shrine.y, r: 80 });
    }

    // treasure chest
    const chestSpots = {
      dawn: { x: 210, y: 150 },
      palm: { x: -150, y: 120 },
      fort: { x: 150, y: -130 },
      skull: { x: -140, y: -120 },
    };
    const cs = chestSpots[island.id];
    const chest = {
      type: 'chest',
      x: island.x + cs.x,
      y: island.y + cs.y,
      islandId: island.id,
      opened: false,
      bob: rng() * TAU,
      berries: 70 + Math.floor(rng() * 50) + (island.id === 'skull' ? 120 : island.id === 'fort' ? 60 : 0),
    };
    this.chests.push(chest);
    reserved.push({ x: chest.x, y: chest.y, r: 60 });

    // ambient props
    const palmCount = island.biome === 'meadow' ? 15 : island.biome === 'jungle' ? 24 : island.biome === 'fort' ? 7 : 5;
    for (let i = 0; i < palmCount; i++) this.scatterProp(island, island.biome === 'volcanic' ? 'deadTree' : 'palm', reserved, rng, 0.2, 0.82);
    const rockCount = island.biome === 'volcanic' ? 16 : 10;
    for (let i = 0; i < rockCount; i++) this.scatterProp(island, 'rock', reserved, rng, 0.18, 0.82);
    for (let i = 0; i < 13; i++) this.scatterProp(island, 'bush', reserved, rng, 0.2, 0.78);
    for (let i = 0; i < 18; i++) this.scatterProp(island, 'flower', reserved, rng, 0.15, 0.8, true);

    if (island.biome === 'volcanic') {
      for (let i = 0; i < 5; i++) this.scatterProp(island, 'lava', reserved, rng, 0.2, 0.7, true);
    }

    // enemy spawn points
    const spawnPlan = {
      dawn: [
        ['bandit', 1, 5],
        ['bandit', 2, 2],
      ],
      palm: [
        ['bandit', 4, 4],
        ['bandit', 5, 2],
        ['brute', 6, 1],
      ],
      fort: [
        ['marine', 7, 5],
        ['marine', 8, 3],
        ['brute', 8, 1],
      ],
      skull: [
        ['marine', 11, 3],
        ['brute', 11, 2],
      ],
    };
    const spawnReserved = [...reserved, { x: v.x, y: v.y, r: 200 }];
    for (const [kind, level, count] of spawnPlan[island.id] || []) {
      for (let i = 0; i < count; i++) {
        const spot = this.findLandSpot(island, spawnReserved, rng, 0.3, 0.8);
        if (spot) this.spawnPoints.push({ kind, level, x: spot.x, y: spot.y, islandId: island.id });
      }
    }

    if (island.id === 'skull') {
      this.spawnPoints.push({
        kind: 'boss',
        level: 12,
        x: island.x + 10,
        y: island.y - 90,
        islandId: 'skull',
      });
    }
  }

  buildVillage(island, reserved, rng) {
    const v = island.village;
    const huts = [
      { x: v.x - 75, y: v.y - 55, scale: 1.05, rot: -0.12 },
      { x: v.x + 85, y: v.y - 20, scale: 0.92, rot: 0.18 },
      { x: v.x + 5, y: v.y - 125, scale: 1.15, rot: 0 },
    ];
    for (const h of huts) {
      this.addProp('hut', h.x, h.y, { scale: h.scale, rot: h.rot, islandId: island.id });
      reserved.push({ x: h.x, y: h.y, r: 65 });
    }
    this.addProp('campfire', v.x - 5, v.y + 20, { scale: 1, islandId: island.id });
    this.addProp('banner', v.x - 150, v.y + 35, { scale: 1, islandId: island.id });
    this.addProp('crate', v.x + 135, v.y + 45, { scale: 1, islandId: island.id });
    this.addProp('barrel', v.x + 160, v.y + 24, { scale: 1, islandId: island.id });
    this.addProp('crate', v.x - 120, v.y + 70, { scale: 0.8, islandId: island.id });
    this.addProp('sign', island.dock.x + 20, island.dock.y - 35, { scale: 1, islandId: island.id, label: 'DAWN ISLE' });

    this.npcs.push({
      type: 'npc',
      id: 'rhea',
      name: 'Captain Rhea',
      x: v.x + 55,
      y: v.y + 62,
      islandId: 'dawn',
      role: 'quest',
      color: { coat: '#7a4fa8', pants: '#35284a', skin: '#e3ae7d', accent: '#f0c14b', hair: '#4a2f1d' },
      bob: rng() * TAU,
    });
    this.npcs.push({
      type: 'npc',
      id: 'marlow',
      name: 'Old Marlow',
      x: v.x - 65,
      y: v.y + 88,
      islandId: 'dawn',
      role: 'shop',
      color: { coat: '#3d8a76', pants: '#3a3b33', skin: '#c98f60', accent: '#e2d3a2', hair: '#d9d9d9' },
      bob: rng() * TAU,
    });
    reserved.push({ x: v.x + 55, y: v.y + 62, r: 45 }, { x: v.x - 65, y: v.y + 88, r: 45 });
  }

  buildPalmCove(island, reserved, rng) {
    const v = island.village;
    this.addProp('hut', v.x - 30, v.y - 60, { scale: 0.95, rot: 0.1, islandId: island.id, ruined: true });
    this.addProp('crate', v.x + 40, v.y - 20, { scale: 0.9, islandId: island.id });
    this.addProp('sign', island.dock.x + 25, island.dock.y - 40, { scale: 1, islandId: island.id, label: 'PALM COVE' });
    this.addProp('campfire', v.x + 15, v.y + 15, { scale: 0.85, islandId: island.id });
    reserved.push({ x: v.x, y: v.y, r: 95 });
  }

  buildFort(island, reserved, rng) {
    const v = island.village;
    this.addProp('tower', v.x - 95, v.y - 40, { scale: 1.15, islandId: island.id });
    this.addProp('tower', v.x + 100, v.y - 25, { scale: 1.15, islandId: island.id });
    this.addProp('banner', v.x, v.y - 95, { scale: 1.15, islandId: island.id, marine: true });
    this.addProp('crate', v.x - 20, v.y + 35, { scale: 1, islandId: island.id });
    this.addProp('crate', v.x + 30, v.y + 50, { scale: 0.9, islandId: island.id });
    this.addProp('barrel', v.x + 65, v.y + 20, { scale: 1, islandId: island.id });
    this.addProp('sign', island.dock.x + 25, island.dock.y - 40, { scale: 1, islandId: island.id, label: 'FORT MARINA' });
    reserved.push({ x: v.x, y: v.y, r: 120 });
  }

  buildSkull(island, reserved, rng) {
    const v = island.village;
    this.addProp('pillar', v.x - 80, v.y - 40, { scale: 1.1, islandId: island.id });
    this.addProp('pillar', v.x + 85, v.y - 10, { scale: 0.9, islandId: island.id });
    this.addProp('bones', v.x + 5, v.y + 45, { scale: 1.3, islandId: island.id });
    this.addProp('bones', v.x - 140, v.y + 80, { scale: 0.9, islandId: island.id });
    this.addProp('banner', v.x, v.y - 120, { scale: 1.2, islandId: island.id, dark: true });
    this.addProp('sign', island.dock.x + 25, island.dock.y - 40, { scale: 1, islandId: island.id, label: 'SKULL ROCK' });
    reserved.push({ x: v.x, y: v.y, r: 100 });
  }

  addProp(type, x, y, opts = {}) {
    this.props.push({
      type,
      x,
      y,
      scale: opts.scale ?? 1,
      rot: opts.rot ?? 0,
      islandId: opts.islandId,
      label: opts.label,
      ruined: opts.ruined,
      marine: opts.marine,
      dark: opts.dark,
      seed: (x * 13 + y * 7) % 1000,
    });
  }

  scatterProp(island, type, reserved, rng, minR, maxR, flat = false) {
    const spot = this.findLandSpot(island, reserved, rng, minR, maxR);
    if (!spot) return;
    const scale = randRange(rng, 0.75, 1.25);
    this.addProp(type, spot.x, spot.y, { scale, rot: rng() * TAU, islandId: island.id });
    if (type === 'palm') reserved.push({ x: spot.x, y: spot.y, r: 26 });
  }

  findLandSpot(island, reserved, rng, minR = 0.2, maxR = 0.82) {
    for (let tries = 0; tries < 40; tries++) {
      const a = rng() * TAU;
      const d = (minR + Math.sqrt(rng()) * (maxR - minR)) * island.r;
      const x = island.x + Math.cos(a) * d;
      const y = island.y + Math.sin(a) * d * 0.94;
      if (dist(x, y, island.x, island.y) > island.r * maxR + 20) continue;
      if (!this.isLand(x, y)) continue;
      let blocked = false;
      for (const r of reserved) {
        if (dist(x, y, r.x, r.y) < r.r + 18) {
          blocked = true;
          break;
        }
      }
      if (!blocked) return { x, y };
    }
    return null;
  }

  isLand(x, y) {
    for (const island of this.islands) {
      const dx = x - island.x;
      const dy = (y - island.y) / 0.94;
      const d = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      if (d < this.radiusAt(island, a) - 8) return island;
    }
    return null;
  }

  islandAt(x, y) {
    return this.isLand(x, y);
  }

  isWater(x, y) {
    return !this.isLand(x, y);
  }

  safeZoneAt(x, y) {
    const dawn = this.islands.find((i) => i.id === 'dawn');
    if (!dawn) return false;
    return dist(x, y, dawn.village.x, dawn.village.y) < 190;
  }

  nearestShore(island, x, y) {
    const a = Math.atan2((y - island.y) / 0.94, x - island.x);
    const rad = this.radiusAt(island, a);
    return {
      x: island.x + Math.cos(a) * (rad - 26),
      y: island.y + Math.sin(a) * (rad - 26) * 0.94,
      angle: a,
    };
  }

  nearestDock(x, y) {
    let best = null;
    let bestD = 120;
    for (const dock of this.docks) {
      const d = dist(x, y, dock.outerX, dock.outerY);
      if (d < bestD) {
        bestD = d;
        best = dock;
      }
    }
    return best;
  }

  update(dt) {
    this.time += dt;
  }

  drawOcean(ctx, cam, w, h, time) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0a4667');
    g.addColorStop(0.55, '#0e5f83');
    g.addColorStop(1, '#0a4a6b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    cam.apply(ctx);
    const z = cam.zoom;
    const left = cam.x - w / (2 * z) - 120;
    const right = cam.x + w / (2 * z) + 120;
    const top = cam.y - h / (2 * z) - 120;
    const bottom = cam.y + h / (2 * z) + 120;

    // broad, slow swells
    ctx.strokeStyle = 'rgba(90, 200, 220, .07)';
    ctx.lineWidth = 18;
    for (let y = Math.floor(top / 340) * 340; y < bottom; y += 340) {
      ctx.beginPath();
      const off = Math.sin(time * 0.22 + y * 0.004) * 60;
      ctx.moveTo(left, y + off);
      ctx.bezierCurveTo(left + (right - left) * 0.3, y - 30 + off, left + (right - left) * 0.7, y + 30 + off, right, y + off);
      ctx.stroke();
    }

    // little animated wave crests
    const stepX = 118;
    const stepY = 88;
    ctx.lineWidth = 2;
    for (let gy = Math.floor(top / stepY) * stepY; gy < bottom; gy += stepY) {
      for (let gx = Math.floor(left / stepX) * stepX; gx < right; gx += stepX) {
        const hsh = hash2(gx, gy);
        if (hsh < 0.28) continue;
        const off = Math.sin(time * 1.05 + gx * 0.013 + gy * 0.019) * 9;
        ctx.globalAlpha = 0.07 + hsh * 0.09;
        ctx.strokeStyle = '#b8f0ff';
        ctx.beginPath();
        ctx.moveTo(gx + off, gy);
        ctx.quadraticCurveTo(gx + 22 + off, gy - 7, gx + 44 + off, gy);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    // sparkles
    for (let gy = Math.floor(top / 260) * 260; gy < bottom; gy += 260) {
      for (let gx = Math.floor(left / 260) * 260; gx < right; gx += 260) {
        const hsh = hash2(gx + 9, gy + 31);
        if (hsh < 0.5) continue;
        const tw = Math.sin(time * 2 + hsh * 20) * 0.5 + 0.5;
        ctx.globalAlpha = 0.12 + tw * 0.25;
        ctx.fillStyle = '#dffbff';
        const sx = gx + hsh * 200;
        const sy = gy + hash2(gy, gx) * 200;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.4 + tw, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // foam halos
    for (const island of this.islands) {
      if (island.x + island.r < left || island.x - island.r > right || island.y + island.r < top || island.y - island.r > bottom) continue;
      ctx.save();
      ctx.strokeStyle = 'rgba(210, 252, 255, .32)';
      ctx.lineWidth = 7;
      ctx.setLineDash([22, 34]);
      ctx.lineDashOffset = -time * 24;
      this.polyPath(ctx, island.points, 30);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.18)';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 26]);
      ctx.lineDashOffset = time * 16;
      this.polyPath(ctx, island.points, 14);
      ctx.stroke();
      ctx.restore();
    }
    cam.restore(ctx);
  }

  polyPath(ctx, pts, expand = 0) {
    let cx = 0;
    let cy = 0;
    for (const p of pts) {
      cx += p.x;
      cy += p.y;
    }
    cx /= pts.length;
    cy /= pts.length;
    const k = expand ? 1 + expand / Math.max(40, Math.hypot(cx - pts[0].x, cy - pts[0].y)) : 1;
    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = cx + (p.x - cx) * k;
      const y = cy + (p.y - cy) * k;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
  }

  drawIslands(ctx, cam, w, h, time) {
    cam.apply(ctx);
    const z = cam.zoom;
    const left = cam.x - w / (2 * z) - 200;
    const right = cam.x + w / (2 * z) + 200;
    const top = cam.y - h / (2 * z) - 200;
    const bottom = cam.y + h / (2 * z) + 200;

    for (const island of this.islands) {
      if (island.x + island.r < left || island.x - island.r > right || island.y + island.r < top || island.y - island.r > bottom) continue;
      const c = island.colors;
      ctx.save();

      // shallow shelf
      this.polyPath(ctx, island.points, 46);
      ctx.fillStyle = c.deep;
      ctx.fill();
      this.polyPath(ctx, island.points, 22);
      ctx.fillStyle = c.shallow;
      ctx.fill();

      // sand
      const sg = ctx.createRadialGradient(island.x - island.r * 0.25, island.y - island.r * 0.3, island.r * 0.1, island.x, island.y, island.r * 1.1);
      sg.addColorStop(0, c.sand);
      sg.addColorStop(0.7, c.sand);
      sg.addColorStop(1, c.sandDark);
      this.polyPath(ctx, island.points);
      ctx.fillStyle = sg;
      ctx.fill();
      ctx.strokeStyle = 'rgba(120, 90, 50, .25)';
      ctx.lineWidth = 3;
      ctx.stroke();

      // grass
      const gg = ctx.createRadialGradient(island.x - island.r * 0.2, island.y - island.r * 0.25, island.r * 0.1, island.x, island.y, island.r * 0.95);
      gg.addColorStop(0, c.grassLight);
      gg.addColorStop(0.55, c.grass);
      gg.addColorStop(1, c.grassDark);
      this.polyPath(ctx, island.grassPoints);
      ctx.fillStyle = gg;
      ctx.fill();
      ctx.strokeStyle = 'rgba(30, 70, 40, .18)';
      ctx.lineWidth = 5;
      ctx.stroke();

      // mottled patches
      for (const p of island.patches) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = p.dark ? 0.16 : 0.12;
        ctx.fillStyle = p.dark ? c.grassDark : c.grassLight;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.rx, p.ry, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }

      // sandy path
      for (const path of island.paths) {
        ctx.strokeStyle = c.sand;
        ctx.globalAlpha = 0.92;
        ctx.lineWidth = 26;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(path.x1, path.y1);
        ctx.quadraticCurveTo(path.cx, path.cy, path.x2, path.y2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(150, 110, 60, .2)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 12]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      // beach speckles
      for (let i = 0; i < 46; i++) {
        const a = (i / 46) * TAU + island.phase;
        const rad = this.radiusAt(island, a) * (0.84 + hash2(i, island.seed) * 0.13);
        const x = island.x + Math.cos(a) * rad;
        const y = island.y + Math.sin(a) * rad * 0.94;
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = c.sandDark;
        ctx.beginPath();
        ctx.arc(x, y, 1.6 + hash2(i, 3) * 1.8, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // fort plaza
      if (island.id === 'fort') {
        const v = island.village;
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#b3b8a4';
        ctx.beginPath();
        ctx.ellipse(v.x, v.y, 150, 118, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(70,70,60,.25)';
        ctx.lineWidth = 2;
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(v.x - 140, v.y + i * 36);
          ctx.lineTo(v.x + 140, v.y + i * 36);
          ctx.stroke();
        }
        ctx.restore();
      }

      // skull rock lava glow
      if (island.id === 'skull') {
        for (let i = 0; i < 7; i++) {
          const a = island.phase + i * 0.9;
          const d = island.r * (0.3 + hash2(i, 7) * 0.45);
          const x = island.x + Math.cos(a) * d;
          const y = island.y + Math.sin(a) * d * 0.94;
          const glow = 0.4 + Math.sin(time * 2 + i) * 0.2;
          const grd = ctx.createRadialGradient(x, y, 2, x, y, 28);
          grd.addColorStop(0, `rgba(255, 128, 48, ${0.5 * glow})`);
          grd.addColorStop(1, 'rgba(255, 80, 30, 0)');
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(x, y, 28, 0, TAU);
          ctx.fill();
        }
      }

      // dock
      this.drawDock(ctx, island.dock, time);

      ctx.restore();
    }
    cam.restore(ctx);
  }

  drawDock(ctx, dock, time) {
    ctx.save();
    ctx.translate(dock.x, dock.y);
    ctx.rotate(dock.angle);
    const len = 92;
    ctx.fillStyle = 'rgba(20, 30, 40, .18)';
    ctx.fillRect(4, -15, len + 8, 36);
    for (let i = 0; i < 9; i++) {
      const shade = i % 2 ? '#a9743d' : '#b98248';
      ctx.fillStyle = shade;
      ctx.fillRect((i / 9) * len, -14, len / 9 + 1, 28);
      ctx.strokeStyle = 'rgba(80, 45, 20, .5)';
      ctx.lineWidth = 1;
      ctx.strokeRect((i / 9) * len, -14, len / 9 + 1, 28);
    }
    ctx.fillStyle = '#7c5127';
    ctx.fillRect(0, -18, 5, 36);
    ctx.fillRect(len - 5, -18, 5, 36);
    ctx.fillStyle = '#6b4423';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(8 + i * 26, -18, 6, 6);
      ctx.fillRect(8 + i * 26, 12, 6, 6);
    }
    ctx.restore();
  }

  /** Returns everything that needs painter's-algorithm sorting with the player. */
  collectDrawables(time) {
    const list = [];
    for (const p of this.props) {
      if (p.type === 'flower' || p.type === 'lava') continue;
      list.push({ y: p.y, kind: 'prop', ref: p });
    }
    for (const s of this.shrines) list.push({ y: s.y, kind: 'shrine', ref: s });
    for (const c of this.chests) list.push({ y: c.y, kind: 'chest', ref: c });
    for (const n of this.npcs) list.push({ y: n.y, kind: 'npc', ref: n });
    return list;
  }

  drawFlat(ctx, time) {
    // tiny flat decorations drawn under everything
    for (const p of this.props) {
      if (p.type === 'flower') {
        ctx.fillStyle = p.seed % 2 ? '#f7d75a' : '#f4f0e6';
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.2 * p.scale, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (p.type === 'lava') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        const glow = 0.6 + Math.sin(time * 2.4 + p.seed) * 0.25;
        ctx.fillStyle = `rgba(255, 104, 38, ${0.55 * glow})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, 30 * p.scale, 9 * p.scale, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = `rgba(255, 210, 90, ${0.75 * glow})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, 16 * p.scale, 4 * p.scale, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  drawProp(ctx, p, time) {
    switch (p.type) {
      case 'palm':
        this.drawPalm(ctx, p, time);
        break;
      case 'deadTree':
        this.drawDeadTree(ctx, p, time);
        break;
      case 'rock':
        this.drawRock(ctx, p);
        break;
      case 'bush':
        this.drawBush(ctx, p, time);
        break;
      case 'crate':
        this.drawCrate(ctx, p);
        break;
      case 'barrel':
        this.drawBarrel(ctx, p);
        break;
      case 'hut':
        this.drawHut(ctx, p, time);
        break;
      case 'tower':
        this.drawTower(ctx, p, time);
        break;
      case 'banner':
        this.drawBanner(ctx, p, time);
        break;
      case 'campfire':
        this.drawCampfire(ctx, p, time);
        break;
      case 'sign':
        this.drawSign(ctx, p);
        break;
      case 'pillar':
        this.drawPillar(ctx, p);
        break;
      case 'bones':
        this.drawBones(ctx, p);
        break;
      default:
        break;
    }
  }

  shadow(ctx, x, y, rx, ry) {
    ctx.fillStyle = 'rgba(15, 30, 35, .22)';
    ctx.beginPath();
    ctx.ellipse(x, y + 2, rx, ry, 0, 0, TAU);
    ctx.fill();
  }

  drawPalm(ctx, p, time) {
    const s = p.scale;
    ctx.save();
    ctx.translate(p.x, p.y);
    this.shadow(ctx, 8 * s, 3, 26 * s, 10 * s);
    const sway = Math.sin(time * 1.4 + p.seed) * 0.06;
    ctx.rotate(sway);
    // trunk
    ctx.strokeStyle = '#8a5b2f';
    ctx.lineWidth = 9 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(5 * s, -36 * s, -2 * s, -74 * s);
    ctx.stroke();
    ctx.strokeStyle = '#a9743d';
    ctx.lineWidth = 4 * s;
    ctx.beginPath();
    ctx.moveTo(-2 * s, -4);
    ctx.quadraticCurveTo(3 * s, -36 * s, -4 * s, -72 * s);
    ctx.stroke();
    // fronds
    const top = { x: -2 * s, y: -74 * s };
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + Math.sin(time * 1.2 + p.seed) * 0.04;
      const len = (30 + (i % 2) * 9) * s;
      ctx.save();
      ctx.translate(top.x, top.y);
      ctx.rotate(a);
      const grad = ctx.createLinearGradient(0, 0, len, 0);
      grad.addColorStop(0, '#2f7d43');
      grad.addColorStop(1, '#63b86a');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(len * 0.55, -11 * s, len, 3 * s);
      ctx.quadraticCurveTo(len * 0.55, 9 * s, 0, 0);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#6b4423';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(top.x + Math.cos(i * 2.2) * 5 * s, top.y + Math.sin(i * 2.2) * 4 * s, 3 * s, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  drawDeadTree(ctx, p, time) {
    const s = p.scale;
    ctx.save();
    ctx.translate(p.x, p.y);
    this.shadow(ctx, 5, 2, 20 * s, 7 * s);
    ctx.strokeStyle = '#3e302c';
    ctx.lineWidth = 7 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(1 * s, -42 * s);
    ctx.stroke();
    ctx.lineWidth = 4 * s;
    for (let i = 0; i < 4; i++) {
      const y = -20 - i * 8;
      const dir = i % 2 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(1 * s, y * s);
      ctx.lineTo(dir * (16 + i * 2) * s, (y - 12) * s);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawRock(ctx, p) {
    const s = p.scale;
    ctx.save();
    ctx.translate(p.x, p.y);
    this.shadow(ctx, 3, 2, 20 * s, 7 * s);
    ctx.rotate(p.rot);
    ctx.fillStyle = '#7b7d7c';
    ctx.beginPath();
    ctx.moveTo(-18 * s, 2 * s);
    ctx.lineTo(-12 * s, -15 * s);
    ctx.lineTo(2 * s, -21 * s);
    ctx.lineTo(16 * s, -12 * s);
    ctx.lineTo(20 * s, 2 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#9da09c';
    ctx.beginPath();
    ctx.moveTo(-12 * s, -15 * s);
    ctx.lineTo(2 * s, -21 * s);
    ctx.lineTo(8 * s, -10 * s);
    ctx.lineTo(-5 * s, -7 * s);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(45,50,50,.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(2 * s, -21 * s);
    ctx.lineTo(4 * s, -7 * s);
    ctx.lineTo(16 * s, -12 * s);
    ctx.stroke();
    ctx.restore();
  }

  drawBush(ctx, p, time) {
    const s = p.scale;
    ctx.save();
    ctx.translate(p.x, p.y);
    this.shadow(ctx, 2, 2, 18 * s, 6 * s);
    const sway = Math.sin(time * 1.7 + p.seed) * 1.2;
    ctx.fillStyle = '#2f7a45';
    ctx.beginPath();
    ctx.arc(-9 * s + sway, -6 * s, 11 * s, 0, TAU);
    ctx.arc(8 * s + sway, -7 * s, 12 * s, 0, TAU);
    ctx.arc(0, -14 * s, 12 * s, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#4f9c5c';
    ctx.beginPath();
    ctx.arc(-4 * s + sway, -15 * s, 7 * s, 0, TAU);
    ctx.arc(8 * s + sway, -11 * s, 6 * s, 0, TAU);
    ctx.fill();
    if (p.seed % 3 === 0) {
      ctx.fillStyle = '#e85f6a';
      ctx.beginPath();
      ctx.arc(-8 * s, -8 * s, 2.4 * s, 0, TAU);
      ctx.arc(7 * s, -13 * s, 2.2 * s, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  drawCrate(ctx, p) {
    const s = p.scale;
    ctx.save();
    ctx.translate(p.x, p.y);
    this.shadow(ctx, 2, 2, 18 * s, 7 * s);
    ctx.fillStyle = '#a9743d';
    ctx.fillRect(-14 * s, -25 * s, 28 * s, 25 * s);
    ctx.fillStyle = '#c08b4d';
    ctx.fillRect(-14 * s, -25 * s, 28 * s, 6 * s);
    ctx.strokeStyle = '#6b4423';
    ctx.lineWidth = 2;
    ctx.strokeRect(-14 * s, -25 * s, 28 * s, 25 * s);
    ctx.beginPath();
    ctx.moveTo(-14 * s, -25 * s);
    ctx.lineTo(14 * s, 0);
    ctx.moveTo(14 * s, -25 * s);
    ctx.lineTo(-14 * s, 0);
    ctx.stroke();
    ctx.restore();
  }

  drawBarrel(ctx, p) {
    const s = p.scale;
    ctx.save();
    ctx.translate(p.x, p.y);
    this.shadow(ctx, 2, 2, 15 * s, 6 * s);
    ctx.fillStyle = '#8a5b2f';
    ctx.beginPath();
    ctx.ellipse(0, -14 * s, 12 * s, 15 * s, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#a9743d';
    ctx.beginPath();
    ctx.ellipse(-2 * s, -16 * s, 8 * s, 11 * s, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#4a321e';
    ctx.lineWidth = 2.5;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.ellipse(0, -14 * s + i * 8 * s, 12 * s, 3.5 * s, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawHut(ctx, p, time) {
    const s = p.scale;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    this.shadow(ctx, 4, 4, 38 * s, 14 * s);
    // walls
    ctx.fillStyle = p.ruined ? '#9a825c' : '#d8b47a';
    ctx.fillRect(-30 * s, -44 * s, 60 * s, 44 * s);
    ctx.fillStyle = p.ruined ? '#846f4e' : '#c6a068';
    ctx.fillRect(-30 * s, -44 * s, 60 * s, 8 * s);
    ctx.strokeStyle = 'rgba(70,45,20,.35)';
    ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 12 * s, -36 * s);
      ctx.lineTo(i * 12 * s, 0);
      ctx.stroke();
    }
    // roof
    ctx.fillStyle = p.ruined ? '#6f4a32' : '#a8503c';
    ctx.beginPath();
    ctx.moveTo(-38 * s, -44 * s);
    ctx.lineTo(0, -72 * s);
    ctx.lineTo(38 * s, -44 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.beginPath();
    ctx.moveTo(-38 * s, -44 * s);
    ctx.lineTo(0, -72 * s);
    ctx.lineTo(0, -44 * s);
    ctx.closePath();
    ctx.fill();
    // door
    ctx.fillStyle = '#5a3a1d';
    ctx.fillRect(-8 * s, -28 * s, 16 * s, 28 * s);
    ctx.fillStyle = '#e0b75f';
    ctx.beginPath();
    ctx.arc(4 * s, -14 * s, 1.8 * s, 0, TAU);
    ctx.fill();
    // window
    if (!p.ruined) {
      ctx.fillStyle = '#8fd3e8';
      ctx.fillRect(-23 * s, -33 * s, 10 * s, 10 * s);
      ctx.strokeStyle = '#5a3a1d';
      ctx.strokeRect(-23 * s, -33 * s, 10 * s, 10 * s);
      ctx.beginPath();
      ctx.moveTo(-18 * s, -33 * s);
      ctx.lineTo(-18 * s, -23 * s);
      ctx.moveTo(-23 * s, -28 * s);
      ctx.lineTo(-13 * s, -28 * s);
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(60,40,20,.6)';
      ctx.beginPath();
      ctx.moveTo(-30 * s, -44 * s);
      ctx.lineTo(-20 * s, -30 * s);
      ctx.lineTo(-27 * s, -16 * s);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawTower(ctx, p, time) {
    const s = p.scale;
    ctx.save();
    ctx.translate(p.x, p.y);
    this.shadow(ctx, 4, 3, 30 * s, 12 * s);
    ctx.fillStyle = '#b8b6a4';
    ctx.fillRect(-24 * s, -78 * s, 48 * s, 78 * s);
    ctx.fillStyle = '#d2cfbc';
    ctx.fillRect(-24 * s, -78 * s, 14 * s, 78 * s);
    ctx.strokeStyle = 'rgba(70,70,60,.3)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(-24 * s, -70 * s + i * 14 * s);
      ctx.lineTo(24 * s, -70 * s + i * 14 * s);
      ctx.stroke();
    }
    // battlements
    ctx.fillStyle = '#a3a08e';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(-24 * s + i * 14 * s, -90 * s, 9 * s, 12 * s);
    }
    // door and window
    ctx.fillStyle = '#4b4234';
    ctx.beginPath();
    ctx.moveTo(-9 * s, 0);
    ctx.lineTo(-9 * s, -26 * s);
    ctx.arc(0, -26 * s, 9 * s, Math.PI, 0);
    ctx.lineTo(9 * s, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f2c14e';
    ctx.fillRect(-4 * s, -58 * s, 8 * s, 12 * s);
    // flag
    ctx.strokeStyle = '#6b5b45';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -90 * s);
    ctx.lineTo(0, -118 * s);
    ctx.stroke();
    ctx.fillStyle = '#3d6fb4';
    ctx.beginPath();
    ctx.moveTo(0, -118 * s);
    ctx.quadraticCurveTo(16 * s, -112 * s + Math.sin(time * 2 + p.seed) * 3, 30 * s, -116 * s);
    ctx.lineTo(30 * s, -104 * s);
    ctx.quadraticCurveTo(16 * s, -100 * s + Math.sin(time * 2 + p.seed) * 3, 0, -104 * s);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawBanner(ctx, p, time) {
    const s = p.scale;
    ctx.save();
    ctx.translate(p.x, p.y);
    this.shadow(ctx, 2, 2, 12 * s, 4 * s);
    ctx.strokeStyle = '#6b4a2c';
    ctx.lineWidth = 4 * s;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -74 * s);
    ctx.stroke();
    const col = p.dark ? '#6f1f2a' : p.marine ? '#2f5f9e' : '#b8873b';
    const col2 = p.dark ? '#2a1018' : p.marine ? '#173a66' : '#7a4d1d';
    const wave = Math.sin(time * 2.2 + p.seed) * 4;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(2 * s, -72 * s);
    ctx.quadraticCurveTo(26 * s, -68 * s + wave, 46 * s, -70 * s);
    ctx.lineTo(40 * s, -42 * s);
    ctx.quadraticCurveTo(24 * s, -44 * s + wave, 2 * s, -40 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = col2;
    ctx.beginPath();
    ctx.arc(22 * s, -56 * s, 7 * s, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  drawCampfire(ctx, p, time) {
    const s = p.scale;
    ctx.save();
    ctx.translate(p.x, p.y);
    this.shadow(ctx, 2, 2, 20 * s, 7 * s);
    ctx.strokeStyle = '#5a3a1d';
    ctx.lineWidth = 5 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-12 * s, 0);
    ctx.lineTo(12 * s, -4 * s);
    ctx.moveTo(-12 * s, -4 * s);
    ctx.lineTo(12 * s, 0);
    ctx.stroke();
    const flick = Math.sin(time * 9 + p.seed) * 3;
    const grd = ctx.createRadialGradient(0, -12 * s, 2, 0, -12 * s, 40 * s);
    grd.addColorStop(0, 'rgba(255, 196, 90, .35)');
    grd.addColorStop(1, 'rgba(255, 120, 40, 0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(0, -12 * s, 40 * s, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ff8a3d';
    ctx.beginPath();
    ctx.moveTo(-7 * s, -6 * s);
    ctx.quadraticCurveTo(-10 * s + flick, -22 * s, 0, -30 * s - flick * 0.4);
    ctx.quadraticCurveTo(9 * s + flick, -19 * s, 7 * s, -6 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffd86b';
    ctx.beginPath();
    ctx.moveTo(-3 * s, -7 * s);
    ctx.quadraticCurveTo(-4 * s, -16 * s, 1 * s, -21 * s);
    ctx.quadraticCurveTo(5 * s, -13 * s, 3 * s, -7 * s);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawSign(ctx, p) {
    const s = p.scale;
    ctx.save();
    ctx.translate(p.x, p.y);
    this.shadow(ctx, 2, 2, 14 * s, 5 * s);
    ctx.strokeStyle = '#6b4a2c';
    ctx.lineWidth = 4 * s;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -40 * s);
    ctx.stroke();
    ctx.fillStyle = '#a9743d';
    ctx.beginPath();
    ctx.moveTo(-4 * s, -42 * s);
    ctx.lineTo(54 * s, -42 * s);
    ctx.lineTo(64 * s, -33 * s);
    ctx.lineTo(54 * s, -24 * s);
    ctx.lineTo(-4 * s, -24 * s);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,35,15,.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#3c2915';
    ctx.font = `bold ${9 * s}px "Trebuchet MS", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(p.label || 'ISLE', 28 * s, -30 * s);
    ctx.restore();
  }

  drawPillar(ctx, p) {
    const s = p.scale;
    ctx.save();
    ctx.translate(p.x, p.y);
    this.shadow(ctx, 3, 2, 18 * s, 6 * s);
    ctx.fillStyle = '#8a7a6a';
    ctx.fillRect(-12 * s, -58 * s, 24 * s, 58 * s);
    ctx.fillStyle = '#a39380';
    ctx.fillRect(-12 * s, -58 * s, 9 * s, 58 * s);
    ctx.fillStyle = '#6f6154';
    ctx.fillRect(-16 * s, -64 * s, 32 * s, 8 * s);
    ctx.strokeStyle = 'rgba(40,30,25,.35)';
    ctx.beginPath();
    ctx.moveTo(-6 * s, -48 * s);
    ctx.lineTo(4 * s, -36 * s);
    ctx.lineTo(-3 * s, -20 * s);
    ctx.stroke();
    ctx.restore();
  }

  drawBones(ctx, p) {
    const s = p.scale;
    ctx.save();
    ctx.translate(p.x, p.y);
    this.shadow(ctx, 2, 2, 20 * s, 7 * s);
    ctx.fillStyle = '#ddd6c4';
    ctx.beginPath();
    ctx.ellipse(0, -8 * s, 9 * s, 8 * s, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#3a322c';
    ctx.beginPath();
    ctx.arc(-3.5 * s, -9 * s, 2 * s, 0, TAU);
    ctx.arc(3.5 * s, -9 * s, 2 * s, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#cfc7b4';
    ctx.lineWidth = 3 * s;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-14 * s, 0 + i * 3 * s);
      ctx.quadraticCurveTo(0, -2 * s + i * 3 * s, 15 * s, 1 + i * 3 * s);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawShrine(ctx, s, time) {
    const claimed = s.claimed;
    ctx.save();
    ctx.translate(s.x, s.y);
    this.shadow(ctx, 3, 3, 34, 13);
    // dais
    ctx.fillStyle = claimed ? '#5b5c58' : '#7d807b';
    ctx.beginPath();
    ctx.ellipse(0, 0, 34, 17, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = claimed ? '#6b6c68' : '#9a9d96';
    ctx.beginPath();
    ctx.ellipse(0, -5, 30, 14, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = claimed ? 'rgba(180,180,170,.15)' : 'rgba(255, 240, 180, .35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -5, 22, 10, 0, 0, TAU);
    ctx.stroke();
    // small obelisk
    ctx.fillStyle = claimed ? '#565754' : '#858983';
    ctx.fillRect(-5, -30, 10, 26);
    ctx.fillStyle = claimed ? '#676863' : '#a2a69e';
    ctx.fillRect(-5, -30, 4, 26);
    if (!claimed) {
      const bob = Math.sin(time * 2.2 + s.bob) * 5;
      const fruit = getFruit(s.fruitId);
      // beam
      const beam = ctx.createLinearGradient(0, -100, 0, -20);
      beam.addColorStop(0, hexA(fruit.colors.glow, 0));
      beam.addColorStop(0.55, hexA(fruit.colors.glow, 0.16));
      beam.addColorStop(1, hexA(fruit.colors.glow, 0.04));
      ctx.fillStyle = beam;
      ctx.fillRect(-24, -120, 48, 100);
      drawFruit(ctx, 0, -52 + bob, 15, fruit, time, true);
      // sparkles
      for (let i = 0; i < 4; i++) {
        const a = time * 1.4 + i * 1.6;
        ctx.globalAlpha = 0.5 + Math.sin(a * 2) * 0.3;
        ctx.fillStyle = fruit.colors.a;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 26, -52 + Math.sin(a) * 18 + bob, 2, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  drawChest(ctx, c, time) {
    ctx.save();
    ctx.translate(c.x, c.y);
    this.shadow(ctx, 2, 2, 22, 8);
    if (!c.opened) {
      const glow = 0.5 + Math.sin(time * 2.5 + c.bob) * 0.2;
      const grd = ctx.createRadialGradient(0, -12, 2, 0, -12, 40);
      grd.addColorStop(0, `rgba(255, 214, 100, ${0.24 * glow})`);
      grd.addColorStop(1, 'rgba(255, 214, 100, 0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(0, -12, 40, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#8a5b2f';
    ctx.fillRect(-18, -22, 36, 22);
    ctx.fillStyle = '#a9743d';
    ctx.fillRect(-18, -22, 36, 7);
    ctx.strokeStyle = '#5a3a1d';
    ctx.lineWidth = 2;
    ctx.strokeRect(-18, -22, 36, 22);
    if (c.opened) {
      ctx.save();
      ctx.translate(-18, -22);
      ctx.rotate(-0.9);
      ctx.fillStyle = '#a9743d';
      ctx.fillRect(0, -8, 36, 8);
      ctx.strokeRect(0, -8, 36, 8);
      ctx.restore();
      ctx.fillStyle = 'rgba(30,20,10,.35)';
      ctx.fillRect(-15, -19, 30, 4);
    } else {
      ctx.fillStyle = '#e2b74e';
      ctx.fillRect(-3, -18, 6, 9);
      ctx.fillStyle = '#5a3a1d';
      ctx.fillRect(-1.5, -16, 3, 5);
    }
    ctx.restore();
  }

  drawNPC(ctx, npc, time) {
    const c = npc.color;
    const bob = Math.sin(time * 2 + npc.bob) * 1.5;
    ctx.save();
    ctx.translate(npc.x, npc.y + bob);
    this.shadow(ctx, 0, 2, 16, 6);
    const walk = Math.sin(time * 1.3 + npc.bob) * 1.5;
    // legs
    ctx.fillStyle = c.pants;
    ctx.fillRect(-8, -18, 7, 18);
    ctx.fillRect(2, -18, 7, 18);
    // coat
    ctx.fillStyle = c.coat;
    roundRect(ctx, -12, -42, 24, 27, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.14)';
    ctx.fillRect(-12, -42, 7, 27);
    // arms
    ctx.fillStyle = c.coat;
    ctx.fillRect(-16, -39 + walk, 5, 17);
    ctx.fillRect(11, -39 - walk, 5, 17);
    // sash
    ctx.fillStyle = c.accent;
    ctx.fillRect(-12, -26, 24, 4);
    // head
    ctx.fillStyle = c.skin;
    roundRect(ctx, -9, -62, 18, 20, 4);
    ctx.fill();
    ctx.fillStyle = c.hair;
    ctx.fillRect(-9, -63, 18, 5);
    ctx.fillRect(-10, -60, 3, 8);
    ctx.fillRect(7, -60, 3, 8);
    // eyes
    ctx.fillStyle = '#2a2230';
    ctx.fillRect(-4, -54, 2, 3);
    ctx.fillRect(2, -54, 2, 3);
    // hat
    if (npc.id === 'rhea') {
      ctx.fillStyle = c.coat;
      ctx.beginPath();
      ctx.ellipse(0, -64, 17, 5, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = c.coat;
      ctx.beginPath();
      ctx.moveTo(-8, -64);
      ctx.quadraticCurveTo(0, -78, 8, -64);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = c.accent;
      ctx.fillRect(-8, -65, 16, 3);
      // feather
      ctx.strokeStyle = '#f3e7c3';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(9, -67);
      ctx.quadraticCurveTo(19, -78, 13, -82);
      ctx.stroke();
    } else {
      ctx.fillStyle = c.hair;
      ctx.beginPath();
      ctx.ellipse(0, -63, 11, 5, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = c.accent;
      ctx.fillRect(-10, -64, 20, 3);
    }
    ctx.restore();

    if (npc.role === 'quest' && npc.showMarker) {
      const bob2 = Math.sin(time * 3) * 3;
      ctx.save();
      ctx.translate(npc.x, npc.y - 92 + bob2);
      ctx.fillStyle = '#f2c14e';
      ctx.strokeStyle = 'rgba(60,35,10,.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#3c2915';
      ctx.font = 'bold 17px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', 0, 1);
      ctx.restore();
    }
  }

  drawBoat(ctx, x, y, angle, time, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI / 2);
    ctx.scale(scale, scale);
    const bob = Math.sin(time * 2.4) * 1.5;
    ctx.translate(0, bob);
    ctx.fillStyle = 'rgba(10, 30, 40, .25)';
    ctx.beginPath();
    ctx.ellipse(0, 8, 24, 38, 0, 0, TAU);
    ctx.fill();
    // hull
    ctx.fillStyle = '#8a5b2f';
    ctx.beginPath();
    ctx.moveTo(0, -42);
    ctx.quadraticCurveTo(23, -18, 18, 26);
    ctx.quadraticCurveTo(0, 42, -18, 26);
    ctx.quadraticCurveTo(-23, -18, 0, -42);
    ctx.fill();
    ctx.strokeStyle = '#5a3a1d';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = '#c08b4d';
    ctx.beginPath();
    ctx.moveTo(0, -34);
    ctx.quadraticCurveTo(15, -14, 12, 20);
    ctx.quadraticCurveTo(0, 30, -12, 20);
    ctx.quadraticCurveTo(-15, -14, 0, -34);
    ctx.fill();
    ctx.fillStyle = '#5a3a1d';
    ctx.beginPath();
    ctx.ellipse(0, 2, 8, 18, 0, 0, TAU);
    ctx.fill();
    // mast + sail
    ctx.fillStyle = '#6b4a2c';
    ctx.fillRect(-2, -56, 4, 72);
    const wave = Math.sin(time * 3) * 2;
    ctx.fillStyle = '#f3ead4';
    ctx.beginPath();
    ctx.moveTo(2, -54);
    ctx.quadraticCurveTo(28, -36 + wave, 22, 4);
    ctx.lineTo(2, 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,100,70,.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#e05a4a';
    ctx.beginPath();
    ctx.moveTo(2, -56);
    ctx.lineTo(16, -52);
    ctx.lineTo(2, -48);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  buildMinimap() {
    const size = 256;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0c567a';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#0a4667';
    for (let i = 0; i < 60; i++) {
      const x = hash2(i, 4) * size;
      const y = hash2(4, i) * size;
      ctx.fillRect(x, y, 1, 1);
    }
    const k = size / this.size;
    for (const island of this.islands) {
      ctx.save();
      ctx.translate(island.x * k, island.y * k);
      ctx.scale(k, k * 0.94);
      ctx.beginPath();
      island.points.forEach((p, i) => {
        const x = p.x - island.x;
        const y = p.y - island.y;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fillStyle = '#e8cf97';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.35)';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, island.r * 0.66, 0, TAU);
      ctx.fillStyle = island.biome === 'volcanic' ? '#6d5650' : island.biome === 'fort' ? '#8ca17f' : '#4a9d5f';
      ctx.fill();
      ctx.restore();
    }
    this.minimapCanvas = c;
  }
}

export { ISLAND_DEFS };
