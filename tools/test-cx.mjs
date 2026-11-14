import { cmul, cdiv, conj, mod, arg, roots, expSums, polar, cadd } from '../sims/complex/cx.js';
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } };
const close = (a, b, t = 1e-10) => Math.abs(a - b) < t, cc = (a, b, t) => close(a[0], b[0], t) && close(a[1], b[1], t);
ok(cc(cmul([1, 2], [3, -1]), [5, 5]), '(1+2i)(3-i)=5+5i');
ok(cc(cdiv([5, 5], [3, -1]), [1, 2]), 'division inverts multiplication');
const z = [1.3, -0.7], w = [-0.4, 2.2];
ok(close(mod(cmul(z, w)), mod(z) * mod(w)), '|zw|=|z||w|');
const d = arg(cmul(z, w)) - arg(z) - arg(w); ok(close(Math.cos(d), 1) && close(Math.sin(d), 0), 'arg adds');
ok(cc(cmul(z, conj(z)), [mod(z) ** 2, 0]), 'z z* = |z|^2');
for (const n of [2, 3, 5, 8]) { const w0 = [0.6, 1.1], rs = roots(w0, n); ok(rs.length === n, 'count'); let p = [1, 0]; for (const r of rs) { let q = [1, 0]; for (let i = 0; i < n; i++) q = cmul(q, r); ok(cc(q, w0, 1e-9), `root^${n}=w`); }
  const sum = rs.reduce((a, b) => cadd(a, b), [0, 0]); ok(cc(sum, [0, 0], 1e-9), `sum of ${n} roots is 0`); }
const u = roots([1, 0], 6); ok(cc(u[1], polar(1, Math.PI / 3)), 'sixth roots of unity');
const e = expSums(2.0, 40); ok(cc(e[39], [Math.cos(2), Math.sin(2)], 1e-12), 'exp series -> cos + i sin');
ok(cc(expSums(Math.PI, 40)[39], [-1, 0], 1e-10), "Euler's identity");
console.log(fails ? fails + ' failures' : 'all complex tests passed');
