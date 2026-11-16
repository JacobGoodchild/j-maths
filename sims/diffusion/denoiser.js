// A small network trained in the browser to predict the noise in a noisy 2D point (no DOM).
// Inputs: (x1, x2, sqrt(abar_t), sqrt(1 - abar_t), t).  Outputs: the predicted noise (eps1, eps2).
// tanh hidden layers, linear output, squared-error loss, Adam.
import { alphaBar } from './diffusion.js';

export function makeMLP(sizes, rng) {
  const L = sizes.length - 1, net = { sizes, W: [], b: [], gW: [], gb: [], mW: [], vW: [], mb: [], vb: [], step: 0 };
  for (let k = 0; k < L; k++) {
    const n = sizes[k], m = sizes[k + 1], s = Math.sqrt(1 / n);
    net.W.push(Float64Array.from({ length: n * m }, () => rng.normal() * s)); net.b.push(new Float64Array(m));
    for (const key of ['gW', 'mW', 'vW']) net[key].push(new Float64Array(n * m));
    for (const key of ['gb', 'mb', 'vb']) net[key].push(new Float64Array(m));
  }
  net.a = sizes.map((n) => new Float64Array(n)); net.d = sizes.map((n) => new Float64Array(n));
  return net;
}
/** Forward pass; activations are kept in net.a. Returns the output layer (a view, not a copy). */
export function mlpForward(net, x) {
  const L = net.W.length; net.a[0].set(x);
  for (let k = 0; k < L; k++) {
    const n = net.sizes[k], m = net.sizes[k + 1], W = net.W[k], a = net.a[k], o = net.a[k + 1], b = net.b[k];
    for (let i = 0; i < m; i++) { let z = b[i]; const r = i * n; for (let j = 0; j < n; j++) z += W[r + j] * a[j]; o[i] = k === L - 1 ? z : Math.tanh(z); }
  }
  return net.a[L];
}
/** Adds the gradient for the last forward pass to net.gW / net.gb. dOut = dLoss/dOutput. */
export function mlpBackward(net, dOut) {
  const L = net.W.length; net.d[L].set(dOut);
  for (let k = L - 1; k >= 0; k--) {
    const n = net.sizes[k], m = net.sizes[k + 1], W = net.W[k], a = net.a[k], d = net.d[k + 1], dp = net.d[k], gW = net.gW[k], gb = net.gb[k];
    dp.fill(0);
    for (let i = 0; i < m; i++) { const di = d[i], r = i * n; gb[i] += di; for (let j = 0; j < n; j++) { gW[r + j] += di * a[j]; dp[j] += W[r + j] * di; } }
    if (k > 0) for (let j = 0; j < n; j++) dp[j] *= 1 - a[j] * a[j];
  }
}
export function adamStep(net, lr, B) {
  net.step++; const b1 = 0.9, b2 = 0.999, c1 = 1 - b1 ** net.step, c2 = 1 - b2 ** net.step;
  for (let k = 0; k < net.W.length; k++) for (const [p, g, m, v] of [[net.W[k], net.gW[k], net.mW[k], net.vW[k]], [net.b[k], net.gb[k], net.mb[k], net.vb[k]]])
    for (let i = 0; i < p.length; i++) { const gi = g[i] / B; m[i] = b1 * m[i] + (1 - b1) * gi; v[i] = b2 * v[i] + (1 - b2) * gi * gi; p[i] -= (lr * (m[i] / c1)) / (Math.sqrt(v[i] / c2) + 1e-8); g[i] = 0; }
}
const F = new Float64Array(5);
export function feats(x1, x2, t) { const a = alphaBar(t); F[0] = x1; F[1] = x2; F[2] = Math.sqrt(a); F[3] = Math.sqrt(1 - a); F[4] = t; return F; }
/** Predicted noise at a noisy point (a view into the network, copy it if you keep it) */
export const epsHat = (net, x1, x2, t) => mlpForward(net, feats(x1, x2, t));
/**
 * One training step on a batch: pick a clean point x0, a time t and noise eps, make x_t = sqrt(abar) x0 + sqrt(1 - abar) eps,
 * and ask the network for eps. Loss = |eps - eps_hat|^2. Returns the mean loss.
 */
export function trainBatch(net, centres, s, rng, B = 128, lr = 2e-3) {
  const K = centres.length / 2, d = new Float64Array(2); let tot = 0;
  for (let q = 0; q < B; q++) {
    const k = rng.int(K), t = 0.01 + 0.99 * rng.random(), a = alphaBar(t), ra = Math.sqrt(a), rn = Math.sqrt(1 - a), e1 = rng.normal(), e2 = rng.normal();
    const o = epsHat(net, ra * (centres[2 * k] + s * rng.normal()) + rn * e1, ra * (centres[2 * k + 1] + s * rng.normal()) + rn * e2, t);
    d[0] = 2 * (o[0] - e1); d[1] = 2 * (o[1] - e2); tot += (o[0] - e1) ** 2 + (o[1] - e2) ** 2;
    mlpBackward(net, d);
  }
  adamStep(net, lr, B);
  return tot / B;
}
/** One DDIM step from t to s using the network's predicted noise, in place */
export function netStep(net, x, t, s) {
  const o = epsHat(net, x[0], x[1], t), e1 = o[0], e2 = o[1], at = alphaBar(t), as = alphaBar(s), st = Math.sqrt(1 - at), ss = Math.sqrt(1 - as), rat = Math.sqrt(at), ras = Math.sqrt(as);
  x[0] = (ras * (x[0] - st * e1)) / rat + ss * e1; x[1] = (ras * (x[1] - st * e2)) / rat + ss * e2;
}
