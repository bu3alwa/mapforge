import { Rect, T } from '../map';
import { CLOTH_COLORS } from '../objects';
import { Generator, GenContext } from './common';

type Role = 'common' | 'kitchen' | 'bedroom' | 'storage' | 'workshop' | 'living' | 'hall' | 'vestry' | 'shop' | 'study';

const PLANS: Record<string, { floor: T; roles: Role[]; big: Role }> = {
  tavern: { floor: T.Wood, big: 'common', roles: ['kitchen', 'storage', 'bedroom', 'bedroom', 'bedroom', 'bedroom'] },
  smithy: { floor: T.Stone, big: 'workshop', roles: ['storage', 'living', 'kitchen', 'bedroom'] },
  house: { floor: T.Wood, big: 'living', roles: ['kitchen', 'bedroom', 'bedroom', 'storage', 'study'] },
  temple: { floor: T.Stone, big: 'hall', roles: ['vestry', 'study', 'storage', 'bedroom'] },
  shop: { floor: T.Wood, big: 'shop', roles: ['storage', 'living', 'kitchen', 'bedroom'] },
  manor: { floor: T.Wood, big: 'hall', roles: ['kitchen', 'living', 'study', 'bedroom', 'bedroom', 'bedroom', 'storage', 'bedroom'] },
};

