// Pure Riemann-sum maths (no DOM) so it can be tested in node.

export const RULES = ['left', 'right', 'mid', 'trap'];

/** Estimate of the integral of f over [a, b] with n strips using the given rule. */
export function sumRule(f, a, b, n, rule) {
  const h = (b - a) / n;
  let s = 0;
  if (rule === 'trap') {
    s = (f(a) + f(b)) / 2;
    for (let i = 1; i < n; i++) s += f(a + i * h);
  } else {
    const off = rule === 'left' ? 0 : rule === 'right' ? 1 : 0.5;
    for (let i = 0; i < n; i++) s += f(a + (i + off) * h);
  }
  return s * h;
}

/** Height of the sup/inf of f on [x0, x1] by dense sampling (exact for monotone functions). */
export function supInf(f, x0, x1, m = 24) {
  let lo = Infinity, hi = -Infinity;
  for (let k = 0; k <= m; k++) {
    const y = f(x0 + ((x1 - x0) * k) / m);
    if (y < lo) lo = y;
    if (y > hi) hi = y;
  }
  return [lo, hi];
}

/** Lower and upper sums (Darboux style) over n equal strips. */
export function lowerUpper(f, a, b, n) {
  const h = (b - a) / n;
  let L = 0, U = 0;
  for (let i = 0; i < n; i++) {
    const [lo, hi] = supInf(f, a + i * h, a + (i + 1) * h, n > 300 ? 6 : 16);
    L += lo; U += hi;
  }
  return [L * h, U * h];
}

/** Strip counts offered by the slider. */
export const NS = [...Array.from({ length: 20 }, (_, i) => i + 1), 24, 28, 32, 40, 50, 64, 80, 100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000];
