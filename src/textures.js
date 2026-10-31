import * as THREE from '../vendor/three.module.js';

const cache = new Map();

function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeTexture(key, w, h, draw, opts = {}) {
  if (cache.has(key)) return cache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  draw(ctx, w, h, rng(opts.seed || 1));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if (opts.repeat) tex.repeat.set(opts.repeat[0], opts.repeat[1]);
  if (opts.clamp) { tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; }
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
}

function noise(ctx, w, h, count, alpha, rand, light = false) {
  for (let i = 0; i < count; i++) {
    const x = rand() * w, y = rand() * h;
    const s = 0.4 + rand() * 1.8;
    ctx.fillStyle = light
      ? `rgba(255,255,255,${alpha * (0.4 + rand())})`
      : `rgba(0,0,0,${alpha * (0.4 + rand())})`;
    ctx.fillRect(x, y, s, s);
  }
}

function stain(ctx, w, h, rand, color = 'rgba(45,32,18,0.18)', count = 5) {
  for (let i = 0; i < count; i++) {
    const x = rand() * w, y = rand() * h;
    const r = 20 + rand() * 100;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(0.6, color.replace(/[\d.]+\)$/, '0.06)'));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

/* ------------------------------------------------------------------ */
/* Hotel surfaces                                                      */
/* ------------------------------------------------------------------ */

const WALLPAPERS = [
  { base: '#b7a17a', stripe: '#ab9470', motif: '#8f7853', dark: '#8a7350' },
  { base: '#7e8a74', stripe: '#74806b', motif: '#5c6a58', dark: '#55614f' },
  { base: '#9a7d74', stripe: '#8e7168', motif: '#755a52', dark: '#6b5149' },
  { base: '#5d7472', stripe: '#536a68', motif: '#405856', dark: '#3a4e4c' },
  { base: '#5b6478', stripe: '#525b6d', motif: '#414a5c', dark: '#394152' },
];

export function wallpaper(variant = 0) {
  const p = WALLPAPERS[variant % WALLPAPERS.length];
  return makeTexture(`wall-${variant}`, 512, 512, (ctx, w, h, rand) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, p.base);
    g.addColorStop(0.5, p.base);
    g.addColorStop(1, p.dark);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // subtle vertical stripes
    ctx.fillStyle = p.stripe;
    for (let x = 0; x < w; x += 64) {
      ctx.globalAlpha = 0.34;
      ctx.fillRect(x, 0, 26, h);
    }
    ctx.globalAlpha = 1;

    // damask motifs
    ctx.strokeStyle = p.motif;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.4;
    for (let y = 40; y < h; y += 128) {
      for (let x = 32; x < w; x += 128) {
        const cx = x + ((y / 128) % 2) * 64;
        ctx.beginPath();
        ctx.moveTo(cx, y - 26);
        ctx.bezierCurveTo(cx + 22, y - 6, cx + 20, y + 14, cx, y + 28);
        ctx.bezierCurveTo(cx - 20, y + 14, cx - 22, y - 6, cx, y - 26);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, y, 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 16, y + 2);
        ctx.quadraticCurveTo(cx, y + 16, cx + 16, y + 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    noise(ctx, w, h, 2600, 0.06, rand);
    stain(ctx, w, h, rand, 'rgba(40,26,12,0.2)', 6);
    // water streaks
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#22170c';
    for (let i = 0; i < 8; i++) {
      const x = rand() * w;
      ctx.fillRect(x, rand() * h * 0.4, 1 + rand() * 3, 60 + rand() * 180);
    }
    ctx.globalAlpha = 1;
  }, { repeat: [2.4, 1.6], seed: variant + 11 });
}

export function carpet(variant = 0) {
  const bases = ['#542c2a', '#2f4034', '#3b3348', '#4b3320', '#2c3b44'];
  const base = bases[variant % bases.length];
  return makeTexture(`carpet-${variant}`, 512, 512, (ctx, w, h, rand) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w / 2, h / 2, 30, w / 2, h / 2, w * 0.7);
    g.addColorStop(0, 'rgba(255,255,255,0.05)');
    g.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // diamond lattice
    ctx.strokeStyle = 'rgba(210,185,130,0.10)';
    ctx.lineWidth = 1.4;
    for (let y = -64; y < h + 64; y += 64) {
      for (let x = -64; x < w + 64; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x, y + 32);
        ctx.lineTo(x + 32, y);
        ctx.lineTo(x + 64, y + 32);
        ctx.lineTo(x + 32, y + 64);
        ctx.closePath();
        ctx.stroke();
      }
    }

    noise(ctx, w, h, 9000, 0.16, rand, true);
    noise(ctx, w, h, 9000, 0.22, rand);
    stain(ctx, w, h, rand, 'rgba(0,0,0,0.3)', 5);
  }, { repeat: [5, 4], seed: variant + 31 });
}

