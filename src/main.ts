import './style.css';
import { MAX_ELEV, MIN_ELEV, MapData, MapObject, PALETTE_ORDER, Rect, T, TERRAIN, clampRect, objectBounds } from './map';
import { CHUNK, ChunkCache, compareObjects } from './render';
import { OBJECT_BY_TYPE, OBJECT_CATEGORIES, OBJECT_DEFS, ObjectDef, drawObject, labelWidth } from './objects';
import { textureCanvas } from './patterns';
import { GENERATORS, Generator, Params } from './gen';
import { Rng } from './rng';
import { GridType, addGridPath, gridSpacing } from './grid';
import { History, autosave, deserialize, downloadBlob, exportPng, loadAutosave, safeName, serialize } from './io';

// ---------- State ----------
type ToolId = 'select' | 'paint' | 'rect' | 'fill' | 'height' | 'stamp' | 'scatter' | 'erase' | 'label' | 'area' | 'pan';

let map: MapData = loadAutosave() ?? createStarterMap();
const cache = new ChunkCache(map);
const history = new History();

const state = {
  tool: 'paint' as ToolId,
  terrain: T.Stone as T,
  brush: 1,
  height: 1,
  objType: 'tree',
  objColor: null as string | null,
  stampRot: 0,
  roomWalls: false,
  scatterDensity: 0.5,
  labelSize: 1.5,
  labelColor: '#f4ead2',
  grid: true,
  selected: null as MapObject | null,
  area: null as Rect | null,
  hover: null as { x: number; y: number } | null,
  genId: GENERATORS[0].id,
  genParams: {} as Record<string, Params>,
  seed: randomSeed(),
};
for (const g of GENERATORS) state.genParams[g.id] = Object.fromEntries(g.params.map((p) => [p.key, p.default]));

const view = { ox: 0, oy: 0, zoom: 16 };

// ---------- DOM ----------
const $ = <E extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as E;
const canvas = $<HTMLCanvasElement>('view');
const ctx = canvas.getContext('2d')!;
const stage = $('stage');

function randomSeed() {
  const words = ['ember', 'frost', 'gloom', 'raven', 'thorn', 'gold', 'ash', 'moss', 'iron', 'mist', 'dusk', 'stone', 'wyrm', 'oak'];
  return `${words[Math.floor(Math.random() * words.length)]}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

function createStarterMap(): MapData {
  const m = new MapData(60, 45);
  m.name = 'The Sunken Halls';
  const g = GENERATORS.find((x) => x.id === 'dungeon')!;
  g.run({ map: m, region: m.fullRect(), rng: new Rng('starter') }, Object.fromEntries(g.params.map((p) => [p.key, p.default])));
  return m;
}

// ---------- Rendering ----------
let renderQueued = false;
function requestRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; draw(); });
}

let saveTimer = 0;
function changed(rect?: Rect, margin = 3) {
  if (rect) cache.invalidateRect(rect.x, rect.y, rect.w, rect.h, margin);
  else cache.invalidateAll();
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => autosave(map), 700);
  requestRender();
  updateStatus();
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const w = stage.clientWidth, h = stage.clientHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  requestRender();
}

function chunkRes(): number {
  const target = view.zoom * (window.devicePixelRatio || 1);
  for (const r of [8, 16, 32, 64]) if (r >= target * 0.85) return r;
  return 64;
}

function draw() {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.width, H = canvas.height;
  const Z = view.zoom * dpr, OX = view.ox * dpr, OY = view.oy * dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0f0e0b';
  ctx.fillRect(0, 0, W, H);

  // Map shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(OX + 6 * dpr, OY + 6 * dpr, map.width * Z, map.height * Z);

  const res = chunkRes();
  const cx0 = Math.max(0, Math.floor(-OX / Z / CHUNK)), cy0 = Math.max(0, Math.floor(-OY / Z / CHUNK));
  const cx1 = Math.min(Math.ceil(map.width / CHUNK) - 1, Math.floor((W - OX) / Z / CHUNK));
  const cy1 = Math.min(Math.ceil(map.height / CHUNK) - 1, Math.floor((H - OY) / Z / CHUNK));
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const t0 = performance.now();
  let pending = false;
  for (let cy = cy0; cy <= cy1; cy++)
    for (let cx = cx0; cx <= cx1; cx++) {
      const sx0 = Math.round(OX + cx * CHUNK * Z), sy0 = Math.round(OY + cy * CHUNK * Z);
      const sx1 = Math.round(OX + Math.min(map.width, (cx + 1) * CHUNK) * Z);
      const sy1 = Math.round(OY + Math.min(map.height, (cy + 1) * CHUNK) * Z);
      if (performance.now() - t0 > 40 && !cache.isFresh(cx, cy, res)) {
        const fallback = cache.anyFresh(cx, cy);
        if (fallback) ctx.drawImage(fallback, sx0, sy0, sx1 - sx0, sy1 - sy0);
        pending = true;
        continue;
      }
      ctx.drawImage(cache.get(cx, cy, res), sx0, sy0, sx1 - sx0, sy1 - sy0);
    }
  if (pending) requestRender();

  // Grid.
  if (state.grid && map.grid.type !== 'square' && view.zoom * gridSpacing(map.grid) >= 5) {
    // Hex overlay, drawn in world units and clipped to the map.
    const x0 = Math.max(0, -OX / Z), x1 = Math.min(map.width, (W - OX) / Z);
    const y0 = Math.max(0, -OY / Z), y1 = Math.min(map.height, (H - OY) / Z);
    ctx.save();
    ctx.setTransform(Z, 0, 0, Z, OX, OY);
    ctx.beginPath();
    ctx.rect(0, 0, map.width, map.height);
    ctx.clip();
    ctx.strokeStyle = 'rgba(15,10,5,0.4)';
    ctx.lineWidth = dpr / Z;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    addGridPath(ctx, map.grid, x0, y0, x1, y1);
    ctx.stroke();
    ctx.restore();
  } else if (state.grid && map.grid.type === 'square' && view.zoom >= 7) {
    ctx.strokeStyle = 'rgba(15,10,5,0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const gx0 = Math.max(0, Math.floor(-OX / Z)), gx1 = Math.min(map.width, Math.ceil((W - OX) / Z));
    const gy0 = Math.max(0, Math.floor(-OY / Z)), gy1 = Math.min(map.height, Math.ceil((H - OY) / Z));
    for (let x = gx0; x <= gx1; x++) { const sx = Math.round(OX + x * Z) + 0.5; ctx.moveTo(sx, OY + gy0 * Z); ctx.lineTo(sx, OY + gy1 * Z); }
    for (let y = gy0; y <= gy1; y++) { const sy = Math.round(OY + y * Z) + 0.5; ctx.moveTo(OX + gx0 * Z, sy); ctx.lineTo(OX + gx1 * Z, sy); }
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(217,164,65,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(OX) + 0.5, Math.round(OY) + 0.5, Math.round(map.width * Z), Math.round(map.height * Z));

  // Overlays in world units.
  ctx.setTransform(Z, 0, 0, Z, OX, OY);
  const px = 1 / Z;
  if (state.tool === 'height' && view.zoom >= 10) drawHeightNumbers(px, W, H, Z, OX, OY);
  drawOverlays(px);
}

/** While using the height brush, show each tile's level. */
function drawHeightNumbers(px: number, W: number, H: number, Z: number, OX: number, OY: number) {
  const gx0 = Math.max(0, Math.floor(-OX / Z)), gx1 = Math.min(map.width, Math.ceil((W - OX) / Z));
  const gy0 = Math.max(0, Math.floor(-OY / Z)), gy1 = Math.min(map.height, Math.ceil((H - OY) / Z));
  ctx.font = `600 ${Math.min(0.45, 13 * px)}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let y = gy0; y < gy1; y++)
    for (let x = gx0; x < gx1; x++) {
      const e = map.elevation[y * map.width + x];
      if (!e) continue;
      ctx.fillStyle = e > 0 ? 'rgba(255,230,150,0.85)' : 'rgba(150,200,255,0.85)';
      ctx.fillText(e > 0 ? `+${e}` : String(e), x + 0.5, y + 0.5);
    }
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}

