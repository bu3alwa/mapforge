// Object catalog and vector drawings. All drawing happens in tile units,
// centered on the object, before rotation.
import type { MapObject } from './map';
import { hash2 } from './rng';
import { shade } from './patterns';

export const OBJECT_CATEGORIES = ['Nature', 'Dungeon', 'Furniture', 'Kitchen', 'Workshop', 'Town'] as const;
export type ObjectCategory = (typeof OBJECT_CATEGORIES)[number];

export interface ObjectDef {
  type: string;
  name: string;
  w: number;
  h: number;
  category: ObjectCategory;
  /** Snap center to tile centers when placing. */
  snap: boolean;
  /** Natural objects get random size/rotation when scattered. */
  natural?: boolean;
  colors?: string[];
}

export const ROOF_COLORS = ['#a4553a', '#8e4a34', '#5b6470', '#b89a5a', '#7a5236', '#6b7a4a', '#4f5d6e', '#9b6b45'];
export const CLOTH_COLORS = ['#b23a3a', '#2f6fa8', '#d6a12b', '#3f8a4a', '#7a3fa0', '#e0e0d0'];

export const OBJECT_DEFS: ObjectDef[] = [
  { type: 'tree', name: 'Tree', w: 1.8, h: 1.8, category: 'Nature', snap: false, natural: true },
  { type: 'pine', name: 'Pine', w: 1.5, h: 1.5, category: 'Nature', snap: false, natural: true },
  { type: 'deadtree', name: 'Dead tree', w: 1.4, h: 1.4, category: 'Nature', snap: false, natural: true },
  { type: 'bush', name: 'Bush', w: 0.9, h: 0.9, category: 'Nature', snap: false, natural: true },
  { type: 'rock', name: 'Rock', w: 0.8, h: 0.8, category: 'Nature', snap: false, natural: true },
  { type: 'boulder', name: 'Boulder', w: 1.7, h: 1.7, category: 'Nature', snap: false, natural: true },
  { type: 'stalagmite', name: 'Stalagmite', w: 0.6, h: 0.6, category: 'Nature', snap: false, natural: true },
  { type: 'crystal', name: 'Crystals', w: 0.9, h: 0.9, category: 'Nature', snap: false, natural: true },
  { type: 'mushroom', name: 'Mushrooms', w: 0.7, h: 0.7, category: 'Nature', snap: false, natural: true },
  { type: 'palm', name: 'Palm', w: 1.8, h: 1.8, category: 'Nature', snap: false, natural: true },
  { type: 'cactus', name: 'Cactus', w: 0.8, h: 0.8, category: 'Nature', snap: false, natural: true },
  { type: 'reeds', name: 'Reeds', w: 0.9, h: 0.9, category: 'Nature', snap: false, natural: true },
  { type: 'lilypad', name: 'Lily pads', w: 0.9, h: 0.9, category: 'Nature', snap: false, natural: true },
  { type: 'log', name: 'Fallen log', w: 2.4, h: 0.6, category: 'Nature', snap: false },
  { type: 'door', name: 'Door', w: 1, h: 1, category: 'Dungeon', snap: true },
  { type: 'stairs', name: 'Stairs', w: 1, h: 2, category: 'Dungeon', snap: true },
  { type: 'pillar', name: 'Pillar', w: 0.8, h: 0.8, category: 'Dungeon', snap: true },
  { type: 'statue', name: 'Statue', w: 1, h: 1, category: 'Dungeon', snap: true },
  { type: 'chest', name: 'Chest', w: 0.8, h: 0.6, category: 'Dungeon', snap: true },
  { type: 'torch', name: 'Torch', w: 0.5, h: 0.5, category: 'Dungeon', snap: false },
  { type: 'altar', name: 'Altar', w: 2, h: 1, category: 'Dungeon', snap: true },
  { type: 'trap', name: 'Trap', w: 1, h: 1, category: 'Dungeon', snap: true },
  { type: 'coffin', name: 'Sarcophagus', w: 1, h: 2, category: 'Dungeon', snap: true },
  { type: 'barrel', name: 'Barrel', w: 0.6, h: 0.6, category: 'Furniture', snap: false },
  { type: 'crate', name: 'Crate', w: 0.75, h: 0.75, category: 'Furniture', snap: false },
  { type: 'table', name: 'Table', w: 2, h: 1, category: 'Furniture', snap: true },
  { type: 'bed', name: 'Bed', w: 1, h: 2, category: 'Furniture', snap: true, colors: CLOTH_COLORS },
  { type: 'chair', name: 'Chair', w: 0.6, h: 0.6, category: 'Furniture', snap: false },
  { type: 'stool', name: 'Stool', w: 0.45, h: 0.45, category: 'Furniture', snap: false },
  { type: 'bench', name: 'Bench', w: 2, h: 0.45, category: 'Furniture', snap: false },
  { type: 'desk', name: 'Desk', w: 1.5, h: 0.8, category: 'Furniture', snap: false },
  { type: 'bookshelf', name: 'Bookshelf', w: 2, h: 0.5, category: 'Furniture', snap: false },
  { type: 'wardrobe', name: 'Wardrobe', w: 1.5, h: 0.7, category: 'Furniture', snap: false },
  { type: 'rug', name: 'Rug', w: 3, h: 2, category: 'Furniture', snap: true, colors: ['#8b2c2c', '#2f4f7a', '#6b4a8a', '#7a6a2a', '#2f6a4a'] },
  { type: 'throne', name: 'Throne', w: 1.2, h: 1.2, category: 'Furniture', snap: true },
  { type: 'bathtub', name: 'Bathtub', w: 1, h: 2, category: 'Furniture', snap: true },
  { type: 'fireplace', name: 'Fireplace', w: 2, h: 1, category: 'Furniture', snap: true },
  { type: 'campfire', name: 'Campfire', w: 1, h: 1, category: 'Furniture', snap: true },
  { type: 'campfire_unlit', name: 'Campfire (unlit)', w: 1, h: 1, category: 'Furniture', snap: true },
  { type: 'stove', name: 'Iron stove', w: 1, h: 1, category: 'Kitchen', snap: true },
  { type: 'oven', name: 'Bread oven', w: 2, h: 2, category: 'Kitchen', snap: true },
  { type: 'cauldron', name: 'Cauldron', w: 1, h: 1, category: 'Kitchen', snap: false },
  { type: 'pot', name: 'Cooking pot', w: 0.55, h: 0.55, category: 'Kitchen', snap: false },
  { type: 'pan', name: 'Frying pan', w: 0.8, h: 0.45, category: 'Kitchen', snap: false },
  { type: 'kettle', name: 'Kettle', w: 0.45, h: 0.45, category: 'Kitchen', snap: false },
  { type: 'counter', name: 'Counter', w: 2, h: 0.8, category: 'Kitchen', snap: false },
  { type: 'plates', name: 'Plates & mugs', w: 0.7, h: 0.5, category: 'Kitchen', snap: false },
  { type: 'sack', name: 'Grain sacks', w: 0.9, h: 0.7, category: 'Kitchen', snap: false },
  { type: 'firewood', name: 'Firewood', w: 1.1, h: 0.6, category: 'Kitchen', snap: false },
  { type: 'anvil', name: 'Anvil', w: 0.9, h: 0.5, category: 'Workshop', snap: false },
  { type: 'forge', name: 'Forge', w: 2, h: 2, category: 'Workshop', snap: true },
  { type: 'workbench', name: 'Workbench', w: 2, h: 0.9, category: 'Workshop', snap: false },
  { type: 'weaponrack', name: 'Weapon rack', w: 2, h: 0.5, category: 'Workshop', snap: false },
  { type: 'armorstand', name: 'Armor stand', w: 0.8, h: 0.8, category: 'Workshop', snap: false },
  { type: 'grindstone', name: 'Grindstone', w: 0.9, h: 0.9, category: 'Workshop', snap: false },
  { type: 'quench', name: 'Quench barrel', w: 0.7, h: 0.7, category: 'Workshop', snap: false },
  { type: 'haybale', name: 'Hay bale', w: 1.2, h: 0.8, category: 'Workshop', snap: false },
  { type: 'trough', name: 'Water trough', w: 2, h: 0.7, category: 'Workshop', snap: false },
  { type: 'house', name: 'House', w: 4, h: 3, category: 'Town', snap: true, colors: ROOF_COLORS },
  { type: 'tower', name: 'Tower', w: 3, h: 3, category: 'Town', snap: true, colors: ROOF_COLORS },
  { type: 'tent', name: 'Tent', w: 2, h: 2, category: 'Town', snap: true, colors: CLOTH_COLORS },
  { type: 'stall', name: 'Market stall', w: 2, h: 1.5, category: 'Town', snap: true, colors: CLOTH_COLORS },
  { type: 'well', name: 'Well', w: 1.4, h: 1.4, category: 'Town', snap: true },
  { type: 'fountain', name: 'Fountain', w: 3, h: 3, category: 'Town', snap: true },
  { type: 'cart', name: 'Cart', w: 1.2, h: 2, category: 'Town', snap: false },
  { type: 'grave', name: 'Gravestone', w: 0.6, h: 0.9, category: 'Town', snap: false },
  { type: 'fence', name: 'Fence', w: 3, h: 0.3, category: 'Town', snap: true },
  { type: 'boat', name: 'Boat', w: 1.4, h: 3, category: 'Town', snap: false },
  { type: 'signpost', name: 'Signpost', w: 1, h: 0.6, category: 'Town', snap: false },
  { type: 'pier', name: 'Pier / boardwalk', w: 2, h: 5, category: 'Town', snap: true },
];

