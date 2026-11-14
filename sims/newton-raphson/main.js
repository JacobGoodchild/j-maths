import { mountSim } from '../../assets/js/kit/shell.js';
import { Plot, fmtNum, MINUS } from '../../assets/js/kit/plot.js';
import { group, toggle, dropdown, transport, readouts } from '../../assets/js/kit/ui.js';
import { renderTex } from '../../assets/js/kit/tex.js';
import { loop } from '../../assets/js/kit/anim.js';
import { FUNCS, newtonStep, newtonRun, findRoots, basinIndex } from './nr.js';

const EXAMPLES = [
  ['sq2', 2, 'Converges · $x^2-2$'],
  ['shoot', 0.15, 'Flung away · $x^2-2$'],
  ['cycle', 0, 'Cycle · $x^3-2x+2$'],
  ['atan', 1.6, 'Diverges · $\\arctan x$'],
  ['cbrt', 1, 'Diverges · $\\sqrt[3]{x}$'],
  ['sin', 1.4, 'Unexpected root · $\\sin x$'],
  ['cubic3', 1.7, 'Three roots · cubic'],
  ['double', 3.5, 'Repeated root · $(x-1)^2$'],
  ['cosx', 2.5, '$\\cos x - x$'],
  ['expm', -1, '$e^x-3$'],
];
const exOptions = EXAMPLES.map(([, , label], i) => ({ value: String(i), label }));
const S = { ex: 0, x0: 2 };
const F = () => FUNCS[EXAMPLES[S.ex][0]];
const listeners = [];
const syncAll = () => listeners.forEach((f) => f());
const SUB = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];
const xl = (n) => 'x' + (n < 10 ? SUB[n] : String(n).split('').map((c) => SUB[+c]).join(''));
const ok = Number.isFinite;
const fmt = (v, d = 6) => (ok(v) ? fmtNum(v, d) : 'undefined');
const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
const expStr = (v, d = 2) => { const [m, e] = v.toExponential(d).split('e'); return m.replace('-', MINUS) + '×10' + String(+e).split('').map((c) => SUP[c]).join(''); };
const sci = (v) => (v === 0 ? '0' : Math.abs(v) < 1e-3 || Math.abs(v) >= 1e5 ? expStr(v) : fmtNum(v, 4));

function exampleDropdown(parent) {
  const dd = dropdown(parent, { label: 'Example', options: exOptions, value: String(S.ex), onChange: (v) => { S.ex = +v; S.x0 = EXAMPLES[S.ex][1]; syncAll(); } });
  listeners.push(() => dd.set(String(S.ex)));
}
const COL = (C) => [C.fn, C.approx, C.tangent, C.area, C.aux, C.error, C.warn];

