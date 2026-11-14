// Complex number helpers (no DOM). A complex number is [re, im].
export const cadd = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const csub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
export const cdiv = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
export const conj = (a) => [a[0], -a[1]];
export const mod = (a) => Math.hypot(a[0], a[1]);
export const arg = (a) => Math.atan2(a[1], a[0]);
export const polar = (r, t) => [r * Math.cos(t), r * Math.sin(t)];
/** All n-th roots of w, k = 0..n-1; the principal root first (argument in (-pi/n, pi/n]). */
export function roots(w, n) {
  const r = Math.pow(mod(w), 1 / n), t = arg(w);
  return Array.from({ length: n }, (_, k) => polar(r, (t + 2 * Math.PI * k) / n));
}
/** Partial sums S_m = sum_{j<m} (i*theta)^j / j!  as a list of points (S_0 = 0 excluded: S_1 = 1, ...) */
export function expSums(theta, m) {
  const out = []; let term = [1, 0], s = [0, 0];
  for (let j = 0; j < m; j++) { s = cadd(s, term); out.push(s); term = cmul(term, [0, theta]); term = [term[0] / (j + 1), term[1] / (j + 1)]; }
  return out;
}
