// Renders map regions (terrain, walls, objects) into canvases, with a chunk cache for the editor view.
import { DRAW_ORDER, MapData, MapObject, T, TERRAIN, objectBounds } from './map';
import { terrainPattern } from './patterns';
import { OBJECT_BY_TYPE, drawObject } from './objects';
import { hash2 } from './rng';
import { hexAt, hexCenter, hexCorners, hexesInRect, hexKey, hexNeighbors, isHex } from './grid';

const FLOORS = new Set<T>([T.Stone, T.Wood]);

const ORDER = new Int8Array(32).fill(-1);
DRAW_ORDER.forEach((t, i) => (ORDER[t] = i));

// Marching-squares segments per case. Corners: a=TL(8) b=TR(4) c=BR(2) d=BL(1). Edges: 0=T 1=R 2=B 3=L.
const CASES: number[][] = [
  [], [3, 2], [2, 1], [3, 1], [0, 1], [0, 3, 1, 2], [0, 2], [0, 3],
  [3, 0], [0, 2], [0, 1, 3, 2], [0, 1], [3, 1], [1, 2], [3, 2], [],
];

/**
 * Smooth outline of terrain `k` over tiles [gx0,gx1)x[gy0,gy1), as a Path2D in tile units.
 * The region also extends under neighbouring tiles of terrains drawn later, so no gaps show at seams.
 * Tiles past the map edge copy the nearest edge tile; contours are closed by a ring of empty samples
 * outside the window, which is far enough out to be clipped away.
 */
function organicPath(map: MapData, k: T, gx0: number, gy0: number, gx1: number, gy1: number): Path2D {
  const ok = ORDER[k];
  const at = (x: number, y: number) => map.terrain[Math.min(map.height - 1, Math.max(0, y)) * map.width + Math.min(map.width - 1, Math.max(0, x))] as T;
  return contourPath((x, y) => {
    const t = at(x, y);
    if (t === k) return true;
    if (t !== T.Void && ORDER[t] > ok) {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (at(x + dx, y + dy) === k) return true;
    }
    return false;
  }, gx0, gy0, gx1, gy1, 0.2);
}

/** Smoothed outline of the tiles where `inside` is true, over the window [gx0,gx1)x[gy0,gy1). */
export function contourPath(inside: (x: number, y: number) => boolean, gx0: number, gy0: number, gx1: number, gy1: number, wobble: number): Path2D {
  const W = gx1 - gx0 + 2, H = gy1 - gy0 + 2;
  const s = new Uint8Array(W * H);
  for (let sy = 1; sy < H - 1; sy++)
    for (let sx = 1; sx < W - 1; sx++) s[sy * W + sx] = inside(gx0 + sx - 1, gy0 + sy - 1) ? 1 : 0;

  // Points are edge midpoints; keys use doubled world coordinates so they are integers.
  const adj = new Map<number, number[]>();
  const key = (kx: number, ky: number) => (kx + 64) * 131072 + (ky + 64);
  const link = (a: number, b: number) => {
    let la = adj.get(a); if (!la) adj.set(a, (la = []));
    let lb = adj.get(b); if (!lb) adj.set(b, (lb = []));
    la.push(b); lb.push(a);
  };
  for (let sy = 0; sy < H - 1; sy++)
    for (let sx = 0; sx < W - 1; sx++) {
      const c = (s[sy * W + sx] << 3) | (s[sy * W + sx + 1] << 2) | (s[(sy + 1) * W + sx + 1] << 1) | s[(sy + 1) * W + sx];
      const segs = CASES[c];
      if (!segs.length) continue;
      // Doubled coords of this cell's top-left sample center.
      const bx = 2 * (gx0 + sx - 1) + 1, by = 2 * (gy0 + sy - 1) + 1;
      const ek = [key(bx + 1, by), key(bx + 2, by + 1), key(bx + 1, by + 2), key(bx, by + 1)];
      for (let i = 0; i < segs.length; i += 2) link(ek[segs[i]], ek[segs[i + 1]]);
    }

  const path = new Path2D();
  const seen = new Set<number>();
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const pts: number[] = [];
    let prev = -1, cur = start;
    while (!seen.has(cur)) {
      seen.add(cur);
      const kx = Math.floor(cur / 131072) - 64, ky = (cur % 131072) - 64;
      // Gentle deterministic wobble so edges look hand-drawn.
      pts.push(kx / 2 + (hash2(kx, ky, 71) - 0.5) * wobble, ky / 2 + (hash2(kx, ky, 72) - 0.5) * wobble);
      const n = adj.get(cur)!;
      const next = n[0] !== prev ? n[0] : n[1];
      prev = cur;
      cur = next;
    }
    if (pts.length < 6) continue;
    let p = pts;
    for (let it = 0; it < 2; it++) {
      const q: number[] = [];
      const m = p.length / 2;
      for (let i = 0; i < m; i++) {
        const ax = p[i * 2], ay = p[i * 2 + 1], bx = p[((i + 1) % m) * 2], by = p[((i + 1) % m) * 2 + 1];
        q.push(ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25, ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75);
      }
      p = q;
    }
    path.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) path.lineTo(p[i], p[i + 1]);
    path.closePath();
  }
  return path;
}