function dashedRect(r: Rect, px: number, color: string, fill?: string) {
  if (fill) { ctx.fillStyle = fill; ctx.fillRect(r.x, r.y, r.w, r.h); }
  ctx.lineWidth = 2 * px;
  ctx.setLineDash([6 * px, 4 * px]);
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.lineDashOffset = 5 * px;
  ctx.strokeStyle = color;
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
}

function drawOverlays(px: number) {
  if (state.area) dashedRect(state.area, px, '#d9a441', 'rgba(217,164,65,0.08)');
  if (drag?.kind === 'rect' || drag?.kind === 'area') {
    const r = rectFromDrag(drag.start, drag.cur);
    dashedRect(r, px, '#ffffff', drag.kind === 'rect' ? 'rgba(255,255,255,0.12)' : 'rgba(217,164,65,0.12)');
    ctx.fillStyle = '#fff';
    ctx.font = `${12 * px}px system-ui`;
    ctx.fillText(`${r.w} × ${r.h}  (${r.w * 5} × ${r.h * 5} ft)`, r.x, r.y - 6 * px);
  }
  if (state.selected) {
    const b = objectBounds(state.selected);
    dashedRect({ x: b.x - 0.1, y: b.y - 0.1, w: b.w + 0.2, h: b.h + 0.2 }, px, '#7fd0ff');
  }
  const hv = state.hover;
  if (!hv || drag?.kind === 'pan') return;
  const tool = state.tool;
  if (tool === 'paint' || tool === 'erase' || tool === 'scatter' || tool === 'height') {
    const c = brushCenter(hv.x, hv.y);
    ctx.beginPath();
    ctx.arc(c.x, c.y, Math.max(0.5, state.brush / 2), 0, Math.PI * 2);
    ctx.lineWidth = 2 * px;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.stroke();
    ctx.lineWidth = 1 * px;
    ctx.strokeStyle = tool === 'erase' ? '#ff8a7a' : '#ffffff';
    ctx.stroke();
  } else if (tool === 'rect' || tool === 'fill' || tool === 'area') {
    if (!drag) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5 * px;
      ctx.strokeRect(Math.floor(hv.x), Math.floor(hv.y), 1, 1);
    }
  } else if (tool === 'stamp') {
    const ghost = makeStampObject(hv.x, hv.y, false);
    ctx.globalAlpha = 0.65;
    drawObject(ctx, ghost);
    ctx.globalAlpha = 1;
  }
}

// ---------- Coordinates ----------
function toWorld(e: { clientX: number; clientY: number }) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left - view.ox) / view.zoom, y: (e.clientY - r.top - view.oy) / view.zoom };
}

function fitView() {
  const w = stage.clientWidth, h = stage.clientHeight;
  view.zoom = Math.max(2, Math.min(64, Math.min((w - 40) / map.width, (h - 40) / map.height)));
  view.ox = (w - map.width * view.zoom) / 2;
  view.oy = (h - map.height * view.zoom) / 2;
  requestRender();
  updateStatus();
}

function zoomAt(sx: number, sy: number, factor: number) {
  const nz = Math.max(2, Math.min(160, view.zoom * factor));
  const wx = (sx - view.ox) / view.zoom, wy = (sy - view.oy) / view.zoom;
  view.zoom = nz;
  view.ox = sx - wx * nz;
  view.oy = sy - wy * nz;
  requestRender();
  updateStatus();
}

function brushCenter(x: number, y: number) {
  return state.brush % 2 === 1 ? { x: Math.floor(x) + 0.5, y: Math.floor(y) + 0.5 } : { x: Math.round(x), y: Math.round(y) };
}

function rectFromDrag(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
  const x0 = Math.floor(Math.min(a.x, b.x)), y0 = Math.floor(Math.min(a.y, b.y));
  const x1 = Math.floor(Math.max(a.x, b.x)), y1 = Math.floor(Math.max(a.y, b.y));
  return clampRect({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }, map);
}

// ---------- Editing operations ----------
function paintAt(x: number, y: number, t: T, bounds: Rect | null): Rect | null {
  const c = brushCenter(x, y);
  const r = Math.max(0.5, state.brush / 2);
  let any = false;
  for (let ty = Math.floor(c.y - r); ty <= Math.ceil(c.y + r); ty++)
    for (let tx = Math.floor(c.x - r); tx <= Math.ceil(c.x + r); tx++) {
      if (!map.inBounds(tx, ty)) continue;
      if (Math.hypot(tx + 0.5 - c.x, ty + 0.5 - c.y) > r + 0.001) continue;
      if (map.get(tx, ty) !== t) { map.set(tx, ty, t); any = true; }
    }
  if (!any) return bounds;
  const nb = { x: Math.floor(c.x - r), y: Math.floor(c.y - r), w: Math.ceil(r * 2) + 1, h: Math.ceil(r * 2) + 1 };
  changed(nb);
  return bounds ? union(bounds, nb) : nb;
}

function heightAt(x: number, y: number, level: number) {
  const c = brushCenter(x, y);
  const r = Math.max(0.5, state.brush / 2);
  let any = false;
  for (let ty = Math.floor(c.y - r); ty <= Math.ceil(c.y + r); ty++)
    for (let tx = Math.floor(c.x - r); tx <= Math.ceil(c.x + r); tx++) {
      if (!map.inBounds(tx, ty) || Math.hypot(tx + 0.5 - c.x, ty + 0.5 - c.y) > r + 0.001) continue;
      if (map.getElev(tx, ty) !== level) { map.setElev(tx, ty, level); any = true; }
    }
  if (any) changed({ x: Math.floor(c.x - r), y: Math.floor(c.y - r), w: Math.ceil(r * 2) + 1, h: Math.ceil(r * 2) + 1 }, 6);
}

