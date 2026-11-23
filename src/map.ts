// Map data model: a tile grid of terrain plus a list of placed objects.

export enum T {
  Void = 0,
  DeepWater,
  Water,
  Sand,
  Dirt,
  Grass,
  Field,
  Forest,
  Snow,
  Basalt,
  Mountain,
  CaveFloor,
  Lava,
  Cobble,
  Stone,
  Wood,
  Wall,
}

export interface TerrainDef {
  id: T;
  name: string;
  color: string;
  /** Organic terrains render with rounded, blended edges; others are crisp squares. */
  organic: boolean;
  /** Dark rim drawn around organic terrain (cave walls, cliffs). */
  rim?: string;
}

export const TERRAIN: Record<T, TerrainDef> = {
  [T.Void]: { id: T.Void, name: 'Rock (void)', color: '#2a2622', organic: false },
  [T.DeepWater]: { id: T.DeepWater, name: 'Deep water', color: '#1f4e74', organic: true },
  [T.Water]: { id: T.Water, name: 'Water', color: '#3a7aa3', organic: true },
  [T.Sand]: { id: T.Sand, name: 'Sand', color: '#d8c38f', organic: true },
  [T.Dirt]: { id: T.Dirt, name: 'Dirt', color: '#8b6d4a', organic: true },
  [T.Grass]: { id: T.Grass, name: 'Grass', color: '#6e9a48', organic: true },
  [T.Field]: { id: T.Field, name: 'Farm field', color: '#b4a259', organic: false },
  [T.Forest]: { id: T.Forest, name: 'Forest floor', color: '#4b7136', organic: true },
  [T.Snow]: { id: T.Snow, name: 'Snow', color: '#e9eef2', organic: true },
  [T.Basalt]: { id: T.Basalt, name: 'Basalt / ash', color: '#3b3533', organic: true },
  [T.Mountain]: { id: T.Mountain, name: 'Mountain rock', color: '#8a847a', organic: true, rim: '#3f3a34' },
  [T.CaveFloor]: { id: T.CaveFloor, name: 'Cave floor', color: '#7a6d5c', organic: true, rim: '#0f0d0b' },
  [T.Lava]: { id: T.Lava, name: 'Lava', color: '#e2521c', organic: true, rim: '#6b1d0c' },
  [T.Cobble]: { id: T.Cobble, name: 'Cobblestone road', color: '#9a948a', organic: false },
  [T.Stone]: { id: T.Stone, name: 'Stone floor', color: '#a59d8f', organic: false },
  [T.Wood]: { id: T.Wood, name: 'Wood floor / bridge', color: '#9c7448', organic: false },
  [T.Wall]: { id: T.Wall, name: 'Stone wall', color: '#5a544d', organic: false },
};

/** Order terrains are painted in; later ones overlap earlier ones at organic edges. */
export const DRAW_ORDER: T[] = [
  T.DeepWater, T.Water, T.Sand, T.Dirt, T.Grass, T.Forest, T.Snow, T.Basalt,
  T.Mountain, T.CaveFloor, T.Lava, T.Field, T.Cobble, T.Stone, T.Wood, T.Wall,
];

export const PALETTE_ORDER: T[] = [
  T.Stone, T.Wood, T.Wall, T.CaveFloor, T.Void, T.Grass, T.Forest, T.Dirt, T.Field, T.Cobble,
  T.Sand, T.Water, T.DeepWater, T.Lava, T.Basalt, T.Mountain, T.Snow,
];

export interface MapObject {
  id: number;
  type: string;
  x: number; // center, tile units
  y: number;
  w: number;
  h: number;
  rot: number; // radians
  color?: string;
  text?: string;
  /** Layer offset: higher draws on top. Objects with equal z use a default order by type. */
  z?: number;
}

export const MIN_ELEV = -2;
export const MAX_ELEV = 4;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class MapData {
  width: number;
  height: number;
  terrain: Uint8Array;
  /** Height level per tile (MIN_ELEV..MAX_ELEV, 0 = ground). Higher areas cast shadows. */
  elevation: Int8Array;
  objects: MapObject[] = [];
  nextId = 1;
  name = 'Untitled map';

  constructor(width: number, height: number, fill: T = T.Void) {
    this.width = width;
    this.height = height;
    this.terrain = new Uint8Array(width * height).fill(fill);
    this.elevation = new Int8Array(width * height);
  }

  getElev(x: number, y: number): number {
    x = Math.min(this.width - 1, Math.max(0, x));
    y = Math.min(this.height - 1, Math.max(0, y));
    return this.elevation[y * this.width + x];
  }
  setElev(x: number, y: number, e: number): void {
    if (this.inBounds(x, y)) this.elevation[y * this.width + x] = Math.max(MIN_ELEV, Math.min(MAX_ELEV, Math.round(e)));
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }
  get(x: number, y: number): T {
    if (!this.inBounds(x, y)) return T.Void;
    return this.terrain[y * this.width + x] as T;
  }
  set(x: number, y: number, t: T): void {
    if (this.inBounds(x, y)) this.terrain[y * this.width + x] = t;
  }

  addObject(o: Omit<MapObject, 'id'>): MapObject {
    const obj = { ...o, id: this.nextId++ };
    this.objects.push(obj);
    return obj;
  }

  removeObjectsIn(r: Rect): void {
    this.objects = this.objects.filter(
      (o) => !(o.x >= r.x && o.x < r.x + r.w && o.y >= r.y && o.y < r.y + r.h),
    );
  }

  fullRect(): Rect {
    return { x: 0, y: 0, w: this.width, h: this.height };
  }
}

/** Axis-aligned bounds of an object, accounting for 90° rotations. */
export function objectBounds(o: MapObject): Rect {
  const rotated = Math.abs(Math.sin(o.rot)) > 0.5;
  const w = rotated ? o.h : o.w;
  const h = rotated ? o.w : o.h;
  return { x: o.x - w / 2, y: o.y - h / 2, w, h };
}

export function clampRect(r: Rect, map: MapData): Rect {
  const x0 = Math.max(0, Math.floor(r.x));
  const y0 = Math.max(0, Math.floor(r.y));
  const x1 = Math.min(map.width, Math.ceil(r.x + r.w));
  const y1 = Math.min(map.height, Math.ceil(r.y + r.h));
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}