export function wood(tone = 'dark') {
  const tones = {
    dark: ['#2a1a10', '#3b2617', '#1a0f09'],
    warm: ['#4a2d19', '#613c21', '#2c1a0e'],
    pale: ['#7a5a38', '#8d6a44', '#543a24'],
  };
  const [mid, light, dark] = tones[tone] || tones.dark;
  return makeTexture(`wood-${tone}`, 512, 512, (ctx, w, h, rand) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, dark);
    g.addColorStop(0.4, mid);
    g.addColorStop(0.7, light);
    g.addColorStop(1, mid);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 120; i++) {
      const x = rand() * w;
      ctx.strokeStyle = `rgba(${rand() > 0.5 ? '0,0,0' : '255,220,170'},${0.03 + rand() * 0.09})`;
      ctx.lineWidth = 0.5 + rand() * 2.2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      for (let y = 0; y < h; y += 24) {
        ctx.lineTo(x + Math.sin(y * 0.02 + i) * (2 + rand() * 5), y);
      }
      ctx.stroke();
    }
    // knots
    for (let i = 0; i < 5; i++) {
      const x = rand() * w, y = rand() * h;
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.lineWidth = 1.5;
      for (let r = 3; r < 16; r += 4) {
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.5, rand(), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    noise(ctx, w, h, 1800, 0.05, rand);
  }, { repeat: [1, 1], seed: 7 });
}

export function ceiling() {
  return makeTexture('ceiling', 512, 512, (ctx, w, h, rand) => {
    ctx.fillStyle = '#b9b1a0';
    ctx.fillRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.75);
    g.addColorStop(0, 'rgba(255,255,255,0.06)');
    g.addColorStop(1, 'rgba(40,34,24,0.34)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // panel seams
    ctx.strokeStyle = 'rgba(60,50,36,0.18)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= w; i += 128) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke();
    }
    stain(ctx, w, h, rand, 'rgba(64,48,24,0.22)', 8);
    noise(ctx, w, h, 2200, 0.07, rand);
    // cracks
    ctx.strokeStyle = 'rgba(40,32,22,0.2)';
    for (let i = 0; i < 6; i++) {
      let x = rand() * w, y = rand() * h;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let j = 0; j < 7; j++) { x += (rand() - 0.5) * 40; y += rand() * 24; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  }, { repeat: [2, 2], seed: 19 });
}

