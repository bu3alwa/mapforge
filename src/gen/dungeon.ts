import { Rect, T } from '../map';
import { CLOTH_COLORS } from '../objects';
import { Generator, GenContext, fillRegion, stampLine, wobblyLine } from './common';

interface Room extends Rect { round: boolean }
interface Node { rect: Rect; a?: Node; b?: Node; room?: Room }

const SIZES: Record<string, { maxLeaf: number; minLeaf: number; minRoom: number }> = {
  few: { maxLeaf: 24, minLeaf: 11, minRoom: 5 },
  normal: { maxLeaf: 17, minLeaf: 8, minRoom: 4 },
  many: { maxLeaf: 12, minLeaf: 7, minRoom: 3 },
};

type Kind =
  | 'empty' | 'storage' | 'treasure' | 'shrine' | 'crypt' | 'barracks' | 'pillars' | 'library'
  | 'kitchen' | 'pit' | 'flooded' | 'cell' | 'guard' | 'throne' | 'smithy';

const THEME_ROOMS: Record<string, [Kind, number][]> = {
  classic: [['empty', 2], ['storage', 2], ['treasure', 1], ['shrine', 1], ['crypt', 1], ['barracks', 1], ['pillars', 1], ['library', 1], ['kitchen', 1], ['pit', 1], ['flooded', 1], ['smithy', 0.6]],
  crypt: [['empty', 1], ['crypt', 4], ['shrine', 2], ['treasure', 1], ['pillars', 2], ['pit', 1]],
  sewer: [['empty', 2], ['storage', 2], ['flooded', 3], ['pit', 1], ['treasure', 1], ['guard', 1]],
  prison: [['cell', 6], ['guard', 2], ['kitchen', 1], ['storage', 1], ['treasure', 0.5], ['smithy', 0.5]],
  temple: [['shrine', 3], ['pillars', 2], ['library', 1], ['throne', 1], ['treasure', 1], ['empty', 1], ['flooded', 0.5]],
};

