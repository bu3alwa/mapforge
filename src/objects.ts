// Object catalog and vector drawings. All drawing happens in tile units,
// centered on the object, before rotation.
import type { MapObject } from './map';
import { hash2 } from './rng';
import { shade } from './patterns';

export interface ObjectDef {
  type: string;
  name: string;
  w: number;
  h: number;
  category: 'Nature' | 'Dungeon' | 'Town' | 'Furniture';
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
  { type: 'campfire', name: 'Campfire', w: 1, h: 1, category: 'Furniture', snap: true },
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
