// Extra object catalog: taverns, inns, lodges, shops, libraries, markets, animals and more.
// Same conventions as objects.ts: tile units, centred on the object, before rotation.
// Wall-backed furniture puts its back along the top edge (-y).
import type { MapObject } from './map';
import type { ObjectCategory, ObjectDef } from './objects';
import { hash2 as H } from './rng';
import { shade } from './patterns';

type Ctx = CanvasRenderingContext2D;
type Draw = (c: Ctx, o: MapObject, w: number, h: number, s: number) => void;
interface Opts { snap?: boolean; colors?: string[]; layer?: number; natural?: boolean }

export const MORE_DEFS: ObjectDef[] = [];
const DRAW = new Map<string, Draw>();

function add(cat: ObjectCategory, type: string, name: string, w: number, h: number, opts: Opts, draw: Draw) {
  MORE_DEFS.push({ type, name, w, h, category: cat, snap: opts.snap ?? false, colors: opts.colors, layer: opts.layer, natural: opts.natural });
  DRAW.set(type, draw);
}

/** Draw an object from this catalog. Returns false for types it doesn't know. */
export function drawMore(c: Ctx, o: MapObject): boolean {
  const d = DRAW.get(o.type);
  if (!d) return false;
  d(c, o, o.w, o.h, o.id);
  return true;
}

// ---------- Palette ----------
const TAU = Math.PI * 2;
const INK = '#1a1410';
const SH = 'rgba(0,0,0,0.32)';
const WOOD = '#8c6239', DWOOD = '#6b4627', XWOOD = '#4e3320', LWOOD = '#a8804e';
const IRON = '#3c3a38', STEEL = '#9a9aa4', GOLD = '#d4a93a', STONE = '#8d877d', LSTONE = '#b8b0a2';
const CREAM = '#efe8da', COPPER = '#b86a3a', BRASS = '#c8a048', WICKER = '#b89058', GREEN = '#3f7a35';
const BOOKS = ['#8b2c2c', '#2f4f7a', '#6a7a2a', '#7a5a2a', '#4a2a5a', '#a08040', '#2a5a4a'];
const GLASS = ['#3f7a4a', '#7a2a2a', '#2f4f7a', '#8a6a2a', '#5a3a7a', '#2a6a6a'];
const POTION = ['#d03a3a', '#3a7ad0', '#4ab84a', '#b84ad0', '#e0b030', '#40c8c0'];
const CLOTH = ['#b23a3a', '#2f6fa8', '#d6a12b', '#3f8a4a', '#7a3fa0', '#e0e0d0'];
const FABRIC = ['#8b2c2c', '#2f4f7a', '#6b4a8a', '#7a6a2a', '#2f6a4a', '#8a5a3a'];
const ROOFS = ['#a4553a', '#8e4a34', '#5b6470', '#b89a5a', '#7a5236', '#6b7a4a'];

// ---------- Primitives ----------
function stroke(c: Ctx, lw: number, col = INK) { if (lw) { c.lineWidth = lw; c.strokeStyle = col; c.stroke(); } }
function rect(c: Ctx, x: number, y: number, w: number, h: number, fill: string, lw = 0.04) {
  c.beginPath(); c.rect(x, y, w, h); c.fillStyle = fill; c.fill(); stroke(c, lw);
}
function rrect(c: Ctx, x: number, y: number, w: number, h: number, rad: number, fill: string, lw = 0.04) {
  c.beginPath(); c.roundRect(x, y, w, h, Math.max(0, Math.min(rad, w / 2, h / 2))); c.fillStyle = fill; c.fill(); stroke(c, lw);
}
function disc(c: Ctx, x: number, y: number, r: number, fill: string, lw = 0.03) {
  c.beginPath(); c.arc(x, y, Math.max(0.001, r), 0, TAU); c.fillStyle = fill; c.fill(); stroke(c, lw);
}
function ell(c: Ctx, x: number, y: number, rx: number, ry: number, rot: number, fill: string, lw = 0.03) {
  c.beginPath(); c.ellipse(x, y, Math.max(0.001, rx), Math.max(0.001, ry), rot, 0, TAU); c.fillStyle = fill; c.fill(); stroke(c, lw);
}
function ring(c: Ctx, x: number, y: number, r: number, col: string, lw: number) {
  c.beginPath(); c.arc(x, y, Math.max(0.001, r), 0, TAU); stroke(c, lw, col);
}
function seg(c: Ctx, x0: number, y0: number, x1: number, y1: number, col: string, lw: number) {
  c.lineCap = 'round'; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); stroke(c, lw, col);
}
function poly(c: Ctx, pts: number[], fill: string, lw = 0.04) {
  c.beginPath(); c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath(); c.fillStyle = fill; c.fill(); stroke(c, lw);
}
function shadowRect(c: Ctx, w: number, h: number, rad = 0, d = 0.08) {
  c.beginPath(); c.roundRect(-w / 2 + d, -h / 2 + d * 1.2, w, h, Math.max(0, Math.min(rad, w / 2, h / 2))); c.fillStyle = SH; c.fill();
}
function shadowEll(c: Ctx, x: number, y: number, rx: number, ry: number, d = 0.06) {
  c.beginPath(); c.ellipse(x + d, y + d * 1.2, Math.max(0.001, rx), Math.max(0.001, ry), 0, 0, TAU); c.fillStyle = SH; c.fill();
}
/** Parallel grain lines inside a rect. */
function lines(c: Ctx, x: number, y: number, w: number, h: number, step: number, vertical = false, alpha = 0.22, lw = 0.025) {
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.strokeStyle = `rgba(0,0,0,${alpha})`; c.lineWidth = lw; c.beginPath();
  if (vertical) for (let xx = x + step; xx < x + w; xx += step) { c.moveTo(xx, y); c.lineTo(xx, y + h); }
  else for (let yy = y + step; yy < y + h; yy += step) { c.moveTo(x, yy); c.lineTo(x + w, yy); }
  c.stroke(); c.restore();
}
function glow(c: Ctx, x: number, y: number, r: number, a = 0.5, rgb = '255,190,80') {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
}
function flame(c: Ctx, x: number, y: number, s: number) {
  disc(c, x, y, s, '#e2601c', 0); disc(c, x, y, s * 0.55, '#ffd25a', 0);
}
function candle(c: Ctx, x: number, y: number, s: number) {
  disc(c, x, y, s, '#efe6cc', 0.02); flame(c, x, y, s * 0.5);
}
function woodTop(c: Ctx, w: number, h: number, fill = WOOD, rad = 0.06) {
  shadowRect(c, w, h, rad);
  rrect(c, -w / 2, -h / 2, w, h, rad, fill, 0.05);
  if (w >= h) lines(c, -w / 2, -h / 2, w, h, 0.2); else lines(c, -w / 2, -h / 2, w, h, 0.2, true);
}
function chair(c: Ctx, x: number, y: number, rot: number, s = 0.55, col = '#7c5530') {
  c.save(); c.translate(x, y); c.rotate(rot);
  rrect(c, -s / 2, -s / 2 + s * 0.2, s, s * 0.8, 0.05, col, 0.035);
  rrect(c, -s / 2, -s / 2, s, s * 0.24, 0.04, shade(col, -0.25), 0.035);
  c.restore();
}
function mug(c: Ctx, x: number, y: number, s = 0.12) {
  rect(c, x + s * 0.7, y - s * 0.25, s * 0.55, s * 0.5, '#6a6a70', 0.015);
  disc(c, x, y, s, '#8a8a90', 0.02); disc(c, x, y, s * 0.72, '#f0e6c8', 0);
}
function goblet(c: Ctx, x: number, y: number, s = 0.1, wine = '#6a1a2a') {
  disc(c, x, y, s, BRASS, 0.02); disc(c, x, y, s * 0.7, wine, 0);
}
function plate(c: Ctx, x: number, y: number, s = 0.16, food?: string) {
  disc(c, x, y, s, '#e8e2d4', 0.02); ring(c, x, y, s * 0.68, 'rgba(0,0,0,0.15)', 0.015);
  if (food) disc(c, x - s * 0.1, y, s * 0.45, food, 0.01);
}
function bottleTop(c: Ctx, x: number, y: number, s: number, col: string) {
  disc(c, x, y, s, col, 0.02); disc(c, x - s * 0.25, y - s * 0.25, s * 0.25, 'rgba(255,255,255,0.35)', 0); disc(c, x, y, s * 0.3, '#3a2a1a', 0);
}
function bottleSide(c: Ctx, x: number, y: number, len: number, col: string, rot = 0) {
  c.save(); c.translate(x, y); c.rotate(rot);
  rrect(c, -len / 2, -len * 0.16, len * 0.68, len * 0.32, len * 0.12, col, 0.02);
  rect(c, len * 0.17, -len * 0.06, len * 0.3, len * 0.12, col, 0.015);
  rect(c, len * 0.42, -len * 0.065, len * 0.08, len * 0.13, '#a07a48', 0);
  seg(c, -len * 0.4, -len * 0.08, len * 0.05, -len * 0.08, 'rgba(255,255,255,0.35)', len * 0.05);
  c.restore();
}
function flask(c: Ctx, x: number, y: number, s: number, col: string) {
  disc(c, x, y, s, 'rgba(200,225,235,0.55)', 0.02); disc(c, x, y + s * 0.1, s * 0.72, col, 0);
  disc(c, x - s * 0.3, y - s * 0.3, s * 0.2, 'rgba(255,255,255,0.6)', 0); disc(c, x, y, s * 0.28, '#a07a48', 0);
}
function book(c: Ctx, x: number, y: number, w: number, h: number, col: string, rot = 0) {
  c.save(); c.translate(x, y); c.rotate(rot);
  rrect(c, -w / 2, -h / 2, w, h, 0.02, col, 0.02);
  rect(c, w / 2 - w * 0.12, -h / 2 + h * 0.08, w * 0.08, h * 0.84, CREAM, 0);
  seg(c, -w / 2 + w * 0.12, -h / 2 + 0.01, -w / 2 + w * 0.12, h / 2 - 0.01, 'rgba(0,0,0,0.3)', 0.015);
  c.restore();
}
function openBook(c: Ctx, x: number, y: number, w: number, h: number, cover = '#6b2a2a', rot = 0) {
  c.save(); c.translate(x, y); c.rotate(rot);
  rrect(c, -w / 2, -h / 2, w, h, 0.02, cover, 0.02);
  rect(c, -w / 2 + w * 0.05, -h / 2 + h * 0.08, w * 0.43, h * 0.84, '#f2ead6', 0);
  rect(c, w * 0.02, -h / 2 + h * 0.08, w * 0.43, h * 0.84, '#ece2ca', 0);
  c.strokeStyle = 'rgba(40,30,20,0.4)'; c.lineWidth = h * 0.03; c.beginPath();
  for (let i = 1; i < 6; i++) {
    const yy = -h / 2 + h * 0.08 + (h * 0.84 * i) / 6;
    c.moveTo(-w / 2 + w * 0.1, yy); c.lineTo(-w * 0.04, yy); c.moveTo(w * 0.07, yy); c.lineTo(w / 2 - w * 0.07, yy);
  }
  c.stroke(); seg(c, 0, -h / 2 + h * 0.05, 0, h / 2 - h * 0.05, 'rgba(0,0,0,0.35)', 0.015);
  c.restore();
}
function scroll(c: Ctx, x: number, y: number, len: number, rot = 0) {
  c.save(); c.translate(x, y); c.rotate(rot);
  rrect(c, -len / 2, -len * 0.12, len, len * 0.24, len * 0.1, '#e8dcb8', 0.02);
  disc(c, -len / 2, 0, len * 0.13, '#d8c8a0', 0.015); disc(c, len / 2, 0, len * 0.13, '#d8c8a0', 0.015);
  seg(c, -len * 0.1, -len * 0.12, -len * 0.1, len * 0.12, '#8b2c2c', len * 0.05);
  c.restore();
}
function coin(c: Ctx, x: number, y: number, s: number) { disc(c, x, y, s, '#e0b83a', 0.012); disc(c, x - s * 0.25, y - s * 0.25, s * 0.3, '#f6e08a', 0); }
function gem(c: Ctx, x: number, y: number, s: number, col: string) {
  poly(c, [x, y - s, x + s * 0.8, y, x, y + s, x - s * 0.8, y], col, 0.012); poly(c, [x, y - s, x + s * 0.3, y, x, y + s * 0.4, x - s * 0.3, y], 'rgba(255,255,255,0.35)', 0);
}

// Produce and goods for crates, baskets, stalls and piles.
type Kind = 'apple' | 'orange' | 'lemon' | 'pear' | 'tomato' | 'cabbage' | 'potato' | 'onion' | 'carrot' | 'grape' | 'fish' | 'bread'
  | 'egg' | 'melon' | 'pumpkin' | 'flower' | 'meat' | 'cheese' | 'coin' | 'gem' | 'potion' | 'pot' | 'grain' | 'mushroom' | 'herb' | 'cloth' | 'book' | 'scroll' | 'bottle' | 'ore' | 'coal' | 'arrow' | 'stone';
const KIND_R: Partial<Record<Kind, number>> = { melon: 0.2, pumpkin: 0.2, cabbage: 0.13, bread: 0.13, fish: 0.14, meat: 0.15, cheese: 0.14, pot: 0.13, cloth: 0.14, book: 0.12, scroll: 0.12, grape: 0.1, carrot: 0.1, egg: 0.06, coin: 0.05, gem: 0.06, grain: 0.05, coal: 0.07, arrow: 0.04 };
const KIND_COL: Partial<Record<Kind, string[]>> = {
  apple: ['#b8322a', '#c8402a', '#8a2a22', '#a8b83a'], orange: ['#e08a2a', '#e89a3a'], lemon: ['#e8d24a', '#f0dc5a'], pear: ['#b8c04a', '#a8b040'],
  tomato: ['#d03a2a', '#c02a22'], potato: ['#a8864a', '#9a7a42', '#b8945a'], onion: ['#c8a080', '#b88a6a', '#d8c0a0'],
  flower: ['#e05a7a', '#f0d040', '#e0e0f0', '#9a5ad0', '#e07a30'], potion: POTION, gem: ['#d03a5a', '#3a8ad0', '#3ab86a', '#b84ad0', '#e0c030'],
  cloth: CLOTH, book: BOOKS, ore: ['#7a6a5a', '#8a7060', '#6a5a50'], mushroom: ['#c9a35a', '#b8423a', '#d8c8a8'],
};
function item(c: Ctx, x: number, y: number, r: number, kind: Kind, s: number, i: number) {
  const cols = KIND_COL[kind];
  const col = cols ? cols[Math.floor(H(s, i, 3) * cols.length)] : '#888';
  const a = H(s, i, 5) * TAU;
  switch (kind) {
    case 'cabbage': disc(c, x, y, r, '#7aa84a', 0.02); disc(c, x, y, r * 0.6, '#9ac86a', 0); ring(c, x, y, r * 0.8, 'rgba(40,80,20,0.4)', 0.015); break;
    case 'carrot': c.save(); c.translate(x, y); c.rotate(a); poly(c, [-r, -r * 0.3, r, 0, -r, r * 0.3], '#e0782a', 0.012); seg(c, -r, 0, -r * 1.4, 0, '#4a8a3a', r * 0.35); c.restore(); break;
    case 'grape': for (let k = 0; k < 6; k++) disc(c, x + Math.cos(k * 1.1) * r * 0.5, y + Math.sin(k * 1.1) * r * 0.5, r * 0.35, k % 2 ? '#6a3a7a' : '#7a4a8a', 0.01); break;
    case 'fish': c.save(); c.translate(x, y); c.rotate(a); ell(c, 0, 0, r, r * 0.38, 0, '#9aa8b0', 0.015); poly(c, [r * 0.85, 0, r * 1.3, -r * 0.35, r * 1.3, r * 0.35], '#7a8890', 0.012); disc(c, -r * 0.6, -r * 0.08, r * 0.08, '#1a1a1a', 0); c.restore(); break;
    case 'bread': c.save(); c.translate(x, y); c.rotate(a); ell(c, 0, 0, r, r * 0.6, 0, '#c89a52', 0.015); for (let k = -1; k <= 1; k++) seg(c, k * r * 0.4 - r * 0.1, -r * 0.3, k * r * 0.4 + r * 0.1, r * 0.3, '#8a6030', 0.02); c.restore(); break;
    case 'egg': ell(c, x, y, r * 0.8, r, a, '#efe6d2', 0.01); break;
    case 'melon': disc(c, x, y, r, '#4a8a3a', 0.02); for (let k = 0; k < 4; k++) { c.beginPath(); c.ellipse(x, y, r * (0.25 + k * 0.2), r, 0, 0, TAU); stroke(c, 0.015, 'rgba(20,50,15,0.45)'); } break;
    case 'pumpkin': disc(c, x, y, r, '#d8782a', 0.02); for (let k = 1; k < 4; k++) { c.beginPath(); c.ellipse(x, y, r * k * 0.25, r * 0.95, a, 0, TAU); stroke(c, 0.015, 'rgba(120,50,10,0.45)'); } disc(c, x, y, r * 0.15, '#5a7a2a', 0.01); break;
    case 'flower': for (let k = 0; k < 5; k++) disc(c, x + Math.cos(a + k * 1.256) * r * 0.5, y + Math.sin(a + k * 1.256) * r * 0.5, r * 0.45, col, 0.008); disc(c, x, y, r * 0.3, '#f0c030', 0); break;
    case 'meat': c.save(); c.translate(x, y); c.rotate(a); ell(c, 0, 0, r, r * 0.65, 0, '#a8453a', 0.015); ell(c, 0, 0, r * 0.6, r * 0.35, 0, '#c86a5a', 0); seg(c, r * 0.7, 0, r * 1.25, 0, '#efe6d2', r * 0.25); c.restore(); break;
    case 'cheese': disc(c, x, y, r, '#e8c04a', 0.02); disc(c, x, y, r * 0.75, '#f0d060', 0); c.beginPath(); c.moveTo(x, y); c.arc(x, y, r, a, a + 0.8); c.closePath(); c.fillStyle = '#f8e080'; c.fill(); break;
    case 'coin': coin(c, x, y, r); break;
    case 'gem': gem(c, x, y, r, col); break;
    case 'potion': flask(c, x, y, r, col); break;
    case 'pot': disc(c, x, y, r, ['#b0643a', '#a05a34', '#8a7a6a'][Math.floor(H(s, i, 4) * 3)], 0.02); disc(c, x, y, r * 0.5, '#3a241a', 0); break;
    case 'grain': disc(c, x, y, r, '#d8c080', 0); break;
    case 'herb': for (let k = 0; k < 4; k++) ell(c, x + Math.cos(a + k * 1.6) * r * 0.4, y + Math.sin(a + k * 1.6) * r * 0.4, r * 0.55, r * 0.22, a + k * 1.6, k % 2 ? '#5a8a3a' : '#7aa04a', 0.008); break;
    case 'cloth': c.save(); c.translate(x, y); c.rotate(a * 0.1); rrect(c, -r, -r * 0.7, r * 2, r * 1.4, 0.03, col, 0.015); seg(c, -r, 0, r, 0, shade(col, -0.25), 0.02); c.restore(); break;
    case 'book': book(c, x, y, r * 1.6, r * 1.2, col, (H(s, i, 6) - 0.5) * 0.6); break;
    case 'scroll': scroll(c, x, y, r * 2, a); break;
    case 'bottle': bottleTop(c, x, y, r, GLASS[Math.floor(H(s, i, 4) * GLASS.length)]); break;
    case 'coal': poly(c, [x - r, y, x - r * 0.3, y - r, x + r, y - r * 0.3, x + r * 0.6, y + r, x - r * 0.5, y + r * 0.8], '#24211f', 0.01); break;
    case 'arrow': disc(c, x, y, r, '#d8d0c0', 0.008); disc(c, x, y, r * 0.4, '#6a4a2a', 0); break;
    case 'mushroom': disc(c, x, y, r, col, 0.015); disc(c, x - r * 0.3, y - r * 0.3, r * 0.25, '#f3e7cf', 0); break;
    case 'potato': ell(c, x, y, r, r * 0.75, a, col, 0.012); break;
    case 'stone': poly(c, [x - r, y, x - r * 0.4, y - r, x + r, y - r * 0.4, x + r * 0.7, y + r, x - r * 0.6, y + r * 0.8], shade('#8d877d', (H(s, i, 7) - 0.5) * 0.3), 0.015); disc(c, x - r * 0.2, y - r * 0.3, r * 0.3, 'rgba(255,255,255,0.18)', 0); break;
    case 'ore': poly(c, [x - r, y, x - r * 0.4, y - r, x + r, y - r * 0.4, x + r * 0.7, y + r, x - r * 0.6, y + r * 0.8], col, 0.012); disc(c, x + r * 0.2, y - r * 0.1, r * 0.2, '#d8b84a', 0); break;
    default: disc(c, x, y, r, col, 0.015); disc(c, x - r * 0.3, y - r * 0.3, r * 0.28, 'rgba(255,255,255,0.35)', 0);
  }
}
/** Fill a rect with a jittered pile of goods. */
function pile(c: Ctx, x: number, y: number, w: number, h: number, kind: Kind, s: number, salt = 0) {
  const r = KIND_R[kind] ?? 0.09;
  const cols = Math.max(1, Math.round(w / (r * 1.9))), rows = Math.max(1, Math.round(h / (r * 1.75)));
  const cw = w / cols, chh = h / rows;
  let i = salt * 97;
  for (let ry = 0; ry < rows; ry++)
    for (let cx = 0; cx < cols; cx++, i++) {
      const jx = (H(s, i, 1) - 0.5) * cw * 0.3, jy = (H(s, i, 2) - 0.5) * chh * 0.3;
      item(c, x + (cx + 0.5 + (ry % 2 ? 0.25 : -0.1)) * cw + jx, y + (ry + 0.5) * chh + jy, r, kind, s, i);
    }
}
function crateOf(c: Ctx, x: number, y: number, w: number, h: number, kind: Kind, s: number, salt = 0) {
  c.fillStyle = SH; c.fillRect(x + 0.05, y + 0.06, w, h);
  rect(c, x, y, w, h, '#a07a48', 0.035);
  rect(c, x + 0.06, y + 0.06, w - 0.12, h - 0.12, '#5a3e22', 0);
  c.save(); c.beginPath(); c.rect(x + 0.06, y + 0.06, w - 0.12, h - 0.12); c.clip();
  pile(c, x + 0.06, y + 0.06, w - 0.12, h - 0.12, kind, s, salt);
  c.restore();
}
function basketOf(c: Ctx, x: number, y: number, r: number, kind: Kind | null, s: number, salt = 0) {
  shadowEll(c, x, y, r, r, 0.05);
  disc(c, x, y, r, WICKER, 0.03);
  ring(c, x, y, r * 0.85, 'rgba(90,60,20,0.5)', 0.02);
  disc(c, x, y, r * 0.75, '#8a6438', 0);
  if (kind) {
    c.save(); c.beginPath(); c.arc(x, y, r * 0.75, 0, TAU); c.clip();
    pile(c, x - r * 0.75, y - r * 0.75, r * 1.5, r * 1.5, kind, s, salt);
    c.restore();
  } else {
    c.strokeStyle = 'rgba(60,40,15,0.4)'; c.lineWidth = 0.015; c.beginPath();
    for (let k = -2; k <= 2; k++) { c.moveTo(x + k * r * 0.25, y - r * 0.7); c.lineTo(x + k * r * 0.25, y + r * 0.7); }
    c.stroke();
  }
}
function barrelTop(c: Ctx, r: number, inner: string | null) {
  disc(c, 0.06, 0.08, r, SH, 0);
  disc(c, 0, 0, r, '#8a5a32', 0.04);
  ring(c, 0, 0, r * 0.88, '#3a3a3a', 0.04);
  if (inner) disc(c, 0, 0, r * 0.78, inner, 0.02);
}
/** Shelf or cabinet against the top wall; fill draws into the inner rect. */
function shelf(c: Ctx, w: number, h: number, fill: (x: number, y: number, iw: number, ih: number) => void, frame = XWOOD) {
  shadowRect(c, w, h, 0, 0.07);
  rect(c, -w / 2, -h / 2, w, h, frame, 0.05);
  const ix = -w / 2 + 0.06, iy = -h / 2 + 0.06, iw = w - 0.12, ih = h - 0.12;
  rect(c, ix, iy, iw, ih, shade(frame, -0.2), 0);
  c.save(); c.beginPath(); c.rect(ix, iy, iw, ih); c.clip(); fill(ix, iy, iw, ih); c.restore();
}
function drawers(c: Ctx, w: number, h: number, cols: number, rows: number, body: string, knob = BRASS) {
  shadowRect(c, w, h);
  rect(c, -w / 2, -h / 2, w, h, body, 0.05);
  const cw = w / cols, ch = h / rows;
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      const x = -w / 2 + i * cw, y = -h / 2 + j * ch;
      rect(c, x + 0.03, y + 0.03, cw - 0.06, ch - 0.06, shade(body, 0.08), 0.015);
      disc(c, x + cw / 2, y + ch / 2, Math.min(cw, ch) * 0.1, knob, 0);
    }
}
function bedFrame(c: Ctx, x: number, y: number, w: number, h: number, col: string, pillows: number, frame = DWOOD) {
  rect(c, x, y, w, h, frame, 0.05);
  rect(c, x + 0.06, y + 0.06, w - 0.12, h - 0.12, '#f4eee2', 0);
  const pw = (w - 0.2) / pillows;
  for (let i = 0; i < pillows; i++) rrect(c, x + 0.1 + i * pw + 0.03, y + 0.12, pw - 0.06, Math.min(0.35, h * 0.18), 0.08, '#fbf8f0', 0.02);
  const top = y + Math.min(0.55, h * 0.3);
  rect(c, x + 0.06, top, w - 0.12, y + h - 0.06 - top, col, 0);
  rect(c, x + 0.06, top, w - 0.12, 0.14, shade(col, 0.3), 0);
  lines(c, x + 0.06, top + 0.14, w - 0.12, y + h - 0.2 - top, 0.25, false, 0.12);
}
function beast(c: Ctx, w: number, h: number, body: string, opts: { head?: string; spots?: string; wool?: boolean; tail?: string; ears?: boolean; horns?: string; mane?: string; snout?: string } = {}) {
  const bw = w * 0.42, bh = h * 0.32, hy = -h * 0.34;
  shadowEll(c, 0, h * 0.05, bw, bh, 0.08);
  if (opts.tail) seg(c, 0, h * 0.3, (0.03) * w, h * 0.48, opts.tail, Math.max(0.03, w * 0.08));
  if (opts.wool) {
    for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU; disc(c, Math.cos(a) * bw * 0.8, h * 0.05 + Math.sin(a) * bh * 0.8, bw * 0.38, body, 0.015); }
  }
  ell(c, 0, h * 0.05, bw, bh, 0, body, 0.035);
  if (opts.spots) for (let k = 0; k < 4; k++) ell(c, (H(k, 1) - 0.5) * bw * 1.2, h * 0.05 + (H(k, 2) - 0.5) * bh * 1.3, bw * 0.3, bh * 0.22, k, opts.spots, 0);
  if (opts.mane) seg(c, 0, hy + h * 0.1, 0, h * 0.0, opts.mane, w * 0.12);
  const head = opts.head ?? shade(body, -0.08);
  if (opts.ears) { ell(c, -w * 0.16, hy - h * 0.02, w * 0.08, h * 0.05, -0.5, head, 0.02); ell(c, w * 0.16, hy - h * 0.02, w * 0.08, h * 0.05, 0.5, head, 0.02); }
  if (opts.horns) { seg(c, -w * 0.08, hy - h * 0.04, -w * 0.2, hy - h * 0.12, opts.horns, w * 0.06); seg(c, w * 0.08, hy - h * 0.04, w * 0.2, hy - h * 0.12, opts.horns, w * 0.06); }
  ell(c, 0, hy, w * 0.2, h * 0.13, 0, head, 0.03);
  if (opts.snout) ell(c, 0, hy - h * 0.1, w * 0.11, h * 0.05, 0, opts.snout, 0.02);
}
function stallTable(c: Ctx, w: number, h: number, top = '#8c6239') {
  shadowRect(c, w, h, 0.04);
  rrect(c, -w / 2, -h / 2, w, h, 0.04, top, 0.05);
  lines(c, -w / 2, -h / 2, w, h, 0.25, true, 0.18);
}
function produceStand(kinds: Kind[], cloth?: string): Draw {
  return (c, o, w, h, s) => {
    stallTable(c, w, h);
    if (cloth) { rect(c, -w / 2 + 0.05, -h / 2 + 0.05, w - 0.1, h - 0.1, o.color ?? cloth, 0); }
    const n = kinds.length, cw = (w - 0.2) / n;
    for (let i = 0; i < n; i++) crateOf(c, -w / 2 + 0.1 + i * cw + 0.03, -h / 2 + 0.1, cw - 0.06, h * 0.55, kinds[i], s, i);
    // Front row: a basket or two.
    basketOf(c, -w * 0.25, h * 0.28, Math.min(0.2, h * 0.18), kinds[0], s, 7);
    basketOf(c, w * 0.25, h * 0.28, Math.min(0.2, h * 0.18), kinds[n - 1], s, 8);
  };
}
function hipRoof(c: Ctx, w: number, h: number, col: string) {
  let L = w, S = h;
  c.save();
  if (h > w) { L = h; S = w; c.rotate(Math.PI / 2); }
  const hl = L / 2, hs = S / 2, ridge = Math.max(0, hl - hs);
  c.fillStyle = SH; c.fillRect(-hl + 0.25, -hs + 0.3, L, S);
  poly(c, [-hl, -hs, hl, -hs, ridge, 0, -ridge, 0], shade(col, 0.18), 0);
  poly(c, [-hl, hs, hl, hs, ridge, 0, -ridge, 0], shade(col, -0.22), 0);
  poly(c, [-hl, -hs, -ridge, 0, -hl, hs], col, 0);
  poly(c, [hl, -hs, ridge, 0, hl, hs], shade(col, -0.08), 0);
  c.beginPath(); c.moveTo(-hl, -hs); c.lineTo(-ridge, 0); c.lineTo(-hl, hs); c.moveTo(hl, -hs); c.lineTo(ridge, 0); c.lineTo(hl, hs); c.moveTo(-ridge, 0); c.lineTo(ridge, 0);
  stroke(c, 0.05, 'rgba(30,20,15,0.8)');
  c.beginPath(); c.rect(-hl, -hs, L, S); stroke(c, 0.07);
  c.restore();
}
function awning(c: Ctx, w: number, h: number, col: string, stripes = 6) {
  c.fillStyle = SH; c.fillRect(-w / 2 + 0.12, -h / 2 + 0.16, w, h);
  for (let i = 0; i < stripes; i++) rect(c, -w / 2 + (i * w) / stripes, -h / 2, w / stripes, h, i % 2 ? '#efe8da' : col, 0);
  rect(c, -w / 2, -h / 2, w, h * 0.5, 'rgba(255,255,255,0.08)', 0);
  // Scalloped front edge.
  const n = stripes * 2;
  for (let i = 0; i < n; i++) {
    c.beginPath(); c.arc(-w / 2 + (i + 0.5) * (w / n), h / 2, w / n / 2, 0, Math.PI);
    c.fillStyle = Math.floor(i / 2) % 2 ? '#efe8da' : col; c.fill(); stroke(c, 0.02);
  }
  c.beginPath(); c.rect(-w / 2, -h / 2, w, h); stroke(c, 0.05);
}

