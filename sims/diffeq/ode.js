// First-order ODE helpers y' = f(x, y), plus the constant-coefficient second-order solution. No DOM.

export const ODES = {
  grow: { label: "$y'=y$", f: (x, y) => y, exact: (x0, y0) => (x) => y0 * Math.exp(x - x0), view: { x: [-3, 3], y: [-3, 3] }, start: [0, 0.5] },
  lin: { label: "$y'=x$", f: (x) => x, exact: (x0, y0) => (x) => y0 + (x * x - x0 * x0) / 2, view: { x: [-3, 3], y: [-3, 3] }, start: [-2, 1] },
  sum: { label: "$y'=x+y$", f: (x, y) => x + y, exact: (x0, y0) => (x) => (y0 + x0 + 1) * Math.exp(x - x0) - x - 1, view: { x: [-3, 3], y: [-3, 3] }, start: [0, 0.2] },
  sep: { label: "$y'=xy$", f: (x, y) => x * y, exact: (x0, y0) => (x) => y0 * Math.exp((x * x - x0 * x0) / 2), view: { x: [-3, 3], y: [-3, 3] }, start: [0, 0.5] },
  logistic: { label: "$y'=y(1-y)$", f: (x, y) => y * (1 - y), exact: (x0, y0) => (x) => 1 / (1 + ((1 - y0) / y0) * Math.exp(-(x - x0))), view: { x: [-4, 6], y: [-1, 2] }, start: [0, 0.15] },
  circle: { label: "$y'=-x/y$", f: (x, y) => -x / y, exact: null, view: { x: [-4, 4], y: [-3, 3] }, start: [0, 2] },
  wave: { label: "$y'=\\sin x-y$", f: (x, y) => Math.sin(x) - y, exact: (x0, y0) => (x) => { const c = y0 - (Math.sin(x0) - Math.cos(x0)) / 2; return (Math.sin(x) - Math.cos(x)) / 2 + c * Math.exp(-(x - x0)); }, view: { x: [-1, 9], y: [-2, 2] }, start: [0, 1.2] },
  quad: { label: "$y'=x^2+y^2$", f: (x, y) => x * x + y * y, exact: null, view: { x: [-2, 2], y: [-2, 2] }, start: [-1, -1] },
};

/** Euler steps: returns the points [[x0,y0],[x1,y1],...] */
export function euler(f, x0, y0, h, n) {
  const pts = [[x0, y0]]; let x = x0, y = y0;
  for (let i = 0; i < n; i++) { y += h * f(x, y); x = x0 + (i + 1) * h; pts.push([x, y]); }
  return pts;
}
/** Improved Euler (Heun): y_{n+1} = y_n + h/2 (k1 + k2), k1 = f(x_n, y_n), k2 = f(x_n + h, y_n + h k1) */
export function improvedEuler(f, x0, y0, h, n) {
  const pts = [[x0, y0]]; let x = x0, y = y0;
  for (let i = 0; i < n; i++) { const k1 = f(x, y), k2 = f(x + h, y + h * k1); y += (h / 2) * (k1 + k2); x = x0 + (i + 1) * h; pts.push([x, y]); }
  return pts;
}
export function rk4Step(f, x, y, h) {
  const k1 = f(x, y), k2 = f(x + h / 2, y + (h / 2) * k1), k3 = f(x + h / 2, y + (h / 2) * k2), k4 = f(x + h, y + h * k3);
  return y + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
}
/** Accurate solution curve through (x0, y0) from xa to xb (RK4, fine steps). Stops if the solution blows up. */
export function solve(f, x0, y0, xa, xb, steps = 600) {
  const go = (dir, lim) => {
    const pts = []; let x = x0, y = y0; const h = ((lim - x0) / steps);
    if ((lim - x0) * dir <= 0) return pts;
    for (let i = 0; i < steps; i++) { const yn = rk4Step(f, x, y, h); x += h; y = yn; if (!Number.isFinite(y) || Math.abs(y) > 1e6) break; pts.push([x, y]); }
    return pts;
  };
  const right = go(1, xb), left = go(-1, xa).reverse();
  return [...left, [x0, y0], ...right];
}

/** y'' + 2 zeta omega y' + omega^2 y = 0 with y(0) = y0, y'(0) = v0. Returns { y(t), dy(t), kind, roots: [[re, im], ...] } */
export function oscillator(omega, zeta, y0, v0) {
  const w = omega, disc = zeta * zeta - 1;
  if (zeta < 1 - 1e-9) {
    const wd = w * Math.sqrt(1 - zeta * zeta), a = zeta * w, A = y0, B = (v0 + a * y0) / wd;
    return {
      kind: 'under', roots: [[-a, wd], [-a, -wd]], wd,
      y: (t) => Math.exp(-a * t) * (A * Math.cos(wd * t) + B * Math.sin(wd * t)),
      dy: (t) => Math.exp(-a * t) * ((B * wd - a * A) * Math.cos(wd * t) + (-A * wd - a * B) * Math.sin(wd * t)),
    };
  }
  if (zeta <= 1 + 1e-9) {
    const A = y0, B = v0 + w * y0;
    return { kind: 'critical', roots: [[-w, 0], [-w, 0]], y: (t) => (A + B * t) * Math.exp(-w * t), dy: (t) => (B - w * (A + B * t)) * Math.exp(-w * t) };
  }
  const s = w * Math.sqrt(disc), r1 = -zeta * w + s, r2 = -zeta * w - s, C1 = (v0 - r2 * y0) / (r1 - r2), C2 = y0 - C1;
  return { kind: 'over', roots: [[r1, 0], [r2, 0]], y: (t) => C1 * Math.exp(r1 * t) + C2 * Math.exp(r2 * t), dy: (t) => C1 * r1 * Math.exp(r1 * t) + C2 * r2 * Math.exp(r2 * t) };
}