function union(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

function fillRect(r: Rect, t: T, walls: boolean) {
  for (let y = r.y; y < r.y + r.h; y++)
    for (let x = r.x; x < r.x + r.w; x++) {
      const edge = x === r.x || y === r.y || x === r.x + r.w - 1 || y === r.y + r.h - 1;
      map.set(x, y, walls && edge && r.w > 2 && r.h > 2 ? T.Wall : t);
    }
  changed(r);
}

function floodFill(x: number, y: number, t: T) {
  x = Math.floor(x); y = Math.floor(y);
  if (!map.inBounds(x, y)) return;
  const from = map.get(x, y);
  if (from === t) return;
  const stack = [x, y];
  let minX = x, minY = y, maxX = x, maxY = y;
  while (stack.length) {
    const cy = stack.pop()!, cx = stack.pop()!;
    if (!map.inBounds(cx, cy) || map.get(cx, cy) !== from) continue;
    map.set(cx, cy, t);
    minX = Math.min(minX, cx); maxX = Math.max(maxX, cx); minY = Math.min(minY, cy); maxY = Math.max(maxY, cy);
    stack.push(cx + 1, cy, cx - 1, cy, cx, cy + 1, cx, cy - 1);
  }
  changed({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 });
}

function snapCenter(def: ObjectDef | undefined, x: number, y: number, w: number, h: number, rot: number) {
  if (!def?.snap) return { x, y };
  const rotated = Math.abs(Math.sin(rot)) > 0.5;
  const bw = rotated ? h : w, bh = rotated ? w : h;
  const sx = Number.isInteger(bw) ? Math.round(x - bw / 2) + bw / 2 : Math.floor(x) + 0.5;
  const sy = Number.isInteger(bh) ? Math.round(y - bh / 2) + bh / 2 : Math.floor(y) + 0.5;
  return { x: sx, y: sy };
}

let stampPreviewId = -1;
function makeStampObject(x: number, y: number, final: boolean): MapObject {
  const def = OBJECT_BY_TYPE.get(state.objType)!;
  const p = snapCenter(def, x, y, def.w, def.h, state.stampRot);
  const color = def.colors ? state.objColor ?? def.colors[0] : undefined;
  return { id: final ? map.nextId : stampPreviewId, type: def.type, x: p.x, y: p.y, w: def.w, h: def.h, rot: state.stampRot, color };
}

function addObject(o: Omit<MapObject, 'id'>) {
  const obj = map.addObject(o);
  changed(objectBounds(obj));
  return obj;
}

function removeObject(o: MapObject) {
  map.objects = map.objects.filter((x) => x !== o);
  changed(objectBounds(o));
}

function hitTest(x: number, y: number): MapObject | null {
  let best: MapObject | null = null, bestArea = Infinity;
  for (const o of map.objects) {
    const b = objectBounds(o);
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
      const a = b.w * b.h;
      if (a <= bestArea) { best = o; bestArea = a; }
    }
  }
  return best;
}

function scatterAt(x: number, y: number) {
  const def = OBJECT_BY_TYPE.get(state.objType)!;
  const r = Math.max(0.5, state.brush / 2);
  const attempts = Math.max(1, Math.round(r * r * state.scatterDensity * 0.6));
  for (let i = 0; i < attempts; i++) {
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r;
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
    if (!map.inBounds(Math.floor(px), Math.floor(py))) continue;
    const s = def.w * (0.8 + Math.random() * 0.45);
    const minD = s * 0.55;
    const crowded = map.objects.some((o) => Math.abs(o.x - px) < minD && Math.abs(o.y - py) < minD && Math.hypot(o.x - px, o.y - py) < minD);
    if (crowded) continue;
    addObject({ type: def.type, x: px, y: py, w: s, h: s, rot: Math.random() * Math.PI * 2 });
  }
}

function eraseObjectsAt(x: number, y: number) {
  const r = Math.max(0.5, state.brush / 2);
  const c = brushCenter(x, y);
  const hit = map.objects.filter((o) => Math.hypot(o.x - c.x, o.y - c.y) <= r + 0.3);
  if (!hit.length) return;
  const set = new Set(hit);
  map.objects = map.objects.filter((o) => !set.has(o));
  if (state.selected && set.has(state.selected)) select(null);
  for (const o of hit) cache.invalidateRect(objectBounds(o).x, objectBounds(o).y, objectBounds(o).w, objectBounds(o).h);
  changed({ x: c.x - r, y: c.y - r, w: r * 2, h: r * 2 });
}

// ---------- Pointer input ----------
type Drag =
  | { kind: 'pan'; sx: number; sy: number; ox: number; oy: number }
  | { kind: 'paint'; last: { x: number; y: number } }
  | { kind: 'erase'; last: { x: number; y: number } }
  | { kind: 'height'; last: { x: number; y: number } }
  | { kind: 'scatter'; last: { x: number; y: number } }
  | { kind: 'rect' | 'area'; start: { x: number; y: number }; cur: { x: number; y: number } }
  | { kind: 'move'; obj: MapObject; start: { x: number; y: number }; orig: { x: number; y: number }; pushed: boolean };
let drag: Drag | null = null;
let spaceDown = false;

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  const w = toWorld(e);
  if (e.button === 1 || e.button === 2 || spaceDown || state.tool === 'pan') {
    drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, ox: view.ox, oy: view.oy };
    canvas.style.cursor = 'grabbing';
    return;
  }
  if (e.button !== 0) return;
  switch (state.tool) {
    case 'paint':
      history.push(map);
      paintAt(w.x, w.y, state.terrain, null);
      drag = { kind: 'paint', last: w };
      break;
    case 'erase':
      history.push(map);
      eraseObjectsAt(w.x, w.y);
      drag = { kind: 'erase', last: w };
      break;
    case 'height':
      history.push(map);
      heightAt(w.x, w.y, state.height);
      drag = { kind: 'height', last: w };
      break;
    case 'scatter':
      history.push(map);
      scatterAt(w.x, w.y);
      drag = { kind: 'scatter', last: w };
      break;
    case 'rect':
    case 'area':
      drag = { kind: state.tool, start: w, cur: w };
      break;
    case 'fill':
      history.push(map);
      floodFill(w.x, w.y, state.terrain);
      break;
    case 'stamp': {
      history.push(map);
      const o = makeStampObject(w.x, w.y, true);
      const { id: _id, ...rest } = o;
      addObject(rest);
      break;
    }
    case 'label': {
      const text = prompt('Label text:', '');
      if (text && text.trim()) {
        history.push(map);
        const o = addObject({ type: 'label', x: w.x, y: w.y, w: labelWidth(text.trim(), state.labelSize), h: state.labelSize, rot: 0, text: text.trim(), color: state.labelColor });
        setTool('select');
        select(o);
      }
      break;
    }
    case 'select': {
      const o = hitTest(w.x, w.y);
      select(o);
      if (o) drag = { kind: 'move', obj: o, start: w, orig: { x: o.x, y: o.y }, pushed: false };
      break;
    }
  }
  requestRender();
});

