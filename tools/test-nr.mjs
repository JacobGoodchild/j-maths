import { FUNCS, newtonStep, newtonRun, findRoots, basinIndex, bisect } from '../sims/newton-raphson/nr.js';
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } };
const close = (a, b, t = 1e-12) => Math.abs(a - b) < t;
const q = FUNCS.sq2;
// hand calculation: x0=1 -> 1.5 -> 1.41666... -> 1.41421568...
let s = newtonStep(q.f, q.df, 1); ok(close(s.x, 1.5), 'x1'); s = newtonStep(q.f, q.df, 1.5); ok(close(s.x, 17 / 12), 'x2'); s = newtonStep(q.f, q.df, 17 / 12); ok(close(s.x, 577 / 408), 'x3 = 577/408');
const r = newtonRun(q.f, q.df, 2); ok(r.status === 'converged' && close(r.xs[r.xs.length - 1], Math.SQRT2, 1e-12), 'sqrt2'); ok(r.xs.length <= 8, 'few steps');
// cycle 0 -> 1 -> 0
const c = FUNCS.cycle; const rc = newtonRun(c.f, c.df, 0, 6); ok(close(rc.xs[1], 1) && close(rc.xs[2], 0) && close(rc.xs[3], 1), 'cycle');
// shoot: x0 = 0.15 -> 0.15 + (2-0.0225)/0.3
const sh = FUNCS.shoot; s = newtonStep(sh.f, sh.df, 0.15); ok(close(s.x, 0.15 + (2 - 0.0225) / 0.3), 'shoot');
// arctan diverges from 1.6, converges from 1
ok(newtonRun(FUNCS.atan.f, FUNCS.atan.df, 1.6, 30).status === 'diverged' || Math.abs(newtonRun(FUNCS.atan.f, FUNCS.atan.df, 1.6, 30).xs.slice(-1)[0]) > 1e3, 'atan diverge');
ok(newtonRun(FUNCS.atan.f, FUNCS.atan.df, 1, 30).status === 'converged', 'atan converge');
// cbrt: x_{n+1} = -2 x_n
const cb = FUNCS.cbrt; s = newtonStep(cb.f, cb.df, 1); ok(close(s.x, -2, 1e-9), 'cbrt doubling');
// flat
ok(newtonStep(q.f, q.df, 0).status === 'flat', 'flat');
// roots
const rt = findRoots(FUNCS.cubic3.f, FUNCS.cubic3.df, -0.5, 4.5); ok(rt.length === 3 && close(rt[0], 1, 1e-9) && close(rt[1], 2, 1e-9) && close(rt[2], 3, 1e-9), 'cubic roots ' + rt);
ok(basinIndex(FUNCS.cubic3.f, FUNCS.cubic3.df, rt, 1.2) === 0 && basinIndex(FUNCS.cubic3.f, FUNCS.cubic3.df, rt, 3.4) === 2, 'basins');
// quadratic convergence: error roughly squares
const rr = newtonRun(q.f, q.df, 1, 6, 0).xs.map((x) => Math.abs(x - Math.SQRT2)); ok(rr[3] < rr[2] ** 1.5 && rr[2] < rr[1] ** 1.5, 'quadratic');
// bisection halves the interval
const b = bisect(q.f, 1, 2, 10); ok(close(b[10][1] - b[10][0], 1 / 1024), 'bisect width'); ok(b[10][0] <= Math.SQRT2 && Math.SQRT2 <= b[10][1], 'bracket');
console.log(fails ? fails + ' failures' : 'all newton tests passed');
