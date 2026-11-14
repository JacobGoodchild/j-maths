import { mountSim } from '../../assets/js/kit/shell.js';
import { Plot, fmtNum, MINUS } from '../../assets/js/kit/plot.js';
import { group, slider, toggle, segmented, readouts, button } from '../../assets/js/kit/ui.js';
import { renderTex } from '../../assets/js/kit/tex.js';
import { cadd, csub, cmul, cdiv, conj, mod, arg, polar, roots, expSums } from './cx.js';

const PI = Math.PI, TAU = 2 * PI;
const f2 = (v, d = 2) => fmtNum(v, d);
const tx = (v, d = 2) => f2(v, d).replace(MINUS, '-');
const cstr = (c, d = 2) => `${f2(c[0], d)} ${c[1] < 0 ? MINUS : '+'} ${f2(Math.abs(c[1]), d)}i`;
const ctex = (c, d = 2) => `${tx(c[0], d)}${c[1] < 0 ? '-' : '+'}${tx(Math.abs(c[1]), d)}\\mathrm{i}`;
const snap = (v) => { const r = Math.round(v * 4) / 4; return Math.abs(v - r) < 0.07 ? r : v; };
const argPlot = (host, o) => new Plot(host, { view: { x: [-4.4, 4.4], y: [-3.2, 3.2] }, equal: true, xLabel: 'Re', yLabel: 'Im', tickPx: 70, ...o });

function overlayCard(stage) {
  const overlay = document.createElement('div'); overlay.className = 'sim-overlay'; overlay.hidden = true;
  const card = document.createElement('div'); card.className = 'card-f'; overlay.append(card); stage.append(overlay);
  return { overlay, card, show(on, tex) { overlay.hidden = !on; if (on && tex !== this.last) { this.last = tex; renderTex(card, tex); } } };
}
const point = (plot, get, set, color) => plot.addHandle({ get, set: (x, y) => set([snap(x), snap(y)]), color, r: 8, hit: 20 });

