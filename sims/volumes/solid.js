// A small three.js scene for solids of revolution.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { colors, onThemeChange } from '../../assets/js/kit/theme.js';
import { clamp } from '../../assets/js/kit/dom.js';

const TAU = Math.PI * 2;

/**
 * Profile: { s0, s1, r(s) outer radius, ri(s) inner radius (0 for solid), axis: 'x' | 'y' }
 * The solid is swept through angle `phi` about the axis.
 * map(s, r, ang) gives world coordinates.
 */
const mapFor = (axis) => (axis === 'y' ? (s, r, a) => [r * Math.cos(a), s, r * Math.sin(a)] : (s, r, a) => [s, r * Math.cos(a), r * Math.sin(a)]);
const finite = (v) => (Number.isFinite(v) ? v : 0);

/** Build a BufferGeometry from quads on a (u, v) grid: pos(i, j) returns [x, y, z] */
function gridGeometry(nu, nv, pos, closeV = false) {
  const verts = [], idx = [];
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) verts.push(...pos(i, j));
  const W = nv + 1;
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * W + j, b = a + 1, c = a + W, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
function merge(geoms) {
  let n = 0, m = 0;
  for (const g of geoms) { n += g.attributes.position.count; m += g.index.count; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), idx = new Uint32Array(m), col = new Float32Array(n * 3);
  let vo = 0, io = 0;
  geoms.forEach((g, k) => {
    pos.set(g.attributes.position.array, vo * 3); nor.set(g.attributes.normal.array, vo * 3);
    const c = g.userData.shade ?? 1;
    for (let i = 0; i < g.attributes.position.count; i++) { col[(vo + i) * 3] = c; col[(vo + i) * 3 + 1] = c; col[(vo + i) * 3 + 2] = c; }
    for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.array[i] + vo;
    vo += g.attributes.position.count; io += g.index.count;
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

export function surfaceGeometries(P, map, phi, nS, nA) {
  const { s0, s1, r, ri } = P, out = [];
  const S = (i) => s0 + ((s1 - s0) * i) / nS;
  const A = (j) => (phi * j) / nA;
  const R = (s) => Math.max(0, finite(r(s))), Ri = (s) => Math.max(0, finite(ri ? ri(s) : 0));
  out.push(gridGeometry(nS, nA, (i, j) => map(S(i), R(S(i)), A(j))));
  if (ri) out.push(gridGeometry(nS, nA, (i, j) => map(S(i), Ri(S(i)), A(j))));
  // end caps (annuli)
  for (const s of [s0, s1]) {
    if (R(s) - Ri(s) > 1e-9) out.push(gridGeometry(1, nA, (i, j) => map(s, i ? R(s) : Ri(s), A(j))));
  }
  // cut faces when only part of a turn
  if (phi < TAU - 1e-3) for (const a of [0, phi]) out.push(gridGeometry(nS, 1, (i, j) => map(S(i), j ? R(S(i)) : Ri(S(i)), a)));
  return out;
}

/** Slices (discs or washers) with mid-point radii. */
export function sliceGeometry(P, map, phi, N, nA) {
  const { s0, s1, r, ri } = P, h = (s1 - s0) / N, geoms = [];
  for (let k = 0; k < N; k++) {
    const x0 = s0 + k * h + h * 0.02, x1 = s0 + (k + 1) * h - h * 0.02, m = s0 + (k + 0.5) * h;
    const R = Math.max(0, finite(r(m))), Ri = Math.max(0, finite(ri ? ri(m) : 0)), A = (j) => (phi * j) / nA, parts = [];
    parts.push(gridGeometry(1, nA, (i, j) => map(i ? x1 : x0, R, A(j))));
    if (Ri > 0) parts.push(gridGeometry(1, nA, (i, j) => map(i ? x1 : x0, Ri, A(j))));
    for (const s of [x0, x1]) parts.push(gridGeometry(1, nA, (i, j) => map(s, i ? R : Ri, A(j))));
    if (phi < TAU - 1e-3) for (const a of [0, phi]) parts.push(gridGeometry(1, 1, (i, j) => map(i ? x1 : x0, j ? R : Ri, a)));
    const shade = k % 2 ? 0.8 : 1;
    parts.forEach((g) => { g.userData.shade = shade; });
    geoms.push(...parts);
  }
  return geoms;
}

export class Scene3D {
  constructor(host) {
    this.host = host;
    this.wrap = document.createElement('div'); this.wrap.className = 'plot';
    host.append(this.wrap);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
    this.renderer.setClearColor(0x000000, 0);
    this.canvas = this.renderer.domElement; this.canvas.style.touchAction = 'none';
    this.wrap.append(this.canvas);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.01, 1000);
    this.camera.up.set(0, 1, 0);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.12;
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const d1 = new THREE.DirectionalLight(0xffffff, 3.2); d1.position.set(4, 7, 6); this.scene.add(d1);
    const d2 = new THREE.DirectionalLight(0xffffff, 1.3); d2.position.set(-5, -3, -4); this.scene.add(d2);
    this.dyn = new THREE.Group(); this.scene.add(this.dyn);
    this.static = new THREE.Group(); this.scene.add(this.static);
    this.dirty = true; this.running = false; this.extent = 5; this.target = new THREE.Vector3();
    this.resetBtn = document.createElement('button'); this.resetBtn.className = 'plot-reset on'; this.resetBtn.type = 'button';
    this.resetBtn.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8a5.5 5.5 0 1 0 1.8-4.1"/><path d="M2.3 2.2v3.3h3.3"/></svg>Reset view';
    this.resetBtn.addEventListener('click', () => this.resetCamera());
    this.wrap.append(this.resetBtn);
    this.controls.addEventListener('change', () => { this.dirty = true; });
    new ResizeObserver(() => this.resize()).observe(this.wrap);
    onThemeChange(() => { this.dirty = true; this.applyTheme && this.applyTheme(); });
  }
  resize() {
    const r = this.wrap.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(r.width, r.height, false);
    this.canvas.style.width = '100%'; this.canvas.style.height = '100%';
    this.camera.aspect = r.width / r.height; this.camera.updateProjectionMatrix();
    this.dirty = true;
  }
  resetCamera(extent = this.extent, target = this.target) {
    this.extent = extent; this.target.copy(target);
    const d = extent * 3.2 / 1.114;
    this.camera.position.set(target.x + d * 0.62, target.y + d * 0.5, target.z + d * 0.78);
    this.controls.target.copy(target); this.controls.update(); this.dirty = true;
  }
  start() { if (this.running) return; this.running = true; this.resize(); const tick = () => { if (!this.running) return; this.controls.update(); if (this.dirty) { this.renderer.render(this.scene, this.camera); this.dirty = false; } requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
  stop() { this.running = false; }
  clear(group) { for (const c of [...group.children]) { group.remove(c); c.geometry && c.geometry.dispose(); c.material && (Array.isArray(c.material) ? c.material.forEach((m) => m.dispose()) : c.material.dispose()); } }
}

export function makeLabel(text, color, size) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d'); ctx.font = 'italic 600 84px "Newsreader", Georgia, serif'; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 64, 70);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sp.scale.set(size, size, 1);
  return sp;
}
export { THREE, TAU, mapFor, merge, clamp };
