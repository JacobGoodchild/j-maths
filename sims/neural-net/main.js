import { mountSim } from '../../assets/js/kit/shell.js';
import { Plot, fmtNum } from '../../assets/js/kit/plot.js';
import { group, slider, toggle, segmented, dropdown, transport, readouts, button } from '../../assets/js/kit/ui.js';
import { renderTex } from '../../assets/js/kit/tex.js';
import { loop } from '../../assets/js/kit/anim.js';
import { withAlpha } from '../../assets/js/kit/theme.js';
import { makeRng } from '../../assets/js/kit/rng.js';
import { makeNet, forward, backward, loss, trainStep, evaluate, makeData, DATA, ACTS } from './nn.js';
import { tabHidden, tabDescent } from './space.js';

export function overlayCard(stage) {
  const overlay = document.createElement('div'); overlay.className = 'sim-overlay';
  const card = document.createElement('div'); card.className = 'card-f'; overlay.append(card); stage.append(overlay);
  return { show(on, tex) { overlay.hidden = !on; if (on && tex !== this.last) { this.last = tex; renderTex(card, tex, true); } } };
}
export const note = (parent, text) => { const n = document.createElement('p'); n.style.cssText = 'color:var(--ink-2);font-size:13px;line-height:1.45;margin:4px 0 0'; n.textContent = text; parent.append(n); return n; };
const f2 = (v) => fmtNum(v, 2);

