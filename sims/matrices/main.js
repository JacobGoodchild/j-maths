import { mountSim } from '../../assets/js/kit/shell.js';
import { Plot, fmtNum, MINUS } from '../../assets/js/kit/plot.js';
import { group, slider, toggle, segmented, dropdown, transport, readouts } from '../../assets/js/kit/ui.js';
import { renderTex, renderRich } from '../../assets/js/kit/tex.js';
import { loop } from '../../assets/js/kit/anim.js';
import { colors, onThemeChange } from '../../assets/js/kit/theme.js';
import { I2, det, mul, apply, lerp, eigen, PRESETS, presetMatrix, presetAt, F_SHAPE } from './mat.js';

const num = (v, d = 2) => fmtNum(v, d);
const tn = (v) => { const s = (Math.abs(v) < 5e-3 ? 0 : v).toFixed(2).replace(/\.?0+$/, ''); return s === '-0' ? '0' : s; };
const PRESET_OPTS = Object.entries(PRESETS).map(([v, p]) => ({ value: v, label: p.label }));

/** Dropdown + parameter slider (+ direction) for choosing a standard transformation. */
function presetControl(parent, o) {
  const st = { key: o.key || 'identity', p: null, dir: 'x' };
  const reset = () => { const P = PRESETS[st.key]; st.p = P.param ? P.param.value : null; };
  reset();
  const dd = dropdown(parent, {
    label: o.label || 'Transformation', options: o.custom ? [...PRESET_OPTS, { value: 'custom', label: 'Custom' }] : PRESET_OPTS, value: st.key,
    onChange: (v) => { if (v === 'custom') return; st.key = v; reset(); sync(); o.onChange(); },
  });
  const sl = slider(parent, { label: '$k$', min: -3, max: 3, step: 0.25, value: 1, fmt: (v) => tn(v) + (PRESETS[st.key].param?.unit || ''), onInput: (v) => { st.p = v; o.onChange(); } });
  const dirSeg = segmented(parent, { full: true, value: 'x', options: [{ value: 'x', label: '$x$-direction' }, { value: 'y', label: '$y$-direction' }], onChange: (v) => { st.dir = v; o.onChange(); } });
  function sync() {
    const P = PRESETS[st.key];
    sl.hide(!P.param); dirSeg.hide(!P.dirs);
    if (P.param) { renderRich(sl.el.querySelector('label'), `$${P.param.name}$` + (P.param.hint ? ' ' + P.param.hint : '')); sl.setRange(P.param.min, P.param.max); sl.input.step = P.param.step; sl.set(st.p); }
    dd.set(st.key);
  }
  sync();
  return {
    get matrix() { return presetMatrix(st.key, st.p, st.dir); },
    at: (t) => presetAt(st.key, st.p, st.dir, t),
    markCustom() { dd.set('custom'); },
    setPreset(key) { st.key = key; reset(); sync(); },
    sync,
  };
}

function matrixTex(m, cols) {
  const C = colors();
  const c = (v, col) => (cols ? `\\textcolor{${col}}{${tn(v)}}` : tn(v));
  return `\\begin{pmatrix}${c(m[0], C.fn)}&${c(m[1], C.approx)}\\\\${c(m[2], C.fn)}&${c(m[3], C.approx)}\\end{pmatrix}`;
}

/** Draw the image of the integer grid under m */
function drawGrid(p, m, C) {
  const K = 30, [a, b, c, d] = m;
  const ctx = p.ctx;
  ctx.save(); ctx.lineWidth = 1.2; ctx.strokeStyle = C.ink3; ctx.globalAlpha = 0.4; ctx.beginPath();
  for (let k = -K; k <= K; k++) {
    if (k === 0) continue;
    ctx.moveTo(p.x(a * k - b * K), p.y(c * k - d * K)); ctx.lineTo(p.x(a * k + b * K), p.y(c * k + d * K));
    ctx.moveTo(p.x(a * -K + b * k), p.y(c * -K + d * k)); ctx.lineTo(p.x(a * K + b * k), p.y(c * K + d * k));
  }
  ctx.stroke(); ctx.restore();
  p.line(-K * a, -K * c, K * a, K * c, { color: C.fn, width: 2, alpha: 0.7 });
  p.line(-K * b, -K * d, K * b, K * d, { color: C.approx, width: 2, alpha: 0.7 });
}
function drawSquare(p, m, C, o = {}) {
  const [a, b, c, d] = m, D = det(m);
  const col = D < 0 ? C.error : C.area;
  p.poly([[0, 0], [a, c], [a + b, c + d], [b, d]], { close: true, fill: col, fillAlpha: o.alpha ?? 0.22, color: col, width: 1.8, dash: o.dash });
  return D;
}
function drawOrient(p, m, C) {
  const [a, b, c, d] = m, D = det(m);
  if (Math.hypot(a, c) < 1e-3 || Math.hypot(b, d) < 1e-3 || Math.abs(D) < 1e-6) return;
  const ai = Math.atan2(c, a), aj = Math.atan2(d, b);
  let sw = aj - ai; while (sw > Math.PI) sw -= 2 * Math.PI; while (sw <= -Math.PI) sw += 2 * Math.PI;
  const r = 0.32, col = D < 0 ? C.error : C.area, e = ai + sw, s = Math.sign(sw) || 1;
  p.arc(0, 0, r, ai, e, { color: col, width: 2 });
  const ex = r * Math.cos(e), ey = r * Math.sin(e), tx = -Math.sin(e) * s, ty = Math.cos(e) * s;
  p.arrow(ex - tx * 0.06, ey - ty * 0.06, ex + tx * 0.02, ey + ty * 0.02, { color: col, width: 2, head: 9 });
}
function drawF(p, m, C, ghost) {
  const pts = F_SHAPE.map(([x, y]) => apply(m, x, y));
  const col = det(m) < 0 ? C.error : C.tangent;
  if (ghost) p.poly(pts, { close: true, color: C.ink3, width: 1.4, dash: [5, 4], alpha: 0.7 });
  else p.poly(pts, { close: true, fill: col, fillAlpha: 0.3, color: col, width: 2 });
}
function drawEigen(p, m, C) {
  const es = eigen(m);
  for (const e of es) {
    if (!e.vec) continue;
    p.slopeLine(0, 0, e.vec[1] / (e.vec[0] || 1e-12), { color: C.aux, width: 2, dash: [8, 6] });
    if (Math.abs(e.vec[0]) < 1e-9) p.vline(0, { color: C.aux, width: 2, dash: [8, 6] });
    const L = 2.4 * Math.sign(e.value || 1);
    p.dot(e.vec[0] * e.value, e.vec[1] * e.value, { r: 4, color: C.aux, ring: true });
  }
}
const mkView = () => ({ x: [-6, 6], y: [-4.2, 4.2] });

