import { mountSim } from '../../assets/js/kit/shell.js';
import { Plot, fmtNum, MINUS } from '../../assets/js/kit/plot.js';
import { group, slider, toggle, segmented, dropdown, transport, readouts } from '../../assets/js/kit/ui.js';
import { renderTex } from '../../assets/js/kit/tex.js';
import { loop } from '../../assets/js/kit/anim.js';
import { ODES, euler, improvedEuler, solve, oscillator } from './ode.js';

const KEYS = Object.keys(ODES);
const ST = { key: 'sum', pt: Object.fromEntries(KEYS.map((k) => [k, [...ODES[k].start]])) };
const ode = () => ODES[ST.key];
const pt = () => ST.pt[ST.key];
const listeners = [];
const syncAll = () => listeners.forEach((f) => f());
const ok = Number.isFinite;
const f2 = (v, d = 3) => fmtNum(v, d);
const tx = (v, d = 3) => fmtNum(v, d).replace(MINUS, '-');
const SUB = '₀₁₂₃₄₅₆₇₈₉';
const xl = (n) => 'y' + String(n).split('').map((c) => SUB[+c]).join('');

function odeDropdown(parent) {
  const dd = dropdown(parent, { label: 'Equation', options: KEYS.map((k) => ({ value: k, label: ODES[k].label })), value: ST.key, onChange: (v) => { ST.key = v; syncAll(); } });
  listeners.push(() => dd.set(ST.key));
}
function overlayCard(stage) {
  const overlay = document.createElement('div'); overlay.className = 'sim-overlay'; overlay.hidden = true;
  const card = document.createElement('div'); card.className = 'card-f'; overlay.append(card); stage.append(overlay);
  return { show(on, tex) { overlay.hidden = !on; if (on && tex !== this.last) { this.last = tex; renderTex(card, tex); } } };
}
/** Marching squares for f(x, y) = k on a grid covering the plot; returns segments in world coordinates */
function contour(fn, p, k, nx = 70, ny = 50) {
  const x0 = p.xmin, x1 = p.xmax, y0 = p.ymin, y1 = p.ymax, dx = (x1 - x0) / nx, dy = (y1 - y0) / ny, out = [];
  const val = (i, j) => fn(x0 + i * dx, y0 + j * dy) - k;
  const lerp = (a, b, va, vb) => a + ((b - a) * va) / (va - vb);
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const v = [val(i, j), val(i + 1, j), val(i + 1, j + 1), val(i, j + 1)];
    if (v.some((q) => !ok(q))) continue;
    const X = x0 + i * dx, Y = y0 + j * dy, pts = [];
    if (v[0] * v[1] < 0) pts.push([lerp(X, X + dx, v[0], v[1]), Y]);
    if (v[1] * v[2] < 0) pts.push([X + dx, lerp(Y, Y + dy, v[1], v[2])]);
    if (v[3] * v[2] < 0) pts.push([lerp(X, X + dx, v[3], v[2]), Y + dy]);
    if (v[0] * v[3] < 0) pts.push([X, lerp(Y, Y + dy, v[0], v[3])]);
    if (pts.length === 2) out.push([pts[0], pts[1]]);
    else if (pts.length === 4) out.push([pts[0], pts[1]], [pts[2], pts[3]]);
  }
  return out;
}