// =====================================================================
// Tavern
// =====================================================================
add('Tavern', 'bar_counter', 'Bar counter', 3, 0.9, { snap: true }, (c, o, w, h, s) => {
  shadowRect(c, w, h, 0.05);
  rrect(c, -w / 2, -h / 2, w, h, 0.05, '#7a4e2a', 0.05);
  lines(c, -w / 2, -h / 2, w, h * 0.78, 0.17, false, 0.2);
  rect(c, -w / 2, h / 2 - h * 0.2, w, h * 0.2, '#5a3820', 0.03);
  seg(c, -w / 2 + 0.06, h / 2 - h * 0.1, w / 2 - 0.06, h / 2 - h * 0.1, BRASS, 0.035);
  for (let i = 0; i < Math.floor(w * 1.5); i++) {
    const x = -w / 2 + 0.25 + H(s, i) * (w - 0.5), y = -h * 0.15 + (H(s, i, 1) - 0.5) * h * 0.3;
    if (H(s, i, 2) > 0.45) mug(c, x, y, 0.1); else ring(c, x, y, 0.08, 'rgba(0,0,0,0.25)', 0.015);
  }
});
add('Tavern', 'bar_corner', 'Bar counter (corner)', 2, 2, { snap: true }, (c, o, w, h) => {
  const d = Math.min(w, h) * 0.45;
  c.fillStyle = SH; c.beginPath(); c.rect(-w / 2 + 0.08, -h / 2 + 0.1, d, h); c.rect(-w / 2 + 0.08, h / 2 - d + 0.1, w, d); c.fill();
  poly(c, [-w / 2, -h / 2, -w / 2 + d, -h / 2, -w / 2 + d, h / 2 - d, w / 2, h / 2 - d, w / 2, h / 2, -w / 2, h / 2], '#7a4e2a', 0.05);
  lines(c, -w / 2, -h / 2, d, h, 0.17, true, 0.2);
  seg(c, -w / 2 + d - 0.1, -h / 2 + 0.06, -w / 2 + d - 0.1, h / 2 - d - 0.1, BRASS, 0.035);
  seg(c, -w / 2 + d - 0.1, h / 2 - d - 0.1, w / 2 - 0.06, h / 2 - d - 0.1, BRASS, 0.035);
  mug(c, -w / 2 + d * 0.45, -h * 0.1, 0.1); mug(c, w * 0.2, h / 2 - d * 0.5, 0.1);
});
add('Tavern', 'beer_taps', 'Beer taps', 1.2, 0.5, {}, (c, o, w, h) => {
  shadowRect(c, w, h, 0.04);
  rrect(c, -w / 2, -h / 2, w, h, 0.04, '#5a3820', 0.04);
  rect(c, -w / 2 + 0.05, -h * 0.1, w - 0.1, h * 0.2, BRASS, 0.02);
  for (let i = 0; i < 3; i++) { const x = -w / 3 + (i * w) / 3; disc(c, x, 0, 0.08, '#e0c060', 0.02); rrect(c, x - 0.04, -h / 2 + 0.02, 0.08, h * 0.35, 0.03, ['#2a2a2a', '#8b2c2c', '#2f4f7a'][i], 0.015); }
  rect(c, -w / 2 + 0.08, h * 0.2, w - 0.16, h * 0.18, '#3a3a3e', 0.015);
});
add('Tavern', 'keg', 'Keg (on its side)', 1.2, 0.8, {}, (c, o, w, h) => {
  shadowRect(c, w, h, h * 0.4);
  c.beginPath(); c.ellipse(0, 0, w / 2, h / 2, 0, 0, TAU); c.fillStyle = '#8a5a32'; c.fill(); stroke(c, 0.04);
  c.save(); c.beginPath(); c.ellipse(0, 0, w / 2, h / 2, 0, 0, TAU); c.clip();
  lines(c, -w / 2, -h / 2, w, h, h / 6, false, 0.2);
  for (const f of [-0.32, 0.32]) rect(c, f * w - 0.04, -h / 2, 0.08, h, '#3a3a3a', 0);
  c.restore();
  disc(c, w / 2 - 0.02, 0, 0.06, BRASS, 0.02); rect(c, w / 2 - 0.02, -0.03, 0.14, 0.06, BRASS, 0.015);
});
add('Tavern', 'keg_rack', 'Keg rack', 2.4, 1, { snap: true }, (c, o, w, h) => {
  shadowRect(c, w, h);
  rect(c, -w / 2, -h / 2, w, h, XWOOD, 0.05);
  const n = Math.max(1, Math.round(w / 0.8)), kw = w / n;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + kw * (i + 0.5);
    c.beginPath(); c.ellipse(x, 0, kw * 0.44, h * 0.46, 0, 0, TAU); c.fillStyle = '#8a5a32'; c.fill(); stroke(c, 0.035);
    c.save(); c.clip(); for (const f of [-0.3, 0.3]) rect(c, x - kw * 0.5, f * h - 0.035, kw, 0.07, '#3a3a3a', 0); c.restore();
    disc(c, x, h / 2 - 0.04, 0.05, BRASS, 0.015);
  }
});
add('Tavern', 'wine_rack', 'Wine rack', 2, 0.5, {}, (c, o, w, h, s) => {
  shelf(c, w, h, (x, y, iw, ih) => {
    const n = Math.floor(iw / 0.16), m = Math.max(1, Math.floor(ih / 0.16));
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const bx = x + (i + 0.5) * (iw / n), by = y + (j + 0.5) * (ih / m);
      if (H(s, i * 7 + j) > 0.15) bottleTop(c, bx, by, 0.06, GLASS[Math.floor(H(s, i, j) * 3)]); else disc(c, bx, by, 0.06, '#2a1a10', 0);
    }
  });
});
add('Tavern', 'bottle_shelf', 'Bottle shelf', 2, 0.5, {}, (c, o, w, h, s) => {
  shelf(c, w, h, (x, y, iw, ih) => pile(c, x, y, iw, ih, 'bottle', s), DWOOD);
});
add('Tavern', 'mug_rack', 'Mug rack', 1.5, 0.4, {}, (c, o, w, h) => {
  shadowRect(c, w, h); rect(c, -w / 2, -h / 2, w, h * 0.35, XWOOD, 0.04);
  for (let x = -w / 2 + 0.18; x < w / 2 - 0.05; x += 0.28) mug(c, x, h * 0.12, 0.1);
});
add('Tavern', 'round_table', 'Round table', 1.5, 1.5, {}, (c, o, w, h, s) => {
  const r = Math.min(w, h) / 2;
  disc(c, 0.08, 0.1, r, SH, 0); disc(c, 0, 0, r, WOOD, 0.05);
  c.save(); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.clip(); lines(c, -r, -r, 2 * r, 2 * r, 0.2); c.restore();
  ring(c, 0, 0, r * 0.92, 'rgba(0,0,0,0.25)', 0.02);
  if (H(s, 1) > 0.4) mug(c, r * 0.3, -r * 0.2, 0.1);
  if (H(s, 2) > 0.5) candle(c, -r * 0.15, r * 0.1, 0.06);
});
add('Tavern', 'round_table_set', 'Round table and chairs', 2.6, 2.6, { snap: true }, (c, o, w, h, s) => {
  const r = Math.min(w, h) * 0.28;
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + Math.PI / 4; chair(c, Math.cos(a) * r * 1.55, Math.sin(a) * r * 1.55, a + Math.PI / 2, 0.55); }
  disc(c, 0.08, 0.1, r, SH, 0); disc(c, 0, 0, r, WOOD, 0.05); ring(c, 0, 0, r * 0.9, 'rgba(0,0,0,0.25)', 0.02);
  mug(c, r * 0.35, -r * 0.3, 0.1); mug(c, -r * 0.4, r * 0.2, 0.1); plate(c, 0.05, 0.1, 0.16, '#a8453a');
  if (H(s, 3) > 0.5) candle(c, -r * 0.1, -r * 0.4, 0.06);
});
add('Tavern', 'table_set', 'Long table and benches', 3, 2, { snap: true }, (c, o, w, h) => {
  const th = h * 0.45, bh = h * 0.2;
  for (const y of [-h / 2 + bh / 2, h / 2 - bh / 2]) { c.fillStyle = SH; c.fillRect(-w / 2 + 0.06, y - bh / 2 + 0.08, w, bh); rrect(c, -w / 2, y - bh / 2, w, bh, 0.04, '#7c5530', 0.04); lines(c, -w / 2, y - bh / 2, w, bh, 0.12); }
  c.fillStyle = SH; c.fillRect(-w / 2 + 0.12, -th / 2 + 0.12, w - 0.1, th);
  rrect(c, -w / 2 + 0.05, -th / 2, w - 0.1, th, 0.06, WOOD, 0.05); lines(c, -w / 2 + 0.05, -th / 2, w - 0.1, th, 0.18);
  for (let x = -w / 2 + 0.45; x < w / 2 - 0.2; x += 0.7) { plate(c, x, -th * 0.22, 0.13, '#c89a52'); mug(c, x + 0.2, th * 0.22, 0.09); }
});
add('Tavern', 'booth', 'Booth', 2, 2.2, { snap: true, colors: FABRIC }, (c, o, w, h) => {
  const col = o.color ?? FABRIC[0];
  const sh = h * 0.28;
  shadowRect(c, w, h, 0.05);
  for (const [y, back] of [[-h / 2, -h / 2], [h / 2 - sh, h / 2 - 0.12]] as const) {
    rect(c, -w / 2, y, w, sh, XWOOD, 0.04);
    rrect(c, -w / 2 + 0.06, y + (back === -h / 2 ? 0.14 : 0.03), w - 0.12, sh - 0.17, 0.05, col, 0.025);
  }
  rrect(c, -w / 2 + 0.15, -h / 2 + sh + 0.05, w - 0.3, h - 2 * sh - 0.1, 0.05, WOOD, 0.04);
  mug(c, -w * 0.15, -0.05, 0.09); mug(c, w * 0.2, 0.1, 0.09); candle(c, 0, 0, 0.05);
});
add('Tavern', 'card_table', 'Card table', 1.3, 1.3, {}, (c, o, w, h, s) => {
  const r = Math.min(w, h) / 2;
  disc(c, 0.08, 0.1, r, SH, 0); disc(c, 0, 0, r, DWOOD, 0.05); disc(c, 0, 0, r * 0.85, '#2a6a3a', 0.02);
  for (let i = 0; i < 7; i++) {
    const a = H(s, i) * TAU, d = r * 0.5 * H(s, i, 1);
    c.save(); c.translate(Math.cos(a) * d, Math.sin(a) * d); c.rotate(H(s, i, 2) * TAU);
    rrect(c, -0.07, -0.1, 0.14, 0.2, 0.02, i % 3 ? CREAM : '#c84a3a', 0.012); c.restore();
  }
  for (let i = 0; i < 4; i++) coin(c, -r * 0.5 + i * 0.05, r * 0.45, 0.04);
});
add('Tavern', 'dice_table', 'Dice table', 1.3, 1, {}, (c, o, w, h, s) => {
  woodTop(c, w, h, DWOOD);
  rrect(c, -w / 2 + 0.1, -h / 2 + 0.1, w - 0.2, h - 0.2, 0.04, '#6a2a2a', 0.02);
  for (let i = 0; i < 3; i++) { const x = (H(s, i) - 0.5) * w * 0.4, y = (H(s, i, 1) - 0.5) * h * 0.4; c.save(); c.translate(x, y); c.rotate(H(s, i, 2)); rrect(c, -0.06, -0.06, 0.12, 0.12, 0.02, CREAM, 0.012); disc(c, 0, 0, 0.015, INK, 0); c.restore(); }
  for (let i = 0; i < 6; i++) coin(c, w * 0.3 + (H(s, i, 4) - 0.5) * 0.1, -h * 0.25 + i * 0.03, 0.045);
});
add('Tavern', 'dartboard', 'Dartboard', 0.6, 0.6, {}, (c, o, w, h) => {
  const r = Math.min(w, h) / 2;
  disc(c, 0, 0, r, '#2a2a2a', 0.03);
  for (let i = 0; i < 20; i++) { c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, r * 0.85, (i / 20) * TAU, ((i + 1) / 20) * TAU); c.closePath(); c.fillStyle = i % 2 ? '#e8dcc0' : '#1a1a1a'; c.fill(); }
  ring(c, 0, 0, r * 0.8, '#b83a3a', r * 0.08); ring(c, 0, 0, r * 0.5, '#3a8a4a', r * 0.07);
  disc(c, 0, 0, r * 0.12, '#3a8a4a', 0); disc(c, 0, 0, r * 0.06, '#b83a3a', 0);
});
add('Tavern', 'stage', 'Stage', 4, 2.5, { snap: true, layer: 0 }, (c, o, w, h, s) => {
  c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(-w / 2 + 0.1, -h / 2 + 0.15, w, h);
  rect(c, -w / 2, -h / 2, w, h, '#9c7448', 0.06);
  const n = Math.round(w / 0.3);
  for (let i = 0; i < n; i++) rect(c, -w / 2 + (i * w) / n, -h / 2, w / n - 0.02, h - 0.15, shade('#9c7448', (H(s, i) - 0.5) * 0.18), 0);
  rect(c, -w / 2, h / 2 - 0.15, w, 0.15, '#5a3a20', 0.03);
  rect(c, -w / 2, -h / 2, w, 0.22, '#7a1a2a', 0.03);
  for (let x = -w / 2 + 0.2; x < w / 2; x += 0.4) seg(c, x, -h / 2 + 0.02, x, -h / 2 + 0.2, 'rgba(0,0,0,0.3)', 0.03);
});
add('Tavern', 'harpsichord', 'Harpsichord', 1.2, 2, {}, (c, o, w, h) => {
  shadowRect(c, w, h, 0.1);
  poly(c, [-w / 2, -h / 2, w / 2, -h / 2, w / 2, -h * 0.1, w * 0.1, h / 2, -w / 2, h / 2], '#3a2418', 0.05);
  poly(c, [-w / 2 + 0.08, -h / 2 + 0.3, w / 2 - 0.08, -h / 2 + 0.3, w / 2 - 0.08, -h * 0.12, w * 0.06, h / 2 - 0.08, -w / 2 + 0.08, h / 2 - 0.08], '#c8a060', 0.02);
  c.strokeStyle = 'rgba(60,40,20,0.5)'; c.lineWidth = 0.012; c.beginPath();
  for (let x = -w / 2 + 0.15; x < w / 2 - 0.1; x += 0.08) { c.moveTo(x, -h / 2 + 0.32); c.lineTo(x, h / 2 - 0.1 - Math.max(0, x - w * 0.06) * 1.4); }
  c.stroke();
  rect(c, -w / 2 + 0.04, -h / 2 + 0.04, w - 0.08, 0.22, CREAM, 0.02);
  for (let x = -w / 2 + 0.1; x < w / 2 - 0.08; x += 0.09) rect(c, x, -h / 2 + 0.04, 0.04, 0.13, '#1a1a1a', 0);
});
add('Tavern', 'lute', 'Lute', 0.45, 0.9, {}, (c, o, w, h) => {
  shadowEll(c, 0, h * 0.12, w * 0.48, h * 0.3, 0.05);
  rect(c, -w * 0.09, -h / 2 + 0.05, w * 0.18, h * 0.45, XWOOD, 0.02);
  rect(c, -w * 0.12, -h / 2, w * 0.24, h * 0.1, '#3a2418', 0.02);
  ell(c, 0, h * 0.15, w * 0.48, h * 0.33, 0, '#c8904a', 0.03);
  disc(c, 0, h * 0.07, w * 0.12, '#3a2418', 0.015);
  c.strokeStyle = 'rgba(230,220,200,0.8)'; c.lineWidth = 0.008; c.beginPath();
  for (let k = -2; k <= 2; k++) { c.moveTo(k * w * 0.03, -h / 2 + 0.06); c.lineTo(k * w * 0.03, h * 0.3); } c.stroke();
});
add('Tavern', 'drum', 'Drum', 0.7, 0.7, {}, (c, o, w, h) => {
  const r = Math.min(w, h) / 2;
  disc(c, 0.05, 0.07, r, SH, 0); disc(c, 0, 0, r, '#8b2c2c', 0.04); disc(c, 0, 0, r * 0.82, '#e8dcc0', 0.02);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; disc(c, Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92, 0.025, BRASS, 0); }
  seg(c, -r * 0.3, -r * 0.6, r * 0.4, -r * 0.1, XWOOD, 0.04);
});
add('Tavern', 'central_hearth', 'Central hearth', 2, 2, { snap: true, layer: 3 }, (c, o, w, h, s) => {
  const r = Math.min(w, h) / 2;
  glow(c, 0, 0, r * 2.2, 0.4);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; disc(c, Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8, r * 0.2, shade(STONE, (H(s, i) - 0.5) * 0.3), 0.03); }
  disc(c, 0, 0, r * 0.62, '#2e2420', 0.02);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI + 0.3; seg(c, Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, -Math.cos(a) * r * 0.5, -Math.sin(a) * r * 0.5, '#3a2a1e', 0.12); }
  disc(c, 0, 0, r * 0.4, '#e0601c', 0); disc(c, 0, 0, r * 0.22, '#ffd04a', 0);
});
add('Tavern', 'chandelier', 'Chandelier', 1.4, 1.4, { layer: 3 }, (c, o, w, h) => {
  const r = Math.min(w, h) / 2;
  glow(c, 0, 0, r * 2.6, 0.35);
  ring(c, 0, 0, r * 0.75, '#2a2420', 0.07); ring(c, 0, 0, r * 0.75, BRASS, 0.025);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; seg(c, 0, 0, Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.75, '#2a2420', 0.04); }
  disc(c, 0, 0, 0.08, BRASS, 0.02);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; candle(c, Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.75, 0.065); }
});
add('Tavern', 'tavern_sign', 'Hanging sign', 1, 0.5, { layer: 3, colors: ['#2f4f7a', '#8b2c2c', '#2f6a4a', '#5a3a20'] }, (c, o, w, h) => {
  seg(c, -w / 2, -h * 0.35, w / 2, -h * 0.35, '#2a2420', 0.05);
  shadowRect(c, w * 0.8, h * 0.6, 0.04, 0.1);
  rrect(c, -w * 0.4, -h * 0.25, w * 0.8, h * 0.62, 0.04, o.color ?? '#2f4f7a', 0.04);
  ring(c, 0, h * 0.06, Math.min(w, h) * 0.18, GOLD, 0.03);
  mug(c, 0, h * 0.06, Math.min(w, h) * 0.14);
});
add('Tavern', 'notice_board', 'Notice board', 1.5, 0.3, {}, (c, o, w, h, s) => {
  shadowRect(c, w, h); rect(c, -w / 2, -h / 2, w, h, '#a87a48', 0.04);
  for (let i = 0; i < 5; i++) {
    const x = -w / 2 + 0.12 + (i * (w - 0.24)) / 5 + H(s, i) * 0.05;
    c.save(); c.translate(x + 0.1, 0); c.rotate((H(s, i, 1) - 0.5) * 0.4);
    rect(c, -0.1, -h * 0.4, 0.2, h * 0.8, i % 2 ? '#efe6cc' : '#e0d4b0', 0.012); disc(c, 0, -h * 0.3, 0.02, '#b83a3a', 0); c.restore();
  }
});
add('Tavern', 'coat_rack', 'Coat rack', 0.6, 0.6, {}, (c, o, w, h, s) => {
  const r = Math.min(w, h) / 2;
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.4; seg(c, 0, 0, Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8, XWOOD, 0.05); }
  for (let i = 0; i < 2; i++) { const a = H(s, i) * TAU; ell(c, Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.45, r * 0.3, a, CLOTH[Math.floor(H(s, i, 1) * 5)], 0.02); }
  disc(c, 0, 0, 0.07, DWOOD, 0.02);
});
add('Tavern', 'spittoon', 'Spittoon', 0.35, 0.35, {}, (c, o, w, h) => {
  const r = Math.min(w, h) / 2; disc(c, 0.03, 0.04, r, SH, 0); disc(c, 0, 0, r, BRASS, 0.025); disc(c, 0, 0, r * 0.5, '#3a2a12', 0);
});
add('Tavern', 'tankard', 'Tankard', 0.3, 0.3, { layer: 2 }, (c, o, w, h) => { mug(c, -0.03, 0, Math.min(w, h) * 0.38); });
add('Tavern', 'mug_tray', 'Tray of mugs', 0.7, 0.5, { layer: 2 }, (c, o, w, h) => {
  rrect(c, -w / 2, -h / 2, w, h, 0.05, '#7a5230', 0.025);
  mug(c, -w * 0.22, -h * 0.18, 0.1); mug(c, w * 0.12, -h * 0.18, 0.1); mug(c, -w * 0.05, h * 0.2, 0.1);
});
add('Tavern', 'bottle', 'Bottle', 0.6, 0.2, { layer: 2 }, (c, o, w, h, s) => { bottleSide(c, 0, 0, w, GLASS[Math.floor(H(s, 1) * GLASS.length)]); });
add('Tavern', 'goblets', 'Goblets and wine', 0.6, 0.5, { layer: 2 }, (c, o, w, h) => {
  bottleSide(c, -w * 0.05, h * 0.22, w * 0.7, '#5a1a2a', -0.2); goblet(c, -w * 0.25, -h * 0.2, 0.09); goblet(c, w * 0.22, -h * 0.15, 0.09);
});
add('Tavern', 'roast_platter', 'Roast platter', 0.9, 0.6, { layer: 2 }, (c, o, w, h) => {
  ell(c, 0, 0, w / 2, h / 2, 0, '#d8d0c0', 0.025); ell(c, 0, 0, w * 0.42, h * 0.4, 0, '#c8c0b0', 0);
  ell(c, 0, 0, w * 0.3, h * 0.28, 0, '#a8642a', 0.025); ell(c, -w * 0.05, -h * 0.05, w * 0.18, h * 0.15, 0, '#c87a3a', 0);
  seg(c, w * 0.25, -h * 0.12, w * 0.38, -h * 0.25, '#efe6d2', 0.05); seg(c, w * 0.25, h * 0.12, w * 0.38, h * 0.25, '#efe6d2', 0.05);
  for (const [x, y] of [[-0.32, -0.3], [-0.35, 0.25], [0.05, 0.33]]) disc(c, x * w, y * h, 0.05, '#4a8a3a', 0.01);
});
add('Tavern', 'bread_basket', 'Bread basket', 0.6, 0.6, { layer: 2 }, (c, o, w, h, s) => { basketOf(c, 0, 0, Math.min(w, h) / 2, 'bread', s); });
add('Tavern', 'cheese_board', 'Cheese board', 0.7, 0.5, { layer: 2 }, (c, o, w, h) => {
  rrect(c, -w / 2, -h / 2, w, h, 0.06, LWOOD, 0.025);
  item(c, -w * 0.15, 0, Math.min(w, h) * 0.3, 'cheese', 1, 1);
  for (let i = 0; i < 4; i++) disc(c, w * 0.22, -h * 0.25 + i * h * 0.16, 0.04, '#6a3a7a', 0.01);
  rect(c, w * 0.05, h * 0.25, w * 0.25, 0.04, STEEL, 0.01);
});
add('Tavern', 'stew_bowls', 'Bowls of stew', 0.6, 0.4, { layer: 2 }, (c, o, w, h) => {
  for (const x of [-0.25, 0.25]) { disc(c, x * w, 0, Math.min(w * 0.22, h * 0.45), '#8a6a44', 0.02); disc(c, x * w, 0, Math.min(w * 0.22, h * 0.45) * 0.75, '#9a5a2a', 0); disc(c, x * w + 0.03, -0.02, 0.03, '#e08a2a', 0); }
});
add('Tavern', 'candle', 'Candle', 0.3, 0.3, { layer: 3 }, (c, o, w, h) => { glow(c, 0, 0, 1.2, 0.4); candle(c, 0, 0, Math.min(w, h) * 0.3); });
add('Tavern', 'candelabra', 'Candelabra', 0.6, 0.6, { layer: 3 }, (c, o, w, h) => {
  const r = Math.min(w, h) / 2; glow(c, 0, 0, 1.8, 0.4);
  disc(c, 0, 0, r * 0.3, BRASS, 0.02);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU - Math.PI / 2; seg(c, 0, 0, Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.75, BRASS, 0.04); candle(c, Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.75, r * 0.22); }
});
add('Tavern', 'brewing_vat', 'Brewing vat', 2, 2, { snap: true }, (c, o, w, h, s) => {
  const r = Math.min(w, h) / 2;
  disc(c, 0.1, 0.12, r, SH, 0); disc(c, 0, 0, r, '#8a5a32', 0.05);
  for (const f of [0.95, 0.75]) ring(c, 0, 0, r * f, '#3a3a3a', 0.05);
  disc(c, 0, 0, r * 0.7, '#c89a40', 0.02);
  for (let i = 0; i < 12; i++) { const a = H(s, i) * TAU, d = r * 0.6 * H(s, i, 1); disc(c, Math.cos(a) * d, Math.sin(a) * d, 0.04 + 0.04 * H(s, i, 2), '#e8c870', 0); }
  seg(c, -r * 0.2, -r * 0.5, r * 0.5, r * 0.2, LWOOD, 0.07);
});
add('Tavern', 'still', 'Copper still', 1.4, 1, {}, (c, o, w, h) => {
  shadowRect(c, w, h, 0.2);
  disc(c, -w * 0.18, 0, h * 0.42, COPPER, 0.04); disc(c, -w * 0.18, 0, h * 0.25, shade(COPPER, 0.2), 0.02); disc(c, -w * 0.25, -h * 0.1, h * 0.1, 'rgba(255,255,255,0.3)', 0);
  c.beginPath(); c.moveTo(-w * 0.18 + h * 0.2, 0); c.quadraticCurveTo(w * 0.15, -h * 0.4, w * 0.3, 0); stroke(c, 0.07, '#8a4a2a');
  disc(c, w * 0.32, h * 0.05, h * 0.25, '#7a5230', 0.03); for (const f of [0.18, 0.1]) ring(c, w * 0.32, h * 0.05, h * f, shade(COPPER, -0.1), 0.03);
});
add('Tavern', 'bar_stool', 'Bar stool', 0.45, 0.45, {}, (c, o, w, h) => {
  const r = Math.min(w, h) / 2; disc(c, 0.04, 0.05, r, SH, 0); disc(c, 0, 0, r, XWOOD, 0.035); disc(c, 0, 0, r * 0.72, '#8b2c2c', 0.02); ring(c, 0, 0, r * 0.45, 'rgba(0,0,0,0.2)', 0.02);
});
add('Tavern', 'broken_furniture', 'Broken furniture', 1.2, 1, { natural: false }, (c, o, w, h, s) => {
  for (let i = 0; i < 7; i++) {
    const x = (H(s, i) - 0.5) * w * 0.7, y = (H(s, i, 1) - 0.5) * h * 0.7, a = H(s, i, 2) * TAU, l = 0.2 + H(s, i, 3) * 0.4;
    c.save(); c.translate(x, y); c.rotate(a); rect(c, -l / 2, -0.04, l, 0.08 + (i % 3 === 0 ? 0.1 : 0), i % 2 ? WOOD : '#7c5530', 0.02); c.restore();
  }
  chair(c, w * 0.2, -h * 0.15, 1.9, 0.45);
});
add('Tavern', 'spill', 'Spilled ale', 1, 0.7, { layer: 0 }, (c, o, w, h, s) => {
  c.beginPath();
  for (let i = 0; i <= 16; i++) { const a = (i / 16) * TAU, k = 0.7 + 0.3 * H(s, i % 16); const x = Math.cos(a) * w / 2 * k, y = Math.sin(a) * h / 2 * k; if (i) c.lineTo(x, y); else c.moveTo(x, y); }
  c.closePath(); c.fillStyle = 'rgba(170,120,40,0.45)'; c.fill();
  mug(c, w * 0.15, -h * 0.05, 0.1);
});
add('Tavern', 'trapdoor', 'Cellar trapdoor', 1, 1, { snap: true, layer: 0 }, (c, o, w, h) => {
  rect(c, -w * 0.45, -h * 0.45, w * 0.9, h * 0.9, '#6b4627', 0.05);
  lines(c, -w * 0.45, -h * 0.45, w * 0.9, h * 0.9, w * 0.18, true, 0.3, 0.03);
  for (const y of [-0.28, 0.28]) rect(c, -w * 0.45, y * h - 0.04, w * 0.9, 0.08, IRON, 0.015);
  ring(c, w * 0.25, 0, 0.07, '#2a2a2a', 0.03);
});

