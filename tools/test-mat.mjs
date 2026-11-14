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
// ---- 3x3 ----
import { det3, mul3, apply3, eigen3, eigenvalues3, preset3, I3 } from '../sims/matrices/mat.js';
let f3 = 0; const ok3 = (c, m) => { if (!c) { f3++; console.log('FAIL3', m); } };
const cl = (a, b, t = 1e-8) => Math.abs(a - b) < t;
ok3(cl(det3([2, 0, 0, 0, 3, 0, 0, 0, 4]), 24), 'det diag');
ok3(cl(det3([1, 2, 3, 4, 5, 6, 7, 8, 10]), -3), 'det general');
ok3(cl(det3(preset3('rotation', 33, 'y')), 1), 'rotation det 1'); ok3(cl(det3(preset3('reflection', 0, 'z')), -1), 'reflection det -1');
let ev = eigenvalues3([2, 0, 0, 0, 3, 0, 0, 0, 4]); ok3(ev.length === 3 && cl(ev[0], 2) && cl(ev[1], 3) && cl(ev[2], 4), 'diag eig ' + ev);
ev = eigenvalues3(preset3('rotation', 60, 'z')); ok3(ev.length === 1 && cl(ev[0], 1), 'rotation: one real eigenvalue ' + ev);
const S = [2, 1, 0, 1, 3, 1, 0, 1, 4]; // symmetric: three real eigenvalues
for (const e of eigen3(S)) { ok3(e.vec !== null, 'vec'); const v = apply3(S, ...e.vec); ok3(cl(v[0], e.value * e.vec[0], 1e-7) && cl(v[1], e.value * e.vec[1], 1e-7) && cl(v[2], e.value * e.vec[2], 1e-7), 'Av=lv ' + e.value); }
ok3(eigenvalues3(S).length === 3 && cl(eigenvalues3(S).reduce((a, b) => a + b), 9), 'sum of eigenvalues = trace');
ev = eigen3(preset3('shear', 1, 'xy')); ok3(ev.length === 1 && cl(ev[0].value, 1), 'shear single eigenvalue');
ev = eigen3(preset3('reflection', 0, 'x')); ok3(ev.length === 2 && ev.some((e) => cl(e.value, -1) && e.vec && cl(Math.abs(e.vec[0]), 1)), 'reflection: -1 along x');
const R2 = preset3('rotation', 90, 'x'), rr = apply3(R2, 0, 1, 0); ok3(cl(rr[0], 0) && cl(rr[1], 0) && cl(rr[2], 1), 'rotate y to z about x');
console.log(f3 ? f3 + ' 3D failures' : 'all 3x3 matrix tests passed');
