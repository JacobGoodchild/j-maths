import { mountSim } from '../../assets/js/kit/shell.js';
import { Plot, fmtNum, MINUS } from '../../assets/js/kit/plot.js';
import { group, slider, toggle, segmented, dropdown, transport, readouts } from '../../assets/js/kit/ui.js';
import { renderTex } from '../../assets/js/kit/tex.js';
import { loop } from '../../assets/js/kit/anim.js';
import { FUNCS, exactIntegral, integrate } from '../../assets/js/kit/funcs.js';
import { sumRule, lowerUpper, supInf, NS, RULES } from './riemann.js';

const KEYS = ['x2', 'cubic', 'sin', 'cos', 'exp', 'ln', 'sqrt', 'xsin', 'gauss', 'lorentz', 'recip'];
const fnOptions = KEYS.map((k) => ({ value: k, label: FUNCS[k].label }));
const RULE_NAMES = { left: 'Left', right: 'Right', mid: 'Midpoint', trap: 'Trapezium' };
const S = { key: 'x2', a: 0, b: 3, i: 4, rule: 'left' };
const def = () => FUNCS[S.key];
const nOf = () => NS[S.i];
const listeners = [];           // each tab registers a function to re-sync after the shared state changes
const syncAll = () => listeners.forEach((f) => f());
const num = (v, d = 4) => fmtNum(v, d);

function setFunction(key) {
  S.key = key;
  [S.a, S.b] = def().ab;
}
function funcDropdown(parent) {
  const dd = dropdown(parent, { label: 'Function', options: fnOptions, value: S.key, onChange: (v) => { setFunction(v); syncAll(); } });
  listeners.push(() => dd.set(S.key));
  return dd;
}
function limitHandles(plot, onChange) {
  const gap = () => Math.max(0.02, (plot.xmax - plot.xmin) * 0.02);
  const lo = () => (def().domain ? def().domain[0] : -Infinity);
  plot.addHandle({ get: () => [S.a, 0], set: (x) => { S.a = Math.max(lo(), Math.min(x, S.b - gap())); onChange(); }, color: (C) => C.ink, r: 6.5, hit: 18 });
  plot.addHandle({ get: () => [S.b, 0], set: (x) => { S.b = Math.max(x, S.a + gap()); onChange(); }, color: (C) => C.ink, r: 6.5, hit: 18 });
}