export const OBJECT_BY_TYPE = new Map(OBJECT_DEFS.map((d) => [d.type, d]));

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

function circle(c: Ctx, x: number, y: number, r: number) {
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
}

function outline(c: Ctx, w = 0.05, color = '#1a1410') {
  c.lineWidth = w;
  c.strokeStyle = color;
  c.stroke();
}

function shadow(c: Ctx, draw: () => void, dx = 0.18, dy = 0.22) {
  c.save();
  c.translate(dx, dy);
  c.fillStyle = 'rgba(0,0,0,0.35)';
  draw();
  c.fill();
  c.restore();
}

function lobed(c: Ctx, r: number, lobes: number, seed: number, jag = 0.18) {
  c.beginPath();
  for (let i = 0; i <= lobes * 4; i++) {
    const a = (i / (lobes * 4)) * TAU;
    const k = i % 4 === 0 ? 1 : 1 - jag * (0.5 + 0.5 * Math.sin((i % 4) * 0.8));
    const rr = r * (k * (0.92 + 0.16 * hash2(i % (lobes * 4), seed)));
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
  }
  c.closePath();
}

function drawHouse(c: Ctx, o: MapObject, w: number, h: number) {
  // Hip roof seen from above; long axis along x.
  let L = w, S = h, swapped = false;
  if (h > w) { L = h; S = w; swapped = true; c.rotate(Math.PI / 2); }
  const color = o.color ?? ROOF_COLORS[0];
  const hl = L / 2, hs = S / 2, ridge = Math.max(0, hl - hs);
  shadow(c, () => { c.beginPath(); c.rect(-hl, -hs, L, S); }, 0.3, 0.35);
  const facet = (pts: number[][], col: string) => {
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts.slice(1)) c.lineTo(p[0], p[1]);
    c.closePath();
    c.fillStyle = col;
    c.fill();
  };
  facet([[-hl, -hs], [hl, -hs], [ridge, 0], [-ridge, 0]], shade(color, 0.18));
  facet([[-hl, hs], [hl, hs], [ridge, 0], [-ridge, 0]], shade(color, -0.22));
  facet([[-hl, -hs], [-ridge, 0], [-hl, hs]], color);
  facet([[hl, -hs], [ridge, 0], [hl, hs]], shade(color, -0.08));
  // Shingle rows.
  c.save();
  c.beginPath(); c.rect(-hl, -hs, L, S); c.clip();
  c.strokeStyle = 'rgba(0,0,0,0.18)';
  c.lineWidth = 0.03;
  for (let d = 0.3; d < hs; d += 0.3) {
    c.beginPath();
    c.moveTo(-hl + (hs - d) * 0, -hs + d * 0);
    c.moveTo(-hl, -d); c.lineTo(hl, -d);
    c.moveTo(-hl, d); c.lineTo(hl, d);
    c.stroke();
  }
  c.restore();
  c.strokeStyle = 'rgba(30,20,15,0.8)';
  c.lineWidth = 0.05;
  c.beginPath();
  c.moveTo(-hl, -hs); c.lineTo(-ridge, 0); c.lineTo(-hl, hs);
  c.moveTo(hl, -hs); c.lineTo(ridge, 0); c.lineTo(hl, hs);
  c.moveTo(-ridge, 0); c.lineTo(ridge, 0);
  c.stroke();
  c.beginPath(); c.rect(-hl, -hs, L, S);
  outline(c, 0.07);
  // Chimney on some houses.
  if (hash2(o.id, 7) > 0.5 && L > 2.5) {
    const cx = (hash2(o.id, 8) - 0.5) * (L - 1.5);
    c.fillStyle = '#6d625a';
    c.fillRect(cx - 0.2, -hs * 0.55 - 0.2, 0.4, 0.4);
    c.strokeStyle = '#1a1410'; c.lineWidth = 0.04;
    c.strokeRect(cx - 0.2, -hs * 0.55 - 0.2, 0.4, 0.4);
  }
  if (swapped) c.rotate(-Math.PI / 2);
}

