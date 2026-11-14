// Shared three.js scene wrapper: renderer, camera, orbit controls, lights, render-on-demand loop.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { onThemeChange } from './theme.js';

export class Scene3D {
  constructor(host, opts = {}) {
    this.host = host;
    this.wrap = document.createElement('div'); this.wrap.className = 'plot';
    host.append(this.wrap);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
    this.renderer.setClearColor(0x000000, 0);
    this.canvas = this.renderer.domElement; this.canvas.style.touchAction = 'none';
    this.wrap.append(this.canvas);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.01, 1000);
    this.camera.up.set(...(opts.up || [0, 1, 0]));
    const dv = new THREE.Vector3(...(opts.dir || [0.62, 0.5, 0.78])).normalize(); this.dir = dv;
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.12;
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const d1 = new THREE.DirectionalLight(0xffffff, 3.2); d1.position.set(4, 7, 6); this.scene.add(d1);
    const d2 = new THREE.DirectionalLight(0xffffff, 1.3); d2.position.set(-5, -3, -4); this.scene.add(d2);
    this.dyn = new THREE.Group(); this.scene.add(this.dyn);
    this.static = new THREE.Group(); this.scene.add(this.static);
    this.dirty = true; this.running = false; this.extent = 5; this.target = new THREE.Vector3();
    this.resetBtn = document.createElement('button'); this.resetBtn.className = 'plot-reset'; this.resetBtn.type = 'button';
    this.resetBtn.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8a5.5 5.5 0 1 0 1.8-4.1"/><path d="M2.3 2.2v3.3h3.3"/></svg>Reset view';
    this.resetBtn.addEventListener('click', () => this.resetCamera());
    this.wrap.append(this.resetBtn);
    this.controls.addEventListener('change', () => { this.dirty = true; });
    this.controls.addEventListener('start', () => this.resetBtn.classList.add('on'));
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
    const d = extent * 3.2;
    this.camera.position.copy(target).addScaledVector(this.dir, d);
    this.controls.target.copy(target); this.controls.update(); this.dirty = true; this.resetBtn.classList.remove('on');
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

export { THREE };
