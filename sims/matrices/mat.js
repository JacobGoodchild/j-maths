// 2x2 matrices as [a, b, c, d] meaning ((a, b), (c, d)). Columns are the images of the basis vectors.
export const I2 = [1, 0, 0, 1];
export const det = (m) => m[0] * m[3] - m[1] * m[2];
export const trace = (m) => m[0] + m[3];
/** product A·B (apply B first, then A) */
export const mul = (A, B) => [A[0] * B[0] + A[1] * B[2], A[0] * B[1] + A[1] * B[3], A[2] * B[0] + A[3] * B[2], A[2] * B[1] + A[3] * B[3]];
export const apply = (m, x, y) => [m[0] * x + m[1] * y, m[2] * x + m[3] * y];
export const lerp = (A, B, t) => A.map((v, i) => v + (B[i] - v) * t);
const rad = (d) => (d * Math.PI) / 180;

/** Real eigenpairs, or [] when the eigenvalues are complex. Each: { value, vec: [x, y] (unit) } */
export function eigen(m) {
  const [a, b, c, d] = m, tr = a + d, D = det(m), disc = tr * tr - 4 * D;
  if (disc < -1e-12) return [];
  const s = Math.sqrt(Math.max(0, disc));
  const vals = s < 1e-9 ? [tr / 2] : [(tr + s) / 2, (tr - s) / 2];
  const out = [];
  for (const v of vals) {
    let vec;
    if (Math.abs(b) > 1e-9) vec = [b, v - a];
    else if (Math.abs(c) > 1e-9) vec = [v - d, c];
    else vec = Math.abs(v - a) < 1e-9 && (vals.length === 1 || Math.abs(v - a) <= Math.abs(v - d)) ? [1, 0] : [0, 1];
    if (b === 0 && c === 0 && vals.length === 2) vec = Math.abs(v - a) < 1e-12 ? [1, 0] : [0, 1];
    const L = Math.hypot(vec[0], vec[1]);
    if (L < 1e-12) continue;
    out.push({ value: v, vec: [vec[0] / L, vec[1] / L] });
  }
  // scalar matrices: every direction is an eigenvector; report none to keep the picture clean
  if (Math.abs(b) < 1e-9 && Math.abs(c) < 1e-9 && Math.abs(a - d) < 1e-9) return [{ value: a, vec: null }];
  return out;
}

/** Presets (MEI formula booklet conventions). `at(p, t)` is the matrix part-way through the transformation. */
export const PRESETS = {
  identity: { label: 'Identity', matrix: () => I2 },
  rotation: {
    label: 'Rotation', param: { name: '\\theta', min: -180, max: 180, step: 5, value: 90, unit: '°' },
    matrix: (p) => { const t = rad(p); return [Math.cos(t), -Math.sin(t), Math.sin(t), Math.cos(t)]; },
    at: (p, t) => PRESETS.rotation.matrix(p * t),
  },
  reflection: {
    label: 'Reflection', param: { name: '\\theta', min: 0, max: 180, step: 5, value: 45, unit: '°', hint: 'in $y=(\\tan\\theta)x$' },
    matrix: (p) => { const t = rad(2 * p); return [Math.cos(t), Math.sin(t), Math.sin(t), -Math.cos(t)]; },
  },
  enlargement: { label: 'Enlargement', param: { name: 'k', min: -3, max: 3, step: 0.25, value: 2 }, matrix: (p) => [p, 0, 0, p] },
  stretch: {
    label: 'Stretch', param: { name: 'k', min: -3, max: 3, step: 0.25, value: 2 }, dirs: ['x', 'y'],
    matrix: (p, dir) => (dir === 'y' ? [1, 0, 0, p] : [p, 0, 0, 1]),
  },
  shear: {
    label: 'Shear', param: { name: 'k', min: -3, max: 3, step: 0.25, value: 1 }, dirs: ['x', 'y'],
    matrix: (p, dir) => (dir === 'y' ? [1, 0, p, 1] : [1, p, 0, 1]),
  },
};
export function presetMatrix(key, p, dir) { return PRESETS[key].matrix(p, dir); }
export function presetAt(key, p, dir, t) {
  const P = PRESETS[key];
  return P.at ? P.at(p, t, dir) : lerp(I2, P.matrix(p, dir), t);
}

/** The letter F used to show reflections and rotations */
export const F_SHAPE = [[0.5, 0.5], [1.0, 0.5], [1.0, 1.5], [1.8, 1.5], [1.8, 2.0], [1.0, 2.0], [1.0, 2.5], [2.0, 2.5], [2.0, 3.0], [0.5, 3.0]];