export const interiorGenerator: Generator = {
  id: 'interior',
  name: 'Building interior',
  description: 'A furnished building seen from above with walls, rooms and doors: tavern, smithy, house, temple, shop or manor.',
  params: [
    { key: 'kind', label: 'Building', type: 'select', default: 'tavern', options: [
      { value: 'tavern', label: 'Tavern / inn' }, { value: 'smithy', label: 'Blacksmith' }, { value: 'house', label: 'Family house' },
      { value: 'temple', label: 'Temple / chapel' }, { value: 'shop', label: 'Shop' }, { value: 'manor', label: 'Manor house' },
    ] },
    { key: 'fill', label: 'Building size', type: 'range', min: 0.4, max: 1, step: 0.05, default: 0.85 },
    { key: 'yard', label: 'Yard outside', type: 'bool', default: true },
  ],
  run(ctx, p) {
    const { map, region: R, rng } = ctx;
    const plan = PLANS[String(p.kind)] ?? PLANS.tavern;
    const fill = Number(p.fill);

    // Ground outside.
    for (let y = R.y; y < R.y + R.h; y++) for (let x = R.x; x < R.x + R.w; x++) map.set(x, y, rng.chance(0.15) ? T.Dirt : T.Grass);

    const bw = Math.max(8, Math.min(R.w - 4, Math.round(R.w * fill)));
    const bh = Math.max(8, Math.min(R.h - 4, Math.round(R.h * fill)));
    const B: Rect = { x: R.x + Math.floor((R.w - bw) / 2), y: R.y + Math.floor((R.h - bh) / 2), w: bw, h: bh };

    // Outer walls and floor.
    for (let y = B.y; y < B.y + B.h; y++)
      for (let x = B.x; x < B.x + B.w; x++) {
        const edge = x === B.x || y === B.y || x === B.x + B.w - 1 || y === B.y + B.h - 1;
        map.set(x, y, edge ? T.Wall : plan.floor);
      }

    // Split the interior into rooms. The biggest room keeps the front door.
    const inner: Rect = { x: B.x + 1, y: B.y + 1, w: B.w - 2, h: B.h - 2 };
    const rooms: Rect[] = [];
    const walls: { x: number; y: number; len: number; horiz: boolean }[] = [];
    const want = Math.min(plan.roles.length + 1, Math.max(2, Math.round((inner.w * inner.h) / 45)));
    const split = (rect: Rect, n: number) => {
      if (n <= 1 || (rect.w < 8 && rect.h < 8)) { rooms.push(rect); return; }
      const horiz = rect.h > rect.w ? true : rect.w > rect.h ? false : rng.chance(0.5);
      const len = horiz ? rect.h : rect.w;
      if (len < 8) { rooms.push(rect); return; }
      const frac = n >= 3 ? rng.range(0.3, 0.45) : rng.range(0.4, 0.6);
      const at = Math.max(3, Math.min(len - 4, Math.floor(len * frac)));
      const na = Math.max(1, Math.round(n * frac)), nb = Math.max(1, n - na);
      if (horiz) {
        walls.push({ x: rect.x, y: rect.y + at, len: rect.w, horiz: true });
        split({ x: rect.x, y: rect.y, w: rect.w, h: at }, na);
        split({ x: rect.x, y: rect.y + at + 1, w: rect.w, h: rect.h - at - 1 }, nb);
      } else {
        walls.push({ x: rect.x + at, y: rect.y, len: rect.h, horiz: false });
        split({ x: rect.x, y: rect.y, w: at, h: rect.h }, na);
        split({ x: rect.x + at + 1, y: rect.y, w: rect.w - at - 1, h: rect.h }, nb);
      }
    };
    // The main room takes a big share first.
    const mainVertical = inner.w >= inner.h;
    const mainLen = Math.floor((mainVertical ? inner.w : inner.h) * (plan.big === 'hall' ? 0.62 : 0.55));
    let main: Rect;
    if (want <= 1) main = inner;
    else if (mainVertical) {
      main = { x: inner.x, y: inner.y, w: mainLen, h: inner.h };
      walls.push({ x: inner.x + mainLen, y: inner.y, len: inner.h, horiz: false });
      split({ x: inner.x + mainLen + 1, y: inner.y, w: inner.w - mainLen - 1, h: inner.h }, want - 1);
    } else {
      main = { x: inner.x, y: inner.y + inner.h - mainLen, w: inner.w, h: mainLen };
      walls.push({ x: inner.x, y: inner.y + inner.h - mainLen - 1, len: inner.w, horiz: true });
      split({ x: inner.x, y: inner.y, w: inner.w, h: inner.h - mainLen - 1 }, want - 1);
    }
    for (const wl of walls) for (let i = 0; i < wl.len; i++) map.set(wl.horiz ? wl.x + i : wl.x, wl.horiz ? wl.y : wl.y + i, T.Wall);

    const put = (type: string, x: number, y: number, w: number, h: number, rot = 0, color?: string) =>
      map.addObject({ type, x, y, w, h, rot, color });
    const door = (x: number, y: number, horiz: boolean) => { map.set(x, y, plan.floor); put('door', x + 0.5, y + 0.5, 1, 1, horiz ? 0 : Math.PI / 2); };

    // Doors: every room gets a door into a neighbor so everything connects to the main room.
    const all = [main, ...rooms];
    const adjacent = (a: Rect, b: Rect) => {
      // Shared wall segment, as list of candidate door tiles.
      const out: [number, number, boolean][] = [];
      if (a.y + a.h + 1 === b.y || b.y + b.h + 1 === a.y) {
        const y = a.y + a.h + 1 === b.y ? a.y + a.h : b.y + b.h;
        for (let x = Math.max(a.x, b.x) + 1; x < Math.min(a.x + a.w, b.x + b.w) - 1; x++) out.push([x, y, true]);
      }
      if (a.x + a.w + 1 === b.x || b.x + b.w + 1 === a.x) {
        const x = a.x + a.w + 1 === b.x ? a.x + a.w : b.x + b.w;
        for (let y = Math.max(a.y, b.y) + 1; y < Math.min(a.y + a.h, b.y + b.h) - 1; y++) out.push([x, y, false]);
      }
      return out;
    };
    const linked = new Set<Rect>([main]);
    let guard = 0;
    while (linked.size < all.length && guard++ < 100) {
      let done = false;
      for (const a of all) {
        if (linked.has(a)) continue;
        const partners = [...linked].map((b) => [b, adjacent(a, b)] as const).filter(([, c]) => c.length);
        if (!partners.length) continue;
        const [, cands] = partners.find(([b]) => b === main) ?? rng.pick(partners);
        const [x, y, h] = rng.pick(cands);
        door(x, y, h);
        linked.add(a);
        done = true;
      }
      if (!done) break;
    }
    // Front door on the outside wall of the main room, facing the bottom or left side.
    {
      const bottom = main.y + main.h === B.y + B.h - 1;
      if (bottom) door(Math.floor(main.x + main.w / 2), B.y + B.h - 1, true);
      else door(B.x, Math.floor(main.y + main.h / 2), false);
      // Back door sometimes.
      if (rng.chance(0.5) && main.y === B.y + 1) door(Math.floor(main.x + main.w / 2) + rng.int(-2, 2), B.y, true);
    }

    // Assign roles: main room gets the plan's big role, others in order (largest first).
    const others = rooms.slice().sort((a, b) => b.w * b.h - a.w * a.h);
    furnishRoom(ctx, main, plan.big, put);
    others.forEach((rm, i) => furnishRoom(ctx, rm, plan.roles[i % plan.roles.length], put));

    // Yard.
    if (p.yard) {
      const front = { x: Math.floor(main.x + main.w / 2), y: B.y + B.h };
      for (let y = front.y; y < R.y + R.h; y++) for (let k = -1; k <= 0; k++) map.set(front.x + k, y, T.Dirt);
      const extras = p.kind === 'smithy' ? ['haybale', 'trough', 'firewood', 'cart'] : p.kind === 'tavern' ? ['barrel', 'barrel', 'cart', 'trough', 'signpost'] : ['firewood', 'barrel', 'bush'];
      for (const type of extras) {
        for (let tries = 0; tries < 30; tries++) {
          const x = R.x + rng.range(1, R.w - 1), y = R.y + rng.range(1, R.h - 1);
          if (x > B.x - 1.5 && x < B.x + B.w + 1.5 && y > B.y - 1.5 && y < B.y + B.h + 1.5) continue;
          if (map.get(Math.floor(x), Math.floor(y)) === T.Dirt && type !== 'signpost') continue;
          const size = type === 'cart' ? [1.2, 2] : type === 'trough' ? [2, 0.7] : type === 'haybale' ? [1.2, 0.8] : type === 'firewood' ? [1.1, 0.6] : type === 'signpost' ? [1, 0.6] : [0.65, 0.65];
          put(type, x, y, size[0], size[1], rng.range(-0.4, 0.4));
          break;
        }
      }
      for (let i = 0; i < Math.round((R.w * R.h - B.w * B.h) / 40); i++) {
        const x = R.x + rng.range(0, R.w), y = R.y + rng.range(0, R.h);
        if (x > B.x - 2 && x < B.x + B.w + 2 && y > B.y - 2 && y < B.y + B.h + 2) continue;
        if (map.get(Math.floor(x), Math.floor(y)) !== T.Grass) continue;
        put(rng.chance(0.6) ? 'bush' : 'tree', x, y, 1.2, 1.2, rng.range(0, 6));
      }
    }
  },
};

