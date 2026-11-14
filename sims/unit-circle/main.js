import { mountSim } from '../../assets/js/kit/shell.js';
import { Plot, MINUS, fmtNum } from '../../assets/js/kit/plot.js';
import { group, slider, toggle, segmented, transport, readouts, button } from '../../assets/js/kit/ui.js';
import { renderTex } from '../../assets/js/kit/tex.js';
import { loop } from '../../assets/js/kit/anim.js';
import { withAlpha } from '../../assets/js/kit/theme.js';

const TAU = Math.PI * 2;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

// ---- shared state: the angle survives tab switches ----
const S = { theta: 1.0, phi: Math.PI / 2, deg: false };

const SPECIAL = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330];
const rad = (d) => (d * Math.PI) / 180;

function piFrac(deg) {
  if (deg === 0) return '0';
  let n = deg, d = 180;
  const g = gcd(n, d); n /= g; d /= g;
  return (n === 1 ? '' : n) + 'π' + (d === 1 ? '' : '/' + d);
}
const angleLabel = (deg) => (S.deg ? deg + '°' : piFrac(deg));
const nearSpecial = (theta, tol = 0.035) => {
  const d = (theta * 180) / Math.PI;
  const s = SPECIAL.concat([360]).find((x) => Math.abs(x - d) < (tol * 180) / Math.PI);
  return s === undefined ? null : s % 360;
};
const BASE_SIN = { 0: '0', 30: '1/2', 45: '√2/2', 60: '√3/2', 90: '1' };
const BASE_TAN = { 0: '0', 30: '√3/3', 45: '1', 60: '√3' };
function exactSin(d) {
  d = ((d % 360) + 360) % 360;
  let a = d, sgn = '';
  if (a > 180) { a = 360 - a; sgn = MINUS; }
  if (a > 90) a = 180 - a;
  return BASE_SIN[a] === '0' ? '0' : sgn + BASE_SIN[a];
}
const exactCos = (d) => exactSin(90 - d);
function exactTan(d) {
  d = ((d % 360) + 360) % 360;
  if (d === 90 || d === 270) return 'undefined';
  let a = d % 180; if (a > 90) a = 180 - a;
  const neg = (d > 90 && d < 180) || (d > 270 && d < 360);
  return BASE_TAN[a] === '0' ? '0' : (neg ? MINUS : '') + BASE_TAN[a];
}
const thetaStr = (th) => {
  const sp = nearSpecial(th, 1e-9);
  if (S.deg) return fmtNum((th * 180) / Math.PI, 1) + '°';
  return sp !== null && sp !== 0 ? piFrac(sp) + ' ≈ ' + fmtNum(th, 3) : fmtNum(th, 3);
};

// ---- shared pieces ----
function band(stage, frac = 0.44) {
  stage.classList.add('centered');
  const b = document.createElement('div'); b.className = 'band'; b.style.setProperty('--frac', frac);
  stage.append(b);
  return b;
}
function playControls(parent, redraw, ctx, key = 'theta') {
  const lp = loop((dt) => {
    S[key] = (S[key] + dt * 0.9 * t.speed.get()) % TAU;
    redraw();
  });
  const t = transport(parent, {
    onPlay: (p) => (p ? lp.start() : lp.stop()),
    speed: { min: 0.1, max: 3, step: 0.05, value: 1, fmt: (v) => '×' + v.toFixed(2) },
  });
  ctx.onHide(() => { lp.stop(); t.set(false, false); });
  return t;
}

function unitsControl(parent, redraw, plots) {
  return segmented(parent, {
    value: S.deg ? 'deg' : 'rad', full: true,
    options: [{ value: 'rad', label: 'Radians' }, { value: 'deg', label: 'Degrees' }],
    onChange: (v) => { S.deg = v === 'deg'; for (const p of plots) if (p.o.xTicks !== 'none' && p.o.angleAxis) p.o.xTicks = S.deg ? 'deg' : 'pi'; redraw(); },
  });
}

function setAngleFromPointer(x, y, snap) {
  let a = Math.atan2(y, x);
  if (a < 0) a += TAU;
  if (snap) { const s = nearSpecial(a, 0.06); if (s !== null) a = rad(s); }
  if (a > TAU - 1e-6) a = 0;
  S.theta = a;
}

const trigFns = { sin: Math.sin, cos: Math.cos, tan: Math.tan };

