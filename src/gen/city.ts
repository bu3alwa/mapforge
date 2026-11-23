import { MapData, Rect, T } from '../map';
import { CLOTH_COLORS, ROOF_COLORS } from '../objects';
import { fbm, valueNoise } from '../rng';
import { Generator, GenContext, edgePoint, inRegion, scatterNatural, stampLine, wobblyLine } from './common';

const SIZE_CFG: Record<string, { radius: number; grid: boolean; block: number }> = {
  hamlet: { radius: 0.3, grid: false, block: 0 },
  village: { radius: 0.45, grid: false, block: 0 },
  town: { radius: 0.7, grid: true, block: 16 },
  city: { radius: 0.92, grid: true, block: 13 },
};

export const cityGenerator: Generator = {
  id: 'city',
  name: 'Town & city',
  description: 'Settlements auto-filled with streets, houses, a market square, walls and farms.',
  params: [
    { key: 'size', label: 'Size', type: 'select', default: 'town', options: [
      { value: 'hamlet', label: 'Hamlet' }, { value: 'village', label: 'Village' }, { value: 'town', label: 'Town' }, { value: 'city', label: 'City' },
    ] },
    { key: 'density', label: 'Building density', type: 'range', min: 0.3, max: 1, step: 0.05, default: 0.8 },
    { key: 'walls', label: 'City walls', type: 'bool', default: true },
    { key: 'river', label: 'River', type: 'bool', default: false },
    { key: 'farms', label: 'Farmland', type: 'bool', default: true },
  ],
  run(ctx, p) {
    const { map, region: r, rng } = ctx;
    const cfg = SIZE_CFG[String(p.size)] ?? SIZE_CFG.town;
    const density = Number(p.density);
    const noise = valueNoise(rng);
    const roofNoise = valueNoise(rng);

    // Base ground.
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) map.set(x, y, fbm(noise, x / 7, y / 7, 2) < 0.3 ? T.Dirt : T.Grass);

    const cx = r.x + r.w / 2 + rng.range(-0.05, 0.05) * r.w;
    const cy = r.y + r.h / 2 + rng.range(-0.05, 0.05) * r.h;
    const rx = (r.w / 2) * cfg.radius, ry = (r.h / 2) * cfg.radius;
    /** 0 at center, 1 at the edge of town. */
    const dist = (x: number, y: number) => Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry) + (fbm(noise, x / 9 + 30, y / 9, 2) - 0.5) * 0.25;
    const walled = Boolean(p.walls) && cfg.grid && rx > 10 && ry > 10;
    const wallAt = 0.97;

    // River.
    const river = new Set<number>();
    if (p.river) {
      const s0 = rng.int(0, 1) * 1; // top->bottom or right->left
      const a = edgePoint(rng, r, s0), b = edgePoint(rng, r, s0 + 2);
      const pts = wobblyLine(rng, a[0], a[1], b[0], b[1], 0.15);
      const width = Math.max(3, Math.min(r.w, r.h) * 0.06);
      stampLine(pts, width + 2, (x, y) => { if (inRegion(r, x, y)) map.set(x, y, T.Sand); });
      stampLine(pts, width, (x, y) => { if (inRegion(r, x, y)) { map.set(x, y, T.Water); river.add(y * map.width + x); } });
      stampLine(pts, width * 0.45, (x, y) => { if (inRegion(r, x, y)) map.set(x, y, T.DeepWater); });
    }
    const isWater = (x: number, y: number) => { const t = map.get(x, y); return t === T.Water || t === T.DeepWater; };

    // Main roads: two avenues through the center, extending to the region edges.
    const ax = Math.floor(cx), ay = Math.floor(cy);
    const roadW = cfg.grid ? 2 : 2;
    const setRoad = (x: number, y: number) => {
      if (!inRegion(r, x, y)) return;
      if (isWater(x, y) || map.get(x, y) === T.Wood) { map.set(x, y, T.Wood); return; }
      map.set(x, y, dist(x, y) < (walled ? wallAt : 1.05) ? T.Cobble : T.Dirt);
    };
    const villageRoad = new Set<number>();
    if (cfg.grid) {
      for (let x = r.x; x < r.x + r.w; x++) for (let k = 0; k < roadW; k++) setRoad(x, ay + k);
      for (let y = r.y; y < r.y + r.h; y++) for (let k = 0; k < roadW; k++) setRoad(ax + k, y);
    } else {
      // Villages: winding roads meeting at a green.
      const sides = rng.shuffle([0, 1, 2, 3]).slice(0, p.size === 'hamlet' ? 2 : 3);
      for (const s of sides) {
        const e = edgePoint(rng, r, s);
        const pts = wobblyLine(rng, cx, cy, e[0], e[1], 0.12, 5);
        stampLine(pts, 2, (x, y) => {
          if (!inRegion(r, x, y)) return;
          map.set(x, y, isWater(x, y) || map.get(x, y) === T.Wood ? T.Wood : T.Dirt);
          villageRoad.add(y * map.width + x);
        });
      }
    }

    // Blocks via recursive subdivision with streets.
    const blocks: Rect[] = [];
    if (cfg.grid) {
      const bx0 = Math.floor(cx - rx) - 1, by0 = Math.floor(cy - ry) - 1;
      const bx1 = Math.ceil(cx + rx) + 1, by1 = Math.ceil(cy + ry) + 1;
      const quads: Rect[] = [
        { x: bx0, y: by0, w: ax - bx0, h: ay - by0 },
        { x: ax + roadW, y: by0, w: bx1 - ax - roadW, h: ay - by0 },
        { x: bx0, y: ay + roadW, w: ax - bx0, h: by1 - ay - roadW },
        { x: ax + roadW, y: ay + roadW, w: bx1 - ax - roadW, h: by1 - ay - roadW },
      ];
      const streetTile = (x: number, y: number) => {
        if (!inRegion(r, x, y) || isWater(x, y)) return;
        if (dist(x, y) < (walled ? wallAt - 0.03 : 1)) map.set(x, y, T.Cobble);
      };
      const subdivide = (b: Rect, depth: number) => {
        const d = dist(b.x + b.w / 2, b.y + b.h / 2);
        const maxBlock = cfg.block * (d < 0.5 ? 0.85 : 1.25);
        if ((b.w <= maxBlock && b.h <= maxBlock) || b.w < 9 && b.h < 9 || depth > 9) { blocks.push(b); return; }
        const horiz = b.h > b.w ? true : b.w > b.h ? false : rng.chance(0.5);
        const len = horiz ? b.h : b.w;
        if (len < 9) { blocks.push(b); return; }
        const at = Math.floor(len * rng.range(0.35, 0.65));
        if (horiz) {
          for (let x = b.x; x < b.x + b.w; x++) streetTile(x, b.y + at);
          subdivide({ x: b.x, y: b.y, w: b.w, h: at }, depth + 1);
          subdivide({ x: b.x, y: b.y + at + 1, w: b.w, h: b.h - at - 1 }, depth + 1);
        } else {
          for (let y = b.y; y < b.y + b.h; y++) streetTile(b.x + at, y);
          subdivide({ x: b.x, y: b.y, w: at, h: b.h }, depth + 1);
          subdivide({ x: b.x + at + 1, y: b.y, w: b.w - at - 1, h: b.h }, depth + 1);
        }
      };
      for (const q of quads) if (q.w > 0 && q.h > 0) subdivide(q, 0);
    }

    // City wall ring with gates and towers.
    const wallTiles: [number, number][] = [];
    if (walled) {
      for (let y = r.y; y < r.y + r.h; y++)
        for (let x = r.x; x < r.x + r.w; x++) {
          const d = dist(x, y);
          if (d >= wallAt && d < wallAt + 1.6 / Math.min(rx, ry)) {
            const t = map.get(x, y);
            if (t === T.Cobble || t === T.Dirt && (x === ax || x === ax + 1 || y === ay || y === ay + 1)) continue; // gates
            if (isWater(x, y)) continue;
            map.set(x, y, T.Wall);
            wallTiles.push([x, y]);
          }
        }
      // Towers at regular angles around the ring, plus gatehouses.
      const towers = Math.max(6, Math.round((rx + ry) / 5));
      for (let i = 0; i < towers; i++) {
        const a = (i / towers) * Math.PI * 2 + 0.2;
        let best: [number, number] | null = null, bd = Infinity;
        for (const [x, y] of wallTiles) {
          const ang = Math.atan2((y + 0.5 - cy) / ry, (x + 0.5 - cx) / rx);
          const da = Math.abs(Math.atan2(Math.sin(ang - a), Math.cos(ang - a)));
          if (da < bd) { bd = da; best = [x, y]; }
        }
        if (best && bd < 0.2) map.addObject({ type: 'tower', x: best[0] + 0.5, y: best[1] + 0.5, w: 2.6, h: 2.6, rot: 0, color: '#5b6470' });
      }
    }

    // Market square at the center.
    const plazaR = cfg.grid ? Math.max(3, Math.min(rx, ry) * 0.16) : 3.2;
    for (let y = Math.floor(cy - plazaR); y <= cy + plazaR; y++)
      for (let x = Math.floor(cx - plazaR); x <= cx + plazaR; x++) {
        if (!inRegion(r, x, y) || isWater(x, y)) continue;
        const inside = cfg.grid ? Math.abs(x + 0.5 - cx) <= plazaR && Math.abs(y + 0.5 - cy) <= plazaR : Math.hypot(x + 0.5 - cx, y + 0.5 - cy) < plazaR;
        if (inside) map.set(x, y, cfg.grid ? T.Cobble : T.Grass);
      }
    const plazaRect: Rect = { x: cx - plazaR - 0.5, y: cy - plazaR - 0.5, w: plazaR * 2 + 1, h: plazaR * 2 + 1 };
    if (cfg.grid) {
      map.addObject({ type: 'fountain', x: ax + 1, y: ay + 1, w: 3, h: 3, rot: 0 });
      const stalls = Math.round(plazaR * 1.5);
      for (let i = 0; i < stalls; i++) {
        const a = (i / stalls) * Math.PI * 2;
        const sx = cx + Math.cos(a) * plazaR * 0.75, sy = cy + Math.sin(a) * plazaR * 0.75;
        map.addObject({ type: 'stall', x: sx, y: sy, w: 2, h: 1.5, rot: Math.round(a / (Math.PI / 2)) * (Math.PI / 2) + Math.PI / 2, color: rng.pick(CLOTH_COLORS) });
      }
    } else {
      map.addObject({ type: 'well', x: cx, y: cy, w: 1.4, h: 1.4, rot: 0 });
      map.addObject({ type: 'tree', x: cx + 2, y: cy - 1.5, w: 2.2, h: 2.2, rot: 0 });
    }

    const occupied = new Uint8Array(map.width * map.height);
    const markOcc = (x0: number, y0: number, w: number, h: number) => {
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (map.inBounds(x, y)) occupied[y * map.width + x] = 1;
    };
    // Reserve the plaza and wall.
    for (let y = Math.floor(plazaRect.y); y < plazaRect.y + plazaRect.h; y++)
      for (let x = Math.floor(plazaRect.x); x < plazaRect.x + plazaRect.w; x++) if (map.inBounds(x, y)) occupied[y * map.width + x] = 1;
    for (const [x, y] of wallTiles) markOcc(x - 1, y - 1, 3, 3);

    const buildable = (x: number, y: number) => {
      if (!inRegion(r, x, y) || occupied[y * map.width + x]) return false;
      const t = map.get(x, y);
      return t === T.Grass || t === T.Dirt;
    };
    const areaFree = (x0: number, y0: number, w: number, h: number) => {
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (!buildable(x, y)) return false;
      return true;
    };
    const roofColor = (x: number, y: number) => {
      const v = fbm(roofNoise, x / 18, y / 18, 2);
      const base = Math.floor(v * ROOF_COLORS.length * 1.4) % ROOF_COLORS.length;
      return rng.chance(0.75) ? ROOF_COLORS[base] : rng.pick(ROOF_COLORS);
    };
    const placeHouse = (x0: number, y0: number, w: number, h: number) => {
      if (w < 2 || h < 2 || !areaFree(x0, y0, w, h)) return false;
      markOcc(x0, y0, w, h);
      map.addObject({ type: 'house', x: x0 + w / 2, y: y0 + h / 2, w, h, rot: 0, color: roofColor(x0, y0) });
      return true;
    };

    if (cfg.grid) {
      fillBlocks(ctx, blocks, dist, density, walled ? wallAt : 1.05, placeHouse, buildable, markOcc, map);
      // Suburbs: houses along the main roads outside the walls.
      housesAlongRoad(ctx, (x, y) => map.get(x, y) === T.Dirt && (x === ax || x === ax + 1 || y === ay || y === ay + 1), dist, 1.0, 1.6, density * 0.6, placeHouse);
    } else {
      housesAlongRoad(ctx, (x, y) => villageRoad.has(y * map.width + x) && map.get(x, y) === T.Dirt, dist, 0, 1.25, density, placeHouse);
    }

    // Farmland around the settlement.
    if (p.farms) {
      const fields = Math.round((r.w * r.h) / 300);
      for (let i = 0; i < fields * 3 && i < 400; i++) {
        const fw = rng.int(5, 11), fh = rng.int(4, 9);
        const fx = r.x + rng.int(0, Math.max(0, r.w - fw)), fy = r.y + rng.int(0, Math.max(0, r.h - fh));
        const d = dist(fx + fw / 2, fy + fh / 2);
        if (d < 1.15 || d > 2.4) continue;
        if (!areaFree(fx - 1, fy - 1, fw + 2, fh + 2)) continue;
        for (let y = fy; y < fy + fh; y++) for (let x = fx; x < fx + fw; x++) map.set(x, y, T.Field);
        markOcc(fx - 1, fy - 1, fw + 2, fh + 2);
        if (rng.chance(0.4)) placeHouse(fx + fw + 1, fy, 3, 2);
      }
    }

    // Greenery and clutter.
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) {
        if (!buildable(x, y)) continue;
        const d = dist(x, y);
        const roll = rng.next();
        const near = d < 1;
        if (roll < (near ? 0.02 : 0.035)) scatterNatural(ctx, x, y, d > 1.6 && rng.chance(0.4) ? 'pine' : 'tree', near ? 1.5 : 1.8);
        else if (roll < (near ? 0.035 : 0.06)) scatterNatural(ctx, x, y, 'bush', 0.8);
        else if (near && roll < 0.042) map.addObject({ type: rng.chance(0.5) ? 'barrel' : 'crate', x: x + 0.5, y: y + 0.5, w: 0.6, h: 0.6, rot: rng.range(-0.3, 0.3) });
      }

    // Keep objects off roads and water (except bridges/stalls/fountain we placed deliberately).
    const keep = new Set(['stall', 'fountain', 'well', 'tower']);
    map.objects = map.objects.filter((o) => {
      if (keep.has(o.type) || o.type === 'house') return true;
      if (!inRegion(r, Math.floor(o.x), Math.floor(o.y))) return true;
      const t = map.get(Math.floor(o.x), Math.floor(o.y));
      return !(t === T.Cobble || t === T.Water || t === T.DeepWater || t === T.Wood || t === T.Wall || t === T.Field);
    });
    void river;
  },
};