function edgeSolid(a: T, b: T): boolean {
  if (FLOORS.has(a) && b === T.Void) return true;
  if (a === T.Wall && b !== T.Wall && b !== T.Void) return true;
  return false;
}

/**
 * Draw tiles [x0,x1) x [y0,y1) into ctx at `scale` px per tile.
 * ctx's current transform is treated as the canvas origin for (x0,y0).
 */
export function renderRegion(
  ctx: CanvasRenderingContext2D,
  map: MapData,
  x0: number, y0: number, x1: number, y1: number,
  scale: number,
  objects = true,
) {
  ctx.save();
  ctx.transform(scale, 0, 0, scale, -x0 * scale, -y0 * scale);
  ctx.beginPath();
  ctx.rect(x0, y0, x1 - x0, y1 - y0);
  ctx.clip();

  ctx.fillStyle = terrainPattern(ctx, T.Void);
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

  const m = 2;
  const ax0 = Math.max(0, x0 - m), ay0 = Math.max(0, y0 - m);
  const ax1 = Math.min(map.width, x1 + m), ay1 = Math.min(map.height, y1 + m);

  const allHex = hexTerrain(map);
  // Bucket tiles by terrain (not needed when every hex is drawn whole).
  const buckets = new Map<T, number[]>();
  if (!allHex)
  for (let y = ay0; y < ay1; y++) {
    for (let x = ax0; x < ax1; x++) {
      const t = map.terrain[y * map.width + x] as T;
      if (t === T.Void) continue;
      let b = buckets.get(t);
      if (!b) { b = []; buckets.set(t, b); }
      b.push(x, y);
    }
  }

  for (const t of DRAW_ORDER) {
    const tiles = buckets.get(t);
    if (!tiles) continue;
    const def = TERRAIN[t];
    if (def.organic) {
      const p = organicPath(map, t, x0 - 3, y0 - 3, x1 + 3, y1 + 3);
      if (t === T.Lava) {
        ctx.save();
        ctx.shadowColor = 'rgba(255,110,20,0.9)';
        ctx.shadowBlur = 0.7 * scale;
        ctx.strokeStyle = 'rgba(255,120,30,0.6)';
        ctx.lineWidth = 0.35;
        ctx.stroke(p);
        ctx.restore();
      }
      ctx.fillStyle = terrainPattern(ctx, t);
      ctx.fill(p, 'evenodd');
      if (def.rim) {
        ctx.strokeStyle = def.rim;
        ctx.lineWidth = t === T.CaveFloor ? 0.26 : 0.16;
        ctx.lineJoin = 'round';
        ctx.stroke(p);
      } else if (t === T.Water || t === T.DeepWater) {
        ctx.strokeStyle = t === T.Water ? 'rgba(230,245,255,0.35)' : 'rgba(150,200,230,0.25)';
        ctx.lineWidth = 0.08;
        ctx.stroke(p);
      }
    } else {
      const p = new Path2D();
      for (let i = 0; i < tiles.length; i += 2) p.rect(tiles[i], tiles[i + 1], 1, 1);
      ctx.fillStyle = terrainPattern(ctx, t);
      ctx.fill(p);
    }
  }

  if (allHex) renderHexCells(ctx, map, x0, y0, x1, y1, true);
  else if (map.hexCells.size && isHex(map.grid)) renderHexCells(ctx, map, x0, y0, x1, y1);

  // Wall lines where floors meet solid rock, and around built walls.
  const walls = new Path2D();
  const shadowPath = new Path2D();
  // Squares under painted hexes get their outline from the hex edges instead.
  const hexes = map.hexCells.size > 0 && isHex(map.grid) && !allHex;
  const inHexCell = (x: number, y: number) => {
    const h = hexAt(map.grid, x + 0.5, y + 0.5);
    return map.hexCells.has(hexKey(h.q, h.r));
  };
  if (!allHex) for (let y = ay0; y < ay1; y++) {
    for (let x = ax0; x < ax1; x++) {
      const a = map.terrain[y * map.width + x] as T;
      if (!FLOORS.has(a) && a !== T.Wall) continue;
      if (hexes && (inHexCell(x, y) || inHexCell(x - 1, y) || inHexCell(x + 1, y) || inHexCell(x, y - 1) || inHexCell(x, y + 1))) continue;
      const n = map.get(x, y - 1), s = map.get(x, y + 1), w = map.get(x - 1, y), e = map.get(x + 1, y);
      if (edgeSolid(a, n)) { walls.moveTo(x, y); walls.lineTo(x + 1, y); if (FLOORS.has(a)) shadowPath.rect(x, y, 1, 0.28); }
      if (edgeSolid(a, s)) { walls.moveTo(x, y + 1); walls.lineTo(x + 1, y + 1); }
      if (edgeSolid(a, w)) { walls.moveTo(x, y); walls.lineTo(x, y + 1); if (FLOORS.has(a)) shadowPath.rect(x, y, 0.28, 1); }
      if (edgeSolid(a, e)) { walls.moveTo(x + 1, y); walls.lineTo(x + 1, y + 1); }
    }
  }
  if (allHex) addHexWalls(map, x0, y0, x1, y1, walls, true);
  else if (hexes) addHexWalls(map, x0, y0, x1, y1, walls);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fill(shadowPath);
  ctx.lineCap = 'square';
  ctx.strokeStyle = '#14100d';
  ctx.lineWidth = 0.18;
  ctx.stroke(walls);

  renderElevation(ctx, map, x0, y0, x1, y1, scale);

  if (objects) {
    const pad = 2.5;
    const list = map.objects
      .filter((o) => {
        const b = objectBounds(o);
        return b.x < x1 + pad && b.x + b.w > x0 - pad && b.y < y1 + pad && b.y + b.h > y0 - pad;
      });
    list.sort(compareObjects);
    for (const o of list) drawObject(ctx, o);
  }
  ctx.restore();
}