// =================== Tab 1: slope field ===================
function tabField(ctx) {
  const { stage, panel } = ctx;
  const st = { dens: 34, family: false, iso: false, eq: false };
  const card = overlayCard(stage);
  const plot = new Plot(stage, {
    view: ode().view, tickPx: 80, xLabel: 'x', yLabel: 'y',
    draw: (p) => {
      const C = p.C, f = ode().f, A = p.area, sp = st.dens;
      const nx = Math.floor(A.w / sp), ny = Math.floor(A.h / sp), ox = A.x0 + (A.w - (nx - 1) * sp) / 2, oy = A.y0 + (A.h - (ny - 1) * sp) / 2;
      const c = p.ctx; c.save(); c.strokeStyle = C.ink3; c.globalAlpha = 0.75; c.lineWidth = 1.5; c.lineCap = 'round'; c.beginPath();
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
        const px = ox + i * sp, py = oy + j * sp, m = f(p.ix(px), p.iy(py));
        if (!ok(m)) continue;
        const vx = p.v.sx, vy = -m * p.v.sy, L = Math.hypot(vx, vy), h = sp * 0.36;
        c.moveTo(px - (vx / L) * h, py - (vy / L) * h); c.lineTo(px + (vx / L) * h, py + (vy / L) * h);
      }
      c.stroke(); c.restore();
      if (st.iso) {
        for (const k of [-4, -2, -1, -0.5, 0, 0.5, 1, 2, 4]) for (const [a, b] of contour(f, p, k)) p.line(a[0], a[1], b[0], b[1], { color: C.aux, width: k === 0 ? 2 : 1.2, alpha: 0.7 });
      }
      if (st.family) {
        const [ya, yb] = [p.ymin, p.ymax];
        for (let k = 0; k <= 12; k++) { const y0 = ya + ((yb - ya) * k) / 12; p.curve0 = null; const sol = solve(f, p.xmin + (p.xmax - p.xmin) * 0.02, y0, p.xmin, p.xmax, 300); p.poly(sol, { color: C.fn, width: 1.4, alpha: 0.35 }); }
      }
      const [x0, y0] = pt();
      const sol = solve(f, x0, y0, p.xmin, p.xmax, 800);
      p.poly(sol, { color: C.approx, width: 3 });
    },
  });
  plot.addHandle({ get: () => pt(), set: (x, y) => { ST.pt[ST.key] = [x, y]; update(); }, color: (C) => C.approx, r: 8, hit: 20 });
  const g0 = group(panel);
  odeDropdown(g0);
  slider(g0, { label: 'Density', min: 16, max: 50, step: 2, value: Math.round(1100 / st.dens), fmt: () => '', onInput: (v) => { st.dens = 1100 / v; update(); } });
  const g1 = group(panel, 'Show');
  toggle(g1, { label: 'Family of solutions', color: 'var(--c-fn)', onChange: (v) => { st.family = v; update(); } });
  toggle(g1, { label: 'Isoclines', color: 'var(--c-aux)', onChange: (v) => { st.iso = v; update(); } });
  toggle(g1, { label: 'Equation', onChange: (v) => { st.eq = v; update(); } });
  function update() {
    card.show(st.eq, `\\frac{\\mathrm{d}y}{\\mathrm{d}x}=${ode().label.replace(/\$/g, '').replace("y'=", '')},\\qquad y(${tx(pt()[0], 2)})=${tx(pt()[1], 2)}`);
    plot.redraw();
  }
  listeners.push(() => { plot.setHome(ode().view); update(); });
  ctx.onShow(() => { plot.setHome(ode().view); update(); });
}

