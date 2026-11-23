import { T } from '../map';
import { fbm, quantile, valueNoise } from '../rng';
import { Generator, clearObjectsWhere, edgePoint, scatterNatural, stampLine, wobblyLine, inRegion } from './common';

export const forestGenerator: Generator = {
  id: 'forest',
  name: 'Forest',
  description: 'Woodland with clearings, a winding trail and an optional stream.',
  params: [
    { key: 'density', label: 'Tree cover', type: 'range', min: 0.2, max: 0.95, step: 0.05, default: 0.65 },
    { key: 'kind', label: 'Trees', type: 'select', default: 'mixed', options: [
      { value: 'mixed', label: 'Mixed' }, { value: 'leafy', label: 'Broadleaf' }, { value: 'pine', label: 'Pine' }, { value: 'dead', label: 'Dead / blighted' },
    ] },
    { key: 'path', label: 'Trail', type: 'bool', default: true },
    { key: 'stream', label: 'Stream', type: 'bool', default: true },
    { key: 'camp', label: 'Campsite clearing', type: 'bool', default: true },
    { key: 'hills', label: 'Hills & ridges (height)', type: 'bool', default: false },
  ],
  run(ctx, p) {
    const { map, region: r, rng } = ctx;
    const w = r.w, h = r.h;
    const n = valueNoise(rng), n2 = valueNoise(rng), hn = valueNoise(rng);
    const vals = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) vals[y * w + x] = fbm(n, x / 11, y / 11, 4);
    const q = quantile(vals, 1 - Number(p.density));
    const kind = String(p.kind);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const v = vals[y * w + x];
        map.set(r.x + x, r.y + y, v > q ? T.Forest : fbm(n2, x / 6, y / 6, 2) < 0.32 ? T.Dirt : T.Grass);
        if (p.hills) {
          const hv = fbm(hn, x / 18 + 11, y / 18, 3);
          map.setElev(r.x + x, r.y + y, hv > 0.66 ? 2 : hv > 0.54 ? 1 : 0);
        }
      }

    // Campsite clearing.
    if (p.camp && w > 12 && h > 12) {
      const cx = r.x + rng.int(6, w - 7), cy = r.y + rng.int(6, h - 7), rad = rng.range(3, 4.5);
      for (let y = Math.floor(cy - rad); y <= cy + rad; y++)
        for (let x = Math.floor(cx - rad); x <= cx + rad; x++)
          if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) < rad && inRegion(r, x, y)) map.set(x, y, Math.hypot(x + 0.5 - cx, y + 0.5 - cy) < 1.6 ? T.Dirt : T.Grass);
      map.addObject({ type: 'campfire', x: cx, y: cy, w: 1, h: 1, rot: 0 });
      map.addObject({ type: 'tent', x: cx - 2.3, y: cy - 1.8, w: 2, h: 2, rot: 0.3, color: '#7a6a4a' });
      map.addObject({ type: 'tent', x: cx + 2.2, y: cy - 1.4, w: 2, h: 2, rot: -0.2, color: '#5a6a4a' });
      map.addObject({ type: 'crate', x: cx + 1.4, y: cy + 1.6, w: 0.7, h: 0.7, rot: 0.2 });
    }

    // Stream.
    if (p.stream) {
      const s0 = rng.int(0, 3);
      const a = edgePoint(rng, r, s0), b = edgePoint(rng, r, (s0 + 2) % 4);
      const pts = wobblyLine(rng, a[0], a[1], b[0], b[1], 0.25);
      const width = rng.range(2.2, 3.4);
      stampLine(pts, width + 1.6, (x, y) => { if (inRegion(r, x, y) && map.get(x, y) !== T.Water) map.set(x, y, rng.chance(0.5) ? T.Sand : T.Dirt); });
      // The stream cuts down to ground level, sitting one step lower.
      stampLine(pts, width + 1.6, (x, y) => { if (inRegion(r, x, y)) map.setElev(x, y, 0); });
      stampLine(pts, width, (x, y) => { if (inRegion(r, x, y)) { map.set(x, y, T.Water); map.setElev(x, y, -1); } });
    }
    // Trail, with a bridge where it crosses water.
    if (p.path) {
      const s0 = rng.int(0, 3);
      const a = edgePoint(rng, r, s0), b = edgePoint(rng, r, (s0 + 1 + rng.int(0, 2)) % 4);
      const pts = wobblyLine(rng, a[0], a[1], b[0], b[1], 0.2);
      stampLine(pts, 2, (x, y) => {
        if (!inRegion(r, x, y)) return;
        const t = map.get(x, y);
        map.set(x, y, t === T.Water || t === T.DeepWater ? T.Wood : T.Dirt);
        if (t === T.Water || t === T.DeepWater) map.setElev(x, y, 0);
      });
    }

    const pickTree = () => {
      if (kind === 'pine') return rng.chance(0.9) ? 'pine' : 'tree';
      if (kind === 'leafy') return rng.chance(0.92) ? 'tree' : 'pine';
      if (kind === 'dead') return rng.chance(0.8) ? 'deadtree' : 'pine';
      return rng.chance(0.6) ? 'tree' : 'pine';
    };
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const t = map.get(r.x + x, r.y + y);
        const roll = rng.next();
        if (t === T.Forest) {
          if (roll < 0.62) scatterNatural(ctx, r.x + x, r.y + y, pickTree(), 1.8);
          else if (roll < 0.72) scatterNatural(ctx, r.x + x, r.y + y, 'bush', 0.9);
          else if (roll < 0.74) scatterNatural(ctx, r.x + x, r.y + y, kind === 'dead' ? 'mushroom' : 'rock', 0.8);
        } else if (t === T.Grass) {
          if (roll < 0.04) scatterNatural(ctx, r.x + x, r.y + y, pickTree(), 1.6);
          else if (roll < 0.08) scatterNatural(ctx, r.x + x, r.y + y, 'bush', 0.8);
          else if (roll < 0.09) scatterNatural(ctx, r.x + x, r.y + y, 'rock', 0.7);
        }
      }
    // Keep trails, water and the camp free of clutter.
    clearObjectsWhere(map, (x, y) => {
      const t = map.get(x, y);
      return inRegion(r, x, y) && (t === T.Water || t === T.Wood);
    });
    const trailTiles = (x: number, y: number) => inRegion(r, x, y) && map.get(x, y) === T.Dirt;
    map.objects = map.objects.filter((o) => o.type === 'campfire' || o.type === 'tent' || o.type === 'crate' || !(trailTiles(Math.floor(o.x), Math.floor(o.y)) && (o.type === 'tree' || o.type === 'pine' || o.type === 'deadtree')));
  },
};
