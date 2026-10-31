export const FRUITS = {
  flame: {
    id: 'flame',
    name: 'Flame-Flame Fruit',
    short: 'Flame',
    rarity: 'RARE',
    starter: true,
    colors: { a: '#ffcf5c', b: '#ff6b2c', c: '#c92b1c', glow: '#ff8a3d' },
    skill: {
      name: 'Fire Fist',
      desc: 'Hurl a roaring fireball that bursts in a wide circle and burns foes.',
      cooldown: 5.5,
      cost: 28,
    },
    icon: `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><radialGradient id="fg-flame" cx="35%" cy="30%"><stop offset="0" stop-color="#ffe9a3"/><stop offset=".45" stop-color="#ff9a3c"/><stop offset="1" stop-color="#c92b1c"/></radialGradient></defs><circle cx="32" cy="34" r="22" fill="url(#fg-flame)"/><path d="M32 12c5 8-4 10 2 17 4-5 3-9 7-11 6 9 7 19-1 25-7 5-17 1-18-8-1-7 5-9 4-15 3 2 4 5 4 8 3-5 3-11 2-16z" fill="#fff3c4" opacity=".9"/><path d="M25 22c6 5 1 10 6 15" fill="none" stroke="#8d1c12" stroke-width="2" stroke-linecap="round" opacity=".45"/><path d="M32 10c2-4 6-4 7-2-2 3-4 4-7 4z" fill="#3f8f4e"/></svg>`,
  },
  ice: {
    id: 'ice',
    name: 'Ice-Ice Fruit',
    short: 'Ice',
    rarity: 'RARE',
    starter: true,
    colors: { a: '#e8ffff', b: '#63d8ff', c: '#1f7fbf', glow: '#8feaff' },
    skill: {
      name: 'Ice Age',
      desc: 'Flash-freeze a wide cone of enemies, freezing them in place.',
      cooldown: 6.5,
      cost: 32,
    },
    icon: `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><radialGradient id="fg-ice" cx="35%" cy="30%"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#8feaff"/><stop offset="1" stop-color="#1f7fbf"/></radialGradient></defs><circle cx="32" cy="34" r="22" fill="url(#fg-ice)"/><g stroke="#e9fdff" stroke-width="2.4" stroke-linecap="round" opacity=".85"><path d="M32 18v24M21 24l22 12M43 24L21 36"/><path d="M28 20l4 4 4-4M28 40l4-4 4 4"/></g><path d="M32 10c2-4 6-4 7-2-2 3-4 4-7 4z" fill="#3f8f4e"/></svg>`,
  },
  lightning: {
    id: 'lightning',
    name: 'Rumble-Rumble Fruit',
    short: 'Lightning',
    rarity: 'LEGENDARY',
    starter: true,
    colors: { a: '#fff8b0', b: '#ffd83d', c: '#7a3cc9', glow: '#ffe66b' },
    skill: {
      name: 'El Thor',
      desc: 'Call down a chained thunderbolt that arcs through up to three foes.',
      cooldown: 7,
      cost: 36,
    },
    icon: `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><radialGradient id="fg-bolt" cx="35%" cy="30%"><stop offset="0" stop-color="#fffbd6"/><stop offset=".5" stop-color="#ffd83d"/><stop offset="1" stop-color="#7a3cc9"/></radialGradient></defs><circle cx="32" cy="34" r="22" fill="url(#fg-bolt)"/><path d="M36 12L22 34h9l-4 18 16-24h-9l2-16z" fill="#fffbe0" stroke="#9c6b00" stroke-width="1.4" stroke-linejoin="round"/><path d="M32 10c2-4 6-4 7-2-2 3-4 4-7 4z" fill="#3f8f4e"/></svg>`,
  },
  rubber: {
    id: 'rubber',
    name: 'Gum-Gum Fruit',
    short: 'Rubber',
    rarity: 'UNCOMMON',
    starter: false,
    colors: { a: '#ffc2dd', b: '#e05a94', c: '#7d1f4c', glow: '#ff8fc0' },
    skill: {
      name: 'Gum-Gum Gatling',
      desc: 'Unleash a storm of stretched punches that batter everything ahead.',
      cooldown: 4.8,
      cost: 24,
    },
    icon: `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><radialGradient id="fg-rubber" cx="35%" cy="30%"><stop offset="0" stop-color="#ffe0ee"/><stop offset=".5" stop-color="#e05a94"/><stop offset="1" stop-color="#7d1f4c"/></radialGradient></defs><circle cx="32" cy="34" r="22" fill="url(#fg-rubber)"/><path d="M17 40c0-12 9-20 19-17 7 2 9 8 6 13-3 4-9 4-11 0-2-3 1-6 4-5" fill="none" stroke="#ffeaf3" stroke-width="4" stroke-linecap="round"/><path d="M32 10c2-4 6-4 7-2-2 3-4 4-7 4z" fill="#3f8f4e"/></svg>`,
  },
  sand: {
    id: 'sand',
    name: 'Sand-Sand Fruit',
    short: 'Sand',
    rarity: 'UNCOMMON',
    starter: false,
    colors: { a: '#fff0bd', b: '#e6b357', c: '#9a6524', glow: '#ffd786' },
    skill: {
      name: 'Sand Storm',
      desc: 'Summon a grinding sand vortex that slows and shreds nearby foes.',
      cooldown: 6,
      cost: 30,
    },
    icon: `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><radialGradient id="fg-sand" cx="35%" cy="30%"><stop offset="0" stop-color="#fff4cf"/><stop offset=".5" stop-color="#e6b357"/><stop offset="1" stop-color="#9a6524"/></radialGradient></defs><circle cx="32" cy="34" r="22" fill="url(#fg-sand)"/><g fill="none" stroke="#fff2c7" stroke-width="2.6" stroke-linecap="round" opacity=".85"><path d="M18 29c6-5 16-5 22 0s8 5 7 1"/><path d="M19 38c7 5 18 5 24-1"/><path d="M23 46c6 3 13 2 17-2"/></g><path d="M32 10c2-4 6-4 7-2-2 3-4 4-7 4z" fill="#3f8f4e"/></svg>`,
  },
  dark: {
    id: 'dark',
    name: 'Dark-Dark Fruit',
    short: 'Dark',
    rarity: 'LEGENDARY',
    starter: false,
    colors: { a: '#d9a6ff', b: '#7132b8', c: '#1b0b2b', glow: '#b26bff' },
    skill: {
      name: 'Black Vortex',
      desc: 'Tear open a void that drags enemies inward and crushes them.',
      cooldown: 7.5,
      cost: 38,
    },
    icon: `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><radialGradient id="fg-dark" cx="35%" cy="30%"><stop offset="0" stop-color="#e3c2ff"/><stop offset=".45" stop-color="#7132b8"/><stop offset="1" stop-color="#1b0b2b"/></radialGradient></defs><circle cx="32" cy="34" r="22" fill="url(#fg-dark)"/><path d="M32 19a15 15 0 1 0 14 21 11 11 0 0 1-15-15 12 12 0 0 0 1-6z" fill="#170720" opacity=".75"/><circle cx="27" cy="31" r="3" fill="#f0dcff"/><path d="M32 10c2-4 6-4 7-2-2 3-4 4-7 4z" fill="#3f8f4e"/></svg>`,
  },
};