// =====================================================================
// Inn
// =====================================================================
add('Inn', 'double_bed', 'Double bed', 2, 2.2, { snap: true, colors: CLOTH }, (c, o, w, h) => {
  shadowRect(c, w, h); bedFrame(c, -w / 2, -h / 2, w, h, o.color ?? CLOTH[1], 2); rect(c, -w / 2, -h / 2, w, 0.1, XWOOD, 0.03);
});
add('Inn', 'bunk_bed', 'Bunk bed', 1, 2, { snap: true, colors: CLOTH }, (c, o, w, h) => {
  shadowRect(c, w, h, 0, 0.14); bedFrame(c, -w / 2, -h / 2, w, h, o.color ?? CLOTH[3], 1);
  for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) rect(c, x * (w / 2 - 0.05) - 0.06, y * (h / 2 - 0.05) - 0.06, 0.12, 0.12, XWOOD, 0.02);
  rect(c, w / 2 - 0.1, -h * 0.2, 0.1, h * 0.5, DWOOD, 0.02); lines(c, w / 2 - 0.1, -h * 0.2, 0.1, h * 0.5, 0.12, false, 0.5, 0.02);
});
add('Inn', 'cot', 'Cot', 0.8, 1.8, {}, (c, o, w, h) => {
  shadowRect(c, w, h); rect(c, -w / 2, -h / 2, w, h, '#8a7a5a', 0.04); rect(c, -w / 2 + 0.05, -h / 2 + 0.05, w - 0.1, h - 0.1, '#c8b890', 0);
  rrect(c, -w / 2 + 0.1, -h / 2 + 0.1, w - 0.2, 0.28, 0.06, '#efe6d2', 0.02); rect(c, -w / 2 + 0.05, -h * 0.05, w - 0.1, h * 0.5, '#7a6a4a', 0);
});
add('Inn', 'bedroll', 'Bedroll', 0.8, 1.9, { colors: ['#6a5a3a', '#4a5a3a', '#7a3a2a', '#3a4a6a'] }, (c, o, w, h) => {
  const col = o.color ?? '#6a5a3a';
  shadowRect(c, w, h, 0.2, 0.05); rrect(c, -w / 2, -h / 2, w, h, 0.2, col, 0.035);
  rrect(c, -w / 2 + 0.08, -h / 2 + 0.08, w - 0.16, 0.3, 0.1, '#d8c8a0', 0.02);
  rrect(c, -w / 2, h * 0.05, w, h * 0.45, 0.2, shade(col, -0.2), 0.03);
  lines(c, -w / 2, h * 0.05, w, h * 0.45, 0.15, false, 0.25);
});
add('Inn', 'canopy_bed', 'Canopy bed', 2.2, 2.4, { snap: true, colors: CLOTH }, (c, o, w, h) => {
  const col = o.color ?? CLOTH[4];
  shadowRect(c, w, h, 0, 0.14); bedFrame(c, -w / 2 + 0.1, -h / 2 + 0.1, w - 0.2, h - 0.2, col, 2, XWOOD);
  c.fillStyle = shade(col, -0.3); c.globalAlpha = 0.55;
  c.fillRect(-w / 2, -h / 2, w, 0.25); c.fillRect(-w / 2, -h / 2, 0.18, h); c.fillRect(w / 2 - 0.18, -h / 2, 0.18, h);
  c.globalAlpha = 1;
  for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) disc(c, x * (w / 2 - 0.08), y * (h / 2 - 0.08), 0.09, XWOOD, 0.025);
});
add('Inn', 'cradle', 'Cradle', 0.6, 0.9, {}, (c, o, w, h) => {
  shadowRect(c, w, h, 0.25); rrect(c, -w / 2, -h / 2, w, h, 0.25, WOOD, 0.04); rrect(c, -w / 2 + 0.07, -h / 2 + 0.07, w - 0.14, h - 0.14, 0.2, '#e8dcc8', 0);
  rrect(c, -w / 2 + 0.07, -h * 0.05, w - 0.14, h * 0.45, 0.15, '#8ab0d0', 0);
});
add('Inn', 'nightstand', 'Nightstand', 0.6, 0.6, {}, (c, o, w, h) => {
  woodTop(c, w, h, '#7c5530', 0.04); rect(c, -w / 2 + 0.08, h / 2 - 0.12, w - 0.16, 0.06, XWOOD, 0); candle(c, -w * 0.15, -h * 0.1, 0.07); glow(c, -w * 0.15, -h * 0.1, 0.7, 0.3);
  book(c, w * 0.15, h * 0.08, 0.2, 0.15, BOOKS[1], 0.3);
});
add('Inn', 'dresser', 'Chest of drawers', 1.4, 0.6, {}, (c, o, w, h) => { drawers(c, w, h, 2, 2, '#7a5230'); });
add('Inn', 'vanity', 'Dresser with mirror', 1.4, 0.6, {}, (c, o, w, h) => {
  woodTop(c, w, h, '#7a5230', 0.04);
  rrect(c, -w * 0.25, -h / 2 - 0.02, w * 0.5, h * 0.25, 0.05, '#a8c8d8', 0.03); seg(c, -w * 0.15, -h / 2 + 0.03, w * 0.05, -h / 2 + 0.03, 'rgba(255,255,255,0.6)', 0.02);
  disc(c, -w * 0.3, h * 0.15, 0.06, '#c890b0', 0.015); disc(c, w * 0.3, h * 0.12, 0.05, POTION[4], 0.015); rect(c, w * 0.05, h * 0.05, 0.15, 0.08, '#d8c8a8', 0.01);
});
add('Inn', 'washstand', 'Washstand', 0.7, 0.7, {}, (c, o, w, h) => {
  woodTop(c, w, h, '#7c5530', 0.05); const r = Math.min(w, h) * 0.32;
  disc(c, -w * 0.06, h * 0.04, r, '#e8e2d4', 0.025); disc(c, -w * 0.06, h * 0.04, r * 0.75, '#8ab8d0', 0);
  disc(c, w * 0.28, -h * 0.28, 0.1, '#d8d2c4', 0.02); rect(c, w * 0.28, -h * 0.32, 0.12, 0.05, '#d8d2c4', 0.01);
});
add('Inn', 'chamber_pot', 'Chamber pot', 0.35, 0.35, {}, (c, o, w, h) => {
  const r = Math.min(w, h) / 2; disc(c, 0.03, 0.04, r, SH, 0); disc(c, 0, 0, r, '#e8e2d4', 0.025); disc(c, 0, 0, r * 0.65, '#c8c0b0', 0); rect(c, r * 0.8, -0.03, r * 0.4, 0.06, '#e8e2d4', 0.012);
});
add('Inn', 'folding_screen', 'Folding screen', 2, 0.3, {}, (c, o, w, h, s) => {
  const n = 4, pw = w / n;
  for (let i = 0; i < n; i++) {
    const x0 = -w / 2 + i * pw, y0 = i % 2 ? h / 2 : -h / 2, y1 = i % 2 ? -h / 2 : h / 2;
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + pw, y1); stroke(c, 0.1, XWOOD); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + pw, y1); stroke(c, 0.06, CLOTH[Math.floor(H(s, 1) * 5)]);
  }
});
add('Inn', 'trunk', 'Travel trunk', 1, 0.6, { colors: ['#6a3a22', '#3a4a5a', '#5a2a2a', '#4a3a2a'] }, (c, o, w, h) => {
  const col = o.color ?? '#6a3a22';
  shadowRect(c, w, h, 0.06); rrect(c, -w / 2, -h / 2, w, h, 0.06, col, 0.05);
  rrect(c, -w / 2 + 0.06, -h / 2 + 0.06, w - 0.12, h - 0.12, 0.04, shade(col, 0.12), 0);
  for (const x of [-0.28, 0.28]) rect(c, x * w - 0.04, -h / 2, 0.08, h, '#2a2420', 0.015);
  for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) rect(c, x * (w / 2 - 0.06) - 0.05, y * (h / 2 - 0.06) - 0.05, 0.1, 0.1, BRASS, 0.01);
  rect(c, -0.06, h / 2 - 0.12, 0.12, 0.1, BRASS, 0.015);
});
add('Inn', 'luggage', 'Travel bags', 0.9, 0.6, {}, (c, o, w, h) => {
  shadowRect(c, w * 0.6, h * 0.8, 0.1); rrect(c, -w / 2, -h / 2, w * 0.55, h * 0.8, 0.1, '#7a4a2a', 0.035); seg(c, -w / 2 + 0.05, -h * 0.25, -w / 2 + w * 0.5, -h * 0.25, '#4a2a1a', 0.03); disc(c, -w * 0.22, h * 0.05, 0.04, BRASS, 0);
  ell(c, w * 0.22, h * 0.1, w * 0.27, h * 0.38, 0.2, '#8a7a5a', 0.03); seg(c, w * 0.1, -h * 0.05, w * 0.35, h * 0.25, '#5a4a2a', 0.03);
});
add('Inn', 'front_desk', 'Front desk', 2.5, 1.2, { snap: true }, (c, o, w, h) => {
  const d = h * 0.55;
  c.fillStyle = SH; c.fillRect(-w / 2 + 0.08, -h / 2 + 0.1, w, d); c.fillRect(w / 2 - d + 0.08, -h / 2 + 0.1, d, h);
  poly(c, [-w / 2, -h / 2, w / 2, -h / 2, w / 2, h / 2, w / 2 - d, h / 2, w / 2 - d, -h / 2 + d, -w / 2, -h / 2 + d], '#6e4a2a', 0.05);
  lines(c, -w / 2, -h / 2, w, d, 0.15);
  openBook(c, -w * 0.2, -h / 2 + d / 2, 0.45, 0.3, '#5a2a1a'); seg(c, -w * 0.02, -h / 2 + d * 0.3, w * 0.08, -h / 2 + d * 0.15, '#e8e0d0', 0.02);
  disc(c, w * 0.15, -h / 2 + d / 2, 0.08, BRASS, 0.02); disc(c, w * 0.15, -h / 2 + d / 2, 0.03, '#e8d080', 0);
  candle(c, w / 2 - d / 2, h * 0.2, 0.06);
});
add('Inn', 'key_board', 'Key board', 1, 0.25, {}, (c, o, w, h) => {
  shadowRect(c, w, h); rect(c, -w / 2, -h / 2, w, h * 0.5, XWOOD, 0.03);
  for (let x = -w / 2 + 0.1; x < w / 2 - 0.05; x += 0.14) { disc(c, x, -h * 0.05, 0.02, BRASS, 0); seg(c, x, -h * 0.05, x, h * 0.3, BRASS, 0.025); disc(c, x, h * 0.35, 0.03, BRASS, 0.01); }
});
add('Inn', 'guest_ledger', 'Guest ledger', 0.5, 0.35, { layer: 2 }, (c, o, w, h) => { openBook(c, 0, 0, w, h, '#5a2a1a'); seg(c, w * 0.25, -h * 0.4, w * 0.45, -h * 0.6, '#e8e0d0', 0.02); });
add('Inn', 'laundry_tub', 'Laundry tub', 1.1, 1.1, {}, (c, o, w, h) => {
  const r = Math.min(w, h) / 2; barrelTop(c, r, '#a8c8d8');
  for (let i = 0; i < 6; i++) disc(c, (H(i, 3) - 0.5) * r, (H(i, 4) - 0.5) * r, 0.06, 'rgba(255,255,255,0.7)', 0);
  rect(c, r * 0.1, -r * 0.5, r * 0.5, r * 0.7, '#c8c0a8', 0.015); lines(c, r * 0.1, -r * 0.5, r * 0.5, r * 0.7, 0.05, false, 0.3, 0.012);
});
add('Inn', 'clothesline', 'Clothesline', 3, 0.5, { layer: 3 }, (c, o, w, h, s) => {
  seg(c, -w / 2, 0, w / 2, 0, '#d8d0c0', 0.025);
  disc(c, -w / 2, 0, 0.07, XWOOD, 0.02); disc(c, w / 2, 0, 0.07, XWOOD, 0.02);
  for (let x = -w / 2 + 0.3; x < w / 2 - 0.25; x += 0.45) {
    const col = [CREAM, '#a8b8d0', '#d8b8a8', '#c8c8a0', '#e8e0d0'][Math.floor(H(s, Math.round(x * 10)) * 5)];
    c.fillStyle = SH; c.fillRect(x - 0.12, 0.06, 0.32, h * 0.42);
    rect(c, x - 0.15, -0.02, 0.32, h * 0.4 * (0.7 + 0.3 * H(s, Math.round(x * 10), 1)), col, 0.015);
  }
});
add('Inn', 'linen_basket', 'Linen basket', 0.7, 0.7, {}, (c, o, w, h, s) => { basketOf(c, 0, 0, Math.min(w, h) / 2, null, s); const r = Math.min(w, h) / 2; rrect(c, -r * 0.55, -r * 0.4, r * 1.1, r * 0.7, 0.04, CREAM, 0.015); rrect(c, -r * 0.45, -r * 0.1, r * 0.9, r * 0.5, 0.04, '#d8e0e8', 0.015); });
add('Inn', 'linen_stack', 'Folded linens', 0.6, 0.5, { layer: 2 }, (c, o, w, h) => {
  shadowRect(c, w, h, 0.04, 0.05);
  for (let i = 0; i < 3; i++) rrect(c, -w / 2 + i * 0.02, -h / 2 + i * 0.03, w - i * 0.04, h - i * 0.06, 0.04, ['#e8e2d4', '#d8e0e8', '#f4eee2'][i], 0.015);
  seg(c, -w * 0.4, 0, w * 0.4, 0, 'rgba(0,0,0,0.15)', 0.02);
});
add('Inn', 'copper_tub', 'Copper bathtub', 1.6, 1.1, {}, (c, o, w, h) => {
  shadowEll(c, 0, 0, w / 2, h / 2, 0.08); ell(c, 0, 0, w / 2, h / 2, 0, COPPER, 0.05); ell(c, 0, 0, w / 2 - 0.1, h / 2 - 0.1, 0, '#7ab0c8', 0.02);
  for (let i = 0; i < 5; i++) disc(c, -w * 0.2 + i * 0.1, -h * 0.1 + (i % 2) * 0.1, 0.05, 'rgba(255,255,255,0.6)', 0);
});
add('Inn', 'standing_mirror', 'Standing mirror', 0.8, 0.3, {}, (c, o, w, h) => {
  shadowRect(c, w, h, 0.1); rrect(c, -w / 2, -h / 2, w, h, 0.12, BRASS, 0.04); rrect(c, -w / 2 + 0.06, -h / 2 + 0.06, w - 0.12, h - 0.12, 0.08, '#a8c8d8', 0);
  seg(c, -w * 0.25, -h * 0.1, w * 0.05, -h * 0.1, 'rgba(255,255,255,0.7)', 0.025);
});
add('Inn', 'armchair', 'Armchair', 0.9, 0.9, { colors: FABRIC }, (c, o, w, h) => {
  const col = o.color ?? FABRIC[0];
  shadowRect(c, w, h, 0.12);
  rrect(c, -w / 2, -h / 2, w, h, 0.14, shade(col, -0.25), 0.045);
  rrect(c, -w / 2 + w * 0.2, -h / 2 + h * 0.25, w * 0.6, h * 0.68, 0.1, col, 0.03);
  rrect(c, -w / 2, -h / 2 + h * 0.15, w * 0.2, h * 0.85, 0.08, shade(col, -0.12), 0.03); rrect(c, w / 2 - w * 0.2, -h / 2 + h * 0.15, w * 0.2, h * 0.85, 0.08, shade(col, -0.12), 0.03);
});
add('Inn', 'sofa', 'Sofa', 2, 0.9, { colors: FABRIC }, (c, o, w, h) => {
  const col = o.color ?? FABRIC[1];
  shadowRect(c, w, h, 0.12);
  rrect(c, -w / 2, -h / 2, w, h, 0.14, shade(col, -0.25), 0.045);
  const aw = Math.min(0.22, w * 0.12), cw = (w - 2 * aw) / 2;
  for (let i = 0; i < 2; i++) rrect(c, -w / 2 + aw + i * cw + 0.02, -h / 2 + h * 0.28, cw - 0.04, h * 0.65, 0.08, col, 0.03);
  rrect(c, -w / 2, -h / 2 + h * 0.12, aw, h * 0.88, 0.08, shade(col, -0.12), 0.03); rrect(c, w / 2 - aw, -h / 2 + h * 0.12, aw, h * 0.88, 0.08, shade(col, -0.12), 0.03);
});
add('Inn', 'footstool', 'Footstool', 0.5, 0.5, { colors: FABRIC }, (c, o, w, h) => {
  shadowRect(c, w, h, 0.1); rrect(c, -w / 2, -h / 2, w, h, 0.1, DWOOD, 0.035); rrect(c, -w / 2 + 0.05, -h / 2 + 0.05, w - 0.1, h - 0.1, 0.08, o.color ?? FABRIC[2], 0.02);
  disc(c, 0, 0, 0.02, BRASS, 0);
});
add('Inn', 'side_table', 'Side table', 0.6, 0.6, {}, (c, o, w, h, s) => {
  const r = Math.min(w, h) / 2; disc(c, 0.05, 0.07, r, SH, 0); disc(c, 0, 0, r, '#7c5530', 0.04); ring(c, 0, 0, r * 0.8, 'rgba(0,0,0,0.2)', 0.02);
  if (H(s, 1) > 0.5) goblet(c, r * 0.2, -r * 0.2, 0.08); else book(c, 0, 0, r * 0.9, r * 0.65, BOOKS[Math.floor(H(s, 2) * 7)], 0.4);
});
add('Inn', 'cushions', 'Floor cushions', 1, 1, { colors: FABRIC }, (c, o, w, h, s) => {
  for (let i = 0; i < 4; i++) {
    const a = H(s, i) * TAU, d = Math.min(w, h) * 0.22 * (i ? 1 : 0), cs = Math.min(w, h) * 0.32;
    c.save(); c.translate(Math.cos(a) * d, Math.sin(a) * d); c.rotate(H(s, i, 1));
    const col = i === 0 && o.color ? o.color : FABRIC[Math.floor(H(s, i, 2) * FABRIC.length)];
    c.fillStyle = SH; c.fillRect(-cs / 2 + 0.04, -cs / 2 + 0.05, cs, cs);
    rrect(c, -cs / 2, -cs / 2, cs, cs, 0.08, col, 0.025); disc(c, 0, 0, 0.025, GOLD, 0); c.restore();
  }
});
add('Inn', 'horse_stall', 'Horse stall', 2, 3, { snap: true, layer: 0 }, (c, o, w, h, s) => {
  rect(c, -w / 2, -h / 2, w, h, '#c8a85a', 0);
  for (let i = 0; i < 30; i++) { const x = (H(s, i) - 0.5) * w, y = (H(s, i, 1) - 0.5) * h; seg(c, x, y, x + 0.15 * Math.cos(i), y + 0.15 * Math.sin(i), 'rgba(120,90,30,0.5)', 0.02); }
  c.beginPath(); c.moveTo(-w / 2, h / 2); c.lineTo(-w / 2, -h / 2); c.lineTo(w / 2, -h / 2); c.lineTo(w / 2, h / 2); stroke(c, 0.14, DWOOD);
  seg(c, -w / 2, h / 2, -w * 0.1, h / 2, DWOOD, 0.1);
  rect(c, -w / 2 + 0.1, -h / 2 + 0.1, w * 0.4, 0.3, '#7a5230', 0.02); rect(c, -w / 2 + 0.14, -h / 2 + 0.14, w * 0.4 - 0.08, 0.22, '#d8b85a', 0);
});
add('Animals', 'horse', 'Horse', 0.9, 2.2, {}, (c, o, w, h) => { beast(c, w, h, '#7a4a2a', { tail: '#2a1a10', ears: true, mane: '#2a1a10', snout: '#5a3a22' }); });
add('Inn', 'saddle_rack', 'Saddle rack', 1, 0.5, {}, (c, o, w, h) => {
  shadowRect(c, w, h); rect(c, -w / 2, -h * 0.1, w, h * 0.2, XWOOD, 0.03);
  ell(c, -w * 0.2, 0, w * 0.22, h * 0.45, 0, '#6a3a1a', 0.03); ell(c, -w * 0.2, -h * 0.05, w * 0.12, h * 0.25, 0, '#8a5a2a', 0);
  ell(c, w * 0.25, 0, w * 0.2, h * 0.4, 0, '#4a2a1a', 0.03); ring(c, w * 0.25, h * 0.35, 0.06, STEEL, 0.02);
});
add('Inn', 'water_pump', 'Water pump', 0.7, 0.7, {}, (c, o, w, h) => {
  const r = Math.min(w, h) / 2; disc(c, 0, 0, r, STONE, 0.04); disc(c, 0, r * 0.2, r * 0.55, '#3a6a8a', 0.02);
  disc(c, 0, -r * 0.4, r * 0.25, IRON, 0.02); seg(c, 0, -r * 0.4, r * 0.8, -r * 0.8, IRON, 0.06);
});
add('Inn', 'potted_plant', 'Potted plant', 0.6, 0.6, {}, (c, o, w, h, s) => {
  const r = Math.min(w, h) / 2; disc(c, 0.04, 0.06, r * 0.75, SH, 0); disc(c, 0, 0, r * 0.7, '#a85a3a', 0.03);
  for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU + H(s, 1); ell(c, Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, r * 0.45, r * 0.18, a, i % 2 ? '#3f7a35' : '#5a9a45', 0.015); }
  disc(c, 0, 0, r * 0.2, '#4f8a3a', 0);
});
add('Inn', 'painting', 'Painting (wall)', 1, 0.15, {}, (c, o, w, h, s) => {
  rect(c, -w / 2, -h / 2, w, h, GOLD, 0.03); rect(c, -w / 2 + 0.05, -h / 2 + 0.03, w - 0.1, h - 0.06, ['#4a6a8a', '#6a4a3a', '#3a5a3a'][Math.floor(H(s, 1) * 3)], 0);
});
add('Inn', 'grandfather_clock', 'Grandfather clock', 0.6, 0.4, {}, (c, o, w, h) => {
  shadowRect(c, w, h, 0.04); rrect(c, -w / 2, -h / 2, w, h, 0.04, '#5a3420', 0.04);
  disc(c, 0, 0, Math.min(w, h) * 0.38, '#efe6cc', 0.02); seg(c, 0, 0, 0, -h * 0.25, INK, 0.015); seg(c, 0, 0, w * 0.15, 0, INK, 0.015);
});
add('Inn', 'inn_building', 'Inn (building)', 6, 4, { snap: true, layer: 4, colors: ROOFS }, (c, o, w, h, s) => {
  hipRoof(c, w, h, o.color ?? ROOFS[0]);
  for (const f of [-0.3, 0.3]) { rect(c, f * w - 0.25, -h * 0.28 - 0.25, 0.5, 0.5, '#6d625a', 0.04); disc(c, f * w, -h * 0.28, 0.12, '#2a2420', 0); }
  if (H(s, 1) >= 0) { /* sign */ rrect(c, -0.4, h / 2 - 0.05, 0.8, 0.35, 0.04, '#2f4f7a', 0.03); mug(c, 0, h / 2 + 0.12, 0.09); }
});

