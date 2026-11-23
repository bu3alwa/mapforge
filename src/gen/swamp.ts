import { T } from '../map';
import { fbm, quantile, valueNoise } from '../rng';
import { Generator, edgePoint, inRegion, scatterNatural, stampLine, wobblyLine } from './common';

export const swampGenerator: Generator = {
  id: 'swamp',
  name: 'Swamp & marsh',
  description: 'Murky pools, mud flats and reed beds, with dead trees, lily pads and an optional boardwalk or witch hut.',
  params: [
    { key: 'water', label: 'Standing water', type: 'range', min: 0.15, max: 0.7, step: 0.01, default: 0.4 },
    { key: 'trees', label: 'Trees', type: 'range', min: 0, max: 1, step: 0.05, default: 0.45 },
    { key: 'boardwalk', label: 'Boardwalk', type: 'bool', default: true },
    { key: 'hut', label: 'Witch hut', type: 'bool', default: true },
  ],
  run(ctx, p) {
    const { map, region: r, rng } = ctx;
    const w = r.w, h = r.h;
    const n = valueNoise(rng), m = valueNoise(rng);
    const vals = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) vals[y * w + x] = fbm(n, x / 8, y / 8, 4);
    const wq = quantile(vals, 1 - Number(p.water));
    const deep = quantile(vals, 1 - Number(p.water) * 0.3);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const v = vals[y * w + x];
        const mv = fbm(m, x / 5, y / 5, 2);
        let t: T = mv > 0.55 ? T.Grass : T.Dirt;
        if (v > deep) t = T.DeepWater;
        else if (v > wq) t = T.Water;
        else if (v > wq - 0.03) t = T.Dirt;
        else if (mv < 0.35) t = T.Forest;
        map.set(r.x + x, r.y + y, t);
        if (t === T.DeepWater || t === T.Water) map.setElev(r.x + x, r.y + y, -1);
      }

    let hut: [number, number] | null = null;
    if (p.hut && w > 14 && h > 14) {
      // Find a dry patch for the hut.
      for (let tries = 0; tries < 200 && !hut; tries++) {
        const x = r.x + rng.int(4, w - 8), y = r.y + rng.int(4, h - 8);
        let dry = true;
        for (let yy = y - 1; yy < y + 5 && dry; yy++) for (let xx = x - 1; xx < x + 5; xx++) if (map.get(xx, yy) === T.Water || map.get(xx, yy) === T.DeepWater) { dry = false; break; }
        if (dry) hut = [x, y];
      }
      if (hut) {
        const [x, y] = hut;
        for (let yy = y - 2; yy < y + 6; yy++) for (let xx = x - 2; xx < x + 6; xx++) if (inRegion(r, xx, yy) && map.get(xx, yy) !== T.Water && map.get(xx, yy) !== T.DeepWater) map.set(xx, yy, T.Dirt);
        map.addObject({ type: 'house', x: x + 2, y: y + 1.5, w: 4, h: 3, rot: 0, color: '#6b7a4a' });
        map.addObject({ type: 'cauldron', x: x + 2, y: y + 4.2, w: 1, h: 1, rot: 0 });
        map.addObject({ type: 'campfire_unlit', x: x - 0.8, y: y + 4, w: 1, h: 1, rot: 0 });
        map.addObject({ type: 'firewood', x: x + 4.6, y: y + 4, w: 1.1, h: 0.6, rot: 0.3 });
      }
    }

    if (p.boardwalk) {
      const s0 = rng.int(0, 3);
      const a = edgePoint(rng, r, s0);
      const b: [number, number] = hut ? [hut[0] + 2, hut[1] + 5] : edgePoint(rng, r, (s0 + 2) % 4);
      const pts = wobblyLine(rng, a[0], a[1], b[0], b[1], 0.12, 4);
      stampLine(pts, 1.6, (x, y) => {
        if (!inRegion(r, x, y)) return;
        const t = map.get(x, y);
        if (t === T.Water || t === T.DeepWater) { map.set(x, y, T.Wood); map.setElev(x, y, 0); }
        else if (t !== T.Wood) map.set(x, y, T.Dirt);
      });
    }

    const tree = Number(p.trees);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const tx = r.x + x, ty = r.y + y;
        const t = map.get(tx, ty);
        const roll = rng.next();
        const nearHut = hut && Math.abs(tx - hut[0] - 2) < 5 && Math.abs(ty - hut[1] - 2) < 5;
        if (nearHut) continue;
        if (t === T.Water) {
          if (roll < 0.06) scatterNatural(ctx, tx, ty, 'lilypad', 0.9);
          else if (roll < 0.1) scatterNatural(ctx, tx, ty, 'reeds', 0.9);
        } else if (t === T.DeepWater) {
          if (roll < 0.03) scatterNatural(ctx, tx, ty, 'lilypad', 0.9);
        } else if (t === T.Dirt || t === T.Grass) {
          if (roll < 0.12) scatterNatural(ctx, tx, ty, 'reeds', 0.9);
          else if (roll < 0.12 + tree * 0.06) scatterNatural(ctx, tx, ty, rng.chance(0.6) ? 'deadtree' : 'tree', 1.6);
          else if (roll < 0.2 + tree * 0.06) scatterNatural(ctx, tx, ty, rng.chance(0.5) ? 'bush' : 'mushroom', 0.8);
        } else if (t === T.Forest) {
          if (roll < tree * 0.5) scatterNatural(ctx, tx, ty, rng.chance(0.5) ? 'deadtree' : 'tree', 1.8);
          else if (roll < tree * 0.5 + 0.1) scatterNatural(ctx, tx, ty, 'bush', 0.9);
          else if (roll < tree * 0.5 + 0.12) map.addObject({ type: 'log', x: tx + 0.5, y: ty + 0.5, w: 2.4, h: 0.6, rot: rng.range(0, Math.PI) });
        }
      }
    map.objects = map.objects.filter((o) => !(inRegion(r, Math.floor(o.x), Math.floor(o.y)) && map.get(Math.floor(o.x), Math.floor(o.y)) === T.Wood));
  },
};