/** Draw the circle, angle arc, radius and optional extras. */
function drawCircle(p, o) {
  const C = p.C, th = S.theta, c = Math.cos(th), s = Math.sin(th);
  p.circle(0, 0, 1, { color: C.line2, width: 1.6 });
  if (o.special) {
    for (const d of SPECIAL) {
      const a = rad(d), ca = Math.cos(a), sa = Math.sin(a);
      p.dot(ca, sa, { r: 3, color: C.ink3 });
      p.label(angleLabel(d), 1.22 * ca, 1.22 * sa, { align: 'center', size: 11.5, color: C.ink2 });
    }
  }
  if (o.tri) p.poly([[0, 0], [c, 0], [c, s]], { close: true, fill: C.ink, fillAlpha: 0.07, color: C.ink3, width: 1.4 });
  if (o.tan) {
    const t = Math.tan(th);
    p.vline(1, { color: C.tan, alpha: 0.35, width: 1.3, dash: [5, 4] });
    if (Math.abs(c) > 1e-3) {
      p.slopeLine(0, 0, s / c, { color: C.tan, alpha: 0.45, width: 1.2 });
      p.line(1, 0, 1, t, { color: C.tan, width: 4 });
      p.dot(1, t, { r: 4.5, color: C.tan, ring: true });
    }
  }
  if (o.proj) {
    p.line(c, s, c, 0, { color: C.cos, alpha: 0.6, width: 1.3, dash: [4, 4] });
    p.line(c, s, 0, s, { color: C.sin, alpha: 0.6, width: 1.3, dash: [4, 4] });
    p.line(0, 0, c, 0, { color: C.cos, width: 4.5 });
    p.line(0, 0, 0, s, { color: C.sin, width: 4.5 });
  }
  if (o.sector) p.sector(0, 0, 0.22, 0, th, { fill: C.area, alpha: 0.18 });
  p.arc(0, 0, 0.22, 0, th, { color: C.area, width: 1.8 });
  p.arc(0, 0, 1, 0, th, { color: C.area, width: 4 });
  p.line(0, 0, c, s, { color: C.ink, width: 2.2 });
  if (o.vals) {
    if (o.proj) {
      p.label('cos θ', c / 2, 0, { dy: c * s >= 0 ? 16 : -16, align: 'center', color: C.cos, size: 12.5 });
      p.label('sin θ', 0, s / 2, { dx: -8, align: 'right', color: C.sin, size: 12.5 });
    }
    p.label('θ', 0.3 * Math.cos(th / 2) + 0.06, 0.3 * Math.sin(th / 2), { align: 'center', color: C.area, size: 13, italic: true });
  }
  p.dot(0, 0, { r: 2.5, color: C.ink });
}

function makeCircle(host, o) {
  const p = new Plot(host, {
    view: { x: [-1.6, 1.6], y: [-1.5, 1.5] }, equal: true, pan: false, zoom: false, grid: false, numbers: false,
    draw: (pl) => { o.draw(pl); },
    onResize: o.onResize,
  });
  p.addHandle({
    get: () => [Math.cos(S.theta), Math.sin(S.theta)],
    set: (x, y) => { setAngleFromPointer(x, y, o.snap && o.snap()); o.redraw(); },
    color: o.color || undefined, r: 8, hit: 18,
  });
  return p;
}

/** Angle-axis graph (x = θ), y scale locked to the circle so link lines are horizontal across the gap. */
function makeGraph(host, circle, draw) {
  return new Plot(host, {
    xTicks: 'pi', angleAxis: true, lockY: true, grid: false, originLabel: true,
    fit: (p, w, h) => ({ cx: TAU / 2, cy: 0, sx: w / (TAU + 1.2), sy: circle.v.sy }),
    draw,
  });
}

function gridToggle(parent, plots, redraw) {
  return toggle(parent, { label: 'Grid', onChange: (v) => { for (const p of plots) p.o.grid = v; redraw(); } });
}