/** On a hex grid the terrain itself is drawn as hexes, unless the map is set to square terrain. */
export const hexTerrain = (map: MapData) => isHex(map.grid) && !map.grid.squares;

/** Terrain of a hex: its painted value, or the square under its centre (clamped to the map). */
function hexTerrainOf(map: MapData, q: number, r: number): T {
  const t = map.hexCells.get(hexKey(q, r));
  if (t !== undefined) return t;
  const c = hexCenter(map.grid, q, r);
  return map.terrain[Math.min(map.height - 1, Math.max(0, Math.floor(c.y))) * map.width + Math.min(map.width - 1, Math.max(0, Math.floor(c.x)))] as T;
}
function hexLevelOf(map: MapData, q: number, r: number): number {
  const e = map.hexElev.get(hexKey(q, r));
  if (e !== undefined) return e;
  const c = hexCenter(map.grid, q, r);
  return map.getElev(Math.floor(c.x), Math.floor(c.y));
}

/** Terrain painted with the hex brush (or, with `all`, every hex) drawn as true hexagons. */
function renderHexCells(ctx: CanvasRenderingContext2D, map: MapData, x0: number, y0: number, x1: number, y1: number, all = false) {
  const g = map.grid;
  const { q0, q1, r0, r1 } = hexesInRect(g, x0, y0, x1, y1);
  const byTerrain = new Map<T, Path2D>();
  for (let r = r0; r <= r1; r++)
    for (let q = q0; q <= q1; q++) {
      const t = all ? hexTerrainOf(map, q, r) : map.hexCells.get(hexKey(q, r));
      if (t === undefined) continue;
      let p = byTerrain.get(t);
      if (!p) byTerrain.set(t, (p = new Path2D()));
      // Grown slightly so neighbouring hexes overlap instead of leaving hairline seams.
      const c = hexCorners(g, q, r, 0.02);
      p.moveTo(c[0], c[1]);
      for (let i = 2; i < 12; i += 2) p.lineTo(c[i], c[i + 1]);
      p.closePath();
    }
  for (const t of DRAW_ORDER.concat(T.Void)) {
    const p = byTerrain.get(t);
    if (!p) continue;
    ctx.fillStyle = terrainPattern(ctx, t);
    ctx.fill(p);
    if (t === T.Lava) {
      ctx.strokeStyle = 'rgba(255,140,40,0.55)';
      ctx.lineWidth = 0.08;
      ctx.stroke(p);
    }
  }
}