// =================== Tab 1: Newton–Raphson ===================
function tabNewton(ctx) {
  const { stage, panel } = ctx;
  const st = { xs: [S.x0], status: 'running', pend: null, follow: false, table: false, formula: false, vals: false };
  const overlay = document.createElement('div'); overlay.className = 'sim-overlay'; overlay.hidden = true;
  const card = document.createElement('div'); card.className = 'card-f'; overlay.append(card); stage.append(overlay);
  const last = () => st.xs[st.xs.length - 1];

  const plot = new Plot(stage, {
    view: F().view, tickPx: 80,
    draw: (p) => {
      const C = p.C, f = F().f, n = st.xs.length;
      p.curve(f, { color: C.fn, width: 2.8 });
      for (let k = 0; k < n - 1; k++) {
        const a = st.xs[k], b = st.xs[k + 1], fa = f(a), age = Math.max(0.35, 1 - (n - 2 - k) * 0.1);
        p.line(a, 0, a, fa, { color: C.ink3, width: 1.3, dash: [4, 4], alpha: age });
        p.line(a, fa, b, 0, { color: C.tangent, width: 2.2, alpha: age });
        p.dot(a, fa, { r: 3.5, color: C.tangent, alpha: age });
      }
      if (st.pend) {
        const { from, to, p: u } = st.pend, ff = f(from);
        const v = Math.min(1, u / 0.3), t = Math.max(0, Math.min(1, (u - 0.3) / 0.5));
        p.line(from, 0, from, ff * v, { color: C.ink3, width: 1.5, dash: [4, 4] });
        if (u > 0.3) { p.line(from, ff, from + (to - from) * t, ff * (1 - t), { color: C.tangent, width: 2.6 }); p.dot(from, ff, { r: 4, color: C.tangent }); }
      }
      if (st.status === 'flat') p.line(last() - (p.xmax - p.xmin), f(last()), last() + (p.xmax - p.xmin), f(last()), { color: C.error, width: 2.2 });
      // iterates on the axis
      for (let k = 0; k < Math.min(n, 8); k++) {
        const x = st.xs[k]; if (!(x > p.xmin && x < p.xmax)) continue;
        if (k > 0) p.dot(x, 0, { r: 4.5, color: C.approx, ring: true });
        if (n < 9) p.label(xl(k), x, 0, { dy: -16, align: 'center', size: 12.5, color: k === 0 ? C.ink : C.approx });
      }
    },
  });
  plot.addHandle({ get: () => [st.xs[0], 0], set: (x) => { S.x0 = x; restart(); }, color: (C) => C.ink, r: 7.5, hit: 20 });

  const rate = () => tr.speed.get();
  const startStep = () => {
    if (st.pend || st.status !== 'running') { tr.set(false); return; }
    const s = newtonStep(F().f, F().df, last());
    if (s.status !== 'ok') { st.status = s.status === 'flat' ? 'flat' : 'bad'; tr.set(false); update(); return; }
    st.pend = { from: last(), to: s.x, p: 0 };
  };
  const commit = () => {
    const { from, to } = st.pend; st.pend = null;
    st.xs.push(to);
    if (Math.abs(to - from) < 1e-13 * Math.max(1, Math.abs(to)) || F().f(to) === 0) { st.status = 'converged'; tr.set(false); }
    else if (Math.abs(to) > 1e8) { st.status = 'diverged'; tr.set(false); }
    else if (st.xs.length > 60) { st.status = 'unresolved'; tr.set(false); }
    if (st.follow) follow();
    update();
  };
  const lp = loop((dt) => {
    if (!st.pend) startStep();
    if (st.pend) { st.pend.p += dt * rate(); if (st.pend.p >= 1) commit(); else plot.redraw(); }
  });
  function follow() {
    const n = st.xs.length; if (n < 2) return;
    const a = st.xs[n - 2], b = st.xs[n - 1], f = F().f, fa = f(a);
    if (!ok(a) || !ok(b) || !ok(fa)) return;
    const hw = Math.max(Math.abs(b - a) * 1.1, 1e-9), hh = Math.max(Math.abs(fa) * 0.75, 1e-12);
    plot.animateView({ cx: (a + b) / 2, cy: fa / 2, sx: plot.area.w / (2 * hw), sy: plot.area.h / (2 * hh) }, 500);
    plot.touched = true;
  }
  const restart = () => { st.xs = [S.x0]; st.status = 'running'; st.pend = null; update(); };

  const g0 = group(panel);
  exampleDropdown(g0);
  const tr = transport(g0, {
    onPlay: (p) => { if (p) { if (st.status !== 'running') restart(); lp.start(); } else lp.stop(); },
    onStep: () => { if (st.pend) { commit(); } startStep(); if (st.pend) { st.pend.p = 1; commit(); } },
    onReset: () => { tr.set(false); plot.resetView(); restart(); },
    speed: { min: 0.5, max: 4, step: 0.5, value: 1, fmt: (v) => v.toFixed(1) + ' / s' },
  });
  ctx.onHide(() => tr.set(false));
  const g1 = group(panel, 'Show');
  toggle(g1, { label: 'Table of iterates', onChange: (v) => { st.table = v; update(); } });
  toggle(g1, { label: 'Follow the iterates', onChange: (v) => { st.follow = v; if (v) follow(); else plot.resetView(); } });
  toggle(g1, { label: 'Formula', onChange: (v) => { st.formula = v; update(); } });
  toggle(g1, { label: 'Values', onChange: (v) => { st.vals = v; update(); } });
  const ro = readouts(g1, [{ key: 'n', label: 'Steps' }, { key: 'x', label: '$x_n$' }, { key: 'f', label: '$f(x_n)$' }, { key: 's', label: 'Status' }]);
  const tbl = document.createElement('div'); tbl.className = 'readouts'; tbl.style.gridTemplateColumns = 'auto 1fr auto'; tbl.style.fontVariantNumeric = 'tabular-nums'; tbl.style.fontSize = '12.5px'; g1.append(tbl);
  let lastTex = '';
  function update() {
    const n = st.xs.length - 1, f = F().f;
    ro.el.hidden = !st.vals;
    if (st.vals) {
      ro.set('n', String(n)); ro.set('x', Math.abs(last()) > 1e7 ? expStr(last(), 4) : fmt(last(), 10)); ro.set('f', sci(f(last())));
      ro.set('s', { running: '—', converged: 'Converged', diverged: 'Diverging', flat: 'f′(x) = 0', bad: 'Undefined', unresolved: 'No convergence' }[st.status]);
    }
    tbl.hidden = !st.table;
    if (st.table) {
      tbl.textContent = '';
      const from = Math.max(0, st.xs.length - 10);
      for (let k = from; k < st.xs.length; k++) {
        const a = document.createElement('span'); a.className = 'k'; a.textContent = xl(k);
        const b = document.createElement('span'); b.className = 'v'; b.style.textAlign = 'left'; b.textContent = Math.abs(st.xs[k]) > 1e7 ? st.xs[k].toExponential(3) : fmtNum(st.xs[k], 9);
        const c = document.createElement('span'); c.className = 'v'; c.style.color = 'var(--ink-3)'; c.textContent = sci(f(st.xs[k]));
        tbl.append(a, b, c);
      }
    }
    overlay.hidden = !st.formula;
    if (st.formula) { const t = "x_{n+1}=x_n-\\dfrac{f(x_n)}{f'(x_n)}"; if (t !== lastTex) { lastTex = t; renderTex(card, t); } }
    plot.redraw();
  }
  const reload = () => { plot.setHome(F().view); plot.touched = false; restart(); };
  listeners.push(reload);
  ctx.onShow(() => { if (st.xs[0] !== S.x0) restart(); update(); });
}