// =====================================================================
// Lodge
// =====================================================================
add('Lodge', 'bear_rug', 'Bear rug', 2, 2.4, { snap: true, layer: 0 }, (c, o, w, h) => {
  const col = '#4a3020';
  c.beginPath();
  c.ellipse(0, h * 0.05, w * 0.3, h * 0.32, 0, 0, TAU);
  for (const [x, y, a] of [[-0.38, -0.2, -0.6], [0.38, -0.2, 0.6], [-0.38, 0.32, 0.6], [0.38, 0.32, -0.6]]) { c.moveTo(x * w, y * h); c.ellipse(x * w, y * h, w * 0.14, h * 0.07, a, 0, TAU); }
  c.fillStyle = col; c.fill();
  ell(c, 0, h * 0.05, w * 0.3, h * 0.32, 0, col, 0.035);
  for (const [x, y] of [[-0.45, -0.24], [0.45, -0.24], [-0.45, 0.36], [0.45, 0.36]]) for (let k = -1; k <= 1; k++) disc(c, x * w + k * 0.05, y * h + 0.03, 0.025, '#e8e0d0', 0);
  ell(c, 0, -h * 0.34, w * 0.16, h * 0.11, 0, '#5a3a26', 0.035);
  disc(c, -w * 0.12, -h * 0.42, 0.07, '#5a3a26', 0.02); disc(c, w * 0.12, -h * 0.42, 0.07, '#5a3a26', 0.02);
  ell(c, 0, -h * 0.25, w * 0.06, h * 0.04, 0, '#7a5a40', 0); disc(c, 0, -h * 0.23, 0.035, '#1a1a1a', 0);
  disc(c, -w * 0.06, -h * 0.35, 0.025, '#1a1a1a', 0); disc(c, w * 0.06, -h * 0.35, 0.025, '#1a1a1a', 0);
  c.save(); c.beginPath(); c.ellipse(0, h * 0.05, w * 0.3, h * 0.32, 0, 0, TAU); c.clip(); lines(c, -w, -h, w * 2, h * 2, 0.08, true, 0.12, 0.02); c.restore();
});
add('Lodge', 'fur_rug', 'Fur rug', 2, 1.5, { layer: 0, colors: ['#8a7a6a', '#c8b8a0', '#5a4a3a', '#e8e0d4'] }, (c, o, w, h, s) => {
  const col = o.color ?? '#8a7a6a';
  c.beginPath();
  for (let i = 0; i <= 24; i++) { const a = (i / 24) * TAU, k = 0.82 + 0.18 * H(s, i % 24); const x = Math.cos(a) * w / 2 * k, y = Math.sin(a) * h / 2 * k; if (i) c.lineTo(x, y); else c.moveTo(x, y); }
  c.closePath(); c.fillStyle = col; c.fill(); stroke(c, 0.03, shade(col, -0.4));
  c.save(); c.clip();
  for (let i = 0; i < 40; i++) { const x = (H(s, i, 7) - 0.5) * w, y = (H(s, i, 8) - 0.5) * h; seg(c, x, y, x + 0.08, y + 0.1, shade(col, H(s, i, 9) > 0.5 ? 0.2 : -0.2), 0.025); }
  c.restore();
});
add('Lodge', 'antler_chandelier', 'Antler chandelier', 1.6, 1.6, { layer: 3 }, (c, o, w, h) => {
  const r = Math.min(w, h) / 2; glow(c, 0, 0, r * 2.5, 0.35);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    c.save(); c.rotate(a);
    seg(c, 0, 0, r * 0.85, 0, '#d8c8a8', 0.05); seg(c, r * 0.4, 0, r * 0.55, -r * 0.2, '#d8c8a8', 0.035); seg(c, r * 0.65, 0, r * 0.8, r * 0.18, '#d8c8a8', 0.035);
    c.restore();
    candle(c, Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85, 0.06);
  }
  disc(c, 0, 0, 0.1, IRON, 0.02);
});
add('Lodge', 'antlers', 'Mounted antlers', 1.2, 0.5, {}, (c, o, w, h) => {
  ell(c, 0, -h * 0.25, w * 0.15, h * 0.25, 0, '#6a4a2a', 0.03);
  for (const sx of [-1, 1]) {
    c.beginPath(); c.moveTo(sx * w * 0.05, -h * 0.15); c.quadraticCurveTo(sx * w * 0.3, h * 0.35, sx * w * 0.48, -h * 0.2); stroke(c, 0.06, '#d8c8a8');
    seg(c, sx * w * 0.22, h * 0.05, sx * w * 0.25, -h * 0.35, '#d8c8a8', 0.04); seg(c, sx * w * 0.36, h * 0.02, sx * w * 0.42, -h * 0.4, '#d8c8a8', 0.04);
  }
  disc(c, 0, -h * 0.25, 0.06, '#3a2418', 0);
});
add('Lodge', 'rocking_chair', 'Rocking chair', 0.7, 0.9, {}, (c, o, w, h) => {
  shadowRect(c, w, h, 0.1);
  for (const x of [-1, 1]) { c.beginPath(); c.moveTo(x * w * 0.45, -h / 2); c.quadraticCurveTo(x * w * 0.52, 0, x * w * 0.45, h / 2); stroke(c, 0.06, XWOOD); }
  rrect(c, -w * 0.38, -h * 0.2, w * 0.76, h * 0.55, 0.05, '#7c5530', 0.035); rrect(c, -w * 0.38, -h * 0.4, w * 0.76, h * 0.2, 0.04, '#5c3d22', 0.035);
  rrect(c, -w * 0.3, -h * 0.12, w * 0.6, h * 0.4, 0.05, '#8b2c2c', 0.02);
});
add('Lodge', 'log_bench', 'Log bench', 2, 0.5, {}, (c, o, w, h) => {
  shadowRect(c, w, h, h * 0.4); rrect(c, -w / 2, -h / 2, w, h, h * 0.45, '#5a3a22', 0.04);
  rrect(c, -w / 2 + 0.05, -h / 2 + 0.08, w - 0.1, h * 0.6, 0.06, '#b89060', 0.02); lines(c, -w / 2 + 0.05, -h / 2 + 0.08, w - 0.1, h * 0.6, 0.06, false, 0.15, 0.015);
});
add('Lodge', 'stump_seat', 'Stump seat', 0.6, 0.6, { natural: true }, (c, o, w, h) => {
  const r = Math.min(w, h) / 2; disc(c, 0.05, 0.07, r, SH, 0); disc(c, 0, 0, r, '#5a3a22', 0.04); disc(c, 0, 0, r * 0.82, '#c8a070', 0.02);
  for (const f of [0.6, 0.4, 0.2]) ring(c, 0, 0, r * f, 'rgba(110,70,30,0.5)', 0.015);
});
add('Lodge', 'log_table', 'Slab table', 2, 1.2, { snap: true }, (c, o, w, h, s) => {
  shadowRect(c, w, h, 0.3);
  c.beginPath();
  for (let i = 0; i <= 20; i++) { const a = (i / 20) * TAU, k = 0.94 + 0.06 * H(s, i % 20); const x = Math.cos(a) * w / 2 * k, y = Math.sin(a) * h / 2 * k * 1.15; c.lineTo(Math.max(-w / 2, Math.min(w / 2, x)), Math.max(-h / 2, Math.min(h / 2, y))); }
  c.closePath(); c.fillStyle = '#5a3a22'; c.fill(); stroke(c, 0.04);
  rrect(c, -w / 2 + 0.1, -h / 2 + 0.1, w - 0.2, h - 0.2, 0.3, '#b08050', 0); lines(c, -w / 2 + 0.1, -h / 2 + 0.1, w - 0.2, h - 0.2, 0.12, false, 0.15);
  ring(c, w * 0.2, 0, 0.12, 'rgba(90,50,20,0.4)', 0.02);
});
add('Lodge', 'stone_hearth', 'Stone hearth', 2.5, 1.2, { snap: true, layer: 3 }, (c, o, w, h, s) => {
  glow(c, 0, h * 0.2, w * 0.8, 0.35);
  shadowRect(c, w, h);
  for (let i = 0; i < 18; i++) { const x = -w / 2 + ((i % 6) + 0.5) * (w / 6), y = -h / 2 + (Math.floor(i / 6) + 0.5) * (h / 3); ell(c, x, y, w / 12 + 0.02, h / 6 + 0.02, 0, shade(STONE, (H(s, i) - 0.5) * 0.35), 0.025); }
  rect(c, -w * 0.3, -h * 0.05, w * 0.6, h * 0.55, '#1e1410', 0.04);
  const g = c.createRadialGradient(0, h * 0.25, 0, 0, h * 0.25, w * 0.3); g.addColorStop(0, '#ffd04a'); g.addColorStop(0.5, '#e2601c'); g.addColorStop(1, '#3a120a');
  c.fillStyle = g; c.fillRect(-w * 0.27, 0, w * 0.54, h * 0.45);
});
add('Lodge', 'log_pile', 'Log pile', 2, 0.9, {}, (c, o, w, h, s) => {
  shadowRect(c, w, h, 0.1);
  const r = h / 4.4;
  for (let row = 0; row < 2; row++) for (let x = -w / 2 + r + (row ? r : 0); x <= w / 2 - r + 0.01; x += r * 2) {
    const y = row ? -h / 2 + r * 1.1 : h / 2 - r * 1.1 - r * 0.6;
    disc(c, x, y + r * 0.3, r, '#5a3a22', 0.02); disc(c, x, y + r * 0.3, r * 0.8, '#c8a070', 0); ring(c, x, y + r * 0.3, r * 0.4, 'rgba(110,70,30,0.5)', 0.012);
  }
});
add('Lodge', 'chopping_block', 'Chopping block', 0.7, 0.7, {}, (c, o, w, h) => {
  const r = Math.min(w, h) / 2; disc(c, 0.05, 0.07, r, SH, 0); disc(c, 0, 0, r, '#5a3a22', 0.04); disc(c, 0, 0, r * 0.82, '#c8a070', 0.02); ring(c, 0, 0, r * 0.45, 'rgba(110,70,30,0.5)', 0.015);
  seg(c, -r * 0.1, 0, r * 0.95, r * 0.6, '#7a5230', 0.06); poly(c, [-r * 0.25, -r * 0.25, r * 0.05, -r * 0.1, -r * 0.05, r * 0.2, -r * 0.35, r * 0.1], STEEL, 0.02);
  for (let i = 0; i < 3; i++) { c.save(); c.translate(-r * 0.4 + i * r * 0.5, r * 1.1); c.rotate(i); rect(c, -0.1, -0.04, 0.2, 0.08, '#b89060', 0.01); c.restore(); }
});
add('Lodge', 'bow_rack', 'Bow rack', 1.6, 0.4, {}, (c, o, w, h) => {
  shadowRect(c, w, h); rect(c, -w / 2, -h / 2, w, h * 0.3, XWOOD, 0.03);
  for (let x = -w / 2 + 0.25; x < w / 2 - 0.15; x += 0.4) { c.beginPath(); c.arc(x, -h * 0.4, h * 0.6, 0.3, Math.PI - 0.3); stroke(c, 0.04, '#7a5230'); seg(c, x - h * 0.55, -h * 0.2, x + h * 0.55, -h * 0.2, '#e8e0d0', 0.01); }
  for (let x = -w / 2 + 0.15; x < w / 2; x += 0.3) seg(c, x, h * 0.25, x + 0.05, h / 2, '#a8804e', 0.025);
});
add('Lodge', 'fishing_rods', 'Fishing rods', 1.8, 0.4, {}, (c, o, w, h) => {
  for (let i = 0; i < 3; i++) { const y = -h * 0.3 + i * h * 0.3; seg(c, -w / 2, y, w / 2, y + h * 0.05, '#a8804e', 0.035); disc(c, -w * 0.3, y, 0.05, STEEL, 0.015); }
  seg(c, -w / 2 + 0.1, -h / 2, -w / 2 + 0.1, h / 2, XWOOD, 0.08);
});
add('Lodge', 'snowshoes', 'Snowshoes', 0.7, 0.7, {}, (c, o, w, h) => {
  for (const x of [-0.22, 0.22]) { ell(c, x * w, 0, w * 0.2, h * 0.45, 0, 'rgba(0,0,0,0)', 0.04); c.save(); c.beginPath(); c.ellipse(x * w, 0, w * 0.2, h * 0.45, 0, 0, TAU); c.clip(); lines(c, -w, -h, w * 2, h * 2, 0.07, true, 0.5, 0.012); lines(c, -w, -h, w * 2, h * 2, 0.07, false, 0.5, 0.012); c.restore(); ring(c, x * w, 0, 0.001, '#000', 0); }
  for (const x of [-0.22, 0.22]) { c.beginPath(); c.ellipse(x * w, 0, w * 0.2, h * 0.45, 0, 0, TAU); stroke(c, 0.04, '#7a5230'); }
});
add('Lodge', 'skis', 'Skis', 0.4, 2, {}, (c, o, w, h) => {
  for (const x of [-0.25, 0.25]) { shadowRect(c, w * 0.3, h, 0.06, 0.04); rrect(c, x * w - w * 0.12, -h / 2, w * 0.24, h, 0.08, '#8a5a2a', 0.03); rect(c, x * w - w * 0.13, -h * 0.05, w * 0.26, h * 0.1, '#3a2a1a', 0.01); }
});
add('Lodge', 'sled', 'Sled', 1, 2, {}, (c, o, w, h) => {
  shadowRect(c, w, h, 0.1);
  for (const x of [-1, 1]) { c.beginPath(); c.moveTo(x * w * 0.45, h / 2); c.lineTo(x * w * 0.45, -h * 0.35); c.quadraticCurveTo(x * w * 0.45, -h / 2, 0, -h / 2); stroke(c, 0.05, IRON); }
  rect(c, -w * 0.4, -h * 0.3, w * 0.8, h * 0.75, '#a8804e', 0.03); lines(c, -w * 0.4, -h * 0.3, w * 0.8, h * 0.75, 0.2, false, 0.25);
});
add('Lodge', 'canoe', 'Canoe', 0.9, 4, {}, (c, o, w, h) => {
  c.save(); c.translate(0.12, 0.15); c.beginPath(); c.ellipse(0, 0, w / 2, h / 2, 0, 0, TAU); c.fillStyle = SH; c.fill(); c.restore();
  c.beginPath(); c.moveTo(0, -h / 2); c.quadraticCurveTo(w * 0.62, 0, 0, h / 2); c.quadraticCurveTo(-w * 0.62, 0, 0, -h / 2); c.fillStyle = '#8a4a2a'; c.fill(); stroke(c, 0.05);
  c.beginPath(); c.moveTo(0, -h * 0.44); c.quadraticCurveTo(w * 0.5, 0, 0, h * 0.44); c.quadraticCurveTo(-w * 0.5, 0, 0, -h * 0.44); c.fillStyle = '#c89a62'; c.fill();
  for (const y of [-0.22, 0, 0.22]) rect(c, -w * 0.38 + Math.abs(y) * w * 0.5, y * h - 0.04, w * 0.76 - Math.abs(y) * w, 0.08, '#7a4a2a', 0.01);
  seg(c, -w * 0.15, h * 0.1, w * 0.35, h * 0.35, '#a8804e', 0.04); ell(c, w * 0.38, h * 0.38, 0.07, 0.14, -0.5, '#a8804e', 0.015);
});
add('Lodge', 'drying_rack', 'Fish drying rack', 2, 0.8, {}, (c, o, w, h, s) => {
  for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) disc(c, x, 0, 0.07, XWOOD, 0.02);
  seg(c, -w / 2, 0, w / 2, 0, '#7a5230', 0.05);
  for (let x = -w / 2 + 0.25; x < w / 2 - 0.15; x += 0.25) { c.save(); c.translate(x, h * 0.2); c.rotate(Math.PI / 2); item(c, 0, 0, 0.14, 'fish', s, Math.round(x * 10)); c.restore(); }
});
add('Lodge', 'hide_frame', 'Hide stretching frame', 1.4, 1.4, {}, (c, o, w, h, s) => {
  shadowRect(c, w, h, 0, 0.06);
  c.beginPath(); c.rect(-w / 2, -h / 2, w, h); stroke(c, 0.08, XWOOD);
  c.beginPath();
  for (let i = 0; i <= 12; i++) { const a = (i / 12) * TAU, k = 0.8 + 0.2 * H(s, i % 12); const x = Math.cos(a) * w * 0.38 * k, y = Math.sin(a) * h * 0.4 * k; if (i) c.lineTo(x, y); else c.moveTo(x, y); }
  c.closePath(); c.fillStyle = '#c8a878'; c.fill(); stroke(c, 0.025, '#7a5a3a');
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; const ex = Math.cos(a) * w * 0.34, ey = Math.sin(a) * h * 0.36; const fx = Math.max(-w / 2, Math.min(w / 2, Math.cos(a) * w)), fy = Math.max(-h / 2, Math.min(h / 2, Math.sin(a) * h)); seg(c, ex, ey, fx, fy, '#d8c8a0', 0.012); }
});
add('Lodge', 'stuffed_bear', 'Stuffed bear', 1.2, 1.2, {}, (c, o, w, h) => {
  const r = Math.min(w, h) / 2;
  shadowEll(c, 0, 0, r * 0.75, r * 0.85, 0.1);
  ell(c, 0, r * 0.05, r * 0.62, r * 0.72, 0, '#4a3020', 0.04);
  ell(c, -r * 0.6, -r * 0.1, r * 0.22, r * 0.18, -0.6, '#4a3020', 0.03); ell(c, r * 0.6, -r * 0.1, r * 0.22, r * 0.18, 0.6, '#4a3020', 0.03);
  disc(c, 0, -r * 0.45, r * 0.32, '#5a3a26', 0.035); disc(c, -r * 0.25, -r * 0.7, r * 0.1, '#5a3a26', 0.02); disc(c, r * 0.25, -r * 0.7, r * 0.1, '#5a3a26', 0.02);
  ell(c, 0, -r * 0.3, r * 0.12, r * 0.08, 0, '#7a5a40', 0); disc(c, 0, -r * 0.33, r * 0.04, '#1a1a1a', 0);
});
add('Lodge', 'lantern', 'Lantern', 0.4, 0.4, { layer: 3 }, (c, o, w, h) => {
  const r = Math.min(w, h) / 2; glow(c, 0, 0, 1.8, 0.45);
  rrect(c, -r * 0.7, -r * 0.7, r * 1.4, r * 1.4, r * 0.2, '#2a2420', 0.03); disc(c, 0, 0, r * 0.5, '#ffd25a', 0); disc(c, 0, 0, r * 0.25, '#fff2c0', 0);
  ring(c, 0, -r * 0.9, r * 0.25, '#2a2420', 0.03);
});
add('Lodge', 'hammock', 'Hammock', 1, 2.5, { colors: ['#c8b890', '#b23a3a', '#2f6fa8', '#3f8a4a'] }, (c, o, w, h) => {
  const col = o.color ?? '#c8b890';
  seg(c, 0, -h / 2, 0, -h * 0.36, '#d8d0c0', 0.025); seg(c, 0, h / 2, 0, h * 0.36, '#d8d0c0', 0.025);
  c.save(); c.translate(0.1, 0.15); c.beginPath(); c.ellipse(0, 0, w * 0.45, h * 0.38, 0, 0, TAU); c.fillStyle = SH; c.fill(); c.restore();
  c.beginPath(); c.moveTo(0, -h * 0.38); c.quadraticCurveTo(w * 0.65, 0, 0, h * 0.38); c.quadraticCurveTo(-w * 0.65, 0, 0, -h * 0.38); c.fillStyle = col; c.fill(); stroke(c, 0.03);
  c.save(); c.clip(); lines(c, -w, -h, w * 2, h * 2, 0.15, true, 0.2); c.restore();
});
add('Lodge', 'potbelly_stove', 'Pot-belly stove', 0.9, 0.9, { layer: 3 }, (c, o, w, h) => {
  const r = Math.min(w, h) / 2; glow(c, 0, 0, r * 2.4, 0.25);
  disc(c, 0.06, 0.08, r, SH, 0); disc(c, 0, 0, r, '#2c2a28', 0.045); disc(c, 0, 0, r * 0.7, '#3c3a37', 0.02);
  disc(c, 0, 0, r * 0.3, '#1a1816', 0.02); ring(c, 0, 0, r * 0.3, '#5a5652', 0.02);
  disc(c, r * 0.35, r * 0.45, r * 0.12, '#d0501c', 0);
});
add('Lodge', 'pelts', 'Pelt bundle', 0.9, 0.7, {}, (c, o, w, h, s) => {
  for (let i = 0; i < 3; i++) {
    c.save(); c.translate((i - 1) * w * 0.12, (i - 1) * h * 0.08); c.rotate((H(s, i) - 0.5) * 0.5);
    const col = ['#8a6a4a', '#5a4a3a', '#c8b8a0'][i];
    ell(c, 0, 0, w * 0.38, h * 0.34, 0, col, 0.025); seg(c, w * 0.3, 0, w * 0.48, h * 0.1, col, 0.06); c.restore();
  }
  seg(c, -w * 0.4, 0, w * 0.4, 0, '#5a3a22', 0.03);
});
add('Lodge', 'bear_trap', 'Bear trap', 0.8, 0.8, { layer: 0 }, (c, o, w, h) => {
  const r = Math.min(w, h) / 2; ring(c, 0, 0, r * 0.8, '#4a4846', 0.06);
  for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; poly(c, [Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78, Math.cos(a + 0.12) * r * 0.55, Math.sin(a + 0.12) * r * 0.55, Math.cos(a + 0.24) * r * 0.78, Math.sin(a + 0.24) * r * 0.78], '#7a7876', 0.01); }
  disc(c, 0, 0, r * 0.22, '#5a5856', 0.02); seg(c, r * 0.8, 0, r * 1.0, r * 0.3, '#4a4846', 0.025);
});
add('Lodge', 'hanging_meat', 'Hanging meat', 0.8, 0.5, { layer: 3 }, (c, o, w, h, s) => {
  seg(c, -w / 2, -h * 0.3, w / 2, -h * 0.3, '#2a2420', 0.04);
  for (let i = 0; i < 3; i++) { const x = -w * 0.3 + i * w * 0.3; seg(c, x, -h * 0.3, x, -h * 0.1, '#5a5856', 0.02); c.save(); c.translate(x, h * 0.12); c.rotate(Math.PI / 2); item(c, 0, 0, Math.min(w * 0.16, h * 0.25), 'meat', s, i); c.restore(); }
});
add('Lodge', 'lodge_building', 'Lodge (building)', 6, 4, { snap: true, layer: 4, colors: ['#5a4a3a', ...ROOFS] }, (c, o, w, h) => {
  hipRoof(c, w, h, o.color ?? '#5a4a3a');
  rect(c, w * 0.3 - 0.35, -0.35, 0.7, 0.7, '#7a7268', 0.04); disc(c, w * 0.3, 0, 0.15, '#2a2420', 0);
});