// =================== Tab 1: circle and graphs ===================
function tabMain(ctx) {
  const { stage, panel } = ctx;
  const st = { sin: true, cos: false, tan: false, tri: false, proj: false, vals: false, special: false, whole: false };
  const redraw = () => { circle.redraw(); graph.redraw(); updateReadouts(); };

  const bd = band(stage);
  const circle = makeCircle(bd, {
    snap: () => st.special, redraw,
    onResize: () => { if (graph) graph.resize(); },
    draw: (p) => {
      drawCircle(p, { tri: st.tri, proj: st.proj, tan: st.tan, vals: st.vals, special: st.special, sector: true });
      const th = S.theta, C = p.C;
      if (st.sin) p.line(Math.cos(th), Math.sin(th), p.xmax, Math.sin(th), { color: C.sin, width: 1.6, dash: [5, 4], alpha: 0.9 });
      if (st.tan && Math.abs(Math.cos(th)) > 1e-3) p.line(1, Math.tan(th), p.xmax, Math.tan(th), { color: C.tan, width: 1.6, dash: [5, 4], alpha: 0.9 });
    },
  });
  circle.el.style.flex = '0 0 44%';
  const graph = makeGraph(bd, circle, (p) => {
    const th = S.theta, C = p.C;
    const fns = [['sin', st.sin, C.sin], ['cos', st.cos, C.cos], ['tan', st.tan, C.tan]];
    const L = p.ymax;
    if (st.tan) for (let k = -3; k <= 5; k++) { const x = Math.PI / 2 + k * Math.PI; p.vline(x, { color: C.tan, alpha: 0.25, width: 1.2, dash: [3, 5] }); }
    p.line(0, 0, th, 0, { color: C.area, width: 4.5 });
    for (const [n, on, col] of fns) {
      if (!on) continue;
      const f = trigFns[n];
      if (st.whole) p.curve(f, { color: col, alpha: 0.28, width: 2 });
      p.curve(f, { color: col, width: 3, from: 0, to: th });
    }
    for (const [n, on, col] of fns) {
      if (!on) continue;
      const y = trigFns[n](th);
      if (n === 'tan' && Math.abs(Math.cos(th)) < 1e-3) continue;
      if (n !== 'cos') p.line(p.xmin, y, th, y, { color: col, width: 1.6, dash: [5, 4], alpha: 0.9 });
      if (st.proj || (n === 'cos' && st.sin)) p.line(th, 0, th, y, { color: col, width: 1.3, dash: [3, 4], alpha: 0.7 });
      p.dot(th, y, { r: 5.5, color: col, ring: true });
    }
    if (st.cos && st.sin) p.line(th, Math.sin(th), th, Math.cos(th), { color: C.ink3, width: 1.2, dash: [3, 4], alpha: 0.6 });
    if (st.special) for (const d of SPECIAL) p.dot(rad(d), 0, { r: 2.5, color: C.ink3 });
  });

  // ---- panel ----
  const g0 = group(panel);
  playControls(g0, redraw, ctx);
  const g1 = group(panel, 'Graphs');
  toggle(g1, { label: 'Sine', checked: true, color: 'var(--c-sin)', onChange: (v) => { st.sin = v; redraw(); } });
  toggle(g1, { label: 'Cosine', color: 'var(--c-cos)', onChange: (v) => { st.cos = v; redraw(); } });
  toggle(g1, { label: 'Tangent', color: 'var(--c-tan)', onChange: (v) => { st.tan = v; redraw(); } });
  toggle(g1, { label: 'Whole curve', onChange: (v) => { st.whole = v; redraw(); } });
  const g2 = group(panel, 'Circle');
  toggle(g2, { label: 'Triangle', onChange: (v) => { st.tri = v; redraw(); } });
  toggle(g2, { label: 'Projections', onChange: (v) => { st.proj = v; redraw(); } });
  toggle(g2, { label: 'Special angles', onChange: (v) => { st.special = v; redraw(); } });
  gridToggle(g2, [circle, graph], redraw);
  const g3 = group(panel, 'Values');
  unitsControl(g3, redraw, [graph]);
  const showVals = toggle(g3, { label: 'Live values', onChange: (v) => { st.vals = v; ro.hide(!v); redraw(); } });
  const ro = readouts(g3, [
    { key: 'th', label: '$\\theta$' }, { key: 'sin', label: '$\\sin\\theta$' },
    { key: 'cos', label: '$\\cos\\theta$' }, { key: 'tan', label: '$\\tan\\theta$' },
  ]);
  ro.hide(true);
  function updateReadouts() {
    if (!st.vals) return;
    const th = S.theta, sp = nearSpecial(th, 1e-9);
    ro.set('th', thetaStr(th));
    const ex = (e, v) => (sp !== null && e !== 'undefined' ? e + ' = ' + fmtNum(v, 3) : e === 'undefined' ? 'undefined' : fmtNum(v, 3));
    ro.set('sin', sp !== null ? ex(exactSin(sp), Math.sin(th)) : fmtNum(Math.sin(th), 3));
    ro.set('cos', sp !== null ? ex(exactCos(sp), Math.cos(th)) : fmtNum(Math.cos(th), 3));
    ro.set('tan', sp !== null ? ex(exactTan(sp), Math.tan(th)) : Math.abs(Math.cos(th)) < 1e-9 ? 'undefined' : fmtNum(Math.tan(th), 3));
  }
  ctx.onShow(() => { for (const p of [circle, graph]) p.o.xTicks !== 'none' && p.o.angleAxis && (p.o.xTicks = S.deg ? 'deg' : 'pi'); redraw(); });
}