// =================== Tab 1 ===================
function tabSums(ctx) {
  const { stage, panel } = ctx;
  const st = { exact: false, ul: false, neg: true, vals: false, formula: false };
  const overlay = document.createElement('div'); overlay.className = 'sim-overlay'; overlay.hidden = true;
  const card = document.createElement('div'); card.className = 'card-f'; overlay.append(card); stage.append(overlay);

  const plot = new Plot(stage, {
    view: def().view, tickPx: 70,
    draw: (p) => {
      const C = p.C, d = def(), f = d.f, a = S.a, b = S.b, n = nOf(), h = (b - a) / n;
      const negC = st.neg ? C.error : C.area;
      if (st.exact) {
        p.fillBetween((x) => Math.max(f(x), 0), 0, a, b, { color: C.area, alpha: 0.12 });
        p.fillBetween((x) => Math.min(f(x), 0), 0, a, b, { color: negC, alpha: 0.12 });
      }
      const wpx = Math.abs(p.x(a + h) - p.x(a));
      const edge = wpx > 4;
      const rect = (x0, x1, y, col, alpha, outline) => {
        const c = y >= 0 ? C.area : negC;
        p.rect(x0, 0, x1, y, { fill: col || c, fillAlpha: alpha, color: edge ? col || c : undefined, width: 1.2 });
      };
      if (st.ul) {
        for (let k = 0; k < n; k++) {
          const x0 = a + k * h, x1 = x0 + h, [lo, hi] = supInf(f, x0, x1, n > 300 ? 6 : 16);
          p.rect(x0, 0, x1, hi, { fill: C.aux, fillAlpha: 0.16, color: edge ? C.aux : undefined, width: 1 });
          rect(x0, x1, lo, null, 0.5);
        }
      } else {
        for (let k = 0; k < n; k++) {
          const x0 = a + k * h, x1 = x0 + h;
          if (S.rule === 'trap') {
            const y0 = f(x0), y1 = f(x1), c = (y0 + y1) / 2 >= 0 ? C.area : negC;
            p.poly([[x0, 0], [x0, y0], [x1, y1], [x1, 0]], { close: true, fill: c, fillAlpha: 0.35, color: edge ? c : undefined, width: 1.2 });
          } else {
            const xs = S.rule === 'left' ? x0 : S.rule === 'right' ? x1 : (x0 + x1) / 2;
            const y = f(xs);
            if (Number.isFinite(y)) rect(x0, x1, y, null, 0.35);
            if (S.rule === 'mid' && edge && Number.isFinite(y)) p.dot(xs, y, { r: 2.8, color: C.ink });
          }
        }
      }
      p.curve(f, { color: C.fn, width: 2.8 });
      for (const x of [a, b]) p.vline(x, { color: C.ink3, width: 1.2, dash: [4, 4], alpha: 0.7 });
    },
  });
  limitHandles(plot, update);

  const g0 = group(panel);
  funcDropdown(g0);
  const nsl = slider(g0, { label: 'Strips $n$', min: 0, max: NS.length - 1, step: 1, value: S.i, color: 'var(--c-area)', fmt: (v) => String(NS[v]), onInput: (v) => { S.i = v; update(); } });
  const rule = segmented(g0, { value: S.rule, full: true, options: RULES.map((r) => ({ value: r, label: RULE_NAMES[r] })), onChange: (v) => { S.rule = v; update(); } });
  const lp = loop((dt) => {
    acc += dt * tr.speed.get();
    while (acc >= 1) { acc -= 1; if (S.i >= NS.length - 1) { tr.set(false); return; } S.i++; }
    update();
  });
  let acc = 0;
  const tr = transport(g0, {
    onPlay: (p) => { if (p) { if (S.i >= NS.length - 1) S.i = 0; acc = 0; lp.start(); } else lp.stop(); },
    onStep: () => { S.i = Math.min(NS.length - 1, S.i + 1); update(); },
    onReset: () => { tr.set(false); S.i = 0; update(); },
    speed: { min: 1, max: 20, step: 0.5, value: 4, fmt: (v) => v.toFixed(1) + ' / s' },
  });
  ctx.onHide(() => tr.set(false));

  const g1 = group(panel, 'Show');
  toggle(g1, { label: 'Exact area', color: 'var(--c-area)', onChange: (v) => { st.exact = v; update(); } });
  toggle(g1, { label: 'Upper and lower sums', color: 'var(--c-aux)', onChange: (v) => { st.ul = v; rule.el.style.opacity = v ? 0.4 : 1; update(); } });
  toggle(g1, { label: 'Negative area in red', checked: true, color: 'var(--c-error)', onChange: (v) => { st.neg = v; update(); } });
  toggle(g1, { label: 'Values', onChange: (v) => { st.vals = v; update(); } });
  toggle(g1, { label: 'Formula', onChange: (v) => { st.formula = v; update(); } });
  const ro = readouts(g1, [
    { key: 'n', label: '$n$' }, { key: 'h', label: '$h$' }, { key: 'est', label: 'Estimate' }, { key: 'lo', label: 'Lower sum' }, { key: 'hi', label: 'Upper sum' },
    { key: 'exact', label: 'Exact' }, { key: 'err', label: 'Error' },
  ]);

  let lastTex = '';
  function update() {
    const d = def(), n = nOf(), h = (S.b - S.a) / n;
    ro.el.hidden = !st.vals;
    if (st.vals) {
      const I = exactIntegral(d, S.a, S.b);
      ro.set('n', String(n)); ro.set('h', num(h, 4));
      ro.set('exact', num(I));
      if (st.ul) {
        const [L, U] = lowerUpper(d.f, S.a, S.b, n);
        ro.set('lo', num(L)); ro.set('hi', num(U)); ro.set('est', '—'); ro.set('err', num(U - L) + ' (gap)');
      } else {
        const s = sumRule(d.f, S.a, S.b, n, S.rule);
        ro.set('est', num(s)); ro.set('err', num(s - I)); ro.set('lo', '—'); ro.set('hi', '—');
      }
      const rows = ro.el.children;
      // hide the rows that do not apply
      for (const [k, show] of [['lo', st.ul], ['hi', st.ul], ['est', !st.ul]]) {
        const idx = ['n', 'h', 'est', 'lo', 'hi', 'exact', 'err'].indexOf(k) * 2;
        rows[idx].hidden = rows[idx + 1].hidden = !show;
      }
    }
    overlay.hidden = !st.formula;
    if (st.formula) {
      const fm = { left: 'h\\sum_{r=0}^{n-1} f(a+rh)', right: 'h\\sum_{r=1}^{n} f(a+rh)', mid: 'h\\sum_{r=0}^{n-1} f\\!\\left(a+\\left(r+\\tfrac{1}{2}\\right)h\\right)', trap: '\\tfrac{1}{2}h\\left\\{f(a)+f(b)+2\\sum_{r=1}^{n-1} f(a+rh)\\right\\}' }[S.rule];
      const t = `\\int_{${num(S.a, 2).replace(MINUS, '-')}}^{${num(S.b, 2).replace(MINUS, '-')}} f(x)\\,dx \\approx ${fm},\\quad h=\\frac{b-a}{n}=${num(h, 4).replace(MINUS, '-')}`;
      if (t !== lastTex) { lastTex = t; renderTex(card, t); }
    }
    nsl.set(S.i); rule.set(S.rule);
    plot.redraw();
  }
  listeners.push(() => { plot.setHome(def().view); update(); });
  ctx.onShow(() => { plot.setHome(def().view); update(); });
}