/** Outline painted floor and wall hexes where they meet solid rock (or floors, for walls). */
function addHexWalls(map: MapData, x0: number, y0: number, x1: number, y1: number, walls: Path2D, all = false) {
  const g = map.grid;
  const terrainOf = (q: number, r: number) => hexTerrainOf(map, q, r);
  const { q0, q1, r0, r1 } = hexesInRect(g, x0 - 1, y0 - 1, x1 + 1, y1 + 1);
  for (let r = r0; r <= r1; r++)
    for (let q = q0; q <= q1; q++) {
      const a = all ? terrainOf(q, r) : map.hexCells.get(hexKey(q, r));
      // Cave floor gets an edge against solid rock too, like its rim on square maps.
      const cave = a === T.CaveFloor;
      if (a === undefined || (!FLOORS.has(a) && a !== T.Wall && !cave)) continue;
      const corners = hexCorners(g, q, r);
      for (const n of hexNeighbors(q, r)) {
        const nt = terrainOf(n.q, n.r);
        if (!(cave ? nt === T.Void : edgeSolid(a, nt))) continue;
        // The shared edge is formed by the two corners nearest the neighbour's centre.
        const nc = hexCenter(g, n.q, n.r);
        const idx = [0, 1, 2, 3, 4, 5].sort((i, j) =>
          Math.hypot(corners[i * 2] - nc.x, corners[i * 2 + 1] - nc.y) - Math.hypot(corners[j * 2] - nc.x, corners[j * 2 + 1] - nc.y));
        walls.moveTo(corners[idx[0] * 2], corners[idx[0] * 2 + 1]);
        walls.lineTo(corners[idx[1] * 2], corners[idx[1] * 2 + 1]);
      }
    }
}

/** Default paint order by type: floor coverings, clutter, furniture, buildings, trees, labels. */
export function defaultLayer(type: string): number {
  if (type === 'label') return 6;
  const layer = OBJECT_BY_TYPE.get(type)?.layer;
  if (layer !== undefined) return layer;
  if (type === 'tree' || type === 'pine' || type === 'deadtree' || type === 'palm') return 5;
  if (type === 'house' || type === 'tower') return 4;
  if (type === 'torch' || type === 'campfire' || type === 'lantern') return 3;
  if (type === 'rug' || type === 'trap' || type === 'lilypad' || type === 'campfire_unlit') return 0;
  return 1;
}

export function compareObjects(a: MapObject, b: MapObject): number {
  return (a.z ?? 0) - (b.z ?? 0) || defaultLayer(a.type) - defaultLayer(b.type) || a.y - b.y || a.id - b.id;
}

/**
 * Raised ground casts a soft shadow down-right onto lower ground, with a dark edge and a lit rim.
 * Pits (below 0) are darkened.
 */