// =================== Tab 2: sine and cosine together ===================
function tabBoth(ctx) {
  const { stage, panel } = ctx;
  const st = { tri: true, proj: true, vals: false };
  stage.style.display = 'grid';
  stage.style.gridTemplateColumns = '40% 1fr';
  stage.style.gridTemplateRows = '1.1fr 0.9fr';
  const redraw = () => { circle.redraw(); graph.redraw(); side.redraw(); cosG.redraw(); };

  const circle = makeCircle(stage, {
    redraw, snap: () => false,
    onResize: () => { if (graph) graph.resize(); if (side) side.resize(); },
    draw: (p) => {
      drawCircle(p, { tri: st.tri, proj: st.proj, vals: st.vals, sector: true });
      const th = S.theta, C = p.C;
      p.line(Math.cos(th), Math.sin(th), p.xmax, Math.sin(th), { color: C.sin, width: 1.6, dash: [5, 4] });
      p.line(Math.cos(th), Math.sin(th), Math.cos(th), p.ymin, { color: C.cos, width: 1.6, dash: [5, 4] });
    },
  });
  const graph = makeGraph(stage, circle, (p) => {
    const th = S.theta, C = p.C;
    p.line(0, 0, th, 0, { color: C.area, width: 4.5 });
    p.curve(Math.sin, { color: C.sin, width: 3, from: 0, to: th });
    p.line(p.xmin, Math.sin(th), th, Math.sin(th), { color: C.sin, width: 1.6, dash: [5, 4] });
    p.dot(th, Math.sin(th), { r: 5.5, color: C.sin, ring: true });
  });
  graph.el.style.borderLeft = '1px solid var(--line)';
  circle.el.style.gridArea = '1 / 1'; graph.el.style.gridArea = '1 / 2';
  // cosine on its side: x is cos θ (shares the circle's horizontal scale), θ runs downwards
  const side = new Plot(stage, {
    xTicks: 'none', yTicks: 'pi', yFlip: true, lockX: true, grid: false, originLabel: false,
    fit: (p, w, h) => ({ cx: 0, cy: -TAU / 2, sx: circle.v.sx, sy: h / (TAU + 0.9) }),
    draw: (p) => {
      const th = S.theta, C = p.C;
      p.line(0, 0, 0, -TAU, { color: C.line2, width: 1 });
      p.line(0, 0, 0, -th, { color: C.area, width: 4.5 });
      p.param((t) => [Math.cos(t), -t], 0, th, { color: C.cos, width: 3 });
      p.line(Math.cos(th), p.ymax, Math.cos(th), -th, { color: C.cos, width: 1.6, dash: [5, 4] });
      p.dot(Math.cos(th), -th, { r: 5.5, color: C.cos, ring: true });
      for (const v of [-1, 1]) p.label(v < 0 ? MINUS + '1' : '1', v, 0, { dy: -11, align: 'center', size: 12, color: C.ink3 });
    },
  });
  const cosG = new Plot(stage, {
    xTicks: 'pi', angleAxis: true, grid: false, view: { x: [-0.55, TAU + 0.65], y: [-1.6, 1.6] }, lockY: true, originLabel: true,
    draw: (p) => {
      const th = S.theta, C = p.C;
      p.line(0, 0, th, 0, { color: C.area, width: 4.5 });
      p.curve(Math.cos, { color: C.cos, width: 3, from: 0, to: th });
      p.line(th, 0, th, Math.cos(th), { color: C.cos, width: 1.4, dash: [3, 4], alpha: 0.7 });
      p.dot(th, Math.cos(th), { r: 5.5, color: C.cos, ring: true });
    },
  });
  cosG.el.style.gridArea = '2 / 2'; cosG.el.style.borderTop = '1px solid var(--line)';
  side.el.style.gridArea = '2 / 1';
  side.el.style.borderTop = '1px solid var(--line)';
  side.el.style.borderLeft = '0';

  const g0 = group(panel);
  playControls(g0, redraw, ctx);
  const g1 = group(panel, 'Circle');
  toggle(g1, { label: 'Triangle', checked: true, onChange: (v) => { st.tri = v; redraw(); } });
  toggle(g1, { label: 'Projections', checked: true, onChange: (v) => { st.proj = v; redraw(); } });
  toggle(g1, { label: 'Labels', onChange: (v) => { st.vals = v; redraw(); } });
  const g2 = group(panel, 'Units');
  unitsControl(g2, redraw, [graph, side, cosG]);
  ctx.onShow(() => { for (const p of [graph, side, cosG]) { if (p.o.angleAxis) p.o.xTicks = S.deg ? 'deg' : 'pi'; } side.o.yTicks = S.deg ? 'deg' : 'pi'; redraw(); });
}

