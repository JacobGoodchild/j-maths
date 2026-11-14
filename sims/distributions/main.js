import { mountSim } from '../../assets/js/kit/shell.js';
import { Plot, fmtNum, MINUS } from '../../assets/js/kit/plot.js';
import { group, slider, toggle, segmented, dropdown, transport, readouts } from '../../assets/js/kit/ui.js';
import { loop } from '../../assets/js/kit/anim.js';
import { seeded, binomPmf, normalPdf } from '../../assets/js/kit/rng.js';

const R = seeded();
const RATES = [1, 2, 5, 10, 30, 100, 300, 1000, 3000, 10000];
const fmtRate = (v) => (RATES[v] >= 1000 ? RATES[v] / 1000 + 'k' : RATES[v]) + ' / s';
const nice = (v) => { if (v <= 0) return 1; const e = Math.pow(10, Math.floor(Math.log10(v))), f = v / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e; };
const f2 = (v, d = 2) => fmtNum(v, d);

/**
 * Standard run controls. api = { step(count, single), reset(), noun }.
 * Fractional counts accumulate so that slow rates (1 per second) still work.
 */
function runner(ctx, parent, api, defaultRate = 3) {
  let acc = 0;
  const lp = loop((dt) => { acc += RATES[tr.speed.get()] * dt; const k = Math.floor(acc); if (k > 0) { acc -= k; api.step(k, false); } api.frame && api.frame(dt); });
  const tr = transport(parent, {
    onPlay: (p) => { acc = 0; p ? lp.start() : lp.stop(); },
    onStep: () => { api.step(1, true); api.frame && api.frame(0); },
    onReset: () => { api.reset(); },
    speed: { min: 0, max: RATES.length - 1, step: 1, value: defaultRate, fmt: fmtRate },
  });
  ctx.onHide(() => { tr.set(false); });
  return tr;
}

class Welford {
  constructor() { this.reset(); }
  reset() { this.n = 0; this.m = 0; this.s = 0; }
  add(x) { this.n++; const d = x - this.m; this.m += d / this.n; this.s += d * (x - this.m); }
  get mean() { return this.n ? this.m : NaN; }
  get sd() { return this.n > 1 ? Math.sqrt(this.s / (this.n - 1)) : NaN; }
}
const smooth = (cur, target, k = 0.2) => (Math.abs(target - cur) < 1e-6 * target ? target : cur + (target - cur) * k);

