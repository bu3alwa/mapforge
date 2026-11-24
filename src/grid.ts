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

/** Smallest on-screen spacing (in world units) between grid lines, used to hide the grid when it would be noise. */
export function gridSpacing(g: GridSpec): number {
  return g.type === 'square' ? 1 : g.size * 0.58;
}
