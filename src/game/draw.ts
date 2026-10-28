import { coastline, seeded, WORLD_HEIGHT, WORLD_WIDTH, type Island } from './islands';

type Ctx = CanvasRenderingContext2D;

const COLOUR_KEYS = [
  'seaDeep',
  'sea',
  'shallow',
  'foam',
  'glint',
  'sand',
  'sandShade',
  'grass',
  'grassShade',
  'wood',
  'wall',
  'roof',
  'metal',
  'metalShade',
  'accent',
  'lamp',
  'window',
  'shadow',
  'cloud',
  'plane',
  'planeTrim',
  'label',
  'labelText',
] as const;

export type Palette = Record<(typeof COLOUR_KEYS)[number], string> & { night: boolean };

/** Reads the map colours from CSS custom properties, so the map follows the colour scheme. */
export function readPalette(element: HTMLElement): Palette {
  const style = getComputedStyle(element);
  const read = (key: string) =>
    style.getPropertyValue(`--world-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`).trim();
  const colours = Object.fromEntries(COLOUR_KEYS.map((key) => [key, read(key) || '#888']));
  return {
    ...(colours as Record<(typeof COLOUR_KEYS)[number], string>),
    night: read('night') === '1',
  };
}

/** A smooth closed curve through the points, using their midpoints as anchors. */
function smoothClosed(path: CanvasPath, points: readonly [number, number][]) {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return;
  path.moveTo((last[0] + first[0]) / 2, (last[1] + first[1]) / 2);
  points.forEach((point, i) => {
    const next = points[(i + 1) % points.length] ?? first;
    path.quadraticCurveTo(point[0], point[1], (point[0] + next[0]) / 2, (point[1] + next[1]) / 2);
  });
  path.closePath();
}

function blob(ctx: Ctx, r: number, seed: number, colour: string, dx = 0, dy = 0) {
  ctx.save();
  ctx.translate(dx, dy);
  ctx.fillStyle = colour;
  ctx.beginPath();
  smoothClosed(ctx, coastline(r, seed));
  ctx.fill();
  ctx.restore();
}

/** The animated surf line, cached per island because the coastline never changes. */
export function foamPath(island: Island): Path2D {
  const path = new Path2D();
  const points = coastline(island.r * 1.1, island.seed).map(([x, y]): [number, number] => [
    island.x + x,
    island.y + y,
  ]);
  smoothClosed(path, points);
  return path;
}

// Scenery. Everything is drawn front-on, standing on a top-down island, like a map illustration.
// Coordinates are in "u", a hundredth of the island's radius, with (0, 0) at its centre.

