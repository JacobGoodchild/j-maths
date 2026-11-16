// "Through time" tab: one-dimensional data, time along the x-axis. Shows the noisy density p_t(x)
// with paths of the forward SDE (adding noise), the reverse SDE and the probability-flow ODE.
import { Plot } from '../../assets/js/kit/plot.js';
import { group, slider, toggle, segmented, dropdown, transport, readouts } from '../../assets/js/kit/ui.js';
import { renderTex } from '../../assets/js/kit/tex.js';
import { loop } from '../../assets/js/kit/anim.js';
import { makeRng } from '../../assets/js/kit/rng.js';
import { alphaBar, score, reverseStep, forwardStep } from './diffusion.js';

const S1 = 0.1, NS = 320, T1 = 1e-3;
const DATA1 = {
  two: { label: 'Two values', c: [-1.3, 1.3] },
  three: { label: 'Three values', c: [-1.7, 0, 1.7] },
  uneven: { label: 'Uneven (3 to 1)', c: [-1.2, -1.2, -1.2, 1.5] },
  one: { label: 'One value', c: [1.2] },
};

export function tabTime(ctx) {
  const { stage, panel } = ctx;
  const st = { data: 'two', mode: 'fwd', prog: 1, np: 14, heat: true, eq: true };
  const overlay = document.createElement('div'); overlay.className = 'sim-overlay'; const card = document.createElement('div'); card.className = 'card-f'; overlay.append(card); stage.append(overlay);
  const tmp = new Float64Array(1);
  let paths = [], cen = new Float64Array(DATA1.two.c);
  function build() {
    cen = new Float64Array(DATA1[st.data].c); paths = [];
    const rng = makeRng([21, 22, 23, 24]), noise = makeRng([31, 32, 33, 34]);   // the same starting points for the SDE and the ODE
    for (let i = 0; i < st.np; i++) {
      const pts = [], x = [0];
      if (st.mode === 'fwd') { x[0] = cen[i % cen.length] + S1 * rng.normal(); pts.push([0, x[0]]); for (let k = 0; k < NS; k++) { forwardStep(x, k / NS, 1 / NS, noise); pts.push([(k + 1) / NS, x[0]]); } }
      else { x[0] = rng.normal(); pts.push([1, x[0]]); const h = (1 - T1) / NS; for (let k = 0; k < NS; k++) { const t = 1 - h * k; reverseStep(x, t, h, cen, 1, S1, st.mode, noise, tmp); pts.push([t - h, x[0]]); } }
      paths.push(pts);
    }
  }
  const plot = new Plot(stage, {
    view: { x: [-0.06, 1.06], y: [-3.3, 3.3] }, tickPx: 90, xLabel: 't', yLabel: 'x',
    draw: (p) => {
      const C = p.C, c = p.ctx, A = p.area;
      if (st.heat) {
        const cw = 6, ch = 5, nx = Math.ceil(A.w / cw), ny = Math.ceil(A.h / ch); c.save(); c.fillStyle = C.area;
        for (let i = 0; i < nx; i++) { const t = p.ix(A.x0 + (i + 0.5) * cw); if (t < 0 || t > 1) continue;
          for (let j = 0; j < ny; j++) { const d = Math.exp(score([p.iy(A.y0 + (j + 0.5) * ch)], Math.max(t, 1e-4), cen, 1, S1, tmp)), a = Math.min(0.62, 0.9 * Math.sqrt(d) * 0.75); if (a < 0.015) continue; c.globalAlpha = a; c.fillRect(A.x0 + i * cw, A.y0 + j * ch, cw, ch); } }
        c.restore();
      }
      p.vline(0, { color: C.fn, width: 2 }); p.vline(1, { color: C.ink3, width: 1.5, dash: [5, 5] });
      p.text('data', p.x(0) + 8, A.y0 + 16, { color: C.fn, size: 13 }); p.text('pure noise', p.x(1) - 8, A.y0 + 16, { color: C.ink2, size: 13, align: 'right' });
      const fwd = st.mode === 'fwd', col = fwd ? C.fn : C.approx, n = Math.round(st.prog * NS);
      for (const pts of paths) { p.poly(pts.slice(0, n + 1), { color: col, width: st.mode === 'ode' ? 1.8 : 1.2, alpha: st.mode === 'ode' ? 0.85 : 0.6 }); }
      for (const pts of paths) p.dot(pts[n][0], pts[n][1], { r: 3.6, color: col });
      const tn = paths[0][n][0]; p.vline(tn, { color: C.ink, width: 1, alpha: 0.5 });
    },
  });
  const g0 = group(panel);
  dropdown(g0, { label: 'Data', options: Object.keys(DATA1).map((k) => ({ value: k, label: DATA1[k].label })), value: st.data, onChange: (v) => { st.data = v; build(); update(); } });
  segmented(g0, { full: true, value: 'fwd', options: [{ value: 'fwd', label: 'Add noise' }, { value: 'sde', label: 'SDE back' }, { value: 'ode', label: 'ODE back' }], onChange: (v) => { st.mode = v; build(); st.prog = 0; tr.set(true); update(); } });
  slider(g0, { label: 'Number of paths', min: 1, max: 80, step: 1, value: st.np, fmt: String, onInput: (v) => { st.np = v; build(); update(); } });
  const lp = loop((dt) => { st.prog = Math.min(1, st.prog + dt * 0.28 * tr.speed.get()); if (st.prog >= 1) tr.set(false); update(); });
  const tr = transport(g0, {
    onPlay: (on) => { if (on) { if (st.prog >= 1) st.prog = 0; lp.start(); } else lp.stop(); },
    onReset: () => { tr.set(false); st.prog = 1; update(); },
    speed: { min: 0.25, max: 3, step: 0.25, value: 1, fmt: (v) => v.toFixed(2) + '×' },
  });
  ctx.onHide(() => tr.set(false));
  const g1 = group(panel, 'Show');
  toggle(g1, { label: 'Density $p_t(x)$', checked: true, color: 'var(--c-area)', onChange: (v) => { st.heat = v; update(); } });
  toggle(g1, { label: 'Equation', checked: true, onChange: (v) => { st.eq = v; update(); } });
  const ro = readouts(g1, [{ key: 't', label: 'time $t$' }, { key: 's', label: 'signal : noise' }]);
  const nt = document.createElement('p'); nt.style.cssText = 'color:var(--ink-2);font-size:13px;line-height:1.45;margin:4px 0 0'; g1.append(nt);
  function update() {
    const n = Math.round(st.prog * NS), t = paths[0][n][0], a = alphaBar(t);
    ro.set('t', t.toFixed(3)); ro.set('s', `${Math.sqrt(a).toFixed(2)} : ${Math.sqrt(1 - a).toFixed(2)}`);
    nt.textContent = st.mode === 'fwd' ? 'Each path starts at a data value and is shaken until nothing of it is left: the whole crowd becomes one bell curve.'
      : st.mode === 'sde' ? 'Running time backwards with fresh randomness. Each path jitters, but the crowd lands back on the data in the right proportions.'
      : 'The same starting noise, with no randomness at all. The paths are smooth and never cross, yet the crowd still ends on the data.';
    overlay.hidden = !st.eq;
    const tex = st.mode === 'fwd' ? `\\mathrm{d}x=-\\tfrac12\\beta(t)\\,x\\,\\mathrm{d}t+\\sqrt{\\beta(t)}\\;\\mathrm{d}w`
      : st.mode === 'sde' ? `\\mathrm{d}x=\\Big[-\\tfrac12\\beta(t)\\,x-\\beta(t)\\,\\nabla_x\\log p_t(x)\\Big]\\mathrm{d}t+\\sqrt{\\beta(t)}\\;\\mathrm{d}\\bar w`
      : `\\frac{\\mathrm{d}x}{\\mathrm{d}t}=-\\tfrac12\\beta(t)\\,x-\\tfrac12\\beta(t)\\,\\nabla_x\\log p_t(x)`;
    if (st.eq && card.dataset.t !== tex) { card.dataset.t = tex; renderTex(card, tex, true); }
    plot.redraw();
  }
  build();
  ctx.onShow(update);
}