canvas.addEventListener('pointermove', (e) => {
  const w = toWorld(e);
  state.hover = w;
  if (drag) {
    switch (drag.kind) {
      case 'pan':
        view.ox = drag.ox + (e.clientX - drag.sx);
        view.oy = drag.oy + (e.clientY - drag.sy);
        break;
      case 'paint':
      case 'erase':
      case 'height':
      case 'scatter': {
        const last = drag.last;
        const dist = Math.hypot(w.x - last.x, w.y - last.y);
        const step = drag.kind === 'scatter' ? Math.max(0.6, state.brush * 0.4) : 0.3;
        if (dist < step && drag.kind === 'scatter') break;
        const n = Math.max(1, Math.ceil(dist / step));
        for (let i = 1; i <= n; i++) {
          const x = last.x + ((w.x - last.x) * i) / n, y = last.y + ((w.y - last.y) * i) / n;
          if (drag.kind === 'paint') paintAt(x, y, state.terrain, null);
          else if (drag.kind === 'erase') eraseObjectsAt(x, y);
          else if (drag.kind === 'height') heightAt(x, y, state.height);
          else scatterAt(x, y);
        }
        drag.last = w;
        break;
      }
      case 'rect':
      case 'area':
        drag.cur = w;
        break;
      case 'move': {
        const o = drag.obj;
        if (!drag.pushed) {
          if (Math.hypot(w.x - drag.start.x, w.y - drag.start.y) < 0.15) break;
          history.push(map);
          // History stored a clone; keep editing the live object.
          drag.pushed = true;
        }
        const before = objectBounds(o);
        const def = OBJECT_BY_TYPE.get(o.type);
        const nx = drag.orig.x + (w.x - drag.start.x), ny = drag.orig.y + (w.y - drag.start.y);
        const p = e.shiftKey ? { x: nx, y: ny } : snapCenter(def, nx, ny, o.w, o.h, o.rot);
        o.x = p.x; o.y = p.y;
        changed(before);
        changed(objectBounds(o));
        refreshSelectionPanel();
        break;
      }
    }
  }
  requestRender();
  updateStatus();
});

function endDrag() {
  if (!drag) return;
  if (drag.kind === 'rect') {
    const r = rectFromDrag(drag.start, drag.cur);
    if (r.w > 0 && r.h > 0) { history.push(map); fillRect(r, state.terrain, state.roomWalls); }
  } else if (drag.kind === 'area') {
    const r = rectFromDrag(drag.start, drag.cur);
    state.area = r.w > 1 && r.h > 1 ? r : null;
    refreshGenTarget();
    renderToolOptions();
  }
  drag = null;
  canvas.style.cursor = cursorFor(state.tool);
  requestRender();
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('pointerleave', () => { state.hover = null; requestRender(); });

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const r = canvas.getBoundingClientRect();
  if (e.ctrlKey || Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
    const k = e.deltaMode === 1 ? 33 : 1;
    zoomAt(e.clientX - r.left, e.clientY - r.top, Math.pow(1.0018, -e.deltaY * k * (e.ctrlKey ? 3 : 1)));
  } else {
    view.ox -= e.deltaX;
    requestRender();
  }
}, { passive: false });

// ---------- Keyboard ----------
const TOOL_KEYS: Record<string, ToolId> = { v: 'select', b: 'paint', m: 'rect', g: 'fill', e: 'height', o: 'stamp', s: 'scatter', x: 'erase', t: 'label', a: 'area', h: 'pan' };

window.addEventListener('keydown', (e) => {
  const target = e.target as HTMLElement;
  if (target.matches('input, select, textarea') || document.querySelector('dialog[open]')) return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); return; }
  if ((e.ctrlKey || e.metaKey) && k === 's') { e.preventDefault(); saveFile(); return; }
  if ((e.ctrlKey || e.metaKey) && k === 'd' && state.selected) { e.preventDefault(); duplicateSelected(); return; }
  if ((e.ctrlKey || e.metaKey) && (e.code === 'BracketRight' || e.code === 'BracketLeft') && state.selected) {
    e.preventDefault();
    const up = e.code === 'BracketRight';
    reorderSelected(e.shiftKey ? (up ? 'front' : 'back') : up ? 'forward' : 'backward');
    return;
  }
  if (state.tool === 'height' && !e.ctrlKey && !e.metaKey && /^[0-4]$/.test(e.key)) { setHeight(Number(e.key) * (e.shiftKey ? -1 : 1)); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === ' ') { spaceDown = true; canvas.style.cursor = 'grab'; e.preventDefault(); return; }
  if (e.key === 'Escape') { select(null); state.area = null; refreshGenTarget(); renderToolOptions(); requestRender(); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && state.selected) { history.push(map); removeObject(state.selected); select(null); return; }
  if (k === 'r') {
    if (state.tool === 'select' && state.selected) {
      history.push(map);
      const before = objectBounds(state.selected);
      state.selected.rot = ((state.selected.rot + Math.PI / 2) % (Math.PI * 2));
      const p = snapCenter(OBJECT_BY_TYPE.get(state.selected.type), state.selected.x, state.selected.y, state.selected.w, state.selected.h, state.selected.rot);
      state.selected.x = p.x; state.selected.y = p.y;
      changed(before); changed(objectBounds(state.selected));
      refreshSelectionPanel();
    } else if (state.tool === 'stamp') {
      state.stampRot = (state.stampRot + Math.PI / 2) % (Math.PI * 2);
      requestRender();
    }
    return;
  }
  if (e.key === '[' || e.key === ']') { setBrush(state.brush + (e.key === ']' ? 1 : -1)); return; }
  if (e.shiftKey && k === 'g') { toggleGrid(); return; }
  if (k === 'f') { fitView(); return; }
  if (TOOL_KEYS[k]) setTool(TOOL_KEYS[k]);
});
window.addEventListener('keyup', (e) => {
  if (e.key === ' ') { spaceDown = false; canvas.style.cursor = cursorFor(state.tool); }
});

function undo() { if (history.undo(map)) { select(null); changed(); toast('Undo'); } }
function redo() { if (history.redo(map)) { select(null); changed(); toast('Redo'); } }

/**
 * Move the selected object up or down the draw order among the objects it overlaps.
 * Uses the object's z value; objects with equal z fall back to the default order by type.
 */
function reorderSelected(dir: 'forward' | 'backward' | 'front' | 'back') {
  const o = state.selected;
  if (!o) return;
  const b = objectBounds(o);
  const overlapping = map.objects.filter((x) => {
    if (x === o) return false;
    const c = objectBounds(x);
    return c.x < b.x + b.w && c.x + c.w > b.x && c.y < b.y + b.h && c.y + c.h > b.y;
  });
  const stack = [...overlapping, o].sort(compareObjects);
  const i = stack.indexOf(o);
  let z: number;
  if (dir === 'front' || dir === 'forward') {
    const above = stack[i + 1];
    if (!above) { toast(overlapping.length ? 'Already on top' : 'Nothing overlaps this object'); return; }
    const target = dir === 'front' ? stack[stack.length - 1] : above;
    z = (target.z ?? 0) + (compareObjects({ ...o, z: target.z }, target) > 0 ? 0 : 1);
  } else {
    const below = stack[i - 1];
    if (!below) { toast(overlapping.length ? 'Already at the bottom' : 'Nothing overlaps this object'); return; }
    const target = dir === 'back' ? stack[0] : below;
    z = (target.z ?? 0) - (compareObjects({ ...o, z: target.z }, target) < 0 ? 0 : 1);
  }
  history.push(map);
  o.z = z;
  changed(b);
  refreshSelectionPanel(true);
  toast(dir === 'front' ? 'Brought to front' : dir === 'back' ? 'Sent to back' : dir === 'forward' ? 'Moved forward' : 'Moved backward');
}

