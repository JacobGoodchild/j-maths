// The two 3D tabs: the hidden layer as a space of vectors, and gradient descent on a loss surface.
import { group, slider, toggle, dropdown, transport, readouts } from '../../assets/js/kit/ui.js';
import { fmtNum } from '../../assets/js/kit/plot.js';
import { loop } from '../../assets/js/kit/anim.js';
import { colors } from '../../assets/js/kit/theme.js';
import { makeRng } from '../../assets/js/kit/rng.js';
import { Scene3D, THREE, makeLabel } from '../../assets/js/kit/scene3d.js';
import { makeNet, forward, trainStep, evaluate, makeData, DATA, SURFACES, descend } from './nn.js';
import { overlayCard, note } from './main.js';

const hex = (c) => new THREE.Color(c);
const disc = () => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.beginPath(); g.arc(32, 32, 28, 0, 7); g.fill(); return new THREE.CanvasTexture(c); };
function axes(sc, L, names, zLow = 0) {
  const C = colors(), g = sc.static; sc.clear(g);
  const grid = new THREE.GridHelper(2 * Math.ceil(L), 2 * Math.ceil(L), hex(C.grid2), hex(C.grid)); grid.rotation.x = Math.PI / 2; grid.position.z = zLow; g.add(grid);
  for (const [b, i] of [[[L, 0, 0], 0], [[0, L, 0], 1], [[0, 0, L], 2]]) {
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...b.map((v) => (i === 2 && zLow === 0 && names[2] === 'L' ? 0 : -v))), new THREE.Vector3(...b)]), new THREE.LineBasicMaterial({ color: hex(C.axis), transparent: true, opacity: 0.7 })));
    const sp = makeLabel(names[i], C.ink2, 0.42); sp.position.set(...b.map((v) => v * 1.08)); g.add(sp);
  }
}

