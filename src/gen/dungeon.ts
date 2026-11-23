import { Rect, T } from '../map';
import { CLOTH_COLORS } from '../objects';
import { Generator, GenContext, fillRegion } from './common';

interface Room extends Rect { round: boolean }
interface Node { rect: Rect; a?: Node; b?: Node; room?: Room }

const SIZES: Record<string, { maxLeaf: number; minLeaf: number; minRoom: number }> = {
  few: { maxLeaf: 24, minLeaf: 11, minRoom: 5 },
  normal: { maxLeaf: 17, minLeaf: 8, minRoom: 4 },
  many: { maxLeaf: 12, minLeaf: 7, minRoom: 3 },
};

export const dungeonGenerator: Generator = {
  id: 'dungeon',
  name: 'Dungeon',
  description: 'Rooms and corridors with doors, stairs and furnishings.',
  params: [
    { key: 'rooms', label: 'Room count', type: 'select', default: 'normal', options: [
      { value: 'few', label: 'Few, large' }, { value: 'normal', label: 'Normal' }, { value: 'many', label: 'Many, small' },
    ] },
    { key: 'corridor', label: 'Corridor width', type: 'select', default: '1', options: [
      { value: '1', label: '5 ft' }, { value: '2', label: '10 ft' },
    ] },
    { key: 'floor', label: 'Floor', type: 'select', default: 'stone', options: [
      { value: 'stone', label: 'Stone' }, { value: 'wood', label: 'Wood' }, { value: 'cave', label: 'Rough cave' },
    ] },
    { key: 'loops', label: 'Extra loops', type: 'range', min: 0, max: 1, step: 0.05, default: 0.3 },
    { key: 'doors', label: 'Doors', type: 'bool', default: true },
    { key: 'dressing', label: 'Furnish rooms', type: 'bool', default: true },
  ],
  run(ctx, p) {
    const { map, region: R, rng } = ctx;
    const cfg = SIZES[String(p.rooms)] ?? SIZES.normal;
    const cw = Number(p.corridor) || 1;
    const floor = p.floor === 'wood' ? T.Wood : p.floor === 'cave' ? T.CaveFloor : T.Stone;
    fillRegion(ctx, T.Void);

    const split = (rect: Rect, depth: number): Node => {
      const node: Node = { rect };
      if (depth > 12 || (rect.w <= cfg.maxLeaf && rect.h <= cfg.maxLeaf && rng.chance(0.75))) return node;
      let horiz = rect.h > rect.w * 1.2 ? true : rect.w > rect.h * 1.2 ? false : rng.chance(0.5);
      const size = horiz ? rect.h : rect.w;
      if (size < cfg.minLeaf * 2) {
        horiz = !horiz;
        if ((horiz ? rect.h : rect.w) < cfg.minLeaf * 2) return node;
      }
      const s = horiz ? rect.h : rect.w;
      const at = rng.int(cfg.minLeaf, s - cfg.minLeaf);
      if (horiz) {
        node.a = split({ x: rect.x, y: rect.y, w: rect.w, h: at }, depth + 1);
        node.b = split({ x: rect.x, y: rect.y + at, w: rect.w, h: rect.h - at }, depth + 1);
      } else {
        node.a = split({ x: rect.x, y: rect.y, w: at, h: rect.h }, depth + 1);
        node.b = split({ x: rect.x + at, y: rect.y, w: rect.w - at, h: rect.h }, depth + 1);
      }
      return node;
    };
    const root = split({ x: R.x + 1, y: R.y + 1, w: R.w - 2, h: R.h - 2 }, 0);

    const rooms: Room[] = [];
    const makeRooms = (n: Node) => {
      if (n.a && n.b) { makeRooms(n.a); makeRooms(n.b); return; }
      const L = n.rect;
      const maxW = L.w - 2, maxH = L.h - 2;
      if (maxW < 3 || maxH < 3) return;
      const minW = Math.min(cfg.minRoom, maxW), minH = Math.min(cfg.minRoom, maxH);
      const w = rng.int(minW, maxW), h = rng.int(minH, maxH);
      const room: Room = {
        x: L.x + rng.int(1, L.w - w - 1),
        y: L.y + rng.int(1, L.h - h - 1),
        w, h,
        round: Math.min(w, h) >= 7 && rng.chance(0.2),
      };
      n.room = room;
      rooms.push(room);
    };
    makeRooms(root);
    if (!rooms.length) return;

    const carve = (x: number, y: number) => {
      if (x < R.x + 1 || y < R.y + 1 || x >= R.x + R.w - 1 || y >= R.y + R.h - 1) return;
      if (map.get(x, y) === T.Void) map.set(x, y, floor);
    };
    for (const room of rooms) {
      const cx = room.x + room.w / 2, cy = room.y + room.h / 2;
      for (let y = room.y; y < room.y + room.h; y++)
        for (let x = room.x; x < room.x + room.w; x++) {
          if (room.round) {
            const dx = (x + 0.5 - cx) / (room.w / 2), dy = (y + 0.5 - cy) / (room.h / 2);
            if (dx * dx + dy * dy > 1.05) continue;
          }
          map.set(x, y, floor);
        }
    }

    const center = (r: Room) => [Math.floor(r.x + r.w / 2), Math.floor(r.y + r.h / 2)];
    const corridor = (a: Room, b: Room) => {
      const [ax, ay] = center(a), [bx, by] = center(b);
      const hFirst = rng.chance(0.5);
      const hline = (x0: number, x1: number, y: number) => {
        for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (let k = 0; k < cw; k++) carve(x, y + k);
      };
      const vline = (y0: number, y1: number, x: number) => {
        for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let k = 0; k < cw; k++) carve(x + k, y);
      };
      if (hFirst) { hline(ax, bx, ay); vline(ay, by, bx); } else { vline(ay, by, ax); hline(ax, bx, by); }
    };
    const roomsOf = (n: Node): Room[] => (n.room ? [n.room] : n.a && n.b ? [...roomsOf(n.a), ...roomsOf(n.b)] : []);
    const connect = (n: Node) => {
      if (!n.a || !n.b) return;
      connect(n.a); connect(n.b);
      const ra = roomsOf(n.a), rb = roomsOf(n.b);
      if (!ra.length || !rb.length) return;
      let best: [Room, Room] = [ra[0], rb[0]], bd = Infinity;
      for (const a of ra) for (const b of rb) {
        const [ax, ay] = center(a), [bx, by] = center(b);
        const d = Math.abs(ax - bx) + Math.abs(ay - by);
        if (d < bd) { bd = d; best = [a, b]; }
      }
      corridor(best[0], best[1]);
    };
    connect(root);
    // Extra loops between nearby rooms.
    const loops = Math.round(rooms.length * Number(p.loops) * 0.5);
    for (let i = 0; i < loops; i++) {
      const a = rng.pick(rooms);
      const near = rooms.filter((b) => b !== a).sort((b1, b2) => {
        const [ax, ay] = center(a);
        const d1 = Math.abs(center(b1)[0] - ax) + Math.abs(center(b1)[1] - ay);
        const d2 = Math.abs(center(b2)[0] - ax) + Math.abs(center(b2)[1] - ay);
        return d1 - d2;
      });
      if (near.length) corridor(a, near[Math.min(near.length - 1, rng.int(0, 1))]);
    }

    const put = (type: string, x: number, y: number, w: number, h: number, rot = 0, color?: string) =>
      map.addObject({ type, x, y, w, h, rot, color });
    const isFloor = (x: number, y: number) => map.get(x, y) !== T.Void;

    if (p.doors) {
      for (const room of rooms) {
        if (room.round) continue;
        const check = (x: number, y: number, horizontal: boolean) => {
          if (!isFloor(x, y)) return;
          const side1 = horizontal ? isFloor(x - 1, y) : isFloor(x, y - 1);
          const side2 = horizontal ? isFloor(x + 1, y) : isFloor(x, y + 1);
          if (side1 || side2 || !rng.chance(0.7)) return;
          put('door', x + 0.5, y + 0.5, 1, 1, horizontal ? 0 : Math.PI / 2);
        };
        for (let x = room.x; x < room.x + room.w; x++) { check(x, room.y - 1, true); check(x, room.y + room.h, true); }
        for (let y = room.y; y < room.y + room.h; y++) { check(room.x - 1, y, false); check(room.x + room.w, y, false); }
      }
    }

    if (p.dressing) furnish(ctx, rooms, put, isFloor);
  },
};