// =================== Binomial ===================
function tabBinomial(ctx) {
  const { stage, panel } = ctx;
  const st = { n: 10, p: 0.5, rel: false, exact: false, flips: false, vals: false, N: 0, counts: new Float64Array(101), last: [], lastK: -1, ym: 1 };
  const w = new Welford();
  const reset = () => { st.N = 0; st.counts.fill(0); st.last = []; st.lastK = -1; w.reset(); st.ym = 1; fitY(true); plot.redraw(); readoutsUpdate(); };
  const target = () => {
    const sc = st.rel ? 1 / Math.max(1, st.N) : 1;
    let m = 0; for (let k = 0; k <= st.n; k++) m = Math.max(m, st.counts[k] * sc);
    if (st.exact || st.N === 0) { for (let k = 0; k <= st.n; k++) m = Math.max(m, binomPmf(st.n, st.p, k) * (st.rel ? 1 : Math.max(1, st.N))); }
    return Math.max(m * 1.12, st.rel ? 0.5 : 5);
  };
  const fitY = (snap) => {
    const t = target();
    st.ym = snap ? t : smooth(st.ym, t, 0.18);
    plot.setHome({ x: [-0.9, st.n + 0.9], y: [0, st.ym] });
  };
  const plot = new Plot(stage, {
    view: { x: [-0.9, 10.9], y: [0, 1.2] }, inset: { l: 62, b: 34, t: 14, r: 16 }, pin: true, pan: false, zoom: false, tickPx: 70, grid: true, intTicks: true,
    draw: (p) => {
      const C = p.C, sc = st.rel ? 1 / Math.max(1, st.N) : 1;
      for (let k = 0; k <= st.n; k++) {
        const h = st.counts[k] * sc;
        if (h > 0) p.rect(k - 0.4, 0, k + 0.4, h, { fill: k === st.lastK ? C.tangent : C.area, fillAlpha: k === st.lastK ? 0.85 : 0.55 });
      }
      if (st.exact) {
        const m = st.rel ? 1 : Math.max(1, st.N);
        for (let k = 0; k <= st.n; k++) p.rect(k - 0.4, 0, k + 0.4, binomPmf(st.n, st.p, k) * m, { color: C.approx, width: 2 });
      }
      if (st.flips && st.last.length) {
        const A = p.area, per = Math.min(st.n, 50), step = Math.min(15, (A.w * 0.5) / per);
        p.text(`${st.lastK} heads from ${st.n} flips`, A.x0 + 14, A.y0 + 44, { size: 13, color: C.ink2, halo: false });
        st.last.forEach((hd, i) => {
          const cx = A.x0 + 18 + (i % per) * step, cy = A.y0 + 68 + Math.floor(i / per) * step;
          const { ctx: c } = p; c.beginPath(); c.arc(cx, cy, Math.min(5, step * 0.36), 0, 6.283);
          if (hd) { c.fillStyle = C.approx; c.fill(); } else { c.strokeStyle = C.ink3; c.lineWidth = 1.5; c.stroke(); }
        });
      }
    },
  });
  const A0 = (p) => p.area;
  plot.o.yLabel = 'frequency'; plot.o.xLabel = 'heads';

  const trial = (single) => {
    let k = 0; const fl = single ? [] : null;
    for (let i = 0; i < st.n; i++) { const h = R.random() < st.p; if (h) k++; if (single) fl.push(h); }
    st.counts[k]++; st.N++; w.add(k); st.lastK = k;
    if (single) st.last = fl;
  };
  const g0 = group(panel);
  slider(g0, { label: 'Flips $n$', min: 1, max: 100, step: 1, value: st.n, fmt: String, color: 'var(--c-area)', onInput: (v) => { st.n = v; reset(); } });
  slider(g0, { label: 'Probability of heads $p$', min: 0, max: 1, step: 0.05, value: st.p, fmt: (v) => f2(v), color: 'var(--c-area)', onInput: (v) => { st.p = v; reset(); } });
  const tr = runner(ctx, g0, {
    step: (k, single) => {
      const batch = Math.min(k, 20000);
      for (let i = 0; i < batch; i++) trial(single && i === batch - 1);
      if (!single && st.flips) {
        const fl = []; let kk = 0; for (let i = 0; i < st.n; i++) { const h = R.random() < st.p; if (h) kk++; fl.push(h); } st.last = fl; st.lastK = kk; st.counts[kk]++; st.N++; w.add(kk);
      }
      fitY(); plot.redraw(); readoutsUpdate();
    },
    reset,
  });
  const g1 = group(panel, 'Show');
  toggle(g1, { label: 'Exact $B(n,p)$', color: 'var(--c-approx)', onChange: (v) => { st.exact = v; fitY(true); plot.redraw(); } });
  toggle(g1, { label: 'The flips', onChange: (v) => { st.flips = v; plot.redraw(); } });
  toggle(g1, { label: 'Relative frequency', onChange: (v) => { st.rel = v; plot.o.yLabel = v ? 'relative frequency' : 'frequency'; fitY(true); plot.redraw(); } });
  toggle(g1, { label: 'Mean and variance', onChange: (v) => { st.vals = v; ro.hide(!v); readoutsUpdate(); } });
  const ro = readouts(g1, [{ key: 'N', label: 'Trials' }, { key: 'm', label: 'Sample mean' }, { key: 'mt', label: '$np$' }, { key: 'v', label: 'Sample variance' }, { key: 'vt', label: '$np(1-p)$' }]);
  ro.hide(true);
  function readoutsUpdate() {
    if (!st.vals) return;
    ro.set('N', String(st.N)); ro.set('m', st.N ? f2(w.mean, 3) : '—'); ro.set('mt', f2(st.n * st.p, 3));
    ro.set('v', w.n > 1 ? f2(w.sd ** 2, 3) : '—'); ro.set('vt', f2(st.n * st.p * (1 - st.p), 3));
  }
  for (let i = 0; i < 30; i++) trial(false);
  ctx.onShow(() => { fitY(true); plot.redraw(); readoutsUpdate(); });
}