export const dungeonGenerator: Generator = {
  id: 'dungeon',
  name: 'Dungeon',
  description: 'Rooms and passages with doors, stairs and furnished rooms. Pick a layout and a theme for very different dungeons.',
  params: [
    { key: 'layout', label: 'Layout', type: 'select', default: 'rooms', options: [
      { value: 'rooms', label: 'Rooms & corridors' }, { value: 'maze', label: 'Labyrinth' }, { value: 'cavern', label: 'Rooms joined by caves' },
    ] },
    { key: 'theme', label: 'Theme', type: 'select', default: 'classic', options: [
      { value: 'classic', label: 'Classic dungeon' }, { value: 'crypt', label: 'Crypt / tomb' }, { value: 'sewer', label: 'Sewers' },
      { value: 'prison', label: 'Prison' }, { value: 'temple', label: 'Temple' },
    ] },
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
    const theme = String(p.theme);
    const layout = String(p.layout);
    const cfg = SIZES[String(p.rooms)] ?? SIZES.normal;
    const cw = theme === 'sewer' ? 3 : Number(p.corridor) || 1;
    const floor = p.floor === 'wood' ? T.Wood : p.floor === 'cave' ? T.CaveFloor : T.Stone;
    fillRegion(ctx, T.Void);

    const inside = (x: number, y: number) => x >= R.x + 1 && y >= R.y + 1 && x < R.x + R.w - 1 && y < R.y + R.h - 1;
    const carve = (x: number, y: number, t: T = floor) => {
      if (inside(x, y) && map.get(x, y) === T.Void) map.set(x, y, t);
    };
    const roomTiles = new Set<number>();
    const carveRoom = (room: Room, t: T = floor) => {
      const cx = room.x + room.w / 2, cy = room.y + room.h / 2;
      for (let y = room.y; y < room.y + room.h; y++)
        for (let x = room.x; x < room.x + room.w; x++) {
          if (room.round) {
            const dx = (x + 0.5 - cx) / (room.w / 2), dy = (y + 0.5 - cy) / (room.h / 2);
            if (dx * dx + dy * dy > 1.05) continue;
          }
          if (inside(x, y)) { map.set(x, y, t); roomTiles.add(y * map.width + x); }
        }
    };

    const rooms: Room[] = [];
    const channel: number[] = []; // sewer water channel tiles

    if (layout === 'maze') {
      // Recursive backtracker on a 2-tile lattice, then rooms stamped over it.
      const ox = R.x + 1, oy = R.y + 1;
      const cols = Math.floor((R.w - 3) / 2) + 1, rows = Math.floor((R.h - 3) / 2) + 1;
      if (cols < 2 || rows < 2) return;
      const seen = new Uint8Array(cols * rows);
      const stack: number[] = [rng.int(0, cols * rows - 1)];
      seen[stack[0]] = 1;
      carve(ox + (stack[0] % cols) * 2, oy + Math.floor(stack[0] / cols) * 2);
      while (stack.length) {
        const c = stack[stack.length - 1];
        const cx = c % cols, cy = Math.floor(c / cols);
        const nbs = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
          .map(([dx, dy]) => [cx + dx, cy + dy, dx, dy] as const)
          .filter(([x, y]) => x >= 0 && y >= 0 && x < cols && y < rows && !seen[y * cols + x]);
        if (!nbs.length) { stack.pop(); continue; }
        const [nx, ny, dx, dy] = rng.pick(nbs);
        seen[ny * cols + nx] = 1;
        carve(ox + cx * 2 + dx, oy + cy * 2 + dy);
        carve(ox + nx * 2, oy + ny * 2);
        stack.push(ny * cols + nx);
      }
      // Extra openings make loops.
      const openings = Math.round(cols * rows * Number(p.loops) * 0.15);
      for (let i = 0; i < openings; i++) {
        const x = ox + rng.int(0, cols - 1) * 2 + (rng.chance(0.5) ? 1 : 0);
        const y = oy + rng.int(0, rows - 1) * 2 + (x % 2 === ox % 2 ? 1 : 0);
        carve(x, y);
      }
      // Rooms on odd-aligned rectangles so their edges meet passages.
      const want = Math.max(2, Math.round((R.w * R.h) / (cfg.maxLeaf * cfg.maxLeaf * 1.6)));
      for (let tries = 0; tries < 300 && rooms.length < want; tries++) {
        const w = rng.int(Math.max(1, cfg.minRoom / 2 | 0), Math.max(2, (cfg.maxLeaf / 3) | 0)) * 2 + 1;
        const h = rng.int(Math.max(1, cfg.minRoom / 2 | 0), Math.max(2, (cfg.maxLeaf / 3) | 0)) * 2 + 1;
        const x = ox + rng.int(0, Math.max(0, (cols * 2 - 1 - w) >> 1)) * 2, y = oy + rng.int(0, Math.max(0, (rows * 2 - 1 - h) >> 1)) * 2;
        if (x + w > R.x + R.w - 1 || y + h > R.y + R.h - 1) continue;
        const r: Room = { x, y, w, h, round: false };
        if (rooms.some((o) => r.x < o.x + o.w + 2 && r.x + r.w + 2 > o.x && r.y < o.y + o.h + 2 && r.y + r.h + 2 > o.y)) continue;
        rooms.push(r);
        carveRoom(r);
      }
      // Trim some dead ends so the maze is less uniform.
      const trims = Math.round((1 - Number(p.loops)) * 6);
      for (let pass = 0; pass < trims; pass++) {
        const dead: [number, number][] = [];
        for (let y = R.y + 1; y < R.y + R.h - 1; y++)
          for (let x = R.x + 1; x < R.x + R.w - 1; x++) {
            if (map.get(x, y) === T.Void || roomTiles.has(y * map.width + x)) continue;
            const n = [map.get(x + 1, y), map.get(x - 1, y), map.get(x, y + 1), map.get(x, y - 1)].filter((t) => t !== T.Void).length;
            if (n <= 1) dead.push([x, y]);
          }
        for (const [x, y] of dead) if (rng.chance(0.5)) map.set(x, y, T.Void);
      }
    } else {
      const split = (rect: Rect, depth: number): Node => {
        const node: Node = { rect };
        if (depth > 12 || (rect.w <= cfg.maxLeaf && rect.h <= cfg.maxLeaf && rng.chance(0.75))) return node;
        let horiz = rect.h > rect.w * 1.2 ? true : rect.w > rect.h * 1.2 ? false : rng.chance(0.5);
        if ((horiz ? rect.h : rect.w) < cfg.minLeaf * 2) {
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
      const makeRooms = (n: Node) => {
        if (n.a && n.b) { makeRooms(n.a); makeRooms(n.b); return; }
        const L = n.rect;
        const maxW = L.w - 2, maxH = L.h - 2;
        if (maxW < 3 || maxH < 3) return;
        const minW = Math.min(cfg.minRoom, maxW), minH = Math.min(cfg.minRoom, maxH);
        const w = rng.int(minW, maxW), h = rng.int(minH, maxH);
        n.room = {
          x: L.x + rng.int(1, L.w - w - 1),
          y: L.y + rng.int(1, L.h - h - 1),
          w, h,
          round: Math.min(w, h) >= 7 && rng.chance(theme === 'temple' ? 0.35 : 0.2),
        };
        rooms.push(n.room);
      };
      makeRooms(root);
      if (!rooms.length) return;
      for (const room of rooms) {
        if (layout === 'cavern' && rng.chance(0.35) && Math.min(room.w, room.h) >= 5) carveCaveRoom(ctx, room, roomTiles, inside);
        else carveRoom(room);
      }

      const center = (r: Room) => [Math.floor(r.x + r.w / 2), Math.floor(r.y + r.h / 2)];
      const corridor = (a: Room, b: Room) => {
        const [ax, ay] = center(a), [bx, by] = center(b);
        if (layout === 'cavern') {
          const pts = wobblyLine(rng, ax + 0.5, ay + 0.5, bx + 0.5, by + 0.5, 0.18, 4);
          stampLine(pts, rng.range(1.8, 3), (x, y) => carve(x, y, T.CaveFloor));
          return;
        }
        const off = -Math.floor((cw - 1) / 2);
        const hline = (x0: number, x1: number, y: number) => {
          for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
            for (let k = 0; k < cw; k++) carve(x, y + off + k);
            if (theme === 'sewer') channel.push(x, y);
          }
        };
        const vline = (y0: number, y1: number, x: number) => {
          for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
            for (let k = 0; k < cw; k++) carve(x + off + k, y);
            if (theme === 'sewer') channel.push(x, y);
          }
        };
        if (rng.chance(0.5)) { hline(ax, bx, ay); vline(ay, by, bx); } else { vline(ay, by, ax); hline(ax, bx, by); }
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
      const loops = Math.round(rooms.length * Number(p.loops) * 0.5);
      for (let i = 0; i < loops; i++) {
        const a = rng.pick(rooms);
        const [ax, ay] = center(a);
        const near = rooms.filter((b) => b !== a).sort((b1, b2) =>
          Math.abs(center(b1)[0] - ax) + Math.abs(center(b1)[1] - ay) - (Math.abs(center(b2)[0] - ax) + Math.abs(center(b2)[1] - ay)));
        if (near.length) corridor(a, near[Math.min(near.length - 1, rng.int(0, 1))]);
      }
    }

    // Sewer: a water channel runs down the middle of each tunnel, sunk below the walkways.
    for (let i = 0; i < channel.length; i += 2) {
      const x = channel[i], y = channel[i + 1];
      if (roomTiles.has(y * map.width + x) || !inside(x, y)) continue;
      map.set(x, y, T.Water);
      map.setElev(x, y, -1);
    }

    const put = (type: string, x: number, y: number, w: number, h: number, rot = 0, color?: string) =>
      map.addObject({ type, x, y, w, h, rot, color });
    const isFloor = (x: number, y: number) => map.get(x, y) !== T.Void;

    if (p.doors && layout !== 'cavern') {
      for (const room of rooms) {
        if (room.round) continue;
        const check = (x: number, y: number, horizontal: boolean) => {
          if (!isFloor(x, y) || map.get(x, y) === T.Water) return;
          const side1 = horizontal ? isFloor(x - 1, y) : isFloor(x, y - 1);
          const side2 = horizontal ? isFloor(x + 1, y) : isFloor(x, y + 1);
          if (side1 || side2 || !rng.chance(theme === 'prison' ? 1 : 0.7)) return;
          put('door', x + 0.5, y + 0.5, 1, 1, horizontal ? 0 : Math.PI / 2);
        };
        for (let x = room.x; x < room.x + room.w; x++) { check(x, room.y - 1, true); check(x, room.y + room.h, true); }
        for (let y = room.y; y < room.y + room.h; y++) { check(room.x - 1, y, false); check(room.x + room.w, y, false); }
      }
    }

    if (p.dressing) furnish(ctx, rooms, put, isFloor, THEME_ROOMS[theme] ?? THEME_ROOMS.classic, floor);
  },
};

function carveCaveRoom(ctx: GenContext, room: Room, roomTiles: Set<number>, inside: (x: number, y: number) => boolean) {
  const { map, rng } = ctx;
  const cx = room.x + room.w / 2, cy = room.y + room.h / 2;
  const phase = rng.range(0, 6.28);
  for (let y = room.y - 1; y <= room.y + room.h; y++)
    for (let x = room.x - 1; x <= room.x + room.w; x++) {
      const dx = (x + 0.5 - cx) / (room.w / 2 + 0.5), dy = (y + 0.5 - cy) / (room.h / 2 + 0.5);
      const a = Math.atan2(dy, dx);
      const rr = 0.85 + 0.15 * Math.sin(a * 3 + phase) + 0.08 * Math.sin(a * 7 + phase * 2);
      if (dx * dx + dy * dy < rr * rr && inside(x, y)) { map.set(x, y, T.CaveFloor); roomTiles.add(y * map.width + x); }
    }
  room.round = true;
}

type Put = (type: string, x: number, y: number, w: number, h: number, rot?: number, color?: string) => unknown;

function pickKind(ctx: GenContext, table: [Kind, number][]): Kind {
  const total = table.reduce((s, [, w]) => s + w, 0);
  let r = ctx.rng.next() * total;
  for (const [k, w] of table) { r -= w; if (r <= 0) return k; }
  return table[0][0];
}

function furnish(ctx: GenContext, rooms: Room[], put: Put, isFloor: (x: number, y: number) => boolean, table: [Kind, number][], floor: T) {
  const { rng, map } = ctx;
  // Stairs in the two rooms that are farthest apart.
  let s0 = rooms[0], s1 = rooms[rooms.length - 1], far = -1;
  for (const a of rooms) for (const b of rooms) {
    const d = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    if (d > far) { far = d; s0 = a; s1 = b; }
  }
  const used = new Set<Room>();
  for (const r of [s0, s1]) {
    if (!r || r.round || r.h < 3) continue;
    put('stairs', r.x + 0.5, r.y + 1, 1, 2);
    used.add(r);
  }
  const free = (x: number, y: number) => isFloor(Math.floor(x), Math.floor(y)) && map.get(Math.floor(x), Math.floor(y)) !== T.Water;

  for (const r of rooms) {
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const midX = Math.floor(cx) + (r.w % 2 ? 0.5 : 0);
    if (!r.round && rng.chance(0.6)) {
      for (let x = r.x + 1; x < r.x + r.w - 1; x += 4) if (!isFloor(x, r.y - 1)) put('torch', x + 0.5, r.y + 0.2, 0.5, 0.5);
    }
    const kind: Kind = used.has(r) ? 'empty' : pickKind(ctx, table);
    switch (kind) {
      case 'pillars': {
        if (r.w < 6 || r.h < 6) break;
        for (let x = r.x + 1; x < r.x + r.w - 1; x += 2) {
          if (free(x + 0.5, r.y + 1.5)) put('pillar', x + 0.5, r.y + 1.5, 0.8, 0.8);
          if (free(x + 0.5, r.y + r.h - 1.5)) put('pillar', x + 0.5, r.y + r.h - 1.5, 0.8, 0.8);
        }
        break;
      }
      case 'storage': {
        const n = rng.int(3, 8);
        const corner = rng.int(0, 3);
        const bx = corner % 2 ? r.x + r.w - 1 : r.x, by = corner > 1 ? r.y + r.h - 1 : r.y;
        for (let i = 0; i < n; i++) {
          const x = bx + 0.5 + (corner % 2 ? -1 : 1) * rng.range(0, 2), y = by + 0.5 + (corner > 1 ? -1 : 1) * rng.range(0, 2);
          if (free(x, y)) put(rng.pick(['barrel', 'crate', 'sack']), x, y, 0.65, 0.65, rng.chance(0.5) ? 0 : rng.range(-0.3, 0.3));
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
        if (r.w < 4 || r.h < 3) break;
        // Raised dais at the top of the room.
        for (let y = r.y; y < r.y + 2; y++) for (let x = Math.floor(cx) - 2; x <= Math.floor(cx) + 1; x++) if (isFloor(x, y)) map.setElev(x, y, 1);
        put('altar', midX, r.y + 1, 2, 1);
        if (r.w >= 6) { put('statue', r.x + 1.5, r.y + 1.5, 1, 1); put('statue', r.x + r.w - 1.5, r.y + 1.5, 1, 1); }
        if (r.h >= 6) put('rug', midX, r.y + r.h / 2 + 1, 1.6, Math.max(2, r.h - 4), 0, '#8b2c2c');
        put('torch', r.x + 0.5, r.y + r.h - 0.5, 0.5, 0.5);
        put('torch', r.x + r.w - 0.5, r.y + r.h - 0.5, 0.5, 0.5);
        break;
      }
      case 'throne': {
        if (r.w < 5 || r.h < 5) break;
        for (let y = r.y; y < r.y + 2; y++) for (let x = r.x + 1; x < r.x + r.w - 1; x++) if (isFloor(x, y)) map.setElev(x, y, 1);
        put('throne', midX, r.y + 0.8, 1.2, 1.2);
        put('rug', midX, r.y + r.h / 2 + 0.8, 1.4, r.h - 2.4, 0, '#8b2c2c');
        for (let y = r.y + 3; y < r.y + r.h - 1; y += 2) { put('pillar', r.x + 1.5, y + 0.5, 0.8, 0.8); put('pillar', r.x + r.w - 1.5, y + 0.5, 0.8, 0.8); }
        break;
      }
      case 'crypt': {
        if (r.h < 4) break;
        for (let x = r.x + 1; x < r.x + r.w - 1; x += 2) if (free(x + 0.5, r.y + 1)) put('coffin', x + 0.5, r.y + 1.5, 1, 2);
        if (r.h >= 7) for (let x = r.x + 1; x < r.x + r.w - 1; x += 2) if (free(x + 0.5, r.y + r.h - 2)) put('coffin', x + 0.5, r.y + r.h - 1.5, 1, 2);
        break;
      }
      case 'barracks': {
        if (r.h < 4 || r.w < 4) break;
        const col = rng.pick(CLOTH_COLORS);
        for (let x = r.x; x < r.x + r.w - 1; x += 2) put('bed', x + 0.5, r.y + 1, 1, 2, 0, col);
        put('table', midX, r.y + r.h - 1, 2, 1);
        put('stool', midX - 0.6, r.y + r.h - 0.2, 0.45, 0.45);
        put('stool', midX + 0.6, r.y + r.h - 0.2, 0.45, 0.45);
        break;
      }
      case 'library': {
        if (r.w < 5 || r.h < 4) break;
        for (let x = r.x; x + 2 <= r.x + r.w; x += 2) put('bookshelf', x + 1, r.y + 0.25, 2, 0.5);
        put('desk', midX, Math.floor(cy) + 0.5, 1.5, 0.8);
        put('chair', midX, Math.floor(cy) + 1.2, 0.6, 0.6, Math.PI);
        if (r.h >= 6) put('rug', midX, Math.floor(cy) + 0.5, 3, 2, 0, '#2f4f7a');
        break;
      }
      case 'kitchen': {
        if (r.w < 4 || r.h < 4) break;
        put('stove', r.x + 0.5, r.y + 0.5, 1, 1);
        put('counter', r.x + 2, r.y + 0.4, 2, 0.8);
        put('pot', r.x + 0.5, r.y + 0.5, 0.45, 0.45);
        put('pan', r.x + 1.7, r.y + 0.4, 0.8, 0.45);
        put('plates', r.x + 2.6, r.y + 0.4, 0.7, 0.5);
        put('cauldron', r.x + r.w - 0.6, r.y + 0.6, 1, 1);
        put('sack', r.x + 0.6, r.y + r.h - 0.5, 0.9, 0.7);
        put('firewood', r.x + r.w - 0.7, r.y + r.h - 0.4, 1.1, 0.6);
        put('table', midX, Math.floor(cy) + 0.5, 2, 1);
        break;
      }
      case 'smithy': {
        if (r.w < 4 || r.h < 4) break;
        put('forge', r.x + 1, r.y + 1, 2, 2);
        put('anvil', r.x + 3, r.y + 1.5, 0.9, 0.5);
        put('quench', r.x + 3.2, r.y + 0.5, 0.7, 0.7);
        put('weaponrack', r.x + r.w - 1.2, r.y + r.h - 0.3, 2, 0.5);
        if (r.w >= 6) put('workbench', r.x + r.w - 1.2, r.y + 0.5, 2, 0.9);
        put('grindstone', r.x + 0.6, r.y + r.h - 0.6, 0.9, 0.9);
        break;
      }
      case 'pit': {
        if (r.w < 5 || r.h < 5) break;
        for (let y = r.y + 2; y < r.y + r.h - 2; y++) for (let x = r.x + 2; x < r.x + r.w - 2; x++) if (isFloor(x, y)) map.setElev(x, y, -2);
        if (rng.chance(0.5)) put('rock', cx, cy, 0.8, 0.8);
        break;
      }
      case 'flooded': {
        if (r.w < 5 || r.h < 5) break;
        for (let y = r.y + 1; y < r.y + r.h - 1; y++)
          for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
            const dx = (x + 0.5 - cx) / (r.w / 2 - 1), dy = (y + 0.5 - cy) / (r.h / 2 - 1);
            if (dx * dx + dy * dy < 1 && isFloor(x, y)) { map.set(x, y, dx * dx + dy * dy < 0.35 ? T.DeepWater : T.Water); map.setElev(x, y, -1); }
          }
        break;
      }
      case 'cell': {
        put('bed', r.x + 0.5, r.y + 1, 1, 2, 0, '#6a5a40');
        put('pot', r.x + r.w - 0.5, r.y + r.h - 0.5, 0.45, 0.45);
        if (rng.chance(0.3)) put('rock', r.x + r.w - 0.6, r.y + 0.6, 0.5, 0.5);
        break;
      }
      case 'guard': {
        if (r.w < 4 || r.h < 3) break;
        put('table', midX, Math.floor(cy) + 0.5, 2, 1);
        put('chair', midX - 0.6, Math.floor(cy) - 0.25, 0.6, 0.6);
        put('chair', midX + 0.6, Math.floor(cy) + 1.25, 0.6, 0.6, Math.PI);
        put('plates', midX, Math.floor(cy) + 0.5, 0.7, 0.5);
        put('weaponrack', r.x + 1, r.y + 0.25, 2, 0.5);
        break;
      }
      default:
        break;
    }
  }
  void floor;
}
