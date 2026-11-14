// 3D tab: a 3 x 3 matrix acting on the unit cube.
import { group, slider, toggle, segmented, dropdown, transport, readouts } from '../../assets/js/kit/ui.js';
import { renderTex, renderRich } from '../../assets/js/kit/tex.js';
import { loop } from '../../assets/js/kit/anim.js';
import { colors } from '../../assets/js/kit/theme.js';
import { Scene3D, THREE, makeLabel } from '../../assets/js/kit/scene3d.js';
import { I3, det3, apply3, lerp3, eigen3, PRESETS3, preset3, preset3At } from './mat.js';

const tn = (v) => { const s = (Math.abs(v) < 5e-3 ? 0 : v).toFixed(2).replace(/\.?0+$/, ''); return s === '-0' ? '0' : s; };
const hex = (c) => new THREE.Color(c);
const CORNERS = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
const FACES = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [3, 0, 4, 7]];
const EDGES = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];

/** A solid arrow (cylinder shaft + cone head) from the origin along v, drawn on top of the cube. */
function arrow3(v, color) {
  const len = v.length(), head = Math.min(0.3, len * 0.4), rad = 0.028;
  const g = new THREE.Group(), dir = v.clone().normalize();
  const mat = () => new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, Math.max(0.001, len - head), 10), mat()); shaft.position.y = (len - head) / 2;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(rad * 3, head, 14), mat()); cone.position.y = len - head / 2;
  for (const m of [shaft, cone]) { m.renderOrder = 10; g.add(m); }
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  return g;
}

