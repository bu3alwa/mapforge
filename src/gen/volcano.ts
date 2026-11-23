import { T } from '../map';
import { fbm, quantile, valueNoise } from '../rng';
import { Generator, scatterNatural } from './common';

export const volcanoGenerator: Generator = {
  id: 'volcano',
  name: 'Lava fields',
  description: 'Volcanic wasteland with lava rivers or pools, ash and jagged rock.',
  params: [
    { key: 'style', label: 'Lava style', type: 'select', default: 'rivers', options: [
      { value: 'rivers', label: 'Rivers & cracks' }, { value: 'pools', label: 'Lakes & pools' }, { value: 'both', label: 'Both' },
    ] },
    { key: 'lava', label: 'Lava amount', type: 'range', min: 0.05, max: 0.45, step: 0.01, default: 0.18 },
    { key: 'rock', label: 'Rock ridges', type: 'range', min: 0, max: 0.4, step: 0.01, default: 0.15 },
  ],
  run(ctx, p) {
    const { map, region: r, rng } = ctx;
    const w = r.w, h = r.h;
    const n1 = valueNoise(rng), n2 = valueNoise(rng), n3 = valueNoise(rng);
    const style = String(p.style);
    const lavaAmt = Number(p.lava);
    const ridged = new Float32Array(w * h), blob = new Float32Array(w * h), elev = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        ridged[i] = 1 - Math.abs(fbm(n1, x / 22, y / 22, 4) * 2 - 1);
        blob[i] = fbm(n2, x / 14, y / 14, 4);
        elev[i] = fbm(n3, x / 10, y / 10, 3);
      }
    const rq = style === 'pools' ? 2 : quantile(ridged, 1 - (style === 'both' ? lavaAmt * 0.6 : lavaAmt));
    const bq = style === 'rivers' ? 2 : quantile(blob, 1 - (style === 'both' ? lavaAmt * 0.5 : lavaAmt));
    const mq = quantile(elev, 1 - Number(p.rock));
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        let t = T.Basalt;
        if (ridged[i] > rq || blob[i] > bq) t = T.Lava;
        else if (elev[i] > mq) t = T.Mountain;
        else if (elev[i] < 0.3) t = T.Dirt;
        map.set(r.x + x, r.y + y, t);
      }
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const t = map.get(r.x + x, r.y + y);
        const roll = rng.next();
        if (t === T.Mountain && roll < 0.08) scatterNatural(ctx, r.x + x, r.y + y, 'boulder', 1.5);
        else if (t === T.Basalt && roll < 0.025) scatterNatural(ctx, r.x + x, r.y + y, 'rock', 0.8);
        else if (t === T.Basalt && roll < 0.03) scatterNatural(ctx, r.x + x, r.y + y, 'deadtree', 1.3);
        else if (t === T.Basalt && roll < 0.033) scatterNatural(ctx, r.x + x, r.y + y, 'crystal', 0.8);
      }
  },
};
