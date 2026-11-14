// 2D plot helper: canvas with devicePixelRatio, axes, ticks, pan/zoom, draggable handles, drawing primitives.
import { h, clamp } from './dom.js';
import { colors, withAlpha, onThemeChange } from './theme.js';
import { scheduler } from './anim.js';

export const MINUS = '−';
export const fmtNum = (v, d = 2) => {
  if (Math.abs(v) < 0.5 * 10 ** -d) v = 0;
  const s = v.toFixed(d);
  return s.startsWith('-') ? MINUS + s.slice(1) : s;
};
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));

export function niceStep(raw) {
  const e = Math.floor(Math.log10(raw));
  const f = raw / 10 ** e;
  const m = f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10;
  return m * 10 ** e;
}
function piLabel(k, num, den) {
  // label for k * (num/den) * pi
  let n = k * num, d = den;
  if (n === 0) return '0';
  const g = gcd(n, d); n /= g; d /= g;
  const sign = n < 0 ? MINUS : '';
  n = Math.abs(n);
  const top = n === 1 ? 'π' : n + 'π';
  return sign + (d === 1 ? top : top + '/' + d);
}
const PI_STEPS = [[1, 12], [1, 6], [1, 4], [1, 2], [1, 1], [2, 1], [4, 1], [8, 1], [16, 1]];
const DEG_STEPS = [5, 10, 15, 30, 45, 90, 180, 360, 720, 1440];

const ALL = new Set();
if (typeof document !== 'undefined' && document.fonts) {
  Promise.all([document.fonts.load('500 12px "Instrument Sans"'), document.fonts.load('italic 500 13px "Newsreader"'), document.fonts.load('500 14px "Newsreader"')])
    .then(() => { for (const p of ALL) p.redraw(); }).catch(() => {});
}