// =================== Tab 1: data flowing through a network ===================
function tabFlow(ctx) {
  const { stage, panel } = ctx;
  let seed = 3;
  const st = { x: [1.2, -0.6], y: 1, mode: 'fwd', ph: 99, lr: 0.5, formula: true, nums: true, hover: null };
  let net = makeNet([2, 4, 3, 1], makeRng([seed, 5, 9, 2]));
  const card = overlayCard(stage);
  const L = () => net.W.length;
  const pos = (p, k, i) => { const A = p.area, n = net.sizes[k], gx = Math.min(250, (A.w - 240) / L()), x0 = A.cx - (gx * L()) / 2, gy = Math.min(118, (A.h - 150) / 4); return [x0 + k * gx, A.cy + 20 + (i - (n - 1) / 2) * gy]; };
  const R = 25;
  const plot = new Plot(stage, {
    view: { x: [0, 1], y: [0, 1] }, grid: false, axes: false, pan: false, zoom: false,
    draw: (p) => {
      const C = p.C, c = p.ctx, a = forward(net, st.x), g = backward(net, a, st.y), back = st.mode === 'back';
      const ph = st.ph;   // forward: layers lit up to ph; backward: counts from the output end
      let gmax = 1e-9; for (const w of g.dW) for (const v of w) gmax = Math.max(gmax, Math.abs(v));
      // edges
      for (let k = 0; k < L(); k++) {
        const n = net.sizes[k], m = net.sizes[k + 1], prog = back ? ph - (L() - 1 - k) : ph - k, lit = prog >= 1;
        for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) {
          const [x1, y1] = pos(p, k, j), [x2, y2] = pos(p, k + 1, i), w = net.W[k][i * n + j], gr = g.dW[k][i * n + j];
          const hov = st.hover && ((st.hover[0] === k + 1 && st.hover[1] === i) || (back && st.hover[0] === k && st.hover[1] === j));
          c.globalAlpha = st.hover ? (hov ? 1 : 0.12) : back ? (lit ? 0.9 : 0.16) : 0.3 + 0.6 * Math.min(1, Math.abs(w) / 1.5);
          c.strokeStyle = back ? (lit ? C.tangent : C.ink3) : w >= 0 ? C.fn : C.error;
          c.lineWidth = back ? (lit ? 0.8 + 6 * Math.sqrt(Math.abs(gr) / gmax) : 1) : 0.7 + 3.2 * Math.min(1.6, Math.abs(w));
          c.beginPath(); c.moveTo(x1 + R, y1); c.bezierCurveTo((x1 + x2) / 2, y1, (x1 + x2) / 2, y2, x2 - R, y2); c.stroke();
          // moving pulse
          if (prog > 0 && prog < 1) {
            const u = back ? 1 - prog : prog, e = u * u * (3 - 2 * u), bx = x1 + R + (x2 - x1 - 2 * R) * e, mt = 1 - e;
            const by = mt * mt * mt * y1 + 3 * mt * mt * e * y1 + 3 * mt * e * e * y2 + e * e * e * y2;
            const s = back ? Math.abs(gr) / gmax : Math.min(1, Math.abs(w * a[k][j]) / 1.5);
            c.globalAlpha = 0.95; c.fillStyle = back ? C.tangent : C.approx; c.beginPath(); c.arc(bx, by, 2.5 + 5 * Math.sqrt(s), 0, 7); c.fill();
          }
        }
      }
      c.globalAlpha = 1;
      // nodes
      for (let k = 0; k <= L(); k++) for (let i = 0; i < net.sizes[k]; i++) {
        const [x, y] = pos(p, k, i), reached = back ? true : ph >= k, v = a[k][i], hov = st.hover && st.hover[0] === k && st.hover[1] === i;
        c.beginPath(); c.arc(x, y, R, 0, 7); c.fillStyle = C.stage; c.fill();
        if (reached) { c.fillStyle = withAlpha(v >= 0 ? C.fn : C.error, 0.12 + 0.6 * Math.min(1, Math.abs(v))); c.fill(); }
        c.lineWidth = hov ? 3.5 : 2; c.strokeStyle = k === L() ? C.approx : C.ink; c.stroke();
        if (st.nums && reached) p.text(f2(v), x, y + 1, { align: 'center', size: 13.5, weight: 600, halo: false });
        if (back && k > 0 && ph - (L() - k) >= 0) p.text('δ = ' + f2(g.delta[k - 1][i]), x, y + R + 13, { align: 'center', size: 12, color: C.tangent });
      }
      const names = ['Input', ...Array.from({ length: L() - 1 }, (_, i) => `Hidden layer ${i + 1}`), 'Output'];
      for (let k = 0; k <= L(); k++) { const [x] = pos(p, k, 0), top = pos(p, k, 0)[1]; let ymin = top; for (let i = 0; i < net.sizes[k]; i++) ymin = Math.min(ymin, pos(p, k, i)[1]); p.text(names[k], x, Math.min(ymin - R - 22, pos(p, 1, 0)[1] - R - 22), { align: 'center', color: C.ink2, size: 13 }); }
      const [ix, iy0] = pos(p, 0, 0), [, iy1] = pos(p, 0, 1);
      p.text('x₁', ix - R - 12, iy0, { align: 'right', italic: true, serif: true, size: 17 }); p.text('x₂', ix - R - 12, iy1, { align: 'right', italic: true, serif: true, size: 17 });
      const [ox, oy] = pos(p, L(), 0);
      p.text('ŷ', ox + R + 12, oy - 1, { italic: true, serif: true, size: 18, color: C.approx });
      p.text(`target y = ${st.y}`, ox + R + 12, oy + 24, { size: 12.5, color: C.ink2 }); p.text(`loss = ${fmtNum(loss(a[L()][0], st.y), 3)}`, ox + R + 12, oy + 42, { size: 12.5, color: C.error });
      // hover: how this neuron gets its number
      if (st.hover && st.hover[0] > 0) {
        const [k, i] = st.hover, n = net.sizes[k - 1], [x, y] = pos(p, k, i); let z = net.b[k - 1][i]; const parts = [];
        for (let j = 0; j < n; j++) { const w = net.W[k - 1][i * n + j]; z += w * a[k - 1][j]; parts.push(`(${f2(w)})(${f2(a[k - 1][j])})`); }
        const l1 = `sum = ${parts.join(' + ')} + (${f2(net.b[k - 1][i])}) = ${f2(z)}`, l2 = `${k === L() ? 'squash to 0…1: σ' : ACTS[net.act].tex.replace(/\\\\|\\operatorname\{|\}/g, '').replace('\\', '')}(${f2(z)}) = ${f2(a[k][i])}`;
        c.font = '500 13px "Instrument Sans", system-ui, sans-serif'; const w = Math.max(c.measureText(l1).width, c.measureText(l2).width) + 24, bx = Math.max(10, Math.min(p.w - w - 10, x - w / 2)), by = y + R + (back ? 28 : 12);
        c.fillStyle = C.panel; c.strokeStyle = C.line2 || C.line; c.lineWidth = 1; c.beginPath(); c.roundRect(bx, by, w, 50, 8); c.fill(); c.stroke();
        p.text(l1, bx + 12, by + 16, { halo: false, size: 13 }); p.text(l2, bx + 12, by + 35, { halo: false, size: 13, color: C.approx });
      }
    },
  });
  plot.canvas.addEventListener('pointermove', (e) => {
    const r = plot.canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top; let h = null;
    for (let k = 0; k <= L(); k++) for (let i = 0; i < net.sizes[k]; i++) { const [x, y] = pos(plot, k, i); if (Math.hypot(mx - x, my - y) < R + 4) h = [k, i]; }
    if (JSON.stringify(h) !== JSON.stringify(st.hover)) { st.hover = h; plot.redraw(); }
  });
  plot.canvas.addEventListener('pointerleave', () => { st.hover = null; plot.redraw(); });

  const g0 = group(panel);
  segmented(g0, { full: true, value: 'fwd', options: [{ value: 'fwd', label: 'Forward pass' }, { value: 'back', label: 'Backpropagation' }], onChange: (v) => { st.mode = v; st.ph = 0; tr.set(true); update(); } });
  slider(g0, { label: 'Input $x_1$', min: -2, max: 2, step: 0.05, value: st.x[0], color: 'var(--c-fn)', fmt: f2, onInput: (v) => { st.x[0] = v; update(); } });
  slider(g0, { label: 'Input $x_2$', min: -2, max: 2, step: 0.05, value: st.x[1], color: 'var(--c-fn)', fmt: f2, onInput: (v) => { st.x[1] = v; update(); } });
  segmented(g0, { full: true, label: 'Target', value: 1, options: [{ value: 0, label: '$y=0$' }, { value: 1, label: '$y=1$' }], onChange: (v) => { st.y = v; update(); } });
  const lp = loop((dt) => { st.ph += dt * 0.8 * tr.speed.get(); if (st.ph >= L() + 0.3) { st.ph = 99; tr.set(false); } update(); });
  const tr = transport(g0, {
    onPlay: (on) => { if (on) { if (st.ph >= L()) st.ph = 0; lp.start(); } else lp.stop(); },
    onReset: () => { tr.set(false); st.ph = 99; update(); },
    speed: { min: 0.25, max: 3, step: 0.25, value: 1, fmt: (v) => v.toFixed(2) + '×' },
  });
  ctx.onHide(() => tr.set(false));
  const g2 = group(panel, 'Learn');
  slider(g2, { label: 'Learning rate $\\eta$', min: 0.05, max: 2, step: 0.05, value: st.lr, fmt: f2, onInput: (v) => { st.lr = v; } });
  const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap'; g2.append(row);
  button(row, { label: 'Take one learning step', primary: true, onClick: () => { trainStep(net, [st.x], [st.y], st.lr, 0); update(); } });
  button(row, { label: 'New random weights', onClick: () => { net = makeNet([2, 4, 3, 1], makeRng([++seed, 5, 9, 2])); update(); } });
  const g1 = group(panel, 'Show');
  toggle(g1, { label: 'Formula', checked: true, onChange: (v) => { st.formula = v; update(); } });
  toggle(g1, { label: 'Numbers in the neurons', checked: true, onChange: (v) => { st.nums = v; update(); } });
  const ro = readouts(g1, [{ key: 'o', label: 'output $\\hat y$' }, { key: 'l', label: 'loss' }]);
  const nt = note(g1, '');
  function update() {
    const a = forward(net, st.x), p = a[L()][0];
    ro.set('o', fmtNum(p, 3)); ro.set('l', fmtNum(loss(p, st.y), 3));
    nt.textContent = st.mode === 'fwd' ? 'Blue lines are positive weights, red are negative, thicker means stronger. Point at a neuron to see its sum.' : 'Green shows how much the loss would change if that weight changed. The blame flows backwards from the output.';
    card.show(st.formula, st.mode === 'fwd'
      ? `a^{(l)}=\\tanh\\!\\big(W^{(l)}a^{(l-1)}+b^{(l)}\\big),\\qquad \\hat y=\\sigma\\!\\big(W^{(3)}a^{(2)}+b^{(3)}\\big)`
      : `\\begin{aligned}\\delta^{(3)}&=\\hat y-y,\\qquad \\delta^{(l)}=\\big(W^{(l+1)}\\big)^{\\!\\top}\\delta^{(l+1)}\\odot\\big(1-(a^{(l)})^2\\big)\\\\ \\frac{\\partial L}{\\partial W^{(l)}}&=\\delta^{(l)}\\,\\big(a^{(l-1)}\\big)^{\\!\\top},\\qquad W\\leftarrow W-\\eta\\,\\frac{\\partial L}{\\partial W}\\end{aligned}`);
    plot.redraw();
  }
  ctx.onShow(update);
}

