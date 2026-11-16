import { mountSim } from '../../assets/js/kit/shell.js';
import { Plot, fmtNum } from '../../assets/js/kit/plot.js';
import { group, slider, toggle, segmented, dropdown, transport, readouts } from '../../assets/js/kit/ui.js';
import { renderTex } from '../../assets/js/kit/tex.js';
import { loop } from '../../assets/js/kit/anim.js';
import { colors, withAlpha } from '../../assets/js/kit/theme.js';
import { makeRng } from '../../assets/js/kit/rng.js';
import { Scene3D, THREE, makeLabel } from '../../assets/js/kit/scene3d.js';
import { ddpmSchedule, alphaBar, beta, logSNR, score, denoise, reverseStep, SHAPES2, SHAPES3, centresOf } from './diffusion.js';

const S = 0.05, K2 = 120, T1 = 1e-3;
const VIEW = { x: [-3.6, 3.6], y: [-2.9, 2.9] };
const ST = { shape: 'spiral' };
const listeners = [];
const cache = {};
const centres = () => (cache[ST.shape] ||= centresOf(SHAPES2[ST.shape], K2, 2));
const shapeDD = (parent, after) => {
  const dd = dropdown(parent, { label: 'Data', options: Object.keys(SHAPES2).map((k) => ({ value: k, label: SHAPES2[k].label })), value: ST.shape, onChange: (v) => { ST.shape = v; listeners.forEach((f) => f()); } });
  listeners.push(() => dd.set(ST.shape)); if (after) listeners.push(after);
};
function overlayCard(stage) {
  const overlay = document.createElement('div'); overlay.className = 'sim-overlay';
  const card = document.createElement('div'); card.className = 'card-f'; overlay.append(card); stage.append(overlay);
  return { show(on, tex) { overlay.hidden = !on; if (on && tex !== this.last) { this.last = tex; renderTex(card, tex, true); } } };
}
const tx = (v, d = 2) => (Math.abs(v) < 0.5 * 10 ** -d ? 0 : v).toFixed(d);
/** small chart in the bottom-left corner of a plot: curves of fn(u), u in 0..1, with a marker at u0 */
function inset(p, curves, u0, title) {
  const c = p.ctx, C = p.C, w = 190, h = 92, x0 = 18, y0 = p.h - h - 18;
  c.save(); c.fillStyle = withAlpha(C.panel, 0.92); c.strokeStyle = C.line; c.lineWidth = 1;
  c.beginPath(); c.roundRect(x0, y0, w, h, 8); c.fill(); c.stroke();
  const ax = x0 + 10, aw = w - 20, ay = y0 + h - 10, ah = h - 34;
  for (const cv of curves) { c.strokeStyle = cv.color; c.lineWidth = 2; c.beginPath(); for (let i = 0; i <= 60; i++) { const u = i / 60, X = ax + u * aw, Y = ay - cv.f(u) * ah; i ? c.lineTo(X, Y) : c.moveTo(X, Y); } c.stroke(); }
  c.strokeStyle = C.ink; c.lineWidth = 1; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(ax + u0 * aw, ay); c.lineTo(ax + u0 * aw, ay - ah); c.stroke(); c.setLineDash([]);
  for (const cv of curves) { c.fillStyle = cv.color; c.beginPath(); c.arc(ax + u0 * aw, ay - cv.f(u0) * ah, 3.5, 0, 7); c.fill(); }
  c.restore();
  let X = x0 + 10; for (const cv of curves) { p.text(cv.label, X, y0 + 13, { color: cv.color, size: 12, halo: false }); X += c.measureText(cv.label).width + 12; }
  if (title) p.text(title, x0 + w - 10, y0 + 13, { color: C.ink3, size: 11.5, halo: false, align: 'right' });
}
const drawData = (p, alpha = 0.5) => { const c = centres(); for (let k = 0; k < K2; k++) p.dot(c[2 * k], c[2 * k + 1], { r: 2.4, color: p.C.fn, alpha }); };

