import type { SectionId } from '../data/sections';

export type IslandId = 'home' | SectionId;
export type IslandKind = 'home' | 'workshop' | 'database' | 'agents' | 'harbour' | 'post';

export interface IslandShape {
  x: number;
  y: number;
  /** Radius of the beach, in world units. */
  r: number;
  kind: IslandKind;
  /** Seeds the coastline, so each island keeps the same shape on every visit. */
  seed: number;
}

export interface Island extends IslandShape {
  id: IslandId;
  number: string;
  label: string;
}

export interface Point {
  x: number;
  y: number;
}

export const WORLD_WIDTH = 2400;
export const WORLD_HEIGHT = 1600;

/** Hand-placed around the home island so no two labels collide. */
export const layout: Record<IslandId, IslandShape> = {
  home: { x: 1200, y: 790, r: 110, kind: 'home', seed: 3 },
  built: { x: 690, y: 470, r: 150, kind: 'workshop', seed: 11 },
  bet: { x: 1470, y: 300, r: 125, kind: 'database', seed: 29 },
  agents: { x: 1830, y: 860, r: 145, kind: 'agents', seed: 41 },
  'ship-safely': { x: 1300, y: 1290, r: 140, kind: 'harbour', seed: 53 },
  links: { x: 660, y: 1110, r: 120, kind: 'post', seed: 67 },
};

export function isIslandId(value: string | undefined): value is IslandId {
  return value !== undefined && Object.hasOwn(layout, value);
}

/** Where the seaplane parks: on the beach, just below the middle of the island. */
export function dockPoint(island: IslandShape): Point {
  return { x: island.x + island.r * 0.12, y: island.y + island.r * 0.64 };
}

/** Small seeded PRNG (mulberry32), so the scenery is the same on every load. */
export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A wobbly closed coastline around (0, 0): a circle bent by three low-frequency waves. */
export function coastline(r: number, seed: number, points = 48): [number, number][] {
  const rand = seeded(seed);
  const waves = [
    { k: 2, amp: 0.09, phase: rand() * Math.PI * 2 },
    { k: 3, amp: 0.07, phase: rand() * Math.PI * 2 },
    { k: 5, amp: 0.035, phase: rand() * Math.PI * 2 },
  ];
  return Array.from({ length: points }, (_, i) => {
    const angle = (i / points) * Math.PI * 2;
    const bend = waves.reduce((sum, w) => sum + w.amp * Math.sin(w.k * angle + w.phase), 1);
    return [Math.cos(angle) * r * bend, Math.sin(angle) * r * bend];
  });
}
