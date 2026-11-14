import { mountSim } from '../../assets/js/kit/shell.js';
import { fmtNum, MINUS } from '../../assets/js/kit/plot.js';
import { group, slider, toggle, segmented, dropdown, transport, readouts } from '../../assets/js/kit/ui.js';
import { renderTex } from '../../assets/js/kit/tex.js';
import { loop } from '../../assets/js/kit/anim.js';
import { colors, onThemeChange } from '../../assets/js/kit/theme.js';
import { FUNCS, integrate } from '../../assets/js/kit/funcs.js';
import { Scene3D, THREE, TAU, mapFor, GridSet, surfaceGrids, sliceGrids, makeLabel } from './solid.js';

const KEYS = ['x2', 'sqrt', 'sin', 'cos', 'exp', 'recip', 'lorentz', 'gauss'];
const fnOptions = KEYS.map((k) => ({ value: k, label: 'y = ' + FUNCS[k].label }));
const texOf = (k) => FUNCS[k].label.replace(/\$/g, '');
const num = (v, d = 3) => fmtNum(v, d);
const tn = (v, d = 2) => fmtNum(v, d).replace(MINUS, '-');
const PI = Math.PI;
const hex = (s) => new THREE.Color(s);

/** Everything needed to draw one solid, rebuilt whenever a control moves. */
class SolidView {
  constructor(host) { this.s = new Scene3D(host); this.cfg = null; this.s.applyTheme = () => { this.buildStatic(); this.rebuild(); }; this.lastKey = ''; }
  start() { this.s.start(); }
  stop() { this.s.stop(); }
  set(cfg) { this.cfg = cfg; this.rebuild(); }