function renderElevation(ctx: CanvasRenderingContext2D, map: MapData, x0: number, y0: number, x1: number, y1: number, scale: number) {
  const m = 5;
  const ex0 = Math.max(0, x0 - m), ey0 = Math.max(0, y0 - m), ex1 = Math.min(map.width, x1 + m), ey1 = Math.min(map.height, y1 + m);
  let minE = 0, maxE = 0;
  for (let y = ey0; y < ey1; y++)
    for (let x = ex0; x < ex1; x++) {
      const e = map.elevation[y * map.width + x];
      if (e < minE) minE = e;
      if (e > maxE) maxE = e;
    }
  if (minE === maxE) return;
  const W = x1 - x0, H = y1 - y0;
  // Heights painted with the hex brush get hex-shaped cliffs; everything else uses smoothed tile contours.
  const allHex = hexTerrain(map);
  const hexes = map.hexElev.size > 0 && isHex(map.grid);
  const underHex = (x: number, y: number) => {
    const h = hexAt(map.grid, Math.min(map.width - 1, Math.max(0, x)) + 0.5, Math.min(map.height - 1, Math.max(0, y)) + 0.5);
    return map.hexElev.has(hexKey(h.q, h.r));
  };
  for (let L = minE + 1; L <= maxE; L++) {
    if (allHex) {
      const hx = hexElevationPaths(map, L, x0, y0, x1, y1, true);
      if (hx) drawElevationStep(ctx, hx.high, hx.edges, L, x0, y0, W, H, scale);
      continue;
    }
    const high = contourPath((x, y) => map.getElev(x, y) >= L && !(hexes && underHex(x, y)), x0 - 4, y0 - 4, x1 + 4, y1 + 4, 0.08);
    drawElevationStep(ctx, high, high, L, x0, y0, W, H, scale);
    if (hexes) {
      const hx = hexElevationPaths(map, L, x0, y0, x1, y1);
      if (hx) drawElevationStep(ctx, hx.high, hx.edges, L, x0, y0, W, H, scale);
    }
  }
}

/** Hex-shaped raised area for level L (painted hexes at or above L) and its outer edges. */
function hexElevationPaths(map: MapData, L: number, x0: number, y0: number, x1: number, y1: number, all = false) {
  const g = map.grid;
  const levelOf = (q: number, r: number) => hexLevelOf(map, q, r);
  const high = new Path2D(), edges = new Path2D();
  let any = false;
  const { q0, q1, r0, r1 } = hexesInRect(g, x0 - 5, y0 - 5, x1 + 5, y1 + 5);
  for (let r = r0; r <= r1; r++)
    for (let q = q0; q <= q1; q++) {
      const e = all ? levelOf(q, r) : map.hexElev.get(hexKey(q, r));
      if (e === undefined || e < L) continue;
      any = true;
      const c = hexCorners(g, q, r);
      high.moveTo(c[0], c[1]);
      for (let i = 2; i < 12; i += 2) high.lineTo(c[i], c[i + 1]);
      high.closePath();
      for (const n of hexNeighbors(q, r)) {
        if (levelOf(n.q, n.r) >= L) continue;
        const nc = hexCenter(g, n.q, n.r);
        const idx = [0, 1, 2, 3, 4, 5].sort((i, j) =>
          Math.hypot(c[i * 2] - nc.x, c[i * 2 + 1] - nc.y) - Math.hypot(c[j * 2] - nc.x, c[j * 2 + 1] - nc.y));
        edges.moveTo(c[idx[0] * 2], c[idx[0] * 2 + 1]);
        edges.lineTo(c[idx[1] * 2], c[idx[1] * 2 + 1]);
      }
    }
  return any ? { high, edges } : null;
}

/** One height step: shadow cast onto the lower side, pit darkening or lift, then the lit rim and dark cliff edge. */
function drawElevationStep(ctx: CanvasRenderingContext2D, high: Path2D, edges: Path2D, L: number, x0: number, y0: number, W: number, H: number, scale: number) {
  const outside = new Path2D();
  outside.rect(x0 - 6, y0 - 6, W + 12, H + 12);
  outside.addPath(high);

  // Shadow falling onto the lower side: draw the shape far away so only its blurred, offset shadow lands here.
  ctx.save();
  ctx.clip(outside, 'evenodd');
  const far = 2000;
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 0.35 * scale;
  ctx.shadowOffsetX = (-far + 0.32) * scale;
  ctx.shadowOffsetY = 0.42 * scale;
  ctx.translate(far, 0);
  ctx.fillStyle = '#000';
  ctx.fill(high, 'evenodd');
  ctx.restore();

  if (L <= 0) {
    // Below-ground side of this step is a pit: darken it.
    ctx.save();
    ctx.clip(outside, 'evenodd');
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(x0 - 6, y0 - 6, W + 12, H + 12);
    ctx.restore();
  } else {
    ctx.fillStyle = 'rgba(255,240,210,0.05)';
    ctx.fill(high, 'evenodd');
  }
  // Lit top rim, then the dark cliff edge.
  ctx.save();
  ctx.clip(high, 'evenodd');
  ctx.translate(0.07, 0.07);
  ctx.strokeStyle = 'rgba(255,245,225,0.32)';
  ctx.lineWidth = 0.1;
  ctx.stroke(edges);
  ctx.restore();
  ctx.strokeStyle = 'rgba(22,16,10,0.85)';
  ctx.lineWidth = 0.1;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke(edges);
}