function duplicateSelected() {
  const o = state.selected;
  if (!o) return;
  history.push(map);
  const { id: _id, ...rest } = o;
  const copy = addObject({ ...rest, x: o.x + 1, y: o.y + 1 });
  select(copy);
}

// ---------- Tools UI ----------
const ICONS: Record<ToolId, string> = {
  select: '<path d="M6 3l12 7.5-5.5 1.5L10 18z"/>',
  paint: '<path d="M14.5 4.5l5 5-8 8-5-5z"/><path d="M6.5 12.5L3 21l8.5-3.5"/>',
  rect: '<rect x="4" y="5" width="16" height="14" rx="1"/><path d="M8 5v14M4 10h4"/>',
  fill: '<path d="M4 12l7-7 8 8-7 7z"/><path d="M4 12h15"/><path d="M20 16c0 1.6 1 2.4 1 3.4a1 1 0 0 1-2 0c0-1 1-1.8 1-3.4z"/>',
  stamp: '<path d="M12 3c3.3 0 6 2.4 6 5.6 0 3-2.4 5.4-6 5.4s-6-2.4-6-5.4C6 5.4 8.7 3 12 3z"/><path d="M12 14v7M9 21h6"/>',
  scatter: '<circle cx="7" cy="7" r="2.2"/><circle cx="16" cy="6" r="1.6"/><circle cx="12" cy="13" r="2.6"/><circle cx="6" cy="17" r="1.6"/><circle cx="18" cy="16" r="2.2"/>',
  erase: '<path d="M4 16l9-9 6 6-6 6H8z"/><path d="M9 11l6 6M13 21h8"/>',
  height: '<path d="M3 20h18"/><path d="M5 20v-6h5v-5h5v-5h4v16"/>',
  label: '<path d="M5 7V5h14v2M12 5v14M9 19h6"/>',
  area: '<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/><path d="M10 4h4M10 20h4M4 10v4M20 10v4" stroke-dasharray="2 2"/>',
  pan: '<path d="M8 13V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v8c0 4-2.7 7-6.2 7-2.4 0-3.6-1-5-3.4L4 14.2a1.5 1.5 0 0 1 2.5-1.6L8 14"/>',
};
const TOOLS: { id: ToolId; name: string; key: string }[] = [
  { id: 'select', name: 'Select & move', key: 'V' },
  { id: 'paint', name: 'Terrain brush', key: 'B' },
  { id: 'rect', name: 'Room / rectangle', key: 'M' },
  { id: 'fill', name: 'Fill', key: 'G' },
  { id: 'height', name: 'Height brush (raise / lower ground)', key: 'E' },
  { id: 'stamp', name: 'Place object', key: 'O' },
  { id: 'scatter', name: 'Scatter brush', key: 'S' },
  { id: 'erase', name: 'Erase objects', key: 'X' },
  { id: 'label', name: 'Text label', key: 'T' },
  { id: 'area', name: 'Select area (for generators & export)', key: 'A' },
  { id: 'pan', name: 'Pan (or hold Space / right-drag)', key: 'H' },
];

const toolbar = $('toolbar');
for (const t of TOOLS) {
  if (t.id === 'select' || t.id === 'stamp' || t.id === 'area') {
    if (t.id !== 'select') { const d = document.createElement('div'); d.className = 'divider'; toolbar.appendChild(d); }
  }
  const b = document.createElement('button');
  b.dataset.tool = t.id;
  b.title = `${t.name} (${t.key})`;
  b.setAttribute('aria-label', t.name);
  b.innerHTML = `<svg viewBox="0 0 24 24">${ICONS[t.id]}</svg>`;
  b.onclick = () => setTool(t.id);
  toolbar.appendChild(b);
}

function cursorFor(tool: ToolId) {
  return tool === 'pan' ? 'grab' : tool === 'select' ? 'default' : 'crosshair';
}

function setTool(t: ToolId) {
  state.tool = t;
  if (t !== 'select') select(null);
  if (t === 'scatter' && !OBJECT_BY_TYPE.get(state.objType)?.natural) state.objType = 'tree';
  toolbar.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.tool === t));
  canvas.style.cursor = cursorFor(t);
  switchTab('draw');
  renderToolOptions();
  renderObjectPalette();
  requestRender();
}

function setHeight(level: number) {
  state.height = Math.max(MIN_ELEV, Math.min(MAX_ELEV, level));
  renderToolOptions();
  requestRender();
}

function setBrush(n: number) {
  state.brush = Math.max(1, Math.min(30, n));
  const el = document.getElementById('optBrush') as HTMLInputElement | null;
  if (el) { el.value = String(state.brush); el.dispatchEvent(new Event('input')); }
  requestRender();
}

function slider(label: string, id: string, min: number, max: number, step: number, value: number, fmt: (v: number) => string, onInput: (v: number) => void) {
  const wrap = document.createElement('label');
  wrap.className = 'field';
  wrap.innerHTML = `<span>${label}<b id="${id}-val"></b></span><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}">`;
  const input = wrap.querySelector('input')!;
  const val = wrap.querySelector('b')!;
  val.textContent = fmt(value);
  input.addEventListener('input', () => { const v = Number(input.value); val.textContent = fmt(v); onInput(v); });
  return wrap;
}

function checkbox(label: string, value: boolean, onChange: (v: boolean) => void) {
  const wrap = document.createElement('label');
  wrap.className = 'check';
  wrap.innerHTML = `<input type="checkbox" ${value ? 'checked' : ''}> ${label}`;
  wrap.querySelector('input')!.addEventListener('change', (e) => onChange((e.target as HTMLInputElement).checked));
  return wrap;
}

function hint(html: string) {
  const p = document.createElement('p');
  p.className = 'hint';
  p.innerHTML = html;
  return p;
}