// =================== Tab 3: sin² + cos² = 1 ===================
function tabIdentity(ctx) {
  const { stage, panel } = ctx;
  const st = { mode: 'pyth' };
  const redraw = () => { circle.redraw(); bar.redraw(); update(); };

  const circle = makeCircle(stage, {
    redraw, snap: () => false,
    draw: (p) => {
      const th = S.theta, c = Math.cos(th), s = Math.sin(th), C = p.C;
      if (st.mode === 'pyth') {
        const a = Math.abs(c), b = Math.abs(s);
        p.rect(Math.min(0, c), -a, Math.max(0, c), 0, { fill: C.cos, fillAlpha: 0.25, color: C.cos, width: 1.4 });
        p.rect(-b, Math.min(0, s), 0, Math.max(0, s), { fill: C.sin, fillAlpha: 0.25, color: C.sin, width: 1.4 });
        drawCircle(p, { tri: true, proj: true, sector: false });
      } else {
        drawCircle(p, { tri: false, tan: true, sector: false });
        if (Math.abs(c) > 1e-3) {
          p.poly([[0, 0], [1, 0], [1, Math.tan(th)]], { close: true, fill: C.tan, fillAlpha: 0.1 });
          p.line(0, 0, 1, 0, { color: C.aux, width: 4.5 });
          p.line(0, 0, 1, Math.tan(th), { color: C.approx, width: 2.4 });
        }
      }
    },
  });
  circle.o.view = { x: [-1.7, 1.7], y: [-1.6, 1.6] };
  circle.resize();
  const bar = new Plot(stage, {
    xTicks: 'none', yTicks: 'none', axes: false, grid: false, pan: false, zoom: false,
    view: { x: [-0.08, 1.08], y: [-0.7, 0.7] },
    draw: (p) => {
      const th = S.theta, C = p.C, c2 = Math.cos(th) ** 2, s2 = Math.sin(th) ** 2;
      if (st.mode === 'pyth') {
        p.rect(0, -0.12, c2, 0.12, { fill: C.cos, fillAlpha: 0.8 });
        p.rect(c2, -0.12, 1, 0.12, { fill: C.sin, fillAlpha: 0.8 });
        p.rect(0, -0.12, 1, 0.12, { color: C.ink, width: 1.5 });
        if (c2 > 0.07) p.label('cos²θ', c2 / 2, 0, { align: 'center', size: 12.5, color: '#fff', halo: false });
        if (s2 > 0.07) p.label('sin²θ', c2 + s2 / 2, 0, { align: 'center', size: 12.5, color: '#fff', halo: false });
        p.label('1', 0.5, 0.12, { dy: -14, align: 'center', size: 14, color: C.ink });
        p.line(0, 0.12, 0, 0.12, {});
      } else {
        const sec2 = 1 / (Math.cos(th) ** 2), t2 = Math.tan(th) ** 2;
        const M = Math.max(2, Math.min(Math.ceil(sec2 + 0.01), 30));
        p.v.sx = p.w * 0.84 / M; p.v.cx = M / 2;
        const clip = (x) => Math.min(x, M);
        p.rect(0, -0.12, 1, 0.12, { fill: C.aux, fillAlpha: 0.85 });
        p.rect(1, -0.12, clip(1 + t2), 0.12, { fill: C.tan, fillAlpha: 0.85 });
        p.rect(0, -0.12, clip(sec2), 0.12, { color: C.ink, width: 1.5 });
        if (Math.cos(th) ** 2 > 0.03) p.label('sec²θ', clip(sec2) / 2, 0.12, { dy: -14, align: 'center', size: 13.5, color: C.ink });
        p.label('1', 0.5, 0, { align: 'center', size: 12.5, color: '#fff', halo: false });
        if (t2 > 0.45 * (M > 3 ? 1 : 1) && 1 + t2 < M + 1) p.label('tan²θ', 1 + Math.min(t2, M - 1) / 2, 0, { align: 'center', size: 12.5, color: '#fff', halo: false });
      }
    },
  });
  bar.el.style.flex = '0 0 36%';

  const g0 = group(panel);
  playControls(g0, redraw, ctx);
  const g1 = group(panel, 'Identity');
  segmented(g1, {
    full: true, value: 'pyth', options: [{ value: 'pyth', label: 'Pythagoras' }, { value: 'tan', label: 'Tangent' }],
    onChange: (v) => { st.mode = v; bar.o.view = v === 'pyth' ? { x: [-0.08, 1.08], y: [-0.7, 0.7] } : { x: [-0.08, 3], y: [-0.7, 0.7] }; bar.touched = false; bar.resize(); update(); redraw(); },
  });
  const f = document.createElement('div'); f.className = 'formula'; g1.append(f);
  const ro = readouts(g1, [{ key: 'a', label: '' }]);
  ro.el.style.gridTemplateColumns = '1fr';
  ro.el.querySelector('.v').style.textAlign = 'left';
  let lastMode = null;
  function update() {
    if (lastMode !== st.mode) {
      lastMode = st.mode;
      renderTex(f, st.mode === 'pyth' ? '\\sin^2\\theta+\\cos^2\\theta=1' : '1+\\tan^2\\theta=\\sec^2\\theta');
    }
    const th = S.theta, c2 = Math.cos(th) ** 2, s2 = Math.sin(th) ** 2;
    if (st.mode === 'pyth') ro.set('a', `${fmtNum(s2, 3)} + ${fmtNum(c2, 3)} = ${fmtNum(s2 + c2, 3)}`);
    else ro.set('a', Math.abs(Math.cos(th)) < 1e-6 ? 'undefined' : `1 + ${fmtNum(Math.tan(th) ** 2, 3)} = ${fmtNum(1 / c2, 3)}`);
  }
  update();
  ctx.onShow(redraw);
}

