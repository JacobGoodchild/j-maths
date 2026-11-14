import { MACLAURIN, TAYLOR, evalPoly, polyTex, binomFrac } from '../sims/maclaurin/series.js';
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } };
const close = (a, b, t = 1e-9) => Math.abs(a - b) < t;
// known coefficients
const e = MACLAURIN.exp.coefs(6); ok(close(e[3], 1 / 6) && close(e[5], 1 / 120), 'exp');
const s = MACLAURIN.sin.coefs(8); ok(s[0] === 0 && close(s[1], 1) && close(s[3], -1 / 6) && close(s[5], 1 / 120) && s[2] === 0 && close(s[7], -1 / 5040), 'sin');
const c = MACLAURIN.cos.coefs(6); ok(close(c[0], 1) && close(c[2], -0.5) && close(c[4], 1 / 24) && close(c[6], -1 / 720), 'cos');
const l = MACLAURIN.ln.coefs(5); ok(close(l[1], 1) && close(l[2], -0.5) && close(l[3], 1 / 3) && close(l[4], -0.25), 'ln');
const a = MACLAURIN.atan.coefs(7); ok(close(a[1], 1) && close(a[3], -1 / 3) && close(a[5], 0.2) && close(a[7], -1 / 7), 'atan');
const b = MACLAURIN.binom.coefs(4, { n: [1, 2] }); ok(close(b[1], 0.5) && close(b[2], -1 / 8) && close(b[3], 1 / 16) && close(b[4], -5 / 128), 'binom 1/2');
const b2 = MACLAURIN.binom.coefs(4, { n: [-1, 1] }); ok(close(b2[1], -1) && close(b2[2], 1) && close(b2[3], -1), 'binom -1');
const b3 = MACLAURIN.binom.coefs(5, { n: [3, 1] }); ok(close(b3[3], 1) && b3[4] === 0 && b3[5] === 0, 'binom 3');
const b4 = MACLAURIN.binom.coefs(3, { n: [-3, 2] }); ok(close(b4[1], -1.5) && close(b4[2], 15 / 8), 'binom -3/2');
// convergence
for (const [k, x, N] of [['exp', 2, 30], ['sin', 3, 30], ['cos', 3, 30], ['ln', 0.5, 60], ['atan', 0.5, 60], ['binom', 0.4, 60]]) {
  const par = { n: [1, 2] }, co = MACLAURIN[k].coefs(N, par);
  ok(close(evalPoly(co, N, x), MACLAURIN[k].f(x, par), 1e-9), `converge ${k}`);
}
// taylor about a
for (const k of Object.keys(TAYLOR)) { const par = { a: 1.3 }, co = TAYLOR[k].coefs(40, par); ok(close(evalPoly(co, 40, 1.8, 1.3), TAYLOR[k].f(1.8), 1e-8), `taylor ${k}`); ok(close(co[0], TAYLOR[k].f(1.3)), `taylor c0 ${k}`); }
// numerical derivative check of taylor c1
for (const k of Object.keys(TAYLOR)) { const a0 = 1.3, h = 1e-5, d = (TAYLOR[k].f(a0 + h) - TAYLOR[k].f(a0 - h)) / (2 * h); ok(close(TAYLOR[k].coefs(2, { a: a0 })[1], d, 1e-6), `taylor c1 ${k}`); }
// fractions
const f = binomFrac(1, 2, 3); ok(f.n === 1n && f.d === 16n, 'frac 1/16');
console.log(polyTex(MACLAURIN.sin, 7, {}), '|', polyTex(MACLAURIN.binom, 4, { n: [1, 2] }), '|', polyTex(MACLAURIN.exp, 20, {}));
console.log(fails ? fails + ' failures' : 'all maclaurin tests passed');
