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

// ================= 3 x 3 =================
// Row-major: [a b c  d e f  g h i]; columns are the images of the basis vectors.
export const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
export const det3 = (m) => m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
export const apply3 = (m, x, y, z) => [m[0] * x + m[1] * y + m[2] * z, m[3] * x + m[4] * y + m[5] * z, m[6] * x + m[7] * y + m[8] * z];
export const mul3 = (A, B) => { const o = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o.push(A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c]); return o; };
export const lerp3 = (A, B, t) => A.map((v, i) => v + (B[i] - v) * t);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v) => Math.hypot(v[0], v[1], v[2]);

/** Real roots of the characteristic polynomial det(A - lambda I) = 0 (sorted, distinct). */
export function eigenvalues3(m) {
  const tr = m[0] + m[4] + m[8];
  const c2 = (m[0] * m[4] - m[1] * m[3]) + (m[0] * m[8] - m[2] * m[6]) + (m[4] * m[8] - m[5] * m[7]);
  const a = -tr, b = c2, c = -det3(m);
  const p = b - (a * a) / 3, q = (2 * a ** 3) / 27 - (a * b) / 3 + c, D = (q / 2) ** 2 + (p / 3) ** 3;
  let ts = [];
  const eps = 1e-12 * Math.max(1, Math.abs(p), Math.abs(q));
  if (Math.abs(p) < eps && Math.abs(q) < eps) ts = [0];
  else if (D > eps) { const s = Math.sqrt(D); ts = [Math.cbrt(-q / 2 + s) + Math.cbrt(-q / 2 - s)]; }
  else if (D >= -eps) ts = [(3 * q) / p, (-3 * q) / (2 * p)];
  else { const r = 2 * Math.sqrt(-p / 3), ph = Math.acos(Math.max(-1, Math.min(1, ((3 * q) / (2 * p)) * Math.sqrt(-3 / p)))) / 3; ts = [0, 1, 2].map((k) => r * Math.cos(ph - (2 * Math.PI * k) / 3)); }
  let vals = ts.map((t) => t - a / 3).sort((x, y) => x - y);
  // polish with Newton on the characteristic polynomial
  const f = (x) => ((x + a) * x + b) * x + c, df = (x) => (3 * x + 2 * a) * x + b;
  vals = vals.map((x) => { for (let i = 0; i < 4; i++) { const d = df(x); if (Math.abs(d) < 1e-12) break; x -= f(x) / d; } return x; });
  return vals.filter((v, i) => i === 0 || Math.abs(v - vals[i - 1]) > 1e-6);
}
/** Eigenpairs { value, vec (unit) or null when the eigenspace is a plane or all of space } */
export function eigen3(m) {
  return eigenvalues3(m).map((value) => {
    const B = m.slice(); B[0] -= value; B[4] -= value; B[8] -= value;
    const r = [[B[0], B[1], B[2]], [B[3], B[4], B[5]], [B[6], B[7], B[8]]];
    const cs = [cross(r[0], r[1]), cross(r[0], r[2]), cross(r[1], r[2])];
    let best = cs[0]; for (const c of cs) if (norm(c) > norm(best)) best = c;
    const L = norm(best), scale = Math.max(1, ...m.map(Math.abs)) ** 2;
    return { value, vec: L > 1e-7 * scale ? best.map((x) => x / L) : null };
  });
}

const r3 = (deg) => (deg * Math.PI) / 180;
export const PRESETS3 = {
  identity: { label: 'Identity', matrix: () => I3 },
  rotation: {
    label: 'Rotation', param: { name: '\\theta', min: -180, max: 180, step: 5, value: 90, unit: '°' }, dirs: ['x', 'y', 'z'], dirLabel: 'About the axis',
    matrix: (p, d) => { const c = Math.cos(r3(p)), s = Math.sin(r3(p)); return d === 'x' ? [1, 0, 0, 0, c, -s, 0, s, c] : d === 'y' ? [c, 0, s, 0, 1, 0, -s, 0, c] : [c, -s, 0, s, c, 0, 0, 0, 1]; },
    at: (p, d, t) => PRESETS3.rotation.matrix(p * t, d),
  },
  reflection: { label: 'Reflection', dirs: ['x', 'y', 'z'], dirLabel: 'In the plane', dirText: { x: '$x=0$', y: '$y=0$', z: '$z=0$' }, matrix: (p, d) => [d === 'x' ? -1 : 1, 0, 0, 0, d === 'y' ? -1 : 1, 0, 0, 0, d === 'z' ? -1 : 1] },
  enlargement: { label: 'Enlargement', param: { name: 'k', min: -3, max: 3, step: 0.25, value: 2 }, matrix: (p) => [p, 0, 0, 0, p, 0, 0, 0, p] },
  stretch: { label: 'Stretch', param: { name: 'k', min: -3, max: 3, step: 0.25, value: 2 }, dirs: ['x', 'y', 'z'], dirLabel: 'In the direction', matrix: (p, d) => [d === 'x' ? p : 1, 0, 0, 0, d === 'y' ? p : 1, 0, 0, 0, d === 'z' ? p : 1] },
  shear: {
    label: 'Shear', param: { name: 'k', min: -3, max: 3, step: 0.25, value: 1 }, dirs: ['xy', 'yz', 'zx'], dirLabel: 'Shear', dirText: { xy: '$x$ by $y$', yz: '$y$ by $z$', zx: '$z$ by $x$' },
    matrix: (p, d) => (d === 'xy' ? [1, p, 0, 0, 1, 0, 0, 0, 1] : d === 'yz' ? [1, 0, 0, 0, 1, p, 0, 0, 1] : [1, 0, 0, 0, 1, 0, p, 0, 1]),
  },
};
export function preset3(key, p, dir) { return PRESETS3[key].matrix(p, dir); }
export function preset3At(key, p, dir, t) { const P = PRESETS3[key]; return P.at ? P.at(p, dir, t) : lerp3(I3, P.matrix(p, dir), t); }