export const CHUNK = 16;

interface CacheEntry {
  canvas: HTMLCanvasElement;
  version: number;
}

/** Caches rendered chunks of the map at a few resolutions. */
export class ChunkCache {
  private cache = new Map<string, CacheEntry>();
  private versions: Int32Array;
  private cols: number;
  private rows: number;
  private pixelBudget = 80_000_000;
  private pixels = 0;

  constructor(private map: MapData) {
    this.cols = Math.ceil(map.width / CHUNK);
    this.rows = Math.ceil(map.height / CHUNK);
    this.versions = new Int32Array(this.cols * this.rows);
  }

  setMap(map: MapData) {
    this.map = map;
    this.cols = Math.ceil(map.width / CHUNK);
    this.rows = Math.ceil(map.height / CHUNK);
    this.versions = new Int32Array(this.cols * this.rows);
    this.cache.clear();
    this.pixels = 0;
  }

  invalidateAll() {
    for (let i = 0; i < this.versions.length; i++) this.versions[i]++;
  }

  /** Invalidate chunks touching a tile rect (with margin for blended edges and object overhang). */
  invalidateRect(x: number, y: number, w: number, h: number, margin = 3) {
    const cx0 = Math.max(0, Math.floor((x - margin) / CHUNK));
    const cy0 = Math.max(0, Math.floor((y - margin) / CHUNK));
    const cx1 = Math.min(this.cols - 1, Math.floor((x + w + margin) / CHUNK));
    const cy1 = Math.min(this.rows - 1, Math.floor((y + h + margin) / CHUNK));
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) this.versions[cy * this.cols + cx]++;
  }

  isFresh(cx: number, cy: number, res: number): boolean {
    const hit = this.cache.get(`${cx},${cy},${res}`);
    return !!hit && hit.version === this.versions[cy * this.cols + cx];
  }

  /** Any up-to-date rendering of the chunk, at whatever resolution, for use while a sharper one renders. */
  anyFresh(cx: number, cy: number): HTMLCanvasElement | null {
    for (const res of [64, 32, 16, 8]) if (this.isFresh(cx, cy, res)) return this.cache.get(`${cx},${cy},${res}`)!.canvas;
    return null;
  }

  get(cx: number, cy: number, res: number): HTMLCanvasElement {
    const key = `${cx},${cy},${res}`;
    const version = this.versions[cy * this.cols + cx];
    const hit = this.cache.get(key);
    if (hit && hit.version === version) {
      this.cache.delete(key);
      this.cache.set(key, hit);
      return hit.canvas;
    }
    const canvas = hit?.canvas ?? document.createElement('canvas');
    const x0 = cx * CHUNK, y0 = cy * CHUNK;
    const x1 = Math.min(this.map.width, x0 + CHUNK), y1 = Math.min(this.map.height, y0 + CHUNK);
    const w = (x1 - x0) * res, h = (y1 - y0) * res;
    if (!hit) this.pixels += w * h;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    renderRegion(ctx, this.map, x0, y0, x1, y1, res);
    this.cache.delete(key);
    this.cache.set(key, { canvas, version });
    this.evict();
    return canvas;
  }

  private evict() {
    while (this.pixels > this.pixelBudget && this.cache.size > 1) {
      const [key, entry] = this.cache.entries().next().value as [string, CacheEntry];
      this.pixels -= entry.canvas.width * entry.canvas.height;
      this.cache.delete(key);
    }
  }
}