// =================== Tab 4: phase shift ===================
function tabPhase(ctx) {
  const { stage, panel } = ctx;
  const st = { whole: true, cos: false };
  const redraw = () => { circle.redraw(); graph.redraw(); update(); };
  const bd = band(stage);
  const circle = makeCircle(bd, {
    redraw, snap: () => false,
    onResize: () => { if (graph) graph.resize(); },
    draw: (p) => {
      const th = S.theta, ph = S.phi, C = p.C;
      const q = th + ph;
      p.circle(0, 0, 1, { color: C.line2, width: 1.6 });
      p.sector(0, 0, 0.3, th, q, { fill: C.approx, alpha: 0.2 });
      p.arc(0, 0, 0.3, th, q, { color: C.approx, width: 1.8 });
      p.arc(0, 0, 1, 0, th, { color: C.area, width: 4 });
      p.line(0, 0, Math.cos(th), Math.sin(th), { color: C.sin, width: 2.4 });
      p.line(0, 0, Math.cos(q), Math.sin(q), { color: C.approx, width: 2.4 });
      p.line(Math.cos(th), Math.sin(th), p.xmax, Math.sin(th), { color: C.sin, width: 1.6, dash: [5, 4] });
      p.line(Math.cos(q), Math.sin(q), p.xmax, Math.sin(q), { color: C.approx, width: 1.6, dash: [5, 4] });
      p.dot(0, 0, { r: 2.5, color: C.ink });
    },
  });
  circle.handles.length = 0;
  circle.addHandle({
    get: () => [Math.cos(S.theta), Math.sin(S.theta)],
    set: (x, y) => { setAngleFromPointer(x, y, false); redraw(); }, color: (C) => C.sin, r: 8, hit: 18,
  });
  circle.addHandle({
    get: () => [Math.cos(S.theta + S.phi), Math.sin(S.theta + S.phi)],
    set: (x, y) => {
      let a = Math.atan2(y, x) - S.theta; a = ((a % TAU) + TAU) % TAU;
      const sp = nearSpecial(a, 0.06); S.phi = sp !== null ? rad(sp) : a; if (S.phi > TAU - 1e-6) S.phi = 0;
      phi.set(S.phi); redraw();
    }, color: (C) => C.approx, r: 8, hit: 18,
  });
  circle.el.style.flex = '0 0 44%';
  const graph = makeGraph(bd, circle, (p) => {
    const th = S.theta, ph = S.phi, C = p.C;
    const f = (x) => Math.sin(x), g = (x) => Math.sin(x + ph);
    if (st.whole) { p.curve(f, { color: C.sin, alpha: 0.28, width: 2 }); p.curve(g, { color: C.approx, alpha: 0.28, width: 2 }); }
    if (st.cos) p.curve(Math.cos, { color: C.cos, width: 2, dash: [2, 6], alpha: 0.9 });
    p.line(0, 0, th, 0, { color: C.area, width: 4.5 });
    p.curve(f, { color: C.sin, width: 3, from: 0, to: th });
    p.curve(g, { color: C.approx, width: 3, from: 0, to: th });
    p.line(p.xmin, f(th), th, f(th), { color: C.sin, width: 1.6, dash: [5, 4] });
    p.line(p.xmin, g(th), th, g(th), { color: C.approx, width: 1.6, dash: [5, 4] });
    p.dot(th, f(th), { r: 5.5, color: C.sin, ring: true });
    p.dot(th, g(th), { r: 5.5, color: C.approx, ring: true });
  });
  const g0 = group(panel);
  playControls(g0, redraw, ctx);
  const g1 = group(panel, 'Shift');
  const phi = slider(g1, {
    label: '$\\varphi$', min: 0, max: TAU, step: 0.01, value: S.phi, color: 'var(--c-approx)',
    fmt: (v) => (S.deg ? fmtNum((v * 180) / Math.PI, 0) + '°' : fmtNum(v, 2)),
    onInput: (v) => { const sp = nearSpecial(v, 0.04); S.phi = sp !== null ? rad(sp) : v; if (sp !== null) phi.set(S.phi); redraw(); },
  });
  const fo = document.createElement('div'); fo.className = 'formula'; g1.append(fo);
  const g2 = group(panel, 'Show');
  toggle(g2, { label: 'Whole curves', checked: true, onChange: (v) => { st.whole = v; redraw(); } });
  toggle(g2, { label: 'Cosine', color: 'var(--c-cos)', onChange: (v) => { st.cos = v; redraw(); } });
  const g3 = group(panel, 'Units');
  unitsControl(g3, () => { phi.set(S.phi); redraw(); }, [graph]);
  let lastF = '';
  function update() {
    const sp = nearSpecial(S.phi, 1e-6);
    const a = sp !== null ? (S.deg ? sp + '^\\circ' : piTex(sp)) : fmtNum(S.deg ? (S.phi * 180) / Math.PI : S.phi, S.deg ? 0 : 2).replace(MINUS, '-') + (S.deg ? '^\\circ' : '');
    let s = `\\sin(\\theta+${a === '0' || a === '0^\\circ' ? '0' : a})`;
    if (sp === 90) s += '=\\cos\\theta'; else if (sp === 180) s += '=-\\sin\\theta'; else if (sp === 270) s += '=-\\cos\\theta'; else if (sp === 0) s += '=\\sin\\theta';
    if (s !== lastF) { lastF = s; renderTex(fo, s); }
    phi.set(S.phi);
  }
  ctx.onShow(() => { graph.o.xTicks = S.deg ? 'deg' : 'pi'; phi.set(S.phi); redraw(); });
}
function piTex(deg) {
  if (deg === 0) return '0';
  let n = deg, d = 180; const g = gcd(n, d); n /= g; d /= g;
  return d === 1 ? (n === 1 ? '\\pi' : n + '\\pi') : `\\frac{${n === 1 ? '' : n}\\pi}{${d}}`;
}

mountSim({
  title: 'Unit circle',
  tabs: [
    { id: 'graphs', label: 'Circle and graphs', init: tabMain },
    { id: 'both', label: 'Sine and cosine', init: tabBoth },
    { id: 'identities', label: 'Identities', init: tabIdentity },
    { id: 'phase', label: 'Phase shift', init: tabPhase },
  ],
});
