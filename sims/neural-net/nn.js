// Pure maths for the neural network sim (no DOM): a small fully connected network,
// backpropagation, gradient descent with momentum, toy datasets and loss surfaces.

export const ACTS = {
  tanh: { f: Math.tanh, d: (a) => 1 - a * a, tex: '\\tanh' },
  relu: { f: (z) => (z > 0 ? z : 0), d: (a) => (a > 0 ? 1 : 0), tex: '\\operatorname{ReLU}' },
  sigmoid: { f: (z) => 1 / (1 + Math.exp(-z)), d: (a) => a * (1 - a), tex: '\\sigma' },
};
const sig = ACTS.sigmoid.f;

/** sizes e.g. [2, 4, 3, 1]. W[k] maps layer k to k+1, stored row by row. */
export function makeNet(sizes, rng, act = 'tanh') {
  const W = [], b = [], vW = [], vb = [];
  for (let k = 0; k < sizes.length - 1; k++) {
    const n = sizes[k], m = sizes[k + 1], s = (act === 'relu' ? Math.sqrt(2 / n) : Math.sqrt(1 / n)) * 1.3;
    W.push(Float64Array.from({ length: n * m }, () => rng.normal() * s)); b.push(Float64Array.from({ length: m }, () => rng.normal() * 0.3));
    vW.push(new Float64Array(n * m)); vb.push(new Float64Array(m));
  }
  return { sizes, W, b, vW, vb, act };
}
/** Returns the activations of every layer: a[0] = x, …, a[L] = [p] with p = sigmoid of the last sum. */
export function forward(net, x) {
  const a = [x], L = net.W.length, f = ACTS[net.act].f;
  for (let k = 0; k < L; k++) {
    const n = net.sizes[k], m = net.sizes[k + 1], W = net.W[k], prev = a[k], out = new Array(m);
    for (let i = 0; i < m; i++) { let z = net.b[k][i]; for (let j = 0; j < n; j++) z += W[i * n + j] * prev[j]; out[i] = k === L - 1 ? sig(z) : f(z); }
    a.push(out);
  }
  return a;
}
export const loss = (p, y) => -(y * Math.log(Math.max(p, 1e-12)) + (1 - y) * Math.log(Math.max(1 - p, 1e-12)));
/** Backpropagation for one example. delta[k] = dLoss/d(sum going into layer k+1); dW[k] = delta[k] (outer) a[k]. */
export function backward(net, a, y) {
  const L = net.W.length, d = ACTS[net.act].d, delta = new Array(L), dW = new Array(L);
  delta[L - 1] = [a[L][0] - y];
  for (let k = L - 2; k >= 0; k--) {
    const m = net.sizes[k + 1], q = net.sizes[k + 2], Wn = net.W[k + 1]; delta[k] = new Array(m);
    for (let j = 0; j < m; j++) { let s = 0; for (let i = 0; i < q; i++) s += Wn[i * m + j] * delta[k + 1][i]; delta[k][j] = s * d(a[k + 1][j]); }
  }
  for (let k = 0; k < L; k++) { const n = net.sizes[k], m = net.sizes[k + 1]; dW[k] = new Float64Array(n * m); for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) dW[k][i * n + j] = delta[k][i] * a[k][j]; }
  return { delta, dW };
}
/** One step of gradient descent (with momentum) on the mean loss over the data. Returns the mean loss before the step. */
export function trainStep(net, X, Y, lr, mom = 0) {
  const L = net.W.length, gW = net.W.map((w) => new Float64Array(w.length)), gb = net.b.map((b) => new Float64Array(b.length)); let tot = 0;
  for (let s = 0; s < X.length; s++) {
    const a = forward(net, X[s]), g = backward(net, a, Y[s]); tot += loss(a[L][0], Y[s]);
    for (let k = 0; k < L; k++) { for (let i = 0; i < gW[k].length; i++) gW[k][i] += g.dW[k][i]; for (let i = 0; i < gb[k].length; i++) gb[k][i] += g.delta[k][i]; }
  }
  const N = X.length;
  for (let k = 0; k < L; k++) {
    for (let i = 0; i < gW[k].length; i++) { net.vW[k][i] = mom * net.vW[k][i] - (lr * gW[k][i]) / N; net.W[k][i] += net.vW[k][i]; }
    for (let i = 0; i < gb[k].length; i++) { net.vb[k][i] = mom * net.vb[k][i] - (lr * gb[k][i]) / N; net.b[k][i] += net.vb[k][i]; }
  }
  return tot / N;
}
export function evaluate(net, X, Y) {
  let l = 0, ok = 0; const L = net.W.length;
  for (let s = 0; s < X.length; s++) { const p = forward(net, X[s])[L][0]; l += loss(p, Y[s]); if ((p > 0.5) === (Y[s] > 0.5)) ok++; }
  return { loss: l / X.length, acc: ok / X.length };
}