// =================== Tab 2: basins ===================
function tabBasins(ctx) {
  const { stage, panel } = ctx;
  const st = { roots: [], cols: null, shade: false, path: true, x0: S.x0 };
  const plot = new Plot(stage, {
    view: F().view, tickPx: 80, onView: () => { st.cols = null; },
    draw: (p) => {
      const C = p.C, f = F().f, pal = COL(C);
      p.curve(f, { color: C.fn, width: 2.4, alpha: 0.9 });
      // basin strip
      const A = p.area, y0 = p.y(0), step = 2, nC = Math.ceil(A.w / step);
      if (!st.cols || st.cols.length !== nC || st.colsKey !== p.v.cx + '|' + p.v.sx + '|' + S.ex) {
        st.cols = new Int16Array(nC); st.its = new Uint8Array(nC); st.colsKey = p.v.cx + '|' + p.v.sx + '|' + S.ex;
        for (let i = 0; i < nC; i++) { const x = p.ix(A.x0 + i * step + step / 2); st.cols[i] = basinIndex(f, F().df, st.roots, x, 60); }
      }
      const h = 9;
      for (let i = 0; i < nC; i++) {
        const k = st.cols[i];
        p.ctx.fillStyle = k < 0 ? C.ink3 : pal[k % pal.length]; p.ctx.globalAlpha = k < 0 ? 0.45 : 0.9;
        p.ctx.fillRect(A.x0 + i * step, y0 - 2 * h - 2, step + 0.5, 2 * h);
      }
      p.ctx.globalAlpha = 1;
      for (let k = 0; k < st.roots.length; k++) p.dot(st.roots[k], 0, { r: 5, color: pal[k % pal.length], ring: true });
      // path of the chosen start
      if (st.path) {
        const run = newtonRun(f, F().df, st.x0, 14);
        const k = basinIndex(f, F().df, st.roots, st.x0, 60);
        const col = k < 0 ? C.ink : pal[k % pal.length];
        for (let i = 0; i < run.xs.length - 1; i++) {
          const a = run.xs[i], b = run.xs[i + 1];
          if (!ok(a) || !ok(b)) break;
          const ax = p.x(a), bx = p.x(b), mid = (ax + bx) / 2, lift = Math.min(70, Math.abs(bx - ax) * 0.45 + 6);
          const c = p.ctx; c.beginPath(); c.moveTo(ax, y0 - 24); c.quadraticCurveTo(mid, y0 - 24 - lift * 1.3, bx, y0 - 24);
          c.strokeStyle = col; c.lineWidth = 2; c.globalAlpha = 0.85; c.stroke(); c.globalAlpha = 1;
        }
      }
    },
  });
  plot.addHandle({ get: () => [st.x0, 0], set: (x) => { st.x0 = x; S.x0 = x; plot.redraw(); }, color: (C) => C.ink, r: 7.5, hit: 20 });
  const g0 = group(panel);
  exampleDropdown(g0);
  const g1 = group(panel, 'Show');
  toggle(g1, { label: 'Path of the start point', checked: true, onChange: (v) => { st.path = v; plot.redraw(); } });
  const legend = document.createElement('div'); legend.className = 'readouts'; legend.style.gridTemplateColumns = 'auto 1fr'; g1.append(legend);
  function setup() {
    const d = F(), v = d.view.x, span = v[1] - v[0];
    st.roots = findRoots(d.f, d.df, v[0] - span, v[1] + span, 6000).sort((a, b) => a - b);
    st.cols = null; st.x0 = S.x0;
    plot.setHome(d.view);
    legend.textContent = '';
    const pal = ['var(--c-fn)', 'var(--c-approx)', 'var(--c-tangent)', 'var(--c-area)', 'var(--c-aux)', 'var(--c-error)', 'var(--c-warn)'];
    st.roots.map((r, k) => [r, k]).filter(([r]) => r >= v[0] && r <= v[1]).slice(0, 7).forEach(([r, k]) => {
      const a = document.createElement('span'); a.className = 'k'; a.innerHTML = `<span class="sw-dot" style="background:${pal[k % pal.length]}"></span>`;
      const b = document.createElement('span'); b.className = 'v'; b.style.textAlign = 'left'; b.textContent = 'root ' + fmtNum(r, 4);
      legend.append(a, b);
    });
    const a = document.createElement('span'); a.className = 'k'; a.innerHTML = '<span class="sw-dot" style="background:var(--ink-3)"></span>';
    const b = document.createElement('span'); b.className = 'v'; b.style.textAlign = 'left'; b.textContent = 'no root reached';
    legend.append(a, b);
    plot.redraw();
  }
  listeners.push(() => { if (inited) setup(); });
  let inited = false;
  ctx.onShow(() => { inited = true; setup(); });
}