// =================== Tab 1: adding noise (the forward process) ===================
function tabNoise(ctx) {
  const { stage, panel } = ctx;
  const SCH = ddpmSchedule(), NP = 700, rng = makeRng([11, 22, 33, 44]);
  const st = { n: 0, formula: true, ghost: true, circle: false };
  const eps = new Float64Array(NP * 2), jit = new Float64Array(NP * 2); for (let i = 0; i < NP * 2; i++) { eps[i] = rng.normal(); jit[i] = rng.normal() * S; }
  const card = overlayCard(stage);
  const plot = new Plot(stage, {
    view: VIEW, equal: true, tickPx: 90,
    draw: (p) => {
      const C = p.C, c = centres(), a = SCH.abar[st.n], ra = Math.sqrt(a), rn = Math.sqrt(1 - a);
      if (st.circle) { p.circle(0, 0, 1, { color: C.ink3, width: 1.2, dash: [5, 5] }); p.circle(0, 0, 2, { color: C.ink3, width: 1.2, dash: [5, 5], alpha: 0.6 }); p.label('1 s.d.', 0.72, 0.72, { color: C.ink3, size: 12, dx: 4 }); p.label('2 s.d.', 1.43, 1.43, { color: C.ink3, size: 12, dx: 4 }); }
      if (st.ghost && st.n > 0) drawData(p, 0.35);
      const col = st.n === 0 ? C.fn : C.area;
      for (let i = 0; i < NP; i++) { const k = i % K2; p.dot(ra * (c[2 * k] + jit[2 * i]) + rn * eps[2 * i], ra * (c[2 * k + 1] + jit[2 * i + 1]) + rn * eps[2 * i + 1], { r: 2.6, color: col, alpha: 0.78 }); }
      inset(p, [{ f: (u) => Math.sqrt(SCH.abar[Math.round(u * 1000)]), color: C.fn, label: 'signal √ᾱ' }, { f: (u) => Math.sqrt(1 - SCH.abar[Math.round(u * 1000)]), color: C.area, label: 'noise √(1−ᾱ)' }], st.n / 1000);
    },
  });
  const g0 = group(panel);
  shapeDD(g0, () => update());
  const sl = slider(g0, { label: 'Step $n$', min: 0, max: 1000, step: 1, value: 0, color: 'var(--c-area)', fmt: (v) => v + ' / 1000', onInput: (v) => { st.n = v; update(); } });
  const lp = loop((dt) => { st.n = Math.min(1000, st.n + dt * 1000 * tr.speed.get() / 8); sl.set(Math.round(st.n)); st.n = Math.round(st.n); if (st.n >= 1000) tr.set(false); update(); });
  let frac = 0;
  const tr = transport(g0, {
    onPlay: (on) => { if (on) { if (st.n >= 1000) st.n = 0; lp.start(); } else lp.stop(); },
    onStep: () => { st.n = Math.min(1000, st.n + 10); sl.set(st.n); update(); },
    onReset: () => { tr.set(false); st.n = 0; sl.set(0); update(); },
    speed: { min: 0.5, max: 4, step: 0.5, value: 1, fmt: (v) => v.toFixed(1) + '×' },
  });
  void frac;
  ctx.onHide(() => tr.set(false));
  const g1 = group(panel, 'Show');
  toggle(g1, { label: 'Formula', checked: true, onChange: (v) => { st.formula = v; update(); } });
  toggle(g1, { label: 'Original data', checked: true, color: 'var(--c-fn)', onChange: (v) => { st.ghost = v; update(); } });
  toggle(g1, { label: 'Standard normal rings', onChange: (v) => { st.circle = v; update(); } });
  const ro = readouts(g1, [{ key: 'b', label: '$\\beta_n$ (noise added)' }, { key: 'a', label: '$\\bar\\alpha_n$ (picture kept)' }, { key: 's', label: 'signal : noise' }]);
  function update() {
    const n = st.n, a = SCH.abar[n];
    ro.set('b', n ? SCH.beta[n].toFixed(5) : '–'); ro.set('a', a.toFixed(4)); ro.set('s', `${Math.sqrt(a).toFixed(2)} : ${Math.sqrt(1 - a).toFixed(2)}`);
    card.show(st.formula, `\\begin{aligned}x_n&=\\sqrt{\\alpha_n}\\,x_{n-1}+\\sqrt{\\beta_n}\\,\\varepsilon,\\qquad \\alpha_n=1-\\beta_n\\\\ x_n&=\\sqrt{\\bar\\alpha_n}\\,x_0+\\sqrt{1-\\bar\\alpha_n}\\,\\varepsilon=${tx(Math.sqrt(a))}\\,x_0+${tx(Math.sqrt(1 - a))}\\,\\varepsilon\\end{aligned}`);
    plot.redraw();
  }
  ctx.onShow(update);
}

