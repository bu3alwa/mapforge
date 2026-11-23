// Procedural, tileable textures for each terrain.
import { T, TERRAIN } from './map';
import { Rng } from './rng';

export const PAT_RES = 64; // pattern pixels per tile
const SIZE = PAT_RES * 2; // patterns span 2x2 tiles

type Ctx = CanvasRenderingContext2D;

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt))));
  r = f(r); g = f(g); b = f(b);
  return `rgb(${r},${g},${b})`;
}
export { shade };

/** Draw at (x,y) and at all wrapped copies so the texture tiles seamlessly. */
function wrap(draw: (x: number, y: number) => void, x: number, y: number) {
  for (const dx of [-SIZE, 0, SIZE]) for (const dy of [-SIZE, 0, SIZE]) draw(x + dx, y + dy);
}

function speckle(c: Ctx, rng: Rng, n: number, colors: string[], rmin: number, rmax: number, alpha = 1) {
  c.globalAlpha = alpha;
  for (let i = 0; i < n; i++) {
    const x = rng.next() * SIZE, y = rng.next() * SIZE, r = rng.range(rmin, rmax);
    c.fillStyle = rng.pick(colors);
    wrap((px, py) => { c.beginPath(); c.arc(px, py, r, 0, Math.PI * 2); c.fill(); }, x, y);
  }
  c.globalAlpha = 1;
}

function blotches(c: Ctx, rng: Rng, base: string, n: number, spread: number, rmin: number, rmax: number) {
  for (let i = 0; i < n; i++) {
    const x = rng.next() * SIZE, y = rng.next() * SIZE, r = rng.range(rmin, rmax);
    c.fillStyle = shade(base, rng.range(-spread, spread));
    c.globalAlpha = 0.35;
    wrap((px, py) => { c.beginPath(); c.arc(px, py, r, 0, Math.PI * 2); c.fill(); }, x, y);
  }
  c.globalAlpha = 1;
}

