import { Rect, T } from '../map';
import { fbm, valueNoise } from '../rng';
import { Generator, inRegion, scatterNatural } from './common';

export const ruinsGenerator: Generator = {
  id: 'ruins',
  name: 'Ruins',
  description: 'Crumbling walls and broken floors of a lost keep or temple, reclaimed by grass and trees, on raised ground.',
  params: [
    { key: 'decay', label: 'Decay', type: 'range', min: 0.1, max: 0.9, step: 0.05, default: 0.45 },
    { key: 'setting', label: 'Setting', type: 'select', default: 'grass', options: [
      { value: 'grass', label: 'Overgrown meadow' }, { value: 'forest', label: 'Deep forest' }, { value: 'desert', label: 'Desert sands' }, { value: 'snow', label: 'Frozen waste' },
    ] },
    { key: 'raised', label: 'On a raised platform', type: 'bool', default: true },
  ],
  run(ctx, p) {
    const { map, region: r, rng } = ctx;
    const decay = Number(p.decay);
    const setting = String(p.setting);
    const n = valueNoise(rng);
    const ground = setting === 'desert' ? T.Sand : setting === 'snow' ? T.Snow : T.Grass;
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) {
        const v = fbm(n, x / 9, y / 9, 3);
        map.set(x, y, setting === 'forest' && v > 0.5 ? T.Forest : setting === 'desert' && v < 0.3 ? T.Dirt : ground);
      }

    // Footprint of the old building: a few overlapping rectangles.
    const bw = Math.max(10, Math.floor(r.w * 0.6)), bh = Math.max(10, Math.floor(r.h * 0.6));
    const main: Rect = { x: r.x + Math.floor((r.w - bw) / 2), y: r.y + Math.floor((r.h - bh) / 2), w: bw, h: bh };
    const parts: Rect[] = [main];
    for (let i = 0; i < 3; i++) {
      const w = rng.int(6, Math.max(7, Math.floor(bw / 2))), h = rng.int(6, Math.max(7, Math.floor(bh / 2)));
      const corner = rng.int(0, 3);
      const x = corner % 2 ? main.x + main.w - Math.floor(w / 2) : main.x - Math.floor(w / 2);
      const y = corner > 1 ? main.y + main.h - Math.floor(h / 2) : main.y - Math.floor(h / 2);
      const pr = { x, y, w, h };
      if (pr.x > r.x && pr.y > r.y && pr.x + pr.w < r.x + r.w && pr.y + pr.h < r.y + r.h) parts.push(pr);
    }
    const inPart = (x: number, y: number) => parts.some((q) => x >= q.x && y >= q.y && x < q.x + q.w && y < q.y + q.h);
    const decayN = valueNoise(rng);
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) {
        if (!inPart(x, y)) continue;
        const edge = !inPart(x - 1, y) || !inPart(x + 1, y) || !inPart(x, y - 1) || !inPart(x, y + 1);
        const rot = fbm(decayN, x / 4, y / 4, 2) + rng.range(-0.15, 0.15);
        if (p.raised) map.setElev(x, y, 1);
        if (edge) { if (rot > decay * 0.9) map.set(x, y, T.Wall); }
        else if (rot > decay * 0.7) map.set(x, y, T.Stone);
      }
    // Inner walls: a cross through the main hall, partly fallen.
    const ix = main.x + Math.floor(main.w / 2), iy = main.y + Math.floor(main.h / 2);
    for (let x = main.x; x < main.x + main.w; x++) if (Math.abs(x - ix) > 1 && rng.chance(1 - decay)) map.set(x, iy, T.Wall);
    for (let y = main.y; y < main.y + main.h; y++) if (Math.abs(y - iy) > 1 && rng.chance(1 - decay)) map.set(ix, y, T.Wall);
    // Steps up onto the platform.
    if (p.raised) {
      const sx = ix, sy = main.y + main.h;
      map.addObject({ type: 'stairs', x: sx + 0.5, y: sy + 0.5, w: 1, h: 1, rot: Math.PI });
      map.set(sx, sy - 1, T.Stone);
    }

    // Fallen pillars, rubble, statues and overgrowth.
    for (let y = main.y + 2; y < main.y + main.h - 2; y += 3) {
      for (const x of [main.x + 2, main.x + main.w - 3]) {
        if (rng.chance(0.6)) map.addObject({ type: 'pillar', x: x + 0.5, y: y + 0.5, w: 0.8, h: 0.8, rot: 0 });
        else map.addObject({ type: 'log', x: x + 1, y: y + 0.5, w: 2.2, h: 0.7, rot: rng.range(-0.5, 0.5) });
      }
    }
    map.addObject({ type: 'statue', x: ix + 0.5 + (rng.chance(0.5) ? 2 : -2), y: iy - 2.5, w: 1, h: 1, rot: rng.range(-0.3, 0.3) });
    map.addObject({ type: 'altar', x: ix + 1, y: main.y + 2, w: 2, h: 1, rot: 0 });
    if (rng.chance(0.6)) map.addObject({ type: 'chest', x: ix + 3.5, y: main.y + 1.5, w: 0.8, h: 0.6, rot: 0.2 });
    const plant = setting === 'desert' ? 'cactus' : setting === 'snow' ? 'pine' : 'tree';
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) {
        const t = map.get(x, y);
        const roll = rng.next();
        if (t === T.Wall) continue;
        if (inPart(x, y)) {
          if (roll < 0.06 + decay * 0.06) scatterNatural(ctx, x, y, 'rock', 0.7);
          else if (roll < 0.09 + decay * 0.1) scatterNatural(ctx, x, y, setting === 'desert' ? 'rock' : 'bush', 0.8);
          else if (roll < 0.1 + decay * 0.12 && setting !== 'desert') scatterNatural(ctx, x, y, plant, 1.6);
        } else if (t === T.Forest) {
          if (roll < 0.55) scatterNatural(ctx, x, y, rng.chance(0.7) ? 'tree' : 'pine', 1.8);
        } else if (roll < (setting === 'desert' ? 0.015 : 0.04)) scatterNatural(ctx, x, y, plant, setting === 'desert' ? 0.8 : 1.6);
        else if (roll < 0.06) scatterNatural(ctx, x, y, setting === 'desert' ? 'rock' : 'bush', 0.8);
      }
    map.objects = map.objects.filter((o) => !(inRegion(r, Math.floor(o.x), Math.floor(o.y)) && map.get(Math.floor(o.x), Math.floor(o.y)) === T.Wall && o.type !== 'pillar'));
  },
};