// =================== Tab 2: Euler's method ===================
const HS = [1, 0.75, 0.5, 0.4, 0.25, 0.2, 0.1, 0.05, 0.025, 0.01];
function tabEuler(ctx) {
  const { stage, panel } = ctx;
  const st = { hi: 2, method: 'euler', shown: 99, tan: true, table: false, formula: false, vals: false, reveal: false };
  const card = overlayCard(stage);
  const H = () => HS[st.hi];
  const xEnd = () => ode().view.x[1] - 0.15 * (ode().view.x[1] - ode().view.x[0]) * 0.2;
  const N = () => Math.max(1, Math.round((xEnd() - pt()[0]) / H()));
  const paths = () => { const [x0, y0] = pt(), f = ode().f, n = N(); return { e: euler(f, x0, y0, H(), n), i: improvedEuler(f, x0, y0, H(), n) }; };
  const exactAt = (x) => { const [x0, y0] = pt(); const d = ode(); if (d.exact) return d.exact(x0, y0)(x); const s = solve(d.f, x0, y0, x0, x, 4000); return s[s.length - 1][1]; };
  const plot = new Plot(stage, {
    view: ode().view, tickPx: 80, xLabel: 'x', yLabel: 'y',
    draw: (p) => {
      const C = p.C, f = ode().f, [x0, y0] = pt(), P = paths();
      const ref = solve(f, x0, y0, x0, xEnd(), 600); p.poly(ref, { color: C.muted, width: 4.5 });
      const draw = (pts, col, which) => {
        const k = Math.min(st.shown, pts.length - 1);
        for (let i = 0; i < k; i++) {
          const a = pts[i], b = pts[i + 1];
          if (st.tan && which === 'e') p.slopeLine(a[0], a[1], f(a[0], a[1]), { color: col, width: 1, alpha: 0.28 });
          p.line(a[0], a[1], b[0], b[1], { color: col, width: 2.6 });
        }
        for (let i = 0; i <= k; i++) p.dot(pts[i][0], pts[i][1], { r: i === 0 ? 4 : 3.8, color: col, ring: i > 0 });
      };
      if (st.method !== 'imp') draw(P.e, C.approx, 'e');
      if (st.method !== 'euler') draw(P.i, C.area, 'i');
      if (st.vals || true) {
        const e = P.e[Math.min(st.shown, P.e.length - 1)], x = e[0];
        const ex = exactAt(x); if (ok(ex)) p.dot(x, ex, { r: 4.5, color: C.ink, ring: true });
      }
    },
  });
  plot.addHandle({ get: () => pt(), set: (x, y) => { ST.pt[ST.key] = [x, y]; st.shown = 99; update(); }, color: (C) => C.ink, r: 8, hit: 20, onEnd: () => { fitView(); update(); } });

  const g0 = group(panel);
  odeDropdown(g0);
  slider(g0, { label: 'Step size $h$', min: 0, max: HS.length - 1, step: 1, value: st.hi, color: 'var(--c-approx)', fmt: (v) => String(HS[HS.length - 1 - v]), onInput: (v) => { st.hi = HS.length - 1 - v; st.shown = 99; update(); } }).set(HS.length - 1 - st.hi);
  segmented(g0, { full: true, value: 'euler', options: [{ value: 'euler', label: 'Euler' }, { value: 'imp', label: 'Improved' }, { value: 'both', label: 'Both' }], onChange: (v) => { st.method = v; update(); } });
  let acc = 0;
  const lp = loop((dt) => { acc += dt * tr.speed.get(); while (acc >= 1) { acc -= 1; st.shown = Math.min(st.shown + 1, N()); if (st.shown >= N()) { tr.set(false); break; } } update(); });
  const tr = transport(g0, {
    onPlay: (p) => { if (p) { st.shown = 0; acc = 0; lp.start(); } else lp.stop(); },
    onStep: () => { st.shown = Math.min(st.shown >= 99 ? 0 : st.shown + 1, N()); update(); },
    onReset: () => { tr.set(false); st.shown = 99; update(); },
    speed: { min: 0.5, max: 8, step: 0.5, value: 2, fmt: (v) => v.toFixed(1) + ' / s' },
  });
  ctx.onHide(() => tr.set(false));
  const g1 = group(panel, 'Show');
  toggle(g1, { label: 'Tangent lines', checked: true, onChange: (v) => { st.tan = v; update(); } });
  toggle(g1, { label: 'Formula', onChange: (v) => { st.formula = v; update(); } });
  toggle(g1, { label: 'Table', onChange: (v) => { st.table = v; update(); } });
  toggle(g1, { label: 'Error', color: 'var(--c-error)', onChange: (v) => { st.vals = v; update(); } });
  const ro = readouts(g1, [{ key: 'x', label: '$x_n$' }, { key: 'e', label: 'Euler' }, { key: 'i', label: 'Improved' }, { key: 'a', label: 'Accurate' }]);
  const tbl = document.createElement('div'); tbl.className = 'readouts'; tbl.style.gridTemplateColumns = 'auto 1fr 1fr'; tbl.style.fontSize = '12.5px'; g1.append(tbl);
  function update() {
    const P = paths(), k = Math.min(st.shown, N());
    const xn = P.e[k][0], ex = exactAt(xn);
    ro.el.hidden = !st.vals;
    if (st.vals) { ro.set('x', f2(xn, 3)); ro.set('e', `${f2(P.e[k][1], 4)} (${f2(P.e[k][1] - ex, 4)})`); ro.set('i', `${f2(P.i[k][1], 4)} (${f2(P.i[k][1] - ex, 4)})`); ro.set('a', f2(ex, 4)); }
    tbl.hidden = !st.table;
    if (st.table) {
      tbl.textContent = '';
      for (let i = Math.max(0, k - 9); i <= k; i++) {
        for (const [txt, cls] of [[`${i}`, 'k'], [f2(P.e[i][1], 5), 'v'], [f2(P.i[i][1], 5), 'v']]) { const s = document.createElement('span'); s.className = cls; s.style.textAlign = 'left'; s.textContent = txt; tbl.append(s); }
      }
    }
    const fe = '\\begin{aligned}\\text{Euler: }&y_{n+1}=y_n+h\\,f(x_n,y_n)\\\\ \\text{Improved: }&k_1=f(x_n,y_n),\\ k_2=f(x_n+h,\\,y_n+hk_1)\\\\ &y_{n+1}=y_n+\\tfrac{1}{2}h(k_1+k_2)\\end{aligned}';
    card.show(st.formula, fe);
    plot.redraw();
  }
  function fitView() {
    const d = ode(), [x0, y0] = pt(), ref = solve(d.f, x0, y0, x0, xEnd(), 300), v = d.view;
    let lo = Math.min(0, y0), hi = Math.max(0, y0);
    for (const q of ref) { if (Math.abs(q[1]) < 60 * Math.max(1, Math.abs(v.y[1] - v.y[0]))) { lo = Math.min(lo, q[1]); hi = Math.max(hi, q[1]); } }
    lo = Math.min(lo, v.y[0] * 0.5); hi = Math.max(hi, v.y[1] * 0.5);
    const pad = (hi - lo) * 0.12; plot.setHome({ x: v.x, y: [lo - pad, hi + pad] });
  }
  listeners.push(() => { st.shown = 99; fitView(); update(); });
  ctx.onShow(() => { fitView(); update(); });
}

