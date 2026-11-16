// "Learn it" tab: a small network is trained in the browser to predict the noise, then used to make new samples.
import { Plot, fmtNum } from '../../assets/js/kit/plot.js';
import { group, slider, toggle, dropdown, transport, readouts, button } from '../../assets/js/kit/ui.js';
import { renderTex } from '../../assets/js/kit/tex.js';
import { loop } from '../../assets/js/kit/anim.js';
import { withAlpha } from '../../assets/js/kit/theme.js';
import { makeRng } from '../../assets/js/kit/rng.js';
import { alphaBar, score, SHAPES2, centresOf, timeGrid } from './diffusion.js';
import { makeMLP, trainBatch, epsHat, netStep } from './denoiser.js';

const S = 0.05, K = 120, NP = 260, NSTEP = 30;

export function tabTrain(ctx) {
  const { stage, panel } = ctx;
  let seed = 1;
  const st = { shape: 'moons', t: 0.3, steps: 0, hist: [], exact: true, learned: true, samples: true, eq: true, smooth: 0 };
  let rng, net, cen, samples = null;
  const reset = () => { rng = makeRng([seed, 4, 2, 9]); net = makeMLP([5, 64, 64, 2], rng); cen = centresOf(SHAPES2[st.shape], K, 2); st.steps = 0; st.hist = []; st.smooth = 0; draw(); };
  const T = timeGrid(NSTEP, 'snr', 0.005);
  function draw() { const r = makeRng([77, 1, 2, 3]); samples = new Float64Array(NP * 2); const x = [0, 0]; for (let i = 0; i < NP; i++) { x[0] = r.normal(); x[1] = r.normal(); for (let k = 0; k < NSTEP; k++) netStep(net, x, T[k], T[k + 1]); samples[2 * i] = x[0]; samples[2 * i + 1] = x[1]; } }
  const overlay = document.createElement('div'); overlay.className = 'sim-overlay'; const card = document.createElement('div'); card.className = 'card-f'; overlay.append(card); stage.append(overlay);
  renderTex(card, `L=\\mathbb{E}\\,\\big\\lVert\\varepsilon-\\varepsilon_\\theta\\big(\\sqrt{\\bar\\alpha_t}\\,x_0+\\sqrt{1-\\bar\\alpha_t}\\,\\varepsilon,\\,t\\big)\\big\\rVert^2,\\qquad \\nabla_x\\log p_t(x)\\approx-\\frac{\\varepsilon_\\theta(x,t)}{\\sqrt{1-\\bar\\alpha_t}}`, true);
  const g = new Float64Array(2);
  const plot = new Plot(stage, {
    view: { x: [-3.6, 3.6], y: [-2.9, 2.9] }, equal: true, tickPx: 90,
    draw: (p) => {
      const C = p.C, c = p.ctx, A = p.area, sg = Math.sqrt(1 - alphaBar(st.t));
      for (let k = 0; k < K; k++) p.dot(cen[2 * k], cen[2 * k + 1], { r: 2.4, color: C.fn, alpha: 0.5 });
      const sp = 44, nx = Math.floor(A.w / sp), ny = Math.floor(A.h / sp), ox = A.x0 + (A.w - (nx - 1) * sp) / 2, oy = A.y0 + (A.h - (ny - 1) * sp) / 2;
      const arrow = (X, Y, gx, gy, col, w) => { const m = Math.hypot(gx, gy); if (m < 1e-9) return; const len = (sp * 0.85 * Math.tanh(m / 3)) / p.v.sx; p.arrow(X, Y, X + (gx / m) * len, Y + (gy / m) * len, { color: col, width: w, head: 6, alpha: 0.8 }); };
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
        const X = p.ix(ox + i * sp), Y = p.iy(oy + j * sp);
        if (st.exact) { score([X, Y], st.t, cen, 2, S, g); arrow(X, Y, g[0], g[1], C.tangent, 2.6); }
        if (st.learned) { const e = epsHat(net, X, Y, st.t); arrow(X, Y, -e[0] / sg, -e[1] / sg, C.approx, 1.5); }
      }
      if (st.samples && samples) for (let i = 0; i < NP; i++) p.dot(samples[2 * i], samples[2 * i + 1], { r: 3, color: C.area, alpha: 0.85 });
      const w = 210, h = 100, x0 = 18, y0 = p.h - h - 18; c.save(); c.fillStyle = withAlpha(C.panel, 0.93); c.strokeStyle = C.line; c.lineWidth = 1; c.beginPath(); c.roundRect(x0, y0, w, h, 8); c.fill(); c.stroke(); c.restore();
      p.text('loss as it trains', x0 + 10, y0 + 14, { size: 12, color: C.error, halo: false });
      if (st.hist.length > 1) { const lo = 0.25, hi = 1.1; c.strokeStyle = C.error; c.lineWidth = 2; c.beginPath(); st.hist.forEach((v, i) => { const X = x0 + 10 + (i / (st.hist.length - 1)) * (w - 20), Y = y0 + h - 10 - ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * (h - 38); i ? c.lineTo(X, Y) : c.moveTo(X, Y); }); c.stroke(); }
    },
  });
  const g0 = group(panel);
  dropdown(g0, { label: 'Data', options: Object.keys(SHAPES2).map((k) => ({ value: k, label: SHAPES2[k].label })), value: st.shape, onChange: (v) => { st.shape = v; tr.set(false); reset(); update(); } });
  slider(g0, { label: 'Look at noise level $t$', min: 0.02, max: 1, step: 0.01, value: st.t, color: 'var(--c-area)', fmt: (v) => v.toFixed(2), onInput: (v) => { st.t = v; update(); } });
  let frame = 0;
  const one = () => { const l = trainBatch(net, cen, S, rng); st.steps++; st.smooth = st.smooth ? 0.97 * st.smooth + 0.03 * l : l; if (st.steps % 10 === 0) { st.hist.push(st.smooth); if (st.hist.length > 300) st.hist = st.hist.filter((_, i) => i % 2 === 0); } };
  const lp = loop(() => { const t0 = performance.now(), n = Math.round(12 * tr.speed.get()); for (let i = 0; i < n && performance.now() - t0 < 24; i++) one(); if (++frame % 20 === 0 && st.samples) draw(); update(); });
  const tr = transport(g0, {
    onPlay: (on) => { if (on) lp.start(); else { lp.stop(); draw(); update(); } },
    onStep: () => { for (let i = 0; i < 10; i++) one(); draw(); update(); },
    onReset: () => { tr.set(false); seed++; reset(); update(); },
    speed: { min: 0.5, max: 4, step: 0.5, value: 2, fmt: (v) => v.toFixed(1) + '×' },
  });
  ctx.onHide(() => tr.set(false));
  const g1 = group(panel, 'Show');
  toggle(g1, { label: 'Exact score', checked: true, color: 'var(--c-tangent)', onChange: (v) => { st.exact = v; update(); } });
  toggle(g1, { label: 'What the network has learnt', checked: true, color: 'var(--c-approx)', onChange: (v) => { st.learned = v; update(); } });
  toggle(g1, { label: 'Samples made by the network', checked: true, color: 'var(--c-area)', onChange: (v) => { st.samples = v; if (v) draw(); update(); } });
  toggle(g1, { label: 'Formula', checked: true, onChange: (v) => { st.eq = v; update(); } });
  const ro = readouts(g1, [{ key: 'n', label: 'training steps' }, { key: 'l', label: 'loss' }, { key: 'w', label: 'weights to learn' }]);
  const nt = document.createElement('p'); nt.style.cssText = 'color:var(--ink-2);font-size:13px;line-height:1.45;margin:4px 0 0'; g1.append(nt);
  nt.textContent = 'Press play. The network only ever sees noisy points and is asked “what noise was added?”. Its orange arrows line up with the exact green ones within seconds. The violet samples it makes take longer: give it half a minute or so to settle onto the data.';
  function update() {
    ro.set('n', String(st.steps)); ro.set('l', st.steps ? fmtNum(st.smooth, 3) : '–'); ro.set('w', String(net.W.reduce((s, w, k) => s + w.length + net.b[k].length, 0)));
    overlay.hidden = !st.eq; plot.redraw();
  }
  reset();
  ctx.onShow(update);
}
