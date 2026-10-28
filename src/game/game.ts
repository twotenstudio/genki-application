import {
  drawClouds,
  drawFoam,
  drawIslandLife,
  drawLabel,
  drawPlane,
  drawSea,
  foamPath,
  readPalette,
  renderIslandSprite,
  spriteHalfSize,
  type LabelBox,
  type Palette,
} from './draw';
import {
  dockPoint,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type Island,
  type IslandId,
  type Point,
} from './islands';

export interface GameOptions {
  /** The element whose --world-* custom properties hold the map colours. */
  paletteSource: HTMLElement;
  reducedMotion: boolean;
  onLand: (id: IslandId) => void;
  onNear: (id: IslandId | null) => void;
  onTakeOff: () => void;
}

type Mode = 'parked' | 'takingOff' | 'flying' | 'landing';

const MAX_SPEED = 470;
const CRUISE_SPEED = 75;
const IDLE_TURN = 0.55;
const LANDING_TIME = 0.75;
const TAKEOFF_TIME = 0.7;
const ARRIVE_DISTANCE = 28;
const EDGE = 80;

const KEY_DIRECTIONS: Record<string, Point> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
};

const ease = (t: number) => t * t * (3 - 2 * t);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const angleDelta = (from: number, to: number) =>
  Math.atan2(Math.sin(to - from), Math.cos(to - from));

/** Keys only steer the plane when focus isn't somewhere that needs them. */
function keysBelongToPage(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable], [role="tablist"]'));
}

export class Game {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly islands: Island[];
  private readonly foam = new Map<IslandId, Path2D>();
  private sprites = new Map<IslandId, HTMLCanvasElement>();
  private palette: Palette;
  private labels: { id: IslandId; box: LabelBox }[] = [];

  private width = 0;
  private height = 0;
  private dpr = 1;
  private zoom = 1;
  private camera: Point = { x: 0, y: 0 };
  private inset = { right: 0, bottom: 0 };

  private mode: Mode = 'parked';
  private position: Point = { x: 0, y: 0 };
  private velocity: Point = { x: 0, y: 0 };
  private heading = 0;
  private bank = 0;
  private alt = 0;
  private phase = 0;
  private landingFrom: Point = { x: 0, y: 0 };
  private parkedAt: IslandId | null = null;
  /** The island just taken off from. It can't prompt a landing until the plane has left it. */
  private departed: IslandId | null = null;
  private target: { island: Island | null; point: Point } | null = null;
  private near: IslandId | null = null;

  private readonly keys = new Set<string>();
  private inputEnabled = true;
  private time = 0;
  private last = 0;
  private frameId = 0;
  private running = false;
  private snapCamera = true;
  private readonly resizeObserver: ResizeObserver;
  private readonly darkMode = matchMedia('(prefers-color-scheme: dark)');

