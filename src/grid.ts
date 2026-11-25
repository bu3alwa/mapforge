// Grid overlays: plain squares, or hexes laid over the square tile map.
// Everything here works in world units (1 = one 5 ft square); callers set the transform.

export type GridType = 'square' | 'hex-pointy' | 'hex-flat';
export const GRID_TYPES: GridType[] = ['square', 'hex-pointy', 'hex-flat'];
/** Hex sizes offered, as the flat-to-flat width in squares. */
export const HEX_SIZES = [1, 2, 3, 6];

export interface GridSpec {
  type: GridType;
  /** Hex width across the flats, in squares (ignored for square grids). */
  size: number;
  /** On a hex grid, keep drawing terrain as squares instead of whole hexes. */
  squares?: boolean;
}

/**
 * Add grid lines for the world rectangle [x0,x1]×[y0,y1] to the current path.
 * Pointy-top hexes form horizontal rows; flat-top hexes form vertical columns.
 * The first hex's corner sits at the map origin so the layout is stable when the map is cropped.
 */
export function addGridPath(c: CanvasRenderingContext2D, g: GridSpec, x0: number, y0: number, x1: number, y1: number) {
  if (g.type === 'square') {
    for (let x = Math.ceil(x0); x <= Math.floor(x1); x++) { c.moveTo(x, y0); c.lineTo(x, y1); }
    for (let y = Math.ceil(y0); y <= Math.floor(y1); y++) { c.moveTo(x0, y); c.lineTo(x1, y); }
    return;
  }
  // Work in (u, v): u runs along a row of hexes, v across rows. Flat-top swaps the axes.
  const flat = g.type === 'hex-flat';
  const s = g.size;
  const R = s / Math.sqrt(3);
  const rowH = 1.5 * R;
  const [u0, u1, v0, v1] = flat ? [y0, y1, x0, x1] : [x0, x1, y0, y1];
  const put = (u: number, v: number, move: boolean) => {
    const [x, y] = flat ? [v, u] : [u, v];
    if (move) c.moveTo(x, y); else c.lineTo(x, y);
  };
  const r0 = Math.floor((v0 - 2 * R) / rowH), r1 = Math.ceil(v1 / rowH);
  const q0 = Math.floor(u0 / s) - 1, q1 = Math.ceil(u1 / s);
  for (let r = r0; r <= r1; r++) {
    const cv = R + r * rowH;
    const shift = (r & 1) * s / 2;
    for (let q = q0; q <= q1; q++) {
      const cu = s / 2 + q * s + shift;
      for (let k = 0; k <= 6; k++) {
        const a = (Math.PI / 3) * k - Math.PI / 2;
        put(cu + R * Math.cos(a), cv + R * Math.sin(a), k === 0);
      }
    }
  }
}

// ---------- Hex cells ----------
// Offset coordinates (q along a row, r = row index, odd rows shifted half a hex), the same layout addGridPath draws.

export const isHex = (g: GridSpec) => g.type !== 'square';

function dims(g: GridSpec) {
  const s = g.size, R = s / Math.sqrt(3);
  return { s, R, rowH: 1.5 * R, flat: g.type === 'hex-flat' };
}

/** Pack (q, r) into one number for use as a map key. */
export const hexKey = (q: number, r: number) => (q + 32768) * 65536 + (r + 32768);
export const hexFromKey = (k: number) => ({ q: Math.floor(k / 65536) - 32768, r: (k % 65536) - 32768 });

export function hexCenter(g: GridSpec, q: number, r: number) {
  const { s, R, rowH, flat } = dims(g);
  const u = s / 2 + q * s + (r & 1) * s / 2, v = R + r * rowH;
  return flat ? { x: v, y: u } : { x: u, y: v };
}

/** The hex containing world point (x, y): the one whose centre is nearest. */
export function hexAt(g: GridSpec, x: number, y: number) {
  const { s, R, rowH, flat } = dims(g);
  const [u, v] = flat ? [y, x] : [x, y];
  const rr = Math.round((v - R) / rowH);
  let best = { q: 0, r: 0 }, bd = Infinity;
  for (let r = rr - 1; r <= rr + 1; r++) {
    const shift = (r & 1) * s / 2;
    const qq = Math.round((u - s / 2 - shift) / s);
    for (let q = qq - 1; q <= qq + 1; q++) {
      const du = s / 2 + q * s + shift - u, dv = R + r * rowH - v;
      const d = du * du + dv * dv;
      if (d < bd) { bd = d; best = { q, r }; }
    }
  }
  return best;
}

/** Corner points of a hex, optionally grown a little to hide seams between neighbours. */
export function hexCorners(g: GridSpec, q: number, r: number, grow = 0): number[] {
  const { R, flat } = dims(g);
  const c = hexCenter(g, q, r);
  const rad = R + grow;
  const pts: number[] = [];
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 3) * k - Math.PI / 2;
    const du = rad * Math.cos(a), dv = rad * Math.sin(a);
    pts.push(c.x + (flat ? dv : du), c.y + (flat ? du : dv));
  }
  return pts;
}

/** Tile-aligned bounding box of a hex. */
export function hexBounds(g: GridSpec, q: number, r: number) {
  const p = hexCorners(g, q, r);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < 12; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]); }
  const bx = Math.floor(x0), by = Math.floor(y0);
  return { x: bx, y: by, w: Math.ceil(x1) - bx, h: Math.ceil(y1) - by };
}

/** Hexes within `n` steps of (q, r), including itself. */
export function hexRange(q: number, r: number, n: number): { q: number; r: number }[] {
  // Offset -> axial, walk the range, axial -> offset.
  const aq = q - (r - (r & 1)) / 2;
  const out: { q: number; r: number }[] = [];
  for (let dq = -n; dq <= n; dq++)
    for (let dr = Math.max(-n, -dq - n); dr <= Math.min(n, -dq + n); dr++) {
      const nr = r + dr, nq = aq + dq;
      out.push({ q: nq + (nr - (nr & 1)) / 2, r: nr });
    }
  return out;
}

/** The six neighbours of a hex. */
export function hexNeighbors(q: number, r: number) {
  const odd = r & 1;
  return [
    { q: q + 1, r }, { q: q - 1, r },
    { q: q - 1 + odd, r: r - 1 }, { q: q + odd, r: r - 1 },
    { q: q - 1 + odd, r: r + 1 }, { q: q + odd, r: r + 1 },
  ];
}

/** Offset-coordinate ranges of hexes that may overlap the world rect. */
export function hexesInRect(g: GridSpec, x0: number, y0: number, x1: number, y1: number) {
  const { s, R, rowH, flat } = dims(g);
  const [u0, u1, v0, v1] = flat ? [y0, y1, x0, x1] : [x0, x1, y0, y1];
  return {
    r0: Math.floor((v0 - 2 * R) / rowH), r1: Math.ceil(v1 / rowH),
    q0: Math.floor(u0 / s) - 1, q1: Math.ceil(u1 / s),
  };
}

/** Smallest on-screen spacing (in world units) between grid lines, used to hide the grid when it would be noise. */
export function gridSpacing(g: GridSpec): number {
  return g.type === 'square' ? 1 : g.size * 0.58;
}