// =====================================================================
// Shop
// =====================================================================
add('Shop', 'shop_counter', 'Shop counter', 2.5, 0.8, { snap: true }, (c, o, w, h, s) => {
  woodTop(c, w, h, '#7a5230', 0.04);
  rect(c, -w / 2, h / 2 - 0.14, w, 0.14, '#5a3820', 0.03);
  rrect(c, w * 0.22, -h * 0.25, 0.4, 0.28, 0.03, '#4a3a2a', 0.02); rect(c, w * 0.22 + 0.04, -h * 0.2, 0.32, 0.18, '#6a5a3a', 0); coin(c, w * 0.22 + 0.15, -h * 0.12, 0.045); coin(c, w * 0.22 + 0.25, -h * 0.1, 0.045);
  openBook(c, -w * 0.25, -h * 0.05, 0.4, 0.28, '#3a2a1a');
  if (H(s, 1) > 0.4) { disc(c, 0, -h * 0.1, 0.06, BRASS, 0.015); disc(c, 0, -h * 0.1, 0.025, '#e8d080', 0); }
});
add('Shop', 'display_case', 'Display case', 2, 0.8, { snap: true }, (c, o, w, h, s) => {
  shadowRect(c, w, h, 0.04);
  rect(c, -w / 2, -h / 2, w, h, '#5a3820', 0.05);
  rect(c, -w / 2 + 0.07, -h / 2 + 0.07, w - 0.14, h - 0.14, '#5a2a3a', 0);
  const kinds: Kind[] = ['potion', 'coin', 'book', 'gem'];
  for (let i = 0; i < 6; i++) item(c, -w / 2 + 0.25 + i * (w - 0.5) / 5, (H(s, i) - 0.5) * h * 0.25, 0.08, kinds[Math.floor(H(s, i, 1) * kinds.length)], s, i);
  rect(c, -w / 2 + 0.07, -h / 2 + 0.07, w - 0.14, h - 0.14, 'rgba(190,225,240,0.25)', 0.015);
  seg(c, -w / 2 + 0.2, -h * 0.25, -w / 2 + 0.6, h * 0.25, 'rgba(255,255,255,0.45)', 0.03);
});
add('Shop', 'jewel_case', 'Jewelry case', 1.2, 0.7, { snap: true }, (c, o, w, h, s) => {
  shadowRect(c, w, h, 0.04);
  rect(c, -w / 2, -h / 2, w, h, '#3a2418', 0.05); rect(c, -w / 2 + 0.06, -h / 2 + 0.06, w - 0.12, h - 0.12, '#2a2a5a', 0);
  pile(c, -w / 2 + 0.1, -h / 2 + 0.1, w - 0.2, h - 0.2, 'gem', s);
  for (let i = 0; i < 2; i++) ring(c, -w * 0.25 + i * w * 0.5, 0, 0.06, GOLD, 0.02);
  rect(c, -w / 2 + 0.06, -h / 2 + 0.06, w - 0.12, h - 0.12, 'rgba(190,225,240,0.22)', 0.015);
});
add('Shop', 'sword_display', 'Sword display', 2, 0.4, {}, (c, o, w, h, s) => {
  shadowRect(c, w, h); rect(c, -w / 2, -h / 2, w, h * 0.5, DWOOD, 0.03);
  for (let i = 0; i < Math.floor(w / 0.5); i++) {
    const x = -w / 2 + 0.25 + i * 0.5;
    seg(c, x - 0.2, -h * 0.15, x + 0.2, -h * 0.15, '#c8c8d0', 0.05); seg(c, x - 0.22, -h * 0.15, x - 0.17, -h * 0.15, GOLD, 0.06);
    seg(c, x - 0.15, -h * 0.28, x - 0.15, -h * 0.02, GOLD, 0.03);
    if (i % 2) { disc(c, x, h * 0.2, h * 0.22, CLOTH[Math.floor(H(s, i) * 5)], 0.025); disc(c, x, h * 0.2, h * 0.07, STEEL, 0); }
  }
});
add('Shop', 'shield_wall', 'Shield wall', 2, 0.4, { colors: CLOTH }, (c, o, w, h, s) => {
  shadowRect(c, w, h); rect(c, -w / 2, -h / 2, w, h * 0.3, XWOOD, 0.03);
  const n = Math.max(1, Math.floor(w / 0.45));
  for (let i = 0; i < n; i++) { const x = -w / 2 + (i + 0.5) * (w / n), col = i === 0 && o.color ? o.color : CLOTH[Math.floor(H(s, i) * CLOTH.length)]; disc(c, x, h * 0.05, Math.min(h * 0.45, w / n * 0.45), col, 0.03); ring(c, x, h * 0.05, Math.min(h * 0.45, w / n * 0.45) * 0.85, STEEL, 0.02); disc(c, x, h * 0.05, 0.05, STEEL, 0.01); }
});
add('Shop', 'dress_form', "Tailor's dummy", 0.6, 0.6, { colors: CLOTH }, (c, o, w, h) => {
  const r = Math.min(w, h) / 2; disc(c, 0.04, 0.05, r * 0.9, SH, 0);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; seg(c, 0, 0, Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9, XWOOD, 0.04); }
  ell(c, 0, 0, r * 0.75, r * 0.45, 0, o.color ?? '#c8b890', 0.03); disc(c, 0, 0, r * 0.18, XWOOD, 0.02);
  for (let i = -2; i <= 2; i++) disc(c, i * r * 0.2, r * 0.2, 0.015, '#a0a0a0', 0);
});
add('Shop', 'armor_display', 'Armor display', 0.8, 0.8, {}, (c, o, w, h) => {
  const r = Math.min(w, h) / 2; disc(c, 0.06, 0.08, r, SH, 0);
  ell(c, 0, 0.02, r * 0.95, r * 0.5, 0, '#8a8a94', 0.04); ell(c, -r * 0.75, 0, r * 0.28, r * 0.35, 0, '#a8a8b2', 0.03); ell(c, r * 0.75, 0, r * 0.28, r * 0.35, 0, '#a8a8b2', 0.03);
  ell(c, 0, 0.02, r * 0.5, r * 0.35, 0, '#a8a8b2', 0.02); disc(c, 0, -r * 0.1, r * 0.3, '#6a6a74', 0.03); seg(c, -r * 0.15, -r * 0.1, r * 0.15, -r * 0.1, '#2a2a2a', 0.03);
});
add('Shop', 'cloth_bolts', 'Cloth bolts', 1.4, 0.6, { colors: CLOTH }, (c, o, w, h, s) => {
  for (let i = 0; i < 4; i++) {
    const y = -h / 2 + (i + 0.5) * (h / 4), col = CLOTH[Math.floor(H(s, i) * CLOTH.length)];
    c.fillStyle = SH; c.fillRect(-w / 2 + 0.04, y - h / 8 + 0.05, w, h / 4);
    rrect(c, -w / 2, y - h / 8, w, h / 4 - 0.01, 0.04, i === 0 && o.color ? o.color : col, 0.02);
    disc(c, -w / 2 + 0.04, y, h / 10, shade(col, -0.25), 0.012); disc(c, -w / 2 + 0.04, y, 0.02, XWOOD, 0);
  }
});
add('Shop', 'cloth_shelf', 'Fabric shelf', 2, 0.5, {}, (c, o, w, h, s) => { shelf(c, w, h, (x, y, iw, ih) => pile(c, x, y, iw, ih, 'cloth', s), DWOOD); });
add('Shop', 'spinning_wheel', 'Spinning wheel', 1, 0.8, {}, (c, o, w, h) => {
  shadowRect(c, w, h * 0.4, 0.05); rect(c, -w / 2, -h * 0.1, w, h * 0.2, XWOOD, 0.03);
  ell(c, -w * 0.15, 0, w * 0.08, h * 0.45, 0, 'rgba(0,0,0,0)', 0.04); c.beginPath(); c.ellipse(-w * 0.15, 0, w * 0.06, h * 0.45, 0, 0, TAU); stroke(c, 0.04, '#7a5230');
  seg(c, -w * 0.15, -h * 0.45, -w * 0.15, h * 0.45, '#7a5230', 0.02);
  disc(c, w * 0.3, 0, 0.1, '#e8dcc0', 0.015); seg(c, -w * 0.15, -h * 0.4, w * 0.3, -0.08, 'rgba(230,220,200,0.8)', 0.008);
});
add('Shop', 'loom', 'Loom', 1.8, 1.4, { colors: CLOTH }, (c, o, w, h, s) => {
  const col = o.color ?? CLOTH[Math.floor(H(s, 1) * 6)];
  shadowRect(c, w, h);
  c.beginPath(); c.rect(-w / 2, -h / 2, w, h); stroke(c, 0.1, XWOOD);
  rect(c, -w * 0.4, -h * 0.4, w * 0.8, h * 0.45, col, 0.02);
  lines(c, -w * 0.4, -h * 0.4, w * 0.8, h * 0.45, 0.05, true, 0.18, 0.012); lines(c, -w * 0.4, -h * 0.4, w * 0.8, h * 0.45, 0.08, false, 0.25, 0.015);
  c.strokeStyle = 'rgba(230,220,200,0.7)'; c.lineWidth = 0.008; c.beginPath(); for (let x = -w * 0.4; x <= w * 0.4; x += 0.05) { c.moveTo(x, h * 0.05); c.lineTo(x, h * 0.4); } c.stroke();
  rect(c, -w / 2, h * 0.15, w, 0.08, '#7a5230', 0.02); rect(c, -w * 0.2, h * 0.3, w * 0.4, 0.06, '#a8804e', 0.015);
});
add('Shop', 'sewing_table', 'Sewing table', 1.4, 0.8, {}, (c, o, w, h, s) => {
  woodTop(c, w, h);
  rect(c, -w * 0.4, -h * 0.3, w * 0.45, h * 0.55, CLOTH[Math.floor(H(s, 1) * 6)], 0.015);
  for (let i = 0; i < 3; i++) { disc(c, w * 0.15 + i * 0.12, -h * 0.25, 0.05, POTION[i], 0.01); disc(c, w * 0.15 + i * 0.12, -h * 0.25, 0.015, CREAM, 0); }
  seg(c, w * 0.2, h * 0.1, w * 0.38, h * 0.25, STEEL, 0.025); seg(c, w * 0.38, h * 0.1, w * 0.2, h * 0.25, STEEL, 0.025); ring(c, w * 0.18, h * 0.08, 0.04, '#2a2a2a', 0.015); ring(c, w * 0.4, h * 0.08, 0.04, '#2a2a2a', 0.015);
});
add('Shop', 'cobbler_bench', "Cobbler's bench", 1.4, 0.7, {}, (c, o, w, h) => {
  woodTop(c, w, h, '#7a5230');
  for (const x of [-0.25, 0.05]) { ell(c, x * w, 0, w * 0.1, h * 0.28, 0.2, '#5a3a22', 0.02); ell(c, x * w, -h * 0.1, w * 0.06, h * 0.1, 0.2, '#3a2418', 0); }
  rect(c, w * 0.25, -h * 0.2, 0.05, 0.3, '#5a5856', 0.01); rect(c, w * 0.22, -h * 0.25, 0.12, 0.08, '#3a3836', 0.01);
  disc(c, w * 0.38, h * 0.15, 0.05, '#d8c8a8', 0.01);
});
add('Shop', 'shoe_rack', 'Shoe rack', 1.4, 0.4, {}, (c, o, w, h, s) => {
  shelf(c, w, h, (x, y, iw, ih) => { for (let i = 0; i < Math.floor(iw / 0.2); i++) { const col = ['#5a3a22', '#3a2418', '#7a4a2a'][Math.floor(H(s, i) * 3)]; ell(c, x + 0.1 + i * 0.2, y + ih / 2, 0.06, ih * 0.4, 0, col, 0.012); } });
});
add('Shop', 'pottery_wheel', 'Pottery wheel', 1, 1, {}, (c, o, w, h) => {
  const r = Math.min(w, h) / 2; disc(c, 0.05, 0.07, r, SH, 0); disc(c, 0, 0, r, '#7a5230', 0.04); disc(c, 0, 0, r * 0.55, '#8a7a6a', 0.03);
  disc(c, 0, 0, r * 0.32, '#b0643a', 0.02); disc(c, 0, 0, r * 0.15, '#7a3a22', 0);
  rect(c, -r * 0.3, r * 0.65, r * 0.6, r * 0.3, '#5a3a22', 0.02);
});
add('Shop', 'kiln', 'Kiln', 1.6, 1.6, { snap: true, layer: 3 }, (c, o, w, h) => {
  const r = Math.min(w, h) / 2;
  disc(c, 0.1, 0.12, r, SH, 0); disc(c, 0, 0, r, '#8a5a42', 0.05);
  for (let i = 0; i < 3; i++) ring(c, 0, 0, r * (0.3 + i * 0.22), 'rgba(0,0,0,0.25)', 0.025);
  disc(c, 0, 0, r * 0.2, '#2a1a12', 0.02);
  rect(c, -r * 0.25, r * 0.7, r * 0.5, r * 0.35, '#1e1410', 0.03); disc(c, 0, r * 0.88, r * 0.12, '#e2601c', 0); glow(c, 0, r, r, 0.4);
});
add('Shop', 'pottery_shelf', 'Pottery shelf', 2, 0.5, {}, (c, o, w, h, s) => { shelf(c, w, h, (x, y, iw, ih) => pile(c, x, y, iw, ih, 'pot', s)); });
add('Shop', 'potion_shelf', 'Potion shelf', 2, 0.5, {}, (c, o, w, h, s) => { shelf(c, w, h, (x, y, iw, ih) => pile(c, x, y, iw, ih, 'potion', s), '#4a2a3a'); });
add('Shop', 'herb_rack', 'Hanging herbs', 1.6, 0.4, { layer: 3 }, (c, o, w, h, s) => {
  seg(c, -w / 2, -h * 0.3, w / 2, -h * 0.3, XWOOD, 0.05);
  for (let x = -w / 2 + 0.12; x < w / 2 - 0.05; x += 0.2) { seg(c, x, -h * 0.3, x, -h * 0.05, '#c8b890', 0.012); item(c, x, h * 0.12, Math.min(0.12, h * 0.35), 'herb', s, Math.round(x * 10)); }
});
add('Shop', 'apothecary_drawers', 'Apothecary drawers', 2, 0.5, {}, (c, o, w, h) => { drawers(c, w, h, Math.max(1, Math.round(w / 0.25)), 2, '#5a3a22'); });
add('Shop', 'alchemy_table', 'Alchemy table', 2, 1, { snap: true }, (c, o, w, h, s) => {
  woodTop(c, w, h, '#5a4a3a');
  for (let i = 0; i < 4; i++) flask(c, -w * 0.38 + i * 0.18, -h * 0.25, 0.08, POTION[Math.floor(H(s, i) * 6)]);
  disc(c, w * 0.05, h * 0.05, 0.16, 'rgba(200,225,235,0.55)', 0.02); disc(c, w * 0.05, h * 0.08, 0.11, '#4ab84a', 0); c.beginPath(); c.moveTo(w * 0.15, 0); c.quadraticCurveTo(w * 0.3, -h * 0.3, w * 0.38, -h * 0.05); stroke(c, 0.035, 'rgba(200,225,235,0.8)');
  disc(c, w * 0.05, h * 0.08, 0.04, 'rgba(255,255,255,0.5)', 0); candle(c, w * 0.05, h * 0.32, 0.05);
  item(c, -w * 0.3, h * 0.22, 0.09, 'mushroom', s, 9); scroll(c, w * 0.35, h * 0.25, 0.3, 0.3);
});
add('Shop', 'mortar', 'Mortar and pestle', 0.4, 0.4, { layer: 2 }, (c, o, w, h) => {
  const r = Math.min(w, h) / 2; disc(c, 0.03, 0.04, r, SH, 0); disc(c, 0, 0, r, LSTONE, 0.025); disc(c, 0, 0, r * 0.65, '#6a8a4a', 0); seg(c, -r * 0.2, r * 0.1, r * 0.9, -r * 0.7, STONE, 0.05);
});
add('Shop', 'merchant_scale', 'Merchant scale', 0.7, 0.4, { layer: 2 }, (c, o, w, h) => {
  seg(c, -w * 0.38, 0, w * 0.38, 0, BRASS, 0.035); disc(c, 0, 0, 0.06, BRASS, 0.015);
  for (const x of [-0.38, 0.38]) { disc(c, x * w, 0, Math.min(w * 0.13, h * 0.4), BRASS, 0.02); disc(c, x * w, 0, Math.min(w * 0.13, h * 0.4) * 0.7, shade(BRASS, -0.15), 0); }
  coin(c, w * 0.38, 0, 0.04); coin(c, -w * 0.4, -0.02, 0.035);
});
add('Shop', 'strongbox', 'Strongbox', 0.5, 0.35, { layer: 2 }, (c, o, w, h) => {
  shadowRect(c, w, h, 0.03, 0.05); rrect(c, -w / 2, -h / 2, w, h, 0.03, '#4a4846', 0.035); rect(c, -w / 2, -0.02, w, 0.04, '#2a2826', 0); rect(c, -0.05, -0.06, 0.1, 0.12, GOLD, 0.015);
});
add('Shop', 'coin_pile', 'Coin pile', 0.5, 0.5, { layer: 2 }, (c, o, w, h, s) => {
  const r = Math.min(w, h) / 2; disc(c, 0, 0, r * 0.95, '#c89a2a', 0);
  for (let i = 0; i < 26; i++) { const a = H(s, i) * TAU, d = r * 0.85 * Math.sqrt(H(s, i, 1)); coin(c, Math.cos(a) * d, Math.sin(a) * d, r * 0.17); }
});
add('Shop', 'gem_pile', 'Gem pile', 0.5, 0.5, { layer: 2 }, (c, o, w, h, s) => {
  const r = Math.min(w, h) / 2;
  for (let i = 0; i < 14; i++) { const a = H(s, i) * TAU, d = r * 0.8 * Math.sqrt(H(s, i, 1)); item(c, Math.cos(a) * d, Math.sin(a) * d, r * 0.2, 'gem', s, i); }
});
add('Shop', 'safe', 'Iron safe', 0.9, 0.9, {}, (c, o, w, h) => {
  shadowRect(c, w, h, 0.05); rrect(c, -w / 2, -h / 2, w, h, 0.05, '#3a3c40', 0.05); rrect(c, -w / 2 + 0.08, -h / 2 + 0.08, w - 0.16, h - 0.16, 0.03, '#4a4c52', 0.02);
  disc(c, 0, 0, Math.min(w, h) * 0.18, '#8a8a94', 0.025); for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; seg(c, 0, 0, Math.cos(a) * Math.min(w, h) * 0.15, Math.sin(a) * Math.min(w, h) * 0.15, '#3a3c40', 0.02); }
  for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) disc(c, x * (w / 2 - 0.12), y * (h / 2 - 0.12), 0.025, '#8a8a94', 0);
});
add('Shop', 'hat_stand', 'Hat stand', 0.6, 0.6, {}, (c, o, w, h, s) => {
  const r = Math.min(w, h) / 2; disc(c, 0, 0, 0.06, XWOOD, 0.02);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU + 0.5, col = ['#3a2a1a', '#6a2a2a', '#2a3a5a'][Math.floor(H(s, i) * 3)]; disc(c, Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.4, col, 0.02); disc(c, Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.22, shade(col, 0.15), 0.015); }
});
add('Shop', 'goods_shelf', 'General goods shelf', 2, 0.5, {}, (c, o, w, h, s) => {
  const kinds: Kind[] = ['pot', 'bottle', 'cloth', 'book', 'potato'];
  shelf(c, w, h, (x, y, iw, ih) => { const n = 4; for (let i = 0; i < n; i++) pile(c, x + (i * iw) / n, y, iw / n, ih, kinds[Math.floor(H(s, i) * kinds.length)], s, i); }, DWOOD);
});
add('Shop', 'arrow_barrel', 'Barrel of arrows', 0.6, 0.6, {}, (c, o, w, h, s) => {
  const r = Math.min(w, h) / 2; barrelTop(c, r, '#3a2a1a');
  c.save(); c.beginPath(); c.arc(0, 0, r * 0.75, 0, TAU); c.clip(); pile(c, -r * 0.75, -r * 0.75, r * 1.5, r * 1.5, 'arrow', s); c.restore();
});
add('Shop', 'dye_vats', 'Dye vats', 2, 1, { snap: true }, (c, o, w, h, s) => {
  const n = Math.max(1, Math.round(w / h)), cw = w / n;
  for (let i = 0; i < n; i++) { c.save(); c.translate(-w / 2 + (i + 0.5) * cw, 0); barrelTop(c, Math.min(cw, h) * 0.46, ['#8b2c2c', '#2f4f9a', '#d6a12b', '#3f8a4a', '#7a3fa0'][(i + Math.floor(H(s, 1) * 5)) % 5]); c.restore(); }
});
add('Shop', 'shop_sign', 'Shop sign', 1, 0.5, { layer: 3, colors: ['#5a3a20', '#2f4f7a', '#8b2c2c', '#2f6a4a'] }, (c, o, w, h, s) => {
  seg(c, -w / 2, -h * 0.35, w / 2, -h * 0.35, '#2a2420', 0.05);
  shadowRect(c, w * 0.8, h * 0.6, 0.04, 0.1);
  rrect(c, -w * 0.4, -h * 0.25, w * 0.8, h * 0.62, 0.04, o.color ?? '#5a3a20', 0.04);
  const k = Math.floor(H(s, 1) * 4), y = h * 0.06, m = Math.min(w, h) * 0.18;
  if (k === 0) flask(c, 0, y, m, POTION[0]);
  else if (k === 1) { seg(c, -m, y + m, m, y - m, '#c8c8d0', 0.05); seg(c, -m * 0.6, y + m * 0.2, -m * 0.1, y + m * 0.7, GOLD, 0.04); }
  else if (k === 2) coin(c, 0, y, m);
  else book(c, 0, y, m * 2, m * 1.5, BOOKS[0]);
});
add('Shop', 'shop_building', 'Shop (building)', 3, 3, { snap: true, layer: 4, colors: ROOFS }, (c, o, w, h, s) => {
  hipRoof(c, w, h, o.color ?? ROOFS[1]);
  c.save(); c.translate(0, h / 2 + 0.25); awning(c, w * 0.8, 0.45, CLOTH[Math.floor(H(s, 1) * 5)], 5); c.restore();
});

