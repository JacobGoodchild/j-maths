import { mountSim } from '../../assets/js/kit/shell.js';
import { Plot, fmtNum, MINUS } from '../../assets/js/kit/plot.js';
import { group, slider, toggle, segmented, dropdown, transport, readouts } from '../../assets/js/kit/ui.js';
import { renderTex } from '../../assets/js/kit/tex.js';
import { loop } from '../../assets/js/kit/anim.js';
import { FUNCS, d1, d2 } from '../../assets/js/kit/funcs.js';

const KEYS = ['x2', 'cubic', 'quartic', 'sin', 'cos', 'tan', 'exp', 'ln', 'recip', 'xsin', 'gauss', 'abs', 'cbrt', 'wobble'];
const fnOptions = KEYS.map((k) => ({ value: k, label: FUNCS[k].label }));
const S = { key: 'cubic', x: -1.6 };
const def = () => FUNCS[S.key];
const f1 = (x) => { const d = def(); return d.df ? d.df(x) : d1(d.f, x); };
const f2 = (x) => { const d = def(); return d.ddf ? d.ddf(x) : d2(d.f, x); };
const listeners = [];
const syncAll = () => listeners.forEach((f) => f());
const num = (v, d = 3) => (Number.isFinite(v) ? fmtNum(v, d) : 'undefined');
const dom = () => (def().domain ? def().domain[0] : -Infinity);
const ok = Number.isFinite;

function funcDropdown(parent) {
  const dd = dropdown(parent, { label: 'Function', options: fnOptions, value: S.key, onChange: (v) => { S.key = v; S.x = startX(); syncAll(); } });
  listeners.push(() => dd.set(S.key));
}
function startX() { const v = def().view.x; return Math.max(dom() + 1e-3, v[0] + (v[1] - v[0]) * 0.25); }

/** Robust y-range for a function over x-range: percentiles so asymptotes don't blow the scale. */
function yRange(fn, [x0, x1], include0 = true) {
  const ys = [];
  for (let i = 0; i <= 600; i++) { const y = fn(x0 + ((x1 - x0) * i) / 600); if (ok(y)) ys.push(y); }
  if (!ys.length) return [-1, 1];
  ys.sort((a, b) => a - b);
  let lo = ys[Math.floor(ys.length * 0.04)], hi = ys[Math.ceil(ys.length * 0.96) - 1];
  if (include0) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
  const pad = (hi - lo || 1) * 0.15;
  return [lo - pad, hi + pad];
}
/** Points where f'(x) = 0 within the view, by sign changes and bisection. */
function stationary(xr) {
  const out = [], N = 1500, [a, b] = xr; if (def().noStat || S.key === 'wobble') return out;
  let px = a, py = f1(a);
  for (let i = 1; i <= N; i++) {
    const x = a + ((b - a) * i) / N, y = f1(x);
    if (ok(py) && ok(y) && py * y < 0 && Math.abs(py) + Math.abs(y) < 1e3) {
      let lo = px, hi = x, flo = py;
      for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2, fm = f1(m); if (flo * fm <= 0) hi = m; else { lo = m; flo = fm; } }
      out.push((lo + hi) / 2);
    } else if (ok(y) && y === 0 && ok(py)) out.push(x);
    px = x; py = y;
  }
  return out;
}

