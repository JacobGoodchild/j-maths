// Root-finding maths (no DOM).

export const FUNCS = {
  sq2: { label: '$x^2-2$', f: (x) => x * x - 2, df: (x) => 2 * x, view: { x: [-3.2, 3.2], y: [-3, 7] }, x0: 2, note: 'Converges quickly to √2' },
  cycle: { label: '$x^3-2x+2$', f: (x) => x ** 3 - 2 * x + 2, df: (x) => 3 * x * x - 2, view: { x: [-3, 3], y: [-4, 8] }, x0: 0, note: 'Starting at 0 gives a cycle' },
  shoot: { label: '$x^2-2$ (near $0$)', f: (x) => x * x - 2, df: (x) => 2 * x, view: { x: [-3.2, 3.2], y: [-3, 7] }, x0: 0.15, note: 'Near a stationary point' },
  atan: { label: '$\\arctan x$', f: Math.atan, df: (x) => 1 / (1 + x * x), view: { x: [-9, 9], y: [-2.2, 2.2] }, x0: 1.6, note: 'Diverges when started too far out' },
  cbrt: { label: '$\\sqrt[3]{x}$', f: Math.cbrt, df: (x) => (x === 0 ? Infinity : 1 / (3 * Math.cbrt(x) ** 2)), view: { x: [-6, 6], y: [-2.2, 2.2] }, x0: 1, note: 'Each step doubles the distance' },
  sin: { label: '$\\sin x$', f: Math.sin, df: Math.cos, view: { x: [-10, 10], y: [-2, 2] }, x0: 1.4, note: 'Lands on a far-away root' },
  cubic3: { label: '$x^3-6x^2+11x-6$', f: (x) => x ** 3 - 6 * x * x + 11 * x - 6, df: (x) => 3 * x * x - 12 * x + 11, view: { x: [-0.5, 4.5], y: [-4, 5] }, x0: 1.7, note: 'Three roots: 1, 2, 3' },
  double: { label: '$(x-1)^2$', f: (x) => (x - 1) ** 2, df: (x) => 2 * (x - 1), view: { x: [-1.5, 4.5], y: [-1, 6] }, x0: 3.5, note: 'A repeated root: slow convergence' },
  cosx: { label: '$\\cos x-x$', f: (x) => Math.cos(x) - x, df: (x) => -Math.sin(x) - 1, view: { x: [-3, 3], y: [-4, 3] }, x0: 2.5, note: '' },
  expm: { label: '$e^x-3$', f: (x) => Math.exp(x) - 3, df: Math.exp, view: { x: [-3, 3.5], y: [-4, 10] }, x0: -1, note: '' },
};

/** One Newton–Raphson step. status: 'ok' | 'flat' (f' = 0) | 'bad' (non-finite) */
export function newtonStep(f, df, x) {
  const fx = f(x), d = df(x);
  if (!Number.isFinite(fx) || !Number.isFinite(d)) return { x: NaN, status: 'bad' };
  if (d === 0) return { x, status: 'flat' };
  const x1 = x - fx / d;
  return Number.isFinite(x1) ? { x: x1, status: 'ok' } : { x: NaN, status: 'bad' };
}

/** Run up to N steps from x0. Stops when |x_{n+1} - x_n| < tol. Returns iterates and an outcome. */
export function newtonRun(f, df, x0, N = 60, tol = 1e-12) {
  const xs = [x0];
  let status = 'running';
  for (let i = 0; i < N; i++) {
    const s = newtonStep(f, df, xs[xs.length - 1]);
    if (s.status !== 'ok') { status = s.status; break; }
    xs.push(s.x);
    if (Math.abs(s.x - xs[xs.length - 2]) < tol * Math.max(1, Math.abs(s.x))) { status = 'converged'; break; }
    if (Math.abs(s.x) > 1e8) { status = 'diverged'; break; }
  }
  if (status === 'running') status = 'unresolved';
  return { xs, status };
}

/** All roots of f in [a, b] found by sign-change scan and polished with bisection + Newton */
export function findRoots(f, df, a, b, N = 4000) {
  const roots = [];
  let px = a, py = f(a);
  for (let i = 1; i <= N; i++) {
    const x = a + ((b - a) * i) / N, y = f(x);
    if (Number.isFinite(py) && Number.isFinite(y) && py * y <= 0 && !(py === 0 && y === 0)) {
      let lo = px, hi = x, flo = py;
      for (let k = 0; k < 80; k++) { const m = (lo + hi) / 2, fm = f(m); if (flo * fm <= 0) hi = m; else { lo = m; flo = fm; } }
      const r = (lo + hi) / 2;
      // reject jump discontinuities (|f| should be tiny at the root)
      if (Math.abs(f(r)) < 1e-6 && !roots.some((q) => Math.abs(q - r) < 1e-6)) roots.push(r);
    }
    px = x; py = y;
  }
  return roots;
}

/** Index of the root that x0 converges to, -1 if it does not converge to any listed root */
export function basinIndex(f, df, roots, x0, N = 80) {
  let x = x0;
  for (let i = 0; i < N; i++) {
    const s = newtonStep(f, df, x);
    if (s.status !== 'ok') return -1;
    x = s.x;
    if (Math.abs(x) > 1e9) return -1;
    for (let k = 0; k < roots.length; k++) if (Math.abs(x - roots[k]) < 1e-9 * Math.max(1, Math.abs(roots[k]))) return k;
  }
  for (let k = 0; k < roots.length; k++) if (Math.abs(x - roots[k]) < 1e-6) return k;
  return -1;
}

/** Bisection: returns the sequence of brackets [a, b] */
export function bisect(f, a, b, N = 40) {
  const out = [[a, b]];
  let fa = f(a);
  for (let i = 0; i < N; i++) {
    const c = (a + b) / 2, fc = f(c);
    if (fc === 0) { a = b = c; out.push([a, b]); break; }
    if (fa * fc < 0) b = c; else { a = c; fa = fc; }
    out.push([a, b]);
  }
  return out;
}