// =================== Tab 3: the hidden layer as 3D space ===================
export function tabHidden(ctx) {
  const { stage, panel } = ctx;
  const SC = 1.35, IN = 0.5, G = 24, NP = 260;
  let seed = 4;
  const st = { data: 'circle', m: 1, epoch: 0, sheet: true, plane: true, spin: true, eq: false };
  let D, net;
  const fresh = (pre) => { D = makeData(st.data, NP, makeRng([7, 7, 7, 7])); net = makeNet([2, 3, 1], makeRng([seed, 1, 2, 3])); st.epoch = 0; for (let i = 0; i < pre; i++) { trainStep(net, D.X, D.Y, 0.3, 0.9); st.epoch++; } };
  fresh(160);
  const sc = new Scene3D(stage, { up: [0, 0, 1], dir: [0.85, -1.0, 0.6] });
  const card = overlayCard(stage);
  const pGeo = new THREE.BufferGeometry(), pPos = new Float32Array(NP * 3), pCol = new Float32Array(NP * 3);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.13, vertexColors: true, map: disc(), alphaTest: 0.4, transparent: true })); pts.frustumCulled = false; sc.scene.add(pts);
  const NSEG = 2 * (G + 1) * G, sPos = new Float32Array(NSEG * 6), sGeo = new THREE.BufferGeometry(); sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  const sheet = new THREE.LineSegments(sGeo, new THREE.LineBasicMaterial({ transparent: true, opacity: 0.45 })); sheet.frustumCulled = false; sc.scene.add(sheet);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false })); sc.scene.add(plane);
  const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2 * SC, 2 * SC, 2 * SC)), new THREE.LineBasicMaterial({ transparent: true })); sc.scene.add(box);
  const map = (x, out, o) => { const h = forward(net, x)[1], m = st.m; out[o] = (1 - m) * x[0] * IN + m * h[0] * SC; out[o + 1] = (1 - m) * x[1] * IN + m * h[1] * SC; out[o + 2] = m * h[2] * SC; };
  function refresh() {
    const C = colors(), c1 = hex(C.fn), c0 = hex(C.approx);
    for (let s = 0; s < NP; s++) { map(D.X[s], pPos, 3 * s); const c = D.Y[s] ? c1 : c0; pCol[3 * s] = c.r; pCol[3 * s + 1] = c.g; pCol[3 * s + 2] = c.b; }
    pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
    let o = 0; const R = 3, u = (i) => -R + (2 * R * i) / G;
    for (let i = 0; i <= G; i++) for (let j = 0; j < G; j++) { map([u(i), u(j)], sPos, o); map([u(i), u(j + 1)], sPos, o + 3); map([u(j), u(i)], sPos, o + 6); map([u(j + 1), u(i)], sPos, o + 9); o += 12; }
    sGeo.attributes.position.needsUpdate = true; sheet.material.color = hex(C.ink3); sheet.visible = st.sheet;
    // the output neuron's dividing plane v.h + c = 0 in hidden space
    const v = net.W[1], n = new THREE.Vector3(v[0], v[1], v[2]), len = n.length() || 1; n.divideScalar(len);
    plane.position.copy(n).multiplyScalar((-net.b[1][0] / len) * SC); plane.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    plane.material.color = hex(C.aux); plane.material.opacity = 0.3 * st.m; plane.visible = st.plane && st.m > 0.02;
    box.material.color = hex(C.ink3); box.material.opacity = 0.5 * st.m; box.visible = st.m > 0.02;
    const e = evaluate(net, D.X, D.Y);
    ro.set('e', String(st.epoch)); ro.set('l', fmtNum(e.loss, 3)); ro.set('a', Math.round(e.acc * 100) + '%');
    card.show(st.eq, `\\mathbf{h}=\\tanh(W\\mathbf{x}+\\mathbf{b})\\in\\mathbb{R}^3,\\qquad \\hat y=\\sigma(\\mathbf{v}\\cdot\\mathbf{h}+c),\\qquad \\text{plane: }\\ \\mathbf{v}\\cdot\\mathbf{h}+c=0`);
    sc.dirty = true;
  }
  sc.applyTheme = () => { axes(sc, 1.9, ['h₁', 'h₂', 'h₃'], -SC); refresh(); };
  const g0 = group(panel);
  dropdown(g0, { label: 'Data', options: ['circle', 'xor', 'moons', 'line'].map((k) => ({ value: k, label: DATA[k].label })), value: st.data, onChange: (v) => { st.data = v; tr.set(false); fresh(160); refresh(); } });
  slider(g0, { label: 'Flat input → hidden space', min: 0, max: 1, step: 0.01, value: 1, color: 'var(--c-aux)', fmt: (v) => Math.round(v * 100) + '%', onInput: (v) => { st.m = v; refresh(); } });
  let acc = 0;
  const lp = loop((dt) => {
    if (tr.playing) { acc += dt * 60 * tr.speed.get(); let n = 0; while (acc >= 1 && n < 10) { acc -= 1; n++; trainStep(net, D.X, D.Y, 0.3, 0.9); st.epoch++; } if (acc > 2) acc = 0; refresh(); }
    if (st.spin) { sc.scene.rotation.z += dt * 0.2; sc.dirty = true; }
  });
  const tr = transport(g0, {
    onPlay: () => { acc = 0; },
    onStep: () => { trainStep(net, D.X, D.Y, 0.3, 0.9); st.epoch++; refresh(); },
    onReset: () => { tr.set(false); seed++; fresh(0); refresh(); },
    speed: { min: 0.25, max: 4, step: 0.25, value: 1, fmt: (v) => v.toFixed(2) + '×' },
  });
  const g1 = group(panel, 'Show');
  toggle(g1, { label: 'The input plane, bent', checked: true, onChange: (v) => { st.sheet = v; refresh(); } });
  toggle(g1, { label: 'Dividing plane', checked: true, color: 'var(--c-aux)', onChange: (v) => { st.plane = v; refresh(); } });
  toggle(g1, { label: 'Equation', onChange: (v) => { st.eq = v; refresh(); } });
  toggle(g1, { label: 'Turn slowly', checked: true, onChange: (v) => { st.spin = v; } });
  const ro = readouts(g1, [{ key: 'e', label: 'training steps' }, { key: 'l', label: 'loss' }, { key: 'a', label: 'points it gets right' }]);
  note(g1, 'Three hidden neurons turn each point (x₁, x₂) into a vector (h₁, h₂, h₃). The flat plane gets bent in 3D until one flat cut separates blue from orange. Press reset then play to watch it learn from scratch.');
  ctx.onHide(() => { tr.set(false); lp.stop(); sc.stop(); });
  ctx.onShow(() => { sc.start(); sc.applyTheme(); sc.resetCamera(3.1, new THREE.Vector3(0, 0, -0.1)); lp.start(); });
}

