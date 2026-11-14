// Pure maths for Maclaurin / Taylor series. No DOM, so it can be tested in node.

const factorial = (r) => { let f = 1; for (let i = 2; i <= r; i++) f *= i; return f; };

// ---- exact fractions (BigInt) for binomial coefficients ----
const bgcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
/** binom(p/q, r) as a reduced fraction {n, d} (BigInt, d > 0). */
export function binomFrac(p, q, r) {
  let num = 1n, den = 1n;
  for (let j = 0; j < r; j++) { num *= BigInt(p - q * j); den *= BigInt(q) * BigInt(j + 1); }
  const g = bgcd(num, den) || 1n;
  num /= g; den /= g;
  if (den < 0n) { num = -num; den = -den; }
  return { n: num, d: den };
}
const fracToNum = (f) => Number(f.n) / Number(f.d);

/** a^s where a>0 */
const pw = (a, s) => Math.pow(a, s);

/**
 * Function table. `coefs(N, par)` returns c[0..N] of the series about the centre (Maclaurin: centre 0).
 * `par` = { n: [p, q] exponent as a fraction p/q, a: centre }.
 * `term(r, par)` returns { neg, body } for typeset terms (body null when the coefficient is zero).
 */
export const MACLAURIN = {
  exp: {
    label: '$e^x$', f: Math.exp,
    coefs: (N) => Array.from({ length: N + 1 }, (_, r) => 1 / factorial(r)),
    term: (r) => ({ neg: false, body: r === 0 ? '1' : r === 1 ? 'x' : `\\frac{x^{${r}}}{${r}!}` }),
    valid: null, view: { x: [-4.5, 4.5], y: [-3, 12] },
  },
  sin: {
    label: '$\\sin x$', f: Math.sin,
    coefs: (N) => Array.from({ length: N + 1 }, (_, r) => (r % 2 ? ((r - 1) / 2 % 2 ? -1 : 1) / factorial(r) : 0)),
    term: (r) => (r % 2 === 0 ? { body: null } : { neg: ((r - 1) / 2) % 2 === 1, body: r === 1 ? 'x' : `\\frac{x^{${r}}}{${r}!}` }),
    valid: null, view: { x: [-10.5, 10.5], y: [-4.5, 4.5] },
  },
  cos: {
    label: '$\\cos x$', f: Math.cos,
    coefs: (N) => Array.from({ length: N + 1 }, (_, r) => (r % 2 === 0 ? (r / 2 % 2 ? -1 : 1) / factorial(r) : 0)),
    term: (r) => (r % 2 ? { body: null } : { neg: (r / 2) % 2 === 1, body: r === 0 ? '1' : `\\frac{x^{${r}}}{${r}!}` }),
    valid: null, view: { x: [-10.5, 10.5], y: [-4.5, 4.5] },
  },
  ln: {
    label: '$\\ln(1+x)$', f: (x) => (x > -1 ? Math.log(1 + x) : NaN),
    coefs: (N) => Array.from({ length: N + 1 }, (_, r) => (r === 0 ? 0 : (r % 2 ? 1 : -1) / r)),
    term: (r) => (r === 0 ? { body: null } : { neg: r % 2 === 0, body: r === 1 ? 'x' : `\\frac{x^{${r}}}{${r}}` }),
    valid: { lo: -1, hi: 1, loClosed: false, hiClosed: true, text: '−1 < x ≤ 1' }, view: { x: [-2.2, 3.4], y: [-4.2, 3.2] },
  },
  binom: {
    label: '$(1+x)^n$', f: (x, par) => Math.pow(1 + x, par.n[0] / par.n[1]),
    coefs: (N, par) => Array.from({ length: N + 1 }, (_, r) => fracToNum(binomFrac(par.n[0], par.n[1], r))),
    term: (r, par) => {
      const c = binomFrac(par.n[0], par.n[1], r);
      if (c.n === 0n) return { body: null };
      const neg = c.n < 0n, an = neg ? -c.n : c.n;
      const x = r === 0 ? '' : r === 1 ? 'x' : `x^{${r}}`;
      let coef = an === 1n && c.d === 1n ? '' : c.d === 1n ? `${an}` : `\\tfrac{${an}}{${c.d}}`;
      return { neg, body: (coef + x) || '1' };
    },
    valid: { lo: -1, hi: 1, loClosed: false, hiClosed: false, text: '|x| < 1' }, view: { x: [-3, 3], y: [-4, 6] },
  },
  atan: {
    label: '$\\arctan x$', f: Math.atan,
    coefs: (N) => Array.from({ length: N + 1 }, (_, r) => (r % 2 ? ((r - 1) / 2 % 2 ? -1 : 1) / r : 0)),
    term: (r) => (r % 2 === 0 ? { body: null } : { neg: ((r - 1) / 2) % 2 === 1, body: r === 1 ? 'x' : `\\frac{x^{${r}}}{${r}}` }),
    valid: { lo: -1, hi: 1, loClosed: true, hiClosed: true, text: '|x| ≤ 1' }, view: { x: [-4, 4], y: [-2.6, 2.6] },
  },
};