// =================== Tab 1: tracer ===================
function tabTracer(ctx) {
  const { stage, panel } = ctx;
  stage.classList.add('col');
  const st = { lo: S.x, hi: S.x, whole: true, stat: false, second: false, conc: false, tri: false, vals: false, sp: [] };
  let busy = false;
  const plots = [];
  const linkX = (from) => { if (busy) return; busy = true; for (const p of plots) if (p !== from) { p.v.cx = from.v.cx; p.v.sx = from.v.sx; p.touched = true; p.redraw(); } busy = false; };
  const mk = (o) => { const p = new Plot(stage, { onView: linkX, tickPx: 70, ...o }); plots.push(p); return p; };

  const top = mk({
    view: def().view,
    draw: (p) => {
      const C = p.C, d = def(), x = S.x, fx = d.f(x), m = f1(x);
      if (st.conc) {
        const w = 3, N = Math.ceil(p.area.w / w);
        let runStart = 0, runSign = 0;
        const flush = (end) => { if (runSign) { p.ctx.globalAlpha = 0.1; p.ctx.fillStyle = runSign > 0 ? C.aux : C.error; p.ctx.fillRect(p.area.x0 + runStart * w, p.area.y0, (end - runStart) * w, p.area.h); p.ctx.globalAlpha = 1; } };
        for (let i = 0; i < N; i++) {
          const c = f2(p.ix(p.area.x0 + i * w + w / 2)), sg = ok(c) && Math.abs(c) > 1e-9 ? Math.sign(c) : 0;
          if (sg !== runSign) { flush(i); runStart = i; runSign = sg; }
        }
        flush(N);
      }
      p.curve(d.f, { color: C.fn, width: 2.8 });
      if (st.stat) for (const sx of st.sp) { const y = d.f(sx); if (ok(y)) { p.dot(sx, y, { r: 5, color: C.error, ring: true }); } }
      if (ok(fx) && ok(m)) {
        p.slopeLine(x, fx, m, { color: C.tangent, width: 2.2, alpha: 0.95 });
        if (st.tri) {
          p.poly([[x, fx], [x + 1, fx], [x + 1, fx + m]], { close: true, fill: C.tangent, fillAlpha: 0.12, color: C.tangent, width: 1.2 });
          p.label('1', x + 0.5, fx, { dy: 13, align: 'center', color: C.tangent, size: 12.5 });
          p.label(num(m, 2), x + 1, fx + m / 2, { dx: 8, align: 'left', color: C.tangent, size: 12.5 });
        }
      }
      if (ok(fx)) p.line(x, fx, x, p.ymin, { color: C.ink3, width: 1.2, dash: [4, 4], alpha: 0.6 });
    },
  });
  top.addHandle({ get: () => [S.x, ok(def().f(S.x)) ? def().f(S.x) : 0], set: (x) => setX(Math.max(dom() + 1e-3, x)), color: (C) => C.fn, r: 8, hit: 20 });

  const mid = mk({
    view: { x: def().view.x, y: [-1, 1] }, yLabel: "f′(x)",
    draw: (p) => {
      const C = p.C, x = S.x, m = f1(x);
      if (st.whole) p.curve(f1, { color: C.tangent, width: 2.2, alpha: 0.28 });
      p.curve(f1, { color: C.tangent, width: 3.2, from: st.lo, to: st.hi });
      if (st.stat) for (const sx of st.sp) p.dot(sx, 0, { r: 5, color: C.error, ring: true });
      if (ok(m)) { p.line(x, p.ymax, x, m, { color: C.ink3, width: 1.2, dash: [4, 4], alpha: 0.6 }); p.dot(x, m, { r: 5.5, color: C.tangent, ring: true }); }
    },
  });
  const low = mk({
    view: { x: def().view.x, y: [-1, 1] }, yLabel: "f″(x)",
    draw: (p) => {
      const C = p.C, x = S.x, m = f2(x);
      if (st.whole) p.curve(f2, { color: C.area, width: 2.2, alpha: 0.28 });
      p.curve(f2, { color: C.area, width: 3.2, from: st.lo, to: st.hi });
      if (ok(m)) { p.line(x, p.ymax, x, m, { color: C.ink3, width: 1.2, dash: [4, 4], alpha: 0.6 }); p.dot(x, m, { r: 5.5, color: C.area, ring: true }); }
    },
  });
  top.el.style.flex = '1.5 1 0'; mid.el.style.flex = '1 1 0'; low.el.style.flex = '1 1 0';
  top.el.style.borderLeft = mid.el.style.borderLeft = low.el.style.borderLeft = '0';
  low.el.hidden = true;

  function setX(x) { S.x = x; st.lo = Math.min(st.lo, x); st.hi = Math.max(st.hi, x); update(); }
  function refit() {
    const d = def();
    st.sp = stationary(d.view.x);
    st.lo = st.hi = S.x;
    top.setHome(d.view);
    mid.setHome({ x: d.view.x, y: yRange(f1, d.view.x) });
    low.setHome({ x: d.view.x, y: yRange(f2, d.view.x) });
    update();
  }
  const g0 = group(panel);
  funcDropdown(g0);
  // sweep
  let dir = 1;
  const lp = loop((dt) => {
    const v = def().view.x, sp = (v[1] - v[0]) * 0.12 * tr.speed.get();
    let x = S.x + dir * sp * dt;
    if (x > v[1] - 0.02 * (v[1] - v[0])) { x = v[1] - 0.02 * (v[1] - v[0]); tr.set(false); }
    setX(Math.max(dom() + 1e-3, x));
  });
  const tr = transport(g0, {
    onPlay: (p) => { if (p) { const v = def().view.x; if (S.x > v[1] - 0.05 * (v[1] - v[0])) { S.x = Math.max(dom() + 1e-3, v[0] + 0.02 * (v[1] - v[0])); st.lo = st.hi = S.x; } lp.start(); } else lp.stop(); },
    onReset: () => { tr.set(false); S.x = startX(); st.lo = st.hi = S.x; update(); },
    speed: { min: 0.25, max: 3, step: 0.25, value: 1, fmt: (v) => '×' + v.toFixed(2) },
  });
  ctx.onHide(() => tr.set(false));
  const g1 = group(panel, 'Show');
  toggle(g1, { label: 'Gradient triangle', color: 'var(--c-tangent)', onChange: (v) => { st.tri = v; update(); } });
  toggle(g1, { label: 'Stationary points', color: 'var(--c-error)', onChange: (v) => { st.stat = v; update(); } });
  toggle(g1, { label: 'Second derivative', color: 'var(--c-area)', onChange: (v) => { st.second = v; low.el.hidden = !v; update(); } });
  toggle(g1, { label: 'Concavity', color: 'var(--c-aux)', onChange: (v) => { st.conc = v; update(); } });
  toggle(g1, { label: 'Whole derivative', checked: true, onChange: (v) => { st.whole = v; update(); } });
  toggle(g1, { label: 'Values', onChange: (v) => { st.vals = v; update(); } });
  const ro = readouts(g1, [{ key: 'x', label: '$x$' }, { key: 'f', label: '$f(x)$' }, { key: 'd', label: "$f'(x)$" }, { key: 'dd', label: "$f''(x)$" }]);
  function update() {
    ro.el.hidden = !st.vals;
    if (st.vals) { ro.set('x', num(S.x, 3)); ro.set('f', num(def().f(S.x), 3)); ro.set('d', num(f1(S.x), 3)); ro.set('dd', num(f2(S.x), 3)); const r = ro.el.children; r[6].hidden = r[7].hidden = !st.second; }
    for (const p of plots) p.redraw();
  }
  listeners.push(refit);
  ctx.onShow(refit);
}