// =================== Tab 2: the score field ===================
function tabScore(ctx) {
  const { stage, panel } = ctx;
  const st = { t: 0.35, pt: [1.9, 1.3], heat: true, field: true, guess: true, formula: false };
  const card = overlayCard(stage), g = new Float64Array(2), x0 = [0, 0];
  const plot = new Plot(stage, {
    view: VIEW, equal: true, tickPx: 90,
    draw: (p) => {
      const C = p.C, c = centres(), cx = p.ctx, A = p.area;
      if (st.heat) {
        const cs = 8, nx = Math.ceil(A.w / cs), ny = Math.ceil(A.h / cs), L = new Float64Array(nx * ny); let mx = -Infinity;
        for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const l = score([p.ix(A.x0 + (i + 0.5) * cs), p.iy(A.y0 + (j + 0.5) * cs)], st.t, c, 2, S, g); L[i * ny + j] = l; if (l > mx) mx = l; }
        cx.save(); cx.fillStyle = C.area;
        for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const a = Math.exp((L[i * ny + j] - mx) * 0.55); if (a < 0.02) continue; cx.globalAlpha = 0.42 * a; cx.fillRect(A.x0 + i * cs, A.y0 + j * cs, cs, cs); }
        cx.restore();
      }
      drawData(p, 0.55);
      if (st.field) {
        const sp = 38, nx = Math.floor(A.w / sp), ny = Math.floor(A.h / sp), ox = A.x0 + (A.w - (nx - 1) * sp) / 2, oy = A.y0 + (A.h - (ny - 1) * sp) / 2;
        for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
          const X = p.ix(ox + i * sp), Y = p.iy(oy + j * sp); score([X, Y], st.t, c, 2, S, g);
          const m = Math.hypot(g[0], g[1]); if (m < 1e-9) continue; const len = (sp * 0.82 * Math.tanh(m / 3)) / p.v.sx;
          p.arrow(X - (g[0] / m) * len / 2, Y - (g[1] / m) * len / 2, X + (g[0] / m) * len / 2, Y + (g[1] / m) * len / 2, { color: C.tangent, width: 1.3, head: 6, alpha: 0.25 + 0.55 * Math.tanh(m / 4) });
        }
      }
      const [X, Y] = st.pt; score(st.pt, st.t, c, 2, S, g); denoise(st.pt, st.t, g, x0);
      if (st.guess) { p.line(X, Y, x0[0], x0[1], { color: C.approx, width: 1.6, dash: [5, 5] }); p.dot(x0[0], x0[1], { r: 6, color: C.approx }); p.label('best guess of the clean point', x0[0], x0[1], { color: C.approx, dx: 10, dy: -12, size: 12.5 }); }
      const m = Math.hypot(g[0], g[1]), len = 0.9 * Math.tanh(m / 3) + 0.25;
      p.arrow(X, Y, X + (g[0] / m) * len, Y + (g[1] / m) * len, { color: C.tangent, width: 3.2, head: 13 });
      inset(p, [{ f: (u) => Math.sqrt(alphaBar(u)), color: C.fn, label: 'signal' }, { f: (u) => Math.sqrt(1 - alphaBar(u)), color: C.area, label: 'noise' }], st.t, 'time t');
    },
  });
  plot.addHandle({ get: () => st.pt, set: (x, y) => { st.pt = [x, y]; update(); }, color: (C) => C.area, r: 8, hit: 22 });
  const g0 = group(panel);
  shapeDD(g0, () => update());
  slider(g0, { label: 'Noise level $t$', min: 0.01, max: 1, step: 0.01, value: st.t, color: 'var(--c-area)', fmt: (v) => v.toFixed(2), onInput: (v) => { st.t = v; update(); } });
  const g1 = group(panel, 'Show');
  toggle(g1, { label: 'Score arrows', checked: true, color: 'var(--c-tangent)', onChange: (v) => { st.field = v; update(); } });
  toggle(g1, { label: 'Density of noisy data $p_t$', checked: true, color: 'var(--c-area)', onChange: (v) => { st.heat = v; update(); } });
  toggle(g1, { label: 'Denoised guess', checked: true, color: 'var(--c-approx)', onChange: (v) => { st.guess = v; update(); } });
  toggle(g1, { label: 'Formula', onChange: (v) => { st.formula = v; update(); } });
  const ro = readouts(g1, [{ key: 's', label: 'score $\\nabla_x\\log p_t$' }, { key: 'm', label: 'its length' }, { key: 'l', label: 'log-SNR $\\lambda_t$' }]);
  const note = document.createElement('p'); note.style.cssText = 'color:var(--ink-2);font-size:13px;line-height:1.45;margin:4px 0 0';
  note.textContent = 'The score is an arrow that points uphill, towards where noisy data is more likely. Drag the violet point. A diffusion model is a network trained to predict these arrows.'; g1.append(note);
  function update() {
    score(st.pt, st.t, centres(), 2, S, g);
    ro.set('s', `(${fmtNum(g[0], 2)}, ${fmtNum(g[1], 2)})`); ro.set('m', fmtNum(Math.hypot(g[0], g[1]), 2)); ro.set('l', fmtNum(logSNR(st.t), 2));
    card.show(st.formula, `\\begin{aligned}\\text{score}&=\\nabla_x\\log p_t(x)=-\\frac{\\varepsilon_\\theta(x,t)}{\\sqrt{1-\\bar\\alpha_t}}\\\\ \\hat x_0&=\\frac{x+(1-\\bar\\alpha_t)\\,\\nabla_x\\log p_t(x)}{\\sqrt{\\bar\\alpha_t}}\\end{aligned}`);
    plot.redraw();
  }
  ctx.onShow(update);
}