// =====================================================================
// Library
// =====================================================================
function bookRow(c: Ctx, x: number, y: number, iw: number, ih: number, s: number, salt: number) {
  const n = Math.max(1, Math.floor(iw / 0.11));
  const bw = iw / n;
  for (let i = 0; i < n; i++) {
    if (H(s, i, salt + 50) > 0.93) continue;
    const col = BOOKS[Math.floor(H(s, i, salt) * BOOKS.length)];
    rect(c, x + i * bw, y + H(s, i, salt + 9) * ih * 0.15, bw * 0.88, ih * (0.8 + 0.2 * H(s, i, salt + 3)) - H(s, i, salt + 9) * ih * 0.15, col, 0);
    seg(c, x + i * bw + bw * 0.1, y + ih * 0.3, x + i * bw + bw * 0.78, y + ih * 0.3, 'rgba(230,200,120,0.5)', 0.012);
  }
}
add('Library', 'double_bookcase', 'Double bookcase', 2, 1, { snap: true }, (c, o, w, h, s) => {
  shadowRect(c, w, h);
  rect(c, -w / 2, -h / 2, w, h, XWOOD, 0.05);
  rect(c, -w / 2 + 0.05, -h / 2 + 0.05, w - 0.1, h / 2 - 0.08, '#2a1a10', 0); bookRow(c, -w / 2 + 0.06, -h / 2 + 0.06, w - 0.12, h / 2 - 0.1, s, 0);
  rect(c, -w / 2 + 0.05, 0.03, w - 0.1, h / 2 - 0.08, '#2a1a10', 0); bookRow(c, -w / 2 + 0.06, 0.04, w - 0.12, h / 2 - 0.1, s, 1);
  seg(c, -w / 2, 0, w / 2, 0, '#3a2418', 0.05);
});
add('Library', 'corner_bookcase', 'Corner bookcase', 2, 2, { snap: true }, (c, o, w, h, s) => {
  const d = 0.5;
  c.fillStyle = SH; c.fillRect(-w / 2 + 0.07, -h / 2 + 0.08, w, d); c.fillRect(-w / 2 + 0.07, -h / 2 + 0.08, d, h);
  rect(c, -w / 2, -h / 2, w, d, XWOOD, 0.05); rect(c, -w / 2, -h / 2, d, h, XWOOD, 0.05);
  rect(c, -w / 2 + d, -h / 2 + 0.06, w - d - 0.06, d - 0.12, '#2a1a10', 0); bookRow(c, -w / 2 + d, -h / 2 + 0.06, w - d - 0.06, d - 0.12, s, 0);
  c.save(); c.translate(-w / 2 + d / 2, d / 2); c.rotate(Math.PI / 2); rect(c, -(h - d) / 2 + 0.03, -d / 2 + 0.06, h - d - 0.06, d - 0.12, '#2a1a10', 0); bookRow(c, -(h - d) / 2 + 0.03, -d / 2 + 0.06, h - d - 0.06, d - 0.12, s, 2); c.restore();
});
add('Library', 'book_pile', 'Stack of books', 0.6, 0.5, { layer: 2 }, (c, o, w, h, s) => {
  shadowRect(c, w * 0.8, h * 0.8, 0.02, 0.06);
  for (let i = 0; i < 4; i++) book(c, (H(s, i) - 0.5) * w * 0.15, (H(s, i, 1) - 0.5) * h * 0.15, w * 0.8, h * 0.75, BOOKS[Math.floor(H(s, i, 2) * 7)], (H(s, i, 3) - 0.5) * 0.5);
});
add('Library', 'open_book', 'Open book', 0.5, 0.35, { layer: 2 }, (c, o, w, h, s) => { openBook(c, 0, 0, w, h, BOOKS[Math.floor(H(s, 1) * 7)]); });
add('Library', 'book_cart', 'Book cart', 1.2, 0.6, {}, (c, o, w, h, s) => {
  shadowRect(c, w, h, 0.04); rect(c, -w / 2, -h / 2, w, h, '#7a5230', 0.04);
  rect(c, -w / 2 + 0.05, -h / 2 + 0.05, w - 0.1, h - 0.1, '#2a1a10', 0); bookRow(c, -w / 2 + 0.06, -h / 2 + 0.06, w - 0.12, h - 0.12, s, 4);
  for (const x of [-1, 1]) for (const y of [-1, 1]) disc(c, x * (w / 2 - 0.05), y * (h / 2), 0.05, '#2a2420', 0.01);
});
add('Library', 'lectern', 'Lectern', 0.7, 0.6, {}, (c, o, w, h, s) => {
  shadowRect(c, w, h, 0.04); poly(c, [-w / 2, -h / 2, w / 2, -h / 2, w * 0.4, h / 2, -w * 0.4, h / 2], '#6b4627', 0.04);
  openBook(c, 0, 0, w * 0.75, h * 0.6, BOOKS[Math.floor(H(s, 1) * 7)]);
  seg(c, 0, -h * 0.25, w * 0.05, h * 0.35, '#8b2c2c', 0.025);
});
add('Library', 'reading_table', 'Reading table', 2.5, 1.2, { snap: true }, (c, o, w, h, s) => {
  for (const x of [-0.3, 0.3]) { chair(c, x * w, -h / 2 - 0.15, 0, 0.5); chair(c, x * w, h / 2 + 0.15, Math.PI, 0.5); }
  woodTop(c, w, h, '#6e4a2a');
  rect(c, -w / 2 + 0.1, -0.05, w - 0.2, 0.1, '#2f5a3a', 0);
  openBook(c, -w * 0.3, -h * 0.22, 0.45, 0.3, BOOKS[1]); openBook(c, w * 0.3, h * 0.22, 0.45, 0.3, BOOKS[0], Math.PI);
  book(c, -w * 0.05, h * 0.25, 0.3, 0.22, BOOKS[Math.floor(H(s, 1) * 7)], 0.2); book(c, -w * 0.05, h * 0.25, 0.28, 0.2, BOOKS[Math.floor(H(s, 2) * 7)], -0.1);
  glow(c, w * 0.08, -h * 0.2, 1, 0.25); disc(c, w * 0.08, -h * 0.2, 0.1, '#2f6a4a', 0.02); disc(c, w * 0.08, -h * 0.2, 0.05, '#ffe08a', 0);
  scroll(c, w * 0.35, -h * 0.2, 0.35, 0.2);
});
add('Library', 'writing_desk', 'Writing desk', 1.6, 0.9, {}, (c, o, w, h, s) => {
  woodTop(c, w, h, '#5a3a22');
  rect(c, -w / 2, -h / 2, w, h * 0.22, '#4a2e1a', 0.03);
  for (let i = 0; i < 4; i++) rect(c, -w / 2 + 0.08 + i * ((w - 0.16) / 4), -h / 2 + 0.03, (w - 0.16) / 4 - 0.04, h * 0.15, '#2a1a10', 0);
  c.save(); c.translate(-w * 0.1, h * 0.12); c.rotate(-0.1); rect(c, -0.22, -0.16, 0.44, 0.32, '#f0e6cc', 0.015); lines(c, -0.2, -0.14, 0.4, 0.28, 0.05, false, 0.25, 0.01); c.restore();
  disc(c, w * 0.2, h * 0.05, 0.06, '#1a1410', 0.015); seg(c, w * 0.2, h * 0.05, w * 0.34, -h * 0.15, '#f0f0f0', 0.025);
  candle(c, w * 0.38, h * 0.2, 0.06); glow(c, w * 0.38, h * 0.2, 0.8, 0.3);
  book(c, -w * 0.38, h * 0.15, 0.25, 0.2, BOOKS[Math.floor(H(s, 1) * 7)], 0.3);
});
add('Library', 'scroll_rack', 'Scroll rack', 2, 0.5, {}, (c, o, w, h, s) => {
  shadowRect(c, w, h); rect(c, -w / 2, -h / 2, w, h, XWOOD, 0.05);
  const r = 0.07, n = Math.floor((w - 0.1) / (r * 2.2)), m = Math.max(1, Math.floor((h - 0.1) / (r * 2.2)));
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    const x = -w / 2 + 0.05 + (i + 0.5) * ((w - 0.1) / n), y = -h / 2 + 0.05 + (j + 0.5) * ((h - 0.1) / m);
    disc(c, x, y, r * 1.05, '#2a1a10', 0); if (H(s, i, j) > 0.2) { disc(c, x, y, r * 0.85, '#e8dcb8', 0.012); ring(c, x, y, r * 0.4, 'rgba(120,90,40,0.5)', 0.01); }
  }
});
add('Library', 'scroll_pile', 'Pile of scrolls', 0.7, 0.5, { layer: 2 }, (c, o, w, h, s) => {
  for (let i = 0; i < 5; i++) scroll(c, (H(s, i) - 0.5) * w * 0.3, (H(s, i, 1) - 0.5) * h * 0.5, w * 0.8, (H(s, i, 2) - 0.5) * 0.8);
});
add('Library', 'scroll', 'Scroll', 0.6, 0.15, { layer: 2 }, (c, o, w) => { scroll(c, 0, 0, w); });
add('Library', 'globe', 'Globe', 0.8, 0.8, {}, (c, o, w, h) => {
  const r = Math.min(w, h) / 2; disc(c, 0.06, 0.08, r, SH, 0); ring(c, 0, 0, r * 0.95, BRASS, 0.05);
  disc(c, 0, 0, r * 0.82, '#3a6a9a', 0.02);
  for (const [x, y, rx, ry] of [[-0.3, -0.2, 0.25, 0.3], [0.25, 0.1, 0.3, 0.2], [0.1, -0.45, 0.15, 0.1], [-0.15, 0.4, 0.15, 0.12]]) ell(c, x * r, y * r, rx * r, ry * r, x, '#7a9a5a', 0);
  c.beginPath(); c.ellipse(0, 0, r * 0.82, r * 0.3, 0, 0, TAU); stroke(c, 0.012, 'rgba(255,255,255,0.3)');
  disc(c, -r * 0.3, -r * 0.35, r * 0.15, 'rgba(255,255,255,0.2)', 0);
});
add('Library', 'orrery', 'Orrery', 1.2, 1.2, {}, (c, o, w, h) => {
  const r = Math.min(w, h) / 2; disc(c, 0.05, 0.07, r * 0.3, SH, 0);
  for (let i = 1; i <= 4; i++) ring(c, 0, 0, r * i * 0.22, 'rgba(200,160,72,0.7)', 0.015);
  disc(c, 0, 0, r * 0.14, '#e8b030', 0.02); glow(c, 0, 0, r * 0.4, 0.3);
  const cols = ['#a8a8a8', '#d8a060', '#4a8ad0', '#c84a2a'];
  for (let i = 1; i <= 4; i++) { const a = i * 1.7; seg(c, 0, 0, Math.cos(a) * r * i * 0.22, Math.sin(a) * r * i * 0.22, BRASS, 0.015); disc(c, Math.cos(a) * r * i * 0.22, Math.sin(a) * r * i * 0.22, r * (0.05 + i * 0.012), cols[i - 1], 0.012); }
});
add('Library', 'telescope', 'Telescope', 0.5, 1.4, {}, (c, o, w, h) => {
  for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU + Math.PI / 2; seg(c, 0, h * 0.15, Math.cos(a) * w * 0.45, h * 0.15 + Math.sin(a) * w * 0.45, XWOOD, 0.04); }
  shadowRect(c, w * 0.4, h * 0.9, 0.1, 0.06);
  poly(c, [-w * 0.12, h * 0.3, w * 0.12, h * 0.3, w * 0.2, -h / 2, -w * 0.2, -h / 2], BRASS, 0.03);
  rect(c, -w * 0.21, -h / 2, w * 0.42, 0.1, shade(BRASS, -0.2), 0.02); disc(c, 0, h * 0.15, 0.05, IRON, 0);
});
add('Library', 'map_table', 'Map table', 2, 1.5, { snap: true }, (c, o, w, h, s) => {
  woodTop(c, w, h, '#5a3a22');
  rect(c, -w / 2 + 0.15, -h / 2 + 0.15, w - 0.3, h - 0.3, '#e0d0a8', 0.02);
  c.save(); c.beginPath(); c.rect(-w / 2 + 0.15, -h / 2 + 0.15, w - 0.3, h - 0.3); c.clip();
  c.beginPath(); for (let i = 0; i <= 10; i++) { const a = (i / 10) * TAU, k = 0.6 + 0.4 * H(s, i % 10); const x = Math.cos(a) * w * 0.25 * k - w * 0.1, y = Math.sin(a) * h * 0.25 * k; if (i) c.lineTo(x, y); else c.moveTo(x, y); }
  c.closePath(); c.fillStyle = '#c8b888'; c.fill(); stroke(c, 0.015, '#7a6a4a');
  c.setLineDash([0.05, 0.04]); c.beginPath(); c.moveTo(-w * 0.15, -h * 0.05); c.quadraticCurveTo(w * 0.1, h * 0.25, w * 0.28, -h * 0.15); stroke(c, 0.015, '#8b2c2c'); c.setLineDash([]);
  seg(c, w * 0.25, -h * 0.18, w * 0.31, -h * 0.12, '#8b2c2c', 0.02); seg(c, w * 0.31, -h * 0.18, w * 0.25, -h * 0.12, '#8b2c2c', 0.02);
  c.restore();
  for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) disc(c, x * (w / 2 - 0.2), y * (h / 2 - 0.2), 0.05, IRON, 0.01);
  disc(c, w * 0.35, h * 0.3, 0.1, BRASS, 0.02); seg(c, w * 0.35, h * 0.3, w * 0.35, h * 0.22, INK, 0.015);
});
add('Library', 'card_catalog', 'Card catalogue', 1.2, 0.5, {}, (c, o, w, h) => { drawers(c, w, h, Math.max(1, Math.round(w / 0.2)), 2, '#7a5230', '#e8e0c0'); });
add('Library', 'library_ladder', 'Library ladder', 0.6, 1.6, {}, (c, o, w, h) => {
  shadowRect(c, w, h, 0, 0.05);
  rect(c, -w / 2, -h / 2, 0.08, h, '#7a5230', 0.02); rect(c, w / 2 - 0.08, -h / 2, 0.08, h, '#7a5230', 0.02);
  for (let y = -h / 2 + 0.15; y < h / 2; y += 0.25) rect(c, -w / 2 + 0.08, y, w - 0.16, 0.06, '#a8804e', 0.015);
  disc(c, -w / 2 + 0.04, h / 2 - 0.04, 0.05, BRASS, 0); disc(c, w / 2 - 0.04, h / 2 - 0.04, 0.05, BRASS, 0);
});
add('Library', 'candlestick', 'Tall candlestick', 0.4, 0.4, { layer: 3 }, (c, o, w, h) => {
  const r = Math.min(w, h) / 2; glow(c, 0, 0, 1.6, 0.4); disc(c, 0, 0, r, BRASS, 0.025); disc(c, 0, 0, r * 0.6, shade(BRASS, -0.15), 0); candle(c, 0, 0, r * 0.45);
});
add('Library', 'inkwell', 'Inkwell and quill', 0.3, 0.3, { layer: 2 }, (c, o, w, h) => {
  const r = Math.min(w, h) / 2; disc(c, 0, 0, r * 0.6, '#2a2a3a', 0.02); disc(c, 0, 0, r * 0.3, '#0a0a1a', 0);
  c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(r * 0.6, -r * 1.1, r * 1.1, -r * 1.2); c.quadraticCurveTo(r * 0.5, -r * 0.4, 0, 0); c.fillStyle = '#f0f0f0'; c.fill(); stroke(c, 0.01);
});
add('Library', 'parchment', 'Parchment', 0.4, 0.5, { layer: 2 }, (c, o, w, h, s) => {
  c.save(); c.rotate((H(s, 1) - 0.5) * 0.3); rect(c, -w / 2, -h / 2, w, h, '#efe2c0', 0.015); lines(c, -w / 2 + 0.04, -h / 2 + 0.04, w - 0.08, h - 0.08, 0.05, false, 0.25, 0.01); c.restore();
});
add('Library', 'magic_circle', 'Magic circle', 3, 3, { snap: true, layer: 0, colors: ['#7ad0f0', '#c070f0', '#f07070', '#70f0a0'] }, (c, o, w, h) => {
  const r = Math.min(w, h) / 2, col = o.color ?? '#7ad0f0';
  const rgb = col.match(/\w\w/g)!.map((x) => parseInt(x, 16)).join(',');
  glow(c, 0, 0, r * 1.1, 0.25, rgb);
  c.shadowColor = col; c.shadowBlur = 0.2;
  ring(c, 0, 0, r * 0.95, col, 0.04); ring(c, 0, 0, r * 0.82, col, 0.025);
  c.beginPath(); for (let i = 0; i <= 5; i++) { const a = (i * 2 * TAU) / 5 - Math.PI / 2; if (i) c.lineTo(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82); else c.moveTo(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82); } stroke(c, 0.03, col);
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; c.save(); c.translate(Math.cos(a) * r * 0.885, Math.sin(a) * r * 0.885); c.rotate(a); seg(c, -0.04, -0.03, 0.04, 0.03, col, 0.015); seg(c, 0, -0.04, 0, 0.04, col, 0.015); c.restore(); }
  c.shadowBlur = 0;
});
add('Library', 'crystal_ball', 'Crystal ball', 0.6, 0.6, {}, (c, o, w, h) => {
  const r = Math.min(w, h) / 2; glow(c, 0, 0, r * 2, 0.3, '160,120,255');
  for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU + 0.5; seg(c, 0, 0, Math.cos(a) * r, Math.sin(a) * r, BRASS, 0.05); }
  const g = c.createRadialGradient(-r * 0.2, -r * 0.2, 0, 0, 0, r * 0.7); g.addColorStop(0, '#f0e8ff'); g.addColorStop(0.5, '#a890e0'); g.addColorStop(1, '#5a3a9a');
  c.beginPath(); c.arc(0, 0, r * 0.7, 0, TAU); c.fillStyle = g; c.fill(); stroke(c, 0.025);
});
add('Library', 'spellbook_pedestal', 'Spellbook pedestal', 0.9, 0.9, {}, (c, o, w, h) => {
  const r = Math.min(w, h) / 2; glow(c, 0, 0, r * 1.8, 0.3, '120,200,255');
  shadowRect(c, w * 0.9, h * 0.9, 0.05); rrect(c, -w * 0.45, -h * 0.45, w * 0.9, h * 0.9, 0.05, '#8d877d', 0.04); rrect(c, -w * 0.35, -h * 0.35, w * 0.7, h * 0.7, 0.04, '#a8a092', 0.02);
  openBook(c, 0, 0, w * 0.6, h * 0.42, '#2a2a5a');
  disc(c, -w * 0.12, 0, 0.04, '#9ad8ff', 0); disc(c, w * 0.14, 0.02, 0.03, '#9ad8ff', 0);
});
add('Library', 'skull', 'Skull', 0.3, 0.35, { layer: 2 }, (c, o, w, h) => {
  ell(c, 0, -h * 0.05, w * 0.48, h * 0.42, 0, '#e8e0c8', 0.02); rect(c, -w * 0.25, h * 0.2, w * 0.5, h * 0.25, '#d8d0b8', 0.015);
  disc(c, -w * 0.18, h * 0.02, w * 0.13, '#2a2420', 0); disc(c, w * 0.18, h * 0.02, w * 0.13, '#2a2420', 0); poly(c, [0, h * 0.12, -w * 0.05, h * 0.2, w * 0.05, h * 0.2], '#2a2420', 0);
});
add('Library', 'bust', 'Marble bust', 0.6, 0.6, {}, (c, o, w, h) => {
  const r = Math.min(w, h) / 2; shadowRect(c, w, h, 0.04, 0.06); rect(c, -r, -r, r * 2, r * 2, '#8d877d', 0.035);
  ell(c, 0, r * 0.15, r * 0.8, r * 0.45, 0, '#e8e4dc', 0.025); disc(c, 0, -r * 0.15, r * 0.38, '#f0ece4', 0.025); ell(c, 0, -r * 0.5, r * 0.1, r * 0.08, 0, '#e0dcd4', 0.01);
});
add('Library', 'hourglass', 'Hourglass', 0.3, 0.3, { layer: 2 }, (c, o, w, h) => {
  const r = Math.min(w, h) / 2; disc(c, 0, 0, r, XWOOD, 0.02); disc(c, 0, 0, r * 0.7, 'rgba(200,225,235,0.6)', 0.015); disc(c, 0, 0, r * 0.4, '#d8b870', 0);
});
add('Library', 'archive_shelf', 'Archive shelf', 2, 0.6, {}, (c, o, w, h, s) => {
  shelf(c, w, h, (x, y, iw, ih) => {
    for (let i = 0; i < Math.floor(iw / 0.4); i++) {
      const bx = x + i * 0.4 + 0.03;
      if (H(s, i) > 0.5) rect(c, bx, y + 0.03, 0.34, ih - 0.06, '#a08060', 0.015);
      else pile(c, bx, y, 0.34, ih, 'scroll', s, i);
    }
  });
});
add('Library', 'specimen_shelf', 'Specimen jars', 1.6, 0.5, {}, (c, o, w, h, s) => {
  shelf(c, w, h, (x, y, iw, ih) => {
    const n = Math.floor(iw / 0.22);
    for (let i = 0; i < n; i++) {
      const cx = x + (i + 0.5) * (iw / n), cy = y + ih / 2, jr = Math.min(0.1, ih * 0.42);
      disc(c, cx, cy, jr, 'rgba(180,210,150,0.55)', 0.015);
      const k = Math.floor(H(s, i) * 3);
      if (k === 0) ell(c, cx, cy, jr * 0.6, jr * 0.3, H(s, i, 1) * 3, '#c8a080', 0); else if (k === 1) disc(c, cx, cy, jr * 0.4, '#e8e0c8', 0); else { seg(c, cx - jr * 0.5, cy, cx + jr * 0.5, cy, '#8a6a4a', 0.02); }
      disc(c, cx - jr * 0.35, cy - jr * 0.35, jr * 0.2, 'rgba(255,255,255,0.5)', 0);
    }
  }, '#3a3a2a');
});
add('Library', 'chalkboard', 'Chalkboard', 1.6, 0.25, {}, (c, o, w, h, s) => {
  rect(c, -w / 2, -h / 2, w, h, '#7a5230', 0.03); rect(c, -w / 2 + 0.05, -h / 2 + 0.04, w - 0.1, h - 0.08, '#2a3a2e', 0);
  for (let i = 0; i < 4; i++) seg(c, -w / 2 + 0.15 + i * 0.35, -h * 0.1, -w / 2 + 0.3 + i * 0.35 + H(s, i) * 0.1, h * 0.1, 'rgba(240,240,230,0.7)', 0.015);
});
add('Library', 'banner', 'Wall banner', 1, 0.3, { colors: CLOTH }, (c, o, w, h) => {
  const col = o.color ?? CLOTH[0];
  seg(c, -w / 2, -h * 0.35, w / 2, -h * 0.35, BRASS, 0.04);
  poly(c, [-w * 0.42, -h * 0.35, w * 0.42, -h * 0.35, w * 0.42, h * 0.45, 0, h * 0.2, -w * 0.42, h * 0.45], col, 0.025);
  disc(c, 0, -h * 0.05, Math.min(w, h) * 0.18, GOLD, 0.015);
});

// =====================================================================
// Market
// =====================================================================
add('Market', 'fruit_stand', 'Fruit stand', 2, 1.2, { snap: true }, produceStand(['apple', 'orange', 'pear', 'grape']));
add('Market', 'veg_stand', 'Vegetable stand', 2, 1.2, { snap: true }, produceStand(['cabbage', 'carrot', 'potato', 'onion']));
add('Market', 'fish_stand', 'Fishmonger stand', 2, 1.2, { snap: true }, (c, o, w, h, s) => {
  stallTable(c, w, h, '#7a6a5a');
  rect(c, -w / 2 + 0.08, -h / 2 + 0.08, w - 0.16, h * 0.62, '#c8dce4', 0.02);
  c.save(); c.beginPath(); c.rect(-w / 2 + 0.08, -h / 2 + 0.08, w - 0.16, h * 0.62); c.clip(); pile(c, -w / 2 + 0.08, -h / 2 + 0.08, w - 0.16, h * 0.62, 'fish', s); c.restore();
  basketOf(c, w * 0.3, h * 0.3, 0.18, 'fish', s, 3); rect(c, -w * 0.35, h * 0.22, 0.3, 0.06, STEEL, 0.01); rect(c, -w * 0.35 + 0.3, h * 0.2, 0.12, 0.1, XWOOD, 0.01);
});
add('Market', 'butcher_stand', 'Butcher stand', 2, 1.2, { snap: true }, (c, o, w, h, s) => {
  stallTable(c, w, h, '#a8804e');
  for (let i = 0; i < 5; i++) { c.save(); c.translate(-w * 0.38 + i * w * 0.19, -h * 0.2); c.rotate(Math.PI / 2 + (H(s, i) - 0.5) * 0.4); item(c, 0, 0, 0.17, 'meat', s, i); c.restore(); }
  rrect(c, -w * 0.2, h * 0.05, w * 0.4, h * 0.35, 0.04, '#c8a070', 0.02); poly(c, [w * 0.02, h * 0.15, w * 0.15, h * 0.15, w * 0.15, h * 0.28, w * 0.02, h * 0.28], STEEL, 0.015); rect(c, -w * 0.08, h * 0.19, w * 0.1, 0.06, XWOOD, 0.01);
});
add('Market', 'bread_stand', 'Bakery stand', 2, 1.2, { snap: true }, produceStand(['bread', 'bread', 'bread'], '#e8dcc0'));
add('Market', 'flower_stand', 'Flower stand', 2, 1.2, { snap: true }, (c, o, w, h, s) => {
  stallTable(c, w, h, '#6a7a4a');
  for (let i = 0; i < 6; i++) { const x = -w / 2 + 0.2 + (i % 3) * ((w - 0.4) / 2), y = i < 3 ? -h * 0.22 : h * 0.2; disc(c, x, y, 0.2, '#a85a3a', 0.02); c.save(); c.beginPath(); c.arc(x, y, 0.19, 0, TAU); c.clip(); pile(c, x - 0.2, y - 0.2, 0.4, 0.4, 'flower', s, i); c.restore(); }
});
add('Market', 'pottery_stand', 'Pottery stand', 2, 1.2, { snap: true }, (c, o, w, h, s) => {
  stallTable(c, w, h); rect(c, -w / 2 + 0.05, -h / 2 + 0.05, w - 0.1, h - 0.1, '#5a4a6a', 0);
  pile(c, -w / 2 + 0.1, -h / 2 + 0.1, w - 0.2, h - 0.2, 'pot', s);
});
add('Market', 'spice_stand', 'Spice stand', 2, 1.2, { snap: true }, (c, o, w, h, s) => {
  stallTable(c, w, h);
  const cols = ['#c8402a', '#e8a030', '#d8c040', '#8a5a2a', '#5a8a3a', '#a03a2a', '#e8d8b0', '#6a3a2a'];
  const n = Math.max(2, Math.round(w / 0.45)), m = 2;
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    const x = -w / 2 + (i + 0.5) * (w / n), y = -h / 2 + (j + 0.5) * (h / m), r = Math.min(w / n, h / m) * 0.4;
    disc(c, x, y, r, '#c8b088', 0.02); disc(c, x, y, r * 0.78, cols[Math.floor(H(s, i, j) * cols.length)], 0); disc(c, x - r * 0.2, y - r * 0.2, r * 0.25, 'rgba(255,255,255,0.18)', 0);
  }
});
add('Market', 'cloth_stand', 'Cloth stand', 2, 1.2, { snap: true }, (c, o, w, h, s) => {
  stallTable(c, w, h); pile(c, -w / 2 + 0.08, -h / 2 + 0.08, w - 0.16, h - 0.16, 'cloth', s);
});
add('Market', 'cheese_stand', 'Cheese stand', 2, 1.2, { snap: true }, produceStand(['cheese', 'egg', 'cheese'], '#d8c8a8'));
add('Market', 'trinket_stand', 'Trinket stand', 2, 1.2, { snap: true }, (c, o, w, h, s) => {
  stallTable(c, w, h); rect(c, -w / 2 + 0.05, -h / 2 + 0.05, w - 0.1, h - 0.1, '#3a2a5a', 0);
  const kinds: Kind[] = ['gem', 'coin', 'potion', 'book', 'scroll'];
  for (let i = 0; i < 12; i++) item(c, -w / 2 + 0.2 + (i % 6) * ((w - 0.4) / 5), i < 6 ? -h * 0.2 : h * 0.2, 0.09, kinds[Math.floor(H(s, i) * kinds.length)], s, i);
});
add('Market', 'parasol_stall', 'Parasol stall', 2.5, 2.5, { snap: true, layer: 4, colors: CLOTH }, (c, o, w, h) => {
  const r = Math.min(w, h) / 2, col = o.color ?? CLOTH[0], n = 8;
  disc(c, 0.15, 0.2, r, SH, 0);
  for (let i = 0; i < n; i++) { const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU; poly(c, [0, 0, Math.cos(a0) * r, Math.sin(a0) * r, Math.cos(a1) * r, Math.sin(a1) * r], i % 2 ? '#efe8da' : col, 0); }
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU; seg(c, 0, 0, Math.cos(a) * r, Math.sin(a) * r, 'rgba(0,0,0,0.25)', 0.02); }
  c.beginPath(); for (let i = 0; i <= n; i++) { const a = (i / n) * TAU; if (i) c.lineTo(Math.cos(a) * r, Math.sin(a) * r); else c.moveTo(Math.cos(a) * r, Math.sin(a) * r); } stroke(c, 0.05);
  disc(c, 0, 0, 0.08, '#5a3a20', 0.02);
});
add('Market', 'awning', 'Awning', 3, 1.2, { layer: 4, colors: CLOTH }, (c, o, w, h) => { awning(c, w, h, o.color ?? CLOTH[1], Math.max(2, Math.round(w * 2))); });
const CRATES: [string, string, Kind][] = [
  ['crate_apples', 'Crate of apples', 'apple'], ['crate_oranges', 'Crate of oranges', 'orange'], ['crate_lemons', 'Crate of lemons', 'lemon'],
  ['crate_cabbage', 'Crate of cabbages', 'cabbage'], ['crate_potatoes', 'Crate of potatoes', 'potato'], ['crate_carrots', 'Crate of carrots', 'carrot'],
  ['crate_grapes', 'Crate of grapes', 'grape'], ['crate_fish', 'Crate of fish', 'fish'], ['crate_tomatoes', 'Crate of tomatoes', 'tomato'],
  ['crate_onions', 'Crate of onions', 'onion'], ['crate_mushrooms', 'Crate of mushrooms', 'mushroom'], ['crate_ore', 'Crate of ore', 'ore'],
];
for (const [type, name, kind] of CRATES) add('Market', type, name, 0.9, 0.7, {}, (c, o, w, h, s) => crateOf(c, -w / 2, -h / 2, w, h, kind, s));
const BASKETS: [string, string, Kind | null][] = [
  ['basket_apples', 'Basket of apples', 'apple'], ['basket_eggs', 'Basket of eggs', 'egg'], ['basket_flowers', 'Basket of flowers', 'flower'],
  ['basket_herbs', 'Basket of herbs', 'herb'], ['basket_mushrooms', 'Basket of mushrooms', 'mushroom'], ['basket', 'Empty basket', null],
];
for (const [type, name, kind] of BASKETS) add('Market', type, name, 0.6, 0.6, {}, (c, o, w, h, s) => basketOf(c, 0, 0, Math.min(w, h) / 2, kind, s));
add('Market', 'barrel_apples', 'Barrel of apples', 0.6, 0.6, {}, (c, o, w, h, s) => {
  const r = Math.min(w, h) / 2; barrelTop(c, r, '#3a2a1a'); c.save(); c.beginPath(); c.arc(0, 0, r * 0.75, 0, TAU); c.clip(); pile(c, -r * 0.8, -r * 0.8, r * 1.6, r * 1.6, 'apple', s); c.restore();
});
add('Market', 'barrel_water', 'Barrel of water', 0.6, 0.6, {}, (c, o, w, h) => { const r = Math.min(w, h) / 2; barrelTop(c, r, '#3a6a8a'); disc(c, -r * 0.25, -r * 0.2, r * 0.15, 'rgba(255,255,255,0.35)', 0); });
add('Market', 'barrel_pickles', 'Barrel of pickles', 0.6, 0.6, {}, (c, o, w, h, s) => {
  const r = Math.min(w, h) / 2; barrelTop(c, r, '#6a7a3a');
  for (let i = 0; i < 7; i++) { const a = H(s, i) * TAU, d = r * 0.5 * H(s, i, 1); ell(c, Math.cos(a) * d, Math.sin(a) * d, r * 0.2, r * 0.09, a, '#4a6a2a', 0.01); }
});
add('Market', 'sack_open', 'Open grain sack', 0.7, 0.7, {}, (c, o, w, h, s) => {
  const r = Math.min(w, h) / 2; shadowEll(c, 0, 0, r, r, 0.05);
  c.beginPath(); for (let i = 0; i <= 12; i++) { const a = (i / 12) * TAU, k = 0.85 + 0.15 * H(s, i % 12); if (i) c.lineTo(Math.cos(a) * r * k, Math.sin(a) * r * k); else c.moveTo(Math.cos(a) * r * k, Math.sin(a) * r * k); }
  c.closePath(); c.fillStyle = '#c8b08a'; c.fill(); stroke(c, 0.03);
  disc(c, 0, 0, r * 0.6, '#e0c888', 0.015); for (let i = 0; i < 20; i++) { const a = H(s, i, 4) * TAU, d = r * 0.5 * H(s, i, 5); disc(c, Math.cos(a) * d, Math.sin(a) * d, 0.015, '#b89a58', 0); }
});
add('Market', 'spice_sacks', 'Spice sacks', 1.2, 0.8, {}, (c, o, w, h, s) => {
  const cols = ['#c8402a', '#e8a030', '#d8c040', '#8a5a2a', '#5a8a3a'];
  for (let i = 0; i < 3; i++) {
    const x = -w / 2 + (i + 0.5) * (w / 3), y = (i % 2 ? 0.1 : -0.1) * h, r = Math.min(w / 3, h) * 0.45;
    shadowEll(c, x, y, r, r, 0.05); disc(c, x, y, r, '#c8b088', 0.025); disc(c, x, y, r * 0.72, cols[Math.floor(H(s, i) * cols.length)], 0); ring(c, x, y, r * 0.85, 'rgba(90,60,30,0.4)', 0.02);
  }
});
add('Market', 'melons', 'Melon pile', 0.9, 0.9, {}, (c, o, w, h, s) => { pile(c, -w / 2, -h / 2, w, h, 'melon', s); });
add('Market', 'pumpkins', 'Pumpkin pile', 1, 1, {}, (c, o, w, h, s) => { pile(c, -w / 2, -h / 2, w, h, 'pumpkin', s); });
add('Market', 'pottery_pile', 'Pottery pile', 0.9, 0.9, {}, (c, o, w, h, s) => { pile(c, -w / 2, -h / 2, w, h, 'pot', s); });
add('Market', 'chicken_cage', 'Chicken coop crate', 0.8, 0.8, {}, (c, o, w, h, s) => {
  shadowRect(c, w, h); rect(c, -w / 2, -h / 2, w, h, '#a07a48', 0.04); rect(c, -w / 2 + 0.06, -h / 2 + 0.06, w - 0.12, h - 0.12, '#c8a85a', 0);
  for (let i = 0; i < 2; i++) { c.save(); c.translate((i - 0.5) * w * 0.35, (H(s, i) - 0.5) * h * 0.3); c.rotate(H(s, i, 1) * TAU); beast(c, 0.28, 0.35, '#f0ece0', { head: '#f0ece0', snout: '#e8a030' }); c.restore(); }
  lines(c, -w / 2 + 0.06, -h / 2 + 0.06, w - 0.12, h - 0.12, 0.1, true, 0.6, 0.02);
});
add('Market', 'animal_pen', 'Animal pen', 4, 3, { snap: true, layer: 0 }, (c, o, w, h) => {
  rect(c, -w / 2, -h / 2, w, h, 'rgba(120,90,50,0.35)', 0);
  c.beginPath(); c.rect(-w / 2, -h / 2, w, h); stroke(c, 0.08, '#5c3e24');
  c.fillStyle = '#3e2a18';
  for (let x = -w / 2; x <= w / 2 + 0.01; x += 0.75) { c.fillRect(x - 0.08, -h / 2 - 0.08, 0.16, 0.16); c.fillRect(x - 0.08, h / 2 - 0.08, 0.16, 0.16); }
  for (let y = -h / 2; y <= h / 2 + 0.01; y += 0.75) { c.fillRect(-w / 2 - 0.08, y - 0.08, 0.16, 0.16); c.fillRect(w / 2 - 0.08, y - 0.08, 0.16, 0.16); }
  seg(c, -0.5, h / 2, 0.5, h / 2, '#a8804e', 0.1);
});
add('Market', 'handcart', 'Handcart', 1, 1.6, {}, (c, o, w, h, s) => {
  shadowRect(c, w, h * 0.7, 0.04);
  rect(c, -w / 2 - 0.06, -h * 0.1, 0.1, h * 0.35, '#2a2420', 0.02); rect(c, w / 2 - 0.04, -h * 0.1, 0.1, h * 0.35, '#2a2420', 0.02);
  rect(c, -w / 2, -h / 2, w, h * 0.68, '#8c6239', 0.04); rect(c, -w / 2 + 0.06, -h / 2 + 0.06, w - 0.12, h * 0.68 - 0.12, '#5a3e22', 0);
  c.save(); c.beginPath(); c.rect(-w / 2 + 0.06, -h / 2 + 0.06, w - 0.12, h * 0.68 - 0.12); c.clip(); pile(c, -w / 2 + 0.06, -h / 2 + 0.06, w - 0.12, h * 0.68 - 0.12, (['apple', 'cabbage', 'potato', 'pumpkin'] as Kind[])[Math.floor(H(s, 1) * 4)], s); c.restore();
  seg(c, -w * 0.2, h * 0.18, -w * 0.2, h / 2, '#6b4627', 0.06); seg(c, w * 0.2, h * 0.18, w * 0.2, h / 2, '#6b4627', 0.06);
});
add('Market', 'covered_wagon', 'Covered wagon', 2, 4, { colors: ['#e8e0cc', '#d8c8a0', '#c8b890'] }, (c, o, w, h) => {
  const col = o.color ?? '#e8e0cc';
  shadowRect(c, w, h * 0.8, 0.2, 0.18);
  for (const y of [-0.28, 0.28]) { rect(c, -w / 2 - 0.08, y * h - 0.3, 0.14, 0.6, '#2a2420', 0.02); rect(c, w / 2 - 0.06, y * h - 0.3, 0.14, 0.6, '#2a2420', 0.02); }
  rect(c, -w / 2, -h * 0.42, w, h * 0.8, '#6b4627', 0.04);
  rrect(c, -w / 2 + 0.05, -h * 0.4, w - 0.1, h * 0.76, 0.3, col, 0.04);
  for (let i = 1; i < 5; i++) seg(c, -w / 2 + 0.05, -h * 0.4 + (i * h * 0.76) / 5, w / 2 - 0.05, -h * 0.4 + (i * h * 0.76) / 5, 'rgba(0,0,0,0.2)', 0.03);
  c.save(); c.beginPath(); c.rect(-w / 2, -h * 0.4, w, h * 0.76); c.clip(); c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(0, -h * 0.4, w / 2, h * 0.76); c.restore();
  seg(c, 0, h * 0.38, 0, h / 2, '#6b4627', 0.08);
});
add('Market', 'wheelbarrow', 'Wheelbarrow', 0.7, 1.3, {}, (c, o, w, h, s) => {
  shadowRect(c, w, h * 0.7, 0.1, 0.05);
  seg(c, -w * 0.3, 0, -w * 0.35, h / 2, '#6b4627', 0.05); seg(c, w * 0.3, 0, w * 0.35, h / 2, '#6b4627', 0.05);
  rect(c, -0.05, -h / 2, 0.1, 0.2, '#2a2420', 0.015);
  poly(c, [-w * 0.45, -h * 0.35, w * 0.45, -h * 0.35, w * 0.38, h * 0.15, -w * 0.38, h * 0.15], '#7a7a82', 0.035);
  poly(c, [-w * 0.36, -h * 0.3, w * 0.36, -h * 0.3, w * 0.3, h * 0.1, -w * 0.3, h * 0.1], '#5a5a62', 0);
  if (H(s, 1) > 0.4) { c.save(); c.beginPath(); c.rect(-w * 0.32, -h * 0.28, w * 0.64, h * 0.36); c.clip(); pile(c, -w * 0.32, -h * 0.28, w * 0.64, h * 0.36, 'potato', s); c.restore(); }
});
add('Market', 'wares_rug', 'Rug with wares', 2, 1.5, { layer: 0, colors: FABRIC }, (c, o, w, h, s) => {
  const col = o.color ?? FABRIC[0];
  rect(c, -w / 2, -h / 2, w, h, col, 0); c.beginPath(); c.rect(-w / 2 + 0.12, -h / 2 + 0.12, w - 0.24, h - 0.24); stroke(c, 0.06, shade(col, 0.35));
  const kinds: Kind[] = ['pot', 'cloth', 'gem', 'bottle'];
  for (let i = 0; i < 8; i++) item(c, -w / 2 + 0.35 + (i % 4) * ((w - 0.7) / 3), i < 4 ? -h * 0.2 : h * 0.2, 0.12, kinds[Math.floor(H(s, i) * kinds.length)], s, i);
});
add('Market', 'bunting', 'Bunting', 4, 0.4, { layer: 3 }, (c, o, w, h, s) => {
  c.beginPath(); c.moveTo(-w / 2, -h * 0.3); c.quadraticCurveTo(0, h * 0.1, w / 2, -h * 0.3); stroke(c, 0.02, '#d8d0c0');
  const n = Math.max(2, Math.round(w / 0.3));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, x = -w / 2 + t * w, y = -h * 0.3 + 4 * t * (1 - t) * h * 0.2;
    poly(c, [x - 0.1, y, x + 0.1, y, x, y + h * 0.6], CLOTH[(i + Math.floor(H(s, 1) * 6)) % CLOTH.length], 0.01);
  }
});
add('Market', 'street_lamp', 'Street lamp', 0.5, 0.5, { layer: 3 }, (c, o, w, h) => {
  const r = Math.min(w, h) / 2; glow(c, 0, 0, 2.4, 0.4);
  disc(c, 0, 0, r * 0.75, '#2a2826', 0.03); disc(c, 0, 0, r * 0.5, '#ffe08a', 0.02); disc(c, 0, 0, r * 0.2, '#fff6d0', 0);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + Math.PI / 4; seg(c, 0, 0, Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7, '#2a2826', 0.025); }
});
add('Market', 'coin_purse', 'Coin purse', 0.3, 0.3, { layer: 2 }, (c, o, w, h) => {
  const r = Math.min(w, h) / 2; disc(c, 0, r * 0.1, r * 0.8, '#7a4a2a', 0.02); seg(c, -r * 0.3, -r * 0.5, r * 0.3, -r * 0.5, '#d8b84a', 0.03); coin(c, r * 0.7, r * 0.6, r * 0.25);
});
add('Market', 'market_well', 'Market fountain', 2, 2, { snap: true }, (c, o, w, h) => {
  const r = Math.min(w, h) / 2; disc(c, 0.1, 0.12, r, SH, 0);
  disc(c, 0, 0, r, LSTONE, 0.05); disc(c, 0, 0, r * 0.8, '#4b8ab5', 0.03);
  disc(c, 0, 0, r * 0.3, LSTONE, 0.03); disc(c, 0, 0, r * 0.15, '#9fd0ee', 0);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; c.beginPath(); c.arc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.08, 0, TAU); stroke(c, 0.015, 'rgba(255,255,255,0.5)'); }
});

