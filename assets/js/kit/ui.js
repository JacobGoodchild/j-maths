// Control builders. Every function appends to `parent` and returns a small handle.
import { h, clamp } from './dom.js';
import { renderRich } from './tex.js';

const ICONS = {
  play: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5v11a.5.5 0 0 0 .77.42l8.5-5.5a.5.5 0 0 0 0-.84l-8.5-5.5A.5.5 0 0 0 4 2.5z"/></svg>',
  pause: '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="3.5" y="2.5" width="3.2" height="11" rx="1"/><rect x="9.3" y="2.5" width="3.2" height="11" rx="1"/></svg>',
  step: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M3 2.7v10.6a.5.5 0 0 0 .77.42l7-5.3a.5.5 0 0 0 0-.84l-7-5.3A.5.5 0 0 0 3 2.7z"/><rect x="11.8" y="2.5" width="1.8" height="11" rx=".7"/></svg>',
  reset: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8a5.5 5.5 0 1 0 1.8-4.1"/><path d="M2.3 2.2v3.3h3.3"/></svg>',
  caret: '<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3.5l3 3 3-3"/></svg>',
};
export const icon = (n) => h('span', { html: ICONS[n], style: { display: 'contents' } });

export function group(parent, title) {
  const g = h('div', { class: 'group' }, title ? h('h3', null, title) : null);
  parent.append(g);
  return g;
}

let uid = 0;
export function slider(parent, o) {
  const id = 'sl' + (++uid);
  const input = h('input', { type: 'range', id, min: o.min, max: o.max, step: o.step ?? 'any', value: o.value });
  const lab = h('label', { for: id });
  renderRich(lab, o.label || '');
  const out = h('output', { for: id });
  const fmt = o.fmt || ((v) => String(+v.toFixed(3)));
  const el = h('div', { class: 'slider' }, h('div', { class: 'top' }, lab, out), input);
  if (o.color) input.style.setProperty('--col', o.color);
  const paint = () => {
    const v = +input.value;
    input.style.setProperty('--pct', ((v - input.min) / (input.max - input.min)) * 100 + '%');
    out.textContent = fmt(v);
  };
  input.addEventListener('input', () => { paint(); o.onInput && o.onInput(+input.value); });
  paint();
  parent.append(el);
  return {
    el, input,
    get: () => +input.value,
    set(v, silent = true) { input.value = v; paint(); if (!silent) o.onInput && o.onInput(+input.value); },
    setRange(min, max) { input.min = min; input.max = max; paint(); },
    hide(b) { el.hidden = b; },
  };
}

export function toggle(parent, o) {
  const input = h('input', { type: 'checkbox' });
  input.checked = !!o.checked;
  const t = h('span', { class: 't' });
  renderRich(t, o.label);
  const sw = h('span', { class: 'sw' });
  if (o.color) sw.style.setProperty('--sw-col', o.color);
  const el = h('label', { class: 'toggle' }, input, sw, t);
  input.addEventListener('change', () => o.onChange && o.onChange(input.checked));
  parent.append(el);
  return {
    el, input,
    get: () => input.checked,
    set(v, fire = false) { input.checked = v; if (fire) o.onChange && o.onChange(v); },
    hide(b) { el.hidden = b; },
  };
}

export function segmented(parent, o) {
  let val = o.value;
  const el = h('div', { class: 'seg' + (o.full ? ' full' : ''), role: 'group' });
  const btns = o.options.map((op) => {
    const b = h('button', { type: 'button', 'aria-pressed': String(op.value === val) });
    renderRich(b, op.label);
    b.addEventListener('click', () => set(op.value, true));
    el.append(b);
    return b;
  });
  function set(v, fire) {
    val = v;
    btns.forEach((b, i) => b.setAttribute('aria-pressed', String(o.options[i].value === v)));
    if (fire && o.onChange) o.onChange(v);
  }
  if (o.label) parent.append(h('div', { class: 'field-label', style: { color: 'var(--ink-2)', fontSize: '13px', marginBottom: '-4px' } }, o.label));
  parent.append(el);
  return { el, get: () => val, set: (v) => set(v, false), hide(b) { el.hidden = b; } };
}