export class Plot {
  constructor(host, o = {}) {
    this.o = Object.assign({ grid: true, axes: true, pan: true, zoom: true, equal: false, xTicks: 'auto', yTicks: 'auto',
      tickPx: 78, minScale: 0.08, maxScale: 60, numbers: true, view: { x: [-5, 5], y: [-5, 5] } }, o);
    this.host = host;
    this.el = h('div', { class: 'plot' });
    this.canvas = h('canvas');
    this.resetBtn = h('button', { class: 'plot-reset', type: 'button', title: 'Reset view', html: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8a5.5 5.5 0 1 0 1.8-4.1"/><path d="M2.3 2.2v3.3h3.3"/></svg>Reset view' });
    this.el.append(this.canvas, this.resetBtn);
    host.append(this.el);
    this.ctx = this.canvas.getContext('2d');
    this.w = 0; this.h = 0; this.dpr = 1;
    this.v = { cx: 0, cy: 0, sx: 1, sy: 1 };
    this.home = null;
    this.touched = false;
    this.handles = [];
    this.tween = 0;
    this.redraw = scheduler(() => this.draw());
    ALL.add(this);
    this.resetBtn.addEventListener('click', () => this.resetView());
    new ResizeObserver(() => this.resize()).observe(this.el);
    onThemeChange(() => this.redraw());
    this.kb = 0;
    this.bind();
    this.bindKeys();
  }

  // ---- coordinates ----
  get inset() { return Object.assign({ l: 0, r: 0, t: 0, b: 0 }, this.o.inset); }
  /** pixel centre and size of the drawing area (the canvas minus any inset) */
  get area() { const n = this.inset; return { x0: n.l, x1: this.w - n.r, y0: n.t, y1: this.h - n.b, cx: (n.l + this.w - n.r) / 2, cy: (n.t + this.h - n.b) / 2, w: this.w - n.l - n.r, h: this.h - n.t - n.b }; }
  x(wx) { return this.area.cx + (wx - this.v.cx) * this.v.sx; }
  y(wy) { return this.area.cy - (wy - this.v.cy) * this.v.sy; }
  ix(px) { return this.v.cx + (px - this.area.cx) / this.v.sx; }
  iy(py) { return this.v.cy - (py - this.area.cy) / this.v.sy; }
  get xmin() { return this.ix(this.area.x0); } get xmax() { return this.ix(this.area.x1); }
  get ymin() { return this.iy(this.area.y1); } get ymax() { return this.iy(this.area.y0); }

  // ---- layout ----
  fit() {
    if (this.o.fit) return this.o.fit(this, this.w, this.h);
    const { x, y } = this.o.view;
    const A = this.area;
    let sx = A.w / (x[1] - x[0]), sy = A.h / (y[1] - y[0]);
    if (this.o.equal) sx = sy = Math.min(sx, sy);
    return { cx: (x[0] + x[1]) / 2, cy: (y[0] + y[1]) / 2, sx, sy };
  }
  resize() {
    const r = this.el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    this.dpr = window.devicePixelRatio || 1;
    this.w = r.width; this.h = r.height;
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    this.home = this.fit();
    if (!this.touched) this.v = { ...this.home };
    this.o.onResize && this.o.onResize(this);
    this.draw();
  }
  setView(v) { Object.assign(this.v, v); this.redraw(); }
  /** Programmatically set the home view (e.g. when a function changes) and snap to it. */
  setHome(view) { this.o.view = view; this.touched = false; this.o.fit = this.o.fit; if (this.w) { this.home = this.fit(); this.v = { ...this.home }; this.redraw(); } }
  /** Smoothly move to a view {cx, cy, sx, sy}. */
  animateView(to, ms = 450, done) {
    cancelAnimationFrame(this.tween);
    const from = { ...this.v }, t0 = performance.now();
    const step = (t) => {
      const k = clamp((t - t0) / ms, 0, 1), e = 1 - (1 - k) ** 3;
      for (const key of ['cx', 'cy']) this.v[key] = from[key] + (to[key] - from[key]) * e;
      for (const key of ['sx', 'sy']) this.v[key] = Math.exp(Math.log(from[key]) + (Math.log(to[key]) - Math.log(from[key])) * e);
      this.draw();
      if (k < 1) this.tween = requestAnimationFrame(step); else { done && done(); this.o.onView && this.o.onView(this); }
    };
    this.tween = requestAnimationFrame(step);
  }
  resetView() {
    if (!this.home) return;
    this.animateView(this.home, 260, () => { this.touched = false; });
  }
  viewChanged() {
    const a = this.v, b = this.home;
    if (!b) return false;
    return Math.abs(a.sx / b.sx - 1) > 1e-3 || Math.abs(a.sy / b.sy - 1) > 1e-3 ||
      Math.abs(a.cx - b.cx) * a.sx > 1 || Math.abs(a.cy - b.cy) * a.sy > 1;
  }

  // ---- handles ----
  /** o: { get: () => [x, y], set: (x, y, e) => void, color, r, hit, visible, ring } */
  addHandle(o) { const hd = Object.assign({ r: 7, hit: 16, visible: () => true, cursor: 'grab' }, o); this.handles.push(hd); return hd; }
  hitHandle(px, py) {
    for (let i = this.handles.length - 1; i >= 0; i--) {
      const hd = this.handles[i];
      if (!hd.visible()) continue;
      const [x, y] = hd.get();
      if (Math.hypot(this.x(x) - px, this.y(y) - py) <= hd.hit) return hd;
    }
    return null;
  }

  bind() {
    const c = this.canvas;
    let drag = null;
    const pos = (e) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const touches = new Map(); let pinch = null;
    c.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const [px, py] = pos(e);
      if (e.pointerType === 'touch' && this.o.zoom) {
        touches.set(e.pointerId, [px, py]);
        if (touches.size === 2) {
          if (drag && drag.type === 'h') { drag.hd.active = false; drag.hd.onEnd && drag.hd.onEnd(); }
          drag = null;
          const [a, b] = [...touches.values()];
          pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2 };
          c.setPointerCapture(e.pointerId);
          return;
        }
      }
      const hd = this.hitHandle(px, py);
      c.setPointerCapture(e.pointerId);
      if (hd) {
        const [hx, hy] = hd.get();
        drag = { type: 'h', hd, ox: this.x(hx) - px, oy: this.y(hy) - py };
        hd.active = true; hd.onStart && hd.onStart();
        c.style.cursor = 'grabbing';
      } else if (this.o.pan) {
        drag = { type: 'pan', px, py, cx: this.v.cx, cy: this.v.cy };
        c.style.cursor = 'grabbing';
      }
      this.redraw();
    });
    c.addEventListener('pointermove', (e) => {
      const [px, py] = pos(e);
      if (pinch && touches.has(e.pointerId)) {
        touches.set(e.pointerId, [px, py]);
        const [a, b] = [...touches.values()];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        this.zoomAt(mx, my, d / pinch.d);
        if (this.o.pan) { if (!this.o.lockX) this.v.cx -= (mx - pinch.mx) / this.v.sx; if (!this.o.lockY) this.v.cy += (my - pinch.my) / this.v.sy; }
        pinch = { d, mx, my };
        this.redraw();
        return;
      }
      if (!drag) {
        const hd = this.hitHandle(px, py);
        const hv = hd || null;
        if (hv !== this.hover) { this.hover = hv; this.redraw(); }
        c.style.cursor = hd ? hd.cursor : '';
        return;
      }
      if (drag.type === 'h') drag.hd.set(this.ix(px + drag.ox), this.iy(py + drag.oy), e);
      else {
        if (!this.o.lockX) this.v.cx = drag.cx - (px - drag.px) / this.v.sx;
        if (!this.o.lockY) this.v.cy = drag.cy + (py - drag.py) / this.v.sy;
        this.touched = true; this.o.onView && this.o.onView(this);
      }
      this.redraw();
    });
    const end = (e) => {
      if (touches.delete(e.pointerId) && touches.size < 2) pinch = null;
      if (!drag) return;
      if (drag.type === 'h') { drag.hd.active = false; drag.hd.onEnd && drag.hd.onEnd(); }
      drag = null; c.style.cursor = ''; this.redraw();
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('dblclick', (e) => { if (!this.hitHandle(...pos(e))) this.resetView(); });
    c.addEventListener('wheel', (e) => {
      if (!this.o.zoom) return;
      e.preventDefault();
      const [px, py] = pos(e);
      const f = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015) * (e.ctrlKey ? 3 : 1));
      this.zoomAt(px, py, f);
    }, { passive: false });
  }
  bindKeys() {
    const c = this.canvas;
    c.tabIndex = 0;
    c.setAttribute('role', 'application');
    c.setAttribute('aria-label', this.o.label || 'Interactive graph. Arrow keys move the selected point, Enter selects the next point, plus and minus zoom.');
    c.addEventListener('focus', () => { this.focused = true; this.redraw(); });
    c.addEventListener('blur', () => { this.focused = false; this.redraw(); });
    c.addEventListener('keydown', (e) => {
      const vis = this.handles.filter((hd) => hd.visible());
      const hd = vis[this.kb % Math.max(1, vis.length)];
      const step = (e.shiftKey ? 24 : 6);
      const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
      if (arrows[e.key] && hd) {
        e.preventDefault();
        const [x, y] = hd.get(), [dx, dy] = arrows[e.key];
        hd.set(x + (dx * step) / this.v.sx, y + (dy * step) / this.v.sy, e);
        this.redraw();
      } else if ((e.key === 'Enter' || e.key === ' ') && vis.length > 1) {
        e.preventDefault(); this.kb = (this.kb + 1) % vis.length; this.redraw();
      } else if (e.key === '+' || e.key === '=' || e.key === '-') {
        if (!this.o.zoom) return;
        e.preventDefault(); this.zoomAt(this.area.cx, this.area.cy, e.key === '-' ? 0.85 : 1 / 0.85);
      } else if (e.key === '0' || e.key === 'Escape') { this.resetView(); }
    });
  }
  zoomAt(px, py, f) {
    const wx = this.ix(px), wy = this.iy(py), b = this.home;
    const lim = (s, hs) => clamp(s * f, hs * this.o.minScale, hs * this.o.maxScale) / s;
    let fx = this.o.lockX ? 1 : lim(this.v.sx, b.sx), fy = this.o.lockY ? 1 : lim(this.v.sy, b.sy);
    if (this.o.equal) fx = fy = Math.abs(fx - 1) < Math.abs(fy - 1) ? (fx === 1 ? fy : fx) : fy;
    this.v.sx *= fx; this.v.sy *= fy;
    this.v.cx = wx - (px - this.area.cx) / this.v.sx;
    this.v.cy = wy + (py - this.area.cy) / this.v.sy;
    this.touched = true;
    this.o.onView && this.o.onView(this);
    this.redraw();
  }

  // ---- drawing ----
  draw() {
    if (!this.w) return;
    const { ctx, dpr } = this;
    this.C = colors();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (this.o.drawBack) this.o.drawBack(this, ctx);
    this.drawAxes();
    const A = this.area, inset = !!this.o.inset;
    if (inset) { ctx.save(); ctx.beginPath(); ctx.rect(A.x0, A.y0, A.w, A.h); ctx.clip(); }
    if (this.o.draw) this.o.draw(this, ctx);
    if (inset) ctx.restore();
    this.drawHandles();
    this.resetBtn.classList.toggle('on', (this.o.pan || this.o.zoom) && this.viewChanged());
  }

  ticks(axis) {
    const mode = axis === 'x' ? this.o.xTicks : this.o.yTicks;
    const s = axis === 'x' ? this.v.sx : this.v.sy;
    const lo = axis === 'x' ? this.xmin : this.ymin, hi = axis === 'x' ? this.xmax : this.ymax;
    const out = [];
    const sg = axis === 'y' && this.o.yFlip ? -1 : 1;
    if (mode === 'none') return out;
    if (mode === 'log') {
      for (let k = Math.ceil(lo - 1e-9); k <= hi + 1e-9; k++) out.push({ v: k, label: k >= 0 ? String(10 ** k) : String(+(10 ** k).toFixed(-k)) });
      return out;
    }
    if (mode === 'pi' || mode === 'deg') {
      if (mode === 'pi') {
        const st = PI_STEPS.find(([n, d]) => (n / d) * Math.PI * s >= this.o.tickPx * 0.8) || PI_STEPS[PI_STEPS.length - 1];
        const step = (st[0] / st[1]) * Math.PI;
        for (let k = Math.ceil(lo / step - 1e-9); k * step <= hi + 1e-9; k++) out.push({ v: k * step, label: piLabel(sg * k, st[0], st[1]) });
      } else {
        const stDeg = DEG_STEPS.find((d) => ((d * Math.PI) / 180) * s >= this.o.tickPx * 0.8) || 1440;
        const step = (stDeg * Math.PI) / 180;
        for (let k = Math.ceil(lo / step - 1e-9); k * step <= hi + 1e-9; k++) out.push({ v: k * step, label: (k === 0 ? '0' : (sg * k < 0 ? MINUS : '') + Math.abs(k * stDeg) + '°') });
      }
      return out;
    }
    let step = niceStep(this.o.tickPx / s);
    if (this.o.intTicks && axis === 'x') step = Math.max(1, step);
    const dec = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
    for (let k = Math.ceil(lo / step - 1e-9); k * step <= hi + 1e-9; k++) {
      const v = k * step;
      out.push({ v, label: Math.abs(v) >= 1e6 || (v !== 0 && Math.abs(v) < 1e-4) ? v.toExponential(0).replace('-', MINUS) : fmtNum(sg * v, dec) });
    }
    return out;
  }

  drawAxes() {
    const { ctx, C, h } = this;
    const xt = this.ticks('x'), yt = this.ticks('y');
    const A = this.area;
    const x0 = this.o.pin ? A.x0 : clamp(this.x(0), A.x0, A.x1), y0 = this.o.pin ? A.y1 : clamp(this.y(0), A.y0, A.y1);
    if (this.o.grid) {
      ctx.lineWidth = 1; ctx.strokeStyle = C.grid; ctx.beginPath();
      for (const t of xt) { const px = Math.round(this.x(t.v)) + 0.5; ctx.moveTo(px, A.y0); ctx.lineTo(px, A.y1); }
      for (const t of yt) { const py = Math.round(this.y(t.v)) + 0.5; ctx.moveTo(A.x0, py); ctx.lineTo(A.x1, py); }
      ctx.stroke();
    }
    if (!this.o.axes) return;
    ctx.strokeStyle = C.axis; ctx.lineWidth = 1.4; ctx.beginPath();
    if (this.o.xAxis !== false) { ctx.moveTo(A.x0, y0); ctx.lineTo(A.x1, y0); }
    if (this.o.yAxis !== false) { ctx.moveTo(x0, A.y0); ctx.lineTo(x0, A.y1); }
    ctx.stroke();
    if (!this.o.numbers) return;
    ctx.font = '12px "Instrument Sans", system-ui, sans-serif';
    ctx.fillStyle = C.ink3;
    const below = y0 < h - 22 || !!this.o.pin;
    for (const t of xt) {
      if (this.o.xAxis === false) break;
      const px = this.x(t.v);
      if (!this.o.pin && Math.abs(t.v) < 1e-9 * Math.max(1, Math.abs(this.xmax))) continue;
      if (px < A.x0 - 1 || px > A.x1 + 1) continue;
      this.text(t.label, px, below ? y0 + 6 : y0 - 6, { align: 'center', base: below ? 'top' : 'bottom', color: C.ink3, size: 12 });
    }
    const right = x0 > 34 || !!this.o.pin;
    for (const t of yt) {
      if (this.o.yAxis === false) break;
      if (!this.o.pin && Math.abs(t.v) < 1e-9 * Math.max(1, Math.abs(this.ymax))) continue;
      const py = this.y(t.v);
      if (py < A.y0 + 11 || py > A.y1 - 11) continue;
      this.text(t.label, right ? x0 - 7 : x0 + 7, py, { align: right ? 'right' : 'left', base: 'middle', color: C.ink3, size: 12 });
    }
    if (!this.o.pin && xt.some((t) => t.v === 0) && yt.some((t) => t.v === 0) || (this.o.xTicks !== 'auto' && this.o.originLabel))
      this.text('0', x0 - 7, y0 + 6, { align: 'right', base: 'top', color: C.ink3, size: 12 });
    if (this.o.xLabel) this.text(this.o.xLabel, A.x1 - 8, y0 - 8, { align: 'right', base: 'bottom', color: C.ink2, size: 13, italic: true });
    if (this.o.yLabel) this.text(this.o.yLabel, x0 + 10, A.y0 + 8, { align: 'left', base: 'top', color: C.ink2, size: 13, italic: true });
  }

  drawHandles() {
    const { ctx, C } = this;
    for (const hd of this.handles) {
      if (!hd.visible()) continue;
      const [x, y] = hd.get();
      const px = this.x(x), py = this.y(y);
      const hot = hd.active || this.hover === hd;
      const r = hd.r + (hot ? 2 : 0);
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = hot ? 8 : 4; ctx.shadowOffsetY = 1;
      ctx.beginPath(); ctx.arc(px, py, r + 2, 0, 6.2832); ctx.fillStyle = C.halo; ctx.fill();
      ctx.restore();
      ctx.beginPath(); ctx.arc(px, py, r, 0, 6.2832); ctx.fillStyle = (typeof hd.color === 'function' ? hd.color(C) : hd.color) || C.fn; ctx.fill();
      if (this.focused && this.handles.filter((q) => q.visible())[this.kb % Math.max(1, this.handles.filter((q) => q.visible()).length)] === hd) {
        ctx.beginPath(); ctx.arc(px, py, r + 5, 0, 6.2832); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
      }
    }
  }

  // ---- primitives (world coordinates in, pixel styling) ----
  _style(o, kind) {
    const { ctx, C } = this;
    ctx.globalAlpha = o.alpha ?? 1;
    ctx.setLineDash(o.dash || []);
    if (kind === 'stroke') { ctx.strokeStyle = o.color || C.ink; ctx.lineWidth = o.width ?? 2; }
    else ctx.fillStyle = o.color || C.ink;
  }
  _done() { this.ctx.globalAlpha = 1; this.ctx.setLineDash([]); }

  line(x1, y1, x2, y2, o = {}) {
    const { ctx } = this; this._style(o, 'stroke');
    ctx.beginPath(); ctx.moveTo(this.x(x1), this.y(y1)); ctx.lineTo(this.x(x2), this.y(y2)); ctx.stroke(); this._done();
  }
  /** Line in pixel coordinates */
  linepx(x1, y1, x2, y2, o = {}) {
    const { ctx } = this; this._style(o, 'stroke');
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); this._done();
  }
  /** Infinite line through (x,y) with slope m, clipped to view */
  slopeLine(x, y, m, o = {}) {
    const a = this.xmin, b = this.xmax;
    this.line(a, y + m * (a - x), b, y + m * (b - x), o);
  }
  vline(x, o = {}) { this.line(x, this.ymin, x, this.ymax, o); }
  hline(y, o = {}) { this.line(this.xmin, y, this.xmax, y, o); }
  poly(pts, o = {}) {
    const { ctx } = this;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(this.x(x), this.y(y)) : ctx.moveTo(this.x(x), this.y(y))));
    if (o.close) ctx.closePath();
    if (o.fill) { this._style({ ...o, color: o.fill, alpha: o.fillAlpha ?? o.alpha }, 'fill'); ctx.fill(); }
    if (o.color) { this._style(o, 'stroke'); ctx.stroke(); }
    this._done();
  }
  dot(x, y, o = {}) {
    const { ctx } = this;
    ctx.beginPath(); ctx.arc(this.x(x), this.y(y), o.r ?? 4, 0, 6.2832);
    if (o.ring) { ctx.fillStyle = this.C.halo; ctx.fill(); this._style({ ...o, width: o.width ?? 2 }, 'stroke'); ctx.stroke(); }
    else { this._style(o, 'fill'); ctx.fill(); }
    this._done();
  }
  circle(cx, cy, r, o = {}) {
    const { ctx } = this;
    ctx.beginPath(); ctx.ellipse(this.x(cx), this.y(cy), r * this.v.sx, r * this.v.sy, 0, 0, 6.283185307179586);
    if (o.fill) { this._style({ ...o, color: o.fill, alpha: o.fillAlpha ?? o.alpha }, 'fill'); ctx.fill(); }
    if (o.color) { this._style(o, 'stroke'); ctx.stroke(); }
    this._done();
  }
  arc(cx, cy, r, a0, a1, o = {}) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.ellipse(this.x(cx), this.y(cy), r * this.v.sx, r * this.v.sy, 0, -a0, -a1, a1 > a0);
    if (o.fill) { this._style({ ...o, color: o.fill, alpha: o.fillAlpha ?? o.alpha }, 'fill'); ctx.fill(); }
    if (o.color) { this._style(o, 'stroke'); ctx.stroke(); }
    this._done();
  }
  /** Pie sector from angle a0 to a1 (radians, anticlockwise on screen) */
  sector(cx, cy, r, a0, a1, o = {}) {
    const { ctx } = this;
    ctx.beginPath(); ctx.moveTo(this.x(cx), this.y(cy));
    ctx.ellipse(this.x(cx), this.y(cy), r * this.v.sx, r * this.v.sy, 0, -a0, -a1, a1 > a0);
    ctx.closePath();
    this._style({ ...o, color: o.fill || o.color }, 'fill'); ctx.fill(); this._done();
  }
  arrow(x1, y1, x2, y2, o = {}) {
    const { ctx } = this;
    const ax = this.x(x1), ay = this.y(y1), bx = this.x(x2), by = this.y(y2);
    const L = Math.hypot(bx - ax, by - ay); if (L < 1) return;
    const ux = (bx - ax) / L, uy = (by - ay) / L, hl = Math.min(o.head ?? 11, L * 0.6), hw = hl * 0.45;
    this._style(o, 'stroke');
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx - ux * hl * 0.8, by - uy * hl * 0.8); ctx.stroke();
    ctx.fillStyle = o.color || this.C.ink; ctx.beginPath();
    ctx.moveTo(bx, by); ctx.lineTo(bx - ux * hl - uy * hw, by - uy * hl + ux * hw); ctx.lineTo(bx - ux * hl + uy * hw, by - uy * hl - ux * hw);
    ctx.closePath(); ctx.fill(); this._done();
  }
  /** Text at world position (wx, wy) plus pixel offset (dx, dy). */
  label(str, wx, wy, o = {}) { this.text(str, this.x(wx) + (o.dx || 0), this.y(wy) + (o.dy || 0), o); }
  /** Text at pixel position. */
  text(str, px, py, o = {}) {
    const { ctx, C } = this;
    ctx.font = `${o.italic ? 'italic ' : ''}${o.weight || 500} ${o.size || 13}px ${o.serif ? '"Newsreader", Georgia, serif' : '"Instrument Sans", system-ui, sans-serif'}`;
    ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.base || 'middle';
    if (o.halo !== false) { ctx.lineWidth = 3.5; ctx.strokeStyle = C.halo; ctx.lineJoin = 'round'; ctx.strokeText(str, px, py); }
    ctx.fillStyle = o.color || C.ink; ctx.fillText(str, px, py);
  }

  /** Smooth curve y = fn(x). Breaks at asymptotes and non-finite values. */
  curve(fn, o = {}) {
    const { ctx } = this;
    const a = Math.max(o.from ?? -Infinity, this.xmin), b = Math.min(o.to ?? Infinity, this.xmax);
    if (!(b > a)) return;
    const pa = this.x(a), pb = this.x(b);
    const n = Math.max(2, Math.ceil((pb - pa) / (o.step || 1.2)));
    const lim = this.h * 8;
    this._style({ width: 2.4, ...o }, 'stroke');
    ctx.beginPath();
    let pen = false, py0 = 0, dy0 = 0;
    for (let i = 0; i <= n; i++) {
      const x = a + ((b - a) * i) / n, y = fn(x);
      if (!Number.isFinite(y)) { pen = false; continue; }
      const py = clamp(this.y(y), -lim, this.h + lim), px = this.x(x);
      if (pen) {
        const d = py - py0;
        if (Math.abs(d) > this.h * 1.5 && (dy0 === 0 || Math.sign(d) !== Math.sign(dy0))) { pen = false; }
        else dy0 = d;
      }
      if (pen) ctx.lineTo(px, py); else { ctx.moveTo(px, py); dy0 = 0; }
      pen = true; py0 = py;
    }
    ctx.stroke(); this._done();
  }
  /** Parametric curve [x(t), y(t)] */
  param(fn, t0, t1, o = {}) {
    const { ctx } = this; this._style({ width: 2.4, ...o }, 'stroke');
    const n = o.n || 400; ctx.beginPath();
    for (let i = 0; i <= n; i++) { const [x, y] = fn(t0 + ((t1 - t0) * i) / n); i ? ctx.lineTo(this.x(x), this.y(y)) : ctx.moveTo(this.x(x), this.y(y)); }
    ctx.stroke(); this._done();
  }
  /** Fill between y = f(x) and y = g(x) on [a, b]. g may be a number. */
  fillBetween(f, g, a, b, o = {}) {
    const { ctx } = this;
    const gg = typeof g === 'number' ? () => g : g;
    a = Math.max(a, this.xmin); b = Math.min(b, this.xmax);
    if (!(b > a)) return;
    const n = Math.max(2, Math.ceil((this.x(b) - this.x(a)) / (o.step || 2)));
    const lim = this.h * 6;
    this._style({ color: o.color, alpha: o.alpha ?? 0.25 }, 'fill');
    let top = [], bot = [];
    const flush = () => {
      if (top.length > 1) {
        ctx.beginPath(); ctx.moveTo(...top[0]);
        for (const p of top) ctx.lineTo(...p);
        for (let i = bot.length - 1; i >= 0; i--) ctx.lineTo(...bot[i]);
        ctx.closePath(); ctx.fill();
      }
      top = []; bot = [];
    };
    for (let i = 0; i <= n; i++) {
      const x = a + ((b - a) * i) / n, y1 = f(x), y2 = gg(x);
      if (!Number.isFinite(y1) || !Number.isFinite(y2)) { flush(); continue; }
      const px = this.x(x);
      top.push([px, clamp(this.y(y1), -lim, this.h + lim)]); bot.push([px, clamp(this.y(y2), -lim, this.h + lim)]);
    }
    flush(); this._done();
  }
  rect(x1, y1, x2, y2, o = {}) {
    const { ctx } = this;
    const px = this.x(Math.min(x1, x2)), py = this.y(Math.max(y1, y2));
    const pw = Math.abs(this.x(x2) - this.x(x1)), ph = Math.abs(this.y(y2) - this.y(y1));
    if (o.fill) { this._style({ color: o.fill, alpha: o.fillAlpha ?? o.alpha ?? 1 }, 'fill'); ctx.fillRect(px, py, pw, ph); }
    if (o.color) { this._style(o, 'stroke'); ctx.strokeRect(px, py, pw, ph); }
    this._done();
  }
}
export { withAlpha };
