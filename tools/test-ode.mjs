import { ODES, euler, improvedEuler, solve, oscillator, rk4Step } from '../sims/diffeq/ode.js';
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } };
const close = (a, b, t = 1e-9) => Math.abs(a - b) < t;
// hand calculations: y' = y, y(0)=1, h = 0.5 -> 1.5, 2.25
const e = euler(ODES.grow.f, 0, 1, 0.5, 2); ok(close(e[1][1], 1.5) && close(e[2][1], 2.25), 'euler y\'=y');
// improved Euler, h = 1: k1 = 1, k2 = f(1, 2) = 2, y1 = 1 + 0.5*3 = 2.5
const ie = improvedEuler(ODES.grow.f, 0, 1, 1, 1); ok(close(ie[1][1], 2.5), 'improved euler');
// y' = x + y, y(0) = 1, h = 0.1: y1 = 1 + 0.1*(0+1) = 1.1
ok(close(euler(ODES.sum.f, 0, 1, 0.1, 1)[1][1], 1.1), 'euler x+y');
// RK4 matches exact solutions
for (const k of Object.keys(ODES)) {
  const d = ODES[k]; if (!d.exact) continue;
  const [x0, y0] = d.start, ex = d.exact(x0, y0), pts = solve(d.f, x0, y0, x0, x0 + 1.5, 600);
  const p = pts[pts.length - 1]; ok(close(p[1], ex(p[0]), 1e-7 * Math.max(1, Math.abs(p[1]))), `rk4 ${k}: ${p[1]} vs ${ex(p[0])}`);
  // the exact formula really satisfies the ODE
  const h = 1e-5, xx = x0 + 0.37; ok(close((ex(xx + h) - ex(xx - h)) / (2 * h), d.f(xx, ex(xx)), 1e-5 * Math.max(1, Math.abs(d.f(xx, ex(xx))))), `exact ${k} satisfies ODE`);
}
// circle ODE: x^2 + y^2 = constant along RK4 solution
const c = ODES.circle, cp = solve(c.f, 0, 2, 0, 1.5, 800); ok(close(1.5 ** 2 + cp[cp.length - 1][1] ** 2, 4, 1e-6), 'circle invariant');
// order of convergence at x = 1 for y' = y
const err = (m, n) => Math.abs(m(ODES.grow.f, 0, 1, 1 / n, n).pop()[1] - Math.E);
ok(err(euler, 200) / err(euler, 400) > 1.9 && err(euler, 200) / err(euler, 400) < 2.1, 'euler is first order');
ok(err(improvedEuler, 200) / err(improvedEuler, 400) > 3.8 && err(improvedEuler, 200) / err(improvedEuler, 400) < 4.2, 'improved euler is second order');
// oscillator: satisfies y'' + 2 zeta w y' + w^2 y = 0 and the initial conditions
for (const [w, z, y0, v0] of [[2, 0.2, 1, 0], [2, 1, 1, -1], [1.5, 1.8, 0.5, 2], [3, 0.05, -1, 1]]) {
  const o = oscillator(w, z, y0, v0); ok(close(o.y(0), y0) && close(o.dy(0), v0, 1e-9), `ic ${z}`);
  const t = 0.8, h = 1e-4, ypp = (o.y(t + h) - 2 * o.y(t) + o.y(t - h)) / (h * h), yp = (o.y(t + h) - o.y(t - h)) / (2 * h);
  ok(close(ypp + 2 * z * w * yp + w * w * o.y(t), 0, 1e-3), `ode ${z}`); ok(close(yp, o.dy(t), 1e-6), `dy ${z}`);
  const kind = z < 1 ? 'under' : z === 1 ? 'critical' : 'over'; ok(o.kind === kind, 'kind');
}
console.log(fails ? fails + ' failures' : 'all ode tests passed');