// =================== Tab 1: arithmetic on the Argand diagram ===================
function tabOps(ctx) {
  const { stage, panel } = ctx;
  const st = { z: [2, 1], w: [1, 1.5], op: 'mul', polar: false, conj: false, cons: true, vals: false };
  const card = overlayCard(stage);
  const result = () => (st.op === 'add' ? cadd(st.z, st.w) : st.op === 'mul' ? cmul(st.z, st.w) : cdiv(st.z, st.w));
  const plot = argPlot(stage, {
    draw: (p) => {
      const C = p.C, z = st.z, w = st.w, u = result(), ok = Number.isFinite(u[0]) && Number.isFinite(u[1]);
      const arrow = (c, col, wd = 2.6) => p.arrow(0, 0, c[0], c[1], { color: col, width: wd, head: 11 });
      if (st.cons && ok) {
        if (st.op === 'add') {
          p.poly([[0, 0], z, u, w], { close: true, fill: C.area, fillAlpha: 0.08, color: C.ink3, width: 1.3, dash: [5, 4] });
        } else if (st.op === 'mul') {
          p.poly([[0, 0], [1, 0], w], { close: true, fill: C.approx, fillAlpha: 0.1, color: C.approx, width: 1.2 });
          p.poly([[0, 0], z, u], { close: true, fill: C.area, fillAlpha: 0.1, color: C.area, width: 1.2 });
          p.circle(0, 0, mod(u), { color: C.ink3, width: 1.2, dash: [3, 5] });
        } else {
          p.poly([[0, 0], [1, 0], u], { close: true, fill: C.area, fillAlpha: 0.1, color: C.area, width: 1.2 });
          p.poly([[0, 0], w, z], { close: true, fill: C.fn, fillAlpha: 0.08, color: C.fn, width: 1.2 });
        }
      }
      if (st.polar) {
        for (const [c, col] of [[z, C.fn], [w, C.approx], [u, C.area]]) {
          if (!Number.isFinite(c[0]) || mod(c) < 1e-6) continue;
          const a = arg(c), r = Math.min(0.5, mod(c) * 0.5);
          p.arc(0, 0, r, 0, a, { color: col, width: 2 });
        }
      }
      if (st.conj) { const c = conj(st.z); p.line(st.z[0], st.z[1], c[0], c[1], { color: C.aux, width: 1.2, dash: [4, 4] }); arrow(c, C.aux, 2); p.dot(c[0], c[1], { r: 4.5, color: C.aux, ring: true }); p.label('z̅', c[0], c[1], { dx: 12, dy: 14, color: C.aux, size: 14, italic: true, serif: true }); }
      arrow(z, C.fn); arrow(w, C.approx);
      if (ok) { arrow(u, C.area, 3.2); p.dot(u[0], u[1], { r: 6, color: C.area, ring: true }); }
      p.label('z', z[0], z[1], { dx: 12, dy: -10, color: C.fn, size: 15, italic: true, serif: true });
      p.label('w', w[0], w[1], { dx: 12, dy: -10, color: C.approx, size: 15, italic: true, serif: true });
      if (ok) p.label({ add: 'z + w', mul: 'zw', div: 'z / w' }[st.op], u[0], u[1], { dx: 12, dy: -12, color: C.area, size: 15, italic: true, serif: true });
    },
  });
  point(plot, () => st.z, (c) => { st.z = c; update(); }, (C) => C.fn);
  point(plot, () => st.w, (c) => { st.w = c; update(); }, (C) => C.approx);

  const g0 = group(panel);
  segmented(g0, { full: true, value: 'mul', options: [{ value: 'add', label: '$z+w$' }, { value: 'mul', label: '$zw$' }, { value: 'div', label: '$z/w$' }], onChange: (v) => { st.op = v; update(); } });
  const g1 = group(panel, 'Show');
  toggle(g1, { label: 'Construction', checked: true, onChange: (v) => { st.cons = v; update(); } });
  toggle(g1, { label: 'Modulus and argument', onChange: (v) => { st.polar = v; update(); } });
  toggle(g1, { label: 'Conjugate', color: 'var(--c-aux)', onChange: (v) => { st.conj = v; update(); } });
  toggle(g1, { label: 'Values', onChange: (v) => { st.vals = v; update(); } });
  const ro = readouts(g1, [
    { key: 'z', label: '$z$' }, { key: 'w', label: '$w$' }, { key: 'u', label: 'Result' },
    { key: 'mz', label: '$|z|$' }, { key: 'mw', label: '$|w|$' }, { key: 'mu', label: '$|\\text{result}|$' },
    { key: 'az', label: '$\\arg z$' }, { key: 'aw', label: '$\\arg w$' }, { key: 'au', label: '$\\arg(\\text{result})$' },
  ]);
  function update() {
    const u = result(), ok = Number.isFinite(u[0]) && Number.isFinite(u[1]);
    ro.el.hidden = !st.vals;
    if (st.vals) {
      ro.set('z', cstr(st.z)); ro.set('w', cstr(st.w)); ro.set('u', ok ? cstr(u) : 'undefined');
      ro.set('mz', f2(mod(st.z), 3)); ro.set('mw', f2(mod(st.w), 3)); ro.set('mu', ok ? f2(mod(u), 3) : '—');
      ro.set('az', f2(arg(st.z), 3)); ro.set('aw', f2(arg(st.w), 3)); ro.set('au', ok ? f2(arg(u), 3) : '—');
    }
    const rel = { add: '', mul: `|zw|=|z||w|,\\quad \\arg(zw)=\\arg z+\\arg w`, div: `\\left|\\frac{z}{w}\\right|=\\frac{|z|}{|w|},\\quad \\arg\\frac{z}{w}=\\arg z-\\arg w` }[st.op];
    card.show(st.polar && !!rel, rel);
    plot.redraw();
  }
  ctx.onShow(update);
}