// =================== Galton board ===================
function tabGalton(ctx) {
  const { stage, panel } = ctx;
  const st = { n: 10, p: 0.5, exact: false, N: 0, counts: new Float64Array(41), balls: [], t: 0, ym: 4, vals: false };
  const DY = 0.866, TAU = 0.17;
  const w = new Welford();
  const geom = () => {
    const binH = Math.max(4, st.n * 0.7), top = 1.6;
    return { binH, top, y0: -st.n * DY - 0.3, y1: -st.n * DY - 0.3 - binH };
  };
  const setView = () => {
    const g = geom();
    plot.setHome({ x: [-st.n / 2 - 1.3, st.n / 2 + 1.3], y: [g.y1 - 0.4, g.top] });
  };
  const plot = new Plot(stage, {
    view: { x: [-6, 6], y: [-14, 2] }, equal: true, pan: false, zoom: false, axes: false, grid: false,
    draw: (p) => {
      const C = p.C, g = geom(), n = st.n;
      // bins
      const scale = g.binH / st.ym;
      for (let k = 0; k <= n; k++) {
        const x = k - n / 2, h = st.counts[k] * scale;
        if (h > 0) p.rect(x - 0.42, g.y1, x + 0.42, g.y1 + h, { fill: C.area, fillAlpha: 0.55 });
        if (st.exact) p.rect(x - 0.42, g.y1, x + 0.42, g.y1 + binomPmf(n, st.p, k) * Math.max(1, st.N) * scale, { color: C.approx, width: 2 });
      }
      for (let k = 0; k <= n + 1; k++) p.line(k - n / 2 - 0.5, g.y1, k - n / 2 - 0.5, g.y0, { color: C.line2, width: 1.2 });
      p.line(-n / 2 - 0.5, g.y1, n / 2 + 0.5, g.y1, { color: C.line2, width: 1.2 });
      // pegs
      for (let r = 0; r < n; r++) for (let j = 0; j <= r; j++) p.dot(j - r / 2, -r * DY, { r: Math.max(2, Math.min(4, 120 / n)), color: C.ink3 });
      // balls in flight
      for (const b of st.balls) {
        const u = b.u; const pos = ballPos(b, u, g);
        p.dot(pos[0], pos[1], { r: Math.max(3.5, Math.min(7, 150 / n)), color: C.approx });
      }
    },
  });
  function pegXY(r, j) { return [j - r / 2, -r * DY]; }
  function ballPos(b, u, g) {
    const n = st.n;
    if (u < 0) return [0, 0.9];
    const r = Math.floor(u), f = u - r;
    // positions at integer u: u=0 at peg row0; u=r at peg row r; u=n at bin top
    const at = (rr) => {
      if (rr < 0) return [0, 0.9];
      if (rr >= n) return [b.k - n / 2, g.y0 + 0.2];
      return pegXY(rr, b.js[rr]);
    };
    const A = at(r - 0), B = at(r + 1);
    const e = f * f * 0.6 + f * 0.4; // roughly accelerating
    return [A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * e + (r < n ? Math.sin(Math.PI * f) * 0.18 : 0)];
  }
  const newBall = (animate) => {
    const js = [0]; let j = 0;
    for (let r = 0; r < st.n; r++) { j += R.random() < st.p ? 1 : 0; js.push(j); }
    // js[r] is the peg index at row r (js[0]=0); bit r decides js[r+1]
    const b = { js, k: j, u: -0.3 };
    if (animate) st.balls.push(b); else land(b);
  };
  const land = (b) => { st.counts[b.k]++; st.N++; w.add(b.k); };
  const frame = (dt) => {
    const speedUp = 1 / TAU;
    for (const b of st.balls) b.u += dt * speedUp;
    st.balls = st.balls.filter((b) => { if (b.u >= st.n) { land(b); return false; } return true; });
    let m = 4; for (let k = 0; k <= st.n; k++) m = Math.max(m, st.counts[k]);
    if (st.exact) for (let k = 0; k <= st.n; k++) m = Math.max(m, binomPmf(st.n, st.p, k) * Math.max(1, st.N));
    st.ym = smooth(st.ym, m * 1.15, 0.15);
    plot.redraw(); readoutsUpdate();
  };
  const reset = () => { st.N = 0; st.counts.fill(0); st.balls = []; st.ym = 4; w.reset(); plot.redraw(); readoutsUpdate(); };
  const g0 = group(panel);
  slider(g0, { label: 'Rows $n$', min: 2, max: 20, step: 1, value: st.n, fmt: String, color: 'var(--c-area)', onInput: (v) => { st.n = v; reset(); setView(); } });
  slider(g0, { label: 'Probability of right $p$', min: 0, max: 1, step: 0.05, value: st.p, fmt: (v) => f2(v), color: 'var(--c-area)', onInput: (v) => { st.p = v; reset(); } });
  runner(ctx, g0, {
    step: (k, single) => {
      const room = Math.max(0, 70 - st.balls.length);
      const animCount = Math.min(k, room);
      for (let i = 0; i < animCount; i++) newBall(true);
      for (let i = animCount; i < Math.min(k, animCount + 50000); i++) newBall(false);
    },
    frame,
    reset,
  }, 2);
  const g1 = group(panel, 'Show');
  toggle(g1, { label: 'Exact $B(n,p)$', color: 'var(--c-approx)', onChange: (v) => { st.exact = v; plot.redraw(); } });
  toggle(g1, { label: 'Mean and variance', onChange: (v) => { st.vals = v; ro.hide(!v); readoutsUpdate(); } });
  const ro = readouts(g1, [{ key: 'N', label: 'Balls' }, { key: 'm', label: 'Sample mean' }, { key: 'mt', label: '$np$' }, { key: 'v', label: 'Sample variance' }, { key: 'vt', label: '$np(1-p)$' }]);
  ro.hide(true);
  function readoutsUpdate() {
    if (!st.vals) return;
    ro.set('N', String(st.N)); ro.set('m', st.N ? f2(w.mean, 3) : '—'); ro.set('mt', f2(st.n * st.p, 3));
    ro.set('v', w.n > 1 ? f2(w.sd ** 2, 3) : '—'); ro.set('vt', f2(st.n * st.p * (1 - st.p), 3));
  }
  ctx.onShow(() => { setView(); plot.redraw(); });
}

