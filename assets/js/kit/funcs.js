// Shared function library for the calculus sims. Each entry has f, and analytic f' (df), f'' (ddf), and an
// antiderivative F where one exists in closed form. `view` is a good default window.
const PI = Math.PI;
const sec2 = (x) => 1 / Math.cos(x) ** 2;
const cbrt = Math.cbrt;

export const FUNCS = {
  x2: { label: '$x^2$', f: (x) => x * x, df: (x) => 2 * x, ddf: () => 2, F: (x) => x ** 3 / 3, view: { x: [-4.5, 4.5], y: [-2.5, 10] }, ab: [0, 3] },
  cubic: { label: '$x^3-3x$', f: (x) => x ** 3 - 3 * x, df: (x) => 3 * x * x - 3, ddf: (x) => 6 * x, F: (x) => x ** 4 / 4 - 1.5 * x * x, view: { x: [-3.2, 3.2], y: [-4.5, 4.5] }, ab: [-1.5, 2.5] },
  quartic: { label: '$x^4-4x^2$', f: (x) => x ** 4 - 4 * x * x, df: (x) => 4 * x ** 3 - 8 * x, ddf: (x) => 12 * x * x - 8, F: (x) => x ** 5 / 5 - (4 * x ** 3) / 3, view: { x: [-3, 3], y: [-5.5, 6] }, ab: [-2.5, 2.5] },
  sin: { label: '$\\sin x$', f: Math.sin, df: Math.cos, ddf: (x) => -Math.sin(x), F: (x) => -Math.cos(x), view: { x: [-1, 7.4], y: [-1.9, 1.9] }, ab: [0, PI], trig: true },
  cos: { label: '$\\cos x$', f: Math.cos, df: (x) => -Math.sin(x), ddf: (x) => -Math.cos(x), F: Math.sin, view: { x: [-1, 7.4], y: [-1.9, 1.9] }, ab: [0, PI / 2], trig: true },
  tan: { label: '$\\tan x$', f: Math.tan, df: sec2, ddf: (x) => 2 * sec2(x) * Math.tan(x), view: { x: [-5.2, 5.2], y: [-5, 5] }, trig: true, asym: true },
  exp: { label: '$e^x$', f: Math.exp, df: Math.exp, ddf: Math.exp, F: Math.exp, view: { x: [-3, 3.5], y: [-2, 18] }, ab: [0, 2] },
  ln: { label: '$\\ln x$', f: (x) => (x > 0 ? Math.log(x) : NaN), df: (x) => (x > 0 ? 1 / x : NaN), ddf: (x) => (x > 0 ? -1 / (x * x) : NaN), F: (x) => x * Math.log(x) - x, view: { x: [-0.8, 7], y: [-3.5, 3.5] }, ab: [1, 5], domain: [1e-3, Infinity] },
  sqrt: { label: '$\\sqrt{x}$', f: (x) => (x >= 0 ? Math.sqrt(x) : NaN), df: (x) => (x > 0 ? 0.5 / Math.sqrt(x) : NaN), ddf: (x) => (x > 0 ? -0.25 / x ** 1.5 : NaN), F: (x) => (2 / 3) * x ** 1.5, view: { x: [-0.8, 7], y: [-1.2, 3.5] }, ab: [0, 4], domain: [0, Infinity] },
  recip: { label: '$\\dfrac{1}{x}$', f: (x) => 1 / x, df: (x) => -1 / (x * x), ddf: (x) => 2 / x ** 3, F: Math.log, view: { x: [-5, 6], y: [-5, 5] }, ab: [1, 5], domain: [1e-3, Infinity], asym: true },
  xsin: { label: '$x\\sin x$', f: (x) => x * Math.sin(x), df: (x) => Math.sin(x) + x * Math.cos(x), ddf: (x) => 2 * Math.cos(x) - x * Math.sin(x), F: (x) => Math.sin(x) - x * Math.cos(x), view: { x: [-1, 10], y: [-9, 9] }, ab: [0, 2 * PI] },
  gauss: { label: '$e^{-x^2}$', f: (x) => Math.exp(-x * x), df: (x) => -2 * x * Math.exp(-x * x), ddf: (x) => (4 * x * x - 2) * Math.exp(-x * x), view: { x: [-3.5, 3.5], y: [-0.5, 1.5] }, ab: [-2, 2] },
  lorentz: { label: '$\\dfrac{1}{1+x^2}$', f: (x) => 1 / (1 + x * x), df: (x) => (-2 * x) / (1 + x * x) ** 2, ddf: (x) => (6 * x * x - 2) / (1 + x * x) ** 3, F: Math.atan, view: { x: [-5, 5], y: [-0.6, 1.4] }, ab: [-3, 3] },
  abs: { label: '$|x|$', f: Math.abs, df: (x) => (x === 0 ? NaN : Math.sign(x)), ddf: (x) => (x === 0 ? NaN : 0), F: (x) => (x * Math.abs(x)) / 2, view: { x: [-4, 4], y: [-1.5, 4.5] }, ab: [-2, 3], kink: true },
  cbrt: { label: '$\\sqrt[3]{x}$', f: cbrt, df: (x) => (x === 0 ? NaN : 1 / (3 * cbrt(x) ** 2)), ddf: (x) => (x === 0 ? NaN : -2 / (9 * cbrt(x) ** 5)), view: { x: [-4, 4], y: [-2.5, 2.5] }, ab: [-2, 3], asym: true },
  wobble: {
    label: '$x^2\\sin\\frac{1}{x}$', f: (x) => (x === 0 ? 0 : x * x * Math.sin(1 / x)),
    df: (x) => (x === 0 ? 0 : 2 * x * Math.sin(1 / x) - Math.cos(1 / x)), view: { x: [-0.6, 0.6], y: [-0.5, 0.5] }, ab: [-0.5, 0.5],
  },
};

/** Numerical derivatives for anything without an analytic one. */
export const d1 = (f, x, h = 1e-5) => (f(x + h) - f(x - h)) / (2 * h);
export const d2 = (f, x, h = 1e-3) => (f(x + h) - 2 * f(x) + f(x - h)) / (h * h);

/** Composite Gauss–Legendre (5-point) on m panels. Accurate to ~1e-12 for smooth integrands. */
const GX = [0, -0.5384693101056831, 0.5384693101056831, -0.9061798459386640, 0.9061798459386640];
const GW = [0.5688888888888889, 0.4786286704993665, 0.4786286704993665, 0.2369268850561891, 0.2369268850561891];
export function integrate(f, a, b, m = 200) {
  if (a === b) return 0;
  const h = (b - a) / m;
  let s = 0;
  for (let i = 0; i < m; i++) {
    const c = a + (i + 0.5) * h;
    for (let k = 0; k < 5; k++) s += GW[k] * f(c + GX[k] * h * 0.5);
  }
  return (s * h) / 2;
}
/** Exact ∫ from a to b: the antiderivative if known, otherwise accurate quadrature. */
export function exactIntegral(def, a, b) {
  if (def.F) return def.F(b) - def.F(a);
  return integrate(def.f, a, b, 400);
}
