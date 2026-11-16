import { makeNet, forward, backward, loss, trainStep, evaluate, makeData, SURFACES, descend, ACTS } from '../sims/neural-net/nn.js';
import { makeRng } from '../assets/js/kit/rng.js';
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } };
// hand calculation: one neuron, w = (1, -2), b = 0.5, x = (2, 1): sum = 0.5, output = sigmoid(0.5)
{ const net = makeNet([2, 1], makeRng([1, 1, 1, 1])); net.W[0].set([1, -2]); net.b[0][0] = 0.5; const a = forward(net, [2, 1]);
  ok(Math.abs(a[1][0] - 1 / (1 + Math.exp(-0.5))) < 1e-14, 'single neuron'); const g = backward(net, a, 1); ok(Math.abs(g.dW[0][0] - (a[1][0] - 1) * 2) < 1e-14, 'single neuron gradient'); }
// backprop against finite differences, every activation
for (const act of Object.keys(ACTS)) {
  const rng = makeRng([3, 1, 4, 1]), net = makeNet([2, 4, 3, 1], rng, act), x = [0.7, -1.2], y = 1, a = forward(net, x), g = backward(net, a, y); let worst = 0;
  const L = () => loss(forward(net, x)[3][0], y);
  for (let k = 0; k < 3; k++) {
    for (let i = 0; i < net.W[k].length; i++) { const w = net.W[k][i], h = 1e-6; net.W[k][i] = w + h; const p = L(); net.W[k][i] = w - h; const m = L(); net.W[k][i] = w; worst = Math.max(worst, Math.abs((p - m) / (2 * h) - g.dW[k][i])); }
    for (let i = 0; i < net.b[k].length; i++) { const w = net.b[k][i], h = 1e-6; net.b[k][i] = w + h; const p = L(); net.b[k][i] = w - h; const m = L(); net.b[k][i] = w; worst = Math.max(worst, Math.abs((p - m) / (2 * h) - g.delta[k][i])); }
  }
  ok(worst < 1e-6, `backprop vs finite differences (${act}): ${worst}`);
}
// training lowers the loss and learns the circle data
{ const rng = makeRng([2, 7, 1, 8]), D = makeData('circle', 200, rng), net = makeNet([2, 3, 1], rng); const l0 = evaluate(net, D.X, D.Y).loss;
  for (let i = 0; i < 1500; i++) trainStep(net, D.X, D.Y, 0.3, 0.9); const e = evaluate(net, D.X, D.Y); ok(e.loss < l0 && e.acc > 0.97, `circle learnt with 3 hidden neurons: acc ${e.acc}, loss ${e.loss}`); }
// loss surfaces: gradients match finite differences, and descent goes downhill on the bowl to the minimum
for (const [k, s] of Object.entries(SURFACES)) for (const [x, y] of [[0.3, -0.8], [-1.2, 1.1]]) { const h = 1e-6, g = s.grad(x, y); ok(Math.abs((s.f(x + h, y) - s.f(x - h, y)) / (2 * h) - g[0]) < 1e-6 && Math.abs((s.f(x, y + h) - s.f(x, y - h)) / (2 * h) - g[1]) < 1e-6, 'surface gradient ' + k); }
{ const p = descend(SURFACES.bowl, [2, 1], 0.1, 0, 3); ok(Math.abs(p[3][0] - 2 * 0.9 ** 3) < 1e-12, 'bowl: each step multiplies by (1 - lr)'); 
  const q = descend(SURFACES.valley, [1, 1], 0.7, 0, 50); ok(Math.abs(q[q.length - 1][1]) > 1, 'valley diverges when lr > 2/3'); }
console.log(fails ? `nn: ${fails} FAILED` : 'nn: all passed'); process.exit(fails ? 1 : 0);