export function tabCube(ctx) {
  const { stage, panel } = ctx;
  const st = { M: [...I3], key: 'identity', p: null, dir: 'x', t: 1, custom: false, matrix: true, det: false, eig: false, ghost: true, vecs: true };
  const sc = new Scene3D(stage, { up: [0, 0, 1], dir: [0.8, -1.0, 0.65] });
  sc.extent = 3.2; sc.target.set(0.6, 0.6, 0.6);
  const root = new THREE.Group(); sc.scene.add(root);
  const dyn = new THREE.Group(); root.add(dyn);

  // overlay card
  const overlay = document.createElement('div'); overlay.className = 'sim-overlay';
  const card = document.createElement('div'); card.className = 'card-f'; overlay.append(card); stage.append(overlay);

  // ---- static scene: axes, floor grid ----
  function buildStatic() {
    const C = colors(), g = sc.static; sc.clear(g);
    const grid = new THREE.GridHelper(10, 10, hex(C.grid2), hex(C.grid)); grid.rotation.x = Math.PI / 2; g.add(grid);
    const L = 4.5;
    for (const [a, b, name] of [[[-L, 0, 0], [L, 0, 0], 'x'], [[0, -L, 0], [0, L, 0], 'y'], [[0, 0, -L], [0, 0, L], 'z']]) {
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)]), new THREE.LineBasicMaterial({ color: hex(C.axis) })));
      const sp = makeLabel(name, C.ink2, 0.6); sp.position.set(...b.map((v) => v * 1.05)); g.add(sp);
    }
    sc.dirty = true;
  }
  sc.applyTheme = () => { buildStatic(); rebuild(); };

  // ---- dynamic: ghost cube, transformed cube, basis arrows, eigen lines ----
  function cur() { return st.t >= 1 ? st.M : st.custom ? lerp3(I3, st.M, st.t) : preset3At(st.key, st.p, st.dir, st.t); }
  function rebuild() {
    const C = colors(), m = cur(), D = det3(m), neg = D < 0;
    sc.clear(dyn);
    // ghost unit cube
    if (st.ghost) {
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1).translate(0.5, 0.5, 0.5)), new THREE.LineBasicMaterial({ color: hex(C.ink3), transparent: true, opacity: 0.8 }));
      dyn.add(e);
    }
    // transformed cube
    const V = CORNERS.map((c) => apply3(m, ...c));
    const pos = [], idx = [];
    FACES.forEach((f, k) => { f.forEach((vi) => pos.push(...V[vi])); idx.push(k * 4, k * 4 + 1, k * 4 + 2, k * 4, k * 4 + 2, k * 4 + 3); });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const col = neg ? C.error : C.area;
    dyn.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: hex(col), side: THREE.DoubleSide, transparent: true, opacity: 0.45, depthWrite: false, roughness: 0.6 })));
    const eg = new THREE.BufferGeometry().setFromPoints(EDGES.flatMap(([a, b]) => [new THREE.Vector3(...V[a]), new THREE.Vector3(...V[b])]));
    dyn.add(new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: hex(col) })));
    // basis vector images
    if (st.vecs) [[0, C.fn], [1, C.approx], [2, C.tangent]].forEach(([k, c]) => {
      const v = new THREE.Vector3(m[k], m[3 + k], m[6 + k]), len = v.length();
      if (len < 1e-4) return;
      dyn.add(arrow3(v, hex(c)));
    });
    // eigenvectors
    if (st.eig) for (const e of eigen3(m)) {
      if (e.vec) {
        const a = new THREE.Vector3(...e.vec).multiplyScalar(5.5);
        dyn.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a.clone().negate(), a]), new THREE.LineDashedMaterial({ color: hex(C.aux), dashSize: 0.25, gapSize: 0.18 })).computeLineDistances());
      } else {
        // a whole plane of eigenvectors: its normal is a non-zero row of (M - lambda I)
        const B = m.slice(); B[0] -= e.value; B[4] -= e.value; B[8] -= e.value;
        const rows = [[B[0], B[1], B[2]], [B[3], B[4], B[5]], [B[6], B[7], B[8]]].map((r) => new THREE.Vector3(...r));
        const n = rows.reduce((a, b) => (b.length() > a.length() ? b : a));
        if (n.length() > 1e-7) {
          const pl = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshBasicMaterial({ color: hex(C.aux), transparent: true, opacity: 0.09, side: THREE.DoubleSide, depthWrite: false }));
          pl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n.normalize()); dyn.add(pl);
        }
      }
    }
    sc.dirty = true;
    // card, readouts
    card.hidden = !st.matrix; overlay.hidden = !st.matrix;
    if (st.matrix) {
      const row = (r) => `${tn(m[r * 3])}&${tn(m[r * 3 + 1])}&${tn(m[r * 3 + 2])}`;
      renderTex(card, `\\mathbf{M}=\\begin{pmatrix}${row(0)}\\\\${row(1)}\\\\${row(2)}\\end{pmatrix}` + (st.det ? `,\\quad \\det\\mathbf{M}=${tn(D)}` : ''));
    }
    ro.el.hidden = !st.eig;
    if (st.eig) {
      const es = eigen3(m);
      for (let i = 0; i < 3; i++) ro.set('l' + i, es[i] ? tn(es[i].value) + (es[i].vec ? '' : ' (plane)') : i === 0 ? 'none real' : '—');
    }
    // keep the editable matrix in sync (only the final matrix, not mid-animation values)
    if (st.t >= 1) inputs.forEach((inp, i) => { if (document.activeElement !== inp) inp.value = tn(st.M[i]); });
  }
  function toPreset() { st.M = [...preset3(st.key, st.p, st.dir)]; st.t = 1; st.custom = false; rebuild(); }

  // ---- panel ----
  const g0 = group(panel);
  const dd = dropdown(g0, {
    label: 'Transformation', value: 'identity', options: [...Object.entries(PRESETS3).map(([v, p]) => ({ value: v, label: p.label })), { value: 'custom', label: 'Custom' }],
    onChange: (v) => { if (v === 'custom') return; st.key = v; st.p = PRESETS3[v].param ? PRESETS3[v].param.value : null; st.dir = PRESETS3[v].dirs ? PRESETS3[v].dirs[0] : 'x'; syncControls(); toPreset(); },
  });
  const sl = slider(g0, { label: '$k$', min: -3, max: 3, step: 0.25, value: 1, fmt: (v) => tn(v) + (PRESETS3[st.key].param?.unit || ''), onInput: (v) => { st.p = v; toPreset(); } });
  const dirLabel = document.createElement('div'); dirLabel.className = 'field-label'; dirLabel.style.cssText = 'color:var(--ink-2);font-size:13px;margin-bottom:-4px'; g0.append(dirLabel);
  const dirHost = document.createElement('div'); g0.append(dirHost);
  function syncControls() {
    const P = PRESETS3[st.key];
    sl.hide(!P.param); if (P.param) { renderRich(sl.el.querySelector('label'), `$${P.param.name}$`); sl.setRange(P.param.min, P.param.max); sl.input.step = P.param.step; sl.set(st.p); }
    dirHost.textContent = ''; dirLabel.hidden = dirHost.hidden = !P.dirs;
    if (P.dirs) {
      dirLabel.textContent = P.dirLabel || '';
      segmented(dirHost, { full: true, value: st.dir, options: P.dirs.map((d) => ({ value: d, label: P.dirText ? P.dirText[d] : `$${d}$` + (P.dirLabel === 'About the axis' ? '-axis' : '') })), onChange: (v) => { st.dir = v; toPreset(); } });
    }
    dd.set(st.key);
  }
  // matrix editor
  const edHolder = group(panel, 'Matrix');
  const ed = document.createElement('div'); ed.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:6px'; edHolder.append(ed);
  const inputs = Array.from({ length: 9 }, (_, i) => {
    const inp = document.createElement('input'); inp.type = 'number'; inp.step = '0.25'; inp.value = tn(I3[i]); inp.setAttribute('aria-label', `Row ${Math.floor(i / 3) + 1}, column ${(i % 3) + 1}`);
    inp.style.cssText = 'width:100%;padding:6px 4px;text-align:center;border:1px solid var(--line-2);border-radius:6px;background:var(--stage);font-variant-numeric:tabular-nums;color:var(--ink)';
    inp.addEventListener('input', () => { const v = parseFloat(inp.value); if (Number.isFinite(v)) { st.M[i] = v; st.custom = true; st.t = 1; dd.set('custom'); rebuild(); } });
    ed.append(inp); return inp;
  });
  const lp = loop((dt) => { st.t = Math.min(1, st.t + dt * 0.5 * tr.speed.get()); if (st.t >= 1) tr.set(false); rebuild(); });
  const tr = transport(g0, {
    onPlay: (p) => { if (p) { st.t = 0; lp.start(); } else lp.stop(); },
    onReset: () => { tr.set(false); st.t = 1; rebuild(); },
    speed: { min: 0.25, max: 3, step: 0.25, value: 1, fmt: (v) => '×' + v.toFixed(2) },
  });
  ctx.onHide(() => { tr.set(false); sc.stop(); });
  const g1 = group(panel, 'Show');
  toggle(g1, { label: 'Matrix', checked: true, onChange: (v) => { st.matrix = v; rebuild(); } });
  toggle(g1, { label: 'Determinant', color: 'var(--c-area)', onChange: (v) => { st.det = v; rebuild(); } });
  toggle(g1, { label: 'Eigenvectors', color: 'var(--c-aux)', onChange: (v) => { st.eig = v; rebuild(); } });
  toggle(g1, { label: 'Basis vectors', checked: true, onChange: (v) => { st.vecs = v; rebuild(); } });
  toggle(g1, { label: 'Original cube', checked: true, onChange: (v) => { st.ghost = v; rebuild(); } });
  const ro = readouts(g1, [{ key: 'l0', label: '$\\lambda_1$' }, { key: 'l1', label: '$\\lambda_2$' }, { key: 'l2', label: '$\\lambda_3$' }]);
  ro.el.hidden = true;
  syncControls();
  ctx.onShow(() => { sc.start(); buildStatic(); rebuild(); sc.resetCamera(2.3, new THREE.Vector3(0.6, 0.6, 0.5)); });
}
