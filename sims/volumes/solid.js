// A small three.js scene for solids of revolution.
import { THREE, Scene3D, makeLabel } from '../../assets/js/kit/scene3d.js';
import { clamp } from '../../assets/js/kit/dom.js';

const TAU = Math.PI * 2;

/**
 * Profile: { s0, s1, r(s) outer radius, ri(s) inner radius (0 for solid), axis: 'x' | 'y' }
 * The solid is swept through angle `phi` about the axis.
 * map(s, r, ang) gives world coordinates.
 */
const mapFor = (axis) => (axis === 'y' ? (s, r, a) => [r * Math.cos(a), s, r * Math.sin(a)] : (s, r, a) => [s, r * Math.cos(a), r * Math.sin(a)]);
const finite = (v) => (Number.isFinite(v) ? v : 0);

const TWO_PI = TAU;
/**
 * A set of (nu x nv) vertex grids merged into one geometry with fixed topology.
 * Each grid: { nu, nv, pos(i, j, phi) -> [x, y, z], shade }. update(phi) refills positions only.
 */
export class GridSet {
  constructor(grids) {
    this.grids = grids;
    let nv = 0, ni = 0;
    for (const g of grids) { g.off = nv; nv += (g.nu + 1) * (g.nv + 1); ni += g.nu * g.nv * 6; }
    this.pos = new Float32Array(nv * 3); const col = new Float32Array(nv * 3), idx = new Uint32Array(ni);
    let io = 0;
    for (const g of grids) {
      const W = g.nv + 1;
      for (let i = 0; i < g.nu; i++) for (let j = 0; j < g.nv; j++) { const a = g.off + i * W + j, b = a + 1, c = a + W, d = c + 1; idx.set([a, c, b, b, c, d], io); io += 6; }
      const sh = g.shade ?? 1; for (let k = 0; k < (g.nu + 1) * W; k++) { const o = (g.off + k) * 3; col[o] = col[o + 1] = col[o + 2] = sh; }
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.geometry.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  update(phi) {
    const p = this.pos;
    for (const g of this.grids) {
      let o = g.off * 3;
      for (let i = 0; i <= g.nu; i++) for (let j = 0; j <= g.nv; j++) { const v = g.pos(i, j, phi); p[o++] = v[0]; p[o++] = v[1]; p[o++] = v[2]; }
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
  }
}

export function surfaceGrids(P, map, nS, nA) {
  const { s0, s1, r, ri } = P, out = [];
  const S = (i) => s0 + ((s1 - s0) * i) / nS;
  const R = (s) => Math.max(0, finite(r(s))), Ri = (s) => Math.max(0, finite(ri ? ri(s) : 0));
  const ang = (j, phi) => (phi * j) / nA;
  out.push({ nu: nS, nv: nA, pos: (i, j, phi) => map(S(i), R(S(i)), ang(j, phi)) });
  if (ri) out.push({ nu: nS, nv: nA, pos: (i, j, phi) => map(S(i), Ri(S(i)), ang(j, phi)) });
  for (const s of [s0, s1]) if (R(s) - Ri(s) > 1e-9) out.push({ nu: 1, nv: nA, pos: (i, j, phi) => map(s, i ? R(s) : Ri(s), ang(j, phi)) });
  out.push({ nu: nS, nv: 1, pos: (i, j) => map(S(i), j ? R(S(i)) : Ri(S(i)), 0) });
  out.push({ nu: nS, nv: 1, pos: (i, j, phi) => map(S(i), j ? R(S(i)) : Ri(S(i)), phi) });
  return out;
}

/** Slices (discs or washers) with mid-point radii. */
export function sliceGrids(P, map, N, nA) {
  const { s0, s1, r, ri } = P, h = (s1 - s0) / N, out = [];
  for (let k = 0; k < N; k++) {
    const x0 = s0 + k * h + h * 0.02, x1 = s0 + (k + 1) * h - h * 0.02, m = s0 + (k + 0.5) * h;
    const R = Math.max(0, finite(r(m))), Ri = Math.max(0, finite(ri ? ri(m) : 0)), shade = k % 2 ? 0.8 : 1;
    const ang = (j, phi) => (phi * j) / nA;
    const add = (g) => { g.shade = shade; out.push(g); };
    add({ nu: 1, nv: nA, pos: (i, j, phi) => map(i ? x1 : x0, R, ang(j, phi)) });
    if (Ri > 0) add({ nu: 1, nv: nA, pos: (i, j, phi) => map(i ? x1 : x0, Ri, ang(j, phi)) });
    for (const s of [x0, x1]) add({ nu: 1, nv: nA, pos: (i, j, phi) => map(s, i ? R : Ri, ang(j, phi)) });
    add({ nu: 1, nv: 1, pos: (i, j) => map(i ? x1 : x0, j ? R : Ri, 0) });
    add({ nu: 1, nv: 1, pos: (i, j, phi) => map(i ? x1 : x0, j ? R : Ri, phi) });
  }
  return out;
}

export { THREE, Scene3D, makeLabel, TAU, mapFor, clamp };