// =================== Tab 3: convergence ===================
function tabConv(ctx) {
  const { stage, panel } = ctx;
  const st = { imp: true, euler: true, hi: 2, slopes: false };
  const plot = new Plot(stage, {
    view: { x: [-2.3, 0.2], y: [-9, 1] }, inset: { l: 60, b: 34, t: 14, r: 16 }, pin: true, tickPx: 70, xLabel: 'log₁₀ h', yLabel: 'log₁₀ |error at the end|',
    draw: (p) => {
      const C = p.C, d = ode(), [x0, y0] = pt(), X = d.view.x[1] - 0.03 * (d.view.x[1] - d.view.x[0]);
      const ref = d.exact ? d.exact(x0, y0)(X) : (() => { const s = solve(d.f, x0, y0, x0, X, 6000); return s[s.length - 1][1]; })();
      const col = { e: C.approx, i: C.area };
      const hs = []; for (let k = 0; k <= 40; k++) hs.push(Math.pow(10, -2.2 + (2.2 * k) / 40));
      for (const [key, fn, on] of [['e', euler, st.euler], ['i', improvedEuler, st.imp]]) {
        if (!on) continue;
        const pts = hs.map((h) => { const n = Math.max(1, Math.round((X - x0) / h)), hh = (X - x0) / n, y = fn(d.f, x0, y0, hh, n).pop()[1]; return [Math.log10(hh), Math.log10(Math.max(Math.abs(y - ref), 1e-16))]; });
        p.poly(pts, { color: col[key], width: 2.4 });
        const h = HS[st.hi], n = Math.max(1, Math.round((X - x0) / h)), hh = (X - x0) / n, y = fn(d.f, x0, y0, hh, n).pop()[1];
        p.dot(Math.log10(hh), Math.log10(Math.max(Math.abs(y - ref), 1e-16)), { r: 5.5, color: col[key], ring: true });
      }
      p.vline(Math.log10(HS[st.hi]), { color: C.ink3, width: 1.2, dash: [4, 4], alpha: 0.7 });
      if (st.slopes) {
        for (const [key, fn, on] of [['e', euler, st.euler], ['i', improvedEuler, st.imp]]) {
          if (!on) continue;
          const val = (h) => { const n = Math.max(1, Math.round((X - x0) / h)), hh = (X - x0) / n, y = fn(d.f, x0, y0, hh, n).pop()[1]; return [Math.log10(hh), Math.log10(Math.max(Math.abs(y - ref), 1e-16))]; };
          const a = val(0.02), b = val(0.01), m = (b[1] - a[1]) / (b[0] - a[0]);
          p.label('gradient ' + fmtNum(m, 2), b[0], b[1], { dx: 10, dy: 16, color: col[key], size: 13, align: 'left' });
        }
      }
    },
  });
  const g0 = group(panel);
  odeDropdown(g0);
  slider(g0, { label: 'Step size $h$', min: 0, max: HS.length - 1, step: 1, value: HS.length - 1 - st.hi, color: 'var(--c-approx)', fmt: (v) => String(HS[HS.length - 1 - v]), onInput: (v) => { st.hi = HS.length - 1 - v; plot.redraw(); } });
  const g1 = group(panel, 'Show');
  toggle(g1, { label: 'Euler', checked: true, color: 'var(--c-approx)', onChange: (v) => { st.euler = v; plot.redraw(); } });
  toggle(g1, { label: 'Improved Euler', checked: true, color: 'var(--c-area)', onChange: (v) => { st.imp = v; plot.redraw(); } });
  toggle(g1, { label: 'Gradients 1 and 2', onChange: (v) => { st.slopes = v; plot.redraw(); } });
  listeners.push(() => { plot.redraw(); });
  ctx.onShow(() => plot.redraw());
}

