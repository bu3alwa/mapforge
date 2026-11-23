// Save/load (JSON), autosave, undo history and PNG export.
import { MapData, MapObject, Rect } from './map';
import { renderRegion } from './render';

interface Snapshot {
  terrain: Uint8Array;
  elevation: Int8Array;
  objects: MapObject[];
  nextId: number;
}

export class History {
  private undoStack: Snapshot[] = [];
  private redoStack: Snapshot[] = [];
  constructor(private limit = 60) {}

  private snap(map: MapData): Snapshot {
    return { terrain: map.terrain.slice(), elevation: map.elevation.slice(), objects: structuredClone(map.objects), nextId: map.nextId };
  }
  private apply(map: MapData, s: Snapshot) {
    map.terrain.set(s.terrain);
    map.elevation.set(s.elevation);
    map.objects = s.objects;
    map.nextId = s.nextId;
  }
  /** Call before a change. */
  push(map: MapData) {
    this.undoStack.push(this.snap(map));
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
  }
  undo(map: MapData): boolean {
    const s = this.undoStack.pop();
    if (!s) return false;
    this.redoStack.push(this.snap(map));
    this.apply(map, s);
    return true;
  }
  redo(map: MapData): boolean {
    const s = this.redoStack.pop();
    if (!s) return false;
    this.undoStack.push(this.snap(map));
    this.apply(map, s);
    return true;
  }
  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function serialize(map: MapData): string {
  return JSON.stringify({
    format: 'mapforge',
    version: 2,
    name: map.name,
    width: map.width,
    height: map.height,
    terrain: toBase64(map.terrain),
    elevation: toBase64(new Uint8Array(map.elevation.buffer, map.elevation.byteOffset, map.elevation.length)),
    objects: map.objects,
    nextId: map.nextId,
  });
}

export function deserialize(json: string): MapData {
  const d = JSON.parse(json);
  if (d.format !== 'mapforge') throw new Error('Not a Mapforge map file');
  const map = new MapData(d.width, d.height);
  const t = fromBase64(d.terrain);
  if (t.length !== map.terrain.length) throw new Error('Map data is corrupted');
  map.terrain.set(t);
  if (d.elevation) {
    const e = fromBase64(d.elevation);
    if (e.length === map.elevation.length) map.elevation.set(new Int8Array(e.buffer, e.byteOffset, e.length));
  }
  map.objects = d.objects ?? [];
  map.nextId = d.nextId ?? map.objects.reduce((m: number, o: MapObject) => Math.max(m, o.id + 1), 1);
  map.name = d.name ?? 'Untitled map';
  return map;
}

const AUTOSAVE_KEY = 'mapforge.autosave';
export function autosave(map: MapData) {
  try { localStorage.setItem(AUTOSAVE_KEY, serialize(map)); } catch { /* storage full or blocked */ }
}
export function loadAutosave(): MapData | null {
  try {
    const s = localStorage.getItem(AUTOSAVE_KEY);
    return s ? deserialize(s) : null;
  } catch {
    return null;
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function safeName(name: string) {
  return (name || 'map').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'map';
}

export async function exportPng(map: MapData, area: Rect, pxPerTile: number, grid: boolean): Promise<Blob> {
  const w = area.w * pxPerTile, h = area.h * pxPerTile;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  // Render in strips to keep path sizes reasonable.
  const step = 32;
  for (let y = area.y; y < area.y + area.h; y += step)
    for (let x = area.x; x < area.x + area.w; x += step) {
      const x1 = Math.min(area.x + area.w, x + step), y1 = Math.min(area.y + area.h, y + step);
      ctx.save();
      ctx.translate((x - area.x) * pxPerTile, (y - area.y) * pxPerTile);
      renderRegion(ctx, map, x, y, x1, y1, pxPerTile);
      ctx.restore();
    }
  if (grid) {
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = Math.max(1, pxPerTile / 50);
    ctx.beginPath();
    for (let i = 0; i <= area.w; i++) { ctx.moveTo(i * pxPerTile, 0); ctx.lineTo(i * pxPerTile, h); }
    for (let j = 0; j <= area.h; j++) { ctx.moveTo(0, j * pxPerTile); ctx.lineTo(w, j * pxPerTile); }
    ctx.stroke();
  }
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Export failed: image too large'))), 'image/png'));
}
