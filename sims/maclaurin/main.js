import { mountSim } from '../../assets/js/kit/shell.js';
import { Plot, fmtNum, MINUS } from '../../assets/js/kit/plot.js';
import { group, slider, toggle, dropdown, transport, readouts } from '../../assets/js/kit/ui.js';
import { renderTex } from '../../assets/js/kit/tex.js';
import { loop } from '../../assets/js/kit/anim.js';
import { MACLAURIN, TAYLOR, evalPoly, polyTex } from './series.js';

const MAXN = 40;
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const fracTex = (p, q) => { const g = gcd(p, q) || 1; p /= g; q /= g; return q === 1 ? `${p}` : `${p < 0 ? '-' : ''}\\tfrac{${Math.abs(p)}}{${q}}`; };
const opts = (T) => Object.entries(T).map(([value, d]) => ({ value, label: d.label }));
const mt = (v, d = 3) => fmtNum(v, d);

/** Shared by the Maclaurin tab (centre 0) and the Taylor tab (draggable centre a). */
function seriesTab(ctx, taylor) {
  const { stage, panel } = ctx;
  const T = taylor ? TAYLOR : MACLAURIN;
  const st = {
    key: taylor ? 'sin' : 'exp', n: 1, k: 2, npar: [1, 2], a: taylor ? 1 : 0, x0: 1.2,
    formula: false, terms: false, error: false, valid: false, probe: false,
  };
  const par = () => ({ n: st.npar, a: taylor ? st.a : 0 });
  let coefs = [];
  const def = () => T[st.key];
  let nz = [], K = 30;
  const syncN = () => { st.n = nz.length ? nz[Math.min(st.k, nz.length) - 1] : 0; };
  const recompute = () => {
    coefs = def().coefs(MAXN, par());
    nz = []; coefs.forEach((c, r) => { if (c !== 0) nz.push(r); });
    K = Math.max(1, Math.min(nz.length, 30)); st.k = Math.min(st.k, K); syncN();
    if (typeof deg !== 'undefined') { deg.setRange(1, Math.max(2, K)); deg.set(st.k); }
  };

  const overlay = document.createElement('div'); overlay.className = 'sim-overlay';
  const card = document.createElement('div'); card.className = 'card-f'; overlay.append(card); overlay.hidden = true;
  stage.append(overlay);

  const plot = new Plot(stage, {
    view: def().view, tickPx: 70,
    draw: (p) => {
      const C = p.C, d = def(), P = par(), a = taylor ? st.a : 0;
      const f = (x) => d.f(x, P);
      const poly = (x) => evalPoly(coefs, st.n, x, a);
      // validity band
      const v = typeof d.valid === 'function' ? d.valid(st.a) : d.valid;
      if (st.valid && v) {
        const lo = Math.max(v.lo, p.xmin), hi = Math.min(v.hi, p.xmax);
        p.rect(lo, p.ymin, hi, p.ymax, { fill: C.tangent, fillAlpha: 0.09 });
        for (const [x, closed] of [[v.lo, v.loClosed], [v.hi, v.hiClosed]]) {
          if (x < p.xmin || x > p.xmax) continue;
          p.vline(x, { color: C.tangent, width: 1.4, dash: [6, 5], alpha: 0.9 });
          p.dot(x, 0, { r: 4.5, color: C.tangent, ring: !closed });
        }
        if (v.text) p.text(v.text, p.x(Math.max(v.lo, p.xmin) + 0.04), p.h - 14, { color: C.tangent, size: 13, base: 'bottom' });
      }
      if (st.error) p.fillBetween(f, poly, p.xmin, p.xmax, { color: C.error, alpha: 0.2 });
      if (st.terms) {
        const pal = [C.aux, C.area, C.tangent, C.error, C.fn, C.warn];
        let k = 0;
        for (let r = 0; r <= st.n; r++) {
          if (coefs[r] === 0) continue;
          p.curve((x) => coefs[r] * Math.pow(x - a, r), { color: pal[k++ % pal.length], width: 1.7, alpha: 0.7 });
        }
      }
      p.curve(f, { color: C.muted, width: 5 });
      p.curve(poly, { color: C.approx, width: 2.8 });
      if (taylor) {
        const fa = f(a);
        if (Number.isFinite(fa)) { p.line(a, 0, a, fa, { color: C.ink3, width: 1.2, dash: [4, 4] }); p.dot(a, fa, { r: 4, color: C.ink }); }
      }
      if (st.probe) {
        const fx = f(st.x0), px = poly(st.x0);
        p.line(st.x0, 0, st.x0, Number.isFinite(fx) ? fx : 0, { color: C.ink3, width: 1.2, dash: [4, 4] });
        if (Number.isFinite(fx) && Number.isFinite(px)) {
          p.line(st.x0, fx, st.x0, px, { color: C.error, width: 3.5 });
          p.dot(st.x0, fx, { r: 4.5, color: C.muted, ring: true, width: 2.5 });
          p.dot(st.x0, px, { r: 4.5, color: C.approx, ring: true });
        }
      }
    },
  });
  if (taylor) {
    const lim = () => (def().needsPositive ? [0.15, 6] : [-9, 9]);
    plot.addHandle({
      get: () => [st.a, 0],
      set: (x) => { const [lo, hi] = lim(); st.a = Math.min(hi, Math.max(lo, x)); recompute(); update(); },
      color: (C) => C.ink, r: 7, hit: 18,
    });
  }
  plot.addHandle({
    get: () => [st.x0, 0], visible: () => st.probe,
    set: (x) => { st.x0 = x; update(); }, color: (C) => C.error, r: 6.5, hit: 18,
  });

  // ---- controls ----
  const g0 = group(panel);
  dropdown(g0, {
    label: 'Function', options: opts(T), value: st.key,
    onChange: (v) => {
      st.key = v;
      if (taylor && def().needsPositive && st.a < 0.15) st.a = 1;
      recompute();
      nslider.hide(v !== 'binom');
      validT.hide(!hasValid());
      plot.setHome(def().view);
      update();
    },
  });
  const nslider = slider(g0, {
    label: '$n$', min: -4, max: 5, step: 0.25, value: 0.5, fmt: (v) => fmtNum(v, 2).replace(/\.?0+$/, '') || '0',
    onInput: (v) => { st.npar = [Math.round(v * 4), 4]; recompute(); update(); },
  });
  nslider.hide(true);
  const deg = slider(g0, {
    label: 'Terms', min: 1, max: 30, step: 1, value: st.k, color: 'var(--c-approx)',
    fmt: (v) => String(v), onInput: (v) => { st.k = v; update(); },
  });
  const lp = loop((dt) => {
    acc += dt * tr.speed.get();
    while (acc >= 1) { acc -= 1; if (st.k >= K) { tr.set(false); return; } st.k++; }
    deg.set(st.k); update();
  });
  let acc = 0;
  const stepUp = () => { st.k = Math.min(K, st.k + 1); deg.set(st.k); update(); };
  const tr = transport(g0, {
    onPlay: (p) => { if (p) { if (st.k >= K) { st.k = 1; deg.set(1); } acc = 0; lp.start(); } else lp.stop(); },
    onStep: stepUp,
    onReset: () => { tr.set(false); st.k = 1; deg.set(1); update(); },
    speed: { min: 0.5, max: 10, step: 0.5, value: 2, fmt: (v) => v.toFixed(1) + ' / s' },
  });
  ctx.onHide(() => { tr.set(false); });

  const g1 = group(panel, 'Show');
  toggle(g1, { label: 'Formula', onChange: (v) => { st.formula = v; update(); } });
  toggle(g1, { label: 'Each term', onChange: (v) => { st.terms = v; update(); } });
  toggle(g1, { label: 'Error', color: 'var(--c-error)', onChange: (v) => { st.error = v; update(); } });
  const hasValid = () => !!def().valid;
  const validT = toggle(g1, { label: taylor ? 'Radius of convergence' : 'Valid range', color: 'var(--c-tangent)', onChange: (v) => { st.valid = v; update(); } });
  validT.hide(!hasValid());
  toggle(g1, { label: 'Evaluate at $x$', color: 'var(--c-error)', onChange: (v) => { st.probe = v; ro.hide(!v); update(); } });
  const ro = readouts(g1, [
    { key: 'x', label: '$x$' }, { key: 'f', label: '$f(x)$' }, { key: 'p', label: 'Polynomial' }, { key: 'e', label: 'Error' },
  ]);
  ro.hide(true);
  if (taylor) {
    const g2 = group(panel);
    var aro = readouts(g2, [{ key: 'a', label: '$a$' }]);
  }

  let lastTex = '';
  function update() {
    syncN();
    if (taylor) aro.set('a', mt(st.a, 2));
    if (st.formula) {
      const d = def();
      let head, rhs;
      if (taylor) {
        head = `P_{${st.n}}(x)=\\sum_{r=0}^{${st.n}}\\frac{f^{(r)}(a)}{r!}(x-a)^{r}`;
        rhs = '';
      } else {
        head = `P_{${st.n}}(x)=\\sum_{r=0}^{${st.n}}\\frac{f^{(r)}(0)}{r!}x^{r}`;
        rhs = '= ' + polyTex(d, st.n, par());
      }
      const fn = { exp: 'e^{x}', sin: '\\sin x', cos: '\\cos x', ln: taylor ? '\\ln x' : '\\ln(1+x)', atan: '\\arctan x', recip: '\\frac{1}{x}', sqrt: '\\sqrt{x}',
        binom: `(1+x)^{${fracTex(st.npar[0], st.npar[1])}}` }[st.key];
      const tex = `f(x)=${fn},\\quad ${head}` + (rhs ? `\\\\ \\phantom{f(x)=${'\\ '}} ${rhs}` : '');
      if (tex !== lastTex) { lastTex = tex; renderTex(card, '\\displaystyle ' + (rhs ? `\\begin{aligned}f(x)&=${fn}\\\\ ${head}&\;\; ${rhs}\\end{aligned}`.replace('&\;\; =', '&=') : `f(x)=${fn},\\quad ${head}`), true); }
    }
    overlay.hidden = !st.formula;
    if (st.probe) {
      const d = def(), P = par(), fx = d.f(st.x0, P), px = evalPoly(coefs, st.n, st.x0, taylor ? st.a : 0);
      ro.set('x', mt(st.x0, 2)); ro.set('f', Number.isFinite(fx) ? mt(fx, 4) : 'undefined'); ro.set('p', mt(px, 4));
      ro.set('e', Number.isFinite(fx) ? (Math.abs(fx - px) < 1e-4 && fx !== px ? (fx - px).toExponential(1).replace('-', MINUS) : mt(fx - px, 4)) : '—');
    }
    plot.redraw();
  }
  recompute();
  ctx.onShow(update);
}

