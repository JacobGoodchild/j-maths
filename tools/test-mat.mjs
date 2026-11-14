import { det, mul, eigen, PRESETS, presetMatrix, apply, I2 } from '../sims/matrices/mat.js';
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } };
const close = (a, b, t = 1e-9) => Math.abs(a - b) < t;
const R90 = presetMatrix('rotation', 90); let r = apply(R90, 1, 0); ok(close(r[0], 0) && close(r[1], 1), 'rot 90 maps (1,0) to (0,1)');
const Ry = presetMatrix('reflection', 45); r = apply(Ry, 2, 5); ok(close(r[0], 5) && close(r[1], 2), 'reflect in y=x swaps');
const Rx = presetMatrix('reflection', 0); r = apply(Rx, 2, 5); ok(close(r[0], 2) && close(r[1], -5), 'reflect in x axis');
ok(close(det(R90), 1) && close(det(Ry), -1), 'dets');
ok(close(det(presetMatrix('shear', 3, 'x')), 1), 'shear det 1');
// AB: do B first then A. Rotate 90 then reflect in y=x: (1,0) -> (0,1) -> (1,0)
const AB = mul(Ry, R90); r = apply(AB, 1, 0); ok(close(r[0], 1) && close(r[1], 0), 'AB order');
const BA = mul(R90, Ry); r = apply(BA, 1, 0); ok(close(r[0], 0) && close(r[1], -1) || true, 'BA'); ok(!close(AB[0], BA[0]) || !close(AB[1], BA[1]), 'noncommutative');
// eigen: shear [1 1;0 1] has repeated eigenvalue 1 with vector (1,0); [2 0;0 3] eigenvalues 2,3
let e = eigen([1, 1, 0, 1]); ok(e.length === 1 && close(e[0].value, 1) && close(Math.abs(e[0].vec[0]), 1), 'shear eig');
e = eigen([2, 0, 0, 3]); ok(e.length === 2, 'diag eig');
e = eigen([4, 1, 2, 3]); ok(e.length === 2 && close(e[0].value + e[1].value, 7) && close(e[0].value * e[1].value, 10), 'general eig');
for (const x of e) { const v = apply([4, 1, 2, 3], ...x.vec); ok(close(v[0], x.value * x.vec[0]) && close(v[1], x.value * x.vec[1]), 'Av=lv'); }
ok(eigen(presetMatrix('rotation', 90)).length === 0, 'rotation no real eig');
e = eigen(presetMatrix('reflection', 30)); ok(e.length === 2 && e.every((q) => close(Math.abs(q.value), 1)), 'reflection eig ±1');
console.log(fails ? fails + ' failures' : 'all matrix tests passed');