// =================== Tab 4: gradient descent on a loss surface ===================
export function tabDescent(ctx) {
  const { stage, panel } = ctx;
  const R = 2.2, G = 64, ZMAX = 2.1, NMAX = 150;
  const st = { key: 'valley', start: [...SURFACES.valley.start], lr: 0.3, mom: 0.8, k: 0, plain: true, momOn: true, arrow: true, eq: true };
  const S = () => SURFACES[st.key], raw = (x, y) => S().f(x, y) * S().zs, zOf = (x, y) => Math.min(ZMAX * 1.15, raw(x, y));
  const sc = new Scene3D(stage, { up: [0, 0, 1], dir: [0.55, -0.85, 1.0] });
  const card = overlayCard(stage);
  const surf = new THREE.Group(), dyn = new THREE.Group(); sc.scene.add(surf, dyn);
  function buildSurface() {
    const C = colors(); sc.clear(surf); axes(sc, 2.6, ['w₁', 'w₂', 'L']);
    const geo = new THREE.PlaneGeometry(2 * R, 2 * R, G, G), pos = geo.attributes.position, col = new Float32Array(pos.count * 3), lo = hex(C.fn), hi = hex(C.stage), c = new THREE.Color();
    let zmin = Infinity;
    for (let i = 0; i < pos.count; i++) { const z = raw(pos.getX(i), pos.getY(i)); pos.setZ(i, z); zmin = Math.min(zmin, z); }
    for (let i = 0; i < pos.count; i++) { c.copy(lo).lerp(hi, Math.sqrt(Math.min(1, Math.max(0, (pos.getZ(i) - zmin) / (ZMAX - zmin)))) * 0.85); col[3 * i] = c.r; col[3 * i + 1] = c.g; col[3 * i + 2] = c.b; }
    // the surface is cut off where it leaves the box (no flat shelf)
    const idx = geo.index.array, keep = [];
    for (let i = 0; i < idx.length; i += 3) if (pos.getZ(idx[i]) <= ZMAX && pos.getZ(idx[i + 1]) <= ZMAX && pos.getZ(idx[i + 2]) <= ZMAX) keep.push(idx[i], idx[i + 1], idx[i + 2]);
    geo.setIndex(keep);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
    surf.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.9, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })));
    const lines = [], n = 16, seg = (x0, y0, x1, y1) => { const z0 = raw(x0, y0), z1 = raw(x1, y1); if (z0 <= ZMAX && z1 <= ZMAX) lines.push(x0, y0, z0, x1, y1, z1); };
    for (let i = 0; i <= n; i++) for (let j = 0; j < G; j++) { const a = -R + (2 * R * i) / n, b0 = -R + (2 * R * j) / G, b1 = b0 + (2 * R) / G; seg(a, b0, a, b1); seg(b0, a, b1, a); }
    surf.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(lines), 3)), new THREE.LineBasicMaterial({ color: hex(C.ink), transparent: true, opacity: 0.22 })));
  }
  const paths = () => ({ p: descend(S(), st.start, st.lr, 0, NMAX), m: descend(S(), st.start, st.lr, st.mom, NMAX) });
  function drawPath(path, color, C) {
    const k = Math.min(st.k, path.length - 1), v = [];
    for (let i = 0; i <= k; i++) { const [x, y] = path[i]; v.push(new THREE.Vector3(Math.max(-R * 1.3, Math.min(R * 1.3, x)), Math.max(-R * 1.3, Math.min(R * 1.3, y)), zOf(x, y) + 0.025)); }
    if (v.length > 1) dyn.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(v, false, 'catmullrom', 0), Math.min(600, v.length * 6), 0.022, 6), new THREE.MeshBasicMaterial({ color: hex(color), depthTest: false, transparent: true }))).renderOrder = 5;
    const sg = new THREE.SphereGeometry(0.04, 10, 8);
    for (let i = 0; i < v.length - 1; i++) { const s = new THREE.Mesh(sg.clone(), new THREE.MeshBasicMaterial({ color: hex(color), depthTest: false, transparent: true })); s.renderOrder = 6; s.position.copy(v[i]); dyn.add(s); }
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.095, 20, 14), new THREE.MeshBasicMaterial({ color: hex(color), depthTest: false, transparent: true })); ball.renderOrder = 7; ball.position.copy(v[v.length - 1]); ball.position.z += 0.07; dyn.add(ball);
    return path[k];
  }
  function refresh() {
    const C = colors(), P = paths(); sc.clear(dyn);
    const start = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), new THREE.MeshBasicMaterial({ color: hex(C.ink) })); start.position.set(st.start[0], st.start[1], zOf(...st.start) + 0.03); dyn.add(start);
    let a = null, b = null;
    if (st.momOn) b = drawPath(P.m, C.area, C);
    if (st.plain) a = drawPath(P.p, C.approx, C);
    const at = a || b;
    if (st.arrow && at) {
      const g = S().grad(at[0], at[1]), m = Math.hypot(g[0], g[1]);
      if (m > 1e-6) { const d = new THREE.Vector3(-g[0], -g[1], -m * m * S().zs).normalize(), ah = new THREE.ArrowHelper(d, new THREE.Vector3(at[0], at[1], zOf(at[0], at[1]) + 0.1), 0.35 + 0.75 * Math.tanh(m / 2), hex(C.tangent), 0.2, 0.11); dyn.add(ah); }
    }
    const fin = (p) => (p ? fmtNum(S().f(p[0], p[1]), 4) : '–');
    ro.set('k', String(st.k)); ro.set('a', st.plain ? fin(P.p[Math.min(st.k, P.p.length - 1)]) : '–'); ro.set('b', st.momOn ? fin(P.m[Math.min(st.k, P.m.length - 1)]) : '–');
    card.show(st.eq, `\\begin{aligned}L(w_1,w_2)&=${S().tex}\\\\ \\mathbf{v}&\\leftarrow\\mu\\,\\mathbf{v}-\\eta\\,\\nabla L(\\mathbf{w}),\\qquad \\mathbf{w}\\leftarrow\\mathbf{w}+\\mathbf{v}\\end{aligned}`);
    sc.dirty = true;
  }
  sc.applyTheme = () => { buildSurface(); refresh(); };
  const g0 = group(panel);
  dropdown(g0, { label: 'Loss surface', options: Object.keys(SURFACES).map((k) => ({ value: k, label: SURFACES[k].label })), value: st.key, onChange: (v) => { st.key = v; st.start = [...S().start]; s1.set(st.start[0]); s2.set(st.start[1]); tr.set(false); st.k = 40; buildSurface(); refresh(); } });
  slider(g0, { label: 'Learning rate $\\eta$', min: 0.01, max: 1, step: 0.01, value: st.lr, color: 'var(--c-approx)', fmt: (v) => v.toFixed(2), onInput: (v) => { st.lr = v; refresh(); } });
  slider(g0, { label: 'Momentum $\\mu$', min: 0, max: 0.98, step: 0.01, value: st.mom, color: 'var(--c-area)', fmt: (v) => v.toFixed(2), onInput: (v) => { st.mom = v; refresh(); } });
  const s1 = slider(g0, { label: 'Start $w_1$', min: -2, max: 2, step: 0.02, value: st.start[0], fmt: (v) => fmtNum(v, 2), onInput: (v) => { st.start[0] = v; refresh(); } });
  const s2 = slider(g0, { label: 'Start $w_2$', min: -2, max: 2, step: 0.02, value: st.start[1], fmt: (v) => fmtNum(v, 2), onInput: (v) => { st.start[1] = v; refresh(); } });
  let acc = 0;
  const lp = loop((dt) => { acc += dt * 8 * tr.speed.get(); while (acc >= 1) { acc -= 1; st.k++; if (st.k >= NMAX) { tr.set(false); break; } } refresh(); });
  const tr = transport(g0, {
    onPlay: (on) => { if (on) { if (st.k >= NMAX) st.k = 0; acc = 0; lp.start(); } else lp.stop(); },
    onStep: () => { st.k = Math.min(NMAX, st.k + 1); refresh(); },
    onReset: () => { tr.set(false); st.k = 0; refresh(); },
    speed: { min: 0.25, max: 4, step: 0.25, value: 1, fmt: (v) => v.toFixed(2) + '×' },
  });
  const g1 = group(panel, 'Show');
  toggle(g1, { label: 'Plain gradient descent', checked: true, color: 'var(--c-approx)', onChange: (v) => { st.plain = v; refresh(); } });
  toggle(g1, { label: 'With momentum', checked: true, color: 'var(--c-area)', onChange: (v) => { st.momOn = v; refresh(); } });
  toggle(g1, { label: 'Downhill arrow $-\\nabla L$', checked: true, color: 'var(--c-tangent)', onChange: (v) => { st.arrow = v; refresh(); } });
  toggle(g1, { label: 'Equation', checked: true, onChange: (v) => { st.eq = v; refresh(); } });
  const ro = readouts(g1, [{ key: 'k', label: 'step' }, { key: 'a', label: 'loss, plain' }, { key: 'b', label: 'loss, momentum' }]);
  st.k = 40;
  ctx.onHide(() => { tr.set(false); sc.stop(); });
  ctx.onShow(() => { sc.start(); sc.applyTheme(); sc.resetCamera(3.5, new THREE.Vector3(0, 0, 0.5)); });
}
