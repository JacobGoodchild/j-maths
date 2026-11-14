import { sumRule, lowerUpper } from '../sims/riemann/riemann.js';
import { FUNCS, exactIntegral } from '../assets/js/kit/funcs.js';
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } };
// hand calculation: x^2 on [0,2] with n=4: h=0.5; left = 0.5*(0+0.25+1+2.25)=1.75; right = 0.5*(0.25+1+2.25+4)=3.75; mid = 0.5*(0.0625+0.5625+1.5625+3.0625)=2.625; trap = 2.75
const f = (x) => x * x;
const close = (a, b, t = 1e-12) => Math.abs(a - b) < t;
ok(close(sumRule(f, 0, 2, 4, 'left'), 1.75), 'left'); ok(close(sumRule(f, 0, 2, 4, 'right'), 3.75), 'right');
ok(close(sumRule(f, 0, 2, 4, 'mid'), 2.625), 'mid'); ok(close(sumRule(f, 0, 2, 4, 'trap'), 2.75), 'trap');
const [L, U] = lowerUpper(f, 0, 2, 4); ok(close(L, 1.75) && close(U, 3.75), 'lower/upper monotone');
for (const k of ['x2', 'cubic', 'sin', 'cos', 'exp', 'ln', 'sqrt', 'xsin', 'lorentz', 'gauss']) {
  const d = FUNCS[k], [a, b] = d.ab, I = exactIntegral(d, a, b);
  for (const r of ['left', 'right', 'mid', 'trap']) ok(Math.abs(sumRule(d.f, a, b, 20000, r) - I) < 2e-3 * (1 + Math.abs(I)), `${k} ${r} -> exact`);
  const [l, u] = lowerUpper(d.f, a, b, 200); ok(l <= I + 1e-9 && u >= I - 1e-9 && u - l < 0.1 * (b - a) * 10, `${k} squeeze ${l} ${I} ${u}`);
  // order of convergence: trapezium error should drop ~4x when n doubles, left ~2x
  const e1 = Math.abs(sumRule(d.f, a, b, 100, 'trap') - I), e2 = Math.abs(sumRule(d.f, a, b, 200, 'trap') - I);
  if (k !== 'sqrt' && k !== 'ln' && e1 > 1e-9) ok(e1 / e2 > 3 || e2 < 1e-9, `${k} trap order ${e1 / e2}`);
}
console.log(fails ? fails + ' failures' : 'all riemann tests passed');
