import { T } from '../map';
import { fbm, valueNoise } from '../rng';
import { Generator, components, scatterNatural, stampLine, wobblyLine } from './common';

export const caveGenerator: Generator = {
  id: 'cave',
  name: 'Caves',
  description: 'Winding natural caverns carved from solid rock.',
  params: [
    { key: 'openness', label: 'Openness', type: 'range', min: 0.3, max: 0.7, step: 0.01, default: 0.52 },
    { key: 'scale', label: 'Chamber size', type: 'range', min: 0.5, max: 2, step: 0.1, default: 1 },
    { key: 'pools', label: 'Pools', type: 'select', default: 'water', options: [
      { value: 'none', label: 'None' }, { value: 'water', label: 'Water' }, { value: 'lava', label: 'Lava' },
    ] },
    { key: 'features', label: 'Stalagmites & crystals', type: 'bool', default: true },
  ],
  run(ctx, p) {
    const { map, region: r, rng } = ctx;
    const w = r.w, h = r.h;
    const noise = valueNoise(rng);
    const scale = Number(p.scale);
    const open = Number(p.openness);
    let best: Uint8Array | null = null;
    let bestCount = 0;

    for (let attempt = 0; attempt < 5; attempt++) {
      // 1 = rock, 0 = open
      let g = new Uint8Array(w * h);
      const ox = rng.range(0, 1000), oy = rng.range(0, 1000);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const border = x < 1 || y < 1 || x >= w - 1 || y >= h - 1;
          const n = fbm(noise, ox + x / (14 * scale), oy + y / (14 * scale), 3);
          const pOpen = open + (n - 0.5) * 0.55;
          g[y * w + x] = border || rng.next() > pOpen ? 1 : 0;
        }
      for (let it = 0; it < 5; it++) {
        const ng = new Uint8Array(w * h);
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            let walls = 0;
            for (let dy = -1; dy <= 1; dy++)
              for (let dx = -1; dx <= 1; dx++) {
                if (!dx && !dy) continue;
                const nx = x + dx, ny = y + dy;
                walls += nx < 0 || ny < 0 || nx >= w || ny >= h ? 1 : g[ny * w + nx];
              }
            const i = y * w + x;
            ng[i] = walls > 4 ? 1 : walls < 4 ? 0 : g[i];
            if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) ng[i] = 1;
          }
        g = ng;
      }
      // Join every sizeable pocket to the main cave with a winding tunnel; drop tiny ones.
      let { labels, sizes } = components(w, h, (i) => g[i] === 0);
      if (!sizes.length) continue;
      let big = 0;
      for (let i = 1; i < sizes.length; i++) if (sizes[i] > sizes[big]) big = i;
      const mainCells: number[] = [];
      for (let i = 0; i < g.length; i++) if (labels[i] === big) mainCells.push(i);
      const firstCell = new Map<number, number>();
      for (let i = 0; i < g.length; i++) if (labels[i] >= 0 && !firstCell.has(labels[i])) firstCell.set(labels[i], i);
      for (let c = 0; c < sizes.length; c++) {
        if (c === big || sizes[c] < 12) continue;
        const from = firstCell.get(c)!;
        const fx = from % w, fy = (from / w) | 0;
        let to = mainCells[0], bd = Infinity;
        for (let k = 0; k < mainCells.length; k += Math.max(1, Math.floor(mainCells.length / 3000))) {
          const m = mainCells[k];
          const d = (m % w - fx) ** 2 + (((m / w) | 0) - fy) ** 2;
          if (d < bd) { bd = d; to = m; }
        }
        const pts = wobblyLine(rng, fx + 0.5, fy + 0.5, (to % w) + 0.5, ((to / w) | 0) + 0.5, 0.25, 4);
        stampLine(pts, rng.range(1.6, 2.6), (x, y) => { if (x > 0 && y > 0 && x < w - 1 && y < h - 1) g[y * w + x] = 0; });
      }
      ({ labels, sizes } = components(w, h, (i) => g[i] === 0));
      big = 0;
      for (let i = 1; i < sizes.length; i++) if (sizes[i] > sizes[big]) big = i;
      for (let i = 0; i < g.length; i++) if (g[i] === 0 && labels[i] !== big) g[i] = 1;
      if (sizes[big] > bestCount) { bestCount = sizes[big]; best = g; }
      if (sizes[big] > w * h * 0.25) break;
    }
    if (!best) return;

    const pools = String(p.pools);
    const pn = valueNoise(rng);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const open = best[y * w + x] === 0;
        let t = open ? T.CaveFloor : T.Void;
        if (open && pools !== 'none') {
          const v = fbm(pn, x / 9, y / 9, 3);
          if (v > 0.66) t = pools === 'lava' ? T.Lava : v > 0.72 ? T.DeepWater : T.Water;
        }
        map.set(r.x + x, r.y + y, t);
      }

    if (p.features) {
      for (let y = 1; y < h - 1; y++)
        for (let x = 1; x < w - 1; x++) {
          if (map.get(r.x + x, r.y + y) !== T.CaveFloor) continue;
          let nearWall = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) nearWall += best[(y + dy) * w + x + dx];
          const roll = rng.next();
          if (nearWall >= 2 && roll < 0.1) scatterNatural(ctx, r.x + x, r.y + y, 'stalagmite', 0.6);
          else if (roll < 0.008) scatterNatural(ctx, r.x + x, r.y + y, 'boulder', 1.4);
          else if (roll < 0.016) scatterNatural(ctx, r.x + x, r.y + y, 'rock', 0.8);
          else if (roll < 0.021) scatterNatural(ctx, r.x + x, r.y + y, pools === 'lava' ? 'crystal' : rng.chance(0.5) ? 'crystal' : 'mushroom', 0.9);
        }
    }
  },
};