// =================== Normal ===================
function tabNormal(ctx) {
  const { stage, panel } = ctx;
  const FINE = 0.05, LO = 100, HI = 260, NF = Math.round((HI - LO) / FINE);
  const st = { mu: 170, sigma: 8, bw: 2, curve: false, vals: false, bands: false, fine: new Float64Array(NF), N: 0, last: NaN, ym: 0.05 };
  const w = new Welford();
  const bins = () => {
    const bw = st.bw, k0 = Math.floor((st.mu - 4.6 * st.sigma) / bw), k1 = Math.ceil((st.mu + 4.6 * st.sigma) / bw);
    const per = Math.round(bw / FINE), out = [];
    for (let k = k0; k < k1; k++) {
      const f0 = Math.round((k * bw - LO) / FINE); let s = 0;
      for (let i = f0; i < f0 + per; i++) if (i >= 0 && i < NF) s += st.fine[i];
      out.push([k * bw, (k + 1) * bw, s]);
    }
    return out;
  };
  const target = () => {
    let m = 0; for (const [, , c] of bins()) m = Math.max(m, c / Math.max(1, st.N) / st.bw);
    if (st.curve || st.N === 0) m = Math.max(m, normalPdf(st.mu, st.mu, st.sigma));
    return m * 1.18;
  };
  const view = () => ({ x: [st.mu - 4.6 * st.sigma, st.mu + 4.6 * st.sigma], y: [0, st.ym] });
  const plot = new Plot(stage, {
    view: view(), inset: { l: 62, b: 34, t: 14, r: 16 }, pin: true, pan: false, zoom: false, tickPx: 76, yLabel: 'frequency density', xLabel: 'height (cm)',
    draw: (p) => {
      const C = p.C, N = Math.max(1, st.N);
      if (st.bands) {
        for (const [k, a] of [[2, 0.07], [1, 0.1]]) p.fillBetween((x) => normalPdf(x, st.mu, st.sigma), 0, st.mu - k * st.sigma, st.mu + k * st.sigma, { color: C.tangent, alpha: a });
      }
      const bn = bins(), edge = p.x(st.bw) - p.x(0) > 5;
      for (const [x0, x1, c] of bn) {
        if (!c) continue;
        const hh = c / N / st.bw, last = st.last >= x0 && st.last < x1;
        p.rect(x0, 0, x1, hh, { fill: last ? C.tangent : C.area, fillAlpha: last ? 0.8 : 0.5, color: edge ? (last ? C.tangent : C.area) : undefined, width: 1 });
      }
      if (st.curve) p.curve((x) => normalPdf(x, st.mu, st.sigma), { color: C.approx, width: 3 });
      if (st.vals) {
        p.vline(st.mu, { color: C.approx, width: 1.6, dash: [6, 5] });
        if (st.N) p.vline(w.mean, { color: C.area, width: 1.6 });
      }
    },
  });
  const fit = (snap) => { const t = Math.max(target(), 1e-4); st.ym = snap ? t : smooth(st.ym, t, 0.18); plot.setHome(view()); };
  const reset = () => { st.fine.fill(0); st.N = 0; st.last = NaN; w.reset(); fit(true); plot.redraw(); readoutsUpdate(); };
  const g0 = group(panel);
  slider(g0, { label: 'Mean $\\mu$', min: 150, max: 190, step: 1, value: st.mu, fmt: (v) => v + ' cm', color: 'var(--c-area)', onInput: (v) => { st.mu = v; reset(); } });
  slider(g0, { label: 'Standard deviation $\\sigma$', min: 3, max: 15, step: 0.5, value: st.sigma, fmt: (v) => v + ' cm', color: 'var(--c-area)', onInput: (v) => { st.sigma = v; reset(); } });
  runner(ctx, g0, {
    step: (k) => {
      for (let i = 0; i < Math.min(k, 50000); i++) {
        const x = st.mu + st.sigma * R.normal();
        const f = Math.floor((x - LO) / FINE);
        if (f >= 0 && f < NF) st.fine[f]++;
        st.N++; w.add(x); st.last = x;
      }
      fit(); plot.redraw(); readoutsUpdate();
    },
    reset,
  });
  const g1 = group(panel, 'Show');
  toggle(g1, { label: 'Normal curve $N(\\mu,\\sigma^2)$', color: 'var(--c-approx)', onChange: (v) => { st.curve = v; fit(true); plot.redraw(); } });
  toggle(g1, { label: 'One and two $\\sigma$', color: 'var(--c-tangent)', onChange: (v) => { st.bands = v; plot.redraw(); } });
  toggle(g1, { label: 'Mean and standard deviation', onChange: (v) => { st.vals = v; ro.hide(!v); readoutsUpdate(); plot.redraw(); } });
  const ro = readouts(g1, [{ key: 'N', label: 'Heights' }, { key: 'm', label: 'Sample mean' }, { key: 'mt', label: '$\\mu$' }, { key: 's', label: 'Sample s.d.' }, { key: 'st', label: '$\\sigma$' }]);
  ro.hide(true);
  const g2 = group(panel);
  slider(g2, { label: 'Bin width', min: 0.5, max: 8, step: 0.5, value: st.bw, fmt: (v) => v + ' cm', onInput: (v) => { st.bw = v; fit(true); plot.redraw(); } });
  function readoutsUpdate() {
    if (!st.vals) return;
    ro.set('N', String(st.N)); ro.set('m', st.N ? f2(w.mean, 2) : '—'); ro.set('mt', f2(st.mu, 2));
    ro.set('s', w.n > 1 ? f2(w.sd, 2) : '—'); ro.set('st', f2(st.sigma, 2));
  }
  for (let i = 0; i < 40; i++) { const x = st.mu + st.sigma * R.normal(), f = Math.floor((x - LO) / FINE); if (f >= 0 && f < NF) st.fine[f]++; st.N++; w.add(x); st.last = x; }
  ctx.onShow(() => { fit(true); plot.redraw(); });
}