// =================== Tab 2: training on data ===================
function tabTrain(ctx) {
  const { stage, panel } = ctx;
  let seed = 1;
  const st = { data: 'circle', H: 4, layers: 2, act: 'tanh', lr: 0.3, epoch: 0, hist: [], heat: true };
  let rng, D, net;
  function reset(newData = true) { rng = makeRng([seed, 2, 3, 4]); if (newData || !D) D = makeData(st.data, 240, makeRng([7, 7, 7, 7])); net = makeNet([2, ...Array(st.layers).fill(st.H), 1], rng, st.act); st.epoch = 0; st.hist = []; }
  reset();
  const plot = new Plot(stage, {
    view: { x: [-3.6, 3.6], y: [-2.9, 2.9] }, equal: true, tickPx: 90, xLabel: 'x₁', yLabel: 'x₂',
    draw: (p) => {
      const C = p.C, c = p.ctx, A = p.area, Ln = net.W.length;
      if (st.heat) {
        const cs = 9, nx = Math.ceil(A.w / cs), ny = Math.ceil(A.h / cs); c.save();
        for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const q = forward(net, [p.ix(A.x0 + (i + 0.5) * cs), p.iy(A.y0 + (j + 0.5) * cs)])[Ln][0]; c.fillStyle = q > 0.5 ? C.fn : C.approx; c.globalAlpha = 0.03 + 0.5 * Math.abs(q - 0.5) ** 1.3; c.fillRect(A.x0 + i * cs, A.y0 + j * cs, cs, cs); }
        c.restore();
      }
      for (let s = 0; s < D.X.length; s++) { p.dot(D.X[s][0], D.X[s][1], { r: 5, color: C.stage }); p.dot(D.X[s][0], D.X[s][1], { r: 3.8, color: D.Y[s] ? C.fn : C.approx }); }
      // loss history, bottom-left
      const w = 210, h = 100, x0 = 18, y0 = p.h - h - 18; c.save(); c.fillStyle = withAlpha(C.panel, 0.93); c.strokeStyle = C.line; c.lineWidth = 1; c.beginPath(); c.roundRect(x0, y0, w, h, 8); c.fill(); c.stroke(); c.restore();
      p.text('loss as it trains', x0 + 10, y0 + 14, { size: 12, color: C.error, halo: false });
      if (st.hist.length > 1) { const mx = Math.max(0.75, st.hist[0]); c.strokeStyle = C.error; c.lineWidth = 2; c.beginPath(); st.hist.forEach((v, i) => { const X = x0 + 10 + (i / (st.hist.length - 1)) * (w - 20), Y = y0 + h - 10 - (Math.min(v, mx) / mx) * (h - 38); i ? c.lineTo(X, Y) : c.moveTo(X, Y); }); c.stroke(); }
    },
  });
  const g0 = group(panel);
  dropdown(g0, { label: 'Data', options: Object.keys(DATA).map((k) => ({ value: k, label: DATA[k].label })), value: st.data, onChange: (v) => { st.data = v; tr.set(false); reset(); update(); } });
  segmented(g0, { full: true, label: 'Hidden layers', value: 2, options: [{ value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }], onChange: (v) => { st.layers = v; reset(false); update(); } });
  slider(g0, { label: 'Neurons in each layer', min: 1, max: 8, step: 1, value: st.H, fmt: String, onInput: (v) => { st.H = v; reset(false); update(); } });
  segmented(g0, { full: true, label: 'Activation', value: 'tanh', options: [{ value: 'tanh', label: 'tanh' }, { value: 'relu', label: 'ReLU' }, { value: 'sigmoid', label: 'sigmoid' }], onChange: (v) => { st.act = v; reset(false); update(); } });
  slider(g0, { label: 'Learning rate $\\eta$', min: 0.01, max: 1, step: 0.01, value: st.lr, fmt: f2, onInput: (v) => { st.lr = v; } });
  const one = () => { const l = trainStep(net, D.X, D.Y, st.lr, 0.9); st.epoch++; if (st.epoch % 2 === 1) st.hist.push(l); if (st.hist.length > 400) st.hist = st.hist.filter((_, i) => i % 2 === 0); };
  let acc = 0;
  const lp = loop((dt) => { acc += dt * 60 * tr.speed.get(); let n = 0; while (acc >= 1 && n < 12) { acc -= 1; n++; one(); } if (acc > 2) acc = 0; update(); });
  const tr = transport(g0, {
    onPlay: (on) => { if (on) { acc = 0; lp.start(); } else lp.stop(); },
    onStep: () => { one(); update(); },
    onReset: () => { tr.set(false); seed++; reset(false); update(); },
    speed: { min: 0.25, max: 4, step: 0.25, value: 1, fmt: (v) => v.toFixed(2) + '×' },
  });
  ctx.onHide(() => tr.set(false));
  const g1 = group(panel, 'Show');
  toggle(g1, { label: 'What the network predicts', checked: true, onChange: (v) => { st.heat = v; update(); } });
  const ro = readouts(g1, [{ key: 'e', label: 'steps' }, { key: 'l', label: 'loss' }, { key: 'a', label: 'points it gets right' }, { key: 'w', label: 'weights to learn' }]);
  note(g1, 'Press play. The coloured background is the network’s guess for every point on the plane. Try the spirals with too few neurons.');
  function update() {
    const e = evaluate(net, D.X, D.Y);
    ro.set('e', String(st.epoch)); ro.set('l', fmtNum(e.loss, 3)); ro.set('a', Math.round(e.acc * 100) + '%'); ro.set('w', String(net.W.reduce((s, w, k) => s + w.length + net.b[k].length, 0)));
    plot.redraw();
  }
  ctx.onShow(update);
}

mountSim({
  title: 'Neural networks',
  tabs: [
    { id: 'flow', label: 'Through the network', init: tabFlow },
    { id: 'training', label: 'Training', init: tabTrain },
    { id: 'hidden', label: 'Hidden space (3D)', init: tabHidden },
    { id: 'descent', label: 'Gradient descent (3D)', init: tabDescent },
  ],
});
