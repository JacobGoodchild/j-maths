// Theme handling + semantic colour lookup for canvas drawing.
const KEY = 'jm-theme';
const root = document.documentElement;
let cache = null;

export function getTheme() {
  return root.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function setTheme(t) {
  root.dataset.theme = t;
  try { localStorage.setItem(KEY, t); } catch (e) {}
  cache = null;
  document.dispatchEvent(new CustomEvent('themechange', { detail: t }));
}

export function initTheme() {
  let t = 'light';
  try { t = localStorage.getItem(KEY) || 'light'; } catch (e) {}
  root.dataset.theme = t;
}

const NAMES = ['bg','panel','stage','ink','ink-2','ink-3','line','line-2','grid','grid-2','axis','halo',
  'c-fn','c-approx','c-error','c-tangent','c-area','c-aux','c-warn','c-muted','c-sin','c-cos','c-tan'];

/** Resolved colours for canvas drawing, e.g. colors().fn */
export function colors() {
  if (cache) return cache;
  const cs = getComputedStyle(root);
  cache = {};
  for (const n of NAMES) cache[n.replace(/^c-/, '').replace(/-(\d)/, '$1')] = cs.getPropertyValue('--' + n).trim();
  return cache;
}

export function withAlpha(hex, a) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

export function onThemeChange(fn) { document.addEventListener('themechange', fn); }

export const SVG_COG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