/** Functions for Taylor series about x = a. */
export const TAYLOR = {
  exp: { label: '$e^x$', f: Math.exp, coefs: (N, { a }) => Array.from({ length: N + 1 }, (_, r) => Math.exp(a) / factorial(r)), valid: null, view: { x: [-4.5, 4.5], y: [-3, 12] } },
  sin: { label: '$\\sin x$', f: Math.sin, coefs: (N, { a }) => Array.from({ length: N + 1 }, (_, r) => Math.sin(a + (r * Math.PI) / 2) / factorial(r)), valid: null, view: { x: [-10.5, 10.5], y: [-4.5, 4.5] } },
  cos: { label: '$\\cos x$', f: Math.cos, coefs: (N, { a }) => Array.from({ length: N + 1 }, (_, r) => Math.cos(a + (r * Math.PI) / 2) / factorial(r)), valid: null, view: { x: [-10.5, 10.5], y: [-4.5, 4.5] } },
  ln: {
    label: '$\\ln x$', f: (x) => (x > 0 ? Math.log(x) : NaN),
    coefs: (N, { a }) => Array.from({ length: N + 1 }, (_, r) => (r === 0 ? Math.log(a) : (r % 2 ? 1 : -1) / (r * Math.pow(a, r)))),
    valid: (a) => ({ lo: 0, hi: 2 * a, loClosed: false, hiClosed: true }), needsPositive: true, view: { x: [-0.8, 6.5], y: [-4.5, 3.5] },
  },
  recip: {
    label: '$\\dfrac{1}{x}$', f: (x) => 1 / x,
    coefs: (N, { a }) => Array.from({ length: N + 1 }, (_, r) => (r % 2 ? -1 : 1) / Math.pow(a, r + 1)),
    valid: (a) => ({ lo: 0, hi: 2 * a, loClosed: false, hiClosed: false }), needsPositive: true, view: { x: [-1.5, 7], y: [-4, 6] },
  },
  sqrt: {
    label: '$\\sqrt{x}$', f: (x) => (x >= 0 ? Math.sqrt(x) : NaN),
    coefs: (N, { a }) => Array.from({ length: N + 1 }, (_, r) => Math.pow(a, 0.5 - r) * fracToNum(binomFrac(1, 2, r))),
    valid: (a) => ({ lo: 0, hi: 2 * a, loClosed: true, hiClosed: true }), needsPositive: true, view: { x: [-1.5, 7], y: [-1.5, 4] },
  },
};

/** Evaluate sum c_r (x - a)^r for r <= n using Horner. */
export function evalPoly(c, n, x, a = 0) {
  const t = x - a;
  let s = 0;
  const top = Math.min(n, c.length - 1);
  for (let r = top; r >= 0; r--) s = s * t + c[r];
  return s;
}

/** Typeset the polynomial of degree n as a sum, e.g. "1 + x - \frac{x^3}{6}". */
export function polyTex(def, n, par, maxShown = 6) {
  const terms = [];
  for (let r = 0; r <= n; r++) { const t = def.term(r, par); if (t.body) terms.push(t); }
  if (!terms.length) return '0';
  let list = terms, gap = false;
  if (terms.length > maxShown) { list = [...terms.slice(0, maxShown - 2), null, terms[terms.length - 1]]; gap = true; }
  let out = '';
  list.forEach((t, i) => {
    if (t === null) { out += ' + \\cdots'; return; }
    const sign = t.neg ? '-' : '+';
    out += i === 0 ? (t.neg ? '-' : '') + t.body : ` ${sign} ${t.body}`;
  });
  return out;
}