function renderToolOptions() {
  const el = $('toolOptions');
  el.innerHTML = '';
  const tool = TOOLS.find((t) => t.id === state.tool)!;
  const h = document.createElement('h3');
  h.textContent = tool.name;
  el.appendChild(h);
  const form = document.createElement('div');
  form.className = 'form';
  el.appendChild(form);
  const brushSlider = () => slider('Brush size', 'optBrush', 1, 30, 1, state.brush, (v) => `${v} sq · ${v * 5} ft`, (v) => { state.brush = v; requestRender(); });
  switch (state.tool) {
    case 'paint':
      form.append(brushSlider(), hint(`Painting <b>${TERRAIN[state.terrain].name}</b>. Paint <b>Rock (void)</b> to erase floors. <kbd>[</kbd> <kbd>]</kbd> change size.`));
      break;
    case 'rect':
      form.append(
        checkbox('Surround with stone walls', state.roomWalls, (v) => (state.roomWalls = v)),
        hint(`Drag to draw a room of <b>${TERRAIN[state.terrain].name}</b>. On solid rock, walls are drawn automatically. Turn on walls for buildings in the open.`),
      );
      break;
    case 'fill':
      form.append(hint(`Click to flood-fill a connected area with <b>${TERRAIN[state.terrain].name}</b>.`));
      break;
    case 'height': {
      const levels = document.createElement('div');
      levels.className = 'field';
      levels.innerHTML = '<span>Paint height level</span>';
      const row = document.createElement('div');
      row.className = 'row';
      row.style.gap = '4px';
      for (let l = MIN_ELEV; l <= MAX_ELEV; l++) {
        const b = document.createElement('button');
        b.textContent = l > 0 ? `+${l}` : String(l);
        b.className = 'grow' + (l === state.height ? ' primary' : '');
        b.title = l === 0 ? 'Ground level' : l > 0 ? `Raised ${l * 5} ft` : `Sunken ${-l * 5} ft`;
        b.onclick = () => setHeight(l);
        row.append(b);
      }
      levels.append(row);
      form.append(
        levels,
        brushSlider(),
        hint('Paint raised platforms, cliffs and hills, or sunken pits. Higher ground casts a shadow onto lower ground. Keys <kbd>0</kbd>–<kbd>4</kbd> pick a level, <kbd>Shift</kbd>+number for pits. Paint level 0 to flatten.'),
      );
      break;
    }
    case 'stamp': {
      const def = OBJECT_BY_TYPE.get(state.objType)!;
      form.append(hint(`Click to place <b>${def.name}</b>. <kbd>R</kbd> rotates.`));
      if (def.colors) form.append(colorPicker(def.colors, state.objColor ?? def.colors[0], (c) => { state.objColor = c; requestRender(); }));
      break;
    }
    case 'scatter':
      form.append(
        brushSlider(),
        slider('Density', 'optDensity', 0.1, 1.5, 0.05, state.scatterDensity, (v) => `${Math.round(v * 100)}%`, (v) => (state.scatterDensity = v)),
        hint(`Drag to scatter <b>${OBJECT_BY_TYPE.get(state.objType)?.name}</b>. Choose a nature object below.`),
      );
      break;
    case 'erase':
      form.append(brushSlider(), hint('Drag over objects to remove them. Terrain is not affected.'));
      break;
    case 'label':
      form.append(
        slider('Text size', 'optLabel', 0.6, 6, 0.1, state.labelSize, (v) => `${v.toFixed(1)} sq`, (v) => (state.labelSize = v)),
        colorPicker(['#f4ead2', '#ffd36b', '#ff8a7a', '#9fd0ff', '#1a1410'], state.labelColor, (c) => (state.labelColor = c)),
        hint('Click the map to add a label.'),
      );
      break;
    case 'select':
      form.append(hint('Click an object to select it, then drag to move. <kbd>R</kbd> rotate · <kbd>Del</kbd> delete · <kbd>Ctrl</kbd>+<kbd>D</kbd> duplicate · hold <kbd>Shift</kbd> to move off-grid.'));
      break;
    case 'area': {
      form.append(hint('Drag to select part of the map. Generators and export can then work on just that area.'));
      if (state.area) {
        const a = state.area;
        const row = document.createElement('div');
        row.className = 'form';
        const fillBtn = document.createElement('button');
        fillBtn.textContent = `Fill area with ${TERRAIN[state.terrain].name}`;
        fillBtn.onclick = () => { history.push(map); fillRect(a, state.terrain, false); };
        const clearBtn = document.createElement('button');
        clearBtn.textContent = 'Remove objects in area';
        clearBtn.onclick = () => { history.push(map); map.removeObjectsIn(a); changed(a); };
        const genBtn = document.createElement('button');
        genBtn.textContent = 'Generate into this area…';
        genBtn.className = 'primary';
        genBtn.onclick = () => switchTab('generate');
        const noneBtn = document.createElement('button');
        noneBtn.textContent = 'Clear selection';
        noneBtn.onclick = () => { state.area = null; refreshGenTarget(); renderToolOptions(); requestRender(); };
        row.append(hint(`Selected <b>${a.w} × ${a.h}</b> squares.`), fillBtn, clearBtn, genBtn, noneBtn);
        form.append(row);
      }
      break;
    }
    case 'pan':
      form.append(hint('Drag to move around. Scroll to zoom. You can also pan with right-drag or by holding <kbd>Space</kbd>.'));
      break;
  }
}

function colorPicker(colors: string[], current: string, onPick: (c: string) => void) {
  const wrap = document.createElement('div');
  wrap.className = 'colors';
  for (const c of colors) {
    const b = document.createElement('button');
    b.className = 'color-dot' + (c === current ? ' active' : '');
    b.style.background = c;
    b.title = c;
    b.onclick = () => { wrap.querySelectorAll('.color-dot').forEach((x) => x.classList.remove('active')); b.classList.add('active'); onPick(c); };
    wrap.appendChild(b);
  }
  return wrap;
}

// Terrain palette.
function renderTerrainPalette() {
  const el = $('terrainPalette');
  el.innerHTML = '';
  for (const t of PALETTE_ORDER) {
    const b = document.createElement('button');
    b.className = 'swatch' + (t === state.terrain ? ' active' : '');
    b.style.backgroundImage = `url(${textureCanvas(t).toDataURL()})`;
    b.title = TERRAIN[t].name;
    b.setAttribute('aria-label', TERRAIN[t].name);
    b.onclick = () => {
      state.terrain = t;
      if (!['paint', 'rect', 'fill', 'area'].includes(state.tool)) setTool('paint');
      renderTerrainPalette();
      renderToolOptions();
    };
    el.appendChild(b);
  }
  const name = document.createElement('div');
  name.className = 'swatch-name';
  name.style.gridColumn = '1 / -1';
  name.textContent = TERRAIN[state.terrain].name;
  el.appendChild(name);
}

// Object palette.
const objIconCache = new Map<string, string>();
function objectIcon(def: ObjectDef): string {
  let url = objIconCache.get(def.type);
  if (url) return url;
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const x = c.getContext('2d')!;
  const s = Math.max(def.w, def.h);
  const scale = 80 / s;
  x.setTransform(scale, 0, 0, scale, 48 - (s / 2) * scale + (s - def.w) / 2 * scale, 48 - (s / 2) * scale + (s - def.h) / 2 * scale);
  drawObject(x, { id: 3, type: def.type, x: def.w / 2, y: def.h / 2, w: def.w, h: def.h, rot: 0, color: def.colors?.[0] });
  url = c.toDataURL();
  objIconCache.set(def.type, url);
  return url;
}