export function button(parent, o) {
  const b = h('button', { type: 'button', class: 'btn' + (o.primary ? ' primary' : '') });
  if (o.icon) b.append(icon(o.icon));
  if (o.label) { const s = h('span'); renderRich(s, o.label); b.append(s); }
  if (o.title) { b.title = o.title; b.setAttribute('aria-label', o.title); }
  b.addEventListener('click', () => o.onClick && o.onClick());
  parent.append(b);
  return b;
}

/** Custom dropdown so options can contain maths. */
export function dropdown(parent, o) {
  let val = o.value;
  const cur = h('span');
  const btn = h('button', { type: 'button', 'aria-haspopup': 'listbox', 'aria-expanded': 'false' }, cur, h('span', { class: 'caret', html: ICONS.caret }));
  const list = h('ul', { role: 'listbox', hidden: true });
  const el = h('div', { class: 'dropdown' }, o.label ? h('span', { class: 'field-label' }, o.label) : null, btn, list);
  let items = [];
  function build(options) {
    list.textContent = '';
    items = options.map((op) => {
      const li = h('li', { role: 'option', 'aria-selected': String(op.value === val) });
      renderRich(li, op.label);
      li.addEventListener('click', () => { set(op.value, true); close(); btn.focus(); });
      list.append(li);
      return li;
    });
    const sel = options.find((x) => x.value === val) || options[0];
    renderRich(cur, sel ? sel.label : '');
  }
  let options = o.options;
  build(options);
  function set(v, fire) {
    val = v;
    items.forEach((li, i) => li.setAttribute('aria-selected', String(options[i].value === v)));
    const sel = options.find((x) => x.value === v);
    if (sel) renderRich(cur, sel.label);
    if (fire && o.onChange) o.onChange(v);
  }
  const open = () => { list.hidden = false; btn.setAttribute('aria-expanded', 'true'); };
  const close = () => { list.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  btn.addEventListener('click', () => (list.hidden ? open() : close()));
  document.addEventListener('pointerdown', (e) => { if (!el.contains(e.target)) close(); });
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const i = options.findIndex((x) => x.value === val);
      const j = clamp(i + (e.key === 'ArrowDown' ? 1 : -1), 0, options.length - 1);
      set(options[j].value, true);
    } else if (e.key === 'Escape') close();
  });
  parent.append(el);
  return { el, get: () => val, set: (v) => set(v, false), setOptions(opts) { options = opts; build(opts); } };
}

export function readouts(parent, rows) {
  const el = h('div', { class: 'readouts' });
  const vals = {};
  for (const r of rows) {
    const k = h('span', { class: 'k' }); renderRich(k, r.label);
    const v = h('span', { class: 'v' });
    el.append(k, v);
    vals[r.key] = v;
  }
  parent.append(el);
  return { el, set(key, text) { if (vals[key].textContent !== text) vals[key].textContent = text; }, hide(b) { el.hidden = b; } };
}

/** Play / pause / step / reset, plus optional speed slider. */
export function transport(parent, o) {
  let playing = !!o.playing;
  const row = h('div', { class: 'transport' });
  const playBtn = h('button', { type: 'button', class: 'btn primary', title: 'Play / pause', 'aria-label': 'Play or pause' });
  const paint = () => { playBtn.textContent = ''; playBtn.append(icon(playing ? 'pause' : 'play')); };
  paint();
  const set = (p, fire = true) => { playing = p; paint(); if (fire) o.onPlay && o.onPlay(p); };
  playBtn.addEventListener('click', () => set(!playing));
  row.append(playBtn);
  if (o.onStep) button(row, { icon: 'step', title: 'Step', onClick: () => { if (playing) set(false); o.onStep(); } });
  if (o.onReset) button(row, { icon: 'reset', title: 'Reset', onClick: () => { o.onReset(); } });
  parent.append(row);
  let speed = null;
  if (o.speed) speed = slider(parent, { label: 'Speed', ...o.speed });
  return { el: row, speed, get playing() { return playing; }, set, hide(b) { row.hidden = b; if (speed) speed.hide(b); } };
}