// =================== Tab 1: matrix as transformation ===================
function tabMatrix(ctx) {
  const { stage, panel } = ctx;
  const st = { M: [1, 0, 0, 1], t: 1, snap: true, matrix: false, det: false, eig: false, shape: false, orient: true };
  const overlay = document.createElement('div'); overlay.className = 'sim-overlay'; overlay.hidden = true;
  const card = document.createElement('div'); card.className = 'card-f'; overlay.append(card); stage.append(overlay);
  const cur = () => (st.t >= 1 ? st.M : st.custom ? lerp(I2, st.M, st.t) : st.pre.at(st.t));

  const plot = new Plot(stage, {
    view: mkView(), equal: true, tickPx: 80,
    draw: (p) => {
      const C = p.C, m = cur();
      drawGrid(p, m, C);
      const D = drawSquare(p, m, C);
      if (st.shape) { drawF(p, I2, C, true); drawF(p, m, C); }
      if (st.eig) drawEigen(p, m, C);
      if (st.orient) drawOrient(p, m, C);
      p.arrow(0, 0, m[0], m[2], { color: C.fn, width: 3.2, head: 13 });
      p.arrow(0, 0, m[1], m[3], { color: C.approx, width: 3.2, head: 13 });
      if (st.det) p.label('det = ' + num(D, 2), (m[0] + m[1]) / 2, (m[2] + m[3]) / 2, { align: 'center', size: 14, color: D < 0 ? C.error : C.area, weight: 600 });
    },
  });
  const snap = (v) => { if (!st.snap) return v; const r = Math.round(v * 4) / 4; return Math.abs(v - r) < 0.09 ? r : v; };
  plot.addHandle({ get: () => [st.M[0], st.M[2]], visible: () => st.t >= 1, set: (x, y) => { st.M[0] = snap(x); st.M[2] = snap(y); custom(); }, color: (C) => C.fn, r: 8, hit: 20 });
  plot.addHandle({ get: () => [st.M[1], st.M[3]], visible: () => st.t >= 1, set: (x, y) => { st.M[1] = snap(x); st.M[3] = snap(y); custom(); }, color: (C) => C.approx, r: 8, hit: 20 });

  const g0 = group(panel);
  st.pre = presetControl(g0, { custom: true, onChange: () => { st.custom = false; st.M = [...st.pre.matrix]; st.t = 1; update(); } });
  function custom() { st.custom = true; st.pre.markCustom(); update(); }
  // animate identity -> M
  const lp = loop((dt) => {
    st.t = Math.min(1, st.t + dt * 0.5 * tr.speed.get());
    if (st.t >= 1) tr.set(false);
    update();
  });
  const tr = transport(g0, {
    onPlay: (p) => { if (p) { st.t = 0; lp.start(); } else lp.stop(); },
    onReset: () => { tr.set(false); st.t = 1; update(); },
    speed: { min: 0.25, max: 3, step: 0.25, value: 1, fmt: (v) => '×' + v.toFixed(2) },
  });
  ctx.onHide(() => tr.set(false));

  const g1 = group(panel, 'Show');
  toggle(g1, { label: 'Matrix', onChange: (v) => { st.matrix = v; update(); } });
  toggle(g1, { label: 'Determinant', color: 'var(--c-area)', onChange: (v) => { st.det = v; update(); } });
  toggle(g1, { label: 'Eigenvectors', color: 'var(--c-aux)', onChange: (v) => { st.eig = v; update(); } });
  toggle(g1, { label: 'Letter F', color: 'var(--c-tangent)', onChange: (v) => { st.shape = v; update(); } });
  toggle(g1, { label: 'Orientation', checked: true, onChange: (v) => { st.orient = v; update(); } });
  toggle(g1, { label: 'Snap to grid', checked: true, onChange: (v) => { st.snap = v; } });
  const ro = readouts(g1, [{ key: 'l1', label: '$\\lambda_1$' }, { key: 'l2', label: '$\\lambda_2$' }]);
  function update() {
    const m = cur(), D = det(m);
    overlay.hidden = !st.matrix;
    if (st.matrix) renderTex(card, `\\mathbf{M}=${matrixTex(m, true)},\\quad \\det\\mathbf{M}=${tn(D)}`);
    ro.el.hidden = !st.eig;
    if (st.eig) {
      const es = eigen(m);
      ro.set('l1', es.length ? num(es[0].value, 3) + (es[0].vec ? '' : ' (all directions)') : 'complex');
      ro.set('l2', es.length > 1 ? num(es[1].value, 3) : es.length ? '—' : 'complex');
    }
    plot.redraw();
  }
  onThemeChange(() => { if (st.matrix) update(); });
  ctx.onShow(update);
}