// =================== Tab 2: first principles ===================
function tabFirst(ctx) {
  const { stage, panel } = ctx;
  const st = { t: 0.15, dir: 1, tan: false, tri: false, formula: false, vals: false, table: false };
  const H = () => st.dir * 2 * Math.pow(10, -4 * st.t);
  const overlay = document.createElement('div'); overlay.className = 'sim-overlay'; overlay.hidden = true;
  const card = document.createElement('div'); card.className = 'card-f'; overlay.append(card); stage.append(overlay);
  let h = H();
  const plot = new Plot(stage, {
    view: def().view, tickPx: 70,
    draw: (p) => {
      const C = p.C, d = def(), x = S.x, fx = d.f(x), x2 = x + h, fy = d.f(x2);
      p.curve(d.f, { color: C.fn, width: 2.8 });
      if (!ok(fx)) return;
      const m = f1(x);
      if (st.tan && ok(m)) p.slopeLine(x, fx, m, { color: C.tangent, width: 2.2, alpha: 0.9, dash: [7, 5] });
      if (ok(fy)) {
        const q = (fy - fx) / h;
        if (st.tri) {
          p.poly([[x, fx], [x2, fx], [x2, fy]], { close: true, fill: C.approx, fillAlpha: 0.12, color: C.approx, width: 1.3, dash: [4, 3] });
          if (Math.abs(p.x(x2) - p.x(x)) > 36) {
            p.label('h', (x + x2) / 2, fx, { dy: (fy > fx) === (h > 0) ? 14 : 14, align: 'center', color: C.approx, size: 13, italic: true });
            p.label('f(x+h) − f(x)', x2, (fx + fy) / 2, { dx: h > 0 ? 8 : -8, align: h > 0 ? 'left' : 'right', color: C.approx, size: 12.5 });
          }
        }
        p.slopeLine(x, fx, q, { color: C.approx, width: 2.4 });
        p.dot(x2, fy, { r: 5.5, color: C.approx, ring: true });
      }
    },
  });
  plot.addHandle({ get: () => [S.x, ok(def().f(S.x)) ? def().f(S.x) : 0], set: (x) => { S.x = Math.max(dom() + 1e-3, x); update(); }, color: (C) => C.fn, r: 8, hit: 20 });
  plot.addHandle({
    get: () => { const q = S.x + h, y = def().f(q); return [q, ok(y) ? y : 0]; },
    set: (x) => {
      let nh = x - S.x; if (Math.abs(nh) < 2e-4) nh = Math.sign(nh || st.dir) * 2e-4;
      nh = Math.max(-2, Math.min(2, nh)); st.dir = nh >= 0 ? 1 : -1; st.t = Math.min(1, Math.max(0, -Math.log10(Math.abs(nh) / 2) / 4));
      hs.set(st.t); dirSeg.set(st.dir > 0 ? 'r' : 'l'); update();
    }, color: (C) => C.approx, r: 7, hit: 20,
  });

  const g0 = group(panel);
  funcDropdown(g0);
  const hs = slider(g0, {
    label: '$h$', min: 0, max: 1, step: 0.002, value: st.t, color: 'var(--c-approx)',
    fmt: () => num(h, Math.abs(h) < 0.01 ? 4 : 3), onInput: (v) => { st.t = v; update(); },
  });
  const dirSeg = segmented(g0, { full: true, value: 'r', options: [{ value: 'r', label: '$h>0$' }, { value: 'l', label: '$h<0$' }], onChange: (v) => { st.dir = v === 'r' ? 1 : -1; update(); } });
  const lp = loop((dt) => { st.t = Math.min(1, st.t + dt * 0.12 * tr.speed.get()); hs.set(st.t); if (st.t >= 1) tr.set(false); update(); });
  const tr = transport(g0, {
    onPlay: (p) => { if (p) { if (st.t >= 0.999) { st.t = 0; } lp.start(); } else lp.stop(); },
    onReset: () => { tr.set(false); st.t = 0.15; hs.set(st.t); update(); },
    speed: { min: 0.5, max: 4, step: 0.5, value: 1.5, fmt: (v) => '×' + v.toFixed(1) },
  });
  ctx.onHide(() => tr.set(false));
  const g1 = group(panel, 'Show');
  toggle(g1, { label: 'Tangent', color: 'var(--c-tangent)', onChange: (v) => { st.tan = v; update(); } });
  toggle(g1, { label: 'Triangle', color: 'var(--c-approx)', onChange: (v) => { st.tri = v; update(); } });
  toggle(g1, { label: 'Formula', onChange: (v) => { st.formula = v; update(); } });
  toggle(g1, { label: 'Values', onChange: (v) => { st.vals = v; update(); } });
  toggle(g1, { label: 'Table of $h$', onChange: (v) => { st.table = v; update(); } });
  const ro = readouts(g1, [{ key: 'x', label: '$x$' }, { key: 'h', label: '$h$' }, { key: 'q', label: 'Chord gradient' }, { key: 'd', label: "$f'(x)$" }]);
  const tbl = document.createElement('div'); tbl.className = 'readouts'; g1.append(tbl);
  let lastTex = '';
  function update() {
    h = H();
    const d = def(), x = S.x, fx = d.f(x), fy = d.f(x + h), q = (fy - fx) / h, m = f1(x);
    ro.el.hidden = !st.vals;
    if (st.vals) { ro.set('x', num(x, 3)); ro.set('h', num(h, Math.abs(h) < 0.01 ? 5 : 4)); ro.set('q', num(q, 5)); ro.set('d', num(m, 5)); }
    tbl.hidden = !st.table;
    if (st.table) {
      tbl.textContent = '';
      for (const hh of [1, 0.1, 0.01, 0.001, 0.0001]) {
        const hv = st.dir * hh, qv = (d.f(x + hv) - fx) / hv;
        const a = document.createElement('span'); a.className = 'k'; a.textContent = 'h = ' + (st.dir < 0 ? MINUS : '') + hh;
        const b = document.createElement('span'); b.className = 'v'; b.textContent = num(qv, 5);
        tbl.append(a, b);
      }
    }
    overlay.hidden = !st.formula;
    if (st.formula) {
      const t = `f'(x)=\\lim_{h\\to0}\\frac{f(x+h)-f(x)}{h}\\qquad \\frac{f(${num(x, 2).replace(MINUS, '-')}${h < 0 ? '-' : '+'}${Math.abs(h).toFixed(Math.abs(h) < 0.01 ? 4 : 3)})-f(${num(x, 2).replace(MINUS, '-')})}{${num(h, 4).replace(MINUS, '-')}}=${ok(q) ? num(q, 4).replace(MINUS, '-') : '\\text{undefined}'}`;
      if (t !== lastTex) { lastTex = t; renderTex(card, t); }
    }
    hs.set(st.t);
    plot.redraw();
  }
  listeners.push(() => { plot.setHome(def().view); update(); });
  ctx.onShow(() => { plot.setHome(def().view); update(); });
}

mountSim({
  title: 'Derivative tracer',
  tabs: [
    { id: 'tracer', label: 'Gradient function', init: tabTracer },
    { id: 'first-principles', label: 'First principles', init: tabFirst },
  ],
});