// =================== Tab 2: roots ===================
function tabRoots(ctx) {
  const { stage, panel } = ctx;
  const st = { w: [1, 0], n: 5, poly: true, chain: false, spokes: true, vals: false };
  const card = overlayCard(stage);
  const plot = argPlot(stage, {
    view: { x: [-3.6, 3.6], y: [-2.9, 2.9] },
    draw: (p) => {
      const C = p.C, w = st.w, rs = roots(w, st.n), R = Math.pow(mod(w), 1 / st.n);
      if (mod(w) > 1e-9) p.circle(0, 0, R, { color: C.ink3, width: 1.2, dash: [4, 5] });
      if (st.poly) p.poly(rs, { close: true, fill: C.area, fillAlpha: 0.1, color: C.area, width: 1.6 });
      if (st.chain) { let s = [0, 0]; rs.forEach((r) => { const n2 = cadd(s, r); p.arrow(s[0], s[1], n2[0], n2[1], { color: C.aux, width: 2, head: 9 }); s = n2; }); }
      if (st.spokes) rs.forEach((r, k) => p.line(0, 0, r[0], r[1], { color: k ? C.ink3 : C.approx, width: k ? 1.2 : 2 }));
      rs.forEach((r, k) => p.dot(r[0], r[1], { r: k ? 5 : 6.5, color: k ? C.area : C.approx, ring: true }));
      if (mod(w) > 1e-9) { const a = arg(w) / st.n; p.arc(0, 0, Math.min(0.6, R * 0.35), 0, a, { color: C.approx, width: 2 }); }
      p.arrow(0, 0, w[0], w[1], { color: C.fn, width: 3, head: 12 });
      p.label('w', w[0], w[1], { dx: 12, dy: -10, color: C.fn, size: 15, italic: true, serif: true });
    },
  });
  point(plot, () => st.w, (c) => { st.w = c; update(); }, (C) => C.fn);
  const g0 = group(panel);
  slider(g0, { label: 'Root $n$', min: 2, max: 12, step: 1, value: st.n, fmt: String, color: 'var(--c-area)', onInput: (v) => { st.n = v; update(); } });
  button(g0, { label: 'Roots of unity', onClick: () => { st.w = [1, 0]; update(); } });
  const g1 = group(panel, 'Show');
  toggle(g1, { label: 'Polygon', checked: true, color: 'var(--c-area)', onChange: (v) => { st.poly = v; update(); } });
  toggle(g1, { label: 'Spokes', checked: true, onChange: (v) => { st.spokes = v; update(); } });
  toggle(g1, { label: 'Sum of the roots', color: 'var(--c-aux)', onChange: (v) => { st.chain = v; update(); } });
  toggle(g1, { label: 'Formula', onChange: (v) => { st.vals = v; update(); } });
  function update() {
    const w = st.w, r = mod(w), th = arg(w);
    card.show(st.vals, `z^{${st.n}}=${ctex(w)}=${tx(r, 2)}\\,\\mathrm{e}^{${tx(th, 2)}\\mathrm{i}},\\qquad z_k=${tx(Math.pow(r, 1 / st.n), 3)}\\,\\mathrm{e}^{\\mathrm{i}\\left(${tx(th, 2)}+2\\pi k\\right)/${st.n}},\\ k=0,\\dots,${st.n - 1}`);
    plot.redraw();
  }
  ctx.onShow(update);
}