// =================== Tab 3: sampling, SDE against ODE ===================
function tabSample(ctx) {
  const { stage, panel } = ctx;
  const NP = 320, NTR = 6, rng = makeRng([5, 6, 7, 8]), tmp = new Float64Array(2);
  const st = { mode: 'sde', steps: 100, k: 0, trails: true, data: true, field: false, formula: true };
  let X = new Float64Array(NP * 2), trails = [];
  const card = overlayCard(stage);
  const tOf = (k) => 1 - ((1 - T1) * k) / st.steps;
  function fresh() { for (let i = 0; i < NP * 2; i++) X[i] = rng.normal(); st.k = 0; trails = Array.from({ length: NTR }, (_, i) => [[X[2 * i], X[2 * i + 1]]]); }
  function stepOnce() {
    if (st.k >= st.steps) return false;
    const t = tOf(st.k), h = (1 - T1) / st.steps, c = centres(), x = [0, 0];
    for (let i = 0; i < NP; i++) { x[0] = X[2 * i]; x[1] = X[2 * i + 1]; reverseStep(x, t, h, c, 2, S, st.mode, rng, tmp); X[2 * i] = x[0]; X[2 * i + 1] = x[1]; if (i < NTR) trails[i].push([x[0], x[1]]); }
    st.k++; return true;
  }
  fresh();
  const plot = new Plot(stage, {
    view: VIEW, equal: true, tickPx: 90,
    draw: (p) => {
      const C = p.C, t = tOf(st.k), c = centres(), g = tmp;
      if (st.data) drawData(p, 0.4);
      if (st.field && st.k < st.steps) {
        const A = p.area, sp = 44, nx = Math.floor(A.w / sp), ny = Math.floor(A.h / sp), ox = A.x0 + (A.w - (nx - 1) * sp) / 2, oy = A.y0 + (A.h - (ny - 1) * sp) / 2;
        for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const x = p.ix(ox + i * sp), y = p.iy(oy + j * sp); score([x, y], t, c, 2, S, g); const m = Math.hypot(g[0], g[1]), len = (sp * 0.8 * Math.tanh(m / 3)) / p.v.sx; if (m > 1e-9) p.arrow(x, y, x + (g[0] / m) * len, y + (g[1] / m) * len, { color: C.tangent, width: 1.2, head: 5, alpha: 0.4 }); }
      }
      if (st.trails) for (const tr of trails) p.poly(tr, { color: C.approx, width: 1.6, alpha: 0.8 });
      const done = st.k >= st.steps;
      for (let i = 0; i < NP; i++) p.dot(X[2 * i], X[2 * i + 1], { r: i < NTR && st.trails ? 4 : 2.7, color: i < NTR && st.trails ? C.approx : done ? C.fn : C.area, alpha: 0.85 });
      inset(p, [{ f: (u) => Math.sqrt(alphaBar(u)), color: C.fn, label: 'signal' }, { f: (u) => Math.sqrt(1 - alphaBar(u)), color: C.area, label: 'noise' }], t, 'time t');
    },
  });
  const g0 = group(panel);
  shapeDD(g0, () => { tr.set(false); fresh(); update(); });
  segmented(g0, { full: true, value: st.mode, options: [{ value: 'sde', label: 'SDE (random)' }, { value: 'ode', label: 'ODE (smooth)' }], onChange: (v) => { st.mode = v; tr.set(false); fresh(); update(); } });
  const STEPS = [5, 10, 20, 50, 100, 200, 500];
  slider(g0, { label: 'Number of steps', min: 0, max: STEPS.length - 1, step: 1, value: 4, fmt: (v) => String(STEPS[v]), onInput: (v) => { st.steps = STEPS[v]; tr.set(false); fresh(); update(); } });
  let acc = 0;
  const lp = loop((dt) => { acc += dt * st.steps / 5 * tr.speed.get(); while (acc >= 1) { acc -= 1; if (!stepOnce()) { tr.set(false); break; } } update(); });
  const tr = transport(g0, {
    onPlay: (on) => { if (on) { if (st.k >= st.steps) fresh(); acc = 0; lp.start(); } else lp.stop(); },
    onStep: () => { if (st.k >= st.steps) fresh(); else stepOnce(); update(); },
    onReset: () => { tr.set(false); fresh(); update(); },
    speed: { min: 0.25, max: 3, step: 0.25, value: 1, fmt: (v) => v.toFixed(2) + '×' },
  });
  ctx.onHide(() => tr.set(false));
  const g1 = group(panel, 'Show');
  toggle(g1, { label: 'Paths of a few points', checked: true, color: 'var(--c-approx)', onChange: (v) => { st.trails = v; update(); } });
  toggle(g1, { label: 'Target data', checked: true, color: 'var(--c-fn)', onChange: (v) => { st.data = v; update(); } });
  toggle(g1, { label: 'Score arrows', color: 'var(--c-tangent)', onChange: (v) => { st.field = v; update(); } });
  toggle(g1, { label: 'Equation', checked: true, onChange: (v) => { st.formula = v; update(); } });
  const ro = readouts(g1, [{ key: 'k', label: 'step' }, { key: 't', label: 'time $t$' }, { key: 'b', label: '$\\beta(t)$' }, { key: 'd', label: 'mean distance to data' }]);
  function update() {
    const t = tOf(st.k), c = centres(); let D = 0;
    for (let i = 0; i < NP; i++) { let m = Infinity; for (let k = 0; k < K2; k++) { const d = (X[2 * i] - c[2 * k]) ** 2 + (X[2 * i + 1] - c[2 * k + 1]) ** 2; if (d < m) m = d; } D += Math.sqrt(m); }
    ro.set('k', `${st.k} / ${st.steps}`); ro.set('t', t.toFixed(3)); ro.set('b', beta(t).toFixed(2)); ro.set('d', (D / NP).toFixed(3));
    card.show(st.formula, st.mode === 'sde'
      ? `\\mathrm{d}x=\\Big[-\\tfrac12\\beta(t)\\,x-\\beta(t)\\,\\nabla_x\\log p_t(x)\\Big]\\mathrm{d}t+\\sqrt{\\beta(t)}\\;\\mathrm{d}\\bar w`
      : `\\frac{\\mathrm{d}x}{\\mathrm{d}t}=-\\tfrac12\\beta(t)\\,x-\\tfrac12\\beta(t)\\,\\nabla_x\\log p_t(x)`);
    plot.redraw();
  }
  ctx.onShow(update);
}