// =====================================================================
// Animals
// =====================================================================
add('Animals', 'cow', 'Cow', 1, 2, { natural: true }, (c, o, w, h) => { beast(c, w, h, '#efe8dc', { spots: '#2a2420', tail: '#2a2420', ears: true, horns: '#d8c8a8', snout: '#d8a8a0' }); });
add('Animals', 'pig', 'Pig', 0.6, 1, { natural: true }, (c, o, w, h) => { beast(c, w, h, '#e8b0a8', { ears: true, snout: '#d89088', tail: '#d89088' }); });
add('Animals', 'sheep', 'Sheep', 0.6, 0.9, { natural: true }, (c, o, w, h) => { beast(c, w, h, '#efeae0', { head: '#2a2420', wool: true, ears: true }); });
add('Animals', 'goat', 'Goat', 0.5, 0.85, { natural: true }, (c, o, w, h) => { beast(c, w, h, '#d8d0c0', { horns: '#8a7a6a', ears: true, tail: '#d8d0c0' }); });
add('Animals', 'chicken', 'Chicken', 0.3, 0.38, { natural: true }, (c, o, w, h, s) => { beast(c, w, h, H(s, 1) > 0.5 ? '#f0ece0' : '#a86a3a', { snout: '#e8a030' }); disc(c, 0, -h * 0.4, w * 0.08, '#d03a2a', 0); });
add('Animals', 'dog', 'Dog', 0.45, 0.9, { natural: true }, (c, o, w, h, s) => { beast(c, w, h, ['#a8804e', '#3a2a1a', '#d8c8a8'][Math.floor(H(s, 1) * 3)], { ears: true, tail: '#7a5a3a', snout: '#2a2420' }); });
add('Animals', 'cat', 'Cat', 0.3, 0.55, { natural: true }, (c, o, w, h, s) => { beast(c, w, h, ['#e09a4a', '#5a5a5a', '#2a2420', '#efe8dc'][Math.floor(H(s, 1) * 4)], { ears: true, tail: '#7a7a7a' }); });
add('Animals', 'donkey', 'Donkey', 0.8, 1.8, { natural: true }, (c, o, w, h) => { beast(c, w, h, '#8a8078', { ears: true, tail: '#3a3430', mane: '#3a3430', snout: '#d8d0c8' }); });
add('Animals', 'ox', 'Ox', 1.1, 2.1, { natural: true }, (c, o, w, h) => { beast(c, w, h, '#7a4a2a', { horns: '#e8dcc8', ears: true, tail: '#3a2418', snout: '#5a3a22' }); });
add('Animals', 'duck', 'Duck', 0.25, 0.35, { natural: true }, (c, o, w, h) => { beast(c, w, h, '#a8906a', { head: '#2a6a3a', snout: '#e8a030' }); });
add('Animals', 'deer', 'Deer', 0.6, 1.4, { natural: true }, (c, o, w, h) => { beast(c, w, h, '#a86a3a', { horns: '#d8c8a8', ears: true, tail: '#efe8dc' }); });
add('Animals', 'wolf', 'Wolf', 0.5, 1.1, { natural: true }, (c, o, w, h) => { beast(c, w, h, '#7a7a78', { ears: true, tail: '#5a5a58', snout: '#4a4a48' }); });
add('Animals', 'bear', 'Bear', 1, 1.7, { natural: true }, (c, o, w, h) => { beast(c, w, h, '#4a3020', { ears: true, snout: '#7a5a40' }); });
add('Animals', 'rat', 'Rat', 0.2, 0.35, { natural: true }, (c, o, w, h) => { beast(c, w, h, '#6a625a', { ears: true, tail: '#c8a8a0' }); });

// =====================================================================
// Kitchen
// =====================================================================
add('Kitchen', 'butcher_block', 'Butcher block', 1.2, 0.8, {}, (c, o, w, h, s) => {
  woodTop(c, w, h, '#b08050'); for (let i = 0; i < 6; i++) seg(c, -w / 2 + 0.02, -h / 2 + (i * h) / 6, w / 2 - 0.02, -h / 2 + (i * h) / 6, 'rgba(0,0,0,0.12)', 0.02);
  item(c, -w * 0.15, 0, Math.min(0.2, h * 0.3), 'meat', s, 1);
  poly(c, [w * 0.15, -h * 0.25, w * 0.35, -h * 0.25, w * 0.35, h * 0.0, w * 0.15, h * 0.0], STEEL, 0.015); rect(c, w * 0.22, h * 0.0, 0.07, 0.2, XWOOD, 0.01);
});
add('Kitchen', 'spice_rack', 'Spice rack', 1.4, 0.3, {}, (c, o, w, h, s) => {
  shelf(c, w, h, (x, y, iw, ih) => { const n = Math.floor(iw / 0.14); for (let i = 0; i < n; i++) { disc(c, x + (i + 0.5) * (iw / n), y + ih / 2, Math.min(0.055, ih * 0.45), ['#c8402a', '#e8a030', '#d8c040', '#8a5a2a', '#5a8a3a'][Math.floor(H(s, i) * 5)], 0.012); } });
});
add('Kitchen', 'hanging_pots', 'Hanging pots', 1.4, 0.45, { layer: 3 }, (c, o, w, h) => {
  seg(c, -w / 2, -h * 0.3, w / 2, -h * 0.3, '#2a2420', 0.04);
  for (let i = 0; i < 4; i++) { const x = -w * 0.36 + i * w * 0.24, r = Math.min(w * 0.1, h * 0.32) * (i % 2 ? 0.8 : 1); seg(c, x, -h * 0.3, x, h * 0.05 - r, '#2a2420', 0.015); disc(c, x, h * 0.1, r, i % 2 ? COPPER : '#3a3836', 0.02); disc(c, x, h * 0.1, r * 0.65, shade(i % 2 ? COPPER : '#3a3836', -0.2), 0); }
});
add('Kitchen', 'stone_sink', 'Stone sink', 1, 0.6, {}, (c, o, w, h) => {
  shadowRect(c, w, h, 0.05); rrect(c, -w / 2, -h / 2, w, h, 0.05, LSTONE, 0.045); rrect(c, -w / 2 + 0.1, -h / 2 + 0.1, w - 0.2, h - 0.2, 0.06, '#7a9aaa', 0.02);
  disc(c, 0, 0, 0.03, '#2a2a2a', 0); rect(c, -0.04, -h / 2 - 0.05, 0.08, 0.18, IRON, 0.015);
});
add('Kitchen', 'cutting_board', 'Cutting board', 0.6, 0.4, { layer: 2 }, (c, o, w, h, s) => {
  rrect(c, -w / 2, -h / 2, w, h, 0.05, '#c8a070', 0.025); item(c, -w * 0.15, 0, Math.min(0.1, h * 0.25), 'carrot', s, 1); item(c, w * 0.05, h * 0.1, Math.min(0.08, h * 0.2), 'onion', s, 2);
  rect(c, w * 0.15, -h * 0.25, w * 0.25, 0.04, STEEL, 0.008); rect(c, w * 0.38, -h * 0.27, w * 0.1, 0.08, XWOOD, 0);
});
add('Kitchen', 'pie', 'Pie', 0.4, 0.4, { layer: 2 }, (c, o, w, h) => {
  const r = Math.min(w, h) / 2; disc(c, 0, 0, r, '#b8864a', 0.02); disc(c, 0, 0, r * 0.82, '#d8a860', 0);
  c.strokeStyle = '#a87a40'; c.lineWidth = 0.02; c.beginPath(); for (let k = -2; k <= 2; k++) { c.moveTo(k * r * 0.3, -r * 0.75); c.lineTo(k * r * 0.3, r * 0.75); c.moveTo(-r * 0.75, k * r * 0.3); c.lineTo(r * 0.75, k * r * 0.3); } c.stroke();
});
add('Kitchen', 'bread_loaves', 'Bread loaves', 0.6, 0.4, { layer: 2 }, (c, o, w, h, s) => { pile(c, -w / 2, -h / 2, w, h, 'bread', s); });
add('Kitchen', 'butter_churn', 'Butter churn', 0.5, 0.5, {}, (c, o, w, h) => {
  const r = Math.min(w, h) / 2; disc(c, 0.04, 0.05, r, SH, 0); disc(c, 0, 0, r, '#a07a48', 0.035); ring(c, 0, 0, r * 0.8, IRON, 0.03); disc(c, 0, 0, r * 0.55, '#8a6a40', 0); disc(c, 0, 0, r * 0.15, '#5a3a20', 0.015);
});
add('Kitchen', 'cheese_wheels', 'Cheese wheels', 0.8, 0.8, {}, (c, o, w, h, s) => { pile(c, -w / 2, -h / 2, w, h, 'cheese', s); });
add('Kitchen', 'pantry_shelf', 'Pantry shelf', 2, 0.5, {}, (c, o, w, h, s) => {
  const kinds: Kind[] = ['pot', 'cheese', 'bread', 'onion', 'bottle'];
  shelf(c, w, h, (x, y, iw, ih) => { for (let i = 0; i < 4; i++) pile(c, x + (i * iw) / 4, y, iw / 4, ih, kinds[Math.floor(H(s, i) * kinds.length)], s, i); }, DWOOD);
});
add('Kitchen', 'washtub', 'Washing tub', 0.8, 0.8, {}, (c, o, w, h, s) => { const r = Math.min(w, h) / 2; barrelTop(c, r, '#8ab0c0'); pile(c, -r * 0.4, -r * 0.4, r * 0.8, r * 0.8, 'pot', s); });
add('Kitchen', 'spit_roast', 'Spit roast', 1.6, 0.8, { layer: 3 }, (c, o, w, h) => {
  glow(c, 0, 0, w * 0.8, 0.35);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; disc(c, Math.cos(a) * w * 0.25, Math.sin(a) * h * 0.38, 0.07, '#77726a', 0.015); }
  disc(c, 0, 0, Math.min(w * 0.2, h * 0.3), '#e0601c', 0); disc(c, 0, 0, Math.min(w * 0.1, h * 0.15), '#ffd04a', 0);
  seg(c, -w / 2, 0, w / 2, 0, '#5a5856', 0.04); for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) seg(c, x, -h * 0.25, x, h * 0.25, '#3a2a1e', 0.05);
  ell(c, 0, 0, w * 0.2, h * 0.2, 0, '#a8642a', 0.025); ell(c, -w * 0.03, -h * 0.03, w * 0.12, h * 0.12, 0, '#c87a3a', 0);
});
add('Kitchen', 'water_barrel', 'Water barrel', 0.7, 0.7, {}, (c, o, w, h) => { const r = Math.min(w, h) / 2; barrelTop(c, r, '#3a6a8a'); ell(c, r * 0.15, r * 0.1, r * 0.35, r * 0.15, 0.4, '#8a5a32', 0.015); });

// =====================================================================
// Workshop
// =====================================================================
add('Workshop', 'lumber_stack', 'Lumber stack', 2.5, 0.8, {}, (c, o, w, h, s) => {
  shadowRect(c, w, h, 0.02);
  const n = Math.max(2, Math.round(h / 0.16));
  for (let i = 0; i < n; i++) { const y = -h / 2 + (i * h) / n, off = (H(s, i) - 0.5) * 0.2; rect(c, -w / 2 + off + 0.1, y, w - 0.2, h / n - 0.01, shade('#c8a070', (H(s, i, 1) - 0.5) * 0.2), 0.015); }
});
add('Workshop', 'sawhorse', 'Sawhorse', 1.2, 0.45, {}, (c, o, w, h) => {
  for (const x of [-w * 0.35, w * 0.35]) { seg(c, x - 0.08, -h / 2, x + 0.08, h / 2, XWOOD, 0.05); seg(c, x + 0.08, -h / 2, x - 0.08, h / 2, XWOOD, 0.05); }
  shadowRect(c, w, h * 0.3, 0.02, 0.05); rect(c, -w / 2, -h * 0.12, w, h * 0.24, '#a8804e', 0.03);
});
add('Workshop', 'tool_rack', 'Tool rack', 2, 0.4, {}, (c, o, w, h) => {
  shadowRect(c, w, h); rect(c, -w / 2, -h / 2, w, h * 0.35, '#a8804e', 0.03);
  let x = -w / 2 + 0.2, i = 0;
  while (x < w / 2 - 0.1) {
    seg(c, x, -h * 0.35, x, h * 0.4, '#7a5230', 0.04);
    if (i % 3 === 0) poly(c, [x - 0.1, h * 0.25, x + 0.1, h * 0.25, x + 0.08, h * 0.45, x - 0.08, h * 0.45], STEEL, 0.012);
    else if (i % 3 === 1) rect(c, x - 0.08, h * 0.25, 0.16, 0.08, '#5a5856', 0.012);
    else poly(c, [x, h * 0.2, x + 0.12, h * 0.3, x, h * 0.4], STEEL, 0.012);
    x += 0.3; i++;
  }
});
add('Workshop', 'bellows', 'Bellows', 1, 0.6, {}, (c, o, w, h) => {
  shadowRect(c, w, h, 0.1); poly(c, [-w / 2, -h / 2, w * 0.2, -h * 0.2, w * 0.2, h * 0.2, -w / 2, h / 2], '#6a3a22', 0.035);
  for (let i = 1; i < 4; i++) seg(c, -w / 2 + i * w * 0.15, -h / 2 + i * h * 0.08, -w / 2 + i * w * 0.15, h / 2 - i * h * 0.08, 'rgba(0,0,0,0.3)', 0.02);
  rect(c, w * 0.2, -0.05, w * 0.3, 0.1, BRASS, 0.015);
});
add('Workshop', 'coal_pile', 'Coal pile', 1, 1, {}, (c, o, w, h, s) => {
  const r = Math.min(w, h) / 2; c.fillStyle = 'rgba(20,18,16,0.6)'; c.beginPath(); c.ellipse(0, 0, r, r * 0.9, 0, 0, TAU); c.fill();
  for (let i = 0; i < 30; i++) { const a = H(s, i) * TAU, d = r * 0.85 * Math.sqrt(H(s, i, 1)); item(c, Math.cos(a) * d, Math.sin(a) * d, 0.07, 'coal', s, i); }
});
add('Workshop', 'mine_cart', 'Mine cart', 1, 1.4, {}, (c, o, w, h, s) => {
  shadowRect(c, w, h, 0.05);
  for (const y of [-0.3, 0.3]) { rect(c, -w / 2 - 0.05, y * h - 0.12, 0.1, 0.24, '#2a2826', 0.015); rect(c, w / 2 - 0.05, y * h - 0.12, 0.1, 0.24, '#2a2826', 0.015); }
  rrect(c, -w / 2 + 0.03, -h / 2, w - 0.06, h, 0.05, '#5a5856', 0.045); rect(c, -w / 2 + 0.1, -h / 2 + 0.08, w - 0.2, h - 0.16, '#3a3836', 0);
  c.save(); c.beginPath(); c.rect(-w / 2 + 0.1, -h / 2 + 0.08, w - 0.2, h - 0.16); c.clip(); pile(c, -w / 2 + 0.1, -h / 2 + 0.08, w - 0.2, h - 0.16, 'ore', s); c.restore();
});
add('Workshop', 'stone_blocks', 'Cut stone blocks', 1.5, 1, {}, (c, o, w, h, s) => {
  shadowRect(c, w, h, 0.02);
  for (let i = 0; i < 4; i++) { const x = -w / 2 + (i % 2) * (w / 2), y = -h / 2 + Math.floor(i / 2) * (h / 2); rect(c, x + 0.02, y + 0.02, w / 2 - 0.04, h / 2 - 0.04, shade(LSTONE, (H(s, i) - 0.5) * 0.2), 0.03); }
});
add('Workshop', 'rope_coil', 'Rope coil', 0.6, 0.6, {}, (c, o, w, h) => {
  const r = Math.min(w, h) / 2; disc(c, 0.04, 0.05, r, SH, 0); disc(c, 0, 0, r, '#c8a870', 0.025);
  for (let i = 1; i < 5; i++) ring(c, 0, 0, r * i * 0.2, 'rgba(110,80,40,0.6)', 0.02);
});
add('Workshop', 'ladder', 'Ladder', 0.5, 2, {}, (c, o, w, h) => {
  shadowRect(c, w, h, 0, 0.05); rect(c, -w / 2, -h / 2, 0.07, h, '#a8804e', 0.015); rect(c, w / 2 - 0.07, -h / 2, 0.07, h, '#a8804e', 0.015);
  for (let y = -h / 2 + 0.15; y < h / 2; y += 0.3) rect(c, -w / 2 + 0.07, y, w - 0.14, 0.05, '#a8804e', 0.012);
});
add('Workshop', 'wood_shavings', 'Wood shavings', 1, 0.7, { layer: 0 }, (c, o, w, h, s) => {
  for (let i = 0; i < 18; i++) { const x = (H(s, i) - 0.5) * w * 0.9, y = (H(s, i, 1) - 0.5) * h * 0.9; c.beginPath(); c.arc(x, y, 0.04 + 0.04 * H(s, i, 2), H(s, i, 3) * TAU, H(s, i, 3) * TAU + 3.5); stroke(c, 0.02, '#d8b880'); }
});
add('Workshop', 'barrel_stack', 'Barrel stack', 1.4, 1.4, {}, (c, o, w, h, s) => {
  const r = Math.min(w, h) * 0.24;
  for (const [x, y] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) { c.save(); c.translate(x * w, y * h); barrelTop(c, r, H(s, Math.round(x * 10 + y * 3)) > 0.5 ? null : null); ring(c, 0, 0, r * 0.3, '#5a3a20', 0.03); c.restore(); }
});