function groundShadow(ctx: Ctx, x: number, y: number, width: number, p: Palette) {
  ctx.fillStyle = p.shadow;
  ctx.beginPath();
  ctx.ellipse(x, y, width / 2, width * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
}

function house(ctx: Ctx, x: number, y: number, w: number, h: number, p: Palette) {
  groundShadow(ctx, x + w * 0.1, y, w * 1.2, p);
  ctx.fillStyle = p.wall;
  ctx.fillRect(x - w / 2, y - h, w, h);
  ctx.fillStyle = p.roof;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.62, y - h + 1);
  ctx.lineTo(x, y - h - h * 0.7);
  ctx.lineTo(x + w * 0.62, y - h + 1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = p.window;
  ctx.fillRect(x - w * 0.32, y - h * 0.72, w * 0.22, h * 0.24);
  ctx.fillStyle = p.wood;
  ctx.fillRect(x + w * 0.08, y - h * 0.52, w * 0.22, h * 0.52);
}

function palm(ctx: Ctx, x: number, y: number, size: number, p: Palette, lean = 1) {
  groundShadow(ctx, x + size * 0.1, y, size * 0.75, p);
  const topX = x + size * 0.2 * lean;
  const topY = y - size;
  ctx.strokeStyle = p.wood;
  ctx.lineWidth = size * 0.09;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + size * 0.02 * lean, y - size * 0.6, topX, topY);
  ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const angle = -Math.PI / 2 + (i - 2.5) * 0.62;
    ctx.fillStyle = i % 2 ? p.grass : p.grassShade;
    ctx.beginPath();
    ctx.ellipse(
      topX + Math.cos(angle) * size * 0.27,
      topY + Math.sin(angle) * size * 0.14 + size * 0.07,
      size * 0.32,
      size * 0.085,
      angle,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}

const HOME = { house: { x: -14, y: 16, w: 42, h: 30 }, pole: { x: 22, y: -2, h: 52 } };

const WORKSHOP = {
  buildings: [
    { x: -40, y: 8, w: 30, h: 24 },
    { x: -8, y: 20, w: 26, h: 40 },
    { x: 24, y: 24, w: 30, h: 22 },
  ],
  crane: { x: 50, y: 8, h: 66, jibStart: -12, jibEnd: 30, hookX: 24 },
};

const DATABASE = { stack: { x: -10, y: 30, w: 46 }, lock: { x: 34, y: 22, s: 26 } };

const AGENTS = { robot: { x: -8, y: 26, s: 46 }, dish: { x: 40, y: 22, s: 30 } };

const HARBOUR = {
  lighthouse: { x: -16, y: 22, s: 76 },
  dock: { x: 30, y: 30, w: 11, length: 92 },
  boat: { x: 52, y: 100 },
};

const POST = { mailbox: { x: -14, y: 24, s: 36 }, sign: { x: 30, y: 26, s: 50 } };

function discs(w: number) {
  const height = w * 0.28;
  return { height, gap: w * 0.06, rim: w * 0.14 };
}

function drawScenery(ctx: Ctx, island: Island, p: Palette) {
  const u = island.r / 100;
  const s = (n: number) => n * u;
  switch (island.kind) {
    case 'home': {
      palm(ctx, s(-46), s(36), s(38), p, -1);
      house(ctx, s(HOME.house.x), s(HOME.house.y), s(HOME.house.w), s(HOME.house.h), p);
      ctx.strokeStyle = p.metalShade;
      ctx.lineWidth = s(2.4);
      ctx.beginPath();
      ctx.moveTo(s(HOME.pole.x), s(HOME.pole.y));
      ctx.lineTo(s(HOME.pole.x), s(HOME.pole.y - HOME.pole.h));
      ctx.stroke();
      palm(ctx, s(40), s(24), s(48), p, 1);
      break;
    }
    case 'workshop': {
      palm(ctx, s(-62), s(44), s(36), p, -1);
      for (const b of WORKSHOP.buildings) house(ctx, s(b.x), s(b.y), s(b.w), s(b.h), p);
      const c = WORKSHOP.crane;
      ctx.strokeStyle = p.roof;
      ctx.lineWidth = s(3);
      ctx.beginPath();
      ctx.moveTo(s(c.x), s(c.y));
      ctx.lineTo(s(c.x), s(c.y - c.h));
      ctx.moveTo(s(c.x + c.jibStart), s(c.y - c.h));
      ctx.lineTo(s(c.x + c.jibEnd), s(c.y - c.h));
      ctx.stroke();
      ctx.fillStyle = p.metalShade;
      ctx.fillRect(s(c.x + c.jibStart - 4), s(c.y - c.h), s(8), s(8));
      break;
    }
    case 'database': {
      palm(ctx, s(-52), s(34), s(40), p, -1);
      const { x, y, w } = DATABASE.stack;
      const d = discs(w);
      groundShadow(ctx, s(x + 4), s(y), s(w * 1.35), p);
      for (let i = 0; i < 3; i++) {
        const bottom = y - i * (d.height + d.gap);
        ctx.fillStyle = p.metalShade;
        ctx.fillRect(s(x - w / 2), s(bottom - d.height), s(w), s(d.height));
        ctx.beginPath();
        ctx.ellipse(s(x), s(bottom), s(w / 2), s(d.rim), 0, 0, Math.PI);
        ctx.fill();
        ctx.fillStyle = p.metal;
        ctx.beginPath();
        ctx.ellipse(s(x), s(bottom - d.height), s(w / 2), s(d.rim), 0, 0, Math.PI * 2);
        ctx.fill();
      }
      const l = DATABASE.lock;
      groundShadow(ctx, s(l.x), s(l.y), s(l.s), p);
      ctx.strokeStyle = p.metalShade;
      ctx.lineWidth = s(4);
      ctx.beginPath();
      ctx.arc(s(l.x), s(l.y - l.s * 0.7), s(l.s * 0.26), Math.PI, 0);
      ctx.stroke();
      ctx.fillStyle = p.lamp;
      ctx.fillRect(s(l.x - l.s / 2), s(l.y - l.s * 0.72), s(l.s), s(l.s * 0.72));
      ctx.fillStyle = p.wood;
      ctx.fillRect(s(l.x - 1.5), s(l.y - l.s * 0.5), s(3), s(l.s * 0.24));
      break;
    }
    case 'agents': {
      palm(ctx, s(-56), s(38), s(38), p, -1);
      const r = AGENTS.robot;
      groundShadow(ctx, s(r.x), s(r.y), s(r.s * 1.1), p);
      ctx.fillStyle = p.metal;
      ctx.beginPath();
      ctx.roundRect(s(r.x - r.s * 0.36), s(r.y - r.s * 0.5), s(r.s * 0.72), s(r.s * 0.5), s(4));
      ctx.fill();
      ctx.fillStyle = p.wall;
      ctx.beginPath();
      ctx.roundRect(s(r.x - r.s * 0.3), s(r.y - r.s * 0.92), s(r.s * 0.6), s(r.s * 0.38), s(6));
      ctx.fill();
      ctx.fillStyle = p.accent;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(s(r.x + side * r.s * 0.12), s(r.y - r.s * 0.74), s(r.s * 0.06), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = p.metalShade;
      ctx.lineWidth = s(2.4);
      ctx.beginPath();
      ctx.moveTo(s(r.x), s(r.y - r.s * 0.92));
      ctx.lineTo(s(r.x), s(r.y - r.s * 1.18));
      ctx.stroke();
      const d = AGENTS.dish;
      groundShadow(ctx, s(d.x), s(d.y), s(d.s * 0.8), p);
      ctx.beginPath();
      ctx.moveTo(s(d.x), s(d.y));
      ctx.lineTo(s(d.x), s(d.y - d.s * 0.55));
      ctx.stroke();
      ctx.fillStyle = p.wall;
      ctx.beginPath();
      ctx.ellipse(s(d.x), s(d.y - d.s * 0.7), s(d.s * 0.42), s(d.s * 0.22), -0.5, 0, Math.PI);
      ctx.fill();
      break;
    }
    case 'harbour': {
      const dock = HARBOUR.dock;
      ctx.fillStyle = p.wood;
      ctx.fillRect(s(dock.x), s(dock.y), s(dock.w), s(dock.length));
      ctx.strokeStyle = p.shadow;
      ctx.lineWidth = s(1);
      for (let y = dock.y + 8; y < dock.y + dock.length; y += 8) {
        ctx.beginPath();
        ctx.moveTo(s(dock.x), s(y));
        ctx.lineTo(s(dock.x + dock.w), s(y));
        ctx.stroke();
      }
      palm(ctx, s(46), s(-12), s(38), p, 1);
      const l = HARBOUR.lighthouse;
      groundShadow(ctx, s(l.x + 4), s(l.y), s(l.s * 0.6), p);
      const bands = 4;
      for (let i = 0; i < bands; i++) {
        const t0 = i / bands;
        const t1 = (i + 1) / bands;
        const half = (t: number) => l.s * (0.17 - 0.06 * t);
        ctx.fillStyle = i % 2 ? p.wall : p.roof;
        ctx.beginPath();
        ctx.moveTo(s(l.x - half(t0)), s(l.y - l.s * t0 * 0.8));
        ctx.lineTo(s(l.x - half(t1)), s(l.y - l.s * t1 * 0.8));
        ctx.lineTo(s(l.x + half(t1)), s(l.y - l.s * t1 * 0.8));
        ctx.lineTo(s(l.x + half(t0)), s(l.y - l.s * t0 * 0.8));
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = p.metalShade;
      ctx.fillRect(s(l.x - l.s * 0.13), s(l.y - l.s * 0.96), s(l.s * 0.26), s(l.s * 0.16));
      ctx.fillStyle = p.roof;
      ctx.beginPath();
      ctx.moveTo(s(l.x - l.s * 0.16), s(l.y - l.s * 0.96));
      ctx.lineTo(s(l.x), s(l.y - l.s * 1.1));
      ctx.lineTo(s(l.x + l.s * 0.16), s(l.y - l.s * 0.96));
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'post': {
      palm(ctx, s(44), s(-16), s(36), p, 1);
      const m = POST.mailbox;
      groundShadow(ctx, s(m.x), s(m.y), s(m.s * 0.9), p);
      ctx.fillStyle = p.wood;
      ctx.fillRect(s(m.x - 2), s(m.y - m.s * 0.7), s(4), s(m.s * 0.7));
      ctx.fillStyle = p.roof;
      ctx.beginPath();
      ctx.roundRect(s(m.x - m.s * 0.4), s(m.y - m.s * 1.1), s(m.s * 0.8), s(m.s * 0.45), [
        s(m.s * 0.22),
        s(m.s * 0.22),
        s(2),
        s(2),
      ]);
      ctx.fill();
      ctx.fillStyle = p.window;
      ctx.fillRect(s(m.x - m.s * 0.22), s(m.y - m.s * 0.86), s(m.s * 0.44), s(m.s * 0.06));
      const g = POST.sign;
      groundShadow(ctx, s(g.x), s(g.y), s(g.s * 0.5), p);
      ctx.fillStyle = p.wood;
      ctx.fillRect(s(g.x - 2), s(g.y - g.s), s(4), s(g.s));
      [-1, 1, -1].forEach((direction, i) => {
        const y = g.y - g.s * (0.92 - i * 0.24);
        const w = g.s * 0.5;
        const x0 = g.x;
        const x1 = g.x + direction * w;
        ctx.fillStyle = p.wall;
        ctx.beginPath();
        ctx.moveTo(s(x0), s(y - 5));
        ctx.lineTo(s(x1 - direction * 6), s(y - 5));
        ctx.lineTo(s(x1), s(y));
        ctx.lineTo(s(x1 - direction * 6), s(y + 5));
        ctx.lineTo(s(x0), s(y + 5));
        ctx.closePath();
        ctx.fill();
      });
      break;
    }
  }
}

/** Pre-renders the parts of an island that never move, at screen resolution. */
export function renderIslandSprite(island: Island, p: Palette, scale: number): HTMLCanvasElement {
  const half = island.r * 1.6;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.max(1, Math.ceil(half * 2 * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(scale, scale);
  ctx.translate(half, half);
  blob(ctx, island.r * 1.34, island.seed, p.shallow);
  blob(ctx, island.r, island.seed, p.sandShade, island.r * 0.03, island.r * 0.05);
  blob(ctx, island.r, island.seed, p.sand);
  blob(ctx, island.r * 0.74, island.seed + 1, p.grassShade, 0, -island.r * 0.02);
  blob(ctx, island.r * 0.7, island.seed + 1, p.grass, 0, -island.r * 0.07);
  drawScenery(ctx, island, p);
  return canvas;
}

export function spriteHalfSize(island: Island): number {
  return island.r * 1.6;
}

/** The moving parts of each island: flags, the crane hook, blinking lights, the lighthouse beam. */
export function drawIslandLife(ctx: Ctx, island: Island, t: number, p: Palette) {
  const u = island.r / 100;
  const s = (n: number) => n * u;
  ctx.save();
  ctx.translate(island.x, island.y);
  switch (island.kind) {
    case 'home': {
      const { x, y, h } = HOME.pole;
      const top = y - h;
      ctx.fillStyle = p.accent;
      ctx.beginPath();
      ctx.moveTo(s(x), s(top));
      for (let i = 0; i <= 6; i++) {
        const fx = x + i * 3.4;
        ctx.lineTo(s(fx), s(top + Math.sin(t * 4 - i * 0.8) * 1.6 * (i / 6)));
      }
      for (let i = 6; i >= 0; i--) {
        const fx = x + i * 3.4;
        ctx.lineTo(s(fx), s(top + 12 + Math.sin(t * 4 - i * 0.8) * 1.6 * (i / 6)));
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'workshop': {
      const c = WORKSHOP.crane;
      const drop = 22 + Math.sin(t * 1.2) * 8;
      const hx = c.x + c.hookX;
      const top = c.y - c.h;
      ctx.strokeStyle = p.metalShade;
      ctx.lineWidth = s(1.2);
      ctx.beginPath();
      ctx.moveTo(s(hx), s(top));
      ctx.lineTo(s(hx), s(top + drop));
      ctx.stroke();
      ctx.fillStyle = p.lamp;
      ctx.fillRect(s(hx - 5), s(top + drop), s(10), s(8));
      break;
    }
    case 'database': {
      // One "row" lights up at a time: tenant data, one shared table.
      const { x, y, w } = DATABASE.stack;
      const d = discs(w);
      const row = Math.floor(t * 1.2) % 3;
      const bottom = y - row * (d.height + d.gap);
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = s(2.4);
      ctx.beginPath();
      ctx.ellipse(s(x), s(bottom - d.height * 0.45), s(w / 2), s(d.rim), 0, 0.15, Math.PI - 0.15);
      ctx.stroke();
      break;
    }
    case 'agents': {
      const r = AGENTS.robot;
      ctx.globalAlpha = 0.45 + 0.55 * Math.max(0, Math.sin(t * 3));
      ctx.fillStyle = p.lamp;
      ctx.beginPath();
      ctx.arc(s(r.x), s(r.y - r.s * 1.22), s(4), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      if (t % 3.5 < 0.15) {
        ctx.fillStyle = p.wall;
        for (const side of [-1, 1]) {
          ctx.fillRect(
            s(r.x + side * r.s * 0.12 - r.s * 0.07),
            s(r.y - r.s * 0.8),
            s(r.s * 0.14),
            s(r.s * 0.12),
          );
        }
      }
      break;
    }
    case 'harbour': {
      const l = HARBOUR.lighthouse;
      const lampX = s(l.x);
      const lampY = s(l.y - l.s * 0.88);
      const angle = t * 0.8;
      const reach = s(260);
      ctx.globalAlpha = p.night ? 0.32 : 0.2;
      ctx.fillStyle = p.lamp;
      ctx.beginPath();
      ctx.moveTo(lampX, lampY);
      ctx.lineTo(lampX + Math.cos(angle - 0.13) * reach, lampY + Math.sin(angle - 0.13) * reach);
      ctx.lineTo(lampX + Math.cos(angle + 0.13) * reach, lampY + Math.sin(angle + 0.13) * reach);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(lampX, lampY, s(5), 0, Math.PI * 2);
      ctx.fill();
      const b = HARBOUR.boat;
      const bob = Math.sin(t * 1.6) * 2;
      ctx.save();
      ctx.translate(s(b.x), s(b.y + bob));
      ctx.rotate(Math.sin(t * 1.6) * 0.05);
      ctx.fillStyle = p.shadow;
      ctx.beginPath();
      ctx.ellipse(s(2), s(3), s(16), s(4), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.wood;
      ctx.beginPath();
      ctx.moveTo(s(-16), s(-4));
      ctx.lineTo(s(16), s(-4));
      ctx.lineTo(s(10), s(3));
      ctx.lineTo(s(-10), s(3));
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = p.wall;
      ctx.beginPath();
      ctx.moveTo(s(0), s(-28));
      ctx.lineTo(s(12), s(-6));
      ctx.lineTo(s(0), s(-6));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'post': {
      const m = POST.mailbox;
      ctx.save();
      ctx.translate(s(m.x + m.s * 0.4), s(m.y - m.s * 0.8));
      ctx.rotate(-Math.PI / 2 + Math.sin(t * 1.4) * 0.5);
      ctx.fillStyle = p.accent;
      ctx.fillRect(0, s(-1.5), s(m.s * 0.42), s(3));
      ctx.fillRect(s(m.s * 0.3), s(-1.5), s(m.s * 0.14), s(9));
      ctx.restore();
      break;
    }
  }
  ctx.restore();
}

export function drawFoam(ctx: Ctx, path: Path2D, t: number, p: Palette) {
  ctx.save();
  ctx.strokeStyle = p.foam;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.setLineDash([14, 22]);
  ctx.lineDashOffset = -t * 14;
  ctx.globalAlpha = 0.5 + Math.sin(t * 1.3) * 0.2;
  ctx.stroke(path);
  ctx.restore();
}

const GLINTS = (() => {
  const rand = seeded(99);
  return Array.from({ length: 170 }, () => ({
    x: rand() * WORLD_WIDTH,
    y: rand() * WORLD_HEIGHT,
    length: 8 + rand() * 12,
    phase: rand() * Math.PI * 2,
    speed: 0.5 + rand() * 0.8,
  }));
})();

export interface View {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function drawSea(ctx: Ctx, view: View, t: number, p: Palette) {
  ctx.fillStyle = p.sea;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  ctx.strokeStyle = p.glint;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (const g of GLINTS) {
    if (g.x < view.left - 20 || g.x > view.right + 20 || g.y < view.top || g.y > view.bottom) {
      continue;
    }
    const strength = Math.sin(t * g.speed + g.phase);
    if (strength < 0.1) continue;
    const drift = Math.sin(t * 0.25 + g.phase) * 8;
    ctx.globalAlpha = strength * 0.6;
    ctx.beginPath();
    ctx.moveTo(g.x + drift - g.length / 2, g.y);
    ctx.quadraticCurveTo(g.x + drift, g.y + 3, g.x + drift + g.length / 2, g.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

const CLOUDS = (() => {
  const rand = seeded(7);
  return Array.from({ length: 7 }, () => ({
    x: rand() * WORLD_WIDTH,
    y: rand() * WORLD_HEIGHT,
    size: 40 + rand() * 50,
    speed: 6 + rand() * 8,
  }));
})();

export function drawClouds(ctx: Ctx, t: number, p: Palette) {
  ctx.fillStyle = p.cloud;
  const span = WORLD_WIDTH + 600;
  for (const c of CLOUDS) {
    const x = ((c.x + t * c.speed) % span) - 300;
    ctx.beginPath();
    ctx.arc(x, c.y, c.size * 0.6, 0, Math.PI * 2);
    ctx.arc(x + c.size * 0.55, c.y + c.size * 0.1, c.size * 0.45, 0, Math.PI * 2);
    ctx.arc(x - c.size * 0.55, c.y + c.size * 0.15, c.size * 0.4, 0, Math.PI * 2);
    ctx.arc(x + c.size * 0.1, c.y - c.size * 0.3, c.size * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
}

export interface PlanePose {
  x: number;
  y: number;
  heading: number;
  bank: number;
  /** 0 on the ground, 1 at cruising height. */
  alt: number;
}

function planeOutline(ctx: Ctx, span: number) {
  ctx.beginPath();
  ctx.roundRect(-5, -32 * span, 15, 64 * span, 4);
  ctx.roundRect(-28, -11, 8, 22, 3);
  ctx.ellipse(0, 0, 29, 6.5, 0, 0, Math.PI * 2);
}

/** A top-down seaplane, with its shadow on the water below it. */
export function drawPlane(ctx: Ctx, pose: PlanePose, t: number, p: Palette) {
  const scale = 1 + pose.alt * 0.18;
  const span = 1 - Math.min(1, Math.abs(pose.bank)) * 0.22;

  ctx.save();
  ctx.translate(pose.x + pose.alt * 28, pose.y + pose.alt * 40);
  ctx.rotate(pose.heading);
  ctx.fillStyle = p.shadow;
  planeOutline(ctx, span);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(pose.x, pose.y);
  ctx.rotate(pose.heading);
  ctx.scale(scale, scale);
  ctx.fillStyle = p.planeTrim;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(-1, side * 13 * span, 18, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = p.plane;
  planeOutline(ctx, span);
  ctx.fill();
  ctx.fillStyle = p.roof;
  ctx.fillRect(-5, -32 * span, 15, 7 * span);
  ctx.fillRect(-5, 25 * span, 15, 7 * span);
  ctx.fillStyle = p.planeTrim;
  ctx.fillRect(-22, -1.5, 30, 3);
  ctx.fillStyle = p.window;
  ctx.beginPath();
  ctx.ellipse(11, 0, 6, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = p.metalShade;
  ctx.beginPath();
  ctx.ellipse(30, 0, 1.8, 12 * Math.abs(Math.sin(t * 40)) + 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export interface LabelBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

const LABEL_FONT = '600 13px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const NUMBER_FONT = '600 12px ui-monospace, Menlo, Consolas, monospace';

/** An island's name tag, drawn in screen space so it stays crisp at any zoom. */
export function drawLabel(
  ctx: Ctx,
  centreX: number,
  top: number,
  island: Island,
  p: Palette,
  highlighted: boolean,
): LabelBox {
  ctx.font = NUMBER_FONT;
  const numberWidth = island.number ? ctx.measureText(island.number).width + 8 : 0;
  ctx.font = LABEL_FONT;
  const width = numberWidth + ctx.measureText(island.label).width + 22;
  const height = 26;
  const x = centreX - width / 2;
  ctx.fillStyle = p.label;
  ctx.beginPath();
  ctx.roundRect(x, top, width, height, height / 2);
  ctx.fill();
  if (highlighted) {
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.textBaseline = 'middle';
  if (island.number) {
    ctx.font = NUMBER_FONT;
    ctx.fillStyle = p.accent;
    ctx.fillText(island.number, x + 11, top + height / 2 + 0.5);
  }
  ctx.font = LABEL_FONT;
  ctx.fillStyle = p.labelText;
  ctx.fillText(island.label, x + 11 + numberWidth, top + height / 2 + 0.5);
  return { x, y: top, width, height };
}