function renderObjectPalette() {
  const el = $('objectPalette');
  el.innerHTML = '';
  for (const cat of OBJECT_CATEGORIES) {
    const defs = OBJECT_DEFS.filter((d) => d.category === cat && (state.tool !== 'scatter' || d.natural));
    if (!defs.length) continue;
    const h = document.createElement('h4');
    h.textContent = cat;
    el.appendChild(h);
    const grid = document.createElement('div');
    grid.className = 'obj-grid';
    for (const def of defs) {
      const b = document.createElement('button');
      b.className = 'obj' + (def.type === state.objType && (state.tool === 'stamp' || state.tool === 'scatter') ? ' active' : '');
      b.title = def.name;
      b.setAttribute('aria-label', def.name);
      const img = document.createElement('img');
      img.src = objectIcon(def);
      img.style.width = '100%';
      img.alt = '';
      b.appendChild(img);
      b.onclick = () => {
        state.objType = def.type;
        state.objColor = null;
        state.stampRot = 0;
        setTool(state.tool === 'scatter' && def.natural ? 'scatter' : 'stamp');
      };
      grid.appendChild(b);
    }
    el.appendChild(grid);
  }
}

// Selection properties.
function select(o: MapObject | null) {
  state.selected = o;
  refreshSelectionPanel();
  requestRender();
}

function refreshSelectionPanel(force = false) {
  const el = $('selectionPanel');
  const o = state.selected;
  if (!o) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  if (!force && el.dataset.id === String(o.id) && el.childElementCount) {
    // Update numbers in place while dragging.
    return;
  }
  el.dataset.id = String(o.id);
  el.innerHTML = '';
  const def = OBJECT_BY_TYPE.get(o.type);
  const h = document.createElement('h3');
  h.textContent = def?.name ?? (o.type === 'label' ? 'Label' : o.type);
  el.appendChild(h);
  const form = document.createElement('div');
  form.className = 'form';
  el.appendChild(form);
  const edit = (fn: () => void) => {
    history.push(map);
    const before = objectBounds(o);
    fn();
    changed(before);
    changed(objectBounds(o));
  };
  if (o.type === 'label') {
    const f = document.createElement('label');
    f.className = 'field';
    f.innerHTML = '<span>Text</span><input>';
    const input = f.querySelector('input')!;
    input.value = o.text ?? '';
    input.addEventListener('change', () => edit(() => { o.text = input.value; o.w = labelWidth(o.text, o.h); }));
    form.append(f);
    form.append(slider('Text size', 'selSize', 0.6, 8, 0.1, o.h, (v) => `${v.toFixed(1)} sq`, (v) => edit(() => { o.h = v; o.w = labelWidth(o.text ?? '', v); })));
    form.append(colorPicker(['#f4ead2', '#ffd36b', '#ff8a7a', '#9fd0ff', '#1a1410'], o.color ?? '#f4ead2', (c) => edit(() => (o.color = c))));
  } else {
    const row = document.createElement('div');
    row.className = 'row gap';
    for (const dim of ['w', 'h'] as const) {
      const f = document.createElement('label');
      f.className = 'field grow';
      f.innerHTML = `<span>${dim === 'w' ? 'Width' : 'Length'} (sq)</span><input type="number" min="0.2" max="60" step="0.5">`;
      const input = f.querySelector('input')!;
      input.value = String(+o[dim].toFixed(2));
      input.addEventListener('change', () => edit(() => { o[dim] = Math.max(0.2, Math.min(60, Number(input.value) || 1)); }));
      row.append(f);
    }
    form.append(row);
    if (def?.colors) form.append(colorPicker(def.colors, o.color ?? def.colors[0], (c) => edit(() => (o.color = c))));
  }
  const actions = document.createElement('div');
  actions.className = 'row gap';
  const rot = document.createElement('button');
  rot.textContent = 'Rotate (R)';
  rot.onclick = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }));
  const dup = document.createElement('button');
  dup.textContent = 'Duplicate';
  dup.onclick = duplicateSelected;
  const del = document.createElement('button');
  del.textContent = 'Delete';
  del.style.color = 'var(--danger)';
  del.onclick = () => { history.push(map); removeObject(o); select(null); };
  actions.append(rot, dup, del);
  const layers = document.createElement('div');
  layers.className = 'field';
  layers.innerHTML = '<span>Layer order</span>';
  const lrow = document.createElement('div');
  lrow.className = 'row gap';
  const mk = (label: string, title: string, dir: 'front' | 'forward' | 'backward' | 'back') => {
    const b = document.createElement('button');
    b.textContent = label;
    b.title = title;
    b.className = 'grow';
    b.onclick = () => reorderSelected(dir);
    return b;
  };
  lrow.append(
    mk('⤒', 'Bring to front (Ctrl+Shift+])', 'front'),
    mk('↑ Forward', 'Bring forward (Ctrl+])', 'forward'),
    mk('↓ Back', 'Send backward (Ctrl+[)', 'backward'),
    mk('⤓', 'Send to back (Ctrl+Shift+[)', 'back'),
  );
  layers.append(lrow);
  form.append(actions, layers);
}

// ---------- Generate tab ----------
function currentGen(): Generator {
  return GENERATORS.find((g) => g.id === state.genId)!;
}

function renderGenList() {
  const el = $('genList');
  el.innerHTML = '';
  for (const g of GENERATORS) {
    const b = document.createElement('button');
    b.textContent = g.name;
    b.className = g.id === state.genId ? 'active' : '';
    b.onclick = () => { state.genId = g.id; renderGenList(); renderGenParams(); };
    el.appendChild(b);
  }
}

function renderGenParams() {
  const g = currentGen();
  $('genDesc').textContent = g.description;
  const el = $('genParams');
  el.innerHTML = '';
  const params = state.genParams[g.id];
  for (const p of g.params) {
    if (p.type === 'range') {
      el.append(slider(p.label, `gp-${p.key}`, p.min!, p.max!, p.step!, Number(params[p.key]), (v) => (p.max! <= 1 ? `${Math.round(v * 100)}%` : v.toFixed(1)), (v) => (params[p.key] = v)));
    } else if (p.type === 'bool') {
      el.append(checkbox(p.label, Boolean(params[p.key]), (v) => (params[p.key] = v)));
    } else {
      const f = document.createElement('label');
      f.className = 'field';
      f.innerHTML = `<span>${p.label}</span><select>${p.options!.map((o) => `<option value="${o.value}">${o.label}</option>`).join('')}</select>`;
      const sel = f.querySelector('select')!;
      sel.value = String(params[p.key]);
      sel.addEventListener('change', () => (params[p.key] = sel.value));
      el.append(f);
    }
  }
}

function refreshGenTarget() {
  const a = state.area;
  $('genTarget').innerHTML = a
    ? `Target: <b>selected area</b> (${a.w} × ${a.h}). Press <kbd>Esc</kbd> to use the whole map.`
    : `Target: <b>whole map</b> (${map.width} × ${map.height}). Use the Area tool to target part of it.`;
}

function runGenerator() {
  const g = currentGen();
  const region = state.area ?? map.fullRect();
  if (region.w < 6 || region.h < 6) { toast('Area is too small for a generator'); return; }
  history.push(map);
  select(null);
  map.removeObjectsIn(region);
  for (let y = region.y; y < region.y + region.h; y++) for (let x = region.x; x < region.x + region.w; x++) map.setElev(x, y, 0);
  const t0 = performance.now();
  g.run({ map, region, rng: new Rng(`${state.seed}:${g.id}`) }, state.genParams[g.id]);
  changed();
  toast(`${g.name} generated in ${Math.round(performance.now() - t0)} ms`);
}

