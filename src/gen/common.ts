import { MapData, Rect, T } from '../map';
import { Rng } from '../rng';

export interface ParamDef {
  key: string;
  label: string;
  type: 'range' | 'select' | 'bool';
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  default: number | string | boolean;
}

export type Params = Record<string, number | string | boolean>;

export interface GenContext {
  map: MapData;
  region: Rect;
  rng: Rng;
}

export interface Generator {
  id: string;
  name: string;
  description: string;
  params: ParamDef[];
  run(ctx: GenContext, p: Params): void;
}

export function fillRegion(ctx: GenContext, t: T) {
  const { map, region: r } = ctx;
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) map.set(x, y, t);
}

export function inRegion(r: Rect, x: number, y: number) {
  return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
}

/** Flood-fill labelled components of cells where pred is true. Returns component index per cell (-1 = none). */
export function components(w: number, h: number, pred: (i: number) => boolean): { labels: Int32Array; sizes: number[] } {
  const labels = new Int32Array(w * h).fill(-1);
  const sizes: number[] = [];
  const stack: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (labels[i] !== -1 || !pred(i)) continue;
    const id = sizes.length;
    let size = 0;
    stack.push(i);
    labels[i] = id;
    while (stack.length) {
      const c = stack.pop()!;
      size++;
      const x = c % w, y = (c / w) | 0;
      const nb = [x > 0 ? c - 1 : -1, x < w - 1 ? c + 1 : -1, y > 0 ? c - w : -1, y < h - 1 ? c + w : -1];
      for (const n of nb) {
        if (n >= 0 && labels[n] === -1 && pred(n)) { labels[n] = id; stack.push(n); }
      }
    }
    sizes.push(size);
  }
  return { labels, sizes };
}

/** A wobbly polyline between two points, made by midpoint displacement. */
export function wobblyLine(rng: Rng, ax: number, ay: number, bx: number, by: number, rough: number, depth = 6): [number, number][] {
  let pts: [number, number][] = [[ax, ay], [bx, by]];
  let amp = Math.hypot(bx - ax, by - ay) * rough;
  for (let d = 0; d < depth; d++) {
    const next: [number, number][] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      const len = Math.hypot(x1 - x0, y1 - y0) || 1;
      const nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
      const off = rng.range(-amp, amp);
      next.push([(x0 + x1) / 2 + nx * off, (y0 + y1) / 2 + ny * off], pts[i + 1]);
    }
    pts = next;
    amp *= 0.5;
  }
  return pts;
}

/** Stamp a thick polyline into the map. `fn` is called for each tile covered. */
export function stampLine(pts: [number, number][], width: number, fn: (x: number, y: number) => void) {
  const r = width / 2;
  const seen = new Set<number>();
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 3) + 1;
    for (let s = 0; s <= steps; s++) {
      const px = x0 + ((x1 - x0) * s) / steps, py = y0 + ((y1 - y0) * s) / steps;
      for (let y = Math.floor(py - r); y <= Math.ceil(py + r); y++)
        for (let x = Math.floor(px - r); x <= Math.ceil(px + r); x++) {
          if ((x + 0.5 - px) ** 2 + (y + 0.5 - py) ** 2 > r * r + 0.01) continue;
          const k = y * 100000 + x;
          if (seen.has(k)) continue;
          seen.add(k);
          fn(x, y);
        }
    }
  }
}

/** Random point on a region edge. side: 0 top, 1 right, 2 bottom, 3 left. */
export function edgePoint(rng: Rng, r: Rect, side: number): [number, number] {
  const t = rng.range(0.25, 0.75);
  switch (side) {
    case 0: return [r.x + r.w * t, r.y];
    case 1: return [r.x + r.w, r.y + r.h * t];
    case 2: return [r.x + r.w * t, r.y + r.h];
    default: return [r.x, r.y + r.h * t];
  }
}

/** Remove objects whose centers fall on tiles matching pred. */
export function clearObjectsWhere(map: MapData, pred: (x: number, y: number) => boolean) {
  map.objects = map.objects.filter((o) => !pred(Math.floor(o.x), Math.floor(o.y)));
}

export function scatterNatural(ctx: GenContext, x: number, y: number, type: string, size: number) {
  const { rng, map } = ctx;
  const s = size * rng.range(0.8, 1.25);
  map.addObject({
    type,
    x: x + rng.range(0.15, 0.85),
    y: y + rng.range(0.15, 0.85),
    w: s,
    h: s,
    rot: rng.range(0, Math.PI * 2),
  });
}