export function drawObject(c: Ctx, o: MapObject) {
  c.save();
  c.translate(o.x, o.y);
  if (o.rot) c.rotate(o.rot);
  const w = o.w, h = o.h;
  const r = Math.min(w, h) / 2;
  const seed = o.id;
  switch (o.type) {
    case 'tree': {
      shadow(c, () => lobed(c, r, 7, seed), 0.25, 0.3);
      lobed(c, r, 7, seed);
      c.fillStyle = '#2d5524'; c.fill(); outline(c, 0.05, '#18301a');
      for (let i = 0; i < 4; i++) {
        const a = hash2(seed, i) * TAU, d = r * 0.35 * hash2(seed, i + 10);
        circle(c, Math.cos(a) * d - r * 0.12, Math.sin(a) * d - r * 0.12, r * (0.35 + 0.15 * hash2(seed, i + 20)));
        c.fillStyle = i < 2 ? '#3c7030' : '#4f8a3a'; c.fill();
      }
      circle(c, -r * 0.3, -r * 0.3, r * 0.15); c.fillStyle = '#6aa64c'; c.fill();
      break;
    }
    case 'pine': {
      const star = (rad: number) => {
        c.beginPath();
        const n = 9;
        for (let i = 0; i <= n * 2; i++) {
          const a = (i / (n * 2)) * TAU + hash2(seed, 3);
          const rr = i % 2 ? rad * 0.55 : rad;
          if (i === 0) c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        c.closePath();
      };
      shadow(c, () => star(r), 0.25, 0.3);
      star(r); c.fillStyle = '#1f4a2c'; c.fill(); outline(c, 0.04, '#10261a');
      star(r * 0.68); c.fillStyle = '#2c6338'; c.fill();
      star(r * 0.36); c.fillStyle = '#3d7d48'; c.fill();
      break;
    }
    case 'deadtree': {
      c.strokeStyle = '#3b2a1e'; c.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const a = hash2(seed, i) * TAU, l = r * (0.6 + 0.4 * hash2(seed, i + 5));
        c.lineWidth = 0.12;
        c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * l, Math.sin(a) * l); c.stroke();
        c.lineWidth = 0.06;
        c.beginPath(); c.moveTo(Math.cos(a) * l * 0.6, Math.sin(a) * l * 0.6);
        c.lineTo(Math.cos(a + 0.5) * l * 0.95, Math.sin(a + 0.5) * l * 0.95); c.stroke();
      }
      circle(c, 0, 0, 0.16); c.fillStyle = '#4a3526'; c.fill();
      break;
    }
    case 'bush': {
      shadow(c, () => lobed(c, r, 5, seed, 0.25), 0.12, 0.15);
      lobed(c, r, 5, seed, 0.25); c.fillStyle = '#3f7a35'; c.fill(); outline(c, 0.04, '#1d3a1a');
      circle(c, -r * 0.25, -r * 0.25, r * 0.4); c.fillStyle = '#5a9a45'; c.fill();
      break;
    }
    case 'rock':
    case 'boulder': {
      const poly = () => {
        c.beginPath();
        const n = 7;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU, rr = r * (0.75 + 0.25 * hash2(seed, i));
          if (i === 0) c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        c.closePath();
      };
      shadow(c, poly, 0.12, 0.16);
      poly(); c.fillStyle = '#7f7a73'; c.fill(); outline(c, 0.05, '#25211d');
      c.save(); poly(); c.clip();
      circle(c, -r * 0.35, -r * 0.35, r * 0.6); c.fillStyle = '#a19b92'; c.fill();
      c.restore();
      break;
    }
    case 'stalagmite': {
      circle(c, 0.06, 0.08, r); c.fillStyle = 'rgba(0,0,0,0.4)'; c.fill();
      circle(c, 0, 0, r); c.fillStyle = '#6a5f52'; c.fill(); outline(c, 0.04, '#1c1712');
      circle(c, -r * 0.2, -r * 0.2, r * 0.45); c.fillStyle = '#8f8270'; c.fill();
      circle(c, -r * 0.25, -r * 0.25, r * 0.15); c.fillStyle = '#b3a58f'; c.fill();
      break;
    }
    case 'crystal': {
      for (let i = 0; i < 4; i++) {
        const a = hash2(seed, i) * TAU, d = r * 0.4 * hash2(seed, i + 4), s = r * (0.35 + 0.3 * hash2(seed, i + 8));
        c.save(); c.translate(Math.cos(a) * d, Math.sin(a) * d); c.rotate(a);
        c.beginPath(); c.moveTo(0, -s); c.lineTo(s * 0.45, 0); c.lineTo(0, s); c.lineTo(-s * 0.45, 0); c.closePath();
        c.fillStyle = i % 2 ? '#7fd8f0' : '#a88cf0'; c.fill(); outline(c, 0.03, '#2a2050');
        c.restore();
      }
      break;
    }
    case 'mushroom': {
      for (let i = 0; i < 3; i++) {
        const a = hash2(seed, i) * TAU, d = r * 0.5, s = r * (0.3 + 0.2 * hash2(seed, i + 2));
        circle(c, Math.cos(a) * d, Math.sin(a) * d, s);
        c.fillStyle = i === 0 ? '#b8423a' : '#c9a35a'; c.fill(); outline(c, 0.03);
        circle(c, Math.cos(a) * d - s * 0.3, Math.sin(a) * d - s * 0.3, s * 0.2); c.fillStyle = '#f3e7cf'; c.fill();
      }
      break;
    }
    case 'door': {
      c.fillStyle = '#6b4627';
      c.fillRect(-w * 0.45, -0.14, w * 0.9, 0.28);
      c.strokeStyle = '#1a1410'; c.lineWidth = 0.05;
      c.strokeRect(-w * 0.45, -0.14, w * 0.9, 0.28);
      c.beginPath(); c.moveTo(-w * 0.15, -0.14); c.lineTo(-w * 0.15, 0.14); c.moveTo(w * 0.15, -0.14); c.lineTo(w * 0.15, 0.14); c.stroke();
      break;
    }
    case 'stairs': {
      c.fillStyle = '#8f877b';
      c.fillRect(-w / 2, -h / 2, w, h);
      const steps = Math.max(4, Math.round(h * 4));
      for (let i = 0; i < steps; i++) {
        c.fillStyle = `rgba(0,0,0,${(0.5 * i) / steps})`;
        c.fillRect(-w / 2, -h / 2 + (i * h) / steps, w, h / steps);
        c.strokeStyle = '#2a241e'; c.lineWidth = 0.03;
        c.beginPath(); c.moveTo(-w / 2, -h / 2 + (i * h) / steps); c.lineTo(w / 2, -h / 2 + (i * h) / steps); c.stroke();
      }
      c.strokeStyle = '#1a1410'; c.lineWidth = 0.06; c.strokeRect(-w / 2, -h / 2, w, h);
      break;
    }
    case 'pillar': {
      circle(c, 0.1, 0.12, r); c.fillStyle = 'rgba(0,0,0,0.4)'; c.fill();
      circle(c, 0, 0, r); c.fillStyle = '#b8b0a2'; c.fill(); outline(c, 0.06);
      circle(c, 0, 0, r * 0.7); c.strokeStyle = '#8a8274'; c.lineWidth = 0.04; c.stroke();
      circle(c, -r * 0.25, -r * 0.25, r * 0.25); c.fillStyle = '#d9d2c4'; c.fill();
      break;
    }
    case 'statue': {
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(-w / 2 + 0.1, -h / 2 + 0.12, w, h);
      c.fillStyle = '#8d877d'; c.fillRect(-w / 2, -h / 2, w, h); c.strokeStyle = '#1a1410'; c.lineWidth = 0.05; c.strokeRect(-w / 2, -h / 2, w, h);
      circle(c, 0, 0.05, r * 0.55); c.fillStyle = '#c9c2b4'; c.fill(); outline(c, 0.04);
      circle(c, 0, -0.08, r * 0.25); c.fillStyle = '#ddd6c8'; c.fill(); outline(c, 0.03);
      break;
    }
    case 'chest': {
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(-w / 2 + 0.06, -h / 2 + 0.08, w, h);
      c.fillStyle = '#7a4c25'; c.fillRect(-w / 2, -h / 2, w, h);
      c.fillStyle = '#d4a93a'; c.fillRect(-w / 2, -0.04, w, 0.08); c.fillRect(-0.06, -0.1, 0.12, 0.2);
      c.strokeStyle = '#1a1410'; c.lineWidth = 0.05; c.strokeRect(-w / 2, -h / 2, w, h);
      break;
    }
    case 'torch': {
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 1.6);
      g.addColorStop(0, 'rgba(255,190,80,0.55)'); g.addColorStop(1, 'rgba(255,150,40,0)');
      c.fillStyle = g; circle(c, 0, 0, 1.6); c.fill();
      circle(c, 0, 0, 0.16); c.fillStyle = '#4a3020'; c.fill();
      circle(c, 0, 0, 0.1); c.fillStyle = '#ffd25a'; c.fill();
      break;
    }
    case 'altar': {
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(-w / 2 + 0.1, -h / 2 + 0.12, w, h);
      c.fillStyle = '#6e6660'; c.fillRect(-w / 2, -h / 2, w, h);
      c.fillStyle = '#8b2c2c'; c.fillRect(-w / 2 + 0.15, -h / 2 + 0.15, w - 0.3, h - 0.3);
      c.strokeStyle = '#1a1410'; c.lineWidth = 0.05; c.strokeRect(-w / 2, -h / 2, w, h);
      circle(c, -w / 4, 0, 0.1); c.fillStyle = '#ffd25a'; c.fill();
      circle(c, w / 4, 0, 0.1); c.fill();
      break;
    }
    case 'trap': {
      c.strokeStyle = '#5a1a1a'; c.lineWidth = 0.05; c.setLineDash([0.12, 0.08]);
      c.strokeRect(-w * 0.4, -h * 0.4, w * 0.8, h * 0.8);
      c.setLineDash([]);
      c.fillStyle = 'rgba(120,20,20,0.25)'; c.fillRect(-w * 0.4, -h * 0.4, w * 0.8, h * 0.8);
      c.font = `bold ${h * 0.55}px Georgia`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#7a1a1a'; c.fillText('T', 0, 0.03);
      break;
    }
    case 'coffin': {
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(-w / 2 + 0.08, -h / 2 + 0.1, w, h);
      c.beginPath();
      c.moveTo(-w * 0.3, -h / 2); c.lineTo(w * 0.3, -h / 2); c.lineTo(w * 0.45, -h * 0.25);
      c.lineTo(w * 0.35, h / 2); c.lineTo(-w * 0.35, h / 2); c.lineTo(-w * 0.45, -h * 0.25); c.closePath();
      c.fillStyle = '#8d877d'; c.fill(); outline(c, 0.05);
      c.strokeStyle = '#5c564d'; c.lineWidth = 0.05;
      c.beginPath(); c.moveTo(0, -h * 0.35); c.lineTo(0, h * 0.2); c.moveTo(-w * 0.18, -h * 0.15); c.lineTo(w * 0.18, -h * 0.15); c.stroke();
      break;
    }
    case 'barrel': {
      circle(c, 0.06, 0.08, r); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fill();
      circle(c, 0, 0, r); c.fillStyle = '#8a5a32'; c.fill(); outline(c, 0.04);
      circle(c, 0, 0, r * 0.7); c.strokeStyle = '#3a3a3a'; c.lineWidth = 0.04; c.stroke();
      circle(c, 0, 0, r * 0.3); c.strokeStyle = '#5a3a20'; c.stroke();
      break;
    }
    case 'crate': {
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(-w / 2 + 0.06, -h / 2 + 0.08, w, h);
      c.fillStyle = '#a07a48'; c.fillRect(-w / 2, -h / 2, w, h);
      c.strokeStyle = '#5a3e22'; c.lineWidth = 0.05;
      c.beginPath(); c.moveTo(-w / 2, -h / 2); c.lineTo(w / 2, h / 2); c.moveTo(w / 2, -h / 2); c.lineTo(-w / 2, h / 2); c.stroke();
      c.strokeStyle = '#1a1410'; c.strokeRect(-w / 2, -h / 2, w, h);
      break;
    }
    case 'table': {
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(-w / 2 + 0.08, -h / 2 + 0.1, w, h);
      c.fillStyle = '#8c6239'; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, 0.1); c.fill(); outline(c, 0.05);
      c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 0.03;
      for (let y = -h / 2 + 0.25; y < h / 2; y += 0.25) { c.beginPath(); c.moveTo(-w / 2, y); c.lineTo(w / 2, y); c.stroke(); }
      break;
    }
    case 'bed': {
      c.fillStyle = '#6b4627'; c.fillRect(-w / 2, -h / 2, w, h);
      c.fillStyle = o.color ?? CLOTH_COLORS[0]; c.fillRect(-w / 2 + 0.06, -h / 2 + 0.55, w - 0.12, h - 0.62);
      c.fillStyle = '#efe8da'; c.fillRect(-w / 2 + 0.15, -h / 2 + 0.12, w - 0.3, 0.35);
      c.strokeStyle = '#1a1410'; c.lineWidth = 0.05; c.strokeRect(-w / 2, -h / 2, w, h);
      break;
    }
    case 'campfire': {
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 2);
      g.addColorStop(0, 'rgba(255,170,60,0.45)'); g.addColorStop(1, 'rgba(255,140,40,0)');
      c.fillStyle = g; circle(c, 0, 0, 2); c.fill();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        circle(c, Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.75, r * 0.18); c.fillStyle = '#77726a'; c.fill(); outline(c, 0.03);
      }
      circle(c, 0, 0, r * 0.45); c.fillStyle = '#e0601c'; c.fill();
      circle(c, 0, 0, r * 0.25); c.fillStyle = '#ffd04a'; c.fill();
      break;
    }
    case 'house':
      drawHouse(c, o, w, h);
      break;
    case 'tower': {
      circle(c, 0.3, 0.35, r); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fill();
      circle(c, 0, 0, r); c.fillStyle = '#77716a'; c.fill(); outline(c, 0.08);
      const color = o.color ?? ROOF_COLORS[2];
      const n = 10;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU;
        c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, r * 0.85, a0, a1); c.closePath();
        c.fillStyle = shade(color, Math.sin(a0 + 0.8) * 0.25); c.fill();
      }
      circle(c, 0, 0, r * 0.85); outline(c, 0.05);
      circle(c, 0, 0, 0.12); c.fillStyle = '#2a2420'; c.fill();
      break;
    }
    case 'tent': {
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(-w / 2 + 0.15, -h / 2 + 0.2, w, h);
      const col = o.color ?? CLOTH_COLORS[0];
      const tri = (pts: number[][], s: number) => {
        c.beginPath(); c.moveTo(0, 0); c.lineTo(pts[0][0], pts[0][1]); c.lineTo(pts[1][0], pts[1][1]); c.closePath();
        c.fillStyle = shade(col, s); c.fill();
      };
      tri([[-w / 2, -h / 2], [w / 2, -h / 2]], 0.2);
      tri([[w / 2, -h / 2], [w / 2, h / 2]], 0);
      tri([[w / 2, h / 2], [-w / 2, h / 2]], -0.25);
      tri([[-w / 2, h / 2], [-w / 2, -h / 2]], 0.05);
      c.beginPath(); c.rect(-w / 2, -h / 2, w, h); outline(c, 0.05);
      c.beginPath(); c.moveTo(-w / 2, -h / 2); c.lineTo(w / 2, h / 2); c.moveTo(w / 2, -h / 2); c.lineTo(-w / 2, h / 2);
      c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 0.03; c.stroke();
      break;
    }
    case 'stall': {
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(-w / 2 + 0.1, -h / 2 + 0.15, w, h);
      const col = o.color ?? CLOTH_COLORS[0];
      const stripes = 5;
      for (let i = 0; i < stripes; i++) {
        c.fillStyle = i % 2 ? '#efe8da' : col;
        c.fillRect(-w / 2 + (i * w) / stripes, -h / 2, w / stripes, h);
      }
      c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(-w / 2, 0, w, h / 2);
      c.strokeStyle = '#1a1410'; c.lineWidth = 0.05; c.strokeRect(-w / 2, -h / 2, w, h);
      break;
    }
    case 'well': {
      circle(c, 0.1, 0.12, r); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fill();
      circle(c, 0, 0, r); c.fillStyle = '#8a847a'; c.fill(); outline(c, 0.05);
      circle(c, 0, 0, r * 0.6); c.fillStyle = '#1d3a52'; c.fill(); outline(c, 0.04);
      c.fillStyle = '#6b4627'; c.fillRect(-r, -0.06, r * 2, 0.12);
      break;
    }
    case 'fountain': {
      const oct = (rad: number) => {
        c.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU + Math.PI / 8;
          if (i === 0) c.moveTo(Math.cos(a) * rad, Math.sin(a) * rad); else c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
        }
        c.closePath();
      };
      shadow(c, () => oct(r), 0.15, 0.2);
      oct(r); c.fillStyle = '#a8a091'; c.fill(); outline(c, 0.06);
      oct(r * 0.82); c.fillStyle = '#4b8ab5'; c.fill(); outline(c, 0.04);
      circle(c, 0, 0, r * 0.25); c.fillStyle = '#b8b0a2'; c.fill(); outline(c, 0.04);
      circle(c, 0, 0, r * 0.1); c.fillStyle = '#9fd0ee'; c.fill();
      break;
    }
    case 'cart': {
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(-w / 2 + 0.08, -h / 2 + 0.1, w, h * 0.75);
      c.fillStyle = '#3a2a1e'; c.fillRect(-w / 2 - 0.08, -0.25, 0.12, 0.6); c.fillRect(w / 2 - 0.04, -0.25, 0.12, 0.6);
      c.fillStyle = '#8c6239'; c.fillRect(-w / 2, -h / 2, w, h * 0.72);
      c.strokeStyle = '#1a1410'; c.lineWidth = 0.05; c.strokeRect(-w / 2, -h / 2, w, h * 0.72);
      c.beginPath(); c.moveTo(-0.15, h * 0.22); c.lineTo(-0.15, h / 2); c.moveTo(0.15, h * 0.22); c.lineTo(0.15, h / 2); c.stroke();
      break;
    }
    case 'grave': {
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.roundRect(-w / 2 + 0.06, -h / 2 + 0.08, w, h, [0.3, 0.3, 0.05, 0.05]); c.fill();
      c.fillStyle = '#9a958c'; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, [0.3, 0.3, 0.05, 0.05]); c.fill(); outline(c, 0.04);
      c.strokeStyle = '#5c584f'; c.lineWidth = 0.04;
      c.beginPath(); c.moveTo(0, -h * 0.25); c.lineTo(0, h * 0.15); c.moveTo(-w * 0.2, -h * 0.1); c.lineTo(w * 0.2, -h * 0.1); c.stroke();
      break;
    }
    case 'fence': {
      c.strokeStyle = '#5c3e24'; c.lineWidth = 0.1;
      c.beginPath(); c.moveTo(-w / 2, 0); c.lineTo(w / 2, 0); c.stroke();
      c.fillStyle = '#3e2a18';
      for (let x = -w / 2; x <= w / 2 + 0.01; x += 0.75) c.fillRect(x - 0.08, -0.08, 0.16, 0.16);
      break;
    }
    case 'boat': {
      c.beginPath();
      c.moveTo(0, -h / 2);
      c.quadraticCurveTo(w / 2, -h * 0.2, w / 2, h * 0.3);
      c.lineTo(w * 0.35, h / 2); c.lineTo(-w * 0.35, h / 2); c.lineTo(-w / 2, h * 0.3);
      c.quadraticCurveTo(-w / 2, -h * 0.2, 0, -h / 2);
      c.closePath();
      c.fillStyle = '#7a5230'; c.fill(); outline(c, 0.06);
      c.fillStyle = '#5c3e24';
      for (let y = -h * 0.15; y < h * 0.45; y += 0.55) c.fillRect(-w * 0.38, y, w * 0.76, 0.12);
      break;
    }
    case 'palm': {
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.beginPath(); c.ellipse(0.25, 0.3, r * 0.9, r * 0.7, 0, 0, TAU); c.fill();
      const fronds = 7;
      for (let i = 0; i < fronds; i++) {
        const a = (i / fronds) * TAU + hash2(seed, 1) * TAU;
        c.save(); c.rotate(a);
        c.beginPath(); c.moveTo(0, 0);
        c.quadraticCurveTo(r * 0.5, -r * 0.28, r, 0);
        c.quadraticCurveTo(r * 0.5, r * 0.28, 0, 0);
        c.fillStyle = i % 2 ? '#3f7a32' : '#4f8f3c'; c.fill(); outline(c, 0.03, '#1d3a18');
        c.strokeStyle = 'rgba(20,40,15,0.6)'; c.lineWidth = 0.025;
        c.beginPath(); c.moveTo(0, 0); c.lineTo(r * 0.95, 0); c.stroke();
        c.restore();
      }
      circle(c, 0, 0, r * 0.14); c.fillStyle = '#6b4a2a'; c.fill();
      break;
    }
    case 'cactus': {
      circle(c, 0.06, 0.08, r); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fill();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        c.beginPath(); c.ellipse(Math.cos(a) * r * 0.35, Math.sin(a) * r * 0.35, r * 0.62, r * 0.38, a, 0, TAU);
        c.fillStyle = i % 2 ? '#4f8a4a' : '#5f9a55'; c.fill();
      }
      circle(c, 0, 0, r * 0.45); c.fillStyle = '#6fae62'; c.fill(); outline(c, 0.03, '#24421f');
      c.fillStyle = '#f0e6c0';
      for (let i = 0; i < 10; i++) { const a = hash2(seed, i) * TAU, d = r * 0.8 * hash2(seed, i + 3); c.fillRect(Math.cos(a) * d, Math.sin(a) * d, 0.03, 0.03); }
      break;
    }
    case 'reeds': {
      c.lineCap = 'round';
      for (let i = 0; i < 14; i++) {
        const a = hash2(seed, i) * TAU, d = r * 0.6 * hash2(seed, i + 30);
        const x = Math.cos(a) * d, y = Math.sin(a) * d;
        const la = -Math.PI / 2 + (hash2(seed, i + 60) - 0.5) * 1.2, l = r * (0.5 + 0.5 * hash2(seed, i + 90));
        c.strokeStyle = i % 3 ? '#6d8a3a' : '#8a9a4a'; c.lineWidth = 0.05;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(la) * l, y + Math.sin(la) * l); c.stroke();
        if (i % 4 === 0) { c.fillStyle = '#6a4a2a'; c.beginPath(); c.ellipse(x + Math.cos(la) * l, y + Math.sin(la) * l, 0.05, 0.11, la + Math.PI / 2, 0, TAU); c.fill(); }
      }
      break;
    }
    case 'lilypad': {
      for (let i = 0; i < 3; i++) {
        const a = hash2(seed, i) * TAU, d = r * 0.5 * (i ? 1 : 0), s = r * (0.45 - i * 0.08);
        const x = Math.cos(a) * d, y = Math.sin(a) * d;
        c.beginPath(); c.moveTo(x, y); c.arc(x, y, s, a + 0.4, a + TAU - 0.1); c.closePath();
        c.fillStyle = i ? '#4d8a3e' : '#5a9a48'; c.fill(); outline(c, 0.025, '#22401c');
      }
      if (hash2(seed, 9) > 0.5) { circle(c, 0, 0, r * 0.13); c.fillStyle = '#f2c6d8'; c.fill(); }
      break;
    }
    case 'log': {
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.roundRect(-w / 2 + 0.08, -h / 2 + 0.1, w, h, h / 2); c.fill();
      c.fillStyle = '#6b4a2e'; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, h / 2); c.fill(); outline(c, 0.04);
      c.strokeStyle = 'rgba(30,20,10,0.5)'; c.lineWidth = 0.03;
      for (let i = 0; i < 4; i++) { const y = -h / 2 + (h * (i + 0.5)) / 4; c.beginPath(); c.moveTo(-w / 2 + h * 0.4, y); c.lineTo(w / 2 - h * 0.6, y); c.stroke(); }
      c.beginPath(); c.ellipse(w / 2 - h * 0.35, 0, h * 0.32, h * 0.45, 0, 0, TAU); c.fillStyle = '#b08a5a'; c.fill(); outline(c, 0.03);
      c.beginPath(); c.ellipse(w / 2 - h * 0.35, 0, h * 0.15, h * 0.22, 0, 0, TAU); c.strokeStyle = '#7a5a3a'; c.stroke();
      if (hash2(seed, 2) > 0.5) { circle(c, -w * 0.15, -h * 0.2, 0.12); c.fillStyle = '#4f8a3a'; c.fill(); }
      break;
    }
    case 'chair':
    case 'stool': {
      const wood = '#7c5530';
      if (o.type === 'chair') {
        c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(-w / 2 + 0.05, -h / 2 + 0.06, w, h);
        c.fillStyle = wood; c.beginPath(); c.roundRect(-w / 2, -h / 2 + h * 0.2, w, h * 0.8, 0.06); c.fill(); outline(c, 0.04);
        c.fillStyle = '#5c3d22'; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h * 0.25, 0.04); c.fill(); outline(c, 0.04);
      } else {
        circle(c, 0.04, 0.05, r); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fill();
        circle(c, 0, 0, r); c.fillStyle = wood; c.fill(); outline(c, 0.04);
        circle(c, 0, 0, r * 0.55); c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 0.03; c.stroke();
      }
      break;
    }
    case 'bench':
    case 'counter':
    case 'workbench':
    case 'desk': {
      const top = o.type === 'counter' ? '#9a8a74' : o.type === 'workbench' ? '#8a6a40' : o.type === 'desk' ? '#6e4a2a' : '#8c6239';
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(-w / 2 + 0.08, -h / 2 + 0.1, w, h);
      c.fillStyle = top; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, 0.05); c.fill(); outline(c, 0.05);
      c.strokeStyle = 'rgba(0,0,0,0.22)'; c.lineWidth = 0.025;
      if (o.type === 'counter') {
        for (let x = -w / 2 + 0.5; x < w / 2; x += 0.5) { c.beginPath(); c.moveTo(x, -h / 2); c.lineTo(x, h / 2); c.stroke(); }
      } else {
        for (let y = -h / 2 + 0.2; y < h / 2; y += 0.2) { c.beginPath(); c.moveTo(-w / 2, y); c.lineTo(w / 2, y); c.stroke(); }
      }
      if (o.type === 'workbench') {
        c.fillStyle = '#9a9a9a'; c.fillRect(-w * 0.3, -h * 0.15, 0.4, 0.08); c.fillStyle = '#5a3a20'; c.fillRect(-w * 0.3 + 0.4, -h * 0.17, 0.25, 0.12);
        c.fillStyle = '#777'; c.fillRect(w * 0.15, 0, 0.12, 0.3); c.fillRect(w * 0.1, 0, 0.22, 0.08);
      } else if (o.type === 'desk') {
        c.fillStyle = '#efe6d0'; c.fillRect(-w * 0.2, -h * 0.25, 0.45, 0.32);
        c.fillStyle = '#1a1410'; circle(c, w * 0.28, -h * 0.1, 0.07); c.fill();
        c.strokeStyle = '#e8e0d0'; c.lineWidth = 0.02; c.beginPath(); c.moveTo(w * 0.28, -h * 0.1); c.lineTo(w * 0.38, -h * 0.35); c.stroke();
      }
      break;
    }
    case 'bookshelf': {
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(-w / 2 + 0.06, -h / 2 + 0.08, w, h);
      c.fillStyle = '#5a3a20'; c.fillRect(-w / 2, -h / 2, w, h);
      const n = Math.floor(w / 0.12);
      for (let i = 0; i < n; i++) {
        const bw = (w - 0.1) / n;
        c.fillStyle = ['#8b2c2c', '#2f4f7a', '#6a7a2a', '#7a5a2a', '#4a2a5a', '#a08040'][Math.floor(hash2(seed, i) * 6)];
        c.fillRect(-w / 2 + 0.05 + i * bw, -h / 2 + 0.06 + hash2(seed, i + 40) * 0.08, bw * 0.85, h - 0.14);
      }
      c.strokeStyle = '#1a1410'; c.lineWidth = 0.05; c.strokeRect(-w / 2, -h / 2, w, h);
      break;
    }
    case 'wardrobe': {
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(-w / 2 + 0.08, -h / 2 + 0.1, w, h);
      c.fillStyle = '#6b4627'; c.fillRect(-w / 2, -h / 2, w, h);
      c.fillStyle = '#7d5631'; c.fillRect(-w / 2 + 0.08, -h / 2 + 0.08, w - 0.16, h - 0.16);
      c.strokeStyle = '#1a1410'; c.lineWidth = 0.05; c.strokeRect(-w / 2, -h / 2, w, h);
      c.beginPath(); c.moveTo(0, -h / 2 + 0.08); c.lineTo(0, h / 2 - 0.08); c.stroke();
      c.fillStyle = '#d4a93a'; circle(c, -0.08, 0, 0.04); c.fill(); circle(c, 0.08, 0, 0.04); c.fill();
      break;
    }
    case 'rug': {
      const col = o.color ?? '#8b2c2c';
      c.fillStyle = col; c.fillRect(-w / 2, -h / 2, w, h);
      c.strokeStyle = shade(col, 0.35); c.lineWidth = 0.1; c.strokeRect(-w / 2 + 0.2, -h / 2 + 0.2, w - 0.4, h - 0.4);
      c.strokeStyle = shade(col, -0.3); c.lineWidth = 0.05; c.strokeRect(-w / 2 + 0.35, -h / 2 + 0.35, w - 0.7, h - 0.7);
      c.fillStyle = shade(col, 0.35);
      c.beginPath(); c.moveTo(0, -h * 0.22); c.lineTo(w * 0.18, 0); c.lineTo(0, h * 0.22); c.lineTo(-w * 0.18, 0); c.closePath(); c.fill();
      c.strokeStyle = '#e8dcc0'; c.lineWidth = 0.03;
      for (let y = -h / 2; y <= h / 2 + 0.01; y += 0.15) { c.beginPath(); c.moveTo(-w / 2 - 0.12, y); c.lineTo(-w / 2, y); c.moveTo(w / 2, y); c.lineTo(w / 2 + 0.12, y); c.stroke(); }
      break;
    }
    case 'throne': {
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(-w / 2 + 0.1, -h / 2 + 0.12, w, h);
      c.fillStyle = '#b8902e'; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, 0.12); c.fill(); outline(c, 0.05);
      c.fillStyle = '#8b2c2c'; c.beginPath(); c.roundRect(-w / 2 + 0.2, -h / 2 + 0.35, w - 0.4, h - 0.5, 0.08); c.fill();
      c.fillStyle = '#d8b44a'; c.fillRect(-w / 2, -h / 2, w, 0.25); c.strokeStyle = '#1a1410'; c.lineWidth = 0.04; c.strokeRect(-w / 2, -h / 2, w, 0.25);
      break;
    }
    case 'bathtub': {
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.roundRect(-w / 2 + 0.08, -h / 2 + 0.1, w, h, 0.4); c.fill();
      c.fillStyle = '#8a6a44'; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, 0.4); c.fill(); outline(c, 0.05);
      c.fillStyle = '#6fa8c8'; c.beginPath(); c.roundRect(-w / 2 + 0.12, -h / 2 + 0.12, w - 0.24, h - 0.24, 0.3); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 0.03; c.beginPath(); c.arc(0, -h * 0.15, 0.15, 0.3, 2.5); c.stroke();
      break;
    }
    case 'fireplace':
    case 'oven':
    case 'forge': {
      const lit = true;
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(-w / 2 + 0.1, -h / 2 + 0.12, w, h);
      c.fillStyle = o.type === 'forge' ? '#4a4440' : '#7a5a48';
      c.fillRect(-w / 2, -h / 2, w, h);
      // Bricks.
      c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 0.025;
      for (let y = -h / 2 + 0.2, row = 0; y < h / 2; y += 0.2, row++) {
        c.beginPath(); c.moveTo(-w / 2, y); c.lineTo(w / 2, y); c.stroke();
        for (let x = -w / 2 + (row % 2 ? 0.2 : 0); x < w / 2; x += 0.4) { c.beginPath(); c.moveTo(x, y - 0.2); c.lineTo(x, y); c.stroke(); }
      }
      c.strokeStyle = '#1a1410'; c.lineWidth = 0.06; c.strokeRect(-w / 2, -h / 2, w, h);
      if (o.type === 'oven') {
        c.beginPath(); c.arc(0, h * 0.1, w * 0.3, 0, TAU); c.fillStyle = '#2a1a12'; c.fill(); outline(c, 0.05);
        c.beginPath(); c.arc(0, h * 0.1, w * 0.18, 0, TAU); c.fillStyle = '#c8501c'; c.fill();
        c.fillStyle = '#d4b480'; c.beginPath(); c.ellipse(-w * 0.08, h * 0.08, 0.14, 0.09, 0.3, 0, TAU); c.fill();
      } else {
        const fx = o.type === 'forge' ? 0 : 0, fy = o.type === 'forge' ? 0 : h * 0.1;
        const fw = o.type === 'forge' ? w * 0.6 : w * 0.6, fh = o.type === 'forge' ? h * 0.6 : h * 0.55;
        c.fillStyle = '#1e1410'; c.fillRect(fx - fw / 2, fy - fh / 2, fw, fh);
        if (lit) {
          const g = c.createRadialGradient(fx, fy, 0, fx, fy, Math.max(fw, fh) * 0.7);
          g.addColorStop(0, '#ffd04a'); g.addColorStop(0.45, '#e2601c'); g.addColorStop(1, '#3a120a');
          c.fillStyle = g; c.fillRect(fx - fw / 2 + 0.06, fy - fh / 2 + 0.06, fw - 0.12, fh - 0.12);
          for (let i = 0; i < 6; i++) { c.fillStyle = '#2a1a12'; circle(c, fx + (hash2(seed, i) - 0.5) * fw * 0.7, fy + (hash2(seed, i + 5) - 0.5) * fh * 0.7, 0.07); c.fill(); }
        }
        if (o.type === 'forge') { c.fillStyle = '#6b4a2e'; c.fillRect(w / 2 - 0.05, -0.25, 0.35, 0.5); c.strokeStyle = '#1a1410'; c.lineWidth = 0.04; c.strokeRect(w / 2 - 0.05, -0.25, 0.35, 0.5); }
      }
      break;
    }
    case 'stove': {
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(-w / 2 + 0.07, -h / 2 + 0.09, w, h);
      c.fillStyle = '#2c2a28'; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, 0.08); c.fill(); outline(c, 0.05);
      c.fillStyle = '#3c3a37'; c.fillRect(-w / 2 + 0.08, -h / 2 + 0.08, w - 0.16, h - 0.16);
      for (const [x, y] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) {
        circle(c, x * w, y * h, 0.15); c.fillStyle = '#1a1816'; c.fill();
        c.strokeStyle = '#5a5652'; c.lineWidth = 0.025; circle(c, x * w, y * h, 0.1); c.stroke();
      }
      circle(c, 0.2 * w, 0.2 * h, 0.07); c.fillStyle = '#d0501c'; c.fill();
      c.fillStyle = '#4a4642'; c.fillRect(-0.08, -h / 2 - 0.12, 0.16, 0.16);
      break;
    }
    case 'cauldron':
    case 'pot': {
      circle(c, 0.06, 0.08, r); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fill();
      circle(c, 0, 0, r); c.fillStyle = '#2a2826'; c.fill(); outline(c, 0.05);
      circle(c, 0, 0, r * 0.78); c.fillStyle = o.type === 'cauldron' ? '#5fae4a' : '#9a6a3a'; c.fill();
      circle(c, -r * 0.25, -r * 0.2, r * 0.15); c.fillStyle = 'rgba(255,255,255,0.35)'; c.fill();
      if (o.type === 'cauldron') { circle(c, r * 0.25, r * 0.15, r * 0.1); c.fillStyle = '#8ad66a'; c.fill(); }
      c.strokeStyle = '#555'; c.lineWidth = 0.04; c.beginPath(); c.arc(0, 0, r * 1.08, -0.6, 0.6); c.stroke(); c.beginPath(); c.arc(0, 0, r * 1.08, Math.PI - 0.6, Math.PI + 0.6); c.stroke();
      break;
    }
    case 'pan': {
      const pr = h / 2;
      c.fillStyle = '#3a3634'; c.fillRect(-w / 2 + pr * 1.6, -0.05, w - pr * 1.6, 0.1);
      circle(c, -w / 2 + pr, 0, pr); c.fillStyle = '#2a2826'; c.fill(); outline(c, 0.03);
      circle(c, -w / 2 + pr, 0, pr * 0.75); c.fillStyle = '#4a4542'; c.fill();
      circle(c, -w / 2 + pr * 0.9, -pr * 0.05, pr * 0.3); c.fillStyle = '#f4e8c8'; c.fill();
      circle(c, -w / 2 + pr * 0.9, -pr * 0.05, pr * 0.13); c.fillStyle = '#e8b02a'; c.fill();
      break;
    }
    case 'kettle': {
      circle(c, 0, 0, r); c.fillStyle = '#5a5250'; c.fill(); outline(c, 0.03);
      c.fillStyle = '#5a5250'; c.fillRect(r * 0.7, -0.04, r * 0.7, 0.08);
      c.strokeStyle = '#2a2826'; c.lineWidth = 0.04; c.beginPath(); c.arc(0, 0, r * 0.6, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
      circle(c, 0, 0, r * 0.2); c.fillStyle = '#7a7270'; c.fill();
      break;
    }
    case 'plates': {
      for (let i = 0; i < 3; i++) {
        const x = (i - 1) * w * 0.3, y = (hash2(seed, i) - 0.5) * h * 0.4;
        circle(c, x, y, h * 0.32); c.fillStyle = i === 1 ? '#8a6a44' : '#e8e2d4'; c.fill(); outline(c, 0.02);
        if (i !== 1) { circle(c, x, y, h * 0.18); c.strokeStyle = 'rgba(0,0,0,0.2)'; c.stroke(); }
        else { circle(c, x, y, h * 0.2); c.fillStyle = '#d8a030'; c.fill(); }
      }
      break;
    }
    case 'sack': {
      for (let i = 0; i < 2; i++) {
        const x = (i - 0.5) * w * 0.45, y = (i - 0.5) * h * 0.15;
        c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(x + 0.05, y + 0.06, w * 0.28, h * 0.42, 0, 0, TAU); c.fill();
        c.fillStyle = i ? '#c8b08a' : '#b89e78'; c.beginPath(); c.ellipse(x, y, w * 0.28, h * 0.42, 0, 0, TAU); c.fill(); outline(c, 0.03);
        c.strokeStyle = '#6a5a40'; c.lineWidth = 0.04; c.beginPath(); c.moveTo(x - 0.08, y - h * 0.25); c.lineTo(x + 0.08, y - h * 0.25); c.stroke();
      }
      break;
    }
    case 'firewood': {
      for (let i = 0; i < 6; i++) {
        const row = i < 3 ? 0 : 1, col = i % 3;
        const x = (col - 1) * h * 0.38 + row * h * 0.19, y = (row - 0.5) * h * 0.4;
        c.fillStyle = '#6b4a2e'; c.fillRect(-w / 2, y - h * 0.18, w, h * 0.36);
        circle(c, x + w * 0.35, y, h * 0.18); c.fillStyle = '#b08a5a'; c.fill(); outline(c, 0.025);
      }
      break;
    }
    case 'anvil': {
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(-w / 2 + 0.06, -h / 2 + 0.08, w, h);
      c.fillStyle = '#3a3a3e'; c.fillRect(-w * 0.2, -h * 0.35, w * 0.4, h * 0.7);
      c.beginPath();
      c.moveTo(-w / 2, -h * 0.28); c.lineTo(w * 0.3, -h * 0.28); c.lineTo(w / 2, -h * 0.05); c.lineTo(w / 2, h * 0.05);
      c.lineTo(w * 0.3, h * 0.28); c.lineTo(-w / 2, h * 0.28); c.closePath();
      c.fillStyle = '#56565c'; c.fill(); outline(c, 0.04);
      c.fillStyle = '#7a7a82'; c.fillRect(-w * 0.4, -h * 0.15, w * 0.6, h * 0.12);
      break;
    }
    case 'weaponrack': {
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(-w / 2 + 0.06, -h / 2 + 0.08, w, h);
      c.fillStyle = '#6b4627'; c.fillRect(-w / 2, -h * 0.15, w, h * 0.3); outline(c, 0.03);
      c.strokeStyle = '#1a1410'; c.lineWidth = 0.04; c.strokeRect(-w / 2, -h * 0.15, w, h * 0.3);
      for (let x = -w / 2 + 0.25; x < w / 2 - 0.1; x += 0.35) {
        c.strokeStyle = '#b8b8c0'; c.lineWidth = 0.06; c.beginPath(); c.moveTo(x, -h / 2); c.lineTo(x, h / 2); c.stroke();
        c.strokeStyle = '#6b4627'; c.lineWidth = 0.12; c.beginPath(); c.moveTo(x - 0.1, h * 0.25); c.lineTo(x + 0.1, h * 0.25); c.stroke();
      }
      break;
    }
    case 'armorstand': {
      circle(c, 0.06, 0.08, r); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fill();
      c.fillStyle = '#7a7a84'; c.beginPath(); c.ellipse(0, 0, r * 0.95, r * 0.6, 0, 0, TAU); c.fill(); outline(c, 0.04);
      c.fillStyle = '#9a9aa4'; c.beginPath(); c.ellipse(0, 0, r * 0.5, r * 0.4, 0, 0, TAU); c.fill();
      circle(c, 0, 0, r * 0.28); c.fillStyle = '#5a5a64'; c.fill(); outline(c, 0.03);
      break;
    }
    case 'grindstone': {
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(-w / 2 + 0.06, -h / 2 + 0.08, w, h);
      c.fillStyle = '#6b4627'; c.fillRect(-w / 2, -h * 0.12, w, h * 0.24);
      c.fillStyle = '#9a948a'; c.fillRect(-w * 0.15, -h / 2, w * 0.3, h); c.strokeStyle = '#1a1410'; c.lineWidth = 0.04; c.strokeRect(-w * 0.15, -h / 2, w * 0.3, h);
      c.strokeStyle = 'rgba(0,0,0,0.3)'; for (let y = -h / 2 + 0.12; y < h / 2; y += 0.12) { c.beginPath(); c.moveTo(-w * 0.15, y); c.lineTo(w * 0.15, y); c.stroke(); }
      break;
    }
    case 'quench': {
      circle(c, 0.06, 0.08, r); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fill();
      circle(c, 0, 0, r); c.fillStyle = '#7a5230'; c.fill(); outline(c, 0.04);
      circle(c, 0, 0, r * 0.75); c.fillStyle = '#2a4a5e'; c.fill();
      c.strokeStyle = '#3a3a3a'; c.lineWidth = 0.04; circle(c, 0, 0, r * 0.9); c.stroke();
      break;
    }
    case 'haybale': {
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(-w / 2 + 0.07, -h / 2 + 0.09, w, h);
      c.fillStyle = '#d8b85a'; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, 0.1); c.fill(); outline(c, 0.04, '#6a5420');
      c.strokeStyle = 'rgba(120,90,30,0.6)'; c.lineWidth = 0.025;
      for (let i = 0; i < 12; i++) { const x = -w / 2 + hash2(seed, i) * w, y = -h / 2 + hash2(seed, i + 20) * h; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 0.15, y + 0.04); c.stroke(); }
      c.strokeStyle = '#7a5a2a'; c.lineWidth = 0.04; c.beginPath(); c.moveTo(-w * 0.2, -h / 2); c.lineTo(-w * 0.2, h / 2); c.moveTo(w * 0.2, -h / 2); c.lineTo(w * 0.2, h / 2); c.stroke();
      break;
    }
    case 'trough': {
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(-w / 2 + 0.07, -h / 2 + 0.09, w, h);
      c.fillStyle = '#7a5230'; c.fillRect(-w / 2, -h / 2, w, h); c.strokeStyle = '#1a1410'; c.lineWidth = 0.05; c.strokeRect(-w / 2, -h / 2, w, h);
      c.fillStyle = '#3a7aa3'; c.fillRect(-w / 2 + 0.1, -h / 2 + 0.1, w - 0.2, h - 0.2);
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 0.025; c.beginPath(); c.moveTo(-w * 0.3, 0); c.quadraticCurveTo(-w * 0.2, -0.06, -w * 0.1, 0); c.stroke();
      break;
    }
    case 'campfire_unlit': {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        circle(c, Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.75, r * 0.18); c.fillStyle = '#77726a'; c.fill(); outline(c, 0.03);
      }
      circle(c, 0, 0, r * 0.5); c.fillStyle = '#2e2a26'; c.fill();
      c.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI + hash2(seed, i) * 0.5;
        c.strokeStyle = '#3a2a1e'; c.lineWidth = 0.11;
        c.beginPath(); c.moveTo(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42); c.lineTo(-Math.cos(a) * r * 0.42, -Math.sin(a) * r * 0.42); c.stroke();
      }
      circle(c, r * 0.1, -r * 0.05, r * 0.12); c.fillStyle = '#5a5550'; c.fill();
      break;
    }
    case 'signpost': {
      c.fillStyle = '#5c3e24'; circle(c, 0, 0, 0.08); c.fill();
      c.fillStyle = '#9a7448';
      c.beginPath(); c.moveTo(-w / 2, -h * 0.35); c.lineTo(w * 0.35, -h * 0.35); c.lineTo(w / 2, -h * 0.1); c.lineTo(w * 0.35, h * 0.12); c.lineTo(-w / 2, h * 0.12); c.closePath();
      c.fill(); outline(c, 0.03);
      c.beginPath(); c.moveTo(w / 2, h * 0.05); c.lineTo(-w * 0.35, h * 0.05); c.lineTo(-w / 2, h * 0.28); c.lineTo(-w * 0.35, h * 0.5); c.lineTo(w / 2, h * 0.5); c.closePath();
      c.fillStyle = '#8a6438'; c.fill(); outline(c, 0.03);
      break;
    }
    case 'pier': {
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(-w / 2 + 0.12, -h / 2 + 0.15, w, h);
      const planks = Math.round(h / 0.3);
      for (let i = 0; i < planks; i++) {
        c.fillStyle = shade('#9c7448', (hash2(seed, i) - 0.5) * 0.2);
        c.fillRect(-w / 2, -h / 2 + (i * h) / planks, w, h / planks - 0.02);
      }
      c.fillStyle = '#4a3420';
      for (let y = -h / 2 + 0.3; y < h / 2; y += 1.5) { circle(c, -w / 2, y, 0.13); c.fill(); circle(c, w / 2, y, 0.13); c.fill(); }
      c.strokeStyle = '#1a1410'; c.lineWidth = 0.04; c.strokeRect(-w / 2, -h / 2, w, h);
      break;
    }
    case 'label': {
      const size = o.h;
      c.font = `600 ${size}px Georgia, 'Times New Roman', serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineJoin = 'round';
      c.lineWidth = size * 0.22;
      c.strokeStyle = 'rgba(20,15,10,0.85)';
      c.strokeText(o.text ?? '', 0, 0);
      c.fillStyle = o.color ?? '#f4ead2';
      c.fillText(o.text ?? '', 0, 0);
      break;
    }
    default: {
      c.fillStyle = '#c0f';
      c.fillRect(-w / 2, -h / 2, w, h);
    }
  }
  c.restore();
}

/** Measure a label so its bounding box matches its text. */
export function labelWidth(text: string, size: number): number {
  const cv = document.createElement('canvas').getContext('2d')!;
  cv.font = `600 100px Georgia, 'Times New Roman', serif`;
  return (cv.measureText(text).width / 100) * size + size * 0.3;
}