// =================== Tab 3: loci ===================
function tabLoci(ctx) {
  const { stage, panel } = ctx;
  const st = { kind: 'circle', a: [1, 1], b: [-1, -0.5], r: 1.8, th: PI / 4, z: [1.5, -0.5], region: false, vals: false };
  const card = overlayCard(stage);
  const test = () => {
    const z = st.z, d1 = mod(csub(z, st.a)), d2 = mod(csub(z, st.b));
    if (st.kind === 'circle') return Math.abs(d1 - st.r) < 0.06;
    if (st.kind === 'bisector') return Math.abs(d1 - d2) < 0.06;
    const t = arg(csub(z, st.a)); let dt = t - st.th; dt = Math.atan2(Math.sin(dt), Math.cos(dt)); return Math.abs(dt) < 0.03 && d1 > 1e-6;
  };
  const plot = argPlot(stage, {
    draw: (p) => {
      const C = p.C, a = st.a, b = st.b, ext = 40;
      if (st.kind === 'circle') {
        if (st.region) p.circle(a[0], a[1], st.r, { fill: C.area, fillAlpha: 0.14 });
        p.circle(a[0], a[1], st.r, { color: C.area, width: 2.8 });
        p.line(a[0], a[1], a[0] + st.r * Math.cos(0.6), a[1] + st.r * Math.sin(0.6), { color: C.area, width: 1.5, dash: [4, 4] });
      } else if (st.kind === 'bisector') {
        const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], d = [b[0] - a[0], b[1] - a[1]], L = Math.hypot(d[0], d[1]) || 1, t = [-d[1] / L, d[0] / L];
        if (st.region) { // points closer to a
          const nx = -d[0] / L, ny = -d[1] / L, big = 30;
          p.poly([[m[0] + t[0] * big, m[1] + t[1] * big], [m[0] - t[0] * big, m[1] - t[1] * big], [m[0] - t[0] * big + nx * big, m[1] - t[1] * big + ny * big], [m[0] + t[0] * big + nx * big, m[1] + t[1] * big + ny * big]], { close: true, fill: C.area, fillAlpha: 0.12 });
        }
        p.line(m[0] - t[0] * ext, m[1] - t[1] * ext, m[0] + t[0] * ext, m[1] + t[1] * ext, { color: C.area, width: 2.8 });
        p.line(a[0], a[1], b[0], b[1], { color: C.ink3, width: 1.2, dash: [4, 4] });
        p.dot(m[0], m[1], { r: 3, color: C.ink3 });
      } else {
        const dx = Math.cos(st.th), dy = Math.sin(st.th);
        p.line(a[0], a[1], a[0] + dx * ext, a[1] + dy * ext, { color: C.area, width: 2.8 });
        p.line(a[0], a[1], a[0] + ext, a[1], { color: C.ink3, width: 1.2, dash: [4, 4] });
        p.arc(a[0], a[1], 0.5, 0, st.th, { color: C.approx, width: 2 });
        p.dot(a[0], a[1], { r: 4.5, color: C.bg, ring: true, width: 2 });
      }
      const z = st.z, on = test();
      p.line(a[0], a[1], z[0], z[1], { color: C.fn, width: 1.6, alpha: 0.8 });
      if (st.kind === 'bisector') p.line(b[0], b[1], z[0], z[1], { color: C.approx, width: 1.6, alpha: 0.8 });
      p.dot(z[0], z[1], { r: 6, color: on ? C.tangent : C.ink, ring: true, width: 2.4 });
      p.label('z', z[0], z[1], { dx: 12, dy: -10, color: C.ink, size: 15, italic: true, serif: true });
      p.label('a', a[0], a[1], { dx: 12, dy: -10, color: C.fn, size: 15, italic: true, serif: true });
      if (st.kind === 'bisector') p.label('b', b[0], b[1], { dx: 12, dy: -10, color: C.approx, size: 15, italic: true, serif: true });
    },
  });
  point(plot, () => st.a, (c) => { st.a = c; update(); }, (C) => C.fn);
  point(plot, () => st.b, (c) => { st.b = c; update(); }, (C) => C.approx).visible = () => st.kind === 'bisector';
  plot.addHandle({ get: () => st.z, set: (x, y) => { st.z = [x, y]; update(); }, color: (C) => C.ink, r: 8, hit: 20 });

  const g0 = group(panel);
  segmented(g0, { full: true, value: 'circle', options: [{ value: 'circle', label: 'Circle' }, { value: 'ray', label: 'Half-line' }, { value: 'bisector', label: 'Bisector' }], onChange: (v) => { st.kind = v; rs.hide(v !== 'circle'); ts.hide(v !== 'ray'); update(); } });
  const rs = slider(g0, { label: 'Radius $r$', min: 0.5, max: 4, step: 0.25, value: st.r, color: 'var(--c-area)', fmt: (v) => f2(v), onInput: (v) => { st.r = v; update(); } });
  const ts = slider(g0, { label: '$\\theta$', min: -PI + 0.01, max: PI, step: PI / 24, value: st.th, color: 'var(--c-approx)', fmt: (v) => f2(v, 2), onInput: (v) => { st.th = v; update(); } });
  ts.hide(true);
  const g1 = group(panel, 'Show');
  toggle(g1, { label: 'Region', color: 'var(--c-area)', onChange: (v) => { st.region = v; update(); } });
  toggle(g1, { label: 'Equation', onChange: (v) => { st.vals = v; update(); } });
  const ro = readouts(g1, [{ key: 'd1', label: '$|z-a|$' }, { key: 'd2', label: '$|z-b|$' }, { key: 'ag', label: '$\\arg(z-a)$' }]);
  function update() {
    ro.el.hidden = !st.vals;
    if (st.vals) {
      ro.set('d1', f2(mod(csub(st.z, st.a)), 3)); ro.set('d2', st.kind === 'bisector' ? f2(mod(csub(st.z, st.b)), 3) : '—'); ro.set('ag', f2(arg(csub(st.z, st.a)), 3));
      const rows = ro.el.children; rows[2].hidden = rows[3].hidden = st.kind !== 'bisector'; rows[4].hidden = rows[5].hidden = st.kind !== 'ray';
    }
    const A = ctex(st.a, 2);
    const eq = { circle: `|z-(${A})|${st.region ? '\\le' : '='}${tx(st.r, 2)}`, ray: `\\arg\\left(z-(${A})\\right)=${tx(st.th, 2)}`, bisector: `|z-(${A})|${st.region ? '\\le' : '='}|z-(${ctex(st.b, 2)})|` }[st.kind];
    card.show(st.vals, eq);
    plot.redraw();
  }
  ctx.onShow(update);
}