// ---------------- convergence comparison ----------------
function convergenceTab(ctx) {
  const { stage, panel } = ctx;
  const FN = [
    ['exp', '$e^x$', MACLAURIN.exp, {}, 'var(--c-fn)', 'fn'],
    ['sin', '$\\sin x$', MACLAURIN.sin, {}, 'var(--c-approx)', 'approx'],
    ['cos', '$\\cos x$', MACLAURIN.cos, {}, 'var(--c-aux)', 'aux'],
    ['ln', '$\\ln(1+x)$', MACLAURIN.ln, {}, 'var(--c-error)', 'error'],
    ['atan', '$\\arctan x$', MACLAURIN.atan, {}, 'var(--c-area)', 'area'],
    ['sqrt', '$\\sqrt{1+x}$', MACLAURIN.binom, { n: [1, 2] }, 'var(--c-tangent)', 'tangent'],
    ['inv', '$\\dfrac{1}{1+x}$', MACLAURIN.binom, { n: [-1, 1] }, 'var(--c-warn)', 'warn'],
  ];
  const on = { exp: true, sin: true, ln: true, sqrt: false, cos: false, atan: false, inv: false };
  const st = { x: 0.8 };
  const cache = FN.map(([, , d, par]) => d.coefs(MAXN, par));
  const plot = new Plot(stage, {
    view: { x: [-1, MAXN + 1], y: [-17.5, 3] }, inset: { l: 54, b: 34, t: 14, r: 16 }, pin: true, xLabel: 'n', yLabel: 'log₁₀ |f(x) − Pₙ(x)|', tickPx: 60, lockX: false,
    draw: (p) => {
      const C = p.C;
      p.hline(-16, { color: C.ink3, width: 1.2, dash: [3, 5] });
      p.label('double precision', 0.5, -16, { dy: -9, color: C.ink3, size: 11.5 });
      FN.forEach(([k, , d, par, , cn], i) => {
        if (!on[k]) return;
        const fx = d.f(st.x, par);
        if (!Number.isFinite(fx)) return;
        const pts = [];
        for (let n = 0; n <= MAXN; n++) {
          const err = Math.abs(fx - evalPoly(cache[i], n, st.x));
          pts.push([n, Math.log10(Math.max(err, 1e-17))]);
        }
        p.poly(pts, { color: C[cn], width: 2.2 });
        for (const [x, y] of pts) p.dot(x, y, { r: 3.2, color: C[cn] });
      });
    },
  });
  const g1 = group(panel);
  slider(g1, { label: '$x$', min: -3, max: 3, step: 0.05, value: st.x, fmt: (v) => fmtNum(v, 2), onInput: (v) => { st.x = v; plot.redraw(); } });
  const g2 = group(panel, 'Functions');
  for (const [k, label, , , col] of FN) toggle(g2, { label, checked: on[k], color: col, onChange: (v) => { on[k] = v; plot.redraw(); } });
}

mountSim({
  title: 'Maclaurin series',
  tabs: [
    { id: 'maclaurin', label: 'Maclaurin', init: (c) => seriesTab(c, false) },
    { id: 'taylor', label: 'About a point', init: (c) => seriesTab(c, true) },
    { id: 'convergence', label: 'Convergence', init: convergenceTab },
  ],
});