// =================== Tab 4: second order, damped oscillations ===================
function tabOsc(ctx) {
  const { stage, panel } = ctx;
  const st = { w: 3, z: 0.25, y0: 1, v0: 0, t: 0, env: false, vals: false, locus: true, T: 8 };
  stage.style.display = 'grid'; stage.style.gridTemplateColumns = '1.5fr 1fr'; stage.style.gridTemplateRows = '1fr 1fr';
  const card = overlayCard(stage);
  const sol = () => oscillator(st.w, st.z, st.y0, st.v0);
  const series = new Plot(stage, {
    view: { x: [0, st.T], y: [-2.2, 2.2] }, inset: { l: 52, b: 32, t: 12, r: 12 }, pin: true, xLabel: 't', yLabel: 'y', tickPx: 70,
    draw: (p) => {
      const C = p.C, o = sol();
      if (st.env) { const A = Math.hypot(st.y0, o.kind === 'under' ? (st.v0 + st.z * st.w * st.y0) / o.wd : 0); const a = st.z * st.w; p.curve((t) => A * Math.exp(-a * t), { color: C.ink3, width: 1.4, dash: [6, 5] }); p.curve((t) => -A * Math.exp(-a * t), { color: C.ink3, width: 1.4, dash: [6, 5] }); }
      p.curve(o.y, { color: C.fn, width: 2.8, from: 0 });
      const y = o.y(st.t); p.dot(st.t, y, { r: 5.5, color: C.fn, ring: true });
      p.line(st.t, 0, st.t, y, { color: C.ink3, width: 1.2, dash: [4, 4] });
    },
  });
  series.el.style.gridRow = '1 / 3'; series.el.style.gridColumn = '1';
  const phase = new Plot(stage, {
    view: { x: [-2.2, 2.2], y: [-6, 6] }, xLabel: 'y', yLabel: 'y′', tickPx: 60,
    draw: (p) => {
      const C = p.C, o = sol();
      p.param((t) => [o.y(t), o.dy(t)], 0, 30, { color: C.tangent, width: 2.2, n: 1200, alpha: 0.9 });
      p.dot(o.y(st.t), o.dy(st.t), { r: 5, color: C.tangent, ring: true });
    },
  });
  phase.el.style.gridRow = '1'; phase.el.style.gridColumn = '2'; phase.el.style.borderLeft = '1px solid var(--line)';
  phase.addHandle({ get: () => [st.y0, st.v0], set: (x, y) => { st.y0 = Math.max(-2, Math.min(2, Math.round(x * 20) / 20)); st.v0 = Math.max(-6, Math.min(6, Math.round(y * 10) / 10)); y0s.set(st.y0); v0s.set(st.v0); update(); }, color: (C) => C.tangent, r: 7.5, hit: 20 });
  const roots = new Plot(stage, {
    view: { x: [-8, 2], y: [-5, 5] }, xLabel: 'Re', yLabel: 'Im', equal: true, tickPx: 60,
    draw: (p) => {
      const C = p.C, o = sol(), w = st.w;
      if (st.locus) { p.arc(0, 0, w, Math.PI / 2, (3 * Math.PI) / 2, { color: C.ink3, width: 1.3, dash: [4, 4] }); p.line(-w, 0, -1000, 0, { color: C.ink3, width: 1.3, dash: [4, 4] }); }
      for (const r of o.roots) p.dot(r[0], r[1], { r: 6, color: C.area, ring: true });
    },
  });
  roots.el.style.gridRow = '2'; roots.el.style.gridColumn = '2'; roots.el.style.borderLeft = '1px solid var(--line)'; roots.el.style.borderTop = '1px solid var(--line)';
  series.el.style.borderLeft = '0';

  const lp = loop((dt) => { st.t += dt * tr.speed.get(); if (st.t > st.T) st.t = 0; update(); });
  const g0 = group(panel);
  const ws = slider(g0, { label: 'Frequency $\\omega$', min: 0.5, max: 5, step: 0.1, value: st.w, color: 'var(--c-fn)', fmt: (v) => f2(v, 1), onInput: (v) => { st.w = v; update(); } });
  slider(g0, { label: 'Damping $\\zeta$', min: 0, max: 2.5, step: 0.05, value: st.z, color: 'var(--c-error)', fmt: (v) => f2(v, 2), onInput: (v) => { st.z = v; update(); } });
  const y0s = slider(g0, { label: '$y(0)$', min: -2, max: 2, step: 0.05, value: st.y0, fmt: (v) => f2(v, 2), onInput: (v) => { st.y0 = v; update(); } });
  const v0s = slider(g0, { label: "$y'(0)$", min: -6, max: 6, step: 0.1, value: st.v0, fmt: (v) => f2(v, 1), onInput: (v) => { st.v0 = v; update(); } });
  const tr = transport(g0, {
    onPlay: (p) => (p ? lp.start() : lp.stop()), onReset: () => { st.t = 0; tr.set(false); update(); },
    speed: { min: 0.25, max: 3, step: 0.25, value: 1, fmt: (v) => '×' + v.toFixed(2) },
  });
  ctx.onHide(() => tr.set(false));
  const g1 = group(panel, 'Show');
  toggle(g1, { label: 'Envelope', onChange: (v) => { st.env = v; update(); } });
  toggle(g1, { label: 'Path of the roots', checked: true, color: 'var(--c-area)', onChange: (v) => { st.locus = v; update(); } });
  toggle(g1, { label: 'Equation', onChange: (v) => { st.vals = v; update(); } });
  const ro = readouts(g1, [{ key: 'k', label: 'Case' }, { key: 'm1', label: '$m_1$' }, { key: 'm2', label: '$m_2$' }]);
  function update() {
    const o = sol();
    ro.el.hidden = !st.vals;
    if (st.vals) {
      ro.set('k', { under: 'Underdamped', critical: 'Critical', over: 'Overdamped' }[o.kind]);
      const rs = o.roots.map((r) => (Math.abs(r[1]) < 1e-9 ? f2(r[0], 3) : `${f2(r[0], 2)} ${r[1] < 0 ? MINUS : '+'} ${f2(Math.abs(r[1]), 2)}i`));
      ro.set('m1', rs[0]); ro.set('m2', rs[1]);
    }
    const gen = { under: '\\mathrm{e}^{-\\zeta\\omega t}\\left(A\\cos\\omega_d t+B\\sin\\omega_d t\\right)', critical: '(A+Bt)\\mathrm{e}^{-\\omega t}', over: 'A\\mathrm{e}^{m_1t}+B\\mathrm{e}^{m_2t}' }[o.kind];
    card.show(st.vals, `y''+${tx(2 * st.z * st.w, 2)}y'+${tx(st.w * st.w, 2)}y=0\\ \\Rightarrow\\ m^{2}+${tx(2 * st.z * st.w, 2)}m+${tx(st.w * st.w, 2)}=0,\\quad y=${gen}`);
    const reach = st.z > 1 ? st.w * (st.z + Math.sqrt(st.z * st.z - 1)) : st.w, xm = Math.max(1.6 * st.w, reach * 1.1);
    roots.setHome({ x: [-xm - 0.2 * st.w, 0.45 * st.w], y: [-1.4 * st.w, 1.4 * st.w] });
    series.redraw(); phase.redraw(); roots.redraw();
  }
  ctx.onShow(update);
}

mountSim({
  title: 'Differential equations',
  tabs: [
    { id: 'slope-field', label: 'Slope field', init: tabField },
    { id: 'euler', label: 'Euler’s method', init: tabEuler },
    { id: 'convergence', label: 'Convergence', init: tabConv },
    { id: 'oscillations', label: 'Oscillations', init: tabOsc },
  ],
});