  constructor(
    private readonly canvas: HTMLCanvasElement,
    islands: Island[],
    private readonly options: GameOptions,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;
    this.islands = islands;
    for (const island of islands) this.foam.set(island.id, foamPath(island));
    this.palette = readPalette(options.paletteSource);
    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
    });
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.resizeObserver.observe(this.canvas);
    this.resize();
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    this.canvas.addEventListener('click', this.onClick);
    this.darkMode.addEventListener('change', this.onSchemeChange);
    this.last = performance.now();
    this.frameId = requestAnimationFrame(this.frame);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.frameId);
    this.resizeObserver.disconnect();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.canvas.removeEventListener('click', this.onClick);
    this.darkMode.removeEventListener('change', this.onSchemeChange);
    this.keys.clear();
  }

  setInputEnabled(enabled: boolean) {
    this.inputEnabled = enabled;
    if (!enabled) this.keys.clear();
  }

  /** Space covered by a panel, in CSS pixels, so the camera centres the plane in what's left. */
  setInset(right: number, bottom: number) {
    this.inset = { right, bottom };
  }

  island(id: IslandId): Island | undefined {
    return this.islands.find((island) => island.id === id);
  }

  /** Puts the plane on an island's beach without flying there. */
  parkAt(id: IslandId) {
    const island = this.island(id);
    if (!island) return;
    this.position = dockPoint(island);
    this.velocity = { x: 0, y: 0 };
    this.heading = -Math.PI / 2;
    this.alt = 0;
    this.mode = 'parked';
    this.parkedAt = id;
    this.target = null;
    this.snapCamera = true;
    this.setNear(null);
  }

  takeOff() {
    if (this.mode !== 'parked') return;
    this.departed = this.parkedAt;
    this.parkedAt = null;
    this.options.onTakeOff();
    if (this.options.reducedMotion) {
      this.alt = 1;
      this.mode = 'flying';
      return;
    }
    this.mode = 'takingOff';
    this.phase = 0;
  }

  flyTo(id: IslandId) {
    const island = this.island(id);
    if (!island) return;
    if (this.mode === 'parked' && this.parkedAt === id) {
      this.options.onLand(id);
      return;
    }
    if (this.options.reducedMotion) {
      this.takeOff();
      this.parkAt(id);
      this.options.onLand(id);
      return;
    }
    this.takeOff();
    this.target = { island, point: dockPoint(island) };
    this.setNear(null);
  }

  landNearby() {
    if (this.near) this.flyTo(this.near);
  }

  private flyToPoint(point: Point) {
    this.takeOff();
    this.target = { island: null, point };
  }

  // Input

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (!this.inputEnabled || event.altKey || event.ctrlKey || event.metaKey) return;
    if (keysBelongToPage(event.target)) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (Object.hasOwn(KEY_DIRECTIONS, key)) {
      event.preventDefault();
      this.keys.add(key);
      this.target = null;
      this.takeOff();
      return;
    }
    const onPage = event.target === document.body || event.target === this.canvas;
    if ((key === 'Enter' || key === ' ') && onPage && this.near) {
      event.preventDefault();
      this.landNearby();
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    this.keys.delete(key);
  };

  private readonly onBlur = () => {
    this.keys.clear();
  };

  private readonly onClick = (event: MouseEvent) => {
    if (!this.inputEnabled) return;
    const hit = this.labels.find(
      ({ box }) =>
        event.offsetX >= box.x &&
        event.offsetX <= box.x + box.width &&
        event.offsetY >= box.y &&
        event.offsetY <= box.y + box.height,
    );
    const point = this.toWorld(event.offsetX, event.offsetY);
    const island =
      (hit && this.island(hit.id)) ??
      this.islands.find((i) => Math.hypot(point.x - i.x, point.y - i.y) < i.r * 1.15);
    if (island) this.flyTo(island.id);
    else this.flyToPoint(point);
  };

  private readonly onSchemeChange = () => {
    this.palette = readPalette(this.options.paletteSource);
    this.buildSprites();
  };

  private keyDirection(): Point | null {
    let x = 0;
    let y = 0;
    for (const key of this.keys) {
      const direction = KEY_DIRECTIONS[key];
      if (direction) {
        x += direction.x;
        y += direction.y;
      }
    }
    const length = Math.hypot(x, y);
    return length ? { x: x / length, y: y / length } : null;
  }

  // Simulation

  private readonly frame = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (!this.options.reducedMotion) this.time += dt;
    this.update(dt);
    this.render();
    if (this.running) this.frameId = requestAnimationFrame(this.frame);
  };

  private update(dt: number) {
    switch (this.mode) {
      case 'parked':
        return;
      case 'landing': {
        this.phase = Math.min(1, this.phase + dt / LANDING_TIME);
        const t = ease(this.phase);
        const dock = this.target?.point ?? this.position;
        this.position = {
          x: this.landingFrom.x + (dock.x - this.landingFrom.x) * t,
          y: this.landingFrom.y + (dock.y - this.landingFrom.y) * t,
        };
        this.alt = 1 - t;
        this.bank *= 0.9;
        if (this.phase >= 1) {
          const id = this.target?.island?.id;
          this.mode = 'parked';
          this.parkedAt = id ?? null;
          this.velocity = { x: 0, y: 0 };
          this.target = null;
          if (id) this.options.onLand(id);
        }
        return;
      }
      case 'takingOff': {
        this.phase = Math.min(1, this.phase + dt / TAKEOFF_TIME);
        this.alt = ease(this.phase);
        const speed = 60 + 140 * this.phase;
        this.velocity = { x: Math.cos(this.heading) * speed, y: Math.sin(this.heading) * speed };
        this.move(dt);
        if (this.phase >= 1) this.mode = 'flying';
        return;
      }
      case 'flying':
        this.steer(dt);
        this.move(dt);
        return;
    }
  }

  private steer(dt: number) {
    const input = this.inputEnabled ? this.keyDirection() : null;
    let desired: Point | null = null;

    if (input) {
      desired = { x: input.x * MAX_SPEED, y: input.y * MAX_SPEED };
    } else if (this.target) {
      const dx = this.target.point.x - this.position.x;
      const dy = this.target.point.y - this.position.y;
      const distance = Math.hypot(dx, dy);
      if (distance < ARRIVE_DISTANCE) {
        if (this.target.island) {
          this.mode = 'landing';
          this.phase = 0;
          this.landingFrom = { ...this.position };
          return;
        }
        this.target = null;
      } else {
        const speed = clamp(distance * 1.8, 140, MAX_SPEED);
        desired = { x: (dx / distance) * speed, y: (dy / distance) * speed };
      }
    }

    if (desired) {
      const blend = 1 - Math.exp(-dt * 3.2);
      this.velocity.x += (desired.x - this.velocity.x) * blend;
      this.velocity.y += (desired.y - this.velocity.y) * blend;
    } else {
      // Nothing to do: ease down to cruising speed and circle gently.
      const speed = Math.hypot(this.velocity.x, this.velocity.y) || CRUISE_SPEED;
      const next = speed + (CRUISE_SPEED - speed) * (1 - Math.exp(-dt * 1.5));
      const angle = Math.atan2(this.velocity.y, this.velocity.x) + IDLE_TURN * dt;
      this.velocity = { x: Math.cos(angle) * next, y: Math.sin(angle) * next };
    }

    if (!this.target) this.setNear(this.nearestIsland());
  }

  private move(dt: number) {
    // Soft walls: the plane turns back before it leaves the map.
    if (this.position.x < EDGE) this.velocity.x += (EDGE - this.position.x) * dt * 6;
    if (this.position.x > WORLD_WIDTH - EDGE) {
      this.velocity.x -= (this.position.x - WORLD_WIDTH + EDGE) * dt * 6;
    }
    if (this.position.y < EDGE) this.velocity.y += (EDGE - this.position.y) * dt * 6;
    if (this.position.y > WORLD_HEIGHT - EDGE) {
      this.velocity.y -= (this.position.y - WORLD_HEIGHT + EDGE) * dt * 6;
    }

    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    const speed = Math.hypot(this.velocity.x, this.velocity.y);
    if (speed > 20) {
      const turn = angleDelta(this.heading, Math.atan2(this.velocity.y, this.velocity.x));
      this.heading += turn * (1 - Math.exp(-dt * 7));
      this.bank += (clamp(turn * 2.5, -1, 1) - this.bank) * (1 - Math.exp(-dt * 6));
    }
  }

  private nearestIsland(): IslandId | null {
    const distanceTo = (island: Island) =>
      Math.hypot(this.position.x - island.x, this.position.y - island.y);
    const departed = this.departed ? this.island(this.departed) : undefined;
    if (departed && distanceTo(departed) > departed.r * 1.3) this.departed = null;
    const found = this.islands.find(
      (island) => island.id !== this.departed && distanceTo(island) < island.r * 1.05,
    );
    return found?.id ?? null;
  }

  private setNear(id: IslandId | null) {
    if (id === this.near) return;
    this.near = id;
    this.options.onNear(id);
  }

  // Rendering

  private resize() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (!width || !height) return;
    this.width = width;
    this.height = height;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
    this.zoom = clamp(Math.min(width, height) / 760, 0.55, 1.15);
    this.buildSprites();
    if (!this.running) this.render();
  }

  private buildSprites() {
    const scale = this.zoom * this.dpr;
    this.sprites = new Map(
      this.islands.map((island): [IslandId, HTMLCanvasElement] => [
        island.id,
        renderIslandSprite(island, this.palette, scale),
      ]),
    );
  }

  private toWorld(screenX: number, screenY: number): Point {
    return {
      x: this.camera.x + (screenX - this.width / 2) / this.zoom,
      y: this.camera.y + (screenY - this.height / 2) / this.zoom,
    };
  }

  private updateCamera() {
    const look = this.mode === 'flying' ? 0.35 : 0;
    const goal = {
      x: this.position.x + this.velocity.x * look + this.inset.right / 2 / this.zoom,
      y: this.position.y + this.velocity.y * look + this.inset.bottom / 2 / this.zoom,
    };
    const halfW = this.width / 2 / this.zoom;
    const halfH = this.height / 2 / this.zoom;
    const fit = (value: number, half: number, size: number, extra: number) =>
      half * 2 >= size + extra ? size / 2 + extra / 2 : clamp(value, half, size - half + extra);
    goal.x = fit(goal.x, halfW, WORLD_WIDTH, this.inset.right / this.zoom);
    goal.y = fit(goal.y, halfH, WORLD_HEIGHT, this.inset.bottom / this.zoom);

    if (this.snapCamera || this.options.reducedMotion) {
      this.camera = goal;
      this.snapCamera = false;
      return;
    }
    this.camera.x += (goal.x - this.camera.x) * 0.08;
    this.camera.y += (goal.y - this.camera.y) * 0.08;
  }

  private render() {
    const { ctx, palette: p } = this;
    if (!this.width) return;
    this.updateCamera();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = p.seaDeep;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const scale = this.dpr * this.zoom;
    ctx.setTransform(
      scale,
      0,
      0,
      scale,
      (this.dpr * this.width) / 2 - this.camera.x * scale,
      (this.dpr * this.height) / 2 - this.camera.y * scale,
    );
    const halfW = this.width / 2 / this.zoom;
    const halfH = this.height / 2 / this.zoom;
    drawSea(
      ctx,
      {
        left: this.camera.x - halfW,
        right: this.camera.x + halfW,
        top: this.camera.y - halfH,
        bottom: this.camera.y + halfH,
      },
      this.time,
      p,
    );

    for (const island of this.islands) {
      const foam = this.foam.get(island.id);
      if (foam) drawFoam(ctx, foam, this.time, p);
      const sprite = this.sprites.get(island.id);
      const half = spriteHalfSize(island);
      if (sprite) ctx.drawImage(sprite, island.x - half, island.y - half, half * 2, half * 2);
      drawIslandLife(ctx, island, this.time, p);
    }

    drawPlane(
      ctx,
      { ...this.position, heading: this.heading, bank: this.bank, alt: this.alt },
      this.time,
      p,
    );
    drawClouds(ctx, this.time, p);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const highlighted = this.target?.island?.id ?? this.near;
    this.labels = this.islands.map((island) => {
      const x = (island.x - this.camera.x) * this.zoom + this.width / 2;
      const y = (island.y + island.r * 1.18 - this.camera.y) * this.zoom + this.height / 2;
      return { id: island.id, box: drawLabel(ctx, x, y, island, p, island.id === highlighted) };
    });
  }
}