type PlaceHouse = (x0: number, y0: number, w: number, h: number) => boolean;

/** Pack houses along block edges, facing the street. */
function fillBlocks(
  ctx: GenContext,
  blocks: Rect[],
  dist: (x: number, y: number) => number,
  density: number,
  limit: number,
  placeHouse: PlaceHouse,
  buildable: (x: number, y: number) => boolean,
  markOcc: (x: number, y: number, w: number, h: number) => void,
  map: MapData,
) {
  const { rng } = ctx;
  for (const b of blocks) {
    const d = dist(b.x + b.w / 2, b.y + b.h / 2);
    if (d > limit) continue;
    // Occasionally a special building fills most of the block.
    if (b.w >= 9 && b.h >= 9 && rng.chance(0.08)) {
      const w = b.w - 3, h = b.h - 3;
      if (placeHouse(b.x + 1, b.y + 1, Math.min(w, 10), Math.min(h, 7))) {
        map.objects[map.objects.length - 1].color = rng.pick(['#5b6470', '#4f5d6e', '#7a3f3a']);
        continue;
      }
    }
    if (b.w >= 10 && b.h >= 10 && rng.chance(0.06)) {
      // Small graveyard / park.
      for (let y = b.y + 1; y < b.y + b.h - 1; y += 2)
        for (let x = b.x + 1; x < b.x + b.w - 1; x += 2)
          if (buildable(x, y) && rng.chance(0.6)) map.addObject({ type: rng.chance(0.75) ? 'grave' : 'tree', x: x + 0.5, y: y + 0.5, w: 0.6, h: 0.9, rot: 0 });
      markOcc(b.x, b.y, b.w, b.h);
      continue;
    }
    const fill = Math.min(1, Math.max(0.15, density * (1.35 - d * 0.75)));
    const depthMax = b.h >= 8 && b.w >= 8 ? Math.floor(Math.min(b.w, b.h) / 2) : Math.min(b.w, b.h);
    const runEdge = (horizontal: boolean, top: boolean) => {
      const len = horizontal ? b.w : b.h;
      let pos = 0;
      while (pos < len - 1) {
        const hw = rng.int(3, 5);
        const hd = Math.min(depthMax, rng.int(3, 6));
        if (pos + hw > len) break;
        if (rng.chance(fill)) {
          const gap = rng.chance(0.1 + d * 0.3) ? 1 : 0;
          let x0, y0, w, h;
          if (horizontal) { x0 = b.x + pos; w = hw; h = hd - gap; y0 = top ? b.y : b.y + b.h - h; }
          else { y0 = b.y + pos; h = hw; w = hd - gap; x0 = top ? b.x : b.x + b.w - w; }
          if (dist(x0 + w / 2, y0 + h / 2) < limit) placeHouse(x0, y0, w, h);
        }
        pos += hw + (rng.chance(0.08 + d * 0.35) ? 1 : 0);
      }
    };
    runEdge(true, true);
    runEdge(true, false);
    runEdge(false, true);
    runEdge(false, false);
    // Back-lot buildings (workshops, barns) inside larger blocks.
    for (let i = 0; i < Math.floor((b.w * b.h) / 30); i++) {
      if (!rng.chance(fill * 0.8)) continue;
      const w = rng.int(2, 4), h = rng.int(2, 3);
      const x0 = b.x + rng.int(1, Math.max(1, b.w - w - 1)), y0 = b.y + rng.int(1, Math.max(1, b.h - h - 1));
      if (buildable(x0 - 1, y0 - 1) && buildable(x0 + w, y0 + h) && buildable(x0 - 1, y0 + h) && buildable(x0 + w, y0 - 1)) placeHouse(x0, y0, w, h);
    }
  }
}