function drawTexture(t: T, c: Ctx) {
  const base = TERRAIN[t].color;
  const rng = new Rng(1000 + t);
  c.fillStyle = base;
  c.fillRect(0, 0, SIZE, SIZE);
  const P = PAT_RES;
  switch (t) {
    case T.Void: {
      blotches(c, rng, base, 40, 0.12, 6, 18);
      speckle(c, rng, 160, [shade(base, -0.35), shade(base, 0.15)], 0.6, 1.6, 0.6);
      break;
    }
    case T.Grass:
    case T.Forest: {
      blotches(c, rng, base, 50, 0.12, 6, 16);
      c.lineWidth = 1.2;
      c.lineCap = 'round';
      for (let i = 0; i < 260; i++) {
        const x = rng.next() * SIZE, y = rng.next() * SIZE;
        c.strokeStyle = shade(base, rng.range(-0.3, 0.25));
        const dx = rng.range(-2, 2), dy = -rng.range(2, 5);
        wrap((px, py) => { c.beginPath(); c.moveTo(px, py); c.lineTo(px + dx, py + dy); c.stroke(); }, x, y);
      }
      break;
    }
    case T.Dirt:
    case T.Basalt: {
      blotches(c, rng, base, 60, 0.18, 4, 14);
      speckle(c, rng, 220, [shade(base, -0.35), shade(base, 0.2)], 0.6, 1.8, 0.8);
      break;
    }
    case T.Sand:
    case T.Snow: {
      blotches(c, rng, base, 40, 0.06, 8, 20);
      speckle(c, rng, 300, [shade(base, -0.15), shade(base, 0.2)], 0.4, 1.0, 0.8);
      break;
    }
    case T.Water:
    case T.DeepWater: {
      blotches(c, rng, base, 30, 0.08, 10, 24);
      c.strokeStyle = shade(base, 0.25);
      c.lineWidth = 1.2;
      c.globalAlpha = 0.5;
      for (let i = 0; i < 14; i++) {
        const x = rng.next() * SIZE, y = rng.next() * SIZE, l = rng.range(8, 18);
        wrap((px, py) => {
          c.beginPath();
          c.moveTo(px, py);
          c.quadraticCurveTo(px + l / 2, py - 3, px + l, py);
          c.stroke();
        }, x, y);
      }
      c.globalAlpha = 1;
      break;
    }
    case T.Lava: {
      blotches(c, rng, base, 40, 0.25, 8, 22);
      speckle(c, rng, 40, ['#ffd23a', '#ffae2a'], 2, 7, 0.7);
      c.strokeStyle = '#7a1e08';
      c.lineWidth = 2.2;
      c.globalAlpha = 0.6;
      for (let i = 0; i < 10; i++) {
        let x = rng.next() * SIZE, y = rng.next() * SIZE;
        const pts: [number, number][] = [[x, y]];
        for (let k = 0; k < 4; k++) { x += rng.range(-14, 14); y += rng.range(-14, 14); pts.push([x, y]); }
        wrap((px, py) => {
          c.beginPath();
          c.moveTo(pts[0][0] + px - pts[0][0], pts[0][1] + py - pts[0][1]);
          for (const [ax, ay] of pts) c.lineTo(ax + px - pts[0][0], ay + py - pts[0][1]);
          c.stroke();
        }, pts[0][0], pts[0][1]);
      }
      c.globalAlpha = 1;
      break;
    }
    case T.Mountain:
    case T.CaveFloor: {
      blotches(c, rng, base, 60, 0.15, 5, 16);
      speckle(c, rng, 200, [shade(base, -0.3), shade(base, 0.2)], 0.5, 1.6, 0.7);
      break;
    }
    case T.Field: {
      c.strokeStyle = shade(base, -0.22);
      c.lineWidth = 3;
      for (let y = 4; y < SIZE; y += 10) { c.beginPath(); c.moveTo(0, y); c.lineTo(SIZE, y); c.stroke(); }
      speckle(c, rng, 200, [shade(base, 0.2), '#8a9a48'], 0.8, 1.8, 0.7);
      break;
    }
    case T.Cobble: {
      c.fillStyle = shade(base, -0.35);
      c.fillRect(0, 0, SIZE, SIZE);
      for (let gy = 0; gy < SIZE; gy += 11) {
        const off = (gy / 11) % 2 ? 6 : 0;
        for (let gx = -11; gx < SIZE; gx += 12) {
          const w = rng.range(8, 11), h = rng.range(7, 9.5);
          c.fillStyle = shade(base, rng.range(-0.12, 0.12));
          c.beginPath();
          c.roundRect(gx + off + 1, gy + 1, w, h, 3);
          c.fill();
        }
      }
      break;
    }
    case T.Stone: {
      // Flagstones aligned to the tile grid.
      c.fillStyle = shade(base, -0.3);
      c.fillRect(0, 0, SIZE, SIZE);
      for (let ty = 0; ty < 2; ty++)
        for (let tx = 0; tx < 2; tx++) {
          c.fillStyle = shade(base, rng.range(-0.08, 0.08));
          c.fillRect(tx * P + 1.5, ty * P + 1.5, P - 3, P - 3);
        }
      speckle(c, rng, 140, [shade(base, -0.2), shade(base, 0.18)], 0.5, 1.4, 0.6);
      break;
    }
    case T.Wood: {
      const plank = P / 4;
      for (let i = 0; i < SIZE / plank; i++) {
        c.fillStyle = shade(base, rng.range(-0.1, 0.1));
        c.fillRect(0, i * plank, SIZE, plank);
        c.fillStyle = shade(base, -0.4);
        c.fillRect(0, i * plank, SIZE, 1.2);
        const j = rng.range(0, SIZE);
        c.fillRect(j, i * plank, 1.2, plank);
      }
      break;
    }
    case T.Wall: {
      const bh = P / 3;
      c.fillStyle = shade(base, -0.4);
      c.fillRect(0, 0, SIZE, SIZE);
      for (let r = 0; r < SIZE / bh; r++) {
        const off = r % 2 ? P / 3 : 0;
        for (let x = -P; x < SIZE; x += (P * 2) / 3) {
          c.fillStyle = shade(base, rng.range(-0.1, 0.12));
          c.fillRect(x + off + 1, r * bh + 1, (P * 2) / 3 - 2, bh - 2);
        }
      }
      break;
    }
  }
}

const canvases = new Map<T, HTMLCanvasElement>();
const patterns = new WeakMap<CanvasRenderingContext2D, Map<T, CanvasPattern>>();

export function textureCanvas(t: T): HTMLCanvasElement {
  let cv = canvases.get(t);
  if (!cv) {
    cv = document.createElement('canvas');
    cv.width = cv.height = SIZE;
    drawTexture(t, cv.getContext('2d')!);
    canvases.set(t, cv);
  }
  return cv;
}

/** Pattern usable in a context whose units are tiles. */
export function terrainPattern(ctx: CanvasRenderingContext2D, t: T): CanvasPattern {
  let m = patterns.get(ctx);
  if (!m) { m = new Map(); patterns.set(ctx, m); }
  let p = m.get(t);
  if (!p) {
    p = ctx.createPattern(textureCanvas(t), 'repeat')!;
    p.setTransform(new DOMMatrix().scale(1 / PAT_RES));
    m.set(t, p);
  }
  return p;
}