// =================== Sample means (CLT) ===================
const SOURCES = {
  uniform: { label: 'Uniform', mu: 0.5, sd: Math.sqrt(1 / 12), draw: () => R.random(), pdf: (x) => (x >= 0 && x <= 1 ? 1 : 0), view: [-0.2, 1.2], ymax: 1.5 },
  expo: { label: 'Exponential (skewed)', mu: 1, sd: 1, draw: () => R.exponential(), pdf: (x) => (x >= 0 ? Math.exp(-x) : 0), view: [-0.5, 6], ymax: 1.2 },
  die: { label: 'Fair die', mu: 3.5, sd: Math.sqrt(35 / 12), draw: () => 1 + R.int(6), pmf: (k) => (k >= 1 && k <= 6 ? 1 / 6 : 0), view: [0, 7], ymax: 0.3, discrete: true },
  coin: { label: 'Biased coin (0 or 1)', mu: 0.2, sd: 0.4, draw: () => R.bernoulli(0.2), pmf: (k) => (k === 1 ? 0.2 : k === 0 ? 0.8 : 0), view: [-0.6, 1.6], ymax: 1, discrete: true },
  twin: { label: 'Two-humped', mu: 0.5, sd: 0.35355339, draw: () => (R.random() < 0.5 ? 0.15 + 0.15 * (R.random() + R.random() - 1) * 0.5 : 0.85 + 0.15 * (R.random() + R.random() - 1) * 0.5), view: [-0.1, 1.1], ymax: 1, custom: true },
};
function tabMeans(ctx) {
  const { stage, panel } = ctx;
  stage.classList.add('col');
  const st = { key: 'expo', n: 10, curve: false, sample: true, vals: false, counts: null, N: 0, last: [], lastMean: NaN, ym: 1, NB: 44 };
  const src = () => SOURCES[st.key];
  // the 'twin' source: compute true mean/sd empirically once
  { const s = SOURCES.twin; let a = 0, b = 0; const M = 200000; for (let i = 0; i < M; i++) { const x = s.draw(); a += x; b += x * x; } s.mu = a / M; s.sd = Math.sqrt(b / M - s.mu ** 2); }
  const w = new Welford();
  const sdn = () => src().sd / Math.sqrt(st.n);
  const range = () => [src().mu - 4.2 * sdn(), src().mu + 4.2 * sdn()];
  const binW = () => { const r = range(); return (r[1] - r[0]) / st.NB; };
  const resetCounts = () => { st.counts = new Float64Array(st.NB); st.N = 0; st.last = []; st.lastMean = NaN; w.reset(); };
  resetCounts();

  const top = new Plot(stage, {
    view: { x: src().view, y: [0, 1] }, inset: { l: 62, b: 28, t: 10, r: 16 }, pin: true, pan: false, zoom: false, tickPx: 56, yTicks: 'none', yLabel: 'parent distribution',
    draw: (p) => {
      const C = p.C, s = src(), A = p.area;
      if (s.pdf) p.curve(s.pdf, { color: C.fn, width: 2.6 });
      if (s.pmf) { for (let k = Math.ceil(s.view[0]); k <= s.view[1]; k++) { const h = s.pmf(k); if (h > 0) p.rect(k - 0.35, 0, k + 0.35, h, { fill: C.fn, fillAlpha: 0.6 }); } }
      if (s.custom) { const hist = new Float64Array(60); for (let i = 0; i < 1; i++); p.curve((x) => twinPdf(x), { color: C.fn, width: 2.6 }); }
      p.vline(s.mu, { color: C.ink3, width: 1.3, dash: [5, 5] });
      if (st.sample && st.last.length) {
        st.last.forEach((x, i) => p.dot(x, 0, { r: 3.6, color: C.area, alpha: 0.75 }));
        if (Number.isFinite(st.lastMean)) { p.dot(st.lastMean, 0, { r: 6, color: C.tangent, ring: true }); }
      }
    },
  });
  const twinPdf = (x) => { // density of the two-humped source (sum of two triangles)
    const tri = (x, c, hw) => { const u = Math.abs(x - c) / hw; return u < 1 ? (1 - u) / hw : 0; };
    return 0.5 * tri(x, 0.15, 0.15) + 0.5 * tri(x, 0.85, 0.15);
  };
  const bot = new Plot(stage, {
    view: { x: range(), y: [0, 1] }, inset: { l: 62, b: 34, t: 14, r: 16 }, pin: true, pan: false, zoom: false, tickPx: 80, yLabel: 'frequency density', xLabel: 'sample mean',
    draw: (p) => {
      const C = p.C, bw = binW(), r = range(), N = Math.max(1, st.N);
      for (let k = 0; k < st.NB; k++) {
        const c = st.counts[k]; if (!c) continue;
        const x0 = r[0] + k * bw, h = c / N / bw, isLast = Number.isFinite(st.lastMean) && st.lastMean >= x0 && st.lastMean < x0 + bw;
        p.rect(x0, 0, x0 + bw, h, { fill: isLast ? C.tangent : C.area, fillAlpha: isLast ? 0.8 : 0.5, color: C.area, width: 0.8 });
      }
      if (st.curve) p.curve((x) => normalPdf(x, src().mu, sdn()), { color: C.approx, width: 3 });
      p.vline(src().mu, { color: C.ink3, width: 1.3, dash: [5, 5] });
      if (st.vals && st.N) p.vline(w.mean, { color: C.area, width: 1.6 });
    },
  });
  top.el.style.flex = '0 0 30%'; bot.el.style.flex = '1 1 70%';
  const fit = (snap) => {
    let m = 0; const bw = binW(), N = Math.max(1, st.N);
    for (let k = 0; k < st.NB; k++) m = Math.max(m, st.counts[k] / N / bw);
    if (st.curve || st.N === 0) m = Math.max(m, normalPdf(src().mu, src().mu, sdn()));
    m = Math.max(m * 1.18, 1e-3);
    st.ym = snap ? m : smooth(st.ym, m, 0.18);
    bot.setHome({ x: range(), y: [0, st.ym] });
  };
  const fitTop = () => {
    const s = src(); let m = 0;
    if (s.pdf) for (let x = s.view[0]; x <= s.view[1]; x += (s.view[1] - s.view[0]) / 400) m = Math.max(m, s.pdf(x));
    if (s.pmf) for (let k = Math.ceil(s.view[0]); k <= s.view[1]; k++) m = Math.max(m, s.pmf(k));
    if (s.custom) for (let x = 0; x <= 1; x += 0.002) m = Math.max(m, twinPdf(x));
    top.o.intTicks = !!s.discrete; top.o.tickPx = 90;
    top.setHome({ x: s.view, y: [0, m * 1.25] });
  };
  const reset = () => { resetCounts(); fit(true); fitTop(); top.redraw(); bot.redraw(); readoutsUpdate(); };

  const g0 = group(panel);
  dropdown(g0, { label: 'Parent distribution', options: Object.entries(SOURCES).map(([v, d]) => ({ value: v, label: d.label })), value: st.key, onChange: (v) => { st.key = v; reset(); } });
  slider(g0, { label: 'Sample size $n$', min: 1, max: 100, step: 1, value: st.n, fmt: String, color: 'var(--c-area)', onInput: (v) => { st.n = v; reset(); } });
  runner(ctx, g0, {
    step: (k, single) => {
      const s = src(), r = range(), bw = binW();
      for (let i = 0; i < Math.min(k, 20000); i++) {
        let sum = 0; const keep = single || i === k - 1;
        const xs = keep ? [] : null;
        for (let j = 0; j < st.n; j++) { const x = s.draw(); sum += x; if (keep) xs.push(x); }
        const m = sum / st.n;
        const b = Math.floor((m - r[0]) / bw);
        if (b >= 0 && b < st.NB) st.counts[b]++;
        st.N++; w.add(m); st.lastMean = m; if (keep) st.last = xs;
      }
      fit(); top.redraw(); bot.redraw(); readoutsUpdate();
    },
    reset,
  });
  const g1 = group(panel, 'Show');
  toggle(g1, { label: 'Normal curve $N\\!\\left(\\mu,\\tfrac{\\sigma^2}{n}\\right)$', color: 'var(--c-approx)', onChange: (v) => { st.curve = v; fit(true); bot.redraw(); } });
  toggle(g1, { label: 'Latest sample', checked: true, color: 'var(--c-area)', onChange: (v) => { st.sample = v; top.redraw(); } });
  toggle(g1, { label: 'Mean and standard deviation', onChange: (v) => { st.vals = v; ro.hide(!v); readoutsUpdate(); bot.redraw(); } });
  const ro = readouts(g1, [{ key: 'N', label: 'Samples' }, { key: 'm', label: 'Mean of means' }, { key: 'mt', label: '$\\mu$' }, { key: 's', label: 'Sample s.d.' }, { key: 'st', label: '$\\sigma/\\sqrt{n}$' }]);
  ro.hide(true);
  function readoutsUpdate() {
    if (!st.vals) return;
    ro.set('N', String(st.N)); ro.set('m', st.N ? f2(w.mean, 3) : '—'); ro.set('mt', f2(src().mu, 3));
    ro.set('s', w.n > 1 ? f2(w.sd, 3) : '—'); ro.set('st', f2(sdn(), 3));
  }
  ctx.onShow(() => { fit(true); fitTop(); top.redraw(); bot.redraw(); });
}

mountSim({
  title: 'Distributions',
  tabs: [
    { id: 'binomial', label: 'Binomial', init: tabBinomial },
    { id: 'galton', label: 'Galton board', init: tabGalton },
    { id: 'normal', label: 'Normal', init: tabNormal },
    { id: 'means', label: 'Sample means', init: tabMeans },
  ],
});