type Put = (type: string, x: number, y: number, w: number, h: number, rot?: number, color?: string) => unknown;

function furnish(ctx: GenContext, rooms: Room[], put: Put, isFloor: (x: number, y: number) => boolean) {
  const { rng } = ctx;
  // Stairs in the two rooms that are farthest apart.
  let s0 = rooms[0], s1 = rooms[rooms.length - 1], far = -1;
  for (const a of rooms) for (const b of rooms) {
    const d = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    if (d > far) { far = d; s0 = a; s1 = b; }
  }
  const used = new Set<Room>();
  for (const r of [s0, s1]) {
    if (r.round || r.h < 3) { continue; }
    put('stairs', r.x + 0.5, r.y + 1, 1, 2);
    used.add(r);
  }

  for (const r of rooms) {
    const inner = (x: number, y: number) => isFloor(Math.floor(x), Math.floor(y));
    // Torches along the top wall.
    if (!r.round && rng.chance(0.6)) {
      for (let x = r.x + 1; x < r.x + r.w - 1; x += 4) if (!isFloor(x, r.y - 1)) put('torch', x + 0.5, r.y + 0.2, 0.5, 0.5);
    }
    const kinds = ['empty', 'storage', 'treasure', 'shrine', 'crypt', 'barracks', 'pillars', 'library'];
    const kind = used.has(r) ? 'empty' : rng.pick(kinds);
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    switch (kind) {
      case 'pillars': {
        if (r.w < 6 || r.h < 6) break;
        for (let x = r.x + 1; x < r.x + r.w - 1; x += 2) {
          if (inner(x + 0.5, r.y + 1.5)) put('pillar', x + 0.5, r.y + 1.5, 0.8, 0.8);
          if (inner(x + 0.5, r.y + r.h - 1.5)) put('pillar', x + 0.5, r.y + r.h - 1.5, 0.8, 0.8);
        }
        break;
      }
      case 'storage': {
        const n = rng.int(3, 8);
        const corner = rng.int(0, 3);
        const bx = corner % 2 ? r.x + r.w - 1 : r.x, by = corner > 1 ? r.y + r.h - 1 : r.y;
        for (let i = 0; i < n; i++) {
          const x = bx + 0.5 + (corner % 2 ? -1 : 1) * rng.range(0, 2), y = by + 0.5 + (corner > 1 ? -1 : 1) * rng.range(0, 2);
          if (inner(x, y)) put(rng.chance(0.5) ? 'barrel' : 'crate', x, y, 0.65, 0.65, rng.chance(0.5) ? 0 : rng.range(-0.3, 0.3));
        }
        break;
      }
      case 'treasure': {
        put('chest', Math.floor(cx) + 0.5, r.y + 0.5, 0.8, 0.6);
        if (rng.chance(0.6)) put('trap', Math.floor(cx) + 0.5, r.y + 1.5, 1, 1);
        if (rng.chance(0.5) && r.h > 3) put('chest', r.x + 0.5, r.y + r.h - 0.5, 0.8, 0.6, Math.PI / 2);
        break;
      }
      case 'shrine': {
        if (r.w < 4) break;
        put('altar', Math.floor(cx) + (r.w % 2 ? 0.5 : 0), r.y + 1, 2, 1);
        if (r.w >= 6) { put('statue', r.x + 1.5, r.y + 1.5, 1, 1); put('statue', r.x + r.w - 1.5, r.y + 1.5, 1, 1); }
        put('torch', r.x + 0.5, r.y + r.h - 0.5, 0.5, 0.5);
        put('torch', r.x + r.w - 0.5, r.y + r.h - 0.5, 0.5, 0.5);
        break;
      }
      case 'crypt': {
        if (r.h < 4) break;
        for (let x = r.x + 1; x < r.x + r.w - 1; x += 2) if (inner(x + 0.5, r.y + 1)) put('coffin', x + 0.5, r.y + 1.5, 1, 2);
        break;
      }
      case 'barracks': {
        if (r.h < 4 || r.w < 4) break;
        const col = rng.pick(CLOTH_COLORS);
        for (let x = r.x; x < r.x + r.w - 1; x += 2) put('bed', x + 0.5, r.y + 1, 1, 2, 0, col);
        put('table', Math.floor(cx) + (r.w % 2 ? 0.5 : 0), r.y + r.h - 1, 2, 1);
        break;
      }
      case 'library': {
        if (r.w < 5 || r.h < 5) break;
        put('table', Math.floor(cx) + (r.w % 2 ? 0.5 : 0), Math.floor(cy) + 0.5, 2, 1);
        for (let x = r.x + 1; x < r.x + r.w - 1; x += 1) if (rng.chance(0.4)) put('crate', x + 0.5, r.y + r.h - 0.5, 0.6, 0.6);
        break;
      }
    }
  }
}