// =================== Tab 4: three dimensions ===================
function tab3D(ctx) {
  const { stage, panel } = ctx;
  const NP = 900, K = 260, NTR = 16, STEPS = 160, rng = makeRng([9, 8, 7, 6]), tmp = new Float64Array(3), hex = (c) => new THREE.Color(c);
  const st = { shape: 'knot', mode: 'ode', k: 0, trails: true, arrows: false, spin: true, data: true };
  const sc = new Scene3D(stage, { up: [0, 0, 1], dir: [0.8, -1.0, 0.55] });
  const card = overlayCard(stage);
  let cen = centresOf(SHAPES3[st.shape], K, 3);
  const X = new Float64Array(NP * 3); let trails = [];
  const tOf = (k) => 1 - ((1 - T1) * k) / STEPS;
  const pGeo = new THREE.BufferGeometry(), pPos = new Float32Array(NP * 3), pCol = new Float32Array(NP * 3);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const disc = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.beginPath(); g.arc(32, 32, 28, 0, 7); g.fill(); return new THREE.CanvasTexture(c); })();
  const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.11, vertexColors: true, map: disc, alphaTest: 0.4, transparent: true })); pts.frustumCulled = false; sc.scene.add(pts);
  const dGeo = new THREE.BufferGeometry(); const dPts = new THREE.Points(dGeo, new THREE.PointsMaterial({ size: 0.075, map: disc, alphaTest: 0.2, transparent: true, opacity: 0.6 })); dPts.frustumCulled = false; sc.scene.add(dPts);
  const trGroup = new THREE.Group(), arGroup = new THREE.Group(); sc.scene.add(trGroup, arGroup);
  function fresh() { for (let i = 0; i < NP * 3; i++) X[i] = rng.normal(); st.k = 0; trails = Array.from({ length: NTR }, (_, i) => [X[3 * i], X[3 * i + 1], X[3 * i + 2]]); }
  function stepOnce() {
    if (st.k >= STEPS) return false;
    const t = tOf(st.k), h = (1 - T1) / STEPS, x = [0, 0, 0];
    for (let i = 0; i < NP; i++) { x[0] = X[3 * i]; x[1] = X[3 * i + 1]; x[2] = X[3 * i + 2]; reverseStep(x, t, h, cen, 3, S, st.mode, rng, tmp); X[3 * i] = x[0]; X[3 * i + 1] = x[1]; X[3 * i + 2] = x[2]; if (i < NTR) trails[i].push(x[0], x[1], x[2]); }
    st.k++; return true;
  }
  function buildStatic() {
    const C = colors(), g = sc.static; sc.clear(g);
    const grid = new THREE.GridHelper(8, 8, hex(C.grid2), hex(C.grid)); grid.rotation.x = Math.PI / 2; grid.position.z = -2.4; g.add(grid);
    const L = 3;
    for (const [b, name] of [[[L, 0, 0], 'x'], [[0, L, 0], 'y'], [[0, 0, L], 'z']]) {
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...b.map((v) => -v)), new THREE.Vector3(...b)]), new THREE.LineBasicMaterial({ color: hex(C.axis), transparent: true, opacity: 0.6 })));
      const sp = makeLabel(name, C.ink2, 0.45); sp.position.set(...b.map((v) => v * 1.07)); g.add(sp);
    }
    dPts.material.color = hex(C.fn); dGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cen), 3));
  }
  function refresh() {
    const C = colors(), a = hex(C.area), b = hex(C.fn), u = st.k / STEPS, col = a.clone().lerp(b, u * u);
    for (let i = 0; i < NP * 3; i++) pPos[i] = X[i];
    for (let i = 0; i < NP; i++) { pCol[3 * i] = col.r; pCol[3 * i + 1] = col.g; pCol[3 * i + 2] = col.b; }
    pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
    dPts.visible = st.data;
    sc.clear(trGroup);
    if (st.trails) for (const tr of trails) if (tr.length >= 6) trGroup.add(new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(tr), 3)), new THREE.LineBasicMaterial({ color: hex(C.approx), transparent: true, opacity: 0.85 })));
    sc.clear(arGroup);
    if (st.arrows) {
      const t = Math.max(tOf(st.k), 0.03), n = 5, v = [], x = [0, 0, 0];
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
        x[0] = (i - 2) * 1.1; x[1] = (j - 2) * 1.1; x[2] = (k - 2) * 1.1; score(x, t, cen, 3, S, tmp);
        const m = Math.hypot(tmp[0], tmp[1], tmp[2]); if (m < 1e-9) continue;
        const dir = new THREE.Vector3(tmp[0] / m, tmp[1] / m, tmp[2] / m), len = 0.2 + 0.6 * Math.tanh(m / 3);
        const ah = new THREE.ArrowHelper(dir, new THREE.Vector3(x[0], x[1], x[2]).addScaledVector(dir, -len / 2), len, hex(C.tangent), 0.16, 0.09); ah.line.material.transparent = ah.cone.material.transparent = true; ah.line.material.opacity = ah.cone.material.opacity = 0.75; v.push(ah);
      }
      // ArrowHelper children own their geometry; add under plain groups so clear() skips nothing important
      for (const ah of v) arGroup.add(ah);
    }
    const t = tOf(st.k);
    ro.set('k', `${st.k} / ${STEPS}`); ro.set('t', t.toFixed(3)); ro.set('a', `${Math.sqrt(alphaBar(t)).toFixed(2)} : ${Math.sqrt(1 - alphaBar(t)).toFixed(2)}`);
    card.show(st.eq, st.mode === 'sde'
      ? `\\mathrm{d}\\mathbf{x}=\\Big[-\\tfrac12\\beta(t)\\,\\mathbf{x}-\\beta(t)\\,\\nabla_{\\mathbf{x}}\\log p_t(\\mathbf{x})\\Big]\\mathrm{d}t+\\sqrt{\\beta(t)}\\;\\mathrm{d}\\bar{\\mathbf{w}}`
      : `\\frac{\\mathrm{d}\\mathbf{x}}{\\mathrm{d}t}=-\\tfrac12\\beta(t)\\,\\mathbf{x}-\\tfrac12\\beta(t)\\,\\nabla_{\\mathbf{x}}\\log p_t(\\mathbf{x}),\\qquad \\mathbf{x}\\in\\mathbb{R}^3`);
    sc.dirty = true;
  }
  sc.applyTheme = () => { buildStatic(); refresh(); };
  const g0 = group(panel);
  dropdown(g0, { label: 'Shape to generate', options: Object.keys(SHAPES3).map((k) => ({ value: k, label: SHAPES3[k].label })), value: st.shape, onChange: (v) => { st.shape = v; cen = centresOf(SHAPES3[v], K, 3); tr.set(false); fresh(); buildStatic(); refresh(); } });
  segmented(g0, { full: true, value: st.mode, options: [{ value: 'sde', label: 'SDE (random)' }, { value: 'ode', label: 'ODE (smooth)' }], onChange: (v) => { st.mode = v; tr.set(false); fresh(); refresh(); } });
  let acc = 0, hold = 0;
  const lp = loop((dt) => {
    if (tr.playing) { acc += dt * 32 * tr.speed.get(); let ch = false; while (acc >= 1) { acc -= 1; if (!stepOnce()) { tr.set(false, false); break; } ch = true; } if (ch) refresh(); }
    if (st.spin) { sc.scene.rotation.z += dt * 0.22; sc.dirty = true; }
    void hold;
  });
  const tr = transport(g0, {
    onPlay: (on) => { if (on && st.k >= STEPS) { fresh(); refresh(); } acc = 0; },
    onStep: () => { if (st.k >= STEPS) fresh(); else for (let i = 0; i < 4; i++) stepOnce(); refresh(); },
    onReset: () => { tr.set(false); fresh(); refresh(); },
    speed: { min: 0.25, max: 3, step: 0.25, value: 1, fmt: (v) => v.toFixed(2) + '×' },
  });
  const g1 = group(panel, 'Show');
  toggle(g1, { label: 'Paths of a few points', checked: true, color: 'var(--c-approx)', onChange: (v) => { st.trails = v; refresh(); } });
  toggle(g1, { label: 'Target shape', checked: true, color: 'var(--c-fn)', onChange: (v) => { st.data = v; refresh(); } });
  toggle(g1, { label: 'Score vectors', color: 'var(--c-tangent)', onChange: (v) => { st.arrows = v; refresh(); } });
  toggle(g1, { label: 'Equation', onChange: (v) => { st.eq = v; refresh(); } });
  toggle(g1, { label: 'Turn slowly', checked: true, onChange: (v) => { st.spin = v; } });
  const ro = readouts(g1, [{ key: 'k', label: 'step' }, { key: 't', label: 'time $t$' }, { key: 'a', label: 'signal : noise' }]);
  const note = document.createElement('p'); note.style.cssText = 'color:var(--ink-2);font-size:13px;line-height:1.45;margin:4px 0 0';
  note.textContent = 'Each point is a vector in 3D space. It starts as pure noise and follows the score back to the shape. Drag to look around.'; g1.append(note);
  fresh();
  ctx.onHide(() => { tr.set(false); lp.stop(); sc.stop(); });
  ctx.onShow(() => { sc.start(); buildStatic(); refresh(); sc.resetCamera(2.5, new THREE.Vector3(0, 0, 0)); lp.start(); });
}

mountSim({
  title: 'Diffusion models',
  tabs: [
    { id: 'noise', label: 'Adding noise', init: tabNoise },
    { id: 'score', label: 'Score field', init: tabScore },
    { id: 'sampling', label: 'Noise to data', init: tabSample },
    { id: 'space', label: 'In 3D', init: tab3D },
  ],
});