// =================== Tab 3: fixed-point / cobweb ===================
const GS = [
  { label: '$\\cos x$', g: Math.cos, dg: (x) => -Math.sin(x), view: { x: [-0.1, 1.5], y: [-0.1, 1.5] }, x0: 0.2 },
  { label: '$e^{-x}$', g: (x) => Math.exp(-x), dg: (x) => -Math.exp(-x), view: { x: [0, 1.6], y: [0, 1.6] }, x0: 0.2 },
  { label: '$\\sqrt{2+x}$', g: (x) => Math.sqrt(2 + x), dg: (x) => 0.5 / Math.sqrt(2 + x), view: { x: [-0.2, 4.2], y: [-0.2, 4.2] }, x0: 0.3 },
  { label: '$\\dfrac{x^2+6}{5}$', g: (x) => (x * x + 6) / 5, dg: (x) => (2 * x) / 5, view: { x: [0, 4.5], y: [0, 4.5] }, x0: 1.2 },
  { label: '$\\dfrac{x}{2}+\\dfrac{1}{x}$', g: (x) => x / 2 + 1 / x, dg: (x) => 0.5 - 1 / (x * x), view: { x: [0.3, 2.6], y: [0.3, 2.6] }, x0: 2.2 },
  { label: '$3.2x(1-x)$', g: (x) => 3.2 * x * (1 - x), dg: (x) => 3.2 * (1 - 2 * x), view: { x: [0, 1], y: [0, 1] }, x0: 0.3 },
  { label: '$3.9x(1-x)$', g: (x) => 3.9 * x * (1 - x), dg: (x) => 3.9 * (1 - 2 * x), view: { x: [0, 1], y: [0, 1] }, x0: 0.3 },
];
function tabCobweb(ctx) {
  const { stage, panel } = ctx;
  const st = { gi: 0, xs: [GS[0].x0], pend: null, table: false, vals: false, formula: false };
  const G = () => GS[st.gi];
  const overlay = document.createElement('div'); overlay.className = 'sim-overlay'; overlay.hidden = true;
  const card = document.createElement('div'); card.className = 'card-f'; overlay.append(card); stage.append(overlay);
  const last = () => st.xs[st.xs.length - 1];
  const plot = new Plot(stage, {
    view: G().view, equal: true, tickPx: 70,
    draw: (p) => {
      const C = p.C, g = G().g;
      p.line(p.xmin, p.xmin, p.xmax, p.xmax, { color: C.ink3, width: 1.6, dash: [6, 5] });
      p.curve(g, { color: C.fn, width: 2.8 });
      const n = st.xs.length;
      const seg = (a, b, c, d, al) => p.line(a, b, c, d, { color: C.approx, width: 1.8, alpha: al });
      for (let k = 0; k < n - 1; k++) { const x = st.xs[k], y = st.xs[k + 1], al = Math.max(0.3, 1 - (n - 2 - k) * 0.04); seg(x, x, x, y, al); seg(x, y, y, y, al); }
      if (st.pend) {
        const { from, to, p: u } = st.pend, a = Math.min(1, u / 0.5), b = Math.max(0, (u - 0.5) / 0.5);
        seg(from, from, from, from + (to - from) * a, 1);
        if (u > 0.5) seg(from, to, from + (to - from) * b, to, 1);
      }
      p.dot(st.xs[0], st.xs[0], { r: 4, color: C.ink });
      if (n > 1) p.dot(last(), last(), { r: 5, color: C.approx, ring: true });
    },
  });
  plot.addHandle({ get: () => [st.xs[0], st.xs[0]], set: (x) => { G().x0 = x; restart(); }, color: (C) => C.ink, r: 7.5, hit: 20 });
  const startStep = () => { if (st.pend) return; const x = last(), y = G().g(x); if (!ok(y) || Math.abs(y) > 1e6) { tr.set(false); return; } st.pend = { from: x, to: y, p: 0 }; };
  const commit = () => { st.xs.push(st.pend.to); st.pend = null; if (st.xs.length > 400) tr.set(false); update(); };
  const lp = loop((dt) => { if (!st.pend) startStep(); if (st.pend) { st.pend.p += dt * tr.speed.get(); if (st.pend.p >= 1) commit(); else plot.redraw(); } });
  const restart = () => { st.xs = [G().x0]; st.pend = null; update(); };
  const g0 = group(panel);
  dropdown(g0, { label: 'Iteration $x_{n+1}=g(x_n)$', options: GS.map((g, i) => ({ value: String(i), label: g.label })), value: '0', onChange: (v) => { st.gi = +v; plot.setHome(G().view); restart(); } });
  const tr = transport(g0, {
    onPlay: (p) => (p ? lp.start() : lp.stop()),
    onStep: () => { if (st.pend) commit(); startStep(); if (st.pend) { st.pend.p = 1; commit(); } },
    onReset: () => { tr.set(false); restart(); },
    speed: { min: 0.5, max: 8, step: 0.5, value: 2, fmt: (v) => v.toFixed(1) + ' / s' },
  });
  ctx.onHide(() => tr.set(false));
  const g1 = group(panel, 'Show');
  toggle(g1, { label: 'Table of iterates', onChange: (v) => { st.table = v; update(); } });
  toggle(g1, { label: 'Values', onChange: (v) => { st.vals = v; update(); } });
  const ro = readouts(g1, [{ key: 'n', label: '$n$' }, { key: 'x', label: '$x_n$' }, { key: 'd', label: "$g'(x_n)$" }]);
  const tbl = document.createElement('div'); tbl.className = 'readouts'; tbl.style.gridTemplateColumns = 'auto 1fr'; g1.append(tbl);
  function update() {
    ro.el.hidden = !st.vals;
    if (st.vals) { ro.set('n', String(st.xs.length - 1)); ro.set('x', fmt(last(), 8)); ro.set('d', fmt(G().dg(last()), 4)); }
    tbl.hidden = !st.table;
    if (st.table) {
      tbl.textContent = '';
      for (let k = Math.max(0, st.xs.length - 10); k < st.xs.length; k++) {
        const a = document.createElement('span'); a.className = 'k'; a.textContent = xl(k);
        const b = document.createElement('span'); b.className = 'v'; b.style.textAlign = 'left'; b.textContent = Math.abs(st.xs[k]) > 1e7 ? st.xs[k].toExponential(3) : fmtNum(st.xs[k], 9);
        tbl.append(a, b);
      }
    }
    plot.redraw();
  }
  ctx.onShow(() => { plot.setHome(G().view); update(); });
}