export const STARTERS = ['flame', 'ice', 'lightning'];
export const SHRINE_FRUITS = { palm: 'rubber', fort: 'sand', skull: 'dark' };

export function getFruit(id) {
  return FRUITS[id] || FRUITS.flame;
}

/** Draw a devil fruit: a glossy orb with a stem, leaf and swirls. */
export function drawFruit(ctx, x, y, r, fruit, time = 0, glow = true) {
  const c = fruit.colors;
  ctx.save();
  ctx.translate(x, y);

  if (glow) {
    const pulse = 0.72 + Math.sin(time * 3.1) * 0.18;
    const g = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 3.1);
    g.addColorStop(0, hexA(c.glow, 0.42 * pulse));
    g.addColorStop(0.55, hexA(c.glow, 0.13 * pulse));
    g.addColorStop(1, hexA(c.glow, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r * 3.1, 0, Math.PI * 2);
    ctx.fill();
  }

  const grad = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.15, 0, 0, r);
  grad.addColorStop(0, c.a);
  grad.addColorStop(0.55, c.b);
  grad.addColorStop(1, c.c);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = Math.max(1.4, r * 0.09);
  ctx.strokeStyle = 'rgba(30, 16, 40, .28)';
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.93, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = hexA(c.a, 0.75);
  ctx.lineWidth = Math.max(1.2, r * 0.09);
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    const a = time * 0.5 + (i * Math.PI * 2) / 3;
    ctx.arc(0, 0, r * (0.32 + i * 0.2), a, a + 1.7);
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.34, -r * 0.38, r * 0.28, r * 0.16, -0.7, 0, Math.PI * 2);
  ctx.fill();

  // stem + leaf
  ctx.strokeStyle = '#5a3a1d';
  ctx.lineWidth = Math.max(1.6, r * 0.12);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.92);
  ctx.quadraticCurveTo(r * 0.1, -r * 1.3, r * 0.3, -r * 1.34);
  ctx.stroke();
  ctx.fillStyle = '#4f9d55';
  ctx.beginPath();
  ctx.ellipse(r * 0.5, -r * 1.28, r * 0.34, r * 0.16, -0.45, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function hexA(hex, alpha) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((ch) => ch + ch).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
