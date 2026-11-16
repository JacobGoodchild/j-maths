import { makeMLP, mlpForward, mlpBackward, trainBatch, epsHat, netStep } from '../sims/diffusion/denoiser.js';
import { centresOf, SHAPES2, score, alphaBar, timeGrid } from '../sims/diffusion/diffusion.js';
import { makeRng } from '../assets/js/kit/rng.js';
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } };
// backprop against finite differences (loss = sum of squares of (output - target))
{ const rng = makeRng([1, 2, 3, 4]), net = makeMLP([5, 6, 4, 2], rng), x = [0.3, -0.8, 0.5, 0.2, 0.9], y = [0.4, -1];
  const loss = () => { const o = mlpForward(net, x); return (o[0] - y[0]) ** 2 + (o[1] - y[1]) ** 2; };
  const o = mlpForward(net, x); mlpBackward(net, [2 * (o[0] - y[0]), 2 * (o[1] - y[1])]); let worst = 0;
  for (let k = 0; k < 3; k++) { for (let i = 0; i < net.W[k].length; i++) { const w = net.W[k][i], h = 1e-6; net.W[k][i] = w + h; const p = loss(); net.W[k][i] = w - h; const m = loss(); net.W[k][i] = w; worst = Math.max(worst, Math.abs((p - m) / (2 * h) - net.gW[k][i])); }
    for (let i = 0; i < net.b[k].length; i++) { const w = net.b[k][i], h = 1e-6; net.b[k][i] = w + h; const p = loss(); net.b[k][i] = w - h; const m = loss(); net.b[k][i] = w; worst = Math.max(worst, Math.abs((p - m) / (2 * h) - net.gb[k][i])); } }
  ok(worst < 1e-6, 'mlp backprop vs finite differences: ' + worst); }
// training: the loss falls, the learned score points the same way as the exact one, and samples land near the data
{ const rng = makeRng([5, 5, 5, 5]), c = centresOf(SHAPES2.rings, 120, 2), net = makeMLP([5, 48, 48, 2], rng); let first = 0, last = 0; const N = 2500, t0 = Date.now();
  for (let i = 0; i < N; i++) { const l = trainBatch(net, c, 0.05, rng); if (i < 50) first += l / 50; if (i >= N - 50) last += l / 50; }
  ok(last < first * 0.6, `loss fell from ${first.toFixed(3)} to ${last.toFixed(3)} (${Date.now() - t0} ms for ${N} steps)`);
  const g = new Float64Array(2); let cos = 0, n = 0;
  for (let i = 0; i < 300; i++) { const x = [rng.normal() * 1.5, rng.normal() * 1.5], t = 0.3; score(x, t, c, 2, 0.05, g); const e = epsHat(net, x[0], x[1], t), m = Math.hypot(g[0], g[1]) * Math.hypot(e[0], e[1]); if (m > 1e-9) { cos += -(g[0] * e[0] + g[1] * e[1]) / m; n++; } }
  ok(cos / n > 0.8, 'learned score direction agrees with the exact score, mean cosine ' + (cos / n).toFixed(3));
  const T = timeGrid(30, 'snr', 0.005); let D = 0;
  for (let i = 0; i < 200; i++) { const x = [rng.normal(), rng.normal()]; for (let k = 0; k < 30; k++) netStep(net, x, T[k], T[k + 1]); let m = Infinity; for (let k = 0; k < 120; k++) m = Math.min(m, Math.hypot(x[0] - c[2 * k], x[1] - c[2 * k + 1])); D += m / 200; }
  ok(D < 0.3, 'samples from the trained network land near the data, mean distance ' + D.toFixed(3)); }
console.log(fails ? `denoiser: ${fails} FAILED` : 'denoiser: all passed'); process.exit(fails ? 1 : 0);