// =================== Tab 2: convergence ===================
function tabConvergence(ctx) {
  const { stage, panel } = ctx;
  const st = { mode: 'est', on: { left: true, right: true, mid: false, trap: false } };
  let data = {};
  const colorOf = (C) => ({ left: C.fn, right: C.approx, mid: C.tangent, trap: C.area });
  const plot = new Plot(stage, {
    view: { x: [-0.12, 3.12], y: [0, 1] }, inset: { l: 62, b: 34, t: 14, r: 16 }, pin: true, xTicks: 'log', pan: true, zoom: true, tickPx: 64,
    draw: (p) => {
      const C = p.C, col = colorOf(C), I = data.I, cur = Math.log10(nOf());
      if (st.mode === 'est') p.hline(I, { color: C.ink, width: 1.4, dash: [6, 5], alpha: 0.8 });
      else p.hline(-16, { color: C.ink3, width: 1.2, dash: [3, 5] });
      for (const r of RULES) {
        if (!st.on[r]) continue;
        const pts = data[r].map(([x, v, e]) => [x, st.mode === 'est' ? v : e]);
        p.poly(pts, { color: col[r], width: 2.2 });
        for (const [x, y] of pts) p.dot(x, y, { r: 2.6, color: col[r] });
        const n = nOf(), v = sumRule(def().f, S.a, S.b, n, r);
        p.dot(cur, st.mode === 'est' ? v : Math.log10(Math.max(Math.abs(v - I), 1e-17)), { r: 5.5, color: col[r], ring: true });
      }
      p.vline(cur, { color: C.ink3, width: 1.2, dash: [4, 4], alpha: 0.7 });
      p.text('n', p.area.x1 - 6, p.area.y1 - 8, { align: 'right', base: 'bottom', color: C.ink2, italic: true, size: 13 });
    },
  });
  function compute() {
    const d = def(), I = exactIntegral(d, S.a, S.b);
    data = { I };
    let lo = I, hi = I;
    for (const r of RULES) {
      data[r] = NS.map((n) => { const v = sumRule(d.f, S.a, S.b, n, r); lo = Math.min(lo, v); hi = Math.max(hi, v); return [Math.log10(n), v, Math.log10(Math.max(Math.abs(v - I), 1e-17))]; });
    }
    const pad = (hi - lo || 1) * 0.12;
    if (st.mode === 'est') plot.setHome({ x: [-0.12, 3.12], y: [lo - pad, hi + pad] });
    else plot.setHome({ x: [-0.12, 3.12], y: [-17.5, Math.max(...RULES.flatMap((r) => data[r].map((q) => q[2]))) + 1] });
  }
  const g0 = group(panel);
  funcDropdown(g0);
  const nsl = slider(g0, { label: 'Strips $n$', min: 0, max: NS.length - 1, step: 1, value: S.i, color: 'var(--c-area)', fmt: (v) => String(NS[v]), onInput: (v) => { S.i = v; plot.redraw(); } });
  segmented(g0, { full: true, value: 'est', options: [{ value: 'est', label: 'Estimate' }, { value: 'err', label: 'Error (log)' }], onChange: (v) => { st.mode = v; plot.o.yTicks = 'auto'; plot.o.yLabel = v === 'err' ? 'log₁₀ |error|' : ''; compute(); plot.redraw(); } });
  const g1 = group(panel, 'Rules');
  const sw = { left: 'var(--c-fn)', right: 'var(--c-approx)', mid: 'var(--c-tangent)', trap: 'var(--c-area)' };
  for (const r of RULES) toggle(g1, { label: RULE_NAMES[r], checked: st.on[r], color: sw[r], onChange: (v) => { st.on[r] = v; plot.redraw(); } });
  const sync = () => { compute(); nsl.set(S.i); plot.redraw(); };
  listeners.push(sync);
  ctx.onShow(sync);
}

