import { timeGrid, logSNR, tOfLogSNR, ddimStep, forwardStep, ddpmSchedule, alphaBar, beta, score, denoise, reverseStep, centresOf, SHAPES2, SHAPES3 } from '../sims/diffusion/diffusion.js';
import { makeRng } from '../assets/js/kit/rng.js';
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } };
const S = ddpmSchedule();
ok(Math.abs(S.abar[1] - (1 - 1e-4)) < 1e-12, 'abar_1');
ok(S.abar[1000] < 1e-4 && S.abar[1000] > 1e-5, 'abar_N is tiny: ' + S.abar[1000]);
// alphaBar' = -beta * alphaBar
for (const t of [0.1, 0.5, 0.9]) { const h = 1e-6, d = (alphaBar(t + h) - alphaBar(t - h)) / (2 * h); ok(Math.abs(d + beta(t) * alphaBar(t)) < 1e-6, 'abar derivative ' + t); }
// score = gradient of log p (finite differences), 2D and 3D
for (const [sh, d] of [[SHAPES2.spiral, 2], [SHAPES3.knot, 3]]) {
  const c = centresOf(sh, 60, d), g = new Float64Array(d), tmp = new Float64Array(d);
  for (const t of [0.05, 0.3, 0.8]) {
    const x = d === 2 ? [0.4, -0.7] : [0.4, -0.7, 0.2]; score(x, t, c, d, 0.05, g);
    for (let j = 0; j < d; j++) { const h = 1e-5, a = [...x], b = [...x]; a[j] += h; b[j] -= h; const fd = (score(a, t, c, d, 0.05, tmp) - score(b, t, c, d, 0.05, tmp)) / (2 * h); ok(Math.abs(fd - g[j]) < 1e-4 * (1 + Math.abs(fd)), `score fd d=${d} t=${t} j=${j}: ${fd} vs ${g[j]}`); }
  }
}
// one Gaussian at mu: score is exactly (sqrt(abar) mu - x) / v, and at t -> 1 it tends to -x
{ const c = new Float64Array([1, 2]), g = new Float64Array(2); score([0.3, 0.1], 1, c, 2, 0.1, g); ok(Math.abs(g[0] + 0.3) < 0.02 && Math.abs(g[1] + 0.1) < 0.02, 'score at t=1 is about -x'); 
  const t = 0.4, a = alphaBar(t), v = a * 0.01 + 1 - a; score([0.3, 0.1], t, c, 2, 0.1, g); ok(Math.abs(g[0] - (Math.sqrt(a) * 1 - 0.3) / v) < 1e-12, 'single gaussian score');
  const x0 = denoise([0.3, 0.1], t, g, [0, 0]); ok(Math.abs(x0[0] - 1) < 0.05 && Math.abs(x0[1] - 2) < 0.05, 'denoise finds the only data point: ' + x0); }
// sampling: both the SDE and the ODE carry N(0, I) onto the data (every sample ends near a centre)
for (const mode of ['sde', 'ode']) {
  const rng = makeRng([1, 2, 3, 4]), c = centresOf(SHAPES2.rings, 80, 2), tmp = new Float64Array(2); let worst = 0, n = 200;
  const steps = 400, T0 = 1, T1 = 1e-3; let inner = 0;
  for (let i = 0; i < n; i++) {
    const x = [rng.normal(), rng.normal()];
    for (let k = 0; k < steps; k++) { const t = T0 - ((T0 - T1) * k) / steps; reverseStep(x, t, (T0 - T1) / steps, c, 2, 0.05, mode, rng, tmp); }
    let m = Infinity; for (let k = 0; k < 80; k++) m = Math.min(m, Math.hypot(x[0] - c[2 * k], x[1] - c[2 * k + 1])); worst = Math.max(worst, m);
    if (Math.hypot(x[0], x[1]) < 1.2) inner++;
  }
  ok(worst < 0.35, mode + ' samples land on the data, worst distance ' + worst);
  ok(Math.abs(inner / n - 0.36) < 0.12, mode + ' share on the inner ring ' + inner / n);
}
// "a better clock": 10 DDIM steps spaced evenly in log-SNR land much closer to the data than 10 spaced evenly in time
{ const c = centresOf(SHAPES2.rings, 120, 2), tmp = new Float64Array(2), dist = (x) => { let m = Infinity; for (let k = 0; k < 120; k++) m = Math.min(m, Math.hypot(x[0] - c[2 * k], x[1] - c[2 * k + 1])); return m; }, res = {};
  for (const grid of ['time', 'snr']) { const rng = makeRng([4, 3, 2, 1]), T = timeGrid(10, grid); let dd = 0; for (let i = 0; i < 200; i++) { const x = [rng.normal(), rng.normal()]; for (let k = 0; k < 10; k++) ddimStep(x, T[k], T[k + 1], c, 2, 0.05, tmp); dd += dist(x) / 200; } res[grid] = dd; }
  ok(res.snr < 0.1 && res.snr < res.time * 0.7, `log-SNR spacing ${res.snr} against even time ${res.time}`);
  ok(Math.abs(tOfLogSNR(logSNR(0.37)) - 0.37) < 1e-12, 'tOfLogSNR inverts logSNR'); const T = timeGrid(7, 'snr'); ok(T[0] === 1 && T[7] === 1e-3 && T.every((t, i) => !i || t < T[i - 1]), 'grid runs from 1 down to the end'); }
// a single Gaussian data point: DDIM is exact in one step of any size when the data width is 0
{ const c = new Float64Array([1.5]), tmp = new Float64Array(1), x = [0.7]; ddimStep(x, 0.9, 0.2, c, 1, 1e-6, tmp); const e = (0.7 - Math.sqrt(alphaBar(0.9)) * 1.5) / Math.sqrt(1 - alphaBar(0.9)); ok(Math.abs(x[0] - (Math.sqrt(alphaBar(0.2)) * 1.5 + Math.sqrt(1 - alphaBar(0.2)) * e)) < 1e-4, 'DDIM exact for one point'); }
// forward SDE from a fixed point ends close to N(0, 1)
{ const rng = makeRng([8, 8, 8, 8]); let m = 0, v = 0; const n = 2000; for (let i = 0; i < n; i++) { const x = [2]; for (let k = 0; k < 200; k++) forwardStep(x, k / 200, 1 / 200, rng); m += x[0] / n; v += x[0] * x[0] / n; } ok(Math.abs(m) < 0.1 && Math.abs(v - 1) < 0.12, `forward SDE ends near N(0,1): mean ${m}, var ${v}`); }
console.log(fails ? `diffusion: ${fails} FAILED` : 'diffusion: all passed'); process.exit(fails ? 1 : 0);