$('genSeed').addEventListener('input', (e) => (state.seed = (e.target as HTMLInputElement).value));
$('genDice').onclick = () => { state.seed = randomSeed(); ($('genSeed') as HTMLInputElement).value = state.seed; };
$('genRun').onclick = runGenerator;
$('genReroll').onclick = () => { $('genDice').click(); runGenerator(); };

// ---------- Tabs ----------
function switchTab(tab: 'draw' | 'generate') {
  document.querySelectorAll<HTMLButtonElement>('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  $('tab-draw').hidden = tab !== 'draw';
  $('tab-generate').hidden = tab !== 'generate';
  if (tab === 'generate') refreshGenTarget();
}
document.querySelectorAll<HTMLButtonElement>('.tabs button').forEach((b) => (b.onclick = () => switchTab(b.dataset.tab as 'draw' | 'generate')));

// ---------- Top bar ----------
const nameInput = $<HTMLInputElement>('mapName');
nameInput.addEventListener('change', () => { map.name = nameInput.value.trim() || 'Untitled map'; autosave(map); });

function toggleGrid() {
  state.grid = !state.grid;
  $('btnGrid').classList.toggle('on', state.grid);
  requestRender();
}
$('btnGrid').onclick = toggleGrid;

// Grid type (squares or hexes) and hex size; saved with the map.
const gridType = $<HTMLSelectElement>('gridType'), hexSize = $<HTMLSelectElement>('hexSize');
function syncGridControls() {
  gridType.value = map.grid.type;
  hexSize.value = String(map.grid.size);
  hexSize.hidden = map.grid.type === 'square';
}
function onGridChange() {
  map.grid = { type: gridType.value as GridType, size: Number(hexSize.value) };
  if (!state.grid) toggleGrid();
  syncGridControls();
  autosave(map);
  requestRender();
}
gridType.addEventListener('change', onGridChange);
hexSize.addEventListener('change', onGridChange);
syncGridControls();
$('btnFit').onclick = fitView;
$('btnUndo').onclick = undo;
$('btnRedo').onclick = redo;

function saveFile() {
  downloadBlob(new Blob([serialize(map)], { type: 'application/json' }), `${safeName(map.name)}.mapforge.json`);
  toast('Map saved to your downloads');
}
$('btnSave').onclick = saveFile;

const fileInput = $<HTMLInputElement>('fileInput');
$('btnOpen').onclick = () => fileInput.click();
fileInput.addEventListener('change', async () => {
  const f = fileInput.files?.[0];
  if (!f) return;
  try {
    loadMap(deserialize(await f.text()));
    toast(`Opened ${map.name}`);
  } catch (err) {
    toast(`Couldn't open file: ${(err as Error).message}`);
  }
  fileInput.value = '';
});

function loadMap(m: MapData) {
  map = m;
  cache.setMap(map);
  history.clear();
  state.area = null;
  select(null);
  nameInput.value = map.name;
  syncGridControls();
  autosave(map);
  refreshGenTarget();
  fitView();
}

// New map dialog.
const dlgNew = $<HTMLDialogElement>('dlgNew');
const newPreset = $<HTMLSelectElement>('newPreset');
const newW = $<HTMLInputElement>('newW'), newH = $<HTMLInputElement>('newH');
function syncPresetToFields() {
  if (newPreset.value === 'custom') return;
  const [w, h] = newPreset.value.split('x');
  newW.value = w;
  newH.value = h;
}
newPreset.addEventListener('change', syncPresetToFields);
// Typing a size switches the preset to "Custom" unless it matches one exactly.
const syncFieldsToPreset = () => {
  const match = [...newPreset.options].find((o) => o.value === `${newW.value}x${newH.value}`);
  newPreset.value = match ? match.value : 'custom';
};
newW.addEventListener('input', syncFieldsToPreset);
newH.addEventListener('input', syncFieldsToPreset);
$('btnNew').onclick = () => { syncPresetToFields(); dlgNew.showModal(); };
dlgNew.addEventListener('close', () => {
  if (dlgNew.returnValue !== 'ok') return;
  let w = Number(newW.value), h = Number(newH.value);
  w = Math.max(8, Math.min(400, Math.round(w || 60)));
  h = Math.max(8, Math.min(400, Math.round(h || 45)));
  const m = new MapData(w, h, Number(($('newFill') as HTMLSelectElement).value) as T);
  m.name = ($('newName') as HTMLInputElement).value.trim() || 'Untitled map';
  m.grid = { ...map.grid };
  loadMap(m);
});

// Export dialog.
const dlgExport = $<HTMLDialogElement>('dlgExport');
const expPx = $<HTMLSelectElement>('expPx'), expArea = $<HTMLInputElement>('expArea'), expGrid = $<HTMLInputElement>('expGrid');
function exportArea(): Rect { return expArea.checked && state.area ? state.area : map.fullRect(); }
function updateExportInfo() {
  const a = exportArea(), px = Number(expPx.value);
  const w = a.w * px, h = a.h * px;
  const tooBig = w > 16384 || h > 16384 || w * h > 200_000_000;
  $('expInfo').innerHTML = `${w.toLocaleString()} × ${h.toLocaleString()} px` + (tooBig ? ' · <b style="color:var(--danger)">too large for the browser, pick fewer pixels per square or a smaller area</b>' : '');
  ($('expGo') as HTMLButtonElement).disabled = tooBig;
}
[expPx, expArea].forEach((el) => el.addEventListener('change', updateExportInfo));
$('btnExport').onclick = () => {
  expArea.disabled = !state.area;
  if (!state.area) expArea.checked = false;
  updateExportInfo();
  dlgExport.showModal();
};
dlgExport.addEventListener('close', async () => {
  if (dlgExport.returnValue !== 'ok') return;
  toast('Rendering image…');
  await new Promise((r) => setTimeout(r, 30));
  try {
    const blob = await exportPng(map, exportArea(), Number(expPx.value), expGrid.checked);
    downloadBlob(blob, `${safeName(map.name)}.png`);
    toast('Image exported');
  } catch (err) {
    toast((err as Error).message);
  }
});

// ---------- Status & toast ----------
function updateStatus() {
  const hv = state.hover;
  let s = `${map.width} × ${map.height} sq · ${map.objects.length} objects · ${Math.round(view.zoom * 100 / 16)}%`;
  if (hv && map.inBounds(Math.floor(hv.x), Math.floor(hv.y))) {
    s = `${Math.floor(hv.x)}, ${Math.floor(hv.y)} · ${TERRAIN[map.get(Math.floor(hv.x), Math.floor(hv.y))].name} · ` + s;
  }
  $('status').textContent = s;
}

let toastTimer = 0;
function toast(msg: string) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('show'), 1800);
}

// ---------- Boot ----------
nameInput.value = map.name;
($('genSeed') as HTMLInputElement).value = state.seed;
renderTerrainPalette();
renderGenList();
renderGenParams();
setTool('paint');
let fitted = false;
new ResizeObserver(() => {
  resize();
  if (!fitted && stage.clientWidth > 50 && stage.clientHeight > 50) { fitted = true; fitView(); }
}).observe(stage);
resize();