type Put = (type: string, x: number, y: number, w: number, h: number, rot?: number, color?: string) => unknown;

function furnishRoom(ctx: GenContext, r: Rect, role: Role, put: Put) {
  const { rng } = ctx;
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  const tableSet = (x: number, y: number) => {
    put('table', x, y, 2, 1);
    put('chair', x - 0.5, y - 0.85, 0.6, 0.6);
    put('chair', x + 0.5, y - 0.85, 0.6, 0.6);
    put('chair', x - 0.5, y + 0.85, 0.6, 0.6, Math.PI);
    put('chair', x + 0.5, y + 0.85, 0.6, 0.6, Math.PI);
    if (rng.chance(0.6)) put('plates', x + rng.range(-0.4, 0.4), y, 0.7, 0.5);
  };
  switch (role) {
    case 'common': {
      // Bar along the top wall, fireplace on a side wall, tables through the room.
      const barLen = Math.min(r.w - 2, 6);
      for (let i = 0; i < barLen; i += 2) put('counter', r.x + 1 + i + 1, r.y + 1.6, 2, 0.8);
      for (let i = 0; i < barLen; i += 1) put('stool', r.x + 1.5 + i, r.y + 2.5, 0.45, 0.45);
      put('barrel', r.x + 0.5, r.y + 0.5, 0.6, 0.6); put('barrel', r.x + 1.2, r.y + 0.5, 0.6, 0.6);
      put('plates', r.x + 2.5, r.y + 1.6, 0.7, 0.5);
      put('fireplace', r.x + r.w - 1.1, r.y + 0.5, 2, 1);
      for (let y = r.y + 4.5; y < r.y + r.h - 1; y += 3.2)
        for (let x = r.x + 2; x < r.x + r.w - 1.5; x += 3.6) tableSet(x, y);
      if (r.w > 8) put('rug', r.x + r.w - 2.5, r.y + 2.2, 3, 2, 0, rng.pick(['#8b2c2c', '#2f4f7a']));
      break;
    }
    case 'kitchen': {
      put('stove', r.x + 0.5, r.y + 0.5, 1, 1);
      put('kettle', r.x + 0.5, r.y + 0.5, 0.45, 0.45);
      put('oven', r.x + r.w - 1, r.y + 1, 2, 2);
      for (let x = r.x + 1; x + 2 <= r.x + r.w - 2; x += 2) put('counter', x + 1, r.y + 0.4, 2, 0.8);
      put('pan', r.x + 1.7, r.y + 0.4, 0.8, 0.45);
      put('pot', r.x + 2.6, r.y + 0.45, 0.5, 0.5);
      if (r.h >= 4) put('table', cx, Math.max(r.y + 2.5, cy), 2, 1);
      put('sack', r.x + 0.6, r.y + r.h - 0.5, 0.9, 0.7);
      put('firewood', r.x + r.w - 0.7, r.y + r.h - 0.4, 1.1, 0.6);
      put('barrel', r.x + 1.5, r.y + r.h - 0.5, 0.6, 0.6);
      if (r.w >= 5) put('cauldron', r.x + r.w - 0.6, r.y + 2.6, 1, 1);
      break;
    }
    case 'bedroom': {
      const col = rng.pick(CLOTH_COLORS);
      const beds = r.w >= 6 ? 2 : 1;
      for (let i = 0; i < beds; i++) put('bed', r.x + 0.5 + i * 2, r.y + 1, 1, 2, 0, col);
      put('chest', r.x + 0.5 + beds * 2 - 1, r.y + 2.4, 0.8, 0.6);
      if (r.w >= 4) put('wardrobe', r.x + r.w - 0.8, r.y + 0.35, 1.5, 0.7);
      if (r.w >= 4 && r.h >= 4) put('rug', cx, cy + 0.5, Math.min(3, r.w - 2), Math.min(2, r.h - 2), 0, col);
      if (rng.chance(0.4)) put('bathtub', r.x + r.w - 0.5, r.y + r.h - 1, 1, 2);
      break;
    }
    case 'storage': {
      const n = Math.round(r.w * r.h * 0.25);
      for (let i = 0; i < n; i++) {
        const x = r.x + 0.5 + rng.range(0, r.w - 1), y = r.y + 0.5 + rng.range(0, r.h - 1);
        const t = rng.pick(['barrel', 'crate', 'sack', 'crate']);
        put(t, x, y, t === 'sack' ? 0.9 : 0.65, t === 'sack' ? 0.7 : 0.65, rng.range(-0.3, 0.3));
      }
      break;
    }
    case 'workshop': {
      put('forge', r.x + 1, r.y + 1, 2, 2);
      put('anvil', r.x + 3.2, r.y + 1.5, 0.9, 0.5);
      put('quench', r.x + 3.3, r.y + 0.5, 0.7, 0.7);
      put('grindstone', r.x + 0.6, r.y + 2.8, 0.9, 0.9);
      if (r.w >= 7) put('workbench', r.x + r.w - 1.2, r.y + 0.5, 2, 0.9);
      put('weaponrack', r.x + r.w - 1.2, r.y + r.h - 0.3, 2, 0.5);
      if (r.w >= 7) put('armorstand', r.x + r.w - 0.6, cy, 0.8, 0.8);
      put('firewood', r.x + 0.7, r.y + r.h - 0.4, 1.1, 0.6);
      put('crate', cx, r.y + r.h - 0.5, 0.7, 0.7);
      if (r.w >= 9 && r.h >= 8) {
        // A big shop floor: second work station, a sales counter and stock.
        put('anvil', cx + 0.5, cy - 0.5, 0.9, 0.5, 0.3);
        put('workbench', cx + 0.5, cy + 1, 2, 0.9);
        put('stool', cx + 0.5, cy + 1.8, 0.45, 0.45);
        for (let x = r.x + 1; x + 2 <= r.x + Math.min(r.w, 7); x += 2) put('counter', x + 1, r.y + r.h - 2.2, 2, 0.8);
        for (let i = 0; i < 3; i++) put('armorstand', r.x + r.w - 0.7, r.y + 2.2 + i * 1.1, 0.8, 0.8);
        for (let i = 0; i < 4; i++) put(rng.pick(['barrel', 'crate']), r.x + 0.5 + rng.range(0, 1.2), r.y + 4 + rng.range(0, 1.5), 0.65, 0.65, rng.range(-0.3, 0.3));
        put('haybale', r.x + r.w - 1.2, r.y + r.h - 1.4, 1.2, 0.8);
      }
      break;
    }
    case 'living': {
      put('fireplace', cx, r.y + 0.5, 2, 1);
      put('rug', cx, cy + 0.3, Math.min(3, r.w - 2), Math.min(2, r.h - 2), 0, rng.pick(['#8b2c2c', '#6b4a8a', '#2f6a4a']));
      put('chair', cx - 1, r.y + 2, 0.6, 0.6, Math.PI);
      put('chair', cx + 1, r.y + 2, 0.6, 0.6, Math.PI);
      if (r.h >= 5) tableSet(cx, r.y + r.h - 1.6);
      if (r.w >= 5) put('bookshelf', r.x + 1, r.y + 0.25, 2, 0.5);
      break;
    }
    case 'hall': {
      // Long hall: altar or high table at the top, rows of benches.
      for (let y = r.y; y < r.y + 2; y++) for (let x = r.x + 1; x < r.x + r.w - 1; x++) ctx.map.setElev(x, y, 1);
      put('altar', cx, r.y + 1, 2, 1);
      put('statue', r.x + 1, r.y + 1, 1, 1); put('statue', r.x + r.w - 1, r.y + 1, 1, 1);
      put('rug', cx, cy + 1.5, 1.6, Math.max(2, r.h - 4), 0, '#8b2c2c');
      for (let y = r.y + 3.5; y < r.y + r.h - 1; y += 1.5) {
        put('bench', cx - 2.2, y, Math.min(2.5, r.w / 2 - 1.5), 0.45);
        put('bench', cx + 2.2, y, Math.min(2.5, r.w / 2 - 1.5), 0.45);
      }
      for (let y = r.y + 3; y < r.y + r.h - 1; y += 3) { put('pillar', r.x + 0.6, y, 0.8, 0.8); put('pillar', r.x + r.w - 0.6, y, 0.8, 0.8); }
      put('torch', r.x + 0.4, r.y + 0.4, 0.5, 0.5); put('torch', r.x + r.w - 0.4, r.y + 0.4, 0.5, 0.5);
      break;
    }
    case 'vestry': {
      put('wardrobe', r.x + 1, r.y + 0.35, 1.5, 0.7);
      put('desk', cx, cy, 1.5, 0.8); put('chair', cx, cy + 0.8, 0.6, 0.6, Math.PI);
      put('chest', r.x + r.w - 0.6, r.y + r.h - 0.5, 0.8, 0.6);
      break;
    }
    case 'study': {
      for (let x = r.x; x + 2 <= r.x + r.w; x += 2) put('bookshelf', x + 1, r.y + 0.25, 2, 0.5);
      put('desk', cx, cy + 0.3, 1.5, 0.8); put('chair', cx, cy + 1.1, 0.6, 0.6, Math.PI);
      if (r.h >= 4) put('rug', cx, cy + 0.6, Math.min(3, r.w - 1), 2, 0, '#2f4f7a');
      break;
    }
    case 'shop': {
      for (let x = r.x + 1; x + 2 <= r.x + r.w - 1; x += 2) put('counter', x + 1, cy, 2, 0.8);
      for (let x = r.x; x + 2 <= r.x + r.w; x += 2) put('bookshelf', x + 1, r.y + 0.25, 2, 0.5);
      put('crate', r.x + 0.6, r.y + r.h - 0.6, 0.7, 0.7); put('barrel', r.x + 1.4, r.y + r.h - 0.5, 0.6, 0.6);
      put('chest', r.x + r.w - 0.6, cy - 1.2, 0.8, 0.6);
      put('sack', r.x + r.w - 0.7, r.y + r.h - 0.5, 0.9, 0.7);
      break;
    }
  }
}