export function painting(seed = 1) {
  const variant = seed % 4;
  return makeTexture(`painting-${variant}-${seed % 7}`, 384, 512, (ctx, w, h, rand) => {
    ctx.fillStyle = '#17120d';
    ctx.fillRect(0, 0, w, h);
    if (variant === 0) {
      // moonlit landscape
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#101a22');
      sky.addColorStop(0.55, '#2c3a3b');
      sky.addColorStop(1, '#171a14');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(230,220,185,0.9)';
      ctx.beginPath(); ctx.arc(w * 0.68, h * 0.24, 32, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(15,20,18,0.95)';
      ctx.beginPath(); ctx.moveTo(0, h * 0.7);
      for (let x = 0; x <= w; x += 24) ctx.lineTo(x, h * 0.7 - Math.sin(x * 0.02 + 1) * 36 - rand() * 18);
      ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();
      ctx.fillStyle = '#0b0d0a';
      ctx.beginPath(); ctx.moveTo(0, h * 0.83);
      for (let x = 0; x <= w; x += 18) ctx.lineTo(x, h * 0.83 - Math.sin(x * 0.035) * 14);
      ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();
      // tiny lit house
      ctx.fillStyle = '#0a0a08'; ctx.fillRect(w * 0.18, h * 0.72, 44, 30);
      ctx.fillStyle = 'rgba(240,190,90,0.85)'; ctx.fillRect(w * 0.2, h * 0.75, 7, 8);
    } else if (variant === 1) {
      // pale portrait
      const bg = ctx.createRadialGradient(w / 2, h * 0.38, 20, w / 2, h * 0.38, w * 0.8);
      bg.addColorStop(0, '#3c352b');
      bg.addColorStop(1, '#0d0b09');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#b9a98b';
      ctx.beginPath();
      ctx.ellipse(w / 2, h * 0.4, w * 0.17, h * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1510';
      ctx.beginPath(); ctx.ellipse(w * 0.45, h * 0.37, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w * 0.55, h * 0.37, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(30,22,16,0.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(w * 0.46, h * 0.47); ctx.quadraticCurveTo(w * 0.5, h * 0.49, w * 0.54, h * 0.47); ctx.stroke();
      ctx.fillStyle = '#14110d';
      ctx.beginPath();
      ctx.moveTo(w * 0.22, h); ctx.lineTo(w * 0.3, h * 0.64); ctx.lineTo(w * 0.7, h * 0.64); ctx.lineTo(w * 0.78, h); ctx.fill();
    } else if (variant === 2) {
      // abstract
      ctx.fillStyle = '#24110d'; ctx.fillRect(0, 0, w, h);
      const cols = ['#6e2b22', '#a56b35', '#2e3b3a', '#c9a961', '#1a1110'];
      for (let i = 0; i < 14; i++) {
        ctx.fillStyle = cols[Math.floor(rand() * cols.length)];
        ctx.globalAlpha = 0.4 + rand() * 0.5;
        const x = rand() * w, y = rand() * h;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (rand() - 0.3) * 220, y + (rand() - 0.5) * 90);
        ctx.lineTo(x + (rand() - 0.5) * 180, y + (rand() - 0.5) * 200);
        ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else {
      // still life
      ctx.fillStyle = '#14120d'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#3b2a18'; ctx.fillRect(0, h * 0.7, w, h * 0.3);
      ctx.fillStyle = '#6e5a35';
      ctx.beginPath(); ctx.ellipse(w * 0.5, h * 0.72, 46, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8a7445'; ctx.fillRect(w * 0.46, h * 0.45, 30, h * 0.28);
      ctx.fillStyle = '#4a2c1a';
      ctx.beginPath(); ctx.moveTo(w * 0.4, h * 0.45); ctx.lineTo(w * 0.5, h * 0.34); ctx.lineTo(w * 0.6, h * 0.45); ctx.fill();
      ctx.strokeStyle = '#6d7a52'; ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath(); ctx.moveTo(w * 0.5, h * 0.45);
        ctx.quadraticCurveTo(w * (0.4 + rand() * 0.2), h * (0.2 + rand() * 0.15), w * (0.35 + rand() * 0.3), h * (0.16 + rand() * 0.16));
        ctx.stroke();
      }
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = ['#7d2f2a', '#c9a961', '#d9c9a0'][i % 3];
        ctx.beginPath(); ctx.arc(w * (0.3 + rand() * 0.4), h * (0.16 + rand() * 0.2), 5 + rand() * 7, 0, Math.PI * 2); ctx.fill();
      }
    }
    // craquelure + grime
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 0.7;
    for (let i = 0; i < 14; i++) {
      let x = rand() * w, y = rand() * h;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let j = 0; j < 4; j++) { x += (rand() - 0.5) * 28; y += (rand() - 0.5) * 28; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(0, 0, w, 10); ctx.fillRect(0, h - 10, w, 10);
  }, { clamp: true, seed });
}

export function books(seed = 1) {
  return makeTexture(`books-${seed % 5}`, 512, 512, (ctx, w, h, rand) => {
    ctx.fillStyle = '#160f09';
    ctx.fillRect(0, 0, w, h);
    const colors = ['#5a2b24', '#3c4a3a', '#4b3b56', '#6a5330', '#2c3d4a', '#5e3b2a', '#7a6a45', '#3d2b24'];
    const rowH = 64;
    for (let row = 0; row < h / rowH; row++) {
      let x = 2;
      const baseY = row * rowH + rowH - 4;
      while (x < w - 4) {
        const bw = 9 + rand() * 18;
        const bh = rowH * (0.55 + rand() * 0.36);
        const c = colors[Math.floor(rand() * colors.length)];
        ctx.fillStyle = c;
        ctx.fillRect(x, baseY - bh, bw - 1, bh);
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(x + bw - 3, baseY - bh, 2, bh);
        ctx.fillStyle = 'rgba(230,205,150,0.35)';
        ctx.fillRect(x + 2, baseY - bh + 7, bw - 6, 2);
        ctx.fillRect(x + 2, baseY - bh + 13, bw - 8, 1);
        if (rand() > 0.7) {
          ctx.fillStyle = 'rgba(220,200,160,0.28)';
          ctx.fillRect(x + 2, baseY - bh * 0.55, bw - 5, 3);
        }
        x += bw;
      }
      // shelf board shadow
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, baseY, w, 4);
    }
    noise(ctx, w, h, 1400, 0.08, rand);
  }, { clamp: true, seed: seed + 5 });
}

export function plaque(number, label = '') {
  const text = String(number).padStart(2, '0');
  return makeTexture(`plaque-${text}-${label}`, 256, 128, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#e6cf94');
    g.addColorStop(0.35, '#b9954f');
    g.addColorStop(0.7, '#8b6b31');
    g.addColorStop(1, '#c9a961');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(60,42,18,0.8)';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.strokeStyle = 'rgba(255,240,200,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(15, 15, w - 30, h - 30);
    ctx.fillStyle = '#2b1d0c';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 62px Georgia, serif';
    ctx.fillText(text, w / 2, h / 2 + (label ? -8 : 2));
    if (label) {
      ctx.font = '500 12px "Courier New", monospace';
      ctx.letterSpacing = '3px';
      ctx.fillText(label, w / 2, h - 24);
    }
    // patina
    ctx.fillStyle = 'rgba(70,50,20,0.18)';
    for (let i = 0; i < 22; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      ctx.beginPath(); ctx.arc(x, y, Math.random() * 6, 0, Math.PI * 2); ctx.fill();
    }
  }, { clamp: true });
}

export function exitSign() {
  return makeTexture('exit-sign', 256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#0a1410';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(120,220,160,0.7)';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = '#b9f0c9';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 54px "Courier New", monospace';
    ctx.letterSpacing = '6px';
    ctx.fillText('EXIT', w / 2, h / 2 + 2);
    ctx.shadowColor = '#6fe09a';
    ctx.shadowBlur = 18;
    ctx.fillText('EXIT', w / 2, h / 2 + 2);
  }, { clamp: true });
}

export function sign(text, color = '#d8c79c', bg = '#0b0a08') {
  return makeTexture(`sign-${text}-${color}-${bg}`, 512, 128, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '500 42px Georgia, serif';
    ctx.fillText(text, w / 2, h / 2 + 2);
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.globalAlpha = 0.5;
    ctx.fillText(text, w / 2, h / 2 + 2);
  }, { clamp: true });
}

export function face(kind = 'rush') {
  return makeTexture(`face-${kind}`, 256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    if (kind === 'figure') {
      // two narrow eyes only
      ctx.shadowColor = '#fff'; ctx.shadowBlur = 26;
      ctx.fillStyle = '#fffdf2';
      ctx.beginPath(); ctx.ellipse(w * 0.34, h * 0.48, 26, 11, -0.12, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w * 0.66, h * 0.48, 26, 11, 0.12, 0, Math.PI * 2); ctx.fill();
      return;
    }
    if (kind === 'seek') {
      // giant eye
      const bg = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
      bg.addColorStop(0, 'rgba(120,10,10,0.9)');
      bg.addColorStop(0.7, 'rgba(30,0,0,0.9)');
      bg.addColorStop(1, 'rgba(0,0,0,0.98)');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#e9e2d0';
      ctx.beginPath(); ctx.ellipse(w / 2, h / 2, 96, 58, 0, 0, Math.PI * 2); ctx.fill();
      const iris = ctx.createRadialGradient(w / 2, h / 2, 6, w / 2, h / 2, 48);
      iris.addColorStop(0, '#ffb0a0'); iris.addColorStop(0.4, '#b32218'); iris.addColorStop(1, '#3a0505');
      ctx.fillStyle = iris;
      ctx.beginPath(); ctx.arc(w / 2, h / 2, 46, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#050202';
      ctx.beginPath(); ctx.arc(w / 2, h / 2, 20, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.arc(w * 0.46, h * 0.43, 7, 0, Math.PI * 2); ctx.fill();
      // surrounding eyes
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + 0.2;
        const x = w / 2 + Math.cos(a) * (100 + (i % 3) * 10);
        const y = h / 2 + Math.sin(a) * (74 + (i % 2) * 10);
        ctx.fillStyle = 'rgba(240,225,200,0.85)';
        ctx.beginPath(); ctx.ellipse(x, y, 9, 5, a, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#8d1712';
        ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill();
      }
      return;
    }
    const pale = kind === 'halt' ? '#cfe8ec' : kind === 'ambush' ? '#e8eef0' : '#efe9d6';
    const dark = kind === 'halt' ? 'rgba(10,30,38,0.9)' : '#0b0908';
    ctx.shadowColor = kind === 'halt' ? '#7fd8e8' : '#fff';
    ctx.shadowBlur = 30;
    ctx.fillStyle = pale;
    // head shape
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.08);
    ctx.bezierCurveTo(w * 0.83, h * 0.1, w * 0.9, h * 0.34, w * 0.82, h * 0.6);
    ctx.bezierCurveTo(w * 0.76, h * 0.86, w * 0.62, h * 0.95, w * 0.5, h * 0.95);
    ctx.bezierCurveTo(w * 0.38, h * 0.95, w * 0.24, h * 0.86, w * 0.18, h * 0.6);
    ctx.bezierCurveTo(w * 0.1, h * 0.34, w * 0.17, h * 0.1, w * 0.5, h * 0.08);
    ctx.fill();
    ctx.shadowBlur = 0;
    // eyes
    ctx.fillStyle = dark;
    const eyeY = h * 0.4;
    ctx.beginPath(); ctx.ellipse(w * 0.36, eyeY, w * 0.11, h * 0.09, -0.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w * 0.64, eyeY, w * 0.11, h * 0.09, 0.1, 0, Math.PI * 2); ctx.fill();
    if (kind === 'halt') {
      ctx.fillStyle = '#bff4ff';
      ctx.beginPath(); ctx.arc(w * 0.36, eyeY, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(w * 0.64, eyeY, 5, 0, Math.PI * 2); ctx.fill();
    }
    // grin
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(w * 0.29, h * 0.64);
    ctx.quadraticCurveTo(w * 0.5, h * 0.82, w * 0.71, h * 0.64);
    ctx.quadraticCurveTo(w * 0.5, h * 0.72, w * 0.29, h * 0.64);
    ctx.fill();
    // teeth
    ctx.fillStyle = pale;
    for (let i = 0; i < 7; i++) {
      const x = w * 0.32 + i * (w * 0.36 / 7);
      ctx.fillRect(x, h * 0.655, w * 0.035, h * 0.045);
    }
    if (kind === 'halt') {
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#0b2830';
      for (let y = 0; y < h; y += 6) ctx.fillRect(0, y, w, 2);
      ctx.globalAlpha = 1;
    }
  }, { clamp: true });
}

export function glow() {
  return makeTexture('glow-white', 128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.18, 'rgba(255,255,255,0.78)');
    g.addColorStop(0.48, 'rgba(255,255,255,0.2)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, { clamp: true });
}

export function dust() {
  return makeTexture('dust', 64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,245,220,0.9)');
    g.addColorStop(0.5, 'rgba(255,240,200,0.25)');
    g.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, { clamp: true });
}

export function tablecloth() {
  return makeTexture('tablecloth', 512, 512, (ctx, w, h, rand) => {
    ctx.fillStyle = '#4a1d1b';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(201,169,97,0.22)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      ctx.strokeRect(20 + i * 18, 20 + i * 18, w - 40 - i * 36, h - 40 - i * 36);
    }
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#c9a961';
    for (let y = 60; y < h - 40; y += 90) {
      for (let x = 60; x < w - 40; x += 90) {
        ctx.beginPath();
        ctx.moveTo(x, y - 12); ctx.lineTo(x + 12, y); ctx.lineTo(x, y + 12); ctx.lineTo(x - 12, y);
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    noise(ctx, w, h, 1600, 0.09, rand);
  }, { repeat: [1, 1], seed: 3 });
}

export function elevator() {
  return makeTexture('elevator', 512, 512, (ctx, w, h, rand) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#3b3c3a');
    g.addColorStop(0.18, '#6a6c66');
    g.addColorStop(0.5, '#8b8d85');
    g.addColorStop(0.82, '#5c5e58');
    g.addColorStop(1, '#333431');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 240; i++) {
      const x = rand() * w;
      ctx.strokeStyle = `rgba(${rand() > 0.5 ? '255,255,255' : '0,0,0'},${0.02 + rand() * 0.06})`;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(w / 2 - 3, 0, 6, h);
    ctx.strokeStyle = 'rgba(20,20,18,0.6)';
    ctx.strokeRect(12, 12, w - 24, h - 24);
    noise(ctx, w, h, 2400, 0.05, rand);
  }, { clamp: true, seed: 2 });
}

export function windowNight() {
  return makeTexture('window-night', 512, 512, (ctx, w, h, rand) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#070d17');
    g.addColorStop(0.6, '#0e1a24');
    g.addColorStop(1, '#05080a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(215,225,220,0.75)';
    ctx.beginPath(); ctx.arc(w * 0.7, h * 0.22, 38, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(215,225,220,0.08)';
    ctx.beginPath(); ctx.arc(w * 0.7, h * 0.22, 90, 0, Math.PI * 2); ctx.fill();
    // clouds
    ctx.fillStyle = 'rgba(40,55,64,0.5)';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.ellipse(rand() * w, h * (0.1 + rand() * 0.3), 60 + rand() * 100, 12 + rand() * 22, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // tree silhouettes
    ctx.fillStyle = '#040605';
    for (let i = 0; i < 12; i++) {
      const x = rand() * w, base = h;
      ctx.fillRect(x, h * 0.55, 3 + rand() * 5, h * 0.45);
      for (let j = 0; j < 7; j++) {
        ctx.beginPath();
        ctx.arc(x + (rand() - 0.5) * 40, h * (0.45 + rand() * 0.22), 8 + rand() * 18, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // rain
    ctx.strokeStyle = 'rgba(180,205,215,0.13)';
    for (let i = 0; i < 90; i++) {
      const x = rand() * w, y = rand() * h;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 16); ctx.stroke();
    }
  }, { clamp: true, seed: 5 });
}

export function note() {
  return makeTexture('note', 256, 320, (ctx, w, h, rand) => {
    ctx.fillStyle = '#cbbd9c';
    ctx.fillRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w * 0.8);
    g.addColorStop(0, 'rgba(255,250,230,0.15)');
    g.addColorStop(1, 'rgba(50,35,15,0.4)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(50,35,20,0.6)';
    ctx.lineWidth = 1;
    for (let y = 44; y < h - 30; y += 22) {
      ctx.beginPath(); ctx.moveTo(24, y); ctx.lineTo(w - 24, y); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(30,20,12,0.75)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const y = 42 + i * 22;
      ctx.beginPath();
      ctx.moveTo(28, y);
      for (let x = 28; x < w - 30; x += 12) ctx.lineTo(x, y - 4 + rand() * 8);
      ctx.stroke();
    }
    stain(ctx, w, h, rand, 'rgba(60,40,15,0.25)', 3);
    noise(ctx, w, h, 900, 0.1, rand);
  }, { clamp: true, seed: 8 });
}

export function guidingLight() {
  return makeTexture('guiding-light', 128, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, h, 0, 0);
    g.addColorStop(0, 'rgba(40,110,190,0)');
    g.addColorStop(0.35, 'rgba(90,180,255,0.55)');
    g.addColorStop(0.7, 'rgba(190,235,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(w * 0.5, 0);
    ctx.bezierCurveTo(w * 0.95, h * 0.35, w * 0.8, h * 0.8, w * 0.5, h);
    ctx.bezierCurveTo(w * 0.2, h * 0.8, w * 0.05, h * 0.35, w * 0.5, 0);
    ctx.fill();
  }, { clamp: true });
}

export function disposeTextures() {
  for (const tex of cache.values()) tex.dispose();
  cache.clear();
}