// ---- toy datasets: points in the plane with a label 0 or 1 ----
export const DATA = {
  circle: { label: 'Circle inside a ring', gen: (rng, i) => { const y = i % 2, r = y ? 0.9 * Math.sqrt(rng.random()) : 1.7 + 0.6 * rng.random(), a = rng.random() * 6.2832; return [[r * Math.cos(a), r * Math.sin(a)], y]; } },
  line: { label: 'Two clusters', gen: (rng, i) => { const y = i % 2, s = y ? 1 : -1; return [[s * 1.1 + rng.normal() * 0.55, s * 0.8 + rng.normal() * 0.55], y]; } },
  xor: { label: 'Four corners (XOR)', gen: (rng) => { const x = (rng.random() * 2 - 1) * 2.2, y = (rng.random() * 2 - 1) * 2.2; return [[x + Math.sign(x) * 0.15, y + Math.sign(y) * 0.15], x * y > 0 ? 1 : 0]; } },
  moons: { label: 'Two moons', gen: (rng, i) => { const y = i % 2, a = rng.random() * Math.PI, n = () => rng.normal() * 0.13; return [y ? [1.5 * Math.cos(a) - 0.75 + n(), 1.5 * Math.sin(a) - 0.4 + n()] : [0.75 - 1.5 * Math.cos(a) + n(), 0.4 - 1.5 * Math.sin(a) + n()], y]; } },
  spiral: { label: 'Two spirals', gen: (rng, i) => { const y = i % 2, u = rng.random(), a = 0.6 + u * 7.5 + y * Math.PI, r = 0.25 + u * 2.2; return [[r * Math.cos(a) + rng.normal() * 0.05, r * Math.sin(a) + rng.normal() * 0.05], y]; } },
};
export function makeData(key, n, rng) { const X = [], Y = []; for (let i = 0; i < n; i++) { const [x, y] = DATA[key].gen(rng, i); X.push(x); Y.push(y); } return { X, Y }; }

// ---- loss surfaces for the gradient descent tab ----
export const SURFACES = {
  bowl: { label: 'Round bowl', f: (x, y) => 0.5 * (x * x + y * y), grad: (x, y) => [x, y], start: [-1.7, 1.5], zs: 0.5, tex: '\\tfrac12(w_1^2+w_2^2)' },
  valley: { label: 'Long narrow valley', f: (x, y) => 0.5 * (0.2 * x * x + 3 * y * y), grad: (x, y) => [0.2 * x, 3 * y], start: [-1.8, 1.2], zs: 0.45, tex: '\\tfrac12(0.2\\,w_1^2+3\\,w_2^2)' },
  saddle: { label: 'Saddle', f: (x, y) => 0.5 * (x * x - y * y) + 0.15 * y ** 4, grad: (x, y) => [x, -y + 0.6 * y ** 3], start: [-1.7, 0.02], zs: 0.7, tex: '\\tfrac12(w_1^2-w_2^2)+0.15\\,w_2^4' },
  two: { label: 'Two dips', f: (x, y) => 0.6 * (x * x - 1) ** 2 + 0.5 * y * y + 0.25 * x, grad: (x, y) => [2.4 * x * (x * x - 1) + 0.25, y], start: [0.15, 1.6], zs: 0.45, tex: '0.6(w_1^2-1)^2+\\tfrac12w_2^2+0.25\\,w_1' },
  banana: { label: 'Curved valley', f: (x, y) => 0.15 * (1 - x) ** 2 + 1.2 * (y - 0.5 * x * x) ** 2, grad: (x, y) => [-0.3 * (1 - x) - 2.4 * x * (y - 0.5 * x * x), 2.4 * (y - 0.5 * x * x)], start: [-1.6, 1.7], zs: 0.5, tex: '0.15(1-w_1)^2+1.2(w_2-\\tfrac12w_1^2)^2' },
};
/** Path of gradient descent with momentum: v = mom v - lr grad; w = w + v */
export function descend(s, start, lr, mom, n) {
  const path = [[...start]]; let [x, y] = start, vx = 0, vy = 0;
  for (let i = 0; i < n; i++) {
    const g = s.grad(x, y); vx = mom * vx - lr * g[0]; vy = mom * vy - lr * g[1]; x += vx; y += vy;
    if (!Number.isFinite(x + y) || Math.abs(x) > 50 || Math.abs(y) > 50) break;
    path.push([x, y]);
  }
  return path;
}