/** Place houses beside road tiles within a distance band. */
function housesAlongRoad(
  ctx: GenContext,
  isRoad: (x: number, y: number) => boolean,
  dist: (x: number, y: number) => number,
  dMin: number,
  dMax: number,
  density: number,
  placeHouse: PlaceHouse,
) {
  const { region: r, rng } = ctx;
  const cand: [number, number][] = [];
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (isRoad(x, y)) cand.push([x, y]);
  rng.shuffle(cand);
  for (const [x, y] of cand) {
    const d = dist(x, y);
    if (d < dMin || d > dMax || !rng.chance(density * 0.35 * (1.2 - (d - dMin) / Math.max(0.1, dMax - dMin)))) continue;
    const w = rng.int(3, 5), h = rng.int(3, 4);
    const side = rng.int(0, 3);
    const off = 1;
    const spots: [number, number, number, number][] = [
      [x - Math.floor(w / 2), y - h - off, w, h],
      [x - Math.floor(w / 2), y + 1 + off - 1, w, h],
      [x - w - off, y - Math.floor(h / 2), w, h],
      [x + 1 + off - 1, y - Math.floor(h / 2), w, h],
    ];
    const [sx, sy, sw, sh] = spots[side];
    placeHouse(sx, sy, sw, sh);
  }
}