// =================== Tab 4: bisection ===================
function tabBisection(ctx) {
  const { stage, panel } = ctx;
  const st = { a: 0, b: 0, rows: [], n: 0, table: false, vals: false };
  const plot = new Plot(stage, {
    view: F().view, tickPx: 80,
    draw: (p) => {
      const C = p.C, f = F().f, cur = st.rows[st.rows.length - 1] || [st.a, st.b];
      p.curve(f, { color: C.fn, width: 2.8 });
      const fa = f(cur[0]), fb = f(cur[1]), good = fa * fb <= 0;
      // bracket and sign marks
      p.rect(cur[0], p.ymin, cur[1], p.ymax, { fill: good ? C.aux : C.error, fillAlpha: 0.08 });
      for (const x of cur) p.vline(x, { color: good ? C.aux : C.error, width: 1.4, dash: [5, 4] });
      if (good && st.rows.length) { const c = (cur[0] + cur[1]) / 2; p.dot(c, f(c), { r: 4.5, color: C.approx, ring: true }); p.dot(c, 0, { r: 4, color: C.approx }); }
      // interval history, stacked at the bottom
      const A = p.area, rowH = Math.min(10, (A.h * 0.35) / Math.max(1, st.rows.length));
      st.rows.forEach(([a, b], k) => {
        const y = A.y1 - 10 - k * rowH, c = p.ctx;
        c.fillStyle = C.aux; c.globalAlpha = Math.max(0.25, 1 - (st.rows.length - 1 - k) * 0.03);
        c.fillRect(p.x(a), y, Math.max(2, p.x(b) - p.x(a)), Math.max(2, rowH - 3)); c.globalAlpha = 1;
      });
    },
  });
  const ends = () => st.rows[st.rows.length - 1] || [st.a, st.b];
  plot.addHandle({ get: () => [st.a, 0], set: (x) => { st.a = Math.min(x, st.b - 0.01); reset(); }, color: (C) => C.aux, r: 7.5, hit: 20, visible: () => st.rows.length < 2 });
  plot.addHandle({ get: () => [st.b, 0], set: (x) => { st.b = Math.max(x, st.a + 0.01); reset(); }, color: (C) => C.aux, r: 7.5, hit: 20, visible: () => st.rows.length < 2 });
  const step = () => {
    const [a, b] = ends(), f = F().f;
    if (f(a) * f(b) > 0 || b - a < 1e-13) return;
    const c = (a + b) / 2;
    st.rows = st.rows.length ? st.rows : [[st.a, st.b]];
    st.rows.push(f(a) * f(c) <= 0 ? [a, c] : [c, b]);
    update();
  };
  const lp = loop((dt) => { acc += dt * tr.speed.get(); while (acc >= 1) { acc -= 1; step(); if (ends()[1] - ends()[0] < 1e-12) { tr.set(false); break; } } });
  let acc = 0;
  const reset = () => { st.rows = []; update(); };
  const g0 = group(panel);
  exampleDropdown(g0);
  const tr = transport(g0, {
    onPlay: (p) => { if (p) { acc = 0; lp.start(); } else lp.stop(); },
    onStep: () => step(),
    onReset: () => { tr.set(false); init(); },
    speed: { min: 0.5, max: 8, step: 0.5, value: 2, fmt: (v) => v.toFixed(1) + ' / s' },
  });
  ctx.onHide(() => tr.set(false));
  const g1 = group(panel, 'Show');
  toggle(g1, { label: 'Table', onChange: (v) => { st.table = v; update(); } });
  toggle(g1, { label: 'Values', onChange: (v) => { st.vals = v; update(); } });
  const ro = readouts(g1, [{ key: 'n', label: 'Steps' }, { key: 'w', label: 'Interval width' }, { key: 'c', label: 'Midpoint' }, { key: 'f', label: '$f(c)$' }]);
  const tbl = document.createElement('div'); tbl.className = 'readouts'; tbl.style.gridTemplateColumns = 'auto 1fr 1fr'; tbl.style.fontSize = '12.5px'; g1.append(tbl);
  function update() {
    const [a, b] = ends(), f = F().f, c = (a + b) / 2;
    ro.el.hidden = !st.vals;
    if (st.vals) { ro.set('n', String(Math.max(0, st.rows.length - 1))); ro.set('w', b - a >= 0.01 ? fmtNum(b - a, 4) : expStr(b - a)); ro.set('c', fmt(c, 9)); ro.set('f', sci(f(c))); }
    tbl.hidden = !st.table;
    if (st.table) {
      tbl.textContent = '';
      const rows = st.rows.length ? st.rows : [[st.a, st.b]];
      for (let k = Math.max(0, rows.length - 10); k < rows.length; k++) {
        const a1 = document.createElement('span'); a1.className = 'k'; a1.textContent = k;
        const b1 = document.createElement('span'); b1.className = 'v'; b1.style.textAlign = 'left'; b1.textContent = fmtNum(rows[k][0], 6);
        const c1 = document.createElement('span'); c1.className = 'v'; c1.style.textAlign = 'left'; c1.textContent = fmtNum(rows[k][1], 6);
        tbl.append(a1, b1, c1);
      }
    }
    plot.redraw();
  }
  function init() {
    const d = F(), roots = findRoots(d.f, d.df, d.view.x[0], d.view.x[1]);
    const span = d.view.x[1] - d.view.x[0], r = roots.length ? roots[0] : (d.view.x[0] + d.view.x[1]) / 2;
    let gap = span * 0.3;
    for (const q of roots) if (q !== r) gap = Math.min(gap, Math.abs(q - r) * 0.8);
    let a = r - gap * 0.6, b = r + gap * 0.8;
    if (roots.length && d.f(a) * d.f(b) > 0) { a = r - gap * 0.4; b = r + gap * 0.4; }
    st.a = a; st.b = b; st.rows = [];
    plot.setHome(d.view); update();
  }
  listeners.push(() => { if (shown) init(); });
  let shown = false;
  ctx.onShow(() => { shown = true; init(); });
}

mountSim({
  title: 'Newton–Raphson',
  tabs: [
    { id: 'newton', label: 'Newton–Raphson', init: tabNewton },
    { id: 'basins', label: 'Basins', init: tabBasins },
    { id: 'fixed-point', label: 'Fixed point', init: tabCobweb },
    { id: 'bisection', label: 'Bisection', init: tabBisection },
  ],
});