// =====================================================================
// Town
// =====================================================================
add('Town', 'stone_bench', 'Stone bench', 2, 0.6, {}, (c, o, w, h) => {
  shadowRect(c, w, h, 0.04); rrect(c, -w / 2, -h / 2, w, h, 0.05, LSTONE, 0.045); rrect(c, -w / 2 + 0.08, -h / 2 + 0.08, w - 0.16, h - 0.16, 0.04, '#c8c0b2', 0);
  seg(c, -w * 0.15, -h * 0.1, w * 0.05, h * 0.05, 'rgba(0,0,0,0.2)', 0.015);
});
add('Town', 'stocks', 'Stocks', 1.4, 0.5, {}, (c, o, w, h) => {
  shadowRect(c, w, h * 0.5); rect(c, -w / 2, -h * 0.15, w, h * 0.3, '#7a5230', 0.04);
  for (const x of [-0.3, 0, 0.3]) disc(c, x * w, 0, x === 0 ? 0.1 : 0.06, '#2a1a10', 0.015);
  for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) disc(c, x, 0, 0.08, XWOOD, 0.02);
});
add('Town', 'flower_bed', 'Flower bed', 2, 0.8, { layer: 0 }, (c, o, w, h, s) => {
  rrect(c, -w / 2, -h / 2, w, h, 0.1, '#5a4030', 0.04); rrect(c, -w / 2 + 0.06, -h / 2 + 0.06, w - 0.12, h - 0.12, 0.08, '#4a6a2a', 0);
  pile(c, -w / 2 + 0.08, -h / 2 + 0.08, w - 0.16, h - 0.16, 'flower', s);
});
add('Town', 'hedge', 'Hedge', 2, 0.6, { natural: false }, (c, o, w, h, s) => {
  shadowRect(c, w, h, h / 2, 0.1);
  for (let x = -w / 2 + h / 2; x <= w / 2 - h / 2 + 0.01; x += h * 0.45) { c.beginPath(); c.arc(x, 0, h / 2, 0, TAU); c.fillStyle = '#3a6a2e'; c.fill(); }
  c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, h / 2); stroke(c, 0.035, '#1d3a1a');
  for (let i = 0; i < Math.round(w * 4); i++) disc(c, -w / 2 + h * 0.4 + H(s, i) * (w - h * 0.8), (H(s, i, 1) - 0.6) * h * 0.5, h * 0.12, '#4f8a3a', 0);
});
add('Town', 'stone_wall', 'Stone wall segment', 3, 0.5, { snap: true }, (c, o, w, h, s) => {
  shadowRect(c, w, h, 0.02, 0.1);
  rect(c, -w / 2, -h / 2, w, h, '#7a7268', 0.05);
  let x = -w / 2, i = 0;
  while (x < w / 2) { const bw = 0.3 + H(s, i) * 0.35; rect(c, x + 0.02, -h / 2 + 0.03, Math.min(bw, w / 2 - x) - 0.04, h - 0.06, shade('#8d877d', (H(s, i, 1) - 0.5) * 0.25), 0.015); x += bw; i++; }
});
add('Town', 'gate', 'Wooden gate', 2, 0.4, { snap: true }, (c, o, w, h) => {
  for (const x of [-w / 2, w / 2]) rect(c, x - 0.15, -0.15, 0.3, 0.3, '#7a7268', 0.03);
  rect(c, -w / 2 + 0.15, -h * 0.25, w / 2 - 0.17, h * 0.5, '#7a5230', 0.03); rect(c, 0.02, -h * 0.25, w / 2 - 0.17, h * 0.5, '#7a5230', 0.03);
  lines(c, -w / 2 + 0.15, -h * 0.25, w - 0.3, h * 0.5, 0.15, true, 0.3); seg(c, -w / 2 + 0.2, 0, w / 2 - 0.2, 0, IRON, 0.03);
});
add('Town', 'bridge', 'Wooden bridge', 2, 4, { snap: true }, (c, o, w, h, s) => {
  c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(-w / 2 + 0.12, -h / 2 + 0.15, w, h);
  const n = Math.round(h / 0.3);
  for (let i = 0; i < n; i++) rect(c, -w / 2 + 0.1, -h / 2 + (i * h) / n, w - 0.2, h / n - 0.03, shade('#9c7448', (H(s, i) - 0.5) * 0.2), 0);
  rect(c, -w / 2, -h / 2, 0.12, h, '#5a3a20', 0.03); rect(c, w / 2 - 0.12, -h / 2, 0.12, h, '#5a3a20', 0.03);
  for (let y = -h / 2 + 0.1; y < h / 2; y += 1) { disc(c, -w / 2 + 0.06, y, 0.1, XWOOD, 0.02); disc(c, w / 2 - 0.06, y, 0.1, XWOOD, 0.02); }
});
add('Town', 'haystack', 'Haystack', 1.4, 1.4, { natural: true }, (c, o, w, h, s) => {
  const r = Math.min(w, h) / 2; disc(c, 0.12, 0.15, r, SH, 0); disc(c, 0, 0, r, '#c8a84a', 0.035, );
  for (let i = 0; i < 3; i++) disc(c, -r * 0.1 * i, -r * 0.1 * i, r * (0.75 - i * 0.22), shade('#d8b85a', i * 0.06), 0);
  for (let i = 0; i < 20; i++) { const a = H(s, i) * TAU, d = r * 0.9 * H(s, i, 1); seg(c, Math.cos(a) * d, Math.sin(a) * d, Math.cos(a) * d + 0.1, Math.sin(a) * d + 0.05, 'rgba(120,90,30,0.5)', 0.02); }
});
add('Town', 'scarecrow', 'Scarecrow', 1, 0.6, {}, (c, o, w, h) => {
  seg(c, -w / 2, 0, w / 2, 0, '#7a5230', 0.06);
  poly(c, [-w * 0.3, -h * 0.25, w * 0.3, -h * 0.25, w * 0.25, h * 0.35, -w * 0.25, h * 0.35], '#6a5a8a', 0.03);
  disc(c, 0, 0, Math.min(w, h) * 0.22, '#c8a84a', 0.025); disc(c, 0, 0, Math.min(w, h) * 0.14, '#8a6a3a', 0.015);
  for (const x of [-w / 2, w / 2]) { seg(c, x, 0, x + Math.sign(-x) * 0.05, -0.08, '#d8b85a', 0.02); seg(c, x, 0, x + Math.sign(-x) * 0.05, 0.08, '#d8b85a', 0.02); }
});
add('Town', 'windmill', 'Windmill', 4, 4, { snap: true, layer: 4 }, (c, o, w, h, s) => {
  const r = Math.min(w, h) * 0.22;
  disc(c, 0.3, 0.35, r, SH, 0); disc(c, 0, 0, r, '#a8a092', 0.06);
  for (let i = 0; i < 8; i++) { const a0 = (i / 8) * TAU, a1 = ((i + 1) / 8) * TAU; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, r * 0.85, a0, a1); c.closePath(); c.fillStyle = shade('#8e4a34', Math.sin(a0 + 0.8) * 0.25); c.fill(); }
  ring(c, 0, 0, r * 0.85, INK, 0.04);
  const L = Math.min(w, h) / 2 - 0.05, rot = H(s, 1) * Math.PI / 2;
  for (let i = 0; i < 4; i++) {
    c.save(); c.rotate(rot + (i * Math.PI) / 2);
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0.2, r * 0.3 + 0.15, L - 0.2, L * 0.22);
    seg(c, 0, 0, L, 0, XWOOD, 0.08);
    rect(c, r * 0.5, 0.03, L - r * 0.5, L * 0.22, '#e8dcc0', 0.03); lines(c, r * 0.5, 0.03, L - r * 0.5, L * 0.22, 0.25, true, 0.35, 0.02);
    c.restore();
  }
  disc(c, 0, 0, 0.14, XWOOD, 0.03);
});
add('Town', 'outhouse', 'Outhouse', 1.2, 1.2, { snap: true, layer: 4, colors: ROOFS }, (c, o, w, h) => { hipRoof(c, w, h, o.color ?? '#7a5236'); disc(c, 0, h * 0.3, 0.06, '#2a2420', 0); });
add('Town', 'shed', 'Shed', 2, 2, { snap: true, layer: 4, colors: ROOFS }, (c, o, w, h) => { hipRoof(c, w, h, o.color ?? ROOFS[4]); });
add('Town', 'cottage', 'Cottage', 3, 2.5, { snap: true, layer: 4, colors: ROOFS }, (c, o, w, h) => {
  hipRoof(c, w, h, o.color ?? ROOFS[3]); rect(c, w * 0.2 - 0.18, -h * 0.25 - 0.18, 0.36, 0.36, '#6d625a', 0.04);
});
add('Town', 'barn', 'Barn', 5, 4, { snap: true, layer: 4, colors: ['#8a3a2a', ...ROOFS] }, (c, o, w, h) => {
  hipRoof(c, w, h, o.color ?? '#8a3a2a');
  for (const f of [-0.25, 0.25]) { rect(c, f * w - 0.3, -0.3, 0.6, 0.6, '#5a4a3a', 0.03); lines(c, f * w - 0.3, -0.3, 0.6, 0.6, 0.12, true, 0.4); }
});
add('Town', 'longhouse', 'Longhouse', 7, 3, { snap: true, layer: 4, colors: ['#8a7a4a', ...ROOFS] }, (c, o, w, h) => {
  hipRoof(c, w, h, o.color ?? '#8a7a4a'); disc(c, 0, 0, 0.25, '#2a2420', 0.03); glow(c, 0, 0, 0.6, 0.15, '120,120,120');
});
add('Town', 'tavern_building', 'Tavern (building)', 5, 4, { snap: true, layer: 4, colors: ROOFS }, (c, o, w, h) => {
  hipRoof(c, w, h, o.color ?? ROOFS[1]);
  rect(c, -w * 0.3 - 0.25, -h * 0.25 - 0.25, 0.5, 0.5, '#6d625a', 0.04); disc(c, -w * 0.3, -h * 0.25, 0.12, '#2a2420', 0);
  rrect(c, -0.4, h / 2 - 0.05, 0.8, 0.35, 0.04, '#8b2c2c', 0.03); mug(c, 0, h / 2 + 0.12, 0.09);
});
add('Town', 'library_building', 'Library (building)', 6, 5, { snap: true, layer: 4, colors: ['#4f5d6e', ...ROOFS] }, (c, o, w, h) => {
  hipRoof(c, w, h, o.color ?? '#4f5d6e');
  disc(c, 0, 0, Math.min(w, h) * 0.18, '#a8c8d8', 0.05); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; seg(c, 0, 0, Math.cos(a) * Math.min(w, h) * 0.18, Math.sin(a) * Math.min(w, h) * 0.18, '#3a3c40', 0.03); }
});
add('Town', 'market_hall', 'Market hall (open)', 6, 4, { snap: true, layer: 0 }, (c, o, w, h) => {
  rect(c, -w / 2, -h / 2, w, h, 'rgba(160,150,135,0.5)', 0);
  for (let i = 0; i <= 3; i++) for (const y of [-h / 2 + 0.3, h / 2 - 0.3]) { const x = -w / 2 + 0.3 + (i * (w - 0.6)) / 3; disc(c, x + 0.06, y + 0.08, 0.28, SH, 0); disc(c, x, y, 0.28, LSTONE, 0.04); }
  c.beginPath(); c.rect(-w / 2, -h / 2, w, h); c.setLineDash([0.2, 0.15]); stroke(c, 0.04, 'rgba(0,0,0,0.4)'); c.setLineDash([]);
});

// =====================================================================
// Dungeon extras
// =====================================================================
add('Dungeon', 'cage', 'Cage', 1.2, 1.2, { snap: true }, (c, o, w, h) => {
  shadowRect(c, w, h, 0, 0.06);
  c.beginPath(); c.rect(-w / 2, -h / 2, w, h); stroke(c, 0.06, IRON);
  lines(c, -w / 2, -h / 2, w, h, 0.15, true, 0.9, 0.03); rect(c, -w / 2, -0.03, w, 0.06, '#2a2826', 0);
  c.globalAlpha = 0.9; lines(c, -w / 2, -h / 2, w, h, w / 2, false, 0.9, 0.05); c.globalAlpha = 1;
});
add('Dungeon', 'shackles', 'Wall shackles', 0.6, 0.4, {}, (c, o, w, h) => {
  disc(c, -w * 0.3, -h * 0.4, 0.04, IRON, 0.01); disc(c, w * 0.3, -h * 0.4, 0.04, IRON, 0.01);
  c.setLineDash([0.04, 0.02]); seg(c, -w * 0.3, -h * 0.4, -w * 0.3, h * 0.2, '#6a6866', 0.03); seg(c, w * 0.3, -h * 0.4, w * 0.3, h * 0.2, '#6a6866', 0.03); c.setLineDash([]);
  ring(c, -w * 0.3, h * 0.28, 0.08, '#5a5856', 0.04); ring(c, w * 0.3, h * 0.28, 0.08, '#5a5856', 0.04);
});
add('Dungeon', 'bones', 'Bones', 0.8, 0.8, { layer: 0, natural: true }, (c, o, w, h, s) => {
  for (let i = 0; i < 5; i++) { const x = (H(s, i) - 0.5) * w * 0.6, y = (H(s, i, 1) - 0.5) * h * 0.6, a = H(s, i, 2) * TAU, l = 0.15 + 0.15 * H(s, i, 3); c.save(); c.translate(x, y); c.rotate(a); seg(c, -l, 0, l, 0, '#e8e0c8', 0.04); for (const e of [-l, l]) { disc(c, e, -0.025, 0.03, '#e8e0c8', 0); disc(c, e, 0.025, 0.03, '#e8e0c8', 0); } c.restore(); }
  if (H(s, 9) > 0.4) { ell(c, w * 0.15, -h * 0.15, 0.1, 0.12, 0, '#e8e0c8', 0.015); disc(c, w * 0.12, -h * 0.13, 0.025, '#2a2420', 0); disc(c, w * 0.18, -h * 0.13, 0.025, '#2a2420', 0); }
});
add('Dungeon', 'skeleton', 'Skeleton', 0.7, 1.6, { layer: 0 }, (c, o, w, h) => {
  const B = '#e8e0c8';
  ell(c, 0, -h * 0.4, w * 0.15, h * 0.07, 0, B, 0.015); disc(c, -w * 0.05, -h * 0.4, 0.025, '#2a2420', 0); disc(c, w * 0.05, -h * 0.4, 0.025, '#2a2420', 0);
  seg(c, 0, -h * 0.33, 0, h * 0.05, B, 0.035);
  for (let i = 0; i < 4; i++) { const y = -h * 0.27 + i * h * 0.06; seg(c, -w * 0.18, y, w * 0.18, y, B, 0.02); }
  seg(c, -w * 0.2, -h * 0.29, -w * 0.4, h * 0.0, B, 0.03); seg(c, w * 0.2, -h * 0.29, w * 0.38, -h * 0.02, B, 0.03);
  ell(c, 0, h * 0.08, w * 0.17, h * 0.04, 0, B, 0.015);
  seg(c, -w * 0.1, h * 0.1, -w * 0.15, h * 0.45, B, 0.035); seg(c, w * 0.1, h * 0.1, w * 0.17, h * 0.45, B, 0.035);
});
add('Dungeon', 'portcullis', 'Portcullis', 1, 0.3, { snap: true }, (c, o, w, h) => {
  rect(c, -w / 2, -h * 0.15, w, h * 0.3, '#2a2826', 0.02);
  for (let x = -w / 2 + 0.08; x < w / 2; x += 0.16) disc(c, x, 0, 0.04, '#5a5856', 0.01);
});
add('Dungeon', 'lever', 'Lever', 0.4, 0.4, {}, (c, o, w, h) => {
  const r = Math.min(w, h) / 2; rect(c, -r * 0.5, -r * 0.3, r, r * 0.6, IRON, 0.02); seg(c, 0, 0, r * 0.6, -r * 0.9, '#7a5230', 0.04); disc(c, r * 0.6, -r * 0.9, 0.04, '#b83a3a', 0.01);
});
add('Dungeon', 'brazier', 'Brazier', 0.7, 0.7, { layer: 3 }, (c, o, w, h) => {
  const r = Math.min(w, h) / 2; glow(c, 0, 0, 2.2, 0.45);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU + Math.PI / 2; seg(c, 0, 0, Math.cos(a) * r, Math.sin(a) * r, IRON, 0.05); }
  disc(c, 0, 0, r * 0.72, '#2c2a28', 0.035); disc(c, 0, 0, r * 0.52, '#e0601c', 0); disc(c, 0, 0, r * 0.28, '#ffd04a', 0);
});
add('Dungeon', 'cobweb', 'Cobweb', 1.5, 1.5, { layer: 3 }, (c, o, w, h) => {
  c.strokeStyle = 'rgba(235,235,235,0.6)'; c.lineWidth = 0.012;
  const x0 = -w / 2, y0 = -h / 2, R = Math.min(w, h);
  c.beginPath(); for (let i = 0; i <= 6; i++) { const a = (i / 6) * (Math.PI / 2); c.moveTo(x0, y0); c.lineTo(x0 + Math.cos(a) * R, y0 + Math.sin(a) * R); } c.stroke();
  for (let k = 1; k <= 5; k++) { c.beginPath(); for (let i = 0; i <= 6; i++) { const a = (i / 6) * (Math.PI / 2), rr = (k / 5) * R * (i % 2 ? 0.92 : 1); if (i) c.lineTo(x0 + Math.cos(a) * rr, y0 + Math.sin(a) * rr); else c.moveTo(x0 + Math.cos(a) * rr, y0 + Math.sin(a) * rr); } c.stroke(); }
});
add('Dungeon', 'rubble', 'Rubble', 1.2, 1.2, { natural: true }, (c, o, w, h, s) => {
  for (let i = 0; i < 12; i++) { const x = (H(s, i) - 0.5) * w * 0.8, y = (H(s, i, 1) - 0.5) * h * 0.8, r = 0.06 + 0.12 * H(s, i, 2); c.fillStyle = SH; c.beginPath(); c.arc(x + 0.04, y + 0.05, r, 0, TAU); c.fill(); item(c, x, y, r, 'stone', s, i); }
});
add('Dungeon', 'pit', 'Pit', 1, 1, { snap: true, layer: 0 }, (c, o, w, h) => {
  const g = c.createRadialGradient(0, 0, 0, 0, 0, Math.min(w, h) * 0.5); g.addColorStop(0, '#000'); g.addColorStop(0.7, '#1a1612'); g.addColorStop(1, '#3a332c');
  c.beginPath(); c.roundRect(-w * 0.45, -h * 0.45, w * 0.9, h * 0.9, 0.12); c.fillStyle = g; c.fill(); stroke(c, 0.04);
});
add('Dungeon', 'urn', 'Urn', 0.5, 0.5, {}, (c, o, w, h) => {
  const r = Math.min(w, h) / 2; disc(c, 0.04, 0.05, r, SH, 0); disc(c, 0, 0, r, '#8a6a4a', 0.03); ring(c, 0, 0, r * 0.75, GOLD, 0.03); disc(c, 0, 0, r * 0.4, '#3a2a1a', 0.015);
});
add('Dungeon', 'treasure_pile', 'Treasure hoard', 1.4, 1.2, {}, (c, o, w, h, s) => {
  c.fillStyle = '#b8902a'; c.beginPath(); c.ellipse(0, 0, w / 2, h / 2, 0, 0, TAU); c.fill(); stroke(c, 0.03, '#7a5a1a');
  for (let i = 0; i < 50; i++) { const a = H(s, i) * TAU, d = Math.sqrt(H(s, i, 1)) * 0.9; coin(c, Math.cos(a) * d * w / 2, Math.sin(a) * d * h / 2, 0.06); }
  for (let i = 0; i < 6; i++) item(c, (H(s, i, 4) - 0.5) * w * 0.6, (H(s, i, 5) - 0.5) * h * 0.6, 0.07, 'gem', s, i);
  goblet(c, -w * 0.2, -h * 0.1, 0.1, GOLD);
});
add('Dungeon', 'idol', 'Idol', 0.8, 0.8, {}, (c, o, w, h) => {
  const r = Math.min(w, h) / 2; shadowRect(c, w, h, 0.05); rect(c, -r, -r, r * 2, r * 2, '#5a5248', 0.04);
  disc(c, 0, 0, r * 0.6, '#c8a030', 0.03); disc(c, -r * 0.2, -r * 0.1, r * 0.1, '#3ab86a', 0); disc(c, r * 0.2, -r * 0.1, r * 0.1, '#3ab86a', 0); seg(c, -r * 0.2, r * 0.25, r * 0.2, r * 0.25, '#6a4a10', 0.03);
});
add('Dungeon', 'secret_door', 'Secret door', 1, 1, { snap: true }, (c, o, w, h) => {
  rect(c, -w * 0.45, -0.14, w * 0.9, 0.28, '#5a544d', 0.02); c.setLineDash([0.06, 0.05]); c.beginPath(); c.rect(-w * 0.45, -0.14, w * 0.9, 0.28); stroke(c, 0.03, '#b83a3a'); c.setLineDash([]);
  c.font = `bold ${h * 0.3}px Georgia`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#b83a3a'; c.fillText('S', 0, 0.02);
});
add('Dungeon', 'torture_rack', 'Rack', 1, 2, { snap: true }, (c, o, w, h) => {
  shadowRect(c, w, h); rect(c, -w / 2, -h / 2, w, h, '#5a3a22', 0.05); rect(c, -w / 2 + 0.12, -h / 2 + 0.2, w - 0.24, h - 0.4, '#7a5230', 0.02);
  for (const y of [-h / 2 + 0.1, h / 2 - 0.1]) { seg(c, -w / 2 - 0.05, y, w / 2 + 0.05, y, '#3a2418', 0.1); disc(c, w / 2 + 0.08, y, 0.08, IRON, 0.02); }
  seg(c, -w * 0.2, -h / 2 + 0.1, -w * 0.2, -h * 0.3, '#c8b890', 0.02); seg(c, w * 0.2, -h / 2 + 0.1, w * 0.2, -h * 0.3, '#c8b890', 0.02);
});
add('Dungeon', 'well_dungeon', 'Bottomless shaft', 1.4, 1.4, { snap: true, layer: 0 }, (c, o, w, h, s) => {
  const r = Math.min(w, h) / 2;
  for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; disc(c, Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82, r * 0.22, shade(STONE, (H(s, i) - 0.5) * 0.3), 0.025); }
  const g = c.createRadialGradient(0, 0, 0, 0, 0, r * 0.7); g.addColorStop(0, '#000'); g.addColorStop(1, '#2a241e'); disc(c, 0, 0, r * 0.68, '#000', 0.02); c.fillStyle = g; c.beginPath(); c.arc(0, 0, r * 0.66, 0, TAU); c.fill();
});

// =====================================================================
// Furniture extras
// =====================================================================
add('Furniture', 'round_rug', 'Round rug', 2.5, 2.5, { layer: 0, colors: FABRIC }, (c, o, w, h) => {
  const r = Math.min(w, h) / 2, col = o.color ?? FABRIC[1];
  disc(c, 0, 0, r, col, 0); ring(c, 0, 0, r * 0.85, shade(col, 0.35), 0.08); ring(c, 0, 0, r * 0.7, shade(col, -0.3), 0.04);
  disc(c, 0, 0, r * 0.3, shade(col, 0.35), 0); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; disc(c, Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.06, shade(col, 0.35), 0); }
});
add('Furniture', 'runner_rug', 'Runner rug', 1, 4, { layer: 0, colors: FABRIC }, (c, o, w, h) => {
  const col = o.color ?? FABRIC[0]; rect(c, -w / 2, -h / 2, w, h, col, 0);
  c.beginPath(); c.rect(-w / 2 + 0.1, -h / 2 + 0.1, w - 0.2, h - 0.2); stroke(c, 0.05, shade(col, 0.35));
  for (let y = -h / 2 + 0.5; y < h / 2 - 0.3; y += 0.6) poly(c, [0, y - 0.2, w * 0.25, y, 0, y + 0.2, -w * 0.25, y], shade(col, 0.3), 0);
});
add('Furniture', 'pew', 'Pew', 3, 0.6, { snap: true }, (c, o, w, h) => {
  shadowRect(c, w, h, 0.03); rect(c, -w / 2, -h / 2, w, h * 0.3, '#5a3a20', 0.04); rect(c, -w / 2, -h / 2 + h * 0.3, w, h * 0.7, '#7c5530', 0.04); lines(c, -w / 2, -h / 2 + h * 0.3, w, h * 0.7, 0.12);
  for (const x of [-w / 2, w / 2 - 0.08]) rect(c, x, -h / 2, 0.08, h, '#4e3320', 0.02);
});
add('Furniture', 'long_table', 'Long table', 4, 1.2, { snap: true }, (c, o, w, h) => { woodTop(c, w, h); });
add('Furniture', 'small_table', 'Small table', 1, 1, {}, (c, o, w, h) => { woodTop(c, w, h, WOOD, 0.08); });
add('Furniture', 'cabinet', 'Cabinet', 1, 0.5, {}, (c, o, w, h) => {
  shadowRect(c, w, h); rect(c, -w / 2, -h / 2, w, h, '#6b4627', 0.05); rect(c, -w / 2 + 0.06, -h / 2 + 0.06, w - 0.12, h - 0.12, '#7d5631', 0);
  seg(c, 0, -h / 2 + 0.06, 0, h / 2 - 0.06, INK, 0.03); disc(c, -0.06, 0, 0.03, BRASS, 0); disc(c, 0.06, 0, 0.03, BRASS, 0);
});
add('Furniture', 'chest_open', 'Open chest', 0.8, 0.8, {}, (c, o, w, h, s) => {
  shadowRect(c, w, h * 0.7, 0.03);
  rect(c, -w / 2, -h / 2, w, h * 0.3, '#5a3818', 0.04);
  rect(c, -w / 2, -h / 2 + h * 0.3, w, h * 0.7, '#7a4c25', 0.04); rect(c, -w / 2 + 0.06, -h / 2 + h * 0.3 + 0.06, w - 0.12, h * 0.7 - 0.12, '#b8902a', 0);
  c.save(); c.beginPath(); c.rect(-w / 2 + 0.06, -h / 2 + h * 0.3 + 0.06, w - 0.12, h * 0.7 - 0.12); c.clip(); pile(c, -w / 2 + 0.06, -h / 2 + h * 0.3 + 0.06, w - 0.12, h * 0.7 - 0.12, 'coin', s); c.restore();
  for (const x of [-0.3, 0.3]) rect(c, x * w - 0.03, -h / 2, 0.06, h, '#d4a93a', 0);
});
add('Furniture', 'mirror_wall', 'Wall mirror', 1, 0.15, {}, (c, o, w, h) => { rrect(c, -w / 2, -h / 2, w, h, 0.05, GOLD, 0.03); rect(c, -w / 2 + 0.06, -h / 2 + 0.03, w - 0.12, h - 0.06, '#a8c8d8', 0); });
add('Furniture', 'tapestry', 'Tapestry (wall)', 2, 0.2, { colors: CLOTH }, (c, o, w, h, s) => {
  const col = o.color ?? CLOTH[0]; rect(c, -w / 2, -h / 2, w, h, col, 0.02); for (let i = 0; i < 6; i++) disc(c, -w / 2 + (i + 0.5) * (w / 6), 0, h * 0.25, i % 2 ? GOLD : shade(col, 0.3), 0);
});
add('Furniture', 'piano_bench', 'Cushioned bench', 1.4, 0.5, { colors: FABRIC }, (c, o, w, h) => {
  shadowRect(c, w, h, 0.06); rrect(c, -w / 2, -h / 2, w, h, 0.06, XWOOD, 0.04); rrect(c, -w / 2 + 0.05, -h / 2 + 0.05, w - 0.1, h - 0.1, 0.05, o.color ?? FABRIC[2], 0.02);
  for (let x = -w / 2 + 0.25; x < w / 2 - 0.1; x += 0.3) disc(c, x, 0, 0.02, GOLD, 0);
});
add('Furniture', 'bed_single', 'Single bed', 1, 2, { snap: true, colors: CLOTH }, (c, o, w, h) => { shadowRect(c, w, h); bedFrame(c, -w / 2, -h / 2, w, h, o.color ?? CLOTH[2], 1); });
add('Furniture', 'four_chairs', 'Table for four', 2, 2, { snap: true }, (c, o, w, h, s) => {
  const t = Math.min(w, h) * 0.5;
  chair(c, 0, -t * 0.82, 0, 0.5); chair(c, 0, t * 0.82, Math.PI, 0.5); chair(c, -t * 0.82, 0, -Math.PI / 2, 0.5); chair(c, t * 0.82, 0, Math.PI / 2, 0.5);
  c.fillStyle = SH; c.fillRect(-t / 2 + 0.07, -t / 2 + 0.09, t, t); rrect(c, -t / 2, -t / 2, t, t, 0.06, WOOD, 0.05); lines(c, -t / 2, -t / 2, t, t, 0.18);
  plate(c, -t * 0.2, -t * 0.2, 0.12, '#c89a52'); mug(c, t * 0.2, t * 0.15, 0.08); if (H(s, 1) > 0.5) candle(c, t * 0.15, -t * 0.2, 0.05);
});
add('Furniture', 'bed_straw', 'Straw bed', 1, 1.9, {}, (c, o, w, h, s) => {
  c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, 0.25); c.fillStyle = '#d8b85a'; c.fill(); stroke(c, 0.03, '#7a5a2a');
  for (let i = 0; i < 25; i++) { const x = (H(s, i) - 0.5) * w * 0.85, y = (H(s, i, 1) - 0.5) * h * 0.9; seg(c, x, y, x + 0.12 * Math.cos(i * 2), y + 0.12 * Math.sin(i * 2), 'rgba(120,90,30,0.55)', 0.02); }
  rrect(c, -w * 0.4, h * 0.05, w * 0.8, h * 0.42, 0.1, '#7a6a4a', 0.02);
});