// =================== Tab 4: e^{i theta} from its series ===================
function tabEuler(ctx) {
  const { stage, panel } = ctx;
  const st = { th: 1.2, k: 4, parts: false, vals: false, circle: true };
  const card = overlayCard(stage);
  const plot = argPlot(stage, {
    view: { x: [-2.6, 2.6], y: [-2.0, 2.0] }, tickPx: 80,
    draw: (p) => {
      const C = p.C, sums = expSums(st.th, st.k), target = [Math.cos(st.th), Math.sin(st.th)];
      if (st.circle) p.circle(0, 0, 1, { color: C.line2, width: 1.6 });
      // each term is a vector added head to tail
      let prev = [0, 0];
      const terms = [];
      let t = [1, 0];
      for (let j = 0; j < st.k; j++) { terms.push(t); t = cmul(t, [0, st.th]); t = [t[0] / (j + 1), t[1] / (j + 1)]; }
      terms.forEach((tm, j) => {
        const nx = sums[j];
        p.arrow(prev[0], prev[1], nx[0], nx[1], { color: j % 2 ? C.approx : C.fn, width: 2.4, head: 9 });
        prev = nx;
      });
      if (st.parts) { const e = sums[sums.length - 1]; p.line(e[0], 0, e[0], e[1], { color: C.ink3, width: 1.2, dash: [4, 4] }); p.line(0, e[1], e[0], e[1], { color: C.ink3, width: 1.2, dash: [4, 4] }); }
      p.arrow(0, 0, target[0], target[1], { color: C.ink, width: 1.6, head: 9, alpha: 0.5 });
      p.dot(target[0], target[1], { r: 5, color: C.tangent, ring: true });
      const e = sums[sums.length - 1];
      p.dot(e[0], e[1], { r: 5.5, color: C.area, ring: true });
    },
  });
  plot.addHandle({ get: () => [Math.cos(st.th), Math.sin(st.th)], set: (x, y) => { let a = Math.atan2(y, x); if (a < -0.3) a += TAU; st.th = Math.max(0, Math.min(TAU, a)); thS.set(st.th); update(); }, color: (C) => C.tangent, r: 8, hit: 20 });
  const g0 = group(panel);
  const thS = slider(g0, { label: '$\\theta$', min: 0, max: TAU, step: 0.01, value: st.th, color: 'var(--c-tangent)', fmt: (v) => f2(v, 2), onInput: (v) => { st.th = v; update(); } });
  slider(g0, { label: 'Terms', min: 1, max: 16, step: 1, value: st.k, fmt: String, color: 'var(--c-approx)', onInput: (v) => { st.k = v; update(); } });
  const g1 = group(panel, 'Show');
  toggle(g1, { label: 'Unit circle', checked: true, onChange: (v) => { st.circle = v; update(); } });
  toggle(g1, { label: 'Real and imaginary parts', onChange: (v) => { st.parts = v; update(); } });
  toggle(g1, { label: 'Series', onChange: (v) => { st.vals = v; update(); } });
  const ro = readouts(g1, [{ key: 's', label: 'Partial sum' }, { key: 'e', label: '$\\mathrm{e}^{\\mathrm{i}\\theta}$' }, { key: 'd', label: 'Distance' }]);
  function update() {
    const sums = expSums(st.th, st.k), e = sums[sums.length - 1], target = [Math.cos(st.th), Math.sin(st.th)];
    ro.el.hidden = !st.vals;
    if (st.vals) { ro.set('s', cstr(e, 4)); ro.set('e', cstr(target, 4)); ro.set('d', mod(csub(e, target)) < 1e-4 ? mod(csub(e, target)).toExponential(1).replace('-', MINUS) : f2(mod(csub(e, target)), 4)); }
    card.show(st.vals, `\\mathrm{e}^{\\mathrm{i}\\theta}=\\sum_{r=0}^{\\infty}\\frac{(\\mathrm{i}\\theta)^{r}}{r!}=1+\\mathrm{i}\\theta-\\frac{\\theta^{2}}{2!}-\\mathrm{i}\\frac{\\theta^{3}}{3!}+\\cdots=\\cos\\theta+\\mathrm{i}\\sin\\theta`);
    fitView(sums);
    plot.redraw();
  }
  // keep the whole path of partial sums in view (the view eases to the new size)
  function fitView(sums) {
    let r = 1.3;
    for (const q of [[0, 0], ...sums]) r = Math.max(r, Math.abs(q[0]) * 0.9, Math.abs(q[1]) * 1.2);
    // include the intermediate corner points of the term arrows (they go through the partial sums only)
    const hx = r * 1.25 * 1.3, hy = r * 1.25;
    plot.o.view = { x: [-hx, hx], y: [-hy, hy] };
    plot.home = plot.fit(); if (!plot.touched) plot.v = { ...plot.home };
  }
  ctx.onShow(update);
}

mountSim({
  title: 'Complex numbers',
  tabs: [
    { id: 'arithmetic', label: 'Arithmetic', init: tabOps },
    { id: 'roots', label: 'Roots', init: tabRoots },
    { id: 'loci', label: 'Loci', init: tabLoci },
    { id: 'euler', label: 'Euler’s formula', init: tabEuler },
  ],
});