// =================== Tab 2: combining ===================
function tabCombine(ctx) {
  const { stage, panel } = ctx;
  const st = { u: 2, shape: true, grid: false, both: false, card: true };
  const overlay = document.createElement('div'); overlay.className = 'sim-overlay';
  const card = document.createElement('div'); card.className = 'card-f'; overlay.append(card);
  stage.append(overlay);
  const gm = (A, B, u) => (u <= 1 ? B.at(u) : mul(A.at(u - 1), B.matrix));

  const plot = new Plot(stage, {
    view: mkView(), equal: true, tickPx: 80,
    draw: (p) => {
      const C = p.C, m = gm(A, B, st.u);
      if (st.grid) drawGrid(p, m, C);
      if (st.both) { const BA = mul(B.matrix, A.matrix); drawF(p, BA, { ...C, tangent: C.warn, error: C.warn }); }
      drawSquare(p, m, C, {});
      if (st.shape) { drawF(p, I2, C, true); if (st.u > 1) drawF(p, B.matrix, C, true); drawF(p, m, C); }
      p.arrow(0, 0, m[0], m[2], { color: C.fn, width: 3.2, head: 13 });
      p.arrow(0, 0, m[1], m[3], { color: C.approx, width: 3.2, head: 13 });
    },
  });
  const g0 = group(panel, 'First: B');
  const B = presetControl(g0, { key: 'rotation', label: 'Transformation', onChange: () => { st.u = Math.min(st.u, 2); update(); } });
  const g1 = group(panel, 'Then: A');
  const A = presetControl(g1, { key: 'reflection', label: 'Transformation', onChange: update });
  const g2 = group(panel);
  const prog = slider(g2, { label: 'Progress', min: 0, max: 2, step: 0.01, value: 2, color: 'var(--c-area)', fmt: (v) => (v < 1 ? 'B ' + Math.round(v * 100) + '%' : v === 1 ? 'B done' : 'A ' + Math.round((v - 1) * 100) + '%'), onInput: (v) => { st.u = v; update(); } });
  const lp = loop((dt) => { st.u = Math.min(2, st.u + dt * 0.45 * tr.speed.get()); prog.set(st.u); if (st.u >= 2) tr.set(false); update(); });
  const tr = transport(g2, {
    onPlay: (p) => { if (p) { st.u = 0; lp.start(); } else lp.stop(); },
    onReset: () => { tr.set(false); st.u = 2; prog.set(2); update(); },
    speed: { min: 0.25, max: 3, step: 0.25, value: 1, fmt: (v) => '×' + v.toFixed(2) },
  });
  ctx.onHide(() => tr.set(false));
  const g3 = group(panel, 'Show');
  toggle(g3, { label: 'Letter F', checked: true, color: 'var(--c-tangent)', onChange: (v) => { st.shape = v; update(); } });
  toggle(g3, { label: 'Grid', onChange: (v) => { st.grid = v; update(); } });
  toggle(g3, { label: 'Order reversed: $\\mathbf{BA}$', color: 'var(--c-warn)', onChange: (v) => { st.both = v; update(); } });
  function update() {
    const a = A.matrix, b = B.matrix, ab = mul(a, b), ba = mul(b, a);
    let t = `\\mathbf{A}=${matrixTex(a)},\\ \\mathbf{B}=${matrixTex(b)}\\\\[6pt] \\mathbf{AB}=${matrixTex(ab)}`;
    if (st.both) t += `\\ne \\mathbf{BA}=${matrixTex(ba)}`;
    renderTex(card, '\\begin{gathered}' + t + '\\end{gathered}');
    plot.redraw();
  }
  ctx.onShow(update);
}

mountSim({
  title: 'Matrices as transformations',
  tabs: [
    { id: 'transform', label: 'Transformation', init: tabMatrix },
    { id: 'combine', label: 'Combining', init: tabCombine },
  ],
});