  buildStatic() {
    const c = this.cfg; if (!c) return;
    const C = colors(), g = this.s.static; this.s.clear(g);
    const b = c.bounds, L = Math.max(Math.abs(b.x0), Math.abs(b.x1), Math.abs(b.y0), Math.abs(b.y1), Math.abs(b.z)) * 1.25 + 0.5;
    const ext = this.s.extent;
    const line = (a, z, col, op = 1) => { const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...z)]); return new THREE.Line(geo, new THREE.LineBasicMaterial({ color: hex(col), transparent: op < 1, opacity: op })); };
    const gx = Math.ceil(L), grid = new THREE.GridHelper(gx * 2, gx * 2, hex(C.grid2), hex(C.grid));
    grid.rotation.x = Math.PI / 2; grid.material.transparent = true; grid.material.opacity = 0.9; g.add(grid);
    g.add(line([-L, 0, 0], [L, 0, 0], C.axis)); g.add(line([0, -L, 0], [0, L, 0], C.axis)); g.add(line([0, 0, -L], [0, 0, L], C.axis, 0.5));
    const ls = ext * 0.09;
    for (const [t, p] of [['x', [L + ls * 0.6, 0, 0]], ['y', [0, L + ls * 0.6, 0]]]) { const sp = makeLabel(t, C.ink2, ls); sp.position.set(...p); g.add(sp); }
    this.s.dirty = true;
  }

  rebuild() {
    const c = this.cfg; if (!c) return;
    const C = colors(), s = this.s;
    const bkey = JSON.stringify([c.bounds, c.axis]);
    if (bkey !== this.lastKey) { this.lastKey = bkey; const b = c.bounds; s.extent = Math.max(Math.hypot((b.x1 - b.x0) / 2, (b.y1 - b.y0) / 2, b.z), 1); s.target.set((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, 0); s.resetCamera(); this.buildStatic(); }
    const skey = c.key + '|' + document.documentElement.dataset.theme;
    if (skey !== this.structKey) { this.structKey = skey; this.buildStructure(C); }
    this.updatePhi();
  }
  buildStructure(C) {
    const c = this.cfg, s = this.s, g = s.dyn; s.clear(g);
    const P = c.P, map = mapFor(P.axis), rad = s.extent * 0.012;
    const std = (col, extra = {}) => new THREE.MeshStandardMaterial({ color: hex(col), side: THREE.DoubleSide, roughness: 0.5, metalness: 0.05, vertexColors: true, ...extra });
    this.sets = [];
    if (c.wire) this.sets.push(new GridSet(surfaceGrids(P, map, 36, 40)));
    else this.sets.push(new GridSet(surfaceGrids(P, map, 90, 72)));
    const ghost = c.see || c.discs > 0;
    const m1 = c.wire ? new THREE.MeshBasicMaterial({ color: hex(C.area), wireframe: true, transparent: true, opacity: 0.75 })
      : std(C.area, { transparent: ghost, opacity: c.discs > 0 ? 0.28 : c.see ? 0.35 : 1, depthWrite: !ghost });
    this.surface = new THREE.Mesh(this.sets[0].geometry, m1); g.add(this.surface);
    if (c.discs > 0) { const gs = new GridSet(sliceGrids(P, map, c.discs, 36)); this.sets.push(gs); g.add(new THREE.Mesh(gs.geometry, std(C.approx))); }
    this.plates = new THREE.Group(); g.add(this.plates);
    for (const cv of c.curves) {
      const pts = cv.pts.map((p) => new THREE.Vector3(...p));
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 220, rad * (cv.w || 1), 8), new THREE.MeshBasicMaterial({ color: hex(C[cv.color]) })));
    }
    const L = s.extent * 2.4, ax = P.axis === 'y' ? [[0, -L, 0], [0, L, 0]] : [[-L, 0, 0], [L, 0, 0]];
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ax.map((p) => new THREE.Vector3(...p))), new THREE.LineBasicMaterial({ color: hex(C.ink) })));
  }
  updatePhi() {
    const c = this.cfg, s = this.s, C = colors(), phi = Math.max(c.phi, 1e-4);
    for (const gs of this.sets) gs.update(phi);
    this.surface.visible = c.phi > 1e-3;
    this.s.clear(this.plates);
    if (c.region) {
      const map = mapFor(c.P.axis);
      for (const a of c.phi > 0.01 ? [0, c.phi] : [0]) this.plates.add(new THREE.Mesh(gridPlate(c.P, map, a, 80), new THREE.MeshStandardMaterial({ color: hex(C.area), side: THREE.DoubleSide, transparent: true, opacity: 0.4, depthWrite: false })));
    }
    s.dirty = true;
  }
}
function gridPlate(P, map, ang, nS) {
  const { s0, s1, r, ri } = P, S = (i) => s0 + ((s1 - s0) * i) / nS;
  const verts = [], idx = [];
  for (let i = 0; i <= nS; i++) for (let j = 0; j < 2; j++) verts.push(...map(S(i), j ? Math.max(0, r(S(i)) || 0) : Math.max(0, ri ? ri(S(i)) || 0 : 0), ang));
  for (let i = 0; i < nS; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

const sample = (fn, a, b, n = 160) => Array.from({ length: n + 1 }, (_, i) => { const x = a + ((b - a) * i) / n; return fn(x); });

// ---------------- Tab 1: solid from one curve ----------------
function tabSolid(ctx) {
  const { stage, panel } = ctx;
  const st = { key: 'sqrt', a: 0, b: 4, axis: 'x', phi: TAU, N: 0, see: false, wire: false, region: false, formula: false };
  const view = new SolidView(stage);
  const def = () => FUNCS[st.key];
  const f = (x) => def().f(x);
  const monotone = () => {
    if (st.a < 0) return false;
    const ys = sample(f, st.a, st.b, 200); if (ys.some((y) => !Number.isFinite(y))) return false;
    let up = true, dn = true; for (let i = 1; i < ys.length; i++) { if (ys[i] < ys[i - 1] - 1e-12) up = false; if (ys[i] > ys[i - 1] + 1e-12) dn = false; }
    return up || dn;
  };
  let inv = null;
  const buildInv = () => {
    const n = 600, xs = sample((x) => x, st.a, st.b, n), ys = sample(f, st.a, st.b, n), asc = ys[n] >= ys[0];
    const Y = asc ? ys : [...ys].reverse(), X = asc ? xs : [...xs].reverse();
    inv = (y) => { if (y <= Y[0]) return X[0]; if (y >= Y[n]) return X[n]; let lo = 0, hi = n; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (Y[m] <= y) lo = m; else hi = m; } const t = (y - Y[lo]) / (Y[hi] - Y[lo] || 1); return X[lo] + (X[hi] - X[lo]) * t; };
    return [Math.min(ys[0], ys[n]), Math.max(ys[0], ys[n])];
  };
  function config() {
    const a = st.a, b = st.b;
    if (st.axis === 'y' && !monotone()) st.axis = 'x';
    let P, V, curve, bounds;
    const xs = sample((x) => x, a, b), ys = sample(f, a, b);
    const rmax = Math.max(...ys.map((y) => Math.abs(y || 0)));
    if (st.axis === 'x') {
      P = { s0: a, s1: b, r: (x) => Math.abs(f(x)), axis: 'x' };
      V = PI * integrate((x) => f(x) ** 2, a, b, 200);
      curve = xs.map((x, i) => [x, ys[i], 0]);
      bounds = { x0: Math.min(0, a), x1: b, y0: -rmax, y1: rmax, z: rmax };
    } else {
      const [y0, y1] = buildInv();
      P = { s0: y0, s1: y1, r: (y) => Math.abs(inv(y)), axis: 'y' };
      V = PI * integrate((x) => x * x * Math.abs(def().df(x)), a, b, 200);
      curve = xs.map((x, i) => [x, ys[i], 0]);
      bounds = { x0: -Math.max(a, b), x1: Math.max(a, b), y0: Math.min(0, y0), y1: y1, z: Math.max(a, b) };
    }
    const curves = [{ pts: curve, color: 'fn', w: 1.2 }];
    // sum of discs
    let sum = 0;
    if (st.N > 0) { const h = (P.s1 - P.s0) / st.N; for (let k = 0; k < st.N; k++) { const m = P.s0 + (k + 0.5) * h; sum += PI * P.r(m) ** 2 * h; } }
    return { P, curves, bounds, V, sum, phi: st.phi, discs: st.N, see: st.see, wire: st.wire, region: st.region, axis: st.axis, key: [st.key, st.a, st.b, st.axis, st.N, st.see, st.wire].join('|') };
  }
  function update() {
    const cfg = config();
    view.set(cfg);
    seg.el.children[1].disabled = !(st.a >= 0 && monotone());
    // readouts and formula
    ro.el.hidden = !st.formula;
    if (st.formula) {
      const t = st.axis === 'x'
        ? `V=\\pi\\int_{${tn(st.a)}}^{${tn(st.b)}} y^{2}\\,dx=\\pi\\int_{${tn(st.a)}}^{${tn(st.b)}}\\left(${texOf(st.key)}\\right)^{2}dx`
        : `V=\\pi\\int_{${tn(Math.min(f(st.a), f(st.b)))}}^{${tn(Math.max(f(st.a), f(st.b)))}} x^{2}\\,dy`;
      if (t !== lastTex) { lastTex = t; renderTex(card, t); }
      ro.set('V', num(cfg.V, 4)); ro.set('Vp', num(cfg.V / PI, 4) + 'π');
      const showSum = st.N > 0; ro.el.children[4].hidden = ro.el.children[5].hidden = ro.el.children[6].hidden = ro.el.children[7].hidden = !showSum;
      if (showSum) { ro.set('S', num(cfg.sum, 4)); ro.set('E', num(cfg.sum - cfg.V, 4)); }
    }
    overlay.hidden = !st.formula;
  }
  const overlay = document.createElement('div'); overlay.className = 'sim-overlay'; overlay.hidden = true;
  const card = document.createElement('div'); card.className = 'card-f'; overlay.append(card); stage.append(overlay);
  let lastTex = '';

  const g0 = group(panel);
  dropdown(g0, { label: 'Curve', options: fnOptions, value: st.key, onChange: (v) => { st.key = v; [st.a, st.b] = FUNCS[v].ab; sa.set(st.a); sb.set(st.b); rangeLimits(); update(); } });
  const sa = slider(g0, { label: '$a$', min: 0, max: 5, step: 0.05, value: st.a, fmt: (v) => num(v, 2), onInput: (v) => { st.a = Math.min(v, st.b - 0.05); if (v > st.a) sa.set(st.a); update(); } });
  const sb = slider(g0, { label: '$b$', min: 0, max: 5, step: 0.05, value: st.b, fmt: (v) => num(v, 2), onInput: (v) => { st.b = Math.max(v, st.a + 0.05); if (v < st.b) sb.set(st.b); update(); } });
  function rangeLimits() { const d = FUNCS[st.key]; const lo = d.domain ? (st.key === 'sqrt' ? 0 : 0.2) : (st.key === 'gauss' || st.key === 'lorentz') ? -4 : 0; const hi = d.view.x[1]; sa.setRange(lo, hi); sb.setRange(lo, hi); sa.set(st.a); sb.set(st.b); }
  const seg = segmented(g0, { label: 'Rotate about', full: true, value: 'x', options: [{ value: 'x', label: '$x$-axis' }, { value: 'y', label: '$y$-axis' }], onChange: (v) => { st.axis = v; update(); } });
  const sweep = slider(g0, { label: 'Sweep', min: 0, max: TAU, step: 0.01, value: st.phi, color: 'var(--c-area)', fmt: (v) => (v / PI).toFixed(2) + 'π', onInput: (v) => { st.phi = v; update(); } });
  const lp = loop((dt) => { st.phi = Math.min(TAU, st.phi + dt * 1.4 * tr.speed.get()); sweep.set(st.phi); if (st.phi >= TAU) tr.set(false); update(); });
  const tr = transport(g0, {
    onPlay: (p) => { if (p) { st.phi = 0; lp.start(); } else lp.stop(); },
    onReset: () => { tr.set(false); st.phi = TAU; sweep.set(TAU); update(); },
    speed: { min: 0.25, max: 3, step: 0.25, value: 1, fmt: (v) => '×' + v.toFixed(2) },
  });
  ctx.onHide(() => { tr.set(false); view.stop(); });
  const g1 = group(panel, 'Show');
  slider(g1, { label: 'Discs', min: 0, max: 60, step: 1, value: 0, color: 'var(--c-approx)', fmt: (v) => (v ? String(v) : 'off'), onInput: (v) => { st.N = v; update(); } });
  toggle(g1, { label: 'Formula and value', onChange: (v) => { st.formula = v; update(); } });
  toggle(g1, { label: 'See-through', onChange: (v) => { st.see = v; update(); } });
  toggle(g1, { label: 'Wireframe', onChange: (v) => { st.wire = v; update(); } });
  toggle(g1, { label: 'Flat region', color: 'var(--c-area)', onChange: (v) => { st.region = v; update(); } });
  const ro = readouts(g1, [{ key: 'V', label: '$V$' }, { key: 'Vp', label: '$V/\\pi$' }, { key: 'S', label: 'Sum of discs' }, { key: 'E', label: 'Difference' }]);
  // rows: V, Vp, S, E => children 0..7
  ro.el.hidden = true;
  [st.a, st.b] = FUNCS[st.key].ab; rangeLimits();
  onThemeChange(() => {});
  ctx.onShow(() => { view.start(); update(); });
}

// ---------------- Tab 2: region between two curves ----------------
const PAIRS = [
  { label: '$y=\\sqrt{x}$ and $y=x^2$', f: Math.sqrt, g: (x) => x * x, a: 0, b: 1, ft: '\\sqrt{x}', gt: 'x^{2}' },
  { label: '$y=x$ and $y=x^2$', f: (x) => x, g: (x) => x * x, a: 0, b: 1, ft: 'x', gt: 'x^{2}' },
  { label: '$y=3$ and $y=x^2$', f: () => 3, g: (x) => x * x, a: 0, b: Math.sqrt(3), ft: '3', gt: 'x^{2}' },
  { label: '$y=2+\\sin x$ and $y=1$', f: (x) => 2 + Math.sin(x), g: () => 1, a: 0, b: PI, ft: '2+\\sin x', gt: '1' },
  { label: '$y=e^x$ and $y=1$', f: Math.exp, g: () => 1, a: 0, b: 1.2, ft: 'e^{x}', gt: '1' },
];
function tabWasher(ctx) {
  const { stage, panel } = ctx;
  const st = { i: 0, phi: TAU, N: 0, see: true, wire: false, region: false, formula: false };
  const view = new SolidView(stage);
  const overlay = document.createElement('div'); overlay.className = 'sim-overlay'; overlay.hidden = true;
  const card = document.createElement('div'); card.className = 'card-f'; overlay.append(card); stage.append(overlay);
  let lastTex = '';
  function update() {
    const p = PAIRS[st.i], { f, g, a, b } = p;
    const xs = sample((x) => x, a, b), top = sample(f, a, b), bot = sample(g, a, b);
    const P = { s0: a, s1: b, r: f, ri: g, axis: 'x' }, rmax = Math.max(...top);
    const V = PI * integrate((x) => f(x) ** 2 - g(x) ** 2, a, b, 200);
    let sum = 0; if (st.N > 0) { const h = (b - a) / st.N; for (let k = 0; k < st.N; k++) { const m = a + (k + 0.5) * h; sum += PI * (f(m) ** 2 - g(m) ** 2) * h; } }
    view.set({ key: ['w', st.i, st.N, st.see, st.wire].join('|'), P, curves: [{ pts: xs.map((x, i) => [x, top[i], 0]), color: 'fn', w: 1.2 }, { pts: xs.map((x, i) => [x, bot[i], 0]), color: 'tangent', w: 1.2 }], bounds: { x0: Math.min(0, a), x1: b, y0: -rmax, y1: rmax, z: rmax }, phi: st.phi, discs: st.N, see: st.see, wire: st.wire, region: st.region, axis: 'x' });
    ro.el.hidden = !st.formula; overlay.hidden = !st.formula;
    if (st.formula) {
      const t = `V=\\pi\\int_{${tn(a)}}^{${tn(b)}}\\left[\\left(${p.ft}\\right)^{2}-\\left(${p.gt}\\right)^{2}\\right]dx`;
      if (t !== lastTex) { lastTex = t; renderTex(card, t); }
      ro.set('V', num(V, 4)); ro.set('Vp', num(V / PI, 4) + 'π');
      const ss = st.N > 0; for (let k = 4; k < 8; k++) ro.el.children[k].hidden = !ss;
      if (ss) { ro.set('S', num(sum, 4)); ro.set('E', num(sum - V, 4)); }
    }
  }
  const g0 = group(panel);
  dropdown(g0, { label: 'Region', options: PAIRS.map((p, i) => ({ value: String(i), label: p.label })), value: '0', onChange: (v) => { st.i = +v; update(); } });
  const sweep = slider(g0, { label: 'Sweep', min: 0, max: TAU, step: 0.01, value: st.phi, color: 'var(--c-area)', fmt: (v) => (v / PI).toFixed(2) + 'π', onInput: (v) => { st.phi = v; update(); } });
  const lp = loop((dt) => { st.phi = Math.min(TAU, st.phi + dt * 1.4 * tr.speed.get()); sweep.set(st.phi); if (st.phi >= TAU) tr.set(false); update(); });
  const tr = transport(g0, {
    onPlay: (p) => { if (p) { st.phi = 0; lp.start(); } else lp.stop(); },
    onReset: () => { tr.set(false); st.phi = TAU; sweep.set(TAU); update(); },
    speed: { min: 0.25, max: 3, step: 0.25, value: 1, fmt: (v) => '×' + v.toFixed(2) },
  });
  ctx.onHide(() => { tr.set(false); view.stop(); });
  const g1 = group(panel, 'Show');
  slider(g1, { label: 'Washers', min: 0, max: 60, step: 1, value: 0, color: 'var(--c-approx)', fmt: (v) => (v ? String(v) : 'off'), onInput: (v) => { st.N = v; update(); } });
  toggle(g1, { label: 'Formula and value', onChange: (v) => { st.formula = v; update(); } });
  toggle(g1, { label: 'See-through', checked: true, onChange: (v) => { st.see = v; update(); } });
  toggle(g1, { label: 'Wireframe', onChange: (v) => { st.wire = v; update(); } });
  toggle(g1, { label: 'Flat region', color: 'var(--c-area)', onChange: (v) => { st.region = v; update(); } });
  const ro = readouts(g1, [{ key: 'V', label: '$V$' }, { key: 'Vp', label: '$V/\\pi$' }, { key: 'S', label: 'Sum of washers' }, { key: 'E', label: 'Difference' }]);
  ro.el.hidden = true;
  ctx.onShow(() => { view.start(); update(); });
}

mountSim({
  title: 'Volumes of revolution',
  tabs: [
    { id: 'solid', label: 'Solid of revolution', init: tabSolid },
    { id: 'washers', label: 'Between two curves', init: tabWasher },
  ],
});
