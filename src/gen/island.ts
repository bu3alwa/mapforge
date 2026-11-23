import { T } from '../map';
import { fbm, quantile, valueNoise } from '../rng';
import { Generator, scatterNatural } from './common';

export const islandGenerator: Generator = {
  id: 'island',
  name: 'Islands & coasts',
  description: 'Islands, archipelagos, coastlines and lakes with beaches, forests and peaks.',
  params: [
    { key: 'shape', label: 'Shape', type: 'select', default: 'island', options: [
      { value: 'island', label: 'Single island' }, { value: 'archipelago', label: 'Archipelago' },
      { value: 'coast', label: 'Coastline' }, { value: 'lake', label: 'Lake' },
    ] },
    { key: 'land', label: 'Land amount', type: 'range', min: 0.15, max: 0.85, step: 0.01, default: 0.45 },
    { key: 'forest', label: 'Forest', type: 'range', min: 0, max: 1, step: 0.05, default: 0.45 },
    { key: 'mountains', label: 'Mountains', type: 'bool', default: true },
    { key: 'cliffs', label: 'Cliffs & highlands (height)', type: 'bool', default: true },
    { key: 'climate', label: 'Climate', type: 'select', default: 'temperate', options: [
      { value: 'temperate', label: 'Temperate' }, { value: 'tropical', label: 'Tropical' }, { value: 'arctic', label: 'Arctic' }, { value: 'desert', label: 'Desert' },
    ] },
  ],
  run(ctx, p) {
    const { map, region: r, rng } = ctx;
    const w = r.w, h = r.h;
    const shape = String(p.shape);
    const noise = valueNoise(rng), moist = valueNoise(rng);
    const scale = Math.max(w, h) / (shape === 'archipelago' ? 7 : 3.5);
    const ox = rng.range(0, 500), oy = rng.range(0, 500);
    const side = rng.int(0, 3);
    const e = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const nx = (x + 0.5) / w * 2 - 1, ny = (y + 0.5) / h * 2 - 1;
        const n = fbm(noise, ox + x / scale, oy + y / scale, 5);
        const d = Math.min(1, Math.hypot(nx, ny) / Math.SQRT2 * 1.25);
        let v = n;
        if (shape === 'island') v = n * 0.75 + (1 - d * d) * 0.6;
        else if (shape === 'archipelago') v = n * 0.9 + (1 - d * d) * 0.25;
        else if (shape === 'lake') v = n * 0.75 + d * d * 0.6;
        else {
          const g = side === 0 ? -ny : side === 1 ? nx : side === 2 ? ny : -nx; // land toward one side
          v = n * 0.75 + (g + 1) * 0.3;
        }
        e[y * w + x] = v;
      }
    const sea = quantile(e, 1 - Number(p.land));
    const landVals = Array.from(e).filter((v) => v >= sea);
    const beach = quantile(landVals, 0.08);
    const peak = quantile(landVals, 0.9);
    const snow = quantile(landVals, 0.975);
    const shallow = sea - (sea - quantile(e, 0)) * 0.18;
    const climate = String(p.climate);
    const forestAmt = Number(p.forest);

    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const v = e[y * w + x];
        const m = fbm(moist, x / 12 + 50, y / 12, 3);
        let t: T;
        const desert = climate === 'desert';
        if (v < shallow) t = T.DeepWater;
        else if (v < sea) t = T.Water;
        else if (v < beach) t = climate === 'arctic' ? T.Snow : T.Sand;
        else if (p.mountains && v > snow) t = desert ? T.Mountain : T.Snow;
        else if (p.mountains && v > peak) t = T.Mountain;
        else if (desert) t = m > 1 - forestAmt * 0.2 ? T.Grass : m < 0.35 ? T.Dirt : T.Sand;
        else if (m > 1 - forestAmt * 0.75 - 0.05) t = T.Forest;
        else if (climate === 'arctic') t = m > 0.5 ? T.Snow : T.Grass;
        else if (m < 0.3 && climate !== 'tropical') t = T.Dirt;
        else t = T.Grass;
        map.set(r.x + x, r.y + y, t);
        if (p.cliffs && v >= sea) {
          // Terraces: each band of height above the shoreline becomes one level up.
          const above = (v - beach) / Math.max(0.0001, peak - beach);
          map.setElev(r.x + x, r.y + y, v < beach ? 0 : above > 1.15 ? 3 : above > 0.75 ? 2 : above > 0.4 ? 1 : 0);
        }
      }

    const treeType = climate === 'arctic' ? 'pine' : climate === 'tropical' ? 'palm' : 'tree';
    if (climate === 'desert') {
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const t = map.get(r.x + x, r.y + y);
          const roll = rng.next();
          if (t === T.Sand && roll < 0.012) scatterNatural(ctx, r.x + x, r.y + y, 'cactus', 0.8);
          else if ((t === T.Sand || t === T.Dirt) && roll < 0.025) scatterNatural(ctx, r.x + x, r.y + y, 'rock', 0.8);
          else if (t === T.Grass && roll < 0.2) scatterNatural(ctx, r.x + x, r.y + y, roll < 0.1 ? 'palm' : 'bush', roll < 0.1 ? 1.7 : 0.8);
          else if (t === T.Mountain && roll < 0.08) scatterNatural(ctx, r.x + x, r.y + y, 'boulder', 1.5);
        }
      return;
    }
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const t = map.get(r.x + x, r.y + y);
        const roll = rng.next();
        if (t === T.Forest) {
          if (roll < 0.5) scatterNatural(ctx, r.x + x, r.y + y, rng.chance(0.25) ? (treeType === 'tree' ? 'pine' : 'tree') : treeType, 1.7);
          else if (roll < 0.58) scatterNatural(ctx, r.x + x, r.y + y, 'bush', 0.9);
        } else if (t === T.Grass || t === T.Snow) {
          if (roll < 0.025) scatterNatural(ctx, r.x + x, r.y + y, treeType, 1.6);
          else if (roll < 0.045) scatterNatural(ctx, r.x + x, r.y + y, 'bush', 0.8);
          else if (roll < 0.05) scatterNatural(ctx, r.x + x, r.y + y, 'rock', 0.7);
        } else if (t === T.Mountain) {
          if (roll < 0.06) scatterNatural(ctx, r.x + x, r.y + y, 'boulder', 1.5);
          else if (roll < 0.12) scatterNatural(ctx, r.x + x, r.y + y, 'rock', 0.8);
        } else if (t === T.Sand && climate === 'tropical' && roll < 0.03) {
          scatterNatural(ctx, r.x + x, r.y + y, 'palm', 1.6);
        }
      }
  },
};