// =================== Tab 3: area function ===================
function tabArea(ctx) {
  const { stage, panel } = ctx;
  stage.classList.add('col');
  const st = { x: 2, whole: false, slope: true, vals: false };
  let G = null, lo0 = 0;
  const buildG = () => {
    const d = def();
    if (d.F) { G = d.F; return; }
    const v = d.view.x, x0 = Math.max(v[0] - 1, d.domain ? d.domain[0] : -Infinity), x1 = v[1] + 1, M = 4000, h = (x1 - x0) / M;
    const tab = new Float64Array(M + 1); tab[0] = 0;
    for (let i = 0; i < M; i++) tab[i + 1] = tab[i] + integrate(d.f, x0 + i * h, x0 + (i + 1) * h, 1);
    G = (t) => { const u = (t - x0) / h; if (u < 0 || u > M) return NaN; const k = Math.min(M - 1, Math.floor(u)); return tab[k] + (tab[k + 1] - tab[k]) * (u - k); };
  };
  const A = (t) => G(t) - G(S.a);

  const top = new Plot(stage, {
    view: def().view, tickPx: 70, onView: (p) => linkX(p, bot),
    draw: (p) => {
      const C = p.C, d = def(), f = d.f, sg = Math.sign(st.x - S.a) || 1;
      const x0 = Math.min(S.a, st.x), x1 = Math.max(S.a, st.x);
      p.fillBetween((x) => (f(x) * sg > 0 ? f(x) : 0), 0, x0, x1, { color: C.area, alpha: 0.28 });
      p.fillBetween((x) => (f(x) * sg < 0 ? f(x) : 0), 0, x0, x1, { color: C.error, alpha: 0.28 });
      p.curve(f, { color: C.fn, width: 2.8 });
      p.vline(S.a, { color: C.ink3, width: 1.2, dash: [4, 4], alpha: 0.7 });
      const fx = f(st.x);
      if (Number.isFinite(fx)) p.line(st.x, 0, st.x, fx, { color: C.tangent, width: st.slope ? 3.5 : 1.4 });
    },
  });
  const bot = new Plot(stage, {
    view: { x: def().view.x, y: [-1, 1] }, tickPx: 70, onView: (p) => linkX(p, top),
    draw: (p) => {
      const C = p.C, d = def();
      if (st.whole) p.curve(A, { color: C.area, width: 2.2, alpha: 0.3 });
      p.curve(A, { color: C.area, width: 3.2, from: Math.min(S.a, st.x), to: Math.max(S.a, st.x) });
      const y = A(st.x);
      if (Number.isFinite(y)) {
        p.line(st.x, 0, st.x, y, { color: C.ink3, width: 1.2, dash: [4, 4], alpha: 0.7 });
        if (st.slope) { const m = d.f(st.x), r = 0.7; if (Number.isFinite(m)) p.line(st.x - r, y - m * r, st.x + r, y + m * r, { color: C.tangent, width: 2.6 }); }
        p.dot(st.x, y, { r: 5.5, color: C.area, ring: true });
      }
      p.dot(S.a, 0, { r: 3.5, color: C.ink3 });
      p.text('A(x)', p.area.x0 + 12, p.area.y0 + 14, { color: C.area, size: 14, italic: true, serif: true });
    },
  });
  top.el.style.flex = '1 1 55%'; bot.el.style.flex = '1 1 45%';
  let busy = false;
  function linkX(from, to) { if (busy) return; busy = true; to.v.cx = from.v.cx; to.v.sx = from.v.sx; to.touched = true; to.redraw(); busy = false; }
  top.addHandle({ get: () => [st.x, def().f(st.x) || 0], set: (x) => { st.x = Math.max(def().domain ? def().domain[0] : -Infinity, x); update(); }, color: (C) => C.tangent, r: 7.5, hit: 18 });
  top.addHandle({ get: () => [S.a, 0], set: (x) => { S.a = Math.max(def().domain ? def().domain[0] : -Infinity, x); update(); }, color: (C) => C.ink, r: 6.5, hit: 18, onEnd: fitA });
  function fitA() {
    const v = def().view.x; let mn = 0, mx = 0;
    for (let i = 0; i <= 200; i++) { const t = v[0] + ((v[1] - v[0]) * i) / 200, y = A(t); if (Number.isFinite(y)) { mn = Math.min(mn, y); mx = Math.max(mx, y); } }
    const pad = (mx - mn || 1) * 0.18;
    bot.setHome({ x: bot.o.view.x, y: [mn - pad, mx + pad] });
  }

  const g0 = group(panel);
  funcDropdown(g0);
  const g1 = group(panel, 'Show');
  toggle(g1, { label: 'Whole $A(x)$', color: 'var(--c-area)', onChange: (v) => { st.whole = v; bot.redraw(); } });
  toggle(g1, { label: 'Slope of $A$', checked: true, color: 'var(--c-tangent)', onChange: (v) => { st.slope = v; update(); } });
  toggle(g1, { label: 'Values', onChange: (v) => { st.vals = v; update(); } });
  const ro = readouts(g1, [{ key: 'x', label: '$x$' }, { key: 'fx', label: '$f(x)$' }, { key: 'A', label: '$A(x)$' }, { key: 'm', label: '$A\'(x)$' }]);
  function update() {
    ro.el.hidden = !st.vals;
    if (st.vals) { const f = def().f(st.x); ro.set('x', num(st.x, 3)); ro.set('fx', num(f, 4)); ro.set('A', num(A(st.x), 4)); ro.set('m', num(f, 4)); }
    top.redraw(); bot.redraw();
  }
  function resync() {
    buildG(); top.setHome(def().view);
    bot.o.view = { x: def().view.x, y: [-1, 1] }; bot.touched = false;
    const d = def(); st.x = Math.max(d.domain ? d.domain[0] : -Infinity, Math.min(st.x, d.view.x[1])); if (!Number.isFinite(st.x)) st.x = S.b;
    st.x = S.b; fitA(); update();
  }
  listeners.push(resync);
  ctx.onShow(resync);
}

mountSim({
  title: 'Riemann sums',
  tabs: [
    { id: 'sums', label: 'Riemann sums', init: tabSums },
    { id: 'convergence', label: 'Convergence', init: tabConvergence },
    { id: 'area', label: 'Area function', init: tabArea },
  ],
});
